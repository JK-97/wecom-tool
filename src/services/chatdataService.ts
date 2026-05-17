import { requestJSON } from "./http"

type APIReply<T> = {
  code?: number
  message?: string
  data?: T
}

export type ChatDataMessageSummary = {
  msg_id?: string
  chat_id?: string
  send_time?: number
  msg_type?: number
  sender_type?: number
  sender_id?: string
  receiver_list_json?: string
  raw_payload_json?: string
  encrypted_secret_key?: string
  public_key_ver?: number
  first_seen_at?: number
  last_seen_at?: number
}

export type ChatDataDisplayBootstrap = {
  msg_id?: string
  chat_id?: string
  send_time?: number
  msg_type?: number
  public_key_ver?: number
  secret_key?: string
  secret_key_base64?: string
  encrypted_secret_key?: string
  raw_payload_json?: string
  error?: string
}

export type ChatDataPanelView = {
  capability_status?: string
  sync_status?: string
  init_state?: string
  messages?: ChatDataMessageSummary[]
  next_cursor?: string
  open_data_required?: boolean
  open_data_hint?: string
  last_error?: string
  can_retry_init?: boolean
  cursor?: string
  has_cursor?: boolean
  has_messages?: boolean
  target_type?: string
  target_id?: string
  sync_mode?: string
  sync_reason?: string
  recovery_blocking?: boolean
  last_sync_time?: string
  display_bootstraps?: ChatDataDisplayBootstrap[]
}

export async function getChatDataPanel(params: {
  target_type: "external_userid" | "chat_id"
  target_id: string
}): Promise<ChatDataPanelView | null> {
  const search = new URLSearchParams()
  if (params.target_type === "external_userid") {
    search.set("external_userid", params.target_id)
    const payload = await requestJSON<APIReply<ChatDataPanelView>>(`/api/v1/main/customer-360/chatdata-panel?${search.toString()}`)
    return payload?.data || null
  }
  search.set("chat_id", params.target_id)
  const payload = await requestJSON<APIReply<ChatDataPanelView>>(`/api/v1/main/group-detail/chatdata-panel?${search.toString()}`)
  return payload?.data || null
}

export async function initChatDataBootstrap(params: {
  surface: "customer_360" | "group_detail"
  surface_id: string
  reason: string
  force?: boolean
}): Promise<ChatDataPanelView | null> {
  const payload = await requestJSON<APIReply<ChatDataPanelView>>("/api/v1/main/data-zone/chatdata/bootstrap/init", {
    method: "POST",
    body: JSON.stringify({
      surface: params.surface,
      surface_id: params.surface_id,
      reason: params.reason,
      force: Boolean(params.force),
    }),
  })
  return payload?.data || null
}
