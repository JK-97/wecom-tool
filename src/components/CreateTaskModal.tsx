import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Badge } from "@/components/ui/Badge"
import { Avatar } from "@/components/ui/Avatar"
import { Calendar, User, Search, AlertCircle, Clock } from "lucide-react"

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  initialCustomer?: {
    name: string
    avatar: string
    id: string
  }
}

export default function CreateTaskModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  initialCustomer 
}: CreateTaskModalProps) {
  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose} 
      title="新建跟进任务"
      className="max-w-[420px]"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={onConfirm}>创建任务</Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Task Title */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">任务标题 <span className="text-red-500">*</span></label>
          <Input placeholder="如：发送产品报价单并跟进意向" className="text-sm border-gray-200 focus:ring-blue-500" />
        </div>

        {/* Associated Entity (Customer or Group) */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">关联对象</label>
          {initialCustomer ? (
            <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
              <Avatar src={initialCustomer.avatar} size="sm" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{initialCustomer.name}</div>
                <div className="text-[10px] text-gray-500">客户 ID: {initialCustomer.id}</div>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600 hover:bg-blue-100">修改</Button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="搜索客户或群聊..." className="pl-9 text-sm border-gray-200" />
            </div>
          )}
        </div>

        {/* Deadline & Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">截止时间 <span className="text-red-500">*</span></label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input type="datetime-local" className="pl-9 text-sm border-gray-200" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-700">优先级</label>
            <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>普通</option>
              <option className="text-orange-600">重要</option>
              <option className="text-red-600">紧急</option>
            </select>
          </div>
        </div>

        {/* Assignee */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">负责人</label>
          <div className="flex items-center gap-2 p-2 border border-gray-200 rounded-md bg-white">
            <Avatar src="https://i.pravatar.cc/150?u=me" size="xs" />
            <span className="text-sm text-gray-700">我自己 (销售 A)</span>
            <Button variant="ghost" size="sm" className="ml-auto h-6 text-[10px] text-gray-400">更改</Button>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-gray-700">任务描述</label>
          <Textarea 
            placeholder="记录当前的进展情况、遇到的问题或下一步计划..." 
            className="min-h-[80px] text-sm border-gray-200 focus:ring-blue-500"
          />
        </div>

        {/* AI Reminder (Optional) */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-xs font-semibold text-blue-900">AI 智能提醒</div>
            <p className="text-[10px] text-blue-700 mt-0.5">系统将在截止时间前 30 分钟通过企业微信应用消息提醒您。</p>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
