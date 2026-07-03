import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useAppStore } from '../../lib/store.js';

// Édition profil (spec §24).
export function ProfileEditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, setUser } = useAppStore();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [birthYear, setBirthYear] = useState(user?.birthYear ? String(user.birthYear) : '');
  const [gender, setGender] = useState(user?.gender ?? '');
  const [countryCode, setCountryCode] = useState(user?.countryCode ?? 'FR');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [coverUrl, setCoverUrl] = useState(user?.coverUrl ?? '');

  const dirty =
    displayName !== (user?.displayName ?? '') ||
    birthYear !== (user?.birthYear ? String(user.birthYear) : '') ||
    gender !== (user?.gender ?? '') ||
    countryCode !== (user?.countryCode ?? 'FR') ||
    avatarUrl !== (user?.avatarUrl ?? '') ||
    coverUrl !== (user?.coverUrl ?? '');

  const save = useMutation({
    mutationFn: () =>
      api.post('/api/profile', {
        displayName,
        birthYear: birthYear ? parseInt(birthYear, 10) : null,
        gender: gender || null,
        countryCode,
        avatarUrl: avatarUrl || null,
        coverUrl: coverUrl || null,
      }),
    onSuccess: () => {
      if (user) setUser({ ...user, displayName, birthYear: birthYear ? parseInt(birthYear, 10) : null, gender, countryCode, avatarUrl, coverUrl });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      navigate(-1);
    },
  });

  return (
    <div className="min-h-full bg-white">
      <header className="safe-top sticky top-0 z-30 bg-white">
        <div className="relative flex items-center justify-center" style={{ height: 60 }}>
          <button aria-label="Fermer" onClick={() => navigate(-1)} className="absolute left-3 flex h-11 w-11 items-center justify-center">
            <X size={26} aria-hidden />
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Modifier le profil</h1>
          <button
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
            className="absolute right-4 uppercase"
            style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.04em', color: dirty ? '#000' : 'var(--color-border)' }}
          >
            Sauvegarder
          </button>
        </div>
      </header>

      <div className="px-6 py-4">
        <label className="block py-3" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <span className="block" style={{ color: 'var(--color-blue-link)', fontSize: 17 }}>
            Choisir une photo de profil
          </span>
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="URL de l'image"
            className="mt-1 w-full bg-transparent outline-none"
            style={{ fontSize: 15, color: 'var(--color-text-muted)' }}
          />
        </label>
        <label className="block py-3" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <span className="block" style={{ color: 'var(--color-blue-link)', fontSize: 17 }}>
            Choisir une photo de couverture
          </span>
          <input
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="URL de l'image"
            className="mt-1 w-full bg-transparent outline-none"
            style={{ fontSize: 15, color: 'var(--color-text-muted)' }}
          />
        </label>

        <Field label="Nom d'affichage" value={displayName} onChange={setDisplayName} />

        <h2 className="mt-8" style={{ fontSize: 22, fontWeight: 800 }}>
          Informations personnelles
        </h2>
        <Field label="Année de naissance" value={birthYear} onChange={setBirthYear} type="number" />
        <Field label="Sexe" value={gender} onChange={setGender} />
        <Field label="Pays" value={countryCode} onChange={(v) => setCountryCode(v.toUpperCase().slice(0, 2))} />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-4" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
      <span className="shrink-0" style={{ fontSize: 17 }}>
        {label}
      </span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-right outline-none"
          style={{ fontSize: 17, color: 'var(--color-text-muted)' }}
        />
        {value && (
          <button aria-label={`Effacer ${label}`} onClick={() => onChange('')}>
            <X size={16} color="var(--color-text-soft)" aria-hidden />
          </button>
        )}
      </span>
    </label>
  );
}
