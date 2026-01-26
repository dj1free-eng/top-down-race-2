import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    // Precarga mínima (logo/splash y UI esenciales) y semaforo. 
    this.load.svg('logo', 'assets/logo.svg', { width: 256, height: 256 });
this.load.image('startlights_f1', 'assets/startlights_f1.png');
    // Barra de carga simple
    const { width, height } = this.scale;
    const barW = Math.min(520, Math.floor(width * 0.7));
    const barH = 10;
    const x = (width - barW) / 2;
    const y = Math.floor(height * 0.72);

    this.add
      .rectangle(width / 2, height / 2 - 70, 260, 260, 0x0b1020, 0)
      .setStrokeStyle(2, 0x2bff88, 0.35);

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

    this.cameras.main.setBackgroundColor('#0b1020');
    this.add.image(width / 2, height / 2 - 70, 'logo').setScale(0.9);

    const t1 = this.add.text(width / 2, height * 0.72 - 26, 'Cargando…', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#b7c0ff'
    }).setOrigin(0.5);

    this.time.delayedCall(450, () => {
      t1.destroy();
      this.scene.start('menu');
    });
  }
}
