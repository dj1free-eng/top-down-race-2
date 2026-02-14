import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';

const CARD_BASE = 'assets/cars/runtime/'; // donde están tus card_*.webp

export class GarageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GarageScene' });
  }

  create() {
    const { width, height } = this.scale;

    // Fondo vivo (no oscuro)
    this.cameras.main.setBackgroundColor('#1e78ff');

    // Header
    this.add.text(width / 2, 18, 'GARAJE', {
      fontFamily: 'Orbitron, system-ui, -apple-system, sans-serif',
      fontSize: '26px',
      fontStyle: '900',
      color: '#ffffff',
      stroke: '#0a2a6a',
      strokeThickness: 6
    }).setOrigin(0.5, 0);

    // Botón atrás
    const back = this.add.text(16, 18, '⬅', {
      fontFamily: 'system-ui',
      fontSize: '26px',
      color: '#fff',
      stroke: '#0a2a6a',
      strokeThickness: 6
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('MenuScene'));

    // Scroll container
    const topY = 70;
    const viewportH = height - topY - 20;

    const maskGfx = this.make.graphics({ x: 0, y: 0, add: false });
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(0, topY, width, viewportH);
    const mask = maskGfx.createGeometryMask();

    this._list = this.add.container(0, topY);
    this._list.setMask(mask);

    // Grid config (móvil first)
    const paddingX = 16;
    const gap = 14;
    const cols = Math.max(2, Math.floor((width - paddingX * 2 + gap) / (160 + gap)));
    const cardW = Math.floor((width - paddingX * 2 - gap * (cols - 1)) / cols);
    const cardH = Math.floor(cardW * 1.15);

    // Items
    const carIds = Object.keys(CAR_SPECS);
    let y = 0;

    carIds.forEach((carId, i) => {
      const spec = CAR_SPECS[carId];

      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = paddingX + col * (cardW + gap);
      y = row * (cardH + gap);

      this._createCard(x, y, cardW, cardH, carId, spec);
    });

    // Scroll bounds
    const contentH = y + cardH;
    this._scrollY = 0;
    this._minScroll = Math.min(0, viewportH - contentH);

    // Wheel scroll (desktop)
    this.input.on('wheel', (_p, _g, _dx, dy) => {
      this._setScroll(this._scrollY - dy * 0.6);
    });

    // Touch drag scroll (móvil)
    this.input.on('pointerdown', (p) => {
      this._dragStartY = p.y;
      this._dragStartScroll = this._scrollY;
    });

    this.input.on('pointermove', (p) => {
      if (!p.isDown) return;
      const delta = p.y - this._dragStartY;
      this._setScroll(this._dragStartScroll + delta);
    });
  }

  _setScroll(y) {
    this._scrollY = Phaser.Math.Clamp(y, this._minScroll, 0);
    this._list.y = 70 + this._scrollY;
  }

  _createCard(x, y, w, h, carId, spec) {
    const card = this.add.container(x, y);

    // Sombra
    const shadow = this.add.rectangle(6, 8, w, h, 0x000000, 0.25).setOrigin(0);

    // Panel
    const bg = this.add.rectangle(0, 0, w, h, 0xffffff, 0.22)
      .setOrigin(0)
      .setStrokeStyle(4, 0xffffff, 0.35);

    // Imagen card (si existe)
    const cardFile = spec.card || spec.cardFile || null; // por si ya lo tienes en spec
    const texKey = `card_${carId}`;
    if (cardFile) {
      const url = `${CARD_BASE}${cardFile}`;
      this.load.image(texKey, url);
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        if (!this.textures.exists(texKey)) return;

        const img = this.add.image(w / 2, h * 0.46, texKey);
        img.setDisplaySize(w * 0.92, h * 0.62);
        img.setDepth(2);
        card.add(img);
      });
      this.load.start();
    } else {
      // Placeholder colorido
      const ph = this.add.rectangle(w / 2, h * 0.46, w * 0.92, h * 0.62, 0xffd200, 0.8);
      ph.setStrokeStyle(4, 0xffffff, 0.8);
      card.add(ph);
    }

    // Nombre
    const name = spec.name || carId;
    const label = this.add.text(w / 2, h - 50, name.toUpperCase(), {
      fontFamily: 'Orbitron, system-ui',
      fontSize: '14px',
      fontStyle: '900',
      color: '#ffffff',
      stroke: '#0a2a6a',
      strokeThickness: 6,
      align: 'center',
      wordWrap: { width: w - 18 }
    }).setOrigin(0.5, 0);

    // Sub (rarity/category)
    const sub = `${(spec.rarity || '—').toUpperCase()} · ${(spec.category || '—').toUpperCase()}`;
    const subtitle = this.add.text(w / 2, h - 22, sub, {
      fontFamily: 'system-ui',
      fontSize: '12px',
      fontStyle: '800',
      color: '#ffffff',
      stroke: '#0a2a6a',
      strokeThickness: 5
    }).setOrigin(0.5, 0.5);

    // Interacción
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => {
      this.cameras.main.flash(80, 255, 255, 255);
      this.scene.start('GarageDetailScene', { carId });
    });

    card.add([shadow, bg, label, subtitle]);
    this._list.add(card);
  }
}
