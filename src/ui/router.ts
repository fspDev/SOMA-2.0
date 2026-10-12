import { useSyncExternalStore } from 'react';

// Router mínimo por hash (#/viaje/patrones). Funciona en GitHub Pages sin configurar
// nada del servidor y deja que el botón "atrás" del teléfono haga lo esperado.

function read(): string[] {
  const path = decodeURIComponent(location.hash.replace(/^#\/?/, '')).replace(/\/+$/, '');
  return path ? path.split('/') : [];
}

let current = read();
let depth = 0;
const subs = new Set<() => void>();

window.addEventListener('hashchange', () => {
  current = read();
  subs.forEach((fn) => fn());
});

export function useRoute(): string[] {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => current,
  );
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const hash = '#/' + to.replace(/^\/+/, '');
  if (opts.replace) {
    history.replaceState(null, '', hash);
    current = read();
    subs.forEach((fn) => fn());
  } else {
    depth++;
    location.hash = hash;
  }
  window.scrollTo(0, 0);
}

/** Vuelve atrás si se llegó navegando dentro de la app; si no, va a `fallback`. */
export function goBack(fallback = ''): void {
  if (depth > 0) {
    depth--;
    history.back();
  } else {
    navigate(fallback, { replace: true });
  }
}
