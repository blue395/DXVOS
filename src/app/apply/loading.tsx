import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <main className="flex flex-1 justify-center bg-dxv-green px-4 py-10" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-[640px] w-full max-w-2xl rounded-xl" />
    </main>
  );
}
