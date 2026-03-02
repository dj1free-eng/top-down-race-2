import Phaser from 'phaser';
import { BaseScene } from './BaseScene.js';
import { buildTrackRibbon } from '../tracks/TrackBuilder.js';

export class TrackEditorScene extends BaseScene {
  constructor() {
    super({ key: 'TrackEditorScene' });

    // Estado
    this._isDrawing = false;
    this._drawMode = true;
    this._ui = {};

    this._rawPoints = [];
    this._cleanPoints = [];

    this._gRaw = null;
    this._gClean = null;
    this._gOverlay = null;

    this._minSampleDist = 10; // px
    this._drawRect = null;

    // UI
    this._uiTopH = 110;

    // Track params (en “px de mundo” cuando exportamos)
    this._trackWidth = 160;
    this._trackWidthMin = 80;
    this._trackWidthMax = 260;

    // Validación
    this._snapCloseDist = 28;
    this._minLengthPx = 900;       // mínimo (en px de pantalla, antes de exportar)
    this._lastValidation = null;

    // Export
    this._draftKey = 'tdr2:trackDraft';
  }

  create() {
    super.create();
    const { width, height } = this.scale;

    // Fondo
    this.cameras.main.setBackgroundColor('#1b6bff');

    // --- Responsive flags ---
    const isNarrow = width < 520;
    const uiScale = isNarrow ? 0.70 : 1.0;
    const S = (n) => Math.floor(n * uiScale);

    // Header real (para que sidebar use más alto útil)
    const headerTop = isNarrow ? 10 : 16;
    const titleY = isNarrow ? 46 : 54;
    const subY = isNarrow ? 72 : 82;
    const headerBottom = isNarrow ? 92 : 104; // 👈 aquí ganamos altura arriba

    // --- Flecha atrás ---
    const backSize = isNarrow ? 40 : 44;
    const backX = isNarrow ? 12 : 16;
    const backY = headerTop;

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

    backHit.on('pointerdown', () => this.scene.start('admin-hub'));

    // --- Layout (Canvas 3:2 + Sidebar) ---
    const pad = isNarrow ? 12 : 16;
    const gap = isNarrow ? 10 : 14;
    const round = isNarrow ? 16 : 18;

    // Sidebar (un pelín más estrecho en iPhone)
    const sideW = Math.floor(
      Math.max(isNarrow ? 200 : 220, Math.min(isNarrow ? 280 : 320, width * (isNarrow ? 0.30 : 0.28)))
    );
    const sideX = Math.floor(width - pad - sideW);

    // 👇 Arrancamos más arriba para usar todo el alto (sin ese hueco “muerto”)
    const sideY = headerBottom + S(8);
    const sideH = Math.floor(height - sideY - pad);

    // Canvas (a la izquierda del sidebar)
    const canvasX = pad;
    const canvasY = sideY; // 👈 alineado con sidebar
    const canvasMaxW = Math.floor(sideX - gap - canvasX);
    const canvasMaxH = Math.floor(height - canvasY - pad);

    // Ratio 3:2
    let drawW = canvasMaxW;
    let drawH = Math.floor(drawW / 1.5);
    if (drawH > canvasMaxH) {
      drawH = canvasMaxH;
      drawW = Math.floor(drawH * 1.5);
    }

    const drawX = Math.floor(canvasX + (canvasMaxW - drawW) / 2);
    const drawY = Math.floor(canvasY + (canvasMaxH - drawH) / 2);

    this._drawRect = new Phaser.Geom.Rectangle(drawX, drawY, drawW, drawH);

    // Panel canvas
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

    // Sidebar panel
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

    // --- Botones compactos (auto-layout vertical) ---
    const btnW = Math.floor(sideW - 36);
    const btnH = S(54);
    const btnGap = S(14);
    const btnX = Math.floor(sideX + (sideW - btnW) / 2);

    const makeSideBtn = (y, label, onClick, style = {}) => {
      const fill = style.fill ?? 0xffffff;
      const alpha = style.alpha ?? 0.18;
      const strokeAlpha = style.strokeAlpha ?? 0.45;

      const r = this.add.rectangle(btnX, y, btnW, btnH, fill, alpha)
        .setOrigin(0)
        .setStrokeStyle(2, 0xffffff, strokeAlpha)
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

    let y = Math.floor(sideY + S(46));

    // DIBUJAR
    this._ui.drawBtn = makeSideBtn(
      y,
      isNarrow ? 'DIBUJAR ON' : 'DIBUJAR: ON',
      () => {
        this._drawMode = !this._drawMode;
        this._ui.drawBtn.t.setText(this._drawMode
          ? (isNarrow ? 'DIBUJAR ON' : 'DIBUJAR: ON')
          : (isNarrow ? 'DIBUJAR OFF' : 'DIBUJAR: OFF')
        );
        this._ui.drawBtn.r.setAlpha(this._drawMode ? 1 : 0.6);
        this._ui.drawBtn.t.setAlpha(this._drawMode ? 1 : 0.75);
        if (!this._drawMode) this._isDrawing = false;
      }
    );
    y += btnH + btnGap;

    // BORRAR ÚLTIMO
    this._ui.undoBtn = makeSideBtn(
      y,
      isNarrow ? 'BORRAR' : 'BORRAR ÚLTIMO',
      () => {
        if (this._rawPoints.length > 0) {
          this._rawPoints.pop();
          this._rebuildClean();
          this._redraw();
        }
        this._refreshStats();
      }
    );
    y += btnH + btnGap;

    // LIMPIAR
    this._ui.clearBtn = makeSideBtn(
      y,
      'LIMPIAR',
      () => {
        this._isDrawing = false;
        this._rawPoints.length = 0;
        this._cleanPoints.length = 0;
        this._lastValidation = null;
        this._gOverlay.clear();
        this._redraw();
        this._refreshStats();
        this._setReport({ ok: false, errors: ['Sin validar'], warnings: [] });
      }
    );
    y += btnH + btnGap;

    // VALIDAR
    this._ui.validateBtn = makeSideBtn(
      y,
      'VALIDAR',
      () => {
        const rep = this._validateTrack();
        this._lastValidation = rep;
        this._setReport(rep);

        // feedback visual en botón
        if (rep.ok) {
          this._ui.validateBtn.r.setFillStyle(0x2ad57a, 0.22);
          this._ui.validateBtn.r.setStrokeStyle(2, 0x2ad57a, 0.70);
        } else {
          this._ui.validateBtn.r.setFillStyle(0xff4d4d, 0.18);
          this._ui.validateBtn.r.setStrokeStyle(2, 0xff4d4d, 0.70);
        }
      },
      { fill: 0xffffff, alpha: 0.18 }
    );
    y += btnH + S(12);

    // GUARDAR (solo si OK)
    this._ui.saveBtn = makeSideBtn(
      y,
      'GUARDAR',
      async () => {
        const rep = this._lastValidation || this._validateTrack();
        this._lastValidation = rep;
        this._setReport(rep);

        if (!rep.ok) {
          this._flashToast('No se puede guardar: valida la pista primero.', false);
          return;
        }

        const spec = this._buildTrackSpecFromClean();
        if (!spec) {
          this._flashToast('No se pudo generar TrackSpec.', false);
          return;
        }

        try {
          localStorage.setItem(this._draftKey, JSON.stringify(spec));
        } catch (e) {
          this._flashToast('Error guardando en localStorage.', false);
          return;
        }

        // intenta copiar al portapapeles
        try {
          const txt = JSON.stringify(spec, null, 2);
          if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(txt);
          this._flashToast('Guardado ✅ (y copiado al portapapeles)', true);
        } catch (e) {
          this._flashToast('Guardado ✅ (no se pudo copiar)', true);
        }
      },
      { fill: 0x2ad57a, alpha: 0.18, strokeAlpha: 0.70 }
    );

    y += btnH + S(18);

    // --- Slider ancho pista ---
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

    // Stats + report
    this._ui.stats = this.add.text(sideX + 18, trackY + sliderH + S(18), 'Puntos: 0', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: `${S(13)}px`,
      color: '#ffffff'
    }).setAlpha(0.85).setDepth(61);

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

    // --- Título (centrado sobre el canvas) ---
    const titleX = this._drawRect.x + this._drawRect.width / 2;

    this.add.text(titleX, titleY, 'EDITOR DE PISTAS', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: isNarrow ? '22px' : '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(titleX, subY, 'Admin Tool · Dibuja el trazado y valida la pista', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: isNarrow ? '11px' : '12px',
      color: '#e8f0ff'
    }).setOrigin(0.5).setAlpha(0.9);

    // Layers de dibujo
    this._gRaw = this.add.graphics().setDepth(10);
    this._gClean = this.add.graphics().setDepth(11);
    this._gOverlay = this.add.graphics().setDepth(12);

    // Input
    this.input.addPointer(1);

    this.input.on('pointerdown', (p) => {
      if (!this._drawMode) return;

      if (this._drawRect && !this._drawRect.contains(p.worldX, p.worldY)) {
        this._isDrawing = false;
        return;
      }

      this._isDrawing = true;

      // Continuar trazo sin borrar
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

    // Estado inicial
    this._refreshStats();
    this._setReport({ ok: false, errors: ['Sin validar'], warnings: [] });
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
    // Fase 1: copia directa (luego metemos resample/smooth pro)
    this._cleanPoints = this._rawPoints.slice();
  }

  _redraw() {
    this._gRaw.clear();
    this._gClean.clear();
    this._gOverlay.clear();

    // RAW
    if (this._rawPoints.length >= 2) {
      this._gRaw.lineStyle(3, 0xffffff, 0.25);
      this._gRaw.beginPath();
      this._gRaw.moveTo(this._rawPoints[0].x, this._rawPoints[0].y);
      for (let i = 1; i < this._rawPoints.length; i++) {
        this._gRaw.lineTo(this._rawPoints[i].x, this._rawPoints[i].y);
      }
      this._gRaw.strokePath();
    }

    // CLEAN preview “gordo”
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

    // Overlay de validación si existe
    if (this._lastValidation) this._drawValidationOverlay(this._lastValidation);
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
    if (!this._ui?.report) return;

    const okLine = rep.ok ? '✅ OK' : '❌ ERRORES';
    const parts = [okLine];

    if (rep.ok) {
      if (rep.lengthPx != null) parts.push(`Longitud: ${Math.round(rep.lengthPx)}px`);
      if (rep.closed != null) parts.push(rep.closed ? 'Cierre: OK' : 'Cierre: NO');
      if (rep.crossings != null) parts.push(rep.crossings === 0 ? 'Sin cruces' : `Cruces: ${rep.crossings}`);
    } else {
      for (const e of (rep.errors || [])) parts.push(`• ${e}`);
    }

    if (rep.warnings?.length) {
      parts.push('⚠️ Avisos:');
      for (const w of rep.warnings) parts.push(`• ${w}`);
    }

    this._ui.report.setText(parts.join('\n'));
  }

  _flashToast(msg, ok = true) {
    // Mini toast abajo a la izquierda del canvas
    if (this._ui.toast) {
      this._ui.toast.destroy();
      this._ui.toast = null;
    }
    const x = this._drawRect.x + 18;
    const y = this._drawRect.y + this._drawRect.height - 18;

    this._ui.toast = this.add.text(x, y, msg, {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: ok ? 'rgba(42,213,122,0.35)' : 'rgba(255,77,77,0.35)',
      padding: { left: 10, right: 10, top: 6, bottom: 6 }
    }).setOrigin(0, 1).setDepth(300);

    this.tweens.add({
      targets: this._ui.toast,
      alpha: 0,
      duration: 1400,
      delay: 900,
      onComplete: () => {
        if (this._ui.toast) {
          this._ui.toast.destroy();
          this._ui.toast = null;
        }
      }
    });
  }

  // --------------------------
  // VALIDACIÓN
  // --------------------------
  _validateTrack() {
    const pts = (this._cleanPoints || []).slice();
    const errors = [];
    const warnings = [];

    if (pts.length < 3) {
      errors.push('Necesitas más puntos.');
      return { ok: false, errors, warnings, closed: false, lengthPx: 0, crossings: 0 };
    }

    // Snap-to-close
    const a = pts[0];
    const b = pts[pts.length - 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);

    let closed = false;
    if (d <= this._snapCloseDist) {
      // cerramos “de verdad”
      pts[pts.length - 1] = { x: a.x, y: a.y };
      closed = true;
    } else {
      errors.push(`Cierre: termina más cerca del inicio (≤ ${this._snapCloseDist}px).`);
    }

    // Longitud mínima
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    if (len < this._minLengthPx) errors.push(`Longitud insuficiente (mín ${this._minLengthPx}px).`);

    // Intersecciones (segmento vs segmento, saltando vecinos)
    let crossings = 0;
    const segCount = pts.length - 1; // con cierre, último vuelve a 0
    for (let i = 0; i < segCount; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      for (let j = i + 1; j < segCount; j++) {
        // saltar el mismo segmento y adyacentes
        if (Math.abs(i - j) <= 1) continue;
        // saltar primero/último adyacentes en cerrado
        if (i === 0 && j === segCount - 1) continue;

        const q1 = pts[j];
        const q2 = pts[j + 1];
        if (this._segmentsIntersect(p1, p2, q1, q2)) crossings++;
      }
    }

    // Si hay cruces, es error
    if (crossings > 0) errors.push(`Cruces detectados: ${crossings}`);

    const ok = errors.length === 0;

    const rep = {
      ok,
      errors,
      warnings,
      closed,
      lengthPx: len,
      crossings,
      pts // guardamos para overlay
    };

    return rep;
  }

  _segmentsIntersect(a, b, c, d) {
    // Intersección robusta básica (orientaciones)
    const o1 = this._orient(a, b, c);
    const o2 = this._orient(a, b, d);
    const o3 = this._orient(c, d, a);
    const o4 = this._orient(c, d, b);

    if (o1 === 0 && this._onSegment(a, c, b)) return true;
    if (o2 === 0 && this._onSegment(a, d, b)) return true;
    if (o3 === 0 && this._onSegment(c, a, d)) return true;
    if (o4 === 0 && this._onSegment(c, b, d)) return true;

    return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
  }

  _orient(a, b, c) {
    // cross((b-a),(c-a))
    const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(v) < 1e-6) return 0;
    return v > 0 ? 1 : -1;
  }

  _onSegment(a, p, b) {
    return (
      Math.min(a.x, b.x) - 1e-6 <= p.x && p.x <= Math.max(a.x, b.x) + 1e-6 &&
      Math.min(a.y, b.y) - 1e-6 <= p.y && p.y <= Math.max(a.y, b.y) + 1e-6
    );
  }

  _drawValidationOverlay(rep) {
    const g = this._gOverlay;
    g.clear();

    const pts = rep.pts || this._cleanPoints;
    if (!pts || pts.length < 2) return;

    // punto inicio
    g.fillStyle(0xff3b30, 0.95);
    g.fillCircle(pts[0].x, pts[0].y, 8);

    // marca cierre (si no cerrado, pintamos círculo al final)
    if (!rep.closed) {
      const last = pts[pts.length - 1];
      g.lineStyle(3, 0xff3b30, 0.9);
      g.strokeCircle(last.x, last.y, 12);
    } else {
      // si cerrado, pequeño check verde cerca del inicio
      g.lineStyle(3, 0x2ad57a, 0.95);
      g.strokeCircle(pts[0].x, pts[0].y, 14);
    }
  }

  // --------------------------
  // EXPORT / TRACKSPEC
  // --------------------------
  _buildTrackSpecFromClean() {
    // usar últimos puntos validados (sin duplicar cierre)
    let pts = (this._lastValidation?.pts || this._cleanPoints || []).slice();
    if (pts.length < 3) return null;

    // quitar duplicado si último == primero
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.001) pts = pts.slice(0, -1);

    // Convertir “pantalla->mundo”
    // estrategia: world = canvas * scale + margen (para que haya espacio alrededor)
    const scale = 10; // 👈 simple y muy útil: mundo grande para correr
    const margin = 600;

    const worldW = Math.round(this._drawRect.width * scale + margin * 2);
    const worldH = Math.round(this._drawRect.height * scale + margin * 2);

    const toWorld = (p) => ([
      Math.round((p.x - this._drawRect.x) * scale + margin),
      Math.round((p.y - this._drawRect.y) * scale + margin)
    ]);

    const centerline = pts.map(toWorld);

    // TrackWidth “real” en mundo
    const trackWidth = Math.round(this._trackWidth * scale);

    // Start: primer segmento
    const p0 = centerline[0];
    const p1 = centerline[1] || centerline[0];
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const rot = Math.atan2(dy, dx);

    // Finish line: perpendicular al primer segmento en p0
    const segLen = Math.hypot(dx, dy) || 1;
    const nx = -dy / segLen;
    const ny = dx / segLen;
    const half = Math.round(trackWidth * 0.60);

    const finishA = [Math.round(p0[0] + nx * half), Math.round(p0[1] + ny * half)];
    const finishB = [Math.round(p0[0] - nx * half), Math.round(p0[1] - ny * half)];

    // (Opcional) precomputar ribbon aquí si quisieras, pero lo normal es en RaceScene.
    // Aun así, comprobamos que buildTrackRibbon lo acepta:
    try {
      buildTrackRibbon({ centerline, trackWidth });
    } catch (e) {
      // si esto falla, algo raro hay en datos
      return null;
    }

    const spec = {
      id: 'draft',
      name: 'Boceto',
      worldW,
      worldH,

      // Core compatible con TrackBuilder
      centerline,
      trackWidth,

      // Meta útil
      start: { x: p0[0], y: p0[1], rot },
      finish: { a: finishA, b: finishB },

      // Flags / versión
      version: 1,
      createdAt: Date.now()
    };

    return spec;
  }
}
