import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import {
  Search,
  Filter,
  Info,
  Play,
  Pause,
  Trash2,
  Edit2,
  Copy,
  ArrowUp,
  ArrowDown,
  BarChart3,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  executeRoutingRulesCommand,
  getRoutingRulesView,
  type RoutingTarget,
  type RoutingRuleViewModel,
  type RoutingRulesViewModel,
} from "@/services/routingService"
import { normalizeErrorMessage } from "@/services/http"
import {
  getReceptionChannelDetail,
  listKFServicerAssignments,
  type KFServicerAssignment,
  type ReceptionChannelDetail,
} from "@/services/receptionService"
import {
  getOrganizationSettingsView,
  type OrganizationSettingsView,
} from "@/services/organizationSettingsService"
import {
  buildRawServicerIDsByStableIdentity,
  mapSelectedUserIDsToPoolRaw,
  resolveServicerIdentityView,
} from "@/services/servicerIdentity"
import {
  buildDirectoryMaps,
  buildDirectoryTree,
  buildSelectedObjectDirectoryTree,
  normalizeSelectionItems,
  OrganizationDirectorySelect,
  type DirectorySelectionItem,
} from "@/components/wecom/OrganizationDirectorySelect"

const initialRoutingRulesView: RoutingRulesViewModel = {
  rules: [],
  totalHits: 0,
  transferRate: "0%",
  avgResponseTime: "0s",
  distributions: [],
  channelOptions: [],
  modeOptions: [],
  targetOptions: [],
  diagnostics: {
    warnings: [],
    items: [],
  },
}

const MAX_VISIBLE_CHANNEL_TABS = 6

type RoutingActionMode =
  | "ai_only"
  | "send_to_pool"
  | "assign_human"
  | "queue_then_human"
  | "ai_then_assign_human"
  | "ai_then_queue_then_human"

type RoutingDispatchStrategy =
  | "none"
  | "specific_user"
  | "pool_dispatch"
  | "direct_if_available_else_queue"
  | "always_queue"

const DEFAULT_DIRECT_DISPATCH_THRESHOLD = 3

function formatRoutingTargetLabel(target?: RoutingTarget): string {
  const kind = (target?.kind || "").trim()
  const userCount = Number(target?.userCount || target?.userIds?.length || 0)
  const departmentCount = Number(target?.departmentCount || target?.departmentIds?.length || 0)
  switch (kind) {
    case "ai_only":
      return "无需人工接待"
    case "current_pool":
      return "当前接待池"
    case "full_pool":
      return "整个接待池"
    case "specific_user":
      return "指定 1 名成员"
    case "pool_subset": {
      const parts: string[] = []
      if (userCount > 0) parts.push(`${userCount} 名成员`)
      if (departmentCount > 0) parts.push(`${departmentCount} 个部门`)
      return parts.join(" / ") || "接待池对象子集"
    }
    default:
      return "当前接待池"
  }
}

function formatRoutingTargetDetail(target?: RoutingTarget): string {
  const kind = (target?.kind || "").trim()
  switch (kind) {
    case "specific_user":
      return "直接指定人工"
    case "full_pool":
      return "使用整个接待池"
    case "pool_subset":
      return "接待池对象子集"
    default:
      return ""
  }
}

const ACTION_MODE_OPTIONS: Array<{
  value: RoutingActionMode
  label: string
  description: string
}> = [
  { value: "ai_only", label: "仅 AI", description: "仅由 AI 接待，不进入人工流程。" },
  { value: "send_to_pool", label: "送入待接入池", description: "立即进入人工体系，由接待池继续分配。" },
  { value: "assign_human", label: "转给指定人工", description: "直接分配给明确人工，不经过排队。" },
  { value: "queue_then_human", label: "排队后待人工接入", description: "立即进入排队，等待人工接入。" },
  { value: "ai_then_assign_human", label: "AI 接待后转人工", description: "先由 AI 接待，后续再转给人工。" },
  { value: "ai_then_queue_then_human", label: "AI 命中条件后转人工 - 先进入排队，等待自动分配", description: "先由 AI 接待；命中当前路由条件后，先进入排队，再等待系统自动分配人工。" },
]

const DISPATCH_STRATEGY_OPTIONS: Record<RoutingActionMode, Array<{
  value: RoutingDispatchStrategy
  label: string
  description: string
}>> = {
  ai_only: [{ value: "none", label: "无需人工分配", description: "当前动作不会进入人工流程。" }],
  send_to_pool: [
    { value: "pool_dispatch", label: "交给接待池分配", description: "进入人工体系后，由接待池继续承接。" },
    { value: "direct_if_available_else_queue", label: "有空位先直分，否则排队", description: "有空闲人工则直接分配，否则进入排队。" },
  ],
  assign_human: [{ value: "specific_user", label: "直接指定人工", description: "明确指定 1 名人工直接承接。" }],
  queue_then_human: [{ value: "always_queue", label: "始终进入排队", description: "不做即时分配，直接进入排队。" }],
  ai_then_assign_human: [
    { value: "specific_user", label: "直接指定人工", description: "AI 接待后，直接转给明确人工。" },
    { value: "direct_if_available_else_queue", label: "有空位先直分，否则排队", description: "AI 接待后，若有空位则直分，否则进入排队。" },
  ],
  ai_then_queue_then_human: [{ value: "always_queue", label: "先进入排队，等待自动分配", description: "AI 命中条件后，先进入排队，后续由系统自动分配人工。" }],
}

function actionModeLabel(actionMode?: string): string {
  return (
    ACTION_MODE_OPTIONS.find((item) => item.value === (actionMode || "").trim())
      ?.label || "仅 AI"
  )
}

function defaultDispatchStrategyForActionMode(
  actionMode: RoutingActionMode,
): RoutingDispatchStrategy {
  return DISPATCH_STRATEGY_OPTIONS[actionMode][0]?.value || "none"
}

function dispatchStrategyLabel(strategy?: string): string {
  for (const options of Object.values(DISPATCH_STRATEGY_OPTIONS)) {
    const matched = options.find((item) => item.value === (strategy || "").trim())
    if (matched) return matched.label
  }
  return "无需人工分配"
}

function actionModeRequiresHuman(actionMode?: string): boolean {
  return (actionMode || "").trim() !== "ai_only"
}

function actionModeSupportsAIToHumanKeywords(actionMode?: string): boolean {
  return ["ai_then_assign_human", "ai_then_queue_then_human"].includes((actionMode || "").trim())
}

function dispatchStrategySupportsHumanScope(strategy?: string): boolean {
  return ["pool_dispatch", "direct_if_available_else_queue", "always_queue", "specific_user"].includes(
    (strategy || "").trim(),
  )
}

function dispatchStrategyRequiresSpecificUser(strategy?: string): boolean {
  return (strategy || "").trim() === "specific_user"
}

function parseJSONRecord(raw?: string): Record<string, unknown> {
  const text = String(raw || "").trim()
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function firstSceneValueFromConditions(raw?: string): string {
  const payload = parseJSONRecord(raw)
  const values = Array.isArray(payload.scene_values) ? payload.scene_values : []
  for (const item of values) {
    const text = String(item || "").trim()
    if (text) return text
  }
  return ""
}

export default function RoutingRules() {
  const [searchParams] = useSearchParams()
  const [view, setView] = useState<RoutingRulesViewModel>(initialRoutingRulesView)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState("")
  const [drawerNotice, setDrawerNotice] = useState("")

  const [filterChannel, setFilterChannel] = useState(searchParams.get("channel") || "all")
  const [keyword, setKeyword] = useState("")
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [ruleTypeFilter, setRuleTypeFilter] = useState("all")
  const [modeFilter, setModeFilter] = useState("all")
  const [targetFilter, setTargetFilter] = useState("all")
  const [hitBucketFilter, setHitBucketFilter] = useState("all")
  const [responseBucketFilter, setResponseBucketFilter] = useState("all")
  const [diagnosticsOnly, setDiagnosticsOnly] = useState(false)

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedRule, setSelectedRule] = useState<RoutingRuleViewModel | null>(null)
  const [organizationView, setOrganizationView] =
    useState<OrganizationSettingsView | null>(null)
  const [isOrgOptionsLoading, setIsOrgOptionsLoading] = useState(false)
  const [fallbackDetail, setFallbackDetail] =
    useState<ReceptionChannelDetail | null>(null)
  const [fallbackPoolAssignments, setFallbackPoolAssignments] = useState<
    KFServicerAssignment[]
  >([])
  const [fallbackActionModeInput, setFallbackActionModeInput] = useState<RoutingActionMode>("ai_only")
  const [fallbackDispatchStrategyInput, setFallbackDispatchStrategyInput] =
    useState<RoutingDispatchStrategy>("none")
  const [fallbackDispatchCapacityThresholdInput, setFallbackDispatchCapacityThresholdInput] =
    useState(DEFAULT_DIRECT_DISPATCH_THRESHOLD)
  const [fallbackUseFullPoolInput, setFallbackUseFullPoolInput] = useState(true)
  const [selectedFallbackTargets, setSelectedFallbackTargets] = useState<
    DirectorySelectionItem[]
  >([])
  const [regularActionModeInput, setRegularActionModeInput] = useState<RoutingActionMode>("ai_only")
  const [regularDispatchStrategyInput, setRegularDispatchStrategyInput] =
    useState<RoutingDispatchStrategy>("none")
  const [regularDispatchCapacityThresholdInput, setRegularDispatchCapacityThresholdInput] =
    useState(DEFAULT_DIRECT_DISPATCH_THRESHOLD)
  const [regularUseFullPoolInput, setRegularUseFullPoolInput] = useState(true)
  const [regularAIToHumanKeywordsInput, setRegularAIToHumanKeywordsInput] = useState("")
  const [selectedRegularTargets, setSelectedRegularTargets] = useState<
    DirectorySelectionItem[]
  >([])
  const [formSceneParamValue, setFormSceneParamValue] = useState("")
  const [formSceneParamNonEmpty, setFormSceneParamNonEmpty] = useState(false)
  const [regularDetail, setRegularDetail] = useState<ReceptionChannelDetail | null>(null)
  const [regularPoolAssignments, setRegularPoolAssignments] = useState<KFServicerAssignment[]>([])

  const [formName, setFormName] = useState("")
  const [formChannelID, setFormChannelID] = useState("")
  const [formScene, setFormScene] = useState("")
  const [formPriority, setFormPriority] = useState(100)
  const requestedEditRuleID = Number(searchParams.get("edit_rule_id") || 0)
  const [hasAutoOpenedEditRule, setHasAutoOpenedEditRule] = useState(false)

  useEffect(() => {
    const channel = searchParams.get("channel")
    if (channel) {
      setFilterChannel(channel)
    }
  }, [searchParams])

  useEffect(() => {
    setHasAutoOpenedEditRule(false)
  }, [requestedEditRuleID])

  const fallbackPoolRawUsersByStableIdentity = useMemo(
    () => buildRawServicerIDsByStableIdentity(fallbackPoolAssignments),
    [fallbackPoolAssignments],
  )
  const regularPoolRawUsersByStableIdentity = useMemo(
    () => buildRawServicerIDsByStableIdentity(regularPoolAssignments),
    [regularPoolAssignments],
  )

  const syncFallbackDraftFromDetail = (
    detail: ReceptionChannelDetail | null,
    assignments?: KFServicerAssignment[],
  ) => {
    const stableIdentityByRaw = new Map<string, string>()
    ;(assignments || fallbackPoolAssignments).forEach((assignment) => {
      const identity = resolveServicerIdentityView(assignment)
      const rawID = identity.rawServicerUserID.trim()
      const stableID = (identity.stableIdentity || rawID).trim()
      if (!rawID || !stableID) return
      stableIdentityByRaw.set(rawID, stableID)
    })
    setFallbackDetail(detail)
    const actionMode = ((detail?.fallback_route?.action_mode || "ai_only").trim() ||
      "ai_only") as RoutingActionMode
    const dispatchStrategy = ((detail?.fallback_route?.dispatch_strategy || "").trim() ||
      defaultDispatchStrategyForActionMode(actionMode)) as RoutingDispatchStrategy
    setFallbackActionModeInput(actionMode)
    setFallbackDispatchStrategyInput(dispatchStrategy)
    setFallbackDispatchCapacityThresholdInput(
      Number(
        detail?.fallback_route?.dispatch_capacity_threshold ||
          (dispatchStrategy === "direct_if_available_else_queue"
            ? DEFAULT_DIRECT_DISPATCH_THRESHOLD
            : 0),
      ),
    )
    const fallbackTarget = detail?.fallback_route?.target
    setFallbackUseFullPoolInput(
      actionMode === "ai_only"
        ? true
        : detail?.fallback_route?.use_full_pool ?? fallbackTarget?.useFullPool ?? false,
    )
    setSelectedFallbackTargets(
      normalizeSelectionItems([
        ...((fallbackTarget?.userIds || []).map((userID) => ({
          type: "user" as const,
          id: stableIdentityByRaw.get(String(userID || "").trim()) || String(userID || "").trim(),
        }))),
        ...((fallbackTarget?.departmentIds || []).map(
          (departmentID) => ({
            type: "department" as const,
            id: String(Number(departmentID || 0)),
          }),
        )),
      ]),
    )
  }

  const orgCorpID = (organizationView?.integration?.corp_id || "").trim()
  const { departmentMap: orgDepartmentMap, memberMap: orgMemberMap } =
    useMemo(() => buildDirectoryMaps(organizationView), [organizationView])
  const { treeRoots, ungroupedUsers: ungroupedUserIDs } = useMemo(
    () => buildDirectoryTree(organizationView),
    [organizationView],
  )
  const selectedFallbackTargetsDeduped = useMemo(
    () => normalizeSelectionItems(selectedFallbackTargets),
    [selectedFallbackTargets],
  )
  const selectedFallbackUsersDeduped = useMemo(
    () =>
      selectedFallbackTargetsDeduped
        .filter((item) => item.type === "user")
        .map((item) => item.id.trim())
        .filter(Boolean),
    [selectedFallbackTargetsDeduped],
  )
  const selectedFallbackDepartmentsDeduped = useMemo(
    () =>
      selectedFallbackTargetsDeduped
        .filter((item) => item.type === "department")
        .map((item) => Number(item.id))
        .filter((item) => Number.isInteger(item) && item > 0),
    [selectedFallbackTargetsDeduped],
  )
  const isEditingDefaultRule = selectedRule?.isDefault === true
  const currentPoolAllowedUserIDs = useMemo(
    () =>
      fallbackPoolAssignments
        .map((item) => resolveServicerIdentityView(item).stableIdentity)
        .filter(Boolean),
    [fallbackPoolAssignments],
  )
  const currentPoolAllowedDepartmentIDs = useMemo(
    () =>
      fallbackPoolAssignments
        .map((item) => Number(item.department_id || 0))
        .filter((item) => Number.isInteger(item) && item > 0),
    [fallbackPoolAssignments],
  )
  const {
    treeRoots: fallbackTreeRoots,
    ungroupedUsers: fallbackUngroupedUserIDs,
  } = useMemo(
    () =>
      buildSelectedObjectDirectoryTree(
        organizationView,
        currentPoolAllowedUserIDs,
        currentPoolAllowedDepartmentIDs,
      ),
    [organizationView, currentPoolAllowedDepartmentIDs, currentPoolAllowedUserIDs],
  )
  const fallbackPoolEmpty =
    fallbackDetail?.reception_pool?.empty === true ||
    (Number(fallbackDetail?.reception_pool?.user_count || 0) === 0 &&
      Number(fallbackDetail?.reception_pool?.department_count || 0) === 0)
  const currentRegularPoolAllowedUserIDs = useMemo(
    () =>
      regularPoolAssignments
        .map((item) => resolveServicerIdentityView(item).stableIdentity)
        .filter(Boolean),
    [regularPoolAssignments],
  )
  const currentRegularPoolAllowedDepartmentIDs = useMemo(
    () =>
      regularPoolAssignments
        .map((item) => Number(item.department_id || 0))
        .filter((item) => Number.isInteger(item) && item > 0),
    [regularPoolAssignments],
  )
  const {
    treeRoots: regularTreeRoots,
    ungroupedUsers: regularUngroupedUserIDs,
  } = useMemo(
    () =>
      buildSelectedObjectDirectoryTree(
        organizationView,
        currentRegularPoolAllowedUserIDs,
        currentRegularPoolAllowedDepartmentIDs,
      ),
    [organizationView, currentRegularPoolAllowedDepartmentIDs, currentRegularPoolAllowedUserIDs],
  )
  const selectedRegularTargetsDeduped = useMemo(
    () => normalizeSelectionItems(selectedRegularTargets),
    [selectedRegularTargets],
  )
  const selectedRegularUsersDeduped = useMemo(
    () =>
      selectedRegularTargetsDeduped
        .filter((item) => item.type === "user")
        .map((item) => item.id.trim())
        .filter(Boolean),
    [selectedRegularTargetsDeduped],
  )
  const selectedRegularDepartmentsDeduped = useMemo(
    () =>
      selectedRegularTargetsDeduped
        .filter((item) => item.type === "department")
        .map((item) => Number(item.id))
        .filter((item) => Number.isInteger(item) && item > 0),
    [selectedRegularTargetsDeduped],
  )
  const regularPoolEmpty =
    regularDetail?.reception_pool?.empty === true ||
    (Number(regularDetail?.reception_pool?.user_count || 0) === 0 &&
      Number(regularDetail?.reception_pool?.department_count || 0) === 0)
  const fallbackDispatchOptions = useMemo(
    () => DISPATCH_STRATEGY_OPTIONS[fallbackActionModeInput] || DISPATCH_STRATEGY_OPTIONS.ai_only,
    [fallbackActionModeInput],
  )
  const regularDispatchOptions = useMemo(
    () => DISPATCH_STRATEGY_OPTIONS[regularActionModeInput] || DISPATCH_STRATEGY_OPTIONS.ai_only,
    [regularActionModeInput],
  )

  const loadView = async (
    channel: string,
    query: string,
    filters: {
      statusFilter: string
      ruleTypeFilter: string
      modeFilter: string
      targetFilter: string
      hitBucketFilter: string
      responseBucketFilter: string
      diagnosticsOnly: boolean
    },
    options?: { preserveTable?: boolean },
  ) => {
    const preserveTable = options?.preserveTable === true
    try {
      if (!preserveTable) {
        setIsLoading(true)
      }
      const loaded = await getRoutingRulesView({
        channel_filter: channel === "all" ? "" : channel,
        query,
        status_filter: filters.statusFilter,
        rule_type_filter: filters.ruleTypeFilter,
        mode_filter: filters.modeFilter,
        target_filter: filters.targetFilter,
        hit_bucket_filter: filters.hitBucketFilter,
        response_bucket_filter: filters.responseBucketFilter,
        diagnostics_only: filters.diagnosticsOnly,
      })
      setView(loaded)
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
      if (!preserveTable) {
        setView(initialRoutingRulesView)
      }
    } finally {
      if (!preserveTable) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    if (!isDrawerOpen || !isEditingDefaultRule) return
    const channelID = (selectedRule?.channelId || "").trim()
    if (!channelID) return
    let active = true
    void (async () => {
      try {
        setIsOrgOptionsLoading(true)
        const [detail, orgView, assignments] = await Promise.all([
          getReceptionChannelDetail(channelID),
          organizationView ? Promise.resolve(organizationView) : getOrganizationSettingsView(),
          listKFServicerAssignments(channelID),
        ])
        if (!active) return
        setFallbackPoolAssignments(assignments)
        syncFallbackDraftFromDetail(detail, assignments)
        if (!organizationView) {
          setOrganizationView(orgView)
        }
      } catch (error) {
        if (!active) return
        setDrawerNotice(normalizeErrorMessage(error))
      } finally {
        if (active) {
          setIsOrgOptionsLoading(false)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [isDrawerOpen, isEditingDefaultRule, selectedRule?.channelId])

  useEffect(() => {
    if (!isDrawerOpen || isEditingDefaultRule) return
    const channelID = formChannelID.trim()
    if (!channelID) return
    let active = true
    void (async () => {
      try {
        setIsOrgOptionsLoading(true)
        const [detail, orgView, assignments] = await Promise.all([
          getReceptionChannelDetail(channelID),
          organizationView ? Promise.resolve(organizationView) : getOrganizationSettingsView(),
          listKFServicerAssignments(channelID),
        ])
        if (!active) return
        setRegularDetail(detail)
        setRegularPoolAssignments(assignments)
        if (selectedRule && !selectedRule.isDefault) {
          const stableIdentityByRaw = new Map<string, string>()
          assignments.forEach((assignment) => {
            const identity = resolveServicerIdentityView(assignment)
            const rawID = identity.rawServicerUserID.trim()
            const stableID = (identity.stableIdentity || rawID).trim()
            if (!rawID || !stableID) return
            stableIdentityByRaw.set(rawID, stableID)
          })
          const action = parseJSONRecord(selectedRule.actionJson)
          setSelectedRegularTargets(
            normalizeSelectionItems([
              ...(Array.isArray(action.assigned_staff_ids)
                ? action.assigned_staff_ids.map((userID) => ({
                    type: "user" as const,
                    id: stableIdentityByRaw.get(String(userID || "").trim()) || String(userID || "").trim(),
                  }))
                : []),
              ...(Array.isArray(action.assigned_department_ids)
                ? action.assigned_department_ids.map((departmentID) => ({
                    type: "department" as const,
                    id: String(Number(departmentID || 0)),
                  }))
                : []),
            ]),
          )
        }
        if (!organizationView) {
          setOrganizationView(orgView)
        }
      } catch (error) {
        if (!active) return
        setDrawerNotice(normalizeErrorMessage(error))
      } finally {
        if (active) {
          setIsOrgOptionsLoading(false)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [isDrawerOpen, isEditingDefaultRule, formChannelID])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadView(
        filterChannel,
        keyword,
        {
          statusFilter,
          ruleTypeFilter,
          modeFilter,
          targetFilter,
          hitBucketFilter,
          responseBucketFilter,
          diagnosticsOnly,
        },
        { preserveTable: false },
      )
    }, 220)
    return () => window.clearTimeout(timer)
  }, [filterChannel, keyword, statusFilter, ruleTypeFilter, modeFilter, targetFilter, hitBucketFilter, responseBucketFilter, diagnosticsOnly])

  const openCreateDrawer = () => {
    setDrawerNotice("")
    setSelectedRule(null)
    syncFallbackDraftFromDetail(null)
    setRegularDetail(null)
    setRegularPoolAssignments([])
    setFormName("")
    setFormScene("")
    setFormSceneParamValue("")
    setFormSceneParamNonEmpty(false)
    setRegularActionModeInput("ai_only")
    setRegularDispatchStrategyInput("none")
    setRegularDispatchCapacityThresholdInput(DEFAULT_DIRECT_DISPATCH_THRESHOLD)
    setRegularUseFullPoolInput(true)
    setRegularAIToHumanKeywordsInput("")
    setSelectedRegularTargets([])
    setFormPriority(100)
    setFormChannelID(filterChannel !== "all" ? filterChannel : (view.channelOptions[0]?.channelId || "").trim())
    setIsDrawerOpen(true)
  }

  const openEditDrawer = (rule: RoutingRuleViewModel) => {
    setDrawerNotice("")
    setSelectedRule(rule)
    setFormName((rule.name || "").trim())
    setFormChannelID((rule.channelId || "").trim())
    setFormPriority(Number(rule.priority || 100))
    if (rule.isDefault) {
      setFormScene("")
      setFormSceneParamValue("")
      setFormSceneParamNonEmpty(false)
      setRegularActionModeInput("ai_only")
      setRegularDispatchStrategyInput("none")
      setRegularDispatchCapacityThresholdInput(DEFAULT_DIRECT_DISPATCH_THRESHOLD)
      setRegularUseFullPoolInput(true)
      setRegularAIToHumanKeywordsInput("")
      setSelectedRegularTargets([])
    } else {
      const conditions = parseJSONRecord(rule.conditionsJson)
      const action = parseJSONRecord(rule.actionJson)
      const aiToHumanConditions =
        action.ai_to_human_conditions && typeof action.ai_to_human_conditions === "object"
          ? (action.ai_to_human_conditions as Record<string, unknown>)
          : {}
      const actionMode = ((rule.actionMode || String(action.action_mode || "")).trim() ||
        "ai_only") as RoutingActionMode
      const dispatchStrategy = ((rule.dispatchStrategy || String(action.dispatch_strategy || "")).trim() ||
        defaultDispatchStrategyForActionMode(actionMode)) as RoutingDispatchStrategy
      setFormScene(firstSceneValueFromConditions(rule.conditionsJson) || "")
      setFormSceneParamValue(String(conditions.scene_param_value || "").trim())
      setFormSceneParamNonEmpty(conditions.scene_param_non_empty === true)
      setRegularActionModeInput(actionMode)
      setRegularDispatchStrategyInput(dispatchStrategy)
      setRegularDispatchCapacityThresholdInput(
        Number(
          action.dispatch_capacity_threshold ||
            (dispatchStrategy === "direct_if_available_else_queue"
              ? DEFAULT_DIRECT_DISPATCH_THRESHOLD
              : 0),
        ),
      )
      setRegularUseFullPoolInput(
        actionMode === "ai_only"
          ? true
          : action.use_full_pool === true ||
              (Array.isArray(action.assigned_staff_ids) && action.assigned_staff_ids.length === 0 &&
                Array.isArray(action.assigned_department_ids) && action.assigned_department_ids.length === 0),
      )
      setRegularAIToHumanKeywordsInput(String(aiToHumanConditions.keywords || "").trim())
      setSelectedRegularTargets(
        normalizeSelectionItems([
          ...(Array.isArray(action.assigned_staff_ids)
            ? action.assigned_staff_ids.map((userID) => ({
                type: "user" as const,
                id: String(userID || "").trim(),
              }))
            : []),
          ...(Array.isArray(action.assigned_department_ids)
            ? action.assigned_department_ids.map((departmentID) => ({
                type: "department" as const,
                id: String(Number(departmentID || 0)),
              }))
            : []),
        ]),
      )
      syncFallbackDraftFromDetail(null)
    }
    setIsDrawerOpen(true)
  }

  const runCommand = async (
    input: {
      command: string
      ruleID?: number
      openKFID?: string
      payload?: Record<string, unknown>
    },
    options?: {
      refresh?: boolean
      copyMessage?: boolean
      noticeScope?: "page" | "drawer"
    },
  ) => {
    const setScopedNotice = options?.noticeScope === "drawer" ? setDrawerNotice : setNotice
    try {
      setIsSubmitting(true)
      const result = await executeRoutingRulesCommand({
        command: input.command,
        rule_id: input.ruleID || 0,
        open_kfid: input.openKFID || "",
        payload: input.payload || {},
      })
      const message = (result?.message || "命令已提交").trim()
      if (options?.copyMessage) {
        try {
          await navigator.clipboard.writeText(message)
          setScopedNotice("链接已复制")
        } catch {
          setScopedNotice("复制失败，请手动复制")
        }
      } else {
        setScopedNotice(message)
      }
      if (options?.refresh !== false) {
        await loadView(
          filterChannel,
          keyword,
          {
            statusFilter,
            ruleTypeFilter,
            modeFilter,
            targetFilter,
            hitBucketFilter,
            responseBucketFilter,
            diagnosticsOnly,
          },
          { preserveTable: true },
        )
      }
      return result
    } catch (error) {
      setScopedNotice(normalizeErrorMessage(error))
      return null
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveRule = async () => {
    const channelID = formChannelID.trim()
    if (isEditingDefaultRule) {
      if (!channelID) {
        setDrawerNotice("当前默认兜底规则缺少渠道")
        return
      }
      const actionMode = fallbackActionModeInput
      const dispatchStrategy = fallbackDispatchStrategyInput
      const requiresHuman = actionModeRequiresHuman(actionMode)
      if (fallbackPoolEmpty && requiresHuman) {
        setDrawerNotice("当前接待池为空，只能配置“仅智能接待（ai_only）”兜底。")
        return
      }
      const useFullPool =
        !requiresHuman || dispatchStrategyRequiresSpecificUser(dispatchStrategy)
          ? actionMode === "ai_only"
          : fallbackUseFullPoolInput
      const humanUserIDs = mapSelectedUserIDsToPoolRaw(
        selectedFallbackUsersDeduped,
        fallbackPoolRawUsersByStableIdentity,
      )
      const humanDepartmentIDs = selectedFallbackDepartmentsDeduped
      if (
        dispatchStrategyRequiresSpecificUser(dispatchStrategy) &&
        (humanDepartmentIDs.length > 0 || humanUserIDs.length !== 1)
      ) {
        setDrawerNotice("当前分配策略需要明确指定 1 名人工成员，请只选择一名接待成员。")
        return
      }
      if (
        requiresHuman &&
        !useFullPool &&
        dispatchStrategySupportsHumanScope(dispatchStrategy) &&
        humanUserIDs.length === 0 &&
        humanDepartmentIDs.length === 0
      ) {
        setDrawerNotice("已关闭“使用整个接待池”，请至少选择一个接待对象，或切回“使用整个接待池”。")
        return
      }
      const result = await runCommand(
        {
          command: "configure_fallback_route",
          openKFID: channelID,
          payload: {
            action_mode: actionMode,
            dispatch_strategy: dispatchStrategy,
            dispatch_capacity_threshold:
              dispatchStrategy === "direct_if_available_else_queue"
                ? Number(fallbackDispatchCapacityThresholdInput || DEFAULT_DIRECT_DISPATCH_THRESHOLD)
                : 0,
            use_full_pool: useFullPool,
            human_user_ids: !requiresHuman || useFullPool ? [] : humanUserIDs,
            human_department_ids: !requiresHuman || useFullPool ? [] : humanDepartmentIDs,
          },
        },
        { noticeScope: "drawer" },
      )
      if (!result?.success) {
        return
      }
      setIsDrawerOpen(false)
      return
    }

    const name = formName.trim()
    const scene = formScene.trim()
    if (!name) {
      setDrawerNotice("请输入规则名称")
      return
    }
    if (!channelID) {
      setDrawerNotice("请选择应用渠道")
      return
    }
    const actionMode = regularActionModeInput
    const dispatchStrategy = regularDispatchStrategyInput
    const aiToHumanKeywords = regularAIToHumanKeywordsInput.trim()
    const requiresHuman = actionModeRequiresHuman(actionMode)
    const useFullPool =
      !requiresHuman || dispatchStrategyRequiresSpecificUser(dispatchStrategy)
        ? actionMode === "ai_only"
        : regularUseFullPoolInput
    const humanUserIDs = mapSelectedUserIDsToPoolRaw(
      selectedRegularUsersDeduped,
      regularPoolRawUsersByStableIdentity,
    )
    const humanDepartmentIDs = selectedRegularDepartmentsDeduped
    if (requiresHuman && regularPoolEmpty) {
      setDrawerNotice("当前接待池为空，普通人工路由无法生效。请先配置接待池，或改为“仅 AI”。")
      return
    }
    if (
      dispatchStrategyRequiresSpecificUser(dispatchStrategy) &&
      (humanDepartmentIDs.length > 0 || humanUserIDs.length !== 1)
    ) {
      setDrawerNotice("当前分配策略需要明确指定 1 名人工成员，请只选择一名接待成员。")
      return
    }
    if (
      requiresHuman &&
      !useFullPool &&
      dispatchStrategySupportsHumanScope(dispatchStrategy) &&
      humanUserIDs.length === 0 &&
      humanDepartmentIDs.length === 0
    ) {
      setDrawerNotice("已关闭“使用整个接待池”，请至少选择一个接待对象，或切回“使用整个接待池”。")
      return
    }
    if (actionModeSupportsAIToHumanKeywords(actionMode) && !aiToHumanKeywords) {
      setDrawerNotice("请配置该路由的转人工关键词，命中后才会按当前策略转人工。")
      return
    }

    const payload = {
      name,
      channel_id: channelID,
      scene,
      scene_param_value: formSceneParamValue.trim(),
      scene_param_non_empty: formSceneParamNonEmpty,
      action_mode: actionMode,
      dispatch_strategy: dispatchStrategy,
      dispatch_capacity_threshold:
        dispatchStrategy === "direct_if_available_else_queue"
          ? Number(regularDispatchCapacityThresholdInput || DEFAULT_DIRECT_DISPATCH_THRESHOLD)
          : 0,
      use_full_pool: useFullPool,
      human_user_ids: requiresHuman && !useFullPool ? humanUserIDs : [],
      human_department_ids: requiresHuman && !useFullPool ? humanDepartmentIDs : [],
      ai_to_human_keywords: actionModeSupportsAIToHumanKeywords(actionMode) ? aiToHumanKeywords : "",
      priority: formPriority,
    }

    const command = selectedRule ? "update_rule" : "create_rule"
    const ruleID = selectedRule ? Number(selectedRule.id || 0) : 0
    const result = await runCommand(
      {
        command,
        ruleID,
        openKFID: channelID,
        payload,
      },
      { noticeScope: "drawer" },
    )
    if (!result?.success) {
      return
    }
    setIsDrawerOpen(false)
  }

  const filteredRules = view.rules

  const statsTotal = Number(view.totalHits || 0)
  const diagnosticItems = view.diagnostics?.items || []
  const diagnostics = view.diagnostics?.warnings || []
  const activeAdvancedFilterCount = [
    statusFilter !== "all",
    ruleTypeFilter !== "all",
    modeFilter !== "all",
    targetFilter !== "all",
    hitBucketFilter !== "all",
    responseBucketFilter !== "all",
    diagnosticsOnly,
  ].filter(Boolean).length

  const { primaryChannels, overflowChannels } = useMemo(() => {
    const channels = [...view.channelOptions]
    if (channels.length <= MAX_VISIBLE_CHANNEL_TABS) {
      return { primaryChannels: channels, overflowChannels: [] as typeof channels }
    }
    if (filterChannel === "all") {
      return {
        primaryChannels: channels.slice(0, MAX_VISIBLE_CHANNEL_TABS),
        overflowChannels: channels.slice(MAX_VISIBLE_CHANNEL_TABS),
      }
    }
    const selected = channels.find((item) => item.channelId === filterChannel)
    if (!selected) {
      return {
        primaryChannels: channels.slice(0, MAX_VISIBLE_CHANNEL_TABS),
        overflowChannels: channels.slice(MAX_VISIBLE_CHANNEL_TABS),
      }
    }
    const seed = channels.filter((item) => item.channelId !== filterChannel).slice(0, MAX_VISIBLE_CHANNEL_TABS - 1)
    const primary = [...seed, selected]
    const primarySet = new Set(primary.map((item) => item.channelId))
    return {
      primaryChannels: primary,
      overflowChannels: channels.filter((item) => !primarySet.has(item.channelId)),
    }
  }, [view.channelOptions, filterChannel])

  const resolveDiagnosticChannelID = (warning: string): string => {
    const text = (warning || "").trim()
    if (!text) return ""
    const direct = view.channelOptions.find((item) => text.includes(item.channelId))
    if (direct?.channelId) return direct.channelId
    const byLabel = view.channelOptions.find((item) => item.label && text.includes(item.label))
    if (byLabel?.channelId) return byLabel.channelId
    return ""
  }

  const resetAdvancedFilters = () => {
    setStatusFilter("all")
    setRuleTypeFilter("all")
    setModeFilter("all")
    setTargetFilter("all")
    setHitBucketFilter("all")
    setResponseBucketFilter("all")
    setDiagnosticsOnly(false)
  }

  useEffect(() => {
    if (requestedEditRuleID <= 0 || hasAutoOpenedEditRule || isLoading) return
    const matched = view.rules.find((item) => Number(item.id || 0) === requestedEditRuleID)
    if (!matched) return
    openEditDrawer(matched)
    setHasAutoOpenedEditRule(true)
  }, [requestedEditRuleID, hasAutoOpenedEditRule, isLoading, view.rules])

  return (
    <div className="flex h-full gap-6">
      {/* Left: Main Content */}
      <div className="flex-1 flex flex-col gap-6">
        <Card className="border-none shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
            <Tabs value={filterChannel} onValueChange={setFilterChannel}>
              <TabsList className="bg-white border border-gray-200 shadow-sm overflow-x-auto overflow-y-hidden whitespace-nowrap">
                <TabsTrigger value="all" className="data-[state=active]:bg-gray-100">
                  全部渠道
                </TabsTrigger>
                {primaryChannels.map((channel) => {
                  const id = (channel.channelId || "").trim()
                  if (!id) return null
                  return (
                    <TabsTrigger key={id} value={id} className="data-[state=active]:bg-gray-100">
                      {(channel.label || id).trim()}
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </Tabs>
            {overflowChannels.length > 0 ? (
              <select
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={overflowChannels.some((item) => item.channelId === filterChannel) ? filterChannel : ""}
                onChange={(event) => {
                  const value = event.target.value.trim()
                  if (!value) return
                  setFilterChannel(value)
                }}
              >
                <option value="">更多渠道</option>
                {overflowChannels.map((channel) => (
                  <option key={channel.channelId} value={channel.channelId}>
                    {channel.label}
                  </option>
                ))}
              </select>
            ) : null}
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreateDrawer}>
              + 新建路由规则
            </Button>
          </div>

          <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-white shrink-0">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索规则名称..."
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button
              variant="ghost"
              className="text-blue-600 hover:bg-blue-50 ml-auto"
              onClick={() => setIsAdvancedFilterOpen((prev) => !prev)}
            >
              <Filter className="h-4 w-4 mr-2" />
              更多筛选
              {activeAdvancedFilterCount > 0 ? ` (${activeAdvancedFilterCount})` : ""}
            </Button>
          </div>
          {isAdvancedFilterOpen ? (
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500">规则状态</label>
                  <select
                    className="w-full h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">全部状态</option>
                    <option value="active">仅启用</option>
                    <option value="inactive">仅停用</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500">规则类型</label>
                  <select
                    className="w-full h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={ruleTypeFilter}
                    onChange={(event) => setRuleTypeFilter(event.target.value)}
                  >
                    <option value="all">全部类型</option>
                    <option value="normal">普通规则</option>
                    <option value="default">仅兜底规则</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500">接待模式</label>
                  <select
                    className="w-full h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={modeFilter}
                    onChange={(event) => setModeFilter(event.target.value)}
                  >
                    <option value="all">全部模式</option>
                    {view.modeOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500">分配目标</label>
                  <select
                    className="w-full h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={targetFilter}
                    onChange={(event) => setTargetFilter(event.target.value)}
                  >
                    <option value="all">全部目标</option>
                    {view.targetOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {formatRoutingTargetLabel(item.target)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500">命中区间</label>
                  <select
                    className="w-full h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={hitBucketFilter}
                    onChange={(event) => setHitBucketFilter(event.target.value)}
                  >
                    <option value="all">全部命中</option>
                    <option value="none">0 次</option>
                    <option value="low">1-49 次</option>
                    <option value="medium">50-199 次</option>
                    <option value="high">200+ 次</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-gray-500">响应区间</label>
                  <select
                    className="w-full h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={responseBucketFilter}
                    onChange={(event) => setResponseBucketFilter(event.target.value)}
                  >
                    <option value="all">全部响应</option>
                    <option value="fast">快 (&lt;=10s)</option>
                    <option value="normal">中 (11-29s)</option>
                    <option value="slow">慢 (&gt;=30s)</option>
                  </select>
                </div>
                <div className="col-span-2 flex items-end justify-between">
                  <label className="flex items-center gap-2 text-xs text-gray-600 pb-1">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={diagnosticsOnly}
                      onChange={(event) => setDiagnosticsOnly(event.target.checked)}
                    />
                    仅显示有诊断建议的规则
                  </label>
                  <Button
                    variant="ghost"
                    className="h-8 px-3 text-xs text-gray-600 hover:bg-gray-100"
                    onClick={resetAdvancedFilters}
                  >
                    清空高级筛选
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {notice ? <div className="px-4 py-2 text-xs text-blue-600 border-b border-gray-100 bg-blue-50">{notice}</div> : null}

          <div className="flex-1 overflow-auto bg-white">
            <table className="w-full text-left text-sm text-gray-600 border-separate border-spacing-0">
              <thead className="sticky top-0 bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-200 z-10">
                <tr>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">优先级</th>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">规则名称</th>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">应用渠道</th>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">命中条件</th>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">动作模式</th>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">分配策略与范围</th>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">状态</th>
                  <th className="px-6 py-3 font-semibold text-right border-b border-gray-200">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={8}>
                      加载中...
                    </td>
                  </tr>
                ) : filteredRules.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={8}>
                      当前没有路由规则
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-400 w-8">
                            {rule.isDefault ? "固定" : rule.priority}
                          </span>
                          <div className="flex flex-col gap-0.5">
                            <button
                              className="text-gray-300 hover:text-blue-600 transition-colors disabled:opacity-40"
                              onClick={() =>
                                void runCommand({
                                  command: "move_priority_up",
                                  ruleID: Number(rule.id || 0),
                                })
                              }
                              disabled={isSubmitting || rule.isDefault}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              className="text-gray-300 hover:text-blue-600 transition-colors disabled:opacity-40"
                              onClick={() =>
                                void runCommand({
                                  command: "move_priority_down",
                                  ruleID: Number(rule.id || 0),
                                })
                              }
                              disabled={isSubmitting || rule.isDefault}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{rule.name}</span>
                          {rule.isDefault ? (
                            <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[10px] px-1.5 py-0">兜底</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">{rule.channel || rule.channelId || "未指定渠道"}</td>
                      <td className="px-6 py-4">
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px] text-gray-600 font-mono">{rule.scene}</code>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-[10px] font-medium border-gray-200 text-gray-600">
                            {rule.actionModeLabel || "仅 AI"}
                          </Badge>
                          {(rule.dispatchStrategyLabel || "").trim() ? (
                            <div className="text-[11px] text-gray-500">
                              {rule.dispatchStrategyLabel}
                              {rule.dispatchStrategy === "direct_if_available_else_queue" &&
                              Number(rule.dispatchCapacityThreshold || 0) > 0
                                ? ` · 阈值 ${Number(rule.dispatchCapacityThreshold)}`
                                : ""}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-700">{formatRoutingTargetLabel(rule.target)}</div>
                        {rule.actionMode !== "ai_only" && formatRoutingTargetDetail(rule.target) ? (
                          <div className="mt-1 text-[11px] text-gray-500">
                            {formatRoutingTargetDetail(rule.target)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${rule.status === "active" ? "bg-green-500" : "bg-gray-300"}`} />
                          <span className="text-xs">{rule.status === "active" ? "启用" : "停用"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                            onClick={() =>
                              void runCommand({
                                command: "toggle_rule",
                                ruleID: Number(rule.id || 0),
                                payload: {
                                  enabled: rule.status !== "active",
                                },
                              })
                            }
                            disabled={isSubmitting}
                          >
                            {rule.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                            onClick={() => openEditDrawer(rule)}
                            disabled={isSubmitting}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                            onClick={() => {
                              const confirmed = window.confirm("确认删除该路由规则？")
                              if (!confirmed) return
                              void runCommand({
                                command: "delete_rule",
                                ruleID: Number(rule.id || 0),
                              })
                            }}
                            disabled={isSubmitting}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Right: Stats Panel */}
      <div className="w-72 shrink-0 space-y-6">
        <Card className="p-4 border-none shadow-sm space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              规则运行统计
            </h3>
            <button onClick={() => setNotice("统计口径：基于路由规则运行统计物化数据。")}>
              <HelpCircle className="h-4 w-4 text-gray-300 cursor-pointer" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-600 font-medium">累计命中次数</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{statsTotal.toLocaleString("zh-CN")}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-[10px] text-gray-500">人工转接率</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{view.transferRate}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-[10px] text-gray-500">平均响应</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{view.avgResponseTime}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <p className="text-xs font-medium text-gray-500">命中分布 (Top 3 规则)</p>
              <div className="space-y-2">
                {view.distributions.length === 0 ? (
                  <div className="text-[11px] text-gray-500">暂无命中分布数据</div>
                ) : (
                  view.distributions.map((item) => (
                    <div key={`${item.ruleName}-${item.hits}`} className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600 truncate" title={item.ruleName}>
                          {item.ruleName}
                        </span>
                        <span className="font-medium">{item.percent}</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: item.percent.trim() || "0%" }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>

        {diagnosticItems.length > 0 || diagnostics.length > 0 ? (
          <Card className="p-4 border-none shadow-sm bg-orange-50 border-l-4 border-l-orange-400">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-orange-800">配置建议</h4>
                <p className="text-[11px] text-orange-700 mt-1 leading-relaxed">
                  {diagnosticItems[0]?.message || diagnostics[0] || "存在待处理的配置建议。"}
                </p>
                {(diagnosticItems[0]?.action || "resolve_diagnostic") === "resolve_diagnostic" ? (
                  <Button
                    variant="link"
                    className="text-orange-800 p-0 h-auto text-[11px] font-bold mt-2"
                    disabled={isSubmitting}
                    onClick={() => {
                      const firstItem = diagnosticItems[0]
                      const warning = firstItem?.message || diagnostics[0] || ""
                      const channelFromItem = (firstItem?.channelId || "").trim()
                      const resolvedChannelID =
                        filterChannel !== "all"
                          ? filterChannel
                          : channelFromItem || resolveDiagnosticChannelID(warning) || "all"
                      void runCommand({
                        command: "resolve_diagnostic",
                        payload: {
                          code: (firstItem?.code || "").trim(),
                          warning,
                          channel_id: resolvedChannelID,
                        },
                      })
                    }}
                  >
                    立即处理
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4 border-none shadow-sm bg-green-50 border-l-4 border-l-green-400">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-green-800">配置建议</h4>
                <p className="text-[11px] text-green-700 mt-1 leading-relaxed">当前路由配置健康，无需额外处理。</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* New/Edit Rule Drawer */}
      <Dialog
        isOpen={isDrawerOpen}
        onClose={() => {
          setDrawerNotice("")
          setIsDrawerOpen(false)
        }}
        title={selectedRule ? "编辑路由规则" : "新建路由规则"}
        className={isEditingDefaultRule ? "max-w-[1020px]" : "max-w-[1180px]"}
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => setIsDrawerOpen(false)}>
              取消
            </Button>
            <Button className="bg-blue-600" disabled={isSubmitting} onClick={() => void handleSaveRule()}>
              {isEditingDefaultRule ? "保存兜底规则" : "保存规则"}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {drawerNotice ? (
            <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              {drawerNotice}
            </div>
          ) : null}
          {isEditingDefaultRule ? (
            <>
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px]">1</span>
                  默认兜底规则
                </h4>
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700 space-y-2">
                  <div className="font-medium">当前正在编辑该渠道的默认兜底规则</div>
                  <div>渠道：{(selectedRule?.channel || selectedRule?.channelId || "-").trim()}</div>
                  <div>规则名：{(selectedRule?.name || "默认兜底规则").trim()}</div>
                  <div>说明：这里编辑的是 routing 默认兜底规则，渠道页展示的是同一份真相。</div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px]">2</span>
                  兜底动作
                </h4>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700">系统动作</label>
                  <select
                    className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={fallbackActionModeInput}
                    onChange={(event) => {
                      const nextMode = event.target.value as RoutingActionMode
                      const nextStrategy = defaultDispatchStrategyForActionMode(nextMode)
                      setFallbackActionModeInput(nextMode)
                      setFallbackDispatchStrategyInput(nextStrategy)
                      setFallbackDispatchCapacityThresholdInput(
                        nextStrategy === "direct_if_available_else_queue"
                          ? DEFAULT_DIRECT_DISPATCH_THRESHOLD
                          : 0,
                      )
                      if (nextMode === "ai_only" || dispatchStrategyRequiresSpecificUser(nextStrategy)) {
                        setFallbackUseFullPoolInput(true)
                      }
                    }}
                  >
                    {ACTION_MODE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-500">
                    {ACTION_MODE_OPTIONS.find((item) => item.value === fallbackActionModeInput)?.description}
                  </p>
                </div>
                {actionModeRequiresHuman(fallbackActionModeInput) ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700">分配策略</label>
                      <select
                        className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={fallbackDispatchStrategyInput}
                        onChange={(event) => {
                          const nextStrategy = event.target.value as RoutingDispatchStrategy
                          setFallbackDispatchStrategyInput(nextStrategy)
                          setFallbackDispatchCapacityThresholdInput(
                            nextStrategy === "direct_if_available_else_queue"
                              ? DEFAULT_DIRECT_DISPATCH_THRESHOLD
                              : 0,
                          )
                          if (dispatchStrategyRequiresSpecificUser(nextStrategy)) {
                            setFallbackUseFullPoolInput(false)
                          }
                        }}
                      >
                        {fallbackDispatchOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-gray-500">
                        {fallbackDispatchOptions.find((item) => item.value === fallbackDispatchStrategyInput)?.description}
                      </p>
                    </div>
                    {fallbackDispatchStrategyInput === "direct_if_available_else_queue" ? (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-700">直分容量阈值</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={fallbackDispatchCapacityThresholdInput}
                          onChange={(event) =>
                            setFallbackDispatchCapacityThresholdInput(Math.max(1, Number(event.target.value || DEFAULT_DIRECT_DISPATCH_THRESHOLD)))
                          }
                        />
                        <p className="text-[11px] text-gray-500">当某位客服当前接待中的买家数小于该阈值时，可直接分配；否则进入排队。</p>
                      </div>
                    ) : null}
                    {fallbackPoolEmpty ? (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                        当前接待池为空，只能使用“仅智能接待（ai_only）”兜底。
                      </div>
                    ) : null}
                    {dispatchStrategySupportsHumanScope(fallbackDispatchStrategyInput) ? (
                      <>
                        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <div className="text-xs font-medium text-gray-700">人工范围</div>
                          <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                            <input
                              type="radio"
                              name="routing-default-full-pool"
                              checked={fallbackUseFullPoolInput}
                              onChange={() => setFallbackUseFullPoolInput(true)}
                              disabled={fallbackPoolEmpty || dispatchStrategyRequiresSpecificUser(fallbackDispatchStrategyInput)}
                              className="mt-0.5 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>
                              <span className="block font-medium text-gray-900">
                                使用整个接待池（默认）
                              </span>
                              <span className="block text-xs text-gray-500">
                                系统会在当前渠道接待池范围内选择可承接人工的成员或部门。
                              </span>
                            </span>
                          </label>
                          <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                            <input
                              type="radio"
                              name="routing-default-full-pool"
                              checked={!fallbackUseFullPoolInput}
                              onChange={() => setFallbackUseFullPoolInput(false)}
                              disabled={fallbackPoolEmpty}
                              className="mt-0.5 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>
                              <span className="block font-medium text-gray-900">
                                自定义候选范围（接待池对象子集）
                              </span>
                              <span className="block text-xs text-gray-500">
                                仅从当前接待池中的显式对象缩小人工候选范围。
                              </span>
                            </span>
                          </label>
                        </div>
                        {!fallbackUseFullPoolInput ? (
                          <div className="space-y-2">
                            <div className="text-[11px] text-gray-500">
                              {dispatchStrategyRequiresSpecificUser(fallbackDispatchStrategyInput)
                                ? "请选择 1 名接待成员，作为直接指定人工。"
                                : "这里只显示当前接待池中的成员和部门。"}
                            </div>
                            <OrganizationDirectorySelect
                              label="接待池对象子集"
                              placeholder={
                                isOrgOptionsLoading ? "正在加载接待池对象..." : "从当前接待池对象中选择"
                              }
                              searchPlaceholder="搜索接待池中的成员 / 部门"
                              corpId={orgCorpID}
                              treeRoots={fallbackTreeRoots}
                              ungroupedUsers={fallbackUngroupedUserIDs}
                              memberMap={orgMemberMap}
                              departmentMap={orgDepartmentMap}
                              selectedItems={selectedFallbackTargetsDeduped}
                              onChange={setSelectedFallbackTargets}
                              emptyText="当前接待池中还没有可选对象，请先配置接待池"
                              disabled={isOrgOptionsLoading || fallbackPoolEmpty}
                              allowedUserIDs={currentPoolAllowedUserIDs}
                              allowedDepartmentIDs={currentPoolAllowedDepartmentIDs}
                            />
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : null}
                <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" />
                  保存后会直接更新该渠道的默认兜底规则，渠道页摘要会同步变化。
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px]">1</span>
                  基础信息
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700">
                      规则名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="如：VIP 客户优先路由"
                      value={formName}
                      onChange={(event) => setFormName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700">
                      应用渠道 <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formChannelID}
                      onChange={(event) => setFormChannelID(event.target.value)}
                    >
                      {view.channelOptions.map((channel) => {
                        const id = (channel.channelId || "").trim()
                        if (!id) return null
                        return (
                          <option key={id} value={id}>
                            {(channel.label || id).trim()}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px]">2</span>
                  匹配条件
                </h4>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700">Scene 精确匹配</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="留空表示不限制 scene"
                        value={formScene}
                        onChange={(event) => setFormScene(event.target.value)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        disabled={isSubmitting}
                        onClick={() =>
                          void runCommand(
                            {
                              command: "copy_channel_link",
                              openKFID: formChannelID,
                              payload: {
                                channel_id: formChannelID,
                                scene: formScene,
                              },
                            },
                            {
                              refresh: false,
                              copyMessage: true,
                              noticeScope: "drawer",
                            },
                          )
                        }
                      >
                        <Copy className="h-4 w-4 mr-2" /> 复制当前渠道链接
                      </Button>
                    </div>
                    <p className="text-[10px] text-gray-400 italic">提示：留空表示不限制 scene。</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700">scene_param 精确匹配（可选）</label>
                    <input
                      type="text"
                      className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="如：campaign_2026_spring"
                      value={formSceneParamValue}
                      onChange={(event) => setFormSceneParamValue(event.target.value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={formSceneParamNonEmpty}
                      onChange={(event) => setFormSceneParamNonEmpty(event.target.checked)}
                    />
                    要求 scene_param 非空
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px]">3</span>
                  执行动作
                </h4>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700">系统动作</label>
                  <select
                    className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={regularActionModeInput}
                    onChange={(event) => {
                      const nextMode = event.target.value as RoutingActionMode
                      const nextStrategy = defaultDispatchStrategyForActionMode(nextMode)
                      setRegularActionModeInput(nextMode)
                      setRegularDispatchStrategyInput(nextStrategy)
                      setRegularDispatchCapacityThresholdInput(
                        nextStrategy === "direct_if_available_else_queue"
                          ? DEFAULT_DIRECT_DISPATCH_THRESHOLD
                          : 0,
                      )
                      if (nextMode === "ai_only" || dispatchStrategyRequiresSpecificUser(nextStrategy)) {
                        setRegularUseFullPoolInput(true)
                      }
                    }}
                  >
                    {ACTION_MODE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-500">
                    {ACTION_MODE_OPTIONS.find((item) => item.value === regularActionModeInput)?.description}
                  </p>
                </div>
                {actionModeRequiresHuman(regularActionModeInput) ? (
                  <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    {actionModeSupportsAIToHumanKeywords(regularActionModeInput) ? (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-700">转人工关键词</label>
                        <textarea
                          className="min-h-[88px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="如：转人工，人工客服，退款，投诉"
                          value={regularAIToHumanKeywordsInput}
                          onChange={(event) => setRegularAIToHumanKeywordsInput(event.target.value)}
                        />
                        <p className="text-[11px] text-gray-500">
                          仅当前路由生效。会话先保持 AI 接待，后续消息命中这些关键词后，才按下面的人工策略执行转接。
                        </p>
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-700">分配策略</label>
                      <select
                        className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={regularDispatchStrategyInput}
                        onChange={(event) => {
                          const nextStrategy = event.target.value as RoutingDispatchStrategy
                          setRegularDispatchStrategyInput(nextStrategy)
                          setRegularDispatchCapacityThresholdInput(
                            nextStrategy === "direct_if_available_else_queue"
                              ? DEFAULT_DIRECT_DISPATCH_THRESHOLD
                              : 0,
                          )
                          if (dispatchStrategyRequiresSpecificUser(nextStrategy)) {
                            setRegularUseFullPoolInput(false)
                          }
                        }}
                      >
                        {regularDispatchOptions.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-gray-500">
                        {regularDispatchOptions.find((item) => item.value === regularDispatchStrategyInput)?.description}
                      </p>
                    </div>
                    {regularDispatchStrategyInput === "direct_if_available_else_queue" ? (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-700">直分容量阈值</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={regularDispatchCapacityThresholdInput}
                          onChange={(event) =>
                            setRegularDispatchCapacityThresholdInput(Math.max(1, Number(event.target.value || DEFAULT_DIRECT_DISPATCH_THRESHOLD)))
                          }
                        />
                        <p className="text-[11px] text-gray-500">当某位客服当前接待中的买家数小于该阈值时，可直接分配；否则进入排队。</p>
                      </div>
                    ) : null}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-gray-700">人工范围</div>
                      <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="routing-regular-full-pool"
                          checked={regularUseFullPoolInput}
                          onChange={() => setRegularUseFullPoolInput(true)}
                          disabled={regularPoolEmpty || dispatchStrategyRequiresSpecificUser(regularDispatchStrategyInput)}
                          className="mt-0.5 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          <span className="block font-medium text-gray-900">使用整个接待池</span>
                          <span className="block text-xs text-gray-500">运行时会基于当前接待池显式对象动态展开可接待成员。</span>
                        </span>
                      </label>
                      <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="routing-regular-full-pool"
                          checked={!regularUseFullPoolInput}
                          onChange={() => setRegularUseFullPoolInput(false)}
                          disabled={regularPoolEmpty}
                          className="mt-0.5 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          <span className="block font-medium text-gray-900">使用接待池对象子集</span>
                          <span className="block text-xs text-gray-500">普通规则与默认兜底规则共享同一套显式对象表达式和运行时展开逻辑。</span>
                        </span>
                      </label>
                    </div>
                    {!regularUseFullPoolInput ? (
                      <div className="space-y-2">
                        <div className="text-[11px] text-gray-500">
                          {dispatchStrategyRequiresSpecificUser(regularDispatchStrategyInput)
                            ? "请选择 1 名接待成员，作为直接指定人工。"
                            : "这里只显示当前接待池中的成员和部门。"}
                        </div>
                        <OrganizationDirectorySelect
                          label="接待池对象子集"
                          placeholder={isOrgOptionsLoading ? "正在加载接待池对象..." : "从当前接待池对象中选择"}
                          searchPlaceholder="搜索接待池中的成员 / 部门"
                          corpId={orgCorpID}
                          treeRoots={regularTreeRoots}
                          ungroupedUsers={regularUngroupedUserIDs}
                          memberMap={orgMemberMap}
                          departmentMap={orgDepartmentMap}
                          selectedItems={selectedRegularTargetsDeduped}
                          onChange={setSelectedRegularTargets}
                          emptyText="当前接待池中还没有可选对象，请先配置接待池"
                          disabled={isOrgOptionsLoading || regularPoolEmpty}
                          allowedUserIDs={currentRegularPoolAllowedUserIDs}
                          allowedDepartmentIDs={currentRegularPoolAllowedDepartmentIDs}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-700">优先级</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formPriority}
                    onChange={(event) => setFormPriority(Number(event.target.value || 1))}
                  />
                </div>
                <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" />
                  普通规则在这里维护；默认兜底规则请直接编辑现有“兜底”规则。命中后会在会话详情里明确显示命中的规则名、系统动作和分配策略。
                </div>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  )
}
