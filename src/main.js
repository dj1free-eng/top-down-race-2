import Phaser from 'phaser';

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      // OJO: relativa al base path de GH Pages
      await navigator.serviceWorker.register('./sw.js');
    } catch (e) {
      // Sin “magia”: si falla, que la app siga funcionando online
      console.warn('SW register failed', e);
    }
  });
}

class MinimalScene extends Phaser.Scene {
  constructor() {
    super('minimal');
  }
  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#0b1020');
    this.add.text(width / 2, height / 2 - 12, 'Top-Down Race 2', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 22, 'PWA base OK (Vite + Phaser + SW)', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#b7c0ff'
    }).setOrigin(0.5);
  }
}

registerServiceWorker();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 720,
  backgroundColor: '#0b1020',
  scene: [MinimalScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});
