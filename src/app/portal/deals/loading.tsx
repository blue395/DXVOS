import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-8 w-56" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-64 w-40 shrink-0" />
        ))}
      </div>
    </div>
  );
}
