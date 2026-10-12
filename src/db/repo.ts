import { db } from './db';
import { emitLocalChange } from './changes';
import type { Entry, EntryData, Review, Settings, SettingsData } from './types';
import { type ISODate } from '../lib/dates';
import { DEFAULT_METRICS, type Metric } from '../lib/metrics';
import { phaseOf, type Protocol } from '../lib/protocol';

const fresh = () => ({ updatedAt: Date.now(), dirty: 1 as const, deleted: 0 as const });

export async function getSettings(): Promise<Settings | undefined> {
  const s = await db.settings.get('main');
  return s && !s.deleted ? s : undefined;
}

export async function createSettings(data: { name: string; protocol: Protocol; startDate: ISODate }): Promise<void> {
  const existing = await getSettings();
  const base: SettingsData = existing ?? {
    name: '',
    protocol: data.protocol,
    startDate: data.startDate,
    metrics: DEFAULT_METRICS,
    theme: 'system',
    intention: '',
  };
  await db.settings.put({ ...base, ...data, key: 'main', ...fresh() });
  emitLocalChange();
}

export async function updateSettings(patch: Partial<SettingsData>): Promise<void> {
  const current = await getSettings();
  if (!current) return;
  await db.settings.put({ ...current, ...patch, ...fresh() });
  emitLocalChange();
}

export async function setIntention(text: string, today: ISODate): Promise<void> {
  const current = await getSettings();
  if (!current) return;
  const intention = text.trim();
  await updateSettings({
    intention,
    intentionSetAt: intention ? (current.intentionSetAt ?? today) : current.intentionSetAt,
  });
}

// ── Entradas ────────────────────────────────────────────────────────────────

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-');
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))];
}

export function isEntryEmpty(e: Pick<Entry, 'metrics' | 'notes' | 'tags' | 'doseTakenAt'>): boolean {
  return Object.keys(e.metrics).length === 0 && !e.notes.trim() && e.tags.length === 0 && !e.doseTakenAt;
}

async function writeEntry(date: ISODate, mutate: (e: EntryData) => EntryData): Promise<void> {
  await db.transaction('rw', db.entries, db.settings, async () => {
    const existing = await db.entries.get(date);
    const settings = await getSettings();
    const base: EntryData =
      existing && !existing.deleted
        ? existing
        : { date, metrics: {}, notes: '', tags: [] };
    const next = mutate({ ...base });
    if (!next.phase && settings) {
      next.phase = phaseOf(date, settings.protocol, settings.startDate) ?? undefined;
    }
    next.tags = normalizeTags(next.tags);
    if (isEntryEmpty(next)) {
      if (existing && !existing.deleted) await db.entries.put({ ...existing, ...fresh(), deleted: 1 });
    } else {
      await db.entries.put({ ...next, ...fresh() });
    }
  });
  emitLocalChange();
}

export function saveEntry(date: ISODate, data: Pick<EntryData, 'metrics' | 'notes' | 'tags'>): Promise<void> {
  return writeEntry(date, (e) => ({ ...e, ...data }));
}

export function setDoseTaken(date: ISODate, time: string | undefined): Promise<void> {
  return writeEntry(date, (e) => {
    const next = { ...e, doseTakenAt: time };
    if (!time) delete next.doseTakenAt;
    return next;
  });
}

// ── Revisiones ──────────────────────────────────────────────────────────────

export async function saveReview(date: ISODate, notes: string): Promise<void> {
  const text = notes.trim();
  if (!text) {
    const existing = await db.reviews.get(date);
    if (existing && !existing.deleted) await db.reviews.put({ ...existing, ...fresh(), deleted: 1 });
  } else {
    await db.reviews.put({ date, notes: text, ...fresh() });
  }
  emitLocalChange();
}

// ── Métricas ────────────────────────────────────────────────────────────────

export async function saveMetrics(metrics: Metric[]): Promise<void> {
  await updateSettings({ metrics });
}

/** Borra la métrica y también sus valores guardados en todas las entradas. */
export async function deleteMetric(id: string): Promise<void> {
  await db.transaction('rw', db.entries, db.settings, async () => {
    const s = await getSettings();
    if (!s) return;
    await db.settings.put({ ...s, metrics: s.metrics.filter((m) => m.id !== id), ...fresh() });
    const affected = await db.entries.filter((e) => !e.deleted && id in e.metrics).toArray();
    for (const e of affected) {
      const metrics = { ...e.metrics };
      delete metrics[id];
      const next = { ...e, metrics };
      await db.entries.put(isEntryEmpty(next) ? { ...next, ...fresh(), deleted: 1 } : { ...next, ...fresh() });
    }
  });
  emitLocalChange();
}

// ── Borrado total ───────────────────────────────────────────────────────────

/** Vacía la base local por completo (datos y metadatos del dispositivo). */
export async function wipeLocal(): Promise<void> {
  await db.transaction('rw', [db.settings, db.entries, db.reviews, db.meta], async () => {
    await Promise.all([db.settings.clear(), db.entries.clear(), db.reviews.clear(), db.meta.clear()]);
  });
}

/** Borra el historial (entradas y revisiones) dejando la configuración. Genera lápidas para sincronizar. */
export async function resetHistory(): Promise<void> {
  await db.transaction('rw', db.entries, db.reviews, async () => {
    const stamp = fresh();
    await db.entries.toCollection().modify({ ...stamp, deleted: 1, metrics: {}, notes: '', tags: [], doseTakenAt: undefined });
    await db.reviews.toCollection().modify({ ...stamp, deleted: 1, notes: '' });
  });
  emitLocalChange();
}

export type { Entry, Review, Settings };
