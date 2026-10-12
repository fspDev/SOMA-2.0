# SOMA

Bitácora personal para quien sigue un protocolo de microdosis: calendario de días de dosis y de descanso, registro diario de cómo te sentís (escala 1–5), intención, revisiones semanales y la comparación que más importa: **días de dosis vs. días de descanso**.

SOMA no registra sustancias ni cantidades, no es un servicio médico y no recomienda el consumo de nada.

## Qué cambió respecto de la versión 1

Reescritura completa a partir del brief y la propuesta de UI “Índigo claro”.

- **Local primero.** Por defecto, todo queda en el equipo (IndexedDB). No hace falta cuenta.
- **Cuenta opcional con cifrado de extremo a extremo.** Para sincronizar entre dispositivos, los datos se cifran en el navegador (AES-GCM) antes de subir. El servidor no ve la contraseña ni los datos.
- **Fechas siempre locales.** Se terminó el bug de UTC (después de las 21 h en Argentina, “hoy” era mañana). Hay tests que lo cubren.
- **Borrado de cuenta seguro.** Primero se verifica la contraseña; si falla, no se borra nada. La cuenta y sus datos se eliminan juntos en el servidor.
- **Reglas de seguridad versionadas** en `supabase/migrations`.
- **Un registro por día** (no un documento gigante por usuario), con sincronización incremental.
- **Dosis vs. descanso** en Inicio y en Mi viaje, más mapa de calor de 26 semanas, búsqueda en notas y filtro por etiquetas.
- **Exportar** a JSON y CSV, e **importar** una copia.
- Sin Chart.js ni CDNs: los gráficos son HTML/CSS, las fuentes están empaquetadas y la app funciona offline.
- Textos en español rioplatense (vos) y fechas con `es-AR`.

## Stack

| Capa | Elección | Por qué |
| --- | --- | --- |
| UI | React 19 + TypeScript | Tipado estricto, sin router pesado (hash router propio de 50 líneas). |
| Estilos | Tailwind CSS 4 con tokens del sistema visual | Tema claro/oscuro con variables CSS. |
| Datos locales | Dexie (IndexedDB) | Consultas reactivas, funciona offline, sin límite de 5 MB de `localStorage`. |
| Sincronización | Supabase (Postgres + Auth), opcional | Se carga solo si se usa cuenta. RLS por usuario. |
| Cifrado | WebCrypto (PBKDF2 → HKDF → AES-GCM/HMAC) | Nativo del navegador, sin dependencias. |
| PWA | vite-plugin-pwa (Workbox) | Instalable y offline. |
| Tests | Vitest + fake-indexeddb | Fechas, protocolo, estadísticas, cifrado, repositorio y copias. |

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173/SOMA-2.0/
npm test           # tests
npm run build      # typecheck + build de producción en dist/
```

Los íconos se generan con `node scripts/make-icons.mjs`.

## Habilitar “Con cuenta” (opcional)

Sin configuración, la app funciona en modo local y la opción “Con cuenta” aparece como no disponible.

1. Crear un proyecto en [Supabase](https://supabase.com).
2. Ejecutar `supabase/migrations/0001_records.sql` en el SQL Editor.
3. En *Authentication → Providers → Email*, decidir si se exige confirmar el email (la app maneja ambos casos).
4. Copiar `.env.example` a `.env.local` y completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Para el deploy, cargar esas dos mismas claves como **Variables** del repositorio (*Settings → Secrets and variables → Actions → Variables*). La clave anónima es pública por diseño; la seguridad la dan las políticas RLS.

### Cómo funciona el cifrado

- De la contraseña y el email se deriva una clave maestra (PBKDF2-SHA256, 600 000 iteraciones).
- De ella salen tres valores: el secreto que se usa como contraseña de Supabase, la llave AES-GCM que cifra cada registro y una llave HMAC que oculta los identificadores (el servidor no ve ni las fechas).
- Consecuencia buscada: **si se olvida la contraseña, los datos de la cuenta no se pueden recuperar.** La app lo avisa al crear la cuenta. Por eso no hay “recuperar contraseña”.

## Deploy

Cada push a `main` corre los tests, compila y publica en GitHub Pages (`.github/workflows/deploy.yml`). Hay que activar una sola vez *Settings → Pages → Source: GitHub Actions*.

## Estructura

```
src/
  lib/        fechas locales, protocolo, métricas y estadísticas (lógica pura, con tests)
  db/         esquema Dexie, repositorio, copias JSON/CSV y hooks reactivos
  sync/       cifrado y sincronización con Supabase
  screens/    Bienvenida, Hoy, Registrar, Mi viaje, Ajustes, Privacidad
  ui/         componentes base y router
supabase/     migraciones SQL (tabla cifrada, RLS y borrado de cuenta)
```

## Pendiente / decisiones abiertas

- **Enlace de reducción de daños:** está en `src/config.ts` (hoy apunta a SEDRONAR). Revisarlo antes de publicar.
- **Recordatorios:** no hay notificaciones push. Requieren un servidor que las envíe (Web Push); se dejó fuera en lugar de dejar código a medias.
- **Distribución en tiendas:** las políticas de App Store y Play Store sobre sustancias controladas pueden bloquearla; como PWA no aplica.
- **Análisis con IA:** fuera de alcance. Si se retoma, tiene que ir por un backend y nunca con claves en el bundle.
