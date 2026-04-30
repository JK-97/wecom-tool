import quickStart from "./quick-start.md?raw"
import receptionChannels from "./reception-channels.md?raw"
import routingRules from "./routing-rules.md?raw"
import csCenter from "./cs-center.md?raw"
import toolbarAutoSend from "./toolbar-auto-send.md?raw"

export type GuideDoc = {
  id: string
  title: string
  description: string
  category: "快速开始" | "业务配置" | "日常使用"
  role: string
  updatedAt: string
  readingMinutes: number
  relatedPage?: {
    label: string
    href: string
  }
  relatedDocIds: string[]
  content: string
}

export const GUIDE_DOCS: GuideDoc[] = [
  {
    id: "quick-start",
    title: "快速开始",
    description: "了解平台能做什么，以及推荐的上手顺序",
    category: "快速开始",
    role: "所有用户",
    updatedAt: "2026-04-30",
    readingMinutes: 3,
    relatedPage: { label: "进入微信客服中心", href: "/main/cs-center" },
    relatedDocIds: ["reception-channels", "routing-rules", "cs-center"],
    content: quickStart,
  },
  {
    id: "reception-channels",
    title: "接待渠道",
    description: "管理客服入口、接待成员和部门范围",
    category: "业务配置",
    role: "客服主管 / 管理员",
    updatedAt: "2026-04-30",
    readingMinutes: 4,
    relatedPage: { label: "前往接待渠道", href: "/main/reception-channels" },
    relatedDocIds: ["routing-rules", "cs-center"],
    content: receptionChannels,
  },
  {
    id: "routing-rules",
    title: "路由规则",
    description: "设置客户进入后的分配方式和兜底动作",
    category: "业务配置",
    role: "客服主管 / 管理员",
    updatedAt: "2026-04-30",
    readingMinutes: 4,
    relatedPage: { label: "前往路由规则", href: "/main/routing-rules" },
    relatedDocIds: ["reception-channels", "cs-center"],
    content: routingRules,
  },
  {
    id: "cs-center",
    title: "微信客服中心",
    description: "处理客户咨询、查看摘要并执行会话流转",
    category: "日常使用",
    role: "客服 / 客服主管",
    updatedAt: "2026-04-30",
    readingMinutes: 4,
    relatedPage: { label: "进入微信客服中心", href: "/main/cs-center" },
    relatedDocIds: ["routing-rules", "toolbar-auto-send"],
    content: csCenter,
  },
  {
    id: "toolbar-auto-send",
    title: "工具栏与自动发送",
    description: "在企业微信聊天侧查看客户信息和使用自动发送",
    category: "日常使用",
    role: "销售 / 客服 / 运营",
    updatedAt: "2026-04-30",
    readingMinutes: 3,
    relatedPage: { label: "打开工具栏入口", href: "/sidebar/kf" },
    relatedDocIds: ["cs-center", "quick-start"],
    content: toolbarAutoSend,
  },
]
