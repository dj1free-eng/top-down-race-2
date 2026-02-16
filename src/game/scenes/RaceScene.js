import Phaser from 'phaser';
import { makeTrack01Oval } from '../tracks/track01_oval.js';
import { makeTrack02Technical } from '../tracks/track02_technical.js';
import { makeTrack03Drift } from '../tracks/track03_drift.js';
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
const ASPHALT_OVERLAY_ALPHA = 0.08; // rango sano: 0.08 – 0.12

// Base path de skins (carpeta en /public)
const CAR_SKIN_BASE = 'assets/skins/'; 
// Si tus skins están en /public/assets/skins/runtime/, usa:
// const CAR_SKIN_BASE = 'assets/skins/runtime/';

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
    // =========================================
  // Skins: carga dinámica por coche (runtime)
  // =========================================
ensureCarSkinTexture(spec) {
  const file = spec?.skin;
  if (!file) return Promise.resolve(null);

  const texKey = `car_${spec.id}`;
  if (this.textures.exists(texKey)) return Promise.resolve(texKey);

  return new Promise((resolve) => {
    const url = `${CAR_SKIN_BASE}${file}`;

    const onFileOk = (key) => {
      if (key !== texKey) return;
      cleanup();
      resolve(texKey);
    };

    const onLoadError = (fileObj) => {
      if (fileObj?.key !== texKey) return;
      cleanup();

      // 👇 Debug real (iPhone friendly). Si te molesta, luego lo quitamos.
      try { console.warn('[TDR2] Skin load FAIL:', texKey, url); } catch (_) {}

      // Fallback seguro
      resolve(null);
    };

    const cleanup = () => {
      this.load.off(`filecomplete-image-${texKey}`, onFileOk);
      this.load.off(Phaser.Loader.Events.LOAD_ERROR, onLoadError);
    };

    // ✅ Eventos por ARCHIVO, no por COMPLETE global
    this.load.once(`filecomplete-image-${texKey}`, onFileOk);
    this.load.on(Phaser.Loader.Events.LOAD_ERROR, onLoadError);

    this.load.image(texKey, url);

    // ✅ Si ya está cargando, NO forzamos start (evita rarezas).
    // Phaser arrancará el loader si está idle.
    if (!this.load.isLoading()) this.load.start();
  });
}
  // =================================================
  // Time Trial: precompute distancias acumuladas centerline
  // =================================================
  _initTTCenterlineMetrics() {
    const cl = this.track?.meta?.centerline;
    const n = cl?.length ?? 0;
    if (n < 2) return;

    const getXY = (p) => {
      if (!p) return [NaN, NaN];
      if (Array.isArray(p)) return [p[0], p[1]];
      if (typeof p.x === 'number' && typeof p.y === 'number') return [p.x, p.y];
      return [NaN, NaN];
    };

    const cum = new Array(n).fill(0);
    let total = 0;

    let [px, py] = getXY(cl[0]);
    for (let i = 1; i < n; i++) {
      const [x, y] = getXY(cl[i]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(px) || !Number.isFinite(py)) {
        cum[i] = total;
        px = x; py = y;
        continue;
      }
      const dx = x - px;
      const dy = y - py;
      total += Math.hypot(dx, dy);
      cum[i] = total;
      px = x; py = y;
    }

// Calcular ancla de META: distancia acumulada del punto de centerline más cercano a la finish line
const finish = this.track?.meta?.finish || this.track?.meta?.finishLine;
let startDist = 0;
let startIdx = 0;

if (finish?.a && finish?.b) {
  const midX = (finish.a.x + finish.b.x) * 0.5;
  const midY = (finish.a.y + finish.b.y) * 0.5;

  let bestI = 0;
  let bestD2 = Infinity;
  for (let i = 0; i < n; i++) {
    const [x, y] = getXY(cl[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const dx = x - midX;
    const dy = y - midY;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { bestD2 = d2; bestI = i; }
  }
  startIdx = bestI;
  startDist = cum[bestI] || 0;
}

this._ttCl = {
  cum,
  total: Math.max(1e-6, total),
  startDist,
  startIdx
};

// (opcional pero útil): inicializa el índice de búsqueda cerca de la meta
if (!this._ttProg) this._ttProg = { idx: startIdx, inited: false };
else this._ttProg.idx = startIdx;
  }

  // =================================================
  // Time Trial: progreso de vuelta 0..1 por centerline
  // (rápido: búsqueda local con caché de índice)
  // Devuelve progreso por DISTANCIA si _ttCl existe
  // =================================================
  _computeLapProgress01(px, py) {
    const cl = this.track?.meta?.centerline;
    const n = cl?.length ?? 0;
    if (n < 2 || !Number.isFinite(px) || !Number.isFinite(py)) return 0;

    if (!this._ttProg) this._ttProg = { idx: 0, inited: false };

    const getXY = (p) => {
      if (!p) return [NaN, NaN];
      if (Array.isArray(p)) return [p[0], p[1]];
      if (typeof p.x === 'number' && typeof p.y === 'number') return [p.x, p.y];
      return [NaN, NaN];
    };

    const byDist = (i) => {
  const cum = this._ttCl?.cum;
  const total = this._ttCl?.total || 1;
  const startDist = this._ttCl?.startDist || 0;

  if (cum && cum[i] != null) {
    // Progreso anclado a META: (cum - startDist) con wrap
    let d = cum[i] - startDist;
    d %= total;
    if (d < 0) d += total;
    return d / total;
  }
  return i / (n - 1);
};

    // Primera vez: búsqueda global (solo una vez)
    if (!this._ttProg.inited) {
      let bestI = 0;
      let bestD2 = Infinity;
      for (let i = 0; i < n; i++) {
        const [x, y] = getXY(cl[i]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        const dx = x - px;
        const dy = y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) { bestD2 = d2; bestI = i; }
      }
      this._ttProg.idx = bestI;
      this._ttProg.inited = true;
      return byDist(bestI);
    }

    // Búsqueda local circular alrededor del último índice (barata)
    const w = 45;
    const base = this._ttProg.idx;

    let bestI = base;
    let bestD2 = Infinity;

    for (let o = -w; o <= w; o++) {
      let i = base + o;
      i %= n;
      if (i < 0) i += n;

      const [x, y] = getXY(cl[i]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      const dx = x - px;
      const dy = y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; bestI = i; }
    }

    this._ttProg.idx = bestI;
    return byDist(bestI);
  }
  // =================================================
  // Time Trial: construir informe de evolución por pista
  // =================================================
  _buildTTReport() {
    const hist = Array.isArray(this.ttHistory) ? this.ttHistory : [];
    const n = hist.length;

    const getLap = (r) => (r && Number.isFinite(r.lapMs) ? r.lapMs : null);

    const laps = [];
    for (let i = 0; i < n; i++) {
      const v = getLap(hist[i]);
      if (v != null) laps.push(v);
    }

    const count = laps.length;
    if (count === 0) {
      return {
        count: 0,
        firstLapMs: null,
        bestLapMs: null,
        lastLapMs: null,
        improvementMs: null,
        improvementPct: null,
        recentAvg10Ms: null,
        recentRange10Ms: null,
        trend50Ms: null,
        pbIndex: null
      };
    }

    let bestLapMs = Infinity;
    let pbIndex = 0;
    for (let i = 0; i < count; i++) {
      if (laps[i] < bestLapMs) {
        bestLapMs = laps[i];
        pbIndex = i;
      }
    }

    const firstLapMs = laps[0];
    const lastLapMs = laps[count - 1];
    const improvementMs = firstLapMs - bestLapMs;
    const improvementPct = firstLapMs > 0 ? (improvementMs / firstLapMs) : null;

    const sliceAvg = (arr) => {
      if (!arr.length) return null;
      let s = 0;
      for (const x of arr) s += x;
      return s / arr.length;
    };

    const last10 = laps.slice(-10);
    const recentAvg10Ms = sliceAvg(last10);

    let recentRange10Ms = null;
    if (last10.length) {
      let mn = Infinity, mx = -Infinity;
      for (const x of last10) { if (x < mn) mn = x; if (x > mx) mx = x; }
      recentRange10Ms = mx - mn;
    }

    // Trend: compara avg últimas 10 vs las 10 anteriores (si existen)
    let trend50Ms = null;
    if (laps.length >= 20) {
      const a = sliceAvg(laps.slice(-10));
      const b = sliceAvg(laps.slice(-20, -10));
      if (a != null && b != null) trend50Ms = a - b; // negativo = mejora
    }

    return {
      count,
      firstLapMs,
      bestLapMs,
      lastLapMs,
      improvementMs,
      improvementPct,
      recentAvg10Ms,
      recentRange10Ms,
      trend50Ms,
      pbIndex
    };
  }
init(data) {
    // Si venimos del editor, testMode = true
  this._testMode = !!data?.testMode;

  // Por defecto, si es test, volver al editor del coche actual
  if (this._testMode) {
    const carId = data?.carId || this.carId || 'stock';
    this._returnSceneKey = 'car-editor';
    this._returnSceneData = { carId };
  } else {
    this._returnSceneKey = null;
    this._returnSceneData = null;
  }

  // ========================================
  // FACTORY TEST DRIVE (opcional)
  // ========================================
  this.factorySpec = data?.factorySpec || null;
  this._useFactorySpec = !!this.factorySpec;

  // 1) Resolver coche seleccionado (prioridad: factorySpec -> data -> localStorage -> stock)
  this.carId = this._useFactorySpec
    ? (this.factorySpec.id || '__factory__')
    : (data?.carId || localStorage.getItem('tdr2:carId') || 'stock');

  // 1.1) Resolver circuito seleccionado (prioridad: data -> localStorage -> track02)
  const incomingTrack = data?.trackKey;
  const savedTrack = localStorage.getItem('tdr2:trackKey');
  const valid = (k) => (k === 'track01' || k === 'track02' || k === 'track03');

  this.trackKey = valid(incomingTrack)
    ? incomingTrack
    : (valid(savedTrack) ? savedTrack : 'track02');

  localStorage.setItem('tdr2:trackKey', this.trackKey);

  // ========================================
  // Time Trial: histórico de vueltas (por pista) — máx 500
  // ========================================
  this.ttHistKey = `tdr2:ttHist:${this.trackKey}`;
  this.ttHistory = [];

  try {
    const raw = localStorage.getItem(this.ttHistKey);
    const parsed = raw ? JSON.parse(raw) : null;
    const arr = parsed?.history;
    if (Array.isArray(arr)) {
      this.ttHistory = arr
        .filter(r => r && Number.isFinite(r.lapMs))
        .slice(-500);
    }
  } catch (e) {
    this.ttHistory = [];
  }

  // ========================================
  // Time Trial: best lap + splits por pista
  // ========================================
  this.ttKey = `tdr2:ttBest:${this.trackKey}`; // por pista
  this.ttBest = null;

  try {
    const raw = localStorage.getItem(this.ttKey);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Number.isFinite(parsed.lapMs)) {
      this.ttBest = {
        lapMs: parsed.lapMs,
        s1: Number.isFinite(parsed.s1) ? parsed.s1 : null,
        s2: Number.isFinite(parsed.s2) ? parsed.s2 : null
      };
    }
  } catch (e) {
    this.ttBest = null;
  }

  // 2) Base spec (factorySpec tiene prioridad)
  this.baseSpec = this._useFactorySpec
    ? this.factorySpec
    : (CAR_SPECS[this.carId] || CAR_SPECS.stock);

  // === UPGRADES: cargar niveles por coche (solo si NO es factorySpec) ===
  const defaultUpgrades = { engine: 0, brakes: 0, tires: 0 };
  const upgradesKey = `tdr2:upgrades:${this.carId}`;

  if (!this._useFactorySpec) {
    try {
      this.upgrades = JSON.parse(localStorage.getItem(upgradesKey) || 'null') || defaultUpgrades;
    } catch {
      this.upgrades = defaultUpgrades;
    }
  } else {
    // En Test Drive de fábrica: upgrades neutros y no persistentes
    this.upgrades = defaultUpgrades;
  }

  // Convierte niveles -> “tornillos” (mantengo tus números originales)
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

      // Neumáticos (si resolveCarParams los usa, perfecto; si no, se ignoran)
      gripDriveAdd: tiresLv * 0.02,
      gripCoastAdd: tiresLv * 0.01,
      gripBrakeAdd: tiresLv * 0.015
    };
  };

  // ===============================
  // DEV TUNING (localStorage) — overrides en caliente
  // ===============================
  this._devTuneKey = 'tdr2:devTune:v1';

  // Defaults (mínimos y seguros)
  this._devTuning = {
    accelMult: 1.0,
    maxFwdAdd: 0,
    brakeMult: 1.0,
    dragMult: 1.0,
    turnRateMult: 1.0,
    turnMinAdd: 0,
    maxRevAdd: 0,
    gripDriveAdd: 0,
    gripCoastAdd: 0,
    gripBrakeAdd: 0
  };

  // Load (si existe)
  try {
    const raw = localStorage.getItem(this._devTuneKey);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      // Solo copiar claves conocidas (evita basura)
      for (const k of Object.keys(this._devTuning)) {
        if (Number.isFinite(parsed[k])) this._devTuning[k] = parsed[k];
      }
    }
  } catch {}

  // Helpers
  this._saveDevTuning = () => {
    try { localStorage.setItem(this._devTuneKey, JSON.stringify(this._devTuning)); } catch {}
  };

  this._resetDevTuning = () => {
    this._devTuning.accelMult = 1.0;
    this._devTuning.maxFwdAdd = 0;
    this._devTuning.brakeMult = 1.0;
    this._devTuning.dragMult = 1.0;
    this._devTuning.turnRateMult = 1.0;
    this._devTuning.turnMinAdd = 0;
    this._devTuning.maxRevAdd = 0;
    this._devTuning.gripDriveAdd = 0;
    this._devTuning.gripCoastAdd = 0;
    this._devTuning.gripBrakeAdd = 0;
    this._saveDevTuning();
  };

  // Tuning derivado desde upgrades
  this.tuningBase = tuningFromUpgrades(this.upgrades);
  // tuning final = upgrades + devTuning (dev manda por encima)
  this.tuning = { ...this.tuningBase, ...this._devTuning };

  // Helper para aplicar params al “motor”
  this.applyCarParams = () => {
    // Recalcular tuning final en cada apply (por si cambió devTuning)
    this.tuning = { ...this.tuningBase, ...this._devTuning };
    this.carParams = resolveCarParams(this.baseSpec, this.tuning);

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

  // Guardar upgrades (en factorySpec: no persistimos)
  this._saveUpgrades = () => {
    if (this._useFactorySpec) return;
    try { localStorage.setItem(upgradesKey, JSON.stringify(this.upgrades)); } catch {}
  };

  // Comprar upgrades
  this.buyUpgrade = (kind) => {
    const cap = this.UPGRADE_CAPS[kind] ?? 0;
    const cur = this.upgrades[kind] ?? 0;
    if (cur >= cap) return false;

    this.upgrades[kind] = cur + 1;
    this._saveUpgrades();

    this.tuningBase = tuningFromUpgrades(this.upgrades);
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
  // Si existe pero ya fue destruido al cambiar de escena, lo recreamos
  if (!this._dbgText || !this._dbgText.scene) {
    this._dbgText = this.add.text(12, 130, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffcc66',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(5000);
  }
  this._dbgText.setText(String(msg));
}
    _hudLog(msg) {
    // Logs en pantalla (mata-logs friendly)
    try { this._dbg(String(msg)); } catch {}
  }
  create() {
    // -------------------------------------------------
// RESET DURO DE ESTADO (obligatorio al volver del menú)
// -------------------------------------------------
this._trackBuilt = false;
this._trackInitialized = false;
this._trackContainer = null;
this._chunks = null;
this._cells = null;
this._visibleTiles = null;
    // FIX: si venimos del menú, puede quedar un rig viejo (y la cámara seguirlo mal)
try { if (this.carRig?.scene) this.carRig.destroy(true); } catch (e) {}
this.carRig = null;
    // Alias compatible con código viejo
    this._dbgSet = (m) => this._dbg(m);
 // Limpieza al salir de RaceScene (evita refs a objetos destruidos al volver del menú)
this.events.off(Phaser.Scenes.Events.SHUTDOWN, this._onShutdownRaceScene, this);

this._onShutdownRaceScene = () => {
  // 0) SUPER IMPORTANTE: limpiar listeners de input de la Scene
  // (touch controls + gesto DEV + etc). Si no, en 2ª entrada quedan “viejos”
  // y revientan con refs muertas.
  try { this.input.removeAllListeners(); } catch (e) {}

  // También limpia el postupdate que usamos para debug (DEV)
  try { this.events.removeAllListeners('postupdate'); } catch (e) {}

  // 1) Quitar listeners de resize (si no, se duplican al reentrar)
  if (this._onResizeSpeedHud) this.scale.off('resize', this._onResizeSpeedHud);
  if (this._reflowStartModal) this.scale.off('resize', this._reflowStartModal);
  if (this._onResizeUiCam) this.scale.off('resize', this._onResizeUiCam);
  if (this._onResizeDevModal) this.scale.off('resize', this._onResizeDevModal);
  if (this._onResizeTTPanel) this.scale.off('resize', this._onResizeTTPanel);
  // 1b) Touch UI container (si existe) — evita que queden objetos colgando
  try { if (this.touchUI?.scene) this.touchUI.destroy(true); } catch (e) {}
  this.touchUI = null;
  this.touch = null;

  // 1c) DEV touch dbg
  try { if (this._touchDbg?.scene) this._touchDbg.destroy(); } catch (e) {}
  this._touchDbg = null;

  // 2) Debug text
  this._dbgText = null;

  // 3) Modal semáforo refs
  this._startModalBg = null;

  // 4) Destruir HUD GPS para evitar “doble HUD” / layouts rotos en 2ª entrada
  if (this.speedHud) {
    const list = [
      this.speedHud.base,
      this.speedHud.speedText,
      this.speedHud.unitText,
      this.speedHud.clockText,
    ].filter(Boolean);

    list.forEach(o => {
      try { if (o.scene) o.destroy(); } catch (e) {}
    });

    this.speedHud.base = null;
    this.speedHud.speedText = null;
    this.speedHud.unitText = null;
    this.speedHud.clockText = null;
    this.speedHud.built = false;
  }
};
this.events.once(Phaser.Scenes.Events.SHUTDOWN, this._onShutdownRaceScene, this);
    
    // 1) Track meta primero (define world real)
let t01;
if (this.trackKey === 'track01') t01 = makeTrack01Oval();
else if (this.trackKey === 'track02') t01 = makeTrack02Technical();
else if (this.trackKey === 'track03') t01 = makeTrack03Drift();
else t01 = makeTrack02Technical(); // fallback seguro

const spec = this.baseSpec || CAR_SPECS.stock;
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
try { this.ensureOffTexture(); } catch (e) {}   // ← NUEVO (OFF visual)
try {
  this.ensureAsphaltTexture();
  this.ensureAsphaltOverlayTexture();
  this._dbg('asphalt OK');
} catch (e) {
  this._dbg('asphalt ERROR');
}
try { this.ensureCarTexture(); } catch (e) {}

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

// Escala del coche según spec (prep en carSpecs.js)
const vScale = (spec?.visualScale ?? 1.0);

// Colisión: si quieres que el camión “ocupe pista”, esto es CLAVE
const baseRadius = 14;
body.setCircle(Math.round(baseRadius * vScale));
// Aumento SOLO visual del coche (no afecta a físicas)
const VISUAL_SCALE_MULT = 1.35;
body.setCollideWorldBounds(true);
body.setBounce(0);
body.setDrag(0, 0);
body.rotation = t01.start.r;

// Sprite visual: por defecto usa procedural 'car' (fallback seguro)
const carSprite = this.add.sprite(0, 0, 'car');

// 👇 Ancla el punto “ruedas delanteras” al (0,0) del container.
// Como estás rotando el sprite con Math.PI/2, normalmente el “morro” queda hacia la derecha.
// Este origin hace que el pivot esté adelantado (tren delantero).
carSprite.setOrigin(0.78, 0.50);

// Sin offsets: el pivot lo define el origin
carSprite.x = 0;
carSprite.y = 0;

// Orientación: dejamos el sprite “neutro” y aplicamos el offset al rig.
// Así SOLO rota el rig (pivot consistente entre skins).
this._carVisualRotOffset = Math.PI / 2;

// Tamaño objetivo “caja” en pista (NO fuerza proporción, solo limita)
const TARGET_W = 96 * vScale * VISUAL_SCALE_MULT;
const TARGET_H = 48 * vScale * VISUAL_SCALE_MULT;

// Escala uniforme para que NO se deforme (fit inside box)
const fitSpriteToBox = () => {
  const sw = carSprite.width || 1;
  const sh = carSprite.height || 1;
  const s = Math.min(TARGET_W / sw, TARGET_H / sh);
  carSprite.setScale(s);
};

// Ajuste inicial con el procedural
fitSpriteToBox();

// Sin offsets: el pivot lo marca el origin
carSprite.x = 0;
carSprite.y = 0;

// Rotación del sprite a 0 (rotará el rig)
carSprite.rotation = 0;
const rig = this.add.container(body.x, body.y, [carSprite]);
rig.setDepth(30);

this.carBody = body;
this.carRig = rig;
this.car = body; // compat con tu update()

// Skin runtime: si existe, sustituye la textura del sprite sin romper nada
this.ensureCarSkinTexture(spec).then((texKey) => {
  if (!texKey) return;

carSprite.setTexture(texKey);
carSprite.setOrigin(0.78, 0.50);
// El sprite sigue neutro: rota el rig
carSprite.rotation = 0;

// Refit sin deformar (misma caja objetivo)
fitSpriteToBox();
});

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
    // TT: métricas de centerline (progreso por distancia, corrige óvalo)
this._initTTCenterlineMetrics();

// =========================
// 3) Fondo del mundo: OFF + GRASS BAND
// =========================

// OFF: cubre todo el mundo (arena / tierra)
this.bgOff = this.add.tileSprite(
  0, 0,
  this.worldW,
  this.worldH,
  'off'
)
  .setOrigin(0, 0)
  .setScrollFactor(1)
  .setDepth(-100);

// GRASS: se verá SOLO donde exista la banda GRASS
this.bgGrass = this.add.tileSprite(
  0, 0,
  this.worldW,
  this.worldH,
  'grass'
)
  .setOrigin(0, 0)
  .setScrollFactor(1)
  .setDepth(-90);

// ===============================
// GRASS MASK (solo afecta a bgGrass)
// ===============================
const gMaskGfx = this.make.graphics({ x: 0, y: 0, add: false });
gMaskGfx.fillStyle(0xffffff, 1);

const grassCells = this.track?.geom?.grass?.cells;

if (grassCells) {
  for (const cell of grassCells.values()) {
    for (const poly of cell.polys) {
      if (!poly || poly.length < 3) continue;

      gMaskGfx.beginPath();
      gMaskGfx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        gMaskGfx.lineTo(poly[i].x, poly[i].y);
      }
      gMaskGfx.closePath();
      gMaskGfx.fillPath();
      // Engordar máscara 2px para tapar “hairline seams” entre celdas
gMaskGfx.lineStyle(3, 0xffffff, 1);
gMaskGfx.strokePath();
gMaskGfx.lineStyle(); // reset
    }
  }
}

const grassMask = gMaskGfx.createGeometryMask();

// ⚠️ CRÍTICO: la UI camera NO debe ver esta máscara
this.uiCam?.ignore?.(gMaskGfx);

// Aplicar SOLO al grass
this.bgGrass.setMask(grassMask);

// Guardamos referencias por si en el futuro queremos limpiar / rehacer
this._grassMaskGfx = gMaskGfx;
this._grassMask = grassMask;

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
// ================================
// Líneas del borde: INSET dentro del asfalto (arcén visual antes del césped)
// - Sigue siendo TRACK físicamente (solo cambiamos dónde pintamos la línea)
// ================================
const halfW = (this.track?.meta?.trackWidth ?? 300) * 0.5;
const shoulderPx = this.track?.meta?.shoulderPx ?? 28; // ← punto de ataque (px hacia dentro)
const tInset = Math.max(0, Math.min(1, shoulderPx / Math.max(1, halfW)));

const centerPts = this.track.geom.center; // [[x,y], ...]
const insetTowardCenter = (edgePts) => {
  if (!edgePts || !centerPts || edgePts.length !== centerPts.length) return edgePts;
  const out = new Array(edgePts.length);
  for (let i = 0; i < edgePts.length; i++) {
    const e = edgePts[i];
    const c = centerPts[i];
    out[i] = [
      e[0] + (c[0] - e[0]) * tInset,
      e[1] + (c[1] - e[1]) * tInset
    ];
  }
  return out;
};

const leftInset = insetTowardCenter(this.track.geom.left);
const rightInset = insetTowardCenter(this.track.geom.right);

this._borderLeft = drawPolylineClosed(leftInset, 4, 0xf2f2f2, 0.8);
this._borderRight = drawPolylineClosed(rightInset, 4, 0xf2f2f2, 0.8);

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

  // Longitud total + distancias acumuladas (incluye cierre)
  const cum = new Array(pts.length).fill(0);
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    total += Math.hypot(dx, dy);
    cum[i] = total;
  }
  if (total <= 0) return null;

  // -------------------------------------------------
  // ANCLA: el 0% es la META (finish line), no pts0[0]
  // -------------------------------------------------
  const finish = t01.finish || t01.finishLine;
  let startDist = 0;

  if (finish?.a && finish?.b) {
    const midX = (finish.a.x + finish.b.x) * 0.5;
    const midY = (finish.a.y + finish.b.y) * 0.5;

    // punto de centerline más cercano a la meta
    let bestI = 0;
    let bestD2 = Infinity;
    for (let i = 0; i < pts0.length; i++) {
      const dx = pts0[i].x - midX;
      const dy = pts0[i].y - midY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; bestI = i; }
    }

    // startDist: distancia acumulada hasta ese punto (cum está alineado con pts0)
    startDist = cum[bestI] || 0;
  }

  // target = META + frac * total, con wrap
  const target = (startDist + total * frac01) % total;

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

  // Tangente local (mirar hacia delante)
  const p0 = pts[Math.max(0, idx - 1)];
  const p1 = pts[idx];
  const p2 = pts[Math.min(pts.length - 1, idx + 1)];

  // Tangente suavizada usando p0->p2
  let tx = p2.x - p0.x;
  let ty = p2.y - p0.y;
  const tLen = Math.hypot(tx, ty) || 1;
  tx /= tLen; ty /= tLen;

  // Perpendicular
  const px = -ty;
  const py = tx;

  // Punto medio interpolado dentro del segmento (p0->p1)
  const segDx = p1.x - p0.x;
  const segDy = p1.y - p0.y;
  const segLen = Math.hypot(segDx, segDy) || 1;
  const remain = Math.max(0, target - acc);
  const u = Math.min(1, remain / segLen);

  const mid = { x: p0.x + segDx * u, y: p0.y + segDy * u };

  // Largo del gate
  const half = (t01.trackWidth || 300) * 0.75;
  const a = { x: mid.x - px * half, y: mid.y - py * half };
  const b = { x: mid.x + px * half, y: mid.y + py * half };

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

// 7) Cámara (FIX: 2ª entrada puede quedarse en (0,0))
this.cameras.main.stopFollow();
this.cameras.main.setScroll(0, 0);

this.cameras.main.startFollow(this.carRig, true, 0.12, 0.12);
this.cameras.main.setZoom(this.zoom);
this.cameras.main.roundPixels = true;

// Snap inmediato al coche (si no, puedes quedarte viendo el off en (0,0))
this.cameras.main.centerOn(this.carBody.x, this.carBody.y);

// iOS: a veces el follow no “engancha” hasta el siguiente tick al reentrar
this.time.delayedCall(0, () => {
  if (!this.carRig || !this.carBody) return;
  this.cameras.main.startFollow(this.carRig, true, 0.12, 0.12);
  this.cameras.main.centerOn(this.carBody.x, this.carBody.y);
});

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


// =================================================
// Time Trial HUD v1.2 (VISUAL) — zona superior only
// =================================================
this.ttHud = {};
// Color del crono (solo cambia al pasar CPs/META)
this._ttHudColor = '#F2F2F2'; // blanco por defecto
this._setTTHudColor = (hex) => {
  this._ttHudColor = hex;
  if (this.ttHud?.timeText) this.ttHud.timeText.setColor(hex);
};
this.ttHud.elapsedMs = 0;         // cronómetro
this.ttHud.progress01 = 0;        // 0..1
    
const safeTop = 12;
const safeLeft = 12;
// Formato TT: M:SS.xx (centésimas)
this._fmtTT2 = (ms) => {
  if (!Number.isFinite(ms)) return '--:--.--';
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const cs = Math.floor((t % 1000) / 10);
  return `${m}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
};
// --- A) Tiempo principal (top-center)
this.ttHud.timeText = this.add.text(this.scale.width / 2, safeTop + 6, '0:00.00', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '34px',              // principal
  fontStyle: '600',
  color: '#F2F2F2'
})
  .setOrigin(0.5, 0)
  .setScrollFactor(0)
  .setDepth(2000);

// micro-sombra suave
this.ttHud.timeText.setShadow(0, 1, '#000000', 2, false, true);
this._setTTHudColor(this.ttBest ? '#F2F2F2' : '#F2F2F2'); // de momento igual, pero deja la ruta clara
// --- B) Vuelta (top-left)
this.ttHud.lapText = this.add.text(safeLeft, safeTop + 10, 'VUELTA 1', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '14px',
  fontStyle: '600',
  color: '#CFCFCF'
})
  .setOrigin(0, 0)
  .setAlpha(0.85)
  .setScrollFactor(0)
  .setDepth(2000);

this.ttHud.lapText.setShadow(0, 1, '#000000', 2, false, true);

// --- C) Barra progreso + ticks (debajo de vuelta)
const barX = safeLeft;
const barY = safeTop + 32;
const barW = 120;      // reducido para no invadir el crono
const barH = 2;

this.ttHud.bar = { barX, barY, barW, barH };

// Base gris
this.ttHud.barBase = this.add.rectangle(barX, barY, barW, barH, 0x555555, 0.60)
  .setOrigin(0, 0.5)
  .setScrollFactor(0)
  .setDepth(1999);

// “Slider” (bloque deslizante, look racing pro)
this.ttHud.barSlider = this.add.rectangle(barX, barY, 10, 6, 0xF2F2F2, 0.90)
  .setOrigin(0.5, 0.5)
  .setScrollFactor(0)
  .setDepth(2001);

// Ticks estáticos (4 marcas: salida, CP1, CP2, meta)
this.ttHud.ticksGfx = this.add.graphics()
  .setScrollFactor(0)
  .setDepth(2002);

const tickColor = 0xAAAAAA;
const tickAlpha = 0.70;
const tickH = 8;
const tickW = 2;

// 4 ticks fijos: 0%, 33%, 66%, 100%
const tickXs = [
  barX,
  barX + Math.floor(barW * 0.333),
  barX + Math.floor(barW * 0.666),
  barX + barW
];

this.ttHud.ticksGfx.clear();
this.ttHud.ticksGfx.fillStyle(tickColor, tickAlpha);
for (const tx of tickXs) {
  this.ttHud.ticksGfx.fillRect(Math.floor(tx - tickW / 2), Math.floor(barY - tickH / 2), tickW, tickH);
}
// --- Mejor tiempo (siempre visible) debajo de la barra
const bestMs = this.ttBest?.lapMs;
this.ttHud.bestLapText = this.add.text(barX, barY + 10, `MEJOR ${this._fmtTT2(bestMs)}`, {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '12px',
  fontStyle: '800',
  color: '#CFCFCF'
})
  .setOrigin(0, 0)
  .setAlpha(0.85)
  .setScrollFactor(0)
  .setDepth(2000);

this.ttHud.bestLapText.setShadow(0, 1, '#000000', 2, false, true);
// Fade-in suave (100–150ms)
this.ttHud.timeText.setAlpha(0);
this.ttHud.lapText.setAlpha(0);
this.ttHud.barBase.setAlpha(0);
this.ttHud.barSlider.setAlpha(0);
this.ttHud.ticksGfx.setAlpha(0);

this.tweens.add({
  targets: [this.ttHud.timeText, this.ttHud.lapText, this.ttHud.barBase, this.ttHud.barSlider, this.ttHud.ticksGfx],
  alpha: 1,
  duration: 140,
  ease: 'Sine.easeOut'
});

// Mantener posición correcta si hay RESIZE
this.scale.on('resize', (gameSize) => {
  if (this.ttHud?.timeText) this.ttHud.timeText.setX(gameSize.width / 2);
});
// =================================================
// SPEED HUD v1 (km/h) — bottom center
// =================================================
const spdPadB = 12;
const spdY = this.scale.height - spdPadB;

this.speedHudBg = this.add.rectangle(
  this.scale.width / 2,
  spdY,
  140,
  54,
  0x000000,
  0.55
)
  .setOrigin(0.5, 1)
  .setScrollFactor(0)
  .setDepth(1205);

// Texto grande (velocidad)
this.speedHudText = this.add.text(
  this.scale.width / 2,
  spdY - 36,
  '0',
  {
    fontFamily: 'Orbitron, system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '28px',
    color: '#ffffff',
    fontStyle: '800'
  }
)
  .setOrigin(0.5, 0)
  .setScrollFactor(0)
  .setDepth(1206);

// Unidad
this.speedHudUnit = this.add.text(
  this.scale.width / 2,
  spdY - 14,
  'km/h',
  {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '12px',
    color: '#dfe6ff'
  }
)
  .setOrigin(0.5, 0)
  .setScrollFactor(0)
  .setDepth(1206);

// Reposicionar en resize / rotación
this.scale.on('resize', (gs) => {
  if (!this.speedHudBg) return;

  const y = gs.height - spdPadB;

  this.speedHudBg.setPosition(gs.width / 2, y);
  this.speedHudText.setPosition(gs.width / 2, y - 36);
  this.speedHudUnit.setPosition(gs.width / 2, y - 14);
});
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
// ===============================
// DEV BUTTONS (mínimo viable)
// ===============================
const mkBtn = (x, y, label, onClick) => {
  const b = this.add.text(x, y, label, {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '12px',
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.10)',
    padding: { left: 6, right: 6, top: 3, bottom: 3 }
  })
    .setScrollFactor(0)
    .setDepth(1100)
    .setInteractive({ useHandCursor: true });

  b.on('pointerdown', () => onClick?.());
  return b;
};

const bx = panelX + 10;
const by = panelY + 146;
/*
// A+ / A- = accelMult
this.devBtnAPlus = mkBtn(bx, by, 'A+', () => {
  this._devTuning.accelMult = Math.min(2.5, this._devTuning.accelMult + 0.05);
  this.applyCarParams();
});
this.devBtnAMinus = mkBtn(bx + 44, by, 'A-', () => {
  this._devTuning.accelMult = Math.max(0.4, this._devTuning.accelMult - 0.05);
  this.applyCarParams();
});

// SAVE / RST
this.devBtnSave = mkBtn(bx + 88, by, 'SAVE', () => {
  this._saveDevTuning();
});
this.devBtnReset = mkBtn(bx + 144, by, 'RST', () => {
  this._resetDevTuning();
  this.applyCarParams();
});

// Registrar para toggle ON/OFF
this._devRegister(this.devBtnAPlus, this.devBtnAMinus, this.devBtnSave, this.devBtnReset);
*/
  // Recolocar logs (_dbgText) dentro del panel (si existe ya)
  if (this._dbgText) {
    this._dbgText.setPosition(panelX + 10, panelY + 120);
    this._dbgText.setDepth(1100);
  }

  // Registrar para toggle ON/OFF
  this._devRegister(this.devBox, this.devTitle, this.devInfo, this._dbgText);
// -------------------------------
// DEV MODAL (Tuning) — FIX total (orden + input + contraste)
// -------------------------------
this._devModalOpen = false;

// Contenedor modal (UI)
this._devModal = this.add.container(0, 0)
  .setScrollFactor(0)
  .setDepth(2200)
  .setVisible(false);

// Fondo (oscurece y cierra si tocas FUERA)
this._devModalBg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.60)
  .setOrigin(0, 0)
  .setInteractive();

// Panel responsive
const mw = this.scale.width;
const mh = this.scale.height;
const mPanelW = Math.min(780, Math.floor(mw * 0.94));
const mPanelH = Math.min(560, Math.floor(mh * 0.88));
const mPanelX = Math.floor((mw - mPanelW) / 2);
const mPanelY = Math.floor((mh - mPanelH) / 2);
// Alturas estructurales
const headerH = 56;
const footerH = 56;

// Área útil de contenido (entre header y footer)
const contentTop = mPanelY + headerH;
const contentBottom = mPanelY + mPanelH - footerH;
// Panel (TRAGA el click para que NO cierre)
this._devModalPanel = this.add.rectangle(mPanelX, mPanelY, mPanelW, mPanelH, 0x0b1324, 0.96)
  .setOrigin(0, 0)
  .setStrokeStyle(2, 0xffffff, 0.22)
  .setInteractive();

this._devModalPanel.on('pointerdown', (p, lx, ly, e) => {
  e?.stopPropagation?.();
});

// Título / hint (más legible en móvil)
this._devModalTitle = this.add.text(mPanelX + 14, mPanelY + 10, 'DEV TUNING', {
  fontFamily: 'Orbitron, monospace',
  fontSize: '16px',
  color: '#ffffff',
  fontStyle: '800'
});

this._devModalHint = this.add.text(mPanelX + 14, mPanelY + 34, 'Ajusta parámetros y prueba en pista', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '12px',
  color: '#dfe6ff'
});

// -------------------------------
// SLIDERS (UI + live values)
// -------------------------------
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const snap = (v, step) => (step ? Math.round(v / step) * step : v);

this._devModalSliders = [];
this._devModalLastApply = 0;

const fmt = (v, step) => {
  if (!step || step >= 1) return String(Math.round(v));
  return Number(v).toFixed(step <= 0.01 ? 2 : 2);
};

const mkSlider = (opts) => {
  const { key, label, min, max, step, x, y, w } = opts;
  const rowH = 34;

  const txtLabel = this.add.text(x, y, label, {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '13px',
    color: '#ffffff'
  });

  const txtVal = this.add.text(x + w - 74, y, '', {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.40)',
    padding: { left: 6, right: 6, top: 2, bottom: 2 }
  });

  const trackY = y + 18;
  const track = this.add.rectangle(x, trackY, w - 110, 8, 0xffffff, 0.22).setOrigin(0, 0.5);
  const fill  = this.add.rectangle(x, trackY, 10, 8, 0xffffff, 0.55).setOrigin(0, 0.5);

  const thumb = this.add.circle(x, trackY, 10, 0xffffff, 0.92)
    .setStrokeStyle(2, 0x000000, 0.25)
    .setInteractive({ useHandCursor: true });

  const setFromValue = (value) => {
    const raw = Number.isFinite(value)
      ? value
      : (Number.isFinite(this._devTuning?.[key]) ? this._devTuning[key] : min);

    const v = Math.max(min, Math.min(max, raw));
    const t = (v - min) / (max - min);

    const px = x + track.width * t;
    thumb.x = px;
    fill.width = Math.max(10, track.width * t);
    txtVal.setText(fmt(v, step));

    this._devTuning[key] = snap(v, step);
  };

  const setFromPointerX = (px) => {
    const t = clamp01((px - x) / track.width);
    const v = min + t * (max - min);
    setFromValue(v);
  };

  setFromValue(this._devTuning[key]);

  // Drag manual (iPhone friendly)
  let dragging = false;

  const onMove = (pointer) => {
    if (!dragging) return;

    setFromPointerX(pointer.worldX);

    const now = performance.now();
    if (now - this._devModalLastApply > 60) {
      this._devModalLastApply = now;
      this.applyCarParams?.();
    }
  };

  const stopDrag = () => {
    if (!dragging) return;
    dragging = false;
    this.input.off('pointermove', onMove);
  };

  thumb.on('pointerdown', (pointer, lx, ly, e) => {
    e?.stopPropagation?.();
    dragging = true;
    setFromPointerX(pointer.worldX);
    this.applyCarParams?.();

    this.input.on('pointermove', onMove);

    const onUp = (pp, ex, ey, ee) => {
      ee?.stopPropagation?.();
      this.input.off('pointerup', onUp);
      stopDrag();
    };
    this.input.on('pointerup', onUp);
  });

  // Tap sobre la pista para saltar
  track.setInteractive({ useHandCursor: true });
  track.on('pointerdown', (p, lx, ly, e) => {
    e?.stopPropagation?.();
    setFromPointerX(p.worldX);
    this.applyCarParams?.();
  });

  // Botones - / + finos
  const btnMinus = this.add.text(x + (w - 74), y + 15, '−', {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '16px',
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: { left: 8, right: 8, top: 2, bottom: 2 }
  }).setInteractive({ useHandCursor: true });

  const btnPlus = this.add.text(x + (w - 40), y + 15, '+', {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '16px',
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: { left: 8, right: 8, top: 2, bottom: 2 }
  }).setInteractive({ useHandCursor: true });

  btnMinus.on('pointerdown', (p, lx, ly, e) => {
    e?.stopPropagation?.();
    setFromValue((this._devTuning[key] ?? 0) - (step || 1));
    this.applyCarParams?.();
  });

  btnPlus.on('pointerdown', (p, lx, ly, e) => {
    e?.stopPropagation?.();
    setFromValue((this._devTuning[key] ?? 0) + (step || 1));
    this.applyCarParams?.();
  });

  const items = [txtLabel, txtVal, track, fill, thumb, btnMinus, btnPlus];
  const sync = () => setFromValue(this._devTuning[key]);

  return { key, items, sync, yBottom: y + rowH };
};

// Para sincronizar todos al abrir modal
this._devModalSync = () => {
  for (const s of this._devModalSliders) s.sync?.();
};

// -------------------------------
// Layout: área de contenido + footer fijo (sin scroll todavía)
// -------------------------------

const btnY = mPanelY + mPanelH - footerH + 12;


// Container SOLO para sliders (así no hay rects invisibles bloqueando)
this._devModalContent = this.add.container(0, 0);

// Panel de sliders (compacto)
const sx = mPanelX + 14;
let sy = contentTop + 10;
const sw = mPanelW - 28;

// Definiciones
const sliderDefs = [
  { key: 'accelMult',     label: 'Aceleración (accelMult)',   min: 0.40, max: 2.50, step: 0.05 },
  { key: 'dragMult',      label: 'Drag (dragMult)',           min: 0.40, max: 2.50, step: 0.05 }, 
  { key: 'maxFwdAdd',     label: 'Vel máx + (px/s)',          min: 0, max: 400, step: 5 },
  { key: 'maxRevAdd',     label: 'Vel rev + (px/s)',          min: 0, max: 200, step: 5 },
  { key: 'turnRateMult',  label: 'Giro (turnRateMult)',       min: 0.40, max: 2.50, step: 0.05 },
  { key: 'gripAdd',       label: 'Grip + (gripAdd)',          min: -0.40, max: 0.80, step: 0.02 },
  { key: 'driftAdd',      label: 'Drift + (driftAdd)',        min: -0.20, max: 0.50, step: 0.02 },
  { key: 'brakeMult',     label: 'Freno (brakeMult)',         min: 0.40, max: 2.50, step: 0.05 },
  { key: 'camberAdd',     label: 'Camber + (camberAdd)',      min: -0.20, max: 0.20, step: 0.01 }
];

for (const d of sliderDefs) {
  const s = mkSlider({ ...d, x: sx, y: sy, w: sw });
  this._devModalContent.add(s.items);
  this._devModalSliders.push(s);
  sy = s.yBottom;
}

// Si se sale del panel, por ahora lo dejamos (Paso 4 reintroduce scroll seguro)
if (sy > contentBottom) {
  // opcional: podríamos reducir spacing aquí en el futuro
}

// -------------------------------
// Botonera inferior (SIEMPRE visible)
// -------------------------------
const mkModalBtn = (x, label, onClick) => {
  const b = this.add.text(x, btnY, label, {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '13px',
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: { left: 10, right: 10, top: 6, bottom: 6 }
  }).setInteractive({ useHandCursor: true });

  b.on('pointerdown', (p, lx, ly, e) => {
    e?.stopPropagation?.();
    onClick?.();
  });

  return b;
};

this._devModalBtnApply = mkModalBtn(mPanelX + 14, 'APPLY', () => {
  this.applyCarParams?.();
  this._setDevModal(false);
});

this._devModalBtnSave = mkModalBtn(mPanelX + 92, 'SAVE', () => {
  this._saveDevTuning?.();
});

this._devModalBtnReset = mkModalBtn(mPanelX + 164, 'RESET', () => {
  this._resetDevTuning?.();     // resetea valores
  this._devModalSync?.();       // sincroniza sliders inmediatamente
  this.applyCarParams?.();      // aplica al coche YA
});

this._devModalBtnClose = mkModalBtn(mPanelX + mPanelW - 82, 'CLOSE', () => {
  this._setDevModal(false);
});

// -------------------------------
// Orden de dibujo REAL (sin moveTo hacks):
// bg -> panel -> content -> title/hint -> botones
// -------------------------------
this._devModal.add([
  this._devModalBg,
  this._devModalPanel,
  this._devModalContent,
  this._devModalTitle,
  this._devModalHint,
  this._devModalBtnApply,
  this._devModalBtnSave,
  this._devModalBtnReset,
  this._devModalBtnClose
]);

// Funciones abrir/cerrar
this._setDevModal = (open) => {
  this._devModalOpen = !!open;
  this._devModal.setVisible(this._devModalOpen);

  // Cuando modal está abierta, ocultamos el panel DEV para que no moleste
  if (this._devModalOpen) this._setDevVisible(false);

  // Ajustar tamaño si rotas pantalla + sync valores
  if (this._devModalOpen) {
    this._devModalBg.setSize(this.scale.width, this.scale.height);
    this._devModalSync?.();
  }
};

// Cerrar tocando fuera (SOLO bg)
this._devModalBg.on('pointerdown', (p, lx, ly, e) => {
  e?.stopPropagation?.();
  this._setDevModal(false);
});

// Botón para abrir modal de tuning (en el panel DEV)
this.devTuneBtn = this.add.text(panelX + panelW - 54, panelY + 6, 'TUNE', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '12px',
  color: '#ffffff',
  backgroundColor: 'rgba(255,255,255,0.10)',
  padding: { left: 6, right: 6, top: 3, bottom: 3 }
})
  .setScrollFactor(0)
  .setDepth(1101)
  .setInteractive({ useHandCursor: true });

this.devTuneBtn.on('pointerdown', (p, lx, ly, e) => {
  e?.stopPropagation?.();
  this._setDevModal?.(true);
});

// Registrar para toggle ON/OFF
this._devRegister(this.devTuneBtn);

// Responder a resize (rotación) — con handler desmontable
this.scale.off('resize', this._onResizeDevModal);
this._onResizeDevModal = (gameSize) => {
  if (!this._devModalBg || !this._devModalBg.scene) return;
  this._devModalBg.setSize(gameSize.width, gameSize.height);
};
this.scale.on('resize', this._onResizeDevModal);
  
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
this.uiCam.roundPixels = true;
// UI cam: ignorar fondos del mundo y máscaras
if (this.bgOff) this.uiCam.ignore(this.bgOff);
if (this.bgGrass) this.uiCam.ignore(this.bgGrass);
if (this._grassMaskGfx) this.uiCam.ignore(this._grassMaskGfx);

// =================================================
// TIME TRIAL: PANEL DESPLEGABLE (UI) — no toca ttHud
// =================================================
this.ttPanel = {
  shown: false,
  busy: false,
  w: 240,
  h: 160,
  pad: 10,
  xShown: 0,
  xHidden: 0,
  y: 64
};

// Container UI
this.ttPanel.c = this.add.container(0, 0)
  .setScrollFactor(0)
  .setDepth(2005);

// Fondo + borde
this.ttPanel.bg = this.add.rectangle(0, 0, this.ttPanel.w, this.ttPanel.h, 0x000000, 0.50)
  .setOrigin(0, 0)
  .setStrokeStyle(1, 0xffffff, 0.14);

// 3 líneas (grandes, legibles, bold)
this.ttPanel.lastText = this.add.text(14, 16, 'ÚLTIMA  --:--.--', {
  fontFamily: 'Orbitron, monospace',
  fontSize: '18px',
  color: '#FFFFFF',
  fontStyle: '800'
}).setShadow(0, 1, '#000000', 2, false, true);

this.ttPanel.deltaText = this.add.text(14, 60, 'Δ  --:--.--', {
  fontFamily: 'Orbitron, monospace',
  fontSize: '22px',
  color: '#FFFFFF',
  fontStyle: '900'
}).setShadow(0, 1, '#000000', 2, false, true);

this.ttPanel.bestText = this.add.text(14, 108, 'MEJOR  --:--.--', {
  fontFamily: 'Orbitron, monospace',
  fontSize: '18px',
  color: '#FFFFFF',
  fontStyle: '800'
}).setShadow(0, 1, '#000000', 2, false, true);

// Montar
this.ttPanel.c.add([this.ttPanel.bg, this.ttPanel.lastText, this.ttPanel.deltaText, this.ttPanel.bestText]);

// Layout (posición hidden/shown)
this._layoutTTPanel = () => {
  const w = this.scale.width;
  const pad = this.ttPanel.pad;

  this.ttPanel.xShown = w - this.ttPanel.w - pad; // entra desde la derecha
  this.ttPanel.xHidden = w + 6;                   // fuera de pantalla
  this.ttPanel.y = 64;                            // debajo de HUD superior

  const x = this.ttPanel.shown ? this.ttPanel.xShown : this.ttPanel.xHidden;
  this.ttPanel.c.setPosition(x, this.ttPanel.y);
};

this._layoutTTPanel();

// Animaciones (sin recrear nada)
this._showTTPanel = () => {
  if (!this.ttPanel || this.ttPanel.shown || this.ttPanel.busy) return;
  this.ttPanel.busy = true;
  this.ttPanel.shown = true;

  this.ttPanel.c.setVisible(true);

  this.tweens.add({
    targets: this.ttPanel.c,
    x: this.ttPanel.xShown,
    duration: 180,
    ease: 'Sine.easeOut',
    onComplete: () => { this.ttPanel.busy = false; }
  });
};

this._hideTTPanel = () => {
  if (!this.ttPanel || !this.ttPanel.shown || this.ttPanel.busy) return;
  this.ttPanel.busy = true;
  this.ttPanel.shown = false;

  this.tweens.add({
    targets: this.ttPanel.c,
    x: this.ttPanel.xHidden,
    duration: 200,
    ease: 'Sine.easeIn',
    onComplete: () => {
      this.ttPanel.busy = false;
      this.ttPanel.c.setVisible(false);
    }
  });
};

// Auto-layout en resize — con handler desmontable
this.scale.off('resize', this._onResizeTTPanel);
this._onResizeTTPanel = () => {
  this._layoutTTPanel?.();
};
this.scale.on('resize', this._onResizeTTPanel);

// Estado inicial: oculto
this.ttPanel.c.setVisible(false);

// =================================================
// GPS SPEED HUD (abajo-centro) — asset base + textos (SAFE)
// =================================================
this.speedHud = this.speedHud || {};
this.speedHud.key = 'hud_gps_base';
this.speedHud.url = 'assets/ui/hud_gps_base.webp';
this.speedHud.built = false;

// Layout (NO destruye, solo recoloca y re-escala)
this._layoutSpeedHud = () => {
  if (!this.speedHud?.built) return;
  const w = this.scale.width;
  const h = this.scale.height;

  // Más pequeño para no tapar pista (ajusta aquí)
  const marginBottom = 0;
  const baseW = Math.min(360, Math.floor(w * 0.52));

  // Tu PNG es ancho; referencia 1200px (según el asset que pasaste)
  let baseScale = baseW / 1200;
  baseScale = Math.max(0.22, Math.min(0.30, baseScale));

  const x = w / 2;
  const y = h - marginBottom;

  if (this.speedHud.base) {
    this.speedHud.base
      .setPosition(x, y)
      .setScale(baseScale);
  }

  // Tipos proporcionales
  const fontMain = `${Math.max(22, Math.floor(34 * baseScale))}px`;
  const fontSmall = `${Math.max(12, Math.floor(16 * baseScale))}px`;

  if (this.speedHud.speedText) {
    this.speedHud.speedText
      .setPosition(x + (0 * baseScale), y - (58 * baseScale))
      .setFontSize(fontMain);
  }

  if (this.speedHud.unitText) {
    this.speedHud.unitText
      .setPosition(x + (78 * baseScale), y - (60 * baseScale))
      .setFontSize(fontSmall);
  }

  if (this.speedHud.clockText) {
    this.speedHud.clockText
      .setPosition(x + (150 * baseScale), y - (86 * baseScale))
      .setFontSize(fontSmall);
  }
};

// Build (crea una sola vez)
this._buildSpeedHud = () => {
  if (this.speedHud.built) return;
  if (!this.textures.exists(this.speedHud.key)) return; // todavía no cargado

  this.speedHud.built = true;

  // Base
  this.speedHud.base = this.add.image(0, 0, this.speedHud.key)
    .setOrigin(0.5, 1)
    .setScrollFactor(0)
    .setDepth(2000);

  // Textos
  this.speedHud.speedText = this.add.text(0, 0, '0', {
    fontFamily: 'Orbitron, system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '28px',
    color: '#FFFFFF',
    fontStyle: '900'
  })
    .setOrigin(0.5, 1)
    .setScrollFactor(0)
    .setDepth(2001)
    .setShadow(0, 2, '#000000', 3, false, true);

  this.speedHud.unitText = this.add.text(0, 0, 'KM/H', {
    fontFamily: 'Orbitron, system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '14px',
    color: '#CFE8FF',
    fontStyle: '800'
  })
    .setOrigin(0, 1)
    .setScrollFactor(0)
    .setDepth(2001)
    .setShadow(0, 2, '#000000', 3, false, true);

  this.speedHud.clockText = this.add.text(0, 0, '0:00.00', {
    fontFamily: 'Orbitron, system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '14px',
    color: '#FFFFFF',
    fontStyle: '900'
  })
    .setOrigin(1, 1)
    .setScrollFactor(0)
    .setDepth(2001)
    .setShadow(0, 2, '#000000', 3, false, true);
    this.speedHud.clockText.setVisible(false);
  // Que el mundo NO lo pinte (solo UI cam)
  this.cameras.main.ignore([
    this.speedHud.base,
    this.speedHud.speedText,
    this.speedHud.unitText,
    this.speedHud.clockText
  ]);

  this._layoutSpeedHud();
};

// Cargar textura si falta (evento por archivo, NO complete global)
this._ensureSpeedHudLoaded = () => {
  const key = this.speedHud.key;

  if (this.textures.exists(key)) {
    this._buildSpeedHud();
    return;
  }

  const onOk = (loadedKey) => {
    if (loadedKey !== key) return;
    cleanup();
    this._buildSpeedHud();
  };

  const onErr = (fileObj) => {
    if (fileObj?.key !== key) return;
    cleanup();
    // Si falla, no rompemos el juego: simplemente no se muestra
  };

  const cleanup = () => {
    this.load.off(`filecomplete-image-${key}`, onOk);
    this.load.off(Phaser.Loader.Events.LOAD_ERROR, onErr);
  };

  this.load.once(`filecomplete-image-${key}`, onOk);
  this.load.on(Phaser.Loader.Events.LOAD_ERROR, onErr);

  this.load.image(key, this.speedHud.url);
  if (!this.load.isLoading()) this.load.start();
};

this._ensureSpeedHudLoaded();

// Re-layout seguro en resize (NO destruir)
this.scale.off('resize', this._onResizeSpeedHud);
this._onResizeSpeedHud = () => {
  this._layoutSpeedHud?.();
};
this.scale.on('resize', this._onResizeSpeedHud);
    
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

  // Time Trial HUD (solo debe renderizarse en uiCam)
  this.ttHud?.timeText,
  this.ttHud?.lapText,
  this.ttHud?.barBase,
  this.ttHud?.barSlider,
  this.ttHud?.ticksGfx,

  // TT Panel (solo debe renderizarse en uiCam)
  this.ttPanel?.c,
  this.ttPanel?.bg,
  this.ttPanel?.title,
  this.ttPanel?.body,


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

// Mantener tamaño si rota/cambia viewport (SIN duplicar listeners)
this.scale.off('resize', this._onResizeUiCam);
this._onResizeUiCam = (gameSize) => {
  if (!this.uiCam) return;
  this.uiCam.setSize(gameSize.width, gameSize.height);
};
this.scale.on('resize', this._onResizeUiCam);
// =================================================
// START LIGHTS (F1) — modal + bloqueo de coche hasta salida
// =================================================
this._raceStarted = false;

// Ya no esperamos GAS: arrancamos automáticamente
this._startState = 'COUNTDOWN'; // COUNTDOWN -> GO -> RACING
this._prevThrottleDown = false;

// Modal container (UI)
this._startModal = this.add.container(0, 0).setScrollFactor(0).setDepth(2000);

const w = this.scale.width;
const h = this.scale.height;

// Fondo modal (oscurece)
const modalBg = this.add.rectangle(0, 0, w, h, 0x000000, 0.45).setOrigin(0, 0);
this._startModalBg = modalBg;
// Panel RESPONSIVE (en landscape manda la altura)
const panelW = Math.min(760, Math.floor(w * 0.92));
const panelH = Math.min(260, Math.floor(h * 0.42));   // ⬅️ más pequeño en landscape
const panelX = Math.floor((w - panelW) / 2);
const panelY = Math.floor(h * 0.10);
// Texto
this._startTitle = this.add.text(panelX + 18, panelY + 6, 'START', {
  fontFamily: 'Orbitron, monospace',
  fontSize: '18px',
  color: '#ffffff',
  fontStyle: '600'
});

this._startHint = this.add.text(panelX + 18, panelY + 34, 'Prepárate...', {
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
this._startAsset = this.add.image(
  panelX + panelW / 2,
  panelY + Math.floor(panelH * 0.60),
  'start_base'
).setOrigin(0.5, 0.5);

// Escala: limita por ancho Y por alto (clave en landscape)
{
const targetW = Math.min(panelW * 0.88, 640);
const targetH = Math.min(panelH * 0.70, Math.floor(this.scale.height * 0.32));
  const sW = targetW / this._startAsset.width;
  const sH = targetH / this._startAsset.height;
  const s = Math.min(sW, sH);
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

  // Fondo cubre toda la pantalla
  modalBg.setSize(w2, h2);

  // Recalcular panel SIEMPRE (no usar el panelH/panelW antiguos)
  const pw = Math.min(760, Math.floor(w2 * 0.92));
  const ph = Math.min(260, Math.floor(h2 * 0.42)); // mismo criterio que en create
  const px = Math.floor((w2 - pw) / 2);
  const py = Math.floor(h2 * 0.10);

  // Texto
  if (this._startTitle) this._startTitle.setPosition(px + 18, py + 6);
  if (this._startHint) this._startHint.setPosition(px + 18, py + 34);
  if (this._startStatus) this._startStatus.setPosition(px + 18, py + ph - 30);

  // Asset (posición)
  if (this._startAsset) {
    this._startAsset.setPosition(px + pw / 2, py + Math.floor(ph * 0.60));

    // Escala: limitar por ancho Y por alto (clave para que NO se haga gigante)
    const targetW = Math.min(pw * 0.88, 640);
    const targetH = Math.min(ph * 0.70, Math.floor(h2 * 0.32));
    const sW = targetW / this._startAsset.width;
    const sH = targetH / this._startAsset.height;
    const s = Math.min(sW, sH);

    this._startAsset.setScale(s);
  }

  // Reposicionar las luces encima del PNG (si existe el helper)
  try { positionLights(); } catch (e) {}
};

this.scale.on('resize', this._reflowStartModal);

// iOS: al entrar a la escena el tamaño real llega "un pelín después"
this._reflowStartModal();
this.time.delayedCall(0, () => this._reflowStartModal());
this.time.delayedCall(120, () => this._reflowStartModal());    
    // Arranque automático del semáforo al cargar (sin GAS)
this.time.delayedCall(150, () => {
  if (this._startState !== 'COUNTDOWN') this._startState = 'COUNTDOWN';

  if (this._startHint) this._startHint.setText('Mantente listo...');
  if (this._startStatus) {
    this._startStatus.setText('RED LIGHTS');
    this._startStatus.setColor('#ffffff');
  }

  if (this._startAsset) this._startAsset.setTexture('start_base');

  const stepMs = 600;

  for (let i = 1; i <= 6; i++) {
    this.time.delayedCall(stepMs * i, () => {
      if (this._startAsset) this._startAsset.setTexture(`start_l${i}`);
    });
  }

  const randMs = 800 + Math.floor(Math.random() * 700);

  this.time.delayedCall(stepMs * 6 + randMs, () => {
    this._startState = 'GO';

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

    this.time.delayedCall(350, () => {
      this._startState = 'RACING';
      this._raceStarted = true;
      if (this._startModal) this._startModal.setVisible(false);
    });
  });
}); 
// 12) Volver (si testMode => editor, si no => menú)
if (this.keys?.back) {
  this.keys.back.on('down', () => {
    if (this._testMode && this._returnSceneKey) {
      this.scene.start(this._returnSceneKey, this._returnSceneData || {});
    } else {
      this.scene.start('menu');
    }
  });
}
// 12b) Botón táctil MENU (volver al menú)
const menuBtnX = 12;
const menuBtnY = 72; // debajo del HUD superior izquierdo (no molesta cronos/progreso)

this.uiMenuBtn = this.add.text(menuBtnX, menuBtnY, 'MENU', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '12px',
  color: '#ffffff',
  backgroundColor: 'rgba(0,0,0,0.55)',
  padding: { left: 10, right: 10, top: 6, bottom: 6 }
})
  .setOrigin(0, 0)
  .setScrollFactor(0)
  .setDepth(1205)
  .setInteractive({ useHandCursor: true });

this.uiMenuBtn.on('pointerdown', (p, lx, ly, e) => {
  e?.stopPropagation?.();

  // Si el dev modal estuviera abierto, lo cerramos limpio
  if (this._devModalOpen) this._setDevModal(false);

  // Si estamos en testMode, volver al editor del coche
  if (this._testMode && this._returnSceneKey) {
    this.scene.start(this._returnSceneKey, this._returnSceneData || {});
  } else {
    this.scene.start('menu');
  }
});
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
// ==============================
// Time Trial HUD v1.2 — update (provisional)
// (IMPORTANTE: el tiempo NO corre hasta lights out)
// ==============================
if (this.ttHud) {
  const started = !!this.timing?.started && (this.timing?.lapStart != null);

  // Tiempo: si no ha empezado la carrera, se queda en 0
  const nowMs = performance.now();
  const elapsedMs = started ? Math.max(0, nowMs - this.timing.lapStart) : 0;

  this.ttHud.elapsedMs = elapsedMs; // dejamos el valor coherente

  // Formato M:SS.xx (siempre)
  const m = Math.floor(elapsedMs / 60000);
  const s = Math.floor((elapsedMs % 60000) / 1000);
  const cs = Math.floor((elapsedMs % 1000) / 10);
  const txt = `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;

  this.ttHud.timeText.setText(txt);
const lapInProgress = (this.lapCount || 0) + 1; // lapCount = vueltas completadas
this.ttHud.lapText.setText(`VUELTA ${lapInProgress}`);

  // Progreso REAL (0..1) por centerline (solo si hay coche)
  if (this.car) {
    this.ttHud.progress01 = this._computeLapProgress01(this.car.x, this.car.y);
    const { barX, barW, barY } = this.ttHud.bar;
    const px = barX + this.ttHud.progress01 * barW;
    this.ttHud.barSlider.setPosition(px, barY);
  }
}
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

//-------------------//
//-------------------//
    // START LIGHTS: arrancar automáticamente 1 vez
if (!this._startAutoFired && this._startState === 'COUNTDOWN') {
  this._startAutoFired = true;

  if (this._startHint) this._startHint.setText('Mantente listo...');
  if (this._startStatus) {
    this._startStatus.setText('RED LIGHTS');
    this._startStatus.setColor('#ffffff');
  }

  if (this._startAsset) this._startAsset.setTexture('start_base');

  const stepMs = 600;

  for (let i = 1; i <= 6; i++) {
    this.time.delayedCall(stepMs * i, () => {
      if (this._startAsset) this._startAsset.setTexture(`start_l${i}`);
    });
  }

  const randMs = 800 + Math.floor(Math.random() * 700);

  this.time.delayedCall(stepMs * 6 + randMs, () => {
    this._startState = 'GO';

    if (this._startAsset) this._startAsset.setTexture('start_base');

    if (this._startStatus) {
      this._startStatus.setText('GO!');
      this._startStatus.setColor('#2bff88');
    }

    if (this.timing) {
      this.timing.lapStart = performance.now();
      this.timing.started = true;
      this.timing.s1 = null;
      this.timing.s2 = null;
      this.timing.s3 = null;
    }

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
const engineBrake = this.engineBrake ?? 0; // <- IMPORTANTE (evita "engineBrake is not defined")

let maxFwd = this.maxFwd ?? 1; // let (lo vamos a poder penalizar por terreno)
let maxRev = this.maxRev ?? 1;

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
// penalizamos velocidad maxima en ambos sentidos
  maxFwd *= 0.90;
maxRev *= 0.90;
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
// penalizamos velocidad maxima en ambos sentidos
 maxFwd *= 0.75;
maxRev *= 0.75; 
  // 3) drag extra fuerte y estable por tiempo (independiente de FPS)
  //    En ~1s te deja aprox al 18% de velocidad (muy penalizante)
  const extra = Math.pow(0.18, dt);
  body.velocity.x *= extra;
  body.velocity.y *= extra;
}
// Freno motor "global" (coeficiente para suavizar, NO pisa engineBrake del coche)
const engineBrakeCoef = 0.04; // ajustable
// Aceleración / freno (con curva para que cueste llegar a punta)
{
  // velocidad longitudinal (signada)
  const fwdSpeedNow = body.velocity.x * dirX + body.velocity.y * dirY;
  const absFwdNow = Math.abs(fwdSpeedNow);

  // 0..1 respecto a maxFwd (usa maxFwd, no maxSpeed, para que el feeling sea consistente)
  const v01 = clamp(absFwdNow / Math.max(1, maxFwd), 0, 1);

  // Curva de empuje: al principio empuja mucho, al final casi nada
  // (sube el 1.8 si quieres aún MÁS difícil llegar a punta)
  const accelCurve = 1 - Math.pow(v01, 1.8);

  // Empuje efectivo
  const accelEff = accel * accelCurve;

  if (up && !down) {
    body.velocity.x += dirX * accelEff * dt;
    body.velocity.y += dirY * accelEff * dt;
  }

  if (down) {
    body.velocity.x -= dirX * brakeForce * dt;
    body.velocity.y -= dirY * brakeForce * dt;
  }

// Freno motor (solo cuando NO hay gas NI freno)
if (!up && !down && engineBrake > 0) {
  const fwd = body.velocity.x * dirX + body.velocity.y * dirY;

  if (Math.abs(fwd) > 0.0001) {
    // ⚠️ multiplicamos por 0.35 para suavizar
    const dec = engineBrake * 0.05 * dt;

    const newAbs = Math.max(0, Math.abs(fwd) - dec);
    const newFwd = Math.sign(fwd) * newAbs;

    const dv = newFwd - fwd;
    body.velocity.x += dirX * dv;
    body.velocity.y += dirY * dv;
  }
}
  // Drag base (exponencial = estable y suave)
  // Nota: linearDrag sigue mandando, pero ahora se aplica “bien”
  const drag = Math.exp(-linearDrag * dt * 60);
  body.velocity.x *= drag;
  body.velocity.y *= drag;
}
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

// ===============================
// STEERING (por perfil en carParams)
// ===============================

// Perfil de dirección (si por lo que sea no existe, usa fallback ARCADE)
const BASE_STEERING = {
  profile: 'BASE',
  yawSpeedMin: 12,
  steerSat: 0.45,
  lowSpeedSteer: 0.35,
  highSpeedLimit: 0.75,
  lateralGrip: 6
};

const S = (this.carParams && this.carParams.steering) ? this.carParams.steering : BASE_STEERING;

// Velocidad longitudinal (solo avance real)
const forwardSpeed =
  body.velocity.x * dirX +
  body.velocity.y * dirY;

const absFwdSpeed = Math.abs(forwardSpeed);
const speed01 = clamp(absFwdSpeed / maxFwd, 0, 1);

// Rampa hasta “régimen”
const steerT = clamp(speed01 / S.steerSat, 0, 1);
const baseSteer =
  S.lowSpeedSteer + (1 - S.lowSpeedSteer) * steerT;

// Limitación a alta velocidad (estabilidad)
const highSpeedSteer =
  1 - (1 - S.highSpeedLimit) * speed01;

let turnFactor = baseSteer * highSpeedSteer;

// En casi parado: el coche NO rota (ruedas pueden girar, pero no hay yaw real)
if (absFwdSpeed < S.yawSpeedMin) {
  turnFactor *= absFwdSpeed / S.yawSpeedMin;
}

const maxTurn = turnRate * turnFactor; // rad/s

// --------------------------------
// 1) Teclado: volante clásico
// --------------------------------
if (left && !right) this.car.rotation -= maxTurn * dt;
if (right && !left) this.car.rotation += maxTurn * dt;

// --------------------------------
// 2) Táctil: stick (solo si hay avance)
// --------------------------------
const stickMag = Math.sqrt(
  t.stickX * t.stickX + t.stickY * t.stickY
);

if (
  !left &&
  !right &&
  stickMag > 0.15 &&
  absFwdSpeed > S.yawSpeedMin
) {
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

// =======================================
// FRONT-STEER FEEL: reduce slip lateral
// =======================================
const steeringInput =
  (left && !right) ||
  (right && !left) ||
  (stickMag > 0.15);

if (steeringInput) {
  const vx0 = body.velocity.x;
  const vy0 = body.velocity.y;

  // Ejes del coche
  const fx = Math.cos(this.car.rotation);
  const fy = Math.sin(this.car.rotation);
  const rx = -fy;
  const ry = fx;

  // vF = componente forward, vL = componente lateral
  const vF = vx0 * fx + vy0 * fy;
  const vL = vx0 * rx + vy0 * ry;

  const k = clamp((S.lateralGrip || 0) * dt, 0, 1);
  const vL2 = vL * (1 - k);

  body.velocity.x = fx * vF + rx * vL2;
  body.velocity.y = fy * vF + ry * vL2;
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
cell.overlay?.clearMask?.(true);
cell.overlay?.destroy?.();
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

// 1) Asfalto por celda (tileSprite) con UV continuo en mundo
// (evita el “mosaico por chunk” al mover cámara)
const px = Math.round(x - 1);
const py = Math.round(y - 1);

const tile = this.add.image(px, py, 'asphalt')
  .setOrigin(0, 0)
  .setDisplaySize(cellSize + 2, cellSize + 2)
  .setScrollFactor(1)
  .setDepth(10);

const overlay = this.add.image(px, py, 'asphaltOverlay')
  .setOrigin(0, 0)
  .setDisplaySize(cellSize + 2, cellSize + 2)
  .setScrollFactor(1)
  .setDepth(11)
  .setAlpha(ASPHALT_OVERLAY_ALPHA);


// 2) Mask con forma de pista
const maskG = this.make.graphics({ x, y, add: false });

// UI camera no debe renderizar chunks / máscaras
this.uiCam?.ignore?.(tile);
this.uiCam?.ignore?.(maskG);
this.uiCam?.ignore?.(overlay);

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

  const x0 = looksWorld ? (p0.x - px) : p0.x;
const y0 = looksWorld ? (p0.y - py) : p0.y;

  maskG.beginPath();
  maskG.moveTo(x0, y0);

  for (let i = 1; i < poly.length; i++) {
    const pi = getXY(poly[i]);
    if (!Number.isFinite(pi.x) || !Number.isFinite(pi.y)) continue;

    const lx = looksWorld ? (pi.x - px) : pi.x;
const ly = looksWorld ? (pi.y - py) : pi.y;
    maskG.lineTo(lx, ly);
  }

  maskG.closePath();
  maskG.fillPath();
}

// (bordes por celda eliminados: se dibujarán globales fuera del culling)

const mask = maskG.createGeometryMask();
tile.setMask(mask);
overlay.setMask(mask);

cell = { tile, overlay, stroke: null, maskG, mask };

        this.track.gfxByCell.set(k, cell);
      }

if (cell.tile && !cell.tile.visible) cell.tile.setVisible(true);
if (cell.overlay && !cell.overlay.visible) cell.overlay.setVisible(true);
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

    if (this.timing?.lapStart != null) {
      this.timing.s1 = performance.now() - this.timing.lapStart;

      // Color SOLO al cruzar CP1
      if (this.ttBest?.s1 != null) {
        this._setTTHudColor(this.timing.s1 <= this.ttBest.s1 ? '#2ECC71' : '#E74C3C');
      } else {
        this._setTTHudColor('#F2F2F2');
      }
    }
  } else {
    // Si lo pisa fuera de orden, reiniciamos
    this._cpState = 0;
    this._setTTHudColor('#F2F2F2');
  }
  this._cpCooldown1Ms = 500;
}

if (cp2 && this._cpCooldown2Ms === 0 && _crossGate(cp2)) {
  if ((this._cpState || 0) === 1) {
    this._cpState = 2;

    if (this.timing?.lapStart != null) {
      this.timing.s2 = performance.now() - this.timing.lapStart;

      // Color SOLO al cruzar CP2
      if (this.ttBest?.s2 != null) {
        this._setTTHudColor(this.timing.s2 <= this.ttBest.s2 ? '#2ECC71' : '#E74C3C');
      } else {
        this._setTTHudColor('#F2F2F2');
      }
    }
  } else {
    this._cpState = 0;
    this._setTTHudColor('#F2F2F2');
  }
  this._cpCooldown2Ms = 500;
}

// --- 2) meta: SOLO cuenta si cpState==2 ---
if (within && crossed && forward && this._lapCooldownMs === 0) {
  if ((this._cpState || 0) === 2) {
if (this.timing) {
  const now = performance.now();
  const lapTime = now - this.timing.lapStart;
// === TT Panel: captura del best ANTES de actualizar (para delta real)
const prevBestMs = (this.ttBest && Number.isFinite(this.ttBest.lapMs)) ? this.ttBest.lapMs : null;
// ========================================
// Time Trial: guardar vuelta en histórico
// ========================================
if (this.ttHistory && this.ttHistKey) {
  const rec = {
    t: Date.now(),
    lapMs: lapTime,
    s1: Number.isFinite(this.timing.s1) ? this.timing.s1 : null,
    s2: Number.isFinite(this.timing.s2) ? this.timing.s2 : null
  };

  this.ttHistory.push(rec);

  // Limitar a las últimas 500
  if (this.ttHistory.length > 500) {
    this.ttHistory = this.ttHistory.slice(-500);
  }

  try {
    localStorage.setItem(
      this.ttHistKey,
      JSON.stringify({ v: 1, history: this.ttHistory })
    );
  } catch (e) {
    // si falla storage, no rompemos la carrera
  }
}
  // Guarda “last lap”
  this.timing.lastLap = lapTime;

  // Color SOLO al cruzar META (comparación total)
  if (this.ttBest?.lapMs != null) {
    this._setTTHudColor(lapTime <= this.ttBest.lapMs ? '#2ECC71' : '#E74C3C');
  } else {
    this._setTTHudColor('#F2F2F2');
  }

  // Si mejora el total: actualizar best lap + splits (regla estricta)
  const improves = (this.ttBest == null) || (lapTime < this.ttBest.lapMs);
  if (improves) {
    this.ttBest = {
      lapMs: lapTime,
      s1: Number.isFinite(this.timing.s1) ? this.timing.s1 : null,
      s2: Number.isFinite(this.timing.s2) ? this.timing.s2 : null
    };
    try {
      localStorage.setItem(this.ttKey, JSON.stringify(this.ttBest));
      // Actualiza HUD "MEJOR" al instante si existe
    if (this.ttHud?.bestLapText) {
      this.ttHud.bestLapText.setText(`MEJOR ${this._fmtTT2(this.ttBest.lapMs)}`);
    }
    } catch (e) {}
  }

  // Reset de vuelta: arranca nueva vuelta desde ahora
  this.timing.lapStart = now;
  this.timing.s1 = null;
  this.timing.s2 = null;

  // En salida (nuevo lap): volvemos a blanco hasta CP1 (sin parpadeo)
  this._setTTHudColor('#F2F2F2');

  // ========================================
  // TT Panel: actualizar y mostrar (solo al cerrar vuelta)
  // ========================================
if (this.ttPanel?.lastText && this.ttPanel?.deltaText && this.ttPanel?.bestText && this._buildTTReport) {
  const rep = this._buildTTReport();

  const fmt2 = (ms) => {
    if (!Number.isFinite(ms)) return '--:--.--';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${m}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  };

  // Última y mejor
  const last = rep.lastLapMs;
  const best = rep.bestLapMs;

  this.ttPanel.lastText.setText(`ÚLTIMA  ${fmt2(last)}`);
  this.ttPanel.bestText.setText(`MEJOR   ${fmt2(best)}`);

  // Delta vs best (rojo/verde)
  // OJO: delta real contra el best ANTERIOR (si esta vuelta ha sido PB)
  let deltaMs = null;

  const improved = (prevBestMs != null) && Number.isFinite(last) && (last <= prevBestMs);

  if (improved) {
    // delta contra el best anterior (así NO sale 0 siempre)
    deltaMs = last - prevBestMs; // negativo o 0
  } else if (Number.isFinite(last) && Number.isFinite(best)) {
    // fallback: delta vs best actual (cuando NO es PB)
    deltaMs = last - best;
  }

  if (deltaMs == null) {
    this.ttPanel.deltaText.setText(`Δ  --:--.--`);
    this.ttPanel.deltaText.setColor('#FFFFFF');
  } else {
    const sign = deltaMs > 0 ? '+' : '';
    this.ttPanel.deltaText.setText(`Δ  ${sign}${fmt2(Math.abs(deltaMs))}`);

    // rojo si vas peor, verde si vas mejor/igual
    this.ttPanel.deltaText.setColor(deltaMs <= 0 ? '#2ECC71' : '#E74C3C');
  }

  // Enseña 2.2s y se esconde solo
  // Mostrar SOLO si hay "igual o mejor" (delta <= 0)
const shouldShow = (deltaMs != null && deltaMs <= 0);

if (shouldShow) {
  this._showTTPanel?.();
  this.time.delayedCall(2200, () => this._hideTTPanel?.());
}
}
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
// GPS HUD (abajo-centro) — safe (no tocar objetos destruidos)
if (this.speedHud?.speedText?.scene) {
  const v = Math.max(0, Math.round(kmh));
  this.speedHud.speedText.setText(String(v));
}

if (this.speedHud?.clockText?.scene) {
  const t = this.ttHud?.timeText?.text;
  this.speedHud.clockText.setText(t || '0:00.00');
}
// SPEED HUD
if (this.speedHudText) {
  const k = Math.max(0, Math.round(kmh));
  this.speedHudText.setText(String(k));
}
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
  const cam = this.cameras?.main;
  const sx = cam ? Math.round(cam.scrollX) : 0;
  const sy = cam ? Math.round(cam.scrollY) : 0;
  const fx = cam?.followTarget ? 'YES' : 'NO';

  const cx = this.carBody ? Math.round(this.carBody.x) : 0;
  const cy = this.carBody ? Math.round(this.carBody.y) : 0;

  const rigOK = (this.carRig && this.carRig.scene) ? 'YES' : 'NO';
  const rigVis = (this.carRig && this.carRig.visible !== undefined) ? (this.carRig.visible ? 'VIS' : 'HID') : '??';
  const rigA = (this.carRig && this.carRig.alpha !== undefined) ? this.carRig.alpha.toFixed(2) : '??';
  
  this.devInfo.setText(
  `Track: ${this.track?.meta?.id || this.track?.meta?.name || ''}\n` +
  `CP: ${cp} | Lap: ${this.lapCount || 0}\n` +
  `Surface: ${surf}\n` +
  `Cull: ${cull}\n` +
  `Zoom: ${zoom}\n` +
  `Cam: ${sx},${sy} | Follow: ${fx}\n` +
  `Car: ${cx},${cy}\n` +
  `Rig: ${rigOK} | ${rigVis} | a:${rigA}\n` +
  `accelMult: ${this._devTuning?.accelMult?.toFixed?.(2) ?? '1.00'}\n` +
  (carCell ? `Cell: ${carCell}\n` : '') +
  (diag ? `Diag: ${diag}\n` : '') +
  (diag2 ? `Diag2: ${diag2}\n` : '')
);
}
    // Sincronizar rig visual con body físico
    if (this.carRig && this.carBody) {
      this.carRig.x = this.carBody.x;
      this.carRig.y = this.carBody.y;
this.carRig.rotation = this.carBody.rotation + (this._carVisualRotOffset || 0);
    }


  }
ensureOffTexture() {
  const key = 'off';
  const size = 512;

  // ✅ NO borrar en caliente (WebGL). Create-once.
  if (this.textures.exists(key)) return;

  const g = this.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(0x6a5a3a, 1);
  g.fillRect(0, 0, size, size);

  const blobs = 26;
  for (let i = 0; i < blobs; i++) {
    const r = 80 + Math.random() * 210;
    const x = Math.random() * size;
    const y = Math.random() * size;

    const col = (Math.random() > 0.5) ? 0x5a4a31 : 0x7a6a46;
    const alpha = 0.04 + Math.random() * 0.05;

    g.fillStyle(col, alpha);
    g.fillCircle(x, y, r);
  }

  for (let i = 0; i < 8; i++) {
    const r = 60 + Math.random() * 160;
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.fillStyle(0x3f3524, 0.03 + Math.random() * 0.04);
    g.fillCircle(x, y, r);
  }

  g.generateTexture(key, size, size);
  g.destroy();
}

ensureBgTexture() {
  const key = 'grass';
  const size = 512;

  // ✅ NO borrar en caliente (WebGL). Create-once.
  if (this.textures.exists(key)) return;

  const g = this.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(0x2f5e36, 1);
  g.fillRect(0, 0, size, size);

  const blobs = 28;
  for (let i = 0; i < blobs; i++) {
    const r = 70 + Math.random() * 190;
    const x = Math.random() * size;
    const y = Math.random() * size;

    const col = (Math.random() > 0.5) ? 0x355c3b : 0x2b552f;
    const alpha = 0.035 + Math.random() * 0.045;

    g.fillStyle(col, alpha);
    g.fillCircle(x, y, r);
  }

  for (let i = 0; i < 6; i++) {
    const r = 90 + Math.random() * 180;
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.fillStyle(0x4b5a33, 0.02 + Math.random() * 0.03);
    g.fillCircle(x, y, r);
  }

  g.generateTexture(key, size, size);
  g.destroy();
}

ensureAsphaltTexture() {
  const key = 'asphalt';
  const size = 512;

  // ✅ NO borrar en caliente (WebGL). Create-once.
  if (this.textures.exists(key)) return;

  const g = this.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(0x2b2234, 1);
  g.fillRect(0, 0, size, size);

  const patches = 22;
  for (let i = 0; i < patches; i++) {
    const r = 120 + Math.random() * 260;
    const x = Math.random() * size;
    const y = Math.random() * size;

    const col = (Math.random() > 0.5) ? 0x272a30 : 0x33343a;
    const alpha = 0.018 + Math.random() * 0.028;

    g.fillStyle(col, alpha);
    g.fillCircle(x, y, r);
  }

  for (let i = 0; i < 10; i++) {
    const r = 110 + Math.random() * 230;
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.fillStyle(0x1f1f24, 0.012 + Math.random() * 0.02);
    g.fillCircle(x, y, r);
  }

  g.generateTexture(key, size, size);
  g.destroy();
}
  ensureAsphaltOverlayTexture() {
  const key = 'asphaltOverlay';
  const size = 512;

  // ✅ Create-once
  if (this.textures.exists(key)) return;

  const g = this.make.graphics({ x: 0, y: 0, add: false });
  g.clear();

  // Overlay sutil: manchas grandes suaves (sin grano)
  const patches = 18;
  for (let i = 0; i < patches; i++) {
    const r = 140 + Math.random() * 260;
    const x = Math.random() * size;
    const y = Math.random() * size;

    g.fillStyle(0xffffff, 0.06 + Math.random() * 0.08);
    g.fillCircle(x, y, r);
  }

  g.generateTexture(key, size, size);
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

// Ajuste físico del joystick respecto al grip:
// +75% diámetro derecha
// -20% diámetro izquierda
// -20% diámetro arriba
const JOY_OFFSET_X = stickR * (1.5 - 0.4); // = +1.1 * R
const JOY_OFFSET_Y = -stickR * 0.4;        // = -20% diámetro

const baseX = pad + stickR + 10 + JOY_OFFSET_X;
const baseY = h - pad - stickR - 10 + JOY_OFFSET_Y;

state.baseX = baseX;
state.baseY = baseY;

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

ui.add([g, tText, bText]);

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
