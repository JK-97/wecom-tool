import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Dialog } from "@/components/ui/Dialog"
import { Drawer } from "@/components/ui/Drawer"
import { Textarea } from "@/components/ui/Textarea"
import { Input } from "@/components/ui/Input"
import { AlertTriangle, Copy, Send, CheckCircle2, Tag, Calendar, MessageSquarePlus, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  executeContactSidebarCommand,
  getContactSidebarContext,
  type ContactSidebarContext,
} from "@/services/sidebarService"
import { normalizeErrorMessage } from "@/services/http"
import { sendTextToCurrentSession, toJSSDKErrorMessage } from "@/services/jssdkService"
import {
  sidebarBody,
  sidebarBodyText,
  sidebarCard,
  sidebarFooter,
  sidebarHeader,
  sidebarNotice,
  sidebarPageShell,
  sidebarPrimaryButton,
  sidebarSectionLabel,
  sidebarSecondaryButton,
  sidebarTitle,
} from "./sidebarChrome"

function parseTagList(raw: string): string[] {
  const text = raw.trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || "").trim()).filter(Boolean)
    }
  } catch {
    // ignore parse error
  }
  return text.split(",").map((item) => item.trim()).filter(Boolean)
}

export default function ContactSidebar() {
  const [isFollowUpDrawerOpen, setIsFollowUpDrawerOpen] = useState(false)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [context, setContext] = useState<ContactSidebarContext | null>(null)
  const [notice, setNotice] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(0)

  const [followupMethod, setFollowupMethod] = useState("微信聊天")
  const [followupStage, setFollowupStage] = useState("意向沟通中")
  const [followupContent, setFollowupContent] = useState("")
  const [followupReminderAt, setFollowupReminderAt] = useState("")

  const [taskTitle, setTaskTitle] = useState("")
  const [taskDueAt, setTaskDueAt] = useState("")
  const [taskPriority, setTaskPriority] = useState("normal")
  const [taskDescription, setTaskDescription] = useState("")

  const [tagQuery, setTagQuery] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [stage, setStage] = useState("意向沟通中")

  const query = useMemo(() => {
    if (typeof window === "undefined") return { external_userid: "", entry: "single_chat_tools" }
    const params = new URLSearchParams(window.location.search)
    return {
      external_userid: (params.get("external_userid") || "").trim(),
      entry: (params.get("entry") || "single_chat_tools").trim(),
    }
  }, [])

  const loadContext = async () => {
    const data = await getContactSidebarContext({
      mode: "single",
      entry: query.entry,
      external_userid: query.external_userid,
    })
    setContext(data)
    const tags = parseTagList((data?.contact?.tags_json || "").trim())
    setSelectedTags(tags)
    const stageTag = tags.find((item) => ["意向沟通中", "已报价待签", "已成交", "流失"].includes(item))
    setStage(stageTag || "意向沟通中")
    setFollowupStage(stageTag || "意向沟通中")
    setSuggestionIndex(0)
  }

  useEffect(() => {
    let alive = true
    void getContactSidebarContext({
      mode: "single",
      entry: query.entry,
      external_userid: query.external_userid,
    })
      .then((data) => {
        if (!alive) return
        setContext(data)
        const tags = parseTagList((data?.contact?.tags_json || "").trim())
        setSelectedTags(tags)
        const stageTag = tags.find((item) => ["意向沟通中", "已报价待签", "已成交", "流失"].includes(item))
        setStage(stageTag || "意向沟通中")
        setFollowupStage(stageTag || "意向沟通中")
      })
      .catch(() => {
        if (!alive) return
        setContext(null)
      })
    return () => {
      alive = false
    }
  }, [query.entry, query.external_userid])

  const tags = useMemo(() => selectedTags, [selectedTags])
  const suggestions = useMemo(() => (context?.suggestions || []).map((item) => (item.text || "").trim()).filter(Boolean), [context?.suggestions])
  const suggestionText = suggestions.length > 0 ? suggestions[suggestionIndex % suggestions.length] : ""
  const primaryTask = useMemo(() => (context?.tasks || [])[0] || null, [context?.tasks])
  const materials = useMemo(
    () =>
      (context?.materials || [])
        .map((item) => ({ id: (item.id || "").trim(), title: (item.title || "").trim(), subtitle: (item.subtitle || "").trim() }))
        .filter((item) => item.title !== ""),
    [context?.materials],
  )

  const updateStage = async (next: string) => {
    try {
      setIsSubmitting(true)
      const result = await executeContactSidebarCommand({
        command: "contact_update_stage",
        external_userid: query.external_userid,
        payload: { stage: next },
      })
      setStage(next)
      setFollowupStage(next)
      setNotice((result?.message || "客户阶段已更新").trim())
      await loadContext()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopySuggestion = async () => {
    if (!suggestionText) return
    try {
      await navigator.clipboard.writeText(suggestionText)
      setNotice("已复制建议话术")
    } catch {
      setNotice("复制失败，请手动复制")
    }
  }

  const handleFillSuggestion = async () => {
    if (!suggestionText) return
    try {
      setIsSubmitting(true)
      const runtime = await sendTextToCurrentSession(suggestionText, {
        external_userid: query.external_userid,
      })
      setNotice("已通过企业微信客户端填入当前会话")
      void executeContactSidebarCommand({
        command: "contact_fill_suggestion",
        external_userid: runtime.external_userid || query.external_userid,
        payload: { text: suggestionText, source: "jssdk_send_chat_message" },
      }).catch(() => {})
    } catch (error) {
      const message = toJSSDKErrorMessage(error)
      try {
        await navigator.clipboard.writeText(suggestionText)
        setNotice(`${message}，已降级为复制，请手动粘贴发送`)
      } catch {
        setNotice(message || normalizeErrorMessage(error))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleShareMaterial = async (material: { id: string; title: string }) => {
    try {
      setIsSubmitting(true)
      const result = await executeContactSidebarCommand({
        command: "contact_share_material_stub",
        external_userid: query.external_userid,
        payload: { material_id: material.id, title: material.title },
      })
      setNotice((result?.message || "素材分享命令已提交").trim())
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveFollowup = async () => {
    if (!followupContent.trim()) {
      setNotice("请填写跟进内容")
      return
    }
    try {
      setIsSubmitting(true)
      const result = await executeContactSidebarCommand({
        command: "contact_save_followup",
        external_userid: query.external_userid,
        payload: {
          method: followupMethod,
          stage: followupStage,
          content: followupContent,
          next_followup_at: followupReminderAt,
        },
      })
      setNotice((result?.message || "跟进记录已保存").trim())
      setIsFollowUpDrawerOpen(false)
      setFollowupContent("")
      setFollowupReminderAt("")
      await loadContext()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) {
      setNotice("请输入任务标题")
      return
    }
    try {
      setIsSubmitting(true)
      const result = await executeContactSidebarCommand({
        command: "contact_create_task",
        external_userid: query.external_userid,
        payload: {
          title: taskTitle,
          due_at: taskDueAt,
          priority: taskPriority,
          description: taskDescription,
        },
      })
      setNotice((result?.message || "任务已创建").trim())
      setIsTaskModalOpen(false)
      setTaskTitle("")
      setTaskDueAt("")
      setTaskPriority("normal")
      setTaskDescription("")
      await loadContext()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveTags = async () => {
    try {
      setIsSubmitting(true)
      const normalized = selectedTags.filter((item) => item.trim() !== "")
      const result = await executeContactSidebarCommand({
        command: "contact_update_tags",
        external_userid: query.external_userid,
        payload: { tags: normalized, stage },
      })
      setNotice((result?.message || "标签已更新").trim())
      setIsTagModalOpen(false)
      setTagQuery("")
      await loadContext()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const openTaskDetail = () => {
    const taskID = (primaryTask?.id || "").trim()
    if (!taskID) {
      setNotice("当前任务暂无详情")
      return
    }
    window.location.assign(`/main/task-center?task_id=${encodeURIComponent(taskID)}`)
  }

  const addTag = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setSelectedTags((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
  }

  const removeTag = (value: string) => {
    setSelectedTags((prev) => prev.filter((item) => item !== value))
  }

  const recommendedTags = ["决策人", "价格敏感", "竞品对比中", "需高管介入"]

  return (
    <div className={sidebarPageShell}>
      <div className={sidebarHeader}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar src={(context?.contact?.avatar || "").trim()} fallback="客" size="sm" className="wecom-sidebar-avatar" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className={sidebarTitle}>{(context?.contact?.name || "未识别客户").trim()}</span>
                <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] text-green-600">@微信</span>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <select
                  value={stage}
                  onChange={(event) => void updateStage(event.target.value)}
                  className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option>意向沟通中</option>
                  <option>已报价待签</option>
                  <option>已成交</option>
                  <option>流失</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
              {tag}
            </Badge>
          ))}
          <button
            onClick={() => setIsTagModalOpen(true)}
            className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
          >
            +
          </button>
        </div>
        {context?.warnings && context.warnings.length > 0 ? <div className={`${sidebarNotice} text-orange-600`}>{context.warnings.join("；")}</div> : null}
        {notice ? <div className={`${sidebarNotice} text-blue-600`}>{notice}</div> : null}
      </div>

      <div className={sidebarBody}>
        <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-red-800 flex items-center justify-between">
                <span>{`待办：${(primaryTask?.title || "暂无待办").trim()}`}</span>
                <span className="text-[10px] font-normal text-red-600">{primaryTask?.due_at ? "有截止时间" : "-"}</span>
              </div>
              <p className="text-xs text-red-700 mt-1 leading-relaxed">{(primaryTask?.description || "暂无任务描述").trim()}</p>
              <button className="text-xs text-red-600 font-medium mt-2 underline underline-offset-2 hover:text-red-800" onClick={openTaskDetail}>
                查看详情
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-1.5">
          <div className={`${sidebarSectionLabel} flex items-center justify-between`}>
            <span>跟进建议 / 破冰话术</span>
            <span
              className="text-[10px] text-blue-600 cursor-pointer hover:underline"
              onClick={() => setSuggestionIndex((prev) => (suggestions.length === 0 ? 0 : (prev + 1) % suggestions.length))}
            >
              换一批
            </span>
          </div>

          <Card className={`${sidebarCard} border-transparent shadow-sm transition-colors hover:border-blue-200`}>
            <p className={`mb-2 ${sidebarBodyText}`}>{suggestionText || "暂无建议话术"}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => void handleCopySuggestion()}>
                <Copy className="w-3 h-3 mr-1" /> 复制
              </Button>
              <Button size="sm" className="h-7 bg-blue-600 px-2 text-[11px]" disabled={isSubmitting} onClick={() => void handleFillSuggestion()}>
                <Send className="w-3 h-3 mr-1" /> 填入
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-2 pt-1.5">
          <div className={sidebarSectionLabel}>营销素材推荐</div>
          {materials.length === 0 ? (
            <Card className={`${sidebarCard} text-gray-500`}>暂无素材推荐</Card>
          ) : (
            materials.map((material) => (
              <div key={material.id} className={`flex items-center gap-2.5 ${sidebarCard}`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-blue-100">
                  <MessageSquarePlus className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`truncate ${sidebarBodyText} font-medium`}>{material.title}</div>
                  <div className="truncate text-[11px] text-gray-500">{material.subtitle}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 px-2 text-[11px]"
                  disabled={isSubmitting}
                  onClick={() => void handleShareMaterial(material)}
                >
                  分享
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={sidebarFooter}>
        <Button className={`${sidebarPrimaryButton} bg-blue-600 hover:bg-blue-700`} onClick={() => setIsFollowUpDrawerOpen(true)}>
          <CheckCircle2 className="w-4 h-4 mr-2" />
          写跟进 / 记录结果
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" className={sidebarSecondaryButton} onClick={() => setIsTagModalOpen(true)}>
            <Tag className="w-4 h-4 mr-1" /> 打标签
          </Button>
          <Button variant="secondary" className={sidebarSecondaryButton} onClick={() => setIsTaskModalOpen(true)}>
            <Calendar className="w-4 h-4 mr-1" /> 建任务
          </Button>
        </div>
      </div>

      <Drawer
        isOpen={isFollowUpDrawerOpen}
        onClose={() => setIsFollowUpDrawerOpen(false)}
        title="写跟进"
        position="bottom"
        className="w-full max-w-[400px] mx-auto"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsFollowUpDrawerOpen(false)}>
              取消
            </Button>
            <Button className="bg-blue-600" disabled={isSubmitting} onClick={() => void handleSaveFollowup()}>
              保存记录
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              跟进方式 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {["微信聊天", "语音电话", "线下拜访"].map((item) => (
                <label
                  key={item}
                  className={`flex items-center gap-1 text-sm p-2 border rounded-md cursor-pointer ${
                    followupMethod === item ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input type="radio" name="method" checked={followupMethod === item} onChange={() => setFollowupMethod(item)} className="hidden" />
                  {item}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">客户阶段更新</label>
            <select
              value={followupStage}
              onChange={(event) => setFollowupStage(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>意向沟通中</option>
              <option>已报价待签</option>
              <option>已成交</option>
              <option>流失</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              跟进内容 <span className="text-red-500">*</span>
            </label>
            <Textarea
              className="text-sm min-h-[100px]"
              value={followupContent}
              onChange={(event) => setFollowupContent(event.target.value)}
              placeholder="记录本次沟通的核心内容、客户反馈及下一步计划..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">下次跟进提醒</label>
            <Input type="datetime-local" className="text-sm" value={followupReminderAt} onChange={(event) => setFollowupReminderAt(event.target.value)} />
          </div>
        </div>
      </Drawer>

      <Dialog
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="新建任务"
        className="max-w-[320px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsTaskModalOpen(false)}>
              取消
            </Button>
            <Button className="bg-blue-600" disabled={isSubmitting} onClick={() => void handleCreateTask()}>
              创建任务
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              任务标题 <span className="text-red-500">*</span>
            </label>
            <Input placeholder="如：发送产品报价单" className="text-sm" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              截止时间 <span className="text-red-500">*</span>
            </label>
            <Input type="datetime-local" className="text-sm" value={taskDueAt} onChange={(event) => setTaskDueAt(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">优先级</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" name="priority" checked={taskPriority === "normal"} onChange={() => setTaskPriority("normal")} /> 普通
              </label>
              <label className="flex items-center gap-1 text-sm text-red-600">
                <input type="radio" name="priority" checked={taskPriority === "high"} onChange={() => setTaskPriority("high")} /> 紧急
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">任务描述</label>
            <Textarea className="text-sm min-h-[80px]" placeholder="补充任务细节..." value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} />
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        title="打标签"
        className="max-w-[320px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsTagModalOpen(false)}>
              取消
            </Button>
            <Button className="bg-blue-600" disabled={isSubmitting} onClick={() => void handleSaveTags()}>
              确定
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  addTag(tagQuery)
                  setTagQuery("")
                }
              }}
              placeholder="搜索或创建新标签..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">已选标签</div>
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((item) => (
                <Badge key={item} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                  {item} <span className="cursor-pointer hover:text-blue-900" onClick={() => removeTag(item)}>×</span>
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">推荐标签</div>
            <div className="flex flex-wrap gap-2">
              {recommendedTags.map((item) => (
                <Badge key={item} variant="outline" className="text-xs text-gray-600 border-gray-200 cursor-pointer hover:bg-gray-50" onClick={() => addTag(item)}>
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
