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
    this._topBarH = 72;
    this._leftBarW = 76;
    this._rightPanelW = 280;
    this._bottomPad = 14;

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
    this._tapCandidate = false;
    this._gestureWasMultiTouch = false;
    this._panLast = null;
    this._pinchLastDist = 0;

    this._editZoomMin = 0.12;
    this._editZoomMax = 2.5;

    // =================================================
    // UI base
    // =================================================
    this.cameras.main.setBackgroundColor('#09101d');

    this.add.rectangle(0, 0, width, this._topBarH, 0x101626).setOrigin(0);
    this.add.rectangle(0, this._topBarH, this._leftBarW, height - this._topBarH, 0x0d1422).setOrigin(0);
    this.add.rectangle(width - this._rightPanelW, this._topBarH, this._rightPanelW, height - this._topBarH, 0x0f1422).setOrigin(0);

    this.add.rectangle(this._viewX, this._viewY, this._viewW, this._viewH, 0x0a0d16)
      .setOrigin(0)
      .setStrokeStyle(2, 0x26324a, 0.95);

    this.add.text(22, 18, 'TRACK STUDIO', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '30px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    this._rightTitle = this.add.text(width - this._rightPanelW + 20, this._topBarH + 18, 'PROPIEDADES', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '18px',
      color: '#c7d2ff',
      fontStyle: 'bold'
    });

    this._panelText = this.add.text(width - this._rightPanelW + 20, this._topBarH + 58, 'Sin nodo seleccionado', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '15px',
      color: '#ffffff',
      lineSpacing: 8
    });

    const back = this.add.text(width - 96, 18, 'VOLVER', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#1c2540',
      padding: { x: 16, y: 8 }
    })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    back.on('pointerup', () => {
      this.scene.start('admin-hub');
    });

    // =================================================
    // Left toolbar compacta
    // =================================================
    const leftCX = Math.floor(this._leftBarW / 2);
    let leftY = this._topBarH + 26;

    this.add.text(leftCX, leftY, 'TOOLS', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#90a4d4',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    leftY += 34;

    this._zoomInBtn = this._makeIconButton(leftCX, leftY, '+', () => {
      this._applyZoomAtViewportCenter(1.15);
    });

    leftY += 56;

    this._zoomOutBtn = this._makeIconButton(leftCX, leftY, '−', () => {
      this._applyZoomAtViewportCenter(1 / 1.15);
    });

    leftY += 56;

    this._centerBtn = this._makeIconButton(leftCX, leftY, '◎', () => {
      this._editCam.centerOn(this._editorWorldW / 2, this._editorWorldH / 2);
      this._editCam.setZoom(0.28);
      this._updatePanel();
    });

    // =================================================
    // Panel derecho responsive
    // =================================================
    const panelX = width - this._rightPanelW + 20;
    const panelInnerW = this._rightPanelW - 40;

    const crossBoxW = Math.min(180, panelInnerW);
    const crossBoxH = 150;
    const crossBoxX = panelX + Math.floor((panelInnerW - crossBoxW) / 2);
const crossBoxY = this._topBarH + 200;

    this.add.text(crossBoxX, crossBoxY - 26, 'AJUSTE', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '13px',
      color: '#8fa8d8',
      fontStyle: 'bold'
    });

    this.add.rectangle(crossBoxX, crossBoxY, crossBoxW, crossBoxH, 0x162036, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x32456d, 0.9);

    const crossCenterX = crossBoxX + crossBoxW / 2;
    const crossCenterY = crossBoxY + crossBoxH / 2;

    const crossBtnSize = 34;
    const crossGap = 10;
    const crossStep = crossBtnSize + crossGap;

    this._btnUp = this._makePanelButton(
      crossCenterX - crossBtnSize / 2,
      crossCenterY - crossStep - crossBtnSize / 2,
      '↑',
      () => this._nudgeSelectedNode(0, -10),
      crossBtnSize,
      crossBtnSize
    );

    this._btnLeft = this._makePanelButton(
      crossCenterX - crossStep - crossBtnSize / 2,
      crossCenterY - crossBtnSize / 2,
      '←',
      () => this._nudgeSelectedNode(-10, 0),
      crossBtnSize,
      crossBtnSize
    );

    this._btnRight = this._makePanelButton(
      crossCenterX + crossStep - crossBtnSize / 2,
      crossCenterY - crossBtnSize / 2,
      '→',
      () => this._nudgeSelectedNode(10, 0),
      crossBtnSize,
      crossBtnSize
    );

    this._btnDown = this._makePanelButton(
      crossCenterX - crossBtnSize / 2,
      crossCenterY + crossStep - crossBtnSize / 2,
      '↓',
      () => this._nudgeSelectedNode(0, 10),
      crossBtnSize,
      crossBtnSize
    );

    // Borrar en el centro de la cruceta
    this._deleteBtn = this._makePanelButton(
      crossCenterX - crossBtnSize / 2,
      crossCenterY - crossBtnSize / 2,
      '🗑',
      () => this._deleteSelectedNode(),
      crossBtnSize,
      crossBtnSize,
      0x7a1f2f
    );

    // =================================================
    // Mundo de edición
    // =================================================
    this._gridGfx = this.add.graphics().setDepth(1);
    this._smoothPathGfx = this.add.graphics().setDepth(7);
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
      this._smoothPathGfx,
      this._pathGfx,
      this._nodeGfx
    ]);

    const worldObjs = [
      this._gridGfx,
      this._centerMark,
      this._smoothPathGfx,
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

      this._tapCandidate = true;
      this._gestureWasMultiTouch = false;

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

      if (this._draggingNode && down.length === 1 && this._selectedNode >= 0) {
        const p = down[0];

        if (this._dragStartScreen) {
          const dist = Phaser.Math.Distance.Between(
            p.x, p.y,
            this._dragStartScreen.x, this._dragStartScreen.y
          );

          if (dist <= 10) return;

          this._dragMoved = true;
        }

        const world = this._screenToWorld(p.x, p.y);

        this._nodes[this._selectedNode].x = world.x;
        this._nodes[this._selectedNode].y = world.y;

        this._updatePanel();
        this._redrawEditor();
        return;
      }

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

      if (down.length >= 2) {
        this._gestureWasMultiTouch = true;
        this._tapCandidate = false;

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
        this._updatePanel();
        return;
      }

      this._panLast = null;
      this._pinchLastDist = 0;
    });

    this.input.on('pointerup', (pointer) => {
      const stillDown = this.input.manager.pointers.filter(p => p.isDown).length;

      if (this._draggingNode) {
        this._draggingNode = false;
        if (stillDown === 0) {
          this._dragStartScreen = null;
          this._tapCandidate = false;
          this._gestureWasMultiTouch = false;
          this._panLast = null;
          this._pinchLastDist = 0;
        }
        return;
      }

      if (this._gestureWasMultiTouch) {
        if (stillDown === 0) {
          this._dragStartScreen = null;
          this._tapCandidate = false;
          this._gestureWasMultiTouch = false;
          this._panLast = null;
          this._pinchLastDist = 0;
        }
        return;
      }

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

      if (
        this._tapCandidate &&
        !movedTooMuch &&
        this._isPointerInViewport(pointer)
      ) {
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

      if (stillDown === 0) {
        this._dragStartScreen = null;
        this._tapCandidate = false;
        this._gestureWasMultiTouch = false;
        this._panLast = null;
        this._pinchLastDist = 0;
      }
    });

    this.input.on('pointerupoutside', () => {
      this._draggingNode = false;
      this._dragStartScreen = null;
      this._tapCandidate = false;
      this._gestureWasMultiTouch = false;
      this._panLast = null;
      this._pinchLastDist = 0;
    });

    this._updatePanel();
    this._redrawEditor();
  }

  _makeIconButton(cx, cy, label, onClick) {
    const bg = this.add.circle(cx, cy, 20, 0x1c2540, 1)
      .setStrokeStyle(2, 0x3c4e7a, 0.95)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(cx, cy, label, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    bg.on('pointerup', onClick);

    return { bg, txt };
  }

  _makePanelButton(x, y, label, onClick, w = 120, h = 44, fill = 0x1c2540) {
    const bg = this.add.rectangle(x, y, w, h, fill, 1)
      .setOrigin(0)
      .setStrokeStyle(2, 0x3c4e7a, 0.95)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: w <= 40 ? '18px' : '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    bg.on('pointerup', onClick);

    return { bg, txt };
  }

  _applyZoomAtViewportCenter(multiplier) {
    const midX = this._editCam.x + this._editCam.width / 2;
    const midY = this._editCam.y + this._editCam.height / 2;

    const newZoom = Phaser.Math.Clamp(
      this._editCam.zoom * multiplier,
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

    this._updatePanel();
  }

  _nudgeSelectedNode(dx, dy) {
    if (this._selectedNode < 0 || this._selectedNode >= this._nodes.length) return;

    this._nodes[this._selectedNode].x += dx;
    this._nodes[this._selectedNode].y += dy;

    this._updatePanel();
    this._redrawEditor();
  }

  _deleteSelectedNode() {
    if (this._selectedNode < 0 || this._selectedNode >= this._nodes.length) return;

    this._nodes.splice(this._selectedNode, 1);

    if (this._nodes.length === 0) {
      this._selectedNode = -1;
    } else {
      this._selectedNode = Math.min(this._selectedNode, this._nodes.length - 1);
    }

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

  _getSmoothPoints() {
    if (this._nodes.length < 2) return [...this._nodes];
    if (this._nodes.length === 2) return [...this._nodes];

    const pts = [];
    const src = this._nodes;
    const stepsPerSeg = 18;

    const get = (i) => {
      if (i < 0) return src[0];
      if (i >= src.length) return src[src.length - 1];
      return src[i];
    };

    for (let i = 0; i < src.length - 1; i++) {
      const p0 = get(i - 1);
      const p1 = get(i);
      const p2 = get(i + 1);
      const p3 = get(i + 2);

      for (let s = 0; s < stepsPerSeg; s++) {
        const t = s / stepsPerSeg;
        const t2 = t * t;
        const t3 = t2 * t;

        const x = 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );

        const y = 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );

        pts.push({ x, y });
      }
    }

    pts.push({
      x: src[src.length - 1].x,
      y: src[src.length - 1].y
    });

    return pts;
  }

  _redrawEditor() {
    this._smoothPathGfx.clear();
    this._pathGfx.clear();
    this._nodeGfx.clear();

    if (this._nodes.length >= 2) {
      this._pathGfx.lineStyle(2, 0x506080, 0.65);
      this._pathGfx.beginPath();
      this._pathGfx.moveTo(this._nodes[0].x, this._nodes[0].y);

      for (let i = 1; i < this._nodes.length; i++) {
        this._pathGfx.lineTo(this._nodes[i].x, this._nodes[i].y);
      }

      this._pathGfx.strokePath();
    }

    const smooth = this._getSmoothPoints();
    if (smooth.length >= 2) {
      this._smoothPathGfx.lineStyle(6, 0xb7c0ff, 0.95);
      this._smoothPathGfx.beginPath();
      this._smoothPathGfx.moveTo(smooth[0].x, smooth[0].y);

      for (let i = 1; i < smooth.length; i++) {
        this._smoothPathGfx.lineTo(smooth[i].x, smooth[i].y);
      }

      this._smoothPathGfx.strokePath();
    }

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
