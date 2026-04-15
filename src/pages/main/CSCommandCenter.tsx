import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import {
  Search,
  AlertCircle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  GitBranch,
  UserPlus,
  Info,
  ChevronRight,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { WecomOpenDataName } from "@/components/wecom/WecomOpenDataName";
import {
  getCSCommandCenterSessionDetail,
  getCSCommandCenterView,
  transitionKFServiceState,
  type CommandCenterMessage,
  type CommandCenterSession,
  type CommandCenterSessionDetail,
  type CommandCenterViewModel,
} from "@/services/commandCenterService";
import {
  listKFServicerAssignments,
  listReceptionChannels,
  type KFServicerAssignment,
} from "@/services/receptionService";
import {
  buildServicerIdentityLookup,
  resolveServicerIdentityToken,
  resolveServicerIdentityView,
  splitIdentityTokens,
} from "@/services/servicerIdentity";
import { executeContactSidebarCommand } from "@/services/sidebarService";
import { normalizeErrorMessage } from "@/services/http";
import { useAuth } from "@/context/AuthContext";

type SessionTab = "queue" | "active" | "closed";
type DetailPanelTab = "monitor" | "upgrade" | "session";
const COMMAND_CENTER_SESSION_POLL_INTERVAL_MS = 5000;
const COMMAND_CENTER_VIEW_POLL_INTERVAL_MS = 15000;
type ActionKey = "send_to_queue" | "transfer_to_human" | "end_session";

type SessionActionDescriptor = {
  key: ActionKey;
  label: string;
  description: string;
  tone: "primary" | "secondary" | "danger";
  disabled?: boolean;
  disabledReason?: string;
};

type SessionActionPanel = {
  title: string;
  description: string;
  primaryAction: SessionActionDescriptor | null;
  secondaryActions: SessionActionDescriptor[];
  emptyHint?: string;
};

type TransferCandidate = {
  servicerUserID: string;
  userid: string;
  openUserID: string;
  role: string;
  searchText: string;
  displayUserID: string;
  displayFallback: string;
  rawID: string;
};

type RoutingRecord = NonNullable<CommandCenterSessionDetail["routing_records"]>[number];
type SessionStatusPresentation = {
  label: string;
  badgeClassName: string;
};

function resolveSessionBucket(session: CommandCenterSession): SessionTab {
  const bucket = (session.state_bucket || "").trim().toLowerCase();
  if (bucket === "active") return "active";
  if (bucket === "closed") return "closed";
  if (bucket === "queue") return "queue";
  const state = Number(session.session_state || 0);
  if (state === 3) return "active";
  if (state === 4) return "closed";
  return "queue";
}

function resolveAssignedDisplay(session?: CommandCenterSession) {
  const identity = resolveServicerIdentityView(session);
  const rawID = identity.rawServicerUserID;
  const displayUserID = identity.displayIdentity;
  const displayFallback = (identity.displayFallback || "待分配").trim();
  return {
    rawID,
    displayUserID,
    displayFallback,
  };
}

function renderServicerValue(props: {
  value?: string;
  corpId: string;
  identityLookup: Map<string, ReturnType<typeof resolveServicerIdentityView>>;
  showRawID?: boolean;
}) {
  const tokens = splitIdentityTokens(props.value || "");
  if (tokens.length === 0) return "-";
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {tokens.map((token) => {
        const identity = resolveServicerIdentityToken(token, props.identityLookup);
        const displayIdentity = (identity?.displayIdentity || "").trim();
        const displayFallback = (
          identity?.displayFallback ||
          token
        ).trim();
        const rawID = (identity?.rawServicerUserID || "").trim();
        return (
          <span
            key={`${token}-${rawID || displayFallback}`}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
            title={rawID || displayFallback}
          >
            {displayIdentity ? (
              <WecomOpenDataName
                userid={displayIdentity}
                corpId={props.corpId}
                fallback={displayFallback}
                className="text-[11px] font-medium text-gray-700"
              />
            ) : (
              <span className="text-[11px] font-medium text-gray-700">
                {displayFallback}
              </span>
            )}
            {props.showRawID && rawID ? (
              <span className="text-[10px] text-gray-400">ID:{rawID}</span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

function formatRoutingDateTime(value?: string): string {
  const parsed = (value || "").trim();
  if (!parsed) return "-";
  const millis = Date.parse(parsed);
  if (Number.isNaN(millis)) return parsed;
  return new Date(millis).toLocaleString("zh-CN", { hour12: false });
}

function formatRoutingEventTime(value?: string): string {
  const parsed = (value || "").trim();
  if (!parsed) return "";
  const millis = Date.parse(parsed);
  if (Number.isNaN(millis)) return parsed;
  return new Date(millis).toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderRoutingIdentity(props: {
  userid?: string;
  fallback?: string;
  corpId: string;
  identityLookup: Map<string, ReturnType<typeof resolveServicerIdentityView>>;
}) {
  const fallback = (props.fallback || "").trim() || "人工";
  const candidates = [
    (props.userid || "").trim(),
    ...splitIdentityTokens(props.fallback || ""),
  ].filter(Boolean);
  const resolvedToken =
    candidates.find((item) => resolveServicerIdentityToken(item, props.identityLookup)) ||
    candidates[0] ||
    "";
  if (!resolvedToken) return <span>{fallback}</span>;
  const identity = resolveServicerIdentityToken(resolvedToken, props.identityLookup);
  const displayIdentity = (identity?.displayIdentity || resolvedToken).trim();
  const displayFallback = (identity?.displayFallback || fallback).trim();
  return (
    <WecomOpenDataName
      userid={displayIdentity}
      corpId={props.corpId}
      fallback={displayFallback}
      className="font-medium text-gray-900"
    />
  );
}

function hasRoutingRecordDetails(
  record?: RoutingRecord,
): boolean {
  const details = record?.details;
  if (!details) return false;
  return [
    details.dispatch_strategy_label,
    details.action_boundary_label,
    details.execution_result_label,
    details.result_state_label,
    details.rule_name,
    details.reason_summary,
    details.trace_id,
    details.target_raw_servicer_userid,
  ].some((item) => (item || "").trim().length > 0);
}

function shouldShowRoutingReason(record?: RoutingRecord): boolean {
  const reason = (record?.details?.reason_summary || "").trim();
  if (!reason) return false;
  const action = (record?.action_text || "").trim();
  const target = (record?.target_label || record?.details?.target_label || "").trim();
  const normalizedReason = reason.replace(/\s+/g, "");
  const normalizedAction = action.replace(/\s+/g, "");
  const normalizedTarget = target.replace(/\s+/g, "");
  if (normalizedAction && normalizedReason.includes(normalizedAction)) return false;
  if (normalizedTarget && normalizedReason.includes(normalizedTarget)) return false;
  return true;
}

function readRoutingRuleName(record?: RoutingRecord): string {
  return (record?.details?.rule_name || "").trim();
}

function readRoutingRuleLink(record?: RoutingRecord): string {
  const ruleID = (record?.details?.rule_id || "").trim();
  if (ruleID) {
    return `/main/routing-rules?edit_rule_id=${encodeURIComponent(ruleID)}`;
  }
  return "/main/routing-rules";
}

function readRoutingActionHeadline(record?: RoutingRecord): string {
  const action = (record?.action_text || "").trim();
  if (!action) return "更新了会话状态";
  return action
    .replace(/^按普通规则/, "")
    .replace(/^按兜底规则/, "")
    .trim();
}

function formatQueueWaitDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) return `${hours}小时${minutes}分${seconds}秒`;
  if (minutes > 0) return `${minutes}分${seconds}秒`;
  return `${seconds}秒`;
}

function readLiveQueueWaitText(
  session: CommandCenterSession | null | undefined,
  fetchedAtMs: number,
  nowMs: number,
): string {
  if (!session) return "";
  const baseSeconds = Number(session.queue_wait_secs || 0);
  if (baseSeconds > 0 && fetchedAtMs > 0) {
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - fetchedAtMs) / 1000));
    return formatQueueWaitDuration(baseSeconds + elapsedSeconds);
  }
  return (session.queue_wait_text || "").trim();
}

function resolveSessionStatusPresentation(
  session?: CommandCenterSession | null,
): SessionStatusPresentation {
  const bucket = session ? resolveSessionBucket(session) : "queue";
  const state = Number(session?.session_state || 0);
  if (bucket === "closed" || state === 4) {
    return {
      label: "已结束",
      badgeClassName: "bg-gray-100 text-gray-600 border-gray-200",
    };
  }
  if (bucket === "active" || state === 3) {
    return {
      label: "人工接待",
      badgeClassName: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (state === 1) {
    return {
      label: "智能助手",
      badgeClassName: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }
  if (bucket === "queue" || state === 2) {
    return {
      label: "排队中",
      badgeClassName: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  return {
    label: (session?.session_label || "待处理").trim() || "待处理",
    badgeClassName: "bg-slate-100 text-slate-700 border-slate-200",
  };
}

export default function CSCommandCenter() {
  const auth = useAuth();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isUpgradeSuccess, setIsUpgradeSuccess] = useState(false);
  const [isRoutingHistoryExpanded, setIsRoutingHistoryExpanded] = useState(false);

  const [view, setView] = useState<CommandCenterViewModel | null>(null);
  const [detail, setDetail] = useState<CommandCenterSessionDetail | null>(null);
  const [selectedExternalUserID, setSelectedExternalUserID] = useState("");
  const [activeTab, setActiveTab] = useState<SessionTab>("queue");
  const [detailPanelTab, setDetailPanelTab] = useState<DetailPanelTab>("monitor");
  const [keyword, setKeyword] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferCandidates, setTransferCandidates] = useState<TransferCandidate[]>([]);
  const [sessionServicerAssignments, setSessionServicerAssignments] = useState<KFServicerAssignment[]>([]);
  const [channelDisplayMap, setChannelDisplayMap] = useState<Record<string, string>>({});
  const [hasLoadedChannelDisplayMap, setHasLoadedChannelDisplayMap] = useState(false);
  const [isLoadingTransferCandidates, setIsLoadingTransferCandidates] = useState(false);
  const [viewFetchedAtMs, setViewFetchedAtMs] = useState(0);
  const [detailFetchedAtMs, setDetailFetchedAtMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [transferSearch, setTransferSearch] = useState("");
  const [selectedTransferServicerID, setSelectedTransferServicerID] = useState("");
  const transferCandidatesCacheRef = useRef(new Map<string, TransferCandidate[]>());
  const servicerAssignmentsCacheRef = useRef(new Map<string, KFServicerAssignment[]>());
  const selectedExternalUserIDRef = useRef("");

  const [upgradeOwner, setUpgradeOwner] = useState("销售部-王经理");
  const [upgradeReason, setUpgradeReason] = useState("高意向潜客");
  const [upgradeTask, setUpgradeTask] = useState("");
  const [upgradeStars, setUpgradeStars] = useState(4);

  const queryOpenKFID = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return (params.get("open_kfid") || "").trim();
  }, []);

  const corpID = (auth.corp?.id || "").trim();
  const sessionServicerLookup = useMemo(
    () => buildServicerIdentityLookup(sessionServicerAssignments),
    [sessionServicerAssignments],
  );

  const resolveChannelPresentation = (source?: string) => {
    const token = (source || "").trim();
    if (!token) return { label: "-", title: "" };
    const mapped = (channelDisplayMap[token] || "").trim();
    if (mapped) {
      return {
        label: mapped,
        title: mapped === token ? "" : token,
      };
    }
    if (!hasLoadedChannelDisplayMap) {
      return { label: "渠道", title: token };
    }
    return { label: "未知渠道", title: token };
  };

  useEffect(() => {
    selectedExternalUserIDRef.current = selectedExternalUserID.trim();
  }, [selectedExternalUserID]);

  useEffect(() => {
    setIsRoutingHistoryExpanded(false);
  }, [selectedExternalUserID]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    void listReceptionChannels({ limit: 500 })
      .then((channels) => {
        if (!alive) return;
        const next: Record<string, string> = {};
        channels.forEach((channel) => {
          const openKFID = (channel.open_kfid || "").trim();
          if (!openKFID) return;
          const label = (
            channel.display_name ||
            channel.name ||
            channel.open_kfid ||
            ""
          ).trim();
          if (!label) return;
          next[openKFID] = label;
        });
        setChannelDisplayMap(next);
        setHasLoadedChannelDisplayMap(true);
      })
      .catch(() => {
        if (!alive) return;
        setChannelDisplayMap({});
        setHasLoadedChannelDisplayMap(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const loadView = async () => {
    const data = await getCSCommandCenterView({
      open_kfid: queryOpenKFID,
      limit: 200,
    });
    setView(data);
    setViewFetchedAtMs(Date.now());
    const selectedID = (
      data?.selected?.external_userid ||
      data?.sessions?.[0]?.external_userid ||
      ""
    ).trim();
    setSelectedExternalUserID((prev) => prev || selectedID);
  };

  const loadDetail = async (externalUserID: string) => {
    const selected = (externalUserID || "").trim();
    if (!selected) {
      setDetail(null);
      return;
    }
    const data = await getCSCommandCenterSessionDetail({
      open_kfid: queryOpenKFID,
      external_userid: selected,
      limit: 200,
    });
    setDetail(data);
    setDetailFetchedAtMs(Date.now());
  };

  useEffect(() => {
    let alive = true;
    void getCSCommandCenterView({ open_kfid: queryOpenKFID, limit: 200 })
      .then((data) => {
        if (!alive) return;
        setView(data);
        setViewFetchedAtMs(Date.now());
        const selectedID = (
          data?.selected?.external_userid ||
          data?.sessions?.[0]?.external_userid ||
          ""
        ).trim();
        setSelectedExternalUserID(selectedID);
      })
      .catch(() => {
        if (!alive) return;
        setView(null);
      });
    return () => {
      alive = false;
    };
  }, [queryOpenKFID]);

  useEffect(() => {
    let alive = true;
    if (!selectedExternalUserID) {
      setDetail(null);
      return;
    }
    void getCSCommandCenterSessionDetail({
      open_kfid: queryOpenKFID,
      external_userid: selectedExternalUserID,
      limit: 200,
    })
      .then((data) => {
        if (!alive) return;
        setDetail(data);
        setDetailFetchedAtMs(Date.now());
      })
      .catch(() => {
        if (!alive) return;
        setDetail(null);
      });
    return () => {
      alive = false;
    };
  }, [queryOpenKFID, selectedExternalUserID]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void loadView();
    }, COMMAND_CENTER_VIEW_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [queryOpenKFID]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      const currentExternalUserID = selectedExternalUserIDRef.current;
      if (currentExternalUserID !== "") {
        void loadDetail(currentExternalUserID);
      }
    }, COMMAND_CENTER_SESSION_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [queryOpenKFID]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void loadView();
      const currentExternalUserID = selectedExternalUserIDRef.current;
      if (currentExternalUserID !== "") {
        void loadDetail(currentExternalUserID);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [queryOpenKFID]);

  const sessions = useMemo(() => view?.sessions || [], [view?.sessions]);
  const selectedSession = useMemo(() => {
    if (sessions.length === 0) return null;
    const found = sessions.find(
      (item) =>
      (item.external_userid || "").trim() === selectedExternalUserID.trim(),
    );
    return found || sessions[0];
  }, [selectedExternalUserID, sessions]);

  useEffect(() => {
    const openKFID = (selectedSession?.open_kfid || "").trim();
    if (!openKFID) {
      setSessionServicerAssignments([]);
      return;
    }
    const cached = servicerAssignmentsCacheRef.current.get(openKFID);
    if (cached) {
      setSessionServicerAssignments(cached);
      return;
    }
    let alive = true;
    void listKFServicerAssignments(openKFID)
      .then((assignments) => {
        if (!alive) return;
        servicerAssignmentsCacheRef.current.set(openKFID, assignments);
        setSessionServicerAssignments(assignments);
      })
      .catch(() => {
        if (!alive) return;
        setSessionServicerAssignments([]);
      });
    return () => {
      alive = false;
    };
  }, [selectedSession?.open_kfid]);

  useEffect(() => {
    const openKFID = (selectedSession?.open_kfid || "").trim();
    if (!isTransferModalOpen) return;
    if (!openKFID) {
      setTransferCandidates([]);
      setSelectedTransferServicerID("");
      return;
    }
    const cached = transferCandidatesCacheRef.current.get(openKFID);
    if (cached) {
      setTransferCandidates(cached);
      setSelectedTransferServicerID((prev) => {
        if (prev && cached.some((item) => item.servicerUserID === prev)) {
          return prev;
        }
        return cached[0]?.servicerUserID || "";
      });
      return;
    }
    let alive = true;
    setIsLoadingTransferCandidates(true);
    void listKFServicerAssignments(openKFID)
      .then((assignments) => {
        if (!alive) return;
        const nextCandidates = buildTransferCandidates(assignments);
        transferCandidatesCacheRef.current.set(openKFID, nextCandidates);
        setTransferCandidates(nextCandidates);
        setSelectedTransferServicerID((prev) => {
          if (prev && nextCandidates.some((item) => item.servicerUserID === prev)) {
            return prev;
          }
          return nextCandidates[0]?.servicerUserID || "";
        });
      })
      .catch((error) => {
        if (!alive) return;
        setTransferCandidates([]);
        setSelectedTransferServicerID("");
        setNotice(normalizeErrorMessage(error));
      })
      .finally(() => {
        if (!alive) return;
        setIsLoadingTransferCandidates(false);
      });
    return () => {
      alive = false;
    };
  }, [isTransferModalOpen, selectedSession?.open_kfid]);

  const transferCandidatesFiltered = useMemo(() => {
    const query = transferSearch.trim().toLowerCase();
    if (!query) return transferCandidates;
    return transferCandidates.filter((item) => item.searchText.includes(query));
  }, [transferCandidates, transferSearch]);

  const poolCandidateCount = transferCandidates.length;

  const filteredSessions = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return sessions.filter((item) => {
      const bucket = resolveSessionBucket(item);
      if (activeTab !== bucket) return false;
      if (!q) return true;
      const joined =
        `${item.name || ""} ${item.last_message || ""} ${resolveChannelPresentation(item.source).label} ${item.source || ""}`.toLowerCase();
      return joined.includes(q);
    });
  }, [activeTab, channelDisplayMap, hasLoadedChannelDisplayMap, keyword, sessions]);

  const orderedMessages = useMemo(() => {
    return (detail?.messages || [])
      .map((message, index) => ({ message, index }))
      .sort((left, right) =>
        compareCommandCenterMessages(
          left.message,
          right.message,
          left.index,
          right.index,
        ),
      )
      .map((item) => item.message);
  }, [detail?.messages]);

  const queueCount = useMemo(
    () =>
      sessions.filter((item) => resolveSessionBucket(item) === "queue").length,
    [sessions],
  );
  const activeCount = useMemo(
    () =>
      sessions.filter((item) => resolveSessionBucket(item) === "active").length,
    [sessions],
  );
  const closedCount = useMemo(
    () =>
      sessions.filter((item) => resolveSessionBucket(item) === "closed").length,
    [sessions],
  );

  const runRealSessionTransition = async (input: {
    serviceState: 2 | 3 | 4;
    servicerUserID?: string;
    successMessage: string;
  }) => {
    if (!selectedSession?.open_kfid || !selectedSession?.external_userid) {
      setNotice("未选择有效会话");
      return false;
    }
    try {
      setIsSubmitting(true);
      await transitionKFServiceState({
        open_kfid: selectedSession.open_kfid,
        external_userid: selectedSession.external_userid,
        service_state: input.serviceState,
        servicer_userid: input.servicerUserID,
      });
      setNotice(input.successMessage);
      await Promise.all([
        loadView(),
        loadDetail(selectedSession.external_userid || ""),
      ]);
      return true;
    } catch (error) {
      setNotice(describeSessionActionError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpgrade = async () => {
    if (!selectedSession?.external_userid) {
      setNotice("未选择会话");
      return;
    }
    try {
      setIsSubmitting(true);
      const result = await executeContactSidebarCommand({
        command: "cs_upgrade_to_contact",
        external_userid: selectedSession.external_userid,
        payload: {
          assigned_userid: upgradeOwner,
          reason: upgradeReason,
          task_title: "客服中心升级跟进",
          note: upgradeTask,
          stars: upgradeStars,
          open_kfid: selectedSession.open_kfid,
          contact_name: selectedSession.name,
        },
      });
      setNotice((result?.message || "升级命令已提交").trim());
      setIsUpgradeModalOpen(false);
      if (result?.success) {
        setIsUpgradeSuccess(true);
        setTimeout(() => setIsUpgradeSuccess(false), 2500);
      }
      await loadView();
    } catch (error) {
      setNotice(normalizeErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActionClick = async (action: SessionActionDescriptor) => {
    switch (action.key) {
      case "send_to_queue": {
        setIsQueueModalOpen(true);
        return;
      }
      case "transfer_to_human": {
        setTransferSearch("");
        setIsTransferModalOpen(true);
        return;
      }
      case "end_session": {
        setIsEndModalOpen(true);
        return;
      }
      default:
        return;
    }
  };

  const activeMonitor = detail?.monitor || view?.monitor;
  const emotionCode = normalizeEmotionCode(
    activeMonitor?.emotion?.code || activeMonitor?.mood || "neutral",
  );
  const emotionPresentation = getEmotionPresentation(
    emotionCode,
    activeMonitor?.emotion?.score || 0,
  );
  const analysisStatus = (activeMonitor?.meta?.status || "idle")
    .trim()
    .toLowerCase();
  const summaryText = (
    activeMonitor?.summary_detail?.text ||
    activeMonitor?.summary ||
    "暂无会话摘要"
  ).trim();
  const complianceRisk =
    (activeMonitor?.compliance?.status || "").trim().toLowerCase() === "risk" ||
    activeMonitor?.compliance_pass === false;
  const assignedDisplayForHeader = resolveAssignedDisplay(selectedSession || undefined);
  const selectedSourcePresentation = resolveChannelPresentation(selectedSession?.source);
  const routingRecords = detail?.routing_records || [];
  const routingHistoryRecords = routingRecords.slice(0, 10);
  const visibleRoutingRecords = isRoutingHistoryExpanded
    ? routingHistoryRecords
    : routingHistoryRecords.slice(0, 3);
  const latestRoutingRecord = routingRecords[0];
  const latestMatchedRoutingRecord =
    routingRecords.find((item) => readRoutingRuleName(item) !== "") || latestRoutingRecord;
  const currentSessionMeta = detail?.session || selectedSession;
  const effectiveSessionState = Number(currentSessionMeta?.session_state || 0);
  const actionPanel = useMemo(() => {
    if (!currentSessionMeta) {
      return {
        title: "尚未选择会话",
        description: "请先从左侧选择一个客户会话，再执行人工流转操作。",
        primaryAction: null,
        secondaryActions: [],
      } satisfies SessionActionPanel;
    }
    const poolCandidateCount = isTransferModalOpen ? transferCandidates.length : null;
    return buildSessionActionPanel(effectiveSessionState, poolCandidateCount);
  }, [currentSessionMeta, effectiveSessionState, isTransferModalOpen, transferCandidates.length]);
  const queueWaitText = readLiveQueueWaitText(
    currentSessionMeta,
    detail?.session ? detailFetchedAtMs : viewFetchedAtMs,
    nowMs,
  );
  const slaStatusToken = ((selectedSession?.reply_sla_status || "normal").trim() || "normal").toLowerCase();
  const slaBadgeLabel =
    selectedSession?.reply_overdue === true || selectedSession?.overdue === true
      ? "超时"
      : slaStatusToken === "warning"
        ? "预警"
        : "";
  const sessionStatus = resolveSessionStatusPresentation(currentSessionMeta);
  const actionButtons = buildFlatSessionActions(
    effectiveSessionState,
    transferCandidates.length,
    isTransferModalOpen,
  );

  return (
    <div className="flex h-full gap-5">
      <div className="w-[332px] shrink-0 flex flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            微信客服中心
          </h2>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as SessionTab)}
          >
            <TabsList className="w-full grid grid-cols-3 bg-white border border-gray-200">
              <TabsTrigger
                value="queue"
                className="data-[state=active]:bg-red-50 data-[state=active]:text-red-700"
              >
                排队中 ({queueCount})
              </TabsTrigger>
              <TabsTrigger
                value="active"
                className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
              >
                接待中 ({activeCount})
              </TabsTrigger>
              <TabsTrigger value="closed">已结束 ({closedCount})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="p-3 border-b border-gray-100 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索客户昵称或消息内容..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {notice ? (
            <div className="text-[11px] text-blue-600">{notice}</div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {filteredSessions.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">当前筛选下暂无会话</div>
          ) : (
            filteredSessions.map((session) => {
              const selected =
                (session.external_userid || "").trim() ===
                (selectedSession?.external_userid || "").trim();
              const bucket = resolveSessionBucket(session);
              const queueWaitText = readLiveQueueWaitText(session, viewFetchedAtMs, nowMs);
              const replyOverdue =
                session.reply_overdue === true || session.overdue === true;
              const slaStatus = (session.reply_sla_status || "")
                .trim()
                .toLowerCase();
              const assignedDisplay = resolveAssignedDisplay(session);
              const sessionStatus = resolveSessionStatusPresentation(session);
              return (
                <div
                  key={(
                    session.external_userid ||
                    session.name ||
                    "session"
                  ).trim()}
                  className={`p-4 cursor-pointer transition-colors ${selected ? "bg-blue-50/50 border-l-4 border-blue-600" : "hover:bg-gray-50"}`}
                  onClick={() =>
                    setSelectedExternalUserID(
                      (session.external_userid || "").trim(),
                    )
                  }
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Avatar src="" size="sm" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">
                          {(session.name || "未命名客户").trim()}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
              {(() => {
                const sourcePresentation = resolveChannelPresentation(session.source);
                return (
                          <Badge
                            className="max-w-[120px] truncate text-[9px] px-1 py-0 bg-blue-100 text-blue-600 border-none"
                            title={sourcePresentation.title || sourcePresentation.label}
                          >
                            {sourcePresentation.label}
                          </Badge>
                );
              })()}
                          <Badge className={`text-[9px] px-1 py-0 border-none ${sessionStatus.badgeClassName}`}>
                            {sessionStatus.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {replyOverdue ? (
                        <div className="flex items-center text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                          <AlertCircle className="w-3 h-3 mr-1" /> 超时告警
                        </div>
                      ) : bucket === "queue" ? (
                        <div
                          className={`flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${slaStatus === "warning" ? "text-amber-700 bg-amber-100" : "text-orange-600 bg-orange-100"}`}
                        >
                          <Clock className="w-3 h-3 mr-1" /> 排队{" "}
                          {queueWaitText || "-"}
                        </div>
                      ) : (
                        <div className="flex items-center text-[10px] font-medium text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                          <Clock className="w-3 h-3 mr-1" />{" "}
                          {session.unread_count || 0} 未读
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-1 mb-2">
                    {(session.last_message || "暂无消息").trim()}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-3 h-3" />{" "}
                      {assignedDisplay.displayUserID ? (
                        <span title={assignedDisplay.rawID || assignedDisplay.displayFallback}>
                            <WecomOpenDataName
                              userid={assignedDisplay.displayUserID}
                              corpId={corpID}
                              fallback={assignedDisplay.displayFallback}
                              className="truncate text-[10px] text-gray-700"
                            />
                        </span>
                      ) : assignedDisplay.displayFallback ? (
                        <span
                          className="truncate text-[10px] text-gray-700"
                          title={assignedDisplay.rawID || assignedDisplay.displayFallback}
                        >
                          {assignedDisplay.displayFallback}
                        </span>
                      ) : (
                        "待分配"
                      )}
                    </span>
                    <span>
                      {(session.last_active || "")
                        .replace("T", " ")
                        .slice(0, 16)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 flex min-w-0 flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-white shrink-0">
          <div className="min-h-[72px] px-6 py-4 flex items-center gap-4">
            <div className="min-w-0 flex items-center gap-4">
              <h3 className="truncate text-lg font-semibold text-gray-900">
                {(selectedSession?.name || "未选择会话").trim()}
              </h3>
              <Badge
                className={sessionStatus.badgeClassName}
              >
                {sessionStatus.label}
              </Badge>
              <span className="min-w-0 text-sm text-gray-500 border-l border-gray-200 pl-4">
                接待人：
                {assignedDisplayForHeader.displayUserID ? (
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <WecomOpenDataName
                      userid={assignedDisplayForHeader.displayUserID}
                      corpId={corpID}
                      fallback={assignedDisplayForHeader.displayFallback}
                      className="text-sm text-gray-700"
                    />
                  </span>
                ) : assignedDisplayForHeader.displayFallback ? (
                  <span className="inline-flex items-center gap-2 text-sm text-gray-700">
                    {assignedDisplayForHeader.displayFallback}
                  </span>
                ) : (
                  "待分配"
                )}
              </span>
            </div>
          </div>

          <div className="px-6 py-2 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="font-medium">来源渠道:</span>
              <span
                className="text-gray-900"
                title={selectedSourcePresentation.title || undefined}
              >
                {selectedSourcePresentation.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="font-medium">匹配路由:</span>
              {readRoutingRuleName(latestMatchedRoutingRecord) ? (
                <Link
                  to={readRoutingRuleLink(latestMatchedRoutingRecord)}
                  className="text-blue-600 hover:underline"
                >
                  {readRoutingRuleName(latestMatchedRoutingRecord)}
                </Link>
              ) : (
                <span className="text-gray-900">-</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="font-medium">当前状态:</span>
              <span className="text-gray-900">
                {(latestRoutingRecord?.details?.result_state_label || sessionStatus.label || "-").trim()}
              </span>
            </div>
            {slaBadgeLabel ? (
              <div className="ml-auto flex items-center gap-1.5 text-gray-500">
                <span className="font-medium">告警:</span>
                <Badge className="bg-red-100 text-red-700 border-none text-[10px] px-1.5 py-0">
                  {slaBadgeLabel}
                </Badge>
              </div>
            ) : null}
            {queueWaitText ? (
              <div className="flex items-center gap-1.5 text-gray-500">
                <span className="font-medium">排队:</span>
                <span className="text-gray-900">{queueWaitText}</span>
              </div>
            ) : null}
            {isUpgradeSuccess ? (
              <div className="flex items-center gap-1.5 text-gray-500">
                <span className="font-medium">客户升级:</span>
                <Badge className="bg-green-100 text-green-700 border-none text-[10px] px-1.5 py-0">
                  已升级
                </Badge>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto bg-[#F5F7FA] p-6">
              <div className="flex flex-col gap-6">
                {orderedMessages.length === 0 ? (
                  <div className="text-sm text-gray-500">暂无会话消息</div>
                ) : (
                  orderedMessages.map((message) => {
                    const outgoing = (message.sender || "").trim() !== "customer";
                    return (
                      <div
                        key={
                          message.id || `${message.timestamp}-${message.content}`
                        }
                        className={`flex items-start gap-3 ${outgoing ? "flex-row-reverse" : ""}`}
                      >
                        {outgoing ? (
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-blue-600">
                              AI
                            </span>
                          </div>
                        ) : (
                          <Avatar src="" size="sm" />
                        )}
                        <div
                          className={`px-4 py-2.5 max-w-[70%] shadow-sm rounded-2xl ${
                            outgoing
                              ? "bg-blue-600 text-white rounded-tr-none"
                              : "bg-white border border-gray-200 text-gray-800 rounded-tl-none"
                          }`}
                        >
                          <p className="text-sm">
                            {(message.content || "").trim()}
                          </p>
                          <p
                            className={`mt-1 text-[10px] ${outgoing ? "text-blue-100" : "text-gray-400"}`}
                          >
                            {(message.timestamp || "")
                              .replace("T", " ")
                              .slice(0, 16)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4">
              {selectedSession ? (
                <div className="mb-3 flex items-center justify-between gap-3 text-[11px]">
                  <div className="min-w-0 text-gray-500">
                    {actionPanel.description}
                  </div>
                  <div className="shrink-0 font-medium text-gray-900">
                    {sessionStatus.label}
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-3">
                {actionButtons.map((action) => (
                  <Button
                    key={action.key}
                    variant={action.tone === "primary" ? undefined : "outline"}
                    className={`h-9 w-full ${resolveActionButtonClassName(action)}`}
                    disabled={isSubmitting || action.disabled}
                    onClick={() => void handleActionClick(action)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>

              {actionPanel.emptyHint ? (
                <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
                  {actionPanel.emptyHint}
                </div>
              ) : null}
              {readActionDisabledMessage(actionPanel) ? (
                <div className="mt-3 text-[11px] leading-relaxed text-gray-500">
                  {readActionDisabledMessage(actionPanel)}
                </div>
              ) : null}
            </div>
          </div>

          <div className="w-[320px] shrink-0 border-l border-gray-200 bg-white">
            <Tabs
              value={detailPanelTab}
              onValueChange={(value) => setDetailPanelTab(value as DetailPanelTab)}
              className="flex h-full min-h-0 flex-col"
            >
              <div className="border-b border-gray-100 px-3 py-3">
                <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
                  <TabsTrigger
                    value="monitor"
                    className="h-auto flex-col gap-1 rounded-lg px-2 py-2 text-[11px] text-gray-500 data-[state=active]:bg-white data-[state=active]:text-blue-700"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    <span>AI 实时监控</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="upgrade"
                    className="h-auto flex-col gap-1 rounded-lg px-2 py-2 text-[11px] text-gray-500 data-[state=active]:bg-white data-[state=active]:text-blue-700"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>客户升级</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="session"
                    className="h-auto flex-col gap-1 rounded-lg px-2 py-2 text-[11px] text-gray-500 data-[state=active]:bg-white data-[state=active]:text-blue-700"
                  >
                    <GitBranch className="h-4 w-4" />
                    <span>来源与路由</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="monitor" className="mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
                <div className="space-y-6">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs text-gray-500">客户情绪</div>
                      {analysisStatus === "running" || analysisStatus === "queued" ? (
                        <Badge className="bg-blue-100 text-blue-700 border-none text-[10px] px-1.5 py-0">
                          进行中
                        </Badge>
                      ) : analysisStatus === "failed" ? (
                        <Badge className="bg-red-100 text-red-700 border-none text-[10px] px-1.5 py-0">
                          分析失败
                        </Badge>
                      ) : analysisStatus === "succeeded" ? (
                        <Badge className="bg-green-100 text-green-700 border-none text-[10px] px-1.5 py-0">
                          最近已完成
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600 border-none text-[10px] px-1.5 py-0">
                          未启动
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{emotionPresentation.emoji}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full ${emotionPresentation.barClass}`}
                          style={{ width: `${emotionPresentation.width}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${emotionPresentation.textClass}`}>
                        {activeMonitor?.emotion?.label?.trim() || "中性"}
                      </span>
                    </div>
                    {activeMonitor?.emotion?.reason ? (
                      <div className="mt-2 text-[11px] leading-relaxed text-gray-500">
                        {activeMonitor.emotion.reason.trim()}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <div className="mb-2 text-xs text-gray-500">会话摘要</div>
                    <div className="rounded-md border border-gray-100 bg-gray-50 p-3 text-sm leading-relaxed text-gray-700">
                      {summaryText}
                    </div>
                    {activeMonitor?.summary_detail?.customer_intent ||
                    activeMonitor?.summary_detail?.suggested_focus ? (
                      <div className="mt-2 space-y-1 text-[11px] text-gray-500">
                        {activeMonitor?.summary_detail?.customer_intent ? (
                          <div>
                            客户诉求：
                            {activeMonitor.summary_detail.customer_intent.trim()}
                          </div>
                        ) : null}
                        {activeMonitor?.summary_detail?.priority ? (
                          <div>
                            优先级：{activeMonitor.summary_detail.priority.trim()}
                          </div>
                        ) : null}
                        {activeMonitor?.summary_detail?.suggested_focus ? (
                          <div>
                            跟进重点：
                            {activeMonitor.summary_detail.suggested_focus.trim()}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <div className="mb-2 text-xs text-gray-500">合规质检</div>
                    {complianceRisk ? (
                      <div className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50 p-2 text-sm text-red-600">
                        <AlertTriangle className="h-4 w-4" /> 检测到潜在风险话术
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-md border border-green-100 bg-green-50 p-2 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" /> 未发现违规话术
                      </div>
                    )}
                    {activeMonitor?.compliance?.reason ? (
                      <div className="mt-2 text-[11px] leading-relaxed text-gray-500">
                        {activeMonitor.compliance.reason.trim()}
                      </div>
                    ) : null}
                    {activeMonitor?.compliance?.risk_tags &&
                    activeMonitor.compliance.risk_tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {activeMonitor.compliance.risk_tags.map((tag) => (
                          <Badge
                            key={tag}
                            className="bg-amber-100 text-amber-700 border-none text-[10px] px-1.5 py-0"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {activeMonitor?.compliance?.recommended_action ? (
                      <div className="mt-2 text-[11px] text-gray-500">
                        建议动作：
                        {activeMonitor.compliance.recommended_action.trim()}
                      </div>
                    ) : null}
                  </div>
                </div>

              </TabsContent>

              <TabsContent value="upgrade" className="mt-0 flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">客户升级</div>
                    <div className="mt-1 text-xs text-gray-500">进入客户联系流程</div>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-4">
                    <Button
                      className="w-full bg-blue-600 text-xs hover:bg-blue-700"
                      onClick={() => setIsUpgradeModalOpen(true)}
                    >
                      升级为客户
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="session" className="mt-0 flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-6">
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Info className="h-4 w-4 text-blue-600" /> 会话来源
                    </div>
                    <div className="space-y-2 border-b border-gray-100 pb-1">
                      <SessionEntryContextRow
                        label="场景"
                        value={(detail?.entry_context?.scene || "").trim()}
                      />
                      <SessionEntryContextRow
                        label="场景参数"
                        value={(detail?.entry_context?.scene_param || "").trim()}
                      />
                      <SessionEntryContextRow
                        label="来源昵称"
                        value={(detail?.entry_context?.wechat_channels_nickname || "").trim()}
                      />
                      <SessionEntryContextRow
                        label="欢迎码"
                        value={(detail?.entry_context?.welcome_code || "").trim()}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <GitBranch className="h-4 w-4 text-blue-600" /> 路由历史
                    </div>
                    <div className="divide-y divide-gray-100">
                      {routingHistoryRecords.length > 0 ? (
                        visibleRoutingRecords.map((record, index) => (
                          <div
                            key={`${record.occurred_at || ""}-${record.actor_userid || record.actor_label || ""}-${index}`}
                            className="py-2.5"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-11 shrink-0 pt-0.5 text-[11px] font-medium text-gray-400">
                                {formatRoutingEventTime(record.occurred_at)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm leading-6 text-gray-900">
                                  {record.actor_type === "system" ? (
                                    <span className="font-medium">系统</span>
                                  ) : record.actor_type === "customer" ? (
                                    <span className="font-medium text-gray-900">
                                      {(record.actor_label || "买家").trim()}
                                    </span>
                                  ) : (
                                    renderRoutingIdentity({
                                      userid: record.actor_userid,
                                      fallback: record.actor_label,
                                      corpId: corpID,
                                      identityLookup: sessionServicerLookup,
                                    })
                                  )}
                                  <span className="mx-1.5">
                                    {readRoutingActionHeadline(record)}
                                  </span>
                                  {(record.target_label || "").trim() ? (
                                    renderRoutingIdentity({
                                      userid: record.target_userid,
                                      fallback: record.target_label,
                                      corpId: corpID,
                                      identityLookup: sessionServicerLookup,
                                    })
                                  ) : null}
                                </div>
                                {readRoutingRuleName(record) ? (
                                  <div className="mt-0.5">
                                    <Link
                                      to={readRoutingRuleLink(record)}
                                      className="text-xs text-blue-600 hover:underline"
                                    >
                                      匹配路由：{readRoutingRuleName(record)}
                                    </Link>
                                  </div>
                                ) : null}
                                {hasRoutingRecordDetails(record) ? (
                                  <details className="mt-1 text-[11px] text-gray-500">
                                    <summary className="cursor-pointer list-none select-none text-gray-400 hover:text-gray-600">
                                      查看详情
                                    </summary>
                                    <div className="mt-2 space-y-2 border-l border-gray-100 pl-3">
                                      <SessionEntryContextRow
                                        label="触发来源"
                                        value={(record.details?.trigger_label || "-").trim()}
                                      />
                                      {(record.details?.rule_name || "").trim() ? (
                                        <SessionEntryContextRow
                                          label="命中规则"
                                          value={(record.details?.rule_name || "").trim()}
                                        />
                                      ) : null}
                                      <SessionEntryContextRow
                                        label="执行结果"
                                        value={(record.details?.execution_result_label || "-").trim()}
                                      />
                                      <SessionEntryContextRow
                                        label="当前状态"
                                        value={(record.details?.result_state_label || "-").trim()}
                                      />
                                      {(record.details?.target_label || "").trim() ? (
                                        <SessionEntryContextRow
                                          label="当前目标"
                                          value={renderRoutingIdentity({
                                            userid: record.details?.target_userid,
                                            fallback: record.details?.target_label,
                                            corpId: corpID,
                                            identityLookup: sessionServicerLookup,
                                          })}
                                        />
                                      ) : null}
                                      {shouldShowRoutingReason(record) ? (
                                        <SessionEntryContextRow
                                          label="说明"
                                          value={(record.details?.reason_summary || "").trim()}
                                        />
                                      ) : null}
                                      {(record.details?.dispatch_strategy_label || "").trim() ? (
                                        <SessionEntryContextRow
                                          label="分配策略"
                                          value={(record.details?.dispatch_strategy_label || "").trim()}
                                        />
                                      ) : null}
                                      {(record.details?.action_boundary_label || "").trim() ? (
                                        <SessionEntryContextRow
                                          label="动作边界"
                                          value={(record.details?.action_boundary_label || "").trim()}
                                        />
                                      ) : null}
                                      {(record.details?.trace_id || "").trim() ? (
                                        <SessionEntryContextRow
                                          label="追踪 ID"
                                          value={(record.details?.trace_id || "").trim()}
                                        />
                                      ) : null}
                                      {(record.details?.target_raw_servicer_userid || "").trim() ? (
                                        <SessionEntryContextRow
                                          label="原始目标 ID"
                                          value={(record.details?.target_raw_servicer_userid || "").trim()}
                                        />
                                      ) : null}
                                    </div>
                                  </details>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-2.5 text-xs text-gray-500">暂无主要 routing 变动</div>
                      )}
                    </div>
                    {routingHistoryRecords.length > 3 ? (
                      <button
                        type="button"
                        className="mt-2 text-[11px] font-medium text-blue-600 hover:underline"
                        onClick={() => setIsRoutingHistoryExpanded((value) => !value)}
                      >
                        {isRoutingHistoryExpanded
                          ? "收起"
                          : `更多 (${routingHistoryRecords.length - visibleRoutingRecords.length})`}
                      </button>
                    ) : null}
                    <Link
                      to="/main/routing-rules"
                      className="mt-3 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                    >
                      前往调整路由规则 <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <Dialog
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            升级为客户联系
          </div>
        }
        className="max-w-[520px]"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setIsUpgradeModalOpen(false)}
            >
              取消
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting}
              onClick={() => void handleUpgrade()}
            >
              确认升级并创建任务
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed">
              升级后将自动生成客户档案和跟进任务，当前为内部命令链路执行。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                负责人
              </label>
              <input
                value={upgradeOwner}
                onChange={(event) => setUpgradeOwner(event.target.value)}
                className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                意向等级
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 cursor-pointer ${i <= upgradeStars ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`}
                    onClick={() => setUpgradeStars(i)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              升级原因
            </label>
            <input
              value={upgradeReason}
              onChange={(event) => setUpgradeReason(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              下一步任务
            </label>
            <Textarea
              className="text-sm min-h-[80px]"
              value={upgradeTask}
              onChange={(event) => setUpgradeTask(event.target.value)}
              placeholder="请输入需要负责人执行的具体任务"
            />
          </div>
        </div>
      </Dialog>

      {isUpgradeSuccess ? (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">
            升级成功！已同步至客户中心并创建跟进任务。
          </span>
        </div>
      ) : null}

      <Dialog
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="转给指定人工"
        className="max-w-[640px]"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setIsTransferModalOpen(false);
                setTransferSearch("");
              }}
            >
              取消
            </Button>
            <Button
              className="bg-blue-600"
              disabled={isSubmitting || !selectedTransferServicerID}
              onClick={async () => {
                const succeeded = await runRealSessionTransition({
                  serviceState: 3,
                  servicerUserID: selectedTransferServicerID,
                  successMessage: "会话已转给指定人工。",
                });
                if (succeeded) {
                  setIsTransferModalOpen(false);
                  setTransferSearch("");
                }
              }}
            >
              确认转给该人工
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-xs leading-relaxed text-blue-800">
            只能从当前接待池中选择一个人工接待人员。确认后会发起企业微信真实转接，不再使用本地投影命令。
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">选择接待人员</label>
            <input
              type="text"
              value={transferSearch}
              onChange={(event) => setTransferSearch(event.target.value)}
              placeholder="搜索当前接待池中的人工"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-3 py-2 text-xs text-gray-500">
              {isLoadingTransferCandidates
                ? "正在加载当前接待池内的人工..."
                : `当前可转接人工 ${poolCandidateCount} 人`}
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {isLoadingTransferCandidates ? (
                <div className="px-4 py-10 text-sm text-gray-500">正在加载可选接待人员...</div>
              ) : transferCandidatesFiltered.length === 0 ? (
                <div className="px-4 py-10 text-sm text-gray-500">
                  {poolCandidateCount > 0 ? "没有匹配的接待人员" : "当前接待池没有可转接人工"}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {transferCandidatesFiltered.map((candidate) => {
                    const selected = candidate.servicerUserID === selectedTransferServicerID;
                    return (
                      <button
                        key={candidate.servicerUserID}
                        type="button"
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${selected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                        onClick={() => setSelectedTransferServicerID(candidate.servicerUserID)}
                      >
                        <div className={`mt-1 h-4 w-4 rounded-full border ${selected ? "border-blue-600 bg-blue-600" : "border-gray-300 bg-white"}`} />
                        <div className="min-w-0 flex-1">
                          <WecomOpenDataName
                            userid={candidate.displayUserID}
                            corpId={corpID}
                            fallback={candidate.displayFallback}
                            className="truncate text-sm font-medium text-gray-900"
                          />
                          <div className="mt-1 text-xs text-gray-500">
                            {(candidate.role || "接待池成员").trim()}
                          </div>
                          {candidate.rawID ? (
                            <div
                              className="mt-1 text-[11px] text-gray-400"
                              title={candidate.rawID}
                            >
                              ID:{candidate.rawID}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={isQueueModalOpen}
        onClose={() => setIsQueueModalOpen(false)}
        title="送入待接入池"
        className="max-w-[420px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsQueueModalOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSubmitting}
              onClick={async () => {
                const succeeded = await runRealSessionTransition({
                  serviceState: 2,
                  successMessage: "会话已送入待接入池。",
                });
                if (succeeded) {
                  setIsQueueModalOpen(false);
                }
              }}
            >
              确认送入待接入池
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-gray-600">
            该操作会把当前会话送入企业微信待接入池，等待人工继续接入。
          </p>
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-700">
            适用于当前需要人工接入，但暂时不指定具体接待人员的场景。
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={isEndModalOpen}
        onClose={() => setIsEndModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            结束会话
          </div>
        }
        className="max-w-[400px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsEndModalOpen(false)}>
              暂不结束
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isSubmitting}
              onClick={async () => {
                const succeeded = await runRealSessionTransition({
                  serviceState: 4,
                  successMessage: "会话已结束。",
                });
                if (succeeded) {
                  setIsEndModalOpen(false);
                }
              }}
            >
              确认结束会话
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          该操作会执行企业微信真实结束会话动作。结束后当前会话不会继续处于人工接待中。
        </p>
      </Dialog>
    </div>
  );
}

function normalizeEmotionCode(value?: string):
  | "stable"
  | "neutral"
  | "positive"
  | "anxious"
  | "angry"
  | "negative" {
  const normalized = (value || "").trim().toLowerCase();
  switch (normalized) {
    case "stable":
    case "neutral":
    case "positive":
    case "anxious":
    case "angry":
    case "negative":
      return normalized;
    default:
      return "neutral";
  }
}

function buildTransferCandidates(assignments: KFServicerAssignment[]): TransferCandidate[] {
  const deduped = new Map<string, TransferCandidate>();
  for (const assignment of assignments || []) {
    const identity = resolveServicerIdentityView(assignment);
    const servicerUserID = identity.rawServicerUserID;
    if (!servicerUserID) continue;
    const userid = identity.resolvedUserID;
    const openUserID = identity.resolvedOpenUserID;
    const role = (assignment.role || "").trim();
    const displayUserID = identity.displayIdentity;
    const displayFallback = identity.displayFallback;
    const searchText = `${displayFallback} ${servicerUserID} ${userid} ${openUserID} ${role}`.toLowerCase();
    deduped.set(servicerUserID, {
      servicerUserID,
      userid,
      openUserID,
      role,
      displayUserID,
      displayFallback,
      rawID: servicerUserID,
      searchText,
    });
  }
  return Array.from(deduped.values()).sort((left, right) =>
    left.displayFallback.localeCompare(right.displayFallback, "zh-CN"),
  );
}

function buildSessionActionPanel(
  sessionState: number,
  poolCandidateCount: number | null,
): SessionActionPanel {
  const hasKnownCandidates = poolCandidateCount !== null;
  const hasHumanCandidates = poolCandidateCount === null || poolCandidateCount > 0;
  const transferAction: SessionActionDescriptor = {
    key: "transfer_to_human",
    label: "转给指定人工",
    description: "从当前接待池中选择一个人工接待人员",
    tone: "primary",
    disabled: !hasHumanCandidates,
    disabledReason:
      hasHumanCandidates || !hasKnownCandidates ? "" : "当前接待池没有可转接人工",
  };
  const queueAction: SessionActionDescriptor = {
    key: "send_to_queue",
    label: "送入待接入池",
    description: "送回企业微信待接入池，等待人工继续接入",
    tone: "secondary",
  };
  const endAction: SessionActionDescriptor = {
    key: "end_session",
    label: "结束会话",
    description: "结束当前会话，不再继续人工接待",
    tone: "danger",
  };

  switch (sessionState) {
    case 0:
      return {
        title: "当前会话尚未进入人工处理",
        description: "可以先送入待接入池，也可以直接转给当前接待池中的人工。",
        primaryAction: queueAction,
        secondaryActions: [transferAction],
        emptyHint: !hasKnownCandidates || hasHumanCandidates
          ? ""
          : "当前接待池没有可选人工，建议先送入待接入池。",
      };
    case 1:
      return {
        title: "当前由智能助手接待",
        description: "需要人工介入时，可直接转给指定人工，或先送入待接入池。",
        primaryAction: transferAction,
        secondaryActions: [queueAction],
        emptyHint: !hasKnownCandidates || hasHumanCandidates
          ? ""
          : "当前接待池没有可选人工，只能先送入待接入池。",
      };
    case 2:
      return {
        title: "当前在待接入池排队中",
        description: "可从当前接待池中指定人工，立即转入人工接待。",
        primaryAction: transferAction,
        secondaryActions: [],
        emptyHint:
          !hasKnownCandidates || hasHumanCandidates
            ? ""
            : "当前接待池没有可转接人工。",
      };
    case 3:
      return {
        title: "当前由人工接待",
        description: "可继续转给其他人工，或直接结束会话。",
        primaryAction: transferAction,
        secondaryActions: [endAction],
        emptyHint:
          !hasKnownCandidates || hasHumanCandidates
            ? ""
            : "当前接待池没有其他可转接人工。",
      };
    case 4:
      return {
        title: "当前会话已结束",
        description: "已结束会话不再提供后台流转动作。如需重新接入，请在企业微信客户端中执行。",
        primaryAction: null,
        secondaryActions: [],
      };
    default:
      return {
        title: "当前会话状态未识别",
        description: "建议先等待状态同步完成，再执行人工流转操作。",
        primaryAction: null,
        secondaryActions: [],
      };
  }
}

function buildFlatSessionActions(
  sessionState: number,
  poolCandidateCount: number,
  hasLoadedCandidates: boolean,
): SessionActionDescriptor[] {
  const canTransfer = !hasLoadedCandidates || poolCandidateCount > 0;
  const transferAction: SessionActionDescriptor = {
    key: "transfer_to_human",
    label: "转给指定人工",
    description: "从当前接待池中选择一个人工接待人员",
    tone: "primary",
    disabled: sessionState === 4 || !canTransfer,
    disabledReason:
      sessionState === 4
        ? "当前会话已结束"
        : canTransfer
          ? ""
          : "当前接待池没有可转接人工",
  };
  const queueAction: SessionActionDescriptor = {
    key: "send_to_queue",
    label: "送入待接入池",
    description: "送回企业微信待接入池，等待人工继续接入",
    tone: "secondary",
    disabled: sessionState === 2 || sessionState === 4,
    disabledReason:
      sessionState === 2 ? "当前已在待接入池中" : sessionState === 4 ? "当前会话已结束" : "",
  };
  const endAction: SessionActionDescriptor = {
    key: "end_session",
    label: "结束会话",
    description: "结束当前会话，不再继续人工接待",
    tone: "danger",
    disabled: sessionState !== 3,
    disabledReason:
      sessionState === 4 ? "当前会话已结束" : sessionState === 3 ? "" : "当前状态不支持直接结束会话",
  };
  if (sessionState === 3) {
    queueAction.disabled = true;
    queueAction.disabledReason = "人工接待中的会话不能再送入待接入池";
  }
  return [transferAction, queueAction, endAction];
}

function resolveActionButtonClassName(action: SessionActionDescriptor): string {
  if (action.tone === "primary") {
    return "bg-blue-600 text-white hover:bg-blue-700";
  }
  if (action.tone === "danger") {
    return "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700";
  }
  return "border-gray-200 text-gray-700 hover:bg-gray-100";
}

function readActionDisabledMessage(panel: SessionActionPanel): string {
  if (panel.primaryAction?.disabledReason) return panel.primaryAction.disabledReason;
  const disabledSecondary = panel.secondaryActions.find((item) => item.disabledReason);
  return disabledSecondary?.disabledReason || "";
}

function SessionEntryContextRow(props: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-gray-500 shrink-0">{props.label}</span>
      <span className="text-xs text-right text-gray-900 break-all">
        {props.value || "-"}
      </span>
    </div>
  );
}

function describeSessionActionError(error: unknown): string {
  const message = normalizeErrorMessage(error);
  const lower = message.toLowerCase();
  if (lower.includes("60011")) {
    return "企业微信暂不允许执行该流转，请先确认当前接待池、会话状态和目标接待人员。";
  }
  if (lower.includes("servicer_userid")) {
    return "当前转接缺少有效接待人员，请重新选择接待池中的人工。";
  }
  if (lower.includes("service state")) {
    return "当前会话状态暂不支持该操作，请稍后刷新后重试。";
  }
  return message;
}

function getEmotionPresentation(
  code: ReturnType<typeof normalizeEmotionCode>,
  score: number,
) {
  const clampedScore = Number.isFinite(score)
    ? Math.max(0, Math.min(1, score))
    : 0;
  const baseWidth = Math.round(clampedScore * 100);
  switch (code) {
    case "stable":
      return {
        emoji: "🙂",
        textClass: "text-emerald-600",
        barClass: "bg-emerald-500",
        width: Math.max(baseWidth, 28),
      };
    case "positive":
      return {
        emoji: "😊",
        textClass: "text-green-600",
        barClass: "bg-green-500",
        width: Math.max(baseWidth, 36),
      };
    case "anxious":
      return {
        emoji: "😟",
        textClass: "text-amber-600",
        barClass: "bg-amber-500",
        width: Math.max(baseWidth, 58),
      };
    case "angry":
      return {
        emoji: "😠",
        textClass: "text-red-600",
        barClass: "bg-red-500",
        width: Math.max(baseWidth, 72),
      };
    case "negative":
      return {
        emoji: "☹️",
        textClass: "text-orange-600",
        barClass: "bg-orange-500",
        width: Math.max(baseWidth, 64),
      };
    case "neutral":
    default:
      return {
        emoji: "😐",
        textClass: "text-slate-600",
        barClass: "bg-slate-400",
        width: Math.max(baseWidth, 46),
      };
  }
}

function compareCommandCenterMessages(
  left: CommandCenterMessage,
  right: CommandCenterMessage,
  leftIndex: number,
  rightIndex: number,
): number {
  const primary = compareTimeStrings(left.timestamp, right.timestamp);
  if (primary !== 0) return primary;

  const secondary = compareTimeStrings(
    left.delivered_at || left.last_attempt_at || left.next_retry_at || "",
    right.delivered_at || right.last_attempt_at || right.next_retry_at || "",
  );
  if (secondary !== 0) return secondary;

  return leftIndex - rightIndex;
}

function compareTimeStrings(left?: string, right?: string): number {
  const leftMs = Date.parse((left || "").trim());
  const rightMs = Date.parse((right || "").trim());
  const leftValid = Number.isFinite(leftMs);
  const rightValid = Number.isFinite(rightMs);
  if (leftValid && rightValid && leftMs !== rightMs) {
    return leftMs - rightMs;
  }
  if (leftValid !== rightValid) {
    return leftValid ? -1 : 1;
  }
  return 0;
}
