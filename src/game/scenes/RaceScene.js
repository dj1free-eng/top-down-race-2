import Phaser from 'phaser';

export class RaceScene extends Phaser.Scene {
  constructor() {
    super('race');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b1020');

    const text = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      'RaceScene OK\n(Build estable)',
      {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center'
      }
    ).setOrigin(0.5);

    // volver al menú con tap
    this.input.once('pointerdown', () => {
      this.scene.start('menu');
    });
  }
}
