import type { ReactNode } from "react"
import { useEffect } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { resolveAdminSSORelay } from "@/services/adminSSO"

type Props = {
  children: ReactNode
}

function FullPageRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to)
  }, [to])

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50 text-sm text-gray-600">
      正在跳转...
    </div>
  )
}

export default function ProtectedRoute({ children }: Props) {
  const location = useLocation()
  const { loading, authenticated } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 text-sm text-gray-600">
        正在验证登录态...
      </div>
    )
  }

  if (!authenticated) {
    const next = `${location.pathname}${location.search}`
    const adminSSORelay = resolveAdminSSORelay(next)
    if (adminSSORelay) {
      return <FullPageRedirect to={adminSSORelay.redirectURL} />
    }
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  return <>{children}</>
}
