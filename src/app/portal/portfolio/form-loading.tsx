import { Skeleton } from "@/components/ui";

/** Skeleton for the portfolio's add / edit pages. */
export function FormLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-56" />
      <Skeleton className="h-40" />
    </div>
  );
}
