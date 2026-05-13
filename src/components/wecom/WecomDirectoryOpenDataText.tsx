import { createElement, useLayoutEffect, useRef, useState } from "react"
import { bindOpenDataElement, ensureOpenDataReady, type OpenDataRuntime } from "@/services/openDataService"

// 通讯录文本型 open-data 共享底座。
// 统一处理三段式渲染：
// 1. 数据值为空：直接 fallback。
// 2. 环境能力未决：先占位，避免先闪 fallback 再切 open-data。
// 3. 环境已知：
//    - 支持：渲染 ww-open-data
//    - 不支持：直接 fallback
type WecomDirectoryOpenDataTextProps = {
  value: string
  type: "userName" | "externalUserName" | "chatName" | "departmentName"
  corpId?: string
  fallbackText: string
  pendingMinWidthClassName: string
  pending?: boolean
  className?: string
  hintClassName?: string
  showHint?: boolean
}

export function WecomDirectoryOpenDataText({
  value,
  type,
  corpId,
  fallbackText,
  pendingMinWidthClassName,
  pending = false,
  className,
  hintClassName,
  showHint = false,
}: WecomDirectoryOpenDataTextProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [runtime, setRuntime] = useState<OpenDataRuntime | null>(null)
  const safeValue = value.trim()
  const safeCorpID = (corpId || "").trim()
  const runtimePending = Boolean(safeValue) && runtime === null
  const showPlaceholder = pending || runtimePending

  useLayoutEffect(() => {
    let cancelled = false
    if (!safeValue) {
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
  }, [safeCorpID, safeValue])

  useLayoutEffect(() => {
    if (!runtime?.canUseOpenData) return
    bindOpenDataElement(ref.current)
  }, [runtime, safeCorpID, safeValue])

  if (showPlaceholder) {
    return (
      <span className="inline-flex min-w-0 flex-col">
        <span className={className} aria-hidden="true">
          <span
            className={`inline-block h-[1em] animate-pulse rounded bg-gray-200 align-middle text-transparent ${pendingMinWidthClassName}`}
          >
            {fallbackText}
          </span>
        </span>
      </span>
    )
  }

  if (!safeValue) {
    return (
      <span className="inline-flex min-w-0 flex-col">
        <span className={className} title={fallbackText}>
          {fallbackText}
        </span>
        {showHint && runtime?.reason ? (
          <span className={hintClassName}>{runtime.reason}</span>
        ) : null}
      </span>
    )
  }

  if (!runtime?.canUseOpenData) {
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
        openid: safeValue,
        corpid: safeCorpID || undefined,
        className,
      })}
      {showHint && runtime.availability !== "ready" ? (
        <span className={hintClassName}>{runtime.reason || "当前环境暂不支持通讯录展示组件"}</span>
      ) : null}
    </span>
  )
}
