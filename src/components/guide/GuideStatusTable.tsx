import { readGuideBlockTitle } from "@/components/guide/GuideDiagram"

type GuideStatusTableProps = {
  source: string
  anchorID?: string
}

function parseRows(source: string) {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("title:") && !/^\|?\s*-{2,}/.test(line))
    .map((line) =>
      line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    )
}

export function GuideStatusTable({ source, anchorID }: GuideStatusTableProps) {
  const title = readGuideBlockTitle(source)
  const rows = parseRows(source)
  const [header, ...body] = rows

  if (!header || body.length === 0) {
    return (
      <pre className="my-5 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs leading-6 text-gray-600">
        {source}
      </pre>
    )
  }

  return (
    <section id={anchorID} className="my-6 scroll-mt-8 overflow-hidden rounded-lg border border-gray-200">
      {title ? <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500">{title}</div> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
            <tr>
              {header.map((cell) => (
                <th key={cell} className="whitespace-nowrap px-4 py-3">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white text-gray-600">
            {body.map((row, rowIndex) => (
              <tr key={`${row.join("-")}-${rowIndex}`}>
                {header.map((_, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="min-w-40 px-4 py-3 leading-6 align-top">
                    {row[cellIndex] || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
