import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

// ── Botón ───────────────────────────────────────────────────────────────────

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'on-accent';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-bg',
  accent: 'bg-accent text-on-accent',
  secondary: 'bg-surface text-ink border border-line',
  ghost: 'text-ink',
  danger: 'bg-danger-tint text-danger',
  'on-accent': 'bg-white text-[#3b3fe0]',
};

export function Button({
  variant = 'primary',
  block,
  className,
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex h-[52px] items-center justify-center gap-2 rounded-[14px] px-5 text-[15px] font-semibold transition-[opacity,transform] active:scale-[0.985] disabled:opacity-50',
        VARIANTS[variant],
        block && 'w-full',
        className,
      )}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-label="Cargando"
      className={cx('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
    />
  );
}

// ── Segmentado ──────────────────────────────────────────────────────────────

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-[14px] bg-neutral p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-9 flex-1 rounded-[10px] text-[13px] font-medium transition-colors',
            o.value === value ? 'border border-line bg-surface text-ink' : 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Hoja inferior ───────────────────────────────────────────────────────────

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const first = panel.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])');
    (first ?? panel.current)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="anim-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="anim-sheet relative max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[24px] border border-line bg-bg px-5 pt-5 pb-safe outline-none"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button
            data-close
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-9 place-items-center rounded-full border border-line bg-surface text-muted"
          >
            <X size={16} />
          </button>
        </div>
        <div className="pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ── Confirmación ────────────────────────────────────────────────────────────

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="mb-5 text-[15px] leading-relaxed text-muted">{body}</div>
      <div className="flex flex-col gap-2">
        <Button
          variant={danger ? 'danger' : 'primary'}
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
        <Button variant="ghost" block onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Sheet>
  );
}

// ── Avisos ──────────────────────────────────────────────────────────────────

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  const show = useCallback((text: string) => setMsg({ text, id: Date.now() }), []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none">
        {msg && (
          <div
            key={msg.id}
            className="anim-toast fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-[14px] font-medium whitespace-nowrap text-bg"
          >
            {msg.text}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ── Varios ──────────────────────────────────────────────────────────────────

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const dot = size === 'lg' ? 'size-[18px]' : 'size-3';
  return (
    <div className="flex items-center gap-3" aria-label="SOMA">
      <div className="flex gap-1">
        <span className={cx(dot, 'rounded-full bg-accent')} />
        <span className={cx(dot, 'rounded-full bg-rest/40')} />
        <span className={cx(dot, 'rounded-full bg-rest/40')} />
      </div>
      <span className={cx('font-semibold tracking-[0.2em]', size === 'lg' ? 'text-[22px]' : 'text-[15px]')}>SOMA</span>
    </div>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h2 className="label">{children}</h2>
      {right}
    </div>
  );
}

/** Puntitos que representan el ritmo de un protocolo. */
export function RhythmDots({ on, off }: { on: number; off: number }) {
  const total = Math.min(on + off, 10);
  return (
    <div className="flex gap-[3px]" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cx('size-2 rounded-full', i < on ? 'bg-accent' : 'bg-rest/35')}
        />
      ))}
    </div>
  );
}
