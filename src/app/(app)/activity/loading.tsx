import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading activity">
      <Skeleton className="h-8 w-40" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}
