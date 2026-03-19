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
  this._rightPanelW = 320;
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

  // toolbar/contexto
  this._saveTool = 'save';
  this._viewTool = 'zoomIn';
  this._modeTool = 'edit';
  this._trackTool = 'widthUp';
  this._guideTool = 'load';

  this._activeTopTool = 'mode';
  this._contextButtons = [];

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

  this._panelText = this.add.text(width - this._rightPanelW + 20, this._topBarH + 58, 'Sin selección', {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '14px',
    color: '#ffffff',
    lineSpacing: 2,
    wordWrap: { width: this._rightPanelW - 40 }
  });

  this._contextTitle = this.add.text(
    width - this._rightPanelW + 20,
    this._topBarH + 290,
    'HERRAMIENTA ACTIVA',
    {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '17px',
      color: '#c7d2ff',
      fontStyle: 'bold'
    }
  );

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

  this._leftToolsTitle = this.add.text(leftCX, leftY, 'NAV', {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '12px',
    color: '#90a4d4',
    fontStyle: 'bold'
  }).setOrigin(0.5, 0);

  this._leftHomeBtn = this._makeIconButton(leftCX, this._topBarH + 74, '⌂', () => {
    this._editCam.centerOn(this._editorWorldW / 2, this._editorWorldH / 2);
    this._updatePanel();
  }, '18px');

  this._leftZoomInBtn = this._makeIconButton(leftCX, this._topBarH + 122, '+', () => {
    this._applyZoomAtViewportCenter(1.15);
  }, '20px');

  this._leftZoomOutBtn = this._makeIconButton(leftCX, this._topBarH + 170, '−', () => {
    this._applyZoomAtViewportCenter(1 / 1.15);
  }, '22px');

  // =================================================
  // Barra superior
  // =================================================
  const topToolsY = 36;
  let topX = 470;

  this._saveMainBtn = this._makeIconButton(topX, topToolsY, '💾', () => {
    this._setActiveTopTool('save');
  }, '16px');
  topX += 48;

  this._viewMainBtn = this._makeIconButton(topX, topToolsY, '🔍', () => {
    this._setActiveTopTool('view');
  }, '16px');
  topX += 48;

  this._modeMainBtn = this._makeIconButton(topX, topToolsY, '✏', () => {
    this._setActiveTopTool('mode');
  }, '16px');
  topX += 48;

  this._trackMainBtn = this._makeIconButton(topX, topToolsY, 'W', () => {
    this._setActiveTopTool('track');
  }, '18px');
  topX += 48;

  this._guideMainBtn = this._makeIconButton(topX, topToolsY, '👁', () => {
    this._setActiveTopTool('guide');
  }, '16px');
  topX += 58;

  this._nudgeStepBtn = this._makeIconButton(topX, topToolsY, String(this._getNudgeStep()), () => {
    this._cycleNudgeStep();
  }, '16px');
  topX += 48;

  this._btnLeft = this._makeIconButton(topX, topToolsY, '←', () => {
    this._nudgeSelectedNode(-this._getNudgeStep(), 0);
  }, '18px');
  topX += 42;

  this._btnUp = this._makeIconButton(topX, topToolsY, '↑', () => {
    this._nudgeSelectedNode(0, -this._getNudgeStep());
  }, '18px');
  topX += 42;

  this._btnDown = this._makeIconButton(topX, topToolsY, '↓', () => {
    this._nudgeSelectedNode(0, this._getNudgeStep());
  }, '18px');
  topX += 42;

  this._btnRight = this._makeIconButton(topX, topToolsY, '→', () => {
    this._nudgeSelectedNode(this._getNudgeStep(), 0);
  }, '18px');
  topX += 42;

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
      this._selectedPart = hit;
      this._draggingPart = true;
      this._dragMoved = false;
      this._dragStartScreen = { x: pointer.x, y: pointer.y };
      this._dragStartWorld = { x: world.x, y: world.y };

      if (
        hit.type === 'piano' ||
        hit.type === 'pianoA' ||
        hit.type === 'pianoB'
      ) {
        this._selectedPiano = hit.index;
        this._selectedNode = -1;
      } else {
        this._selectedNode = hit.index;
        this._selectedPiano = -1;
      }

      this._updatePanel();

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

      if (
        this._selectedPart.type === 'piano' ||
        this._selectedPart.type === 'pianoA' ||
        this._selectedPart.type === 'pianoB'
      ) {
        this._updatePianoDrag(this._selectedPart, world);
        this._selectedPiano = idx;
        this._selectedNode = -1;
        this._updatePanel();

        return;
      }

      if (
        this._selectedPart.type === 'node' ||
        this._selectedPart.type === 'handleIn' ||
        this._selectedPart.type === 'handleOut'
      ) {
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

        this._selectedNode = idx;
        this._selectedPiano = -1;
        this._updatePanel();

        return;
      }
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
          const halfLen = 38;

          const a = {
            x: hit.point.x - hit.tangent.x * halfLen + hit.normal.x * half,
            y: hit.point.y - hit.tangent.y * halfLen + hit.normal.y * half
          };

          const b = {
            x: hit.point.x + hit.tangent.x * halfLen + hit.normal.x * half,
            y: hit.point.y + hit.tangent.y * halfLen + hit.normal.y * half
          };

          this._pianos.push({
            a,
            b,
            point: { x: hit.point.x + hit.normal.x * half, y: hit.point.y + hit.normal.y * half },
            normal: { x: hit.normal.x, y: hit.normal.y },
            tangent: { x: hit.tangent.x, y: hit.tangent.y }
          });

          this._selectedPiano = this._pianos.length - 1;
          this._selectedNode = -1;
          this._selectedPart = { type: 'piano', index: this._selectedPiano };
        }

      } else {
        const pianoHit = this._findPianoControl(world.x, world.y);
        if (pianoHit) {
          this._selectedPiano = pianoHit.index;
          this._selectedNode = -1;
          this._selectedPart = pianoHit;
          this._updatePanel();

          return;
        }

        const hit = this._findControlAt(world.x, world.y);

        if (hit) {
          this._selectedNode = hit.index;
          this._selectedPiano = -1;
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
          this._selectedPiano = -1;
          this._selectedPart = { type: 'node', index: this._selectedNode };
        }
      }

      this._updatePanel();

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
  this._updateToolButtons();
  this._renderContextPanel();
  this._updatePanel();

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

  const zone = this.add.zone(0, 0, 40, 40)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  zone.on('pointerup', onMainClick);
  c.add(zone);

  c._bg = bg;
  c._txt = txt;
  c._zone = zone;

  return c;
}

_makePanelActionButton(x, y, w, h, label, active, onClick) {
  const bg = this.add.rectangle(
    x + w * 0.5,
    y + h * 0.5,
    w,
    h,
    active ? 0x2a4277 : 0x18233a,
    1
  )
    .setStrokeStyle(2, active ? 0x8eb8ff : 0x3c4e7a, 0.95)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  const txt = this.add.text(x + 14, y + h * 0.5, label, {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '14px',
    color: '#ffffff',
    fontStyle: active ? 'bold' : 'normal'
  }).setOrigin(0, 0.5);

  bg.on('pointerup', onClick);

  return { bg, txt };
}

_clearContextButtons() {
  if (!this._contextButtons) this._contextButtons = [];
  for (const btn of this._contextButtons) {
    try { btn.bg?.destroy(); } catch (e) {}
    try { btn.txt?.destroy(); } catch (e) {}
  }
  this._contextButtons = [];
}

_setActiveTopTool(toolName) {
  this._activeTopTool = toolName;
  this._updateToolButtons();
  this._renderContextPanel();
  this._updatePanel();
}

_renderContextPanel() {
  this._clearContextButtons();

  const x = this.scale.width - this._rightPanelW + 20;
  let y = this._topBarH + 328;
  const w = this._rightPanelW - 40;
  const h = 40;
  const gap = 10;

  if (this._contextTitle) {
    const map = {
      save: 'ARCHIVO',
      view: 'VISTA',
      mode: 'HERRAMIENTAS',
      track: 'PISTA',
      guide: 'GUÍA'
    };
    this._contextTitle.setText(map[this._activeTopTool] || 'HERRAMIENTA');
  }

  const addBtn = (label, active, onClick) => {
    const btn = this._makePanelActionButton(x, y, w, h, label, active, onClick);
    this._contextButtons.push(btn);
    y += h + gap;
  };

  if (this._activeTopTool === 'save') {
    addBtn('Guardar proyecto', this._saveTool === 'save', () => {
      this._saveTool = 'save';
      this._saveProject();
      this._updateToolButtons();
      this._updatePanel();
    });

    addBtn('Cargar proyecto', this._saveTool === 'load', () => {
      this._saveTool = 'load';
      this._loadProject();
      this._updateToolButtons();
      this._updatePanel();
    });

    addBtn('Nuevo proyecto', this._saveTool === 'new', () => {
      this._saveTool = 'new';
      this._newProject();
      this._updateToolButtons();
      this._updatePanel();
    });
    return;
  }

  if (this._activeTopTool === 'view') {
    addBtn('Zoom +', this._viewTool === 'zoomIn', () => {
      this._viewTool = 'zoomIn';
      this._applyZoomAtViewportCenter(1.15);
      this._updateToolButtons();
    });

    addBtn('Zoom -', this._viewTool === 'zoomOut', () => {
      this._viewTool = 'zoomOut';
      this._applyZoomAtViewportCenter(1 / 1.15);
      this._updateToolButtons();
    });

    addBtn('Centrar cámara', this._viewTool === 'center', () => {
      this._viewTool = 'center';
      this._editCam.centerOn(this._editorWorldW / 2, this._editorWorldH / 2);
      this._editCam.setZoom(0.28);
      this._updateToolButtons();
      this._updatePanel();
    });
    return;
  }

  if (this._activeTopTool === 'mode') {
    addBtn('Editar nodos', this._tool === 'edit' && this._modeTool === 'edit', () => {
      this._modeTool = 'edit';
      this._setTool('edit');
    });

    addBtn('Línea de meta', this._tool === 'finish', () => {
      this._modeTool = 'finish';
      this._setTool('finish');
    });

    addBtn('Checkpoint', this._tool === 'checkpoint', () => {
      this._modeTool = 'checkpoint';
      this._setTool('checkpoint');
    });

    addBtn('Piano', this._tool === 'piano', () => {
      this._modeTool = 'piano';
      this._setTool('piano');
    });

    addBtn(this._isClosed ? 'Loop: cerrado' : 'Loop: abierto', false, () => {
      this._isClosed = !this._isClosed;

      this._updatePanel();
      this._renderContextPanel();
    });
    return;
  }

  if (this._activeTopTool === 'track') {
    addBtn(`Ancho - (${this._trackWidth}px)`, this._trackTool === 'widthDown', () => {
      this._trackTool = 'widthDown';
      this._changeTrackWidth(-10);
      this._updateToolButtons();
      this._renderContextPanel();
    });

    addBtn(`Ancho + (${this._trackWidth}px)`, this._trackTool === 'widthUp', () => {
      this._trackTool = 'widthUp';
      this._changeTrackWidth(10);
      this._updateToolButtons();
      this._renderContextPanel();
    });
    return;
  }

  if (this._activeTopTool === 'guide') {
    addBtn('Cargar imagen guía', this._guideTool === 'load', () => {
      this._guideTool = 'load';
      this._openGuidePicker();
      this._updateToolButtons();
    });

    addBtn(this._guideVisible ? 'Ocultar guía' : 'Mostrar guía', this._guideTool === 'toggle', () => {
      this._guideTool = 'toggle';
      this._toggleGuideVisibility();
      this._updateToolButtons();
      this._renderContextPanel();
    });

    addBtn(`Alpha - (${this._guideAlpha.toFixed(2)})`, false, () => {
      this._changeGuideAlpha(-0.08);
      this._renderContextPanel();
    });

    addBtn(`Alpha + (${this._guideAlpha.toFixed(2)})`, false, () => {
      this._changeGuideAlpha(0.08);
      this._renderContextPanel();
    });
  }
}

// stubs antiguos para no romper pointerdown heredado
_makeMenuPanel(baseX, baseY, items, makeBtn) {
  return null;
}
_clearSideGroup() {}
_renderSideGroup(items, onItemClick) {}

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
  this._setActiveTopTool('save');
}

_closeSaveMenu() {}
_isPointerInSaveMenu(pointer) { return false; }

_getViewToolLabel() {
  if (this._viewTool === 'zoomIn') return '🔍';
  if (this._viewTool === 'zoomOut') return '🔎';
  return '◎';
}

_runActiveViewTool() {
  this._setActiveTopTool('view');
}

_toggleViewMenu() {
  this._setActiveTopTool('view');
}

_closeViewMenu() {}
_isPointerInViewMenu(pointer) { return false; }

_getModeToolLabel() {
  if (this._modeTool === 'finish') return '🏁';
  if (this._modeTool === 'checkpoint') return 'CP';
  if (this._modeTool === 'piano') return 'PI';
  return this._isClosed ? '🔒' : '✏';
}

_runActiveModeTool() {
  this._setActiveTopTool('mode');
}

_toggleModeMenu() {
  this._setActiveTopTool('mode');
}

_closeModeMenu() {}
_isPointerInModeMenu(pointer) { return false; }

_getTrackToolLabel() {
  return this._trackTool === 'widthDown' ? 'W-' : 'W+';
}

_runActiveTrackTool() {
  this._setActiveTopTool('track');
}

_toggleTrackMenu() {
  this._setActiveTopTool('track');
}

_closeTrackMenu() {}
_isPointerInTrackMenu(pointer) { return false; }

_getGuideToolLabel() {
  return this._guideTool === 'toggle' ? '👁' : 'IMG';
}

_runActiveGuideTool() {
  this._setActiveTopTool('guide');
}

_toggleGuideMenu() {
  this._setActiveTopTool('guide');
}

_closeGuideMenu() {}
_isPointerInGuideMenu(pointer) { return false; }

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
  if (tool === 'piano') this._modeTool = 'piano';
  if (tool === 'edit') this._modeTool = 'edit';
  this._updateToolButtons();
  this._renderContextPanel();
  this._updatePanel();
}

_paintCircleButton(btn, active = false, fill = 0x1c2540, stroke = 0x3c4e7a) {
  if (!btn?.bg) return;
  btn.bg.setFillStyle(active ? fill : 0x1c2540, 1);
  btn.bg.setStrokeStyle(2, active ? stroke : 0x3c4e7a, 0.95);
}

_updateToolButtons() {
  if (this._nudgeStepBtn?.txt) {
    this._nudgeStepBtn.txt.setText(String(this._getNudgeStep()));
  }

  this._paintCircleButton(this._saveMainBtn, this._activeTopTool === 'save', 0x2a4277, 0x8eb8ff);
  this._paintCircleButton(this._viewMainBtn, this._activeTopTool === 'view', 0x2a4277, 0x8eb8ff);
  this._paintCircleButton(this._modeMainBtn, this._activeTopTool === 'mode', 0x2a4277, 0x8eb8ff);
  this._paintCircleButton(this._trackMainBtn, this._activeTopTool === 'track', 0x2a4277, 0x8eb8ff);
  this._paintCircleButton(this._guideMainBtn, this._activeTopTool === 'guide', this._guideVisible ? 0x1f4f2d : 0x2a4277, this._guideVisible ? 0x8df0a8 : 0x8eb8ff);
}

_toggleClosed() {
  this._isClosed = !this._isClosed;
  this._updateToolButtons();
  this._renderContextPanel();
  this._updatePanel();

}

_updateLoopButton() {
  // no-op
}

_drawHandleDot(x, y, selected = false) {
  this._nodeGfx.fillStyle(selected ? 0xffd166 : 0xb7c0ff, 1);
  this._nodeGfx.fillCircle(x, y, selected ? 10 : 8);

  this._nodeGfx.lineStyle(2, 0x0b1020, 0.9);
  this._nodeGfx.strokeCircle(x, y, selected ? 10 : 8);
}

_updatePanel() {
  const guideLoaded = !!this._guideImage;

  if (this._selectedPiano >= 0 && this._selectedPiano < this._pianos.length) {
    const p = this._pianos[this._selectedPiano];
    this._panelText.setText(
      `Piano #${this._selectedPiano}\n` +
      `Herramienta: ${this._tool}\n` +
      `Panel: ${this._activeTopTool}\n` +
      `Loop: ${this._isClosed ? 'cerrado' : 'abierto'}\n` +
      `Meta: ${this._finishLine ? 'sí' : 'no'}\n` +
      `Checkpoints: ${this._checkpoints.length}\n` +
      `Guía cargada: ${guideLoaded ? 'sí' : 'no'}\n` +
      `Guía visible: ${this._guideVisible ? 'sí' : 'no'}\n` +
      `Alpha guía: ${this._guideAlpha.toFixed(2)}\n` +
      `Nudge: ${this._getNudgeStep()}px\n` +
      `Centro: ${Math.round(p.point.x)}, ${Math.round(p.point.y)}\n` +
      `A: ${Math.round(p.a.x)}, ${Math.round(p.a.y)}\n` +
      `B: ${Math.round(p.b.x)}, ${Math.round(p.b.y)}\n` +
      `Zoom: ${this._editCam ? this._editCam.zoom.toFixed(2) : '0.00'}\n` +
      `Ancho pista: ${this._trackWidth}px`
    );
    return;
  }

  if (this._selectedNode < 0 || this._selectedNode >= this._nodes.length) {
    this._panelText.setText(
      'Sin selección\n' +
      `Herramienta: ${this._tool}\n` +
      `Panel: ${this._activeTopTool}\n` +
      `Vista: ${this._getViewToolLabel()}\n` +
      `Modo: ${this._getModeToolLabel()}\n` +
      `Pista: ${this._getTrackToolLabel()}\n` +
      `Guía: ${this._getGuideToolLabel()}\n` +
      `Nodos: ${this._nodes.length}\n` +
      `Pianos: ${this._pianos.length}\n` +
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
    `Panel: ${this._activeTopTool}\n` +
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


    console.log('🆕 Nuevo proyecto');
  }
}
