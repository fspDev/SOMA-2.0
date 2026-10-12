import type { ISODate } from '../lib/dates';
import type { Metric } from '../lib/metrics';
import type { Phase, Protocol } from '../lib/protocol';

/** Campos de control comunes a todo registro sincronizable. */
export interface SyncFields {
  /** Momento de la última edición (ms, reloj del dispositivo). */
  updatedAt: number;
  /** 1 si tiene cambios que todavía no se subieron. */
  dirty: 0 | 1;
  /** 1 si fue borrado (se conserva como lápida para sincronizar). */
  deleted: 0 | 1;
}

export type Theme = 'light' | 'dark' | 'system';

export interface Settings extends SyncFields {
  key: 'main';
  name: string;
  protocol: Protocol;
  startDate: ISODate;
  metrics: Metric[];
  theme: Theme;
  intention: string;
  intentionSetAt?: ISODate;
}

export interface Entry extends SyncFields {
  date: ISODate;
  metrics: Record<string, number>;
  notes: string;
  tags: string[];
  /** Hora local "HH:MM" en que se marcó la dosis como tomada. */
  doseTakenAt?: string;
  /** Fase del protocolo al momento de registrar (no cambia si después se cambia el protocolo). */
  phase?: Phase;
}

export interface Review extends SyncFields {
  date: ISODate;
  notes: string;
}

/** Valores propios de este dispositivo; nunca se sincronizan. */
export interface MetaRow {
  key: string;
  value: unknown;
}

export type StorageMode = 'local' | 'account';

export type SettingsData = Omit<Settings, keyof SyncFields | 'key'>;
export type EntryData = Omit<Entry, keyof SyncFields>;
export type ReviewData = Omit<Review, keyof SyncFields>;
