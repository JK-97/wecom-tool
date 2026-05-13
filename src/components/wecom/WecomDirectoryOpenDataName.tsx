import { createElement, useLayoutEffect, useMemo, useRef, useState } from "react"
import { bindOpenDataElement, ensureOpenDataReady, type OpenDataRuntime } from "@/services/openDataService"

// 页面级通讯录成员名称展示组件。
// 这里走的是通讯录展示组件语义，不是会话模板 open-data。
// 真正可渲染的身份只有 openID；其余值都只能作为 fallback 文本。
type WecomDirectoryOpenDataNameProps = {
  openID?: string
  type?: "userName" | "externalUserName" | "chatName"
  corpId?: string
  fallback?: string
  className?: string
  hintClassName?: string
  showHint?: boolean
}

function readFallback(openID: string, fallback?: string): string {
  const text = (fallback || "").trim()
  if (text) return text
  return (openID || "").trim() || "-"
}

export function WecomDirectoryOpenDataName({
  openID,
  type = "userName",
  corpId,
  fallback,
  className,
  hintClassName,
  showHint = false,
}: WecomDirectoryOpenDataNameProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [runtime, setRuntime] = useState<OpenDataRuntime | null>(null)
  const safeOpenID = (openID || "").trim()
  const safeCorpID = (corpId || "").trim()
  const fallbackText = useMemo(
    () => readFallback(safeOpenID, fallback),
    [fallback, safeOpenID],
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
