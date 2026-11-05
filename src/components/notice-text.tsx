// Renders the privacy notice's blocks (src/content/privacy-notice.ts): paragraphs with
// **bold** lead-ins, lists and tables (tables scroll inside their own box on phones).
import type { NoticeBlock } from "@/content/privacy-notice";

export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-black/85">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function NoticeBlocks({ blocks }: { blocks: NoticeBlock[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        "p" in b ? (
          <p key={i}>
            <Rich text={b.p} />
          </p>
        ) : "list" in b ? (
          <ul key={i} className="list-disc space-y-1.5 pl-5">
            {b.list.map((item) => (
              <li key={item}>
                <Rich text={item} />
              </li>
            ))}
          </ul>
        ) : (
          <div key={i} className="space-y-2">
            {b.caption && <h3 className="font-semibold text-dxv-green">{b.caption}</h3>}
            <div className="overflow-x-auto rounded-lg border border-black/10">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-dxv-green/[0.06] text-xs uppercase tracking-wide text-dxv-green">
                  <tr>
                    {b.table.head.map((h) => (
                      <th key={h} className="px-3 py-2 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 align-top">
                  {b.table.rows.map((r) => (
                    <tr key={r[0]}>
                      {r.map((c, j) => (
                        <td key={j} className={`px-3 py-2 ${j === 0 ? "font-medium text-black/80" : "text-black/70"}`}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ),
      )}
    </>
  );
}
