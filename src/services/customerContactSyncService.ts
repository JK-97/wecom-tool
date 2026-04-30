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
  task_key?: string
  status?: string
  retry_count?: number
  next_run_at?: string
  lease_until?: string
  last_error?: string
  created_at?: string
  updated_at?: string
}

export type CustomerContactSyncStatus = {
  status_counts?: Record<string, number>
  recent_tasks?: CustomerContactSyncTask[]
  can_retry?: boolean
}

export type RetryCustomerContactSyncResult = {
  success?: boolean
  status?: string
  message?: string
  affected_count?: number
}

export async function getCustomerContactSyncStatus(): Promise<CustomerContactSyncStatus | null> {
  const payload = await requestJSON<APIReply<CustomerContactSyncStatus>>("/api/v1/main/customer-contact-sync/status")
  return payload?.data || null
}

export async function retryCustomerContactSync(taskID?: number): Promise<RetryCustomerContactSyncResult | null> {
  const body: { task_id?: number } = {}
  if (typeof taskID === "number" && Number.isFinite(taskID) && taskID > 0) {
    body.task_id = taskID
  }
  const payload = await requestJSON<APIReply<RetryCustomerContactSyncResult>>("/api/v1/main/customer-contact-sync/retry", {
    method: "POST",
    body: JSON.stringify(body),
  })
  return payload?.data || null
}
