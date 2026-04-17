import { requestJSON } from "./http";

type APIReply<T> = {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
};

export type KFToolbarSuggestion = {
  id?: string;
  text?: string;
  sentences?: string[];
  has_followups?: boolean;
  display_mode?: string;
  next_step_label?: string;
  reason?: string;
  source?: string;
};

export type KFToolbarSuggestionBatch = {
  batch_id?: string;
  items?: KFToolbarSuggestion[];
};

export type KFToolbarBootstrap = {
  entry?: string;
  open_kfid?: string;
  external_userid?: string;
  header?: {
    session_status?: string;
    contact_name?: string;
    risk_tags?: string[];
    last_active?: string;
    can_upgrade_contact?: boolean;
  };
  summary?: {
    status?: string;
    current_round?: string;
    history_highlights?: string[];
  };
  suggestions?: KFToolbarSuggestionBatch;
  capabilities?: {
    fill_reply?: boolean;
    copy_reply?: boolean;
    upgrade_contact?: boolean;
    regenerate?: boolean;
  };
  selection?: {
    required?: boolean;
    reason?: string;
    candidates?: Array<{
      open_kfid?: string;
      external_userid?: string;
      contact_name?: string;
      session_status?: string;
      channel_token?: string;
      last_active?: string;
      last_message?: string;
    }>;
  };
  version?: number;
  warnings?: string[];
};

export async function getKFToolbarBootstrap(params: {
  entry?: string;
  open_kfid?: string;
  external_userid?: string;
}): Promise<KFToolbarBootstrap | null> {
  const search = new URLSearchParams();
  if (params.entry) search.set("entry", params.entry);
  if (params.open_kfid) search.set("open_kfid", params.open_kfid);
  if (params.external_userid)
    search.set("external_userid", params.external_userid);
  const payload = await requestJSON<APIReply<KFToolbarBootstrap>>(
    `/api/v1/kf/toolbar/bootstrap?${search.toString()}`,
  );
  return payload?.data || null;
}

export async function regenerateKFToolbarSuggestions(input: {
  entry?: string;
  open_kfid?: string;
  external_userid?: string;
  seed_reply_id?: string;
  reason?: string;
}): Promise<KFToolbarSuggestionBatch | null> {
  const payload = await requestJSON<APIReply<KFToolbarSuggestionBatch>>(
    "/api/v1/kf/toolbar/suggestions/regenerate",
    {
      method: "POST",
      body: JSON.stringify({
        entry: input.entry || "",
        open_kfid: input.open_kfid || "",
        external_userid: input.external_userid || "",
        seed_reply_id: input.seed_reply_id || "",
        reason: input.reason || "",
      }),
    },
  );
  return payload?.data || null;
}

export async function sendKFToolbarReplyFeedback(input: {
  open_kfid?: string;
  external_userid?: string;
  reply_id?: string;
  action?: string;
  step?: number;
}): Promise<void> {
  await requestJSON<APIReply<{ success?: boolean }>>(
    "/api/v1/kf/toolbar/reply-feedback",
    {
      method: "POST",
      body: JSON.stringify({
        open_kfid: input.open_kfid || "",
        external_userid: input.external_userid || "",
        reply_id: input.reply_id || "",
        action: input.action || "",
        step: input.step || 0,
      }),
    },
  );
}
