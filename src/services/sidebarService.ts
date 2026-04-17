import { requestJSON } from "./http"

type APIReply<T> = {
  code?: number
  message?: string
  data?: T
}

export type ContactSidebarContext = {
  mode?: "single" | "group" | string
  contact?: {
    external_userid?: string
    name?: string
    avatar?: string
    owner_userid?: string
    tags_json?: string
  }
  group_chat?: {
    chat_id?: string
    name?: string
    owner_userid?: string
    member_count?: number
    updated_at?: string
  }
  tasks?: Array<{
    id?: string
    title?: string
    description?: string
    due_at?: string
    priority?: string
    status?: string
  }>
  capability_hints?: Record<string, boolean>
  suggestions?: Array<{ id?: string; text?: string }>
  sop_items?: Array<{ id?: string; title?: string }>
  materials?: Array<{ id?: string; title?: string; subtitle?: string }>
  risk_alert?: { risk_id?: string; level?: string; summary?: string } | null
  active_members?: Array<{ member_id?: string; name?: string; avatar?: string; speak_count?: number }>
  warnings?: string[]
}

export type SidebarCommandResult = {
  success?: boolean
  stubbed?: boolean
  status?: string
  message?: string
}

export async function getContactSidebarContext(params: {
  mode?: string
  entry?: string
  external_userid?: string
  chat_id?: string
}): Promise<ContactSidebarContext | null> {
  const search = new URLSearchParams()
  if (params.mode) search.set("mode", params.mode)
  if (params.entry) search.set("entry", params.entry)
  if (params.external_userid) search.set("external_userid", params.external_userid)
  if (params.chat_id) search.set("chat_id", params.chat_id)
  const payload = await requestJSON<APIReply<ContactSidebarContext>>(`/api/v1/sidebar/contact/context?${search.toString()}`)
  return payload?.data || null
}

export async function executeContactSidebarCommand(input: {
  command: string
  external_userid?: string
  chat_id?: string
  payload?: Record<string, unknown>
}): Promise<SidebarCommandResult | null> {
  const payload = await requestJSON<APIReply<SidebarCommandResult>>("/api/v1/sidebar/contact/commands", {
    method: "POST",
    body: JSON.stringify({
      command: input.command,
      external_userid: input.external_userid || "",
      chat_id: input.chat_id || "",
      payload_json: JSON.stringify(input.payload || {}),
    }),
  })
  return payload?.data || null
}
