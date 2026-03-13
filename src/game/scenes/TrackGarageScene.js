import Phaser from 'phaser';
import { BaseScene } from './BaseScene.js';
import { createTrack } from '../tracks/trackRegistry.js';

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function normPts(centerline) {
  if (!Array.isArray(centerline)) return [];
  return centerline.map((p) => {
    if (Array.isArray(p)) return { x: p[0], y: p[1] };
    if (p && typeof p.x === 'number' && typeof p.y === 'number') return { x: p.x, y: p.y };
    return null;
  }).filter(Boolean);
}

// Preview simplificado de Tenerife (sin depender del PNG)
function makeTenerifePreview() {
  return {
    key: 'import:karting-tenerife-largo',
    name: 'KARTING TENERIFE',
    brand: 'TENERIFE',
    category: 'Técnico',
    difficulty: 'Media',
    lengthLabel: 'Larga',
    worldW: 8000,
    worldH: 5000,
    trackWidth: 300,
    centerline: [
      [1400, 700], [2400, 700], [3400, 700], [4300, 900], [5000, 1100], [5600, 900],
      [6100, 700], [6500, 1100], [6400, 1800], [6000, 2200], [5200, 2200], [5000, 2600],
      [5600, 3200], [6200, 3400], [6200, 4200], [5200, 4400], [4100, 4300], [2900, 4300],
      [1700, 4300], [900, 3900], [700, 3300], [1100, 2900], [2100, 2900], [3200, 2900],
      [4200, 2900], [4300, 2400], [3800, 1900], [3100, 1600], [2500, 1900], [2500, 2700],
      [2500, 3500], [1900, 3500], [1500, 3100], [1500, 2100], [1500, 1200], [1400, 700]
    ]
  };
}

function buildTrackCatalog() {
  const t01 = makeTrack01Oval();
  const t02 = makeTrack02Technical();
  const t03 = makeTrack03Drift();
  const tf = makeTenerifePreview();

  return [
    {
      key: 'track01',
      name: 'ÓVALO',
      brand: 'TDR',
      category: 'Velocidad',
      difficulty: 'Fácil',
      lengthLabel: 'Corta',
      trackWidth: t01.trackWidth,
      worldW: t01.worldW,
      worldH: t01.worldH,
      centerline: t01.centerline
    },
    {
      key: 'track02',
      name: 'TÉCNICO',
      brand: 'TDR',
      category: 'Grip',
      difficulty: 'Media',
      lengthLabel: 'Media',
      trackWidth: t02.trackWidth,
      worldW: t02.worldW,
      worldH: t02.worldH,
      centerline: t02.centerline
    },
    {
      key: 'track03',
      name: 'DRIFT',
      brand: 'TDR',
      category: 'Drift',
      difficulty: 'Alta',
      lengthLabel: 'Media',
      trackWidth: t03.trackWidth,
      worldW: t03.worldW,
      worldH: t03.worldH,
      centerline: t03.centerline
    },
    tf
  ];
}

function estimateTrackLength(centerline) {
  const pts = normPts(centerline);
  if (pts.length < 2) return 0;

  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Phaser.Math.Distance.Between(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
  }
  return Math.round(len);
}

export class TrackGarageScene extends BaseScene {
  constructor() {
    super({ key: 'TrackGarageScene' });

    this._mode = 'player';
    this._tracks = [];
    this._selectedIndex = 0;

    this._thumbList = null;
    this._thumbItems = [];
    this._thumbScrollY = 0;
    this._thumbMinScroll = 0;
    this._thumbViewport = null;
    this._thumbListTopY = 0;

    this._thumbPointerActive = false;
    this._thumbPointerStartY = 0;
    this._dragStartY = 0;
    this._dragStartScroll = 0;
    this._scrollVelocity = 0;
    this._isDraggingThumbs = false;

    this._hero = null;
    this._uiRefs = {};
    this._heroPulseTween = null;
  }

  init(data) {
    this._mode = (data && data.mode === 'admin') ? 'admin' : 'player';
  }

  create() {
    super.create();

    this.cameras.main.setBackgroundColor('#1d2a12');

    this._tracks = buildTrackCatalog();

    const savedTrack = (() => {
      try { return localStorage.getItem('tdr2:trackKey'); } catch (e) { return null; }
    })();

    const idx = this._tracks.findIndex(t => t.key === savedTrack);
    this._selectedIndex = idx >= 0 ? idx : 0;

    this.scale.on('resize', this._rebuild, this);
    this.events.on('update', this._updateTrackGarage, this);

    this._rebuild();
  }

  shutdown() {
    this.scale.off('resize', this._rebuild, this);
    this.events.off('update', this._updateTrackGarage, this);

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
    // Fondo premium verde/amarillo
    // =========================
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x16220f, 0x445f1f, 0x20180c, 0x6a7c1f, 1);
    bg.fillRect(0, 0, width, height);

    bg.fillStyle(0xe0ff72, 0.06);
    bg.fillEllipse(width * 0.72, height * 0.22, width * 0.52, height * 0.36);

    bg.fillStyle(0x47ff88, 0.05);
    bg.fillEllipse(width * 0.62, height * 0.76, width * 0.58, height * 0.44);

    bg.fillStyle(0xffd84d, 0.04);
    bg.fillEllipse(width * 0.25, height * 0.35, width * 0.40, height * 0.28);

    bg.lineStyle(1, 0xffffff, 0.03);
    const step = 54;
    for (let x = 0; x <= width; x += step) bg.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += step) bg.lineBetween(0, y, width, y);

    // =========================
    // Header
    // =========================
    this.add.text(width / 2, 16, 'CIRCUITOS', {
      fontFamily: 'Orbitron, system-ui, -apple-system, sans-serif',
      fontSize: isLandscape ? '34px' : '28px',
      fontStyle: '900',
      color: '#ffffff',
      stroke: '#22310f',
      strokeThickness: 8
    }).setOrigin(0.5, 0);

    this.add.text(width - 16, 20, this._mode === 'admin' ? 'ADMIN' : 'PLAYER', {
      fontFamily: 'system-ui',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#22310f',
      strokeThickness: 5
    }).setOrigin(1, 0);

    const backHit = this.add.rectangle(12, 12, 64, 64, 0x000000, 0.001)
      .setOrigin(0, 0)
      .setDepth(10000)
      .setInteractive({ useHandCursor: true });

    const back = this.add.text(16, 16, '⬅', {
      fontFamily: 'system-ui',
      fontSize: '28px',
      color: '#fff',
      stroke: '#22310f',
      strokeThickness: 7
    })
      .setOrigin(0, 0)
      .setDepth(10001);

    backHit.on('pointerdown', () => {
      this.scene.start('menu');
    });

    // =========================
    // Layout
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
    // Panel izquierdo
    // =========================
    const leftPanel = this.add.graphics();
    leftPanel.fillStyle(0x11160d, 0.46);
    leftPanel.fillRoundedRect(pad, contentY, leftW, contentH, 24);
    leftPanel.lineStyle(2, 0xe7ff96, 0.20);
    leftPanel.strokeRoundedRect(pad, contentY, leftW, contentH, 24);

    this.add.text(pad + 18, contentY + 14, 'COLECCIÓN', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    const listX = pad + 12;
    const listY = contentY + 46;
    const listW = leftW - 24;
    const listH = contentH - 58;

    this._thumbViewport = new Phaser.Geom.Rectangle(listX, listY, listW, listH);
    this._thumbListTopY = listY;

    const maskGfx = this.make.graphics({ x: 0, y: 0, add: false });
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(listX, listY, listW, listH);
    const mask = maskGfx.createGeometryMask();

    this._thumbList = this.add.container(0, listY);
    this._thumbList.setMask(mask);

    let cy = 0;
    const itemGap = 12;
    const itemH = 120;
    const itemW = listW;

    this._tracks.forEach((track, i) => {
      const item = this._createThumbItem(listX, cy, itemW, itemH, track, i);
      this._thumbItems.push(item);
      cy += itemH + itemGap;
    });

    const contentInnerH = cy - itemGap;
    this._thumbScrollY = 0;
    this._thumbMinScroll = Math.min(0, listH - contentInnerH);
    this._applyThumbScroll();

    // Listeners scroll
    this.input.off('wheel', this._onTrackGarageWheel, this);
    this.input.off('pointerdown', this._onTrackGaragePointerDown, this);
    this.input.off('pointermove', this._onTrackGaragePointerMove, this);
    this.input.off('pointerup', this._onTrackGaragePointerUp, this);
    this.input.off('pointerupoutside', this._onTrackGaragePointerUp, this);

    this._onTrackGarageWheel = (_p, _g, _dx, dy) => {
      this._scrollVelocity = 0;
      this._setThumbScroll(this._thumbScrollY - dy * 0.7);
    };

    this._onTrackGaragePointerDown = (p) => {
      if (!this._thumbViewport || !Phaser.Geom.Rectangle.Contains(this._thumbViewport, p.x, p.y)) {
        this._thumbPointerActive = false;
        this._isDraggingThumbs = false;
        return;
      }

      this._thumbPointerActive = true;
      this._thumbPointerStartY = p.y;

      this._dragStartY = p.y;
      this._dragStartScroll = this._thumbScrollY;
      this._scrollVelocity = 0;
      this._isDraggingThumbs = false;
    };

    this._onTrackGaragePointerMove = (p) => {
      if (!p.isDown || !this._thumbPointerActive) return;

      const rawDelta = p.y - this._thumbPointerStartY;
      if (!this._isDraggingThumbs && Math.abs(rawDelta) > 10) {
        this._isDraggingThumbs = true;
      }

      if (!this._isDraggingThumbs) return;

      const delta = p.y - this._dragStartY;
      const next = this._dragStartScroll + delta;

      this._scrollVelocity = p.velocity.y * 0.16;
      this._setThumbScroll(next);
    };

    this._onTrackGaragePointerUp = () => {
      this._thumbPointerActive = false;
      this._isDraggingThumbs = false;
    };

    this.input.on('wheel', this._onTrackGarageWheel, this);
    this.input.on('pointerdown', this._onTrackGaragePointerDown, this);
    this.input.on('pointermove', this._onTrackGaragePointerMove, this);
    this.input.on('pointerup', this._onTrackGaragePointerUp, this);
    this.input.on('pointerupoutside', this._onTrackGaragePointerUp, this);

    // =========================
    // Panel derecho hero
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

    this._thumbList.y = this._thumbListTopY + this._thumbScrollY;

    if (!this._thumbViewport) return;

    const viewTop = this._thumbViewport.y;
    const viewBottom = this._thumbViewport.y + this._thumbViewport.height;

    for (const t of this._thumbItems) {
      if (!t?.item || !t?.bg || !t?.hit) continue;

      const itemTop = this._thumbList.y + t.item.y;
      const itemBottom = itemTop + t.bg.height;
      const visible = itemBottom > viewTop && itemTop < viewBottom;

      t.hit.setInteractive(visible ? { useHandCursor: true } : false);
    }
  }

  _updateTrackGarage(_time, delta) {
    if (this._isDraggingThumbs) return;
    if (Math.abs(this._scrollVelocity) < 0.01) return;

    this._setThumbScroll(this._thumbScrollY + this._scrollVelocity * (delta / 16.666));
    this._scrollVelocity *= 0.95;

    if (this._thumbScrollY >= 0 || this._thumbScrollY <= this._thumbMinScroll) {
      this._scrollVelocity *= 0.82;
    }
  }

  _createTrackPreviewTexture(track) {
    const key = `track_preview_${track.key.replace(/[:/]/g, '_')}`;
    if (this.textures.exists(key)) return key;

    const W = 420;
    const H = 260;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    g.fillStyle(0x1a1d14, 1);
    g.fillRoundedRect(0, 0, W, H, 22);

    g.fillStyle(0x2d4d1f, 1);
    g.fillRoundedRect(12, 12, W - 24, H - 24, 18);

    const pts = normPts(track.centerline);
    if (pts.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }

      const bw = Math.max(1, maxX - minX);
      const bh = Math.max(1, maxY - minY);
      const inset = 26;
      const sx = (W - inset * 2) / bw;
      const sy = (H - inset * 2) / bh;
      const s = Math.min(sx, sy);

      const ox = Math.floor((W - bw * s) * 0.5);
      const oy = Math.floor((H - bh * s) * 0.5);

      const drawPts = pts.map(p => ({
        x: ox + (p.x - minX) * s,
        y: oy + (p.y - minY) * s
      }));

      // arcenes
      g.lineStyle(20, 0xd9d9d9, 0.95);
      g.beginPath();
      g.moveTo(drawPts[0].x, drawPts[0].y);
      for (let i = 1; i < drawPts.length; i++) g.lineTo(drawPts[i].x, drawPts[i].y);
      g.strokePath();

      // asfalto
      g.lineStyle(14, 0x2e3138, 1);
      g.beginPath();
      g.moveTo(drawPts[0].x, drawPts[0].y);
      for (let i = 1; i < drawPts.length; i++) g.lineTo(drawPts[i].x, drawPts[i].y);
      g.strokePath();

      // línea central sutil
      g.lineStyle(2, 0xffffff, 0.08);
      g.beginPath();
      g.moveTo(drawPts[0].x, drawPts[0].y);
      for (let i = 1; i < drawPts.length; i++) g.lineTo(drawPts[i].x, drawPts[i].y);
      g.strokePath();

      // bandera meta en inicio del trazado
      const p0 = drawPts[0];
      g.fillStyle(0xffffff, 1);
      g.fillRect(p0.x - 5, p0.y - 5, 10, 10);

      g.fillStyle(0x000000, 1);
      g.fillRect(p0.x - 5, p0.y - 5, 5, 5);
      g.fillRect(p0.x, p0.y, 5, 5);
    }

    g.generateTexture(key, W, H);
    g.destroy();
    return key;
  }

  _createThumbItem(x, y, w, h, track, index) {
    const item = this.add.container(x, y);
    this._thumbList.add(item);

    const selected = index === this._selectedIndex;

    const bg = this.add.rectangle(0, 0, w, h, 0x161a11, selected ? 0.82 : 0.56)
      .setOrigin(0)
      .setStrokeStyle(2, selected ? 0x47ff88 : 0xe7ff96, selected ? 0.70 : 0.16);

    const accent = this.add.rectangle(0, 0, 8, h, selected ? 0x47ff88 : 0xffd84d, selected ? 0.95 : 0.78)
      .setOrigin(0);

    const previewKey = this._createTrackPreviewTexture(track);
    const preview = this.add.image(74, h / 2, previewKey);

    const previewScale = Math.min(116 / (preview.width || 1), (h - 18) / (preview.height || 1));
    preview.setScale(previewScale);

    const name = this.add.text(156, 16, track.name.toUpperCase(), {
      fontFamily: 'Orbitron, system-ui, sans-serif',
      fontSize: '16px',
      fontStyle: '900',
      color: '#ffffff'
    });

    const meta = this.add.text(
      156,
      44,
      `${track.brand || 'TDR'} · ${track.category || '—'}\n${track.difficulty || '—'} · ${track.lengthLabel || '—'}`,
      {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '13px',
        color: '#dfe8b0',
        lineSpacing: 4
      }
    );

    item.add([bg, accent, preview, name, meta]);

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0.001)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });

    let pressArmed = false;
    let pressStartY = 0;
    let dragged = false;

    hit.on('pointerdown', (p) => {
      pressArmed = true;
      dragged = false;
      pressStartY = p.y;
    });

    hit.on('pointermove', (p) => {
      if (!pressArmed) return;
      if (Math.abs(p.y - pressStartY) > 10) {
        dragged = true;
      }
    });

    hit.on('pointerup', () => {
      if (!pressArmed) return;
      pressArmed = false;

      if (dragged || this._isDraggingThumbs) return;

      this._selectedIndex = index;
      this._refreshSelection();
    });

    hit.on('pointerout', () => {
      pressArmed = false;
    });

    hit.on('pointerupoutside', () => {
      pressArmed = false;
    });

    item.add(hit);

    return { item, bg, accent, preview, name, meta, hit, track, index };
  }

  _buildHeroPanel(x, y, w, h) {
    this._hero.removeAll(true);
    this._hero.setPosition(0, 0);

    const panel = this.add.graphics();
    panel.fillStyle(0x14170f, 0.36);
    panel.fillRoundedRect(x, y, w, h, 28);
    panel.lineStyle(2, 0xe7ff96, 0.18);
    panel.strokeRoundedRect(x, y, w, h, 28);

    const glow = this.add.graphics();
    glow.fillStyle(0x47ff88, 0.04);
    glow.fillEllipse(x + w * 0.66, y + h * 0.54, w * 0.56, h * 0.66);

    const cardZoneW = Math.floor(w * 0.46);
    const infoX = x + cardZoneW + 18;
    const infoW = w - cardZoneW - 32;

    const heroPreview = this.add.image(x + Math.floor(cardZoneW / 2), y + Math.floor(h * 0.46), '__MISSING')
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
      color: '#47ff88',
      fontStyle: 'bold'
    });

    const meta = this.add.text(infoX, y + 112, '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '15px',
      color: '#e3f1b1',
      lineSpacing: 8,
      wordWrap: { width: infoW }
    });

    const statPanel = this.add.rectangle(infoX + Math.floor(infoW / 2), y + h - 128, infoW, 98, 0x1a2012, 0.62)
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
      this._mode === 'admin' ? 'EDITAR PISTA' : 'SELECCIONAR',
      true
    );

    const btnSecondary = this._makeHeroButton(
      infoX + Math.floor(infoW * 0.60) + 12,
      y + h - 58,
      Math.floor(infoW * 0.34),
      46,
      this._mode === 'admin' ? 'PROBAR' : 'VOLVER',
      false
    );

    this._hero.add([
      panel,
      glow,
      heroPreview,
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

    this._uiRefs.heroPreview = heroPreview;
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
    const bg = this.add.rectangle(x, y, w, h, primary ? 0x47ff88 : 0x1f2416, primary ? 0.95 : 0.78)
      .setOrigin(0)
      .setStrokeStyle(1, primary ? 0xffffff : 0xe7ff96, primary ? 0.22 : 0.18);

    const label = this.add.text(x + w / 2, y + h / 2, labelText, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '15px',
      color: primary ? '#15200c' : '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const hit = this.add.rectangle(x, y, w, h, 0x000000, 0.001)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerdown', () => container.setScale(0.98));
    hit.on('pointerup', () => container.setScale(1));
    hit.on('pointerout', () => container.setScale(1));

    container.add([shadow, bg, label, hit]);
    return { container, hit, label };
  }

  _activatePrimary() {
    const selected = this._tracks[this._selectedIndex];
    if (!selected) return;

    try {
      localStorage.setItem('tdr2:trackKey', selected.key);
    } catch (e) {}

    if (this._mode === 'admin') {
      this.scene.start('track-editor', { trackKey: selected.key });
      return;
    }

    this.scene.start('menu');
  }

  _activateSecondary() {
    const selected = this._tracks[this._selectedIndex];
    if (!selected) return;

    if (this._mode === 'admin') {
      this.scene.start('race', {
        carId: (() => {
          try { return localStorage.getItem('tdr2:carId') || 'stock'; } catch (e) { return 'stock'; }
        })(),
        trackKey: selected.key
      });
      return;
    }

    this.scene.start('menu');
  }

  _refreshSelection() {
    const selected = this._tracks[this._selectedIndex];
    if (!selected) return;

    this._thumbItems.forEach((t, i) => {
      const isSel = i === this._selectedIndex;
      t.bg.setFillStyle(0x161a11, isSel ? 0.82 : 0.56);
      t.bg.setStrokeStyle(2, isSel ? 0x47ff88 : 0xe7ff96, isSel ? 0.70 : 0.16);
      t.accent.setFillStyle(isSel ? 0x47ff88 : 0xffd84d, isSel ? 0.95 : 0.78);
    });

    const selectedThumb = this._thumbItems[this._selectedIndex];
    if (selectedThumb?.item && selectedThumb?.bg && this._thumbViewport) {
      const itemCenterY = selectedThumb.item.y + (selectedThumb.bg.height * 0.5);
      const viewportCenterY = this._thumbViewport.height * 0.5;

      const targetScrollY = viewportCenterY - itemCenterY;
      const clampedTarget = Phaser.Math.Clamp(targetScrollY, this._thumbMinScroll, 0);

      this._scrollVelocity = 0;
      this._thumbPointerActive = false;
      this._isDraggingThumbs = false;

      this.tweens.killTweensOf(this);
      this.tweens.add({
        targets: this,
        _thumbScrollY: clampedTarget,
        duration: 260,
        ease: 'Cubic.easeOut',
        onUpdate: () => this._applyThumbScroll()
      });
    }

    const heroPreview = this._uiRefs.heroPreview;
    const previewKey = this._createTrackPreviewTexture(selected);

    const applyPreview = () => {
      heroPreview.setTexture(previewKey).setVisible(true);

      const { width, height } = this.scale;
      const isLandscape = width >= height;
      const heroMaxW = isLandscape ? width * 0.28 : width * 0.50;
      const heroMaxH = isLandscape ? height * 0.52 : height * 0.34;

      const s = Math.min(
        heroMaxW / (heroPreview.width || 1),
        heroMaxH / (heroPreview.height || 1)
      );

      heroPreview.setScale(s * 0.92);
      heroPreview.setAlpha(0);

      this.tweens.add({
        targets: heroPreview,
        scale: s,
        alpha: 1,
        duration: 180,
        ease: 'Cubic.easeOut'
      });

      try { this._heroPulseTween?.remove(); } catch (e) {}
      this._heroPulseTween = this.tweens.add({
        targets: heroPreview,
        scaleX: heroPreview.scaleX * 1.018,
        scaleY: heroPreview.scaleY * 1.018,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    };

    if (!heroPreview.visible) {
      applyPreview();
    } else {
      this.tweens.add({
        targets: heroPreview,
        alpha: 0,
        scaleX: heroPreview.scaleX * 0.96,
        scaleY: heroPreview.scaleY * 0.96,
        duration: 110,
        ease: 'Quad.easeIn',
        onComplete: applyPreview
      });
    }

    const lengthPx = estimateTrackLength(selected.centerline);
    const lapsHint =
      selected.key === 'track01' ? 'Rápido y fluido'
      : selected.key === 'track02' ? 'Trazada técnica'
      : selected.key === 'track03' ? 'Control lateral'
      : 'Circuito real';

    this._uiRefs.title.setText(selected.name.toUpperCase());
    this._uiRefs.brand.setText(String(selected.brand || 'TDR').toUpperCase());
    this._uiRefs.meta.setText(
      `Categoría: ${selected.category || '—'}\n` +
      `Dificultad: ${selected.difficulty || '—'}\n` +
      `Longitud: ${selected.lengthLabel || '—'}\n` +
      `Estilo: ${lapsHint}`
    );

    this._uiRefs.statText.setText(
      `LONGITUD   ${lengthPx} px\n` +
      `ANCHO      ${Math.round(selected.trackWidth || 0)} px\n` +
      `MUNDO      ${Math.round(selected.worldW || 0)} × ${Math.round(selected.worldH || 0)}`
    );

    this._uiRefs.btnMainLabel.setText(this._mode === 'admin' ? 'EDITAR PISTA' : 'SELECCIONAR');
    this._uiRefs.btnSecondaryLabel.setText(this._mode === 'admin' ? 'PROBAR' : 'VOLVER');
  }
}
