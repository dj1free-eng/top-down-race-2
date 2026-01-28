// src/tracks/track02_technical.js
// Track 02: técnico (chicane + horquilla + curvas abiertas/cerradas)
// Formato compatible con makeTrack01Oval()

function norm(vx, vy) {
  const m = Math.hypot(vx, vy) || 1;
  return { x: vx / m, y: vy / m };
}

export function makeTrack02Technical() {
  const worldW = 8000;
  const worldH = 5000;


  // Track02 — centerline normalizada (0..1)
// Técnico viable: enlazadas, chicane suave, horquilla amplia, sin cruces.
const centerlineNorm = [
// zona superior (recta + esquina suave)
  [0.66, 0.10],
  [0.72, 0.10],
  [0.78, 0.12],
  [0.82, 0.16],
  [0.82, 0.22],
  [0.80, 0.28],
  [0.77, 0.33],

  // bajada hacia el cuello derecho
  [0.73, 0.37],
  [0.68, 0.40],
  [0.62, 0.41],
  [0.57, 0.41],

  // S central (mantiene forma, sin quiebros)
  [0.53, 0.44],
  [0.52, 0.49],
  [0.54, 0.55],
  [0.58, 0.60],
  [0.62, 0.64],
  [0.65, 0.69],

  // panza inferior derecha y giro a la izquierda
  [0.65, 0.76],
  [0.62, 0.82],
  [0.56, 0.86],
  [0.48, 0.88],
  [0.40, 0.88],

  // gran zona inferior izquierda (ancha, redondeada)
  [0.33, 0.86],
  [0.28, 0.83],
  [0.25, 0.79],
  [0.24, 0.74],
  [0.25, 0.68],
  [0.28, 0.62],

  // subida por el lateral izquierdo (con el “escalón” suavizado)
  [0.30, 0.56],
  [0.30, 0.50],
  [0.32, 0.44],
  [0.36, 0.38],
  [0.42, 0.30],
  [0.50, 0.20],

  // cierre hacia arriba (vuelve al punto inicial)
  [0.58, 0.14]
];


  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  const centerline = centerlineNorm.map(([nx, ny]) => ({
    x: Math.round(clamp01(nx) * worldW),
    y: Math.round(clamp01(ny) * worldH),
  }));

  // Cierre explícito del loop (si el último no coincide con el primero)
  if (centerline.length >= 2) {
    const a = centerline[0];
    const b = centerline[centerline.length - 1];
    if (a.x !== b.x || a.y !== b.y) centerline.push({ x: a.x, y: a.y });
  }

  // Ancho fijo (tu TrackBuilder actual recibe un número en tu RaceScene)
  // Si luego quieres ancho variable por sectores, lo hacemos, pero primero estabilidad.
  const trackWidth = 120;
  const sampleStepPx = 10;

  // Start: en la recta principal (orientación hacia el siguiente punto)
  const start = { x: centerline[0].x, y: centerline[0].y, r: 0 };

  // Calcula rotación inicial según el primer segmento
  {
    const p0 = centerline[0];
    const p1 = centerline[1];
    start.r = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  }

  // Finish line: cruzando la recta principal cerca del inicio.
  // La ponemos perpendicular al primer segmento y con normal apuntando “hacia delante”.
  const finishLine = (() => {
  // Mejor usar un segmento más interior de la recta principal
  const p0 = centerline[1];
  const p1 = centerline[2];

  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;

  const fwd = norm(dx, dy);
  const perp = norm(-dy, dx);

  const half = trackWidth * 0.75; // un pelín más que el ancho
  const mid = { x: p0.x + dx * 0.55, y: p0.y + dy * 0.55 }; // más centrada en la recta

  const a = { x: mid.x - perp.x * half, y: mid.y - perp.y * half };
  const b = { x: mid.x + perp.x * half, y: mid.y + perp.y * half };

  return { a, b, normal: fwd };
})();

    return {
  id: 'track02',
  name: 'Track 02 — Technical',
  worldW,
  worldH,
  centerline,
  trackWidth,
  sampleStepPx,
  start,
  finishLine,
  closed: true,
  shoulderPx: 6 // ← arcén MUY pequeño para pista técnica
};
}
