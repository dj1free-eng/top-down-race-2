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
    this._selectedPart = null; // { type:'node'|'handleIn'|'handleOut', index:number }

    this._draggingPart = false;
    this._dragMoved = false;
    this._dragStartScreen = null;
    this._dragStartWorld = null;

    this._tapCandidate = false;
    this._gestureWasMultiTouch = false;
    this._panLast = null;
    this._pinchLastDist = 0;

    this._editZoomMin = 0.12;
    this._editZoomMax = 2.5;

    this._trackWidth = 140;
    this._trackWidthMin = 60;
    this._trackWidthMax = 260;

    this._isClosed = false;

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
      fontSize: '14px',
      color: '#ffffff',
      lineSpacing: 2
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

    leftY += 56;

    this._loopBtn = this._makeIconButton(leftCX, leftY, '🔓', () => {
      this._toggleClosed();
    });

    // =================================================
    // Panel derecho responsive
    // =================================================
    const panelX = width - this._rightPanelW + 20;
    const panelInnerW = this._rightPanelW - 40;

    const widthBoxY = this._topBarH + 150;
    this.add.text(panelX, widthBoxY - 22, 'ANCHO PISTA', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '13px',
      color: '#8fa8d8',
      fontStyle: 'bold'
    });

    this.add.rectangle(panelX, widthBoxY, panelInnerW, 60, 0x162036, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x32456d, 0.9);

    this._widthValueText = this.add.text(panelX + panelInnerW / 2, widthBoxY + 15, `${this._trackWidth}px`, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    this._widthMinusBtn = this._makePanelButton(
      panelX + 14,
      widthBoxY + 12,
      '−',
      () => this._changeTrackWidth(-10),
      36,
      36
    );

    this._widthPlusBtn = this._makePanelButton(
      panelX + panelInnerW - 50,
      widthBoxY + 12,
      '+',
      () => this._changeTrackWidth(10),
      36,
      36
    );

    const crossBoxW = Math.min(180, panelInnerW);
    const crossBoxH = 150;
    const crossBoxX = panelX + Math.floor((panelInnerW - crossBoxW) / 2);
    const crossBoxY = this._topBarH + 200;

    this.add.text(crossBoxX, crossBoxY - 26, 'AJUSTE NODO', {
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
    this._trackGfx = this.add.graphics().setDepth(6);
    this._curveGfx = this.add.graphics().setDepth(7);
    this._guideGfx = this.add.graphics().setDepth(8);
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
      this._trackGfx,
      this._curveGfx,
      this._guideGfx,
      this._nodeGfx
    ]);

    const worldObjs = [
      this._gridGfx,
      this._centerMark,
      this._trackGfx,
      this._curveGfx,
      this._guideGfx,
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
      const hit = this._findControlAt(world.x, world.y);

      if (hit) {
        this._selectedNode = hit.index;
        this._selectedPart = hit;
        this._draggingPart = true;
        this._dragMoved = false;
        this._dragStartScreen = { x: pointer.x, y: pointer.y };
        this._dragStartWorld = { x: world.x, y: world.y };
        this._updatePanel();
        this._redrawEditor();
        return;
      }

      this._selectedPart = null;
      this._draggingPart = false;
      this._dragMoved = false;
      this._dragStartScreen = { x: pointer.x, y: pointer.y };
      this._dragStartWorld = { x: world.x, y: world.y };
    });

    this.input.on('pointermove', () => {
      const down = this.input.manager.pointers.filter(
        (p) => p.isDown && this._isPointerInViewport(p)
      );

      if (this._draggingPart && down.length === 1 && this._selectedPart) {
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
        const idx = this._selectedPart.index;
        const node = this._nodes[idx];

        if (this._selectedPart.type === 'node') {
          const dx = world.x - node.x;
          const dy = world.y - node.y;

          node.x = world.x;
          node.y = world.y;

          node.handleIn.x += dx;
          node.handleIn.y += dy;
          node.handleOut.x += dx;
          node.handleOut.y += dy;
        } else if (this._selectedPart.type === 'handleIn') {
          node.handleIn.x = world.x;
          node.handleIn.y = world.y;
        } else if (this._selectedPart.type === 'handleOut') {
          node.handleOut.x = world.x;
          node.handleOut.y = world.y;
        }

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

        const midX = (p1.x + p2.x) * 0.5;
        const midY = (p1.y + p2.y) * 0.5;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (!this._pinchLastDist) {
          this._pinchLastDist = dist;
          this._panLast = null;
          this._draggingPart = false;
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
      const stillDown = this.input.manager.pointers.filter((p) => p.isDown).length;

      if (this._draggingPart) {
        this._draggingPart = false;
        if (stillDown === 0) {
          this._dragStartScreen = null;
          this._dragStartWorld = null;
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
          this._dragStartWorld = null;
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
        const hit = this._findControlAt(world.x, world.y);

        if (hit) {
          this._selectedNode = hit.index;
          this._selectedPart = hit;
        } else {
          const node = this._createNode(world.x, world.y);
          this._nodes.push(node);
          this._selectedNode = this._nodes.length - 1;
          this._selectedPart = { type: 'node', index: this._selectedNode };
        }

        this._updatePanel();
        this._redrawEditor();
      }

      if (stillDown === 0) {
        this._dragStartScreen = null;
        this._dragStartWorld = null;
        this._tapCandidate = false;
        this._gestureWasMultiTouch = false;
        this._panLast = null;
        this._pinchLastDist = 0;
      }
    });

    this.input.on('pointerupoutside', () => {
      this._draggingPart = false;
      this._dragStartScreen = null;
      this._dragStartWorld = null;
      this._tapCandidate = false;
      this._gestureWasMultiTouch = false;
      this._panLast = null;
      this._pinchLastDist = 0;
    });

    this._updateLoopButton();
    this._updatePanel();
    this._redrawEditor();
  }

  _createNode(x, y) {
    return {
      x,
      y,
      handleIn: { x: x - 60, y },
      handleOut: { x: x + 60, y }
    };
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

  _toggleClosed() {
    this._isClosed = !this._isClosed;
    this._updateLoopButton();
    this._updatePanel();
    this._redrawEditor();
  }

  _updateLoopButton() {
    if (!this._loopBtn?.txt) return;
    this._loopBtn.txt.setText(this._isClosed ? '🔒' : '🔓');
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

  _changeTrackWidth(delta) {
    this._trackWidth = Phaser.Math.Clamp(
      this._trackWidth + delta,
      this._trackWidthMin,
      this._trackWidthMax
    );

    if (this._widthValueText) {
      this._widthValueText.setText(`${this._trackWidth}px`);
    }

    this._updatePanel();
    this._redrawEditor();
  }

  _nudgeSelectedNode(dx, dy) {
    if (this._selectedNode < 0 || this._selectedNode >= this._nodes.length) return;

    const node = this._nodes[this._selectedNode];
    node.x += dx;
    node.y += dy;
    node.handleIn.x += dx;
    node.handleIn.y += dy;
    node.handleOut.x += dx;
    node.handleOut.y += dy;

    this._updatePanel();
    this._redrawEditor();
  }

  _deleteSelectedNode() {
    if (this._selectedNode < 0 || this._selectedNode >= this._nodes.length) return;

    this._nodes.splice(this._selectedNode, 1);

    if (this._nodes.length === 0) {
      this._selectedNode = -1;
      this._selectedPart = null;
    } else {
      this._selectedNode = Math.min(this._selectedNode, this._nodes.length - 1);
      this._selectedPart = { type: 'node', index: this._selectedNode };
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

  _findControlAt(x, y) {
    const handleRadius = 24;
    const nodeRadius = 32;

    for (let i = this._nodes.length - 1; i >= 0; i--) {
      const n = this._nodes[i];

      if (Phaser.Math.Distance.Between(x, y, n.handleIn.x, n.handleIn.y) <= handleRadius) {
        return { type: 'handleIn', index: i };
      }

      if (Phaser.Math.Distance.Between(x, y, n.handleOut.x, n.handleOut.y) <= handleRadius) {
        return { type: 'handleOut', index: i };
      }

      if (Phaser.Math.Distance.Between(x, y, n.x, n.y) <= nodeRadius) {
        return { type: 'node', index: i };
      }
    }

    return null;
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

  _sampleCubicBezier(p0, p1, p2, p3, steps = 24) {
    const pts = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const mt2 = mt * mt;
      const t2 = t * t;

      const x =
        mt2 * mt * p0.x +
        3 * mt2 * t * p1.x +
        3 * mt * t2 * p2.x +
        t2 * t * p3.x;

      const y =
        mt2 * mt * p0.y +
        3 * mt2 * t * p1.y +
        3 * mt * t2 * p2.y +
        t2 * t * p3.y;

      pts.push({ x, y });
    }

    return pts;
  }

  _getBezierPoints() {
    const count = this._nodes.length;
    if (count < 2) return this._nodes.map((n) => ({ x: n.x, y: n.y }));

    const pts = [];
    const segCount = this._isClosed ? count : count - 1;

    for (let i = 0; i < segCount; i++) {
      const a = this._nodes[i];
      const b = this._nodes[(i + 1) % count];

      const seg = this._sampleCubicBezier(
        { x: a.x, y: a.y },
        { x: a.handleOut.x, y: a.handleOut.y },
        { x: b.handleIn.x, y: b.handleIn.y },
        { x: b.x, y: b.y },
        28
      );

      if (i > 0) seg.shift();
      pts.push(...seg);
    }

    return pts;
  }

  _buildTrackStrip(points, width) {
    if (!Array.isArray(points) || points.length < 2) {
      return { left: [], right: [] };
    }

    const left = [];
    const right = [];

    for (let i = 0; i < points.length; i++) {
      const prevIndex = this._isClosed
        ? (i - 1 + points.length) % points.length
        : Math.max(0, i - 1);

      const nextIndex = this._isClosed
        ? (i + 1) % points.length
        : Math.min(points.length - 1, i + 1);

      const pPrev = points[prevIndex];
      const pCurr = points[i];
      const pNext = points[nextIndex];

      let tx = pNext.x - pPrev.x;
      let ty = pNext.y - pPrev.y;

      const tl = Math.sqrt(tx * tx + ty * ty) || 1;
      tx /= tl;
      ty /= tl;

      const nx = -ty;
      const ny = tx;
      const half = width * 0.5;

      left.push({
        x: pCurr.x - nx * half,
        y: pCurr.y - ny * half
      });

      right.push({
        x: pCurr.x + nx * half,
        y: pCurr.y + ny * half
      });
    }

    return { left, right };
  }

  _redrawEditor() {
    this._trackGfx.clear();
    this._curveGfx.clear();
    this._guideGfx.clear();
    this._nodeGfx.clear();

    const bezier = this._getBezierPoints();

    // preview pista
    if (bezier.length >= 2) {
      const strip = this._buildTrackStrip(bezier, this._trackWidth);

      if (strip.left.length >= 2 && strip.right.length >= 2) {
        this._trackGfx.fillStyle(0x2f343a, 0.95);
        this._trackGfx.beginPath();
        this._trackGfx.moveTo(strip.left[0].x, strip.left[0].y);

        for (let i = 1; i < strip.left.length; i++) {
          this._trackGfx.lineTo(strip.left[i].x, strip.left[i].y);
        }

        for (let i = strip.right.length - 1; i >= 0; i--) {
          this._trackGfx.lineTo(strip.right[i].x, strip.right[i].y);
        }

        this._trackGfx.closePath();
        this._trackGfx.fillPath();

        this._trackGfx.lineStyle(4, 0xf2f2f2, 0.9);

        this._trackGfx.beginPath();
        this._trackGfx.moveTo(strip.left[0].x, strip.left[0].y);
        for (let i = 1; i < strip.left.length; i++) {
          this._trackGfx.lineTo(strip.left[i].x, strip.left[i].y);
        }
        if (this._isClosed) this._trackGfx.closePath();
        this._trackGfx.strokePath();

        this._trackGfx.beginPath();
        this._trackGfx.moveTo(strip.right[0].x, strip.right[0].y);
        for (let i = 1; i < strip.right.length; i++) {
          this._trackGfx.lineTo(strip.right[i].x, strip.right[i].y);
        }
        if (this._isClosed) this._trackGfx.closePath();
        this._trackGfx.strokePath();
      }

      this._curveGfx.lineStyle(2, 0x8fd0ff, 0.55);
      this._curveGfx.beginPath();
      this._curveGfx.moveTo(bezier[0].x, bezier[0].y);
      for (let i = 1; i < bezier.length; i++) {
        this._curveGfx.lineTo(bezier[i].x, bezier[i].y);
      }
      if (this._isClosed) this._curveGfx.closePath();
      this._curveGfx.strokePath();
    }

    // guías y handlers
    for (let i = 0; i < this._nodes.length; i++) {
      const n = this._nodes[i];
      const selected = i === this._selectedNode;

      this._guideGfx.lineStyle(2, selected ? 0x5fb2ff : 0x4c5a7a, 0.75);
      this._guideGfx.beginPath();
      this._guideGfx.moveTo(n.x, n.y);
      this._guideGfx.lineTo(n.handleIn.x, n.handleIn.y);
      this._guideGfx.moveTo(n.x, n.y);
      this._guideGfx.lineTo(n.handleOut.x, n.handleOut.y);
      this._guideGfx.strokePath();

      this._drawHandleDot(
        n.handleIn.x,
        n.handleIn.y,
        selected && this._selectedPart?.type === 'handleIn' && this._selectedPart?.index === i
      );

      this._drawHandleDot(
        n.handleOut.x,
        n.handleOut.y,
        selected && this._selectedPart?.type === 'handleOut' && this._selectedPart?.index === i
      );

      this._nodeGfx.fillStyle(selected ? 0x2bff88 : 0xffffff, 1);
      this._nodeGfx.fillCircle(n.x, n.y, selected ? 16 : 14);

      this._nodeGfx.lineStyle(3, 0x0b1020, 0.9);
      this._nodeGfx.strokeCircle(n.x, n.y, selected ? 16 : 14);

      this._nodeGfx.fillStyle(0x0b1020, 1);
      this._nodeGfx.fillCircle(n.x, n.y, 5);
    }
  }

  _drawHandleDot(x, y, selected = false) {
    this._nodeGfx.fillStyle(selected ? 0xffd166 : 0xb7c0ff, 1);
    this._nodeGfx.fillCircle(x, y, selected ? 10 : 8);

    this._nodeGfx.lineStyle(2, 0x0b1020, 0.9);
    this._nodeGfx.strokeCircle(x, y, selected ? 10 : 8);
  }

  _updatePanel() {
    if (this._widthValueText) {
      this._widthValueText.setText(`${this._trackWidth}px`);
    }

    if (this._selectedNode < 0 || this._selectedNode >= this._nodes.length) {
      this._panelText.setText(
        'Sin nodo seleccionado\n' +
        `Nodos: ${this._nodes.length}\n` +
        `Loop: ${this._isClosed ? 'cerrado' : 'abierto'}\n` +
        `Zoom: ${this._editCam ? this._editCam.zoom.toFixed(2) : '0.00'}\n` +
        `Ancho: ${this._trackWidth}px`
      );
      return;
    }

    const n = this._nodes[this._selectedNode];
    const part = this._selectedPart?.type || 'node';

    this._panelText.setText(
      `Nodo #${this._selectedNode}\n` +
      `Modo: ${part}\n` +
      `Loop: ${this._isClosed ? 'cerrado' : 'abierto'}\n` +
      `X: ${Math.round(n.x)}\n` +
      `Y: ${Math.round(n.y)}\n` +
      `In: ${Math.round(n.handleIn.x)}, ${Math.round(n.handleIn.y)}\n` +
      `Out: ${Math.round(n.handleOut.x)}, ${Math.round(n.handleOut.y)}\n` +
      `Total: ${this._nodes.length}\n` +
      `Zoom: ${this._editCam ? this._editCam.zoom.toFixed(2) : '0.00'}\n` +
      `Ancho: ${this._trackWidth}px`
    );
  }
}
