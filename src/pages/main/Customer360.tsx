import { Badge } from "@/components/ui/Badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { Dialog } from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import {
  MessageSquare,
  ArrowUpRight,
  MessageCircle,
  ShoppingCart,
  Clock,
  Calendar,
  Tag,
  UserPlus,
  Edit2,
  Search,
  FileText,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { EmptyState } from "@/components/ui/EmptyState"
import { executeCustomer360Command, getCustomer360View, type Customer360ViewModel } from "@/services/customer360Service"
import { normalizeErrorMessage } from "@/services/http"

type TimelineTab = "all" | "cs" | "sales" | "order"

export default function Customer360() {
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TimelineTab>("all")
  const [view, setView] = useState<Customer360ViewModel | null>(null)
  const [notice, setNotice] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const [formName, setFormName] = useState("")
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
      timeline_tab: timelineTab,
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
      timeline_tab: activeTab,
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
    setFormName((view?.contact?.name || "").trim())
    setFormOwner((view?.owner_userid || "").trim())
    setFormStage((view?.stage || "意向沟通中").trim())
    setFormTags(currentTags)
    setFormTagInput("")
  }, [isModifyModalOpen, view?.contact?.name, view?.owner_userid, view?.stage, view?.tags])

  const tags = useMemo(() => (view?.tags || []).map((item) => (item || "").trim()).filter(Boolean), [view?.tags])
  const timeline = useMemo(() => view?.timeline || [], [view?.timeline])
  const firstTask = (view?.tasks || [])[0]

  const handleSaveProfile = async () => {
    if (!externalUserID) return
    try {
      setIsSaving(true)
      const result = await executeCustomer360Command({
        command: "customer360_update_profile",
        external_userid: externalUserID,
        payload: {
          name: formName,
          owner_userid: formOwner,
          stage: formStage,
          tags: formTags,
        },
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
    setFormTags((prev) => (prev.includes(value) ? prev : [...prev, value]))
    setFormTagInput("")
  }

  const removeTag = (value: string) => {
    setFormTags((prev) => prev.filter((item) => item !== value))
  }

  if (!externalUserID) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState icon={FileText} title="缺少客户参数" description="请通过 external_userid 打开客户 360 详情。" />
      </div>
    )
  }

  return (
    <div className="flex h-full gap-6">
      <div className="w-[280px] shrink-0 space-y-6">
        <Card className="border-gray-200 shadow-sm relative group">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsModifyModalOpen(true)}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Avatar src={(view?.contact?.avatar || "").trim()} size="xl" className="mb-4" />
            <h2 className="text-xl font-bold text-gray-900">{(view?.contact?.name || "未命名客户").trim()}</h2>
            <p className="text-sm text-gray-500 mt-1">{externalUserID}</p>
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="success" className="bg-green-50 text-green-700 border-green-200">
                @微信
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {(view?.stage || "意向沟通中").trim()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm relative group">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsModifyModalOpen(true)}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-400" /> 业务标签
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.length === 0 ? <span className="text-xs text-gray-500">暂无标签</span> : tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm relative group">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsModifyModalOpen(true)}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-gray-400" /> 归属信息
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">当前负责人</span>
              <span className="font-medium text-gray-900">{(view?.owner_userid || "待分配").trim()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">来源渠道</span>
              <span className="font-medium text-gray-900">{(view?.source_channel || "未知渠道").trim()}</span>
            </div>
            {notice ? <div className="text-xs text-blue-600">{notice}</div> : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <Card className="flex-1 flex flex-col border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-white shrink-0">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TimelineTab)}>
              <TabsList>
                <TabsTrigger value="all">全部轨迹</TabsTrigger>
                <TabsTrigger value="cs">客服记录</TabsTrigger>
                <TabsTrigger value="sales">跟进记录</TabsTrigger>
                <TabsTrigger value="order">订单记录</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
            {timeline.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <EmptyState icon={ShoppingCart} title="暂无轨迹数据" description="当前筛选下没有可展示的轨迹记录。" />
              </div>
            ) : (
              <div className="relative border-l-2 border-gray-200 ml-4 space-y-8 pb-8">
                {timeline.map((item) => {
                  const category = (item.category || "").trim()
                  const icon =
                    category === "sales" ? MessageCircle : category === "order" ? ShoppingCart : category === "cs" ? MessageSquare : ArrowUpRight
                  const Icon = icon
                  const bgClass = category === "sales" ? "bg-green-100" : category === "order" ? "bg-purple-100" : category === "cs" ? "bg-blue-100" : "bg-orange-100"
                  const iconClass = category === "sales" ? "text-green-600" : category === "order" ? "text-purple-600" : category === "cs" ? "text-blue-600" : "text-orange-600"
                  return (
                    <div key={item.id || `${item.title}-${item.occurred_at}`} className="relative pl-8">
                      <div className={`absolute -left-[11px] top-1 h-5 w-5 rounded-full ${bgClass} border-2 border-white flex items-center justify-center`}>
                        <Icon className={`w-3 h-3 ${iconClass}`} />
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900">{(item.title || "轨迹记录").trim()}</span>
                        <span className="text-xs text-gray-500">{(item.occurred_at || "").replace("T", " ").slice(0, 16)}</span>
                      </div>
                      <Card className="p-4 shadow-sm border-gray-100">
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
        <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
              <span className="text-lg">✨</span> AI 客户总结
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-gray-700 leading-relaxed">{(view?.ai_summary || "暂无 AI 总结").trim()}</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-gray-100">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" /> 当前待办任务
              </div>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-transparent">
                {(view?.tasks || []).length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {firstTask ? (
                <div className="p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{(firstTask.title || "未命名任务").trim()}</span>
                    <span className="text-xs text-red-500 flex items-center">
                      <Clock className="w-3 h-3 mr-1" /> {firstTask.due_at ? "有截止时间" : "-"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">{(firstTask.description || "暂无任务描述").trim()}</p>
                </div>
              ) : (
                <div className="p-4 text-sm text-gray-500">暂无待办任务</div>
              )}
            </div>
          </CardContent>
        </Card>
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
            <Button className="bg-blue-600" disabled={isSaving} onClick={() => void handleSaveProfile()}>
              保存修改
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <Avatar src={(view?.contact?.avatar || "").trim()} size="sm" />
            <div>
              <div className="font-medium text-gray-900 text-sm">{(view?.contact?.name || "未命名客户").trim()}</div>
              <div className="text-xs text-gray-500">{externalUserID}</div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">客户名称</label>
            <input
              type="text"
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">负责人</label>
            <input
              type="text"
              value={formOwner}
              onChange={(event) => setFormOwner(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">生命周期阶段</label>
            <select
              value={formStage}
              onChange={(event) => setFormStage(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>意向沟通中</option>
              <option>已报价待签</option>
              <option>已成交</option>
              <option>流失</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">客户标签</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formTagInput}
                onChange={(event) => setFormTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    addTag()
                  }
                }}
                placeholder="搜索或添加标签..."
                className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {formTags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                  {tag} <span className="cursor-pointer hover:text-blue-900" onClick={() => removeTag(tag)}>×</span>
                </Badge>
              ))}
              <Badge variant="outline" className="text-xs text-gray-600 border-gray-200 cursor-pointer hover:bg-gray-50 border-dashed" onClick={addTag}>
                + 添加标签
              </Badge>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
