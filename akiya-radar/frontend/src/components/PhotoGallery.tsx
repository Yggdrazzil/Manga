import { useState } from "react";

/**
 * Photo gallery for source-page images. Photos stay hosted by the source
 * (never re-uploaded); broken links are hidden automatically via onError.
 */
export function PhotoGallery({ urls }: { urls: string[] | null | undefined }) {
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(0);

  const photos = (urls ?? []).filter((u) => !broken.has(u));
  if (photos.length === 0) return null;

  const markBroken = (url: string) =>
    setBroken((prev) => new Set(prev).add(url));
  const current = photos[Math.min(active, photos.length - 1)];

  return (
    <section className="panel overflow-hidden">
      <img
        src={current}
        alt="Photo de l'annonce (source officielle)"
        loading="lazy"
        className="aspect-video w-full bg-paper-2 object-cover"
        onError={() => markBroken(current)}
      />
      {photos.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto p-2">
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Photo ${i + 1} sur ${photos.length}`}
              className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                i === active ? "border-vermilion" : "border-transparent hover:border-line-strong"
              }`}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                className="h-full w-full bg-paper-2 object-cover"
                onError={() => markBroken(url)}
              />
            </button>
          ))}
        </div>
      )}
      <p className="border-t border-line px-3 py-1.5 text-[11px] uppercase tracking-wider text-ink-mute">
        Photos hébergées par la source d'origine
      </p>
    </section>
  );
}
