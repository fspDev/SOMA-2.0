import type { SupabaseClient } from '@supabase/supabase-js';
import type { Table } from 'dexie';
import { db, getMeta, setMeta } from '../db/db';
import { onLocalChange } from '../db/changes';
import { wipeLocal } from '../db/repo';
import type { Entry, Review, Settings, StorageMode } from '../db/types';
import { deriveAccount, normalizeEmail, open, recordId, seal, type AccountKeys } from './crypto';

// ── Cliente ─────────────────────────────────────────────────────────────────

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const accountsAvailable = Boolean(url && anonKey);

// Supabase se carga recién cuando hace falta: en modo local no se descarga.
let client: Promise<SupabaseClient> | null = null;
function sb(): Promise<SupabaseClient> {
  if (!accountsAvailable) throw new SyncError('La sincronización con cuenta no está configurada en esta instalación.');
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } }),
  );
  return client;
}

export class SyncError extends Error {}

// ── Estado observable ───────────────────────────────────────────────────────

export interface SyncState {
  mode: StorageMode | null;
  email: string | null;
  syncing: boolean;
  lastSyncAt: number | null;
  error: string | null;
}

let state: SyncState = { mode: null, email: null, syncing: false, lastSyncAt: null, error: null };
const subs = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  subs.forEach((fn) => fn());
}

export const syncStore = {
  get: () => state,
  subscribe: (fn: () => void) => {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};

// ── Meta del dispositivo ────────────────────────────────────────────────────

const META = {
  mode: 'storageMode',
  email: 'accountEmail',
  keys: 'accountKeys',
  cursor: 'syncCursor',
  lastSync: 'lastSyncAt',
} as const;

export async function loadSyncState(): Promise<void> {
  const [mode, email, lastSyncAt] = await Promise.all([
    getMeta<StorageMode>(META.mode),
    getMeta<string>(META.email),
    getMeta<number>(META.lastSync),
  ]);
  setState({ mode: mode ?? null, email: email ?? null, lastSyncAt: lastSyncAt ?? null });
}

export async function chooseLocalMode(): Promise<void> {
  await setMeta(META.mode, 'local');
  setState({ mode: 'local' });
}

// ── Cuenta ──────────────────────────────────────────────────────────────────

function authMessage(err: { message?: string; code?: string } | null): string {
  const m = (err?.message ?? '').toLowerCase();
  if (m.includes('invalid login')) return 'Email o contraseña incorrectos.';
  if (m.includes('already registered') || err?.code === 'user_already_exists') return 'Ya existe una cuenta con ese email. Ingresá con tu contraseña.';
  if (m.includes('email not confirmed')) return 'Todavía no confirmaste tu email. Revisá tu correo.';
  if (m.includes('rate limit')) return 'Demasiados intentos. Probá de nuevo en unos minutos.';
  if (m.includes('fetch') || m.includes('network')) return 'No hay conexión. Probá de nuevo cuando estés en línea.';
  return err?.message || 'No se pudo completar la operación.';
}

async function activateAccount(email: string, keys: AccountKeys): Promise<void> {
  await setMeta(META.mode, 'account');
  await setMeta(META.email, email);
  await setMeta(META.keys, keys);
  await setMeta(META.cursor, undefined);
  // Todo lo que ya había en este equipo se sube y se fusiona con la cuenta.
  await Promise.all([
    db.settings.toCollection().modify({ dirty: 1 }),
    db.entries.toCollection().modify({ dirty: 1 }),
    db.reviews.toCollection().modify({ dirty: 1 }),
  ]);
  setState({ mode: 'account', email, error: null });
  await syncNow();
}

export type SignUpResult = 'ready' | 'confirm-email';

export async function signUp(emailRaw: string, password: string): Promise<SignUpResult> {
  const email = normalizeEmail(emailRaw);
  const { authSecret, keys } = await deriveAccount(email, password);
  const { data, error } = await (await sb()).auth.signUp({ email, password: authSecret });
  if (error) throw new SyncError(authMessage(error));
  // Supabase no avisa si el email ya existe (devuelve un usuario sin identidades).
  if (data.user && data.user.identities?.length === 0) {
    throw new SyncError('Ya existe una cuenta con ese email. Ingresá con tu contraseña.');
  }
  if (!data.session) return 'confirm-email';
  await activateAccount(email, keys);
  return 'ready';
}

export async function signIn(emailRaw: string, password: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  const { authSecret, keys } = await deriveAccount(email, password);
  const { error } = await (await sb()).auth.signInWithPassword({ email, password: authSecret });
  if (error) throw new SyncError(authMessage(error));
  await activateAccount(email, keys);
}

/** Cierra la sesión y borra los datos de este equipo (siguen en la cuenta). */
export async function signOut(): Promise<void> {
  if (accountsAvailable) await (await sb()).auth.signOut({ scope: 'local' }).catch(() => undefined);
  await wipeLocal();
  setState({ mode: null, email: null, lastSyncAt: null, error: null });
}

/**
 * Elimina la cuenta y todos sus datos. Primero verifica la contraseña
 * (reautenticación); si falla, no se borra nada.
 */
export async function deleteAccount(password: string): Promise<void> {
  const email = state.email;
  if (!email) throw new SyncError('No hay una cuenta activa.');
  const { authSecret } = await deriveAccount(email, password);
  const { error: authError } = await (await sb()).auth.signInWithPassword({ email, password: authSecret });
  if (authError) throw new SyncError(authMessage(authError));
  const { error } = await (await sb()).rpc('delete_account');
  if (error) throw new SyncError('No se pudo eliminar la cuenta. No se borró nada; probá de nuevo.');
  await (await sb()).auth.signOut({ scope: 'local' }).catch(() => undefined);
  await wipeLocal();
  setState({ mode: null, email: null, lastSyncAt: null, error: null });
}

/** Borra solo los datos locales (modo sin cuenta). */
export async function deleteLocalData(): Promise<void> {
  await wipeLocal();
  setState({ mode: null, email: null, lastSyncAt: null, error: null });
}

// ── Sincronización ──────────────────────────────────────────────────────────

type Kind = 'settings' | 'entry' | 'review';
interface Payload {
  kind: Kind;
  key: string;
  data: Record<string, unknown> | null;
}
interface RemoteRow {
  id: string;
  iv: string;
  ciphertext: string;
  deleted: boolean;
  client_updated_at: number;
  server_updated_at: string;
}

type SyncRow = { updatedAt: number; dirty: 0 | 1 } & Record<string, unknown>;
type AnyTable = Table<SyncRow, string>;

const tables: Record<Kind, () => AnyTable> = {
  settings: () => db.settings as unknown as AnyTable,
  entry: () => db.entries as unknown as AnyTable,
  review: () => db.reviews as unknown as AnyTable,
};

function stripSync<T extends { updatedAt: number; dirty: 0 | 1; deleted: 0 | 1 }>(r: T) {
  const { updatedAt: _u, dirty: _d, deleted: _x, ...rest } = r;
  return rest as Record<string, unknown>;
}

let running: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  if (state.mode !== 'account' || !accountsAvailable) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    setState({ syncing: true });
    try {
      do {
        again = false;
        await runSync();
      } while (again);
      const now = Date.now();
      await setMeta(META.lastSync, now);
      setState({ lastSyncAt: now, error: null });
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : 'Error de sincronización' });
    } finally {
      setState({ syncing: false });
      running = null;
    }
  })();
  return running;
}

async function runSync(): Promise<void> {
  const keys = await getMeta<AccountKeys>(META.keys);
  const { data: sess } = await (await sb()).auth.getSession();
  const userId = sess.session?.user.id;
  if (!keys || !userId) throw new SyncError('Sesión vencida. Ingresá de nuevo desde Ajustes.');
  await pull(keys);
  await push(keys, userId);
}

const PAGE = 1000;

async function pull(keys: AccountKeys): Promise<void> {
  const saved = await getMeta<string>(META.cursor);
  // Margen de 30 s: una fila confirmada tarde con marca anterior no se pierde (reaplicar es idempotente).
  let cursor = saved ? new Date(Date.parse(saved) - 30_000).toISOString() : '1970-01-01T00:00:00Z';
  let maxSeen = saved ?? null;
  for (;;) {
    const { data, error } = await (await sb())
      .from('records')
      .select('id, iv, ciphertext, deleted, client_updated_at, server_updated_at')
      .gt('server_updated_at', cursor)
      .order('server_updated_at', { ascending: true })
      .limit(PAGE);
    if (error) throw new SyncError('No se pudo descargar: ' + error.message);
    const rows = (data ?? []) as RemoteRow[];
    for (const row of rows) await applyRemote(keys, row);
    if (rows.length) {
      cursor = rows[rows.length - 1].server_updated_at;
      if (!maxSeen || cursor > maxSeen) maxSeen = cursor;
    }
    if (rows.length < PAGE) break;
  }
  if (maxSeen) await setMeta(META.cursor, maxSeen);
}

async function applyRemote(keys: AccountKeys, row: RemoteRow): Promise<void> {
  let payload: Payload;
  try {
    payload = await open<Payload>(keys.encKey, row.id, row);
  } catch {
    return; // Registro ilegible con esta clave: se ignora.
  }
  const table = tables[payload.kind]?.();
  if (!table) return;
  const local = await table.get(payload.key);
  const remoteAt = Number(row.client_updated_at);
  if (local && (local.updatedAt > remoteAt || (local.dirty && local.updatedAt === remoteAt))) return;
  const keyField = payload.kind === 'settings' ? { key: 'main' } : { date: payload.key };
  const record = {
    ...(payload.data ?? (payload.kind === 'review' ? { notes: '' } : payload.kind === 'entry' ? { metrics: {}, notes: '', tags: [] } : {})),
    ...keyField,
    updatedAt: remoteAt,
    dirty: 0,
    deleted: row.deleted ? 1 : 0,
  };
  await table.put(record as SyncRow);
}

async function push(keys: AccountKeys, userId: string): Promise<void> {
  type Dirty = { kind: Kind; key: string; rec: Settings | Entry | Review };
  const dirty: Dirty[] = [
    ...(await db.settings.where('dirty').equals(1).toArray()).map((rec) => ({ kind: 'settings' as const, key: 'main', rec })),
    ...(await db.entries.where('dirty').equals(1).toArray()).map((rec) => ({ kind: 'entry' as const, key: rec.date, rec })),
    ...(await db.reviews.where('dirty').equals(1).toArray()).map((rec) => ({ kind: 'review' as const, key: rec.date, rec })),
  ];
  for (let i = 0; i < dirty.length; i += 200) {
    const chunk = dirty.slice(i, i + 200);
    const rows = await Promise.all(
      chunk.map(async ({ kind, key, rec }) => {
        const id = await recordId(keys.idKey, kind, key);
        const payload: Payload = { kind, key, data: rec.deleted ? null : stripSync(rec) };
        const sealed = await seal(keys.encKey, id, payload);
        return { user_id: userId, id, ...sealed, deleted: rec.deleted === 1, client_updated_at: rec.updatedAt };
      }),
    );
    const { error } = await (await sb()).from('records').upsert(rows, { onConflict: 'user_id,id' });
    if (error) throw new SyncError('No se pudo subir: ' + error.message);
    // Se limpia la marca solo si el registro no cambió mientras se subía.
    for (const { kind, rec } of chunk) {
      const table = tables[kind]();
      const pk = kind === 'settings' ? 'main' : (rec as Entry).date;
      await table
        .where(kind === 'settings' ? 'key' : 'date')
        .equals(pk)
        .and((r) => r.updatedAt === rec.updatedAt)
        .modify({ dirty: 0 });
    }
  }
}

// ── Agenda automática ───────────────────────────────────────────────────────

let timer: ReturnType<typeof setTimeout> | undefined;
function schedule(delay = 1500) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

let started = false;
export function startAutoSync(): void {
  if (started) return;
  started = true;
  onLocalChange(() => schedule());
  window.addEventListener('online', () => schedule(0));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule(0);
  });
  setInterval(() => schedule(0), 5 * 60_000);
  schedule(0);
}
