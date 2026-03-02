import Phaser from 'phaser';
import { BaseScene } from './BaseScene.js';

export class AdminHubScene extends BaseScene {
  constructor() {
    super('admin-hub');
  }

  create() {
  super.create(); // 👈 primera línea siempre
  const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#0b1020');

    const title = this.add.text(width / 2, 60, 'ADMIN HUB', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '24px',
      color: '#2bff88',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const makeBtn = (y, label, cb) => {
      const w = 260;
      const h = 60;
      const x = width / 2 - w / 2;

      const bg = this.add.rectangle(x, y, w, h, 0x141b33, 0.9)
        .setOrigin(0)
        .setStrokeStyle(2, 0x2bff88, 0.6)
        .setInteractive({ useHandCursor: true });

      const txt = this.add.text(width / 2, y + h / 2, label, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      bg.on('pointerdown', cb);
    };

    makeBtn(140, 'Editar coches', () => {
  this.scene.start('GarageScene', { mode: 'admin' });
});

makeBtn(220, 'Editar pistas', () => {
  this.scene.start('TrackEditorScene');
});

makeBtn(300, 'Salir ADMIN', () => {
  try { localStorage.setItem('tdr2:admin', '0'); } catch {}
  this.scene.start('menu', { forcePlayer: true });
});
  }
}
