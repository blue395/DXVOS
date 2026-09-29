import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-32" />
      <Skeleton className="h-20" />
      <Skeleton className="h-64" />
    </div>
  );
}
