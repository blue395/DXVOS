// The green sign-in screen's white card, shared by sign-in, "Forgot password?" and emailed links.
export function AuthCard({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-dxv-green px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
        <div className="mb-6">
          <p className="inline-block rounded bg-dxv-yellow px-2 py-0.5 text-xs font-bold tracking-widest text-dxv-green">DXV</p>
          <h1 className="mt-3 text-2xl font-semibold text-dxv-green">DXV OS</h1>
          <p className="text-sm text-black/60">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
