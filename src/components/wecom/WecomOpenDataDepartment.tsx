import { createElement, useLayoutEffect, useMemo, useRef, useState } from "react"
import { bindOpenDataElement, ensureOpenDataReady, type OpenDataRuntime } from "@/services/openDataService"

type WecomOpenDataDepartmentProps = {
  departmentId: number | string
  corpId?: string
  fallback?: string
  className?: string
  hintClassName?: string
  showHint?: boolean
}

function readFallback(departmentId: string, fallback?: string): string {
  const text = (fallback || "").trim()
  if (text) return text
  return departmentId ? `部门 #${departmentId}` : "-"
}

export function WecomOpenDataDepartment({
  departmentId,
  corpId,
  fallback,
  className,
  hintClassName,
  showHint = false,
}: WecomOpenDataDepartmentProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [runtime, setRuntime] = useState<OpenDataRuntime | null>(null)
  const safeDepartmentId = `${departmentId ?? ""}`.trim()
  const safeCorpID = (corpId || "").trim()
  const fallbackText = useMemo(
    () => readFallback(safeDepartmentId, fallback),
    [fallback, safeDepartmentId],
  )

  useLayoutEffect(() => {
    let cancelled = false
    if (!safeDepartmentId) {
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
  }, [safeDepartmentId, safeCorpID])

  useLayoutEffect(() => {
    if (!runtime?.canUseOpenData) return
    bindOpenDataElement(ref.current)
  }, [runtime, safeDepartmentId, safeCorpID])

  if (!safeDepartmentId || !runtime?.canUseOpenData) {
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
        type: "departmentName",
        openid: safeDepartmentId,
        corpid: safeCorpID || undefined,
        className,
      })}
      {showHint && runtime.availability !== "ready" ? (
        <span className={hintClassName}>{runtime.reason || "当前环境暂不支持通讯录展示组件"}</span>
      ) : null}
    </span>
  )
}
