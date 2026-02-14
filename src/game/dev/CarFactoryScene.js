// src/game/dev/CarFactoryScene.js
import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';
import { HANDLING_PROFILES } from '../cars/handlingProfiles.js';

// ---------------------------------------------------------------------------
// CarFactoryScene (B) — “tarjetas + modal”
// - Catálogo scrolleable
// - Preview (sprite + resumen)
// - Editor por pestañas con tarjetas grandes
// - Modal única para editar (slider/picker/texto)
// - Exporta DEFAULT + NAMED (para import { CarFactoryScene } en game.js)
// ---------------------------------------------------------------------------

const CATEGORIES = ['sport', 'rally', 'drift', 'truck', 'classic', 'concept'];
const RARITIES = ['common', 'rare', 'epic', 'legendary'];

const NUM_LIMITS = {
  maxFwd:      { min: 0,   max: 9999, step: 10 },
  maxRev:      { min: 0,   max: 9999, step: 10 },
  accel:       { min: 0,   max: 9999, step: 10 },
  brakeForce:  { min: 0,   max: 9999, step: 10 },
  engineBrake: { min: 0,   max: 9999, step: 10 },
  linearDrag:  { min: 0,   max: 5,    step: 0.01 },
  turnRate:    { min: 0,   max: 20,   step: 0.05 },
  turnMin:     { min: 0,   max: 10,   step: 0.05 },
  gripCoast:   { min: 0,   max: 1,    step: 0.005 },
  gripDrive:   { min: 0,   max: 1,    step: 0.005 },
  gripBrake:   { min: 0,   max: 1,    step: 0.005 },
};

const FIELD_GROUPS = {
  IDENTIDAD: ['id', 'name', 'brand', 'country', 'skin'],
  META: ['category', 'rarity', 'handlingProfile'],
  FÍSICAS: [
    'maxFwd','maxRev','accel','brakeForce','engineBrake','linearDrag',
    'turnRate','turnMin','gripCoast','gripDrive','gripBrake',
  ],
};

const COLORS = {
  bg: 0x0a0e27,
  panelBg: 0x131a2d,
  panelStroke: 0x2a3f5f,
  glow: 0x00d9ff,
  cardBg: 0x1e2740,
  cardStroke: 0x32486a,
  accent: 0xffcc00,
  btnBg: 0x2a3f5f,
  btnHover: 0x35537c,
};

const deepClone = (o) => JSON.parse(JSON.stringify(o));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const fmtNum = (n) => {
  if (!Number.isFinite(n)) return '—';
  return Number(n).toFixed(3).replace(/\.?0+$/, '');
};

export class CarFactoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CarFactoryScene' });

    this._factoryCar = null;
    this._selectedCarId = null;
    this._currentTab = 'IDENTIDAD';

    this._catalogContainer = null;
    this._catalogMaskGfx = null;
    this._catalogItems = [];
    this._catalogScroll = 0;

    this._cardContainer = null;
    this._cardMaskGfx = null;
    this._cards = [];
    this._cardsScroll = 0;

    this._modal = null;
    this._previewSprite = null;
    this._previewText = null;
    this._previewFallback = null;
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, COLORS.bg).setOrigin(0);

    const isMobile = width < 820;
    const pad = 12;

    const leftW = isMobile ? Math.floor(width * 0.34) : 260;
    const midW  = isMobile ? Math.floor(width * 0.30) : 300;
    const rightW = Math.max(260, width - leftW - midW - pad * 4);

    const topH = 56;
    const panelY = topH + pad;
    const panelH = height - panelY - pad;

    this._layout = {
      pad,
      topH,
      left:  { x: pad,                 y: panelY, w: leftW,  h: panelH },
      mid:   { x: pad * 2 + leftW,     y: panelY, w: midW,   h: panelH },
      right: { x: pad * 3 + leftW+midW,y: panelY, w: rightW, h: panelH },
    };

    this._buildTopBar();
    this._buildCatalog();
    this._buildPreview();
    this._buildEditor();

    const first = Object.keys(CAR_SPECS)[0];
    if (first) this._selectCar(first);
  }

  // ========================= TOP BAR =========================
  _buildTopBar() {
    const { width } = this.scale;
    const { pad } = this._layout;

    this.add.text(width / 2, 18, 'CAR FACTORY', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '28px',
      fontStyle: '900',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.add.text(width / 2, 42, 'Modo desarrollo · Diseña coches (clonar, exportar, test drive)', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#a0b0d0',
    }).setOrigin(0.5, 0.5).setAlpha(0.95);

    this._btn(pad, 10, 96, 36, 'MENU', () => this.scene.start('MenuScene'));

    if (this.scene.get('DevAddonScene')) {
      this._btn(width - pad - 120, 10, 120, 36, 'DEV ADDON', () => this.scene.launch('DevAddonScene'));
    }
  }

  // ========================= CATALOG =========================
  _buildCatalog() {
    const { left } = this._layout;

    this._panel(left.x, left.y, left.w, left.h);

    this.add.text(left.x + left.w / 2, left.y + 10, 'CATÁLOGO', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      fontStyle: '900',
      color: '#00d9ff',
    }).setOrigin(0.5, 0);

    const btnW = left.w - 16;
    const bx = left.x + 8;
    let by = left.y + 38;

    this._btn(bx, by, btnW, 36, 'NEW BASE', () => this._newBase(), COLORS.accent, '#000');
    by += 40;
    this._btn(bx, by, btnW, 36, 'CLONE', () => this._clone(), COLORS.btnBg);
    by += 40;
    this._btn(bx, by, btnW, 36, 'EXPORT', () => this._exportJSON(), COLORS.btnBg);
    by += 40;
    this._btn(bx, by, btnW, 36, 'TEST DRIVE', () => this._testDrive(), COLORS.btnBg);

    const listY = by + 46;
    const listH = left.y + left.h - listY - 10;

    this._catalogContainer = this.add.container(0, 0);

    if (this._catalogMaskGfx) this._catalogMaskGfx.destroy();
    this._catalogMaskGfx = this.add.graphics();
    this._catalogMaskGfx.fillStyle(0xffffff, 1);
    this._catalogMaskGfx.fillRect(left.x + 8, listY, left.w - 16, listH);
    this._catalogMaskGfx.setVisible(false);
    this._catalogContainer.setMask(this._catalogMaskGfx.createGeometryMask());

    this._catalogRect = { x: left.x + 8, y: listY, w: left.w - 16, h: listH };
    this._catalogScroll = 0;

    this._rebuildCatalogItems();
    this._wireCatalogScroll();
  }

  _rebuildCatalogItems() {
    for (const o of this._catalogItems) o.destroy();
    this._catalogItems = [];

    const { x, y, w } = this._catalogRect;
    let yy = y;

    const ids = Object.keys(CAR_SPECS);
    const rowH = 52;

    for (const id of ids) {
      const spec = CAR_SPECS[id] || {};
      const selected = id === this._selectedCarId;

      const card = this.add.rectangle(x, yy, w, rowH - 6, COLORS.cardBg)
        .setOrigin(0)
        .setStrokeStyle(2, selected ? COLORS.glow : COLORS.cardStroke)
        .setInteractive({ useHandCursor: true });

      const t1 = this.add.text(x + 10, yy + 8, spec.name || id, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '14px',
        fontStyle: '900',
        color: selected ? '#00d9ff' : '#ffffff',
      }).setOrigin(0, 0);

      const t2 = this.add.text(x + 10, yy + 30, `${spec.category || '—'} · ${spec.rarity || '—'}`, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '11px',
        color: '#a0b0d0',
      }).setOrigin(0, 0);

      card.on('pointerdown', () => this._selectCar(id));

      this._catalogContainer.add([card, t1, t2]);
      this._catalogItems.push(card, t1, t2);

      yy += rowH;
    }

    const totalH = Math.max(0, (ids.length * rowH) - this._catalogRect.h);
    this._catalogScrollMax = totalH;
    this._applyCatalogScroll();
  }

  _wireCatalogScroll() {
    const r = this._catalogRect;

    this.input.on('wheel', (pointer, gos, dx, dy) => {
      if (!this._pointInRect(pointer.x, pointer.y, r)) return;
      this._catalogScroll = clamp(this._catalogScroll + dy * 0.6, 0, this._catalogScrollMax);
      this._applyCatalogScroll();
    });

    let dragging = false;
    let startY = 0;
    let startScroll = 0;

    const dragZone = this.add.rectangle(r.x, r.y, r.w, r.h, 0x000000, 0.001)
      .setOrigin(0)
      .setInteractive();

    dragZone.on('pointerdown', (p) => {
      dragging = true;
      startY = p.y;
      startScroll = this._catalogScroll;
    });

    this.input.on('pointerup', () => { dragging = false; });

    this.input.on('pointermove', (p) => {
      if (!dragging) return;
      const delta = (p.y - startY);
      this._catalogScroll = clamp(startScroll - delta, 0, this._catalogScrollMax);
      this._applyCatalogScroll();
    });
  }

  _applyCatalogScroll() {
    if (!this._catalogContainer) return;
    this._catalogContainer.y = -this._catalogScroll;
  }

  // ========================= PREVIEW =========================
  _buildPreview() {
    const { mid } = this._layout;

    this._panel(mid.x, mid.y, mid.w, mid.h);

    this.add.text(mid.x + mid.w / 2, mid.y + 10, 'PREVIEW', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      fontStyle: '900',
      color: '#00d9ff',
    }).setOrigin(0.5, 0);

    const frameX = mid.x + 14;
    const frameY = mid.y + 44;
    const frameW = mid.w - 28;
    const frameH = Math.floor(mid.h * 0.55);

    this.add.rectangle(frameX, frameY, frameW, frameH, 0x000000, 0.18)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.cardStroke);

    this._previewSprite = this.add.image(frameX + frameW / 2, frameY + frameH / 2, '__missing__')
      .setOrigin(0.5)
      .setVisible(false);

    this._previewFallback = this.add.rectangle(frameX + frameW / 2, frameY + frameH / 2, 120, 70, COLORS.btnBg)
      .setOrigin(0.5)
      .setStrokeStyle(2, COLORS.glow, 0.4);

    this._previewText = this.add.text(mid.x + 14, frameY + frameH + 14, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
      lineSpacing: 6,
      wordWrap: { width: mid.w - 28 },
    }).setOrigin(0, 0);

    this._refreshPreview();
  }

  _refreshPreview() {
    if (!this._factoryCar) {
      this._previewText?.setText('No car selected');
      return;
    }

    const c = this._factoryCar;
    const hp = c.handlingProfile || 'default';

    const t =
      `ID: ${c.id || '—'}\n` +
      `NAME: ${c.name || '—'}\n` +
      `BRAND: ${c.brand || '—'}\n` +
      `CATEGORY: ${c.category || '—'}\n` +
      `RARITY: ${c.rarity || '—'}\n` +
      `PROFILE: ${hp}\n\n` +
      `MAX FWD: ${fmtNum(Number(c.maxFwd))}\n` +
      `ACCEL:   ${fmtNum(Number(c.accel))}\n` +
      `TURN:    ${fmtNum(Number(c.turnRate))}\n` +
      `GRIP:    ${fmtNum(Number(c.gripDrive))}`;

    this._previewText.setText(t);

    const keysToTry = [
      c.skin,
      c.skin ? `car_${c.skin}` : null,
      c.id ? `car_${c.id}` : null,
      this._selectedCarId ? `car_${this._selectedCarId}` : null,
    ].filter(Boolean);

    let foundKey = null;
    for (const k of keysToTry) {
      if (this.textures.exists(k)) { foundKey = k; break; }
    }

    if (foundKey) {
      this._previewFallback.setVisible(false);
      this._previewSprite.setTexture(foundKey).setVisible(true);

      const frameW = (this._layout.mid.w - 28);
      const frameH = Math.floor(this._layout.mid.h * 0.55);
      const maxW = frameW * 0.86;
      const maxH = frameH * 0.86;

      const tex = this.textures.get(foundKey);
      const src = tex.getSourceImage();
      const sw = src?.width || 256;
      const sh = src?.height || 256;

      const s = Math.min(maxW / sw, maxH / sh);
      this._previewSprite.setScale(s);
    } else {
      this._previewSprite.setVisible(false);
      this._previewFallback.setVisible(true);
    }
  }

  // ========================= EDITOR =========================
  _buildEditor() {
    const { right } = this._layout;

    this._panel(right.x, right.y, right.w, right.h);

    this.add.text(right.x + right.w / 2, right.y + 10, 'EDITOR', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      fontStyle: '900',
      color: '#00d9ff',
    }).setOrigin(0.5, 0);

    const tabY = right.y + 36;
    const tabH = 40;
    const tabPad = 8;
    const tabW = Math.floor((right.w - tabPad * 4) / 3);

    ['IDENTIDAD', 'META', 'FÍSICAS'].forEach((tab, i) => {
      const x = right.x + tabPad + i * (tabW + tabPad);
      const active = this._currentTab === tab;
      this._btn(x, tabY, tabW, tabH, tab, () => this._switchTab(tab), active ? COLORS.glow : COLORS.btnBg, active ? '#000' : '#fff');
    });

    const gridY = tabY + tabH + 10;
    const gridH = right.y + right.h - gridY - 12;
    const gridX = right.x + 10;
    const gridW = right.w - 20;

    if (this._cardContainer) this._cardContainer.destroy();
    if (this._cardMaskGfx) this._cardMaskGfx.destroy();

    this._cardContainer = this.add.container(0, 0);

    this._cardMaskGfx = this.add.graphics();
    this._cardMaskGfx.fillStyle(0xffffff, 1);
    this._cardMaskGfx.fillRect(gridX, gridY, gridW, gridH);
    this._cardMaskGfx.setVisible(false);
    this._cardContainer.setMask(this._cardMaskGfx.createGeometryMask());

    this._cardsRect = { x: gridX, y: gridY, w: gridW, h: gridH };
    this._cardsScroll = 0;

    this._rebuildCards();
    this._wireCardsScroll();
  }

  _switchTab(tab) {
    this._currentTab = tab;
    this._buildEditor();
    this._refreshPreview();
  }

  _rebuildCards() {
    for (const c of this._cards) c.destroy();
    this._cards = [];

    if (!this._factoryCar) return;

    const r = this._cardsRect;
    const fields = FIELD_GROUPS[this._currentTab] || [];

    const isMobile = this.scale.width < 820;
    const cols = isMobile ? 1 : 2;

    const gap = 10;
    const cardW = cols === 1 ? r.w : Math.floor((r.w - gap) / 2);
    const cardH = 86;

    let i = 0;
    for (const key of fields) {
      const col = (i % cols);
      const row = Math.floor(i / cols);

      const x = r.x + col * (cardW + gap);
      const y = r.y + row * (cardH + gap);

      this._makeCard(x, y, cardW, cardH, key);
      i++;
    }

    const rows = Math.ceil(fields.length / cols);
    const totalH = Math.max(0, rows * (cardH + gap) - gap);
    this._cardsScrollMax = Math.max(0, totalH - r.h);
    this._applyCardsScroll();
  }

  _makeCard(x, y, w, h, key) {
    const car = this._factoryCar;
    const label = this._labelFor(key);
    const value = this._valueFor(key, car[key]);

    const shadow = this.add.rectangle(x + 3, y + 3, w, h, 0x000000, 0.35).setOrigin(0);
    const bg = this.add.rectangle(x, y, w, h, COLORS.cardBg).setOrigin(0).setStrokeStyle(2, COLORS.cardStroke)
      .setInteractive({ useHandCursor: true });

    const tLabel = this.add.text(x + 12, y + 10, label, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      fontStyle: '900',
      color: '#a0b0d0',
    }).setOrigin(0, 0);

    const tVal = this.add.text(x + w / 2, y + 46, value, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '22px',
      fontStyle: '900',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    bg._cf_key = key;
    bg._cf_valueText = tVal;

    bg.on('pointerdown', () => this._press(bg, () => this._openModal(key)));

    this._cardContainer.add([shadow, bg, tLabel, tVal]);
    this._cards.push(shadow, bg, tLabel, tVal);
  }

  _wireCardsScroll() {
    const r = this._cardsRect;

    this.input.on('wheel', (pointer, gos, dx, dy) => {
      if (!this._pointInRect(pointer.x, pointer.y, r)) return;
      this._cardsScroll = clamp(this._cardsScroll + dy * 0.6, 0, this._cardsScrollMax);
      this._applyCardsScroll();
    });

    let dragging = false;
    let startY = 0;
    let startScroll = 0;

    const dragZone = this.add.rectangle(r.x, r.y, r.w, r.h, 0x000000, 0.001)
      .setOrigin(0)
      .setInteractive();

    dragZone.on('pointerdown', (p) => {
      dragging = true;
      startY = p.y;
      startScroll = this._cardsScroll;
    });

    this.input.on('pointerup', () => { dragging = false; });

    this.input.on('pointermove', (p) => {
      if (!dragging) return;
      const delta = (p.y - startY);
      this._cardsScroll = clamp(startScroll - delta, 0, this._cardsScrollMax);
      this._applyCardsScroll();
    });
  }

  _applyCardsScroll() {
    this._cardContainer.y = -this._cardsScroll;
  }

  _refreshCards() {
    if (!this._factoryCar || !this._cardContainer) return;
    this._cardContainer.list.forEach((obj) => {
      if (obj && obj._cf_key && obj._cf_valueText) {
        const k = obj._cf_key;
        obj._cf_valueText.setText(this._valueFor(k, this._factoryCar[k]));
      }
    });
  }

  // ========================= MODAL =========================
  _openModal(key) {
    if (!this._factoryCar) return;

    if (this._modal) {
      this._modal.destroy();
      this._modal = null;
    }

    const { width, height } = this.scale;

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.65)
      .setOrigin(0)
      .setInteractive();

    overlay.on('pointerdown', () => this._closeModal());

    const modalW = Math.min(560, width - 24);
    const modalH = Math.min(640, height - 90);
    const mx = Math.floor(width / 2 - modalW / 2);
    const my = Math.floor(height / 2 - modalH / 2);

    const panel = this.add.rectangle(mx, my, modalW, modalH, COLORS.panelBg)
      .setOrigin(0)
      .setStrokeStyle(3, COLORS.glow);

    const title = this.add.text(mx + modalW / 2, my + 18, this._labelFor(key), {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '22px',
      fontStyle: '900',
      color: '#00d9ff',
    }).setOrigin(0.5, 0);

    const cur = this._factoryCar[key];
    let pending = cur;

    const valText = this.add.text(mx + modalW / 2, my + 58, this._valueFor(key, cur), {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '34px',
      fontStyle: '900',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    const contentX = mx + 24;
    const contentY = my + 120;
    const contentW = modalW - 48;

    const controls = [];
    const setPending = (v) => {
      pending = v;
      valText.setText(this._valueFor(key, pending));
    };

    const lim = NUM_LIMITS[key];
    if (lim) {
      const trackY = contentY + 30;

      const track = this.add.rectangle(contentX, trackY, contentW, 10, COLORS.cardStroke, 1)
        .setOrigin(0, 0.5);

      const fill = this.add.rectangle(contentX, trackY, 10, 10, COLORS.glow, 1)
        .setOrigin(0, 0.5);

      const handle = this.add.circle(contentX, trackY, 18, COLORS.accent)
        .setInteractive({ draggable: true, useHandCursor: true });

      const updateFromValue = (v) => {
        const vv = clamp(Number(v), lim.min, lim.max);
        const ratio = (vv - lim.min) / (lim.max - lim.min || 1);
        handle.x = contentX + contentW * ratio;
        fill.width = Math.max(6, contentW * ratio);
        setPending(vv);
      };

      handle.on('drag', (pointer) => {
        const ratio = clamp((pointer.x - contentX) / contentW, 0, 1);
        const raw = lim.min + ratio * (lim.max - lim.min);
        const stepped = Math.round(raw / lim.step) * lim.step;
        updateFromValue(stepped);
      });

      const step = lim.step || 1;
      const by = trackY + 34;
      const bw = 120;
      const bh = 54;

      const minus = this._btn(mx + modalW / 2 - bw - 12, by, bw, bh, '–', () => updateFromValue(Number(pending) - step), COLORS.btnBg);
      const plus  = this._btn(mx + modalW / 2 + 12,      by, bw, bh, '+', () => updateFromValue(Number(pending) + step), COLORS.btnBg);

      controls.push(...minus, ...plus, track, fill, handle);

      updateFromValue(Number(cur ?? lim.min));
    } else if (key === 'category') {
      controls.push(...this._pickerGrid(contentX, contentY, contentW, CATEGORIES, String(cur || CATEGORIES[0]), setPending));
    } else if (key === 'rarity') {
      controls.push(...this._pickerGrid(contentX, contentY, contentW, RARITIES, String(cur || RARITIES[0]), setPending));
    } else if (key === 'handlingProfile') {
      const opts = Object.keys(HANDLING_PROFILES || { default: true });
      controls.push(...this._pickerGrid(contentX, contentY, contentW, opts.length ? opts : ['default'], String(cur || 'default'), setPending));
    } else {
      const b = this._btn(mx + modalW / 2 - 120, contentY + 10, 240, 56, 'EDITAR TEXTO', () => {
        const def = cur == null ? '' : String(cur);
        const next = window.prompt(`Editar ${this._labelFor(key)}`, def);
        if (next == null) return;

        if (key === 'id') setPending(next.trim().toLowerCase().replace(/\s+/g, '_'));
        else setPending(next.trim());
      }, COLORS.btnBg);

      controls.push(...b);
    }

    const bottomY = my + modalH - 74;
    const half = Math.floor((modalW - 60) / 2);

    const cancel = this._btn(mx + 20, bottomY, half, 54, 'CANCELAR', () => this._closeModal(), COLORS.btnBg);
    const apply  = this._btn(mx + 40 + half, bottomY, half, 54, 'APLICAR', () => {
      this._applyField(key, pending);
      this._closeModal();
    }, COLORS.accent, '#000');

    this._modal = this.add.container(0, 0);
    this._modal.add([overlay, panel, title, valText, ...controls, ...cancel, ...apply]);

    this._modal.setAlpha(0);
    this.tweens.add({ targets: this._modal, alpha: 1, duration: 160, ease: 'Sine.easeOut' });
  }

  _closeModal() {
    if (!this._modal) return;
    this._modal.destroy();
    this._modal = null;
  }

  _applyField(key, value) {
    if (!this._factoryCar) return;

    if (NUM_LIMITS[key]) {
      const lim = NUM_LIMITS[key];
      value = clamp(Number(value), lim.min, lim.max);
    }

    if (key === 'id') {
      value = String(value).trim().toLowerCase().replace(/\s+/g, '_');
      if (!value) return;
    }

    this._factoryCar[key] = value;

    if (key === 'id' && this._selectedCarId && this._selectedCarId !== value) {
      delete CAR_SPECS[this._selectedCarId];
      CAR_SPECS[value] = this._factoryCar;
      this._selectedCarId = value;
      this._rebuildCatalogItems();
    } else if (this._selectedCarId) {
      CAR_SPECS[this._selectedCarId] = this._factoryCar;
    }

    this._refreshPreview();
    this._refreshCards();
  }

  // ========================= ACTIONS =========================
  _selectCar(id) {
    this._selectedCarId = id;
    this._factoryCar = deepClone(CAR_SPECS[id] || {});
    this._rebuildCatalogItems();
    this._refreshPreview();
    this._rebuildCards();
  }

  _newBase() {
    const baseId = CAR_SPECS.stock ? 'stock' : Object.keys(CAR_SPECS)[0];
    if (!baseId) return;

    const ts = Date.now();
    const newId = `custom_${ts}`;
    const base = deepClone(CAR_SPECS[baseId]);

    base.id = newId;
    base.name = `Custom ${ts}`;
    CAR_SPECS[newId] = base;

    this._selectCar(newId);
  }

  _clone() {
    if (!this._selectedCarId || !this._factoryCar) return;

    const ts = Date.now();
    const newId = `${this._selectedCarId}_mk1_${ts}`;
    const c = deepClone(this._factoryCar);

    c.id = newId;
    c.name = `${c.name || newId} MK1`;

    CAR_SPECS[newId] = c;
    this._selectCar(newId);
  }

  _exportJSON() {
    if (!this._factoryCar) return;
    const json = JSON.stringify(this._factoryCar, null, 2);

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(
        () => window.alert('✅ JSON copiado al portapapeles'),
        () => window.alert('⚠️ No se pudo copiar. Mira consola.')
      );
    } else {
      window.alert('⚠️ Clipboard no disponible. Mira consola.');
    }

    console.log('CAR EXPORT:', json);
  }

  _testDrive() {
    if (!this._factoryCar) return;

    CAR_SPECS.__test_drive__ = deepClone(this._factoryCar);

    // OJO: si tu juego usa otro scene key, cambia ESTA línea:
    // - 'RaceScene'  -> si tu carrera es RaceScene
    // - 'GameScene'  -> si tu carrera es GameScene
    this.scene.start('RaceScene', { testCarId: '__test_drive__' });
  }

  // ========================= UI HELPERS =========================
  _panel(x, y, w, h) {
    this.add.rectangle(x + 4, y + 4, w, h, 0x000000, 0.25).setOrigin(0);
    this.add.rectangle(x, y, w, h, COLORS.panelBg, 1).setOrigin(0).setStrokeStyle(2, COLORS.panelStroke, 1);
    this.add.rectangle(x + 2, y + 2, w - 4, h - 4, COLORS.glow, 0.03).setOrigin(0);
  }

  _btn(x, y, w, h, label, onClick, bg = COLORS.btnBg, fg = '#fff') {
    const shadow = this.add.rectangle(x + 3, y + 3, w, h, 0x000000, 0.35).setOrigin(0);
    const rect = this.add.rectangle(x, y, w, h, bg, 1)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.cardStroke, 1)
      .setInteractive({ useHandCursor: true });

    const text = this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: `${Math.max(12, Math.floor(h * 0.38))}px`,
      fontStyle: '900',
      color: fg,
    }).setOrigin(0.5);

    rect.on('pointerdown', () => this._press(rect, onClick));
    rect.on('pointerover', () => rect.setFillStyle(COLORS.btnHover, 1));
    rect.on('pointerout', () => rect.setFillStyle(bg, 1));

    return [shadow, rect, text];
  }

  _press(target, cb) {
    this.tweens.add({
      targets: target,
      scaleX: 0.96,
      scaleY: 0.96,
      duration: 80,
      yoyo: true,
      onComplete: () => cb?.(),
    });
  }

  _pickerGrid(x, y, w, options, current, onPick) {
    const out = [];
    const cols = 3;
    const gap = 10;
    const bw = Math.floor((w - gap * (cols - 1)) / cols);
    const bh = 52;

    let ox = x;
    let oy = y;

    options.forEach((opt, i) => {
      const active = String(opt) === String(current);
      const bg = active ? COLORS.glow : COLORS.btnBg;
      const fg = active ? '#000' : '#fff';

      out.push(...this._btn(ox, oy, bw, bh, String(opt).toUpperCase(), () => onPick(String(opt)), bg, fg));

      ox += bw + gap;
      if ((i + 1) % cols === 0) { ox = x; oy += bh + gap; }
    });

    return out;
  }

  _labelFor(key) {
    return String(key)
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toUpperCase();
  }

  _valueFor(key, v) {
    if (v == null || v === '') return '—';
    if (typeof v === 'number') return fmtNum(v);
    return String(v);
  }

  _pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }
}

export default CarFactoryScene;
