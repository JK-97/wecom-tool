import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Dialog } from "@/components/ui/Dialog"
import { Drawer } from "@/components/ui/Drawer"
import { Textarea } from "@/components/ui/Textarea"
import { Input } from "@/components/ui/Input"
import { AlertTriangle, Copy, Send, CheckCircle2, Tag, Calendar, MessageSquarePlus, Search } from "lucide-react"
import { useState } from "react"

export default function ContactSidebar() {
  const [isFollowUpDrawerOpen, setIsFollowUpDrawerOpen] = useState(false)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)

  return (
    <div className="flex h-full flex-col bg-[#F5F7FA]">
      {/* Top: Growth Context */}
      <div className="bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704d" fallback="张" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 text-sm">张先生</span>
                <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">@微信</span>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <select className="text-xs bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option>意向沟通中</option>
                  <option>已报价待签</option>
                  <option>已成交</option>
                  <option>流失</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-2 items-center">
          <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200">高净值</Badge>
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">近期活跃</Badge>
          <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-600 border-gray-200">来自客服升级</Badge>
          <button 
            onClick={() => setIsTagModalOpen(true)}
            className="w-5 h-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Main Content: Task & Engagement */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Urgent Task */}
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 shadow-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-red-800 flex items-center justify-between">
                <span>待办：客服升级跟进</span>
                <span className="text-[10px] font-normal text-red-600">今日截止</span>
              </div>
              <p className="text-xs text-red-700 mt-1 leading-relaxed">
                客户昨日咨询企业版报价，已发资料，需跟进意向并促单。
              </p>
              <button className="text-xs text-red-600 font-medium mt-2 underline underline-offset-2 hover:text-red-800">
                查看详情
              </button>
            </div>
          </div>
        </div>

        {/* AI Icebreaker / Suggestions */}
        <div className="space-y-2 pt-2">
          <div className="text-xs font-medium text-gray-500 px-1 flex items-center justify-between">
            <span>跟进建议 / 破冰话术</span>
            <span className="text-[10px] text-blue-600 cursor-pointer hover:underline">换一批</span>
          </div>
          
          <Card className="p-3 shadow-sm border-transparent hover:border-blue-200 transition-colors">
            <p className="text-sm text-gray-800 leading-relaxed mb-3">
              张总您好，昨天给您发了企业版的报价和案例，不知道您看后觉得如何？如果团队有试用需求，我可以为您申请一个 7 天体验账号。
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

        {/* Marketing Material */}
        <div className="space-y-2 pt-2">
          <div className="text-xs font-medium text-gray-500 px-1">营销素材推荐</div>
          <div className="bg-white rounded-md border border-gray-200 p-3 flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center shrink-0">
              <MessageSquarePlus className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">2026 行业白皮书</div>
              <div className="text-xs text-gray-500 truncate">适合高净值客户培育</div>
            </div>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs shrink-0">
              分享
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bg-white p-3 border-t border-gray-200 space-y-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Button 
          className="w-full bg-blue-600 hover:bg-blue-700 font-medium"
          onClick={() => setIsFollowUpDrawerOpen(true)}
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          写跟进 / 记录结果
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            className="flex-1 text-gray-600 bg-gray-100 hover:bg-gray-200"
            onClick={() => setIsTagModalOpen(true)}
          >
            <Tag className="w-4 h-4 mr-1" /> 打标签
          </Button>
          <Button 
            variant="secondary" 
            className="flex-1 text-gray-600 bg-gray-100 hover:bg-gray-200"
            onClick={() => setIsTaskModalOpen(true)}
          >
            <Calendar className="w-4 h-4 mr-1" /> 建任务
          </Button>
        </div>
      </div>

      {/* Write Follow-up Drawer (Bottom) */}
      <Drawer 
        isOpen={isFollowUpDrawerOpen} 
        onClose={() => setIsFollowUpDrawerOpen(false)} 
        title="写跟进"
        position="bottom"
        className="w-full max-w-[400px] mx-auto"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsFollowUpDrawerOpen(false)}>取消</Button>
            <Button className="bg-blue-600" onClick={() => setIsFollowUpDrawerOpen(false)}>保存记录</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">跟进方式 <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <label className="flex items-center gap-1 text-sm p-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-md cursor-pointer">
                <input type="radio" name="method" defaultChecked className="hidden" /> 微信聊天
              </label>
              <label className="flex items-center gap-1 text-sm p-2 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                <input type="radio" name="method" className="hidden" /> 语音电话
              </label>
              <label className="flex items-center gap-1 text-sm p-2 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50">
                <input type="radio" name="method" className="hidden" /> 线下拜访
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">客户阶段更新</label>
            <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>意向沟通中 (当前)</option>
              <option>已报价待签</option>
              <option>已成交</option>
              <option>流失</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">跟进内容 <span className="text-red-500">*</span></label>
            <Textarea 
              className="text-sm min-h-[100px]" 
              placeholder="记录本次沟通的核心内容、客户反馈及下一步计划..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">下次跟进提醒</label>
            <Input type="datetime-local" className="text-sm" />
          </div>
        </div>
      </Drawer>

      {/* Create Task Modal */}
      <Dialog 
        isOpen={isTaskModalOpen} 
        onClose={() => setIsTaskModalOpen(false)} 
        title="新建任务"
        className="max-w-[320px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsTaskModalOpen(false)}>取消</Button>
            <Button className="bg-blue-600" onClick={() => setIsTaskModalOpen(false)}>创建任务</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">任务标题 <span className="text-red-500">*</span></label>
            <Input placeholder="如：发送产品报价单" className="text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">截止时间 <span className="text-red-500">*</span></label>
            <Input type="datetime-local" className="text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">优先级</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1 text-sm"><input type="radio" name="priority" defaultChecked /> 普通</label>
              <label className="flex items-center gap-1 text-sm text-red-600"><input type="radio" name="priority" /> 紧急</label>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">任务描述</label>
            <Textarea 
              className="text-sm min-h-[80px]" 
              placeholder="补充任务细节..."
            />
          </div>
        </div>
      </Dialog>

      {/* Add Tag Modal */}
      <Dialog 
        isOpen={isTagModalOpen} 
        onClose={() => setIsTagModalOpen(false)} 
        title="打标签"
        className="max-w-[320px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsTagModalOpen(false)}>取消</Button>
            <Button className="bg-blue-600" onClick={() => setIsTagModalOpen(false)}>确定</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="搜索或创建新标签..." 
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">已选标签</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200 flex items-center gap-1">
                高净值 <span className="cursor-pointer hover:text-orange-900">×</span>
              </Badge>
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                近期活跃 <span className="cursor-pointer hover:text-blue-900">×</span>
              </Badge>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">推荐标签</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs text-gray-600 border-gray-200 cursor-pointer hover:bg-gray-50">决策人</Badge>
              <Badge variant="outline" className="text-xs text-gray-600 border-gray-200 cursor-pointer hover:bg-gray-50">价格敏感</Badge>
              <Badge variant="outline" className="text-xs text-gray-600 border-gray-200 cursor-pointer hover:bg-gray-50">竞品对比中</Badge>
              <Badge variant="outline" className="text-xs text-gray-600 border-gray-200 cursor-pointer hover:bg-gray-50">需高管介入</Badge>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
