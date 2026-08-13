import type { ReactNode } from "react";

export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-ink-soft" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      <span className="font-bold uppercase tracking-widest">{label}</span>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`shimmer ${className}`} aria-hidden />;
}

/**
 * Placeholder matching the real card's geometry.
 *
 * Same aspect ratio and row heights as {@link ListingCard}, so the grid keeps
 * its exact shape when results arrive — no reflow, and the wait reads as the
 * page filling in rather than a spinner blocking it.
 */
export function ListingCardSkeleton() {
  return (
    <div className="panel overflow-hidden" aria-hidden>
      <Skeleton className="aspect-[16/10] w-full" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-5 w-4/5 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" />
        <Skeleton className="h-6 w-2/5 rounded" />
        <div className="grid grid-cols-4 gap-2 border-t border-line pt-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ListingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      role="status"
      aria-label="Chargement des annonces"
    >
      {Array.from({ length: count }, (_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel mx-auto my-8 max-w-md p-6 text-center" role="alert">
      <p className="font-display text-xl font-bold text-vermilion">Une erreur est survenue</p>
      <p className="mt-2 text-ink-soft">{message}</p>
      {onRetry && (
        <button className="btn btn-primary mt-4" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel mx-auto my-8 max-w-md p-8 text-center">
      <p className="font-display text-2xl font-bold">空 — {title}</p>
      {hint && <p className="mt-2 text-ink-soft">{hint}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
