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
}): Promise<CommandCenterSessionDetail | null> {
  const search = new URLSearchParams();
  if (params.open_kfid) search.set("open_kfid", params.open_kfid);
  if (params.external_userid)
    search.set("external_userid", params.external_userid);
  if (params.limit && params.limit > 0)
    search.set("limit", String(params.limit));
  const payload = await requestJSON<APIReply<CommandCenterSessionDetail>>(
    `/api/v1/main/cs-command-center/session?${search.toString()}`,
  );
  return payload?.data || null;
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
