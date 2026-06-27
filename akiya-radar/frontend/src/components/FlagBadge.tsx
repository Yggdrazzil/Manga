import type { Flag } from "@/lib/types";

const styles: Record<string, string> = {
  critical: "bg-vermilion text-paper border-vermilion",
  warning: "bg-gold/20 text-ink border-gold",
  info: "bg-paper-2 text-ink-soft border-ink/40",
};

const icon: Record<string, string> = {
  critical: "⚠",
  warning: "▲",
  info: "ℹ",
};

export function FlagBadge({ flag, full = false }: { flag: Flag; full?: boolean }) {
  return (
    <span
      className={`chip ${styles[flag.severity] ?? styles.info}`}
      title={flag.explanation_fr ?? flag.label_fr}
    >
      <span aria-hidden>{icon[flag.severity] ?? "•"}</span>
      {full ? flag.label_fr : flag.label_fr.split(" ").slice(0, 3).join(" ")}
    </span>
  );
}
