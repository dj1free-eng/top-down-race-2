import Phaser from 'phaser';
import { BaseScene } from './BaseScene.js';

export class TrackEditorScene extends BaseScene {
  constructor() {
    super({ key: 'TrackEditorScene' });

    this._ui = {};

    this._drawRect = null;
    this._uiTopH = 110;

    this._trackWidth = 160;
    this._trackWidthMin = 40;
    this._trackWidthMax = 260;

    // Editor Bézier / nodos
    this._nodes = [];
    this._closed = false;
    this._selectedNode = -1;
    this._lastTapTime = 0;
    this._selectedHandle = null; // 'in' | 'out' | null
    this._draggingNode = false;
    this._pendingTap = null;

    // Meta manual
    this._finishLine = null; // { a:{x,y}, b:{x,y} } | null
    this._finishEditMode = false;
    this._finishFirstPoint = null;

    // Cámara de edición
    this._editCam = null;
    this._editZoom = 1;
    this._editZoomMin = 0.6;
    this._editZoomMax = 3.5;
    this._panLastMid = null;
    this._pinchLastDist = 0;

    // Imagen de referencia
    this._bgImage = null;
    this._bgImageKey = null;
    this._bgImageBaseScale = 1;
    this._bgImageUserScale = 1;
    this._bgImageUserScaleMin = 0.5;
    this._bgImageUserScaleMax = 2.5;

    // Gráficos editor
        this._gBezier = null;
    this._gNodes = null;
        this._gPreview = null;
    this._gCenterline = null;
    this._gCurbs = null;
    this._gEdges = null;
    this._gFinish = null;
  }

  create() {
    super.create();

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#1b6bff');

    const isNarrow = width < 520;
    const uiScale = isNarrow ? 0.70 : 1.0;
    const S = (n) => Math.floor(n * uiScale);

    // =================================================
    // Header + botones zoom
    // =================================================
    const backSize = isNarrow ? 40 : 44;
    const backX = isNarrow ? 12 : 16;
    const backY = isNarrow ? 12 : 16;

    const backHit = this.add.rectangle(backX, backY, backSize, backSize, 0x000000, 0.0)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .setDepth(200);

    const backG = this.add.graphics().setDepth(201);
    backG.lineStyle(isNarrow ? 4 : 5, 0xffffff, 0.9);

    const cx = backX + backSize / 2;
    const cy = backY + backSize / 2;
    backG.beginPath();
    backG.moveTo(cx + (isNarrow ? 9 : 10), cy - (isNarrow ? 12 : 14));
    backG.lineTo(cx - (isNarrow ? 9 : 10), cy);
    backG.lineTo(cx + (isNarrow ? 9 : 10), cy + (isNarrow ? 12 : 14));
    backG.strokePath();

    backHit.on('pointerdown', () => {
      this.scene.start('admin-hub');
    });

    const makeMiniBtn = (x, y, label, onClick) => {
      const r = this.add.rectangle(x, y, 40, 40, 0xffffff, 0.18)
        .setOrigin(0)
        .setStrokeStyle(2, 0xffffff, 0.45)
        .setInteractive({ useHandCursor: true })
        .setDepth(200);

      const t = this.add.text(x + 20, y + 20, label, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(201);

      r.on('pointerdown', () => onClick?.());
      return { r, t };
    };

    const zoomBtnY = backY;
    const zoomPlusX = backX + backSize + 10;
    const zoomMinusX = zoomPlusX + 48;

    this._ui.zoomPlusBtn = makeMiniBtn(zoomPlusX, zoomBtnY, '+', () => {
      this._editZoom = Phaser.Math.Clamp(this._editZoom * 1.2, this._editZoomMin, this._editZoomMax);
      if (this._editCam) this._editCam.setZoom(this._editZoom);
    });

    this._ui.zoomMinusBtn = makeMiniBtn(zoomMinusX, zoomBtnY, '−', () => {
      this._editZoom = Phaser.Math.Clamp(this._editZoom / 1.2, this._editZoomMin, this._editZoomMax);
      if (this._editCam) this._editCam.setZoom(this._editZoom);
    });

    // =================================================
    // Layout general
    // =================================================
    const pad = isNarrow ? 12 : 16;
    const gap = isNarrow ? 10 : 14;
    const round = isNarrow ? 16 : 18;

    const sideW = Math.floor(
      Math.max(
        isNarrow ? 200 : 220,
        Math.min(isNarrow ? 280 : 320, width * (isNarrow ? 0.30 : 0.28))
      )
    );

    const sideX = Math.floor(width - pad - sideW);
    const sideY = pad;
    const sideH = Math.floor(height - sideY - pad);

    const canvasX = pad;
    const canvasY = this._uiTopH;
    const canvasMaxW = Math.floor(sideX - gap - canvasX);
    const canvasMaxH = Math.floor(height - canvasY - pad);

    let drawW = canvasMaxW;
    let drawH = Math.floor(drawW / 1.5);
    if (drawH > canvasMaxH) {
      drawH = canvasMaxH;
      drawW = Math.floor(drawH * 1.5);
    }

    const drawX = Math.floor(canvasX + (canvasMaxW - drawW) / 2);
    const drawY = Math.floor(canvasY + (canvasMaxH - drawH) / 2);

    this._drawRect = new Phaser.Geom.Rectangle(drawX, drawY, drawW, drawH);

    // =================================================
    // Canvas visual (UI fija)
    // =================================================
    const canvasPanel = this.add.graphics().setDepth(5);
    canvasPanel.fillStyle(0xffffff, 0.14);
    canvasPanel.fillRoundedRect(drawX, drawY, drawW, drawH, round);
    canvasPanel.lineStyle(isNarrow ? 2 : 3, 0xffffff, 0.55);
    canvasPanel.strokeRoundedRect(drawX, drawY, drawW, drawH, round);

    this.add.text(drawX + 14, drawY + 10, 'EDITOR BÉZIER · FASE 1', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: isNarrow ? '11px' : '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setAlpha(0.85).setDepth(6);

    // =================================================
    // Sidebar
    // =================================================
    const sidePanel = this.add.graphics().setDepth(50);
    sidePanel.fillStyle(0xffffff, 0.12);
    sidePanel.fillRoundedRect(sideX, sideY, sideW, sideH, round);
    sidePanel.lineStyle(isNarrow ? 2 : 3, 0xffffff, 0.35);
    sidePanel.strokeRoundedRect(sideX, sideY, sideW, sideH, round);

    this.add.text(sideX + 16, sideY + 12, 'HERRAMIENTAS', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: isNarrow ? '12px' : '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setAlpha(0.9).setDepth(51);

    const btnW = Math.floor(sideW - 36);
    const btnX = Math.floor(sideX + (sideW - btnW) / 2);

    const uiTop = Math.floor(sideY + S(isNarrow ? 34 : 46));
    const colGap = S(8);
    const btnW2 = Math.floor((btnW - colGap) / 2);
    const btnH2 = Math.max(S(26), Math.min(S(32), Math.floor(sideH * 0.055)));

    const makeSideBtn = (x, y, w, h, label, onClick) => {
      const r = this.add.rectangle(x, y, w, h, 0xffffff, 0.18)
        .setOrigin(0)
        .setStrokeStyle(2, 0xffffff, 0.45)
        .setInteractive({ useHandCursor: true })
        .setDepth(60);

      const t = this.add.text(x + w / 2, y + h / 2, label, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: `${S(11)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: Math.max(40, w - 10), useAdvancedWrap: true }
      }).setOrigin(0.5).setDepth(61);

      r.on('pointerdown', () => r.setScale(0.98));
      r.on('pointerup', () => { r.setScale(1); onClick?.(); });
      r.on('pointerupoutside', () => r.setScale(1));

      return { r, t };
    };

    let y = uiTop;
    const col1 = btnX;
    const col2 = btnX + btnW2 + colGap;

    // =================================================
    // Input file imagen referencia
    // =================================================
    const trackFileInput = document.createElement('input');
    trackFileInput.type = 'file';
    trackFileInput.accept = 'image/*';
    trackFileInput.style.display = 'none';
    document.body.appendChild(trackFileInput);

    const syncEditorCameras = () => {
      const editorWorldObjs = [
        this._bgImage,
        this._gBezier,
        this._gNodes,
        this._gPreview,
        this._gCenterline,
        this._gCurbs,
        this._gEdges
      ].filter(Boolean);

      this.cameras.main.ignore(editorWorldObjs);

      const editorUiObjs = this.children.list.filter(obj => !editorWorldObjs.includes(obj));
      if (this._editCam) {
        this._editCam.ignore(editorUiObjs);
      }
    };

    trackFileInput.addEventListener('change', (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result;
        if (!dataUrl) return;

        const htmlImg = new Image();
        htmlImg.onload = () => {
          const key = `track_bg_${Date.now()}`;

          try { if (this._bgImage) this._bgImage.destroy(); } catch (err) {}
          this._bgImage = null;

          try {
            if (this._bgImageKey && this.textures.exists(this._bgImageKey)) {
              this.textures.remove(this._bgImageKey);
            }
          } catch (err) {}

          this._bgImageKey = key;
          this.textures.addImage(key, htmlImg);

          const img = this.add.image(
            this._drawRect.width / 2,
            this._drawRect.height / 2,
            key
          ).setDepth(7);

const scale = Math.min(
  this._drawRect.width / Math.max(1, htmlImg.width),
  this._drawRect.height / Math.max(1, htmlImg.height)
);

// Guardamos la escala base
this._bgImageBaseScale = scale;

// Aplicamos escala base × escala usuario
img.setScale(this._bgImageBaseScale * this._bgImageUserScale);

img.setAlpha(0.42);

          this._bgImage = img;
          syncEditorCameras();
          this._redraw();
        };

        htmlImg.onerror = () => {
          if (this._ui?.report) {
            this._ui.report.setText('❌ No se pudo cargar la imagen.');
          }
        };

        htmlImg.src = dataUrl;
      };

      reader.readAsDataURL(file);
      trackFileInput.value = '';
    });

    // =================================================
    // Botones base Bézier
    // =================================================
    this._ui.closeBtn = makeSideBtn(col1, y, btnW2, btnH2, 'CERRAR', () => {
      this._closed = !this._closed;
      this._ui.closeBtn.t.setText(this._closed ? 'ABRIR' : 'CERRAR');
      this._redraw();
      this._refreshStats();
    });

    this._ui.deleteNodeBtn = makeSideBtn(col2, y, btnW2, btnH2, 'BORRAR NODO', () => {
      if (this._selectedNode < 0 || this._selectedNode >= this._nodes.length) return;
      this._nodes.splice(this._selectedNode, 1);
      this._selectedNode = -1;
      if (this._nodes.length < 2) this._closed = false;
      this._redraw();
      this._refreshStats();
    });

    y += btnH2 + colGap;

    this._ui.clearBtn = makeSideBtn(col1, y, btnW2, btnH2, 'LIMPIAR', () => {
      this._nodes = [];
      this._closed = false;
      this._selectedNode = -1;
      this._draggingNode = false;
      this._ui.closeBtn.t.setText('CERRAR');
      this._redraw();
      this._refreshStats();
      if (this._ui.report) this._ui.report.setText('Sin validar');
    });

    this._ui.exportDraftBtn = makeSideBtn(col2, y, btnW2, btnH2, 'EXPORT DRAFT', () => {
      this._exportBezierDraft();
    });

    y += btnH2 + colGap;

    this._ui.loadImgBtn = makeSideBtn(col1, y, btnW2, btnH2, 'CARGAR IMG', () => {
      trackFileInput.click();
    });

    this._ui.toggleImgBtn = makeSideBtn(col2, y, btnW2, btnH2, 'OCULTAR IMG', () => {
      if (!this._bgImage) return;
      const visible = this._bgImage.visible;
      this._bgImage.setVisible(!visible);
      this._ui.toggleImgBtn.t.setText(visible ? 'MOSTRAR IMG' : 'OCULTAR IMG');
    });

    y += btnH2 + colGap;

    this._ui.clearImgBtn = makeSideBtn(col1, y, btnW2, btnH2, 'BORRAR IMG', () => {
      if (!this._bgImage) return;
      this._bgImage.destroy();
      this._bgImage = null;
      this._ui.toggleImgBtn.t.setText('OCULTAR IMG');
      syncEditorCameras();
      this._redraw();
    });

    this._ui.validateBtn = makeSideBtn(col2, y, btnW2, btnH2, 'VALIDAR', () => {
      const rep = this._validateBezierDraft();
      this._setReport(rep);
    });

    y += btnH2 + S(14);

    // =================================================
    // Opacidad imagen
    // =================================================
    this.add.text(sideX + 18, y, 'OPACIDAD IMG', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: `${S(12)}px`,
      color: '#ffffff',
      fontStyle: 'bold'
    }).setAlpha(0.9).setDepth(61);

    y += S(18);

    const imgSliderW = btnW;
    const imgSliderH = S(12);
    const imgSliderX = btnX;

    this.add.rectangle(imgSliderX, y, imgSliderW, imgSliderH, 0xffffff, 0.18)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setDepth(61);

    const imgKnob = this.add.circle(imgSliderX + imgSliderW * 0.42, y + imgSliderH / 2, S(12), 0xffffff, 0.6)
      .setStrokeStyle(3, 0xffffff, 0.85)
      .setInteractive({ useHandCursor: true })
      .setDepth(62);

    const imgHit = this.add.rectangle(imgSliderX, y - S(10), imgSliderW, imgSliderH + S(20), 0x000000, 0)
      .setOrigin(0)
      .setInteractive()
      .setDepth(63);

    const setImgOpacity = (px) => {
      const t = Phaser.Math.Clamp((px - imgSliderX) / imgSliderW, 0, 1);
      imgKnob.x = imgSliderX + t * imgSliderW;
      if (this._bgImage) {
        this._bgImage.setAlpha(0.1 + t * 0.9);
      }
    };

    imgHit.on('pointerdown', p => setImgOpacity(p.worldX));
    imgHit.on('pointermove', p => { if (p.isDown) setImgOpacity(p.worldX); });

    y += S(26);

    // =================================================
    // Escala imagen
    // =================================================
    this.add.text(sideX + 18, y, 'ESCALA IMG', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: `${S(12)}px`,
      color: '#ffffff',
      fontStyle: 'bold'
    }).setAlpha(0.9).setDepth(61);

    const imgScaleValue = this.add.text(sideX + 18, y + S(16), `${this._bgImageUserScale.toFixed(2)}x`, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: `${S(12)}px`,
      color: '#ffffff'
    }).setAlpha(0.85).setDepth(61);

    const imgScaleSliderW = btnW;
    const imgScaleSliderH = S(12);
    const imgScaleSliderX = btnX;
    const imgScaleTrackY = y + S(38);

    this.add.rectangle(imgScaleSliderX, imgScaleTrackY, imgScaleSliderW, imgScaleSliderH, 0xffffff, 0.18)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setDepth(61);

    const imgScaleKnob = this.add.circle(0, imgScaleTrackY + imgScaleSliderH / 2, S(13), 0xffffff, 0.55)
      .setStrokeStyle(3, 0xffffff, 0.85)
      .setDepth(62)
      .setInteractive({ useHandCursor: true });

    const imgScaleHit = this.add.rectangle(
      imgScaleSliderX,
      imgScaleTrackY - S(10),
      imgScaleSliderW,
      imgScaleSliderH + S(20),
      0x000000,
      0
    )
      .setOrigin(0)
      .setInteractive()
      .setDepth(63);

    const updateImgScaleKnob = () => {
      const t = (this._bgImageUserScale - this._bgImageUserScaleMin) /
        (this._bgImageUserScaleMax - this._bgImageUserScaleMin);

      imgScaleKnob.x = imgScaleSliderX + Phaser.Math.Clamp(t, 0, 1) * imgScaleSliderW;
      imgScaleValue.setText(`${this._bgImageUserScale.toFixed(2)}x`);
    };

    const setImgScaleFromPointer = (px) => {
      const t = Phaser.Math.Clamp((px - imgScaleSliderX) / imgScaleSliderW, 0, 1);

      this._bgImageUserScale =
        this._bgImageUserScaleMin +
        t * (this._bgImageUserScaleMax - this._bgImageUserScaleMin);

      if (this._bgImage) {
        this._bgImage.setScale(this._bgImageBaseScale * this._bgImageUserScale);
      }

      updateImgScaleKnob();
    };

    imgScaleHit.on('pointerdown', p => setImgScaleFromPointer(p.worldX));
    imgScaleHit.on('pointermove', p => { if (p.isDown) setImgScaleFromPointer(p.worldX); });
    imgScaleKnob.on('pointerdown', p => setImgScaleFromPointer(p.worldX));
    imgScaleKnob.on('pointermove', p => { if (p.isDown) setImgScaleFromPointer(p.worldX); });

    updateImgScaleKnob();

    y += S(52);

    // =================================================
    // Slider ancho pista
    // =================================================
    const sliderY = y;

    this.add.text(sideX + 18, sliderY, isNarrow ? 'ANCHO' : 'ANCHO DE PISTA', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: `${S(12)}px`,
      color: '#ffffff',
      fontStyle: 'bold'
    }).setAlpha(0.9).setDepth(61);

    this._ui.widthValue = this.add.text(sideX + 18, sliderY + S(16), `${this._trackWidth}px`, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: `${S(12)}px`,
      color: '#ffffff'
    }).setAlpha(0.85).setDepth(61);

    const sliderW = btnW;
    const sliderH = S(12);
    const sliderX = btnX;
    const trackY = sliderY + S(38);

    this.add.rectangle(sliderX, trackY, sliderW, sliderH, 0xffffff, 0.18)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setDepth(61);

    const knobR = S(13);
    const knob = this.add.circle(0, trackY + sliderH / 2, knobR, 0xffffff, 0.55)
      .setStrokeStyle(3, 0xffffff, 0.85)
      .setDepth(62)
      .setInteractive({ useHandCursor: true });

    const sHit = this.add.rectangle(sliderX, trackY - S(10), sliderW, sliderH + S(20), 0x000000, 0.0)
      .setOrigin(0)
      .setInteractive()
      .setDepth(63);

    this._ui.widthSlider = { knob, sliderX, sliderW, trackY, sliderH };

            const setWidthFromPointer = (px) => {
      const t = Phaser.Math.Clamp((px - sliderX) / sliderW, 0, 1);
      const v = Math.round(this._trackWidthMin + t * (this._trackWidthMax - this._trackWidthMin));

      if (this._selectedNode >= 0 && this._selectedNode < this._nodes.length) {
        this._nodes[this._selectedNode].width = v;
      } else {
        this._trackWidth = v;

        for (let i = 0; i < this._nodes.length; i++) {
          this._nodes[i].width = v;
        }
      }

      this._ui.widthValue.setText(`${v}px`);
      this._positionWidthKnob();
      this._redraw();
    };

    sHit.on('pointerdown', (p) => setWidthFromPointer(p.worldX));
    sHit.on('pointermove', (p) => { if (p.isDown) setWidthFromPointer(p.worldX); });
    knob.on('pointerdown', (p) => setWidthFromPointer(p.worldX));
    knob.on('pointermove', (p) => { if (p.isDown) setWidthFromPointer(p.worldX); });

    this._positionWidthKnob();

    this._ui.stats = this.add.text(sideX + 18, trackY + sliderH + S(16), 'Nodos: 0', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: `${S(12)}px`,
      color: '#ffffff'
    }).setAlpha(0.85).setDepth(61);

    this._ui.report = this.add.text(
      sideX + 18,
      trackY + sliderH + S(36),
      'Fase 1:\n• toque = crear nodo\n• arrastrar nodo\n• 2 dedos = pan/zoom',
      {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: `${S(11)}px`,
        color: '#ffffff',
        lineSpacing: 2,
        wordWrap: { width: Math.max(120, sideW - 36), useAdvancedWrap: true }
      }
    ).setAlpha(0.9).setDepth(61);

    // =================================================
    // Título general
    // =================================================
    const titleX = this._drawRect.x + this._drawRect.width / 2;

    this.add.text(titleX, isNarrow ? 48 : 54, 'EDITOR DE PISTAS', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: isNarrow ? '22px' : '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(titleX, isNarrow ? 74 : 82, 'Modo Bézier · export final de geometría', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: isNarrow ? '11px' : '12px',
      color: '#e8f0ff'
    }).setOrigin(0.5).setAlpha(0.9);

    // =================================================
    // Layers editor
    // =================================================
    this._gPreview = this.add.graphics().setDepth(10);
    this._gBezier = this.add.graphics().setDepth(11);
    this._gCurbs = this.add.graphics().setDepth(11.12);
    this._gEdges = this.add.graphics().setDepth(11.25);
    this._gFinish = this.add.graphics().setDepth(11.35);
    this._gCenterline = this.add.graphics().setDepth(11.5);
    this._gNodes = this.add.graphics().setDepth(12);

    // Cámara dedicada al editor
    this._editCam = this.cameras.add(drawX, drawY, drawW, drawH);
    this._editCam.setZoom(this._editZoom);
    this._editCam.setScroll(0, 0);
    this._editCam.setRoundPixels(true);

    syncEditorCameras();

    const isPointerInCanvasView = (pointer) => {
      return (
        pointer.x >= drawX &&
        pointer.x <= drawX + drawW &&
        pointer.y >= drawY &&
        pointer.y <= drawY + drawH
      );
    };

    // =================================================
    // Input táctil
    // =================================================
    this.input.addPointer(2);

    this.input.on('pointerdown', (p) => {
      const activeTouches = this.input.manager.pointers.filter(pp => pp.isDown).length;

      if (activeTouches > 1) {
        if (this._pendingTap) {
          this._pendingTap.remove(false);
          this._pendingTap = null;
        }
        this._draggingNode = false;
        this._selectedHandle = null;
        return;
      }

      if (!isPointerInCanvasView(p)) return;

      const wp = this._screenToEditorWorld(p);

      this._pendingTap = this.time.delayedCall(120, () => {
        const hitHandle = this._findHitHandle(wp.x, wp.y, 14);

        if (hitHandle) {
          this._selectedNode = hitHandle.nodeIndex;
          this._selectedHandle = hitHandle.handle;
          this._draggingNode = true;

          this._redraw();
          this._refreshStats();
          return;
        }

        const hitNode = this._findHitNode(wp.x, wp.y, 18);

        if (hitNode >= 0) {
          const now = this.time.now;

          if (this._selectedNode === hitNode && now - this._lastTapTime < 300) {
            this._cycleNodeMode(hitNode);
            this._redraw();
            this._refreshStats();
          } else {
            this._selectedNode = hitNode;
            this._selectedHandle = null;
            this._draggingNode = true;
            this._positionWidthKnob();
          }

          this._lastTapTime = now;
        } else {
          const hitSeg = this._findHitSegmentPoint(wp.x, wp.y, 16, 24);

          if (hitSeg) {
            this._insertNodeOnBezierSegment(hitSeg);
          } else {
            const handleLen = 36;

this._nodes.push({
  x: wp.x,
  y: wp.y,
  inX: wp.x - handleLen,
  inY: wp.y,
  outX: wp.x + handleLen,
  outY: wp.y,
  mode: 'mirrored',
  width: this._trackWidth
});

                        this._selectedNode = this._nodes.length - 1;
            this._selectedHandle = null;
            this._draggingNode = true;
            this._positionWidthKnob();
          }
        }

        this._redraw();
        this._refreshStats();
      });
    });

    this.input.on('pointermove', (p) => {
      const downPointers = this.input.manager.pointers.filter(pp => pp.isDown);

      if (downPointers.length >= 2) {
        if (this._pendingTap) {
          this._pendingTap.remove(false);
          this._pendingTap = null;
        }

        this._draggingNode = false;

        const p1 = downPointers[0];
        const p2 = downPointers[1];

        const midX = (p1.x + p2.x) * 0.5;
        const midY = (p1.y + p2.y) * 0.5;

        const dxp = p2.x - p1.x;
        const dyp = p2.y - p1.y;
        const dist = Math.sqrt(dxp * dxp + dyp * dyp);

        if (this._panLastMid) {
          const dx = midX - this._panLastMid.x;
          const dy = midY - this._panLastMid.y;

          if (this._editCam) {
            this._editCam.scrollX -= dx / this._editCam.zoom;
            this._editCam.scrollY -= dy / this._editCam.zoom;
          }
        }

        if (this._pinchLastDist > 0 && this._editCam) {
          const ratio = dist / this._pinchLastDist;
          const nextZoom = Phaser.Math.Clamp(
            this._editCam.zoom * ratio,
            this._editZoomMin,
            this._editZoomMax
          );

          this._editZoom = nextZoom;
          this._editCam.setZoom(this._editZoom);
        }

        this._panLastMid = { x: midX, y: midY };
        this._pinchLastDist = dist;
        return;
      }

      this._panLastMid = null;
      this._pinchLastDist = 0;

      if (!this._draggingNode) return;
      if (!isPointerInCanvasView(p)) return;
      if (this._selectedNode < 0 || this._selectedNode >= this._nodes.length) return;

      const wp = this._screenToEditorWorld(p);
      const n = this._nodes[this._selectedNode];

      if (this._selectedHandle === 'in') {
        n.inX = wp.x;
        n.inY = wp.y;
        this._syncOppositeHandleByMode(n, 'in');
      } else if (this._selectedHandle === 'out') {
        n.outX = wp.x;
        n.outY = wp.y;
        this._syncOppositeHandleByMode(n, 'out');
      } else {
        const dx = wp.x - n.x;
        const dy = wp.y - n.y;

        n.x = wp.x;
        n.y = wp.y;

        n.inX += dx;
        n.inY += dy;
        n.outX += dx;
        n.outY += dy;
      }

      this._redraw();
      this._refreshStats();
    });

    this.input.on('pointerup', () => {
      this._draggingNode = false;
      this._selectedHandle = null;
      this._panLastMid = null;
      this._pinchLastDist = 0;
    });

    this.input.on('pointerupoutside', () => {
      this._draggingNode = false;
      this._selectedHandle = null;
      this._panLastMid = null;
      this._pinchLastDist = 0;
    });

    this._redraw();
    this._refreshStats();
  }

  _screenToEditorWorld(pointer) {
    if (!this._editCam) {
      return { x: pointer.worldX, y: pointer.worldY };
    }
    return this._editCam.getWorldPoint(pointer.x, pointer.y);
  }

  _findHitNode(x, y, radius = 18) {
    const r2 = radius * radius;
    for (let i = this._nodes.length - 1; i >= 0; i--) {
      const n = this._nodes[i];
      const dx = x - n.x;
      const dy = y - n.y;
      if ((dx * dx + dy * dy) <= r2) return i;
    }
    return -1;
  }

  _findHitHandle(x, y, radius = 14) {
    const r2 = radius * radius;

    for (let i = this._nodes.length - 1; i >= 0; i--) {
      const n = this._nodes[i];

      const inX = n.inX ?? n.x;
      const inY = n.inY ?? n.y;
      const outX = n.outX ?? n.x;
      const outY = n.outY ?? n.y;

      let dx = x - inX;
      let dy = y - inY;
      if ((dx * dx + dy * dy) <= r2) {
        return { nodeIndex: i, handle: 'in' };
      }

      dx = x - outX;
      dy = y - outY;
      if ((dx * dx + dy * dy) <= r2) {
        return { nodeIndex: i, handle: 'out' };
      }
    }

    return null;
  }

  _findHitSegmentPoint(x, y, radius = 16, samplesPerSegment = 24) {
    if (this._nodes.length < 2) return null;

    const r2 = radius * radius;
    let best = null;

    const pointSegDistSq = (px, py, ax, ay, bx, by) => {
      const abx = bx - ax;
      const aby = by - ay;
      const apx = px - ax;
      const apy = py - ay;
      const abLen2 = abx * abx + aby * aby;

      let tLine = 0;
      if (abLen2 > 0.000001) {
        tLine = Phaser.Math.Clamp((apx * abx + apy * aby) / abLen2, 0, 1);
      }

      const qx = ax + abx * tLine;
      const qy = ay + aby * tLine;
      const dx = px - qx;
      const dy = py - qy;

      return {
        distSq: dx * dx + dy * dy,
        qx,
        qy,
        tLine
      };
    };

    const sampleCurve = (a, b) => {
      const curve = new Phaser.Curves.CubicBezier(
        new Phaser.Math.Vector2(a.x, a.y),
        new Phaser.Math.Vector2(a.outX ?? a.x, a.outY ?? a.y),
        new Phaser.Math.Vector2(b.inX ?? b.x, b.inY ?? b.y),
        new Phaser.Math.Vector2(b.x, b.y)
      );
      return curve.getPoints(samplesPerSegment);
    };

    const testBezierSegment = (a, b, aIndex, bIndex, insertIndex) => {
      const pts = sampleCurve(a, b);
      const divisions = Math.max(1, pts.length - 1);

      for (let k = 0; k < pts.length - 1; k++) {
        const p0 = pts[k];
        const p1 = pts[k + 1];

        const hit = pointSegDistSq(x, y, p0.x, p0.y, p1.x, p1.y);
        if (hit.distSq > r2) continue;

        const curveT = Phaser.Math.Clamp((k + hit.tLine) / divisions, 0, 1);

        if (!best || hit.distSq < best.distSq) {
          best = {
            distSq: hit.distSq,
            insertIndex,
            aIndex,
            bIndex,
            curveT
          };
        }
      }
    };

    for (let i = 0; i < this._nodes.length - 1; i++) {
      testBezierSegment(this._nodes[i], this._nodes[i + 1], i, i + 1, i + 1);
    }

    if (this._closed && this._nodes.length > 2) {
      testBezierSegment(
        this._nodes[this._nodes.length - 1],
        this._nodes[0],
        this._nodes.length - 1,
        0,
        this._nodes.length
      );
    }

    return best;
  }

  _insertNodeOnBezierSegment(hitSeg) {
    if (!hitSeg) return;

    const a = this._nodes[hitSeg.aIndex];
    const b = this._nodes[hitSeg.bIndex];
    if (!a || !b) return;

    const t = Phaser.Math.Clamp(hitSeg.curveT ?? 0.5, 0.0001, 0.9999);

    const lerpPoint = (p0, p1, tt) => ({
      x: p0.x + (p1.x - p0.x) * tt,
      y: p0.y + (p1.y - p0.y) * tt
    });

    const p0 = { x: a.x, y: a.y };
    const p1 = { x: a.outX ?? a.x, y: a.outY ?? a.y };
    const p2 = { x: b.inX ?? b.x, y: b.inY ?? b.y };
    const p3 = { x: b.x, y: b.y };

    const q0 = lerpPoint(p0, p1, t);
    const q1 = lerpPoint(p1, p2, t);
    const q2 = lerpPoint(p2, p3, t);

    const r0 = lerpPoint(q0, q1, t);
    const r1 = lerpPoint(q1, q2, t);

    const s = lerpPoint(r0, r1, t);

    a.outX = q0.x;
    a.outY = q0.y;

    b.inX = q2.x;
    b.inY = q2.y;

const newNode = {
  x: s.x,
  y: s.y,
  inX: r0.x,
  inY: r0.y,
  outX: r1.x,
  outY: r1.y,
  mode: 'mirrored',
  width: this._trackWidth
};

    this._nodes.splice(hitSeg.insertIndex, 0, newNode);
    this._selectedNode = hitSeg.insertIndex;
    this._selectedHandle = null;
    this._draggingNode = true;
    this._positionWidthKnob();
  }
  _syncOppositeHandleByMode(n, movedHandle) {
    const mode = n.mode || 'mirrored';
    if (mode === 'free') return;

    const dxIn = (n.inX ?? n.x) - n.x;
    const dyIn = (n.inY ?? n.y) - n.y;
    const dxOut = (n.outX ?? n.x) - n.x;
    const dyOut = (n.outY ?? n.y) - n.y;

    if (movedHandle === 'in') {
      const lenIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn);

      if (lenIn <= 0.0001) {
        if (mode === 'mirrored') {
          n.outX = n.x;
          n.outY = n.y;
        }
        return;
      }

      const ux = dxIn / lenIn;
      const uy = dyIn / lenIn;

      if (mode === 'mirrored') {
        n.outX = n.x - ux * lenIn;
        n.outY = n.y - uy * lenIn;
      } else if (mode === 'aligned') {
        const lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut);
        n.outX = n.x - ux * lenOut;
        n.outY = n.y - uy * lenOut;
      }
    }

    if (movedHandle === 'out') {
      const lenOut = Math.sqrt(dxOut * dxOut + dyOut * dyOut);

      if (lenOut <= 0.0001) {
        if (mode === 'mirrored') {
          n.inX = n.x;
          n.inY = n.y;
        }
        return;
      }

      const ux = dxOut / lenOut;
      const uy = dyOut / lenOut;

      if (mode === 'mirrored') {
        n.inX = n.x - ux * lenOut;
        n.inY = n.y - uy * lenOut;
      } else if (mode === 'aligned') {
        const lenIn = Math.sqrt(dxIn * dxIn + dyIn * dyIn);
        n.inX = n.x - ux * lenIn;
        n.inY = n.y - uy * lenIn;
      }
    }
  }

  _cycleNodeMode(nodeIndex) {
    const n = this._nodes[nodeIndex];
    if (!n) return;

    const mode = n.mode || 'mirrored';

    if (mode === 'mirrored') {
      n.mode = 'aligned';
    } else if (mode === 'aligned') {
      n.mode = 'free';
    } else {
      n.mode = 'mirrored';
    }
  }

  _refreshStats() {
    if (!this._ui?.stats) return;
    this._ui.stats.setText(
      `Nodos: ${this._nodes.length}\nCerrado: ${this._closed ? 'Sí' : 'No'}`
    );
  }

  _positionWidthKnob() {
    if (!this._ui?.widthSlider) return;

    const { knob, sliderX, sliderW, trackY, sliderH } = this._ui.widthSlider;

    let currentWidth = this._trackWidth;

    if (this._selectedNode >= 0 && this._selectedNode < this._nodes.length) {
      currentWidth = this._nodes[this._selectedNode].width ?? this._trackWidth;
    }

    const t = (currentWidth - this._trackWidthMin) / (this._trackWidthMax - this._trackWidthMin);
    const x = Math.floor(sliderX + Phaser.Math.Clamp(t, 0, 1) * sliderW);
    const y = Math.floor(trackY + sliderH / 2);

    knob.setPosition(x, y);

    if (this._ui?.widthValue) {
      this._ui.widthValue.setText(`${Math.round(currentWidth)}px`);
    }
  }
  _setReport(rep) {
    if (!this._ui?.report) return;

    if (rep?.ok) {
      this._ui.report.setText(`✅ OK\n${rep.msg}`);
    } else {
      this._ui.report.setText(`❌ ERRORES\n${(rep?.errors || []).join('\n')}`);
    }
  }

  _validateBezierDraft() {
    const errors = [];

    if (this._nodes.length < 2) errors.push('Mínimo 2 nodos.');
    if (this._closed && this._nodes.length < 3) errors.push('Para cerrar, mínimo 3 nodos.');

    if (errors.length) return { ok: false, errors };

    return {
      ok: true,
      msg: `Nodos: ${this._nodes.length} · ${this._closed ? 'Cerrado' : 'Abierto'}`
    };
  }

  _redraw() {
    this._gPreview.clear();
    this._gBezier.clear();
    this._gCurbs.clear();
    this._gEdges.clear();
    this._gCenterline.clear();
    this._gNodes.clear();

    const previewCenterline = this._generateCenterline(32, 10);

    if (previewCenterline.length >= 2) {
      const strip = this._buildTrackStrip(previewCenterline, this._trackWidth, this._closed);
      const geom = this._generateTrackGeometry(previewCenterline);

      if (strip.quads.length > 0) {
        this._gPreview.fillStyle(0x2f343a, 0.95);

        for (const q of strip.quads) {
          this._gPreview.beginPath();
          this._gPreview.moveTo(q.a.x, q.a.y);
          this._gPreview.lineTo(q.b.x, q.b.y);
          this._gPreview.lineTo(q.c.x, q.c.y);
          this._gPreview.lineTo(q.d.x, q.d.y);
          this._gPreview.closePath();
          this._gPreview.fillPath();
        }

        let accumLen = 0;
        const curbSegmentLen = 14;

        const ti = geom.trackInner;
        const to = geom.trackOuter;
        const ci = geom.curbInner;
        const co = geom.curbOuter;

        for (let i = 0; i < ti.length - 1; i++) {
          const dx = ti[i + 1].x - ti[i].x;
          const dy = ti[i + 1].y - ti[i].y;
          const segLen = Math.sqrt(dx * dx + dy * dy);

          // Detectar si este tramo gira lo suficiente como para merecer piano
          let drawCurb = true;

          if (i > 0 && i < ti.length - 2) {
            const ax = ti[i].x - ti[i - 1].x;
            const ay = ti[i].y - ti[i - 1].y;
            const bx = ti[i + 1].x - ti[i].x;
            const by = ti[i + 1].y - ti[i].y;

            const al = Math.sqrt(ax * ax + ay * ay);
            const bl = Math.sqrt(bx * bx + by * by);

            if (al > 0.0001 && bl > 0.0001) {
              const anx = ax / al;
              const any = ay / al;
              const bnx = bx / bl;
              const bny = by / bl;

              const dot = Phaser.Math.Clamp((anx * bnx) + (any * bny), -1, 1);
              const angle = Math.acos(dot); // radianes

              // Menos de ~10 grados = tramo casi recto = no pintar piano
              drawCurb = angle > 0.17;
            }
          }

          if (drawCurb) {
            const bandIndex = Math.floor(accumLen / curbSegmentLen);
            const isRed = bandIndex % 2 === 0;
            const color = isRed ? 0xff3b3b : 0xffffff;

            this._gCurbs.fillStyle(color, 1);

            // Piano interior
            this._gCurbs.beginPath();
            this._gCurbs.moveTo(ti[i].x, ti[i].y);
            this._gCurbs.lineTo(ti[i + 1].x, ti[i + 1].y);
            this._gCurbs.lineTo(ci[i + 1].x, ci[i + 1].y);
            this._gCurbs.lineTo(ci[i].x, ci[i].y);
            this._gCurbs.closePath();
            this._gCurbs.fillPath();

            // Piano exterior
            this._gCurbs.beginPath();
            this._gCurbs.moveTo(to[i].x, to[i].y);
            this._gCurbs.lineTo(to[i + 1].x, to[i + 1].y);
            this._gCurbs.lineTo(co[i + 1].x, co[i + 1].y);
            this._gCurbs.lineTo(co[i].x, co[i].y);
            this._gCurbs.closePath();
            this._gCurbs.fillPath();
          }

          accumLen += segLen;
        }

        this._gEdges.lineStyle(2, 0xf4f4f4, 0.95);
        this._drawPolyline(this._gEdges, strip.left, this._closed);
        this._drawPolyline(this._gEdges, strip.right, this._closed);
      }

      this._gCenterline.fillStyle(0xff4a4a, 0.95);
      for (const p of previewCenterline) {
        this._gCenterline.fillCircle(p.x, p.y, 2.5);
      }
    }

    if (this._nodes.length >= 2) {
      this._gBezier.lineStyle(3, 0xffffff, 0.9);
      this._gBezier.beginPath();

      const first = this._nodes[0];
      this._gBezier.moveTo(first.x, first.y);

      const sampleCurve = (a, b, steps = 28) => {
        const curve = new Phaser.Curves.CubicBezier(
          new Phaser.Math.Vector2(a.x, a.y),
          new Phaser.Math.Vector2(a.outX ?? a.x, a.outY ?? a.y),
          new Phaser.Math.Vector2(b.inX ?? b.x, b.inY ?? b.y),
          new Phaser.Math.Vector2(b.x, b.y)
        );
        return curve.getPoints(steps);
      };

      for (let i = 0; i < this._nodes.length - 1; i++) {
        const a = this._nodes[i];
        const b = this._nodes[i + 1];
        const pts = sampleCurve(a, b, 28);

        for (let k = 1; k < pts.length; k++) {
          this._gBezier.lineTo(pts[k].x, pts[k].y);
        }
      }

      if (this._closed && this._nodes.length > 2) {
        const a = this._nodes[this._nodes.length - 1];
        const b = this._nodes[0];
        const pts = sampleCurve(a, b, 28);

        for (let k = 1; k < pts.length; k++) {
          this._gBezier.lineTo(pts[k].x, pts[k].y);
        }
      }

      this._gBezier.strokePath();
    }

    for (let i = 0; i < this._nodes.length; i++) {
      const n = this._nodes[i];
      const selected = i === this._selectedNode;

      const inX = n.inX ?? n.x;
      const inY = n.inY ?? n.y;
      const outX = n.outX ?? n.x;
      const outY = n.outY ?? n.y;

      this._gNodes.lineStyle(2, 0xffffff, selected ? 0.45 : 0.22);
      this._gNodes.beginPath();
      this._gNodes.moveTo(n.x, n.y);
      this._gNodes.lineTo(inX, inY);
      this._gNodes.moveTo(n.x, n.y);
      this._gNodes.lineTo(outX, outY);
      this._gNodes.strokePath();

      this._gNodes.fillStyle(0x7fdcff, selected ? 0.95 : 0.65);
      this._gNodes.fillCircle(inX, inY, 4);
      this._gNodes.fillCircle(outX, outY, 4);

      this._gNodes.lineStyle(1.5, 0x0b1020, 0.75);
      this._gNodes.strokeCircle(inX, inY, 4);
      this._gNodes.strokeCircle(outX, outY, 4);

      this._gNodes.fillStyle(selected ? 0x3dff7a : 0xffffff, 0.95);
      this._gNodes.fillCircle(n.x, n.y, selected ? 8 : 6);

      this._gNodes.lineStyle(2, 0x0b1020, 0.8);
      this._gNodes.strokeCircle(n.x, n.y, selected ? 8 : 6);
    }

    if (this._closed && this._nodes.length >= 3) {
      const a = this._nodes[0];
      this._gNodes.lineStyle(2, 0x3dff7a, 0.8);
      this._gNodes.strokeCircle(a.x, a.y, 14);
    }
  }

  _resamplePolyline(points, spacing = 24, closed = false) {
    if (!Array.isArray(points) || points.length === 0) return [];

    if (points.length === 1) {
      return [{
        x: Math.round(points[0].x * 10) / 10,
        y: Math.round(points[0].y * 10) / 10,
        width: Math.round((points[0].width ?? this._trackWidth) * 10) / 10
      }];
    }

    const dist = (a, b) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const lerpPoint = (a, b, t) => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      width: (a.width ?? this._trackWidth) + ((b.width ?? this._trackWidth) - (a.width ?? this._trackWidth)) * t
    });

    const source = points.map(p => ({
      x: p.x,
      y: p.y,
      width: p.width ?? this._trackWidth
    }));

    if (closed) {
      const first = source[0];
      const last = source[source.length - 1];
      const dx = first.x - last.x;
      const dy = first.y - last.y;
      const samePoint = (dx * dx + dy * dy) < 0.0001;

      if (!samePoint) {
        source.push({
          x: first.x,
          y: first.y,
          width: first.width
        });
      }
    }

    const out = [];
    let prev = {
      x: source[0].x,
      y: source[0].y,
      width: source[0].width
    };

    out.push({
      x: prev.x,
      y: prev.y,
      width: prev.width
    });

    let carry = 0;

    for (let i = 1; i < source.length; i++) {
      let segStart = {
        x: prev.x,
        y: prev.y,
        width: prev.width
      };

      const segEnd = source[i];
      let segLen = dist(segStart, segEnd);

      if (segLen <= 0.000001) {
        prev = segEnd;
        continue;
      }

      while (carry + segLen >= spacing) {
        const need = spacing - carry;
        const t = need / segLen;
        const p = lerpPoint(segStart, segEnd, t);

        out.push({
          x: p.x,
          y: p.y,
          width: p.width
        });

        segStart = p;
        segLen = dist(segStart, segEnd);
        carry = 0;
      }

      carry += segLen;
      prev = segEnd;
    }

    if (!closed) {
      const lastSrc = source[source.length - 1];
      const lastOut = out[out.length - 1];
      const dx = lastSrc.x - lastOut.x;
      const dy = lastSrc.y - lastOut.y;

      if ((dx * dx + dy * dy) > 0.0001) {
        out.push({
          x: lastSrc.x,
          y: lastSrc.y,
          width: lastSrc.width
        });
      }
    } else if (out.length > 1) {
      const first = out[0];
      const last = out[out.length - 1];
      const dx = first.x - last.x;
      const dy = first.y - last.y;

      if ((dx * dx + dy * dy) < 0.0001) {
        out.pop();
      }
    }

    return out.map(p => ({
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      width: Math.round((p.width ?? this._trackWidth) * 10) / 10
    }));
  }
_generateCenterline(samplesPerSegment = 20, spacing = 24){
    const rawPoints = [];

    if (!Array.isArray(this._nodes) || this._nodes.length < 2) {
      return rawPoints;
    }

    const sampleCurve = (a, b) => {
      const curve = new Phaser.Curves.CubicBezier(
        new Phaser.Math.Vector2(a.x, a.y),
        new Phaser.Math.Vector2(a.outX ?? a.x, a.outY ?? a.y),
        new Phaser.Math.Vector2(b.inX ?? b.x, b.inY ?? b.y),
        new Phaser.Math.Vector2(b.x, b.y)
      );

      return curve.getPoints(samplesPerSegment);
    };

    const pushSampledSegment = (a, b) => {
      const pts = sampleCurve(a, b);
      const aWidth = Number.isFinite(a.width) ? a.width : this._trackWidth;
      const bWidth = Number.isFinite(b.width) ? b.width : this._trackWidth;
      const lastIndex = Math.max(1, pts.length - 1);

      for (let k = 0; k < pts.length; k++) {
        const p = pts[k];
        const t = k / lastIndex;
        const width = Phaser.Math.Linear(aWidth, bWidth, t);

        if (rawPoints.length > 0) {
          const last = rawPoints[rawPoints.length - 1];
          const dx = p.x - last.x;
          const dy = p.y - last.y;
          if ((dx * dx + dy * dy) < 0.0001) continue;
        }

        rawPoints.push({
          x: p.x,
          y: p.y,
          width
        });
      }
    };

    for (let i = 0; i < this._nodes.length - 1; i++) {
      pushSampledSegment(this._nodes[i], this._nodes[i + 1]);
    }

    if (this._closed && this._nodes.length > 2) {
      pushSampledSegment(this._nodes[this._nodes.length - 1], this._nodes[0]);
    }

    return this._resamplePolyline(rawPoints, spacing, this._closed);
  }
  _buildTrackStrip(points, width, closed = false) {
    if (!Array.isArray(points) || points.length < 2) {
      return { left: [], right: [], quads: [] };
    }

    const count = points.length;

    const get = (i) => {
      if (closed) return points[(i + count) % count];
      return points[Math.max(0, Math.min(count - 1, i))];
    };

    const left = [];
    const right = [];

    for (let i = 0; i < count; i++) {
      const pPrev = get(i - 1);
      const pCurr = get(i);
      const pNext = get(i + 1);

      let tx = pNext.x - pPrev.x;
      let ty = pNext.y - pPrev.y;

      const tl = Math.sqrt(tx * tx + ty * ty);
      if (tl <= 0.000001) {
        tx = 1;
        ty = 0;
      } else {
        tx /= tl;
        ty /= tl;
      }

      const nx = -ty;
      const ny = tx;

      const localWidth = Number.isFinite(pCurr.width) ? pCurr.width : width;
      const half = localWidth * 0.5;

      left.push({
        x: Math.round((pCurr.x - nx * half) * 10) / 10,
        y: Math.round((pCurr.y - ny * half) * 10) / 10
      });

      right.push({
        x: Math.round((pCurr.x + nx * half) * 10) / 10,
        y: Math.round((pCurr.y + ny * half) * 10) / 10
      });
    }

    const quads = [];
    const segCount = closed ? count : count - 1;

    for (let i = 0; i < segCount; i++) {
      const i0 = i;
      const i1 = (i + 1) % count;

      quads.push({
        a: left[i0],
        b: right[i0],
        c: right[i1],
        d: left[i1]
      });
    }

    return { left, right, quads };
  }
  _computeSegmentNormal(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len <= 0.000001) return { x: 0, y: 0 };
    return { x: -dy / len, y: dx / len };
  }

  _lineIntersection(p1, p2, p3, p4) {
    const x1 = p1.x; const y1 = p1.y;
    const x2 = p2.x; const y2 = p2.y;
    const x3 = p3.x; const y3 = p3.y;
    const x4 = p4.x; const y4 = p4.y;

    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 0.000001) return null;

    const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den;
    const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den;

    return { x: px, y: py };
  }

  _buildOffsetEdge(points, offset = 0, closed = false, joinLimit = 3) {
    if (!Array.isArray(points) || points.length < 2) return [];

    const out = [];
    const count = points.length;

    const get = (i) => {
      if (closed) return points[(i + count) % count];
      return points[Math.max(0, Math.min(count - 1, i))];
    };

    for (let i = 0; i < count; i++) {
      const p = points[i];

      const pPrev = get(i - 1);
      const pCurr = get(i);
      const pNext = get(i + 1);

      if (!closed && i === 0) {
        const n = this._computeSegmentNormal(pCurr, pNext);
        out.push({ x: pCurr.x + n.x * offset, y: pCurr.y + n.y * offset });
        continue;
      }

      if (!closed && i === count - 1) {
        const n = this._computeSegmentNormal(pPrev, pCurr);
        out.push({ x: pCurr.x + n.x * offset, y: pCurr.y + n.y * offset });
        continue;
      }

      const n0 = this._computeSegmentNormal(pPrev, pCurr);
      const n1 = this._computeSegmentNormal(pCurr, pNext);

      const a1 = { x: pPrev.x + n0.x * offset, y: pPrev.y + n0.y * offset };
      const a2 = { x: pCurr.x + n0.x * offset, y: pCurr.y + n0.y * offset };
      const b1 = { x: pCurr.x + n1.x * offset, y: pCurr.y + n1.y * offset };
      const b2 = { x: pNext.x + n1.x * offset, y: pNext.y + n1.y * offset };

      let join = this._lineIntersection(a1, a2, b1, b2);

      const fallback = () => {
        const p0 = { x: pCurr.x + n0.x * offset, y: pCurr.y + n0.y * offset };
        const p1 = { x: pCurr.x + n1.x * offset, y: pCurr.y + n1.y * offset };

        return {
          x: (p0.x + p1.x) * 0.5,
          y: (p0.y + p1.y) * 0.5
        };
      };
      if (!join) {
        join = fallback();
      } else {
        const dx = join.x - p.x;
        const dy = join.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxJoin = Math.max(6, Math.abs(offset) * 1.6);
        if (!Number.isFinite(dist) || dist > maxJoin) {
          join = fallback();
        }
      }

      out.push({
        x: Math.round(join.x * 10) / 10,
        y: Math.round(join.y * 10) / 10
      });
    }

    return out;
  }

  _generateTrackGeometry(centerline) {
    const cl = Array.isArray(centerline) ? centerline : [];
    if (cl.length < 2) {
      return {
        centerline: [],
        trackInner: [],
        trackOuter: [],
        curbInner: [],
        curbOuter: [],
        runoffInner: [],
        runoffOuter: []
      };
    }

    const curbWidth = 8;
    const runoffWidth = 24;

    const withExtraWidth = (points, extraPerSide = 0) => {
      return points.map(p => ({
        x: p.x,
        y: p.y,
        width: (p.width ?? this._trackWidth) + (extraPerSide * 2)
      }));
    };

    const trackCL = withExtraWidth(cl, 0);
    const curbCL = withExtraWidth(cl, curbWidth);
    const runoffCL = withExtraWidth(cl, curbWidth + runoffWidth);

    const trackStrip = this._buildTrackStrip(trackCL, this._trackWidth, this._closed);
    const curbStrip = this._buildTrackStrip(curbCL, this._trackWidth, this._closed);
    const runoffStrip = this._buildTrackStrip(runoffCL, this._trackWidth, this._closed);

    return {
      centerline: cl.map(p => ({
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        width: Math.round((p.width ?? this._trackWidth) * 10) / 10
      })),
      trackInner: trackStrip.right,
      trackOuter: trackStrip.left,
      curbInner: curbStrip.right,
      curbOuter: curbStrip.left,
      runoffInner: runoffStrip.right,
      runoffOuter: runoffStrip.left
    };
  }
  _drawPolyline(g, points, closed = false) {
    if (!g || !Array.isArray(points) || points.length < 2) return;

    g.beginPath();
    g.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }

    if (closed) {
      g.lineTo(points[0].x, points[0].y);
    }

    g.strokePath();
  }

  _exportBezierDraft() {
    const centerline = this._generateCenterline(32, 10);
    const geom = this._generateTrackGeometry(centerline);

    const avgTrackWidth = Math.round((
      this._nodes.reduce((acc, n) => acc + (n.width ?? this._trackWidth), 0) /
      Math.max(1, this._nodes.length)
    ) * 10) / 10;

    const data = {
      type: 'track-editor-bezier-draft',
      version: 3,
      closed: this._closed,
      trackWidth: avgTrackWidth,

      nodes: this._nodes.map(n => ({
        x: Math.round(n.x * 10) / 10,
        y: Math.round(n.y * 10) / 10,
        inX: Math.round((n.inX ?? n.x) * 10) / 10,
        inY: Math.round((n.inY ?? n.y) * 10) / 10,
        outX: Math.round((n.outX ?? n.x) * 10) / 10,
        outY: Math.round((n.outY ?? n.y) * 10) / 10,
        mode: n.mode || 'mirrored',
        width: Math.round((n.width ?? this._trackWidth) * 10) / 10
      })),

      geometry: {
        centerline: geom.centerline,
        trackInner: geom.trackInner,
        trackOuter: geom.trackOuter,
        curbInner: geom.curbInner,
        curbOuter: geom.curbOuter,
        runoffInner: geom.runoffInner,
        runoffOuter: geom.runoffOuter
      },

      curbs: {
        enabled: true,
        width: 8,
        sides: { inner: true, outer: true },
        style: 'red-white'
      },

      runoff: {
        enabled: true,
        width: 24,
        sides: { inner: true, outer: true },
        surface: 'asphalt'
      }
    };

    // =========================
    // EXPORT listo para el juego
    // =========================
    const allPts = [
      ...(geom.runoffInner || []),
      ...(geom.runoffOuter || []),
      ...(geom.trackInner || []),
      ...(geom.trackOuter || []),
      ...(geom.centerline || [])
    ].filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of allPts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    const pad = 300;

    if (!Number.isFinite(minX)) minX = 0;
    if (!Number.isFinite(minY)) minY = 0;
    if (!Number.isFinite(maxX)) maxX = 1000;
    if (!Number.isFinite(maxY)) maxY = 1000;

    const offsetX = pad - minX;
    const offsetY = pad - minY;

    const shiftedCenterline = (geom.centerline || []).map(p => ({
      x: Math.round((p.x + offsetX) * 10) / 10,
      y: Math.round((p.y + offsetY) * 10) / 10,
      width: Math.round(((p.width ?? avgTrackWidth)) * 10) / 10
    }));

    const first = shiftedCenterline[0] || { x: pad, y: pad, width: avgTrackWidth };
    const second = shiftedCenterline[1] || first;

    const startAngle = Math.atan2(second.y - first.y, second.x - first.x);

    const gameData = {
  name: `Imported Track ${Date.now()}`,

  worldW: Math.max(2000, Math.ceil((maxX - minX) + pad * 2)),
  worldH: Math.max(2000, Math.ceil((maxY - minY) + pad * 2)),

  trackWidth: avgTrackWidth,
  grassMargin: 120,
  sampleStepPx: 12,
  cellSize: 400,
  shoulderPx: 10,

  start: {
    x: Math.round(first.x * 10) / 10,
    y: Math.round(first.y * 10) / 10,
    r: Math.round(startAngle * 1000) / 1000
  },

  centerline: shiftedCenterline,

  geometry: {
    trackInner: geom.trackInner.map(p => ({
      x: Math.round((p.x + offsetX) * 10) / 10,
      y: Math.round((p.y + offsetY) * 10) / 10
    })),

    trackOuter: geom.trackOuter.map(p => ({
      x: Math.round((p.x + offsetX) * 10) / 10,
      y: Math.round((p.y + offsetY) * 10) / 10
    })),

    curbInner: geom.curbInner.map(p => ({
      x: Math.round((p.x + offsetX) * 10) / 10,
      y: Math.round((p.y + offsetY) * 10) / 10
    })),

    curbOuter: geom.curbOuter.map(p => ({
      x: Math.round((p.x + offsetX) * 10) / 10,
      y: Math.round((p.y + offsetY) * 10) / 10
    })),

    runoffInner: geom.runoffInner.map(p => ({
      x: Math.round((p.x + offsetX) * 10) / 10,
      y: Math.round((p.y + offsetY) * 10) / 10
    })),

    runoffOuter: geom.runoffOuter.map(p => ({
      x: Math.round((p.x + offsetX) * 10) / 10,
      y: Math.round((p.y + offsetY) * 10) / 10
    }))
  }
};
    const stamp = Date.now();

    this._downloadJson(`bezier_draft_${stamp}.json`, data);
    this._downloadJson(`track_${stamp}.json`, gameData);

    this._ui.report?.setText('✅ Exportados draft + JSON jugable');
  }

  _downloadJson(filename, data) {
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 500);

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json).catch(() => {});
      }
    } catch (e) {
      console.error(e);
      this._ui.report?.setText('❌ Error exportando JSON');
    }
  }
}
