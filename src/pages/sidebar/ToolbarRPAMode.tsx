import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
  markKFToolbarRPAMessageDraftFilled,
  markKFToolbarRPAMessageFailed,
  type ToolbarRPABootstrap,
  type ToolbarRPASessionTask,
} from "@/services/rpaToolbarService";
import { getKFToolbarBootstrap } from "@/services/toolbarService";
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

type Props = {
  runId?: string;
  initialBootstrap?: ToolbarRPABootstrap | null;
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

async function resolveRuntimeContext(
  fallback?: {
    open_kfid?: string;
    external_userid?: string;
  } | null,
) {
  const currentContext = currentRuntimeContext(fallback);
  try {
    const runtime = await resolveSidebarRuntimeContext();
    return {
      openKFID: currentContext.openKFID,
      externalUserID: (
        runtime.external_userid ||
        currentContext.externalUserID ||
        ""
      ).trim(),
    };
  } catch {
    return currentContext;
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
      subtitle: "已记录待发送任务，正在等待 RPA 服务和连接器恢复后生成发送流程。",
      nextStep: "服务恢复后会自动生成 run 并继续发送，无需重新触发客户消息。",
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
      nextStep: "填入完成后，会等待 RPA 点击发送。",
      tone: "blue",
      visual: "typing",
    };
  }
  if (actionType === "wait_rpa_ack") {
    return {
      eyebrow: "等待确认",
      title: "等待 RPA 点击发送",
      subtitle: "消息已填入输入框，正在等待 clicked ACK 确认已点击发送。",
      nextStep: "收到 clicked ACK 后，才会继续推进后续会话。",
      tone: "amber",
      visual: "ack",
    };
  }
  if (actionType === "wait_wecom_confirm") {
    return {
      eyebrow: "后台确认",
      title: "已点击发送，正在后台确认",
      subtitle: "RPA 已确认点击发送，企业微信消息记录会继续异步确认。",
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
  const [boundRunID, setBoundRunID] = useState(
    (initialBootstrap?.run?.run_id || runId || "").trim(),
  );
  const timerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef("");

  const stableRunID = (snapshot?.run?.run_id || boundRunID || "").trim();
  const action = snapshot?.action || null;
  const actionType = (action?.type || "").trim();
  const pendingWindow = snapshot?.pending_window || null;
  const runStatus = (snapshot?.run?.status || "").trim().toLowerCase();
  const runIsTerminal =
    Boolean(stableRunID) && TERMINAL_RUN_STATUSES.has(runStatus);
  const hasActiveRun = Boolean(stableRunID) && !runIsTerminal;
  const progress = progressPercent(snapshot);
  const automationEnabled = Boolean(snapshot?.automation?.enabled);

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
      const context = await resolveRuntimeContext(currentSessionContext);
      const target = action?.target || {
        open_kfid: snapshot?.session_task?.open_kfid,
        external_userid: snapshot?.session_task?.external_userid,
      };
      const recentlyNavigated = hasRecentAutomationNavigation(
        runIDForBootstrap,
        target,
      );
      const useTargetContext =
        recentlyNavigated && isSameConversation(context, target, true);
      const next = (
        await getKFToolbarBootstrap({
        run_id: runIDForBootstrap,
        open_kfid:
          context.openKFID || (useTargetContext ? target.open_kfid || "" : ""),
        external_userid:
          context.externalUserID ||
          (useTargetContext ? target.external_userid || "" : ""),
          expect_rpa: true,
        })
      )?.rpa;
      if (!next) {
        throw new Error("RPA 自动发送状态暂时不可用");
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
    if ((snapshot?.mode || "").trim() === "rpa" && snapshot?.enabled) return;
    if (!onExitRPAMode) return;
    void onExitRPAMode();
  }, [onExitRPAMode, snapshot?.enabled, snapshot?.mode]);

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
    inFlightRef.current = key;
    let active = true;

    const run = async () => {
      try {
        if (actionType === "navigate_to_chat") {
          const context = await resolveRuntimeContext(currentSessionContext);
          if (
            isSameConversation(
              context,
              action.target,
              hasRecentAutomationNavigation(stableRunID, action.target),
            )
          ) {
            setNotice("当前已在目标会话，继续执行下一步...");
            const next = (
              await getKFToolbarBootstrap({
              run_id: stableRunID || "",
              open_kfid: context.openKFID || action.target?.open_kfid || "",
              external_userid:
                context.externalUserID || action.target?.external_userid || "",
                expect_rpa: true,
              })
            )?.rpa;
            if (!next) {
              throw new Error("RPA 自动发送状态暂时不可用");
            }
            if (!active) return;
            setSnapshot(next);
            return;
          }
          setNotice("正在进入下一个微信客服会话...");
          rememberAutomationNavigation(
            stableRunID || runId || "",
            action.target,
          );
          await openWecomKfConversation({
            open_kfid: action.target?.open_kfid || "",
            external_userid: action.target?.external_userid || "",
          });
          await sleep(700);
          const nextContext = await resolveRuntimeContext(
            currentSessionContext,
          );
          const next = (
            await getKFToolbarBootstrap({
            run_id: stableRunID || "",
            open_kfid: nextContext.openKFID || action.target?.open_kfid || "",
            external_userid:
              nextContext.externalUserID ||
              action.target?.external_userid ||
              "",
              expect_rpa: true,
            })
          )?.rpa;
          if (!next) {
            throw new Error("RPA 自动发送状态暂时不可用");
          }
          if (!active) return;
          setSnapshot(next);
          setNotice("已进入目标会话，准备填入消息。");
          return;
        }
        if (actionType === "completed") {
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
          const context = await resolveRuntimeContext(currentSessionContext);
          if (
            !isSameConversation(
              context,
              action.target,
              hasRecentAutomationNavigation(stableRunID, action.target),
            )
          ) {
            setNotice("正在进入人工复核会话...");
            rememberAutomationNavigation(
              stableRunID || runId || "",
              action.target,
            );
            await openWecomKfConversation({
              open_kfid: action.target?.open_kfid || "",
              external_userid: action.target?.external_userid || "",
            });
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
          setNotice("复核完成，正在继续自动化流程。");
          return;
        }
        if (actionType === "fill_current_message") {
          const message = action.message || action.messages?.[0];
          if (
            !stableRunID ||
            !action.message_task_id ||
            !action.session_task_id ||
            !(message?.text || "").trim()
          ) {
            return;
          }
          setNotice("正在填入当前消息，随后会通知 RPA 点击发送...");
          await sendTextToCurrentSession((message.text || "").trim(), {
            external_userid:
              action.target?.external_userid ||
              currentSessionContext?.external_userid ||
              "",
          });
          const context = await resolveRuntimeContext(currentSessionContext);
          const next = await markKFToolbarRPAMessageDraftFilled(
            action.message_task_id,
            {
              run_id: stableRunID,
              session_task_id: action.session_task_id,
              idempotency_key: newKey(),
              current_open_kfid:
                context.openKFID || action.target?.open_kfid || "",
              current_external_userid:
                context.externalUserID || action.target?.external_userid || "",
              message_hash: message.message_hash || "",
            },
          );
          if (!active) return;
          setSnapshot(next);
          setNotice("消息已填入，正在等待 RPA 点击发送。");
        }
      } catch (error) {
        const mapped = normalizeJSSDKRuntimeError(error);
        const message =
          actionType === "navigate_to_chat" ||
          actionType === "fill_current_message" ||
          actionType === "review_auto_resend"
            ? toJSSDKErrorMessage(mapped)
            : normalizeErrorMessage(error);
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
          ["confirm_uncertain", "review_resend_pending"].includes(
            (item.status || "").trim(),
          ) && (item.current_message_task_id || "").trim(),
      ),
    [snapshot?.pending_session_tasks],
  );
  const presentation = buildFlowPresentation({
    actionType,
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
  const agentName =
    currentTarget.open_kfid ||
    snapshot?.session_task?.open_kfid ||
    pendingWindow?.open_kfid ||
    "待确认";
  const channelLabel =
    currentTarget.channel_label ||
    snapshot?.session_task?.channel_label ||
    pendingWindow?.channel_label ||
    "";
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
  const currentStep = stepIndexByAction[actionType] || 0;
  const showPipeline = currentStep > 0;
  const pipelineSteps = [
    "navigate_to_chat",
    "fill_current_message",
    "wait_rpa_ack",
    "wait_wecom_confirm",
    "review_auto_resend",
  ];
  const actionIcon =
    actionType === "navigate_to_chat" ? (
      <ArrowRightLeft className="h-3.5 w-3.5" />
    ) : actionType === "fill_current_message" ? (
      <FileText className="h-3.5 w-3.5" />
    ) : actionType === "wait_rpa_ack" ? (
      <ShieldCheck className="h-3.5 w-3.5" />
    ) : actionType === "wait_wecom_confirm" ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : actionType === "review_auto_resend" ? (
      <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
    ) : actionType === "need_manual" ? (
      <AlertCircle className="h-3.5 w-3.5" />
    ) : actionType === "completed" ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : (
      <ShieldCheck className="h-3.5 w-3.5" />
    );
  const actionTone =
    pendingWindow && !hasActiveRun
      ? "amber"
      : actionType === "wait_rpa_ack"
      ? "amber"
      : actionType === "wait_wecom_confirm"
        ? "sky"
        : actionType === "review_auto_resend"
          ? "orange"
          : actionType === "need_manual"
            ? "red"
            : actionType === "completed"
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
    <div className={`${sidebarPageShell} bg-white`}>
      <style>{`
        @keyframes toolbar-rpa-dot {
          0%, 80%, 100% { opacity: 0.28; transform: translateY(0) scale(0.88); }
          40% { opacity: 1; transform: translateY(-2px) scale(1.05); }
        }
        .toolbar-rpa-dot { animation: toolbar-rpa-dot 1.2s ease-in-out infinite; }
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
              RPA 自动发送模式
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
              aria-label="刷新 RPA 自动模式"
            >
              <RefreshCcw
                className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded bg-black/10 p-2">
          <span className="shrink-0 text-[11px] uppercase tracking-widest text-white/80">
            当前客服:
          </span>
          <span className="truncate font-mono text-[11px] font-bold text-white">
            {agentName}
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
              开启后，工具栏会继续守护新的 RPA 发送任务。
            </span>
          </div>
        ) : (
          <>
            {(hasActiveRun ||
              currentTarget.open_kfid ||
              currentTarget.external_userid ||
              pendingWindow) ? (
              <div
                className={`rounded-r border-y border-r p-3 shadow-sm ${
                  actionType === "navigate_to_chat"
                    ? "border-indigo-100 border-l-4 border-l-indigo-500 bg-indigo-50"
                    : "border-blue-100 border-l-4 border-l-[#0052D9] bg-blue-50"
                }`}
              >
                <div
                  className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${
                    actionType === "navigate_to_chat"
                      ? "text-indigo-600"
                      : "text-[#0052D9]"
                  }`}
                >
                  {pendingWindow && !hasActiveRun
                    ? "等待恢复的会话"
                    : actionType === "navigate_to_chat"
                      ? "即将切换会话"
                      : "当前处理会话"}
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-bold text-gray-800">
                      买家: {customerName}
                    </div>
                    <div className="mt-1 truncate font-mono text-[10px] text-gray-500">
                      ext_user: {customerExternalUserID || "-"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] text-gray-400">会话上下文</div>
                    <div className="max-w-[130px] truncate text-xs font-semibold text-gray-700">
                      {channelLabel || "WeCom KF Window"}
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
                      <span className="rounded bg-amber-200/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                        RECOVERING
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
            ) : showPipeline ? (
              <div className="space-y-2.5">
                <div className="flex justify-between text-[11px] font-bold uppercase text-gray-500">
                  <span>自动化流水线</span>
                  <span className="text-[#0052D9]">Step {currentStep}/5</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {pipelineSteps.map((step, idx) => {
                    const stepNumber = idx + 1;
                    const active = currentStep >= stepNumber;
                    const current = currentStep === stepNumber;
                    const review = step === "review_auto_resend";
                    return (
                      <div
                        key={step}
                        className={`relative h-1.5 rounded-full ${
                          active
                            ? review
                              ? "bg-orange-500"
                              : "bg-[#0052D9]"
                            : "bg-gray-200"
                        }`}
                      >
                        {current ? (
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
                <div
                  className={`rounded-lg border p-3.5 shadow-sm ${actionToneClasses}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/80">
                      {actionIcon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-bold">
                          {presentation.title}
                        </div>
                        {actionType === "wait_rpa_ack" ? (
                          <span className="rounded bg-amber-200/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                            PENDING
                          </span>
                        ) : actionType === "wait_wecom_confirm" ? (
                          <span className="rounded bg-sky-200/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-800">
                            ASYNC
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-[11px] leading-snug text-gray-600">
                        {presentation.subtitle}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : actionType === "completed" ? (
              <div className="flex flex-col items-center justify-center py-8 text-center opacity-85">
                <CheckCircle2 className="mb-2 h-10 w-10 text-green-500" />
                <p className="text-sm font-bold text-gray-700">任务已就绪</p>
                <p className="mt-1 text-[10px] text-gray-500">
                  正在等待调度中心下发下一条发送任务。
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3 py-12 text-center opacity-70">
                <ShieldCheck className="h-10 w-10 text-gray-400" />
                <div className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  自动模式守护中
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  <span>等待新的客户消息或待发送任务</span>
                  {liveDots("bg-gray-400")}
                </div>
              </div>
            )}

            {previewMessages.length > 0 || hasActiveRun ? (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  消息内容预览
                </div>
                <div className="max-h-32 space-y-2 overflow-y-auto rounded border border-dashed border-gray-300 bg-[#F9FAFB] p-3 text-xs leading-relaxed text-gray-700">
                  {previewMessages.length > 0
                    ? previewMessages.map((item, idx) => (
                        <div key={`${item.message_id || "msg"}-${idx}`}>
                          {(item.text || "").trim()}
                        </div>
                      ))
                    : "当前会话正在推进中，下一条待发送消息出现后会显示在这里。"}
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
                  复核队列 ({reviewSessions.length})
                </div>
                {reviewSessions.length > 0 ? (
                  <span className="rounded border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                    异常
                  </span>
                ) : null}
              </div>
              {reviewSessions.length > 0 ? (
                <div className="space-y-2">
                  {reviewSessions.map((item) => {
                    const loadingKey = `review:${item.session_task_id || ""}`;
                    const isQueued =
                      (item.status || "").trim() === "review_resend_pending";
                    const displayName =
                      item.contact_name ||
                      item.external_userid ||
                      "待复核会话";
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
                              {sessionStatusLabel(item.status)}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!!commandLoading || isQueued}
                          onClick={() => void requestReviewResend(item)}
                          className="shrink-0 rounded border border-red-200 bg-white px-3 py-1.5 text-[11px] font-bold text-red-600 shadow-sm transition-colors hover:bg-red-100 disabled:opacity-60"
                        >
                          {commandLoading === loadingKey
                            ? "处理中"
                            : isQueued
                              ? "已排队"
                              : "去处理"}
                        </button>
                      </div>
                    );
                  })}
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
              onClick={() => void executeCommand("resume", "已继续自动化任务。")}
              className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white py-2.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlayCircle className="h-4 w-4" />
              恢复执行
            </button>
          ) : (
            <button
              type="button"
              disabled={!snapshot?.can_pause || !!commandLoading}
              onClick={() => void executeCommand("pause", "已暂停自动化任务。")}
              className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white py-2.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PauseCircle className="h-4 w-4" />
              暂停自动
            </button>
          )}
          <button
            type="button"
            disabled={!snapshot?.can_stop || !!commandLoading}
            onClick={() => void executeCommand("stop", "已停止自动化任务。")}
            className="flex items-center justify-center gap-2 rounded-md border border-red-200 bg-white py-2.5 text-sm font-bold text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Square className="h-4 w-4 fill-current" />
            停止守护
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
          <div className="font-mono text-[10px] italic text-gray-400">
            {stableRunID ? `run:${stableRunID.slice(-6)}` : "auto_active"}
          </div>
        </div>
      </div>
    </div>
  );
}
