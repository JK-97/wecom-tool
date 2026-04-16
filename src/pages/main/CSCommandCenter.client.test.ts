import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildCommandCenterStreamURL,
  createCommandCenterStream,
} from "./CSCommandCenter.client";

class MockEventSource {
  static lastInstance: MockEventSource | null = null;

  public url: string;
  public withCredentials: boolean;
  public onerror: ((event: Event) => void) | null = null;
  private listeners = new Map<string, EventListener[]>();

  constructor(url: string, init?: EventSourceInit) {
    this.url = url;
    this.withCredentials = init?.withCredentials === true;
    MockEventSource.lastInstance = this;
  }

  addEventListener(type: string, listener: EventListener) {
    const bucket = this.listeners.get(type) || [];
    bucket.push(listener);
    this.listeners.set(type, bucket);
  }

  close() {}

  emit(type: string, data = "") {
    const event = { data } as MessageEvent<string>;
    (this.listeners.get(type) || []).forEach((listener) => listener(event));
  }
}

test("stream url uses the bootstrap cursor as since_cursor", () => {
  const url = buildCommandCenterStreamURL({
    openKFID: "kf-1",
    sinceCursor: 18,
  });
  assert.ok(url.endsWith("/api/v1/command-center/stream?open_kfid=kf-1&since_cursor=18"));
});

test("stream client handles rebootstrap_required and patch events", () => {
  const originalEventSource = globalThis.EventSource;
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  const patches: string[] = [];
  let rebootstrapRequired = false;

  try {
    createCommandCenterStream({
      openKFID: "kf-1",
      sinceCursor: 20,
      onPatch: (event) => {
        patches.push(String(event.patch_type || ""));
      },
      onRebootstrapRequired: () => {
        rebootstrapRequired = true;
      },
    });

    const stream = MockEventSource.lastInstance;
    assert.ok(stream);
    assert.equal(stream.withCredentials, true);

    stream.emit(
      "sessions_changed",
      JSON.stringify({
        cursor: 21,
        patch_type: "sessions_changed",
        external_userid: "ext-1",
        payload: {
          external_user_id: "ext-1",
          open_kfid: "kf-1",
        },
      }),
    );
    stream.emit("rebootstrap_required", JSON.stringify({ rebootstrap_required: true }));

    assert.deepEqual(patches, ["sessions_changed"]);
    assert.equal(rebootstrapRequired, true);
  } finally {
    globalThis.EventSource = originalEventSource;
  }
});

test("command center page no longer imports legacy view/detail polling or websocket main chain", () => {
  const pageSource = fs.readFileSync(
    path.resolve(import.meta.dirname, "./CSCommandCenter.tsx"),
    "utf8",
  );
  assert.equal(pageSource.includes("getCSCommandCenterView"), false);
  assert.equal(pageSource.includes("getCSCommandCenterSessionDetail"), false);
  assert.equal(pageSource.includes("realtime/chat/ws"), false);
  assert.equal(pageSource.includes("realtime/ops/ws"), false);
  assert.equal(pageSource.includes("WebSocket"), false);
});
