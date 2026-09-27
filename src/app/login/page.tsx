import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputClass } from "@/components/ui";
import { login } from "./actions";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center bg-dxv-green px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
        <div className="mb-6">
          <p className="inline-block rounded bg-dxv-yellow px-2 py-0.5 text-xs font-bold tracking-widest text-dxv-green">DXV</p>
          <h1 className="mt-3 text-2xl font-semibold text-dxv-green">DXV OS</h1>
          <p className="text-sm text-black/60">Admin sign in</p>
        </div>
        <ActionForm action={login} className="space-y-4" resetOnSuccess={false}>
          <Field label="Email">
            <input name="email" type="email" autoComplete="email" required className={inputClass} />
          </Field>
          <Field label="Password">
            <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
          </Field>
          <SubmitButton>Sign in</SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}
