/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Home from "./pages/Home"
import SidebarLayout from "./layouts/SidebarLayout"
import MainLayout from "./layouts/MainLayout"
import CSSidebar from "./pages/sidebar/CSSidebar"
import ContactSidebarEntry from "./pages/sidebar/ContactSidebarEntry"
import LoginPage from "./pages/auth/LoginPage"
import OAuthCallbackPage from "./pages/auth/OAuthCallbackPage"
import Customer360 from "./pages/main/Customer360"
import TaskCenter from "./pages/main/TaskCenter"
import CSCommandCenter from "./pages/main/CSCommandCenter"
import CustomerList from "./pages/main/CustomerList"
import GroupDetail from "./pages/main/GroupDetail"
import StrategyCenter from "./pages/main/StrategyCenter"
import Dashboard from "./pages/main/Dashboard"
import OrganizationSettings from "./pages/main/OrganizationSettings"
import TaskDetailPage from "./pages/main/TaskDetailPage"
import ReceptionChannels from "./pages/main/ReceptionChannels"
import RoutingRules from "./pages/main/RoutingRules"
import Guide from "./pages/main/Guide"
import { AuthProvider } from "./context/AuthContext"
import ProtectedRoute from "./components/auth/ProtectedRoute"

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<OAuthCallbackPage />} />

          {/* Sidebar product routes */}
          <Route
            path="/sidebar"
            element={
              <ProtectedRoute>
                <SidebarLayout />
              </ProtectedRoute>
            }
          >
            <Route path="kf" element={<CSSidebar />} />
            <Route path="contact" element={<ContactSidebarEntry />} />

            {/* Transitional aliases */}
            <Route path="cs" element={<Navigate to="/sidebar/kf" replace />} />
            <Route path="group" element={<Navigate to="/sidebar/contact?mode=group" replace />} />
          </Route>

          {/* Main Web Routes (PC Dashboard) */}
          <Route
            path="/main"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="customer-360" element={<Customer360 />} />
            <Route path="task-center" element={<TaskCenter />} />
            <Route path="task-detail" element={<TaskDetailPage onBack={() => window.history.back()} />} />
            <Route path="cs-center" element={<CSCommandCenter />} />
            <Route path="customers" element={<CustomerList />} />
            <Route path="group-detail" element={<GroupDetail onBack={() => window.history.back()} />} />
            <Route path="strategy" element={<StrategyCenter />} />
            <Route path="dashboard" element={<Dashboard onBack={() => window.history.back()} />} />
            <Route path="settings" element={<OrganizationSettings />} />
            <Route path="reception-channels" element={<ReceptionChannels />} />
            <Route path="routing-rules" element={<RoutingRules />} />
            <Route path="guide" element={<Guide />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
