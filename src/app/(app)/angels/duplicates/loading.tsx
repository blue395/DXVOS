import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-72" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}
