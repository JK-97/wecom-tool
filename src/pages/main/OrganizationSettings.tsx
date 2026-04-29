import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs"
import {
  Settings, Users, Shield, CheckCircle2, RefreshCw,
  Plus, Globe, MessageSquare, User, ShieldAlert,
  AlertTriangle, Zap, Info, ExternalLink, ChevronRight, Loader2,
  Search, Trash2,
} from "lucide-react"
import { Switch } from "@/components/ui/Switch"
import { useEffect, useState } from "react"
import { normalizeErrorMessage } from "@/services/http"
import {
  executeOrganizationSettingsCommand,
  getOrganizationSettingsView,
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
import { WecomOpenDataName } from "@/components/wecom/WecomOpenDataName"
import muyuaiLogo from "@/assets/muyuai-logo.svg"

const ROLE_OPTIONS = [
  { key: "super_admin", label: "超级管理员" },
  { key: "admin", label: "销售主管" },
  { key: "staff", label: "一线销售" },
]

const SETTINGS_TABS = ["wecom", "org", "roles", "toolbar", "connectors", "debug"] as const
type SettingsTab = (typeof SETTINGS_TABS)[number]
type NoticeKind = "info" | "success" | "warning" | "error"
type NoticeScope = SettingsTab | "global"
type NoticeState = { scope: NoticeScope; kind: NoticeKind; message: string } | null

function resolveInitialSettingsTab(): SettingsTab {
  if (typeof window === "undefined") return "wecom"
  const params = new URLSearchParams(window.location.search)
  const tab = params.get("tab")
  if (SETTINGS_TABS.includes(tab as SettingsTab)) return tab as SettingsTab
  if (params.get("muyuai_connected") === "1") return "connectors"
  return "wecom"
}

function noticeClassName(kind: NoticeKind): string {
  switch (kind) {
    case "success":
      return "border-green-100 bg-green-50 text-green-700"
    case "warning":
      return "border-orange-100 bg-orange-50 text-orange-700"
    case "error":
      return "border-red-100 bg-red-50 text-red-700"
    default:
      return "border-blue-100 bg-blue-50 text-blue-700"
  }
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

export default function OrganizationSettings() {
  const [view, setView] = useState<OrganizationSettingsView | null>(null)
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>(() => resolveInitialSettingsTab())
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [isRunningCheck, setIsRunningCheck] = useState(false)
  const [notice, setNotice] = useState<NoticeState>(null)
  const [memberRoleDraft, setMemberRoleDraft] = useState<Record<string, string>>({})
  const [savingMemberUserID, setSavingMemberUserID] = useState("")
  const [connectorStatuses, setConnectorStatuses] = useState<Record<string, MuYuAIConnectorStatus | null>>({})
  const [isLoadingConnectors, setIsLoadingConnectors] = useState(false)
  const [connectorNotice, setConnectorNotice] = useState("")
  const [testingConnectorKey, setTestingConnectorKey] = useState("")
  const [refreshingConnectorKey, setRefreshingConnectorKey] = useState("")
  const [connectingConnectorKey, setConnectingConnectorKey] = useState("")

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
  const [isSyncingOrg, setIsSyncingOrg] = useState(false)
  const [updatingDebugKey, setUpdatingDebugKey] = useState("")
  const [isResettingDebug, setIsResettingDebug] = useState(false)

  const showNotice = (scope: NoticeScope, message: string, kind: NoticeKind = "info") => {
    const text = (message || "").trim()
    if (!text) {
      setNotice(null)
      return
    }
    setNotice({ scope, kind, message: text })
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
      setConnectorNotice(normalizeErrorMessage(error))
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

  useEffect(() => {
    void loadView()
    void loadConnectors()
  }, [])

  useEffect(() => {
    if (notice?.kind !== "success") return
    const timer = window.setTimeout(() => {
      setNotice((current) => (current === notice ? null : current))
    }, 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

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

  const syncOrgDirectory = async () => {
    try {
      setIsSyncingOrg(true)
      const message = await executeOrganizationSettingsCommand("sync_org_directory")
      showNotice("org", message || "组织目录同步已完成", "success")
      await loadView()
    } catch (error) {
      showNotice("org", normalizeErrorMessage(error), "error")
    } finally {
      setIsSyncingOrg(false)
    }
  }

  const updateDebugSwitch = async (key: string, enabled: boolean) => {
    try {
      setUpdatingDebugKey(key)
      const payload = JSON.stringify({ key, enabled })
      const message = await executeOrganizationSettingsCommand("update_debug_switch", payload)
      showNotice(key === "enable_toolbar_debug_entry" ? "toolbar" : "debug", message || "调试开关已更新", "success")
      await loadView()
    } catch (error) {
      showNotice(key === "enable_toolbar_debug_entry" ? "toolbar" : "debug", normalizeErrorMessage(error), "error")
    } finally {
      setUpdatingDebugKey("")
    }
  }

  const resetDebugSwitches = async () => {
    if (!window.confirm("确定要重置所有调试项吗？该操作会写入后端并立即生效。")) return
    try {
      setIsResettingDebug(true)
      const message = await executeOrganizationSettingsCommand("reset_debug_switches")
      showNotice("debug", message || "调试开关已重置", "success")
      await loadView()
    } catch (error) {
      showNotice("debug", normalizeErrorMessage(error), "error")
    } finally {
      setIsResettingDebug(false)
    }
  }

  const startConnectorOAuth = async (key: string) => {
    if (key !== "muyuai") {
      setConnectorNotice("该连接方式暂未开放")
      return
    }
    try {
      setConnectingConnectorKey(key)
      const returnURL = new URL(window.location.href)
      returnURL.searchParams.set("tab", "connectors")
      const start = await startMuYuAIOAuth(returnURL.toString())
      const authURL = (start.AuthorizeURL || start.authorize_url || start.authorization_url || "").trim()
      if (!authURL) {
        setConnectorNotice("暂时无法发起连接，请稍后再试")
        return
      }
      window.location.assign(authURL)
    } catch (error) {
      setConnectorNotice(normalizeErrorMessage(error))
    } finally {
      setConnectingConnectorKey("")
    }
  }

  const refreshConnector = async (key: string) => {
    if (key !== "muyuai") {
      setConnectorNotice("该连接方式暂不支持刷新")
      return
    }
    try {
      setRefreshingConnectorKey(key)
      await refreshMuYuAIConnection()
      setConnectorNotice("连接状态已更新，当前企业的授权关系保持不变")
      await loadConnectors()
    } catch (error) {
      setConnectorNotice(normalizeErrorMessage(error))
    } finally {
      setRefreshingConnectorKey("")
    }
  }

  const testConnector = async (key: string) => {
    if (key !== "muyuai") {
      setConnectorNotice("该连接方式暂不支持校验")
      return
    }
    try {
      setTestingConnectorKey(key)
      const result = await testMuYuAIConnection()
      const message = (result.Message || result.message || "").trim()
      setConnectorNotice(message || "连接校验通过，可以继续使用")
      await loadConnectors()
    } catch (error) {
      setConnectorNotice(normalizeErrorMessage(error))
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
    const role = (editingRole?.role || "").trim()
    if (!role || editingRole?.system_preset) {
      setRoleEditorError("当前角色不可删除")
      return
    }
    if (Number(editingRole.member_count || 0) > 0) {
      setRoleEditorError("该角色仍有成员绑定，请先调整成员角色后再删除")
      return
    }
    if (!window.confirm(`确定删除角色“${(editingRole.role_name || role).trim()}”吗？`)) return
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
    setNotice(null)
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
    if (!SETTINGS_TABS.includes(value as SettingsTab)) return
    const nextTab = value as SettingsTab
    if (activeSettingsTab === "roles" && nextTab !== "roles" && hasDirtyMemberRoleDraft()) {
      if (!window.confirm("成员角色还有未保存的修改，切换后将丢弃这些草稿。确定继续吗？")) return
      setMemberRoleDraft(buildMemberRoleDraft(view))
    }
    setActiveSettingsTab(nextTab)
    setNotice(null)
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    url.searchParams.set("tab", nextTab)
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`)
  }

  const integration = view?.integration
  const orgSync = view?.org_sync
  const appVisibility = view?.app_visibility
  const integrationAdmins = view?.integration_admins || []
  const integrationPermissions = view?.integration_permissions || []
  const integrationLicenseSummary = view?.integration_license_summary
  const integrationLicenseAccounts = view?.integration_license_accounts || []
  const permissionChecks = view?.permission_checks || []
  const objectChecks = view?.object_checks || []
  const permissionStatusByCode = new Map<string, string>(
    permissionChecks.map((item) => [((item.code || "").trim()), ((item.status || "").trim())]),
  )
  const objectByCode = new Map<string, { status: string; availableCount: number; totalCount: number }>(
    objectChecks.map((item) => [
      ((item.code || "").trim()),
      {
        status: ((item.status || "").trim()),
        availableCount: Number(item.available_count || 0),
        totalCount: Number(item.total_count || 0),
      },
    ]),
  )
  const capabilityCheckTree = (capabilityCode: string): Array<{ label: string; passed: boolean; count?: string }> => {
    const objectRow = (code: string): { status: string; count: string } => {
      const row = objectByCode.get(code)
      if (!row) return { status: "", count: "-" }
      return { status: row.status, count: `${row.availableCount}/${row.totalCount}` }
    }
    const sidebarPrereq = objectRow("sidebar_prerequisites")
    const kfAccounts = objectRow("kf_accounts")
    const appAdmin = objectRow("app_admin")
    const contactDomain = objectRow("contact_domain")
    const orgDirectory = objectRow("org_directory")
    switch ((capabilityCode || "").trim()) {
      case "kf_conversation":
        return [
          { label: "权限：微信客服能力", passed: isPermissionGranted(permissionStatusByCode.get("kf_account_access") || "") },
          { label: "对象：客服账号可用性", passed: isObjectPassed(kfAccounts.status), count: kfAccounts.count },
          { label: "对象：应用管理员检查", passed: isObjectPassed(appAdmin.status), count: appAdmin.count },
        ]
      case "contact_crm":
        return [
          { label: "权限：客户联系能力", passed: isPermissionGranted(permissionStatusByCode.get("contact_capability") || "") },
          { label: "对象：客户联系能力就绪", passed: isObjectPassed(contactDomain.status), count: contactDomain.count },
        ]
      case "toolbar_runtime":
        return [
          { label: "权限：侧边栏运行前提", passed: isPermissionGranted(permissionStatusByCode.get("sidebar_runtime") || "") },
          { label: "对象：工具栏/JSSDK 前提", passed: isObjectPassed(sidebarPrereq.status), count: sidebarPrereq.count },
        ]
      case "jssdk_runtime":
        return [
          { label: "权限：JSSDK 运行能力", passed: isPermissionGranted(permissionStatusByCode.get("jssdk_runtime") || "") },
          { label: "对象：工具栏/JSSDK 前提", passed: isObjectPassed(sidebarPrereq.status), count: sidebarPrereq.count },
        ]
      case "org_sync":
        return [
          { label: "权限：通讯录/组织同步能力", passed: isPermissionGranted(permissionStatusByCode.get("org_sync") || "") },
          { label: "对象：通讯录与组织目录", passed: isObjectPassed(orgDirectory.status), count: orgDirectory.count },
        ]
      default:
        return []
    }
  }
  const issueItems = (() => {
    const out: Array<{ kind: "permission" | "object"; code: string; name: string; status: string; summary: string; suggestion: string; count?: string }> = []
    for (const item of permissionChecks) {
      const status = (item.status || "").trim()
      if (status === "granted") continue
      out.push({
        kind: "permission",
        code: (item.code || "").trim(),
        name: (item.name || item.code || "-").trim(),
        status,
        summary: (item.impact || "-").trim(),
        suggestion: (item.suggestion || "-").trim(),
      })
    }
    for (const item of objectChecks) {
      const status = (item.status || "").trim()
      if (status === "ok") continue
      out.push({
        kind: "object",
        code: (item.code || "").trim(),
        name: (item.name || item.code || "-").trim(),
        status,
        summary: (item.summary || "-").trim(),
        suggestion: (item.suggestion || "-").trim(),
        count: `${Number(item.available_count || 0)}/${Number(item.total_count || 0)}`,
      })
    }
    return out
  })()
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
  const toolbarDebugSwitch = (view?.debug_switches || []).find((item) => (item.key || "").trim() === "enable_toolbar_debug_entry")
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
  const visibleNotice = notice && (notice.scope === "global" || notice.scope === activeSettingsTab) ? notice : null

  return (
    <div className="flex min-h-full flex-col bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">组织与设置</h2>
        <p className="text-sm text-gray-500 mt-1">查看企业微信集成状态，并管理平台内部组织权限与调试配置</p>
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
            <TabsTrigger value="debug" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 h-14 text-sm font-semibold transition-all">
              调试与开发开关
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="p-8 bg-gray-50/20">
          {!hasLoaded && isLoading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                正在加载企业微信集成检查与组织权限数据...
              </div>
            </div>
          ) : null}
          {isLoading ? (
            <div className="mb-6 rounded-md border border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-700">加载组织设置中...</div>
          ) : null}
          {visibleNotice ? (
            <div className={`mb-6 rounded-md border px-4 py-2 text-xs ${noticeClassName(visibleNotice.kind)}`}>{visibleNotice.message}</div>
          ) : null}

          {hasLoaded ? (
          <>
          <TabsContent value="wecom" className="mt-0 space-y-8 max-w-3xl">
            <div className={`flex items-center justify-between p-5 border rounded-xl shadow-sm ${
              (integration?.health_status || "").trim() === "healthy"
                ? "bg-green-50 border-green-100"
                : "bg-orange-50 border-orange-100"
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-inner ${
                  (integration?.health_status || "").trim() === "healthy"
                    ? "bg-green-100"
                    : "bg-orange-100"
                }`}>
                  {(integration?.health_status || "").trim() === "healthy" ? (
                    <CheckCircle2 className="w-7 h-7 text-green-600" />
                  ) : (
                    <ShieldAlert className="w-7 h-7 text-orange-600" />
                  )}
                </div>
                <div>
                  <div className="text-base font-bold text-gray-900">企业微信集成检查</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    CorpID: {(integration?.corp_id || "-").trim() || "-"} |
                    授权状态: {(integration?.authorization_status || "-").trim() || "-"} |
                    健康度: {(integration?.health_status || "-").trim() || "-"}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="bg-white font-semibold" onClick={() => void runIntegrationCheck()} disabled={isRunningCheck}>
                {isRunningCheck ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                重新执行检查
              </Button>
            </div>

            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-400" /> 企业 ID (CorpID)
                  </label>
                  <Input value={(integration?.corp_id || "").trim()} disabled className="bg-gray-50 border-gray-200 font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-gray-400" /> 授权有效性
                  </label>
                  <Input
                    value={`${integration?.authorization_valid ? "有效" : "无效"} / ${(integration?.authorization_status || "-").trim() || "-"}`}
                    disabled
                    className="bg-gray-50 border-gray-200 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" /> 企业名称
                </label>
                <Input value={(integration?.corp_name || "-").trim() || "-"} disabled className="bg-gray-50 border-gray-200" />
                <p className="text-[11px] text-gray-400">最近检查时间：{formatDateTime((integration?.last_checked_at || "").trim())}</p>
              </div>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="p-5 border-b border-gray-50">
                  <CardTitle className="text-sm font-bold text-gray-900">能力检查</CardTitle>
                </CardHeader>
                <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(view?.capabilities || []).map((item) => (
                    <div key={(item.code || item.name || "").trim()} className="group relative rounded-lg border border-gray-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-bold text-gray-900">{(item.name || item.code || "-").trim()}</div>
                        {item.available ? (
                          <Badge className="bg-green-100 text-green-700 border-none text-[10px] px-1.5 py-0">可用</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 border-none text-[10px] px-1.5 py-0">不可用</Badge>
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-gray-600">{(item.reason || "-").trim()}</div>
                      <div className="mt-1 text-[10px] text-gray-500">影响：{(item.impact_scope || "-").trim()}</div>
                      {item.available ? null : (
                        <div className="mt-0.5 text-[10px] text-blue-600">建议：{(item.next_step || "-").trim()}</div>
                      )}
                      {capabilityCheckTree((item.code || "").trim()).length > 0 ? (
                        <div className="pointer-events-none absolute left-3 top-[calc(100%+8px)] z-20 hidden min-w-[260px] rounded-lg border border-gray-200 bg-white p-2 shadow-lg group-hover:block">
                          <div className="mb-1 text-[10px] font-bold text-gray-700">检查明细</div>
                          <div className="space-y-1">
                            {capabilityCheckTree((item.code || "").trim()).map((row) => (
                              <div key={`${(item.code || "").trim()}-${row.label}`} className="flex items-center justify-between gap-2 text-[10px]">
                                <span className="text-gray-600">{row.label}{row.count ? `（${row.count}）` : ""}</span>
                                {row.passed ? (
                                  <Badge className="bg-green-100 text-green-700 border-none text-[9px] px-1.5 py-0">通过</Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-700 border-none text-[9px] px-1.5 py-0">不通过</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="p-5 border-b border-gray-50">
                  <CardTitle className="text-sm font-bold text-gray-900">问题清单</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  {issueItems.length === 0 ? (
                    <div className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">当前无异常，权限与业务对象均已就绪。</div>
                  ) : issueItems.map((item) => (
                    <div key={`${item.kind}-${item.code}`} className="rounded-lg border border-gray-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-bold text-gray-900">{item.name}</div>
                        <div className="flex items-center gap-2">
                          {item.count ? (
                            <Badge className="bg-gray-100 text-gray-600 border-none text-[9px] px-1.5 py-0">{item.count}</Badge>
                          ) : null}
                          {(item.status || "").trim() === "partial" || (item.status || "").trim() === "warning" ? (
                            <Badge className="bg-orange-100 text-orange-700 border-none text-[10px] px-1.5 py-0">待完善</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-none text-[10px] px-1.5 py-0">异常</Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 text-[11px] text-gray-600">{item.summary}</div>
                      <div className="mt-0.5 text-[10px] text-blue-600">建议：{item.suggestion}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="p-5 border-b border-gray-50">
                  <CardTitle className="text-sm font-bold text-gray-900">应用管理员</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-2">
                  {integrationAdmins.length === 0 ? (
                    <div className="text-xs text-gray-500">暂无管理员数据，请重试集成检查</div>
                  ) : integrationAdmins.map((item) => (
                    <div key={`${item.userid || ""}-${String(item.auth_type || 0)}`} className="rounded-lg border border-gray-100 p-3 flex items-center justify-between">
                      <div className="text-xs text-gray-800 font-semibold">{(item.userid || "-").trim() || "-"}</div>
                      <Badge className="bg-blue-100 text-blue-700 border-none text-[10px] px-1.5 py-0">auth_type: {Number(item.auth_type || 0)}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="p-5 border-b border-gray-50">
                  <CardTitle className="text-sm font-bold text-gray-900">应用权限</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  <div className="text-xs text-gray-600">已获取权限项：{integrationPermissions.length}</div>
                  {permissionTree.length === 0 ? (
                    <div className="text-xs text-gray-500">暂未获取权限明细</div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto pr-1 space-y-2">
                      {permissionTree.map((categoryNode) => (
                        <details key={categoryNode.category} open className="rounded border border-gray-100 bg-white">
                          <summary className="cursor-pointer list-none select-none px-3 py-2 text-xs font-bold text-gray-800 border-b border-gray-50">
                            {categoryNode.category}
                          </summary>
                          <div className="p-2 space-y-2">
                            {categoryNode.groups.map((groupNode) => (
                              <details key={`${categoryNode.category}-${groupNode.group}`} open className="rounded border border-gray-100 bg-gray-50/40">
                                <summary className="cursor-pointer list-none select-none px-2 py-1.5 text-[11px] font-semibold text-gray-700 border-b border-gray-100">
                                  {groupNode.group}
                                </summary>
                                <div className="p-2 space-y-1.5">
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
                <CardHeader className="p-5 border-b border-gray-50">
                  <CardTitle className="text-sm font-bold text-gray-900">接口账号许可</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  <div className="text-xs text-gray-600">
                    激活账号：{Number(integrationLicenseSummary?.active_total || 0)} / {Number(integrationLicenseSummary?.total || 0)}
                    {integrationLicenseSummary?.has_more ? "（还有更多）" : ""}
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
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
                <CardHeader className="p-5 border-b border-gray-50">
                  <CardTitle className="text-sm font-bold text-gray-900">修复建议</CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <ul className="space-y-2">
                    {(view?.recommendations || []).map((item, index) => (
                      <li key={`${item}-${index}`} className="text-xs text-blue-700 leading-relaxed">• {item}</li>
                    ))}
                    {(view?.recommendations || []).length === 0 ? (
                      <li className="text-xs text-gray-500">当前暂无修复建议</li>
                    ) : null}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="outline" className="font-semibold" onClick={() => void loadView()}>刷新结果</Button>
              <Button className="bg-blue-600 hover:bg-blue-700 px-10 font-semibold shadow-sm transition-all" onClick={() => void runIntegrationCheck()} disabled={isRunningCheck}>
                执行全量检查
              </Button>
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
                  onClick={() => void syncOrgDirectory()}
                  disabled={isSyncingOrg}
                >
                  {isSyncingOrg ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  {isSyncingOrg ? "同步中..." : "立即手动同步"}
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
                          <WecomOpenDataName
                            userid={userID}
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

              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="p-6 border-b border-gray-50">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-600" /> 工具栏调试入口
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between rounded-xl border border-gray-100 bg-white p-4">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-gray-900">在工具栏开启调试窗入口</div>
                      <div className="text-[10px] text-gray-500">
                        开启后会在工具栏页面显示调试入口（用于客户端联调），关闭后隐藏。
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

              {connectorNotice ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700 transition-all">
                  {connectorNotice}
                </div>
              ) : null}

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
            <div className="max-w-4xl space-y-8">
              <div className="p-5 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-orange-900">调试模式说明</div>
                  <p className="text-xs text-orange-700 mt-1 leading-relaxed">
                    调试开关属于平台运行时配置，所有开关变更都会写入后端并持久化。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-600" /> 实验室功能 (Lab Features)
                  </h4>
                  <div className="space-y-4">
                    {(view?.debug_switches || []).map((item) => (
                      <div key={(item.key || item.label || "").trim()} className="flex items-start justify-between p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-gray-900">{(item.label || item.key || "未命名开关").trim()}</div>
                          <div className="text-[10px] text-gray-500">{(item.description || "-").trim()}</div>
                        </div>
                        <Switch name={`debug-switch-${(item.key || "").trim()}`} checked={Boolean(item.enabled)} onCheckedChange={(checked) => {
                          const key = (item.key || "").trim()
                          if (!key) return
                          void updateDebugSwitch(key, Boolean(checked))
                        }} disabled={updatingDebugKey === (item.key || "").trim()} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600" /> 联调辅助与 FAQ
                  </h4>
                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-5 space-y-5">
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-gray-800">当前环境标识</div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-700 border-none text-[10px]">{((integration?.app_mode || "third_party_provider").trim() || "third_party_provider").toUpperCase()}</Badge>
                        <span className="text-[10px] text-gray-400 font-mono">last-check: {formatDateTime((integration?.last_checked_at || "").trim())}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-gray-800">快速联调入口</div>
                      <div className="space-y-2">
                        <a href="/sidebar/kf" target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-white px-3 text-[10px] font-bold text-gray-700 hover:bg-gray-100">
                          打开客服工具栏入口 <ExternalLink className="w-3 h-3 ml-1.5" />
                        </a>
                        <div className="rounded-md border border-gray-100 bg-white px-3 py-2 text-[10px] leading-relaxed text-gray-500">
                          JSSDK 日志请在浏览器开发者工具控制台查看，页面内不再用提示条模拟入口。
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-200 space-y-3">
                      <div className="text-xs font-bold text-gray-800">常见问题</div>
                      <ul className="space-y-2">
                        {(view?.recommendations || []).slice(0, 3).map((item) => (
                          <li key={item} className="text-[10px] text-blue-600 flex items-center gap-1.5">
                            <ChevronRight className="w-3 h-3" /> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                <Button variant="outline" className="text-xs font-bold h-9" onClick={() => void resetDebugSwitches()} disabled={isResettingDebug}>
                  {isResettingDebug ? "重置中..." : "重置所有调试项"}
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700 px-8 text-xs font-bold h-9 shadow-sm" onClick={() => void loadView()} disabled={isLoading}>
                  {isLoading ? "刷新中..." : "刷新环境视图"}
                </Button>
              </div>
            </div>
          </TabsContent>
          </>
          ) : null}
        </div>
      </Tabs>

      <Dialog
        isOpen={isCreateRoleOpen}
        onClose={() => {
          if (isCreatingRole) return
          setIsCreateRoleOpen(false)
          setCreateRoleError("")
        }}
        title="新增角色"
        className="max-w-[560px]"
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button variant="outline" onClick={() => setIsCreateRoleOpen(false)} disabled={isCreatingRole}>取消</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => void submitCreateRole()} disabled={isCreatingRole}>
              {isCreatingRole ? "创建中..." : "创建角色"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {createRoleError ? (
            <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{createRoleError}</div>
          ) : null}
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
        onClose={() => {
          if (isSavingRole || isDeletingRole) return
          setIsRoleEditorOpen(false)
          setEditingRole(null)
          setEditingRoleName("")
          setEditingRoleDescription("")
          setEditingPermissions([])
          setPermissionSearch("")
          setRoleEditorError("")
        }}
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
            <Button variant="outline" onClick={() => {
              if (isSavingRole || isDeletingRole) return
              setIsRoleEditorOpen(false)
              setEditingRole(null)
              setEditingRoleName("")
              setEditingRoleDescription("")
              setEditingPermissions([])
              setPermissionSearch("")
              setRoleEditorError("")
            }} disabled={isSavingRole || isDeletingRole}>取消</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => void saveRolePermissions()} disabled={isSavingRole || isDeletingRole}>
              {isSavingRole ? "保存中..." : "保存角色"}
            </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {roleEditorError ? (
            <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{roleEditorError}</div>
          ) : null}
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
