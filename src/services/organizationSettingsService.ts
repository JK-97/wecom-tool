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

export type OrganizationSettingsDebugView = Pick<
  OrganizationSettingsView,
  | "integration"
  | "permission_checks"
  | "capabilities"
  | "object_checks"
  | "recommendations"
  | "debug_switches"
  | "integration_permissions"
  | "integration_admins"
  | "integration_license_summary"
  | "integration_license_accounts"
  | "data_zone"
  | "data_zone_debug_mode"
  | "corp_capability_state"
>

export type OrganizationSettingsDebugAccessStatus = {
  enabled: boolean
  expires_at?: number
}

export type AssistantExecutionParticipant = {
  role?: string
  participant_id?: string
  label?: string
}

export type AssistantExecutionRunSummary = {
  run_ref?: string
  scene_type?: string
  conversation_type?: string
  conversation_key?: string
  channel_type?: string
  corp_id?: string
  channel_id?: string
  participants?: AssistantExecutionParticipant[]
  contact_name?: string
  owner_userid?: string
  run_kind?: string
  trigger_source?: string
  trigger_reason?: string
  model?: string
  strategy?: string
  status?: string
  decision_type?: string
  started_at?: string
  completed_at?: string
  latency_ms?: number
  output_summary_json?: string
}

export type AssistantExecutionStepEvent = {
  event_ref?: string
  sequence_no?: number
  event_kind?: string
  message_text?: string
  payload_json?: string
  occurred_at?: string
  latency_ms?: number
}

export type AssistantExecutionStep = {
  step_ref?: string
  parent_step_ref?: string
  sequence_no?: number
  parallel_group?: string
  lane_key?: string
  step_kind?: string
  step_name?: string
  status?: string
  model?: string
  tool_name?: string
  system_prompt_text?: string
  rendered_input_text?: string
  input_json?: string
  output_text?: string
  output_json?: string
  started_at?: string
  completed_at?: string
  latency_ms?: number
  error_message?: string
  events?: AssistantExecutionStepEvent[]
}

export type AssistantExecutionRunDetail = {
  summary?: AssistantExecutionRunSummary
  input_summary_json?: string
  output_summary_json?: string
  steps?: AssistantExecutionStep[]
}

export type AssistantExecutionRunsQuery = {
  scene_type?: string
  conversation_type?: string
  conversation_key?: string
  channel_id?: string
  participant?: string
  run_kind?: string
  status?: string
  decision_type?: string
  model?: string
  started_at_from?: string
  started_at_to?: string
  page?: number
  page_size?: number
}

export type AssistantExecutionRunsPage = {
  items: AssistantExecutionRunSummary[]
  total: number
  page: number
  page_size: number
}

export async function getOrganizationSettingsView(): Promise<OrganizationSettingsView | null> {
  const payload = await requestJSON<unknown>("/api/v1/main/organization-settings/view")
  return normalizeOrganizationSettingsView(payload)
}

export async function getOrganizationSettingsDebugView(): Promise<OrganizationSettingsDebugView | null> {
  const payload = await requestJSON<unknown>("/api/v1/main/organization-settings/debug-view")
  return normalizeOrganizationSettingsView(payload)
}

export async function getOrganizationSettingsDebugAccessStatus(): Promise<OrganizationSettingsDebugAccessStatus> {
  const payload = await requestJSON<unknown>("/api/v1/main/organization-settings/debug-access/status")
  const row = asRecord(asRecord(payload).data ?? payload)
  return {
    enabled: readBool(row.enabled, row.Enabled) === true,
    expires_at: readNumber(row.expires_at, row.ExpiresAt),
  }
}

export async function openOrganizationSettingsDebugAccess(secret: string): Promise<OrganizationSettingsDebugAccessStatus> {
  const payload = await requestJSON<unknown>("/api/v1/main/organization-settings/debug-access/open", {
    method: "POST",
    body: JSON.stringify({ secret }),
  })
  const row = asRecord(asRecord(payload).data ?? payload)
  return {
    enabled: true,
    expires_at: readNumber(row.expires_at, row.ExpiresAt),
  }
}

export async function closeOrganizationSettingsDebugAccess(): Promise<void> {
  await requestJSON<unknown>("/api/v1/main/organization-settings/debug-access/close", {
    method: "POST",
    body: JSON.stringify({}),
  })
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

export async function getOrganizationSettingsDebugAssistantRuns(query: AssistantExecutionRunsQuery = {}): Promise<AssistantExecutionRunsPage> {
  const searchParams = new URLSearchParams()
  const append = (key: string, value?: string | number) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      searchParams.set(key, String(value))
      return
    }
    const text = `${value || ""}`.trim()
    if (text) {
      searchParams.set(key, text)
    }
  }
  append("scene_type", query.scene_type)
  append("conversation_type", query.conversation_type)
  append("conversation_key", query.conversation_key)
  append("channel_id", query.channel_id)
  append("participant", query.participant)
  append("run_kind", query.run_kind)
  append("status", query.status)
  append("decision_type", query.decision_type)
  append("model", query.model)
  append("started_at_from", query.started_at_from)
  append("started_at_to", query.started_at_to)
  append("page", query.page)
  append("page_size", query.page_size)
  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : ""
  const payload = await requestJSON<unknown>(`/api/v1/main/organization-settings/debug/assistant-runs${suffix}`)
  return normalizeAssistantExecutionRunsPage(payload)
}

export async function getOrganizationSettingsDebugAssistantRunDetail(runRef: string): Promise<AssistantExecutionRunDetail | null> {
  const normalizedRunRef = runRef.trim()
  if (!normalizedRunRef) return null
  const payload = await requestJSON<unknown>(`/api/v1/main/organization-settings/debug/assistant-runs/${encodeURIComponent(normalizedRunRef)}`)
  return normalizeAssistantExecutionRunDetail(asRecord(payload).run ?? asRecord(asRecord(payload).data).run)
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

function normalizeAssistantExecutionRunsPage(payload: unknown): AssistantExecutionRunsPage {
  const root = asRecord(payload)
  const view = asRecord(root.data ?? root)
  return {
    items: readArray(view.items ?? view.Items).map((row) => normalizeAssistantExecutionRunSummary(row)).filter((row) => Object.keys(row).length > 0),
    total: readNumber(view.total, view.Total) || 0,
    page: readNumber(view.page, view.Page) || 1,
    page_size: readNumber(view.page_size, view.PageSize) || 20,
  }
}

function normalizeAssistantExecutionRunDetail(payload: unknown): AssistantExecutionRunDetail | null {
  const row = asRecord(payload)
  if (!row || Object.keys(row).length === 0) return null
  return {
    summary: normalizeAssistantExecutionRunSummary(asRecord(row.summary ?? row.Summary)),
    input_summary_json: readString(row.input_summary_json, row.InputSummaryJson),
    output_summary_json: readString(row.output_summary_json, row.OutputSummaryJson),
    steps: readArray(row.steps ?? row.Steps).map((step) => ({
      step_ref: readString(step.step_ref, step.StepRef),
      parent_step_ref: readString(step.parent_step_ref, step.ParentStepRef),
      sequence_no: readNumber(step.sequence_no, step.SequenceNo),
      parallel_group: readString(step.parallel_group, step.ParallelGroup),
      lane_key: readString(step.lane_key, step.LaneKey),
      step_kind: readString(step.step_kind, step.StepKind),
      step_name: readString(step.step_name, step.StepName),
      status: readString(step.status, step.Status),
      model: readString(step.model, step.Model),
      tool_name: readString(step.tool_name, step.ToolName),
      system_prompt_text: readString(step.system_prompt_text, step.SystemPromptText),
      rendered_input_text: readString(step.rendered_input_text, step.RenderedInputText),
      input_json: readString(step.input_json, step.InputJson),
      output_text: readString(step.output_text, step.OutputText),
      output_json: readString(step.output_json, step.OutputJson),
      started_at: readString(step.started_at, step.StartedAt),
      completed_at: readString(step.completed_at, step.CompletedAt),
      latency_ms: readNumber(step.latency_ms, step.LatencyMs),
      error_message: readString(step.error_message, step.ErrorMessage),
      events: readArray(step.events ?? step.Events).map((event) => ({
        event_ref: readString(event.event_ref, event.EventRef),
        sequence_no: readNumber(event.sequence_no, event.SequenceNo),
        event_kind: readString(event.event_kind, event.EventKind),
        message_text: readString(event.message_text, event.MessageText),
        payload_json: readString(event.payload_json, event.PayloadJson),
        occurred_at: readString(event.occurred_at, event.OccurredAt),
        latency_ms: readNumber(event.latency_ms, event.LatencyMs),
      })),
    })),
  }
}

function normalizeAssistantExecutionRunSummary(row: Record<string, any>): AssistantExecutionRunSummary {
  return {
    run_ref: readString(row.run_ref, row.RunRef),
    scene_type: readString(row.scene_type, row.SceneType),
    conversation_type: readString(row.conversation_type, row.ConversationType),
    conversation_key: readString(row.conversation_key, row.ConversationKey),
    channel_type: readString(row.channel_type, row.ChannelType),
    corp_id: readString(row.corp_id, row.CorpId, row.CorpID),
    channel_id: readString(row.channel_id, row.ChannelId, row.ChannelID),
    participants: readArray(row.participants ?? row.Participants).map((participant) => ({
      role: readString(participant.role, participant.Role),
      participant_id: readString(participant.participant_id, participant.ParticipantId, participant.ParticipantID),
      label: readString(participant.label, participant.Label),
    })),
    contact_name: readString(row.contact_name, row.ContactName),
    owner_userid: readString(row.owner_userid, row.OwnerUserid, row.OwnerUserID),
    run_kind: readString(row.run_kind, row.RunKind),
    trigger_source: readString(row.trigger_source, row.TriggerSource),
    trigger_reason: readString(row.trigger_reason, row.TriggerReason),
    model: readString(row.model, row.Model),
    strategy: readString(row.strategy, row.Strategy),
    status: readString(row.status, row.Status),
    decision_type: readString(row.decision_type, row.DecisionType),
    started_at: readString(row.started_at, row.StartedAt),
    completed_at: readString(row.completed_at, row.CompletedAt),
    latency_ms: readNumber(row.latency_ms, row.LatencyMs),
    output_summary_json: readString(row.output_summary_json, row.OutputSummaryJson),
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
