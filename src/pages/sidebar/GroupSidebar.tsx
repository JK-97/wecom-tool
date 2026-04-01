import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Dialog } from "@/components/ui/Dialog"
import { Textarea } from "@/components/ui/Textarea"
import { AlertOctagon, Send, Activity, Users, Settings, Edit3 } from "lucide-react"
import { useState } from "react"

export default function GroupSidebar() {
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)

  return (
    <div className="flex h-full flex-col bg-[#F5F7FA]">
      {/* Top: Group Context */}
      <div className="bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <Avatar src="https://i.pravatar.cc/150?u=1" className="border-2 border-white w-8 h-8" />
              <Avatar src="https://i.pravatar.cc/150?u=2" className="border-2 border-white w-8 h-8" />
              <Avatar src="https://i.pravatar.cc/150?u=3" className="border-2 border-white w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 text-sm truncate max-w-[120px]">VIP 福利群 1群</span>
                <span className="text-xs text-gray-500">150人</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-green-500" />
                  <span className="text-[10px] text-gray-600">活跃度 85%</span>
                </div>
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 w-[85%]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">售前转化群</Badge>
          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">高活跃</Badge>
        </div>
      </div>

      {/* Main Content: Operation & Risk */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Risk Alert */}
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 shadow-sm">
          <div className="flex items-start gap-2">
            <AlertOctagon className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-red-800">发现负面情绪</div>
              <p className="text-xs text-red-700 mt-1 leading-relaxed">
                <span className="font-medium">@张三</span> 抱怨物流太慢，可能引发群内不满情绪。
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="h-6 text-[10px] px-2 bg-red-600 hover:bg-red-700">
                  立即安抚
                </Button>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-red-200 text-red-700 hover:bg-red-100">
                  忽略
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* SOP Task */}
        <div className="space-y-2 pt-2">
          <div className="text-xs font-medium text-gray-500 px-1">今日群发任务 (SOP)</div>
          <div className="bg-white rounded-md border border-gray-200 p-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded flex items-center justify-center shrink-0">
                <span className="text-lg">🎁</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">周末闪购福利预告</div>
                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  各位群友，本周末我们将开启限时闪购，全场低至 5 折，点击链接提前加购...
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" className="h-7 text-xs px-3 bg-blue-600">
                <Send className="w-3 h-3 mr-1" /> 一键发群
              </Button>
            </div>
          </div>
        </div>

        {/* Active Members */}
        <div className="space-y-2 pt-2">
          <div className="text-xs font-medium text-gray-500 px-1 flex items-center justify-between">
            <span>活跃成员 Top 3</span>
            <span className="text-[10px] text-blue-600 cursor-pointer hover:underline">查看全部</span>
          </div>
          <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-100">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-2.5 hover:bg-gray-50 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Avatar src={`https://i.pravatar.cc/150?u=${i + 10}`} size="sm" />
                  <span className="text-sm text-gray-700">群友 {i}</span>
                </div>
                <span className="text-xs text-gray-400">发言 {10 - i} 次</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bg-white p-3 border-t border-gray-200 space-y-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Button 
          className="w-full bg-blue-600 hover:bg-blue-700 font-medium"
          onClick={() => setIsRecordModalOpen(true)}
        >
          <Edit3 className="w-4 h-4 mr-2" />
          记录群运营动作
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1 text-gray-600 bg-gray-100 hover:bg-gray-200">
            <Users className="w-4 h-4 mr-1" /> 群阶段
          </Button>
          <Button variant="secondary" className="flex-1 text-gray-600 bg-gray-100 hover:bg-gray-200">
            <Settings className="w-4 h-4 mr-1" /> 群设置
          </Button>
        </div>
      </div>

      {/* Record Operation Modal */}
      <Dialog 
        isOpen={isRecordModalOpen} 
        onClose={() => setIsRecordModalOpen(false)} 
        title="记录群运营动作"
        className="max-w-[320px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsRecordModalOpen(false)}>取消</Button>
            <Button className="bg-blue-600" onClick={() => setIsRecordModalOpen(false)}>保存记录</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">动作类型 <span className="text-red-500">*</span></label>
            <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>活动预热</option>
              <option>答疑解惑</option>
              <option>危机处理</option>
              <option>促单转化</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">动作详情 <span className="text-red-500">*</span></label>
            <Textarea 
              className="text-sm min-h-[100px]" 
              placeholder="记录具体做了什么，如：发布了周末闪购预告，并解答了 3 个关于物流的问题..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">关联素材 (可选)</label>
            <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">选择已发送的素材</option>
              <option>周末闪购海报</option>
              <option>退换货政策说明</option>
            </select>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
