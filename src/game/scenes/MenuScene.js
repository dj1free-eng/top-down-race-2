import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';
import { resolveCarParams } from '../cars/resolveCarParams.js';

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

    // Limpieza
    if (this._ui) {
      this._ui.destroy(true);
      this._ui = null;
    }
    this._ui = this.add.container(0, 0);

    // Fondo sutil (sin ruido)
    const bg = this.add.graphics();
    bg.fillStyle(0x0b1020, 1);
    bg.fillRect(0, 0, width, height);

    bg.fillStyle(0x141b33, 0.35);
    bg.fillRect(0, 0, width, height);

    // brillo suave arriba
    bg.fillStyle(0x2bff88, 0.06);
    bg.fillEllipse(width * 0.55, height * 0.15, width * 0.9, height * 0.55);

    // rejilla MUY ligera (casi nada)
    bg.lineStyle(1, 0xffffff, 0.02);
    const step = 56;
    for (let x = 0; x <= width; x += step) bg.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += step) bg.lineBetween(0, y, width, y);

    this._ui.add(bg);

    // ===== Top bar =====
    const topH = clamp(Math.floor(height * 0.14), 64, 88);
    const pad = clamp(Math.floor(width * 0.03), 14, 24);

    const topBar = this.add.container(0, 0);
    this._ui.add(topBar);

    const topBg = this.add.rectangle(0, 0, width, topH, 0x0b1020, 0.35).setOrigin(0);
    topBg.setStrokeStyle(1, 0xb7c0ff, 0.10);
    topBar.add(topBg);

    // Logo
    const logo = this.add.image(pad + 22, Math.floor(topH / 2), 'logo').setScale(0.25).setOrigin(0.5);
    topBar.add(logo);

    // Título
    const title = this.add.text(pad + 56, Math.floor(topH / 2), 'Top-Down Race 2', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    topBar.add(title);

    // “Moneda” fake (placeholder)
    const chipW = 110;
    const chipH = 34;
    const chipX = width - pad - chipW - 54;

    const chip = this.add.rectangle(chipX, Math.floor((topH - chipH) / 2), chipW, chipH, 0x0b1020, 0.45)
      .setOrigin(0)
      .setStrokeStyle(1, 0xb7c0ff, 0.18);
    const chipText = this.add.text(chipX + chipW / 2, Math.floor(topH / 2), '0 🪙', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#b7c0ff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    topBar.add([chip, chipText]);

    // Settings button
    const gearW = 44;
    const gearX = width - pad - gearW;
    const gear = this.add.rectangle(gearX, Math.floor((topH - 36) / 2), gearW, 36, 0x0b1020, 0.45)
      .setOrigin(0)
      .setStrokeStyle(1, 0xb7c0ff, 0.18)
      .setInteractive({ useHandCursor: true });

    const gearText = this.add.text(gearX + gearW / 2, Math.floor(topH / 2), '⚙', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    gear.on('pointerdown', () => {
      // Placeholder: más adelante abrimos panel settings
      this._toast('Settings (pronto)');
    });

    topBar.add([gear, gearText]);

    // ===== Centro: “hero car” =====
    const centerY0 = topH + 10;
    const bottomH = clamp(Math.floor(height * 0.18), 78, 110);
    const centerH = height - centerY0 - bottomH - 10;
// Evento (tipo Brawl): tarjeta informativa encima del bottom bar
const eventH = clamp(Math.floor(height * 0.13), 54, 76);
const eventY = height - bottomH - eventH - 10;
    const hero = this.add.container(0, centerY0);
    this._ui.add(hero);

    const heroPad = pad;
    const heroW = width - heroPad * 2;
    const heroH = centerH;

    const heroBg = this.add.rectangle(heroPad, 0, heroW, heroH, 0x0b1020, 0.18)
      .setOrigin(0)
      .setStrokeStyle(1, 0xb7c0ff, 0.10);
    hero.add(heroBg);

    // Car card (placeholder visual)
    const cardW = clamp(Math.floor(heroW * 0.52), 320, 520);
    const cardH = clamp(Math.floor(heroH * 0.72), 200, 360);
    const cardX = heroPad + Math.floor((heroW - cardW) / 2);
    const cardY = Math.floor((heroH - cardH) / 2) - 6;

    const carCard = this.add.rectangle(cardX, cardY, cardW, cardH, 0x141b33, 0.45)
      .setOrigin(0)
      .setStrokeStyle(1, 0xb7c0ff, 0.18);
    hero.add(carCard);

    const carId = this.selectedCarId || 'stock';
    const baseSpec = CAR_SPECS[carId] || CAR_SPECS.stock;

    // Stats rápidos (reales)
    const neutralTuning = {
      accelMult: 1.0, brakeMult: 1.0, dragMult: 1.0, turnRateMult: 1.0,
      maxFwdAdd: 0, maxRevAdd: 0, turnMinAdd: 0
    };
    const p = resolveCarParams(baseSpec, neutralTuning);
    const topKmh = (p.maxFwd * 0.12).toFixed(0);

    const carName = this.add.text(cardX + cardW / 2, cardY + 18, (p.name || carId).toUpperCase(), {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    hero.add(carName);

    const carSub = this.add.text(cardX + cardW / 2, cardY + 44, `Punta aprox: ${topKmh} km/h`, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '13px',
      color: '#b7c0ff'
    }).setOrigin(0.5, 0);
    hero.add(carSub);

    // “Ventana” para futura skin del coche (por ahora icono)
    const placeholder = this.add.text(cardX + cardW / 2, cardY + cardH / 2 + 10, '🚗', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '74px',
      color: '#ffffff'
    }).setOrigin(0.5);
    hero.add(placeholder);
    // Animación “viva” tipo lobby (sin cargar assets)
this.tweens.add({
  targets: placeholder,
  y: placeholder.y - 10,
  duration: 900,
  yoyo: true,
  repeat: -1,
  ease: 'Sine.easeInOut'
});
this.tweens.add({
  targets: placeholder,
  angle: 3,
  duration: 1200,
  yoyo: true,
  repeat: -1,
  ease: 'Sine.easeInOut'
});

    // Track label (real)
    const trackLabel = this.add.text(cardX + cardW / 2, cardY + cardH - 44, `Circuito: ${this._trackTitle(this.selectedTrackKey)}`, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '13px',
      color: '#b7c0ff'
    }).setOrigin(0.5);
    hero.add(trackLabel);
// ===== Event card (Brawl-ish) =====
const event = this.add.container(0, eventY);
this._ui.add(event);

const eventPad = pad;
const eventW = width - eventPad * 2;

const eventBg = this.add.rectangle(eventPad, 0, eventW, eventH, 0x141b33, 0.60)
  .setOrigin(0)
  .setStrokeStyle(1, 0xb7c0ff, 0.18);
event.add(eventBg);

// Banda izquierda tipo “modo”
const bandW = clamp(Math.floor(eventW * 0.18), 90, 150);
const band = this.add.rectangle(eventPad, 0, bandW, eventH, 0x2bff88, 0.85).setOrigin(0);
event.add(band);

const bandText = this.add.text(eventPad + bandW / 2, Math.floor(eventH / 2), 'EVENT', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '14px',
  color: '#0b1020',
  fontStyle: 'bold'
}).setOrigin(0.5);
event.add(bandText);

const modeTitle = this.add.text(eventPad + bandW + 14, 12, `Modo: ${this._trackTitle(this.selectedTrackKey)}`, {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '14px',
  color: '#ffffff',
  fontStyle: 'bold'
}).setOrigin(0, 0);
event.add(modeTitle);

const modeSub = this.add.text(eventPad + bandW + 14, 32, 'Recompensa: (próximamente) · Objetivo: mejora tu tiempo', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '12px',
  color: '#b7c0ff'
}).setOrigin(0, 0);
event.add(modeSub);

// Botón “i”
const infoW = 38;
const infoX = width - eventPad - infoW;
const infoBtn = this._makeButton(infoX, 10, infoW, eventH - 20, 'i', () => {
  this._toast('Eventos: más adelante meteremos recompensas y misiones diarias 😉');
});
event.add(infoBtn);

// animación sutil (respira)
this.tweens.add({
  targets: eventBg,
  alpha: { from: 0.58, to: 0.66 },
  duration: 1200,
  yoyo: true,
  repeat: -1,
  ease: 'Sine.easeInOut'
});
    // ===== Bottom bar (Brawl-ish) =====
    const bottomY = height - bottomH;
    const bottom = this.add.container(0, bottomY);
    this._ui.add(bottom);

    const bottomBg = this.add.rectangle(0, 0, width, bottomH, 0x0b1020, 0.55).setOrigin(0);
    bottomBg.setStrokeStyle(1, 0xb7c0ff, 0.10);
    bottom.add(bottomBg);
// Mini progreso (placeholder premium)
const progW = clamp(Math.floor(width * 0.28), 180, 300);
const progH = 16;
const progX = Math.floor(width / 2 - progW / 2);
const progY = 8;

const progBg = this.add.rectangle(progX, progY, progW, progH, 0x0b1020, 0.85)
  .setOrigin(0)
  .setStrokeStyle(1, 0xb7c0ff, 0.35);

const fakeProgress = 0.35; // placeholder
const progFill = this.add.rectangle(
  progX + 2,
  progY + 2,
  Math.floor((progW - 4) * fakeProgress),
  progH - 4,
  0x2bff88,
  1
).setOrigin(0);

const progText = this.add.text(width / 2, progY - 14, 'Progreso · 35%', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '11px',
  color: '#b7c0ff'
}).setOrigin(0.5);

bottom.add([progBg, progFill, progText]);
    // Botón: GARAGE
    const btnH = clamp(Math.floor(bottomH * 0.62), 42, 62);
    const smallW = clamp(Math.floor(width * 0.20), 120, 170);

    const garageBtn = this._makeButton(pad, Math.floor((bottomH - btnH) / 2), smallW, btnH, 'GARAGE', () => {
      this._openOverlay('garage');
    });
    bottom.add(garageBtn);

    // Botón: TRACKS
    const tracksBtn = this._makeButton(width - pad - smallW, Math.floor((bottomH - btnH) / 2), smallW, btnH, 'TRACKS', () => {
      this._openOverlay('tracks');
    });
    bottom.add(tracksBtn);

    // Botón grande: PLAY
    const playW = clamp(Math.floor(width * 0.34), 200, 360);
    const playX = Math.floor(width / 2 - playW / 2);
    const playY = Math.floor((bottomH - btnH) / 2);

    const playBtn = this._makeButton(playX, playY, playW, btnH, '▶ PLAY', () => {
      // Guardar prefs
      try {
        localStorage.setItem('tdr2:carId', this.selectedCarId);
        localStorage.setItem('tdr2:trackKey', this.selectedTrackKey);
      } catch {}

      this.scene.start('race', { carId: this.selectedCarId, trackKey: this.selectedTrackKey });
    }, { primary: true });

    bottom.add(playBtn);

    // Si había overlay abierto, lo reabrimos para no romper resize
    if (this._overlayType) {
      const t = this._overlayType;
      this._overlayType = null;
      this._openOverlay(t);
    }
  }

  // =========================
  // Overlays
  // =========================
  _openOverlay(type) {
    // Cerrar si existe
    if (this._overlay) {
      this._overlay.destroy(true);
      this._overlay = null;
      this._overlayType = null;
    }

    this._overlayType = type;
    const { width, height } = this.scale;
    const pad = clamp(Math.floor(width * 0.03), 14, 24);

    const ov = this.add.container(0, 0);
    this._overlay = ov;
    this._ui.add(ov);

    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0);
    dim.setInteractive(); // captura clicks
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

    // Pills (scroll simple con wrap)
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
        this.renderUI(); // refresca lobby
      });

      pills.push({ id: c.id, g: gg, w: pw });
      row.add(pill);

      cursorX += pw + pillGap;
    });

    // Panel tip
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
        this.renderUI();      // refresca lobby
        this._openOverlay('tracks'); // reabre overlay actualizado
      });

      c.add([bg, header, title, tag, desc, cta]);
      return c;
    };

    const leftX = x + pad;
    const rightX = x + pad * 2 + cardW;

    ov.add(makeCard(leftX, topY, tracks[0]));
    ov.add(makeCard(rightX, topY, tracks[1]));

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
  const bgCol = primary ? 0x2bff88 : 0x141b33;
  const bgAlpha = primary ? 0.92 : 0.55;

  // Sombra/relieve
  const shadow = this.add.rectangle(4, 4, w, h, 0x000000, primary ? 0.25 : 0.18).setOrigin(0);

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

  const setHover = (on) => {
    bg.setAlpha(on ? (primary ? 0.98 : 0.70) : bgAlpha);
    bg.setStrokeStyle(1, on ? 0x2bff88 : (primary ? 0xffffff : 0xb7c0ff), on ? 0.35 : (primary ? 0.22 : 0.18));
  };

  const press = () => {
  c.setScale(0.97);
  c.y += 2;
  shadow.setAlpha(primary ? 0.12 : 0.08);
};

const release = () => {
  c.setScale(1.0);
  c.y -= 2;
  shadow.setAlpha(primary ? 0.25 : 0.18);
};

  hit.on('pointerdown', () => { press(); });
  hit.on('pointerup', () => { release(); onClick && onClick(); });
  hit.on('pointerout', () => { release(); setHover(false); });
  hit.on('pointerover', () => { setHover(true); });

  c.add([shadow, bg, txt, hit]);
  return c;
}
_toast(msg) {
  const { width, height } = this.scale;

  // Colocarlo por encima del bottom bar
  const y = Math.floor(height - (height * 0.18) - 24);

  const t = this.add.text(width / 2, y, msg, {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '14px',
    color: '#2bff88',
    fontStyle: 'bold',
    backgroundColor: 'rgba(11,16,32,0.85)',
    padding: { left: 12, right: 12, top: 6, bottom: 6 }
  })
    .setOrigin(0.5)
    .setAlpha(0)
    .setDepth(999999); // 🔑 siempre encima

  this.tweens.add({
    targets: t,
    alpha: 1,
    duration: 120,
    yoyo: true,
    hold: 900,
    onComplete: () => t.destroy()
  });
}

  _trackTitle(key) {
    if (key === 'track01') return 'Óvalo';
    if (key === 'track02') return 'Técnico';
    return key || '—';
  }
}
