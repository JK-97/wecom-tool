/**
 * 企业微信系统 notice 呈现辅助。
 *
 * 边界说明：
 * 1. 这里只处理 notice 级消息，不处理普通聊天气泡。
 * 2. sync_gap_notice 的状态语义来自后端 message.status=open/resolved，
 *    前端不再通过文案猜“授权是否恢复”。
 * 3. 主会话页与侧边栏共用这套归一规则，避免两边各写一份 if/else 后续漂移。
 */

export type WecomNoticeKind =
  | "sync_gap_notice"
  | "wecom_event_notice"
  | "wecom_recall_notice"
  | "";

export type WecomNoticeTone =
  | "warning"
  | "success"
  | "neutral"
  | "subtle"
  | "default";

export type WecomNoticeInput = {
  type?: string;
  status?: string;
  content?: string;
  notice_kind?: string;
  notice_status?: string;
};

export type WecomNoticePresentation = {
  kind: WecomNoticeKind;
  status: string;
  tone: WecomNoticeTone;
  content: string;
};

export type WecomNoticePalette = {
  containerClassName: string;
  contentClassName: string;
  timeClassName: string;
};

/**
 * 企业微信 notice 视觉规范。
 *
 * 这里故意把 3 类 notice 的正式语义写死成显式常量，避免后续再把
 * “企微原生事件 notice” 和 “sync gap 系统提示” 混成同一套灰色/黄色规则。
 */
export const WECOM_NOTICE_STATUS = {
  syncGapOpen: "open",
  syncGapResolved: "resolved",
  syncGapUpdated: "updated",
} as const;

export const WECOM_NOTICE_TONE = {
  syncGapOpen: "warning",
  syncGapResolved: "success",
  syncGapUpdated: "neutral",
  wecomEvent: "subtle",
  wecomRecall: "neutral",
  fallback: "default",
} as const satisfies Record<string, WecomNoticeTone>;

export const WECOM_NOTICE_PALETTE = {
  syncGapOpen: {
    containerClassName:
      "border-amber-200 bg-amber-50/70 text-amber-950 shadow-amber-100/50",
    contentClassName: "text-amber-950",
    timeClassName: "text-amber-600/80",
  },
  syncGapResolved: {
    containerClassName:
      "border-emerald-200 bg-emerald-50/85 text-emerald-950 shadow-emerald-100/60",
    contentClassName: "text-emerald-950",
    timeClassName: "text-emerald-700/90",
  },
  syncGapUpdated: {
    containerClassName:
      "border-slate-200 bg-slate-50/80 text-slate-700 shadow-slate-100/50",
    contentClassName: "text-slate-700",
    timeClassName: "text-slate-400",
  },
  wecomRecall: {
    containerClassName:
      "border-slate-200 bg-slate-50/80 text-slate-700 shadow-slate-100/50",
    contentClassName: "text-slate-600",
    timeClassName: "text-slate-400",
  },
  wecomEvent: {
    containerClassName: "bg-slate-100/85 text-slate-500",
    contentClassName: "text-slate-500",
    timeClassName: "text-slate-400/90",
  },
  fallback: {
    containerClassName:
      "border-slate-200 bg-white/80 text-slate-700 shadow-slate-100/60",
    contentClassName: "text-slate-700",
    timeClassName: "text-slate-400",
  },
} as const satisfies Record<string, WecomNoticePalette>;

function normalizeNoticeKind(input?: WecomNoticeInput): WecomNoticeKind {
  const explicit = (input?.notice_kind || "").trim().toLowerCase();
  if (
    explicit === "sync_gap_notice" ||
    explicit === "wecom_event_notice" ||
    explicit === "wecom_recall_notice"
  ) {
    return explicit;
  }
  const msgType = (input?.type || "").trim().toLowerCase();
  if (msgType === "sync_gap_notice") return "sync_gap_notice";
  if (msgType === "wecom_recall_notice") return "wecom_recall_notice";
  if (msgType === "wecom_event_notice" || msgType === "event") {
    return "wecom_event_notice";
  }
  return "";
}

function normalizeSyncGapStatus(input?: WecomNoticeInput): string {
  const explicit = (input?.notice_status || "").trim().toLowerCase();
  if (explicit === "open" || explicit === "resolved") return explicit;
  const fallback = (input?.status || "").trim().toLowerCase();
  if (fallback === "open" || fallback === "resolved") return fallback;
  return "updated";
}

function normalizeTone(
  kind: WecomNoticeKind,
  status: string,
): WecomNoticeTone {
  if (kind === "sync_gap_notice") {
    return status === WECOM_NOTICE_STATUS.syncGapOpen
      ? WECOM_NOTICE_TONE.syncGapOpen
      : status === WECOM_NOTICE_STATUS.syncGapResolved
        ? WECOM_NOTICE_TONE.syncGapResolved
        : WECOM_NOTICE_TONE.syncGapUpdated;
  }
  if (kind === "wecom_recall_notice") return WECOM_NOTICE_TONE.wecomRecall;
  if (kind === "wecom_event_notice") return WECOM_NOTICE_TONE.wecomEvent;
  return WECOM_NOTICE_TONE.fallback;
}

function fallbackContent(kind: WecomNoticeKind): string {
  if (kind === "sync_gap_notice") return "同步状态已更新";
  if (kind === "wecom_recall_notice") return "一条消息已撤回";
  if (kind === "wecom_event_notice") return "企业微信事件已同步";
  return "";
}

export function resolveWecomNoticePresentation(
  input?: WecomNoticeInput | null,
): WecomNoticePresentation {
  const kind = normalizeNoticeKind(input || undefined);
  const status =
    kind === "sync_gap_notice"
      ? normalizeSyncGapStatus(input || undefined)
      : "";
  return {
    kind,
    status,
    tone: normalizeTone(kind, status),
    content: (input?.content || "").trim() || fallbackContent(kind),
  };
}

export function resolveWecomNoticePalette(
  input?: WecomNoticeInput | null,
): WecomNoticePalette {
  const presentation = resolveWecomNoticePresentation(input);
  if (presentation.kind === "sync_gap_notice") {
    return presentation.status === WECOM_NOTICE_STATUS.syncGapOpen
      ? WECOM_NOTICE_PALETTE.syncGapOpen
      : presentation.status === WECOM_NOTICE_STATUS.syncGapResolved
        ? WECOM_NOTICE_PALETTE.syncGapResolved
        : WECOM_NOTICE_PALETTE.syncGapUpdated;
  }
  if (presentation.kind === "wecom_recall_notice") {
    return WECOM_NOTICE_PALETTE.wecomRecall;
  }
  if (presentation.kind === "wecom_event_notice") {
    return WECOM_NOTICE_PALETTE.wecomEvent;
  }
  return WECOM_NOTICE_PALETTE.fallback;
}
