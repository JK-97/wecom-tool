export class APIRequestError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = "APIRequestError"
    this.status = status
    this.payload = payload
  }
}

export type JSONRequestOptions = RequestInit & {
  skipAuthRedirect?: boolean
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim()
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000)
let redirectingToLogin = false

export async function requestJSON<T>(path: string, init?: JSONRequestOptions): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      signal: controller.signal,
    })
    const raw = await response.text()
    const payload = raw ? tryParseJSON(raw) : null
    if (!response.ok) {
      if (response.status === 401 && !init?.skipAuthRedirect) {
        redirectToLogin()
      }
      throw new APIRequestError(readErrorMessage(payload) || `Request failed with status ${response.status}`, response.status, payload)
    }
    return (payload as T) ?? ({} as T)
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function requestFormData<T>(path: string, body: FormData, init?: JSONRequestOptions): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...init,
      body,
      headers: {
        ...(init?.headers || {}),
      },
      signal: controller.signal,
    })
    const raw = await response.text()
    const payload = raw ? tryParseJSON(raw) : null
    if (!response.ok) {
      if (response.status === 401 && !init?.skipAuthRedirect) {
        redirectToLogin()
      }
      throw new APIRequestError(readErrorMessage(payload) || `Request failed with status ${response.status}`, response.status, payload)
    }
    return (payload as T) ?? ({} as T)
  } finally {
    window.clearTimeout(timeout)
  }
}

export function normalizeErrorMessage(error: unknown): string {
  if (error instanceof APIRequestError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "string" && error.trim() !== "") {
    return error
  }
  return "unknown error"
}

export function isAbortLikeError(error: unknown): boolean {
  if (!error) return false
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError"
  }
  if (error instanceof Error) {
    const name = (error.name || "").trim()
    const message = (error.message || "").trim().toLowerCase()
    return (
      name === "AbortError" ||
      message.includes("signal is aborted") ||
      message.includes("aborterror") ||
      message.includes("request was aborted")
    )
  }
  if (typeof error === "string") {
    const message = error.trim().toLowerCase()
    return message.includes("signal is aborted") || message.includes("aborterror")
  }
  return false
}

function redirectToLogin(): void {
  if (typeof window === "undefined" || redirectingToLogin) {
    return
  }
  const currentPath = window.location.pathname
  if (currentPath === "/login" || currentPath === "/auth/callback") {
    return
  }
  redirectingToLogin = true
  const next = `${window.location.pathname}${window.location.search}`
  window.location.assign(`/login?next=${encodeURIComponent(next)}`)
}

function tryParseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function readErrorMessage(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const row = payload as Record<string, unknown>
    const message = row.message
    if (typeof message === "string" && message.trim() !== "") {
      return message.trim()
    }
    const reason = row.reason
    if (typeof reason === "string" && reason.trim() !== "") {
      return reason.trim()
    }
  }
  if (typeof payload === "string" && payload.trim() !== "") {
    return payload.trim()
  }
  return ""
}
