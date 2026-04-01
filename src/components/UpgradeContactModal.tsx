import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { Textarea } from "@/components/ui/Textarea"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { UserPlus, MessageSquare, AlertCircle } from "lucide-react"

interface UpgradeContactModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  customerName: string
  customerAvatar: string
  aiSummary: string
}

export default function UpgradeContactModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  customerName,
  customerAvatar,
  aiSummary
}: UpgradeContactModalProps) {
  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose} 
      title="升级为客户联系"
      className="max-w-[400px]"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={onConfirm}>确认升级</Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Customer Info */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <Avatar src={customerAvatar} size="lg" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm">{customerName}</span>
              <Badge variant="secondary" className="text-[10px] py-0">视频号</Badge>
            </div>
            <span className="text-xs text-gray-500">当前：微信客服接待中</span>
          </div>
          <UserPlus className="w-5 h-5 text-blue-500" />
        </div>

        {/* AI Summary Section */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600" /> 客服会话摘要 (AI 已生成)
          </label>
          <Textarea 
            className="text-sm min-h-[100px] bg-blue-50/50 border-blue-100 focus:ring-blue-500" 
            defaultValue={aiSummary}
          />
          <p className="text-[10px] text-gray-400">该摘要将同步至客户联系跟进记录中，方便后续销售了解背景。</p>
        </div>

        {/* Assignment Section */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">后续负责人</label>
            <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>销售 A (当前客服)</option>
              <option>销售 B</option>
              <option>销售 C</option>
              <option>客户成功组</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">客户意向评级</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="intent" defaultChecked className="w-4 h-4 text-blue-600" /> 高意向
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="intent" className="w-4 h-4 text-blue-600" /> 中意向
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="intent" className="w-4 h-4 text-blue-600" /> 低意向
              </label>
            </div>
          </div>
        </div>

        {/* Next Step Task */}
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-100 rounded-lg">
          <input type="checkbox" defaultChecked className="w-4 h-4 text-orange-600 rounded" />
          <div className="flex-1">
            <div className="text-xs font-semibold text-orange-800">同步创建跟进任务</div>
            <div className="text-[10px] text-orange-600">默认截止时间：明天 18:00</div>
          </div>
          <MessageSquare className="w-4 h-4 text-orange-400" />
        </div>
      </div>
    </Dialog>
  )
}
