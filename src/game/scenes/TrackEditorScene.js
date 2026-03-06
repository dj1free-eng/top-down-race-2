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

    // --- UI Sidebar (auto-fit por altura) ---
    const btnW = Math.floor(sideW - 36);
    const btnX = Math.floor(sideX + (sideW - btnW) / 2);

    // Arranque del bloque dentro del sidebar
const uiTop = Math.floor(sideY + S(isNarrow ? 34 : 46));

    // Queremos que quepan: 4 botones + slider + puntos + reporte + margen
    const btnCount = 4; // Dibujar, Borrar, Limpiar, Validar

    // Estimación de lo que “se come” abajo (slider + puntos + reporte + aire)
    const sliderBlockH = S(92);
    const statsBlockH = S(26);
    const reportBlockH = S(56);
    const bottomMargin = S(16);

    // Alto disponible real para los botones
    const availableForButtons = Math.max(
      0,
      sideH - (uiTop - sideY) - sliderBlockH - statsBlockH - reportBlockH - bottomMargin
    );

    // Rango de tamaños aceptables
    const hardMinBtnH = S(34);
    const hardMaxBtnH = S(54);
    const hardMinGap = S(6);
    const hardMaxGap = S(14);

    // Calcula GAP y H para que entren sí o sí
    let btnGap = Phaser.Math.Clamp(
      Math.floor(availableForButtons * 0.06 / btnCount),
      hardMinGap,
      hardMaxGap
    );

    let btnH = Phaser.Math.Clamp(
      Math.floor((availableForButtons - btnGap * (btnCount - 1)) / btnCount),
      hardMinBtnH,
      hardMaxBtnH
    );

    // Si estamos en el mínimo, aprieta gap al mínimo también
    if (btnH === hardMinBtnH) btnGap = hardMinGap;

    const makeSideBtn = (y, label, onClick) => {
      const r = this.add.rectangle(btnX, y, btnW, btnH, 0xffffff, 0.18)
        .setOrigin(0)
        .setStrokeStyle(2, 0xffffff, 0.45)
        .setInteractive({ useHandCursor: true })
        .setDepth(60);

      const t = this.add.text(btnX + btnW / 2, y + btnH / 2, label, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: `${S(15)}px`,
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(61);

      r.on('pointerdown', () => r.setScale(0.98));
      r.on('pointerup', () => { r.setScale(1); onClick?.(); });
      r.on('pointerupoutside', () => r.setScale(1));

      return { r, t };
    };

    // Posiciones: una debajo de otra (NO offsets fijos)
    let y = uiTop;

    // DIBUJAR
    this._ui.drawBtn = makeSideBtn(y, isNarrow ? 'DIBUJAR ON' : 'DIBUJAR: ON', () => {
      this._drawMode = !this._drawMode;
      this._ui.drawBtn.t.setText(this._drawMode
        ? (isNarrow ? 'DIBUJAR ON' : 'DIBUJAR: ON')
        : (isNarrow ? 'DIBUJAR OFF' : 'DIBUJAR: OFF')
      );
      this._ui.drawBtn.r.setAlpha(this._drawMode ? 1 : 0.6);
      this._ui.drawBtn.t.setAlpha(this._drawMode ? 1 : 0.75);
      if (!this._drawMode) this._isDrawing = false;
    });
    y += btnH + btnGap;

    // BORRAR ÚLTIMO
    this._ui.undoBtn = makeSideBtn(y, isNarrow ? 'BORRAR' : 'BORRAR ÚLTIMO', () => {
      if (this._rawPoints.length > 0) {
        this._rawPoints.pop();
        this._rebuildClean();
        this._lastValidation = null; // invalidamos overlay
        this._redraw();
      }
      this._refreshStats();
    });
    y += btnH + btnGap;

    // LIMPIAR
    this._ui.clearBtn = makeSideBtn(y, 'LIMPIAR', () => {
      this._isDrawing = false;
      this._rawPoints.length = 0;
      this._cleanPoints.length = 0;
      this._lastValidation = null;
      this._redraw();
      this._refreshStats();
      if (this._ui.report) this._ui.report.setText('Sin validar');
      // Reset look del botón validar
      if (this._ui.validateBtn?.r) {
        this._ui.validateBtn.r.setFillStyle(0xffffff, 0.18);
        this._ui.validateBtn.r.setStrokeStyle(2, 0xffffff, 0.45);
      }
    });
    y += btnH + btnGap;

    // VALIDAR
    this._ui.validateBtn = makeSideBtn(y, 'VALIDAR', () => {
      const rep = this._validateTrack();
      this._lastValidation = rep;
      this._setReport(rep);
      this._redraw(); // ✅ pinta overlay
    });
    y += btnH + S(18);

    // EXPORTAR (solo se habilita si la validación sale OK)
    this._ui.exportBtn = makeSideBtn(y, isNarrow ? "EXPORTAR" : "EXPORTAR", () => {
      this._exportTrack();
    });
    this._ui.exportBtn.r.setAlpha(0.55);
    this._ui.exportBtn.t.setAlpha(0.65);
    this._ui.exportBtn.r.disableInteractive();
    y += btnH + btnGap;


    // --- Slider: ANCHO DE PISTA (arranca justo después del último botón) ---
    const sliderY = y;

    this.add.text(sideX + 18, sliderY, isNarrow ? 'ANCHO' : 'ANCHO DE PISTA', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: `${S(13)}px`,
      color: '#ffffff',
      fontStyle: 'bold'
    }).setAlpha(0.9).setDepth(61);

    this._ui.widthValue = this.add.text(sideX + 18, sliderY + S(18), `${this._trackWidth}px`, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: `${S(13)}px`,
      color: '#ffffff'
    }).setAlpha(0.85).setDepth(61);

    const sliderW = btnW;
    const sliderH = S(14);
    const sliderX = btnX;
    const trackY = sliderY + S(44);

    const sTrack = this.add.rectangle(sliderX, trackY, sliderW, sliderH, 0xffffff, 0.18)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setDepth(61);

    const knobR = S(14);
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
      // cambiar ancho invalida la validación previa
      this._lastValidation = null;
      this._redraw();
    };

    sHit.on('pointerdown', (p) => setWidthFromPointer(p.worldX));
    sHit.on('pointermove', (p) => { if (p.isDown) setWidthFromPointer(p.worldX); });
    knob.on('pointerdown', (p) => setWidthFromPointer(p.worldX));
    knob.on('pointermove', (p) => { if (p.isDown) setWidthFromPointer(p.worldX); });

    this._positionWidthKnob();

    // Contador de puntos (siempre visible, justo bajo el slider)
    this._ui.stats = this.add.text(sideX + 18, trackY + sliderH + S(18), 'Puntos: 0', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: `${S(13)}px`,
      color: '#ffffff'
    }).setAlpha(0.85).setDepth(61);

    // ✅ Report (debajo de Puntos)
    this._ui.report = this.add.text(
      sideX + 18,
      trackY + sliderH + S(40),
      'Sin validar',
      {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: `${S(12)}px`,
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
    this._gOverlay = this.add.graphics().setDepth(12); // ✅ overlay encima

// --- Imagen de fondo para calcar circuitos ---
this._bgImage = null;

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/*';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const key = 'track_bg_' + Date.now();

    this.textures.addBase64(key, ev.target.result);

    if (this._bgImage) this._bgImage.destroy();

    const img = this.add.image(
      this._drawRect.x + this._drawRect.width / 2,
      this._drawRect.y + this._drawRect.height / 2,
      key
    ).setDepth(6);

    const scale = Math.min(
      this._drawRect.width / img.width,
      this._drawRect.height / img.height
    );

    img.setScale(scale);
    img.setAlpha(0.45);

    this._bgImage = img;
  };

  reader.readAsDataURL(file);
});

// botón cargar imagen
this._ui.loadImgBtn = makeSideBtn(y, "CARGAR IMAGEN", () => {
  fileInput.click();
});
y += btnH + btnGap;
    
    // --- Input táctil ---
    this.input.addPointer(1);

    this.input.on('pointerdown', (p) => {
      if (!this._drawMode) return;

      if (this._drawRect && !this._drawRect.contains(p.worldX, p.worldY)) {
        this._isDrawing = false;
        return;
      }

      this._isDrawing = true;

      if (this._rawPoints.length === 0) {
        this._pushPointIfFar(p.worldX, p.worldY);
      } else {
        const last = this._rawPoints[this._rawPoints.length - 1];
        const dx = p.worldX - last.x;
        const dy = p.worldY - last.y;
        const d2 = dx * dx + dy * dy;

        if (d2 > (this._minSampleDist * this._minSampleDist) * 4) {
          this._rawPoints.push({ x: p.worldX, y: p.worldY });
        } else {
          this._pushPointIfFar(p.worldX, p.worldY);
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
      if (this._drawRect && !this._drawRect.contains(p.worldX, p.worldY)) return;

      this._pushPointIfFar(p.worldX, p.worldY);
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
