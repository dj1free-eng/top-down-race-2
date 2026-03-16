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
    this._topBarH = 70;
    this._leftBarW = 86;
    this._rightPanelW = 320;
    this._bottomPad = 16;

    this._viewX = this._leftBarW;
    this._viewY = this._topBarH;
    this._viewW = width - this._leftBarW - this._rightPanelW;
    this._viewH = height - this._topBarH - this._bottomPad;

    // =================================================
    // Estado editor
    // =================================================
    this._editorWorldW = 4000;
    this._editorWorldH = 4000;

    this._nodes = [];
    this._selectedNode = -1;
    this._draggingNode = false;
    this._dragMoved = false;
    this._dragStartScreen = null;
    this._panLast = null;
    this._pinchLastDist = 0;

    this._editZoomMin = 0.12;
    this._editZoomMax = 2.5;

    // =================================================
    // UI base
    // =================================================
    this.cameras.main.setBackgroundColor('#0b1020');

    this.add.rectangle(0, 0, width, this._topBarH, 0x101626).setOrigin(0);
    this.add.rectangle(0, this._topBarH, this._leftBarW, height - this._topBarH, 0x0f1422).setOrigin(0);
    this.add.rectangle(width - this._rightPanelW, this._topBarH, this._rightPanelW, height - this._topBarH, 0x0f1422).setOrigin(0);

    this.add.rectangle(this._viewX, this._viewY, this._viewW, this._viewH, 0x0a0d16)
      .setOrigin(0)
      .setStrokeStyle(2, 0x26324a, 0.9);

    this.add.text(24, 22, 'TRACK STUDIO', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    this._rightTitle = this.add.text(width - this._rightPanelW + 24, this._topBarH + 20, 'PROPIEDADES', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '20px',
      color: '#b7c0ff',
      fontStyle: 'bold'
    });

    this._panelText = this.add.text(width - this._rightPanelW + 24, this._topBarH + 64, 'Sin nodo seleccionado', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '16px',
      color: '#ffffff',
      lineSpacing: 8
    });

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
    this._gridGfx = this.add.graphics().setDepth(1);
    this._pathGfx = this.add.graphics().setDepth(8);
    this._nodeGfx = this.add.graphics().setDepth(10);

    this._drawGrid();

    this._centerMark = this.add.graphics().setDepth(2);
    this._centerMark.lineStyle(3, 0x2bff88, 0.8);
    this._centerMark.lineBetween(
      this._editorWorldW / 2 - 30,
      this._editorWorldH / 2,
      this._editorWorldW / 2 + 30,
      this._editorWorldH / 2
    );
    this._centerMark.lineBetween(
      this._editorWorldW / 2,
      this._editorWorldH / 2 - 30,
      this._editorWorldW / 2,
      this._editorWorldH / 2 + 30
    );

    // =================================================
    // Cámara de edición
    // =================================================
    this._editCam = this.cameras.add(
      this._viewX + 2,
      this._viewY + 2,
      this._viewW - 4,
      this._viewH - 4
    );

    this._editCam.setBackgroundColor('#0a0d16');
    this._editCam.setBounds(0, 0, this._editorWorldW, this._editorWorldH);
    this._editCam.centerOn(this._editorWorldW / 2, this._editorWorldH / 2);
    this._editCam.setZoom(0.28);

    this.cameras.main.ignore([
      this._gridGfx,
      this._centerMark,
      this._pathGfx,
      this._nodeGfx
    ]);

    const worldObjs = [
      this._gridGfx,
      this._centerMark,
      this._pathGfx,
      this._nodeGfx
    ];
    const uiObjs = this.children.list.filter(o => !worldObjs.includes(o));
    this._editCam.ignore(uiObjs);

    // =================================================
    // Input
    // =================================================
    this.input.addPointer(2);

    this.input.on('pointerdown', (pointer) => {
      if (!this._isPointerInViewport(pointer)) return;

      const world = this._screenToWorld(pointer.x, pointer.y);
      const hit = this._findNodeAt(world.x, world.y, 32);

      if (hit >= 0) {
        this._selectedNode = hit;
        this._draggingNode = true;
        this._dragMoved = false;
        this._dragStartScreen = { x: pointer.x, y: pointer.y };
        this._updatePanel();
        this._redrawEditor();
        return;
      }

      this._draggingNode = false;
      this._dragMoved = false;
      this._dragStartScreen = { x: pointer.x, y: pointer.y };
    });

    this.input.on('pointermove', () => {
      const down = this.input.manager.pointers.filter(
        p => p.isDown && this._isPointerInViewport(p)
      );

      // Arrastre de nodo con un dedo
      if (this._draggingNode && down.length === 1 && this._selectedNode >= 0) {
        const p = down[0];
        const world = this._screenToWorld(p.x, p.y);

        this._nodes[this._selectedNode].x = world.x;
        this._nodes[this._selectedNode].y = world.y;

        if (this._dragStartScreen) {
          const dist = Phaser.Math.Distance.Between(
            p.x, p.y,
            this._dragStartScreen.x, this._dragStartScreen.y
          );
          if (dist > 8) this._dragMoved = true;
        }

        this._updatePanel();
        this._redrawEditor();
        return;
      }

      // Pan con un dedo
      if (down.length === 1) {
        const p = down[0];

        if (this._panLast) {
          const dx = p.x - this._panLast.x;
          const dy = p.y - this._panLast.y;

          this._editCam.scrollX -= dx / this._editCam.zoom;
          this._editCam.scrollY -= dy / this._editCam.zoom;
        }

        this._panLast = { x: p.x, y: p.y };
        this._pinchLastDist = 0;
        return;
      }

      // Zoom con dos dedos
      if (down.length >= 2) {
        const p1 = down[0];
        const p2 = down[1];

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (!this._pinchLastDist) {
          this._pinchLastDist = dist;
          this._panLast = null;
          this._draggingNode = false;
          return;
        }

        const ratio = dist / this._pinchLastDist;

        const newZoom = Phaser.Math.Clamp(
          this._editCam.zoom * ratio,
          this._editZoomMin,
          this._editZoomMax
        );

        const worldX =
          this._editCam.scrollX +
          (midX - this._editCam.x) / this._editCam.zoom;

        const worldY =
          this._editCam.scrollY +
          (midY - this._editCam.y) / this._editCam.zoom;

        this._editCam.setZoom(newZoom);

        this._editCam.scrollX =
          worldX - (midX - this._editCam.x) / newZoom;

        this._editCam.scrollY =
          worldY - (midY - this._editCam.y) / newZoom;

        this._pinchLastDist = dist;
        return;
      }

      this._panLast = null;
      this._pinchLastDist = 0;
    });

    this.input.on('pointerup', (pointer) => {
      // Si estábamos arrastrando nodo, no crear nodo nuevo
      if (this._draggingNode) {
        this._draggingNode = false;
        this._panLast = null;
        this._pinchLastDist = 0;
        return;
      }

      // Si hubo movimiento apreciable, lo tratamos como pan y NO como tap
      let movedTooMuch = false;
      if (this._dragStartScreen) {
        const dist = Phaser.Math.Distance.Between(
          pointer.x,
          pointer.y,
          this._dragStartScreen.x,
          this._dragStartScreen.y
        );
        movedTooMuch = dist > 10;
      }

      // Tap limpio dentro del viewport = seleccionar o crear nodo
      if (!movedTooMuch && this._isPointerInViewport(pointer)) {
        const world = this._screenToWorld(pointer.x, pointer.y);
        const hit = this._findNodeAt(world.x, world.y, 32);

        if (hit >= 0) {
          this._selectedNode = hit;
        } else {
          this._nodes.push({
            x: world.x,
            y: world.y
          });
          this._selectedNode = this._nodes.length - 1;
        }

        this._updatePanel();
        this._redrawEditor();
      }

      this._dragStartScreen = null;
      this._panLast = null;
      this._pinchLastDist = 0;
    });

    this.input.on('pointerupoutside', () => {
      this._draggingNode = false;
      this._panLast = null;
      this._pinchLastDist = 0;
    });

    this._updatePanel();
    this._redrawEditor();
  }

  _isPointerInViewport(pointer) {
    return (
      pointer.x >= this._viewX &&
      pointer.x <= this._viewX + this._viewW &&
      pointer.y >= this._viewY &&
      pointer.y <= this._viewY + this._viewH
    );
  }

  _screenToWorld(screenX, screenY) {
    return this._editCam.getWorldPoint(screenX, screenY);
  }

  _findNodeAt(x, y, radius = 32) {
    const r2 = radius * radius;
    for (let i = this._nodes.length - 1; i >= 0; i--) {
      const n = this._nodes[i];
      const dx = n.x - x;
      const dy = n.y - y;
      if ((dx * dx + dy * dy) <= r2) return i;
    }
    return -1;
  }

  _drawGrid() {
    this._gridGfx.clear();

    this._gridGfx.lineStyle(1, 0x1f2c44, 0.7);
    for (let x = 0; x <= this._editorWorldW; x += 100) {
      this._gridGfx.lineBetween(x, 0, x, this._editorWorldH);
    }
    for (let y = 0; y <= this._editorWorldH; y += 100) {
      this._gridGfx.lineBetween(0, y, this._editorWorldW, y);
    }

    this._gridGfx.lineStyle(2, 0x2d3d5c, 0.9);
    for (let x = 0; x <= this._editorWorldW; x += 500) {
      this._gridGfx.lineBetween(x, 0, x, this._editorWorldH);
    }
    for (let y = 0; y <= this._editorWorldH; y += 500) {
      this._gridGfx.lineBetween(0, y, this._editorWorldW, y);
    }
  }

  _redrawEditor() {
    this._pathGfx.clear();
    this._nodeGfx.clear();

    // Línea provisional entre nodos
    if (this._nodes.length >= 2) {
      this._pathGfx.lineStyle(6, 0xb7c0ff, 0.9);
      this._pathGfx.beginPath();
      this._pathGfx.moveTo(this._nodes[0].x, this._nodes[0].y);

      for (let i = 1; i < this._nodes.length; i++) {
        this._pathGfx.lineTo(this._nodes[i].x, this._nodes[i].y);
      }

      this._pathGfx.strokePath();
    }

    // Nodos
    for (let i = 0; i < this._nodes.length; i++) {
      const n = this._nodes[i];
      const selected = i === this._selectedNode;

      this._nodeGfx.fillStyle(selected ? 0x2bff88 : 0xffffff, 1);
      this._nodeGfx.fillCircle(n.x, n.y, selected ? 16 : 14);

      this._nodeGfx.lineStyle(3, 0x0b1020, 0.9);
      this._nodeGfx.strokeCircle(n.x, n.y, selected ? 16 : 14);

      this._nodeGfx.fillStyle(0x0b1020, 1);
      this._nodeGfx.fillCircle(n.x, n.y, 5);
    }
  }

  _updatePanel() {
    if (this._selectedNode < 0 || this._selectedNode >= this._nodes.length) {
      this._panelText.setText(
        'Sin nodo seleccionado\n\n' +
        `Nodos: ${this._nodes.length}\n` +
        `Zoom: ${this._editCam ? this._editCam.zoom.toFixed(2) : '0.00'}`
      );
      return;
    }

    const n = this._nodes[this._selectedNode];

    this._panelText.setText(
      `Nodo #${this._selectedNode}\n\n` +
      `X: ${Math.round(n.x)}\n` +
      `Y: ${Math.round(n.y)}\n\n` +
      `Total nodos: ${this._nodes.length}\n` +
      `Zoom: ${this._editCam ? this._editCam.zoom.toFixed(2) : '0.00'}`
    );
  }
}
