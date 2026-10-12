import { useEffect } from 'react';
import { Activity, Settings2, SquarePlus, Sun } from 'lucide-react';
import { cx, Spinner } from './ui/kit';
import { navigate, useRoute } from './ui/router';
import { useSettingsQuery, useSyncState, useToday } from './db/hooks';
import type { Theme } from './db/types';
import { isISODate } from './lib/dates';
import { Home } from './screens/Home';
import { Register } from './screens/Register';
import { Journey } from './screens/Journey';
import { SettingsScreen } from './screens/SettingsScreen';
import { Privacy } from './screens/Privacy';
import { Setup, Welcome } from './screens/Onboarding';

function useApplyTheme(theme: Theme | undefined) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || ((theme ?? 'system') === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      try {
        localStorage.setItem('soma-theme', theme ?? 'system');
      } catch {
        /* sin almacenamiento: no pasa nada */
      }
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e0f12' : '#f5f5f3');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export default function App() {
  const settings = useSettingsQuery();
  const sync = useSyncState();
  const today = useToday();
  const route = useRoute();
  useApplyTheme(settings?.theme);

  if (settings === undefined) return <Splash />;

  if (!settings) {
    if (!sync.mode) return <Welcome />;
    // Con cuenta en un equipo nuevo: esperar la primera descarga antes de pedir configuración.
    if (sync.mode === 'account' && (sync.syncing || (sync.lastSyncAt === null && !sync.error))) {
      return <Splash text="Descargando y descifrando tus datos…" />;
    }
    return <Setup />;
  }

  const [section, param] = route;
  let screen: React.ReactNode;
  let nav = true;
  switch (section) {
    case 'registrar': {
      const date = isISODate(param) && param <= today ? param : today;
      screen = <Register settings={settings} date={date} today={today} />;
      nav = false;
      break;
    }
    case 'viaje':
      screen = <Journey settings={settings} today={today} tab={param} />;
      break;
    case 'ajustes':
      screen = <SettingsScreen settings={settings} />;
      break;
    case 'privacidad':
      screen = <Privacy />;
      nav = false;
      break;
    default:
      screen = <Home settings={settings} today={today} />;
  }

  return (
    <>
      <main className={cx('mx-auto max-w-[480px] px-5 pt-[max(env(safe-area-inset-top),20px)]', nav ? 'pb-nav' : 'pb-4')}>
        {screen}
      </main>
      {nav && <BottomNav active={section ?? ''} />}
    </>
  );
}

function Splash({ text }: { text?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted">
        <Spinner />
        {text && <p className="text-[14px]">{text}</p>}
      </div>
    </div>
  );
}

const TABS = [
  { id: '', label: 'Hoy', icon: Sun },
  { id: 'registrar', label: 'Registrar', icon: SquarePlus },
  { id: 'viaje', label: 'Viaje', icon: Activity },
  { id: 'ajustes', label: 'Ajustes', icon: Settings2 },
];

function BottomNav({ active }: { active: string }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-safe"
    >
      <div className="mx-auto grid max-w-[480px] grid-cols-4">
        {TABS.map(({ id, label, icon: Icon }) => {
          const on = active === id;
          return (
            <button
              key={id}
              onClick={() => navigate(id, { replace: id !== 'registrar' })}
              aria-current={on ? 'page' : undefined}
              className={cx('flex h-16 flex-col items-center justify-center gap-1', on ? 'text-ink' : 'text-faint')}
            >
              <Icon size={20} strokeWidth={on ? 2.2 : 1.8} />
              <span className={cx('text-[11px]', on ? 'font-semibold' : 'font-medium')}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
