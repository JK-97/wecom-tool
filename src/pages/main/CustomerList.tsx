import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { Dialog } from "@/components/ui/Dialog"
import { Search, Filter, ChevronLeft, ChevronRight, MessageSquare, UserPlus, ArrowUpRight, Edit2 } from "lucide-react"
import { Link } from "react-router-dom"
import { useState } from "react"

export default function CustomerList() {
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false)

  return (
    <div className="flex h-full flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header & Tabs */}
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
        <Tabs defaultValue="all">
          <TabsList className="bg-white border border-gray-200 shadow-sm">
            <TabsTrigger value="all" className="data-[state=active]:bg-gray-100">全部客户 (12,450)</TabsTrigger>
            <TabsTrigger value="today" className="data-[state=active]:bg-gray-100">今日新增 (45)</TabsTrigger>
            <TabsTrigger value="todo" className="data-[state=active]:bg-gray-100 text-orange-600">待跟进 (128)</TabsTrigger>
            <TabsTrigger value="upgraded" className="data-[state=active]:bg-gray-100 text-blue-600">来自客服升级 (856)</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="text-gray-600 border-gray-200 hover:bg-gray-50">
            批量分配
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            导入客户
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="p-4 border-b border-gray-100 bg-white flex items-center gap-4 shrink-0">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="搜索客户姓名、手机号..." 
            className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="h-6 w-px bg-gray-200 mx-2"></div>
        <select className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>生命周期阶段</option>
          <option>意向沟通中</option>
          <option>已报价待签</option>
          <option>已成交</option>
        </select>
        <select className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>客户标签</option>
          <option>高净值</option>
          <option>近期活跃</option>
        </select>
        <select className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option>负责人</option>
          <option>销售 A</option>
          <option>销售 B</option>
        </select>
        <Button variant="ghost" className="text-blue-600 hover:bg-blue-50 ml-auto">
          <Filter className="w-4 h-4 mr-2" /> 更多筛选
        </Button>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left text-sm text-gray-600 border-separate border-spacing-0">
          <thead className="sticky top-0 bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-200 z-10">
            <tr>
              <th className="px-6 py-3 font-semibold w-12 border-b border-gray-200"><input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></th>
              <th className="px-6 py-3 font-semibold border-b border-gray-200">客户信息</th>
              <th className="px-6 py-3 font-semibold border-b border-gray-200">来源渠道</th>
              <th className="px-6 py-3 font-semibold border-b border-gray-200">当前阶段</th>
              <th className="px-6 py-3 font-semibold border-b border-gray-200">核心标签</th>
              <th className="px-6 py-3 font-semibold border-b border-gray-200">最新互动时间</th>
              <th className="px-6 py-3 font-semibold border-b border-gray-200">负责人</th>
              <th className="px-6 py-3 font-semibold text-right border-b border-gray-200">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Row 1 */}
            <tr className="hover:bg-blue-50/40 transition-colors group">
              <td className="px-6 py-4"><input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704d" size="sm" className="border border-gray-100" />
                  <div className="flex flex-col">
                    <Link to="/main/customer-360" className="font-semibold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors">张先生</Link>
                    <div className="text-[11px] text-gray-400 font-mono">138****8888</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-blue-50 flex items-center justify-center">
                    <MessageSquare className="w-3 h-3 text-blue-500" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">微信客服</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-medium text-[10px] px-2 py-0.5">意向沟通中</Badge>
              </td>
              <td className="px-6 py-4">
                <div className="flex gap-1.5 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600 border-transparent font-medium">高净值</Badge>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-orange-50 text-orange-700 border-transparent font-medium">升级跟进</Badge>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-gray-900">今天 09:00</div>
                <div className="text-[11px] text-gray-400 flex items-center mt-0.5"><UserPlus className="w-3 h-3 mr-1" /> 单聊跟进</div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Avatar src="https://i.pravatar.cc/150?u=sales1" size="xs" />
                  <span className="text-sm text-gray-700">销售 A</span>
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                    onClick={() => setIsModifyModalOpen(true)}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Link to="/main/customer-360">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-50 font-semibold text-xs px-2">详情</Button>
                  </Link>
                </div>
              </td>
            </tr>

            {/* Row 2 */}
            <tr className="hover:bg-blue-50/50 transition-colors group">
              <td className="px-6 py-4"><input type="checkbox" className="rounded border-gray-300" /></td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704e" size="sm" />
                  <div>
                    <Link to="/main/customer-360" className="font-medium text-gray-900 cursor-pointer hover:text-blue-600">王女士</Link>
                    <div className="text-xs text-gray-500">139****9999</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1">
                  <Badge variant="success" className="text-[10px] px-1.5 py-0">@微信</Badge>
                </div>
              </td>
              <td className="px-6 py-4">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-normal">已成交</Badge>
              </td>
              <td className="px-6 py-4">
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">VIP</Badge>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900">昨天 15:30</div>
                <div className="text-xs text-gray-500 flex items-center"><MessageSquare className="w-3 h-3 mr-1" /> 售后咨询</div>
              </td>
              <td className="px-6 py-4">客服小李</td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2 text-gray-500 hover:text-blue-600"
                    onClick={() => setIsModifyModalOpen(true)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Link to="/main/customer-360">
                    <Button variant="link" className="text-blue-600 px-0 h-auto font-medium">查看详情</Button>
                  </Link>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between shrink-0">
        <span className="text-sm text-gray-500">显示 1 到 10 条，共 12,450 条</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-blue-50 text-blue-600 border-blue-200">1</Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">2</Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">3</Button>
          <span className="text-gray-400 px-1">...</span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">1245</Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Modify Customer Info Modal */}
      <Dialog 
        isOpen={isModifyModalOpen} 
        onClose={() => setIsModifyModalOpen(false)} 
        title="修改客户信息"
        className="max-w-[400px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModifyModalOpen(false)}>取消</Button>
            <Button className="bg-blue-600" onClick={() => setIsModifyModalOpen(false)}>保存修改</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704d" size="sm" />
            <div>
              <div className="font-medium text-gray-900 text-sm">张先生</div>
              <div className="text-xs text-gray-500">138****8888</div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">负责人</label>
            <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>销售 A (当前)</option>
              <option>销售 B</option>
              <option>销售 C</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">生命周期阶段</label>
            <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>意向沟通中 (当前)</option>
              <option>已报价待签</option>
              <option>已成交</option>
              <option>流失</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">客户标签</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="搜索或添加标签..." 
                className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200 flex items-center gap-1">
                高净值 <span className="cursor-pointer hover:text-orange-900">×</span>
              </Badge>
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                近期活跃 <span className="cursor-pointer hover:text-blue-900">×</span>
              </Badge>
              <Badge variant="outline" className="text-xs text-gray-600 border-gray-200 cursor-pointer hover:bg-gray-50 border-dashed">
                + 添加标签
              </Badge>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
