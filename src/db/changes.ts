// Aviso liviano de "hubo un cambio local" para que la sincronización se agende sola,
// sin que la capa de datos dependa del módulo de sincronización.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitLocalChange(): void {
  listeners.forEach((fn) => fn());
}
