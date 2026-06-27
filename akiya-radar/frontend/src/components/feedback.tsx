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
  return <div className={`animate-pulse bg-paper-2 ${className}`} aria-hidden />;
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
