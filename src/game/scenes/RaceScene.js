import Phaser from 'phaser';
import { makeTrack01Oval } from '../tracks/track01_oval.js';
import { makeTrack02Technical } from '../tracks/track02_technical.js';
import { buildTrackRibbon } from '../tracks/TrackBuilder.js';
import { CAR_SPECS } from '../cars/carSpecs.js';
import { resolveCarParams } from '../cars/resolveCarParams.js';

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function wrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function fmtTime(ms) {
  if (ms == null) return '--:--.---';
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const ms3 = Math.floor(t % 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(ms3).padStart(3, '0')}`;
}
const DEV_TOOLS = true; // ponlo en false para ocultar botones de zoom/cull
// =================================================
// TRACK SURFACE HELPERS (point-in-polygon por celdas)
// =================================================
function _ptXY(pt, ox = 0, oy = 0) {
  if (!pt) return { x: NaN, y: NaN };
  if (typeof pt.x === 'number' && typeof pt.y === 'number') return { x: pt.x + ox, y: pt.y + oy };
  if (Array.isArray(pt) && pt.length >= 2) return { x: pt[0] + ox, y: pt[1] + oy };
  return { x: NaN, y: NaN };
}

// Even-odd rule (ray casting)
function _pointInPoly(px, py, poly, ox = 0, oy = 0) {
  let inside = false;
  const n = poly?.length ?? 0;
  if (n < 3) return false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = _ptXY(poly[i], ox, oy);
    const b = _ptXY(poly[j], ox, oy);

    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;

    const intersect =
      ((a.y > py) !== (b.y > py)) &&
      (px < (b.x - a.x) * (py - a.y) / ((b.y - a.y) || 1e-9) + a.x);

    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointOnTrackWorld(px, py, geom) {
  const cells = geom?.cells;
  const cellSize = geom?.cellSize;
  if (!cells || !cellSize) return true; // si no hay geom, no penalizamos

  const cx = Math.floor(px / cellSize);
  const cy = Math.floor(py / cellSize);

  // Miramos celda actual + vecinas (evita falsos “off” en bordes)
  for (let yy = cy - 1; yy <= cy + 1; yy++) {
    for (let xx = cx - 1; xx <= cx + 1; xx++) {
      const key = `${xx},${yy}`;
      const cd = cells.get(key);
      const polys = cd?.polys;
      if (!polys || polys.length === 0) continue;

      const oxCell = xx * cellSize;
      const oyCell = yy * cellSize;

      for (const poly of polys) {
        if (!poly || poly.length < 3) continue;

        // Detectar si poly viene en coords mundo o coords locales de celda (como ya haces en el mask)
        const p0 = poly[0];
        const p0xy = _ptXY(p0, 0, 0);
        if (!Number.isFinite(p0xy.x) || !Number.isFinite(p0xy.y)) continue;

        const looksWorld =
          (p0xy.x > cellSize * 1.5) || (p0xy.y > cellSize * 1.5) ||
          (p0xy.x < -cellSize * 0.5) || (p0xy.y < -cellSize * 0.5);

        const ox = looksWorld ? 0 : oxCell;
        const oy = looksWorld ? 0 : oyCell;

        if (_pointInPoly(px, py, poly, ox, oy)) return true;
      }
    }
  }
  return false;
}

export class RaceScene extends Phaser.Scene {
  constructor() {
    super('race');

    this.worldW = 8000;
    this.worldH = 5000;

    this.car = null;
    this.keys = null;
    this.zoom = 1.0;

    this.hud = null;

    // Upgrades/UI refs
    this.carId = 'stock';
    this.upgrades = { engine: 0, brakes: 0, tires: 0 };
    this.UPGRADE_CAPS = { engine: 3, brakes: 3, tires: 3 };

    this.upUI = null;
    this.upTxt = null;
    this._saveUpgrades = null;
    this.buyUpgrade = null;

    // Car rig
    this.carBody = null;
    this.carRig = null;
  }

    init(data) {
    // 1) Resolver coche seleccionado (prioridad: data -> localStorage -> stock)
    this.carId = data?.carId || localStorage.getItem('tdr2:carId') || 'stock';

    // 1.1) Resolver circuito seleccionado (prioridad: data -> localStorage -> track02)
    const incomingTrack = data?.trackKey;
    const savedTrack = localStorage.getItem('tdr2:trackKey');

    const valid = (k) => (k === 'track01' || k === 'track02');

    this.trackKey = valid(incomingTrack)
      ? incomingTrack
      : (valid(savedTrack) ? savedTrack : 'track02');

    localStorage.setItem('tdr2:trackKey', this.trackKey);

    // 2) Base spec
    const baseSpec = CAR_SPECS[this.carId] || CAR_SPECS.stock;


    // === UPGRADES: cargar niveles por coche ===
    const upgradesKey = `tdr2:upgrades:${this.carId}`;
    const defaultUpgrades = { engine: 0, brakes: 0, tires: 0 };

    try {
      this.upgrades = JSON.parse(localStorage.getItem(upgradesKey) || 'null') || defaultUpgrades;
    } catch {
      this.upgrades = defaultUpgrades;
    }

    // Convierte niveles -> “tornillos”
    const tuningFromUpgrades = (u) => {
      const engineLv = u.engine || 0;
      const brakesLv = u.brakes || 0;
      const tiresLv  = u.tires  || 0;

      return {
        // Motor
        accelMult: 1.0 + engineLv * 0.08, // +8% por nivel
        maxFwdAdd: engineLv * 35,         // +35 px/s por nivel

        // Frenos
        brakeMult: 1.0 + brakesLv * 0.10, // +10% por nivel

        // Otros neutros (por ahora)
        dragMult: 1.0,
        turnRateMult: 1.0,
        turnMinAdd: 0,
        maxRevAdd: 0,

        // Neumáticos (si tu resolveCarParams los usa, perfecto; si no, se ignoran sin romper)
        gripDriveAdd: tiresLv * 0.02,
        gripCoastAdd: tiresLv * 0.01,
        gripBrakeAdd: tiresLv * 0.015
      };
    };

    // Tuning derivado desde upgrades
    this.tuning = tuningFromUpgrades(this.upgrades);

    // Helper para aplicar params al “motor”
    this.applyCarParams = () => {
      this.carParams = resolveCarParams(baseSpec, this.tuning);

      this.accel = this.carParams.accel;
      this.maxFwd = this.carParams.maxFwd;
      this.maxRev = this.carParams.maxRev;

      this.brakeForce = this.carParams.brakeForce;
      this.engineBrake = this.carParams.engineBrake;
      this.linearDrag = this.carParams.linearDrag;

      this.turnRate = this.carParams.turnRate;
      this.turnMin = this.carParams.turnMin;

      this.gripCoast = this.carParams.gripCoast;
      this.gripDrive = this.carParams.gripDrive;
      this.gripBrake = this.carParams.gripBrake;
    };

    this.applyCarParams();

    // Guardar upgrades
    this._saveUpgrades = () => {
      try { localStorage.setItem(upgradesKey, JSON.stringify(this.upgrades)); } catch {}
    };

    // Comprar upgrades
    this.buyUpgrade = (kind) => {
      const cap = this.UPGRADE_CAPS[kind] ?? 0;
      const cur = this.upgrades[kind] ?? 0;
      if (cur >= cap) return false;

      this.upgrades[kind] = cur + 1;
      this._saveUpgrades();

      this.tuning = tuningFromUpgrades(this.upgrades);
      this.applyCarParams();

      return true;
    };
  }
  _hideMissingTextures() {
  const missKeys = new Set(['__MISSING', '__missing', 'missing', 'MISSING']);
  let count = 0;
  const offenders = [];

  for (const obj of this.children.list) {
    // Muchos objetos no tienen texture/frame
    const key1 = obj?.texture?.key;
    const key2 = obj?.frame?.texture?.key;

    const isMissing =
      (typeof key1 === 'string' && missKeys.has(key1)) ||
      (typeof key2 === 'string' && missKeys.has(key2));

    if (isMissing) {
      count++;
      // guardamos info útil
      offenders.push(
        `${obj.constructor?.name || 'Object'} key=${key1 || key2 || '??'}`
      );

      // lo ocultamos para que deje de “ensuciar” la pantalla
      if (obj.setVisible) obj.setVisible(false);
      if (obj.setActive) obj.setActive(false);
    }
  }

  // Te lo saco por pantalla (y también consola por si acaso)
  const msg = count
    ? `MISSING FOUND: ${count}\n${offenders.slice(0, 6).join('\n')}`
    : `MISSING FOUND: 0`;

  console.log(msg);
  if (this._dbgSet) this._dbgSet(msg);

  return { count, offenders };
}
  _dbg(msg) {
  if (!this._dbgText) {
    this._dbgText = this.add.text(12, 130, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffcc66',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(5000);
  }
  this._dbgText.setText(msg);
}
    _hudLog(msg) {
    // Logs en pantalla (mata-logs friendly)
    try { this._dbg(String(msg)); } catch {}
  }
  create() {
    // Alias compatible con código viejo
    this._dbgSet = (m) => this._dbg(m);
    // 1) Track meta primero (define world real)
const t01 = (this.trackKey === 'track01') ? makeTrack01Oval() : makeTrack02Technical();


    this.worldW = t01.worldW;
    this.worldH = t01.worldH;

    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
// Producción: asegurar que NO hay debug gráfico de físicas (si se creó en algún momento)
this.physics.world.drawDebug = false;

if (this.physics.world.debugGraphic) {
  this.physics.world.debugGraphic.clear();
  this.physics.world.debugGraphic.destroy();
  this.physics.world.debugGraphic = null;
}
// 2) Texturas procedurales (no deben romper la escena)
try { this.ensureBgTexture(); } catch (e) {}
try {
  this.ensureAsphaltTexture();
  this._dbg('asphalt OK');
} catch (e) {
  this._dbg('asphalt ERROR');
}
try { this.ensureCarTexture(); } catch (e) {}

// 3) Fondo del mundo: SOLO grass (sin bgGrid en producción)
const bgKey = this.textures.exists('grass') ? 'grass' : null;

if (bgKey) {
  this.bgWorld = this.add.tileSprite(0, 0, this.worldW, this.worldH, bgKey)
    .setOrigin(0, 0)
    .setScrollFactor(1)
    .setDepth(0); // césped debajo del asfalto (asfalto está en depth 10)
  this.bgKey = bgKey;
} else {
  this.bgWorld = null;
  this.add.rectangle(0, 0, this.worldW, this.worldH, 0x111111, 1)
    .setOrigin(0, 0)
    .setDepth(0);
}
// ===============================
// TIMING (laps + sectors)
// ===============================
this.timing = {
  lapStart: null,     // se fija en lights out
  started: false,

  s1: null,
  s2: null,
  s3: null,

  lastLap: null,
  bestLap: null
};
    // 4) Coche (body físico + rig visual)
    // Cuerpo físico SIN sprite (evita __MISSING)
const body = this.physics.add.sprite(t01.start.x, t01.start.y, '__BODY__');
body.setVisible(false);
body.setCircle(14);
body.setCollideWorldBounds(true);
body.setBounce(0);
body.setDrag(0, 0);
body.rotation = t01.start.r;

    const carSprite = this.add.sprite(0, 0, 'car');
    carSprite.x = 12;
    carSprite.y = 0;

    const rig = this.add.container(body.x, body.y, [carSprite]);
    rig.setDepth(30);

    this.carBody = body;
    this.carRig = rig;
    this.car = body; // compat con tu update()

// 5) Track ribbon (geom + culling state)
this.track = {
  meta: t01,
geom: buildTrackRibbon({
  centerline: t01.centerline,
  trackWidth: t01.trackWidth,
  grassMargin: t01.grassMargin ?? 220, // punto de ataque: ancho banda GRASS (px por lado)
  sampleStepPx: t01.sampleStepPx ?? 22,
  cellSize: t01.cellSize ?? 400
}),
  gfxByCell: new Map(),
  activeCells: new Set(),
  cullRadiusCells: 2
};
    // ================================
// Bordes de pista (GLOBAL, sin culling)
// ================================
const drawPolylineClosed = (pts, lineW, color, alpha) => {
  const g = this.add.graphics();
  g.setDepth(12);          // encima del asfalto (10)
  g.setScrollFactor(1);
  g.lineStyle(lineW, color, alpha);

  if (!pts || pts.length < 2) return g;

  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.strokePath();
  return g;
};

// Borde exterior e interior del ribbon
this._borderLeft = drawPolylineClosed(this.track.geom.left, 4, 0xf2f2f2, 0.8);
this._borderRight = drawPolylineClosed(this.track.geom.right, 4, 0xf2f2f2, 0.8);

// UI camera no debe renderizar bordes
this.uiCam?.ignore?.(this._borderLeft);
this.uiCam?.ignore?.(this._borderRight);
this._isOnTrack = (x, y) => isPointOnTrackWorld(x, y, this.track?.geom);

// Banda GRASS/OFF usando el MISMO sistema de celdas (point-in-polys)
this._isInBand = (band, x, y) => {
  if (!band || !band.cells) return false;

  const cs = this.track?.geom?.cellSize || 400;
  const cx = Math.floor(x / cs);
  const cy = Math.floor(y / cs);
  const key = `${cx},${cy}`;
  const cd = band.cells.get(key);
  if (!cd || !cd.polys) return false;

  // Ray casting
  const pointInPoly = (poly) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const denom = (yj - yi) || 1e-6;
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / denom + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  for (const poly of cd.polys) {
    if (pointInPoly(poly)) return true;
  }
  return false;
};
    this._cullEnabled = true;
this._hudLog(`[track geom] cells=${this.track.geom?.cells?.size ?? 'null'}`);
 this._trackCells = this.track.geom?.cells?.size ?? null;
this._trackDiag = `cells=${this._trackCells}`;
this._trackDiag2 = '';
    this.trackAsphaltColor = 0x2a2f3a;

// 6) Meta, checkpoints y vueltas (datos)
this.finishLine = t01.finishLine || t01.finish;
// Fallback: si el track no trae normal en la meta, la calculamos desde la centerline
if (this.finishLine?.a && this.finishLine?.b && !this.finishLine.normal) {
  const a = this.finishLine.a;
  const b = this.finishLine.b;

  // Punto medio de la meta
  const mid = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };

  // Fuente de centerline: preferimos la del TrackBuilder si existe
  const src = (
    this.track?.geom?.center ||
    this.track?.geom?.centerline ||
    this.track?.geom?.centerPts ||
    t01.centerline ||
    []
  );

  const pts = src.map((pt) => {
    if (!pt) return null;
    if (typeof pt.x === 'number' && typeof pt.y === 'number') return { x: pt.x, y: pt.y };
    if (Array.isArray(pt) && pt.length >= 2) return { x: pt[0], y: pt[1] };
    return null;
  }).filter(Boolean);

  const norm = (x, y) => {
    const d = Math.hypot(x, y) || 1;
    return { x: x / d, y: y / d };
  };

  if (pts.length >= 2) {
    // Encuentra el punto de centerline más cercano al mid
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i].x - mid.x;
      const dy = pts[i].y - mid.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; bestI = i; }
    }

    // Tangente local (suavizada)
    const p0 = pts[(bestI - 1 + pts.length) % pts.length];
    const p1 = pts[bestI];
    const p2 = pts[(bestI + 1) % pts.length];

    const tx = (p2.x - p0.x);
    const ty = (p2.y - p0.y);
    this.finishLine.normal = norm(tx, ty);
  } else {
    // Último fallback: normal perpendicular a la meta (no ideal, pero evita null)
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    this.finishLine.normal = norm(-aby, abx);
  }
}
    this.lapCount = 0;
this.prevCarX = this.car.x;
this.prevCarY = this.car.y;

// Cooldowns (evita dobles triggers por frame)
this._lapCooldownMs = 0;
this._cpCooldown1Ms = 0;
this._cpCooldown2Ms = 0;

// Estado de checkpoints por vuelta:
// 0 = nada, 1 = CP1 ok, 2 = CP1+CP2 ok (ya puede contar meta)
this._cpState = 0;

// ---------- helpers ----------
const _ptToXY = (pt) => {
  if (!pt) return { x: NaN, y: NaN };
  if (typeof pt.x === 'number' && typeof pt.y === 'number') return { x: pt.x, y: pt.y };
  if (Array.isArray(pt) && pt.length >= 2) return { x: pt[0], y: pt[1] };
  return { x: NaN, y: NaN };
};

const _getCenterPtsXY = () => {
  // Preferimos un centerline “rico” si TrackBuilder lo expone; si no, usamos el meta.centerline del track.
  const c =
    this.track?.geom?.center ||
    this.track?.geom?.centerline ||
    this.track?.geom?.centerPts ||
    this.track?.meta?.centerline ||
    [];

  return c.map(_ptToXY).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
};

const _makeGateAtFraction = (frac01) => {
  const pts0 = _getCenterPtsXY();
if (pts0.length < 3) return null;

// Para circuitos cerrados: incluir el segmento de cierre (last -> first)
const pts = pts0.slice();
pts.push({ x: pts0[0].x, y: pts0[0].y });

// Longitud total (incluye cierre)
let total = 0;
for (let i = 1; i < pts.length; i++) {
  const dx = pts[i].x - pts[i - 1].x;
  const dy = pts[i].y - pts[i - 1].y;
  total += Math.hypot(dx, dy);
}
if (total <= 0) return null;

  const target = total * frac01;

  // Encuentra el segmento donde cae target
  let acc = 0;
  let idx = 1;
  for (; idx < pts.length; idx++) {
    const dx = pts[idx].x - pts[idx - 1].x;
    const dy = pts[idx].y - pts[idx - 1].y;
    const d = Math.hypot(dx, dy);
    if (acc + d >= target) break;
    acc += d;
  }
  if (idx >= pts.length) idx = pts.length - 1;

  // Tangente local (preferimos mirar “hacia delante”)
  const p0 = pts[Math.max(0, idx - 1)];
  const p1 = pts[idx];
  const p2 = pts[Math.min(pts.length - 1, idx + 1)];

  // Tangente suavizada usando p0->p2 (reduce gates raros en curvas)
  let tx = p2.x - p0.x;
  let ty = p2.y - p0.y;
  const tLen = Math.hypot(tx, ty) || 1;
  tx /= tLen; ty /= tLen;

  // Perpendicular
  let px = -ty;
  let py = tx;

  // Punto medio interpolado dentro del segmento (p0->p1)
  const segDx = p1.x - p0.x;
  const segDy = p1.y - p0.y;
  const segLen = Math.hypot(segDx, segDy) || 1;
  const remain = Math.max(0, target - acc);
  const u = Math.min(1, remain / segLen);

  const mid = { x: p0.x + segDx * u, y: p0.y + segDy * u };

  // Largo del gate (un pelín más que el ancho para asegurar cruce)
  const half = (t01.trackWidth || 300) * 0.75;
  const a = { x: mid.x - px * half, y: mid.y - py * half };
  const b = { x: mid.x + px * half, y: mid.y + py * half };

  // normal = “hacia delante” (tangente)
  const normal = { x: tx, y: ty };

  return { a, b, normal };
};

// ---------- construir checkpoints 33% / 66% ----------
this.checkpoints = {
  cp1: _makeGateAtFraction(0.33),
  cp2: _makeGateAtFraction(0.66)
};

// Debug visual: meta + checkpoints
const finish = t01.finish || t01.finishLine;
if (finish?.a && finish?.b) {
  this.finishGfx?.destroy?.();
  this.finishGfx = this.add.graphics();
  this.finishGfx.lineStyle(6, 0xff2d2d, 1);
  this.finishGfx.beginPath();
  this.finishGfx.moveTo(finish.a.x, finish.a.y);
  this.finishGfx.lineTo(finish.b.x, finish.b.y);
  this.finishGfx.strokePath();
  this.finishGfx.setDepth(50);
  this.uiCam?.ignore?.(this.finishGfx);
}

this.cpGfx?.destroy?.();
this.cpGfx = this.add.graphics();
this.cpGfx.setDepth(49);
this.uiCam?.ignore?.(this.cpGfx);

const _drawGate = (gate, color) => {
  if (!gate?.a || !gate?.b) return;
  this.cpGfx.lineStyle(5, color, 0.9);
  this.cpGfx.beginPath();
  this.cpGfx.moveTo(gate.a.x, gate.a.y);
  this.cpGfx.lineTo(gate.b.x, gate.b.y);
  this.cpGfx.strokePath();
};

// CP1 (amarillo) y CP2 (verde)
_drawGate(this.checkpoints.cp1, 0xffd400);
_drawGate(this.checkpoints.cp2, 0x2dff6a);

    // 7) Cámara
    this.cameras.main.startFollow(this.carRig, true, 0.12, 0.12);
    this.cameras.main.setZoom(this.zoom);
    this.cameras.main.roundPixels = true;
    // 8) Input teclado
    this.keys = this.input.keyboard.addKeys({
  up: Phaser.Input.Keyboard.KeyCodes.W,
  down: Phaser.Input.Keyboard.KeyCodes.S,
  left: Phaser.Input.Keyboard.KeyCodes.A,
  right: Phaser.Input.Keyboard.KeyCodes.D,

  up2: Phaser.Input.Keyboard.KeyCodes.UP,
  down2: Phaser.Input.Keyboard.KeyCodes.DOWN,
  left2: Phaser.Input.Keyboard.KeyCodes.LEFT,
  right2: Phaser.Input.Keyboard.KeyCodes.RIGHT,

  zoomIn: Phaser.Input.Keyboard.KeyCodes.E,
  zoomOut: Phaser.Input.Keyboard.KeyCodes.Q,
  back: Phaser.Input.Keyboard.KeyCodes.ESC,

  // DEBUG: alternar culling
  toggleCull: Phaser.Input.Keyboard.KeyCodes.C
});


      // HUD (caja + texto legible)
const hudX = 12;
const hudY = 12;

this.hudBox = this.add.rectangle(hudX, hudY, 200, 64, 0x000000, 0.45)
  .setOrigin(0, 0)
  .setScrollFactor(0)
  .setDepth(1099)
  .setStrokeStyle(1, 0xffffff, 0.12);

this.hud = this.add.text(hudX + 10, hudY + 8, '', {
fontFamily: 'Orbitron, monospace',
  fontSize: '13px',
  color: '#ffffff',
  lineSpacing: 3
}).setScrollFactor(0).setDepth(1100);


// Ajuste automático del alto de la caja según el texto (para que no tape)
this._fitHud = () => {
  const w = 340;
  const h = Math.max(68, (this.hud.height || 0) + 16);
  this.hudBox.setSize(w, h);
};
// =================================================
// DEV HUD (panel derecha) — solo para desarrollo
// (sin botones: zoom/cull se operarán desde Config más adelante)
// =================================================
this._devVisible = false;
this._devElems = [];

this._devRegister = (...objs) => {
  for (const o of objs) {
    if (!o) continue;
    this._devElems.push(o);
  }
};

this._setDevVisible = (v) => {
  this._devVisible = !!v;
  for (const o of (this._devElems || [])) o?.setVisible?.(this._devVisible);
};

if (DEV_TOOLS) {
  const pad = 8;

  // Panel más estrecho para móvil y sin salirse de pantalla
  const panelW = 180;
  const panelH = 170;
  const panelX = this.scale.width - panelW - pad;
  const panelY = 10;

  // Fondo panel dev
  this.devBox = this.add.rectangle(panelX, panelY, panelW, panelH, 0x000000, 0.50)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(1099)
    .setStrokeStyle(1, 0xffffff, 0.12);

  this.devTitle = this.add.text(panelX + 10, panelY + 8, 'DEV', {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '13px',
    color: '#ffffff',
    fontStyle: '700'
  }).setScrollFactor(0).setDepth(1100);

  // Texto de estado dev: word wrap + fuente algo más pequeña (evita montajes)
  this.devInfo = this.add.text(panelX + 10, panelY + 28, '', {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#ffffff',
    lineSpacing: 2,
    wordWrap: { width: panelW - 20, useAdvancedWrap: false }
  }).setScrollFactor(0).setDepth(1100);

  // Recolocar logs (_dbgText) dentro del panel (si existe ya)
  if (this._dbgText) {
    this._dbgText.setPosition(panelX + 10, panelY + 120);
    this._dbgText.setDepth(1100);
  }

  // Registrar para toggle ON/OFF
  this._devRegister(this.devBox, this.devTitle, this.devInfo, this._dbgText);

  // Estado inicial: oculto (lo mostrará el gesto 2 dedos)
  this._setDevVisible(false);
}
    // 10) iOS multitouch + controles táctiles
    this.input.addPointer(2);
    this.touch = this.createTouchControls();

// UI de upgrades desactivada en carrera (se moverá a Shop/Garage)
this.upUI = null;
// =================================================
// UI CAMERA (HUD no afectado por zoom del mundo)
// =================================================
this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
this.uiCam.setScroll(0, 0);
this.uiCam.setZoom(1);

// 1) La cámara principal NO debe renderizar UI
this.cameras.main.ignore([
  this.hudBox,
  this.hud,
  this.upUI,
  this._dbgText,
  this.devBox,
  this.devTitle,
  this.devInfo,
  this.devToggleBtn,
  this.devToggleTxt,
  // Botones de zoom
  this._zoomBtnPlus?.r,
  this._zoomBtnPlus?.t,
  this._zoomBtnMinus?.r,
  this._zoomBtnMinus?.t,
  this._zoomBtnCull?.r,
  this._zoomBtnCull?.t,
  // Controles táctiles
  this.touchUI
]
.filter(Boolean));

// 2) La cámara UI NO debe renderizar mundo (lo que ya existe ahora)
if (this.bgWorld) this.uiCam.ignore(this.bgWorld);
if (this.carRig) this.uiCam.ignore(this.carRig);
if (this.finishGfx) this.uiCam.ignore(this.finishGfx);

// Mantener tamaño si rota/cambia viewport
this.scale.on('resize', (gameSize) => {
  this.uiCam.setSize(gameSize.width, gameSize.height);
});
// =================================================
// START LIGHTS (F1) — modal + bloqueo de coche hasta salida
// (PNG pro + luces transparentes)
// =================================================
this._raceStarted = false;
this._startState = 'WAIT_GAS'; // WAIT_GAS -> COUNTDOWN -> GO -> RACING
this._prevThrottleDown = false;

// Modal container (UI)
this._startModal = this.add.container(0, 0).setScrollFactor(0).setDepth(2000);

const w = this.scale.width;
const h = this.scale.height;

// Fondo modal (oscurece)
const modalBg = this.add.rectangle(0, 0, w, h, 0x000000, 0.45).setOrigin(0, 0);

// “Panel” invisible: solo para layout (no hace falta caja grande)
const panelW = Math.min(760, Math.floor(w * 0.94));
const panelH = 320;
const panelX = Math.floor((w - panelW) / 2);
const panelY = Math.floor(h * 0.14);

// Texto
this._startTitle = this.add.text(panelX + 18, panelY + 6, 'START', {
  fontFamily: 'Orbitron, monospace',
  fontSize: '18px',
  color: '#ffffff',
  fontStyle: '600'
});

this._startHint = this.add.text(panelX + 18, panelY + 34, 'Pulsa GAS para iniciar el semáforo', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '13px',
  color: '#b7c0ff'
});

this._startStatus = this.add.text(panelX + 18, panelY + panelH - 30, 'WAITING', {
  fontFamily: 'Orbitron, monospace',
  fontSize: '16px',
  color: '#ffffff'
});

// PNG del semáforo (lo más grande posible)
this._startAsset = this.add.image(panelX + panelW / 2, panelY + 160, 'start_base')
  .setOrigin(0.5, 0.5);

// Escala: casi ancho completo del “panel”
{
  const targetW = Math.min(panelW * 0.92, 720);
  const s = targetW / this._startAsset.width;
  this._startAsset.setScale(s);
}
// Aseguramos que TODO el semáforo vive dentro del modal
this._startModal.add([
  modalBg,
  this._startTitle,
  this._startHint,
  this._startStatus,
  this._startAsset
]);
// Posicionar luces encima del PNG (coordenadas relativas al PNG)
const positionLights = () => {
  const img = this._startAsset;
  const s = img.scaleX;

  // Centro del PNG
  const baseX = img.x;
  const baseY = img.y;

  // Ajuste fino: las lentes están alineadas en una fila.
  // Estos offsets están pensados para el PNG que generamos (semáforo centrado).
  const spacing = 44 * s;
  const y = baseY - 12 * s;   // altura de lentes respecto al centro
  const x0 = baseX - 2 * spacing;

  for (let i = 0; i < 5; i++) {
    this._startLights[i].setPosition(x0 + i * spacing, y);
    this._startLights[i].setRadius(15 * s);
  }
};

// Importante: la cámara principal NO debe dibujar la modal (solo UI)
this.cameras.main.ignore(this._startModal);

// Si rota/cambia viewport, reajusta modal y reubica luces
this._reflowStartModal = () => {
  const w2 = this.scale.width;
  const h2 = this.scale.height;

  modalBg.setSize(w2, h2);

  const pw = Math.min(760, Math.floor(w2 * 0.94));
  const px = Math.floor((w2 - pw) / 2);
  const py = Math.floor(h2 * 0.14);

  // Repos texto
  this._startTitle.setPosition(px + 18, py + 6);
  this._startHint.setPosition(px + 18, py + 34);
  this._startStatus.setPosition(px + 18, py + panelH - 30);

  // Repos asset + escala
  this._startAsset.setPosition(px + pw / 2, py + 160);

  const targetW = Math.min(pw * 0.92, 720);
  const s = targetW / this._startAsset.width;
  this._startAsset.setScale(s);
};

this.scale.on('resize', this._reflowStartModal);
  // 12) Volver al menú
  if (this.keys?.back) {
    this.keys.back.on('down', () => this.scene.start('menu'));
  }

  // =================================================
  // 👇 AQUÍ VA EL PUNTO B (ESTO ES LO QUE AÑADES)
  // =================================================

  // 🔎 Detecta y apaga cualquier objeto con textura missing
  this._hideMissingTextures();

  // Re-chequeo por si algo aparece tras resize / UI
  this.time.delayedCall(250, () => this._hideMissingTextures());
  this.time.delayedCall(800, () => this._hideMissingTextures());

  // Flag para update()
  this._trackReady = true;

// ================================================
// DEV HUD trigger oculto — pulsación larga con 2 dedos (robusto)
// + indicador en pantalla de dedos detectados (DEV)
// ================================================
if (DEV_TOOLS) {
  // Asegura multitouch (crea punteros extra)
  this.input.addPointer(5);

  const HOLD_MS = 700;
  let holdTimer = null;
  let cooldownMs = 0;
  let armed = false;

  // Indicador pequeño (para verificar que Phaser detecta 2 dedos)
  this._touchDbg = this.add.text(this.scale.width - 10, 10, '', {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: { left: 6, right: 6, top: 4, bottom: 4 }
  }).setOrigin(1, 0).setScrollFactor(0).setDepth(999999);

  // Cuenta dedos realmente “down” según Phaser
  const downCount = () => {
    const ps = this.input.manager?.pointers || [];
    let c = 0;
    for (const p of ps) if (p && p.isDown) c++;
    return c;
  };

  const cancelHold = () => {
    if (holdTimer) {
      holdTimer.remove(false);
      holdTimer = null;
    }
    armed = false;
  };

  this.input.on('pointerdown', () => {
    if (cooldownMs > 0) return;

    // Armamos solo cuando haya 3+ dedos simultáneos
    if (downCount() < 3) return;

    cancelHold();
    armed = true;

    holdTimer = this.time.delayedCall(HOLD_MS, () => {
      // Si siguen 2+ dedos al cumplir el tiempo -> toggle DEV HUD
      if (downCount() >= 2) {
        this._setDevVisible(!this._devVisible);
        cooldownMs = 600;
      }
      cancelHold();
    });
  });

  this.input.on('pointerup', cancelHold);
  this.input.on('pointerout', cancelHold);

  // Actualiza indicador y cooldown cada frame
  this.events.on('postupdate', (t, dt) => {
    cooldownMs = Math.max(0, cooldownMs - (dt || 0));

    const c = downCount();
    if (this._touchDbg) {
      this._touchDbg.setText(
        `touches:${c}  armed:${armed ? 'Y' : 'N'}  dev:${this._devVisible ? 'ON' : 'OFF'}`
      );
    }
  });
}
}

  buildUpgradesUI() {
    // Si ya existía (por reinicio de escena) la destruimos
    if (this.upUI) {
      this.upUI.destroy(true);
      this.upUI = null;
      this.upTxt = null;
    }

    const pad = 12;
    const boxW = 220;
    const boxH = 134;

    const uiX = this.scale.width - pad - boxW;
    const uiY = pad;

    this.upUI = this.add.container(0, 0).setScrollFactor(0).setDepth(1200);

    const bg = this.add.rectangle(uiX, uiY, boxW, boxH, 0x0b1020, 0.45)
      .setOrigin(0)
      .setStrokeStyle(1, 0xb7c0ff, 0.18);

    const title = this.add.text(uiX + 12, uiY + 10, 'UPGRADES', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#b7c0ff',
      fontStyle: 'bold'
    });

    this.upTxt = this.add.text(uiX + 12, uiY + 30, '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#ffffff',
      lineSpacing: 4
    });

    const makeBtn = (x, y, label, onClick) => {
      const bw = 66, bh = 28;

      const r = this.add.rectangle(x, y, bw, bh, 0x0b1020, 0.35)
        .setOrigin(0)
        .setStrokeStyle(1, 0x2bff88, 0.20);

      const t = this.add.text(x + bw / 2, y + bh / 2, label, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '12px',
        color: '#2bff88',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      r.setInteractive({ useHandCursor: true });
      r.on('pointerdown', () => onClick());

      return [r, t];
    };

    const refresh = () => {
      const u = this.upgrades || { engine: 0, brakes: 0, tires: 0 };
      this.upTxt.setText(
        `Motor:  ${u.engine}/${this.UPGRADE_CAPS.engine}\n` +
        `Frenos: ${u.brakes}/${this.UPGRADE_CAPS.brakes}\n` +
        `Neum.:  ${u.tires}/${this.UPGRADE_CAPS.tires}`
      );
    };

    const btnY = uiY + 92;
    const [b1, t1] = makeBtn(uiX + 12,  btnY, 'MOTOR+', () => { if (this.buyUpgrade) this.buyUpgrade('engine'); refresh(); });
    const [b2, t2] = makeBtn(uiX + 80,  btnY, 'FRENO+', () => { if (this.buyUpgrade) this.buyUpgrade('brakes'); refresh(); });
    const [b3, t3] = makeBtn(uiX + 148, btnY, 'NEUM+',  () => { if (this.buyUpgrade) this.buyUpgrade('tires');  refresh(); });

    this.upUI.add([bg, title, this.upTxt, b1, t1, b2, t2, b3, t3]);
    refresh();

    // Reposicionar si rota/cambia tamaño
    this.scale.off('resize', this._onResizeUpUI);
    this._onResizeUpUI = () => this.buildUpgradesUI();
    this.scale.on('resize', this._onResizeUpUI);
  }

  update(time, deltaMs) {
    const dt = Math.min(0.05, (deltaMs || 0) / 1000);

    // Guardas duras: si create() no terminó, no reventamos el loop.
    if (!this.cameras?.main) return;

    // Si no hay coche todavía, como mínimo no crashees.
    if (!this.car || !this.car.body) {

      return;
    }

    // Keys pueden no existir si create() se cortó antes de input
    const keys = this.keys || {};
    const justDown = Phaser?.Input?.Keyboard?.JustDown;

    // Zoom (solo si existen teclas)
    if (justDown && keys.zoomIn && justDown(keys.zoomIn)) {
      this.zoom = clamp((this.zoom ?? 1) + 0.1, 0.6, 1.6);
      this.cameras.main.setZoom(this.zoom);
    }
    if (justDown && keys.zoomOut && justDown(keys.zoomOut)) {
      this.zoom = clamp((this.zoom ?? 1) - 0.1, 0.6, 1.6);
      this.cameras.main.setZoom(this.zoom);
    }
// DEBUG: toggle culling (ON / OFF)
if (justDown && keys.toggleCull && justDown(keys.toggleCull)) {
  this._cullEnabled = !this._cullEnabled;
  this._hudLog(`[culling] ${this._cullEnabled ? 'ON' : 'OFF'}`);
}
    // Inputs
    const t = this.touch || { steer: 0, throttle: 0, brake: 0, stickX: 0, stickY: 0 };
// =================================================
// START LIGHTS runtime (bloquea coche hasta salida)
// =================================================
const throttleDown = (t.throttle > 0.5);
const throttleJustPressed = throttleDown && !this._prevThrottleDown;
this._prevThrottleDown = throttleDown;

// En WAIT_GAS: si pulsa GAS, arranca secuencia
if (this._startState === 'WAIT_GAS' && throttleJustPressed) {
  this._startState = 'COUNTDOWN';

  if (this._startHint) this._startHint.setText('Manténte listo...');
  if (this._startStatus) {
    this._startStatus.setText('RED LIGHTS');
    this._startStatus.setColor('#ffffff');
  }

  // Asegura frame base antes de empezar
  if (this._startAsset) this._startAsset.setTexture('start_base');

  const stepMs = 600;

  // Enciende 6 rojas secuencial: start_l1 ... start_l6
  for (let i = 1; i <= 6; i++) {
    this.time.delayedCall(stepMs * i, () => {
      if (this._startAsset) this._startAsset.setTexture(`start_l${i}`);
    });
  }

  // Delay aleatorio estilo F1 antes de apagar (lights out)
  const randMs = 800 + Math.floor(Math.random() * 700);

  this.time.delayedCall(stepMs * 6 + randMs, () => {
    // Lights out -> GO
    this._startState = 'GO';

    // Apaga (vuelve al base)
    if (this._startAsset) this._startAsset.setTexture('start_base');

    if (this._startStatus) {
      this._startStatus.setText('GO!');
      this._startStatus.setColor('#2bff88');
    }

    // Iniciar cronómetro EXACTAMENTE en lights out
    if (this.timing) {
      this.timing.lapStart = performance.now();
      this.timing.started = true;
      this.timing.s1 = null;
      this.timing.s2 = null;
      this.timing.s3 = null;
    }

    // Cierra modal y habilita carrera
    this.time.delayedCall(350, () => {
  this._startState = 'RACING';
  this._raceStarted = true;
  if (this._startModal) this._startModal.setVisible(false);
});
  });
}

// Bloqueo del coche mientras no haya salida (pero NO cortamos el update,
// para que la pista/culling se siga dibujando durante la modal)
const freezeStart = !this._raceStarted;

if (freezeStart) {
  const body0 = this.car?.body;
  if (body0) {
    body0.setVelocity(0, 0);
    body0.setAngularVelocity(0);
  }
}
const up = !freezeStart && (
  (keys.up?.isDown) ||
  (keys.up2?.isDown) ||
  (t.throttle > 0.5)
);

const down = !freezeStart && (
  (keys.down?.isDown) ||
  (keys.down2?.isDown) ||
  (t.brake > 0.5)
);

const left = !freezeStart && (
  (keys.left?.isDown) ||
  (keys.left2?.isDown)
);

const right = !freezeStart && (
  (keys.right?.isDown) ||
  (keys.right2?.isDown)
);

    const body = this.car.body;

    // Dirección del coche
    const rot = this.car.rotation || 0;
    const dirX = Math.cos(rot);
    const dirY = Math.sin(rot);

    // Velocidad actual
    const vx = body.velocity?.x || 0;
    const vy = body.velocity?.y || 0;
    const speed = Math.sqrt(vx * vx + vy * vy);

// =========================
// SURFACE DETECTION (3 estados)
// TRACK: dentro de ribbon principal
// GRASS: dentro de banda GRASS (ribbon más ancho)
// OFF: fuera de la banda GRASS
// =========================
const x = this.car.x;
const y = this.car.y;

// 1) Dentro de pista
const onTrack = this._isOnTrack ? this._isOnTrack(x, y) : true;

// 2) Dentro de banda GRASS (si existe)
const inGrassBand = this._isInBand
  ? this._isInBand(this.track?.geom?.grass, x, y)
  : false;

// Surface final
let surface = 'OFF';
if (onTrack) {
  surface = 'TRACK';
} else if (inGrassBand) {
  surface = 'GRASS';
}

this._onTrack = onTrack;
this._surface = surface;
// Params (por si init no llegó a setearlos aún)
let accel = this.accel ?? 0;
const brakeForce = this.brakeForce ?? 0;
const linearDrag = this.linearDrag ?? 0;
const maxFwd = this.maxFwd ?? 1;
const maxRev = this.maxRev ?? 1;
let turnRate = this.turnRate ?? 0;
const turnMin = this.turnMin ?? 0.1;

// =========================
// SURFACE PHYSICS
// =========================

// Césped: penalización MEDIA (recuperable)
if (this._surface === 'GRASS') {
  // 1) motor “ahogado” pero menos
  accel *= 0.65;

  // 2) menos capacidad de giro pero menos
  turnRate *= 0.80;

  // 3) drag medio y estable por tiempo (independiente de FPS)
  //    En ~1s te deja aprox al 55% de velocidad
  const extra = Math.pow(0.55, dt);
  body.velocity.x *= extra;
  body.velocity.y *= extra;
}

// Off-road: penalización DURA (TU BLOQUE original, intacto)
if (this._surface === 'OFF') {
  // 1) motor “ahogado”
  accel *= 0.35;

  // 2) menos capacidad de giro
  turnRate *= 0.60;

  // 3) drag extra fuerte y estable por tiempo (independiente de FPS)
  //    En ~1s te deja aprox al 18% de velocidad (muy penalizante)
  const extra = Math.pow(0.18, dt);
  body.velocity.x *= extra;
  body.velocity.y *= extra;
}

    // Aceleración / freno
    if (up && !down) {
      body.velocity.x += dirX * accel * dt;
      body.velocity.y += dirY * accel * dt;
    }
    if (down) {
      body.velocity.x -= dirX * brakeForce * dt;
      body.velocity.y -= dirY * brakeForce * dt;
    }

    // Drag base
    const drag = Math.max(0, 1 - linearDrag * dt * 60);
    body.velocity.x *= drag;
    body.velocity.y *= drag;

    // Límite de velocidad por sentido
    const fwdSpeed = body.velocity.x * dirX + body.velocity.y * dirY;
    const newSpeed = Math.sqrt(
      body.velocity.x * body.velocity.x +
      body.velocity.y * body.velocity.y
    );
    const maxSpeed = fwdSpeed >= 0 ? maxFwd : maxRev;

    if (newSpeed > maxSpeed) {
      const s = maxSpeed / newSpeed;
      body.velocity.x *= s;
      body.velocity.y *= s;
    }

    // Giro (depende de velocidad)
    const speed01 = clamp(speed / maxFwd, 0, 1);
    const turnFactor = clamp(1 - speed01, turnMin, 1);
    const maxTurn = turnRate * turnFactor; // rad/s

    // 1) Teclado: volante clásico
    if (left && !right) this.car.rotation -= maxTurn * dt;
    if (right && !left) this.car.rotation += maxTurn * dt;

    // 2) Táctil: alineamiento por stick (solo si hay stick activo)
    const stickMag = Math.sqrt(t.stickX * t.stickX + t.stickY * t.stickY);
    const movingEnough = speed > 8;

    if (!left && !right && stickMag > 0.15 && movingEnough) {
      const target = Math.atan2(t.stickY, t.stickX);
      const diff = wrapPi(target - this.car.rotation);

      const EPS = 0.02;
      if (Math.abs(diff) > EPS) {
        const step = clamp(diff, -maxTurn * dt, maxTurn * dt);
        this.car.rotation += step;
      } else {
        this.car.rotation = target;
      }
    }

// === Track culling render (solo celdas cercanas) ===
// IMPORTANTE: si aquí explota, no debe tumbar el update entero.
try {
  const geom = this.track?.geom;
  const cells = geom?.cells;

  if (cells && this.car) {
    const cellSize = geom.cellSize;
    const cx = Math.floor(this.car.x / cellSize);
    const cy = Math.floor(this.car.y / cellSize);

    // Diagnóstico 1 sola vez (sin variables fuera de scope)
    if (!this._trackOnce) {
      this._trackOnce = true;

      const key0 = `${cx},${cy}`;
      const cd0 = cells.get(key0);

      const polysLen0 = cd0?.polys?.length ?? 0;
      const poly0 = (cd0?.polys && cd0.polys.length) ? cd0.polys[0] : null;
      const p0raw = (Array.isArray(poly0) && poly0.length) ? poly0[0] : null;

      let p0s = 'null';
      if (p0raw && typeof p0raw.x === 'number' && typeof p0raw.y === 'number') {
        p0s = `{x:${p0raw.x.toFixed(1)},y:${p0raw.y.toFixed(1)}}`;
      } else if (Array.isArray(p0raw) && p0raw.length >= 2) {
        p0s = `[${Number(p0raw[0]).toFixed(1)},${Number(p0raw[1]).toFixed(1)}]`;
      }

      const cellsSize = cells.size ?? null;
      this._trackDiag = `[track] cells=${cellsSize} carCell=${key0} hasCell=${!!cd0} polys=${polysLen0} p0=${p0s}`;
      this._hudLog(this._trackDiag);
    }

    let want;

if (this._cullEnabled === false) {
  // OFF = pintar todas las celdas reales (sin loops enormes)
  want = new Set(cells.keys());
} else {
  want = new Set();
  const R = this.track.cullRadiusCells ?? 2;

  for (let yy = cy - R; yy <= cy + R; yy++) {
    for (let xx = cx - R; xx <= cx + R; xx++) {
      want.add(`${xx},${yy}`);
    }
  }
}

    // Ocultar celdas que ya no se quieren
    for (const k of (this.track.activeCells || [])) {
      if (!want.has(k)) {
        const cell = this.track.gfxByCell.get(k);
        if (cell) {
          cell.tile?.clearMask?.(true);
          cell.mask?.destroy?.();
          cell.maskG?.destroy?.();
          cell.tile?.destroy?.();
          cell.stroke?.destroy?.();
          this.track.gfxByCell.delete(k);
        }
      }
    }

    // Mostrar/crear las que sí se quieren (ASPHALT TEXTURE + MASK)
    for (const k of want) {
      const cellData = cells.get(k);
      if (!cellData || !cellData.polys || cellData.polys.length === 0) continue;

      let cell = this.track.gfxByCell.get(k);

      if (!cell) {
        const [ix, iy] = k.split(',').map(Number);
        const x = ix * cellSize;
        const y = iy * cellSize;

// 1) Imagen de asfalto (NO tileSprite: evita costuras con mask + cámara)
// Asfalto por celda (con solape para evitar “costuras” entre chunks)
const tile = this.add.image(x - 1, y - 1, 'asphalt')
  .setOrigin(0, 0)
  .setDisplaySize(cellSize + 2, cellSize + 2)
  .setScrollFactor(1)
  .setDepth(10);


// 2) Mask con forma de pista
const maskG = this.make.graphics({ x, y, add: false });

// UI camera no debe renderizar chunks / máscaras
this.uiCam?.ignore?.(tile);
this.uiCam?.ignore?.(maskG);

maskG.clear();
maskG.fillStyle(0xffffff, 1);

const getXY = (pt) => {
  if (!pt) return { x: NaN, y: NaN };
  if (typeof pt.x === 'number' && typeof pt.y === 'number') return { x: pt.x, y: pt.y };
  if (Array.isArray(pt) && pt.length >= 2) return { x: pt[0], y: pt[1] };
  return { x: NaN, y: NaN };
};

// 1) Relleno de asfalto (máscara)
for (const poly of cellData.polys) {
  if (!poly || poly.length < 3) continue;

  const p0 = getXY(poly[0]);
  if (!Number.isFinite(p0.x) || !Number.isFinite(p0.y)) continue;

  const looksWorld =
    (p0.x > cellSize * 1.5) || (p0.y > cellSize * 1.5) ||
    (p0.x < -cellSize * 0.5) || (p0.y < -cellSize * 0.5);

  const x0 = looksWorld ? (p0.x - x) : p0.x;
  const y0 = looksWorld ? (p0.y - y) : p0.y;

  maskG.beginPath();
  maskG.moveTo(x0, y0);

  for (let i = 1; i < poly.length; i++) {
    const pi = getXY(poly[i]);
    if (!Number.isFinite(pi.x) || !Number.isFinite(pi.y)) continue;

    const lx = looksWorld ? (pi.x - x) : pi.x;
    const ly = looksWorld ? (pi.y - y) : pi.y;
    maskG.lineTo(lx, ly);
  }

  maskG.closePath();
  maskG.fillPath();
}

// (bordes por celda eliminados: se dibujarán globales fuera del culling)

const mask = maskG.createGeometryMask();
tile.setMask(mask);

cell = { tile, stroke: null, maskG, mask };

        this.track.gfxByCell.set(k, cell);
      }

      if (cell.tile && !cell.tile.visible) cell.tile.setVisible(true);
    }

    this.track.activeCells = want;
  }
} catch (e) {
  if (!this._cullErrLogged) {
    this._cullErrLogged = true;
    this._hudLog(`[cull ERROR] ${e?.message || e}`);
  }
}
    // === VUELTAS: detectar cruce de línea de meta (robusto) ===
    try {
      if (this.finishLine?.a && this.finishLine?.b && this.finishLine?.normal) {
        const a = this.finishLine.a;
        const b = this.finishLine.b;
        const n = this.finishLine.normal;

        const x0 = (this.prevCarX ?? this.car.x);
        const y0 = (this.prevCarY ?? this.car.y);
        const x1 = this.car.x;
        const y1 = this.car.y;

        const side0 = (x0 - a.x) * n.x + (y0 - a.y) * n.y;
        const side1 = (x1 - a.x) * n.x + (y1 - a.y) * n.y;

        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const len2 = abx * abx + aby * aby;
        const proj1 = len2 > 0 ? ((x1 - a.x) * abx + (y1 - a.y) * aby) / len2 : -1;
        const within = proj1 >= 0 && proj1 <= 1;

        const crossed = (side0 === 0) ? (side1 !== 0) : ((side0 > 0) !== (side1 > 0));

        const vvx = body.velocity?.x || 0;
        const vvy = body.velocity?.y || 0;
        const forward = (vvx * n.x + vvy * n.y) > 0;

        if (this._lapCooldownMs == null) this._lapCooldownMs = 0;
        this._lapCooldownMs = Math.max(0, this._lapCooldownMs - (deltaMs || 0));

        // Cooldowns
this._lapCooldownMs = Math.max(0, (this._lapCooldownMs || 0) - (deltaMs || 0));
this._cpCooldown1Ms = Math.max(0, (this._cpCooldown1Ms || 0) - (deltaMs || 0));
this._cpCooldown2Ms = Math.max(0, (this._cpCooldown2Ms || 0) - (deltaMs || 0));

// --- helper: test cruce gate (misma lógica que meta) ---
const _crossGate = (gate) => {
  if (!gate?.a || !gate?.b || !gate?.normal) return false;

  const a = gate.a;
  const b = gate.b;
  const n = gate.normal;

  const x0 = (this.prevCarX ?? this.car.x);
  const y0 = (this.prevCarY ?? this.car.y);
  const x1 = this.car.x;
  const y1 = this.car.y;

  // --- Segment intersection: (x0,y0)->(x1,y1) con gate a->b ---
  const ax = a.x, ay = a.y, bx = b.x, by = b.y;

  const rpx = x1 - x0;
  const rpy = y1 - y0;
  const spx = bx - ax;
  const spy = by - ay;

  const rxs = rpx * spy - rpy * spx;
  const qpx = ax - x0;
  const qpy = ay - y0;
  const qpxr = qpx * rpy - qpy * rpx;

  // Paralelos o sin movimiento
  if (Math.abs(rxs) < 1e-6) return false;

  const t = (qpx * spy - qpy * spx) / rxs;
  const u = qpxr / rxs;

  // t in [0,1] -> interseca dentro del movimiento del coche
  // u in [0,1] -> interseca dentro del segmento del checkpoint
  const hit = (t >= 0 && t <= 1 && u >= 0 && u <= 1);
  if (!hit) return false;

  // Dirección: exigir que el coche vaya "hacia delante" del gate (anti ida/vuelta)
  const vvx = body.velocity?.x || (x1 - x0);
  const vvy = body.velocity?.y || (y1 - y0);
  const forwardGate = (vvx * n.x + vvy * n.y) > 0;

  return forwardGate;
};
// --- 1) checkpoints (en orden) ---
const cp1 = this.checkpoints?.cp1;
const cp2 = this.checkpoints?.cp2;

if (cp1 && this._cpCooldown1Ms === 0 && _crossGate(cp1)) {
  if ((this._cpState || 0) === 0) {
    this._cpState = 1;
    if (this.timing) this.timing.s1 = performance.now() - this.timing.lapStart;
  } else {
    // Si lo pisa fuera de orden, reiniciamos para evitar exploits raros
    this._cpState = 0;
  }
  this._cpCooldown1Ms = 500;
}

if (cp2 && this._cpCooldown2Ms === 0 && _crossGate(cp2)) {
  if ((this._cpState || 0) === 1) {
    this._cpState = 2;
    if (this.timing) this.timing.s2 = performance.now() - this.timing.lapStart;
  } else {
    this._cpState = 0;
  }
  this._cpCooldown2Ms = 500;
}

// --- 2) meta: SOLO cuenta si cpState==2 ---
if (within && crossed && forward && this._lapCooldownMs === 0) {
  if ((this._cpState || 0) === 2) {
    if (this.timing) {
  const now = performance.now();
  const lapTime = now - this.timing.lapStart;

  this.timing.s3 = lapTime;
  this.timing.lastLap = lapTime;
  this.timing.bestLap = (this.timing.bestLap == null) ? lapTime : Math.min(this.timing.bestLap, lapTime);

  this.timing.lapStart = now;
  this.timing.s1 = null;
  this.timing.s2 = null;
  this.timing.s3 = null;
}
    this.lapCount = (this.lapCount || 0) + 1;
    this._lapCooldownMs = 700;
    this._cpState = 0; // nueva vuelta, reinicia combo
  } else {
    // cruzó meta sin checkpoints correctos: no cuenta
    this._lapCooldownMs = 300; // pequeño “anti rebote”
    this._cpState = 0;
  }
}
      }
    } catch (e) {
    }

    // Actualizar prev SIEMPRE
    this.prevCarX = this.car.x;
    this.prevCarY = this.car.y;

    // === HUD ===
    const kmh = speed * 0.12;

    if (this.hud?.setText) {
      const lapNow = (this.timing?.started && this.timing.lapStart != null)
        ? (performance.now() - this.timing.lapStart)
        : null;

      this.hud.setText(
        `LAP ${this.lapCount || 0}\n` +
        `NOW  ${fmtTime(lapNow)}\n` +
        `S1   ${fmtTime(this.timing?.s1)}\n` +
        `S2   ${fmtTime(this.timing?.s2)}\n` +
        `LAST ${fmtTime(this.timing?.lastLap)}\n` +
        `BEST ${fmtTime(this.timing?.bestLap)}`
      );

      if (this._fitHud) this._fitHud();
    }
// DEV HUD info (derecha)
if (DEV_TOOLS && this.devInfo && this._devVisible) {
  const cp = (this._cpState || 0);
  const surf = this._surface || '??';
  const zoom = (this.zoom ?? 1).toFixed(2);
  const cull = (this._cullEnabled !== false) ? 'ON' : 'OFF';
  const carCell = this._carCellKey || ''; // si no existe, queda vacío
  const diag = this._trackDiag || '';
  const diag2 = this._trackDiag2 || '';

  this.devInfo.setText(
    `Track: ${this.track?.meta?.id || this.track?.meta?.name || ''}\n` +
    `CP: ${cp} | Lap: ${this.lapCount || 0}\n` +
    `Surface: ${surf}\n` +
    `Cull: ${cull}\n` +
    `Zoom: ${zoom}\n` +
    (carCell ? `Cell: ${carCell}\n` : '') +
    (diag ? `Diag: ${diag}\n` : '') +
    (diag2 ? `Diag2: ${diag2}\n` : '')
  );
}
    // Sincronizar rig visual con body físico
    if (this.carRig && this.carBody) {
      this.carRig.x = this.carBody.x;
      this.carRig.y = this.carBody.y;
      this.carRig.rotation = this.carBody.rotation;
    }


  }
  ensureBgTexture() {
  const size = 256;

  // Producción: solo 'grass'. Eliminamos cualquier rastro de 'bgGrid'.
  if (this.textures.exists('grass')) this.textures.remove('grass');
  if (this.textures.exists('bgGrid')) this.textures.remove('bgGrid');

  const g = this.add.graphics();

  // Base verde
  g.fillStyle(0x1a6a2a, 1);
  g.fillRect(0, 0, size, size);

  // Ruido de variación (manchitas)
  for (let i = 0; i < 900; i++) {
    const alpha = 0.06 + Math.random() * 0.08;
    const col = Math.random() > 0.5 ? 0x134e20 : 0x2b8c3b;

    g.fillStyle(col, alpha);
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 2 + Math.random() * 3;
    const h = 2 + Math.random() * 3;
    g.fillRect(x, y, w, h);
  }

  // Briznas suaves
  g.lineStyle(1, 0x0f3a18, 0.10);
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.lineBetween(
      x,
      y,
      x + (Math.random() * 10 - 5),
      y - (6 + Math.random() * 12)
    );
  }

  g.generateTexture('grass', size, size);
  g.destroy();
}
  ensureAsphaltTexture() {
    const key = 'asphalt';
    const size = 256;

    // CLAVE: si ya existía, la borramos. Esto evita que “asphalt” se quede apuntando a una textura vieja (la rejilla).
    if (this.textures.exists(key)) this.textures.remove(key);

    const g = this.add.graphics();

    // Base asfalto (gris oscuro neutro)
    g.fillStyle(0x2a2f3a, 1);
    g.fillRect(0, 0, size, size);

    // Grano fino claro
    g.fillStyle(0xffffff, 0.045);
    for (let i = 0; i < 1100; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const s = Math.random() < 0.92 ? 1 : 2;
      g.fillRect(x, y, s, s);
    }

    // Grano fino oscuro
    g.fillStyle(0x000000, 0.07);
    for (let i = 0; i < 900; i++) {
      g.fillRect(Math.random() * size, Math.random() * size, 1, 1);
    }

    // Parches suaves (manchas de reparación)
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const w = 26 + Math.random() * 70;
      const h = 16 + Math.random() * 44;
      const a = 0.04 + Math.random() * 0.06;
      g.fillStyle(0x000000, a);
      g.fillRoundedRect(x, y, w, h, 6);
    }

    // Marcas de goma muy sutiles (tire marks)
    g.lineStyle(2, 0x10141b, 0.10);
    for (let i = 0; i < 12; i++) {
      const x1 = Math.random() * size;
      const y1 = Math.random() * size;
      const x2 = x1 + 80 + Math.random() * 120;
      const y2 = y1 + (Math.random() * 18 - 9);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.strokePath();
    }

    // Micro “rayas” de rodadura (longitudinales, casi invisibles)
    g.lineStyle(1, 0xffffff, 0.018);
    for (let i = 0; i < 160; i++) {
      const y = Math.random() * size;
      g.lineBetween(0, y, size, y + (Math.random() * 6 - 3));
    }

    g.generateTexture(key, size, size);
    g.destroy();
  }


  ensureCarTexture() {
    if (!this.textures.exists('__BODY__')) {
  const g = this.add.graphics();
  g.fillStyle(0xffffff, 0.001);
  g.fillRect(0, 0, 2, 2);
  g.generateTexture('__BODY__', 2, 2);
  g.destroy();
}
    if (this.textures.exists('car')) return;

    const w = 44, h = 26;
    const g = this.add.graphics();

    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(2, 4, w, h, 10);

    g.fillStyle(0xffffff, 0.95);
    g.fillRoundedRect(0, 0, w, h, 10);

    g.fillStyle(0x141b33, 0.9);
    g.fillRoundedRect(16, 6, 18, 14, 6);

    g.fillStyle(0x2bff88, 0.95);
    g.fillRoundedRect(34, 9, 10, 8, 4);

    g.lineStyle(2, 0x0b1020, 0.6);
    g.strokeRoundedRect(0, 0, w, h, 10);

    g.generateTexture('car', w + 4, h + 6);
    g.destroy();
  }

  createTouchControls() {
    const state = {
      steer: 0,
      throttle: 0,
      brake: 0,
      stickX: 0,
      stickY: 0,
      leftId: -1,
      rightId: -1,

      leftActive: false,
      rightThrottle: false,
      rightBrake: false,

      baseX: 0,
      baseY: 0,
      knobX: 0,
      knobY: 0,

      stickR: 0,
      stickMax: 0,

      rightX: 0,
      throttleY: 0,
      brakeY: 0,
      btnW: 0,
      btnH: 0
    };

const ui = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);
this.touchUI = ui; // ← referencia para cámaras

    const build = () => {
      ui.removeAll(true);

      const w = this.scale.width;
      const h = this.scale.height;
      const pad = 16;

      const stickR = Math.max(54, Math.floor(Math.min(w, h) * 0.07));
      const stickMax = stickR * 0.85;

      const baseX = pad + stickR + 10;
      const baseY = h - pad - stickR - 10;

      state.baseX = baseX;
      state.baseY = baseY;
      state.knobX = baseX;
      state.knobY = baseY;
      state.stickR = stickR;
      state.stickMax = stickMax;

      const btnW = Math.max(110, Math.floor(w * 0.22));
      const btnH = Math.max(78, Math.floor(h * 0.115));
      const gap = 14;

      const rightX = w - pad - btnW;
      const throttleY = h - pad - btnH * 2 - gap;
      const brakeY = h - pad - btnH;

      state.rightX = rightX;
      state.throttleY = throttleY;
      state.brakeY = brakeY;
      state.btnW = btnW;
      state.btnH = btnH;

      const zoneG = this.add.graphics();
      zoneG.fillStyle(0x000000, 0.14);

      const leftW = Math.floor(w * 0.46) - 14;
      const rightW = Math.floor(w * 0.46) - 14;

      zoneG.fillRoundedRect(10, h - 230, leftW, 220, 18);
      zoneG.lineStyle(2, 0xb7c0ff, 0.18);
      zoneG.strokeRoundedRect(10, h - 230, leftW, 220, 18);

      zoneG.fillRoundedRect(Math.floor(w * 0.54) + 4, h - 230, rightW, 220, 18);
      zoneG.lineStyle(2, 0xb7c0ff, 0.18);
      zoneG.strokeRoundedRect(Math.floor(w * 0.54) + 4, h - 230, rightW, 220, 18);

      const leftLabel = this.add.text(22, h - 220, 'GIRO', {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '12px',
        color: '#b7c0ff',
        fontStyle: 'bold'
      });

      const rightLabel = this.add.text(Math.floor(w * 0.54) + 16, h - 220, 'GAS / FRENO', {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '12px',
        color: '#b7c0ff',
        fontStyle: 'bold'
      });

      const g = this.add.graphics();

      const draw = () => {
        g.clear();

        g.fillStyle(0x0b1020, 0.35);
        g.fillCircle(state.baseX, state.baseY, state.stickR + 10);
        g.lineStyle(2, 0xb7c0ff, 0.25);
        g.strokeCircle(state.baseX, state.baseY, state.stickR + 10);

        const knobR = Math.floor(state.stickR * 0.46);
        g.fillStyle(0xffffff, state.leftActive ? 0.22 : 0.14);
        g.fillCircle(state.knobX, state.knobY, knobR);
        if (state.leftActive) {
          g.lineStyle(2, 0x2bff88, 0.35);
          g.strokeCircle(state.knobX, state.knobY, knobR);
        }

        g.fillStyle(0x0b1020, state.rightThrottle ? 0.50 : 0.28);
        g.fillRoundedRect(state.rightX, state.throttleY, state.btnW, state.btnH, 16);
        g.lineStyle(2, state.rightThrottle ? 0x2bff88 : 0xb7c0ff, state.rightThrottle ? 0.55 : 0.22);
        g.strokeRoundedRect(state.rightX, state.throttleY, state.btnW, state.btnH, 16);

        g.fillStyle(0x0b1020, state.rightBrake ? 0.50 : 0.28);
        g.fillRoundedRect(state.rightX, state.brakeY, state.btnW, state.btnH, 16);
        g.lineStyle(2, state.rightBrake ? 0xff5a7a : 0xb7c0ff, state.rightBrake ? 0.55 : 0.22);
        g.strokeRoundedRect(state.rightX, state.brakeY, state.btnW, state.btnH, 16);
      };

      const tText = this.add.text(state.rightX + state.btnW / 2, state.throttleY + state.btnH / 2, 'GAS', {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '16px',
        color: '#2bff88',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const bText = this.add.text(state.rightX + state.btnW / 2, state.brakeY + state.btnH / 2, 'FRENO', {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '16px',
        color: '#ff5a7a',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      ui.add([zoneG, leftLabel, rightLabel, g, tText, bText]);

      state._draw = draw;
      state._draw();
    };

    build();
    this.scale.on('resize', build);

    const hitThrottle = (x, y) =>
      x >= state.rightX && x <= state.rightX + state.btnW &&
      y >= state.throttleY && y <= state.throttleY + state.btnH;

    const hitBrake = (x, y) =>
      x >= state.rightX && x <= state.rightX + state.btnW &&
      y >= state.brakeY && y <= state.brakeY + state.btnH;

    const updateStick = (x, y) => {
      const dx = x - state.baseX;
      const dy = y - state.baseY;
      const d = Math.sqrt(dx * dx + dy * dy);

      const clamped = Math.min(d, state.stickMax);

      const kx = state.baseX + (d > 0.0001 ? (dx / d) * clamped : 0);
      const ky = state.baseY + (d > 0.0001 ? (dy / d) * clamped : 0);

      state.knobX = kx;
      state.knobY = ky;

      const rawX = (state.knobX - state.baseX) / state.stickMax;
      const rawY = (state.knobY - state.baseY) / state.stickMax;

      state.stickX = Math.abs(rawX) < 0.12 ? 0 : clamp(rawX, -1, 1);
      state.stickY = Math.abs(rawY) < 0.12 ? 0 : clamp(rawY, -1, 1);

      state.steer = state.stickX;
      // Ángulo objetivo del stick (para dirección absoluta)
if (state.stickX === 0 && state.stickY === 0) {
  state.targetAngle = null;
} else {
  // Corrección -90º para que "arriba" del stick sea "arriba" en el coche
  state.targetAngle = Math.atan2(state.stickY, state.stickX) - (Math.PI / 2);
}
    };

    this.input.on('pointerdown', (p) => {
      const w = this.scale.width;

      if (p.x < w * 0.5) {
        state.leftId = p.id;
        state.leftActive = true;
        updateStick(p.x, p.y);
      } else {
        state.rightId = p.id;
        state.rightThrottle = hitThrottle(p.x, p.y);
        state.rightBrake = hitBrake(p.x, p.y);
        state.throttle = state.rightThrottle ? 1 : 0;
        state.brake = state.rightBrake ? 1 : 0;
      }

      if (state._draw) state._draw();
    });

    this.input.on('pointermove', (p) => {
      if (!p.isDown) return;

      if (state.leftId === p.id) {
        state.leftActive = true;
        updateStick(p.x, p.y);
        if (state._draw) state._draw();
        return;
      }

      if (state.rightId === p.id) {
        state.rightThrottle = hitThrottle(p.x, p.y);
        state.rightBrake = hitBrake(p.x, p.y);
        state.throttle = state.rightThrottle ? 1 : 0;
        state.brake = state.rightBrake ? 1 : 0;
        if (state._draw) state._draw();
      }
    });

    this.input.on('pointerup', (p) => {
      if (state.leftId === p.id) {
        state.leftId = -1;
        state.leftActive = false;
        state.steer = 0;
        state.stickX = 0;
        state.stickY = 0;
        state.targetAngle = null;
        state.knobX = state.baseX;
        state.knobY = state.baseY;
      }

      if (state.rightId === p.id) {
        state.rightId = -1;
        state.rightThrottle = false;
        state.rightBrake = false;
        state.throttle = 0;
        state.brake = 0;
      }

      if (state._draw) state._draw();
    });

    return state;
  }
}
