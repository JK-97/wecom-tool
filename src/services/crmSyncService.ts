import { requestJSON } from "./http"

type APIReply<T> = {
  code?: number
  message?: string
  data?: T
}

export type CRMSyncScope = "all" | "contacts" | "group_chats"

export type CRMSyncIssue = {
  issue_id?: string
  run_id?: string
  scope?: string
  subject_key?: string
  subject_name?: string
  error_code?: string
  error_message?: string
  retryable?: boolean
  occurred_at?: string
  resolved_at?: string
}

export type CRMSyncRunSummary = {
  run_id?: string
  scope?: string
  trigger_source?: string
  status?: string
  requested_by?: string
  requested_at?: string
  started_at?: string
  finished_at?: string
  planned_total?: number
  succeeded_total?: number
  failed_total?: number
  skipped_total?: number
  last_error_summary?: string
  open_issues?: CRMSyncIssue[]
}

export type CRMSyncScopeCard = {
  scope?: string
  title?: string
  status?: string
  status_label?: string
  description?: string
  last_synced_at?: string
  active_run_id?: string
  can_manage?: boolean
  can_start?: boolean
  can_retry?: boolean
  can_cancel?: boolean
  open_issue_count?: number
  active_job_count?: number
  latest_run?: CRMSyncRunSummary
}

export type CRMSyncOverview = {
  contacts?: CRMSyncScopeCard
  group_chats?: CRMSyncScopeCard
}

export type CRMSyncActionResult = {
  success?: boolean
  run_id?: string
  status?: string
  message?: string
  affected_count?: number
}

export type CRMSyncOverviewStreamEnvelope = {
  code?: number
  message?: string
  version?: number
  data?: CRMSyncOverview | null
}

export async function getCRMSyncOverview(): Promise<CRMSyncOverview | null> {
  const payload = await requestJSON<APIReply<CRMSyncOverview>>("/api/v1/main/crm-sync/overview")
  return payload?.data || null
}

export async function startCRMSyncRun(scope: CRMSyncScope): Promise<CRMSyncActionResult | null> {
  const payload = await requestJSON<APIReply<CRMSyncActionResult>>("/api/v1/main/crm-sync/start", {
    method: "POST",
    body: JSON.stringify({ scope }),
  })
  return payload?.data || null
}

export async function cancelCRMSyncRun(runID: string): Promise<CRMSyncActionResult | null> {
  const payload = await requestJSON<APIReply<CRMSyncActionResult>>("/api/v1/main/crm-sync/cancel", {
    method: "POST",
    body: JSON.stringify({ run_id: runID }),
  })
  return payload?.data || null
}

export async function retryCRMSyncIssues(input: {
  scope?: CRMSyncScope
  run_id?: string
  issue_ids?: string[]
}): Promise<CRMSyncActionResult | null> {
  const payload = await requestJSON<APIReply<CRMSyncActionResult>>("/api/v1/main/crm-sync/retry-issues", {
    method: "POST",
    body: JSON.stringify({
      scope: input.scope || "all",
      run_id: input.run_id || "",
      issue_ids: input.issue_ids || [],
    }),
  })
  return payload?.data || null
}

export async function listCRMSyncRuns(params?: {
  scope?: CRMSyncScope
  limit?: number
}): Promise<CRMSyncRunSummary[]> {
  const search = new URLSearchParams()
  if (params?.scope) search.set("scope", params.scope)
  if (params?.limit && params.limit > 0) search.set("limit", String(params.limit))
  const suffix = search.toString()
  const payload = await requestJSON<APIReply<{ runs?: CRMSyncRunSummary[] }>>(`/api/v1/main/crm-sync/runs${suffix ? `?${suffix}` : ""}`)
  return payload?.data?.runs || []
}

export function openCRMSyncOverviewStream(input: {
  onMessage: (payload: CRMSyncOverviewStreamEnvelope) => void
  onError?: (event: Event) => void
  onOpen?: () => void
}): EventSource {
  const base =
    (import.meta.env.VITE_API_BASE_URL || "").trim() ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost")
  const url = new URL("/api/v1/main/crm-sync/stream", base)
  const stream = new EventSource(url.toString(), { withCredentials: true })
  stream.addEventListener("crm_sync_overview", (event) => {
    try {
      const payload = JSON.parse(String((event as MessageEvent).data || "")) as CRMSyncOverviewStreamEnvelope
      input.onMessage(payload)
    } catch {
      // Ignore malformed payloads and keep the stream alive.
    }
  })
  if (input.onOpen) {
    stream.onopen = input.onOpen
  }
  if (input.onError) {
    stream.onerror = input.onError
  }
  return stream
}
