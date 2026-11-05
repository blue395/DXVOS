import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <main className="flex flex-1 justify-center bg-dxv-green px-4 py-10" aria-busy="true" aria-label="Loading">
      <div className="w-full max-w-3xl space-y-4 rounded-xl bg-white p-6 sm:p-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    </main>
  );
}
