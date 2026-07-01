import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/api/client";

interface Props {
  /** Original Japanese text. */
  text: string | null | undefined;
  /** Classes for the original (Japanese) text element. */
  className?: string;
  /** Render the source text as a heading-like block (larger) vs. body. */
  as?: "body" | "heading";
}

/**
 * Shows Japanese text with an on-demand "Traduire en français" action.
 * Translation is fetched only when the user asks, then toggled show/hide.
 */
export function TranslatableText({ text, className = "", as = "body" }: Props) {
  const [fr, setFr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const translate = useMutation({
    mutationFn: () => api.translateText(text ?? ""),
    onSuccess: (res) => {
      setFr(res.translated);
      setOpen(true);
    },
  });

  if (!text) return <p className={className}>—</p>;

  const onClick = () => {
    if (fr === null) translate.mutate();
    else setOpen((o) => !o);
  };

  const label = translate.isPending
    ? "Traduction…"
    : fr === null
      ? "Traduire en français"
      : open
        ? "Masquer la traduction"
        : "Afficher la traduction";

  return (
    <div>
      <p
        lang="ja"
        className={`${as === "heading" ? "font-display" : "whitespace-pre-wrap"} ${className}`}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={onClick}
        disabled={translate.isPending}
        aria-expanded={open}
        className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface px-2.5 py-1 text-xs font-bold text-ink-soft transition-colors hover:border-vermilion hover:text-vermilion disabled:opacity-50"
      >
        <span aria-hidden>🌐</span>
        {label}
      </button>
      {translate.isError && (
        <p className="mt-1 text-xs text-vermilion" role="alert">
          Traduction indisponible.
        </p>
      )}
      {open && fr !== null && (
        <p className="mt-2 whitespace-pre-wrap border-l-2 border-vermilion/40 pl-3 text-ink-soft animate-fade-in">
          {fr}
        </p>
      )}
    </div>
  );
}
