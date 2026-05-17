import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Check, ChevronDown, Info, Loader2, RefreshCw } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import { ChatDataMessageFrame, type ChatDataMessageRenderState } from "@/components/chatdata/ChatDataMessageFrame"
import { type ChatDataRefreshPolicy } from "@/hooks/useChatDataPanel"
import { type ChatDataDisplayBootstrap, type ChatDataMessageSummary, type ChatDataPanelView } from "@/services/chatdataService"

function formatUnixSeconds(value?: number): string {
  const raw = Number(value || 0)
  if (!Number.isFinite(raw) || raw <= 0) return "-"
  return new Date(raw * 1000).toLocaleString("zh-CN", { hour12: false })
}

function formatMessageTime(value?: number): string {
  const raw = Number(value || 0)
  if (!Number.isFinite(raw) || raw <= 0) return "-"
  return new Date(raw * 1000).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" })
}

function formatHeaderTime(value?: string): string {
  const text = (value || "").trim()
  if (!text) return "-"
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) return text
  const date = new Date(parsed)
  const now = new Date()
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) {
    return `今天 ${date.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" })}`
  }
  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function orderedMessages(messages: ChatDataMessageSummary[]): ChatDataMessageSummary[] {
  return [...messages].sort((left, right) => Number(left.send_time || 0) - Number(right.send_time || 0))
}

function sameCalendarDay(leftSeconds: number, rightSeconds: number): boolean {
  const left = new Date(leftSeconds * 1000)
  const right = new Date(rightSeconds * 1000)
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function shouldShowSectionTime(current?: number, previous?: number): boolean {
  const next = Number(current || 0)
  const prev = Number(previous || 0)
  if (!Number.isFinite(next) || next <= 0) return false
  if (!Number.isFinite(prev) || prev <= 0) return true
  if (!sameCalendarDay(next, prev)) return true
  return next - prev >= 30 * 60
}

function buildDisplayBootstrapMap(items: ChatDataDisplayBootstrap[] | undefined): Map<string, ChatDataDisplayBootstrap> {
  const out = new Map<string, ChatDataDisplayBootstrap>()
  for (const item of items || []) {
    const msgID = (item?.msg_id || "").trim()
    if (!msgID) continue
    out.set(msgID, item)
  }
  return out
}

function isExternalSender(message: ChatDataMessageSummary): boolean {
  return Number(message.sender_type || 0) === 2
}

function senderFallbackLabel(panel: ChatDataPanelView | null, message: ChatDataMessageSummary): string {
  if (isExternalSender(message)) {
    return panel?.target_type === "chat_id" ? "客户成员" : "客户"
  }
  return panel?.target_type === "chat_id" ? "群成员" : "服务成员"
}

function senderDisplayName(panel: ChatDataPanelView | null, message: ChatDataMessageSummary): string {
  const senderID = (message.sender_id || "").trim()
  if (!senderID) return senderFallbackLabel(panel, message)
  const looksLikeHumanName = /[\u4e00-\u9fa5]/.test(senderID)
  if (looksLikeHumanName || senderID.length <= 12) return senderID
  return senderFallbackLabel(panel, message)
}

function senderIdentity(
  panel: ChatDataPanelView | null,
  message: ChatDataMessageSummary,
  currentUserID: string,
  currentOpenUserID: string,
) {
  const senderID = (message.sender_id || "").trim()
  const external = isExternalSender(message)
  const chatID = (message.chat_id || panel?.target_id || "").trim()
  let openid = ""

  if (senderID) {
    if (external) {
      openid = panel?.target_type === "chat_id" && chatID ? `${chatID}/${senderID}` : senderID
    } else if (currentUserID && currentOpenUserID && senderID === currentUserID) {
      openid = currentOpenUserID
    }
  }

  return {
    openid,
    nameType: external ? "externalUserName" : "userName",
    avatarType: external ? "externalUserAvatar" : "userAvatar",
    fallbackName: senderDisplayName(panel, message),
  } as const
}

function emptyReason(panel: ChatDataPanelView | null, error?: string): "not-synced" | "paused" {
  if (error) return "paused"
  if (panel?.recovery_blocking) return "paused"
  const capability = (panel?.capability_status || "").trim()
  if (capability && capability !== "ready") return "paused"
  return "not-synced"
}

function showPendingState(panel: ChatDataPanelView | null, loading?: boolean, bootstrapping?: boolean): boolean {
  const capability = (panel?.capability_status || "").trim()
  const state = (panel?.init_state || "").trim()
  const syncMode = (panel?.sync_mode || "").trim()
  if (loading || bootstrapping) return true
  if (capability && capability !== "ready") return false
  if (syncMode === "idle") return false
  return state === "queued" || state === "running"
}

function ChatDataCenteredLoader(props: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex h-full min-h-[360px] items-center justify-center px-6">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/55 shadow-sm backdrop-blur-sm">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        </div>
        <div className="text-sm font-medium text-gray-700">{props.title}</div>
        {props.subtitle ? (
          <div className="mt-1 max-w-[240px] text-xs leading-5 text-gray-400">{props.subtitle}</div>
        ) : null}
      </div>
    </div>
  )
}

export function ChatDataPanel(props: {
  panel: ChatDataPanelView | null
  loading?: boolean
  bootstrapping?: boolean
  error?: string
  refreshPolicy: ChatDataRefreshPolicy
  onRefreshPolicyChange?: (policy: ChatDataRefreshPolicy) => void
  onReload?: () => void
  onBootstrap?: () => void
}) {
  const auth = useAuth()
  const panel = props.panel
  const messages = orderedMessages(panel?.messages || [])
  const displayBootstrapMap = useMemo(() => buildDisplayBootstrapMap(panel?.display_bootstraps), [panel?.display_bootstraps])
  const [renderStates, setRenderStates] = useState<Record<string, ChatDataMessageRenderState>>({})
  const [refreshMenuOpen, setRefreshMenuOpen] = useState(false)
  const lastSyncTime = formatHeaderTime(panel?.last_sync_time)
  const needsRetryAction = Boolean(props.onBootstrap && panel?.can_retry_init && (props.error || panel?.last_error))
  const isPending = showPendingState(panel, props.loading, props.bootstrapping) && messages.length === 0
  const openDataHint = (panel?.open_data_hint || "").trim()
  const currentUserID = (auth.user?.userid || "").trim()
  const currentOpenUserID = (auth.user?.openUserID || "").trim()

  useEffect(() => {
    const activeMsgIDs = new Set(messages.map((item) => (item.msg_id || "").trim()).filter(Boolean))
    setRenderStates((previous) => {
      const next: Record<string, ChatDataMessageRenderState> = {}
      for (const [msgID, state] of Object.entries(previous)) {
        if (activeMsgIDs.has(msgID)) {
          next[msgID] = state
        }
      }
      return next
    })
  }, [messages])

  useEffect(() => {
    if (!refreshMenuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) {
        setRefreshMenuOpen(false)
        return
      }
      if (target.closest("[data-chatdata-refresh]")) return
      setRefreshMenuOpen(false)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRefreshMenuOpen(false)
      }
    }
    window.addEventListener("mousedown", handlePointerDown)
    window.addEventListener("keydown", handleEscape)
    return () => {
      window.removeEventListener("mousedown", handlePointerDown)
      window.removeEventListener("keydown", handleEscape)
    }
  }, [refreshMenuOpen])

  const handleRenderStateChange = (msgID: string, state: ChatDataMessageRenderState) => {
    if (!msgID) return
    setRenderStates((previous) => {
      if (previous[msgID] === state) return previous
      return { ...previous, [msgID]: state }
    })
  }

  const pendingMessageCount = messages.filter((item) => {
    const msgID = (item.msg_id || "").trim()
    if (!msgID) return false
    const bootstrap = displayBootstrapMap.get(msgID)
    if ((bootstrap?.error || "").trim()) return false
    const state = renderStates[msgID]
    return state !== "ready" && state !== "error"
  }).length
  const showInitialMessageLoading = messages.length > 0 && pendingMessageCount === messages.length

  return (
    <div className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center justify-end gap-3">
          {lastSyncTime !== "-" ? <span className="text-xs text-gray-400">更新于 {lastSyncTime}</span> : null}
          <div className="relative" data-chatdata-refresh>
            <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
              {props.refreshPolicy === "auto_5s" ? (
                <span className="ml-1 mr-1 inline-flex h-5 items-center rounded-full bg-blue-50 px-1.5 text-[11px] font-semibold text-blue-600">
                  5s
                </span>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-lg px-3 text-sm text-gray-700 hover:bg-gray-100"
                onClick={props.onReload}
                disabled={props.loading || props.bootstrapping}
              >
                {props.loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                刷新
              </Button>
              <div className="mx-1 h-5 w-px bg-gray-200" />
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 rounded-lg p-0 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="打开刷新设置"
                aria-expanded={refreshMenuOpen}
                onClick={() => setRefreshMenuOpen((value) => !value)}
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", refreshMenuOpen ? "rotate-180" : "")} />
              </Button>
            </div>

            {refreshMenuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-2 min-w-[148px] rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                {([
                  { value: "manual", label: "手动" },
                  { value: "auto_5s", label: "每 5 秒" },
                ] as Array<{ value: ChatDataRefreshPolicy; label: string }>).map((item) => {
                  const active = props.refreshPolicy === item.value
                  return (
                    <button
                      key={item.value}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        active ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50",
                      )}
                      onClick={() => {
                        props.onRefreshPolicyChange?.(item.value)
                        setRefreshMenuOpen(false)
                      }}
                    >
                      <span>{item.label}</span>
                      {active ? <Check className="h-4 w-4" /> : null}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b border-blue-100 bg-blue-50/50 px-4 py-2.5">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <div className="text-xs leading-relaxed text-blue-800">
            <span className="font-semibold">提示：</span>
            受接口限制，只能追回近 5 天内的历史聊天记录（超过 5 天的历史消息无法再补拉）。新产生的消息会先由后台持续同步，再按当前刷新策略更新到此处。
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f5f6f7] p-4">
        {props.error ? (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{props.error}</div>
        ) : null}

        {panel?.last_error ? (
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
            <span>最近一次同步未完成：{(panel.last_error || "").trim()}</span>
            {needsRetryAction ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-amber-200 bg-white text-xs text-amber-800 hover:bg-amber-100"
                onClick={props.onBootstrap}
                disabled={props.bootstrapping}
              >
                {props.bootstrapping ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                重新尝试
              </Button>
            ) : null}
          </div>
        ) : null}

        {!props.error && !panel?.last_error && openDataHint ? (
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
            <span>{openDataHint}</span>
            {panel?.open_data_required ? null : needsRetryAction ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-amber-200 bg-white text-xs text-amber-800 hover:bg-amber-100"
                onClick={props.onBootstrap}
                disabled={props.bootstrapping}
              >
                {props.bootstrapping ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                重新尝试
              </Button>
            ) : null}
          </div>
        ) : null}

        {isPending ? (
          <ChatDataCenteredLoader
            title="正在准备会话回显"
            subtitle="完成最近消息同步后，会在这里一次性展示。"
          />
        ) : messages.length > 0 ? (
          <div className="relative">
            {showInitialMessageLoading ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-[linear-gradient(180deg,rgba(245,246,247,0.72),rgba(245,246,247,0.9))]">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/60 shadow-sm backdrop-blur-sm">
                    <Loader2 className="h-4.5 w-4.5 animate-spin text-blue-500" />
                  </div>
                  <div className="text-xs font-medium tracking-[0.02em] text-gray-600">正在加载消息内容</div>
                  <div className="mt-1 text-[11px] text-gray-400">内容准备完成后会一起出现</div>
                </div>
              </div>
            ) : null}

            <div className="space-y-6">
            {messages.map((item, index) => {
              const sender = senderIdentity(panel, item, currentUserID, currentOpenUserID)
              const label = sender.fallbackName
              const external = isExternalSender(item)
              const msgID = (item.msg_id || "").trim()
              const displayBootstrap = displayBootstrapMap.get(msgID) || null
              const renderState = msgID ? renderStates[msgID] : undefined
              const rowVisible = Boolean((displayBootstrap?.error || "").trim()) || renderState === "ready" || renderState === "error"
              const nextTime = formatUnixSeconds(item.send_time)
              const showTimeChip = shouldShowSectionTime(item.send_time, index > 0 ? messages[index - 1]?.send_time : 0)

              return (
                <div
                  key={item.msg_id || `${item.send_time || 0}-${index}`}
                  className={cn("space-y-3 transition-opacity duration-150", rowVisible ? "opacity-100" : "opacity-0")}
                >
                  {rowVisible && showTimeChip ? (
                    <div className="flex items-center justify-center">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400">{nextTime}</span>
                    </div>
                  ) : null}

                  <div className={cn("flex gap-3", external ? "justify-start" : "justify-end")}>
                    <ChatDataMessageFrame
                      message={item}
                      displayBootstrap={displayBootstrap}
                      tone={external ? "incoming" : "outgoing"}
                      footerTimeLabel={formatMessageTime(item.send_time)}
                      senderOpenID={sender.openid}
                      senderNameType={sender.nameType}
                      senderAvatarType={sender.avatarType}
                      senderFallbackName={label}
                      onRenderStateChange={handleRenderStateChange}
                    />
                  </div>
                </div>
              )
            })}
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-4 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <AlertCircle className="h-8 w-8 text-gray-400" />
            </div>
            {emptyReason(panel, props.error) === "not-synced" ? (
              <>
                <h3 className="mb-1 text-sm font-semibold text-gray-900">过去 5 天内无聊天记录</h3>
                <p className="max-w-[240px] text-xs text-gray-500">5 天之外的历史消息由于微信接口限制无法再追回。</p>
              </>
            ) : (
              <>
                <h3 className="mb-1 text-sm font-semibold text-gray-900">数据同步已暂停</h3>
                <p className="max-w-[240px] text-xs text-gray-500">请前往「组织与设置 - 业务数据同步」中恢复群聊同步任务。</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
