import { requestJSON } from "./http"

type APIReply<T> = {
  code?: number
  message?: string
  data?: T
}

export type OrganizationSettingsView = {
  integration?: {
    corp_id?: string
    corp_name?: string
    authorization_status?: string
    installation_status?: string
    authorization_valid?: boolean
    agent_mapping_status?: string
    suite_mapping_status?: string
    health_status?: string
    last_checked_at?: string
    app_mode?: string
  }
  permission_checks?: Array<{
    code?: string
    name?: string
    status?: string
    impact?: string
    suggestion?: string
    owner?: string
  }>
  capabilities?: Array<{
    code?: string
    name?: string
    available?: boolean
    reason?: string
    impact_scope?: string
    next_step?: string
  }>
  object_checks?: Array<{
    code?: string
    name?: string
    status?: string
    summary?: string
    available_count?: number
    total_count?: number
    impact?: string
    suggestion?: string
    owner?: string
  }>
  recommendations?: string[]
  org_sync?: {
    auto_sync_enabled?: boolean
    sync_scope?: string
    sync_interval?: string
    last_sync_at?: string
  }
  toolbar_runtime?: Array<{
    code?: string
    name?: string
    status?: string
    entry_path?: string
    reason?: string
  }>
  roles?: Array<{
    role?: string
    role_name?: string
    system_preset?: boolean
    description?: string
    member_count?: number
    permissions?: string[]
  }>
  members?: Array<{
    userid?: string
    display_name?: string
    role?: string
    is_app_admin?: boolean
  }>
  permission_catalog?: string[]
  debug_switches?: Array<{
    key?: string
    label?: string
    description?: string
    enabled?: boolean
  }>
  integration_permissions?: Array<{
    code?: string
    path?: string
    source?: string
    expire_time?: number
  }>
  integration_admins?: Array<{
    userid?: string
    auth_type?: number
  }>
  integration_license_summary?: {
    total?: number
    active_total?: number
    has_more?: boolean
    next_cursor?: string
  }
  integration_license_accounts?: Array<{
    userid?: string
    type?: number
    expire_time?: number
    active_time?: number
  }>
}

export async function getOrganizationSettingsView(): Promise<OrganizationSettingsView | null> {
  const payload = await requestJSON<unknown>("/api/v1/main/organization-settings/view")
  return normalizeOrganizationSettingsView(payload)
}

export async function executeOrganizationSettingsCommand(command: string, payloadJSON = ""): Promise<string> {
  const payload = await requestJSON<APIReply<{ success?: boolean; message?: string }> | { success?: boolean; message?: string }>("/api/v1/main/organization-settings/commands", {
    method: "POST",
    body: JSON.stringify({
      command: command.trim(),
      payload_json: payloadJSON.trim(),
    }),
  })
  const row = asRecord(payload)
  const data = asRecord(row.data)
  return `${readString(data.message, row.message) || "操作已完成"}`.trim()
}

function normalizeOrganizationSettingsView(payload: unknown): OrganizationSettingsView | null {
  const root = asRecord(payload)
  const view = asRecord(root.data ?? root)
  if (!view || Object.keys(view).length === 0) {
    return null
  }

  const integration = asRecord(view.integration)
  return {
    integration: integration ? {
      corp_id: readString(integration.corp_id, integration.CorpID),
      corp_name: readString(integration.corp_name, integration.CorpName),
      authorization_status: readString(integration.authorization_status, integration.AuthorizationStatus),
      installation_status: readString(integration.installation_status, integration.InstallationStatus),
      authorization_valid: readBool(integration.authorization_valid, integration.AuthorizationValid),
      agent_mapping_status: readString(integration.agent_mapping_status, integration.AgentMappingStatus),
      suite_mapping_status: readString(integration.suite_mapping_status, integration.SuiteMappingStatus),
      health_status: readString(integration.health_status, integration.HealthStatus),
      last_checked_at: readString(integration.last_checked_at, integration.LastCheckedAt),
      app_mode: readString(integration.app_mode, integration.AppMode),
    } : undefined,
    permission_checks: readArray(view.permission_checks).map((row) => ({
      code: readString(row.code, row.Code),
      name: readString(row.name, row.Name),
      status: readString(row.status, row.Status),
      impact: readString(row.impact, row.Impact),
      suggestion: readString(row.suggestion, row.Suggestion),
      owner: readString(row.owner, row.Owner),
    })),
    capabilities: readArray(view.capabilities).map((row) => ({
      code: readString(row.code, row.Code),
      name: readString(row.name, row.Name),
      available: readBool(row.available, row.Available),
      reason: readString(row.reason, row.Reason),
      impact_scope: readString(row.impact_scope, row.ImpactScope),
      next_step: readString(row.next_step, row.NextStep),
    })),
    object_checks: readArray(view.object_checks).map((row) => ({
      code: readString(row.code, row.Code),
      name: readString(row.name, row.Name),
      status: readString(row.status, row.Status),
      summary: readString(row.summary, row.Summary),
      available_count: readNumber(row.available_count, row.AvailableCount),
      total_count: readNumber(row.total_count, row.TotalCount),
      impact: readString(row.impact, row.Impact),
      suggestion: readString(row.suggestion, row.Suggestion),
      owner: readString(row.owner, row.Owner),
    })),
    recommendations: readStringArray(view.recommendations),
    org_sync: (() => {
      const row = asRecord(view.org_sync)
      if (!row) return undefined
      return {
        auto_sync_enabled: readBool(row.auto_sync_enabled, row.AutoSyncEnabled),
        sync_scope: readString(row.sync_scope, row.SyncScope),
        sync_interval: readString(row.sync_interval, row.SyncInterval),
        last_sync_at: readString(row.last_sync_at, row.LastSyncAt),
      }
    })(),
    toolbar_runtime: readArray(view.toolbar_runtime).map((row) => ({
      code: readString(row.code, row.Code),
      name: readString(row.name, row.Name),
      status: readString(row.status, row.Status),
      entry_path: readString(row.entry_path, row.EntryPath),
      reason: readString(row.reason, row.Reason),
    })),
    roles: readArray(view.roles).map((row) => ({
      role: readString(row.role, row.Role),
      role_name: readString(row.role_name, row.RoleName),
      system_preset: readBool(row.system_preset, row.SystemPreset),
      description: readString(row.description, row.Description),
      member_count: readNumber(row.member_count, row.MemberCount),
      permissions: readStringArray(row.permissions, row.Permissions),
    })),
    members: readArray(view.members).map((row) => ({
      userid: readString(row.userid, row.UserID),
      display_name: readString(row.display_name, row.DisplayName),
      role: readString(row.role, row.Role),
      is_app_admin: readBool(row.is_app_admin, row.IsAppAdmin),
    })),
    permission_catalog: readStringArray(view.permission_catalog),
    debug_switches: readArray(view.debug_switches).map((row) => ({
      key: readString(row.key, row.Key),
      label: readString(row.label, row.Label),
      description: readString(row.description, row.Description),
      enabled: readBool(row.enabled, row.Enabled),
    })),
    integration_permissions: readArray(view.integration_permissions).map((row) => ({
      code: readString(row.code, row.Code),
      path: readString(row.path, row.Path),
      source: readString(row.source, row.Source),
      expire_time: readNumber(row.expire_time, row.ExpireTime),
    })),
    integration_admins: readArray(view.integration_admins).map((row) => ({
      userid: readString(row.userid, row.UserID, row.Userid),
      auth_type: readNumber(row.auth_type, row.AuthType),
    })),
    integration_license_summary: (() => {
      const row = asRecord(view.integration_license_summary)
      if (!row) return undefined
      return {
        total: readNumber(row.total, row.Total),
        active_total: readNumber(row.active_total, row.ActiveTotal),
        has_more: readBool(row.has_more, row.HasMore),
        next_cursor: readString(row.next_cursor, row.NextCursor),
      }
    })(),
    integration_license_accounts: readArray(view.integration_license_accounts).map((row) => ({
      userid: readString(row.userid, row.UserID, row.Userid),
      type: readNumber(row.type, row.Type),
      expire_time: readNumber(row.expire_time, row.ExpireTime),
      active_time: readNumber(row.active_time, row.ActiveTime),
    })),
  }
}

function asRecord(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, any>
}

function readArray(value: unknown): Array<Record<string, any>> {
  if (!Array.isArray(value)) return []
  return value.map((item) => asRecord(item)).filter((item) => Object.keys(item).length > 0)
}

function readString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") return value
  }
  return undefined
}

function readBool(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value
  }
  return undefined
}

function readNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value
  }
  return undefined
}

function readStringArray(...values: unknown[]): string[] {
  for (const value of values) {
    if (!Array.isArray(value)) continue
    const out = value.filter((item) => typeof item === "string").map((item) => `${item}`)
    if (out.length > 0) return out
    if (value.length === 0) return []
  }
  return []
}
