import * as React from "react"
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type FeedbackKind = "info" | "success" | "warning" | "error"

type FeedbackItem = {
  id: number
  kind: FeedbackKind
  message: string
}

type ShowFeedbackInput =
  | string
  | {
      message: string
      kind?: FeedbackKind
    }

type PageFeedbackContextValue = {
  showFeedback: (input: ShowFeedbackInput, kind?: FeedbackKind) => void
  clearFeedback: () => void
}

const PageFeedbackContext = React.createContext<PageFeedbackContextValue | null>(
  null,
)

const feedbackTone: Record<FeedbackKind, string> = {
  success: "border-green-100 bg-green-50 text-green-800",
  warning: "border-orange-100 bg-orange-50 text-orange-800",
  error: "border-red-100 bg-red-50 text-red-800",
  info: "border-blue-100 bg-blue-50 text-blue-800",
}

const feedbackIcon: Record<FeedbackKind, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
}

export function PageFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<FeedbackItem[]>([])
  const nextIDRef = React.useRef(1)
  const timerRefs = React.useRef<Map<number, number>>(new Map())

  const dismiss = React.useCallback((id: number) => {
    const timer = timerRefs.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timerRefs.current.delete(id)
    }
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const showFeedback = React.useCallback(
    (input: ShowFeedbackInput, fallbackKind: FeedbackKind = "info") => {
      const message = typeof input === "string" ? input.trim() : input.message.trim()
      if (!message) return
      const kind = typeof input === "string" ? fallbackKind : input.kind || fallbackKind
      const id = nextIDRef.current++
      setItems((current) => {
        const withoutDuplicates = current.filter((item) => {
          const duplicate = item.kind === kind && item.message === message
          if (duplicate) {
            const duplicateTimer = timerRefs.current.get(item.id)
            if (duplicateTimer) {
              window.clearTimeout(duplicateTimer)
              timerRefs.current.delete(item.id)
            }
          }
          return !duplicate
        })
        return [...withoutDuplicates.slice(-2), { id, kind, message }]
      })
      const timeout = kind === "error" || kind === "warning" ? 6000 : 3500
      timerRefs.current.set(id, window.setTimeout(() => dismiss(id), timeout))
    },
    [dismiss],
  )

  const clearFeedback = React.useCallback(() => {
    timerRefs.current.forEach((timer) => window.clearTimeout(timer))
    timerRefs.current.clear()
    setItems([])
  }, [])

  React.useEffect(() => clearFeedback, [clearFeedback])

  return (
    <PageFeedbackContext.Provider value={{ showFeedback, clearFeedback }}>
      {children}
      <div className="pointer-events-none fixed right-6 top-6 z-[70] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2">
        {items.map((item) => {
          const Icon = feedbackIcon[item.kind]
          return (
            <div
              key={item.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm shadow-lg",
                feedbackTone[item.kind],
              )}
              aria-live={item.kind === "error" || item.kind === "warning" ? "assertive" : "polite"}
              role={item.kind === "error" || item.kind === "warning" ? "alert" : "status"}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1 leading-5">{item.message}</div>
              <button
                type="button"
                className="rounded p-0.5 opacity-60 hover:bg-white/60 hover:opacity-100"
                aria-label="关闭提示"
                onClick={() => dismiss(item.id)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </PageFeedbackContext.Provider>
  )
}

export function usePageFeedback() {
  const context = React.useContext(PageFeedbackContext)
  if (!context) {
    throw new Error("usePageFeedback must be used within PageFeedbackProvider")
  }
  return context
}

export function InlineFeedbackSlot({
  message,
  kind = "info",
  reserve = true,
  className,
}: {
  message?: string
  kind?: FeedbackKind
  reserve?: boolean
  className?: string
}) {
  if (!message) {
    return reserve ? <div className={cn("min-h-[34px]", className)} aria-hidden="true" /> : null
  }
  const Icon = feedbackIcon[kind]
  return (
    <div
      className={cn(
        "flex min-h-[34px] items-start gap-2 rounded-md border px-3 py-2 text-xs",
        feedbackTone[kind],
        className,
      )}
      role={kind === "error" || kind === "warning" ? "alert" : "status"}
      aria-live={kind === "error" || kind === "warning" ? "assertive" : "polite"}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
    </div>
  )
}
