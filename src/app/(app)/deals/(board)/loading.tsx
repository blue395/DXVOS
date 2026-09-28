import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading deals">
      <Skeleton className="h-8 w-32" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="w-64 shrink-0 space-y-3 rounded-xl border border-black/10 p-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
