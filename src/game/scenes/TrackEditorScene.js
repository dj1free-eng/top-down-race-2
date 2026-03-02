import Phaser from 'phaser';
import { BaseScene } from './BaseScene.js';

export class TrackEditorScene extends BaseScene {
  constructor() {
    super({ key: 'TrackEditorScene' });
  }

  create() {
    super.create(); // 👈 SIEMPRE primera línea
    const { width, height } = this.scale;

    // Fondo provisional (luego lo pondremos Brawl/arcade)
    this.cameras.main.setBackgroundColor('#1b6bff');

    // Título
    this.add.text(width / 2, 60, 'EDITOR DE PISTAS', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Nota provisional
    this.add.text(width / 2, 110, '(Fase 0: Scene conectada)', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#e8f0ff'
    }).setOrigin(0.5);

    // Botón volver
    const w = 260, h = 60;
    const x = width / 2 - w / 2;
    const y = Math.floor(height - 120);

    const bg = this.add.rectangle(x, y, w, h, 0xffffff, 0.25)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.7)
      .setInteractive({ useHandCursor: true });

    this.add.text(width / 2, y + h / 2, 'Volver a ADMIN', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    bg.on('pointerdown', () => {
      this.scene.start('admin-hub');
    });
  }
}
