// Todas las fechas de la app son "fechas locales" en formato YYYY-MM-DD.
// Nunca usar toISOString() para obtener el día: devuelve la fecha en UTC
// (en Argentina, después de las 21 h ya sería "mañana").

export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(now: Date = new Date()): ISODate {
  return toLocalISODate(now);
}

export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toLocalISODate(parseISODate(s)) === s;
}

// Diferencia en días calendario, inmune a cambios de horario de verano.
function dayNumber(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function diffDays(from: ISODate, to: ISODate): number {
  return dayNumber(to) - dayNumber(from);
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toLocalISODate(d);
}

/** Lunes de la semana que contiene `iso`. */
export function startOfWeek(iso: ISODate): ISODate {
  const dow = (parseISODate(iso).getDay() + 6) % 7; // 0 = lunes
  return addDays(iso, -dow);
}

export function localTimeHHMM(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const LOCALE = 'es-AR';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Lunes 12 de octubre" */
export function formatLong(iso: ISODate): string {
  const d = parseISODate(iso);
  const wd = d.toLocaleDateString(LOCALE, { weekday: 'long' });
  const month = d.toLocaleDateString(LOCALE, { month: 'long' });
  return `${cap(wd)} ${d.getDate()} de ${month}`;
}

/** "Lunes 12 oct" */
export function formatShortWithWeekday(iso: ISODate): string {
  const d = parseISODate(iso);
  const wd = d.toLocaleDateString(LOCALE, { weekday: 'long' });
  return `${cap(wd)} ${d.getDate()} ${monthShort(d)}`;
}

/** "12 oct" o "12 oct 2025" si no es el año actual */
export function formatShort(iso: ISODate, withYear?: boolean): string {
  const d = parseISODate(iso);
  const showYear = withYear ?? d.getFullYear() !== new Date().getFullYear();
  return `${d.getDate()} ${monthShort(d)}${showYear ? ` ${d.getFullYear()}` : ''}`;
}

/** "27 de agosto" */
export function formatDayMonth(iso: ISODate): string {
  const d = parseISODate(iso);
  return `${d.getDate()} de ${d.toLocaleDateString(LOCALE, { month: 'long' })}`;
}

function monthShort(d: Date): string {
  return d.toLocaleDateString(LOCALE, { month: 'short' }).replace('.', '');
}

export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
