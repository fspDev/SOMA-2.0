import { ArrowLeft } from 'lucide-react';
import { goBack } from '../ui/router';
import { HARM_REDUCTION_LABEL, HARM_REDUCTION_URL } from '../config';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Qué guarda SOMA',
    body: [
      'Tu nombre o apodo, el protocolo y su fecha de inicio, tus métricas (escala 1–5), notas, etiquetas, la hora en que marcaste una dosis, tu intención y tus revisiones semanales.',
      'SOMA no registra sustancias, cantidades ni ubicación, y no usa analítica, publicidad ni rastreadores.',
    ],
  },
  {
    title: 'Modo “Solo en este equipo”',
    body: [
      'Todo queda en el almacenamiento de tu navegador (IndexedDB) y nunca sale de tu dispositivo. Nadie más, tampoco quien desarrolla SOMA, puede verlo.',
      'Si borrás los datos del navegador, desinstalás la app o perdés el equipo, los datos se pierden. Exportá una copia cada tanto desde Ajustes.',
    ],
  },
  {
    title: 'Modo “Con cuenta”',
    body: [
      'Para sincronizar entre dispositivos, tus datos se cifran en tu equipo (AES-GCM 256) con una llave derivada de tu contraseña antes de subirse. El servidor guarda solo texto cifrado y tu email.',
      'Tu contraseña no se envía al servidor: se envía un valor derivado que no permite reconstruir la llave. Por eso, si olvidás la contraseña, los datos no se pueden recuperar.',
      'El servidor sí puede ver datos técnicos: tu email, cuántos registros tenés y cuándo se modificaron.',
    ],
  },
  {
    title: 'Tus derechos',
    body: [
      'Podés exportar todos tus datos en JSON o CSV en cualquier momento.',
      'Podés borrar tus datos desde Ajustes. En el modo con cuenta, “Eliminar cuenta y datos” borra la cuenta y todos sus registros del servidor de forma definitiva.',
    ],
  },
  {
    title: 'Aviso',
    body: [
      'SOMA es una bitácora personal. No es un servicio médico, no ofrece diagnósticos ni recomienda el consumo de ninguna sustancia. Lo que ves en la app son observaciones sobre tus propios registros, no indicaciones. Ante cualquier duda sobre tu salud, consultá a un profesional.',
    ],
  },
];

export function Privacy() {
  return (
    <div className="flex flex-col gap-5 pb-6">
      <header className="flex items-center gap-3 pt-2">
        <button
          onClick={() => goBack('ajustes')}
          aria-label="Volver"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Política de privacidad</h1>
      </header>
      {SECTIONS.map((s) => (
        <section key={s.title} className="card px-5 py-4">
          <h2 className="mb-2 text-[16px] font-semibold">{s.title}</h2>
          {s.body.map((p) => (
            <p key={p.slice(0, 24)} className="mb-2 text-[14px] leading-relaxed text-muted last:mb-0">
              {p}
            </p>
          ))}
        </section>
      ))}
      <a href={HARM_REDUCTION_URL} target="_blank" rel="noreferrer" className="text-center text-[14px] text-accent-fg underline underline-offset-2">
        {HARM_REDUCTION_LABEL}
      </a>
    </div>
  );
}
