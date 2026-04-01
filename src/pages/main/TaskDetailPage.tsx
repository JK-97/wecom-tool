import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Textarea } from "@/components/ui/Textarea"
import { 
  ArrowLeft, 
  Clock, 
  UserPlus, 
  CheckCircle2, 
  MessageCircle, 
  FileText, 
  History, 
  Paperclip,
  MoreVertical,
  AlertCircle
} from "lucide-react"

export default function TaskDetailPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="text-gray-500">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">跟进企业版报价单反馈</h2>
                <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200 text-xs">🔴 紧急</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                <span className="flex items-center text-red-600 font-medium">
                  <Clock className="w-4 h-4 mr-1" /> 今日 18:00 截止
                </span>
                <span className="flex items-center">
                  <UserPlus className="w-4 h-4 mr-1" /> 分配人：主管王
                </span>
                <span className="flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> 状态：进行中
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="text-gray-600">
              <History className="w-4 h-4 mr-2" /> 流转历史
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <CheckCircle2 className="w-4 h-4 mr-2" /> 标记完成
            </Button>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-5 h-5 text-gray-400" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Description */}
            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="p-4 border-b border-gray-100">
                <CardTitle className="text-sm font-semibold text-gray-800">任务描述</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100">
                  客户昨日咨询企业版报价，已发资料。今天需要跟进意向，询问是否有不清楚的地方，并尝试促单或开通测试账号。
                  <br /><br />
                  重点关注：客户对“私有化部署”的成本比较敏感，可以引导其先试用 SaaS 版。
                </p>
              </CardContent>
            </Card>

            {/* Follow-up Log */}
            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="p-4 border-b border-gray-100">
                <CardTitle className="text-sm font-semibold text-gray-800">执行记录与小结</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-6">
                {/* Input Area */}
                <div className="space-y-3">
                  <Textarea 
                    placeholder="记录本次跟进的结果、客户反馈及下一步计划..." 
                    className="min-h-[120px] text-sm border-gray-200 focus:ring-blue-500"
                  />
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" className="text-gray-500">
                      <Paperclip className="w-4 h-4 mr-2" /> 添加附件
                    </Button>
                    <Button className="bg-blue-600 h-8 text-xs px-4">保存小结</Button>
                  </div>
                </div>

                {/* History List */}
                <div className="space-y-6 pt-4 border-t border-gray-100">
                  <div className="flex gap-4">
                    <Avatar src="https://i.pravatar.cc/150?u=sales1" size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">销售 A</span>
                        <span className="text-xs text-gray-400">今天 10:25</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">
                        已通过企微联系客户，客户表示正在开会，约好下午 3 点再沟通。
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Avatar src="https://i.pravatar.cc/150?u=owner" size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900">主管王</span>
                        <span className="text-xs text-gray-400">昨天 10:20</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">
                        分配任务给销售 A，请务必在下班前拿到初步意向。
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            {/* Associated Customer */}
            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="p-4 border-b border-gray-100">
                <CardTitle className="text-sm font-semibold text-gray-800">关联客户</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg shadow-sm hover:border-blue-300 cursor-pointer transition-colors">
                  <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704d" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">张先生</div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">意向沟通中 · 138****8888</div>
                  </div>
                  <MessageCircle className="w-4 h-4 text-blue-500" />
                </div>
                <Button variant="outline" className="w-full mt-4 text-xs h-8 border-blue-200 text-blue-600 hover:bg-blue-50">
                  <MessageCircle className="w-4 h-4 mr-2" /> 去企微跟进
                </Button>
              </CardContent>
            </Card>

            {/* Task Metadata */}
            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="p-4 border-b border-gray-100">
                <CardTitle className="text-sm font-semibold text-gray-800">任务详情</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">优先级</span>
                  <Badge variant="destructive" className="text-[10px] py-0">紧急</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">截止时间</span>
                  <span className="text-xs text-gray-900 font-medium">2026-04-01 18:00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">任务类型</span>
                  <span className="text-xs text-gray-900 font-medium">客户跟进</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">创建时间</span>
                  <span className="text-xs text-gray-900 font-medium">2026-03-31 10:20</span>
                </div>
              </CardContent>
            </Card>

            {/* AI Assistant Tips */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">AI 跟进建议</span>
              </div>
              <p className="text-xs text-blue-800 leading-relaxed">
                该客户近期在官网浏览了“安全合规”页面 3 次。建议在沟通中重点强调我们产品的等保三级认证和数据加密方案。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
