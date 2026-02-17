import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export class CarEditorScene extends Phaser.Scene {
  constructor() {
    super('car-editor');
    this._carId = 'stock';

    // factory = carSpecs.js
    this._factory = null;

    // saved = persistente (tdr2:carSpecs:carId)
    this._saved = null;

    // base = factory + saved (lo que ves como “estado actual guardado”)
    this._base = null;

    // override = draft (tdr2:carDraft:carId) - lo que estás tocando ahora
    this._override = null;

    this._tipTimer = null;
    this._techOverlay = null;
    this._techOverlayText = null;
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

    // ============ LOAD SPECS (factory / saved / base / draft) ============
    this._factory = CAR_SPECS[this._carId] || CAR_SPECS.stock;
    this._saved = this._readOverride(this._carId);        // persistente
    this._base = { ...this._factory, ...this._saved };    // estado “guardado”
    this._override = this._readDraft(this._carId);        // borrador actual

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

    // Back (salir sin guardar = descarta draft)
    const back = this.add.text(16, 18, '⬅', {
      fontFamily: 'system-ui',
      fontSize: '26px',
      color: '#fff',
      stroke: '#0a2a6a',
      strokeThickness: 6
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });

    back.on('pointerdown', () => {
      // salir sin guardar: borrar draft
      this._override = {};
      this._writeDraft(this._carId, this._override);
      this._destroyDomPanel();
      this.scene.start('GarageScene', { mode: 'admin' });
    });

// -------- DOM panel (scroll nativo + inputs) --------
this._createDomPanel();

    // -------- Overlay técnico (solo admin) --------
    this._createTechOverlay();
    this._refreshTechOverlay();


// ✅ Overlay técnico (ADMIN)
this._createTechOverlay();

// -------- Botones (Phaser) --------
const btnY = height - 92;

    const saveBtn = this._button(width / 2 - 160, btnY, 140, 54, 'GUARDAR', () => {
      // Guardar = convertir BASE+DRAFT en SAVED (differences vs FACTORY)
      const finalSpec = { ...(this._base || {}), ...(this._override || {}) };
      const factory = this._factory || {};

      const saved = {};
      for (const k of Object.keys(factory)) {
        if (typeof factory[k] !== 'number') continue;
        if (typeof finalSpec[k] !== 'number') continue;
        if (finalSpec[k] !== factory[k]) saved[k] = finalSpec[k];
      }

      this._writeOverride(this._carId, saved);

      // Reset draft tras guardar
      this._override = {};
      this._writeDraft(this._carId, this._override);

      // Recalcular base
      this._saved = saved;
      this._base = { ...this._factory, ...saved };

      this._toast('Guardado ✓');
      this._refreshDomValues(true);
    });

    const testBtn = this._button(width / 2 + 20, btnY, 140, 54, 'TEST', () => {
      // ✅ Mantener borrador para seguir testeando al volver
      this._writeDraft(this._carId, this._override);

      // Spec temporal = base(saved+factory) + draft
      const tempSpec = { ...(this._base || {}), ...(this._override || {}) };

      this._destroyDomPanel();

      this.scene.start('race', {
        carId: this._carId,
        testMode: true,
        factorySpec: tempSpec,
        useFactorySpec: true,
        returnTo: 'car-editor'
      });
    });

    this.add.existing(saveBtn);
    this.add.existing(testBtn);

    // Limpieza al salir (si no, el DOM se queda pegado encima del juego)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._destroyDomPanel());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this._destroyDomPanel());
  }

  // -----------------------------
  // Storage keys
  // -----------------------------
  _lsKey(carId) {
    return `tdr2:carSpecs:${carId}`; // SAVED
  }
  _draftKey(carId) {
    return `tdr2:carDraft:${carId}`; // DRAFT
  }

  // -----------------------------
  // Sanitize (para evitar valores raros)
  // Nota: se aplica al SAVED, NO al draft (draft puede ser “sucio” mientras editas)
  // -----------------------------
  _sanitizeOverride(obj) {
    const base = this._factory || this._base || {};
    const out = {};

    for (const k of Object.keys(base)) {
      if (typeof base[k] !== 'number') continue;

      const raw = obj?.[k];
      const v = Number(raw);
      if (!Number.isFinite(v)) continue;

      if (k === 'visualScale') {
        const clamped = Math.max(0.5, Math.min(2.5, v));
        out[k] = Math.round(clamped * 10) / 10;
        continue;
      }

      if (k === 'linearDrag') {
        const clamped = Math.max(0, Math.min(1, v));
        out[k] = Math.round(clamped * 1000) / 1000;
        continue;
      }

      if (k.startsWith('grip')) {
        const clamped = Math.max(0, Math.min(2, v));
        out[k] = Math.round(clamped * 100) / 100;
        continue;
      }

      if (k === 'dragMult') {
        const clamped = Math.max(0.1, Math.min(5, v));
        out[k] = Math.round(clamped * 100) / 100;
        continue;
      }

      out[k] = (Math.abs(v) < 1) ? Math.round(v * 1000) / 1000 : Math.round(v * 100) / 100;
    }

    return out;
  }

  // -----------------------------
  // SAVED (persistente)
  // -----------------------------
  _readOverride(carId) {
    try {
      const raw = localStorage.getItem(this._lsKey(carId));
      if (!raw) return {};
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return {};
      return this._sanitizeOverride(obj);
    } catch {
      return {};
    }
  }

  _writeOverride(carId, obj) {
    try {
      const clean = this._sanitizeOverride(obj || {});
      localStorage.setItem(this._lsKey(carId), JSON.stringify(clean));
    } catch {}
  }

  // -----------------------------
  // DRAFT (temporal)
  // -----------------------------
  _readDraft(carId) {
    try {
      const raw = localStorage.getItem(this._draftKey(carId));
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : {};
    } catch {
      return {};
    }
  }

  _writeDraft(carId, obj) {
    try {
      const keys = obj && typeof obj === 'object' ? Object.keys(obj) : [];
      if (!keys.length) {
        localStorage.removeItem(this._draftKey(carId));
        return;
      }
      localStorage.setItem(this._draftKey(carId), JSON.stringify(obj || {}));
    } catch {}
  }

  // -----------------------------
  // Editable keys
  // -----------------------------
  _collectEditableNumberKeys() {
    const base = this._base || {};
    const keys = Object.keys(base).filter(k => typeof base[k] === 'number');

    const blacklist = new Set(['collectionNo']);
    const out = keys.filter(k => !blacklist.has(k));

    const pin = ['visualScale', 'dragMult', 'linearDrag', 'accel', 'brakeForce', 'turnRate', 'maxFwd', 'maxRev'];
    out.sort((a, b) => {
      const ia = pin.indexOf(a);
      const ib = pin.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    return out;
  }

  // -----------------------------
  // DOM Panel
  // -----------------------------
  _createDomPanel() {
    const { width, height } = this.scale;

    const topY = 72;
    const bottomSafe = 120;
    const panelW = Math.min(560, width - 24);
    const panelH = Math.max(220, height - topY - bottomSafe);

    const keys = this._collectEditableNumberKeys();

    const specHelp = {
      visualScale: 'Tamaño general del coche en pista.',
      maxFwd: 'Velocidad máxima hacia delante.',
      maxRev: 'Velocidad máxima marcha atrás.',
      accel: 'Qué rápido acelera.',
      brakeForce: 'Fuerza de frenado.',
      engineBrake: 'Retención al soltar acelerador.',
      linearDrag: 'Resistencia general al movimiento.',
      dragMult: 'Multiplicador extra de resistencia.',
      turnRate: 'Velocidad de giro.',
      turnMin: 'Giro mínimo a alta velocidad.',
      gripDrive: 'Agarre lateral acelerando.',
      gripCoast: 'Agarre lateral sin acelerar.',
      gripBrake: 'Agarre lateral frenando.'
    };

    const rows = keys.map(k => {
      const baseVal = this._base[k];
      const curVal = (this._override?.[k] ?? baseVal);
      const delta = curVal - baseVal;
      const deltaTxt = (Math.abs(delta) < 1e-9) ? '0' : (delta > 0 ? `+${delta}` : `${delta}`);

      let step;
      if (k === 'visualScale') step = 0.1;
      else if (k === 'linearDrag') step = 0.001;
      else if (k === 'dragMult') step = 0.05;
      else if (k.startsWith('grip')) step = 0.01;
      else if (Math.abs(baseVal) < 1) step = 0.01;
      else step = 1;

      return `
        <div class="row" data-key="${k}">
          <div class="left">
            <div class="k">
              <span class="kname">${k}</span>
              <button class="infoBtn" type="button" data-act="help" data-key="${k}" aria-label="ayuda">?</button>
            </div>
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
          <button class="mini" data-act="factory">FÁBRICA</button>
          <button class="mini" data-act="clear">CLEAR</button>
        </div>
        <div class="list">
          ${rows}
        </div>
        <div class="tip" style="display:none;"></div>
      </div>
    `;

    this._dom = this.add.dom(12, topY).createFromHTML(html);
    this._dom.setDepth(999999);
    this._dom.setOrigin(0, 0);
    this._dom.x = 12;
    this._dom.y = topY;

    const node = this._dom.node;
    node.style.width = `${panelW}px`;
    node.style.height = `${panelH}px`;

    const style = document.createElement('style');
    style.textContent = `
      .panel{
        width:100%;
        height:100%;
        box-sizing:border-box;
        padding-top:6px;
        background:rgba(20,27,51,0.78);
        border:1px solid rgba(183,192,255,0.18);
        border-radius:14px;
        box-shadow:0 10px 40px rgba(0,0,0,0.35);
        overflow:hidden;
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
        color:#fff;
        -webkit-user-select:none;
        user-select:none;
        position:relative;
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
        font-weight:800;
        padding:0 10px;
      }
      .list{
        height:calc(100% - 56px);
        overflow:auto;
        padding:10px;
        -webkit-overflow-scrolling:touch;
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
      .k{display:flex; align-items:center; gap:10px;}
      .kname{font-weight:900; font-size:14px;}
      .meta{display:flex; gap:10px; font-size:12px; opacity:0.9;}
      .right{display:flex; gap:8px; align-items:center;}
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
        -webkit-user-select:text;
        user-select:text;
        font-size:16px; /* iOS: evita zoom al enfocar */
      }
      /* iOS: evitar zoom por doble-tap dentro del panel */
      .panel, .panel *{
        touch-action: manipulation;
        -webkit-text-size-adjust: 100%;
      }
      .btn, .mini, .infoBtn{
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      .infoBtn{
        width:28px;
        height:28px;
        border-radius:10px;
        border:1px solid rgba(183,192,255,0.25);
        background:rgba(7,16,39,0.55);
        color:#fff;
        font-weight:900;
        font-size:14px;
        line-height:28px;
        padding:0;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        cursor:pointer;
      }
      .infoBtn:active{ transform: scale(0.96); }
      .tip{
        position:absolute;
        left:12px;
        right:12px;
        bottom:12px;
        padding:10px 12px;
        border-radius:12px;
        background:rgba(11,16,32,0.92);
        border:1px solid rgba(43,255,136,0.30);
        box-shadow:0 10px 30px rgba(0,0,0,0.45);
        color:#fff;
        font-size:13px;
        font-weight:800;
        z-index:9999;
      }
    `;

    node.prepend(style);

    const showTip = (text) => {
      const tip = node.querySelector('.tip');
      if (!tip) return;
      tip.textContent = text || '';
      tip.style.display = text ? 'block' : 'none';
      clearTimeout(this._tipTimer);
      this._tipTimer = setTimeout(() => {
        try { tip.style.display = 'none'; } catch {}
      }, 1400);
    };

    // CLICK: botones +/-, help, reset/factory/clear
    node.addEventListener('click', (e) => {
      const t = e.target;
      const act = t?.dataset?.act;
      if (!act) return;

      if (act === 'help') {
        const key = t.dataset.key;
        const msg = (specHelp && key && specHelp[key]) ? specHelp[key] : 'Sin descripción.';
        showTip(msg);
        return;
      }

      if (act === 'resetAll') {
        // reset = descartar draft (volver a base guardado)
        this._override = {};
        this._writeDraft(this._carId, this._override);
        this._refreshDomValues(true);
        this._refreshTechOverlay();   
        this._toast('Draft reseteado');
        return;
      }

      if (act === 'factory') {
        // fábrica = borrar saved + draft
        try { localStorage.removeItem(this._lsKey(this._carId)); } catch {}
        this._override = {};
        this._writeDraft(this._carId, this._override);

        this._saved = {};
        this._base = { ...(this._factory || {}) };

        this._refreshDomValues(true);
        this._toast('Datos de fábrica ✓');
        return;
      }

      if (act === 'clear') {
        // salir sin guardar = descartar draft y volver
        this._override = {};
        this._writeDraft(this._carId, this._override);
        this._destroyDomPanel();
        this.scene.start('GarageScene', { mode: 'admin' });
        return;
      }

      // +/- por fila
      const row = t.closest?.('.row');
      if (!row) return;

      const key = row.getAttribute('data-key');
      const inp = row.querySelector('.inp');
      if (!inp) return;

      const step = Number(inp.getAttribute('data-step') || '1') || 1;
      const baseVal = this._base[key];

      // iOS/ES: "1,1" -> "1.1"
      let raw = String(inp.value ?? '').trim();
      raw = raw.replace(',', '.');

      let v = Number(raw);
      if (!Number.isFinite(v)) v = (this._override?.[key] ?? baseVal);

      if (act === 'inc') v += step;
      if (act === 'dec') v -= step;

      // Redondeo exacto por step
      if (step < 1) {
        const decimals = (String(step).split('.')[1] || '').length || 1;
        const factor = Math.pow(10, decimals);
        v = Math.round(v * factor) / factor;
      } else {
        v = Math.round(v);
      }

      // Clamp “suave” solo para visualScale (evita 4, 99, etc.)
      if (key === 'visualScale') v = clamp(v, 0.5, 2.5);

      inp.value = String(v);
      this._override[key] = v;
      this._writeDraft(this._carId, this._override);
      this._refreshRow(row, key);
    });

    // INPUT: escritura manual -> guardar draft
    node.addEventListener('input', (e) => {
      const inp = e.target;
      if (!inp.classList?.contains('inp')) return;

      const row = inp.closest('.row');
      if (!row) return;

      const key = row.getAttribute('data-key');
      const baseVal = this._base[key];

      let raw = String(inp.value ?? '').trim();
      raw = raw.replace(',', '.');

      let v = Number(raw);
      if (!Number.isFinite(v)) return;

      if (key === 'visualScale') {
        // clamp + redondeo 0.1
        v = clamp(v, 0.5, 2.5);
        v = Math.round(v * 10) / 10;
      }

      this._override[key] = v;
      this._writeDraft(this._carId, this._override);
      this._refreshRow(row, key);
    });

    // Search
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
    this._refreshTechOverlay();
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
    this._refreshTechOverlay();
  }

  // -----------------------------
  // UI helpers
  // -----------------------------
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
    const html = `
      <div class="panel">
        <div class="bar">
          <input class="search" placeholder="Buscar parámetro…" />
          <button class="mini" data-act="resetAll">RESET</button>
          <button class="mini" data-act="factory">FÁBRICA</button>
          <button class="mini" data-act="clear">CLEAR</button>
        </div>
        <div class="list">
          ${rows}
        </div>
        <div class="tip" style="display:none;"></div>
      </div>
    `;

    this._dom = this.add.dom(12, topY).createFromHTML(html);
    this._dom.setDepth(999999);
    this._dom.setOrigin(0, 0);
    this._dom.x = 12;
    this._dom.y = topY;

    const node = this._dom.node;
    node.style.width = `${panelW}px`;
    node.style.height = `${panelH}px`;

    const style = document.createElement('style');
    style.textContent = `
      .panel{
        width:100%;
        height:100%;
        box-sizing:border-box;
        padding-top:6px;
        background:rgba(20,27,51,0.78);
        border:1px solid rgba(183,192,255,0.18);
        border-radius:14px;
        box-shadow:0 10px 40px rgba(0,0,0,0.35);
        overflow:hidden;
        font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
        color:#fff;
        -webkit-user-select:none;
        user-select:none;
        position:relative;
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
        font-weight:800;
        padding:0 10px;
      }
      .list{
        height:calc(100% - 56px);
        overflow:auto;
        padding:10px;
        -webkit-overflow-scrolling:touch;
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
      .k{display:flex; align-items:center; gap:10px;}
      .kname{font-weight:900; font-size:14px;}
      .meta{display:flex; gap:10px; font-size:12px; opacity:0.9;}
      .right{display:flex; gap:8px; align-items:center;}
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
        -webkit-user-select:text;
        user-select:text;
        font-size:16px; /* iOS: evita zoom al enfocar */
      }
      /* iOS: evitar zoom por doble-tap dentro del panel */
      .panel, .panel *{
        touch-action: manipulation;
        -webkit-text-size-adjust: 100%;
      }
      .btn, .mini, .infoBtn{
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      .infoBtn{
        width:28px;
        height:28px;
        border-radius:10px;
        border:1px solid rgba(183,192,255,0.25);
        background:rgba(7,16,39,0.55);
        color:#fff;
        font-weight:900;
        font-size:14px;
        line-height:28px;
        padding:0;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        cursor:pointer;
      }
      .infoBtn:active{ transform: scale(0.96); }
      .tip{
        position:absolute;
        left:12px;
        right:12px;
        bottom:12px;
        padding:10px 12px;
        border-radius:12px;
        background:rgba(11,16,32,0.92);
        border:1px solid rgba(43,255,136,0.30);
        box-shadow:0 10px 30px rgba(0,0,0,0.45);
        color:#fff;
        font-size:13px;
        font-weight:800;
        z-index:9999;
      }
    `;

    node.prepend(style);

    const showTip = (text) => {
      const tip = node.querySelector('.tip');
      if (!tip) return;
      tip.textContent = text || '';
      tip.style.display = text ? 'block' : 'none';
      clearTimeout(this._tipTimer);
      this._tipTimer = setTimeout(() => {
        try { tip.style.display = 'none'; } catch {}
      }, 1400);
    };

    // CLICK: botones +/-, help, reset/factory/clear
    node.addEventListener('click', (e) => {
      const t = e.target;
      const act = t?.dataset?.act;
      if (!act) return;

      if (act === 'help') {
        const key = t.dataset.key;
        const msg = (specHelp && key && specHelp[key]) ? specHelp[key] : 'Sin descripción.';
        showTip(msg);
        return;
      }

      if (act === 'resetAll') {
        // reset = descartar draft (volver a base guardado)
        this._override = {};
        this._writeDraft(this._carId, this._override);
        this._refreshDomValues(true);
        this._refreshTechOverlay();   
        this._toast('Draft reseteado');
        return;
      }

      if (act === 'factory') {
        // fábrica = borrar saved + draft
        try { localStorage.removeItem(this._lsKey(this._carId)); } catch {}
        this._override = {};
        this._writeDraft(this._carId, this._override);

        this._saved = {};
        this._base = { ...(this._factory || {}) };

        this._refreshDomValues(true);
        this._toast('Datos de fábrica ✓');
        return;
      }

      if (act === 'clear') {
        // salir sin guardar = descartar draft y volver
        this._override = {};
        this._writeDraft(this._carId, this._override);
        this._destroyDomPanel();
        this.scene.start('GarageScene', { mode: 'admin' });
        return;
      }

      // +/- por fila
      const row = t.closest?.('.row');
      if (!row) return;

      const key = row.getAttribute('data-key');
      const inp = row.querySelector('.inp');
      if (!inp) return;

      const step = Number(inp.getAttribute('data-step') || '1') || 1;
      const baseVal = this._base[key];

      // iOS/ES: "1,1" -> "1.1"
      let raw = String(inp.value ?? '').trim();
      raw = raw.replace(',', '.');

      let v = Number(raw);
      if (!Number.isFinite(v)) v = (this._override?.[key] ?? baseVal);

      if (act === 'inc') v += step;
      if (act === 'dec') v -= step;

      // Redondeo exacto por step
      if (step < 1) {
        const decimals = (String(step).split('.')[1] || '').length || 1;
        const factor = Math.pow(10, decimals);
        v = Math.round(v * factor) / factor;
      } else {
        v = Math.round(v);
      }

      // Clamp “suave” solo para visualScale (evita 4, 99, etc.)
      if (key === 'visualScale') v = clamp(v, 0.5, 2.5);

      inp.value = String(v);
      this._override[key] = v;
      this._writeDraft(this._carId, this._override);
      this._refreshRow(row, key);
    });

    // INPUT: escritura manual -> guardar draft
    node.addEventListener('input', (e) => {
      const inp = e.target;
      if (!inp.classList?.contains('inp')) return;

      const row = inp.closest('.row');
      if (!row) return;

      const key = row.getAttribute('data-key');
      const baseVal = this._base[key];

      let raw = String(inp.value ?? '').trim();
      raw = raw.replace(',', '.');

      let v = Number(raw);
      if (!Number.isFinite(v)) return;

      if (key === 'visualScale') {
        // clamp + redondeo 0.1
        v = clamp(v, 0.5, 2.5);
        v = Math.round(v * 10) / 10;
      }

      this._override[key] = v;
      this._writeDraft(this._carId, this._override);
      this._refreshRow(row, key);
    });

    // Search
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

  // -----------------------------
  // UI helpers
  // -----------------------------
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

  _createTechOverlay() {
    const { width } = this.scale;

    // Conversión consistente con HUD / garage
    // Ajusta este valor UNA vez para todo el juego
    const KMH_PER_PXPS = 0.10;

    // Spec que estás probando AHORA MISMO:
    // base (guardado) + override (draft actual)
    const liveSpec = { ...(this._base || {}), ...(this._override || {}) };

    const fmt = (v, d = 2) => (Number.isFinite(v) ? Number(v).toFixed(d) : '—');

    // Panel (arriba derecha, debajo de ADMIN)
    const x = width - 16;
    const y = 52;

    const lines = [
      'DATOS TÉCNICOS',
      `maxFwd: ${fmt(liveSpec.maxFwd, 1)} px/s  ·  ${fmt(liveSpec.maxFwd * KMH_PER_PXPS, 0)} km/h`,
      `accel: ${fmt(liveSpec.accel, 1)}`,
      `brakeForce: ${fmt(liveSpec.brakeForce, 1)}`,
      `turnRate: ${fmt(liveSpec.turnRate, 2)}`,
      `turnMin: ${fmt(liveSpec.turnMin, 2)}`,
      `gripDrive: ${fmt(liveSpec.gripDrive, 2)}`,
      `gripCoast: ${fmt(liveSpec.gripCoast, 2)}`,
      `gripBrake: ${fmt(liveSpec.gripBrake, 2)}`,
      `linearDrag: ${fmt(liveSpec.linearDrag, 3)}`,
      `dragMult: ${fmt(liveSpec.dragMult, 2)}`
    ];

    // Fondo semitransparente
    const pad = 10;
    const lineH = 14;
    const w = 320;
    const h = pad * 2 + lines.length * lineH;

    // Si existía, lo destruimos antes
    if (this._techOverlay) {
      try { this._techOverlay.destroy(); } catch {}
    }

    this._techOverlay = this.add.container(0, 0).setDepth(999998);

    const bg = this.add.rectangle(x - w, y, w, h, 0x0b1020, 0.65).setOrigin(0, 0);
    bg.setStrokeStyle(1, 0x2bff88, 0.25);

    const text = this.add.text(
  x - w + pad,
  y + pad,
  lines.join('\n'),
  {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '12px',
    color: '#ffffff',
    lineSpacing: 2
  }
).setOrigin(0, 0);

    this._techOverlay.add([bg, text]);
    this._techOverlayText = text;
  }

  _refreshTechOverlay() {
    if (!this._techOverlayText) return;

    const KMH_PER_PXPS = 0.10;
    const liveSpec = { ...(this._base || {}), ...(this._override || {}) };
    const fmt = (v, d = 2) => (Number.isFinite(v) ? Number(v).toFixed(d) : '—');

    const lines = [
      'DATOS TÉCNICOS',
      `maxFwd: ${fmt(liveSpec.maxFwd, 1)} px/s  ·  ${fmt(liveSpec.maxFwd * KMH_PER_PXPS, 0)} km/h`,
      `accel: ${fmt(liveSpec.accel, 1)}`,
      `brakeForce: ${fmt(liveSpec.brakeForce, 1)}`,
      `turnRate: ${fmt(liveSpec.turnRate, 2)}`,
      `turnMin: ${fmt(liveSpec.turnMin, 2)}`,
      `gripDrive: ${fmt(liveSpec.gripDrive, 2)}`,
      `gripCoast: ${fmt(liveSpec.gripCoast, 2)}`,
      `gripBrake: ${fmt(liveSpec.gripBrake, 2)}`,
      `linearDrag: ${fmt(liveSpec.linearDrag, 3)}`,
      `dragMult: ${fmt(liveSpec.dragMult, 2)}`
    ];

    this._techOverlayText.setText(lines.join('\n'));
  }

  _destroyDomPanel() {
    try {
      if (this._dom?.node) this._dom.node.remove();
    } catch {}
    try {
      if (this._dom?.destroy) this._dom.destroy();
    } catch {}
    try { this._techOverlay?.destroy?.(); } catch {}
    this._techOverlay = null;
    this._techOverlayText = null;
    this._techOverlayBg = null;
    this._dom = null;
  }
