/**
 * Choix automatique d'une couleur de texte lisible sur un fond donné.
 *
 * Les badges de l'app sont posés sur des couleurs d'accent qui changent d'un
 * thème à l'autre : l'ambre `#FBBF24` du thème Néo-Tokyo avec le texte clair
 * codé en dur donnait 1,41:1, très loin des 4,5:1 exigés par WCAG 2.1 AA.
 * Plutôt que de maintenir un token de premier plan par couleur et par thème,
 * on calcule la meilleure des deux encres.
 */

const DARK_INK = '#0B0908';
const LIGHT_INK = '#FFFFFF';

function parseColor(color: string): [number, number, number] | null {
  const c = color.trim();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const h = hex[1];
    const full = h.length === 3 ? h.split('').map(ch => ch + ch).join('') : h;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  }

  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(c);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];

  return null;
}

/** Luminance relative WCAG (0 = noir, 1 = blanc). */
export function relativeLuminance(color: string): number | null {
  const rgb = parseColor(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Encre lisible sur `background` : celle des deux qui offre le meilleur
 * contraste. Retombe sur l'encre sombre si la couleur n'est pas analysable
 * (dégradé, valeur de plateforme), ce qui reste le cas le plus fréquent pour
 * les fonds d'accent.
 */
export function readableInk(background: string): string {
  const onDark = contrastRatio(background, LIGHT_INK);
  const onLight = contrastRatio(background, DARK_INK);
  if (onDark === null || onLight === null) return DARK_INK;
  return onDark >= onLight ? LIGHT_INK : DARK_INK;
}

/** Vrai si la paire atteint le seuil WCAG AA du texte normal (4,5:1). */
export function meetsAA(foreground: string, background: string): boolean {
  const ratio = contrastRatio(foreground, background);
  return ratio !== null && ratio >= 4.5;
}
