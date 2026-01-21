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

  // Muestras del centerline "bruto"
  const samples = 240; // más = más suave
  const centerline = [];

  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    const x = cx + Math.cos(t) * rx;
    const y = cy + Math.sin(t) * ry;
    centerline.push([x, y]);
  }

  // Ancho pista
  const trackWidth = 300;

  // =========================================================
  // START + META (meta un poco más adelante que el start)
  // En este proyecto: rotation=0 mira a la derecha, +Y hacia abajo.
  // En el punto más alto del óvalo, la dirección de carrera es hacia la DERECHA.
  // =========================================================

  // Punto más alto del óvalo
  const topX = cx;
  const topY = cy - ry;

  // Dirección de carrera ahí: hacia la derecha
  const heading = 0; // rad

  // Separación a lo largo de la pista (pixeles). Ajusta a gusto.
  const startBackPx = 90;   // el coche sale 90px ANTES de la meta
  const finishFwdPx = 0;    // meta en el punto alto (puedes poner 20 si la quieres aún más adelante)

  // Vector dirección (tangente)
  const dirX = Math.cos(heading);
  const dirY = Math.sin(heading);

  // Start un poco antes (hacia la izquierda, porque "antes" es -dir)
  const start = {
    x: topX - dirX * startBackPx,
    y: topY - dirY * startBackPx,
    r: heading
  };

  // Meta un poco después del punto alto (opcional)
  const finishX = topX + dirX * finishFwdPx;
  const finishY = topY + dirY * finishFwdPx;

  // ===== Línea de meta =====
  // Segmento que cruza la pista, perpendicular a la dirección de carrera.
  // Normal (perpendicular a dir)
  const nX = -dirY;
  const nY = dirX;

  const half = trackWidth * 0.55; // un pelín más ancho que la pista
  const finish = {
    x: finishX,
    y: finishY,
    a: { x: finishX - nX * half, y: finishY - nY * half },
    b: { x: finishX + nX * half, y: finishY + nY * half },
    heading
  };

  return {
    id: 'track01',
    name: 'Track 01 — Oval',
    worldW,
    worldH,
    centerline,
    trackWidth,
    start,
    finish
  };
}
