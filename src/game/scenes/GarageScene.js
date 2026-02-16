import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';

const CARD_BASE = 'assets/cars/runtime/'; // donde están tus card_*.webp

export class GarageScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GarageScene' });
  }

  create() {
    const { width, height } = this.scale;
// Fondo base (Brawl-ish)
const bg = this.add.rectangle(0, 0, width, height, 0x2b7bff, 1).setOrigin(0);

// Animación sutil (respira)
this.tweens.add({
  targets: bg,
  alpha: { from: 0.92, to: 1 },
  duration: 1800,
  yoyo: true,
  repeat: -1,
  ease: 'Sine.easeInOut'
});
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
back.on('pointerdown', () => this.scene.start('menu'));

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
const carIds = Object.keys(CAR_SPECS).filter(id =>
  !['stock', 'touring', 'power'].includes(id)
);
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

  const raritySlug = (spec.rarity || 'comun')
    .toLowerCase()
    .replace(' ', '_')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const fileName =
    `card_${carId}_${raritySlug}_${String(spec.collectionNo || 0).padStart(3, '0')}.webp`;

  const url = `assets/cars/runtime/${fileName}`;
  const texKey = `card_${carId}`;

  this.load.image(texKey, url);

  this.load.once(Phaser.Loader.Events.COMPLETE, () => {

    if (!this.textures.exists(texKey)) return;

    const img = this.add.image(w / 2, h / 2, texKey);

    // Escalado proporcional (SIN deformar)
    const scale = Math.min(
      w / img.width,
      h / img.height
    );

    img.setScale(scale);

    card.add(img);

    // Interacción
    img.setInteractive({ useHandCursor: true });
    img.on('pointerdown', () => {
  this.cameras.main.flash(80, 255, 255, 255);

  if (this._mode === 'admin') {
    this.scene.start('car-editor', { carId });
  } else {
    this.scene.start('GarageDetailScene', { carId });
  }
});

  });

  this.load.start();

  this._list.add(card);
}
}
