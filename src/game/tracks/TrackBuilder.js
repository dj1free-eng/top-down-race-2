// src/game/tracks/TrackBuilder.js
// TrackBuilder: centerline -> ribbon (polígono) con suavizado + muestreo y culling por celdas

function dist(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function normalize(x, y) {
  const d = Math.sqrt(x * x + y * y);
  if (d < 1e-6) return [0, 0];
  return [x / d, y / d];
}

// Catmull-Rom (centripetal-ish simple) para un t in [0,1]
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;

  const x =
    0.5 *
    ((2 * p1[0]) +
      (-p0[0] + p2[0]) * t +
      (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
      (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);

  const y =
    0.5 *
    ((2 * p1[1]) +
      (-p0[1] + p2[1]) * t +
      (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
      (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);

  return [x, y];
}

// Remuestreo a paso fijo (10–20 px típico)
function resample(points, stepPx) {
  const out = [];
  if (points.length < 2) return out;

  out.push(points[0]);
  let acc = 0;
  let prev = points[0];

  for (let i = 1; i < points.length; i++) {
    const cur = points[i];
    let segLen = dist(prev, cur);
    if (segLen < 1e-6) continue;

    // avanzamos sobre el segmento poniendo puntos cada stepPx
    while (acc + segLen >= stepPx) {
      const t = (stepPx - acc) / segLen;
      const x = prev[0] + (cur[0] - prev[0]) * t;
      const y = prev[1] + (cur[1] - prev[1]) * t;
      out.push([x, y]);

      // el nuevo "prev" es el punto insertado
      prev = [x, y];
      segLen = dist(prev, cur);
      acc = 0;
    }
    acc += segLen;
    prev = cur;
  }

  return out;
}

function boundsOfPoly(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function cellKey(cx, cy) {
  return `${cx},${cy}`;
}

export function buildTrackRibbon({
  centerline,
  trackWidth,
  sampleStepPx = 12,
  cellSize = 400
}) {
  // Normaliza input: acepta [{x,y}] o [[x,y]]
  const src = (centerline || []).map((p) => {
    if (Array.isArray(p)) return p;
    if (p && typeof p.x === 'number' && typeof p.y === 'number') return [p.x, p.y];
    return [NaN, NaN];
  });

  // 1) Suavizado Catmull-Rom -> nube densa
  const dense = [];
  const n = src.length;
  const closed = true;

  if (n < 2) {
    return { center: [], left: [], right: [], cells: new Map(), cellSize };
  }

  const get = (idx) => {
    const i = (idx + n) % n;
    return src[i];
  };

  // Generamos puntos densos entre cada par p1->p2
  const SUB = 10; // densidad inicial (luego remuestreamos)
  for (let i = 0; i < n; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);

    for (let s = 0; s < SUB; s++) {
      const t = s / SUB;
      dense.push(catmullRom(p0, p1, p2, p3, t));
    }
  }
  if (closed) dense.push(dense[0]);

  // 2) Remuestreo a paso fijo (10–20px)
  const cl = resample(dense, sampleStepPx);
  if (cl.length < 8) {
    return { center: cl, left: [], right: [], cells: new Map(), cellSize };
  }

  // 3) Bordes por normal
  const half = trackWidth * 0.5;
  const left = [];
  const right = [];

  for (let i = 0; i < cl.length; i++) {
    const pPrev = cl[(i - 1 + cl.length) % cl.length];
    const p = cl[i];
    const pNext = cl[(i + 1) % cl.length];

    const tx = pNext[0] - pPrev[0];
    const ty = pNext[1] - pPrev[1];
    const [nx, ny] = normalize(-ty, tx); // normal izquierda

    left.push([p[0] + nx * half, p[1] + ny * half]);
    right.push([p[0] - nx * half, p[1] - ny * half]);
  }

  // 4) Ribbon en segmentos (quad -> 2 tri) y asignación a celdas
  // Guardamos polys como arrays de {x,y}
  const cells = new Map();

  const addPolyToCells = (poly) => {
    const b = boundsOfPoly(poly);
    const cx0 = Math.floor(b.minX / cellSize);
    const cy0 = Math.floor(b.minY / cellSize);
    const cx1 = Math.floor(b.maxX / cellSize);
    const cy1 = Math.floor(b.maxY / cellSize);

    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const key = cellKey(cx, cy);
        if (!cells.has(key)) cells.set(key, { polys: [] });
        cells.get(key).polys.push(poly);
      }
    }
  };

// Creamos quads (li, ri, r(next), l(next)) como polígono de 4 puntos
// IMPORTANTE: cerramos el último segmento (último -> primero)
const count = left.length;
for (let i = 0; i < count; i++) {
  const j = (i + 1) % count;

  const l0 = left[i], r0 = right[i];
  const l1 = left[j], r1 = right[j];

  addPolyToCells([
    { x: l0[0], y: l0[1] },
    { x: r0[0], y: r0[1] },
    { x: r1[0], y: r1[1] },
    { x: l1[0], y: l1[1] }
  ]);
}

  return { center: cl, left, right, cells, cellSize };
}
