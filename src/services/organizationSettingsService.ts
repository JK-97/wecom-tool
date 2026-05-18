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
    last_sync_status?: string
    department_count?: number
    member_count?: number
    last_sync_error?: string
  }
  app_visibility?: {
    corp_id?: string
    suite_id?: string
    agent_id?: number
    agent_name?: string
    allow_party_count?: number
    allow_user_count?: number
    allow_tag_count?: number
    has_department_scope?: boolean
    has_user_scope?: boolean
    has_tag_scope?: boolean
    synced_at?: string
    updated_at?: string
    status?: string
    note?: string
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
    open_userid?: string
    role?: string
    is_app_admin?: boolean
    departments?: Array<{
      department_id?: number
      name?: string
      parent_id?: number
      order?: number
    }>
  }>
  departments?: Array<{
    department_id?: number
    name?: string
    parent_id?: number
    order?: number
  }>
  permission_catalog?: string[]
  debug_switches?: Array<{
    key?: string
    label?: string
    description?: string
    enabled?: boolean
  }>
  data_zone_debug_mode?: {
    program_id?: string
    debug_mode_status?: number
    enabled?: boolean
    corp_access_token?: string
    corp_access_token_expires_at?: number
    last_checked_at?: number
    last_check_error?: string
  }
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
  data_zone?: {
    corp_id?: string
    data_zone_permission_status?: string
    chatdata_auth_scope_status?: string
    chatdata_public_key_status?: string
    chatdata_receive_callback_status?: string
    data_zone_ready?: boolean
    public_key_ready?: boolean
    receive_callback_ready?: boolean
    auth_user_count?: number
    public_key_ver?: number
    public_key_fingerprint?: string
    public_key_set_at?: number
    private_key_stored?: boolean
    private_key_encrypt_version?: string
    receive_callback_program_id?: string
    sync_msg_ability_id?: string
    callback_fetch_ability_id?: string
    log_level?: number
    receive_callback_set_at?: number
    last_check_at?: number
    last_check_error?: string
    auth_editions?: Array<{
      edition?: number
      auth_scope?: {
        userid_list?: string[]
        department_id_list?: number[]
        tag_id_list?: number[]
      }
      status?: number
      begin_time?: number
      end_time?: number
      msg_duration_days?: number
      auth_user_count?: number
    }>
    auth_user_preview?: Array<{
      userid?: string
      edition_list?: number[]
    }>
  }
  corp_capability_state?: {
    corp_id?: string
    updated_at?: string
    install?: CapabilityAxisView
    org_scope?: CapabilityAxisView & {
      scope_kind?: string
      member_count?: number
      department_count?: number
      visibility_hash?: string
      auth_snapshot_hash?: string
      details_json?: string
    }
    open_data?: CapabilityAxisView & {
      auth_user_count?: number
      details_json?: string
    }
    reception_channel?: CapabilityAxisView & {
      active_count?: number
      channel_hash?: string
      details_json?: string
    }
    crm_bootstrap?: CapabilityAxisView & {
      scope?: string
      details_json?: string
    }
  }
}

type CapabilityAxisView = {
  status?: string
  blocked_reason?: string
  last_error?: string
  last_checked_at?: string
  last_ready_at?: string
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
  const members = readArray(view.members ?? view.Members).map((row) => ({
    userid: readString(row.userid, row.UserID),
    open_userid: readString(row.open_userid, row.OpenUserid, row.OpenUserID),
    role: readString(row.role, row.Role),
    is_app_admin: readBool(row.is_app_admin, row.IsAppAdmin),
    departments: readArray(row.departments ?? row.Departments).map((department) => ({
      department_id: readNumber(department.department_id, department.DepartmentID),
      name: readString(department.name, department.Name),
      parent_id: readNumber(department.parent_id, department.ParentID),
      order: readNumber(department.order, department.Order),
    })),
  }))
  const topLevelDepartments = readArray(view.departments ?? view.Departments).map((row) => ({
    department_id: readNumber(row.department_id, row.DepartmentID),
    name: readString(row.name, row.Name),
    parent_id: readNumber(row.parent_id, row.ParentID),
    order: readNumber(row.order, row.Order),
  }))
  const departments = mergeOrganizationDepartments(topLevelDepartments, members)
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
        last_sync_status: readString(row.last_sync_status, row.LastSyncStatus),
        department_count: readNumber(row.department_count, row.DepartmentCount),
        member_count: readNumber(row.member_count, row.MemberCount),
        last_sync_error: readString(row.last_sync_error, row.LastSyncError),
      }
    })(),
    app_visibility: (() => {
      const row = asRecord(view.app_visibility)
      if (!row) return undefined
      return {
        corp_id: readString(row.corp_id, row.CorpID),
        suite_id: readString(row.suite_id, row.SuiteID),
        agent_id: readNumber(row.agent_id, row.AgentID),
        agent_name: readString(row.agent_name, row.AgentName),
        allow_party_count: readNumber(row.allow_party_count, row.AllowPartyCount),
        allow_user_count: readNumber(row.allow_user_count, row.AllowUserCount),
        allow_tag_count: readNumber(row.allow_tag_count, row.AllowTagCount),
        has_department_scope: readBool(row.has_department_scope, row.HasDepartmentScope),
        has_user_scope: readBool(row.has_user_scope, row.HasUserScope),
        has_tag_scope: readBool(row.has_tag_scope, row.HasTagScope),
        synced_at: readString(row.synced_at, row.SyncedAt),
        updated_at: readString(row.updated_at, row.UpdatedAt),
        status: readString(row.status, row.Status),
        note: readString(row.note, row.Note),
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
    members,
    departments,
    permission_catalog: readStringArray(view.permission_catalog),
    debug_switches: readArray(view.debug_switches).map((row) => ({
      key: readString(row.key, row.Key),
      label: readString(row.label, row.Label),
      description: readString(row.description, row.Description),
      enabled: readBool(row.enabled, row.Enabled),
    })),
    data_zone_debug_mode: (() => {
      const row = asRecord(view.data_zone_debug_mode ?? view.DataZoneDebugMode)
      if (!row) return undefined
      return {
        program_id: readString(row.program_id, row.ProgramID, row.ProgramId),
        debug_mode_status: readNumber(row.debug_mode_status, row.DebugModeStatus),
        enabled: readBool(row.enabled, row.Enabled),
        corp_access_token: readString(row.corp_access_token, row.CorpAccessToken),
        corp_access_token_expires_at: readNumber(row.corp_access_token_expires_at, row.CorpAccessTokenExpiresAt),
        last_checked_at: readNumber(row.last_checked_at, row.LastCheckedAt),
        last_check_error: readString(row.last_check_error, row.LastCheckError),
      }
    })(),
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
    data_zone: (() => {
      const row = asRecord(view.data_zone ?? view.DataZone)
      if (!row) return undefined
      return {
        corp_id: readString(row.corp_id, row.CorpID),
        data_zone_permission_status: readString(row.data_zone_permission_status, row.DataZonePermissionStatus),
        chatdata_auth_scope_status: readString(row.chatdata_auth_scope_status, row.ChatDataAuthScopeStatus),
        chatdata_public_key_status: readString(row.chatdata_public_key_status, row.ChatDataPublicKeyStatus),
        chatdata_receive_callback_status: readString(row.chatdata_receive_callback_status, row.ChatDataReceiveCallbackStatus),
        data_zone_ready: readBool(row.data_zone_ready, row.DataZoneReady),
        public_key_ready: readBool(row.public_key_ready, row.PublicKeyReady),
        receive_callback_ready: readBool(row.receive_callback_ready, row.ReceiveCallbackReady),
        auth_user_count: readNumber(row.auth_user_count, row.AuthUserCount),
        public_key_ver: readNumber(row.public_key_ver, row.PublicKeyVer),
        public_key_fingerprint: readString(row.public_key_fingerprint, row.PublicKeyFingerprint),
        public_key_set_at: readNumber(row.public_key_set_at, row.PublicKeySetAt),
        private_key_stored: readBool(row.private_key_stored, row.PrivateKeyStored),
        private_key_encrypt_version: readString(row.private_key_encrypt_version, row.PrivateKeyEncryptVersion),
        receive_callback_program_id: readString(row.receive_callback_program_id, row.ReceiveCallbackProgramID, row.ReceiveCallbackProgramId),
        sync_msg_ability_id: readString(row.sync_msg_ability_id, row.SyncMsgAbilityID, row.SyncMsgAbilityId),
        callback_fetch_ability_id: readString(row.callback_fetch_ability_id, row.CallbackFetchAbilityID, row.CallbackFetchAbilityId),
        log_level: readNumber(row.log_level, row.LogLevel),
        receive_callback_set_at: readNumber(row.receive_callback_set_at, row.ReceiveCallbackSetAt),
        last_check_at: readNumber(row.last_check_at, row.LastCheckAt),
        last_check_error: readString(row.last_check_error, row.LastCheckError),
        auth_editions: readArray(row.auth_editions ?? row.AuthEditions).map((edition) => {
          const scope = asRecord(edition.auth_scope ?? edition.AuthScope)
          return {
            edition: readNumber(edition.edition, edition.Edition),
            auth_scope: {
              userid_list: readStringArray(scope.userid_list, scope.UseridList, scope.UserIDList),
              department_id_list: readNumberArray(scope.department_id_list, scope.DepartmentIdList, scope.DepartmentIDList),
              tag_id_list: readNumberArray(scope.tag_id_list, scope.TagIdList, scope.TagIDList),
            },
            status: readNumber(edition.status, edition.Status),
            begin_time: readNumber(edition.begin_time, edition.BeginTime),
            end_time: readNumber(edition.end_time, edition.EndTime),
            msg_duration_days: readNumber(edition.msg_duration_days, edition.MsgDurationDays),
            auth_user_count: readNumber(edition.auth_user_count, edition.AuthUserCount),
          }
        }),
        auth_user_preview: readArray(row.auth_user_preview ?? row.AuthUserPreview).map((user) => ({
          userid: readString(user.userid, user.Userid, user.UserID),
          edition_list: readNumberArray(user.edition_list, user.EditionList),
        })),
      }
    })(),
    corp_capability_state: (() => {
      const row = asRecord(view.corp_capability_state ?? view.CorpCapabilityState)
      if (!row) return undefined
      const install = asRecord(row.install ?? row.Install)
      const orgScope = asRecord(row.org_scope ?? row.OrgScope)
      const openData = asRecord(row.open_data ?? row.OpenData)
      const receptionChannel = asRecord(row.reception_channel ?? row.ReceptionChannel)
      const crmBootstrap = asRecord(row.crm_bootstrap ?? row.CrmBootstrap)
      return {
        corp_id: readString(row.corp_id, row.CorpID),
        updated_at: readString(row.updated_at, row.UpdatedAt),
        install: normalizeCapabilityAxisView(install),
        org_scope: {
          ...normalizeCapabilityAxisView(orgScope),
          scope_kind: readString(orgScope.scope_kind, orgScope.ScopeKind),
          member_count: readNumber(orgScope.member_count, orgScope.MemberCount),
          department_count: readNumber(orgScope.department_count, orgScope.DepartmentCount),
          visibility_hash: readString(orgScope.visibility_hash, orgScope.VisibilityHash),
          auth_snapshot_hash: readString(orgScope.auth_snapshot_hash, orgScope.AuthSnapshotHash),
          details_json: readString(orgScope.details_json, orgScope.DetailsJson),
        },
        open_data: {
          ...normalizeCapabilityAxisView(openData),
          auth_user_count: readNumber(openData.auth_user_count, openData.AuthUserCount),
          details_json: readString(openData.details_json, openData.DetailsJson),
        },
        reception_channel: {
          ...normalizeCapabilityAxisView(receptionChannel),
          active_count: readNumber(receptionChannel.active_count, receptionChannel.ActiveCount),
          channel_hash: readString(receptionChannel.channel_hash, receptionChannel.ChannelHash),
          details_json: readString(receptionChannel.details_json, receptionChannel.DetailsJson),
        },
        crm_bootstrap: {
          ...normalizeCapabilityAxisView(crmBootstrap),
          scope: readString(crmBootstrap.scope, crmBootstrap.Scope),
          details_json: readString(crmBootstrap.details_json, crmBootstrap.DetailsJson),
        },
      }
    })(),
  }
}

function normalizeCapabilityAxisView(row: Record<string, any>): CapabilityAxisView {
  return {
    status: readString(row.status, row.Status),
    blocked_reason: readString(row.blocked_reason, row.BlockedReason),
    last_error: readString(row.last_error, row.LastError),
    last_checked_at: readString(row.last_checked_at, row.LastCheckedAt),
    last_ready_at: readString(row.last_ready_at, row.LastReadyAt),
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

function readNumberArray(...values: unknown[]): number[] {
  for (const value of values) {
    if (!Array.isArray(value)) continue
    const out = value
      .map((item) => (typeof item === "number" && Number.isFinite(item) ? item : Number.NaN))
      .filter((item) => Number.isFinite(item))
    if (out.length > 0) return out
    if (value.length === 0) return []
  }
  return []
}

function mergeOrganizationDepartments(
  topLevelDepartments: NonNullable<OrganizationSettingsView["departments"]>,
  members: NonNullable<OrganizationSettingsView["members"]>,
): NonNullable<OrganizationSettingsView["departments"]> {
  const byID = new Map<number, NonNullable<OrganizationSettingsView["departments"]>[number]>()

  const upsert = (
    row: NonNullable<OrganizationSettingsView["departments"]>[number] | undefined,
  ) => {
    const departmentID = Number(row?.department_id || 0)
    if (!Number.isInteger(departmentID) || departmentID <= 0) return
    const existing = byID.get(departmentID)
    const next = {
      department_id: departmentID,
      name: readString(row?.name, existing?.name) || "",
      parent_id: readNumber(row?.parent_id, existing?.parent_id) || 0,
      order: readNumber(row?.order, existing?.order) || 0,
    }
    byID.set(departmentID, next)
  }

  topLevelDepartments.forEach((department) => upsert(department))
  members.forEach((member) => {
    ;(member.departments || []).forEach((department) => upsert(department))
  })

  return Array.from(byID.values()).sort((a, b) => {
    const aParent = Number(a.parent_id || 0)
    const bParent = Number(b.parent_id || 0)
    if (aParent !== bParent) return aParent - bParent
    const aOrder = Number(a.order || 0)
    const bOrder = Number(b.order || 0)
    if (aOrder !== bOrder) return aOrder - bOrder
    const aName = (a.name || "").trim()
    const bName = (b.name || "").trim()
    if (aName !== bName) return aName.localeCompare(bName, "zh-CN")
    return Number(a.department_id || 0) - Number(b.department_id || 0)
  })
}
