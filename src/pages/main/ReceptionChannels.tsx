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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createReceptionChannel,
  getReceptionChannelsView,
  getReceptionChannelDetail,
  listKFServicerAssignments,
  retryReceptionChannelSync,
  triggerReceptionChannelSync,
  upsertKFServicerAssignments,
  type ReceptionChannel,
  type ReceptionChannelDetail,
  type KFServicerUpsertResponse,
  type KFServicerUpsertResult,
  type ReceptionOverview,
} from "@/services/receptionService";
import { normalizeErrorMessage } from "@/services/http";
import { executeRoutingRulesCommand } from "@/services/routingService";
import {
  getOrganizationSettingsView,
  type OrganizationSettingsView,
} from "@/services/organizationSettingsService";
import { WecomOpenDataName } from "@/components/wecom/WecomOpenDataName";
import { WecomOpenDataDepartment } from "@/components/wecom/WecomOpenDataDepartment";

type DirectoryDepartment = NonNullable<
  OrganizationSettingsView["departments"]
>[number];
type DirectoryMember = NonNullable<OrganizationSettingsView["members"]>[number];
type DirectorySelectionItem = {
  type: "user" | "department";
  id: string;
};

type DirectoryTreeNode = {
  department: DirectoryDepartment;
  children: DirectoryTreeNode[];
  memberIDs: string[];
};

type DirectoryTreeSelectProps = {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  corpId: string;
  treeRoots: DirectoryTreeNode[];
  ungroupedUsers: string[];
  memberMap: Map<string, DirectoryMember>;
  departmentMap: Map<number, DirectoryDepartment>;
  selectedItems: DirectorySelectionItem[];
  onChange: (next: DirectorySelectionItem[]) => void;
  disabled?: boolean;
  emptyText: string;
};

const selectionKey = (item: DirectorySelectionItem): string =>
  `${item.type}:${item.id.trim()}`;

const normalizeSelectionItems = (
  items: DirectorySelectionItem[],
): DirectorySelectionItem[] => {
  const seen = new Set<string>();
  const out: DirectorySelectionItem[] = [];
  items.forEach((item) => {
    const type = item.type === "department" ? "department" : "user";
    const id = item.id.trim();
    if (!id) return;
    const key = `${type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ type, id });
  });
  return out;
};

function DirectoryTreeSelect({
  label,
  placeholder,
  searchPlaceholder,
  corpId,
  treeRoots,
  ungroupedUsers,
  memberMap,
  departmentMap,
  selectedItems,
  onChange,
  disabled = false,
  emptyText,
}: DirectoryTreeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedDepartments, setExpandedDepartments] = useState<Set<number>>(
    () => new Set(treeRoots.map((item) => Number(item.department.department_id || 0))),
  );

  useEffect(() => {
    setExpandedDepartments(
      new Set(treeRoots.map((item) => Number(item.department.department_id || 0))),
    );
  }, [treeRoots]);

  const selectedKeys = useMemo(
    () => new Set(selectedItems.map((item) => selectionKey(item))),
    [selectedItems],
  );

  const keyword = query.trim().toLowerCase();
  const toggleSelection = (item: DirectorySelectionItem) => {
    if (disabled) return;
    const key = selectionKey(item);
    if (selectedKeys.has(key)) {
      onChange(selectedItems.filter((current) => selectionKey(current) !== key));
      return;
    }
    onChange(normalizeSelectionItems([...selectedItems, item]));
  };

  const toggleExpanded = (departmentID: number) => {
    setExpandedDepartments((prev) => {
      const next = new Set(prev);
      if (next.has(departmentID)) {
        next.delete(departmentID);
      } else {
        next.add(departmentID);
      }
      return next;
    });
  };

  const matchesMember = (userID: string): boolean => {
    if (!keyword) return true;
    const member = memberMap.get(userID);
    const role = (member?.role || "").trim();
    const adminText = member?.is_app_admin ? "企微应用管理员" : "";
    return `${userID} ${role} ${adminText}`.trim().toLowerCase().includes(keyword);
  };

  const matchesDepartment = (department: DirectoryDepartment): boolean => {
    if (!keyword) return true;
    const departmentID = Number(department.department_id || 0);
    const name = (department.name || "").trim();
    return `${departmentID} ${name}`.trim().toLowerCase().includes(keyword);
  };

  const filterTree = (nodes: DirectoryTreeNode[]): DirectoryTreeNode[] => {
    if (!keyword) return nodes;
    const walk = (node: DirectoryTreeNode): DirectoryTreeNode | null => {
      const filteredChildren = node.children
        .map(walk)
        .filter(Boolean) as DirectoryTreeNode[];
      const filteredMembers = node.memberIDs.filter(matchesMember);
      if (
        matchesDepartment(node.department) ||
        filteredChildren.length > 0 ||
        filteredMembers.length > 0
      ) {
        return {
          department: node.department,
          children: filteredChildren,
          memberIDs: filteredMembers,
        };
      }
      return null;
    };
    return nodes.map(walk).filter(Boolean) as DirectoryTreeNode[];
  };

  const filteredRoots = filterTree(treeRoots);
  const filteredUngroupedUsers = ungroupedUsers.filter(matchesMember);

  const renderMember = (userID: string, depth: number) => {
    const member = memberMap.get(userID);
    const role = (member?.role || "").trim();
    const adminText = member?.is_app_admin ? "企微应用管理员" : "";
    const checked = selectedKeys.has(`user:${userID}`);
    return (
      <label
        key={`user-${userID}-${depth}`}
        className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => toggleSelection({ type: "user", id: userID })}
          disabled={disabled}
          className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="min-w-0 flex-1">
          <WecomOpenDataName
            userid={userID}
            corpId={corpId}
            fallback={userID}
            className="block truncate text-xs font-medium text-gray-800"
            hintClassName="text-[10px] text-gray-400"
          />
          <span className="block truncate text-[10px] text-gray-500">
            {role ? role : "成员"}
            {adminText ? ` · ${adminText}` : ""}
          </span>
        </span>
      </label>
    );
  };

  const renderDepartment = (node: DirectoryTreeNode, depth: number): ReactNode => {
    const departmentID = Number(node.department.department_id || 0);
    const expanded = expandedDepartments.has(departmentID);
    const checked = selectedKeys.has(`department:${departmentID}`);
    const childrenVisible = expanded || Boolean(keyword);
    const fallbackName =
      (node.department.name || "").trim() || `部门 #${departmentID || "-"}`;
    return (
      <div key={`department-${departmentID}`}>
        <div
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
            onClick={() => toggleExpanded(departmentID)}
          >
            {childrenVisible ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          <input
            type="checkbox"
            checked={checked}
            onChange={() =>
              toggleSelection({ type: "department", id: String(departmentID) })
            }
            disabled={disabled}
            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="min-w-0 flex-1">
            <WecomOpenDataDepartment
              departmentId={departmentID}
              corpId={corpId}
              fallback={fallbackName}
              className="block truncate text-xs font-medium text-gray-800"
              hintClassName="text-[10px] text-gray-400"
            />
            <span className="block truncate text-[10px] text-gray-500">
              部门 #{departmentID}
            </span>
          </span>
        </div>
        {childrenVisible ? (
          <div>
            {node.children.map((child) => renderDepartment(child, depth + 1))}
            {node.memberIDs.map((userID) => renderMember(userID, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  const hasContent = filteredRoots.length > 0 || filteredUngroupedUsers.length > 0;
  const selectedDepartmentIDs = selectedItems
    .filter((item) => item.type === "department")
    .map((item) => Number(item.id))
    .filter((item) => Number.isInteger(item) && item > 0);
  const selectedUserIDs = selectedItems
    .filter((item) => item.type === "user")
    .map((item) => item.id.trim())
    .filter(Boolean);

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-gray-700">{label}</label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-left text-xs text-gray-700 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
        >
          <span className="truncate">
            {selectedItems.length > 0
              ? `已选择 ${selectedItems.length} 项`
              : placeholder}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
        {isOpen ? (
          <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-[min(1080px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="border-b border-gray-100 p-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-1 gap-0 md:grid-cols-[minmax(0,1.65fr)_340px] xl:grid-cols-[minmax(0,1.8fr)_360px]">
              <div className="max-h-[32rem] overflow-y-auto p-3">
                {hasContent ? (
                  <div className="space-y-1">
                    {filteredRoots.map((node) => renderDepartment(node, 0))}
                    {filteredUngroupedUsers.length > 0 ? (
                      <div className="pt-2">
                        <div className="px-2 py-1 text-[11px] font-semibold text-gray-500">
                          未绑定部门成员（少量异常兜底）
                        </div>
                        {filteredUngroupedUsers.map((userID) => renderMember(userID, 1))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="px-2 py-3 text-center text-xs text-gray-400">
                    {emptyText}
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 bg-gray-50 p-3 md:max-h-[32rem] md:overflow-y-auto md:border-l md:border-t-0">
                <div className="mb-2 text-[11px] font-semibold text-gray-600">
                  已选结果
                </div>
                {selectedItems.length > 0 ? (
                  <div className="space-y-2">
                    {selectedDepartmentIDs.map((departmentID) => (
                      <div
                        key={`selected-department-${departmentID}`}
                        className="rounded-md border border-blue-100 bg-white px-2 py-1.5 text-xs text-blue-800"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">
                            <WecomOpenDataDepartment
                              departmentId={departmentID}
                              corpId={corpId}
                              fallback={
                                (departmentMap.get(departmentID)?.name || "").trim() ||
                                `部门 #${departmentID}`
                              }
                              className="truncate text-xs font-medium text-blue-800"
                              hintClassName="text-[10px] text-blue-400"
                            />
                          </span>
                          <button
                            type="button"
                            className="text-[11px] text-blue-500 hover:text-blue-700"
                            onClick={() =>
                              toggleSelection({
                                type: "department",
                                id: String(departmentID),
                              })
                            }
                          >
                            移除
                          </button>
                        </div>
                        <div className="mt-0.5 text-[10px] text-blue-600">
                          部门
                        </div>
                      </div>
                    ))}
                    {selectedUserIDs.map((userID) => (
                      <div
                        key={`selected-user-${userID}`}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <WecomOpenDataName
                            userid={userID}
                            corpId={corpId}
                            fallback={userID}
                            className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800"
                            hintClassName="text-[10px] text-gray-400"
                          />
                          <button
                            type="button"
                            className="text-[11px] text-gray-500 hover:text-gray-700"
                            onClick={() =>
                              toggleSelection({ type: "user", id: userID })
                            }
                          >
                            移除
                          </button>
                        </div>
                        <div className="mt-0.5 text-[10px] text-gray-500">
                          成员
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-gray-200 bg-white px-2 py-3 text-center text-[11px] text-gray-400">
                    暂无已选成员或部门
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-2 py-2 text-[11px] text-gray-500">
              <span>已选 {selectedItems.length} 项</span>
              <button
                type="button"
                className="text-blue-600 hover:text-blue-700"
                onClick={() => setIsOpen(false)}
              >
                完成
              </button>
            </div>
          </div>
        ) : null}
      </div>
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
  const [servicerAssignments, setServicerAssignments] = useState<
    Array<{ userid?: string; department_id?: number; status?: number }>
  >([]);
  const [overview, setOverview] = useState<ReceptionOverview | null>(null);
  const [channels, setChannels] = useState<ReceptionChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpsertingServicers, setIsUpsertingServicers] = useState(false);
  const [notice, setNotice] = useState("");
  const [keyword, setKeyword] = useState("");
  const [organizationView, setOrganizationView] =
    useState<OrganizationSettingsView | null>(null);
  const [isOrgOptionsLoading, setIsOrgOptionsLoading] = useState(false);
  const [createOpenKFID, setCreateOpenKFID] = useState("");
  const [createName, setCreateName] = useState("");
  const [createSource, setCreateSource] = useState("");
  const [createSceneValue, setCreateSceneValue] = useState("");
  const [selectedSceneValue, setSelectedSceneValue] = useState("");
  const [servicerOp, setServicerOp] = useState<"add" | "del">("add");
  const [selectedServicerTargets, setSelectedServicerTargets] = useState<
    DirectorySelectionItem[]
  >([]);
  const [servicerUpsertResult, setServicerUpsertResult] =
    useState<KFServicerUpsertResponse | null>(null);
  const [fallbackModeInput, setFallbackModeInput] = useState("ai_only");
  const [selectedFallbackTargets, setSelectedFallbackTargets] = useState<
    DirectorySelectionItem[]
  >([]);
  const [isSavingFallbackRoute, setIsSavingFallbackRoute] = useState(false);

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
    if (!isDetailOpen || organizationView) return;
    void loadOrganizationOptions();
  }, [isDetailOpen, organizationView]);

  const handleSync = async () => {
    setIsSyncing(true);
    const target = selectedChannel?.open_kfid || channels[0]?.open_kfid;
    if (!target) {
      setNotice("当前没有可同步的渠道");
      setIsSyncing(false);
      return;
    }
    try {
      const accepted = await triggerReceptionChannelSync(target);
      setNotice(accepted ? "已提交同步任务" : "同步任务未被接受");
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
    setIsDetailLoading(true);
    setIsDetailOpen(true);
    if (!channel.open_kfid) {
      setIsDetailLoading(false);
      return;
    }
    try {
      const detail = await getReceptionChannelDetail(channel.open_kfid);
      setSelectedChannelDetail(detail);
      setFallbackModeInput(
        (detail?.fallback_route?.mode || "ai_only").trim() || "ai_only",
      );
      setSelectedFallbackTargets(
        normalizeSelectionItems([
          ...(detail?.fallback_route?.human_user_ids || []).map((userID) => ({
            type: "user" as const,
            id: userID,
          })),
          ...(detail?.fallback_route?.human_department_ids || []).map(
            (departmentID) => ({
              type: "department" as const,
              id: String(departmentID),
            }),
          ),
        ]),
      );
      const assignments = await listKFServicerAssignments(channel.open_kfid);
      setServicerAssignments(assignments);
    } catch (error) {
      setNotice(normalizeErrorMessage(error));
      setSelectedChannelDetail(null);
      setServicerAssignments([]);
      setServicerUpsertResult(null);
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

  const handleCreateChannel = async () => {
    const openKFID = createOpenKFID.trim();
    if (!openKFID) {
      setNotice("请输入 Open KFID");
      return;
    }
    try {
      setIsCreating(true);
      const created = await createReceptionChannel({
        open_kfid: openKFID,
        name: createName.trim(),
        source: createSource.trim(),
        scene_value: createSceneValue.trim(),
      });
      setNotice(created?.open_kfid ? "接待渠道已创建" : "接待渠道创建完成");
      setIsCreateOpen(false);
      setCreateOpenKFID("");
      setCreateName("");
      setCreateSource("");
      setCreateSceneValue("");
      await loadChannels(keyword);
      if (created?.open_kfid) {
        await loadDetail(created);
      }
    } catch (error) {
      setNotice(normalizeErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
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
    if (!key) return scenes[0] || null;
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
  const orgDepartmentMap = useMemo(() => {
    const next = new Map<number, NonNullable<OrganizationSettingsView["departments"]>[number]>();
    (organizationView?.departments || []).forEach((department) => {
      const departmentID = Number(department.department_id || 0);
      if (departmentID > 0) {
        next.set(departmentID, department);
      }
    });
    return next;
  }, [organizationView?.departments]);

  const orgMemberMap = useMemo(() => {
    const next = new Map<string, NonNullable<OrganizationSettingsView["members"]>[number]>();
    (organizationView?.members || []).forEach((member) => {
      const userID = (member.userid || "").trim();
      if (userID) next.set(userID, member);
    });
    return next;
  }, [organizationView?.members]);

  const orderedDepartments = useMemo(() => {
    const rows = [...(organizationView?.departments || [])];
    rows.sort((a, b) => {
      const aParent = Number(a.parent_id || 0);
      const bParent = Number(b.parent_id || 0);
      if (aParent !== bParent) return aParent - bParent;
      const aOrder = Number(a.order || 0);
      const bOrder = Number(b.order || 0);
      if (aOrder !== bOrder) return aOrder - bOrder;
      const aName = (a.name || "").trim();
      const bName = (b.name || "").trim();
      if (aName !== bName) return aName.localeCompare(bName, "zh-CN");
      return Number(a.department_id || 0) - Number(b.department_id || 0);
    });
    return rows;
  }, [organizationView?.departments]);

  const departmentChildrenMap = useMemo(() => {
    const next = new Map<number, typeof orderedDepartments>();
    orderedDepartments.forEach((department) => {
      const parentID = Number(department.parent_id || 0);
      const bucket = next.get(parentID) || [];
      bucket.push(department);
      next.set(parentID, bucket);
    });
    return next;
  }, [orderedDepartments]);

  const departmentMembersMap = useMemo(() => {
    const next = new Map<number, string[]>();
    (organizationView?.members || []).forEach((member) => {
      const userID = (member.userid || "").trim();
      if (!userID) return;
      (member.departments || []).forEach((department) => {
        const departmentID = Number(department.department_id || 0);
        if (departmentID <= 0) return;
        const bucket = next.get(departmentID) || [];
        if (!bucket.includes(userID)) bucket.push(userID);
        next.set(departmentID, bucket);
      });
    });
    return next;
  }, [organizationView?.members]);

  const treeRoots = useMemo(() => {
    const departmentIDs = new Set(
      orderedDepartments
        .map((department) => Number(department.department_id || 0))
        .filter((departmentID) => departmentID > 0),
    );
    const walk = (parentID: number): DirectoryTreeNode[] => {
      const children = departmentChildrenMap.get(parentID) || [];
      return children.map((department) => {
        const departmentID = Number(department.department_id || 0);
        return {
          department,
          children: walk(departmentID),
          memberIDs: [...(departmentMembersMap.get(departmentID) || [])].sort(
            (left, right) => left.localeCompare(right, "zh-CN"),
          ),
        };
      });
    };
    const rootParentIDs = Array.from(
      new Set(
        orderedDepartments
          .filter((department) => {
            const parentID = Number(department.parent_id || 0);
            return parentID <= 0 || !departmentIDs.has(parentID);
          })
          .map((department) => Number(department.parent_id || 0)),
      ),
    ).sort((left, right) => left - right);
    return rootParentIDs.flatMap((parentID) => walk(parentID));
  }, [departmentChildrenMap, departmentMembersMap, orderedDepartments]);

  const userHasDepartment = (userID: string): boolean => {
    const member = orgMemberMap.get(userID);
    return Boolean(member && (member.departments || []).length > 0);
  };

  const ungroupedUserIDs = useMemo(
    () =>
      (organizationView?.members || [])
        .map((member) => (member.userid || "").trim())
        .filter((userID) => userID && !userHasDepartment(userID))
        .sort((left, right) => left.localeCompare(right, "zh-CN")),
    [organizationView?.members],
  );

  const selectedServicerTargetsDeduped = useMemo(
    () => normalizeSelectionItems(selectedServicerTargets),
    [selectedServicerTargets],
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

  const receptionPool = selectedChannelDetail?.reception_pool;
  const fallbackRoute = selectedChannelDetail?.fallback_route;
  const stateLayers = selectedChannelDetail?.state_layers;
  const routeBindings = selectedChannelDetail?.route_bindings || [];
  const invalidRouteBindings = routeBindings.filter(
    (item) => item.target_valid === false,
  );
  const isPoolEmpty =
    receptionPool?.empty === true ||
    (Number(receptionPool?.user_count || 0) === 0 &&
      Number(receptionPool?.department_count || 0) === 0);

  const fallbackModeLabel = (mode?: string): string => {
    switch ((mode || "").trim()) {
      case "ai_then_human":
        return "智能接待后转人工";
      case "ai_then_queue_then_human":
        return "智能接待后进入排队池再转人工";
      case "ai_only":
      default:
        return "仅智能接待";
    }
  };

  const formatPoolTargetDisplay = () => {
    if (!fallbackRoute) return "-";
    const display = (fallbackRoute.human_target_display || "").trim();
    if (display) return display;
    if (fallbackRoute.mode === "ai_only") return "不涉及人工";
    return "默认接待池";
  };

  const promotionURL =
    (selectedScene?.url || "").trim() ||
    (selectedChannelDetail?.promotion_url || "").trim() ||
    (primaryScene?.url || "").trim();

  const handleCopyLink = async () => {
    if (!promotionURL) {
      setNotice("当前渠道暂无可复制的推广链接");
      return;
    }
    try {
      await navigator.clipboard.writeText(promotionURL);
      setNotice("推广链接已复制");
    } catch {
      setNotice("复制失败，请手动复制");
    }
  };

  const handleDownloadQRCode = async () => {
    if (!promotionURL) {
      setNotice("当前渠道暂无可下载二维码的链接");
      return;
    }
    try {
      const query = new URLSearchParams({ text: promotionURL, size: "512" });
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
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(selectedChannel?.open_kfid || "reception_channel").trim()}-${(selectedScene?.scene_value || primaryScene?.scene_value || "scene").trim()}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice("二维码下载已开始");
    } catch (error) {
      setNotice(normalizeErrorMessage(error));
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

  const handleServicerUpsert = async () => {
    const openKFID = (
      selectedChannelDetail?.channel?.open_kfid ||
      selectedChannel?.open_kfid ||
      ""
    ).trim();
    if (!openKFID) {
      setNotice("当前渠道缺少 Open KFID");
      return;
    }
    const userIDs = selectedServicerUsersDeduped;
    const departmentIDs = selectedServicerDepartmentsDeduped;
    if (userIDs.length === 0 && departmentIDs.length === 0) {
      setNotice("请至少勾选一个成员或部门");
      return;
    }
    try {
      setIsUpsertingServicers(true);
      const result = await upsertKFServicerAssignments({
        open_kfid: openKFID,
        op: servicerOp,
        userid_list: userIDs,
        department_id_list: departmentIDs,
      });
      setServicerUpsertResult(result);
      const summary = result?.summary;
      const successCount = Number(summary?.success_count || 0);
      const failureCount = Number(summary?.failure_count || 0);
      const overallStatus = (summary?.overall_status || "").trim();
      if (overallStatus === "succeeded") {
        setNotice(`接待人员${servicerOp === "add" ? "添加" : "移除"}成功`);
      } else if (overallStatus === "partial") {
        setNotice(
          `部分处理成功：成功 ${successCount} 项，失败 ${failureCount} 项`,
        );
      } else {
        setNotice(`处理未完成：失败 ${failureCount} 项`);
      }
      if (successCount > 0) {
        const refreshedAssignments = await listKFServicerAssignments(openKFID);
        setServicerAssignments(refreshedAssignments);
        const refreshedDetail = await getReceptionChannelDetail(openKFID);
        setSelectedChannelDetail(refreshedDetail);
        setSelectedServicerTargets([]);
        await loadChannels(keyword);
      }
    } catch (error) {
      setNotice(normalizeErrorMessage(error));
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
      setNotice("当前渠道缺少 Open KFID");
      return;
    }
    const humanUserIDs = selectedFallbackUsersDeduped;
    const humanDepartmentIDs = selectedFallbackDepartmentsDeduped;
    if (isPoolEmpty && fallbackModeInput !== "ai_only") {
      setNotice("当前接待池为空，只能配置“仅智能接待（ai_only）”兜底。");
      return;
    }
    try {
      setIsSavingFallbackRoute(true);
      const result = await executeRoutingRulesCommand({
        command: "configure_fallback_route",
        open_kfid: openKFID,
        payload: {
          mode: fallbackModeInput,
          human_target_type:
            fallbackModeInput === "ai_only"
              ? ""
              : humanUserIDs.length > 0 && humanDepartmentIDs.length > 0
                ? "mixed"
                : humanDepartmentIDs.length > 0
                  ? "department"
                  : humanUserIDs.length > 0
                    ? "user"
                    : "",
          human_user_ids:
            fallbackModeInput === "ai_only" ? [] : humanUserIDs,
          human_department_ids:
            fallbackModeInput === "ai_only" ? [] : humanDepartmentIDs,
        },
      });
      if (result?.success) {
        setNotice(result.message || "兜底路由已更新");
      } else {
        setNotice(result?.message || "兜底路由更新失败");
      }
      const refreshedDetail = await getReceptionChannelDetail(openKFID);
      setSelectedChannelDetail(refreshedDetail);
      setFallbackModeInput(
        (refreshedDetail?.fallback_route?.mode || "ai_only").trim() ||
          "ai_only",
      );
      setSelectedFallbackTargets(
        normalizeSelectionItems([
          ...(refreshedDetail?.fallback_route?.human_user_ids || []).map(
            (userID) => ({
              type: "user" as const,
              id: userID,
            }),
          ),
          ...(refreshedDetail?.fallback_route?.human_department_ids || []).map(
            (departmentID) => ({
              type: "department" as const,
              id: String(departmentID),
            }),
          ),
        ]),
      );
      await loadChannels(keyword);
    } catch (error) {
      setNotice(normalizeErrorMessage(error));
    } finally {
      setIsSavingFallbackRoute(false);
    }
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
              同步企微后台
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
              onClick={() => setIsCreateOpen(true)}
            >
              + 新建接待渠道
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
                <th className="px-6 py-3 font-semibold">来源说明</th>
                <th className="px-6 py-3 font-semibold">状态</th>
                <th className="px-6 py-3 font-semibold">接待人员</th>
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
                        <span className="font-medium text-gray-900">
                          {channel.staff_count}
                        </span>
                        <span className="text-gray-400 ml-1">人</span>
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
        onClose={() => setIsDetailOpen(false)}
        title="渠道详情与推广"
        className="max-w-[480px]"
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
                        {(scene.name || scene.scene_value || "默认场景").trim()}
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
                    onClick={() => void handleDownloadQRCode()}
                  >
                    下载图片
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
                    onClick={() => void handleCopyLink()}
                  >
                    复制链接
                  </Button>
                </div>
              </div>
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
                  <div className="text-[10px] text-gray-500">当前兜底模式</div>
                  <div className="text-xs font-semibold text-gray-800">
                    {fallbackModeLabel(fallbackRoute?.mode)}
                  </div>
                </div>
                <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="text-[10px] text-gray-500">系统排队状态</div>
                  <div className="text-xs font-semibold text-gray-800">
                    {(stateLayers?.system_queue_state || "未启用").trim() || "未启用"}
                  </div>
                </div>
              </div>
              <div className="rounded border border-gray-200 bg-white px-3 py-3 space-y-2 text-xs text-gray-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-gray-800">人工目标健康检查</span>
                  <Badge
                    variant="secondary"
                    className={
                      fallbackRoute?.human_target_valid === false
                        ? "bg-orange-100 text-orange-700 border-transparent"
                        : "bg-green-100 text-green-700 border-transparent"
                    }
                  >
                    {fallbackRoute?.human_target_valid === false
                      ? "当前目标已失效"
                      : "目标有效"}
                  </Badge>
                </div>
                <div>当前人工目标：{formatPoolTargetDisplay()}</div>
                <div>
                  企业微信原生接待状态：
                  {(stateLayers?.wecom_native_states || []).join(" / ") ||
                    "待通过会话状态接口与事件回调回写"}
                </div>
                <div>
                  当前兜底模式：
                  {fallbackModeLabel(stateLayers?.fallback_mode || fallbackRoute?.mode)}
                </div>
                {fallbackRoute?.human_target_valid === false &&
                (fallbackRoute?.invalid_reason || "").trim() ? (
                  <div className="rounded border border-orange-200 bg-orange-50 px-2 py-2 text-orange-700">
                    {(fallbackRoute?.invalid_reason || "").trim()}
                  </div>
                ) : null}
                {isPoolEmpty ? (
                  <div className="rounded border border-blue-200 bg-blue-50 px-2 py-2 text-blue-700">
                    当前接待池为空，只能配置“仅智能接待（ai_only）”兜底。
                  </div>
                ) : null}
              </div>
              {invalidRouteBindings.length > 0 ? (
                <div className="rounded border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
                  <div className="font-medium">历史路由健康检查</div>
                  <div className="mt-1 space-y-1">
                    {invalidRouteBindings.map((item) => (
                      <div key={`${item.rule_id || item.rule_name || item.target}`}>
                        {item.rule_name || "未命名规则"}：{(item.target_issue || "当前人工目标已失效").trim()}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">接待池配置</h4>
              <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                已同步接待池摘要：成员 {assignedUsers.length} / 部门 {assignedDepartments.length}
              </div>
              {(selectedChannelDetail?.staff_members || []).length > 0 ||
              assignedUsers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    new Set([
                      ...(selectedChannelDetail?.staff_members || []),
                      ...assignedUsers,
                    ]),
                  ).map((staff) => (
                    <Badge
                      key={staff}
                      variant="secondary"
                      className="bg-gray-100 text-gray-700 border-transparent"
                    >
                      <WecomOpenDataName
                        userid={staff}
                        corpId={orgCorpID}
                        fallback={staff}
                        className="text-xs font-medium text-gray-700"
                      />
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  当前规则尚未配置明确接待人员
                </div>
              )}
              {assignedDepartments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(assignedDepartments)).map(
                    (departmentID) => (
                      <Badge
                        key={departmentID}
                        variant="secondary"
                        className="bg-blue-50 text-blue-700 border-transparent"
                      >
                        <WecomOpenDataDepartment
                          departmentId={departmentID}
                          corpId={orgCorpID}
                          fallback={
                            (orgDepartmentMap.get(departmentID)?.name || "").trim() ||
                            `部门 #${departmentID}`
                          }
                          className="text-xs font-medium text-blue-700"
                          hintClassName="text-[10px] text-blue-300"
                        />
                      </Badge>
                    ),
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  当前未配置按部门维度接待人员分配
                </div>
              )}
              <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-gray-800">
                        接待池写入
                      </div>
                      <div className="text-[11px] text-gray-500">
                        先配置真实企业微信接待池，再配置兜底路由。成员通过 open-data 回显，目标按组织树分组展示。
                      </div>
                    </div>
                  <select
                    value={servicerOp}
                    onChange={(event) =>
                      setServicerOp(
                        event.target.value === "del" ? "del" : "add",
                      )
                    }
                    className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="add">添加接待人员</option>
                    <option value="del">移除接待人员</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <DirectoryTreeSelect
                    label="统一企业通讯录树选择"
                    placeholder={
                      isOrgOptionsLoading
                        ? "正在加载组织树..."
                        : "请选择要写入接待池的成员或部门"
                    }
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
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] text-gray-500">
                    成员名称优先通过 open-data 回显；成员可在多个部门节点下出现，但最终结果会按成员唯一 ID 去重。部门级可操作与成员级可见分离校验。
                  </div>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={isUpsertingServicers}
                    onClick={() => void handleServicerUpsert()}
                  >
                    {isUpsertingServicers ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    提交写入
                  </Button>
                </div>
                {servicerUpsertResult?.summary ? (
                  <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700 space-y-1">
                    <div className="font-medium text-gray-800">
                      结果：{servicerUpsertResult.summary.overall_status || "-"}
                    </div>
                    <div>
                      共 {Number(servicerUpsertResult.summary.total_count || 0)}{" "}
                      项，成功{" "}
                      {Number(servicerUpsertResult.summary.success_count || 0)}{" "}
                      项，失败{" "}
                      {Number(servicerUpsertResult.summary.failure_count || 0)}{" "}
                      项
                    </div>
                  </div>
                ) : null}
                {(servicerUpsertResult?.result_list || []).length > 0 ? (
                  <div className="space-y-2">
                    {(servicerUpsertResult?.result_list || []).map(
                      (item, index) => (
                        <div
                          key={`${item.target_type || "unknown"}-${item.target_id || index}-${item.reason_code || item.status || "result"}`}
                          className={`rounded border px-3 py-2 text-xs ${
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
                              variant="secondary"
                              className={
                                item.status === "succeeded"
                                  ? "bg-green-100 text-green-700 border-transparent"
                                  : "bg-orange-100 text-orange-700 border-transparent"
                              }
                            >
                              {item.status === "succeeded" ? "成功" : "失败"}
                            </Badge>
                          </div>
                          <div className="mt-1">
                            {formatServicerReason(item)}
                          </div>
                          <div className="mt-1 text-[11px] opacity-80">
                            来源：
                            {item.source === "precheck"
                              ? "前置校验"
                              : "企业微信写入"}
                            {(item.reason_code || "").trim()
                              ? ` · 原因码：${(item.reason_code || "").trim()}`
                              : ""}
                            {Number(item.errcode || 0) > 0
                              ? ` · errcode=${Number(item.errcode || 0)}`
                              : ""}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">
                兜底路由配置
              </h4>
              <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
                <div>
                  <div className="text-xs font-semibold text-gray-800">
                    最小兜底路由配置
                  </div>
                  <div className="text-[11px] text-gray-500">
                    当前只承接兜底模式和人工目标有效性，不扩展成完整规则编辑器。涉及人工时，目标必须来自接待池。
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-700">
                    兜底模式
                  </label>
                  <select
                    value={fallbackModeInput}
                    onChange={(event) => setFallbackModeInput(event.target.value)}
                    className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ai_only">仅智能接待（ai_only）</option>
                    <option value="ai_then_human">智能接待后转人工</option>
                    <option value="ai_then_queue_then_human">
                      智能接待后进入排队池再转人工
                    </option>
                  </select>
                </div>
                {fallbackModeInput !== "ai_only" ? (
                  <div className="grid grid-cols-1 gap-3">
                    <DirectoryTreeSelect
                      label="统一企业通讯录树目标"
                      placeholder={
                        isOrgOptionsLoading
                          ? "正在加载组织树..."
                          : "按部门树选择人工成员或部门（留空表示默认接待池）"
                      }
                      searchPlaceholder="搜索部门 / 成员 / 角色"
                      corpId={orgCorpID}
                      treeRoots={treeRoots}
                      ungroupedUsers={ungroupedUserIDs}
                      memberMap={orgMemberMap}
                      departmentMap={orgDepartmentMap}
                      selectedItems={selectedFallbackTargetsDeduped}
                      onChange={setSelectedFallbackTargets}
                      emptyText="当前没有可选成员或部门"
                      disabled={isOrgOptionsLoading}
                    />
                    {selectedFallbackTargetsDeduped.length === 0 ? (
                      <div className="text-[11px] text-gray-500">
                        留空表示使用默认接待池中的人工目标。
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] text-gray-500">
                    排队池是系统内状态承接，不代表企业微信原生接待池。最终转人工目标仍必须来自接待池。
                  </div>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={isSavingFallbackRoute}
                    onClick={() => void handleFallbackRouteSave()}
                  >
                    {isSavingFallbackRoute ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    保存兜底模式
                  </Button>
                </div>
              </div>
            </div>

            {selectedChannelDetail?.warnings &&
              selectedChannelDetail.warnings.length > 0 && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-700">
                  {selectedChannelDetail.warnings.join("；")}
                </div>
              )}

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
                重新同步
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="新建接待渠道"
        className="max-w-[520px]"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-blue-600"
              disabled={isCreating}
              onClick={() => void handleCreateChannel()}
            >
              {isCreating ? "创建中..." : "创建渠道"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">
              Open KFID
            </label>
            <input
              value={createOpenKFID}
              onChange={(event) => setCreateOpenKFID(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="wkxxxxxx"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">
              渠道名称
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
              来源说明
            </label>
            <input
              value={createSource}
              onChange={(event) => setCreateSource(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="如：官网 H5"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">
              默认 Scene
            </label>
            <input
              value={createSceneValue}
              onChange={(event) => setCreateSceneValue(event.target.value)}
              className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="如：OFFICIAL_WEBSITE"
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
