import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { ArrowUpRight, ArrowDownRight, Download, Calendar as CalendarIcon, MessageSquare, Users, CheckSquare, Lightbulb } from "lucide-react"

export default function Dashboard({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex flex-col h-full gap-6 overflow-y-auto pb-8">
      {/* Header & Global Filters */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
              <ArrowDownRight className="w-4 h-4 rotate-90" />
            </Button>
          )}
          <h2 className="text-xl font-bold text-gray-900">数据看板</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-md shadow-sm px-3 py-1.5 text-sm text-gray-600">
            <CalendarIcon className="w-4 h-4 mr-2 text-gray-400" />
            <span>近 7 天 (2026-03-25 ~ 2026-03-31)</span>
          </div>
          <Button variant="outline" className="bg-white border-gray-200 text-gray-700 hover:bg-gray-50">
            <Download className="w-4 h-4 mr-2" /> 导出报表
          </Button>
        </div>
      </div>

      {/* KPI Cards (Dashboard Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
        {/* KPI 1 */}
        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" /> 客服解决率
              </span>
              <Badge variant="success" className="bg-green-50 text-green-700 border-transparent text-[10px] px-1.5 py-0">SLA 达标</Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 tracking-tight">86.4%</span>
              <span className="text-xs font-medium text-green-600 flex items-center">
                <ArrowUpRight className="w-3 h-3 mr-0.5" /> 2.1%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2 */}
        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-500" /> 升级客户数
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 tracking-tight">1,245</span>
              <span className="text-xs font-medium text-green-600 flex items-center">
                <ArrowUpRight className="w-3 h-3 mr-0.5" /> 12.4%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3 */}
        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-green-500" /> 跟进完成率
              </span>
              <Badge variant="destructive" className="bg-red-50 text-red-700 border-transparent text-[10px] px-1.5 py-0">需关注</Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 tracking-tight">68.2%</span>
              <span className="text-xs font-medium text-red-600 flex items-center">
                <ArrowDownRight className="w-3 h-3 mr-0.5" /> 4.5%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4 */}
        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-purple-500" /> 建议采纳率
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 tracking-tight">42.8%</span>
              <span className="text-xs font-medium text-green-600 flex items-center">
                <ArrowUpRight className="w-3 h-3 mr-0.5" /> 8.2%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 shrink-0">
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="p-4 border-b border-gray-100">
            <CardTitle className="text-sm font-semibold text-gray-800">双域流转漏斗</CardTitle>
          </CardHeader>
          <CardContent className="p-8 h-[300px] flex items-center justify-center bg-white">
            <div className="w-full max-w-md flex flex-col items-center gap-1">
              <div className="w-full h-10 bg-blue-600 rounded-t-lg flex items-center justify-between px-4 text-white text-xs font-medium shadow-sm">
                <span>客服咨询</span>
                <span>10,000 (100%)</span>
              </div>
              <div className="w-[85%] h-10 bg-blue-500 flex items-center justify-between px-4 text-white text-xs font-medium shadow-sm">
                <span>触发升级</span>
                <span>1,245 (12.5%)</span>
              </div>
              <div className="w-[70%] h-10 bg-blue-400 flex items-center justify-between px-4 text-white text-xs font-medium shadow-sm">
                <span>单聊跟进</span>
                <span>850 (68.3%)</span>
              </div>
              <div className="w-[50%] h-10 bg-blue-300 rounded-b-lg flex items-center justify-between px-4 text-white text-xs font-medium shadow-sm">
                <span>成交转化</span>
                <span>120 (14.1%)</span>
              </div>
              <div className="mt-6 flex gap-4 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600 rounded-full"></div> 咨询域</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-400 rounded-full"></div> 经营域</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="p-4 border-b border-gray-100">
            <CardTitle className="text-sm font-semibold text-gray-800">每日会话与跟进趋势</CardTitle>
          </CardHeader>
          <CardContent className="p-6 h-[300px] flex flex-col bg-white">
            <div className="flex-1 flex items-end justify-between pt-8 pb-2 relative">
              {/* Y-Axis Labels */}
              <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-[10px] text-gray-400">
                <span>100</span>
                <span>75</span>
                <span>50</span>
                <span>25</span>
                <span>0</span>
              </div>
              
              {/* Grid Lines */}
              <div className="absolute left-10 right-0 top-2 bottom-8 flex flex-col justify-between pointer-events-none">
                <div className="w-full border-t border-gray-100 border-dashed"></div>
                <div className="w-full border-t border-gray-100 border-dashed"></div>
                <div className="w-full border-t border-gray-100 border-dashed"></div>
                <div className="w-full border-t border-gray-100 border-dashed"></div>
                <div className="w-full border-t border-gray-200"></div>
              </div>

              {/* Bars */}
              <div className="flex-1 h-full flex items-end justify-between pl-10 relative z-10">
                {[
                  { date: "03-25", cs: 40, follow: 25 },
                  { date: "03-26", cs: 70, follow: 45 },
                  { date: "03-27", cs: 45, follow: 30 },
                  { date: "03-28", cs: 90, follow: 60 },
                  { date: "03-29", cs: 65, follow: 40 },
                  { date: "03-30", cs: 80, follow: 55 },
                  { date: "03-31", cs: 50, follow: 35 }
                ].map((data, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 w-full px-2 group">
                    <div className="w-full flex justify-center items-end gap-1.5 h-full relative">
                      {/* Tooltip */}
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1.5 px-2.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-xl">
                        客服: {data.cs} | 跟进: {data.follow}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                      <div className="w-3 bg-blue-500 rounded-t-sm hover:bg-blue-600 transition-colors" style={{ height: `${data.cs}%` }}></div>
                      <div className="w-3 bg-green-500 rounded-t-sm hover:bg-green-600 transition-colors" style={{ height: `${data.follow}%` }}></div>
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">{data.date}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-blue-500"></div>
                <span className="text-[10px] text-gray-500 font-medium">客服会话数</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-green-500"></div>
                <span className="text-[10px] text-gray-500 font-medium">跟进任务数</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 shrink-0">
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="p-4 border-b border-gray-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-800">优秀销售跟进榜 Top 5</CardTitle>
            <Button variant="ghost" size="sm" className="text-blue-600 text-xs">查看详情</Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-bold w-5 h-5 rounded-full flex items-center justify-center ${i <= 3 ? 'bg-orange-50 text-orange-600' : 'text-gray-400'}`}>{i}</span>
                    <Avatar src={`https://i.pravatar.cc/150?u=sales${i}`} size="sm" />
                    <span className="text-sm font-medium text-gray-900">销售 {String.fromCharCode(64 + i)}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex flex-col items-end">
                      <span className="text-gray-400 text-[10px] uppercase font-bold">跟进数</span>
                      <span className="font-semibold text-gray-900">{120 - i * 15}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-gray-400 text-[10px] uppercase font-bold">转化数</span>
                      <span className="font-semibold text-green-600">{12 - i}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="p-4 border-b border-gray-100 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-800">高转化素材榜 Top 5</CardTitle>
            <Button variant="ghost" size="sm" className="text-blue-600 text-xs">素材库</Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {[
                "2026 行业白皮书",
                "企业版功能对比图",
                "通用试用期破冰话术",
                "周末闪购福利预告",
                "退款延迟安抚话术"
              ].map((title, i) => (
                <div key={i} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-bold w-5 h-5 rounded-full flex items-center justify-center ${i <= 2 ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}>{i + 1}</span>
                    <span className="text-sm font-medium text-gray-900 line-clamp-1">{title}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm shrink-0">
                    <div className="flex flex-col items-end">
                      <span className="text-gray-400 text-[10px] uppercase font-bold">发送次数</span>
                      <span className="font-semibold text-gray-900">{856 - i * 100}</span>
                    </div>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-transparent text-[10px] font-semibold">采纳率 {45 - i * 2}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
