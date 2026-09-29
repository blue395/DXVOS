// Renders a DocSpec (the format-neutral description behind the PDF and Word exports)
// as a web page, so the portal shows exactly what the exports contain. Server-component safe.
import type { Block, DocSpec } from "@/lib/export/spec";

export function DocSpecView({ spec }: { spec: DocSpec }) {
  return (
    <article className="space-y-3 text-sm leading-relaxed">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-black/50">{spec.subtitle}</p>
        <h2 className="text-xl font-semibold text-dxv-green">{spec.title}</h2>
      </header>
      {spec.notice && <p className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2">{spec.notice}</p>}
      {spec.summary.length > 0 && <KeyValue rows={spec.summary} />}
      {spec.blocks.map((b, i) => (
        <BlockView key={i} b={b} />
      ))}
    </article>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case "heading":
      return <h3 className="border-b-2 border-dxv-yellow pb-1 pt-3 text-base font-semibold text-dxv-green">{b.text}</h3>;
    case "subheading":
      return <h4 className="pt-1 text-xs font-semibold uppercase tracking-wide text-dxv-green">{b.text}</h4>;
    case "paragraph":
      return <p className={`whitespace-pre-wrap ${b.italic ? "italic" : ""} ${b.muted ? "text-black/55" : ""} ${b.bold ? "font-semibold" : ""}`}>{b.text}</p>;
    case "bullets":
      return b.items.length ? (
        <ul className="list-disc space-y-1 pl-5">
          {b.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : (
        <p className="text-black/55">{b.empty ?? "None."}</p>
      );
    case "keyValue":
      return <KeyValue rows={b.rows} blank={b.blank} />;
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-black/50">
              <tr>
                {b.headers.map((h, i) => (
                  <th key={i} className="py-1.5 pr-3 font-medium" style={{ width: `${(b.widths[i] ?? 0) * 100}%` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {b.rows.map((r, i) => (
                <tr key={i} className="align-top">
                  {r.map((c, j) => (
                    <td key={j} className="py-1.5 pr-3">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "notice":
      return <p className="rounded border-l-4 border-dxv-yellow bg-dxv-yellow/20 px-3 py-2">{b.text}</p>;
    case "box":
      return (
        <div className="rounded border border-black/15 p-3">
          <p className="font-medium">{b.title}</p>
          <p className="text-black/55">{b.prompt}</p>
        </div>
      );
    case "spacer":
      return <div className="h-2" />;
    case "pageBreak":
      return <hr className="border-black/10" />;
  }
}

function KeyValue({ rows, blank = "–" }: { rows: [string, string][]; blank?: string }) {
  return (
    <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-3 gap-y-1 rounded bg-dxv-green/[0.04] p-3">
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-black/55">{k}</dt>
          <dd>{v || blank}</dd>
        </div>
      ))}
    </dl>
  );
}
