import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Textarea } from "@/components/ui/Textarea"
import {
  ArrowLeft,
  Clock,
  UserPlus,
  CheckCircle2,
  MessageCircle,
  FileText,
  History,
  Paperclip,
  MoreVertical,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { normalizeErrorMessage } from "@/services/http"
import { executeTaskCommand, getTaskCenterView, getTaskDetailView, type TaskActivity, type TaskDetailView } from "@/services/taskCenterService"

function formatDateTime(value?: string): string {
  const raw = (value || "").trim()
  if (!raw) return "-"
  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) return raw
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false })
}

function formatDueAt(value?: string): string {
  const raw = (value || "").trim()
  if (!raw) return "无截止时间"
  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) return raw
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false })
}

function isPriorityHigh(detail: TaskDetailView | null): boolean {
  return (detail?.priority_label || "").trim() === "紧急"
}

function firstActivityLabel(activities: TaskActivity[]): string {
  if (activities.length === 0) return "-"
  return formatDateTime(activities[activities.length - 1]?.created_at)
}

function extractQueryTaskID(searchParams: URLSearchParams): string {
  const candidates = [searchParams.get("task_id"), searchParams.get("id")]
  for (const item of candidates) {
    const normalized = (item || "").trim()
    if (normalized) return normalized
  }
  return ""
}

export default function TaskDetailPage({ onBack }: { onBack: () => void }) {
  const [searchParams] = useSearchParams()
  const [taskID, setTaskID] = useState("")
  const [detail, setDetail] = useState<TaskDetailView | null>(null)
  const [summary, setSummary] = useState("")
  const [notice, setNotice] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmittingSummary, setIsSubmittingSummary] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isTriggeringFollowup, setIsTriggeringFollowup] = useState(false)
  const [isSubmittingAttachment, setIsSubmittingAttachment] = useState(false)

  const historyRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const fromQuery = extractQueryTaskID(searchParams)
    if (fromQuery) {
      setTaskID(fromQuery)
      return
    }
    void (async () => {
      try {
        const view = await getTaskCenterView({ scope: "my-tasks" })
        const fallback =
          (view?.todo_tasks?.[0]?.task_id || "").trim() ||
          (view?.in_progress_tasks?.[0]?.task_id || "").trim() ||
          (view?.done_tasks?.[0]?.task_id || "").trim()
        setTaskID(fallback)
      } catch (error) {
        setNotice(normalizeErrorMessage(error))
      }
    })()
  }, [searchParams])

  const loadDetail = useCallback(async () => {
    const id = (taskID || "").trim()
    if (!id) {
      setDetail(null)
      return
    }
    try {
      setIsLoading(true)
      const data = await getTaskDetailView(id)
      setDetail(data)
      setSummary((data?.latest_summary || "").trim())
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
      setDetail(null)
    } finally {
      setIsLoading(false)
    }
  }, [taskID])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const task = detail?.task
  const activities = useMemo(() => detail?.activities || [], [detail?.activities])

  const persistSummaryIfChanged = useCallback(async (): Promise<boolean> => {
    const id = (task?.id || "").trim()
    if (!id) return false
    const text = summary.trim()
    if (!text) return true
    const current = (detail?.latest_summary || "").trim()
    if (text === current) return true

    const result = await executeTaskCommand({
      command: "save_summary",
      task_id: id,
      payload: {
        summary: text,
        source: "task_detail_page",
      },
    })
    setNotice((result?.message || "小结已保存").trim())
    return result?.success !== false
  }, [detail?.latest_summary, summary, task?.id])

  const handleSaveSummary = useCallback(async () => {
    const id = (task?.id || "").trim()
    if (!id) {
      setNotice("未找到任务 ID")
      return
    }
    if (!summary.trim()) {
      setNotice("请先填写小结内容")
      return
    }
    try {
      setIsSubmittingSummary(true)
      const ok = await persistSummaryIfChanged()
      if (ok) {
        await loadDetail()
      }
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmittingSummary(false)
    }
  }, [loadDetail, persistSummaryIfChanged, summary, task?.id])

  const handleComplete = useCallback(async () => {
    const id = (task?.id || "").trim()
    if (!id) {
      setNotice("未找到任务 ID")
      return
    }
    try {
      setIsCompleting(true)
      const summaryOK = await persistSummaryIfChanged()
      if (!summaryOK) return
      const result = await executeTaskCommand({
        command: "complete_task",
        task_id: id,
        payload: {
          source: "task_detail_page",
        },
      })
      setNotice((result?.message || "任务已标记完成").trim())
      await loadDetail()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsCompleting(false)
    }
  }, [loadDetail, persistSummaryIfChanged, task?.id])

  const handleTriggerFollowup = useCallback(async () => {
    const id = (task?.id || "").trim()
    if (!id) {
      setNotice("未找到任务 ID")
      return
    }
    try {
      setIsTriggeringFollowup(true)
      const summaryOK = await persistSummaryIfChanged()
      if (!summaryOK) return
      const result = await executeTaskCommand({
        command: "trigger_followup",
        task_id: id,
        payload: {
          source: "task_detail_page",
          target: "wecom_client",
        },
      })
      setNotice((result?.message || "已提交企微跟进动作").trim())
      await loadDetail()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsTriggeringFollowup(false)
    }
  }, [loadDetail, persistSummaryIfChanged, task?.id])

  const handleAddAttachment = useCallback(async () => {
    const id = (task?.id || "").trim()
    if (!id) {
      setNotice("未找到任务 ID")
      return
    }
    try {
      setIsSubmittingAttachment(true)
      const result = await executeTaskCommand({
        command: "add_attachment_stub",
        task_id: id,
        payload: {
          source: "task_detail_page",
        },
      })
      setNotice((result?.message || "附件上传命令已记录（stub）").trim())
      await loadDetail()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmittingAttachment(false)
    }
  }, [loadDetail, task?.id])

  const highPriority = isPriorityHigh(detail)
  const ownerName = (detail?.owner_name || "").trim() || "待分配"
  const assignerName = (detail?.assigner_name || "").trim() || "系统"
  const relatedName = (detail?.related?.name || "").trim() || "待关联对象"
  const relatedSubtitle = (detail?.related?.subtitle || "").trim() || "-"
  const relatedAvatar = (detail?.related?.avatar || "").trim()

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA]">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="text-gray-500">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">{(task?.title || "").trim() || "未命名任务"}</h2>
                <Badge
                  variant={highPriority ? "destructive" : "outline"}
                  className={highPriority ? "bg-red-50 text-red-700 border-red-200 text-xs" : "bg-blue-50 text-blue-700 border-blue-200 text-xs"}
                >
                  {highPriority ? "🔴 紧急" : "🟦 普通"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                <span className="flex items-center text-red-600 font-medium">
                  <Clock className="w-4 h-4 mr-1" /> {formatDueAt(task?.due_at)}
                </span>
                <span className="flex items-center">
                  <UserPlus className="w-4 h-4 mr-1" /> 分配人：{assignerName}
                </span>
                <span className="flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> 状态：{(detail?.status_label || "").trim() || "待跟进"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="text-gray-600"
              onClick={() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <History className="w-4 h-4 mr-2" /> 流转历史
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleComplete} disabled={isCompleting || isLoading}>
              {isCompleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} 标记完成
            </Button>
            <Button variant="ghost" size="icon" onClick={() => void loadDetail()} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" /> : <MoreVertical className="w-5 h-5 text-gray-400" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {notice ? <div className="mb-4 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">{notice}</div> : null}

        {isLoading ? (
          <div className="h-[320px] flex items-center justify-center text-sm text-gray-500">
            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 任务详情加载中...</span>
          </div>
        ) : !task ? (
          <div className="h-[320px] flex items-center justify-center text-sm text-gray-500">
            未找到任务详情，请从任务中心重新进入。
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="p-4 border-b border-gray-100">
                  <CardTitle className="text-sm font-semibold text-gray-800">任务描述</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100 whitespace-pre-line">
                    {(task.description || "").trim() || "暂无任务描述"}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-sm" ref={historyRef}>
                <CardHeader className="p-4 border-b border-gray-100">
                  <CardTitle className="text-sm font-semibold text-gray-800">执行记录与小结</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-6">
                  <div className="space-y-3">
                    <Textarea
                      value={summary}
                      onChange={(event) => setSummary(event.target.value)}
                      placeholder="记录本次跟进的结果、客户反馈及下一步计划..."
                      className="min-h-[120px] text-sm border-gray-200 focus:ring-blue-500"
                    />
                    <div className="flex items-center justify-between">
                      <Button variant="ghost" size="sm" className="text-gray-500" onClick={handleAddAttachment} disabled={isSubmittingAttachment}>
                        {isSubmittingAttachment ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Paperclip className="w-4 h-4 mr-2" />} 添加附件
                      </Button>
                      <Button className="bg-blue-600 h-8 text-xs px-4" onClick={handleSaveSummary} disabled={isSubmittingSummary}>
                        {isSubmittingSummary ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null}
                        保存小结
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-6 pt-4 border-t border-gray-100">
                    {activities.length === 0 ? (
                      <div className="text-xs text-gray-500">暂无执行记录</div>
                    ) : (
                      activities.map((item) => {
                        const operatorName = (item.operator_name || "").trim() || "系统"
                        const content = (item.content || "").trim() || "更新了任务"
                        const createdAt = formatDateTime(item.created_at)
                        return (
                          <div key={item.id || `${item.activity_type}-${item.created_at}`} className="flex gap-4">
                            <Avatar fallback={operatorName.charAt(0)} size="sm" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-900">{operatorName}</span>
                                <span className="text-xs text-gray-400">{createdAt}</span>
                              </div>
                              <p className="text-sm text-gray-700 mt-1">{content}</p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="p-4 border-b border-gray-100">
                  <CardTitle className="text-sm font-semibold text-gray-800">关联客户</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg shadow-sm hover:border-blue-300 cursor-pointer transition-colors">
                    <Avatar src={relatedAvatar} fallback={relatedName.charAt(0)} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">{relatedName}</div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{relatedSubtitle}</div>
                    </div>
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-4 text-xs h-8 border-blue-200 text-blue-600 hover:bg-blue-50"
                    onClick={handleTriggerFollowup}
                    disabled={isTriggeringFollowup || !detail?.can_trigger_followup}
                  >
                    {isTriggeringFollowup ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />} 去企微跟进
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="p-4 border-b border-gray-100">
                  <CardTitle className="text-sm font-semibold text-gray-800">任务详情</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">优先级</span>
                    <Badge variant={highPriority ? "destructive" : "outline"} className={highPriority ? "text-[10px] py-0" : "text-[10px] py-0 bg-blue-50 text-blue-700 border-blue-200"}>
                      {(detail?.priority_label || "").trim() || "普通"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">截止时间</span>
                    <span className="text-xs text-gray-900 font-medium">{formatDateTime(task.due_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">任务类型</span>
                    <span className="text-xs text-gray-900 font-medium">{(detail?.task_type_label || "").trim() || "客户跟进"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">负责人</span>
                    <span className="text-xs text-gray-900 font-medium">{ownerName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">创建时间</span>
                    <span className="text-xs text-gray-900 font-medium">{formatDateTime(task.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">最近流转</span>
                    <span className="text-xs text-gray-900 font-medium">{firstActivityLabel(activities)}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900">AI 跟进建议</span>
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">
                  {(detail?.ai_suggestion || "").trim() || "暂无 AI 建议"}
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-500">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3.5 h-3.5" /> 任务 ID
                </div>
                <div className="break-all text-gray-700">{task.id}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
