import Phaser from 'phaser';

export class UpgradeShopScene extends Phaser.Scene {
  constructor() {
    super('upgrade-shop');
  }

  create() {
    const { width, height } = this.scale;

    // Fondo
    this.cameras.main.setBackgroundColor('#101623');

    // Título
    this.add.text(width / 2, 40, 'UPGRADE SHOP', {
      fontFamily: 'Orbitron, Arial',
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Panel central (boceto visual)
    const panel = this.add.rectangle(
      width / 2,
      height / 2,
      width * 0.8,
      height * 0.6,
      0x1e2a3a
    ).setStrokeStyle(2, 0x00d9ff);

    // Texto provisional
    this.add.text(width / 2, height / 2 - 60, 'Engine Upgrade\nComing Soon...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);

    // Botón volver
    const backBtn = this.add.text(width / 2, height - 60, '← BACK TO MENU', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#00d9ff'
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.scene.start('menu');
    });
  }
}
