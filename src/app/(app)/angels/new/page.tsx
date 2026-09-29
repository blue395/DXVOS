import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { createAngel } from "../actions";
import { AngelFields } from "../angel-fields";

export default async function NewAngelPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/angels" className="text-sm text-dxv-green hover:underline">
        ← Angels
      </Link>
      <h1 className="text-2xl font-semibold text-dxv-green">Add an angel</h1>
      <Card>
        <ActionForm action={createAngel} className="space-y-4">
          <AngelFields />
          <SubmitButton pendingLabel="Adding…" doneLabel="Added">
            Add angel
          </SubmitButton>
        </ActionForm>
      </Card>
      <p className="text-xs text-black/50">Record their investor statement on the next page, once they&apos;ve signed one.</p>
    </div>
  );
}
