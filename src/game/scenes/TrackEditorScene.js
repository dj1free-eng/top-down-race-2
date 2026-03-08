import Phaser from 'phaser';
import { BaseScene } from './BaseScene.js';

export class TrackEditorScene extends BaseScene {
  constructor() {
    super({ key: 'TrackEditorScene' });

    // Estado (Fase 1)
    this._isDrawing = false;
    this._drawMode = true;   // herramienta “Dibujar” activa (toggle)
    this._ui = {};           // refs UI (botones/textos)

    this._rawPoints = [];    // [{x,y}, ...]
    this._cleanPoints = [];  // por ahora copia (Fase 2: filtrado/smooth)

    this._gRaw = null;
    this._gClean = null;
    this._gOverlay = null;   // ✅ overlay validación
    this._resampleStep = 12;   // px entre puntos “limpios”
    this._smoothSubdiv = 6;    // subdivisiones por tramo (Catmull)
    this._minSampleDist = 10; // px
    this._drawRect = null;    // Phaser.Geom.Rectangle
    this._uiTopH = 110;       // header compacto

    this._trackWidth = 160;
    this._trackWidthMin = 80;
    this._trackWidthMax = 260;
     // Cámara de edición (zoom/pan sobre el lienzo)
    this._editCam = null;
    this._editZoom = 1;
    this._editZoomMin = 0.6;
    this._editZoomMax = 3.5;
    this._editPanning = false;
    this._editPinching = false;
    this._pinchStartDist = 0;
    this._pinchStartZoom = 1;
    this._panLastMid = null;
    this._ui.widthSlider = null;
    this._ui.widthValue = null;
    this._ui.validateBtn = null;
    this._ui.report = null;

    // ✅ último reporte de validación (para overlay)
    this._lastValidation = null;
  }

  create() {
    super.create();
    const { width, height } = this.scale;

    // Fondo
    this.cameras.main.setBackgroundColor('#1b6bff');

    // --- Responsive flags (DECLARAR ARRIBA DEL TODO) ---
    const isNarrow = width < 520;
    const uiScale = isNarrow ? 0.70 : 1.0;
    const S = (n) => Math.floor(n * uiScale);

    // --- Flecha atrás (arriba izquierda) ---
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
    // --- Layout pro (Canvas 3:2 + Sidebar) ---
    const pad = isNarrow ? 12 : 16;
    const gap = isNarrow ? 10 : 14;
    const round = isNarrow ? 16 : 18;

    // Sidebar fijo a la derecha (en iPhone lo hacemos un pelín más estrecho)
    const sideW = Math.floor(Math.max(isNarrow ? 200 : 220, Math.min(isNarrow ? 280 : 320, width * (isNarrow ? 0.30 : 0.28))));
    const sideX = Math.floor(width - pad - sideW);
    const sideY = pad; // ✅ sidebar usa todo el alto disponible
    const sideH = Math.floor(height - sideY - pad);

    // Canvas disponible (a la izquierda del sidebar)
    const canvasX = pad;
    const canvasY = this._uiTopH;
    const canvasMaxW = Math.floor(sideX - gap - canvasX);
    const canvasMaxH = Math.floor(height - canvasY - pad);

    // Forzar ratio 3:2
    let drawW = canvasMaxW;
    let drawH = Math.floor(drawW / 1.5);
    if (drawH > canvasMaxH) {
      drawH = canvasMaxH;
      drawW = Math.floor(drawH * 1.5);
    }

    // Centrar canvas
    const drawX = Math.floor(canvasX + (canvasMaxW - drawW) / 2);
    const drawY = Math.floor(canvasY + (canvasMaxH - drawH) / 2);

    this._drawRect = new Phaser.Geom.Rectangle(drawX, drawY, drawW, drawH);
    // Cámara dedicada al editor (de momento solo la creamos)
    this._editCam = this.cameras.add(0, 0, width, height);
    this._editCam.setZoom(this._editZoom || 1);
    this._editCam.setScroll(0, 0);
    this._editCam.setRoundPixels(true);
// La cámara principal NO debe renderizar el mundo del editor

    // Panel visual del “lienzo”
    const canvasPanel = this.add.graphics().setDepth(5);
    canvasPanel.fillStyle(0xffffff, 0.14);
    canvasPanel.fillRoundedRect(drawX, drawY, drawW, drawH, round);
    canvasPanel.lineStyle(isNarrow ? 2 : 3, 0xffffff, 0.55);
    canvasPanel.strokeRoundedRect(drawX, drawY, drawW, drawH, round);

    this.add.text(drawX + 14, drawY + 10, 'ZONA DE DIBUJO (3:2)', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: isNarrow ? '11px' : '12px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setAlpha(0.85).setDepth(6);

    // Sidebar visual
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

    // --- UI Sidebar (2 columnas compactas) ---
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

    // --- Imagen de fondo para calcar circuitos ---
    this._bgImage = null;
    this._bgImageKey = null;

    const trackFileInput = document.createElement('input');
trackFileInput.type = 'file';
trackFileInput.accept = 'image/*';
trackFileInput.style.display = 'none';
document.body.appendChild(trackFileInput);

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
            this._drawRect.x + this._drawRect.width / 2,
            this._drawRect.y + this._drawRect.height / 2,
            key
          ).setDepth(7);

          const scale = Math.min(
            this._drawRect.width / Math.max(1, htmlImg.width),
            this._drawRect.height / Math.max(1, htmlImg.height)
          );

          img.setScale(scale);
          img.setAlpha(0.42);

          this._bgImage = img;
        };

        htmlImg.onerror = () => {
          if (this._ui?.report) {
            this._ui.report.setText('❌ ERRORES\n• No se pudo cargar la imagen.');
          }
        };

        htmlImg.src = dataUrl;
      };

      reader.readAsDataURL(file);
trackFileInput.value = '';
    });

    // fila 1
    this._ui.drawBtn = makeSideBtn(col1, y, btnW2, btnH2, 'DIBUJAR', () => {
      this._drawMode = !this._drawMode;
      this._ui.drawBtn.t.setText(this._drawMode ? 'DIBUJAR' : 'PAUSADO');
      this._ui.drawBtn.r.setAlpha(this._drawMode ? 1 : 0.6);
      this._ui.drawBtn.t.setAlpha(this._drawMode ? 1 : 0.75);
      if (!this._drawMode) this._isDrawing = false;
    });

    this._ui.undoBtn = makeSideBtn(col2, y, btnW2, btnH2, 'BORRAR', () => {
      if (this._rawPoints.length > 0) {
        this._rawPoints.pop();
        this._rebuildClean();
        this._lastValidation = null;
        this._redraw();
      }
      this._refreshStats();
    });

    y += btnH2 + colGap;

    // fila 2
    this._ui.clearBtn = makeSideBtn(col1, y, btnW2, btnH2, 'LIMPIAR', () => {
      this._isDrawing = false;
      this._rawPoints.length = 0;
      this._cleanPoints.length = 0;
      this._lastValidation = null;
      this._redraw();
      this._refreshStats();
      if (this._ui.report) this._ui.report.setText('Sin validar');
      if (this._ui.validateBtn?.r) {
        this._ui.validateBtn.r.setFillStyle(0xffffff, 0.18);
        this._ui.validateBtn.r.setStrokeStyle(2, 0xffffff, 0.45);
      }
      if (this._ui.exportBtn?.r) {
        this._ui.exportBtn.r.setAlpha(0.55);
        this._ui.exportBtn.t.setAlpha(0.65);
        this._ui.exportBtn.r.disableInteractive();
      }
    });

    this._ui.validateBtn = makeSideBtn(col2, y, btnW2, btnH2, 'VALIDAR', () => {
      const rep = this._validateTrack();
      this._lastValidation = rep;
      this._setReport(rep);
      this._redraw();
    });

    y += btnH2 + colGap;

    // fila 3
    this._ui.exportBtn = makeSideBtn(col1, y, btnW2, btnH2, 'EXPORTAR', () => {
  this._exportTrack();
});
this._ui.exportBtn.r.setAlpha(0.55);
this._ui.exportBtn.t.setAlpha(0.65);
this._ui.exportBtn.r.disableInteractive();

this._ui.loadImgBtn = makeSideBtn(col2, y, btnW2, btnH2, 'CARGAR IMG', () => {
  trackFileInput.click();
});

y += btnH2 + colGap;

// fila nueva
this._ui.toggleImgBtn = makeSideBtn(col1, y, btnW2, btnH2, 'OCULTAR IMG', () => {
  if (!this._bgImage) return;

  const visible = this._bgImage.visible;
  this._bgImage.setVisible(!visible);

  this._ui.toggleImgBtn.t.setText(visible ? 'MOSTRAR IMG' : 'OCULTAR IMG');
});

this._ui.clearImgBtn = makeSideBtn(col2, y, btnW2, btnH2, 'BORRAR IMG', () => {
  if (!this._bgImage) return;

  this._bgImage.destroy();
  this._bgImage = null;

  this._ui.toggleImgBtn.t.setText('OCULTAR IMG');
});
y += btnH2 + colGap;

this._ui.autoTraceBtn = makeSideBtn(col1, y, btnW2, btnH2, 'AUTO TRACE', () => {
  const res = this._buildTrackMaskFromBg();
  if (!res) {
    if (this._ui?.report) {
      this._ui.report.setText('❌ ERRORES\n• No hay imagen cargada.');
    }
    return;
  }

  const cleaned = this._cleanTrackMask(res);
  this._lastMaskResult = cleaned;
  this._drawMaskPreview(cleaned);

  if (this._ui?.report) {
    this._ui.report.setText('✅ OK\nMáscara limpiada.\nLista para centerline.');
  }
});
this._ui.clearMaskBtn = makeSideBtn(col2, y, btnW2, btnH2, 'BORRAR MASK', () => {
  if (this._gMask) this._gMask.clear();
});
    y += btnH2 + S(14);

    y += btnH2 + colGap;

this._ui.genTrackBtn = makeSideBtn(col1, y, btnW2, btnH2, 'GENERAR PISTA', () => {
  if (!this._lastMaskResult) {
    if (this._ui?.report) {
      this._ui.report.setText('❌ Ejecuta AUTO TRACE primero.');
    }
    return;
  }

  const pts = this._extractCenterline(this._lastMaskResult);
  if (!pts || pts.length < 8) {
    if (this._ui?.report) {
      this._ui.report.setText('❌ No se pudo extraer la línea.');
    }
    return;
  }

  // Volcar puntos al editor como si hubieras dibujado
  this._cleanPoints.length = 0;
  for (const p of pts) {
    this._cleanPoints.push({ x: p.x, y: p.y });
  }

  this._redraw();
  this._refreshStats();

  if (this._ui?.report) {
    this._ui.report.setText('🏁 Pista generada.\nLista para VALIDAR.');
  }
});
// --- OPACIDAD IMAGEN ---
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

const imgTrack = this.add.rectangle(imgSliderX, y, imgSliderW, imgSliderH, 0xffffff, 0.18)
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
    // --- Slider: ANCHO DE PISTA ---
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

    const sTrack = this.add.rectangle(sliderX, trackY, sliderW, sliderH, 0xffffff, 0.18)
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

    this._ui.widthSlider = { sTrack, knob, sHit, sliderX, sliderW, trackY, sliderH };

    const setWidthFromPointer = (px) => {
      const t = Phaser.Math.Clamp((px - sliderX) / sliderW, 0, 1);
      const v = Math.round(this._trackWidthMin + t * (this._trackWidthMax - this._trackWidthMin));
      this._trackWidth = v;
      this._ui.widthValue.setText(`${v}px`);
      this._positionWidthKnob();
      this._lastValidation = null;
      this._redraw();
    };

    sHit.on('pointerdown', (p) => setWidthFromPointer(p.worldX));
    sHit.on('pointermove', (p) => { if (p.isDown) setWidthFromPointer(p.worldX); });
    knob.on('pointerdown', (p) => setWidthFromPointer(p.worldX));
    knob.on('pointermove', (p) => { if (p.isDown) setWidthFromPointer(p.worldX); });

    this._positionWidthKnob();

    this._ui.stats = this.add.text(sideX + 18, trackY + sliderH + S(16), 'Puntos: 0', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: `${S(12)}px`,
      color: '#ffffff'
    }).setAlpha(0.85).setDepth(61);

    this._ui.report = this.add.text(
      sideX + 18,
      trackY + sliderH + S(36),
      'Sin validar',
      {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: `${S(11)}px`,
        color: '#ffffff',
        lineSpacing: 2,
        wordWrap: { width: Math.max(120, sideW - 36), useAdvancedWrap: true }
      }
    ).setAlpha(0.9).setDepth(61);

    // Estado inicial del botón draw
    this._ui.drawBtn.r.setAlpha(1);
    this._ui.drawBtn.t.setAlpha(1);

    // --- Título (centrado sobre el canvas) ---
    const titleX = this._drawRect.x + this._drawRect.width / 2;

    this.add.text(titleX, isNarrow ? 48 : 54, 'EDITOR DE PISTAS', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: isNarrow ? '22px' : '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(titleX, isNarrow ? 74 : 82, 'Admin Tool · Dibuja el trazado y valida la pista', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: isNarrow ? '11px' : '12px',
      color: '#e8f0ff'
    }).setOrigin(0.5).setAlpha(0.9);

// --- Layers de dibujo ---
this._gRaw = this.add.graphics().setDepth(10);
this._gClean = this.add.graphics().setDepth(11);
this._gMask = this.add.graphics().setDepth(11.5);
this._gOverlay = this.add.graphics().setDepth(12); // ✅ overlay encima
    // Cámara dedicada al editor (solo canvas y dibujo)
    this._editCam = this.cameras.add(0, 0, width, height);
    this._editCam.setZoom(this._editZoom);
    this._editCam.setScroll(0, 0);
    this._editCam.setRoundPixels(true);

    // La cámara principal NO debe renderizar el mundo editable
    this.cameras.main.ignore([
      this._bgImage,
      this._gRaw,
      this._gClean,
      this._gMask,
      this._gOverlay
    ].filter(Boolean));

    
    // --- Input táctil ---
    this.input.addPointer(1);

        this.input.on('pointerdown', (p) => {
      if (!this._drawMode) return;

      const wp = this._screenToEditorWorld(p);

      if (this._drawRect && !this._drawRect.contains(wp.x, wp.y)) {
        this._isDrawing = false;
        return;
      }

      this._isDrawing = true;

      if (this._rawPoints.length === 0) {
        this._pushPointIfFar(wp.x, wp.y);
      } else {
        const last = this._rawPoints[this._rawPoints.length - 1];
        const dx = wp.x - last.x;
        const dy = wp.y - last.y;
        const d2 = dx * dx + dy * dy;

        if (d2 > (this._minSampleDist * this._minSampleDist) * 4) {
          this._rawPoints.push({ x: wp.x, y: wp.y });
        } else {
          this._pushPointIfFar(wp.x, wp.y);
        }
      }

      // dibujar invalida validación previa
      this._lastValidation = null;

      this._rebuildClean();
      this._redraw();
      this._refreshStats();
    });

    this.input.on('pointermove', (p) => {
      if (!this._isDrawing) return;

      const wp = this._screenToEditorWorld(p);
      if (this._drawRect && !this._drawRect.contains(wp.x, wp.y)) return;

      this._pushPointIfFar(wp.x, wp.y);
      this._lastValidation = null;
      this._rebuildClean();
      this._redraw();
      this._refreshStats();
    });

this.input.on('pointerup', () => {
  this._isDrawing = false;

  // Snap-to-close al soltar el dedo
  if (this._drawMode) {
    const didSnap = this._snapCloseIfNear();
    if (didSnap) {
      this._lastValidation = null; // si estaba validado, ahora cambió
      this._rebuildClean();
      this._redraw();
      this._refreshStats();
    }
  }
});

this.input.on('pointerupoutside', () => {
  this._isDrawing = false;

  // Snap-to-close también si suelta fuera
  if (this._drawMode) {
    const didSnap = this._snapCloseIfNear();
    if (didSnap) {
      this._lastValidation = null;
      this._rebuildClean();
      this._redraw();
      this._refreshStats();
    }
  }
});
  }
  _screenToEditorWorld(pointer) {
    if (!this._editCam) {
      return { x: pointer.worldX, y: pointer.worldY };
    }
    return this._editCam.getWorldPoint(pointer.x, pointer.y);
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
  const src = this._rawPoints || [];
  if (src.length < 2) {
    this._cleanPoints = src.slice();
    return;
  }

  // 1) Resample a paso fijo
  const step = Math.max(6, this._resampleStep | 0);
  const res = this._resamplePolyline(src, step);

  // 2) Smooth Catmull-Rom (manteniendo cierre si está cerrado)
  const closed = this._isClosedPolyline(res);
  const smooth = this._catmullRom(res, this._smoothSubdiv, closed);

  this._cleanPoints = smooth;
}

  _redraw() {
    this._gRaw.clear();
    this._gClean.clear();
    if (this._gOverlay) this._gOverlay.clear();

    if (this._rawPoints.length >= 2) {
      this._gRaw.lineStyle(3, 0xffffff, 0.45);
      this._gRaw.beginPath();
      this._gRaw.moveTo(this._rawPoints[0].x, this._rawPoints[0].y);
      for (let i = 1; i < this._rawPoints.length; i++) {
        this._gRaw.lineTo(this._rawPoints[i].x, this._rawPoints[i].y);
      }
      this._gRaw.strokePath();
    }

    if (this._cleanPoints.length >= 2) {
      const previewPx = Math.max(6, Math.min(40, Math.round(this._trackWidth / 6)));
      this._gClean.lineStyle(previewPx, 0xfff000, 0.85);
      this._gClean.beginPath();
      this._gClean.moveTo(this._cleanPoints[0].x, this._cleanPoints[0].y);
      for (let i = 1; i < this._cleanPoints.length; i++) {
        this._gClean.lineTo(this._cleanPoints[i].x, this._cleanPoints[i].y);
      }
      this._gClean.strokePath();
    }

    // ✅ overlay de validación (si existe reporte)
    this._drawValidationOverlay();
  }

  _drawValidationOverlay() {
    if (!this._gOverlay) return;
    const pts = this._cleanPoints || [];
    if (pts.length === 0) return;

    // Siempre mostramos start/end, aunque no haya validación
    const start = pts[0];
    const end = pts[pts.length - 1];

    // Start verde
    this._gOverlay.fillStyle(0x3dff7a, 0.95);
    this._gOverlay.fillCircle(start.x, start.y, 7);

    // End rojo
    this._gOverlay.fillStyle(0xff3d5a, 0.95);
    this._gOverlay.fillCircle(end.x, end.y, 7);

    const rep = this._lastValidation;
    if (!rep) return; // si no está validado, no dibujamos más

    // Línea cierre (verde si OK, rojo si no)
    const closeDist = rep.closeDist ?? Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
    const closeThresh = rep.closeThresh ?? Math.max(20, Math.min(90, this._trackWidth * 0.35));
    const okClose = closeDist <= closeThresh;

    this._gOverlay.lineStyle(okClose ? 3 : 4, okClose ? 0x3dff7a : 0xff3d5a, okClose ? 0.55 : 0.75);
    this._gOverlay.beginPath();
    this._gOverlay.moveTo(start.x, start.y);
    this._gOverlay.lineTo(end.x, end.y);
    this._gOverlay.strokePath();

    // Cruce: X roja en el punto aproximado
    const hit = rep.hit;
    if (hit && hit.p) {
      const x = hit.p.x;
      const y = hit.p.y;

      this._gOverlay.lineStyle(5, 0xff3d5a, 0.9);
      this._gOverlay.beginPath();
      this._gOverlay.moveTo(x - 10, y - 10);
      this._gOverlay.lineTo(x + 10, y + 10);
      this._gOverlay.moveTo(x + 10, y - 10);
      this._gOverlay.lineTo(x - 10, y + 10);
      this._gOverlay.strokePath();

      this._gOverlay.lineStyle(3, 0xff3d5a, 0.7);
      this._gOverlay.strokeCircle(x, y, 14);
    }
  }
  _snapCloseIfNear() {
    const pts = this._rawPoints;
    if (!pts || pts.length < 6) return false; // evita cierres absurdos

    const first = pts[0];
    const last = pts[pts.length - 1];

    // Si ya está cerrado (último igual al primero), no hagas nada
    const same = (Math.abs(last.x - first.x) < 0.001) && (Math.abs(last.y - first.y) < 0.001);
    if (same) return false;

    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Umbral de cierre (coherente con tu validador)
    const closeThresh = Math.max(20, Math.min(90, this._trackWidth * 0.35));

    if (dist <= closeThresh) {
      // Cierre “pro”: último punto = primer punto
      pts.push({ x: first.x, y: first.y });
      return true;
    }

    return false;
  }
  _refreshStats() {
    if (!this._ui || !this._ui.stats) return;
    this._ui.stats.setText(`Puntos: ${this._rawPoints.length}`);
  }

  _positionWidthKnob() {
    if (!this._ui || !this._ui.widthSlider) return;
    const { knob, sliderX, sliderW, trackY, sliderH } = this._ui.widthSlider;

    const t = (this._trackWidth - this._trackWidthMin) / (this._trackWidthMax - this._trackWidthMin);
    const x = Math.floor(sliderX + Phaser.Math.Clamp(t, 0, 1) * sliderW);
    const y = Math.floor(trackY + sliderH / 2);

    knob.setPosition(x, y);
  }

  _setReport(rep) {
    if (!this._ui) return;

    // ✅ botón VALIDAR cambia look
    if (this._ui.validateBtn && this._ui.validateBtn.r) {
      if (rep && rep.ok) {
        this._ui.validateBtn.r.setFillStyle(0x3dff7a, 0.22);
        this._ui.validateBtn.r.setStrokeStyle(2, 0x3dff7a, 0.55);
      } else {
        this._ui.validateBtn.r.setFillStyle(0xff3d5a, 0.22);
        this._ui.validateBtn.r.setStrokeStyle(2, 0xff3d5a, 0.55);
      }
    }

    if (!this._ui.report) return;

    if (rep && rep.ok) {
      this._ui.report.setText(`✅ OK\n${rep.msg}`);
    } else {
      const lines = (rep?.errors || []).map(e => `• ${e}`);
      this._ui.report.setText(`❌ ERRORES\n${lines.join('\n') || 'Sin datos'}`);
    }

    // ✅ Habilitar EXPORTAR solo si la validación es OK
    if (this._ui.exportBtn && this._ui.exportBtn.r && this._ui.exportBtn.t) {
      if (rep && rep.ok) {
        this._ui.exportBtn.r.setAlpha(1);
        this._ui.exportBtn.t.setAlpha(1);
        this._ui.exportBtn.r.setInteractive({ useHandCursor: true });
      } else {
        this._ui.exportBtn.r.setAlpha(0.55);
        this._ui.exportBtn.t.setAlpha(0.65);
        this._ui.exportBtn.r.disableInteractive();
      }
    }

  }

  _validateTrack() {
    const pts = this._cleanPoints;
    const errors = [];

    // 1) mínimos
    if (!pts || pts.length < 12) {
      errors.push('Muy pocos puntos (mínimo 12).');
      return { ok: false, errors, closeDist: null, closeThresh: null, hit: null };
    }

    // 2) longitud mínima
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    if (len < 600) errors.push('Longitud insuficiente (mínimo 600px).');

    // 3) cierre (inicio cerca del final)
    const a = pts[0];
    const b = pts[pts.length - 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const closeDist = Math.sqrt(dx * dx + dy * dy);

    const closeThresh = Math.max(20, Math.min(90, this._trackWidth * 0.35));
    if (closeDist > closeThresh) {
      errors.push(`No está cerrado (distancia ${Math.round(closeDist)}px).`);
    }

    // 4) auto-intersecciones (básico)
    const hit = this._findSelfIntersection(pts);
    if (hit) errors.push('Auto-intersección detectada (cruce de trazado).');

    if (errors.length) return { ok: false, errors, len, closeDist, closeThresh, hit };

    return {
      ok: true,
      msg: `Longitud: ${Math.round(len)}px · Cierre OK · Sin cruces`,
      len,
      closeDist,
      closeThresh,
      hit: null
    };
  }

  _findSelfIntersection(pts) {
    // Segmentos (i-1 -> i)
    // Ignoramos segmentos adyacentes (comparten punto) para evitar falsos positivos.
    const n = pts.length;
    if (n < 4) return null;

    // ✅ circuito cerrado si último ~= primero (por coords)
    const closed = this._isClosedPolyline(pts);
    const EPS2 = 1e-4; // tolerancia cuadrada (0.01px^2 aprox)

    const samePoint = (A, B) => {
      if (!A || !B) return false;
      const dx = A.x - B.x;
      const dy = A.y - B.y;
      return (dx * dx + dy * dy) <= EPS2;
    };

    const segIntersects = (p1, p2, p3, p4) => {
      // orientación / ccw (simple, suficiente para ahora)
      const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
      return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
    };

    // i segment = (i-1 -> i), con i en [1..n-1]
    for (let i = 1; i < n; i++) {
      const a1 = pts[i - 1], a2 = pts[i];

      for (let j = i + 2; j < n; j++) {
        const b1 = pts[j - 1], b2 = pts[j];

        // 1) Saltar si comparten endpoint (por coordenadas)
        if (samePoint(a1, b1) || samePoint(a1, b2) || samePoint(a2, b1) || samePoint(a2, b2)) continue;

        // 2) Saltar adyacentes (en abierto ya lo evitamos con j=i+2)
        // 3) En cerrado, también son “adyacentes” el primer y el último segmento
        //    primer segmento: (0->1)  => i==1
        //    último segmento: (n-2->n-1) => j==n-1
        if (closed) {
          const isFirstSeg = (i === 1);
          const isLastSeg = (j === n - 1);
          if (isFirstSeg && isLastSeg) continue;
        }

        if (segIntersects(a1, a2, b1, b2)) {
          const p = this._segmentIntersectionPoint(a1, a2, b1, b2);
          return { i, j, p };
        }
      }
    }
    return null;
  }

  _segmentIntersectionPoint(p1, p2, p3, p4) {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;

    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-6) {
      // casi paralelo: devolvemos algo razonable
      return { x: (x2 + x3) * 0.5, y: (y2 + y3) * 0.5 };
    }

    const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den;
    const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den;

    return { x: px, y: py };
  }
  _resamplePolyline(pts, step) {
  const out = [];
  out.push({ x: pts[0].x, y: pts[0].y });

  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen < 1e-6) continue;

    let t = 0;
    while (acc + segLen >= step) {
      const need = step - acc;
      const k = need / segLen;
      t += k;

      const px = a.x + dx * t;
      const py = a.y + dy * t;
      out.push({ x: px, y: py });

      segLen -= need;
      acc = 0;

      // nuevo origen “virtual” en el punto insertado
      dx = b.x - px;
      dy = b.y - py;
      if (segLen < 1e-6) break;
    }
    acc += segLen;
  }

  // Si la polyline termina exactamente en el primero (cerrada), mantenemos ese punto final
  const last = pts[pts.length - 1];
  out.push({ x: last.x, y: last.y });

  return out;
}

_isClosedPolyline(pts) {
  if (!pts || pts.length < 3) return false;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return (dx * dx + dy * dy) < 1.0; // prácticamente igual
}

_catmullRom(pts, subdiv, closed) {
  const n = pts.length;
  if (n < 4) return pts.slice();

  const out = [];
  const get = (i) => {
    if (closed) {
      const k = (i % n + n) % n;
      return pts[k];
    }
    return pts[Math.max(0, Math.min(n - 1, i))];
  };

  const steps = Math.max(2, subdiv | 0);

  // Recorremos “segmentos” p1->p2
  const segCount = closed ? n : (n - 1);
  for (let i = 0; i < segCount; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);

    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;

      // Catmull-Rom spline (centripetal sería más pro, pero esta es estable y rápida)
      const x =
        0.5 * ((2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

      const y =
        0.5 * ((2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

      out.push({ x, y });
    }
  }

  // Añadimos el último punto para cerrar o rematar
  if (!closed) {
    const end = pts[n - 1];
    out.push({ x: end.x, y: end.y });
  } else {
    // si es cerrado, garantizamos cierre exacto
    const a = out[0];
    out.push({ x: a.x, y: a.y });
  }

  return out;
}

  _buildTrackMaskFromBg() {
    if (!this._bgImage || !this._bgImageKey || !this._drawRect) return null;

    const tex = this.textures.get(this._bgImageKey);
    const src = tex?.getSourceImage?.() || tex?.source?.[0]?.image || tex?.source?.[0];
    if (!src || !src.width || !src.height) return null;

    // Canvas temporal del tamaño exacto del área de dibujo
    const w = Math.max(1, Math.floor(this._drawRect.width));
    const h = Math.max(1, Math.floor(this._drawRect.height));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Fondo negro
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Dibujar la imagen centrada y escalada igual que en Phaser
    const scale = Math.min(w / src.width, h / src.height);
    const dw = src.width * scale;
    const dh = src.height * scale;
    const dx = (w - dw) * 0.5;
    const dy = (h - dh) * 0.5;

    ctx.drawImage(src, dx, dy, dw, dh);

    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;

    // Máscara binaria: 255 = pista, 0 = no pista
    // Heurística inicial:
    // - asfalto suele ser más oscuro que la hierba
    // - evitamos verdes dominantes
    // - evitamos zonas muy claras (bordillos blancos / fondo)
    const mask = new Uint8Array(w * h);

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 10) {
        mask[p] = 0;
        continue;
      }

      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const greenDominance = g - Math.max(r, b);

      // Regla inicial conservadora
      const isDarkEnough = lum < 150;
      const notTooGreen = greenDominance < 18;

      mask[p] = (isDarkEnough && notTooGreen) ? 255 : 0;
    }

    return { canvas, ctx, w, h, mask };
  }
    _drawMaskPreview(res) {
    if (!this._gMask || !res) return;
    this._gMask.clear();

    const { w, h, mask } = res;
    const ox = this._drawRect.x;
    const oy = this._drawRect.y;

    // muestreo visual para no fundir rendimiento
    const step = 4;

    this._gMask.fillStyle(0x00ff88, 0.22);

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const p = y * w + x;
        if (mask[p] > 0) {
          this._gMask.fillRect(ox + x, oy + y, step, step);
        }
      }
    }
  }
    _cleanTrackMask(res) {
    if (!res || !res.mask || !res.w || !res.h) return res;

    const { w, h } = res;
    let mask = new Uint8Array(res.mask); // copia

    // 1) Quedarnos con la componente conectada más grande
    mask = this._largestConnectedComponent(mask, w, h);

    // 2) Suavizado binario simple:
    //    una pasada de "opening/closing" ligera mediante filtro vecinal
    mask = this._binaryMajorityFilter(mask, w, h, 1);
    mask = this._binaryMajorityFilter(mask, w, h, 1);

    return { ...res, mask };
  }

  _largestConnectedComponent(mask, w, h) {
    const visited = new Uint8Array(w * h);
    const out = new Uint8Array(w * h);

    let bestCount = 0;
    let bestPixels = null;

    const dirs = [
      [-1, 0], [1, 0], [0, -1], [0, 1]
    ];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const start = y * w + x;
        if (visited[start] || mask[start] === 0) continue;

        const queue = [start];
        const pixels = [];
        visited[start] = 1;

        let q = 0;
        while (q < queue.length) {
          const p = queue[q++];
          pixels.push(p);

          const py = Math.floor(p / w);
          const px = p - py * w;

          for (const [dx, dy] of dirs) {
            const nx = px + dx;
            const ny = py + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;

            const np = ny * w + nx;
            if (visited[np] || mask[np] === 0) continue;

            visited[np] = 1;
            queue.push(np);
          }
        }

        if (pixels.length > bestCount) {
          bestCount = pixels.length;
          bestPixels = pixels;
        }
      }
    }

    if (!bestPixels) return out;

    for (const p of bestPixels) out[p] = 255;
    return out;
  }

  _binaryMajorityFilter(mask, w, h, radius = 1) {
    const out = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let on = 0;
        let total = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;

            total++;
            if (mask[ny * w + nx] > 0) on++;
          }
        }

        out[y * w + x] = (on >= Math.ceil(total * 0.5)) ? 255 : 0;
      }
    }

    return out;
  }
  _extractCenterline(res) {
    const { w, h, mask } = res;
    if (!mask || !w || !h) return null;

    // 1) Adelgazar máscara a esqueleto 1px
    const skeleton = this._zhangSuenThinning(mask, w, h);

    // 2) Sacar píxeles del esqueleto
    const pts = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        if (skeleton[p] > 0) pts.push({ x, y });
      }
    }

    if (pts.length < 20) return null;

    // 3) Elegir un punto de arranque estable: el más arriba-izquierda
    let startI = 0;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].y < pts[startI].y || (pts[i].y === pts[startI].y && pts[i].x < pts[startI].x)) {
        startI = i;
      }
    }

    // 4) Ordenar por vecino más cercano con radio limitado
    const used = new Uint8Array(pts.length);
    const ordered = [];
    ordered.push(pts[startI]);
    used[startI] = 1;

    const MAX_STEP2 = 18 * 18;

    while (ordered.length < pts.length) {
      const last = ordered[ordered.length - 1];

      let best = -1;
      let bestD2 = Infinity;

      for (let i = 0; i < pts.length; i++) {
        if (used[i]) continue;

        const dx = pts[i].x - last.x;
        const dy = pts[i].y - last.y;
        const d2 = dx * dx + dy * dy;

        if (d2 < bestD2 && d2 <= MAX_STEP2) {
          bestD2 = d2;
          best = i;
        }
      }

      if (best === -1) break;

      used[best] = 1;
      ordered.push(pts[best]);
    }

    if (ordered.length < 20) return null;

    // 5) Reducir ruido: quedarnos con 1 de cada N puntos
    const reduced = [];
    const stride = 6;
    for (let i = 0; i < ordered.length; i += stride) {
      reduced.push(ordered[i]);
    }

    // 6) Convertir a coords del canvas
    const ox = this._drawRect.x;
    const oy = this._drawRect.y;

    return reduced.map(p => ({
      x: ox + p.x,
      y: oy + p.y
    }));
  }
    _zhangSuenThinning(mask, w, h) {
    const img = new Uint8Array(mask.length);
    for (let i = 0; i < mask.length; i++) img[i] = mask[i] > 0 ? 1 : 0;

    let changed = true;

    const idx = (x, y) => y * w + x;

    while (changed) {
      changed = false;
      let toDelete = [];

      // Subiteración 1
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const p1 = img[idx(x, y)];
          if (p1 !== 1) continue;

          const p2 = img[idx(x, y - 1)];
          const p3 = img[idx(x + 1, y - 1)];
          const p4 = img[idx(x + 1, y)];
          const p5 = img[idx(x + 1, y + 1)];
          const p6 = img[idx(x, y + 1)];
          const p7 = img[idx(x - 1, y + 1)];
          const p8 = img[idx(x - 1, y)];
          const p9 = img[idx(x - 1, y - 1)];

          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          const A =
            (p2 === 0 && p3 === 1) +
            (p3 === 0 && p4 === 1) +
            (p4 === 0 && p5 === 1) +
            (p5 === 0 && p6 === 1) +
            (p6 === 0 && p7 === 1) +
            (p7 === 0 && p8 === 1) +
            (p8 === 0 && p9 === 1) +
            (p9 === 0 && p2 === 1);

          if (
            A === 1 &&
            B >= 2 && B <= 6 &&
            (p2 * p4 * p6) === 0 &&
            (p4 * p6 * p8) === 0
          ) {
            toDelete.push(idx(x, y));
          }
        }
      }

      if (toDelete.length) changed = true;
      for (const p of toDelete) img[p] = 0;

      toDelete = [];

      // Subiteración 2
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const p1 = img[idx(x, y)];
          if (p1 !== 1) continue;

          const p2 = img[idx(x, y - 1)];
          const p3 = img[idx(x + 1, y - 1)];
          const p4 = img[idx(x + 1, y)];
          const p5 = img[idx(x + 1, y + 1)];
          const p6 = img[idx(x, y + 1)];
          const p7 = img[idx(x - 1, y + 1)];
          const p8 = img[idx(x - 1, y)];
          const p9 = img[idx(x - 1, y - 1)];

          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          const A =
            (p2 === 0 && p3 === 1) +
            (p3 === 0 && p4 === 1) +
            (p4 === 0 && p5 === 1) +
            (p5 === 0 && p6 === 1) +
            (p6 === 0 && p7 === 1) +
            (p7 === 0 && p8 === 1) +
            (p8 === 0 && p9 === 1) +
            (p9 === 0 && p2 === 1);

          if (
            A === 1 &&
            B >= 2 && B <= 6 &&
            (p2 * p4 * p8) === 0 &&
            (p2 * p6 * p8) === 0
          ) {
            toDelete.push(idx(x, y));
          }
        }
      }

      if (toDelete.length) changed = true;
      for (const p of toDelete) img[p] = 0;
    }

    const out = new Uint8Array(img.length);
    for (let i = 0; i < img.length; i++) out[i] = img[i] ? 255 : 0;
    return out;
  }
  // --- Export (JSON listo para crear un track real) ---
  _exportTrack() {
    const rep = this._lastValidation;
    if (!rep || !rep.ok) {
      this._setReport({ ok: false, msg: 'No se puede exportar: la pista no pasa la validación.' });
      return;
    }

    // Usamos la línea central ya procesada (resample + smooth)
    const pts = (this._cleanPoints && this._cleanPoints.length >= 3) ? this._cleanPoints : this._rawPoints;
    if (!pts || pts.length < 3 || !this._drawRect) return;

    // Quitar cierre duplicado si existe (último = primero)
    const cleaned = pts.slice();
    if (cleaned.length >= 2) {
      const a = cleaned[0];
      const b = cleaned[cleaned.length - 1];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if ((dx * dx + dy * dy) < 1) cleaned.pop();
    }

    // Mapeo canvas (screen) -> world (como los tracks existentes)
    const worldW = 8000;
    const worldH = 5000;

    const drawW = this._drawRect.width;
    const drawH = this._drawRect.height;

    // margen para que no quede pegado a bordes
    const margin = 0.85;
    const s = Math.min((worldW * margin) / drawW, (worldH * margin) / drawH);
    const ox = (worldW - drawW * s) * 0.5;
    const oy = (worldH - drawH * s) * 0.5;

    const centerline = cleaned.map(p => {
      const cx = (p.x - this._drawRect.x) * s + ox;
      const cy = (p.y - this._drawRect.y) * s + oy;
      return [Math.round(cx * 10) / 10, Math.round(cy * 10) / 10];
    });

    // TrackWidth en "world px"
    const trackWidth = Math.round(this._trackWidth * s);

    // Start/Finish automáticos basados en el primer segmento
    const p0 = centerline[0];
    const p1 = centerline[1] || centerline[0];
    const vx = p1[0] - p0[0];
    const vy = p1[1] - p0[1];
    const heading = Math.atan2(vy, vx);
    const ux = Math.cos(heading);
    const uy = Math.sin(heading);
    const px = -uy;
    const py = ux;

    const half = trackWidth * 0.55;

    const finish = {
      x: Math.round(p0[0] * 10) / 10,
      y: Math.round(p0[1] * 10) / 10,
      a: { x: Math.round((p0[0] + px * half) * 10) / 10, y: Math.round((p0[1] + py * half) * 10) / 10 },
      b: { x: Math.round((p0[0] - px * half) * 10) / 10, y: Math.round((p0[1] - py * half) * 10) / 10 },
      heading: Math.round(heading * 10000) / 10000
    };

    const start = {
      x: Math.round((p0[0] - ux * (trackWidth * 0.7)) * 10) / 10,
      y: Math.round((p0[1] - uy * (trackWidth * 0.7)) * 10) / 10,
      r: Math.round(heading * 10000) / 10000
    };

    const id = `track_custom_${Date.now()}`;
    const spec = {
      id,
      name: 'Custom Track',
      worldW,
      worldH,
      centerline,
      trackWidth,
      start,
      finish
    };

    // Guarda un último export por si quieres recuperarlo
    try { localStorage.setItem('tdr2:trackExport:last', JSON.stringify(spec)); } catch (e) {}

    this._downloadJson(`${id}.json`, spec);

    // Feedback UI
    this._setReport({ ok: true, msg: `Exportado: ${id}.json (copiado al portapapeles si es posible)` });
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
      this._setReport({ ok: false, msg: 'Error exportando JSON' });
    }
  }
}
