import { createElement, useLayoutEffect, useMemo, useRef, useState } from "react"
import { bindOpenDataElement, ensureOpenDataReady, type OpenDataRuntime } from "@/services/openDataService"

// 通讯录名称展示走页面级 ww-open-data 直绑。
// userid 仅用于 fallback 展示；真正的 open-data 身份必须由后端直接返回 openid。
type WecomOpenDataNameProps = {
  userid?: string
  openid?: string
  type?: "userName" | "externalUserName" | "chatName"
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
  openid,
  type = "userName",
  corpId,
  fallback,
  className,
  hintClassName,
  showHint = false,
}: WecomOpenDataNameProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [runtime, setRuntime] = useState<OpenDataRuntime | null>(null)
  const safeUserID = (userid || "").trim()
  const safeOpenID = (openid || "").trim()
  const safeCorpID = (corpId || "").trim()
  const fallbackText = useMemo(
    () => readFallback(safeUserID || safeOpenID, fallback),
    [fallback, safeOpenID, safeUserID],
  )

  useLayoutEffect(() => {
    let cancelled = false
    if (!safeOpenID) {
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
  }, [safeOpenID, safeCorpID])

  useLayoutEffect(() => {
    if (!runtime?.canUseOpenData) return
    bindOpenDataElement(ref.current)
  }, [runtime, safeOpenID, safeCorpID])

  if (!safeOpenID || !runtime?.canUseOpenData) {
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
        type,
        openid: safeOpenID,
        corpid: safeCorpID || undefined,
        className,
      })}
      {showHint && runtime.availability !== "ready" ? (
        <span className={hintClassName}>{runtime.reason || "当前环境暂不支持通讯录展示组件"}</span>
      ) : null}
    </span>
  )
}
