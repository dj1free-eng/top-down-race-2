// src/game/dev/CarFactoryScene.js
import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';
import { resolveCarParams } from '../cars/resolveCarParams.js';
import { HANDLING_PROFILES } from '../cars/handlingProfiles.js';
const CAR_SKIN_BASE = 'assets/skins/'; // mismo base que RaceScene
export class CarFactoryScene extends Phaser.Scene {
  constructor() {
    super('factory');
  }
// =========================================
// Skins: carga dinámica por coche (igual que RaceScene)
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
      resolve(null);
    };

    const cleanup = () => {
      this.load.off(`filecomplete-image-${texKey}`, onFileOk);
      this.load.off(Phaser.Loader.Events.LOAD_ERROR, onLoadError);
    };

    this.load.once(`filecomplete-image-${texKey}`, onFileOk);
    this.load.on(Phaser.Loader.Events.LOAD_ERROR, onLoadError);

    this.load.image(texKey, url);
    if (!this.load.isLoading()) this.load.start();
  });
}
  create() {

// ===========================
// FACTORY STATE
// ===========================
this._factoryCar = structuredClone(CAR_SPECS.stock);
this._selectedCarId = null;
this._visualCarId = 'stock'; // qué skin se usa para preview + test drive
    const w = this.scale.width;
    const h = this.scale.height;

    // ===== Fondo “factoría” =====
    this._bg = this.add.graphics();
    this._grid = this.add.graphics();

    const drawBg = () => {
      const w = this.scale.width;
      const h = this.scale.height;

      this._bg.clear();
      // Gradient fake: bandas
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        const col = Phaser.Display.Color.Interpolate.ColorWithColor(
          new Phaser.Display.Color(11, 16, 32),
          new Phaser.Display.Color(8, 10, 18),
          11,
          i
        );
        const c = Phaser.Display.Color.GetColor(col.r, col.g, col.b);
        this._bg.fillStyle(c, 1);
        this._bg.fillRect(0, Math.floor(h * t), w, Math.ceil(h / 12));
      }

      // Glow superior sutil
      this._bg.fillStyle(0x66a3ff, 0.06);
      this._bg.fillRect(0, 0, w, 90);
    };

    this._gridPhase = 0;
    const drawGrid = () => {
      const w = this.scale.width;
      const h = this.scale.height;
      this._grid.clear();

      // rejilla diagonal animada
      const step = 28;
      const phase = this._gridPhase % step;

      this._grid.lineStyle(1, 0xb7c0ff, 0.06);
      for (let x = -h; x < w + h; x += step) {
        this._grid.beginPath();
        this._grid.moveTo(x + phase, 0);
        this._grid.lineTo(x + phase + h, h);
        this._grid.strokePath();
      }

      // línea “conveyor” inferior
      this._grid.lineStyle(2, 0x2cf6ff, 0.12);
      this._grid.beginPath();
      this._grid.moveTo(0, h - 88);
      this._grid.lineTo(w, h - 88);
      this._grid.strokePath();
    };

    // ===== UI Panel =====
    const panel = this.add.rectangle(16, 16, w - 32, h - 32, 0x0b1324, 0.78)
      .setOrigin(0)
      .setStrokeStyle(2, 0xb7c0ff, 0.14);

    const title = this.add.text(32, 28, 'CAR FACTORY', {
      fontFamily: 'Orbitron, system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: '900'
    });

    const sub = this.add.text(32, 52, 'Modo desarrollo · Diseña coches como en una factoría (clonar, pegar, exportar, test drive)', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#dfe6ff'
    });

    // “Badge” estado
    const chip = this.add.rectangle(w - 160, 28, 130, 26, 0x0b1020, 0.70)
      .setOrigin(0)
      .setStrokeStyle(1, 0x2cf6ff, 0.25);
    const chipText = this.add.text(w - 95, 41, 'DEV ADDON', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#2cf6ff',
      fontStyle: '800'
    }).setOrigin(0.5);

    // Botón BACK
    const mkBtn = (x, y, label, onClick) => {
      const r = this.add.rectangle(x, y, 140, 38, 0x0b1020, 0.75)
        .setOrigin(0)
        .setStrokeStyle(1, 0xb7c0ff, 0.18)
        .setInteractive({ useHandCursor: true });

      const t = this.add.text(x + 70, y + 19, label, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: '800'
      }).setOrigin(0.5);

      r.on('pointerdown', () => onClick?.());
      return [r, t];
    };

    const [backR, backT] = mkBtn(32, h - 60, '← MENU', () => {
      this.scene.start('menu');
    });

// ===========================
// LAYOUT (grid limpio)
// ===========================
const M = 16;
const headerH = 76;
const footerH = 70;
const gap = 16;

const uiW = this.scale.width;
const uiH = this.scale.height;

// Responsive: en móvil el catálogo no puede comerse la pantalla
const leftW = Math.round(Phaser.Math.Clamp(uiW * 0.40, 160, 260));

const topY = 16 + headerH;
const bottomY = uiH - 16 - footerH;
const contentH = bottomY - topY;

const leftX = 32;
const leftY = topY;
const leftH = contentH;

const midX = leftX + leftW + gap;
const midY = topY;
const midW = uiW - 32 - midX;
const midH = contentH;

// Mover el botón MENU a footer derecha (para que no choque con catálogo)
backR.setPosition(uiW - 32 - 140, uiH - 60);
backT.setPosition(uiW - 32 - 140 + 70, uiH - 60 + 19);

// ===========================
// CATÁLOGO (con scroll y botones en zona fija)
// ===========================
const left = this.add.rectangle(leftX, leftY, leftW, leftH, 0x000000, 0.20)
  .setOrigin(0)
  .setStrokeStyle(1, 0xb7c0ff, 0.10);

this.add.text(leftX + 12, leftY + 10, 'CATÁLOGO', {
  fontFamily: 'system-ui',
  fontSize: '12px',
  color: '#b7c0ff',
  fontStyle: '800'
});

// Área visible del listado (con máscara)
const listPad = 12;
const listTop = leftY + 34;
const actionsH = 96; // espacio fijo para botones abajo
const listH = leftH - (listTop - leftY) - actionsH;

const maskRect = this.add.rectangle(leftX + listPad, listTop, leftW - listPad * 2, listH, 0x000000, 0)
  .setOrigin(0);

// Container scrolleable
const listContainer = this.add.container(leftX + listPad, listTop);
const mask = maskRect.createGeometryMask();
listContainer.setMask(mask);

// Crear items
const carIds = Object.keys(CAR_SPECS);
this._catalogButtons = [];

let listY = 0;
const rowH = 22;

const setSelectedVisual = () => {
  for (const b of this._catalogButtons) {
    const isSel = b._carId === this._selectedCarId;
    b.setStyle({
      backgroundColor: isSel ? 'rgba(44,246,255,0.22)' : 'rgba(255,255,255,0.05)',
      color: isSel ? '#eaffff' : '#ffffff'
    });
  }
};

for (const id of carIds) {
  const btn = this.add.text(0, listY, id, {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: { left: 6, right: 6, top: 3, bottom: 3 }
  }).setInteractive({ useHandCursor: true });

  btn._carId = id;

  btn.on('pointerdown', () => {
  this._selectedCarId = id;
  this._visualCarId = id; // 👈 importante
  this._factoryCar = structuredClone(CAR_SPECS[id]);
  setSelectedVisual();
  this._refreshPreview?.();
});

  listContainer.add(btn);
  this._catalogButtons.push(btn);
  listY += rowH;
}

// Scroll logic
let scrollY = 0;
const maxScroll = Math.max(0, listY - listH);

const applyScroll = () => {
  scrollY = Phaser.Math.Clamp(scrollY, 0, maxScroll);
  listContainer.y = listTop - scrollY;
};

applyScroll();

// Wheel scroll (desktop)
this.input.on('wheel', (pointer, gameObjects, dx, dy) => {
  // Solo si el puntero está encima del panel izquierdo
  const px = pointer.worldX;
  const py = pointer.worldY;
  const inside =
    px >= leftX && px <= leftX + leftW &&
    py >= listTop && py <= listTop + listH;

  if (!inside) return;

  scrollY += dy * 0.6;
  applyScroll();
});

// Drag scroll (móvil)
let dragging = false;
let dragStartY = 0;
let dragStartScroll = 0;

maskRect.setInteractive({ draggable: true });
maskRect.on('pointerdown', (p) => {
  dragging = true;
  dragStartY = p.y;
  dragStartScroll = scrollY;
});
this.input.on('pointerup', () => { dragging = false; });
this.input.on('pointermove', (p) => {
  if (!dragging) return;
  const delta = (p.y - dragStartY);
  scrollY = dragStartScroll - delta;
  applyScroll();
});

// Separador acciones
const actionsY = leftY + leftH - actionsH + 8;

this.add.rectangle(leftX + 10, actionsY - 10, leftW - 20, 1, 0xb7c0ff, 0.10)
  .setOrigin(0);

// Botones de acciones (fijos abajo, sin pisar listado)
const actionBtnW = leftW - 24;
const mkWideBtn = (x, y, label, onClick) => {
  const r = this.add.rectangle(x, y, actionBtnW, 36, 0x0b1020, 0.80)
    .setOrigin(0)
    .setStrokeStyle(1, 0x2cf6ff, 0.22)
    .setInteractive({ useHandCursor: true });

  const t = this.add.text(x + actionBtnW / 2, y + 18, label, {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '12px',
    color: '#eaffff',
    fontStyle: '800'
  }).setOrigin(0.5);

  r.on('pointerdown', () => onClick?.());
  return [r, t];
};

const [newR, newT] = mkWideBtn(leftX + 12, leftY + leftH - 80, 'NEW BASE', () => {
  this._factoryCar = structuredClone(CAR_SPECS.stock);
  this._factoryCar.id = 'new_car';
  this._factoryCar.name = 'New Car';
  this._selectedCarId = null;
  this._visualCarId = 'stock';
  setSelectedVisual();
  this._refreshPreview?.();
});

const [cloneR, cloneT] = mkWideBtn(leftX + 12, leftY + leftH - 40, 'CLONAR SELECCIONADO', () => {
  if (!this._selectedCarId) return;
  this._factoryCar = structuredClone(CAR_SPECS[this._selectedCarId]);
  this._factoryCar.id += '_mk1';
  this._factoryCar.name += ' MK1';
  this._visualCarId = this._selectedCarId;
  setSelectedVisual();
  this._refreshPreview?.();
});

// ===========================
// PANEL CENTRAL (usa el nuevo layout)
// ===========================
const mid = this.add.rectangle(midX, midY, midW, midH, 0x000000, 0.14)
  .setOrigin(0)
  .setStrokeStyle(1, 0xb7c0ff, 0.08);

const midT = this.add.text(midX + 12, midY + 10, 'ZONA DE MONTAJE (preview + parámetros)', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '12px',
  color: '#b7c0ff',
  fontStyle: '800'
});
const infoW = 240; // ancho reservado para texto/editor (antes de usarlo)
    
// =========================================
// SPEC EDITOR (panel pro, sin solapes)
// =========================================
const inspectorX = midX + 16;
const inspectorY = midY + 84;
const inspectorW = infoW - 28;  // encaja con el “infoW” que ya reservaste
const inspectorH = midH - (inspectorY - midY) - 16;

this.add.text(inspectorX, inspectorY - 22, 'SPEC EDITOR', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '12px',
  color: '#b7c0ff',
  fontStyle: '900'
});

this.add.rectangle(inspectorX, inspectorY, inspectorW, inspectorH, 0x000000, 0.10)
  .setOrigin(0)
  .setStrokeStyle(1, 0xb7c0ff, 0.08);

// helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtNum = (n) => (Number.isFinite(n) ? (Math.round(n * 1000) / 1000).toString() : '—');

const CATEGORIES = ['sport', 'rally', 'drift', 'truck', 'classic', 'concept'];
const RARITIES   = ['common', 'rare', 'epic', 'legendary'];
const PROFILES   = Object.keys(HANDLING_PROFILES || { default: true });

const isTextField = (k) => ['id','name','brand','country','skin'].includes(k);
const isPickField = (k) => ['category','rarity','handlingProfile'].includes(k);

const NUM_LIMITS = {
  maxFwd:      [0, 9999],
  maxRev:      [0, 9999],
  accel:       [0, 9999],
  brakeForce:  [0, 9999],
  engineBrake: [0, 9999],
  linearDrag:  [0, 5],
  turnRate:    [0, 20],
  turnMin:     [0, 10],
  gripCoast:   [0, 1],
  gripDrive:   [0, 1],
  gripBrake:   [0, 1],
};

const promptText = (title, def) => {
  const v = window.prompt(title, def ?? '');
  if (v == null) return null;
  return String(v);
};

const promptNumber = (title, def, min, max) => {
  const raw = window.prompt(`${title}\n(${min} → ${max})`, String(def ?? ''));
  if (raw == null) return null;
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return clamp(n, min, max);
};

const cyclePick = (arr, current) => {
  const idx = arr.indexOf(current);
  const next = idx === -1 ? arr[0] : arr[(idx + 1) % arr.length];
  return next;
};

// fila UI
const mkRow = (y, label, key) => {
  const rowH = 26;

  const hit = this.add.rectangle(inspectorX, y, inspectorW, rowH, 0x000000, 0.001)
    .setOrigin(0)
    .setInteractive({ useHandCursor: true });

  const l = this.add.text(inspectorX + 8, y + rowH / 2, label, {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '11px',
    color: '#dfe6ff',
    fontStyle: '800'
  }).setOrigin(0, 0.5);
const colLabelX = inspectorX + 14;
const colEditX = inspectorX + inspectorW - 14;
const colValueX = colEditX - 70;
const v = this.add.text(colValueX, y + rowH / 2, '', {
  fontFamily: 'monospace',
  fontSize: '11px',
  color: '#eaffff'
}).setOrigin(1, 0.5);

const pillW = 54;
const pillH = 18;

const pillCX = colEditX - pillW / 2;
const pillCY = y + rowH / 2;

const pill = this.add.rectangle(pillCX, pillCY, pillW, pillH, 0x2cf6ff, 0.10)
  .setOrigin(0.5)
  .setStrokeStyle(1, 0x2cf6ff, 0.20);

const pillT = this.add.text(pillCX, pillCY, 'EDIT', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '9px',
  color: '#b7ffff',
  fontStyle: '900'
}).setOrigin(0.5);
  
  hit.on('pointerdown', () => {
   
    const s = this._factoryCar || {};
    if (!s) return;

    // dropdowns por ciclo (rápido y sin teclado)
    if (key === 'category') {
      s.category = cyclePick(CATEGORIES, String(s.category || 'sport'));
      this._refreshPreview?.();
      toast('🧩 category actualizado');
      return;
    }
    if (key === 'rarity') {
      s.rarity = cyclePick(RARITIES, String(s.rarity || 'common'));
      this._refreshPreview?.();
      toast('✨ rarity actualizado');
      return;
    }
    if (key === 'handlingProfile') {
      const base = String(s.handlingProfile || 'default');
      s.handlingProfile = cyclePick(PROFILES.length ? PROFILES : ['default'], base);
      this._refreshPreview?.();
      toast('🧠 handlingProfile actualizado');
      return;
    }

    // texto
    if (isTextField(key)) {
      const next = promptText(`Editar ${key}`, s[key] ?? '');
      if (next == null) return;

      // id: limpia mínimo para evitar espacios raros
      if (key === 'id') {
        s.id = next.trim().toLowerCase().replace(/\s+/g, '_') || s.id;
      } else {
        s[key] = next.trim();
      }

      this._refreshPreview?.();
      toast(`✍️ ${key} actualizado`);
      return;
    }

    // número
    const lim = NUM_LIMITS[key];
    const min = lim ? lim[0] : -999999;
    const max = lim ? lim[1] :  999999;

    const nextN = promptNumber(`Editar ${key}`, s[key], min, max);
    if (nextN == null) return;

    s[key] = nextN;
    this._refreshPreview?.();
    toast(`🎛 ${key} actualizado`);
  });

  return { key, valueText: v, hit, labelText: l, pill, pillT };
};

// Layout filas
this._inspectorRows = {};
let iy = inspectorY + 10;

// Grupo: identidad
const mkGroup = (title) => {
  this.add.text(inspectorX + 8, iy, title, {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '10px',
    color: '#b7c0ff',
    fontStyle: '900'
  });
  iy += 18;
  this.add.rectangle(inspectorX + 8, iy, inspectorW - 16, 1, 0xb7c0ff, 0.10).setOrigin(0);
  iy += 8;
};

mkGroup('IDENTIDAD');
for (const [lbl, key] of [
  ['id', 'id'],
  ['name', 'name'],
  ['brand', 'brand'],
  ['country', 'country'],
  ['skin file', 'skin'],
]) {
  this._inspectorRows[key] = mkRow(iy, lbl, key);
  iy += 26;
}

mkGroup('META');
for (const [lbl, key] of [
  ['category (tap ciclo)', 'category'],
  ['rarity (tap ciclo)', 'rarity'],
  ['handlingProfile (tap ciclo)', 'handlingProfile'],
]) {
  this._inspectorRows[key] = mkRow(iy, lbl, key);
  iy += 26;
}

mkGroup('HANDLING');
for (const [lbl, key] of [
  ['maxFwd', 'maxFwd'],
  ['maxRev', 'maxRev'],
  ['accel', 'accel'],
  ['brakeForce', 'brakeForce'],
  ['engineBrake', 'engineBrake'],
  ['linearDrag', 'linearDrag'],
  ['turnRate', 'turnRate'],
  ['turnMin', 'turnMin'],
  ['gripCoast', 'gripCoast'],
  ['gripDrive', 'gripDrive'],
  ['gripBrake', 'gripBrake'],
]) {
  this._inspectorRows[key] = mkRow(iy, lbl, key);
  iy += 26;
}

// texto mini “stats” (opcional) — se queda dentro del inspector, arriba a la derecha
this._previewText = this.add.text(inspectorX + 8, inspectorY + inspectorH - 64, '', {
  fontFamily: 'monospace',
  fontSize: '11px',
  color: '#ffffff',
  lineSpacing: 4
});

// Sync desde _refreshPreview (se define aquí y se llama dentro)
this._syncInspector = (p) => {
  if (!this._inspectorRows) return;
  const get = (k) => (p?.[k] ?? this._factoryCar?.[k] ?? '');

  // texto
  for (const k of ['id','name','brand','country','skin','category','rarity','handlingProfile']) {
    const row = this._inspectorRows[k];
    if (!row) continue;
    row.valueText.setText(String(get(k) || '—'));
  }

  // nums
  for (const k of Object.keys(NUM_LIMITS)) {
    const row = this._inspectorRows[k];
    if (!row) continue;
    row.valueText.setText(fmtNum(Number(get(k))));
  }

  // mini stats abajo (bonito y compacto)
  if (this._previewText) {
    this._previewText.setText(
      `MAX: ${fmtNum(p.maxFwd)}  ACC: ${fmtNum(p.accel)}\n` +
      `TURN: ${fmtNum(p.turnRate)}  GRIP: ${fmtNum(p.gripDrive)}`
    );
  }
};
// ===========================
// ACTION BAR (panel central)
// ===========================
const actionH = 46;

// Bandeja superior derecha (contenedor)
const actionX = midX + midW - 12;
const actionY = midY + 34;

// Helper botón compacto (para barra)
const mkActionBtn = (label, onClick, w = 112) => {
  const h = 30;

  const r = this.add.rectangle(0, 0, w, h, 0x0b1020, 0.85)
    .setOrigin(1, 0) // anclado a la derecha
    .setStrokeStyle(1, 0x2cf6ff, 0.22)
    .setInteractive({ useHandCursor: true });

  const t = this.add.text(-w / 2, h / 2, label, {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '11px',
    color: '#eaffff',
    fontStyle: '800'
  }).setOrigin(0.5);

  r.on('pointerdown', () => onClick?.());

  const c = this.add.container(0, 0, [r, t]);
  return c;
};

// Toast simple (feedback en pantalla)
if (!this._toastText) {
  this._toastText = this.add.text(midX + 14, midY + actionH, '', {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '12px',
    color: '#eaffff',
    backgroundColor: 'rgba(44,246,255,0.10)',
    padding: { left: 8, right: 8, top: 6, bottom: 6 }
  }).setOrigin(0, 0).setAlpha(0);
}

const toast = (msg) => {
  this._toastText.setText(msg);
  this._toastText.setAlpha(1);
  this.tweens.killTweensOf(this._toastText);
  this.tweens.add({
    targets: this._toastText,
    alpha: 0,
    duration: 900,
    delay: 700
  });
};

// Normaliza el spec para exportarlo a carSpecs (solo campos relevantes)
const normalizeSpecForCarSpecs = (spec) => {
  const s = spec || {};
  return {
    id: String(s.id || 'new_car'),
    name: String(s.name || 'New Car'),
    brand: String(s.brand || ''),
    country: String(s.country || ''),
    category: String(s.category || 'sport'),
    rarity: String(s.rarity || 'common'),
    handlingProfile: String(s.handlingProfile || 'default'),
    skin: s.skin ? String(s.skin) : undefined,
    maxFwd: Number(s.maxFwd ?? 460),
    maxRev: Number(s.maxRev ?? 220),
    accel: Number(s.accel ?? 640),
    brakeForce: Number(s.brakeForce ?? 920),
    engineBrake: Number(s.engineBrake ?? 520),
    linearDrag: Number(s.linearDrag ?? 0.70),

    turnRate: Number(s.turnRate ?? 3.4),
    turnMin: Number(s.turnMin ?? 0.9),

    gripCoast: Number(s.gripCoast ?? 0.055),
    gripDrive: Number(s.gripDrive ?? 0.060),
    gripBrake: Number(s.gripBrake ?? 0.050),
  };
};

const exportCarSpecText = () => {
  const clean = normalizeSpecForCarSpecs(this._factoryCar);
  // Formato listo para pegar en carSpecs.js (objeto)
  return JSON.stringify(clean, null, 2);
};

const writeClipboard = async (txt) => {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(txt);
      return true;
    }
  } catch {}
  return false;
};

const readClipboard = async () => {
  try {
    if (navigator?.clipboard?.readText) {
      return await navigator.clipboard.readText();
    }
  } catch {}
  return null;
};

// Botonera (derecha a izquierda)
const actions = this.add.container(actionX, actionY);

const btnTest = mkActionBtn('TEST DRIVE', () => {
  if (!this._factoryCar) return;
  // RaceScene ya soporta factorySpec (por el paso anterior)
const driveSpec = normalizeSpecForCarSpecs(this._factoryCar);

// En pista usamos un ID que exista visualmente (skin/texture)
// El ID "real" (new_car) lo sigues teniendo en la fábrica para exportar
const visualId = this._visualCarId || driveSpec.id || 'stock';
driveSpec.id = visualId;

// Importante: RaceScene solo aplica skin si factorySpec trae 'skin'
const skinFile = (CAR_SPECS?.[visualId]?.skin) || this._factoryCar?.skin || null;
if (skinFile) driveSpec.skin = skinFile;

this.scene.start('race', { factorySpec: driveSpec });
}, 120);

const btnExport = mkActionBtn('EXPORT JSON', async () => {
  const txt = exportCarSpecText();
  const ok = await writeClipboard(txt);
  if (ok) toast('✅ Export copiado al portapapeles');
  else {
    // fallback iOS / permisos
    window.prompt('Copia este JSON:', txt);
  }
}, 120);

const btnCopy = mkActionBtn('COPY', async () => {
  const txt = exportCarSpecText();
  const ok = await writeClipboard(txt);
  if (ok) toast('📋 Copiado');
  else window.prompt('Copia el JSON:', txt);
}, 88);

const btnPaste = mkActionBtn('PASTE', async () => {
  let txt = await readClipboard();
  if (!txt) txt = window.prompt('Pega aquí el JSON:');
  if (!txt) return;

  try {
    const obj = JSON.parse(txt);
    // mezcla suave: solo claves conocidas
    const clean = normalizeSpecForCarSpecs({ ...this._factoryCar, ...obj });
    this._factoryCar = clean;
    this._refreshPreview?.();
    toast('📥 Pegado OK');
  } catch {
    toast('❌ JSON inválido');
  }
}, 88);

const btnReset = mkActionBtn('RESET', () => {
  this._factoryCar = structuredClone(CAR_SPECS.stock);
  this._factoryCar.id = 'new_car';
  this._factoryCar.name = 'New Car';
  this._refreshPreview?.();
  toast('↩️ Reset');
}, 88);

// Orden visual: derecha -> izquierda
actions.add(btnTest);
btnTest.x = 0;

actions.add(btnExport);
btnExport.x = -128;

actions.add(btnCopy);
btnCopy.x = -260;

actions.add(btnPaste);
btnPaste.x = -356;

actions.add(btnReset);
btnReset.x = -452;

// Línea divisoria bajo barra acciones
this.add.rectangle(midX + 10, actionY + actionH + 6, midW - 20, 1, 0xb7c0ff, 0.10)
  .setOrigin(0);


// ===========================
// PREVIEW LAYER (showroom)
// ===========================
const previewTop = actionY + actionH + 16;
const previewPad = 16;

// Zona preview (derecha del texto)
const previewX = midX + infoW + previewPad;
const previewY = previewTop;
const previewW = midW - infoW - previewPad * 2;
const previewH = midY + midH - previewTop - previewPad;

// Marco preview
const prevFrame = this.add.rectangle(previewX, previewY, previewW, previewH, 0x000000, 0.10)
  .setOrigin(0)
  .setStrokeStyle(1, 0x2cf6ff, 0.10);

// Glow circular suave (decor)
const glow = this.add.circle(previewX + previewW * 0.62, previewY + previewH * 0.55, Math.min(previewW, previewH) * 0.38, 0x2cf6ff, 0.05);

// Contenedor preview (sprite/placeholder)
this._previewContainer = this.add.container(0, 0);

// Placeholder (si no hay textura)
this._previewPlaceholder = this.add.rectangle(previewX + previewW * 0.65, previewY + previewH * 0.55, 180, 90, 0xffffff, 0.06)
  .setStrokeStyle(1, 0xffffff, 0.12);
this._previewPlaceholder.setAngle(-18);

this._previewPlaceholder2 = this.add.rectangle(previewX + previewW * 0.62, previewY + previewH * 0.55, 180, 90, 0x2cf6ff, 0.06)
  .setStrokeStyle(1, 0x2cf6ff, 0.18);
this._previewPlaceholder2.setAngle(-18);

this._previewCarSprite = null;
// Texto informativo del preview (NO usar _previewText aquí)
this._previewInfoText = this.add.text(previewX + 12, previewY + 30, '', {
  fontFamily: 'monospace',
  fontSize: '12px',
  color: '#ffffff',
  lineSpacing: 6
});
const resolveCarTextureKey = (spec) => {
  if (!spec) return null;

  const visualId = this._visualCarId || spec.id || 'stock';
  const texKey = `car_${visualId}`;

  if (this.textures.exists(texKey)) return texKey;

  return null;
};

// Crear/actualizar preview
this._refreshPreview = () => {
  const spec = this._factoryCar || CAR_SPECS.stock;

  const visualId = this._visualCarId || spec.id || 'stock';
  const skinFile = spec?.skin || CAR_SPECS?.[visualId]?.skin || null;

  const key = resolveCarTextureKey(spec);

  // Debug: qué textura está usando
  if (!this._texKeyText) {
    this._texKeyText = this.add.text(previewX + 12, previewY + 10, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#b7c0ff'
    });
  }
  this._texKeyText.setText(key ? `TEX: ${key}` : 'TEX: (no encontrada)');

  // Texto de info
  const p = normalizeSpecForCarSpecs(spec);
this._syncInspector?.(p);

if (this._previewInfoText) {
  this._previewInfoText.setText(
    `ID: ${p.id}\n` +
    `NAME: ${p.name}\n` +
    `MAX FWD: ${p.maxFwd}\n` +
    `ACCEL: ${p.accel}\n` +
    `TURN: ${p.turnRate}\n` +
    `GRIP: ${p.gripDrive}`
  );
}
  // Si existe sprite previo, destruir
  if (this._previewCarSprite) {
    this._previewCarSprite.destroy();
    this._previewCarSprite = null;
  }

  // Si NO hay textura, intentamos cargarla (runtime) y mientras mostramos placeholder
  if (!key) {
    this._previewPlaceholder.setVisible(true);
    this._previewPlaceholder2.setVisible(true);

    if (skinFile) {
      const texKey = `car_${visualId}`;

      // Evitar spam de carga
      if (this._loadingSkinKey !== texKey && !this.textures.exists(texKey)) {
        this._loadingSkinKey = texKey;

        this.ensureCarSkinTexture({ id: visualId, skin: skinFile }).then((loadedKey) => {
          // Si la escena ya no está activa, no hagas nada
          if (!this.scene?.isActive?.()) return;

          // Limpiar flag
          if (this._loadingSkinKey === texKey) this._loadingSkinKey = null;

          // Si cargó OK, refrescar (ahora key existirá)
          if (loadedKey) this._refreshPreview?.();
        });
      }
    }

    return;
  }

  // Si hay textura, pintar sprite y ocultar placeholder
  this._previewPlaceholder.setVisible(false);
  this._previewPlaceholder2.setVisible(false);

  const centerX = previewX + previewW / 2;
  const centerY = previewY + previewH / 2;

  const s = this.add.image(centerX, centerY, key);
  s.setOrigin(0.5);
  s.setAlpha(0.98);

  const frame = this.textures.getFrame(key);
  const iw = frame ? frame.width : 256;
  const ih = frame ? frame.height : 256;

  const margin = 24;
  const maxW = previewW - margin * 2;
  const maxH = previewH - margin * 2;

  const scale = Math.min(maxW / iw, maxH / ih);
  s.setScale(scale);
  s.setRotation(0);

  this._previewCarSprite = s;
};

// Refresco inicial
this._refreshPreview();
    // “Sello” visual: un foco/halo en el centro como mesa de montaje
    const halo = this.add.circle(Math.floor(w * 0.62), Math.floor(h * 0.52), 160, 0x2cf6ff, 0.05);
    const halo2 = this.add.circle(Math.floor(w * 0.62), Math.floor(h * 0.52), 92, 0x66a3ff, 0.06);

    // Resize
    const onResize = () => {
      drawBg();
      drawGrid();
      // reiniciar scene para simplificar (v1)
      this.scene.restart();
    };
    this.scale.on('resize', onResize);

    // Animación grid
    drawBg();
    drawGrid();

    this.time.addEvent({
      delay: 60,
      loop: true,
      callback: () => {
        this._gridPhase += 1.4;
        drawGrid();
      }
    });

    // Limpieza
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize);
    });
  }
}
