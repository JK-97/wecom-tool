import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { getSession } from "@/services/authService"
import { normalizeErrorMessage } from "@/services/http"

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const [message, setMessage] = useState("正在处理登录回调...")

  const next = useMemo(() => {
    const raw = (searchParams.get("next") || "").trim()
    return raw || "/main/dashboard"
  }, [searchParams])

  useEffect(() => {
    let mounted = true
    const code = (searchParams.get("code") || "").trim()
    const state = (searchParams.get("state") || "").trim()

    if (code !== "" && state !== "") {
      const params = new URLSearchParams(searchParams)
      if (!params.get("next")) {
        params.set("next", next)
      }
      window.location.replace(`/api/v1/session/oauth/callback?${params.toString()}`)
      return
    }

    void auth
      .refresh()
      .then(async () => {
        const session = await getSession()
        if (!mounted) {
          return
        }
        if (session.authenticated) {
          navigate(next, { replace: true })
          return
        }
        navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true })
      })
      .catch((error) => {
        if (!mounted) {
          return
        }
        setMessage(`登录回调失败：${normalizeErrorMessage(error)}`)
      })

    return () => {
      mounted = false
    }
  }, [auth, navigate, next, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 text-sm text-gray-600">
      {message}
    </div>
  )
}
