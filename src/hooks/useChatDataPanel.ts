import { useCallback, useEffect, useRef, useState } from "react"
import { getChatDataPanel, initChatDataBootstrap, type ChatDataPanelView } from "@/services/chatdataService"
import { normalizeErrorMessage } from "@/services/http"

export function useChatDataPanel(params: {
  target_type: "external_userid" | "chat_id"
  target_id: string
  surface: "customer_360" | "group_detail"
}) {
  const [panel, setPanel] = useState<ChatDataPanelView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [bootstrapping, setBootstrapping] = useState(false)
  const timerRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    const targetId = (params.target_id || "").trim()
    if (!targetId) {
      setPanel(null)
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
      await load()
    } catch (err) {
      setError(normalizeErrorMessage(err))
    } finally {
      setBootstrapping(false)
    }
  }, [load, params.surface, params.target_id])

  useEffect(() => {
    void load()
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [load])

  useEffect(() => {
    const state = (panel?.init_state || "").trim()
    if (state === "queued" || state === "running") {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
      timerRef.current = window.setTimeout(() => {
        void load()
      }, 3000)
    }
  }, [load, panel?.init_state])

  return {
    panel,
    loading,
    error,
    bootstrapping,
    reload: load,
    bootstrap,
  }
}
