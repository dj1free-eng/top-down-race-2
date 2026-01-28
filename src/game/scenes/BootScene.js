import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
// Precarga mínima (logo/splash y UI esenciales)
this.load.image('logo', 'assets/logo.webp');
    // Materiales (overlay sutil de asfalto)
    this.load.image('asphaltOverlay', 'assets/textures/texture-asphalt-overlay.webp');
// Start lights (7 estados: base + 6 rojas)
this.load.image('start_base', 'assets/startlights/start_base.png');
this.load.image('start_l1', 'assets/startlights/start_l1.png');
this.load.image('start_l2', 'assets/startlights/start_l2.png');
this.load.image('start_l3', 'assets/startlights/start_l3.png');
this.load.image('start_l4', 'assets/startlights/start_l4.png');
this.load.image('start_l5', 'assets/startlights/start_l5.png');
this.load.image('start_l6', 'assets/startlights/start_l6.png');
    // Barra de carga simple
    const { width, height } = this.scale;
    const barW = Math.min(520, Math.floor(width * 0.7));
    const barH = 10;
    const x = (width - barW) / 2;
    const y = Math.floor(height * 0.72);

    const outline = this.add
      .rectangle(x + barW / 2, y, barW, barH, 0x0b1020, 0)
      .setStrokeStyle(1, 0xb7c0ff, 0.35);

    const fill = this.add
      .rectangle(x, y, 0, barH - 2, 0x2bff88, 0.9)
      .setOrigin(0, 0.5);

    this.load.on('progress', (p) => {
      fill.width = Math.max(2, Math.floor((barW - 2) * p));
    });

    this.load.on('complete', () => {
      outline.destroy();
    });
  }

  create() {
  const { width, height } = this.scale;
  const cam = this.cameras.main;

  cam.setBackgroundColor('#000000');
  cam.fadeIn(900, 0, 0, 0);

  // Logo centrado
  const logo = this.add.image(width / 2, height * 0.38, 'logo')
  .setScale(0.42)
  .setAlpha(0);

  // Fade-in del logo
  this.tweens.add({
  targets: logo,
  alpha: 1,
  duration: 1400,
  ease: 'Sine.easeOut',
  delay: 350
});

  // Destello recorriendo el contorno
  const glow = this.add.rectangle(
    logo.x,
    logo.y,
    logo.displayWidth + 10,
    logo.displayHeight + 10,
    0xffffff,
    0
  ).setStrokeStyle(3, 0x2bff88, 0.0);

  this.tweens.add({
    targets: glow,
    alpha: { from: 0, to: 1 },
    duration: 300,
    delay: 1700,
    yoyo: true,
    repeat: 1
  });

  // Flash final / "explosión"
  this.time.delayedCall(2400, () => {
  cam.flash(220, 43, 255, 136);
});


  // Entrada al juego
  this.time.delayedCall(2700, () => {
  this.scene.start('menu');
})
}
}
