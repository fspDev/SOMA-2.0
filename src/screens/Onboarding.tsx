import { useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button, Logo, cx, useToast } from '../ui/kit';
import { DISCLAIMER, HARM_REDUCTION_LABEL, HARM_REDUCTION_URL } from '../config';
import { accountsAvailable, chooseLocalMode } from '../sync/sync';
import { createSettings } from '../db/repo';
import { importBackup, restoreSettingsFrom } from '../db/backup';
import { todayISO } from '../lib/dates';
import { PROTOCOL_PRESETS, type Protocol } from '../lib/protocol';
import { AuthForm } from './AuthForm';
import { ProtocolPicker } from './ProtocolPicker';

export const WELCOME_STEPS = [
  'Elegí tu ritmo de días activos y de descanso.',
  'Registrá cómo te sentís en menos de un minuto.',
  'Mirá tus patrones: días de dosis vs. descanso.',
];

export function Steps() {
  return (
    <ol className="card divide-y divide-line">
      {WELCOME_STEPS.map((s, i) => (
        <li key={s} className="flex items-baseline gap-4 px-5 py-4">
          <span className="font-mono text-[14px] font-medium text-accent-fg">{String(i + 1).padStart(2, '0')}</span>
          <span className="text-[15px] leading-snug">{s}</span>
        </li>
      ))}
    </ol>
  );
}

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cx('text-center text-[12px] leading-relaxed text-muted', className)}>
      {DISCLAIMER}{' '}
      <a href={HARM_REDUCTION_URL} target="_blank" rel="noreferrer" className="text-accent-fg underline underline-offset-2">
        {HARM_REDUCTION_LABEL}
      </a>
    </p>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pt-[max(env(safe-area-inset-top),48px)] pb-[max(env(safe-area-inset-bottom),20px)]">
      {children}
    </div>
  );
}

/** Primera pantalla: qué es SOMA y dónde se guardan los datos. */
export function Welcome() {
  const [choice, setChoice] = useState<'local' | 'account'>('local');
  const [step, setStep] = useState<'welcome' | 'auth'>('welcome');

  if (step === 'auth') {
    return (
      <Shell>
        <button
          onClick={() => setStep('welcome')}
          aria-label="Volver"
          className="mb-6 grid size-10 place-items-center rounded-full border border-line bg-surface"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="screen-title mb-2">Tu cuenta</h1>
        <p className="mb-6 text-muted">Tus datos se cifran en este equipo antes de salir. Nadie más puede leerlos.</p>
        <AuthForm />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-8">
        <Logo size="lg" />
      </div>
      <Steps />
      <p className="mt-7 mb-3 px-1 text-[13px] text-muted">¿Dónde guardamos tus datos?</p>
      <div role="radiogroup" aria-label="Dónde guardar los datos" className="grid grid-cols-2 gap-3">
        <StorageOption
          selected={choice === 'local'}
          onSelect={() => setChoice('local')}
          title="Solo en este equipo"
          body="Sin cuenta. Nada sale de tu dispositivo."
        />
        <StorageOption
          selected={choice === 'account'}
          onSelect={() => accountsAvailable && setChoice('account')}
          disabled={!accountsAvailable}
          title="Con cuenta"
          body={accountsAvailable ? 'Sincroniza entre dispositivos, cifrado.' : 'No disponible en esta instalación.'}
        />
      </div>
      <div className="flex-1" />
      <Button
        block
        className="mt-10"
        onClick={() => (choice === 'local' ? void chooseLocalMode() : setStep('auth'))}
      >
        Comenzar
      </Button>
      <Disclaimer className="mt-5" />
    </Shell>
  );
}

function StorageOption({
  selected,
  onSelect,
  title,
  body,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  body: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      onClick={onSelect}
      className={cx(
        'rounded-[16px] border p-4 text-left transition-colors',
        selected ? 'border-accent bg-accent-tint ring-1 ring-accent' : 'border-line bg-surface',
        disabled && 'opacity-50',
      )}
    >
      <div className="mb-1 text-[15px] font-semibold">{title}</div>
      <div className="text-[13px] leading-snug text-muted">{body}</div>
    </button>
  );
}

/** Configuración inicial: nombre, protocolo y fecha de inicio. */
export function Setup() {
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState<Protocol>(PROTOCOL_PRESETS.fadiman);
  const [startDate, setStartDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function restore(f: File) {
    const text = await f.text();
    if (!(await restoreSettingsFrom(text))) {
      toast('Ese archivo no es una copia de SOMA');
      return;
    }
    const { entries } = await importBackup(text);
    toast(`Copia restaurada · ${entries} registros`);
  }

  return (
    <Shell>
      <div className="mb-8">
        <Logo />
      </div>
      <h1 className="screen-title mb-2">Tu protocolo</h1>
      <p className="mb-7 text-muted">Podés cambiar todo esto después desde Ajustes.</p>

      <label className="label mb-2 block px-1" htmlFor="setup-name">
        ¿Cómo te llamamos?
      </label>
      <input
        id="setup-name"
        className="field mb-6"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tu nombre"
        autoComplete="given-name"
        maxLength={40}
      />

      <div className="label mb-2 px-1">Ritmo</div>
      <ProtocolPicker value={protocol} onChange={setProtocol} />

      <label className="label mt-6 mb-2 block px-1" htmlFor="setup-start">
        Inicio del protocolo
      </label>
      <input
        id="setup-start"
        type="date"
        className="field font-mono"
        value={startDate}
        onChange={(e) => e.target.value && setStartDate(e.target.value)}
      />
      <p className="mt-2 px-1 text-[12px] text-muted">El primer día del protocolo es un día de dosis.</p>

      <div className="flex-1" />
      <Button
        block
        className="mt-10"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          await createSettings({ name: name.trim(), protocol, startDate });
        }}
      >
        Empezar
      </Button>
      <button onClick={() => file.current?.click()} className="mt-3 h-11 text-[14px] font-medium text-muted">
        Restaurar una copia (JSON)
      </button>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void restore(f);
          e.target.value = '';
        }}
      />
    </Shell>
  );
}
