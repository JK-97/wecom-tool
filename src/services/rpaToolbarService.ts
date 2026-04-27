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
  enabled?: boolean;
  bound?: boolean;
  bound_rpa_client_id?: string;
  can_enter_auto_mode?: boolean;
  binding_required?: boolean;
  updated_at?: string;
};

export type ToolbarRPAAutoReplyWindow = {
  status?: string;
  open_kfid?: string;
  external_userid?: string;
  contact_name?: string;
  channel_label?: string;
  last_customer_message_preview?: string;
  last_customer_message_at?: string;
  pending_message_count?: number;
  generated_run_id?: string;
  updated_at?: string;
};

export type ToolbarRPABootstrap = {
  mode?: "normal" | "rpa" | string;
  enabled?: boolean;
  status?: string;
  automation?: ToolbarRPAAutomationState | null;
  pending_window?: ToolbarRPAAutoReplyWindow | null;
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
    pending_windows?: number;
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

function normalizeRPAStateSnapshot(
  state?: RPAStateSnapshot | null,
): ToolbarRPABootstrap | null {
  if (!state) return null;
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
    paused_auto_stop_remaining_ms:
      state.paused_auto_stop_remaining_ms || 0,
    queue_summary: state.queue_summary || null,
    current_session: state.current_session || null,
    target_session: state.target_session || null,
    navigation: state.navigation || null,
    review_manual: state.review_manual || null,
    status: state.status,
  };
}

export async function getKFToolbarRPAState(params: {
  run_id?: string;
  open_kfid?: string;
  external_userid?: string;
}): Promise<ToolbarRPABootstrap | null> {
  const search = new URLSearchParams();
  if (params.run_id) search.set("run_id", params.run_id);
  if (params.open_kfid) search.set("open_kfid", params.open_kfid);
  if (params.external_userid)
    search.set("external_userid", params.external_userid);
  const payload = await requestJSON<APIReply<RPAStateSnapshot>>(
    `/api/v1/kf/toolbar/rpa/state?${search.toString()}`,
  );
  return normalizeRPAStateSnapshot(payload?.data || null);
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
  const payload = await requestJSON<APIReply<RPAStateSnapshot>>(
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
  return normalizeRPAStateSnapshot(payload?.data || null);
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
  const payload = await requestJSON<APIReply<RPAStateSnapshot>>(
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
  return normalizeRPAStateSnapshot(payload?.data || null);
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
  const payload = await requestJSON<APIReply<RPAStateSnapshot>>(
    `/api/v1/kf/toolbar/rpa/runs/${encodeURIComponent(runID)}/commands`,
    {
      method: "POST",
      body: JSON.stringify({
        command: input.command || "",
        session_task_id: input.session_task_id || "",
        message_task_id: input.message_task_id || "",
      }),
    },
  );
  return normalizeRPAStateSnapshot(payload?.data || null);
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
