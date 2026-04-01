import { Badge } from "@/components/ui/Badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs"
import { Dialog } from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { MessageSquare, ArrowUpRight, MessageCircle, ShoppingCart, CheckCircle2, Clock, Calendar, Tag, UserPlus, Edit2, Search, FileText } from "lucide-react"
import { useState } from "react"
import { EmptyState } from "@/components/ui/EmptyState"

export default function Customer360() {
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")

  return (
    <div className="flex h-full gap-6">
      {/* Left Column: Profile & Tags (20%) */}
      <div className="w-[280px] shrink-0 space-y-6">
        <Card className="border-gray-200 shadow-sm relative group">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-2 right-2 h-8 w-8 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsModifyModalOpen(true)}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <CardContent className="p-6 flex flex-col items-center text-center">
            <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704d" size="xl" className="mb-4" />
            <h2 className="text-xl font-bold text-gray-900">张先生</h2>
            <p className="text-sm text-gray-500 mt-1">138****8888</p>
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="success" className="bg-green-50 text-green-700 border-green-200">@微信</Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">意向沟通中</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm relative group">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-2 right-2 h-8 w-8 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsModifyModalOpen(true)}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-400" /> 业务标签
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary">高净值</Badge>
              <Badge variant="secondary">近期活跃</Badge>
              <Badge variant="secondary">关注企业版</Badge>
              <Badge variant="secondary">来自客服升级</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm relative group">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-2 right-2 h-8 w-8 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsModifyModalOpen(true)}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-gray-400" /> 归属信息
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">当前负责人</span>
              <span className="font-medium text-gray-900">销售 A</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">添加时间</span>
              <span className="font-medium text-gray-900">2026-03-31</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">来源渠道</span>
              <span className="font-medium text-gray-900">微信客服</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle Column: Unified Timeline (50%) */}
      <div className="flex-1 flex flex-col min-w-0">
        <Card className="flex-1 flex flex-col border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-white shrink-0">
            <Tabs defaultValue="all" onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">全部轨迹</TabsTrigger>
                <TabsTrigger value="cs">客服记录</TabsTrigger>
                <TabsTrigger value="sales">跟进记录</TabsTrigger>
                <TabsTrigger value="order">订单记录</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
            {activeTab === 'order' ? (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  icon={ShoppingCart}
                  title="暂无订单记录"
                  description="该客户尚未产生任何订单。"
                />
              </div>
            ) : (
              <div className="relative border-l-2 border-gray-200 ml-4 space-y-8 pb-8">
                
                {/* Timeline Item 3: Sales Follow-up */}
                {(activeTab === 'all' || activeTab === 'sales') && (
                  <div className="relative pl-8">
                    <div className="absolute -left-[11px] top-1 h-5 w-5 rounded-full bg-green-100 border-2 border-white flex items-center justify-center">
                      <MessageCircle className="w-3 h-3 text-green-600" />
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">单聊跟进</span>
                      <span className="text-xs text-gray-500">今天 09:00</span>
                    </div>
                    <Card className="p-4 shadow-sm border-gray-100">
                      <p className="text-sm text-gray-700 mb-2">销售 A 进行了单聊跟进，发送了企业版报价单和行业白皮书。</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        <CheckCircle2 className="w-3 h-3 text-green-500" /> 结果：已发送报价单，客户表示会看。
                      </div>
                    </Card>
                  </div>
                )}

                {/* Timeline Item 2: Upgrade */}
                {(activeTab === 'all' || activeTab === 'sales') && (
                  <div className="relative pl-8">
                    <div className="absolute -left-[11px] top-1 h-5 w-5 rounded-full bg-orange-100 border-2 border-white flex items-center justify-center">
                      <ArrowUpRight className="w-3 h-3 text-orange-600" />
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">触发升级</span>
                      <span className="text-xs text-gray-500">昨天 10:15</span>
                    </div>
                    <Card className="p-4 shadow-sm border-orange-100 bg-orange-50/30">
                      <div className="text-sm text-gray-800">
                        <span className="font-medium">升级原因：</span>高意向复购，咨询企业版报价。
                      </div>
                      <div className="text-sm text-gray-800 mt-1">
                        <span className="font-medium">分配给：</span>销售 A
                      </div>
                    </Card>
                  </div>
                )}

                {/* Timeline Item 1: CS */}
                {(activeTab === 'all' || activeTab === 'cs') && (
                  <div className="relative pl-8">
                    <div className="absolute -left-[11px] top-1 h-5 w-5 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center">
                      <MessageSquare className="w-3 h-3 text-blue-600" />
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">微信客服咨询</span>
                      <span className="text-xs text-gray-500">昨天 10:00</span>
                    </div>
                    <Card className="p-4 shadow-sm border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-800">咨询主题：企业版报价与功能差异</span>
                        <Badge variant="success" className="text-[10px]">已解决</Badge>
                      </div>
                      <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                        客户询问了基础版和企业版的区别，客服已解答基础功能，客户希望了解详细报价。
                      </p>
                    </Card>
                  </div>
                )}

                {/* Timeline Item 0: Order */}
                {activeTab === 'all' && (
                  <div className="relative pl-8">
                    <div className="absolute -left-[11px] top-1 h-5 w-5 rounded-full bg-purple-100 border-2 border-white flex items-center justify-center">
                      <ShoppingCart className="w-3 h-3 text-purple-600" />
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">购买基础版</span>
                      <span className="text-xs text-gray-500">2025-11-15</span>
                    </div>
                    <Card className="p-4 shadow-sm border-gray-100">
                      <p className="text-sm text-gray-700">订单号：ORD-20251115-001</p>
                      <p className="text-sm text-gray-700 mt-1">金额：¥ 99.00</p>
                    </Card>
                  </div>
                )}

              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Right Column: Insights & Tasks (30%) */}
      <div className="w-[320px] shrink-0 space-y-6">
        <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-800">
              <span className="text-lg">✨</span> AI 客户总结
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-sm text-gray-700 leading-relaxed">
              该客户是基础版老用户，近期活跃度提升。昨日主动通过微信客服咨询企业版报价，表现出明确的升级意向。对价格较敏感，建议在跟进时强调企业版的 ROI 和团队协作效率提升。
            </p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-gray-100">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" /> 当前待办任务
              </div>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-transparent">1</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              <div className="p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">跟进报价单反馈</span>
                  <span className="text-xs text-red-500 flex items-center"><Clock className="w-3 h-3 mr-1" /> 明天截止</span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">
                  今天上午已发送报价单，需在明天下午前跟进客户的反馈意见，尝试推进测试账号开通。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
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
