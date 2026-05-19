import { requestJSON } from "./http";

type APIReply<T> = {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
};

export type ToolbarRPARunInfo = {
  run_id?: string;
  title?: string;
  source?: string;
  status?: string;
  current_sequence?: number;
  total_session_tasks?: number;
  completed_session_tasks?: number;
  total_message_tasks?: number;
  confirmed_message_tasks?: number;
  need_manual_message_tasks?: number;
  failed_message_tasks?: number;
  current_session_task_id?: string;
  current_message_task_id?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  version?: number;
};

export type ToolbarRPASessionTask = {
  session_task_id?: string;
  sequence?: number;
  status?: string;
  open_kfid?: string;
  external_userid?: string;
  contact_name?: string;
  channel_label?: string;
  message_text?: string;
  message_hash?: string;
  error_code?: string;
  error_message?: string;
  current_message_task_id?: string;
  total_messages?: number;
  confirmed_messages?: number;
  need_manual_messages?: number;
  failed_messages?: number;
};

export type ToolbarRPAMessageTask = {
  message_task_id?: string;
  session_task_id?: string;
  run_id?: string;
  send_order?: number;
  status?: string;
  text?: string;
  message_preview?: string;
  message_hash?: string;
  dispatch_request_id?: string;
  rpa_ack_event_id?: string;
  rpa_client_id?: string;
  error_code?: string;
  error_message?: string;
};

export type ToolbarRPAReviewManualItem = {
  kind?: "review" | "manual" | string;
  session_task_id?: string;
  message_task_id?: string;
  status?: string;
  open_kfid?: string;
  external_userid?: string;
  contact_name?: string;
  channel_label?: string;
  message_preview?: string;
  message_hash?: string;
  reason?: string;
};

export type ToolbarRPADraftMessage = {
  message_id?: string;
  order?: number;
  text?: string;
  message_hash?: string;
};

export type ToolbarRPAAction = {
  type?:
    | "fill_current_message"
    | "navigate_to_chat"
    | "idle_poll"
    | "need_manual"
    | "wait_rpa_ack"
    | "wait_wecom_confirm"
    | "review_auto_resend"
    | "completed"
    | string;
  task_id?: string;
  message_task_id?: string;
  session_task_id?: string;
  target?: {
    open_kfid?: string;
    external_userid?: string;
    display_name?: string;
    channel_label?: string;
  };
  message?: ToolbarRPADraftMessage;
  messages?: ToolbarRPADraftMessage[];
  execution?: {
    fill_interval_ms?: number;
    send_interval_ms?: number;
    timeout_ms?: number;
  };
  reason?: string;
  poll_after_ms?: number;
  error_code?: string;
};

export type ToolbarRPAAutomationState = {
  status?: "active" | "pausing" | "paused" | "stopped" | string;
  enabled?: boolean;
  bound?: boolean;
  bound_rpa_client_id?: string;
  can_enter_auto_mode?: boolean;
  binding_required?: boolean;
  paused?: boolean;
  stop_reason?: string;
  pause_deadline_at?: string;
  updated_at?: string;
};

export type ToolbarRPASendQueueItem = {
  prepared_reply_id?: string;
  open_kfid?: string;
  external_userid?: string;
  contact_name?: string;
  channel_label?: string;
  reply_preview?: string;
  reply_count?: number;
  prepared_at?: string;
};

export type ToolbarRPASendQueuePreview = {
  total?: number;
  items?: ToolbarRPASendQueueItem[];
};

export type ToolbarRPAReviewQueueItem = {
  queue_entry_id?: string;
  source_type?: string;
  source_status?: string;
  open_kfid?: string;
  external_userid?: string;
  contact_name?: string;
  channel_label?: string;
  message_preview?: string;
  reason?: string;
  queued_at?: string;
  prepared_reply_id?: string;
  session_task_id?: string;
  message_task_id?: string;
};

export type ToolbarRPAReviewQueuePreview = {
  total?: number;
  items?: ToolbarRPAReviewQueueItem[];
};

export type ToolbarRPABootstrap = {
  mode?: "normal" | "rpa" | string;
  enabled?: boolean;
  status?: string;
  automation?: ToolbarRPAAutomationState | null;
  send_queue_preview?: ToolbarRPASendQueuePreview | null;
  review_queue_preview?: ToolbarRPAReviewQueuePreview | null;
  run?: ToolbarRPARunInfo;
  session_task?: ToolbarRPASessionTask;
  message_task?: ToolbarRPAMessageTask;
  pending_session_tasks?: ToolbarRPASessionTask[];
  completed_session_tasks?: ToolbarRPASessionTask[];
  action?: ToolbarRPAAction;
  phase?: string;
  can_pause?: boolean;
  can_resume?: boolean;
  can_skip?: boolean;
  can_retry?: boolean;
  can_stop?: boolean;
  poll_after_ms?: number;
  server_time?: string;
  request_id?: string;
  paused_auto_stop_remaining_ms?: number;
  queue_summary?: RPAStateSnapshot["queue_summary"];
  current_session?: RPAStateSnapshot["current_session"];
  target_session?: RPAStateSnapshot["target_session"];
  navigation?: RPAStateSnapshot["navigation"];
  review_manual?: RPAStateSnapshot["review_manual"];
  version?: number;
  source?: string;
  stream_ready?: boolean;
  operator_view?: ToolbarRPAOperatorView | null;
};

export type ToolbarRPAOperatorTaskView = {
  session?: RPAStateSnapshot["target_session"] | null;
  message?: RPAStateSnapshot["message_task"] | null;
  target?: ToolbarRPAAction["target"] | null;
};

export type ToolbarRPAOperatorAutomationView = {
  status?: "active" | "pausing" | "paused" | "stopped" | string;
  enabled?: boolean;
  bound?: boolean;
  bound_rpa_client_id?: string;
  binding_required?: boolean;
  can_enter_auto_mode?: boolean;
  stop_reason?: string;
  pause_deadline_at?: string;
  updated_at?: string;
};

export type ToolbarRPAOperatorDisplay = {
  state?:
    | "idle_poll"
    | "navigate_to_chat"
    | "fill_current_message"
    | "wait_rpa_ack"
    | "wait_wecom_confirm"
    | "review_auto_resend"
    | "completed"
    | "stopped"
    | "need_manual"
    | "paused"
    | string;
  reason?: string;
  hold_until?: string;
  next_state_after_hold?: string;
};

export type ToolbarRPAOperatorView = {
  schema?: string;
  corp_id?: string;
  user_id?: string;
  generated_at?: string;
  automation?: ToolbarRPAOperatorAutomationView | null;
  display?: ToolbarRPAOperatorDisplay | null;
  run?: ToolbarRPARunInfo | null;
  current_task?: ToolbarRPAOperatorTaskView | null;
  next_queued_task?: ToolbarRPAOperatorTaskView | null;
  after_hold_view?: ToolbarRPAOperatorView | null;
  queue_summary?: RPAStateSnapshot["queue_summary"];
  review_manual?: RPAStateSnapshot["review_manual"];
  send_queue_preview?: ToolbarRPASendQueuePreview | null;
  review_queue_preview?: ToolbarRPAReviewQueuePreview | null;
  rpa_state?: RPAStateSnapshot | null;
};

export type ToolbarRPAOperatorProjection = {
  corp_id?: string;
  user_id?: string;
  source_event_id?: string;
};

export type ToolbarRPAOperatorBootstrapData = {
  version?: number;
  source?: string;
  projection?: ToolbarRPAOperatorProjection | null;
  view?: ToolbarRPAOperatorView | Record<string, unknown> | null;
  updated_at?: string;
  stream_ready?: boolean;
};

export type ToolbarRPAOperatorStreamEvent = {
  event_id?: string;
  corp_id?: string;
  user_id?: string;
  version?: number;
  event_type?: string;
  source_event_id?: string;
  occurred_at?: string;
  view?: ToolbarRPAOperatorView | Record<string, unknown> | null;
};

export type ToolbarRPAOperatorStreamEnvelope = {
  code?: number;
  message?: string;
  latest_version?: number;
  request_id?: string;
  events?: ToolbarRPAOperatorStreamEvent[];
};

export type RPAStateSnapshot = {
  mode?: "normal" | "rpa" | string;
  enabled?: boolean;
  status?: string;
  run?: ToolbarRPARunInfo | null;
  queue_summary?: {
    pending_runs?: number;
    pending_session_tasks?: number;
    pending_message_tasks?: number;
    preparing_replies?: number;
    ready_prepared_replies?: number;
    review_required_replies?: number;
    total_pending?: number;
  } | null;
  current_session?: {
    session_task_id?: string;
    status?: string;
    open_kfid?: string;
    external_userid?: string;
    contact_name?: string;
    channel_label?: string;
  } | null;
  target_session?: {
    session_task_id?: string;
    status?: string;
    open_kfid?: string;
    external_userid?: string;
    contact_name?: string;
    channel_label?: string;
  } | null;
  message_task?: {
    message_task_id?: string;
    status?: string;
    send_order?: number;
    text?: string;
    message_preview?: string;
    message_hash?: string;
  } | null;
  action?: {
    type?: string;
    target?: {
      open_kfid?: string;
      external_userid?: string;
      display_name?: string;
      channel_label?: string;
    } | null;
    poll_after_ms?: number;
    reason?: string;
  } | null;
  navigation?: {
    required?: boolean;
    already_matched?: boolean;
    delay_ms?: number;
    flash_count?: number;
  } | null;
  review_manual?: {
    review_session_tasks?: number;
    review_message_tasks?: number;
    manual_session_tasks?: number;
    manual_message_tasks?: number;
    total?: number;
    items?: ToolbarRPAReviewManualItem[];
  } | null;
  automation?: ToolbarRPAAutomationState | null;
  can_pause?: boolean;
  can_resume?: boolean;
  can_skip?: boolean;
  can_retry?: boolean;
  can_stop?: boolean;
  server_time?: string;
  request_id?: string;
  paused_auto_stop_remaining_ms?: number;
  send_queue_preview?: ToolbarRPASendQueuePreview | null;
  review_queue_preview?: ToolbarRPAReviewQueuePreview | null;
};

export type ToolbarRPAOperatorBinding = {
  corp_id?: string;
  user_id?: string;
  rpa_client_id?: string;
  source?: string;
  status?: string;
  bound_at?: string;
  updated_at?: string;
  auto_mode_enabled?: boolean;
};

export type ToolbarRPAOperatorBindingSnapshot = {
  bound?: boolean;
  binding?: ToolbarRPAOperatorBinding | null;
  automation?: ToolbarRPAAutomationState | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readField<T = unknown>(
  value: unknown,
  ...keys: string[]
): T | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key] as T;
    }
  }
  return undefined;
}

function readString(value: unknown, ...keys: string[]): string | undefined {
  const raw = readField<unknown>(value, ...keys);
  return typeof raw === "string" ? raw : undefined;
}

function readNumber(value: unknown, ...keys: string[]): number | undefined {
  const raw = readField<unknown>(value, ...keys);
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return undefined;
}

function readBoolean(value: unknown, ...keys: string[]): boolean | undefined {
  const raw = readField<unknown>(value, ...keys);
  return typeof raw === "boolean" ? raw : undefined;
}

function normalizeQueueSummary(
  value: unknown,
): RPAStateSnapshot["queue_summary"] {
  const record = asRecord(value);
  if (!record) return null;
  return {
    pending_runs: readNumber(record, "pending_runs", "PendingRuns"),
    pending_session_tasks: readNumber(
      record,
      "pending_session_tasks",
      "PendingSessionTasks",
    ),
    pending_message_tasks: readNumber(
      record,
      "pending_message_tasks",
      "PendingMessageTasks",
    ),
    preparing_replies: readNumber(
      record,
      "preparing_replies",
      "PreparingReplies",
    ),
    ready_prepared_replies: readNumber(
      record,
      "ready_prepared_replies",
      "ReadyPreparedReplies",
    ),
    review_required_replies: readNumber(
      record,
      "review_required_replies",
      "ReviewRequiredReplies",
    ),
    total_pending: readNumber(record, "total_pending", "TotalPending"),
  };
}

function normalizeSession(value: unknown): RPAStateSnapshot["current_session"] {
  const record = asRecord(value);
  if (!record) return null;
  return {
    session_task_id: readString(record, "session_task_id", "SessionTaskID"),
    status: readString(record, "status", "Status"),
    open_kfid: readString(record, "open_kfid", "OpenKFID"),
    external_userid: readString(record, "external_userid", "ExternalUserID"),
    contact_name: readString(record, "contact_name", "ContactName"),
    channel_label: readString(record, "channel_label", "ChannelLabel"),
  };
}

function normalizeMessageTask(
  value: unknown,
): RPAStateSnapshot["message_task"] {
  const record = asRecord(value);
  if (!record) return null;
  return {
    message_task_id: readString(record, "message_task_id", "MessageTaskID"),
    status: readString(record, "status", "Status"),
    send_order: readNumber(record, "send_order", "SendOrder"),
    text: readString(record, "text", "Text"),
    message_preview: readString(
      record,
      "message_preview",
      "MessagePreview",
      "text",
      "Text",
    ),
    message_hash: readString(record, "message_hash", "MessageHash"),
  };
}

function normalizeActionTarget(
  value: unknown,
): NonNullable<RPAStateSnapshot["action"]>["target"] {
  const record = asRecord(value);
  if (!record) return null;
  return {
    open_kfid: readString(record, "open_kfid", "OpenKFID"),
    external_userid: readString(record, "external_userid", "ExternalUserID"),
    display_name: readString(record, "display_name", "DisplayName"),
    channel_label: readString(record, "channel_label", "ChannelLabel"),
  };
}

function normalizeNavigation(value: unknown): RPAStateSnapshot["navigation"] {
  const record = asRecord(value);
  if (!record) return null;
  return {
    required: readBoolean(record, "required", "Required"),
    already_matched: readBoolean(record, "already_matched", "AlreadyMatched"),
    delay_ms: readNumber(record, "delay_ms", "DelayMS"),
    flash_count: readNumber(record, "flash_count", "FlashCount"),
  };
}

function normalizeReviewManualItem(
  value: unknown,
): ToolbarRPAReviewManualItem | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    kind: readString(record, "kind", "Kind"),
    session_task_id: readString(record, "session_task_id", "SessionTaskID"),
    message_task_id: readString(record, "message_task_id", "MessageTaskID"),
    status: readString(record, "status", "Status"),
    open_kfid: readString(record, "open_kfid", "OpenKFID"),
    external_userid: readString(record, "external_userid", "ExternalUserID"),
    contact_name: readString(record, "contact_name", "ContactName"),
    channel_label: readString(record, "channel_label", "ChannelLabel"),
    message_preview: readString(record, "message_preview", "MessagePreview"),
    message_hash: readString(record, "message_hash", "MessageHash"),
    reason: readString(record, "reason", "Reason"),
  };
}

function normalizeReviewManual(
  value: unknown,
): RPAStateSnapshot["review_manual"] {
  const record = asRecord(value);
  if (!record) return null;
  const rawItems = readField<unknown[]>(record, "items", "Items") || [];
  return {
    review_session_tasks: readNumber(
      record,
      "review_session_tasks",
      "ReviewSessionTasks",
    ),
    review_message_tasks: readNumber(
      record,
      "review_message_tasks",
      "ReviewMessageTasks",
    ),
    manual_session_tasks: readNumber(
      record,
      "manual_session_tasks",
      "ManualSessionTasks",
    ),
    manual_message_tasks: readNumber(
      record,
      "manual_message_tasks",
      "ManualMessageTasks",
    ),
    total: readNumber(record, "total", "Total"),
    items: rawItems
      .map((item) => normalizeReviewManualItem(item))
      .filter(Boolean) as ToolbarRPAReviewManualItem[],
  };
}

function normalizeAutomation(value: unknown): ToolbarRPAAutomationState | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    status: readString(record, "status", "Status"),
    enabled: readBoolean(record, "enabled", "Enabled"),
    bound: readBoolean(record, "bound", "Bound"),
    bound_rpa_client_id: readString(
      record,
      "bound_rpa_client_id",
      "BoundRPAClientID",
    ),
    can_enter_auto_mode: readBoolean(
      record,
      "can_enter_auto_mode",
      "CanEnterAutoMode",
    ),
    binding_required: readBoolean(
      record,
      "binding_required",
      "BindingRequired",
    ),
    paused: readBoolean(record, "paused", "Paused"),
    stop_reason: readString(record, "stop_reason", "StopReason"),
    pause_deadline_at: readString(
      record,
      "pause_deadline_at",
      "PauseDeadlineAt",
    ),
    updated_at: readString(record, "updated_at", "UpdatedAt"),
  };
}

function normalizeRunInfo(value: unknown): ToolbarRPARunInfo | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  return {
    run_id: readString(record, "run_id", "RunID"),
    status: readString(record, "status", "Status"),
    total_session_tasks: readNumber(
      record,
      "total_session_tasks",
      "TotalSessionTasks",
    ),
    completed_session_tasks: readNumber(
      record,
      "completed_session_tasks",
      "CompletedSessionTasks",
    ),
    total_message_tasks: readNumber(
      record,
      "total_message_tasks",
      "TotalMessageTasks",
    ),
    confirmed_message_tasks: readNumber(
      record,
      "confirmed_message_tasks",
      "ConfirmedMessageTasks",
    ),
    need_manual_message_tasks: readNumber(
      record,
      "need_manual_message_tasks",
      "NeedManualMessageTasks",
    ),
    failed_message_tasks: readNumber(
      record,
      "failed_message_tasks",
      "FailedMessageTasks",
    ),
    version: readNumber(record, "version", "Version"),
  };
}

function normalizeSendQueueItem(
  value: unknown,
): ToolbarRPASendQueueItem | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    prepared_reply_id: readString(
      record,
      "prepared_reply_id",
      "PreparedReplyID",
    ),
    open_kfid: readString(record, "open_kfid", "OpenKFID"),
    external_userid: readString(record, "external_userid", "ExternalUserID"),
    contact_name: readString(record, "contact_name", "ContactName"),
    channel_label: readString(record, "channel_label", "ChannelLabel"),
    reply_preview: readString(record, "reply_preview", "ReplyPreview"),
    reply_count: readNumber(record, "reply_count", "ReplyCount"),
    prepared_at: readString(record, "prepared_at", "PreparedAt"),
  };
}

function normalizeSendQueuePreview(
  value: unknown,
): ToolbarRPASendQueuePreview | null {
  const record = asRecord(value);
  if (!record) return null;
  const rawItems = readField<unknown[]>(record, "items", "Items") || [];
  return {
    total: readNumber(record, "total", "Total"),
    items: rawItems
      .map((item) => normalizeSendQueueItem(item))
      .filter(Boolean) as ToolbarRPASendQueueItem[],
  };
}

function normalizeReviewQueueItem(
  value: unknown,
): ToolbarRPAReviewQueueItem | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    queue_entry_id: readString(record, "queue_entry_id", "QueueEntryID"),
    source_type: readString(record, "source_type", "SourceType"),
    source_status: readString(record, "source_status", "SourceStatus"),
    open_kfid: readString(record, "open_kfid", "OpenKFID"),
    external_userid: readString(record, "external_userid", "ExternalUserID"),
    contact_name: readString(record, "contact_name", "ContactName"),
    channel_label: readString(record, "channel_label", "ChannelLabel"),
    message_preview: readString(record, "message_preview", "MessagePreview"),
    reason: readString(record, "reason", "Reason"),
    queued_at: readString(record, "queued_at", "QueuedAt"),
    prepared_reply_id: readString(
      record,
      "prepared_reply_id",
      "PreparedReplyID",
    ),
    session_task_id: readString(record, "session_task_id", "SessionTaskID"),
    message_task_id: readString(record, "message_task_id", "MessageTaskID"),
  };
}

function normalizeReviewQueuePreview(
  value: unknown,
): ToolbarRPAReviewQueuePreview | null {
  const record = asRecord(value);
  if (!record) return null;
  const rawItems = readField<unknown[]>(record, "items", "Items") || [];
  return {
    total: readNumber(record, "total", "Total"),
    items: rawItems
      .map((item) => normalizeReviewQueueItem(item))
      .filter(Boolean) as ToolbarRPAReviewQueueItem[],
  };
}

function normalizeStateLike(state: unknown): RPAStateSnapshot | null {
  const record = asRecord(state);
  if (!record) return null;
  return {
    mode: readString(record, "mode", "Mode"),
    enabled: readBoolean(record, "enabled", "Enabled"),
    status: readString(record, "status", "Status"),
    run: normalizeRunInfo(readField(record, "run", "Run")) || null,
    queue_summary: normalizeQueueSummary(
      readField(record, "queue_summary", "QueueSummary"),
    ),
    current_session: normalizeSession(
      readField(record, "current_session", "CurrentSession"),
    ),
    target_session: normalizeSession(
      readField(record, "target_session", "TargetSession"),
    ),
    message_task: normalizeMessageTask(
      readField(record, "message_task", "MessageTask"),
    ),
    action: {
      type: readString(readField(record, "action", "Action"), "type", "Type"),
      target: normalizeActionTarget(
        readField(readField(record, "action", "Action"), "target", "Target"),
      ),
      poll_after_ms: readNumber(
        readField(record, "action", "Action"),
        "poll_after_ms",
        "PollAfterMS",
      ),
      reason: readString(
        readField(record, "action", "Action"),
        "reason",
        "Reason",
      ),
    },
    navigation: normalizeNavigation(
      readField(record, "navigation", "Navigation"),
    ),
    review_manual: normalizeReviewManual(
      readField(record, "review_manual", "ReviewManual"),
    ),
    automation: normalizeAutomation(
      readField(record, "automation", "Automation"),
    ),
    can_pause: readBoolean(record, "can_pause", "CanPause"),
    can_resume: readBoolean(record, "can_resume", "CanResume"),
    can_skip: readBoolean(record, "can_skip", "CanSkip"),
    can_retry: readBoolean(record, "can_retry", "CanRetry"),
    can_stop: readBoolean(record, "can_stop", "CanStop"),
    server_time: readString(record, "server_time", "ServerTime"),
    request_id: readString(record, "request_id", "RequestID"),
    paused_auto_stop_remaining_ms: readNumber(
      record,
      "paused_auto_stop_remaining_ms",
      "PausedAutoStopRemainingMS",
    ),
    send_queue_preview: normalizeSendQueuePreview(
      readField(record, "send_queue_preview", "SendQueuePreview"),
    ),
    review_queue_preview: normalizeReviewQueuePreview(
      readField(record, "review_queue_preview", "ReviewQueuePreview"),
    ),
  };
}

function normalizeRPAStateSnapshot(
  state?: RPAStateSnapshot | null,
): ToolbarRPABootstrap | null {
  const normalizedState = normalizeStateLike(state);
  if (!normalizedState) return null;
  state = normalizedState;
  const targetSession = state.target_session || state.current_session || null;
  const messageTask = state.message_task || null;
  const messageText = (
    messageTask?.text ||
    messageTask?.message_preview ||
    ""
  ).trim();
  const actionTarget = state.action?.target || {
    open_kfid: targetSession?.open_kfid || "",
    external_userid: targetSession?.external_userid || "",
    display_name: targetSession?.contact_name || "",
    channel_label: targetSession?.channel_label || "",
  };
  const sessionTaskID = (
    targetSession?.session_task_id ||
    state.current_session?.session_task_id ||
    ""
  ).trim();
  const messageTaskID = (messageTask?.message_task_id || "").trim();
  const action: ToolbarRPAAction = {
    type: state.action?.type || "idle_poll",
    task_id: messageTaskID || sessionTaskID,
    message_task_id: messageTaskID,
    session_task_id: sessionTaskID,
    target: actionTarget || undefined,
    reason: state.action?.reason || "",
    poll_after_ms: state.action?.poll_after_ms || 0,
  };
  if (messageText || messageTask?.message_hash) {
    action.message = {
      message_id: messageTaskID,
      order: messageTask?.send_order || 0,
      text: messageText,
      message_hash: messageTask?.message_hash || "",
    };
    action.messages = [action.message];
  }
  const reviewManualItems = state.review_manual?.items || [];
  return {
    mode: state.mode,
    enabled: state.enabled,
    automation: state.automation || null,
    run: state.run || undefined,
    session_task: targetSession
      ? {
          session_task_id: targetSession.session_task_id,
          status: targetSession.status,
          open_kfid: targetSession.open_kfid,
          external_userid: targetSession.external_userid,
          contact_name: targetSession.contact_name,
          channel_label: targetSession.channel_label,
          current_message_task_id: messageTaskID,
        }
      : undefined,
    message_task: messageTask
      ? {
          message_task_id: messageTask.message_task_id,
          session_task_id: sessionTaskID,
          run_id: state.run?.run_id,
          send_order: messageTask.send_order,
          status: messageTask.status,
          text: messageText,
          message_hash: messageTask.message_hash,
        }
      : undefined,
    pending_session_tasks: reviewManualItems.map((item) => ({
      session_task_id: item.session_task_id,
      status: item.status,
      open_kfid: item.open_kfid,
      external_userid: item.external_userid,
      contact_name: item.contact_name,
      channel_label: item.channel_label,
      message_text: item.message_preview,
      message_hash: item.message_hash,
      error_message: item.reason,
      current_message_task_id: item.message_task_id,
    })),
    completed_session_tasks: [],
    action,
    phase: state.action?.type || state.status || "",
    can_pause: state.can_pause,
    can_resume: state.can_resume,
    can_skip: state.can_skip,
    can_retry: state.can_retry,
    can_stop: state.can_stop,
    poll_after_ms: state.action?.poll_after_ms || 0,
    server_time: state.server_time,
    request_id: state.request_id,
    paused_auto_stop_remaining_ms: state.paused_auto_stop_remaining_ms || 0,
    send_queue_preview: state.send_queue_preview || null,
    review_queue_preview: state.review_queue_preview || null,
    queue_summary: state.queue_summary || null,
    current_session: state.current_session || null,
    target_session: state.target_session || null,
    navigation: state.navigation || null,
    review_manual: state.review_manual || null,
    status: state.status,
  };
}

function normalizeToolbarRPAOperatorView(
  view?: ToolbarRPAOperatorView | Record<string, unknown> | null,
): ToolbarRPAOperatorView | null {
  const record = asRecord(view);
  if (!record) return null;
  return {
    schema: readString(record, "schema", "Schema"),
    corp_id: readString(record, "corp_id", "CorpID"),
    user_id: readString(record, "user_id", "UserID"),
    generated_at: readString(record, "generated_at", "GeneratedAt"),
    automation: ((): ToolbarRPAOperatorAutomationView | null => {
      const automation = asRecord(
        readField(record, "automation", "Automation"),
      );
      if (!automation) return null;
      return {
        status: readString(automation, "status", "Status"),
        enabled: readBoolean(automation, "enabled", "Enabled"),
        bound: readBoolean(automation, "bound", "Bound"),
        bound_rpa_client_id: readString(
          automation,
          "bound_rpa_client_id",
          "BoundRPAClientID",
        ),
        binding_required: readBoolean(
          automation,
          "binding_required",
          "BindingRequired",
        ),
        can_enter_auto_mode: readBoolean(
          automation,
          "can_enter_auto_mode",
          "CanEnterAutoMode",
        ),
        stop_reason: readString(automation, "stop_reason", "StopReason"),
        pause_deadline_at: readString(
          automation,
          "pause_deadline_at",
          "PauseDeadlineAt",
        ),
        updated_at: readString(automation, "updated_at", "UpdatedAt"),
      };
    })(),
    display: ((): ToolbarRPAOperatorDisplay | null => {
      const display = asRecord(readField(record, "display", "Display"));
      if (!display) return null;
      return {
        state: readString(display, "state", "State"),
        reason: readString(display, "reason", "Reason"),
        hold_until: readString(display, "hold_until", "HoldUntil"),
        next_state_after_hold: readString(
          display,
          "next_state_after_hold",
          "NextStateAfterHold",
        ),
      };
    })(),
    run: normalizeRunInfo(readField(record, "run", "Run")) || null,
    current_task: ((): ToolbarRPAOperatorTaskView | null => {
      const task = asRecord(readField(record, "current_task", "CurrentTask"));
      if (!task) return null;
      return {
        session: normalizeSession(readField(task, "session", "Session")),
        message: normalizeMessageTask(readField(task, "message", "Message")),
        target: normalizeActionTarget(readField(task, "target", "Target")),
      };
    })(),
    next_queued_task: ((): ToolbarRPAOperatorTaskView | null => {
      const task = asRecord(
        readField(record, "next_queued_task", "NextQueuedTask"),
      );
      if (!task) return null;
      return {
        session: normalizeSession(readField(task, "session", "Session")),
        message: normalizeMessageTask(readField(task, "message", "Message")),
        target: normalizeActionTarget(readField(task, "target", "Target")),
      };
    })(),
    after_hold_view: normalizeToolbarRPAOperatorView(
      readField(record, "after_hold_view", "AfterHoldView") as
        | ToolbarRPAOperatorView
        | Record<string, unknown>
        | null,
    ),
    queue_summary: normalizeQueueSummary(
      readField(record, "queue_summary", "QueueSummary"),
    ),
    review_manual: normalizeReviewManual(
      readField(record, "review_manual", "ReviewManual"),
    ),
    send_queue_preview: normalizeSendQueuePreview(
      readField(record, "send_queue_preview", "SendQueuePreview"),
    ),
    review_queue_preview: normalizeReviewQueuePreview(
      readField(record, "review_queue_preview", "ReviewQueuePreview"),
    ),
    rpa_state: normalizeStateLike(readField(record, "rpa_state", "RPAState")),
  };
}

function normalizeToolbarRPAOperatorBootstrap(
  payload?: ToolbarRPAOperatorBootstrapData | null,
): ToolbarRPABootstrap | null {
  if (!payload) return null;
  const operatorView = normalizeToolbarRPAOperatorView(payload.view);
  const baseState = normalizeRPAStateSnapshot(
    operatorView?.rpa_state ||
      ((payload.view as Record<string, unknown> | null)?.[
        "rpa_state"
      ] as RPAStateSnapshot | null) ||
      null,
  );
  if (!baseState) {
    return {
      mode: "normal",
      enabled: Boolean(operatorView?.automation?.enabled),
      status: "",
      automation: operatorView?.automation
        ? {
            status: operatorView.automation.status,
            enabled: operatorView.automation.enabled,
            bound: operatorView.automation.bound,
            bound_rpa_client_id: operatorView.automation.bound_rpa_client_id,
            can_enter_auto_mode: operatorView.automation.can_enter_auto_mode,
            binding_required: operatorView.automation.binding_required,
            paused: operatorView.automation.status === "paused",
            stop_reason: operatorView.automation.stop_reason,
            pause_deadline_at: operatorView.automation.pause_deadline_at,
            updated_at: operatorView.automation.updated_at,
          }
        : null,
      send_queue_preview: operatorView?.send_queue_preview || null,
      review_queue_preview: operatorView?.review_queue_preview || null,
      queue_summary: operatorView?.queue_summary || null,
      review_manual: operatorView?.review_manual || null,
      version: Number(payload.version || 0),
      source: payload.source || "",
      stream_ready: Boolean(payload.stream_ready),
      operator_view: operatorView,
      server_time: payload.updated_at || "",
    };
  }
  const operatorAutomation = operatorView?.automation || null;
  return {
    ...baseState,
    enabled: operatorAutomation?.enabled ?? baseState.enabled,
    automation: operatorAutomation
      ? {
          status: operatorAutomation.status,
          enabled: operatorAutomation.enabled,
          bound: operatorAutomation.bound,
          bound_rpa_client_id: operatorAutomation.bound_rpa_client_id,
          can_enter_auto_mode: operatorAutomation.can_enter_auto_mode,
          binding_required: operatorAutomation.binding_required,
          paused: operatorAutomation.status === "paused",
          stop_reason: operatorAutomation.stop_reason,
          pause_deadline_at: operatorAutomation.pause_deadline_at,
          updated_at: operatorAutomation.updated_at,
        }
      : baseState.automation || null,
    version: Number(payload.version || 0),
    source: payload.source || "",
    stream_ready: Boolean(payload.stream_ready),
    operator_view: operatorView,
    server_time: baseState.server_time || payload.updated_at || "",
  };
}

export async function getKFToolbarRPABootstrap(params?: {
  run_id?: string;
  open_kfid?: string;
  external_userid?: string;
  force_fresh?: boolean;
}): Promise<ToolbarRPABootstrap | null> {
  const search = new URLSearchParams();
  if (params?.run_id) search.set("run_id", params.run_id);
  if (params?.open_kfid) search.set("open_kfid", params.open_kfid);
  if (params?.external_userid) {
    search.set("external_userid", params.external_userid);
  }
  if (params?.force_fresh) search.set("force_fresh", "true");
  const query = search.toString();
  const payload = await requestJSON<APIReply<ToolbarRPAOperatorBootstrapData>>(
    `/api/v1/kf/toolbar/rpa/bootstrap${query ? `?${query}` : ""}`,
  );
  return normalizeToolbarRPAOperatorBootstrap(payload?.data || null);
}

export async function markKFToolbarRPAMessageDraftFilled(
  messageTaskID: string,
  input: {
    run_id?: string;
    session_task_id?: string;
    idempotency_key?: string;
    current_open_kfid?: string;
    current_external_userid?: string;
    message_hash?: string;
  },
): Promise<ToolbarRPABootstrap | null> {
  const payload = await requestJSON<
    APIReply<RPAStateSnapshot | ToolbarRPAOperatorBootstrapData>
  >(
    `/api/v1/kf/toolbar/rpa/message-tasks/${encodeURIComponent(messageTaskID)}/draft-filled`,
    {
      method: "POST",
      body: JSON.stringify({
        run_id: input.run_id || "",
        session_task_id: input.session_task_id || "",
        idempotency_key: input.idempotency_key || "",
        current_open_kfid: input.current_open_kfid || "",
        current_external_userid: input.current_external_userid || "",
        message_hash: input.message_hash || "",
      }),
    },
  );
  const data = payload?.data as Record<string, unknown> | null;
  if (data && ("view" in data || "projection" in data || "source" in data)) {
    return normalizeToolbarRPAOperatorBootstrap(
      payload?.data as ToolbarRPAOperatorBootstrapData,
    );
  }
  return normalizeRPAStateSnapshot(payload?.data as RPAStateSnapshot | null);
}

export async function markKFToolbarRPAMessageFailed(
  messageTaskID: string,
  input: {
    run_id?: string;
    session_task_id?: string;
    idempotency_key?: string;
    error_code?: string;
    error_message?: string;
  },
): Promise<ToolbarRPABootstrap | null> {
  const payload = await requestJSON<
    APIReply<RPAStateSnapshot | ToolbarRPAOperatorBootstrapData>
  >(
    `/api/v1/kf/toolbar/rpa/message-tasks/${encodeURIComponent(messageTaskID)}/failed`,
    {
      method: "POST",
      body: JSON.stringify({
        run_id: input.run_id || "",
        session_task_id: input.session_task_id || "",
        idempotency_key: input.idempotency_key || "",
        error_code: input.error_code || "",
        error_message: input.error_message || "",
      }),
    },
  );
  const data = payload?.data as Record<string, unknown> | null;
  if (data && ("view" in data || "projection" in data || "source" in data)) {
    return normalizeToolbarRPAOperatorBootstrap(
      payload?.data as ToolbarRPAOperatorBootstrapData,
    );
  }
  return normalizeRPAStateSnapshot(payload?.data as RPAStateSnapshot | null);
}

export async function executeKFToolbarRPARunCommand(
  runID: string,
  input: {
    command:
      | "pause"
      | "resume"
      | "stop"
      | "skip_message"
      | "retry_message"
      | "skip_session"
      | "mark_manual_resolved"
      | string;
    session_task_id?: string;
    message_task_id?: string;
  },
): Promise<ToolbarRPABootstrap | null> {
  const payload = await requestJSON<
    APIReply<RPAStateSnapshot | ToolbarRPAOperatorBootstrapData>
  >(`/api/v1/kf/toolbar/rpa/runs/${encodeURIComponent(runID)}/commands`, {
    method: "POST",
    body: JSON.stringify({
      command: input.command || "",
      session_task_id: input.session_task_id || "",
      message_task_id: input.message_task_id || "",
    }),
  });
  const data = payload?.data as Record<string, unknown> | null;
  if (data && ("view" in data || "projection" in data || "source" in data)) {
    return normalizeToolbarRPAOperatorBootstrap(
      payload?.data as ToolbarRPAOperatorBootstrapData,
    );
  }
  return normalizeRPAStateSnapshot(payload?.data as RPAStateSnapshot | null);
}

export async function getKFToolbarRPAOperatorBinding(): Promise<ToolbarRPAOperatorBindingSnapshot | null> {
  const payload = await requestJSON<
    APIReply<ToolbarRPAOperatorBindingSnapshot>
  >("/api/v1/kf/toolbar/rpa/binding");
  return payload?.data || null;
}

export async function saveKFToolbarRPAOperatorBinding(
  rpaClientID: string,
): Promise<ToolbarRPAOperatorBindingSnapshot | null> {
  const payload = await requestJSON<
    APIReply<ToolbarRPAOperatorBindingSnapshot>
  >("/api/v1/kf/toolbar/rpa/binding", {
    method: "POST",
    body: JSON.stringify({
      rpa_client_id: rpaClientID || "",
    }),
  });
  return payload?.data || null;
}

export async function updateKFToolbarRPAAutomationMode(
  enabled: boolean,
): Promise<ToolbarRPAAutomationState | null> {
  const payload = await requestJSON<APIReply<ToolbarRPAAutomationState>>(
    "/api/v1/kf/toolbar/rpa/automation",
    {
      method: "POST",
      body: JSON.stringify({
        enabled,
      }),
    },
  );
  return payload?.data || null;
}

export async function listKFToolbarRPASendQueue(params?: {
  limit?: number;
  offset?: number;
}): Promise<ToolbarRPASendQueuePreview | null> {
  const search = new URLSearchParams();
  if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
    search.set("limit", String(params.limit));
  }
  if (typeof params?.offset === "number" && Number.isFinite(params.offset)) {
    search.set("offset", String(params.offset));
  }
  const query = search.toString();
  const payload = await requestJSON<APIReply<ToolbarRPASendQueuePreview>>(
    `/api/v1/kf/toolbar/rpa/send-queue${query ? `?${query}` : ""}`,
  );
  return normalizeSendQueuePreview(payload?.data || null);
}

export async function listKFToolbarRPAReviewQueue(params?: {
  limit?: number;
  offset?: number;
}): Promise<ToolbarRPAReviewQueuePreview | null> {
  const search = new URLSearchParams();
  if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
    search.set("limit", String(params.limit));
  }
  if (typeof params?.offset === "number" && Number.isFinite(params.offset)) {
    search.set("offset", String(params.offset));
  }
  const query = search.toString();
  const payload = await requestJSON<APIReply<ToolbarRPAReviewQueuePreview>>(
    `/api/v1/kf/toolbar/rpa/review-queue${query ? `?${query}` : ""}`,
  );
  return normalizeReviewQueuePreview(payload?.data || null);
}

export function openToolbarRPAOperatorViewStream(input: {
  since_version?: number;
  open_kfid?: string;
  external_userid?: string;
  onMessage: (payload: ToolbarRPAOperatorStreamEnvelope) => void;
  onError?: (event: Event) => void;
  onOpen?: () => void;
}): EventSource {
  const base =
    (import.meta.env.VITE_API_BASE_URL || "").trim() ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost");
  const url = new URL("/api/v1/kf/toolbar/rpa/stream", base);
  if (input.since_version && input.since_version > 0) {
    url.searchParams.set("since_version", String(input.since_version));
  }
  if (input.open_kfid) {
    url.searchParams.set("open_kfid", input.open_kfid);
  }
  if (input.external_userid) {
    url.searchParams.set("external_userid", input.external_userid);
  }
  const stream = new EventSource(url.toString(), { withCredentials: true });
  stream.addEventListener("toolbar_rpa_operator_view", (event) => {
    try {
      const payload = JSON.parse(
        String((event as MessageEvent).data || ""),
      ) as ToolbarRPAOperatorStreamEnvelope;
      input.onMessage(payload);
    } catch {
      // Ignore malformed payloads and keep the stream alive.
    }
  });
  if (input.onOpen) {
    stream.onopen = input.onOpen;
  }
  if (input.onError) {
    stream.onerror = input.onError;
  }
  return stream;
}

export function normalizeToolbarRPAOperatorStreamEvent(
  event?: ToolbarRPAOperatorStreamEvent | null,
): ToolbarRPABootstrap | null {
  if (!event) return null;
  return normalizeToolbarRPAOperatorBootstrap({
    version: Number(event.version || 0),
    source: event.event_type || "realtime_stream",
    projection: {
      corp_id: event.corp_id,
      user_id: event.user_id,
      source_event_id: event.source_event_id,
    },
    view: event.view || null,
    updated_at: event.occurred_at || "",
    stream_ready: true,
  });
}
