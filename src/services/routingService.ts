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
  target: string
  priority: number
  isDefault: boolean
  status: "active" | "inactive" | string
  lastHit: string
  hits7d: number
  transferRate: string
  responseTime: string
}

export type RoutingDistribution = {
  ruleName: string
  hits7d: number
  percent: string
}

export type RoutingRulesViewModel = {
  rules: RoutingRuleViewModel[]
  totalHits7d: number
  transferRate: string
  avgResponseTime: string
  distributions: RoutingDistribution[]
  diagnostics: {
    warnings: string[]
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
  target?: string
  priority?: number
  is_default?: boolean
  status?: string
  last_hit?: string
  hits_7d?: number
  transfer_rate?: string
  response_time?: string
}

type RawRoutingDistribution = {
  rule_name?: string
  hits_7d?: number
  percent?: string
}

type RawRoutingRulesViewData = {
  rules?: RawRoutingRuleView[]
  total_hits_7d?: number
  transfer_rate?: string
  avg_response_time?: string
  distributions?: RawRoutingDistribution[]
  diagnostics?: {
    warnings?: string[]
  }
}

export async function getRoutingRulesView(params?: {
  channel_filter?: string
  query?: string
}): Promise<RoutingRulesViewModel> {
  const search = new URLSearchParams()
  if (params?.channel_filter) search.set("channel_filter", params.channel_filter)
  if (params?.query) search.set("query", params.query)
  const payload = await requestJSON<APIReply<RawRoutingRulesViewData>>(
    `/api/v1/main/routing-rules/view?${search.toString()}`,
  )
  const data = payload?.data || {}
  return {
    rules: (data.rules || []).map(mapRule),
    totalHits7d: Number(data.total_hits_7d || 0),
    transferRate: String(data.transfer_rate || "0%"),
    avgResponseTime: String(data.avg_response_time || "0s"),
    distributions: (data.distributions || []).map((item) => ({
      ruleName: String(item.rule_name || "").trim(),
      hits7d: Number(item.hits_7d || 0),
      percent: String(item.percent || "0%").trim(),
    })),
    diagnostics: {
      warnings: (data.diagnostics?.warnings || []).map((item) => String(item || "").trim()).filter(Boolean),
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
    scene: String(item.scene || "ANY").trim(),
    mode: String(item.mode || "机器人+人工").trim(),
    target: String(item.target || "默认接待池").trim(),
    priority: Number(item.priority || 0),
    isDefault: item.is_default === true,
    status: String(item.status || "inactive").trim(),
    lastHit: String(item.last_hit || "").trim(),
    hits7d: Number(item.hits_7d || 0),
    transferRate: String(item.transfer_rate || "0%").trim(),
    responseTime: String(item.response_time || "0s").trim(),
  }
}
