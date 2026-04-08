import { createElement, useLayoutEffect, useMemo, useRef, useState } from "react"
import { bindOpenDataElement, ensureOpenDataReady, type OpenDataRuntime } from "@/services/openDataService"

type WecomOpenDataNameProps = {
  userid: string
  corpId?: string
  fallback?: string
  className?: string
  hintClassName?: string
  showHint?: boolean
}

function readFallback(userid: string, fallback?: string): string {
  const text = (fallback || "").trim()
  if (text) return text
  return (userid || "").trim() || "-"
}

export function WecomOpenDataName({
  userid,
  corpId,
  fallback,
  className,
  hintClassName,
  showHint = false,
}: WecomOpenDataNameProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [runtime, setRuntime] = useState<OpenDataRuntime | null>(null)
  const safeUserID = (userid || "").trim()
  const safeCorpID = (corpId || "").trim()
  const fallbackText = useMemo(() => readFallback(safeUserID, fallback), [fallback, safeUserID])

  useLayoutEffect(() => {
    let cancelled = false
    if (!safeUserID) {
      setRuntime(null)
      return
    }
    void ensureOpenDataReady().then((result) => {
      if (cancelled) return
      setRuntime(result)
      if (result.canUseOpenData) {
        bindOpenDataElement(ref.current)
      }
    })
    return () => {
      cancelled = true
    }
  }, [safeUserID, safeCorpID])

  useLayoutEffect(() => {
    if (!runtime?.canUseOpenData) return
    bindOpenDataElement(ref.current)
  }, [runtime, safeUserID, safeCorpID])

  if (!safeUserID || !runtime?.canUseOpenData) {
    return (
      <span className="inline-flex min-w-0 flex-col">
        <span className={className} title={runtime?.reason || fallbackText}>
          {fallbackText}
        </span>
        {showHint && runtime?.reason ? (
          <span className={hintClassName}>{runtime.reason}</span>
        ) : null}
      </span>
    )
  }

  return (
    <span className="inline-flex min-w-0 flex-col">
      {createElement("ww-open-data", {
        ref,
        type: "userName",
        openid: safeUserID,
        corpid: safeCorpID || undefined,
        className,
      })}
      {showHint && runtime.availability !== "ready" ? (
        <span className={hintClassName}>{runtime.reason || "当前环境暂不支持通讯录展示组件"}</span>
      ) : null}
    </span>
  )
}
