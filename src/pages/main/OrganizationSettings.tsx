import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { InlineFeedbackSlot, usePageFeedback } from "@/components/ui/PageFeedback"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs"
import {
  Settings, Users, Shield, CheckCircle2, RefreshCw,
  Plus, MessageSquare, User,
  AlertTriangle, Zap, ExternalLink, Loader2,
  Search, Trash2, KeyRound,
} from "lucide-react"
import { Switch } from "@/components/ui/Switch"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { APIRequestError, normalizeErrorMessage } from "@/services/http"
import {
  closeOrganizationSettingsDebugAccess,
  executeOrganizationSettingsCommand,
  getOrganizationSettingsDebugAccessStatus,
  getOrganizationSettingsDebugView,
  getOrganizationSettingsView,
  openOrganizationSettingsDebugAccess,
  type OrganizationSettingsDebugView,
  type OrganizationSettingsView,
} from "@/services/organizationSettingsService"
import {
  getMuYuAIConnectorStatus,
  refreshMuYuAIConnection,
  startMuYuAIOAuth,
  testMuYuAIConnection,
  type MuYuAIConnectorStatus,
} from "@/services/connectorService"
import { checkMainWebviewJSSDKRuntime } from "@/services/jssdkService"
import { WecomDirectoryOpenDataName } from "@/components/wecom/WecomDirectoryOpenDataName"
import muyuaiLogo from "@/assets/muyuai-logo.svg"

const ROLE_OPTIONS = [
  { key: "super_admin", label: "超级管理员" },
  { key: "admin", label: "销售主管" },
  { key: "staff", label: "一线销售" },
]

const BASE_SETTINGS_TABS = ["wecom", "org", "roles", "toolbar", "connectors"] as const
const DEBUG_SETTINGS_TAB = "debug" as const
const SETTINGS_TABS = [...BASE_SETTINGS_TABS, DEBUG_SETTINGS_TAB] as const
type SettingsTab = (typeof SETTINGS_TABS)[number]
type NoticeKind = "info" | "success" | "warning" | "error"
type NoticeScope = SettingsTab | "global"
type CapabilityCommand = "recheck_all_capabilities" | "recheck_org_scope" | "recheck_open_data" | "recheck_reception_channel" | "recheck_crm_bootstrap"

function resolveSettingsTab(searchParams: URLSearchParams, debugAccessEnabled: boolean): SettingsTab {
  const tab = searchParams.get("tab")
  if (tab === DEBUG_SETTINGS_TAB && !debugAccessEnabled) return "wecom"
  if (SETTINGS_TABS.includes(tab as SettingsTab)) return tab as SettingsTab
  if (searchParams.get("muyuai_connected") === "1") return "connectors"
  return "wecom"
}

function buildSettingsSearchParams(searchParams: URLSearchParams, tab: SettingsTab): URLSearchParams {
  const next = new URLSearchParams(searchParams)
  if (tab === "wecom") {
    next.delete("tab")
  } else {
    next.set("tab", tab)
  }
  next.delete("muyuai_connected")
  return next
}

const INTERNAL_PERMISSION_META: Record<string, { label: string; group: string }> = {
  "org.manage": { label: "组织与设置管理", group: "组织与平台设置" },
  "rbac.manage": { label: "角色与权限管理", group: "组织与平台设置" },
  "integration.view": { label: "查看企业微信集成", group: "企业微信集成" },
  "integration.check": { label: "执行集成检查", group: "企业微信集成" },
  "debug.manage": { label: "调试开关管理", group: "调试与运维" },
  "routing.manage": { label: "路由规则管理", group: "业务配置" },
  "reception.manage": { label: "接待渠道管理", group: "业务配置" },
  "task.manage": { label: "跟进任务管理", group: "业务操作" },
  "customer.manage": { label: "客户资料管理", group: "客户经营" },
  "customer.read": { label: "查看客户资料", group: "客户经营" },
  "sidebar.use": { label: "使用侧边栏工具", group: "工具栏" },
}

function renderInternalPermissionLabel(permission: string): string {
  const key = (permission || "").trim()
  return INTERNAL_PERMISSION_META[key]?.label || key
}

function resolveInternalPermissionGroup(permission: string): string {
  const key = (permission || "").trim()
  return INTERNAL_PERMISSION_META[key]?.group || "其它权限"
}

const CONNECTOR_CATALOG = [
  {
    key: "muyuai",
    name: "母语AI",
    title: "母语AI",
    description: "连接当前企业后，可逐步启用 RPA 执行、客户资料联动、店铺与商品数据协同能力。",
    capabilities: ["RPA 自动执行", "客户与商品数据联动", "连接状态可校验"],
  },
]

const PERMISSION_LABELS: Record<string, string> = {
  "contact:base:base": "通讯录基本信息只读",
  "contact:base:single_user": "通讯录单个信息只读",
  "contact:edit:all": "通讯录全部信息读写",
  "contact:sensitive:avatar": "头像",
  "contact:sensitive:qrcode": "二维码",
  "contact:sensitive:gender": "性别",
  "contact:sensitive:user_name": "姓名",
  "contact:sensitive:mobile": "手机号",
  "contact:sensitive:department_name": "部门名",
  "contact:sensitive:email": "邮箱",
  "contact:sensitive:position": "职务",
  "contact:sensitive:telephone": "座机",
  "contact:sensitive:address": "地址",
  "contact:sensitive:extattr": "拓展属性",
  "contact:sensitive:external_profile": "对外属性",
  "contact:sensitive:external_position": "对外职务",
  "contact:sensitive:biz_mail": "企业邮箱",
  "corp_arch:base:base": "组织架构信息",
  "corp_arch:member:direct_leader": "成员直属上级信息",
  "externalcontact:base:base": "客户基础信息（客户/客户群列表、昵称、备注、标签）",
  "externalcontact:contact:tag": "管理企业客户标签",
  "externalcontact:contact:group_msg": "群发消息给客户和客户群",
  "externalcontact:contact:welcome_msg": "给客户发送欢迎语",
  "externalcontact:contact:qrcode": "配置「联系我」二维码",
  "externalcontact:contact:transfer": "在职继承",
  "externalcontact:contact:resigned": "离职继承",
  "externalcontact:contact:stat": "获取成员联系客户的数据统计",
  "externalcontact:contact:product_album": "管理商品图册",
  "externalcontact:contact:intercept_rule": "管理敏感词",
  "externalcontact:groupchat:welcome_msg": "配置入群欢迎语素材",
  "externalcontact:groupchat:stat": "获取客户群的数据统计",
  "externalcontact:groupchat:resigned": "分配离职成员的客户群",
  "externalcontact:groupchat:transfer": "分配在职成员的客户群",
  "externalcontact:moment:list": "获取企业全部的发表记录",
  "externalcontact:moment:post": "发表到成员客户的朋友圈",
  "externalcontact:customer_acquisition:base": "获客助手基础能力（查询获客数/管理获客链接/获取客户列表）",
  "externalcontact:resident:manage": "居民联系能力（管理网格和事件）",
  "customerservice:base:base": "获取微信客服基础信息",
  "customerservice:chat:manage": "管理客服账号/接待人员/会话与消息",
  "customerservice:tool:upgrade": "配置「升级服务」",
  "customerservice:tool:stat": "获取客服数据统计",
  "externalpay:base:base": "获取可见范围成员收款记录",
  "calendar:base:base": "日程能力",
  "meeting:base:base": "会议能力",
  "living:base:base": "直播能力",
  "email:base:base": "邮件能力",
  "doc:base:base": "文档能力",
  "wedrive:base:base": "微盘能力",
  "approval:base:base": "审批能力",
  "checkin:app:base": "打卡能力",
  "hardware:base:base": "硬件设备基础数据",
  "hardware:checkin:checkin_data": "考勤打卡原始数据",
  "hardware:checkin:temperature_data": "温度检测原始数据",
  "hardware:checkin:accesscontrol_data": "门禁通行原始数据",
  "hardware:checkin:read_rule": "读取门禁规则",
  "hardware:checkin:edit_rule": "创建门禁规则",
  "hardware:printer:print": "发起文件打印",
  "school:base:base": "家校通讯录与家长基本信息",
  "school:edit:all": "家校沟通编辑能力",
  "school:sensitive:mobile": "家长手机号",
  "emergency:base:push": "紧急应用通知（语音提醒）",
  "patrol:report:base": "巡查上报数据",
  "resident:report:base": "居民上报数据",
  "datazone:data:chat": "企业会话内容数据",
  "datazone:data:knowledge_base": "企业知识集数据",
  "datazone:component:chat": "会话展示组件",
  "customer_acquisition:interface:query_quota": "获客助手额度管理与使用统计",
  "customer_acquisition:interface:link": "获客链接管理",
  "customer_acquisition:data:customer": "获客客户添加流水",
  "customer_acquisition:data:chat": "客户发消息次数",
  "datazone:data:hit_keyword": "会话关键词命中结果",
  "datazone:data:chat_search": "会话搜索结果",
  "datazone:data:sentiment_analysis": "会话情感分析结果",
  "datazone:data:customer_tag": "客户标签",
  "datazone:data:chat_summary": "会话摘要",
  "datazone:data:recommend_dialog": "推荐话术",
  "datazone:data:customized_data": "自定义数据权限",
}

const PERMISSION_CATEGORY_BY_PREFIX: Array<{ prefix: string; category: string; group: string }> = [
  { prefix: "contact:", category: "通讯录权限", group: "通讯录与成员信息" },
  { prefix: "corp_arch:", category: "组织架构权限", group: "组织架构信息" },
  { prefix: "externalcontact:", category: "企业客户权限", group: "客户与客户群" },
  { prefix: "customerservice:", category: "微信客服", group: "客服能力" },
  { prefix: "externalpay:", category: "对外收款", group: "收款能力" },
  { prefix: "calendar:", category: "办公", group: "办公协同" },
  { prefix: "meeting:", category: "办公", group: "办公协同" },
  { prefix: "living:", category: "办公", group: "办公协同" },
  { prefix: "email:", category: "办公", group: "办公协同" },
  { prefix: "doc:", category: "办公", group: "办公协同" },
  { prefix: "wedrive:", category: "办公", group: "办公协同" },
  { prefix: "approval:", category: "办公", group: "办公协同" },
  { prefix: "checkin:", category: "打卡", group: "打卡能力" },
  { prefix: "hardware:", category: "智慧硬件", group: "硬件设备能力" },
  { prefix: "school:", category: "家校沟通", group: "家校能力" },
  { prefix: "emergency:", category: "紧急应用通知", group: "紧急通知能力" },
  { prefix: "patrol:", category: "政民沟通", group: "政民沟通能力" },
  { prefix: "resident:", category: "政民沟通", group: "政民沟通能力" },
  { prefix: "datazone:", category: "数据专区权限", group: "数据专区能力" },
  { prefix: "customer_acquisition:", category: "外部服务应用获客助手权限", group: "获客助手能力" },
]

function renderPermissionDisplay(code: string): string {
  const normalized = (code || "").trim()
  if (!normalized) return "-"
  const label = (PERMISSION_LABELS[normalized] || "").trim()
  if (!label) return normalized
  return `${label}（${normalized}）`
}

function resolvePermissionCategoryGroup(code: string): { category: string; group: string } {
  const normalized = (code || "").trim()
  for (const item of PERMISSION_CATEGORY_BY_PREFIX) {
    if (normalized.startsWith(item.prefix)) {
      return { category: item.category, group: item.group }
    }
  }
  return { category: "其它权限", group: "未分类" }
}

function isPermissionGranted(status: string): boolean {
  return (status || "").trim() === "granted"
}

function isObjectPassed(status: string): boolean {
  return (status || "").trim() === "ok"
}

function capabilityStatusLabel(status: string): string {
  switch ((status || "").trim()) {
    case "ready":
      return "已就绪"
    case "probing":
      return "检查中"
    case "blocked":
      return "待处理"
    case "degraded":
      return "部分可用"
    case "error":
      return "异常"
    case "queued":
      return "已排队"
    case "running":
      return "执行中"
    case "idle":
      return "未触发"
    default:
      return "未知"
  }
}

function capabilityBadgeClass(status: string): string {
  switch ((status || "").trim()) {
    case "ready":
      return "bg-green-100 text-green-700 border-none"
    case "probing":
    case "queued":
    case "running":
      return "bg-blue-100 text-blue-700 border-none"
    case "blocked":
      return "bg-orange-100 text-orange-700 border-none"
    case "degraded":
      return "bg-amber-100 text-amber-700 border-none"
    case "error":
      return "bg-red-100 text-red-700 border-none"
    default:
      return "bg-gray-100 text-gray-700 border-none"
  }
}

function capabilityReasonLabel(reason: string): string {
  const normalized = (reason || "").trim()
  if (!normalized) return ""
  const mapping: Record<string, string> = {
    authorization_not_found: "企业安装授权不存在",
    authorization_revoked: "企业安装授权已撤销",
    pending_contact_scope_confirmation: "等待企业管理员确认通讯录权限",
    authorized_scope_empty: "当前授权范围为空",
    tag_scope_not_expanded: "当前仅授权标签范围，尚未展开成员",
    partial_department_permission_denied: "部分部门仍未取得可读权限",
    pending_data_zone_setup: "数据专区尚未完成初始化",
    data_zone_not_authorized: "数据专区权限尚未开通",
    chatdata_no_auth_members: "会话存档尚未授权成员",
    chatdata_public_key_missing: "数据专区公钥尚未配置",
    chatdata_receive_callback_missing: "回调接收程序尚未配置",
    chatarchive_not_enabled: "会话存档能力尚未启用",
    kf_account_not_available: "客服账号暂不可用",
    no_active_reception_channel: "当前没有可用接待渠道",
    waiting_install_ready: "等待安装授权就绪",
    waiting_org_scope_ready: "等待通讯录能力就绪",
    waiting_open_data_ready: "等待数据专区能力就绪",
    waiting_effective_visibility: "等待稳定的有效可见范围",
  }
  return mapping[normalized] || normalized
}

function renderIntegrationAuthorizationStatus(status: string): string {
  switch ((status || "").trim()) {
    case "authorized":
      return "已完成安装授权"
    case "revoked":
      return "授权已失效"
    case "unauthorized":
      return "未完成授权"
    case "expired":
      return "授权已过期"
    default:
      return "待检查"
  }
}

function renderCRMScopeSummary(scope: string): string {
  switch ((scope || "").trim()) {
    case "all":
      return "当前覆盖全部已授权范围"
    case "incremental":
      return "当前按增量范围推进"
    case "selected":
      return "当前覆盖指定范围"
    default:
      return "当前按已授权范围推进"
  }
}

export default function OrganizationSettings() {
  const { showFeedback, clearFeedback } = usePageFeedback()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<OrganizationSettingsView | null>(null)
  const [debugView, setDebugView] = useState<OrganizationSettingsDebugView | null>(null)
  const [debugAccessEnabled, setDebugAccessEnabled] = useState(false)
  const [debugAccessExpiresAt, setDebugAccessExpiresAt] = useState(0)
  const [isDebugAccessDialogOpen, setIsDebugAccessDialogOpen] = useState(false)
  const [isOpeningDebugAccess, setIsOpeningDebugAccess] = useState(false)
  const [isClosingDebugAccess, setIsClosingDebugAccess] = useState(false)
  const [debugAccessSecret, setDebugAccessSecret] = useState("")
  const [debugAccessError, setDebugAccessError] = useState("")
  const [isLoadingDebugView, setIsLoadingDebugView] = useState(false)
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>(() => resolveSettingsTab(searchParams, false))
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isRunningCheck, setIsRunningCheck] = useState(false)
  const [memberRoleDraft, setMemberRoleDraft] = useState<Record<string, string>>({})
  const [savingMemberUserID, setSavingMemberUserID] = useState("")
  const [connectorStatuses, setConnectorStatuses] = useState<Record<string, MuYuAIConnectorStatus | null>>({})
  const [isLoadingConnectors, setIsLoadingConnectors] = useState(false)
  const [testingConnectorKey, setTestingConnectorKey] = useState("")
  const [refreshingConnectorKey, setRefreshingConnectorKey] = useState("")
  const [connectingConnectorKey, setConnectingConnectorKey] = useState("")
  const [capabilityCommandRunning, setCapabilityCommandRunning] = useState<CapabilityCommand | "">("")

  const [isRoleEditorOpen, setIsRoleEditorOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<NonNullable<OrganizationSettingsView["roles"]>[number] | null>(null)
  const [editingRoleName, setEditingRoleName] = useState("")
  const [editingRoleDescription, setEditingRoleDescription] = useState("")
  const [editingPermissions, setEditingPermissions] = useState<string[]>([])
  const [permissionSearch, setPermissionSearch] = useState("")
  const [roleEditorError, setRoleEditorError] = useState("")
  const [isSavingRole, setIsSavingRole] = useState(false)
  const [isDeletingRole, setIsDeletingRole] = useState(false)
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false)
  const [createRoleName, setCreateRoleName] = useState("")
  const [createRoleDescription, setCreateRoleDescription] = useState("")
  const [createRoleTemplate, setCreateRoleTemplate] = useState("blank")
  const [createRoleError, setCreateRoleError] = useState("")
  const [isCreatingRole, setIsCreatingRole] = useState(false)
  const [updatingDebugKey, setUpdatingDebugKey] = useState("")
  const [isOpeningDataZoneDebugMode, setIsOpeningDataZoneDebugMode] = useState(false)
  const [isClosingDataZoneDebugMode, setIsClosingDataZoneDebugMode] = useState(false)
  const [dataZoneDebugToken, setDataZoneDebugToken] = useState("")
  const visibleSettingsTabs = debugAccessEnabled ? SETTINGS_TABS : BASE_SETTINGS_TABS

  useEffect(() => {
    const nextTab = resolveSettingsTab(searchParams, debugAccessEnabled)
    setActiveSettingsTab(nextTab)

    const canonicalSearchParams = buildSettingsSearchParams(searchParams, nextTab)
    if (canonicalSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(canonicalSearchParams, { replace: true })
    }
  }, [debugAccessEnabled, searchParams, setSearchParams])

  const showNotice = (_scope: NoticeScope, message: string, kind: NoticeKind = "info") => {
    const text = (message || "").trim()
    if (!text) return
    showFeedback({ message: text, kind })
  }

  const formatDateTime = (value?: string): string => {
    const text = (value || "").trim()
    if (!text) return "-"
    const parsed = Date.parse(text)
    if (Number.isNaN(parsed)) return text
    return new Date(parsed).toLocaleString("zh-CN", { hour12: false })
  }

  const formatUnix = (value?: number): string => {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "-"
    const millis = value > 1_000_000_000_000 ? value : value * 1000
    return new Date(millis).toLocaleString("zh-CN", { hour12: false })
  }

  const resolveDataZoneStatus = (kind: "permission" | "scope" | "key" | "callback", value?: string): { label: string; tone: "green" | "orange" | "red" | "gray" } => {
    const status = (value || "").trim()
    if (kind === "permission") {
      if (status === "authorized") return { label: "已授权", tone: "green" }
      if (status === "not_authorized") return { label: "未授权", tone: "red" }
      if (status === "authorization_error") return { label: "授权异常", tone: "orange" }
      return { label: "待检查", tone: "gray" }
    }
    if (kind === "scope") {
      if (status === "enabled") return { label: "已开启", tone: "green" }
      if (status === "no_auth_members") return { label: "无授权成员", tone: "orange" }
      if (status === "error") return { label: "检查异常", tone: "orange" }
      return { label: "未开启", tone: "red" }
    }
    if (status === "configured") return { label: kind === "callback" ? "已设置" : "已配置", tone: "green" }
    if (status === "pending") return { label: "配置中", tone: "orange" }
    if (status === "failed") return { label: "配置失败", tone: "red" }
    if (status === "rotation_required") return { label: "需轮换", tone: "orange" }
    return { label: "未配置", tone: "red" }
  }

  const resolveDataZoneDebugModeStatus = (value?: number): { label: string; tone: "green" | "orange" | "gray" } => {
    if (value === 2) return { label: "已开启", tone: "green" }
    if (value === 1) return { label: "已关闭", tone: "gray" }
    return { label: "待检查", tone: "orange" }
  }

  const readUnixSeconds = (value?: number): number => {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0
    return value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value)
  }

  const dataZoneBadgeClass = (tone: "green" | "orange" | "red" | "gray"): string => {
    switch (tone) {
      case "green":
        return "bg-green-100 text-green-700 border-none"
      case "orange":
        return "bg-orange-100 text-orange-700 border-none"
      case "red":
        return "bg-red-100 text-red-700 border-none"
      default:
        return "bg-gray-100 text-gray-600 border-none"
    }
  }

  const chatDataEditionLabel = (edition?: number): string => {
    switch (Number(edition || 0)) {
      case 1:
        return "内部会话"
      case 2:
        return "内外部会话"
      case 3:
        return "内外部会话及语音通话"
      default:
        return "未知版本"
    }
  }

  const chatDataEditionStatus = (status?: number): { label: string; tone: "green" | "orange" | "red" | "gray" } => {
    switch (Number(status || 0)) {
      case 1:
        return { label: "试用中", tone: "green" }
      case 2:
        return { label: "试用已到期", tone: "red" }
      case 3:
        return { label: "付费使用中", tone: "green" }
      case 4:
        return { label: "付费使用已到期", tone: "red" }
      case 5:
        return { label: "免费使用中", tone: "green" }
      case 6:
        return { label: "免费使用已到期", tone: "red" }
      case 7:
        return { label: "付费待生效", tone: "orange" }
      default:
        return { label: "未知状态", tone: "gray" }
    }
  }

  const formatChatDataEditionList = (items?: number[]): string => {
    const labels = (items || [])
      .map((item) => chatDataEditionLabel(item))
      .filter((item, index, list) => item !== "未知版本" && list.indexOf(item) === index)
    return labels.length > 0 ? labels.join("、") : "-"
  }

  const formatChatDataScopeSummary = (
    scope?: NonNullable<NonNullable<OrganizationSettingsView["data_zone"]>["auth_editions"]>[number]["auth_scope"],
  ): string => {
    const userCount = Number(scope?.userid_list?.length || 0)
    const departmentCount = Number(scope?.department_id_list?.length || 0)
    const tagCount = Number(scope?.tag_id_list?.length || 0)
    return `成员 ${userCount} / 部门 ${departmentCount} / 标签 ${tagCount}`
  }

  const buildMemberRoleDraft = (data: OrganizationSettingsView | null | undefined): Record<string, string> => {
    const nextDraft: Record<string, string> = {}
    ;(data?.members || []).forEach((member) => {
      const userID = (member.userid || "").trim()
      if (!userID) return
      if (member.is_app_admin) {
        nextDraft[userID] = "super_admin"
        return
      }
      nextDraft[userID] = ((member.role || "staff").trim() || "staff")
    })
    return nextDraft
  }

  const hasDirtyMemberRoleDraft = () => {
    return (view?.members || []).some((member) => {
      const userID = (member.userid || "").trim()
      if (!userID || member.is_app_admin) return false
      const persistedRole = ((member.role || "staff").trim() || "staff")
      const draftRole = (memberRoleDraft[userID] || persistedRole).trim() || "staff"
      return draftRole !== persistedRole
    })
  }

  const loadView = async (options: { preserveMemberDraft?: boolean; savedUserID?: string } = {}) => {
    try {
      setIsLoading(true)
      const data = await getOrganizationSettingsView()
      setView(data || null)
      const nextDraft = buildMemberRoleDraft(data)
      if (options.preserveMemberDraft) {
        setMemberRoleDraft((prev) => {
          const merged = { ...nextDraft }
          Object.keys(prev).forEach((userID) => {
            if (userID !== options.savedUserID && Object.prototype.hasOwnProperty.call(merged, userID)) {
              merged[userID] = prev[userID]
            }
          })
          return merged
        })
      } else {
        setMemberRoleDraft(nextDraft)
      }
    } catch (error) {
      showNotice("global", normalizeErrorMessage(error), "error")
    } finally {
      setIsLoading(false)
      setHasLoaded(true)
    }
  }

  const loadConnectors = async () => {
    try {
      setIsLoadingConnectors(true)
      const muyuai = await getMuYuAIConnectorStatus()
      setConnectorStatuses((prev) => ({ ...prev, muyuai }))
    } catch (error) {
      showFeedback({ message: normalizeErrorMessage(error), kind: "error" })
      setConnectorStatuses((prev) => ({
        ...prev,
        muyuai: {
          key: "muyuai",
          name: "母语AI",
          status: "unavailable",
          connected: false,
          corp_id: "",
        },
      }))
    } finally {
      setIsLoadingConnectors(false)
    }
  }

  const loadDebugView = async () => {
    try {
      setIsLoadingDebugView(true)
      const data = await getOrganizationSettingsDebugView()
      setDebugView(data || null)
    } catch (error) {
      if (error instanceof APIRequestError && error.status === 403) {
        setDebugAccessEnabled(false)
        setDebugAccessExpiresAt(0)
        setDebugView(null)
        if (activeSettingsTab === "debug") {
          setActiveSettingsTab("wecom")
          setSearchParams(buildSettingsSearchParams(searchParams, "wecom"), { replace: true })
        }
        showFeedback({ message: "调试访问已失效，请重新通过隐藏入口进入。", kind: "warning" })
        return
      }
      showFeedback({ message: normalizeErrorMessage(error), kind: "error" })
    } finally {
      setIsLoadingDebugView(false)
    }
  }

  const loadDebugAccessStatus = async (options: { loadDebugView?: boolean } = {}) => {
    try {
      const status = await getOrganizationSettingsDebugAccessStatus()
      const enabled = status.enabled === true
      setDebugAccessEnabled(enabled)
      setDebugAccessExpiresAt(Number(status.expires_at || 0))
      if (!enabled) {
        setDebugView(null)
        return
      }
      if (options.loadDebugView !== false) {
        await loadDebugView()
      }
    } catch (error) {
      setDebugAccessEnabled(false)
      setDebugAccessExpiresAt(0)
      setDebugView(null)
      showFeedback({ message: normalizeErrorMessage(error), kind: "error" })
    }
  }

  useEffect(() => {
    void loadView()
    void loadConnectors()
    void loadDebugAccessStatus()
  }, [])

  useEffect(() => {
    const handleHiddenDebugEntry = () => {
      clearFeedback()
      setDebugAccessError("")
      setDebugAccessSecret("")
      if (debugAccessEnabled) {
        setActiveSettingsTab("debug")
        setSearchParams(buildSettingsSearchParams(searchParams, "debug"), { replace: true })
        if (!debugView) {
          void loadDebugView()
        }
        return
      }
      setIsDebugAccessDialogOpen(true)
    }
    window.addEventListener("callfay:organization-settings-debug-entry", handleHiddenDebugEntry)
    return () => {
      window.removeEventListener("callfay:organization-settings-debug-entry", handleHiddenDebugEntry)
    }
  }, [clearFeedback, debugAccessEnabled, debugView, searchParams, setSearchParams])

  const runIntegrationCheck = async () => {
    try {
      setIsRunningCheck(true)
      const jssdkRuntime = await checkMainWebviewJSSDKRuntime()
      const payload = JSON.stringify({
        jssdk_runtime: jssdkRuntime,
      })
      const message = await executeOrganizationSettingsCommand("run_integration_check", payload)
      showNotice("wecom", message || "已重新执行集成检查", "success")
      await loadView()
      if (debugAccessEnabled) {
        await loadDebugView()
      }
    } catch (error) {
      showNotice("wecom", normalizeErrorMessage(error), "error")
    } finally {
      setIsRunningCheck(false)
    }
  }

  const updateOrgSync = async (autoSyncEnabled: boolean, syncScope: string) => {
    try {
      const payload = JSON.stringify({
        auto_sync_enabled: autoSyncEnabled,
        sync_scope: syncScope,
      })
      const message = await executeOrganizationSettingsCommand("update_org_sync", payload)
      showNotice("org", message || "组织同步配置已更新", "success")
      await loadView()
    } catch (error) {
      showNotice("org", normalizeErrorMessage(error), "error")
    }
  }

  const recheckCapability = async (command: CapabilityCommand, scope: NoticeScope, successMessage: string) => {
    try {
      setCapabilityCommandRunning(command)
      const message = await executeOrganizationSettingsCommand(command)
      showNotice(scope, message || successMessage, "success")
      await loadView()
    } catch (error) {
      showNotice(scope, normalizeErrorMessage(error), "error")
    } finally {
      setCapabilityCommandRunning("")
    }
  }

  const openDataZoneDebugMode = async () => {
    const debugToken = dataZoneDebugToken.trim()
    if (!debugToken) {
      showNotice("debug", "请输入 debug_token", "warning")
      return
    }
    try {
      setIsOpeningDataZoneDebugMode(true)
      const message = await executeOrganizationSettingsCommand("open_data_zone_debug_mode", JSON.stringify({
        debug_token: debugToken,
      }))
      setDataZoneDebugToken("")
      showNotice("debug", message || "已开启数据专区调试模式", "success")
      await loadDebugView()
    } catch (error) {
      showNotice("debug", normalizeErrorMessage(error), "error")
    } finally {
      setIsOpeningDataZoneDebugMode(false)
    }
  }

  const closeDataZoneDebugMode = async () => {
    try {
      setIsClosingDataZoneDebugMode(true)
      const message = await executeOrganizationSettingsCommand("close_data_zone_debug_mode")
      setDataZoneDebugToken("")
      showNotice("debug", message || "已关闭数据专区调试模式", "success")
      await loadDebugView()
    } catch (error) {
      showNotice("debug", normalizeErrorMessage(error), "error")
    } finally {
      setIsClosingDataZoneDebugMode(false)
    }
  }

  const updateDebugSwitch = async (key: string, enabled: boolean) => {
    try {
      setUpdatingDebugKey(key)
      const message = await executeOrganizationSettingsCommand("update_debug_switch", JSON.stringify({ key, enabled }))
      showNotice("debug", message || "内部调试入口已更新", "success")
      await loadDebugView()
    } catch (error) {
      showNotice("debug", normalizeErrorMessage(error), "error")
    } finally {
      setUpdatingDebugKey("")
    }
  }

  const openDebugAccess = async () => {
    const secret = debugAccessSecret.trim()
    if (!secret) {
      setDebugAccessError("请输入平台调试访问密钥")
      return
    }
    try {
      setIsOpeningDebugAccess(true)
      setDebugAccessError("")
      const status = await openOrganizationSettingsDebugAccess(secret)
      setDebugAccessEnabled(true)
      setDebugAccessExpiresAt(Number(status.expires_at || 0))
      setDebugAccessSecret("")
      setIsDebugAccessDialogOpen(false)
      await loadDebugView()
      setActiveSettingsTab("debug")
      setSearchParams(buildSettingsSearchParams(searchParams, "debug"), { replace: true })
      showFeedback({ message: "已进入调试与开发。完成排查后请及时退出。", kind: "success" })
    } catch (error) {
      setDebugAccessError(normalizeErrorMessage(error))
    } finally {
      setIsOpeningDebugAccess(false)
    }
  }

  const closeDebugAccess = async () => {
    try {
      setIsClosingDebugAccess(true)
      await closeOrganizationSettingsDebugAccess()
      setDebugAccessEnabled(false)
      setDebugAccessExpiresAt(0)
      setDebugView(null)
      setDebugAccessSecret("")
      setDebugAccessError("")
      if (activeSettingsTab === "debug") {
        setActiveSettingsTab("wecom")
        setSearchParams(buildSettingsSearchParams(searchParams, "wecom"), { replace: true })
      }
      showFeedback({ message: "已退出调试与开发。", kind: "success" })
    } catch (error) {
      showFeedback({ message: normalizeErrorMessage(error), kind: "error" })
    } finally {
      setIsClosingDebugAccess(false)
    }
  }

  const startConnectorOAuth = async (key: string) => {
    if (key !== "muyuai") {
      showFeedback({ message: "该连接方式暂未开放", kind: "warning" })
      return
    }
    try {
      setConnectingConnectorKey(key)
      const returnURL = new URL(window.location.href)
      returnURL.searchParams.set("tab", "connectors")
      const start = await startMuYuAIOAuth(returnURL.toString())
      const authURL = (start.AuthorizeURL || start.authorize_url || start.authorization_url || "").trim()
      if (!authURL) {
        showFeedback({ message: "暂时无法发起连接，请稍后再试", kind: "error" })
        return
      }
      window.location.assign(authURL)
    } catch (error) {
      showFeedback({ message: normalizeErrorMessage(error), kind: "error" })
    } finally {
      setConnectingConnectorKey("")
    }
  }

  const refreshConnector = async (key: string) => {
    if (key !== "muyuai") {
      showFeedback({ message: "该连接方式暂不支持刷新", kind: "warning" })
      return
    }
    try {
      setRefreshingConnectorKey(key)
      await refreshMuYuAIConnection()
      showFeedback({ message: "连接状态已更新，当前企业的授权关系保持不变", kind: "success" })
      await loadConnectors()
    } catch (error) {
      showFeedback({ message: normalizeErrorMessage(error), kind: "error" })
    } finally {
      setRefreshingConnectorKey("")
    }
  }

  const testConnector = async (key: string) => {
    if (key !== "muyuai") {
      showFeedback({ message: "该连接方式暂不支持校验", kind: "warning" })
      return
    }
    try {
      setTestingConnectorKey(key)
      const result = await testMuYuAIConnection()
      const message = (result.Message || result.message || "").trim()
      showFeedback({ message: message || "连接校验通过，可以继续使用", kind: "success" })
      await loadConnectors()
    } catch (error) {
      showFeedback({ message: normalizeErrorMessage(error), kind: "error" })
    } finally {
      setTestingConnectorKey("")
    }
  }

  const saveMemberRole = async (userID: string) => {
    const nextRole = (memberRoleDraft[userID] || "").trim()
    if (!userID || !nextRole) {
      showNotice("roles", "请选择成员角色", "warning")
      return
    }
    const member = (view?.members || []).find((item) => (item.userid || "").trim() === userID)
    if (member?.is_app_admin) {
      showNotice("roles", "企微应用管理员角色由企业微信后台决定，平台内不可修改", "warning")
      return
    }
    try {
      setSavingMemberUserID(userID)
      const payload = JSON.stringify({ userid: userID, role: nextRole })
      const message = await executeOrganizationSettingsCommand("update_member_role", payload)
      showNotice("roles", message || "成员角色已更新", "success")
      await loadView({ preserveMemberDraft: true, savedUserID: userID })
    } catch (error) {
      showNotice("roles", normalizeErrorMessage(error), "error")
    } finally {
      setSavingMemberUserID("")
    }
  }

  const openRoleEditor = (role: NonNullable<OrganizationSettingsView["roles"]>[number]) => {
    if (role.system_preset) {
      showNotice("roles", "系统预设角色不可直接修改权限，请创建自定义角色后再配置。", "warning")
      return
    }
    setEditingRole(role)
    setEditingRoleName((role.role_name || role.role || "").trim())
    setEditingRoleDescription((role.description || "").trim())
    setEditingPermissions((role.permissions || []).map((item) => (item || "").trim()).filter(Boolean))
    setPermissionSearch("")
    setRoleEditorError("")
    setIsRoleEditorOpen(true)
  }

  const toggleEditingPermission = (permission: string) => {
    setEditingPermissions((prev) => {
      const key = permission.trim()
      if (!key) return prev
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key)
      }
      return [...prev, key]
    })
  }

  const saveRolePermissions = async () => {
    const role = (editingRole?.role || "").trim()
    if (!role) {
      setRoleEditorError("当前角色不可用")
      return
    }
    if (editingRole?.system_preset) {
      setRoleEditorError("系统预设角色不可直接修改权限，请创建自定义角色后再配置。")
      return
    }
    const roleName = editingRoleName.trim()
    if (!roleName) {
      setRoleEditorError("请输入角色名称")
      return
    }
    const duplicatedName = (view?.roles || []).some((item) => {
      if ((item.role || "").trim() === role) return false
      return (item.role_name || item.role || "").trim() === roleName
    })
    if (duplicatedName) {
      setRoleEditorError("角色名称已存在，请换一个名称")
      return
    }
    try {
      setIsSavingRole(true)
      const profilePayload = JSON.stringify({
        role,
        role_name: roleName,
        description: editingRoleDescription.trim(),
      })
      await executeOrganizationSettingsCommand("update_role_profile", profilePayload)
      const permissionPayload = JSON.stringify({
        role,
        permissions: editingPermissions,
      })
      const message = await executeOrganizationSettingsCommand("update_role_permissions", permissionPayload)
      showNotice("roles", message || "角色权限已更新", "success")
      setIsRoleEditorOpen(false)
      setEditingRole(null)
      setEditingRoleName("")
      setEditingRoleDescription("")
      setEditingPermissions([])
      setPermissionSearch("")
      setRoleEditorError("")
      await loadView()
    } catch (error) {
      setRoleEditorError(normalizeErrorMessage(error))
    } finally {
      setIsSavingRole(false)
    }
  }

  const deleteEditingRole = async () => {
    const currentEditingRole = editingRole
    if (!currentEditingRole) {
      setRoleEditorError("当前角色不可删除")
      return
    }
    const role = (currentEditingRole.role || "").trim()
    if (!role || currentEditingRole.system_preset) {
      setRoleEditorError("当前角色不可删除")
      return
    }
    if (Number(currentEditingRole.member_count || 0) > 0) {
      setRoleEditorError("该角色仍有成员绑定，请先调整成员角色后再删除")
      return
    }
    if (!window.confirm(`确定删除角色“${(currentEditingRole.role_name || role).trim()}”吗？`)) return
    try {
      setIsDeletingRole(true)
      const message = await executeOrganizationSettingsCommand("delete_role", JSON.stringify({ role }))
      showNotice("roles", message || "角色已删除", "success")
      setIsRoleEditorOpen(false)
      setEditingRole(null)
      setEditingRoleName("")
      setEditingRoleDescription("")
      setEditingPermissions([])
      setPermissionSearch("")
      setRoleEditorError("")
      await loadView()
    } catch (error) {
      setRoleEditorError(normalizeErrorMessage(error))
    } finally {
      setIsDeletingRole(false)
    }
  }

  const openCreateRoleDialog = () => {
    setCreateRoleName("")
    setCreateRoleDescription("")
    setCreateRoleTemplate("blank")
    setCreateRoleError("")
    setIsCreateRoleOpen(true)
    clearFeedback()
  }

  const closeCreateRoleDialog = () => {
    if (isCreatingRole) return
    setIsCreateRoleOpen(false)
    setCreateRoleName("")
    setCreateRoleDescription("")
    setCreateRoleTemplate("blank")
    setCreateRoleError("")
  }

  const closeDebugAccessDialog = () => {
    if (isOpeningDebugAccess) return
    setIsDebugAccessDialogOpen(false)
    setDebugAccessSecret("")
    setDebugAccessError("")
  }

  const closeRoleEditor = () => {
    if (isSavingRole || isDeletingRole) return
    setIsRoleEditorOpen(false)
    setEditingRole(null)
    setEditingRoleName("")
    setEditingRoleDescription("")
    setEditingPermissions([])
    setPermissionSearch("")
    setRoleEditorError("")
  }

  const submitCreateRole = async () => {
    const roleName = createRoleName.trim()
    if (!roleName) {
      setCreateRoleError("请输入角色名称")
      return
    }
    const duplicateName = (view?.roles || []).some((role) => (role.role_name || role.role || "").trim() === roleName)
    if (duplicateName) {
      setCreateRoleError("角色名称已存在，请换一个名称")
      return
    }
    const templateRole = (view?.roles || []).find((role) => (role.role || "").trim() === createRoleTemplate)
    const permissions = templateRole ? (templateRole.permissions || []) : []
    try {
      setIsCreatingRole(true)
      const payload = JSON.stringify({
        role_name: roleName,
        description: createRoleDescription.trim(),
        permissions,
      })
      const message = await executeOrganizationSettingsCommand("create_role", payload)
      showNotice("roles", message || "角色已创建", "success")
      setIsCreateRoleOpen(false)
      await loadView()
    } catch (error) {
      setCreateRoleError(normalizeErrorMessage(error))
    } finally {
      setIsCreatingRole(false)
    }
  }

  const handleSettingsTabChange = (value: string) => {
    if (!(visibleSettingsTabs as readonly string[]).includes(value)) return
    const nextTab = value as SettingsTab
    if (activeSettingsTab === "roles" && nextTab !== "roles" && hasDirtyMemberRoleDraft()) {
      if (!window.confirm("成员角色还有未保存的修改，切换后将丢弃这些草稿。确定继续吗？")) return
      setMemberRoleDraft(buildMemberRoleDraft(view))
    }
    if (nextTab === "debug" && !debugAccessEnabled) return
    setActiveSettingsTab(nextTab)
    clearFeedback()
    setSearchParams(buildSettingsSearchParams(searchParams, nextTab), { replace: true })
    if (nextTab === "debug" && !debugView) {
      void loadDebugView()
    }
  }

  const integration = view?.integration
  const dataZone = view?.data_zone
  const debugDataZone = debugView?.data_zone
  const dataZoneAuthEditions = dataZone?.auth_editions || []
  const dataZoneAuthUserPreview = dataZone?.auth_user_preview || []
  const memberOpenUserIDMap = useMemo(() => {
    const next = new Map<string, string>()
    ;(view?.members || []).forEach((member) => {
      const userID = (member.userid || "").trim()
      const openUserID = (member.open_userid || "").trim()
      if (!userID || !openUserID) return
      next.set(userID, openUserID)
    })
    return next
  }, [view?.members])
  const orgSync = view?.org_sync
  const appVisibility = view?.app_visibility
  const corpCapabilityState = view?.corp_capability_state
  const installCapability = corpCapabilityState?.install
  const orgScopeCapability = corpCapabilityState?.org_scope
  const openDataCapability = corpCapabilityState?.open_data
  const receptionChannelCapability = corpCapabilityState?.reception_channel
  const crmBootstrapCapability = corpCapabilityState?.crm_bootstrap
  const integrationAdmins = debugView?.integration_admins || []
  const integrationPermissions = debugView?.integration_permissions || []
  const integrationLicenseSummary = debugView?.integration_license_summary
  const integrationLicenseAccounts = debugView?.integration_license_accounts || []
  const permissionChecks = debugView?.permission_checks || []
  const objectChecks = debugView?.object_checks || []
  const dataZoneDebugMode = debugView?.data_zone_debug_mode
  const dataZoneDebugStatus = resolveDataZoneDebugModeStatus(dataZoneDebugMode?.debug_mode_status)
  const isDataZoneDebugEnabled = Boolean(dataZoneDebugMode?.enabled)
  const dataZoneDebugExpiredNote = (dataZoneDebugMode?.last_check_error || "").trim()
  const isDataZoneDebugExpired =
    !isDataZoneDebugEnabled &&
    Boolean(dataZoneDebugExpiredNote) &&
    /过期|自动关闭|自动切换为关闭状态/.test(dataZoneDebugExpiredNote)
  const managedDataZoneProgramID = ((dataZoneDebugMode?.program_id || debugView?.data_zone?.receive_callback_program_id || "").trim())
  const canOpenDataZoneDebugMode = !isDataZoneDebugEnabled && Boolean(managedDataZoneProgramID)
  const canCloseDataZoneDebugMode = isDataZoneDebugEnabled && Boolean(managedDataZoneProgramID)
  const isDataZoneDebugLocked = isDataZoneDebugEnabled
  const dataZoneDebugTokenPlaceholder = isDataZoneDebugLocked
    ? "********（已提交，关闭后可修改）"
    : "输入企业微信下发的 debug_token"

  const productBadgeClass = (tone: "green" | "blue" | "orange" | "amber" | "red" | "gray"): string => {
    switch (tone) {
      case "green":
        return "bg-green-100 text-green-700 border-none"
      case "blue":
        return "bg-blue-100 text-blue-700 border-none"
      case "orange":
        return "bg-orange-100 text-orange-700 border-none"
      case "amber":
        return "bg-amber-100 text-amber-700 border-none"
      case "red":
        return "bg-red-100 text-red-700 border-none"
      default:
        return "bg-gray-100 text-gray-600 border-none"
    }
  }

  const permissionTree = (() => {
    const tree = new Map<string, Map<string, Array<{ code: string; expire_time?: number }>>>()
    for (const item of integrationPermissions) {
      const code = (item.code || "").trim()
      if (!code) continue
      const meta = resolvePermissionCategoryGroup(code)
      const categoryNode = tree.get(meta.category) || new Map<string, Array<{ code: string; expire_time?: number }>>()
      const groupItems = categoryNode.get(meta.group) || []
      groupItems.push({ code, expire_time: item.expire_time })
      categoryNode.set(meta.group, groupItems)
      tree.set(meta.category, categoryNode)
    }
    return Array.from(tree.entries()).map(([category, groupMap]) => ({
      category,
      groups: Array.from(groupMap.entries()).map(([group, items]) => ({
        group,
        items: [...items].sort((a, b) => a.code.localeCompare(b.code)),
      })),
    }))
  })()
  const capabilityCards = (() => {
    type CapabilityCard = {
      key: string
      title: string
      badgeLabel: string
      badgeTone: "green" | "blue" | "orange" | "amber" | "red" | "gray"
      summary: string
      detail: string
      actionLabel: string
      command: CapabilityCommand
      lastCheckedAt: string
      lastReadyAt: string
      issue?: {
        priority: number
        title: string
        impact: string
        owner: string
        nextStep: string
      }
    }
    const cards: CapabilityCard[] = []

    {
      const status = (installCapability?.status || "unknown").trim()
      const blockedReason = (installCapability?.blocked_reason || "").trim()
      const card: CapabilityCard = {
        key: "install",
        title: "安装授权",
        badgeLabel: "配置中",
        badgeTone: "blue" as const,
        summary: "平台正在确认当前企业的安装授权状态。",
        detail: "安装授权就绪后，通讯录范围、会话专区和 CRM 初始化会继续自动推进。",
        actionLabel: "重新检查",
        command: "recheck_all_capabilities" as CapabilityCommand,
        lastCheckedAt: formatDateTime((installCapability?.last_checked_at || "").trim()),
        lastReadyAt: formatDateTime((installCapability?.last_ready_at || "").trim()),
      }
      switch (status) {
        case "ready":
          card.badgeLabel = "已就绪"
          card.badgeTone = "green"
          card.summary = "企业安装授权有效，平台已进入后续能力收敛流程。"
          card.detail = "无需重复安装应用，后续能力会按各自前置条件继续收敛。"
          break
        case "blocked":
          card.badgeLabel = "待管理员确认"
          card.badgeTone = "orange"
          card.summary = "当前没有检测到有效的企业安装授权。"
          card.detail = "未重新完成授权前，企业微信接入能力不会生效。"
          card.issue = {
            priority: 10,
            title: "待企业管理员完成应用安装授权",
            impact: "企业微信相关能力不会进入后续收敛流程。",
            owner: "企业管理员",
            nextStep: blockedReason === "authorization_revoked" ? "请企业管理员重新授权安装当前应用。" : "请企业管理员确认当前企业已完成应用安装授权。",
          }
          break
        case "error":
          card.badgeLabel = "需排查"
          card.badgeTone = "red"
          card.summary = "平台暂时无法确认安装授权状态。"
          card.detail = "这通常表示接入链路或服务调用异常，需要平台侧排查。"
          card.issue = {
            priority: 100,
            title: "安装授权状态检查异常",
            impact: "平台暂时无法确认企业安装授权状态，相关接入能力会继续受影响。",
            owner: "平台研发排查",
            nextStep: "请平台支持检查安装授权同步链路和服务状态。",
          }
          break
      }
      cards.push(card)
    }

    {
      const status = (orgScopeCapability?.status || "unknown").trim()
      const blockedReason = (orgScopeCapability?.blocked_reason || "").trim()
      const scopeKind = (orgScopeCapability?.scope_kind || "unknown").trim()
      const isLimitedScope = status === "ready" && scopeKind !== "" && scopeKind !== "full_corp" && scopeKind !== "none"
      const card: CapabilityCard = {
        key: "org_scope",
        title: "通讯录范围",
        badgeLabel: "配置中",
        badgeTone: "blue" as const,
        summary: "平台正在确认通讯录权限和组织范围。",
        detail: "组织架构同步、成员分配和可见范围计算依赖这一项结果。",
        actionLabel: "重新检查",
        command: "recheck_org_scope" as CapabilityCommand,
        lastCheckedAt: formatDateTime((orgScopeCapability?.last_checked_at || "").trim()),
        lastReadyAt: formatDateTime((orgScopeCapability?.last_ready_at || "").trim()),
      }
      switch (status) {
        case "ready":
          if (isLimitedScope) {
            card.badgeLabel = "部分可用"
            card.badgeTone = "amber"
            card.summary = "通讯录范围已生效，但当前只覆盖部分部门或成员。"
            card.detail = `当前范围：成员 ${Number(orgScopeCapability?.member_count || 0)}，部门 ${Number(orgScopeCapability?.department_count || 0)}。`
            card.issue = {
              priority: 30,
              title: "通讯录范围为部分授权",
              impact: "只有已授权的成员和部门会参与组织同步与权限计算。",
              owner: "企业管理员",
              nextStep: "如需扩大覆盖范围，请在企业微信后台调整当前应用的通讯录可见范围。",
            }
          } else {
            card.badgeLabel = "已就绪"
            card.badgeTone = "green"
            card.summary = "通讯录范围已确认，组织架构同步和成员权限计算可以正常推进。"
            card.detail = `当前范围：成员 ${Number(orgScopeCapability?.member_count || 0)}，部门 ${Number(orgScopeCapability?.department_count || 0)}。`
          }
          break
        case "blocked":
          card.badgeLabel = "待管理员确认"
          card.badgeTone = "orange"
          card.summary = "企业管理员尚未完成通讯录权限确认。"
          card.detail = "确认完成前，组织架构同步、成员范围和部分 CRM 能力会继续受限。"
          card.issue = {
            priority: 20,
            title: "待企业管理员确认通讯录权限",
            impact: "组织架构同步、成员分配和权限计算暂不可完整生效。",
            owner: "企业管理员",
            nextStep: blockedReason === "authorized_scope_empty"
              ? "请在企业微信后台为当前应用配置有效的通讯录可见范围。"
              : "请企业管理员在企业微信后台确认当前应用的通讯录权限和可见范围。",
          }
          break
        case "error":
          card.badgeLabel = "需排查"
          card.badgeTone = "red"
          card.summary = "平台暂时无法确认通讯录范围。"
          card.detail = "这通常表示通讯录同步链路或权限探测出现了异常。"
          card.issue = {
            priority: 100,
            title: "通讯录范围检查异常",
            impact: "平台暂时无法确认通讯录权限状态，组织同步和成员权限计算会继续受影响。",
            owner: "平台研发排查",
            nextStep: "请平台支持检查组织范围探测和通讯录同步链路。",
          }
          break
      }
      cards.push(card)
    }

    {
      const status = (openDataCapability?.status || "unknown").trim()
      const blockedReason = (openDataCapability?.blocked_reason || "").trim()
      const card: CapabilityCard = {
        key: "open_data",
        title: "会话专区",
        badgeLabel: "配置中",
        badgeTone: "blue" as const,
        summary: "平台正在确认专区授权并自动收敛公钥与回调配置。",
        detail: "会话展示、专区程序通知和相关 CRM 能力都依赖这一项完成。",
        actionLabel: "重新检查",
        command: "recheck_open_data" as CapabilityCommand,
        lastCheckedAt: formatDateTime((openDataCapability?.last_checked_at || "").trim()),
        lastReadyAt: formatDateTime((openDataCapability?.last_ready_at || "").trim()),
      }
      switch (status) {
        case "ready":
          card.badgeLabel = "已就绪"
          card.badgeTone = "green"
          card.summary = "会话专区授权、授权范围、公钥和回调接收程序均已就绪。"
          card.detail = `当前已识别授权成员 ${Number(openDataCapability?.auth_user_count || 0)} 人。`
          break
        case "blocked":
          if (blockedReason === "data_zone_not_authorized" || blockedReason === "chatdata_no_auth_members") {
            card.badgeLabel = "待管理员确认"
            card.badgeTone = "orange"
            card.summary = "企业管理员尚未完成数据专区授权或会话内容授权范围配置。"
            card.detail = "完成企业微信后台授权后，平台会继续自动收敛剩余配置。"
            card.issue = {
              priority: 20,
              title: blockedReason === "data_zone_not_authorized" ? "待开通数据与智能专区权限" : "待确认会话内容授权范围",
              impact: "会话展示、专区程序通知和依赖专区的能力暂不可用。",
              owner: "企业管理员",
              nextStep: blockedReason === "data_zone_not_authorized"
                ? "请企业管理员在企业微信后台为当前应用开通数据与智能专区权限。"
                : "请企业管理员在数据与智能专区中选择会话内容授权成员或范围。",
            }
          } else {
            card.badgeLabel = "配置中"
            card.badgeTone = "blue"
            card.summary = "平台正在自动完成专区运行配置。"
            card.detail = "公钥、回调接收程序和程序运行配置由平台自动托管，不需要手工保存。"
            card.issue = {
              priority: 40,
              title: "等待平台自动完成专区配置",
              impact: "会话专区尚未完全可用，前端会继续使用降级展示。",
              owner: "平台自动收敛",
              nextStep: "通常会在短时间内自动完成；若长时间停留，请联系平台支持排查。",
            }
          }
          break
        case "error":
          card.badgeLabel = "需排查"
          card.badgeTone = "red"
          card.summary = "平台暂时无法完成会话专区检查或自动配置。"
          card.detail = "这通常表示专区接口、平台配置或服务调用出现异常。"
          card.issue = {
            priority: 100,
            title: "会话专区检查或自动配置异常",
            impact: "平台暂时无法完成会话专区能力收敛，会话展示和依赖专区的功能会继续受影响。",
            owner: "平台研发排查",
            nextStep: "请平台支持检查专区接口调用、平台程序配置和公钥托管链路。",
          }
          break
      }
      cards.push(card)
    }

    {
      const status = (receptionChannelCapability?.status || "unknown").trim()
      const blockedReason = (receptionChannelCapability?.blocked_reason || "").trim()
      const activeCount = Number(receptionChannelCapability?.active_count || 0)
      const card: CapabilityCard = {
        key: "reception_channel",
        title: "接待渠道",
        badgeLabel: "配置中",
        badgeTone: "blue" as const,
        summary: "平台正在确认客服账号和接待渠道可用性。",
        detail: "接待渠道就绪后，客服消息才能稳定进入接待与路由流程。",
        actionLabel: "重新检查",
        command: "recheck_reception_channel" as CapabilityCommand,
        lastCheckedAt: formatDateTime((receptionChannelCapability?.last_checked_at || "").trim()),
        lastReadyAt: formatDateTime((receptionChannelCapability?.last_ready_at || "").trim()),
      }
      switch (status) {
        case "ready":
          card.badgeLabel = "已就绪"
          card.badgeTone = "green"
          card.summary = `当前有 ${activeCount} 个可用接待渠道。`
          card.detail = "客服账号、渠道绑定和消息接入前提已满足。"
          break
        case "degraded":
          card.badgeLabel = "部分可用"
          card.badgeTone = "amber"
          card.summary = `当前只检测到 ${activeCount} 个可用接待渠道。`
          card.detail = "部分客服账号或渠道配置未完全生效，但已有渠道可继续使用。"
          card.issue = {
            priority: 35,
            title: "接待渠道仅部分可用",
            impact: "部分客服账号或渠道可能无法接待新会话。",
            owner: "企业管理员",
            nextStep: "请确认企业微信客服账号、接待人员和渠道启用状态。",
          }
          break
        case "blocked":
          card.badgeLabel = "待管理员确认"
          card.badgeTone = "orange"
          card.summary = "当前还没有可用的接待渠道。"
          card.detail = "客服账号或渠道未准备好前，新的接待会话无法正常进入系统。"
          card.issue = {
            priority: 25,
            title: blockedReason === "kf_account_not_available" ? "客服账号暂不可用" : "当前没有可用接待渠道",
            impact: "新的客服会话无法稳定进入接待与路由流程。",
            owner: "企业管理员",
            nextStep: "请在企业微信后台确认客服账号、接待人员和渠道启用状态。",
          }
          break
        case "error":
          card.badgeLabel = "需排查"
          card.badgeTone = "red"
          card.summary = "平台暂时无法确认接待渠道状态。"
          card.detail = "这通常表示客服账号同步或渠道探测链路出现异常。"
          card.issue = {
            priority: 100,
            title: "接待渠道检查异常",
            impact: "平台暂时无法确认接待渠道状态，新的客服会话接入可能会继续受影响。",
            owner: "平台研发排查",
            nextStep: "请平台支持检查客服账号同步和渠道探测链路。",
          }
          break
      }
      cards.push(card)
    }

    {
      const status = (crmBootstrapCapability?.status || "unknown").trim()
      const blockedReason = (crmBootstrapCapability?.blocked_reason || "").trim()
      const card: CapabilityCard = {
        key: "crm_bootstrap",
        title: "CRM 数据初始化",
        badgeLabel: "配置中",
        badgeTone: "blue" as const,
        summary: "平台会在组织范围与会话专区满足前置条件后自动推进 CRM 初始化。",
        detail: renderCRMScopeSummary((crmBootstrapCapability?.scope || "all").trim() || "all"),
        actionLabel: "重新检查",
        command: "recheck_crm_bootstrap" as CapabilityCommand,
        lastCheckedAt: formatDateTime((crmBootstrapCapability?.last_checked_at || "").trim()),
        lastReadyAt: formatDateTime((crmBootstrapCapability?.last_ready_at || "").trim()),
      }
      switch (status) {
        case "ready":
          card.badgeLabel = "已就绪"
          card.badgeTone = "green"
          card.summary = "CRM 初始化已完成，企业客户与群聊相关基础数据可以继续推进。"
          break
        case "blocked":
        case "idle":
        case "queued":
        case "running":
          card.badgeLabel = "配置中"
          card.badgeTone = "blue"
          card.summary = "CRM 初始化正在等待前置能力就绪或执行完成。"
          card.detail = blockedReason === "waiting_org_scope_ready"
            ? "通讯录范围就绪后会自动启动。"
            : blockedReason === "waiting_open_data_ready"
              ? "会话专区就绪后会自动启动。"
              : "平台会在前置条件满足后自动继续执行。"
          card.issue = {
            priority: 45,
            title: "CRM 初始化等待前置能力完成",
            impact: "部分 CRM 基础数据暂未进入初始化流程。",
            owner: "平台自动收敛",
            nextStep: "请先确认通讯录范围和会话专区状态；前置能力就绪后会自动继续执行。",
          }
          break
        case "error":
          card.badgeLabel = "需排查"
          card.badgeTone = "red"
          card.summary = "平台暂时无法完成 CRM 初始化。"
          card.detail = "这通常表示 CRM 服务、调用链路或初始化任务本身出现异常。"
          card.issue = {
            priority: 100,
            title: "CRM 初始化异常",
            impact: "平台暂时无法完成 CRM 初始化，客户与群聊相关基础数据初始化会继续受影响。",
            owner: "平台研发排查",
            nextStep: "请平台支持检查 CRM 服务可达性和初始化任务执行状态。",
          }
          break
      }
      cards.push(card)
    }

    return cards
  })()

  const pendingIssues = capabilityCards
    .map((item) => item.issue)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.priority - left.priority)

  const headerSummary = capabilityCards.map((item) => `${item.title}${item.badgeLabel}`).join("，")
  const dataZoneSummary = (() => {
    if (dataZone?.data_zone_ready) {
      return "会话专区已完成授权与运行前置配置，可用于会话展示和专区程序通知。"
    }
    if ((dataZone?.data_zone_permission_status || "").trim() === "not_authorized") {
      return "当前企业尚未开通数据与智能专区权限，平台会在授权完成后继续自动配置。"
    }
    if ((dataZone?.chatdata_auth_scope_status || "").trim() === "no_auth_members") {
      return "数据专区已开通，但会话内容授权范围尚未覆盖成员。"
    }
    if ((openDataCapability?.status || "").trim() === "error") {
      return "会话专区检查或自动配置出现异常，请联系平台支持排查。"
    }
    return "平台正在自动完成会话专区所需的托管配置。"
  })()

  const debugCorpCapabilityState = debugView?.corp_capability_state

  const capabilityDiagnostics = [
    {
      key: "install",
      title: "安装授权",
      axis: debugCorpCapabilityState?.install,
      meta: [] as Array<{ label: string; value: string }>,
      detailsJSON: "",
    },
    {
      key: "org_scope",
      title: "通讯录范围",
      axis: debugCorpCapabilityState?.org_scope,
      meta: [
        { label: "scope_kind", value: (debugCorpCapabilityState?.org_scope?.scope_kind || "unknown").trim() || "unknown" },
        { label: "成员数量", value: String(Number(debugCorpCapabilityState?.org_scope?.member_count || 0)) },
        { label: "部门数量", value: String(Number(debugCorpCapabilityState?.org_scope?.department_count || 0)) },
        { label: "visibility_hash", value: (debugCorpCapabilityState?.org_scope?.visibility_hash || "-").trim() || "-" },
        { label: "auth_snapshot_hash", value: (debugCorpCapabilityState?.org_scope?.auth_snapshot_hash || "-").trim() || "-" },
      ],
      detailsJSON: (debugCorpCapabilityState?.org_scope?.details_json || "").trim(),
    },
    {
      key: "open_data",
      title: "会话专区",
      axis: debugCorpCapabilityState?.open_data,
      meta: [
        { label: "授权成员数量", value: String(Number(debugCorpCapabilityState?.open_data?.auth_user_count || 0)) },
      ],
      detailsJSON: (debugCorpCapabilityState?.open_data?.details_json || "").trim(),
    },
    {
      key: "reception_channel",
      title: "接待渠道",
      axis: debugCorpCapabilityState?.reception_channel,
      meta: [
        { label: "可用渠道数量", value: String(Number(debugCorpCapabilityState?.reception_channel?.active_count || 0)) },
        { label: "channel_hash", value: (debugCorpCapabilityState?.reception_channel?.channel_hash || "-").trim() || "-" },
      ],
      detailsJSON: (debugCorpCapabilityState?.reception_channel?.details_json || "").trim(),
    },
    {
      key: "crm_bootstrap",
      title: "CRM 初始化",
      axis: debugCorpCapabilityState?.crm_bootstrap,
      meta: [
        { label: "scope", value: ((debugCorpCapabilityState?.crm_bootstrap?.scope || "all").trim() || "all").toUpperCase() },
      ],
      detailsJSON: (debugCorpCapabilityState?.crm_bootstrap?.details_json || "").trim(),
    },
  ]

  const toolbarRuntime = view?.toolbar_runtime || []
  const toolbarEntries = (() => {
    const hasKF = toolbarRuntime.some((item) => (item.entry_path || "").trim() === "/sidebar/kf")
    const hasContact = toolbarRuntime.some((item) => (item.entry_path || "").trim() === "/sidebar/contact")
    return [
      {
        code: "sidebar_kf",
        name: "微信客服工具栏",
        entryPath: "/sidebar/kf",
        available: hasKF,
        reason: hasKF ? "入口已注册" : "入口未注册",
      },
      {
        code: "sidebar_contact",
        name: "客户联系工具栏（单聊/群聊）",
        entryPath: "/sidebar/contact",
        available: hasContact,
        reason: "在企业微信会话 WebView 中按上下文自动分流 single/group",
      },
    ]
  })()
  const readConnectionText = (connection: Record<string, unknown> | undefined, ...keys: string[]): string => {
    if (!connection) return "-"
    for (const key of keys) {
      const value = connection[key]
      if (typeof value === "string" && value.trim() !== "") return value.trim()
    }
    return "-"
  }
  const connectorStatusBadge = (status: string) => {
    switch ((status || "").trim()) {
      case "connected":
        return { label: "已连接", className: "bg-green-50 text-green-700 border-green-200" }
      case "not_connected":
        return { label: "未连接", className: "bg-gray-100 text-gray-600 border-gray-200" }
      default:
        return { label: "不可用", className: "bg-orange-50 text-orange-700 border-orange-200" }
    }
  }
  const toolbarDebugSwitch = (debugView?.debug_switches || []).find((item) => (item.key || "").trim() === "enable_toolbar_debug_entry")
  const memberRoleOptions = (() => {
    const roles = view?.roles || []
    if (roles.length === 0) return ROLE_OPTIONS
    return roles
      .map((role) => ({
        key: (role.role || "").trim(),
        label: (role.role_name || role.role || "").trim(),
      }))
      .filter((role) => role.key && role.label)
  })()
  const permissionGroups = (() => {
    const query = permissionSearch.trim().toLowerCase()
    const groups = new Map<string, string[]>()
    for (const permission of view?.permission_catalog || []) {
      const key = (permission || "").trim()
      if (!key) continue
      const label = renderInternalPermissionLabel(key)
      if (query && !key.toLowerCase().includes(query) && !label.toLowerCase().includes(query)) continue
      const group = resolveInternalPermissionGroup(key)
      groups.set(group, [...(groups.get(group) || []), key])
    }
    return Array.from(groups.entries()).map(([group, permissions]) => ({
      group,
      permissions: [...permissions].sort((a, b) => a.localeCompare(b)),
    }))
  })()
  return (
    <div className="flex min-h-full flex-col bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">组织与设置</h2>
        <p className="text-sm text-gray-500 mt-1">查看企业微信接入进度，并管理组织设置、连接状态与可用能力</p>
      </div>

      <Tabs value={activeSettingsTab} onValueChange={handleSettingsTabChange} variant="underline" className="flex flex-col">
        <div className="px-6 border-b border-gray-100 bg-white">
          <TabsList className="bg-transparent border-none gap-8 h-14">
            <TabsTrigger value="wecom" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 h-14 text-sm font-semibold transition-all">
              企业微信集成
            </TabsTrigger>
            <TabsTrigger value="org" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 h-14 text-sm font-semibold transition-all">
              组织架构同步
            </TabsTrigger>
            <TabsTrigger value="roles" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 h-14 text-sm font-semibold transition-all">
              角色与权限
            </TabsTrigger>
            <TabsTrigger value="toolbar" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 h-14 text-sm font-semibold transition-all">
              侧边栏工具配置
            </TabsTrigger>
            <TabsTrigger value="connectors" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 h-14 text-sm font-semibold transition-all">
              连接器
            </TabsTrigger>
            {debugAccessEnabled ? (
              <TabsTrigger value="debug" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 h-14 text-sm font-semibold transition-all">
                调试与开发
              </TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        <div className="p-8 bg-gray-50/20">
          {!hasLoaded && isLoading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                正在加载企业微信接入状态与组织设置...
              </div>
            </div>
          ) : null}
          {hasLoaded ? (
          <>
          {debugAccessEnabled ? (
            <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-900">当前已进入调试与开发模式</div>
                <div className="text-xs leading-5 text-slate-600">
                  该模式仅用于平台联调与排查。{debugAccessExpiresAt > 0 ? `访问将在 ${formatUnix(debugAccessExpiresAt)} 自动失效。` : "完成排查后请及时退出。"}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {activeSettingsTab !== "debug" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white text-xs font-semibold"
                    onClick={() => handleSettingsTabChange("debug")}
                  >
                    前往调试与开发
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white text-xs font-semibold"
                  onClick={() => void closeDebugAccess()}
                  disabled={isClosingDebugAccess}
                >
                  {isClosingDebugAccess ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                  退出调试与开发
                </Button>
              </div>
            </div>
          ) : null}
          <TabsContent value="wecom" className="mt-0">
            <div className="max-w-6xl space-y-8">
              <Card className="overflow-hidden border-gray-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="bg-gradient-to-r from-blue-50 via-cyan-50 to-white px-6 py-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                            <Shield className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="text-lg font-bold text-gray-900">企业微信接入状态</div>
                            <div className="text-sm text-gray-500">
                              {(integration?.corp_name || "").trim() ? `当前企业：${(integration?.corp_name || "").trim()}` : "用于查看当前企业接入进度与下一步处理事项。"}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-blue-100 bg-white/90 px-4 py-3">
                          <div className="text-sm font-semibold text-gray-900">{headerSummary}</div>
                          <div className="mt-1 text-xs leading-5 text-gray-500">
                            安装授权、通讯录范围、会话专区、接待渠道与 CRM 初始化会按前置条件逐步自动收敛。
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-[11px] text-gray-500">
                          <span>最近状态刷新：{formatDateTime((corpCapabilityState?.updated_at || integration?.last_checked_at || "").trim())}</span>
                          <span>当前授权状态：{renderIntegrationAuthorizationStatus((integration?.authorization_status || "").trim())}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-3">
                        <Button
                          variant="outline"
                          className="bg-white font-semibold"
                          onClick={() => void loadView()}
                          disabled={isLoading}
                        >
                          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                          刷新状态
                        </Button>
                        <Button
                          className="bg-blue-600 font-semibold hover:bg-blue-700"
                          onClick={() => void recheckCapability("recheck_all_capabilities", "wecom", "已发起企业能力重新检查")}
                          disabled={capabilityCommandRunning === "recheck_all_capabilities"}
                        >
                          {capabilityCommandRunning === "recheck_all_capabilities" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                          重新检查全部
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <section className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-900">企业接入状态</h3>
                  <p className="text-sm text-gray-500">每一项都会独立收敛。未就绪不代表系统故障，只有需要处理的问题才会进入下方问题清单。</p>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {capabilityCards.map((item) => {
                    const running = capabilityCommandRunning === item.command
                    return (
                      <Card key={item.key} className="border-gray-200 shadow-sm">
                        <CardContent className="space-y-4 p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-sm font-bold text-gray-900">{item.title}</div>
                              <div className="text-xs leading-5 text-gray-500">{item.summary}</div>
                            </div>
                            <Badge className={`${productBadgeClass(item.badgeTone)} shrink-0 px-2.5 py-1 text-[10px] font-bold`}>
                              {item.badgeLabel}
                            </Badge>
                          </div>
                          <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-3 text-xs leading-5 text-gray-600">
                            {item.detail}
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-[11px] text-gray-500">
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-gray-400">最近检查</div>
                              <div className="mt-1 text-xs font-medium text-gray-700">{item.lastCheckedAt}</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-gray-400">最近就绪</div>
                              <div className="mt-1 text-xs font-medium text-gray-700">{item.lastReadyAt}</div>
                            </div>
                          </div>
                          <div className="flex justify-end border-t border-gray-100 pt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-white text-xs font-semibold"
                              onClick={() => void recheckCapability(item.command, "wecom", `${item.title}已发起重新检查`)}
                              disabled={running}
                            >
                              {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                              {item.actionLabel}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </section>

              <section className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-900">会话专区状态</h3>
                  <p className="text-sm text-gray-500">会话专区相关配置由平台自动托管。这里仅展示当前是否已生效，以及会影响到的授权范围。</p>
                </div>
                <Card className="border-gray-200 shadow-sm">
                  <CardHeader className="border-b border-gray-50 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-900">
                          <KeyRound className="h-4 w-4 text-blue-600" />
                          会话专区就绪情况
                        </CardTitle>
                        <div className="text-xs leading-5 text-gray-500">{dataZoneSummary}</div>
                      </div>
                      <Badge className={`${productBadgeClass(dataZone?.data_zone_ready ? "green" : (openDataCapability?.status || "").trim() === "error" ? "red" : "orange")} px-2.5 py-1 text-[10px] font-bold`}>
                        {dataZone?.data_zone_ready ? "已就绪" : (openDataCapability?.status || "").trim() === "error" ? "需排查" : "配置中"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 p-5">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {([
                        {
                          key: "permission",
                          title: "专区权限",
                          value: dataZone?.data_zone_permission_status,
                          meta: "企业微信是否已为当前应用开通数据与智能专区权限。",
                        },
                        {
                          key: "scope",
                          title: "会话授权范围",
                          value: dataZone?.chatdata_auth_scope_status,
                          meta: Number(dataZone?.auth_user_count || 0) > 0 ? `当前已识别授权成员 ${Number(dataZone?.auth_user_count || 0)} 人。` : "当前还未识别到会话内容授权成员。",
                        },
                        {
                          key: "key",
                          title: "公钥配置",
                          value: dataZone?.chatdata_public_key_status,
                          meta: Number(dataZone?.public_key_ver || 0) > 0 ? `当前公钥版本 ${Number(dataZone?.public_key_ver || 0)}。` : "平台尚未完成公钥配置。",
                        },
                        {
                          key: "callback",
                          title: "回调接收",
                          value: dataZone?.chatdata_receive_callback_status,
                          meta: dataZone?.receive_callback_ready ? "会话专区回调接收程序已生效。" : "平台正在自动确认回调接收程序。",
                        },
                      ] as const).map((item) => {
                        const resolved = resolveDataZoneStatus(item.key, item.value)
                        return (
                          <div key={item.key} className="rounded-xl border border-gray-100 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                              <Badge className={`${dataZoneBadgeClass(resolved.tone)} px-2 py-0.5 text-[10px] font-bold`}>{resolved.label}</Badge>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-gray-500">{item.meta}</div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                      <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-bold text-gray-900">授权版本摘要</div>
                          <div className="text-[11px] text-gray-400">{dataZoneAuthEditions.length > 0 ? `共 ${dataZoneAuthEditions.length} 个版本` : "暂无版本信息"}</div>
                        </div>
                        {dataZoneAuthEditions.length > 0 ? (
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            {dataZoneAuthEditions.map((edition, index) => {
                              const editionStatus = chatDataEditionStatus(edition.status)
                              return (
                                <div key={`${edition.edition || 0}-${index}`} className="rounded-xl border border-gray-100 bg-white p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="text-xs font-semibold text-gray-900">{chatDataEditionLabel(edition.edition)}</div>
                                      <div className="mt-1 text-[11px] text-gray-500">{formatChatDataScopeSummary(edition.auth_scope)}</div>
                                    </div>
                                    <Badge className={`${dataZoneBadgeClass(editionStatus.tone)} px-1.5 py-0 text-[10px] font-bold`}>
                                      {editionStatus.label}
                                    </Badge>
                                  </div>
                                  <div className="mt-3 space-y-1 text-[11px] text-gray-500">
                                    <div>去重成员：{Number(edition.auth_user_count || 0)}</div>
                                    <div>存档周期：{Number(edition.msg_duration_days || 0) || "-"} 天</div>
                                    <div>有效期：{formatUnix(edition.begin_time)} 至 {formatUnix(edition.end_time)}</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-5 text-sm text-gray-500">
                            当前还没有读取到专区授权版本信息。完成授权后，平台会自动更新这里的摘要。
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-bold text-gray-900">生效成员预览</div>
                          <div className="text-[11px] text-gray-400">{dataZoneAuthUserPreview.length > 0 ? `前 ${dataZoneAuthUserPreview.length} 人` : "暂无成员预览"}</div>
                        </div>
                        {dataZoneAuthUserPreview.length > 0 ? (
                          <div className="space-y-2">
                            {dataZoneAuthUserPreview.map((user) => {
                              const userID = (user.userid || "").trim()
                              if (!userID) return null
                              return (
                                <div key={userID} className="rounded-xl border border-gray-100 bg-white p-3">
                                  <WecomDirectoryOpenDataName
                                    openID={(memberOpenUserIDMap.get(userID) || "").trim()}
                                    corpId={view?.integration?.corp_id}
                                    fallback={userID}
                                    className="block truncate text-xs font-bold text-gray-900"
                                    hintClassName="text-[10px] text-gray-400"
                                  />
                                  <div className="mt-1 truncate font-mono text-[10px] text-gray-400">{userID}</div>
                                  <div className="mt-1 text-[11px] text-gray-500">{formatChatDataEditionList(user.edition_list)}</div>
                                </div>
                              )
                            })}
                          </div>
                        ) : Number(dataZone?.auth_user_count || 0) > 0 ? (
                          <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-4 text-xs leading-5 text-orange-800">
                            已识别到授权范围，但成员预览暂未返回。平台会继续自动刷新，如长时间不更新请联系平台支持排查。
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-5 text-sm text-gray-500">
                            当前还没有可展示的授权成员。企业管理员完成成员或部门授权后，这里会自动出现预览。
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              <section className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-900">待处理问题</h3>
                  <p className="text-sm text-gray-500">这里只保留真正需要处理的阻塞项，方便快速判断是等管理员操作、等平台自动收敛，还是需要平台排查。</p>
                </div>
                <Card className="border-gray-200 shadow-sm">
                  <CardContent className="p-5">
                    {pendingIssues.length === 0 ? (
                      <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-4 text-sm leading-6 text-green-800">
                        当前没有需要人工处理的问题。平台会继续自动保持接入状态，并在能力变化后同步更新这里的结果。
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {pendingIssues.map((item, index) => (
                          <div key={`${item.title}-${index}`} className="rounded-2xl border border-gray-100 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-sm font-bold text-gray-900">{item.title}</div>
                              <Badge className={`${productBadgeClass(item.owner === "平台研发排查" ? "red" : item.owner === "平台自动收敛" ? "blue" : "orange")} shrink-0 px-2 py-0.5 text-[10px] font-bold`}>
                                {item.owner}
                              </Badge>
                            </div>
                            <div className="mt-3 space-y-3 text-xs leading-5 text-gray-600">
                              <div>
                                <div className="text-[10px] uppercase tracking-wider text-gray-400">当前影响</div>
                                <div className="mt-1">{item.impact}</div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wider text-gray-400">下一步</div>
                                <div className="mt-1">{item.nextStep}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="org" className="mt-0">
            <div className="max-w-4xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">同步规则</h3>
                  <p className="text-sm text-gray-500">平台组织域同步策略（与企微底层凭据配置解耦）</p>
                </div>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 shadow-sm"
                  onClick={() => void recheckCapability("recheck_org_scope", "org", "已发起通讯录权限重新检查")}
                  disabled={capabilityCommandRunning === "recheck_org_scope"}
                >
                  {capabilityCommandRunning === "recheck_org_scope" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  {capabilityCommandRunning === "recheck_org_scope" ? "检查中..." : "重新检查通讯录权限"}
                </Button>
              </div>

              <Card className="border-gray-200 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-6 flex items-center justify-between border-b border-gray-50 bg-white">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-gray-900">自动同步</div>
                      <div className="text-xs text-gray-500">开启后，系统将按策略自动同步组织与成员变更</div>
                    </div>
                    <Switch
                      name="auto_sync_enabled"
                      checked={Boolean(orgSync?.auto_sync_enabled)}
                      disabled={isLoading}
                      onCheckedChange={(checked) => {
                        void updateOrgSync(Boolean(checked), (orgSync?.sync_scope || "all").trim() || "all")
                      }}
                    />
                  </div>

                  <div className="p-6 space-y-4 bg-white">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-gray-900">组织范围 Capability</div>
                          <div className="mt-1 text-xs text-gray-500">这里展示的是真实 `org_scope` 收敛状态，而不是单次同步有没有报错。</div>
                        </div>
                        <Badge className={capabilityBadgeClass((orgScopeCapability?.status || "unknown").trim())}>
                          {capabilityStatusLabel((orgScopeCapability?.status || "unknown").trim())}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-3 text-[11px] text-gray-600 md:grid-cols-4">
                        <div>scope_kind：{(orgScopeCapability?.scope_kind || "unknown").trim() || "unknown"}</div>
                        <div>成员数：{Number(orgScopeCapability?.member_count || 0).toLocaleString("zh-CN")}</div>
                        <div>部门数：{Number(orgScopeCapability?.department_count || 0).toLocaleString("zh-CN")}</div>
                        <div>最近检查：{formatDateTime((orgScopeCapability?.last_checked_at || "").trim())}</div>
                      </div>
                      {capabilityReasonLabel((orgScopeCapability?.blocked_reason || "").trim()) ? (
                        <div className="mt-3 rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-xs text-orange-800">
                          {capabilityReasonLabel((orgScopeCapability?.blocked_reason || "").trim())}
                        </div>
                      ) : null}
                      {(orgScopeCapability?.last_error || "").trim() ? (
                        <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                          {(orgScopeCapability?.last_error || "").trim()}
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-bold text-gray-900">授权应用可见范围快照</div>
                          <div className="text-xs text-gray-500">这层表示当前第三方应用在该企业下的真实可见范围，不等于企业原生组织结构本身。</div>
                        </div>
                        <Badge variant={(appVisibility?.status || "").trim() === "ready" ? "success" : "secondary"}>
                          {((appVisibility?.status || "unavailable").trim() || "unavailable")}
                        </Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
                        <div>
                          <div className="text-[10px] text-gray-500">应用 AgentID</div>
                          <div className="text-xs font-semibold text-gray-800">{Number(appVisibility?.agent_id || 0) > 0 ? String(appVisibility?.agent_id) : "-"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500">可见部门</div>
                          <div className="text-xs font-semibold text-gray-800">{Number(appVisibility?.allow_party_count || 0).toLocaleString("zh-CN")}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500">可见成员</div>
                          <div className="text-xs font-semibold text-gray-800">{Number(appVisibility?.allow_user_count || 0).toLocaleString("zh-CN")}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500">可见标签</div>
                          <div className="text-xs font-semibold text-gray-800">{Number(appVisibility?.allow_tag_count || 0).toLocaleString("zh-CN")}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-500">最近快照时间</div>
                          <div className="text-xs font-semibold text-gray-800">{formatDateTime((appVisibility?.synced_at || appVisibility?.updated_at || "").trim())}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant={appVisibility?.has_department_scope ? "success" : "secondary"}>
                          {appVisibility?.has_department_scope ? "部门级可见" : "无部门级可见"}
                        </Badge>
                        <Badge variant={appVisibility?.has_user_scope ? "warning" : "secondary"}>
                          {appVisibility?.has_user_scope ? "成员级可见" : "无成员级可见"}
                        </Badge>
                        <Badge variant={appVisibility?.has_tag_scope ? "warning" : "secondary"}>
                          {appVisibility?.has_tag_scope ? "标签级可见" : "无标签级可见"}
                        </Badge>
                      </div>
                      {(appVisibility?.note || "").trim() ? (
                        <div className="mt-3 text-xs text-blue-800">{(appVisibility?.note || "").trim()}</div>
                      ) : null}
                    </div>
                    <div className="text-sm font-bold text-gray-900">同步范围</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[{ key: "all", title: "全量同步", desc: "同步所有部门与成员", icon: Users }, { key: "selected", title: "指定部门同步", desc: "仅同步选中的部门", icon: Shield }].map((item) => {
                        const selected = ((orgSync?.sync_scope || "all").trim() || "all") === item.key
                        const disabled = item.key === "selected" && !selected
                        return (
                          <div
                            key={item.key}
                            className={`p-5 border rounded-xl flex items-center justify-between transition-all ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${selected ? "border-2 border-blue-500 bg-blue-50 shadow-sm" : "border-gray-200 bg-white"}`}
                            onClick={() => {
                              if (isLoading) return
                              if (disabled) {
                                showNotice("org", "指定部门同步需要先提供部门选择器，当前版本暂不开放切换。", "warning")
                                return
                              }
                              void updateOrgSync(Boolean(orgSync?.auto_sync_enabled), item.key)
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selected ? "bg-blue-100" : "bg-gray-100"}`}>
                                <item.icon className={`w-6 h-6 ${selected ? "text-blue-600" : "text-gray-400"}`} />
                              </div>
                              <div className="flex flex-col">
                                <span className={`text-sm font-bold ${selected ? "text-blue-900" : "text-gray-700"}`}>{item.title}</span>
                                <span className={`text-[10px] font-medium ${selected ? "text-blue-600" : "text-gray-400"}`}>{item.desc}</span>
                                {disabled ? <span className="mt-1 text-[10px] font-semibold text-orange-600">待部门选择器上线后开放</span> : null}
                              </div>
                            </div>
                            {selected ? <CheckCircle2 className="w-6 h-6 text-blue-600" /> : null}
                          </div>
                        )
                      })}
                    </div>
                    <div className={`grid grid-cols-1 gap-3 rounded-xl border p-4 md:grid-cols-4 ${
                      (orgSync?.last_sync_status || "").trim() === "partial"
                        ? "border-orange-100 bg-orange-50/70"
                        : (orgSync?.last_sync_status || "").trim() === "failed"
                          ? "border-red-100 bg-red-50/70"
                          : "border-gray-100 bg-gray-50"
                    }`}>
                      <div>
                        <div className="text-[10px] text-gray-500">最近同步状态</div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                          {(orgSync?.last_sync_status || "idle").trim() || "idle"}
                          {(orgSync?.last_sync_status || "").trim() === "partial" ? <Badge variant="warning" className="text-[9px] px-1.5 py-0">部分完成</Badge> : null}
                          {(orgSync?.last_sync_status || "").trim() === "failed" ? <Badge variant="destructive" className="text-[9px] px-1.5 py-0">失败</Badge> : null}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500">部门数量</div>
                        <div className="text-xs font-semibold text-gray-800">{Number(orgSync?.department_count || 0).toLocaleString("zh-CN")}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500">成员数量</div>
                        <div className="text-xs font-semibold text-gray-800">{Number(orgSync?.member_count || 0).toLocaleString("zh-CN")}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500">最近同步时间</div>
                        <div className="text-xs font-semibold text-gray-800">{formatDateTime((orgSync?.last_sync_at || "").trim())}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      同步间隔：{(orgSync?.sync_interval || "-").trim() || "-"}。姓名、头像等通讯录展示字段未来需要由企业微信 open-data 组件承接，当前后端仅保证组织结构与可可靠获取字段。
                    </div>
                    {(orgSync?.last_sync_error || "").trim() ? (
                      <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                        最近同步错误：{(orgSync?.last_sync_error || "").trim()}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="roles" className="mt-0">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">角色管理</h3>
                  <p className="text-sm text-gray-500">平台内部权限体系（非企微底层权限配置）</p>
                </div>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 shadow-sm"
                  onClick={openCreateRoleDialog}
                  disabled={isCreatingRole}
                >
                  {isCreatingRole ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  新增角色
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(view?.roles || []).map((role) => (
                  <Card key={(role.role || "").trim()} className="border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group bg-white">
                    <CardHeader className="p-6 pb-2 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-bold text-gray-900">{(role.role_name || role.role || "未命名角色").trim()}</CardTitle>
                      <Badge className="bg-blue-50 text-blue-700 text-[10px] border-transparent font-bold">
                        {role.system_preset ? "系统预设" : "自定义"}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-6 pt-2">
                      <p className="text-xs text-gray-500 leading-relaxed mb-3">{(role.description || "-").trim()}</p>
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {(role.permissions || []).slice(0, 4).map((perm) => (
                          <Badge key={perm} variant="secondary" className="text-[9px] px-1 py-0 bg-gray-100 text-gray-500 border-none">{perm}</Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                          <Users className="w-3 h-3" /> {Number(role.member_count || 0)} 位成员
                        </div>
                        {role.system_preset ? (
                          <span className="text-[10px] font-bold text-gray-400">系统预设只读</span>
                        ) : (
                          <Button variant="link" className="h-auto p-0 text-blue-600 text-[10px] font-bold" onClick={() => openRoleEditor(role)}>编辑角色</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="p-5 border-b border-gray-50">
                  <CardTitle className="text-sm font-bold text-gray-900">成员与角色绑定</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-700">
                    成员真实姓名展示优先由企业微信 open-data 组件承接；若当前浏览器未满足企业微信内打开或管理后台同域跳转条件，将回退显示 userid。
                  </div>
                  {(view?.members || []).map((member) => {
                    const userID = (member.userid || "").trim()
                    if (!userID) return null
                    const isAppAdmin = member.is_app_admin === true
                    const currentRole = (memberRoleDraft[userID] || member.role || "staff").trim() || "staff"
                    const persistedRole = ((member.role || "staff").trim() || "staff")
                    const isSavingMember = savingMemberUserID === userID
                    const roleChanged = currentRole !== persistedRole
                    return (
                      <div key={userID} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3">
                        <div className="min-w-0">
                          <WecomDirectoryOpenDataName
                            openID={(member.open_userid || "").trim()}
                            corpId={view?.integration?.corp_id}
                            fallback={userID}
                            className="block truncate text-xs font-bold text-gray-900"
                            hintClassName="text-[10px] text-gray-400"
                          />
                          <div className="text-[10px] text-gray-500">{userID}{isAppAdmin ? " · 企微应用管理员（角色锁定）" : ""}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            id={`member-role-${userID}`}
                            name={`member-role-${userID}`}
                            aria-label={`${userID} 的平台角色`}
                            value={currentRole}
                            onChange={(event) => {
                              const value = event.target.value
                              setMemberRoleDraft((prev) => ({ ...prev, [userID]: value }))
                            }}
                            disabled={isAppAdmin || isSavingMember}
                            className="h-8 rounded-md border border-gray-200 px-2 text-xs disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                          >
                            {memberRoleOptions.map((item) => (
                              <option key={item.key} value={item.key}>{item.label}</option>
                            ))}
                          </select>
                          <Button size="sm" variant="outline" className="h-8 text-xs" disabled={isAppAdmin || !roleChanged || isSavingMember} onClick={() => void saveMemberRole(userID)}>
                            {isSavingMember ? "保存中..." : "保存"}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="toolbar" className="mt-0 space-y-8">
            <div className="max-w-5xl space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">工具栏接入配置</h3>
                  <p className="text-sm text-gray-500">仅展示入口路径；运行状态以企业微信会话 WebView 实际上下文为准</p>
                </div>
                <Badge className="bg-green-50 text-green-700 border-green-200 font-bold px-3 py-1">
                  <CheckCircle2 className="w-3 h-3 mr-1.5" /> 配置由服务商托管
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {toolbarEntries.map((item) => {
                  return (
                    <Card key={(item.code || item.name || "").trim()} className={`border-gray-200 shadow-sm hover:shadow-md transition-all ${item.available ? "" : "opacity-75 grayscale-[0.35]"}`}>
                      <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.available ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-400"}`}>
                            {(item.code || "").includes("contact") ? <Users className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                          </div>
                          <CardTitle className="text-sm font-bold text-gray-900">{(item.name || "未命名入口").trim() || "未命名入口"}</CardTitle>
                        </div>
                        <Badge className={`${item.available ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"} text-[10px] px-2 py-0.5`}>
                          {item.available ? "已配置" : "未配置"}
                        </Badge>
                      </CardHeader>
                      <CardContent className="p-5 pt-2 space-y-4">
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">入口路径</div>
                          <div className="bg-gray-50 p-2 rounded border border-gray-100 font-mono text-[10px] text-gray-600 break-all leading-relaxed">
                            {(item.entryPath || "-").trim() || "-"}
                          </div>
                        </div>
                        <div className="pt-2 border-t border-gray-50 text-[10px] text-gray-500 leading-relaxed">{item.reason}</div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

            </div>
          </TabsContent>

          <TabsContent value="connectors" className="mt-0">
            <div className="max-w-6xl space-y-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">连接器</h3>
                  <p className="text-sm text-gray-500">把当前企业连接到外部平台，后续能力按企业独立生效，彼此不共享数据。</p>
                </div>
                <Button variant="outline" className="bg-white font-semibold" onClick={() => void loadConnectors()} disabled={isLoadingConnectors}>
                  {isLoadingConnectors ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  刷新连接状态
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {CONNECTOR_CATALOG.map((item) => {
                  const status = connectorStatuses[item.key]
                  const badge = connectorStatusBadge(status?.status || "unavailable")
                  const connection = (status?.connection || {}) as Record<string, unknown>
                  const connected = Boolean(status?.connected)
                  const tenantLogo = readConnectionText(connection, "TenantLogo", "tenant_logo")
                  const tenantName = readConnectionText(connection, "TenantName", "tenant_name")
                  const tenantType = readConnectionText(connection, "TenantType", "tenant_type")
                  const authorizedUserPhone = readConnectionText(connection, "AuthorizedUserPhone", "authorized_user_phone")
                  const isTeamTenant = tenantType === "team" && tenantName !== "-"
                  return (
                    <Card key={item.key} className="overflow-hidden border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
                      <CardHeader className="relative p-6 pb-4">
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400" />
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_10px_24px_rgba(37,99,235,0.16)] ring-1 ring-blue-100">
                              <img src={tenantLogo !== "-" ? tenantLogo : muyuaiLogo} alt="母语AI" className="h-full w-full object-cover" />
                            </div>
                            <div>
                              <CardTitle className="text-base font-bold text-gray-900">{item.title}</CardTitle>
                              <p className="mt-1 text-xs leading-relaxed text-gray-500">{item.description}</p>
                            </div>
                          </div>
                          <Badge className={`${badge.className} shrink-0 px-2.5 py-1 text-[10px] font-bold`}>
                            {badge.label}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-5 p-6 pt-2">
                        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 md:grid-cols-2">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">当前企业</div>
                            <div className="mt-1 break-all font-mono text-xs font-semibold text-gray-800">{status?.corp_id || (integration?.corp_id || "-").trim() || "-"}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">已连接工作空间</div>
                            <div className="mt-1 break-all font-mono text-xs font-semibold text-gray-800">{readConnectionText(connection, "MuYuAITenantID", "muyuai_tenant_id")}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{isTeamTenant ? "团队名称" : "个人账号"}</div>
                            <div className="mt-1 break-all text-xs font-semibold text-gray-800">{isTeamTenant ? tenantName : authorizedUserPhone}</div>
                            <div className="mt-1 text-[10px] text-gray-500">{isTeamTenant ? "团队版授权" : "个人版授权"}</div>
                          </div>
                          {isTeamTenant ? (
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">授权成员</div>
                              <div className="mt-1 break-all text-xs font-semibold text-gray-800">{authorizedUserPhone}</div>
                            </div>
                          ) : null}
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">授权有效期</div>
                            <div className="mt-1 text-xs font-semibold text-gray-800">{formatDateTime(readConnectionText(connection, "TokenExpiresAt", "token_expires_at"))}</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {item.capabilities.map((capability) => (
                            <Badge key={capability} variant="secondary" className="border-none bg-blue-50 text-[10px] font-bold text-blue-700">
                              {capability}
                            </Badge>
                          ))}
                        </div>

                        <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-[11px] leading-relaxed text-amber-800">
                          重新连接只会更新当前连接状态，不会覆盖你在母语AI中已经存在的业务数据。
                        </div>

                        <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
                          <Button variant="outline" size="sm" className="bg-white text-xs font-bold" onClick={() => void startConnectorOAuth(item.key)} disabled={connectingConnectorKey === item.key}>
                            {connectingConnectorKey === item.key ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="mr-2 h-3.5 w-3.5" />}
                            {connected ? "更新连接" : "立即连接"}
                          </Button>
                          <Button variant="outline" size="sm" className="bg-white text-xs font-bold" onClick={() => void refreshConnector(item.key)} disabled={!connected || refreshingConnectorKey === item.key}>
                            {refreshingConnectorKey === item.key ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                            刷新状态
                          </Button>
                          <Button size="sm" className="bg-blue-600 text-xs font-bold shadow-sm hover:bg-blue-700" onClick={() => void testConnector(item.key)} disabled={!connected || testingConnectorKey === item.key}>
                            {testingConnectorKey === item.key ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Shield className="mr-2 h-3.5 w-3.5" />}
                            校验连接
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="debug" className="mt-0">
            <div className="max-w-6xl space-y-6">
              <div className="rounded-xl border border-orange-100 bg-orange-50 p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-orange-900">调试与开发</div>
                    <p className="text-xs leading-relaxed text-orange-700">
                      本页仅用于平台侧排查和联调。主页面只展示企业管理员需要理解的接入状态，原始诊断与调试控制统一收在这里。
                    </p>
                  </div>
                </div>
              </div>

              {isLoadingDebugView && !debugView ? (
                <Card className="border-gray-200 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      正在加载调试与开发数据...
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {!isLoadingDebugView && !debugView ? (
                <Card className="border-gray-200 shadow-sm">
                  <CardContent className="p-6 text-sm text-gray-600">
                    当前还没有可展示的调试数据。请刷新或重新进入调试与开发模式。
                  </CardContent>
                </Card>
              ) : null}

              {debugView ? (
              <>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="border-b border-gray-50 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold">
                      <Zap className="h-4 w-4 text-blue-600" /> 数据专区调试模式
                    </CardTitle>
                    <Badge className={`${dataZoneBadgeClass(dataZoneDebugStatus.tone)} px-2.5 py-1 text-[10px] font-bold`}>
                      {dataZoneDebugStatus.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-gray-900">平台托管程序 ID</div>
                      <Input value={managedDataZoneProgramID} disabled className="bg-gray-50 font-mono" />
                      <div className="text-[11px] leading-5 text-gray-500">
                        `program_id` 由后端平台配置统一托管，不再由企业侧手工保存。
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-gray-900">调试 token</div>
                      <Input
                        type="password"
                        value={dataZoneDebugToken}
                        onChange={(event) => setDataZoneDebugToken(event.target.value)}
                        placeholder={dataZoneDebugTokenPlaceholder}
                        disabled={isDataZoneDebugLocked}
                        autoComplete="new-password"
                        autoCapitalize="off"
                        spellCheck={false}
                      />
                      <div className="text-[11px] leading-5 text-gray-500">
                        仅在需要联调企业微信数据专区程序时填写，开启成功后会返回当前企业的调试 access token。
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4 md:grid-cols-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">调试状态</div>
                      <div className="mt-1 text-xs font-semibold text-gray-900">{dataZoneDebugStatus.label}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">最近检查</div>
                      <div className="mt-1 text-xs font-semibold text-gray-900">{formatUnix(dataZoneDebugMode?.last_checked_at)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">环境模式</div>
                      <div className="mt-1 text-xs font-semibold text-gray-900">{((debugView?.integration?.app_mode || integration?.app_mode || "third_party_provider").trim() || "third_party_provider").toUpperCase()}</div>
                    </div>
                  </div>

                  {!managedDataZoneProgramID ? (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                      当前环境尚未配置平台托管的专区程序 ID，调试模式暂时不可开启，需要平台侧先完成后端配置。
                    </div>
                  ) : null}

                  {dataZoneDebugMode?.last_check_error && !isDataZoneDebugExpired ? (
                    <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-700">
                      {dataZoneDebugMode.last_check_error}
                    </div>
                  ) : null}

                  {isDataZoneDebugExpired ? (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                      {dataZoneDebugExpiredNote || "debug_token 已过期，平台已自动切换为关闭状态。请更新后重新开启。"}
                    </div>
                  ) : isDataZoneDebugEnabled ? (
                    <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-xs leading-relaxed text-green-800">
                      当前处于开启状态，平台会在 debug_token 过期后自动切回关闭状态。
                    </div>
                  ) : null}

                  {isDataZoneDebugEnabled && dataZoneDebugMode?.corp_access_token ? (
                    <div className="space-y-2 rounded-xl border border-green-100 bg-green-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-bold text-green-900">企业 access token</div>
                        <div className="text-[10px] text-green-700">过期时间：{formatUnix(dataZoneDebugMode.corp_access_token_expires_at)}</div>
                      </div>
                      <div className="break-all rounded-lg border border-green-100 bg-white px-3 py-2 font-mono text-[11px] text-gray-700">
                        {dataZoneDebugMode.corp_access_token}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                    <Button variant="outline" className="bg-white text-xs font-bold" onClick={() => void loadDebugView()} disabled={isLoadingDebugView}>
                    {isLoadingDebugView ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      刷新状态
                    </Button>
                    {canCloseDataZoneDebugMode ? (
                      <Button
                        variant="outline"
                        className="bg-white text-xs font-bold"
                        onClick={() => void closeDataZoneDebugMode()}
                        disabled={isClosingDataZoneDebugMode || !managedDataZoneProgramID}
                      >
                        {isClosingDataZoneDebugMode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        关闭调试模式
                      </Button>
                    ) : null}
                    {canOpenDataZoneDebugMode ? (
                      <Button
                        className="bg-blue-600 text-xs font-bold shadow-sm hover:bg-blue-700"
                        onClick={() => void openDataZoneDebugMode()}
                        disabled={isOpeningDataZoneDebugMode || isDataZoneDebugLocked || !managedDataZoneProgramID}
                      >
                        {isOpeningDataZoneDebugMode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        开启调试模式
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="border-b border-gray-50 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold">
                      <KeyRound className="h-4 w-4 text-gray-700" /> 专区程序与密钥信息
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white text-xs font-semibold"
                      onClick={() => void runIntegrationCheck()}
                      disabled={isRunningCheck}
                    >
                      {isRunningCheck ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                      重新执行底层检查
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: "program_id", value: managedDataZoneProgramID || "-" },
                    { label: "sync_msg ability", value: (debugDataZone?.sync_msg_ability_id || "-").trim() || "-" },
                    { label: "callback_fetch ability", value: (debugDataZone?.callback_fetch_ability_id || "-").trim() || "-" },
                    { label: "log_level", value: Number(debugDataZone?.log_level || 0) > 0 ? String(debugDataZone?.log_level) : "-" },
                    { label: "public_key_ver", value: Number(debugDataZone?.public_key_ver || 0) > 0 ? String(debugDataZone?.public_key_ver) : "-" },
                    { label: "public_key_fingerprint", value: (debugDataZone?.public_key_fingerprint || "-").trim() || "-" },
                    { label: "public_key_set_at", value: formatUnix(debugDataZone?.public_key_set_at) },
                    { label: "private_key_stored", value: debugDataZone?.private_key_stored ? "是" : "否" },
                    { label: "private_key_encrypt_version", value: (debugDataZone?.private_key_encrypt_version || "-").trim() || "-" },
                    { label: "receive_callback_set_at", value: formatUnix(debugDataZone?.receive_callback_set_at) },
                    { label: "last_check_at", value: formatUnix(debugDataZone?.last_check_at) },
                    { label: "last_check_error", value: (debugDataZone?.last_check_error || "-").trim() || "-" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-gray-100 bg-white p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{item.label}</div>
                      <div className="mt-2 break-all font-mono text-xs text-gray-800">{item.value}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="border-b border-gray-50 p-6">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold">
                    <Shield className="h-4 w-4 text-gray-700" /> 原始 Capability 诊断
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  {capabilityDiagnostics.map((item) => {
                    const axis = item.axis
                    return (
                      <div key={item.key} className="rounded-2xl border border-gray-100 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-bold text-gray-900">{item.title}</div>
                          <Badge className={`${capabilityBadgeClass((axis?.status || "unknown").trim())} px-2 py-0.5 text-[10px] font-bold`}>
                            {capabilityStatusLabel((axis?.status || "unknown").trim())}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-3 text-[11px] text-gray-500 md:grid-cols-2 xl:grid-cols-4">
                          <div>blocked_reason：{capabilityReasonLabel((axis?.blocked_reason || "").trim()) || "-"}</div>
                          <div>last_checked_at：{formatDateTime((axis?.last_checked_at || "").trim())}</div>
                          <div>last_ready_at：{formatDateTime((axis?.last_ready_at || "").trim())}</div>
                          <div>last_error：{(axis?.last_error || "-").trim() || "-"}</div>
                        </div>
                        {item.meta.length > 0 ? (
                          <div className="mt-3 grid gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] text-gray-600 md:grid-cols-2 xl:grid-cols-3">
                            {item.meta.map((meta) => (
                              <div key={`${item.key}-${meta.label}`}>
                                <span className="text-gray-400">{meta.label}：</span>
                                <span className="break-all font-mono text-gray-700">{meta.value}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {item.detailsJSON ? (
                          <pre className="mt-3 overflow-x-auto rounded-xl border border-gray-100 bg-gray-50 p-3 text-[11px] leading-5 text-gray-700">{item.detailsJSON}</pre>
                        ) : null}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card className="border-gray-200 shadow-sm">
                  <CardHeader className="border-b border-gray-50 p-6">
                    <CardTitle className="text-sm font-bold text-gray-900">应用权限</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-6">
                    <div className="text-xs text-gray-600">已获取权限项：{integrationPermissions.length}</div>
                    {permissionTree.length === 0 ? (
                      <div className="text-xs text-gray-500">暂未获取权限明细</div>
                    ) : (
                      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                        {permissionTree.map((categoryNode) => (
                          <details key={categoryNode.category} open className="rounded border border-gray-100 bg-white">
                            <summary className="cursor-pointer list-none select-none border-b border-gray-50 px-3 py-2 text-xs font-bold text-gray-800">
                              {categoryNode.category}
                            </summary>
                            <div className="space-y-2 p-2">
                              {categoryNode.groups.map((groupNode) => (
                                <details key={`${categoryNode.category}-${groupNode.group}`} open className="rounded border border-gray-100 bg-gray-50/40">
                                  <summary className="cursor-pointer list-none select-none border-b border-gray-100 px-2 py-1.5 text-[11px] font-semibold text-gray-700">
                                    {groupNode.group}
                                  </summary>
                                  <div className="space-y-1.5 p-2">
                                    {groupNode.items.map((row) => (
                                      <div key={`${groupNode.group}-${row.code}`} className="rounded border border-gray-100 bg-white px-2 py-1.5">
                                        <div className="text-[11px] font-semibold text-gray-800">{renderPermissionDisplay(row.code)}</div>
                                        {typeof row.expire_time === "number" && row.expire_time > 0 ? (
                                          <div className="text-[10px] text-orange-600">到期：{formatUnix(row.expire_time)}</div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-sm">
                  <CardHeader className="border-b border-gray-50 p-6">
                    <CardTitle className="text-sm font-bold text-gray-900">应用管理员</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-6">
                    {integrationAdmins.length === 0 ? (
                      <div className="text-xs text-gray-500">暂无管理员数据，请重新执行底层检查。</div>
                    ) : (
                      integrationAdmins.map((item) => (
                        <div key={`${item.userid || ""}-${String(item.auth_type || 0)}`} className="flex items-center justify-between rounded-xl border border-gray-100 p-3">
                          <div className="text-xs font-semibold text-gray-800">{(item.userid || "-").trim() || "-"}</div>
                          <Badge className="bg-blue-100 px-1.5 py-0 text-[10px] text-blue-700 border-none">auth_type: {Number(item.auth_type || 0)}</Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Card className="border-gray-200 shadow-sm">
                  <CardHeader className="border-b border-gray-50 p-6">
                    <CardTitle className="text-sm font-bold text-gray-900">接口账号许可</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-6">
                    <div className="text-xs text-gray-600">
                      激活账号：{Number(integrationLicenseSummary?.active_total || 0)} / {Number(integrationLicenseSummary?.total || 0)}
                      {integrationLicenseSummary?.has_more ? "（还有更多）" : ""}
                    </div>
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {integrationLicenseAccounts.slice(0, 80).map((item) => (
                        <div key={`${item.userid || ""}-${String(item.active_time || 0)}`} className="rounded border border-gray-100 p-2">
                          <div className="text-[11px] font-semibold text-gray-800">{(item.userid || "-").trim() || "-"}</div>
                          <div className="text-[10px] text-gray-500">类型：{Number(item.type || 0)}</div>
                          <div className="text-[10px] text-gray-500">激活时间：{formatUnix(item.active_time)}</div>
                          <div className="text-[10px] text-gray-500">到期时间：{formatUnix(item.expire_time)}</div>
                        </div>
                      ))}
                      {integrationLicenseAccounts.length === 0 ? (
                        <div className="text-xs text-gray-500">暂无激活账号许可数据</div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-sm">
                  <CardHeader className="border-b border-gray-50 p-6">
                    <CardTitle className="text-sm font-bold text-gray-900">旧检查输出</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6">
                    <div>
                      <div className="mb-2 text-xs font-bold text-gray-900">permission_checks</div>
                      <div className="space-y-2">
                        {permissionChecks.length === 0 ? (
                          <div className="text-xs text-gray-500">暂无检查结果</div>
                        ) : permissionChecks.map((item) => (
                          <div key={(item.code || item.name || "").trim()} className="rounded-xl border border-gray-100 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-gray-900">{(item.name || item.code || "-").trim()}</div>
                              <Badge className={`${(item.status || "").trim() === "ok" || (item.status || "").trim() === "granted" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"} border-none px-1.5 py-0 text-[10px]`}>
                                {(item.status || "-").trim() || "-"}
                              </Badge>
                            </div>
                            <div className="mt-2 text-[11px] text-gray-500">影响：{(item.impact || "-").trim() || "-"}</div>
                            <div className="mt-1 text-[11px] text-gray-500">建议：{(item.suggestion || "-").trim() || "-"}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-xs font-bold text-gray-900">object_checks</div>
                      <div className="space-y-2">
                        {objectChecks.length === 0 ? (
                          <div className="text-xs text-gray-500">暂无检查结果</div>
                        ) : objectChecks.map((item) => (
                          <div key={(item.code || item.name || "").trim()} className="rounded-xl border border-gray-100 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-gray-900">{(item.name || item.code || "-").trim()}</div>
                              <Badge className={`${isObjectPassed((item.status || "").trim()) ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"} border-none px-1.5 py-0 text-[10px]`}>
                                {(item.status || "-").trim() || "-"}
                              </Badge>
                            </div>
                            <div className="mt-2 text-[11px] text-gray-500">摘要：{(item.summary || "-").trim() || "-"}</div>
                            <div className="mt-1 text-[11px] text-gray-500">影响：{(item.impact || "-").trim() || "-"}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 text-xs font-bold text-gray-900">capabilities</div>
                      <div className="space-y-2">
                        {(debugView?.capabilities || []).length === 0 ? (
                          <div className="text-xs text-gray-500">暂无检查结果</div>
                        ) : (debugView?.capabilities || []).map((item) => (
                          <div key={(item.code || item.name || "").trim()} className="rounded-xl border border-gray-100 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-gray-900">{(item.name || item.code || "-").trim()}</div>
                              <Badge className={`${item.available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} border-none px-1.5 py-0 text-[10px]`}>
                                {item.available ? "available" : "unavailable"}
                              </Badge>
                            </div>
                            <div className="mt-2 text-[11px] text-gray-500">reason：{(item.reason || "-").trim() || "-"}</div>
                            <div className="mt-1 text-[11px] text-gray-500">next_step：{(item.next_step || "-").trim() || "-"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="border-b border-gray-50 p-6">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold">
                    <Settings className="h-4 w-4 text-gray-700" /> 内部诊断入口
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-gray-900">{(toolbarDebugSwitch?.label || "显示工具栏调试入口").trim()}</div>
                      <div className="text-[11px] leading-relaxed text-gray-500">
                        {((toolbarDebugSwitch?.description || "").trim() || "仅控制平台内部工具栏诊断面板入口，不影响企业微信真实能力或数据专区官方调试模式。")}
                      </div>
                    </div>
                    <Switch
                      name="enable_toolbar_debug_entry"
                      checked={Boolean(toolbarDebugSwitch?.enabled)}
                      disabled={updatingDebugKey === "enable_toolbar_debug_entry"}
                      onCheckedChange={(checked) => {
                        void updateDebugSwitch("enable_toolbar_debug_entry", Boolean(checked))
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
              </>
              ) : null}
            </div>
          </TabsContent>
          </>
          ) : null}
        </div>
      </Tabs>

      <Dialog
        isOpen={isDebugAccessDialogOpen}
        onClose={closeDebugAccessDialog}
        title="进入调试与开发"
        className="max-w-[460px]"
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button variant="outline" onClick={closeDebugAccessDialog} disabled={isOpeningDebugAccess}>取消</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => void openDebugAccess()} disabled={isOpeningDebugAccess}>
              {isOpeningDebugAccess ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              进入
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-700">
            此入口仅用于平台联调与故障排查，不面向普通企业管理员开放。请输入平台提供的调试访问密钥。
          </div>
          <InlineFeedbackSlot message={debugAccessError} kind="error" />
          <div className="space-y-1.5">
            <label htmlFor="debug-access-secret" className="text-xs font-semibold text-gray-700">平台调试访问密钥</label>
            <Input
              id="debug-access-secret"
              name="debug_access_secret"
              type="password"
              value={debugAccessSecret}
              autoComplete="new-password"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="输入平台提供的密钥"
              onChange={(event) => {
                setDebugAccessSecret(event.target.value)
                setDebugAccessError("")
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void openDebugAccess()
                }
              }}
              disabled={isOpeningDebugAccess}
            />
          </div>
          <div className="text-[11px] leading-5 text-gray-500">
            进入后会建立一段短期有效的调试访问，会在到期后自动失效，也可以随时手动退出。
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={isCreateRoleOpen}
        onClose={closeCreateRoleDialog}
        title="新增角色"
        className="max-w-[560px]"
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button variant="outline" onClick={closeCreateRoleDialog} disabled={isCreatingRole}>取消</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => void submitCreateRole()} disabled={isCreatingRole}>
              {isCreatingRole ? "创建中..." : "创建角色"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <InlineFeedbackSlot message={createRoleError} kind="error" />
          <div className="space-y-1.5">
            <label htmlFor="create-role-name" className="text-xs font-semibold text-gray-700">角色名称</label>
            <Input
              id="create-role-name"
              name="role_name"
              value={createRoleName}
              maxLength={30}
              placeholder="例如：客服主管"
              onChange={(event) => {
                setCreateRoleName(event.target.value)
                setCreateRoleError("")
              }}
              disabled={isCreatingRole}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="create-role-description" className="text-xs font-semibold text-gray-700">角色说明</label>
            <Input
              id="create-role-description"
              name="description"
              value={createRoleDescription}
              maxLength={80}
              placeholder="说明该角色适用的人群和职责"
              onChange={(event) => {
                setCreateRoleDescription(event.target.value)
                setCreateRoleError("")
              }}
              disabled={isCreatingRole}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="create-role-template" className="text-xs font-semibold text-gray-700">初始权限</label>
            <select
              id="create-role-template"
              name="template_role"
              value={createRoleTemplate}
              onChange={(event) => {
                setCreateRoleTemplate(event.target.value)
                setCreateRoleError("")
              }}
              disabled={isCreatingRole}
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="blank">空白角色，创建后再配置权限</option>
              {(view?.roles || []).map((role) => {
                const roleKey = (role.role || "").trim()
                if (!roleKey) return null
                return (
                  <option key={roleKey} value={roleKey}>
                    复制“{(role.role_name || role.role || roleKey).trim()}”的权限
                  </option>
                )
              })}
            </select>
            <div className="text-[11px] text-gray-500">系统预设角色保持只读；如需调整权限，请创建自定义角色。</div>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={isRoleEditorOpen}
        onClose={closeRoleEditor}
        title={`编辑角色 · ${(editingRole?.role_name || editingRole?.role || "").trim()}`}
        className="max-w-[680px]"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <Button
              variant="destructive"
              onClick={() => void deleteEditingRole()}
              disabled={isDeletingRole || isSavingRole || Number(editingRole?.member_count || 0) > 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeletingRole ? "删除中..." : "删除角色"}
            </Button>
            <div className="flex gap-3">
            <Button variant="outline" onClick={closeRoleEditor} disabled={isSavingRole || isDeletingRole}>取消</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => void saveRolePermissions()} disabled={isSavingRole || isDeletingRole}>
              {isSavingRole ? "保存中..." : "保存角色"}
            </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <InlineFeedbackSlot message={roleEditorError} kind="error" />
          {Number(editingRole?.member_count || 0) > 0 ? (
            <div className="rounded-md border border-orange-100 bg-orange-50 px-3 py-2 text-xs text-orange-700">
              当前有 {Number(editingRole?.member_count || 0)} 位成员绑定该角色，删除前需要先调整成员角色。
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="edit-role-name" className="text-xs font-semibold text-gray-700">角色名称</label>
              <Input
                id="edit-role-name"
                name="role_name"
                value={editingRoleName}
                maxLength={30}
                onChange={(event) => {
                  setEditingRoleName(event.target.value)
                  setRoleEditorError("")
                }}
                disabled={isSavingRole || isDeletingRole}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-role-description" className="text-xs font-semibold text-gray-700">角色说明</label>
              <Input
                id="edit-role-description"
                name="description"
                value={editingRoleDescription}
                maxLength={80}
                onChange={(event) => {
                  setEditingRoleDescription(event.target.value)
                  setRoleEditorError("")
                }}
                disabled={isSavingRole || isDeletingRole}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-gray-700">平台内部权限点</div>
                <div className="text-[11px] text-gray-500">已选 {editingPermissions.length} 项，不等于企业微信后台权限。</div>
              </div>
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  id="permission-search"
                  name="permission_search"
                  value={permissionSearch}
                  onChange={(event) => setPermissionSearch(event.target.value)}
                  placeholder="搜索权限"
                  className="h-9 pl-8 text-xs"
                  disabled={isSavingRole || isDeletingRole}
                />
              </div>
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {permissionGroups.length === 0 ? (
                <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">没有匹配的权限点</div>
              ) : permissionGroups.map((group) => (
                <div key={group.group} className="rounded-lg border border-gray-100 bg-white">
                  <div className="border-b border-gray-50 px-3 py-2 text-xs font-bold text-gray-800">{group.group}</div>
                  <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2">
                    {group.permissions.map((perm) => {
                      const checked = editingPermissions.includes(perm)
                      const permissionInputID = `role-permission-${perm.replace(/[^a-zA-Z0-9_-]/g, "-")}`
                      return (
                        <label key={perm} htmlFor={permissionInputID} className={`flex min-h-14 items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs ${checked ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-white"}`}>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-gray-800">{renderInternalPermissionLabel(perm)}</span>
                            <span className="block truncate font-mono text-[10px] text-gray-500">{perm}</span>
                          </span>
                          <input
                            id={permissionInputID}
                            name="role_permissions"
                            type="checkbox"
                            checked={checked}
                            disabled={isSavingRole || isDeletingRole}
                            onChange={() => toggleEditingPermission(perm)}
                            className="h-3.5 w-3.5 shrink-0"
                          />
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
