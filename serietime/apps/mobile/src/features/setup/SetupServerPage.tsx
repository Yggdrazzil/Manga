import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, checkHealth } from '../../lib/api.js';
import { useAppStore } from '../../lib/store.js';

const ERROR_MESSAGES: Record<string, string> = {
  network: 'Serveur inaccessible',
  tls: 'Certificat HTTPS invalide',
  invalid_server: 'Réponse serveur invalide',
  invalid_response: 'Réponse serveur invalide',
  version: 'Version serveur incompatible',
};

export function SetupServerPage() {
  const navigate = useNavigate();
  const { serverUrl, setServerUrl } = useAppStore();
  const [url, setUrl] = useState(serverUrl ?? '');
  const [testing, setTesting] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const test = async () => {
    setTesting(true);
    setError(null);
    setOk(false);
    try {
      await checkHealth(url);
      setOk(true);
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'invalid_server' || err.code === 'invalid_response')) {
        setError(ERROR_MESSAGES[err.code] ?? 'Réponse serveur invalide');
      } else if (err instanceof TypeError || (err instanceof DOMException && err.name === 'TimeoutError')) {
        setError(ERROR_MESSAGES['network'] ?? '');
      } else {
        setError(ERROR_MESSAGES['network'] ?? '');
      }
    } finally {
      setTesting(false);
    }
  };

  const proceed = () => {
    setServerUrl(url);
    navigate('/login');
  };

  return (
    <div className="safe-top flex min-h-full flex-col px-6 pt-16">
      <h1 style={{ fontSize: 34, fontWeight: 800 }}>SerieTime</h1>
      <p className="mt-6" style={{ fontSize: 17, color: 'var(--color-text-muted)' }}>
        Connectez votre application à votre serveur personnel.
      </p>
      <label className="mt-10 block" style={{ fontSize: 14, fontWeight: 700 }} htmlFor="server-url">
        URL du serveur
      </label>
      <input
        id="server-url"
        type="url"
        inputMode="url"
        autoCapitalize="off"
        placeholder="https://..."
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setOk(false);
        }}
        className="mt-2 w-full bg-transparent py-3 outline-none"
        style={{ borderBottom: '1px solid var(--color-border)', fontSize: 18 }}
      />
      {error && (
        <p role="alert" className="mt-3" style={{ color: 'var(--color-red-dot)', fontSize: 15 }}>
          {error}
        </p>
      )}
      {ok && (
        <p className="mt-3" style={{ color: 'var(--color-success-green)', fontSize: 15, fontWeight: 600 }}>
          Connexion réussie
        </p>
      )}
      <button
        onClick={() => void test()}
        disabled={!url || testing}
        className="mt-10 w-full uppercase disabled:opacity-40"
        style={{
          border: '2px solid #000',
          borderRadius: 999,
          padding: '15px 0',
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '0.05em',
        }}
      >
        {testing ? 'Test en cours…' : 'Tester la connexion'}
      </button>
      <button
        onClick={proceed}
        disabled={!ok}
        className="mt-4 w-full uppercase disabled:opacity-40"
        style={{
          background: 'var(--color-primary-yellow)',
          borderRadius: 999,
          padding: '15px 0',
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '0.05em',
        }}
      >
        Continuer
      </button>
    </div>
  );
}
