import {
  type CommandCenterBootstrapResponse,
  type CommandCenterStreamEvent,
} from "./CSCommandCenter.store";
import { requestJSON } from "@/services/http";

const importMetaEnv = (((import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env) ?? {}) as Record<string, string | undefined>;
const API_BASE_URL = (importMetaEnv.VITE_API_BASE_URL || "").trim();

export async function bootstrapCommandCenter(params?: {
  openKFID?: string;
  selectedExternalUserID?: string;
}): Promise<CommandCenterBootstrapResponse> {
  const search = new URLSearchParams();
  if (params?.openKFID) {
    search.set("open_kfid", params.openKFID);
  }
  if (params?.selectedExternalUserID) {
    search.set("selected_external_userid", params.selectedExternalUserID);
  }
  const suffix = search.toString();
  return requestJSON<CommandCenterBootstrapResponse>(
    `/api/v1/command-center/bootstrap${suffix ? `?${suffix}` : ""}`,
  );
}

export function createCommandCenterStream(options: {
  openKFID?: string;
  sinceCursor: number;
  onPatch: (event: CommandCenterStreamEvent) => void;
  onRebootstrapRequired: () => void;
  onError?: (error: Event) => void;
}): EventSource {
  const url = buildCommandCenterStreamURL({
    openKFID: options.openKFID,
    sinceCursor: options.sinceCursor,
  });
  const source = new EventSource(url, { withCredentials: true });
  const handler = (event: Event) => {
    const messageEvent = event as MessageEvent<string>;
    const raw = parseStreamPayload(messageEvent.data);
    if (!raw) {
      return;
    }
    options.onPatch(raw);
  };
  const patchEvents = [
    "sessions_changed",
    "selected_detail_changed",
    "messages_appended",
    "routing_records_appended",
    "monitor_changed",
    "status_changed",
  ];
  patchEvents.forEach((eventName) => {
    source.addEventListener(eventName, handler as EventListener);
  });
  source.addEventListener("rebootstrap_required", () => {
    options.onRebootstrapRequired();
  });
  if (options.onError) {
    source.onerror = options.onError;
  }
  return source;
}

export function buildCommandCenterStreamURL(params: {
  openKFID?: string;
  sinceCursor: number;
}): string {
  const search = new URLSearchParams();
  if (params.openKFID) {
    search.set("open_kfid", params.openKFID);
  }
  if (params.sinceCursor > 0) {
    search.set("since_cursor", String(params.sinceCursor));
  }
  const path = `/api/v1/command-center/stream${search.toString() ? `?${search.toString()}` : ""}`;
  return `${API_BASE_URL}${path}`;
}

export function parseStreamPayload(
  raw: string,
): CommandCenterStreamEvent | null {
  if (!raw.trim()) {
    return null;
  }
  try {
    const payload = JSON.parse(raw) as CommandCenterStreamEvent;
    return payload;
  } catch {
    return null;
  }
}
