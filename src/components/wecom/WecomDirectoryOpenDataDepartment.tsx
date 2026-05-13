import { createElement, useLayoutEffect, useMemo, useRef, useState } from "react"
import { bindOpenDataElement, ensureOpenDataReady, type OpenDataRuntime } from "@/services/openDataService"

// 页面级通讯录部门名称展示组件。
// 这里仍然走通讯录展示组件语义，和会话模板 open-data 分开。
type WecomDirectoryOpenDataDepartmentProps = {
  departmentID: number | string
  corpId?: string
  fallback?: string
  className?: string
  hintClassName?: string
  showHint?: boolean
}

function readFallback(departmentID: string, fallback?: string): string {
  const text = (fallback || "").trim()
  if (text) return text
  return departmentID ? `部门 #${departmentID}` : "-"
}

export function WecomDirectoryOpenDataDepartment({
  departmentID,
  corpId,
  fallback,
  className,
  hintClassName,
  showHint = false,
}: WecomDirectoryOpenDataDepartmentProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [runtime, setRuntime] = useState<OpenDataRuntime | null>(null)
  const safeDepartmentID = `${departmentID ?? ""}`.trim()
  const safeCorpID = (corpId || "").trim()
  const fallbackText = useMemo(
    () => readFallback(safeDepartmentID, fallback),
    [fallback, safeDepartmentID],
  )

  useLayoutEffect(() => {
    let cancelled = false
    if (!safeDepartmentID) {
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
  }, [safeDepartmentID, safeCorpID])

  useLayoutEffect(() => {
    if (!runtime?.canUseOpenData) return
    bindOpenDataElement(ref.current)
  }, [runtime, safeDepartmentID, safeCorpID])

  if (!safeDepartmentID || !runtime?.canUseOpenData) {
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
        openid: safeDepartmentID,
        corpid: safeCorpID || undefined,
        className,
      })}
      {showHint && runtime.availability !== "ready" ? (
        <span className={hintClassName}>{runtime.reason || "当前环境暂不支持通讯录展示组件"}</span>
      ) : null}
    </span>
  )
}
