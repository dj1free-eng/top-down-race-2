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
  this.cameras.main.setBackgroundColor('#0b1020');

  this._base = CAR_SPECS[this._carId] || CAR_SPECS.stock;
  this._override = this._readOverride(this._carId);

  // ===== Fondo tipo lobby =====
  const bg = this.add.graphics();
  bg.fillStyle(0x071027, 1);
  bg.fillRect(0, 0, width, height);
  bg.fillStyle(0x2bff88, 0.05);
  bg.fillEllipse(width * 0.6, height * 0.3, width * 0.9, height * 0.7);

  // ===== Header =====
  this.add.text(width / 2, 18, `EDITOR · ${this._base.name}`, {
    fontFamily: 'system-ui',
    fontSize: '20px',
    color: '#2bff88',
    fontStyle: 'bold'
  }).setOrigin(0.5, 0);

  this.add.text(width - 16, 22, 'ADMIN', {
    fontFamily: 'system-ui',
    fontSize: '14px',
    color: '#ffffff'
  }).setOrigin(1, 0);

  const back = this.add.text(16, 18, '⬅', {
    fontFamily: 'system-ui',
    fontSize: '26px',
    color: '#fff'
  }).setOrigin(0, 0).setInteractive({ useHandCursor: true });

  back.on('pointerdown', () => {
    this.scene.start('GarageScene', { mode: 'admin' });
  });

  // ===== Scroll container =====
  const topY = 70;
  const bottomMargin = 120;
  const viewportH = height - topY - bottomMargin;

  const maskGfx = this.make.graphics({ x: 0, y: 0, add: false });
  maskGfx.fillStyle(0xffffff);
  maskGfx.fillRect(0, topY, width, viewportH);
  const mask = maskGfx.createGeometryMask();

  this._list = this.add.container(0, topY);
  this._list.setMask(mask);

  // ===== Generar sliders automáticamente =====
  const editableKeys = Object.keys(this._base).filter(k => {
    const v = this._base[k];
    if (typeof v !== 'number') return false;

    // excluir meta UI
    return ![
      'collectionNo',
      'visualScale'
    ].includes(k);
  });

  let y = 0;
  const rowH = 82;

  editableKeys.forEach((key) => {

    const baseVal = this._base[key];
    const curVal = (this._override?.[key] ?? baseVal);

    // rango automático ±50%
    const min = baseVal * 0.5;
    const max = baseVal * 1.5;
    const step = baseVal < 1 ? 0.01 : 1;

    this._makeSliderRow(
      20,
      y,
      width - 40,
      {
        key,
        label: key,
        min,
        max,
        step
      }
    );

    y += rowH;
  });

  this._contentHeight = y;

  // Scroll móvil
  this._scrollY = 0;
  this._minScroll = Math.min(0, viewportH - this._contentHeight);

  this.input.on('pointerdown', (p) => {
    this._dragStartY = p.y;
    this._dragStartScroll = this._scrollY;
  });

  this.input.on('pointermove', (p) => {
    if (!p.isDown) return;
    const delta = p.y - this._dragStartY;
    this._setScroll(this._dragStartScroll + delta);
  });

  // ===== Botones =====
  const btnY = height - 90;

  const saveBtn = this._button(width / 2 - 170, btnY, 150, 60, 'GUARDAR', () => {
    this._writeOverride(this._carId, this._override);
    this._toast('Guardado ✓');
  });

  const testBtn = this._button(width / 2 + 20, btnY, 150, 60, 'TEST', () => {
    this._writeOverride(this._carId, this._override);
    this.scene.start('race', { carId: this._carId, testMode: true });
  });

  this.add.existing(saveBtn);
  this.add.existing(testBtn);
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
}
