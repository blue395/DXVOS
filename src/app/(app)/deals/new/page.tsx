import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card } from "@/components/ui";
import { createVenture } from "../actions";
import { VentureFields } from "../venture-fields";

export default async function NewVenturePage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/deals" className="text-sm text-dxv-green hover:underline">
        ← Deals
      </Link>
      <h1 className="text-2xl font-semibold text-dxv-green">New venture</h1>
      <Card>
        <ActionForm action={createVenture} className="space-y-4" resetOnSuccess={false}>
          <p className="text-sm text-black/60">New ventures start at <strong>Founder deck</strong>.</p>
          <VentureFields />
          <SubmitButton>Create venture</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
