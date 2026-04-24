import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { WecomOpenDataName } from "@/components/wecom/WecomOpenDataName";
import { normalizeErrorMessage } from "@/services/http";
import {
  listKFCustomerSessions,
  type KFCustomerSessionCandidate,
} from "@/services/commandCenterService";
import {
  checkSidebarJSSDKApis,
  getJSSDKRuntimeDiagnosticsSnapshot,
  inspectSidebarJSSDKContext,
  openWecomKfConversation,
  resetJSSDKRuntimeCaches,
  runJSSDKRegistrationDiagnostics,
  sendTextToCurrentSession,
  toJSSDKErrorMessage,
  type JSSDKContextInspection,
  type JSSDKRegistrationSnapshot,
  type JSSDKRuntimeDiagnosticsSnapshot,
} from "@/services/jssdkService";
import {
  ensureOpenDataReady,
  type OpenDataRuntime,
} from "@/services/openDataService";
import {
  listReceptionChannels,
  type ReceptionChannel,
} from "@/services/receptionService";
import {
  sidebarBody,
  sidebarPageShell,
} from "./sidebarChrome";
import {
  ArrowLeft,
  Bot,
  MessageSquareText,
  RefreshCcw,
  Send,
  ShieldCheck,
  UserRound,
  Waypoints,
} from "lucide-react";

type ToolbarDebugViewProps = {
  onBack: () => void;
  openKFID?: string;
  externalUserID?: string;
  sessionCandidates?: ToolbarDebugSessionCandidate[];
  sampleOpenDataUserID?: string;
  sampleOpenDataFallback?: string;
};

type ToolbarDebugSessionCandidate = {
  open_kfid?: string;
  external_userid?: string;
  contact_name?: string;
  session_status_code?: string;
  channel_token?: string;
  last_active?: string;
  last_message?: string;
};

type NavigateChannelOption = {
  openKFID: string;
  label: string;
  source: "current" | "channel" | "candidate";
};

type NavigateCustomerOption = {
  openKFID: string;
  externalUserID: string;
  label: string;
  sessionStatus?: string;
  lastActive?: string;
  lastMessage?: string;
};

type DebugBadgeVariant = "success" | "warning" | "secondary";
type DebugTone = "blue" | "violet" | "emerald" | "cyan" | "sky" | "indigo" | "red";

const debugToneStyles: Record<
  DebugTone,
  { icon: string; bar: string }
> = {
  blue: {
    icon: "bg-blue-50 text-blue-600 ring-blue-100",
    bar: "bg-[#0052D9]",
  },
  violet: {
    icon: "bg-violet-50 text-violet-600 ring-violet-100",
    bar: "bg-violet-500",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    bar: "bg-emerald-500",
  },
  cyan: {
    icon: "bg-cyan-50 text-cyan-600 ring-cyan-100",
    bar: "bg-cyan-500",
  },
  sky: {
    icon: "bg-sky-50 text-sky-600 ring-sky-100",
    bar: "bg-sky-500",
  },
  indigo: {
    icon: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    bar: "bg-indigo-500",
  },
  red: {
    icon: "bg-red-50 text-red-600 ring-red-100",
    bar: "bg-red-500",
  },
};

function prettyJSON(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function renderStatusBadge(
  ok: boolean | undefined,
  pendingText = "未执行",
): { text: string; variant: DebugBadgeVariant } {
  if (ok === true) return { text: "正常", variant: "success" };
  if (ok === false) return { text: "异常", variant: "warning" };
  return { text: pendingText, variant: "secondary" };
}

function runtimeStateBadge(
  state?: string,
): { text: string; variant: DebugBadgeVariant } {
  switch ((state || "").trim()) {
    case "wecom_bridge_ready":
      return { text: "Bridge 已就绪", variant: "success" };
    case "wecom_bridge_missing":
      return { text: "Bridge 未注入", variant: "warning" };
    case "wecom_bridge_incomplete":
      return { text: "Bridge 能力不完整", variant: "warning" };
    case "external_browser":
      return { text: "非企业微信环境", variant: "secondary" };
    default:
      return { text: "状态未知", variant: "secondary" };
  }
}

function overallDebugBadge(input: {
  registration?: JSSDKRegistrationSnapshot | null;
  isRunningRegistration?: boolean;
  runtimeState?: string;
}): { text: string; variant: DebugBadgeVariant } {
  if (input.isRunningRegistration) {
    return { text: "注册检查中", variant: "warning" };
  }
  if (input.registration?.register_ok) {
    return { text: "JSSDK 已注册", variant: "success" };
  }
  if (input.registration && input.registration.register_ok === false) {
    return { text: "注册异常", variant: "warning" };
  }
  if ((input.runtimeState || "").trim() === "external_browser") {
    return { text: "非企业微信环境", variant: "secondary" };
  }
  return { text: "待检查", variant: "secondary" };
}

function DebugMetric(props: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
        {props.label}
      </div>
      <div
        className={`mt-1 text-[12px] leading-5 text-gray-800 ${
          props.mono ? "font-mono break-all" : ""
        }`}
      >
        {(props.value || "-").trim() || "-"}
      </div>
    </div>
  );
}

function firstNonEmpty(...items: Array<string | undefined>): string {
  for (const item of items) {
    const value = (item || "").trim();
    if (value) return value;
  }
  return "";
}

function sessionStatusText(value?: string): string {
  const text = (value || "").trim();
  return text || "会话中";
}

function formatDebugTime(value?: string): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const millis = Date.parse(raw.replace(" ", "T"));
  if (Number.isNaN(millis)) return raw;
  return new Date(millis).toLocaleString("zh-CN", { hour12: false });
}

function dedupeChannels(
  channels: NavigateChannelOption[],
): NavigateChannelOption[] {
  const seen = new Set<string>();
  const out: NavigateChannelOption[] = [];
  channels.forEach((item) => {
    const openKFID = item.openKFID.trim();
    if (!openKFID || seen.has(openKFID)) return;
    seen.add(openKFID);
    out.push({ ...item, openKFID });
  });
  return out;
}

function dedupeCustomers(
  customers: NavigateCustomerOption[],
): NavigateCustomerOption[] {
  const seen = new Set<string>();
  const out: NavigateCustomerOption[] = [];
  customers.forEach((item) => {
    const openKFID = item.openKFID.trim();
    const externalUserID = item.externalUserID.trim();
    const key = `${openKFID}\u001f${externalUserID}`;
    if (!openKFID || !externalUserID || seen.has(key)) return;
    seen.add(key);
    out.push({ ...item, openKFID, externalUserID });
  });
  return out;
}

function mapSessionToNavigateCustomer(
  item: KFCustomerSessionCandidate,
): NavigateCustomerOption | null {
  const openKFID = (item.open_kfid || "").trim();
  const externalUserID = (item.external_userid || "").trim();
  if (!openKFID || !externalUserID) return null;
  return {
    openKFID,
    externalUserID,
    label: firstNonEmpty(
      item.display_name,
      item.nickname,
      externalUserID,
      "未识别客户",
    ),
  };
}

function SectionNotice(props: { text?: string; tone?: "info" | "warning" }) {
  if (!(props.text || "").trim()) return null;
  const warning = props.tone === "warning";
  return (
    <div
      className={`rounded-md px-3 py-2 text-[12px] leading-5 ${
        warning
          ? "border border-red-100 bg-red-50 text-red-700"
          : "border border-blue-100 bg-blue-50 text-blue-700"
      }`}
    >
      {props.text}
    </div>
  );
}

function isWarningNotice(text?: string): boolean {
  const value = (text || "").trim();
  if (!value) return false;
  return /(失败|异常|无法|请|错误|不可用|未注入|不支持|超时|denied|error|fail)/i.test(
    value,
  );
}

function shouldAutoDismissNotice(text?: string): boolean {
  const value = (text || "").trim();
  return Boolean(value) && !isWarningNotice(value);
}

function useAutoDismissNotice(
  value: string,
  setValue: Dispatch<SetStateAction<string>>,
) {
  useEffect(() => {
    if (!shouldAutoDismissNotice(value)) return;
    const timer = window.setTimeout(() => setValue(""), 3200);
    return () => window.clearTimeout(timer);
  }, [setValue, value]);
}

function DebugStatusPill(props: { text: string; variant: DebugBadgeVariant }) {
  const className =
    props.variant === "success"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : props.variant === "warning"
        ? "border-orange-100 bg-orange-50 text-orange-700"
        : "border-gray-100 bg-gray-50 text-gray-600";
  return (
    <span
      className={`inline-flex max-w-[116px] shrink-0 items-center justify-center rounded-md border px-2 py-1 text-center text-[10px] font-bold leading-3 ${className}`}
    >
      {props.text}
    </span>
  );
}

function DebugPanel(props: {
  icon: ReactNode;
  title: string;
  description: string;
  tone?: DebugTone;
  status?: { text: string; variant: DebugBadgeVariant };
  action?: ReactNode;
  children: ReactNode;
}) {
  const tone = debugToneStyles[props.tone || "blue"];
  return (
    <Card className="wecom-toolbar-panel wecom-toolbar-enter overflow-visible rounded-lg border-gray-200 bg-white p-0 shadow-sm">
      <div className={`h-1 ${tone.bar}`} />
      <div className="p-3">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1 ${tone.icon}`}
            >
              {props.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold leading-5 text-gray-900">
                {props.title}
              </div>
              <div className="mt-0.5 text-[12px] leading-5 text-gray-500">
                {props.description}
              </div>
            </div>
          </div>
          {(props.status || props.action) ? (
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {props.action}
              {props.status ? <DebugStatusPill {...props.status} /> : null}
            </div>
          ) : null}
        </div>
        {props.children}
      </div>
    </Card>
  );
}

export function ToolbarDebugView(props: ToolbarDebugViewProps) {
  const [runtimeSnapshot, setRuntimeSnapshot] =
    useState<JSSDKRuntimeDiagnosticsSnapshot | null>(null);
  const [registration, setRegistration] =
    useState<JSSDKRegistrationSnapshot | null>(null);
  const [apiSupport, setApiSupport] = useState<Record<string, boolean> | null>(
    null,
  );
  const [contextInspection, setContextInspection] =
    useState<JSSDKContextInspection | null>(null);
  const [openDataRuntime, setOpenDataRuntime] = useState<OpenDataRuntime | null>(
    null,
  );
  const [sendText, setSendText] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const [sendNotice, setSendNotice] = useState("");
  const [navigateNotice, setNavigateNotice] = useState("");
  const [registrationNotice, setRegistrationNotice] = useState("");
  const [apiNotice, setApiNotice] = useState("");
  const [contextNotice, setContextNotice] = useState("");
  const [openDataNotice, setOpenDataNotice] = useState("");
  const [isRefreshingDiagnostics, setIsRefreshingDiagnostics] = useState(false);
  const [isRunningRegistration, setIsRunningRegistration] = useState(false);
  const [isCheckingApis, setIsCheckingApis] = useState(false);
  const [isInspectingContext, setIsInspectingContext] = useState(false);
  const [isCheckingOpenData, setIsCheckingOpenData] = useState(false);
  const [isSendingText, setIsSendingText] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [channels, setChannels] = useState<ReceptionChannel[]>([]);
  const [channelNotice, setChannelNotice] = useState("");
  const [customerNotice, setCustomerNotice] = useState("");
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [navigateOpenKFID, setNavigateOpenKFID] = useState("");
  const [navigateExternalUserID, setNavigateExternalUserID] = useState("");
  const [isChannelPickerOpen, setIsChannelPickerOpen] = useState(false);
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [channelCustomers, setChannelCustomers] = useState<
    NavigateCustomerOption[]
  >([]);

  useAutoDismissNotice(sendNotice, setSendNotice);
  useAutoDismissNotice(navigateNotice, setNavigateNotice);
  useAutoDismissNotice(registrationNotice, setRegistrationNotice);
  useAutoDismissNotice(apiNotice, setApiNotice);
  useAutoDismissNotice(contextNotice, setContextNotice);
  useAutoDismissNotice(openDataNotice, setOpenDataNotice);
  useAutoDismissNotice(channelNotice, setChannelNotice);
  useAutoDismissNotice(customerNotice, setCustomerNotice);

  const currentOpenKFID = (props.openKFID || "").trim();
  const currentExternalUserID = (props.externalUserID || "").trim();
  const sessionCandidates = useMemo(
    () => props.sessionCandidates || [],
    [props.sessionCandidates],
  );
  const candidateChannels = useMemo<NavigateChannelOption[]>(() => {
    return sessionCandidates
      .map((item): NavigateChannelOption | null => {
        const openKFID = (item.open_kfid || "").trim();
        if (!openKFID) return null;
        return {
          openKFID,
          label: firstNonEmpty(item.channel_token, openKFID),
          source: "candidate" as const,
        };
      })
      .filter((item): item is NavigateChannelOption => item !== null);
  }, [sessionCandidates]);
  const candidateCustomers = useMemo<NavigateCustomerOption[]>(() => {
    return sessionCandidates
      .map((item): NavigateCustomerOption | null => {
        const openKFID = (item.open_kfid || "").trim();
        const externalUserID = (
          item.external_userid || currentExternalUserID
        ).trim();
        if (!openKFID || !externalUserID) return null;
        return {
          openKFID,
          externalUserID,
          label: firstNonEmpty(item.contact_name, externalUserID, "未识别客户"),
          sessionStatus: item.session_status_code,
          lastActive: item.last_active,
          lastMessage: item.last_message,
        };
      })
      .filter((item): item is NavigateCustomerOption => item !== null);
  }, [currentExternalUserID, sessionCandidates]);

  const channelOptions = useMemo(() => {
    const fromChannels = channels
      .map((item): NavigateChannelOption | null => {
        const openKFID = (item.open_kfid || "").trim();
        if (!openKFID) return null;
        return {
          openKFID,
          label: firstNonEmpty(item.display_name, item.name, openKFID),
          source: "channel" as const,
        };
      })
      .filter((item): item is NavigateChannelOption => item !== null);
    const current = currentOpenKFID
      ? [
          {
            openKFID: currentOpenKFID,
            label: firstNonEmpty(
              fromChannels.find((item) => item.openKFID === currentOpenKFID)
                ?.label,
              candidateChannels.find((item) => item.openKFID === currentOpenKFID)
                ?.label,
              currentOpenKFID,
            ),
            source: "current" as const,
          },
        ]
      : [];
    return dedupeChannels([...current, ...candidateChannels, ...fromChannels]);
  }, [candidateChannels, channels, currentOpenKFID]);

  const customerOptions = useMemo(() => {
    const selectedOpenKFID = navigateOpenKFID.trim();
    const current = currentExternalUserID && selectedOpenKFID === currentOpenKFID
      ? [
          {
            openKFID: selectedOpenKFID,
            externalUserID: currentExternalUserID,
            label: firstNonEmpty(
              channelCustomers.find(
                (item) =>
                  item.openKFID === selectedOpenKFID &&
                  item.externalUserID === currentExternalUserID,
              )?.label,
              candidateCustomers.find(
                (item) =>
                  item.openKFID === selectedOpenKFID &&
                  item.externalUserID === currentExternalUserID,
              )?.label,
              currentExternalUserID,
              "当前客户",
            ),
            sessionStatus: "当前会话",
          },
        ]
      : [];
    return dedupeCustomers([
      ...current,
      ...channelCustomers.filter((item) => item.openKFID === selectedOpenKFID),
      ...candidateCustomers.filter((item) => item.openKFID === selectedOpenKFID),
    ]);
  }, [
    candidateCustomers,
    channelCustomers,
    currentExternalUserID,
    currentOpenKFID,
    navigateOpenKFID,
  ]);

  const selectedChannel = useMemo(
    () =>
      channelOptions.find((item) => item.openKFID === navigateOpenKFID.trim()) ||
      null,
    [channelOptions, navigateOpenKFID],
  );
  const selectedCustomer = useMemo(
    () =>
      customerOptions.find(
        (item) => item.externalUserID === navigateExternalUserID.trim(),
      ) || null,
    [customerOptions, navigateExternalUserID],
  );

  const refreshRuntimeSnapshot = () => {
    setRuntimeSnapshot(getJSSDKRuntimeDiagnosticsSnapshot());
  };

  const handleRefreshDiagnostics = async () => {
    const selectedOpenKFID = navigateOpenKFID.trim();
    try {
      setIsRefreshingDiagnostics(true);
      refreshRuntimeSnapshot();
      await Promise.allSettled([
        handleCheckRegistration(false),
        handleCheckApis(),
        handleInspectContext(),
        handleCheckOpenData(),
        loadChannels(),
        selectedOpenKFID
          ? loadCustomersForChannel(selectedOpenKFID)
          : Promise.resolve(),
      ]);
      refreshRuntimeSnapshot();
    } finally {
      setIsRefreshingDiagnostics(false);
    }
  };

  const handleCheckRegistration = async (force = false) => {
    try {
      setIsRunningRegistration(true);
      setRegistrationNotice("");
      if (force) {
        resetJSSDKRuntimeCaches();
      }
      const result = await runJSSDKRegistrationDiagnostics();
      setRegistration(result);
      refreshRuntimeSnapshot();
      setRegistrationNotice(force ? "已重新执行 JSSDK 注册" : "已完成注册检查");
    } catch (error) {
      setRegistration(null);
      setRegistrationNotice(normalizeErrorMessage(error));
    } finally {
      setIsRunningRegistration(false);
    }
  };

  const handleCheckApis = async () => {
    try {
      setIsCheckingApis(true);
      setApiNotice("");
      const result = await checkSidebarJSSDKApis();
      setApiSupport(result);
      setApiNotice("已刷新 API 能力结果");
    } catch (error) {
      setApiSupport(null);
      setApiNotice(normalizeErrorMessage(error));
    } finally {
      setIsCheckingApis(false);
    }
  };

  const handleInspectContext = async () => {
    try {
      setIsInspectingContext(true);
      setContextNotice("");
      const result = await inspectSidebarJSSDKContext();
      setContextInspection(result);
      setContextNotice("已重新解析当前会话上下文");
    } catch (error) {
      setContextInspection(null);
      setContextNotice(normalizeErrorMessage(error));
    } finally {
      setIsInspectingContext(false);
    }
  };

  const handleCheckOpenData = async () => {
    try {
      setIsCheckingOpenData(true);
      setOpenDataNotice("");
      const runtime = await ensureOpenDataReady();
      setOpenDataRuntime(runtime);
      setOpenDataNotice(
        runtime.canUseOpenData ? "open-data 已就绪" : runtime.reason || "open-data 暂不可用",
      );
    } catch (error) {
      setOpenDataRuntime(null);
      setOpenDataNotice(normalizeErrorMessage(error));
    } finally {
      setIsCheckingOpenData(false);
    }
  };

  const handleSendText = async () => {
    if (!confirmSend) {
      setSendNotice("请先确认这会真实发送到当前会话");
      return;
    }
    const text = sendText.trim();
    if (!text) {
      setSendNotice("请先填写测试发送内容");
      return;
    }
    try {
      setIsSendingText(true);
      setSendNotice("");
      await sendTextToCurrentSession(text, {
        external_userid: currentExternalUserID,
      });
      setSendNotice("测试消息已通过企业微信客户端发出");
    } catch (error) {
      setSendNotice(toJSSDKErrorMessage(error));
    } finally {
      setIsSendingText(false);
    }
  };

  const handleNavigateToKfChat = async () => {
    const targetOpenKFID = navigateOpenKFID.trim();
    const targetExternalUserID = navigateExternalUserID.trim();
    if (!targetOpenKFID) {
      setNavigateNotice("当前没有可用的 open_kfid，无法测试打开客服会话");
      return;
    }
    try {
      setIsNavigating(true);
      setNavigateNotice("");
      await openWecomKfConversation({
        open_kfid: targetOpenKFID,
        external_userid: targetExternalUserID,
      });
      setNavigateNotice("已触发打开微信客服会话");
    } catch (error) {
      setNavigateNotice(toJSSDKErrorMessage(error));
    } finally {
      setIsNavigating(false);
    }
  };

  const loadChannels = async () => {
    try {
      setIsLoadingChannels(true);
      setChannelNotice("");
      const result = await listReceptionChannels({ limit: 500 });
      setChannels(result || []);
      setChannelNotice("已加载客服账号列表");
    } catch (error) {
      setChannels([]);
      setChannelNotice(normalizeErrorMessage(error));
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const loadCustomersForChannel = async (openKFID: string) => {
    const selectedOpenKFID = openKFID.trim();
    if (!selectedOpenKFID) {
      setChannelCustomers([]);
      return;
    }
    try {
      setIsLoadingCustomers(true);
      setCustomerNotice("");
      const sessions = await listKFCustomerSessions({
        open_kfid: selectedOpenKFID,
        limit: 100,
      });
      const next = sessions
        .map(mapSessionToNavigateCustomer)
        .filter((item): item is NavigateCustomerOption => item !== null);
      setChannelCustomers(next);
      setCustomerNotice("已加载该客服账号下的买家会话");
    } catch (error) {
      setChannelCustomers([]);
      setCustomerNotice(normalizeErrorMessage(error));
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  useEffect(() => {
    refreshRuntimeSnapshot();
    void handleCheckRegistration(false);
    void handleCheckApis();
    void handleInspectContext();
    void handleCheckOpenData();
    void loadChannels();
  }, []);

  useEffect(() => {
    setNavigateOpenKFID(currentOpenKFID);
    setNavigateExternalUserID(currentExternalUserID);
  }, [currentExternalUserID, currentOpenKFID]);

  useEffect(() => {
    void loadCustomersForChannel(navigateOpenKFID);
  }, [navigateOpenKFID]);

  useEffect(() => {
    const selectedExternalUserID = navigateExternalUserID.trim();
    if (selectedExternalUserID) {
      return;
    }
    const currentForSelected = customerOptions.find(
      (item) => item.externalUserID === currentExternalUserID,
    );
    const fallback = currentForSelected || customerOptions[0];
    if (fallback) {
      setNavigateExternalUserID(fallback.externalUserID);
    }
  }, [currentExternalUserID, customerOptions, navigateExternalUserID]);

  const overallBadge = overallDebugBadge({
    registration,
    isRunningRegistration,
    runtimeState: runtimeSnapshot?.runtimeState,
  });
  const registrationBadge = renderStatusBadge(
    registration?.register_ok,
    "待检测",
  );
  const openDataBadge = useMemo(() => {
    switch ((openDataRuntime?.availability || "").trim()) {
      case "ready":
        return { text: "已就绪", variant: "success" as const };
      case "initializing":
        return { text: "初始化中", variant: "warning" as const };
      case "login_required":
        return { text: "需登录态", variant: "warning" as const };
      case "error":
        return { text: "异常", variant: "warning" as const };
      case "unsupported":
        return { text: "不支持", variant: "secondary" as const };
      default:
        return { text: "待检测", variant: "secondary" as const };
    }
  }, [openDataRuntime]);

  const sampleOpenDataUserID = (props.sampleOpenDataUserID || "").trim();
  const sampleOpenDataFallback = (props.sampleOpenDataFallback || "").trim();
  const registrationBaseNotice = firstNonEmpty(
    registrationNotice,
    registration?.error_message,
  );
  const registrationNoticeText = isRunningRegistration
    ? ""
    : registrationBaseNotice;
  const apiNoticeText = isCheckingApis
    ? "正在检查当前客户端的 JSSDK API 能力。"
    : apiNotice;
  const contextNoticeText = isInspectingContext ? "" : contextNotice;
  const navigateWarningNotice = [navigateNotice, channelNotice, customerNotice]
    .map((item) => (item || "").trim())
    .find(isWarningNotice);
  const navigateBaseNotice =
    navigateWarningNotice ||
    firstNonEmpty(navigateNotice, channelNotice, customerNotice);
  const navigateNoticeText =
    isNavigating
      ? ""
      : isLoadingChannels || isLoadingCustomers
        ? ""
        : navigateBaseNotice;
  const openDataBaseNotice = firstNonEmpty(
    openDataNotice,
    openDataRuntime?.reason,
  );
  const openDataNoticeText = isCheckingOpenData
    ? "正在检查 open-data 运行态。"
    : openDataBaseNotice;

  return (
    <div className={sidebarPageShell}>
      <div className="sticky top-0 z-10 shrink-0 bg-[#0052D9] p-4 text-white shadow-[0_8px_22px_rgba(0,82,217,0.22)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 animate-pulse rounded-full ${
                overallBadge.variant === "warning"
                  ? "bg-orange-300"
                  : overallBadge.variant === "success"
                    ? "bg-green-400"
                    : "bg-white/50"
              }`}
            />
            <h1 className="truncate text-sm font-bold tracking-tight text-white">
              工具栏调试模式
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-white/20 px-2 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-white/30"
              onClick={props.onBack}
            >
              <ArrowLeft className="h-3 w-3" />
              返回
            </button>
            <button
              type="button"
              disabled={isRefreshingDiagnostics}
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-60"
              onClick={() => void handleRefreshDiagnostics()}
              aria-label="刷新工具栏调试"
            >
              <RefreshCcw
                className={`h-3.5 w-3.5 ${isRefreshingDiagnostics ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
        <div className="rounded bg-black/10 p-2 text-[12px] leading-5 text-white/82">
          按照环境、注册、能力、上下文、动作的顺序排查当前工具栏 JSSDK 链路。
        </div>
      </div>

      <div className={`${sidebarBody} space-y-3 bg-[#F8FAFC] p-3`}>
        <DebugPanel
          tone="blue"
          icon={<Bot className="h-4 w-4" />}
          title="注册与签名"
          description="检查并重试当前页面的 JSSDK 注册链路"
          status={registrationBadge}
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 rounded-md border-gray-200 bg-white px-2.5 text-[11px]"
              disabled={isRunningRegistration}
              onClick={() => void handleCheckRegistration(true)}
            >
              <RefreshCcw className={`mr-1 h-3.5 w-3.5 ${isRunningRegistration ? "animate-spin" : ""}`} />
              重试
            </Button>
          }
        >

          <SectionNotice
            text={registrationNoticeText}
            tone={
              registration?.register_ok === false ||
              isWarningNotice(registrationNoticeText)
                ? "warning"
                : "info"
            }
          />

          <div className="mt-3 grid grid-cols-1 gap-3">
            <DebugMetric
              label="注册页面 URL"
              value={registration?.current_page_url}
              mono
            />
            <DebugMetric
              label="企业 ID"
              value={registration?.corp_id}
              mono
            />
            <DebugMetric
              label="agent_id"
              value={registration?.agent_id ? String(registration.agent_id) : "-"}
              mono
            />
            {registration?.error_code ? (
              <DebugMetric
                label="错误代码"
                value={registration.error_code}
                mono
              />
            ) : null}
          </div>
        </DebugPanel>

        <DebugPanel
          tone="violet"
          icon={<Waypoints className="h-4 w-4" />}
          title="API 能力检查"
          description="当前客户端对关键 JSSDK API 的支持情况"
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 rounded-md border-gray-200 bg-white px-2.5 text-[11px]"
              disabled={isCheckingApis}
              onClick={() => void handleCheckApis()}
            >
              <RefreshCcw className={`mr-1 h-3.5 w-3.5 ${isCheckingApis ? "animate-spin" : ""}`} />
              检查
            </Button>
          }
        >

          <SectionNotice text={apiNoticeText} tone={isWarningNotice(apiNoticeText) ? "warning" : "info"} />

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              "getContext",
              "getCurExternalContact",
              "getCurExternalChat",
              "sendChatMessage",
              "navigateToKfChat",
            ].map((name) => {
              const supported = apiSupport?.[name];
              const badge = renderStatusBadge(
                typeof supported === "boolean" ? supported : undefined,
                "待检测",
              );
              return (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <span className="font-mono text-[11px] text-gray-700">{name}</span>
                  <DebugStatusPill {...badge} />
                </div>
              );
            })}
          </div>
        </DebugPanel>

        <DebugPanel
          tone="emerald"
          icon={<UserRound className="h-4 w-4" />}
          title="会话上下文解析"
          description="验证 entry、客户、群聊与 query fallback 结果"
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 rounded-md border-gray-200 bg-white px-2.5 text-[11px]"
              disabled={isInspectingContext}
              onClick={() => void handleInspectContext()}
            >
              <RefreshCcw className={`mr-1 h-3.5 w-3.5 ${isInspectingContext ? "animate-spin" : ""}`} />
              解析
            </Button>
          }
        >

          <SectionNotice
            text={contextNoticeText}
            tone={isWarningNotice(contextNoticeText) ? "warning" : "info"}
          />

          <div className="mt-3 grid grid-cols-2 gap-3">
            <DebugMetric label="entry" value={contextInspection?.entry} mono />
            <DebugMetric label="mode" value={contextInspection?.mode} mono />
            <DebugMetric
              label="external_userid"
              value={contextInspection?.external_userid}
              mono
            />
            <DebugMetric label="chat_id" value={contextInspection?.chat_id} mono />
            <DebugMetric
              label="open_kfid"
              value={contextInspection?.open_kfid || currentOpenKFID}
              mono
            />
          </div>

          <div className="mt-3 space-y-2">
            <div className="text-[11px] font-medium text-gray-500">Raw Payload</div>
            <div className="rounded-md bg-[#111827] px-3 py-3 font-mono text-[11px] leading-5 text-gray-100">
              <pre className="max-h-[220px] overflow-y-auto whitespace-pre-wrap break-words">
                {prettyJSON({
                  raw_context: contextInspection?.raw_context || {},
                  raw_contact: contextInspection?.raw_contact || {},
                  raw_chat: contextInspection?.raw_chat || {},
                })}
              </pre>
            </div>
          </div>
        </DebugPanel>

        <DebugPanel
          tone="cyan"
          icon={<MessageSquareText className="h-4 w-4" />}
          title="打开微信客服会话"
          description="单独验证 navigateToKfChat，先选客服账号，再选买家"
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 rounded-md border-gray-200 bg-white px-2.5 text-[11px]"
              disabled={isLoadingChannels || isLoadingCustomers}
              onClick={() => {
                void loadChannels();
                void loadCustomersForChannel(navigateOpenKFID);
              }}
            >
              <RefreshCcw
                className={`mr-1 h-3.5 w-3.5 ${
                  isLoadingChannels || isLoadingCustomers ? "animate-spin" : ""
                }`}
              />
              候选
            </Button>
          }
        >

          <SectionNotice
            text={navigateNoticeText}
            tone={isWarningNotice(navigateNoticeText) ? "warning" : "info"}
          />

          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500">
                客服账号 open_kfid
              </label>
              <div className="relative">
                <div className="rounded-md border border-gray-100 bg-gray-50 p-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-gray-900">
                        {selectedChannel?.label || "手动输入客服账号"}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {isLoadingChannels ? "候选加载中" : `${channelOptions.length} 个候选`}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded bg-white px-2 py-1 text-[11px] font-medium text-blue-600 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-blue-50"
                      onClick={() => setIsChannelPickerOpen((value) => !value)}
                    >
                      {isChannelPickerOpen ? "收起" : "选择"}
                    </button>
                  </div>
                  <Input
                    className="h-8 font-mono text-[11px]"
                    value={navigateOpenKFID}
                    placeholder="输入 open_kfid"
                    onFocus={() => setIsChannelPickerOpen(true)}
                    onChange={(event) => {
                      setNavigateOpenKFID(event.target.value);
                      setNavigateNotice("");
                    }}
                  />
                </div>
                {isChannelPickerOpen ? (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[220px] overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-xl">
                    {channelOptions.length === 0 ? (
                      <div className="px-3 py-4 text-[12px] text-gray-400">
                        暂未获取到客服账号，可直接手动输入 open_kfid。
                      </div>
                    ) : (
                      channelOptions.map((item) => {
                        const selected = item.openKFID === navigateOpenKFID.trim();
                        return (
                          <button
                            key={item.openKFID}
                            type="button"
                            className={`flex w-full flex-col rounded-md px-3 py-2 text-left transition-colors ${
                              selected
                                ? "bg-blue-50 text-blue-700"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                            onClick={() => {
                              setNavigateOpenKFID(item.openKFID);
                              setNavigateNotice("");
                              setIsChannelPickerOpen(false);
                            }}
                          >
                            <span className="truncate text-[12px] font-semibold">
                              {item.label}
                            </span>
                            <span className="mt-0.5 font-mono text-[11px] text-gray-500">
                              {item.openKFID}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500">
                买家 externalUserId
              </label>
              <div className="relative">
                <div className="rounded-md border border-gray-100 bg-gray-50 p-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-gray-900">
                        {selectedCustomer?.label || "手动输入买家"}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {isLoadingCustomers ? "候选加载中" : `${customerOptions.length} 个候选`}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded bg-white px-2 py-1 text-[11px] font-medium text-blue-600 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-blue-50"
                      onClick={() => setIsCustomerPickerOpen((value) => !value)}
                    >
                      {isCustomerPickerOpen ? "收起" : "选择"}
                    </button>
                  </div>
                  <Input
                    className="h-8 font-mono text-[11px]"
                    value={navigateExternalUserID}
                    placeholder="输入 external_userid"
                    onFocus={() => setIsCustomerPickerOpen(true)}
                    onChange={(event) => {
                      setNavigateExternalUserID(event.target.value);
                      setNavigateNotice("");
                    }}
                  />
                </div>
                {isCustomerPickerOpen ? (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[220px] overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-xl">
                    {customerOptions.length === 0 ? (
                      <div className="px-3 py-4 text-[12px] leading-5 text-gray-400">
                        {navigateOpenKFID.trim()
                          ? "该客服账号下暂未获取到买家候选，可直接手动输入 external_userid。"
                          : "请先选择或输入客服账号。"}
                      </div>
                    ) : (
                      customerOptions.map((item) => {
                        const selected =
                          item.externalUserID === navigateExternalUserID.trim();
                        return (
                          <button
                            key={`${item.openKFID}:${item.externalUserID}`}
                            type="button"
                            className={`flex w-full flex-col rounded-md px-3 py-2 text-left transition-colors ${
                              selected
                                ? "bg-blue-50 text-blue-700"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                            onClick={() => {
                              setNavigateExternalUserID(item.externalUserID);
                              setNavigateNotice("");
                              setIsCustomerPickerOpen(false);
                            }}
                          >
                            <span className="truncate text-[12px] font-semibold">
                              {item.label}
                            </span>
                            <span className="mt-0.5 font-mono text-[11px] text-gray-500">
                              {item.externalUserID}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <Button
              size="sm"
              className="h-9 w-full rounded-md px-3 text-[12px]"
              disabled={isNavigating || !navigateOpenKFID.trim()}
              onClick={() => void handleNavigateToKfChat()}
            >
              <MessageSquareText className="mr-1 h-3.5 w-3.5" />
              {isNavigating ? "打开中..." : "测试 navigateToKfChat"}
            </Button>

            <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-[11px] leading-5 text-gray-500">
              说明：open_kfid 和 externalUserId 不是企业通讯录 userid，不能用
              open-data 直接解析姓名；这里使用接待渠道与会话读模型做真实业务回显。
              内部成员姓名仍由下方 open-data 模块验证。
            </div>
          </div>
        </DebugPanel>

        <DebugPanel
          tone="sky"
          icon={<MessageSquareText className="h-4 w-4" />}
          title="动作调试"
          description="这里的写操作会真实作用到当前企业微信会话"
        >
          <div className="space-y-4">
            <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-700">
              发送测试消息前，请确认你正在真实会话里，且理解这会直接影响当前客户侧沟通。
            </div>

            <Textarea
              className="min-h-[96px] rounded-md text-[12px] leading-5"
              placeholder="输入一条测试消息"
              value={sendText}
              onChange={(event) => setSendText(event.target.value)}
            />

            <label className="flex items-center gap-2 text-[12px] text-gray-600">
              <input
                type="checkbox"
                checked={confirmSend}
                onChange={(event) => setConfirmSend(event.target.checked)}
              />
              我已确认，这会真实发送到当前会话
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="h-8 rounded-md px-3 text-[11px]"
                disabled={isSendingText}
                onClick={() => void handleSendText()}
              >
                <Send className="mr-1 h-3.5 w-3.5" />
                {isSendingText ? "发送中..." : "测试 sendChatMessage"}
              </Button>
            </div>

            <SectionNotice
              text={sendNotice}
              tone={isWarningNotice(sendNotice) ? "warning" : "info"}
            />
          </div>
        </DebugPanel>

        <DebugPanel
          tone="indigo"
          icon={<ShieldCheck className="h-4 w-4" />}
          title="OpenData 运行"
          description="验证 open-data 初始化与当前环境可用性"
          status={openDataBadge}
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 rounded-md border-gray-200 bg-white px-2.5 text-[11px]"
              disabled={isCheckingOpenData}
              onClick={() => void handleCheckOpenData()}
            >
              <RefreshCcw className={`mr-1 h-3.5 w-3.5 ${isCheckingOpenData ? "animate-spin" : ""}`} />
              检查
            </Button>
          }
        >
          <SectionNotice
            text={openDataNoticeText}
            tone={isWarningNotice(openDataNoticeText) ? "warning" : "info"}
          />

          <div className="mt-3 grid grid-cols-2 gap-3">
            <DebugMetric
              label="运行可用性"
              value={openDataRuntime?.availability}
              mono
            />
            <DebugMetric
              label="可用状态"
              value={openDataRuntime?.canUseOpenData ? "可用" : "不可用"}
            />
          </div>

          {sampleOpenDataUserID ? (
            <div className="mt-3 space-y-1">
              <div className="text-[11px] font-medium text-gray-500">示例渲染</div>
              <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-[12px] text-gray-700">
                <WecomOpenDataName
                  userid={sampleOpenDataUserID}
                  fallback={sampleOpenDataFallback || sampleOpenDataUserID}
                  showHint
                  className="font-medium text-gray-900"
                  hintClassName="mt-1 text-[11px] text-gray-500"
                />
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-[12px] text-gray-500">
              当前会话里没有可用于演示的内部成员标识，暂不展示 open-data 姓名渲染样例。
            </div>
          )}
        </DebugPanel>
      </div>
    </div>
  );
}
