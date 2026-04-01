import { Link } from "react-router-dom"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { MessageSquare, Users, CheckSquare, MessageCircle, UserPlus, UsersRound, FileText, Settings } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">企业微信双域客户沟通平台</h1>
          <p className="mt-2 text-gray-600">
            双引擎+一底座：聊天侧执行，主页端管理协同，统一底座串联。
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* 聊天侧工具栏 */}
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-800 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              聊天侧工具栏 (执行面)
            </h2>
            <div className="grid gap-4">
              <Link to="/sidebar/cs">
                <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                      1. 微信客服工具栏
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-sm text-gray-500">
                    问题处理助手。提供回复建议、SOP动作，支持一键升级到客户联系域。
                  </CardContent>
                </Card>
              </Link>
              <Link to="/sidebar/contact">
                <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-green-500" />
                      2. 客户联系单聊工具栏
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-sm text-gray-500">
                    客户跟进助手。展示客户档案、跟进任务，提供单聊回复与跟进建议。
                  </CardContent>
                </Card>
              </Link>
              <Link to="/sidebar/group">
                <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UsersRound className="h-4 w-4 text-purple-500" />
                      3. 客户联系群聊工具栏
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-sm text-gray-500">
                    群运营助手。识别群上下文，提供群内回复建议、活动分发与风险提示。
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>

          {/* 主页端工作台 */}
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-800 flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-blue-600" />
              主页端工作台 (管理面)
            </h2>
            <div className="grid gap-4">
              <Link to="/main/customer-360">
                <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      4. 客户中心详情页 (360视图)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-sm text-gray-500">
                    统一客户视图。聚合基础资料、双域互动轨迹、订单与AI洞察。
                  </CardContent>
                </Card>
              </Link>
              <Link to="/main/task-center">
                <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-orange-500" />
                      5. 跟进任务中心
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-sm text-gray-500">
                    后续动作管理。看板视图展示待跟进、今日任务与超时任务。
                  </CardContent>
                </Card>
              </Link>
              <Link to="/main/cs-center">
                <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-red-500" />
                      6. 微信客服中心
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-sm text-gray-500">
                    客服接待管理。实时监控会话状态、SLA倒计时与转人工调度。
                  </CardContent>
                </Card>
              </Link>
              <Link to="/main/strategy">
                <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-500" />
                      7. 策略与素材库
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-sm text-gray-500">
                    统一管理话术、资料与 AI 推荐规则。
                  </CardContent>
                </Card>
              </Link>
              <Link to="/main/dashboard">
                <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-teal-500" />
                      8. 数据看板
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-sm text-gray-500">
                    全局业务转化与团队绩效分析。
                  </CardContent>
                </Card>
              </Link>
              <Link to="/main/settings">
                <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="h-4 w-4 text-gray-500" />
                      9. 组织与设置
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-sm text-gray-500">
                    企微接入、组织架构与权限管理。
                  </CardContent>
                </Card>
              </Link>
              <Link to="/main/customers">
                <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-500" />
                      10. 客户列表
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-sm text-gray-500">
                    高级筛选与批量操作客户池。
                  </CardContent>
                </Card>
              </Link>
              <Link to="/main/group-detail">
                <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UsersRound className="h-4 w-4 text-pink-500" />
                      11. 群运营详情
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 text-sm text-gray-500">
                    群画像、活跃度分析与运营动态。
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BarChart2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" x2="18" y1="20" y2="10" />
      <line x1="12" x2="12" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </svg>
  )
}
