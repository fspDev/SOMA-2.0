import { useMemo, useState } from 'react';
import { Award, ChevronDown, Lock, Search, X } from 'lucide-react';
import { Button, Segmented, Sheet, cx, useToast } from '../ui/kit';
import { navigate } from '../ui/router';
import { useEntries, useEntriesByDate, useReviews } from '../db/hooks';
import { saveReview } from '../db/repo';
import type { Entry, Review, Settings } from '../db/types';
import { addDays, diffDays, formatDayMonth, formatShort, formatShortWithWeekday, type ISODate } from '../lib/dates';
import { fmt1, type Metric } from '../lib/metrics';
import { achievements, compareDoseRest, groupOf, heatmapColumns, nextReviewDate } from '../lib/stats';
import { EmptyNote, IntentionCard, MetricDot } from './shared';

type Tab = 'patrones' | 'diario' | 'logros' | 'revisiones';
const TABS: { value: Tab; label: string }[] = [
  { value: 'patrones', label: 'Patrones' },
  { value: 'diario', label: 'Diario' },
  { value: 'logros', label: 'Logros' },
  { value: 'revisiones', label: 'Revisiones' },
];

export function Journey({ settings, today, tab }: { settings: Settings; today: ISODate; tab?: string }) {
  const active: Tab = TABS.some((t) => t.value === tab) ? (tab as Tab) : 'patrones';
  const day = diffDays(settings.startDate, today) + 1;
  return (
    <div className="flex flex-col gap-3">
      <header className="mb-2 pt-2">
        <h1 className="screen-title">Mi viaje</h1>
        <p className="mt-1.5 text-[13px] text-muted">
          {day >= 1 ? (
            <>
              <span className="font-mono">Día {day}</span> · desde el {formatDayMonth(settings.startDate)}
            </>
          ) : (
            <>Empieza el {formatDayMonth(settings.startDate)}</>
          )}
        </p>
      </header>
      <Segmented label="Secciones" value={active} options={TABS} onChange={(t) => navigate(`viaje/${t}`, { replace: true })} />
      <div className="mt-1 flex flex-col gap-3">
        {active === 'patrones' && <Patterns settings={settings} today={today} />}
        {active === 'diario' && <Diary settings={settings} />}
        {active === 'logros' && <Achievements settings={settings} />}
        {active === 'revisiones' && <Reviews settings={settings} today={today} />}
      </div>
    </div>
  );
}

// ── Patrones ────────────────────────────────────────────────────────────────

type Range = '30' | '90' | 'all';

function Patterns({ settings, today }: { settings: Settings; today: ISODate }) {
  const entries = useEntries();
  const byDate = useEntriesByDate();
  const [range, setRange] = useState<Range>('all');
  const from = range === 'all' ? undefined : addDays(today, -(Number(range) - 1));
  const cmp = useMemo(() => compareDoseRest(entries, settings.metrics, from), [entries, settings.metrics, from]);

  return (
    <>
      <section className="card px-5 py-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">Dosis vs. descanso</h2>
          <div className="flex items-center gap-3 text-[12px] text-muted" aria-hidden>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[3px] bg-accent" /> Dosis
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[3px] bg-rest" /> Descanso
            </span>
          </div>
        </div>
        {cmp.count === 0 ? (
          <EmptyNote>Todavía no hay registros en este período. Cuando registres días de dosis y de descanso, acá vas a ver la comparación.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-4">
            {settings.metrics.map((m) => {
              const s = cmp.byMetric[m.id];
              return (
                <div key={m.id} className="grid grid-cols-[92px_1fr] items-center gap-3">
                  <div>
                    <div className="text-[14px]">{m.label}</div>
                    {m.inverse && <div className="text-[11px] text-faint">menos es mejor</div>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <CompareBar value={s.dose} className="bg-accent" label={`${m.label} en días de dosis`} />
                    <CompareBar value={s.rest} className="bg-rest" label={`${m.label} en días de descanso`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-[12px] text-muted">
            Promedios de <span className="font-mono">{cmp.count}</span> {cmp.count === 1 ? 'registro' : 'registros'}. Escala 1–5.
          </p>
          <select
            aria-label="Período"
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
            className="rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-muted"
          >
            <option value="30">30 días</option>
            <option value="90">90 días</option>
            <option value="all">Todo</option>
          </select>
        </div>
      </section>
      <Heatmap settings={settings} today={today} byDate={byDate} />
      <p className="text-center text-[12px] text-muted">Observaciones personales, no indicaciones médicas.</p>
    </>
  );
}

function CompareBar({ value, className, label }: { value: number | null; className: string; label: string }) {
  return (
    <div className="flex items-center gap-3" aria-label={`${label}: ${value === null ? 'sin datos' : fmt1(value)}`}>
      <span className="h-1.5 flex-1 rounded-full bg-neutral">
        {value !== null && <span className={cx('block h-full rounded-full', className)} style={{ width: `${(value / 5) * 100}%` }} />}
      </span>
      <span className="w-7 text-right font-mono text-[13px]">{value === null ? '–' : fmt1(value)}</span>
    </div>
  );
}

const HEAT_STEPS = [22, 40, 60, 80, 100];

function heatColor(metric: Metric, v: number) {
  return `color-mix(in srgb, ${metric.color} ${HEAT_STEPS[v - 1]}%, var(--surface))`;
}

function Heatmap({ settings, today, byDate }: { settings: Settings; today: ISODate; byDate: Map<ISODate, Entry> }) {
  const [metricId, setMetricId] = useState(settings.metrics[0]?.id);
  const metric = settings.metrics.find((m) => m.id === metricId) ?? settings.metrics[0];
  const cols = useMemo(() => (metric ? heatmapColumns(byDate, metric.id, today) : []), [byDate, metric, today]);
  if (!metric) return null;
  return (
    <section className="card px-5 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold">
          {metric.label} · <span className="font-mono">26</span> semanas
        </h2>
        <label className="relative">
          <span className="sr-only">Métrica</span>
          <select
            value={metric.id}
            onChange={(e) => setMetricId(e.target.value)}
            className="appearance-none rounded-full border border-line bg-surface py-1 pr-7 pl-3 text-[12px]"
          >
            {settings.metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted" />
        </label>
      </div>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
        {cols.flat().map((c) => (
          <button
            key={c.date}
            disabled={c.future}
            onClick={() => navigate(`registrar/${c.date}`)}
            aria-label={`${formatShort(c.date)}: ${c.value ? metric.labels[c.value - 1] : 'sin registro'}`}
            className="aspect-square rounded-[3px]"
            style={{
              background: c.future ? 'transparent' : c.value ? heatColor(metric, c.value) : 'var(--neutral)',
              outline: c.date === today ? '1.5px solid var(--ink)' : undefined,
              outlineOffset: c.date === today ? '-1.5px' : undefined,
            }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted">
        {metric.labels[0]}
        {[1, 2, 3, 4, 5].map((v) => (
          <span key={v} className="size-2.5 rounded-[3px]" style={{ background: heatColor(metric, v) }} />
        ))}
        {metric.labels[4]}
      </div>
    </section>
  );
}

// ── Diario: búsqueda y filtro por etiquetas ─────────────────────────────────

function Diary({ settings }: { settings: Settings }) {
  const entries = useEntries();
  const reviews = useReviews();
  const [q, setQ] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [limit, setLimit] = useState(40);

  const allTags = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of entries) for (const t of e.tags) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [entries]);

  const needle = normalize(q.trim());
  const results = useMemo(() => {
    const es = entries
      .filter((e) => tags.every((t) => e.tags.includes(t)))
      .filter((e) => !needle || normalize(e.notes).includes(needle) || e.tags.some((t) => t.includes(needle)))
      .map((e) => ({ kind: 'entry' as const, date: e.date, entry: e }));
    const rs =
      tags.length === 0
        ? reviews.filter((r) => !needle || normalize(r.notes).includes(needle)).map((r) => ({ kind: 'review' as const, date: r.date, review: r }))
        : [];
    return [...es, ...rs].sort((a, b) => b.date.localeCompare(a.date) || (a.kind === 'review' ? -1 : 1));
  }, [entries, reviews, tags, needle]);

  return (
    <>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en notas y revisiones"
          aria-label="Buscar"
          className="field pl-10"
        />
      </div>
      {allTags.length > 0 && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" aria-label="Filtrar por etiquetas">
          {allTags.map((t) => {
            const on = tags.includes(t);
            return (
              <button
                key={t}
                aria-pressed={on}
                onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}
                className={cx(
                  'h-8 shrink-0 rounded-full px-3 text-[13px] font-medium',
                  on ? 'bg-accent-tint text-accent-fg' : 'border border-line bg-surface text-muted',
                )}
              >
                #{t}
              </button>
            );
          })}
        </div>
      )}
      {(q || tags.length > 0) && (
        <div className="flex items-center justify-between px-1 text-[12px] text-muted">
          <span>
            <span className="font-mono">{results.length}</span> {results.length === 1 ? 'resultado' : 'resultados'}
          </span>
          <button onClick={() => (setQ(''), setTags([]))} className="flex items-center gap-1">
            <X size={12} /> Limpiar
          </button>
        </div>
      )}
      {results.length === 0 && (
        <EmptyNote>{entries.length === 0 ? 'Tu diario está vacío. Registrá tu primer día desde Hoy.' : 'No hay resultados.'}</EmptyNote>
      )}
      {results.slice(0, limit).map((r) =>
        r.kind === 'entry' ? (
          <EntryCard key={`e${r.date}`} entry={r.entry} metrics={settings.metrics} />
        ) : (
          <ReviewCard key={`r${r.date}`} review={r.review} />
        ),
      )}
      {results.length > limit && (
        <Button variant="secondary" block onClick={() => setLimit(limit + 40)}>
          Ver más
        </Button>
      )}
    </>
  );
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function EntryCard({ entry, metrics }: { entry: Entry; metrics: Metric[] }) {
  const g = groupOf(entry);
  return (
    <button onClick={() => navigate(`registrar/${entry.date}`)} className="card block w-full px-5 py-4 text-left">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[15px] font-semibold">{formatShortWithWeekday(entry.date)}</span>
        {g && (
          <span
            className={cx(
              'rounded-full px-2 py-0.5 text-[11px] font-medium',
              g === 'dose' ? 'bg-accent-tint text-accent-fg' : 'bg-rest-tint text-muted',
            )}
          >
            {g === 'dose' ? (entry.doseTakenAt ? `Dosis · ${entry.doseTakenAt}` : 'Dosis') : 'Descanso'}
          </span>
        )}
      </div>
      {Object.keys(entry.metrics).length > 0 && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {metrics
            .filter((m) => entry.metrics[m.id])
            .map((m) => (
              <span key={m.id} className="flex items-center gap-1.5 text-[13px] text-muted">
                <MetricDot metric={m} />
                {m.label}
                <span className="font-mono text-ink">{entry.metrics[m.id]}</span>
              </span>
            ))}
        </div>
      )}
      {entry.notes && <p className="line-clamp-3 text-[14px] leading-relaxed whitespace-pre-line">{entry.notes}</p>}
      {entry.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {entry.tags.map((t) => (
            <span key={t} className="text-[12px] text-accent-fg">
              #{t}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <button onClick={() => navigate('viaje/revisiones')} className="card block w-full border-l-4 border-l-accent px-5 py-4 text-left">
      <div className="label mb-1">Revisión semanal · {formatShort(review.date)}</div>
      <p className="line-clamp-4 text-[14px] leading-relaxed whitespace-pre-line">{review.notes}</p>
    </button>
  );
}

// ── Logros ──────────────────────────────────────────────────────────────────

function Achievements({ settings }: { settings: Settings }) {
  const entries = useEntries();
  const reviews = useReviews();
  const list = useMemo(() => achievements(entries, reviews, settings.intentionSetAt), [entries, reviews, settings.intentionSetAt]);
  const unlocked = list.filter((a) => a.unlockedAt).length;
  return (
    <>
      <p className="px-1 text-[13px] text-muted">
        <span className="font-mono text-ink">
          {unlocked}/{list.length}
        </span>{' '}
        logros. Celebran la constancia, no la cantidad.
      </p>
      <ul className="card divide-y divide-line">
        {list.map((a) => {
          const done = Boolean(a.unlockedAt);
          const [n, total] = a.progress;
          return (
            <li key={a.id} className="flex items-center gap-4 px-5 py-4">
              <span
                className={cx(
                  'grid size-10 shrink-0 place-items-center rounded-full',
                  done ? 'bg-accent text-on-accent' : 'bg-neutral text-faint',
                )}
              >
                {done ? <Award size={18} /> : <Lock size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className={cx('text-[15px] font-semibold', !done && 'text-muted')}>{a.title}</div>
                <div className="text-[13px] leading-snug text-muted">{a.description}</div>
                {!done && total > 1 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-1 flex-1 rounded-full bg-neutral">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${(n / total) * 100}%` }} />
                    </span>
                    <span className="font-mono text-[11px] text-muted">
                      {n}/{total}
                    </span>
                  </div>
                )}
              </div>
              {done && <span className="shrink-0 font-mono text-[12px] text-muted">{formatShort(a.unlockedAt!)}</span>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ── Revisiones ──────────────────────────────────────────────────────────────

const PROMPTS = ['¿Qué notaste esta semana?', '¿Qué te sorprendió?', '¿Qué querés sostener o cambiar?'];

function Reviews({ settings, today }: { settings: Settings; today: ISODate }) {
  const reviews = useReviews();
  const entries = useEntries();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<Review | null>(null);
  const [editText, setEditText] = useState('');
  const next = nextReviewDate(reviews, settings.startDate);
  const due = next <= today;
  const weekFrom = addDays(today, -6);
  const week = useMemo(() => compareDoseRest(entries, settings.metrics, weekFrom), [entries, settings.metrics, weekFrom]);
  const weekEntries = entries.filter((e) => e.date >= weekFrom).length;

  return (
    <>
      <IntentionCard settings={settings} today={today} />

      <section className="card px-5 py-4">
        <h2 className="mb-1 text-[16px] font-semibold">Revisión semanal</h2>
        {due ? (
          <>
            <p className="mb-3 text-[13px] text-muted">
              Últimos 7 días: <span className="font-mono text-ink">{weekEntries}</span> {weekEntries === 1 ? 'registro' : 'registros'}
              {week.count > 0 &&
                settings.metrics.slice(0, 4).map((m) => {
                  const s = week.byMetric[m.id];
                  const all = (s.dose ?? 0) * s.nDose + (s.rest ?? 0) * s.nRest;
                  const n = s.nDose + s.nRest;
                  return n ? (
                    <span key={m.id}>
                      {' · '}
                      {m.label.toLowerCase()} <span className="font-mono text-ink">{fmt1(all / n)}</span>
                    </span>
                  ) : null;
                })}
            </p>
            <ul className="mb-3 list-disc pl-5 text-[14px] leading-relaxed text-muted">
              {PROMPTS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <textarea
              className="field min-h-[130px] resize-y leading-relaxed"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribí libremente…"
              aria-label="Revisión semanal"
            />
            <Button
              block
              className="mt-3"
              disabled={!draft.trim()}
              onClick={async () => {
                await saveReview(today, draft);
                setDraft('');
                toast('Revisión guardada');
              }}
            >
              Guardar revisión
            </Button>
          </>
        ) : (
          <p className="text-[14px] text-muted">
            Una revisión cada 7 días. La próxima está disponible el <span className="text-ink">{formatDayMonth(next)}</span>.
          </p>
        )}
      </section>

      {reviews.length > 0 && <h2 className="label mt-2 px-1">Revisiones anteriores</h2>}
      {[...reviews].reverse().map((r) => (
        <button
          key={r.date}
          onClick={() => {
            setEditing(r);
            setEditText(r.notes);
          }}
          className="card block w-full px-5 py-4 text-left"
        >
          <div className="label mb-1">{formatShortWithWeekday(r.date)}</div>
          <p className="text-[14px] leading-relaxed whitespace-pre-line">{r.notes}</p>
        </button>
      ))}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing ? `Revisión · ${formatShort(editing.date)}` : ''}>
        <textarea
          className="field min-h-[180px] resize-y leading-relaxed"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          aria-label="Texto de la revisión"
        />
        <Button
          block
          className="mt-3"
          onClick={async () => {
            if (!editing) return;
            await saveReview(editing.date, editText);
            setEditing(null);
            toast(editText.trim() ? 'Revisión actualizada' : 'Revisión borrada');
          }}
        >
          {editText.trim() ? 'Guardar' : 'Borrar revisión'}
        </Button>
      </Sheet>
    </>
  );
}

