import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, Clock3, Loader2, RefreshCw, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { usePageFeedback } from "@/components/ui/PageFeedback"
import { APIRequestError, normalizeErrorMessage } from "@/services/http"
import {
  getCustomerContactSyncStatus,
  retryCustomerContactSync,
  type CustomerContactSyncStatus,
  type CustomerContactSyncTask,
} from "@/services/customerContactSyncService"
import { cn } from "@/lib/utils"

function readCount(counts: Record<string, number> | undefined, ...keys: string[]): number {
  if (!counts) return 0
  return keys.reduce((sum, key) => {
    const value = Number(counts[key] || 0)
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)
}

function formatDateTime(value?: string): string {
  const text = (value || "").trim()
  if (!text) return "-"
  const parsed = Date.parse(text)
  if (Number.isNaN(parsed)) {
    return text
  }
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false })
}

function taskTypeLabel(type?: string): string {
  const value = (type || "").trim()
  if (value.endsWith("full_sync")) return "全量同步"
  if (value.endsWith("contact_owner_batch_sync")) return "客户同步"
  if (value.endsWith("group_owner_batch_sync")) return "客户群同步"
  if (value.endsWith("group_detail_sync")) return "客户群详情"
  return value || "同步任务"
}

function taskStatusLabel(status?: string): string {
  switch ((status || "").trim()) {
    case "pending":
      return "排队中"
    case "processing":
      return "同步中"
    case "retryable":
      return "可重试"
    case "dead":
      return "失败"
    case "succeeded":
      return "已完成"
    default:
      return (status || "").trim() || "未知"
  }
}

function latestTask(tasks?: CustomerContactSyncTask[]): CustomerContactSyncTask | null {
  const rows = tasks || []
  if (rows.length === 0) return null
  return rows[0]
}

export function CustomerContactSyncPanel({
  className,
  compact = false,
  onRetryDone,
  onRefreshData,
}: {
  className?: string
  compact?: boolean
  onRetryDone?: () => void | Promise<void>
  onRefreshData?: () => void | Promise<void>
}) {
  const { showFeedback } = usePageFeedback()
  const [status, setStatus] = useState<CustomerContactSyncStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isForbidden, setIsForbidden] = useState(false)

  const reload = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await getCustomerContactSyncStatus()
      setStatus(data)
      setIsForbidden(false)
    } catch (error) {
      if (error instanceof APIRequestError && error.status === 403) {
        setStatus(null)
        setIsForbidden(true)
        return
      }
      showFeedback({ kind: "error", message: normalizeErrorMessage(error) })
    } finally {
      setIsLoading(false)
    }
  }, [showFeedback])

  useEffect(() => {
    void reload()
  }, [reload])

  const summary = useMemo(() => {
    const counts = status?.status_counts
    const pending = readCount(counts, "pending", "queued")
    const processing = readCount(counts, "processing", "running")
    const retryable = readCount(counts, "retryable")
    const dead = readCount(counts, "dead", "failed")
    const succeeded = readCount(counts, "succeeded", "success")
    const failed = retryable + dead
    const task = latestTask(status?.recent_tasks)
    if (failed > 0) {
      return {
        tone: "warning" as const,
        icon: AlertCircle,
        title: "客户联系同步有失败任务",
        description: `失败 ${failed} 个，可重试 ${retryable} 个；最近任务：${taskTypeLabel(task?.task_type)} ${taskStatusLabel(task?.status)}`,
      }
    }
    if (processing + pending > 0) {
      return {
        tone: "info" as const,
        icon: Loader2,
        title: "客户联系数据正在同步",
        description: `同步中 ${processing} 个，排队中 ${pending} 个；页面会先展示本地已同步数据。`,
      }
    }
    if (succeeded > 0) {
      return {
        tone: "success" as const,
        icon: CheckCircle2,
        title: "客户联系数据最近已同步",
        description: task?.updated_at ? `最近更新：${formatDateTime(task.updated_at)}` : "数据来自企业微信客户联系同步结果。",
      }
    }
    return {
      tone: "muted" as const,
      icon: Clock3,
      title: "等待客户联系首次同步",
      description: "进入客户或客户群页面会触发后台同步；同步完成后列表会自动有真实数据可查。",
    }
  }, [status])

  const failedCount = readCount(status?.status_counts, "retryable", "dead", "failed")
  const canRetry = Boolean(status?.can_retry) && failedCount > 0
  const Icon = summary.icon

  const handleRetry = async () => {
    try {
      setIsRetrying(true)
      const result = await retryCustomerContactSync()
      showFeedback({
        kind: result?.success === false ? "info" : "success",
        message: (result?.message || "已提交客户联系同步重试").trim(),
      })
      await reload()
      await onRetryDone?.()
    } catch (error) {
      showFeedback({ kind: "error", message: normalizeErrorMessage(error) })
    } finally {
      setIsRetrying(false)
    }
  }

  const handleRefresh = async () => {
    await reload()
    await onRefreshData?.()
  }

  if (isForbidden) {
    return (
      <div className={cn("rounded-lg border border-gray-200 bg-white px-4 py-3", className)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">客户联系数据由后台同步</div>
            <div className="mt-1 text-xs text-gray-500">
              当前账号可查看自己权限范围内的数据；全量同步状态和失败重试由管理员或主管处理。
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            刷新
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        summary.tone === "warning" ? "border-orange-200 bg-orange-50/70" : "",
        summary.tone === "success" ? "border-green-100 bg-green-50/60" : "",
        summary.tone === "info" ? "border-blue-100 bg-blue-50/60" : "",
        summary.tone === "muted" ? "border-gray-200 bg-gray-50/70" : "",
        className,
      )}
    >
      <div className={cn("flex items-start justify-between gap-4", compact ? "gap-3" : "")}>
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              summary.tone === "warning" ? "bg-orange-100 text-orange-700" : "",
              summary.tone === "success" ? "bg-green-100 text-green-700" : "",
              summary.tone === "info" ? "bg-blue-100 text-blue-700" : "",
              summary.tone === "muted" ? "bg-gray-100 text-gray-500" : "",
            )}
          >
            <Icon className={cn("h-4 w-4", summary.tone === "info" && isLoading ? "animate-spin" : "")} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-gray-900">{summary.title}</div>
              {failedCount > 0 ? (
                <Badge variant="warning" className="px-2 py-0 text-[10px]">
                  失败 {failedCount}
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 text-xs leading-5 text-gray-600">{summary.description}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading || isRetrying}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            刷新
          </Button>
          {canRetry ? (
            <Button size="sm" onClick={handleRetry} disabled={isRetrying || isLoading}>
              {isRetrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              重试失败任务
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
