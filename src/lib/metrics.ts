export interface Metric {
  id: string;
  label: string;
  color: string;
  /** Etiqueta para cada valor 1–5. */
  labels: [string, string, string, string, string];
  /** true si un valor más bajo es mejor (p. ej. ansiedad). */
  inverse?: boolean;
}

export const DEFAULT_METRICS: Metric[] = [
  { id: 'mood', label: 'Ánimo', color: '#EA7A2A', labels: ['Bajo', 'Apagado', 'Normal', 'Bien', 'Pleno'] },
  { id: 'focus', label: 'Foco', color: '#0E9384', labels: ['Disperso', 'Distraído', 'Normal', 'Enfocado', 'En la zona'] },
  { id: 'creativity', label: 'Creatividad', color: '#D6408A', labels: ['Bloqueada', 'Escasa', 'Normal', 'Fluida', 'Desbordante'] },
  { id: 'anxiety', label: 'Ansiedad', color: '#B88A12', labels: ['Nada', 'Leve', 'Moderada', 'Alta', 'Muy alta'], inverse: true },
];

// Paleta fija para métricas nuevas: legible en tema claro y oscuro,
// y distinta del índigo (reservado para la acción y el día activo).
export const METRIC_PALETTE = [
  '#EA7A2A', '#0E9384', '#D6408A', '#B88A12',
  '#2E7DD1', '#6F9A1E', '#C2410C', '#8B5CF6', '#0891B2', '#B4536B',
];

export const GENERIC_LABELS: Metric['labels'] = ['Muy bajo', 'Bajo', 'Normal', 'Alto', 'Muy alto'];

export function nextMetricColor(existing: Metric[]): string {
  const used = new Set(existing.map((m) => m.color.toUpperCase()));
  return METRIC_PALETTE.find((c) => !used.has(c.toUpperCase())) ?? METRIC_PALETTE[existing.length % METRIC_PALETTE.length];
}

export function slugify(label: string): string {
  const base = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'metrica';
}

/** Cifras con coma decimal: 3,8 */
export function fmt1(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
