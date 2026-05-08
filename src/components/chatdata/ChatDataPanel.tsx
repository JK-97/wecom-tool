import { AlertCircle, Clock3, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { ChatDataMessageFrame } from "@/components/chatdata/ChatDataMessageFrame"
import { type ChatDataPanelView } from "@/services/chatdataService"

function formatUnixSeconds(value?: number): string {
  const raw = Number(value || 0)
  if (!Number.isFinite(raw) || raw <= 0) return "-"
  return new Date(raw * 1000).toLocaleString("zh-CN", { hour12: false })
}

function formatDateTime(value?: string): string {
  const text = (value || "").trim()
  if (!text) return "-"
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) return text
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false })
}

function syncStateMeta(panel: ChatDataPanelView | null, bootstrapping?: boolean) {
  const state = (panel?.init_state || "").trim()
  const capability = (panel?.capability_status || "").trim()
  if (bootstrapping || state === "queued" || state === "running") {
    return {
      label: "同步中",
      tone: "border-blue-200 bg-blue-50 text-blue-700",
      title: "会话内容正在准备中",
      description: "首次进入会自动初始化，新的企业微信消息同步后也会自动回到这里。",
    }
  }
  if (state === "failed") {
    return {
      label: "需重试",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      title: "最近一次同步没有完成",
      description: "可以重新检查一次同步状态，恢复后这里会继续展示最近会话内容。",
    }
  }
  if ((panel?.has_messages || false) && capability === "ready") {
    return {
      label: "已就绪",
      tone: "border-green-200 bg-green-50 text-green-700",
      title: "最近会话内容已就绪",
      description: "这里展示的是专区内已同步的会话回显，页面会继续自动刷新。",
    }
  }
  if (capability === "ready") {
    return {
      label: "待同步",
      tone: "border-slate-200 bg-slate-50 text-slate-700",
      title: "正在等待可展示的会话内容",
      description: "进入详情后会自动准备同步结果，稍后新的消息同步完成后会直接出现在这里。",
    }
  }
  return {
    label: "待配置",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
    title: "会话回显还没有完全可用",
    description: "完成数据专区相关配置后，页面会自动开始准备会话内容。",
  }
}

function latestMessageTime(messages: Array<{ send_time?: number }>): string {
  if (messages.length === 0) return "-"
  return formatUnixSeconds(messages[0]?.send_time)
}

export function ChatDataPanel(props: {
  panel: ChatDataPanelView | null
  loading?: boolean
  bootstrapping?: boolean
  error?: string
  onReload?: () => void
  onBootstrap?: () => void
}) {
  const panel = props.panel
  const messages = panel?.messages || []
  const meta = syncStateMeta(panel, props.bootstrapping)
  const latestSyncTime = formatDateTime(panel?.last_sync_time)
  const autoRefreshHint =
    meta.label === "同步中" ? "正在持续更新" : (panel?.has_messages || false) ? "自动刷新中" : "等待新消息"

  return (
    <Card className="overflow-hidden border-gray-200 shadow-sm">
      <CardHeader className="gap-4 border-b border-gray-100 bg-white p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <Badge variant="outline" className="w-fit border-blue-200 bg-blue-50 text-blue-700">
              数据专区会话回显
            </Badge>
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">{meta.title}</CardTitle>
              <p className="mt-1 text-sm leading-6 text-gray-500">{meta.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={meta.tone}>
              {meta.label}
            </Badge>
            <Button variant="outline" size="sm" onClick={props.onReload} disabled={props.loading}>
              {props.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              刷新
            </Button>
            {panel?.can_retry_init ? (
              <Button variant="outline" size="sm" onClick={props.onBootstrap} disabled={props.bootstrapping}>
                {props.bootstrapping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                重新检查同步
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-xs text-gray-500">最新同步时间</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{latestSyncTime}</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="text-xs text-amber-700">展示范围</div>
            <div className="mt-1 text-sm font-semibold text-amber-900">仅支持近 5 天会话内容</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-xs text-gray-500">自动同步状态</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{autoRefreshHint}</div>
          </div>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div>
              <div>进入客户或群详情后会自动准备会话回显；企业微信里产生的新消息同步完成后，也会自动出现在这里。</div>
              <div className="mt-1 text-xs text-blue-700">{(panel?.open_data_hint || "请先完成数据专区相关配置。").trim()}</div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="bg-[#F7F8FA] p-0">
        {props.error ? (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">{props.error}</div>
        ) : null}
        {panel?.last_error ? (
          <div className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">
            最近一次同步提示：{(panel.last_error || "").trim()}
          </div>
        ) : null}

        {props.loading && !panel ? (
          <div className="flex min-h-[220px] items-center justify-center text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            正在读取会话回显...
          </div>
        ) : messages.length === 0 ? (
          <div className="px-6 py-10">
            <EmptyState
              icon={AlertCircle}
              title="这里还没有可展示的聊天内容"
              description={
                meta.label === "待配置"
                  ? "先完成数据专区配置，页面会在能力就绪后自动开始准备会话回显。"
                  : "消息同步完成后，这里会以聊天记录的形式展示最近 5 天内的会话内容。"
              }
            />
          </div>
        ) : (
          <div className="px-4 py-5 md:px-6">
            <div className="mx-auto max-w-3xl space-y-5">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Clock3 className="h-3.5 w-3.5" />
                最近一条消息时间：{latestMessageTime(messages)}
              </div>
              {messages.map((item) => (
                <div key={item.msg_id} className="space-y-2">
                  <div className="flex justify-center">
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] text-gray-400 shadow-sm">
                      {formatUnixSeconds(item.send_time)}
                    </span>
                  </div>
                  <div className="flex">
                    <div className="max-w-full rounded-2xl rounded-tl-md border border-gray-200 bg-white px-4 py-3 shadow-sm md:max-w-[92%]">
                      <ChatDataMessageFrame message={item} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
