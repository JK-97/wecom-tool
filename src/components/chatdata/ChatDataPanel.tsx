import { AlertCircle, Info, Loader2, RefreshCw } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import { ChatDataMessageFrame } from "@/components/chatdata/ChatDataMessageFrame"
import { type ChatDataMessageSummary, type ChatDataPanelView } from "@/services/chatdataService"

function formatUnixSeconds(value?: number): string {
  const raw = Number(value || 0)
  if (!Number.isFinite(raw) || raw <= 0) return "-"
  return new Date(raw * 1000).toLocaleString("zh-CN", { hour12: false })
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
  const state = (panel?.init_state || "").trim()
  if (loading || bootstrapping) return true
  return state === "queued" || state === "running"
}

export function ChatDataPanel(props: {
  panel: ChatDataPanelView | null
  loading?: boolean
  bootstrapping?: boolean
  error?: string
  onReload?: () => void
  onBootstrap?: () => void
}) {
  const auth = useAuth()
  const panel = props.panel
  const messages = orderedMessages(panel?.messages || [])
  const lastSyncTime = formatHeaderTime(panel?.last_sync_time)
  const statusIsHealthy = !props.error && !panel?.last_error && (panel?.capability_status || "").trim() === "ready"
  const needsRetryAction = Boolean(props.onBootstrap && panel?.can_retry_init && (props.error || panel?.last_error))
  const isPending = showPendingState(panel, props.loading, props.bootstrapping) && messages.length === 0
  const currentUserID = (auth.user?.userid || "").trim()
  const currentOpenUserID = (auth.user?.openUserID || "").trim()

  return (
    <div className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span className="relative flex h-2 w-2">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-75",
                    statusIsHealthy ? "animate-ping bg-green-400" : "bg-amber-300"
                  )}
                />
                <span className={cn("relative inline-flex h-2 w-2 rounded-full", statusIsHealthy ? "bg-green-500" : "bg-amber-500")} />
              </span>
              自动同步中
            </div>
            <span className="hidden text-gray-300 sm:inline">|</span>
            <span className="text-xs text-gray-500">上次同步时间: {lastSyncTime}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-white text-xs text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            onClick={props.onReload}
            disabled={props.loading || props.bootstrapping}
          >
            {props.loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            手动刷新
          </Button>
        </div>
      </div>

      <div className="shrink-0 border-b border-blue-100 bg-blue-50/50 px-4 py-2.5">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <div className="text-xs leading-relaxed text-blue-800">
            <span className="font-semibold">提示：</span>
            受接口限制，只能追回近 5 天内的历史聊天记录（超过 5 天的历史消息无法再补拉）。新产生的消息将自动持续同步至此处。
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

        {isPending ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
            <Loader2 className="mb-3 h-7 w-7 animate-spin text-gray-400" />
            <div className="text-sm font-medium text-gray-700">正在同步最近消息</div>
            <div className="mt-1 text-xs text-gray-500">新产生的消息同步完成后，会自动持续出现在这里。</div>
          </div>
        ) : messages.length > 0 ? (
          <div className="space-y-6">
            {messages.map((item, index) => {
              const sender = senderIdentity(panel, item, currentUserID, currentOpenUserID)
              const label = sender.fallbackName
              const external = isExternalSender(item)
              const prevTime = index > 0 ? formatUnixSeconds(messages[index - 1]?.send_time) : ""
              const nextTime = formatUnixSeconds(item.send_time)
              const showTimeChip = index === 0 || prevTime !== nextTime

              return (
                <div key={item.msg_id || `${item.send_time || 0}-${index}`} className="space-y-3">
                  {showTimeChip ? (
                    <div className="flex items-center justify-center">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400">{nextTime}</span>
                    </div>
                  ) : null}

                  <div className={cn("flex gap-3", external ? "justify-start" : "justify-end")}>
                    <ChatDataMessageFrame
                      message={item}
                      tone={external ? "incoming" : "outgoing"}
                      senderOpenID={sender.openid}
                      senderNameType={sender.nameType}
                      senderAvatarType={sender.avatarType}
                      senderFallbackName={label}
                    />
                  </div>
                </div>
              )
            })}
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
