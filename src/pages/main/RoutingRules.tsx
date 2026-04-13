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
  totalHits7d: 0,
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

function fallbackModeLabel(mode?: string): string {
  switch ((mode || "").trim()) {
    case "ai_then_human":
      return "智能接待后转人工"
    case "ai_then_queue_then_human":
      return "智能接待后进入排队池再转人工"
    case "ai_only":
    default:
      return "仅智能接待"
  }
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

function regularActionLabel(actionSemantic?: string): string {
  switch ((actionSemantic || "").trim()) {
    case "send_to_pool":
      return "送入待接入池"
    case "assign_human":
      return "转给指定人工"
    case "queue_then_human":
      return "排队后待人工接入"
    default:
      return "仅 AI"
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
  const [fallbackModeInput, setFallbackModeInput] = useState("ai_only")
  const [fallbackUseFullPoolInput, setFallbackUseFullPoolInput] = useState(true)
  const [selectedFallbackTargets, setSelectedFallbackTargets] = useState<
    DirectorySelectionItem[]
  >([])
  const [regularActionSemanticInput, setRegularActionSemanticInput] = useState("ai_only")
  const [regularUseFullPoolInput, setRegularUseFullPoolInput] = useState(true)
  const [selectedRegularTargets, setSelectedRegularTargets] = useState<
    DirectorySelectionItem[]
  >([])
  const [formSceneParamValue, setFormSceneParamValue] = useState("")
  const [formSceneParamNonEmpty, setFormSceneParamNonEmpty] = useState(false)
  const [regularDetail, setRegularDetail] = useState<ReceptionChannelDetail | null>(null)
  const [regularPoolAssignments, setRegularPoolAssignments] = useState<KFServicerAssignment[]>([])

  const [formName, setFormName] = useState("")
  const [formChannelID, setFormChannelID] = useState("")
  const [formScene, setFormScene] = useState("ANY")
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
    setFallbackModeInput(
      (detail?.fallback_route?.mode || "ai_only").trim() || "ai_only",
    )
    setFallbackUseFullPoolInput(
      detail?.fallback_route?.use_full_pool ??
        detail?.fallback_route?.uses_default_pool ??
        (((detail?.fallback_route?.human_user_ids || []).length === 0 &&
          (detail?.fallback_route?.human_department_ids || []).length === 0)),
    )
    setSelectedFallbackTargets(
      normalizeSelectionItems([
        ...((detail?.fallback_route?.human_user_ids || []).map((userID) => ({
          type: "user" as const,
          id: stableIdentityByRaw.get(String(userID || "").trim()) || String(userID || "").trim(),
        }))),
        ...((detail?.fallback_route?.human_department_ids || []).map(
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
    setFormScene("ANY")
    setFormSceneParamValue("")
    setFormSceneParamNonEmpty(false)
    setRegularActionSemanticInput("ai_only")
    setRegularUseFullPoolInput(true)
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
      setFormScene("ANY")
      setFormSceneParamValue("")
      setFormSceneParamNonEmpty(false)
      setRegularActionSemanticInput("ai_only")
      setRegularUseFullPoolInput(true)
      setSelectedRegularTargets([])
    } else {
      const conditions = parseJSONRecord(rule.conditionsJson)
      const action = parseJSONRecord(rule.actionJson)
      setFormScene(firstSceneValueFromConditions(rule.conditionsJson) || "ANY")
      setFormSceneParamValue(String(conditions.scene_param_value || "").trim())
      setFormSceneParamNonEmpty(conditions.scene_param_non_empty === true)
      setRegularActionSemanticInput(String(action.action_semantic || "ai_only").trim() || "ai_only")
      setRegularUseFullPoolInput(action.use_full_pool === true)
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
      if (fallbackPoolEmpty && fallbackModeInput !== "ai_only") {
        setDrawerNotice("当前接待池为空，只能配置“仅智能接待（ai_only）”兜底。")
        return
      }
      const useFullPool =
        fallbackModeInput === "ai_only" ? true : fallbackUseFullPoolInput
      const humanUserIDs = mapSelectedUserIDsToPoolRaw(
        selectedFallbackUsersDeduped,
        fallbackPoolRawUsersByStableIdentity,
      )
      if (
        fallbackModeInput !== "ai_only" &&
        !useFullPool &&
        humanUserIDs.length === 0 &&
        selectedFallbackDepartmentsDeduped.length === 0
      ) {
        setDrawerNotice("已关闭“使用整个接待池”，请至少选择一个接待对象，或切回“使用整个接待池”。")
        return
      }
      const result = await runCommand(
        {
          command: "configure_fallback_route",
          openKFID: channelID,
          payload: {
            mode: fallbackModeInput,
            use_full_pool: useFullPool,
            human_target_type:
              fallbackModeInput === "ai_only" || useFullPool
                ? ""
                : selectedFallbackUsersDeduped.length > 0 &&
                    selectedFallbackDepartmentsDeduped.length > 0
                  ? "mixed"
                  : selectedFallbackDepartmentsDeduped.length > 0
                    ? "department"
                    : humanUserIDs.length > 0
                      ? "user"
                      : "",
            human_user_ids:
              fallbackModeInput === "ai_only" || useFullPool ? [] : humanUserIDs,
            human_department_ids:
              fallbackModeInput === "ai_only" || useFullPool
                ? []
                : selectedFallbackDepartmentsDeduped,
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
    const scene = formScene.trim() || "ANY"
    if (!name) {
      setDrawerNotice("请输入规则名称")
      return
    }
    if (!channelID) {
      setDrawerNotice("请选择应用渠道")
      return
    }
    const useFullPool =
      regularActionSemanticInput === "assign_human" || regularActionSemanticInput === "queue_then_human"
        ? regularUseFullPoolInput
        : false
    const humanUserIDs = mapSelectedUserIDsToPoolRaw(
      selectedRegularUsersDeduped,
      regularPoolRawUsersByStableIdentity,
    )
    if ((regularActionSemanticInput === "assign_human" || regularActionSemanticInput === "queue_then_human") && regularPoolEmpty) {
      setDrawerNotice("当前接待池为空，普通人工路由无法生效。请先配置接待池，或改为“仅 AI”。")
      return
    }
    if (
      (regularActionSemanticInput === "assign_human" || regularActionSemanticInput === "queue_then_human") &&
      !useFullPool &&
      humanUserIDs.length === 0 &&
      selectedRegularDepartmentsDeduped.length === 0
    ) {
      setDrawerNotice("已关闭“使用整个接待池”，请至少选择一个接待对象，或切回“使用整个接待池”。")
      return
    }

    const payload = {
      name,
      channel_id: channelID,
      scene,
      scene_param_value: formSceneParamValue.trim(),
      scene_param_non_empty: formSceneParamNonEmpty,
      action_semantic: regularActionSemanticInput,
      use_full_pool: useFullPool,
      human_user_ids:
        regularActionSemanticInput === "assign_human" || regularActionSemanticInput === "queue_then_human"
          ? humanUserIDs
          : [],
      human_department_ids:
        regularActionSemanticInput === "assign_human" || regularActionSemanticInput === "queue_then_human"
          ? selectedRegularDepartmentsDeduped
          : [],
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

  const statsTotal = Number(view.totalHits7d || 0)
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
                      <option key={item} value={item}>
                        {item}
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
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">动作</th>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">人工范围</th>
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
                        <Badge variant="outline" className="text-[10px] font-medium border-gray-200 text-gray-600">
                          {rule.mode}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700">{rule.target}</td>
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
            <button onClick={() => setNotice("统计口径：基于近 7 天 routing 执行日志聚合。")}>
              <HelpCircle className="h-4 w-4 text-gray-300 cursor-pointer" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-600 font-medium">今日总命中次数</p>
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
                    <div key={`${item.ruleName}-${item.hits7d}`} className="space-y-1">
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
        className={isEditingDefaultRule ? "max-w-[980px]" : "max-w-[600px]"}
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
                  <label className="text-xs font-medium text-gray-700">兜底模式</label>
                  <select
                    className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={fallbackModeInput}
                    onChange={(event) => {
                      const nextMode = event.target.value
                      setFallbackModeInput(nextMode)
                      if (nextMode === "ai_only") {
                        setFallbackUseFullPoolInput(true)
                      }
                    }}
                  >
                    <option value="ai_only">仅智能接待</option>
                    <option value="ai_then_human">智能接待后转人工</option>
                    <option value="ai_then_queue_then_human">智能接待后进入排队再转人工</option>
                  </select>
                  <p className="text-[11px] text-gray-500">
                    默认使用整个接待池；如有需要，可缩小为接待池对象子集。多选成员/部门表示人工候选范围，不表示唯一指派对象。
                  </p>
                </div>
                {fallbackModeInput !== "ai_only" ? (
                  <>
                    {fallbackPoolEmpty ? (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                        当前接待池为空，只能使用“仅智能接待（ai_only）”兜底。
                      </div>
                    ) : null}
                    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="text-xs font-medium text-gray-700">人工范围</div>
                      <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="routing-default-full-pool"
                          checked={fallbackUseFullPoolInput}
                          onChange={() => setFallbackUseFullPoolInput(true)}
                          disabled={fallbackPoolEmpty}
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
                          这里只显示当前接待池中的成员和部门。
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
                        placeholder="留空或 ANY 表示不限制 scene"
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
                    <p className="text-[10px] text-gray-400 italic">提示：留空或填写 ANY 表示不限制 scene。</p>
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
                  <label className="text-xs font-medium text-gray-700">动作类型</label>
                  <select
                    className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={regularActionSemanticInput}
                    onChange={(event) => {
                      const nextValue = event.target.value
                      setRegularActionSemanticInput(nextValue)
                      if (nextValue === "ai_only" || nextValue === "send_to_pool") {
                        setRegularUseFullPoolInput(true)
                        setSelectedRegularTargets([])
                      }
                    }}
                  >
                    <option value="ai_only">仅 AI</option>
                    <option value="send_to_pool">送入待接入池</option>
                    <option value="assign_human">转给指定人工</option>
                    <option value="queue_then_human">排队后待人工接入</option>
                  </select>
                </div>
                {regularActionSemanticInput === "assign_human" || regularActionSemanticInput === "queue_then_human" ? (
                  <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-gray-700">人工范围</div>
                      <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="routing-regular-full-pool"
                          checked={regularUseFullPoolInput}
                          onChange={() => setRegularUseFullPoolInput(true)}
                          disabled={regularPoolEmpty}
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
                        <div className="text-[11px] text-gray-500">这里只显示当前接待池中的成员和部门。</div>
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
                  普通规则在这里维护；默认兜底规则请直接编辑现有“兜底”规则。命中后会在会话详情里明确显示命中的规则名和动作。
                </div>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  )
}
