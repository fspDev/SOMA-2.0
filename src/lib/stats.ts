import { addDays, diffDays, startOfWeek, type ISODate } from './dates';
import type { Metric } from './metrics';
import type { Phase } from './protocol';

/** Lo mínimo de una entrada que necesitan los cálculos. */
export interface EntryLike {
  date: ISODate;
  metrics: Record<string, number>;
  tags: string[];
  notes: string;
  doseTakenAt?: string;
  phase?: Phase;
}

export interface ReviewLike {
  date: ISODate;
}

// ── Racha ───────────────────────────────────────────────────────────────────

/**
 * Días seguidos con registro. Si hoy todavía no hay registro, la racha
 * cuenta hasta ayer (no se "rompe" hasta que termina el día).
 */
export function currentStreak(dates: Set<ISODate>, today: ISODate): number {
  let day = dates.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (dates.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** Primera fecha en la que se alcanzó una racha de `target` días, o null. */
export function dateStreakReached(sortedDates: ISODate[], target: number): ISODate | null {
  let run = 0;
  let prev: ISODate | null = null;
  for (const d of sortedDates) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    if (run >= target) return d;
    prev = d;
  }
  return null;
}

export function longestStreak(sortedDates: ISODate[]): number {
  let best = 0;
  let run = 0;
  let prev: ISODate | null = null;
  for (const d of sortedDates) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

// ── Dosis vs. descanso ──────────────────────────────────────────────────────

/** Una entrada cuenta como "dosis" si se marcó la toma o si el protocolo la indicaba. */
export function groupOf(e: EntryLike): Phase | null {
  if (e.doseTakenAt) return 'dose';
  return e.phase ?? null;
}

export interface GroupStat {
  dose: number | null;
  rest: number | null;
  nDose: number;
  nRest: number;
}

export interface Comparison {
  /** Entradas con al menos una métrica y fase conocida. */
  count: number;
  doseCount: number;
  restCount: number;
  byMetric: Record<string, GroupStat>;
}

export function compareDoseRest(entries: EntryLike[], metrics: Metric[], from?: ISODate): Comparison {
  const sums: Record<string, { d: number; nd: number; r: number; nr: number }> = {};
  for (const m of metrics) sums[m.id] = { d: 0, nd: 0, r: 0, nr: 0 };
  let count = 0;
  let doseCount = 0;
  let restCount = 0;
  for (const e of entries) {
    if (from && e.date < from) continue;
    const g = groupOf(e);
    if (!g) continue;
    let any = false;
    for (const m of metrics) {
      const v = e.metrics[m.id];
      if (typeof v !== 'number') continue;
      any = true;
      if (g === 'dose') {
        sums[m.id].d += v;
        sums[m.id].nd++;
      } else {
        sums[m.id].r += v;
        sums[m.id].nr++;
      }
    }
    if (any) {
      count++;
      if (g === 'dose') doseCount++;
      else restCount++;
    }
  }
  const byMetric: Record<string, GroupStat> = {};
  for (const m of metrics) {
    const s = sums[m.id];
    byMetric[m.id] = {
      dose: s.nd ? s.d / s.nd : null,
      rest: s.nr ? s.r / s.nr : null,
      nDose: s.nd,
      nRest: s.nr,
    };
  }
  return { count, doseCount, restCount, byMetric };
}

export const MIN_PER_GROUP = 3;

export type Insight =
  | { kind: 'not-enough'; doseCount: number; restCount: number }
  | { kind: 'similar' }
  | { kind: 'difference'; metric: Metric; dose: number; rest: number };

/** El patrón más marcado entre días de dosis y de descanso en los últimos `days` días. */
export function patternInsight(entries: EntryLike[], metrics: Metric[], today: ISODate, days = 30): Insight {
  const cmp = compareDoseRest(entries, metrics, addDays(today, -(days - 1)));
  let best: { metric: Metric; dose: number; rest: number } | null = null;
  for (const m of metrics) {
    const s = cmp.byMetric[m.id];
    if (s.dose === null || s.rest === null || s.nDose < MIN_PER_GROUP || s.nRest < MIN_PER_GROUP) continue;
    if (!best || Math.abs(s.dose - s.rest) > Math.abs(best.dose - best.rest)) {
      best = { metric: m, dose: s.dose, rest: s.rest };
    }
  }
  if (!best) return { kind: 'not-enough', doseCount: cmp.doseCount, restCount: cmp.restCount };
  if (Math.abs(best.dose - best.rest) < 0.3) return { kind: 'similar' };
  return { kind: 'difference', ...best };
}

export function insightSentence(i: Extract<Insight, { kind: 'difference' }>): string {
  const dir = i.dose > i.rest ? 'más alto' : 'más bajo';
  return `Tu ${i.metric.label.toLowerCase()} promedia ${dir} en días de dosis que en días de descanso.`;
}

// ── Mapa de calor ───────────────────────────────────────────────────────────

export interface HeatCell {
  date: ISODate;
  value: number | null;
  future: boolean;
}

/** Columnas = semanas (lunes a domingo); la última es la semana actual. */
export function heatmapColumns(
  byDate: Map<ISODate, EntryLike>,
  metricId: string,
  today: ISODate,
  weeks = 26,
): HeatCell[][] {
  const firstMonday = addDays(startOfWeek(today), -7 * (weeks - 1));
  const cols: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(firstMonday, w * 7 + d);
      const v = byDate.get(date)?.metrics[metricId];
      col.push({ date, value: typeof v === 'number' ? v : null, future: date > today });
    }
    cols.push(col);
  }
  return cols;
}

// ── Logros ──────────────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlockedAt: ISODate | null;
  progress: [number, number];
}

export function achievements(
  entries: EntryLike[],
  reviews: ReviewLike[],
  intentionSetAt: ISODate | undefined,
): Achievement[] {
  const dates = entries.map((e) => e.date).sort();
  const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const best = longestStreak(dates);

  const tagSeen = new Set<string>();
  let tenTagsAt: ISODate | null = null;
  for (const e of sortedEntries) {
    for (const t of e.tags) tagSeen.add(t);
    if (!tenTagsAt && tagSeen.size >= 10) tenTagsAt = e.date;
  }

  const reviewDates = reviews.map((r) => r.date).sort();
  const doseDates = sortedEntries.filter((e) => e.doseTakenAt).map((e) => e.date);

  return [
    {
      id: 'first_entry',
      title: 'Primer registro',
      description: 'Anotaste cómo te sentías por primera vez.',
      unlockedAt: dates[0] ?? null,
      progress: [Math.min(dates.length, 1), 1],
    },
    {
      id: 'first_intention',
      title: 'Intención definida',
      description: 'Pusiste en palabras para qué hacés este viaje.',
      unlockedAt: intentionSetAt ?? null,
      progress: [intentionSetAt ? 1 : 0, 1],
    },
    {
      id: 'first_dose_marked',
      title: 'Primera toma registrada',
      description: 'Marcaste una dosis como tomada.',
      unlockedAt: doseDates[0] ?? null,
      progress: [Math.min(doseDates.length, 1), 1],
    },
    {
      id: 'streak_7',
      title: 'Siete días seguidos',
      description: 'Una semana entera de registros sin cortes.',
      unlockedAt: dateStreakReached(dates, 7),
      progress: [Math.min(best, 7), 7],
    },
    {
      id: 'first_review',
      title: 'Primera revisión',
      description: 'Miraste tu semana con perspectiva.',
      unlockedAt: reviewDates[0] ?? null,
      progress: [Math.min(reviewDates.length, 1), 1],
    },
    {
      id: 'tags_10',
      title: 'Diez etiquetas',
      description: 'Usaste 10 etiquetas distintas para dar contexto a tus días.',
      unlockedAt: tenTagsAt,
      progress: [Math.min(tagSeen.size, 10), 10],
    },
    {
      id: 'entries_30',
      title: 'Treinta registros',
      description: 'Suficientes datos para empezar a ver patrones.',
      unlockedAt: dates[29] ?? null,
      progress: [Math.min(dates.length, 30), 30],
    },
    {
      id: 'streak_30',
      title: 'Un mes de constancia',
      description: 'Treinta días seguidos registrando.',
      unlockedAt: dateStreakReached(dates, 30),
      progress: [Math.min(best, 30), 30],
    },
  ];
}

// ── Revisión semanal ────────────────────────────────────────────────────────

export const REVIEW_INTERVAL = 7;

/** Fecha desde la que se puede hacer la próxima revisión (o hoy si ya se puede). */
export function nextReviewDate(reviews: ReviewLike[], startDate: ISODate): ISODate {
  const last = reviews.map((r) => r.date).sort().at(-1);
  return addDays(last ?? startDate, REVIEW_INTERVAL);
}
