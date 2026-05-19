import { Button } from "@/components/ui/Button";
import { normalizeErrorMessage } from "@/services/http";
import {
  listKFToolbarRPASendQueue,
  type ToolbarRPASendQueueItem,
  type ToolbarRPASendQueuePreview,
} from "@/services/rpaToolbarService";
import { ArrowLeft, MessageSquareText, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const SEND_QUEUE_PAGE_LIMIT = 100;

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

function sendQueueItemSummary(item: ToolbarRPASendQueueItem): string {
  const channelLabel = (item.channel_label || "").trim() || "微信客服";
  const agentLabel = (item.open_kfid || "").trim() || "待确认客服号";
  const customerLabel =
    (item.contact_name || "").trim() ||
    (item.external_userid || "").trim() ||
    "待确认客户";
  return [channelLabel, agentLabel, customerLabel].join(" / ");
}

// Read-only supervisory page for the prepared send queue. Editing and
// regeneration actions will attach here later without changing the queue truth.
export default function RPASendQueuePage() {
  const [preview, setPreview] = useState<ToolbarRPASendQueuePreview | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const loadQueue = async () => {
    setIsLoading(true);
    setErrorText("");
    try {
      const next = await listKFToolbarRPASendQueue({
        limit: SEND_QUEUE_PAGE_LIMIT,
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
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-[linear-gradient(135deg,#0F4C81,#2B6CB0_58%,#D9E8F6)] px-6 py-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white/90">
                <MessageSquareText className="h-3.5 w-3.5" />
                待发送队列
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  已准备好的回复，按真实发送顺序排队
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/88">
                  这里只展示正式进入待发送队列的回复，不展示 AI 生成中的内部流水线状态。后续的编辑、重生成和忽略动作会直接接在这张队列表上。
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
        <div className="grid gap-4 border-t border-slate-100 bg-slate-50/70 px-6 py-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              队列总数
            </div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">
              {total}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              当前载入
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {preparedCountLabel}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              页面定位
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              当前是监督页，不承载发送动作。工具栏继续只负责当前执行与队列摘要。
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
            队列顺序与工具栏一致，按正式 prepared 入队顺序展示。
          </p>
        </div>
        <div className="px-6 py-5">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-2xl border border-slate-100 bg-slate-50"
                />
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item, index) => (
                <article
                  key={item.prepared_reply_id || `${item.open_kfid || ""}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#FFFFFF,#F8FAFC)] px-4 py-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-white">
                          #{index + 1}
                        </span>
                        <h3 className="truncate text-sm font-semibold text-slate-900">
                          {sendQueueItemSummary(item)}
                        </h3>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
                        <span>客户ID：{(item.external_userid || "").trim() || "-"}</span>
                        <span>客服号：{(item.open_kfid || "").trim() || "-"}</span>
                        <span>准备时间：{formatQueueDateTime(item.prepared_at)}</span>
                      </div>
                    </div>
                    <div className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
                      已准备 {Math.max(Number(item.reply_count || 0), 1)} 条回复
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
              <div className="text-base font-semibold text-slate-700">
                当前没有待发送回复
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                新的 AI 回复只有在正式进入待发送队列后，才会出现在这里。
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
