const ADMIN_SSO_CALLBACK_PATH = "/api/v1/session/sso/admin/callback"
const FALLBACK_NEXT_PATH = "/main/dashboard"
const INTERNAL_ORIGIN = "https://callfay.internal"

export type AdminSSORelay = {
  authCode: string
  next: string
  redirectURL: string
}

export function resolveAdminSSORelay(rawTarget: string, fallbackNext = FALLBACK_NEXT_PATH): AdminSSORelay | null {
  const target = sanitizeInternalTarget(rawTarget, fallbackNext)
  if (target === "") {
    return null
  }

  const parsed = new URL(target, INTERNAL_ORIGIN)
  const authCode = (parsed.searchParams.get("auth_code") || "").trim()
  if (authCode === "") {
    return null
  }

  parsed.searchParams.delete("auth_code")
  const next = sanitizeInternalTarget(`${parsed.pathname}${parsed.search}${parsed.hash}`, fallbackNext)
  return {
    authCode,
    next,
    redirectURL: buildAdminSSOCallbackURL(authCode, next),
  }
}

export function buildAdminSSOCallbackURL(authCode: string, next: string): string {
  const params = new URLSearchParams()
  params.set("auth_code", authCode.trim())
  params.set("next", sanitizeInternalTarget(next, FALLBACK_NEXT_PATH))
  return `${ADMIN_SSO_CALLBACK_PATH}?${params.toString()}`
}

function sanitizeInternalTarget(rawTarget: string, fallback: string): string {
  const trimmed = rawTarget.trim()
  if (trimmed === "") {
    return fallback
  }

  try {
    const parsed = new URL(trimmed, INTERNAL_ORIGIN)
    if (parsed.origin !== INTERNAL_ORIGIN || !parsed.pathname.startsWith("/")) {
      return fallback
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
