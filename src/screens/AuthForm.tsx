import { useState } from 'react';
import { Button, Segmented } from '../ui/kit';
import { signIn, signUp } from '../sync/sync';

export function AuthForm({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === 'signup') {
      if (password.length < 8) return setError('La contraseña tiene que tener al menos 8 caracteres.');
      if (password !== confirm) return setError('Las contraseñas no coinciden.');
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const res = await signUp(email, password);
        if (res === 'confirm-email') {
          setNotice('Te mandamos un email para confirmar la cuenta. Cuando lo confirmes, ingresá acá con tu email y contraseña.');
          setMode('signin');
          setConfirm('');
          return;
        }
      } else {
        await signIn(email, password);
      }
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Segmented
        label="Tipo de acceso"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { value: 'signup', label: 'Crear cuenta' },
          { value: 'signin', label: 'Ingresar' },
        ]}
      />
      <input
        className="field mt-2"
        type="email"
        required
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="field"
        type="password"
        required
        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {mode === 'signup' && (
        <input
          className="field"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Repetí la contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      )}
      <p className="rounded-[14px] bg-accent-tint px-4 py-3 text-[13px] leading-relaxed text-ink">
        Tu contraseña también es la llave que cifra tus datos. <strong>Si la olvidás, no se pueden recuperar</strong>:
        ni nosotros podemos leerlos. Guardala en un lugar seguro.
      </p>
      {error && (
        <p role="alert" className="px-1 text-[13px] text-danger">
          {error}
        </p>
      )}
      {notice && <p className="px-1 text-[13px] text-muted">{notice}</p>}
      <Button type="submit" block loading={busy} className="mt-2">
        {mode === 'signup' ? 'Crear cuenta cifrada' : 'Ingresar'}
      </Button>
    </form>
  );
}
