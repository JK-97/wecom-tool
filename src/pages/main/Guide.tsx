import React, { useEffect, useMemo, useRef, useState } from "react"
import Markdown from "react-markdown"
import { Link } from "react-router-dom"
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  HelpCircle,
  Info,
  MessageSquare,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { usePageFeedback } from "@/components/ui/PageFeedback"
import { cn } from "@/lib/utils"
import { GUIDE_DOCS, type GuideDoc } from "@/content/guide/manifest"

type TocItem = {
  id: string
  text: string
  level: 2 | 3
}

const categoryOrder: GuideDoc["category"][] = ["快速开始", "业务配置", "日常使用"]

function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function readHashDocID() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, "")).trim()
  if (!hash) return ""
  const exactDoc = GUIDE_DOCS.find((doc) => doc.id === hash)
  if (exactDoc) return exactDoc.id
  const headingDoc = GUIDE_DOCS.find((doc) => hash.startsWith(`${doc.id}-`))
  return headingDoc?.id || ""
}

function buildDocURL(docID: string) {
  return `${window.location.origin}${window.location.pathname}${window.location.search}#${docID}`
}

function extractHeadings(doc: GuideDoc): TocItem[] {
  return (doc.content.match(/^#{2,3}\s+(.+)$/gm) || []).map((line) => {
    const marker = line.match(/^#{2,3}/)?.[0] || "##"
    const text = line.replace(/^#{2,3}\s+/, "").trim()
    const level: TocItem["level"] = marker.length === 3 ? 3 : 2
    return {
      id: `${doc.id}-${slugify(text)}`,
      text,
      level,
    }
  })
}

function stripMarkdown(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function groupDocs(docs: GuideDoc[]) {
  return categoryOrder
    .map((category) => ({
      category,
      docs: docs.filter((doc) => doc.category === category),
    }))
    .filter((group) => group.docs.length > 0)
}

function getRelatedDocs(doc: GuideDoc) {
  return doc.relatedDocIds
    .map((id) => GUIDE_DOCS.find((item) => item.id === id))
    .filter((item): item is GuideDoc => Boolean(item))
}

function normalizeCalloutText(text: string) {
  return text
    .replace(/\[!(INFO|TIP|WARNING|IMPORTANT|CAUTION)\]/gi, "")
    .replace(/^(提示|注意|说明|重要|警告)[:：]\s*/, "")
    .trim()
}

function MarkdownCallout({ children }: { children: React.ReactNode }) {
  const text = normalizeCalloutText(
    React.Children.toArray(children)
      .map((child) => {
        if (typeof child === "string") return child
        if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
          return React.Children.toArray(child.props.children).join("")
        }
        return ""
      })
      .join(" "),
  )
  return (
    <div className="my-6 flex gap-3 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
      <div>{text || children}</div>
    </div>
  )
}

export default function Guide() {
  const { showFeedback } = usePageFeedback()
  const initialDocID =
    typeof window === "undefined" ? "" : readHashDocID() || GUIDE_DOCS[0].id
  const [activeDocID, setActiveDocID] = useState(initialDocID)
  const [searchQuery, setSearchQuery] = useState("")
  const [feedbackValue, setFeedbackValue] = useState<"helpful" | "unhelpful" | "">("")
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activeHeadingID, setActiveHeadingID] = useState("")
  const contentRef = useRef<HTMLElement | null>(null)

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredDocs = useMemo(() => {
    if (!normalizedQuery) return GUIDE_DOCS
    return GUIDE_DOCS.filter((doc) => {
      const haystack = [
        doc.title,
        doc.description,
        doc.category,
        doc.role,
        stripMarkdown(doc.content),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [normalizedQuery])

  useEffect(() => {
    if (filteredDocs.length === 0) return
    if (!filteredDocs.some((doc) => doc.id === activeDocID)) {
      setActiveDocID(filteredDocs[0].id)
    }
  }, [activeDocID, filteredDocs])

  useEffect(() => {
    const handleHashChange = () => {
      const nextDocID = readHashDocID()
      if (nextDocID) setActiveDocID(nextDocID)
    }
    window.addEventListener("hashchange", handleHashChange)
    handleHashChange()
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])

  const activeDoc = filteredDocs.find((doc) => doc.id === activeDocID) || null
  const groupedDocs = useMemo(() => groupDocs(filteredDocs), [filteredDocs])
  const toc = useMemo(() => (activeDoc ? extractHeadings(activeDoc) : []), [activeDoc])
  const relatedDocs = useMemo(() => (activeDoc ? getRelatedDocs(activeDoc) : []), [activeDoc])

  useEffect(() => {
    setActiveHeadingID(toc[0]?.id || "")
  }, [activeDocID, toc])

  useEffect(() => {
    if (!activeDoc || !contentRef.current) return
    const scroller = contentRef.current
    const headingSelector = `h2[id^="${activeDoc.id}-"], h3[id^="${activeDoc.id}-"]`
    const headingNodes = Array.from(scroller.querySelectorAll<HTMLElement>(headingSelector))
    if (headingNodes.length === 0) return

    const updateActiveHeading = () => {
      const scrollerTop = scroller.getBoundingClientRect().top
      const readingLine = scrollerTop + 120
      const current =
        headingNodes
          .filter((node) => node.getBoundingClientRect().top <= readingLine)
          .at(-1) || headingNodes[0]
      setActiveHeadingID(current.id)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleHeadings = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)

        if (visibleHeadings[0]?.target instanceof HTMLElement) {
          setActiveHeadingID(visibleHeadings[0].target.id)
        }
      },
      {
        root: scroller,
        rootMargin: "0px 0px -65% 0px",
        threshold: [0, 1],
      },
    )

    headingNodes.forEach((node) => observer.observe(node))
    scroller.addEventListener("scroll", updateActiveHeading, { passive: true })
    updateActiveHeading()

    return () => {
      observer.disconnect()
      scroller.removeEventListener("scroll", updateActiveHeading)
    }
  }, [activeDoc, activeDocID])

  useEffect(() => {
    if (!activeDoc || typeof window === "undefined") return
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, "")).trim()
    if (!hash.startsWith(`${activeDoc.id}-`)) return

    window.requestAnimationFrame(() => {
      const target = document.getElementById(hash)
      target?.scrollIntoView({ block: "start" })
      if (target) setActiveHeadingID(hash)
    })
  }, [activeDoc])

  const selectDoc = (docID: string) => {
    setActiveDocID(docID)
    setFeedbackValue("")
    setMobileNavOpen(false)
    window.history.replaceState(null, "", `#${docID}`)
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  const jumpToHeading = (item: TocItem) => {
    const target = document.getElementById(item.id)
    if (!target) return
    window.history.replaceState(null, "", `#${item.id}`)
    target.scrollIntoView({ block: "start", behavior: "smooth" })
    setActiveHeadingID(item.id)
  }

  const copyLink = async () => {
    if (!activeDoc) return
    const url = buildDocURL(activeDoc.id)
    try {
      await navigator.clipboard.writeText(url)
      showFeedback({ message: "指南链接已复制。", kind: "success" })
    } catch {
      showFeedback({ message: "当前浏览器不允许复制，请手动复制地址栏链接。", kind: "warning" })
    }
  }

  const submitFeedback = (value: "helpful" | "unhelpful") => {
    setFeedbackValue(value)
    showFeedback({
      message: value === "helpful" ? "感谢反馈，我们会继续完善指南。" : "已记录反馈，我们会优先优化这篇指南。",
      kind: "success",
    })
  }

  const contactSupport = () => {
    showFeedback({
      message: "请联系企业管理员或项目对接人处理；后续可在这里接入在线支持入口。",
      kind: "info",
    })
  }

  return (
    <div className="-m-8 flex h-[calc(100%+4rem)] min-h-0 flex-col overflow-hidden bg-white lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 bg-white lg:w-[296px] lg:border-b-0 lg:border-r">
        <div className="border-b border-gray-100 p-4">
          <label htmlFor="guide-search" className="sr-only">
            搜索使用指南
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="guide-search"
              name="guide_search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索指南"
              className="h-10 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mt-2 min-h-4 text-[11px] text-gray-400">
            {normalizedQuery ? `找到 ${filteredDocs.length} 篇相关指南` : "按业务场景查找指南"}
          </div>
          <button
            type="button"
            className="mt-3 flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 text-left text-xs font-medium text-gray-700 lg:hidden"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-expanded={mobileNavOpen}
          >
            <span className="truncate">{activeDoc ? `当前：${activeDoc.title}` : "选择指南"}</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-gray-400 transition-transform", mobileNavOpen && "rotate-180")} />
          </button>
        </div>

        <nav className={cn("min-h-0 flex-1 overflow-y-auto px-3 py-3 lg:block lg:max-h-none lg:py-4", mobileNavOpen ? "max-h-[320px]" : "hidden")}>
          {groupedDocs.length > 0 ? (
            groupedDocs.map((group) => (
              <div key={group.category} className="mb-6 last:mb-0">
                <div className="mb-2 px-2 text-[11px] font-semibold text-gray-400">
                  {group.category}
                </div>
                <div className="space-y-1">
                  {group.docs.map((doc) => {
                    const selected = activeDoc?.id === doc.id
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => selectDoc(doc.id)}
                        className={cn(
                          "w-full rounded-md border-l-4 px-3 py-2.5 text-left transition-colors",
                          selected
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-transparent text-gray-600 hover:bg-gray-50",
                        )}
                      >
                        <div className="text-sm font-semibold">{doc.title}</div>
                        <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-gray-500">
                          {doc.description}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-4 text-sm text-gray-500">
              没有找到匹配的指南。
            </div>
          )}
        </nav>

        <div className="hidden border-t border-gray-100 p-4 lg:block">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full justify-center text-xs"
            onClick={contactSupport}
          >
            <HelpCircle className="mr-2 h-3.5 w-3.5" />
            联系支持
          </Button>
        </div>
      </aside>

      <section ref={contentRef} className="min-w-0 flex-1 overflow-y-auto bg-[#F7F8FA]">
        <div className="mx-auto flex w-full max-w-[1216px] flex-col justify-center gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:gap-6 lg:px-8 lg:py-8">
          <article className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white lg:max-w-[860px]">
            {activeDoc ? (
              <>
                <header className="border-b border-gray-100 px-5 py-5 sm:px-8 sm:py-6">
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium text-blue-600">
                    <BookOpen className="h-4 w-4" />
                    使用指南 / {activeDoc.category}
                  </div>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h1 className="text-2xl font-semibold text-gray-900">{activeDoc.title}</h1>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                        {activeDoc.description}
                      </p>
                    </div>
                    <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
                      <Button variant="outline" size="sm" className="h-8 flex-1 text-xs sm:flex-none" onClick={copyLink}>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        复制链接
                      </Button>
                      {activeDoc.relatedPage ? (
                        <Link
                          to={activeDoc.relatedPage.href}
                          className="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 sm:flex-none"
                        >
                          {activeDoc.relatedPage.label}
                          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5" />
                      适用：{activeDoc.role}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      阅读约 {activeDoc.readingMinutes} 分钟
                    </span>
                    <span>更新：{activeDoc.updatedAt}</span>
                  </div>
                </header>

                <div className="px-5 py-6 sm:px-8 sm:py-8">
                  <div
                    className="max-w-none text-gray-700"
                  >
                    <Markdown
                      components={{
                        h1: () => null,
                        h2: ({ children }) => {
                          const text = React.Children.toArray(children).join("")
                          return (
                            <h2
                              id={`${activeDoc.id}-${slugify(text)}`}
                              className="mt-10 scroll-mt-8 border-b border-gray-100 pb-3 text-xl font-semibold text-gray-950 first:mt-0"
                            >
                              {children}
                            </h2>
                          )
                        },
                        h3: ({ children }) => (
                          <h3
                            id={`${activeDoc.id}-${slugify(React.Children.toArray(children).join(""))}`}
                            className="mt-7 scroll-mt-8 text-base font-semibold text-gray-900"
                          >
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="mt-4 text-[15px] leading-7 text-gray-600">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="my-5 space-y-2 rounded-lg border border-gray-100 bg-gray-50 px-6 py-4 text-[15px] leading-7 text-gray-600 marker:text-blue-500">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="my-5 space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 px-6 py-4 text-[15px] leading-7 text-gray-700 marker:font-semibold marker:text-blue-600">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="pl-1 text-[15px] leading-7 text-gray-600">
                            {children}
                          </li>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-gray-950">{children}</strong>
                        ),
                        code: ({ children }) => (
                          <code className="rounded bg-blue-50 px-1.5 py-0.5 text-[13px] font-medium text-blue-700">
                            {children}
                          </code>
                        ),
                        a: ({ href, children }) => {
                          const targetHref = href || "#"
                          if (targetHref.startsWith("/")) {
                            return (
                              <Link
                                to={targetHref}
                                className="inline-flex items-center rounded text-blue-600 underline-offset-2 hover:underline"
                              >
                                {children}
                              </Link>
                            )
                          }
                          return (
                            <a
                              href={targetHref}
                              target={targetHref.startsWith("http") ? "_blank" : undefined}
                              rel="noreferrer"
                              className="text-blue-600 underline-offset-2 hover:underline"
                            >
                              {children}
                            </a>
                          )
                        },
                        blockquote: ({ children }) => <MarkdownCallout>{children}</MarkdownCallout>,
                      }}
                    >
                      {activeDoc.content}
                    </Markdown>
                  </div>

                  <div className="mt-12 border-t border-gray-100 pt-8">
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">本页内容对你有帮助吗？</div>
                          <div className="mt-1 text-xs text-gray-500">反馈会帮助我们持续优化使用指南。</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={feedbackValue === "helpful" ? undefined : "outline"}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => submitFeedback("helpful")}
                          >
                            <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
                            有帮助
                          </Button>
                          <Button
                            variant={feedbackValue === "unhelpful" ? undefined : "outline"}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => submitFeedback("unhelpful")}
                          >
                            <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />
                            需改进
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[520px] flex-col items-center justify-center px-8 text-center">
                <Search className="h-10 w-10 text-gray-300" />
                <h1 className="mt-4 text-xl font-semibold text-gray-900">没有找到相关指南</h1>
                <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
                  请尝试更换关键词，或清空搜索后查看全部指南。
                </p>
                <Button variant="outline" className="mt-5 h-9 text-xs" onClick={() => setSearchQuery("")}>
                  清空搜索
                </Button>
              </div>
            )}
          </article>

          <aside className="hidden w-72 shrink-0 xl:block">
            <div className="sticky top-8 space-y-4">
              <section className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 text-xs font-semibold text-gray-400">本页目录</div>
                {toc.length > 0 ? (
                  <div className="space-y-1">
                    {toc.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => jumpToHeading(item)}
                        className={cn(
                          "block w-full rounded-md py-2 text-left text-sm transition-colors hover:bg-blue-50 hover:text-blue-700",
                          item.level === 3 ? "px-5 text-xs" : "px-2",
                          activeHeadingID === item.id
                            ? "bg-blue-50 font-semibold text-blue-700"
                            : "text-gray-600",
                        )}
                      >
                        {item.text}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">暂无目录</div>
                )}
              </section>

              {activeDoc ? (
                <section className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="mb-3 text-xs font-semibold text-gray-400">相关指南</div>
                  <div className="space-y-1">
                    {relatedDocs.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => selectDoc(doc.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-700"
                      >
                        <span>{doc.title}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <div>
                    <div className="text-sm font-semibold text-blue-900">需要帮助？</div>
                    <p className="mt-1 text-xs leading-5 text-blue-700">
                      如果指南没有覆盖你的场景，可以联系企业管理员或项目对接人。
                    </p>
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center text-xs font-medium text-blue-700 hover:underline"
                      onClick={contactSupport}
                    >
                      联系支持 <Send className="ml-1 h-3 w-3" />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )
}
