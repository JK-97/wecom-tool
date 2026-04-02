import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Clock, MoreHorizontal, Search, ClipboardList, Loader2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { EmptyState } from "@/components/ui/EmptyState"
import { normalizeErrorMessage } from "@/services/http"
import {
  executeTaskCommand,
  getTaskCenterView,
  type TaskCard,
  type TaskCenterView,
} from "@/services/taskCenterService"
import TaskDetailDrawer from "./TaskDetailDrawer"

type TaskScope = "my-tasks" | "team-tasks" | "today" | "overdue"

function taskBadgeClass(card: TaskCard): string {
  const tone = (card.badge_tone || "").trim()
  if (tone === "danger") return "bg-red-50 text-red-700 border-red-200"
  if (tone === "warning") return "bg-red-50 text-red-700 border-red-200"
  if (tone === "info") return "bg-blue-50 text-blue-700 border-blue-200"
  if (tone === "neutral") return "bg-gray-100 text-gray-600 border-gray-200"
  return "bg-gray-100 text-gray-600 border-gray-200"
}

function dueLabelClass(label: string): string {
  const normalized = label.trim()
  if (normalized === "已逾期") return "text-red-600"
  if (normalized === "今日截止") return "text-red-600"
  return "text-gray-500"
}

export default function TaskCenter() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerTaskID, setDrawerTaskID] = useState("")
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false)
  const [isUpdateProgressModalOpen, setIsUpdateProgressModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TaskScope>("my-tasks")

  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [commandLoadingTaskID, setCommandLoadingTaskID] = useState("")
  const [notice, setNotice] = useState("")

  const [taskType, setTaskType] = useState("")
  const [query, setQuery] = useState("")
  const [ownerFilter, setOwnerFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [sourceFilter, setSourceFilter] = useState("")

  const [view, setView] = useState<TaskCenterView | null>(null)

  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskTarget, setNewTaskTarget] = useState("")
  const [newTaskOwner, setNewTaskOwner] = useState("")
  const [newTaskDueAt, setNewTaskDueAt] = useState("")
  const [newTaskPriority, setNewTaskPriority] = useState("normal")
  const [newTaskDescription, setNewTaskDescription] = useState("")

  const [progressTask, setProgressTask] = useState<TaskCard | null>(null)
  const [progressStatus, setProgressStatus] = useState("in_progress")
  const [progressNote, setProgressNote] = useState("")
  const [progressDueAt, setProgressDueAt] = useState("")

  const loadView = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await getTaskCenterView({
        scope: activeTab,
        task_type: taskType,
        query: query.trim(),
        owner_userid: ownerFilter,
        priority: priorityFilter,
        source_domain: sourceFilter,
      })
      setView(data)
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
      setView(null)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, taskType, query, ownerFilter, priorityFilter, sourceFilter])

  useEffect(() => {
    void loadView()
  }, [loadView])

  const todoTasks = view?.todo_tasks || []
  const inProgressTasks = view?.in_progress_tasks || []
  const doneTasks = view?.done_tasks || []

  const taskTypeOptions = useMemo(() => view?.type_options || [], [view?.type_options])
  const ownerOptions = useMemo(() => view?.owner_options || [], [view?.owner_options])
  const priorityOptions = useMemo(() => view?.priority_options || [], [view?.priority_options])
  const sourceOptions = useMemo(() => view?.source_options || [], [view?.source_options])

  useEffect(() => {
    if (!newTaskOwner && ownerOptions.length > 0) {
      const first = (ownerOptions[0].value || "").trim()
      if (first) {
        setNewTaskOwner(first)
      }
    }
  }, [newTaskOwner, ownerOptions])

  const openDrawer = (taskID: string) => {
    const normalized = taskID.trim()
    if (!normalized) return
    setDrawerTaskID(normalized)
    setIsDrawerOpen(true)
  }

  const openProgressModal = (task: TaskCard) => {
    setProgressTask(task)
    setProgressStatus((task.status || "in_progress").trim() || "in_progress")
    setProgressNote("")
    const rawDue = (task.due_at || "").trim()
    if (rawDue) {
      const parsed = Date.parse(rawDue)
      if (!Number.isNaN(parsed)) {
        const date = new Date(parsed)
        const offset = date.getTimezoneOffset()
        const local = new Date(date.getTime() - offset * 60 * 1000)
        setProgressDueAt(local.toISOString().slice(0, 16))
      } else {
        setProgressDueAt("")
      }
    } else {
      setProgressDueAt("")
    }
    setIsUpdateProgressModalOpen(true)
  }

  const handleTriggerFollowup = async (task: TaskCard) => {
    const taskID = (task.task_id || "").trim()
    if (!taskID) return
    try {
      setCommandLoadingTaskID(taskID)
      const result = await executeTaskCommand({
        command: "trigger_followup",
        task_id: taskID,
        payload: {
          target: "wecom_client",
          scene: "task_center_card",
        },
      })
      setNotice((result?.message || "已提交跟进动作").trim())
      await loadView()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setCommandLoadingTaskID("")
    }
  }

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      setNotice("请输入任务标题")
      return
    }
    if (!newTaskOwner.trim()) {
      setNotice("请选择负责人")
      return
    }
    if (!newTaskDueAt.trim()) {
      setNotice("请选择截止时间")
      return
    }

    const dueAt = new Date(newTaskDueAt)
    if (Number.isNaN(dueAt.getTime())) {
      setNotice("截止时间格式不正确")
      return
    }

    try {
      setIsCreating(true)
      const isGroup = newTaskTarget.includes("群")
      const result = await executeTaskCommand({
        command: "create_task",
        payload: {
          title: newTaskTitle.trim(),
          target_type: isGroup ? "group" : "customer",
          target_name: newTaskTarget.trim() || "待关联对象",
          owner_userid: newTaskOwner.trim(),
          due_at: dueAt.toISOString(),
          priority: newTaskPriority,
          source_domain: isGroup ? "group" : "contact",
          description: newTaskDescription.trim(),
        },
      })
      setNotice((result?.message || "任务已创建").trim())
      setIsNewTaskModalOpen(false)
      setNewTaskTitle("")
      setNewTaskTarget("")
      setNewTaskDueAt("")
      setNewTaskPriority("normal")
      setNewTaskDescription("")
      await loadView()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateProgress = async () => {
    const taskID = (progressTask?.task_id || "").trim()
    if (!taskID) {
      setNotice("当前任务不可更新")
      return
    }
    if (!progressNote.trim()) {
      setNotice("请填写进度说明")
      return
    }
    let dueAtISO = ""
    if (progressDueAt.trim()) {
      const dueAt = new Date(progressDueAt)
      if (Number.isNaN(dueAt.getTime())) {
        setNotice("调整截止时间格式不正确")
        return
      }
      dueAtISO = dueAt.toISOString()
    }
    try {
      setIsUpdating(true)
      const result = await executeTaskCommand({
        command: "update_progress",
        task_id: taskID,
        payload: {
          status: progressStatus,
          progress_note: progressNote.trim(),
          due_at: dueAtISO,
        },
      })
      setNotice((result?.message || "进度已更新").trim())
      setIsUpdateProgressModalOpen(false)
      setProgressTask(null)
      setProgressNote("")
      await loadView()
      if (drawerTaskID && drawerTaskID === taskID) {
        setDrawerTaskID(taskID)
      }
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsUpdating(false)
    }
  }

  const renderColumn = (title: string, count: number, tasks: TaskCard[], variant: "todo" | "in_progress" | "done") => {
    const badgeClass =
      variant === "todo"
        ? "bg-gray-200 text-gray-600"
        : variant === "in_progress"
          ? "bg-blue-100 text-blue-700"
          : "bg-green-100 text-green-700"

    return (
      <div className={`flex w-[350px] shrink-0 flex-col rounded-xl bg-gray-100/80 p-4 ${variant === "done" ? "opacity-70 hover:opacity-100 transition-opacity" : ""}`}>
        <div className="mb-4 flex items-center justify-between px-1">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            {title} <Badge variant="secondary" className={badgeClass}>{count}</Badge>
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-500"
            onClick={async (event) => {
              event.stopPropagation()
              setNotice(`已刷新${title}列表`)
              await loadView()
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">
              <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 数据加载中...</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState icon={ClipboardList} title="暂无任务" description="当前筛选条件下没有任务。" />
            </div>
          ) : (
            tasks.map((task) => {
              const taskID = (task.task_id || "").trim()
              const ownerName = (task.owner_name || "").trim() || "待分配"
              const ownerAvatar = (task.owner_avatar || "").trim()
              const dueLabel = (task.due_label || "").trim() || "无截止时间"
              const statusDone = (task.status || "").trim() === "done"
              return (
                <Card
                  key={taskID || task.title}
                  className={`border-l-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                    variant === "todo"
                      ? "border-l-red-500"
                      : variant === "in_progress"
                        ? "border-l-orange-500"
                        : "border-l-green-500 bg-gray-50"
                  }`}
                  onClick={() => openDrawer(taskID)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="outline" className={`${taskBadgeClass(task)} text-[10px]`}>
                        {((task.badge_label || "").trim() || "任务")}
                      </Badge>
                      <span className={`text-xs font-medium flex items-center ${dueLabelClass(dueLabel)}`}>
                        <Clock className="w-3 h-3 mr-1" /> {dueLabel}
                      </span>
                    </div>
                    <h4 className={`text-sm font-semibold mb-1 ${statusDone ? "text-gray-500 line-through" : "text-gray-900"}`}>
                      {((task.title || "").trim() || "未命名任务")}
                    </h4>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-4">
                      {((task.description || "").trim() || "暂无任务描述")}
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        <Avatar src={ownerAvatar} fallback={ownerName.charAt(0)} size="sm" className={statusDone ? "opacity-50" : ""} />
                        <span className={`text-xs ${statusDone ? "text-gray-400" : "text-gray-600"}`}>{ownerName}</span>
                      </div>
                      {variant === "in_progress" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-3"
                          onClick={(event) => {
                            event.stopPropagation()
                            openProgressModal(task)
                          }}
                        >
                          更新进度
                        </Button>
                      ) : variant === "done" ? null : (
                        <Button
                          size="sm"
                          className="h-7 text-xs px-3 bg-blue-600"
                          disabled={commandLoadingTaskID === taskID}
                          onClick={async (event) => {
                            event.stopPropagation()
                            await handleTriggerFollowup(task)
                          }}
                        >
                          {commandLoadingTaskID === taskID ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                          去跟进
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab((value as TaskScope) || "my-tasks")
          }}
        >
          <TabsList className="bg-white border border-gray-200 shadow-sm">
            <TabsTrigger value="my-tasks" className="data-[state=active]:bg-gray-100">我的任务</TabsTrigger>
            <TabsTrigger value="team-tasks" className="data-[state=active]:bg-gray-100">团队任务</TabsTrigger>
            <TabsTrigger value="today" className="data-[state=active]:bg-gray-100 text-orange-600">今日到期</TabsTrigger>
            <TabsTrigger value="overdue" className="data-[state=active]:bg-gray-100 text-red-600">已逾期</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9 w-52 text-sm"
              placeholder="搜索任务"
            />
          </div>
          <select
            value={taskType}
            onChange={(event) => setTaskType(event.target.value)}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">所有任务类型</option>
            {taskTypeOptions.map((item) => (
              <option key={item.value || item.label} value={(item.value || "").trim()}>{(item.label || item.value || "").trim()}</option>
            ))}
          </select>
          <select
            value={ownerFilter}
            onChange={(event) => setOwnerFilter(event.target.value)}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">负责人</option>
            {ownerOptions.map((item) => (
              <option key={item.value || item.label} value={(item.value || "").trim()}>{(item.label || item.value || "").trim()}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">优先级</option>
            {priorityOptions.map((item) => (
              <option key={item.value || item.label} value={(item.value || "").trim()}>{(item.label || item.value || "").trim()}</option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">来源域</option>
            {sourceOptions.map((item) => (
              <option key={item.value || item.label} value={(item.value || "").trim()}>{(item.label || item.value || "").trim()}</option>
            ))}
          </select>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsNewTaskModalOpen(true)}>
            新建任务
          </Button>
        </div>
      </div>

      {notice ? <div className="mb-4 px-4 py-2 text-xs text-blue-600 border border-blue-100 bg-blue-50 rounded-md">{notice}</div> : null}

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
        {renderColumn("待跟进", Number(view?.todo_count || 0), todoTasks, "todo")}
        {renderColumn("跟进中", Number(view?.in_progress_count || 0), inProgressTasks, "in_progress")}
        {renderColumn("已完成", Number(view?.done_count || 0), doneTasks, "done")}
      </div>

      {isDrawerOpen && drawerTaskID ? (
        <TaskDetailDrawer
          taskId={drawerTaskID}
          onClose={() => setIsDrawerOpen(false)}
          onChanged={async () => {
            await loadView()
          }}
        />
      ) : null}

      <Dialog
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        title="新建任务"
        className="max-w-[400px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsNewTaskModalOpen(false)}>取消</Button>
            <Button className="bg-blue-600" onClick={handleCreateTask} disabled={isCreating}>
              {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              创建任务
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">任务标题 <span className="text-red-500">*</span></label>
            <Input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="如：发送产品报价单" className="text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">关联客户/群 (可选)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={newTaskTarget}
                onChange={(event) => setNewTaskTarget(event.target.value)}
                placeholder="搜索客户或群聊..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">负责人 <span className="text-red-500">*</span></label>
              <select
                value={newTaskOwner}
                onChange={(event) => setNewTaskOwner(event.target.value)}
                className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">请选择负责人</option>
                {ownerOptions.map((item) => (
                  <option key={item.value || item.label} value={(item.value || "").trim()}>{(item.label || item.value || "").trim()}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">截止时间 <span className="text-red-500">*</span></label>
              <Input type="datetime-local" value={newTaskDueAt} onChange={(event) => setNewTaskDueAt(event.target.value)} className="text-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">优先级</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1 text-sm"><input type="radio" checked={newTaskPriority === "normal"} onChange={() => setNewTaskPriority("normal")} /> 普通</label>
              <label className="flex items-center gap-1 text-sm text-red-600"><input type="radio" checked={newTaskPriority === "high"} onChange={() => setNewTaskPriority("high")} /> 紧急</label>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">任务描述</label>
            <Textarea
              value={newTaskDescription}
              onChange={(event) => setNewTaskDescription(event.target.value)}
              className="text-sm min-h-[80px]"
              placeholder="补充任务细节..."
            />
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={isUpdateProgressModalOpen}
        onClose={() => setIsUpdateProgressModalOpen(false)}
        title="更新进度"
        className="max-w-[400px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsUpdateProgressModalOpen(false)}>取消</Button>
            <Button className="bg-blue-600" onClick={handleUpdateProgress} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              保存进度
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">当前任务状态</label>
            <select
              value={progressStatus}
              onChange={(event) => setProgressStatus(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="in_progress">跟进中</option>
              <option value="done">已完成</option>
              <option value="todo">待跟进</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">进度说明 <span className="text-red-500">*</span></label>
            <Textarea
              value={progressNote}
              onChange={(event) => setProgressNote(event.target.value)}
              className="text-sm min-h-[100px]"
              placeholder="记录当前的进展情况、遇到的问题或下一步计划..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">调整截止时间 (可选)</label>
            <Input type="datetime-local" value={progressDueAt} onChange={(event) => setProgressDueAt(event.target.value)} className="text-sm" />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
