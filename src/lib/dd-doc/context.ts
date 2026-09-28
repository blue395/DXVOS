// What DXV OS knows about the deal, handed to the AI and printed on the document.
export type DDContext = {
  ventureName: string;
  details: { label: string; value: string }[]; // printed in the summary table
  memo: { name: string; text: string } | null; // latest DXV Review Issue/Draft (or AI Draft), rendered
  eligibilityScreen: string | null;
  ddItems: string[];
  deck: { bucket: string; storagePath: string; fileName: string } | null;
  preparedBy: string;
};

export function renderDDContext(c: DDContext): string {
  return [
    "DXV OS context",
    `Venture: ${c.ventureName}`,
    ...c.details.map((d) => `${d.label}: ${d.value}`),
    "",
    c.memo ? `Investment memo (${c.memo.name}):\n${c.memo.text}` : "Investment memo: none yet.",
    "",
    "Eligibility screen:",
    c.eligibilityScreen ?? "None on record.",
    "",
    "Existing DD items:",
    ...(c.ddItems.length ? c.ddItems.map((i) => `- ${i}`) : ["None yet."]),
  ].join("\n");
}
