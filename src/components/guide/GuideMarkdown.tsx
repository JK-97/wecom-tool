import React from "react"
import Markdown from "react-markdown"
import { Link } from "react-router-dom"
import { Info } from "lucide-react"
import { GuideDiagram, readGuideBlockTitle } from "@/components/guide/GuideDiagram"
import { GuideFigure } from "@/components/guide/GuideFigure"
import { GuideHtml } from "@/components/guide/GuideHtml"
import { GuideStatusTable } from "@/components/guide/GuideStatusTable"

type GuideMarkdownProps = {
  content: string
  docID: string
  slugify: (text: string) => string
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

function anchorForBlock(docID: string, slugify: (text: string) => string, source: string, fallback: string) {
  const title = readGuideBlockTitle(source, fallback)
  return {
    title,
    id: title ? `${docID}-${slugify(title)}` : undefined,
  }
}

export function GuideMarkdown({ content, docID, slugify }: GuideMarkdownProps) {
  return (
    <div className="max-w-none text-gray-700">
      <Markdown
        components={{
          h1: () => null,
          h2: ({ children }) => {
            const text = React.Children.toArray(children).join("")
            return (
              <h2
                id={`${docID}-${slugify(text)}`}
                className="mt-10 scroll-mt-8 border-b border-gray-100 pb-3 text-xl font-semibold text-gray-950 first:mt-0"
              >
                {children}
              </h2>
            )
          },
          h3: ({ children }) => (
            <h3
              id={`${docID}-${slugify(React.Children.toArray(children).join(""))}`}
              className="mt-7 scroll-mt-8 text-base font-semibold text-gray-900"
            >
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mt-4 text-[15px] leading-7 text-gray-600">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-5 list-disc space-y-2 rounded-lg border border-gray-100 bg-gray-50 py-4 pl-8 pr-6 text-[15px] leading-7 text-gray-600 marker:text-blue-500">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-5 list-decimal space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 py-4 pl-8 pr-6 text-[15px] leading-7 text-gray-700 marker:font-semibold marker:text-blue-600">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1 text-[15px] leading-7 text-gray-600">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-gray-950">{children}</strong>,
          code: ({ className, children }) => {
            const language = /language-(\w[\w-]*)/.exec(className || "")?.[1] || ""
            const source = String(children).replace(/\n$/, "")
            if (language === "mermaid") {
              const block = anchorForBlock(docID, slugify, source, "流程概览")
              return <GuideDiagram source={source} title={block.title} anchorID={block.id} />
            }
            if (language === "guide-table") {
              const block = anchorForBlock(docID, slugify, source, "")
              return <GuideStatusTable source={source} anchorID={block.id} />
            }
            if (language === "guide-figure") {
              const block = anchorForBlock(docID, slugify, source, "页面示意")
              return <GuideFigure source={source} anchorID={block.id} />
            }
            if (language === "guide-html") {
              const block = anchorForBlock(docID, slugify, source, "操作示意图")
              return <GuideHtml source={source} anchorID={block.id} />
            }
            return (
              <code className="rounded bg-blue-50 px-1.5 py-0.5 text-[13px] font-medium text-blue-700">
                {children}
              </code>
            )
          },
          pre: ({ children }) => <>{children}</>,
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
        {content}
      </Markdown>
    </div>
  )
}
