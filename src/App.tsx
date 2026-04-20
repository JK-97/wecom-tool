/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import ProtectedRoute from "./components/auth/ProtectedRoute"

const Home = lazy(() => import("./pages/Home"))
const SidebarLayout = lazy(() => import("./layouts/SidebarLayout"))
const MainLayout = lazy(() => import("./layouts/MainLayout"))
const CSSidebar = lazy(() => import("./pages/sidebar/CSSidebar"))
const ContactSidebarEntry = lazy(() => import("./pages/sidebar/ContactSidebarEntry"))
const LoginPage = lazy(() => import("./pages/auth/LoginPage"))
const OAuthCallbackPage = lazy(() => import("./pages/auth/OAuthCallbackPage"))
const Customer360 = lazy(() => import("./pages/main/Customer360"))
const TaskCenter = lazy(() => import("./pages/main/TaskCenter"))
const CSCommandCenter = lazy(() => import("./pages/main/CSCommandCenter"))
const CustomerList = lazy(() => import("./pages/main/CustomerList"))
const GroupDetail = lazy(() => import("./pages/main/GroupDetail"))
const StrategyCenter = lazy(() => import("./pages/main/StrategyCenter"))
const Dashboard = lazy(() => import("./pages/main/Dashboard"))
const OrganizationSettings = lazy(() => import("./pages/main/OrganizationSettings"))
const TaskDetailPage = lazy(() => import("./pages/main/TaskDetailPage"))
const ReceptionChannels = lazy(() => import("./pages/main/ReceptionChannels"))
const RoutingRules = lazy(() => import("./pages/main/RoutingRules"))
const Guide = lazy(() => import("./pages/main/Guide"))

function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-500 flex items-center justify-center text-sm">
      页面加载中...
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
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
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
