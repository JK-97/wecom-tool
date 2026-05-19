import { Button } from "@/components/ui/Button";
import { normalizeErrorMessage } from "@/services/http";
import {
  listKFToolbarRPAReviewQueue,
  type ToolbarRPAReviewQueueItem,
  type ToolbarRPAReviewQueuePreview,
} from "@/services/rpaToolbarService";
import { AlertTriangle, ArrowLeft, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const REVIEW_QUEUE_PAGE_LIMIT = 100;

function formatQueueDateTime(raw?: string): string {
  const value = (raw || "").trim();
  if (!value) return "时间待确认";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "时间待确认";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function reviewQueueItemSummary(item: ToolbarRPAReviewQueueItem): string {
  const channelLabel = (item.channel_label || "").trim() || "微信客服";
  const agentLabel = (item.open_kfid || "").trim() || "待确认客服号";
  const customerLabel =
    (item.contact_name || "").trim() ||
    (item.external_userid || "").trim() ||
    "待确认客户";
  return [channelLabel, agentLabel, customerLabel].join(" / ");
}

function reviewQueueStatusLabel(value?: string): string {
  switch ((value || "").trim()) {
    case "manual_review_required":
      return "AI 判定需人工复核";
    case "confirm_uncertain":
      return "发送确认不明确";
    case "review_resend_pending":
      return "待复查重发";
    case "need_manual":
      return "当前消息需人工处理";
    case "failed":
      return "自动发送失败";
    default:
      return (value || "").trim() || "待人工处理";
  }
}

// Read-only supervisory page for manual-review work. Later review handling can
// extend this page without changing the toolbar summary contract.
export default function RPAReviewQueuePage() {
  const [preview, setPreview] = useState<ToolbarRPAReviewQueuePreview | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const loadQueue = async () => {
    setIsLoading(true);
    setErrorText("");
    try {
      const next = await listKFToolbarRPAReviewQueue({
        limit: REVIEW_QUEUE_PAGE_LIMIT,
        offset: 0,
      });
      setPreview(next);
    } catch (error) {
      setErrorText(normalizeErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, []);

  const items = preview?.items || [];
  const total = Number(preview?.total || 0);
  const preparedCountLabel = useMemo(() => {
    if (total <= items.length) return `共 ${total} 条`;
    return `当前展示 ${items.length} / 共 ${total} 条`;
  }, [items.length, total]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-sm">
        <div className="bg-[linear-gradient(135deg,#7C3A00,#C26A00_58%,#F7D8A8)] px-6 py-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white/90">
                <AlertTriangle className="h-3.5 w-3.5" />
                待复核队列
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  已进入人工处理边界的会话，统一在这里监督
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/88">
                  这里只展示正式进入待复核队列的会话，不再把临时生成状态混进工具栏。后续的继续自动、人工完成、编辑回复等动作会直接接在这张队列表上。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="border-white/35 bg-white/10 text-white hover:bg-white/15"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                返回
              </Button>
              <Button
                variant="outline"
                className="border-white/35 bg-white/10 text-white hover:bg-white/15"
                onClick={() => void loadQueue()}
                disabled={isLoading}
              >
                <RefreshCcw
                  className={`mr-1.5 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
                刷新
              </Button>
            </div>
          </div>
        </div>
        <div className="grid gap-4 border-t border-amber-100 bg-amber-50/50 px-6 py-4 md:grid-cols-3">
          <div className="rounded-xl border border-amber-100 bg-white px-4 py-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
              队列总数
            </div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">
              {total}
            </div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-white px-4 py-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
              当前载入
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {preparedCountLabel}
            </div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-white px-4 py-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
              页面定位
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              当前是监督页，不抢占工具栏空间。后续完整人工处理工作台会沿用这里的队列语义继续扩展。
            </div>
          </div>
        </div>
      </section>

      {errorText ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorText}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">队列明细</h2>
          <p className="mt-1 text-sm text-slate-500">
            AI 需要人工复核的结果，以及执行过程中进入人工边界的消息，都会统一落在这里。
          </p>
        </div>
        <div className="px-6 py-5">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-2xl border border-amber-100 bg-amber-50/50"
                />
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item, index) => (
                <article
                  key={item.queue_entry_id || `${item.prepared_reply_id || item.message_task_id || ""}-${index}`}
                  className="rounded-2xl border border-amber-100 bg-[linear-gradient(180deg,#FFFFFF,#FFFBEB)] px-4 py-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
                          #{index + 1}
                        </span>
                        <h3 className="truncate text-sm font-semibold text-slate-900">
                          {reviewQueueItemSummary(item)}
                        </h3>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
                        <span>客户ID：{(item.external_userid || "").trim() || "-"}</span>
                        <span>客服号：{(item.open_kfid || "").trim() || "-"}</span>
                        <span>进入队列：{formatQueueDateTime(item.queued_at)}</span>
                      </div>
                      <div className="mt-3 rounded-xl border border-amber-100 bg-white/80 px-3 py-2 text-[12px] leading-6 text-slate-700">
                        {(item.reason || item.message_preview || "等待人工处理").trim()}
                      </div>
                    </div>
                    <div className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800">
                      {reviewQueueStatusLabel(item.source_status)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <div className="text-base font-semibold text-slate-700">
                当前没有待复核会话
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                需要人工处理的会话会在正式入队后展示在这里。
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
