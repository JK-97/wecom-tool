import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Dialog } from "@/components/ui/Dialog"
import { Textarea } from "@/components/ui/Textarea"
import { AlertOctagon, Send, Activity, Users, Settings, Edit3 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { executeContactSidebarCommand, getContactSidebarContext, type ContactSidebarContext } from "@/services/sidebarService"
import { normalizeErrorMessage } from "@/services/http"
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

export default function GroupSidebar() {
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [context, setContext] = useState<ContactSidebarContext | null>(null)
  const [notice, setNotice] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAllMembers, setShowAllMembers] = useState(false)

  const [recordType, setRecordType] = useState("活动预热")
  const [recordContent, setRecordContent] = useState("")
  const [recordMaterial, setRecordMaterial] = useState("")

  const query = useMemo(() => {
    if (typeof window === "undefined") return { chat_id: "", entry: "group_chat_tools" }
    const params = new URLSearchParams(window.location.search)
    return {
      chat_id: (params.get("chat_id") || "").trim(),
      entry: (params.get("entry") || "group_chat_tools").trim(),
    }
  }, [])

  const loadContext = async () => {
    const data = await getContactSidebarContext({
      mode: "group",
      entry: query.entry,
      chat_id: query.chat_id,
    })
    setContext(data)
  }

  useEffect(() => {
    let alive = true
    void getContactSidebarContext({
      mode: "group",
      entry: query.entry,
      chat_id: query.chat_id,
    })
      .then((data) => {
        if (!alive) return
        setContext(data)
      })
      .catch(() => {
        if (!alive) return
        setContext(null)
      })
    return () => {
      alive = false
    }
  }, [query.chat_id, query.entry])

  const resolvedChatID = ((context?.group_chat?.chat_id || query.chat_id || "").trim())
  const chatIDSuffix = resolvedChatID ? resolvedChatID.slice(-6) : ""
  const groupName = ((context?.group_chat?.name || "").trim()) || (chatIDSuffix ? `群聊(${chatIDSuffix})` : "未命名群聊")
  const memberCount = Number(context?.group_chat?.member_count || 0)
  const sopTitle = (context?.sop_items?.[0]?.title || "暂无群发任务").trim()
  const riskAlert = context?.risk_alert
  const activeMembers = useMemo(
    () =>
      (context?.active_members || [])
        .map((item) => ({
          member_id: (item.member_id || "").trim(),
          name: (item.name || "").trim(),
          avatar: (item.avatar || "").trim(),
          speak_count: Number(item.speak_count || 0),
        }))
        .filter((item) => item.name !== ""),
    [context?.active_members],
  )

  const runGroupCommand = async (command: string, payload?: Record<string, unknown>) => {
    try {
      setIsSubmitting(true)
      const result = await executeContactSidebarCommand({
        command,
        chat_id: query.chat_id,
        payload: {
          chat_id: query.chat_id,
          group_name: groupName,
          ...payload,
        },
      })
      setNotice((result?.message || "命令已提交").trim())
      await loadContext()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveRecord = async () => {
    if (!recordContent.trim()) {
      setNotice("请填写动作详情")
      return
    }
    await runGroupCommand("group_record_operation", {
      action_type: recordType,
      detail: recordContent,
      material: recordMaterial,
    })
    setIsRecordModalOpen(false)
    setRecordContent("")
    setRecordMaterial("")
  }

  return (
    <div className={sidebarPageShell}>
      <div className={sidebarHeader}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              <Avatar src={(activeMembers[0]?.avatar || "").trim()} className="wecom-sidebar-avatar border-2 border-white" />
              <Avatar src={(activeMembers[1]?.avatar || "").trim()} className="wecom-sidebar-avatar border-2 border-white" />
              <Avatar src={(activeMembers[2]?.avatar || "").trim()} className="wecom-sidebar-avatar border-2 border-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`max-w-[132px] truncate ${sidebarTitle}`}>{groupName}</span>
                <span className="text-[11px] text-gray-500">{memberCount}人</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-green-500" />
                  <span className="text-[10px] text-gray-600">活跃度 {(riskAlert?.level || "normal").toLowerCase() === "high" ? "72%" : "85%"}</span>
                </div>
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${(riskAlert?.level || "").toLowerCase() === "high" ? "bg-orange-500 w-[72%]" : "bg-green-500 w-[85%]"}`} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
            客户联系群
          </Badge>
          {(riskAlert?.level || "").toLowerCase() === "high" ? (
            <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">
              风险预警
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
              高活跃
            </Badge>
          )}
        </div>
        {context?.warnings && context.warnings.length > 0 ? <div className={`${sidebarNotice} text-orange-600`}>{context.warnings.join("；")}</div> : null}
        {notice ? <div className={`${sidebarNotice} text-blue-600`}>{notice}</div> : null}
      </div>

      <div className={sidebarBody}>
        <div className="rounded-lg border border-red-200 bg-red-50 p-2.5">
          <div className="flex items-start gap-2">
            <AlertOctagon className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-red-800">风险提示</div>
              <p className="text-xs text-red-700 mt-1 leading-relaxed">{(riskAlert?.summary || "暂无风险告警").trim()}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  className="h-6 text-[10px] px-2 bg-red-600 hover:bg-red-700"
                  disabled={isSubmitting}
                  onClick={() => void runGroupCommand("group_soothe_risk", { risk_id: riskAlert?.risk_id || "" })}
                >
                  立即安抚
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 border-red-200 text-red-700 hover:bg-red-100"
                  disabled={isSubmitting}
                  onClick={() => void runGroupCommand("group_ignore_risk", { risk_id: riskAlert?.risk_id || "" })}
                >
                  忽略
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-1.5">
          <div className={sidebarSectionLabel}>今日群发任务 (SOP)</div>
          <div className={sidebarCard}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-orange-100">
                <span className="text-lg">🎁</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className={`truncate ${sidebarBodyText} font-medium`}>{sopTitle}</div>
                <div className="mt-0.5 line-clamp-2 text-[11px] text-gray-500">{(context?.suggestions?.[0]?.text || "暂无任务说明").trim()}</div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" className="h-7 bg-blue-600 px-3 text-[11px]" disabled={isSubmitting} onClick={() => void runGroupCommand("group_broadcast_stub", { sop_title: sopTitle })}>
                <Send className="w-3 h-3 mr-1" /> 一键发群
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-1.5">
          <div className={`${sidebarSectionLabel} flex items-center justify-between`}>
            <span>活跃成员 Top 3</span>
            <button className="text-[10px] text-blue-600 hover:underline" onClick={() => setShowAllMembers((prev) => !prev)}>
              {showAllMembers ? "收起" : "查看全部"}
            </button>
          </div>
          <div className={`${sidebarCard} divide-y divide-gray-100 overflow-hidden`}>
            {activeMembers.length === 0 ? (
              <div className="text-gray-500">暂无活跃成员数据</div>
            ) : (
              activeMembers.slice(0, showAllMembers ? activeMembers.length : 3).map((member) => (
                <div key={member.member_id || member.name} className="flex cursor-pointer items-center justify-between py-2 hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Avatar src={member.avatar} size="sm" />
                    <span className={sidebarBodyText}>{member.name}</span>
                  </div>
                  <span className="text-[11px] text-gray-400">发言 {member.speak_count} 次</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className={sidebarFooter}>
        <Button className={`${sidebarPrimaryButton} bg-blue-600 hover:bg-blue-700`} onClick={() => setIsRecordModalOpen(true)}>
          <Edit3 className="w-4 h-4 mr-2" />
          记录群运营动作
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" className={sidebarSecondaryButton} disabled={isSubmitting} onClick={() => void runGroupCommand("group_update_stage", { stage: "运营中" })}>
            <Users className="w-4 h-4 mr-1" /> 群阶段
          </Button>
          <Button variant="secondary" className={sidebarSecondaryButton} disabled={isSubmitting} onClick={() => void runGroupCommand("group_update_settings", { setting: "basic" })}>
            <Settings className="w-4 h-4 mr-1" /> 群设置
          </Button>
        </div>
      </div>

      <Dialog
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="记录群运营动作"
        className="max-w-[320px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsRecordModalOpen(false)}>
              取消
            </Button>
            <Button className="bg-blue-600" disabled={isSubmitting} onClick={() => void handleSaveRecord()}>
              保存记录
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              动作类型 <span className="text-red-500">*</span>
            </label>
            <select
              value={recordType}
              onChange={(event) => setRecordType(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>活动预热</option>
              <option>答疑解惑</option>
              <option>危机处理</option>
              <option>促单转化</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              动作详情 <span className="text-red-500">*</span>
            </label>
            <Textarea
              className="text-sm min-h-[100px]"
              value={recordContent}
              onChange={(event) => setRecordContent(event.target.value)}
              placeholder="记录具体做了什么，如：发布了活动预告并回复了关键问题..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">关联素材 (可选)</label>
            <input
              value={recordMaterial}
              onChange={(event) => setRecordMaterial(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="可填写素材名称"
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
