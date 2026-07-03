import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, uploadImportZip } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';
import { useToast } from '../../hooks/useToast.js';

// Écran d'import TV Time (spec §15.2).
export function ImportTvtimePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'analyzing'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [duplicateImportId, setDuplicateImportId] = useState<string | null>(null);

  const start = async (force = false) => {
    if (!file) return;
    setError(null);
    setDuplicateImportId(null);
    setPhase('uploading');
    setProgress(0);
    try {
      const uploaded = await uploadImportZip(file, force, setProgress);
      if (uploaded.error === 'already_imported') {
        setDuplicateImportId(uploaded.importId ?? null);
        setPhase('idle');
        return;
      }
      if (uploaded.error === 'not_a_zip') {
        setError("Ce fichier n'est pas une archive ZIP valide.");
        setPhase('idle');
        return;
      }
      if (!uploaded.importId) {
        setError("Échec de l'import du fichier.");
        setPhase('idle');
        return;
      }
      setPhase('analyzing');
      await api.post(`/api/import/tvtime/${uploaded.importId}/analyze`);
      navigate(`/settings/import-tvtime/${uploaded.importId}`);
    } catch {
      setError('Serveur inaccessible. Vérifiez votre connexion.');
      setPhase('idle');
    }
  };

  return (
    <div className="min-h-full bg-white">
      <PageHeader title="Importer TV Time" />
      <div className="px-6 py-6">
        <p style={{ fontSize: 17, color: 'var(--color-text-muted)' }}>
          Importez votre archive TV Time pour récupérer votre historique dans SerieTime.
        </p>

        {phase === 'idle' && (
          <>
            <button
              onClick={() => fileInput.current?.click()}
              className="mt-8 w-full uppercase"
              style={{ background: 'var(--color-primary-yellow)', borderRadius: 999, padding: '15px 0', fontSize: 15, fontWeight: 800, letterSpacing: '0.05em' }}
            >
              Choisir un fichier .zip
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              aria-label="Archive TV Time"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
                setError(null);
                setDuplicateImportId(null);
              }}
            />

            {file && (
              <div className="mt-8" style={{ border: '1px solid var(--color-border)', borderRadius: 5, padding: 20 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-muted)' }}>Fichier sélectionné</p>
                <p className="mt-1 truncate" style={{ fontSize: 18, fontWeight: 700 }}>
                  {file.name}
                </p>
                <p style={{ fontSize: 15, color: 'var(--color-text-muted)' }}>
                  {(file.size / (1024 * 1024)).toFixed(1)} Mo
                </p>
                <button
                  onClick={() => void start()}
                  className="mt-5 w-full uppercase"
                  style={{ border: '2px solid #000', borderRadius: 999, padding: '13px 0', fontSize: 14, fontWeight: 800, letterSpacing: '0.05em' }}
                >
                  Analyser
                </button>
              </div>
            )}

            {duplicateImportId && (
              <div className="mt-6" style={{ background: 'var(--color-primary-yellow-soft)', borderRadius: 5, padding: 16 }}>
                <p style={{ fontSize: 15.5 }}>Ce fichier a déjà été importé.</p>
                <div className="mt-3 flex gap-4">
                  <button
                    onClick={() => navigate(`/settings/import-tvtime/${duplicateImportId}`)}
                    className="uppercase"
                    style={{ fontSize: 13, fontWeight: 800 }}
                  >
                    Voir l'import
                  </button>
                  <button
                    onClick={() => {
                      toast('Réimport forcé');
                      void start(true);
                    }}
                    className="uppercase"
                    style={{ fontSize: 13, fontWeight: 800 }}
                  >
                    Réimporter quand même
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-4" style={{ color: 'var(--color-red-dot)', fontSize: 15 }}>
                {error}
              </p>
            )}
          </>
        )}

        {phase === 'uploading' && (
          <div className="mt-10">
            <p style={{ fontSize: 18, fontWeight: 700 }}>Import du fichier...</p>
            <div className="mt-4 overflow-hidden" style={{ height: 10, borderRadius: 999, background: 'var(--color-chip-grey)' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--color-primary-yellow)', transition: 'width 200ms' }} />
            </div>
            <p className="mt-2 text-right" style={{ fontSize: 15, fontWeight: 700 }}>
              {progress} %
            </p>
          </div>
        )}

        {phase === 'analyzing' && (
          <div className="mt-10">
            <p style={{ fontSize: 18, fontWeight: 700 }}>Analyse de l'archive...</p>
            <ol className="mt-4 flex flex-col gap-2" style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>
              <li>1. Lecture du ZIP</li>
              <li>2. Détection des fichiers</li>
              <li>3. Lecture des séries</li>
              <li>4. Lecture des épisodes</li>
              <li>5. Lecture des films</li>
              <li>6. Matching des contenus</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
