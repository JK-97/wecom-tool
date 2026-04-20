import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { WecomOpenDataName } from "@/components/wecom/WecomOpenDataName";
import { normalizeErrorMessage } from "@/services/http";
import {
  getCSCommandCenterView,
  type CommandCenterSession,
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
  sidebarHeader,
  sidebarMeta,
  sidebarPageShell,
  sidebarSectionLabel,
  sidebarTitle,
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
  session_status?: string;
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
): { text: string; variant: "success" | "warning" | "secondary" } {
  if (ok === true) return { text: "正常", variant: "success" };
  if (ok === false) return { text: "异常", variant: "warning" };
  return { text: pendingText, variant: "secondary" };
}

function runtimeStateBadge(
  state?: string,
): { text: string; variant: "success" | "warning" | "secondary" } {
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
}): { text: string; variant: "success" | "warning" | "secondary" } {
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
    <div className="space-y-1">
      <div className="text-[11px] font-medium text-slate-500">{props.label}</div>
      <div
        className={`rounded-xl bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-700 ${
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
  item: CommandCenterSession,
): NavigateCustomerOption | null {
  const openKFID = (item.open_kfid || "").trim();
  const externalUserID = (item.external_userid || "").trim();
  if (!openKFID || !externalUserID) return null;
  return {
    openKFID,
    externalUserID,
    label: firstNonEmpty(item.name, externalUserID, "未识别客户"),
    sessionStatus: item.session_label || item.state_bucket,
    lastActive: item.last_active,
    lastMessage: item.last_message,
  };
}

function SectionNotice(props: { text?: string; tone?: "info" | "warning" }) {
  if (!(props.text || "").trim()) return null;
  const warning = props.tone === "warning";
  return (
    <div
      className={`rounded-xl px-3 py-2 text-[12px] leading-5 ${
        warning
          ? "border border-amber-100 bg-amber-50 text-amber-700"
          : "border border-blue-100 bg-blue-50 text-blue-700"
      }`}
    >
      {props.text}
    </div>
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
  const [channelCustomers, setChannelCustomers] = useState<
    NavigateCustomerOption[]
  >([]);

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
          sessionStatus: item.session_status,
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
      ...candidateCustomers.filter((item) => item.openKFID === selectedOpenKFID),
      ...channelCustomers.filter((item) => item.openKFID === selectedOpenKFID),
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
      const result = await getCSCommandCenterView({
        open_kfid: selectedOpenKFID,
        limit: 100,
      });
      const next = (result?.sessions || [])
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
    if (
      selectedExternalUserID &&
      customerOptions.some((item) => item.externalUserID === selectedExternalUserID)
    ) {
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

  return (
    <div className={sidebarPageShell}>
      <div
        className={`${sidebarHeader} sticky top-0 z-10 shadow-[0_8px_24px_rgba(15,23,42,0.04)]`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 transition-colors hover:text-slate-800"
              onClick={props.onBack}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回
            </button>
            <div className="mb-1 flex items-center gap-2">
              <span className={sidebarTitle}>工具栏调试</span>
              <Badge variant={overallBadge.variant} className="px-2 py-0.5 text-[10px]">
                {overallBadge.text}
              </Badge>
            </div>
            <div className={`${sidebarMeta} max-w-[280px] leading-5`}>
              按照环境、注册、能力、上下文、动作的顺序排查当前工具栏 JSSDK 链路。
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-slate-200 px-3 text-[11px]"
            onClick={refreshRuntimeSnapshot}
          >
            <RefreshCcw className="mr-1 h-3.5 w-3.5" />
            刷新诊断
          </Button>
        </div>
      </div>

      <div className={`${sidebarBody} space-y-3`}>
        <Card className="rounded-2xl border-slate-200 bg-white/95 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className={sidebarSectionLabel}>注册与签名</div>
                <div className={`${sidebarMeta} mt-0.5`}>
                  检查并重试当前页面的 JSSDK 注册链路
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={registrationBadge.variant} className="px-2 py-0.5 text-[10px]">
                {registrationBadge.text}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-slate-200 px-3 text-[11px]"
                disabled={isRunningRegistration}
                onClick={() => void handleCheckRegistration(true)}
              >
                <RefreshCcw className={`mr-1 h-3.5 w-3.5 ${isRunningRegistration ? "animate-spin" : ""}`} />
                重新注册
              </Button>
            </div>
          </div>

          <SectionNotice
            text={
              registrationNotice ||
              registration?.error_message ||
              (isRunningRegistration
                ? "正在检查当前工具栏页面的 JSSDK 注册、签名与基础 Bridge 能力。"
                : "")
            }
            tone={registration?.register_ok === false ? "warning" : "info"}
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
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white/95 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <Waypoints className="h-4 w-4" />
              </div>
              <div>
                <div className={sidebarSectionLabel}>API 能力检查</div>
                <div className={`${sidebarMeta} mt-0.5`}>
                  当前客户端对关键 JSSDK API 的支持情况
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-slate-200 px-3 text-[11px]"
              disabled={isCheckingApis}
              onClick={() => void handleCheckApis()}
            >
              <RefreshCcw className={`mr-1 h-3.5 w-3.5 ${isCheckingApis ? "animate-spin" : ""}`} />
              检查能力
            </Button>
          </div>

          <SectionNotice text={apiNotice} tone={apiSupport ? "info" : "warning"} />

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
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <span className="font-mono text-[11px] text-slate-700">{name}</span>
                  <Badge variant={badge.variant} className="px-2 py-0.5 text-[10px]">
                    {badge.text}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white/95 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <UserRound className="h-4 w-4" />
              </div>
              <div>
                <div className={sidebarSectionLabel}>会话上下文解析</div>
                <div className={`${sidebarMeta} mt-0.5`}>
                  验证 entry、客户、群聊与 query fallback 结果
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-slate-200 px-3 text-[11px]"
              disabled={isInspectingContext}
              onClick={() => void handleInspectContext()}
            >
              <RefreshCcw className={`mr-1 h-3.5 w-3.5 ${isInspectingContext ? "animate-spin" : ""}`} />
              重新解析
            </Button>
          </div>

          <SectionNotice
            text={contextNotice}
            tone={contextInspection ? "info" : "warning"}
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
            <div className="text-[11px] font-medium text-slate-500">Raw Payload</div>
            <div className="rounded-2xl bg-slate-950 px-3 py-3 font-mono text-[11px] leading-5 text-slate-100">
              <pre className="max-h-[220px] overflow-y-auto whitespace-pre-wrap break-words">
                {prettyJSON({
                  raw_context: contextInspection?.raw_context || {},
                  raw_contact: contextInspection?.raw_contact || {},
                  raw_chat: contextInspection?.raw_chat || {},
                })}
              </pre>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white/95 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                <MessageSquareText className="h-4 w-4" />
              </div>
              <div>
                <div className={sidebarSectionLabel}>打开微信客服会话</div>
                <div className={`${sidebarMeta} mt-0.5`}>
                  单独验证 navigateToKfChat，先选客服账号，再选买家
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-slate-200 px-3 text-[11px]"
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
              刷新候选
            </Button>
          </div>

          <SectionNotice
            text={
              navigateNotice ||
              channelNotice ||
              customerNotice ||
              "客服账号来自接待渠道，买家候选来自会话读模型；这里不会再从消息表反推会话。"
            }
            tone={
              navigateNotice.includes("失败") ||
              navigateNotice.includes("无法") ||
              channelNotice.includes("失败") ||
              customerNotice.includes("失败")
                ? "warning"
                : "info"
            }
          />

          <div className="mt-3 space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">
                客服账号 open_kfid
              </label>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-600">
                <div className="font-medium text-slate-800">
                  {selectedChannel?.label || "未匹配到客服账号名称"}
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  {navigateOpenKFID || "-"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">
                  <span>客服账号列表</span>
                  <span>{channelOptions.length} 个</span>
                </div>
                <div className="max-h-[180px] overflow-y-auto p-1">
                  {channelOptions.length === 0 ? (
                    <div className="px-3 py-4 text-[12px] text-slate-400">
                      暂未获取到客服账号，请确认接待渠道已同步。
                    </div>
                  ) : (
                    channelOptions.map((item) => {
                      const selected = item.openKFID === navigateOpenKFID.trim();
                      return (
                        <button
                          key={item.openKFID}
                          type="button"
                          className={`flex w-full flex-col rounded-xl px-3 py-2 text-left transition-colors ${
                            selected
                              ? "bg-blue-50 text-blue-700"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            setNavigateOpenKFID(item.openKFID);
                            setNavigateNotice("");
                          }}
                        >
                          <span className="text-[12px] font-medium">
                            {item.label}
                          </span>
                          <span className="mt-0.5 font-mono text-[11px] text-slate-500">
                            {item.openKFID}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">
                买家 externalUserId
              </label>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-600">
                <div className="font-medium text-slate-800">
                  {selectedCustomer?.label || "未匹配到买家名称"}
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  {navigateExternalUserID || "-"}
                </div>
                {selectedCustomer?.sessionStatus ||
                selectedCustomer?.lastActive ||
                selectedCustomer?.lastMessage ? (
                  <div className="mt-1 text-[11px] text-slate-500">
                    {sessionStatusText(selectedCustomer.sessionStatus)}
                    {selectedCustomer.lastActive
                      ? ` · ${formatDebugTime(selectedCustomer.lastActive)}`
                      : ""}
                    {selectedCustomer.lastMessage
                      ? ` · ${selectedCustomer.lastMessage}`
                      : ""}
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">
                  <span>买家会话列表</span>
                  <span>
                    {isLoadingCustomers ? "加载中" : `${customerOptions.length} 个`}
                  </span>
                </div>
                <div className="max-h-[260px] overflow-y-auto p-1">
                  {customerOptions.length === 0 ? (
                    <div className="px-3 py-4 text-[12px] leading-5 text-slate-400">
                      {navigateOpenKFID.trim()
                        ? "该客服账号下暂未获取到买家会话。"
                        : "请先选择客服账号。"}
                    </div>
                  ) : (
                    customerOptions.map((item) => {
                      const selected =
                        item.externalUserID === navigateExternalUserID.trim();
                      return (
                        <button
                          key={`${item.openKFID}:${item.externalUserID}`}
                          type="button"
                          className={`flex w-full flex-col rounded-xl px-3 py-2 text-left transition-colors ${
                            selected
                              ? "bg-blue-50 text-blue-700"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            setNavigateExternalUserID(item.externalUserID);
                            setNavigateNotice("");
                          }}
                        >
                          <span className="text-[12px] font-medium">
                            {item.label}
                          </span>
                          <span className="mt-0.5 font-mono text-[11px] text-slate-500">
                            {item.externalUserID}
                          </span>
                          <span className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">
                            {sessionStatusText(item.sessionStatus)}
                            {item.lastActive
                              ? ` · ${formatDebugTime(item.lastActive)}`
                              : ""}
                            {item.lastMessage ? ` · ${item.lastMessage}` : ""}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <Button
              size="sm"
              className="h-9 w-full rounded-full px-3 text-[12px]"
              disabled={isNavigating || !navigateOpenKFID.trim()}
              onClick={() => void handleNavigateToKfChat()}
            >
              <MessageSquareText className="mr-1 h-3.5 w-3.5" />
              {isNavigating ? "打开中..." : "测试 navigateToKfChat"}
            </Button>

            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500">
              说明：open_kfid 和 externalUserId 不是企业通讯录 userid，不能用
              open-data 直接解析姓名；这里使用接待渠道与会话读模型做真实业务回显。
              内部成员姓名仍由下方 open-data 模块验证。
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white/95 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <MessageSquareText className="h-4 w-4" />
              </div>
              <div>
                <div className={sidebarSectionLabel}>动作调试</div>
                <div className={`${sidebarMeta} mt-0.5`}>
                  这里的写操作会真实作用到当前企业微信会话
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-700">
              发送测试消息前，请确认你正在真实会话里，且理解这会直接影响当前客户侧沟通。
            </div>

            <Textarea
              className="min-h-[96px] rounded-2xl text-[12px] leading-5"
              placeholder="输入一条测试消息"
              value={sendText}
              onChange={(event) => setSendText(event.target.value)}
            />

            <label className="flex items-center gap-2 text-[12px] text-slate-600">
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
                className="h-8 rounded-full px-3 text-[11px]"
                disabled={isSendingText}
                onClick={() => void handleSendText()}
              >
                <Send className="mr-1 h-3.5 w-3.5" />
                {isSendingText ? "发送中..." : "测试 sendChatMessage"}
              </Button>
            </div>

            <SectionNotice text={sendNotice} tone={sendNotice.includes("失败") || sendNotice.includes("请") ? "warning" : "info"} />
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white/95 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <div className={sidebarSectionLabel}>OpenData 运行</div>
                <div className={`${sidebarMeta} mt-0.5`}>
                  验证 open-data 初始化与当前环境可用性
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={openDataBadge.variant} className="px-2 py-0.5 text-[10px]">
                {openDataBadge.text}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-slate-200 px-3 text-[11px]"
                disabled={isCheckingOpenData}
                onClick={() => void handleCheckOpenData()}
              >
                <RefreshCcw className={`mr-1 h-3.5 w-3.5 ${isCheckingOpenData ? "animate-spin" : ""}`} />
                检查 open-data
              </Button>
            </div>
          </div>

          <SectionNotice
            text={openDataNotice || openDataRuntime?.reason}
            tone={openDataRuntime?.canUseOpenData ? "info" : "warning"}
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
              <div className="text-[11px] font-medium text-slate-500">示例渲染</div>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                <WecomOpenDataName
                  userid={sampleOpenDataUserID}
                  fallback={sampleOpenDataFallback || sampleOpenDataUserID}
                  showHint
                  className="font-medium text-slate-800"
                  hintClassName="mt-1 text-[11px] text-slate-500"
                />
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[12px] text-slate-500">
              当前会话里没有可用于演示的内部成员标识，暂不展示 open-data 姓名渲染样例。
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
