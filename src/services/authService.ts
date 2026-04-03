import { requestJSON } from "./http"

export type SessionUser = {
  userid: string
  openUserID: string
  corpID: string
  name: string
  displayName: string
  wecomName: string
  avatar: string
  avatarURL: string
  role: string
  isAppAdmin: boolean
  teamIDs: string[]
}

export type SessionCorp = {
  id: string
  name: string
}

export type SessionSnapshot = {
  authenticated: boolean
  user: SessionUser | null
  corp: SessionCorp | null
}

type SessionResponse = {
  code?: number
  message?: string
  data?: {
    authenticated?: boolean
    user?: Record<string, unknown>
    corp?: Record<string, unknown>
  }
}

type OAuthStartResponse = {
  code?: number
  message?: string
  data?: {
    oauth_url?: string
  }
}

export async function getSession(): Promise<SessionSnapshot> {
  const payload = await requestJSON<SessionResponse>("/api/v1/session/me", {
    skipAuthRedirect: true,
  })
  const data = payload?.data
  return {
    authenticated: data?.authenticated === true,
    user: mapSessionUser(data?.user),
    corp: mapSessionCorp(data?.corp),
  }
}

export async function getOAuthStartURL(next: string): Promise<string> {
  const params = new URLSearchParams()
  params.set("response", "json")
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent || ""
  const isWeComWebview = /wxwork/i.test(userAgent)
  if (isWeComWebview) {
    params.set("mode", "webview_oauth")
  }
  if (next.trim() !== "") {
    params.set("next", next.trim())
  }
  const payload = await requestJSON<OAuthStartResponse>(`/api/v1/session/oauth/start?${params.toString()}`, {
    skipAuthRedirect: true,
  })
  const url = (payload?.data?.oauth_url || "").trim()
  if (url !== "") {
    return url
  }
  const fallback = new URLSearchParams()
  if (isWeComWebview) {
    fallback.set("mode", "webview_oauth")
  }
  fallback.set("next", next || "/main/dashboard")
  return `/api/v1/session/oauth/start?${fallback.toString()}`
}

export async function logout(): Promise<void> {
  await requestJSON("/api/v1/session/logout", {
    method: "POST",
    skipAuthRedirect: true,
  })
}

function mapSessionUser(raw?: Record<string, unknown>): SessionUser | null {
  if (!raw) {
    return null
  }
  const userID = readString(raw.userid)
  if (userID === "") {
    return null
  }
  return {
    userid: userID,
    openUserID: readString(raw.open_userid),
    corpID: readString(raw.corp_id),
    name: readString(raw.name),
    displayName: readString(raw.display_name),
    wecomName: readString(raw.wecom_name),
    avatar: readString(raw.avatar),
    avatarURL: readString(raw.avatar_url),
    role: readString(raw.role),
    isAppAdmin: raw.is_app_admin === true,
    teamIDs: Array.isArray(raw.team_ids) ? raw.team_ids.map((item) => readString(item)).filter(Boolean) : [],
  }
}

function mapSessionCorp(raw?: Record<string, unknown>): SessionCorp | null {
  if (!raw) {
    return null
  }
  const corpID = readString(raw.id)
  if (corpID === "") {
    return null
  }
  return {
    id: corpID,
    name: readString(raw.name),
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}
