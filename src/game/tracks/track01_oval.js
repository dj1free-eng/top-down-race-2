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

  // Punto de salida (arriba del óvalo)
  // Nota: en tu proyecto rotation=0 mira a la derecha, y +Y es hacia abajo.
  const start = {
    x: cx,
    y: cy - ry,
    r: Math.PI / 2 // mirando hacia abajo
  };

  // ===== Línea de meta =====
  // La definimos como un segmento que cruza la pista, PERPENDICULAR a la dirección del coche.
  // Dirección del coche:
  const dirX = Math.cos(start.r);
  const dirY = Math.sin(start.r);

  // Perpendicular (a la izquierda del avance):
  const perpX = -dirY;
  const perpY = dirX;

  // Mitad de longitud del segmento (un pelín más ancho que la pista)
  const halfLen = (trackWidth * 0.65);

  const finishLine = {
    a: { x: start.x + perpX * halfLen, y: start.y + perpY * halfLen },
    b: { x: start.x - perpX * halfLen, y: start.y - perpY * halfLen },

    // Esto te servirá luego para saber "de qué lado venías" al cruzar
    normal: { x: dirX, y: dirY }
  };

  return {
    id: 'track01',
    name: 'Track 01 — Oval',
    worldW,
    worldH,
    centerline,
    trackWidth,
    start,
    finishLine
  };
}
