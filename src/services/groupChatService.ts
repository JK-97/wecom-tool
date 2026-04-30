import { requestJSON } from "./http"

type APIReply<T> = {
  code?: number
  message?: string
  data?: T
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
  raw_json?: string
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

export type ListGroupChatsData = {
  group_chats?: CustomerGroupChat[]
  next_cursor?: string
}

export type GetGroupChatData = {
  group_chat?: CustomerGroupChat
  members?: CustomerGroupChatMember[]
  admins?: CustomerGroupChatAdmin[]
}

type RawGroupChatMember = {
  userid?: string
  type?: number
  join_time?: number
  join_scene?: number
  unionid?: string
  name?: string
  group_nickname?: string
  invitor?: {
    userid?: string
    entity_type?: number
  }
}

type RawGroupChatAdmin = {
  userid?: string
}

export async function listGroupChats(params?: {
  cursor?: string
  limit?: number
}): Promise<ListGroupChatsData | null> {
  const search = new URLSearchParams()
  const limit = Number(params?.limit || 0)
  if (Number.isFinite(limit) && limit > 0) {
    search.set("limit", String(limit))
  }
  const cursor = (params?.cursor || "").trim()
  if (cursor) {
    search.set("cursor", cursor)
  }
  const suffix = search.toString()
  const payload = await requestJSON<APIReply<ListGroupChatsData>>(`/api/v1/crm/group-chats${suffix ? `?${suffix}` : ""}`)
  return payload?.data || null
}

export async function getGroupChat(chatID: string): Promise<GetGroupChatData | null> {
  const safeChatID = (chatID || "").trim()
  if (!safeChatID) {
    return null
  }
  const payload = await requestJSON<APIReply<GetGroupChatData>>(`/api/v1/crm/group-chats/${encodeURIComponent(safeChatID)}`)
  return payload?.data || null
}

export function buildGroupChatDetailFromListRow(group?: CustomerGroupChat | null): GetGroupChatData | null {
  if (!group) return null
  const rawText = (group.raw_json || "").trim()
  if (!rawText) {
    return { group_chat: group, members: [], admins: [] }
  }
  try {
    const raw = JSON.parse(rawText) as {
      member_list?: RawGroupChatMember[]
      admin_list?: Array<string | RawGroupChatAdmin>
    }
    const members = Array.isArray(raw.member_list)
      ? raw.member_list.map((member) => ({
          userid: (member.userid || "").trim(),
          type: Number(member.type || 0),
          join_time: Number(member.join_time || 0),
          join_scene: Number(member.join_scene || 0),
          unionid: (member.unionid || "").trim(),
          name: (member.name || "").trim(),
          group_nickname: (member.group_nickname || "").trim(),
          invitor_userid: (member.invitor?.userid || "").trim(),
          invitor_entity_type: Number(member.invitor?.entity_type || 0),
        }))
      : []
    const admins = Array.isArray(raw.admin_list)
      ? raw.admin_list
          .map((admin) => {
            if (typeof admin === "string") {
              return { userid: admin.trim() }
            }
            return { userid: (admin?.userid || "").trim() }
          })
          .filter((admin) => admin.userid !== "")
      : []
    return {
      group_chat: {
        ...group,
        admin_count: Number(group.admin_count || admins.length || 0),
        member_count: Number(group.member_count || members.length || 0),
      },
      members,
      admins,
    }
  } catch {
    return { group_chat: group, members: [], admins: [] }
  }
}
