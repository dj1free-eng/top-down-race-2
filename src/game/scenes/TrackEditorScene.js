import Phaser from 'phaser';
import { BaseScene } from './BaseScene.js';

export class TrackEditorScene extends BaseScene {
  constructor() {
    super({ key: 'TrackEditorScene' });

    // Estado (Fase 1)
    this._isDrawing = false;
    this._rawPoints = [];    // [{x,y}, ...] en coords del mundo
    this._cleanPoints = [];  // por ahora copia; en Fase 2 será filtrado/resample/smooth

    this._gRaw = null;       // Graphics para trazo raw
    this._gClean = null;     // Graphics para trazo “limpio”
    this._minSampleDist = 10; // px (móvil friendly)
    this._drawRect = null; // Phaser.Geom.Rectangle (zona habilitada)
    this._uiTopH = 150;    // espacio para título/toolbar futura
  }

  create() {
    super.create(); // 👈 SIEMPRE primera línea
    const { width, height } = this.scale;

    // Fondo provisional (luego lo pondremos Brawl/arcade)
    this.cameras.main.setBackgroundColor('#1b6bff');

    // --- Layers de dibujo (Fase 1) ---
    this._gRaw = this.add.graphics().setDepth(10);
    this._gClean = this.add.graphics().setDepth(11);

    // Evitar gestos raros del navegador/scroll en móvil
    this.input.addPointer(1);

    // --- Input táctil ---
    this.input.on('pointerdown', (p) => {
            // Solo permitir dibujo dentro del lienzo
      if (this._drawRect && !this._drawRect.contains(p.worldX, p.worldY)) {
        this._isDrawing = false;
        return;
      }
      // Solo un dedo: evitamos pinch/scroll por ahora
      if (p.pointerId !== 1 && p.id !== 0) { /* Phaser varía; no bloqueamos */ }

      this._isDrawing = true;
      this._rawPoints.length = 0;
      this._cleanPoints.length = 0;

      this._pushPointIfFar(p.worldX, p.worldY);
      this._rebuildClean();
      this._redraw();
    });

    this.input.on('pointermove', (p) => {
      if (!this._isDrawing) return;
      if (this._drawRect && !this._drawRect.contains(p.worldX, p.worldY)) return;

      this._pushPointIfFar(p.worldX, p.worldY);
      this._rebuildClean();
      this._redraw();
    });

    this.input.on('pointerup', () => {
      this._isDrawing = false;
    });

    this.input.on('pointerupoutside', () => {
      this._isDrawing = false;
    });
    
    // Título
    this.add.text(width / 2, 60, 'EDITOR DE PISTAS', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Nota provisional
    this.add.text(width / 2, 110, '(Fase 0: Scene conectada)', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#e8f0ff'
    }).setOrigin(0.5);

// --- Layout pro (Canvas 3:2 + Sidebar) ---
const pad = 16;
const gap = 14;

// Sidebar fijo a la derecha
const sideW = Math.floor(Math.max(220, Math.min(320, width * 0.28)));
const sideX = Math.floor(width - pad - sideW);
const sideY = this._uiTopH;
const sideH = Math.floor(height - sideY - pad);

// Canvas disponible (a la izquierda del sidebar)
const canvasX = pad;
const canvasY = this._uiTopH;
const canvasMaxW = Math.floor(sideX - gap - canvasX);
const canvasMaxH = Math.floor(height - canvasY - pad);

// Forzar ratio 3:2 (W:H = 1.5)
let drawW = canvasMaxW;
let drawH = Math.floor(drawW / 1.5);
if (drawH > canvasMaxH) {
  drawH = canvasMaxH;
  drawW = Math.floor(drawH * 1.5);
}

// Centrar canvas en su zona disponible
const drawX = Math.floor(canvasX + (canvasMaxW - drawW) / 2);
const drawY = Math.floor(canvasY + (canvasMaxH - drawH) / 2);

this._drawRect = new Phaser.Geom.Rectangle(drawX, drawY, drawW, drawH);

// Panel visual del “lienzo”
const canvasPanel = this.add.graphics().setDepth(5);
canvasPanel.fillStyle(0xffffff, 0.14);
canvasPanel.fillRoundedRect(drawX, drawY, drawW, drawH, 18);
canvasPanel.lineStyle(3, 0xffffff, 0.55);
canvasPanel.strokeRoundedRect(drawX, drawY, drawW, drawH, 18);

this.add.text(drawX + 14, drawY + 10, 'ZONA DE DIBUJO (3:2)', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '12px',
  color: '#ffffff',
  fontStyle: 'bold'
}).setAlpha(0.85).setDepth(6);

// Sidebar visual
const sidePanel = this.add.graphics().setDepth(50);
sidePanel.fillStyle(0xffffff, 0.12);
sidePanel.fillRoundedRect(sideX, sideY, sideW, sideH, 18);
sidePanel.lineStyle(3, 0xffffff, 0.35);
sidePanel.strokeRoundedRect(sideX, sideY, sideW, sideH, 18);

this.add.text(sideX + 18, sideY + 14, 'HERRAMIENTAS', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '13px',
  color: '#ffffff',
  fontStyle: 'bold'
}).setAlpha(0.9).setDepth(51);

// Botón Volver a ADMIN (abajo del sidebar)
const btnW = Math.floor(sideW - 36);
const btnH = 58;
const btnX = Math.floor(sideX + (sideW - btnW) / 2);
const btnY = Math.floor(sideY + sideH - btnH - 18);

const backBtn = this.add.rectangle(btnX, btnY, btnW, btnH, 0xffffff, 0.22)
  .setOrigin(0)
  .setStrokeStyle(2, 0xffffff, 0.55)
  .setInteractive({ useHandCursor: true })
  .setDepth(60);

this.add.text(btnX + btnW / 2, btnY + btnH / 2, 'Volver a ADMIN', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '16px',
  color: '#ffffff',
  fontStyle: 'bold'
}).setOrigin(0.5).setDepth(61);

backBtn.on('pointerdown', () => this.scene.start('admin-hub'));
    _pushPointIfFar(x, y) {
    const n = this._rawPoints.length;
    if (n === 0) {
      this._rawPoints.push({ x, y });
      return true;
    }
    const last = this._rawPoints[n - 1];
    const dx = x - last.x;
    const dy = y - last.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < this._minSampleDist * this._minSampleDist) return false;
    this._rawPoints.push({ x, y });
    return true;
  }

  _rebuildClean() {
    // Fase 1: aún no filtramos. Solo copia.
    this._cleanPoints = this._rawPoints.slice();
  }

  _redraw() {
    // Limpia
    this._gRaw.clear();
    this._gClean.clear();

    // RAW: fino
    if (this._rawPoints.length >= 2) {
      this._gRaw.lineStyle(3, 0xffffff, 0.45);
      this._gRaw.beginPath();
      this._gRaw.moveTo(this._rawPoints[0].x, this._rawPoints[0].y);
      for (let i = 1; i < this._rawPoints.length; i++) {
        this._gRaw.lineTo(this._rawPoints[i].x, this._rawPoints[i].y);
      }
      this._gRaw.strokePath();
    }

    // CLEAN: más gordo (provisional)
    if (this._cleanPoints.length >= 2) {
      this._gClean.lineStyle(10, 0xfff000, 0.85);
      this._gClean.beginPath();
      this._gClean.moveTo(this._cleanPoints[0].x, this._cleanPoints[0].y);
      for (let i = 1; i < this._cleanPoints.length; i++) {
        this._gClean.lineTo(this._cleanPoints[i].x, this._cleanPoints[i].y);
      }
      this._gClean.strokePath();
    }
  }
}
