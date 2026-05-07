import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  Filter,
  Loader2,
  MessageSquare,
  Search,
  UserPlus,
} from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState } from "@/components/ui/EmptyState"
import { Input } from "@/components/ui/Input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { CRMSyncStatusBanner } from "@/components/crm/CRMSyncStatusBanner"
import { CRMSyncToolbarAction } from "@/components/crm/CRMSyncToolbarAction"
import { usePageFeedback } from "@/components/ui/PageFeedback"
import { normalizeErrorMessage } from "@/services/http"
import {
  batchAssignCustomers,
  getCustomerListView,
  updateCustomerProfile,
  type CustomerListFilterOption,
  type CustomerListRow,
  type CustomerListViewModel,
} from "@/services/customerListService"
import {
  getCRMSyncOverview,
  openCRMSyncOverviewStream,
  type CRMSyncOverview,
  type CRMSyncScopeCard,
} from "@/services/crmSyncService"

type CustomerTab = "all" | "today" | "todo" | "upgraded"

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function formatDateTime(value?: string): string {
  const text = (value || "").trim()
  if (!text) return "-"
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) return text
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false })
}

function readInitialFilters() {
  if (typeof window === "undefined") {
    return { tab: "all" as CustomerTab, query: "", stage: "", tag: "", owner: "", page: 1, pageSize: DEFAULT_PAGE_SIZE }
  }
  const search = new URLSearchParams(window.location.search)
  const tab = (search.get("tab") || "all").trim()
  const page = Number(search.get("page") || 1)
  const pageSize = Number(search.get("page_size") || DEFAULT_PAGE_SIZE)
  return {
    tab: tab === "today" || tab === "todo" || tab === "upgraded" ? (tab as CustomerTab) : ("all" as CustomerTab),
    query: (search.get("query") || "").trim(),
    stage: (search.get("stage") || "").trim(),
    tag: (search.get("tag") || "").trim(),
    owner: (search.get("owner_userid") || "").trim(),
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    pageSize: PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  }
}

function replaceURL(input: {
  tab: CustomerTab
  query: string
  stage: string
  tag: string
  owner: string
  page: number
  pageSize: number
}) {
  if (typeof window === "undefined") return
  const search = new URLSearchParams()
  if (input.tab !== "all") search.set("tab", input.tab)
  if (input.query.trim()) search.set("query", input.query.trim())
  if (input.stage.trim()) search.set("stage", input.stage.trim())
  if (input.tag.trim()) search.set("tag", input.tag.trim())
  if (input.owner.trim()) search.set("owner_userid", input.owner.trim())
  if (input.page > 1) search.set("page", String(input.page))
  if (input.pageSize !== DEFAULT_PAGE_SIZE) search.set("page_size", String(input.pageSize))
  const nextURL = `${window.location.pathname}${search.toString() ? `?${search.toString()}` : ""}${window.location.hash}`
  window.history.replaceState({}, "", nextURL)
}

function displayOptionLabel(option: CustomerListFilterOption): string {
  return ((option.label || "").trim() || (option.value || "").trim()) || "-"
}

function stageTone(stage?: string): string {
  switch ((stage || "").trim()) {
    case "已成交":
      return "bg-green-50 text-green-700 border-green-200"
    case "已报价待签":
      return "bg-amber-50 text-amber-700 border-amber-200"
    case "流失":
      return "bg-gray-100 text-gray-700 border-gray-200"
    default:
      return "bg-blue-50 text-blue-700 border-blue-100"
  }
}

function sourceTone(label?: string): string {
  if ((label || "").includes("升级")) return "bg-orange-50 text-orange-700"
  return "bg-blue-50 text-blue-500"
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

function shouldRefreshCustomerRows(prev?: CRMSyncScopeCard | null, next?: CRMSyncScopeCard | null): boolean {
  if (!prev || !next) return false
  if ((prev.last_synced_at || "").trim() !== (next.last_synced_at || "").trim()) return true
  const prevBusy = ["running", "cancelling"].includes((prev.status || "").trim())
  const nextBusy = ["running", "cancelling"].includes((next.status || "").trim())
  return prevBusy && !nextBusy
}

function previewLabel(row: CustomerListRow): string {
  return (row.last_interaction_label || "").trim() || "单聊跟进"
}

function customerLink(externalUserID?: string): string {
  const safeID = (externalUserID || "").trim()
  return safeID ? `/main/customer-360?external_userid=${encodeURIComponent(safeID)}` : "/main/customer-360"
}

export default function CustomerList() {
  const initial = useMemo(() => readInitialFilters(), [])
  const { showFeedback } = usePageFeedback()

  const [view, setView] = useState<CustomerListViewModel | null>(null)
  const [syncOverview, setSyncOverview] = useState<CRMSyncOverview | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [activeTab, setActiveTab] = useState<CustomerTab>(initial.tab)
  const [queryInput, setQueryInput] = useState(initial.query)
  const [query, setQuery] = useState(initial.query)
  const [stage, setStage] = useState(initial.stage)
  const [tag, setTag] = useState(initial.tag)
  const [owner, setOwner] = useState(initial.owner)
  const [page, setPage] = useState(initial.page)
  const [pageSize, setPageSize] = useState(initial.pageSize)
  const [selectedIDs, setSelectedIDs] = useState<string[]>([])
  const [batchOwner, setBatchOwner] = useState("")
  const [editingRow, setEditingRow] = useState<CustomerListRow | null>(null)
  const [editOwner, setEditOwner] = useState("")
  const [editStage, setEditStage] = useState("")
  const [editTagsText, setEditTagsText] = useState("")

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
    replaceURL({ tab: activeTab, query, stage, tag, owner, page, pageSize })
  }, [activeTab, owner, page, pageSize, query, stage, tag])

  const loadPage = useCallback(async () => {
    try {
      setIsLoading(true)
      const [listData, syncData] = await Promise.all([
        getCustomerListView({
          tab: activeTab,
          query,
          stage,
          tag,
          owner_userid: owner,
          page,
          page_size: pageSize,
        }),
        getCRMSyncOverview(),
      ])
      setView(listData)
      setSyncOverview(syncData)
      const currentIDs = new Set((listData?.rows || []).map((row) => (row.external_userid || "").trim()).filter(Boolean))
      setSelectedIDs((previous) => previous.filter((id) => currentIDs.has(id)))
    } catch (error) {
      showFeedback({ kind: "error", message: normalizeErrorMessage(error) })
      setView(null)
      setSyncOverview(null)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, owner, page, pageSize, query, showFeedback, stage, tag])

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
          if (shouldRefreshCustomerRows(previous?.contacts, next.contacts)) {
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

  const rows = view?.rows || []
  const summary = view?.summary || {}
  const stageOptions = (view?.stage_options || []).filter((item) => (item.value || "").trim() !== "")
  const tagOptions = (view?.tag_options || []).filter((item) => (item.value || "").trim() !== "")
  const ownerOptions = (view?.owner_options || []).filter((item) => (item.value || "").trim() !== "")
  const total = Number(view?.pagination?.total || 0)
  const currentPage = Math.max(1, Number(view?.pagination?.page || page || 1))
  const totalPages = Math.max(1, Number(view?.pagination?.total_pages || 1))
  const startIndex = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIndex = total === 0 ? 0 : Math.min(total, (currentPage - 1) * pageSize + rows.length)
  const allVisibleChecked =
    rows.length > 0 && rows.every((row) => selectedIDs.includes((row.external_userid || "").trim()))
  const hasActiveFilters = !!query.trim() || !!stage.trim() || !!tag.trim() || !!owner.trim()
  const pageItems = buildPageItems(currentPage, totalPages)

  const resetFilters = () => {
    setQueryInput("")
    setQuery("")
    setStage("")
    setTag("")
    setOwner("")
    setPage(1)
  }

  const openEditDialog = (row: CustomerListRow) => {
    setEditingRow(row)
    setEditOwner((row.owner_userid || "").trim())
    setEditStage((row.stage || "").trim())
    setEditTagsText((row.tags || []).join("、"))
  }

  const handleSaveCustomer = async () => {
    const externalUserID = (editingRow?.external_userid || "").trim()
    if (!externalUserID) return
    try {
      setIsSaving(true)
      const tags = editTagsText
        .split(/[、,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
      const result = await updateCustomerProfile({
        external_userid: externalUserID,
        owner_userid: editOwner,
        stage: editStage,
        tags,
      })
      showFeedback({ kind: "success", message: (result?.message || "客户信息已更新").trim() })
      setEditingRow(null)
      await loadPage()
    } catch (error) {
      showFeedback({ kind: "error", message: normalizeErrorMessage(error) })
    } finally {
      setIsSaving(false)
    }
  }

  const handleBatchAssign = async () => {
    if (selectedIDs.length === 0) {
      showFeedback({ kind: "warning", message: "请先勾选需要分配的客户。" })
      return
    }
    if (!batchOwner.trim()) {
      showFeedback({ kind: "warning", message: "请选择目标负责人。" })
      return
    }
    try {
      setIsAssigning(true)
      const result = await batchAssignCustomers({
        external_userids: selectedIDs,
        owner_userid: batchOwner.trim(),
      })
      showFeedback({ kind: "success", message: (result?.message || "已完成客户分配").trim() })
      setSelectedIDs([])
      await loadPage()
    } catch (error) {
      showFeedback({ kind: "error", message: normalizeErrorMessage(error) })
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <div className="flex h-full min-h-[720px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-gray-100 bg-gray-50 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as CustomerTab)
              setPage(1)
            }}
          >
            <TabsList className="border border-gray-200 bg-white shadow-sm">
              <TabsTrigger value="all" className="data-[state=active]:bg-gray-100">
                全部客户 ({Number(summary.all_count || 0)})
              </TabsTrigger>
              <TabsTrigger value="today" className="data-[state=active]:bg-gray-100">
                今日新增 ({Number(summary.today_count || 0)})
              </TabsTrigger>
              <TabsTrigger value="todo" className="data-[state=active]:bg-gray-100 text-orange-600">
                待跟进 ({Number(summary.todo_count || 0)})
              </TabsTrigger>
              <TabsTrigger value="upgraded" className="data-[state=active]:bg-gray-100 text-blue-600">
                来自客服升级 ({Number(summary.upgraded_count || 0)})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <CRMSyncToolbarAction
            scope="contacts"
            startLabel="同步客户"
            card={syncOverview?.contacts}
            onUpdated={loadPage}
            onRefresh={() => void loadPage()}
            refreshLabel="刷新数据"
            isRefreshing={isLoading}
          />
        </div>
      </div>

      <CRMSyncStatusBanner scopeTitle="外部客户" card={syncOverview?.contacts} />

      <div className="shrink-0 border-b border-gray-100 bg-white p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="relative w-full xl:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="搜索客户姓名、手机号..."
              className="pl-9"
            />
          </div>
          <div className="hidden h-6 w-px bg-gray-200 xl:block" />
          <select
            value={stage}
            onChange={(event) => {
              setStage(event.target.value)
              setPage(1)
            }}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">生命周期阶段</option>
            {stageOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {displayOptionLabel(option)}
              </option>
            ))}
          </select>
          <select
            value={tag}
            onChange={(event) => {
              setTag(event.target.value)
              setPage(1)
            }}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">客户标签</option>
            {tagOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {displayOptionLabel(option)}
              </option>
            ))}
          </select>
          <select
            value={owner}
            onChange={(event) => {
              setOwner(event.target.value)
              setPage(1)
            }}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">负责人</option>
            {ownerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {displayOptionLabel(option)}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2">
            {hasActiveFilters ? (
              <Button variant="ghost" className="text-blue-600 hover:bg-blue-50" onClick={resetFilters}>
                <Filter className="mr-2 h-4 w-4" />
                清空筛选
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {selectedIDs.length > 0 ? (
        <div className="shrink-0 border-b border-blue-100 bg-blue-50/70 px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="text-sm font-medium text-blue-900">已选择 {selectedIDs.length} 位客户，接下来可以直接批量分配负责人。</div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={batchOwner}
                onChange={(event) => setBatchOwner(event.target.value)}
                className="h-10 min-w-[180px] rounded-md border border-blue-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">选择负责人</option>
                {ownerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {displayOptionLabel(option)}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                className="border-blue-200 bg-white text-blue-700 hover:bg-blue-100"
                disabled={isAssigning}
                onClick={() => void handleBatchAssign()}
              >
                {isAssigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                批量分配
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full border-separate border-spacing-0 text-left text-sm text-gray-600">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="w-12 border-b border-gray-200 px-6 py-3 font-semibold">
                <input
                  type="checkbox"
                  checked={allVisibleChecked}
                  onChange={(event) => {
                    if (event.target.checked) {
                      const next = rows
                        .map((row) => (row.external_userid || "").trim())
                        .filter(Boolean)
                      setSelectedIDs(next)
                      return
                    }
                    setSelectedIDs([])
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="border-b border-gray-200 px-6 py-3 font-semibold">客户信息</th>
              <th className="border-b border-gray-200 px-6 py-3 font-semibold">来源渠道</th>
              <th className="border-b border-gray-200 px-6 py-3 font-semibold">当前阶段</th>
              <th className="border-b border-gray-200 px-6 py-3 font-semibold">核心标签</th>
              <th className="border-b border-gray-200 px-6 py-3 font-semibold">最新互动时间</th>
              <th className="border-b border-gray-200 px-6 py-3 font-semibold">负责人</th>
              <th className="border-b border-gray-200 px-6 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16">
                  <div className="flex items-center justify-center text-sm text-gray-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    正在读取客户数据...
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16">
                  <EmptyState
                    icon={UserPlus}
                    title={hasActiveFilters ? "没有匹配的客户" : "当前还没有客户数据"}
                    description={
                      hasActiveFilters
                        ? "请调整筛选条件后再试。"
                        : "完成首次同步后，这里会展示客户信息、负责人和跟进状态。"
                    }
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const externalUserID = (row.external_userid || "").trim()
                const isChecked = selectedIDs.includes(externalUserID)
                const rowTags = (row.tags || []).filter(Boolean)
                const previewName = (row.name || "").trim() || "未命名客户"
                const previewMobile = (row.mobile_masked || "").trim() || externalUserID || "-"
                return (
                  <tr key={externalUserID || previewName} className="group hover:bg-blue-50/40 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(event) => {
                          if (!externalUserID) return
                          setSelectedIDs((previous) => {
                            if (event.target.checked) {
                              return previous.includes(externalUserID) ? previous : [...previous, externalUserID]
                            }
                            return previous.filter((item) => item !== externalUserID)
                          })
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={(row.avatar || "").trim()}
                          fallback={previewName.slice(0, 1)}
                          size="sm"
                          className="border border-gray-100"
                        />
                        <div className="relative flex flex-col group/name">
                          <Link to={customerLink(externalUserID)} className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                            {previewName}
                          </Link>
                          <div className="font-mono text-[11px] text-gray-400">{previewMobile}</div>
                          <div className="invisible absolute left-0 top-full z-[60] mt-2 w-64 rounded-lg border border-gray-200 bg-white p-4 shadow-xl opacity-0 transition-all group-hover/name:visible group-hover/name:opacity-100">
                            <div className="mb-3 flex items-center gap-3 border-b border-gray-100 pb-3">
                              <Avatar src={(row.avatar || "").trim()} fallback={previewName.slice(0, 1)} size="sm" />
                              <div>
                                <div className="font-medium text-gray-900">{previewName}</div>
                                <div className="text-xs text-gray-500">{previewMobile}</div>
                              </div>
                            </div>
                            <div className="space-y-2 text-sm text-gray-600">
                              <div className="flex justify-between gap-3">
                                <span className="text-gray-400">当前阶段:</span>
                                <span>{(row.stage || "").trim() || "意向沟通中"}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-gray-400">客户来源:</span>
                                <span>{(row.source_channel || "").trim() || "微信客服"}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-gray-400">负责人:</span>
                                <span>{(row.owner_name || row.owner_userid || "待分配").trim()}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-gray-400">最新跟进:</span>
                                <span>{formatDateTime(row.last_interaction_at)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`flex h-5 w-5 items-center justify-center rounded ${sourceTone(row.source_channel)}`}>
                          <MessageSquare className="h-3 w-3" />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{(row.source_channel || "").trim() || "微信客服"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={`font-medium text-[10px] px-2 py-0.5 ${stageTone(row.stage)}`}>
                        {(row.stage || "").trim() || "意向沟通中"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {rowTags.length === 0 ? (
                          <span className="text-xs text-gray-400">暂无标签</span>
                        ) : (
                          <>
                            {rowTags.slice(0, 2).map((item) => (
                              <Badge key={item} variant="secondary" className="border-transparent bg-gray-100 px-1.5 py-0 text-[10px] font-medium text-gray-600">
                                {item}
                              </Badge>
                            ))}
                            {rowTags.length > 2 ? (
                              <Badge variant="secondary" className="border-transparent bg-blue-50 px-1.5 py-0 text-[10px] font-medium text-blue-600">
                                +{rowTags.length - 2}
                              </Badge>
                            ) : null}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{formatDateTime(row.last_interaction_at)}</div>
                      <div className="mt-0.5 flex items-center text-[11px] text-gray-400">
                        <UserPlus className="mr-1 h-3 w-3" />
                        {previewLabel(row)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Avatar src={(row.owner_avatar || "").trim()} fallback={(row.owner_name || row.owner_userid || "待").trim().slice(0, 1)} size="xs" />
                        <span className="text-sm text-gray-700">{(row.owner_name || row.owner_userid || "待分配").trim()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-all group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                          onClick={() => openEditDialog(row)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Link to={customerLink(externalUserID)}>
                          <Button variant="ghost" size="sm" className="px-2 text-xs font-semibold text-blue-600 hover:bg-blue-50">
                            详情
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <span className="text-sm text-gray-500">
            显示 {startIndex} 到 {endIndex} 条，共 {total} 条
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
          </div>
        </div>
      </div>

      <Dialog
        isOpen={!!editingRow}
        onClose={() => setEditingRow(null)}
        title="修改客户信息"
        className="max-w-[400px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingRow(null)}>
              取消
            </Button>
            <Button className="bg-blue-600" onClick={() => void handleSaveCustomer()} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存修改
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <Avatar
              src={(editingRow?.avatar || "").trim()}
              fallback={((editingRow?.name || "").trim() || "客").slice(0, 1)}
              size="sm"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">{(editingRow?.name || "未命名客户").trim()}</div>
              <div className="text-xs text-gray-500">{(editingRow?.mobile_masked || editingRow?.external_userid || "-").trim()}</div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">负责人</label>
            <select
              value={editOwner}
              onChange={(event) => setEditOwner(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">待分配</option>
              {ownerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {displayOptionLabel(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">生命周期阶段</label>
            <select
              value={editStage}
              onChange={(event) => setEditStage(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择阶段</option>
              {stageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {displayOptionLabel(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">客户标签</label>
            <textarea
              value={editTagsText}
              onChange={(event) => setEditTagsText(event.target.value)}
              rows={3}
              placeholder="使用顿号、逗号或换行分隔多个标签"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
