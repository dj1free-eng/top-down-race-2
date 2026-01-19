import Phaser from 'phaser';

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
    this._ui = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b1020');

    // Re-render al cambiar tamaño/orientación
    this.scale.on('resize', () => this.renderUI());

    this.renderUI();
  }

  renderUI() {
    const { width, height } = this.scale;

    // Limpiar UI anterior si existe
    if (this._ui) {
      this._ui.destroy(true);
      this._ui = null;
    }

    const root = this.add.container(0, 0);
    this._ui = root;

    // Fondo sutil
    const g = this.add.graphics();
    g.fillStyle(0x141b33, 0.65);
    g.fillRect(0, 0, width, height);

    g.lineStyle(1, 0xffffff, 0.03);
    const step = 48;
    for (let x = 0; x <= width; x += step) g.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += step) g.lineBetween(0, y, width, y);

    root.add(g);

    const isPortrait = height >= width;

    // Logo + títulos (un poco más compactos en portrait)
    const logoY = Math.floor(height * (isPortrait ? 0.16 : 0.22));
    const titleY = Math.floor(height * (isPortrait ? 0.29 : 0.36));

    root.add(this.add.image(width / 2, logoY, 'logo').setScale(isPortrait ? 0.48 : 0.55));

    root.add(this.add.text(width / 2, titleY, 'Top-Down Race 2', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: isPortrait ? '28px' : '34px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    root.add(this.add.text(width / 2, titleY + 30, 'Elige circuito', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#b7c0ff'
    }).setOrigin(0.5));

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

    const toast = this.add.text(width / 2, Math.floor(height * 0.92), '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#2bff88'
    }).setOrigin(0.5).setAlpha(0);
    root.add(toast);

    // Cards responsive
    const pad = 16;
    const cardW = clamp(Math.floor(width - pad * 2), 260, isPortrait ? 520 : 460);
    const cardH = 170;
    const gap = 14;

    const topY = Math.floor(height * (isPortrait ? 0.38 : 0.48));

    const makeCard = (x, y, t) => {
      const container = this.add.container(x, y);

      const bg = this.add.rectangle(0, 0, cardW, cardH, 0x0b1020, 0.35)
        .setStrokeStyle(1, 0xb7c0ff, 0.25)
        .setOrigin(0);

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
        this.registry.set('selectedTrack', t.key);

        toast.setText(`Seleccionado: ${t.title}  —  (Carrera en Fase 3)`);
        this.tweens.killTweensOf(toast);
        toast.setAlpha(0);
        this.tweens.add({ targets: toast, alpha: 1, duration: 140, yoyo: true, hold: 1100 });
      });

      container.add([bg, header, title, tag, desc, cta]);
      return container;
    };

    if (isPortrait) {
      // Vertical: cards apiladas
      const x = Math.floor((width - cardW) / 2);
      const c1 = makeCard(x, topY, tracks[0]);
      const c2 = makeCard(x, topY + cardH + gap, tracks[1]);
      root.add([c1, c2]);
    } else {
      // Horizontal: dos columnas
      const gapH = 18;
      const totalW = cardW * 2 + gapH;
      const leftX = Math.floor(width / 2 - totalW / 2);
      const c1 = makeCard(leftX, topY, tracks[0]);
      const c2 = makeCard(leftX + cardW + gapH, topY, tracks[1]);
      root.add([c1, c2]);
    }

    root.add(this.add.text(width / 2, Math.floor(height * 0.84), 'Tip: abre una vez, luego modo avión y recarga (PWA).', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#b7c0ff'
    }).setOrigin(0.5));
  }
}
