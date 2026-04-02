import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs"
import { 
  Settings, Users, Shield, Link as LinkIcon, CheckCircle2, RefreshCw, 
  Plus, Bot, Globe, Lock, MessageSquare, User, ShieldAlert, 
  AlertTriangle, Zap, Info, ExternalLink, ChevronRight 
} from "lucide-react"
import { Switch } from "@/components/ui/Switch"

export default function OrganizationSettings() {
  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">组织与设置</h2>
        <p className="text-sm text-gray-500 mt-1">管理您的企业微信集成、组织架构同步及全局配置</p>
      </div>

      <Tabs defaultValue="wecom" className="flex-1 flex flex-col">
        <div className="px-6 border-b border-gray-100 bg-white">
          <TabsList className="bg-transparent border-none gap-8 h-14">
            <TabsTrigger value="wecom" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 h-14 text-sm font-semibold transition-all">
              企业微信集成
            </TabsTrigger>
            <TabsTrigger value="org" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 h-14 text-sm font-semibold transition-all">
              组织架构同步
            </TabsTrigger>
            <TabsTrigger value="roles" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 h-14 text-sm font-semibold transition-all">
              角色与权限
            </TabsTrigger>
            <TabsTrigger value="toolbar" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 h-14 text-sm font-semibold transition-all">
              侧边栏工具配置
            </TabsTrigger>
            <TabsTrigger value="debug" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 h-14 text-sm font-semibold transition-all">
              调试与开发开关
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/20">
          <TabsContent value="wecom" className="mt-0 space-y-8 max-w-3xl">
            {/* Connection Status */}
            <div className="flex items-center justify-between p-5 bg-green-50 border border-green-100 rounded-xl shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <div className="text-base font-bold text-green-900">已成功连接企业微信</div>
                  <div className="text-xs text-green-700 mt-0.5">企业 ID: ww7890****1234 | 认证状态: 已认证</div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="bg-white border-green-200 text-green-700 hover:bg-green-100 font-semibold">
                重新连接
              </Button>
            </div>

            {/* Config Form */}
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-400" /> 企业 ID (CorpID)
                  </label>
                  <Input defaultValue="ww7890****1234" disabled className="bg-gray-50 border-gray-200 font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-gray-400" /> 应用 AgentId
                  </label>
                  <Input defaultValue="1000002" className="border-gray-200 focus:ring-blue-500 font-mono" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-400" /> 应用 Secret
                </label>
                <div className="relative">
                  <Input type="password" defaultValue="************************" className="border-gray-200 focus:ring-blue-500 pr-20 font-mono" />
                  <Button variant="ghost" size="sm" className="absolute right-1 top-1 h-7 text-blue-600 text-xs font-semibold">显示</Button>
                </div>
                <p className="text-[11px] text-gray-400">用于同步通讯录、发送应用消息等核心功能</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-400" /> 客户联系 Secret
                </label>
                <div className="relative">
                  <Input type="password" defaultValue="************************" className="border-gray-200 focus:ring-blue-500 pr-20 font-mono" />
                  <Button variant="ghost" size="sm" className="absolute right-1 top-1 h-7 text-blue-600 text-xs font-semibold">显示</Button>
                </div>
                <p className="text-[11px] text-gray-400">用于获取客户列表、外部联系人详情等权限</p>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
              <Button variant="outline" className="font-semibold">重置</Button>
              <Button className="bg-blue-600 hover:bg-blue-700 px-10 font-semibold shadow-sm transition-all">保存配置</Button>
            </div>
          </TabsContent>

          <TabsContent value="org" className="mt-0">
            <div className="max-w-4xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">同步规则</h3>
                  <p className="text-sm text-gray-500">配置如何将企业微信的组织架构同步到本系统</p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm">
                  <RefreshCw className="w-4 h-4 mr-2" /> 立即手动同步
                </Button>
              </div>

              <Card className="border-gray-200 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-6 flex items-center justify-between border-b border-gray-50 bg-white">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-gray-900">自动同步</div>
                      <div className="text-xs text-gray-500">开启后，系统将每隔 2 小时自动同步一次通讯录变更</div>
                    </div>
                    <Switch checked={true} />
                  </div>

                  <div className="p-6 space-y-4 bg-white">
                    <div className="text-sm font-bold text-gray-900">同步范围</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 border-2 border-blue-500 bg-blue-50 rounded-xl flex items-center justify-between shadow-sm transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Users className="w-6 h-6 text-blue-600" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-blue-900">全量同步</span>
                            <span className="text-[10px] text-blue-600 font-medium">同步所有部门与成员</span>
                          </div>
                        </div>
                        <CheckCircle2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="p-5 border border-gray-200 bg-white rounded-xl flex items-center justify-between opacity-60 grayscale cursor-not-allowed">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Shield className="w-6 h-6 text-gray-400" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-700">指定部门同步</span>
                            <span className="text-[10px] text-gray-400 font-medium">仅同步选中的部门</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="roles" className="mt-0">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">角色管理</h3>
                  <p className="text-sm text-gray-500">定义不同角色的功能访问权限</p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm">
                  <Plus className="w-4 h-4 mr-2" /> 新增角色
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Role Card 1 */}
                <Card className="border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group bg-white">
                  <CardHeader className="p-6 pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-bold text-gray-900">超级管理员</CardTitle>
                    <Badge className="bg-blue-50 text-blue-700 text-[10px] border-transparent font-bold">系统预设</Badge>
                  </CardHeader>
                  <CardContent className="p-6 pt-2">
                    <p className="text-xs text-gray-500 leading-relaxed mb-6">拥有系统所有功能的最高访问权限，包括组织设置和计费管理。</p>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                        <Users className="w-3 h-3" /> 2 位成员
                      </div>
                      <Button variant="link" className="h-auto p-0 text-blue-600 text-[10px] font-bold">编辑权限</Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Role Card 2 */}
                <Card className="border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group bg-white">
                  <CardHeader className="p-6 pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-bold text-gray-900">销售主管</CardTitle>
                    <Badge className="bg-blue-50 text-blue-700 text-[10px] border-transparent font-bold">系统预设</Badge>
                  </CardHeader>
                  <CardContent className="p-6 pt-2">
                    <p className="text-xs text-gray-500 leading-relaxed mb-6">可查看部门内所有客户数据、看板及策略配置，无法修改组织设置。</p>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                        <Users className="w-3 h-3" /> 12 位成员
                      </div>
                      <Button variant="link" className="h-auto p-0 text-blue-600 text-[10px] font-bold">编辑权限</Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Role Card 3 */}
                <Card className="border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group bg-white">
                  <CardHeader className="p-6 pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-bold text-gray-900">一线销售</CardTitle>
                    <Badge className="bg-blue-50 text-blue-700 text-[10px] border-transparent font-bold">系统预设</Badge>
                  </CardHeader>
                  <CardContent className="p-6 pt-2">
                    <p className="text-xs text-gray-500 leading-relaxed mb-6">仅可查看和操作自己负责的客户、群聊及任务，可使用素材库。</p>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                        <Users className="w-3 h-3" /> 85 位成员
                      </div>
                      <Button variant="link" className="h-auto p-0 text-blue-600 text-[10px] font-bold">编辑权限</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="toolbar" className="mt-0 space-y-8">
            <div className="max-w-5xl space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">工具栏接入配置</h3>
                  <p className="text-sm text-gray-500">管理企业微信三类侧边栏工具的入口 URL 与 JSSDK 运行环境</p>
                </div>
                <Badge className="bg-green-50 text-green-700 border-green-200 font-bold px-3 py-1">
                  <CheckCircle2 className="w-3 h-3 mr-1.5" /> 域名已备案
                </Badge>
              </div>

              {/* Toolbar Entry Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { title: "客服工具栏", icon: MessageSquare, url: "https://app.company.com/sidebar/kf?uid={userId}", status: "active", permissions: ["contact", "kf"] },
                  { title: "单聊工具栏", icon: User, url: "https://app.company.com/sidebar/contact?uid={userId}&ext={externalId}", status: "active", permissions: ["contact"] },
                  { title: "群聊工具栏", icon: Users, url: "https://app.company.com/sidebar/contact?mode=group&uid={userId}&chat={chatId}", status: "inactive", permissions: ["contact", "group"] },
                ].map((item, i) => (
                  <Card key={i} className={`border-gray-200 shadow-sm hover:shadow-md transition-all ${item.status === 'inactive' ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                    <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.status === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <CardTitle className="text-sm font-bold text-gray-900">{item.title}</CardTitle>
                      </div>
                      <Switch checked={item.status === 'active'} />
                    </CardHeader>
                    <CardContent className="p-5 pt-2 space-y-4">
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">入口 URL</div>
                        <div className="bg-gray-50 p-2 rounded border border-gray-100 font-mono text-[10px] text-gray-600 break-all leading-relaxed">
                          {item.url}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                        <div className="flex gap-1">
                          {item.permissions.map(p => (
                            <Badge key={p} variant="secondary" className="text-[9px] px-1 py-0 bg-gray-100 text-gray-500 border-none uppercase">{p}</Badge>
                          ))}
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 text-blue-600 text-[10px] font-bold p-0">编辑 URL</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* JSSDK & Domain Config */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-gray-200 shadow-sm">
                  <CardHeader className="p-6 border-b border-gray-50">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-600" /> JSSDK 签名域名配置
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-700">可信域名 (Trusted Domain)</label>
                      <Input defaultValue="app.company.com" className="border-gray-200 text-sm font-mono" />
                      <p className="text-[10px] text-gray-400">必须与企业微信后台配置的“可信域名”保持一致</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-700">JSSDK 签名地址 (Ticket URL)</label>
                      <Input defaultValue="https://api.company.com/wecom/js-ticket" className="border-gray-200 text-sm font-mono" />
                    </div>
                    <div className="pt-2">
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-xs font-bold h-9">
                        校验签名连通性
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-sm bg-blue-50/30">
                  <CardHeader className="p-6 border-b border-blue-100/50">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-blue-600" /> 权限与环境检查
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {[
                        { label: "通讯录权限 (contact)", status: "pass" },
                        { label: "外部联系人权限 (external_contact)", status: "pass" },
                        { label: "微信客服权限 (kf)", status: "pass" },
                        { label: "可信域名备案状态", status: "pass" },
                        { label: "IP 白名单配置", status: "warning" },
                      ].map((check, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">{check.label}</span>
                          {check.status === 'pass' ? (
                            <Badge className="bg-green-100 text-green-700 border-none text-[10px] px-1.5 py-0">通过</Badge>
                          ) : (
                            <Badge className="bg-orange-100 text-orange-700 border-none text-[10px] px-1.5 py-0">待检查</Badge>
                          )}
                        </div>
                      ))}
                      <div className="pt-4 mt-4 border-t border-blue-100/50">
                        <p className="text-[10px] text-blue-600 leading-relaxed italic">
                          注意：部分权限需要您在企业微信管理后台手动开启后，再点击下方按钮进行同步校验。
                        </p>
                        <Button variant="outline" className="w-full mt-3 border-blue-200 text-blue-600 text-xs font-bold h-9 bg-white">
                          重新执行全量校验
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="debug" className="mt-0">
            <div className="max-w-4xl space-y-8">
              <div className="p-5 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-orange-900">调试模式说明</div>
                  <p className="text-xs text-orange-700 mt-1 leading-relaxed">
                    调试工具仅在非生产环境（Development/Staging）或显式开启 <code className="bg-orange-100 px-1 rounded">VITE_ENABLE_DEBUG_TOOLS</code> 时生效。
                    生产环境下，所有调试面板和模拟器将自动禁用以确保安全性。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-600" /> 实验室功能 (Lab Features)
                  </h4>
                  <div className="space-y-4">
                    {[
                      { label: "开启 VConsole 移动端调试", desc: "在侧边栏工具中显示绿色调试按钮", active: true },
                      { label: "模拟 API 响应延迟", desc: "全局增加 800ms 延迟以测试 Loading 状态", active: false },
                      { label: "显示路由追踪日志", desc: "在控制台打印详细的路由跳转与参数信息", active: true },
                      { label: "禁用 JSSDK 签名校验", desc: "仅用于本地开发环境跳过签名逻辑", active: false },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start justify-between p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-gray-900">{item.label}</div>
                          <div className="text-[10px] text-gray-500">{item.desc}</div>
                        </div>
                        <Switch checked={item.active} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600" /> 联调辅助与 FAQ
                  </h4>
                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-5 space-y-5">
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-gray-800">当前环境标识</div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-700 border-none text-[10px]">DEVELOPMENT</Badge>
                        <span className="text-[10px] text-gray-400 font-mono">v1.2.4-beta.1</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-gray-800">快速联调入口</div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold bg-white">
                          打开调试面板 <ExternalLink className="w-3 h-3 ml-1.5" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold bg-white">
                          查看 JSSDK 日志
                        </Button>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-200 space-y-3">
                      <div className="text-xs font-bold text-gray-800">常见问题</div>
                      <ul className="space-y-2">
                        <li className="text-[10px] text-blue-600 hover:underline cursor-pointer flex items-center gap-1.5">
                          <ChevronRight className="w-3 h-3" /> 为什么 JSSDK 签名失败 (invalid signature)？
                        </li>
                        <li className="text-[10px] text-blue-600 hover:underline cursor-pointer flex items-center gap-1.5">
                          <ChevronRight className="w-3 h-3" /> 如何在移动端查看 console 日志？
                        </li>
                        <li className="text-[10px] text-blue-600 hover:underline cursor-pointer flex items-center gap-1.5">
                          <ChevronRight className="w-3 h-3" /> 侧边栏 URL 变量无法解析怎么办？
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                <Button variant="outline" className="text-xs font-bold h-9">重置所有调试项</Button>
                <Button className="bg-blue-600 hover:bg-blue-700 px-8 text-xs font-bold h-9 shadow-sm">保存并刷新环境</Button>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
