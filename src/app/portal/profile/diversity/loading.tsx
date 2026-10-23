import { LoadingBar, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <LoadingBar />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-16" />
      <Skeleton className="h-96" />
    </div>
  );
}
