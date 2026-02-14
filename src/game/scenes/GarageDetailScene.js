import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';

const SKIN_BASE = 'assets/skins/';

export class GarageDetailScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GarageDetailScene' });
  }

  init(data) {
    this._carId = data?.carId || null;
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#2aa8ff');

    const spec = this._carId ? CAR_SPECS[this._carId] : null;

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

    // Nombre grande (WOW)
    this.add.text(width / 2, 62, (spec.name || this._carId).toUpperCase(), {
      fontFamily: 'Orbitron, system-ui',
      fontSize: '22px',
      fontStyle: '900',
      color: '#fff',
      stroke: '#0a2a6a',
      strokeThickness: 7,
      align: 'center',
      wordWrap: { width: width - 30 }
    }).setOrigin(0.5, 0);

    // Skin (si existe)
    const skinFile = spec.skin || null;
    if (skinFile) {
      const key = `skin_${this._carId}`;
      this.load.image(key, `${SKIN_BASE}${skinFile}`);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        if (!this.textures.exists(key)) return;
        const img = this.add.image(width / 2, 210, key);
        img.setDisplaySize(Math.min(280, width * 0.75), Math.min(280, width * 0.75));
      });
      this.load.start();
    } else {
      const ph = this.add.rectangle(width / 2, 210, Math.min(280, width * 0.75), Math.min(280, width * 0.75), 0xffd200, 0.8);
      ph.setStrokeStyle(6, 0xffffff, 0.85);
    }

    // Stats tipo tarjeta (simple y visible)
    const panelY = 360;
    const panelW = Math.min(420, width - 30);
    const panelX = width / 2 - panelW / 2;

    const pShadow = this.add.rectangle(panelX + 8, panelY + 10, panelW, 210, 0x000000, 0.22).setOrigin(0);
    const panel = this.add.rectangle(panelX, panelY, panelW, 210, 0xffffff, 0.22).setOrigin(0).setStrokeStyle(6, 0xffffff, 0.35);

    const rows = [
      ['MAX FWD', spec.maxFwd],
      ['ACCEL', spec.accel],
      ['BRAKE', spec.brakeForce],
      ['TURN', spec.turnRate],
      ['GRIP', spec.gripDrive],
    ];

    rows.forEach((r, i) => {
      const y = panelY + 20 + i * 36;
      this.add.text(panelX + 18, y, r[0], {
        fontFamily: 'system-ui',
        fontSize: '14px',
        fontStyle: '900',
        color: '#fff',
        stroke: '#0a2a6a',
        strokeThickness: 6
      }).setOrigin(0, 0);

      this.add.text(panelX + panelW - 18, y, String(r[1] ?? '—'), {
        fontFamily: 'Orbitron, system-ui',
        fontSize: '14px',
        fontStyle: '900',
        color: '#fff',
        stroke: '#0a2a6a',
        strokeThickness: 6
      }).setOrigin(1, 0);
    });

    // Botones grandes (móvil)
    const btnY = height - 110;
    this._bigButton(width / 2 - 160, btnY, 150, 70, 'EDITAR', () => {
      // En el siguiente paso lo conectamos a editor simple (modal o sliders)
      this.cameras.main.shake(120, 0.004);
    });

    this._bigButton(width / 2 + 10, btnY, 150, 70, 'PROBAR', () => {
      // Lanzamos RaceScene con el coche seleccionado
      this.scene.start('RaceScene', { selectedCarId: this._carId });
    });
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
}
