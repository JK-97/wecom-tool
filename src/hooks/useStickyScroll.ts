import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

type StickyScrollOptions = {
  bottomThreshold?: number
  contentKey: string
  resetKey: string
}

type ScrollAnchor = {
  element: HTMLElement
  top: number
}

const DEFAULT_BOTTOM_THRESHOLD = 36
const PROGRAMMATIC_SCROLL_GUARD_MS = 120

function isNearBottom(element: HTMLElement, threshold: number) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold
}

function findVisibleAnchor(container: HTMLElement): ScrollAnchor | null {
  const items = Array.from(
    container.querySelectorAll<HTMLElement>("[data-sticky-scroll-item='true']"),
  )
  if (items.length === 0) return null
  const containerTop = container.getBoundingClientRect().top
  for (const item of items) {
    const rect = item.getBoundingClientRect()
    if (rect.bottom >= containerTop) {
      return { element: item, top: rect.top }
    }
  }
  const first = items[0]
  return first ? { element: first, top: first.getBoundingClientRect().top } : null
}

export function useStickyScroll({
  bottomThreshold = DEFAULT_BOTTOM_THRESHOLD,
  contentKey,
  resetKey,
}: StickyScrollOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const shouldStickToBottomRef = useRef(true)
  const pendingAnchorRef = useRef<ScrollAnchor | null>(null)
  const programmaticScrollUntilRef = useRef(0)
  const [isBrowsingHistory, setIsBrowsingHistory] = useState(false)
  const [showBackToLatest, setShowBackToLatest] = useState(false)

  const setBrowsingHistory = useCallback((nextValue: boolean) => {
    setIsBrowsingHistory((current) => (current === nextValue ? current : nextValue))
    setShowBackToLatest((current) => (current === nextValue ? current : nextValue))
  }, [])

  const markProgrammaticScroll = useCallback((durationMs = PROGRAMMATIC_SCROLL_GUARD_MS) => {
    if (typeof performance === "undefined") return
    programmaticScrollUntilRef.current = performance.now() + durationMs
  }, [])

  const scrollToLatest = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const container = containerRef.current
      if (!container) return
      shouldStickToBottomRef.current = true
      pendingAnchorRef.current = null
      markProgrammaticScroll(behavior === "smooth" ? 700 : PROGRAMMATIC_SCROLL_GUARD_MS)
      container.scrollTo({ top: container.scrollHeight, behavior })
      setBrowsingHistory(false)
    },
    [markProgrammaticScroll, setBrowsingHistory],
  )

  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    if (
      typeof performance !== "undefined" &&
      performance.now() < programmaticScrollUntilRef.current
    ) {
      return
    }
    const nearBottom = isNearBottom(container, bottomThreshold)
    shouldStickToBottomRef.current = nearBottom
    setBrowsingHistory(!nearBottom)
  }, [bottomThreshold, setBrowsingHistory])

  const preparePreserveVisibleAnchor = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    pendingAnchorRef.current = findVisibleAnchor(container)
  }, [])

  const cancelPreserveVisibleAnchor = useCallback(() => {
    pendingAnchorRef.current = null
  }, [])

  useLayoutEffect(() => {
    shouldStickToBottomRef.current = true
    pendingAnchorRef.current = null
    setBrowsingHistory(false)
    window.requestAnimationFrame(() => scrollToLatest())
  }, [resetKey, scrollToLatest, setBrowsingHistory])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const pendingAnchor = pendingAnchorRef.current
    if (pendingAnchor) {
      pendingAnchorRef.current = null
      const nextTop = pendingAnchor.element.getBoundingClientRect().top
      markProgrammaticScroll()
      container.scrollTop += nextTop - pendingAnchor.top
      return
    }
    if (!shouldStickToBottomRef.current) return
    window.requestAnimationFrame(() => scrollToLatest())
  }, [contentKey, markProgrammaticScroll, scrollToLatest])

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === "undefined") return
    const content = container.firstElementChild
    const observer = new ResizeObserver(() => {
      if (!shouldStickToBottomRef.current) return
      window.requestAnimationFrame(() => scrollToLatest())
    })
    observer.observe(container)
    if (content) observer.observe(content)
    return () => observer.disconnect()
  }, [contentKey, scrollToLatest])

  return {
    containerRef,
    handleScroll,
    cancelPreserveVisibleAnchor,
    isBrowsingHistory,
    preparePreserveVisibleAnchor,
    scrollToLatest,
    showBackToLatest,
  }
}
