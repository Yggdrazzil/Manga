import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export function PageHeader({
  title,
  right,
  onBack,
}: {
  title: string;
  right?: ReactNode;
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <header className="safe-top sticky top-0 z-30 bg-white">
      <div className="relative flex items-center justify-center" style={{ height: 60 }}>
        <button
          aria-label="Retour"
          onClick={onBack ?? (() => navigate(-1))}
          className="absolute left-2 flex h-11 w-11 items-center justify-center"
        >
          <ChevronLeft size={28} strokeWidth={2.2} aria-hidden />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>{title}</h1>
        {right && <div className="absolute right-3">{right}</div>}
      </div>
    </header>
  );
}
