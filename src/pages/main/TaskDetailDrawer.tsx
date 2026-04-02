import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Textarea } from "@/components/ui/Textarea"
import { X, Clock, ArrowRight, MessageCircle, CheckCircle2, UserPlus, FileText, Loader2 } from "lucide-react"
import { normalizeErrorMessage } from "@/services/http"
import { executeTaskCommand, getTaskDetailView, type TaskDetailView } from "@/services/taskCenterService"

export default function TaskDetailDrawer({
  taskId,
  onClose,
  onChanged,
}: {
  taskId: string
  onClose: () => void
  onChanged?: () => Promise<void> | void
}) {
  const [detail, setDetail] = useState<TaskDetailView | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [summary, setSummary] = useState("")
  const [notice, setNotice] = useState("")

  const loadDetail = async () => {
    const id = (taskId || "").trim()
    if (!id) return
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
  }

  useEffect(() => {
    void loadDetail()
  }, [taskId])

  const task = detail?.task
  const activities = detail?.activities || []

  const priorityBadgeClass = useMemo(() => {
    const label = (detail?.priority_label || "").trim()
    if (label === "紧急") {
      return "bg-red-50 text-red-700 border-red-200"
    }
    return "bg-blue-50 text-blue-700 border-blue-200"
  }, [detail?.priority_label])

  const persistSummaryIfNeeded = async (): Promise<boolean> => {
    const text = summary.trim()
    if (!text) return true
    const existing = (detail?.latest_summary || "").trim()
    if (existing === text) return true
    const result = await executeTaskCommand({
      command: "save_summary",
      task_id: (task?.id || "").trim(),
      payload: {
        summary: text,
      },
    })
    setNotice((result?.message || "小结已保存").trim())
    return result?.success !== false
  }

  const handleTriggerFollowup = async () => {
    const id = (task?.id || "").trim()
    if (!id) return
    try {
      setIsSubmitting(true)
      const summaryOK = await persistSummaryIfNeeded()
      if (!summaryOK) return
      const result = await executeTaskCommand({
        command: "trigger_followup",
        task_id: id,
        payload: {
          source: "task_detail_drawer",
          target: "wecom_client",
        },
      })
      setNotice((result?.message || "已提交企微跟进动作").trim())
      await loadDetail()
      if (onChanged) {
        await onChanged()
      }
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCompleteTask = async () => {
    const id = (task?.id || "").trim()
    if (!id) return
    try {
      setIsSubmitting(true)
      const summaryOK = await persistSummaryIfNeeded()
      if (!summaryOK) return
      const result = await executeTaskCommand({
        command: "complete_task",
        task_id: id,
        payload: {
          source: "task_detail_drawer",
        },
      })
      setNotice((result?.message || "任务已标记完成").trim())
      await loadDetail()
      if (onChanged) {
        await onChanged()
      }
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="w-[480px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="h-16 border-b border-gray-200 px-6 flex items-center justify-between shrink-0 bg-gray-50">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`${priorityBadgeClass} text-xs`}>
              {detail?.priority_label === "紧急" ? "🔴 紧急升级" : "🟦 常规任务"}
            </Badge>
            <span className="text-sm font-medium text-gray-900">任务详情</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-500 hover:text-gray-900">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 数据加载中...</span>
            </div>
          ) : !task ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">任务不存在或暂无数据</div>
          ) : (
            <>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{(task.title || "").trim() || "未命名任务"}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span className="flex items-center text-red-600 font-medium">
                    <Clock className="w-4 h-4 mr-1" /> {(task.due_at || "").trim() ? new Date(task.due_at || "").toLocaleString("zh-CN", { hour12: false }) : "无截止时间"}
                  </span>
                  <span className="flex items-center">
                    <UserPlus className="w-4 h-4 mr-1" /> 分配人：{(detail?.assigner_name || "").trim() || "系统"}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100">
                  {(task.description || "").trim() || "暂无任务描述"}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">关联客户</h4>
                <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar src={(detail?.related?.avatar || "").trim()} fallback={((detail?.related?.name || "").trim() || "关").charAt(0)} />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{(detail?.related?.name || "").trim() || "待关联对象"}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{(detail?.related?.subtitle || "").trim() || "-"}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">流转记录</h4>
                <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pb-2">
                  {activities.length === 0 ? (
                    <div className="relative pl-6 text-xs text-gray-500">暂无流转记录</div>
                  ) : (
                    activities.map((item) => (
                      <div key={item.id || `${item.activity_type}-${item.created_at}`} className="relative pl-6">
                        <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        </div>
                        <div className="text-sm font-medium text-gray-900">{(item.operator_name || "").trim() || "系统"} {(item.content || "").trim() || "更新了任务"}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{(item.created_at || "").trim() ? new Date(item.created_at || "").toLocaleString("zh-CN", { hour12: false }) : "-"}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-200 bg-white p-6 shrink-0 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
          {notice ? <div className="mb-3 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded px-3 py-2">{notice}</div> : null}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4" /> 填写跟进小结
            </label>
            <Textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="记录本次跟进的结果、客户反馈及下一步计划..."
              className="min-h-[100px] resize-none text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={handleTriggerFollowup}
              disabled={isSubmitting || !detail?.can_trigger_followup}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
              去企微跟进
            </Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleCompleteTask} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              标记完成
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
