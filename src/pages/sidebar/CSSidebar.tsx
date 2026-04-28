import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { WecomOpenDataName } from "@/components/wecom/WecomOpenDataName";
import { normalizeErrorMessage } from "@/services/http";
import {
  openWecomKfConversation,
  resolveSidebarRuntimeContext,
  sendTextToCurrentSession,
  toJSSDKErrorMessage,
} from "@/services/jssdkService";
import { executeContactSidebarCommand } from "@/services/sidebarService";
import {
  openRealtimeUpdatesSocket,
  type CommandCenterRealtimeEvent,
  type CommandCenterRealtimeEnvelope,
} from "@/services/commandCenterService";
import {
  getKFToolbarBootstrap,
  regenerateKFToolbarSuggestions,
  sendKFToolbarReplyFeedback,
  type KFToolbarBootstrap,
  type KFToolbarSuggestionBatch,
  type KFToolbarSuggestion,
} from "@/services/toolbarService";
import {
  sidebarBody,
  sidebarNotice,
  sidebarPageShell,
  sidebarSectionLabel,
} from "./sidebarChrome";
import { ToolbarDebugView } from "./ToolbarDebugView";
import {
  getKFToolbarRPABootstrap,
  getKFToolbarRPAOperatorBinding,
  saveKFToolbarRPAOperatorBinding,
  updateKFToolbarRPAAutomationMode,
  type ToolbarRPAOperatorBindingSnapshot,
  type ToolbarRPAAutomationState,
  type ToolbarRPABootstrap,
} from "@/services/rpaToolbarService";
import { listReceptionChannels } from "@/services/receptionService";
import { getOrganizationSettingsView } from "@/services/organizationSettingsService";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bug,
  Bot,
  CheckCircle2,
  Clock,
  Lightbulb,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ToolbarRPAMode } from "./ToolbarRPAMode";

type NormalizedSuggestion = {
  id: string;
  text: string;
  sentences: string[];
  hasFollowups: boolean;
  displayMode: string;
  nextStepLabel: string;
  reason: string;
  source: string;
};

type ToolbarBootstrapFetchResult = {
  data?: KFToolbarBootstrap | null;
};

function mergeToolbarHeader(
  prev?: KFToolbarBootstrap["header"] | null,
  next?: KFToolbarBootstrap["header"] | null,
): KFToolbarBootstrap["header"] | undefined {
  if (!prev && !next) return undefined;
  return {
    session_status_id: next?.session_status_id ?? prev?.session_status_id,
    session_status_code: next?.session_status_code || prev?.session_status_code,
    contact_name: next?.contact_name || prev?.contact_name,
    risk_tags: Array.from(
      new Set([...(prev?.risk_tags || []), ...(next?.risk_tags || [])].filter(Boolean)),
    ),
  };
}

type ToolbarConversationMessage = NonNullable<
  NonNullable<KFToolbarBootstrap["conversation"]>["messages"]
>[number];

function normalizeSuggestion(
  item: KFToolbarSuggestion,
  idx: number,
): NormalizedSuggestion {
  const sentences = (item.sentences || [])
    .map((entry) => (entry || "").trim())
    .filter(Boolean);
  const fallbackText = (item.text || "").trim();
  const safeSentences =
    sentences.length > 0
      ? sentences
      : fallbackText
        ? [fallbackText]
        : ["暂时没有建议内容"];
  return {
    id: (item.id || `suggestion-${idx + 1}`).trim(),
    text: fallbackText || safeSentences[0],
    sentences: safeSentences,
    hasFollowups: Boolean(item.has_followups) || safeSentences.length > 1,
    displayMode:
      (item.display_mode || "").trim() ||
      (safeSentences.length > 1 ? "threaded" : "single"),
    nextStepLabel: "继续填入下一句",
    reason: (item.reason || "").trim(),
    source: (item.source || "").trim(),
  };
}

function ToolbarSkeleton() {
  return (
    <div
      className={`${sidebarBody} min-h-0 flex-1 space-y-3`}
      style={{ overflowX: "hidden", overflowY: "auto" }}
    >
      <div className="wecom-toolbar-skeleton h-24 rounded-2xl" />
      <div className="wecom-toolbar-skeleton h-28 rounded-2xl" />
      <div className="wecom-toolbar-skeleton h-40 rounded-2xl" />
    </div>
  );
}

function parseRealtimeEventPayload(
  event?: CommandCenterRealtimeEvent,
): Record<string, unknown> {
  const raw = (event?.payload_json || "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function readRealtimeEventString(
  event: CommandCenterRealtimeEvent,
  key: string,
): string {
  const payload = parseRealtimeEventPayload(event);
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function realtimeEventExternalUserID(
  event: CommandCenterRealtimeEvent,
): string {
  return (
    event.external_userid ||
    readRealtimeEventString(event, "external_userid") ||
    readRealtimeEventString(event, "external_user_id") ||
    ""
  ).trim();
}

function realtimeEventOpenKFID(event: CommandCenterRealtimeEvent): string {
  return (
    event.open_kfid ||
    readRealtimeEventString(event, "open_kfid") ||
    readRealtimeEventString(event, "openKfid") ||
    ""
  ).trim();
}

function realtimeEventType(event: CommandCenterRealtimeEvent): string {
  return (
    event.event_type ||
    readRealtimeEventString(event, "event_type") ||
    readRealtimeEventString(event, "eventType") ||
    ""
  )
    .trim()
    .toLowerCase();
}

function matchesToolbarRealtimeSession(
  event: CommandCenterRealtimeEvent,
  openKFID: string,
  externalUserID: string,
): boolean {
  const targetOpenKFID = openKFID.trim();
  const targetExternalUserID = externalUserID.trim();
  if (!targetOpenKFID || !targetExternalUserID) return false;
  return (
    realtimeEventExternalUserID(event) === targetExternalUserID &&
    realtimeEventOpenKFID(event) === targetOpenKFID
  );
}

function isToolbarSuggestionRealtimeEvent(eventType: string): boolean {
  return (
    eventType.startsWith("chat.message.") ||
    eventType === "chat.session_state.changed"
  );
}

function isToolbarAnalysisRealtimeEvent(eventType: string): boolean {
  return (
    eventType.startsWith("chat.session_analysis.") ||
    eventType.startsWith("chat.message.") ||
    eventType === "chat.session_state.changed"
  );
}

function shouldRefreshToolbarSession(
  payload: CommandCenterRealtimeEnvelope,
  openKFID: string,
  externalUserID: string,
): boolean {
  return (payload.events || []).some((event) =>
    matchesToolbarRealtimeSession(event, openKFID, externalUserID),
  );
}

function formatToolbarSelectionTime(value?: string): string {
  const parsed = (value || "").trim();
  if (!parsed) return "";
  const millis = Date.parse(parsed.replace(" ", "T"));
  if (Number.isNaN(millis)) return parsed;
  return new Date(millis).toLocaleString("zh-CN", { hour12: false });
}

function buildToolbarSessionKey(input?: {
  open_kfid?: string;
  external_userid?: string;
  selection_required?: boolean;
}): string {
  const openKFID = (input?.open_kfid || "").trim();
  const externalUserID = (input?.external_userid || "").trim();
  if (input?.selection_required) return `selection::${externalUserID}`;
  if (!openKFID || !externalUserID) return "";
  return `${openKFID}\u001f${externalUserID}`;
}

const MANUAL_SELECTION_HANDOFF_STORAGE_KEY =
  "wecom-toolbar-manual-selection-handoff-v1";
const MANUAL_SELECTION_HANDOFF_TTL_MS = 45_000;
const AUTOMATION_NAVIGATION_HANDOFF_STORAGE_KEY =
  "wecom-toolbar-rpa-automation-handoff-v1";
const AUTOMATION_NAVIGATION_HANDOFF_TTL_MS = 60_000;

type ManualSelectionHandoff = {
  open_kfid?: string;
  external_userid?: string;
  source?: "manual_selection" | string;
  selected_at?: string;
  expires_at?: number;
};

type AutomationNavigationHandoff = {
  run_id?: string;
  open_kfid?: string;
  external_userid?: string;
  source?: "automation_dispatch" | string;
  selected_at?: string;
  expires_at?: number;
};

function readManualSelectionHandoff(): ManualSelectionHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.sessionStorage.getItem(MANUAL_SELECTION_HANDOFF_STORAGE_KEY) ||
      window.localStorage.getItem(MANUAL_SELECTION_HANDOFF_STORAGE_KEY) ||
      "";
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ManualSelectionHandoff;
    if (!parsed || typeof parsed !== "object") return null;
    const expiresAt = Number(parsed.expires_at || 0);
    if (expiresAt > 0 && Date.now() > expiresAt) {
      clearManualSelectionHandoff();
      return null;
    }
    if ((parsed.source || "").trim() !== "manual_selection") return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearManualSelectionHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(MANUAL_SELECTION_HANDOFF_STORAGE_KEY);
  } catch {
    // Best effort only.
  }
  try {
    window.localStorage.removeItem(MANUAL_SELECTION_HANDOFF_STORAGE_KEY);
  } catch {
    // Best effort only.
  }
}

function readAutomationNavigationHandoff(): AutomationNavigationHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.sessionStorage.getItem(
        AUTOMATION_NAVIGATION_HANDOFF_STORAGE_KEY,
      ) ||
      window.localStorage.getItem(AUTOMATION_NAVIGATION_HANDOFF_STORAGE_KEY) ||
      "";
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AutomationNavigationHandoff;
    if (!parsed || typeof parsed !== "object") return null;
    const expiresAt = Number(parsed.expires_at || 0);
    if (expiresAt > 0 && Date.now() > expiresAt) {
      clearAutomationNavigationHandoff();
      return null;
    }
    if ((parsed.source || "").trim() !== "automation_dispatch") return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearAutomationNavigationHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(AUTOMATION_NAVIGATION_HANDOFF_STORAGE_KEY);
  } catch {
    // Best effort only.
  }
  try {
    window.localStorage.removeItem(AUTOMATION_NAVIGATION_HANDOFF_STORAGE_KEY);
  } catch {
    // Best effort only.
  }
}

function writeManualSelectionHandoff(input?: {
  open_kfid?: string;
  external_userid?: string;
}): void {
  if (typeof window === "undefined") return;
  const openKFID = (input?.open_kfid || "").trim();
  const externalUserID = (input?.external_userid || "").trim();
  if (!openKFID || !externalUserID) return;
  const payload: ManualSelectionHandoff = {
    open_kfid: openKFID,
    external_userid: externalUserID,
    source: "manual_selection",
    selected_at: new Date().toISOString(),
    expires_at: Date.now() + MANUAL_SELECTION_HANDOFF_TTL_MS,
  };
  try {
    const raw = JSON.stringify(payload);
    window.sessionStorage.setItem(MANUAL_SELECTION_HANDOFF_STORAGE_KEY, raw);
    window.localStorage.setItem(MANUAL_SELECTION_HANDOFF_STORAGE_KEY, raw);
  } catch {
    // Best effort only.
  }
}

function consumeManualSelectionHandoff(
  externalUserID?: string,
): ManualSelectionHandoff | null {
  const handoff = readManualSelectionHandoff();
  if (!handoff) return null;
  const handoffExternalUserID = (handoff.external_userid || "").trim();
  if (!handoffExternalUserID) {
    clearManualSelectionHandoff();
    return null;
  }
  if (
    (externalUserID || "").trim() &&
    handoffExternalUserID !== (externalUserID || "").trim()
  ) {
    return null;
  }
  clearManualSelectionHandoff();
  return handoff;
}

function consumeAutomationNavigationHandoff(input?: {
  run_id?: string;
  external_userid?: string;
}): AutomationNavigationHandoff | null {
  const handoff = readAutomationNavigationHandoff();
  if (!handoff) return null;
  const handoffExternalUserID = (handoff.external_userid || "").trim();
  const handoffRunID = (handoff.run_id || "").trim();
  if (!handoffExternalUserID) {
    clearAutomationNavigationHandoff();
    return null;
  }
  const expectedExternalUserID = (input?.external_userid || "").trim();
  if (
    expectedExternalUserID &&
    handoffExternalUserID !== expectedExternalUserID
  ) {
    return null;
  }
  const expectedRunID = (input?.run_id || "").trim();
  if (expectedRunID && handoffRunID && handoffRunID !== expectedRunID) {
    return null;
  }
  clearAutomationNavigationHandoff();
  return handoff;
}

function readInitialToolbarQuery() {
  if (typeof window === "undefined") {
    return {
      entry: "single_kf_tools",
      open_kfid: "",
      external_userid: "",
      rpa_run_id: "",
      toolbar_mode: "",
    };
  }
  const manualHandoff = consumeManualSelectionHandoff();
  const automationHandoff = !manualHandoff
    ? consumeAutomationNavigationHandoff()
    : null;
  return {
    entry: "single_kf_tools",
    open_kfid: (
      manualHandoff?.open_kfid ||
      automationHandoff?.open_kfid ||
      ""
    ).trim(),
    external_userid: (
      manualHandoff?.external_userid ||
      automationHandoff?.external_userid ||
      ""
    ).trim(),
    rpa_run_id: (automationHandoff?.run_id || "").trim(),
    toolbar_mode: automationHandoff ? "rpa" : "",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function sanitizeToolbarNotice(error: unknown): string {
  const raw = normalizeErrorMessage(error).trim();
  if (!raw) return "建议回复暂时不可用，请稍后再试";
  const lowered = raw.toLowerCase();
  if (
    lowered.includes("followup_task_empty") ||
    lowered.includes("follow_up_task_empty") ||
    lowered.includes("followup") ||
    lowered.includes("follow_up")
  ) {
    return "本次未生成到分步回复建议，你可以换一批再试";
  }
  if (lowered.includes("deadline exceeded") || lowered.includes("timeout")) {
    return "建议回复生成超时，请稍后再试";
  }
  if (lowered.includes("empty result")) {
    return "本次未生成到有效建议，请换一批重试";
  }
  return raw;
}

function compactToolbarFacts(items?: string[], limit = 3): string[] {
  const next = Array.from(
    new Set((items || []).map((item) => (item || "").trim()).filter(Boolean)),
  );
  return next.slice(0, limit);
}

function toolbarSessionStatusLabel(raw?: string, statusID?: number): string {
  const value = (raw || "").trim().toLowerCase();
  switch (value) {
    case "selection_required":
      return "待选择会话";
    case "unassigned":
      return "未处理";
    case "assistant":
      return "AI 接待中";
    case "queueing":
      return "排队中";
    case "human":
      return "人工辅助中";
    case "closed":
      return "已结束";
    case "unknown":
      return "会话中";
    default:
      break;
  }
  switch (statusID) {
    case -1:
      return "待选择会话";
    case 0:
      return "未处理";
    case 1:
      return "AI 接待中";
    case 2:
      return "排队中";
    case 3:
      return "人工辅助中";
    case 4:
      return "已结束";
    default:
      return raw && /[\u4e00-\u9fa5]/.test(raw) ? raw : "会话中";
  }
}

function toolbarRiskTagLabel(raw?: string): string {
  switch ((raw || "").trim()) {
    case "high_risk":
      return "高风险";
    case "attention_required":
      return "需关注";
    case "high_intent":
      return "高意向";
    case "pending_upgrade":
      return "待升级";
    case "price_sensitive":
      return "价格敏感";
    case "complaint_risk":
      return "投诉风险";
    case "executive_attention_required":
      return "需高管介入";
    default:
      return (raw || "").trim();
  }
}

function toolbarJourneyStageLabel(raw?: string): string {
  switch ((raw || "").trim()) {
    case "discovery":
      return "初步了解";
    case "evaluation":
      return "意向沟通中";
    case "purchase":
      return "准备下单";
    case "fulfillment":
      return "履约跟进";
    case "after_sales":
      return "售后处理中";
    case "complaint":
      return "投诉处理";
    case "unknown":
      return "阶段未知";
    default:
      return (raw || "").trim();
  }
}

function toolbarOpportunityLevelLabel(raw?: string): string {
  switch ((raw || "").trim()) {
    case "none":
      return "无明显机会";
    case "low":
      return "低意向机会";
    case "medium":
      return "中意向机会";
    case "high":
      return "高意向潜力";
    default:
      return (raw || "").trim();
  }
}

function toolbarProfileTagLabel(raw?: string): string {
  const value = (raw || "").trim();
  if (value.startsWith("journey_")) {
    return toolbarJourneyStageLabel(value.slice("journey_".length));
  }
  if (value.startsWith("opportunity_")) {
    return toolbarOpportunityLevelLabel(value.slice("opportunity_".length));
  }
  return toolbarRiskTagLabel(value);
}

function normalizeToolbarSummaryStatus(raw?: string): string {
  const value = (raw || "").trim().toLowerCase();
  if (!value) return "pending";
  if (["succeeded", "success", "completed"].includes(value)) return "ready";
  if (value === "processing") return "running";
  if (
    [
      "selection_required",
      "running",
      "queued",
      "failed",
      "ready",
      "pending",
    ].includes(value)
  ) {
    return value;
  }
  return value;
}

function toolbarSummaryGeneratedTimeValue(
  summary?: KFToolbarBootstrap["summary"] | null,
): number {
  const raw = (summary?.generated_at || summary?.updated_at || "").trim();
  if (!raw) return 0;
  const value = Date.parse(raw);
  return Number.isNaN(value) ? 0 : value;
}

function toolbarSummaryWorkTimeValue(
  summary?: KFToolbarBootstrap["summary"] | null,
): number {
  const raw = (summary?.updated_at || summary?.generated_at || "").trim();
  if (!raw) return 0;
  const value = Date.parse(raw);
  return Number.isNaN(value) ? 0 : value;
}

function mergeToolbarSummary(
  prev?: KFToolbarBootstrap["summary"] | null,
  next?: KFToolbarBootstrap["summary"] | null,
): KFToolbarBootstrap["summary"] | undefined {
  if (!next) return prev || undefined;
  if (!prev) return next;
  const prevStatus = normalizeToolbarSummaryStatus(prev.status);
  const nextStatus = normalizeToolbarSummaryStatus(next.status);
  const prevWorkTime = toolbarSummaryWorkTimeValue(prev);
  const nextGeneratedTime = toolbarSummaryGeneratedTimeValue(next);
  if (
    (prevStatus === "queued" || prevStatus === "running") &&
    nextStatus === "pending"
  ) {
    return {
      ...prev,
      ...next,
      status: prev.status,
    };
  }
  if (
    (prevStatus === "queued" || prevStatus === "running") &&
    nextStatus === "ready" &&
    prevWorkTime > 0 &&
    (nextGeneratedTime <= 0 || nextGeneratedTime < prevWorkTime)
  ) {
    return prev;
  }
  return next;
}

function normalizeToolbarSuggestionStatus(raw?: string): string {
  const value = (raw || "").trim().toLowerCase();
  if (!value) return "idle";
  if (value === "success" || value === "completed") return "ready";
  if (value === "processing") return "running";
  if (["queued", "running", "ready", "failed", "idle"].includes(value))
    return value;
  return "idle";
}

function toolbarBatchTimeValue(
  batch?: KFToolbarSuggestionBatch | null,
): number {
  const raw = (batch?.updated_at || batch?.generated_at || "").trim();
  if (!raw) return 0;
  const value = Date.parse(raw);
  return Number.isNaN(value) ? 0 : value;
}

function mergeToolbarSuggestionBatch(
  prev?: KFToolbarSuggestionBatch | null,
  next?: KFToolbarSuggestionBatch | null,
): KFToolbarSuggestionBatch {
  if (!next) return prev || { batch_id: "", items: [] };
  if (!prev) return next;

  const prevStatus = normalizeToolbarSuggestionStatus(prev.status);
  const nextStatus = normalizeToolbarSuggestionStatus(next.status);
  const prevBatchID = (prev.batch_id || "").trim();
  const nextBatchID = (next.batch_id || "").trim();
  const prevItemsCount = prev.items?.length || 0;
  const nextItemsCount = next.items?.length || 0;
  const prevTime = toolbarBatchTimeValue(prev);
  const nextTime = toolbarBatchTimeValue(next);

  if (
    (prevStatus === "queued" || prevStatus === "running") &&
    nextStatus === "ready" &&
    prevTime > 0 &&
    (nextTime <= 0 || nextTime < prevTime)
  ) {
    return prev;
  }
  if (nextBatchID && nextBatchID !== prevBatchID) {
    return next;
  }
  if (
    (nextStatus === "ready" || nextStatus === "failed") &&
    prevStatus !== nextStatus
  ) {
    if (
      (prevStatus === "queued" || prevStatus === "running") &&
      nextStatus === "ready" &&
      prevTime > 0 &&
      nextTime > 0 &&
      nextTime < prevTime
    ) {
      return prev;
    }
    return next;
  }
  if (nextItemsCount > 0 && prevItemsCount === 0) {
    return next;
  }
  if (nextTime > 0 && prevTime > 0 && nextTime >= prevTime) {
    return next;
  }
  if (
    (prevStatus === "queued" || prevStatus === "running") &&
    nextStatus === "idle" &&
    nextItemsCount === 0
  ) {
    return prev;
  }
  if (
    prevStatus === "ready" &&
    (nextStatus === "queued" || nextStatus === "running") &&
    prevItemsCount > 0 &&
    nextItemsCount === 0 &&
    nextTime <= prevTime
  ) {
    return prev;
  }
  return next;
}

function shouldRefreshToolbarSuggestions(
  payload: CommandCenterRealtimeEnvelope,
  openKFID: string,
  externalUserID: string,
): boolean {
  return (payload.events || []).some((event) => {
    if (!matchesToolbarRealtimeSession(event, openKFID, externalUserID))
      return false;
    return isToolbarSuggestionRealtimeEvent(realtimeEventType(event));
  });
}

function shouldRefreshToolbarAnalysis(
  payload: CommandCenterRealtimeEnvelope,
  openKFID: string,
  externalUserID: string,
): boolean {
  return (payload.events || []).some((event) => {
    if (!matchesToolbarRealtimeSession(event, openKFID, externalUserID))
      return false;
    return isToolbarAnalysisRealtimeEvent(realtimeEventType(event));
  });
}

function nextToolbarAnalysisRealtimeStatus(
  payload: CommandCenterRealtimeEnvelope,
  openKFID: string,
  externalUserID: string,
): string {
  const matched = (payload.events || []).filter((event) =>
    matchesToolbarRealtimeSession(event, openKFID, externalUserID),
  );
  const stateEvent = matched.find(
    (event) => realtimeEventType(event) === "chat.session_analysis.state_changed",
  );
  const status = stateEvent ? readRealtimeEventString(stateEvent, "status") : "";
  const normalized = normalizeToolbarSummaryStatus(status);
  if (normalized === "queued" || normalized === "running") return normalized;
  if (
    matched.some((event) => realtimeEventType(event) === "chat.message.received")
  ) {
    return "queued";
  }
  return "";
}

function shouldRefreshToolbarImmediately(eventTypes: string[]): boolean {
  return eventTypes.some(
    (eventType) =>
      isToolbarAnalysisRealtimeEvent(eventType) ||
      isToolbarSuggestionRealtimeEvent(eventType),
  );
}

function matchingToolbarEventTypes(
  payload: CommandCenterRealtimeEnvelope,
  openKFID: string,
  externalUserID: string,
): string[] {
  const targetOpenKFID = openKFID.trim();
  const targetExternalUserID = externalUserID.trim();
  if (!targetOpenKFID || !targetExternalUserID) return [];
  return (payload.events || [])
    .filter((event) =>
      matchesToolbarRealtimeSession(event, targetOpenKFID, targetExternalUserID),
    )
    .map((event) => realtimeEventType(event))
    .filter(Boolean);
}

function buildRealtimeEnvelopeSignature(
  payload: CommandCenterRealtimeEnvelope,
  openKFID: string,
  externalUserID: string,
): string {
  const eventKeys = (payload.events || [])
    .filter((event) =>
      matchesToolbarRealtimeSession(event, openKFID, externalUserID),
    )
    .map((event) =>
      [
        (event.event_id || "").trim(),
        Number(event.cursor || 0),
        realtimeEventType(event),
      ].join(":"),
    )
    .filter(Boolean)
    .sort();
  const latestCursor = Number(payload.latest_cursor || 0);
  if (eventKeys.length === 0 && latestCursor <= 0) return "";
  return `${latestCursor}\u001f${eventKeys.join("|")}`;
}

function formatToolbarMessageTime(value?: string): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const millis = Date.parse(raw.replace(" ", "T"));
  if (Number.isNaN(millis)) return raw;
  return new Date(millis).toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveToolbarMessageRole(
  message?: ToolbarConversationMessage | null,
): "assistant" | "staff" | "customer" | "system" {
  const sender = (message?.sender || "").trim().toLowerCase();
  if (sender === "assistant") return "assistant";
  if (sender === "staff") return "staff";
  if (sender === "system" || sender === "event") return "system";
  return "customer";
}

function summarizeToolbarStatusCopy(input?: {
  sessionStatusID?: number;
  summaryStatus?: string;
}): {
  badgeText: string;
  badgeVariant: "success" | "secondary" | "warning";
  helperText: string;
} {
  const sessionStatusID = Number(input?.sessionStatusID ?? -99);
  const summaryStatus = (input?.summaryStatus || "").trim().toLowerCase();
  if (summaryStatus === "queued") {
    return {
      badgeText: "待更新",
      badgeVariant: "warning",
      helperText: "检测到新的客户消息，AI 正在准备本轮分析与回复建议。",
    };
  }
  if (summaryStatus === "running") {
    return {
      badgeText: "分析中",
      badgeVariant: "warning",
      helperText: "AI 正在整理客户意图、阻力和下一步服务动作。",
    };
  }
  if (summaryStatus === "failed") {
    return {
      badgeText: "分析失败",
      badgeVariant: "warning",
      helperText: "本轮分析暂未完成，可等待后续事件或手动刷新聊天区后再查看。",
    };
  }
  switch (sessionStatusID) {
    case 0:
      return {
        badgeText: "待建模",
        badgeVariant: "secondary",
        helperText:
          "当前会话仍处于未处理状态，建议等待客户表达更多信息后再形成稳定判断。",
      };
    case 1:
      return {
        badgeText: "助手监测中",
        badgeVariant: "success",
        helperText:
          "智能助手接待中，分析重点放在客户目标、风险信号和接手前上下文准备。",
      };
    case 2:
      return {
        badgeText: "待人工接手",
        badgeVariant: "warning",
        helperText:
          "会话在待接入池排队中，当前分析更偏向接手摘要和优先级判断。",
      };
    case 3:
      return {
        badgeText: "人工辅助中",
        badgeVariant: "success",
        helperText: "人工接待中，分析会持续刷新成交信号、主要阻力和建议动作。",
      };
    case 4:
      return {
        badgeText: "历史结论",
        badgeVariant: "secondary",
        helperText: "会话已结束，当前展示的是最近一次沉淀下来的分析结论。",
      };
    default:
      return {
        badgeText: "已准备",
        badgeVariant: "secondary",
        helperText: "当前展示的是最新可用的会话分析结果。",
      };
  }
}

export default function CSSidebar() {
  const query = useMemo(() => readInitialToolbarQuery(), []);
  const shouldResolveRuntimeContext =
    (query.entry || "").trim() === "single_kf_tools" &&
    (!(query.external_userid || "").trim() || !(query.open_kfid || "").trim());

  const [bootstrap, setBootstrap] = useState<KFToolbarBootstrap | null>(null);
  const [notice, setNotice] = useState("");
  const [suggestionNotice, setSuggestionNotice] = useState("");
  const [conversationNotice, setConversationNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [rpaBootstrap, setRPABootstrap] = useState<ToolbarRPABootstrap | null>(
    null,
  );
  const [rpaAutomation, setRPAAutomation] =
    useState<ToolbarRPAAutomationState | null>(null);
  const [rpaOperatorBinding, setRPAOperatorBinding] =
    useState<ToolbarRPAOperatorBindingSnapshot | null>(null);
  const [rpaClientIDDraft, setRPAClientIDDraft] = useState("");
  const [rpaBindingNotice, setRPABindingNotice] = useState("");
  const [isLoadingRPABinding, setIsLoadingRPABinding] = useState(false);
  const [isSavingRPABinding, setIsSavingRPABinding] = useState(false);
  const [isUpdatingAutomationMode, setIsUpdatingAutomationMode] =
    useState(false);
  const [isRPAPanelOpen, setIsRPAPanelOpen] = useState(false);
  const [isRPABindingModalOpen, setIsRPABindingModalOpen] = useState(false);
  const [pendingEnableAutoMode, setPendingEnableAutoMode] = useState(false);
  const [isResolvingContext, setIsResolvingContext] = useState(
    shouldResolveRuntimeContext,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRefreshingConversation, setIsRefreshingConversation] =
    useState(false);
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"main" | "debug">("main");
  const [isToolbarDebugEnabled, setIsToolbarDebugEnabled] = useState(false);
  const [isLoadingToolbarDebugConfig, setIsLoadingToolbarDebugConfig] =
    useState(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isUpgraded, setIsUpgraded] = useState(false);
  const [selectingSessionKey, setSelectingSessionKey] = useState("");
  const [upgradeOwner, setUpgradeOwner] = useState("销售 A");
  const [upgradeIntent, setUpgradeIntent] = useState("高");
  const [upgradeNote, setUpgradeNote] = useState("");
  const [threadSteps, setThreadSteps] = useState<Record<string, number>>({});
  const [channelDisplayMap, setChannelDisplayMap] = useState<
    Record<string, string>
  >({});
  const refreshTimerRef = useRef<number | null>(null);
  const bootstrapProbeTimerRef = useRef<number | null>(null);
  const toolbarNoticeTimerRef = useRef<number | null>(null);
  const suggestionNoticeTimerRef = useRef<number | null>(null);
  const conversationNoticeTimerRef = useRef<number | null>(null);
  const bootstrapFetchRef = useRef<{
    key: string;
    promise: Promise<ToolbarBootstrapFetchResult>;
  } | null>(null);
  const bootstrapApplyKeyRef = useRef("");
  const realtimeCursorRef = useRef(0);
  const realtimeEnvelopeRef = useRef<{ signature: string; at: number } | null>(
    null,
  );
  const bootstrapSessionKeyRef = useRef("");
  const suggestionRequestSeqRef = useRef(0);
  const conversationScrollRef = useRef<HTMLDivElement | null>(null);
  const [sessionLocator, setSessionLocator] = useState(query);
  const automationEnabled = Boolean(
    rpaBootstrap?.automation?.enabled || rpaAutomation?.enabled,
  );
  const isRPARealtimePanelActive = Boolean(
    rpaBootstrap || automationEnabled || isRPAPanelOpen,
  );

  const clearSuggestionNotice = () => {
    if (suggestionNoticeTimerRef.current !== null) {
      window.clearTimeout(suggestionNoticeTimerRef.current);
      suggestionNoticeTimerRef.current = null;
    }
    setSuggestionNotice("");
  };

  const clearConversationNotice = () => {
    if (conversationNoticeTimerRef.current !== null) {
      window.clearTimeout(conversationNoticeTimerRef.current);
      conversationNoticeTimerRef.current = null;
    }
    setConversationNotice("");
  };

  const pushToolbarNotice = (message: string) => {
    const next = message.trim();
    if (!next) return;
    if (toolbarNoticeTimerRef.current !== null) {
      window.clearTimeout(toolbarNoticeTimerRef.current);
    }
    setNotice(next);
    toolbarNoticeTimerRef.current = window.setTimeout(() => {
      toolbarNoticeTimerRef.current = null;
      setNotice("");
    }, 2800);
  };

  const pushSuggestionNotice = (message: string) => {
    const next = message.trim();
    if (!next) return;
    if (suggestionNoticeTimerRef.current !== null) {
      window.clearTimeout(suggestionNoticeTimerRef.current);
    }
    setSuggestionNotice(next);
    suggestionNoticeTimerRef.current = window.setTimeout(() => {
      suggestionNoticeTimerRef.current = null;
      setSuggestionNotice("");
    }, 2800);
  };

  const pushConversationNotice = (message: string) => {
    const next = message.trim();
    if (!next) return;
    if (conversationNoticeTimerRef.current !== null) {
      window.clearTimeout(conversationNoticeTimerRef.current);
    }
    setConversationNotice(next);
    conversationNoticeTimerRef.current = window.setTimeout(() => {
      conversationNoticeTimerRef.current = null;
      setConversationNotice("");
    }, 2800);
  };

  const fetchToolbarBootstrap = async (input: {
    entry: string;
    openKFID: string;
    externalUserID: string;
    light: boolean;
  }): Promise<ToolbarBootstrapFetchResult> => {
    const key = [
      input.entry,
      input.openKFID,
      input.externalUserID,
      input.light ? "light" : "full",
    ].join("\u001f");
    if (bootstrapFetchRef.current?.key === key) {
      return bootstrapFetchRef.current.promise;
    }
    const promise = (async () => {
      const data = await getKFToolbarBootstrap({
        entry: input.entry,
        open_kfid: input.openKFID,
        external_userid: input.externalUserID,
        light: input.light,
        expect_rpa: false,
      });
      return { data };
    })();
    bootstrapFetchRef.current = { key, promise };
    try {
      return await promise;
    } finally {
      if (bootstrapFetchRef.current?.promise === promise) {
        bootstrapFetchRef.current = null;
      }
    }
  };

  useEffect(() => {
    setSessionLocator({
      ...query,
      open_kfid: (query.open_kfid || "").trim(),
      external_userid: (query.external_userid || "").trim(),
    });
  }, [query]);

  useEffect(() => {
    return () => {
      if (bootstrapProbeTimerRef.current !== null) {
        window.clearTimeout(bootstrapProbeTimerRef.current);
      }
      if (toolbarNoticeTimerRef.current !== null) {
        window.clearTimeout(toolbarNoticeTimerRef.current);
      }
      if (suggestionNoticeTimerRef.current !== null) {
        window.clearTimeout(suggestionNoticeTimerRef.current);
      }
      if (conversationNoticeTimerRef.current !== null) {
        window.clearTimeout(conversationNoticeTimerRef.current);
      }
    };
  }, []);

  const loadRPAOperatorBinding = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoadingRPABinding(true);
    }
    try {
      const snapshot = await getKFToolbarRPAOperatorBinding();
      setRPAOperatorBinding(snapshot);
      setRPAAutomation(snapshot?.automation || null);
      setRPAClientIDDraft((prev) => {
        if ((prev || "").trim()) return prev;
        return (snapshot?.binding?.rpa_client_id || "").trim();
      });
      return snapshot;
    } catch (error) {
      if (!options?.silent) {
        setRPABindingNotice(
          normalizeErrorMessage(error) || "读取 RPA 识别码绑定失败，请稍后再试",
        );
      }
      return null;
    } finally {
      if (!options?.silent) {
        setIsLoadingRPABinding(false);
      }
    }
  };

  useEffect(() => {
    if (isResolvingContext) return;
    void loadRPAOperatorBinding();
  }, [isResolvingContext]);

  useEffect(() => {
    let alive = true;
    if (!shouldResolveRuntimeContext) {
      setIsResolvingContext(false);
      return;
    }

    setIsResolvingContext(true);
    void resolveSidebarRuntimeContext()
      .then((runtime) => {
        if (!alive) return;
        const runtimeExternalUserID = (runtime.external_userid || "").trim();
        const runtimeEntry = (runtime.entry || "").trim();
        setSessionLocator((prev) => ({
          ...prev,
          entry: runtimeEntry || prev.entry || query.entry,
          open_kfid: prev.open_kfid || query.open_kfid,
          external_userid:
            runtimeExternalUserID ||
            prev.external_userid ||
            query.external_userid,
        }));
      })
      .catch(() => {
        if (!alive) return;
        setSessionLocator(query);
      })
      .finally(() => {
        if (!alive) return;
        setIsResolvingContext(false);
      });

    return () => {
      alive = false;
    };
  }, [query, shouldResolveRuntimeContext]);

  useEffect(() => {
    let alive = true;
    void listReceptionChannels({ limit: 500 })
      .then((channels) => {
        if (!alive) return;
        const next: Record<string, string> = {};
        channels.forEach((channel) => {
          const openKFID = (channel.open_kfid || "").trim();
          const label = (
            channel.display_name ||
            channel.name ||
            openKFID
          ).trim();
          if (!openKFID || !label) return;
          next[openKFID] = label;
        });
        setChannelDisplayMap(next);
      })
      .catch(() => {
        if (!alive) return;
        setChannelDisplayMap({});
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setIsLoadingToolbarDebugConfig(true);
    void getOrganizationSettingsView()
      .then((view) => {
        if (!alive) return;
        const enabled = Boolean(
          (view?.debug_switches || []).find(
            (item) =>
              (item.key || "").trim() === "enable_toolbar_debug_entry" &&
              item.enabled,
          ),
        );
        setIsToolbarDebugEnabled(enabled);
      })
      .catch(() => {
        if (!alive) return;
        setIsToolbarDebugEnabled(false);
      })
      .finally(() => {
        if (!alive) return;
        setIsLoadingToolbarDebugConfig(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const loadSuggestions = async (input?: {
    entry?: string;
    open_kfid?: string;
    external_userid?: string;
    seed_reply_id?: string;
    reason?: string;
    silentNotice?: boolean;
    manual?: boolean;
  }): Promise<boolean> => {
    const entry = (
      input?.entry ||
      bootstrap?.entry ||
      sessionLocator.entry ||
      query.entry ||
      "single_kf_tools"
    ).trim();
    const openKFID = (
      input?.open_kfid ||
      bootstrap?.open_kfid ||
      sessionLocator.open_kfid ||
      query.open_kfid ||
      ""
    ).trim();
    const externalUserID = (
      input?.external_userid ||
      bootstrap?.external_userid ||
      sessionLocator.external_userid ||
      query.external_userid ||
      ""
    ).trim();
    const canLoad =
      input?.manual ||
      Boolean(bootstrap?.capabilities?.regenerate) ||
      Boolean(bootstrap?.capabilities?.auto_refresh_suggestions);
    if (!openKFID || !externalUserID) {
      setIsLoadingSuggestions(false);
      return false;
    }
    if (!canLoad) {
      setIsLoadingSuggestions(false);
      return false;
    }

    const requestSeq = suggestionRequestSeqRef.current + 1;
    suggestionRequestSeqRef.current = requestSeq;
    if (input?.manual) {
      setIsRegenerating(true);
    } else {
      setIsLoadingSuggestions(true);
    }

    try {
      const batch = await regenerateKFToolbarSuggestions({
        entry,
        open_kfid: openKFID,
        external_userid: externalUserID,
        seed_reply_id: (input?.seed_reply_id || "").trim(),
        reason: (input?.reason || "bootstrap").trim(),
      });
      if (suggestionRequestSeqRef.current !== requestSeq) return false;
      const nextBatch: KFToolbarSuggestionBatch = batch || {
        batch_id: "",
        items: [],
      };
      setBootstrap((prev) => {
        if (!prev) return prev;
        const prevSessionKey = buildToolbarSessionKey({
          open_kfid: prev.open_kfid,
          external_userid: prev.external_userid,
          selection_required: prev.selection?.required,
        });
        const nextSessionKey = buildToolbarSessionKey({
          open_kfid: openKFID,
          external_userid: externalUserID,
        });
        if (!prevSessionKey || prevSessionKey !== nextSessionKey) {
          return prev;
        }
        return {
          ...prev,
          suggestions: nextBatch,
        };
      });
      if (input?.manual) {
        pushSuggestionNotice("已更新一组新的建议回复");
      } else {
        clearSuggestionNotice();
      }
      return true;
    } catch (error) {
      if (suggestionRequestSeqRef.current !== requestSeq) return false;
      if (!input?.silentNotice) {
        pushSuggestionNotice(sanitizeToolbarNotice(error));
      }
      setBootstrap((prev) =>
        prev
          ? {
              ...prev,
              suggestions: { batch_id: "", items: [] },
            }
          : prev,
      );
      return false;
    } finally {
      if (suggestionRequestSeqRef.current === requestSeq) {
        setIsLoadingSuggestions(false);
        setIsRegenerating(false);
      }
    }
  };

  const loadBootstrap = async (options?: {
    preserveNotice?: boolean;
    silent?: boolean;
    preserveConversation?: boolean;
    light?: boolean;
    forceDuringRPA?: boolean;
  }): Promise<boolean> => {
    if (
      options?.light === true &&
      isRPARealtimePanelActive &&
      !options.forceDuringRPA
    ) {
      return false;
    }
    const entry = (
      sessionLocator.entry ||
      query.entry ||
      "single_kf_tools"
    ).trim();
    const openKFID = (sessionLocator.open_kfid || query.open_kfid || "").trim();
    const externalUserID = (
      sessionLocator.external_userid ||
      query.external_userid ||
      ""
    ).trim();
    if (!externalUserID) {
      setBootstrap(null);
      setRPABootstrap(null);
      setIsLoading(false);
      if (!options?.preserveNotice) {
        setNotice(
          "暂时无法识别当前客户，请确认已从企业微信客户会话进入工具栏，或稍后重试。",
        );
      }
      return false;
    }
    if (!options?.silent) {
      setIsLoading(true);
    }
    const applyKey = [entry, openKFID, externalUserID].join("\u001f");
    bootstrapApplyKeyRef.current = applyKey;
    try {
      const fetched = await fetchToolbarBootstrap({
        entry,
        openKFID,
        externalUserID,
        light: options?.light === true,
      });
      if (applyKey !== bootstrapApplyKeyRef.current) {
        return false;
      }
      const nextRPA = fetched.data?.rpa || null;
      if (nextRPA?.automation) {
        setRPAAutomation(nextRPA.automation || null);
      }
      if ((nextRPA?.mode || "").trim() === "rpa" && nextRPA?.enabled) {
        const realtimeRPA = await getKFToolbarRPABootstrap({
          run_id: nextRPA?.run?.run_id || "",
          open_kfid: openKFID,
          external_userid: externalUserID,
        }).catch(() => null);
        setRPABootstrap(realtimeRPA || nextRPA);
        setBootstrap(null);
        setNotice("");
        return true;
      }
      setRPABootstrap(null);
      const data = fetched.data;
      if (!data) {
        return false;
      }
      const nextSessionKey = buildToolbarSessionKey({
        open_kfid: data?.open_kfid,
        external_userid: data?.external_userid,
        selection_required: data?.selection?.required,
      });
      const sessionChanged = nextSessionKey !== bootstrapSessionKeyRef.current;
      bootstrapSessionKeyRef.current = nextSessionKey;
      let mergedSummary: KFToolbarBootstrap["summary"] | undefined =
        data?.summary;
      setBootstrap((prev) => {
        if (!data) return null;
        mergedSummary =
          !sessionChanged && prev?.summary
            ? mergeToolbarSummary(prev.summary, data.summary)
            : data.summary;
        return {
          ...data,
          header:
            options?.light && prev?.header
              ? mergeToolbarHeader(prev.header, data.header)
              : data.header,
          summary: mergedSummary,
          suggestions:
            !sessionChanged && prev?.suggestions
              ? mergeToolbarSuggestionBatch(prev.suggestions, data.suggestions)
              : data.suggestions,
          conversation:
            options?.preserveConversation && prev?.conversation
              ? prev.conversation
              : data.conversation,
        };
      });
      setUpgradeNote(
        (
          mergedSummary?.customer_goal ||
          mergedSummary?.customer_intent ||
          mergedSummary?.text ||
          ""
        ).trim(),
      );
      if (!options?.preserveNotice) {
        setNotice("");
      }
      if (!options?.silent) {
        clearSuggestionNotice();
        clearConversationNotice();
      }
      if (data?.selection?.required) {
        setIsLoadingSuggestions(false);
        setBootstrap((prev) =>
          prev
            ? {
                ...prev,
                suggestions: { batch_id: "", items: [] },
              }
            : prev,
        );
        return true;
      }
      return true;
    } catch (error) {
      if (!options?.silent) {
        setBootstrap(null);
        setNotice(sanitizeToolbarNotice(error));
      }
      return false;
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isResolvingContext) return;
    void loadBootstrap();
  }, [
    isResolvingContext,
    sessionLocator.entry,
    sessionLocator.external_userid,
    sessionLocator.open_kfid,
  ]);

  const header = bootstrap?.header;
  const summary = bootstrap?.summary;
  const selectionState = bootstrap?.selection;
  const realtimeSessionKey = buildToolbarSessionKey({
    open_kfid:
      bootstrap?.open_kfid || sessionLocator.open_kfid || query.open_kfid,
    external_userid:
      bootstrap?.external_userid ||
      sessionLocator.external_userid ||
      query.external_userid,
    selection_required: bootstrap?.selection?.required,
  });

  useEffect(() => {
    realtimeCursorRef.current = 0;
    realtimeEnvelopeRef.current = null;
  }, [realtimeSessionKey]);

  useEffect(() => {
    if (isRPARealtimePanelActive) {
      if (bootstrapProbeTimerRef.current !== null) {
        window.clearTimeout(bootstrapProbeTimerRef.current);
        bootstrapProbeTimerRef.current = null;
      }
      return;
    }
    const suggestionStatus = normalizeToolbarSuggestionStatus(
      bootstrap?.suggestions?.status,
    );
    const analysisStatus = normalizeToolbarSummaryStatus(
      bootstrap?.summary?.status,
    );
    if (bootstrapProbeTimerRef.current !== null) {
      window.clearTimeout(bootstrapProbeTimerRef.current);
      bootstrapProbeTimerRef.current = null;
    }
    if (selectionState?.required) return;
    const delays: number[] = [];
    if (
      bootstrap?.capabilities?.auto_refresh_suggestions &&
      (suggestionStatus === "queued" || suggestionStatus === "running")
    ) {
      delays.push(suggestionStatus === "queued" ? 900 : 1200);
    }
    if (
      bootstrap?.capabilities?.auto_refresh_analysis &&
      (analysisStatus === "queued" || analysisStatus === "running")
    ) {
      delays.push(analysisStatus === "queued" ? 900 : 1200);
    }
    if (delays.length === 0) return;
    bootstrapProbeTimerRef.current = window.setTimeout(() => {
      bootstrapProbeTimerRef.current = null;
      void loadBootstrap({
        preserveNotice: true,
        silent: true,
        preserveConversation: true,
        light: true,
      });
    }, Math.min(...delays));
    return () => {
      if (bootstrapProbeTimerRef.current !== null) {
        window.clearTimeout(bootstrapProbeTimerRef.current);
        bootstrapProbeTimerRef.current = null;
      }
    };
  }, [
    bootstrap?.capabilities?.auto_refresh_analysis,
    bootstrap?.capabilities?.auto_refresh_suggestions,
    bootstrap?.summary?.status,
    bootstrap?.suggestions?.status,
    isRPARealtimePanelActive,
    selectionState?.required,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isRPARealtimePanelActive) {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      return;
    }
    if (bootstrap?.selection?.required) return;
    const openKFID = (
      bootstrap?.open_kfid ||
      sessionLocator.open_kfid ||
      query.open_kfid ||
      ""
    ).trim();
    const externalUserID = (
      bootstrap?.external_userid ||
      sessionLocator.external_userid ||
      query.external_userid ||
      ""
    ).trim();
    if (!openKFID || !externalUserID) return;

    let stopped = false;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const queueRefresh = (options?: { preserveConversation?: boolean }) => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void loadBootstrap({
          preserveNotice: true,
          silent: true,
          preserveConversation: options?.preserveConversation !== false,
          light: true,
        });
      }, 180);
    };

    const handleMessage = (payload: CommandCenterRealtimeEnvelope) => {
      const signature = buildRealtimeEnvelopeSignature(
        payload,
        openKFID,
        externalUserID,
      );
      if (signature) {
        const now = Date.now();
        if (
          realtimeEnvelopeRef.current?.signature === signature &&
          now - realtimeEnvelopeRef.current.at < 1500
        ) {
          return;
        }
        realtimeEnvelopeRef.current = { signature, at: now };
      }
      realtimeCursorRef.current = Math.max(
        realtimeCursorRef.current,
        Number(payload.latest_cursor || 0),
      );
      if (!shouldRefreshToolbarSession(payload, openKFID, externalUserID))
        return;
      const eventTypes = matchingToolbarEventTypes(
        payload,
        openKFID,
        externalUserID,
      );
      const hasAnalysisReadyEvent = eventTypes.some(
        (eventType) =>
          eventType === "chat.session_analysis.updated" ||
          eventType === "chat.session_analysis.state_changed",
      );
      const shouldRefreshConversation = eventTypes.some((eventType) =>
        eventType.startsWith("chat.message."),
      );
      if (
        bootstrap?.capabilities?.auto_refresh_suggestions &&
        shouldRefreshToolbarSuggestions(payload, openKFID, externalUserID)
      ) {
        const now = new Date().toISOString();
        setBootstrap((prev) =>
          prev
            ? {
                ...prev,
                summary: prev.summary
                  ? {
                      ...prev.summary,
                      status: "queued",
                    }
                  : prev.summary,
                suggestions: {
                  batch_id: "",
                  items: [],
                  status: "queued",
                  failure_message: "",
                  updated_at: now,
                  generated_at: prev.suggestions?.generated_at || "",
                },
              }
            : prev,
        );
      }
      if (
        bootstrap?.capabilities?.auto_refresh_analysis &&
        shouldRefreshToolbarAnalysis(payload, openKFID, externalUserID)
      ) {
        const nextStatus = nextToolbarAnalysisRealtimeStatus(
          payload,
          openKFID,
          externalUserID,
        );
        const now = new Date().toISOString();
        setBootstrap((prev) =>
          prev && nextStatus
            ? {
                ...prev,
                summary: prev.summary
                  ? {
                      ...prev.summary,
                      status: nextStatus,
                      updated_at: now,
                    }
                  : prev.summary,
              }
            : prev,
        );
      }
      if (hasAnalysisReadyEvent || shouldRefreshToolbarImmediately(eventTypes)) {
        queueRefresh({ preserveConversation: !shouldRefreshConversation });
      }
    };

    const connect = () => {
      if (stopped) return;
      socket = openRealtimeUpdatesSocket({
        open_kfid: openKFID,
        since_cursor: realtimeCursorRef.current,
        onMessage: handleMessage,
        onClose: () => {
          if (stopped) return;
          reconnectTimer = window.setTimeout(connect, 1200);
        },
      });
    };

    connect();
    return () => {
      stopped = true;
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING)
      ) {
        socket.close();
      }
    };
  }, [
    bootstrap?.capabilities?.auto_refresh_analysis,
    bootstrap?.external_userid,
    bootstrap?.open_kfid,
    bootstrap?.selection?.required,
    isRPARealtimePanelActive,
    query.external_userid,
    query.open_kfid,
    sessionLocator.external_userid,
    sessionLocator.open_kfid,
  ]);

  useEffect(() => {
    const nextSteps: Record<string, number> = {};
    const items = bootstrap?.suggestions?.items || [];
    items.forEach((item, idx) => {
      const normalized = normalizeSuggestion(item, idx);
      nextSteps[normalized.id] = 0;
    });
    setThreadSteps(nextSteps);
  }, [bootstrap?.suggestions?.batch_id]);

  const suggestions = useMemo(() => {
    return (bootstrap?.suggestions?.items || []).map((item, idx) =>
      normalizeSuggestion(item, idx),
    );
  }, [bootstrap?.suggestions?.items]);

  const summaryStatus = normalizeToolbarSummaryStatus(summary?.status);
  const suggestionStatus = normalizeToolbarSuggestionStatus(
    bootstrap?.suggestions?.status,
  );
  const summaryIsAnalyzing =
    summaryStatus === "queued" ||
    summaryStatus === "running" ||
    summaryStatus === "pending";
  const suggestionIsAnalyzing =
    suggestionStatus === "queued" || suggestionStatus === "running";
  const summaryBlockingIssues = compactToolbarFacts(
    summary?.blocking_issues,
    3,
  );
  const summaryDecisionSignals = compactToolbarFacts(
    summary?.decision_signals,
    3,
  );
  const summaryNextBestActions = compactToolbarFacts(
    summary?.next_best_actions,
    3,
  );
  const summaryProfileTags = compactToolbarFacts(summary?.profile_tags, 3);
  const summaryStatusCopy = summarizeToolbarStatusCopy({
    sessionStatusID: header?.session_status_id,
    summaryStatus,
  });
  const analysisPanelVisible = Boolean(
    bootstrap?.capabilities?.show_analysis_panel,
  );
  const suggestionPanelVisible = Boolean(
    bootstrap?.capabilities?.show_suggestion_panel,
  );
  const chatPanelVisible = Boolean(bootstrap?.capabilities?.show_chat_panel);
  const conversationMessages = bootstrap?.conversation?.messages || [];
  const conversationRefreshedAt = formatToolbarMessageTime(
    bootstrap?.conversation?.refreshed_at,
  );
  const summaryGeneratedAt = formatToolbarMessageTime(summary?.generated_at);
  const suggestionGeneratedAt = formatToolbarMessageTime(
    bootstrap?.suggestions?.generated_at,
  );
  const sampleOpenDataMessage = conversationMessages.find((message) =>
    Boolean((message?.sender_display_userid || "").trim()),
  );
  const sampleOpenDataUserID = (
    sampleOpenDataMessage?.sender_display_userid || ""
  ).trim();
  const sampleOpenDataFallback = (
    sampleOpenDataMessage?.sender_display_fallback ||
    sampleOpenDataMessage?.sender_userid ||
    ""
  ).trim();
  const sessionStatusText = toolbarSessionStatusLabel(
    header?.session_status_code,
    header?.session_status_id,
  );
  const contactDisplayName = (
    header?.contact_name ||
    bootstrap?.external_userid ||
    sessionLocator.external_userid ||
    query.external_userid ||
    "未识别客户"
  ).trim();
  const currentAgentLabel = (
    channelDisplayMap[
      (
        bootstrap?.open_kfid ||
        sessionLocator.open_kfid ||
        query.open_kfid ||
        ""
      ).trim()
    ] ||
    bootstrap?.open_kfid ||
    sessionLocator.open_kfid ||
    query.open_kfid ||
    "未指定"
  ).trim();
  const summaryPrimaryIntent = (
    summary?.customer_intent ||
    summary?.customer_goal ||
    summary?.text ||
    ""
  ).trim();
  const suggestedActionText = (
    summaryNextBestActions[0] ||
    summary?.recommended_offer ||
    suggestions[0]?.reason ||
    ""
  ).trim();
  const humanOnlyPrompt =
    !selectionState?.required &&
    !suggestionPanelVisible &&
    sessionStatusText
      ? `当前为${sessionStatusText}，仅在人工接待状态下显示建议回复。`
      : "仅在人工接待状态下显示建议回复。";
  const hasStableToolbarContext = Boolean(
    (bootstrap?.open_kfid || "").trim() &&
    (bootstrap?.external_userid || "").trim(),
  );
  const canOpenDebugView =
    !isResolvingContext &&
    !isLoading &&
    !isLoadingToolbarDebugConfig &&
    isToolbarDebugEnabled &&
    hasStableToolbarContext &&
    !selectionState?.required;
  const boundRPAClientID = (
    rpaOperatorBinding?.binding?.rpa_client_id ||
    rpaAutomation?.bound_rpa_client_id ||
    ""
  ).trim();
  const hasBoundRPAClient = Boolean(
    (rpaOperatorBinding?.bound || rpaAutomation?.bound) && boundRPAClientID,
  );
  const automationCanEnter = Boolean(
    rpaBootstrap?.automation?.can_enter_auto_mode ||
    rpaAutomation?.can_enter_auto_mode ||
    hasBoundRPAClient,
  );
  useEffect(() => {
    if (!chatPanelVisible || !isChatHistoryOpen) return;
    const container = conversationScrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [
    chatPanelVisible,
    isChatHistoryOpen,
    bootstrap?.conversation?.refreshed_at,
    bootstrap?.open_kfid,
    bootstrap?.external_userid,
  ]);

  useEffect(() => {
    if (suggestionNoticeTimerRef.current !== null) {
      window.clearTimeout(suggestionNoticeTimerRef.current);
      suggestionNoticeTimerRef.current = null;
    }
    if (conversationNoticeTimerRef.current !== null) {
      window.clearTimeout(conversationNoticeTimerRef.current);
      conversationNoticeTimerRef.current = null;
    }
    setSuggestionNotice("");
    setConversationNotice("");
    setIsChatHistoryOpen(false);
  }, [bootstrap?.open_kfid, bootstrap?.external_userid]);

  useEffect(() => {
    if (selectionState?.required && viewMode === "debug") {
      setViewMode("main");
    }
  }, [selectionState?.required, viewMode]);

  const safeFeedback = async (input: {
    reply_id?: string;
    action?: string;
    step?: number;
  }) => {
    try {
      await sendKFToolbarReplyFeedback({
        open_kfid: bootstrap?.open_kfid || query.open_kfid,
        external_userid:
          bootstrap?.external_userid ||
          sessionLocator.external_userid ||
          query.external_userid,
        reply_id: input.reply_id,
        action: input.action,
        step: input.step,
      });
    } catch {
      // best effort only
    }
  };

  const handleFillSuggestion = async (item: NormalizedSuggestion) => {
    const currentStep = Math.min(
      threadSteps[item.id] || 0,
      item.sentences.length - 1,
    );
    const text = item.sentences[currentStep] || item.text;
    try {
      setIsSubmitting(true);
      await sendTextToCurrentSession(text, {
        external_userid:
          bootstrap?.external_userid ||
          sessionLocator.external_userid ||
          query.external_userid,
      });
      void safeFeedback({
        reply_id: item.id,
        action: "fill",
        step: currentStep + 1,
      });
      if (currentStep + 1 < item.sentences.length) {
        setThreadSteps((prev) => ({ ...prev, [item.id]: currentStep + 1 }));
        pushSuggestionNotice(
          `已填入第 ${currentStep + 1} 句，可继续发送下一句`,
        );
      } else {
        setThreadSteps((prev) => ({
          ...prev,
          [item.id]: item.sentences.length,
        }));
        pushSuggestionNotice(
          item.hasFollowups
            ? "已完成本组分步回复填入"
            : "已通过企业微信客户端填入当前会话",
        );
      }
    } catch (error) {
      const message = toJSSDKErrorMessage(error);
      try {
        await navigator.clipboard.writeText(text);
        pushSuggestionNotice(`${message}，已降级为复制，请手动粘贴发送`);
      } catch {
        pushSuggestionNotice(message || sanitizeToolbarNotice(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerate = async () => {
    if (
      !bootstrap ||
      selectionState?.required ||
      !bootstrap.capabilities?.regenerate ||
      !(bootstrap.open_kfid || sessionLocator.open_kfid || query.open_kfid)
    )
      return;
    await loadSuggestions({
      entry: bootstrap.entry || sessionLocator.entry || query.entry,
      open_kfid:
        bootstrap.open_kfid || sessionLocator.open_kfid || query.open_kfid,
      external_userid:
        bootstrap.external_userid ||
        sessionLocator.external_userid ||
        query.external_userid,
      seed_reply_id: suggestions[0]?.id || "",
      reason: "manual_refresh",
      manual: true,
    });
    void safeFeedback({
      reply_id: suggestions[0]?.id,
      action: "regenerate",
      step: 0,
    });
  };

  const handleUpgrade = async () => {
    if (selectionState?.required) {
      setNotice("请先选择当前要辅助的微信客服会话");
      return;
    }
    try {
      setIsSubmitting(true);
      const result = await executeContactSidebarCommand({
        command: "kf_upgrade_to_contact",
        external_userid:
          bootstrap?.external_userid ||
          sessionLocator.external_userid ||
          query.external_userid,
        payload: {
          assigned_userid: upgradeOwner,
          intent: upgradeIntent,
          note: upgradeNote,
          contact_name: header?.contact_name,
          open_kfid:
            bootstrap?.open_kfid || sessionLocator.open_kfid || query.open_kfid,
        },
      });
      if (result?.success) {
        setIsUpgraded(true);
      }
      setNotice((result?.message || "升级命令已提交").trim());
      setIsUpgradeModalOpen(false);
      await loadBootstrap({ preserveNotice: true });
    } catch (error) {
      setNotice(sanitizeToolbarNotice(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshConversation = async () => {
    try {
      setIsRefreshingConversation(true);
      const ok = await loadBootstrap({
        preserveNotice: true,
        silent: true,
        preserveConversation: false,
      });
      if (ok) {
        pushConversationNotice("已刷新聊天记录");
      } else {
        pushConversationNotice("聊天记录刷新失败，请稍后再试");
      }
    } catch {
      pushConversationNotice("聊天记录刷新失败，请稍后再试");
    } finally {
      setIsRefreshingConversation(false);
    }
  };

  const handleToggleChatHistory = () => {
    setIsChatHistoryOpen((open) => {
      const next = !open;
      if (next && conversationMessages.length === 0 && !isRefreshingConversation) {
        window.setTimeout(() => {
          void handleRefreshConversation();
        }, 0);
      }
      return next;
    });
  };

  const handleSelectToolbarSession = async (input: {
    open_kfid?: string;
    external_userid?: string;
    channel_label?: string;
  }) => {
    const openKFID = (input.open_kfid || "").trim();
    const externalUserID = (input.external_userid || "").trim();
    const channelLabel = (input.channel_label || openKFID || "当前会话").trim();
    if (!openKFID || !externalUserID) {
      setNotice("缺少会话标识，暂时无法进入该微信客服会话");
      return;
    }
    const nextKey = `${openKFID}\u001f${externalUserID}`;
    try {
      setSelectingSessionKey(nextKey);
      setNotice(`正在进入 ${channelLabel}...`);
      writeManualSelectionHandoff({
        open_kfid: openKFID,
        external_userid: externalUserID,
      });
      setSessionLocator((prev) => ({
        ...prev,
        open_kfid: openKFID,
        external_userid: externalUserID,
      }));
      await openWecomKfConversation({
        open_kfid: openKFID,
        external_userid: externalUserID,
      });
      await sleep(700);
      const runtime = await resolveSidebarRuntimeContext().catch(() => null);
      const runtimeExternalUserID = (
        runtime?.external_userid || externalUserID
      ).trim();
      setSessionLocator((prev) => ({
        ...prev,
        entry: (runtime?.entry || prev.entry || query.entry).trim(),
        open_kfid: openKFID,
        external_userid: runtimeExternalUserID,
      }));
      setNotice(`已进入 ${channelLabel}，正在载入当前会话...`);
    } catch (error) {
      clearManualSelectionHandoff();
      setNotice(toJSSDKErrorMessage(error));
    } finally {
      setSelectingSessionKey("");
    }
  };

  const handleSaveRPAClientBinding = async () => {
    const nextClientID = (rpaClientIDDraft || "").trim();
    if (!nextClientID) {
      setRPABindingNotice("请先填入 rpa_client_id");
      return;
    }
    try {
      setIsSavingRPABinding(true);
      setRPABindingNotice("");
      const snapshot = await saveKFToolbarRPAOperatorBinding(nextClientID);
      setRPAOperatorBinding(snapshot);
      setRPAAutomation(snapshot?.automation || null);
      setRPAClientIDDraft(
        (snapshot?.binding?.rpa_client_id || nextClientID).trim(),
      );
      setRPABindingNotice("已保存 RPA 识别码绑定，后续自动模式会直接复用");
      if (pendingEnableAutoMode) {
        setIsRPABindingModalOpen(false);
        await handleAutomationModeChange(true, { skipBindingCheck: true });
      }
    } catch (error) {
      setRPABindingNotice(
        normalizeErrorMessage(error) || "保存 RPA 识别码绑定失败，请稍后再试",
      );
    } finally {
      setIsSavingRPABinding(false);
    }
  };

  const handleAutomationModeChange = async (
    enabled: boolean,
    options?: { skipBindingCheck?: boolean },
  ) => {
    if (enabled && !options?.skipBindingCheck && !automationCanEnter) {
      setPendingEnableAutoMode(true);
      setRPABindingNotice("请先绑定 rpa_client_id，再开启自动模式");
      setIsRPABindingModalOpen(true);
      return;
    }
    const previousAutomation = rpaAutomation;
    const requestOpenKFID =
      sessionLocator.open_kfid || bootstrap?.open_kfid || query.open_kfid || "";
    const requestExternalUserID =
      sessionLocator.external_userid ||
      bootstrap?.external_userid ||
      query.external_userid ||
      "";
    try {
      setIsUpdatingAutomationMode(true);
      if (enabled) {
        setIsRPAPanelOpen(true);
        setRPAAutomation((prev) => ({
          ...(prev || previousAutomation || {}),
          enabled: true,
          status: "active",
          stop_reason: "",
        }));
      }
      const next = await updateKFToolbarRPAAutomationMode(enabled);
      setRPAAutomation(next);
      if (enabled) {
        const realtimeRPA = await getKFToolbarRPABootstrap({
          open_kfid: requestOpenKFID,
          external_userid: requestExternalUserID,
        }).catch(() => null);
        if (realtimeRPA) {
          setRPABootstrap(realtimeRPA);
          setBootstrap(null);
        }
      }
      if (!enabled) {
        setIsRPAPanelOpen(false);
        setRPABootstrap(null);
      }
      pushToolbarNotice(
        enabled
          ? "已开始自动发送，工具栏会持续守护待发送任务。"
          : "已返回人工处理，自动发送已退出。",
      );
      if (!enabled) {
        await loadBootstrap({
          preserveNotice: true,
          silent: true,
          preserveConversation: true,
          light: true,
          forceDuringRPA: true,
        });
      }
    } catch (error) {
      if (enabled) {
        setRPAAutomation(previousAutomation || null);
      }
      setNotice(
        sanitizeToolbarNotice(error) ||
          (enabled ? "切换自动模式失败" : "切换人工模式失败"),
      );
    } finally {
      setIsUpdatingAutomationMode(false);
      setPendingEnableAutoMode(false);
    }
  };

  if (viewMode === "debug") {
    return (
      <ToolbarDebugView
        onBack={() => setViewMode("main")}
        openKFID={
          bootstrap?.open_kfid || sessionLocator.open_kfid || query.open_kfid
        }
        externalUserID={
          bootstrap?.external_userid ||
          sessionLocator.external_userid ||
          query.external_userid
        }
        sessionCandidates={bootstrap?.selection?.candidates || []}
        sampleOpenDataUserID={sampleOpenDataUserID}
        sampleOpenDataFallback={sampleOpenDataFallback}
      />
    );
  }

  const handleOpenRPAPanel = () => {
    if (!automationEnabled) {
      setRPABootstrap(null);
    }
    setIsRPAPanelOpen(true);
  };

  if (rpaBootstrap || automationEnabled || isRPAPanelOpen) {
    return (
      <ToolbarRPAMode
        runId={
          rpaBootstrap?.run?.run_id ||
          (automationEnabled ? query.rpa_run_id || "" : "")
        }
        initialBootstrap={rpaBootstrap}
        initialAutomationEnabled={automationEnabled}
        allowInactivePanel={isRPAPanelOpen && !automationEnabled}
        currentSessionContext={{
          open_kfid:
            sessionLocator.open_kfid || bootstrap?.open_kfid || query.open_kfid,
          external_userid:
            sessionLocator.external_userid ||
            bootstrap?.external_userid ||
            query.external_userid,
        }}
        channelDisplayMap={channelDisplayMap}
        onAutomationModeChange={handleAutomationModeChange}
        isUpdatingAutomationMode={isUpdatingAutomationMode}
        onExitRPAMode={async () => {
          if (isRPAPanelOpen && !automationEnabled) return;
          setRPABootstrap(null);
          await loadBootstrap({
            preserveNotice: true,
            silent: true,
            preserveConversation: true,
            light: true,
            forceDuringRPA: true,
          });
        }}
      />
    );
  }

  return (
    <div
      className={`${sidebarPageShell} bg-white`}
      style={{ height: "100dvh", minHeight: 0, overflow: "hidden" }}
    >
      <div
        className={`shrink-0 text-white ${
          selectionState?.required ? "bg-[#1E293B] p-5" : "bg-[#0052D9] p-4"
        }`}
      >
        <div
          className={`flex items-center justify-between gap-3 ${
            selectionState?.required ? "mb-2" : "mb-3"
          }`}
        >
          <div className="flex min-w-0 items-center gap-2">
            {selectionState?.required ? (
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-300" />
            ) : (
              <UserRound className="h-5 w-5 shrink-0 text-blue-200" />
            )}
            <h1 className="truncate text-sm font-bold tracking-tight text-white">
              {selectionState?.required
                ? "选择要辅助的业务会话"
                : "客服辅助工作台"}
            </h1>
          </div>
          {!selectionState?.required ? (
            <div className="flex shrink-0 items-center gap-2">
              {canOpenDebugView ? (
                <button
                  type="button"
                  aria-label="打开工具栏调试面板"
                  className="inline-flex h-7 w-7 items-center justify-center rounded bg-white/10 text-white transition-colors hover:bg-white/20"
                  onClick={() => setViewMode("debug")}
                >
                  <Bug className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleOpenRPAPanel}
                className="inline-flex items-center gap-1 rounded bg-white/20 px-2 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-white/30 disabled:opacity-60"
              >
                <ShieldCheck className="h-3 w-3" />
                自动发送面板
              </button>
            </div>
          ) : null}
        </div>
        {selectionState?.required ? (
          <p className="text-[11px] leading-relaxed text-slate-300">
            系统发现当前客户存在多个微信客服会话，请选择本次侧边栏要介入的目标会话。
          </p>
        ) : (
          <div className="flex items-center gap-2 rounded bg-black/10 p-2">
            <span className="shrink-0 text-[11px] uppercase tracking-widest text-white/80">
              当前客服号:
            </span>
            <span className="truncate font-mono text-[11px] font-bold text-white">
              {currentAgentLabel}
            </span>
          </div>
        )}

        {notice ? (
          <div className="mt-3 rounded border border-white/20 bg-white/15 px-3 py-2 text-[12px] leading-5 text-white">
            {notice}
          </div>
        ) : null}
        {rpaBindingNotice && !selectionState?.required ? (
          <div className="mt-3 rounded border border-white/20 bg-white/15 px-3 py-2 text-[12px] leading-5 text-white">
            {rpaBindingNotice}
          </div>
        ) : null}
        {bootstrap?.warnings && bootstrap.warnings.length > 0 ? (
          <div className="mt-3 rounded border border-amber-200/40 bg-amber-400/15 px-3 py-2 text-[12px] leading-5 text-amber-50">
            {bootstrap.warnings.join(" / ")}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <ToolbarSkeleton />
      ) : (
        <div
          className={`${sidebarBody} min-h-0 flex-1 space-y-4 p-4 ${
            selectionState?.required ? "bg-[#F8FAFC]" : "bg-white/50"
          }`}
          style={{ overflowX: "hidden", overflowY: "auto" }}
        >
          {selectionState?.required ? (
            <>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                检测到 {(selectionState.candidates || []).length} 个候选会话
              </div>
              <div className="space-y-3">
                {(selectionState.candidates || []).map((candidate, idx) => {
                  const openKFID = (candidate.open_kfid || "").trim();
                  const externalUserID = (
                    candidate.external_userid ||
                    bootstrap?.external_userid ||
                    sessionLocator.external_userid ||
                    query.external_userid ||
                    ""
                  ).trim();
                  const channelLabel = (
                    channelDisplayMap[openKFID] ||
                    candidate.channel_token ||
                    openKFID ||
                    "未知客服"
                  ).trim();
                  const candidateKey = `${openKFID}\u001f${externalUserID}`;
                  const isSelecting = selectingSessionKey === candidateKey;
                  const contactName = (
                    candidate.contact_name ||
                    header?.contact_name ||
                    "未识别客户"
                  ).trim();
                  return (
                    <button
                      key={`${openKFID}-${externalUserID}-${idx}`}
                      type="button"
                      disabled={!!selectingSessionKey}
                      className="group w-full rounded-xl border border-gray-200 bg-white p-3.5 text-left shadow-sm transition-all hover:border-[#0052D9] hover:shadow-md hover:ring-1 hover:ring-[#0052D9]/20 disabled:opacity-70"
                      onClick={() =>
                        void handleSelectToolbarSession({
                          open_kfid: openKFID,
                          external_userid: externalUserID,
                          channel_label: channelLabel,
                        })
                      }
                    >
                      <div className="mb-2.5 flex items-start justify-between gap-3">
                        <span className="rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 shadow-sm">
                          客服号: {channelLabel}
                        </span>
                        <div className="flex shrink-0 items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                          <Clock className="h-3 w-3" />
                          {formatToolbarSelectionTime(candidate.last_active) ||
                            "时间未知"}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-gray-800">
                        {contactName}
                      </div>
                      {(candidate.last_message || "").trim() ? (
                        <div className="mt-2 truncate text-[11px] font-medium italic text-gray-600">
                          “{candidate.last_message}”
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] font-medium italic text-gray-400">
                          暂无最近消息
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                          状态:{" "}
                          {toolbarSessionStatusLabel(
                            candidate.session_status_code,
                          )}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-bold text-[#0052D9] transition-transform group-hover:translate-x-1">
                          {isSelecting ? "进入中" : "选择进入"}
                          {isSelecting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5" />
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="rounded border border-dashed border-gray-200 bg-white px-3 py-2 text-center text-[10px] font-medium text-gray-400">
                本次选择仅改变当前侧边栏上下文，不会成为永久绑定。
              </div>
            </>
          ) : (
            <>
              <div className="rounded-r border-y border-r border-blue-100 border-l-4 border-l-[#0052D9] bg-white p-4 shadow-sm">
                <div className="mb-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="truncate text-lg font-bold text-gray-800">
                        {contactDisplayName}
                      </div>
                      <span className="shrink-0 rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                        微信客户
                      </span>
                    </div>
                    <div className="mt-1 truncate font-mono text-[10px] text-gray-400">
                      extId:{" "}
                      {bootstrap?.external_userid ||
                        sessionLocator.external_userid ||
                        query.external_userid ||
                        "-"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="relative rounded border border-amber-200 bg-amber-50 px-2 py-1 pr-3 text-[10px] font-bold text-amber-700 shadow-sm">
                      {sessionStatusText}
                      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
                    </span>
                  </div>
                </div>
                {summaryProfileTags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gray-50 pt-3">
                    {summaryProfileTags.map((tag, idx) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 rounded border border-gray-200 bg-gray-100/80 px-2 py-1 text-[10px] font-bold text-gray-600"
                      >
                        {idx === 0 ? <Tags className="h-2.5 w-2.5" /> : null}
                        {toolbarProfileTagLabel(tag)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {analysisPanelVisible ? (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-purple-50/50 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-purple-600" />
                      <span className="truncate text-xs font-bold text-gray-800">
                        AI 会话感知
                      </span>
                    </div>
                    {summaryGeneratedAt ? (
                      <span className="shrink-0 rounded border border-purple-100 bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-purple-500">
                        生成 {summaryGeneratedAt}
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-3.5 p-3.5">
                    <div>
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        核心诉求与意图
                      </div>
                      <div className="text-xs font-medium leading-relaxed text-gray-700">
                        {summaryPrimaryIntent ||
                          (summaryIsAnalyzing
                            ? "正在整理当前会话分析..."
                            : "暂未形成稳定的客户意图判断。")}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md border border-green-100 bg-green-50 p-2.5">
                        <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          积极信号
                        </div>
                        <div className="text-[11px] font-medium leading-5 text-green-800">
                          {summaryDecisionSignals[0] || "等待更多客户信号"}
                        </div>
                      </div>
                      <div className="rounded-md border border-red-100 bg-red-50 p-2.5">
                        <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-red-700">
                          <AlertTriangle className="h-3 w-3" />
                          风险/阻力
                        </div>
                        <div className="text-[11px] font-medium leading-5 text-red-800">
                          {summaryBlockingIssues[0] || "暂未发现明确风险"}
                        </div>
                      </div>
                    </div>
                    {summaryNextBestActions.length > 0 ? (
                      <div className="grid gap-1.5 text-[11px] leading-5 text-gray-600">
                        <div>
                          <span className="font-bold text-gray-700">
                            下一步：
                          </span>
                          {summaryNextBestActions.join("；")}
                        </div>
                      </div>
                    ) : null}
                    {summaryIsAnalyzing ? (
                      <div className="flex items-center gap-2 text-[11px] text-[#0052D9]">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400/70" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#0052D9]" />
                        </span>
                        <span>{summaryStatusCopy.helperText}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {suggestionPanelVisible ? (
                <>
                  <Card className="wecom-toolbar-panel wecom-toolbar-enter overflow-hidden rounded-lg border-[#0052D9]/30 bg-white shadow-md ring-1 ring-[#0052D9]/5">
                    <div className="-mx-3 -mt-3 mb-3 flex items-center justify-between gap-2 border-b border-blue-100 bg-blue-50 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Lightbulb className="h-4 w-4 shrink-0 text-[#0052D9]" />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-[#0052D9]">
                            建议操作：{suggestedActionText || "继续安抚并确认下一步"}
                          </div>
                          {suggestionGeneratedAt ? (
                            <div className="mt-0.5 truncate text-[10px] font-bold text-blue-400">
                              生成 {suggestionGeneratedAt}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 rounded border-blue-200 bg-white px-2 text-[10px] font-bold text-[#0052D9] shadow-sm"
                        disabled={
                          isRegenerating ||
                          isSubmitting ||
                          !bootstrap?.capabilities?.regenerate
                        }
                        onClick={() => void handleRegenerate()}
                      >
                        <RefreshCcw
                          className={`mr-1 h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`}
                        />
                        换一换
                      </Button>
                    </div>

                    {suggestionNotice ? (
                      <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] text-blue-700 transition-all duration-200">
                        {suggestionNotice}
                      </div>
                    ) : null}

                    <div className="space-y-3.5 p-0.5">
                      {suggestionIsAnalyzing ? (
                        <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2">
                          <div className="flex items-center gap-2 text-[11px] text-blue-600">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400/70" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                            </span>
                            <span>
                              {suggestionStatus === "queued"
                                ? "AI 已收到新的客户消息，正在准备回复建议"
                                : "AI 正在重新组织本轮建议回复"}
                            </span>
                          </div>
                        </div>
                      ) : null}
                      {suggestions.length === 0 ? (
                        <div className="rounded border border-dashed border-gray-300 bg-[#F9FAFB] px-4 py-8 text-center text-[12px] text-gray-500">
                          {isLoadingSuggestions || suggestionIsAnalyzing ? (
                            <div className="space-y-3">
                              <div className="mx-auto h-2.5 w-28 animate-pulse rounded-full bg-blue-100" />
                              <div className="mx-auto h-2.5 w-11/12 animate-pulse rounded-full bg-slate-200" />
                              <div className="mx-auto h-2.5 w-4/5 animate-pulse rounded-full bg-slate-200" />
                            </div>
                          ) : bootstrap?.suggestions?.failure_message ? (
                            bootstrap.suggestions.failure_message.trim()
                          ) : (
                            "暂未生成建议回复，可点击换一批重试"
                          )}
                        </div>
                      ) : (
                        suggestions.map((item, idx) => {
                          const currentStep = Math.min(
                            threadSteps[item.id] || 0,
                            item.sentences.length,
                          );
                          const isFinished =
                            currentStep >= item.sentences.length;
                          const primaryLabel = isFinished
                            ? "再次填入"
                            : !item.hasFollowups
                              ? "填入聊天框"
                              : currentStep === 0
                                ? "填入首句"
                                : item.nextStepLabel;

                          return (
                            <div
                              key={item.id}
                              className={`wecom-toolbar-enter ${
                                idx > 0
                                  ? "border-t border-gray-100 pt-3.5"
                                  : ""
                              } ${suggestionIsAnalyzing ? "opacity-75" : ""}`}
                              style={{ animationDelay: `${idx * 70}ms` }}
                            >
                              <div className="mb-2 flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <Badge
                                    variant={
                                      item.hasFollowups
                                        ? "default"
                                        : "secondary"
                                    }
                                    className="shrink-0 px-2 py-0.5 text-[10px]"
                                  >
                                    {item.hasFollowups
                                      ? "分步发送"
                                      : "直接回复"}
                                  </Badge>
                                  <span className="text-[10px] text-slate-400">
                                    已填{" "}
                                    {Math.min(
                                      currentStep,
                                      item.sentences.length,
                                    )}
                                    /{item.sentences.length}
                                  </span>
                                </div>
                              </div>

                              <div className="mb-3 space-y-2 rounded border border-gray-200 bg-white p-3 text-xs font-medium leading-relaxed text-gray-800 shadow-inner">
                                {item.sentences.map((sentence, sentenceIdx) => {
                                  const isSent = sentenceIdx < currentStep;
                                  const isCurrent =
                                    !isFinished && sentenceIdx === currentStep;
                                  return (
                                    <div
                                      key={`${item.id}-sentence-${sentenceIdx}`}
                                      className="flex items-start gap-2"
                                    >
                                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                                        {isSent ? (
                                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                        ) : (
                                          <span
                                            className={`block h-1.5 w-1.5 rounded-full ${
                                              isCurrent
                                                ? "bg-blue-500"
                                                : "bg-slate-300"
                                            }`}
                                          />
                                        )}
                                      </div>
                                      <div
                                        className={`min-w-0 transition-colors duration-200 ${
                                          isSent
                                            ? "text-slate-500"
                                            : isCurrent
                                              ? "font-medium text-slate-800"
                                              : "text-slate-400"
                                        }`}
                                      >
                                        {sentence}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {item.reason ? (
                                <div className="mb-3 text-[11px] font-medium leading-5 text-gray-500">
                                  {item.reason}
                                </div>
                              ) : null}

                              <div>
                                <Button
                                  type="button"
                                  size="sm"
                                  className={`h-9 w-full rounded bg-[#0052D9] px-3 text-xs font-bold text-white shadow-sm hover:bg-blue-700 ${
                                    isFinished
                                      ? "bg-white text-[#0052D9] ring-1 ring-blue-200 hover:bg-blue-50"
                                      : ""
                                  }`}
                                  disabled={
                                    isSubmitting ||
                                    !bootstrap?.capabilities?.fill_reply
                                  }
                                  onClick={() =>
                                    void handleFillSuggestion(item)
                                  }
                                >
                                  <Send className="mr-1.5 h-3.5 w-3.5" />
                                  {primaryLabel}
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </Card>
                </>
              ) : (
                <Card className="wecom-toolbar-panel wecom-toolbar-enter rounded-2xl border-slate-200 bg-white/95">
                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50/90 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <Lightbulb className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className={sidebarSectionLabel}>AI 建议回复</div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {humanOnlyPrompt}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {chatPanelVisible ? (
                <Card className="wecom-toolbar-panel overflow-hidden rounded-lg border-gray-200 bg-white shadow-sm">
                  <button
                    type="button"
                    className="-mx-3 -my-3 flex w-[calc(100%+24px)] items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-3 py-2.5 text-left transition-colors hover:bg-blue-50/60"
                    onClick={handleToggleChatHistory}
                    aria-expanded={isChatHistoryOpen}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-[#0052D9]" />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-gray-800">
                          历史聊天记录
                        </div>
                        <div className="mt-0.5 truncate text-[10px] font-medium text-gray-400">
                          {conversationMessages.length > 0
                            ? `最近 ${conversationMessages.length} 条`
                            : "默认折叠，展开后查看聊天"}
                          {conversationRefreshedAt
                            ? ` · ${conversationRefreshedAt}`
                            : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-[#0052D9]">
                      <span>{isChatHistoryOpen ? "收起" : "展开"}</span>
                      <ArrowRight
                        className={`h-3.5 w-3.5 transition-transform ${
                          isChatHistoryOpen ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {isChatHistoryOpen ? (
                    <div className="pt-6">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          最近聊天记录
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 rounded border-gray-200 bg-white px-2 text-[10px] font-bold text-gray-600 shadow-sm"
                          disabled={isRefreshingConversation}
                          onClick={() => void handleRefreshConversation()}
                        >
                          <RefreshCcw
                            className={`mr-1 h-3.5 w-3.5 ${isRefreshingConversation ? "animate-spin" : ""}`}
                          />
                          刷新
                        </Button>
                      </div>

                      {conversationNotice ? (
                        <div className="mb-3 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] text-blue-700 transition-all duration-200">
                          {conversationNotice}
                        </div>
                      ) : null}

                      {conversationMessages.length === 0 ? (
                        <div className="rounded border border-dashed border-gray-300 bg-[#F9FAFB] px-4 py-8 text-center text-[12px] text-gray-500">
                          当前会话暂时没有可展示的聊天记录。
                        </div>
                      ) : (
                        <div
                          ref={conversationScrollRef}
                          className="max-h-[320px] space-y-2 overflow-y-auto pr-1"
                        >
                          {conversationMessages.map((message, idx) => {
                            const role = resolveToolbarMessageRole(message);
                            const timeText = formatToolbarMessageTime(
                              message?.timestamp,
                            );
                            const content = (message?.content || "").trim();
                            const staffDisplayUserID = (
                              message?.sender_display_userid || ""
                            ).trim();
                            const staffFallback = (
                              message?.sender_display_fallback ||
                              message?.sender_userid ||
                              "人工客服"
                            ).trim();
                            const roleClass =
                              role === "assistant"
                                ? "border-l-violet-500 bg-violet-50/45"
                                : role === "staff"
                                  ? "border-l-[#0052D9] bg-blue-50/50"
                                  : role === "system"
                                    ? "border-l-gray-300 bg-gray-50"
                                    : "border-l-emerald-500 bg-emerald-50/45";

                            return (
                              <div
                                key={`${message?.id || "msg"}-${idx}`}
                                className={`rounded-md border border-gray-200 border-l-4 px-3 py-2 shadow-sm ${roleClass}`}
                              >
                                <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
                                  <div className="min-w-0 truncate text-[11px] font-bold text-gray-700">
                                    {role === "assistant" ? (
                                      <span className="inline-flex items-center gap-1 text-violet-700">
                                        <Bot className="h-3 w-3" />
                                        AI 回复
                                      </span>
                                    ) : role === "staff" ? (
                                      staffDisplayUserID ? (
                                        <WecomOpenDataName
                                          userid={staffDisplayUserID}
                                          corpId=""
                                          fallback={staffFallback}
                                          className="font-bold text-blue-700"
                                        />
                                      ) : (
                                        <span className="text-blue-700">
                                          {staffFallback}
                                        </span>
                                      )
                                    ) : role === "system" ? (
                                      <span className="text-gray-500">
                                        系统事件
                                      </span>
                                    ) : (
                                      <span className="text-emerald-700">
                                        客户
                                      </span>
                                    )}
                                  </div>
                                  {timeText ? (
                                    <span className="shrink-0 font-mono text-[10px] text-gray-400">
                                      {timeText}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="wecom-toolbar-message-content text-[12px] font-medium leading-5 text-gray-800">
                                  {content || "暂不支持展示该消息内容"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </Card>
              ) : null}
            </>
          )}
        </div>
      )}

      <Dialog
        isOpen={isRPABindingModalOpen}
        onClose={() => {
          setIsRPABindingModalOpen(false);
          setPendingEnableAutoMode(false);
        }}
        title="绑定 RPA 识别码"
        className="max-w-[360px]"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsRPABindingModalOpen(false);
                setPendingEnableAutoMode(false);
              }}
            >
              取消
            </Button>
            <Button
              className="bg-slate-900 text-white hover:bg-slate-800"
              disabled={isSavingRPABinding}
              onClick={() => void handleSaveRPAClientBinding()}
            >
              {isSavingRPABinding ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              保存并开始
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] leading-5 text-blue-700">
            开启自动模式前，需要先为当前工具栏成员绑定一个固定的{" "}
            <code>rpa_client_id</code>。 RPA
            客户端登录母语AI后可直接复制该识别码。
          </div>
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-slate-700">
              rpa_client_id
            </label>
            <Input
              value={rpaClientIDDraft}
              onChange={(event) => setRPAClientIDDraft(event.target.value)}
              placeholder="请粘贴 RPA 客户端显示的 rpa_client_id"
              className="h-10 rounded-2xl border-slate-200 bg-white text-sm"
            />
          </div>
          {rpaBindingNotice ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-600">
              {rpaBindingNotice}
            </div>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title="升级为客户联系"
        className="max-w-[300px]"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsUpgradeModalOpen(false)}
            >
              取消
            </Button>
            <Button
              className="bg-blue-600"
              disabled={isSubmitting}
              onClick={() => void handleUpgrade()}
            >
              确认升级
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">分配给</label>
            <select
              value={upgradeOwner}
              onChange={(event) => setUpgradeOwner(event.target.value)}
              className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>销售 A</option>
              <option>销售 B</option>
              <option>销售 C</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              客户意向评级
            </label>
            <div className="flex gap-2">
              {["高", "中", "低"].map((item) => (
                <label key={item} className="flex items-center gap-1 text-sm">
                  <input
                    checked={upgradeIntent === item}
                    onChange={() => setUpgradeIntent(item)}
                    type="radio"
                    name="intent"
                  />{" "}
                  {item}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              升级备注
            </label>
            <Textarea
              className="min-h-[80px] text-sm"
              value={upgradeNote}
              onChange={(event) => setUpgradeNote(event.target.value)}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
