import { useCallback, useEffect, useRef, useState } from "react"
import { getChatDataPanel, initChatDataBootstrap, type ChatDataPanelView } from "@/services/chatdataService"
import { normalizeErrorMessage } from "@/services/http"

export function useChatDataPanel(params: {
  target_type: "external_userid" | "chat_id"
  target_id: string
  surface: "customer_360" | "group_detail"
  autoBootstrap?: boolean
  refreshIntervalMs?: number
}) {
  const [panel, setPanel] = useState<ChatDataPanelView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [bootstrapping, setBootstrapping] = useState(false)
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
    const state = (panel?.init_state || "").trim()
    if (state !== "queued" && state !== "running") return
    if (progressTimerRef.current !== null) {
      window.clearTimeout(progressTimerRef.current)
    }
    progressTimerRef.current = window.setTimeout(() => {
      void load()
    }, 3000)
  }, [load, panel?.init_state, panel?.messages])

  useEffect(() => {
    const targetId = (params.target_id || "").trim()
    const refreshIntervalMs = Math.max(8000, Number(params.refreshIntervalMs || 15000))
    if (!targetId) return
    if (intervalTimerRef.current !== null) {
      window.clearInterval(intervalTimerRef.current)
    }
    intervalTimerRef.current = window.setInterval(() => {
      void load()
    }, refreshIntervalMs)
    return () => {
      if (intervalTimerRef.current !== null) {
        window.clearInterval(intervalTimerRef.current)
        intervalTimerRef.current = null
      }
    }
  }, [load, params.refreshIntervalMs, params.target_id])

  return {
    panel,
    loading,
    error,
    bootstrapping,
    reload: load,
    bootstrap,
  }
}
