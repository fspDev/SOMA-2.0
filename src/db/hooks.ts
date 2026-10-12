import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { getSettings } from './repo';
import type { Entry, Review, Settings } from './types';
import { todayISO, type ISODate } from '../lib/dates';
import { syncStore } from '../sync/sync';

/** undefined mientras carga; null si todavía no hay configuración. */
export function useSettingsQuery(): Settings | null | undefined {
  const res = useLiveQuery(async () => ({ s: (await getSettings()) ?? null }), []);
  return res?.s;
}

const EMPTY: never[] = [];

export function useEntries(): Entry[] {
  return (
    useLiveQuery(async () => (await db.entries.orderBy('date').toArray()).filter((e) => !e.deleted), []) ?? EMPTY
  );
}

export function useEntriesByDate(): Map<ISODate, Entry> {
  const entries = useEntries();
  return useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);
}

export function useEntry(date: ISODate): Entry | null | undefined {
  const res = useLiveQuery(async () => {
    const e = await db.entries.get(date);
    return { e: e && !e.deleted ? e : null };
  }, [date]);
  return res?.e;
}

export function useReviews(): Review[] {
  return (
    useLiveQuery(async () => (await db.reviews.orderBy('date').toArray()).filter((r) => !r.deleted), []) ?? EMPTY
  );
}

/** Fecha local de hoy; se actualiza sola al pasar la medianoche o al volver a la app. */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const check = () => setToday((prev) => (prev === todayISO() ? prev : todayISO()));
    const id = setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}

export function useSyncState() {
  return useSyncExternalStore(syncStore.subscribe, syncStore.get);
}
