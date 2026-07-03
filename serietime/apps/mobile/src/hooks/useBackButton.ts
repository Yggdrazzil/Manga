import { useEffect } from 'react';

// Pile de handlers retour : sheets/modales s'enregistrent, le bouton retour
// Android ferme d'abord la dernière surface ouverte (spec §9.3).
const handlers: (() => boolean)[] = [];

export function pushBackHandler(handler: () => boolean): () => void {
  handlers.push(handler);
  return () => {
    const i = handlers.indexOf(handler);
    if (i >= 0) handlers.splice(i, 1);
  };
}

export function popBackHandler(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]!()) return true;
  }
  return false;
}

// Enregistre automatiquement un handler quand une surface est ouverte.
export function useBackClose(open: boolean, close: () => void): void {
  useEffect(() => {
    if (!open) return;
    return pushBackHandler(() => {
      close();
      return true;
    });
  }, [open, close]);
}
