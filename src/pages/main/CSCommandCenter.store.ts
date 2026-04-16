export type SessionTab = "queue" | "active" | "closed";
export type DetailPanelTab = "monitor" | "upgrade" | "session";

export type CommandCenterSession = {
  external_userid?: string;
  open_kfid?: string;
  name?: string;
  source?: string;
  source_display_name?: string;
  session_state?: number;
  session_label?: string;
  state_bucket?: string;
  assigned_userid?: string;
  assigned_display_userid?: string;
  assigned_display_fallback?: string;
  assigned_raw_servicer_userid?: string;
  assigned_resolved_userid?: string;
  assigned_resolved_open_userid?: string;
  assigned_resolution_status?: string;
  last_active?: string;
  last_message?: string;
  unread_count?: number;
  overdue?: boolean;
  queue_wait_secs?: number;
  queue_wait_text?: string;
  reply_overdue?: boolean;
  reply_sla_status?: string;
  matched_route_name?: string;
  matched_route_id?: string;
  current_status_summary?: string;
  current_assigned_target_id?: string;
  current_assigned_target_tag?: string;
  sync_state?: string;
  latest_message_id?: string;
  latest_message_occurred_at?: string;
  last_routing_occurred_at?: string;
  last_projection_event_id?: string;
  last_projection_event_type?: string;
  updated_at?: string;
};

export type CommandCenterMonitor = {
  document_id?: string;
  corp_id?: string;
  open_kfid?: string;
  external_user_id?: string;
  mood?: string;
  summary?: string;
  compliance_pass?: boolean;
  emotion?: {
    code?: string;
    label?: string;
    score?: number;
    risk_level?: string;
    reason?: string;
  };
  summary_detail?: {
    text?: string;
    customer_intent?: string;
    priority?: string;
    suggested_focus?: string;
  };
  compliance?: {
    status?: string;
    risk_tags?: string[];
    reason?: string;
    recommended_action?: string;
  };
  meta?: {
    status?: string;
    model?: string;
    analyzed_at?: string;
    memory_version?: number;
    source_message_start_id?: string;
    source_message_end_id?: string;
    source_message_count?: number;
    is_stale?: boolean;
    running_task_id?: number;
    failure_message?: string;
  };
  source_event_id?: string;
  source_event_type?: string;
  updated_at?: string;
};

export type CommandCenterMessage = {
  id?: string;
  sender?: string;
  content?: string;
  timestamp?: string;
  type?: string;
  status?: string;
  delivery_status?: string;
  last_attempt_at?: string;
  delivered_at?: string;
  next_retry_at?: string;
};

export type CommandCenterRoutingRecord = {
  occurred_at?: string;
  actor_type?: string;
  actor_label?: string;
  actor_userid?: string;
  action_text?: string;
  target_label?: string;
  target_userid?: string;
  details?: {
    rule_id?: string;
    dispatch_strategy_label?: string;
    action_boundary_label?: string;
    execution_result_label?: string;
    result_state_label?: string;
    rule_name?: string;
    target_label?: string;
    target_userid?: string;
    trigger_label?: string;
    reason_summary?: string;
    trace_id?: string;
    target_raw_servicer_userid?: string;
  };
};

export type CommandCenterStatusBar = {
  session_label?: string;
  state_bucket?: string;
  assigned_user_id?: string;
  assigned_display?: string;
  queue_wait_text?: string;
  reply_sla_status?: string;
  matched_route_name?: string;
  source_display_name?: string;
  entry_source_label?: string;
  sync_state?: string;
};

export type CommandCenterEntryContext = {
  scene?: string;
  scene_param?: string;
  wechat_channels_nickname?: string;
  welcome_code?: string;
};

export type CommandCenterDisplayMeta = {
  warnings?: string[];
  last_event_id?: string;
  last_event_type?: string;
  last_payload_hash?: string;
};

export type CommandCenterSessionDetail = {
  session?: CommandCenterSession;
  entry_context?: CommandCenterEntryContext;
  routing_records?: CommandCenterRoutingRecord[];
  messages?: CommandCenterMessage[];
  monitor?: CommandCenterMonitor;
  warnings?: string[];
  status_bar?: CommandCenterStatusBar;
  display_meta?: CommandCenterDisplayMeta;
};

export type CommandCenterViewModel = {
  queue_count?: number;
  active_count?: number;
  closed_count?: number;
  sessions?: CommandCenterSession[];
  selected?: CommandCenterSession;
  monitor?: CommandCenterMonitor;
  warnings?: string[];
};

export type CommandCenterBootstrapResponse = {
  cursor?: number;
  status_summary?: {
    queue_count?: number;
    active_count?: number;
    closed_count?: number;
    updated_at?: string;
  };
  sessions?: Array<Record<string, unknown>>;
  selected_external_userid?: string;
  selected_detail?: Record<string, unknown> | null;
  messages?: Array<Record<string, unknown>>;
  routing_records?: Array<Record<string, unknown>>;
  monitor?: Record<string, unknown> | null;
  status_bar?: Record<string, unknown> | null;
  entry_context?: Record<string, unknown> | null;
  display_meta?: Record<string, unknown> | null;
};

export type CommandCenterStreamEvent = {
  cursor?: number;
  event_id?: string;
  patch_type?: string;
  external_userid?: string;
  payload?: unknown;
};

export type CommandCenterPatch =
  | {
      cursor: number;
      patchType: "sessions_changed";
      externalUserID: string;
      session: CommandCenterSession | null;
    }
  | {
      cursor: number;
      patchType: "selected_detail_changed";
      externalUserID: string;
      detail: CommandCenterSessionDetail | null;
    }
  | {
      cursor: number;
      patchType: "messages_appended";
      externalUserID: string;
      message: CommandCenterMessage | null;
    }
  | {
      cursor: number;
      patchType: "routing_records_appended";
      externalUserID: string;
      routingRecord: CommandCenterRoutingRecord | null;
    }
  | {
      cursor: number;
      patchType: "monitor_changed";
      externalUserID: string;
      monitor: CommandCenterMonitor | null;
    }
  | {
      cursor: number;
      patchType: "status_changed";
      externalUserID: string;
      statusBar: CommandCenterStatusBar | null;
    };

export type CommandCenterUIState = {
  isBootstrapping: boolean;
  bootstrapError: string;
  notice: string;
  activeTab: SessionTab;
  detailPanelTab: DetailPanelTab;
  keyword: string;
  isSubmitting: boolean;
  isTransferModalOpen: boolean;
  isQueueModalOpen: boolean;
  isEndModalOpen: boolean;
  isUpgradeModalOpen: boolean;
  isUpgradeSuccess: boolean;
  isRoutingHistoryExpanded: boolean;
  transferSearch: string;
  selectedTransferServicerID: string;
  upgradeOwner: string;
  upgradeReason: string;
  upgradeTask: string;
  upgradeStars: number;
  dataUpdatedAtMs: number;
  pendingSelectedExternalUserID: string;
};

export type CommandCenterState = {
  cursor: number;
  streamAnchorCursor: number;
  sessions: CommandCenterSession[];
  selectedExternalUserID: string;
  selectedDetail: CommandCenterSessionDetail | null;
  messages: CommandCenterMessage[];
  routingRecords: CommandCenterRoutingRecord[];
  monitor: CommandCenterMonitor | null;
  statusBar: CommandCenterStatusBar | null;
  entryContext: CommandCenterEntryContext | null;
  displayMeta: CommandCenterDisplayMeta | null;
  ui: CommandCenterUIState;
};

type InitFromBootstrapAction = {
  type: "INIT_FROM_BOOTSTRAP";
  payload: CommandCenterBootstrapResponse;
  receivedAtMs: number;
};

type ApplyPatchAction = {
  type: "APPLY_PATCH";
  patch: CommandCenterPatch;
  receivedAtMs: number;
};

type RebootstrapAction = {
  type: "REBOOTSTRAP";
  pendingSelectedExternalUserID?: string;
};

type SetUIAction = {
  type: "SET_UI";
  payload: Partial<CommandCenterUIState>;
};

export type CommandCenterAction =
  | InitFromBootstrapAction
  | ApplyPatchAction
  | RebootstrapAction
  | SetUIAction;

export const initialCommandCenterState: CommandCenterState = {
  cursor: 0,
  streamAnchorCursor: 0,
  sessions: [],
  selectedExternalUserID: "",
  selectedDetail: null,
  messages: [],
  routingRecords: [],
  monitor: null,
  statusBar: null,
  entryContext: null,
  displayMeta: null,
  ui: {
    isBootstrapping: true,
    bootstrapError: "",
    notice: "",
    activeTab: "queue",
    detailPanelTab: "monitor",
    keyword: "",
    isSubmitting: false,
    isTransferModalOpen: false,
    isQueueModalOpen: false,
    isEndModalOpen: false,
    isUpgradeModalOpen: false,
    isUpgradeSuccess: false,
    isRoutingHistoryExpanded: false,
    transferSearch: "",
    selectedTransferServicerID: "",
    upgradeOwner: "销售部-王经理",
    upgradeReason: "高意向潜客",
    upgradeTask: "",
    upgradeStars: 4,
    dataUpdatedAtMs: 0,
    pendingSelectedExternalUserID: "",
  },
};

export function commandCenterReducer(
  state: CommandCenterState,
  action: CommandCenterAction,
): CommandCenterState {
  switch (action.type) {
    case "INIT_FROM_BOOTSTRAP": {
      const next = normalizeBootstrapResponse(action.payload);
      return {
        ...next,
        ui: {
          ...state.ui,
          isBootstrapping: false,
          bootstrapError: "",
          isSubmitting: false,
          dataUpdatedAtMs: action.receivedAtMs,
          pendingSelectedExternalUserID: "",
        },
      };
    }
    case "APPLY_PATCH": {
      if (action.patch.cursor <= state.cursor) {
        return state;
      }
      const next = applyPatch(state, action.patch);
      return {
        ...next,
        cursor: action.patch.cursor,
        ui: {
          ...next.ui,
          dataUpdatedAtMs: action.receivedAtMs,
        },
      };
    }
    case "REBOOTSTRAP":
      return {
        ...state,
        ui: {
          ...state.ui,
          isBootstrapping: true,
          bootstrapError: "",
          pendingSelectedExternalUserID: (
            action.pendingSelectedExternalUserID || ""
          ).trim(),
        },
      };
    case "SET_UI":
      return {
        ...state,
        ui: {
          ...state.ui,
          ...action.payload,
        },
      };
    default:
      return state;
  }
}

export function selectCommandCenterViewModel(
  state: CommandCenterState,
): CommandCenterViewModel {
  return {
    queue_count: countBucket(state.sessions, "queue"),
    active_count: countBucket(state.sessions, "active"),
    closed_count: countBucket(state.sessions, "closed"),
    sessions: state.sessions,
    selected: selectCurrentSession(state),
    monitor: state.monitor || undefined,
    warnings: state.displayMeta?.warnings || [],
  };
}

export function selectCommandCenterDetail(
  state: CommandCenterState,
): CommandCenterSessionDetail | null {
  if (
    !state.selectedDetail &&
    !state.entryContext &&
    !state.monitor &&
    state.messages.length === 0 &&
    state.routingRecords.length === 0
  ) {
    return null;
  }
  return {
    session: selectCurrentSession(state) || state.selectedDetail?.session,
    entry_context: state.entryContext || state.selectedDetail?.entry_context,
    routing_records: state.routingRecords,
    messages: state.messages,
    monitor: state.monitor || state.selectedDetail?.monitor,
    warnings: state.displayMeta?.warnings || state.selectedDetail?.warnings,
    status_bar: state.statusBar || state.selectedDetail?.status_bar,
    display_meta: state.displayMeta || state.selectedDetail?.display_meta,
  };
}

export function normalizePatchEvent(
  event: CommandCenterStreamEvent,
): CommandCenterPatch | null {
  const cursor = Number(event.cursor || 0);
  if (cursor <= 0) {
    return null;
  }
  const patchType = String(event.patch_type || "").trim();
  const externalUserID = String(event.external_userid || "").trim();
  switch (patchType) {
    case "sessions_changed":
      return {
        cursor,
        patchType,
        externalUserID,
        session: normalizeSession(event.payload),
      };
    case "selected_detail_changed":
      return {
        cursor,
        patchType,
        externalUserID,
        detail: normalizeDetailDocument(event.payload),
      };
    case "messages_appended":
      return {
        cursor,
        patchType,
        externalUserID,
        message: normalizeMessage(event.payload),
      };
    case "routing_records_appended":
      return {
        cursor,
        patchType,
        externalUserID,
        routingRecord: normalizeRoutingRecord(event.payload),
      };
    case "monitor_changed":
      return {
        cursor,
        patchType,
        externalUserID,
        monitor: normalizeMonitor(event.payload),
      };
    case "status_changed":
      return {
        cursor,
        patchType,
        externalUserID,
        statusBar: normalizeStatusBar(event.payload),
      };
    default:
      return null;
  }
}

function applyPatch(
  state: CommandCenterState,
  patch: CommandCenterPatch,
): CommandCenterState {
  switch (patch.patchType) {
    case "sessions_changed": {
      const sessions = upsertSession(state.sessions, patch.session);
      const currentSelected = selectSessionByExternalUserID(
        sessions,
        state.selectedExternalUserID,
      );
      return {
        ...state,
        sessions,
        selectedDetail:
          currentSelected && state.selectedDetail
            ? {
                ...state.selectedDetail,
                session: {
                  ...(state.selectedDetail.session || {}),
                  ...currentSelected,
                },
              }
            : state.selectedDetail,
      };
    }
    case "selected_detail_changed": {
      if (
        patch.externalUserID &&
        patch.externalUserID !== state.selectedExternalUserID
      ) {
        return state;
      }
      const detail = patch.detail;
      return {
        ...state,
        selectedDetail: detail,
        entryContext: detail?.entry_context || null,
        displayMeta: detail?.display_meta || null,
        statusBar: detail?.status_bar || state.statusBar,
        monitor: detail?.monitor || state.monitor,
        messages: detail?.messages || state.messages,
        routingRecords: detail?.routing_records || state.routingRecords,
      };
    }
    case "messages_appended": {
      if (
        patch.externalUserID &&
        patch.externalUserID !== state.selectedExternalUserID
      ) {
        return state;
      }
      if (!patch.message) {
        return state;
      }
      const messages = upsertMessage(state.messages, patch.message);
      return {
        ...state,
        messages,
      };
    }
    case "routing_records_appended": {
      if (
        patch.externalUserID &&
        patch.externalUserID !== state.selectedExternalUserID
      ) {
        return state;
      }
      if (!patch.routingRecord) {
        return state;
      }
      const routingRecords = upsertRoutingRecord(
        state.routingRecords,
        patch.routingRecord,
      );
      return {
        ...state,
        routingRecords,
      };
    }
    case "monitor_changed":
      if (
        patch.externalUserID &&
        patch.externalUserID !== state.selectedExternalUserID
      ) {
        return state;
      }
      return {
        ...state,
        monitor: patch.monitor,
      };
    case "status_changed":
      if (
        patch.externalUserID &&
        patch.externalUserID !== state.selectedExternalUserID
      ) {
        return state;
      }
      return {
        ...state,
        statusBar: patch.statusBar,
      };
    default:
      return state;
  }
}

function normalizeBootstrapResponse(
  payload: CommandCenterBootstrapResponse,
): CommandCenterState {
  const sessions = Array.isArray(payload.sessions)
    ? payload.sessions.map((item) => normalizeSession(item)).filter(Boolean)
    : [];
  const selectedExternalUserID = (
    payload.selected_external_userid ||
    sessions[0]?.external_userid ||
    ""
  ).trim();
  const selectedDetail = normalizeDetailDocument(payload.selected_detail);
  const messages = Array.isArray(payload.messages)
    ? payload.messages.map((item) => normalizeMessage(item)).filter(Boolean)
    : [];
  const routingRecords = Array.isArray(payload.routing_records)
    ? payload.routing_records
        .map((item) => normalizeRoutingRecord(item))
        .filter(Boolean)
    : [];
  const monitor = normalizeMonitor(payload.monitor);
  const statusBar = normalizeStatusBar(payload.status_bar);
  const entryContext = normalizeEntryContext(payload.entry_context);
  const displayMeta = normalizeDisplayMeta(payload.display_meta);
  const preferredActiveTab = pickInitialActiveTab(sessions);
  return {
    cursor: Number(payload.cursor || 0),
    streamAnchorCursor: Number(payload.cursor || 0),
    sessions,
    selectedExternalUserID,
    selectedDetail:
      selectedDetail ||
      (selectedExternalUserID
        ? {
            session:
              selectSessionByExternalUserID(sessions, selectedExternalUserID) ||
              undefined,
          }
        : null),
    messages,
    routingRecords,
    monitor,
    statusBar,
    entryContext,
    displayMeta,
    ui: {
      ...initialCommandCenterState.ui,
      activeTab: preferredActiveTab,
    },
  };
}

function normalizeSession(value: unknown): CommandCenterSession | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  const externalUserID = readString(row, "external_userid", "external_user_id");
  const openKFID = readString(row, "open_kfid");
  if (!externalUserID && !openKFID) {
    return null;
  }
  const replySLAStatus = readString(row, "reply_sla_status");
  const assignedDisplay = readString(row, "assigned_display_name", "assigned_display_userid");
  return {
    external_userid: externalUserID,
    open_kfid: openKFID,
    name: readString(row, "name"),
    source: openKFID,
    source_display_name: readString(row, "source_display_name"),
    session_state: readNumber(row, "session_state"),
    session_label: readString(row, "session_label"),
    state_bucket: readString(row, "state_bucket"),
    assigned_userid: readString(row, "assigned_user_id", "assigned_userid"),
    assigned_display_userid: assignedDisplay,
    assigned_display_fallback:
      assignedDisplay ||
      readString(row, "assigned_user_id", "assigned_userid") ||
      "待分配",
    assigned_raw_servicer_userid: readString(
      row,
      "assigned_user_id",
      "assigned_userid",
    ),
    assigned_resolved_userid: readString(
      row,
      "assigned_user_id",
      "assigned_userid",
    ),
    assigned_resolved_open_userid: readString(row, "current_assigned_target_id"),
    assigned_resolution_status: "resolved",
    last_active: readString(row, "last_active_at", "updated_at"),
    last_message: readString(row, "last_message_preview"),
    unread_count: readNumber(row, "unread_count"),
    overdue: replySLAStatus === "overdue",
    queue_wait_secs: readNumber(row, "queue_wait_secs"),
    queue_wait_text: readString(row, "queue_wait_text"),
    reply_overdue: replySLAStatus === "overdue",
    reply_sla_status: replySLAStatus,
    matched_route_name: readString(row, "matched_route_name"),
    matched_route_id: readString(row, "matched_route_id"),
    current_status_summary: readString(row, "current_status_summary"),
    current_assigned_target_id: readString(row, "current_assigned_target_id"),
    current_assigned_target_tag: readString(row, "current_assigned_target_tag"),
    sync_state: readString(row, "sync_state"),
    latest_message_id: readString(row, "latest_message_id"),
    latest_message_occurred_at: readString(row, "latest_message_occurred_at"),
    last_routing_occurred_at: readString(row, "last_routing_occurred_at"),
    last_projection_event_id: readString(row, "last_projection_event_id"),
    last_projection_event_type: readString(row, "last_projection_event_type"),
    updated_at: readString(row, "updated_at"),
  };
}

function normalizeDetailDocument(
  value: unknown,
): CommandCenterSessionDetail | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  return {
    session: normalizeSession(readObject(row, "session")),
    entry_context: normalizeEntryContext(readObject(row, "entry_context")),
    routing_records: readArray(row, "routing_records")
      .map((item) => normalizeRoutingRecord(item))
      .filter(Boolean),
    messages: readArray(row, "messages")
      .map((item) => normalizeMessage(item))
      .filter(Boolean),
    monitor: normalizeMonitor(readObject(row, "monitor")),
    warnings: normalizeDisplayMeta(readObject(row, "display_meta"))?.warnings || [],
    status_bar: normalizeStatusBar(readObject(row, "status_bar")),
    display_meta: normalizeDisplayMeta(readObject(row, "display_meta")),
  };
}

function normalizeMessage(value: unknown): CommandCenterMessage | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  const id = readString(row, "message_id", "document_id", "id");
  if (!id && !readString(row, "occurred_at", "timestamp")) {
    return null;
  }
  const senderType = readString(row, "sender_type", "sender");
  const direction = readString(row, "direction");
  return {
    id,
    sender:
      senderType ||
      (direction === "inbound" || direction === "in" ? "customer" : "agent"),
    content: readString(row, "content_text", "content"),
    timestamp: readString(row, "occurred_at", "timestamp"),
    type: readString(row, "content_type", "type"),
    status: readString(row, "status"),
    delivery_status: readString(row, "delivery_status"),
    last_attempt_at: readString(row, "last_attempt_at"),
    delivered_at: readString(row, "delivered_at"),
    next_retry_at: readString(row, "next_retry_at"),
  };
}

function normalizeRoutingRecord(
  value: unknown,
): CommandCenterRoutingRecord | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  const occurredAt = readString(row, "occurred_at");
  if (!occurredAt && !readString(row, "record_id", "document_id")) {
    return null;
  }
  return {
    occurred_at: occurredAt,
    actor_type: readString(row, "actor_type"),
    actor_label: readString(row, "actor_label"),
    actor_userid: readString(row, "actor_user_id", "actor_userid"),
    action_text: readString(row, "action_text"),
    target_label: readString(row, "target_label"),
    target_userid: readString(row, "target_user_id", "target_userid"),
    details: {
      rule_id: readString(row, "rule_id"),
      dispatch_strategy_label: readString(row, "dispatch_strategy_label"),
      action_boundary_label: readString(row, "action_boundary_label"),
      execution_result_label: readString(row, "execution_result_label"),
      result_state_label: readString(row, "result_state_label"),
      rule_name: readString(row, "rule_name"),
      target_label: readString(row, "target_label"),
      target_userid: readString(row, "target_user_id", "target_userid"),
      trigger_label: readString(row, "trigger_label"),
      reason_summary: readString(row, "reason_summary"),
      trace_id: readString(row, "trace_id"),
      target_raw_servicer_userid: readString(
        row,
        "target_raw_servicer_user_id",
        "target_raw_servicer_userid",
      ),
    },
  };
}

function normalizeMonitor(value: unknown): CommandCenterMonitor | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  const emotion = asRecord(readObject(row, "emotion"));
  const summaryDetail = asRecord(readObject(row, "summary_detail"));
  const compliance = asRecord(readObject(row, "compliance"));
  const meta = asRecord(readObject(row, "meta"));
  return {
    document_id: readString(row, "document_id"),
    corp_id: readString(row, "corp_id"),
    open_kfid: readString(row, "open_kfid"),
    external_user_id: readString(row, "external_user_id"),
    mood: readString(row, "mood"),
    summary: readString(row, "summary"),
    compliance_pass: readBoolean(row, "compliance_pass"),
    emotion: emotion
      ? {
          code: readString(emotion, "code"),
          label: readString(emotion, "label"),
          score: readNumber(emotion, "score"),
          risk_level: readString(emotion, "risk_level"),
          reason: readString(emotion, "reason"),
        }
      : undefined,
    summary_detail: summaryDetail
      ? {
          text: readString(summaryDetail, "text"),
          customer_intent: readString(summaryDetail, "customer_intent"),
          priority: readString(summaryDetail, "priority"),
          suggested_focus: readString(summaryDetail, "suggested_focus"),
        }
      : undefined,
    compliance: compliance
      ? {
          status: readString(compliance, "status"),
          risk_tags: readStringArray(compliance, "risk_tags"),
          reason: readString(compliance, "reason"),
          recommended_action: readString(compliance, "recommended_action"),
        }
      : undefined,
    meta: meta
      ? {
          status: readString(meta, "status"),
          model: readString(meta, "model"),
          analyzed_at: readString(meta, "analyzed_at"),
          memory_version: readNumber(meta, "memory_version"),
          source_message_start_id: readString(meta, "source_message_start_id"),
          source_message_end_id: readString(meta, "source_message_end_id"),
          source_message_count: readNumber(meta, "source_message_count"),
          is_stale: readBoolean(meta, "is_stale"),
          running_task_id: readNumber(meta, "running_task_id"),
          failure_message: readString(meta, "failure_message"),
        }
      : undefined,
    source_event_id: readString(row, "source_event_id"),
    source_event_type: readString(row, "source_event_type"),
    updated_at: readString(row, "updated_at"),
  };
}

function normalizeStatusBar(value: unknown): CommandCenterStatusBar | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  return {
    session_label: readString(row, "session_label"),
    state_bucket: readString(row, "state_bucket"),
    assigned_user_id: readString(row, "assigned_user_id"),
    assigned_display: readString(row, "assigned_display"),
    queue_wait_text: readString(row, "queue_wait_text"),
    reply_sla_status: readString(row, "reply_sla_status"),
    matched_route_name: readString(row, "matched_route_name"),
    source_display_name: readString(row, "source_display_name"),
    entry_source_label: readString(row, "entry_source_label"),
    sync_state: readString(row, "sync_state"),
  };
}

function normalizeEntryContext(value: unknown): CommandCenterEntryContext | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  return {
    scene: readString(row, "scene"),
    scene_param: readString(row, "scene_param"),
    wechat_channels_nickname: readString(row, "wechat_channels_nickname"),
    welcome_code: readString(row, "welcome_code"),
  };
}

function normalizeDisplayMeta(value: unknown): CommandCenterDisplayMeta | null {
  const row = asRecord(value);
  if (!row) {
    return null;
  }
  return {
    warnings: readStringArray(row, "warnings"),
    last_event_id: readString(row, "last_event_id"),
    last_event_type: readString(row, "last_event_type"),
    last_payload_hash: readString(row, "last_payload_hash"),
  };
}

function upsertSession(
  sessions: CommandCenterSession[],
  nextSession: CommandCenterSession | null,
): CommandCenterSession[] {
  if (!nextSession?.external_userid) {
    return sessions;
  }
  const targetID = nextSession.external_userid.trim();
  const next = sessions.slice();
  const index = next.findIndex(
    (item) => (item.external_userid || "").trim() === targetID,
  );
  if (index >= 0) {
    next[index] = {
      ...next[index],
      ...nextSession,
    };
    return next;
  }
  return [nextSession, ...next];
}

function upsertMessage(
  messages: CommandCenterMessage[],
  nextMessage: CommandCenterMessage,
): CommandCenterMessage[] {
  const messageID = (nextMessage.id || "").trim();
  if (!messageID) {
    return [...messages, nextMessage];
  }
  const next = messages.slice();
  const index = next.findIndex((item) => (item.id || "").trim() === messageID);
  if (index >= 0) {
    next[index] = {
      ...next[index],
      ...nextMessage,
    };
    return next;
  }
  return [...next, nextMessage];
}

function upsertRoutingRecord(
  routingRecords: CommandCenterRoutingRecord[],
  nextRecord: CommandCenterRoutingRecord,
): CommandCenterRoutingRecord[] {
  const targetKey = [
    nextRecord.occurred_at,
    nextRecord.actor_userid,
    nextRecord.actor_label,
    nextRecord.action_text,
  ]
    .join("|")
    .trim();
  if (!targetKey) {
    return routingRecords;
  }
  const next = routingRecords.slice();
  const index = next.findIndex((item) => {
    const key = [
      item.occurred_at,
      item.actor_userid,
      item.actor_label,
      item.action_text,
    ]
      .join("|")
      .trim();
    return key === targetKey;
  });
  if (index >= 0) {
    next[index] = {
      ...next[index],
      ...nextRecord,
      details: {
        ...(next[index].details || {}),
        ...(nextRecord.details || {}),
      },
    };
    return next;
  }
  return [nextRecord, ...next];
}

function selectCurrentSession(
  state: CommandCenterState,
): CommandCenterSession | undefined {
  return selectSessionByExternalUserID(state.sessions, state.selectedExternalUserID);
}

function selectSessionByExternalUserID(
  sessions: CommandCenterSession[],
  externalUserID: string,
): CommandCenterSession | undefined {
  const targetID = (externalUserID || "").trim();
  if (!targetID) {
    return sessions[0];
  }
  return (
    sessions.find((item) => (item.external_userid || "").trim() === targetID) ||
    sessions[0]
  );
}

function countBucket(
  sessions: CommandCenterSession[],
  bucket: SessionTab,
): number {
  return sessions.filter((item) => {
    const stateBucket = (item.state_bucket || "").trim().toLowerCase();
    if (stateBucket === bucket) {
      return true;
    }
    const state = Number(item.session_state || 0);
    if (bucket === "active") return state === 3;
    if (bucket === "closed") return state === 4;
    return state === 1 || state === 2;
  }).length;
}

function pickInitialActiveTab(
  sessions: CommandCenterSession[],
): SessionTab {
  if (countBucket(sessions, "queue") > 0) {
    return "queue";
  }
  if (countBucket(sessions, "active") > 0) {
    return "active";
  }
  if (countBucket(sessions, "closed") > 0) {
    return "closed";
  }
  return "queue";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readObject(
  row: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  return asRecord(row[key]);
}

function readArray(
  row: Record<string, unknown>,
  key: string,
): unknown[] {
  const value = row[key];
  return Array.isArray(value) ? value : [];
}

function readString(
  row: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return "";
}

function readNumber(
  row: Record<string, unknown>,
  key: string,
): number {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function readBoolean(
  row: Record<string, unknown>,
  key: string,
): boolean {
  const value = row[key];
  return value === true;
}

function readStringArray(
  row: Record<string, unknown>,
  key: string,
): string[] {
  const value = row[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}
