import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  tags.forEach((tag) => {
    const value = (tag || "").trim()
    if (!value || seen.has(value)) return
    seen.add(value)
    out.push(value)
  })
  return out
}

export function CustomerTagList({
  tags,
  maxVisible = 4,
  emptyText = "-",
  className,
}: {
  tags: string[]
  maxVisible?: number
  emptyText?: string
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const normalizedTags = useMemo(() => normalizeTags(tags), [tags])
  const safeMaxVisible = Math.max(1, maxVisible)
  const visibleTags = expanded ? normalizedTags : normalizedTags.slice(0, safeMaxVisible)
  const hiddenCount = Math.max(0, normalizedTags.length - visibleTags.length)

  if (normalizedTags.length === 0) {
    return <span className="text-xs text-gray-400">{emptyText}</span>
  }

  return (
    <div className={cn("flex max-w-[260px] flex-wrap items-center gap-1.5", className)}>
      {visibleTags.map((item) => (
        <Badge
          key={item}
          variant="secondary"
          className="max-w-[120px] truncate bg-gray-100 px-1.5 py-0 text-[10px] font-medium text-gray-600"
          title={item}
        >
          {item}
        </Badge>
      ))}
      {hiddenCount > 0 || expanded ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setExpanded((value) => !value)
          }}
        >
          {expanded ? "收起" : `更多 ${hiddenCount} 个`}
        </Button>
      ) : null}
    </div>
  )
}
