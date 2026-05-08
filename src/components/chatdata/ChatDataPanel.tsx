import { AlertTriangle, Loader2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { ChatDataMessageFrame } from "@/components/chatdata/ChatDataMessageFrame"
import { type ChatDataPanelView } from "@/services/chatdataService"

function formatDateTime(value?: number): string {
  const raw = Number(value || 0)
  if (!Number.isFinite(raw) || raw <= 0) return "-"
  return new Date(raw * 1000).toLocaleString("zh-CN", { hour12: false })
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
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-gray-100 p-4">
        <CardTitle className="text-sm font-semibold text-gray-800">数据专区会话回显</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            {(panel?.init_state || "not_started").trim() || "not_started"}
          </Badge>
          <Button variant="outline" size="sm" onClick={props.onReload} disabled={props.loading}>
            {props.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            刷新
          </Button>
          <Button size="sm" onClick={props.onBootstrap} disabled={props.bootstrapping}>
            {props.bootstrapping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            初始化同步
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {props.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{props.error}</div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">同步状态</div>
            <div className="mt-1 font-medium text-gray-900">{(panel?.sync_status || "-").trim()}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">能力状态</div>
            <div className="mt-1 font-medium text-gray-900">{(panel?.capability_status || "-").trim()}</div>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {(panel?.open_data_hint || "请先完成数据专区配置。").trim()}
        </div>
        {messages.length === 0 ? (
          <EmptyState icon={AlertTriangle} title="暂无会话回显" description="完成首次同步后，这里会显示与当前客户或客户群相关的消息。" />
        ) : (
          <div className="space-y-3">
            {messages.map((item) => (
              <div key={item.msg_id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium uppercase tracking-[0.08em] text-gray-400">会话消息</div>
                  <div className="text-[11px] text-gray-400">{formatDateTime(item.send_time)}</div>
                </div>
                <div className="mt-3">
                  <ChatDataMessageFrame message={item} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
                  <span>msg_id: {(item.msg_id || "-").trim()}</span>
                  <span>chat_id: {(item.chat_id || "-").trim()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
