import { requestJSON } from "./http"

export type SessionUser = {
  userid: string
  openUserID: string
  corpID: string
  role: string
  isAppAdmin: boolean
  teamIDs: string[]
  departments: Array<{
    departmentID: number
    name: string
    parentID: number
    order: number
  }>
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

type StartResponse = {
  code?: number
  message?: string
  data?: {
    oauth_url?: string
    sso_url?: string
  }
}

export type SSOStartPanelConfig = {
  ssoURL: string
  loginType: "ServiceApp" | "CorpApp"
  appID: string
  redirectURI: string
  state: string
  panelSize: "middle" | "small"
  lang: "zh" | "en"
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

export async function getSSOStartConfig(next: string): Promise<SSOStartPanelConfig> {
  const url = await getSSOStartURL(next)
  return parseSSOStartConfig(url)
}

async function getSSOStartURL(next: string): Promise<string> {
  const params = new URLSearchParams()
  params.set("response", "json")
  if (next.trim() !== "") {
    params.set("next", next.trim())
  }
  const payload = await requestJSON<StartResponse>(`/api/v1/session/sso/start?${params.toString()}`, {
    skipAuthRedirect: true,
  })
  const url = (payload?.data?.sso_url || "").trim()
  if (url === "") {
    throw new Error("登录面板初始化失败")
  }

  return url
}

export async function getOAuthStartURL(next: string, mode: "webview_oauth"): Promise<string> {
  const params = new URLSearchParams()
  params.set("response", "json")
  params.set("mode", mode)
  if (next.trim() !== "") {
    params.set("next", next.trim())
  }
  const payload = await requestJSON<StartResponse>(`/api/v1/session/oauth/start?${params.toString()}`, {
    skipAuthRedirect: true,
  })
  const url = (payload?.data?.oauth_url || "").trim()
  if (url === "") {
    throw new Error("登录面板初始化失败")
  }

  return url
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
    role: readString(raw.role),
    isAppAdmin: raw.is_app_admin === true,
    teamIDs: Array.isArray(raw.team_ids) ? raw.team_ids.map((item) => readString(item)).filter(Boolean) : [],
    departments: Array.isArray(raw.departments)
      ? raw.departments
          .flatMap((item) => {
            const row = item && typeof item === "object" ? (item as Record<string, unknown>) : null
            if (!row) return []
            const department = {
              departmentID: readNumber(row.department_id),
              name: readString(row.name),
              parentID: readNumber(row.parent_id),
              order: readNumber(row.order),
            }
            return department.departmentID > 0 ? [department] : []
          })
      : [],
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

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function parseSSOStartConfig(ssoURL: string): SSOStartPanelConfig {
  const parsed = new URL(ssoURL)
  const loginType = normalizeLoginType(parsed.searchParams.get("login_type"))
  const appID = readString(parsed.searchParams.get("appid"))
  const redirectURI = readString(parsed.searchParams.get("redirect_uri"))
  const state = readString(parsed.searchParams.get("state"))
  if (!appID || !redirectURI || !state) {
    throw new Error("登录面板参数不完整")
  }
  return {
    ssoURL,
    loginType,
    appID,
    redirectURI,
    state,
    panelSize: "middle",
    lang: "zh",
  }
}

function normalizeLoginType(value: string | null): "ServiceApp" | "CorpApp" {
  switch ((value || "").trim()) {
    case "CorpApp":
      return "CorpApp"
    default:
      return "ServiceApp"
  }
}
