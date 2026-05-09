import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Search,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/EmptyState"
import { Input } from "@/components/ui/Input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { CRMSyncStatusBanner } from "@/components/crm/CRMSyncStatusBanner"
import { CRMSyncToolbarAction } from "@/components/crm/CRMSyncToolbarAction"
import {
  GroupOperationsListOpenDataFrame,
  type GroupOperationsListOpenDataRow,
} from "@/components/wecom/GroupOperationsListOpenDataFrame"
import { usePageFeedback } from "@/components/ui/PageFeedback"
import { normalizeErrorMessage } from "@/services/http"
import {
  getGroupOperationListPage,
  type GroupOperationListPage,
  type GroupOperationRow,
} from "@/services/groupChatService"
import {
  getCRMSyncOverview,
  openCRMSyncOverviewStream,
  type CRMSyncOverview,
  type CRMSyncScopeCard,
} from "@/services/crmSyncService"

type GroupTab = "all" | "active" | "todo"

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function formatDateTime(value?: string): string {
  const text = (value || "").trim()
  if (!text) return "-"
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) return text
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false })
}

function readPositive(value: string | null, fallback: number): number {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

function readTab(value: string | null): GroupTab {
  switch ((value || "").trim()) {
    case "active":
      return "active"
    case "todo":
      return "todo"
    default:
      return "all"
  }
}

function replaceSearchParams(
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  input: {
    tab: GroupTab
    query: string
    owner: string
    status: string
    chatDataSync: string
    page: number
    pageSize: number
  },
) {
  const next = new URLSearchParams()
  if (input.tab !== "all") next.set("tab", input.tab)
  if (input.query.trim()) next.set("query", input.query.trim())
  if (input.owner.trim()) next.set("owner_userid", input.owner.trim())
  if (input.status.trim()) next.set("status", input.status.trim())
  if (input.chatDataSync.trim()) next.set("chatdata_sync", input.chatDataSync.trim())
  if (input.page > 1) next.set("page", String(input.page))
  if (input.pageSize !== DEFAULT_PAGE_SIZE) next.set("page_size", String(input.pageSize))
  setSearchParams(next, { replace: true })
}

function shouldRefreshGroupRows(prev?: CRMSyncScopeCard | null, next?: CRMSyncScopeCard | null): boolean {
  if (!prev || !next) return false
  if ((prev.last_synced_at || "").trim() !== (next.last_synced_at || "").trim()) return true
  const prevBusy = ["running", "cancelling"].includes((prev.status || "").trim())
  const nextBusy = ["running", "cancelling"].includes((next.status || "").trim())
  return prevBusy && !nextBusy
}

function buildPageItems(currentPage: number, totalPages: number): Array<number | string> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis-right", totalPages]
  }
  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis-left", totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }
  return [1, "ellipsis-left", currentPage - 1, currentPage, currentPage + 1, "ellipsis-right", totalPages]
}

function buildRowTags(row: GroupOperationRow): string[] {
  const tags: string[] = []
  if (row.has_chatdata) tags.push("已同步聊天内容")
  if (row.needs_attention) tags.push("待运营处理")
  if (Number(row.admin_count || 0) > 0) tags.push("已配置管理员")
  if ((row.last_synced_at || "").trim()) tags.push("资料已同步")
  if (tags.length === 0) tags.push("常规群")
  return tags.slice(0, 2)
}

function visibleRowsByTab(rows: GroupOperationRow[], tab: GroupTab): GroupOperationRow[] {
  switch (tab) {
    case "active":
      return rows.filter((row) => !row.needs_attention)
    case "todo":
      return rows.filter((row) => row.needs_attention)
    default:
      return rows
  }
}

function paginationText(tab: GroupTab, startIndex: number, endIndex: number, total: number, visibleCount: number): string {
  if (tab === "all") {
    return `显示 ${startIndex} 到 ${endIndex} 条，共 ${total} 条`
  }
  return `当前页显示 ${visibleCount} 条，筛选范围共 ${total} 条`
}

function groupDetailLink(chatID?: string): string {
  const safeID = (chatID || "").trim()
  return safeID ? `/main/groups/${encodeURIComponent(safeID)}` : "/main/groups"
}

export default function GroupOperations() {
  const { showFeedback } = usePageFeedback()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pageData, setPageData] = useState<GroupOperationListPage | null>(null)
  const [syncOverview, setSyncOverview] = useState<CRMSyncOverview | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [activeTab, setActiveTab] = useState<GroupTab>(readTab(searchParams.get("tab")))
  const [queryInput, setQueryInput] = useState((searchParams.get("query") || "").trim())
  const [query, setQuery] = useState((searchParams.get("query") || "").trim())
  const [owner, setOwner] = useState((searchParams.get("owner_userid") || "").trim())
  const [status, setStatus] = useState((searchParams.get("status") || "").trim())
  const [chatDataSync, setChatDataSync] = useState((searchParams.get("chatdata_sync") || "").trim())
  const [page, setPage] = useState(readPositive(searchParams.get("page"), 1))
  const [pageSize, setPageSize] = useState(() => {
    const parsed = readPositive(searchParams.get("page_size"), DEFAULT_PAGE_SIZE)
    return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = queryInput.trim()
      setQuery((previous) => {
        if (previous !== next) setPage(1)
        return next
      })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [queryInput])

  useEffect(() => {
    replaceSearchParams(setSearchParams, { tab: activeTab, query, owner, status, chatDataSync, page, pageSize })
  }, [activeTab, chatDataSync, owner, page, pageSize, query, setSearchParams, status])

  const loadPage = useCallback(async () => {
    try {
      setIsLoading(true)
      const [groups, sync] = await Promise.all([
        getGroupOperationListPage({ query, owner_userid: owner, status, chatdata_sync: chatDataSync, page, page_size: pageSize }),
        getCRMSyncOverview(),
      ])
      setPageData(groups)
      setSyncOverview(sync)
    } catch (error) {
      showFeedback({ kind: "error", message: normalizeErrorMessage(error) })
      setPageData(null)
      setSyncOverview(null)
    } finally {
      setIsLoading(false)
    }
  }, [chatDataSync, owner, page, pageSize, query, showFeedback, status])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  const loadPageRef = useRef(loadPage)
  useEffect(() => {
    loadPageRef.current = loadPage
  }, [loadPage])

  useEffect(() => {
    const stream = openCRMSyncOverviewStream({
      onMessage: (payload) => {
        const next = payload.data || null
        if (!next) return
        setSyncOverview((previous) => {
          if (shouldRefreshGroupRows(previous?.group_chats, next.group_chats)) {
            window.setTimeout(() => {
              void loadPageRef.current()
            }, 0)
          }
          return next
        })
      },
    })
    return () => stream.close()
  }, [])

  const rows = pageData?.rows || []
  const summary = pageData?.summary || {}
  const ownerOptions = pageData?.owner_options || []
  const tabbedRows = useMemo(() => visibleRowsByTab(rows, activeTab), [activeTab, rows])
  const tabTotal = activeTab === "active"
    ? Number(summary.healthy_count || 0)
    : activeTab === "todo"
      ? Number(summary.attention_count || 0)
      : Number(pageData?.pagination?.total || 0)
  const currentPage = Math.max(1, Number(pageData?.pagination?.page || page || 1))
  const totalPages = Math.max(1, Number(pageData?.pagination?.total_pages || 1))
  const startIndex = activeTab === "all" && tabTotal > 0 ? (currentPage - 1) * pageSize + 1 : tabbedRows.length > 0 ? 1 : 0
  const endIndex = activeTab === "all" && tabTotal > 0 ? Math.min(tabTotal, (currentPage - 1) * pageSize + rows.length) : tabbedRows.length
  const hasActiveFilters = !!query.trim() || !!owner.trim() || !!status.trim() || !!chatDataSync.trim()
  const pageItems = buildPageItems(currentPage, totalPages)
  const frameRows = useMemo<GroupOperationsListOpenDataRow[]>(
    () =>
      tabbedRows.map((row) => {
        const chatID = (row.chat_id || "").trim()
        const ownerOpenID = (row.owner_open_userid || "").trim()
        const ownerName = (row.owner_name || row.owner_userid || "待分配").trim()
        return {
          chatID,
          name: (row.name || "未命名客户群").trim(),
          nameInitial: ((row.name || "群").trim() || "群").slice(0, 1),
          ownerOpenID,
          ownerName,
          ownerInitial: (ownerName || "人").slice(0, 1),
          memberCount: Number(row.member_count || 0),
          statusLabel: (row.status_label || "").trim() || "状态正常",
          statusTone: row.needs_attention
            ? "warning"
            : (row.status_tone || "").trim() === "success"
              ? "success"
              : "neutral",
          tags: buildRowTags(row),
          lastSyncedAt: formatDateTime(row.last_synced_at),
          noticePreview: (row.notice_preview || "客户群资料更新").trim(),
        }
      }),
    [tabbedRows],
  )

  const resetFilters = () => {
    setQueryInput("")
    setQuery("")
    setOwner("")
    setStatus("")
    setChatDataSync("")
    setActiveTab("all")
    setPage(1)
  }

  return (
    <div className="flex h-full min-h-[720px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-gray-100 bg-gray-50 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as GroupTab)
              setPage(1)
            }}
          >
            <TabsList className="border border-gray-200 bg-white shadow-sm">
              <TabsTrigger value="all" className="data-[state=active]:bg-gray-100">
                全部群聊 ({Number(summary.total_count || 0)})
              </TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-gray-100">
                高活跃群 ({Number(summary.healthy_count || 0)})
              </TabsTrigger>
              <TabsTrigger value="todo" className="data-[state=active]:bg-gray-100 text-orange-600">
                待运营处理 ({Number(summary.attention_count || 0)})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <CRMSyncToolbarAction
            scope="group_chats"
            startLabel="同步群聊"
            card={syncOverview?.group_chats}
            onUpdated={loadPage}
            onRefresh={() => void loadPage()}
            refreshLabel="刷新数据"
            isRefreshing={isLoading}
          />
        </div>
      </div>

      <CRMSyncStatusBanner scopeTitle="客户群" card={syncOverview?.group_chats} />

      <div className="shrink-0 border-b border-gray-100 bg-white p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="relative w-full xl:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="搜索群名称、群主..."
              className="pl-9"
            />
          </div>
          <div className="hidden h-6 w-px bg-gray-200 xl:block" />
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">群状态</option>
            <option value="0">状态正常</option>
            <option value="1">群主已离职</option>
            <option value="2">离职继承中</option>
            <option value="3">离职继承完成</option>
          </select>
          <select
            value={owner}
            onChange={(event) => {
              setOwner(event.target.value)
              setPage(1)
            }}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">群主</option>
            {ownerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {(option.label || "").trim() || (option.value || "").trim() || "-"}
              </option>
            ))}
          </select>
          <select
            value={chatDataSync}
            onChange={(event) => {
              setChatDataSync(event.target.value)
              setPage(1)
            }}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">聊天回显</option>
            <option value="synced">已同步聊天内容</option>
            <option value="unsynced">未同步聊天内容</option>
          </select>
          <div className="ml-auto flex items-center gap-2">
            {hasActiveFilters ? (
              <Button variant="ghost" className="text-blue-600 hover:bg-blue-50" onClick={resetFilters}>
                <Filter className="mr-2 h-4 w-4" />
                清空筛选
              </Button>
            ) : null}
            <Badge className="border-gray-200 bg-gray-50 text-gray-600">最近更新：{formatDateTime(summary.last_synced_at)}</Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <div className="sticky top-0 z-10 flex border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
          <div className="w-14 px-6 py-3 font-semibold">
            <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          </div>
          <div className="flex-1 px-6 py-3 font-semibold">群聊信息</div>
          <div className="w-[92px] px-3 py-3 font-semibold">群人数</div>
          <div className="w-[110px] px-3 py-3 font-semibold">群状态</div>
          <div className="w-[180px] px-3 py-3 font-semibold">核心标签</div>
          <div className="w-[176px] px-3 py-3 font-semibold">最近更新时间</div>
          <div className="w-[180px] px-3 py-3 font-semibold">群主</div>
          <div className="w-[84px] px-6 py-3 text-right font-semibold">操作</div>
        </div>
        {tabbedRows.length === 0 && !isLoading ? (
          <div className="px-6 py-16">
            <EmptyState
              icon={Users}
              title={hasActiveFilters || activeTab !== "all" ? "没有匹配的客户群" : "当前还没有客户群数据"}
              description={
                hasActiveFilters || activeTab !== "all"
                  ? "请调整搜索条件后再试。"
                  : "完成首次同步后，这里会展示群主、成员和风险状态。"
              }
            />
          </div>
        ) : (
          <GroupOperationsListOpenDataFrame
            rows={frameRows}
            loading={isLoading}
            onOpenDetail={(chatID) => {
              window.location.assign(groupDetailLink(chatID))
            }}
          />
        )}
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <span className="text-sm text-gray-500">
            {paginationText(activeTab, startIndex, endIndex, tabTotal, tabbedRows.length)}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(1)
              }}
              className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} / 页
                </option>
              ))}
            </select>
            {activeTab === "all" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {pageItems.map((item) =>
                  typeof item === "number" ? (
                    <Button
                      key={item}
                      variant="outline"
                      size="sm"
                      className={`h-8 min-w-8 px-2 ${item === currentPage ? "border-blue-200 bg-blue-50 text-blue-600" : ""}`}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </Button>
                  ) : (
                    <span key={item} className="px-1 text-gray-400">
                      ...
                    </span>
                  ),
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <div className="inline-flex items-center rounded-md border border-gray-200 px-3 py-1 text-xs text-gray-500">
                当前 tab 为页内快速查看，切回“全部群聊”可继续翻页。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
