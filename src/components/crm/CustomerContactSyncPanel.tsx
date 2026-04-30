import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Clock3, Loader2, RefreshCw, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
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
    case "stalled":
      return "已超时"
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

function activeSyncCount(status?: CustomerContactSyncStatus | null): number {
  return readCount(status?.status_counts, "pending", "queued", "processing", "running")
}

function toneClasses(tone: "warning" | "success" | "info" | "muted") {
  if (tone === "warning") return "border-orange-200 bg-orange-50 text-orange-700"
  if (tone === "success") return "border-green-200 bg-green-50 text-green-700"
  if (tone === "info") return "border-blue-200 bg-blue-50 text-blue-700"
  return "border-gray-200 bg-white text-gray-600"
}

export function CustomerContactSyncPanel({
  className,
  compact = false,
  refreshKey,
  onRetryDone,
  onRefreshData,
}: {
  className?: string
  compact?: boolean
  refreshKey?: number | string
  onRetryDone?: () => void | Promise<void>
  onRefreshData?: () => void | Promise<void>
}) {
  const { showFeedback } = usePageFeedback()
  const didMountRef = useRef(false)
  const [status, setStatus] = useState<CustomerContactSyncStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isForbidden, setIsForbidden] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setIsLoading(true)
      }
      const data = await getCustomerContactSyncStatus()
      setStatus(data)
      setIsForbidden(false)
      return data
    } catch (error) {
      if (error instanceof APIRequestError && error.status === 403) {
        setStatus(null)
        setIsForbidden(true)
        return null
      }
      showFeedback({ kind: "error", message: normalizeErrorMessage(error) })
      return null
    } finally {
      if (!options?.silent) {
        setIsLoading(false)
      }
    }
  }, [showFeedback])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    void reload({ silent: true })
  }, [refreshKey, reload])

  const summary = useMemo(() => {
    const counts = status?.status_counts
    const pending = readCount(counts, "pending", "queued")
    const processing = readCount(counts, "processing", "running")
    const retryable = readCount(counts, "retryable")
    const dead = readCount(counts, "dead", "failed")
    const stalled = readCount(counts, "stalled")
    const succeeded = readCount(counts, "succeeded", "success")
    const failed = retryable + dead + stalled
    const task = latestTask(status?.recent_tasks)
    if (failed > 0) {
      return {
        tone: "warning" as const,
        icon: AlertCircle,
        title: "客户联系同步需要处理",
        description: `异常 ${failed} 个，其中超时 ${stalled} 个；最近任务：${taskTypeLabel(task?.task_type)} ${taskStatusLabel(task?.status)}`,
      }
    }
    if (processing + pending > 0) {
      return {
        tone: "info" as const,
        icon: Loader2,
        title: "客户联系数据正在同步",
        description: `同步中 ${processing} 个，排队中 ${pending} 个；列表会先展示已同步的数据。`,
      }
    }
    if (succeeded > 0) {
      return {
        tone: "success" as const,
        icon: CheckCircle2,
        title: "客户联系数据最近已同步",
        description: task?.updated_at ? `最近更新：${formatDateTime(task.updated_at)}` : "数据已从企业微信同步到平台。",
      }
    }
    return {
      tone: "muted" as const,
      icon: Clock3,
      title: "等待客户联系首次同步",
      description: "进入客户或群运营页面后会自动同步；完成后即可查看客户和客户群。",
    }
  }, [status])

  const failedCount = readCount(status?.status_counts, "retryable", "dead", "failed", "stalled")
  const activeCount = activeSyncCount(status)
  const hasActiveSync = activeCount > 0
  const canRetry = Boolean(status?.can_retry) && failedCount > 0
  const Icon = summary.icon
  const pendingCount = readCount(status?.status_counts, "pending", "queued")
  const processingCount = readCount(status?.status_counts, "processing", "running")
  const succeededCount = readCount(status?.status_counts, "succeeded", "success")
  const stalledCount = readCount(status?.status_counts, "stalled")

  useEffect(() => {
    if (isForbidden || !hasActiveSync) return
    let cancelled = false
    let refreshedAfterSettled = false
    const timer = window.setInterval(() => {
      void (async () => {
        const nextStatus = await reload({ silent: true })
        if (cancelled || activeSyncCount(nextStatus) > 0 || refreshedAfterSettled) return
        refreshedAfterSettled = true
        await onRefreshData?.()
      })()
    }, 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [hasActiveSync, isForbidden, onRefreshData, reload])

  const handleRetry = async () => {
    try {
      setIsRetrying(true)
      const result = await retryCustomerContactSync()
      showFeedback({
        kind: result?.success === false ? "info" : "success",
        message: (result?.message || "已提交客户联系同步重试").trim(),
      })
      const nextStatus = await reload()
      if (activeSyncCount(nextStatus) === 0) {
        await onRetryDone?.()
      }
    } catch (error) {
      showFeedback({ kind: "error", message: normalizeErrorMessage(error) })
    } finally {
      setIsRetrying(false)
    }
  }

  const handleRefresh = async () => {
    await onRefreshData?.()
    const nextStatus = await reload()
    if (activeSyncCount(nextStatus) > 0) {
      showFeedback({ kind: "info", message: "正在同步客户联系数据，完成后会自动刷新当前列表。" })
    }
  }

  if (compact) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("gap-2 border px-3", toneClasses(summary.tone), className)}
          onClick={() => setIsDetailOpen(true)}
          title={summary.description}
        >
          <Icon className={cn("h-4 w-4", summary.tone === "info" ? "animate-spin" : "")} />
          <span>同步详情</span>
          {failedCount > 0 ? <span className="font-semibold">异常 {failedCount}</span> : null}
          {failedCount === 0 && hasActiveSync ? <span className="font-semibold">同步中 {activeCount}</span> : null}
        </Button>
        <Dialog
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title="数据同步详情"
          className="max-w-2xl"
          footer={
            <>
              <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                关闭
              </Button>
              <Button variant="outline" onClick={handleRefresh} disabled={isLoading || isRetrying}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                刷新数据
              </Button>
              {canRetry ? (
                <Button onClick={handleRetry} disabled={isRetrying || isLoading}>
                  {isRetrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  重试失败任务
                </Button>
              ) : null}
            </>
          }
        >
          <div className="space-y-4">
            {isForbidden ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                当前账号可查看自己权限范围内的数据；同步失败和重试由管理员或主管处理。
              </div>
            ) : (
              <>
                <div className={cn("rounded-lg border p-4", toneClasses(summary.tone))}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <Icon className={cn("h-5 w-5", summary.tone === "info" ? "animate-spin" : "")} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900">{summary.title}</div>
                      <div className="mt-1 text-sm leading-6 text-gray-600">{summary.description}</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {[
                    ["同步中", processingCount],
                    ["排队中", pendingCount],
                    ["超时", stalledCount],
                    ["异常", failedCount],
                    ["已完成", succeededCount],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border border-gray-100 bg-white p-3">
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">{Number(value || 0)}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold text-gray-900">最近任务</div>
                  <div className="max-h-64 overflow-auto rounded-lg border border-gray-100">
                    {(status?.recent_tasks || []).length === 0 ? (
                      <div className="p-4 text-sm text-gray-500">暂无同步任务记录。</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {(status?.recent_tasks || []).slice(0, 12).map((task) => (
                          <div key={task.id || task.task_key} className="flex items-start justify-between gap-4 p-3 text-sm">
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900">{taskTypeLabel(task.task_type)}</div>
                              <div className="mt-1 truncate text-xs text-gray-500">{task.task_key || "-"}</div>
                              {task.last_error ? <div className="mt-1 text-xs text-orange-700">{task.last_error}</div> : null}
                            </div>
                            <div className="shrink-0 text-right">
                              <Badge variant="secondary" className="px-2 py-0 text-[10px]">
                                {taskStatusLabel(task.status)}
                              </Badge>
                              <div className="mt-1 text-xs text-gray-400">{formatDateTime(task.updated_at)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </Dialog>
      </>
    )
  }

  if (isForbidden) {
    return (
      <div className={cn("rounded-lg border border-gray-200 bg-white px-4 py-3", className)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">客户联系数据会自动同步</div>
            <div className="mt-1 text-xs text-gray-500">
              当前账号可查看自己权限范围内的数据；同步失败和重试由管理员或主管处理。
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
                  异常 {failedCount}
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
