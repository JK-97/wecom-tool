import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, CheckCircle2, Clock3, CloudDownload, Loader2, RefreshCw, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { usePageFeedback } from "@/components/ui/PageFeedback"
import { APIRequestError, normalizeErrorMessage } from "@/services/http"
import {
  controlCustomerContactSync,
  getCustomerContactSyncStatus,
  retryCustomerContactSync,
  triggerCustomerContactSync,
  type CustomerContactSyncDomain,
  type CustomerContactSyncStatus,
  type CustomerContactSyncTask,
} from "@/services/customerContactSyncService"
import { cn } from "@/lib/utils"

type SyncPanelDomain = CustomerContactSyncDomain

const syncDomainMeta: Record<SyncPanelDomain, {
  label: string
  detailTitle: string
  emptyTitle: string
  activeTitle: string
  successTitle: string
  warningTitle: string
  manualLabel: string
  retryLabel: string
}> = {
  all: {
    label: "客户联系",
    detailTitle: "客户联系同步",
    emptyTitle: "等待客户联系同步",
    activeTitle: "客户联系数据正在同步",
    successTitle: "客户联系数据最近已同步",
    warningTitle: "客户联系同步需要处理",
    manualLabel: "同步客户联系",
    retryLabel: "重试失败任务",
  },
  customer: {
    label: "客户",
    detailTitle: "客户同步",
    emptyTitle: "等待客户同步",
    activeTitle: "客户数据正在同步",
    successTitle: "客户数据最近已同步",
    warningTitle: "客户同步需要处理",
    manualLabel: "同步客户",
    retryLabel: "重试客户任务",
  },
  group_chat: {
    label: "客户群",
    detailTitle: "客户群同步",
    emptyTitle: "等待客户群同步",
    activeTitle: "客户群数据正在同步",
    successTitle: "客户群数据最近已同步",
    warningTitle: "客户群同步需要处理",
    manualLabel: "同步客户群",
    retryLabel: "重试客户群任务",
  },
}

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
  if (value.endsWith("customer_full_sync")) return "客户全量"
  if (value.endsWith("group_chat_full_sync")) return "客户群全量"
  if (value.endsWith("full_sync")) return "客户联系全量"
  if (value.endsWith("contact_owner_batch_sync")) return "客户同步"
  if (value.endsWith("contact_detail_sync")) return "客户详情同步"
  if (value.endsWith("group_owner_batch_sync")) return "客户群同步"
  if (value.endsWith("group_detail_sync")) return "客户群详情"
  return value || "同步任务"
}

function taskTargetValue(task?: CustomerContactSyncTask | null): string {
  const explicit = (task?.target_id || "").trim()
  if (explicit) return explicit
  const key = (task?.task_key || "").trim()
  if (!key) return ""
  const parts = key.split(":").map((part) => part.trim()).filter(Boolean)
  if (parts.length < 3) return ""
  const runID = (task?.sync_run_id || "").trim()
  if (runID) {
    const runIndex = parts.indexOf(runID)
    if (runIndex >= 0 && parts.length > runIndex + 1) {
      return parts[runIndex + 1]
    }
  }
  return parts[2] || ""
}

function taskTargetLabel(task?: CustomerContactSyncTask | null): string {
  const explicitName = (task?.target_name || "").trim()
  if (explicitName) {
    const targetType = (task?.target_type || "").trim()
    if (targetType === "user") return `成员：${explicitName}`
    if (targetType === "customer") return `客户：${explicitName}`
    if (targetType === "group_chat") return `群聊：${explicitName}`
    return explicitName
  }
  const type = (task?.task_type || "").trim()
  const target = taskTargetValue(task)
  if (type.endsWith("contact_owner_batch_sync")) {
    const users = target.split(",").map((item) => item.trim()).filter(Boolean)
    if (users.length === 1) return `成员：${users[0]}`
    if (users.length > 1) return `成员：${users.slice(0, 3).join("、")}${users.length > 3 ? ` 等 ${users.length} 人` : ""}`
    return "成员同步"
  }
  if (type.endsWith("group_detail_sync")) {
    return target ? `群聊：${target}` : "群聊详情"
  }
  if (type.endsWith("group_owner_batch_sync")) {
    return target ? `群主/成员：${target}` : "客户群发现"
  }
  if (type.endsWith("customer_full_sync")) return "客户全量规划"
  if (type.endsWith("group_chat_full_sync")) return "客户群全量规划"
  if (type.endsWith("full_sync")) return "客户联系全量规划"
  return taskTypeLabel(type)
}

function taskDetailTitle(task?: CustomerContactSyncTask | null): string {
  return (task?.target_name || "").trim() || taskTargetLabel(task)
}

function taskDetailSubtitle(task?: CustomerContactSyncTask | null): string {
  return (task?.title || "").trim() || taskTypeLabel(task?.task_type)
}

function inferSyncDomain(task?: CustomerContactSyncTask | null): SyncPanelDomain {
  const explicit = (task?.sync_domain || "").trim()
  if (explicit === "customer" || explicit === "group_chat" || explicit === "all") return explicit
  const type = (task?.task_type || "").trim()
  if (type.endsWith("contact_owner_batch_sync") || type.endsWith("contact_detail_sync") || type.endsWith("customer_full_sync")) return "customer"
  if (type.endsWith("group_owner_batch_sync") || type.endsWith("group_detail_sync") || type.endsWith("group_chat_full_sync")) {
    return "group_chat"
  }
  return "all"
}

function taskStatusLabel(status?: string): string {
  switch ((status || "").trim()) {
    case "planned":
      return "计划中"
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
    case "paused":
      return "已暂停"
    case "canceled":
      return "已取消"
    default:
      return (status || "").trim() || "未知"
  }
}

function isFailedTask(task?: CustomerContactSyncTask | null): boolean {
  return ["retryable", "dead", "failed", "stalled"].includes((task?.status || "").trim())
}

function latestTask(tasks?: CustomerContactSyncTask[], syncDomain: SyncPanelDomain = "all"): CustomerContactSyncTask | null {
  const rows = filterTasksByDomain(tasks, syncDomain)
  if (rows.length === 0) return null
  return rows[0]
}

function filterTasksByDomain(tasks?: CustomerContactSyncTask[], syncDomain: SyncPanelDomain = "all"): CustomerContactSyncTask[] {
  const rows = tasks || []
  if (syncDomain === "all") return rows
  return rows.filter((task) => inferSyncDomain(task) === syncDomain)
}

function countsForDomain(status?: CustomerContactSyncStatus | null, syncDomain: SyncPanelDomain = "all"): Record<string, number> | undefined {
  if (syncDomain === "customer") return status?.customer_status_counts || {}
  if (syncDomain === "group_chat") return status?.group_chat_status_counts || {}
  return status?.status_counts || {}
}

function activeSyncCount(status?: CustomerContactSyncStatus | null, syncDomain: SyncPanelDomain = "all"): number {
  return readCount(countsForDomain(status, syncDomain), "planned", "pending", "queued", "processing", "running")
}

function pausedSyncCount(status?: CustomerContactSyncStatus | null, syncDomain: SyncPanelDomain = "all"): number {
  return readCount(countsForDomain(status, syncDomain), "paused")
}

function runForDomain(status?: CustomerContactSyncStatus | null, syncDomain: SyncPanelDomain = "all") {
  if (syncDomain === "customer") return status?.customer_run || null
  if (syncDomain === "group_chat") return status?.group_chat_run || null
  return status?.customer_run || status?.group_chat_run || null
}

function runTotalCount(run: ReturnType<typeof runForDomain>, counts?: Record<string, number>): number {
  const explicit = Number(run?.total_count || 0)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  if (!counts) return 0
  return Object.values(counts).reduce((sum, value) => {
    const numeric = Number(value || 0)
    return sum + (Number.isFinite(numeric) ? numeric : 0)
  }, 0)
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
  syncDomain = "all",
  refreshKey,
  onRetryDone,
  onRefreshData,
}: {
  className?: string
  compact?: boolean
  syncDomain?: SyncPanelDomain
  refreshKey?: number | string
  onRetryDone?: () => void | Promise<void>
  onRefreshData?: () => void | Promise<void>
}) {
  const { showFeedback } = usePageFeedback()
  const didMountRef = useRef(false)
  const meta = syncDomainMeta[syncDomain]
  const [status, setStatus] = useState<CustomerContactSyncStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isTriggering, setIsTriggering] = useState(false)
  const [controlAction, setControlAction] = useState<"pause" | "resume" | "cancel" | null>(null)
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
    const counts = countsForDomain(status, syncDomain)
    const pending = readCount(counts, "planned", "pending", "queued")
    const processing = readCount(counts, "processing", "running")
    const paused = readCount(counts, "paused")
    const retryable = readCount(counts, "retryable")
    const dead = readCount(counts, "dead", "failed")
    const stalled = readCount(counts, "stalled")
    const succeeded = readCount(counts, "succeeded", "success")
    const failed = retryable + dead + stalled
    const task = latestTask(status?.sync_details, syncDomain)
    if (failed > 0) {
      return {
        tone: "warning" as const,
        icon: AlertCircle,
        title: meta.warningTitle,
        description: `异常 ${failed} 个，其中超时 ${stalled} 个；请查看同步详情。`,
      }
    }
    if (processing + pending > 0) {
      return {
        tone: "info" as const,
        icon: Loader2,
        title: meta.activeTitle,
        description: `同步中 ${processing} 个，排队中 ${pending} 个；列表会先展示已同步的数据。`,
      }
    }
    if (paused > 0) {
      return {
        tone: "muted" as const,
        icon: Clock3,
        title: `${meta.label}同步已暂停`,
        description: `已暂停 ${paused} 个任务，可恢复后继续执行。`,
      }
    }
    if (succeeded > 0) {
      return {
        tone: "success" as const,
        icon: CheckCircle2,
        title: meta.successTitle,
        description: task?.updated_at ? `最近更新：${formatDateTime(task.updated_at)}` : `${meta.label}数据已从企业微信同步到平台。`,
      }
    }
    return {
      tone: "muted" as const,
      icon: Clock3,
      title: meta.emptyTitle,
      description: `${meta.label}数据尚未产生同步记录。`,
    }
  }, [meta, status, syncDomain])

  const scopedCounts = countsForDomain(status, syncDomain)
  const scopedTasks = filterTasksByDomain(status?.sync_details, syncDomain)
  const failedTasks = scopedTasks.filter(isFailedTask)
  const failedCount = readCount(scopedCounts, "retryable", "dead", "failed", "stalled")
  const activeCount = activeSyncCount(status, syncDomain)
  const pausedCount = pausedSyncCount(status, syncDomain)
  const hasActiveSync = activeCount > 0
  const hasPausedSync = pausedCount > 0
  const canRetry = Boolean(status?.can_retry) && failedCount > 0
  const Icon = summary.icon
  const pendingCount = readCount(scopedCounts, "planned", "pending", "queued")
  const processingCount = readCount(scopedCounts, "processing", "running")
  const succeededCount = readCount(scopedCounts, "succeeded", "success")
  const stalledCount = readCount(scopedCounts, "stalled")
  const canceledCount = readCount(scopedCounts, "canceled")
  const currentRun = runForDomain(status, syncDomain)
  const totalCount = runTotalCount(currentRun, scopedCounts)
  const terminalCount = succeededCount + failedCount + canceledCount
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round((terminalCount / totalCount) * 100)) : 0

  useEffect(() => {
    if (isForbidden || !hasActiveSync) return
    let cancelled = false
    let refreshedAfterSettled = false
    const timer = window.setInterval(() => {
      void (async () => {
        const nextStatus = await reload({ silent: true })
        if (cancelled || activeSyncCount(nextStatus, syncDomain) > 0 || refreshedAfterSettled) return
        refreshedAfterSettled = true
        await onRefreshData?.()
      })()
    }, 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [hasActiveSync, isForbidden, onRefreshData, reload, syncDomain])

  const handleRetry = async () => {
    try {
      setIsRetrying(true)
      const result = await retryCustomerContactSync(undefined, syncDomain)
      showFeedback({
        kind: result?.success === false ? "info" : "success",
        message: (result?.message || `已提交${meta.label}同步重试`).trim(),
      })
      const nextStatus = await reload()
      if (activeSyncCount(nextStatus, syncDomain) === 0) {
        await onRetryDone?.()
      }
    } catch (error) {
      showFeedback({ kind: "error", message: normalizeErrorMessage(error) })
    } finally {
      setIsRetrying(false)
    }
  }

  const handleTriggerSync = async () => {
    try {
      setIsTriggering(true)
      const result = await triggerCustomerContactSync(syncDomain)
      showFeedback({
        kind: result?.success === false ? "info" : "success",
        message: (result?.message || `已提交${meta.label}同步任务`).trim(),
      })
      await reload()
    } catch (error) {
      showFeedback({ kind: "error", message: normalizeErrorMessage(error) })
    } finally {
      setIsTriggering(false)
    }
  }

  const handleControl = async (action: "pause" | "resume" | "cancel") => {
    try {
      setControlAction(action)
      const result = await controlCustomerContactSync(syncDomain, action)
      showFeedback({
        kind: result?.success === false ? "info" : "success",
        message: (result?.message || "同步状态已更新").trim(),
      })
      await reload()
      if (action === "cancel") {
        await onRefreshData?.()
      }
    } catch (error) {
      showFeedback({ kind: "error", message: normalizeErrorMessage(error) })
    } finally {
      setControlAction(null)
    }
  }

  const handleRefresh = async () => {
    await onRefreshData?.()
    const nextStatus = await reload()
    if (activeSyncCount(nextStatus, syncDomain) > 0) {
      showFeedback({ kind: "info", message: `${meta.label}数据同步完成后会自动刷新当前列表。` })
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
          <span>{meta.detailTitle}</span>
          {failedCount > 0 ? <span className="font-semibold">异常 {failedCount}</span> : null}
          {failedCount === 0 && hasActiveSync ? <span className="font-semibold">同步中 {activeCount}</span> : null}
        </Button>
        <Dialog
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={meta.detailTitle}
          className="max-w-2xl"
          footer={
            <>
              <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                关闭
              </Button>
              <Button variant="outline" onClick={handleRefresh} disabled={isLoading || isRetrying || isTriggering || Boolean(controlAction)}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                刷新数据
              </Button>
              {hasActiveSync ? (
                <Button variant="outline" onClick={() => void handleControl("pause")} disabled={Boolean(controlAction)}>
                  {controlAction === "pause" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  暂停
                </Button>
              ) : null}
              {hasPausedSync ? (
                <Button variant="outline" onClick={() => void handleControl("resume")} disabled={Boolean(controlAction)}>
                  {controlAction === "resume" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  恢复
                </Button>
              ) : null}
              {hasActiveSync || hasPausedSync ? (
                <Button variant="outline" onClick={() => void handleControl("cancel")} disabled={Boolean(controlAction)}>
                  {controlAction === "cancel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  取消
                </Button>
              ) : null}
              <Button onClick={handleTriggerSync} disabled={isTriggering || isLoading || isRetrying || Boolean(controlAction)}>
                {isTriggering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudDownload className="mr-2 h-4 w-4" />}
                {meta.manualLabel}
              </Button>
              {canRetry ? (
                <Button variant="outline" onClick={handleRetry} disabled={isRetrying || isLoading || isTriggering || Boolean(controlAction)}>
                  {isRetrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  {meta.retryLabel}
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
                      {currentRun?.started_at ? (
                        <div className="mt-1 text-xs text-gray-500">全量同步开始时间：{formatDateTime(currentRun.started_at)}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
                {totalCount > 0 ? (
                  <div className="rounded-lg border border-gray-100 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                      <span>处理进度</span>
                      <span>
                        {terminalCount}/{totalCount}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                  {[
                    ["同步中", processingCount],
                    ["排队中", pendingCount],
                    ["已暂停", pausedCount],
                    ["异常", failedCount],
                    ["已完成", succeededCount],
                    ["已取消", canceledCount],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border border-gray-100 bg-white p-3">
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">{Number(value || 0)}</div>
                    </div>
                  ))}
                </div>
                {failedTasks.length > 0 ? (
                  <div>
                    <div className="mb-2 text-sm font-semibold text-gray-900">失败列表</div>
                    <div className="max-h-40 overflow-auto rounded-lg border border-orange-100 bg-orange-50/40">
                      <div className="divide-y divide-orange-100">
                        {failedTasks.map((task) => (
                          <div key={`failed-${task.id || task.task_key}`} className="p-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate font-medium text-gray-900">{taskDetailTitle(task)}</div>
                                <div className="mt-1 text-xs text-gray-500">{taskDetailSubtitle(task)}</div>
                              </div>
                              <Badge variant="warning" className="shrink-0 px-2 py-0 text-[10px]">
                                {taskStatusLabel(task.status)}
                              </Badge>
                            </div>
                            <div className="mt-2 text-xs leading-5 text-orange-700">失败原因：{task.last_error || "未返回具体原因"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-gray-900">同步详情</div>
                    <div className="text-xs text-gray-500">
                      当前展示 {scopedTasks.length} 条{totalCount > scopedTasks.length ? ` / 共 ${totalCount} 条` : ""}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-auto rounded-lg border border-gray-100">
                    {scopedTasks.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500">暂无同步详情。</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {scopedTasks.map((task) => (
                          <div key={task.id || task.task_key} className="flex items-start justify-between gap-4 p-3 text-sm">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-gray-900">{taskDetailTitle(task)}</div>
                              <div className="mt-1 text-xs text-gray-500">{taskDetailSubtitle(task)}</div>
                              {task.last_error ? <div className="mt-1 text-xs leading-5 text-orange-700">失败原因：{task.last_error}</div> : null}
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
            <div className="text-sm font-semibold text-gray-900">{meta.detailTitle}</div>
            <div className="mt-1 text-xs text-gray-500">
              当前账号可查看自己权限范围内的数据；同步失败和重试由管理员或主管处理。
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading || isTriggering}>
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
          {hasActiveSync ? (
            <Button variant="outline" size="sm" onClick={() => void handleControl("pause")} disabled={Boolean(controlAction)}>
              {controlAction === "pause" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              暂停
            </Button>
          ) : null}
          {hasPausedSync ? (
            <Button variant="outline" size="sm" onClick={() => void handleControl("resume")} disabled={Boolean(controlAction)}>
              {controlAction === "resume" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              恢复
            </Button>
          ) : null}
          {hasActiveSync || hasPausedSync ? (
            <Button variant="outline" size="sm" onClick={() => void handleControl("cancel")} disabled={Boolean(controlAction)}>
              {controlAction === "cancel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              取消
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading || isRetrying || isTriggering || Boolean(controlAction)}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            刷新
          </Button>
          <Button size="sm" onClick={handleTriggerSync} disabled={isTriggering || isLoading || isRetrying || Boolean(controlAction)}>
            {isTriggering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudDownload className="mr-2 h-4 w-4" />}
            {meta.manualLabel}
          </Button>
          {canRetry ? (
            <Button variant="outline" size="sm" onClick={handleRetry} disabled={isRetrying || isLoading || isTriggering || Boolean(controlAction)}>
              {isRetrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              {meta.retryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
