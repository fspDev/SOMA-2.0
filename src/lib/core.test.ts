import { describe, expect, it } from 'vitest';
import { addDays, diffDays, isISODate, startOfWeek, toLocalISODate } from './dates';
import { dayInfo, PROTOCOL_PRESETS } from './protocol';
import { DEFAULT_METRICS } from './metrics';
import {
  achievements,
  compareDoseRest,
  currentStreak,
  dateStreakReached,
  heatmapColumns,
  longestStreak,
  nextReviewDate,
  patternInsight,
  type EntryLike,
} from './stats';

describe('fechas locales', () => {
  it('a las 23:30 hora local sigue siendo el mismo día (bug de UTC)', () => {
    const late = new Date(2026, 9, 12, 23, 30); // 12 oct 2026, 23:30 local
    expect(toLocalISODate(late)).toBe('2026-10-12');
  });

  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-08-27', '2026-10-12')).toBe(46);
  });

  it('la semana empieza el lunes', () => {
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12'); // lunes
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12'); // domingo
  });

  it('valida fechas', () => {
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('hola')).toBe(false);
  });
});

describe('protocolo', () => {
  it('Fadiman: dosis, descanso, descanso', () => {
    const p = PROTOCOL_PRESETS.fadiman;
    const kinds = [0, 1, 2, 3, 4, 5].map((n) => dayInfo(addDays('2026-10-01', n), p, '2026-10-01').kind);
    expect(kinds).toEqual(['dose', 'rest', 'rest', 'dose', 'rest', 'rest']);
  });

  it('informa ciclo y posición', () => {
    const info = dayInfo('2026-10-12', PROTOCOL_PRESETS.fadiman, '2026-08-27');
    expect(info).toMatchObject({ kind: 'rest', cycle: 16, position: 2, cycleLength: 3, dayNumber: 47 });
  });

  it('Stamets: 4 activos y 3 de descanso', () => {
    const p = PROTOCOL_PRESETS.stamets;
    const kinds = Array.from({ length: 7 }, (_, n) => dayInfo(addDays('2026-10-05', n), p, '2026-10-05').kind);
    expect(kinds).toEqual(['dose', 'dose', 'dose', 'dose', 'rest', 'rest', 'rest']);
  });

  it('antes del inicio', () => {
    expect(dayInfo('2026-10-10', PROTOCOL_PRESETS.fadiman, '2026-10-12')).toEqual({ kind: 'before', daysUntilStart: 2 });
  });
});

const e = (date: string, metrics: Record<string, number>, extra: Partial<EntryLike> = {}): EntryLike => ({
  date,
  metrics,
  notes: '',
  tags: [],
  ...extra,
});

describe('racha', () => {
  const dates = new Set(['2026-10-09', '2026-10-10', '2026-10-11']);
  it('si hoy no hay registro, cuenta hasta ayer', () => {
    expect(currentStreak(dates, '2026-10-12')).toBe(3);
  });
  it('se corta si falta ayer', () => {
    expect(currentStreak(dates, '2026-10-13')).toBe(0);
  });
  it('racha más larga y fecha en que se alcanzó', () => {
    const sorted = ['2026-01-01', '2026-01-02', '2026-01-04', '2026-01-05', '2026-01-06'];
    expect(longestStreak(sorted)).toBe(3);
    expect(dateStreakReached(sorted, 3)).toBe('2026-01-06');
    expect(dateStreakReached(sorted, 4)).toBeNull();
  });
});

describe('dosis vs. descanso', () => {
  const entries = [
    e('2026-10-01', { focus: 4, mood: 4 }, { phase: 'dose' }),
    e('2026-10-02', { focus: 3, mood: 4 }, { phase: 'rest' }),
    e('2026-10-03', { focus: 2 }, { phase: 'rest' }),
    e('2026-10-04', { focus: 5 }, { phase: 'rest', doseTakenAt: '08:00' }), // marcada → dosis
  ];

  it('promedia por grupo', () => {
    const c = compareDoseRest(entries, DEFAULT_METRICS);
    expect(c.byMetric.focus).toMatchObject({ dose: 4.5, rest: 2.5, nDose: 2, nRest: 2 });
    expect(c.byMetric.mood.rest).toBe(4);
    expect(c.byMetric.creativity.dose).toBeNull();
    expect(c.count).toBe(4);
  });

  it('pide datos suficientes antes de sacar conclusiones', () => {
    expect(patternInsight(entries, DEFAULT_METRICS, '2026-10-12').kind).toBe('not-enough');
  });

  it('elige la métrica con la diferencia más marcada', () => {
    const many = [
      ...[1, 2, 3].map((d) => e(`2026-10-0${d}`, { focus: 5, mood: 3 }, { phase: 'dose' })),
      ...[4, 5, 6].map((d) => e(`2026-10-0${d}`, { focus: 2, mood: 3 }, { phase: 'rest' })),
    ];
    const i = patternInsight(many, DEFAULT_METRICS, '2026-10-12');
    expect(i.kind).toBe('difference');
    if (i.kind === 'difference') expect(i.metric.id).toBe('focus');
  });
});

describe('mapa de calor', () => {
  it('26 columnas de 7 días; la última contiene hoy', () => {
    const cols = heatmapColumns(new Map([['2026-10-12', e('2026-10-12', { mood: 4 })]]), 'mood', '2026-10-12');
    expect(cols).toHaveLength(26);
    expect(cols.every((c) => c.length === 7)).toBe(true);
    const last = cols[25];
    expect(last[0]).toEqual({ date: '2026-10-12', value: 4, future: false });
    expect(last[6].future).toBe(true);
  });
});

describe('logros y revisiones', () => {
  it('desbloquea con fecha', () => {
    const list = achievements(
      [e('2026-10-01', { mood: 3 }, { tags: ['a'] }), e('2026-10-02', { mood: 3 })],
      [{ date: '2026-10-08' }],
      '2026-10-03',
    );
    const by = Object.fromEntries(list.map((a) => [a.id, a]));
    expect(by.first_entry.unlockedAt).toBe('2026-10-01');
    expect(by.first_review.unlockedAt).toBe('2026-10-08');
    expect(by.first_intention.unlockedAt).toBe('2026-10-03');
    expect(by.streak_7.unlockedAt).toBeNull();
    expect(by.streak_7.progress).toEqual([2, 7]);
  });

  it('una revisión cada 7 días', () => {
    expect(nextReviewDate([], '2026-10-01')).toBe('2026-10-08');
    expect(nextReviewDate([{ date: '2026-10-08' }, { date: '2026-10-15' }], '2026-10-01')).toBe('2026-10-22');
  });
});
