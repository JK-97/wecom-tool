import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Search, Plus, Folder, FileText, Image as ImageIcon, Link as LinkIcon, MoreVertical, MessageSquare, Bot } from "lucide-react"

export default function StrategyCenter() {
  return (
    <div className="flex h-full gap-6">
      {/* Left Column: Directory Tree (20%) */}
      <div className="w-[280px] shrink-0 flex flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">策略与素材库</h2>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-blue-600">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Tree Item 1 (Active) */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-blue-50 text-blue-700 cursor-pointer transition-colors">
            <Folder className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-sm font-medium truncate">新手破冰话术</span>
            <Badge variant="secondary" className="ml-auto text-[10px] bg-blue-100 text-blue-700 border-transparent">12</Badge>
          </div>
          
          {/* Tree Item 2 */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-md text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
            <Folder className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm font-medium truncate">产品白皮书与资料</span>
            <Badge variant="secondary" className="ml-auto text-[10px] bg-gray-100 text-gray-500 border-transparent">5</Badge>
          </div>

          {/* Tree Item 3 */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-md text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
            <Folder className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm font-medium truncate">退款/售后 SOP</span>
            <Badge variant="secondary" className="ml-auto text-[10px] bg-gray-100 text-gray-500 border-transparent">8</Badge>
          </div>

          {/* Tree Item 4 */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-md text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
            <Folder className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm font-medium truncate">节日大促活动素材</span>
            <Badge variant="secondary" className="ml-auto text-[10px] bg-gray-100 text-gray-500 border-transparent">24</Badge>
          </div>
        </div>
      </div>

      {/* Right Column: Content Management (80%) */}
      <div className="flex-1 flex flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Header Actions */}
        <div className="h-16 border-b border-gray-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900">新手破冰话术</h3>
            <Badge variant="outline" className="text-gray-500 border-gray-200 font-normal">共 12 个素材</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="搜索素材标题或内容..." 
                className="w-64 pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button variant="outline" className="text-gray-600 border-gray-200 hover:bg-gray-50">
              <Bot className="w-4 h-4 mr-2 text-purple-500" /> 配置 AI 推荐规则
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> 新建素材
            </Button>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Material Card 1: Text */}
            <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group bg-white">
              <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-gray-900 line-clamp-1">通用试用期破冰</CardTitle>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <p className="text-xs text-gray-600 line-clamp-3 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed">
                  您好，我是您的专属顾问。看到您刚刚注册了我们的产品，不知道目前体验如何？如果团队有试用需求，我可以为您申请一个 7 天高级版体验账号。
                </p>
                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-50">
                  <span className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded"><Bot className="w-3 h-3" /> 触发：意向沟通中</span>
                  <span>使用: 1,284 次</span>
                </div>
              </CardContent>
            </Card>

            {/* Material Card 2: Link */}
            <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group bg-white">
              <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-green-50 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-4 h-4 text-green-600" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-gray-900 line-clamp-1">2026 行业白皮书</CardTitle>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <p className="text-xs text-gray-600 line-clamp-3 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100 leading-relaxed">
                  [链接] 深度解析 2026 年行业趋势与数字化转型最佳实践，适合发送给高层决策者。
                </p>
                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-50">
                  <span className="flex items-center gap-1.5 bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded"><Bot className="w-3 h-3" /> 触发：高净值客户</span>
                  <span>使用: 856 次</span>
                </div>
              </CardContent>
            </Card>

            {/* Material Card 3: Image */}
            <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group bg-white">
              <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-orange-50 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4 text-orange-600" />
                  </div>
                  <CardTitle className="text-sm font-semibold text-gray-900 line-clamp-1">企业版功能对比图</CardTitle>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="h-24 bg-gray-100 rounded-lg border border-gray-200 mb-4 flex items-center justify-center overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  <span className="text-xs text-gray-500 font-medium z-10">feature-comparison.png</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-50">
                  <span className="flex items-center gap-1.5 bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded"><Bot className="w-3 h-3" /> 触发：咨询报价</span>
                  <span>使用: 432 次</span>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  )
}
