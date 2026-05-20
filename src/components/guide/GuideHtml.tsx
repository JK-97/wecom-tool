import {
  Bot,
  CheckCircle2,
  Clock3,
  GitBranch,
  KeyRound,
  MessageSquareText,
  MousePointerClick,
  Play,
  Plus,
  RefreshCcw,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import type { ReactNode } from "react"
import { readGuideBlockTitle } from "@/components/guide/GuideDiagram"
import { cn } from "@/lib/utils"

type GuideHtmlProps = {
  source: string
  anchorID?: string
}

type ArrowDirection = "up" | "down" | "left" | "right" | "downRight" | "downLeft"

type ArrowNoteProps = {
  idPrefix: string
  index: number
  label: string
  className: string
  direction?: ArrowDirection
}

function readValue(source: string, key: string) {
  return (
    source
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith(`${key}:`))
      ?.replace(new RegExp(`^${key}:\\s*`), "")
      .trim() || ""
  )
}

function arrowShape(direction: ArrowDirection) {
  switch (direction) {
    case "up":
      return {
        box: "left-8 bottom-[calc(100%-2px)] h-14 w-8",
        viewBox: "0 0 28 56",
        path: "M14 54 C14 39 14 24 14 4",
      }
    case "down":
      return {
        box: "left-8 top-[calc(100%-2px)] h-14 w-8",
        viewBox: "0 0 28 56",
        path: "M14 2 C14 17 14 32 14 52",
      }
    case "left":
      return {
        box: "right-[calc(100%-2px)] top-1/2 h-8 w-16 -translate-y-1/2",
        viewBox: "0 0 64 28",
        path: "M62 14 C44 14 26 14 4 14",
      }
    case "downLeft":
      return {
        box: "right-[calc(100%-4px)] top-[calc(100%-4px)] h-16 w-20",
        viewBox: "0 0 80 64",
        path: "M76 4 C52 16 28 34 6 58",
      }
    case "downRight":
      return {
        box: "left-[calc(100%-4px)] top-[calc(100%-4px)] h-16 w-20",
        viewBox: "0 0 80 64",
        path: "M4 4 C28 16 52 34 74 58",
      }
    case "right":
    default:
      return {
        box: "left-[calc(100%-2px)] top-1/2 h-8 w-16 -translate-y-1/2",
        viewBox: "0 0 64 28",
        path: "M2 14 C20 14 38 14 60 14",
      }
  }
}

function ArrowNote({
  idPrefix,
  index,
  label,
  className,
  direction = "right",
}: ArrowNoteProps) {
  const markerID = `guide-arrow-${idPrefix}-${index}`
  const shape = arrowShape(direction)

  return (
    <div className={cn("pointer-events-none absolute z-30 max-w-[230px]", className)}>
      <div className="inline-flex items-start gap-2 rounded-md border border-blue-200 bg-white/95 px-3 py-2 text-xs leading-5 text-blue-800 shadow-lg shadow-blue-950/10 backdrop-blur">
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
          {index}
        </span>
        <span>{label}</span>
      </div>
      <svg
        className={cn("absolute overflow-visible text-blue-500 drop-shadow-sm", shape.box)}
        viewBox={shape.viewBox}
        aria-hidden="true"
      >
        <defs>
          <marker
            id={markerID}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
          </marker>
        </defs>
        <path
          d={shape.path}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
          markerEnd={`url(#${markerID})`}
        />
      </svg>
    </div>
  )
}

function DiagramCanvas({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className={cn("relative min-w-[720px] rounded-xl border border-gray-200 bg-white p-4 shadow-sm", className)}>
        {children}
      </div>
    </div>
  )
}

function MiniLine({ width = "w-full" }: { width?: string }) {
  return <div className={cn("h-2 rounded-full bg-gray-100", width)} />
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone: string
}) {
  return (
    <div className="flex min-h-[76px] items-center gap-3 rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-100">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", tone)}>
        <RefreshCw className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-gray-500">{label}</div>
        <div className="mt-0.5 text-xl font-bold text-gray-900">{value}</div>
        <div className="mt-0.5 truncate text-[10px] text-gray-400">{hint}</div>
      </div>
    </div>
  )
}

function ReceptionChannelDemo() {
  return (
    <DiagramCanvas className="min-h-[410px] bg-[#F7F8FA]">
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="渠道总数" value="12" hint="本地物化视图" tone="bg-blue-50 text-blue-600" />
        <MetricCard label="启用中" value="9" hint="状态为 active" tone="bg-green-50 text-green-600" />
        <MetricCard label="异常渠道" value="0" hint="刷新失败 0" tone="bg-red-50 text-red-600" />
        <MetricCard label="待同步" value="1" hint="进行中 0 / 待刷新 1" tone="bg-orange-50 text-orange-600" />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-100">
        <div className="flex items-center justify-between border-b border-gray-100 p-3">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-56 rounded-md border border-gray-200 bg-white">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <span className="absolute left-8 top-1/2 -translate-y-1/2 text-xs text-gray-400">搜索渠道名称或 ID...</span>
            </div>
            <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 text-xs font-medium text-blue-700 shadow-[0_0_0_2px_rgba(59,130,246,0.08)]">
              <RefreshCw className="h-3.5 w-3.5" />
              刷新列表
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-8 rounded-md border border-gray-200 px-3 text-xs text-gray-600">查看渠道文档</button>
            <button className="inline-flex h-8 items-center gap-1 rounded-md bg-blue-600 px-3 text-xs font-medium text-white">
              <Plus className="h-3.5 w-3.5" />
              创建客服账号
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[1.4fr_1.4fr_0.9fr_0.7fr_1.2fr_1.2fr_0.8fr] bg-gray-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          <span>渠道信息</span>
          <span>Open KFID</span>
          <span>渠道来源</span>
          <span>状态</span>
          <span>人工配置范围</span>
          <span>默认路由规则</span>
          <span className="text-right">操作</span>
        </div>
        <div className="grid grid-cols-[1.4fr_1.4fr_0.9fr_0.7fr_1.2fr_1.2fr_0.8fr] items-center border-t border-gray-100 px-4 py-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">AI客服体验助理</div>
              <div className="text-[10px] text-gray-400">售前咨询</div>
            </div>
          </div>
          <span className="font-mono text-[10px] text-gray-400">wkf_xxxxx...</span>
          <span>企业微信客服</span>
          <span className="w-fit rounded-full bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700">active</span>
          <div className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-blue-800">
            成员 8 人 · 部门 2 个
          </div>
          <div className="rounded-md border border-blue-200 bg-white px-2 py-1.5 text-blue-800">
            AI 后转人工 · 整个接待池
          </div>
          <div className="text-right text-blue-600">详情</div>
        </div>
        <div className="grid grid-cols-[1.4fr_1.4fr_0.9fr_0.7fr_1.2fr_1.2fr_0.8fr] items-center border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          <span>售后咨询</span>
          <span className="font-mono text-[10px]">wkf_yyyyy...</span>
          <span>企业微信客服</span>
          <span className="w-fit rounded-full bg-green-50 px-2 py-1 text-[10px] text-green-700">active</span>
          <span>成员 3 人</span>
          <span>仅 AI</span>
          <span className="text-right text-blue-600">详情</span>
        </div>
      </div>

      <ArrowNote
        idPrefix="reception"
        index={1}
        label="刷新列表只刷新客服账号和渠道状态，组织成员需要在组织与设置里同步"
        className="left-[255px] top-[88px]"
        direction="down"
      />
      <ArrowNote
        idPrefix="reception"
        index={2}
        label="人工配置范围是路由可选人员的来源，优先确认这里是否回显"
        className="left-[390px] top-[278px]"
        direction="down"
      />
      <ArrowNote
        idPrefix="reception"
        index={3}
        label="默认路由规则会接住没有命中普通规则的客户"
        className="right-[58px] top-[278px]"
        direction="down"
      />
    </DiagramCanvas>
  )
}

function RoutingRuleDemo() {
  return (
    <DiagramCanvas className="min-h-[430px] bg-[#F7F8FA]">
      <div className="grid grid-cols-[240px_1fr_180px] gap-4">
        <aside className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">路由规则</div>
            <button className="rounded-md bg-blue-600 px-2.5 py-1.5 text-[11px] font-medium text-white">新建</button>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-gray-100 p-1 text-[11px]">
            <span className="rounded bg-white px-2 py-1 text-blue-700 shadow-sm">AI客服体验助理</span>
            <span className="px-2 py-1 text-gray-500">售前咨询</span>
          </div>
          <div className="space-y-2">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">活动咨询转人工</div>
            <div className="rounded-md border border-gray-100 bg-white p-2 text-xs text-gray-600">默认兜底规则</div>
          </div>
        </aside>

        <main className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">新建路由规则</div>
              <div className="mt-1 text-[11px] text-gray-400">按基础信息、匹配条件、执行动作依次填写</div>
            </div>
            <button className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">保存规则</button>
          </div>

          <section className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-600">
              <GitBranch className="h-3.5 w-3.5 text-blue-600" />
              基础信息
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-gray-200 bg-white p-2 text-xs text-gray-600">
                规则名称
                <div className="mt-1 font-medium text-gray-900">活动咨询转人工</div>
              </div>
              <div className="rounded-md border border-blue-300 bg-blue-50 p-2 text-xs text-blue-800 shadow-[0_0_0_2px_rgba(59,130,246,0.08)]">
                应用渠道
                <div className="mt-1 font-semibold">AI客服体验助理</div>
              </div>
            </div>
          </section>

          <section className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 text-xs font-semibold text-gray-600">匹配条件</div>
            <div className="rounded-md bg-white p-2 text-xs text-gray-600">客户消息包含：活动、优惠、价格</div>
          </section>

          <section className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 text-xs font-semibold text-gray-600">执行动作</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md bg-white p-2 text-xs text-gray-700">动作模式：AI 后转人工</div>
              <div className="rounded-md border border-blue-300 bg-blue-50 p-2 text-xs text-blue-800">
                人工范围：接待池对象子集
              </div>
              <div className="rounded-md bg-white p-2 text-xs text-gray-700">分配策略：优先空闲</div>
            </div>
            <div className="mt-2 rounded-md bg-white p-2 text-xs text-gray-500">只展示当前渠道接待池中的成员和部门。</div>
          </section>
        </main>

        <aside className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-600">
            <Clock3 className="h-3.5 w-3.5 text-blue-600" />
            规则运行统计
          </div>
          <div className="space-y-2 text-xs text-gray-500">
            <div className="rounded-md bg-gray-50 p-2">今日命中 38 次</div>
            <div className="rounded-md bg-gray-50 p-2">平均响应 12 秒</div>
            <div className="rounded-md bg-gray-50 p-2">异常诊断 0 项</div>
          </div>
        </aside>
      </div>

      <ArrowNote
        idPrefix="routing"
        index={1}
        label="编辑已保存规则时应用渠道只读，避免规则范围被误改"
        className="left-[258px] top-[112px]"
        direction="downRight"
      />
      <ArrowNote
        idPrefix="routing"
        index={2}
        label="创建时切换渠道会清空已选人员，需要重新从该渠道接待池选择"
        className="left-[430px] top-[112px]"
        direction="down"
      />
      <ArrowNote
        idPrefix="routing"
        index={3}
        label="指定人工或部门必须来自当前渠道的接待池"
        className="right-[238px] top-[306px]"
        direction="left"
      />
    </DiagramCanvas>
  )
}

function CommandCenterDemo() {
  return (
    <DiagramCanvas className="min-h-[420px] bg-[#F7F8FA]">
      <div className="grid h-[350px] grid-cols-[210px_1fr_220px] gap-4">
        <aside className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 p-3">
            <div className="mb-3 text-sm font-semibold text-gray-900">微信客服中心</div>
            <div className="grid grid-cols-3 rounded-md border border-gray-200 bg-white p-1 text-[10px]">
              <span className="rounded bg-red-50 px-1.5 py-1 text-center text-red-700">排队中</span>
              <span className="rounded bg-blue-50 px-1.5 py-1 text-center text-blue-700">接待中</span>
              <span className="px-1.5 py-1 text-center text-gray-500">已结束</span>
            </div>
          </div>
          <div className="border-b border-gray-100 p-3">
            <div className="relative h-8 rounded-md border border-gray-200">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <span className="absolute left-8 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">搜索客户昵称...</span>
            </div>
          </div>
          <div className="divide-y divide-gray-100 overflow-hidden">
            {[
              ["王先生", "排队中", "最近消息摘要..."],
              ["林女士", "接待中", "想了解活动价格"],
              ["陈先生", "已结束", "最近消息摘要..."],
            ].map(([name, status, summary], index) => (
              <div
                key={name}
                className={cn(
                  "min-h-[74px] border-l-4 p-3 text-xs",
                  index === 1 ? "border-blue-600 bg-blue-50/60" : "border-transparent bg-white",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{name}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{status}</span>
                </div>
                <div className="mt-1 text-[11px] text-gray-400">{summary}</div>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">林女士</div>
                <div className="mt-1 flex gap-1 text-[10px]">
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">AI客服体验助理</span>
                  <span className="rounded bg-green-50 px-1.5 py-0.5 text-green-700">接待中</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600">转人工</button>
                <button className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600">结束会话</button>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-hidden bg-gray-50 p-4">
            <div className="w-3/4 rounded-lg bg-white p-2 text-xs text-gray-600 shadow-sm">客户：我想了解一下活动价格。</div>
            <div className="ml-auto w-2/3 rounded-lg bg-blue-600 p-2 text-xs text-white shadow-sm">客服：我帮您看下当前方案。</div>
            <div className="w-4/5 rounded-lg bg-white p-2 text-xs text-gray-600 shadow-sm">客户：如果今天下单有什么优惠？</div>
            <div className="ml-auto w-2/3 rounded-lg bg-blue-600 p-2 text-xs text-white shadow-sm">客服：可以先确认尺码，我再给您优惠方案。</div>
          </div>
        </main>

        <aside className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 text-[10px]">
            <span className="rounded bg-white px-1.5 py-1 text-center text-blue-700 shadow-sm">会话重点</span>
            <span className="px-1.5 py-1 text-center text-gray-500">客户升级</span>
            <span className="px-1.5 py-1 text-center text-gray-500">来源路由</span>
          </div>
          <div className="space-y-2 p-3 text-xs">
            <div className="rounded-md bg-orange-50 p-2 text-orange-700">高意向 · 关注优惠</div>
            <div className="rounded-md bg-gray-50 p-2 text-gray-600">会话摘要：正在比较价格与优惠。</div>
            <div className="rounded-md bg-gray-50 p-2 text-gray-600">建议动作：确认尺码后推进下单。</div>
          </div>
        </aside>
      </div>

      <ArrowNote
        idPrefix="cs"
        index={1}
        label="左侧选择当前要处理的会话，筛选不会改变真实接待状态"
        className="left-[24px] top-[68px]"
        direction="down"
      />
      <ArrowNote
        idPrefix="cs"
        index={2}
        label="中间完成阅读、转接、结束会话等关键操作"
        className="left-[318px] top-[78px]"
        direction="down"
      />
      <ArrowNote
        idPrefix="cs"
        index={3}
        label="右侧 AI 只做辅助判断，最终动作仍由客服确认"
        className="right-[24px] top-[84px]"
        direction="down"
      />
    </DiagramCanvas>
  )
}

function ToolbarAutoSendDemo() {
  return (
    <DiagramCanvas className="min-h-[560px] bg-[#F7F8FA]">
      <div className="mx-auto w-[390px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
        <div className="bg-gradient-to-br from-blue-600 to-blue-500 p-3 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
              <h3 className="truncate text-sm font-bold">自动发送助手</h3>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button className="rounded bg-white/20 px-2 py-1 text-[10px] font-medium">返回人工</button>
              <button className="inline-flex items-center gap-1 rounded bg-white/20 px-2 py-1 text-[10px] font-bold shadow-[0_0_0_2px_rgba(255,255,255,0.22)]">
                <KeyRound className="h-3 w-3" />
                已绑定
              </button>
              <button className="flex h-6 w-6 items-center justify-center rounded bg-white/10">
                <RefreshCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded bg-black/10 p-2">
            <span className="text-[10px] uppercase tracking-widest text-white/80">当前客服号:</span>
            <span className="font-mono text-[11px] font-bold">AI客服体验助理</span>
          </div>
        </div>

        <div className="space-y-3 bg-white/80 p-4">
          <section className="rounded-r-lg border-l-4 border-blue-500 bg-blue-50 p-3 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">当前客户</div>
            <div className="mt-1 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">林女士</div>
                <div className="text-[11px] text-gray-500">微信客服 · 接待中 · 高意向</div>
              </div>
              <UserRound className="h-4 w-4 text-blue-600" />
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
              <MessageSquareText className="h-3.5 w-3.5" />
              会话摘要
            </div>
            <div className="space-y-2">
              <MiniLine />
              <MiniLine width="w-4/5" />
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <Bot className="h-3.5 w-3.5" />
                AI 建议
              </div>
              <button className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600">换一批</button>
            </div>
            <div className="rounded-md bg-gray-50 p-2 text-xs leading-5 text-gray-600">建议先确认尺码，再发送优惠信息。</div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              自动发送状态
            </div>
            <div className="rounded-md bg-gray-50 p-3 text-center">
              <div className="text-sm font-medium text-gray-700">自动发送未启动</div>
              <div className="mt-1 text-xs leading-5 text-gray-400">点击底部“自动发送”后，工具栏会开始守护待发送任务。</div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-gray-100 bg-white p-3">
          <button className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-gray-200 text-xs font-medium text-gray-600">
            暂停发送
          </button>
          <button className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-blue-600 text-xs font-medium text-white shadow-[0_0_0_2px_rgba(59,130,246,0.12)]">
            <Play className="h-3.5 w-3.5" />
            自动发送
          </button>
        </div>
      </div>

      <ArrowNote
        idPrefix="toolbar"
        index={1}
        label="先确认当前客户、客服号和会话状态，避免把消息发到错误窗口"
        className="left-[110px] top-[128px]"
        direction="right"
      />
      <ArrowNote
        idPrefix="toolbar"
        index={2}
        label="顶部按钮可查看或编辑 MuYuAI 客户端ID，未绑定时不能开启"
        className="right-[88px] top-[54px]"
        direction="left"
      />
      <ArrowNote
        idPrefix="toolbar"
        index={3}
        label="满足前置条件后，底部“自动发送”才是真正启动入口"
        className="right-[96px] bottom-[40px]"
        direction="left"
      />
    </DiagramCanvas>
  )
}

function FallbackDemo() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
      暂无对应示意图模板。
    </div>
  )
}

export function GuideHtml({ source, anchorID }: GuideHtmlProps) {
  const title = readGuideBlockTitle(source, "操作示意图")
  const caption = readValue(source, "caption")
  const variant = readValue(source, "variant")

  return (
    <section id={anchorID} className="my-6 scroll-mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-500">
        <MousePointerClick className="h-3.5 w-3.5 text-blue-500" />
        {title}
      </div>
      {variant === "toolbar-auto-send" ? <ToolbarAutoSendDemo /> : null}
      {variant === "cs-center" ? <CommandCenterDemo /> : null}
      {variant === "reception-channel" ? <ReceptionChannelDemo /> : null}
      {variant === "routing-rule" ? <RoutingRuleDemo /> : null}
      {!["toolbar-auto-send", "cs-center", "reception-channel", "routing-rule"].includes(variant) ? <FallbackDemo /> : null}
      {caption ? (
        <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-gray-500">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
          {caption}
        </p>
      ) : null}
    </section>
  )
}
