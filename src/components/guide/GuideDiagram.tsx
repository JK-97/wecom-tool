import { ArrowRight, Boxes } from "lucide-react"

type GuideDiagramProps = {
  source: string
  title?: string
  anchorID?: string
}

function parseMermaidFlow(raw: string) {
  const nodes = new Map<string, string>()
  const edges: Array<[string, string]> = []

  raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("title:") && !line.startsWith("flowchart") && !line.startsWith("graph"))
    .forEach((line) => {
      const match = line.match(/^([A-Za-z0-9_-]+)(?:\["([^"]+)"\])?\s*-->\s*([A-Za-z0-9_-]+)(?:\["([^"]+)"\])?/)
      if (!match) return
      const [, fromID, fromLabel, toID, toLabel] = match
      nodes.set(fromID, fromLabel || nodes.get(fromID) || fromID)
      nodes.set(toID, toLabel || nodes.get(toID) || toID)
      edges.push([fromID, toID])
    })

  const orderedIDs: string[] = []
  edges.forEach(([fromID, toID]) => {
    if (!orderedIDs.includes(fromID)) orderedIDs.push(fromID)
    if (!orderedIDs.includes(toID)) orderedIDs.push(toID)
  })

  return orderedIDs.map((id) => nodes.get(id) || id)
}

export function readGuideBlockTitle(source: string, fallback = "") {
  return (
    source
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("title:"))
      ?.replace(/^title:\s*/, "")
      .trim() || fallback
  )
}

export function GuideDiagram({ source, title, anchorID }: GuideDiagramProps) {
  const steps = parseMermaidFlow(source)
  if (steps.length === 0) {
    return (
      <pre className="my-5 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs leading-6 text-gray-600">
        {source}
      </pre>
    )
  }

  const displayTitle = title || readGuideBlockTitle(source, "流程概览")

  return (
    <section id={anchorID} className="my-6 scroll-mt-8 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-blue-700">
        <Boxes className="h-4 w-4" />
        {displayTitle}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {steps.map((step, index) => (
          <div
            key={`${step}-${index}`}
            className="relative flex min-h-16 items-center gap-3 rounded-md border border-blue-100 bg-white px-3 py-3 text-sm font-medium leading-5 text-gray-800"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
              {index + 1}
            </span>
            <span className="min-w-0 break-words">{step}</span>
            {index < steps.length - 1 ? (
              <span className="absolute right-2 top-2 hidden text-blue-300 xl:block">
                <ArrowRight className="h-4 w-4" />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
