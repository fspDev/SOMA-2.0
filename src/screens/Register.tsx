import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button, ConfirmSheet, cx, useToast } from '../ui/kit';
import { goBack, navigate } from '../ui/router';
import { normalizeTag, saveEntry, setDoseTaken } from '../db/repo';
import { useEntries, useEntry } from '../db/hooks';
import type { Entry, Settings } from '../db/types';
import { addDays, formatShort, formatShortWithWeekday, localTimeHHMM, type ISODate } from '../lib/dates';
import type { Metric } from '../lib/metrics';
import { dayInfo } from '../lib/protocol';
import { MetricDot, tint } from './shared';

export function Register({ settings, date, today }: { settings: Settings; date: ISODate; today: ISODate }) {
  const entry = useEntry(date);
  if (entry === undefined) return null; // cargando
  // `key` reinicia el borrador al cambiar de fecha.
  return <RegisterForm key={date} settings={settings} date={date} today={today} entry={entry} />;
}

function RegisterForm({
  settings,
  date,
  today,
  entry,
}: {
  settings: Settings;
  date: ISODate;
  today: ISODate;
  entry: Entry | null;
}) {
  const toast = useToast();
  const [metrics, setMetrics] = useState<Record<string, number>>(entry?.metrics ?? {});
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [tags, setTags] = useState<string[]>(entry?.tags ?? []);
  const [confirmLeave, setConfirmLeave] = useState<null | (() => void)>(null);
  const [saving, setSaving] = useState(false);

  const info = dayInfo(date, settings.protocol, settings.startDate);
  const dirty = useMemo(() => {
    const base = entry ?? { metrics: {}, notes: '', tags: [] };
    return (
      JSON.stringify(sortObj(metrics)) !== JSON.stringify(sortObj(base.metrics)) ||
      notes !== base.notes ||
      tags.join(',') !== base.tags.join(',')
    );
  }, [metrics, notes, tags, entry]);

  const guard = (fn: () => void) => (dirty ? setConfirmLeave(() => fn) : fn());

  const subtitle =
    info.kind === 'before'
      ? 'Antes del inicio del protocolo'
      : `${info.kind === 'dose' ? 'Día de dosis' : 'Día de descanso'} · ${info.position} de ${info.cycleLength}`;

  return (
    <div className="flex flex-col gap-3 pb-6">
      <header className="mb-1 flex items-center gap-3 pt-2">
        <button
          onClick={() => guard(() => goBack(''))}
          aria-label="Volver"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em]">
            {formatShortWithWeekday(date)}
          </h1>
          <p className="text-[13px] text-muted">{date === today ? `Hoy · ${subtitle}` : subtitle}</p>
        </div>
        <div className="flex gap-1">
          <button
            aria-label="Día anterior"
            onClick={() => guard(() => navigate(`registrar/${addDays(date, -1)}`, { replace: true }))}
            className="grid size-9 place-items-center rounded-full text-muted"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            aria-label="Día siguiente"
            disabled={date >= today}
            onClick={() => guard(() => navigate(`registrar/${addDays(date, 1)}`, { replace: true }))}
            className="grid size-9 place-items-center rounded-full text-muted disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {(info.kind === 'dose' || entry?.doseTakenAt) && <DoseCard date={date} today={today} takenAt={entry?.doseTakenAt} />}

      <section className="card flex flex-col gap-5 px-4 py-4" aria-label="Métricas">
        {settings.metrics.map((m) => (
          <MetricScale
            key={m.id}
            metric={m}
            value={metrics[m.id]}
            onChange={(v) =>
              setMetrics((prev) => {
                const next = { ...prev };
                if (v === undefined) delete next[m.id];
                else next[m.id] = v;
                return next;
              })
            }
          />
        ))}
        {settings.metrics.length === 0 && (
          <p className="text-[14px] text-muted">No tenés métricas. Agregalas desde Ajustes.</p>
        )}
      </section>

      <label htmlFor="notes" className="label mt-2 px-1">
        Notas
      </label>
      <textarea
        id="notes"
        className="field min-h-[88px] resize-y leading-relaxed"
        placeholder="¿Qué pasó hoy? ¿Qué notaste?"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <TagPicker selected={tags} onChange={setTags} />

      <div className="sticky bottom-0 -mx-5 mt-3 bg-gradient-to-t from-bg from-70% to-transparent px-5 pt-4 pb-[max(env(safe-area-inset-bottom),16px)]">
        <Button
          block
          loading={saving}
          onClick={async () => {
            setSaving(true);
            await saveEntry(date, { metrics, notes: notes.trim(), tags });
            toast(date === today ? 'Día guardado' : `Guardado · ${formatShort(date)}`);
            goBack('');
          }}
        >
          Guardar el día
        </Button>
      </div>

      <ConfirmSheet
        open={confirmLeave !== null}
        title="¿Descartar los cambios?"
        body="Hay cambios sin guardar en este día."
        confirmLabel="Descartar"
        danger
        onConfirm={() => confirmLeave?.()}
        onClose={() => setConfirmLeave(null)}
      />
    </div>
  );
}

function sortObj(o: Record<string, number>) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

function DoseCard({ date, today, takenAt }: { date: ISODate; today: ISODate; takenAt?: string }) {
  const toast = useToast();
  const timeRef = useRef<HTMLInputElement>(null);
  if (!takenAt) {
    return (
      <button
        onClick={async () => {
          // Para días pasados no sabemos la hora: se propone 09:00 y se puede corregir.
          await setDoseTaken(date, date === today ? localTimeHHMM() : '09:00');
          toast('Dosis registrada');
        }}
        className="card flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <span className="size-7 shrink-0 rounded-full border-2 border-line" />
        <span className="flex-1">
          <span className="block text-[15px] font-semibold">Marcar como tomada</span>
          <span className="block text-[13px] text-muted">Se guarda la hora de la toma.</span>
        </span>
      </button>
    );
  }
  return (
    <div className="card flex items-center gap-3 px-4 py-3.5">
      <button
        onClick={() => void setDoseTaken(date, undefined)}
        aria-label="Deshacer dosis registrada"
        className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-on-accent"
      >
        <Check size={15} strokeWidth={3} />
      </button>
      <div className="flex-1">
        <div className="text-[15px] font-semibold">Dosis registrada</div>
        <div className="text-[13px] text-muted">
          {date === today ? 'Hoy' : formatShort(date)} a las{' '}
          <input
            ref={timeRef}
            type="time"
            aria-label="Hora de la toma"
            value={takenAt}
            onChange={(e) => e.target.value && void setDoseTaken(date, e.target.value)}
            className="rounded bg-transparent font-mono text-ink underline decoration-line underline-offset-4"
          />{' '}
          · <button onClick={() => void setDoseTaken(date, undefined)} className="underline-offset-2 hover:underline">tocá para deshacer</button>
        </div>
      </div>
    </div>
  );
}

function MetricScale({
  metric,
  value,
  onChange,
}: {
  metric: Metric;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const groupId = `m-${metric.id}`;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span id={groupId} className="flex items-center gap-2 text-[15px] font-semibold">
          <MetricDot metric={metric} />
          {metric.label}
        </span>
        <span className="text-[13px] text-muted">{value ? metric.labels[value - 1] : '—'}</span>
      </div>
      <div role="radiogroup" aria-labelledby={groupId} className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = value === n;
          const below = value !== undefined && n < value;
          return (
            <button
              key={n}
              role="radio"
              aria-checked={selected}
              aria-label={`${n}, ${metric.labels[n - 1]}`}
              onClick={() => onChange(selected ? undefined : n)}
              className={cx(
                'h-12 rounded-[12px] font-mono text-[16px] transition-colors',
                selected ? 'bg-ink font-semibold text-bg' : below ? 'text-ink' : value ? 'bg-neutral text-faint' : 'bg-neutral text-ink',
              )}
              style={below ? { background: tint(metric.color, 22) } : undefined}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TagPicker({ selected, onChange }: { selected: string[]; onChange: (t: string[]) => void }) {
  const entries = useEntries();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (adding) input.current?.focus();
  }, [adding]);

  // Sugerencias: las etiquetas más usadas.
  const suggestions = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of entries) for (const t of e.tags) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 12);
  }, [entries]);
  const all = [...selected, ...suggestions.filter((t) => !selected.includes(t))];

  const toggle = (t: string) => onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t]);
  const commit = () => {
    const parts = text.split(/[,\s]+/).map(normalizeTag).filter(Boolean);
    if (parts.length) onChange([...new Set([...selected, ...parts])]);
    setText('');
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap gap-2" aria-label="Etiquetas">
      {all.map((t) => {
        const on = selected.includes(t);
        return (
          <button
            key={t}
            aria-pressed={on}
            onClick={() => toggle(t)}
            className={cx(
              'h-8 rounded-full px-3 text-[13px] font-medium',
              on ? 'bg-accent-tint text-accent-fg' : 'border border-line bg-surface text-muted',
            )}
          >
            #{t}
          </button>
        );
      })}
      {adding ? (
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
            if (e.key === 'Escape') {
              setText('');
              setAdding(false);
            }
          }}
          placeholder="etiqueta"
          aria-label="Nueva etiqueta"
          className="h-8 w-32 rounded-full border border-accent bg-surface px-3 text-[13px] outline-none"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex h-8 items-center gap-1 rounded-full border border-dashed border-line px-3 text-[13px] text-muted"
        >
          <Plus size={13} /> etiqueta
        </button>
      )}
    </div>
  );
}
