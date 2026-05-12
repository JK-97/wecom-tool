import * as ww from "@wecom/jssdk"
import { useEffect, useMemo, useRef, useState } from "react"
import { Navigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { useAuth } from "@/context/AuthContext"
import {
  getOAuthStartURL,
  getSSOStartConfig,
  type SSOStartPanelConfig,
} from "@/services/authService"
import { normalizeErrorMessage } from "@/services/http"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

const WECOM_LOGIN_SDK_URL = "https://open.work.weixin.qq.com/wwopen/js/jwxwork-1.0.0.js"
const GATEWAY_SSO_CALLBACK_PATH = "/api/v1/session/sso/callback"

let loginSDKPromise: Promise<void> | null = null

function ensureWeComLoginSDK(): Promise<void> {
  if (loginSDKPromise) return loginSDKPromise
  loginSDKPromise = ensureScript(WECOM_LOGIN_SDK_URL)
  return loginSDKPromise
}

function ensureScript(src: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve()
  const existing = Array.from(document.scripts).find((script) => script.src === src)
  if (existing) {
    if (existing.dataset.loaded === "true") return Promise.resolve()
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error(`failed to load ${src}`)), { once: true })
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.referrerPolicy = "origin"
    script.dataset.wecomLoginSdk = src
    script.addEventListener("load", () => {
      script.dataset.loaded = "true"
      resolve()
    }, { once: true })
    script.addEventListener("error", () => reject(new Error(`failed to load ${src}`)), { once: true })
    document.head.appendChild(script)
  })
}

function normalizeLoginPanelError(error: unknown): string {
  if (error && typeof error === "object") {
    const row = error as Record<string, unknown>
    const errMsg = typeof row.errMsg === "string" ? row.errMsg.trim() : ""
    if (errMsg) return errMsg
    const errCode = typeof row.errCode === "number" && Number.isFinite(row.errCode) ? row.errCode : 0
    if (errCode) return `企业微信登录失败：${errCode}`
  }
  return normalizeErrorMessage(error)
}

function resolveGatewayCallbackURL(rawRedirectURI: string): URL {
  const fallback = new URL(GATEWAY_SSO_CALLBACK_PATH, window.location.origin)
  try {
    const parsed = new URL(rawRedirectURI, window.location.origin)
    if (parsed.origin !== window.location.origin) {
      return fallback
    }
    parsed.pathname = GATEWAY_SSO_CALLBACK_PATH
    parsed.search = ""
    parsed.hash = ""
    return parsed
  } catch {
    return fallback
  }
}

function buildGatewayCallbackURL(rawRedirectURI: string, code: string, state: string): string {
  const callbackURL = resolveGatewayCallbackURL(rawRedirectURI)
  callbackURL.searchParams.set("code", code)
  callbackURL.searchParams.set("state", state)
  return callbackURL.toString()
}

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const { loading, authenticated } = useAuth()
  const panelHostRef = useRef<HTMLDivElement | null>(null)
  const panelInstanceRef = useRef<ww.WWLoginInstance | null>(null)
  const [panelConfig, setPanelConfig] = useState<SSOStartPanelConfig | null>(null)
  const [panelLoading, setPanelLoading] = useState(false)
  const [panelReady, setPanelReady] = useState(false)
  const [retryToken, setRetryToken] = useState(0)
  const [webviewRedirecting, setWebviewRedirecting] = useState(false)
  const [error, setError] = useState("")

  const next = useMemo(() => {
    const raw = (searchParams.get("next") || "").trim()
    return raw || "/main/dashboard"
  }, [searchParams])
  const forceReauth = (searchParams.get("reauth") || "").trim() === "1"
  const urlError = useMemo(() => (searchParams.get("error") || "").trim(), [searchParams])
  const isWeComWebview = useMemo(() => {
    const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent || ""
    return /wxwork/i.test(userAgent)
  }, [])

  useEffect(() => {
    if (!isWeComWebview || loading || (authenticated && !forceReauth)) {
      return
    }

    let cancelled = false
    setWebviewRedirecting(true)
    setError("")

    void getOAuthStartURL(next, "webview_oauth")
      .then((url) => {
        if (cancelled) return
        window.location.assign(url)
      })
      .catch((err) => {
        if (cancelled) return
        setError(normalizeErrorMessage(err))
        setWebviewRedirecting(false)
      })

    return () => {
      cancelled = true
    }
  }, [authenticated, forceReauth, isWeComWebview, loading, next, retryToken])

  useEffect(() => {
    if (isWeComWebview || loading || (authenticated && !forceReauth)) {
      return
    }

    let cancelled = false
    setPanelLoading(true)
    setPanelReady(false)
    setPanelConfig(null)
    setError("")

    void getSSOStartConfig(next)
      .then((config) => {
        if (cancelled) return
        setPanelConfig(config)
      })
      .catch((err) => {
        if (cancelled) return
        setError(normalizeErrorMessage(err))
      })
      .finally(() => {
        if (cancelled) return
        setPanelLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authenticated, forceReauth, isWeComWebview, loading, next, retryToken])

  useEffect(() => {
    if (isWeComWebview || loading || (authenticated && !forceReauth) || !panelConfig) {
      return
    }
    const host = panelHostRef.current
    if (!host) {
      return
    }

    let cancelled = false
    const clearPanel = () => {
      panelInstanceRef.current?.unmount()
      panelInstanceRef.current = null
      panelHostRef.current?.replaceChildren()
    }

    clearPanel()
    setPanelReady(false)

    void (async () => {
      try {
        await ensureWeComLoginSDK()
        if (cancelled) return
        if (typeof ww.createWWLoginPanel !== "function") {
          throw new Error("企业微信登录组件不可用")
        }

        // BUGFIX: 会话展示组件要求 Web 登录组件和 open-data 页面同域。
        // 因此登录面板必须挂载在当前环境域名下，并把 code 回交给本环境 gateway。
        const redirectURI = resolveGatewayCallbackURL(panelConfig.redirectURI).toString()
        panelInstanceRef.current = ww.createWWLoginPanel({
          el: host,
          params: {
            login_type: panelConfig.loginType === "CorpApp" ? ww.WWLoginType.corpApp : ww.WWLoginType.serviceApp,
            appid: panelConfig.appID,
            redirect_uri: redirectURI,
            state: panelConfig.state,
            redirect_type: ww.WWLoginRedirectType.callback,
            panel_size: panelConfig.panelSize === "small" ? ww.WWLoginPanelSizeType.small : ww.WWLoginPanelSizeType.middle,
            lang: panelConfig.lang === "en" ? ww.WWLoginLangType.en : ww.WWLoginLangType.zh,
          },
          onLoginSuccess({ code }) {
            const safeCode = (code || "").trim()
            if (!safeCode) {
              setError("企业微信登录回调缺少 code")
              return
            }
            window.location.replace(buildGatewayCallbackURL(redirectURI, safeCode, panelConfig.state))
          },
          onLoginFail(err) {
            if (cancelled) return
            setPanelReady(false)
            setError(normalizeLoginPanelError(err))
          },
        })
        setPanelReady(true)
      } catch (err) {
        if (cancelled) return
        setError(normalizeLoginPanelError(err))
        setPanelReady(false)
      }
    })()

    return () => {
      cancelled = true
      clearPanel()
    }
  }, [authenticated, forceReauth, isWeComWebview, loading, panelConfig])

  if (!loading && authenticated && !forceReauth) {
    return <Navigate to={next} replace />
  }

  const visibleError = error || urlError
  const showLoading = loading || webviewRedirecting || panelLoading || (Boolean(panelConfig) && !panelReady && !visibleError)

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card
        className={cn(
          "w-full border-gray-200 shadow-sm",
          "max-w-[560px]",
        )}
      >
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl font-semibold text-gray-900">登录企业微信工作台</CardTitle>
          <p className="text-sm text-gray-500">
            统一登录后可访问客服侧边栏与主站工作台。
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {showLoading ? (
            <div className="flex items-center justify-center rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              {isWeComWebview ? "检测到企业微信环境，正在自动跳转登录..." : "正在加载企业微信登录面板..."}
            </div>
          ) : null}

          {!isWeComWebview ? (
            <div className="mx-auto flex min-h-[416px] w-full max-w-[480px] items-center justify-center overflow-hidden rounded-md bg-white">
              <div
                ref={panelHostRef}
                className={cn(
                  "flex min-h-[416px] w-full items-center justify-center transition-opacity",
                  panelReady ? "opacity-100" : "opacity-50",
                )}
              />
            </div>
          ) : null}

          {visibleError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {visibleError}
            </div>
          ) : null}
          {visibleError ? (
            <Button className="w-full" variant="outline" onClick={() => setRetryToken((value) => value + 1)}>
              {isWeComWebview ? "重新跳转登录" : "重新加载登录面板"}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
