import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs"
import { Dialog } from "@/components/ui/Dialog"
import { 
  Search, Plus, Folder, FileText, Image as ImageIcon, Link as LinkIcon, 
  MoreVertical, MessageSquare, Bot, BookOpen, Layout, Settings, 
  ChevronRight, Filter, Copy, Edit2, Trash2, Eye, ExternalLink,
  CheckCircle2, AlertCircle, Clock, Tag, User, Zap
} from "lucide-react"
import { useState } from "react"

// --- Sub-components ---

function SpeechLibrary() {
  const [isNewSpeechOpen, setIsNewSpeechOpen] = useState(false)

  return (
    <div className="flex h-full gap-6">
      <div className="w-[240px] shrink-0 flex flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-900">话术分类</h2>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {["新手破冰", "产品介绍", "售后处理", "活动邀约"].map((cat, i) => (
            <div key={cat} className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${i === 0 ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"}`}>
              <Folder className={`w-4 h-4 ${i === 0 ? "text-blue-500" : "text-gray-400"}`} />
              <span className="text-sm font-medium">{cat}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="h-14 border-b border-gray-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-gray-900">新手破冰话术</h3>
            <Badge variant="outline" className="text-[10px] text-gray-500 font-normal">12 条</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="搜索话术..." className="w-48 pl-9 pr-4 py-1.5 text-xs border border-gray-200 rounded-md outline-none" />
            </div>
            <Button size="sm" className="bg-blue-600 text-xs h-8" onClick={() => setIsNewSpeechOpen(true)}>新建话术</Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="hover:border-blue-300 transition-all cursor-pointer group bg-white shadow-sm">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge className="bg-blue-50 text-blue-600 border-none text-[10px]">通用话术</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"><MoreVertical className="h-4 w-4 text-gray-400" /></Button>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed line-clamp-3 mb-3">
                    您好，我是您的专属顾问。看到您刚刚注册了我们的产品，不知道目前体验如何？如果团队有试用需求，我可以为您申请一个 7 天高级版体验账号。
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 pt-3 border-t border-gray-50">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> 适用：全员</span>
                    <span>更新于 2 小时前</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* New Speech Dialog */}
      <Dialog
        isOpen={isNewSpeechOpen}
        onClose={() => setIsNewSpeechOpen(false)}
        title="新建话术模板"
        className="max-w-[520px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsNewSpeechOpen(false)}>取消</Button>
            <Button className="bg-blue-600" onClick={() => setIsNewSpeechOpen(false)}>保存话术</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">话术标题 <span className="text-red-500">*</span></label>
            <input type="text" placeholder="如：通用试用期破冰" className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">适用分类 <span className="text-red-500">*</span></label>
              <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none">
                <option>新手破冰</option>
                <option>产品介绍</option>
                <option>售后处理</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">适用角色</label>
              <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none">
                <option>全员</option>
                <option>仅销售</option>
                <option>仅客服</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">话术内容 <span className="text-red-500">*</span></label>
            <textarea 
              className="w-full min-h-[120px] rounded-md border border-gray-200 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
              placeholder="请输入话术内容，支持使用 {customer_name} 等占位符"
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="cursor-pointer hover:bg-gray-50">{"{客户昵称}"}</Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-gray-50">{"{所属顾问}"}</Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-gray-50">{"{当前时间}"}</Badge>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function KnowledgeBase() {
  return (
    <div className="flex h-full gap-6">
      <div className="w-[240px] shrink-0 flex flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xs font-semibold text-gray-900">知识分类</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {["产品文档", "业务 SOP", "常见 FAQ", "内部政策"].map((cat, i) => (
            <div key={cat} className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${i === 1 ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"}`}>
              <FileText className={`w-4 h-4 ${i === 1 ? "text-blue-500" : "text-gray-400"}`} />
              <span className="text-sm font-medium">{cat}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="h-14 border-b border-gray-200 bg-white px-6 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">业务 SOP</h3>
          <Button size="sm" className="bg-blue-600 text-xs h-8">新建文档</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-0">
          <table className="w-full text-left text-xs text-gray-600">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-6 py-3 font-semibold">文档名称</th>
                <th className="px-6 py-3 font-semibold">分类</th>
                <th className="px-6 py-3 font-semibold">可见范围</th>
                <th className="px-6 py-3 font-semibold">更新时间</th>
                <th className="px-6 py-3 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5].map(i => (
                <tr key={i} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-gray-900">退款流程标准化操作指南 V2.0</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">业务 SOP</td>
                  <td className="px-6 py-4"><Badge variant="secondary" className="text-[10px]">全公司</Badge></td>
                  <td className="px-6 py-4 text-gray-400">2024-03-20 14:30</td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-blue-600">编辑</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MaterialLibrary() {
  return (
    <div className="flex h-full gap-6">
      <div className="w-[240px] shrink-0 flex flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xs font-semibold text-gray-900">素材库</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 text-blue-700 cursor-pointer">
            <ImageIcon className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">图片素材</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-gray-600 hover:bg-gray-50 cursor-pointer">
            <LinkIcon className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium">链接素材</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md text-gray-600 hover:bg-gray-50 cursor-pointer">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium">PDF/文档</span>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="h-14 border-b border-gray-200 bg-white px-6 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">图片素材</h3>
          <Button size="sm" className="bg-blue-600 text-xs h-8">上传素材</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="overflow-hidden hover:border-blue-300 transition-all cursor-pointer group">
                <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full"><Eye className="w-4 h-4" /></Button>
                    <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full"><Copy className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div className="p-3 bg-white">
                  <p className="text-xs font-medium text-gray-900 truncate">产品功能对比图_{i}.png</p>
                  <p className="text-[10px] text-gray-400 mt-1">1.2 MB · 2024-03-20</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function RecommendationRules() {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isNewRuleOpen, setIsNewRuleOpen] = useState(false)

  return (
    <div className="flex flex-col h-full border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="h-14 border-b border-gray-200 bg-white px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-gray-900">推荐规则配置</h3>
          <Badge variant="outline" className="text-[10px] text-gray-500 font-normal">定义内容如何在工具栏中被推荐</Badge>
        </div>
        <Button size="sm" className="bg-blue-600 text-xs h-8" onClick={() => setIsNewRuleOpen(true)}>新建推荐规则</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-0">
        <table className="w-full text-left text-xs text-gray-600">
          <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider sticky top-0">
            <tr>
              <th className="px-6 py-3 font-semibold">规则名称</th>
              <th className="px-6 py-3 font-semibold">适用入口</th>
              <th className="px-6 py-3 font-semibold">触发条件 (标签/阶段)</th>
              <th className="px-6 py-3 font-semibold">推荐内容</th>
              <th className="px-6 py-3 font-semibold">状态</th>
              <th className="px-6 py-3 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              { name: "新手破冰推荐", entry: "微信客服", trigger: "新客户 + 意向咨询", content: "破冰话术 + 产品白皮书", status: "active" },
              { name: "高净值客户转化", entry: "单聊工具栏", trigger: "高净值 + 决策阶段", content: "对比图 + 行业案例", status: "active" },
              { name: "售后退款引导", entry: "微信客服", trigger: "退款意图", content: "退款 SOP + 补偿话术", status: "active" },
              { name: "大促活动推送", entry: "群聊工具栏", trigger: "活跃群 + 促销期间", content: "活动海报 + 优惠链接", status: "inactive" },
            ].map((rule, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4 font-medium text-gray-900">{rule.name}</td>
                <td className="px-6 py-4">
                  <Badge variant="outline" className="text-[10px]">{rule.entry}</Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-1">
                    {rule.trigger.split(" + ").map(t => (
                      <Badge key={t} variant="secondary" className="text-[10px] bg-gray-100 text-gray-600 border-none">{t}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500">{rule.content}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${rule.status === "active" ? "bg-green-500" : "bg-gray-300"}`} />
                    <span>{rule.status === "active" ? "启用中" : "已停用"}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-blue-600" onClick={() => setIsPreviewOpen(true)}>预览</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-gray-600">编辑</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Rule Dialog */}
      <Dialog
        isOpen={isNewRuleOpen}
        onClose={() => setIsNewRuleOpen(false)}
        title="新建推荐规则"
        className="max-w-[600px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsNewRuleOpen(false)}>取消</Button>
            <Button className="bg-blue-600" onClick={() => setIsNewRuleOpen(false)}>保存并启用</Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">规则名称 <span className="text-red-500">*</span></label>
            <input type="text" placeholder="如：高净值客户转化推荐" className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">1. 选择适用入口 <span className="text-red-500">*</span></label>
            <div className="flex gap-3">
              {["微信客服", "单聊工具栏", "群聊工具栏"].map(entry => (
                <label key={entry} className="flex-1 flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 transition-all">
                  <input type="checkbox" className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-gray-700">{entry}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">2. 配置触发条件 (满足以下任一条件即可推荐)</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <Tag className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-600">客户标签包含：</span>
                <Badge className="bg-blue-100 text-blue-700 border-none text-[10px]">高净值</Badge>
                <Badge className="bg-blue-100 text-blue-700 border-none text-[10px]">复购客户</Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto"><Plus className="h-3 h-3" /></Button>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <Zap className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-600">客户生命周期阶段：</span>
                <Badge className="bg-purple-100 text-purple-700 border-none text-[10px]">决策阶段</Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto"><Plus className="h-3 h-3" /></Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">3. 关联推荐内容 <span className="text-red-500">*</span></label>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-2 bg-gray-50 border-b border-gray-200 flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-[10px] bg-white">添加话术</Button>
                <Button variant="outline" size="sm" className="h-7 text-[10px] bg-white">添加素材</Button>
                <Button variant="outline" size="sm" className="h-7 text-[10px] bg-white">添加知识</Button>
              </div>
              <div className="p-3 space-y-2 max-h-32 overflow-y-auto">
                <div className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded shadow-sm">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 text-blue-500" />
                    <span className="text-[11px]">通用试用期破冰话术</span>
                  </div>
                  <Trash2 className="w-3 h-3 text-gray-400 cursor-pointer hover:text-red-500" />
                </div>
                <div className="flex items-center justify-between p-2 bg-white border border-gray-100 rounded shadow-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3 h-3 text-green-500" />
                    <span className="text-[11px]">2026 行业趋势白皮书.pdf</span>
                  </div>
                  <Trash2 className="w-3 h-3 text-gray-400 cursor-pointer hover:text-red-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog 
        isOpen={isPreviewOpen} 
        onClose={() => setIsPreviewOpen(false)} 
        title="工具栏推荐效果预览"
        className="max-w-[360px]"
      >
        <div className="space-y-4">
          <div className="p-3 bg-gray-100 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-gray-500 uppercase">WeCom Toolbar Preview</span>
              <Badge className="bg-blue-600 text-[9px] px-1 py-0">AI 推荐</Badge>
            </div>
            <div className="space-y-2">
              <div className="bg-white p-2 rounded border border-blue-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-3 h-3 text-orange-500" />
                  <span className="text-[11px] font-bold">建议发送破冰话术</span>
                </div>
                <p className="text-[10px] text-gray-600 line-clamp-2">您好，我是您的专属顾问。看到您刚刚注册了我们的产品...</p>
                <Button className="w-full h-6 text-[10px] mt-2 bg-blue-600">一键发送</Button>
              </div>
              <div className="bg-white p-2 rounded border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3 h-3 text-blue-500" />
                  <span className="text-[11px] font-bold">产品白皮书.pdf</span>
                </div>
                <Button variant="outline" className="w-full h-6 text-[10px] mt-1">分享文件</Button>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 text-center italic">
            模拟工具栏在“微信客服”入口下的实时推荐效果
          </p>
        </div>
      </Dialog>
    </div>
  )
}

function CardTemplates() {
  return (
    <div className="flex flex-col h-full border border-gray-200 bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="h-14 border-b border-gray-200 bg-white px-6 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-gray-900">卡片模板管理</h3>
        <Button size="sm" className="bg-blue-600 text-xs h-8">新建模板</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: "标准产品介绍卡片", desc: "包含标题、描述、缩略图和查看详情按钮", type: "链接卡片" },
            { title: "活动邀约卡片", desc: "突出活动时间、地点和立即报名按钮", type: "小程序卡片" },
            { title: "售后进度卡片", desc: "展示工单状态、预计完成时间和客服入口", type: "消息卡片" },
          ].map((tpl, i) => (
            <Card key={i} className="hover:border-blue-300 transition-all cursor-pointer group bg-white">
              <CardHeader className="p-4">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className="text-[10px]">{tpl.type}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="h-4 w-4 text-gray-400" /></Button>
                </div>
                <CardTitle className="text-sm font-bold mt-2">{tpl.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="aspect-[4/3] bg-gray-100 rounded border border-gray-200 mb-3 flex flex-col p-3 space-y-2">
                  <div className="h-3 w-3/4 bg-gray-200 rounded" />
                  <div className="h-2 w-full bg-gray-200 rounded" />
                  <div className="h-2 w-full bg-gray-200 rounded" />
                  <div className="flex-1" />
                  <div className="h-6 w-full bg-blue-500 rounded" />
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">{tpl.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Main Page ---

export default function StrategyCenter() {
  const [activeTab, setActiveTab] = useState("speech")

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="shrink-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border border-gray-200 shadow-sm p-1">
            <TabsTrigger value="speech" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              <MessageSquare className="w-4 h-4 mr-2" /> 话术库
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              <BookOpen className="w-4 h-4 mr-2" /> 知识库
            </TabsTrigger>
            <TabsTrigger value="material" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              <ImageIcon className="w-4 h-4 mr-2" /> 素材库
            </TabsTrigger>
            <TabsTrigger value="rules" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              <Zap className="w-4 h-4 mr-2" /> 推荐规则
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
              <Layout className="w-4 h-4 mr-2" /> 卡片模板
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === "speech" && <SpeechLibrary />}
        {activeTab === "knowledge" && <KnowledgeBase />}
        {activeTab === "material" && <MaterialLibrary />}
        {activeTab === "rules" && <RecommendationRules />}
        {activeTab === "templates" && <CardTemplates />}
      </div>
    </div>
  )
}
