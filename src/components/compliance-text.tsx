// Legal wording (statements, member terms) as angels and admins read it. Server-component safe.
/** How the text reads (the portal shows it the same way). */
export function ComplianceTextView({ title, body, criteria }: { title: string; body: string; criteria: string[] }) {
  return (
    <div className="space-y-2">
      <p className="font-semibold">{title}</p>
      {body.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="whitespace-pre-line text-black/80">
          {p}
        </p>
      ))}
      {criteria.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-black/80">
          {criteria.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
