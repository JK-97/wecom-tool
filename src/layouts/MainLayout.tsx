import { Outlet, Link, useLocation } from "react-router-dom"
import { MessageSquare, Users, CheckSquare, Settings, BarChart2, BookOpen, Link as LinkIcon, GitBranch, HelpCircle, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { useAuth } from "@/context/AuthContext"
import { WecomOpenDataName } from "@/components/wecom/WecomOpenDataName"

const navItems = [
  { name: "微信客服中心", path: "/main/cs-center", icon: MessageSquare },
  { name: "客户中心", path: "/main/customer-360", icon: Users },
  { name: "客户列表", path: "/main/customers", icon: Users },
  { name: "群运营详情", path: "/main/group-detail", icon: Users },
  { name: "跟进任务中心", path: "/main/task-center", icon: CheckSquare },
  { name: "接待渠道", path: "/main/reception-channels", icon: LinkIcon },
  { name: "路由规则", path: "/main/routing-rules", icon: GitBranch },
  { name: "策略与素材", path: "/main/strategy", icon: BookOpen },
  { name: "数据看板", path: "/main/dashboard", icon: BarChart2 },
  { name: "组织与设置", path: "/main/settings", icon: Settings },
  { name: "使用指南", path: "/main/guide", icon: HelpCircle },
]

export default function MainLayout() {
  const location = useLocation()
  const auth = useAuth()

  const handleLogout = async () => {
    await auth.logout()
    window.location.assign("/login")
  }

  const departmentNames = (auth.user?.departments || [])
    .map((item) => (item.name || "").trim())
    .filter(Boolean)

  return (
    <div className="flex h-screen w-full bg-[#F0F2F5]">
      {/* Sidebar Navigation */}
      <div className="flex w-64 flex-col border-r border-gray-200 bg-white">
        <div className="flex h-16 shrink-0 items-center px-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
              <img src="/favicon-32.png?v=callfay-2" alt="CallFay" className="h-full w-full object-cover" />
            </div>
            <span className="text-lg font-semibold text-gray-900">CallFay 微信平台</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path) && item.path !== "#"
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-blue-600" : "text-gray-400")} />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500">
              {auth.user?.userid?.slice(0, 1).toUpperCase() || "U"}
            </div>
            <div className="flex flex-col">
              <WecomOpenDataName
                userid={auth.user?.userid || ""}
                corpId={auth.corp?.id}
                fallback={auth.user?.userid || "成员"}
                className="truncate text-sm font-medium text-gray-900"
                hintClassName="text-[10px] text-gray-400"
              />
              <span className="text-xs text-gray-500">
                {auth.user?.userid || "-"}
                {departmentNames.length > 0 ? ` · ${departmentNames.join(" / ")}` : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-8">
          <h1 className="text-lg font-medium text-gray-900">
            {navItems.find(item => location.pathname.startsWith(item.path))?.name || "工作台"}
          </h1>
          <div className="flex items-center gap-4">
            {auth.corp?.id ? <span className="text-xs text-gray-500">{auth.corp.name || auth.corp.id}</span> : null}
            {departmentNames.length > 0 ? <span className="text-xs text-gray-500">部门：{departmentNames.join(" / ")}</span> : null}
            <Link to="/" className="text-sm text-blue-600 hover:underline">返回导航页</Link>
            <Button size="sm" variant="outline" onClick={() => void handleLogout()}>
              <LogOut className="mr-1 h-3.5 w-3.5" />
              退出
            </Button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
