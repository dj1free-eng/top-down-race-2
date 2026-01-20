import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';
import { resolveCarParams } from '../cars/resolveCarParams.js';
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
    this._ui = null;
    this.selectedCarId = 'stock';
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b1020');

    // Re-render al cambiar tamaño/orientación
    this.scale.on('resize', () => this.renderUI());

    this.renderUI();
  }

  renderUI() {
    const { width, height } = this.scale;

    // Limpiar UI anterior si existe
    if (this._ui) {
      this._ui.destroy(true);
      this._ui = null;
    }

    const root = this.add.container(0, 0);
    this._ui = root;

    // Fondo sutil
    const g = this.add.graphics();
    g.fillStyle(0x141b33, 0.65);
    g.fillRect(0, 0, width, height);

    g.lineStyle(1, 0xffffff, 0.03);
    const step = 48;
    for (let x = 0; x <= width; x += step) g.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += step) g.lineBetween(0, y, width, y);

    root.add(g);

    const isPortrait = height >= width;

    // Logo + títulos
    const logoY = Math.floor(height * (isPortrait ? 0.16 : 0.22));
    const titleY = Math.floor(height * (isPortrait ? 0.29 : 0.36));

    root.add(this.add.image(width / 2, logoY, 'logo').setScale(isPortrait ? 0.48 : 0.55));

    root.add(this.add.text(width / 2, titleY, 'Top-Down Race 2', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: isPortrait ? '28px' : '34px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    root.add(this.add.text(width / 2, titleY + 30, 'Elige circuito', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#b7c0ff'
    }).setOrigin(0.5));

    // ===== Selector de coche (píldoras) =====
    const cars = Object.values(CAR_SPECS || {});
    try {
      this.selectedCarId = localStorage.getItem('tdr2:carId') || 'stock';
    } catch {
      this.selectedCarId = 'stock';
    }

    const carLabel = this.add.text(width / 2, titleY + 54, 'Elige coche', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '13px',
      color: '#b7c0ff'
    }).setOrigin(0.5);
    root.add(carLabel);

    const pillRow = this.add.container(0, 0);
    root.add(pillRow);

    const pillH = 34;
    const pillPadX = 14;
    const pillGap = 10;

    const pills = [];

    const drawPill = (gg, w, selected) => {
      gg.clear();
      gg.fillStyle(0x0b1020, selected ? 0.65 : 0.35);
      gg.fillRoundedRect(0, 0, w, pillH, 16);
      gg.lineStyle(1, selected ? 0x2bff88 : 0xb7c0ff, selected ? 0.65 : 0.25);
      gg.strokeRoundedRect(0, 0, w, pillH, 16);
    };

    cars.forEach((c) => {
      const label = c?.name || c?.id || 'car';
      const textObj = this.add.text(pillPadX, 8, label, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '13px',
        color: '#ffffff'
      });

      const w = Math.max(120, textObj.width + pillPadX * 2);

      const gg = this.add.graphics();
      drawPill(gg, w, c.id === this.selectedCarId);

      const hit = this.add.rectangle(0, 0, w, pillH, 0x000000, 0.001)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });

      const pill = this.add.container(0, 0, [gg, textObj, hit]);

      hit.on('pointerdown', () => {
        this.selectedCarId = c.id;
        try { localStorage.setItem('tdr2:carId', c.id); } catch {}
        pills.forEach(p => drawPill(p.g, p.w, p.id === this.selectedCarId));
     renderCarStats();
      });

      pills.push({ id: c.id, g: gg, w });
      pillRow.add(pill);
    });

    // Layout horizontal centrado
    let totalW = 0;
for (let i = 0; i < pills.length; i++) {
  totalW += pills[i].w;
}
totalW += pillGap * (pills.length - 1);

let xCursor = -Math.floor(totalW / 2);

    pillRow.setPosition(width / 2, titleY + 78);

    pills.forEach((p, idx) => {
      const pill = pillRow.list[idx];
      pill.x = xCursor;
      pill.y = 0;
      xCursor += p.w + pillGap;
    });
// === Stats del coche seleccionado ===
const neutralTuning = {
  accelMult: 1.0,
  brakeMult: 1.0,
  dragMult: 1.0,
  turnRateMult: 1.0,
  maxFwdAdd: 0,
  maxRevAdd: 0,
  turnMinAdd: 0
};

const statsBoxW = cardW;
const statsBoxH = 110;

const statsX = Math.floor((width - statsBoxW) / 2);
const statsY = titleY + 118; // debajo de las pills

const statsBg = this.add.rectangle(statsX, statsY, statsBoxW, statsBoxH, 0x0b1020, 0.28)
  .setOrigin(0)
  .setStrokeStyle(1, 0xb7c0ff, 0.18);

const statsText = this.add.text(statsX + 16, statsY + 12, '', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '13px',
  color: '#ffffff',
  lineSpacing: 6
});

root.add(statsBg);
root.add(statsText);

const renderCarStats = () => {
  const carId = this.selectedCarId || 'stock';
  const baseSpec = CAR_SPECS[carId] || CAR_SPECS.stock;
  const p = resolveCarParams(baseSpec, neutralTuning);

  // Nota: tu HUD usa kmh = speed * 0.12, así que para “punta aprox” usamos maxFwd * 0.12
  const topKmh = (p.maxFwd * 0.12).toFixed(0);
  const revKmh = (p.maxRev * 0.12).toFixed(0);

  statsText.setText(
    `Coche: ${p.name || carId}\n` +
    `Punta aprox: ${topKmh} km/h   |   Marcha atrás: ${revKmh} km/h\n` +
    `Aceleración: ${p.accel}   |   Freno: ${p.brakeForce}\n` +
    `Giro: ${p.turnRate}   |   Derrape (drive): ${p.gripDrive}`
  );
};

// Pintar una vez al entrar
renderCarStats();
    // ===== Cards de circuitos =====
    const tracks = [
      {
        key: 'track01',
        title: 'Track 01 — Óvalo de velocidad',
        desc: 'Curvas largas, pista ancha.\nDiseñado para aprender a ir rápido sin morir.',
        tag: 'SPEED'
      },
      {
        key: 'track02',
        title: 'Track 02 — Técnico',
        desc: 'Chicane + horquilla + enlazadas.\nAquí se ve quién frena… y quién reza.',
        tag: 'TECH'
      }
    ];

    const toast = this.add.text(width / 2, Math.floor(height * 0.92), '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#2bff88'
    }).setOrigin(0.5).setAlpha(0);
    root.add(toast);

    const pad = 16;
    const cardW = clamp(Math.floor(width - pad * 2), 260, isPortrait ? 520 : 460);
    const cardH = 170;
    const gap = 14;

    // OJO: como ahora metimos selector de coche arriba, bajamos un pelín el topY
    const topY = Math.floor(height * (isPortrait ? 0.43 : 0.52));

    const makeCard = (x, y, t) => {
      const container = this.add.container(x, y);

      const bg = this.add.rectangle(0, 0, cardW, cardH, 0x0b1020, 0.35)
        .setStrokeStyle(1, 0xb7c0ff, 0.25)
        .setOrigin(0);

      const header = this.add.rectangle(0, 0, cardW, 44, 0x0b1020, 0.55).setOrigin(0);

      const tag = this.add.text(cardW - 16, 13, t.tag, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '12px',
        color: '#b7c0ff',
        fontStyle: 'bold'
      }).setOrigin(1, 0);

      const title = this.add.text(16, 12, t.title, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: cardW - 32 }
      });

      const desc = this.add.text(16, 60, t.desc, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '13px',
        color: '#b7c0ff',
        lineSpacing: 5,
        wordWrap: { width: cardW - 32 }
      });

      const cta = this.add.text(16, cardH - 28, 'Seleccionar →', {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '13px',
        color: '#2bff88',
        fontStyle: 'bold'
      });

      bg.setInteractive({ useHandCursor: true });

      bg.on('pointerover', () => {
        bg.setFillStyle(0x0b1020, 0.50);
        bg.setStrokeStyle(1, 0x2bff88, 0.35);
      });

      bg.on('pointerout', () => {
        bg.setFillStyle(0x0b1020, 0.35);
        bg.setStrokeStyle(1, 0xb7c0ff, 0.25);
      });

      bg.on('pointerdown', () => {
        this.registry.set('selectedTrack', t.key);

        toast.setText(`Seleccionado: ${t.title}`);
        this.tweens.killTweensOf(toast);
        toast.setAlpha(0);
        this.tweens.add({ targets: toast, alpha: 1, duration: 120, yoyo: true, hold: 450 });

        // Entrar a carrera
        this.time.delayedCall(250, () => {
          this.scene.start('race', { carId: this.selectedCarId, trackKey: t.key });
        });
      });

      container.add([bg, header, title, tag, desc, cta]);
      return container;
    };

    if (isPortrait) {
      const x = Math.floor((width - cardW) / 2);
      const c1 = makeCard(x, topY, tracks[0]);
      const c2 = makeCard(x, topY + cardH + gap, tracks[1]);
      root.add([c1, c2]);
    } else {
      const gapH = 18;
      const totalCardsW = cardW * 2 + gapH;
      const leftX = Math.floor(width / 2 - totalCardsW / 2);
      const c1 = makeCard(leftX, topY, tracks[0]);
      const c2 = makeCard(leftX + cardW + gapH, topY, tracks[1]);
      root.add([c1, c2]);
    }

    root.add(this.add.text(width / 2, Math.floor(height * 0.84), 'Tip: abre una vez, luego modo avión y recarga (PWA).', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#b7c0ff'
    }).setOrigin(0.5));
  }
}
