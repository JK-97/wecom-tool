import { requestJSON } from "./http"

type APIReply<T> = {
  code?: number
  message?: string
  data?: T
}

export type TaskFilterOption = {
  value?: string
  label?: string
  count?: number
}

export type TaskCard = {
  task_id?: string
  badge_label?: string
  badge_tone?: string
  due_label?: string
  due_at?: string
  title?: string
  description?: string
  owner_userid?: string
  owner_name?: string
  owner_avatar?: string
  status?: string
  priority?: string
  source_domain?: string
  target_type?: string
  target_id?: string
  target_name?: string
  last_activity_at?: string
  last_activity_note?: string
}

export type TaskCenterView = {
  scope?: string
  task_type?: string
  query?: string
  owner_userid?: string
  priority?: string
  source_domain?: string
  todo_count?: number
  in_progress_count?: number
  done_count?: number
  todo_tasks?: TaskCard[]
  in_progress_tasks?: TaskCard[]
  done_tasks?: TaskCard[]
  type_options?: TaskFilterOption[]
  owner_options?: TaskFilterOption[]
  priority_options?: TaskFilterOption[]
  source_options?: TaskFilterOption[]
}

export type TaskActivity = {
  id?: string
  task_id?: string
  activity_type?: string
  operator_userid?: string
  operator_name?: string
  content?: string
  payload_json?: string
  created_at?: string
  updated_at?: string
}

export type TaskDetailView = {
  task?: {
    id?: string
    title?: string
    description?: string
    status?: string
    priority?: string
    source_domain?: string
    owner_userid?: string
    due_at?: string
    target_type?: string
    target_id?: string
    target_name?: string
    created_at?: string
    updated_at?: string
    from_upgrade?: boolean
  }
  owner_name?: string
  owner_avatar?: string
  assigner_name?: string
  task_type_label?: string
  status_label?: string
  priority_label?: string
  related?: {
    target_type?: string
    target_id?: string
    name?: string
    subtitle?: string
    avatar?: string
    stage?: string
  }
  ai_suggestion?: string
  latest_summary?: string
  activities?: TaskActivity[]
  can_trigger_followup?: boolean
}

export type ExecuteTaskCommandResult = {
  success?: boolean
  stubbed?: boolean
  status?: string
  message?: string
  affected_count?: number
}

export async function getTaskCenterView(params?: {
  scope?: string
  task_type?: string
  query?: string
  owner_userid?: string
  priority?: string
  source_domain?: string
}): Promise<TaskCenterView | null> {
  const search = new URLSearchParams()
  if (params?.scope) search.set("scope", params.scope)
  if (params?.task_type) search.set("task_type", params.task_type)
  if (params?.query) search.set("query", params.query)
  if (params?.owner_userid) search.set("owner_userid", params.owner_userid)
  if (params?.priority) search.set("priority", params.priority)
  if (params?.source_domain) search.set("source_domain", params.source_domain)
  const payload = await requestJSON<APIReply<TaskCenterView>>(`/api/v1/main/task-center/view?${search.toString()}`)
  return payload?.data || null
}

export async function getTaskDetailView(taskID: string): Promise<TaskDetailView | null> {
  const payload = await requestJSON<APIReply<TaskDetailView>>(`/api/v1/main/task-center/tasks/${encodeURIComponent(taskID)}`)
  return payload?.data || null
}

export async function executeTaskCommand(input: {
  command: string
  task_id?: string
  payload?: Record<string, unknown>
}): Promise<ExecuteTaskCommandResult | null> {
  const payload = await requestJSON<APIReply<ExecuteTaskCommandResult>>("/api/v1/main/task-center/commands", {
    method: "POST",
    body: JSON.stringify({
      command: input.command,
      task_id: input.task_id || "",
      payload_json: JSON.stringify(input.payload || {}),
    }),
  })
  return payload?.data || null
}
