// src/game/dev/CarFactoryScene.js
import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';
import { resolveCarParams } from '../cars/resolveCarParams.js';
import { HANDLING_PROFILES } from '../cars/handlingProfiles.js';
export class CarFactoryScene extends Phaser.Scene {
  constructor() {
    super('factory');
  }

  create() {

// ===========================
// FACTORY STATE
// ===========================
this._factoryCar = structuredClone(CAR_SPECS.stock);
this._selectedCarId = null;
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
// CATÁLOGO
// ===========================
const left = this.add.rectangle(32, 92, 240, h - 170, 0x000000, 0.20)
  .setOrigin(0)
  .setStrokeStyle(1, 0xb7c0ff, 0.10);

this.add.text(44, 102, 'CATÁLOGO', {
  fontFamily: 'system-ui',
  fontSize: '12px',
  color: '#b7c0ff',
  fontStyle: '800'
});

const listStartY = 130;
let listY = listStartY;

const carIds = Object.keys(CAR_SPECS);

this._catalogButtons = [];

for (const id of carIds) {
  const btn = this.add.text(44, listY, id, {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: { left: 6, right: 6, top: 3, bottom: 3 }
  })
  .setInteractive({ useHandCursor: true });

  btn.on('pointerdown', () => {
    this._selectedCarId = id;
    this._factoryCar = structuredClone(CAR_SPECS[id]);
    this._refreshPreview?.();
  });

  this._catalogButtons.push(btn);
  listY += 22;
}
    // NEW BASE
const newBtn = this.add.text(44, h - 90, 'NEW BASE', {
  fontFamily: 'system-ui',
  fontSize: '12px',
  color: '#2cf6ff',
  fontStyle: '800'
})
.setInteractive({ useHandCursor: true });

newBtn.on('pointerdown', () => {
  this._factoryCar = structuredClone(CAR_SPECS.stock);
  this._factoryCar.id = 'new_car';
  this._factoryCar.name = 'New Car';
  this._selectedCarId = null;
  this._refreshPreview?.();
});

// CLONAR
const cloneBtn = this.add.text(44, h - 60, 'CLONAR SELECCIONADO', {
  fontFamily: 'system-ui',
  fontSize: '12px',
  color: '#2cf6ff',
  fontStyle: '800'
})
.setInteractive({ useHandCursor: true });

cloneBtn.on('pointerdown', () => {
  if (!this._selectedCarId) return;

  this._factoryCar = structuredClone(CAR_SPECS[this._selectedCarId]);
  this._factoryCar.id += '_mk1';
  this._factoryCar.name += ' MK1';
  this._refreshPreview?.();
});

    const mid = this.add.rectangle(288, 92, w - 288 - 32, h - 170, 0x000000, 0.14)
      .setOrigin(0)
      .setStrokeStyle(1, 0xb7c0ff, 0.08);

    const midT = this.add.text(300, 102, 'ZONA DE MONTAJE (preview + parámetros)', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#b7c0ff',
      fontStyle: '800'
    });
// ===========================
// PREVIEW
// ===========================
this._previewText = this.add.text(310, 140, '', {
  fontFamily: 'monospace',
  fontSize: '12px',
  color: '#ffffff',
  lineSpacing: 4
});

this._refreshPreview = () => {
  if (!this._factoryCar) return;

  this._previewText.setText(
    `ID: ${this._factoryCar.id}\n` +
    `NAME: ${this._factoryCar.name}\n` +
    `MAX FWD: ${this._factoryCar.maxFwd}\n` +
    `ACCEL: ${this._factoryCar.accel}\n` +
    `TURN: ${this._factoryCar.turnRate}\n` +
    `GRIP: ${this._factoryCar.gripDrive}`
  );
};

// Inicial
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
