import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { RadioOption, ToggleSwitch } from '@serietime/ui';
import { api } from '../../lib/api.js';
import { useAppStore } from '../../lib/store.js';
import { PageHeader } from '../../components/PageHeader.js';
import { useToast } from '../../hooks/useToast.js';

type Settings = {
  titlesInUserLanguage: boolean;
  theme: 'system' | 'light' | 'dark';
  autoplayTrailers: boolean;
  upcoming: { hideWatched: boolean; channels: string[] };
  appLock: boolean;
};

const TABS = ['COMPTE', 'APPLICATION', 'À VENIR'];

export function SettingsPage() {
  const [tab, setTab] = useState('COMPTE');
  return (
    <div className="min-h-full bg-white pb-10">
      <PageHeader title="Paramètres" />
      <div role="tablist" className="sticky top-0 z-20 flex bg-white" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
        {TABS.map((t) => {
          const active = t === tab;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              className="relative flex-1 py-4 uppercase"
              style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.04em', color: active ? '#000' : 'var(--color-text-soft)' }}
            >
              {t}
              <span aria-hidden className="absolute bottom-0 left-0 w-full" style={{ height: 4, background: active ? '#000' : 'transparent' }} />
            </button>
          );
        })}
      </div>
      {tab === 'COMPTE' ? <AccountTab /> : tab === 'APPLICATION' ? <ApplicationTab /> : <UpcomingTab />}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-6 pt-7" style={{ fontSize: 23, fontWeight: 800 }}>
      {children}
    </h2>
  );
}

function Row({ label, sub, onClick, chevron = true }: { label: string; sub?: string; onClick?: () => void; chevron?: boolean }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between px-6 py-4 text-left" disabled={!onClick}>
      <span>
        <span className="block" style={{ fontSize: 19 }}>
          {label}
        </span>
        {sub && (
          <span className="block" style={{ fontSize: 14.5, color: 'var(--color-text-muted)' }}>
            {sub}
          </span>
        )}
      </span>
      {chevron && onClick && <ChevronRight size={22} color="#000" aria-hidden />}
    </button>
  );
}

function Divider() {
  return <div aria-hidden style={{ height: 1, background: 'var(--color-border-light)', margin: '12px 0' }} />;
}

// Onglet COMPTE (spec §26.1)
function AccountTab() {
  const navigate = useNavigate();
  const { user, logout } = useAppStore();
  const toast = useToast();
  const [changingPassword, setChangingPassword] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');

  return (
    <div>
      <SectionTitle>Identification</SectionTitle>
      <div className="px-6 py-3">
        <p style={{ fontSize: 17 }}>Nom d'utilisateur</p>
        <p style={{ fontSize: 17, color: 'var(--color-blue-link)' }}>{user?.displayName}</p>
        <p className="mt-4" style={{ fontSize: 17 }}>
          Adresse e-mail
        </p>
        <p style={{ fontSize: 17, color: 'var(--color-blue-link)' }}>{user?.email || '—'}</p>
        <p className="mt-4" style={{ fontSize: 17 }}>
          Identifiant utilisateur
        </p>
        <p style={{ fontSize: 17, color: 'var(--color-text-muted)' }}>{user?.id}</p>
      </div>
      <Row label="Modifier le mot de passe" onClick={() => setChangingPassword(true)} />
      <Divider />

      <SectionTitle>Import & sauvegarde</SectionTitle>
      <Row label="Importer mes données TV Time" onClick={() => navigate('/settings/import-tvtime')} />
      <Row label="Exporter mes données SerieTime" onClick={() => navigate('/settings/backup')} />
      <Row label="Sauvegarde locale" onClick={() => navigate('/settings/backup')} />
      <Divider />

      <SectionTitle>Services d'abonnement</SectionTitle>
      <Row label="Modifier vos services d'abonnement" onClick={() => navigate('/settings/subscriptions')} />
      <Divider />

      <SectionTitle>Vie privée locale</SectionTitle>
      <Row
        label="Lire la politique de confidentialité locale"
        chevron={false}
        onClick={() => toast('Vos données restent sur votre serveur personnel.')}
      />
      <LockRow />
      <Divider />

      <div className="flex flex-col items-center gap-6 px-6 py-8">
        <button
          onClick={logout}
          className="uppercase"
          style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.05em' }}
        >
          Se déconnecter
        </button>
        <button
          onClick={() => toast('Suppression du compte : gérez la base sur votre serveur.')}
          className="uppercase"
          style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.05em', color: 'var(--color-red-dot)' }}
        >
          Supprimer le compte
        </button>
      </div>

      {changingPassword && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center" role="dialog" aria-modal="true">
          <button aria-label="Fermer" className="absolute inset-0" style={{ background: 'var(--overlay-dark)' }} onClick={() => setChangingPassword(false)} />
          <div className="relative mx-8 w-full max-w-sm bg-white p-6" style={{ borderRadius: 5 }}>
            <p style={{ fontSize: 18, fontWeight: 700 }}>Modifier le mot de passe</p>
            <input
              type="password"
              placeholder="Mot de passe actuel"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="mt-4 w-full py-2 outline-none"
              style={{ borderBottom: '1px solid var(--color-border)', fontSize: 17 }}
            />
            <input
              type="password"
              placeholder="Nouveau mot de passe"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="mt-3 w-full py-2 outline-none"
              style={{ borderBottom: '1px solid var(--color-border)', fontSize: 17 }}
            />
            <div className="mt-6 flex justify-end gap-6">
              <button onClick={() => setChangingPassword(false)} className="uppercase" style={{ fontSize: 14, fontWeight: 800 }}>
                Annuler
              </button>
              <button
                onClick={() =>
                  void api
                    .post('/api/auth/password', { currentPassword: current, newPassword: next })
                    .then(() => {
                      toast('Mot de passe modifié');
                      setChangingPassword(false);
                    })
                    .catch(() => toast('Mot de passe actuel incorrect'))
                }
                className="uppercase"
                style={{ fontSize: 14, fontWeight: 800 }}
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LockRow() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<{ settings: Settings }>('/api/settings') });
  const update = useMutation({
    mutationFn: (patch: Partial<Settings>) => api.post('/api/settings', patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <span style={{ fontSize: 19 }}>Verrouiller l'application</span>
      <ToggleSwitch checked={data?.settings.appLock ?? false} onChange={(v) => update.mutate({ appLock: v })} label="Verrouiller l'application" />
    </div>
  );
}

// Onglet APPLICATION (spec §26.2)
function ApplicationTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<{ settings: Settings }>('/api/settings') });
  const update = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.post('/api/settings', patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });
  const settings = data?.settings;

  return (
    <div>
      <SectionTitle>Titres</SectionTitle>
      <div className="flex items-center justify-between px-6 py-4">
        <span>
          <span className="block" style={{ fontSize: 19 }}>
            Afficher dans votre langue
          </span>
          <span className="block" style={{ fontSize: 14.5, color: 'var(--color-text-muted)' }}>
            Les titres s'affichent par défaut en anglais
          </span>
        </span>
        <ToggleSwitch
          checked={settings?.titlesInUserLanguage ?? true}
          onChange={(v) => update.mutate({ titlesInUserLanguage: v })}
          label="Afficher dans votre langue"
        />
      </div>
      <Divider />

      <SectionTitle>Commentaires privés</SectionTitle>
      <Row
        label="Sélectionnez les langues des notes/commentaires privés"
        sub="Les commentaires sont affichés par défaut en anglais et dans la langue de votre appareil"
        onClick={() => toast('Langues des commentaires : fr, en')}
      />
      <Divider />

      <SectionTitle>Notifications</SectionTitle>
      <Row label="Sélectionnez les alertes que vous souhaitez recevoir" onClick={() => navigate('/settings/notifications')} />
      <Divider />

      <SectionTitle>Thème</SectionTitle>
      <div role="radiogroup" aria-label="Thème">
        {(
          [
            ['system', "Suivre le thème défini sur l'appareil"],
            ['light', 'Thème clair'],
            ['dark', 'Thème sombre'],
          ] as const
        ).map(([value, label]) => (
          <RadioOption
            key={value}
            label={label}
            selected={(settings?.theme ?? 'light') === value}
            onSelect={() => update.mutate({ theme: value })}
          />
        ))}
      </div>
      <Divider />

      <SectionTitle>Recommandations</SectionTitle>
      <Row label="Gérer les séries et films non appréciés" onClick={() => navigate('/settings/disliked')} />
      <Divider />

      <SectionTitle>Flux</SectionTitle>
      <div className="flex items-center justify-between px-6 py-4">
        <span>
          <span className="block" style={{ fontSize: 19 }}>
            Lecture automatique des vidéos
          </span>
          <span className="block" style={{ fontSize: 14.5, color: 'var(--color-text-muted)' }}>
            Lire automatiquement les bandes annonces vidéo
          </span>
        </span>
        <ToggleSwitch
          checked={settings?.autoplayTrailers ?? false}
          onChange={(v) => update.mutate({ autoplayTrailers: v })}
          label="Lecture automatique des vidéos"
        />
      </div>
      <Divider />

      <SectionTitle>Cache</SectionTitle>
      <div className="px-6 py-5">
        <button
          onClick={() =>
            void api.post('/api/cache/clear').then(() => {
              localStorage.removeItem('serietime-query-cache');
              toast('Cache vidé');
            })
          }
          className="w-full uppercase"
          style={{ border: '2px solid #000', borderRadius: 999, padding: '14px 0', fontSize: 14, fontWeight: 800, letterSpacing: '0.05em' }}
        >
          Vider le cache
        </button>
      </div>

      <p className="px-6 py-6 text-center uppercase" style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>
        Version 1.0.0
      </p>
    </div>
  );
}

// Onglet À VENIR (spec §26.3)
function UpcomingTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => api.get<{ settings: Settings }>('/api/settings') });
  const update = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.post('/api/settings', patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });
  return (
    <div>
      <SectionTitle>Épisodes à afficher</SectionTitle>
      <Row label="Choix des chaînes" onClick={() => navigate('/settings/channels')} />
      <div className="flex items-center justify-between px-6 py-4">
        <span style={{ fontSize: 19 }}>Masquer les épisodes vus</span>
        <ToggleSwitch
          checked={data?.settings.upcoming.hideWatched ?? false}
          onChange={(v) => update.mutate({ upcoming: { ...(data?.settings.upcoming ?? { channels: [] }), hideWatched: v } })}
          label="Masquer les épisodes vus"
        />
      </div>
    </div>
  );
}
