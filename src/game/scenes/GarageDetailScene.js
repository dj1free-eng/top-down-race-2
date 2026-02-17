import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';

const SKIN_BASE = 'assets/skins/';
// ===============================
// STATS DERIVADAS (Arcade pero reales)
// - Se calculan desde físicas del spec efectivo
// - Rangos = min/max reales sacados de CAR_SPECS (fábrica)
// ===============================

const KMH_PER_PXPS = 0.10; // 1000 px/s -> ~100 km/h (tu objetivo)

const clamp01 = (t) => Math.max(0, Math.min(1, t));

function norm01(v, min, max) {
  if (!Number.isFinite(v) || !Number.isFinite(min) || !Number.isFinite(max) || max === min) return 0;
  return clamp01((v - min) / (max - min));
}

function to99(t01) {
  // 1..99 (evita 0, queda más “juego”)
  return Math.round(1 + clamp01(t01) * 98);
}

function computeFactoryRanges() {
  const fields = [
    'maxFwd',
    'accel',
    'brakeForce',
    'turnRate',
    'turnMin',
    'gripDrive',
    'gripCoast',
    'gripBrake'
  ];

  const ranges = {};
  for (const f of fields) ranges[f] = { min: Infinity, max: -Infinity };

  for (const spec of Object.values(CAR_SPECS || {})) {
    if (!spec || typeof spec !== 'object') continue;

    for (const f of fields) {
      const v = spec[f];
      if (!Number.isFinite(v)) continue;
      ranges[f].min = Math.min(ranges[f].min, v);
      ranges[f].max = Math.max(ranges[f].max, v);
    }
  }

  // sane defaults (por si un día falta algún campo en fábrica)
  for (const f of fields) {
    if (!Number.isFinite(ranges[f].min) || !Number.isFinite(ranges[f].max) || ranges[f].min === Infinity) {
      ranges[f] = { min: 0, max: 1 };
    }
  }

  return ranges;
}

// calculamos una vez por módulo (barato)
const FACTORY_R = computeFactoryRanges();

function computeDesignStatsFromPhysics(spec) {
  // Normalizados (0..1) usando rangos reales de fábrica
  const nMaxFwd = norm01(spec.maxFwd, FACTORY_R.maxFwd.min, FACTORY_R.maxFwd.max);
  const nAccel  = norm01(spec.accel,  FACTORY_R.accel.min,  FACTORY_R.accel.max);
  const nBrake  = norm01(spec.brakeForce, FACTORY_R.brakeForce.min, FACTORY_R.brakeForce.max);

  const nTurnRate = norm01(spec.turnRate, FACTORY_R.turnRate.min, FACTORY_R.turnRate.max);
  const nTurnMin  = norm01(spec.turnMin,  FACTORY_R.turnMin.min,  FACTORY_R.turnMin.max);

  const nGripD = norm01(spec.gripDrive, FACTORY_R.gripDrive.min, FACTORY_R.gripDrive.max);
  const nGripC = norm01(spec.gripCoast, FACTORY_R.gripCoast.min, FACTORY_R.gripCoast.max);
  const nGripB = norm01(spec.gripBrake, FACTORY_R.gripBrake.min, FACTORY_R.gripBrake.max);

  // 5 stats jugador:
  // - VELOCIDAD: maxFwd (directo)
  // - ACELERACIÓN: accel (directo)
  // - FRENADA: brakeForce (directo)
  // - GIRO: turnRate alto + turnMin bajo (más giro a alta velocidad)
  // - ESTABILIDAD: grips (principalmente gripCoast, luego brake/drive)
  const VEL = to99(nMaxFwd);
  const ACC = to99(nAccel);
  const FRN = to99(nBrake);

  const giro01 = clamp01(nTurnRate * 0.70 + (1 - nTurnMin) * 0.30);
  const GIR = to99(giro01);

  const est01 = clamp01(nGripC * 0.60 + nGripB * 0.20 + nGripD * 0.20);
  const EST = to99(est01);

  return { VEL, ACC, FRN, GIR, EST };
}

// ===== Spec efectivo (fábrica + guardado) =====
function lsKey(carId) {
  return `tdr2:carSpecs:${carId}`;
}

function readSavedSpec(carId) {
  try {
    const raw = localStorage.getItem(lsKey(carId));
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch {
    return {};
  }
}

function getEffectiveCarSpec(carId) {
  const factory = CAR_SPECS[carId] || CAR_SPECS.stock;
  const saved = readSavedSpec(carId);
  return { ...factory, ...saved };
}

// ===== Telemetría (medida en pista) =====
function readTopSpeedPxps(carId) {
  try {
    const raw = localStorage.getItem(`tdr2:telemetry:topSpeedPxps:${carId}`);
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export class GarageDetailScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GarageDetailScene' });
  }

  init(data) {
  this._carId = data?.carId || null;
  this._mode = (data && data.mode === 'admin') ? 'admin' : 'player';
  this._skinImg = null;
  this._toastText = null;
  this._toastTimer = null;
}

  create() {
    const { width, height } = this.scale;
    const isAdmin = this._mode === 'admin';

    this.cameras.main.setBackgroundColor('#2aa8ff');

    // ✅ spec EFECTIVO (incluye edits guardados)
    const spec = this._carId ? getEffectiveCarSpec(this._carId) : null;

    // Header
    this.add.text(width / 2, 18, 'FICHA', {
      fontFamily: 'Orbitron, system-ui',
      fontSize: '24px',
      fontStyle: '900',
      color: '#fff',
      stroke: '#0a2a6a',
      strokeThickness: 6
    }).setOrigin(0.5, 0);

    // Back
    const back = this.add.text(16, 18, '⬅', {
      fontFamily: 'system-ui',
      fontSize: '26px',
      color: '#fff',
      stroke: '#0a2a6a',
      strokeThickness: 6
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });

back.on('pointerdown', () => this.scene.start('GarageScene', { mode: this._mode }));

    if (!spec) {
      this.add.text(width / 2, height / 2, 'Coche no encontrado', {
        fontFamily: 'system-ui',
        fontSize: '18px',
        color: '#fff',
        stroke: '#0a2a6a',
        strokeThickness: 6
      }).setOrigin(0.5);
      return;
    }

    // Nombre grande
    const nameText = this.add.text(width / 2, 62, (spec.name || this._carId).toUpperCase(), {
      fontFamily: 'Orbitron, system-ui',
      fontSize: '22px',
      fontStyle: '900',
      color: '#fff',
      stroke: '#0a2a6a',
      strokeThickness: 7,
      align: 'center',
      wordWrap: { width: width - 30 }
    }).setOrigin(0.5, 0);

    // --- Layout dinámico ---
    const gap = 18;
    const topSafe = nameText.y + nameText.height + 18;

    const panelH = 210;
    const panelW = Math.min(420, width - 30);
    const panelX = Math.floor(width / 2 - panelW / 2);

    const btnY = height - 110;
    const panelY = Math.floor(btnY - 20 - panelH);

    const skinAreaTop = topSafe;
    const skinAreaBottom = panelY - gap;
    const skinAreaH = Math.max(140, skinAreaBottom - skinAreaTop);
    const skinCenterY = Math.floor(skinAreaTop + skinAreaH / 2);

    // --- Skin ---
    const skinFile = spec.skin || null;

    if (skinFile) {
      const key = `skin_${this._carId}`;

      if (this.textures.exists(key)) {
        this._createSkinImage(width / 2, skinCenterY, key, width, skinAreaH);
      } else {
        this.load.image(key, `${SKIN_BASE}${skinFile}`);
        this.load.once(Phaser.Loader.Events.COMPLETE, () => {
          if (!this.textures.exists(key)) {
            this._toast(`No encuentro la skin: ${skinFile}`);
            return;
          }
          this._createSkinImage(width / 2, skinCenterY, key, width, skinAreaH);
        });
        this.load.start();
      }
    } else {
      const phW = Math.min(280, width * 0.75);
      const phH = Math.min(280, skinAreaH);
      const ph = this.add.rectangle(width / 2, skinCenterY, phW, phH, 0xffd200, 0.8);
      ph.setStrokeStyle(6, 0xffffff, 0.85);
    }

    // --- Panel stats ---
    this.add.rectangle(panelX + 8, panelY + 10, panelW, panelH, 0x000000, 0.22).setOrigin(0);
    this.add.rectangle(panelX, panelY, panelW, panelH, 0xffffff, 0.22)
      .setOrigin(0)
      .setStrokeStyle(6, 0xffffff, 0.35);

    // ===============================
    // STATS jugador (coherentes y “reales”)
    // ===============================
    const ds = computeDesignStatsFromPhysics(spec);

    // Velocidad máxima REAL: telemetría si existe, si no, techo teórico.
    const topPxps = readTopSpeedPxps(this._carId);
    const topKmh = (topPxps == null) ? null : (topPxps * KMH_PER_PXPS);
    const fallbackKmh = spec.maxFwd * KMH_PER_PXPS;
    const vMaxKmh = (topKmh != null) ? topKmh : fallbackKmh;

    const playerRows = [
      { label: 'VEL. MÁX.', value: Math.round(vMaxKmh), unit: 'km/h' },
      { label: 'ACELERACIÓN', value: ds.ACC },
      { label: 'FRENADA', value: ds.FRN },
      { label: 'GIRO', value: ds.GIR },
      { label: 'ESTABILIDAD', value: ds.EST }
    ];

    // --- Render: Player (grande) ---
    playerRows.forEach((r, i) => {
      const y = panelY + 18 + i * 30;

      const v = Number.isFinite(r.value) ? Math.round(r.value) : null;
      const vTxt = (v === null) ? '—' : String(v);
      const suffix = r.unit ? ` ${r.unit}` : '';

      this.add.text(panelX + 18, y, r.label, {
        fontFamily: 'system-ui',
        fontSize: '14px',
        fontStyle: '900',
        color: '#fff',
        stroke: '#0a2a6a',
        strokeThickness: 6
      }).setOrigin(0, 0);

      this.add.text(panelX + panelW - 18, y, `${vTxt}${suffix}`, {
        fontFamily: 'Orbitron, system-ui',
        fontSize: '16px',
        fontStyle: '900',
        color: '#fff',
        stroke: '#0a2a6a',
        strokeThickness: 6
      }).setOrigin(1, 0);
    });

    // --- Técnicas (solo ADMIN) ---
    if (isAdmin) {
      const fmt = (v, d = 2) => (Number.isFinite(v) ? Number(v).toFixed(d) : '—');
      const techLines = [
        `maxFwd: ${fmt(spec.maxFwd, 1)} px/s · ${fmt(spec.maxFwd * KMH_PER_PXPS, 0)} km/h`,
        `accel: ${fmt(spec.accel, 2)}  brakeForce: ${fmt(spec.brakeForce, 2)}`,
        `turnRate: ${fmt(spec.turnRate, 2)}  turnMin: ${fmt(spec.turnMin, 2)}`,
        `grip D/C/B: ${fmt(spec.gripDrive, 2)} / ${fmt(spec.gripCoast, 2)} / ${fmt(spec.gripBrake, 2)}`
      ];

      this.add.text(panelX + 18, panelY + panelH - 44, techLines.join('\n'), {
        fontFamily: 'system-ui',
        fontSize: '10px',
        fontStyle: '800',
        color: '#ffffff',
        stroke: '#0a2a6a',
        strokeThickness: 4,
        alpha: 0.85,
        lineSpacing: 2
      }).setOrigin(0, 0);
    }

    // --- Botones grandes (móvil) ---
    const tune = this._bigButton(width / 2 - 160, btnY, 150, 70, 'TUNEAR', () => {
      this._toast('Tienda de upgrades: próximamente 😈');

      if (this._skinImg) {
        this.tweens.add({
          targets: this._skinImg,
          scale: this._skinImg.scale * 1.03,
          duration: 120,
          yoyo: true,
          ease: 'Sine.easeInOut'
        });
      }
    });

    const test = this._bigButton(width / 2 + 10, btnY, 150, 70, 'PROBAR', () => {
      localStorage.setItem('tdr2:carId', this._carId);
      this.scene.start('race', { carId: this._carId });
    });

    tune.bg.setDepth(50);
    tune.tx.setDepth(51);
    tune.shadow.setDepth(49);

    test.bg.setDepth(50);
    test.tx.setDepth(51);
    test.shadow.setDepth(49);

    this._ensureToast();
  }

  _createSkinImage(cx, cy, key, width, maxHeight) {
    const img = this.add.image(cx, cy, key);

    const maxW = Math.min(320, width * 0.80);
    const maxH = Math.min(320, maxHeight);

    const scale = Math.min(
      maxW / img.width,
      maxH / img.height
    );

    img.setScale(scale);
    img.setDepth(10);

    this._skinImg = img;
  }

  _bigButton(x, y, w, h, label, onClick) {
    const shadow = this.add.rectangle(x + 6, y + 8, w, h, 0x000000, 0.22).setOrigin(0);
    const bg = this.add.rectangle(x, y, w, h, 0xffd200, 1).setOrigin(0).setStrokeStyle(6, 0xffffff, 0.85);
    const tx = this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: 'Orbitron, system-ui',
      fontSize: '18px',
      fontStyle: '900',
      color: '#1b1b1b'
    }).setOrigin(0.5);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => onClick());

    return { shadow, bg, tx };
  }

  _ensureToast() {
    if (this._toastText) return;
    this._toastText = this.add.text(this.scale.width / 2, this.scale.height - 18, '', {
      fontFamily: 'system-ui',
      fontSize: '14px',
      fontStyle: '900',
      color: '#ffffff',
      stroke: '#0a2a6a',
      strokeThickness: 6
    }).setOrigin(0.5, 1);
    this._toastText.setAlpha(0);
    this._toastText.setDepth(9999);
  }

  _toast(msg) {
    this._ensureToast();
    this._toastText.setText(String(msg));
    this._toastText.setAlpha(1);

    if (this._toastTimer) this._toastTimer.remove(false);
    this._toastTimer = this.time.delayedCall(1400, () => {
      if (!this._toastText) return;
      this.tweens.add({
        targets: this._toastText,
        alpha: 0,
        duration: 250,
        ease: 'Sine.easeOut'
      });
    });
  }
}
