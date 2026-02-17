import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';

const SKIN_BASE = 'assets/skins/';

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

export class GarageDetailScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GarageDetailScene' });
  }

  init(data) {
    this._carId = data?.carId || null;
    this._skinImg = null;
    this._toastText = null;
    this._toastTimer = null;
  }

  create() {
    const { width, height } = this.scale;
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

    back.on('pointerdown', () => this.scene.start('GarageScene'));

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
    const bottomSafe = 120;
    const gap = 18;
    const topSafe = nameText.y + nameText.height + 18;

    const panelH = 210;
    const panelW = Math.min(420, width - 30);
    const panelX = Math.floor(width / 2 - panelW / 2);

    const btnY = height - 110;

    let panelY = Math.floor(btnY - 20 - panelH);

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
    const pShadow = this.add.rectangle(panelX + 8, panelY + 10, panelW, panelH, 0x000000, 0.22).setOrigin(0);
    const panel = this.add.rectangle(panelX, panelY, panelW, panelH, 0xffffff, 0.22)
      .setOrigin(0)
      .setStrokeStyle(6, 0xffffff, 0.35);

    // ✅ estos números ya son los del spec efectivo (guardado)
    // ===============================
// STATS (C): Jugador + Técnicas
// ===============================
const ds = spec.designStats || {};
const playerRows = [
  { label: 'VELOCIDAD', key: 'VEL', value: ds.VEL },
  { label: 'ACELERACIÓN', key: 'ACC', value: ds.ACC },
  { label: 'FRENADA', key: 'FRN', value: ds.FRN },
  { label: 'GIRO', key: 'GIR', value: ds.GIR },
  { label: 'ESTABILIDAD', key: 'EST', value: ds.EST },
];

// Técnicas (para ti): formateo corto
const fmt = (v, d = 1) => (Number.isFinite(v) ? Number(v).toFixed(d) : '—');

const techRows = [
  { label: 'maxFwd', value: fmt(spec.maxFwd, 1) },
  { label: 'accel', value: fmt(spec.accel, 1) },
  { label: 'brake', value: fmt(spec.brakeForce, 1) },
  { label: 'turn', value: fmt(spec.turnRate, 2) },
  { label: 'grip', value: fmt(spec.gripDrive, 2) },
];

// --- Render: Player (grande) ---
playerRows.forEach((r, i) => {
  const y = panelY + 18 + i * 30;

  const v = Number.isFinite(r.value) ? Math.round(r.value) : null;
  const vTxt = (v === null) ? '—' : String(v);

  // Label izquierda
  this.add.text(panelX + 18, y, r.label, {
    fontFamily: 'system-ui',
    fontSize: '14px',
    fontStyle: '900',
    color: '#fff',
    stroke: '#0a2a6a',
    strokeThickness: 6
  }).setOrigin(0, 0);

  // Número derecha (0–99)
  this.add.text(panelX + panelW - 18, y, vTxt, {
    fontFamily: 'Orbitron, system-ui',
    fontSize: '16px',
    fontStyle: '900',
    color: '#fff',
    stroke: '#0a2a6a',
    strokeThickness: 6
  }).setOrigin(1, 0);
});

// --- Render: Técnicas (pequeñito abajo) ---
const techStartY = panelY + panelH - 52;
const techLineH = 12;

this.add.text(panelX + 18, techStartY - 12, 'TÉCNICO', {
  fontFamily: 'system-ui',
  fontSize: '11px',
  fontStyle: '900',
  color: '#ffffff',
  stroke: '#0a2a6a',
  strokeThickness: 5,
  alpha: 0.85
}).setOrigin(0, 0);

techRows.forEach((r, i) => {
  const y = techStartY + i * techLineH;

  this.add.text(panelX + 18, y, `${r.label}:`, {
    fontFamily: 'system-ui',
    fontSize: '11px',
    fontStyle: '800',
    color: '#ffffff',
    stroke: '#0a2a6a',
    strokeThickness: 5,
    alpha: 0.75
  }).setOrigin(0, 0);

  this.add.text(panelX + panelW - 18, y, String(r.value), {
    fontFamily: 'Orbitron, system-ui',
    fontSize: '11px',
    fontStyle: '900',
    color: '#ffffff',
    stroke: '#0a2a6a',
    strokeThickness: 5,
    alpha: 0.75
  }).setOrigin(1, 0);
});

    // --- Botones grandes (móvil) ---
    // ✅ EDITAR -> TUNEAR (futuro: tienda de upgrades)
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
