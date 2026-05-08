import { requestJSON } from "./http"

type APIReply<T> = {
  code?: number
  message?: string
  data?: T
}

export type GroupOperationSummary = {
  total_count?: number
  synced_count?: number
  healthy_count?: number
  attention_count?: number
  last_synced_at?: string
  headline?: string
  description?: string
}

export type GroupOperationRow = {
  chat_id?: string
  name?: string
  owner_userid?: string
  owner_name?: string
  member_count?: number
  admin_count?: number
  status_label?: string
  status_tone?: string
  needs_attention?: boolean
  last_synced_at?: string
  notice_preview?: string
  has_chatdata?: boolean
}

export type GroupOperationListPage = {
  summary?: GroupOperationSummary
  owner_options?: Array<{ value?: string; label?: string; count?: number }>
  rows?: GroupOperationRow[]
  pagination?: {
    page?: number
    page_size?: number
    total?: number
    total_pages?: number
  }
  active_filters?: {
    query?: string
    owner_userid?: string
    status?: string
    chatdata_sync?: string
  }
}

export type CustomerGroupChat = {
  chat_id?: string
  name?: string
  owner_userid?: string
  member_count?: number
  corp_id?: string
  updated_at?: string
  status?: number
  create_time?: number
  notice?: string
  admin_count?: number
  member_version?: string
  last_synced_at?: string
}

export type CustomerGroupChatMember = {
  userid?: string
  type?: number
  join_time?: number
  join_scene?: number
  unionid?: string
  name?: string
  group_nickname?: string
  invitor_userid?: string
  invitor_entity_type?: number
}

export type CustomerGroupChatAdmin = {
  userid?: string
}

export type GroupOperationDetail = {
  group_chat?: CustomerGroupChat
  sync_status?: {
    status?: string
    status_label?: string
    description?: string
    last_synced_at?: string
    latest_run_id?: string
    open_issue_count?: number
  }
  member_stat?: {
    total?: number
    internal_count?: number
    external_count?: number
    admin_count?: number
  }
  notices?: Array<{ title?: string; description?: string }>
  risk_signals?: Array<{ level?: string; title?: string; description?: string }>
  members?: CustomerGroupChatMember[]
  admins?: CustomerGroupChatAdmin[]
}

export async function getGroupOperationListPage(params?: {
  query?: string
  owner_userid?: string
  status?: string
  chatdata_sync?: string
  page?: number
  page_size?: number
}): Promise<GroupOperationListPage | null> {
  const search = new URLSearchParams()
  if (params?.query) search.set("query", params.query)
  if (params?.owner_userid) search.set("owner_userid", params.owner_userid)
  if (params?.status) search.set("status", params.status)
  if (params?.chatdata_sync) search.set("chatdata_sync", params.chatdata_sync)
  if (params?.page && params.page > 0) search.set("page", String(params.page))
  if (params?.page_size && params.page_size > 0) search.set("page_size", String(params.page_size))
  const suffix = search.toString()
  const payload = await requestJSON<APIReply<GroupOperationListPage>>(`/api/v1/main/group-ops/page${suffix ? `?${suffix}` : ""}`)
  return payload?.data || null
}

export async function getGroupOperationDetail(chatID: string): Promise<GroupOperationDetail | null> {
  const safeChatID = (chatID || "").trim()
  if (!safeChatID) {
    return null
  }
  const payload = await requestJSON<APIReply<GroupOperationDetail>>(`/api/v1/main/group-ops/${encodeURIComponent(safeChatID)}`)
  return payload?.data || null
}
