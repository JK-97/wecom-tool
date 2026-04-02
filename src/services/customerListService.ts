import { requestJSON } from "./http"

type APIReply<T> = {
  code?: number
  message?: string
  data?: T
}

export type CustomerListFilterOption = {
  value?: string
  label?: string
  count?: number
}

export type CustomerListRow = {
  external_userid?: string
  name?: string
  avatar?: string
  mobile_masked?: string
  source_channel?: string
  stage?: string
  tags?: string[]
  last_interaction_at?: string
  last_interaction_label?: string
  owner_userid?: string
  owner_name?: string
  owner_avatar?: string
}

export type CustomerListViewModel = {
  summary?: {
    all_count?: number
    today_count?: number
    todo_count?: number
    upgraded_count?: number
  }
  stage_options?: CustomerListFilterOption[]
  tag_options?: CustomerListFilterOption[]
  owner_options?: CustomerListFilterOption[]
  rows?: CustomerListRow[]
  pagination?: {
    page?: number
    page_size?: number
    total?: number
    total_pages?: number
  }
  active_tab?: string
  active_filters?: {
    query?: string
    stage?: string
    tag?: string
    owner_userid?: string
  }
}

export type CustomerListCommandResult = {
  success?: boolean
  status?: string
  message?: string
  affected_count?: number
}

export async function getCustomerListView(params?: {
  tab?: string
  query?: string
  stage?: string
  tag?: string
  owner_userid?: string
  page?: number
  page_size?: number
}): Promise<CustomerListViewModel | null> {
  const search = new URLSearchParams()
  if (params?.tab) search.set("tab", params.tab)
  if (params?.query) search.set("query", params.query)
  if (params?.stage) search.set("stage", params.stage)
  if (params?.tag) search.set("tag", params.tag)
  if (params?.owner_userid) search.set("owner_userid", params.owner_userid)
  if (params?.page && params.page > 0) search.set("page", String(params.page))
  if (params?.page_size && params.page_size > 0) search.set("page_size", String(params.page_size))
  const payload = await requestJSON<APIReply<CustomerListViewModel>>(`/api/v1/main/customers/view?${search.toString()}`)
  return payload?.data || null
}

export async function executeCustomerListCommand(input: {
  command: string
  external_userid?: string
  external_userids?: string[]
  payload?: Record<string, unknown>
}): Promise<CustomerListCommandResult | null> {
  const payload = await requestJSON<APIReply<CustomerListCommandResult>>("/api/v1/main/customers/commands", {
    method: "POST",
    body: JSON.stringify({
      command: input.command,
      external_userid: input.external_userid || "",
      external_userids: input.external_userids || [],
      payload_json: JSON.stringify(input.payload || {}),
    }),
  })
  return payload?.data || null
}
