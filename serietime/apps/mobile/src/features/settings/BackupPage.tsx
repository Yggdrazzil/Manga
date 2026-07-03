import { useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';
import { useToast } from '../../hooks/useToast.js';

// Export / restauration des données SerieTime (spec §26.1, §37).
export function BackupPage() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const exportBackup = async () => {
    setBusy(true);
    try {
      const data = await api.post<Record<string, unknown>>('/api/backup/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `serietime-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Sauvegarde exportée');
    } catch {
      toast("Échec de l'export");
    } finally {
      setBusy(false);
    }
  };

  const importBackup = async (file: File) => {
    setBusy(true);
    try {
      const content = JSON.parse(await file.text()) as unknown;
      await api.post('/api/backup/import', content);
      toast('Sauvegarde restaurée');
    } catch {
      toast('Fichier de sauvegarde invalide');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full bg-white">
      <PageHeader title="Sauvegarde" />
      <div className="px-6 py-6">
        <p style={{ fontSize: 16.5, color: 'var(--color-text-muted)' }}>
          Exportez toutes vos données SerieTime (séries, épisodes vus, films, listes, favoris) dans un
          fichier JSON, ou restaurez une sauvegarde existante.
        </p>
        <button
          onClick={() => void exportBackup()}
          disabled={busy}
          className="mt-8 w-full uppercase disabled:opacity-40"
          style={{ background: 'var(--color-primary-yellow)', borderRadius: 999, padding: '15px 0', fontSize: 15, fontWeight: 800, letterSpacing: '0.05em' }}
        >
          Exporter mes données
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="mt-4 w-full uppercase disabled:opacity-40"
          style={{ border: '2px solid #000', borderRadius: 999, padding: '15px 0', fontSize: 15, fontWeight: 800, letterSpacing: '0.05em' }}
        >
          Restaurer une sauvegarde
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden"
          aria-label="Fichier de sauvegarde"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importBackup(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
