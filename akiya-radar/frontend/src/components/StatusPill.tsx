import { PERSONAL_STATUS_LABELS } from "@/lib/types";

const tone: Record<string, string> = {
  very_interesting: "bg-moss text-paper",
  interesting: "bg-moss/20 text-moss",
  abandoned: "bg-ink/10 text-ink-mute line-through",
  needs_verification: "bg-gold/20 text-ink",
  new: "bg-indigo/15 text-indigo",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`chip border-transparent ${tone[status] ?? "bg-paper-2 text-ink-soft"}`}
    >
      {PERSONAL_STATUS_LABELS[status] ?? status}
    </span>
  );
}
