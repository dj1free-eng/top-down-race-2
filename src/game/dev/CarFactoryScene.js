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
// LAYOUT (grid limpio)
// ===========================
const M = 16;
const headerH = 76;
const footerH = 70;
const gap = 16;

const uiW = this.scale.width;
const uiH = this.scale.height;

const leftW = 260;

const topY = 16 + headerH;
const bottomY = uiH - 16 - footerH;
const contentH = bottomY - topY;

const leftX = 32;
const leftY = topY;
const leftH = contentH;

const midX = leftX + leftW + gap;
const midY = topY;
const midW = uiW - 32 - midX;
const midH = contentH;

// Mover el botón MENU a footer derecha (para que no choque con catálogo)
backR.setPosition(uiW - 32 - 140, uiH - 60);
backT.setPosition(uiW - 32 - 140 + 70, uiH - 60 + 19);

// ===========================
// CATÁLOGO (con scroll y botones en zona fija)
// ===========================
const left = this.add.rectangle(leftX, leftY, leftW, leftH, 0x000000, 0.20)
  .setOrigin(0)
  .setStrokeStyle(1, 0xb7c0ff, 0.10);

this.add.text(leftX + 12, leftY + 10, 'CATÁLOGO', {
  fontFamily: 'system-ui',
  fontSize: '12px',
  color: '#b7c0ff',
  fontStyle: '800'
});

// Área visible del listado (con máscara)
const listPad = 12;
const listTop = leftY + 34;
const actionsH = 96; // espacio fijo para botones abajo
const listH = leftH - (listTop - leftY) - actionsH;

const maskRect = this.add.rectangle(leftX + listPad, listTop, leftW - listPad * 2, listH, 0x000000, 0)
  .setOrigin(0);

// Container scrolleable
const listContainer = this.add.container(leftX + listPad, listTop);
const mask = maskRect.createGeometryMask();
listContainer.setMask(mask);

// Crear items
const carIds = Object.keys(CAR_SPECS);
this._catalogButtons = [];

let listY = 0;
const rowH = 22;

const setSelectedVisual = () => {
  for (const b of this._catalogButtons) {
    const isSel = b._carId === this._selectedCarId;
    b.setStyle({
      backgroundColor: isSel ? 'rgba(44,246,255,0.22)' : 'rgba(255,255,255,0.05)',
      color: isSel ? '#eaffff' : '#ffffff'
    });
  }
};

for (const id of carIds) {
  const btn = this.add.text(0, listY, id, {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: { left: 6, right: 6, top: 3, bottom: 3 }
  }).setInteractive({ useHandCursor: true });

  btn._carId = id;

  btn.on('pointerdown', () => {
    this._selectedCarId = id;
    this._factoryCar = structuredClone(CAR_SPECS[id]);
    setSelectedVisual();
    this._refreshPreview?.();
  });

  listContainer.add(btn);
  this._catalogButtons.push(btn);
  listY += rowH;
}

// Scroll logic
let scrollY = 0;
const maxScroll = Math.max(0, listY - listH);

const applyScroll = () => {
  scrollY = Phaser.Math.Clamp(scrollY, 0, maxScroll);
  listContainer.y = listTop - scrollY;
};

applyScroll();

// Wheel scroll (desktop)
this.input.on('wheel', (pointer, gameObjects, dx, dy) => {
  // Solo si el puntero está encima del panel izquierdo
  const px = pointer.worldX;
  const py = pointer.worldY;
  const inside =
    px >= leftX && px <= leftX + leftW &&
    py >= listTop && py <= listTop + listH;

  if (!inside) return;

  scrollY += dy * 0.6;
  applyScroll();
});

// Drag scroll (móvil)
let dragging = false;
let dragStartY = 0;
let dragStartScroll = 0;

maskRect.setInteractive({ draggable: true });
maskRect.on('pointerdown', (p) => {
  dragging = true;
  dragStartY = p.y;
  dragStartScroll = scrollY;
});
this.input.on('pointerup', () => { dragging = false; });
this.input.on('pointermove', (p) => {
  if (!dragging) return;
  const delta = (p.y - dragStartY);
  scrollY = dragStartScroll - delta;
  applyScroll();
});

// Separador acciones
const actionsY = leftY + leftH - actionsH + 8;

this.add.rectangle(leftX + 10, actionsY - 10, leftW - 20, 1, 0xb7c0ff, 0.10)
  .setOrigin(0);

// Botones de acciones (fijos abajo, sin pisar listado)
const actionBtnW = leftW - 24;
const mkWideBtn = (x, y, label, onClick) => {
  const r = this.add.rectangle(x, y, actionBtnW, 36, 0x0b1020, 0.80)
    .setOrigin(0)
    .setStrokeStyle(1, 0x2cf6ff, 0.22)
    .setInteractive({ useHandCursor: true });

  const t = this.add.text(x + actionBtnW / 2, y + 18, label, {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '12px',
    color: '#eaffff',
    fontStyle: '800'
  }).setOrigin(0.5);

  r.on('pointerdown', () => onClick?.());
  return [r, t];
};

const [newR, newT] = mkWideBtn(leftX + 12, leftY + leftH - 80, 'NEW BASE', () => {
  this._factoryCar = structuredClone(CAR_SPECS.stock);
  this._factoryCar.id = 'new_car';
  this._factoryCar.name = 'New Car';
  this._selectedCarId = null;
  setSelectedVisual();
  this._refreshPreview?.();
});

const [cloneR, cloneT] = mkWideBtn(leftX + 12, leftY + leftH - 40, 'CLONAR SELECCIONADO', () => {
  if (!this._selectedCarId) return;
  this._factoryCar = structuredClone(CAR_SPECS[this._selectedCarId]);
  this._factoryCar.id += '_mk1';
  this._factoryCar.name += ' MK1';
  setSelectedVisual();
  this._refreshPreview?.();
});

// ===========================
// PANEL CENTRAL (usa el nuevo layout)
// ===========================
const mid = this.add.rectangle(midX, midY, midW, midH, 0x000000, 0.14)
  .setOrigin(0)
  .setStrokeStyle(1, 0xb7c0ff, 0.08);

const midT = this.add.text(midX + 12, midY + 10, 'ZONA DE MONTAJE (preview + parámetros)', {
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
