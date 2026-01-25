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

  // Centro de pista (loop cerrado, sentido horario).
  // Diseñado para estresar máscara/celdas: chicane arriba derecha, horquilla abajo derecha,
  // sección de "S" y cambios de radio.
  const centerline = [
    // --- Recta principal (zona media-izquierda -> media-derecha)
    { x: 1100, y: 2500 },
    { x: 1700, y: 2450 },
    { x: 2400, y: 2400 },
    { x: 3200, y: 2380 },
    { x: 4000, y: 2400 },

    // --- Entrada a zona técnica (sube y se estrecha el radio)
    { x: 4700, y: 2320 },
    { x: 5200, y: 2120 },
    { x: 5550, y: 1850 },

    // --- CHICANE (zig-zag arriba derecha)
    { x: 5800, y: 1600 },
    { x: 6100, y: 1820 },
    { x: 6400, y: 1550 },
    { x: 6750, y: 1750 },

    // --- Curva hacia derecha y bajada (pre-horquilla)
    { x: 7050, y: 2100 },
    { x: 7250, y: 2550 },
    { x: 7200, y: 3050 },

    // --- HORQUILLA (abajo derecha, muy cerrada)
    { x: 6850, y: 3550 },
    { x: 6300, y: 3920 },
    { x: 5650, y: 4000 },
    { x: 5200, y: 3880 },

    // --- Salida horquilla: recta de vuelta por abajo (derecha -> izquierda)
    { x: 4600, y: 3820 },
    { x: 3900, y: 3850 },
    { x: 3200, y: 3980 },
    { x: 2500, y: 4150 },
    { x: 1900, y: 4200 },

    // --- Sección de S (abajo izquierda, para probar máscara en curvas encadenadas)
    { x: 1500, y: 4050 },
    { x: 1400, y: 3700 },
    { x: 1650, y: 3450 },
    { x: 2000, y: 3300 },
    { x: 2300, y: 3100 },
    { x: 2050, y: 2900 },
    { x: 1700, y: 2800 },

// --- Subida hacia zona media (curva abierta que se cierra)
{ x: 1350, y: 2700 },
{ x: 1200, y: 2600 },

// Pre-cierre: alinear tangente hacia el inicio (suaviza la unión)
{ x: 1120, y: 2520 },
{ x: 1110, y: 2510 },

// Cierre explícito del loop
{ x: 1100, y: 2500 },

  ];

  // Ancho fijo (tu TrackBuilder actual recibe un número en tu RaceScene)
  // Si luego quieres ancho variable por sectores, lo hacemos, pero primero estabilidad.
  const trackWidth = 360;

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
    start,
    finishLine,
    closed: true
  };
}
