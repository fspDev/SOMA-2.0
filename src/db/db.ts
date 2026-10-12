import Dexie, { type EntityTable } from 'dexie';
import type { Entry, MetaRow, Review, Settings } from './types';

export class SomaDB extends Dexie {
  settings!: EntityTable<Settings, 'key'>;
  entries!: EntityTable<Entry, 'date'>;
  reviews!: EntityTable<Review, 'date'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'soma') {
    super(name);
    this.version(1).stores({
      settings: 'key, dirty',
      entries: 'date, dirty',
      reviews: 'date, dirty',
      meta: 'key',
    });
  }
}

export const db = new SomaDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  if (value === undefined) await db.meta.delete(key);
  else await db.meta.put({ key, value });
}
