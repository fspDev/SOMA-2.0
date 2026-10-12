import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { createSettings, deleteMetric, getSettings, normalizeTags, resetHistory, saveEntry, setDoseTaken } from './repo';
import { backupToCSV, buildBackup, importBackup } from './backup';
import { PROTOCOL_PRESETS } from '../lib/protocol';

beforeEach(async () => {
  await Promise.all([db.settings.clear(), db.entries.clear(), db.reviews.clear(), db.meta.clear()]);
  await createSettings({ name: 'Franco', protocol: PROTOCOL_PRESETS.fadiman, startDate: '2026-10-01' });
});

describe('repositorio local', () => {
  it('guarda la fase del día al registrar', async () => {
    await saveEntry('2026-10-01', { metrics: { mood: 4 }, notes: '', tags: [] });
    await saveEntry('2026-10-02', { metrics: { mood: 3 }, notes: '', tags: [] });
    expect((await db.entries.get('2026-10-01'))?.phase).toBe('dose');
    expect((await db.entries.get('2026-10-02'))?.phase).toBe('rest');
  });

  it('la dosis y las métricas conviven en la misma entrada', async () => {
    await setDoseTaken('2026-10-01', '08:42');
    await saveEntry('2026-10-01', { metrics: { mood: 4 }, notes: 'ok', tags: ['#Caminata'] });
    const e = await db.entries.get('2026-10-01');
    expect(e).toMatchObject({ doseTakenAt: '08:42', metrics: { mood: 4 }, tags: ['caminata'], dirty: 1, deleted: 0 });
  });

  it('una entrada vacía queda como lápida (para sincronizar el borrado)', async () => {
    await saveEntry('2026-10-01', { metrics: { mood: 4 }, notes: '', tags: [] });
    await saveEntry('2026-10-01', { metrics: {}, notes: '', tags: [] });
    expect((await db.entries.get('2026-10-01'))?.deleted).toBe(1);
  });

  it('borrar una métrica limpia sus valores', async () => {
    await saveEntry('2026-10-01', { metrics: { mood: 4, focus: 2 }, notes: '', tags: [] });
    await saveEntry('2026-10-02', { metrics: { focus: 2 }, notes: '', tags: [] });
    await deleteMetric('focus');
    expect((await getSettings())?.metrics.map((m) => m.id)).not.toContain('focus');
    expect((await db.entries.get('2026-10-01'))?.metrics).toEqual({ mood: 4 });
    expect((await db.entries.get('2026-10-02'))?.deleted).toBe(1);
  });

  it('reiniciar historial conserva la configuración', async () => {
    await saveEntry('2026-10-01', { metrics: { mood: 4 }, notes: '', tags: [] });
    await resetHistory();
    expect((await db.entries.get('2026-10-01'))?.deleted).toBe(1);
    expect((await getSettings())?.name).toBe('Franco');
  });

  it('normaliza etiquetas', () => {
    expect(normalizeTags(['#Sueño', 'sueño', ' trabajo ', '', 'muy bien'])).toEqual(['sueño', 'trabajo', 'muy-bien']);
  });
});

describe('copias', () => {
  it('exporta e importa sin perder datos', async () => {
    await setDoseTaken('2026-10-01', '08:42');
    await saveEntry('2026-10-01', { metrics: { mood: 4 }, notes: 'Hola, "mundo"', tags: ['familia'] });
    const backup = await buildBackup();
    expect(backup.entries).toHaveLength(1);
    expect(backup.entries[0]).not.toHaveProperty('dirty');

    const csv = backupToCSV(backup);
    expect(csv).toContain('fecha,fase,dosis_hora,Ánimo');
    expect(csv).toContain('2026-10-01,dosis,08:42,4');
    expect(csv).toContain('"Hola, ""mundo"""');

    await db.entries.clear();
    const res = await importBackup(JSON.stringify(backup));
    expect(res.entries).toBe(1);
    expect(await db.entries.get('2026-10-01')).toMatchObject({ doseTakenAt: '08:42', notes: 'Hola, "mundo"' });
  });

  it('rechaza archivos que no son de SOMA', async () => {
    await expect(importBackup('{"foo":1}')).rejects.toThrow('no parece una copia');
    await expect(importBackup('no json')).rejects.toThrow('JSON válido');
  });
});
