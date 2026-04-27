import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { WecomOpenDataName } from "@/components/wecom/WecomOpenDataName";
import { normalizeErrorMessage } from "@/services/http";
import {
  normalizeJSSDKRuntimeError,
  openWecomKfConversation,
  resolveSidebarRuntimeContext,
  sendTextToCurrentSession,
  toJSSDKErrorMessage,
} from "@/services/jssdkService";
import {
  executeKFToolbarRPARunCommand,
  getKFToolbarRPAState,
  markKFToolbarRPAMessageDraftFilled,
  markKFToolbarRPAMessageFailed,
  type ToolbarRPAAction,
  type ToolbarRPABootstrap,
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

type Props = {
  runId?: string;
  initialBootstrap?: ToolbarRPABootstrap | null;
  initialAutomationEnabled?: boolean;
  currentSessionContext?: {
    open_kfid?: string;
    external_userid?: string;
  } | null;
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
      source: trustedContext.openKFID || trustedContext.externalUserID
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
        trustedContext.openKFID ||
        runtimeOpenKFID ||
        currentContext.openKFID,
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
  version?: number,
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
    String(Number(version || 0)),
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
    (context?.openKFID || "").trim() ||
      (context?.externalUserID || "").trim(),
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
  currentSessionContext,
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
  const [skippedNavigationPipelineKey, setSkippedNavigationPipelineKey] =
    useState("");
  const [knownCurrentConversation, setKnownCurrentConversation] = useState(() => {
    const handoffContext = readAutomationNavigationContext(runId);
    return handoffContext || currentRuntimeContext(currentSessionContext);
  });
  const [boundRunID, setBoundRunID] = useState(
    (initialBootstrap?.run?.run_id || runId || "").trim(),
  );
  const timerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef("");
  const knownCurrentConversationRef = useRef(knownCurrentConversation);
  const consumedActionKeysRef = useRef<Set<string>>(new Set());
  const debugSignatureRef = useRef<Record<string, string>>({});
  const hasObservedActiveRunRef = useRef(false);

  const stableRunID = (snapshot?.run?.run_id || boundRunID || "").trim();
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
  const pendingWindow = snapshot?.pending_window || null;
  const runStatus = (snapshot?.run?.status || "").trim().toLowerCase();
  const runIsTerminal =
    Boolean(stableRunID) && TERMINAL_RUN_STATUSES.has(runStatus);
  const hasActiveRun = Boolean(stableRunID) && !runIsTerminal;
  if (hasActiveRun) {
    hasObservedActiveRunRef.current = true;
  }
  const suppressInitialTerminalSnapshot =
    runIsTerminal && !hasObservedActiveRunRef.current;
  const progress = progressPercent(snapshot);
  const automationEnabled = snapshot
    ? Boolean(snapshot.automation?.enabled || snapshot.enabled)
    : Boolean(initialAutomationEnabled);

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
    current_window: debugConversationContext(knownCurrentConversationRef.current),
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
  }, [currentSessionContext?.external_userid, currentSessionContext?.open_kfid]);

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

  const loadBootstrap = async (silently = false) => {
    if (!silently) {
      setIsLoading(true);
      setErrorText("");
    }
    try {
      const runIDForBootstrap = runIsTerminal ? "" : stableRunID;
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
        }),
      );
      const next = await getKFToolbarRPAState({
        run_id: runIDForBootstrap,
        open_kfid: requestContext.openKFID,
        external_userid: requestContext.externalUserID,
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
        debugOnChange(
          "后端已跳过会话切换：直接进入后续步骤",
          nextPipelineKey,
          {
            request_context: debugConversationContext(requestContext),
            target_context: debugTargetContext(nextTarget),
            next_action_type: nextActionType,
          },
        );
      }
      setBoundRunID((next?.run?.run_id || "").trim());
      setSnapshot(next);
    } catch (error) {
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
    setSnapshot(initialBootstrap);
    setBoundRunID((initialBootstrap.run?.run_id || runId || "").trim());
    setIsLoading(false);
  }, [
    initialBootstrap?.action?.type,
    initialBootstrap?.request_id,
    initialBootstrap?.run?.run_id,
    initialBootstrap?.run?.version,
    runId,
  ]);

  useEffect(() => {
    if (!snapshot) return;
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
    snapshot,
    snapshot?.automation?.enabled,
    snapshot?.enabled,
    snapshot?.mode,
  ]);

  useEffect(() => {
    if (!runIsTerminal || !automationEnabled) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setBoundRunID("");
      void loadBootstrap(true);
    }, 900);
  }, [automationEnabled, runIsTerminal, stableRunID]);

  useEffect(() => {
    clearTimer();
    return () => {
      clearTimer();
      clearNoticeTimer();
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
      ? actionExecutionKey(
          stableRunID,
          actionType,
          action,
          snapshot.run?.version,
        )
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
          poll_after_ms:
            action.poll_after_ms || snapshot.poll_after_ms || 1200,
        }),
      );
      timerRef.current = window.setTimeout(() => {
        void loadBootstrap(true);
      }, Math.max(900, action.poll_after_ms || snapshot.poll_after_ms || 1200));
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
          if (
            shouldSkipNavigation
          ) {
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
            const next = await getKFToolbarRPAState({
              run_id: stableRunID || "",
              open_kfid: targetContext.openKFID || context.openKFID || "",
              external_userid:
                targetContext.externalUserID || context.externalUserID || "",
            });
            if (!next) {
              throw new Error("自动发送状态暂时不可用");
            }
            if (!active) return;
            setSnapshot(next);
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
          const next = await getKFToolbarRPAState({
            run_id: stableRunID || "",
            open_kfid: targetContext.openKFID || nextContext.openKFID || "",
            external_userid:
              targetContext.externalUserID || nextContext.externalUserID || "",
          });
          if (!next) {
            throw new Error("自动发送状态暂时不可用");
          }
          if (!active) return;
          setSnapshot(next);
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
          const delay = Math.max(
            1200,
            action.poll_after_ms || snapshot.poll_after_ms || 3000,
          );
          debugOnChange(
            "等待型步骤：按后端间隔继续轮询",
            actionDebugSignature,
            debugWindowSnapshot({
              delay_ms: delay,
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
          if (
            knownCurrentDiffers ||
            !reviewAlreadyMatched
          ) {
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
          setSnapshot(next);
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
          setSnapshot(next);
          setNotice("消息已填入，正在等待点击发送。");
        }
      } catch (error) {
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
            if (active) setSnapshot(next);
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
  }, [snapshot, actionType, stableRunID]);

  const messages = (
    action?.message ? [action.message] : action?.messages || []
  ).filter(Boolean);
  const currentTarget = action?.target || {
    open_kfid: snapshot?.session_task?.open_kfid,
    external_userid: snapshot?.session_task?.external_userid,
    display_name: snapshot?.session_task?.contact_name,
    channel_label: snapshot?.session_task?.channel_label,
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
          ].includes(
            (item.status || "").trim(),
          ) && (item.current_message_task_id || "").trim(),
      ),
    [snapshot?.pending_session_tasks],
  );
  const reviewManualTotal = Number(snapshot?.review_manual?.total || 0);
  const navigationAlreadyMatched = snapshot?.navigation?.already_matched === true;
  const knownCurrentDiffersFromTarget =
    hasConversationIdentity(knownCurrentConversation) &&
    isKnownDifferentConversation(knownCurrentConversation, currentTarget);
  const knownCurrentMatchesTarget =
    isSameConversation(
      knownCurrentConversation,
      currentTarget,
      canMatchByExternalOnly(knownCurrentConversation, currentTarget),
    );
  const recentlyNavigatedToCurrentTarget = hasRecentAutomationNavigation(
    stableRunID,
    currentTarget,
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
  const navigationSkippedInRun = navigationSkipped || rememberedNavigationSkipped;
  const displayActionType = suppressInitialTerminalSnapshot
    ? "idle_poll"
    : actionType;
  const queuePendingTotal = Number(snapshot?.queue_summary?.total_pending || 0);
  const isCompleted = displayActionType === "completed";
  const isIdlePoll =
    displayActionType === "idle_poll" ||
    (!displayActionType && !hasActiveRun && automationEnabled && !pendingWindow);
  const showStandalonePipeline = isIdlePoll || isCompleted;
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
    currentTarget.display_name ||
    snapshot?.session_task?.contact_name ||
    pendingWindow?.contact_name ||
    currentTarget.external_userid ||
    pendingWindow?.external_userid ||
    "等待新客户";
  const customerExternalUserID =
    currentTarget.external_userid ||
    snapshot?.session_task?.external_userid ||
    pendingWindow?.external_userid ||
    "";
  const agentOpenKFID =
    currentTarget.open_kfid ||
    snapshot?.session_task?.open_kfid ||
    pendingWindow?.open_kfid ||
    "";
  const agentChannelLabel = (
    currentTarget.channel_label ||
    snapshot?.session_task?.channel_label ||
    ""
  ).trim();
  const agentName =
    agentChannelLabel && agentChannelLabel !== agentOpenKFID
      ? agentChannelLabel
      : agentOpenKFID || "待确认";
  const targetCardToneClass = isIdlePoll
    ? "border-gray-400 bg-gray-50"
    : isCompleted
      ? "border-green-500 bg-green-50"
      : displayActionType === "navigate_to_chat"
        ? navigationSkippedInRun
          ? "border-gray-400 bg-gray-50"
          : "border-indigo-500 bg-indigo-50 animate-pulse"
      : "border-blue-500 bg-blue-50";
  const targetCardLabelClass = isIdlePoll
    ? "text-gray-500"
    : isCompleted
      ? "text-green-600"
      : displayActionType === "navigate_to_chat"
        ? navigationSkippedInRun
          ? "text-gray-500"
          : "text-indigo-600"
      : "text-blue-600";
  const targetCardLabel = pendingWindow && !hasActiveRun
    ? "待恢复发送会话"
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
  const previewMessages = messages.slice(0, 2);
  const extraMessagesCount = Math.max(
    messages.length - previewMessages.length,
    0,
  );
  const hasControls = Boolean(
    snapshot?.can_pause ||
    snapshot?.can_resume ||
    snapshot?.can_skip ||
    snapshot?.can_retry ||
    snapshot?.can_stop,
  );

  useEffect(() => {
    if (!stableRunID || actionType === "idle_poll" || actionType === "completed") {
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
      setSnapshot(next);
      setNotice(successText);
    } catch (error) {
      setErrorText(normalizeErrorMessage(error));
    } finally {
      setCommandLoading("");
    }
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
      setSnapshot(next);
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
  const actionTone =
    pendingWindow && !hasActiveRun
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
    ? "已关闭"
    : runStatus === "paused"
      ? "已暂停"
      : hasActiveRun
        ? "执行中"
        : "守护中";
  const headerBg = automationEnabled
    ? runStatus === "paused"
      ? "bg-amber-600"
      : "bg-[#0052D9]"
    : "bg-slate-600";

  return (
    <div
      className={`${sidebarPageShell} bg-white transition-all duration-500 ${
        isCompleted
          ? "border border-green-400 shadow-[inset_0_0_34px_rgba(34,197,94,0.22)]"
            : ""
      }`}
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
              onClick={() => void onAutomationModeChange?.(false)}
              className="inline-flex items-center gap-1 rounded bg-white/20 px-2 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-white/30 disabled:opacity-60"
            >
              {isUpdatingAutomationMode ? (
                <LoaderCircle className="h-3 w-3 animate-spin" />
              ) : (
                <UserRound className="h-3 w-3" />
              )}
              切回人工
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
            当前服务账号:
          </span>
          <span className="truncate font-mono text-[11px] font-bold text-white">
            <WecomOpenDataName
              userid={agentOpenKFID}
              fallback={agentName}
              className="truncate font-mono text-[11px] font-bold text-white"
            />
          </span>
        </div>
      </div>

      <div className={`${sidebarBody} flex-1 overflow-y-auto bg-white/50 p-4`}>
        {!automationEnabled ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
            <ShieldCheck className="h-12 w-12 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">
              自动模式已关闭
            </p>
            <span className="px-4 text-xs leading-5 text-gray-400">
              开启后，工具栏会持续等待新的待发送任务。
            </span>
          </div>
        ) : (
          <>
            {(hasActiveRun ||
              currentTarget.open_kfid ||
              currentTarget.external_userid ||
              pendingWindow ||
              showStandalonePipeline) ? (
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
                      买家: {isIdlePoll ? "等待新客户..." : customerName}
                    </div>
                    <div className="mt-1 truncate font-mono text-[10px] text-gray-500">
                      客户ID:{" "}
                      {isIdlePoll ? "---" : customerExternalUserID || "-"}
                    </div>
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
                    {(pendingWindow.last_customer_message_preview || "").trim() ? (
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
                  <span>
                    发送进度
                  </span>
                  <span className={isCompleted ? "text-green-500" : "text-gray-400"}>
                    {isCompleted ? "已完成" : "待命中"}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1">
                  {pipelineSteps.map((step, idx) => (
                    <div
                      key={step}
                      className={`relative h-1.5 rounded-full ${
                        isCompleted ? "bg-green-500" : "bg-gray-200"
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
                    isCompleted
                      ? "border-green-200"
                      : "border-gray-200"
                  }`}
                >
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
                          正在等待新任务...
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
                              review
                                ? "bg-orange-500"
                                : "bg-[#0052D9]"
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

            {notice ? (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] text-blue-700">
                {notice}
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
                  复核列表 ({Math.max(reviewSessions.length, reviewManualTotal)})
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
                      item.contact_name ||
                      item.external_userid ||
                      "待复核会话";
                    const reviewHint = (
                      item.message_text ||
                      item.error_message ||
                      ""
                    ).trim();
                    return (
                      <div
                        key={item.session_task_id || item.current_message_task_id}
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
          {snapshot?.can_resume ? (
            <button
              type="button"
              disabled={!!commandLoading}
              onClick={() => void executeCommand("resume", "已继续自动发送。")}
              className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white py-2.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlayCircle className="h-4 w-4" />
              恢复执行
            </button>
          ) : (
            <button
              type="button"
              disabled={!snapshot?.can_pause || !!commandLoading}
              onClick={() => void executeCommand("pause", "已暂停自动发送。")}
              className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white py-2.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PauseCircle className="h-4 w-4" />
              暂停发送
            </button>
          )}
          <button
            type="button"
            disabled={!snapshot?.can_stop || !!commandLoading}
            onClick={() => void executeCommand("stop", "已停止自动发送。")}
            className="flex items-center justify-center gap-2 rounded-md border border-red-200 bg-white py-2.5 text-sm font-bold text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Square className="h-4 w-4 fill-current" />
            停止发送
          </button>
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
            <button
              type="button"
              disabled={!snapshot?.can_retry || !!commandLoading}
              onClick={() =>
                void executeCommand("retry_message", "已重新排队当前消息。")
              }
              className="text-[11px] font-medium text-gray-500 underline underline-offset-4 hover:text-[#0052D9] disabled:opacity-50"
            >
              重新发送
            </button>
          </div>
          <div className="text-[10px] italic text-gray-400">
            {stableRunID ? "当前任务处理中" : "等待任务中"}
          </div>
        </div>
      </div>
    </div>
  );
}
