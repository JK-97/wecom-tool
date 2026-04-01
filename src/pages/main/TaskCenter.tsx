import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Avatar } from "@/components/ui/Avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Clock, MessageCircle, ArrowUpRight, CheckCircle2, MoreHorizontal, Search, ClipboardList } from "lucide-react"
import { useState } from "react"
import TaskDetailDrawer from "./TaskDetailDrawer"
import { EmptyState } from "@/components/ui/EmptyState"

export default function TaskCenter() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false)
  const [isUpdateProgressModalOpen, setIsUpdateProgressModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("my-tasks")

  return (
    <div className="flex h-full flex-col">
      {/* Filters */}
      <div className="mb-6 flex items-center justify-between">
        <Tabs defaultValue="my-tasks" onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-gray-200 shadow-sm">
            <TabsTrigger value="my-tasks" className="data-[state=active]:bg-gray-100">我的任务</TabsTrigger>
            <TabsTrigger value="team-tasks" className="data-[state=active]:bg-gray-100">团队任务</TabsTrigger>
            <TabsTrigger value="today" className="data-[state=active]:bg-gray-100 text-orange-600">今日到期</TabsTrigger>
            <TabsTrigger value="overdue" className="data-[state=active]:bg-gray-100 text-red-600">已逾期</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3">
          <select className="h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>所有任务类型</option>
            <option>客服升级</option>
            <option>日常回访</option>
            <option>群运营</option>
          </select>
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => setIsNewTaskModalOpen(true)}
          >
            新建任务
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
        {/* Column 1: Todo */}
        <div className="flex w-[350px] shrink-0 flex-col rounded-xl bg-gray-100/80 p-4">
          <div className="mb-4 flex items-center justify-between px-1">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              待跟进 <Badge variant="secondary" className="bg-gray-200 text-gray-600">{activeTab === 'overdue' ? '0' : '3'}</Badge>
            </h3>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500"><MoreHorizontal className="h-4 w-4" /></Button>
          </div>
          
          <div className="flex-1 space-y-3 overflow-y-auto">
            {activeTab === 'overdue' ? (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  icon={ClipboardList}
                  title="暂无逾期任务"
                  description="太棒了！所有任务都在按计划进行。"
                />
              </div>
            ) : (
              <>
                {/* Task Card 1 (Urgent) */}
                <Card 
                  className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setIsDrawerOpen(true)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">🔴 紧急升级</Badge>
                      <span className="text-xs text-red-600 font-medium flex items-center"><Clock className="w-3 h-3 mr-1" /> 今日截止</span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">张先生 - 咨询企业版报价</h4>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-4">
                      客户昨日咨询企业版报价，已发资料，需跟进意向并促单。
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704d" size="sm" />
                        <span className="text-xs text-gray-600">销售 A</span>
                      </div>
                      <Button size="sm" className="h-7 text-xs px-3 bg-blue-600">去跟进</Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Task Card 2 */}
                <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">日常回访</Badge>
                      <span className="text-xs text-gray-500 flex items-center"><Clock className="w-3 h-3 mr-1" /> 明日截止</span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">王女士 - 试用期过半回访</h4>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-4">
                      客户试用账号已开通 4 天，需了解使用情况，解答疑问。
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704d" size="sm" />
                        <span className="text-xs text-gray-600">销售 A</span>
                      </div>
                      <Button size="sm" className="h-7 text-xs px-3 bg-blue-600">去跟进</Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* Column 2: In Progress */}
        <div className="flex w-[350px] shrink-0 flex-col rounded-xl bg-gray-100/80 p-4">
          <div className="mb-4 flex items-center justify-between px-1">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              跟进中 <Badge variant="secondary" className="bg-blue-100 text-blue-700">{activeTab === 'overdue' ? '0' : '1'}</Badge>
            </h3>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500"><MoreHorizontal className="h-4 w-4" /></Button>
          </div>
          
          <div className="flex-1 space-y-3 overflow-y-auto">
            {activeTab === 'overdue' ? (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  icon={ClipboardList}
                  title="暂无逾期任务"
                  description="太棒了！所有任务都在按计划进行。"
                />
              </div>
            ) : (
              <>
                {/* Task Card 3 */}
                <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">方案制作</Badge>
                      <span className="text-xs text-gray-500 flex items-center"><Clock className="w-3 h-3 mr-1" /> 3天后截止</span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">李总 - 定制化部署方案</h4>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-4">
                      已完成初步需求调研，正在联合产研团队输出私有化部署方案。
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704d" size="sm" />
                        <span className="text-xs text-gray-600">销售 A</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-xs px-3"
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsUpdateProgressModalOpen(true)
                        }}
                      >
                        更新进度
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* Column 3: Done */}
        <div className="flex w-[350px] shrink-0 flex-col rounded-xl bg-gray-100/80 p-4 opacity-70 hover:opacity-100 transition-opacity">
          <div className="mb-4 flex items-center justify-between px-1">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              已完成 <Badge variant="secondary" className="bg-green-100 text-green-700">{activeTab === 'overdue' ? '0' : '12'}</Badge>
            </h3>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500"><MoreHorizontal className="h-4 w-4" /></Button>
          </div>
          
          <div className="flex-1 space-y-3 overflow-y-auto">
            {activeTab === 'overdue' ? (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  icon={ClipboardList}
                  title="暂无逾期任务"
                  description="太棒了！所有任务都在按计划进行。"
                />
              </div>
            ) : (
               <>
                 {/* Task Card 4 */}
                 <Card className="border-l-4 border-l-green-500 shadow-sm cursor-pointer bg-gray-50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 text-[10px]">群发任务</Badge>
                      <span className="text-xs text-green-600 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> 今天 10:30</span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-500 line-through mb-1">周末闪购福利预告</h4>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-4">
                      向 5 个高优群发送周末活动预告。
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026704d" size="sm" className="opacity-50" />
                        <span className="text-xs text-gray-400">销售 A</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
               </>
            )}
          </div>
        </div>

      </div>
      {isDrawerOpen && <TaskDetailDrawer onClose={() => setIsDrawerOpen(false)} />}

      {/* New Task Modal */}
      <Dialog 
        isOpen={isNewTaskModalOpen} 
        onClose={() => setIsNewTaskModalOpen(false)} 
        title="新建任务"
        className="max-w-[400px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsNewTaskModalOpen(false)}>取消</Button>
            <Button className="bg-blue-600" onClick={() => setIsNewTaskModalOpen(false)}>创建任务</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">任务标题 <span className="text-red-500">*</span></label>
            <Input placeholder="如：发送产品报价单" className="text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">关联客户/群 (可选)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="搜索客户或群聊..." 
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">负责人 <span className="text-red-500">*</span></label>
              <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>销售 A (自己)</option>
                <option>销售 B</option>
                <option>销售 C</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">截止时间 <span className="text-red-500">*</span></label>
              <Input type="datetime-local" className="text-sm" />
            </div>
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

      {/* Update Progress Modal */}
      <Dialog 
        isOpen={isUpdateProgressModalOpen} 
        onClose={() => setIsUpdateProgressModalOpen(false)} 
        title="更新进度"
        className="max-w-[400px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsUpdateProgressModalOpen(false)}>取消</Button>
            <Button className="bg-blue-600" onClick={() => setIsUpdateProgressModalOpen(false)}>保存进度</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">当前任务状态</label>
            <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>跟进中</option>
              <option>已完成</option>
              <option>已取消</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">进度说明 <span className="text-red-500">*</span></label>
            <Textarea 
              className="text-sm min-h-[100px]" 
              placeholder="记录当前的进展情况、遇到的问题或下一步计划..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">调整截止时间 (可选)</label>
            <Input type="datetime-local" className="text-sm" />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
