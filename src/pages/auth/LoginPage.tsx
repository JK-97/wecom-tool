import { useEffect, useMemo, useState } from "react"
import { Navigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { useAuth } from "@/context/AuthContext"
import { getOAuthStartURL } from "@/services/authService"
import { normalizeErrorMessage } from "@/services/http"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const { loading, authenticated } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [autoLoginTriggered, setAutoLoginTriggered] = useState(false)
  const [error, setError] = useState("")

  const next = useMemo(() => {
    const raw = (searchParams.get("next") || "").trim()
    return raw || "/main/dashboard"
  }, [searchParams])

  const startLogin = async () => {
    setSubmitting(true)
    setError("")
    try {
      const url = await getOAuthStartURL(next)
      window.location.assign(url)
    } catch (err) {
      setError(normalizeErrorMessage(err))
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (loading || authenticated || submitting || autoLoginTriggered) {
      return
    }
    const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent || ""
    const isWeComWebview = /wxwork/i.test(userAgent)
    if (!isWeComWebview) {
      return
    }
    setAutoLoginTriggered(true)
    void startLogin()
  }, [authenticated, autoLoginTriggered, loading, submitting])

  if (!loading && authenticated) {
    return <Navigate to={next} replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md border-gray-200 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl font-semibold text-gray-900">登录企业微信工作台</CardTitle>
          <p className="text-sm text-gray-500">
            统一登录后可访问客服侧边栏与主站工作台。
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              正在检测登录态...
            </div>
          ) : null}
          {!loading && autoLoginTriggered && submitting ? (
            <div className="flex items-center justify-center rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              检测到企业微信环境，正在自动跳转登录...
            </div>
          ) : null}
          <Button className="w-full" onClick={() => void startLogin()} disabled={submitting}>
            {submitting ? "正在跳转..." : "使用企业微信登录"}
          </Button>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
