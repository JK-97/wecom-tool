import quickStart from "./quick-start.md?raw"
import organizationSettings from "./organization-settings.md?raw"
import receptionChannels from "./reception-channels.md?raw"
import routingRules from "./routing-rules.md?raw"
import csCenter from "./cs-center.md?raw"
import toolbarAutoSend from "./toolbar-auto-send.md?raw"
import faq from "./faq.md?raw"

export type GuideDoc = {
  id: string
  title: string
  description: string
  category: "快速开始" | "系统设置" | "业务配置" | "日常使用" | "问题排查"
  role: string
  tags: string[]
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
    tags: ["上手", "初始化", "流程", "角色", "入口"],
    updatedAt: "2026-04-30",
    readingMinutes: 5,
    relatedPage: { label: "进入微信客服中心", href: "/main/cs-center" },
    relatedDocIds: ["organization-settings", "reception-channels", "routing-rules"],
    content: quickStart,
  },
  {
    id: "organization-settings",
    title: "组织与设置",
    description: "同步组织架构、理解成员部门和权限边界",
    category: "系统设置",
    role: "管理员",
    tags: ["组织同步", "成员", "部门", "权限", "open-data", "可见范围"],
    updatedAt: "2026-04-30",
    readingMinutes: 6,
    relatedPage: { label: "前往组织与设置", href: "/main/settings" },
    relatedDocIds: ["reception-channels", "routing-rules", "faq"],
    content: organizationSettings,
  },
  {
    id: "reception-channels",
    title: "接待渠道",
    description: "管理客服入口、接待成员和部门范围",
    category: "业务配置",
    role: "客服主管 / 管理员",
    tags: ["接待渠道", "接待池", "兜底规则", "通讯录", "刷新渠道"],
    updatedAt: "2026-04-30",
    readingMinutes: 7,
    relatedPage: { label: "前往接待渠道", href: "/main/reception-channels" },
    relatedDocIds: ["organization-settings", "routing-rules", "faq"],
    content: receptionChannels,
  },
  {
    id: "routing-rules",
    title: "路由规则",
    description: "设置客户进入后的分配方式和兜底动作",
    category: "业务配置",
    role: "客服主管 / 管理员",
    tags: ["路由规则", "默认兜底", "动作模式", "指定人员", "排队", "AI 转人工"],
    updatedAt: "2026-04-30",
    readingMinutes: 8,
    relatedPage: { label: "前往路由规则", href: "/main/routing-rules" },
    relatedDocIds: ["reception-channels", "cs-center", "faq"],
    content: routingRules,
  },
  {
    id: "cs-center",
    title: "微信客服中心",
    description: "处理客户咨询、查看摘要并执行会话流转",
    category: "日常使用",
    role: "客服 / 客服主管",
    tags: ["客服中心", "聊天", "AI 监控", "转人工", "结束会话", "升级客户"],
    updatedAt: "2026-04-30",
    readingMinutes: 6,
    relatedPage: { label: "进入微信客服中心", href: "/main/cs-center" },
    relatedDocIds: ["routing-rules", "toolbar-auto-send", "faq"],
    content: csCenter,
  },
  {
    id: "toolbar-auto-send",
    title: "工具栏与自动发送",
    description: "在企业微信聊天侧查看客户信息和使用自动发送",
    category: "日常使用",
    role: "销售 / 客服 / 运营",
    tags: ["工具栏", "自动发送", "客户端 ID", "MuYuAI", "多会话", "企业微信"],
    updatedAt: "2026-04-30",
    readingMinutes: 6,
    relatedPage: { label: "打开工具栏入口", href: "/sidebar/kf" },
    relatedDocIds: ["cs-center", "faq", "quick-start"],
    content: toolbarAutoSend,
  },
  {
    id: "faq",
    title: "常见问题与排查",
    description: "按问题快速定位组织、接待、路由、客服中心和工具栏异常",
    category: "问题排查",
    role: "所有用户",
    tags: ["排查", "问题", "成员选不到", "路由不生效", "消息异常", "自动发送失败"],
    updatedAt: "2026-04-30",
    readingMinutes: 7,
    relatedPage: { label: "返回使用指南", href: "/main/guide" },
    relatedDocIds: ["organization-settings", "reception-channels", "routing-rules"],
    content: faq,
  },
]
