import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-dashed border-neutral-800 px-6 py-12 text-center", className)}>
      <p className="text-sm font-medium text-neutral-200">{title}</p>
      {description ? <p className="mt-2 text-xs text-neutral-500">{description}</p> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-neutral-400">
      <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
      {message}
    </div>
  );
}
