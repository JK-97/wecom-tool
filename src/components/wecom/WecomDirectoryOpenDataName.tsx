import { useMemo } from "react"
import { WecomDirectoryOpenDataText } from "@/components/wecom/WecomDirectoryOpenDataText"

// 页面级通讯录成员名称展示组件。
// 这里走的是通讯录展示组件语义，不是会话模板 open-data。
// 真正可渲染的身份只有 openID；其余值都只能作为 fallback 文本。
type WecomDirectoryOpenDataNameProps = {
  openID?: string
  type?: "userName" | "externalUserName" | "chatName"
  corpId?: string
  fallback?: string
  pending?: boolean
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
  pending = false,
  className,
  hintClassName,
  showHint = false,
}: WecomDirectoryOpenDataNameProps) {
  const safeOpenID = (openID || "").trim()
  const fallbackText = useMemo(
    () => readFallback(safeOpenID, fallback),
    [fallback, safeOpenID],
  )
  return (
    <WecomDirectoryOpenDataText
      value={safeOpenID}
      type={type}
      corpId={corpId}
      fallbackText={fallbackText}
      pendingMinWidthClassName="min-w-[6em]"
      pending={pending}
      className={className}
      hintClassName={hintClassName}
      showHint={showHint}
    />
  )
}
