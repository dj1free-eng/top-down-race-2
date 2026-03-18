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
    this._tool = 'edit'; // 'edit' | 'finish' | 'checkpoint' | 'piano'
    this._finishLine = null;
    this._checkpoints = [];

    // pianos manuales
    this._pianos = [];
    this._selectedPiano = -1;

    // guía de fondo
    this._guideImage = null;
    this._guideTextureKey = null;
    this._guideVisible = true;
    this._guideAlpha = 0.32;
    this._guideInput = null;

    // nudge
    this._nudgeSteps = [1, 5, 10];
    this._nudgeStepIndex = 2;

    // grupos toolbar
    this._saveTool = 'save';
    this._saveMenu = null;

    this._viewTool = 'zoomIn';
    this._viewMenu = null;

    this._modeTool = 'edit';
    this._modeMenu = null;

    this._trackTool = 'widthUp';
    this._trackMenu = null;

    this._guideTool = 'load';
    this._guideMenu = null;
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

    const back = this.add.text(width - 38, 18, '←', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: '#1c2540',
      padding: { x: 12, y: 8 }
    })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    back.on('pointerup', () => {
      this._destroyGuideInput();
      this.scene.start('admin-hub');
    });

    // =================================================
    // Barra izquierda
    // =================================================
    const leftCX = Math.floor(this._leftBarW / 2);
    const leftY = this._topBarH + 20;

    this.add.text(leftCX, leftY, 'TOOLS', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#90a4d4',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0);

    // =================================================
    // Barra superior
    // =================================================
    const topToolsY = 36;
    let topX = 260;

    this._saveBtnX = topX;
    this._saveBtnY = topToolsY;
    this._saveMainBtn = this._makeGroupedMainButton(
      this._saveBtnX,
      this._saveBtnY,
      this._getSaveToolLabel(),
      () => this._runActiveSaveTool(),
      () => this._toggleSaveMenu(),
      '14px'
    );
    topX += 52;

    this._viewBtnX = topX;
    this._viewBtnY = topToolsY;
    this._viewMainBtn = this._makeGroupedMainButton(
      this._viewBtnX,
      this._viewBtnY,
      this._getViewToolLabel(),
      () => this._runActiveViewTool(),
      () => this._toggleViewMenu(),
      '12px'
    );
    topX += 52;

    this._modeBtnX = topX;
    this._modeBtnY = topToolsY;
    this._modeMainBtn = this._makeGroupedMainButton(
      this._modeBtnX,
      this._modeBtnY,
      this._getModeToolLabel(),
      () => this._runActiveModeTool(),
      () => this._toggleModeMenu(),
      '14px'
    );
    topX += 52;

    this._trackBtnX = topX;
    this._trackBtnY = topToolsY;
    this._trackMainBtn = this._makeGroupedMainButton(
      this._trackBtnX,
      this._trackBtnY,
      this._getTrackToolLabel(),
      () => this._runActiveTrackTool(),
      () => this._toggleTrackMenu(),
      '13px'
    );
    topX += 52;

    this._guideBtnX = topX;
    this._guideBtnY = topToolsY;
    this._guideMainBtn = this._makeGroupedMainButton(
      this._guideBtnX,
      this._guideBtnY,
      this._getGuideToolLabel(),
      () => this._runActiveGuideTool(),
      () => this._toggleGuideMenu(),
      '12px'
    );
    topX += 52;

    this._guideAlphaMinusBtn = this._makeIconButton(topX, topToolsY, 'A-', () => {
      this._changeGuideAlpha(-0.08);
    }, '13px');
    topX += 44;

    this._guideAlphaPlusBtn = this._makeIconButton(topX, topToolsY, 'A+', () => {
      this._changeGuideAlpha(0.08);
    }, '13px');
    topX += 50;

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
    this._pianoGfx = this.add.graphics().setDepth(9);
    this._checkpointGfx = this.add.graphics().setDepth(10);
    this._finishGfx = this.add.graphics().setDepth(11);
    this._nodeGfx = this.add.graphics().setDepth(12);

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
      this._pianoGfx,
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
      this._pianoGfx,
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
      if (!this._isPointerInViewMenu(pointer)) this._closeViewMenu();
      if (!this._isPointerInSaveMenu(pointer)) this._closeSaveMenu();
      if (!this._isPointerInModeMenu(pointer)) this._closeModeMenu();
      if (!this._isPointerInTrackMenu(pointer)) this._closeTrackMenu();
      if (!this._isPointerInGuideMenu(pointer)) this._closeGuideMenu();

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

    } else if (this._tool === 'piano') {
      const hit = this._findNearestCurvePoint(world.x, world.y);

      if (hit) {
        const half = this._trackWidth * 0.5;

        const a = {
          x: hit.point.x + hit.normal.x * half,
          y: hit.point.y + hit.normal.y * half
        };

        const b = {
          x: hit.point.x + hit.normal.x * (half + 28),
          y: hit.point.y + hit.normal.y * (half + 28)
        };

        this._pianos.push({
          a,
          b,
          point: { x: hit.point.x, y: hit.point.y },
          normal: { x: hit.normal.x, y: hit.normal.y },
          tangent: { x: hit.tangent.x, y: hit.tangent.y }
        });

        this._selectedPiano = this._pianos.length - 1;
      }

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
  _makeIconButton(cx, cy, label, onClick, fontSize = '22px') {
    const bg = this.add.circle(cx, cy, 18, 0x1c2540, 1)
      .setStrokeStyle(2, 0x3c4e7a, 0.95)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(cx, cy, label, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize,
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    bg.on('pointerup', onClick);

    return { bg, txt, x: cx, y: cy };
  }

  _makeGroupedMainButton(cx, cy, label, onMainClick, onLongPressClick, fontSize = '14px') {
    const c = this.add.container(cx, cy);
    c.setDepth(70);

    const bg = this.add.graphics();
    bg.fillStyle(0x1c2540, 1);
    bg.lineStyle(2, 0x3c4e7a, 0.95);
    bg.fillRoundedRect(-20, -20, 40, 40, 8);
    bg.strokeRoundedRect(-20, -20, 40, 40, 8);
    c.add(bg);

    const txt = this.add.text(0, 0, label, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize,
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    c.add(txt);

    const cornerGfx = this.add.graphics();
    cornerGfx.lineStyle(2, 0xaec6ff, 0.95);
    cornerGfx.beginPath();
    cornerGfx.moveTo(-14, -6);
    cornerGfx.lineTo(-14, -14);
    cornerGfx.lineTo(-6, -14);
    cornerGfx.strokePath();
    c.add(cornerGfx);

    let pressTimer = null;
    let longPressTriggered = false;

    const cancelPress = () => {
      if (pressTimer) {
        pressTimer.remove(false);
        pressTimer = null;
      }
    };

    const zone = this.add.zone(0, 0, 40, 40)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', (pointer) => {
      pointer.event?.stopPropagation?.();
      longPressTriggered = false;
      cancelPress();

      pressTimer = this.time.delayedCall(500, () => {
        longPressTriggered = true;
        pressTimer = null;
        onLongPressClick();
      });
    });

    zone.on('pointerup', (pointer) => {
      pointer.event?.stopPropagation?.();

      if (longPressTriggered) {
        longPressTriggered = false;
        cancelPress();
        return;
      }

      cancelPress();
      onMainClick();
    });

    zone.on('pointerout', () => {
      cancelPress();
      longPressTriggered = false;
    });

    c.add(zone);

    c._bg = bg;
    c._txt = txt;
    c._zone = zone;

    return c;
  }

  _makeMenuPanel(baseX, baseY, items, makeBtn) {
    const menu = this.add.container(0, 0);
    menu.setDepth(90);

    const panelX = baseX + 28;
    const panelY = baseY - 20;
    const panelW = items.length * 44 + 12;
    const panelH = 52;

    const panel = this.add.graphics();
    panel.fillStyle(0x101626, 1);
    panel.lineStyle(2, 0x3c4e7a, 0.95);
    panel.fillRoundedRect(panelX - 6, panelY - 6, panelW, panelH, 10);
    panel.strokeRoundedRect(panelX - 6, panelY - 6, panelW, panelH, 10);
    menu.add(panel);

    for (let i = 0; i < items.length; i++) {
      const x = baseX + 48 + (i * 44);
      const y = baseY;
      const btn = makeBtn(items[i], x, y);
      menu.add(btn.bg);
      menu.add(btn.txt);
    }

    menu._x = panelX - 6;
    menu._y = panelY - 6;
    menu._w = panelW;
    menu._h = panelH;

    this._editCam.ignore(menu.list);
    return menu;
  }

  // =================================================
  // Grupo save
  // =================================================
  _getSaveToolLabel() {
    if (this._saveTool === 'save') return '💾';
    if (this._saveTool === 'load') return '📂';
    return 'NEW';
  }

  _runActiveSaveTool() {
    if (this._saveTool === 'save') return this._saveProject();
    if (this._saveTool === 'load') return this._loadProject();
    return this._newProject();
  }

  _toggleSaveMenu() {
    if (this._saveMenu) return this._closeSaveMenu();

    const allItems = [
      { key: 'save', label: '💾' },
      { key: 'load', label: '📂' },
      { key: 'new', label: 'NEW' }
    ];

    const items = allItems.filter(item => item.key !== this._saveTool);

    this._saveMenu = this._makeMenuPanel(this._saveBtnX, this._saveBtnY, items, (item, x, y) => {
      return this._makeIconButton(
        x,
        y,
        item.label,
        () => {
          this._saveTool = item.key;
          this._saveMainBtn._txt.setText(this._getSaveToolLabel());
          this._closeSaveMenu();
          this._runActiveSaveTool();
        },
        item.key === 'new' ? '12px' : '16px'
      );
    });
  }

  _closeSaveMenu() {
    if (!this._saveMenu) return;
    this._saveMenu.destroy(true);
    this._saveMenu = null;
  }

  _isPointerInSaveMenu(pointer) {
    if (!this._saveMenu) return false;
    return (
      pointer.x >= this._saveMenu._x &&
      pointer.x <= this._saveMenu._x + this._saveMenu._w &&
      pointer.y >= this._saveMenu._y &&
      pointer.y <= this._saveMenu._y + this._saveMenu._h
    );
  }

  // =================================================
  // Grupo view
  // =================================================
  _getViewToolLabel() {
    if (this._viewTool === 'zoomIn') return '🔍+';
    if (this._viewTool === 'zoomOut') return '🔎-';
    return '◎';
  }

  _runActiveViewTool() {
    if (this._viewTool === 'zoomIn') return this._applyZoomAtViewportCenter(1.15);
    if (this._viewTool === 'zoomOut') return this._applyZoomAtViewportCenter(1 / 1.15);

    this._editCam.centerOn(this._editorWorldW / 2, this._editorWorldH / 2);
    this._editCam.setZoom(0.28);
    this._updatePanel();
  }

  _toggleViewMenu() {
    if (this._viewMenu) return this._closeViewMenu();

    const allItems = [
      { key: 'zoomIn', label: '🔍+' },
      { key: 'zoomOut', label: '🔎-' },
      { key: 'center', label: '◎' }
    ];

    const items = allItems.filter(item => item.key !== this._viewTool);

    this._viewMenu = this._makeMenuPanel(this._viewBtnX, this._viewBtnY, items, (item, x, y) => {
      return this._makeIconButton(x, y, item.label, () => {
        this._viewTool = item.key;
        this._viewMainBtn._txt.setText(this._getViewToolLabel());
        this._closeViewMenu();
        this._runActiveViewTool();
      }, '12px');
    });
  }

  _closeViewMenu() {
    if (!this._viewMenu) return;
    this._viewMenu.destroy(true);
    this._viewMenu = null;
  }

  _isPointerInViewMenu(pointer) {
    if (!this._viewMenu) return false;
    return (
      pointer.x >= this._viewMenu._x &&
      pointer.x <= this._viewMenu._x + this._viewMenu._w &&
      pointer.y >= this._viewMenu._y &&
      pointer.y <= this._viewMenu._y + this._viewMenu._h
    );
  }

  // =================================================
  // Grupo mode
  // =================================================
  _getModeToolLabel() {
    if (this._modeTool === 'finish') return '🏁';
    if (this._modeTool === 'checkpoint') return 'CP';
    return this._isClosed ? '🔒' : '🔓';
  }

  _runActiveModeTool() {
    if (this._modeTool === 'finish') return this._setTool('finish');
    if (this._modeTool === 'checkpoint') return this._setTool('checkpoint');
    return this._toggleClosed();
  }

_toggleModeMenu() {
  if (this._modeMenu) return this._closeModeMenu();

  const allItems = [
    { key: 'edit', label: this._isClosed ? '🔒' : '🔓' },
    { key: 'finish', label: '🏁' },
    { key: 'checkpoint', label: 'CP' },
    { key: 'piano', label: 'PI' }
  ];

  const items = allItems.filter(item => item.key !== this._modeTool);

  this._modeMenu = this._makeMenuPanel(this._modeBtnX, this._modeBtnY, items, (item, x, y) => {
    return this._makeIconButton(
      x,
      y,
      item.label,
      () => {
        this._modeTool = item.key;
        this._modeMainBtn._txt.setText(this._getModeToolLabel());
        this._closeModeMenu();

        if (item.key === 'edit') {
          this._setTool('edit');
        } else {
          this._setTool(item.key);
        }
      },
      item.key === 'checkpoint' ? '12px' : '13px'
    );
  });
}

  _closeModeMenu() {
    if (!this._modeMenu) return;
    this._modeMenu.destroy(true);
    this._modeMenu = null;
  }

  _isPointerInModeMenu(pointer) {
    if (!this._modeMenu) return false;
    return (
      pointer.x >= this._modeMenu._x &&
      pointer.x <= this._modeMenu._x + this._modeMenu._w &&
      pointer.y >= this._modeMenu._y &&
      pointer.y <= this._modeMenu._y + this._modeMenu._h
    );
  }

  // =================================================
  // Grupo track
  // =================================================
  _getTrackToolLabel() {
    return this._trackTool === 'widthDown' ? 'W-' : 'W+';
  }

  _runActiveTrackTool() {
    if (this._trackTool === 'widthDown') return this._changeTrackWidth(-10);
    return this._changeTrackWidth(10);
  }

  _toggleTrackMenu() {
    if (this._trackMenu) return this._closeTrackMenu();

    const allItems = [
      { key: 'widthDown', label: 'W-' },
      { key: 'widthUp', label: 'W+' }
    ];

    const items = allItems.filter(item => item.key !== this._trackTool);

    this._trackMenu = this._makeMenuPanel(this._trackBtnX, this._trackBtnY, items, (item, x, y) => {
      return this._makeIconButton(x, y, item.label, () => {
        this._trackTool = item.key;
        this._trackMainBtn._txt.setText(this._getTrackToolLabel());
        this._closeTrackMenu();
        this._runActiveTrackTool();
      }, '13px');
    });
  }

  _closeTrackMenu() {
    if (!this._trackMenu) return;
    this._trackMenu.destroy(true);
    this._trackMenu = null;
  }

  _isPointerInTrackMenu(pointer) {
    if (!this._trackMenu) return false;
    return (
      pointer.x >= this._trackMenu._x &&
      pointer.x <= this._trackMenu._x + this._trackMenu._w &&
      pointer.y >= this._trackMenu._y &&
      pointer.y <= this._trackMenu._y + this._trackMenu._h
    );
  }

  // =================================================
  // Grupo guide
  // =================================================
  _getGuideToolLabel() {
    return this._guideTool === 'toggle' ? '👁' : 'IMG';
  }

  _runActiveGuideTool() {
    if (this._guideTool === 'toggle') return this._toggleGuideVisibility();
    return this._openGuidePicker();
  }

  _toggleGuideMenu() {
    if (this._guideMenu) return this._closeGuideMenu();

    const allItems = [
      { key: 'load', label: 'IMG' },
      { key: 'toggle', label: '👁' }
    ];

    const items = allItems.filter(item => item.key !== this._guideTool);

    this._guideMenu = this._makeMenuPanel(this._guideBtnX, this._guideBtnY, items, (item, x, y) => {
      return this._makeIconButton(x, y, item.label, () => {
        this._guideTool = item.key;
        this._guideMainBtn._txt.setText(this._getGuideToolLabel());
        this._closeGuideMenu();
        this._runActiveGuideTool();
      }, item.key === 'load' ? '12px' : '16px');
    });
  }

  _closeGuideMenu() {
    if (!this._guideMenu) return;
    this._guideMenu.destroy(true);
    this._guideMenu = null;
  }

  _isPointerInGuideMenu(pointer) {
    if (!this._guideMenu) return false;
    return (
      pointer.x >= this._guideMenu._x &&
      pointer.x <= this._guideMenu._x + this._guideMenu._w &&
      pointer.y >= this._guideMenu._y &&
      pointer.y <= this._guideMenu._y + this._guideMenu._h
    );
  }

  _getNudgeStep() {
    return this._nudgeSteps[this._nudgeStepIndex];
  }

  _cycleNudgeStep() {
    this._nudgeStepIndex = (this._nudgeStepIndex + 1) % this._nudgeSteps.length;
    if (this._nudgeStepBtn?.txt) {
      this._nudgeStepBtn.txt.setText(String(this._getNudgeStep()));
    }
    this._updatePanel();
  }

  _setTool(tool) {
    this._tool = tool;
    if (tool === 'finish') this._modeTool = 'finish';
    if (tool === 'checkpoint') this._modeTool = 'checkpoint';
    if (tool === 'edit' && this._modeTool !== 'edit') this._modeTool = 'edit';
    this._updateToolButtons();
    this._updatePanel();
  }

  _updateToolButtons() {
    if (this._guideAlphaMinusBtn?.bg) {
      this._guideAlphaMinusBtn.bg.setFillStyle(0x1c2540, 1);
      this._guideAlphaMinusBtn.bg.setStrokeStyle(2, 0x3c4e7a, 0.95);
    }

    if (this._guideAlphaPlusBtn?.bg) {
      this._guideAlphaPlusBtn.bg.setFillStyle(0x1c2540, 1);
      this._guideAlphaPlusBtn.bg.setStrokeStyle(2, 0x3c4e7a, 0.95);
    }

    if (this._nudgeStepBtn?.txt) {
      this._nudgeStepBtn.txt.setText(String(this._getNudgeStep()));
    }

    if (this._saveMainBtn?._txt) this._saveMainBtn._txt.setText(this._getSaveToolLabel());
    if (this._viewMainBtn?._txt) this._viewMainBtn._txt.setText(this._getViewToolLabel());
    if (this._modeMainBtn?._txt) this._modeMainBtn._txt.setText(this._getModeToolLabel());
    if (this._trackMainBtn?._txt) this._trackMainBtn._txt.setText(this._getTrackToolLabel());
    if (this._guideMainBtn?._txt) this._guideMainBtn._txt.setText(this._getGuideToolLabel());

    if (this._guideMainBtn?._bg) {
      this._guideMainBtn._bg.clear();
      this._guideMainBtn._bg.fillStyle(this._guideVisible ? 0x1f4f2d : 0x1c2540, 1);
      this._guideMainBtn._bg.lineStyle(2, this._guideVisible ? 0x8df0a8 : 0x3c4e7a, 0.95);
      this._guideMainBtn._bg.fillRoundedRect(-20, -20, 40, 40, 8);
      this._guideMainBtn._bg.strokeRoundedRect(-20, -20, 40, 40, 8);
    }
  }

  _toggleClosed() {
    this._isClosed = !this._isClosed;
    this._updateToolButtons();
    this._updatePanel();
    this._redrawEditor();
  }

  _updateLoopButton() {
    // ya no usamos loopBtn principal, pero dejamos la helper viva
  }

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

      if (i > 0 && !(this._isClosed && i === segCount - 1)) {
        seg.shift();
      }

      pts.push(...seg);
    }

    if (this._isClosed && pts.length > 1) {
      const first = pts[0];
      const last = pts[pts.length - 1];

      if (first.x !== last.x || first.y !== last.y) {
        pts.push({ x: first.x, y: first.y });
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
    this._pianoGfx.clear();
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

    // Pianos manuales placeholder
    for (let i = 0; i < this._pianos.length; i++) {
      const p = this._pianos[i];
      const selected = i === this._selectedPiano;

      if (p?.a && p?.b) {
        this._pianoGfx.lineStyle(selected ? 12 : 10, selected ? 0xffd166 : 0xd92f2f, 0.95);
        this._pianoGfx.beginPath();
        this._pianoGfx.moveTo(p.a.x, p.a.y);
        this._pianoGfx.lineTo(p.b.x, p.b.y);
        this._pianoGfx.strokePath();

        this._pianoGfx.lineStyle(4, 0xf2f2f2, 0.95);
        this._pianoGfx.beginPath();
        this._pianoGfx.moveTo(p.a.x, p.a.y);
        this._pianoGfx.lineTo(p.b.x, p.b.y);
        this._pianoGfx.strokePath();
      }
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
        `Vista: ${this._getViewToolLabel()}\n` +
        `Modo: ${this._getModeToolLabel()}\n` +
        `Pista: ${this._getTrackToolLabel()}\n` +
        `Guía: ${this._getGuideToolLabel()}\n` +
        `Nodos: ${this._nodes.length}\n` +
        `Loop: ${this._isClosed ? 'cerrado' : 'abierto'}\n` +
        `Meta: ${this._finishLine ? 'sí' : 'no'}\n` +
        `Checkpoints: ${this._checkpoints.length}\n` +
        `Guía cargada: ${guideLoaded ? 'sí' : 'no'}\n` +
        `Guía visible: ${this._guideVisible ? 'sí' : 'no'}\n` +
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
      `Vista: ${this._getViewToolLabel()}\n` +
      `Modo toolbar: ${this._getModeToolLabel()}\n` +
      `Pista toolbar: ${this._getTrackToolLabel()}\n` +
      `Guía toolbar: ${this._getGuideToolLabel()}\n` +
      `Modo: ${part}\n` +
      `Loop: ${this._isClosed ? 'cerrado' : 'abierto'}\n` +
      `Meta: ${this._finishLine ? 'sí' : 'no'}\n` +
      `Checkpoints: ${this._checkpoints.length}\n` +
      `Guía cargada: ${guideLoaded ? 'sí' : 'no'}\n` +
      `Guía visible: ${this._guideVisible ? 'sí' : 'no'}\n` +
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
      nudgeStepIndex: this._nudgeStepIndex,
      viewTool: this._viewTool,
      saveTool: this._saveTool,
      modeTool: this._modeTool,
      trackTool: this._trackTool,
      guideTool: this._guideTool
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
    this._viewTool = data.viewTool || 'zoomIn';
    this._saveTool = data.saveTool || 'save';
    this._modeTool = data.modeTool || 'edit';
    this._trackTool = data.trackTool || 'widthUp';
    this._guideTool = data.guideTool || 'load';

    if (this._guideImage) {
      this._guideImage.setAlpha(this._guideAlpha);
      this._guideImage.setVisible(this._guideVisible);
    }

    this._selectedNode = -1;
    this._selectedPart = null;
    this._tool = 'edit';

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
    this._viewTool = 'zoomIn';
    this._saveTool = 'save';
    this._modeTool = 'edit';
    this._trackTool = 'widthUp';
    this._guideTool = 'load';

    this._updateToolButtons();
    this._updatePanel();
    this._redrawEditor();

    console.log('🆕 Nuevo proyecto');
  }
}
