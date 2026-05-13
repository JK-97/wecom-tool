import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Edit2,
  MessageCircle,
  MessageSquare,
  Search,
  ShoppingCart,
  Tag,
  UserPlus,
} from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { EmptyState } from "@/components/ui/EmptyState"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { ChatDataPanel } from "@/components/chatdata/ChatDataPanel"
import { WecomProfileAvatarOpenDataFrame } from "@/components/wecom/WecomProfileAvatarOpenDataFrame"
import { WecomDirectoryOpenDataName } from "@/components/wecom/WecomDirectoryOpenDataName"
import { useChatDataPanel } from "@/hooks/useChatDataPanel"
import { updateCustomerProfile } from "@/services/customerListService"
import { getCustomer360View, type Customer360ViewModel } from "@/services/customer360Service"
import { normalizeErrorMessage } from "@/services/http"

type TimelineTab = "all" | "chat-history" | "cs" | "sales" | "order"

const STAGE_OPTIONS = ["意向沟通中", "已报价待签", "已成交", "流失"]

function formatDateTime(value?: string): string {
  const text = (value || "").trim()
  if (!text) return "-"
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) return text
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false })
}

function resolveTimelineTab(tab: TimelineTab): string | undefined {
  return tab === "chat-history" ? undefined : tab
}

function trackIcon(category?: string) {
  switch ((category || "").trim()) {
    case "sales":
      return { Icon: MessageCircle, bgClass: "bg-green-100", iconClass: "text-green-600" }
    case "order":
      return { Icon: ShoppingCart, bgClass: "bg-purple-100", iconClass: "text-purple-600" }
    case "cs":
      return { Icon: MessageSquare, bgClass: "bg-blue-100", iconClass: "text-blue-600" }
    default:
      return { Icon: ArrowUpRight, bgClass: "bg-orange-100", iconClass: "text-orange-600" }
  }
}

export default function Customer360() {
  const navigate = useNavigate()
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TimelineTab>("all")
  const [view, setView] = useState<Customer360ViewModel | null>(null)
  const [notice, setNotice] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [formOwner, setFormOwner] = useState("")
  const [formStage, setFormStage] = useState("意向沟通中")
  const [formTagInput, setFormTagInput] = useState("")
  const [formTags, setFormTags] = useState<string[]>([])

  const externalUserID = useMemo(() => {
    if (typeof window === "undefined") return ""
    const params = new URLSearchParams(window.location.search)
    return (params.get("external_userid") || "").trim()
  }, [])

  const loadView = async (timelineTab: TimelineTab) => {
    if (!externalUserID) {
      setView(null)
      return
    }
    const data = await getCustomer360View({
      external_userid: externalUserID,
      timeline_tab: resolveTimelineTab(timelineTab),
    })
    setView(data)
  }

  useEffect(() => {
    let alive = true
    if (!externalUserID) {
      setView(null)
      return
    }
    void getCustomer360View({
      external_userid: externalUserID,
      timeline_tab: resolveTimelineTab(activeTab),
    })
      .then((data) => {
        if (!alive) return
        setView(data)
      })
      .catch(() => {
        if (!alive) return
        setView(null)
      })
    return () => {
      alive = false
    }
  }, [activeTab, externalUserID])

  useEffect(() => {
    if (!isModifyModalOpen) return
    const currentTags = (view?.tags || []).map((item) => (item || "").trim()).filter(Boolean)
    setFormOwner((view?.owner_userid || view?.contact?.owner_userid || "").trim())
    setFormStage((view?.stage || "意向沟通中").trim())
    setFormTags(currentTags)
    setFormTagInput("")
  }, [isModifyModalOpen, view?.contact?.owner_userid, view?.owner_userid, view?.stage, view?.tags])

  const tags = useMemo(() => (view?.tags || []).map((item) => (item || "").trim()).filter(Boolean), [view?.tags])
  const timeline = useMemo(() => view?.timeline || [], [view?.timeline])
  const tasks = view?.tasks || []
  const lastSyncedAt = formatDateTime(view?.last_synced_at || view?.contact?.last_synced_at || view?.updated_at || view?.contact?.updated_at)
  const ownerUserID = (view?.owner_userid || view?.contact?.owner_userid || "").trim()
  const ownerOpenUserID = (view?.owner_open_userid || view?.contact?.owner_open_userid || "").trim()
  const ownerFallback = ownerUserID || "待分配"
  const chatdata = useChatDataPanel({
    target_type: "external_userid",
    target_id: externalUserID,
    surface: "customer_360",
  })

  const handleSaveProfile = async () => {
    if (!externalUserID) return
    try {
      setIsSaving(true)
      const result = await updateCustomerProfile({
        external_userid: externalUserID,
        owner_userid: formOwner,
        stage: formStage,
        tags: formTags,
      })
      setNotice((result?.message || "客户资料已更新").trim())
      setIsModifyModalOpen(false)
      await loadView(activeTab)
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const addTag = () => {
    const value = formTagInput.trim()
    if (!value) return
    setFormTags((previous) => (previous.includes(value) ? previous : [...previous, value]))
    setFormTagInput("")
  }

  const removeTag = (value: string) => {
    setFormTags((previous) => previous.filter((item) => item !== value))
  }

  if (!externalUserID) {
    return (
      <div className="flex h-full min-h-[720px] items-center justify-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <EmptyState icon={Tag} title="缺少客户参数" description="请通过 external_userid 打开客户详情。" />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[720px] flex-col gap-4">
      <div className="flex items-center">
        <Button variant="ghost" className="-ml-2 text-gray-500 hover:text-gray-900" onClick={() => navigate(-1)}>
          <ChevronLeft className="mr-1 h-5 w-5" />
          返回客户列表
        </Button>
      </div>

      <div className="flex h-full gap-6">
        <div className="w-[280px] shrink-0 space-y-6">
          <Card className="relative border-gray-200 shadow-sm group">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-blue-600"
              onClick={() => setIsModifyModalOpen(true)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <CardContent className="flex flex-col items-center p-6 text-center">
              <WecomProfileAvatarOpenDataFrame
                openID={externalUserID}
                type="externalUserAvatar"
                fallback={(view?.contact?.name || "").trim() || "客"}
                fallbackSrc={(view?.contact?.avatar || "").trim()}
                size="xl"
                className="mb-4"
              />
              <h2 className="text-xl font-bold text-gray-900">{(view?.contact?.name || "未命名客户").trim()}</h2>
              <p className="mt-1 text-sm text-gray-500">{externalUserID}</p>
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="success" className="border-green-200 bg-green-50 text-green-700">
                  @微信
                </Badge>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  {(view?.stage || "意向沟通中").trim()}
                </Badge>
              </div>
              <div className="mt-4 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-500">
                本页展示本地同步结果，最近同步：{lastSyncedAt}
              </div>
            </CardContent>
          </Card>

          <Card className="relative border-gray-200 shadow-sm group">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-blue-600"
              onClick={() => setIsModifyModalOpen(true)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Tag className="h-4 w-4 text-gray-400" /> 业务标签
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.length === 0 ? <span className="text-xs text-gray-500">暂无标签</span> : tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
              </div>
            </CardContent>
          </Card>

          <Card className="relative border-gray-200 shadow-sm group">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-blue-600"
              onClick={() => setIsModifyModalOpen(true)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <UserPlus className="h-4 w-4 text-gray-400" /> 归属信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-500">当前负责人</span>
                <div className="flex min-w-0 items-center gap-2">
                  <WecomProfileAvatarOpenDataFrame
                    openID={ownerOpenUserID}
                    fallback={ownerFallback}
                    size="xs"
                    className="border border-gray-100"
                  />
                  <WecomDirectoryOpenDataName
                    openID={ownerOpenUserID}
                    fallback={ownerFallback}
                    className="truncate font-medium text-gray-900"
                  />
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">来源渠道</span>
                <span className="font-medium text-gray-900">{(view?.source_channel || "微信客服").trim()}</span>
              </div>
              {notice ? <div className="text-xs text-blue-600">{notice}</div> : null}
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <Card className="flex flex-1 flex-col overflow-hidden border-gray-200 shadow-sm">
            <div className="shrink-0 border-b border-gray-100 bg-white p-4">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TimelineTab)}>
                <TabsList>
                  <TabsTrigger value="all">全部轨迹</TabsTrigger>
                  <TabsTrigger value="chat-history">会话回显</TabsTrigger>
                  <TabsTrigger value="cs">客服记录</TabsTrigger>
                  <TabsTrigger value="sales">跟进记录</TabsTrigger>
                  <TabsTrigger value="order">订单记录</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6">
              {activeTab === "chat-history" ? (
                <div className="h-full">
                  <ChatDataPanel
                    panel={chatdata.panel}
                    loading={chatdata.loading}
                    bootstrapping={chatdata.bootstrapping}
                    error={chatdata.error}
                    onReload={() => void chatdata.reload()}
                    onBootstrap={() => void chatdata.bootstrap("manual_retry", true)}
                  />
                </div>
              ) : timeline.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <EmptyState icon={ShoppingCart} title="暂无轨迹数据" description="当前筛选下没有可展示的轨迹记录。" />
                </div>
              ) : (
                <div className="relative ml-4 space-y-8 border-l-2 border-gray-200 pb-8">
                  {timeline.map((item) => {
                    const meta = trackIcon(item.category)
                    const Icon = meta.Icon
                    return (
                      <div key={item.id || `${item.title}-${item.occurred_at}`} className="relative pl-8">
                        <div className={`absolute -left-[11px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white ${meta.bgClass}`}>
                          <Icon className={`h-3 w-3 ${meta.iconClass}`} />
                        </div>
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{(item.title || "轨迹记录").trim()}</span>
                          <span className="text-xs text-gray-500">{formatDateTime(item.occurred_at)}</span>
                        </div>
                        <Card className="border-gray-100 p-4 shadow-sm">
                          <p className="text-sm text-gray-700">{(item.description || "暂无详细说明").trim()}</p>
                        </Card>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="w-[320px] shrink-0 space-y-6">
          <Card className="border-gray-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-blue-800">
                <span className="text-lg">✨</span> AI 客户总结
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-sm leading-relaxed text-gray-700">{(view?.ai_summary || "暂无 AI 总结").trim()}</p>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 p-4 pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" /> 当前待办任务
                </div>
                <Badge variant="secondary" className="border-transparent bg-orange-100 text-orange-700">
                  {tasks.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {tasks.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">暂无待办任务</div>
                ) : (
                  tasks.slice(0, 3).map((task) => (
                    <div key={task.id || task.title} className="cursor-pointer p-4 transition-colors hover:bg-gray-50">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <span className="text-sm font-medium text-gray-900">{(task.title || "未命名任务").trim()}</span>
                        <span className="flex items-center text-xs text-red-500">
                          <Clock className="mr-1 h-3 w-3" /> {task.due_at ? formatDateTime(task.due_at) : "待安排"}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-xs text-gray-500">{(task.description || "暂无任务描述").trim()}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        isOpen={isModifyModalOpen}
        onClose={() => setIsModifyModalOpen(false)}
        title="修改客户信息"
        className="max-w-[420px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModifyModalOpen(false)}>
              取消
            </Button>
            <Button className="bg-blue-600" onClick={() => void handleSaveProfile()} disabled={isSaving}>
              {isSaving ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存修改
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
            <WecomProfileAvatarOpenDataFrame
              openID={externalUserID}
              type="externalUserAvatar"
              fallback={(view?.contact?.name || "").trim() || "客"}
              fallbackSrc={(view?.contact?.avatar || "").trim()}
              size="sm"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">{(view?.contact?.name || "未命名客户").trim()}</div>
              <div className="text-xs text-gray-500">{externalUserID}</div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">负责人</label>
            <input
              value={formOwner}
              onChange={(event) => setFormOwner(event.target.value)}
              placeholder="请输入负责人 userid"
              className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">生命周期阶段</label>
            <select
              value={formStage}
              onChange={(event) => setFormStage(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">客户标签</label>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={formTagInput}
                onChange={(event) => setFormTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    addTag()
                  }
                }}
                type="text"
                placeholder="搜索或添加标签..."
                className="w-full rounded-md border border-gray-200 py-1.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {formTags.map((tag) => (
                <Badge key={tag} variant="outline" className="flex items-center gap-1 border-blue-200 bg-blue-50 text-xs text-blue-700">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-900">
                    ×
                  </button>
                </Badge>
              ))}
              <Button type="button" variant="outline" className="h-7 border-dashed text-xs" onClick={addTag}>
                + 添加标签
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
