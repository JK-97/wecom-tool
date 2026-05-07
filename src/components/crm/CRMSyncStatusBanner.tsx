import { useMemo } from "react"
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react"
import { type CRMSyncScope, type CRMSyncScopeCard } from "@/services/crmSyncService"

type BannerTone = {
  wrapper: string
  icon: string
  progressBg: string
  progressFill: string
  text: string
  subText: string
  button: string
}

function formatDateTime(value?: string): string {
  const text = (value || "").trim()
  if (!text) return "-"
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) return text
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false })
}

function bannerTone(status?: string): BannerTone {
  switch ((status || "").trim()) {
    case "running":
    case "cancelling":
      return {
        wrapper: "bg-blue-50 border-blue-100",
        icon: "text-blue-600",
        progressBg: "bg-blue-200",
        progressFill: "bg-blue-600",
        text: "text-blue-900",
        subText: "text-blue-700",
        button: "border-blue-200 text-blue-700 hover:bg-blue-100",
      }
    case "partial_failed":
    case "failed":
    case "canceled":
      return {
        wrapper: "bg-amber-50 border-amber-100",
        icon: "text-amber-600",
        progressBg: "bg-amber-200",
        progressFill: "bg-amber-500",
        text: "text-amber-900",
        subText: "text-amber-700",
        button: "border-amber-200 text-amber-700 hover:bg-amber-100",
      }
    case "completed":
      return {
        wrapper: "bg-green-50 border-green-100",
        icon: "text-green-600",
        progressBg: "bg-green-200",
        progressFill: "bg-green-500",
        text: "text-green-900",
        subText: "text-green-700",
        button: "border-green-200 text-green-700 hover:bg-green-100",
      }
    default:
      return {
        wrapper: "bg-gray-50 border-gray-100",
        icon: "text-gray-500",
        progressBg: "bg-gray-200",
        progressFill: "bg-gray-500",
        text: "text-gray-900",
        subText: "text-gray-600",
        button: "border-gray-200 text-gray-700 hover:bg-gray-100",
      }
  }
}

function progressPercent(card?: CRMSyncScopeCard | null): number {
  const planned = Number(card?.latest_run?.planned_total || 0)
  const finished =
    Number(card?.latest_run?.succeeded_total || 0) +
    Number(card?.latest_run?.failed_total || 0) +
    Number(card?.latest_run?.skipped_total || 0)
  if (planned <= 0) {
    if ((card?.status || "").trim() === "completed") return 100
    return 0
  }
  return Math.max(0, Math.min(100, Math.round((finished / planned) * 100)))
}

function buildPrimaryMessage(scopeTitle: string, card?: CRMSyncScopeCard | null): string {
  const status = (card?.status || "").trim()
  const percent = progressPercent(card)
  const label = (card?.status_label || "").trim() || "暂无同步"
  if (status === "running" || status === "cancelling") {
    return `${scopeTitle}${label}${percent > 0 ? ` (${percent}%)` : ""}`
  }
  return `${scopeTitle}${label}`
}

function buildSecondaryMessage(card?: CRMSyncScopeCard | null): string {
  const run = card?.latest_run
  const description = (card?.description || "").trim()
  if (description) return description
  if ((card?.last_synced_at || "").trim()) {
    return `最近更新于 ${formatDateTime(card?.last_synced_at)}`
  }
  if (run?.planned_total) {
    return `计划同步 ${run.planned_total} 项`
  }
  return "完成首次同步后，这里会展示最近更新时间和异常项。"
}

function renderStatusIcon(status?: string, className?: string) {
  switch ((status || "").trim()) {
    case "running":
    case "cancelling":
      return <RefreshCw className={`h-4 w-4 animate-spin ${className || ""}`.trim()} />
    case "partial_failed":
    case "failed":
    case "canceled":
      return <AlertTriangle className={`h-4 w-4 ${className || ""}`.trim()} />
    case "completed":
      return <CheckCircle2 className={`h-4 w-4 ${className || ""}`.trim()} />
    default:
      return <RefreshCw className={`h-4 w-4 ${className || ""}`.trim()} />
  }
}

export function CRMSyncStatusBanner({
  scopeTitle,
  card,
}: {
  scope?: CRMSyncScope
  scopeTitle: string
  card?: CRMSyncScopeCard | null
}) {
  const tone = useMemo(() => bannerTone(card?.status), [card?.status])
  const percent = progressPercent(card)
  const running = ["running", "cancelling"].includes((card?.status || "").trim())
  const finishedCount =
    Number(card?.latest_run?.succeeded_total || 0) +
    Number(card?.latest_run?.failed_total || 0) +
    Number(card?.latest_run?.skipped_total || 0)
  const planned = Number(card?.latest_run?.planned_total || 0)

  return (
    <div className={`border-b p-3 px-4 ${tone.wrapper}`}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 xl:flex-row xl:items-center">
          <div className={`flex items-center gap-2 text-sm font-medium ${tone.text}`}>
            {renderStatusIcon(card?.status, tone.icon)}
            <span>{buildPrimaryMessage(scopeTitle, card)}</span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 xl:flex-row xl:items-center">
            <div className={`h-1.5 w-full max-w-56 overflow-hidden rounded-full ${tone.progressBg}`}>
              <div className={`h-full rounded-full transition-all ${tone.progressFill}`} style={{ width: `${percent}%` }} />
            </div>
            <div className={`min-w-0 text-xs ${tone.subText}`}>
              {running && planned > 0 ? `已处理 ${finishedCount} / ${planned} 项` : buildSecondaryMessage(card)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
