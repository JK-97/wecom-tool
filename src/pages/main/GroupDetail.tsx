import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { 
  Users, 
  Activity, 
  ShieldAlert, 
  MessageSquare, 
  Calendar, 
  ArrowLeft, 
  MoreVertical, 
  Send, 
  CheckCircle2,
  TrendingUp,
  UserPlus
} from "lucide-react"

export default function GroupDetail({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="text-gray-500">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex -space-x-2">
              <Avatar src="https://i.pravatar.cc/150?u=g1" className="border-2 border-white w-10 h-10" />
              <Avatar src="https://i.pravatar.cc/150?u=g2" className="border-2 border-white w-10 h-10" />
              <Avatar src="https://i.pravatar.cc/150?u=g3" className="border-2 border-white w-10 h-10" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">VIP 福利群 1群</h2>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">售前转化</Badge>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">群 ID: wr_123456789 · 150 名成员 · 创建于 2026-01-15</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="text-gray-600">
              <Users className="w-4 h-4 mr-2" /> 群成员管理
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Send className="w-4 h-4 mr-2" /> 发送群消息
            </Button>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-5 h-5 text-gray-400" />
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="overview">
          <TabsList className="bg-transparent border-b-0 p-0 h-auto gap-8">
            <TabsTrigger value="overview" className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 font-medium">运营概览</TabsTrigger>
            <TabsTrigger value="members" className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 font-medium">成员列表</TabsTrigger>
            <TabsTrigger value="sop" className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 font-medium">SOP 执行记录</TabsTrigger>
            <TabsTrigger value="risk" className="px-0 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 font-medium">风险监控</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs font-medium text-gray-500 mb-1">今日发言人数</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">42</span>
                <span className="text-[10px] text-green-600 flex items-center"><TrendingUp className="w-3 h-3 mr-0.5" /> 12%</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs font-medium text-gray-500 mb-1">活跃度评分</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">85</span>
                <Badge variant="success" className="text-[10px] py-0">极高</Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs font-medium text-gray-500 mb-1">新增入群</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">8</span>
                <span className="text-xs text-gray-400">/ 7天</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs font-medium text-gray-500 mb-1">待处理预警</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-red-600">2</span>
                <Badge variant="destructive" className="text-[10px] py-0">需关注</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Activity */}
            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="p-4 border-b border-gray-100">
                <CardTitle className="text-sm font-semibold text-gray-800">群动态摘要 (AI 总结)</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-900 leading-relaxed">
                    过去 24 小时内，群内讨论集中在 <span className="font-bold">“周末闪购活动”</span>。共有 15 名成员询问了具体折扣规则，3 名成员反馈链接打不开。
                    <span className="block mt-2 font-medium">建议动作：重新发布活动海报，并置顶说明物流时效。</span>
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <Activity className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">发布了 SOP 任务：周末闪购预告</div>
                      <div className="text-xs text-gray-500 mt-0.5">今天 10:00 · 操作人：销售 A</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-red-900">触发负面情绪预警</div>
                      <div className="text-xs text-red-500 mt-0.5">昨天 18:30 · 成员 @张三 抱怨物流太慢</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SOP Progress */}
            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="p-4 border-b border-gray-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-800">本周群运营 SOP 进度</CardTitle>
                <Button variant="ghost" size="sm" className="text-blue-600 text-xs">查看全部</Button>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-6">
                  {[
                    { title: "周一：欢迎新成员", status: "completed", time: "03-30 09:00" },
                    { title: "周三：产品知识分享", status: "completed", time: "04-01 14:00" },
                    { title: "周五：周末闪购预热", status: "pending", time: "04-03 10:00" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {item.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <Calendar className="w-5 h-5 text-gray-300" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{item.time}</div>
                        </div>
                      </div>
                      <Badge variant={item.status === 'completed' ? 'success' : 'secondary'} className="text-[10px]">
                        {item.status === 'completed' ? '已执行' : '待执行'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            {/* Group Info */}
            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="p-4 border-b border-gray-100">
                <CardTitle className="text-sm font-semibold text-gray-800">群基本信息</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div>
                  <label className="text-xs text-gray-500">群主</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar src="https://i.pravatar.cc/150?u=owner" size="sm" />
                    <span className="text-sm font-medium text-gray-900">主管王</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">群公告</label>
                  <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                    欢迎各位加入 VIP 福利群！本群将不定期发放专属优惠券和新品试用机会，请保持关注。
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">群标签</label>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">高活跃</Badge>
                    <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">核心转化</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Members Top 5 */}
            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="p-4 border-b border-gray-100">
                <CardTitle className="text-sm font-semibold text-gray-800">活跃成员排行</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Avatar src={`https://i.pravatar.cc/150?u=m${i}`} size="sm" />
                        <span className="text-sm text-gray-700">群友 {i}</span>
                      </div>
                      <span className="text-xs text-gray-400">{20 - i * 2} 次发言</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
