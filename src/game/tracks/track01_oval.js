// src/game/tracks/track01_oval.js
// Track 01 — Óvalo de velocidad (centerline paramétrica)
// Mundo recomendado: 8000x5000

export function makeTrack01Oval() {
  const worldW = 8000;
  const worldH = 5000;

  const cx = worldW * 0.5;
  const cy = worldH * 0.5;

  // Elipse base (óvalo real)
  const rx = 2500;
  const ry = 1500;

  // Muestras del centerline "bruto" (luego se suaviza y remuestrea)
  const N = 64;

  const centerline = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const x = cx + Math.cos(t) * rx;
    const y = cy + Math.sin(t) * ry;
    centerline.push([x, y]);
  }

  // Ancho pista (obligatorio: 260–320)
  const trackWidth = 300;

  // Punto de salida aproximado (arriba del óvalo)
  const start = {
    x: cx,
    y: cy - ry,
    r: Math.PI / 2 // mirando hacia abajo (ajústalo si tu sprite mira a otra dirección)
  };

  return { id: 'track01', name: 'Track 01 — Oval', worldW, worldH, centerline, trackWidth, start };
}
