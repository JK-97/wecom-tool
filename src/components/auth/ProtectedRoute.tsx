import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

type Props = {
  children: ReactNode
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
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  return <>{children}</>
}
