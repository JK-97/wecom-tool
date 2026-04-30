import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { CustomerContactSyncPanel } from "@/components/crm/CustomerContactSyncPanel"
import { CRMTablePagination } from "@/components/crm/CRMTablePagination"
import { WecomOpenDataName } from "@/components/wecom/WecomOpenDataName"
import { usePageFeedback } from "@/components/ui/PageFeedback"
import { useAuth } from "@/context/AuthContext"
import { APIRequestError, normalizeErrorMessage } from "@/services/http"
import {
  buildGroupChatDetailFromListRow,
  getGroupChat,
  listGroupChats,
  type CustomerGroupChat,
  type CustomerGroupChatAdmin,
  type CustomerGroupChatMember,
  type GetGroupChatData,
} from "@/services/groupChatService"
import { cn } from "@/lib/utils"

type GroupDetailTab = "overview" | "members" | "sop" | "risk"
type GroupMemberFilter = "all" | "internal" | "external" | "admin"
type GroupSortMode = "default" | "member_desc" | "member_asc"

const DEFAULT_GROUP_PAGE_SIZE = 20
const GROUP_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function readPositiveNumber(value: string | null, fallback: number): number {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

function formatDateTime(value?: string): string {
  const text = (value || "").trim()
  if (!text) return "-"
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) return text
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false })
}

function formatUnixSeconds(value?: number): string {
  const seconds = Number(value || 0)
  if (!Number.isFinite(seconds) || seconds <= 0) return "-"
  return new Date(seconds * 1000).toLocaleString("zh-CN", { hour12: false })
}

function groupTitle(group?: CustomerGroupChat | null): string {
  const name = (group?.name || "").trim()
  if (name) return name
  const chatID = (group?.chat_id || "").trim()
  if (!chatID) return "未命名客户群"
  return `客户群 ${chatID.slice(-6)}`
}

function groupStatusMeta(status?: number): { label: string; className: string } {
  const value = typeof status === "number" && Number.isFinite(status) ? Number(status) : 0
  if (value === 0) return { label: "正常", className: "bg-green-50 text-green-700 border-green-200" }
  if (value === 1) return { label: "群主已离职", className: "bg-orange-50 text-orange-700 border-orange-200" }
  if (value === 2) return { label: "离职继承中", className: "bg-orange-50 text-orange-700 border-orange-200" }
  if (value === 3) return { label: "离职继承完成", className: "bg-gray-100 text-gray-700 border-gray-200" }
  return { label: `状态 ${value}`, className: "bg-gray-100 text-gray-700 border-gray-200" }
}

function groupStatusValue(status?: number): string {
  const value = typeof status === "number" && Number.isFinite(status) ? Number(status) : 0
  return String(value)
}

function memberTypeLabel(type?: number): string {
  switch (Number(type || 0)) {
    case 1:
      return "企业成员"
    case 2:
      return "外部联系人"
    default:
      return "成员"
  }
}

function joinSceneLabel(scene?: number): string {
  const value = Number(scene || 0)
  if (value <= 0) return "-"
  return `入群方式 ${value}`
}

function displayMemberName(member: CustomerGroupChatMember): string {
  return (
    (member.group_nickname || "").trim() ||
    (member.name || "").trim() ||
    (member.userid || "").trim() ||
    (member.unionid || "").trim() ||
    "未命名成员"
  )
}

function isInternalUserID(userid?: string): boolean {
  const text = (userid || "").trim()
  if (!text) return false
  return !text.startsWith("wm") && !text.startsWith("wo")
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2">
      <div className="text-[11px] font-medium text-gray-500">{label}</div>
      <div className="mt-1 min-w-0 text-sm font-medium text-gray-900">{children}</div>
    </div>
  )
}

function OwnerName({ userid, fallback }: { userid?: string; fallback?: string }) {
  const auth = useAuth()
  const safeUserID = (userid || "").trim()
  if (!safeUserID) return <span className="text-gray-500">-</span>
  return (
    <WecomOpenDataName
      userid={safeUserID}
      corpId={auth.corp?.id}
      fallback={(fallback || "").trim() || safeUserID}
      className="truncate"
    />
  )
}

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: "default" | "blue" | "green" | "orange" | "red"
}) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardContent className="p-4">
        <div className="text-xs font-medium text-gray-500">{label}</div>
        <div
          className={cn(
            "mt-1 text-2xl font-bold",
            tone === "blue" ? "text-blue-700" : "",
            tone === "green" ? "text-green-700" : "",
            tone === "orange" ? "text-orange-700" : "",
            tone === "red" ? "text-red-600" : "",
            tone === "default" ? "text-gray-900" : "",
          )}
        >
          {value}
        </div>
        {hint ? <div className="mt-1 text-xs text-gray-400">{hint}</div> : null}
      </CardContent>
    </Card>
  )
}

function EmptyOperationCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/70 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-gray-400 ring-1 ring-gray-200">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          <div className="mt-1 text-sm leading-6 text-gray-500">{description}</div>
        </div>
      </div>
    </div>
  )
}

export default function GroupDetail() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { showFeedback } = usePageFeedback()
  const auth = useAuth()
  const selectedChatID = (searchParams.get("chat_id") || "").trim()

  const [groups, setGroups] = useState<CustomerGroupChat[]>([])
  const [totalGroups, setTotalGroups] = useState(0)
  const [query, setQuery] = useState((searchParams.get("query") || "").trim())
  const [ownerFilter, setOwnerFilter] = useState((searchParams.get("owner_userid") || "").trim())
  const [statusFilter, setStatusFilter] = useState((searchParams.get("status") || "").trim())
  const [memberSort, setMemberSort] = useState<GroupSortMode>(
    searchParams.get("sort") === "member_desc" || searchParams.get("sort") === "member_asc"
      ? (searchParams.get("sort") as GroupSortMode)
      : "default",
  )
  const [page, setPage] = useState(readPositiveNumber(searchParams.get("page"), 1))
  const [pageSize, setPageSize] = useState(() => {
    const value = readPositiveNumber(searchParams.get("page_size"), DEFAULT_GROUP_PAGE_SIZE)
    return GROUP_PAGE_SIZE_OPTIONS.includes(value) ? value : DEFAULT_GROUP_PAGE_SIZE
  })
  const [isLoadingGroups, setIsLoadingGroups] = useState(false)
  const [syncStatusRefreshKey, setSyncStatusRefreshKey] = useState(0)
  const [groupError, setGroupError] = useState("")

  const [detail, setDetail] = useState<GetGroupChatData | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState("")
  const [activeTab, setActiveTab] = useState<GroupDetailTab>("overview")
  const [memberFilter, setMemberFilter] = useState<GroupMemberFilter>("all")

  const replaceURL = useCallback(
    (patch?: { chatID?: string | null; page?: number; pageSize?: number }) => {
      const next = new URLSearchParams(searchParams)
      const nextPage = patch?.page ?? page
      const nextPageSize = patch?.pageSize ?? pageSize
      const nextChatID = patch?.chatID

      if (nextChatID === null) {
        next.delete("chat_id")
      } else if (typeof nextChatID === "string" && nextChatID.trim()) {
        next.set("chat_id", nextChatID.trim())
      }
      if (query.trim()) next.set("query", query.trim())
      else next.delete("query")
      if (ownerFilter.trim()) next.set("owner_userid", ownerFilter.trim())
      else next.delete("owner_userid")
      if (statusFilter.trim()) next.set("status", statusFilter.trim())
      else next.delete("status")
      if (memberSort !== "default") next.set("sort", memberSort)
      else next.delete("sort")
      if (nextPage > 1) next.set("page", String(nextPage))
      else next.delete("page")
      if (nextPageSize !== DEFAULT_GROUP_PAGE_SIZE) next.set("page_size", String(nextPageSize))
      else next.delete("page_size")
      if (next.toString() !== searchParams.toString()) {
        setSearchParams(next, { replace: true })
      }
    },
    [memberSort, ownerFilter, page, pageSize, query, searchParams, setSearchParams, statusFilter],
  )

  useEffect(() => {
    replaceURL()
  }, [memberSort, ownerFilter, page, pageSize, query, replaceURL, statusFilter])

  const fetchGroups = useCallback(async () => {
    try {
      setIsLoadingGroups(true)
      setGroupError("")
      const data = await listGroupChats({ page, page_size: pageSize })
      const rows = data?.group_chats || []
      setGroups(rows)
      const total = Number(data?.total || 0)
      setTotalGroups(Number.isFinite(total) && total >= 0 ? total : rows.length)
    } catch (error) {
      const message = normalizeErrorMessage(error)
      setGroupError(message)
      setGroups([])
      setTotalGroups(0)
      showFeedback({ kind: "error", message })
    } finally {
      setIsLoadingGroups(false)
      setSyncStatusRefreshKey((value) => value + 1)
    }
  }, [page, pageSize, showFeedback])

  const fetchDetail = useCallback(
    async (chatID: string) => {
      const safeChatID = chatID.trim()
      if (!safeChatID) return
      try {
        setIsLoadingDetail(true)
        setDetailError("")
        const data = await getGroupChat(safeChatID)
        setDetail(data)
      } catch (error) {
        const fallback = buildGroupChatDetailFromListRow(
          groups.find((group) => (group.chat_id || "").trim() === safeChatID) || null,
        )
        if (error instanceof APIRequestError && error.status === 404 && fallback) {
          setDetail(fallback)
          setDetailError("")
          showFeedback({ kind: "warning", message: "暂未同步到完整群资料，已先展示列表中的群信息。" })
          return
        }
        const message = normalizeErrorMessage(error)
        setDetailError(message)
        setDetail(null)
        showFeedback({ kind: "error", message })
      } finally {
        setIsLoadingDetail(false)
      }
    },
    [groups, showFeedback],
  )

  useEffect(() => {
    void fetchGroups()
  }, [fetchGroups])

  useEffect(() => {
    setActiveTab("overview")
    setMemberFilter("all")
    if (!selectedChatID) {
      setDetail(null)
      setDetailError("")
      return
    }
    void fetchDetail(selectedChatID)
  }, [fetchDetail, selectedChatID])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalGroups / pageSize))
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, pageSize, totalGroups])

  const ownerOptions = useMemo(() => {
    const owners = new Set<string>()
    groups.forEach((group) => {
      const owner = (group.owner_userid || "").trim()
      if (owner) owners.add(owner)
    })
    return Array.from(owners).sort((a, b) => a.localeCompare(b, "zh-CN"))
  }, [groups])

  const statusOptions = useMemo(() => {
    const values = new Map<string, string>()
    groups.forEach((group) => {
      const value = groupStatusValue(group.status)
      values.set(value, groupStatusMeta(group.status).label)
    })
    return Array.from(values.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [groups])

  const filteredGroups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const owner = ownerFilter.trim()
    const status = statusFilter.trim()
    const rows = groups.filter((group) => {
      if (owner && (group.owner_userid || "").trim() !== owner) return false
      if (status && groupStatusValue(group.status) !== status) return false
      if (!keyword) return true
      return [group.name, group.chat_id, group.owner_userid].some((value) =>
        (value || "").toLowerCase().includes(keyword),
      )
    })
    if (memberSort === "member_desc") {
      return [...rows].sort(
        (a, b) =>
          Number(b.member_count || 0) - Number(a.member_count || 0) ||
          groupTitle(a).localeCompare(groupTitle(b), "zh-CN"),
      )
    }
    if (memberSort === "member_asc") {
      return [...rows].sort(
        (a, b) =>
          Number(a.member_count || 0) - Number(b.member_count || 0) ||
          groupTitle(a).localeCompare(groupTitle(b), "zh-CN"),
      )
    }
    return rows
  }, [groups, memberSort, ownerFilter, query, statusFilter])

  const activeGroup =
    detail?.group_chat || groups.find((group) => (group.chat_id || "").trim() === selectedChatID) || null
  const activeStatus = groupStatusMeta(activeGroup?.status)
  const members = detail?.members || []
  const admins = detail?.admins || []
  const adminUserIDs = useMemo(
    () => new Set(admins.map((admin) => (admin.userid || "").trim()).filter(Boolean)),
    [admins],
  )
  const memberCounts = useMemo(() => {
    let internal = 0
    let external = 0
    let admin = 0
    members.forEach((member) => {
      const userID = (member.userid || "").trim()
      if (Number(member.type || 0) === 1) internal += 1
      if (Number(member.type || 0) === 2) external += 1
      if (userID && adminUserIDs.has(userID)) admin += 1
    })
    return { all: members.length, internal, external, admin }
  }, [adminUserIDs, members])
  const filteredMembers = useMemo(() => {
    if (memberFilter === "internal") return members.filter((member) => Number(member.type || 0) === 1)
    if (memberFilter === "external") return members.filter((member) => Number(member.type || 0) === 2)
    if (memberFilter === "admin") {
      return members.filter((member) => {
        const userID = (member.userid || "").trim()
        return userID !== "" && adminUserIDs.has(userID)
      })
    }
    return members
  }, [adminUserIDs, memberFilter, members])

  const totalPages = Math.max(1, Math.ceil(totalGroups / pageSize))
  const startIndex = totalGroups === 0 ? 0 : (page - 1) * pageSize + 1
  const endIndex = totalGroups === 0 ? 0 : Math.min(totalGroups, (page - 1) * pageSize + groups.length)
  const hasGroupFilters =
    query.trim() !== "" || ownerFilter.trim() !== "" || statusFilter.trim() !== "" || memberSort !== "default"

  const openGroup = (group: CustomerGroupChat) => {
    const chatID = (group.chat_id || "").trim()
    if (!chatID) return
    setDetail(null)
    replaceURL({ chatID })
  }

  const closeGroup = () => {
    replaceURL({ chatID: null })
  }

  const refreshPageData = async () => {
    await fetchGroups()
    if (selectedChatID) {
      await fetchDetail(selectedChatID)
    }
  }

  const clearFilters = () => {
    setQuery("")
    setOwnerFilter("")
    setStatusFilter("")
    setMemberSort("default")
    setPage(1)
  }

  const renderMembersTable = () => {
    if (members.length === 0) {
      return (
        <EmptyState
          icon={Users}
          title="暂无成员明细"
          description="完整群资料同步完成后，会在这里展示成员和管理员。"
          className="min-h-[260px]"
        />
      )
    }
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all", label: `全部 ${memberCounts.all}` },
            { value: "internal", label: `企业成员 ${memberCounts.internal}` },
            { value: "external", label: `外部联系人 ${memberCounts.external}` },
            { value: "admin", label: `管理员 ${memberCounts.admin}` },
          ].map((item) => (
            <Button
              key={item.value}
              type="button"
              variant={memberFilter === item.value ? "default" : "outline"}
              size="sm"
              className={memberFilter === item.value ? "" : "text-gray-600"}
              onClick={() => setMemberFilter(item.value as GroupMemberFilter)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        {filteredMembers.length === 0 ? (
          <EmptyState icon={Users} title="没有匹配的成员" description="可以切换成员类型后再查看。" className="min-h-[220px]" />
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
                <tr>
                  <th className="border-b border-gray-100 px-4 py-3">成员</th>
                  <th className="border-b border-gray-100 px-4 py-3">类型</th>
                  <th className="border-b border-gray-100 px-4 py-3">入群时间</th>
                  <th className="border-b border-gray-100 px-4 py-3">邀请人</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMembers.map((member, index) => {
                  const userID = (member.userid || "").trim()
                  const invitor = (member.invitor_userid || "").trim()
                  const isAdmin = userID !== "" && adminUserIDs.has(userID)
                  return (
                    <tr key={`${userID || member.unionid || member.name || "member"}-${index}`} className="hover:bg-blue-50/30">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">
                            {Number(member.type || 0) === 1 && isInternalUserID(userID) ? (
                              <WecomOpenDataName
                                userid={userID}
                                corpId={auth.corp?.id}
                                fallback={displayMemberName(member)}
                                className="truncate"
                              />
                            ) : (
                              <span>{displayMemberName(member)}</span>
                            )}
                          </div>
                          <div className="mt-0.5 max-w-[260px] truncate text-xs text-gray-400">
                            {userID || member.unionid || "-"}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                            {memberTypeLabel(member.type)}
                          </Badge>
                          {isAdmin ? (
                            <Badge variant="outline" className="border-blue-200 bg-blue-50 px-2 py-0 text-[10px] text-blue-700">
                              管理员
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700">{formatUnixSeconds(member.join_time)}</div>
                        <div className="mt-0.5 text-xs text-gray-400">{joinSceneLabel(member.join_scene)}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {invitor ? <WecomOpenDataName userid={invitor} corpId={auth.corp?.id} fallback={invitor} className="truncate" /> : "-"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  const renderGroupList = () => (
    <div className="flex h-full flex-col bg-[#F5F7FA]">
      <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">群运营</h2>
              <Badge variant="secondary" className="px-2 py-0 text-[11px]">
                共 {totalGroups} 个群
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500">查看已同步的企业微信客户群，进入详情后处理成员、SOP 和风险。</p>
          </div>
          <div className="flex items-center gap-2">
            <CustomerContactSyncPanel
              compact
              refreshKey={syncStatusRefreshKey}
              onRetryDone={refreshPageData}
              onRefreshData={refreshPageData}
            />
            <Button variant="outline" onClick={() => void refreshPageData()} disabled={isLoadingGroups}>
              {isLoadingGroups ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              刷新数据
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <section className="flex min-h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_200px_160px_180px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="customer-group-search"
                  name="customer_group_search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setPage(1)
                  }}
                  placeholder="搜索群名称、群 ID、群主"
                  className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                id="customer-group-owner-filter"
                name="customer_group_owner_filter"
                aria-label="按群主筛选客户群"
                value={ownerFilter}
                onChange={(event) => {
                  setOwnerFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部群主</option>
                {ownerOptions.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
              <select
                id="customer-group-status-filter"
                name="customer_group_status_filter"
                aria-label="按状态筛选客户群"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value)
                  setPage(1)
                }}
                className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部状态</option>
                {statusOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                id="customer-group-member-sort"
                name="customer_group_member_sort"
                aria-label="客户群成员数排序"
                value={memberSort}
                onChange={(event) => {
                  setMemberSort(event.target.value as GroupSortMode)
                  setPage(1)
                }}
                className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="default">默认排序</option>
                <option value="member_desc">成员数从多到少</option>
                <option value="member_asc">成员数从少到多</option>
              </select>
              <Button variant="ghost" size="sm" className="justify-start px-2 text-xs text-blue-600 hover:bg-blue-50" onClick={clearFilters} disabled={!hasGroupFilters}>
                清空筛选
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span>本页 {groups.length} 个群</span>
              {hasGroupFilters ? <span>当前筛选命中 {filteredGroups.length} 个群</span> : null}
              <span>最近同步状态可在“同步详情”中查看</span>
            </div>
          </div>

          <div className="min-h-[420px] flex-1 overflow-auto">
            {isLoadingGroups ? (
              <div className="flex min-h-[420px] items-center justify-center text-sm text-gray-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                群运营数据加载中...
              </div>
            ) : groupError ? (
              <EmptyState icon={Info} title="群运营数据加载失败" description={groupError} className="min-h-[420px]" />
            ) : filteredGroups.length === 0 ? (
              <EmptyState
                icon={Users}
                title={hasGroupFilters ? "没有匹配的客户群" : "暂无客户群"}
                description={hasGroupFilters ? "可以清空搜索、群主、状态或排序条件后再查看。" : "企业微信客户群同步完成后，会在这里展示。"}
                className="min-h-[420px]"
              />
            ) : (
              <table className="w-full min-w-[920px] border-separate border-spacing-0 text-left text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="border-b border-gray-100 px-4 py-3">客户群</th>
                    <th className="border-b border-gray-100 px-4 py-3">群主</th>
                    <th className="border-b border-gray-100 px-4 py-3">成员</th>
                    <th className="border-b border-gray-100 px-4 py-3">状态</th>
                    <th className="border-b border-gray-100 px-4 py-3">最近同步</th>
                    <th className="border-b border-gray-100 px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredGroups.map((group) => {
                    const chatID = (group.chat_id || "").trim()
                    const status = groupStatusMeta(group.status)
                    return (
                      <tr key={chatID || group.name} className="hover:bg-blue-50/30">
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <div className="max-w-[360px] truncate font-semibold text-gray-900">{groupTitle(group)}</div>
                            <div className="mt-0.5 max-w-[360px] truncate font-mono text-xs text-gray-400">{chatID || "-"}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <span className="inline-flex max-w-[180px] truncate">
                            <OwnerName userid={group.owner_userid} fallback={group.owner_userid} />
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{Number(group.member_count || 0)} 人</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={cn("px-2 py-0 text-[11px]", status.className)}>
                            {status.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDateTime(group.last_synced_at || group.updated_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <Button variant="outline" size="sm" onClick={() => openGroup(group)} disabled={!chatID}>
                              <BarChart3 className="mr-2 h-4 w-4" />
                              进入运营
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="border-t border-gray-100 p-4">
            <CRMTablePagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              pageSizeOptions={GROUP_PAGE_SIZE_OPTIONS}
              startIndex={startIndex}
              endIndex={endIndex}
              total={totalGroups}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize)
                setPage(1)
              }}
            />
          </div>
        </section>
      </div>
    </div>
  )

  const renderGroupDetail = () => {
    if (isLoadingDetail && !activeGroup) {
      return (
        <div className="flex h-full items-center justify-center bg-[#F5F7FA] text-sm text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          群运营详情加载中...
        </div>
      )
    }
    if (detailError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#F5F7FA] p-8 text-center">
          <Info className="h-9 w-9 text-orange-500" />
          <div className="text-base font-semibold text-gray-900">群运营详情加载失败</div>
          <div className="max-w-md text-sm text-gray-500">{detailError}</div>
          <Button variant="outline" onClick={() => void fetchDetail(selectedChatID)}>
            重新加载
          </Button>
        </div>
      )
    }
    if (!activeGroup) {
      return (
        <EmptyState
          icon={Info}
          title="未找到客户群"
          description="该客户群可能不在当前账号可见范围内，或尚未完成同步。"
          className="h-full bg-[#F5F7FA]"
        />
      )
    }

    const memberTotal = Number(activeGroup.member_count || members.length || 0)
    const adminTotal = Number(activeGroup.admin_count || admins.length || 0)
    const previewMembers = members.slice(0, 5)

    return (
      <div className="flex h-full flex-col bg-[#F5F7FA]">
        <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Button variant="ghost" size="icon" onClick={closeGroup} className="h-9 w-9 shrink-0 text-gray-500">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex -space-x-2">
                {(previewMembers.length > 0 ? previewMembers.slice(0, 3) : [{ name: "群" }, { name: "运" }, { name: "营" }]).map((member, index) => (
                  <Avatar
                    key={`${displayMemberName(member as CustomerGroupChatMember)}-${index}`}
                    fallback={displayMemberName(member as CustomerGroupChatMember).slice(0, 1)}
                    className="h-10 w-10 border-2 border-white"
                  />
                ))}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-bold text-gray-900">{groupTitle(activeGroup)}</h2>
                  <Badge variant="outline" className={cn("px-2 py-0.5 text-[11px]", activeStatus.className)}>
                    {activeStatus.label}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-gray-500">
                  群 ID: {(activeGroup.chat_id || "").trim() || "-"} · {memberTotal} 名成员 · 创建于 {formatUnixSeconds(activeGroup.create_time)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CustomerContactSyncPanel
                compact
                refreshKey={syncStatusRefreshKey}
                onRetryDone={refreshPageData}
                onRefreshData={refreshPageData}
              />
              <Button variant="outline" className="text-gray-600" onClick={() => setActiveTab("members")}>
                <Users className="mr-2 h-4 w-4" />
                群成员管理
              </Button>
              <Button onClick={() => void refreshPageData()} disabled={isLoadingDetail || isLoadingGroups}>
                {isLoadingDetail || isLoadingGroups ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                刷新数据
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GroupDetailTab)}>
            <TabsList className="h-auto gap-8 rounded-none border-b-0 bg-transparent p-0">
              <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-2 font-medium shadow-none data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600">
                运营概览
              </TabsTrigger>
              <TabsTrigger value="members" className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-2 font-medium shadow-none data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600">
                成员列表
              </TabsTrigger>
              <TabsTrigger value="sop" className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-2 font-medium shadow-none data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600">
                SOP 执行记录
              </TabsTrigger>
              <TabsTrigger value="risk" className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-2 font-medium shadow-none data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600">
                风险监控
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GroupDetailTab)}>
            <TabsContent value="overview" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <MetricCard label="成员总数" value={memberTotal} tone="blue" />
                <MetricCard label="企业成员" value={memberCounts.internal || "-"} hint="来自成员明细" />
                <MetricCard label="外部联系人" value={memberCounts.external || "-"} hint="来自成员明细" />
                <MetricCard label="待处理预警" value="0" hint="暂无风险事件" tone="green" />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                  <Card className="border-gray-200 shadow-sm">
                    <CardHeader className="border-b border-gray-100 p-4">
                      <CardTitle className="text-sm font-semibold text-gray-800">群动态摘要</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <EmptyOperationCard
                        icon={Activity}
                        title="暂无运营分析结果"
                        description="接入群消息分析后，这里会展示近期讨论主题、客户关注点和建议动作。"
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-gray-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 p-4">
                      <CardTitle className="text-sm font-semibold text-gray-800">本周群运营 SOP 进度</CardTitle>
                      <Button variant="ghost" size="sm" className="text-xs text-blue-600" onClick={() => setActiveTab("sop")}>
                        查看全部
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4">
                      <EmptyOperationCard
                        icon={Calendar}
                        title="暂无 SOP 执行记录"
                        description="配置群运营计划后，欢迎新成员、活动提醒、复购触达等动作会在这里呈现。"
                      />
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card className="border-gray-200 shadow-sm">
                    <CardHeader className="border-b border-gray-100 p-4">
                      <CardTitle className="text-sm font-semibold text-gray-800">群基本信息</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4">
                      <FieldRow label="群主">
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <UserRound className="h-4 w-4 shrink-0 text-gray-400" />
                          <OwnerName userid={activeGroup.owner_userid} fallback={activeGroup.owner_userid} />
                        </span>
                      </FieldRow>
                      <FieldRow label="群公告">
                        <span className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                          {(activeGroup.notice || "").trim() || "暂无群公告"}
                        </span>
                      </FieldRow>
                      <FieldRow label="群标签">
                        <span className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className={cn("px-2 py-0 text-[10px]", activeStatus.className)}>
                            {activeStatus.label}
                          </Badge>
                          {memberTotal > 0 ? (
                            <Badge variant="outline" className="border-blue-200 bg-blue-50 px-2 py-0 text-[10px] text-blue-700">
                              {memberTotal} 人
                            </Badge>
                          ) : null}
                        </span>
                      </FieldRow>
                      <FieldRow label="最近同步">
                        {formatDateTime(activeGroup.last_synced_at || activeGroup.updated_at)}
                      </FieldRow>
                    </CardContent>
                  </Card>

                  <Card className="border-gray-200 shadow-sm">
                    <CardHeader className="border-b border-gray-100 p-4">
                      <CardTitle className="text-sm font-semibold text-gray-800">活跃成员排行</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {previewMembers.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">暂无成员排行数据。</div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {previewMembers.map((member, index) => (
                            <div key={`${displayMemberName(member)}-${index}`} className="flex items-center justify-between p-3 hover:bg-gray-50">
                              <div className="flex min-w-0 items-center gap-2">
                                <Avatar fallback={displayMemberName(member).slice(0, 1)} size="sm" />
                                <span className="truncate text-sm text-gray-700">{displayMemberName(member)}</span>
                              </div>
                              <span className="shrink-0 text-xs text-gray-400">成员</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="members" className="mt-0">
              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="border-b border-gray-100 p-4">
                  <CardTitle className="text-sm font-semibold text-gray-800">成员列表</CardTitle>
                </CardHeader>
                <CardContent className="p-4">{renderMembersTable()}</CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sop" className="mt-0">
              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="border-b border-gray-100 p-4">
                  <CardTitle className="text-sm font-semibold text-gray-800">SOP 执行记录</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  <EmptyOperationCard
                    icon={CheckCircle2}
                    title="暂无 SOP 记录"
                    description="后续可按群阶段配置欢迎语、活动通知、复购提醒等运营动作，执行结果会在这里跟踪。"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risk" className="mt-0">
              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="border-b border-gray-100 p-4">
                  <CardTitle className="text-sm font-semibold text-gray-800">风险监控</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard label="待处理预警" value="0" tone="green" />
                    <MetricCard label="最近风险" value="无" />
                    <MetricCard label="处理状态" value="正常" tone="green" />
                  </div>
                  <EmptyOperationCard
                    icon={ShieldAlert}
                    title="暂无风险记录"
                    description="出现敏感词、负面反馈或异常活跃时，会在这里展示预警和处理建议。"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    )
  }

  return selectedChatID ? renderGroupDetail() : renderGroupList()
}
