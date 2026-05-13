import { useMemo } from "react"
import { WecomDirectoryOpenDataText } from "@/components/wecom/WecomDirectoryOpenDataText"

// 页面级通讯录部门名称展示组件。
// 这里仍然走通讯录展示组件语义，和会话模板 open-data 分开。
type WecomDirectoryOpenDataDepartmentProps = {
  departmentID: number | string
  corpId?: string
  fallback?: string
  pending?: boolean
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
  pending = false,
  className,
  hintClassName,
  showHint = false,
}: WecomDirectoryOpenDataDepartmentProps) {
  const safeDepartmentID = `${departmentID ?? ""}`.trim()
  const fallbackText = useMemo(
    () => readFallback(safeDepartmentID, fallback),
    [fallback, safeDepartmentID],
  )
  return (
    <WecomDirectoryOpenDataText
      value={safeDepartmentID}
      type="departmentName"
      corpId={corpId}
      fallbackText={fallbackText}
      pendingMinWidthClassName="min-w-[5em]"
      pending={pending}
      className={className}
      hintClassName={hintClassName}
      showHint={showHint}
    />
  )
}
