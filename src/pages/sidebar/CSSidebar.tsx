import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { normalizeErrorMessage } from "@/services/http";
import {
  resolveSidebarRuntimeContext,
  sendTextToCurrentSession,
  toJSSDKErrorMessage,
} from "@/services/jssdkService";
import { executeContactSidebarCommand } from "@/services/sidebarService";
import {
  openCommandCenterRealtimeSocket,
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
  sidebarHeader,
  sidebarMeta,
  sidebarNotice,
  sidebarPageShell,
  sidebarSectionLabel,
  sidebarTitle,
} from "./sidebarChrome";
import { listReceptionChannels } from "@/services/receptionService";
import {
  ArrowUpRight,
  CheckCircle2,
  GitBranch,
  ChevronRight,
  Clock,
  Copy,
  Lightbulb,
  RefreshCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
    nextStepLabel: (item.next_step_label || "").trim() || "继续填入下一句",
    reason: (item.reason || "").trim(),
    source: (item.source || "").trim(),
  };
}

function ToolbarSkeleton() {
  return (
    <div className={`${sidebarBody} space-y-3`}>
      <div className="wecom-toolbar-skeleton h-24 rounded-2xl" />
      <div className="wecom-toolbar-skeleton h-28 rounded-2xl" />
      <div className="wecom-toolbar-skeleton h-40 rounded-2xl" />
    </div>
  );
}

function shouldRefreshToolbarSession(
  payload: CommandCenterRealtimeEnvelope,
  openKFID: string,
  externalUserID: string,
): boolean {
  const targetOpenKFID = openKFID.trim();
  const targetExternalUserID = externalUserID.trim();
  if (!targetOpenKFID || !targetExternalUserID) return false;
  return (payload.events || []).some((event) => {
    const eventExternalUserID = (event.external_userid || "").trim();
    const eventOpenKFID = (event.open_kfid || "").trim();
    if (!eventExternalUserID || eventExternalUserID !== targetExternalUserID)
      return false;
    if (!eventOpenKFID || eventOpenKFID !== targetOpenKFID) return false;
    return true;
  });
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

function normalizeToolbarSummaryStatus(raw?: string): string {
  const value = (raw || "").trim();
  if (!value) return "pending";
  if (value === "succeeded") return "ready";
  if (value === "selection_required") return "待选择";
  if (value === "running") return "分析中";
  if (value === "queued") return "排队中";
  if (value === "failed") return "失败";
  if (value === "ready" || value === "pending") return value;
  return value;
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

function toolbarBatchTimeValue(batch?: KFToolbarSuggestionBatch | null): number {
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

  if (nextBatchID && nextBatchID !== prevBatchID) {
    return next;
  }
  if (
    (nextStatus === "ready" || nextStatus === "failed") &&
    prevStatus !== nextStatus
  ) {
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
  const targetOpenKFID = openKFID.trim();
  const targetExternalUserID = externalUserID.trim();
  if (!targetOpenKFID || !targetExternalUserID) return false;
  return (payload.events || []).some((event) => {
    const eventExternalUserID = (event.external_userid || "").trim();
    const eventOpenKFID = (event.open_kfid || "").trim();
    const eventType = (event.event_type || "").trim().toLowerCase();
    if (!eventExternalUserID || eventExternalUserID !== targetExternalUserID)
      return false;
    if (!eventOpenKFID || eventOpenKFID !== targetOpenKFID) return false;
    return (
      eventType === "chat.message.received" ||
      eventType === "chat.session_state.changed" ||
      eventType === "chat.session_analysis.updated" ||
      eventType === "chat.session_analysis.state_changed"
    );
  });
}

export default function CSSidebar() {
  const [bootstrap, setBootstrap] = useState<KFToolbarBootstrap | null>(null);
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isResolvingContext, setIsResolvingContext] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isUpgraded, setIsUpgraded] = useState(false);
  const [upgradeOwner, setUpgradeOwner] = useState("销售 A");
  const [upgradeIntent, setUpgradeIntent] = useState("高");
  const [upgradeNote, setUpgradeNote] = useState("");
  const [threadSteps, setThreadSteps] = useState<Record<string, number>>({});
  const [channelDisplayMap, setChannelDisplayMap] = useState<
    Record<string, string>
  >({});
  const refreshTimerRef = useRef<number | null>(null);
  const suggestionProbeTimerRef = useRef<number | null>(null);
  const realtimeVersionRef = useRef(0);
  const bootstrapSessionKeyRef = useRef("");
  const suggestionRequestSeqRef = useRef(0);

  const query = useMemo(() => {
    if (typeof window === "undefined")
      return { entry: "single_kf_tools", open_kfid: "", external_userid: "" };
    const params = new URLSearchParams(window.location.search);
    return {
      entry: (params.get("entry") || "single_kf_tools").trim(),
      open_kfid: (params.get("open_kfid") || "").trim(),
      external_userid: (params.get("external_userid") || "").trim(),
    };
  }, []);
  const [sessionLocator, setSessionLocator] = useState(query);

  useEffect(() => {
    setSessionLocator(query);
  }, [query]);

  useEffect(() => {
    let alive = true;
    const shouldResolveRuntime =
      (query.entry || "").trim() === "single_kf_tools";
    if (!shouldResolveRuntime) return;

    setIsResolvingContext(true);
    void resolveSidebarRuntimeContext()
      .then((runtime) => {
        if (!alive) return;
        const runtimeExternalUserID = (runtime.external_userid || "").trim();
        const runtimeEntry = (runtime.entry || "").trim();
        setSessionLocator((prev) => ({
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
  }, [query]);

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

  const loadSuggestions = async (input?: {
    entry?: string;
    open_kfid?: string;
    external_userid?: string;
    seed_reply_id?: string;
    reason?: string;
    silentNotice?: boolean;
    manual?: boolean;
  }) => {
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
    if (!openKFID || !externalUserID) {
      setIsLoadingSuggestions(false);
      return;
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
      if (suggestionRequestSeqRef.current !== requestSeq) return;
      const nextBatch: KFToolbarSuggestionBatch = batch || { batch_id: "", items: [] };
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
        setNotice("已更新一组新的建议回复");
      }
    } catch (error) {
      if (suggestionRequestSeqRef.current !== requestSeq) return;
      if (!input?.silentNotice) {
        setNotice(sanitizeToolbarNotice(error));
      }
      setBootstrap((prev) =>
        prev
          ? {
              ...prev,
              suggestions: { batch_id: "", items: [] },
            }
          : prev,
      );
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
  }) => {
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
      setIsLoading(false);
      if (!options?.preserveNotice) {
        setNotice(
          "暂时无法识别当前客户，请确认已从企业微信客户会话进入工具栏，或稍后重试。",
        );
      }
      return;
    }
    if (!options?.silent) {
      setIsLoading(true);
    }
    try {
      const data = await getKFToolbarBootstrap({
        entry,
        open_kfid: openKFID,
        external_userid: externalUserID,
      });
      const nextSessionKey = buildToolbarSessionKey({
        open_kfid: data?.open_kfid,
        external_userid: data?.external_userid,
        selection_required: data?.selection?.required,
      });
      const sessionChanged =
        nextSessionKey !== bootstrapSessionKeyRef.current;
      bootstrapSessionKeyRef.current = nextSessionKey;
      setBootstrap((prev) => {
        if (!data) return null;
        return {
          ...data,
          suggestions:
            !sessionChanged && prev?.suggestions
              ? mergeToolbarSuggestionBatch(prev.suggestions, data.suggestions)
              : data.suggestions,
        };
      });
      realtimeVersionRef.current = Number(data?.version || 0);
      setUpgradeNote(
        (
          data?.summary?.headline ||
          data?.summary?.customer_goal ||
          ""
        ).trim(),
      );
      if (!options?.preserveNotice) {
        setNotice("");
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
        return;
      }
    } catch (error) {
      if (!options?.silent) {
        setBootstrap(null);
        setNotice(sanitizeToolbarNotice(error));
      }
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

  useEffect(() => {
    realtimeVersionRef.current = Number(bootstrap?.version || 0);
  }, [bootstrap?.version]);

  const header = bootstrap?.header;
  const summary = bootstrap?.summary;
  const selectionState = bootstrap?.selection;

  useEffect(() => {
    const suggestionStatus = normalizeToolbarSuggestionStatus(
      bootstrap?.suggestions?.status,
    );
    if (suggestionProbeTimerRef.current !== null) {
      window.clearTimeout(suggestionProbeTimerRef.current);
      suggestionProbeTimerRef.current = null;
    }
    if (selectionState?.required) return;
    if (suggestionStatus !== "queued" && suggestionStatus !== "running") return;
    suggestionProbeTimerRef.current = window.setTimeout(() => {
      suggestionProbeTimerRef.current = null;
      void loadBootstrap({ preserveNotice: true, silent: true });
    }, suggestionStatus === "queued" ? 900 : 1200);
    return () => {
      if (suggestionProbeTimerRef.current !== null) {
        window.clearTimeout(suggestionProbeTimerRef.current);
        suggestionProbeTimerRef.current = null;
      }
    };
  }, [bootstrap?.suggestions?.status, selectionState?.required]);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
    let chatSocket: WebSocket | null = null;
    let opsSocket: WebSocket | null = null;

    const queueRefresh = () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        void loadBootstrap({ preserveNotice: true, silent: true });
      }, 180);
    };

    const handleMessage = (payload: CommandCenterRealtimeEnvelope) => {
      realtimeVersionRef.current = Math.max(
        realtimeVersionRef.current,
        Number(payload.latest_version || 0),
      );
      if (!shouldRefreshToolbarSession(payload, openKFID, externalUserID))
        return;
      if (shouldRefreshToolbarSuggestions(payload, openKFID, externalUserID)) {
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
                  ...(prev.suggestions || {}),
                  status: "queued",
                  failure_message: "",
                  updated_at: new Date().toISOString(),
                },
              }
            : prev,
        );
      }
      queueRefresh();
    };

    const connect = () => {
      if (stopped) return;
      chatSocket = openCommandCenterRealtimeSocket({
        topic: "chat",
        open_kfid: openKFID,
        since_version: realtimeVersionRef.current,
        onMessage: handleMessage,
        onClose: () => {
          if (stopped) return;
          reconnectTimer = window.setTimeout(connect, 1200);
        },
      });
      opsSocket = openCommandCenterRealtimeSocket({
        topic: "ops",
        open_kfid: openKFID,
        since_version: realtimeVersionRef.current,
        onMessage: handleMessage,
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
      [chatSocket, opsSocket].forEach((socket) => {
        if (!socket) return;
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close();
        }
      });
    };
  }, [
    bootstrap?.external_userid,
    bootstrap?.open_kfid,
    bootstrap?.selection?.required,
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
    summaryStatus === "queued" || summaryStatus === "running" || summaryStatus === "pending";
  const suggestionIsAnalyzing =
    suggestionStatus === "queued" || suggestionStatus === "running";
  const summaryBlockingIssues = compactToolbarFacts(summary?.blocking_issues, 3);
  const summaryDecisionSignals = compactToolbarFacts(
    summary?.decision_signals,
    3,
  );
  const summaryNextBestActions = compactToolbarFacts(
    summary?.next_best_actions,
    3,
  );
  const summaryReplyGuardrails = compactToolbarFacts(
    summary?.reply_guardrails,
    3,
  );
  const summaryProfileFacts = compactToolbarFacts(summary?.profile_facts, 3);
  const canUpgrade = Boolean(
    header?.can_upgrade_contact &&
    bootstrap?.external_userid &&
    !selectionState?.required,
  );

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

  const handleCopySuggestion = async (item: NormalizedSuggestion) => {
    const currentStep = Math.min(
      threadSteps[item.id] || 0,
      item.sentences.length - 1,
    );
    const text = item.sentences[currentStep] || item.text;
    try {
      await navigator.clipboard.writeText(text);
      setNotice(currentStep > 0 ? "已复制下一句建议" : "已复制建议内容");
      void safeFeedback({
        reply_id: item.id,
        action: "copy",
        step: currentStep + 1,
      });
    } catch {
      setNotice("复制失败，请手动复制");
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
      const runtime = await sendTextToCurrentSession(text, {
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
        setNotice(`已填入第 ${currentStep + 1} 句，可继续发送下一句`);
      } else {
        setThreadSteps((prev) => ({
          ...prev,
          [item.id]: item.sentences.length,
        }));
        setNotice(
          item.hasFollowups
            ? "已完成本组分步回复填入"
            : "已通过企业微信客户端填入当前会话",
        );
      }
      void executeContactSidebarCommand({
        command: "contact_fill_suggestion",
        external_userid:
          runtime.external_userid ||
          bootstrap?.external_userid ||
          sessionLocator.external_userid ||
          query.external_userid,
        payload: {
          text,
          source: "jssdk_send_chat_message",
          reply_id: item.id,
          step: currentStep + 1,
        },
      }).catch(() => {});
    } catch (error) {
      const message = toJSSDKErrorMessage(error);
      try {
        await navigator.clipboard.writeText(text);
        setNotice(`${message}，已降级为复制，请手动粘贴发送`);
      } catch {
        setNotice(message || sanitizeToolbarNotice(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerate = async () => {
    if (
      !bootstrap ||
      selectionState?.required ||
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

  return (
    <div className={sidebarPageShell}>
      <div
        className={`${sidebarHeader} sticky top-0 z-10 shadow-[0_8px_24px_rgba(15,23,42,0.04)]`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className={sidebarTitle}>
                {(header?.contact_name || "未识别客户").trim()}
              </span>
              <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
                {(header?.session_status || "会话中").trim()}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(header?.risk_tags || []).map((tag) => (
                <Badge
                  key={tag}
                  variant="warning"
                  className="px-2 py-0.5 text-[10px]"
                >
                  {tag}
                </Badge>
              ))}
              {header?.last_active ? (
                <span
                  className={`${sidebarMeta} inline-flex items-center gap-1`}
                >
                  <Clock className="h-3 w-3" />
                  {header.last_active.replace("T", " ").slice(0, 16)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              className={`h-8 rounded-full px-3 text-[11px] ${isUpgraded ? "bg-slate-100 text-slate-400" : "bg-blue-600 text-white hover:bg-blue-700"}`}
              disabled={!canUpgrade || isUpgraded || isSubmitting}
              onClick={() => setIsUpgradeModalOpen(true)}
            >
              {isUpgraded ? (
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              ) : (
                <ArrowUpRight className="mr-1 h-3.5 w-3.5" />
              )}
              {isUpgraded ? "已升级" : "升级客户联系"}
            </Button>
          </div>
        </div>

        {notice ? (
          <div
            className={`${sidebarNotice} rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-blue-700`}
          >
            {notice}
          </div>
        ) : null}
        {bootstrap?.warnings && bootstrap.warnings.length > 0 ? (
          <div
            className={`${sidebarNotice} mt-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-orange-700`}
          >
            {bootstrap.warnings.join("；")}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <ToolbarSkeleton />
      ) : (
        <div className={`${sidebarBody} space-y-3`}>
          {selectionState?.required ? (
            <Card className="wecom-toolbar-panel wecom-toolbar-enter rounded-2xl border-slate-200 bg-white/95">
              <div className="mb-3 flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <GitBranch className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className={sidebarSectionLabel}>
                    选择当前微信客服会话
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    同一客户最近命中过多个微信客服账号。工具栏不再自动猜测当前客服号，请先明确本次要辅助的会话。
                  </p>
                </div>
              </div>

              <div className="space-y-2">
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
                  const contactName = (
                    candidate.contact_name ||
                    header?.contact_name ||
                    "未识别客户"
                  ).trim();
                  return (
                    <button
                      key={`${openKFID}-${externalUserID}-${idx}`}
                      type="button"
                      className="group w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/70 hover:shadow-[0_12px_28px_rgba(37,99,235,0.10)]"
                      onClick={() => {
                        setNotice(
                          `已切换到 ${channelLabel}，正在载入当前会话...`,
                        );
                        setSessionLocator((prev) => ({
                          ...prev,
                          open_kfid: openKFID,
                          external_userid:
                            externalUserID || prev.external_userid,
                        }));
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {channelLabel}
                            </span>
                            <Badge
                              variant="secondary"
                              className="px-2 py-0.5 text-[10px]"
                            >
                              {(candidate.session_status || "会话中").trim()}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            当前客户：{contactName}
                          </div>
                          {(candidate.last_message || "").trim() ? (
                            <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">
                              {candidate.last_message}
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-slate-500">
                              该会话暂无可展示的最新消息摘要
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs text-slate-400">
                            {formatToolbarSelectionTime(
                              candidate.last_active,
                            ) || "最近时间未知"}
                          </div>
                          <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 transition-transform duration-200 group-hover:translate-x-0.5">
                            进入此会话
                            <ChevronRight className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          ) : (
            <>
              <Card className="wecom-toolbar-panel wecom-toolbar-enter rounded-2xl border-slate-200 bg-white/95">
                <div className="mb-3 flex items-start gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <div className={sidebarSectionLabel}>会话摘要</div>
                      <Badge
                        variant={summaryStatus === "ready" ? "success" : "secondary"}
                        className="px-2 py-0.5 text-[10px]"
                      >
                        {summaryStatus}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <p className="wecom-toolbar-summary-text m-0 text-slate-800">
                        {(summary?.headline || "正在整理当前会话分析...").trim()}
                      </p>
                      {summaryIsAnalyzing ? (
                        <div className="flex items-center gap-2 text-[11px] text-blue-600">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400/70" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                            </span>
                            {summaryStatus === "queued"
                              ? "正在等待回复窗口收齐后分析"
                              : "AI 正在更新本轮会话分析"}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl bg-slate-50/90 p-3">
                  <div className="flex flex-wrap gap-2">
                    {summary?.journey_stage ? (
                      <Badge
                        variant="secondary"
                        className="border-none bg-white text-[10px] text-slate-600"
                      >
                        阶段：{summary.journey_stage}
                      </Badge>
                    ) : null}
                    {summary?.relationship_stage ? (
                      <Badge
                        variant="secondary"
                        className="border-none bg-white text-[10px] text-slate-600"
                      >
                        关系：{summary.relationship_stage}
                      </Badge>
                    ) : null}
                    {summary?.priority ? (
                      <Badge
                        variant="secondary"
                        className="border-none bg-white text-[10px] text-slate-600"
                      >
                        优先级：{summary.priority}
                      </Badge>
                    ) : null}
                    {summary?.opportunity_level ? (
                      <Badge
                        variant="secondary"
                        className="border-none bg-white text-[10px] text-slate-600"
                      >
                        机会：{summary.opportunity_level}
                      </Badge>
                    ) : null}
                  </div>

                  {summary?.customer_goal ? (
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-slate-500">
                        当前目标
                      </div>
                      <div className="text-[12px] leading-6 text-slate-700">
                        {summary.customer_goal.trim()}
                      </div>
                    </div>
                  ) : null}

                  {summaryBlockingIssues.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-slate-500">
                        阻塞点
                      </div>
                      <div className="space-y-1">
                        {summaryBlockingIssues.map((item, idx) => (
                          <div
                            key={`${item}-${idx}`}
                            className="flex items-start gap-2 text-[12px] text-slate-600"
                          >
                            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {summaryNextBestActions.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-slate-500">
                        下一步建议
                      </div>
                      <div className="space-y-1">
                        {summaryNextBestActions.map((item, idx) => (
                          <div
                            key={`${item}-${idx}`}
                            className="flex items-start gap-2 text-[12px] text-slate-600"
                          >
                            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {summaryDecisionSignals.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-slate-500">
                        成交/决策信号
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {summaryDecisionSignals.map((item) => (
                          <Badge
                            key={item}
                            variant="secondary"
                            className="border-none bg-white text-[10px] text-slate-600"
                          >
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {summaryReplyGuardrails.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-slate-500">
                        回复注意
                      </div>
                      <div className="space-y-1">
                        {summaryReplyGuardrails.map((item, idx) => (
                          <div
                            key={`${item}-${idx}`}
                            className="flex items-start gap-2 text-[12px] text-slate-600"
                          >
                            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {summaryProfileFacts.length > 0 ? (
                    <div className="space-y-1">
                      <div className="text-[11px] font-medium text-slate-500">
                        长期画像
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {summaryProfileFacts.map((item) => (
                          <Badge
                            key={item}
                            variant="secondary"
                            className="border-none bg-white text-[10px] text-slate-600"
                          >
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {summaryBlockingIssues.length === 0 &&
                  summaryNextBestActions.length === 0 &&
                  summaryDecisionSignals.length === 0 &&
                  summaryReplyGuardrails.length === 0 &&
                  summaryProfileFacts.length === 0 &&
                  !summary?.customer_goal ? (
                    <div className="rounded-2xl border border-dashed border-blue-100 bg-white px-3 py-3 text-[12px] text-slate-500">
                      {summaryIsAnalyzing ? (
                        <div className="space-y-2">
                          <div className="h-2.5 w-28 animate-pulse rounded-full bg-blue-100" />
                          <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-200" />
                          <div className="h-2.5 w-5/6 animate-pulse rounded-full bg-slate-200" />
                        </div>
                      ) : (
                        "当前结构化分析仍在整理中，稍后会补齐更完整的客户判断。"
                      )}
                    </div>
                  ) : null}
                </div>
              </Card>

              <Card className="wecom-toolbar-panel rounded-2xl border-slate-200 bg-white/95">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <div className={sidebarSectionLabel}>AI 建议回复</div>
                      <div className={`${sidebarMeta} mt-0.5`}>
                        {suggestionIsAnalyzing
                          ? suggestionStatus === "queued"
                            ? "已收到新消息，正在等待回复窗口收齐"
                            : "AI 正在基于本轮新消息生成建议回复"
                          : "支持单句直发，也支持分步逐句填入"}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full border-slate-200 px-3 text-[11px]"
                    disabled={isRegenerating || isSubmitting}
                    onClick={() => void handleRegenerate()}
                  >
                    <RefreshCcw
                      className={`mr-1 h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`}
                    />
                    换一批
                  </Button>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/45">
                  {suggestionIsAnalyzing ? (
                    <div className="border-b border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-2 text-[11px] text-blue-600">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400/70" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                        </span>
                        <span>
                          {suggestionStatus === "queued"
                            ? "新消息已进入回复窗口，窗口收齐后会统一生成建议"
                            : "AI 正在重新组织本轮建议回复"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  {suggestions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-[12px] text-slate-500">
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
                      const isFinished = currentStep >= item.sentences.length;
                      const primaryLabel = isFinished
                        ? "已完成本组回复"
                        : !item.hasFollowups
                          ? "填入回复"
                          : currentStep === 0
                          ? "填入首句"
                          : item.nextStepLabel;

                      return (
                        <div
                          key={item.id}
                          className={`wecom-toolbar-list-item wecom-toolbar-enter ${
                            item.displayMode === "threaded"
                              ? "wecom-toolbar-thread-row"
                              : ""
                          } ${idx < suggestions.length - 1 ? "border-b border-slate-100" : ""} ${
                            suggestionIsAnalyzing ? "opacity-75" : ""
                          }`}
                          style={{ animationDelay: `${idx * 70}ms` }}
                        >
                          <div className="mb-1.5 flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <Badge
                                variant={
                                  item.hasFollowups ? "default" : "secondary"
                                }
                                className="shrink-0 px-2 py-0.5 text-[10px]"
                              >
                                {item.hasFollowups ? "分步发送" : "直接回复"}
                              </Badge>
                              <span className="text-[10px] text-slate-400">
                                已填 {Math.min(currentStep, item.sentences.length)}/
                                {item.sentences.length}
                              </span>
                            </div>
                          </div>

                          <div className="mb-2 space-y-1.5 rounded-xl bg-white/90 px-2.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]">
                            {item.sentences.map((sentence, sentenceIdx) => {
                              const isSent = sentenceIdx < currentStep;
                              const isCurrent =
                                !isFinished && sentenceIdx === currentStep;
                              return (
                                <div
                                  key={`${item.id}-sentence-${sentenceIdx}`}
                                  className="flex items-start gap-2"
                                >
                                  <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
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
                                    className={`min-w-0 text-[11.5px] leading-5 transition-colors duration-200 ${
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

                          {isFinished ? (
                            <div className="mb-2 text-[11px] text-emerald-700">
                              这组建议已填入完成。
                            </div>
                          ) : null}

                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 rounded-full px-2.5 text-[10.5px]"
                              onClick={() => void handleCopySuggestion(item)}
                            >
                              <Copy className="mr-1 h-3.5 w-3.5" />
                              {item.hasFollowups && currentStep > 0
                                ? "复制当前句"
                                : "复制"}
                            </Button>
                            <Button
                              size="sm"
                              className={`h-7 rounded-full px-2.5 text-[10.5px] ${isFinished ? "bg-slate-100 text-slate-400" : "bg-blue-600 hover:bg-blue-700"}`}
                              disabled={isSubmitting || isFinished}
                              onClick={() => void handleFillSuggestion(item)}
                            >
                              <Send className="mr-1 h-3.5 w-3.5" />
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
          )}
        </div>
      )}

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
