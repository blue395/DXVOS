import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center bg-dxv-green px-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-96 w-full max-w-sm rounded-xl" />
    </main>
  );
}
