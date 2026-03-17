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
    this._selectedPart = null;

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
    this._trackWidthMin = 30;
    this._trackWidthMax = 260;

    this._isClosed = false;
    this._tool = 'edit'; // 'edit' | 'finish' | 'checkpoint'
    this._finishLine = null;
    this._checkpoints = [];

    // guía de fondo
    this._guideImage = null;
    this._guideTextureKey = null;
    this._guideVisible = true;
    this._guideAlpha = 0.32;
    this._guideInput = null;

    // nudge
    this._nudgeSteps = [1, 5, 10];
    this._nudgeStepIndex = 2;

    // toolbar grupos
    this._activeFlyout = null;
    this._activeFlyoutGroup = null;
    this._groupButtons = {};

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
      lineSpacing: 2,
      wordWrap: { width: this._rightPanelW - 40 }
    });

    this._backBtn = this._makeIconButton(width - 44, 36, '←', () => {
      this._destroyGuideInput();
      this.scene.start('admin-hub');
    }, '22px');

    // =================================================
    // Barra izquierda: grupos
    // =================================================
    const leftCX = Math.floor(this._leftBarW / 2);
    let leftY = this._topBarH + 20;

    this.add.text(leftCX, leftY, 'TOOLS', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#90a4d4',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    leftY += 38;

    this._groupButtons.mode = this._makeGroupButton(leftCX, leftY, '🔓', [
      {
        label: '🔓',
        action: () => {
          this._isClosed = false;
          this._updateLoopButton();
          this._updatePanel();
          this._redrawEditor();
        }
      },
      {
        label: '🔒',
        action: () => {
          this._isClosed = true;
          this._updateLoopButton();
          this._updatePanel();
          this._redrawEditor();
        }
      },
      {
        label: '🏁',
        action: () => this._setTool(this._tool === 'finish' ? 'edit' : 'finish')
      },
      {
        label: 'CP',
        action: () => this._setTool(this._tool === 'checkpoint' ? 'edit' : 'checkpoint')
      }
    ], {
      groupName: 'mode',
      fontSize: '16px',
      horizontal: false
    });

    leftY += 52;

    this._groupButtons.guide = this._makeGroupButton(leftCX, leftY, 'IMG', [
      {
        label: 'IMG',
        action: () => this._openGuidePicker()
      },
      {
        label: '👁',
        action: () => this._toggleGuideVisibility()
      }
    ], {
      groupName: 'guide',
      fontSize: '12px',
      horizontal: false
    });

    // =================================================
    // Barra superior
    // =================================================
    const topToolsY = 36;
    let topX = 300;

    this._saveBtn = this._makeIconButton(topX, topToolsY, '💾', () => {
      this._saveProject();
    }, '16px');
    topX += 44;

    this._loadBtn = this._makeIconButton(topX, topToolsY, '📂', () => {
      this._loadProject();
    }, '16px');
    topX += 44;

    this._newBtn = this._makeIconButton(topX, topToolsY, 'NEW', () => {
      this._newProject();
    }, '12px');
    topX += 52;

    this._groupButtons.view = this._makeGroupButton(topX, topToolsY, '🔍+', [
      {
        label: '🔍+',
        action: () => this._applyZoomAtViewportCenter(1.15)
      },
      {
        label: '🔎-',
        action: () => this._applyZoomAtViewportCenter(1 / 1.15)
      },
      {
        label: '◎',
        action: () => {
          this._editCam.centerOn(this._editorWorldW / 2, this._editorWorldH / 2);
          this._editCam.setZoom(0.28);
          this._updatePanel();
        }
      }
    ], {
      groupName: 'view',
      fontSize: '12px',
      horizontal: true
    });
    topX += 48;

    this._groupButtons.track = this._makeGroupButton(topX, topToolsY, 'W', [
      {
        label: 'W-',
        action: () => this._changeTrackWidth(-10)
      },
      {
        label: 'W+',
        action: () => this._changeTrackWidth(10)
      }
    ], {
      groupName: 'track',
      fontSize: '14px',
      horizontal: true
    });
    topX += 48;

    this._guideAlphaMinusBtn = this._makeIconButton(topX, topToolsY, 'A-', () => {
      this._changeGuideAlpha(-0.08);
    }, '13px');
    topX += 44;

    this._guideAlphaPlusBtn = this._makeIconButton(topX, topToolsY, 'A+', () => {
      this._changeGuideAlpha(0.08);
    }, '13px');
    topX += 52;

    this._nudgeStepBtn = this._makeIconButton(topX, topToolsY, String(this._getNudgeStep()), () => {
      this._cycleNudgeStep();
    }, '16px');
    topX += 44;

    this._btnLeft = this._makeIconButton(topX, topToolsY, '←', () => {
      this._nudgeSelectedNode(-this._getNudgeStep(), 0);
    }, '18px');
    topX += 40;

    this._btnUp = this._makeIconButton(topX, topToolsY, '↑', () => {
      this._nudgeSelectedNode(0, -this._getNudgeStep());
    }, '18px');
    topX += 40;

    this._btnDown = this._makeIconButton(topX, topToolsY, '↓', () => {
      this._nudgeSelectedNode(0, this._getNudgeStep());
    }, '18px');
    topX += 40;

    this._btnRight = this._makeIconButton(topX, topToolsY, '→', () => {
      this._nudgeSelectedNode(this._getNudgeStep(), 0);
    }, '18px');
    topX += 40;

    this._deleteBtn = this._makeIconButton(topX, topToolsY, '🗑', () => {
      this._deleteSelectedNode();
    }, '16px');

    // =================================================
    // Mundo de edición
    // =================================================
    this._gridGfx = this.add.graphics().setDepth(1);
    this._trackGfx = this.add.graphics().setDepth(6);
    this._curveGfx = this.add.graphics().setDepth(7);
    this._guideGfx = this.add.graphics().setDepth(8);
    this._checkpointGfx = this.add.graphics().setDepth(9);
    this._finishGfx = this.add.graphics().setDepth(10);
    this._nodeGfx = this.add.graphics().setDepth(11);

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
      this._checkpointGfx,
      this._finishGfx,
      this._nodeGfx
    ]);

    const worldObjs = [
      this._gridGfx,
      this._centerMark,
      this._trackGfx,
      this._curveGfx,
      this._guideGfx,
      this._checkpointGfx,
      this._finishGfx,
      this._nodeGfx
    ];
    const uiObjs = this.children.list.filter((o) => !worldObjs.includes(o));
    this._editCam.ignore(uiObjs);

    // =================================================
    // Input
    // =================================================
    this.input.addPointer(2);

    this.input.on('pointerdown', (pointer) => {
      this._closeFlyout();

      if (!this._isPointerInViewport(pointer)) return;

      this._tapCandidate = true;
      this._gestureWasMultiTouch = false;

      if (this._tool === 'finish' || this._tool === 'checkpoint') {
        this._draggingPart = false;
        this._dragMoved = false;
        this._dragStartScreen = { x: pointer.x, y: pointer.y };
        this._dragStartWorld = this._screenToWorld(pointer.x, pointer.y);
        return;
      }

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

      if (this._tool === 'edit' && this._draggingPart && down.length === 1 && this._selectedPart) {
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

        if (this._tool === 'finish') {
          this._placeFinishLineAt(world.x, world.y);
        } else if (this._tool === 'checkpoint') {
          this._placeCheckpointAt(world.x, world.y);
        } else {
          const hit = this._findControlAt(world.x, world.y);

          if (hit) {
            this._selectedNode = hit.index;
            this._selectedPart = hit;
          } else {
            const node = this._createNode(world.x, world.y);

            if (this._nodes.length > 0) {
              const prev = this._nodes[this._nodes.length - 1];
              const handleLen = 60;

              let dx = node.x - prev.x;
              let dy = node.y - prev.y;

              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              dx /= len;
              dy /= len;

              prev.handleOut.x = prev.x + dx * handleLen;
              prev.handleOut.y = prev.y + dy * handleLen;
            }

            this._nodes.push(node);
            this._selectedNode = this._nodes.length - 1;
            this._selectedPart = { type: 'node', index: this._selectedNode };
          }

          this._updatePanel();
          this._redrawEditor();
        }
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

    this._createGuideInput();
    this._updateLoopButton();
    this._updateToolButtons();
    this._updatePanel();
    this._redrawEditor();
  }
  // =================================================
  // Guía de fondo
  // =================================================
  _createGuideInput() {
    this._destroyGuideInput();

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    input.style.opacity = '0';

    input.addEventListener('change', (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      this._loadGuideImage(file);
      input.value = '';
    });

    document.body.appendChild(input);
    this._guideInput = input;
  }

  _destroyGuideInput() {
    if (this._guideInput && this._guideInput.parentNode) {
      this._guideInput.parentNode.removeChild(this._guideInput);
    }
    this._guideInput = null;
  }

  _openGuidePicker() {
    if (!this._guideInput) this._createGuideInput();
    this._guideInput?.click();
  }

  _loadGuideImage(file) {
    const url = URL.createObjectURL(file);
    const key = `trackstudio-guide-${Date.now()}`;

    this.load.image(key, url);

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      URL.revokeObjectURL(url);

      if (this._guideImage) {
        this._guideImage.destroy();
        this._guideImage = null;
      }

      if (this._guideTextureKey && this.textures.exists(this._guideTextureKey)) {
        this.textures.remove(this._guideTextureKey);
      }

      this._guideTextureKey = key;

      const tex = this.textures.get(key).getSourceImage();
      const imgW = tex.width || 1;
      const imgH = tex.height || 1;

      const fitScale = Math.min(
        (this._editorWorldW * 0.8) / imgW,
        (this._editorWorldH * 0.8) / imgH,
        1
      );

      this._guideImage = this.add.image(
        this._editorWorldW / 2,
        this._editorWorldH / 2,
        key
      )
        .setDepth(4)
        .setAlpha(this._guideAlpha)
        .setVisible(this._guideVisible)
        .setScale(fitScale);

      this.cameras.main.ignore(this._guideImage);
      this._updatePanel();
    });

    this.load.start();
  }

  _toggleGuideVisibility() {
    this._guideVisible = !this._guideVisible;
    if (this._guideImage) {
      this._guideImage.setVisible(this._guideVisible);
    }
    this._updateToolButtons();
    this._updatePanel();
  }

  _changeGuideAlpha(delta) {
    this._guideAlpha = Phaser.Math.Clamp(this._guideAlpha + delta, 0.05, 1);

    if (this._guideImage) {
      this._guideImage.setAlpha(this._guideAlpha);
    }

    this._updatePanel();
  }

  // =================================================
  // UI helpers
  // =================================================
  _makeIconButton(cx, cy, label, onClick, fontSize = '18px') {
    return this._makeToolButton(cx, cy, 38, 38, label, onClick, { fontSize });
  }

  _makeToolButton(cx, cy, w, h, label, onClick, opts = {}) {
    const fill = opts.fill ?? 0x1c2540;
    const stroke = opts.stroke ?? 0x3c4e7a;
    const fontSize = opts.fontSize ?? '18px';
    const hasCorner = opts.hasCorner ?? false;

    const c = this.add.container(cx, cy);
    c.setDepth(60);

    const bg = this.add.graphics();
    bg.fillStyle(fill, 1);
    bg.lineStyle(2, stroke, 0.95);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    c.add(bg);

    if (hasCorner) {
      const corner = this.add.graphics();
      corner.lineStyle(2, 0xaec6ff, 0.95);
      corner.beginPath();
      corner.moveTo(-w / 2 + 6, -h / 2 + 14);
      corner.lineTo(-w / 2 + 6, -h / 2 + 6);
      corner.lineTo(-w / 2 + 14, -h / 2 + 6);
      corner.strokePath();
      c.add(corner);
      c._corner = corner;
    }

    const txt = this.add.text(0, 0, label, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize,
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    c.add(txt);

    const zone = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerup', (pointer) => {
      pointer.event?.stopPropagation?.();
      onClick();
    });
    c.add(zone);

    c._bg = bg;
    c._txt = txt;
    c._zone = zone;
    c._w = w;
    c._h = h;
    c._fill = fill;
    c._stroke = stroke;
    c._hasCorner = hasCorner;

    return c;
  }

  _setToolButtonStyle(btn, fill, stroke) {
    if (!btn?._bg) return;

    btn._fill = fill;
    btn._stroke = stroke;

    btn._bg.clear();
    btn._bg.fillStyle(fill, 1);
    btn._bg.lineStyle(2, stroke, 0.95);
    btn._bg.fillRoundedRect(-btn._w / 2, -btn._h / 2, btn._w, btn._h, 8);
    btn._bg.strokeRoundedRect(-btn._w / 2, -btn._h / 2, btn._w, btn._h, 8);
  }

  _makeGroupButton(cx, cy, initialLabel, items, opts = {}) {
    const btn = this._makeToolButton(cx, cy, 40, 40, initialLabel, () => {
      this._toggleFlyout(btn, items, opts);
    }, {
      fontSize: opts.fontSize ?? '18px',
      hasCorner: true
    });

    btn._groupItems = items;
    btn._groupName = opts.groupName || 'group';
    btn._groupHorizontal = !!opts.horizontal;
    return btn;
  }

  _toggleFlyout(anchorBtn, items, opts = {}) {
    if (this._activeFlyoutGroup === anchorBtn._groupName) {
      this._closeFlyout();
      return;
    }

    this._closeFlyout();

    const fly = this.add.container(0, 0);
    fly.setDepth(80);

    const horizontal = !!opts.horizontal;
    const spacing = 44;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const x = horizontal ? anchorBtn.x + (i + 1) * spacing : anchorBtn.x;
      const y = horizontal ? anchorBtn.y : anchorBtn.y + (i + 1) * spacing;

      const child = this._makeToolButton(x, y, 40, 40, item.label, () => {
        anchorBtn._txt.setText(item.label);
        this._closeFlyout();
        item.action();
      }, {
        fontSize: opts.fontSize ?? '18px'
      });

      fly.add(child);
    }

    this._activeFlyout = fly;
    this._activeFlyoutGroup = anchorBtn._groupName;
  }

  _closeFlyout() {
    if (this._activeFlyout) {
      this._activeFlyout.destroy(true);
      this._activeFlyout = null;
      this._activeFlyoutGroup = null;
    }
  }

  _getNudgeStep() {
    return this._nudgeSteps[this._nudgeStepIndex];
  }

  _cycleNudgeStep() {
    this._nudgeStepIndex = (this._nudgeStepIndex + 1) % this._nudgeSteps.length;
    if (this._nudgeStepBtn?._txt) {
      this._nudgeStepBtn._txt.setText(String(this._getNudgeStep()));
    }
    this._updatePanel();
  }

  _setTool(tool) {
    this._tool = tool;
    this._updateToolButtons();
    this._updatePanel();
  }

  _updateToolButtons() {
    if (this._groupButtons.mode) {
      this._setToolButtonStyle(this._groupButtons.mode, 0x1c2540, 0x3c4e7a);
    }
    if (this._groupButtons.guide) {
      this._setToolButtonStyle(this._groupButtons.guide, 0x1c2540, 0x3c4e7a);
    }

    if (this._tool === 'finish' && this._groupButtons.mode) {
      this._setToolButtonStyle(this._groupButtons.mode, 0x2b8a3e, 0xa8ffb8);
      this._groupButtons.mode._txt.setText('🏁');
    } else if (this._tool === 'checkpoint' && this._groupButtons.mode) {
      this._setToolButtonStyle(this._groupButtons.mode, 0x235c9f, 0xaed4ff);
      this._groupButtons.mode._txt.setText('CP');
    } else if (this._groupButtons.mode) {
      this._groupButtons.mode._txt.setText(this._isClosed ? '🔒' : '🔓');
    }

    if (this._groupButtons.guide) {
      this._groupButtons.guide._txt.setText(this._guideVisible ? '👁' : 'IMG');
      if (this._guideVisible) {
        this._setToolButtonStyle(this._groupButtons.guide, 0x1f4f2d, 0x8df0a8);
      }
    }

    if (this._nudgeStepBtn?._txt) {
      this._nudgeStepBtn._txt.setText(String(this._getNudgeStep()));
    }
  }

  _toggleClosed() {
    this._isClosed = !this._isClosed;
    this._updateLoopButton();
    this._updatePanel();
    this._redrawEditor();
  }

  _updateLoopButton() {
    if (this._groupButtons?.mode && this._tool === 'edit') {
      this._groupButtons.mode._txt.setText(this._isClosed ? '🔒' : '🔓');
    }
  }

  // =================================================
  // Core editor helpers
  // =================================================
  _createNode(x, y) {
    const handleLen = 60;

    if (!this._nodes || this._nodes.length === 0) {
      return {
        x,
        y,
        handleIn: { x: x - handleLen, y },
        handleOut: { x: x + handleLen, y }
      };
    }

    const prev = this._nodes[this._nodes.length - 1];

    let dx = x - prev.x;
    let dy = y - prev.y;

    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= len;
    dy /= len;

    return {
      x,
      y,
      handleIn: {
        x: x - dx * handleLen,
        y: y - dy * handleLen
      },
      handleOut: {
        x: x + dx * handleLen,
        y: y + dy * handleLen
      }
    };
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

    if (this._isClosed && pts.length > 1) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      const dx = last.x - first.x;
      const dy = last.y - first.y;
      const d2 = dx * dx + dy * dy;

      if (d2 < 0.0001) {
        pts.pop();
      }
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

  _findNearestCurvePoint(worldX, worldY) {
    const pts = this._getBezierPoints();
    if (pts.length < 2) return null;

    let bestI = 0;
    let bestD2 = Infinity;

    for (let i = 0; i < pts.length; i++) {
      const dx = pts[i].x - worldX;
      const dy = pts[i].y - worldY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestI = i;
      }
    }

    const prevIndex = this._isClosed
      ? (bestI - 1 + pts.length) % pts.length
      : Math.max(0, bestI - 1);

    const nextIndex = this._isClosed
      ? (bestI + 1) % pts.length
      : Math.min(pts.length - 1, bestI + 1);

    const pPrev = pts[prevIndex];
    const pCurr = pts[bestI];
    const pNext = pts[nextIndex];

    let tx = pNext.x - pPrev.x;
    let ty = pNext.y - pPrev.y;
    const tl = Math.sqrt(tx * tx + ty * ty) || 1;
    tx /= tl;
    ty /= tl;

    const nx = -ty;
    const ny = tx;

    return {
      point: { x: pCurr.x, y: pCurr.y },
      tangent: { x: tx, y: ty },
      normal: { x: nx, y: ny }
    };
  }

  _placeFinishLineAt(worldX, worldY) {
    const hit = this._findNearestCurvePoint(worldX, worldY);
    if (!hit) return;

    const half = this._trackWidth * 0.5;

    this._finishLine = {
      a: {
        x: hit.point.x - hit.normal.x * half,
        y: hit.point.y - hit.normal.y * half
      },
      b: {
        x: hit.point.x + hit.normal.x * half,
        y: hit.point.y + hit.normal.y * half
      },
      normal: {
        x: hit.tangent.x,
        y: hit.tangent.y
      }
    };

    this._updatePanel();
    this._redrawEditor();
  }

  _placeCheckpointAt(worldX, worldY) {
    const hit = this._findNearestCurvePoint(worldX, worldY);
    if (!hit) return;

    const half = this._trackWidth * 0.5;

    this._checkpoints.push({
      a: {
        x: hit.point.x - hit.normal.x * half,
        y: hit.point.y - hit.normal.y * half
      },
      b: {
        x: hit.point.x + hit.normal.x * half,
        y: hit.point.y + hit.normal.y * half
      },
      normal: {
        x: hit.tangent.x,
        y: hit.tangent.y
      }
    });

    this._updatePanel();
    this._redrawEditor();
  }

  _redrawEditor() {
    this._trackGfx.clear();
    this._curveGfx.clear();
    this._guideGfx.clear();
    this._checkpointGfx.clear();
    this._finishGfx.clear();
    this._nodeGfx.clear();

    const bezier = this._getBezierPoints();

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

    for (let i = 0; i < this._checkpoints.length; i++) {
      const cp = this._checkpoints[i];

      this._checkpointGfx.lineStyle(8, 0x4db0ff, 0.95);
      this._checkpointGfx.beginPath();
      this._checkpointGfx.moveTo(cp.a.x, cp.a.y);
      this._checkpointGfx.lineTo(cp.b.x, cp.b.y);
      this._checkpointGfx.strokePath();

      const midX = (cp.a.x + cp.b.x) * 0.5;
      const midY = (cp.a.y + cp.b.y) * 0.5;

      this._checkpointGfx.fillStyle(0x4db0ff, 1);
      this._checkpointGfx.fillCircle(midX, midY, 9);

      this._checkpointGfx.lineStyle(2, 0x0b1020, 0.9);
      this._checkpointGfx.strokeCircle(midX, midY, 9);

      this._checkpointGfx.fillStyle(0x0b1020, 1);
      this._checkpointGfx.fillCircle(midX, midY, 3);
    }

    if (this._finishLine?.a && this._finishLine?.b) {
      this._finishGfx.lineStyle(10, 0xffffff, 0.95);
      this._finishGfx.beginPath();
      this._finishGfx.moveTo(this._finishLine.a.x, this._finishLine.a.y);
      this._finishGfx.lineTo(this._finishLine.b.x, this._finishLine.b.y);
      this._finishGfx.strokePath();

      this._finishGfx.lineStyle(4, 0x111111, 0.95);
      this._finishGfx.beginPath();
      this._finishGfx.moveTo(this._finishLine.a.x, this._finishLine.a.y);
      this._finishGfx.lineTo(this._finishLine.b.x, this._finishLine.b.y);
      this._finishGfx.strokePath();

      this._finishGfx.fillStyle(0xffd166, 1);
      this._finishGfx.fillCircle(this._finishLine.a.x, this._finishLine.a.y, 5);
      this._finishGfx.fillCircle(this._finishLine.b.x, this._finishLine.b.y, 5);
    }

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
    const guideLoaded = !!this._guideImage;

    if (this._selectedNode < 0 || this._selectedNode >= this._nodes.length) {
      this._panelText.setText(
        'Sin nodo seleccionado\n' +
        `Herramienta: ${this._tool}\n` +
        `Nodos: ${this._nodes.length}\n` +
        `Loop: ${this._isClosed ? 'cerrado' : 'abierto'}\n` +
        `Meta: ${this._finishLine ? 'sí' : 'no'}\n` +
        `Checkpoints: ${this._checkpoints.length}\n` +
        `Guía: ${guideLoaded ? (this._guideVisible ? 'visible' : 'oculta') : 'no cargada'}\n` +
        `Alpha guía: ${this._guideAlpha.toFixed(2)}\n` +
        `Nudge: ${this._getNudgeStep()}px\n` +
        `Zoom: ${this._editCam ? this._editCam.zoom.toFixed(2) : '0.00'}\n` +
        `Ancho: ${this._trackWidth}px`
      );
      return;
    }

    const n = this._nodes[this._selectedNode];
    const part = this._selectedPart?.type || 'node';

    this._panelText.setText(
      `Nodo #${this._selectedNode}\n` +
      `Herramienta: ${this._tool}\n` +
      `Modo: ${part}\n` +
      `Loop: ${this._isClosed ? 'cerrado' : 'abierto'}\n` +
      `Meta: ${this._finishLine ? 'sí' : 'no'}\n` +
      `Checkpoints: ${this._checkpoints.length}\n` +
      `Guía: ${guideLoaded ? (this._guideVisible ? 'visible' : 'oculta') : 'no cargada'}\n` +
      `Alpha guía: ${this._guideAlpha.toFixed(2)}\n` +
      `Nudge: ${this._getNudgeStep()}px\n` +
      `X: ${Math.round(n.x)}\n` +
      `Y: ${Math.round(n.y)}\n` +
      `In: ${Math.round(n.handleIn.x)}, ${Math.round(n.handleIn.y)}\n` +
      `Out: ${Math.round(n.handleOut.x)}, ${Math.round(n.handleOut.y)}\n` +
      `Total: ${this._nodes.length}\n` +
      `Zoom: ${this._editCam ? this._editCam.zoom.toFixed(2) : '0.00'}\n` +
      `Ancho: ${this._trackWidth}px`
    );
  }

  // =================================================
  // SAVE / LOAD / NEW
  // =================================================
  _getProjectData() {
    return {
      version: 1,
      nodes: this._nodes,
      trackWidth: this._trackWidth,
      isClosed: this._isClosed,
      finishLine: this._finishLine,
      checkpoints: this._checkpoints,
      guideAlpha: this._guideAlpha,
      guideVisible: this._guideVisible,
      nudgeStepIndex: this._nudgeStepIndex
    };
  }

  _applyProjectData(data) {
    this._nodes = data.nodes || [];
    this._trackWidth = data.trackWidth ?? 140;
    this._isClosed = data.isClosed ?? false;
    this._finishLine = data.finishLine || null;
    this._checkpoints = data.checkpoints || [];
    this._guideAlpha = data.guideAlpha ?? 0.32;
    this._guideVisible = data.guideVisible ?? true;
    this._nudgeStepIndex = data.nudgeStepIndex ?? 2;

    if (this._guideImage) {
      this._guideImage.setAlpha(this._guideAlpha);
      this._guideImage.setVisible(this._guideVisible);
    }

    this._selectedNode = -1;
    this._selectedPart = null;
    this._tool = 'edit';

    this._updateLoopButton();
    this._updateToolButtons();
    this._updatePanel();
    this._redrawEditor();
  }

  _saveProject() {
    try {
      const data = this._getProjectData();
      localStorage.setItem('trackstudio_project', JSON.stringify(data));
      console.log('✅ Proyecto guardado');
    } catch (e) {
      console.error('❌ Error guardando proyecto', e);
    }
  }

  _loadProject() {
    try {
      const raw = localStorage.getItem('trackstudio_project');
      if (!raw) {
        console.warn('⚠️ No hay proyecto guardado');
        return;
      }

      const data = JSON.parse(raw);
      this._applyProjectData(data);
      console.log('📂 Proyecto cargado');
    } catch (e) {
      console.error('❌ Error cargando proyecto', e);
    }
  }

  _newProject() {
    this._nodes = [];
    this._finishLine = null;
    this._checkpoints = [];
    this._isClosed = false;
    this._trackWidth = 140;
    this._selectedNode = -1;
    this._selectedPart = null;
    this._tool = 'edit';

    this._updateLoopButton();
    this._updateToolButtons();
    this._updatePanel();
    this._redrawEditor();

    console.log('🆕 Nuevo proyecto');
  }
}
