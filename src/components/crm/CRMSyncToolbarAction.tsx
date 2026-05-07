import { useState } from "react"
import { Loader2, RefreshCw, RotateCcw, StopCircle } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { usePageFeedback } from "@/components/ui/PageFeedback"
import { cn } from "@/lib/utils"
import { normalizeErrorMessage } from "@/services/http"
import {
  cancelCRMSyncRun,
  retryCRMSyncIssues,
  startCRMSyncRun,
  type CRMSyncActionResult,
  type CRMSyncScope,
  type CRMSyncScopeCard,
} from "@/services/crmSyncService"

function syncButtonLabel(card?: CRMSyncScopeCard | null, startLabel?: string): string {
  if (card?.can_retry) return "重试失败项"
  if ((card?.latest_run?.run_id || "").trim()) return startLabel || "重新同步"
  return startLabel || "开始同步"
}

async function resolveActionMessage(
  resultPromise: Promise<CRMSyncActionResult | null>,
  fallbackMessage: string,
  onUpdated?: (() => void) | undefined,
) {
  const result = await resultPromise
  onUpdated?.()
  return (result?.message || fallbackMessage).trim()
}

export function CRMSyncToolbarAction({
  scope,
  card,
  startLabel,
  onUpdated,
  onRefresh,
  refreshLabel = "刷新",
  isRefreshing = false,
}: {
  scope: CRMSyncScope
  card?: CRMSyncScopeCard | null
  startLabel: string
  onUpdated?: () => void
  onRefresh?: () => void
  refreshLabel?: string
  isRefreshing?: boolean
}) {
  const { showFeedback } = usePageFeedback()
  const [isPrimaryPending, setIsPrimaryPending] = useState(false)
  const [isCancelPending, setIsCancelPending] = useState(false)
  const status = (card?.status || "").trim()
  const isBusy = status === "running" || status === "cancelling"
  const canRetry = !!card?.can_retry && !isBusy
  const canStart = !!card?.can_start && !isBusy && !canRetry
  const canCancel = !!card?.can_cancel && !!(card?.active_run_id || "").trim()
  const primaryDisabled = isBusy || isPrimaryPending || isCancelPending || (!canRetry && !canStart)
  const refreshDisabled = isPrimaryPending || isCancelPending || isRefreshing
  const primaryTone = canRetry
    ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
    : "bg-blue-600 text-white hover:bg-blue-700"

  const handlePrimaryAction = async () => {
    try {
      setIsPrimaryPending(true)
      const message = canRetry
        ? await resolveActionMessage(
            retryCRMSyncIssues({
              scope,
              run_id: (card?.latest_run?.run_id || "").trim(),
            }),
            "已经重新安排失败项。",
            onUpdated,
          )
        : await resolveActionMessage(startCRMSyncRun(scope), "已经开始同步。", onUpdated)
      showFeedback({ kind: "success", message })
    } catch (error) {
      showFeedback({ kind: "error", message: normalizeErrorMessage(error) })
    } finally {
      setIsPrimaryPending(false)
    }
  }

  const handleCancelAction = async () => {
    const runID = (card?.active_run_id || card?.latest_run?.run_id || "").trim()
    if (!runID) return
    try {
      setIsCancelPending(true)
      const message = await resolveActionMessage(cancelCRMSyncRun(runID), "正在停止当前同步。", onUpdated)
      showFeedback({ kind: "success", message })
    } catch (error) {
      showFeedback({ kind: "error", message: normalizeErrorMessage(error) })
    } finally {
      setIsCancelPending(false)
    }
  }

  return (
    <div
      className="inline-flex shrink-0 flex-nowrap items-center gap-1 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm"
      aria-label="同步与刷新操作"
    >
      <Button
        onClick={() => void handlePrimaryAction()}
        disabled={primaryDisabled}
        className={cn("h-10 min-w-[118px] rounded-xl px-4 shadow-none", primaryTone)}
      >
        {isPrimaryPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : canRetry ? <RotateCcw className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        {syncButtonLabel(card, startLabel)}
      </Button>
      {canCancel ? (
        <Button
          variant="outline"
          onClick={() => void handleCancelAction()}
          disabled={isPrimaryPending || isCancelPending}
          className="h-10 rounded-xl border-gray-200 px-3 text-gray-700 hover:bg-gray-50"
        >
          {isCancelPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <StopCircle className="mr-2 h-4 w-4" />}
          {status === "cancelling" ? "停止中" : "取消"}
        </Button>
      ) : null}
      <div className="mx-1 hidden h-5 w-px bg-gray-200 md:block" />
      <Button
        variant="ghost"
        onClick={() => onRefresh?.()}
        disabled={refreshDisabled}
        className="h-10 rounded-xl px-3 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
      >
        {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
        {refreshLabel}
      </Button>
    </div>
  )
}
