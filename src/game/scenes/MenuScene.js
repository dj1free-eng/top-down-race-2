import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';
import { resolveCarParams } from '../cars/resolveCarParams.js';
import { DEV_FACTORY } from '../dev/devFlags.js';

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
    this._ui = null;

    // Persistencia (mínima y segura)
    this.selectedCarId = 'stock';
    this.selectedTrackKey = 'track02';

    // Overlays
    this._overlay = null;
    this._overlayType = null; // 'garage' | 'tracks'

    // Cache para no reintentar skins que no existen
    this._skinFail = new Set();
  }

  init(data) {
    // Si venimos desde "Salir ADMIN", forzamos estado jugador (determinista)
    if (data?.forcePlayer) {
      try { localStorage.setItem('tdr2:admin', '0'); } catch {}
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b1020');

    // Leer prefs
    try {
      this.selectedCarId = localStorage.getItem('tdr2:carId') || 'stock';
      this.selectedTrackKey = localStorage.getItem('tdr2:trackKey') || 'track02';
    } catch {}

    // Re-render al cambiar tamaño/orientación
    this.scale.on('resize', () => this.renderUI());

    this.renderUI();
  }

  // =========================
  // Render principal (Lobby)
  // =========================
  renderUI() {
    const { width, height } = this.scale;

    // 1) Limpieza (siempre lo primero)
    if (this._ui) {
      this._ui.destroy(true);
      this._ui = null;
    }
    this._ui = this.add.container(0, 0);

    // 2) Layout base (SIEMPRE antes de usar pad/topH/bottomH)
    const topH = clamp(Math.floor(height * 0.14), 64, 88);
    const pad = clamp(Math.floor(width * 0.03), 14, 24);

    const bottomH = clamp(Math.floor(height * 0.18), 78, 110);
    const bottomY = height - bottomH;

    const centerY0 = topH + 10;
    const centerH = height - centerY0 - bottomH - 10;

    // 3) Fondo (imagen estilo foto 2)
    const bg = this.add.image(width / 2, height / 2, 'menu_bg')
      .setOrigin(0.5)
      .setDepth(0);

    const fitCover = (img) => {
      const sw = this.scale.width;
      const sh = this.scale.height;
      const sx = sw / (img.width || 1);
      const sy = sh / (img.height || 1);
      const s = Math.max(sx, sy); // cover
      img.setScale(s);
      img.setPosition(sw / 2, sh / 2);
    };
    fitCover(bg);
    this._ui.add(bg);

    // =========================
    // Top bar (minimal: solo engranaje)
    // =========================
    const topBar = this.add.container(0, 0);
topBar.setDepth(40);
this._ui.add(topBar);

    // Settings button
    const gearW = 44;
    const gearX = width - pad - gearW;
    const gear = this.add.rectangle(
      gearX,
      Math.floor((topH - 36) / 2),
      gearW,
      36,
      0x0b1020,
      0.45
    )
      .setOrigin(0)
      .setStrokeStyle(1, 0xb7c0ff, 0.18)
      .setInteractive({ useHandCursor: true });

    const gearText = this.add.text(gearX + gearW / 2, Math.floor(topH / 2), '⚙', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    gear.on('pointerdown', () => {
      this._toast('Settings (pronto)');
    });

    topBar.add([gear, gearText]);

// =========================
// Centro: HERO (coche grande + ficha debajo) estilo referencia
// =========================
{
  const hero = this.add.container(0, centerY0);
  hero.setDepth(10);
  this._ui.add(hero);

  const heroPad = pad;
  const heroW = width - heroPad * 2;
  const heroH = centerH;

  // (debug opcional)
  // const heroBg = this.add.rectangle(heroPad, 0, heroW, heroH, 0x0b1020, 0.06).setOrigin(0);
  // hero.add(heroBg);

  const carId = this.selectedCarId || 'stock';
  const baseSpec = CAR_SPECS[carId] || CAR_SPECS.stock;

  // Stats rápidos (reales)
  const neutralTuning = {
    accelMult: 1.0, brakeMult: 1.0, dragMult: 1.0, turnRateMult: 1.0,
    maxFwdAdd: 0, maxRevAdd: 0, turnMinAdd: 0
  };
  const p = resolveCarParams(baseSpec, neutralTuning);
  const topKmh = (p.maxFwd * 0.12).toFixed(0);

  // Preview coche: skin real si existe, si no fallback a 'car'
  this._ensureCarTexture();
  this._tryEnsureSkinTexture(carId);

  let texKey = this._previewTextureKey(carId);
  if (!this.textures.exists(texKey)) texKey = 'car';

  // --- COCHE GRANDE ---
  const carCenterX = heroPad + Math.floor(heroW / 2);
const carCenterY = Math.floor(heroH * 0.48);

  const carPreview = this.add.sprite(carCenterX, carCenterY, texKey).setOrigin(0.5);

  const refitBigCar = () => {
    // 👇 aquí está la magia: más grande tipo referencia
    const maxW = heroW * 0.48;      // antes era muy chico
    const maxH = heroH * 0.58;      // ocupa más alto

    const sw = carPreview.width || 1;
    const sh = carPreview.height || 1;

    let s = Math.min(maxW / sw, maxH / sh);
    s = clamp(s, 0.25, 5.0);
    carPreview.setScale(s);
  };

  refitBigCar();
  this.time.delayedCall(0, () => {
    if (!carPreview || !carPreview.active) return;
    refitBigCar();
  });

  hero.add(carPreview);

  // Flotación sutil (como en tu versión, pero menos “mareo”)
  this.tweens.add({
    targets: carPreview,
    y: carPreview.y - 8,
    duration: 950,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

// =========================
// FICHA estilo referencia real
// =========================

const headerY = Math.floor(heroH * 0.18);

// ---- NOMBRE (FUERA de la pill) ----
const nameText = this.add.text(carCenterX, headerY, (p.name || carId).toUpperCase(), {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '30px',
  color: '#ffffff',
  fontStyle: 'bold'
}).setOrigin(0.5);

hero.add(nameText);

// ---- línea fina debajo del nombre ----
const lineW = heroW * 0.55;
const line = this.add.rectangle(
  carCenterX - lineW / 2,
  headerY + 26,
  lineW,
  2,
  0xffffff,
  0.18
).setOrigin(0);

hero.add(line);

// ---- PILL SOLO PARA STATS ----
const pillW = clamp(Math.floor(heroW * 0.72), 360, 760);
const pillH = 70;
const pillX = carCenterX - pillW / 2;
const pillY = headerY + 40;

const pill = this.add.rectangle(pillX, pillY, pillW, pillH, 0x0b1020, 0.35)
  .setOrigin(0)
  .setStrokeStyle(1, 0xb7c0ff, 0.22);

hero.add(pill);

// ---- STATS centradas en 3 columnas ----
const statY = pillY + pillH / 2;

const colOffset = pillW * 0.28;

const statStyle = {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '18px',
  color: '#b7c0ff',
  fontStyle: 'bold'
};

hero.add(
  this.add.text(carCenterX - colOffset, statY, `${topKmh} km/h`, statStyle)
    .setOrigin(0.5)
);

hero.add(
  this.add.text(carCenterX, statY, this._trackTitle(this.selectedTrackKey), statStyle)
    .setOrigin(0.5)
);

hero.add(
  this.add.text(carCenterX + colOffset, statY, 'Grip medio', statStyle)
    .setOrigin(0.5)
);

// =========================
// Panel evento (SOLO imagen) -> IZQUIERDA (más pequeño + más arriba)
// =========================
{
  const isLandscape = width >= height * 1.05;

  // 👇 Un pelín más pequeño que antes (para que no invada el botón central)
  const panelTargetW = isLandscape
    ? clamp(Math.floor(width * 0.31), 240, 480)   // antes 0.34 / 260 / 520
    : clamp(Math.floor(width * 0.78), 300, 600); // antes 0.82 / 320 / 620

  // Container del panel
  const eventPanel = this.add.container(0, 0);
  eventPanel.setDepth(20);
  this._ui.add(eventPanel);

  // Imagen del panel
  const panelImg = this.add.image(0, 0, 'panel_event').setOrigin(0.5);
  const panelScale = panelTargetW / (panelImg.width || 1);
  panelImg.setScale(panelScale);
  eventPanel.add(panelImg);

  // Medidas escaladas
  const pw = (panelImg.width || 1) * panelScale;
  const ph = (panelImg.height || 1) * panelScale;

  // 👇 Posición: izquierda + un pelín más arriba
  const panelX = pad + Math.floor(pw / 2);

  // subir un poco extra (ph * 0.08) + un toque fijo
  const extraUp = Math.floor(ph * 0.08) + 6;

const panelY = bottomY - pad - Math.floor(ph / 2) - Math.floor(ph * 0.50);

  eventPanel.setPosition(panelX, panelY);
}
    
// =========================
// Botonera (foto 2) — GARAGE / FACTORY / TRACKS
// =========================
const bottom = this.add.container(0, bottomY);
bottom.setDepth(50);
this._ui.add(bottom);

// Y relativo al container bottom
const btnY = Math.floor(bottomH / 2);

// Tamaños objetivos por tipo de botón
const sideW   = clamp(Math.floor(width * 0.24), 120, 190); // Garage/Tracks
const midW    = clamp(Math.floor(width * 0.30), 150, 240); // Factory (un poco más grande)
const playW   = clamp(Math.floor(width * 0.42), 220, 360); // Arrancar motor (barra ancha)

// Posiciones X
const xGarage  = pad + Math.floor(sideW / 2);
const xTracks  = width - pad - Math.floor(sideW / 2);
const xFactory = Math.floor(width / 2);

const makeImgBtn = (x, key, targetW, onClick) => {
  const img = this.add.image(x, btnY, key)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  const baseScale = targetW / (img.width || 1);
  img.setScale(baseScale);

  img.on('pointerdown', () => img.setScale(baseScale * 0.96));
  img.on('pointerup', () => { img.setScale(baseScale); onClick && onClick(); });
  img.on('pointerout', () => img.setScale(baseScale));

  bottom.add(img);
  return img;
};

// GARAGE
makeImgBtn(xGarage, 'btn_garage', sideW, () => {
  this.scene.start('GarageScene', { mode: 'player' });
});

// FACTORY (si tienes Scene DEV / tuning / lo que sea)
makeImgBtn(xFactory, 'btn_factory', midW, () => {
  // Ajusta el destino real según tu proyecto:
  // - si tienes CarFactoryScene: this.scene.start('CarFactoryScene');
  // - si es otra: cámbialo aquí
  if (DEV_FACTORY) this.scene.start('CarFactoryScene');
  else this._toast('Factory (pronto)');
});

// TRACKS
makeImgBtn(xTracks, 'btn_tracks', sideW, () => {
  this._openOverlay('tracks');
});
      // ✅ FIN renderUI()
  }
// =========================
// PLAY grande (ARRANCAR MOTOR) — SIN colisión de variables
// =========================
{
const bigPlayY = Math.floor(height - bottomH - (centerH * 0.18));
  const bigPlayW = clamp(Math.floor(width * 0.46), 260, 420);

  const bigPlayBtn = this.add.image(Math.floor(width / 2), bigPlayY, 'btn_play')
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .setDepth(60);

  const bigPlayScale = bigPlayW / (bigPlayBtn.width || 1);
  bigPlayBtn.setScale(bigPlayScale);

  bigPlayBtn.on('pointerdown', () => bigPlayBtn.setScale(bigPlayScale * 0.97));
  bigPlayBtn.on('pointerup', () => {
    bigPlayBtn.setScale(bigPlayScale);
    try {
      localStorage.setItem('tdr2:carId', this.selectedCarId);
      localStorage.setItem('tdr2:trackKey', this.selectedTrackKey);
    } catch {}
    this.scene.start('race', {
      carId: this.selectedCarId,
      trackKey: this.selectedTrackKey
    });
  });
  bigPlayBtn.on('pointerout', () => bigPlayBtn.setScale(bigPlayScale));

  this._ui.add(bigPlayBtn);
}
// ✅ CIERRE DE renderUI() (esto te faltaba)
}
  // =========================
  // Overlays
  // =========================
  _openOverlay(type) {
    if (this._overlay) {
      this._overlay.destroy(true);
      this._overlay = null;
      this._overlayType = null;
    }

    this._overlayType = type;
    const { width, height } = this.scale;

    const ov = this.add.container(0, 0);
    this._overlay = ov;
    this._ui.add(ov);

    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0);
    dim.setInteractive();
    dim.on('pointerdown', () => this._closeOverlay());
    ov.add(dim);

    const panelW = clamp(Math.floor(width * 0.72), 340, 760);
    const panelH = clamp(Math.floor(height * 0.70), 240, 520);
    const panelX = Math.floor(width / 2 - panelW / 2);
    const panelY = Math.floor(height / 2 - panelH / 2);

    const panel = this.add.rectangle(panelX, panelY, panelW, panelH, 0x0b1020, 0.92)
      .setOrigin(0)
      .setStrokeStyle(1, 0xb7c0ff, 0.22);
    ov.add(panel);

    const headerH = 52;
    const header = this.add.rectangle(panelX, panelY, panelW, headerH, 0x141b33, 0.65).setOrigin(0);
    ov.add(header);

    const title = this.add.text(panelX + 16, panelY + 16, type === 'garage' ? 'GARAGE' : 'TRACKS', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    ov.add(title);

    const closeBtn = this._makeButton(panelX + panelW - 44, panelY + 10, 34, 32, '✕', () => this._closeOverlay());
    ov.add(closeBtn);

    if (type === 'garage') {
      this._renderGarage(panelX, panelY + headerH, panelW, panelH - headerH);
    } else {
      this._renderTracks(panelX, panelY + headerH, panelW, panelH - headerH);
    }
  }

  _closeOverlay() {
    if (this._overlay) {
      this._overlay.destroy(true);
      this._overlay = null;
      this._overlayType = null;
    }
  }

  _renderGarage(x, y, w, h) {
    const ov = this._overlay;
    if (!ov) return;

    const pad = 16;
    const cars = Object.values(CAR_SPECS || {});
    const listY = y + pad;

    const info = this.add.text(x + pad, y + pad, 'Elige coche:', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '13px',
      color: '#b7c0ff'
    });
    ov.add(info);

    const row = this.add.container(0, 0);
    ov.add(row);

    const pillH = 36;
    const pillGap = 10;
    const pillPadX = 14;

    function drawPill(scene, gg, pw, selected) {
      gg.clear();
      gg.fillStyle(0x141b33, selected ? 0.85 : 0.45);
      gg.fillRoundedRect(0, 0, pw, pillH, 16);
      gg.lineStyle(1, selected ? 0x2bff88 : 0xb7c0ff, selected ? 0.65 : 0.22);
      gg.strokeRoundedRect(0, 0, pw, pillH, 16);
    }

    const pills = [];
    let cursorX = x + pad;
    let cursorY = listY + 28;
    const maxX = x + w - pad;

    cars.forEach((c) => {
      const label = (c?.name || c?.id || 'car');
      const textObj = this.add.text(pillPadX, 9, label, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '13px',
        color: '#ffffff'
      });

      const pw = Math.max(120, textObj.width + pillPadX * 2);
      if (cursorX + pw > maxX) {
        cursorX = x + pad;
        cursorY += pillH + pillGap;
      }

      const gg = this.add.graphics();
      drawPill(this, gg, pw, c.id === this.selectedCarId);

      const hit = this.add.rectangle(0, 0, pw, pillH, 0x000000, 0.001)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });

      const pill = this.add.container(cursorX, cursorY, [gg, textObj, hit]);
      hit.on('pointerdown', () => {
        this.selectedCarId = c.id;
        try { localStorage.setItem('tdr2:carId', c.id); } catch {}
        pills.forEach(p => drawPill(this, p.g, p.w, p.id === this.selectedCarId));
        this._toast(`Coche: ${label}`);
        this._tryEnsureSkinTexture(this.selectedCarId);
        this.renderUI();
      });

      pills.push({ id: c.id, g: gg, w: pw });
      row.add(pill);

      cursorX += pw + pillGap;
    });

    const tip = this.add.text(x + pad, y + h - 26, 'Tip: el coche elegido se guarda automáticamente.', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#b7c0ff'
    });
    ov.add(tip);
  }

  _renderTracks(x, y, w, h) {
    const ov = this._overlay;
    if (!ov) return;

    const pad = 16;

    const tracks = [
      {
        key: 'track01',
        title: 'Track 01 — Óvalo de velocidad',
        desc: 'Curvas largas, pista ancha.\nPara aprender a ir rápido sin morir.',
        tag: 'SPEED'
      },
      {
        key: 'track02',
        title: 'Track 02 — Técnico',
        desc: 'Chicane + horquilla + enlazadas.\nAquí se ve quién frena… y quién reza.',
        tag: 'TECH'
      },
      {
        key: 'track03',
        title: 'Track 03 — Drift Test',
        desc: 'Pista ancha y enlazada.\nHecha para derrapar y encadenar.',
        tag: 'DRIFT'
      }
    ];

    const info = this.add.text(x + pad, y + pad, 'Elige circuito:', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '13px',
      color: '#b7c0ff'
    });
    ov.add(info);

    const cardW = clamp(Math.floor((w - pad * 3) / 2), 220, 360);
    const cardH = clamp(Math.floor(h * 0.62), 150, 240);
    const topY = y + 44;

    const makeCard = (cx, cy, t) => {
      const c = this.add.container(cx, cy);

      const selected = (t.key === this.selectedTrackKey);

      const bg = this.add.rectangle(0, 0, cardW, cardH, 0x141b33, selected ? 0.85 : 0.50)
        .setOrigin(0)
        .setStrokeStyle(1, selected ? 0x2bff88 : 0xb7c0ff, selected ? 0.6 : 0.22)
        .setInteractive({ useHandCursor: true });

      const header = this.add.rectangle(0, 0, cardW, 44, 0x0b1020, 0.35).setOrigin(0);

      const tag = this.add.text(cardW - 14, 13, t.tag, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '12px',
        color: '#b7c0ff',
        fontStyle: 'bold'
      }).setOrigin(1, 0);

      const title = this.add.text(14, 12, t.title, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: cardW - 28 }
      });

      const desc = this.add.text(14, 60, t.desc, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '13px',
        color: '#b7c0ff',
        lineSpacing: 5,
        wordWrap: { width: cardW - 28 }
      });

      const cta = this.add.text(14, cardH - 28, selected ? 'Seleccionado ✓' : 'Seleccionar →', {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '13px',
        color: selected ? '#2bff88' : '#ffffff',
        fontStyle: 'bold'
      });

      bg.on('pointerdown', () => {
        this.selectedTrackKey = t.key;
        try { localStorage.setItem('tdr2:trackKey', t.key); } catch {}
        this._toast(`Circuito: ${t.title}`);
        this.renderUI();
        this._openOverlay('tracks');
      });

      c.add([bg, header, title, tag, desc, cta]);
      return c;
    };

    const leftX = x + pad;
    const rightX = x + pad * 2 + cardW;

    ov.add(makeCard(leftX, topY, tracks[0]));
    ov.add(makeCard(rightX, topY, tracks[1]));
    ov.add(makeCard(leftX, topY + cardH + 14, tracks[2]));

    const tip = this.add.text(x + pad, y + h - 26, 'Tip: el circuito elegido se usa al pulsar PLAY.', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#b7c0ff'
    });
    ov.add(tip);
  }

  // =========================
  // UI helpers
  // =========================
  _makeButton(x, y, w, h, label, onClick, opts = {}) {
    const c = this.add.container(x, y);

    const primary = !!opts.primary;
    const accent = opts.accent ?? null;
    const bgCol = primary ? 0x2bff88 : (accent ?? 0x141b33);
    const bgAlpha = primary ? 0.92 : 0.55;

    const shadow = this.add.rectangle(4, 4, w, h, 0x000000, primary ? 0.25 : 0.18).setOrigin(0);
    const topHi = this.add.rectangle(2, 2, w - 4, Math.max(6, Math.floor(h * 0.28)), 0xffffff, primary ? 0.18 : 0.10).setOrigin(0);
    const bg = this.add.rectangle(0, 0, w, h, bgCol, bgAlpha).setOrigin(0);
    bg.setStrokeStyle(1, primary ? 0xffffff : 0xb7c0ff, primary ? 0.22 : 0.18);

    const txt = this.add.text(w / 2, h / 2, label, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: primary ? '16px' : '14px',
      color: primary ? '#0b1020' : '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0.001)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });

    const press = () => { c.setScale(0.97); c.y += 2; shadow.setAlpha(primary ? 0.12 : 0.08); };
    const release = () => { c.setScale(1.0); c.y -= 2; shadow.setAlpha(primary ? 0.25 : 0.18); };

    hit.on('pointerdown', () => press());
    hit.on('pointerup', () => { release(); onClick && onClick(); });
    hit.on('pointerout', () => release());

    let glow = null;
    if (primary) {
      glow = this.add.rectangle(-6, -6, w + 12, h + 12, 0x2bff88, 0.10).setOrigin(0);
    }

    c.add([glow, shadow, bg, topHi, txt, hit].filter(Boolean));
    return c;
  }

  _toast(msg) {
    const { width, height } = this.scale;
    const y = Math.floor(height - (height * 0.18) - 24);

    const t = this.add.text(width / 2, y, msg, {
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

  _ensureCarTexture() {
    if (this.textures.exists('car')) return;

    const w = 42;
    const h = 22;

    const g = this.add.graphics();

    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(w * 0.52, h * 0.78, w * 0.85, h * 0.45);

    g.fillStyle(0xff3b30, 1);
    g.fillRoundedRect(6, 10, w - 12, 10, 6);

    g.fillStyle(0xff6b63, 1);
    g.fillRoundedRect(14, 6, 16, 8, 5);

    g.fillStyle(0x9fe7ff, 0.9);
    g.fillRoundedRect(16, 7, 12, 6, 4);

    g.fillStyle(0x222222, 1);
    g.fillCircle(14, 21, 4);
    g.fillCircle(w - 14, 21, 4);

    g.fillStyle(0xaaaaaa, 1);
    g.fillCircle(14, 21, 2);
    g.fillCircle(w - 14, 21, 2);

    g.generateTexture('car', w + 4, h + 6);
    g.destroy();
  }

  _skinKey(carId) {
    return `skin:${carId}`;
  }

  _tryEnsureSkinTexture(carId) {
    if (!carId) return;

    const key = this._skinKey(carId);

    if (this.textures.exists(key)) return;
    if (this._skinFail?.has(carId)) return;

    const url = `assets/skins/skin_${carId}.webp`;

    this.load.image(key, url);

    const onFileComplete = (k) => {
      if (k !== key) return;
      cleanup();
      this.renderUI();
    };

    const onLoadError = (file) => {
      if (!file || file.key !== key) return;
      cleanup();
      this._skinFail.add(carId);
      this.renderUI();
    };

    const cleanup = () => {
      this.load.off('filecomplete-image-' + key, onFileComplete);
      this.load.off('loaderror', onLoadError);
    };

    this.load.once('filecomplete-image-' + key, onFileComplete);
    this.load.on('loaderror', onLoadError);

    if (!this.load.isLoading()) this.load.start();
  }

  _previewTextureKey(carId) {
    const key = this._skinKey(carId);
    if (this.textures.exists(key)) return key;
    return 'car';
  }

  _trackTitle(key) {
    if (key === 'track01') return 'Óvalo';
    if (key === 'track02') return 'Técnico';
    if (key === 'track03') return 'Drift';
    return key || '—';
  }
}
