import { useBackClose } from '../hooks/useBackButton.js';

export function ExitConfirmDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useBackClose(open, onClose);
  if (!open) return null;
  const exit = async () => {
    try {
      const { App: CapApp } = await import('@capacitor/app');
      await CapApp.exitApp();
    } catch {
      onClose();
    }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" role="alertdialog" aria-modal="true">
      <button aria-label="Annuler" className="absolute inset-0" style={{ background: 'var(--overlay-dark)' }} onClick={onClose} />
      <div className="relative mx-8 w-full max-w-sm bg-white p-6" style={{ borderRadius: 5 }}>
        <p style={{ fontSize: 18, fontWeight: 700 }}>Quitter SerieTime ?</p>
        <div className="mt-6 flex justify-end gap-6">
          <button onClick={onClose} className="uppercase" style={{ fontSize: 14, fontWeight: 800 }}>
            Annuler
          </button>
          <button onClick={() => void exit()} className="uppercase" style={{ fontSize: 14, fontWeight: 800 }}>
            Quitter
          </button>
        </div>
      </div>
    </div>
  );
}
