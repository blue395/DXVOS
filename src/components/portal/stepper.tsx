// Onboarding progress: shown until the angel has finished onboarding. Server-component safe.
const STEPS = [
  { key: "profile", label: "Your details" },
  { key: "certify", label: "Investor statement" },
  { key: "welcome", label: "Welcome" },
] as const;

export function OnboardingStepper({ current }: { current: "profile" | "certify" | "welcome" }) {
  const at = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="mb-5 flex flex-wrap items-center gap-2 text-xs" aria-label="Onboarding steps">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            aria-current={i === at ? "step" : undefined}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
              i < at ? "bg-dxv-green/10 text-dxv-green" : i === at ? "bg-dxv-green text-white" : "bg-black/5 text-black/45"
            }`}
          >
            <span aria-hidden>{i < at ? "✓" : i + 1}</span>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <span aria-hidden className="text-black/25">→</span>}
        </li>
      ))}
    </ol>
  );
}
