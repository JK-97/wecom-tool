import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { APIRequestError } from "@/services/http"
import {
  getSession,
  logout as logoutRequest,
  type SessionCorp,
  type SessionUser,
} from "@/services/authService"

type AuthContextValue = {
  loading: boolean
  authenticated: boolean
  user: SessionUser | null
  corp: SessionCorp | null
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [corp, setCorp] = useState<SessionCorp | null>(null)

  const refresh = async () => {
    try {
      const session = await getSession()
      setAuthenticated(session.authenticated)
      setUser(session.user)
      setCorp(session.corp)
    } catch (error) {
      if (error instanceof APIRequestError && error.status === 401) {
        setAuthenticated(false)
        setUser(null)
        setCorp(null)
        return
      }
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    await logoutRequest()
    setAuthenticated(false)
    setUser(null)
    setCorp(null)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      authenticated,
      user,
      corp,
      refresh,
      logout,
    }),
    [authenticated, corp, loading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return value
}
