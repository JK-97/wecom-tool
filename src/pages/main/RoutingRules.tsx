import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Dialog } from "@/components/ui/Dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { Search, Filter, MoreHorizontal, Info, Play, Pause, Trash2, Edit2, Copy, ArrowUp, ArrowDown, BarChart3, HelpCircle, AlertTriangle, CheckCircle2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"

const initialRules = [
  {
    id: "1",
    name: "高净值客户专席",
    channel: "官方视频号接待",
    channelId: "wk666688880001",
    scene: "VIP_UPGRADE",
    mode: "人工接待",
    target: "VIP 销售组",
    priority: 1,
    isDefault: false,
    status: "active",
    lastHit: "2024-03-20 15:30",
    hits7d: 1250,
    transferRate: "98%",
    responseTime: "12s"
  },
  {
    id: "2",
    name: "官网通用咨询路由",
    channel: "官网在线咨询",
    channelId: "wk666688880002",
    scene: "ALL",
    mode: "机器人+人工",
    target: "通用客服组",
    priority: 2,
    isDefault: true,
    status: "active",
    lastHit: "2024-03-20 16:12",
    hits7d: 8500,
    transferRate: "45%",
    responseTime: "45s"
  },
  {
    id: "3",
    name: "App 灰度测试规则",
    channel: "App 内嵌客服",
    channelId: "wk666688880003",
    scene: "BETA_TEST",
    mode: "人工接待",
    target: "技术支持组",
    priority: 3,
    isDefault: false,
    status: "inactive",
    lastHit: "2024-03-19 18:00",
    hits7d: 120,
    transferRate: "100%",
    responseTime: "5s"
  },
  {
    id: "4",
    name: "门店扫码兜底规则",
    channel: "线下门店扫码",
    channelId: "wk666688880004",
    scene: "ANY",
    mode: "人工接待",
    target: "门店导购组",
    priority: 99,
    isDefault: true,
    status: "active",
    lastHit: "2024-03-20 10:05",
    hits7d: 3400,
    transferRate: "92%",
    responseTime: "25s"
  }
]

export default function RoutingRules() {
  const [searchParams] = useSearchParams()
  const [rules, setRules] = useState(initialRules)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedRule, setSelectedRule] = useState<any>(null)
  const [filterChannel, setFilterChannel] = useState(searchParams.get("channel") || "all")

  useEffect(() => {
    const channel = searchParams.get("channel")
    if (channel) {
      setFilterChannel(channel)
    }
  }, [searchParams])

  const filteredRules = filterChannel === "all" 
    ? rules 
    : rules.filter(r => r.channelId === filterChannel)

  const toggleStatus = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, status: r.status === "active" ? "inactive" : "active" } : r))
  }

  return (
    <div className="flex h-full gap-6">
      {/* Left: Main Content */}
      <div className="flex-1 flex flex-col gap-6">
        <Card className="border-none shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
            <Tabs value={filterChannel} onValueChange={setFilterChannel}>
              <TabsList className="bg-white border border-gray-200 shadow-sm">
                <TabsTrigger value="all" className="data-[state=active]:bg-gray-100">全部渠道</TabsTrigger>
                <TabsTrigger value="wk666688880001" className="data-[state=active]:bg-gray-100">视频号</TabsTrigger>
                <TabsTrigger value="wk666688880002" className="data-[state=active]:bg-gray-100">官网咨询</TabsTrigger>
                <TabsTrigger value="wk666688880003" className="data-[state=active]:bg-gray-100">App 客服</TabsTrigger>
                <TabsTrigger value="wk666688880004" className="data-[state=active]:bg-gray-100">门店扫码</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => {
              setSelectedRule(null)
              setIsDrawerOpen(true)
            }}>
              + 新建路由规则
            </Button>
          </div>

          <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-white shrink-0">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索规则名称..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button variant="ghost" className="text-blue-600 hover:bg-blue-50 ml-auto">
              <Filter className="h-4 w-4 mr-2" /> 更多筛选
            </Button>
          </div>

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
                {filteredRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-400 w-4">{rule.priority}</span>
                        <div className="flex flex-col gap-0.5">
                          <button className="text-gray-300 hover:text-blue-600 transition-colors"><ArrowUp className="h-3 w-3" /></button>
                          <button className="text-gray-300 hover:text-blue-600 transition-colors"><ArrowDown className="h-3 w-3" /></button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{rule.name}</span>
                        {rule.isDefault && <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[10px] px-1.5 py-0">兜底</Badge>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">{rule.channel}</td>
                    <td className="px-6 py-4">
                      <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px] text-gray-600 font-mono">{rule.scene}</code>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="text-[10px] font-medium border-gray-200 text-gray-600">{rule.mode}</Badge>
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
                          onClick={() => toggleStatus(rule.id)}
                        >
                          {rule.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                          onClick={() => {
                            setSelectedRule(rule)
                            setIsDrawerOpen(true)
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
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
            <HelpCircle className="h-4 w-4 text-gray-300 cursor-pointer" />
          </div>
          
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-600 font-medium">今日总命中次数</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">12,450</p>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-500">
                <ArrowUp className="h-3 w-3" />
                <span>较昨日 +12.5%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-[10px] text-gray-500">人工转接率</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">85.2%</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-[10px] text-gray-500">平均响应</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">24s</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <p className="text-xs font-medium text-gray-500">命中分布 (Top 3 规则)</p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-600 truncate">官网通用咨询路由</span>
                    <span className="font-medium">68%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-[68%]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-600 truncate">门店扫码兜底规则</span>
                    <span className="font-medium">22%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 w-[22%]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-600 truncate">高净值客户专席</span>
                    <span className="font-medium">10%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-300 w-[10%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-none shadow-sm bg-orange-50 border-l-4 border-l-orange-400">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-orange-800">配置建议</h4>
              <p className="text-[11px] text-orange-700 mt-1 leading-relaxed">
                检测到“App 内嵌客服”渠道目前没有启用的兜底规则，可能导致部分会话无法被正确分配。
              </p>
              <Button variant="link" className="text-orange-800 p-0 h-auto text-[11px] font-bold mt-2">
                立即处理
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* New/Edit Rule Drawer */}
      <Dialog
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedRule ? "编辑路由规则" : "新建路由规则"}
        className="max-w-[600px]"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => setIsDrawerOpen(false)}>取消</Button>
            <Button className="bg-blue-600" onClick={() => setIsDrawerOpen(false)}>保存规则</Button>
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
                <label className="text-xs font-medium text-gray-700">规则名称 <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：VIP 客户优先路由"
                  defaultValue={selectedRule?.name}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">应用渠道 <span className="text-red-500">*</span></label>
                <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>官方视频号接待</option>
                  <option>官网在线咨询</option>
                  <option>App 内嵌客服</option>
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
                    defaultValue={selectedRule?.scene}
                  />
                  <Button variant="outline" size="sm" className="h-9">
                    <Copy className="h-4 w-4 mr-2" /> 复制当前渠道链接
                  </Button>
                </div>
                <p className="text-[10px] text-gray-400 italic">提示：留空或填写 ANY 则匹配该渠道下所有未被其他规则命中的流量。</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">客户标签 (可选)</label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-white border-gray-200 text-gray-600 cursor-pointer hover:bg-gray-100">+ 添加标签过滤</Badge>
                </div>
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
                <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>人工接待</option>
                  <option>机器人+人工</option>
                  <option>仅机器人</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">分配目标</label>
                <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>VIP 销售组</option>
                  <option>通用客服组</option>
                  <option>技术支持组</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="isDefault" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" defaultChecked={selectedRule?.isDefault} />
              <label htmlFor="isDefault" className="text-xs text-gray-600">设为该渠道的兜底规则 (优先级最低)</label>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
