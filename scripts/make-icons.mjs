// Genera todos los íconos a partir de assets/soma-logo.svg (fuente única del logo).
// Uso: node scripts/make-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const BG = '#F5F5F3'; // Fondo
const INK = '#3B3FE0'; // Índigo · activo

const master = readFileSync('assets/soma-logo.svg', 'utf8');
const d = master.match(/ d="([^"]+)"/)[1];
const [, , W, H] = master.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);

/** Ícono cuadrado: fondo y logo centrado ocupando `scale` del alto. */
function iconSvg(size, scale, radius = 0) {
  const h = size * scale;
  const k = h / H;
  const x = (size - W * k) / 2;
  const y = (size - h) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
  <path transform="translate(${+x.toFixed(2)} ${+y.toFixed(2)}) scale(${+k.toFixed(5)})" fill="${INK}" fill-rule="evenodd" d="${d}"/>
</svg>
`;
}

function png(svg, size) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

// Favicon: esquinas redondeadas y logo grande (se ve chico en la pestaña).
writeFileSync('public/icon.svg', iconSvg(64, 0.8, 14));
// Íconos de la PWA: "any" con margen moderado; "maskable" deja el logo dentro de la zona segura (círculo del 80 %).
writeFileSync('public/icon-192.png', png(iconSvg(512, 0.7), 192));
writeFileSync('public/icon-512.png', png(iconSvg(512, 0.7), 512));
writeFileSync('public/icon-maskable-512.png', png(iconSvg(512, 0.56), 512));
writeFileSync('public/apple-touch-icon.png', png(iconSvg(512, 0.66), 180));

// Trazado para el componente <LogoMark /> (usa currentColor, así sigue el tema).
writeFileSync(
  'src/ui/logoPath.ts',
  `// Generado por scripts/make-icons.mjs a partir de assets/soma-logo.svg. No editar a mano.
export const LOGO_VIEWBOX = '0 0 ${W} ${H}';
export const LOGO_PATH =
  '${d}';
`,
);
console.log('íconos generados');
