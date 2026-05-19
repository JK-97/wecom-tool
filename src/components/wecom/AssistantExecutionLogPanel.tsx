import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { APIRequestError, normalizeErrorMessage } from "@/services/http";
import {
  getOrganizationSettingsDebugAssistantRunDetail,
  getOrganizationSettingsDebugAssistantRuns,
  type AssistantExecutionRunDetail,
  type AssistantExecutionRunSummary,
  type AssistantExecutionRunsQuery,
  type AssistantExecutionRunsPage,
  type AssistantExecutionStep,
  type AssistantExecutionStepEvent,
} from "@/services/organizationSettingsService";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Clock3,
  GitBranch,
  Loader2,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";

type Props = {
  enabled: boolean;
  onDebugAccessExpired?: () => void;
};

type AssistantOutputSummary = {
  decision_type?: string;
  reason_code?: string;
  reason?: string;
  summary?: string;
  send_intent?: string;
  approval_required?: boolean;
  approval_reason_code?: string;
  reply_count?: number;
  reply_texts?: string[];
  reply_preview?: string;
  followup_preview?: string;
  confidence?: number;
  followup_required?: boolean;
  reply_style?: string;
  risk_level?: string;
  risk_flags?: string[];
  intent?: string;
  topic?: string;
  conversation_stage?: string;
  relationship_stage?: string;
  opportunity_signals?: string[];
  next_best_actions?: string[];
  needs_human_attention?: boolean;
  handoff_decision?: string;
  handoff_urgency?: string;
};

const RUN_KIND_OPTIONS = [
  { value: "", label: "全部执行类型" },
  { value: "realtime_reply", label: "智能客服 AI 回复" },
  { value: "reply_suggestion", label: "AI 回复建议" },
  { value: "rpa_auto_reply", label: "自动模式回复" },
];

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "reply_generated", label: "已生成回复" },
  { value: "followup_scheduled", label: "已安排跟进" },
  { value: "handoff_requested", label: "已请求人工介入" },
  { value: "decided", label: "已完成判断" },
  { value: "suppressed", label: "已跳过执行" },
  { value: "ready", label: "已就绪" },
  { value: "failed", label: "执行失败" },
];

const DEFAULT_QUERY: AssistantExecutionRunsQuery = {
  conversation_key: "",
  channel_id: "",
  participant: "",
  run_kind: "",
  status: "",
  page: 1,
  page_size: 20,
};

// AssistantExecutionLogPanel renders the mature debug-only observability view
// for assistant runs. It intentionally separates query controls, run list, and
// the run/step/event detail timeline so prompt analysis is not a black box.
export function AssistantExecutionLogPanel({
  enabled,
  onDebugAccessExpired,
}: Props) {
  const [draftQuery, setDraftQuery] =
    useState<AssistantExecutionRunsQuery>(DEFAULT_QUERY);
  const [query, setQuery] =
    useState<AssistantExecutionRunsQuery>(DEFAULT_QUERY);
  const [list, setList] = useState<AssistantExecutionRunsPage>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
  });
  const [selectedRunRef, setSelectedRunRef] = useState("");
  const [detail, setDetail] = useState<AssistantExecutionRunDetail | null>(
    null,
  );
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    summary: true,
    prompt: false,
    timeline: false,
    tools: false,
    output: false,
  });
  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!enabled) {
      setList({ items: [], total: 0, page: 1, page_size: 20 });
      setSelectedRunRef("");
      setDetail(null);
      setListError("");
      setDetailError("");
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setListLoading(true);
        setListError("");
        const nextList = await getOrganizationSettingsDebugAssistantRuns(query);
        if (cancelled) return;
        setList(nextList);
        const availableRefs = nextList.items
          .map((item) => (item.run_ref || "").trim())
          .filter(Boolean);
        if (availableRefs.length === 0) {
          setSelectedRunRef("");
          setDetail(null);
          return;
        }
        setSelectedRunRef((current) =>
          availableRefs.includes(current.trim())
            ? current.trim()
            : availableRefs[0],
        );
      } catch (error) {
        if (cancelled) return;
        if (error instanceof APIRequestError && error.status === 403) {
          onDebugAccessExpired?.();
          return;
        }
        setListError(normalizeErrorMessage(error));
      } finally {
        if (!cancelled) {
          setListLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, onDebugAccessExpired, query, reloadTick]);

  useEffect(() => {
    if (!enabled || !selectedRunRef.trim()) {
      setDetail(null);
      setDetailError("");
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setDetailLoading(true);
        setDetailError("");
        const nextDetail =
          await getOrganizationSettingsDebugAssistantRunDetail(selectedRunRef);
        if (cancelled) return;
        setDetail(nextDetail);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof APIRequestError && error.status === 403) {
          onDebugAccessExpired?.();
          return;
        }
        setDetailError(normalizeErrorMessage(error));
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, onDebugAccessExpired, reloadTick, selectedRunRef]);

  useEffect(() => {
    setOpenSections({
      summary: true,
      prompt: false,
      timeline: false,
      tools: false,
      output: false,
    });
    setOpenSteps({});
  }, [selectedRunRef]);

  const pageCount = Math.max(
    1,
    Math.ceil((list.total || 0) / Math.max(1, Number(query.page_size || 20))),
  );
  const promptSteps = useMemo(
    () =>
      (detail?.steps || []).filter(
        (step) =>
          Boolean((step.system_prompt_text || "").trim()) ||
          Boolean((step.rendered_input_text || "").trim()) ||
          Boolean((step.input_json || "").trim()),
      ),
    [detail],
  );
  const timelineSteps = detail?.steps || [];
  const toolRows = useMemo(
    () =>
      (detail?.steps || []).flatMap((step) =>
        (step.events || [])
          .filter((event) => {
            const kind = (event.event_kind || "").trim();
            return kind === "tool_call" || kind === "tool_result";
          })
          .map((event) => ({ step, event })),
      ),
    [detail],
  );
  const finalOutputSteps = useMemo(
    () =>
      (detail?.steps || []).filter(
        (step) =>
          Boolean((step.output_text || "").trim()) ||
          Boolean((step.output_json || "").trim()),
      ),
    [detail],
  );

  const applyFilters = () => {
    setQuery((prev) => ({
      ...prev,
      conversation_key: (draftQuery.conversation_key || "").trim(),
      channel_id: (draftQuery.channel_id || "").trim(),
      participant: (draftQuery.participant || "").trim(),
      run_kind: (draftQuery.run_kind || "").trim(),
      status: (draftQuery.status || "").trim(),
      page: 1,
    }));
  };

  const refresh = () => {
    setReloadTick((value) => value + 1);
  };

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleStep = (key: string) => {
    setOpenSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedSummary = detail?.summary;
  const outputSummary = useMemo(
    () => parseAssistantOutputSummary(detail?.output_summary_json),
    [detail?.output_summary_json],
  );

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="border-b border-gray-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <Bot className="h-4 w-4 text-blue-600" />
              Assistant 执行日志
            </CardTitle>
            <p className="text-xs leading-relaxed text-gray-500">
              查看 AI
              回复、回复建议和自动模式回复的真实执行过程，包括提示词、工具调用、并发步骤和总耗时。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="border-none bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">
              最近执行 {list.total || 0} 条
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="bg-white text-xs font-semibold"
              onClick={refresh}
              disabled={listLoading || detailLoading}
            >
              {listLoading || detailLoading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
              )}
              刷新列表
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 p-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-1.5 xl:col-span-2">
            <label className="text-[11px] font-semibold text-gray-700">
              会话标识
            </label>
            <Input
              value={draftQuery.conversation_key || ""}
              onChange={(event) =>
                setDraftQuery((prev) => ({
                  ...prev,
                  conversation_key: event.target.value,
                }))
              }
              placeholder="按会话标识检索"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-700">
              渠道
            </label>
            <Input
              value={draftQuery.channel_id || ""}
              onChange={(event) =>
                setDraftQuery((prev) => ({
                  ...prev,
                  channel_id: event.target.value,
                }))
              }
              placeholder="如 kf_xxx"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-700">
              参与对象
            </label>
            <Input
              value={draftQuery.participant || ""}
              onChange={(event) =>
                setDraftQuery((prev) => ({
                  ...prev,
                  participant: event.target.value,
                }))
              }
              placeholder="客户 / 渠道 / 所有人"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-700">
              执行类型
            </label>
            <select
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-blue-400"
              value={draftQuery.run_kind || ""}
              onChange={(event) =>
                setDraftQuery((prev) => ({
                  ...prev,
                  run_kind: event.target.value,
                }))
              }
            >
              {RUN_KIND_OPTIONS.map((item) => (
                <option key={item.value || "all"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-700">
              状态
            </label>
            <select
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-blue-400"
              value={draftQuery.status || ""}
              onChange={(event) =>
                setDraftQuery((prev) => ({
                  ...prev,
                  status: event.target.value,
                }))
              }
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value || "all"} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            默认按开始时间倒序展示。当前第 {Number(list.page || 1)} /{" "}
            {pageCount} 页。
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-white text-xs font-semibold"
              onClick={applyFilters}
              disabled={listLoading}
            >
              {listLoading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="mr-2 h-3.5 w-3.5" />
              )}
              查询
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-white text-xs font-semibold"
              disabled={listLoading || Number(list.page || 1) <= 1}
              onClick={() =>
                setQuery((prev) => ({
                  ...prev,
                  page: Math.max(1, Number(prev.page || 1) - 1),
                }))
              }
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-white text-xs font-semibold"
              disabled={listLoading || Number(list.page || 1) >= pageCount}
              onClick={() =>
                setQuery((prev) => ({
                  ...prev,
                  page: Math.min(pageCount, Number(prev.page || 1) + 1),
                }))
              }
            >
              下一页
            </Button>
          </div>
        </div>

        {listError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-700">
            {listError}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-gray-100 bg-white">
              {(list.items || []).length === 0 && !listLoading ? (
                <div className="px-4 py-8 text-center text-xs text-gray-500">
                  当前筛选条件下还没有执行日志。
                </div>
              ) : null}

              <div className="max-h-[720px] space-y-2 overflow-y-auto p-3">
                {(list.items || []).map((item) => {
                  const runRef = (item.run_ref || "").trim();
                  const active = runRef !== "" && runRef === selectedRunRef;
                  return (
                    <button
                      key={
                        runRef ||
                        `${item.started_at || ""}-${item.channel_id || ""}`
                      }
                      type="button"
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-blue-200 bg-blue-50 shadow-sm"
                          : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedRunRef(runRef)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-gray-900">
                            {runKindLabel(item.run_kind)}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {sceneLabel(item.scene_type)} /{" "}
                            {decisionLabel(item.decision_type)}
                          </div>
                        </div>
                        <Badge
                          className={`border-none px-1.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(item.status)}`}
                        >
                          {statusLabel(item.status)}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-1.5 text-[11px] leading-5 text-gray-600">
                        <div>开始时间：{formatDateTime(item.started_at)}</div>
                        <div>
                          会话标识：
                          <span className="font-mono text-gray-800">
                            {(item.conversation_key || "-").trim() || "-"}
                          </span>
                        </div>
                        <div>
                          渠道：
                          <span className="font-mono text-gray-800">
                            {(item.channel_id || "-").trim() || "-"}
                          </span>
                        </div>
                        <div>参与对象：{formatParticipants(item)}</div>
                        <div>总耗时：{formatLatency(item.latency_ms)}</div>
                        <div>
                          模型：
                          <span className="font-mono text-gray-800">
                            {(item.model || "-").trim() || "-"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {detailError ? (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-700">
                {detailError}
              </div>
            ) : null}

            {!selectedRunRef && !listLoading ? (
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-6 text-sm text-gray-500">
                  从左侧选择一条执行日志后，可以查看提示词、步骤时间线和工具调用明细。
                </CardContent>
              </Card>
            ) : null}

            {detailLoading && !detail ? (
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    正在加载执行详情...
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {detail ? (
              <>
                <SectionCard
                  title="运行摘要"
                  icon={<Clock3 className="h-4 w-4 text-gray-700" />}
                  open={openSections.summary}
                  onToggle={() => toggleSection("summary")}
                  summary={
                    selectedSummary
                      ? `${runKindLabel(selectedSummary.run_kind)} / ${statusLabel(selectedSummary.status)} / ${formatLatency(selectedSummary.latency_ms)}`
                      : ""
                  }
                >
                  <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryItem
                      label="执行类型"
                      value={runKindLabel(selectedSummary?.run_kind)}
                    />
                    <SummaryItem
                      label="最终判断"
                      value={decisionLabel(selectedSummary?.decision_type)}
                    />
                    <SummaryItem
                      label="状态"
                      value={statusLabel(selectedSummary?.status)}
                    />
                    <SummaryItem
                      label="开始时间"
                      value={formatDateTime(selectedSummary?.started_at)}
                    />
                    <SummaryItem
                      label="完成时间"
                      value={formatDateTime(selectedSummary?.completed_at)}
                    />
                    <SummaryItem
                      label="总耗时"
                      value={formatLatency(selectedSummary?.latency_ms)}
                    />
                    <SummaryItem
                      label="场景"
                      value={sceneLabel(selectedSummary?.scene_type)}
                    />
                    <SummaryItem
                      label="会话标识"
                      value={
                        (selectedSummary?.conversation_key || "-").trim() || "-"
                      }
                      mono
                    />
                    <SummaryItem
                      label="渠道"
                      value={(selectedSummary?.channel_id || "-").trim() || "-"}
                      mono
                    />
                    <SummaryItem
                      label="参与对象"
                      value={formatParticipants(selectedSummary)}
                    />
                    <SummaryItem
                      label="触发来源"
                      value={triggerSourceLabel(
                        selectedSummary?.trigger_source,
                      )}
                    />
                    <SummaryItem
                      label="模型"
                      value={(selectedSummary?.model || "-").trim() || "-"}
                      mono
                    />
                  </div>
                  {outputSummary ? (
                    <div className="border-t border-gray-100 px-3 pb-3 pt-1">
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <SummaryItem
                          label="发送策略"
                          value={sendIntentLabel(outputSummary.send_intent)}
                        />
                        <SummaryItem
                          label="人工复核"
                          value={
                            outputSummary.approval_required
                              ? `需要复核${outputSummary.approval_reason_code ? ` · ${approvalReasonLabel(outputSummary.approval_reason_code)}` : ""}`
                              : "无需复核"
                          }
                        />
                        <SummaryItem
                          label="风险等级"
                          value={riskLevelLabel(outputSummary.risk_level)}
                        />
                        <SummaryItem
                          label="置信度"
                          value={formatConfidence(outputSummary.confidence)}
                        />
                        <SummaryItem
                          label="客户意图"
                          value={humanizeCode(outputSummary.intent)}
                        />
                        <SummaryItem
                          label="当前主题"
                          value={humanizeCode(outputSummary.topic)}
                        />
                        <SummaryItem
                          label="会话阶段"
                          value={humanizeCode(outputSummary.conversation_stage)}
                        />
                        <SummaryItem
                          label="客户关系阶段"
                          value={humanizeCode(outputSummary.relationship_stage)}
                        />
                      </div>
                      {outputSummary.summary ? (
                        <DetailTextBlock
                          label="执行摘要"
                          value={outputSummary.summary}
                        />
                      ) : null}
                      {outputSummary.reason ? (
                        <DetailTextBlock
                          label="判断原因"
                          value={outputSummary.reason}
                        />
                      ) : null}
                      {outputSummary.reply_preview ? (
                        <DetailTextBlock
                          label="即时回复预览"
                          value={outputSummary.reply_preview}
                        />
                      ) : null}
                      {outputSummary.followup_preview ? (
                        <DetailTextBlock
                          label="后续跟进预览"
                          value={outputSummary.followup_preview}
                        />
                      ) : null}
                      {renderCompactStringList(
                        "下一步动作",
                        outputSummary.next_best_actions,
                      )}
                      {renderCompactStringList(
                        "机会信号",
                        outputSummary.opportunity_signals,
                      )}
                      {renderCompactStringList(
                        "风险标记",
                        outputSummary.risk_flags,
                      )}
                    </div>
                  ) : null}
                </SectionCard>

                <SectionCard
                  title="Prompt 与上下文"
                  open={openSections.prompt}
                  onToggle={() => toggleSection("prompt")}
                  summary={
                    promptSteps.length > 0
                      ? `共 ${promptSteps.length} 个步骤记录了 prompt 快照`
                      : "当前执行未记录额外 prompt 快照"
                  }
                >
                  <div className="space-y-3 p-3">
                    <DetailJSONBlock
                      label="运行输入摘要"
                      value={detail.input_summary_json}
                    />
                    {promptSteps.length === 0 ? (
                      <div className="text-xs text-gray-500">
                        当前执行没有记录到额外的 prompt 快照。
                      </div>
                    ) : (
                      promptSteps.map((step) => {
                        const stepKey = `prompt-${(step.step_ref || step.step_name || "").trim()}`;
                        const isOpen = Boolean(openSteps[stepKey]);
                        return (
                          <StepCollapseCard
                            key={stepKey}
                            title={stepTitle(step)}
                            open={isOpen}
                            onToggle={() => toggleStep(stepKey)}
                            badge={
                              <Badge
                                className={`border-none px-1.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(step.status)}`}
                              >
                                {statusLabel(step.status)}
                              </Badge>
                            }
                            summary={[
                              step.system_prompt_text ? "系统提示词" : "",
                              step.rendered_input_text ? "实际输入" : "",
                              step.input_json ? "结构化输入" : "",
                            ]
                              .filter(Boolean)
                              .join(" / ")}
                            className={stepCardClass(step)}
                          >
                            <div className="space-y-3">
                              <DetailTextBlock
                                label="系统提示词"
                                value={step.system_prompt_text}
                              />
                              <DetailTextBlock
                                label="实际输入"
                                value={step.rendered_input_text}
                              />
                              <DetailJSONBlock
                                label="结构化输入"
                                value={step.input_json}
                              />
                            </div>
                          </StepCollapseCard>
                        );
                      })
                    )}
                  </div>
                </SectionCard>

                <SectionCard
                  title="执行时间线"
                  icon={<GitBranch className="h-4 w-4 text-gray-700" />}
                  open={openSections.timeline}
                  onToggle={() => toggleSection("timeline")}
                  summary={
                    timelineSteps.length > 0
                      ? `共 ${timelineSteps.length} 个执行步骤`
                      : "当前执行没有结构化步骤时间线"
                  }
                >
                  <div className="space-y-3 p-3">
                    {timelineSteps.length === 0 ? (
                      <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-xs leading-6 text-amber-900">
                        该执行记录暂未记录结构化步骤时间线。常见原因是这条记录生成于执行观测升级前，或当次执行只保留了汇总结果。建议优先查看最新一条执行记录。
                      </div>
                    ) : null}
                    {timelineSteps.map((step) => {
                      const stepKey = `timeline-${(step.step_ref || step.step_name || "").trim()}`;
                      const isOpen = Boolean(openSteps[stepKey]);
                      return (
                        <StepCollapseCard
                          key={stepKey}
                          title={stepTitle(step)}
                          open={isOpen}
                          onToggle={() => toggleStep(stepKey)}
                          className={stepCardClass(step)}
                          badge={
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                className={`border-none px-1.5 py-0.5 text-[10px] font-bold ${stepKindBadgeClass(step.step_kind)}`}
                              >
                                {stepKindLabel(step.step_kind)}
                              </Badge>
                              <Badge
                                className={`border-none px-1.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(step.status)}`}
                              >
                                {statusLabel(step.status)}
                              </Badge>
                            </div>
                          }
                          summary={`第 ${Number(step.sequence_no || 0)} 步 / ${formatLatency(step.latency_ms)}${step.parallel_group ? ` / 并发组 ${step.parallel_group}` : ""}${step.lane_key ? ` / lane ${step.lane_key}` : ""}`}
                        >
                          <div className="space-y-3">
                            <div className="grid gap-2 text-[11px] text-gray-600 md:grid-cols-2 xl:grid-cols-4">
                              <div>开始：{formatDateTime(step.started_at)}</div>
                              <div>
                                完成：{formatDateTime(step.completed_at)}
                              </div>
                              <div>耗时：{formatLatency(step.latency_ms)}</div>
                              <div>
                                模型 / 工具：
                                {[
                                  (step.model || "").trim(),
                                  (step.tool_name || "").trim(),
                                ]
                                  .filter(Boolean)
                                  .join(" / ") || "-"}
                              </div>
                            </div>
                            {step.error_message ? (
                              <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
                                {step.error_message}
                              </div>
                            ) : null}
                            {(step.events || []).length > 0 ? (
                              <div className="space-y-2">
                                {(step.events || []).map((event) => (
                                  <div
                                    key={(
                                      event.event_ref ||
                                      `${step.step_ref}-${event.sequence_no || 0}`
                                    ).trim()}
                                    className={`rounded-xl border px-3 py-2.5 ${eventCardClass(event)}`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="text-xs font-semibold text-gray-900">
                                        {eventKindLabel(event.event_kind)}
                                      </div>
                                      <div className="text-[10px] text-gray-500">
                                        {formatDateTime(event.occurred_at)}
                                        {Number(event.latency_ms || 0) > 0
                                          ? ` / ${formatLatency(event.latency_ms)}`
                                          : ""}
                                      </div>
                                    </div>
                                    {event.message_text ? (
                                      <div className="mt-2 text-[11px] leading-5 text-gray-700">
                                        {event.message_text}
                                      </div>
                                    ) : null}
                                    {event.payload_json ? (
                                      <pre className="mt-2 overflow-x-auto rounded-lg border border-white/60 bg-white/80 p-2.5 text-[11px] leading-5 text-gray-700">
                                        {prettyJSON(event.payload_json)}
                                      </pre>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[11px] text-gray-500">
                                当前步骤没有记录到子事件。
                              </div>
                            )}
                          </div>
                        </StepCollapseCard>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard
                  title="工具调用明细"
                  icon={<Wrench className="h-4 w-4 text-gray-700" />}
                  open={openSections.tools}
                  onToggle={() => toggleSection("tools")}
                  summary={
                    toolRows.length > 0
                      ? `共 ${toolRows.length} 条工具调用或结果事件`
                      : "当前执行没有显式工具调用"
                  }
                >
                  <div className="space-y-3 p-3">
                    {toolRows.length === 0 ? (
                      <div className="text-xs text-gray-500">
                        当前执行没有记录到显式工具调用。
                      </div>
                    ) : (
                      toolRows.map(({ step, event }, index) => {
                        const stepKey = `tool-${step.step_ref || "step"}-${event.event_ref || index}`;
                        const isOpen = Boolean(openSteps[stepKey]);
                        return (
                          <StepCollapseCard
                            key={stepKey}
                            title={`${stepTitle(step)} / ${eventKindLabel(event.event_kind)}`}
                            open={isOpen}
                            onToggle={() => toggleStep(stepKey)}
                            className="border-amber-100 bg-amber-50/70"
                            summary={`${formatDateTime(event.occurred_at)}${Number(event.latency_ms || 0) > 0 ? ` / ${formatLatency(event.latency_ms)}` : ""}`}
                          >
                            <div className="space-y-3">
                              <div className="text-[11px] text-amber-900">
                                {event.message_text || "-"}
                              </div>
                              <pre className="overflow-x-auto rounded-lg border border-amber-100 bg-white px-3 py-3 text-[11px] leading-5 text-gray-700">
                                {prettyJSON(event.payload_json)}
                              </pre>
                            </div>
                          </StepCollapseCard>
                        );
                      })
                    )}
                  </div>
                </SectionCard>

                <SectionCard
                  title="最终输出"
                  open={openSections.output}
                  onToggle={() => toggleSection("output")}
                  summary={
                    finalOutputSteps.length > 0
                      ? `共 ${finalOutputSteps.length} 个输出步骤`
                      : "当前执行没有结构化输出快照"
                  }
                >
                  <div className="space-y-3 p-3">
                    <DetailJSONBlock
                      label="运行输出摘要"
                      value={detail.output_summary_json}
                    />
                    {finalOutputSteps.length === 0 ? (
                      <div className="text-xs text-gray-500">
                        当前执行没有记录到结构化输出快照。
                      </div>
                    ) : (
                      finalOutputSteps.map((step) => {
                        const stepKey = `output-${step.step_ref || step.step_name || ""}`;
                        const isOpen = Boolean(openSteps[stepKey]);
                        return (
                          <StepCollapseCard
                            key={stepKey}
                            title={stepTitle(step)}
                            open={isOpen}
                            onToggle={() => toggleStep(stepKey)}
                            className="border-gray-100 bg-white"
                            summary={[
                              step.output_text ? "文本输出" : "",
                              step.output_json ? "结构化输出" : "",
                            ]
                              .filter(Boolean)
                              .join(" / ")}
                          >
                            <div className="space-y-3">
                              <DetailTextBlock
                                label="文本输出"
                                value={step.output_text}
                              />
                              <DetailJSONBlock
                                label="结构化输出"
                                value={step.output_json}
                              />
                            </div>
                          </StepCollapseCard>
                        );
                      })
                    )}
                  </div>
                </SectionCard>
              </>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <div
        className={`mt-1.5 break-all text-xs font-semibold text-gray-900 ${mono ? "font-mono" : ""}`}
      >
        {value || "-"}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  open,
  onToggle,
  summary,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 border-b border-gray-50 px-4 py-3 text-left"
        onClick={onToggle}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
            {icon}
            <span>{title}</span>
          </div>
          {summary ? (
            <div className="mt-1 text-[11px] text-gray-500">{summary}</div>
          ) : null}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
        )}
      </button>
      {open ? children : null}
    </Card>
  );
}

function StepCollapseCard({
  title,
  open,
  onToggle,
  summary,
  badge,
  className,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  summary?: string;
  badge?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${className || "border-gray-100 bg-white"}`}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={onToggle}
      >
        <div className="min-w-0">
          <div className="text-xs font-bold text-gray-900">{title}</div>
          {summary ? (
            <div className="mt-1 text-[11px] text-gray-500">{summary}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          {open ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function DetailTextBlock({ label, value }: { label: string; value?: string }) {
  const text = (value || "").trim();
  if (!text) return null;
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold text-gray-700">{label}</div>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-gray-100 bg-white p-2.5 text-[11px] leading-5 text-gray-700">
        {text}
      </pre>
    </div>
  );
}

function DetailJSONBlock({ label, value }: { label: string; value?: string }) {
  const text = (value || "").trim();
  if (!text) return null;
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold text-gray-700">{label}</div>
      <pre className="overflow-x-auto rounded-lg border border-gray-100 bg-white p-2.5 text-[11px] leading-5 text-gray-700">
        {prettyJSON(text)}
      </pre>
    </div>
  );
}

function runKindLabel(value?: string): string {
  switch ((value || "").trim()) {
    case "realtime_reply":
      return "智能客服 AI 回复";
    case "reply_suggestion":
      return "AI 回复建议";
    case "rpa_auto_reply":
      return "自动模式回复";
    default:
      return "未分类执行";
  }
}

function sceneLabel(value?: string): string {
  switch ((value || "").trim()) {
    case "wecom_kf":
      return "企业微信客服";
    case "wecom_dm":
      return "企业微信单聊";
    case "wecom_group":
      return "企业微信群聊";
    default:
      return "未分类场景";
  }
}

function decisionLabel(value?: string): string {
  switch ((value || "").trim()) {
    case "reply_now":
      return "立即回复";
    case "reply_with_followup":
      return "回复并跟进";
    case "handoff_to_human":
      return "转人工";
    case "ignore":
      return "跳过执行";
    case "reply_suggestion":
      return "建议回复";
    default:
      return "未分类结果";
  }
}

function triggerSourceLabel(value?: string): string {
  switch ((value || "").trim()) {
    case "message_event":
      return "消息事件触发";
    case "manual_refresh":
      return "人工刷新";
    case "session_change":
      return "会话状态变化";
    case "rpa_request":
      return "自动模式请求";
    case "scheduled":
      return "定时检查";
    case "state_bootstrap":
      return "状态预热";
    default:
      return "未标注来源";
  }
}

function statusLabel(value?: string): string {
  switch ((value || "").trim()) {
    case "reply_generated":
      return "已生成回复";
    case "followup_scheduled":
      return "已安排跟进";
    case "handoff_requested":
      return "已请求人工介入";
    case "decided":
      return "已完成判断";
    case "suppressed":
      return "已跳过执行";
    case "ready":
      return "已就绪";
    case "queued":
      return "已排队";
    case "running":
      return "执行中";
    case "failed":
      return "执行失败";
    case "succeeded":
      return "执行成功";
    default:
      return "状态未知";
  }
}

function statusBadgeClass(value?: string): string {
  switch ((value || "").trim()) {
    case "reply_generated":
    case "followup_scheduled":
    case "decided":
    case "ready":
    case "succeeded":
      return "bg-green-100 text-green-700";
    case "queued":
    case "running":
      return "bg-blue-100 text-blue-700";
    case "suppressed":
      return "bg-slate-100 text-slate-700";
    case "handoff_requested":
      return "bg-amber-100 text-amber-700";
    case "failed":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function sendIntentLabel(value?: string): string {
  switch ((value || "").trim()) {
    case "auto_send_candidate":
      return "可自动发送";
    case "manual_send":
      return "进入人工复核";
    case "do_not_send":
      return "不发送";
    default:
      return "未标注";
  }
}

function riskLevelLabel(value?: string): string {
  switch ((value || "").trim()) {
    case "high":
      return "高风险";
    case "medium":
      return "中风险";
    case "low":
      return "低风险";
    default:
      return "未标注";
  }
}

function approvalReasonLabel(value?: string): string {
  const code = (value || "").trim();
  if (!code) return "";
  switch (code) {
    case "refund_dispute":
      return "退款争议";
    case "complaint":
    case "complaint_escalation":
      return "投诉升级";
    case "legal_risk":
      return "法律风险";
    case "payment_risk":
      return "支付风险";
    case "low_confidence":
      return "置信度偏低";
    case "approval_required":
      return "策略要求复核";
    default:
      return humanizeCode(code);
  }
}

function stepKindLabel(value?: string): string {
  switch ((value || "").trim()) {
    case "decision":
      return "决策";
    case "decision_review":
      return "复核";
    case "generation":
      return "回复生成";
    case "suggestion_generation":
      return "建议生成";
    case "tool_call":
      return "工具调用";
    case "tool_result":
      return "工具返回";
    case "branch":
      return "分支选择";
    case "finalize":
      return "完成收口";
    case "system_guard":
      return "前置判断";
    default:
      return "执行步骤";
  }
}

function stepKindBadgeClass(value?: string): string {
  switch ((value || "").trim()) {
    case "decision":
      return "bg-sky-100 text-sky-700";
    case "decision_review":
      return "bg-indigo-100 text-indigo-700";
    case "generation":
    case "suggestion_generation":
      return "bg-emerald-100 text-emerald-700";
    case "tool_call":
    case "tool_result":
      return "bg-amber-100 text-amber-700";
    case "finalize":
      return "bg-slate-100 text-slate-700";
    case "system_guard":
      return "bg-zinc-100 text-zinc-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function eventKindLabel(value?: string): string {
  switch ((value || "").trim()) {
    case "prompt_built":
      return "Prompt 已构建";
    case "model_request":
      return "模型请求";
    case "model_response":
      return "模型返回";
    case "tool_call":
      return "工具调用";
    case "tool_result":
      return "工具返回";
    case "parse_result":
      return "结果解析";
    case "branch_selected":
      return "分支选择";
    case "error":
      return "执行异常";
    default:
      return "步骤事件";
  }
}

function eventCardClass(event: AssistantExecutionStepEvent): string {
  const kind = (event.event_kind || "").trim();
  if (kind === "error") return "border-red-100 bg-red-50/70";
  if (kind === "tool_call" || kind === "tool_result")
    return "border-amber-100 bg-amber-50/70";
  if (kind === "model_request" || kind === "model_response")
    return "border-blue-100 bg-blue-50/70";
  return "border-gray-100 bg-gray-50/70";
}

function stepCardClass(step: AssistantExecutionStep): string {
  if ((step.status || "").trim() === "failed") {
    return "border-red-100 bg-red-50/70";
  }
  switch ((step.step_kind || "").trim()) {
    case "decision":
      return "border-sky-100 bg-sky-50/70";
    case "decision_review":
      return "border-indigo-100 bg-indigo-50/70";
    case "generation":
    case "suggestion_generation":
      return "border-emerald-100 bg-emerald-50/70";
    case "tool_call":
    case "tool_result":
      return "border-amber-100 bg-amber-50/70";
    case "finalize":
      return "border-slate-100 bg-slate-50/70";
    default:
      return "border-gray-100 bg-gray-50/70";
  }
}

function stepTitle(step: AssistantExecutionStep): string {
  return (step.step_name || "").trim() || stepKindLabel(step.step_kind);
}

function formatDateTime(value?: string): string {
  const text = (value || "").trim();
  if (!text) return "-";
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return text;
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false });
}

function formatLatency(value?: number): string {
  const latency = Number(value || 0);
  if (!Number.isFinite(latency) || latency <= 0) return "0 ms";
  if (latency < 1000) return `${latency} ms`;
  return `${(latency / 1000).toFixed(latency >= 10_000 ? 1 : 2)} s`;
}

function formatParticipants(run?: AssistantExecutionRunSummary): string {
  const labels = (run?.participants || [])
    .map((item) => (item.label || item.participant_id || "").trim())
    .filter(Boolean);
  if (labels.length > 0) return labels.join(" / ");
  return (run?.contact_name || run?.channel_id || "-").trim() || "-";
}

function parseAssistantOutputSummary(
  value?: string,
): AssistantOutputSummary | null {
  const text = (value || "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as AssistantOutputSummary;
  } catch {
    return null;
  }
}

function renderCompactStringList(label: string, values?: string[]) {
  const items = (values || []).map((item) => (item || "").trim()).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="mb-2 text-[11px] font-bold text-gray-700">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={`${label}-${item}`}
            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-700"
          >
            {humanizeCode(item)}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatConfidence(value?: number): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "-";
  return `${Math.round(num * 100)}%`;
}

function humanizeCode(value?: string): string {
  const text = (value || "").trim();
  if (!text) return "-";
  return text.replace(/_/g, " ");
}

function prettyJSON(value?: string): string {
  const text = (value || "").trim();
  if (!text) return "-";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
