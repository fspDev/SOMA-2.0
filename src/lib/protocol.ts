import { diffDays, type ISODate } from './dates';

export type ProtocolId = 'fadiman' | 'stamets' | 'nocturno' | 'custom';

export interface Protocol {
  id: ProtocolId;
  onDays: number;
  offDays: number;
}

export const PROTOCOL_PRESETS: Record<Exclude<ProtocolId, 'custom'>, Protocol> = {
  fadiman: { id: 'fadiman', onDays: 1, offDays: 2 },
  stamets: { id: 'stamets', onDays: 4, offDays: 3 },
  nocturno: { id: 'nocturno', onDays: 1, offDays: 1 },
};

export const PROTOCOL_NAMES: Record<ProtocolId, string> = {
  fadiman: 'Fadiman',
  stamets: 'Stamets',
  nocturno: 'Nocturno',
  custom: 'Personalizado',
};

export function protocolName(p: Protocol): string {
  return PROTOCOL_NAMES[p.id];
}

export function protocolRhythm(p: Protocol): string {
  const on = `${p.onDays} ${p.onDays === 1 ? 'activo' : 'activos'}`;
  const off = `${p.offDays} descanso`;
  return `${on} · ${off}`;
}

export type Phase = 'dose' | 'rest';

export type DayInfo =
  | { kind: 'before'; daysUntilStart: number }
  | {
      kind: Phase;
      /** Número de ciclo, desde 1. */
      cycle: number;
      /** Posición dentro del ciclo, desde 1. */
      position: number;
      cycleLength: number;
      /** Día de protocolo, desde 1. */
      dayNumber: number;
    };

/**
 * Estado de un día: (días desde el inicio) % (activos + descanso).
 * Si el resto es menor que los días activos, es día de dosis.
 */
export function dayInfo(date: ISODate, protocol: Protocol, startDate: ISODate): DayInfo {
  const n = diffDays(startDate, date);
  if (n < 0) return { kind: 'before', daysUntilStart: -n };
  const len = Math.max(1, protocol.onDays + protocol.offDays);
  const pos = n % len;
  return {
    kind: pos < protocol.onDays ? 'dose' : 'rest',
    cycle: Math.floor(n / len) + 1,
    position: pos + 1,
    cycleLength: len,
    dayNumber: n + 1,
  };
}

export function phaseOf(date: ISODate, protocol: Protocol, startDate: ISODate): Phase | null {
  const info = dayInfo(date, protocol, startDate);
  return info.kind === 'before' ? null : info.kind;
}
