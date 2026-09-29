import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-5" aria-busy="true" aria-label="Loading playbook">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-40 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Skeleton className="h-[32rem]" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
