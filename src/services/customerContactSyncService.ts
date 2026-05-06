import { requestJSON } from "./http"

type APIReply<T> = {
  code?: number
  message?: string
  data?: T
}

export type CustomerContactSyncTask = {
  id?: number
  corp_id?: string
  task_type?: string
  sync_domain?: CustomerContactSyncDomain | string
  sync_run_id?: string
  task_key?: string
  status?: string
  retry_count?: number
  next_run_at?: string
  lease_until?: string
  last_error?: string
  created_at?: string
  updated_at?: string
  title?: string
  target_type?: string
  target_id?: string
  target_name?: string
}

export type CustomerContactSyncRunSummary = {
  sync_run_id?: string
  started_at?: string
  total_count?: number
  pending_count?: number
  processing_count?: number
  paused_count?: number
  failed_count?: number
  succeeded_count?: number
  canceled_count?: number
}

export type CustomerContactSyncStatus = {
  status_counts?: Record<string, number>
  customer_status_counts?: Record<string, number>
  group_chat_status_counts?: Record<string, number>
  sync_details?: CustomerContactSyncTask[]
  customer_run?: CustomerContactSyncRunSummary | null
  group_chat_run?: CustomerContactSyncRunSummary | null
  can_retry?: boolean
}

export type CustomerContactSyncDomain = "all" | "customer" | "group_chat"

export type CustomerContactSyncCommandResult = {
  success?: boolean
  status?: string
  message?: string
  affected_count?: number
}

export async function getCustomerContactSyncStatus(): Promise<CustomerContactSyncStatus | null> {
  const payload = await requestJSON<APIReply<CustomerContactSyncStatus>>("/api/v1/main/customer-contact-sync/status")
  return payload?.data || null
}

export async function retryCustomerContactSync(
  taskID?: number,
  syncDomain: CustomerContactSyncDomain = "all",
): Promise<CustomerContactSyncCommandResult | null> {
  const body: { task_id?: number; sync_domain?: CustomerContactSyncDomain } = { sync_domain: syncDomain }
  if (typeof taskID === "number" && Number.isFinite(taskID) && taskID > 0) {
    body.task_id = taskID
  }
  const payload = await requestJSON<APIReply<CustomerContactSyncCommandResult>>("/api/v1/main/customer-contact-sync/retry", {
    method: "POST",
    body: JSON.stringify(body),
  })
  return payload?.data || null
}

export async function triggerCustomerContactSync(
  syncDomain: CustomerContactSyncDomain,
): Promise<CustomerContactSyncCommandResult | null> {
  const payload = await requestJSON<APIReply<CustomerContactSyncCommandResult>>("/api/v1/main/customer-contact-sync/trigger", {
    method: "POST",
    body: JSON.stringify({ sync_domain: syncDomain }),
  })
  return payload?.data || null
}

export async function controlCustomerContactSync(
  syncDomain: CustomerContactSyncDomain,
  action: "pause" | "resume" | "cancel",
): Promise<CustomerContactSyncCommandResult | null> {
  const payload = await requestJSON<APIReply<CustomerContactSyncCommandResult>>("/api/v1/main/customer-contact-sync/control", {
    method: "POST",
    body: JSON.stringify({ sync_domain: syncDomain, action }),
  })
  return payload?.data || null
}
