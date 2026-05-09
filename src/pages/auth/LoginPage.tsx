import * as ww from "@wecom/jssdk"
import { useEffect, useMemo, useRef, useState } from "react"
import { Navigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { useAuth } from "@/context/AuthContext"
import { getOAuthStartURL } from "@/services/authService"
import { normalizeErrorMessage } from "@/services/http"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const { loading, authenticated } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [autoLoginTriggered, setAutoLoginTriggered] = useState(false)
  const [showDesktopLoginPanel, setShowDesktopLoginPanel] = useState(false)
  const [error, setError] = useState("")
  const loginPanelRef = useRef<HTMLDivElement | null>(null)
  const loginPanelInstanceRef = useRef<ww.WWLoginInstance | null>(null)

  const next = useMemo(() => {
    const raw = (searchParams.get("next") || "").trim()
    return raw || "/main/dashboard"
  }, [searchParams])
  const forceReauth = (searchParams.get("reauth") || "").trim() === "1"

  const isWeComWebview = useMemo(() => {
    const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent || ""
    return /wxwork/i.test(userAgent)
  }, [])

  const buildLoginSuccessURL = (code: string, state: string, source: string) => {
    const params = new URLSearchParams()
    params.set("code", code)
    if (state.trim() !== "") {
      params.set("state", state)
    }
    if (source.trim() !== "") {
      params.set("source", source)
    }
    if (next.trim() !== "") {
      params.set("next", next)
    }
    return `/api/v1/session/oauth/callback?${params.toString()}`
  }

  const mountLoginPanel = async () => {
    if (isWeComWebview || loading || (authenticated && !forceReauth)) {
      return
    }

    const host = loginPanelRef.current
    if (!host) {
      return
    }

    loginPanelInstanceRef.current?.unmount()
    loginPanelInstanceRef.current = null
    host.replaceChildren()

    try {
      const startURL = await getOAuthStartURL(next)
      const parsed = new URL(startURL, window.location.origin)
      const params = parsed.searchParams
      const loginType = params.get("login_type")?.trim() || "CorpApp"
      const appid = params.get("appid")?.trim() || ""
      const agentid = params.get("agentid")?.trim() || ""
      const redirectUri = (params.get("redirect_uri") || "").trim()
      const state = params.get("state")?.trim() || ""
      const source = "qr_connect"

      if (!appid || !redirectUri) {
        throw new Error("登录参数不完整，无法初始化企业微信登录组件。")
      }

      loginPanelInstanceRef.current = ww.createWWLoginPanel({
        el: host,
        params: {
          login_type: loginType === "ServiceApp" ? ww.WWLoginType.serviceApp : ww.WWLoginType.corpApp,
          appid,
          ...(agentid ? { agentid } : {}),
          redirect_uri: redirectUri,
          state,
          redirect_type: ww.WWLoginRedirectType.callback,
          panel_size: ww.WWLoginPanelSizeType.middle,
          lang: ww.WWLoginLangType.zh,
        },
        onCheckWeComLogin() {
          // 保留给快速登录面板使用，不额外干预。
        },
        onLoginSuccess({ code }) {
          const target = buildLoginSuccessURL(code, state, source)
          window.location.assign(target)
        },
        onLoginFail(nextError) {
          setError(nextError?.errMsg || nextError?.errCode ? `登录失败：${nextError.errMsg || nextError.errCode}` : "登录失败，请稍后再试。")
        },
      })
    } catch (err) {
      setError(normalizeErrorMessage(err))
    }
  }

  const startLogin = async () => {
    if (!isWeComWebview) {
      setError("")
      setShowDesktopLoginPanel(true)
      return
    }
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
    if (loading || (authenticated && !forceReauth) || submitting || autoLoginTriggered) {
      return
    }
    if (!isWeComWebview) {
      return
    }
    setAutoLoginTriggered(true)
    void startLogin()
  }, [authenticated, autoLoginTriggered, forceReauth, isWeComWebview, loading, submitting])

  useEffect(() => {
    if (isWeComWebview || !showDesktopLoginPanel || loading || (authenticated && !forceReauth)) {
      return
    }
    void mountLoginPanel()
    return () => {
      loginPanelInstanceRef.current?.unmount()
      loginPanelInstanceRef.current = null
    }
  }, [authenticated, forceReauth, isWeComWebview, loading, next, showDesktopLoginPanel])

  if (!loading && authenticated && !forceReauth) {
    return <Navigate to={next} replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card
        className={cn(
          "w-full border-gray-200 shadow-sm",
          !isWeComWebview && showDesktopLoginPanel ? "max-w-[560px]" : "max-w-md",
        )}
      >
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
          {!loading && isWeComWebview && autoLoginTriggered && submitting ? (
            <div className="flex items-center justify-center rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              检测到企业微信环境，正在自动跳转登录...
            </div>
          ) : null}
          {isWeComWebview || !showDesktopLoginPanel ? (
            <Button className="w-full" onClick={() => void startLogin()} disabled={submitting}>
              {isWeComWebview
                ? submitting
                  ? "正在跳转..."
                  : "使用企业微信登录"
                : "使用企业微信登录"}
            </Button>
          ) : null}
          {!isWeComWebview && showDesktopLoginPanel ? (
            <div
              ref={loginPanelRef}
              className="mx-auto h-[416px] w-[480px] shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white"
            />
          ) : null}
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
