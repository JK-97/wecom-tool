import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Dialog } from "@/components/ui/Dialog"
import { Textarea } from "@/components/ui/Textarea"
import { Clock, Copy, Send, ChevronRight, Lightbulb, FileText, ArrowUpRight, CheckCircle2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  executeContactSidebarCommand,
  executeKFSidebarCommand,
  getKFSidebarContext,
  type KFSidebarContext,
} from "@/services/sidebarService"
import { normalizeErrorMessage } from "@/services/http"
import { sendTextToCurrentSession, toJSSDKErrorMessage } from "@/services/jssdkService"
import {
  sidebarBody,
  sidebarBodyText,
  sidebarCard,
  sidebarFooter,
  sidebarHeader,
  sidebarMeta,
  sidebarNotice,
  sidebarPageShell,
  sidebarPrimaryButton,
  sidebarSectionLabel,
  sidebarSecondaryButton,
  sidebarTitle,
} from "./sidebarChrome"

export default function CSSidebar() {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [isUpgraded, setIsUpgraded] = useState(false)
  const [context, setContext] = useState<KFSidebarContext | null>(null)
  const [notice, setNotice] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [upgradeOwner, setUpgradeOwner] = useState("销售 A")
  const [upgradeIntent, setUpgradeIntent] = useState("高")
  const [upgradeNote, setUpgradeNote] = useState("")

  const query = useMemo(() => {
    if (typeof window === "undefined") return { entry: "", open_kfid: "", external_userid: "" }
    const params = new URLSearchParams(window.location.search)
    return {
      entry: (params.get("entry") || "single_kf_tools").trim(),
      open_kfid: (params.get("open_kfid") || "").trim(),
      external_userid: (params.get("external_userid") || "").trim(),
    }
  }, [])

  const loadContext = async () => {
    const data = await getKFSidebarContext(query)
    setContext(data)
    setUpgradeNote((data?.last_message || "").trim())
  }

  useEffect(() => {
    let alive = true
    void getKFSidebarContext(query)
      .then((data) => {
        if (!alive) return
        setContext(data)
        setUpgradeNote((data?.last_message || "").trim())
      })
      .catch(() => {
        if (!alive) return
        setContext(null)
      })
    return () => {
      alive = false
    }
  }, [query])

  const suggestionTexts = useMemo(() => {
    return (context?.suggestions || []).map((item) => (item.text || "").trim()).filter(Boolean)
  }, [context?.suggestions])

  const sopItems = useMemo(() => {
    return (context?.sop_items || [])
      .map((item) => ({ id: (item.id || "").trim(), title: (item.title || "").trim() }))
      .filter((item) => item.title !== "")
  }, [context?.sop_items])

  const handleCopySuggestion = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setNotice("已复制建议内容")
    } catch {
      setNotice("复制失败，请手动复制")
    }
  }

  const handleFillSuggestion = async (text: string) => {
    try {
      setIsSubmitting(true)
      const runtime = await sendTextToCurrentSession(text, {
        external_userid: context?.external_userid,
      })
      setNotice("已通过企业微信客户端填入当前会话")
      void executeKFSidebarCommand({
        command: "kf_fill_suggestion",
        open_kfid: context?.open_kfid,
        external_userid: runtime.external_userid || context?.external_userid,
        payload: { text, source: "jssdk_send_chat_message" },
      }).catch(() => {})
    } catch (error) {
      const message = toJSSDKErrorMessage(error)
      try {
        await navigator.clipboard.writeText(text)
        setNotice(`${message}，已降级为复制，请手动粘贴发送`)
      } catch {
        setNotice(message || normalizeErrorMessage(error))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMarkSOP = async (item: { id?: string; title?: string }) => {
    try {
      setIsSubmitting(true)
      const result = await executeKFSidebarCommand({
        command: "kf_mark_sop_used",
        open_kfid: context?.open_kfid,
        external_userid: context?.external_userid,
        payload: { sop_id: item.id, title: item.title },
      })
      setNotice((result?.message || "已记录知识库动作").trim())
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpgrade = async () => {
    try {
      setIsSubmitting(true)
      const result = await executeContactSidebarCommand({
        command: "kf_upgrade_to_contact",
        external_userid: context?.external_userid,
        payload: {
          assigned_userid: upgradeOwner,
          intent: upgradeIntent,
          note: upgradeNote,
          contact_name: context?.contact_name,
          contact_avatar: context?.contact_avatar,
          open_kfid: context?.open_kfid,
        },
      })
      if (result?.success) {
        setIsUpgraded(true)
      }
      setNotice((result?.message || "升级命令已提交").trim())
      setIsUpgradeModalOpen(false)
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTransfer = async () => {
    try {
      setIsSubmitting(true)
      const result = await executeKFSidebarCommand({
        command: "kf_transfer_session",
        open_kfid: context?.open_kfid,
        external_userid: context?.external_userid,
        payload: { assigned_userid: upgradeOwner },
      })
      setNotice((result?.message || "转交命令已提交").trim())
      await loadContext()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCloseSession = async () => {
    try {
      setIsSubmitting(true)
      const result = await executeKFSidebarCommand({
        command: "kf_close_session",
        open_kfid: context?.open_kfid,
        external_userid: context?.external_userid,
        payload: {},
      })
      setNotice((result?.message || "结束命令已提交").trim())
      await loadContext()
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={sidebarPageShell}>
      <div className={sidebarHeader}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar src={(context?.contact_avatar || "").trim()} fallback="客" size="sm" className="wecom-sidebar-avatar" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className={sidebarTitle}>{(context?.contact_name || "未识别客户").trim()}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {(context?.entry || "客服会话").trim()}
                </Badge>
              </div>
              <span className={sidebarMeta}>{(context?.external_userid || "").trim()}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <Badge variant="success" className="mb-1 text-[10px]">
              {(context?.session_label || "会话中").trim()}
            </Badge>
            <div className="flex items-center text-xs text-orange-500 font-medium">
              <Clock className="w-3 h-3 mr-1" />
              {(context?.last_active || "-").replace("T", " ").slice(0, 16)}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 p-2.5">
          <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="wecom-sidebar-text text-blue-800">
            <span className="font-semibold">客户意图：</span>
            {(context?.last_message || "暂无会话摘要").trim()}
          </div>
        </div>
        {context?.warnings && context.warnings.length > 0 ? <div className={`${sidebarNotice} text-orange-600`}>{context.warnings.join("；")}</div> : null}
        {notice ? <div className={`${sidebarNotice} text-blue-600`}>{notice}</div> : null}
      </div>

      <div className={sidebarBody}>
        <div className="space-y-2">
          <div className={sidebarSectionLabel}>AI 建议回复</div>
          {suggestionTexts.length === 0 ? (
            <Card className={`${sidebarCard} ${sidebarMeta}`}>暂无建议回复</Card>
          ) : (
            suggestionTexts.map((text, idx) => (
              <Card key={idx} className={`${sidebarCard} border-transparent shadow-sm transition-colors hover:border-blue-200`}>
                <p className={`mb-2 ${sidebarBodyText}`}>{text}</p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => void handleCopySuggestion(text)}>
                    <Copy className="w-3 h-3 mr-1" /> 复制
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 bg-blue-600 px-2 text-[11px]"
                    disabled={isSubmitting}
                    onClick={() => void handleFillSuggestion(text)}
                  >
                    <Send className="w-3 h-3 mr-1" /> 填入
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-2 pt-1.5">
          <div className={sidebarSectionLabel}>知识库推荐</div>
          <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
            {sopItems.length === 0 ? (
              <div className={`${sidebarCard} ${sidebarMeta}`}>暂无知识库推荐</div>
            ) : (
              sopItems.map((item, idx) => (
                <button
                  key={item.id || idx}
                  className={`flex w-full items-center justify-between p-2.5 text-left hover:bg-gray-50 ${
                    idx < sopItems.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                  onClick={() => void handleMarkSOP(item)}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className={sidebarBodyText}>{item.title}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className={sidebarFooter}>
        <Button
          className={`${sidebarPrimaryButton} ${isUpgraded ? "cursor-not-allowed bg-gray-100 text-gray-400" : "bg-blue-600 hover:bg-blue-700"}`}
          disabled={isUpgraded || isSubmitting}
          onClick={() => setIsUpgradeModalOpen(true)}
        >
          {isUpgraded ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" /> 已升级为客户联系
            </>
          ) : (
            <>
              <ArrowUpRight className="w-4 h-4 mr-2" /> 升级为客户联系
            </>
          )}
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" className={sidebarSecondaryButton} disabled={isSubmitting} onClick={() => void handleTransfer()}>
            转交
          </Button>
          <Button variant="secondary" className={sidebarSecondaryButton} disabled={isSubmitting} onClick={() => void handleCloseSession()}>
            结束会话
          </Button>
        </div>
      </div>

      <Dialog
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title="升级为客户联系"
        className="max-w-[300px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsUpgradeModalOpen(false)}>
              取消
            </Button>
            <Button className="bg-blue-600" disabled={isSubmitting} onClick={() => void handleUpgrade()}>
              确认升级
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">分配给</label>
            <select
              value={upgradeOwner}
              onChange={(event) => setUpgradeOwner(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>销售 A</option>
              <option>销售 B</option>
              <option>销售 C</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">客户意向评级</label>
            <div className="flex gap-2">
              {["高", "中", "低"].map((item) => (
                <label key={item} className="flex items-center gap-1 text-sm">
                  <input checked={upgradeIntent === item} onChange={() => setUpgradeIntent(item)} type="radio" name="intent" /> {item}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">升级备注</label>
            <Textarea className="text-sm min-h-[80px]" value={upgradeNote} onChange={(event) => setUpgradeNote(event.target.value)} />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
