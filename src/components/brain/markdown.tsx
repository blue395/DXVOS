// A small Markdown renderer for DXV Brain answers: headings, paragraphs, lists,
// tables, code, bold/italic, links. It builds React elements (never raw HTML), so
// nothing in an answer can inject markup; links must be http(s).
import { Fragment, type ReactNode } from "react";

function inline(text: string, key = ""): ReactNode[] {
  const out: ReactNode[] = [];
  // code | bold | italic | [text](url) | bare url
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s)<]+[^\s)<.,;:!?'"])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<code key={k} className="rounded bg-black/5 px-1 font-mono text-[0.85em]">{m[1].slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{inline(m[2].slice(2, -2), k)}</strong>);
    else if (m[3]) out.push(<em key={k}>{inline(m[3].slice(1, -1), k)}</em>);
    else if (m[4]) {
      const label = m[4].slice(1, m[4].indexOf("]("));
      out.push(<Link key={k} href={m[5]}>{label}</Link>);
    } else if (m[6]) out.push(<Link key={k} href={m[6]}>{m[6].replace(/^https?:\/\/(www\.)?/, "")}</Link>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-dxv-green underline decoration-dxv-green/40 underline-offset-2 hover:decoration-dxv-green">
      {children}
    </a>
  );
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const k = `b${i}`;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) body.push(lines[i]);
      i++;
      blocks.push(<pre key={k} className="overflow-x-auto rounded-md bg-black/5 p-2 font-mono text-xs">{body.join("\n")}</pre>);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      blocks.push(
        <p key={k} className={`font-semibold text-dxv-green ${h[1].length <= 2 ? "text-[0.95rem]" : ""}`}>
          {inline(h[2], k)}
        </p>,
      );
      i++;
      continue;
    }
    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && isTableRow(lines[i]); i++) rows.push(cells(lines[i]));
      blocks.push(
        <div key={k} className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>{head.map((c, j) => <th key={j} className="border-b border-black/15 px-1.5 py-1 text-left font-semibold">{inline(c, `${k}h${j}`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-black/5">
                  {r.map((c, j) => <td key={j} className="px-1.5 py-1 align-top">{inline(c, `${k}r${ri}c${j}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const bullet = /^\s*[-*•]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const items: string[] = [];
      for (; i < lines.length && (ordered ? numbered : bullet).test(lines[i]); i++) items.push(lines[i].replace(ordered ? numbered : bullet, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={k} className={`space-y-0.5 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((it, j) => <li key={j}>{inline(it, `${k}i${j}`)}</li>)}
        </List>,
      );
      continue;
    }
    const para: string[] = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*[-*•]\s|\s*\d+[.)]\s)/.test(lines[i]) && !isTableRow(lines[i]); i++) para.push(lines[i]);
    if (!para.length) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={k}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p, `${k}p${j}`)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className="space-y-2 break-words">{blocks}</div>;
}
