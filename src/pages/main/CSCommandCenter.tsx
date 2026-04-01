import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { Dialog } from "@/components/ui/Dialog"
import { Textarea } from "@/components/ui/Textarea"
import { 
  Search, Filter, AlertCircle, Clock, CheckCircle2, UserX, ShieldAlert, 
  AlertTriangle, GitBranch, UserPlus, ExternalLink, Tag, Info, ChevronRight,
  MessageSquare, Star
} from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"

export default function CSCommandCenter() {
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isEndModalOpen, setIsEndModalOpen] = useState(false)
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [isUpgradeSuccess, setIsUpgradeSuccess] = useState(false)

  return (
    <div className="flex h-full gap-6">
      {/* Left Column: Session List (30%) */}
      <div className="w-[380px] shrink-0 flex flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">微信客服中心</h2>
          <Tabs defaultValue="queue">
            <TabsList className="w-full grid grid-cols-3 bg-white border border-gray-200">
              <TabsTrigger value="queue" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-700">
                排队中 (12)
              </TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                接待中 (5)
              </TabsTrigger>
              <TabsTrigger value="closed">
                已结束
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="p-3 border-b border-gray-100 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="搜索客户昵称或消息内容..." 
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 outline-none">
              <option>全部渠道</option>
              <option>视频号</option>
              <option>官网</option>
            </select>
            <select className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 outline-none">
              <option>全部场景</option>
              <option>退款</option>
              <option>咨询</option>
            </select>
            <select className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-600 outline-none">
              <option>SLA 状态</option>
              <option>正常</option>
              <option>预警</option>
              <option>超时</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {/* Session Item 1 (Active, Selected) */}
          <div className="p-4 bg-blue-50/50 border-l-4 border-blue-600 cursor-pointer">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d" size="sm" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-900">李女士</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge className="text-[9px] px-1 py-0 bg-blue-100 text-blue-600 border-none">视频号</Badge>
                    <Badge className="text-[9px] px-1 py-0 bg-gray-100 text-gray-500 border-none">退款咨询</Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center text-[10px] font-medium text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                  <Clock className="w-3 h-3 mr-1" /> 04:59
                </div>
                <Badge className="text-[9px] px-1 py-0 bg-green-100 text-green-600 border-none">已升级</Badge>
              </div>
            </div>
            <p className="text-xs text-gray-600 line-clamp-1 mb-2">
              我的退款怎么还没到账？都三天了！
            </p>
            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> VIP 销售组</span>
              <span>10:05 接入</span>
            </div>
          </div>

          {/* Session Item 2 (Queue, Warning) */}
          <div className="p-4 hover:bg-gray-50 cursor-pointer">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024e" size="sm" />
                <span className="text-sm font-medium text-gray-900">赵先生</span>
              </div>
              <div className="flex items-center text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded animate-pulse">
                <AlertCircle className="w-3 h-3 mr-1" /> 超时告警
              </div>
            </div>
            <p className="text-xs text-gray-600 line-clamp-1 mb-2">
              有人在吗？我想问下企业版的发票怎么开？
            </p>
            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span>排队中</span>
              <span className="text-red-500 font-medium">等待 15 分钟</span>
            </div>
          </div>

          {/* Session Item 3 */}
          <div className="p-4 hover:bg-gray-50 cursor-pointer">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024f" size="sm" />
                <span className="text-sm font-medium text-gray-900">陈总</span>
              </div>
              <div className="flex items-center text-xs font-medium text-gray-500">
                10:12
              </div>
            </div>
            <p className="text-xs text-gray-600 line-clamp-1 mb-2">
              好的，谢谢。
            </p>
            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span>接待人：客服小李</span>
              <span>10:10 接入</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Session Detail (Read-only Monitor) (70%) */}
      <div className="flex-1 flex flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white shrink-0">
          <div className="h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold text-gray-900">李女士</h3>
              <Badge variant="success" className="bg-green-50 text-green-700 border-green-200">人工接待中</Badge>
              <span className="text-sm text-gray-500 border-l border-gray-200 pl-4">接待人：客服小王</span>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={() => setIsUpgradeModalOpen(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" /> 升级为客户联系
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => setIsTransferModalOpen(true)}
              >
                <UserX className="w-4 h-4 mr-2" /> 强制转交
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="text-gray-600 hover:bg-gray-100"
                onClick={() => setIsEndModalOpen(true)}
              >
                强制结束
              </Button>
            </div>
          </div>
          {/* Session Business Info Bar */}
          <div className="px-6 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-6 text-[11px]">
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="font-medium">来源渠道:</span>
              <span className="text-gray-900">官方视频号接待</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="font-medium">路由规则:</span>
              <span className="text-blue-600 flex items-center gap-0.5 cursor-pointer hover:underline">
                高净值客户专席 <ExternalLink className="w-3 h-3" />
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className="font-medium">接待方式:</span>
              <span className="text-gray-900">人工接待 (VIP 销售组)</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500 ml-auto">
              <span className="font-medium">升级状态:</span>
              <Badge className="bg-green-100 text-green-700 border-none text-[10px] px-1.5 py-0">已升级</Badge>
            </div>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Chat Area (Read-only) */}
          <div className="flex-1 bg-[#F5F7FA] p-6 overflow-y-auto flex flex-col gap-6">
            <div className="text-center text-xs text-gray-400 my-2">今天 10:00</div>
            
            {/* Customer Message */}
            <div className="flex items-start gap-3">
              <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d" size="sm" />
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[70%] shadow-sm">
                <p className="text-sm text-gray-800">你好，我的退款怎么还没到账？都三天了！</p>
              </div>
            </div>

            {/* AI Auto Reply */}
            <div className="flex items-start gap-3 flex-row-reverse">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-blue-600">AI</span>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[70%] shadow-sm">
                <p className="text-sm text-blue-900">您好，我是智能助手。查询到您的退款订单正在处理中，为了更好地解决您的问题，正在为您转接人工客服，请稍候。</p>
              </div>
            </div>

            <div className="text-center text-xs text-gray-400 my-2">10:05 转入人工接待</div>

            {/* Agent Message */}
            <div className="flex items-start gap-3 flex-row-reverse">
              <Avatar src="https://i.pravatar.cc/150?u=agent1" fallback="王" size="sm" />
              <div className="bg-blue-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[70%] shadow-sm">
                <p className="text-sm">您好，李女士！非常抱歉让您久等了。您的退款申请我们已经收到，目前财务正在加急审核中，预计最晚明天下午 18:00 前原路退回您的支付账户。请您放心。</p>
              </div>
            </div>

            {/* Customer Message */}
            <div className="flex items-start gap-3">
              <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d" size="sm" />
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[70%] shadow-sm">
                <p className="text-sm text-gray-800">好的，那麻烦快一点，谢谢。</p>
              </div>
            </div>
          </div>

          {/* AI Monitor Sidebar */}
          <div className="w-[300px] border-l border-gray-200 bg-white p-5 overflow-y-auto space-y-6">
            {/* Routing Info Card */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-blue-600" /> 路由信息
              </h4>
              <div className="bg-gray-50 rounded-lg border border-gray-100 p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">命中渠道</span>
                  <span className="text-xs font-medium">视频号接待</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">命中场景</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">VIP_UPGRADE</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">匹配规则</span>
                  <span className="text-xs font-medium text-blue-600">高净值客户专席</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">接待池</span>
                  <span className="text-xs font-medium">VIP 销售组</span>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <Link to="/main/routing-rules" className="text-[11px] text-blue-600 flex items-center justify-center gap-1 hover:underline">
                    前往调整路由规则 <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Customer Upgrade Card */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-600" /> 客户升级
              </h4>
              <div className="bg-blue-50 rounded-lg border border-blue-100 p-4 text-center">
                <p className="text-xs text-blue-700 mb-3 leading-relaxed">
                  该客户表现出强烈的购买意向，建议升级为“客户联系”进行长期维护。
                </p>
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-xs h-8"
                  onClick={() => setIsUpgradeModalOpen(true)}
                >
                  立即升级
                </Button>
              </div>
            </div>

            {/* AI Real-time Monitor */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-600" /> AI 实时监控
              </h4>
              
              <div className="space-y-6">
                <div>
                  <div className="text-xs text-gray-500 mb-2">客户情绪</div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">😠</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 w-[70%]" />
                    </div>
                    <span className="text-xs font-medium text-orange-600">焦急</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-2">会话摘要</div>
                  <div className="bg-gray-50 p-3 rounded-md border border-gray-100 text-sm text-gray-700 leading-relaxed">
                    客户催促退款进度，情绪略显焦急。客服已安抚并承诺最晚明晚 18:00 前到账。客户表示接受。
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-2">合规质检</div>
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-md border border-green-100">
                    <CheckCircle2 className="w-4 h-4" /> 未发现违规话术
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade to Customer Contact Modal */}
      <Dialog
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            升级为客户联系
          </div>
        }
        className="max-w-[520px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsUpgradeModalOpen(false)}>取消</Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700" 
              onClick={() => {
                setIsUpgradeModalOpen(false)
                setIsUpgradeSuccess(true)
                setTimeout(() => setIsUpgradeSuccess(false), 3000)
              }}
            >
              确认升级并创建任务
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed">
              升级后，系统将自动在“客户中心”建立该客户档案，并为指定的负责人创建一条跟进任务。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">负责人 <span className="text-red-500">*</span></label>
              <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>销售部-王经理</option>
                <option>销售部-李组长</option>
                <option>当前客服 (小王)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">意向等级 <span className="text-red-500">*</span></label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} className={`w-5 h-5 cursor-pointer ${i <= 4 ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">升级原因</label>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="cursor-pointer hover:bg-blue-50 hover:border-blue-200">高意向潜客</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-blue-50 hover:border-blue-200">大客户咨询</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-blue-50 hover:border-blue-200">投诉转维护</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">AI 摘要 (自动生成)</label>
            <div className="p-3 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600 italic">
              客户咨询退款进度，对品牌有一定忠诚度，建议由销售经理介入进行二次营销。
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">下一步任务 <span className="text-red-500">*</span></label>
            <Textarea 
              className="text-sm min-h-[80px]" 
              placeholder="请输入需要负责人执行的具体任务，如：明天上午电话回访，确认退款到账并赠送优惠券"
            />
          </div>
        </div>
      </Dialog>

      {/* Success Toast Simulation */}
      {isUpgradeSuccess && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">升级成功！已同步至客户中心并创建跟进任务。</span>
        </div>
      )}

      {/* Force Transfer Modal */}
      <Dialog 
        isOpen={isTransferModalOpen} 
        onClose={() => setIsTransferModalOpen(false)} 
        title="强制转交会话"
        className="max-w-[480px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsTransferModalOpen(false)}>取消</Button>
            <Button className="bg-blue-600" onClick={() => setIsTransferModalOpen(false)}>确认转交</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">转交给 <span className="text-red-500">*</span></label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="搜索客服人员或技能组..." 
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* Mock dropdown results */}
            <div className="mt-2 border border-gray-100 rounded-md shadow-sm divide-y divide-gray-50 max-h-32 overflow-y-auto">
              <div className="p-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer">高级客服组 (技能组)</div>
              <div className="p-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer">客服主管-张三</div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">转交原因 <span className="text-red-500">*</span></label>
            <Textarea 
              className="text-sm min-h-[80px]" 
              placeholder="请输入转交原因，如：客户情绪激动，需高级客服介入"
            />
          </div>
        </div>
      </Dialog>

      {/* Force End Modal */}
      <Dialog 
        isOpen={isEndModalOpen} 
        onClose={() => setIsEndModalOpen(false)} 
        title={
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            强制结束会话
          </div>
        }
        className="max-w-[400px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsEndModalOpen(false)}>暂不结束</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setIsEndModalOpen(false)}>强制结束</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">强制结束会话将中断当前客服的接待，且客户将收到会话已结束的通知。请确认是否继续？</p>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">结束原因 <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm p-2 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                <input type="radio" name="endReason" /> 恶意骚扰
              </label>
              <label className="flex items-center gap-2 text-sm p-2 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                <input type="radio" name="endReason" /> 客户无响应
              </label>
              <label className="flex items-center gap-2 text-sm p-2 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                <input type="radio" name="endReason" /> 违规内容
              </label>
              <label className="flex items-center gap-2 text-sm p-2 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                <input type="radio" name="endReason" /> 其他
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">补充说明</label>
            <Textarea 
              className="text-sm min-h-[60px]" 
              placeholder="选填"
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
