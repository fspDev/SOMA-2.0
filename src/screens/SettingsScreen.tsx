import { useRef, useState } from 'react';
import { ChevronRight, Cloud, Download, FileText, Lock, RefreshCw, Upload } from 'lucide-react';
import { Button, ConfirmSheet, Segmented, SectionLabel, Sheet, cx, useToast } from '../ui/kit';
import { navigate } from '../ui/router';
import { useSyncState } from '../db/hooks';
import { deleteMetric, resetHistory, saveMetrics, updateSettings } from '../db/repo';
import { exportCSV, exportJSON, importBackup } from '../db/backup';
import type { Settings, Theme } from '../db/types';
import { formatShort } from '../lib/dates';
import { GENERIC_LABELS, METRIC_PALETTE, nextMetricColor, slugify, type Metric } from '../lib/metrics';
import type { Protocol } from '../lib/protocol';
import { accountsAvailable, deleteAccount, deleteLocalData, signOut, syncNow } from '../sync/sync';
import { APP_VERSION } from '../config';
import { AuthForm } from './AuthForm';
import { Disclaimer, Steps } from './Onboarding';
import { ProtocolPicker } from './ProtocolPicker';
import { MetricDot } from './shared';

export function SettingsScreen({ settings }: { settings: Settings }) {
  const sync = useSyncState();
  const toast = useToast();
  const [sheet, setSheet] = useState<
    null | 'profile' | 'export' | 'storage' | 'auth' | 'delete' | 'reset' | 'signout' | 'guide' | { metric: Metric | 'new' }
  >(null);
  const close = () => setSheet(null);
  const file = useRef<HTMLInputElement>(null);
  const account = sync.mode === 'account';

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <h1 className="screen-title">Ajustes</h1>
      </header>

      {/* Perfil */}
      <section className="card flex items-center gap-4 px-4 py-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-[18px] font-semibold text-on-accent">
          {(settings.name || '·').charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-semibold">{settings.name || 'Sin nombre'}</div>
          <div className="text-[13px] text-muted">
            Inicio del protocolo · <span className="font-mono">{formatShort(settings.startDate, true)}</span>
          </div>
        </div>
        <Button variant="secondary" className="h-9 rounded-[10px] px-3 text-[13px]" onClick={() => setSheet('profile')}>
          Editar
        </Button>
      </section>

      {/* Protocolo */}
      <div>
        <SectionLabel>Protocolo</SectionLabel>
        <ProtocolPicker
          value={settings.protocol}
          onChange={async (p: Protocol) => {
            await updateSettings({ protocol: p });
            toast('Protocolo actualizado');
          }}
        />
        <p className="mt-2 px-1 text-[12px] text-muted">Los días ya registrados conservan la fase que tenían.</p>
      </div>

      {/* Métricas */}
      <div>
        <SectionLabel>Métricas</SectionLabel>
        <ul className="card divide-y divide-line">
          {settings.metrics.map((m) => (
            <li key={m.id}>
              <button onClick={() => setSheet({ metric: m })} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <MetricDot metric={m} className="size-2.5" />
                <span className="flex-1 text-[15px]">{m.label}</span>
                <span className="font-mono text-[12px] text-faint">1–5</span>
              </button>
            </li>
          ))}
          <li>
            <button onClick={() => setSheet({ metric: 'new' })} className="w-full px-4 py-3.5 text-left text-[15px] font-medium text-accent-fg">
              + Agregar métrica
            </button>
          </li>
        </ul>
      </div>

      {/* Apariencia */}
      <div>
        <SectionLabel>Apariencia{account && ' · se sincroniza'}</SectionLabel>
        <Segmented<Theme>
          label="Tema"
          value={settings.theme}
          onChange={(theme) => void updateSettings({ theme })}
          options={[
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Oscuro' },
            { value: 'system', label: 'Sistema' },
          ]}
        />
      </div>

      {/* Privacidad y datos */}
      <div>
        <SectionLabel>Privacidad y datos</SectionLabel>
        <ul className="card divide-y divide-line">
          <Row icon={<Download size={18} />} label="Exportar mis datos" detail="JSON · CSV" onClick={() => setSheet('export')} />
          <Row icon={<Upload size={18} />} label="Importar una copia" detail="JSON" onClick={() => file.current?.click()} />
          <Row
            icon={account ? <Cloud size={18} /> : <Lock size={18} />}
            label="Guardado"
            detail={account ? 'Cuenta cifrada' : 'Solo en este equipo'}
            onClick={() => setSheet('storage')}
          />
          <Row icon={<FileText size={18} />} label="Política de privacidad" chevron onClick={() => navigate('privacidad')} />
        </ul>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const r = await importBackup(await f.text());
              toast(`Importados ${r.entries} registros`);
            } catch (err) {
              toast(err instanceof Error ? err.message : 'No se pudo importar');
            }
          }}
        />
      </div>

      {/* Cuenta */}
      <div>
        <SectionLabel>{account ? 'Cuenta' : 'Datos'}</SectionLabel>
        <ul className="card divide-y divide-line">
          <li>
            <button onClick={() => setSheet('reset')} className="w-full px-4 py-3.5 text-left text-[15px]">
              Reiniciar historial
              <span className="block text-[12px] text-muted">Borra registros y revisiones; conserva tu configuración.</span>
            </button>
          </li>
          <li>
            <button onClick={() => setSheet('delete')} className="w-full px-4 py-3.5 text-left text-[15px] font-medium text-danger">
              {account ? 'Eliminar cuenta y datos' : 'Borrar todos mis datos'}
              <span className="block text-[12px] font-normal text-muted">
                {account ? 'Te pediremos tu contraseña antes de borrar.' : 'Se borra todo lo guardado en este equipo.'}
              </span>
            </button>
          </li>
        </ul>
        {account && (
          <button onClick={() => setSheet('signout')} className="mt-4 h-11 w-full text-center text-[15px] font-medium text-muted">
            Cerrar sesión
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 pb-2">
        <button onClick={() => setSheet('guide')} className="text-[13px] font-medium text-accent-fg">
          Ver la guía de bienvenida
        </button>
        <Disclaimer />
        <p className="font-mono text-[11px] text-faint">SOMA {APP_VERSION}</p>
      </div>

      {/* ── Hojas ── */}
      {sheet === 'profile' && <ProfileSheet open settings={settings} onClose={close} />}
      {typeof sheet === 'object' && sheet !== null && (
        <MetricSheet metric={sheet.metric} metrics={settings.metrics} onClose={close} />
      )}

      <Sheet open={sheet === 'export'} onClose={close} title="Exportar mis datos">
        <p className="mb-4 text-[14px] leading-relaxed text-muted">
          El JSON es una copia completa que podés volver a importar. El CSV se abre en Excel o Google Sheets.
        </p>
        <div className="flex flex-col gap-2">
          <Button block onClick={() => void exportJSON()}>
            Descargar JSON
          </Button>
          <Button variant="secondary" block onClick={() => void exportCSV()}>
            Descargar CSV
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'storage'} onClose={close} title="Guardado">
        {account ? (
          <div className="flex flex-col gap-4">
            <p className="text-[14px] leading-relaxed text-muted">
              Tus datos se cifran en este equipo con una llave derivada de tu contraseña antes de subirse. El servidor solo guarda texto
              cifrado.
            </p>
            <div className="card px-4 py-3 text-[14px]">
              <div className="label">Cuenta</div>
              <div className="truncate">{sync.email}</div>
              <div className="mt-2 label">Última sincronización</div>
              <div className="font-mono text-[13px]">
                {sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
              </div>
              {sync.error && <p className="mt-2 text-[13px] text-danger">{sync.error}</p>}
            </div>
            <Button variant="secondary" block loading={sync.syncing} onClick={() => void syncNow()}>
              <RefreshCw size={16} /> Sincronizar ahora
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-[14px] leading-relaxed text-muted">
              Tus datos están solo en este equipo, en el almacenamiento del navegador. Si borrás los datos del navegador o perdés el
              equipo, se pierden: exportá una copia de vez en cuando.
            </p>
            {accountsAvailable ? (
              <Button block onClick={() => setSheet('auth')}>
                Crear cuenta cifrada o ingresar
              </Button>
            ) : (
              <p className="text-[13px] text-faint">La sincronización con cuenta no está habilitada en esta instalación.</p>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={sheet === 'auth'} onClose={close} title="Cuenta cifrada">
        <p className="mb-4 text-[14px] leading-relaxed text-muted">Lo que ya registraste en este equipo se sube cifrado a tu cuenta.</p>
        <AuthForm
          onDone={() => {
            close();
            toast('Cuenta conectada');
          }}
        />
      </Sheet>

      <ConfirmSheet
        open={sheet === 'reset'}
        title="¿Reiniciar el historial?"
        body="Se borran todos tus registros y revisiones. Tu nombre, protocolo y métricas se conservan. No se puede deshacer: si querés, exportá una copia antes."
        confirmLabel="Reiniciar historial"
        danger
        onConfirm={async () => {
          await resetHistory();
          toast('Historial reiniciado');
        }}
        onClose={close}
      />

      <ConfirmSheet
        open={sheet === 'signout'}
        title="¿Cerrar sesión?"
        body="Tus datos siguen en tu cuenta, pero se borran de este equipo. Para volver a verlos vas a necesitar tu email y contraseña."
        confirmLabel="Cerrar sesión"
        onConfirm={signOut}
        onClose={close}
      />

      {account ? (
        <DeleteAccountSheet open={sheet === 'delete'} onClose={close} />
      ) : (
        <ConfirmSheet
          open={sheet === 'delete'}
          title="¿Borrar todos tus datos?"
          body="Se borra todo lo guardado en este equipo: configuración, registros y revisiones. No se puede deshacer."
          confirmLabel="Borrar todo"
          danger
          onConfirm={deleteLocalData}
          onClose={close}
        />
      )}

      <Sheet open={sheet === 'guide'} onClose={close} title="Cómo funciona SOMA">
        <Steps />
        <p className="mt-4 text-[14px] leading-relaxed text-muted">
          SOMA no registra cantidades ni sustancias: solo tu calendario, si tomaste la dosis y cómo te sentiste. Con el tiempo, la
          comparación entre días de dosis y de descanso te muestra tus propios patrones.
        </p>
      </Sheet>
    </div>
  );
}

function Row({
  icon,
  label,
  detail,
  chevron,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  chevron?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <span className="text-muted">{icon}</span>
        <span className="flex-1 text-[15px]">{label}</span>
        {detail && <span className="text-[12px] text-muted">{detail}</span>}
        {chevron && <ChevronRight size={16} className="text-faint" />}
      </button>
    </li>
  );
}

function ProfileSheet({ open, settings, onClose }: { open: boolean; settings: Settings; onClose: () => void }) {
  const [name, setName] = useState(settings.name);
  const [start, setStart] = useState(settings.startDate);
  const toast = useToast();
  return (
    <Sheet open={open} onClose={onClose} title="Perfil">
      <label className="label mb-2 block px-1" htmlFor="p-name">
        Nombre
      </label>
      <input id="p-name" className="field mb-4" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      <label className="label mb-2 block px-1" htmlFor="p-start">
        Inicio del protocolo
      </label>
      <input
        id="p-start"
        type="date"
        className="field font-mono"
        value={start}
        onChange={(e) => e.target.value && setStart(e.target.value)}
      />
      <p className="mt-2 mb-5 px-1 text-[12px] text-muted">Cambiar el inicio mueve el calendario de dosis y descanso hacia adelante.</p>
      <Button
        block
        onClick={async () => {
          await updateSettings({ name: name.trim(), startDate: start });
          onClose();
          toast('Perfil actualizado');
        }}
      >
        Guardar
      </Button>
    </Sheet>
  );
}

function MetricSheet({ metric, metrics, onClose }: { metric: Metric | 'new'; metrics: Metric[]; onClose: () => void }) {
  const isNew = metric === 'new';
  const [label, setLabel] = useState(isNew ? '' : metric.label);
  const [color, setColor] = useState(isNew ? nextMetricColor(metrics) : metric.color);
  const [labels, setLabels] = useState<Metric['labels']>(isNew ? GENERIC_LABELS : metric.labels);
  const [inverse, setInverse] = useState(isNew ? false : Boolean(metric.inverse));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  async function save() {
    const clean = label.trim();
    if (!clean) return;
    if (isNew) {
      let id = slugify(clean);
      while (metrics.some((m) => m.id === id)) id += '-2';
      await saveMetrics([...metrics, { id, label: clean, color, labels, inverse }]);
      toast('Métrica agregada');
    } else {
      await saveMetrics(metrics.map((m) => (m.id === metric.id ? { ...m, label: clean, color, labels, inverse } : m)));
      toast('Métrica actualizada');
    }
    onClose();
  }

  return (
    <>
      <Sheet open={!confirmDelete} onClose={onClose} title={isNew ? 'Nueva métrica' : 'Editar métrica'}>
        <label className="label mb-2 block px-1" htmlFor="m-label">
          Nombre
        </label>
        <input
          id="m-label"
          className="field mb-4"
          value={label}
          maxLength={24}
          placeholder="Ej.: Energía, Sueño, Conexión"
          onChange={(e) => setLabel(e.target.value)}
        />
        <div className="label mb-2 px-1">Color</div>
        <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
          {METRIC_PALETTE.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={c === color}
              aria-label={c}
              onClick={() => setColor(c)}
              className={cx('size-9 rounded-full border-2', c === color ? 'border-ink' : 'border-transparent')}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="label mb-2 px-1">Etiquetas de la escala</div>
        <div className="card mb-4 divide-y divide-line">
          {labels.map((l, i) => (
            <div key={i} className="flex items-center gap-3 px-4">
              <span className="w-4 font-mono text-[13px] text-muted">{i + 1}</span>
              <input
                aria-label={`Etiqueta del valor ${i + 1}`}
                value={l}
                maxLength={20}
                onChange={(e) => {
                  const next = [...labels] as Metric['labels'];
                  next[i] = e.target.value;
                  setLabels(next);
                }}
                className="h-11 flex-1 bg-transparent outline-none"
              />
            </div>
          ))}
        </div>
        <label className="mb-5 flex items-center gap-3 px-1 text-[14px]">
          <input type="checkbox" checked={inverse} onChange={(e) => setInverse(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Un valor más bajo es mejor (como en ansiedad)
        </label>
        <Button block disabled={!label.trim()} onClick={() => void save()}>
          {isNew ? 'Agregar' : 'Guardar'}
        </Button>
        {!isNew && (
          <Button variant="ghost" block className="mt-1 text-danger" onClick={() => setConfirmDelete(true)}>
            Borrar métrica
          </Button>
        )}
      </Sheet>
      {!isNew && (
        <ConfirmSheet
          open={confirmDelete}
          title={`¿Borrar “${metric.label}”?`}
          body="También se borran los valores de esta métrica en todos tus registros. No se puede deshacer."
          confirmLabel="Borrar métrica"
          danger
          onConfirm={async () => {
            await deleteMetric(metric.id);
            toast('Métrica borrada');
          }}
          onClose={onClose}
        />
      )}
    </>
  );
}

function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title="Eliminar cuenta y datos">
      <p className="mb-4 text-[14px] leading-relaxed text-muted">
        Se borran tu cuenta, todos tus registros en el servidor y los de este equipo. No se puede deshacer. Para confirmar, escribí tu
        contraseña.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await deleteAccount(password);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo eliminar la cuenta.');
            setBusy(false);
          }
        }}
      >
        <input
          type="password"
          className="field"
          required
          autoComplete="current-password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="mt-2 px-1 text-[13px] text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="danger" block loading={busy} className="mt-4">
          Eliminar definitivamente
        </Button>
      </form>
    </Sheet>
  );
}
