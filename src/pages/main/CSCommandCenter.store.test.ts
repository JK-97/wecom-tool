import test from "node:test";
import assert from "node:assert/strict";

import {
  commandCenterReducer,
  initialCommandCenterState,
  normalizePatchEvent,
  selectCommandCenterDetail,
  selectCommandCenterViewModel,
  type CommandCenterBootstrapResponse,
} from "./CSCommandCenter.store";

function buildBootstrapPayload(): CommandCenterBootstrapResponse {
  return {
    cursor: 12,
    selected_external_userid: "ext-1",
    sessions: [
      {
        external_user_id: "ext-1",
        open_kfid: "kf-1",
        name: "客户A",
        state_bucket: "queue",
        session_state: 2,
        last_message_preview: "你好",
        assigned_display_name: "顾问A",
      },
    ],
    selected_detail: {
      session: {
        external_user_id: "ext-1",
        open_kfid: "kf-1",
        name: "客户A",
        state_bucket: "queue",
        session_state: 2,
      },
      entry_context: {
        scene: "wechat",
      },
      status_bar: {
        session_label: "排队中",
      },
      display_meta: {
        warnings: ["w1"],
      },
    },
    messages: [
      {
        message_id: "msg-1",
        sender_type: "customer",
        content_text: "你好",
        occurred_at: "2026-04-16T00:00:00Z",
      },
    ],
    routing_records: [
      {
        occurred_at: "2026-04-16T00:00:00Z",
        actor_type: "system",
        action_text: "转给",
        target_label: "顾问A",
      },
    ],
    monitor: {
      summary: "客户情绪稳定",
      meta: { status: "succeeded" },
    },
    status_bar: {
      session_label: "排队中",
      state_bucket: "queue",
    },
    entry_context: {
      scene: "wechat",
    },
    display_meta: {
      warnings: ["w1"],
    },
  };
}

test("INIT_FROM_BOOTSTRAP hydrates the unified store", () => {
  const state = commandCenterReducer(initialCommandCenterState, {
    type: "INIT_FROM_BOOTSTRAP",
    payload: buildBootstrapPayload(),
    receivedAtMs: 100,
  });

  assert.equal(state.cursor, 12);
  assert.equal(state.streamAnchorCursor, 12);
  assert.equal(state.selectedExternalUserID, "ext-1");
  assert.equal(state.sessions.length, 1);
  assert.equal(state.messages.length, 1);
  assert.equal(state.routingRecords.length, 1);
  assert.equal(state.monitor?.summary, "客户情绪稳定");
  assert.equal(state.ui.isBootstrapping, false);

  const view = selectCommandCenterViewModel(state);
  const detail = selectCommandCenterDetail(state);
  assert.equal(view.selected?.external_userid, "ext-1");
  assert.equal(detail?.entry_context?.scene, "wechat");
  assert.equal(detail?.messages?.[0]?.id, "msg-1");
});

test("APPLY_PATCH updates list and selected detail in one reducer commit", () => {
  const bootstrapped = commandCenterReducer(initialCommandCenterState, {
    type: "INIT_FROM_BOOTSTRAP",
    payload: buildBootstrapPayload(),
    receivedAtMs: 100,
  });
  const patch = normalizePatchEvent({
    cursor: 13,
    patch_type: "sessions_changed",
    external_userid: "ext-1",
    payload: {
      external_user_id: "ext-1",
      open_kfid: "kf-1",
      name: "客户A-更新",
      state_bucket: "active",
      session_state: 3,
      assigned_display_name: "顾问B",
    },
  });
  assert.ok(patch);

  const next = commandCenterReducer(bootstrapped, {
    type: "APPLY_PATCH",
    patch,
    receivedAtMs: 200,
  });

  assert.equal(next.cursor, 13);
  assert.equal(next.sessions[0]?.name, "客户A-更新");
  assert.equal(next.sessions[0]?.state_bucket, "active");
  assert.equal(next.selectedDetail?.session?.name, "客户A-更新");
  assert.equal(next.selectedDetail?.session?.state_bucket, "active");
});

test("APPLY_PATCH ignores incoming patches with non-increasing cursor", () => {
  const bootstrapped = commandCenterReducer(initialCommandCenterState, {
    type: "INIT_FROM_BOOTSTRAP",
    payload: buildBootstrapPayload(),
    receivedAtMs: 100,
  });
  const ignored = normalizePatchEvent({
    cursor: 12,
    patch_type: "status_changed",
    external_userid: "ext-1",
    payload: {
      session_label: "人工接待",
      state_bucket: "active",
    },
  });
  assert.ok(ignored);

  const next = commandCenterReducer(bootstrapped, {
    type: "APPLY_PATCH",
    patch: ignored,
    receivedAtMs: 200,
  });

  assert.deepEqual(next, bootstrapped);
});

test("REBOOTSTRAP marks bootstrap pending without dropping current truth", () => {
  const bootstrapped = commandCenterReducer(initialCommandCenterState, {
    type: "INIT_FROM_BOOTSTRAP",
    payload: buildBootstrapPayload(),
    receivedAtMs: 100,
  });

  const next = commandCenterReducer(bootstrapped, {
    type: "REBOOTSTRAP",
    pendingSelectedExternalUserID: "ext-2",
  });

  assert.equal(next.ui.isBootstrapping, true);
  assert.equal(next.ui.pendingSelectedExternalUserID, "ext-2");
  assert.equal(next.sessions[0]?.external_userid, "ext-1");
});
