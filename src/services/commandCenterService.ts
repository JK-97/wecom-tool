import { requestJSON } from "./http";

type APIReply<T> = {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
};

export type CommandCenterSession = {
  external_userid?: string;
  open_kfid?: string;
  name?: string;
  source?: string;
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
};

export type CommandCenterViewModel = {
  queue_count?: number;
  active_count?: number;
  closed_count?: number;
  sessions?: CommandCenterSession[];
  selected?: CommandCenterSession;
  selected_detail?: CommandCenterSessionDetail;
  monitor?: {
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
      customer_goal?: string;
      journey_stage?: string;
      relationship_stage?: string;
      confidence?: string;
      profile_summary?: string;
      blocking_issues?: string[];
      decision_signals?: string[];
      required_information?: string[];
      next_best_actions?: string[];
      reply_guardrails?: string[];
      opportunity_level?: string;
      opportunity_signals?: string[];
      recommended_offer?: string;
      handoff_recommendation?: string;
      handoff_reason?: string;
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
  };
  warnings?: string[];
};

export type CommandCenterMessage = {
  id?: string;
  sender?: string;
  sender_userid?: string;
  sender_display_userid?: string;
  sender_display_fallback?: string;
  content?: string;
  timestamp?: string;
  type?: string;
  status?: string;
  delivery_status?: string;
  last_attempt_at?: string;
  delivered_at?: string;
  next_retry_at?: string;
};

export type CommandCenterSessionDetail = {
  session?: CommandCenterSession;
  entry_context?: {
    scene?: string;
    scene_param?: string;
    wechat_channels_nickname?: string;
    welcome_code?: string;
  };
  routing_records?: Array<{
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
  }>;
  messages?: CommandCenterMessage[];
  monitor?: CommandCenterViewModel["monitor"];
  warnings?: string[];
  next_cursor?: string;
  next_token?: string;
  latest_version?: number;
};

export type CommandCenterRealtimeEvent = {
  open_kfid?: string;
  update_version?: number;
  event_id?: string;
  event_type?: string;
  external_userid?: string;
  session_state?: number;
  routing_rule_id?: number;
  execution_status?: string;
  occurred_at?: string;
  payload_json?: string;
  topic?: string;
};

export type CommandCenterRealtimeEnvelope = {
  code?: number;
  message?: string;
  events?: CommandCenterRealtimeEvent[];
  latest_version?: number;
  request_id?: string;
};

export type CommandCenterCommandResult = {
  success?: boolean;
  stubbed?: boolean;
  status?: string;
  message?: string;
};

export type KFServiceStateTransitionResult = {
  message?: string;
  request_id?: string;
  data?: {
    transfer_id?: string;
  };
};

export async function getCSCommandCenterView(params?: {
  open_kfid?: string;
  limit?: number;
}): Promise<CommandCenterViewModel | null> {
  const search = new URLSearchParams();
  if (params?.open_kfid) search.set("open_kfid", params.open_kfid);
  if (params?.limit && params.limit > 0)
    search.set("limit", String(params.limit));
  const payload = await requestJSON<APIReply<CommandCenterViewModel>>(
    `/api/v1/main/cs-command-center/view?${search.toString()}`,
  );
  return payload?.data || null;
}

export async function getCSCommandCenterSessionDetail(params: {
  open_kfid?: string;
  external_userid?: string;
  limit?: number;
  cursor?: string;
  token?: string;
  since_version?: number;
}): Promise<CommandCenterSessionDetail | null> {
  const search = new URLSearchParams();
  if (params.open_kfid) search.set("open_kfid", params.open_kfid);
  if (params.external_userid)
    search.set("external_userid", params.external_userid);
  if (params.limit && params.limit > 0)
    search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.token) search.set("token", params.token);
  if (params.since_version && params.since_version > 0)
    search.set("since_version", String(params.since_version));
  const payload = await requestJSON<APIReply<CommandCenterSessionDetail>>(
    `/api/v1/main/cs-command-center/session?${search.toString()}`,
  );
  return payload?.data || null;
}

export function openCommandCenterRealtimeSocket(input: {
  topic: "chat" | "ops";
  open_kfid?: string;
  since_version?: number;
  onMessage: (payload: CommandCenterRealtimeEnvelope) => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
}): WebSocket {
  const url = buildRealtimeSocketURL(input.topic, {
    open_kfid: input.open_kfid,
    since_version: input.since_version,
  });
  const socket = new WebSocket(url);
  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(
        String(event.data || ""),
      ) as CommandCenterRealtimeEnvelope;
      input.onMessage(payload);
    } catch {
      // Ignore malformed payloads and keep the stream alive.
    }
  };
  if (input.onClose) {
    socket.onclose = () => input.onClose?.();
  }
  if (input.onError) {
    socket.onerror = input.onError;
  }
  return socket;
}

function buildRealtimeSocketURL(
  topic: "chat" | "ops",
  params?: { open_kfid?: string; since_version?: number },
): string {
  const base =
    (import.meta.env.VITE_API_BASE_URL || "").trim() ||
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost");
  const url = new URL(`/api/v1/realtime/${topic}/ws`, base);
  if (url.protocol === "https:") {
    url.protocol = "wss:";
  } else {
    url.protocol = "ws:";
  }
  if (params?.open_kfid) {
    url.searchParams.set("open_kfid", params.open_kfid);
  }
  if (params?.since_version && params.since_version > 0) {
    url.searchParams.set("since_version", String(params.since_version));
  }
  return url.toString();
}

export async function executeCSCommandCenterCommand(input: {
  command: string;
  open_kfid?: string;
  external_userid?: string;
  payload?: Record<string, unknown>;
}): Promise<CommandCenterCommandResult | null> {
  const payload = await requestJSON<APIReply<CommandCenterCommandResult>>(
    "/api/v1/main/cs-command-center/commands",
    {
      method: "POST",
      body: JSON.stringify({
        command: input.command,
        open_kfid: input.open_kfid || "",
        external_userid: input.external_userid || "",
        payload_json: JSON.stringify(input.payload || {}),
      }),
    },
  );
  return payload?.data || null;
}

export async function transitionKFServiceState(input: {
  open_kfid?: string;
  external_userid?: string;
  service_state: number;
  servicer_userid?: string;
}): Promise<KFServiceStateTransitionResult | null> {
  const payload = await requestJSON<APIReply<{ transfer_id?: string }>>(
    "/api/v1/kf/service-state/trans",
    {
      method: "POST",
      body: JSON.stringify({
        open_kfid: input.open_kfid || "",
        external_userid: input.external_userid || "",
        service_state: input.service_state,
        servicer_userid: input.servicer_userid || "",
      }),
    },
  );
  return {
    message: payload?.message,
    request_id: payload?.request_id,
    data: payload?.data,
  };
}

export async function markCommandCenterSessionRead(params: {
  open_kfid?: string;
  external_userid?: string;
}): Promise<void> {
  const customerID = (params.external_userid || "").trim();
  const openKFID = (params.open_kfid || "").trim();
  if (!customerID || !openKFID) return;
  await requestJSON<unknown>("/api/v1/chat/conversations/read", {
    method: "POST",
    body: JSON.stringify({ customer_id: customerID, open_kfid: openKFID }),
  });
}
