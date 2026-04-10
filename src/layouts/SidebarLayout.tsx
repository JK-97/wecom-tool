import { Outlet } from "react-router-dom"

export default function SidebarLayout() {
  return (
    <div className="wecom-sidebar-shell min-h-screen w-full">
      <div className="wecom-sidebar-frame">
        <Outlet />
      </div>
    </div>
  )
}
