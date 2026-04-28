import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { isAbortLikeError, normalizeErrorMessage } from "@/services/http";
import {
  normalizeJSSDKRuntimeError,
  openWecomKfConversation,
  resolveSidebarRuntimeContext,
  sendTextToCurrentSession,
  toJSSDKErrorMessage,
} from "@/services/jssdkService";
import {
  executeKFToolbarRPARunCommand,
  getKFToolbarRPABootstrap,
  markKFToolbarRPAMessageDraftFilled,
  markKFToolbarRPAMessageFailed,
  normalizeToolbarRPAOperatorStreamEvent,
  openToolbarRPAOperatorViewStream,
  updateKFToolbarRPAAutomationMode,
  type ToolbarRPAAction,
  type ToolbarRPABootstrap,
  type ToolbarRPAOperatorTaskView,
  type ToolbarRPASessionTask,
} from "@/services/rpaToolbarService";
import {
  sidebarBody,
  sidebarHeader,
  sidebarMeta,
  sidebarPageShell,
  sidebarSectionLabel,
  sidebarTitle,
} from "./sidebarChrome";
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  Bot,
  CheckCircle2,
  FileText,
  LoaderCircle,
  MessageSquareText,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RefreshCcw,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Square,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const RECENT_NAVIGATION_STORAGE_KEY = "wecom-toolbar-rpa-recent-navigation";
const RECENT_NAVIGATION_TTL_MS = 60_000;
const AUTOMATION_NAVIGATION_HANDOFF_STORAGE_KEY =
  "wecom-toolbar-rpa-automation-handoff-v1";
const AUTOMATION_NAVIGATION_HANDOFF_TTL_MS = 60_000;
const TERMINAL_RUN_STATUSES = new Set([
  "completed",
  "stopped",
  "failed",
  "canceled",
]);
const ONE_SHOT_ACTION_TYPES = new Set([
  "navigate_to_chat",
  "fill_current_message",
  "review_auto_resend",
]);
const POST_NAVIGATION_ACTION_TYPES = new Set([
  "fill_current_message",
  "wait_rpa_ack",
  "wait_wecom_confirm",
  "review_auto_resend",
  "completed",
]);
const COMPLETION_SOURCE_ACTION_TYPES = new Set([
  "wait_wecom_confirm",
  "review_auto_resend",
]);
const WAIT_RPA_ACK_STATUSES = new Set(["waiting_rpa_ack"]);
const WAIT_WECOM_CONFIRM_STATUSES = new Set([
  "waiting_wecom_confirm",
  "rpa_clicked_send",
]);
const STREAM_STALE_FALLBACK_MS = 45_000;
const STREAM_CONNECTING_FALLBACK_MS = 12_000;
const REVIEW_AUTO_RESEND_STATUSES = new Set(["review_resend_pending"]);
const NEED_MANUAL_STATUSES = new Set([
  "need_manual",
  "failed",
  "confirm_uncertain",
]);
const FILLABLE_STATUSES = new Set([
  "pending",
  "draft_filling",
  "draft_filled",
  "dispatching",
]);

function snapshotRealtimeVersion(
  snapshot?: ToolbarRPABootstrap | null,
): number {
  return Number(snapshot?.version || 0);
}

function isTerminalLikeStatus(value?: string | null): boolean {
  const next = (value || "").trim().toLowerCase();
  return (
    next === "completed" ||
    next === "stopped" ||
    next === "failed" ||
    next === "canceled" ||
    next === "closed"
  );
}

function firstNonEmpty(values: Array<string | undefined | null>): string {
  for (const value of values) {
    const next = (value || "").trim();
    if (next) return next;
  }
  return "";
}

function taskViewHasDisplayContent(
  task?: ToolbarRPAOperatorTaskView | null,
): task is ToolbarRPAOperatorTaskView {
  if (!task) return false;
  return Boolean(
    (task.target?.open_kfid || "").trim() ||
      (task.target?.external_userid || "").trim() ||
      (task.target?.display_name || "").trim() ||
      (task.session?.open_kfid || "").trim() ||
      (task.session?.external_userid || "").trim() ||
      (task.session?.contact_name || "").trim() ||
      (task.message?.text || "").trim() ||
      (task.message?.message_preview || "").trim(),
  );
}

function shouldAdoptIncomingBootstrap(
  current: ToolbarRPABootstrap | null,
  incoming: ToolbarRPABootstrap | null,
): boolean {
  if (!incoming) return false;
  if (!current) return true;

  const currentRealtimeVersion = snapshotRealtimeVersion(current);
  const incomingRealtimeVersion = snapshotRealtimeVersion(incoming);
  if (currentRealtimeVersion > 0 || incomingRealtimeVersion > 0) {
    if (incomingRealtimeVersion !== currentRealtimeVersion) {
      return incomingRealtimeVersion >= currentRealtimeVersion;
    }
  }

  const currentRunID = (current.run?.run_id || "").trim();
  const incomingRunID = (incoming.run?.run_id || "").trim();
  const currentVersion = Number(current.run?.version || 0);
  const incomingVersion = Number(incoming.run?.version || 0);
  const currentStatus = (
    current.run?.status ||
    current.status ||
    current.action?.type ||
    ""
  ).trim();
  const incomingStatus = (
    incoming.run?.status ||
    incoming.status ||
    incoming.action?.type ||
    ""
  ).trim();
  const currentPaused = Boolean(
    current.automation?.paused ||
    currentStatus === "paused" ||
    currentStatus === "pausing",
  );

  if (currentRunID && incomingRunID && currentRunID === incomingRunID) {
    return incomingVersion >= currentVersion;
  }

  if (currentPaused) {
    if (!incomingRunID && currentRunID) {
      return false;
    }
    if (
      incomingRunID !== currentRunID &&
      isTerminalLikeStatus(incomingStatus)
    ) {
      return false;
    }
  }

  if (currentRunID && !incomingRunID && !isTerminalLikeStatus(currentStatus)) {
    return false;
  }

  return true;
}

function shouldShowCompletedTransition(
  previous: ToolbarRPABootstrap | null,
  next: ToolbarRPABootstrap | null,
): boolean {
  if (!previous || !next) return false;
  if (next.operator_view?.display?.state) return false;
  const previousRunID = (previous.run?.run_id || "").trim();
  const nextRunID = (next.run?.run_id || "").trim();
  const previousActionType = (previous.action?.type || "").trim();
  const nextActionType = (next.action?.type || "").trim();
  const nextStatus = (next.status || "").trim().toLowerCase();

  if (!previousRunID) return false;
  if (!COMPLETION_SOURCE_ACTION_TYPES.has(previousActionType)) return false;
  if (nextActionType === "completed") return false;
  if (nextActionType === "need_manual") return false;
  if (nextStatus === "closed") return false;
  if (nextRunID !== "" && nextRunID === previousRunID) return false;

  return nextRunID === "" || nextRunID !== previousRunID;
}

function deriveContextAwareAction(
  next: ToolbarRPABootstrap,
  current: { openKFID?: string; externalUserID?: string },
): ToolbarRPAAction | null {
  const action = next.action || null;
  if (!action) return null;
  const runStatus = (next.run?.status || next.status || "")
    .trim()
    .toLowerCase();
  const automationPaused = Boolean(
    next.automation?.paused ||
      next.operator_view?.automation?.status === "paused" ||
      (next.operator_view?.display?.state || "").trim() === "paused" ||
      (action.type || "").trim() === "paused",
  );
  if (automationPaused) {
    return action;
  }
  if (
    runStatus === "completed" ||
    runStatus === "stopped" ||
    runStatus === "failed" ||
    runStatus === "paused" ||
    runStatus === "pausing"
  ) {
    return action;
  }
  const messageTask = next.message_task || null;
  const target = action.target || {
    open_kfid:
      next.target_session?.open_kfid || next.current_session?.open_kfid || "",
    external_userid:
      next.target_session?.external_userid ||
      next.current_session?.external_userid ||
      "",
    display_name:
      next.target_session?.contact_name ||
      next.current_session?.contact_name ||
      "",
    channel_label:
      next.target_session?.channel_label ||
      next.current_session?.channel_label ||
      "",
  };
  const messageStatus = (messageTask?.status || "").trim().toLowerCase();
  const allowExternalOnlyMatch = canMatchByExternalOnly(current, target);
  const matchedCurrentTarget =
    hasConversationIdentity(current) &&
    !isKnownDifferentConversation(current, target) &&
    isSameConversation(current, target, allowExternalOnlyMatch);

  const withTarget = {
    ...action,
    target,
  };
  if (WAIT_RPA_ACK_STATUSES.has(messageStatus)) {
    return {
      ...withTarget,
      type: "wait_rpa_ack",
      reason: action.reason || "waiting_rpa_ack",
      poll_after_ms: action.poll_after_ms || next.poll_after_ms || 1200,
    };
  }
  if (WAIT_WECOM_CONFIRM_STATUSES.has(messageStatus)) {
    return {
      ...withTarget,
      type: "wait_wecom_confirm",
      reason: action.reason || "waiting_wecom_confirm",
      poll_after_ms: action.poll_after_ms || next.poll_after_ms || 1600,
    };
  }
  if (REVIEW_AUTO_RESEND_STATUSES.has(messageStatus)) {
    return {
      ...withTarget,
      type: "review_auto_resend",
      reason: action.reason || "review_auto_resend",
      poll_after_ms: action.poll_after_ms || next.poll_after_ms || 1000,
    };
  }
  if (NEED_MANUAL_STATUSES.has(messageStatus)) {
    return {
      ...withTarget,
      type: "need_manual",
      reason: action.reason || "message_failed",
      poll_after_ms: action.poll_after_ms || next.poll_after_ms || 3000,
    };
  }
  if (!FILLABLE_STATUSES.has(messageStatus)) {
    return withTarget;
  }
  if (!matchedCurrentTarget) {
    return {
      ...withTarget,
      type: "navigate_to_chat",
      reason: action.reason || "next_session",
      poll_after_ms: action.poll_after_ms || next.poll_after_ms || 1200,
    };
  }
  const text = (
    messageTask?.text ||
    messageTask?.message_preview ||
    action.message?.text ||
    action.messages?.[0]?.text ||
    ""
  ).trim();
  const message = {
    message_id:
      messageTask?.message_task_id ||
      action.message?.message_id ||
      action.message_task_id ||
      "",
    order:
      messageTask?.send_order ||
      action.message?.order ||
      action.messages?.[0]?.order ||
      0,
    text,
    message_hash:
      messageTask?.message_hash ||
      action.message?.message_hash ||
      action.messages?.[0]?.message_hash ||
      "",
  };
  return {
    ...withTarget,
    type: "fill_current_message",
    reason: "current_message_ready",
    poll_after_ms: action.poll_after_ms || next.poll_after_ms || 1200,
    message,
    messages: text ? [message] : [],
  };
}

type Props = {
  runId?: string;
  initialBootstrap?: ToolbarRPABootstrap | null;
  initialAutomationEnabled?: boolean;
  allowInactivePanel?: boolean;
  currentSessionContext?: {
    open_kfid?: string;
    external_userid?: string;
  } | null;
  channelDisplayMap?: Record<string, string>;
  onAutomationModeChange?: (enabled: boolean) => Promise<void> | void;
  isUpdatingAutomationMode?: boolean;
  onExitRPAMode?: () => Promise<void> | void;
};

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function badgeVariant(
  value?: string,
): "default" | "secondary" | "success" | "warning" | "destructive" {
  const status = (value || "").toLowerCase();
  if (status === "completed" || status === "sent_confirmed") return "success";
  if (status === "need_manual" || status === "failed") return "destructive";
  if (
    status.includes("waiting") ||
    status === "paused" ||
    status === "wait_rpa_ack" ||
    status === "wait_wecom_confirm" ||
    status === "confirm_uncertain" ||
    status === "review_auto_resend" ||
    status === "review_resend_pending"
  )
    return "warning";
  if (status === "running" || status === "fill_current_message")
    return "default";
  return "secondary";
}

function progressPercent(snapshot?: ToolbarRPABootstrap | null): number {
  const total = snapshot?.run?.total_message_tasks || 0;
  if (total <= 0) return 0;
  const done =
    (snapshot?.run?.confirmed_message_tasks || 0) +
    (snapshot?.run?.need_manual_message_tasks || 0) +
    (snapshot?.run?.failed_message_tasks || 0);
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

function currentRuntimeContext(
  fallback?: {
    open_kfid?: string;
    external_userid?: string;
  } | null,
) {
  return {
    openKFID: (fallback?.open_kfid || "").trim(),
    externalUserID: (fallback?.external_userid || "").trim(),
  };
}

type RuntimeContext = {
  openKFID: string;
  externalUserID: string;
  source?: string;
};

function debugConversationContext(
  context?: {
    openKFID?: string;
    externalUserID?: string;
    source?: string;
  } | null,
) {
  return {
    open_kfid: (context?.openKFID || "").trim(),
    external_userid: (context?.externalUserID || "").trim(),
    source: (context?.source || "").trim(),
  };
}

function debugSessionContext(
  context?: {
    open_kfid?: string;
    external_userid?: string;
    contact_name?: string;
    channel_label?: string;
    session_task_id?: string;
    status?: string;
  } | null,
) {
  return {
    session_task_id: (context?.session_task_id || "").trim(),
    status: (context?.status || "").trim(),
    open_kfid: (context?.open_kfid || "").trim(),
    external_userid: (context?.external_userid || "").trim(),
    contact_name: (context?.contact_name || "").trim(),
    channel_label: (context?.channel_label || "").trim(),
  };
}

function debugTargetContext(
  target?: {
    open_kfid?: string;
    external_userid?: string;
    display_name?: string;
    channel_label?: string;
  } | null,
) {
  return {
    open_kfid: (target?.open_kfid || "").trim(),
    external_userid: (target?.external_userid || "").trim(),
    display_name: (target?.display_name || "").trim(),
    channel_label: (target?.channel_label || "").trim(),
  };
}

function rpaDebugLog(stage: string, detail?: Record<string, unknown>) {
  if (typeof console === "undefined" || typeof console.info !== "function") {
    return;
  }
  console.info(`[toolbar-rpa] ${stage}`, detail || {});
}

async function resolveRuntimeContext(
  fallback?: {
    open_kfid?: string;
    external_userid?: string;
  } | null,
  trustedCurrent?: {
    openKFID?: string;
    externalUserID?: string;
  } | null,
  options?: {
    allowJSSDK?: boolean;
  },
): Promise<RuntimeContext> {
  const currentContext = currentRuntimeContext(fallback);
  const trustedContext = {
    openKFID: (trustedCurrent?.openKFID || "").trim(),
    externalUserID: (trustedCurrent?.externalUserID || "").trim(),
  };
  const localContext = {
    openKFID: trustedContext.openKFID || currentContext.openKFID,
    externalUserID:
      trustedContext.externalUserID || currentContext.externalUserID,
  };
  if (!options?.allowJSSDK || hasConversationIdentity(localContext)) {
    return {
      ...localContext,
      source:
        trustedContext.openKFID || trustedContext.externalUserID
          ? "trusted_local"
          : "fallback_local",
    };
  }
  try {
    const runtime = await resolveSidebarRuntimeContext();
    const runtimeOpenKFID = (runtime.open_kfid || "").trim();
    const runtimeExternalUserID = (runtime.external_userid || "").trim();
    const hasTrustedOpenKFID = Boolean(trustedContext.openKFID);
    return {
      openKFID:
        trustedContext.openKFID || runtimeOpenKFID || currentContext.openKFID,
      externalUserID: hasTrustedOpenKFID
        ? trustedContext.externalUserID ||
          runtimeExternalUserID ||
          currentContext.externalUserID
        : runtimeExternalUserID ||
          trustedContext.externalUserID ||
          currentContext.externalUserID,
      source: "jssdk",
    };
  } catch {
    return {
      openKFID: trustedContext.openKFID || currentContext.openKFID,
      externalUserID:
        trustedContext.externalUserID || currentContext.externalUserID,
      source: "local_after_jssdk_failed",
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isSameConversation(
  current: { openKFID?: string; externalUserID?: string },
  target?: { open_kfid?: string; external_userid?: string },
  allowExternalOnly = false,
): boolean {
  const currentOpenKFID = (current.openKFID || "").trim();
  const currentExternalUserID = (current.externalUserID || "").trim();
  const targetOpenKFID = (target?.open_kfid || "").trim();
  const targetExternalUserID = (target?.external_userid || "").trim();
  if (targetExternalUserID && currentExternalUserID) {
    if (currentExternalUserID !== targetExternalUserID) return false;
    if (
      currentOpenKFID &&
      targetOpenKFID &&
      currentOpenKFID !== targetOpenKFID
    ) {
      return false;
    }
    return Boolean(allowExternalOnly || (currentOpenKFID && targetOpenKFID));
  }
  return Boolean(
    currentOpenKFID && targetOpenKFID && currentOpenKFID === targetOpenKFID,
  );
}

function targetKey(target?: {
  open_kfid?: string;
  external_userid?: string;
}): string {
  const openKFID = (target?.open_kfid || "").trim();
  const externalUserID = (target?.external_userid || "").trim();
  if (!openKFID && !externalUserID) return "";
  return `${openKFID}\u001f${externalUserID}`;
}

function actionExecutionKey(
  runID: string,
  actionType: string,
  action?: ToolbarRPAAction | null,
): string {
  const message = action?.message || action?.messages?.[0];
  const messageHash = (message?.message_hash || "").trim();
  const taskID = (
    action?.message_task_id ||
    action?.task_id ||
    action?.session_task_id ||
    ""
  ).trim();
  return [
    (runID || "").trim(),
    (actionType || "").trim(),
    (action?.session_task_id || "").trim(),
    taskID,
    targetKey(action?.target),
    messageHash,
  ].join("\u001f");
}

function contextFromTarget(target?: {
  open_kfid?: string;
  external_userid?: string;
}): { openKFID: string; externalUserID: string } {
  return {
    openKFID: (target?.open_kfid || "").trim(),
    externalUserID: (target?.external_userid || "").trim(),
  };
}

function hasConversationIdentity(context?: {
  openKFID?: string;
  externalUserID?: string;
}): boolean {
  return Boolean(
    (context?.openKFID || "").trim() || (context?.externalUserID || "").trim(),
  );
}

function isKnownDifferentConversation(
  current: { openKFID?: string; externalUserID?: string },
  target?: { open_kfid?: string; external_userid?: string },
): boolean {
  const currentOpenKFID = (current.openKFID || "").trim();
  const currentExternalUserID = (current.externalUserID || "").trim();
  const targetOpenKFID = (target?.open_kfid || "").trim();
  const targetExternalUserID = (target?.external_userid || "").trim();
  if (
    currentExternalUserID &&
    targetExternalUserID &&
    currentExternalUserID !== targetExternalUserID
  ) {
    return true;
  }
  if (
    currentExternalUserID &&
    targetExternalUserID &&
    currentExternalUserID === targetExternalUserID &&
    currentOpenKFID &&
    targetOpenKFID &&
    currentOpenKFID !== targetOpenKFID
  ) {
    return true;
  }
  return Boolean(
    !currentExternalUserID &&
    !targetExternalUserID &&
    currentOpenKFID &&
    targetOpenKFID &&
    currentOpenKFID !== targetOpenKFID,
  );
}

function canMatchByExternalOnly(
  current: { openKFID?: string; externalUserID?: string },
  target?: { open_kfid?: string; external_userid?: string },
): boolean {
  return Boolean(
    !(current.openKFID || "").trim() &&
    (current.externalUserID || "").trim() &&
    (target?.external_userid || "").trim(),
  );
}

function rememberAutomationNavigation(
  runID: string,
  target?: { open_kfid?: string; external_userid?: string },
) {
  if (typeof window === "undefined") return;
  const key = targetKey(target);
  const openKFID = (target?.open_kfid || "").trim();
  const externalUserID = (target?.external_userid || "").trim();
  if (!runID || !key.trim() || !openKFID || !externalUserID) return;
  const payload = JSON.stringify({
    runID,
    targetKey: key,
    source: "automation_dispatch",
    at: Date.now(),
  });
  try {
    window.sessionStorage.setItem(RECENT_NAVIGATION_STORAGE_KEY, payload);
  } catch {
    // Some embedded WebViews restrict sessionStorage during navigation.
  }
  try {
    window.localStorage.setItem(RECENT_NAVIGATION_STORAGE_KEY, payload);
  } catch {
    // localStorage is only a reload bridge; the action can still retry safely.
  }
  const handoff = JSON.stringify({
    run_id: runID,
    open_kfid: openKFID,
    external_userid: externalUserID,
    source: "automation_dispatch",
    selected_at: new Date().toISOString(),
    expires_at: Date.now() + AUTOMATION_NAVIGATION_HANDOFF_TTL_MS,
  });
  try {
    window.sessionStorage.setItem(
      AUTOMATION_NAVIGATION_HANDOFF_STORAGE_KEY,
      handoff,
    );
  } catch {
    // Best effort only.
  }
  try {
    window.localStorage.setItem(
      AUTOMATION_NAVIGATION_HANDOFF_STORAGE_KEY,
      handoff,
    );
  } catch {
    // Best effort only.
  }
}

function hasRecentAutomationNavigation(
  runID: string,
  target?: { open_kfid?: string; external_userid?: string },
): boolean {
  if (typeof window === "undefined" || !runID) return false;
  let raw = "";
  try {
    raw = window.sessionStorage.getItem(RECENT_NAVIGATION_STORAGE_KEY) || "";
  } catch {
    raw = "";
  }
  if (!raw) {
    try {
      raw = window.localStorage.getItem(RECENT_NAVIGATION_STORAGE_KEY) || "";
    } catch {
      raw = "";
    }
  }
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as {
      runID?: string;
      targetKey?: string;
      source?: string;
      at?: number;
    };
    const matched =
      (parsed.runID || "").trim() === runID &&
      (parsed.source || "").trim() === "automation_dispatch" &&
      (parsed.targetKey || "") === targetKey(target) &&
      typeof parsed.at === "number" &&
      Date.now() - parsed.at <= RECENT_NAVIGATION_TTL_MS;
    if (
      !matched &&
      typeof parsed.at === "number" &&
      Date.now() - parsed.at > RECENT_NAVIGATION_TTL_MS
    ) {
      try {
        window.sessionStorage.removeItem(RECENT_NAVIGATION_STORAGE_KEY);
      } catch {
        // Best-effort cleanup only.
      }
      try {
        window.localStorage.removeItem(RECENT_NAVIGATION_STORAGE_KEY);
      } catch {
        // Best-effort cleanup only.
      }
    }
    return matched;
  } catch {
    return false;
  }
}

function readAutomationNavigationContext(
  runID?: string,
): { openKFID: string; externalUserID: string } | null {
  if (typeof window === "undefined") return null;
  let raw = "";
  try {
    raw =
      window.sessionStorage.getItem(
        AUTOMATION_NAVIGATION_HANDOFF_STORAGE_KEY,
      ) ||
      window.localStorage.getItem(AUTOMATION_NAVIGATION_HANDOFF_STORAGE_KEY) ||
      "";
  } catch {
    raw = "";
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      run_id?: string;
      open_kfid?: string;
      external_userid?: string;
      source?: string;
      expires_at?: number;
    };
    const expectedRunID = (runID || "").trim();
    const handoffRunID = (parsed.run_id || "").trim();
    const openKFID = (parsed.open_kfid || "").trim();
    const externalUserID = (parsed.external_userid || "").trim();
    if ((parsed.source || "").trim() !== "automation_dispatch") return null;
    if (!expectedRunID && handoffRunID) return null;
    if (expectedRunID && handoffRunID && expectedRunID !== handoffRunID) {
      return null;
    }
    if (
      Number(parsed.expires_at || 0) > 0 &&
      Date.now() > Number(parsed.expires_at)
    ) {
      return null;
    }
    if (!openKFID || !externalUserID) return null;
    return { openKFID, externalUserID };
  } catch {
    return null;
  }
}

type FlowTone = "blue" | "emerald" | "amber" | "rose" | "slate";
type FlowVisual =
  | "idle"
  | "handoff"
  | "typing"
  | "ack"
  | "confirm"
  | "review"
  | "done";

type FlowPresentation = {
  eyebrow: string;
  title: string;
  subtitle: string;
  nextStep: string;
  tone: FlowTone;
  visual: FlowVisual;
};

function flowToneClasses(tone: FlowTone): {
  shell: string;
  panel: string;
  ring: string;
  accent: string;
  muted: string;
  indicator: string;
  glow: string;
} {
  if (tone === "emerald") {
    return {
      shell:
        "border-emerald-200/80 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.92))]",
      panel: "border-emerald-200/70 bg-emerald-50/85",
      ring: "border-emerald-200/80",
      accent: "text-emerald-700",
      muted: "text-emerald-900/80",
      indicator: "bg-emerald-500",
      glow: "shadow-[0_18px_45px_rgba(16,185,129,0.16)]",
    };
  }
  if (tone === "amber") {
    return {
      shell:
        "border-amber-200/80 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,251,235,0.92))]",
      panel: "border-amber-200/70 bg-amber-50/85",
      ring: "border-amber-200/80",
      accent: "text-amber-700",
      muted: "text-amber-900/80",
      indicator: "bg-amber-500",
      glow: "shadow-[0_18px_45px_rgba(245,158,11,0.16)]",
    };
  }
  if (tone === "rose") {
    return {
      shell:
        "border-rose-200/80 bg-[radial-gradient(circle_at_top,_rgba(244,63,94,0.16),_transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,242,0.92))]",
      panel: "border-rose-200/70 bg-rose-50/85",
      ring: "border-rose-200/80",
      accent: "text-rose-700",
      muted: "text-rose-900/80",
      indicator: "bg-rose-500",
      glow: "shadow-[0_18px_45px_rgba(244,63,94,0.14)]",
    };
  }
  if (tone === "slate") {
    return {
      shell:
        "border-slate-200/80 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.14),_transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))]",
      panel: "border-slate-200/75 bg-white/85",
      ring: "border-slate-200/80",
      accent: "text-slate-700",
      muted: "text-slate-900/80",
      indicator: "bg-slate-500",
      glow: "shadow-[0_18px_45px_rgba(15,23,42,0.08)]",
    };
  }
  return {
    shell:
      "border-blue-200/80 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.92))]",
    panel: "border-blue-200/70 bg-blue-50/85",
    ring: "border-blue-200/80",
    accent: "text-blue-700",
    muted: "text-slate-900/80",
    indicator: "bg-blue-500",
    glow: "shadow-[0_18px_45px_rgba(59,130,246,0.14)]",
  };
}

function toneBadgeVariant(
  tone: FlowTone,
): "default" | "secondary" | "success" | "warning" | "destructive" {
  if (tone === "emerald") return "success";
  if (tone === "amber") return "warning";
  if (tone === "rose") return "destructive";
  if (tone === "slate") return "secondary";
  return "default";
}

function buildFlowPresentation(input: {
  actionType: string;
  snapshot: ToolbarRPABootstrap | null;
  hasActiveRun: boolean;
  automationEnabled: boolean;
  hasPendingWindow: boolean;
  reviewSessionsCount: number;
}): FlowPresentation {
  const {
    actionType,
    snapshot,
    hasActiveRun,
    automationEnabled,
    hasPendingWindow,
    reviewSessionsCount,
  } = input;
  if (!automationEnabled) {
    return {
      eyebrow: "待开启",
      title: "自动模式未开启",
      subtitle: "切换到自动模式后，工具栏会开始守护新的发送任务。",
      nextStep: "当前仍可随时切回人工模式处理会话。",
      tone: "slate",
      visual: "idle",
    };
  }
  if (!hasActiveRun && hasPendingWindow) {
    return {
      eyebrow: "恢复中",
      title: "客户消息已进入恢复队列",
      subtitle: "已记录待发送任务，正在等待发送服务恢复后继续处理。",
      nextStep: "服务恢复后会自动生成发送任务，无需重新触发客户消息。",
      tone: "amber",
      visual: "ack",
    };
  }
  if (actionType === "navigate_to_chat") {
    return {
      eyebrow: "即将切换",
      title: "即将进入下一会话",
      subtitle: "准备切换到目标会话，进入后会继续自动推进发送流程。",
      nextStep: "会话进入完成后，工具栏会继续填入消息并等待发送确认。",
      tone: "blue",
      visual: "handoff",
    };
  }
  if (actionType === "fill_current_message") {
    return {
      eyebrow: "正在准备",
      title: "正在填入消息",
      subtitle: "已经进入目标会话，正在把当前回复内容填入输入框。",
      nextStep: "填入完成后，会等待发送端点击发送。",
      tone: "blue",
      visual: "typing",
    };
  }
  if (actionType === "wait_rpa_ack") {
    return {
      eyebrow: "等待确认",
      title: "等待点击发送",
      subtitle: "消息已填入输入框，正在等待发送端确认已点击发送。",
      nextStep: "确认点击后，才会继续推进后续会话。",
      tone: "amber",
      visual: "ack",
    };
  }
  if (actionType === "wait_wecom_confirm") {
    return {
      eyebrow: "后台确认",
      title: "已点击发送，正在后台确认",
      subtitle: "发送端已点击发送，企业微信消息记录会继续异步确认。",
      nextStep: "当前界面保持守护中，确认结果回来后会继续推进。",
      tone: "emerald",
      visual: "confirm",
    };
  }
  if (actionType === "review_auto_resend") {
    return {
      eyebrow: "人工复核",
      title: "正在进入复核会话",
      subtitle: "即将进入需要人工复核的会话，并在 5 秒后自动复查确认结果。",
      nextStep: "如果仍未确认成功，会重新发起当前消息。",
      tone: "amber",
      visual: "review",
    };
  }
  if (actionType === "need_manual") {
    return {
      eyebrow: "需要关注",
      title: "当前消息需要人工复核",
      subtitle: "自动模式发现当前消息无法可靠确认，需要你看一眼后再继续。",
      nextStep: "进入复核后，工具栏会继续接手后续流程。",
      tone: "rose",
      visual: "review",
    };
  }
  if (actionType === "completed") {
    return {
      eyebrow: "已完成",
      title: "当前会话已处理完成",
      subtitle: "这一轮发送已经结束，正在检查是否还有下一条待处理任务。",
      nextStep: "如果还有新的会话任务，工具栏会继续自动接手。",
      tone: "emerald",
      visual: "done",
    };
  }
  if (reviewSessionsCount > 0) {
    return {
      eyebrow: "待复核",
      title: "有会话正在等待人工复核",
      subtitle: "自动模式会先完成当前会话，然后按顺序进入待复核会话继续处理。",
      nextStep: "你也可以提前点进复核队列，让当前消息优先自动复查。",
      tone: "amber",
      visual: "review",
    };
  }
  if (actionType === "idle_poll" || !hasActiveRun) {
    return {
      eyebrow: "守护中",
      title: "自动模式守护中",
      subtitle: "当前没有新的发送动作，工具栏正在后台等待下一条任务。",
      nextStep: "有新任务时，这里会自动显示会话和消息内容。",
      tone: "slate",
      visual: "idle",
    };
  }
  return {
    eyebrow: phaseEyebrow(snapshot?.phase),
    title: "自动模式正在推进当前流程",
    subtitle: "当前会话的动作会继续自动推进，无需手动刷新。",
    nextStep: "如果需要，仍可在下方直接暂停、继续或重试当前消息。",
    tone: "blue",
    visual: "typing",
  };
}

function phaseEyebrow(value?: string): string {
  switch ((value || "").trim()) {
    case "fill_current_message":
      return "正在准备";
    case "wait_rpa_ack":
      return "等待确认";
    case "wait_wecom_confirm":
    case "async_confirming":
      return "后台确认";
    case "review_auto_resend":
    case "confirm_uncertain":
      return "待复核";
    case "completed":
      return "已完成";
    case "pausing":
      return "暂停待生效";
    case "paused":
      return "已暂停";
    case "idle":
      return "守护中";
    default:
      return "处理中";
  }
}

function runStatusLabel(value?: string): string {
  switch ((value || "").trim()) {
    case "running":
      return "处理中";
    case "pausing":
      return "暂停待生效";
    case "paused":
      return "已暂停";
    case "stopped":
      return "已停止";
    case "completed":
      return "已完成";
    case "need_manual":
      return "需要人工";
    case "failed":
      return "失败";
    case "created":
      return "待开始";
    default:
      return "处理中";
  }
}

function sessionStatusLabel(value?: string): string {
  switch ((value || "").trim()) {
    case "active":
      return "处理中";
    case "waiting_message_confirm":
      return "等待确认";
    case "confirm_uncertain":
      return "等待复核";
    case "review_resend_pending":
      return "已排队复核";
    case "completed":
      return "已完成";
    case "skipped":
      return "已跳过";
    case "need_manual":
      return "需要人工";
    case "failed":
      return "失败";
    default:
      return "等待复核";
  }
}

function reviewListStatusLabel(value?: string): string {
  switch ((value || "").trim()) {
    case "confirm_uncertain":
      return "发送记录超时确认";
    case "review_resend_pending":
      return "正在复查发送结果";
    case "need_manual":
      return "需要人工确认";
    case "failed":
      return "发送异常待处理";
    default:
      return sessionStatusLabel(value);
  }
}

function statusTextForAutomation(
  snapshot: ToolbarRPABootstrap | null,
  automationEnabled: boolean,
  hasActiveRun: boolean,
): string {
  if (!automationEnabled) return "待开启";
  if (hasActiveRun) return runStatusLabel(snapshot?.run?.status);
  return "守护中";
}

function stopCopyForReason(reason?: string): {
  title: string;
  detail: string;
} {
  switch ((reason || "").trim()) {
    case "pause_timeout":
      return {
        title: "自动发送已自动停止",
        detail: "暂停超过 60 秒未恢复，系统已自动停止自动发送。",
      };
    case "manual":
      return {
        title: "自动发送已停止",
        detail: "你已手动停止自动发送，点击底部“自动发送”可重新开启。",
      };
    default:
      return {
        title: "自动发送未启动",
        detail: "点击底部“自动发送”后，工具栏会开始守护待发送任务。",
      };
  }
}

function completedOverlayDurationMS(snapshot?: ToolbarRPABootstrap | null): number {
  const totalPending = Number(snapshot?.queue_summary?.total_pending || 0);
  if (totalPending > 0) return 1000;
  if (snapshot?.operator_view?.next_queued_task || snapshot?.operator_view?.pending_window) {
    return 1000;
  }
  return 2200;
}

function liveDots(colorClass: string) {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`toolbar-rpa-dot h-1.5 w-1.5 rounded-full ${colorClass}`}
          style={{ animationDelay: `${index * 0.16}s` }}
        />
      ))}
    </div>
  );
}

function bounceDots(colorClass: string) {
  return (
    <span className="ml-0.5 mt-0.5 flex items-center justify-center gap-0.5">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`h-1 w-1 animate-bounce rounded-full ${colorClass}`}
          style={{ animationDelay: `${index * 150}ms` }}
        />
      ))}
    </span>
  );
}

function FlowVisualGlyph({
  visual,
  tone,
}: {
  visual: FlowVisual;
  tone: FlowTone;
}) {
  const styles = flowToneClasses(tone);
  const iconClass = `h-5 w-5 ${styles.accent}`;
  const haloClass = `toolbar-rpa-halo absolute inset-0 rounded-[26px] border ${styles.ring}`;

  return (
    <div
      className={`relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[26px] border ${styles.panel} ${styles.glow}`}
    >
      <div className={haloClass} />
      {visual === "handoff" ? (
        <div className="relative flex items-center gap-1">
          <span
            className={`toolbar-rpa-pill h-2 w-2 rounded-full ${styles.indicator}`}
          />
          <ArrowRight className={`${iconClass} toolbar-rpa-slide`} />
          <span
            className={`toolbar-rpa-pill h-2 w-2 rounded-full ${styles.indicator}`}
          />
        </div>
      ) : null}
      {visual === "typing" ? (
        <div className="flex items-end gap-1">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={`toolbar-rpa-bar w-1.5 rounded-full ${styles.indicator}`}
              style={{
                height: `${18 - index * 3}px`,
                animationDelay: `${index * 0.12}s`,
              }}
            />
          ))}
        </div>
      ) : null}
      {visual === "ack" ? (
        <>
          <LoaderCircle className={`${iconClass} animate-spin`} />
          <div className="absolute bottom-3">{liveDots(styles.indicator)}</div>
        </>
      ) : null}
      {visual === "confirm" ? (
        <>
          <CheckCircle2 className={`${iconClass} toolbar-rpa-soft-pop`} />
          <div
            className={`toolbar-rpa-orbit absolute inset-2 rounded-[22px] border ${styles.ring}`}
          />
        </>
      ) : null}
      {visual === "review" ? (
        <>
          <Sparkles className={`${iconClass} toolbar-rpa-soft-pop`} />
          <div className="absolute bottom-3">{liveDots(styles.indicator)}</div>
        </>
      ) : null}
      {visual === "done" ? (
        <>
          <CheckCircle2 className={`${iconClass} toolbar-rpa-soft-pop`} />
          <div
            className={`toolbar-rpa-glint absolute inset-1 rounded-[24px] ${styles.panel}`}
          />
        </>
      ) : null}
      {visual === "idle" ? (
        <>
          <Bot className={`${iconClass} toolbar-rpa-soft-pop`} />
          <div className="absolute bottom-3">{liveDots(styles.indicator)}</div>
        </>
      ) : null}
    </div>
  );
}

export function ToolbarRPAMode({
  runId,
  initialBootstrap,
  initialAutomationEnabled = false,
  allowInactivePanel = false,
  currentSessionContext,
  channelDisplayMap,
  onAutomationModeChange,
  isUpdatingAutomationMode = false,
  onExitRPAMode,
}: Props) {
  const [snapshot, setSnapshot] = useState<ToolbarRPABootstrap | null>(
    initialBootstrap || null,
  );
  const [isLoading, setIsLoading] = useState(!initialBootstrap);
  const [notice, setNotice] = useState("");
  const [errorText, setErrorText] = useState("");
  const [commandLoading, setCommandLoading] = useState("");
  const [isTargetFlashing, setIsTargetFlashing] = useState(false);
  const [isReturnManualDialogOpen, setIsReturnManualDialogOpen] =
    useState(false);
  const [skippedNavigationPipelineKey, setSkippedNavigationPipelineKey] =
    useState("");
  const [knownCurrentConversation, setKnownCurrentConversation] = useState(
    () => {
      const handoffContext = readAutomationNavigationContext(runId);
      return handoffContext || currentRuntimeContext(currentSessionContext);
    },
  );
  const [completedOverlay, setCompletedOverlay] = useState<{
    snapshot: ToolbarRPABootstrap;
    signature: string;
  } | null>(null);
  const [streamState, setStreamState] = useState<
    "idle" | "connecting" | "open" | "error"
  >("idle");
  const [streamLastActivityAt, setStreamLastActivityAt] = useState(0);
  const [streamConnectingSince, setStreamConnectingSince] = useState(0);
  const [viewClock, setViewClock] = useState(() => Date.now());
  const [localPauseDeadlineMS, setLocalPauseDeadlineMS] = useState(0);
  const [localStopReason, setLocalStopReason] = useState("");
  const [boundRunID, setBoundRunID] = useState(
    (
      initialBootstrap?.run?.run_id ||
      (!allowInactivePanel || initialAutomationEnabled ? runId : "") ||
      ""
    ).trim(),
  );
  const timerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const completedOverlayTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef("");
  const knownCurrentConversationRef = useRef(knownCurrentConversation);
  const currentSessionContextRef = useRef(currentSessionContext);
  const pauseTimeoutRefreshRef = useRef({
    inFlight: false,
    key: "",
    lastRequestedAt: 0,
  });
  const lastPausedTaskViewRef = useRef<ToolbarRPAOperatorTaskView | null>(
    null,
  );
  const consumedActionKeysRef = useRef<Set<string>>(new Set());
  const debugSignatureRef = useRef<Record<string, string>>({});
  const hasObservedActiveRunRef = useRef(false);
  const previousSnapshotRef = useRef<ToolbarRPABootstrap | null>(
    initialBootstrap || null,
  );
  const lastActualSnapshotRef = useRef<ToolbarRPABootstrap | null>(
    initialBootstrap || null,
  );
  const completedOverlaySignatureRef = useRef("");
  const streamVersionRef = useRef(snapshotRealtimeVersion(initialBootstrap));

  const rawOperatorView = snapshot?.operator_view || null;
  const rawOperatorDisplayState = (
    rawOperatorView?.display?.state || ""
  ).trim();
  const rawOperatorDisplayNextState = (
    rawOperatorView?.display?.next_state_after_hold || ""
  ).trim();
  const rawOperatorDisplayHoldUntil = (
    rawOperatorView?.display?.hold_until || ""
  ).trim();
  const rawOperatorAutomationStatus = (
    rawOperatorView?.automation?.status || ""
  ).trim();
  const rawOperatorDisplayHoldUntilMS = rawOperatorDisplayHoldUntil
    ? Date.parse(rawOperatorDisplayHoldUntil)
    : 0;
  const operatorDisplayHoldExpired =
    (rawOperatorDisplayState === "completed" ||
      rawOperatorDisplayState === "stopped") &&
    rawOperatorDisplayNextState !== "" &&
    Number.isFinite(rawOperatorDisplayHoldUntilMS) &&
    rawOperatorDisplayHoldUntilMS > 0 &&
    rawOperatorDisplayHoldUntilMS <= viewClock;
  const operatorView =
    operatorDisplayHoldExpired && rawOperatorView?.after_hold_view
      ? rawOperatorView.after_hold_view
      : rawOperatorView;
  const effectiveSnapshot = operatorView?.rpa_state || snapshot || null;
  const stableRunID = (
    operatorView?.run?.run_id ||
    effectiveSnapshot?.run?.run_id ||
    boundRunID ||
    ""
  ).trim();
  const operatorDisplayState = (operatorView?.display?.state || "").trim();
  const effectiveOperatorDisplayState = operatorDisplayState;
  const operatorAutomationStatus = (
    operatorView?.automation?.status || ""
  ).trim();
  const operatorStopReason = (
    operatorView?.automation?.stop_reason ||
    rawOperatorView?.automation?.stop_reason ||
    ""
  ).trim();
  const effectiveOperatorAutomationStatus =
    operatorDisplayHoldExpired &&
    rawOperatorDisplayNextState === "paused" &&
    rawOperatorAutomationStatus === "pausing" &&
    !operatorView?.automation?.status
      ? "paused"
      : operatorAutomationStatus;
  const operatorPauseDeadlineAt = (
    operatorView?.automation?.pause_deadline_at || ""
  ).trim();
  const operatorPauseDeadlineMS = operatorPauseDeadlineAt
    ? Date.parse(operatorPauseDeadlineAt)
    : 0;
  const effectivePauseDeadlineMS =
    Number.isFinite(operatorPauseDeadlineMS) && operatorPauseDeadlineMS > 0
      ? operatorPauseDeadlineMS
      : localPauseDeadlineMS;
  const isRealtimePrimary = Boolean(
    snapshot?.stream_ready || snapshotRealtimeVersion(snapshot) > 0,
  );
  const streamLastActivityAgeMS =
    streamLastActivityAt > 0 ? Math.max(0, viewClock - streamLastActivityAt) : 0;
  const streamConnectingAgeMS =
    streamConnectingSince > 0
      ? Math.max(0, viewClock - streamConnectingSince)
      : 0;
  const streamIsFresh =
    streamState === "open" &&
    streamLastActivityAt > 0 &&
    streamLastActivityAgeMS <= STREAM_STALE_FALLBACK_MS;
  const streamIsWithinReconnectGrace =
    streamState === "connecting" &&
    streamConnectingSince > 0 &&
    streamConnectingAgeMS <= STREAM_CONNECTING_FALLBACK_MS;
  const isRealtimeDriven =
    isRealtimePrimary && (streamIsFresh || streamIsWithinReconnectGrace);
  const streamFallbackReason = !isRealtimePrimary
    ? "projection_unavailable"
    : streamState === "open"
      ? "stream_stale"
      : streamState === "connecting"
        ? "stream_reconnect_timeout"
        : streamState || "stream_unavailable";
  const action = snapshot?.action || null;
  const actionType = (action?.type || "").trim();
  const currentPipelineKey = [
    stableRunID || runId || "",
    action?.session_task_id ||
      snapshot?.run?.current_session_task_id ||
      snapshot?.session_task?.session_task_id ||
      action?.task_id ||
      "",
  ].join(":");
  const pendingWindow =
    effectiveSnapshot?.pending_window || snapshot?.pending_window || null;
  const runStatus = (
    effectiveSnapshot?.run?.status ||
    snapshot?.run?.status ||
    ""
  )
    .trim()
    .toLowerCase();
  const runIsTerminal =
    Boolean(stableRunID) && TERMINAL_RUN_STATUSES.has(runStatus);
  const hasActiveRun = Boolean(stableRunID) && !runIsTerminal;
  if (hasActiveRun) {
    hasObservedActiveRunRef.current = true;
  }
  const suppressInitialTerminalSnapshot =
    runIsTerminal && !hasObservedActiveRunRef.current;
  const progress = progressPercent(
    (effectiveSnapshot as ToolbarRPABootstrap | null) || snapshot,
  );
  const automationEnabled = snapshot
    ? Boolean(
        operatorView?.automation?.enabled ??
        effectiveSnapshot?.automation?.enabled ??
        snapshot.automation?.enabled ??
        snapshot.enabled,
      )
    : Boolean(initialAutomationEnabled);
  const automationPaused = Boolean(
    effectiveSnapshot?.automation?.paused ||
    snapshot?.automation?.paused ||
    effectiveOperatorAutomationStatus === "paused",
  );
  const isPausing =
    effectiveOperatorAutomationStatus === "pausing" ||
    runStatus === "pausing" ||
    (effectiveSnapshot?.status || snapshot?.status || "").trim() === "pausing";
  const isPaused =
    !isPausing &&
    (effectiveOperatorAutomationStatus === "paused" ||
      automationPaused ||
      runStatus === "paused" ||
      (effectiveSnapshot?.status || snapshot?.status || "").trim() ===
        "paused");
  const pauseTimeoutExpired =
    isPaused &&
    Number.isFinite(effectivePauseDeadlineMS) &&
    effectivePauseDeadlineMS > 0 &&
    effectivePauseDeadlineMS <= viewClock;
  const effectiveStopReason = firstNonEmpty([
    operatorStopReason,
    pauseTimeoutExpired ? "pause_timeout" : "",
    !automationEnabled ? localStopReason : "",
  ]);
  const isStopped =
    effectiveOperatorAutomationStatus === "stopped" ||
    runStatus === "stopped" ||
    effectiveStopReason !== "";
  const snapshotPauseAutoStopRemainingMS = Math.max(
    0,
    Number(
      effectiveSnapshot?.paused_auto_stop_remaining_ms ||
        snapshot?.paused_auto_stop_remaining_ms ||
        0,
    ) || 0,
  );

  const commitKnownCurrentConversation = (context?: {
    openKFID?: string;
    externalUserID?: string;
  }) => {
    const next = {
      openKFID: (context?.openKFID || "").trim(),
      externalUserID: (context?.externalUserID || "").trim(),
    };
    if (!hasConversationIdentity(next)) return;
    const prev = knownCurrentConversationRef.current;
    if (
      (prev.openKFID || "").trim() === next.openKFID &&
      (prev.externalUserID || "").trim() === next.externalUserID
    ) {
      return;
    }
    knownCurrentConversationRef.current = next;
    setKnownCurrentConversation(next);
    rpaDebugLog("当前窗口状态已更新", {
      current_window: debugConversationContext(next),
    });
  };

  const debugWindowSnapshot = (
    extra?: Record<string, unknown>,
  ): Record<string, unknown> => ({
    action_type: actionType || "",
    run_id: stableRunID || "",
    run_version: snapshot?.run?.version || 0,
    current_window: debugConversationContext(
      knownCurrentConversationRef.current,
    ),
    parent_context: debugSessionContext(currentSessionContext),
    backend_current_session: debugSessionContext(snapshot?.current_session),
    backend_target_session: debugSessionContext(snapshot?.target_session),
    action_target: debugTargetContext(action?.target),
    navigation: snapshot?.navigation || null,
    ...extra,
  });

  const debugOnChange = (
    stage: string,
    signature: string,
    detail?: Record<string, unknown>,
  ) => {
    const nextSignature = signature || "__empty__";
    if (debugSignatureRef.current[stage] === nextSignature) return;
    debugSignatureRef.current[stage] = nextSignature;
    rpaDebugLog(stage, detail);
  };

  useEffect(() => {
    const context = currentRuntimeContext(currentSessionContext);
    if (!hasConversationIdentity(context)) return;
    commitKnownCurrentConversation(context);
  }, [
    currentSessionContext?.external_userid,
    currentSessionContext?.open_kfid,
  ]);

  useEffect(() => {
    if (!isPaused) {
      setLocalPauseDeadlineMS(0);
      pauseTimeoutRefreshRef.current = {
        inFlight: false,
        key: "",
        lastRequestedAt: 0,
      };
      return;
    }
    if (
      Number.isFinite(operatorPauseDeadlineMS) &&
      operatorPauseDeadlineMS > 0
    ) {
      setLocalPauseDeadlineMS(operatorPauseDeadlineMS);
      return;
    }
    if (snapshotPauseAutoStopRemainingMS <= 0) return;
    setLocalPauseDeadlineMS((current) => {
      const now = Date.now();
      if (Number.isFinite(current) && current > now) return current;
      return now + snapshotPauseAutoStopRemainingMS;
    });
  }, [
    isPaused,
    operatorPauseDeadlineMS,
    snapshotPauseAutoStopRemainingMS,
    snapshot?.request_id,
    snapshot?.run?.version,
    stableRunID,
  ]);

  useEffect(() => {
    const nextReason = firstNonEmpty([
      operatorStopReason,
      pauseTimeoutExpired ? "pause_timeout" : "",
    ]);
    if (nextReason) {
      setLocalStopReason(nextReason);
      return;
    }
    if (automationEnabled && !isPaused && !isStopped) {
      setLocalStopReason("");
    }
  }, [
    automationEnabled,
    isPaused,
    isStopped,
    operatorStopReason,
    pauseTimeoutExpired,
  ]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearNoticeTimer = () => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
  };

  const clearCompletedOverlayTimer = () => {
    if (completedOverlayTimerRef.current !== null) {
      window.clearTimeout(completedOverlayTimerRef.current);
      completedOverlayTimerRef.current = null;
    }
  };

  useEffect(() => {
    currentSessionContextRef.current = currentSessionContext;
  }, [currentSessionContext?.open_kfid, currentSessionContext?.external_userid]);

  const contextualizeSnapshot = (
    next?: ToolbarRPABootstrap | null,
  ): ToolbarRPABootstrap | null => {
    if (!next) return null;
    const current =
      knownCurrentConversationRef.current?.openKFID ||
      knownCurrentConversationRef.current?.externalUserID
        ? knownCurrentConversationRef.current
        : currentRuntimeContext(currentSessionContextRef.current);
    const derivedAction = deriveContextAwareAction(next, current);
    if (!derivedAction) return next;
    const nextType = (next.action?.type || "").trim();
    const derivedType = (derivedAction.type || "").trim();
    const navigation =
      derivedType === "navigate_to_chat"
        ? {
            required: true,
            already_matched: false,
            delay_ms: next.navigation?.delay_ms || 900,
            flash_count: next.navigation?.flash_count || 4,
          }
        : derivedType === "fill_current_message"
          ? {
              required: false,
              already_matched: true,
              delay_ms: 0,
              flash_count: 0,
            }
          : next.navigation || null;
    if (
      derivedType === nextType &&
      (navigation?.required ?? false) ===
        (next.navigation?.required ?? false) &&
      (navigation?.already_matched ?? false) ===
        (next.navigation?.already_matched ?? false)
    ) {
      return next;
    }
    rpaDebugLog("基于当前窗口上下文重算步骤", {
      current_window: debugConversationContext(current),
      original_action_type: nextType,
      derived_action_type: derivedType,
      target_context: debugTargetContext(derivedAction.target),
      message_status: (next.message_task?.status || "").trim(),
    });
    const displayState =
      derivedType === "fill_current_message"
        ? "fill_current_message"
        : derivedType === "navigate_to_chat"
          ? "navigate_to_chat"
          : derivedType;
    const operatorView = next.operator_view
      ? {
          ...next.operator_view,
          display: next.operator_view.display
            ? {
                ...next.operator_view.display,
                state: displayState,
                reason:
                  next.operator_view.display.reason ||
                  derivedAction.reason ||
                  "",
              }
            : {
                state: displayState,
                reason: derivedAction.reason || "",
                hold_until: "",
                next_state_after_hold: "",
              },
          rpa_state: next.operator_view.rpa_state
            ? {
                ...next.operator_view.rpa_state,
                action: {
                  ...(next.operator_view.rpa_state.action || {}),
                  ...derivedAction,
                },
                navigation,
              }
            : next.operator_view.rpa_state,
        }
      : next.operator_view;
    return {
      ...next,
      action: {
        ...derivedAction,
      },
      navigation,
      operator_view: operatorView,
    };
  };

  const applyNextSnapshot = (
    next?: ToolbarRPABootstrap | null,
    options?: { force?: boolean },
  ) => {
    const contextualized = contextualizeSnapshot(next);
    if (!contextualized) return false;
    setBoundRunID((contextualized.run?.run_id || "").trim());
    streamVersionRef.current = Math.max(
      streamVersionRef.current,
      snapshotRealtimeVersion(contextualized),
    );
    setSnapshot((current) =>
      options?.force || shouldAdoptIncomingBootstrap(current, contextualized)
        ? contextualized
        : current,
    );
    return true;
  };

  const loadBootstrap = async (
    silently = false,
    options?: { forceFresh?: boolean },
  ) => {
    if (!silently) {
      setIsLoading(true);
      setErrorText("");
    }
    try {
      const runIDForBootstrap =
        !automationEnabled && allowInactivePanel
          ? ""
          : runIsTerminal
            ? ""
            : stableRunID;
      const target = action?.target || {
        open_kfid: snapshot?.session_task?.open_kfid,
        external_userid: snapshot?.session_task?.external_userid,
      };
      const handoffContext = readAutomationNavigationContext(runIDForBootstrap);
      if (handoffContext) {
        commitKnownCurrentConversation(handoffContext);
      }
      const context = await resolveRuntimeContext(
        currentSessionContext,
        handoffContext || knownCurrentConversationRef.current,
      );
      const recentlyNavigated = hasRecentAutomationNavigation(
        runIDForBootstrap,
        target,
      );
      const useTargetContext =
        recentlyNavigated && isSameConversation(context, target, true);
      const requestContext = {
        openKFID:
          context.openKFID || (useTargetContext ? target.open_kfid || "" : ""),
        externalUserID:
          context.externalUserID ||
          (useTargetContext ? target.external_userid || "" : ""),
        source: useTargetContext
          ? `${context.source || "local"}+target`
          : context.source,
      };
      debugOnChange(
        "轮询状态：请求后端前",
        [
          runIDForBootstrap,
          actionType,
          snapshot?.run?.version || 0,
          requestContext.openKFID,
          requestContext.externalUserID,
          targetKey(target),
        ].join("\u001f"),
        debugWindowSnapshot({
          silently,
          run_id_for_request: runIDForBootstrap,
          handoff_context: debugConversationContext(handoffContext),
          resolved_context: debugConversationContext(context),
          request_context: debugConversationContext(requestContext),
          recently_navigated: recentlyNavigated,
          use_target_context: useTargetContext,
          force_fresh: options?.forceFresh === true,
        }),
      );
      const next = await getKFToolbarRPABootstrap({
        run_id: runIDForBootstrap,
        open_kfid: requestContext.openKFID,
        external_userid: requestContext.externalUserID,
        force_fresh: options?.forceFresh === true,
      });
      if (!next) {
        throw new Error("自动发送状态暂时不可用");
      }
      const nextActionType = (next.action?.type || "").trim();
      const nextRunID = (next.run?.run_id || "").trim();
      const nextTarget = next.action?.target || {
        open_kfid:
          next.target_session?.open_kfid || next.session_task?.open_kfid || "",
        external_userid:
          next.target_session?.external_userid ||
          next.session_task?.external_userid ||
          "",
        display_name:
          next.target_session?.contact_name ||
          next.session_task?.contact_name ||
          "",
        channel_label:
          next.target_session?.channel_label ||
          next.session_task?.channel_label ||
          "",
      };
      const requestConversation = {
        openKFID: requestContext.openKFID,
        externalUserID: requestContext.externalUserID,
      };
      const nextRunRecentlyNavigated = hasRecentAutomationNavigation(
        nextRunID,
        nextTarget,
      );
      const inferredSkippedNavigation =
        POST_NAVIGATION_ACTION_TYPES.has(nextActionType) &&
        !nextRunRecentlyNavigated &&
        hasConversationIdentity(requestConversation) &&
        isSameConversation(
          requestConversation,
          nextTarget,
          canMatchByExternalOnly(requestConversation, nextTarget),
        );
      debugOnChange(
        "轮询状态：后端快照返回",
        [
          nextRunID,
          next.run?.version || 0,
          nextActionType,
          next.status || "",
          next.queue_summary?.total_pending || 0,
          targetKey(nextTarget),
        ].join("\u001f"),
        {
          request_context: debugConversationContext(requestContext),
          next_action_type: nextActionType,
          next_run_id: nextRunID,
          next_run_version: next.run?.version || 0,
          next_status: (next.status || "").trim(),
          next_current_session: debugSessionContext(next.current_session),
          next_target_session: debugSessionContext(next.target_session),
          next_navigation: next.navigation || null,
          queue_summary: next.queue_summary || null,
          review_manual_total: next.review_manual?.total || 0,
          inferred_navigation_skipped: inferredSkippedNavigation,
          recently_navigated_to_target: nextRunRecentlyNavigated,
        },
      );
      if (inferredSkippedNavigation) {
        const nextPipelineKey = [
          nextRunID || runIDForBootstrap || "",
          next.action?.session_task_id ||
            next.run?.current_session_task_id ||
            next.session_task?.session_task_id ||
            next.action?.task_id ||
            "",
        ].join(":");
        if (nextPipelineKey) {
          setSkippedNavigationPipelineKey(nextPipelineKey);
        }
        debugOnChange("后端已跳过会话切换：直接进入后续步骤", nextPipelineKey, {
          request_context: debugConversationContext(requestContext),
          target_context: debugTargetContext(nextTarget),
          next_action_type: nextActionType,
        });
      }
      applyNextSnapshot(next, {
        force: options?.forceFresh === true,
      });
    } catch (error) {
      if (isAbortLikeError(error)) {
        return;
      }
      setErrorText(normalizeErrorMessage(error));
    } finally {
      if (!silently) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialBootstrap) return;
    void loadBootstrap(false);
  }, []);

  useEffect(() => {
    if (!initialBootstrap) return;
    if (!shouldAdoptIncomingBootstrap(snapshot, initialBootstrap)) {
      return;
    }
    applyNextSnapshot(initialBootstrap);
    setBoundRunID((initialBootstrap.run?.run_id || runId || "").trim());
    setIsLoading(false);
  }, [
    initialBootstrap?.action?.type,
    initialBootstrap?.request_id,
    initialBootstrap?.run?.run_id,
    initialBootstrap?.run?.version,
    initialBootstrap?.status,
    initialBootstrap?.automation?.paused,
    runId,
    snapshot,
  ]);

  useEffect(() => {
    streamVersionRef.current = Math.max(
      streamVersionRef.current,
      snapshotRealtimeVersion(snapshot),
    );
  }, [snapshot?.version, snapshot?.run?.run_id, snapshot?.run?.version]);

  useEffect(() => {
    let timer: number | null = null;
    const now = Date.now();
    if (
      (rawOperatorDisplayState === "completed" ||
        rawOperatorDisplayState === "stopped") &&
      rawOperatorDisplayNextState &&
      Number.isFinite(rawOperatorDisplayHoldUntilMS) &&
      rawOperatorDisplayHoldUntilMS > now
    ) {
      timer = window.setTimeout(
        () => {
          setViewClock(Date.now());
        },
        Math.max(0, rawOperatorDisplayHoldUntilMS - now),
      );
      return () => {
        if (timer !== null) window.clearTimeout(timer);
      };
    }
    if (
      Number.isFinite(effectivePauseDeadlineMS) &&
      effectivePauseDeadlineMS > 0 &&
      (effectiveOperatorAutomationStatus === "paused" || isPaused)
    ) {
      const delay =
        effectivePauseDeadlineMS > now
          ? Math.min(1000, Math.max(0, effectivePauseDeadlineMS - now))
          : 2500;
      timer = window.setTimeout(() => {
        setViewClock(Date.now());
      }, delay);
      return () => {
        if (timer !== null) window.clearTimeout(timer);
      };
    }
  }, [
    effectiveOperatorAutomationStatus,
    isPaused,
    rawOperatorDisplayHoldUntilMS,
    rawOperatorDisplayNextState,
    rawOperatorDisplayState,
    effectivePauseDeadlineMS,
    viewClock,
  ]);

  useEffect(() => {
    if (!isPaused) return;
    if (isRealtimeDriven) return;
    if (
      !Number.isFinite(effectivePauseDeadlineMS) ||
      effectivePauseDeadlineMS <= 0 ||
      effectivePauseDeadlineMS > viewClock
    ) {
      return;
    }
    const refreshKey = [
      stableRunID || snapshot?.request_id || "",
      Math.trunc(effectivePauseDeadlineMS),
    ].join(":");
    const refresh = pauseTimeoutRefreshRef.current;
    if (refresh.inFlight) return;
    if (
      refresh.key === refreshKey &&
      viewClock - refresh.lastRequestedAt < 2500
    ) {
      return;
    }
    pauseTimeoutRefreshRef.current = {
      inFlight: true,
      key: refreshKey,
      lastRequestedAt: viewClock,
    };
    void loadBootstrap(true, { forceFresh: true }).finally(() => {
      pauseTimeoutRefreshRef.current = {
        ...pauseTimeoutRefreshRef.current,
        inFlight: false,
      };
      setViewClock(Date.now());
    });
  }, [
    effectivePauseDeadlineMS,
    isPaused,
    isRealtimeDriven,
    snapshot?.request_id,
    stableRunID,
    viewClock,
  ]);

  useEffect(() => {
    let closed = false;
    let allowCurrentVersionReplay = true;
    const startedAt = Date.now();
    setStreamState("connecting");
    setStreamConnectingSince(startedAt);
    const stream = openToolbarRPAOperatorViewStream({
      since_version: streamVersionRef.current,
      onOpen: () => {
        if (closed) return;
        const now = Date.now();
        setStreamState("open");
        setStreamLastActivityAt(now);
        setStreamConnectingSince(0);
      },
      onError: () => {
        if (closed) return;
        // Native EventSource already reconnects using the server-provided retry interval.
        // Keep the page in realtime mode during a short reconnect grace window. If it
        // stays stale, waiting actions fall back to the low-frequency bootstrap path.
        setStreamState("connecting");
        setStreamConnectingSince((current) => current || Date.now());
      },
      onMessage: (payload) => {
        if (closed) return;
        const now = Date.now();
        setStreamState("open");
        setStreamConnectingSince(0);
        const events = payload.events || [];
        if (events.length > 0) {
          setStreamLastActivityAt(now);
        }
        let nextSnapshot: ToolbarRPABootstrap | null = null;
        for (const event of events) {
          const normalized = normalizeToolbarRPAOperatorStreamEvent(event);
          if (!normalized) continue;
          const nextVersion = snapshotRealtimeVersion(normalized);
          const eventType = (event.event_type || "").trim();
          const isBootstrapRefresh =
            eventType === "toolbar_rpa_operator_view.bootstrap";
          if (
            nextVersion > 0 &&
            ((allowCurrentVersionReplay &&
              !isBootstrapRefresh &&
              nextVersion < streamVersionRef.current) ||
              (!allowCurrentVersionReplay &&
                nextVersion <= streamVersionRef.current))
          ) {
            continue;
          }
          streamVersionRef.current = Math.max(
            streamVersionRef.current,
            nextVersion,
          );
          nextSnapshot = normalized;
        }
        if (events.length > 0) {
          allowCurrentVersionReplay = false;
        }
        if (!nextSnapshot) return;
        applyNextSnapshot(nextSnapshot);
      },
    });
    return () => {
      closed = true;
      if (stream && stream.readyState !== EventSource.CLOSED) {
        stream.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!isRealtimePrimary) return;
    const now = Date.now();
    let delay = 0;
    if (streamState === "open") {
      const age = streamLastActivityAt > 0 ? now - streamLastActivityAt : 0;
      delay = Math.max(1000, STREAM_STALE_FALLBACK_MS - age + 50);
    } else if (streamState === "connecting") {
      const age =
        streamConnectingSince > 0 ? now - streamConnectingSince : 0;
      delay = Math.max(1000, STREAM_CONNECTING_FALLBACK_MS - age + 50);
    }
    if (delay <= 0) return;
    const timer = window.setTimeout(() => {
      setViewClock(Date.now());
    }, delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    isRealtimePrimary,
    streamConnectingSince,
    streamLastActivityAt,
    streamState,
    viewClock,
  ]);

  useEffect(() => {
    if (!snapshot) return;
    if (allowInactivePanel) return;
    if (isStopped) return;
    const hasRealtimeOperatorView = Boolean(
      snapshot.stream_ready || snapshot.operator_view,
    );
    const realtimeAutomationEnabled = Boolean(
      snapshot.operator_view?.automation?.enabled ??
      snapshot.automation?.enabled ??
      snapshot.enabled,
    );
    const realtimeDisplayState = (
      snapshot.operator_view?.display?.state || ""
    ).trim();
    if (
      (snapshot.run?.status || "").trim() === "stopped" ||
      ((snapshot.status || "").trim() === "closed" &&
        Boolean(snapshot.run?.run_id))
    ) {
      return;
    }
    if (hasRealtimeOperatorView) {
      if (realtimeAutomationEnabled) return;
      if (realtimeDisplayState) return;
      if (effectiveOperatorAutomationStatus === "stopped") return;
    }
    if (
      (snapshot.mode || "").trim() === "rpa" &&
      (snapshot.enabled || snapshot.automation?.enabled)
    ) {
      return;
    }
    if (!onExitRPAMode) return;
    void onExitRPAMode();
  }, [
    onExitRPAMode,
    allowInactivePanel,
    effectiveOperatorAutomationStatus,
    isStopped,
    snapshot,
    snapshot?.automation?.enabled,
    snapshot?.enabled,
    snapshot?.mode,
    snapshot?.run?.run_id,
    snapshot?.run?.status,
    snapshot?.status,
  ]);

  useEffect(() => {
    if (isRealtimeDriven) return;
    if (!runIsTerminal || !automationEnabled) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setBoundRunID("");
      void loadBootstrap(true);
    }, 900);
  }, [automationEnabled, isRealtimeDriven, runIsTerminal, stableRunID]);

  useEffect(() => {
    const previous = lastActualSnapshotRef.current;
    previousSnapshotRef.current = previous;
    if (
      !snapshot?.operator_view?.display?.state &&
      shouldShowCompletedTransition(previous, snapshot) &&
      previous
    ) {
      const signature = [
        previous.run?.run_id || "",
        previous.run?.version || 0,
        snapshot?.run?.run_id || "",
        snapshot?.run?.version || 0,
        snapshot?.status || "",
        snapshot?.action?.type || "",
      ].join("\u001f");
      if (completedOverlaySignatureRef.current !== signature) {
        completedOverlaySignatureRef.current = signature;
        setCompletedOverlay({
          snapshot: previous,
          signature,
        });
      }
    }
    lastActualSnapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (!completedOverlay) return;
    clearCompletedOverlayTimer();
    const durationMS = completedOverlayDurationMS(completedOverlay.snapshot);
    completedOverlayTimerRef.current = window.setTimeout(() => {
      setCompletedOverlay(null);
      completedOverlayTimerRef.current = null;
    }, durationMS);
    return clearCompletedOverlayTimer;
  }, [completedOverlay?.signature]);

  useEffect(() => {
    clearTimer();
    return () => {
      clearTimer();
      clearNoticeTimer();
      clearCompletedOverlayTimer();
    };
  }, []);

  useEffect(() => {
    clearNoticeTimer();
    if (!notice) return;
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice("");
      noticeTimerRef.current = null;
    }, 2600);
    return clearNoticeTimer;
  }, [notice]);

  useEffect(() => {
    clearTimer();
    if (!snapshot || !action) return;
    const key = `${stableRunID}:${action.task_id || ""}:${actionType}:${snapshot.run?.version || 0}`;
    if (!actionType || inFlightRef.current === key) return;
    if (
      ![
        "navigate_to_chat",
        "fill_current_message",
        "idle_poll",
        "wait_rpa_ack",
        "wait_wecom_confirm",
        "review_auto_resend",
        "completed",
      ].includes(actionType)
    )
      return;
    const shouldConsumeOnce = ONE_SHOT_ACTION_TYPES.has(actionType);
    const oneShotActionKey = shouldConsumeOnce
      ? actionExecutionKey(stableRunID, actionType, action)
      : "";
    if (
      shouldConsumeOnce &&
      consumedActionKeysRef.current.has(oneShotActionKey)
    ) {
      debugOnChange(
        "动作已执行过：等待后端进入下一步",
        oneShotActionKey,
        debugWindowSnapshot({
          action_key: oneShotActionKey,
          poll_after_ms: action.poll_after_ms || snapshot.poll_after_ms || 1200,
        }),
      );
      if (isRealtimeDriven) {
        return;
      }
      timerRef.current = window.setTimeout(
        () => {
          void loadBootstrap(true);
        },
        Math.max(900, action.poll_after_ms || snapshot.poll_after_ms || 1200),
      );
      return;
    }
    if (shouldConsumeOnce) {
      consumedActionKeysRef.current.add(oneShotActionKey);
    }
    inFlightRef.current = key;
    let active = true;
    const actionDebugSignature = [
      stableRunID,
      snapshot.run?.version || 0,
      actionType,
      action.session_task_id || "",
      action.message_task_id || action.task_id || "",
      targetKey(action.target),
    ].join("\u001f");
    debugOnChange(
      "开始处理自动发送步骤",
      actionDebugSignature,
      debugWindowSnapshot({
        effect_key: key,
        action_key: oneShotActionKey,
        consume_once: shouldConsumeOnce,
        message_task_id: (action.message_task_id || "").trim(),
        session_task_id: (action.session_task_id || "").trim(),
        poll_after_ms: action.poll_after_ms || snapshot.poll_after_ms || 0,
      }),
    );

    const run = async () => {
      try {
        if (actionType === "navigate_to_chat") {
          const targetContext = contextFromTarget(action.target);
          const trustedCurrent = knownCurrentConversationRef.current;
          const context = await resolveRuntimeContext(
            currentSessionContext,
            trustedCurrent,
          );
          const navigation = snapshot.navigation || {};
          const knownCurrentDiffers =
            hasConversationIdentity(trustedCurrent) &&
            isKnownDifferentConversation(trustedCurrent, action.target);
          const allowExternalOnlyMatch =
            hasRecentAutomationNavigation(stableRunID, action.target) ||
            canMatchByExternalOnly(context, action.target);
          const locallyMatched = isSameConversation(
            context,
            action.target,
            allowExternalOnlyMatch,
          );
          const shouldSkipNavigation =
            locallyMatched ||
            ((navigation.already_matched || navigation.required === false) &&
              !knownCurrentDiffers);
          rpaDebugLog("判断是否需要进入会话", {
            ...debugWindowSnapshot({
              resolved_context: debugConversationContext(context),
              trusted_current: debugConversationContext(trustedCurrent),
              target_context: debugConversationContext(targetContext),
              backend_navigation: navigation,
              known_current_differs: knownCurrentDiffers,
              allow_external_only_match: allowExternalOnlyMatch,
              locally_matched: locallyMatched,
              decision: shouldSkipNavigation
                ? "跳过进入会话：已在目标会话"
                : "准备进入目标会话",
            }),
          });
          if (shouldSkipNavigation) {
            setSkippedNavigationPipelineKey(currentPipelineKey);
            commitKnownCurrentConversation(targetContext);
            setNotice("当前已在目标会话，跳过会话切换。");
            rpaDebugLog("跳过进入会话：请求下一轮状态", {
              ...debugWindowSnapshot({
                resolved_context: debugConversationContext(context),
                target_context: debugConversationContext(targetContext),
                request_context: debugConversationContext({
                  openKFID: targetContext.openKFID || context.openKFID || "",
                  externalUserID:
                    targetContext.externalUserID ||
                    context.externalUserID ||
                    "",
                }),
              }),
            });
            const next = await getKFToolbarRPABootstrap({
              run_id: stableRunID || "",
              open_kfid: targetContext.openKFID || context.openKFID || "",
              external_userid:
                targetContext.externalUserID || context.externalUserID || "",
            });
            if (!next) {
              throw new Error("自动发送状态暂时不可用");
            }
            if (!active) return;
            applyNextSnapshot(next);
            return;
          }
          setNotice("即将切换目标会话...");
          const flashCount = Math.max(1, navigation.flash_count || 4);
          const flashDelay = Math.max(
            navigation.delay_ms || 0,
            flashCount * 360,
          );
          rpaDebugLog("准备进入会话：开始目标信息闪烁", {
            ...debugWindowSnapshot({
              target_context: debugConversationContext(targetContext),
              flash_count: flashCount,
              flash_delay_ms: flashDelay,
            }),
          });
          setIsTargetFlashing(true);
          await sleep(flashDelay);
          if (!active) return;
          setIsTargetFlashing(false);
          setNotice("正在进入下一个微信客服会话...");
          rememberAutomationNavigation(
            stableRunID || runId || "",
            action.target,
          );
          rpaDebugLog("准备进入会话：调用企业微信打开目标会话", {
            ...debugWindowSnapshot({
              target_context: debugConversationContext(targetContext),
            }),
          });
          await openWecomKfConversation({
            open_kfid: targetContext.openKFID,
            external_userid: targetContext.externalUserID,
          });
          commitKnownCurrentConversation(targetContext);
          await sleep(700);
          const nextContext = await resolveRuntimeContext(
            currentSessionContext,
            targetContext,
          );
          rpaDebugLog("已调用企业微信进入会话：请求下一轮状态", {
            ...debugWindowSnapshot({
              target_context: debugConversationContext(targetContext),
              next_resolved_context: debugConversationContext(nextContext),
            }),
          });
          const next = await getKFToolbarRPABootstrap({
            run_id: stableRunID || "",
            open_kfid: targetContext.openKFID || nextContext.openKFID || "",
            external_userid:
              targetContext.externalUserID || nextContext.externalUserID || "",
          });
          if (!next) {
            throw new Error("自动发送状态暂时不可用");
          }
          if (!active) return;
          applyNextSnapshot(next, { force: true });
          setNotice("已进入目标会话，准备填入消息。");
          return;
        }
        if (actionType === "completed") {
          debugOnChange(
            "当前单次发送完成：等待拉取下一轮",
            actionDebugSignature,
            debugWindowSnapshot({
              queue_summary: snapshot.queue_summary || null,
              poll_after_ms:
                action.poll_after_ms || snapshot.poll_after_ms || 1200,
            }),
          );
          if (isRealtimeDriven) {
            return;
          }
          timerRef.current = window.setTimeout(
            () => {
              setBoundRunID("");
              void loadBootstrap(true);
            },
            Math.max(
              900,
              action.poll_after_ms || snapshot.poll_after_ms || 1200,
            ),
          );
          return;
        }
        if (
          actionType === "idle_poll" ||
          actionType === "wait_rpa_ack" ||
          actionType === "wait_wecom_confirm"
        ) {
          if (isRealtimeDriven) {
            debugOnChange(
              "等待型步骤：由实时流驱动",
              actionDebugSignature,
              debugWindowSnapshot({
                stream_state: streamState,
                stream_last_activity_age_ms: streamLastActivityAgeMS,
                display_state: effectiveOperatorDisplayState || actionType,
              }),
            );
            return;
          }
          const delay = Math.max(
            1200,
            action.poll_after_ms || snapshot.poll_after_ms || 3000,
          );
          debugOnChange(
            "等待型步骤：按后端间隔继续轮询",
            actionDebugSignature,
            debugWindowSnapshot({
              delay_ms: delay,
              stream_state: streamState,
              stream_fallback_reason: streamFallbackReason,
              stream_last_activity_age_ms: streamLastActivityAgeMS,
              stream_connecting_age_ms: streamConnectingAgeMS,
            }),
          );
          timerRef.current = window.setTimeout(() => {
            void loadBootstrap(true);
          }, delay);
          return;
        }
        if (actionType === "review_auto_resend") {
          if (
            !stableRunID ||
            !action.message_task_id ||
            !action.session_task_id
          ) {
            return;
          }
          const targetContext = contextFromTarget(action.target);
          const trustedCurrent = knownCurrentConversationRef.current;
          const context = await resolveRuntimeContext(
            currentSessionContext,
            trustedCurrent,
          );
          const knownCurrentDiffers =
            hasConversationIdentity(trustedCurrent) &&
            isKnownDifferentConversation(trustedCurrent, action.target);
          const reviewAlreadyMatched =
            !knownCurrentDiffers &&
            isSameConversation(
              context,
              action.target,
              hasRecentAutomationNavigation(stableRunID, action.target) ||
                canMatchByExternalOnly(context, action.target),
            );
          rpaDebugLog("复核步骤：判断当前会话", {
            ...debugWindowSnapshot({
              resolved_context: debugConversationContext(context),
              trusted_current: debugConversationContext(trustedCurrent),
              target_context: debugConversationContext(targetContext),
              known_current_differs: knownCurrentDiffers,
              already_matched: reviewAlreadyMatched,
              decision: reviewAlreadyMatched
                ? "跳过进入会话：已在复核目标会话"
                : "准备进入复核目标会话",
            }),
          });
          if (knownCurrentDiffers || !reviewAlreadyMatched) {
            setNotice("正在进入人工复核会话...");
            rememberAutomationNavigation(
              stableRunID || runId || "",
              action.target,
            );
            rpaDebugLog("复核步骤：调用企业微信打开复核会话", {
              ...debugWindowSnapshot({
                target_context: debugConversationContext(targetContext),
              }),
            });
            await openWecomKfConversation({
              open_kfid: targetContext.openKFID,
              external_userid: targetContext.externalUserID,
            });
            commitKnownCurrentConversation(targetContext);
            await sleep(700);
          }
          setNotice("已进入复核会话，等待 5 秒复查企业微信记录...");
          await sleep(5000);
          const next = await executeKFToolbarRPARunCommand(stableRunID, {
            command: "review_auto_resend",
            session_task_id: action.session_task_id,
            message_task_id: action.message_task_id,
          });
          if (!active) return;
          applyNextSnapshot(next, { force: true });
          setNotice("复核完成，正在继续自动发送。");
          return;
        }
        if (actionType === "fill_current_message") {
          const message = action.message || action.messages?.[0];
          const messageText = (message?.text || "").trim();
          if (
            !stableRunID ||
            !action.message_task_id ||
            !action.session_task_id ||
            !message ||
            !messageText
          ) {
            return;
          }
          const targetContext = contextFromTarget(action.target);
          const trustedCurrent = knownCurrentConversationRef.current;
          rpaDebugLog("填入消息步骤：检查当前会话", {
            ...debugWindowSnapshot({
              trusted_current: debugConversationContext(trustedCurrent),
              target_context: debugConversationContext(targetContext),
              message_task_id: action.message_task_id,
              message_hash: message.message_hash || "",
            }),
          });
          if (
            hasConversationIdentity(targetContext) &&
            hasConversationIdentity(trustedCurrent) &&
            isKnownDifferentConversation(trustedCurrent, action.target)
          ) {
            setNotice("当前不在目标会话，正在重新进入后再填入消息...");
            rpaDebugLog("填入消息步骤：当前窗口不是目标会话，先进入目标会话", {
              ...debugWindowSnapshot({
                trusted_current: debugConversationContext(trustedCurrent),
                target_context: debugConversationContext(targetContext),
              }),
            });
            rememberAutomationNavigation(
              stableRunID || runId || "",
              action.target,
            );
            await openWecomKfConversation({
              open_kfid: targetContext.openKFID,
              external_userid: targetContext.externalUserID,
            });
            commitKnownCurrentConversation(targetContext);
            await sleep(700);
          }
          setNotice("正在填入当前消息，随后会等待发送端点击发送...");
          rpaDebugLog("填入消息步骤：调用企业微信填入文本", {
            ...debugWindowSnapshot({
              target_context: debugConversationContext(targetContext),
              message_task_id: action.message_task_id,
              message_hash: message.message_hash || "",
            }),
          });
          await sendTextToCurrentSession(messageText, {
            external_userid:
              targetContext.externalUserID ||
              currentSessionContext?.external_userid ||
              "",
          });
          const context = await resolveRuntimeContext(
            currentSessionContext,
            knownCurrentConversationRef.current,
          );
          rpaDebugLog("填入消息步骤：上报草稿已填入", {
            ...debugWindowSnapshot({
              resolved_context: debugConversationContext(context),
              target_context: debugConversationContext(targetContext),
              message_task_id: action.message_task_id,
              message_hash: message.message_hash || "",
            }),
          });
          const next = await markKFToolbarRPAMessageDraftFilled(
            action.message_task_id,
            {
              run_id: stableRunID,
              session_task_id: action.session_task_id,
              idempotency_key: newKey(),
              current_open_kfid:
                targetContext.openKFID || context.openKFID || "",
              current_external_userid:
                targetContext.externalUserID || context.externalUserID || "",
              message_hash: message.message_hash || "",
            },
          );
          if (!active) return;
          applyNextSnapshot(next, { force: !isRealtimeDriven });
          setNotice("消息已填入，正在等待点击发送。");
        }
      } catch (error) {
        if (isAbortLikeError(error)) {
          return;
        }
        if (shouldConsumeOnce) {
          consumedActionKeysRef.current.delete(oneShotActionKey);
        }
        if (actionType === "navigate_to_chat") {
          setIsTargetFlashing(false);
        }
        const mapped = normalizeJSSDKRuntimeError(error);
        const message =
          actionType === "navigate_to_chat" ||
          actionType === "fill_current_message" ||
          actionType === "review_auto_resend"
            ? toJSSDKErrorMessage(mapped)
            : normalizeErrorMessage(error);
        rpaDebugLog("自动发送步骤执行失败", {
          ...debugWindowSnapshot({
            error_message: message,
            raw_error: normalizeErrorMessage(error),
          }),
        });
        setErrorText(message);
        if (
          action?.message_task_id &&
          action?.session_task_id &&
          stableRunID &&
          actionType === "fill_current_message"
        ) {
          try {
            const next = await markKFToolbarRPAMessageFailed(
              action.message_task_id,
              {
                run_id: stableRunID,
                session_task_id: action.session_task_id,
                idempotency_key: newKey(),
                error_code: "toolbar_action_failed",
                error_message: message,
              },
            );
            if (!active) return;
            applyNextSnapshot(next, { force: true });
          } catch {
            // Keep the original UI error. The next bootstrap can recover from server state.
          }
        }
      } finally {
        if (active) inFlightRef.current = "";
      }
    };

    void run();
    return () => {
      active = false;
      clearTimer();
    };
  }, [
    actionType,
    stableRunID,
    isRealtimeDriven,
    effectiveOperatorDisplayState,
    streamState,
    streamFallbackReason,
    streamConnectingAgeMS,
    streamLastActivityAgeMS,
    snapshot?.run?.version,
    snapshot?.action?.task_id,
    snapshot?.action?.message_task_id,
    snapshot?.action?.session_task_id,
    snapshot?.action?.poll_after_ms,
    snapshot?.action?.reason,
    snapshot?.action?.target?.open_kfid,
    snapshot?.action?.target?.external_userid,
    snapshot?.message_task?.message_hash,
    snapshot?.message_task?.status,
    snapshot?.message_task?.text,
    snapshot?.message_task?.message_preview,
    snapshot?.navigation?.required,
    snapshot?.navigation?.already_matched,
    snapshot?.navigation?.delay_ms,
    snapshot?.navigation?.flash_count,
    currentSessionContext?.open_kfid,
    currentSessionContext?.external_userid,
    knownCurrentConversation.openKFID,
    knownCurrentConversation.externalUserID,
  ]);

  const actionMessages = (
    action?.message ? [action.message] : action?.messages || []
  ).filter(Boolean);
  const currentTaskView = operatorView?.current_task || null;
  const nextQueuedTaskView = operatorView?.next_queued_task || null;
  const pendingWindowTaskView = pendingWindow
    ? ({
        session: {
          session_task_id: "",
          status: pendingWindow.status || "",
          open_kfid: pendingWindow.open_kfid || "",
          external_userid: pendingWindow.external_userid || "",
          contact_name: pendingWindow.contact_name || "",
          channel_label: pendingWindow.channel_label || "",
        },
        message: {
          message_task_id: "",
          status: pendingWindow.status || "",
          send_order: 0,
          text: pendingWindow.last_customer_message_preview || "",
          message_preview: pendingWindow.last_customer_message_preview || "",
          message_hash: "",
        },
        target: {
          open_kfid: pendingWindow.open_kfid || "",
          external_userid: pendingWindow.external_userid || "",
          display_name: pendingWindow.contact_name || "",
          channel_label: pendingWindow.channel_label || "",
        },
      } satisfies ToolbarRPAOperatorTaskView)
    : null;
  const stateForPausedTask = effectiveSnapshot || snapshot;
  const pausedSnapshotSession =
    stateForPausedTask?.target_session ||
    stateForPausedTask?.current_session ||
    null;
  const pausedBootstrapSession = snapshot?.session_task
    ? {
        session_task_id: snapshot.session_task.session_task_id || "",
        status: snapshot.session_task.status || "",
        open_kfid: snapshot.session_task.open_kfid || "",
        external_userid: snapshot.session_task.external_userid || "",
        contact_name: snapshot.session_task.contact_name || "",
        channel_label: snapshot.session_task.channel_label || "",
      }
    : null;
  const pausedActionMessage = action?.message
    ? {
        message_task_id:
          action.message_task_id || action.message.message_id || "",
        status: "",
        send_order: action.message.order || 0,
        text: action.message.text || "",
        message_preview: action.message.text || "",
        message_hash: action.message.message_hash || "",
      }
    : null;
  const pausedSnapshotTarget =
    action?.target ||
    (pausedSnapshotSession
      ? {
          open_kfid: pausedSnapshotSession.open_kfid || "",
          external_userid: pausedSnapshotSession.external_userid || "",
          display_name: pausedSnapshotSession.contact_name || "",
          channel_label: pausedSnapshotSession.channel_label || "",
        }
      : pausedBootstrapSession
        ? {
            open_kfid: pausedBootstrapSession.open_kfid || "",
            external_userid: pausedBootstrapSession.external_userid || "",
            display_name: pausedBootstrapSession.contact_name || "",
            channel_label: pausedBootstrapSession.channel_label || "",
          }
        : null);
  const snapshotTaskView = stateForPausedTask
    ? ({
        session: pausedSnapshotSession || pausedBootstrapSession,
        message: stateForPausedTask.message_task || pausedActionMessage,
        target: pausedSnapshotTarget,
      } satisfies ToolbarRPAOperatorTaskView)
    : null;
  const latestPausedTaskView =
    nextQueuedTaskView ||
    currentTaskView ||
    pendingWindowTaskView ||
    snapshotTaskView;
  const pausedTaskView =
    latestPausedTaskView || lastPausedTaskViewRef.current || null;
  const pausedHasDisplayTask = taskViewHasDisplayContent(pausedTaskView);
  useEffect(() => {
    if (taskViewHasDisplayContent(latestPausedTaskView)) {
      lastPausedTaskViewRef.current = latestPausedTaskView;
      return;
    }
    if (!automationEnabled && !isPaused) {
      lastPausedTaskViewRef.current = null;
    }
  });
  const completionContextSnapshot =
    completedOverlay?.snapshot || previousSnapshotRef.current;
  const completionTargetSource = completionContextSnapshot?.action?.target || {
    open_kfid:
      completionContextSnapshot?.target_session?.open_kfid ||
      completionContextSnapshot?.current_session?.open_kfid ||
      completionContextSnapshot?.session_task?.open_kfid ||
      "",
    external_userid:
      completionContextSnapshot?.target_session?.external_userid ||
      completionContextSnapshot?.current_session?.external_userid ||
      completionContextSnapshot?.session_task?.external_userid ||
      "",
    display_name:
      completionContextSnapshot?.target_session?.contact_name ||
      completionContextSnapshot?.current_session?.contact_name ||
      completionContextSnapshot?.session_task?.contact_name ||
      "",
    channel_label:
      completionContextSnapshot?.target_session?.channel_label ||
      completionContextSnapshot?.current_session?.channel_label ||
      completionContextSnapshot?.session_task?.channel_label ||
      "",
  };
  const completionMessageSource =
    completionContextSnapshot?.message_task || null;
  const displayActionType = completedOverlay
    ? "completed"
    : effectiveOperatorDisplayState
      ? effectiveOperatorDisplayState
      : suppressInitialTerminalSnapshot
        ? "idle_poll"
        : actionType;
  const isCompletedAction = displayActionType === "completed";
  const uiIsPausing = !completedOverlay && isPausing;
  const uiIsPaused = !completedOverlay && isPaused;
  const uiIsCompleted = isCompletedAction;
  const displayTaskView = uiIsPaused
    ? pausedTaskView
    : currentTaskView || nextQueuedTaskView || null;
  const pausedMessage =
    uiIsPaused &&
    (
      displayTaskView?.message?.text ||
      displayTaskView?.message?.message_preview ||
      snapshot?.message_task?.text ||
      ""
    ).trim()
      ? [
          {
            message_id:
              displayTaskView?.message?.message_task_id ||
              snapshot?.message_task?.message_task_id ||
              "",
            order:
              displayTaskView?.message?.send_order ||
              snapshot?.message_task?.send_order ||
              0,
            text:
              displayTaskView?.message?.text ||
              displayTaskView?.message?.message_preview ||
              snapshot?.message_task?.text ||
              "",
            message_hash:
              displayTaskView?.message?.message_hash ||
              snapshot?.message_task?.message_hash ||
              "",
          },
        ]
      : [];
  const completedMessage =
    isCompletedAction &&
    actionMessages.length === 0 &&
    (
      currentTaskView?.message?.text ||
      currentTaskView?.message?.message_preview ||
      completionMessageSource?.text ||
      ""
    ).trim()
      ? [
          {
            message_id:
              currentTaskView?.message?.message_task_id ||
              completionMessageSource?.message_task_id ||
              "",
            order:
              currentTaskView?.message?.send_order ||
              completionMessageSource?.send_order ||
              0,
            text:
              currentTaskView?.message?.text ||
              currentTaskView?.message?.message_preview ||
              completionMessageSource?.text ||
              "",
            message_hash:
              currentTaskView?.message?.message_hash ||
              completionMessageSource?.message_hash ||
              "",
          },
        ]
      : [];
  const messages =
    actionMessages.length > 0
      ? actionMessages
      : pausedMessage.length > 0
        ? pausedMessage
        : completedMessage;
  const previewMessagesSource =
    messages.length > 0
      ? messages
      : uiIsPaused
        ? [
            {
              message_id: "paused-empty",
              order: 0,
              text: "暂停中，当前暂无待发送消息；恢复后会继续等待新的待发送任务。",
              message_hash: "",
            },
          ]
        : [];
  const queuePendingTotal = Number(snapshot?.queue_summary?.total_pending || 0);
  const pauseCountdownDeadlineMS =
    effectivePauseDeadlineMS ||
    (uiIsPaused && snapshotPauseAutoStopRemainingMS > 0
      ? viewClock + snapshotPauseAutoStopRemainingMS
      : 0);
  const pauseDeadlineExpired =
    uiIsPaused &&
    Number.isFinite(pauseCountdownDeadlineMS) &&
    pauseCountdownDeadlineMS > 0 &&
    pauseCountdownDeadlineMS <= viewClock;
  const pauseAutoStopRemainingMS = Math.max(
    0,
    uiIsPaused &&
      Number.isFinite(pauseCountdownDeadlineMS) &&
      pauseCountdownDeadlineMS > 0
      ? pauseCountdownDeadlineMS - viewClock
      : 0,
  );
  const pauseAutoStopSeconds = Math.max(
    0,
    Math.ceil(pauseAutoStopRemainingMS / 1000),
  );
  const isCompleted = uiIsCompleted;
  const currentTarget = action?.target || {
    open_kfid:
      displayTaskView?.target?.open_kfid ||
      displayTaskView?.session?.open_kfid ||
      "",
    external_userid:
      displayTaskView?.target?.external_userid ||
      displayTaskView?.session?.external_userid ||
      "",
    display_name:
      displayTaskView?.target?.display_name ||
      displayTaskView?.session?.contact_name ||
      "",
    channel_label:
      displayTaskView?.target?.channel_label ||
      displayTaskView?.session?.channel_label ||
      "",
  };
  const fallbackTarget = {
    open_kfid:
      snapshot?.target_session?.open_kfid ||
      snapshot?.current_session?.open_kfid ||
      snapshot?.session_task?.open_kfid ||
      pendingWindow?.open_kfid ||
      (isCompleted ? completionTargetSource.open_kfid || "" : ""),
    external_userid:
      snapshot?.target_session?.external_userid ||
      snapshot?.current_session?.external_userid ||
      snapshot?.session_task?.external_userid ||
      pendingWindow?.external_userid ||
      (isCompleted ? completionTargetSource.external_userid || "" : ""),
    display_name:
      snapshot?.target_session?.contact_name ||
      snapshot?.current_session?.contact_name ||
      snapshot?.session_task?.contact_name ||
      pendingWindow?.contact_name ||
      (isCompleted ? completionTargetSource.display_name || "" : ""),
    channel_label:
      snapshot?.target_session?.channel_label ||
      snapshot?.current_session?.channel_label ||
      snapshot?.session_task?.channel_label ||
      pendingWindow?.channel_label ||
      (isCompleted ? completionTargetSource.channel_label || "" : ""),
  };
  const resolvedTarget = {
    open_kfid: currentTarget.open_kfid || fallbackTarget.open_kfid || "",
    external_userid:
      currentTarget.external_userid || fallbackTarget.external_userid || "",
    display_name:
      currentTarget.display_name || fallbackTarget.display_name || "",
    channel_label:
      currentTarget.channel_label || fallbackTarget.channel_label || "",
  };
  const reviewSessions = useMemo(
    () =>
      (snapshot?.pending_session_tasks || []).filter(
        (item) =>
          [
            "confirm_uncertain",
            "review_resend_pending",
            "need_manual",
            "failed",
          ].includes((item.status || "").trim()) &&
          (item.current_message_task_id || "").trim(),
      ),
    [snapshot?.pending_session_tasks],
  );
  const reviewManualTotal = Number(snapshot?.review_manual?.total || 0);
  const navigationAlreadyMatched =
    snapshot?.navigation?.already_matched === true;
  const knownCurrentDiffersFromTarget =
    hasConversationIdentity(knownCurrentConversation) &&
    isKnownDifferentConversation(knownCurrentConversation, resolvedTarget);
  const knownCurrentMatchesTarget = isSameConversation(
    knownCurrentConversation,
    resolvedTarget,
    canMatchByExternalOnly(knownCurrentConversation, resolvedTarget),
  );
  const recentlyNavigatedToCurrentTarget = hasRecentAutomationNavigation(
    stableRunID,
    resolvedTarget,
  );
  const inferredNavigationSkippedInRun =
    POST_NAVIGATION_ACTION_TYPES.has(actionType) &&
    !recentlyNavigatedToCurrentTarget &&
    !knownCurrentDiffersFromTarget &&
    hasConversationIdentity(knownCurrentConversation) &&
    knownCurrentMatchesTarget;
  const navigationSkipped =
    !knownCurrentDiffersFromTarget &&
    (navigationAlreadyMatched ||
      snapshot?.navigation?.required === false ||
      (actionType === "navigate_to_chat" && knownCurrentMatchesTarget) ||
      inferredNavigationSkippedInRun);
  const rememberedNavigationSkipped = Boolean(
    stableRunID &&
    currentPipelineKey &&
    skippedNavigationPipelineKey === currentPipelineKey,
  );
  const navigationSkippedInRun =
    navigationSkipped || rememberedNavigationSkipped;
  const isIdlePoll =
    !uiIsPausing &&
    !uiIsPaused &&
    (displayActionType === "idle_poll" ||
      (!displayActionType &&
        !hasActiveRun &&
        automationEnabled &&
        !pendingWindow));
  const showStandalonePipeline = uiIsPaused || isIdlePoll || isCompleted;
  const presentation = buildFlowPresentation({
    actionType: displayActionType,
    snapshot,
    hasActiveRun,
    automationEnabled,
    hasPendingWindow: Boolean(pendingWindow),
    reviewSessionsCount: reviewSessions.length,
  });
  const toneStyles = flowToneClasses(presentation.tone);
  const automationStatusText = statusTextForAutomation(
    snapshot,
    automationEnabled,
    hasActiveRun,
  );
  const customerName =
    resolvedTarget.display_name ||
    snapshot?.target_session?.contact_name ||
    snapshot?.current_session?.contact_name ||
    snapshot?.session_task?.contact_name ||
    (isCompleted ? completionTargetSource.display_name || "" : "") ||
    pendingWindow?.contact_name ||
    resolvedTarget.external_userid ||
    (isCompleted ? completionTargetSource.external_userid || "" : "") ||
    pendingWindow?.external_userid ||
    "";
  const customerExternalUserID =
    resolvedTarget.external_userid ||
    snapshot?.target_session?.external_userid ||
    snapshot?.current_session?.external_userid ||
    snapshot?.session_task?.external_userid ||
    (isCompleted ? completionTargetSource.external_userid || "" : "") ||
    pendingWindow?.external_userid ||
    "";
  const agentOpenKFID =
    resolvedTarget.open_kfid ||
    snapshot?.target_session?.open_kfid ||
    snapshot?.current_session?.open_kfid ||
    snapshot?.session_task?.open_kfid ||
    (isCompleted ? completionTargetSource.open_kfid || "" : "") ||
    pendingWindow?.open_kfid ||
    currentSessionContext?.open_kfid ||
    "";
  const mappedAgentLabel = (channelDisplayMap?.[agentOpenKFID] || "").trim();
  const agentChannelLabel = (
    resolvedTarget.channel_label ||
    snapshot?.target_session?.channel_label ||
    snapshot?.current_session?.channel_label ||
    snapshot?.session_task?.channel_label ||
    (isCompleted ? completionTargetSource.channel_label || "" : "") ||
    ""
  ).trim();
  const agentName =
    mappedAgentLabel ||
    (agentChannelLabel && agentChannelLabel !== agentOpenKFID
      ? agentChannelLabel
      : agentOpenKFID || "待确认");
  const hasDisplayableTargetCard =
    uiIsPaused ||
    isIdlePoll ||
    Boolean(
      customerName ||
        customerExternalUserID ||
        agentOpenKFID ||
        pendingWindow?.open_kfid ||
        pendingWindow?.external_userid,
    );
  const targetCardToneClass = uiIsPaused
    ? "border-amber-500 bg-amber-50"
    : isIdlePoll
      ? "border-gray-400 bg-gray-50"
      : isCompleted
        ? "border-green-500 bg-green-50"
        : displayActionType === "navigate_to_chat"
          ? navigationSkippedInRun
            ? "border-gray-400 bg-gray-50"
            : "border-indigo-500 bg-indigo-50 animate-pulse"
          : "border-blue-500 bg-blue-50";
  const targetCardLabelClass = uiIsPaused
    ? "text-amber-600"
    : isIdlePoll
      ? "text-gray-500"
      : isCompleted
        ? "text-green-600"
        : displayActionType === "navigate_to_chat"
          ? navigationSkippedInRun
            ? "text-gray-500"
            : "text-indigo-600"
          : "text-blue-600";
  const targetCardLabel =
    pendingWindow && !hasActiveRun
      ? "待恢复发送会话"
      : uiIsPausing
        ? "当前任务完成后暂停"
        : uiIsPaused
          ? "待恢复发送任务"
          : isIdlePoll
            ? "等待新发送任务"
            : isCompleted
              ? "本次发送已完成"
              : displayActionType === "navigate_to_chat"
                ? navigationSkippedInRun
                  ? "已在目标会话"
                  : "即将切换目标会话"
                : "正在处理会话";
  const messageOrder =
    messages[0]?.order ||
    snapshot?.message_task?.send_order ||
    snapshot?.run?.current_sequence ||
    0;
  const previewMessages = previewMessagesSource.slice(0, 2);
  const extraMessagesCount = Math.max(
    previewMessagesSource.length - previewMessages.length,
    0,
  );
  const hasControls = Boolean(
    snapshot?.can_pause ||
    snapshot?.can_resume ||
    snapshot?.can_skip ||
    snapshot?.can_stop,
  );

  useEffect(() => {
    if (
      !stableRunID ||
      actionType === "idle_poll" ||
      actionType === "completed"
    ) {
      if (skippedNavigationPipelineKey) setSkippedNavigationPipelineKey("");
      return;
    }
    if (
      actionType === "navigate_to_chat" &&
      navigationSkipped &&
      skippedNavigationPipelineKey !== currentPipelineKey
    ) {
      setSkippedNavigationPipelineKey(currentPipelineKey);
    }
  }, [
    actionType,
    currentPipelineKey,
    navigationSkipped,
    skippedNavigationPipelineKey,
    stableRunID,
  ]);

  const executeCommand = async (command: string, successText: string) => {
    if (!stableRunID || commandLoading) return;
    clearTimer();
    setCommandLoading(command);
    setErrorText("");
    try {
      const next = await executeKFToolbarRPARunCommand(stableRunID, {
        command,
        session_task_id:
          action?.session_task_id ||
          snapshot?.session_task?.session_task_id ||
          "",
        message_task_id:
          action?.message_task_id ||
          snapshot?.message_task?.message_task_id ||
          "",
      });
      if (!applyNextSnapshot(next, { force: true })) {
        void loadBootstrap(true);
      }
      setNotice(successText);
    } catch (error) {
      setErrorText(normalizeErrorMessage(error));
    } finally {
      setCommandLoading("");
    }
  };

  const handleStopAutomation = async () => {
    if (commandLoading || isUpdatingAutomationMode) return;
    clearTimer();
    setCommandLoading("stop");
    setErrorText("");
    try {
      if (stableRunID) {
        const next = await executeKFToolbarRPARunCommand(stableRunID, {
          command: "stop",
          session_task_id:
            action?.session_task_id ||
            snapshot?.session_task?.session_task_id ||
            "",
          message_task_id:
            action?.message_task_id ||
            snapshot?.message_task?.message_task_id ||
            "",
        });
        applyNextSnapshot(next, { force: true });
      } else {
        const automation = await updateKFToolbarRPAAutomationMode(false);
        const next = await getKFToolbarRPABootstrap({
          open_kfid: currentSessionContext?.open_kfid || "",
          external_userid: currentSessionContext?.external_userid || "",
          force_fresh: true,
        });
        if (!applyNextSnapshot(next, { force: true })) {
          setSnapshot({
            mode: "normal",
            enabled: false,
            status: "closed",
            automation: automation || { enabled: false },
            action: {
              type: "idle_poll",
              reason: "stopped",
              poll_after_ms: 0,
            },
          });
        }
      }
      setNotice("已停止发送，未完成任务已丢弃。");
    } catch (error) {
      setErrorText(normalizeErrorMessage(error));
    } finally {
      setCommandLoading("");
    }
  };

  const handleResumeAutomation = async () => {
    if (commandLoading || isUpdatingAutomationMode || !canResumeNow) return;
    if (stableRunID) {
      await executeCommand("resume", "已继续自动发送。");
      return;
    }
    clearTimer();
    setCommandLoading("resume");
    setErrorText("");
    try {
      await updateKFToolbarRPAAutomationMode(true);
      const next = await getKFToolbarRPABootstrap({
        open_kfid: currentSessionContext?.open_kfid || "",
        external_userid: currentSessionContext?.external_userid || "",
        force_fresh: true,
      });
      applyNextSnapshot(next, { force: true });
      setNotice("已继续自动发送。");
    } catch (error) {
      setErrorText(normalizeErrorMessage(error));
    } finally {
      setCommandLoading("");
    }
  };

  const handleStartAutomation = async () => {
    if (isUpdatingAutomationMode || commandLoading) return;
    setErrorText("");
    await onAutomationModeChange?.(true);
  };

  const handleReturnManualMode = async () => {
    if (isUpdatingAutomationMode) return;
    if (isStopped || !automationEnabled) {
      await onAutomationModeChange?.(false);
      return;
    }
    setIsReturnManualDialogOpen(true);
  };

  const confirmReturnManualMode = async () => {
    if (isUpdatingAutomationMode) return;
    setIsReturnManualDialogOpen(false);
    await onAutomationModeChange?.(false);
  };

  const requestReviewResend = async (session: ToolbarRPASessionTask) => {
    if (!stableRunID || commandLoading) return;
    clearTimer();
    setCommandLoading(`review:${session.session_task_id || ""}`);
    setErrorText("");
    try {
      const next = await executeKFToolbarRPARunCommand(stableRunID, {
        command: "request_review_resend",
        session_task_id: session.session_task_id || "",
        message_task_id: session.current_message_task_id || "",
      });
      applyNextSnapshot(next, { force: true });
      setNotice("已加入复核队列；当前会话完成后会进入该会话并自动复查重发。");
    } catch (error) {
      setErrorText(normalizeErrorMessage(error));
    } finally {
      setCommandLoading("");
    }
  };

  const stepIndexByAction: Record<string, number> = {
    navigate_to_chat: 1,
    fill_current_message: 2,
    wait_rpa_ack: 3,
    wait_wecom_confirm: 4,
    review_auto_resend: 5,
  };
  const currentStep = stepIndexByAction[displayActionType] || 0;
  const showPipeline = currentStep > 0;
  const pipelineStatusText =
    currentStep > 0
      ? currentStep === 1 && navigationSkippedInRun
        ? "第 1/5 步（已跳过）"
        : `第 ${currentStep}/5 步`
      : "";
  const pipelineStatusClass =
    currentStep === 1 && navigationSkippedInRun
      ? "text-gray-500"
      : "text-blue-500";
  const pipelineSteps = [
    "navigate_to_chat",
    "fill_current_message",
    "wait_rpa_ack",
    "wait_wecom_confirm",
    "review_auto_resend",
  ];
  const actionTone = uiIsPaused
    ? "amber"
    : pendingWindow && !hasActiveRun
      ? "amber"
      : displayActionType === "wait_rpa_ack"
        ? "amber"
        : displayActionType === "wait_wecom_confirm"
          ? "sky"
          : displayActionType === "review_auto_resend"
            ? "orange"
            : displayActionType === "need_manual"
              ? "red"
              : displayActionType === "completed"
                ? "green"
                : "blue";
  const actionToneClasses =
    actionTone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : actionTone === "sky"
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : actionTone === "orange"
          ? "border-orange-200 bg-orange-50 text-orange-800"
          : actionTone === "red"
            ? "border-red-200 bg-red-50 text-red-800"
            : actionTone === "green"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-blue-200 bg-blue-50 text-blue-800";
  const headerStatus = !automationEnabled
    ? isStopped
      ? "已停止"
      : "待启动"
    : uiIsPausing
      ? "暂停待生效"
      : uiIsPaused
        ? "已暂停"
        : hasActiveRun
          ? "执行中"
          : "守护中";
  const headerBg = automationEnabled
    ? uiIsPaused
      ? "bg-amber-600"
      : "bg-[#0052D9]"
    : "bg-slate-600";
  const canPauseNow =
    automationEnabled &&
    Boolean(stableRunID) &&
    !runIsTerminal &&
    !uiIsPausing &&
    !uiIsPaused &&
    !commandLoading;
  const canResumeFromState = Boolean(
    effectiveSnapshot?.can_resume ?? snapshot?.can_resume,
  );
  const canResumeNow =
    automationEnabled && uiIsPaused && canResumeFromState && !commandLoading;
  const canStopNow =
    automationEnabled && !commandLoading && !isUpdatingAutomationMode;
  const stopCopy = stopCopyForReason(effectiveStopReason);

  return (
    <div
      className={`${sidebarPageShell} bg-white transition-all duration-500 ${
        isCompleted
          ? "border border-green-400 shadow-[inset_0_0_34px_rgba(34,197,94,0.22)]"
          : ""
      }`}
      style={{ height: "100dvh", minHeight: 0, overflow: "hidden" }}
    >
      <style>{`
        @keyframes toolbar-rpa-dot {
          0%, 80%, 100% { opacity: 0.28; transform: translateY(0) scale(0.88); }
          40% { opacity: 1; transform: translateY(-2px) scale(1.05); }
        }
        @keyframes toolbar-rpa-flash {
          0%, 100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); transform: translateZ(0); }
          45% { box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.24); transform: translateY(-1px); }
        }
        @keyframes toolbar-rpa-slide {
          0%, 100% { transform: translateX(-2px); opacity: 0.72; }
          50% { transform: translateX(2px); opacity: 1; }
        }
        @keyframes toolbar-rpa-bar {
          0%, 100% { transform: scaleY(0.72); opacity: 0.62; }
          50% { transform: scaleY(1.18); opacity: 1; }
        }
        @keyframes toolbar-rpa-soft-pop {
          0%, 100% { transform: scale(0.96); opacity: 0.78; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        .toolbar-rpa-dot { animation: toolbar-rpa-dot 1.2s ease-in-out infinite; }
        .toolbar-rpa-slide { animation: toolbar-rpa-slide 1.1s ease-in-out infinite; }
        .toolbar-rpa-bar { animation: toolbar-rpa-bar 0.9s ease-in-out infinite; transform-origin: bottom; }
        .toolbar-rpa-soft-pop { animation: toolbar-rpa-soft-pop 1.5s ease-in-out infinite; }
        .toolbar-rpa-flash { animation: toolbar-rpa-flash 0.36s ease-in-out 4; }
      `}</style>
      <div className={`${headerBg} shrink-0 p-4 text-white`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                automationEnabled
                  ? "animate-pulse bg-green-400"
                  : "bg-slate-300"
              }`}
            />
            <h1 className="truncate text-sm font-bold tracking-tight text-white">
              自动发送助手
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={isUpdatingAutomationMode}
              onClick={() => void handleReturnManualMode()}
              className="inline-flex items-center gap-1 rounded bg-white/20 px-2 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-white/30 disabled:opacity-60"
            >
              {isUpdatingAutomationMode ? (
                <LoaderCircle className="h-3 w-3 animate-spin" />
              ) : (
                <UserRound className="h-3 w-3" />
              )}
              返回人工
            </button>
            <span className="rounded bg-white/20 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">
              {isLoading ? "同步中" : headerStatus}
            </span>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void loadBootstrap(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-60"
              aria-label="刷新自动发送状态"
            >
              <RefreshCcw
                className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded bg-black/10 p-2">
          <span className="shrink-0 text-[11px] uppercase tracking-widest text-white/80">
            当前客服号:
          </span>
          <span className="truncate font-mono text-[11px] font-bold text-white">
            {agentName}
          </span>
        </div>
      </div>

      <div
        className={`${sidebarBody} min-h-0 flex-1 bg-white/50 p-4`}
        style={{ overflowX: "hidden", overflowY: "auto" }}
      >
        {!automationEnabled ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
            <ShieldCheck className="h-12 w-12 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">
              {isStopped ? stopCopy.title : "自动发送未启动"}
            </p>
            <span className="px-4 text-xs leading-5 text-gray-400">
              {isStopped
                ? stopCopy.detail
                : "点击底部“自动发送”后，工具栏会开始守护待发送任务。"}
            </span>
          </div>
        ) : (
          <>
            {hasDisplayableTargetCard ? (
              <div
                className={`border-l-4 p-3 rounded-r shadow-sm transition-all duration-300 ${targetCardToneClass} ${
                  isTargetFlashing ? "toolbar-rpa-flash" : ""
                }`}
              >
                <div
                  className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${targetCardLabelClass}`}
                >
                  {targetCardLabel}
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div
                      className={`truncate text-lg font-bold ${
                        isIdlePoll ? "text-gray-400" : "text-gray-800"
                      }`}
                    >
                      买家:{" "}
                      {isIdlePoll
                        ? "等待新客户..."
                        : uiIsPaused && !pausedHasDisplayTask
                          ? "暂无待发送买家"
                          : customerName || "-"}
                    </div>
                    <div className="mt-1 truncate font-mono text-[10px] text-gray-500">
                      客户ID:{" "}
                      {isIdlePoll || (uiIsPaused && !pausedHasDisplayTask)
                        ? "---"
                        : customerExternalUserID || "-"}
                    </div>
                    {!isIdlePoll ? (
                      <div className="mt-1 truncate font-mono text-[10px] text-gray-500">
                        目标客服号: {agentName || "-"}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {pendingWindow && !hasActiveRun ? (
              <div
                className={`rounded-lg border p-3.5 shadow-sm ${actionToneClasses}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/80">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold">
                        {presentation.title}
                      </div>
                      <span className="rounded bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        已记录
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] leading-snug text-gray-600">
                      {presentation.subtitle}
                    </div>
                    {(
                      pendingWindow.last_customer_message_preview || ""
                    ).trim() ? (
                      <div className="mt-2 rounded border border-amber-200/80 bg-white/70 px-2 py-1.5 text-[11px] leading-5 text-amber-900">
                        {pendingWindow.last_customer_message_preview}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : showStandalonePipeline ? (
              <div className="space-y-2.5">
                <div className="flex justify-between text-[11px] font-bold uppercase text-gray-500">
                  <span>发送进度</span>
                  <span
                    className={
                      uiIsPaused
                        ? "text-amber-500"
                        : isCompleted
                          ? "text-green-500"
                          : "text-gray-400"
                    }
                  >
                    {uiIsPaused ? "待恢复" : isCompleted ? "已完成" : "待命中"}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1">
                  {pipelineSteps.map((step, idx) => (
                    <div
                      key={step}
                      className={`relative h-1.5 rounded-full ${
                        isCompleted
                          ? "bg-green-500"
                          : uiIsPaused
                            ? "bg-amber-200"
                            : "bg-gray-200"
                      }`}
                    >
                      {isCompleted && idx === pipelineSteps.length - 1 ? (
                        <div className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-green-500 text-white">
                          <CheckCircle2 className="h-3 w-3" />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div
                  className={`space-y-3 rounded-lg border bg-gray-50 p-3.5 transition-colors ${
                    isCompleted ? "border-green-200" : "border-gray-200"
                  }`}
                >
                  {uiIsPaused ? (
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600">
                        <PauseCircle className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="text-xs font-bold uppercase tracking-tight text-amber-800">
                            待恢复
                          </div>
                          <span className="rounded bg-amber-200/60 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            已暂停
                          </span>
                        </div>
                        <div className="text-[11px] italic leading-snug text-gray-600">
                          当前会话和消息会保持在这里，队列数量继续实时刷新；点击“恢复执行”后继续处理。
                        </div>
                        <div className="mt-2 rounded border border-amber-200 bg-white/70 px-2 py-1.5 text-[10px] font-bold text-amber-700">
                          {pauseAutoStopSeconds > 0
                            ? `${pauseAutoStopSeconds} 秒内未恢复将自动停止自动发送`
                            : pauseDeadlineExpired
                              ? "暂停超过 60 秒未恢复，正在自动停止自动发送..."
                            : "暂停中，恢复后将继续处理当前待发任务"}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {isIdlePoll ? (
                    <div className="flex items-start gap-3 opacity-60">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-200 text-gray-600">
                        <RefreshCw
                          className="h-3.5 w-3.5 animate-spin"
                          style={{ animationDuration: "3s" }}
                        />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-800">
                          <span>正在等待新任务</span>
                          <span className="ml-1 inline-flex items-center gap-0.5 align-middle">
                            {[0, 1, 2].map((idx) => (
                              <span
                                key={idx}
                                className="h-1 w-1 rounded-full bg-gray-500 animate-bounce"
                                style={{ animationDelay: `${idx * 140}ms` }}
                              />
                            ))}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500">
                          有新的待发送会话时会自动处理
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {isCompleted ? (
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-green-100 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="text-xs font-bold uppercase tracking-tight text-green-800">
                            单次发送已完成
                          </div>
                          <span className="rounded bg-green-200/60 px-1.5 py-0.5 text-[10px] font-bold text-green-800">
                            发送成功
                          </span>
                        </div>
                        <div className="text-[11px] italic leading-snug text-gray-600">
                          {queuePendingTotal > 0
                            ? `还有 ${queuePendingTotal} 个任务待处理，正在拉取队列中的下一个会话任务...`
                            : "本轮自动发送已完成"}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : showPipeline ? (
              <div className="space-y-2.5">
                <div className="flex justify-between text-[11px] font-bold uppercase text-gray-500">
                  <span>发送进度</span>
                  <span className={pipelineStatusClass}>
                    {pipelineStatusText}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {pipelineSteps.map((step, idx) => {
                    const stepNumber = idx + 1;
                    const active = currentStep >= stepNumber;
                    const current = currentStep === stepNumber;
                    const review = step === "review_auto_resend";
                    const skippedNavigation =
                      step === "navigate_to_chat" && navigationSkippedInRun;
                    return (
                      <div
                        key={step}
                        className={`relative h-1.5 rounded-full ${
                          active
                            ? review
                              ? "bg-orange-500"
                              : skippedNavigation
                                ? "bg-slate-300"
                                : "bg-[#0052D9]"
                            : "bg-gray-200"
                        }`}
                      >
                        {current && stepNumber >= 3 ? (
                          <div
                            className={`absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${
                              review ? "bg-orange-500" : "bg-[#0052D9]"
                            }`}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3.5 transition-colors">
                  {displayActionType === "navigate_to_chat" &&
                  navigationSkippedInRun ? (
                    <div className="relative flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-100 text-gray-500">
                        <SkipForward className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                          跳过会话切换
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500">
                          当前聊天窗口已是目标会话，无需切换
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {displayActionType === "navigate_to_chat" &&
                  !navigationSkippedInRun ? (
                    <div className="relative flex items-start gap-3">
                      <div className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-indigo-100 text-indigo-600">
                        <ArrowRightLeft className="h-3.5 w-3.5 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                          准备切换会话
                          {bounceDots("bg-indigo-500")}
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500">
                          记录下一跳目标，即将触发企业微信面板切换
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {displayActionType === "fill_current_message" ? (
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-600">
                        <FileText className="h-3.5 w-3.5 animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
                          正在填入消息内容
                          {bounceDots("bg-gray-500")}
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500">
                          正在注入待发送缓冲区到输入框
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {displayActionType === "wait_rpa_ack" ? (
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600">
                        <ShieldCheck className="h-3.5 w-3.5 animate-pulse" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5 text-xs font-bold uppercase tracking-tight text-amber-800">
                            等待点击发送
                            {bounceDots("bg-amber-500")}
                          </div>
                          <span className="rounded bg-amber-200/60 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                            等待中
                          </span>
                        </div>
                        <div className="text-[11px] italic leading-snug text-gray-600">
                          正在等待发送端完成点击“发送”
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {displayActionType === "wait_wecom_confirm" ? (
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-600">
                        <CheckCircle2 className="h-3.5 w-3.5 animate-pulse" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5 text-xs font-bold uppercase tracking-tight text-sky-800">
                            发送结果确认中
                            {bounceDots("bg-sky-500")}
                          </div>
                          <span className="rounded bg-sky-200/60 px-1.5 py-0.5 text-[10px] font-bold text-sky-800">
                            确认中
                          </span>
                        </div>
                        <div className="text-[11px] italic leading-snug text-gray-600">
                          正在等待企业微信消息记录确认发送结果
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {displayActionType === "review_auto_resend" ? (
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-orange-100 text-orange-600">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="text-xs font-bold uppercase tracking-tight text-orange-800">
                            人工复核重试
                          </div>
                          <span className="rounded bg-orange-200/60 px-1.5 py-0.5 text-[10px] font-bold text-orange-800">
                            重试中
                          </span>
                        </div>
                        <div className="text-[11px] italic leading-snug text-gray-600">
                          正在等待 5 秒后复查，必要时自动重发
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : actionType === "need_manual" ? (
              <div className="space-y-3 rounded-r border-l-4 border-red-500 bg-red-50 p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div className="text-sm font-bold uppercase tracking-wider text-red-800">
                    需要人工处理
                  </div>
                </div>
                <div className="text-xs font-medium leading-relaxed text-red-700">
                  当前会话或消息无法继续自动发送，可能触发平台限制或发送端异常，请手动处理后再继续。
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3 py-12 text-center opacity-70">
                <ShieldCheck className="h-10 w-10 animate-pulse text-gray-400" />
                <div className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  任务池待命中
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400">
                  <span>正在等待新的待发送任务...</span>
                  <span className="flex items-center justify-center gap-0.5">
                    {[0, 1, 2].map((index) => (
                      <span
                        key={index}
                        className="h-1 w-1 rounded-full bg-gray-400 animate-bounce"
                        style={{ animationDelay: `${index * 150}ms` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}

            {previewMessages.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  消息内容预览
                </div>
                <div className="max-h-32 space-y-2 overflow-y-auto rounded border border-dashed border-gray-300 bg-[#F9FAFB] p-3 text-xs leading-relaxed text-gray-700">
                  {previewMessages.map((item, idx) => (
                    <div key={`${item.message_id || "msg"}-${idx}`}>
                      {(item.text || "").trim()}
                    </div>
                  ))}
                </div>
                {extraMessagesCount > 0 ? (
                  <div className="text-[11px] text-gray-500">
                    另外还有 {extraMessagesCount} 条消息会按顺序继续处理。
                  </div>
                ) : null}
              </div>
            ) : null}

            {errorText ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-700">
                {errorText}
              </div>
            ) : null}

            <div className="pt-1">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  复核列表 ({Math.max(reviewSessions.length, reviewManualTotal)}
                  )
                </div>
                {reviewSessions.length > 0 || reviewManualTotal > 0 ? (
                  <span className="rounded border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                    异常
                  </span>
                ) : null}
              </div>
              {reviewSessions.length > 0 ? (
                <div className="space-y-2">
                  {reviewSessions.map((item) => {
                    const loadingKey = `review:${item.session_task_id || ""}`;
                    const status = (item.status || "").trim();
                    const isReviewPending = status === "review_resend_pending";
                    const canRequestReview = status === "confirm_uncertain";
                    const displayName =
                      item.contact_name || item.external_userid || "待复核会话";
                    const reviewHint = (
                      item.message_text ||
                      item.error_message ||
                      ""
                    ).trim();
                    return (
                      <div
                        key={
                          item.session_task_id || item.current_message_task_id
                        }
                        className="flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50 p-2.5 shadow-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-100 bg-white text-xs font-bold text-red-600 shadow-sm">
                            {displayName.slice(0, 1)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-gray-800">
                              {displayName}
                            </div>
                            <div className="mt-0.5 text-[10px] text-gray-500">
                              {reviewListStatusLabel(item.status)}
                            </div>
                            {reviewHint ? (
                              <div className="mt-0.5 truncate text-[10px] text-gray-400">
                                {reviewHint}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!!commandLoading || !canRequestReview}
                          onClick={() => void requestReviewResend(item)}
                          className="shrink-0 rounded border border-red-200 bg-white px-3 py-1.5 text-[11px] font-bold text-red-600 shadow-sm transition-colors hover:bg-red-100 disabled:opacity-60"
                        >
                          {commandLoading === loadingKey
                            ? "处理中"
                            : isReviewPending
                              ? "复查中"
                              : canRequestReview
                                ? "处理"
                                : "需人工"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : reviewManualTotal > 0 ? (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
                  复核列表正在刷新，请稍后重试。
                </div>
              ) : (
                <div className="rounded border border-dashed border-gray-200 bg-gray-50 py-3 text-center text-[11px] italic text-gray-400">
                  暂无异常需要复核
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="shrink-0 rounded-b-lg border-t border-gray-200 bg-gray-50 p-4">
        <div className="mb-3 grid grid-cols-2 gap-3">
          {!automationEnabled ? (
            <button
              type="button"
              disabled
              className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white py-2.5 text-sm font-bold text-gray-400 shadow-sm disabled:cursor-not-allowed"
            >
              <PauseCircle className="h-4 w-4" />
              等待启动
            </button>
          ) : uiIsPausing ? (
            <button
              type="button"
              disabled
              className="flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 py-2.5 text-sm font-bold text-blue-700 shadow-sm disabled:cursor-not-allowed"
            >
              <LoaderCircle className="h-4 w-4 animate-spin" />
              等当前任务完成
            </button>
          ) : canResumeNow ? (
            <button
              type="button"
              disabled={!!commandLoading}
              onClick={() => void handleResumeAutomation()}
              className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white py-2.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlayCircle className="h-4 w-4" />
              恢复执行
            </button>
          ) : (
            <button
              type="button"
              disabled={!canPauseNow}
              onClick={() =>
                void executeCommand("pause", "当前任务完成后会自动暂停。")
              }
              className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white py-2.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PauseCircle className="h-4 w-4" />
              暂停发送
            </button>
          )}
          {!automationEnabled ? (
            <button
              type="button"
              disabled={isUpdatingAutomationMode || !!commandLoading}
              onClick={() => void handleStartAutomation()}
              className="flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-[#0052D9] py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUpdatingAutomationMode ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              自动发送
            </button>
          ) : (
            <button
              type="button"
              disabled={!canStopNow}
              onClick={() => void handleStopAutomation()}
              className="flex items-center justify-center gap-2 rounded-md border border-red-200 bg-white py-2.5 text-sm font-bold text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {commandLoading === "stop" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4 fill-current" />
              )}
              停止发送
            </button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              disabled={!snapshot?.can_skip || !!commandLoading}
              onClick={() =>
                void executeCommand("skip_message", "已跳过当前消息。")
              }
              className="text-[11px] font-medium text-gray-500 underline underline-offset-4 hover:text-[#0052D9] disabled:opacity-50"
            >
              跳过当前
            </button>
          </div>
          <div className="shrink-0 rounded bg-white px-2 py-1 text-[10px] font-bold text-gray-500 shadow-sm">
            待发任务：{queuePendingTotal}
          </div>
        </div>
      </div>

      <Dialog
        isOpen={isReturnManualDialogOpen}
        onClose={() => {
          if (!isUpdatingAutomationMode) setIsReturnManualDialogOpen(false);
        }}
        title="返回人工处理"
        className="max-w-[340px]"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUpdatingAutomationMode}
              onClick={() => setIsReturnManualDialogOpen(false)}
            >
              继续留在面板
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isUpdatingAutomationMode}
              onClick={() => void confirmReturnManualMode()}
              className="bg-[#0052D9] hover:bg-blue-700"
            >
              {isUpdatingAutomationMode ? (
                <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserRound className="mr-1.5 h-3.5 w-3.5" />
              )}
              返回人工
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-[13px] leading-5 text-gray-600">
          <p className="font-medium text-gray-900">
            {automationEnabled
              ? "确认退出自动发送并回到人工处理？"
              : "确认关闭自动发送面板？"}
          </p>
          <p>
            {automationEnabled
              ? "未完成的发送任务会保留在队列中，后续可以重新进入自动面板继续处理。"
              : "关闭后会回到人工工具栏，当前没有正在执行的自动发送任务。"}
          </p>
        </div>
      </Dialog>
    </div>
  );
}
