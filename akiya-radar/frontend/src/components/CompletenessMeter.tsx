import { completenessLabel, completenessTone } from "@/lib/format";

interface Props {
  value: number | null | undefined;
  variant?: "inline" | "bar";
}

/**
 * How much of the comparable core a listing actually has.
 *
 * Sources range from a full spec table to a single line of text, so two
 * listings can look equally trustworthy while one is mostly blanks. Surfacing
 * the gap keeps "we don't know" from being read as "nothing to report".
 */
export function CompletenessMeter({ value, variant = "inline" }: Props) {
  const pct = value ?? 0;
  const label = completenessLabel(value);
  const tone = completenessTone(value);

  if (variant === "inline") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${tone}`}
        title={`${label} — ${pct}% des informations clés renseignées`}
      >
        <span className="flex gap-0.5" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 w-3 rounded-full ${
                pct > i * 25 ? "bg-current" : "bg-current opacity-20"
              }`}
            />
          ))}
        </span>
        <span className="sr-only">{label} :</span>
        {pct}%
      </span>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className={`text-xs font-bold uppercase tracking-widest ${tone}`}>{label}</span>
        <span className="font-mono text-sm font-semibold">{pct}%</span>
      </div>
      <div
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-2"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Complétude des informations"
      >
        <div
          className={`h-full origin-left rounded-full animate-draw-in ${
            pct >= 80 ? "bg-moss" : pct >= 50 ? "bg-gold" : "bg-vermilion"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
