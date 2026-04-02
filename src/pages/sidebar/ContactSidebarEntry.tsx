import { useEffect, useMemo, useState } from "react"
import ContactSidebar from "./ContactSidebar"
import GroupSidebar from "./GroupSidebar"
import { normalizeJSSDKRuntimeError, resolveSidebarRuntimeContext } from "@/services/jssdkService"

type ContactMode = "single" | "group"
const RUNTIME_RESOLVE_RETRY_LIMIT = 3
const RUNTIME_RESOLVE_RETRY_DELAY_MS = 260

function resolveModeFromQuery(search: string): ContactMode | null {
  const params = new URLSearchParams(search)
  const mode = (params.get("mode") || params.get("chat_type") || "").trim().toLowerCase()
  const entry = (params.get("entry") || "").trim().toLowerCase()
  const chatID = (params.get("chat_id") || "").trim()
  const externalUserID = (params.get("external_userid") || "").trim()

  if (mode === "group") {
    return "group"
  }
  if (mode === "single") {
    return "single"
  }
  if (entry === "group_chat_tools" || chatID !== "") {
    return "group"
  }
  if (entry === "single_chat_tools" || entry === "contact_profile" || externalUserID !== "") {
    return "single"
  }
  return null
}

function syncQueryWithRuntime(input: {
  mode: ContactMode | "unknown"
  entry: string
  external_userid: string
  chat_id: string
}): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  const params = url.searchParams

  if (input.entry && !params.get("entry")) {
    params.set("entry", input.entry)
  }
  if (input.mode === "group") {
    params.set("mode", "group")
    if (input.chat_id) params.set("chat_id", input.chat_id)
    params.delete("external_userid")
  }
  if (input.mode === "single") {
    params.delete("mode")
    if (input.external_userid) params.set("external_userid", input.external_userid)
    params.delete("chat_id")
  }

  const next = `${url.pathname}?${params.toString()}${url.hash}`
  window.history.replaceState({}, "", next)
}

export default function ContactSidebarEntry() {
  const [resolvedMode, setResolvedMode] = useState<ContactMode | null>(null)

  const queryMode = useMemo(() => {
    if (typeof window === "undefined") {
      return null
    }
    return resolveModeFromQuery(window.location.search)
  }, [])

  useEffect(() => {
    let mounted = true
    const fallbackMode = queryMode || "single"
    const run = async () => {
      for (let attempt = 1; attempt <= RUNTIME_RESOLVE_RETRY_LIMIT; attempt += 1) {
        try {
          const runtime = await resolveSidebarRuntimeContext()
          if (!mounted) return
          if (runtime.mode === "single" || runtime.mode === "group") {
            syncQueryWithRuntime({
              mode: runtime.mode,
              entry: runtime.entry,
              external_userid: runtime.external_userid,
              chat_id: runtime.chat_id,
            })
            setResolvedMode(runtime.mode)
            return
          }
          setResolvedMode(fallbackMode)
          return
        } catch (error) {
          const mapped = normalizeJSSDKRuntimeError(error)
          const willRetry = mapped.code === "bridge_pending" && attempt < RUNTIME_RESOLVE_RETRY_LIMIT
          if (typeof console !== "undefined" && typeof console.warn === "function") {
            console.warn("[wecom-sidebar] resolve runtime failed", {
              attempt,
              will_retry: willRetry,
              code: mapped.code,
              message: mapped.message,
              detail: mapped.detail,
            })
          }
          if (willRetry) {
            await new Promise<void>((resolve) => {
              setTimeout(resolve, RUNTIME_RESOLVE_RETRY_DELAY_MS)
            })
            if (!mounted) return
            continue
          }
          if (!mounted) return
          setResolvedMode(fallbackMode)
          return
        }
      }
      if (mounted) {
        setResolvedMode(fallbackMode)
      }
    }
    void run()
    return () => {
      mounted = false
    }
  }, [queryMode])

  if (resolvedMode === null) {
    return null
  }
  if (resolvedMode === "group") {
    return <GroupSidebar />
  }
  return <ContactSidebar />
}
