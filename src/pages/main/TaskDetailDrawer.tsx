import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Textarea } from "@/components/ui/Textarea"
import { X, Clock, ArrowRight, MessageCircle, CheckCircle2, UserPlus, FileText } from "lucide-react"

export default function TaskDetailDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      {/* Drawer Panel */}
      <div className="w-[480px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="h-16 border-b border-gray-200 px-6 flex items-center justify-between shrink-0 bg-gray-50">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">🔴 紧急升级</Badge>
            <span className="text-sm font-medium text-gray-900">任务详情</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-500 hover:text-gray-900">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Task Context */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">跟进企业版报价单反馈</h3>
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
              <span className="flex items-center text-red-600 font-medium">
                <Clock className="w-4 h-4 mr-1" /> 今日 18:00 截止
              </span>
              <span className="flex items-center">
                <UserPlus className="w-4 h-4 mr-1" /> 分配人：主管王
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100">
              客户昨日咨询企业版报价，已发资料。今天需要跟进意向，询问是否有不清楚的地方，并尝试促单或开通测试账号。
            </p>
          </div>

          {/* Associated Customer Card */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">关联客户</h4>
            <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-300 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704d" />
                <div>
                  <div className="font-medium text-gray-900 text-sm">张先生</div>
                  <div className="text-xs text-gray-500 mt-0.5">意向沟通中 · 138****8888</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Execution Timeline */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">流转记录</h4>
            <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pb-2">
              <div className="relative pl-6">
                <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                </div>
                <div className="text-sm font-medium text-gray-900">主管王 分配了任务</div>
                <div className="text-xs text-gray-500 mt-0.5">昨天 10:20</div>
              </div>
              <div className="relative pl-6">
                <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                </div>
                <div className="text-sm font-medium text-gray-900">销售 A 接收了任务</div>
                <div className="text-xs text-gray-500 mt-0.5">昨天 10:25</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Area (Sticky) */}
        <div className="border-t border-gray-200 bg-white p-6 shrink-0 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4" /> 填写跟进小结
            </label>
            <Textarea 
              placeholder="记录本次跟进的结果、客户反馈及下一步计划..." 
              className="min-h-[100px] resize-none text-sm"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50">
              <MessageCircle className="w-4 h-4 mr-2" /> 去企微跟进
            </Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
              <CheckCircle2 className="w-4 h-4 mr-2" /> 标记完成
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
