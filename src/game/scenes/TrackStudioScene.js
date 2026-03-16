import Phaser from 'phaser';
import { BaseScene } from './BaseScene.js';

export class TrackStudioScene extends BaseScene {

  constructor() {
    super('TrackStudioScene');
  }

    create() {
    super.create();

    const { width, height } = this.scale;

    // =================================================
    // Layout base
    // =================================================
    const topBarH = 70;
    const leftBarW = 86;
    const rightPanelW = 320;
    const bottomPad = 16;

    const viewX = leftBarW;
    const viewY = topBarH;
    const viewW = width - leftBarW - rightPanelW;
    const viewH = height - topBarH - bottomPad;

    // =================================================
    // Fondo UI general
    // =================================================
    this.cameras.main.setBackgroundColor('#0b1020');

    // Top bar
    this.add.rectangle(0, 0, width, topBarH, 0x101626)
      .setOrigin(0);

    // Toolbar izquierda
    this.add.rectangle(0, topBarH, leftBarW, height - topBarH, 0x0f1422)
      .setOrigin(0);

    // Panel derecho
    this.add.rectangle(width - rightPanelW, topBarH, rightPanelW, height - topBarH, 0x0f1422)
      .setOrigin(0);

    // Viewport panel
    this.add.rectangle(viewX, viewY, viewW, viewH, 0x0a0d16)
      .setOrigin(0)
      .setStrokeStyle(2, 0x26324a, 0.9);

    // =================================================
    // Títulos UI
    // =================================================
    this.add.text(24, 22, 'TRACK STUDIO', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    this.add.text(width - rightPanelW + 24, topBarH + 20, 'PROPIEDADES', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '20px',
      color: '#b7c0ff',
      fontStyle: 'bold'
    });

    // =================================================
    // Botón volver
    // =================================================
    const back = this.add.text(width - 110, 22, 'VOLVER', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#1c2540',
      padding: { x: 18, y: 8 }
    })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    back.on('pointerup', () => {
      this.scene.start('admin-hub');
    });

    // =================================================
    // Mundo de edición
    // =================================================
    this._editorWorldW = 4000;
    this._editorWorldH = 4000;

    this._gridGfx = this.add.graphics();
    this._gridGfx.setDepth(1);

    // Grid principal
    this._gridGfx.lineStyle(1, 0x1f2c44, 0.7);

    for (let x = 0; x <= this._editorWorldW; x += 100) {
      this._gridGfx.beginPath();
      this._gridGfx.moveTo(x, 0);
      this._gridGfx.lineTo(x, this._editorWorldH);
      this._gridGfx.strokePath();
    }

    for (let y = 0; y <= this._editorWorldH; y += 100) {
      this._gridGfx.beginPath();
      this._gridGfx.moveTo(0, y);
      this._gridGfx.lineTo(this._editorWorldW, y);
      this._gridGfx.strokePath();
    }

    // Grid grueso
    this._gridGfx.lineStyle(2, 0x2d3d5c, 0.9);

    for (let x = 0; x <= this._editorWorldW; x += 500) {
      this._gridGfx.beginPath();
      this._gridGfx.moveTo(x, 0);
      this._gridGfx.lineTo(x, this._editorWorldH);
      this._gridGfx.strokePath();
    }

    for (let y = 0; y <= this._editorWorldH; y += 500) {
      this._gridGfx.beginPath();
      this._gridGfx.moveTo(0, y);
      this._gridGfx.lineTo(this._editorWorldW, y);
      this._gridGfx.strokePath();
    }

    // Punto centro del mundo
    const centerMark = this.add.graphics().setDepth(2);
    centerMark.lineStyle(3, 0x2bff88, 0.8);
    centerMark.beginPath();
    centerMark.moveTo(this._editorWorldW / 2 - 30, this._editorWorldH / 2);
    centerMark.lineTo(this._editorWorldW / 2 + 30, this._editorWorldH / 2);
    centerMark.moveTo(this._editorWorldW / 2, this._editorWorldH / 2 - 30);
    centerMark.lineTo(this._editorWorldW / 2, this._editorWorldH / 2 + 30);
    centerMark.strokePath();

    // =================================================
    // Cámara de edición
    // =================================================
    this._editCam = this.cameras.add(viewX + 2, viewY + 2, viewW - 4, viewH - 4);
    this._editCam.setBackgroundColor('#0a0d16');
    this._editCam.setBounds(0, 0, this._editorWorldW, this._editorWorldH);
    this._editCam.centerOn(this._editorWorldW / 2, this._editorWorldH / 2);
    this._editCam.setZoom(0.28);
    this._editCam.setRoundPixels(true);

     // La cámara principal no debe renderizar el mundo de edición
    this.cameras.main.ignore([this._gridGfx, centerMark]);

    // La cámara de edición no debe renderizar la UI
    const worldObjs = [this._gridGfx, centerMark];
    const uiObjs = this.children.list.filter(obj => !worldObjs.includes(obj));
    this._editCam.ignore(uiObjs);

    // =================================================
    // Input cámara editor
    // =================================================
    this._isPanning = false;
    this._panStart = null;
    this._editZoomMin = 0.12;
    this._editZoomMax = 2.5;

    const isPointerInViewport = (pointer) => {
      return (
        pointer.x >= viewX &&
        pointer.x <= viewX + viewW &&
        pointer.y >= viewY &&
        pointer.y <= viewY + viewH
      );
    };

    this.input.on('pointerdown', (pointer) => {
      if (!isPointerInViewport(pointer)) return;

      this._isPanning = true;
      this._panStart = {
        x: pointer.x,
        y: pointer.y,
        scrollX: this._editCam.scrollX,
        scrollY: this._editCam.scrollY
      };
    });

    this.input.on('pointermove', (pointer) => {
      if (!this._isPanning || !this._panStart) return;

      const dx = pointer.x - this._panStart.x;
      const dy = pointer.y - this._panStart.y;

      this._editCam.scrollX = this._panStart.scrollX - (dx / this._editCam.zoom);
      this._editCam.scrollY = this._panStart.scrollY - (dy / this._editCam.zoom);
    });

    this.input.on('pointerup', () => {
      this._isPanning = false;
      this._panStart = null;
    });

    this.input.on('pointerupoutside', () => {
      this._isPanning = false;
      this._panStart = null;
    });

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      if (!isPointerInViewport(pointer)) return;

      const worldPointBefore = this._editCam.getWorldPoint(pointer.x, pointer.y);

      const zoomFactor = deltaY > 0 ? 0.90 : 1.10;
      const nextZoom = Phaser.Math.Clamp(
        this._editCam.zoom * zoomFactor,
        this._editZoomMin,
        this._editZoomMax
      );

      this._editCam.setZoom(nextZoom);

      const worldPointAfter = this._editCam.getWorldPoint(pointer.x, pointer.y);

      this._editCam.scrollX += worldPointBefore.x - worldPointAfter.x;
      this._editCam.scrollY += worldPointBefore.y - worldPointAfter.y;
    });
  }
}
