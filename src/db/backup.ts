import { db } from './db';
import { emitLocalChange } from './changes';
import { getSettings, normalizeTags } from './repo';
import type { Entry, Review, SettingsData } from './types';
import { isISODate, todayISO } from '../lib/dates';
import type { Metric } from '../lib/metrics';

export interface BackupFile {
  app: 'soma';
  version: 1;
  exportedAt: string;
  settings: SettingsData | null;
  entries: Omit<Entry, 'dirty' | 'deleted' | 'updatedAt'>[];
  reviews: Omit<Review, 'dirty' | 'deleted' | 'updatedAt'>[];
}

function clean<T extends { dirty: unknown; deleted: unknown; updatedAt: unknown }>(r: T) {
  const { dirty: _d, deleted: _x, updatedAt: _u, ...rest } = r;
  return rest;
}

export async function buildBackup(): Promise<BackupFile> {
  const s = await getSettings();
  const entries = (await db.entries.toArray()).filter((e) => !e.deleted).sort((a, b) => a.date.localeCompare(b.date));
  const reviews = (await db.reviews.toArray()).filter((r) => !r.deleted).sort((a, b) => a.date.localeCompare(b.date));
  let settings: SettingsData | null = null;
  if (s) {
    const { key: _k, ...rest } = clean(s);
    settings = rest;
  }
  return {
    app: 'soma',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    entries: entries.map(clean),
    reviews: reviews.map(clean),
  };
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function backupToCSV(b: BackupFile): string {
  const metrics: Metric[] = b.settings?.metrics ?? [];
  const known = new Set(metrics.map((m) => m.id));
  const extra = [...new Set(b.entries.flatMap((e) => Object.keys(e.metrics)))].filter((id) => !known.has(id));
  const header = ['fecha', 'fase', 'dosis_hora', ...metrics.map((m) => m.label), ...extra, 'etiquetas', 'notas'];
  const lines = [header.map(csvCell).join(',')];
  for (const e of b.entries) {
    lines.push(
      [
        e.date,
        e.doseTakenAt ? 'dosis' : e.phase === 'dose' ? 'dosis' : e.phase === 'rest' ? 'descanso' : '',
        e.doseTakenAt ?? '',
        ...metrics.map((m) => e.metrics[m.id] ?? ''),
        ...extra.map((id) => e.metrics[id] ?? ''),
        e.tags.join(' '),
        e.notes,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  // BOM para que Excel abra bien los acentos.
  return '﻿' + lines.join('\r\n');
}

export function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function exportJSON(): Promise<void> {
  const b = await buildBackup();
  download(`soma-${todayISO()}.json`, JSON.stringify(b, null, 2), 'application/json');
}

export async function exportCSV(): Promise<void> {
  const b = await buildBackup();
  download(`soma-${todayISO()}.csv`, backupToCSV(b), 'text/csv;charset=utf-8');
}

export class ImportError extends Error {}

/** Importa una copia JSON. Lo importado reemplaza a lo local solo en las fechas que trae. */
export async function importBackup(text: string): Promise<{ entries: number; reviews: number }> {
  let data: BackupFile;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('El archivo no es un JSON válido.');
  }
  if (data?.app !== 'soma' || !Array.isArray(data.entries)) {
    throw new ImportError('El archivo no parece una copia de SOMA.');
  }
  const now = Date.now();
  const stamp = { updatedAt: now, dirty: 1 as const, deleted: 0 as const };
  const entries: Entry[] = data.entries
    .filter((e) => isISODate(e?.date))
    .map((e) => ({
      date: e.date,
      metrics: Object.fromEntries(
        Object.entries(e.metrics ?? {}).filter(([, v]) => typeof v === 'number' && v >= 1 && v <= 5),
      ),
      notes: typeof e.notes === 'string' ? e.notes : '',
      tags: normalizeTags(Array.isArray(e.tags) ? e.tags.filter((t) => typeof t === 'string') : []),
      ...(typeof e.doseTakenAt === 'string' ? { doseTakenAt: e.doseTakenAt } : {}),
      ...(e.phase === 'dose' || e.phase === 'rest' ? { phase: e.phase } : {}),
      ...stamp,
    }));
  const reviews: Review[] = (data.reviews ?? [])
    .filter((r) => isISODate(r?.date) && typeof r.notes === 'string')
    .map((r) => ({ date: r.date, notes: r.notes, ...stamp }));

  await db.transaction('rw', db.entries, db.reviews, db.settings, async () => {
    await db.entries.bulkPut(entries);
    await db.reviews.bulkPut(reviews);
    const current = await getSettings();
    if (data.settings && current) {
      // Se suman las métricas que la copia trae y acá no existen.
      const ids = new Set(current.metrics.map((m) => m.id));
      const added = (data.settings.metrics ?? []).filter((m) => m && !ids.has(m.id));
      if (added.length) await db.settings.put({ ...current, metrics: [...current.metrics, ...added], ...stamp });
    }
  });
  emitLocalChange();
  return { entries: entries.length, reviews: reviews.length };
}

/** Para el primer arranque: si se restaura una copia antes de configurar, se usa su configuración. */
export async function restoreSettingsFrom(text: string): Promise<boolean> {
  try {
    const data = JSON.parse(text) as BackupFile;
    if (data?.app !== 'soma' || !data.settings) return false;
    await db.settings.put({ ...data.settings, key: 'main', updatedAt: Date.now(), dirty: 1, deleted: 0 });
    return true;
  } catch {
    return false;
  }
}
