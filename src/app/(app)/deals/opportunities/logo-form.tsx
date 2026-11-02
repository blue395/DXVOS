// Upload a company's logo for the slides (PNG or JPEG, up to 500 KB).
import { ActionForm, SubmitButton } from "@/components/action-form";
import { uploadVentureLogo } from "./actions";

export function LogoForm({ ventureId, name, hasLogo, version }: { ventureId: string; name: string; hasLogo: boolean; version: number }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
      <span className="flex h-12 w-28 shrink-0 items-center justify-center rounded border border-black/10 bg-white">
        {hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a private, team-only route
          <img src={`/api/ventures/${ventureId}/logo?v=${version}`} alt={`${name} logo`} className="max-h-10 max-w-24 object-contain" />
        ) : (
          <span className="text-xs text-black/40">No logo</span>
        )}
      </span>
      <span className="min-w-0 flex-1 font-medium">{name}</span>
      <ActionForm action={uploadVentureLogo.bind(null, ventureId)} className="flex flex-wrap items-center gap-2">
        <input type="file" name="logo" accept="image/png,image/jpeg" required aria-label={`Logo for ${name}`} className="max-w-56 text-xs" />
        <SubmitButton variant="secondary" pendingLabel="Uploading…" doneLabel="Uploaded">
          {hasLogo ? "Replace" : "Upload"}
        </SubmitButton>
      </ActionForm>
    </li>
  );
}
