import { Outlet } from "react-router-dom"

export default function SidebarLayout() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100 p-4">
      {/* Simulate the narrow WeChat sidebar */}
      <div className="relative flex h-full max-h-[800px] w-full max-w-[360px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-[#F5F7FA] shadow-xl">
        <div className="flex h-12 shrink-0 items-center justify-center border-b border-gray-200 bg-white px-4">
          <span className="text-sm font-medium text-gray-700">企微侧边栏模拟</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
