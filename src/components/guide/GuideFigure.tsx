import { CheckCircle2, CircleDot, Play, Search, Settings, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"

type GuideFigureProps = {
  source: string
  anchorID?: string
}

function readValue(lines: string[], key: string) {
  return lines.find((line) => line.startsWith(`${key}:`))?.replace(new RegExp(`^${key}:\\s*`), "").trim() || ""
}

function parseFigure(source: string) {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  return {
    title: readValue(lines, "title") || "页面示意",
    caption: readValue(lines, "caption"),
    variant: readValue(lines, "variant") || "areas",
    areas: readValue(lines, "areas")
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean),
  }
}

function Callout({ index, label, className }: { index: number; label: string; className: string }) {
  return (
    <div className={cn("absolute z-10 max-w-[170px]", className)}>
      <div className="rounded-md border border-blue-200 bg-white px-2.5 py-2 text-xs leading-5 text-blue-800 shadow-sm">
        <span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
          {index}
        </span>
        {label}
      </div>
    </div>
  )
}

function Highlight({ className }: { className: string }) {
  return <div className={cn("absolute rounded-xl border-2 border-blue-500 ring-4 ring-blue-200/70", className)} />
}

function ToolbarMockup() {
  return (
    <div className="relative mx-auto max-w-sm rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">林女士</div>
            <div className="text-xs text-gray-500">微信客服 · 接待中</div>
          </div>
        </div>
        <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700">高意向</span>
      </div>
      <div className="space-y-3">
        <section className="rounded-lg border border-gray-200 p-3">
          <div className="mb-2 text-xs font-semibold text-gray-500">会话摘要</div>
          <div className="space-y-1.5">
            <div className="h-2 rounded bg-gray-100" />
            <div className="h-2 w-4/5 rounded bg-gray-100" />
          </div>
        </section>
        <section className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700">自动发送</span>
            <button className="rounded-md border border-blue-200 bg-white px-2 py-1 text-[11px] font-medium text-blue-700">客户端 ID</button>
          </div>
          <div className="rounded-md bg-white p-2 text-xs leading-5 text-gray-600">当前任务允许自动发送，请确认客户上下文后开启。</div>
          <button className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1 rounded-md bg-blue-600 text-xs font-medium text-white">
            <Play className="h-3 w-3" />
            开启自动发送
          </button>
        </section>
      </div>
      <Highlight className="right-3 top-[102px] h-[142px] w-[calc(100%-1.5rem)]" />
      <Highlight className="right-6 top-[138px] h-8 w-20 rounded-md" />
      <Callout index={1} label="先确认客户和会话状态" className="-left-5 top-6" />
      <Callout index={2} label="没有客户端 ID 时不能开启" className="-right-6 top-32" />
      <Callout index={3} label="确认任务后再开启自动发送" className="bottom-2 left-8" />
    </div>
  )
}

function CommandCenterMockup() {
  return (
    <div className="relative grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_1.5fr_1fr]">
      <div className="rounded-xl border border-gray-200 p-3">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-500">
          <Search className="h-3.5 w-3.5" />
          会话列表
        </div>
        {["排队中客户", "接待中客户", "已结束客户"].map((item, index) => (
          <div key={item} className={cn("mb-2 rounded-lg border p-2 text-xs", index === 1 ? "border-blue-200 bg-blue-50 text-blue-800" : "border-gray-100 text-gray-600")}>
            {item}
          </div>
        ))}
      </div>
      <div className="rounded-xl border-2 border-blue-300 bg-blue-50/30 p-3">
        <div className="mb-3 text-xs font-semibold text-blue-700">聊天区和会话动作</div>
        <div className="space-y-2">
          <div className="w-3/4 rounded-lg bg-white p-2 text-xs text-gray-600">客户最近消息...</div>
          <div className="ml-auto w-2/3 rounded-lg bg-blue-600 p-2 text-xs text-white">客服回复...</div>
        </div>
        <div className="mt-4 flex gap-2">
          <span className="rounded-md bg-white px-2 py-1 text-[11px] text-gray-600">转人工</span>
          <span className="rounded-md bg-white px-2 py-1 text-[11px] text-gray-600">结束会话</span>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 p-3">
        <div className="mb-3 text-xs font-semibold text-gray-500">AI 实时监控</div>
        <div className="space-y-2">
          <div className="rounded-md bg-orange-50 p-2 text-xs text-orange-700">风险提示</div>
          <div className="rounded-md bg-gray-50 p-2 text-xs text-gray-600">会话摘要</div>
          <div className="rounded-md bg-gray-50 p-2 text-xs text-gray-600">下一步建议</div>
        </div>
      </div>
      <Callout index={1} label="左侧先选会话" className="left-2 top-2" />
      <Callout index={2} label="中间完成阅读和操作" className="left-1/2 top-6 -translate-x-1/2" />
      <Callout index={3} label="右侧辅助判断风险" className="right-2 top-2" />
    </div>
  )
}

function ReceptionChannelMockup() {
  return (
    <div className="relative grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-[0.9fr_1.35fr_1fr]">
      <div className="rounded-xl border border-gray-200 p-3">
        <div className="mb-3 text-xs font-semibold text-gray-500">渠道列表</div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs font-medium text-blue-800">AI客服体验助理</div>
        <div className="mt-2 rounded-lg border border-gray-100 p-2 text-xs text-gray-600">售前咨询</div>
      </div>
      <div className="rounded-xl border-2 border-blue-300 bg-blue-50/30 p-3">
        <div className="mb-2 text-xs font-semibold text-blue-700">接待池摘要</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md bg-white p-2 text-xs text-gray-700">成员 8 人</div>
          <div className="rounded-md bg-white p-2 text-xs text-gray-700">部门 2 个</div>
        </div>
        <button className="mt-3 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">编辑接待对象</button>
      </div>
      <div className="rounded-xl border border-gray-200 p-3">
        <div className="mb-2 text-xs font-semibold text-gray-500">默认兜底规则</div>
        <div className="rounded-md bg-gray-50 p-2 text-xs text-gray-600">AI 后转人工 · 使用整个接待池</div>
      </div>
      <Callout index={1} label="先选渠道" className="left-2 top-3" />
      <Callout index={2} label="重点检查接待池摘要" className="left-1/2 top-6 -translate-x-1/2" />
      <Callout index={3} label="兜底规则会影响未命中客户" className="right-2 top-3" />
    </div>
  )
}

function AreasMockup({ areas }: { areas: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {areas.map((area, index) => (
        <div
          key={area}
          className={cn(
            "min-h-24 rounded-md border border-gray-200 bg-white p-3 text-sm font-medium text-gray-700",
            index === 1 && "border-blue-200 bg-blue-50/50",
          )}
        >
          <div className="mb-2 h-1.5 w-10 rounded-full bg-blue-500" />
          {area}
          <div className="mt-3 space-y-1">
            <div className="h-2 rounded bg-gray-100" />
            <div className="h-2 w-2/3 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function GuideFigure({ source, anchorID }: GuideFigureProps) {
  const { title, caption, variant, areas } = parseFigure(source)
  return (
    <figure id={anchorID} className="my-6 scroll-mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <figcaption className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-500">
        <CircleDot className="h-3.5 w-3.5 text-blue-500" />
        {title}
      </figcaption>
      {variant === "toolbar" ? <ToolbarMockup /> : null}
      {variant === "cs-center" ? <CommandCenterMockup /> : null}
      {variant === "reception-channel" ? <ReceptionChannelMockup /> : null}
      {!["toolbar", "cs-center", "reception-channel"].includes(variant) ? <AreasMockup areas={areas} /> : null}
      {caption ? (
        <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-gray-500">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
          {caption}
        </p>
      ) : null}
    </figure>
  )
}
