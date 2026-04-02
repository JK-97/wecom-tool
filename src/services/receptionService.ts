import { requestJSON } from "./http"

type APIReply<T> = {
  code?: number
  message?: string
  data?: T
}

export type ReceptionOverview = {
  total_channels?: number
  active_channels?: number
  abnormal_channels?: number
  pending_sync?: number
}

export type ReceptionChannel = {
  open_kfid?: string
  name?: string
  display_name?: string
  avatar_url?: string
  source?: string
  staff_count?: number
  default_rule?: string
  status?: string
  sync_status?: string
  last_interaction?: string
  lag_seconds?: number
  pending_tasks?: number
  failed_tasks?: number
  sync_mode?: string
  sync_reason?: string
  recovery_blocking?: boolean
}

export type ReceptionChannelDetail = {
  channel?: ReceptionChannel
  scenes?: Array<{ name?: string; scene_value?: string; url?: string }>
  warnings?: string[]
}

export async function getReceptionOverview(): Promise<ReceptionOverview | null> {
  const payload = await requestJSON<APIReply<ReceptionOverview>>("/api/v1/reception/overview")
  return payload?.data || null
}

export async function listReceptionChannels(params?: { query?: string; limit?: number }): Promise<ReceptionChannel[]> {
  const search = new URLSearchParams()
  if (params?.query) search.set("query", params.query)
  if (params?.limit && params.limit > 0) search.set("limit", String(params.limit))
  const payload = await requestJSON<APIReply<{ channels?: ReceptionChannel[] }>>(
    `/api/v1/reception/channels?${search.toString()}`,
  )
  return payload?.data?.channels || []
}

export async function createReceptionChannel(input: {
  open_kfid: string
  name?: string
  source?: string
  scene_value?: string
}): Promise<ReceptionChannel | null> {
  const payload = await requestJSON<APIReply<{ channel?: ReceptionChannel }>>("/api/v1/reception/channels", {
    method: "POST",
    body: JSON.stringify({
      open_kfid: input.open_kfid,
      name: input.name || "",
      source: input.source || "",
      scene_value: input.scene_value || "",
    }),
  })
  return payload?.data?.channel || null
}

export async function getReceptionChannelDetail(openKFID: string): Promise<ReceptionChannelDetail | null> {
  const payload = await requestJSON<APIReply<ReceptionChannelDetail>>(`/api/v1/reception/channels/${encodeURIComponent(openKFID)}`)
  return payload?.data || null
}

export async function triggerReceptionChannelSync(openKFID: string): Promise<boolean> {
  const payload = await requestJSON<APIReply<{ accepted?: boolean }>>(
    `/api/v1/reception/channels/${encodeURIComponent(openKFID)}/sync`,
    { method: "POST" },
  )
  return payload?.data?.accepted === true
}

export async function retryReceptionChannelSync(openKFID: string): Promise<number> {
  const payload = await requestJSON<APIReply<{ retried_count?: number }>>(
    `/api/v1/reception/channels/${encodeURIComponent(openKFID)}/sync/retry`,
    { method: "POST" },
  )
  return Number(payload?.data?.retried_count || 0)
}
