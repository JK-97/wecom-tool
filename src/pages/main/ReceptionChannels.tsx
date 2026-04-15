import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import {
  Search,
  RefreshCw,
  ExternalLink,
  QrCode,
  Link as LinkIcon,
  MoreHorizontal,
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createReceptionChannel,
  generateReceptionSceneLink,
  getReceptionChannelsView,
  getReceptionChannelDetail,
  listKFServicerAssignments,
  retryReceptionChannelSync,
  triggerReceptionChannelSync,
  uploadReceptionChannelAvatar,
  upsertKFServicerAssignments,
  type ReceptionChannel,
  type ReceptionChannelDetail,
  type KFServicerAssignment,
  type KFServicerUpsertResponse,
  type KFServicerUpsertResult,
  type ReceptionOverview,
} from "@/services/receptionService";
import { normalizeErrorMessage } from "@/services/http";
import { executeRoutingRulesCommand } from "@/services/routingService";
import {
  buildRawServicerIDsByStableIdentity,
  mapSelectedUserIDsToPoolRaw,
  resolveServicerIdentityView,
} from "@/services/servicerIdentity";
import {
  getOrganizationSettingsView,
  type OrganizationSettingsView,
} from "@/services/organizationSettingsService";
import {
  buildDirectoryMaps,
  buildDirectoryTree,
  buildSelectedObjectDirectoryTree,
  normalizeSelectionItems,
  OrganizationDirectorySelect,
  selectionKey,
  type DirectoryDepartment,
  type DirectorySelectionItem,
} from "@/components/wecom/OrganizationDirectorySelect";
import { WecomOpenDataName } from "@/components/wecom/WecomOpenDataName";
import { WecomOpenDataDepartment } from "@/components/wecom/WecomOpenDataDepartment";

const selectionItemsFromAssignments = (
  assignments: KFServicerAssignment[],
): DirectorySelectionItem[] =>
  normalizeSelectionItems([
    ...assignments
      .map((item) => resolveServicerIdentityView(item).stableIdentity)
      .filter(Boolean)
      .map((userID) => ({ type: "user" as const, id: userID })),
    ...assignments
      .map((item) => Number(item.department_id || 0))
      .filter((departmentID) => departmentID > 0)
      .map((departmentID) => ({
        type: "department" as const,
        id: String(departmentID),
      })),
  ]);

const isSameSelection = (
  left: DirectorySelectionItem[],
  right: DirectorySelectionItem[],
): boolean => {
  const leftKeys = normalizeSelectionItems(left).map(selectionKey).sort();
  const rightKeys = normalizeSelectionItems(right).map(selectionKey).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((value, index) => value === rightKeys[index]);
};

const mergeServicerUpsertResponses = (
  responses: Array<KFServicerUpsertResponse | null>,
): KFServicerUpsertResponse | null => {
  const rows = responses.filter(Boolean) as KFServicerUpsertResponse[];
  if (rows.length === 0) return null;
  const resultList = rows.flatMap((item) => item.result_list || []);
  const successCount = resultList.filter((item) => item.status === "succeeded").length;
  const failureCount = resultList.length - successCount;
  return {
    summary: {
      overall_status:
        successCount > 0 && failureCount > 0
          ? "partial"
          : successCount > 0
            ? "succeeded"
            : "failed",
      total_count: resultList.length,
      success_count: successCount,
      failure_count: failureCount,
    },
    result_list: resultList,
  };
};

const formatConfiguredScopePrimary = (channel: ReceptionChannel): string => {
  if (channel.configured_uses_full_pool) return "整个接待池";
  const userCount = Number(channel.configured_user_count || 0);
  const departmentCount = Number(channel.configured_department_count || 0);
  if (userCount > 0 || departmentCount > 0) {
    return `成员 ${userCount} / 部门 ${departmentCount}`;
  }
  return "仅 AI";
};

const formatConfiguredScopeSecondary = (channel: ReceptionChannel): string => {
  if (channel.configured_uses_full_pool) {
    return `成员 ${Number(channel.pool_user_count || 0)} / 部门 ${Number(channel.pool_department_count || 0)}`;
  }
  const userCount = Number(channel.configured_user_count || 0);
  const departmentCount = Number(channel.configured_department_count || 0);
  if (userCount > 0 || departmentCount > 0) {
    return "已按启用中的人工路由去重汇总";
  }
  if (channel.pool_empty) {
    return "建议先配置接待池";
  }
  return "";
};

type RoutingActionMode =
  | "ai_only"
  | "send_to_pool"
  | "assign_human"
  | "queue_then_human"
  | "ai_then_assign_human"
  | "ai_then_queue_then_human";

type RoutingDispatchStrategy =
  | "none"
  | "specific_user"
  | "pool_dispatch"
  | "direct_if_available_else_queue"
  | "always_queue";

const DEFAULT_DIRECT_DISPATCH_THRESHOLD = 3;

const ACTION_MODE_OPTIONS: Array<{
  value: RoutingActionMode;
  label: string;
  description: string;
}> = [
  { value: "ai_only", label: "仅 AI", description: "仅由 AI 接待，不进入人工流程。" },
  { value: "send_to_pool", label: "送入待接入池", description: "立即进入人工体系，由接待池继续分配。" },
  { value: "assign_human", label: "转给指定人工", description: "直接分配给明确人工，不经过排队。" },
  { value: "queue_then_human", label: "排队后待人工接入", description: "立即进入排队，等待人工接入。" },
  { value: "ai_then_assign_human", label: "AI 接待后转人工", description: "先由 AI 接待，后续再转给人工。" },
  { value: "ai_then_queue_then_human", label: "AI 命中条件后转人工 - 先进入排队，等待自动分配", description: "先由 AI 接待；命中当前路由条件后，先进入排队，再等待系统自动分配人工。" },
];

const DISPATCH_STRATEGY_OPTIONS: Record<
  RoutingActionMode,
  Array<{ value: RoutingDispatchStrategy; label: string; description: string }>
> = {
  ai_only: [{ value: "none", label: "无需人工分配", description: "当前动作不会进入人工流程。" }],
  send_to_pool: [
    { value: "pool_dispatch", label: "交给接待池分配", description: "进入人工体系后，由接待池继续承接。" },
    { value: "direct_if_available_else_queue", label: "有空位先直分，否则排队", description: "有空闲人工则直接分配，否则进入排队。" },
  ],
  assign_human: [{ value: "specific_user", label: "直接指定人工", description: "明确指定 1 名人工直接承接。" }],
  queue_then_human: [{ value: "always_queue", label: "始终进入排队", description: "不做即时分配，直接进入排队。" }],
  ai_then_assign_human: [
    { value: "specific_user", label: "直接指定人工", description: "AI 接待后，直接转给明确人工。" },
    { value: "direct_if_available_else_queue", label: "有空位先直分，否则排队", description: "AI 接待后，若有空位则直分，否则进入排队。" },
  ],
  ai_then_queue_then_human: [{ value: "always_queue", label: "先进入排队，等待自动分配", description: "AI 命中条件后，先进入排队，后续由系统自动分配人工。" }],
};

const actionModeLabel = (actionMode?: string): string =>
  ACTION_MODE_OPTIONS.find((item) => item.value === (actionMode || "").trim())?.label || "仅 AI";

const defaultDispatchStrategyForActionMode = (actionMode: RoutingActionMode): RoutingDispatchStrategy =>
  DISPATCH_STRATEGY_OPTIONS[actionMode][0]?.value || "none";

const dispatchStrategyLabel = (strategy?: string): string => {
  for (const options of Object.values(DISPATCH_STRATEGY_OPTIONS)) {
    const matched = options.find((item) => item.value === (strategy || "").trim());
    if (matched) return matched.label;
  }
  return "无需人工分配";
};

const actionModeRequiresHuman = (actionMode?: string): boolean =>
  (actionMode || "").trim() !== "ai_only";

const dispatchStrategySupportsHumanScope = (strategy?: string): boolean =>
  ["specific_user", "pool_dispatch", "direct_if_available_else_queue", "always_queue"].includes(
    (strategy || "").trim(),
  );

const dispatchStrategyRequiresSpecificUser = (strategy?: string): boolean =>
  (strategy || "").trim() === "specific_user";



function ServicerUpsertResultPanel({
  result,
  formatReason,
  orgCorpID,
  orgDepartmentMap,
}: {
  result: KFServicerUpsertResponse | null;
  formatReason: (item: KFServicerUpsertResult) => string;
  orgCorpID: string;
  orgDepartmentMap: Map<number, DirectoryDepartment>;
}) {
  if (!result) return null;
  const summary = result.summary;
  const overallStatus = (summary?.overall_status || "").trim();
  const resultList = result.result_list || [];
  if (!summary && resultList.length === 0) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3">
      <div
        className={`rounded-lg px-3 py-2 text-xs ${
          overallStatus === "succeeded"
            ? "bg-green-50 text-green-700"
            : overallStatus === "partial"
              ? "bg-orange-50 text-orange-700"
              : "bg-red-50 text-red-700"
        }`}
      >
        {overallStatus === "succeeded"
          ? "已保存，当前修改已生效。"
          : overallStatus === "partial"
            ? `部分保存成功：成功 ${Number(summary?.success_count || 0)} 项，失败 ${Number(summary?.failure_count || 0)} 项。`
            : "这次保存没有完成，请根据下面的提示调整后重试。"}
      </div>
      {resultList.length > 0 ? (
        <div className="space-y-2">
          {resultList.map((item, index) => (
            <div
              key={`${item.target_type || "unknown"}-${item.target_id || index}-${item.reason_code || item.status || "result"}`}
              className={`rounded-lg border px-3 py-2 text-xs ${
                item.status === "succeeded"
                  ? "border-green-200 bg-white text-gray-700"
                  : "border-orange-200 bg-white text-gray-700"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">
                  {item.target_type === "department" ? (
                    <WecomOpenDataDepartment
                      departmentId={Number(item.department_id || item.target_id || 0)}
                      corpId={orgCorpID}
                      fallback={
                        (orgDepartmentMap.get(
                          Number(item.department_id || item.target_id || 0),
                        )?.name || "").trim() ||
                        `部门 #${item.department_id || item.target_id || "-"}`
                      }
                      className="text-xs font-medium text-inherit"
                      hintClassName="text-[10px] opacity-70"
                    />
                  ) : (
                    <WecomOpenDataName
                      userid={(item.userid || item.target_id || "").trim()}
                      corpId={orgCorpID}
                      fallback={(item.userid || item.target_id || "").trim()}
                      className="text-xs font-medium text-inherit"
                    />
                  )}
                </span>
                <Badge
                  variant={item.status === "succeeded" ? "success" : "warning"}
                  className={
                    item.status === "succeeded"
                      ? "bg-green-100 text-green-700"
                      : "bg-orange-100 text-orange-700"
                  }
                >
                  {item.status === "succeeded" ? "已保存" : "未保存"}
                </Badge>
              </div>
              <div className="mt-1">{formatReason(item)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ReceptionChannels() {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] =
    useState<ReceptionChannel | null>(null);
  const [selectedChannelDetail, setSelectedChannelDetail] =
    useState<ReceptionChannelDetail | null>(null);
  const [servicerAssignments, setServicerAssignments] = useState<KFServicerAssignment[]>([]);
  const [overview, setOverview] = useState<ReceptionOverview | null>(null);
  const [channels, setChannels] = useState<ReceptionChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpsertingServicers, setIsUpsertingServicers] = useState(false);
  const [notice, setNotice] = useState("");
  const [detailNotice, setDetailNotice] = useState("");
  const [createNotice, setCreateNotice] = useState("");
  const [poolEditorNotice, setPoolEditorNotice] = useState("");
  const [fallbackEditorNotice, setFallbackEditorNotice] = useState("");
  const [keyword, setKeyword] = useState("");
  const [organizationView, setOrganizationView] =
    useState<OrganizationSettingsView | null>(null);
  const [isOrgOptionsLoading, setIsOrgOptionsLoading] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createAvatarFile, setCreateAvatarFile] = useState<File | null>(null);
  const [createInitialPoolTargets, setCreateInitialPoolTargets] = useState<
    DirectorySelectionItem[]
  >([]);
  const [selectedSceneValue, setSelectedSceneValue] = useState("");
  const [isGeneratingSceneLink, setIsGeneratingSceneLink] = useState(false);
  const [selectedServicerTargets, setSelectedServicerTargets] = useState<
    DirectorySelectionItem[]
  >([]);
  const [isPoolEditorOpen, setIsPoolEditorOpen] = useState(false);
  const [servicerUpsertResult, setServicerUpsertResult] =
    useState<KFServicerUpsertResponse | null>(null);
  const [fallbackActionModeInput, setFallbackActionModeInput] =
    useState<RoutingActionMode>("ai_only");
  const [fallbackDispatchStrategyInput, setFallbackDispatchStrategyInput] =
    useState<RoutingDispatchStrategy>("none");
  const [fallbackDispatchCapacityThresholdInput, setFallbackDispatchCapacityThresholdInput] =
    useState(DEFAULT_DIRECT_DISPATCH_THRESHOLD);
  const [fallbackUseFullPoolInput, setFallbackUseFullPoolInput] = useState(true);
  const [selectedFallbackTargets, setSelectedFallbackTargets] = useState<
    DirectorySelectionItem[]
  >([]);
  const [isSavingFallbackRoute, setIsSavingFallbackRoute] = useState(false);
  const [isFallbackEditorOpen, setIsFallbackEditorOpen] = useState(false);

  const loadChannels = async (query?: string) => {
    try {
      setIsLoading(true);
      const view = await getReceptionChannelsView({
        query: query || "",
        limit: 200,
      });
      setOverview(view?.overview || null);
      setChannels(view?.channels || []);
    } catch (error) {
      setNotice(normalizeErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadChannels();
  }, []);

  const loadOrganizationOptions = async () => {
    if (isOrgOptionsLoading) return;
    try {
      setIsOrgOptionsLoading(true);
      const view = await getOrganizationSettingsView();
      setOrganizationView(view);
    } catch (error) {
      setNotice(normalizeErrorMessage(error));
    } finally {
      setIsOrgOptionsLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadChannels(keyword);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if ((!isDetailOpen && !isCreateOpen) || organizationView) return;
    void loadOrganizationOptions();
  }, [isCreateOpen, isDetailOpen, organizationView]);

  const handleSync = async () => {
    setIsSyncing(true);
    const target = selectedChannel?.open_kfid || channels[0]?.open_kfid;
    if (!target) {
      setNotice("当前没有可刷新的接待渠道");
      setIsSyncing(false);
      return;
    }
    try {
      const accepted = await triggerReceptionChannelSync(target);
      setNotice(
        accepted
          ? "已提交接待渠道刷新任务。成员树和部门树如需更新，请前往“组织与设置”同步组织架构。"
          : "接待渠道刷新任务未被接受",
      );
      await loadChannels(keyword);
    } catch (error) {
      setNotice(normalizeErrorMessage(error));
    } finally {
      setIsSyncing(false);
    }
  };

  const loadDetail = async (channel: ReceptionChannel) => {
    setSelectedChannel(channel);
    setSelectedChannelDetail(null);
    setServicerUpsertResult(null);
    setSelectedServicerTargets([]);
    setDetailNotice("");
    setPoolEditorNotice("");
    setFallbackEditorNotice("");
    setIsDetailLoading(true);
    setIsDetailOpen(true);
    if (!channel.open_kfid) {
      setIsDetailLoading(false);
      return;
    }
    try {
      const detail = await getReceptionChannelDetail(channel.open_kfid);
      setSelectedChannelDetail(detail);
      const assignments = await listKFServicerAssignments(channel.open_kfid);
      setServicerAssignments(assignments);
      setSelectedServicerTargets(
        selectionItemsFromAssignments(assignments),
      );
      syncFallbackDraftFromDetail(detail, assignments);
    } catch (error) {
      setDetailNotice(normalizeErrorMessage(error));
      setSelectedChannelDetail(null);
      setServicerAssignments([]);
      setServicerUpsertResult(null);
      setSelectedServicerTargets([]);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const retrySync = async (openKFID: string) => {
    if (!openKFID) return;
    try {
      const retried = await retryReceptionChannelSync(openKFID);
      setNotice(
        retried > 0 ? `已重试 ${retried} 个失败任务` : "没有需要重试的失败任务",
      );
      await loadChannels(keyword);
    } catch (error) {
      setNotice(normalizeErrorMessage(error));
    }
  };

  const formatDateTime = (value?: string): string => {
    const text = (value || "").trim();
    if (!text) return "-";
    const parsed = Date.parse(text);
    if (Number.isNaN(parsed)) {
      return text;
    }
    return new Date(parsed).toLocaleString("zh-CN", { hour12: false });
  };

  const syncFallbackDraftFromDetail = (
    detail: ReceptionChannelDetail | null,
    assignments?: KFServicerAssignment[],
  ) => {
    const stableIdentityByRaw = new Map<string, string>();
    (assignments || servicerAssignments).forEach((assignment) => {
      const identity = resolveServicerIdentityView(assignment);
      const rawID = identity.rawServicerUserID.trim();
      const stableID = (identity.stableIdentity || rawID).trim();
      if (!rawID || !stableID) return;
      stableIdentityByRaw.set(rawID, stableID);
    });
    const actionMode = ((detail?.fallback_route?.action_mode || "").trim() ||
      "ai_only") as RoutingActionMode;
    const dispatchStrategy = ((detail?.fallback_route?.dispatch_strategy || "").trim() ||
      defaultDispatchStrategyForActionMode(actionMode)) as RoutingDispatchStrategy;
    setFallbackActionModeInput(actionMode);
    setFallbackDispatchStrategyInput(dispatchStrategy);
    setFallbackDispatchCapacityThresholdInput(
      Number(
        detail?.fallback_route?.dispatch_capacity_threshold ||
          (dispatchStrategy === "direct_if_available_else_queue"
            ? DEFAULT_DIRECT_DISPATCH_THRESHOLD
            : 0),
      ),
    );
    const fallbackTarget = detail?.fallback_route?.target;
    setFallbackUseFullPoolInput(
      detail?.fallback_route?.use_full_pool ?? fallbackTarget?.useFullPool ?? false,
    );
    setSelectedFallbackTargets(
      normalizeSelectionItems([
        ...(fallbackTarget?.userIds || []).map((userID) => ({
          type: "user" as const,
          id: stableIdentityByRaw.get(String(userID || "").trim()) || String(userID || "").trim(),
        })),
        ...(fallbackTarget?.departmentIds || []).map((departmentID) => ({
          type: "department" as const,
          id: String(departmentID),
        })),
      ]),
    );
  };

  const handleCreateChannel = async () => {
    const name = createName.trim();
    if (!name) {
      setCreateNotice("请输入客服账号名称");
      return;
    }
    if (createInitialUserIDs.length === 0 && createInitialDepartmentIDs.length === 0) {
      setCreateNotice("请至少选择一个初始接待成员或部门");
      return;
    }
    if (createAvatarFile) {
      const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
      if (!allowedTypes.has(createAvatarFile.type)) {
        setCreateNotice("请上传 PNG/JPG/JPEG/WEBP 图片");
        return;
      }
      if (createAvatarFile.size > 2 * 1024 * 1024) {
        setCreateNotice("头像图片不能超过 2MB");
        return;
      }
    }
    try {
      setIsCreating(true);
      setCreateNotice("");
      let mediaID = "";
      if (createAvatarFile) {
        const uploaded = await uploadReceptionChannelAvatar(createAvatarFile);
        mediaID = (uploaded?.media_id || "").trim();
        if (!mediaID) {
          throw new Error("头像上传失败，请重试");
        }
      }
      const created = await createReceptionChannel({
        name,
        media_id: mediaID,
        initial_user_ids: createInitialUserIDs,
        initial_department_ids: createInitialDepartmentIDs,
      });
      setNotice(created?.open_kfid ? "客服账号已创建" : "客服账号创建完成");
      setIsCreateOpen(false);
      setCreateName("");
      setCreateAvatarFile(null);
      setCreateInitialPoolTargets([]);
      await loadChannels(keyword);
      if (created?.open_kfid) {
        await loadDetail(created);
      }
    } catch (error) {
      setCreateNotice(normalizeErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  };

  const closeCreateDialog = () => {
    setIsCreateOpen(false);
    setCreateName("");
    setCreateAvatarFile(null);
    setCreateInitialPoolTargets([]);
    setCreateNotice("");
  };

  const primaryScene = useMemo(() => {
    const scenes = selectedChannelDetail?.scenes || [];
    return scenes.length > 0 ? scenes[0] : null;
  }, [selectedChannelDetail?.scenes]);

  useEffect(() => {
    const scenes = selectedChannelDetail?.scenes || [];
    if (scenes.length === 0) {
      setSelectedSceneValue("");
      return;
    }
    const preferred = (selectedSceneValue || "").trim();
    if (
      preferred &&
      scenes.some((item) => (item.scene_value || "").trim() === preferred)
    ) {
      return;
    }
    setSelectedSceneValue((scenes[0]?.scene_value || "").trim());
  }, [selectedChannelDetail?.scenes]);

  const selectedScene = useMemo(() => {
    const scenes = selectedChannelDetail?.scenes || [];
    const key = (selectedSceneValue || "").trim();
    if (!key) {
      return (
        scenes.find((item) => (item.scene_value || "").trim() === "") ||
        scenes[0] ||
        null
      );
    }
    return (
      scenes.find((item) => (item.scene_value || "").trim() === key) ||
      scenes[0] ||
      null
    );
  }, [selectedChannelDetail?.scenes, selectedSceneValue]);

  const assignedUsers = useMemo(
    () =>
      servicerAssignments
        .map((item) => (item.userid || "").trim())
        .filter(Boolean),
    [servicerAssignments],
  );
  const assignedDepartments = useMemo(
    () =>
      servicerAssignments
        .map((item) => Number(item.department_id || 0))
        .filter((item) => item > 0),
    [servicerAssignments],
  );

  const orgCorpID = (organizationView?.integration?.corp_id || "").trim();
  const { departmentMap: orgDepartmentMap, memberMap: orgMemberMap } =
    useMemo(() => buildDirectoryMaps(organizationView), [organizationView]);

  useEffect(() => {
    if (isPoolEditorOpen) return;
    if (servicerAssignments.length === 0) {
      setSelectedServicerTargets([]);
      return;
    }
    setSelectedServicerTargets(
      selectionItemsFromAssignments(servicerAssignments),
    );
  }, [isPoolEditorOpen, servicerAssignments]);

  const { treeRoots, ungroupedUsers: ungroupedUserIDs } = useMemo(
    () => buildDirectoryTree(organizationView),
    [organizationView],
  );

  const selectedServicerTargetsDeduped = useMemo(
    () => normalizeSelectionItems(selectedServicerTargets),
    [selectedServicerTargets],
  );
  const createInitialPoolTargetsDeduped = useMemo(
    () => normalizeSelectionItems(createInitialPoolTargets),
    [createInitialPoolTargets],
  );
  const createInitialUserIDs = useMemo(
    () =>
      createInitialPoolTargetsDeduped
        .filter((item) => item.type === "user")
        .map((item) => item.id.trim())
        .filter(Boolean),
    [createInitialPoolTargetsDeduped],
  );
  const createInitialDepartmentIDs = useMemo(
    () =>
      createInitialPoolTargetsDeduped
        .filter((item) => item.type === "department")
        .map((item) => Number(item.id))
        .filter((item) => Number.isInteger(item) && item > 0),
    [createInitialPoolTargetsDeduped],
  );
  const selectedServicerUsersDeduped = useMemo(
    () =>
      selectedServicerTargetsDeduped
        .filter((item) => item.type === "user")
        .map((item) => item.id.trim())
        .filter(Boolean),
    [selectedServicerTargetsDeduped],
  );
  const selectedServicerDepartmentsDeduped = useMemo(
    () =>
      selectedServicerTargetsDeduped
        .filter((item) => item.type === "department")
        .map((item) => Number(item.id))
        .filter((item) => Number.isInteger(item) && item > 0),
    [selectedServicerTargetsDeduped],
  );
  const selectedFallbackTargetsDeduped = useMemo(
    () => normalizeSelectionItems(selectedFallbackTargets),
    [selectedFallbackTargets],
  );
  const selectedFallbackUsersDeduped = useMemo(
    () =>
      selectedFallbackTargetsDeduped
        .filter((item) => item.type === "user")
        .map((item) => item.id.trim())
        .filter(Boolean),
    [selectedFallbackTargetsDeduped],
  );
  const selectedFallbackDepartmentsDeduped = useMemo(
    () =>
      selectedFallbackTargetsDeduped
        .filter((item) => item.type === "department")
        .map((item) => Number(item.id))
        .filter((item) => Number.isInteger(item) && item > 0),
    [selectedFallbackTargetsDeduped],
  );
  const currentPoolSelection = useMemo(
    () => selectionItemsFromAssignments(servicerAssignments),
    [servicerAssignments],
  );
  const currentPoolAllowedUserIDs = useMemo(
    () =>
      currentPoolSelection
        .filter((item) => item.type === "user")
        .map((item) => item.id.trim())
        .filter(Boolean),
    [currentPoolSelection],
  );
  const currentPoolAllowedDepartmentIDs = useMemo(
    () =>
      currentPoolSelection
        .filter((item) => item.type === "department")
        .map((item) => Number(item.id))
        .filter((item) => Number.isInteger(item) && item > 0),
    [currentPoolSelection],
  );
  const {
    treeRoots: fallbackTreeRoots,
    ungroupedUsers: fallbackUngroupedUserIDs,
  } = useMemo(
    () =>
      buildSelectedObjectDirectoryTree(
        organizationView,
        currentPoolAllowedUserIDs,
        currentPoolAllowedDepartmentIDs,
      ),
    [organizationView, currentPoolAllowedDepartmentIDs, currentPoolAllowedUserIDs],
  );
  const currentPoolRawUsersByNormalizedID = useMemo(
    () => buildRawServicerIDsByStableIdentity(servicerAssignments),
    [servicerAssignments],
  );
  const poolSelectionChanged = useMemo(
    () => !isSameSelection(currentPoolSelection, selectedServicerTargetsDeduped),
    [currentPoolSelection, selectedServicerTargetsDeduped],
  );

  const receptionPool = selectedChannelDetail?.reception_pool;
  const fallbackRoute = selectedChannelDetail?.fallback_route;
  const stateLayers = selectedChannelDetail?.state_layers;
  const isPoolEmpty =
    receptionPool?.empty === true ||
    (Number(receptionPool?.user_count || 0) === 0 &&
      Number(receptionPool?.department_count || 0) === 0);

  const fallbackDispatchOptions = useMemo(
    () =>
      DISPATCH_STRATEGY_OPTIONS[fallbackActionModeInput] ||
      DISPATCH_STRATEGY_OPTIONS.ai_only,
    [fallbackActionModeInput],
  );

  const promotionURL = (selectedScene?.url || "").trim();

  const ensurePromotionURL = async (): Promise<string> => {
    const openKFID =
      (selectedChannelDetail?.channel?.open_kfid || selectedChannel?.open_kfid || "").trim();
    const sceneValue = (selectedScene?.scene_value || "").trim();
    const currentURL = (selectedScene?.url || "").trim();
    if (currentURL) {
      return currentURL;
    }
    if (!openKFID) {
      throw new Error("当前场景不可生成正式客服链接");
    }
    setIsGeneratingSceneLink(true);
    try {
      const generated = await generateReceptionSceneLink({
        open_kfid: openKFID,
        scene_value: sceneValue,
      });
      const nextURL = (generated?.url || "").trim();
      if (!nextURL) {
        throw new Error("未生成有效的客服链接");
      }
      setSelectedChannelDetail((current) => {
        if (!current) return current;
        const nextScenes = (current.scenes || []).map((item) =>
          (item.scene_value || "").trim() === sceneValue
            ? { ...item, url: nextURL }
            : item,
        );
        return {
          ...current,
          scenes: nextScenes,
          promotion_url:
            sceneValue === (nextScenes[0]?.scene_value || "").trim()
              ? nextURL
              : current.promotion_url,
        };
      });
      return nextURL;
    } finally {
      setIsGeneratingSceneLink(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = await ensurePromotionURL();
      await navigator.clipboard.writeText(url);
      setDetailNotice("推广链接已复制");
    } catch (error) {
      setDetailNotice(normalizeErrorMessage(error) || "复制失败，请手动复制");
    }
  };

  const handleDownloadQRCode = async () => {
    try {
      const promotionLink = await ensurePromotionURL();
      const query = new URLSearchParams({ text: promotionLink, size: "512" });
      const response = await fetch(
        `/api/v1/routing/qrcode?${query.toString()}`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) {
        throw new Error(`二维码下载失败(${response.status})`);
      }
      const blob = await response.blob();
      const downloadURL = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadURL;
      anchor.download = `${(selectedChannel?.open_kfid || "reception_channel").trim()}-${(selectedScene?.scene_value || primaryScene?.scene_value || "无场景").trim() || "无场景"}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadURL);
      setDetailNotice("二维码下载已开始");
    } catch (error) {
      setDetailNotice(normalizeErrorMessage(error));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-50 text-green-700 border-green-200">
            正常
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-50 text-red-700 border-red-200">异常</Badge>
        );
      case "syncing":
      case "pending":
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200">
            同步中
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-50 text-red-700 border-red-200">
            同步失败
          </Badge>
        );
      case "muted":
        return (
          <Badge className="bg-gray-50 text-gray-700 border-gray-200">
            停用
          </Badge>
        );
      default:
        return null;
    }
  };

  const getDisplayName = (channel?: ReceptionChannel | null): string => {
    const openKFID = (channel?.open_kfid || "").trim();
    const candidates = [
      (channel?.display_name || "").trim(),
      (channel?.name || "").trim(),
    ];
    for (const candidate of candidates) {
      if (isValidChannelDisplayName(candidate, openKFID)) {
        return candidate;
      }
    }
    return "未命名客服渠道";
  };

  const getAvatarURL = (channel?: ReceptionChannel | null): string => {
    return (channel?.avatar_url || "").trim();
  };

  const isValidChannelDisplayName = (value: string, openKFID: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed === "未命名客服渠道") return false;
    if (openKFID && trimmed === openKFID) return false;
    if (openKFID && trimmed === `渠道 ${openKFID}`) return false;
    if (/^[A-Za-z0-9_:-]+$/.test(trimmed)) return false;
    return true;
  };

  const formatServicerReason = (item: KFServicerUpsertResult): string => {
    const reason = (item.reason || "").trim();
    if (reason) return reason;
    const errmsg = (item.errmsg || "").trim();
    if (errmsg) return errmsg;
    switch ((item.reason_code || "").trim()) {
      case "unknown_user":
        return "该成员未同步到当前组织模型中";
      case "unknown_department":
        return "该部门未同步到当前组织模型中";
      case "user_not_in_app_visibility":
        return "该成员不在当前应用成员可见范围内";
      case "department_not_in_app_visibility":
        return "该部门不在当前应用部门可见范围内";
      case "permission_or_visibility_denied":
        return "企业微信拒绝本次分配，可能是应用可见范围不足或缺少编辑权限";
      case "ok":
        return "写入成功";
      default:
        return item.status === "succeeded" ? "写入成功" : "未返回详细原因";
    }
  };

  const handleServicerPoolSave = async () => {
    const openKFID = (
      selectedChannelDetail?.channel?.open_kfid ||
      selectedChannel?.open_kfid ||
      ""
    ).trim();
    if (!openKFID) {
      setPoolEditorNotice("当前渠道缺少 Open KFID");
      return;
    }
    const currentSelection = selectionItemsFromAssignments(servicerAssignments);
    const desiredSelection = selectedServicerTargetsDeduped;
    if (desiredSelection.length === 0) {
      setPoolEditorNotice("当前未选择任何接待对象，请至少保留一个成员或部门。");
      return;
    }
    if (isSameSelection(currentSelection, desiredSelection)) {
      setServicerUpsertResult(null);
      setPoolEditorNotice("接待池配置没有变化。");
      return;
    }
    const currentUserSet = new Set(
      currentSelection
        .filter((item) => item.type === "user")
        .map((item) => item.id.trim())
        .filter(Boolean),
    );
    const currentDepartmentSet = new Set(
      currentSelection
        .filter((item) => item.type === "department")
        .map((item) => Number(item.id))
        .filter((item) => Number.isInteger(item) && item > 0),
    );
    const desiredUserSet = new Set(selectedServicerUsersDeduped);
    const desiredDepartmentSet = new Set(selectedServicerDepartmentsDeduped);
    const addUsers = selectedServicerUsersDeduped.filter((item) => !currentUserSet.has(item));
    const addDepartments = selectedServicerDepartmentsDeduped.filter(
      (item) => !currentDepartmentSet.has(item),
    );
    const removeUsers = Array.from(currentUserSet).flatMap((item) => {
      if (desiredUserSet.has(item)) return [];
      const rawIDs = currentPoolRawUsersByNormalizedID.get(item) || [item];
      return rawIDs;
    });
    const removeDepartments = Array.from(currentDepartmentSet).filter(
      (item) => !desiredDepartmentSet.has(item),
    );
    try {
      setIsUpsertingServicers(true);
      setPoolEditorNotice("");
      const responses: Array<KFServicerUpsertResponse | null> = [];
      if (addUsers.length > 0 || addDepartments.length > 0) {
        responses.push(
          await upsertKFServicerAssignments({
            open_kfid: openKFID,
            op: "add",
            userid_list: addUsers,
            department_id_list: addDepartments,
          }),
        );
      }
      if (removeUsers.length > 0 || removeDepartments.length > 0) {
        responses.push(
          await upsertKFServicerAssignments({
            open_kfid: openKFID,
            op: "del",
            userid_list: removeUsers,
            department_id_list: removeDepartments,
          }),
        );
      }
      const result = mergeServicerUpsertResponses(responses);
      setServicerUpsertResult(result);
      const summary = result?.summary;
      const successCount = Number(summary?.success_count || 0);
      const failureCount = Number(summary?.failure_count || 0);
      const overallStatus = (summary?.overall_status || "").trim();
      if (overallStatus === "succeeded") {
        setPoolEditorNotice("接待池配置已更新。");
      } else if (overallStatus === "partial") {
        setPoolEditorNotice(`部分对象保存成功：成功 ${successCount} 项，失败 ${failureCount} 项。`);
      } else {
        setPoolEditorNotice(`接待池保存未完成：失败 ${failureCount} 项。`);
      }
      if (successCount > 0) {
        const refreshedAssignments = await listKFServicerAssignments(openKFID);
        setServicerAssignments(refreshedAssignments);
        const refreshedDetail = await getReceptionChannelDetail(openKFID);
        setSelectedChannelDetail(refreshedDetail);
        setSelectedServicerTargets(
          selectionItemsFromAssignments(refreshedAssignments),
        );
        if (overallStatus === "succeeded" || (successCount > 0 && failureCount === 0)) {
          setIsPoolEditorOpen(false);
        }
        await loadChannels(keyword);
      }
    } catch (error) {
      setPoolEditorNotice(normalizeErrorMessage(error));
      setServicerUpsertResult(null);
    } finally {
      setIsUpsertingServicers(false);
    }
  };

  const handleFallbackRouteSave = async () => {
    const openKFID = (
      selectedChannelDetail?.channel?.open_kfid ||
      selectedChannel?.open_kfid ||
      ""
    ).trim();
    if (!openKFID) {
      setFallbackEditorNotice("当前渠道缺少 Open KFID");
      return;
    }
    const humanUserIDs = mapSelectedUserIDsToPoolRaw(
      selectedFallbackUsersDeduped,
      currentPoolRawUsersByNormalizedID,
    );
    const humanDepartmentIDs = selectedFallbackDepartmentsDeduped;
    const actionMode = fallbackActionModeInput;
    const dispatchStrategy = fallbackDispatchStrategyInput;
    const requiresHuman = actionModeRequiresHuman(actionMode);
    const useFullPool =
      !requiresHuman || dispatchStrategyRequiresSpecificUser(dispatchStrategy)
        ? actionMode === "ai_only"
        : fallbackUseFullPoolInput;
    if (isPoolEmpty && requiresHuman) {
      setFallbackEditorNotice("当前接待池为空，只能配置“仅 AI”兜底。");
      return;
    }
    if (
      dispatchStrategyRequiresSpecificUser(dispatchStrategy) &&
      (humanDepartmentIDs.length > 0 || humanUserIDs.length !== 1)
    ) {
      setFallbackEditorNotice("当前分配策略需要明确指定 1 名人工成员，请只选择一名接待成员。");
      return;
    }
    if (
      requiresHuman &&
      !useFullPool &&
      dispatchStrategySupportsHumanScope(dispatchStrategy) &&
      humanUserIDs.length === 0 &&
      humanDepartmentIDs.length === 0
    ) {
      setFallbackEditorNotice(
        "已关闭“使用整个接待池”，请至少选择一个接待对象，或切回“使用整个接待池”。",
      );
      return;
    }
    try {
      setIsSavingFallbackRoute(true);
      setFallbackEditorNotice("");
      const result = await executeRoutingRulesCommand({
        command: "configure_fallback_route",
        open_kfid: openKFID,
        payload: {
          action_mode: actionMode,
          dispatch_strategy: dispatchStrategy,
          dispatch_capacity_threshold:
            dispatchStrategy === "direct_if_available_else_queue"
              ? Number(
                  fallbackDispatchCapacityThresholdInput ||
                    DEFAULT_DIRECT_DISPATCH_THRESHOLD,
                )
              : 0,
          use_full_pool: useFullPool,
          human_target_type:
            !requiresHuman || useFullPool
              ? ""
              : humanUserIDs.length > 0 && humanDepartmentIDs.length > 0
                ? "mixed"
                : humanDepartmentIDs.length > 0
                  ? "department"
                  : humanUserIDs.length > 0
                    ? "user"
                    : "",
          human_user_ids:
            !requiresHuman || useFullPool ? [] : humanUserIDs,
          human_department_ids:
            !requiresHuman || useFullPool ? [] : humanDepartmentIDs,
        },
      });
      if (result?.success) {
        setFallbackEditorNotice(result.message || "兜底路由已更新");
      } else {
        setFallbackEditorNotice(result?.message || "兜底路由更新失败");
      }
      const refreshedDetail = await getReceptionChannelDetail(openKFID);
      setSelectedChannelDetail(refreshedDetail);
      syncFallbackDraftFromDetail(refreshedDetail);
      setIsFallbackEditorOpen(false);
      await loadChannels(keyword);
    } catch (error) {
      setFallbackEditorNotice(normalizeErrorMessage(error));
    } finally {
      setIsSavingFallbackRoute(false);
    }
  };

  const openPoolEditor = () => {
    setSelectedServicerTargets(
      selectionItemsFromAssignments(servicerAssignments),
    );
    setServicerUpsertResult(null);
    setPoolEditorNotice("");
    setIsPoolEditorOpen(true);
  };

  const closePoolEditor = () => {
    setSelectedServicerTargets(
      selectionItemsFromAssignments(servicerAssignments),
    );
    setServicerUpsertResult(null);
    setPoolEditorNotice("");
    setIsPoolEditorOpen(false);
  };

  const openFallbackEditor = () => {
    syncFallbackDraftFromDetail(selectedChannelDetail);
    setFallbackEditorNotice("");
    setIsFallbackEditorOpen(true);
  };

  const closeFallbackEditor = () => {
    syncFallbackDraftFromDetail(selectedChannelDetail);
    setFallbackEditorNotice("");
    setIsFallbackEditorOpen(false);
  };

  const renderSelectionSummary = (
    items: DirectorySelectionItem[],
    options?: { maxItems?: number; emptyText?: string },
  ) => {
    const maxItems = options?.maxItems ?? 6;
    const normalized = normalizeSelectionItems(items);
    if (normalized.length === 0) {
      return (
        <div className="text-xs text-gray-500">
          {options?.emptyText || "当前未选择成员或部门"}
        </div>
      );
    }
    const visibleItems = normalized.slice(0, maxItems);
    const extraCount = normalized.length - visibleItems.length;
    return (
      <div className="flex flex-wrap gap-2">
        {visibleItems.map((item) =>
          item.type === "department" ? (
            <Badge
              key={selectionKey(item)}
              variant="secondary"
              className="bg-blue-50 text-blue-700 border-transparent"
            >
              <WecomOpenDataDepartment
                departmentId={Number(item.id)}
                corpId={orgCorpID}
                fallback={
                  (orgDepartmentMap.get(Number(item.id))?.name || "").trim() ||
                  `部门 #${item.id}`
                }
                className="text-xs font-medium text-blue-700"
                hintClassName="text-[10px] text-blue-300"
              />
            </Badge>
          ) : (
            <Badge
              key={selectionKey(item)}
              variant="secondary"
              className="bg-gray-100 text-gray-700 border-transparent"
            >
              <WecomOpenDataName
                userid={item.id}
                corpId={orgCorpID}
                fallback={item.id}
                className="text-xs font-medium text-gray-700"
              />
            </Badge>
          ),
        )}
        {extraCount > 0 ? (
          <Badge variant="secondary" className="bg-white text-gray-500 border-gray-200">
            还有 {extraCount} 项
          </Badge>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 flex items-center gap-4 border-none shadow-sm">
          <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center">
            <LinkIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">渠道总数</p>
            <p className="text-2xl font-bold text-gray-900">
              {overview?.total_channels ?? 0}
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-none shadow-sm">
          <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">启用中</p>
            <p className="text-2xl font-bold text-gray-900">
              {overview?.active_channels ?? 0}
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-none shadow-sm">
          <div className="h-12 w-12 rounded-lg bg-red-50 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">异常渠道</p>
            <p className="text-2xl font-bold text-gray-900">
              {overview?.abnormal_channels ?? 0}
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-none shadow-sm">
          <div className="h-12 w-12 rounded-lg bg-orange-50 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">待同步</p>
            <p className="text-2xl font-bold text-gray-900">
              {overview?.pending_sync ?? 0}
            </p>
          </div>
        </Card>
      </div>
      {overview?.latest_sync_status || (overview?.tips || []).length > 0 ? (
        <Card className="p-3 border-none shadow-sm bg-blue-50 text-xs text-blue-700">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {overview?.latest_sync_status ? (
              <span>
                最近同步状态：{overview.latest_sync_status}
                {overview?.latest_sync_time
                  ? ` (${formatDateTime(overview.latest_sync_time)})`
                  : ""}
              </span>
            ) : null}
            {(overview?.tips || []).map((tip) => (
              <span key={tip}>提示：{tip}</span>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Main Content */}
      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索渠道名称或 ID..."
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              刷新接待渠道
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/main/guide">
              <Button variant="outline" size="sm" className="text-gray-600">
                <Info className="h-4 w-4 mr-2" />
                查看渠道文档
              </Button>
            </Link>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setCreateInitialPoolTargets([]);
                setCreateNotice("");
                setIsCreateOpen(true);
              }}
            >
              + 创建客服账号
            </Button>
          </div>
        </div>
        {notice ? (
          <div className="px-4 py-2 text-xs text-blue-600 border-b border-gray-100 bg-blue-50">
            {notice}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 font-semibold">渠道信息</th>
                <th className="px-6 py-3 font-semibold">Open KFID</th>
                <th className="px-6 py-3 font-semibold">渠道来源</th>
                <th className="px-6 py-3 font-semibold">状态</th>
                <th className="px-6 py-3 font-semibold">人工配置范围</th>
                <th className="px-6 py-3 font-semibold">默认路由规则</th>
                <th className="px-6 py-3 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isLoading ? (
                <tr>
                  <td
                    className="px-6 py-10 text-center text-sm text-gray-500"
                    colSpan={7}
                  >
                    加载中...
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? channels.map((channel) => (
                    <tr
                      key={channel.open_kfid || channel.name}
                      className="hover:bg-gray-50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {getAvatarURL(channel) ? (
                            <img
                              src={getAvatarURL(channel)}
                              alt={getDisplayName(channel)}
                              className="h-8 w-8 rounded object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                              {getDisplayName(channel).charAt(0)}
                            </div>
                          )}
                          <span className="font-medium text-gray-900">
                            {getDisplayName(channel)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        {channel.open_kfid}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant="secondary"
                          className="bg-gray-100 text-gray-600 border-transparent"
                        >
                          {channel.source}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(channel.status || "")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <div className="font-medium text-gray-900">
                            {formatConfiguredScopePrimary(channel)}
                          </div>
                          {formatConfiguredScopeSecondary(channel) ? (
                            <div
                              className={`text-[11px] ${
                                channel.pool_empty &&
                                !channel.configured_uses_full_pool &&
                                Number(channel.configured_user_count || 0) <= 0 &&
                                Number(channel.configured_department_count || 0) <= 0
                                  ? "text-amber-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {formatConfiguredScopeSecondary(channel)}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-blue-600">
                        {(channel.open_kfid || "").trim() ? (
                          <Link
                            className="hover:underline"
                            to={`/main/routing-rules?channel=${encodeURIComponent((channel.open_kfid || "").trim())}${Number(channel.default_rule_id || 0) > 0 ? `&edit_rule_id=${Number(channel.default_rule_id || 0)}` : ""}`}
                          >
                            {channel.default_rule}
                          </Link>
                        ) : (
                          <span>{channel.default_rule}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:bg-blue-50 h-8"
                            onClick={() => {
                              void loadDetail(channel);
                            }}
                          >
                            详情
                          </Button>
                          <Link
                            to={`/main/routing-rules?channel=${encodeURIComponent((channel.open_kfid || "").trim())}`}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-600 hover:bg-gray-100 h-8"
                            >
                              配置路由
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400"
                            onClick={() => {
                              const openKFID = (channel.open_kfid || "").trim();
                              if (!openKFID) return;
                              void retrySync(openKFID);
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
              {!isLoading && channels.length === 0 ? (
                <tr>
                  <td
                    className="px-6 py-10 text-center text-sm text-gray-500"
                    colSpan={7}
                  >
                    暂无接待渠道
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Drawer (Dialog) */}
      <Dialog
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setIsPoolEditorOpen(false);
          setIsFallbackEditorOpen(false);
          setDetailNotice("");
          setPoolEditorNotice("");
          setFallbackEditorNotice("");
        }}
        title="渠道详情与推广"
        className="max-w-[840px]"
        footer={
          <Button
            className="w-full bg-blue-600"
            onClick={() => setIsDetailOpen(false)}
          >
            关闭
          </Button>
        }
      >
        {(selectedChannel || selectedChannelDetail?.channel) && (
          <div className="space-y-6">
            {isDetailLoading ? (
              <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
                加载渠道详情中...
              </div>
            ) : null}
            {(() => {
              const detailChannel =
                selectedChannelDetail?.channel || selectedChannel;
              if (!detailChannel) return null;
              return (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  {getAvatarURL(detailChannel) ? (
                    <img
                      src={getAvatarURL(detailChannel)}
                      alt={getDisplayName(detailChannel)}
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
                      {getDisplayName(detailChannel).charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-gray-900">
                      {getDisplayName(detailChannel)}
                    </h3>
                    <p className="text-xs text-gray-500 font-mono mt-1">
                      {detailChannel.open_kfid}
                    </p>
                  </div>
                  <div className="ml-auto">
                    {getStatusBadge(detailChannel.status || "")}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-500">场景选择</span>
                {(selectedChannelDetail?.scenes || []).length > 0 ? (
                  <select
                    className="w-56 h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedSceneValue}
                    onChange={(event) =>
                      setSelectedSceneValue(event.target.value)
                    }
                  >
                    {(selectedChannelDetail?.scenes || []).map((scene) => (
                      <option
                        key={
                          (scene.scene_value || "").trim() ||
                          (scene.name || "").trim()
                        }
                        value={(scene.scene_value || "").trim()}
                      >
                        {(scene.name || scene.scene_value || "无场景").trim()}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[11px] text-gray-400">
                    暂无可选场景
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-gray-200 rounded-lg flex flex-col items-center gap-3 hover:border-blue-300 transition-colors cursor-pointer group">
                  <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100">
                    <QrCode className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    推广二维码
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-blue-600 h-7"
                    disabled={isGeneratingSceneLink}
                    onClick={() => void handleDownloadQRCode()}
                  >
                    {isGeneratingSceneLink ? "生成中..." : "下载图片"}
                  </Button>
                </div>
                <div className="p-4 border border-gray-200 rounded-lg flex flex-col items-center gap-3 hover:border-blue-300 transition-colors cursor-pointer group">
                  <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100">
                    <ExternalLink className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    推广链接
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-blue-600 h-7"
                    disabled={isGeneratingSceneLink}
                    onClick={() => void handleCopyLink()}
                  >
                    {isGeneratingSceneLink ? "生成中..." : "复制链接"}
                  </Button>
                </div>
              </div>
              {detailNotice ? (
                <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  {detailNotice}
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">
                渠道路由规则
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-[10px] text-gray-500">
                    规则总数 / 启用
                  </div>
                  <div className="text-xs font-semibold text-gray-800">
                    {Number(
                      selectedChannelDetail?.routing_summary?.total_rules || 0,
                    )}{" "}
                    /{" "}
                    {Number(
                      selectedChannelDetail?.routing_summary?.active_rules || 0,
                    )}
                  </div>
                </div>
                <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-[10px] text-gray-500">近7天总命中</div>
                  <div className="text-xs font-semibold text-gray-800">
                    {Number(
                      selectedChannelDetail?.routing_summary?.total_hits_7d ||
                        0,
                    ).toLocaleString("zh-CN")}
                  </div>
                </div>
                <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-[10px] text-gray-500">Top规则</div>
                  <div className="text-xs font-semibold text-gray-800 truncate">
                    {(
                      selectedChannelDetail?.routing_summary?.top_rule_name ||
                      "-"
                    ).trim()}
                    {(
                      selectedChannelDetail?.routing_summary
                        ?.top_rule_percent || ""
                    ).trim()
                      ? ` (${(selectedChannelDetail?.routing_summary?.top_rule_percent || "").trim()})`
                      : ""}
                  </div>
                </div>
                <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-[10px] text-gray-500">Scene 重叠</div>
                  <div className="text-xs font-semibold text-gray-800">
                    {Number(
                      selectedChannelDetail?.routing_summary
                        ?.overlapped_scenes || 0,
                    )}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-600">
                {(selectedChannelDetail?.routing_summary?.latest_rule_update_at || "").trim()
                  ? ` · 最近规则更新：${formatDateTime((selectedChannelDetail?.routing_summary?.latest_rule_update_at || "").trim())}`
                  : "当前仅展示路由摘要与接待池/兜底状态，不在此处展开接待人员原始标识。"}
              </div>
              <div className="text-xs text-gray-500">
                渠道路由规则明细请在“配置路由”中统一维护，这里仅展示摘要指标。
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">
                接待池摘要与当前兜底状态
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-[10px] text-gray-500">接待池成员</div>
                  <div className="text-xs font-semibold text-gray-800">
                    {Number(receptionPool?.user_count || 0)}
                  </div>
                </div>
                <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-[10px] text-gray-500">接待池部门</div>
                  <div className="text-xs font-semibold text-gray-800">
                    {Number(receptionPool?.department_count || 0)}
                  </div>
                </div>
                <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-[10px] text-gray-500">系统动作</div>
                  <div className="text-xs font-semibold text-gray-800">
                    {actionModeLabel(
                      (fallbackRoute?.action_mode || "").trim(),
                    )}
                  </div>
                </div>
                <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-[10px] text-gray-500">分配策略</div>
                  <div className="text-xs font-semibold text-gray-800">
                    {dispatchStrategyLabel(fallbackRoute?.dispatch_strategy)}
                  </div>
                </div>
                <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-[10px] text-gray-500">系统排队状态</div>
                  <div className="text-xs font-semibold text-gray-800">
                    {(stateLayers?.system_queue_state || "未启用").trim() || "未启用"}
                  </div>
                </div>
                <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-[10px] text-gray-500">当前路由状态</div>
                  <div className="text-xs font-semibold text-gray-800">
                    {(stateLayers?.routing_state || "尚无最近路由决策").trim()}
                  </div>
                </div>
                <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-[10px] text-gray-500">最近一次执行</div>
                  <div className="text-xs font-semibold text-gray-800">
                    {(stateLayers?.execution_status || "暂无执行记录").trim()}
                  </div>
                </div>
              </div>
              {isPoolEmpty ? (
                <div className="rounded border border-blue-200 bg-blue-50 px-3 py-3 text-xs text-blue-700">
                  当前接待池为空，只能配置“仅智能接待（ai_only）”兜底。
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">接待池配置</h4>
              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-gray-900">当前接待池摘要</div>
                    <div className="text-xs text-gray-500">
                      先查看当前已配置的接待对象，需要调整时再进入编辑。成员和部门列表依赖最近一次组织架构同步。
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                        成员 {assignedUsers.length}
                      </Badge>
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                        部门 {assignedDepartments.length}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={openPoolEditor}
                  >
                    编辑接待池
                  </Button>
                </div>
                {renderSelectionSummary(currentPoolSelection, {
                  emptyText: "当前接待池为空，保存后才会开始承接人工对象。",
                })}
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                  <span>如果成员或部门没有及时出现，请先同步组织架构。</span>
                  <Link to="/main/settings" className="text-blue-600 hover:text-blue-700">
                    去同步组织架构
                  </Link>
                </div>
                {poolEditorNotice ? (
                  <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    {poolEditorNotice}
                  </div>
                ) : null}
                {servicerUpsertResult?.summary ? (
                  <div
                    className={`rounded-lg border px-3 py-3 text-xs ${
                      (servicerUpsertResult.summary.overall_status || "").trim() === "succeeded"
                        ? "border-green-200 bg-green-50 text-green-800"
                        : (servicerUpsertResult.summary.overall_status || "").trim() === "partial"
                          ? "border-orange-200 bg-orange-50 text-orange-800"
                          : "border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    <div className="font-medium">
                      {(servicerUpsertResult.summary.overall_status || "").trim() === "succeeded"
                        ? "接待池已更新"
                        : (servicerUpsertResult.summary.overall_status || "").trim() === "partial"
                          ? "部分对象未保存成功"
                          : "接待池保存失败"}
                    </div>
                    <div className="mt-1">
                      共 {Number(servicerUpsertResult.summary.total_count || 0)} 项，成功{" "}
                      {Number(servicerUpsertResult.summary.success_count || 0)} 项，失败{" "}
                      {Number(servicerUpsertResult.summary.failure_count || 0)} 项。
                    </div>
                  </div>
                ) : null}
                {(servicerUpsertResult?.result_list || []).length > 0 &&
                (servicerUpsertResult.summary?.overall_status || "").trim() !== "succeeded" ? (
                  <div className="space-y-2">
                    {(servicerUpsertResult?.result_list || []).map((item, index) => (
                      <div
                        key={`${item.target_type || "unknown"}-${item.target_id || index}-${item.reason_code || item.status || "result"}`}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          item.status === "succeeded"
                            ? "border-green-200 bg-green-50 text-green-800"
                            : "border-orange-200 bg-orange-50 text-orange-800"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">
                            {item.target_type === "department" ? (
                              <WecomOpenDataDepartment
                                departmentId={Number(item.department_id || item.target_id || 0)}
                                corpId={orgCorpID}
                                fallback={
                                  (orgDepartmentMap.get(
                                    Number(item.department_id || item.target_id || 0),
                                  )?.name || "").trim() ||
                                  `部门 #${item.department_id || item.target_id || "-"}`
                                }
                                className="text-xs font-medium text-inherit"
                                hintClassName="text-[10px] opacity-70"
                              />
                            ) : (
                              <WecomOpenDataName
                                userid={(item.userid || item.target_id || "").trim()}
                                corpId={orgCorpID}
                                fallback={(item.userid || item.target_id || "").trim()}
                                className="text-xs font-medium text-inherit"
                              />
                            )}
                          </span>
                          <Badge
                            variant={item.status === "succeeded" ? "success" : "warning"}
                            className={
                              item.status === "succeeded"
                                ? "bg-green-100 text-green-700"
                                : "bg-orange-100 text-orange-700"
                            }
                          >
                            {item.status === "succeeded" ? "已保存" : "未保存"}
                          </Badge>
                        </div>
                        <div className="mt-1">{formatServicerReason(item)}</div>
                        {item.status !== "succeeded" &&
                        (((item.reason_code || "").trim() !== "") || Number(item.errcode || 0) > 0) ? (
                          <details className="mt-2 text-[11px] opacity-80">
                            <summary className="cursor-pointer select-none text-gray-600">
                              查看详细信息
                            </summary>
                            <div className="mt-1">
                              {item.source === "precheck" ? "前置校验" : "企业微信写入"}
                              {(item.reason_code || "").trim()
                                ? ` · 原因码：${(item.reason_code || "").trim()}`
                                : ""}
                              {Number(item.errcode || 0) > 0
                                ? ` · errcode=${Number(item.errcode || 0)}`
                                : ""}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">
                默认兜底规则
              </h4>
              <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-gray-900">当前默认兜底摘要</div>
                  <div className="text-xs text-gray-500">
                    这里编辑的是 routing 默认兜底规则。动作模式决定系统下一步进入哪类处理路径，分配策略决定进入人工流程后如何挑人或排队。
                  </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                        {actionModeLabel(
                          (fallbackRoute?.action_mode || "").trim(),
                        )}
                      </Badge>
                      <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
                        {dispatchStrategyLabel(fallbackRoute?.dispatch_strategy)}
                      </Badge>
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                        {fallbackRoute?.use_full_pool ? "使用整个接待池" : "使用接待池对象子集"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={openFallbackEditor}
                  >
                    快捷编辑默认兜底规则
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-gray-700">人工候选范围</div>
                  {fallbackRoute?.use_full_pool ? (
                    <div className="rounded-md border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
                      当前使用整个接待池作为人工候选范围。
                    </div>
                  ) : (
                    renderSelectionSummary(selectedFallbackTargetsDeduped, {
                      emptyText: "当前未选择接待池对象子集。",
                    })
                  )}
                </div>
                {Number(fallbackRoute?.dispatch_capacity_threshold || 0) > 0 ? (
                  <div className="text-[11px] text-gray-500">
                    当前直分容量阈值：{Number(fallbackRoute?.dispatch_capacity_threshold || 0)}。
                  </div>
                ) : null}
                <div className="text-[11px] text-gray-500">
                  {isPoolEmpty
                    ? "当前接待池为空，只能使用“仅 AI”。"
                    : fallbackRoute?.use_full_pool
                      ? "当前默认兜底规则会直接使用整个接待池作为人工候选范围。"
                      : "当前默认兜底规则只使用接待池中的显式对象子集作为人工候选范围。"}
                </div>
                {fallbackEditorNotice ? (
                  <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    {fallbackEditorNotice}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-500">
                最近同步时间：
                {formatDateTime(
                  (
                    selectedChannelDetail?.channel?.last_interaction ||
                    selectedChannel?.last_interaction ||
                    ""
                  ).trim(),
                )}
              </span>
              <Button
                variant="link"
                size="sm"
                className="text-blue-600 p-0 h-auto text-xs"
                onClick={() => {
                  const openKFID = (
                    selectedChannelDetail?.channel?.open_kfid ||
                    selectedChannel?.open_kfid ||
                    ""
                  ).trim();
                  if (!openKFID) return;
                  void retrySync(openKFID);
                }}
              >
                刷新接待渠道
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={isPoolEditorOpen}
        onClose={closePoolEditor}
        title="编辑接待池"
        className="max-w-[960px]"
        footer={
          <>
            <Button variant="outline" onClick={closePoolEditor}>
              取消
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isUpsertingServicers || isOrgOptionsLoading || !poolSelectionChanged}
              onClick={() => void handleServicerPoolSave()}
            >
              {isUpsertingServicers ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              保存接待池
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {poolEditorNotice ? (
            <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              {poolEditorNotice}
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-900">选择当前渠道可接待的成员或部门</div>
            <div className="text-xs text-gray-500">
              勾选即可加入，取消勾选即可移除；右侧会实时显示当前已选对象。若成员树不完整，请先同步组织架构。
            </div>
            <div className="text-[11px] text-gray-500">
              <Link to="/main/settings" className="text-blue-600 hover:text-blue-700">
                去同步组织架构
              </Link>
            </div>
          </div>
          <ServicerUpsertResultPanel
            result={servicerUpsertResult}
            formatReason={formatServicerReason}
            orgCorpID={orgCorpID}
            orgDepartmentMap={orgDepartmentMap}
          />
          <OrganizationDirectorySelect
            label="选择成员或部门"
            placeholder={isOrgOptionsLoading ? "正在加载组织树..." : "从通讯录中选择"}
            searchPlaceholder="搜索部门 / 成员 / 角色"
            corpId={orgCorpID}
            treeRoots={treeRoots}
            ungroupedUsers={ungroupedUserIDs}
            memberMap={orgMemberMap}
            departmentMap={orgDepartmentMap}
            selectedItems={selectedServicerTargetsDeduped}
            onChange={setSelectedServicerTargets}
            emptyText="当前没有可选成员或部门"
            disabled={isOrgOptionsLoading}
          />
          <div className="text-[11px] text-gray-500">成员在多个部门下出现时，最终只会保存一次。</div>
        </div>
      </Dialog>

      <Dialog
        isOpen={isFallbackEditorOpen}
        onClose={closeFallbackEditor}
        title="快捷编辑默认兜底规则"
        className="max-w-[960px]"
        footer={
          <>
            <Button variant="outline" onClick={closeFallbackEditor}>
              取消
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isSavingFallbackRoute}
              onClick={() => void handleFallbackRouteSave()}
            >
              {isSavingFallbackRoute ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              保存默认兜底规则
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {fallbackEditorNotice ? (
            <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              {fallbackEditorNotice}
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-900">设置默认兜底方式</div>
            <div className="text-xs text-gray-500">
              先选择系统动作，再决定进入人工流程后的分配策略。需要人工承接时，默认使用整个接待池，只有显式选择时才缩成接待池对象子集。
            </div>
            <div className="text-[11px] text-gray-500">
              这里只显示当前接待池中的成员和部门。如接待池对象不完整，请先
              <Link to="/main/settings" className="ml-1 text-blue-600 hover:text-blue-700">
                同步组织架构
              </Link>
              。
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-gray-700">系统动作</label>
            <select
              value={fallbackActionModeInput}
              onChange={(event) => {
                const nextMode = event.target.value as RoutingActionMode;
                const nextStrategy = defaultDispatchStrategyForActionMode(nextMode);
                setFallbackActionModeInput(nextMode);
                setFallbackDispatchStrategyInput(nextStrategy);
                setFallbackDispatchCapacityThresholdInput(
                  nextStrategy === "direct_if_available_else_queue"
                    ? DEFAULT_DIRECT_DISPATCH_THRESHOLD
                    : 0,
                );
                if (
                  nextMode === "ai_only" ||
                  dispatchStrategyRequiresSpecificUser(nextStrategy)
                ) {
                  setFallbackUseFullPoolInput(true);
                }
              }}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ACTION_MODE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-gray-500">
              {ACTION_MODE_OPTIONS.find((item) => item.value === fallbackActionModeInput)
                ?.description || ""}
            </div>
          </div>
          {actionModeRequiresHuman(fallbackActionModeInput) ? (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-700">分配策略</label>
                <select
                  value={fallbackDispatchStrategyInput}
                  onChange={(event) => {
                    const nextStrategy = event.target.value as RoutingDispatchStrategy;
                    setFallbackDispatchStrategyInput(nextStrategy);
                    setFallbackDispatchCapacityThresholdInput(
                      nextStrategy === "direct_if_available_else_queue"
                        ? DEFAULT_DIRECT_DISPATCH_THRESHOLD
                        : 0,
                    );
                    if (dispatchStrategyRequiresSpecificUser(nextStrategy)) {
                      setFallbackUseFullPoolInput(false);
                    }
                  }}
                  className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {fallbackDispatchOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-gray-500">
                  {fallbackDispatchOptions.find(
                    (item) => item.value === fallbackDispatchStrategyInput,
                  )?.description || ""}
                </div>
              </div>
              {fallbackDispatchStrategyInput === "direct_if_available_else_queue" ? (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-700">
                    直分容量阈值
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={fallbackDispatchCapacityThresholdInput}
                    onChange={(event) =>
                      setFallbackDispatchCapacityThresholdInput(
                        Math.max(
                          1,
                          Number(
                            event.target.value ||
                              DEFAULT_DIRECT_DISPATCH_THRESHOLD,
                          ),
                        ),
                      )
                    }
                    className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-[11px] text-gray-500">
                    当某位客服当前接待中的买家数小于该阈值时，可直接分配；否则进入排队。
                  </div>
                </div>
              ) : null}
              {isPoolEmpty ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  当前没有可用接待对象，请先维护接待池，再配置人工承接目标。
                </div>
              ) : null}
              <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                <div className="text-[11px] font-medium text-gray-700">人工范围</div>
                <label className="flex items-start gap-2 text-xs text-gray-700">
                  <input
                    type="radio"
                    checked={fallbackUseFullPoolInput}
                    onChange={() => setFallbackUseFullPoolInput(true)}
                    disabled={dispatchStrategyRequiresSpecificUser(
                      fallbackDispatchStrategyInput,
                    )}
                    className="mt-0.5"
                  />
                  <span>使用整个接待池（默认）</span>
                </label>
                <label className="flex items-start gap-2 text-xs text-gray-700">
                  <input
                    type="radio"
                    checked={!fallbackUseFullPoolInput}
                    onChange={() => setFallbackUseFullPoolInput(false)}
                    className="mt-0.5"
                    disabled={
                      isPoolEmpty ||
                      dispatchStrategyRequiresSpecificUser(
                        fallbackDispatchStrategyInput,
                      )
                    }
                  />
                    <span>自定义候选范围（接待池对象子集）</span>
                  </label>
              </div>
              {!fallbackUseFullPoolInput ? (
                <div className="space-y-2">
                  <div className="text-[11px] text-gray-500">
                    {dispatchStrategyRequiresSpecificUser(
                      fallbackDispatchStrategyInput,
                    )
                      ? "请选择 1 名接待成员，作为直接指定人工。"
                      : "这里只显示当前接待池中的成员和部门。"}
                  </div>
                  <OrganizationDirectorySelect
                    label="接待池对象子集"
                    placeholder={isOrgOptionsLoading ? "正在加载接待池..." : "从当前接待池对象中选择"}
                    searchPlaceholder="搜索接待池中的成员 / 部门"
                  corpId={orgCorpID}
                  treeRoots={fallbackTreeRoots}
                  ungroupedUsers={fallbackUngroupedUserIDs}
                  memberMap={orgMemberMap}
                  departmentMap={orgDepartmentMap}
                  selectedItems={selectedFallbackTargetsDeduped}
                  onChange={setSelectedFallbackTargets}
                  emptyText="当前接待池中还没有可选对象，请先配置接待池"
                  disabled={isOrgOptionsLoading || isPoolEmpty}
                  allowedUserIDs={currentPoolAllowedUserIDs}
                  allowedDepartmentIDs={currentPoolAllowedDepartmentIDs}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        isOpen={isCreateOpen}
        onClose={closeCreateDialog}
        title="创建客服账号"
        className="max-w-[980px]"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={closeCreateDialog}>
              取消
            </Button>
            <Button
              className="bg-blue-600"
              disabled={isCreating}
              onClick={() => void handleCreateChannel()}
            >
              {isCreating ? "创建中..." : "创建客服账号"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          {createNotice ? (
            <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              {createNotice}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">
              客服账号名称
            </label>
            <input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="如：官网在线咨询"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">
              客服头像（可选）
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) =>
                setCreateAvatarFile(event.target.files?.[0] || null)
              }
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-[11px] text-gray-500">
              支持 PNG/JPG/JPEG/WEBP，大小不超过 2MB。
            </p>
            {createAvatarFile ? (
              <p className="text-[11px] text-gray-600">
                已选择：{createAvatarFile.name}
              </p>
            ) : null}
          </div>
          <OrganizationDirectorySelect
            label="初始接待池（必选）"
            placeholder={isOrgOptionsLoading ? "正在加载组织树..." : "创建时至少选择一个成员或部门"}
            searchPlaceholder="搜索部门 / 成员 / 角色"
            corpId={orgCorpID}
            treeRoots={treeRoots}
            ungroupedUsers={ungroupedUserIDs}
            memberMap={orgMemberMap}
            departmentMap={orgDepartmentMap}
            selectedItems={createInitialPoolTargetsDeduped}
            onChange={setCreateInitialPoolTargets}
            emptyText="当前没有可选成员或部门"
            disabled={isOrgOptionsLoading}
          />
          <div className="text-[11px] text-gray-500">
            创建客服账号时必须先建立初始接待池。默认兜底规则会直接使用整个接待池，只有后续显式设置时才缩为池内子集。
          </div>
          <p className="text-xs leading-5 text-gray-500">
            创建阶段只创建企业微信客服账号。scene 由 routing 侧定义，并在渠道详情中只读展示与生成链接。
          </p>
        </div>
      </Dialog>
    </div>
  );
}
