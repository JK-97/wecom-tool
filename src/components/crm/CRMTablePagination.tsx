import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

function buildPaginationPages(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }
  if (currentPage <= 3) {
    return [1, 2, 3, "ellipsis", totalPages]
  }
  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages]
  }
  return [1, "ellipsis", currentPage, "ellipsis", totalPages]
}

export function CRMTablePagination({
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  startIndex,
  endIndex,
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  currentPage: number
  totalPages: number
  pageSize: number
  pageSizeOptions: number[]
  startIndex: number
  endIndex: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  className?: string
}) {
  const safeCurrentPage = Math.max(1, currentPage || 1)
  const safeTotalPages = Math.max(1, totalPages || 1)
  const pages = buildPaginationPages(safeCurrentPage, safeTotalPages)

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
        <span>
          显示 {startIndex} 到 {endIndex} 条，共 {total} 条
        </span>
        <label className="inline-flex items-center gap-2">
          <span>每页</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="每页显示条数"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span>条</span>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={safeCurrentPage <= 1}
          onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((item, index) => {
          if (item === "ellipsis") {
            return (
              <span key={`ellipsis-${index}`} className="px-1 text-gray-400">
                ...
              </span>
            )
          }
          const isCurrent = item === safeCurrentPage
          return (
            <Button
              key={`page-${item}`}
              variant="outline"
              size="sm"
              className={cn("h-8 w-8 p-0", isCurrent ? "border-blue-200 bg-blue-50 text-blue-600" : "")}
              onClick={() => onPageChange(item)}
              aria-current={isCurrent ? "page" : undefined}
            >
              {item}
            </Button>
          )
        })}
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={safeCurrentPage >= safeTotalPages}
          onClick={() => onPageChange(Math.min(safeTotalPages, safeCurrentPage + 1))}
          aria-label="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
