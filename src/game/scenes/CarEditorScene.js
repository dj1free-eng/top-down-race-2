import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export class CarEditorScene extends Phaser.Scene {
  constructor() {
    super('car-editor');
    this._carId = 'stock';
    this._base = null;
    this._override = null;
  }

  init(data) {
    this._carId = data?.carId || 'stock';
  }

  create() {
  const { width, height } = this.scale;

  // -------- Fondo estilo lobby (como Menu) --------
  const bg = this.add.graphics();
  bg.fillStyle(0x071027, 1);
  bg.fillRect(0, 0, width, height);

  bg.fillStyle(0x7c4dff, 0.14);
  bg.fillEllipse(width * 0.20, height * 0.22, width * 0.75, height * 0.65);

  bg.fillStyle(0x00d4ff, 0.10);
  bg.fillEllipse(width * 0.70, height * 0.30, width * 0.90, height * 0.70);

  bg.fillStyle(0xffc400, 0.07);
  bg.fillEllipse(width * 0.55, height * 0.12, width * 0.70, height * 0.45);

  bg.fillStyle(0x2bff88, 0.08);
  bg.fillEllipse(width * 0.55, height * 0.70, width * 0.85, height * 0.70);

  bg.fillStyle(0x141b33, 0.18);
  bg.fillRect(0, 0, width, height);

  // rejilla ligera
  bg.lineStyle(1, 0xffffff, 0.02);
  const step = 56;
  for (let x = 0; x <= width; x += step) bg.lineBetween(x, 0, x, height);
  for (let y = 0; y <= height; y += step) bg.lineBetween(0, y, width, y);

  this._base = CAR_SPECS[this._carId] || CAR_SPECS.stock;
  this._override = this._readOverride(this._carId);

  // -------- Header --------
  this.add.text(width / 2, 18, `EDITOR · ${this._base.name || this._carId}`, {
    fontFamily: 'Orbitron, system-ui',
    fontSize: '22px',
    fontStyle: '900',
    color: '#ffffff',
    stroke: '#0a2a6a',
    strokeThickness: 7
  }).setOrigin(0.5, 0);

  this.add.text(width - 16, 22, 'ADMIN', {
    fontFamily: 'system-ui',
    fontSize: '14px',
    color: '#ffffff',
    stroke: '#0a2a6a',
    strokeThickness: 4
  }).setOrigin(1, 0);

  // Back
  const back = this.add.text(16, 18, '⬅', {
    fontFamily: 'system-ui',
    fontSize: '26px',
    color: '#fff',
    stroke: '#0a2a6a',
    strokeThickness: 6
  }).setOrigin(0, 0).setInteractive({ useHandCursor: true });

  back.on('pointerdown', () => {
    this._destroyDomPanel();
    this.scene.start('GarageScene', { mode: 'admin' });
  });

  // -------- DOM panel (scroll nativo + inputs) --------
  this._createDomPanel();

  // -------- Botones (Phaser) --------
  const btnY = height - 92;

  const saveBtn = this._button(width / 2 - 160, btnY, 140, 54, 'GUARDAR', () => {
    this._writeOverride(this._carId, this._override);
    this._toast('Guardado ✓');
    // refresca deltas/valores en DOM
    this._refreshDomValues();
  });

  const testBtn = this._button(width / 2 + 20, btnY, 140, 54, 'TEST', () => {
    this._writeOverride(this._carId, this._override);
    this._destroyDomPanel();
    this.scene.start('race', { carId: this._carId, testMode: true });
  });

  this.add.existing(saveBtn);
  this.add.existing(testBtn);

  // Limpieza al salir (si no, el DOM se queda pegado encima del juego)
  this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._destroyDomPanel());
  this.events.once(Phaser.Scenes.Events.DESTROY, () => this._destroyDomPanel());
}

  _makeSliderRow(x, y, w, f) {
    const label = this.add.text(x, y, f.label, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0);

    const baseVal = this._base?.[f.key];
    const curVal = (this._override?.[f.key] ?? baseVal);

    const valueText = this.add.text(x, y + 22, `${curVal}`, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '13px',
      color: '#b7c0ff'
    }).setOrigin(0, 0);

    // Track
    const trackY = y + 52;
    const track = this.add.rectangle(x, trackY, w, 10, 0x141b33, 0.9).setOrigin(0, 0.5);
    track.setStrokeStyle(1, 0xb7c0ff, 0.2);

    // Knob
    const t = (curVal - f.min) / (f.max - f.min);
    const knobX = x + clamp(t, 0, 1) * w;

    const knob = this.add.circle(knobX, trackY, 12, 0x2bff88, 0.95)
      .setStrokeStyle(2, 0x0b1020, 0.8)
      .setInteractive({ useHandCursor: true });

    const setValueFromPointer = (px) => {
      const tt = clamp((px - x) / w, 0, 1);
      let v = f.min + tt * (f.max - f.min);

      // step
      v = Math.round(v / f.step) * f.step;

      // decimales limpios si step es 0.1
      if (f.step < 1) v = Math.round(v * 10) / 10;

      this._override[f.key] = v;

      valueText.setText(`${v}`);
      knob.x = x + ((v - f.min) / (f.max - f.min)) * w;
    };

    // Drag por todo el track
    const hit = this.add.rectangle(x, trackY - 18, w, 36, 0x000000, 0.001)
      .setOrigin(0, 0)
      .setInteractive();

    hit.on('pointerdown', (p) => setValueFromPointer(p.x));
    hit.on('pointermove', (p) => { if (p.isDown) setValueFromPointer(p.x); });

    return { label, valueText, track, knob, hit };
  }
_setScroll(y) {
  this._scrollY = Phaser.Math.Clamp(y, this._minScroll, 0);
  this._list.y = 70 + this._scrollY;
}
  _button(x, y, w, h, label, onClick) {
    const c = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, w, h, 0x141b33, 0.9).setOrigin(0);
    bg.setStrokeStyle(2, 0x2bff88, 0.55);

    const txt = this.add.text(w / 2, h / 2, label, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0.001)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerdown', () => { c.setScale(0.98); });
    hit.on('pointerup', () => { c.setScale(1.0); onClick && onClick(); });
    hit.on('pointerout', () => { c.setScale(1.0); });

    c.add([bg, txt, hit]);
    return c;
  }

  _toast(msg) {
    const { width, height } = this.scale;
    const t = this.add.text(width / 2, height - 40, msg, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#2bff88',
      fontStyle: 'bold',
      backgroundColor: 'rgba(11,16,32,0.85)',
      padding: { left: 12, right: 12, top: 6, bottom: 6 }
    }).setOrigin(0.5).setAlpha(0).setDepth(999999);

    this.tweens.add({
      targets: t,
      alpha: 1,
      duration: 120,
      yoyo: true,
      hold: 900,
      onComplete: () => t.destroy()
    });
  }

  _lsKey(carId) {
    return `tdr2:carSpecs:${carId}`;
  }

  _readOverride(carId) {
    try {
      const raw = localStorage.getItem(this._lsKey(carId));
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : {};
    } catch {
      return {};
    }
  }

  _writeOverride(carId, obj) {
    try {
      localStorage.setItem(this._lsKey(carId), JSON.stringify(obj || {}));
    } catch {}
  }
  _collectEditableNumberKeys() {
  const base = this._base || {};
  const keys = Object.keys(base).filter(k => typeof base[k] === 'number');

  // Excluir cosas que NO son físicas aunque sean números (si las tuvieras)
  const blacklist = new Set([
    'collectionNo',
    'visualScale'
  ]);

  return keys.filter(k => !blacklist.has(k));
}

_createDomPanel() {
  const { width, height } = this.scale;

const topY = 72;                 // debajo del header
const bottomSafe = 120;          // espacio para botones + iOS
const panelW = Math.min(560, width - 24);
const panelH = Math.max(220, height - topY - bottomSafe);
  const keys = this._collectEditableNumberKeys();

  // HTML rows
  const rows = keys.map(k => {
    const baseVal = this._base[k];
    const curVal = (this._override?.[k] ?? baseVal);
    const delta = curVal - baseVal;
    const deltaTxt = (Math.abs(delta) < 1e-9) ? '0' : (delta > 0 ? `+${delta}` : `${delta}`);

    // step: heurística simple
    const step = (Math.abs(baseVal) < 1) ? 0.01 : 1;

    return `
      <div class="row" data-key="${k}">
        <div class="left">
          <div class="k">${k}</div>
          <div class="meta">
            <span class="b">base: <b>${baseVal}</b></span>
            <span class="d">Δ: <b>${deltaTxt}</b></span>
          </div>
        </div>

        <div class="right">
          <button class="btn" data-act="dec" aria-label="decrement">−</button>
          <input class="inp" inputmode="decimal" value="${curVal}" data-step="${step}" />
          <button class="btn" data-act="inc" aria-label="increment">+</button>
        </div>
      </div>
    `;
  }).join('');

  const html = `
    <div class="panel">
      <div class="bar">
        <input class="search" placeholder="Buscar parámetro…" />
        <button class="mini" data-act="resetAll">RESET</button>
        <button class="mini" data-act="clear">CLEAR</button>
      </div>

      <div class="list">
        ${rows}
      </div>
    </div>
  `;

  // Crear DOM element Phaser
this._dom = this.add.dom(12, topY).createFromHTML(html);
this._dom.setDepth(999999);

// ✅ anclaje top-left (evita “medio panel fuera”)
this._dom.setOrigin(0, 0);
const node = this._dom.node;
node.style.width = `${panelW}px`;
node.style.height = `${panelH}px`;
// ✅ posición y tamaño deterministas
this._dom.x = 12;
this._dom.y = topY;

const node = this._dom.node;
node.style.width = `${panelW}px`;
node.style.height = `${panelH}px`;

// Asegura que el DOM queda centrado y no se escala raro
if (this._dom.setOrigin) this._dom.setOrigin(0.5);
this._dom.x = width / 2;
this._dom.y = topY + panelH / 2;
  // Estilos (inline dentro del DOM container)
  const style = document.createElement('style');
  style.textContent = `
    .panel{
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding-top: 6px;
      background:rgba(20,27,51,0.78);
      border:1px solid rgba(183,192,255,0.18);
      border-radius:14px;
      box-shadow:0 10px 40px rgba(0,0,0,0.35);
      overflow:hidden;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
      color:#fff;
    }
    .bar{
      display:flex;
      gap:10px;
      padding:10px;
      background:rgba(11,16,32,0.55);
      border-bottom:1px solid rgba(183,192,255,0.14);
      align-items:center;
    }
    .search{
      flex:1;
      height:34px;
      border-radius:10px;
      border:1px solid rgba(183,192,255,0.18);
      background:rgba(7,16,39,0.65);
      color:#fff;
      padding:0 10px;
      outline:none;
    }
    .mini{
      height:34px;
      border-radius:10px;
      border:1px solid rgba(43,255,136,0.35);
      background:rgba(20,27,51,0.85);
      color:#fff;
      font-weight:700;
      padding:0 10px;
    }
    .list{
      height:calc(100% - 56px);
      overflow:auto;
      padding:10px;
      -webkit-overflow-scrolling: touch;
    }
    .row{
      display:flex;
      justify-content:space-between;
      gap:10px;
      padding:10px;
      border-radius:12px;
      border:1px solid rgba(183,192,255,0.10);
      background:rgba(7,16,39,0.35);
      margin-bottom:10px;
      align-items:center;
    }
    .k{ font-weight:900; font-size:14px; }
    .meta{ display:flex; gap:10px; font-size:12px; opacity:0.9; }
    .right{ display:flex; gap:8px; align-items:center; }
    .btn{
      width:34px;
      height:34px;
      border-radius:10px;
      border:1px solid rgba(43,255,136,0.35);
      background:rgba(20,27,51,0.85);
      color:#fff;
      font-weight:900;
      font-size:18px;
      line-height:0;
    }
    .inp{
      width:92px;
      height:34px;
      border-radius:10px;
      border:1px solid rgba(183,192,255,0.18);
      background:rgba(7,16,39,0.65);
      color:#fff;
      padding:0 10px;
      outline:none;
      text-align:right;
      font-weight:800;
    }
  `;

  // Inyectar el style en el root del DOM element
  const node = this._dom.node;
  node.prepend(style);

  // Eventos
  node.addEventListener('click', (e) => {
    const t = e.target;
    const act = t?.dataset?.act;
    if (!act) return;

    if (act === 'resetAll') {
      this._override = {};
      this._refreshDomValues(true);
      return;
    }

    if (act === 'clear') {
      // Borra overrides guardados del coche (solo memoria, NO guarda hasta GUARDAR)
      this._override = {};
      this._refreshDomValues(true);
      return;
    }

    // +/- por fila
    const row = t.closest?.('.row');
    if (!row) return;
    const key = row.getAttribute('data-key');
    const inp = row.querySelector('.inp');
    const step = parseFloat(inp.getAttribute('data-step') || '1') || 1;

    const baseVal = this._base[key];
    let v = parseFloat(inp.value);
    if (Number.isNaN(v)) v = (this._override?.[key] ?? baseVal);

    if (act === 'inc') v += step;
    if (act === 'dec') v -= step;

    // redondeo bonito
    v = (step < 1) ? Math.round(v * 100) / 100 : Math.round(v);

    inp.value = String(v);
    this._override[key] = v;
    this._refreshRow(row, key);
  });

  node.addEventListener('input', (e) => {
    const inp = e.target;
    if (!inp.classList?.contains('inp')) return;
    const row = inp.closest('.row');
    const key = row.getAttribute('data-key');

    const v = parseFloat(inp.value);
    if (Number.isNaN(v)) return;

    this._override[key] = v;
    this._refreshRow(row, key);
  });

  // Search filter
  const search = node.querySelector('.search');
  search.addEventListener('input', () => {
    const q = (search.value || '').trim().toLowerCase();
    const items = node.querySelectorAll('.row');
    items.forEach(r => {
      const k = (r.getAttribute('data-key') || '').toLowerCase();
      r.style.display = (!q || k.includes(q)) ? '' : 'none';
    });
  });
}

_refreshRow(row, key) {
  const baseVal = this._base[key];
  const curVal = (this._override?.[key] ?? baseVal);
  const delta = curVal - baseVal;
  const deltaTxt = (Math.abs(delta) < 1e-9) ? '0' : (delta > 0 ? `+${delta}` : `${delta}`);

  const b = row.querySelector('.b b');
  const d = row.querySelector('.d b');
  if (b) b.textContent = String(baseVal);
  if (d) d.textContent = String(deltaTxt);
}

_refreshDomValues(force = false) {
  if (!this._dom?.node) return;
  const node = this._dom.node;

  node.querySelectorAll('.row').forEach(row => {
    const key = row.getAttribute('data-key');
    const baseVal = this._base[key];
    const curVal = (this._override?.[key] ?? baseVal);

    const inp = row.querySelector('.inp');
    if (inp && (force || document.activeElement !== inp)) {
      inp.value = String(curVal);
    }
    this._refreshRow(row, key);
  });
}

_destroyDomPanel() {
  try {
    if (this._dom?.node) {
      this._dom.node.remove();
    }
  } catch {}
  try {
    if (this._dom?.destroy) this._dom.destroy();
  } catch {}
  this._dom = null;
}
}
