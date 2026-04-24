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
  const payload = await requestJSON<APIReply<ToolbarRPABootstrap>>(
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
  return payload?.data || null;
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
  const payload = await requestJSON<APIReply<ToolbarRPABootstrap>>(
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
  return payload?.data || null;
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
  const payload = await requestJSON<APIReply<ToolbarRPABootstrap>>(
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
  return payload?.data || null;
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
