import React, { useState, useMemo, useEffect } from "react"
import { 
  Book, 
  MessageSquare, 
  UserCheck, 
  UserPlus, 
  Users, 
  Settings, 
  Terminal, 
  HelpCircle, 
  Search, 
  ChevronRight, 
  ExternalLink, 
  Clock, 
  Info, 
  Copy, 
  AlertTriangle,
  Lightbulb,
  Zap,
  ShieldAlert
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import Markdown from "react-markdown"

// Mock Guide Data
const GUIDE_SECTIONS = [
  {
    id: "overview",
    title: "产品总览",
    description: "了解平台核心价值、适用角色及主要功能模块",
    icon: Book,
    content: `
# 产品总览

企业微信双域客户沟通平台是一个“聊天侧执行 + 主页端管理协同 + 统一客户与任务底座”的业务平台，旨在打通公域流量（微信客服）与私域经营（客户联系）的闭环。

> [!INFO]
> **定位说明**：本平台不是原生企业微信的替代品，而是其能力的增强与业务闭环的实现工具。

## 核心价值
平台通过“双域流转”机制，解决企业在客户服务与经营中的断层问题：
- **微信客服域**：承接高频咨询，侧重响应效率与标准服务。
- **客户联系域**：承接深度经营，侧重转化推进与长期维护。
- **统一底座**：串联客户全生命周期的互动轨迹、升级记录与任务状态。

## 适用角色
- **企业管理员**：负责全局配置、权限分配与系统集成。
- **客服主管**：负责接待渠道、路由策略与服务质量监控。
- **一线客服**：负责接待咨询、解决问题并识别高价值客户进行“升级”。
- **销售/运营**：在聊天侧使用工具栏进行深度跟进、记录结果与执行 SOP。

## 快速上手路径
### 1. 基础接入
管理员完成企业微信应用接入与工具栏 URL 配置。
### 2. 渠道与路由
客服主管配置接待渠道（open_kfid）并设置分发规则。
### 3. 会话处理
客服在主页端处理会话，对意向客户执行“升级为客户联系”。
### 4. 深度跟进
销售在企微聊天侧通过工具栏查看客户画像并记录跟进动作。
    `
  },
  {
    id: "cs-supervisor",
    title: "客服主管：配置渠道与路由",
    description: "管理接待入口与自动化分发逻辑",
    icon: UserCheck,
    content: `
# 客服主管：配置渠道与路由

客服主管的核心职责是确保客户能够从正确的入口进入，并被最合适的成员接待。

## 配置接待渠道
在 \`接待渠道\` 模块中，您可以管理多个微信客服入口：
- **渠道识别**：通过 \`open_kfid\` 唯一标识一个接待入口。
- **状态管理**：实时查看渠道的同步状态与启用情况。
- **默认场景**：为不同来源（如扫码、搜索、广告）预设不同的接待场景。

> [!TIP]
> 建议为每个主要业务线设置独立的接待渠道，以便进行精细化的数据统计与路由分发。

## 配置路由规则
路由规则决定了客户进入后的流转逻辑：
1. **优先级机制**：系统按规则列表从上至下匹配，首条命中即生效。
2. **条件组合**：支持按渠道、时间段、客户标签等维度进行组合匹配。
3. **目标分配**：可分配至特定成员、技能组或第三方系统。

## 监控与优化
- **超时预警**：关注 \`微信客服中心\` 中的超时会话，及时调整人力。
- **规则复盘**：定期查看 \`数据看板\`，分析各规则的命中率与转化效果。
    `
  },
  {
    id: "cs-staff",
    title: "客服：处理并升级会话",
    description: "高效接待咨询并识别高价值客户",
    icon: MessageSquare,
    content: `
# 客服：处理并升级会话

一线客服是客户进入平台的第一触点，重点在于“解决问题”与“识别价值”。

## 会话处理流程
1. **待处理识别**：在 \`微信客服中心\` 实时查看新进入的咨询。
2. **辅助工具**：利用侧边栏的知识库、快捷回复提高响应效率。
3. **状态流转**：根据处理进度标记为“接待中”、“已解决”或“需转交”。

## 升级为客户联系
当识别到客户具有长期经营价值时，应执行“升级”动作：
- **操作路径**：在会话详情页点击“升级为客户联系”。
- **信息补齐**：填写客户意向、后续负责人及跟进建议。
- **自动流转**：升级后，系统将自动在销售/运营的工具栏中生成待办任务。

> [!IMPORTANT]
> 升级动作是公域转私域的关键节点，请务必在升级时填写详尽的“客户摘要”，以降低后续交接成本。
    `
  },
  {
    id: "sales-sidebar",
    title: "销售：单聊工具栏跟进",
    description: "在企微聊天侧进行深度转化",
    icon: UserPlus,
    content: `
# 销售：单聊工具栏跟进

销售人员主要在企业微信原生聊天窗口中工作，通过侧边工具栏获取业务支撑。

## 核心功能模块
- **客户 360 视图**：查看客户的基本信息、标签、历史互动及客服升级记录。
- **建议话术**：根据客户当前阶段，系统自动推荐最佳沟通话术。
- **素材库**：一键发送产品手册、报价单、案例视频等素材。
- **跟进记录**：实时记录沟通结果，系统将自动同步至主页端客户中心。

## 最佳实践
1. **沟通前预判**：先看工具栏中的“最近互动摘要”，了解客户背景。
2. **执行 SOP**：按照系统提示的 SOP 步骤进行引导。
3. **即时记录**：沟通结束后立即在工具栏勾选“跟进结果”，避免遗忘。

> [!CAUTION]
> 请勿在工具栏中录入敏感或非业务相关的个人隐私信息，所有记录均受合规审计。
    `
  },
  {
    id: "ops-sidebar",
    title: "运营：群聊工具栏",
    description: "社群批量经营与风险识别",
    icon: Users,
    content: `
# 运营：群聊工具栏

群聊工具栏旨在提升社群运营的标准化程度与风险控制能力。

## 群运营看板
- **群画像**：实时统计群成员规模、活跃度及关键成员分布。
- **AI 总结**：自动提炼群内热议话题，帮助运营者快速掌握舆情。
- **风险预警**：识别群内违规言论、竞品链接或负面情绪。

## SOP 任务执行
系统会根据群生命周期自动推送运营任务：
- **入群欢迎**：新成员入群自动提醒发送欢迎语。
- **活动分发**：定时提醒在群内发布营销活动或干货内容。
- **定期维护**：提醒进行群内互动或清理僵尸粉。

> [!TIP]
> 结合“素材采纳率”数据，不断优化 SOP 中的内容模板，提升群内转化效果。
    `
  },
  {
    id: "admin-config",
    title: "管理员：配置工具栏接入",
    description: "系统集成、权限管理与环境配置",
    icon: Settings,
    content: `
# 管理员：配置工具栏接入

管理员需确保底层能力的正确配置，这是所有业务功能运行的前提。

## 接入三部曲
1. **应用授权**：在企业微信后台完成自建应用的创建与授权。
2. **入口配置**：将平台提供的工具栏 URL 配置到企微后台的“聊天工具栏”入口。
3. **可信域名**：确保 JSSDK 签名域名、业务域名均已正确备案并授权。

## 权限体系
- **功能权限**：按角色分配主页端模块访问权限。
- **数据权限**：配置成员可见的客户范围（个人、部门、全公司）。
- **敏感权限**：管理导出、删除等高危操作的审批流。

> [!WARNING]
> 修改“可信域名”或“Secret”会导致现有 JSSDK 签名失效，请在非业务高峰期进行操作。
    `
  },
  {
    id: "dev-debug",
    title: "DEBUG 工具与联调说明",
    description: "开发者调试工具与常见错误排查",
    icon: Terminal,
    content: `
# DEBUG 工具与联调说明

本模块仅供技术人员在实施与联调阶段使用。

## 联调检查清单
- **JSSDK 状态**：调用 \`wx.config\` 是否返回 \`ok\`。
- **Context 识别**：是否能正确获取 \`external_userid\` 或 \`chat_id\`。
- **AgentConfig**：涉及客户联系接口时，必须正确配置 \`agentConfig\`。

## 常见错误码 (Error Codes)
- **40093**: \`jsapi_ticket\` 过期或无效。
- **80001**: 可信域名未配置或不匹配。
- **42001**: \`access_token\` 超时。

## 调试建议
使用企业微信开发者工具进行初步排查，真机调试时请开启 \`debug: true\` 模式查看原生弹窗报错。
    `
  },
  {
    id: "faq",
    title: "常见问题",
    description: "业务逻辑与操作细节疑难解答",
    icon: HelpCircle,
    content: `
# 常见问题

## 平台与原生企微的关系？
平台是基于企微 API 构建的业务层，旨在提供更强的管理协同能力。聊天动作仍在企微内完成，但业务记录与策略下发在平台完成。

## 为什么我搜不到某个客户？
请检查：
1. 该客户是否已添加为外部联系人。
2. 您的数据权限是否覆盖了该客户。
3. 搜索关键词是否匹配（支持姓名、备注、手机号）。

## 升级为客户联系后，原客服会话会消失吗？
不会。原客服会话记录将保留在客服中心，但该客户的后续经营主阵地将转移至客户联系域。
    `
  }
]

export default function Guide() {
  const [activeSectionId, setActiveSectionId] = useState(GUIDE_SECTIONS[0].id)
  const [searchQuery, setSearchQuery] = useState("")
  const [toc, setToc] = useState<{ id: string; text: string }[]>([])

  const activeSection = useMemo(() => 
    GUIDE_SECTIONS.find(s => s.id === activeSectionId) || GUIDE_SECTIONS[0]
  , [activeSectionId])

  // Generate TOC from active section content
  useEffect(() => {
    const headings = activeSection.content.match(/^##\s+(.+)$/gm) || []
    const tocItems = headings.map(h => {
      const text = h.replace(/^##\s+/, "").trim()
      const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, "-")
      return { id, text }
    })
    setToc(tocItems)
  }, [activeSection])

  const filteredSections = useMemo(() => {
    if (!searchQuery) return GUIDE_SECTIONS
    return GUIDE_SECTIONS.filter(s => 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [searchQuery])

  const copyLink = () => {
    const url = window.location.href.split('#')[0] + '#' + activeSectionId
    navigator.clipboard.writeText(url)
  }

  return (
    <div className="flex h-full bg-[#F8FAFC] -m-8 overflow-hidden">
      {/* Left Sidebar - Grouped Navigation */}
      <div className="w-80 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索指南..."
              className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-8">
          <div>
            <div className="px-3 mb-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">快速开始</div>
            <div className="space-y-1">
              {filteredSections.filter(s => s.id === 'overview').map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSectionId(section.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left transition-all group",
                    activeSectionId === section.id
                      ? "bg-blue-50 text-blue-600 shadow-sm"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-3 font-bold text-sm">
                    <section.icon className={cn("h-4 w-4", activeSectionId === section.id ? "text-blue-600" : "text-gray-400")} />
                    {section.title}
                  </div>
                  <div className={cn("text-[11px] pl-7 leading-relaxed", activeSectionId === section.id ? "text-blue-500/70" : "text-gray-400")}>
                    {section.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="px-3 mb-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">业务配置指南</div>
            <div className="space-y-1">
              {filteredSections.filter(s => ['cs-supervisor', 'cs-staff', 'sales-sidebar', 'ops-sidebar'].includes(s.id)).map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSectionId(section.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left transition-all group",
                    activeSectionId === section.id
                      ? "bg-blue-50 text-blue-600 shadow-sm"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-3 font-bold text-sm">
                    <section.icon className={cn("h-4 w-4", activeSectionId === section.id ? "text-blue-600" : "text-gray-400")} />
                    {section.title}
                  </div>
                  <div className={cn("text-[11px] pl-7 leading-relaxed", activeSectionId === section.id ? "text-blue-500/70" : "text-gray-400")}>
                    {section.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="px-3 mb-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">系统管理与开发</div>
            <div className="space-y-1">
              {filteredSections.filter(s => ['admin-config', 'dev-debug'].includes(s.id)).map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSectionId(section.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left transition-all group",
                    activeSectionId === section.id
                      ? "bg-blue-50 text-blue-600 shadow-sm"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-3 font-bold text-sm">
                    <section.icon className={cn("h-4 w-4", activeSectionId === section.id ? "text-blue-600" : "text-gray-400")} />
                    {section.title}
                  </div>
                  <div className={cn("text-[11px] pl-7 leading-relaxed", activeSectionId === section.id ? "text-blue-500/70" : "text-gray-400")}>
                    {section.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="px-3 mb-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">帮助与参考</div>
            <div className="space-y-1">
              {filteredSections.filter(s => ['faq'].includes(s.id)).map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSectionId(section.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left transition-all group",
                    activeSectionId === section.id
                      ? "bg-blue-50 text-blue-600 shadow-sm"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-3 font-bold text-sm">
                    <section.icon className={cn("h-4 w-4", activeSectionId === section.id ? "text-blue-600" : "text-gray-400")} />
                    {section.title}
                  </div>
                  <div className={cn("text-[11px] pl-7 leading-relaxed", activeSectionId === section.id ? "text-blue-500/70" : "text-gray-400")}>
                    {section.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900">需要更多帮助？</div>
              <div className="text-[10px] text-gray-400">专业团队为您解答</div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full text-xs font-bold h-9 bg-white border-gray-200 shadow-sm hover:bg-gray-50">
            联系技术支持 <ExternalLink className="w-3.5 h-3.5 ml-2" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto scroll-smooth bg-white">
        <div className="max-w-4xl mx-auto px-12 py-16">
          {/* Document Header */}
          <div className="mb-12">
            <div className="flex items-center gap-2 text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-6">
              <Book className="w-3.5 h-3.5" /> 产品文档中心 / {activeSection.title}
            </div>
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-6 leading-tight">{activeSection.title}</h1>
            <div className="flex flex-wrap items-center gap-6 text-xs text-gray-400 border-b border-gray-100 pb-8">
              <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> 最后更新：2026-04-01</span>
              <span className="flex items-center gap-2"><Info className="w-4 h-4" /> 适用版本：v1.2.4+</span>
              <div className="flex-1" />
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={copyLink} className="h-8 text-xs font-bold text-gray-500 hover:text-blue-600">
                  <Copy className="w-3.5 h-3.5 mr-2" /> 复制链接
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-gray-500 hover:text-blue-600">
                  反馈建议
                </Button>
              </div>
            </div>
          </div>
          
          <div className="prose prose-slate max-w-none 
            prose-headings:text-gray-900 prose-headings:tracking-tight prose-headings:font-bold
            prose-h1:hidden
            prose-h2:text-2xl prose-h2:mt-16 prose-h2:mb-8 prose-h2:pb-4 prose-h2:border-b prose-h2:border-gray-100
            prose-h3:text-xl prose-h3:mt-10 prose-h3:mb-6
            prose-p:text-gray-600 prose-p:leading-8 prose-p:text-[16px] prose-p:mb-6
            prose-li:text-gray-600 prose-li:leading-8 prose-li:text-[16px] prose-li:mb-2
            prose-strong:text-gray-900 prose-strong:font-bold
            prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-slate-900 prose-pre:rounded-2xl prose-pre:p-8 prose-pre:shadow-xl prose-pre:my-8
            prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50/50 prose-blockquote:rounded-r-2xl prose-blockquote:py-2 prose-blockquote:px-8 prose-blockquote:my-8
          ">
            <Markdown
              components={{
                h2: ({ children }) => {
                  const text = React.Children.toArray(children).join("")
                  const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, "-")
                  return <h2 id={id}>{children}</h2>
                },
                blockquote: ({ children }) => {
                  const text = React.Children.toArray(children).map(c => (c as any)?.props?.children?.[0] || "").join("")
                  
                  const callouts = [
                    { key: "[!INFO]", icon: Info, color: "blue", label: "说明 / Info" },
                    { key: "[!TIP]", icon: Lightbulb, color: "emerald", label: "提示 / Tip" },
                    { key: "[!WARNING]", icon: AlertTriangle, color: "orange", label: "注意 / Warning" },
                    { key: "[!IMPORTANT]", icon: Zap, color: "indigo", label: "重要 / Important" },
                    { key: "[!CAUTION]", icon: ShieldAlert, color: "red", label: "警告 / Caution" },
                  ]

                  const callout = callouts.find(c => text.includes(c.key))

                  if (callout) {
                    const colorClasses: Record<string, string> = {
                      blue: "border-blue-200 bg-blue-50/50 text-blue-800",
                      emerald: "border-emerald-200 bg-emerald-50/50 text-emerald-800",
                      orange: "border-orange-200 bg-orange-50/50 text-orange-800",
                      indigo: "border-indigo-200 bg-indigo-50/50 text-indigo-800",
                      red: "border-red-200 bg-red-50/50 text-red-800",
                    }
                    const iconClasses: Record<string, string> = {
                      blue: "text-blue-500",
                      emerald: "text-emerald-500",
                      orange: "text-orange-500",
                      indigo: "text-indigo-500",
                      red: "text-red-500",
                    }

                    return (
                      <div className={cn("my-10 flex gap-5 rounded-2xl border p-8 shadow-sm transition-all hover:shadow-md", colorClasses[callout.color])}>
                        <callout.icon className={cn("h-6 w-6 shrink-0", iconClasses[callout.color])} />
                        <div className="text-[15px] leading-relaxed">
                          <div className="font-bold mb-2 uppercase tracking-wider text-[11px]">{callout.label}</div>
                          {React.Children.map(children, child => {
                             if (typeof child === 'object' && (child as any)?.props?.children) {
                               return React.cloneElement(child as any, {
                                 children: (child as any).props.children.map((c: any) => 
                                   typeof c === 'string' ? c.replace(callout.key, "").trim() : c
                                 )
                               })
                             }
                             return child
                          })}
                        </div>
                      </div>
                    )
                  }
                  return <blockquote>{children}</blockquote>
                }
              }}
            >
              {activeSection.content}
            </Markdown>
          </div>

          {/* Helpful Feedback */}
          <div className="mt-32 pt-16 border-t border-gray-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-6">
              <MessageSquare className="w-8 h-8 text-gray-300" />
            </div>
            <div className="text-lg font-bold text-gray-900 mb-2">本页内容对您有帮助吗？</div>
            <p className="text-sm text-gray-400 mb-10 max-w-sm">您的反馈将帮助我们不断改进文档质量，为更多用户提供更好的服务支持</p>
            <div className="flex gap-4">
              <Button variant="outline" className="rounded-xl px-8 py-6 border-gray-200 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-all font-bold">
                👍 有帮助
              </Button>
              <Button variant="outline" className="rounded-xl px-8 py-6 border-gray-200 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-all font-bold">
                👎 没帮助
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right TOC - Sticky */}
      <div className="w-72 shrink-0 border-l border-gray-100 bg-white hidden xl:flex flex-col p-10">
        <div className="sticky top-10">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-8">本页目录</div>
          <div className="space-y-0 border-l border-gray-100">
            {toc.length > 0 ? (
              toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block pl-5 py-2.5 text-[13px] text-gray-500 hover:text-blue-600 border-l-2 border-transparent hover:border-blue-600 -ml-[1.5px] transition-all"
                >
                  {item.text}
                </a>
              ))
            ) : (
              <div className="pl-5 text-[13px] text-gray-300 italic">暂无目录</div>
            )}
          </div>
          
          <div className="mt-20 pt-10 border-t border-gray-50">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-6">相关文档</div>
            <ul className="space-y-4">
              <li className="text-[12px] text-gray-500 hover:text-blue-600 cursor-pointer flex items-center gap-2 group transition-all">
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400" /> 
                <span>路由规则配置进阶</span>
              </li>
              <li className="text-[12px] text-gray-500 hover:text-blue-600 cursor-pointer flex items-center gap-2 group transition-all">
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400" /> 
                <span>JSSDK 错误码速查</span>
              </li>
              <li className="text-[12px] text-gray-500 hover:text-blue-600 cursor-pointer flex items-center gap-2 group transition-all">
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400" /> 
                <span>企业微信接入规范</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
