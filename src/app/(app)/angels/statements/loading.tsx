import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-96" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-48" />
      ))}
    </div>
  );
}
