import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import {
  Search,
  Filter,
  Info,
  Play,
  Pause,
  Trash2,
  Edit2,
  Copy,
  ArrowUp,
  ArrowDown,
  BarChart3,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  executeRoutingRulesCommand,
  getRoutingRulesView,
  type RoutingRuleViewModel,
  type RoutingRulesViewModel,
} from "@/services/routingService"
import { listReceptionChannels, type ReceptionChannel } from "@/services/receptionService"
import { normalizeErrorMessage } from "@/services/http"

const emptyView: RoutingRulesViewModel = {
  rules: [],
  totalHits7d: 0,
  transferRate: "0%",
  avgResponseTime: "0s",
  distributions: [],
  diagnostics: {
    warnings: [],
  },
}

const defaultTargets = ["VIP 销售组", "通用客服组", "技术支持组", "默认接待池"]

export default function RoutingRules() {
  const [searchParams] = useSearchParams()
  const [channels, setChannels] = useState<ReceptionChannel[]>([])
  const [view, setView] = useState<RoutingRulesViewModel>(emptyView)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState("")

  const [filterChannel, setFilterChannel] = useState(searchParams.get("channel") || "all")
  const [keyword, setKeyword] = useState("")

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedRule, setSelectedRule] = useState<RoutingRuleViewModel | null>(null)

  const [formName, setFormName] = useState("")
  const [formChannelID, setFormChannelID] = useState("")
  const [formScene, setFormScene] = useState("ANY")
  const [formMode, setFormMode] = useState("人工接待")
  const [formTarget, setFormTarget] = useState("通用客服组")
  const [formPriority, setFormPriority] = useState(100)
  const [formIsDefault, setFormIsDefault] = useState(false)
  const [formTagFilter, setFormTagFilter] = useState("")

  useEffect(() => {
    const channel = searchParams.get("channel")
    if (channel) {
      setFilterChannel(channel)
    }
  }, [searchParams])

  const loadChannels = async () => {
    try {
      const loaded = await listReceptionChannels({ limit: 300 })
      setChannels(loaded)
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
    }
  }

  const loadView = async (channel: string, query: string) => {
    try {
      setIsLoading(true)
      const loaded = await getRoutingRulesView({
        channel_filter: channel === "all" ? "" : channel,
        query,
      })
      setView(loaded)
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
      setView(emptyView)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadChannels()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadView(filterChannel, keyword)
    }, 220)
    return () => window.clearTimeout(timer)
  }, [filterChannel, keyword])

  const channelNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of channels) {
      const id = (item.open_kfid || "").trim()
      if (!id) continue
      const name = (item.name || "").trim()
      map.set(id, name || id)
    }
    return map
  }, [channels])

  const openCreateDrawer = () => {
    setSelectedRule(null)
    setFormName("")
    setFormScene("ANY")
    setFormMode("人工接待")
    setFormTarget("通用客服组")
    setFormPriority(100)
    setFormIsDefault(false)
    setFormTagFilter("")
    setFormChannelID(filterChannel !== "all" ? filterChannel : (channels[0]?.open_kfid || "").trim())
    setIsDrawerOpen(true)
  }

  const openEditDrawer = (rule: RoutingRuleViewModel) => {
    setSelectedRule(rule)
    setFormName((rule.name || "").trim())
    setFormChannelID((rule.channelId || "").trim())
    setFormScene((rule.scene || "ANY").trim())
    setFormMode((rule.mode || "人工接待").trim())
    setFormTarget((rule.target || "默认接待池").trim())
    setFormPriority(Number(rule.priority || 100))
    setFormIsDefault(rule.isDefault === true)
    setFormTagFilter("")
    setIsDrawerOpen(true)
  }

  const runCommand = async (
    input: {
      command: string
      ruleID?: number
      openKFID?: string
      payload?: Record<string, unknown>
    },
    options?: {
      refresh?: boolean
      copyMessage?: boolean
    },
  ) => {
    try {
      setIsSubmitting(true)
      const result = await executeRoutingRulesCommand({
        command: input.command,
        rule_id: input.ruleID || 0,
        open_kfid: input.openKFID || "",
        payload: input.payload || {},
      })
      const message = (result?.message || "命令已提交").trim()
      if (options?.copyMessage) {
        try {
          await navigator.clipboard.writeText(message)
          setNotice("链接已复制")
        } catch {
          setNotice("复制失败，请手动复制")
        }
      } else {
        setNotice(message)
      }
      if (options?.refresh !== false) {
        await loadView(filterChannel, keyword)
      }
      return result
    } catch (error) {
      setNotice(normalizeErrorMessage(error))
      return null
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveRule = async () => {
    const name = formName.trim()
    const channelID = formChannelID.trim()
    const scene = formScene.trim() || "ANY"
    if (!name) {
      setNotice("请输入规则名称")
      return
    }
    if (!channelID) {
      setNotice("请选择应用渠道")
      return
    }

    const payload = {
      name,
      channel_id: channelID,
      scene,
      mode: formMode,
      target: formTarget,
      priority: formPriority,
      is_default: formIsDefault,
      tag_filter: formTagFilter.trim(),
    }

    const command = selectedRule ? "update_rule" : "create_rule"
    const ruleID = selectedRule ? Number(selectedRule.id || 0) : 0
    const result = await runCommand({
      command,
      ruleID,
      openKFID: channelID,
      payload,
    })
    if (!result?.success) {
      return
    }
    setIsDrawerOpen(false)
    await loadChannels()
    await loadView(filterChannel, keyword)
  }

  const filteredRules = view.rules

  const statsTotal = Number(view.totalHits7d || 0)
  const diagnostics = view.diagnostics?.warnings || []

  return (
    <div className="flex h-full gap-6">
      {/* Left: Main Content */}
      <div className="flex-1 flex flex-col gap-6">
        <Card className="border-none shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
            <Tabs value={filterChannel} onValueChange={setFilterChannel}>
              <TabsList className="bg-white border border-gray-200 shadow-sm overflow-x-auto">
                <TabsTrigger value="all" className="data-[state=active]:bg-gray-100">
                  全部渠道
                </TabsTrigger>
                {channels.map((channel) => {
                  const id = (channel.open_kfid || "").trim()
                  if (!id) return null
                  return (
                    <TabsTrigger key={id} value={id} className="data-[state=active]:bg-gray-100">
                      {(channel.name || id).trim()}
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </Tabs>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={openCreateDrawer}>
              + 新建路由规则
            </Button>
          </div>

          <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-white shrink-0">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索规则名称..."
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button
              variant="ghost"
              className="text-blue-600 hover:bg-blue-50 ml-auto"
              onClick={() => {
                setKeyword("")
                setFilterChannel("all")
              }}
            >
              <Filter className="h-4 w-4 mr-2" /> 更多筛选
            </Button>
          </div>

          {notice ? <div className="px-4 py-2 text-xs text-blue-600 border-b border-gray-100 bg-blue-50">{notice}</div> : null}

          <div className="flex-1 overflow-auto bg-white">
            <table className="w-full text-left text-sm text-gray-600 border-separate border-spacing-0">
              <thead className="sticky top-0 bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-200 z-10">
                <tr>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">优先级</th>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">规则名称</th>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">应用渠道</th>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">场景值 (Scene)</th>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">接待模式</th>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">分配目标</th>
                  <th className="px-6 py-3 font-semibold border-b border-gray-200">状态</th>
                  <th className="px-6 py-3 font-semibold text-right border-b border-gray-200">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={8}>
                      加载中...
                    </td>
                  </tr>
                ) : filteredRules.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-sm text-gray-500" colSpan={8}>
                      当前没有路由规则
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-400 w-4">{rule.priority}</span>
                          <div className="flex flex-col gap-0.5">
                            <button
                              className="text-gray-300 hover:text-blue-600 transition-colors"
                              onClick={() =>
                                void runCommand({
                                  command: "move_priority_up",
                                  ruleID: Number(rule.id || 0),
                                })
                              }
                              disabled={isSubmitting}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              className="text-gray-300 hover:text-blue-600 transition-colors"
                              onClick={() =>
                                void runCommand({
                                  command: "move_priority_down",
                                  ruleID: Number(rule.id || 0),
                                })
                              }
                              disabled={isSubmitting}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{rule.name}</span>
                          {rule.isDefault ? (
                            <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[10px] px-1.5 py-0">兜底</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">{rule.channel || channelNameMap.get(rule.channelId) || rule.channelId}</td>
                      <td className="px-6 py-4">
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px] text-gray-600 font-mono">{rule.scene}</code>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="text-[10px] font-medium border-gray-200 text-gray-600">
                          {rule.mode}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700">{rule.target}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${rule.status === "active" ? "bg-green-500" : "bg-gray-300"}`} />
                          <span className="text-xs">{rule.status === "active" ? "启用" : "停用"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                            onClick={() =>
                              void runCommand({
                                command: "toggle_rule",
                                ruleID: Number(rule.id || 0),
                                payload: {
                                  enabled: rule.status !== "active",
                                },
                              })
                            }
                            disabled={isSubmitting}
                          >
                            {rule.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                            onClick={() => openEditDrawer(rule)}
                            disabled={isSubmitting}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                            onClick={() => {
                              const confirmed = window.confirm("确认删除该路由规则？")
                              if (!confirmed) return
                              void runCommand({
                                command: "delete_rule",
                                ruleID: Number(rule.id || 0),
                              })
                            }}
                            disabled={isSubmitting}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Right: Stats Panel */}
      <div className="w-72 shrink-0 space-y-6">
        <Card className="p-4 border-none shadow-sm space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              规则运行统计
            </h3>
            <button onClick={() => setNotice("统计口径：基于近 7 天 routing 执行日志聚合。")}>
              <HelpCircle className="h-4 w-4 text-gray-300 cursor-pointer" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-600 font-medium">今日总命中次数</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{statsTotal.toLocaleString("zh-CN")}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-[10px] text-gray-500">人工转接率</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{view.transferRate}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-[10px] text-gray-500">平均响应</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">{view.avgResponseTime}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <p className="text-xs font-medium text-gray-500">命中分布 (Top 3 规则)</p>
              <div className="space-y-2">
                {view.distributions.length === 0 ? (
                  <div className="text-[11px] text-gray-500">暂无命中分布数据</div>
                ) : (
                  view.distributions.map((item) => (
                    <div key={`${item.ruleName}-${item.hits7d}`} className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-600 truncate">{item.ruleName}</span>
                        <span className="font-medium">{item.percent}</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: item.percent.trim() || "0%" }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>

        {diagnostics.length > 0 ? (
          <Card className="p-4 border-none shadow-sm bg-orange-50 border-l-4 border-l-orange-400">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-orange-800">配置建议</h4>
                <p className="text-[11px] text-orange-700 mt-1 leading-relaxed">{diagnostics[0]}</p>
                <Button
                  variant="link"
                  className="text-orange-800 p-0 h-auto text-[11px] font-bold mt-2"
                  disabled={isSubmitting}
                  onClick={() =>
                    void runCommand({
                      command: "resolve_diagnostic",
                      payload: {
                        warning: diagnostics[0],
                        channel_id: filterChannel,
                      },
                    })
                  }
                >
                  立即处理
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4 border-none shadow-sm bg-green-50 border-l-4 border-l-green-400">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-green-800">配置建议</h4>
                <p className="text-[11px] text-green-700 mt-1 leading-relaxed">当前路由配置健康，无需额外处理。</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* New/Edit Rule Drawer */}
      <Dialog
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedRule ? "编辑路由规则" : "新建路由规则"}
        className="max-w-[600px]"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => setIsDrawerOpen(false)}>
              取消
            </Button>
            <Button className="bg-blue-600" disabled={isSubmitting} onClick={() => void handleSaveRule()}>
              保存规则
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Section 1: Basic */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px]">1</span>
              基础信息
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">
                  规则名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：VIP 客户优先路由"
                  value={formName}
                  onChange={(event) => setFormName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">
                  应用渠道 <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formChannelID}
                  onChange={(event) => setFormChannelID(event.target.value)}
                >
                  {channels.map((channel) => {
                    const id = (channel.open_kfid || "").trim()
                    if (!id) return null
                    return (
                      <option key={id} value={id}>
                        {(channel.name || id).trim()}
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Condition */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px]">2</span>
              匹配条件
            </h4>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">场景值 (Scene)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="输入场景值，支持通配符 *"
                    value={formScene}
                    onChange={(event) => setFormScene(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    disabled={isSubmitting}
                    onClick={() =>
                      void runCommand(
                        {
                          command: "copy_channel_link",
                          openKFID: formChannelID,
                          payload: {
                            channel_id: formChannelID,
                            scene: formScene,
                          },
                        },
                        {
                          refresh: false,
                          copyMessage: true,
                        },
                      )
                    }
                  >
                    <Copy className="h-4 w-4 mr-2" /> 复制当前渠道链接
                  </Button>
                </div>
                <p className="text-[10px] text-gray-400 italic">提示：留空或填写 ANY 则匹配该渠道下所有未被其他规则命中的流量。</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">客户标签 (可选)</label>
                <input
                  type="text"
                  className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：决策人, 高意向"
                  value={formTagFilter}
                  onChange={(event) => setFormTagFilter(event.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Action */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px]">3</span>
              执行动作
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">接待模式</label>
                <select
                  className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formMode}
                  onChange={(event) => setFormMode(event.target.value)}
                >
                  <option>人工接待</option>
                  <option>机器人+人工</option>
                  <option>仅机器人</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">分配目标</label>
                <select
                  className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formTarget}
                  onChange={(event) => setFormTarget(event.target.value)}
                >
                  {defaultTargets.map((target) => (
                    <option key={target} value={target}>
                      {target}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700">优先级</label>
              <input
                type="number"
                min={1}
                className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formPriority}
                onChange={(event) => setFormPriority(Number(event.target.value || 1))}
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isDefault"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={formIsDefault}
                onChange={(event) => setFormIsDefault(event.target.checked)}
              />
              <label htmlFor="isDefault" className="text-xs text-gray-600">
                设为该渠道的兜底规则 (优先级最低)
              </label>
            </div>
            <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700 flex items-center gap-2">
              <Info className="h-3.5 w-3.5" />
              保存后会立即生效到路由执行链路。
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
