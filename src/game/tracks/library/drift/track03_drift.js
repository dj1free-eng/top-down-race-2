// src/game/tracks/track03_drift.js
// Track 03 — Drift Test (ancho, enlazadas, pensado para derrape continuo)
// Formato compatible con TrackBuilder + RaceScene

function norm(vx, vy) {
  const m = Math.hypot(vx, vy) || 1;
  return { x: vx / m, y: vy / m };
}

export function makeTrack03Drift() {
  const worldW = 8000;
  const worldH = 5000;

  // Centerline normalizada 0..1 (más puntos que track02, sin cruces)
  // Diseño: curva larga + enlazada + “panza” amplia para mantener drift.
  const centerlineNorm = [
    [0.30, 0.30],
    [0.36, 0.24],
    [0.44, 0.20],
    [0.52, 0.20],
    [0.60, 0.23],
    [0.66, 0.30],
    [0.68, 0.38],
    [0.66, 0.46],
    [0.60, 0.50],
    [0.52, 0.50],

    // S suave (transición)
    [0.46, 0.52],
    [0.43, 0.57],
    [0.45, 0.63],
    [0.50, 0.67],
    [0.57, 0.70],
    [0.65, 0.73],

    // Panza inferior ancha (mantener ángulo)
    [0.70, 0.78],
    [0.68, 0.84],
    [0.62, 0.88],
    [0.54, 0.90],
    [0.46, 0.90],
    [0.38, 0.88],
    [0.32, 0.84],
    [0.30, 0.78],

    // Subida izquierda con curva larga (otro drift sostenido)
    [0.28, 0.72],
    [0.27, 0.66],
    [0.27, 0.60],
    [0.29, 0.54],
    [0.31, 0.48],
    [0.32, 0.42],
    [0.32, 0.36],
    [0.31, 0.32]
  ];

  const centerline = centerlineNorm.map(([nx, ny]) => ({
    x: nx * worldW,
    y: ny * worldH
  }));

  // Track ancho para drift
  const trackWidth = 340;

  // Muestreo recomendado: más denso que oval, pero sin matar rendimiento
  const sampleStepPx = 18;

  // Start: usa el primer segmento
  const p0 = centerline[0];
  const p1 = centerline[1];
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const fwd = norm(dx, dy);

  const start = {
    x: p0.x - fwd.x * 40,
    y: p0.y - fwd.y * 40,
    r: Math.atan2(fwd.y, fwd.x)
  };

  // Finish line: perpendicular al primer segmento, cerca del inicio
  const finishLine = (() => {
    const perp = norm(-dy, dx);
    const half = trackWidth * 0.80;
    const mid = { x: p0.x + dx * 0.60, y: p0.y + dy * 0.60 };
    const a = { x: mid.x - perp.x * half, y: mid.y - perp.y * half };
    const b = { x: mid.x + perp.x * half, y: mid.y + perp.y * half };
    return { a, b, normal: fwd };
  })();

  return {
    id: 'track03',
    name: 'Track 03 — Drift Test',
    worldW,
    worldH,
    centerline,
    trackWidth,
    sampleStepPx,
    grassMargin: 260,
    cellSize: 400,
    start,
    finishLine,
    closed: true,
    shoulderPx: 10,

    // (Futuro) Zonas drift — aún no las consume RaceScene, pero las dejamos listas
    driftZones: [
      // Curva larga superior (polígono aproximado)
      {
        id: 'zoneA',
        type: 'poly',
        multiplier: 1.2,
        points: [
          [0.42,0.14],[0.72,0.18],[0.76,0.36],[0.58,0.56],[0.40,0.46]
        ].map(([nx,ny])=>({x:nx*worldW,y:ny*worldH}))
      },
      // S central
      {
        id: 'zoneB',
        type: 'poly',
        multiplier: 1.35,
        points: [
          [0.38,0.48],[0.74,0.66],[0.70,0.78],[0.44,0.72]
        ].map(([nx,ny])=>({x:nx*worldW,y:ny*worldH}))
      },
      // Panza inferior (zona ancha de mantener combo)
      {
        id: 'zoneC',
        type: 'poly',
        multiplier: 1.25,
        points: [
          [0.30,0.74],[0.72,0.74],[0.66,0.92],[0.34,0.92]
        ].map(([nx,ny])=>({x:nx*worldW,y:ny*worldH}))
      }
    ]
  };
}
