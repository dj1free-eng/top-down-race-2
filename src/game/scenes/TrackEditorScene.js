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

        // --- Zona de dibujo (Fase 1.2) ---
    const pad = 18;
    const bottomReserve = 160; // hueco para el botón volver + margen
    const drawX = pad;
    const drawY = this._uiTopH;
    const drawW = Math.floor(width - pad * 2);
    const drawH = Math.floor(height - bottomReserve - drawY);

    this._drawRect = new Phaser.Geom.Rectangle(drawX, drawY, drawW, drawH);

    // Panel visual del “lienzo”
    const panel = this.add.graphics().setDepth(5);
    panel.fillStyle(0xffffff, 0.14);
    panel.fillRoundedRect(drawX, drawY, drawW, drawH, 18);
    panel.lineStyle(3, 0xffffff, 0.55);
    panel.strokeRoundedRect(drawX, drawY, drawW, drawH, 18);

    this.add.text(drawX + 14, drawY + 10, 'ZONA DE DIBUJO', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setAlpha(0.85).setDepth(6);

    // Botón volver
    const w = 260, h = 60;
    const x = width / 2 - w / 2;
    const y = Math.floor(height - 120);

    const bg = this.add.rectangle(x, y, w, h, 0xffffff, 0.25)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.7)
      .setInteractive({ useHandCursor: true });

    this.add.text(width / 2, y + h / 2, 'Volver a ADMIN', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    bg.on('pointerdown', () => {
      this.scene.start('admin-hub');
    });
  }
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
