import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImportAnalysisSummary } from '@serietime/types';
import { SkeletonBlock } from '@serietime/ui';
import { api } from '../../lib/api.js';
import { PageHeader } from '../../components/PageHeader.js';
import { useToast } from '../../hooks/useToast.js';

type ImportDetail = {
  importId: string;
  fileName: string;
  status: 'uploaded' | 'analyzed' | 'imported' | 'failed';
  summary: ImportAnalysisSummary | null;
  mappingCounts: { matched_auto: number; matched_manual: number; unresolved: number; ignored: number };
};

// Rapport d'analyse (spec §15.2).
export function ImportDetailPage() {
  const { importId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['import', importId],
    queryFn: () => api.get<ImportDetail>(`/api/import/tvtime/${importId}`),
  });

  const confirm = useMutation({
    mutationFn: () => api.post<{ applied: number }>(`/api/import/tvtime/${importId}/confirm`),
    onSuccess: (res) => {
      toast(`${res.applied} éléments importés`);
      void queryClient.invalidateQueries();
    },
  });

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Importer TV Time" />
        <div className="p-6">
          <SkeletonBlock style={{ height: 300 }} />
        </div>
      </div>
    );
  }

  const s = data.summary;
  const unresolvedCount = data.mappingCounts.unresolved;

  return (
    <div className="min-h-full bg-white pb-10">
      <PageHeader title="Importer TV Time" />
      <div className="px-6 py-4">
        <h2 style={{ fontSize: 24, fontWeight: 800 }}>
          {data.status === 'imported' ? 'Import terminé' : 'Archive analysée'}
        </h2>
        <p className="mt-1 truncate" style={{ fontSize: 15, color: 'var(--color-text-muted)' }}>
          {data.fileName}
        </p>

        {s && (
          <div className="mt-6 flex flex-col gap-2" style={{ fontSize: 17 }}>
            <Row label="Séries détectées" value={s.showsDetected} />
            <Row label="Films détectés" value={s.moviesDetected} />
            <Row label="Épisodes vus détectés" value={s.episodesWatchedDetected} />
            <Row label="Notes détectées" value={s.ratingsDetected} />
            <Row label="Favoris détectés" value={s.favoritesDetected} />
            <Row label="Listes détectées" value={s.listsDetected} />
            <div aria-hidden style={{ height: 1, background: 'var(--color-border-light)', margin: '10px 0' }} />
            <Row label="Import automatique" value={s.autoImport} strong />
            <Row label="À vérifier" value={s.toVerify} />
            <Row label="Non reconnus" value={unresolvedCount} />
            <Row label="Doublons ignorés" value={s.duplicatesIgnored} />
          </div>
        )}

        {data.status !== 'imported' && (
          <button
            onClick={() => confirm.mutate()}
            disabled={confirm.isPending}
            className="mt-8 w-full uppercase disabled:opacity-40"
            style={{ background: 'var(--color-primary-yellow)', borderRadius: 999, padding: '15px 0', fontSize: 15, fontWeight: 800, letterSpacing: '0.05em' }}
          >
            {confirm.isPending ? 'Import en cours…' : 'Importer'}
          </button>
        )}
        {unresolvedCount > 0 && (
          <button
            onClick={() => navigate(`/settings/import-tvtime/${importId}/unresolved`)}
            className="mt-4 w-full uppercase"
            style={{ border: '2px solid #000', borderRadius: 999, padding: '15px 0', fontSize: 15, fontWeight: 800, letterSpacing: '0.05em' }}
          >
            Voir les éléments à résoudre
          </button>
        )}
        {data.status === 'imported' && (
          <button
            onClick={() => navigate('/shows')}
            className="mt-4 w-full uppercase"
            style={{ border: '2px solid #000', borderRadius: 999, padding: '15px 0', fontSize: 15, fontWeight: 800, letterSpacing: '0.05em' }}
          >
            Voir mes séries
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <p className="flex justify-between">
      <span style={{ fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span style={{ fontWeight: 800 }}>{value}</span>
    </p>
  );
}
