import Phaser from 'phaser';
import { BaseScene } from './BaseScene.js';

export class TrackEditorScene extends BaseScene {
  constructor() {
    super({ key: 'TrackEditorScene' });

    this._ui = {};

    this._drawRect = null;
    this._uiTopH = 110;

    this._trackWidth = 160;
    this._trackWidthMin = 80;
    this._trackWidthMax = 260;

    // Editor Bézier / nodos (fase 1)
    this._nodes = [];               // [{ x, y }]
    this._closed = false;
    this._selectedNode = -1;
    this._draggingNode = false;

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

    // Gráficos editor
    this._gBezier = null;
    this._gNodes = null;
    this._gPreview = null;
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

    const canvasLabel = this.add.text(drawX + 14, drawY + 10, 'EDITOR BÉZIER · FASE 1', {
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
        this._gPreview
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

          img.setScale(scale);
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
      this._trackWidth = v;
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

    this.add.text(titleX, isNarrow ? 74 : 82, 'Modo Bézier · Fase 1 (anchors)', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: isNarrow ? '11px' : '12px',
      color: '#e8f0ff'
    }).setOrigin(0.5).setAlpha(0.9);

    // =================================================
    // Layers editor
    // =================================================
    this._gPreview = this.add.graphics().setDepth(10);
    this._gBezier = this.add.graphics().setDepth(11);
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
        this._draggingNode = false;
        return;
      }

      if (!isPointerInCanvasView(p)) {
        this._draggingNode = false;
        return;
      }

      const wp = this._screenToEditorWorld(p);
      const hitNode = this._findHitNode(wp.x, wp.y, 18);

      if (hitNode >= 0) {
        this._selectedNode = hitNode;
        this._draggingNode = true;
      } else {
        const handleLen = 36;

        this._nodes.push({
          x: wp.x,
          y: wp.y,
          inX: wp.x - handleLen,
          inY: wp.y,
          outX: wp.x + handleLen,
          outY: wp.y,
          mode: 'mirrored'
        });

        this._selectedNode = this._nodes.length - 1;
        this._draggingNode = true;
      }

      this._redraw();
      this._refreshStats();
    });

    this.input.on('pointermove', (p) => {
      const downPointers = this.input.manager.pointers.filter(pp => pp.isDown);

      // Pan + pinch zoom con 2 dedos
      if (downPointers.length >= 2) {
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
      this._nodes[this._selectedNode].x = wp.x;
      this._nodes[this._selectedNode].y = wp.y;

      this._redraw();
      this._refreshStats();
    });

    this.input.on('pointerup', () => {
      this._draggingNode = false;
      this._panLastMid = null;
      this._pinchLastDist = 0;
    });

    this.input.on('pointerupoutside', () => {
      this._draggingNode = false;
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

  _refreshStats() {
    if (!this._ui?.stats) return;
    this._ui.stats.setText(
      `Nodos: ${this._nodes.length}\nCerrado: ${this._closed ? 'Sí' : 'No'}`
    );
  }

  _positionWidthKnob() {
    if (!this._ui?.widthSlider) return;
    const { knob, sliderX, sliderW, trackY, sliderH } = this._ui.widthSlider;

    const t = (this._trackWidth - this._trackWidthMin) / (this._trackWidthMax - this._trackWidthMin);
    const x = Math.floor(sliderX + Phaser.Math.Clamp(t, 0, 1) * sliderW);
    const y = Math.floor(trackY + sliderH / 2);

    knob.setPosition(x, y);
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
    this._gNodes.clear();

    if (this._nodes.length >= 2) {
      // Preview ancho pista
      const previewPx = Math.max(6, Math.min(40, Math.round(this._trackWidth / 6)));
      this._gPreview.lineStyle(previewPx, 0xfff000, 0.18);
      this._gPreview.beginPath();
      this._gPreview.moveTo(this._nodes[0].x, this._nodes[0].y);
      for (let i = 1; i < this._nodes.length; i++) {
        this._gPreview.lineTo(this._nodes[i].x, this._nodes[i].y);
      }
      if (this._closed) {
        this._gPreview.lineTo(this._nodes[0].x, this._nodes[0].y);
      }
      this._gPreview.strokePath();

      // Línea guía fina
      this._gBezier.lineStyle(3, 0xffffff, 0.9);
      this._gBezier.beginPath();
      this._gBezier.moveTo(this._nodes[0].x, this._nodes[0].y);
      for (let i = 1; i < this._nodes.length; i++) {
        this._gBezier.lineTo(this._nodes[i].x, this._nodes[i].y);
      }
      if (this._closed) {
        this._gBezier.lineTo(this._nodes[0].x, this._nodes[0].y);
      }
      this._gBezier.strokePath();
    }

    // Nodos
        for (let i = 0; i < this._nodes.length; i++) {
      const n = this._nodes[i];
      const selected = i === this._selectedNode;

      const inX = n.inX ?? n.x;
      const inY = n.inY ?? n.y;
      const outX = n.outX ?? n.x;
      const outY = n.outY ?? n.y;

      // líneas de tangente
      this._gNodes.lineStyle(2, 0xffffff, selected ? 0.45 : 0.22);
      this._gNodes.beginPath();
      this._gNodes.moveTo(n.x, n.y);
      this._gNodes.lineTo(inX, inY);
      this._gNodes.moveTo(n.x, n.y);
      this._gNodes.lineTo(outX, outY);
      this._gNodes.strokePath();

      // handles
      this._gNodes.fillStyle(0x7fdcff, selected ? 0.95 : 0.65);
      this._gNodes.fillCircle(inX, inY, 4);
      this._gNodes.fillCircle(outX, outY, 4);

      this._gNodes.lineStyle(1.5, 0x0b1020, 0.75);
      this._gNodes.strokeCircle(inX, inY, 4);
      this._gNodes.strokeCircle(outX, outY, 4);

      // anchor
      this._gNodes.fillStyle(selected ? 0x3dff7a : 0xffffff, 0.95);
      this._gNodes.fillCircle(n.x, n.y, selected ? 8 : 6);

      this._gNodes.lineStyle(2, 0x0b1020, 0.8);
      this._gNodes.strokeCircle(n.x, n.y, selected ? 8 : 6);
    }

    // Marca de cierre visual
    if (this._closed && this._nodes.length >= 3) {
      const a = this._nodes[0];
      this._gNodes.lineStyle(2, 0x3dff7a, 0.8);
      this._gNodes.strokeCircle(a.x, a.y, 14);
    }
  }

  _exportBezierDraft() {
    const data = {
      type: 'track-editor-bezier-draft',
      version: 1,
      closed: this._closed,
      trackWidth: this._trackWidth,
            nodes: this._nodes.map(n => ({
        x: Math.round(n.x * 10) / 10,
        y: Math.round(n.y * 10) / 10,
        inX: Math.round((n.inX ?? n.x) * 10) / 10,
        inY: Math.round((n.inY ?? n.y) * 10) / 10,
        outX: Math.round((n.outX ?? n.x) * 10) / 10,
        outY: Math.round((n.outY ?? n.y) * 10) / 10,
        mode: n.mode || 'mirrored'
      }))
    };

    this._downloadJson(`bezier_draft_${Date.now()}.json`, data);
    this._ui.report?.setText('✅ Draft Bézier exportado');
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
