import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button, RhythmDots, Sheet, cx } from '../ui/kit';
import { PROTOCOL_NAMES, PROTOCOL_PRESETS, protocolRhythm, type Protocol, type ProtocolId } from '../lib/protocol';

const ORDER: ProtocolId[] = ['fadiman', 'stamets', 'nocturno', 'custom'];

export function ProtocolPicker({ value, onChange }: { value: Protocol; onChange: (p: Protocol) => void }) {
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <>
      <div role="radiogroup" aria-label="Protocolo" className="grid grid-cols-2 gap-3">
        {ORDER.map((id) => {
          const preset = id === 'custom' ? null : PROTOCOL_PRESETS[id];
          const selected = value.id === id;
          const shown = preset ?? (selected ? value : null);
          return (
            <button
              key={id}
              role="radio"
              aria-checked={selected}
              onClick={() => (preset ? onChange(preset) : setCustomOpen(true))}
              className={cx(
                'flex min-h-[92px] flex-col items-start gap-2 rounded-[16px] border p-4 text-left transition-colors',
                selected ? 'border-accent bg-accent-tint ring-1 ring-accent' : 'border-line bg-surface',
              )}
            >
              <span className="text-[15px] font-semibold">{PROTOCOL_NAMES[id]}</span>
              {shown ? <RhythmDots on={shown.onDays} off={shown.offDays} /> : <RhythmDots on={1} off={0} />}
              <span className="text-[12px] text-muted">{shown ? protocolRhythm(shown) : 'Definí tu ritmo'}</span>
            </button>
          );
        })}
      </div>
      <CustomProtocolSheet
        key={String(customOpen)}
        open={customOpen}
        initial={value.id === 'custom' ? value : { id: 'custom', onDays: 1, offDays: 2 }}
        onClose={() => setCustomOpen(false)}
        onSave={(p) => {
          onChange(p);
          setCustomOpen(false);
        }}
      />
    </>
  );
}

function CustomProtocolSheet({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: Protocol;
  onClose: () => void;
  onSave: (p: Protocol) => void;
}) {
  const [on, setOn] = useState(initial.onDays);
  const [off, setOff] = useState(initial.offDays);
  return (
    <Sheet open={open} onClose={onClose} title="Ritmo personalizado">
      <div className="card mb-5 divide-y divide-line">
        <Stepper label="Días activos" value={on} min={1} max={14} onChange={setOn} />
        <Stepper label="Días de descanso" value={off} min={0} max={28} onChange={setOff} />
      </div>
      <div className="mb-5 flex items-center justify-between px-1">
        <RhythmDots on={on} off={off} />
        <span className="font-mono text-[13px] text-muted">ciclo de {on + off} días</span>
      </div>
      <Button block onClick={() => onSave({ id: 'custom', onDays: on, offDays: off })}>
        Usar este ritmo
      </Button>
    </Sheet>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[15px]">{label}</span>
      <div className="flex items-center gap-3">
        <button
          aria-label={`Menos ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="grid size-9 place-items-center rounded-full border border-line disabled:opacity-40"
        >
          <Minus size={16} />
        </button>
        <span className="w-6 text-center font-mono text-[16px]" aria-live="polite">
          {value}
        </span>
        <button
          aria-label={`Más ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="grid size-9 place-items-center rounded-full border border-line disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
