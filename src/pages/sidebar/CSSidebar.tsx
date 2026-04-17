import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { Textarea } from "@/components/ui/Textarea"
import { normalizeErrorMessage } from "@/services/http"
import {
  resolveSidebarRuntimeContext,
  sendTextToCurrentSession,
  toJSSDKErrorMessage,
} from "@/services/jssdkService"
import { executeContactSidebarCommand } from "@/services/sidebarService"
import {
  openCommandCenterRealtimeSocket,
  type CommandCenterRealtimeEnvelope,
} from "@/services/commandCenterService"
import {
  getKFToolbarBootstrap,
  regenerateKFToolbarSuggestions,
  sendKFToolbarReplyFeedback,
  type KFToolbarBootstrap,
  type KFToolbarSuggestion,
} from "@/services/toolbarService"
import {
  sidebarBody,
  sidebarHeader,
  sidebarMeta,
  sidebarNotice,
  sidebarPageShell,
  sidebarSectionLabel,
  sidebarTitle,
} from "./sidebarChrome"
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Lightbulb,
  RefreshCcw,
  Send,
  Sparkles,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

type NormalizedSuggestion = {
  id: string
  text: string
  sentences: string[]
  hasFollowups: boolean
  displayMode: string
  nextStepLabel: string
  reason: string
  source: string
}

function normalizeSuggestion(item: KFToolbarSuggestion, idx: number): NormalizedSuggestion {
  const sentences = (item.sentences || []).map((entry) => (entry || "").trim()).filter(Boolean)
  const fallbackText = (item.text || "").trim()
  const safeSentences = sentences.length > 0 ? sentences : fallbackText ? [fallbackText] : ["暂时没有建议内容"]
  return {
    id: (item.id || `suggestion-${idx + 1}`).trim(),
    text: fallbackText || safeSentences[0],
    sentences: safeSentences,
    hasFollowups: Boolean(item.has_followups) || safeSentences.length > 1,
    displayMode: (item.display_mode || "").trim() || (safeSentences.length > 1 ? "threaded" : "single"),
    nextStepLabel: (item.next_step_label || "").trim() || "继续填入下一句",
    reason: (item.reason || "").trim(),
    source: (item.source || "").trim(),
  }
}

function ToolbarSkeleton() {
  return (
    <div className={`${sidebarBody} space-y-3`}>
      <div className="wecom-toolbar-skeleton h-24 rounded-2xl" />
      <div className="wecom-toolbar-skeleton h-28 rounded-2xl" />
      <div className="wecom-toolbar-skeleton h-40 rounded-2xl" />
    </div>
  )
}

function shouldRefreshToolbarSession(
  payload: CommandCenterRealtimeEnvelope,
  openKFID: string,
  externalUserID: string,
): boolean {
  const targetOpenKFID = openKFID.trim()
  const targetExternalUserID = externalUserID.trim()
  if (!targetOpenKFID || !targetExternalUserID) return false
  return (payload.events || []).some((event) => {
    const eventExternalUserID = (event.external_userid || "").trim()
    const eventOpenKFID = (event.open_kfid || "").trim()
    if (!eventExternalUserID || eventExternalUserID !== targetExternalUserID) return false
    if (!eventOpenKFID || eventOpenKFID !== targetOpenKFID) return false
    return true
  })
}

export default function CSSidebar() {
  const [bootstrap, setBootstrap] = useState<KFToolbarBootstrap | null>(null)
  const [notice, setNotice] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isResolvingContext, setIsResolvingContext] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [isUpgraded, setIsUpgraded] = useState(false)
  const [upgradeOwner, setUpgradeOwner] = useState("销售 A")
  const [upgradeIntent, setUpgradeIntent] = useState("高")
  const [upgradeNote, setUpgradeNote] = useState("")
  const [threadSteps, setThreadSteps] = useState<Record<string, number>>({})
  const refreshTimerRef = useRef<number | null>(null)
  const realtimeVersionRef = useRef(0)

  const query = useMemo(() => {
    if (typeof window === "undefined") return { entry: "single_kf_tools", open_kfid: "", external_userid: "" }
    const params = new URLSearchParams(window.location.search)
    return {
      entry: (params.get("entry") || "single_kf_tools").trim(),
      open_kfid: (params.get("open_kfid") || "").trim(),
      external_userid: (params.get("external_userid") || "").trim(),
    }
  }, [])
  const [sessionLocator, setSessionLocator] = useState(query)

  useEffect(() => {
    setSessionLocator(query)
  }, [query])

  useEffect(() => {
    let alive = true
    const shouldResolveRuntime = (query.entry || "").trim() === "single_kf_tools"
    if (!shouldResolveRuntime) return

    setIsResolvingContext(true)
    void resolveSidebarRuntimeContext()
      .then((runtime) => {
        if (!alive) return
        const runtimeOpenKFID = (runtime.open_kfid || "").trim()
        const runtimeExternalUserID = (runtime.external_userid || "").trim()
        const runtimeEntry = (runtime.entry || "").trim()
        setSessionLocator((prev) => ({
          entry: runtimeEntry || prev.entry || query.entry,
          open_kfid: runtimeOpenKFID || prev.open_kfid || query.open_kfid,
          external_userid: runtimeExternalUserID || prev.external_userid || query.external_userid,
        }))
      })
      .catch(() => {
        if (!alive) return
        setSessionLocator(query)
      })
      .finally(() => {
        if (!alive) return
        setIsResolvingContext(false)
      })

    return () => {
      alive = false
    }
  }, [query])

  const loadBootstrap = async (options?: { preserveNotice?: boolean; silent?: boolean }) => {
    const entry = (sessionLocator.entry || query.entry || "single_kf_tools").trim()
    const openKFID = (sessionLocator.open_kfid || query.open_kfid || "").trim()
    const externalUserID = (sessionLocator.external_userid || query.external_userid || "").trim()
    if (!externalUserID) {
      setBootstrap(null)
      setIsLoading(false)
      if (!options?.preserveNotice) {
        setNotice("暂时无法识别当前客户，请确认已在企业微信客服会话工具栏中打开。")
      }
      return
    }
    if (!options?.silent) {
      setIsLoading(true)
    }
    try {
      const data = await getKFToolbarBootstrap({
        entry,
        open_kfid: openKFID,
        external_userid: externalUserID,
      })
      setBootstrap(data)
      realtimeVersionRef.current = Number(data?.version || 0)
      setUpgradeNote((data?.summary?.current_round || "").trim())
      if (!options?.preserveNotice) {
        setNotice("")
      }
    } catch (error) {
      if (!options?.silent) {
        setBootstrap(null)
        setNotice(normalizeErrorMessage(error))
      }
    } finally {
      if (!options?.silent) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    if (isResolvingContext) return
    void loadBootstrap()
  }, [isResolvingContext, sessionLocator.entry, sessionLocator.external_userid, sessionLocator.open_kfid])

  useEffect(() => {
    realtimeVersionRef.current = Number(bootstrap?.version || 0)
  }, [bootstrap?.version])

  useEffect(() => {
    if (typeof window === "undefined") return
    const openKFID = (bootstrap?.open_kfid || sessionLocator.open_kfid || query.open_kfid || "").trim()
    const externalUserID = (bootstrap?.external_userid || sessionLocator.external_userid || query.external_userid || "").trim()
    if (!openKFID || !externalUserID) return

    let stopped = false
    let reconnectTimer: number | null = null
    let chatSocket: WebSocket | null = null
    let opsSocket: WebSocket | null = null

    const queueRefresh = () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
      }
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null
        void loadBootstrap({ preserveNotice: true, silent: true })
      }, 180)
    }

    const handleMessage = (payload: CommandCenterRealtimeEnvelope) => {
      realtimeVersionRef.current = Math.max(
        realtimeVersionRef.current,
        Number(payload.latest_version || 0),
      )
      if (!shouldRefreshToolbarSession(payload, openKFID, externalUserID)) return
      queueRefresh()
    }

    const connect = () => {
      if (stopped) return
      chatSocket = openCommandCenterRealtimeSocket({
        topic: "chat",
        open_kfid: openKFID,
        since_version: realtimeVersionRef.current,
        onMessage: handleMessage,
        onClose: () => {
          if (stopped) return
          reconnectTimer = window.setTimeout(connect, 1200)
        },
      })
      opsSocket = openCommandCenterRealtimeSocket({
        topic: "ops",
        open_kfid: openKFID,
        since_version: realtimeVersionRef.current,
        onMessage: handleMessage,
      })
    }

    connect()
    return () => {
      stopped = true
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
      }
      ;[chatSocket, opsSocket].forEach((socket) => {
        if (!socket) return
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close()
        }
      })
    }
  }, [bootstrap?.external_userid, bootstrap?.open_kfid, query.external_userid, query.open_kfid, sessionLocator.external_userid, sessionLocator.open_kfid])

  useEffect(() => {
    const nextSteps: Record<string, number> = {}
    const items = bootstrap?.suggestions?.items || []
    items.forEach((item, idx) => {
      const normalized = normalizeSuggestion(item, idx)
      nextSteps[normalized.id] = 0
    })
    setThreadSteps(nextSteps)
  }, [bootstrap?.suggestions?.batch_id])

  const suggestions = useMemo(() => {
    return (bootstrap?.suggestions?.items || []).map((item, idx) => normalizeSuggestion(item, idx))
  }, [bootstrap?.suggestions?.items])

  const header = bootstrap?.header
  const summary = bootstrap?.summary
  const canUpgrade = Boolean(header?.can_upgrade_contact && bootstrap?.external_userid)

  const safeFeedback = async (input: { reply_id?: string; action?: string; step?: number }) => {
    try {
      await sendKFToolbarReplyFeedback({
        open_kfid: bootstrap?.open_kfid || query.open_kfid,
        external_userid: bootstrap?.external_userid || sessionLocator.external_userid || query.external_userid,
        reply_id: input.reply_id,
        action: input.action,
        step: input.step,
      })
    } catch {
      // best effort only
    }
  }

  const handleCopySuggestion = async (item: NormalizedSuggestion) => {
    const currentStep = Math.min(threadSteps[item.id] || 0, item.sentences.length - 1)
    const text = item.sentences[currentStep] || item.text
    try {
      await navigator.clipboard.writeText(text)
      setNotice(currentStep > 0 ? "已复制下一句建议" : "已复制建议内容")
      void safeFeedback({ reply_id: item.id, action: "copy", step: currentStep + 1 })
    } catch {
      setNotice("复制失败，请手动复制")
    }
  }

  const handleFillSuggestion = async (item: NormalizedSuggestion) => {
    const currentStep = Math.min(threadSteps[item.id] || 0, item.sentences.length - 1)
    const text = item.sentences[currentStep] || item.text
    try {
      setIsSubmitting(true)
      const runtime = await sendTextToCurrentSession(text, {
        external_userid: bootstrap?.external_userid || sessionLocator.external_userid || query.external_userid,
      })
      void safeFeedback({ reply_id: item.id, action: "fill", step: currentStep + 1 })
      if (currentStep + 1 < item.sentences.length) {
        setThreadSteps((prev) => ({ ...prev, [item.id]: currentStep + 1 }))
        setNotice(`已填入第 ${currentStep + 1} 句，可继续发送下一句`)
      } else {
        setThreadSteps((prev) => ({ ...prev, [item.id]: item.sentences.length }))
        setNotice(item.hasFollowups ? "已完成本组分步回复填入" : "已通过企业微信客户端填入当前会话")
      }
      void executeContactSidebarCommand({
        command: "contact_fill_suggestion",
        external_userid: runtime.external_userid || bootstrap?.external_userid || sessionLocator.external_userid || query.external_userid,
        payload: { text, source: "jssdk_send_chat_message", reply_id: item.id, step: currentStep + 1 },
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

  const handleRegenerate = async () => {
    if (!bootstrap) return
    try {
      setIsRegenerating(true)
      const batch = await regenerateKFToolbarSuggestions({
        entry: bootstrap.entry || sessionLocator.entry || query.entry,
        open_kfid: bootstrap.open_kfid || sessionLocator.open_kfid || query.open_kfid,
        external_userid: bootstrap.external_userid || sessionLocator.external_userid || query.external_userid,
        seed_reply_id: suggestions[0]?.id || "",
        reason: "manual_refresh",
      })
      if (batch) {
        setBootstrap((prev) =>
          prev
            ? {
                ...prev,
                suggestions: batch,
                version: Date.now(),
              }
            : prev,
        )
        setNotice("已更新一组新的建议回复")
        void safeFeedback({ reply_id: suggestions[0]?.id, action: "regenerate", step: 0 })
      }
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleUpgrade = async () => {
    try {
      setIsSubmitting(true)
      const result = await executeContactSidebarCommand({
        command: "kf_upgrade_to_contact",
        external_userid: bootstrap?.external_userid || sessionLocator.external_userid || query.external_userid,
        payload: {
          assigned_userid: upgradeOwner,
          intent: upgradeIntent,
          note: upgradeNote,
          contact_name: header?.contact_name,
          open_kfid: bootstrap?.open_kfid || sessionLocator.open_kfid || query.open_kfid,
        },
      })
      if (result?.success) {
        setIsUpgraded(true)
      }
      setNotice((result?.message || "升级命令已提交").trim())
      setIsUpgradeModalOpen(false)
      await loadBootstrap({ preserveNotice: true })
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={sidebarPageShell}>
      <div className={`${sidebarHeader} sticky top-0 z-10 shadow-[0_8px_24px_rgba(15,23,42,0.04)]`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className={sidebarTitle}>{(header?.contact_name || "未识别客户").trim()}</span>
              <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
                {(header?.session_status || "会话中").trim()}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(header?.risk_tags || []).map((tag) => (
                <Badge key={tag} variant="warning" className="px-2 py-0.5 text-[10px]">
                  {tag}
                </Badge>
              ))}
              {header?.last_active ? (
                <span className={`${sidebarMeta} inline-flex items-center gap-1`}>
                  <Clock className="h-3 w-3" />
                  {header.last_active.replace("T", " ").slice(0, 16)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              className={`h-8 rounded-full px-3 text-[11px] ${isUpgraded ? "bg-slate-100 text-slate-400" : "bg-blue-600 text-white hover:bg-blue-700"}`}
              disabled={!canUpgrade || isUpgraded || isSubmitting}
              onClick={() => setIsUpgradeModalOpen(true)}
            >
              {isUpgraded ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <ArrowUpRight className="mr-1 h-3.5 w-3.5" />}
              {isUpgraded ? "已升级" : "升级客户联系"}
            </Button>
          </div>
        </div>

        {notice ? <div className={`${sidebarNotice} rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-blue-700`}>{notice}</div> : null}
        {bootstrap?.warnings && bootstrap.warnings.length > 0 ? (
          <div className={`${sidebarNotice} mt-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-orange-700`}>
            {bootstrap.warnings.join("；")}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <ToolbarSkeleton />
      ) : (
        <div className={`${sidebarBody} space-y-3`}>
          <Card className="wecom-toolbar-panel wecom-toolbar-enter rounded-2xl border-slate-200 bg-white/95">
            <div className="mb-3 flex items-start gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <div className={sidebarSectionLabel}>会话摘要</div>
                  <Badge
                    variant={(summary?.status || "") === "ready" ? "success" : "secondary"}
                    className="px-2 py-0.5 text-[10px]"
                  >
                    {(summary?.status || "pending").trim()}
                  </Badge>
                </div>
                <p className="wecom-toolbar-summary-text m-0 text-slate-800">
                  {(summary?.current_round || "正在整理本轮会话重点...").trim()}
                </p>
              </div>
            </div>

            {(summary?.history_highlights || []).length > 0 ? (
              <div className="space-y-2 rounded-2xl bg-slate-50/90 p-3">
                {(summary?.history_highlights || []).map((item, idx) => (
                  <div key={`${item}-${idx}`} className="flex items-start gap-2 text-[12px] text-slate-600">
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>

          <Card className="wecom-toolbar-panel rounded-2xl border-slate-200 bg-white/95">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className={sidebarSectionLabel}>AI 建议回复</div>
                  <div className={`${sidebarMeta} mt-0.5`}>默认先展示首句，分步建议可继续逐句填入</div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-slate-200 px-3 text-[11px]"
                disabled={isRegenerating || isSubmitting}
                onClick={() => void handleRegenerate()}
              >
                <RefreshCcw className={`mr-1 h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                换一批
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/45">
              {suggestions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[12px] text-slate-500">
                  AI 正在组织更合适的回复...
                </div>
              ) : (
                suggestions.map((item, idx) => {
                  const currentStep = Math.min(threadSteps[item.id] || 0, item.sentences.length)
                  const currentSentence = item.sentences[Math.min(currentStep, item.sentences.length - 1)] || item.text
                  const completedSentences = item.sentences.slice(0, Math.min(currentStep, item.sentences.length))
                  const remainingCount = Math.max(item.sentences.length - currentStep - 1, 0)
                  const isFinished = currentStep >= item.sentences.length
                  const primaryLabel = isFinished ? "已完成本组回复" : currentStep === 0 ? "填入首句" : item.nextStepLabel

                  return (
                    <div
                      key={item.id}
                      className={`wecom-toolbar-list-item wecom-toolbar-enter ${
                        item.displayMode === "threaded" ? "wecom-toolbar-thread-row" : ""
                      } ${idx < suggestions.length - 1 ? "border-b border-slate-100" : ""}`}
                      style={{ animationDelay: `${idx * 70}ms` }}
                    >
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge variant={item.hasFollowups ? "default" : "secondary"} className="shrink-0 px-2 py-0.5 text-[10px]">
                            {item.hasFollowups ? "分步发送" : "直接回复"}
                          </Badge>
                          {item.hasFollowups ? (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                              {Math.min(currentStep + 1, item.sentences.length)}/{item.sentences.length}
                            </span>
                          ) : null}
                          {item.source ? <span className="truncate text-[10px] uppercase tracking-[0.08em] text-slate-400">{item.source}</span> : null}
                        </div>
                        <div className={`${sidebarMeta} max-w-[44%] text-right`}>
                          {item.reason ? <div>{item.reason}</div> : null}
                        </div>
                      </div>

                      {completedSentences.length > 0 && item.hasFollowups ? (
                        <div className="mb-2 space-y-1 rounded-xl bg-white px-2.5 py-2 shadow-[inset_0_0_0_1px_rgba(191,219,254,0.55)]">
                          {completedSentences.map((sentence, sentenceIdx) => (
                            <div key={`${item.id}-done-${sentenceIdx}`} className="flex items-start gap-2 text-[11px] text-slate-500">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                              <span>{sentence}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {!isFinished ? (
                        <div className="mb-2 text-[12.5px] leading-6 text-slate-800">
                          {currentSentence}
                        </div>
                      ) : (
                        <div className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
                          这组建议已全部填入完成，可直接发送或切换下一组建议。
                        </div>
                      )}

                      {item.hasFollowups && !isFinished ? (
                        <div className="mb-2 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/80 px-2.5 py-1.5 text-[11px] text-blue-700">
                          <span>{currentStep === 0 ? "这条建议还有下一句" : `后续还有 ${remainingCount} 句可继续发送`}</span>
                          <span className="font-medium">{item.nextStepLabel}</span>
                        </div>
                      ) : null}

                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-7 rounded-full px-2.5 text-[10.5px]" onClick={() => void handleCopySuggestion(item)}>
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          {item.hasFollowups && currentStep > 0 ? "复制当前句" : "复制"}
                        </Button>
                        <Button
                          size="sm"
                          className={`h-7 rounded-full px-2.5 text-[10.5px] ${isFinished ? "bg-slate-100 text-slate-400" : "bg-blue-600 hover:bg-blue-700"}`}
                          disabled={isSubmitting || isFinished}
                          onClick={() => void handleFillSuggestion(item)}
                        >
                          <Send className="mr-1 h-3.5 w-3.5" />
                          {primaryLabel}
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </div>
      )}

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
              className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <Textarea className="min-h-[80px] text-sm" value={upgradeNote} onChange={(event) => setUpgradeNote(event.target.value)} />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
