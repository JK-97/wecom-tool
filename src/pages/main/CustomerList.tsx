import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { Dialog } from "@/components/ui/Dialog"
import { Search, Filter, ChevronLeft, ChevronRight, MessageSquare, UserPlus, Edit2, Loader2 } from "lucide-react"
import { Link } from "react-router-dom"
import { useCallback, useEffect, useMemo, useState } from "react"
import { normalizeErrorMessage } from "@/services/http"
import {
  executeCustomerListCommand,
  getCustomerListView,
  type CustomerListFilterOption,
  type CustomerListRow,
  type CustomerListViewModel,
} from "@/services/customerListService"

type CustomerTab = "all" | "today" | "todo" | "upgraded"

const PAGE_SIZE = 10
const KNOWN_STAGES = ["意向沟通中", "已报价待签", "已成交", "流失"]

function formatDateTime(value?: string): string {
  const text = (value || "").trim()
  if (!text) return "-"
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) {
    return text
  }
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false })
}

function normalizeTagList(tags?: string[]): string[] {
  return (tags || []).map((tag) => (tag || "").trim()).filter((tag) => tag !== "")
}

function shouldDisplayTag(tag: string): boolean {
  return KNOWN_STAGES.indexOf(tag) < 0 && tag !== "今日新增"
}

function stageBadgeClass(stage: string): string {
  const normalized = stage.trim()
  if (normalized === "已成交") {
    return "bg-green-50 text-green-700 border-green-200"
  }
  if (normalized === "已报价待签") {
    return "bg-purple-50 text-purple-700 border-purple-200"
  }
  if (normalized === "流失") {
    return "bg-gray-100 text-gray-700 border-gray-200"
  }
  return "bg-blue-50 text-blue-700 border-blue-100"
}

function displayOptionLabel(option: CustomerListFilterOption): string {
  const label = (option.label || "").trim()
  const value = (option.value || "").trim()
  return label || value
}

function buildPaginationPages(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }
  if (currentPage <= 3) {
    return [1, 2, 3, "ellipsis", totalPages]
  }
  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages]
  }
  return [1, "ellipsis", currentPage, "ellipsis", totalPages]
}

export default function CustomerList() {
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isBatchAssigning, setIsBatchAssigning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState("")

  const [activeTab, setActiveTab] = useState<CustomerTab>("all")
  const [queryInput, setQueryInput] = useState("")
  const [query, setQuery] = useState("")
  const [stage, setStage] = useState("")
  const [tag, setTag] = useState("")
  const [owner, setOwner] = useState("")
  const [page, setPage] = useState(1)

  const [view, setView] = useState<CustomerListViewModel | null>(null)
  const [selectedIDs, setSelectedIDs] = useState<string[]>([])

  const [editingCustomer, setEditingCustomer] = useState<CustomerListRow | null>(null)
  const [editOwner, setEditOwner] = useState("")
  const [editStage, setEditStage] = useState("")
  const [editTags, setEditTags] = useState<string[]>([])
  const [editTagInput, setEditTagInput] = useState("")

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(queryInput.trim())
      setPage(1)
    }, 260)
    return () => window.clearTimeout(timer)
  }, [queryInput])

  const loadView = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await getCustomerListView({
        tab: activeTab,
        query,
        stage,
        tag,
        owner_userid: owner,
        page,
        page_size: PAGE_SIZE,
      })
      setView(data)
      const currentIDs = new Set((data?.rows || []).map((row) => (row.external_userid || "").trim()).filter((id) => id !== ""))
      setSelectedIDs((previous) => previous.filter((id) => currentIDs.has(id)))
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
      setView(null)
      setSelectedIDs([])
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, query, stage, tag, owner, page])

  useEffect(() => {
    void loadView()
  }, [loadView])

  const rows = view?.rows || []
  const summary = view?.summary || {}
  const stageOptions = (view?.stage_options || []).filter((item) => (item.value || "").trim() !== "")
  const tagOptions = (view?.tag_options || []).filter((item) => (item.value || "").trim() !== "")
  const ownerOptions = (view?.owner_options || []).filter((item) => (item.value || "").trim() !== "")

  const total = Number(view?.pagination?.total || 0)
  const currentPage = Math.max(1, Number(view?.pagination?.page || page || 1))
  const totalPages = Math.max(1, Number(view?.pagination?.total_pages || 1))
  const pageButtons = useMemo(() => buildPaginationPages(currentPage, totalPages), [currentPage, totalPages])

  const startIndex = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const endIndex = total === 0 ? 0 : Math.min(total, (currentPage - 1) * PAGE_SIZE + rows.length)

  const selectedOnPage = useMemo(() => {
    const currentIDs = rows.map((row) => (row.external_userid || "").trim()).filter((id) => id !== "")
    return currentIDs.filter((id) => selectedIDs.includes(id))
  }, [rows, selectedIDs])

  const allCurrentSelected = rows.length > 0 && selectedOnPage.length === rows.length

  const toggleSelectAllCurrent = (checked: boolean) => {
    const currentIDs = rows.map((row) => (row.external_userid || "").trim()).filter((id) => id !== "")
    if (checked) {
      setSelectedIDs((previous) => {
        const merged = new Set([...previous, ...currentIDs])
        return Array.from(merged)
      })
      return
    }
    setSelectedIDs((previous) => previous.filter((id) => currentIDs.indexOf(id) < 0))
  }

  const toggleSelectOne = (externalUserID: string, checked: boolean) => {
    const targetID = externalUserID.trim()
    if (!targetID) return
    if (checked) {
      setSelectedIDs((previous) => (previous.includes(targetID) ? previous : [...previous, targetID]))
      return
    }
    setSelectedIDs((previous) => previous.filter((id) => id !== targetID))
  }

  const openModifyModal = (row: CustomerListRow) => {
    const targetStage = (row.stage || "").trim() || "意向沟通中"
    setEditingCustomer(row)
    setEditOwner((row.owner_userid || "").trim())
    setEditStage(targetStage)
    setEditTags(normalizeTagList(row.tags).filter((item) => shouldDisplayTag(item)))
    setEditTagInput("")
    setIsModifyModalOpen(true)
  }

  const addEditTag = () => {
    const value = editTagInput.trim()
    if (!value) return
    if (editTags.includes(value)) {
      setEditTagInput("")
      return
    }
    setEditTags((previous) => [...previous, value])
    setEditTagInput("")
  }

  const removeEditTag = (target: string) => {
    setEditTags((previous) => previous.filter((item) => item !== target))
  }

  const handleSaveCustomer = async () => {
    const externalUserID = (editingCustomer?.external_userid || "").trim()
    if (!externalUserID) {
      setNotice("当前客户缺少 external_userid，无法保存")
      return
    }
    try {
      setIsSaving(true)
      const result = await executeCustomerListCommand({
        command: "update_customer",
        external_userid: externalUserID,
        payload: {
          owner_userid: editOwner,
          stage: editStage,
          tags: editTags,
        },
      })
      setNotice((result?.message || "客户信息已更新").trim())
      setIsModifyModalOpen(false)
      await loadView()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const handleBatchAssign = async () => {
    if (selectedIDs.length === 0) {
      setNotice("请先勾选至少一位客户")
      return
    }
    const targetOwner = owner.trim()
    if (!targetOwner) {
      setNotice("请先在“负责人”筛选中选择要分配给谁")
      return
    }
    try {
      setIsBatchAssigning(true)
      const result = await executeCustomerListCommand({
        command: "batch_assign",
        external_userids: selectedIDs,
        payload: {
          owner_userid: targetOwner,
        },
      })
      setNotice((result?.message || "批量分配完成").trim())
      setSelectedIDs([])
      await loadView()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsBatchAssigning(false)
    }
  }

  const handleImportCustomers = async () => {
    try {
      setIsImporting(true)
      const result = await executeCustomerListCommand({
        command: "import_customers",
        payload: {
          count: 3,
          name_prefix: "导入客户",
        },
      })
      setNotice((result?.message || "导入完成").trim())
      setPage(1)
      await loadView()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="flex h-full flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab((value as CustomerTab) || "all")
            setPage(1)
          }}
        >
          <TabsList className="bg-white border border-gray-200 shadow-sm">
            <TabsTrigger value="all" className="data-[state=active]:bg-gray-100">
              全部客户 ({summary.all_count ?? 0})
            </TabsTrigger>
            <TabsTrigger value="today" className="data-[state=active]:bg-gray-100">
              今日新增 ({summary.today_count ?? 0})
            </TabsTrigger>
            <TabsTrigger value="todo" className="data-[state=active]:bg-gray-100 text-orange-600">
              待跟进 ({summary.todo_count ?? 0})
            </TabsTrigger>
            <TabsTrigger value="upgraded" className="data-[state=active]:bg-gray-100 text-blue-600">
              来自客服升级 ({summary.upgraded_count ?? 0})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="text-gray-600 border-gray-200 hover:bg-gray-50"
            onClick={handleBatchAssign}
            disabled={isBatchAssigning || selectedIDs.length === 0}
          >
            {isBatchAssigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            批量分配
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleImportCustomers} disabled={isImporting}>
            {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            导入客户
          </Button>
        </div>
      </div>

      <div className="p-4 border-b border-gray-100 bg-white flex items-center gap-4 shrink-0">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="搜索客户姓名、手机号..."
            className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="h-6 w-px bg-gray-200 mx-2"></div>
        <select
          className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={stage}
          onChange={(event) => {
            setStage(event.target.value)
            setPage(1)
          }}
        >
          <option value="">生命周期阶段</option>
          {(stageOptions.length > 0 ? stageOptions : KNOWN_STAGES.map((value) => ({ value, label: value }))).map((option) => (
            <option key={option.value || option.label} value={(option.value || "").trim()}>
              {displayOptionLabel(option)}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={tag}
          onChange={(event) => {
            setTag(event.target.value)
            setPage(1)
          }}
        >
          <option value="">客户标签</option>
          {tagOptions.map((option) => (
            <option key={option.value || option.label} value={(option.value || "").trim()}>
              {displayOptionLabel(option)}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={owner}
          onChange={(event) => {
            setOwner(event.target.value)
            setPage(1)
          }}
        >
          <option value="">负责人</option>
          {ownerOptions.map((option) => (
            <option key={option.value || option.label} value={(option.value || "").trim()}>
              {displayOptionLabel(option)}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          className="text-blue-600 hover:bg-blue-50 ml-auto"
          onClick={() => {
            setQueryInput("")
            setQuery("")
            setStage("")
            setTag("")
            setOwner("")
            setPage(1)
          }}
        >
          <Filter className="w-4 h-4 mr-2" /> 更多筛选
        </Button>
      </div>

      {notice ? <div className="px-4 py-2 text-xs text-blue-600 border-b border-gray-100 bg-blue-50">{notice}</div> : null}

      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left text-sm text-gray-600 border-separate border-spacing-0">
          <thead className="sticky top-0 bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-200 z-10">
            <tr>
              <th className="px-6 py-3 font-semibold w-12 border-b border-gray-200">
                <input
                  type="checkbox"
                  checked={allCurrentSelected}
                  onChange={(event) => toggleSelectAllCurrent(event.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-6 py-3 font-semibold border-b border-gray-200">客户信息</th>
              <th className="px-6 py-3 font-semibold border-b border-gray-200">来源渠道</th>
              <th className="px-6 py-3 font-semibold border-b border-gray-200">当前阶段</th>
              <th className="px-6 py-3 font-semibold border-b border-gray-200">核心标签</th>
              <th className="px-6 py-3 font-semibold border-b border-gray-200">最新互动时间</th>
              <th className="px-6 py-3 font-semibold border-b border-gray-200">负责人</th>
              <th className="px-6 py-3 font-semibold text-right border-b border-gray-200">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> 数据加载中...
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500">暂无客户数据</td>
              </tr>
            ) : (
              rows.map((row) => {
                const externalUserID = (row.external_userid || "").trim()
                const tags = normalizeTagList(row.tags).filter((item) => shouldDisplayTag(item))
                const checked = externalUserID !== "" && selectedIDs.includes(externalUserID)
                const customerName = (row.name || "").trim() || "未命名客户"
                const ownerName = (row.owner_name || "").trim() || (row.owner_userid || "").trim() || "待分配"
                return (
                  <tr key={externalUserID || customerName} className="hover:bg-blue-50/40 transition-colors group">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => toggleSelectOne(externalUserID, event.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={(row.avatar || "").trim()}
                          fallback={customerName.charAt(0)}
                          size="sm"
                          className="border border-gray-100"
                        />
                        <div className="flex flex-col">
                          <Link
                            to={`/main/customer-360?external_userid=${encodeURIComponent(externalUserID)}`}
                            className="font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                          >
                            {customerName}
                          </Link>
                          <div className="text-[11px] text-gray-400 font-mono">{(row.mobile_masked || "").trim() || "-"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded bg-blue-50 flex items-center justify-center">
                          <MessageSquare className="w-3 h-3 text-blue-500" />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{(row.source_channel || "").trim() || "微信客服"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={`${stageBadgeClass((row.stage || "").trim())} font-medium text-[10px] px-2 py-0.5`}>
                        {(row.stage || "").trim() || "意向沟通中"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {tags.length === 0 ? (
                          <span className="text-xs text-gray-400">-</span>
                        ) : (
                          tags.slice(0, 3).map((item) => (
                            <Badge
                              key={`${externalUserID}-${item}`}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600 border-transparent font-medium"
                            >
                              {item}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{formatDateTime(row.last_interaction_at)}</div>
                      <div className="text-[11px] text-gray-400 flex items-center mt-0.5">
                        <UserPlus className="w-3 h-3 mr-1" />
                        {(row.last_interaction_label || "").trim() || "单聊跟进"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Avatar src={(row.owner_avatar || "").trim()} fallback={ownerName.charAt(0)} size="xs" />
                        <span className="text-sm text-gray-700">{ownerName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => openModifyModal(row)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Link to={`/main/customer-360?external_userid=${encodeURIComponent(externalUserID)}`}>
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50 font-semibold text-xs px-2">
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

      <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between shrink-0">
        <span className="text-sm text-gray-500">
          显示 {startIndex} 到 {endIndex} 条，共 {total} 条
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={currentPage <= 1}
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pageButtons.map((item, index) => {
            if (item === "ellipsis") {
              return (
                <span key={`ellipsis-${index}`} className="text-gray-400 px-1">
                  ...
                </span>
              )
            }
            const isCurrent = item === currentPage
            return (
              <Button
                key={`page-${item}`}
                variant="outline"
                size="sm"
                className={`h-8 w-8 p-0 ${isCurrent ? "bg-blue-50 text-blue-600 border-blue-200" : ""}`}
                onClick={() => setPage(item)}
              >
                {item}
              </Button>
            )
          })}
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

      <Dialog
        isOpen={isModifyModalOpen}
        onClose={() => setIsModifyModalOpen(false)}
        title="修改客户信息"
        className="max-w-[400px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModifyModalOpen(false)}>
              取消
            </Button>
            <Button className="bg-blue-600" onClick={handleSaveCustomer} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              保存修改
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <Avatar
              src={(editingCustomer?.avatar || "").trim()}
              fallback={((editingCustomer?.name || "").trim() || "客").charAt(0)}
              size="sm"
            />
            <div>
              <div className="font-medium text-gray-900 text-sm">{(editingCustomer?.name || "").trim() || "未命名客户"}</div>
              <div className="text-xs text-gray-500">{(editingCustomer?.mobile_masked || "").trim() || "-"}</div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">负责人</label>
            <select
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editOwner}
              onChange={(event) => setEditOwner(event.target.value)}
            >
              {ownerOptions.map((option) => (
                <option key={option.value || option.label} value={(option.value || "").trim()}>
                  {displayOptionLabel(option)}
                </option>
              ))}
              {editOwner && ownerOptions.every((item) => (item.value || "").trim() !== editOwner) ? (
                <option value={editOwner}>{editOwner}</option>
              ) : null}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">生命周期阶段</label>
            <select
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editStage}
              onChange={(event) => setEditStage(event.target.value)}
            >
              {(stageOptions.length > 0 ? stageOptions : KNOWN_STAGES.map((value) => ({ value, label: value }))).map((option) => (
                <option key={option.value || option.label} value={(option.value || "").trim()}>
                  {displayOptionLabel(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">客户标签</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={editTagInput}
                onChange={(event) => setEditTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    addEditTag()
                  }
                }}
                placeholder="搜索或添加标签..."
                className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {editTags.map((item) => (
                <Badge key={item} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                  {item}
                  <span className="cursor-pointer hover:text-blue-900" onClick={() => removeEditTag(item)}>
                    ×
                  </span>
                </Badge>
              ))}
              <Badge
                variant="outline"
                className="text-xs text-gray-600 border-gray-200 cursor-pointer hover:bg-gray-50 border-dashed"
                onClick={addEditTag}
              >
                + 添加标签
              </Badge>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
