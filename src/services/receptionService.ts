import { requestJSON } from "./http";

type APIReply<T> = {
  code?: number;
  message?: string;
  data?: T;
};

export type ReceptionOverview = {
  total_channels?: number;
  active_channels?: number;
  abnormal_channels?: number;
  pending_sync?: number;
  latest_sync_status?: string;
  latest_sync_time?: string;
  tips?: string[];
};

export type ReceptionChannel = {
  open_kfid?: string;
  name?: string;
  display_name?: string;
  avatar_url?: string;
  source?: string;
  staff_count?: number;
  default_rule_id?: number;
  default_rule?: string;
  status?: string;
  sync_status?: string;
  last_interaction?: string;
  lag_seconds?: number;
  pending_tasks?: number;
  failed_tasks?: number;
  sync_mode?: string;
  sync_reason?: string;
  recovery_blocking?: boolean;
};

export type ReceptionChannelDetail = {
  channel?: ReceptionChannel;
  scenes?: Array<{ name?: string; scene_value?: string; url?: string }>;
  warnings?: string[];
  reception_pool?: {
    user_count?: number;
    department_count?: number;
    user_ids?: string[];
    department_ids?: number[];
    empty?: boolean;
  };
  fallback_route?: {
    mode?: string;
    human_target_type?: string;
    human_user_ids?: string[];
    human_department_ids?: number[];
    human_target_display?: string;
    human_target_valid?: boolean;
    invalid_reason_code?: string;
    invalid_reason?: string;
    queue_enabled?: boolean;
    requires_human?: boolean;
    uses_default_pool?: boolean;
  };
  state_layers?: {
    wecom_native_states?: string[];
    system_queue_enabled?: boolean;
    system_queue_state?: string;
    fallback_mode?: string;
    pending_human_target_display?: string;
    routing_state?: string;
    execution_status?: string;
    waiting_human_accept?: boolean;
    effective_human_target_display?: string;
    state_hint?: string;
  };
  route_bindings?: Array<{
    rule_id?: number;
    rule_name?: string;
    scene?: string;
    mode?: string;
    target?: string;
    target_valid?: boolean;
    target_issue?: string;
    priority?: number;
    is_default?: boolean;
    enabled?: boolean;
    hits_7d?: number;
    transfer_rate?: string;
    response_time?: string;
    last_hit?: string;
  }>;
  promotion_url?: string;
  staff_summary?: string;
  staff_members?: string[];
  servicer_assignments?: Array<{
    userid?: string;
    department_id?: number;
    status?: number;
  }>;
  routing_summary?: {
    total_rules?: number;
    active_rules?: number;
    inactive_rules?: number;
    has_default_rule?: boolean;
    overlapped_scenes?: number;
    total_hits_7d?: number;
    top_rule_name?: string;
    top_rule_percent?: string;
    latest_rule_update_at?: string;
  };
};

export type KFServicerAssignment = {
  userid?: string;
  display_userid?: string;
  display_fallback?: string;
  role?: string;
  department_id?: number;
  status?: number;
};

export type KFServicerUpsertResult = {
  target_type?: "user" | "department" | string;
  target_id?: string;
  userid?: string;
  department_id?: number;
  status?: "succeeded" | "failed" | string;
  source?: "precheck" | "wecom" | string;
  reason_code?: string;
  reason?: string;
  errcode?: number;
  errmsg?: string;
};

export type KFServicerUpsertSummary = {
  overall_status?: "succeeded" | "partial" | "failed" | string;
  total_count?: number;
  success_count?: number;
  failure_count?: number;
};

export type KFServicerUpsertResponse = {
  summary?: KFServicerUpsertSummary;
  result_list?: KFServicerUpsertResult[];
};

export type ReceptionChannelsView = {
  overview?: ReceptionOverview;
  channels?: ReceptionChannel[];
};

export async function getReceptionOverview(): Promise<ReceptionOverview | null> {
  const payload = await requestJSON<APIReply<ReceptionOverview>>(
    "/api/v1/reception/overview",
  );
  return payload?.data || null;
}

export async function listReceptionChannels(params?: {
  query?: string;
  limit?: number;
}): Promise<ReceptionChannel[]> {
  const search = new URLSearchParams();
  if (params?.query) search.set("query", params.query);
  if (params?.limit && params.limit > 0)
    search.set("limit", String(params.limit));
  const payload = await requestJSON<
    APIReply<{ channels?: ReceptionChannel[] }>
  >(`/api/v1/reception/channels?${search.toString()}`);
  return payload?.data?.channels || [];
}

export async function getReceptionChannelsView(params?: {
  query?: string;
  limit?: number;
}): Promise<ReceptionChannelsView | null> {
  const search = new URLSearchParams();
  if (params?.query) search.set("query", params.query);
  if (params?.limit && params.limit > 0)
    search.set("limit", String(params.limit));
  const payload = await requestJSON<APIReply<ReceptionChannelsView>>(
    `/api/v1/main/reception-channels/view?${search.toString()}`,
  );
  return payload?.data || null;
}

export async function createReceptionChannel(input: {
  open_kfid: string;
  name?: string;
  source?: string;
  scene_value?: string;
}): Promise<ReceptionChannel | null> {
  const payload = await requestJSON<APIReply<{ channel?: ReceptionChannel }>>(
    "/api/v1/reception/channels",
    {
      method: "POST",
      body: JSON.stringify({
        open_kfid: input.open_kfid,
        name: input.name || "",
        source: input.source || "",
        scene_value: input.scene_value || "",
      }),
    },
  );
  return payload?.data?.channel || null;
}

export async function getReceptionChannelDetail(
  openKFID: string,
): Promise<ReceptionChannelDetail | null> {
  const payload = await requestJSON<APIReply<ReceptionChannelDetail>>(
    `/api/v1/reception/channels/${encodeURIComponent(openKFID)}`,
  );
  return payload?.data || null;
}

export async function listKFServicerAssignments(
  openKFID: string,
): Promise<KFServicerAssignment[]> {
  const payload = await requestJSON<
    APIReply<{ servicer_list?: KFServicerAssignment[] }>
  >(`/api/v1/kf/servicers?open_kfid=${encodeURIComponent(openKFID)}`);
  return payload?.data?.servicer_list || [];
}

export async function upsertKFServicerAssignments(input: {
  open_kfid: string;
  op: "add" | "del";
  userid_list?: string[];
  department_id_list?: number[];
}): Promise<KFServicerUpsertResponse | null> {
  const payload = await requestJSON<APIReply<KFServicerUpsertResponse>>(
    "/api/v1/kf/servicers/upsert",
    {
      method: "POST",
      body: JSON.stringify({
        open_kfid: input.open_kfid,
        op: input.op,
        userid_list: input.userid_list || [],
        department_id_list: input.department_id_list || [],
      }),
    },
  );
  return payload?.data || null;
}

export async function triggerReceptionChannelSync(
  openKFID: string,
): Promise<boolean> {
  const payload = await requestJSON<APIReply<{ accepted?: boolean }>>(
    "/api/v1/reception/channels/sync",
    {
      method: "POST",
      body: JSON.stringify({
        open_kfid: openKFID,
      }),
    },
  );
  return payload?.data?.accepted === true;
}

export async function retryReceptionChannelSync(
  openKFID: string,
): Promise<number> {
  const payload = await requestJSON<APIReply<{ retried_count?: number }>>(
    "/api/v1/reception/channels/retry",
    {
      method: "POST",
      body: JSON.stringify({
        open_kfid: openKFID,
      }),
    },
  );
  return Number(payload?.data?.retried_count || 0);
}
