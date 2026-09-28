import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-5" aria-busy="true" aria-label="Loading assessment">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-72" />
      <div className="flex gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-36 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
