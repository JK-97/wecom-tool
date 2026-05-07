import { requestJSON } from "./http"

type APIReply<T> = {
  code?: number
  message?: string
  data?: T
}

export type Customer360TimelineItem = {
  id?: string
  category?: string
  title?: string
  description?: string
  occurred_at?: string
}

export type Customer360Task = {
  id?: string
  title?: string
  description?: string
  due_at?: string
  status?: string
  priority?: string
}

export type Customer360ViewModel = {
  contact?: {
    external_userid?: string
    name?: string
    avatar?: string
    owner_userid?: string
    tags_json?: string
    updated_at?: string
    last_synced_at?: string
  }
  tags?: string[]
  stage?: string
  owner_userid?: string
  source_channel?: string
  updated_at?: string
  last_synced_at?: string
  timeline?: Customer360TimelineItem[]
  tasks?: Customer360Task[]
  ai_summary?: string
}

export async function getCustomer360View(params: {
  external_userid: string
  timeline_tab?: string
}): Promise<Customer360ViewModel | null> {
  const search = new URLSearchParams()
  search.set("external_userid", params.external_userid)
  if (params.timeline_tab) search.set("timeline_tab", params.timeline_tab)
  const payload = await requestJSON<APIReply<Customer360ViewModel>>(`/api/v1/main/customer-360/view?${search.toString()}`)
  return payload?.data || null
}
