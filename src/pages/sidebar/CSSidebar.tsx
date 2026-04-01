import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Dialog } from "@/components/ui/Dialog"
import { Textarea } from "@/components/ui/Textarea"
import { Clock, Copy, Send, ChevronRight, Lightbulb, FileText, ArrowUpRight, CheckCircle2 } from "lucide-react"
import { useState } from "react"

export default function CSSidebar() {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [isUpgraded, setIsUpgraded] = useState(false)

  const handleUpgrade = () => {
    setIsUpgraded(true)
    setIsUpgradeModalOpen(false)
  }

  return (
    <div className="flex h-full flex-col bg-[#F2F3F5]">
      {/* Top: Customer Context */}
      <div className="bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d" fallback="客" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 text-sm">李女士</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">视频号</Badge>
              </div>
              <span className="text-xs text-gray-500">VIP 客户</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <Badge variant="success" className="mb-1 text-[10px]">人工接待中</Badge>
            <div className="flex items-center text-xs text-orange-500 font-medium">
              <Clock className="w-3 h-3 mr-1" />
              04:59
            </div>
          </div>
        </div>

        {/* AI Intent */}
        <div className="rounded-md bg-blue-50 p-2.5 border border-blue-100 flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-800">
            <span className="font-semibold">客户意图：</span>
            查询退款进度。客户情绪略显焦急，建议优先安抚并提供具体时间。
          </div>
        </div>
      </div>

      {/* Main Content: Action & Suggestion */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* AI Suggestions */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 px-1">AI 建议回复</div>
          
          <Card className="p-3 shadow-sm border-transparent hover:border-blue-200 transition-colors">
            <p className="text-sm text-gray-800 leading-relaxed mb-3">
              您好，李女士！非常抱歉让您久等了。您的退款申请我们已经收到，目前财务正在加急审核中，预计最晚明天下午 18:00 前原路退回您的支付账户。请您放心。
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                <Copy className="w-3 h-3 mr-1" /> 复制
              </Button>
              <Button size="sm" className="h-7 text-xs px-2 bg-blue-600">
                <Send className="w-3 h-3 mr-1" /> 填入
              </Button>
            </div>
          </Card>

          <Card className="p-3 shadow-sm border-transparent hover:border-blue-200 transition-colors">
            <p className="text-sm text-gray-800 leading-relaxed mb-3">
              李女士您好，理解您的着急。退款流程通常需要 1-3 个工作日，我已经为您备注了加急，一有进度会立刻通知您。
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                <Copy className="w-3 h-3 mr-1" /> 复制
              </Button>
              <Button size="sm" className="h-7 text-xs px-2 bg-blue-600">
                <Send className="w-3 h-3 mr-1" /> 填入
              </Button>
            </div>
          </Card>
        </div>

        {/* Knowledge Base */}
        <div className="space-y-2 pt-2">
          <div className="text-xs font-medium text-gray-500 px-1">知识库推荐</div>
          <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
            <button className="w-full flex items-center justify-between p-3 hover:bg-gray-50 text-left border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">标准退换货流程 SOP</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            <button className="w-full flex items-center justify-between p-3 hover:bg-gray-50 text-left">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">退款延迟话术安抚包</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bg-white p-3 border-t border-gray-200 space-y-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Button 
          className={`w-full font-medium ${isUpgraded ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          onClick={() => !isUpgraded && setIsUpgradeModalOpen(true)}
        >
          {isUpgraded ? (
            <><CheckCircle2 className="w-4 h-4 mr-2" /> 已升级为客户联系</>
          ) : (
            <><ArrowUpRight className="w-4 h-4 mr-2" /> 升级为客户联系</>
          )}
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1 text-gray-600 bg-gray-100 hover:bg-gray-200">
            转交
          </Button>
          <Button variant="secondary" className="flex-1 text-gray-600 bg-gray-100 hover:bg-gray-200">
            结束会话
          </Button>
        </div>
      </div>

      {/* Upgrade Modal */}
      <Dialog 
        isOpen={isUpgradeModalOpen} 
        onClose={() => setIsUpgradeModalOpen(false)} 
        title="升级为客户联系"
        className="max-w-[300px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsUpgradeModalOpen(false)}>取消</Button>
            <Button className="bg-blue-600" onClick={handleUpgrade}>确认升级</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">分配给</label>
            <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>销售 A (当前客服)</option>
              <option>销售 B</option>
              <option>销售 C</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">客户意向评级</label>
            <div className="flex gap-2">
              <label className="flex items-center gap-1 text-sm"><input type="radio" name="intent" defaultChecked /> 高</label>
              <label className="flex items-center gap-1 text-sm"><input type="radio" name="intent" /> 中</label>
              <label className="flex items-center gap-1 text-sm"><input type="radio" name="intent" /> 低</label>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">升级备注 (AI 已总结)</label>
            <Textarea 
              className="text-sm min-h-[80px]" 
              defaultValue="查询退款进度。客户情绪略显焦急，建议优先安抚并提供具体时间。"
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
