import { useEffect, type CSSProperties, type ReactNode } from 'react';

// ————— TopTabs : onglets soulignés (À VOIR / À VENIR, À PROPOS / ÉPISODES) —————
export function TopTabs({
  tabs,
  active,
  onChange,
  dark = false,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
  dark?: boolean;
}) {
  return (
    <div
      role="tablist"
      style={{ height: 58 }}
      className={`sticky top-0 z-30 flex w-full ${dark ? 'bg-black' : 'bg-white'}`}
    >
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab)}
            className="relative flex-1 uppercase"
            style={{
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: isActive ? (dark ? '#FFFFFF' : '#000000') : 'var(--color-text-soft)',
            }}
          >
            {tab}
            <span
              aria-hidden
              className="absolute bottom-0 left-0 w-full"
              style={{ height: 4, background: isActive ? (dark ? '#FFFFFF' : '#000000') : 'transparent' }}
            />
          </button>
        );
      })}
    </div>
  );
}

// ————— PillHeader : pill gris centré (À VOIR, PAS COMMENCÉ, AUJOURD'HUI…) —————
export function PillHeader({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-3">
      <span
        className="uppercase text-white"
        style={{
          background: 'var(--color-pill-grey)',
          borderRadius: 999,
          padding: '7px 18px',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ————— GridToggleButton —————
export function GridToggleButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={active ? 'Vue liste' : 'Vue grille'}
      aria-pressed={active}
      className="flex items-center justify-center"
      style={{
        width: 38,
        height: 38,
        borderRadius: 8,
        background: active ? 'var(--color-primary-yellow)' : 'var(--color-chip-grey)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        {[0, 10].flatMap((x) =>
          [0, 10].map((y) => <rect key={`${x}${y}`} x={x} y={y} width="8" height="8" rx="1" fill="#000" />),
        )}
      </svg>
    </button>
  );
}

// ————— ShowPill : pill bordée noire avec chevron (nom de série) —————
export function ShowPill({ label, onClick }: { label: string; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1 bg-white uppercase"
      style={{
        border: '2px solid #000',
        borderRadius: 999,
        padding: '3px 12px',
        fontSize: 12.5,
        fontWeight: 800,
        letterSpacing: '0.03em',
      }}
    >
      <span className="truncate">{label}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden className="shrink-0">
        <path d="M3 1l4 4-4 4" stroke="#000" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// ————— Badge : PREMIERE / NOUVEAU / PLUS RÉCENT —————
export function Badge({ label, variant }: { label: string; variant: 'black' | 'yellow' }) {
  return (
    <span
      className="uppercase"
      style={{
        background: variant === 'yellow' ? 'var(--color-primary-yellow)' : '#000',
        color: variant === 'yellow' ? '#000' : '#FFF',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.04em',
        padding: '3px 8px',
        borderRadius: 3,
      }}
    >
      {label}
    </span>
  );
}

// ————— CheckCircle : rond de validation épisode —————
export function CheckCircle({
  checked,
  onClick,
  size = 52,
  label = 'Marquer vu',
}: {
  checked?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  size?: number;
  label?: string;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={checked}
      onClick={onClick}
      className={checked ? 'check-pop' : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: checked ? 'var(--color-primary-yellow)' : '#F7F7F7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 12.5l5.5 5.5L20 7"
          stroke={checked ? '#000' : '#9B9B9B'}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// ————— PosterTile / PosterGrid —————
export function PosterTile({
  posterUrl,
  title,
  onClick,
  onLongPress,
}: {
  posterUrl: string | null;
  title: string;
  onClick?: () => void;
  onLongPress?: () => void;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (
    <button
      aria-label={title}
      onClick={onClick}
      onTouchStart={() => {
        if (onLongPress) timer = setTimeout(onLongPress, 500);
      }}
      onTouchEnd={() => timer && clearTimeout(timer)}
      onTouchMove={() => timer && clearTimeout(timer)}
      className="block w-full overflow-hidden"
      style={{ aspectRatio: '2 / 3', borderRadius: 3, background: '#E5E5E5' }}
    >
      {posterUrl ? (
        <img src={posterUrl} alt={title} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center px-2 text-center"
          style={{ fontSize: 13, fontWeight: 700, color: '#666' }}
        >
          {title}
        </span>
      )}
    </button>
  );
}

export function PosterGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-3" style={{ gap: 4 }}>
      {children}
    </div>
  );
}

// ————— FloatingFilterButton —————
export function FloatingFilterButton({ label = 'FILTRES', onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="floating-filter-button fixed left-1/2 z-40 -translate-x-1/2 uppercase"
      style={{
        background: 'var(--color-primary-yellow)',
        borderRadius: 999,
        padding: '13px 30px',
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: '0.05em',
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
      }}
    >
      {label}
    </button>
  );
}

// ————— BottomSheet / ActionSheet —————
export function BottomSheet({
  open,
  onClose,
  children,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <button
        aria-label="Fermer"
        className="absolute inset-0"
        style={{ background: 'var(--overlay-dark)' }}
        onClick={onClose}
      />
      <div
        className="bottom-sheet absolute bottom-0 left-0 right-0 bg-white"
        style={{ borderRadius: '5px 5px 0 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.18)' }}
      >
        {children}
      </div>
    </div>
  );
}

export type ActionSheetItem = {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  highlighted?: boolean; // ligne statut avec bordure jaune dessous
  muted?: boolean;
};

export function ActionSheet({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: ActionSheetItem[];
}) {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Menu">
      <div>
        {items.map((item, i) => (
          <button
            key={item.label}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
            className="flex w-full items-center gap-4 px-6 text-left"
            style={{
              height: 62,
              fontSize: 18,
              fontWeight: item.muted ? 400 : 600,
              color: item.muted ? 'var(--color-text-muted)' : '#000',
              background: item.highlighted ? 'var(--color-chip-grey)' : '#FFF',
              borderBottom: item.highlighted
                ? '3px solid var(--color-primary-yellow)'
                : i < items.length - 1
                  ? '1px solid var(--color-border-light)'
                  : 'none',
            }}
          >
            {item.icon && (
              <span aria-hidden className="flex w-6 justify-center">
                {item.icon}
              </span>
            )}
            {item.label}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

// ————— ToggleSwitch —————
export function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        width: 52,
        height: 30,
        borderRadius: 999,
        background: checked ? 'var(--color-primary-yellow)' : '#DDD',
        position: 'relative',
        transition: 'background 150ms ease-out',
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 26 : 3,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: checked ? '#000' : '#FFF',
          transition: 'left 150ms ease-out',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  );
}

// ————— RadioOption : cercle jaune avec coche (spec §23.1, §26.2) —————
export function RadioOption({
  selected,
  label,
  onSelect,
  trailing = false,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
  trailing?: boolean;
}) {
  const circle = selected ? (
    <span
      aria-hidden
      className="flex items-center justify-center"
      style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary-yellow)' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M4 12.5l5.5 5.5L20 7" stroke="#000" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  ) : (
    <span
      aria-hidden
      style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--color-border)' }}
    />
  );
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex w-full items-center justify-between px-6"
      style={{ height: 56, fontSize: 18 }}
    >
      {trailing ? (
        <>
          <span>{label}</span>
          {circle}
        </>
      ) : (
        <span className="flex items-center gap-4">
          {circle}
          <span>{label}</span>
        </span>
      )}
    </button>
  );
}

// ————— Chip (tri bottom sheet) —————
export function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="shrink-0"
      style={{
        background: active ? 'var(--color-primary-yellow)' : 'var(--color-chip-selected-grey)',
        borderRadius: 999,
        padding: '12px 22px',
        fontSize: 16,
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}

// ————— EmptyState —————
export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <p style={{ fontSize: 20, fontWeight: 800 }}>{title}</p>
      {message && (
        <p className="mt-2" style={{ fontSize: 15, color: 'var(--color-text-muted)' }}>
          {message}
        </p>
      )}
    </div>
  );
}

// ————— SkeletonBlock —————
export function SkeletonBlock({ style }: { style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      className="animate-pulse"
      style={{ background: '#EAEAEA', borderRadius: 5, ...style }}
    />
  );
}

// ————— Toast —————
export function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 z-[60] -translate-x-1/2"
      style={{
        bottom: 'calc(96px + env(safe-area-inset-bottom))',
        background: '#000',
        color: '#FFF',
        borderRadius: 999,
        padding: '10px 20px',
        fontSize: 14,
        fontWeight: 600,
        boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
      }}
    >
      {message}
    </div>
  );
}
