/** How to write a team email: placeholders and links. */
export function WritingHelp() {
  return (
    <details className="rounded-md border border-black/10 p-3 text-sm">
      <summary className="cursor-pointer font-medium text-dxv-green">How to write it: names, links and spacing</summary>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-black/75">
        <li>
          <code className="rounded bg-black/5 px-1">{"{{first_name}}"}</code> becomes each person&apos;s first name.
        </li>
        <li>
          <code className="rounded bg-black/5 px-1">{"{{platform_link}}"}</code> becomes their own link to the platform: a one-time sign-up link if
          they aren&apos;t on it yet (valid 14 days), otherwise the sign-in page.
        </li>
        <li>
          Links: <code className="rounded bg-black/5 px-1">[link text](https://…)</code>, e.g.{" "}
          <code className="rounded bg-black/5 px-1">{"[DXV Deal Platform]({{platform_link}})"}</code>. A plain https:// address is linked too.
        </li>
        <li>A blank line starts a new paragraph; a single line break stays as it is (handy for your signature).</li>
        <li>Keep specific deal details out of bulk emails: deals are shared on the platform, only with members whose investor statement is current.</li>
      </ul>
    </details>
  );
}
