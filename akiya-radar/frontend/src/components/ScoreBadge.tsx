import { scoreBg } from "@/lib/format";

interface Props {
  score: number | null | undefined;
  confidence?: number | null;
  size?: "sm" | "lg";
}

export function ScoreBadge({ score, confidence, size = "sm" }: Props) {
  const value = score ?? null;
  const dim = size === "lg" ? "h-16 w-16 text-2xl" : "h-11 w-11 text-base";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${dim} ${scoreBg(value)} flex items-center justify-center border-2 border-ink font-display font-extrabold text-paper shadow-panel-sm`}
        aria-label={value === null ? "Non scoré" : `Score ${value} sur 100`}
        title={value === null ? "Non scoré" : `Score ${value}/100`}
      >
        {value ?? "?"}
      </div>
      {confidence !== undefined && confidence !== null && (
        <span className="text-[10px] uppercase tracking-wider text-ink-mute">
          conf. {confidence}%
        </span>
      )}
    </div>
  );
}
