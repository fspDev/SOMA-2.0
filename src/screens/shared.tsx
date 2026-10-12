import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button, Sheet, cx, useToast } from '../ui/kit';
import { setIntention } from '../db/repo';
import type { Settings } from '../db/types';
import type { ISODate } from '../lib/dates';
import type { Metric } from '../lib/metrics';

export function MetricDot({ metric, className }: { metric: Pick<Metric, 'color'>; className?: string }) {
  return <span aria-hidden className={cx('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: metric.color }} />;
}

/** Tinte suave del color de una métrica, sobre la superficie actual. */
export function tint(color: string, pct = 18): string {
  return `color-mix(in srgb, ${color} ${pct}%, var(--surface))`;
}

export function IntentionCard({ settings, today }: { settings: Settings; today: ISODate }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(settings.intention);
  const toast = useToast();
  return (
    <>
      <button
        onClick={() => {
          setDraft(settings.intention);
          setOpen(true);
        }}
        className="card block w-full px-5 py-4 text-left"
      >
        <div className="label mb-1.5 flex items-center justify-between">
          Tu intención
          <Pencil size={13} className="text-faint" aria-hidden />
        </div>
        {settings.intention ? (
          <p className="text-[16px] leading-snug font-medium">{settings.intention}</p>
        ) : (
          <p className="text-[15px] text-muted">¿Para qué hacés este viaje? Tocá para escribirlo.</p>
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Tu intención">
        <p className="mb-3 text-[14px] text-muted">Una frase corta que puedas recordar cada día.</p>
        <textarea
          className="field min-h-[110px] resize-none text-[16px]"
          value={draft}
          maxLength={200}
          placeholder="Escuchar antes de responder."
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          block
          className="mt-4"
          onClick={async () => {
            await setIntention(draft, today);
            setOpen(false);
            toast('Intención guardada');
          }}
        >
          Guardar
        </Button>
      </Sheet>
    </>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-6 text-center text-[14px] leading-relaxed text-muted">{children}</p>;
}
