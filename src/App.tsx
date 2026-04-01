/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import SidebarLayout from "./layouts/SidebarLayout"
import MainLayout from "./layouts/MainLayout"
import CSSidebar from "./pages/sidebar/CSSidebar"
import ContactSidebar from "./pages/sidebar/ContactSidebar"
import GroupSidebar from "./pages/sidebar/GroupSidebar"
import Customer360 from "./pages/main/Customer360"
import TaskCenter from "./pages/main/TaskCenter"
import CSCommandCenter from "./pages/main/CSCommandCenter"
import CustomerList from "./pages/main/CustomerList"
import GroupDetail from "./pages/main/GroupDetail"
import StrategyCenter from "./pages/main/StrategyCenter"
import Dashboard from "./pages/main/Dashboard"
import OrganizationSettings from "./pages/main/OrganizationSettings"
import TaskDetailPage from "./pages/main/TaskDetailPage"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        
        {/* Sidebar Routes (Simulating WeChat sidebar) */}
        <Route path="/sidebar" element={<SidebarLayout />}>
          <Route path="cs" element={<CSSidebar />} />
          <Route path="contact" element={<ContactSidebar />} />
          <Route path="group" element={<GroupSidebar />} />
        </Route>

        {/* Main Web Routes (PC Dashboard) */}
        <Route path="/main" element={<MainLayout />}>
          <Route path="customer-360" element={<Customer360 />} />
          <Route path="task-center" element={<TaskCenter />} />
          <Route path="task-detail" element={<TaskDetailPage onBack={() => window.history.back()} />} />
          <Route path="cs-center" element={<CSCommandCenter />} />
          <Route path="customers" element={<CustomerList />} />
          <Route path="group-detail" element={<GroupDetail onBack={() => window.history.back()} />} />
          <Route path="strategy" element={<StrategyCenter />} />
          <Route path="dashboard" element={<Dashboard onBack={() => window.history.back()} />} />
          <Route path="settings" element={<OrganizationSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
