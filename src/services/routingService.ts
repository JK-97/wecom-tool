import { requestJSON } from "./http"

type APIReply<T> = {
  code?: number
  message?: string
  data?: T
}

export type RoutingRuleViewModel = {
  id: string
  name: string
  channel: string
  channelId: string
  scene: string
  mode: string
  target: RoutingTarget
  actionMode: string
  actionModeLabel: string
  dispatchStrategy: string
  dispatchStrategyLabel: string
  dispatchCapacityThreshold: number
  priority: number
  isDefault: boolean
  status: "active" | "inactive" | string
  lastHit: string
  hits: number
  transferRate: string
  responseTime: string
  conditionsJson: string
  actionJson: string
}

export type RoutingDistribution = {
  ruleName: string
  hits: number
  percent: string
}

export type RoutingChannelOption = {
  channelId: string
  label: string
  ruleCount: number
}

export type RoutingTarget = {
  key: string
  kind: string
  useFullPool: boolean
  userIds: string[]
  departmentIds: number[]
  userCount: number
  departmentCount: number
}

export type RoutingTargetOption = {
  value: string
  target: RoutingTarget
}

export type RoutingRulesViewModel = {
  rules: RoutingRuleViewModel[]
  totalHits: number
  transferRate: string
  avgResponseTime: string
  distributions: RoutingDistribution[]
  channelOptions: RoutingChannelOption[]
  modeOptions: string[]
  targetOptions: RoutingTargetOption[]
  diagnostics: {
    warnings: string[]
    items: Array<{
      code: string
      severity: string
      message: string
      channelId: string
      action: string
    }>
  }
}

export type RoutingCommandResult = {
  success?: boolean
  stubbed?: boolean
  status?: string
  message?: string
}

type RawRoutingRuleView = {
  id?: string
  name?: string
  channel?: string
  channel_id?: string
  scene?: string
  mode?: string
  target?: RawRoutingTarget
  action_mode?: string
  action_mode_label?: string
  dispatch_strategy?: string
  dispatch_strategy_label?: string
  dispatch_capacity_threshold?: number
  priority?: number
  is_default?: boolean
  status?: string
  last_hit?: string
  hits?: number
  transfer_rate?: string
  response_time?: string
  conditions_json?: string
  action_json?: string
}

type RawRoutingTarget = {
  key?: string
  kind?: string
  use_full_pool?: boolean
  user_ids?: string[]
  department_ids?: number[]
  user_count?: number
  department_count?: number
}

type RawRoutingDistribution = {
  rule_name?: string
  hits?: number
  percent?: string
}

type RawRoutingRulesViewData = {
  rules?: RawRoutingRuleView[]
  total_hits?: number
  transfer_rate?: string
  avg_response_time?: string
  distributions?: RawRoutingDistribution[]
  channel_options?: Array<{
    channel_id?: string
    label?: string
    rule_count?: number
  }>
  mode_options?: string[]
  target_options?: Array<{
    value?: string
    target?: RawRoutingTarget
  }>
  diagnostics?: {
    warnings?: string[]
    items?: Array<{
      code?: string
      severity?: string
      message?: string
      channel_id?: string
      action?: string
    }>
  }
}

export async function getRoutingRulesView(params?: {
  channel_filter?: string
  query?: string
  status_filter?: string
  rule_type_filter?: string
  mode_filter?: string
  target_filter?: string
  hit_bucket_filter?: string
  response_bucket_filter?: string
  diagnostics_only?: boolean
}): Promise<RoutingRulesViewModel> {
  const search = new URLSearchParams()
  if (params?.channel_filter) search.set("channel_filter", params.channel_filter)
  if (params?.query) search.set("query", params.query)
  if (params?.status_filter && params.status_filter !== "all") search.set("status_filter", params.status_filter)
  if (params?.rule_type_filter && params.rule_type_filter !== "all") search.set("rule_type_filter", params.rule_type_filter)
  if (params?.mode_filter && params.mode_filter !== "all") search.set("mode_filter", params.mode_filter)
  if (params?.target_filter && params.target_filter !== "all") search.set("target_filter", params.target_filter)
  if (params?.hit_bucket_filter && params.hit_bucket_filter !== "all") search.set("hit_bucket_filter", params.hit_bucket_filter)
  if (params?.response_bucket_filter && params.response_bucket_filter !== "all") {
    search.set("response_bucket_filter", params.response_bucket_filter)
  }
  if (params?.diagnostics_only) search.set("diagnostics_only", "true")
  const payload = await requestJSON<APIReply<RawRoutingRulesViewData>>(
    `/api/v1/main/routing-rules/view?${search.toString()}`,
  )
  const data = payload?.data || {}
  return {
    rules: (data.rules || []).map(mapRule),
    totalHits: Number(data.total_hits || 0),
    transferRate: String(data.transfer_rate || "0%"),
    avgResponseTime: String(data.avg_response_time || "0s"),
    distributions: (data.distributions || []).map((item) => ({
      ruleName: String(item.rule_name || "").trim(),
      hits: Number(item.hits || 0),
      percent: String(item.percent || "0%").trim(),
    })),
    channelOptions: (data.channel_options || [])
      .map((item) => ({
        channelId: String(item.channel_id || "").trim(),
        label: String(item.label || "").trim(),
        ruleCount: Number(item.rule_count || 0),
      }))
      .filter((item) => item.channelId.length > 0),
    modeOptions: (data.mode_options || []).map((item) => String(item || "").trim()).filter(Boolean),
    targetOptions: (data.target_options || [])
      .map((item) => ({
        value: String(item?.value || "").trim(),
        target: mapTarget(item?.target),
      }))
      .filter((item) => item.value.length > 0 && item.target.key.length > 0),
    diagnostics: {
      warnings: (data.diagnostics?.warnings || []).map((item) => String(item || "").trim()).filter(Boolean),
      items: (data.diagnostics?.items || [])
        .map((item) => ({
          code: String(item.code || "").trim(),
          severity: String(item.severity || "").trim(),
          message: String(item.message || "").trim(),
          channelId: String(item.channel_id || "").trim(),
          action: String(item.action || "").trim(),
        }))
        .filter((item) => item.message.length > 0),
    },
  }
}

export async function executeRoutingRulesCommand(input: {
  command: string
  rule_id?: number
  open_kfid?: string
  payload?: Record<string, unknown>
}): Promise<RoutingCommandResult | null> {
  const payload = await requestJSON<APIReply<RoutingCommandResult>>("/api/v1/main/routing-rules/commands", {
    method: "POST",
    body: JSON.stringify({
      command: input.command,
      rule_id: input.rule_id || 0,
      open_kfid: input.open_kfid || "",
      payload_json: JSON.stringify(input.payload || {}),
    }),
  })
  return payload?.data || null
}

export async function listRoutingRulesViewModel(_channelNameByID?: Record<string, string>): Promise<RoutingRuleViewModel[]> {
  const view = await getRoutingRulesView()
  return view.rules
}

function mapRule(item: RawRoutingRuleView): RoutingRuleViewModel {
  return {
    id: String(item.id || "").trim(),
    name: String(item.name || "未命名规则").trim(),
    channel: String(item.channel || "未指定渠道").trim(),
    channelId: String(item.channel_id || "").trim(),
    scene: String(item.scene || "").trim() || "无场景",
    mode: String(item.mode || "机器人+人工").trim(),
    target: mapTarget(item.target),
    actionMode: String(item.action_mode || "").trim(),
    actionModeLabel: String(item.action_mode_label || "").trim(),
    dispatchStrategy: String(item.dispatch_strategy || "").trim(),
    dispatchStrategyLabel: String(item.dispatch_strategy_label || "").trim(),
    dispatchCapacityThreshold: Number(item.dispatch_capacity_threshold || 0),
    priority: Number(item.priority || 0),
    isDefault: item.is_default === true,
    status: String(item.status || "inactive").trim(),
    lastHit: String(item.last_hit || "").trim(),
    hits: Number(item.hits || 0),
    transferRate: String(item.transfer_rate || "0%").trim(),
    responseTime: String(item.response_time || "0s").trim(),
    conditionsJson: String(item.conditions_json || "{}").trim() || "{}",
    actionJson: String(item.action_json || "{}").trim() || "{}",
  }
}

function mapTarget(item?: RawRoutingTarget): RoutingTarget {
  return {
    key: String(item?.key || "").trim(),
    kind: String(item?.kind || "").trim(),
    useFullPool: item?.use_full_pool === true,
    userIds: (item?.user_ids || []).map((value) => String(value || "").trim()).filter(Boolean),
    departmentIds: (item?.department_ids || []).map((value) => Number(value || 0)).filter((value) => value > 0),
    userCount: Number(item?.user_count || 0),
    departmentCount: Number(item?.department_count || 0),
  }
}
