import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';
import { BaseScene } from './BaseScene.js';

const CARD_BASE = 'assets/cars/runtime/';
const LEGACY_IDS = new Set(['stock', 'touring', 'power']);

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function getPlayableCars() {
  return Object.keys(CAR_SPECS)
    .filter(id => !LEGACY_IDS.has(id))
    .map(id => ({ id, spec: CAR_SPECS[id] }))
    .filter(x => x?.spec);
}

export class GarageScene extends BaseScene {
  constructor() {
    super({ key: 'GarageScene' });

    this._mode = 'player';
    this._cars = [];
    this._selectedIndex = 0;

    this._thumbList = null;
    this._thumbItems = [];
    this._thumbScrollY = 0;
    this._thumbMinScroll = 0;

    this._hero = null;
this._uiRefs = {};

// Scroll premium
this._dragStartY = 0;
this._dragStartScroll = 0;
this._scrollVelocity = 0;
this._isDraggingThumbs = false;

// FX premium
this._heroPulseTween = null;
  }

  init(data) {
    this._mode = (data && data.mode === 'admin') ? 'admin' : 'player';
  }

  create() {
    super.create();

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0b1020');

    this._cars = getPlayableCars();

    const savedCarId = (() => {
      try { return localStorage.getItem('tdr2:carId'); } catch (e) { return null; }
    })();

    const idx = this._cars.findIndex(c => c.id === savedCarId);
    this._selectedIndex = idx >= 0 ? idx : 0;

    this.scale.on('resize', this._rebuild, this);
this.events.on('update', this._updateGarage, this);
this._rebuild();
  }

  shutdown() {
  this.scale.off('resize', this._rebuild, this);
  this.events.off('update', this._updateGarage, this);

  try { this._heroPulseTween?.remove(); } catch (e) {}
  this._heroPulseTween = null;
}

  _rebuild() {
    try { this.children.removeAll(true); } catch (e) {}

    this._thumbItems = [];
    this._uiRefs = {};

    const { width, height } = this.scale;
    const isLandscape = width >= height;

    // =========================
    // Fondo premium
    // =========================
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a1635, 0x10285f, 0x07142f, 0x0b1a3d, 1);
    bg.fillRect(0, 0, width, height);

    bg.fillStyle(0x2b7bff, 0.09);
    bg.fillEllipse(width * 0.72, height * 0.25, width * 0.50, height * 0.40);

    bg.fillStyle(0x2bff88, 0.06);
    bg.fillEllipse(width * 0.65, height * 0.78, width * 0.55, height * 0.45);

    bg.lineStyle(1, 0xffffff, 0.03);
    const step = 54;
    for (let x = 0; x <= width; x += step) bg.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += step) bg.lineBetween(0, y, width, y);

    // =========================
    // Header
    // =========================
    this.add.text(width / 2, 16, 'GARAJE', {
      fontFamily: 'Orbitron, system-ui, -apple-system, sans-serif',
      fontSize: isLandscape ? '34px' : '28px',
      fontStyle: '900',
      color: '#ffffff',
      stroke: '#091a42',
      strokeThickness: 8
    }).setOrigin(0.5, 0);

    this.add.text(width - 16, 20, this._mode === 'admin' ? 'ADMIN' : 'PLAYER', {
      fontFamily: 'system-ui',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#091a42',
      strokeThickness: 5
    }).setOrigin(1, 0);

    const back = this.add.text(16, 16, '⬅', {
      fontFamily: 'system-ui',
      fontSize: '28px',
      color: '#fff',
      stroke: '#091a42',
      strokeThickness: 7
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });

    back.on('pointerdown', () => {
      if (this._mode === 'admin') this.scene.start('admin-hub');
      else this.scene.start('menu');
    });

    // =========================
    // Layout general
    // =========================
    const topSafe = 72;
    const pad = clamp(Math.floor(width * 0.02), 14, 24);
    const bottomPad = 18;

    const leftW = isLandscape
      ? clamp(Math.floor(width * 0.30), 250, 380)
      : width - pad * 2;

    const rightX = pad + leftW + pad;
    const rightW = isLandscape
      ? width - rightX - pad
      : width - pad * 2;

    const contentY = topSafe;
    const contentH = height - contentY - bottomPad;

    // =========================
    // Panel izquierdo: tira de cards
    // =========================
    const leftPanel = this.add.graphics();
    leftPanel.fillStyle(0x0b1020, 0.40);
    leftPanel.fillRoundedRect(pad, contentY, leftW, contentH, 24);
    leftPanel.lineStyle(2, 0xb7c0ff, 0.16);
    leftPanel.strokeRoundedRect(pad, contentY, leftW, contentH, 24);

    this.add.text(pad + 18, contentY + 14, 'COLECCIÓN', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    // Viewport del scroll izquierdo
    const listX = pad + 12;
    const listY = contentY + 46;
    const listW = leftW - 24;
    const listH = contentH - 58;

    const maskGfx = this.make.graphics({ x: 0, y: 0, add: false });
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(listX, listY, listW, listH);
    const mask = maskGfx.createGeometryMask();

    this._thumbList = this.add.container(0, listY);
    this._thumbList.setMask(mask);

    let cy = 0;
    const itemGap = 12;
    const itemH = isLandscape ? 120 : 112;
    const itemW = listW;

    this._cars.forEach((car, i) => {
      const item = this._createThumbItem(listX, cy, itemW, itemH, car.id, car.spec, i);
      this._thumbItems.push(item);
      cy += itemH + itemGap;
    });

    const contentInnerH = cy - itemGap;
    this._thumbScrollY = 0;
    this._thumbMinScroll = Math.min(0, listH - contentInnerH);
    this._applyThumbScroll();

// reset listeners para no duplicarlos al reconstruir UI
this.input.off('wheel', this._onGarageWheel, this);
this.input.off('pointerdown', this._onGaragePointerDown, this);
this.input.off('pointermove', this._onGaragePointerMove, this);
this.input.off('pointerup', this._onGaragePointerUp, this);
this.input.off('pointerupoutside', this._onGaragePointerUp, this);

// scroll mouse
this._onGarageWheel = (_p, _g, _dx, dy) => {
  this._scrollVelocity = 0;
  this._setThumbScroll(this._thumbScrollY - dy * 0.7);
};

// scroll touch con inercia
this._onGaragePointerDown = (p) => {
  this._dragStartY = p.y;
  this._dragStartScroll = this._thumbScrollY;
  this._scrollVelocity = 0;
  this._isDraggingThumbs = true;
};

this._onGaragePointerMove = (p) => {
  if (!p.isDown || !this._isDraggingThumbs) return;

  const delta = p.y - this._dragStartY;
  const next = this._dragStartScroll + delta;

  this._scrollVelocity = p.velocity.y * 0.085;
  this._setThumbScroll(next);
};

this._onGaragePointerUp = () => {
  this._isDraggingThumbs = false;
};

this.input.on('wheel', this._onGarageWheel, this);
this.input.on('pointerdown', this._onGaragePointerDown, this);
this.input.on('pointermove', this._onGaragePointerMove, this);
this.input.on('pointerup', this._onGaragePointerUp, this);
this.input.on('pointerupoutside', this._onGaragePointerUp, this);

    // =========================
    // Panel derecho: hero
    // =========================
    const heroX = isLandscape ? rightX : pad;
    const heroY = isLandscape ? contentY : (contentY + contentH + 14);
    const heroH = isLandscape ? contentH : 260;

    this._hero = this.add.container(0, 0);
    this._buildHeroPanel(heroX, heroY, rightW, heroH);

    this._refreshSelection();
  }

  _setThumbScroll(y) {
    this._thumbScrollY = Phaser.Math.Clamp(y, this._thumbMinScroll, 0);
    this._applyThumbScroll();
  }

  _applyThumbScroll() {
    if (!this._thumbList) return;
    const baseY = this._thumbList.y >= 0 ? this._thumbList.y : 0;
    // La y inicial real la fijamos en _rebuild y aquí solo aplicamos offset
    const maskTop = this._thumbList.mask?.geometryMask?.graphicsGeometry?.y;
    // sin inventar offsets raros: simplemente base visual listY quedó ya en container
    this._thumbList.y = (this.scale.height >= 0 ? this._thumbList.y : 0);
    const listY = this._thumbList.list.length ? this._thumbList.list[0].parentContainer.y : this._thumbList.y;
    this._thumbList.y = (this._thumbList.y - this._thumbList.y) + (this._thumbList.y || 0);
    // forma estable:
    const realTop = (this._thumbList._topBaseY ?? this._thumbList.y);
    this._thumbList.y = realTop + this._thumbScrollY;
  }
  _updateGarage(_time, delta) {
    if (this._isDraggingThumbs) return;
    if (Math.abs(this._scrollVelocity) < 0.02) return;

    this._setThumbScroll(this._thumbScrollY + this._scrollVelocity * (delta / 16.666));
    this._scrollVelocity *= 0.92;

    // freno extra al llegar a extremos
    if (this._thumbScrollY >= 0 || this._thumbScrollY <= this._thumbMinScroll) {
      this._scrollVelocity *= 0.75;
    }
  }
  _createThumbItem(x, y, w, h, carId, spec, index) {
    const item = this.add.container(x, y);
    this._thumbList.add(item);

    // guardamos topBaseY una sola vez
    if (this._thumbList._topBaseY == null) this._thumbList._topBaseY = this._thumbList.y;

    const selected = index === this._selectedIndex;

    const bg = this.add.rectangle(0, 0, w, h, 0x111a33, selected ? 0.82 : 0.50)
      .setOrigin(0)
      .setStrokeStyle(2, selected ? 0x2bff88 : 0xb7c0ff, selected ? 0.65 : 0.18);

    const accent = this.add.rectangle(0, 0, 8, h, selected ? 0x2bff88 : 0x2b7bff, selected ? 0.95 : 0.70)
      .setOrigin(0);

    const name = this.add.text(108, 16, (spec.name || carId).toUpperCase(), {
      fontFamily: 'Orbitron, system-ui, sans-serif',
      fontSize: '16px',
      fontStyle: '900',
      color: '#ffffff'
    });

    const meta = this.add.text(108, 44,
      `${spec.brand || '—'} · ${spec.category || '—'}\n${spec.rarity || 'Común'} · #${String(spec.collectionNo || 0).padStart(3, '0')}`,
      {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '13px',
        color: '#b7c0ff',
        lineSpacing: 4
      }
    );

    const texKey = `card_${carId}`;
    const cardImg = this.add.image(60, h / 2, '__MISSING').setVisible(false);

    item.add([bg, accent, name, meta, cardImg]);

    this._ensureCardTexture(carId, spec, (loadedKey) => {
      if (!item.scene) return;
      if (!this.textures.exists(loadedKey)) return;

      cardImg.setTexture(loadedKey).setVisible(true);

      const targetW = 88;
      const scale = Math.min(
        targetW / (cardImg.width || 1),
        (h - 18) / (cardImg.height || 1)
      );
      cardImg.setScale(scale);
    });

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0.001)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerdown', () => {
      this._selectedIndex = index;
      this._refreshSelection();
    });

    item.add(hit);

    return { item, bg, accent, name, meta, cardImg, carId, spec, index };
  }

  _buildHeroPanel(x, y, w, h) {
    this._hero.removeAll(true);
    this._hero.setPosition(0, 0);

    const panel = this.add.graphics();
    panel.fillStyle(0x0b1020, 0.36);
    panel.fillRoundedRect(x, y, w, h, 28);
    panel.lineStyle(2, 0xb7c0ff, 0.18);
    panel.strokeRoundedRect(x, y, w, h, 28);

    const glow = this.add.graphics();
    glow.fillStyle(0x2bff88, 0.04);
    glow.fillEllipse(x + w * 0.65, y + h * 0.52, w * 0.55, h * 0.65);

    const cardZoneW = Math.floor(w * 0.46);
    const infoX = x + cardZoneW + 18;
    const infoW = w - cardZoneW - 32;

    const heroCard = this.add.image(x + Math.floor(cardZoneW / 2), y + Math.floor(h * 0.46), '__MISSING')
      .setVisible(false);

    const title = this.add.text(infoX, y + 24, '', {
      fontFamily: 'Orbitron, system-ui, sans-serif',
      fontSize: '30px',
      fontStyle: '900',
      color: '#ffffff',
      wordWrap: { width: infoW }
    });

    const brand = this.add.text(infoX, y + 78, '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '18px',
      color: '#2bff88',
      fontStyle: 'bold'
    });

    const meta = this.add.text(infoX, y + 112, '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '15px',
      color: '#b7c0ff',
      lineSpacing: 8,
      wordWrap: { width: infoW }
    });

    const statPanel = this.add.rectangle(infoX + Math.floor(infoW / 2), y + h - 128, infoW, 98, 0x111a33, 0.60)
      .setStrokeStyle(1, 0xffffff, 0.10);

    const statText = this.add.text(infoX + 16, y + h - 162, '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '15px',
      color: '#ffffff',
      lineSpacing: 8
    });

    const btnMain = this._makeHeroButton(
      infoX,
      y + h - 58,
      Math.floor(infoW * 0.60),
      46,
      this._mode === 'admin' ? 'EDITAR COCHE' : 'SELECCIONAR',
      true
    );

    const btnSecondary = this._makeHeroButton(
      infoX + Math.floor(infoW * 0.60) + 12,
      y + h - 58,
      Math.floor(infoW * 0.34),
      46,
      this._mode === 'admin' ? 'VER FICHA' : 'VOLVER',
      false
    );

    this._hero.add([
      panel,
      glow,
      heroCard,
      title,
      brand,
      meta,
      statPanel,
      statText,
      btnMain.container,
      btnSecondary.container
    ]);

    btnMain.hit.on('pointerdown', () => this._activatePrimary());
    btnSecondary.hit.on('pointerdown', () => this._activateSecondary());

    this._uiRefs.heroCard = heroCard;
    this._uiRefs.title = title;
    this._uiRefs.brand = brand;
    this._uiRefs.meta = meta;
    this._uiRefs.statText = statText;
    this._uiRefs.btnMainLabel = btnMain.label;
    this._uiRefs.btnSecondaryLabel = btnSecondary.label;
  }

  _makeHeroButton(x, y, w, h, labelText, primary) {
    const container = this.add.container(0, 0);

    const shadow = this.add.rectangle(x + 3, y + 4, w, h, 0x000000, 0.22).setOrigin(0);
    const bg = this.add.rectangle(x, y, w, h, primary ? 0x2bff88 : 0x141b33, primary ? 0.95 : 0.75)
      .setOrigin(0)
      .setStrokeStyle(1, primary ? 0xffffff : 0xb7c0ff, primary ? 0.22 : 0.20);

    const label = this.add.text(x + w / 2, y + h / 2, labelText, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '15px',
      color: primary ? '#0b1020' : '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const hit = this.add.rectangle(x, y, w, h, 0x000000, 0.001)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerdown', () => {
      container.setScale(0.98);
    });
    hit.on('pointerup', () => {
      container.setScale(1);
    });
    hit.on('pointerout', () => {
      container.setScale(1);
    });

    container.add([shadow, bg, label, hit]);
    return { container, hit, label };
  }

  _activatePrimary() {
    const selected = this._cars[this._selectedIndex];
    if (!selected) return;

    if (this._mode === 'admin') {
      this.scene.start('car-editor', { carId: selected.id });
      return;
    }

    try { localStorage.setItem('tdr2:carId', selected.id); } catch (e) {}
    this.scene.start('menu');
  }

  _activateSecondary() {
    const selected = this._cars[this._selectedIndex];
    if (!selected) return;

    if (this._mode === 'admin') {
      this.scene.start('GarageDetailScene', { carId: selected.id, mode: 'admin' });
      return;
    }

    this.scene.start('menu');
  }

  _refreshSelection() {
    const selected = this._cars[this._selectedIndex];
    if (!selected) return;

    this._thumbItems.forEach((t, i) => {
      const isSel = i === this._selectedIndex;
      t.bg.setFillStyle(0x111a33, isSel ? 0.82 : 0.50);
      t.bg.setStrokeStyle(2, isSel ? 0x2bff88 : 0xb7c0ff, isSel ? 0.65 : 0.18);
      t.accent.setFillStyle(isSel ? 0x2bff88 : 0x2b7bff, isSel ? 0.95 : 0.70);
    });
const selectedThumb = this._thumbItems[this._selectedIndex];
if (selectedThumb?.item) {
  const itemTop = selectedThumb.item.y;
  const itemBottom = itemTop + selectedThumb.bg.height;
  const viewTop = -this._thumbScrollY;
  const viewH = Math.max(120, this.scale.height - 72 - 18 - 58);
  const viewBottom = viewTop + viewH;

  if (itemTop < viewTop + 8) {
    this._setThumbScroll(-(itemTop - 8));
  } else if (itemBottom > viewBottom - 8) {
    this._setThumbScroll(-(itemBottom - viewH + 8));
  }
}
    const spec = selected.spec;
    const heroCard = this._uiRefs.heroCard;
    const texKey = `card_${selected.id}`;

this._ensureCardTexture(selected.id, spec, (loadedKey) => {
  if (!heroCard?.scene) return;
  if (!this.textures.exists(loadedKey)) return;

  const { width, height } = this.scale;
  const isLandscape = width >= height;
  const heroMaxW = isLandscape ? width * 0.28 : width * 0.50;
  const heroMaxH = isLandscape ? height * 0.58 : height * 0.34;

  const applyHeroTexture = () => {
    heroCard.setTexture(loadedKey).setVisible(true);

    const s = Math.min(
      heroMaxW / (heroCard.width || 1),
      heroMaxH / (heroCard.height || 1)
    );

    heroCard.setScale(s * 0.92);
    heroCard.setAlpha(0);

    this.tweens.add({
      targets: heroCard,
      scale: s,
      alpha: 1,
      duration: 180,
      ease: 'Cubic.easeOut'
    });

    try { this._heroPulseTween?.remove(); } catch (e) {}
    this._heroPulseTween = this.tweens.add({
      targets: heroCard,
      scaleX: heroCard.scaleX * 1.018,
      scaleY: heroCard.scaleY * 1.018,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  };

  if (!heroCard.visible) {
    applyHeroTexture();
    return;
  }

  this.tweens.add({
    targets: heroCard,
    alpha: 0,
    scaleX: heroCard.scaleX * 0.96,
    scaleY: heroCard.scaleY * 0.96,
    duration: 110,
    ease: 'Quad.easeIn',
    onComplete: applyHeroTexture
  });
});
    this._uiRefs.title.setText((spec.name || selected.id).toUpperCase());
    this._uiRefs.brand.setText(String(spec.brand || 'MARCA DESCONOCIDA').toUpperCase());
    this._uiRefs.meta.setText(
      `Categoría: ${spec.category || '—'}\n` +
      `Rareza: ${spec.rarity || 'Común'}\n` +
      `Colección: #${String(spec.collectionNo || 0).padStart(3, '0')}\n` +
      `Rol: ${spec.role || '—'}`
    );

    const topKmh = Math.round((spec.maxFwd || 0) * 0.185);
    const accel = Math.round(spec.accel || 0);
    const brake = Math.round(spec.brakeForce || 0);

    this._uiRefs.statText.setText(
      `VEL PUNTA   ${topKmh} km/h\n` +
      `ACELERACIÓN ${accel}\n` +
      `FRENADA     ${brake}`
    );

    this._uiRefs.btnMainLabel.setText(this._mode === 'admin' ? 'EDITAR COCHE' : 'SELECCIONAR');
    this._uiRefs.btnSecondaryLabel.setText(this._mode === 'admin' ? 'VER FICHA' : 'VOLVER');
  }

  _ensureCardTexture(carId, spec, onReady) {
    const raritySlug = (spec.rarity || 'comun')
      .toLowerCase()
      .replace(' ', '_')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const fileName =
      `card_${carId}_${raritySlug}_${String(spec.collectionNo || 0).padStart(3, '0')}.webp`;

    const texKey = `card_${carId}`;
    const url = `${CARD_BASE}${fileName}`;

    if (this.textures.exists(texKey)) {
      onReady?.(texKey);
      return;
    }

    const onFileOk = (key) => {
      if (key !== texKey) return;
      cleanup();
      onReady?.(texKey);
    };

    const onFileErr = (file) => {
      if (!file || file.key !== texKey) return;
      cleanup();
    };

    const cleanup = () => {
      this.load.off(`filecomplete-image-${texKey}`, onFileOk);
      this.load.off(Phaser.Loader.Events.LOAD_ERROR, onFileErr);
    };

    this.load.once(`filecomplete-image-${texKey}`, onFileOk);
    this.load.on(Phaser.Loader.Events.LOAD_ERROR, onFileErr);

    this.load.image(texKey, url);

    if (!this.load.isLoading()) this.load.start();
  }
}
