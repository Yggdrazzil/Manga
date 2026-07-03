import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAppStore } from '../../lib/store.js';

type AuthResponse = {
  token: string;
  user: { id: string; displayName: string; email?: string | null };
};

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAppStore((s) => s.setAuth);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ needsSetup: boolean }>('/api/auth/needs-setup')
      .then((r) => setNeedsSetup(r.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = needsSetup
        ? await api.post<AuthResponse>('/api/auth/setup', {
            displayName,
            password,
            ...(email ? { email } : {}),
          })
        : await api.post<AuthResponse>('/api/auth/login', { password });
      setAuth(res.token, res.user);
      navigate('/shows', { replace: true });
    } catch {
      setError(needsSetup ? 'Impossible de créer le compte' : 'Mot de passe incorrect');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = { borderBottom: '1px solid var(--color-border)', fontSize: 18 } as const;

  return (
    <div className="safe-top flex min-h-full flex-col px-6 pt-16">
      <h1 style={{ fontSize: 34, fontWeight: 800 }}>SerieTime</h1>
      <p className="mt-6" style={{ fontSize: 17, color: 'var(--color-text-muted)' }}>
        {needsSetup === null
          ? 'Connexion au serveur…'
          : needsSetup
            ? 'Créez votre compte local.'
            : 'Connectez-vous.'}
      </p>
      {needsSetup && (
        <>
          <label className="mt-8 block" style={{ fontSize: 14, fontWeight: 700 }} htmlFor="name">
            Nom d'affichage
          </label>
          <input
            id="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-2 w-full bg-transparent py-3 outline-none"
            style={inputStyle}
          />
          <label className="mt-6 block" style={{ fontSize: 14, fontWeight: 700 }} htmlFor="email">
            E-mail (optionnel)
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full bg-transparent py-3 outline-none"
            style={inputStyle}
          />
        </>
      )}
      {needsSetup !== null && (
        <>
          <label className="mt-6 block" style={{ fontSize: 14, fontWeight: 700 }} htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            className="mt-2 w-full bg-transparent py-3 outline-none"
            style={inputStyle}
          />
          {error && (
            <p role="alert" className="mt-3" style={{ color: 'var(--color-red-dot)', fontSize: 15 }}>
              {error}
            </p>
          )}
          <button
            onClick={() => void submit()}
            disabled={busy || !password || (needsSetup === true && !displayName)}
            className="mt-10 w-full uppercase disabled:opacity-40"
            style={{
              background: 'var(--color-primary-yellow)',
              borderRadius: 999,
              padding: '15px 0',
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '0.05em',
            }}
          >
            {needsSetup ? 'Créer le compte' : 'Se connecter'}
          </button>
        </>
      )}
      <button
        onClick={() => navigate('/setup-server')}
        className="mt-6"
        style={{ color: 'var(--color-blue-link)', fontSize: 15 }}
      >
        Changer de serveur
      </button>
    </div>
  );
}
