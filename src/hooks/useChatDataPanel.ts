import { useCallback, useEffect, useRef, useState } from "react"
import { getChatDataPanel, initChatDataBootstrap, type ChatDataPanelView } from "@/services/chatdataService"
import { normalizeErrorMessage } from "@/services/http"

export type ChatDataRefreshPolicy = "manual" | "auto_5s"

const CHATDATA_REFRESH_POLICY_STORAGE_KEY = "chatdata.refresh-policy.v1"

function readRefreshPolicy(): ChatDataRefreshPolicy {
  if (typeof window === "undefined") return "auto_5s"
  const raw = window.localStorage.getItem(CHATDATA_REFRESH_POLICY_STORAGE_KEY)
  return raw === "manual" ? "manual" : "auto_5s"
}

export function useChatDataPanel(params: {
  target_type: "external_userid" | "chat_id"
  target_id: string
  surface: "customer_360" | "group_detail"
  autoBootstrap?: boolean
}) {
  const [panel, setPanel] = useState<ChatDataPanelView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [bootstrapping, setBootstrapping] = useState(false)
  const [refreshPolicy, setRefreshPolicy] = useState<ChatDataRefreshPolicy>(() => readRefreshPolicy())
  const progressTimerRef = useRef<number | null>(null)
  const intervalTimerRef = useRef<number | null>(null)
  const bootstrappedTargetRef = useRef("")

  const clearTimers = () => {
    if (progressTimerRef.current !== null) {
      window.clearTimeout(progressTimerRef.current)
      progressTimerRef.current = null
    }
    if (intervalTimerRef.current !== null) {
      window.clearInterval(intervalTimerRef.current)
      intervalTimerRef.current = null
    }
  }

  const load = useCallback(async () => {
    const targetId = (params.target_id || "").trim()
    if (!targetId) {
      setPanel(null)
      setError("")
      return
    }
    try {
      setLoading(true)
      const next = await getChatDataPanel({ target_id: targetId, target_type: params.target_type })
      setPanel(next)
      setError("")
    } catch (err) {
      setPanel(null)
      setError(normalizeErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [params.target_id, params.target_type])

  const bootstrap = useCallback(async (reason: string, force = true) => {
    const targetId = (params.target_id || "").trim()
    if (!targetId) return
    try {
      setBootstrapping(true)
      await initChatDataBootstrap({
        surface: params.surface,
        surface_id: targetId,
        reason,
        force,
      })
      bootstrappedTargetRef.current = `${params.surface}:${targetId}`
      await load()
    } catch (err) {
      setError(normalizeErrorMessage(err))
    } finally {
      setBootstrapping(false)
    }
  }, [load, params.surface, params.target_id])

  useEffect(() => {
    bootstrappedTargetRef.current = ""
    void load()
    return clearTimers
  }, [load, params.target_id, params.target_type])

  useEffect(() => {
    const targetId = (params.target_id || "").trim()
    const capability = (panel?.capability_status || "").trim()
    const initState = (panel?.init_state || "").trim()
    const hasMessages = Boolean(panel?.has_messages)
    const hasCursor = Boolean(panel?.has_cursor)
    const autoBootstrap = params.autoBootstrap !== false
    const bootKey = `${params.surface}:${targetId}`
    if (!autoBootstrap || !targetId || capability !== "ready") return
    if (bootstrapping || initState === "queued" || initState === "running" || initState === "done") return
    if (hasMessages || hasCursor) return
    if (bootstrappedTargetRef.current === bootKey) return
    void bootstrap("detail_opened", true)
  }, [
    bootstrap,
    bootstrapping,
    panel?.capability_status,
    panel?.has_cursor,
    panel?.has_messages,
    panel?.init_state,
    params.autoBootstrap,
    params.surface,
    params.target_id,
  ])

  useEffect(() => {
    const capability = (panel?.capability_status || "").trim()
    const state = (panel?.init_state || "").trim()
    const syncMode = (panel?.sync_mode || "").trim()
    if (state !== "queued" && state !== "running") return
    if (capability && capability !== "ready") return
    if (syncMode === "idle") return
    if (progressTimerRef.current !== null) {
      window.clearTimeout(progressTimerRef.current)
    }
    progressTimerRef.current = window.setTimeout(() => {
      void load()
    }, 3000)
  }, [load, panel?.capability_status, panel?.init_state, panel?.messages, panel?.sync_mode])

  useEffect(() => {
    const targetId = (params.target_id || "").trim()
    if (!targetId || refreshPolicy !== "auto_5s") return
    if (intervalTimerRef.current !== null) {
      window.clearInterval(intervalTimerRef.current)
    }
    intervalTimerRef.current = window.setInterval(() => {
      void load()
    }, 5000)
    return () => {
      if (intervalTimerRef.current !== null) {
        window.clearInterval(intervalTimerRef.current)
        intervalTimerRef.current = null
      }
    }
  }, [load, params.target_id, refreshPolicy])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(CHATDATA_REFRESH_POLICY_STORAGE_KEY, refreshPolicy)
  }, [refreshPolicy])

  return {
    panel,
    loading,
    error,
    bootstrapping,
    refreshPolicy,
    setRefreshPolicy,
    reload: load,
    bootstrap,
  }
}
