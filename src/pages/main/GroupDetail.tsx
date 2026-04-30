import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  Hash,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { CustomerContactSyncPanel } from "@/components/crm/CustomerContactSyncPanel"
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

type GroupTab = "profile" | "members" | "admins"
type GroupMemberFilter = "all" | "internal" | "external" | "admin"
type GroupSortMode = "default" | "member_desc" | "member_asc"

const GROUP_PAGE_SIZE = 50

function formatDateTime(value?: string): string {
  const text = (value || "").trim()
  if (!text) return "-"
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) {
    return text
  }
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
  if (value === 0) {
    return { label: "正常", className: "bg-green-50 text-green-700 border-green-200" }
  }
  if (value === 1) {
    return { label: "群主已离职", className: "bg-orange-50 text-orange-700 border-orange-200" }
  }
  if (value === 2) {
    return { label: "离职继承中", className: "bg-orange-50 text-orange-700 border-orange-200" }
  }
  if (value === 3) {
    return { label: "离职继承完成", className: "bg-gray-100 text-gray-700 border-gray-200" }
  }
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
  if (!safeUserID) {
    return <span className="text-gray-500">-</span>
  }
  return (
    <WecomOpenDataName
      userid={safeUserID}
      corpId={auth.corp?.id}
      fallback={(fallback || "").trim() || safeUserID}
      className="truncate"
    />
  )
}

function GroupListItem({
  group,
  active,
  onOpen,
}: {
  group: CustomerGroupChat
  active: boolean
  onOpen: (chatID: string) => void
}) {
  const chatID = (group.chat_id || "").trim()
  const status = groupStatusMeta(group.status)
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-lg border px-3 py-3 text-left transition-colors",
        active ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-white hover:border-blue-100 hover:bg-blue-50/40",
      )}
      onClick={() => onOpen(chatID)}
      disabled={!chatID}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900">{groupTitle(group)}</div>
          <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-gray-500">
            <Hash className="h-3 w-3 shrink-0" />
            <span className="truncate font-mono">{chatID || "-"}</span>
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0 px-2 py-0 text-[10px]", status.className)}>
          {status.label}
        </Badge>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span className="inline-flex min-w-0 items-center gap-1">
          <Users className="h-3.5 w-3.5 shrink-0" />
          {Number(group.member_count || 0)} 人
        </span>
        <span className="inline-flex min-w-0 items-center gap-1">
          群主：
          <span className="max-w-[120px] truncate">
            <OwnerName userid={group.owner_userid} fallback={group.owner_userid} />
          </span>
        </span>
      </div>
      <div className="mt-2 truncate text-[11px] text-gray-400">
        同步：{formatDateTime(group.last_synced_at || group.updated_at)}
      </div>
    </button>
  )
}

export default function GroupDetail({ onBack }: { onBack: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { showFeedback } = usePageFeedback()
  const auth = useAuth()
  const selectedChatID = (searchParams.get("chat_id") || "").trim()

  const [groups, setGroups] = useState<CustomerGroupChat[]>([])
  const [nextCursor, setNextCursor] = useState("")
  const [query, setQuery] = useState("")
  const [ownerFilter, setOwnerFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [memberSort, setMemberSort] = useState<GroupSortMode>("default")
  const [isLoadingGroups, setIsLoadingGroups] = useState(false)
  const [isLoadingMoreGroups, setIsLoadingMoreGroups] = useState(false)
  const [syncStatusRefreshKey, setSyncStatusRefreshKey] = useState(0)
  const [groupError, setGroupError] = useState("")

  const [detail, setDetail] = useState<GetGroupChatData | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState("")
  const [activeTab, setActiveTab] = useState<GroupTab>("profile")
  const [memberFilter, setMemberFilter] = useState<GroupMemberFilter>("all")

  const fetchGroups = useCallback(
    async (cursor = "", append = false) => {
      try {
        if (append) {
          setIsLoadingMoreGroups(true)
        } else {
          setIsLoadingGroups(true)
          setGroupError("")
        }
        const data = await listGroupChats({ cursor, limit: GROUP_PAGE_SIZE })
        const rows = data?.group_chats || []
        setGroups((previous) => (append ? [...previous, ...rows] : rows))
        setNextCursor((data?.next_cursor || "").trim())
      } catch (error) {
        const message = normalizeErrorMessage(error)
        setGroupError(message)
        showFeedback({ kind: "error", message })
        if (!append) {
          setGroups([])
          setNextCursor("")
        }
      } finally {
        setIsLoadingGroups(false)
        setIsLoadingMoreGroups(false)
        if (!append) {
          setSyncStatusRefreshKey((value) => value + 1)
        }
      }
    },
    [showFeedback],
  )

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
          showFeedback({
            kind: "warning",
            message: "客户群详情接口暂未返回，已使用列表同步数据展示。",
          })
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
    void fetchGroups("", false)
  }, [fetchGroups])

  useEffect(() => {
    setActiveTab("profile")
    setMemberFilter("all")
    if (!selectedChatID) {
      setDetail(null)
      setDetailError("")
      return
    }
    void fetchDetail(selectedChatID)
  }, [fetchDetail, selectedChatID])

  useEffect(() => {
    if (!selectedChatID || detail || !detailError) return
    const fallback = buildGroupChatDetailFromListRow(
      groups.find((group) => (group.chat_id || "").trim() === selectedChatID) || null,
    )
    if (!fallback) return
    setDetail(fallback)
    setDetailError("")
  }, [detail, detailError, groups, selectedChatID])

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
      return [
        group.name,
        group.chat_id,
        group.owner_userid,
      ].some((value) => (value || "").toLowerCase().includes(keyword))
    })
    if (memberSort === "member_desc") {
      return [...rows].sort((a, b) => Number(b.member_count || 0) - Number(a.member_count || 0) || groupTitle(a).localeCompare(groupTitle(b), "zh-CN"))
    }
    if (memberSort === "member_asc") {
      return [...rows].sort((a, b) => Number(a.member_count || 0) - Number(b.member_count || 0) || groupTitle(a).localeCompare(groupTitle(b), "zh-CN"))
    }
    return rows
  }, [groups, memberSort, ownerFilter, query, statusFilter])

  const activeGroup = detail?.group_chat || groups.find((group) => (group.chat_id || "").trim() === selectedChatID) || null
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
    if (memberFilter === "internal") {
      return members.filter((member) => Number(member.type || 0) === 1)
    }
    if (memberFilter === "external") {
      return members.filter((member) => Number(member.type || 0) === 2)
    }
    if (memberFilter === "admin") {
      return members.filter((member) => {
        const userID = (member.userid || "").trim()
        return userID !== "" && adminUserIDs.has(userID)
      })
    }
    return members
  }, [adminUserIDs, memberFilter, members])
  const hasGroupFilters = query.trim() !== "" || ownerFilter.trim() !== "" || statusFilter.trim() !== "" || memberSort !== "default"

  const openGroup = (chatID: string) => {
    const safeChatID = chatID.trim()
    if (!safeChatID) return
    const next = new URLSearchParams(searchParams)
    next.set("chat_id", safeChatID)
    setSearchParams(next)
  }

  const clearSelectedGroup = () => {
    if (!selectedChatID) {
      onBack()
      return
    }
    const next = new URLSearchParams(searchParams)
    next.delete("chat_id")
    setSearchParams(next)
  }

  const refreshPageData = async () => {
    await fetchGroups("", false)
    if (selectedChatID) {
      await fetchDetail(selectedChatID)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#F5F7FA]">
      <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <Button variant="ghost" size="icon" onClick={clearSelectedGroup} className="h-9 w-9 shrink-0 text-gray-500">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-bold text-gray-900">
                  {selectedChatID && activeGroup ? groupTitle(activeGroup) : "客户群"}
                </h2>
                {activeGroup ? (
                  <Badge variant="outline" className={cn("px-2 py-0.5 text-[11px]", activeStatus.className)}>
                    {activeStatus.label}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {selectedChatID
                  ? `群 ID：${selectedChatID}`
                  : "查看企业微信客户群同步结果，普通成员只会看到自己为群主的群。"}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => void refreshPageData()} disabled={isLoadingGroups || isLoadingDetail}>
            {isLoadingGroups || isLoadingDetail ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            刷新数据
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <div className="flex h-full min-h-0 flex-col gap-4">
          <CustomerContactSyncPanel
            compact
            refreshKey={syncStatusRefreshKey}
            onRetryDone={refreshPageData}
            onRefreshData={refreshPageData}
          />

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="shrink-0 border-b border-gray-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">客户群列表</div>
                    <div className="mt-1 text-xs text-gray-500">已加载 {groups.length} 个客户群</div>
                  </div>
                  {nextCursor ? (
                    <Badge variant="secondary" className="text-[10px]">
                      可继续加载
                    </Badge>
                  ) : null}
                </div>
                <div className="relative mt-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="customer-group-search"
                    name="customer_group_search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索群名称、群 ID、群主"
                    className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <select
                    id="customer-group-owner-filter"
                    name="customer_group_owner_filter"
                    aria-label="按群主筛选客户群"
                    value={ownerFilter}
                    onChange={(event) => setOwnerFilter(event.target.value)}
                    className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">全部群主</option>
                    {ownerOptions.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      id="customer-group-status-filter"
                      name="customer_group_status_filter"
                      aria-label="按状态筛选客户群"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
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
                      onChange={(event) => setMemberSort(event.target.value as GroupSortMode)}
                      className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="default">默认排序</option>
                      <option value="member_desc">成员数从多到少</option>
                      <option value="member_asc">成员数从少到多</option>
                    </select>
                  </div>
                  {hasGroupFilters ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start px-2 text-xs text-blue-600 hover:bg-blue-50"
                      onClick={() => {
                        setQuery("")
                        setOwnerFilter("")
                        setStatusFilter("")
                        setMemberSort("default")
                      }}
                    >
                      清空客户群筛选
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-3">
                {isLoadingGroups ? (
                  <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-gray-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    客户群加载中...
                  </div>
                ) : groupError ? (
                  <EmptyState
                    icon={Info}
                    title="客户群加载失败"
                    description={groupError}
                    className="min-h-[260px]"
                  />
                ) : filteredGroups.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title={hasGroupFilters ? "没有匹配的客户群" : "暂无客户群数据"}
                    description={hasGroupFilters ? "可以清空搜索、群主、状态或排序条件后再查看。" : "客户群来自企业微信客户联系同步，同步完成后会展示在这里。"}
                    className="min-h-[260px]"
                  />
                ) : (
                  <div className="space-y-2">
                    {filteredGroups.map((group) => {
                      const chatID = (group.chat_id || "").trim()
                      return (
                        <GroupListItem
                          key={chatID || group.name}
                          group={group}
                          active={chatID !== "" && chatID === selectedChatID}
                          onOpen={openGroup}
                        />
                      )
                    })}
                    {nextCursor ? (
                      <Button
                        variant="outline"
                        className="mt-2 w-full"
                        onClick={() => void fetchGroups(nextCursor, true)}
                        disabled={isLoadingMoreGroups}
                      >
                        {isLoadingMoreGroups ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        加载更多客户群
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

            <section className="min-h-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {!selectedChatID ? (
                <EmptyState
                  icon={Users}
                  title="请选择一个客户群"
                  description="左侧选择客户群后，可查看群资料、成员列表和管理员。"
                  className="h-full min-h-[420px]"
                />
              ) : isLoadingDetail ? (
                <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  客户群详情加载中...
                </div>
              ) : detailError ? (
                <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
                  <Info className="h-9 w-9 text-orange-500" />
                  <div className="text-base font-semibold text-gray-900">客户群详情加载失败</div>
                  <div className="max-w-md text-sm text-gray-500">{detailError}</div>
                  <Button variant="outline" onClick={() => void fetchDetail(selectedChatID)}>
                    重新加载
                  </Button>
                </div>
              ) : !activeGroup ? (
                <EmptyState
                  icon={Info}
                  title="未找到客户群"
                  description="该客户群可能不在当前账号可见范围内，或尚未完成同步。"
                  className="h-full min-h-[420px]"
                />
              ) : (
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                  <div className="shrink-0 border-b border-gray-100 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-bold text-gray-900">{groupTitle(activeGroup)}</h3>
                          <Badge variant="outline" className={cn("px-2 py-0.5 text-[11px]", activeStatus.className)}>
                            {activeStatus.label}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span className="font-mono">ID: {(activeGroup.chat_id || "").trim() || "-"}</span>
                          <span>最近同步：{formatDateTime(activeGroup.last_synced_at || activeGroup.updated_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <ShieldCheck className="h-4 w-4 text-blue-500" />
                        本页展示本地同步结果，非实时直连企业微信接口
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <Card className="border-gray-100 shadow-none">
                        <CardContent className="p-3">
                          <div className="text-xs text-gray-500">成员数</div>
                          <div className="mt-1 text-xl font-bold text-gray-900">{Number(activeGroup.member_count || members.length || 0)}</div>
                        </CardContent>
                      </Card>
                      <Card className="border-gray-100 shadow-none">
                        <CardContent className="p-3">
                          <div className="text-xs text-gray-500">管理员</div>
                          <div className="mt-1 text-xl font-bold text-gray-900">{Number(activeGroup.admin_count || admins.length || 0)}</div>
                        </CardContent>
                      </Card>
                      <Card className="border-gray-100 shadow-none">
                        <CardContent className="p-3">
                          <div className="text-xs text-gray-500">创建时间</div>
                          <div className="mt-1 truncate text-sm font-semibold text-gray-900">{formatUnixSeconds(activeGroup.create_time)}</div>
                        </CardContent>
                      </Card>
                      <Card className="border-gray-100 shadow-none">
                        <CardContent className="p-3">
                          <div className="text-xs text-gray-500">成员版本</div>
                          <div className="mt-1 truncate text-sm font-semibold text-gray-900">{(activeGroup.member_version || "").trim() || "-"}</div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GroupTab)} className="flex min-h-0 flex-1 flex-col">
                    <div className="shrink-0 border-b border-gray-100 px-5 pt-3">
                      <TabsList className="h-auto gap-6 rounded-none bg-transparent p-0">
                        <TabsTrigger
                          value="profile"
                          className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 shadow-none data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600"
                        >
                          群资料
                        </TabsTrigger>
                        <TabsTrigger
                          value="members"
                          className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 shadow-none data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600"
                        >
                          成员列表 ({members.length})
                        </TabsTrigger>
                        <TabsTrigger
                          value="admins"
                          className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-3 shadow-none data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600"
                        >
                          管理员 ({admins.length})
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto p-5">
                      <TabsContent value="profile" className="mt-0">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                          <div className="space-y-4">
                            <div className="rounded-lg border border-gray-100 bg-white p-4">
                              <div className="text-sm font-semibold text-gray-900">群公告</div>
                              <div className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm leading-6 text-gray-700">
                                {(activeGroup.notice || "").trim() || "暂无群公告"}
                              </div>
                            </div>
                            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                              <div className="flex gap-2 text-sm font-semibold text-blue-900">
                                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                                同步说明
                              </div>
                              <p className="mt-2 text-sm leading-6 text-blue-800">
                                当前页面展示本地 CRM read model，不在页面请求中等待企业微信全量同步。若刚刷新过客户联系数据，请稍后重新打开或点击刷新数据。
                              </p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <FieldRow label="群主">
                              <span className="inline-flex min-w-0 items-center gap-2">
                                <UserRound className="h-4 w-4 shrink-0 text-gray-400" />
                                <OwnerName userid={activeGroup.owner_userid} fallback={activeGroup.owner_userid} />
                              </span>
                            </FieldRow>
                            <FieldRow label="客户群 ID">
                              <span className="break-all font-mono text-xs">{(activeGroup.chat_id || "").trim() || "-"}</span>
                            </FieldRow>
                            <FieldRow label="状态">
                              <Badge variant="outline" className={cn("px-2 py-0 text-[11px]", activeStatus.className)}>
                                {activeStatus.label}
                              </Badge>
                            </FieldRow>
                            <FieldRow label="最近同步">
                              {formatDateTime(activeGroup.last_synced_at || activeGroup.updated_at)}
                            </FieldRow>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="members" className="mt-0">
                        {members.length === 0 ? (
                          <EmptyState
                            icon={Users}
                            title="暂无成员明细"
                            description="成员明细会在客户群详情同步完成后展示。"
                            className="min-h-[300px]"
                          />
                        ) : (
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
                              <EmptyState
                                icon={Users}
                                title="没有匹配的成员"
                                description="可以切换成员类型后再查看。"
                                className="min-h-[240px]"
                              />
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
                                            {invitor ? (
                                              <WecomOpenDataName
                                                userid={invitor}
                                                corpId={auth.corp?.id}
                                                fallback={invitor}
                                                className="truncate"
                                              />
                                            ) : (
                                              "-"
                                            )}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="admins" className="mt-0">
                        {admins.length === 0 ? (
                          <EmptyState
                            icon={ShieldCheck}
                            title="暂无管理员"
                            description="管理员信息会随客户群详情同步返回。"
                            className="min-h-[300px]"
                          />
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {admins.map((admin: CustomerGroupChatAdmin) => {
                              const userID = (admin.userid || "").trim()
                              return (
                                <div key={userID} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                                    <ShieldCheck className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-gray-900">
                                      <OwnerName userid={userID} fallback={userID} />
                                    </div>
                                    <div className="mt-0.5 truncate text-xs text-gray-500">{userID || "-"}</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
