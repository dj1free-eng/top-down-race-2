function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b1020');

    const { width, height } = this.scale;

    // Fondo sutil (grid/ruido “estilo UI” sin assets)
    const g = this.add.graphics();
    g.fillStyle(0x141b33, 0.65);
    g.fillRect(0, 0, width, height);

    g.lineStyle(1, 0xffffff, 0.03);
    const step = 48;
    for (let x = 0; x <= width; x += step) g.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += step) g.lineBetween(0, y, width, y);

    // Logo + títulos
    this.add.image(width / 2, Math.floor(height * 0.22), 'logo').setScale(0.55);

    this.add.text(width / 2, Math.floor(height * 0.36), 'Top-Down Race 2', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '34px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2, Math.floor(height * 0.36) + 32, 'Elige circuito (Fase 2: menú listo)', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#b7c0ff'
    }).setOrigin(0.5);

    // Cards
    const cardW = clamp(Math.floor(width * 0.34), 260, 420);
    const cardH = 170;
    const gap = 18;

    const totalW = cardW * 2 + gap;
    const leftX = Math.floor(width / 2 - totalW / 2);
    const topY = Math.floor(height * 0.48);

    const tracks = [
      {
        key: 'track01',
        title: 'Track 01 — Óvalo de velocidad',
        desc: 'Curvas largas, pista ancha.\nDiseñado para aprender a ir rápido sin morir.',
        tag: 'SPEED'
      },
      {
        key: 'track02',
        title: 'Track 02 — Técnico',
        desc: 'Chicane + horquilla + enlazadas.\nAquí se ve quién frena… y quién reza.',
        tag: 'TECH'
      }
    ];

    const toast = this.add.text(width / 2, Math.floor(height * 0.9), '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#2bff88'
    }).setOrigin(0.5).setAlpha(0);

    const makeCard = (x, y, t) => {
      const container = this.add.container(x, y);

      const bg = this.add.rectangle(0, 0, cardW, cardH, 0x0b1020, 0.35)
        .setStrokeStyle(1, 0xb7c0ff, 0.25)
        .setOrigin(0);

      // “Header” del card
      const header = this.add.rectangle(0, 0, cardW, 44, 0x0b1020, 0.55).setOrigin(0);
      const tag = this.add.text(cardW - 16, 13, t.tag, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '12px',
        color: '#b7c0ff',
        fontStyle: 'bold'
      }).setOrigin(1, 0);

      const title = this.add.text(16, 12, t.title, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: cardW - 32 }
      });

      const desc = this.add.text(16, 60, t.desc, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '13px',
        color: '#b7c0ff',
        lineSpacing: 5,
        wordWrap: { width: cardW - 32 }
      });

      const cta = this.add.text(16, cardH - 28, 'Seleccionar →', {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '13px',
        color: '#2bff88',
        fontStyle: 'bold'
      });

      // Área clicable
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => {
        bg.setFillStyle(0x0b1020, 0.50);
        bg.setStrokeStyle(1, 0x2bff88, 0.35);
      });
      bg.on('pointerout', () => {
        bg.setFillStyle(0x0b1020, 0.35);
        bg.setStrokeStyle(1, 0xb7c0ff, 0.25);
      });

      bg.on('pointerdown', () => {
        // Guardamos selección (para RaceScene en Fase 3)
        this.registry.set('selectedTrack', t.key);

        // Feedback (sin entrar a RaceScene aún)
        toast.setText(`Seleccionado: ${t.title}  —  (Carrera en Fase 3)`);
        this.tweens.killTweensOf(toast);
        toast.setAlpha(0);
        this.tweens.add({ targets: toast, alpha: 1, duration: 140, yoyo: true, hold: 1100 });
      });

      container.add([bg, header, title, tag, desc, cta]);
      return container;
    };

    makeCard(leftX, topY, tracks[0]);
    makeCard(leftX + cardW + gap, topY, tracks[1]);

    // Nota inferior
    this.add.text(width / 2, Math.floor(height * 0.82), 'Tip: esto ya es PWA. Abre una vez, luego modo avión y recarga.', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#b7c0ff'
    }).setOrigin(0.5);
  }
}
