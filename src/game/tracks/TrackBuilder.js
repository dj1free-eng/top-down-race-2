// src/game/tracks/TrackBuilder.js
// TrackBuilder: centerline -> ribbon (polígono) con suavizado + muestreo y culling por celdas

function ptX(p) {
  if (Array.isArray(p)) return Number(p[0]) || 0;
  return Number(p?.x) || 0;
}

function ptY(p) {
  if (Array.isArray(p)) return Number(p[1]) || 0;
  return Number(p?.y) || 0;
}

function ptWidth(p, fallbackWidth = 80) {
  if (Array.isArray(p)) return fallbackWidth;
  const w = Number(p?.width);
  return Number.isFinite(w) ? w : fallbackWidth;
}

function makePt(x, y, width) {
  return { x, y, width };
}

function dist(a, b) {
  const dx = ptX(a) - ptX(b);
  const dy = ptY(a) - ptY(b);
  return Math.sqrt(dx * dx + dy * dy);
}

function normalize(x, y) {
  const d = Math.sqrt(x * x + y * y);
  if (d < 1e-6) return [0, 0];
  return [x / d, y / d];
}

// Catmull-Rom CENTRÍPETA (reduce overshoot / auto-cruces) para t en [0,1]
// Devuelve {x,y,width}
function catmullRom(p0, p1, p2, p3, t, fallbackWidth = 80) {
  const alpha = 0.5;
  const eps = 1e-6;

  const x0 = ptX(p0), y0 = ptY(p0);
  const x1 = ptX(p1), y1 = ptY(p1);
  const x2 = ptX(p2), y2 = ptY(p2);
  const x3 = ptX(p3), y3 = ptY(p3);

  const d01 = Math.hypot(x1 - x0, y1 - y0);
  const d12 = Math.hypot(x2 - x1, y2 - y1);
  const d23 = Math.hypot(x3 - x2, y3 - y2);

  const t0 = 0;
  const t1 = t0 + Math.pow(Math.max(d01, eps), alpha);
  const t2 = t1 + Math.pow(Math.max(d12, eps), alpha);
  const t3 = t2 + Math.pow(Math.max(d23, eps), alpha);

  const tt = t1 + (t2 - t1) * t;

  const lerp = (ax, ay, bx, by, ta, tb) => {
    const denom = (tb - ta) || eps;
    const w = (tt - ta) / denom;
    return [ax + (bx - ax) * w, ay + (by - ay) * w];
  };

  const A1 = lerp(x0, y0, x1, y1, t0, t1);
  const A2 = lerp(x1, y1, x2, y2, t1, t2);
  const A3 = lerp(x2, y2, x3, y3, t2, t3);

  const B1 = (() => {
    const denom = (t2 - t0) || eps;
    const w = (tt - t0) / denom;
    return [
      A1[0] + (A2[0] - A1[0]) * w,
      A1[1] + (A2[1] - A1[1]) * w
    ];
  })();

  const B2 = (() => {
    const denom = (t3 - t1) || eps;
    const w = (tt - t1) / denom;
    return [
      A2[0] + (A3[0] - A2[0]) * w,
      A2[1] + (A3[1] - A2[1]) * w
    ];
  })();

  const C = (() => {
    const denom = (t2 - t1) || eps;
    const w = (tt - t1) / denom;
    return [
      B1[0] + (B2[0] - B1[0]) * w,
      B1[1] + (B2[1] - B1[1]) * w
    ];
  })();

  const w1 = ptWidth(p1, fallbackWidth);
  const w2 = ptWidth(p2, fallbackWidth);
  const width = w1 + (w2 - w1) * t;

  return makePt(C[0], C[1], width);
}

// Remuestreo a paso fijo (10–20 px típico)
// Conserva width interpolado
function resample(points, stepPx, fallbackWidth = 80) {
  const out = [];
  if (points.length < 2) return out;

  out.push(makePt(ptX(points[0]), ptY(points[0]), ptWidth(points[0], fallbackWidth)));

  let acc = 0;
  let prev = makePt(ptX(points[0]), ptY(points[0]), ptWidth(points[0], fallbackWidth));

  for (let i = 1; i < points.length; i++) {
    const cur = makePt(ptX(points[i]), ptY(points[i]), ptWidth(points[i], fallbackWidth));
    let segLen = dist(prev, cur);
    if (segLen < 1e-6) continue;

    while (acc + segLen >= stepPx) {
      const t = (stepPx - acc) / segLen;

      const x = prev.x + (cur.x - prev.x) * t;
      const y = prev.y + (cur.y - prev.y) * t;
      const width = prev.width + (cur.width - prev.width) * t;

      const inserted = makePt(x, y, width);
      out.push(inserted);

      prev = inserted;
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
  grassMargin = 0,     // <-- NUEVO: extra a cada lado (px). Banda GRASS = trackWidth + 2*grassMargin
  sampleStepPx = 12,
  cellSize = 400
}) {
  // Normaliza input: acepta [[x,y]] o [{x,y,width}]
  const fallbackWidth = Number(trackWidth) || 80;

  const src = (centerline || []).map((p) => {
    if (Array.isArray(p) && p.length >= 2) {
      return makePt(Number(p[0]), Number(p[1]), fallbackWidth);
    }
    if (p && typeof p.x === 'number' && typeof p.y === 'number') {
      return makePt(
        Number(p.x),
        Number(p.y),
        Number.isFinite(Number(p.width)) ? Number(p.width) : fallbackWidth
      );
    }
    return makePt(NaN, NaN, fallbackWidth);
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
      dense.push(catmullRom(p0, p1, p2, p3, t, fallbackWidth));
    }
  }
  if (closed) dense.push(makePt(dense[0].x, dense[0].y, dense[0].width));

  // 2) Remuestreo a paso fijo (10–20px)
  const cl = resample(dense, sampleStepPx, fallbackWidth);
  if (cl.length < 8) {
    return { center: cl, left: [], right: [], cells: new Map(), cellSize };
  }
// 2.5) Sin corner relaxation extra
// Dejamos la centerline tal como sale de Catmull-Rom + resample,
// porque el postproceso estaba introduciendo puntas y cruces raros.

// 3) Bordes por normal (con miter-limit para curvas cerradas)
const baseGrassMargin = Math.max(0, grassMargin);

const left = [];
const right = [];

// Banda GRASS (más ancha) siguiendo la misma forma
const grassLeft = [];
const grassRight = [];

const eps = 1e-6;
const MITER_LIMIT = 2.0; // 2.0–2.5 típico. Más alto = más puntas, más bajo = más “bevel”.

for (let i = 0; i < cl.length; i++) {
  const pPrev = cl[(i - 1 + cl.length) % cl.length];
  const p = cl[i];
  const pNext = cl[(i + 1) % cl.length];

  const px = p.x;
  const py = p.y;

  // Segmentos
  const v0x = p.x - pPrev.x;
  const v0y = p.y - pPrev.y;
  const v1x = pNext.x - p.x;
  const v1y = pNext.y - p.y;

  const half = (Number.isFinite(Number(p.width)) ? Number(p.width) : fallbackWidth) * 0.5;
  const halfGrass = half + baseGrassMargin;

  // Normales de cada segmento (izquierda)
  let [n0x, n0y] = normalize(-v0y, v0x);
  let [n1x, n1y] = normalize(-v1y, v1x);

  // Si una normal viene invertida respecto a la otra, alinearla
  if ((n0x * n1x + n0y * n1y) < 0) {
    n1x = -n1x;
    n1y = -n1y;
  }

  // Miter = normalizada (n0 + n1)
  let mx = n0x + n1x;
  let my = n0y + n1y;

  // Si se anulan casi por completo, usar una normal segura
  if (Math.hypot(mx, my) < eps) {
    mx = n1x;
    my = n1y;
  }

  const [miterX, miterY] = normalize(mx, my);

  // Escala del miter: half / dot(miter, n0)
  const denom = (miterX * n0x + miterY * n0y);
  const safeDenom = Math.max(Math.abs(denom), eps);
  const miterLen = half / safeDenom;

  // Fallback bevel si el ángulo es muy agudo o el miter se dispara
  const tooSharp =
    (safeDenom < 0.35) ||
    (miterLen > MITER_LIMIT * half);

    // Dirección del offset + escala real
  let dirX, dirY;
  let scaleT, scaleG;

  if (tooSharp) {
    // Bevel estable: usar una normal segura con ancho normal
    dirX = n1x;
    dirY = n1y;
    scaleT = half;
    scaleG = halfGrass;
  } else {
    // Miter real: hay que usar miterLen, no half
    dirX = miterX;
    dirY = miterY;
    scaleT = miterLen;
    scaleG = miterLen * (halfGrass / half);
  }

  // TRACK offsets
  const oxT = dirX * scaleT;
  const oyT = dirY * scaleT;

    left.push([px + oxT, py + oyT]);
  right.push([px - oxT, py - oyT]);

  // GRASS offsets
  const oxG = dirX * scaleG;
  const oyG = dirY * scaleG;

  grassLeft.push([px + oxG, py + oyG]);
  grassRight.push([px - oxG, py - oyG]);
}
  // 4) Ribbon en segmentos (quad -> 2 tri) y asignación a celdas
  // Guardamos polys como arrays de {x,y}
    const cells = new Map();
  const grassCells = new Map(); // <-- NUEVO

  const addPolyToCells = (cellsMap, poly) => {
    const b = boundsOfPoly(poly);
    const cx0 = Math.floor(b.minX / cellSize);
    const cy0 = Math.floor(b.minY / cellSize);
    const cx1 = Math.floor(b.maxX / cellSize);
    const cy1 = Math.floor(b.maxY / cellSize);

    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const key = cellKey(cx, cy);
                if (!cellsMap.has(key)) cellsMap.set(key, { polys: [] });
        cellsMap.get(key).polys.push(poly);
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

    // TRACK quad -> celdas TRACK
  addPolyToCells(cells, [
    { x: l0[0], y: l0[1] },
    { x: r0[0], y: r0[1] },
    { x: r1[0], y: r1[1] },
    { x: l1[0], y: l1[1] }
  ]);

  // GRASS quad -> celdas GRASS (misma topología, mayor ancho)
  const gl0 = grassLeft[i], gr0 = grassRight[i];
  const gl1 = grassLeft[j], gr1 = grassRight[j];

  addPolyToCells(grassCells, [
    { x: gl0[0], y: gl0[1] },
    { x: gr0[0], y: gr0[1] },
    { x: gr1[0], y: gr1[1] },
    { x: gl1[0], y: gl1[1] }
  ]);
}

    return {
    center: cl,
    left,
    right,
    cells,
    cellSize,

    // Banda GRASS adicional (misma forma, más ancha)
    grass: {
      margin: Math.max(0, grassMargin),
      left: grassLeft,
      right: grassRight,
      cells: grassCells
    }
  };
}
