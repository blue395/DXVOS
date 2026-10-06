import { connection } from "next/server";
import { issueFormToken } from "@/lib/founder-submissions";
import { DIVERSITY_OPTIONS } from "@/lib/founder-intake";
import { ApplyForm } from "./apply-form";

export const metadata = {
  title: "Submit your deck · Diversity X Ventures",
  description: "Apply for investment from Diversity X Ventures, a UK angel syndicate backing Underestimated Founders® at pre-seed and seed.",
};

// Public: founders apply here (linked from diversityxventures.com/founders). Rendered per
// visit so the form's timing stamp is fresh.
export default async function ApplyPage() {
  await connection();
  return (
    <main className="flex flex-1 justify-center bg-dxv-green px-4 py-10">
      <div className="w-full max-w-2xl space-y-6 rounded-xl bg-white p-6 shadow-xl sm:p-10">
        <div className="space-y-2">
          <p className="inline-block rounded bg-dxv-yellow px-2 py-0.5 text-xs font-bold tracking-widest text-dxv-green">DXV</p>
          <h1 className="text-2xl font-semibold text-dxv-green sm:text-3xl">Submit your deck</h1>
          <p className="text-black/70">
            Diversity X Ventures is a UK angel syndicate backing Underestimated Founders® building Impact Ventures at pre-seed and seed. Tell us about
            your company and share your deck: it takes about two minutes.
          </p>
        </div>
        <ApplyForm formToken={issueFormToken()} diversityOptions={DIVERSITY_OPTIONS} />
      </div>
    </main>
  );
}
