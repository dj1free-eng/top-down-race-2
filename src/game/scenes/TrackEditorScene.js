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
    const sideY = this._uiTopH;
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
const uiTop = Math.floor(sideY + S(46));

// Queremos que quepan: 4 botones + slider + puntos + margen
const btnCount = 4; // Dibujar, Borrar, Limpiar, Validar

// Estimación de lo que “se come” abajo (slider + puntos + aire)
const sliderBlockH = S(92);
const statsBlockH = S(26);
const bottomMargin = S(16);

// Alto disponible real para los botones
const availableForButtons = Math.max(
  0,
  sideH - (uiTop - sideY) - sliderBlockH - statsBlockH - bottomMargin
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
        fontSize: `${S(15)}px`,   // iPhone ~ 10–11px
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
      this._redraw();
      this._refreshStats();
    });
    y += btnH + btnGap;

    // VALIDAR (si ya lo tienes implementado, aquí lo enganchas)
    this._ui.validateBtn = makeSideBtn(y, 'VALIDAR', () => {
      if (this._validateTrack) {
        const rep = this._validateTrack();
        if (this._setReport) this._setReport(rep);
      }
    });
    y += btnH + S(18);

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

      this._rebuildClean();
      this._redraw();
      this._refreshStats();
    });

    this.input.on('pointermove', (p) => {
      if (!this._isDrawing) return;
      if (this._drawRect && !this._drawRect.contains(p.worldX, p.worldY)) return;

      this._pushPointIfFar(p.worldX, p.worldY);
      this._rebuildClean();
      this._redraw();
      this._refreshStats();
    });

    this.input.on('pointerup', () => { this._isDrawing = false; });
    this.input.on('pointerupoutside', () => { this._isDrawing = false; });
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
    this._cleanPoints = this._rawPoints.slice();
  }

  _redraw() {
    this._gRaw.clear();
    this._gClean.clear();

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
    if (!this._ui || !this._ui.report) return;

    if (rep.ok) {
      this._ui.report.setText(`✅ OK\n${rep.msg}`);
    } else {
      const lines = rep.errors.map(e => `• ${e}`);
      this._ui.report.setText(`❌ ERRORES\n${lines.join('\n')}`);
    }
  }

  _validateTrack() {
    const pts = this._cleanPoints;
    const errors = [];

    // 1) mínimos
    if (!pts || pts.length < 12) {
      errors.push('Muy pocos puntos (mínimo 12).');
      return { ok: false, errors };
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

    if (errors.length) return { ok: false, errors };

    return {
      ok: true,
      msg: `Longitud: ${Math.round(len)}px · Cierre OK · Sin cruces`
    };
  }

  _findSelfIntersection(pts) {
    // Segmentos (i-1 -> i)
    // Ignoramos segmentos adyacentes (comparten punto) para evitar falsos positivos.
    const n = pts.length;
    if (n < 4) return null;

    const segIntersects = (p1, p2, p3, p4) => {
      // orientación / ccw
      const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
      return (ccw(p1, p3, p4) !== ccw(p2, p3, p4)) && (ccw(p1, p2, p3) !== ccw(p1, p2, p4));
    };

    for (let i = 1; i < n; i++) {
      const a1 = pts[i - 1], a2 = pts[i];

      for (let j = i + 2; j < n; j++) {
        // Evitar comparar con el segmento vecino inmediato
        if (j === i || j === i - 1) continue;

        const b1 = pts[j - 1], b2 = pts[j];

        // Si comparten endpoint (caso raro), saltar
        if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) continue;

        if (segIntersects(a1, a2, b1, b2)) return { i, j };
      }
    }
    return null;
  }
}
