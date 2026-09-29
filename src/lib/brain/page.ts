// Pure helpers for the DXV Brain chat (shared by the server actions and the panel).

/** The deal a page belongs to, from its path: "/deals/abc/assessment" gives "abc". */
export function dealIdFromPath(pagePath: string | null | undefined): string | null {
  const m = pagePath?.match(/^\/deals\/([^/?#]+)/);
  return m && m[1] !== "new" ? decodeURIComponent(m[1]) : null;
}

/** A chat's title: the start of its first question. */
export function chatTitle(question: string): string {
  const t = question.replace(/\s+/g, " ").trim();
  return t.length > 70 ? `${t.slice(0, 67).replace(/\s+\S*$/, "")}…` : t;
}

export const MAX_QUESTION_CHARS = 8000;
