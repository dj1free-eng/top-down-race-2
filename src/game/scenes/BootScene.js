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
  const cam = this.cameras.main;
  cam.setBackgroundColor('#000000');

  const { width, height } = this.scale;

  // Creamos un <video> HTML para iOS/Android (lo más robusto)
  const video = document.createElement('video');
  video.src = 'assets/intro/intro.mp4';
  video.muted = true;               // clave para autoplay en iOS
  video.playsInline = true;         // iOS: no abrir pantalla completa
  video.autoplay = true;
  video.preload = 'auto';
  video.controls = false;
  video.loop = false;

  // Estilo: cubrir pantalla sin deformar
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'contain';   // usa 'cover' si quieres que recorte
  video.style.background = '#000';

  // Phaser DOMElement (requiere dom.createContainer=true en config)
  const domEl = this.add.dom(width / 2, height / 2, video);
  domEl.setOrigin(0.5);
// Capa negra para fade-out final
const fadeRect = this.add.rectangle(
  width / 2,
  height / 2,
  width,
  height,
  0x000000,
  0
).setDepth(1000);
  // Si cambia el tamaño (RESIZE), re-centramos
  this.scale.on('resize', (gameSize) => {
    domEl.setPosition(gameSize.width / 2, gameSize.height / 2);
  });

  const cleanupAndGo = () => {
  // Fade a negro
  this.tweens.add({
    targets: fadeRect,
    alpha: 1,
    duration: 500,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      // Limpieza segura
      video.onended = null;
      video.onerror = null;

      try { video.pause(); } catch {}
      try { video.removeAttribute('src'); video.load(); } catch {}
      try { domEl.destroy(); } catch {}
      try { video.remove(); } catch {}

      this.scene.start('menu');
    }
  });
};

  // Cuando acaba el vídeo => menú
  video.onended = cleanupAndGo;

  // Si falla carga => menú (fallback)
  video.onerror = cleanupAndGo;

  // Intento de autoplay; si iOS lo bloquea, pedimos tap
  const tryPlay = () => {
    const p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        // Fallback: tap para iniciar
        const hint = this.add.text(width / 2, height * 0.8, 'Toca para empezar', {
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
          fontSize: '18px',
          color: '#ffffff'
        }).setOrigin(0.5);

        this.input.once('pointerdown', () => {
          hint.destroy();
          video.play().catch(() => cleanupAndGo());
        });
      });
    }
  };

  // Arranca
  tryPlay();

  // Seguridad: si por lo que sea no dispara ended (rarísimo), corta a los 7s
  this.time.delayedCall(7000, () => {
    // si sigue en pantalla y no ha cambiado de escena
    if (this.scene.isActive()) cleanupAndGo();
  });
}
}
