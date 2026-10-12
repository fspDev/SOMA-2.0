import { useMemo } from 'react';
import { Check, ChevronRight, Flame, NotebookPen } from 'lucide-react';
import { Button, cx, useToast } from '../ui/kit';
import { navigate } from '../ui/router';
import { setDoseTaken } from '../db/repo';
import { useEntries, useEntriesByDate, useReviews } from '../db/hooks';
import type { Entry, Settings } from '../db/types';
import { addDays, formatLong, formatShort, localTimeHHMM, startOfWeek, WEEKDAY_INITIALS, type ISODate } from '../lib/dates';
import { dayInfo, protocolName, type DayInfo } from '../lib/protocol';
import { currentStreak, insightSentence, MIN_PER_GROUP, nextReviewDate, patternInsight } from '../lib/stats';
import { fmt1 } from '../lib/metrics';
import { IntentionCard } from './shared';

export function Home({ settings, today }: { settings: Settings; today: ISODate }) {
  const entries = useEntries();
  const byDate = useEntriesByDate();
  const reviews = useReviews();
  const info = dayInfo(today, settings.protocol, settings.startDate);
  const todayEntry = byDate.get(today);
  const streak = useMemo(() => currentStreak(new Set(entries.map((e) => e.date)), today), [entries, today]);
  const reviewDue = info.kind !== 'before' && nextReviewDate(reviews, settings.startDate) <= today;

  return (
    <div className="flex flex-col gap-3">
      <header className="mb-2 flex items-end justify-between gap-3 pt-2">
        <div className="min-w-0">
          <p className="label mb-1">{formatLong(today)}</p>
          <h1 className="truncate text-[26px] font-semibold tracking-[-0.02em]">
            {settings.name ? `Hola, ${settings.name}` : 'Hola'}
          </h1>
        </div>
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5"
          aria-label={`Racha de ${streak} ${streak === 1 ? 'día' : 'días'}`}
        >
          <Flame size={14} className={streak > 0 ? 'text-accent-fg' : 'text-faint'} aria-hidden />
          <span className="font-mono text-[14px] font-medium">{streak}</span>
          <span className="text-[13px] text-muted">{streak === 1 ? 'día' : 'días'}</span>
        </div>
      </header>

      <CycleCard info={info} settings={settings} today={today} entry={todayEntry} />
      <WeekStrip settings={settings} today={today} byDate={byDate} />

      {reviewDue && (
        <button
          onClick={() => navigate('viaje/revisiones')}
          className="card flex items-center gap-3 px-5 py-4 text-left"
        >
          <span className="grid size-9 place-items-center rounded-full bg-accent-tint text-accent-fg">
            <NotebookPen size={17} />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">Revisión semanal disponible</span>
            <span className="block text-[13px] text-muted">Mirá tu semana con perspectiva.</span>
          </span>
          <ChevronRight size={18} className="text-faint" />
        </button>
      )}

      <IntentionCard settings={settings} today={today} />
      <PatternCard settings={settings} entries={entries} today={today} />

      <p className="mt-2 text-center text-[12px] text-muted">Observaciones personales, no indicaciones médicas.</p>
    </div>
  );
}

function CycleCard({
  info,
  settings,
  today,
  entry,
}: {
  info: DayInfo;
  settings: Settings;
  today: ISODate;
  entry: Entry | undefined;
}) {
  const toast = useToast();
  const hasMetrics = entry && Object.keys(entry.metrics).length > 0;

  if (info.kind === 'before') {
    return (
      <section className="card px-5 py-5">
        <p className="label mb-1">{protocolName(settings.protocol)}</p>
        <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Tu protocolo empieza pronto</h2>
        <p className="mt-1 text-muted">
          Faltan <span className="font-mono text-ink">{info.daysUntilStart}</span>{' '}
          {info.daysUntilStart === 1 ? 'día' : 'días'} · {formatShort(settings.startDate)}
        </p>
      </section>
    );
  }

  const dose = info.kind === 'dose';
  const segments = Math.min(info.cycleLength, 12);
  const meta = `Hoy · ciclo ${info.cycle} · ${protocolName(settings.protocol)}`;

  return (
    <section
      className={cx('rounded-[20px] px-5 pt-4 pb-5', dose ? 'bg-accent text-on-accent' : 'card')}
      aria-label={dose ? 'Día de dosis' : 'Día de descanso'}
    >
      <div className={cx('flex items-center justify-between text-[12px] font-medium', dose ? 'text-on-accent/80' : 'text-muted')}>
        <span>{meta}</span>
        <span className="font-mono text-[13px] tracking-wide">
          {info.position} / {info.cycleLength}
        </span>
      </div>
      <h2 className="mt-1.5 text-[26px] font-semibold tracking-[-0.02em]">{dose ? 'Día de dosis' : 'Día de descanso'}</h2>
      <div className="mt-4 flex gap-1.5" aria-hidden>
        {Array.from({ length: segments }, (_, i) => {
          const pos = Math.ceil(((i + 1) / segments) * info.cycleLength);
          const reached = pos <= info.position;
          return (
            <span
              key={i}
              className={cx(
                'h-[3px] flex-1 rounded-full',
                dose ? (reached ? 'bg-on-accent' : 'bg-on-accent/30') : reached ? 'bg-rest' : 'bg-rest/25',
              )}
            />
          );
        })}
      </div>

      <div className="mt-5">
        {dose && !entry?.doseTakenAt && (
          <Button
            variant="on-accent"
            block
            className="h-12"
            onClick={async () => {
              await setDoseTaken(today, localTimeHHMM());
              toast('Dosis registrada');
            }}
          >
            Marcar como tomada
          </Button>
        )}
        {dose && entry?.doseTakenAt && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => void setDoseTaken(today, undefined)}
              className="flex items-center gap-2 text-left text-[14px] text-on-accent/90"
            >
              <span className="grid size-5 place-items-center rounded-full bg-white text-[#3b3fe0]">
                <Check size={13} strokeWidth={3} />
              </span>
              Tomada a las <span className="font-mono">{entry.doseTakenAt}</span>
              <span className="text-on-accent/60">· deshacer</span>
            </button>
            {!hasMetrics && (
              <Button variant="on-accent" block className="h-12" onClick={() => navigate('registrar')}>
                Registrar cómo te sentís
              </Button>
            )}
          </div>
        )}
        {!dose && (
          <Button variant="secondary" block className="h-12" onClick={() => navigate('registrar')}>
            {hasMetrics ? 'Ver el registro de hoy' : 'Registrar cómo te sentís'}
          </Button>
        )}
      </div>
    </section>
  );
}

function WeekStrip({ settings, today, byDate }: { settings: Settings; today: ISODate; byDate: Map<ISODate, Entry> }) {
  const monday = startOfWeek(today);
  return (
    <nav aria-label="Esta semana" className="card grid grid-cols-7 px-2 py-3">
      {WEEKDAY_INITIALS.map((initial, i) => {
        const date = addDays(monday, i);
        const info = dayInfo(date, settings.protocol, settings.startDate);
        const isToday = date === today;
        const future = date > today;
        const has = byDate.has(date);
        return (
          <button
            key={date}
            disabled={future}
            onClick={() => navigate(`registrar/${date}`)}
            aria-label={`${formatShort(date)}${info.kind === 'dose' ? ', día de dosis' : info.kind === 'rest' ? ', descanso' : ''}${has ? ', con registro' : ''}`}
            aria-current={isToday ? 'date' : undefined}
            className="flex flex-col items-center gap-1.5"
          >
            <span className="text-[11px] font-medium text-faint">{initial}</span>
            <span
              className={cx(
                'grid size-9 place-items-center rounded-full font-mono text-[15px]',
                isToday ? 'bg-ink font-semibold text-bg' : has ? 'font-medium text-ink' : future ? 'text-faint' : 'text-muted',
                !isToday && has && 'bg-neutral',
              )}
            >
              {Number(date.slice(8))}
            </span>
            <span
              className={cx(
                'size-1.5 rounded-full',
                info.kind === 'dose' ? 'bg-accent' : info.kind === 'rest' ? 'bg-rest/50' : 'bg-transparent',
              )}
            />
          </button>
        );
      })}
    </nav>
  );
}

function PatternCard({ settings, entries, today }: { settings: Settings; entries: Entry[]; today: ISODate }) {
  const insight = useMemo(() => patternInsight(entries, settings.metrics, today), [entries, settings.metrics, today]);
  return (
    <button onClick={() => navigate('viaje/patrones')} className="card block w-full px-5 py-4 text-left">
      <div className="label mb-2 flex items-center justify-between">
        Patrón · últimos 30 días
        <ChevronRight size={16} className="text-faint" aria-hidden />
      </div>
      {insight.kind === 'difference' && (
        <>
          <p className="mb-4 text-[15px] leading-snug">{insightSentence(insight)}</p>
          <Bar label="Dosis" value={insight.dose} className="bg-accent" />
          <Bar label="Descanso" value={insight.rest} className="bg-rest" />
        </>
      )}
      {insight.kind === 'similar' && (
        <p className="text-[15px] leading-snug">
          Tus métricas promedian parecido en días de dosis y de descanso. Seguí registrando para ver si aparece una diferencia.
        </p>
      )}
      {insight.kind === 'not-enough' && (
        <>
          <p className="mb-3 text-[15px] leading-snug">
            Con al menos {MIN_PER_GROUP} registros de cada tipo vas a ver acá si algo cambia entre días de dosis y de descanso.
          </p>
          <Progress label="Dosis" n={insight.doseCount} className="bg-accent" />
          <Progress label="Descanso" n={insight.restCount} className="bg-rest" />
        </>
      )}
    </button>
  );
}

function Bar({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-3 last:mb-0">
      <span className="w-[68px] text-[12px] text-muted">{label}</span>
      <span className="h-1.5 flex-1 rounded-full bg-neutral">
        <span className={cx('block h-full rounded-full', className)} style={{ width: `${(value / 5) * 100}%` }} />
      </span>
      <span className="w-8 text-right font-mono text-[13px]">{fmt1(value)}</span>
    </div>
  );
}

function Progress({ label, n, className }: { label: string; n: number; className: string }) {
  const v = Math.min(n, MIN_PER_GROUP);
  return (
    <div className="mb-1.5 flex items-center gap-3 last:mb-0">
      <span className="w-[68px] text-[12px] text-muted">{label}</span>
      <span className="h-1.5 flex-1 rounded-full bg-neutral">
        <span className={cx('block h-full rounded-full', className)} style={{ width: `${(v / MIN_PER_GROUP) * 100}%` }} />
      </span>
      <span className="w-8 text-right font-mono text-[13px]">
        {v}/{MIN_PER_GROUP}
      </span>
    </div>
  );
}
