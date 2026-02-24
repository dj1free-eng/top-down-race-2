// src/scenes/SettingsScene.js
import Phaser from 'phaser';

const STORAGE_KEY = 'tdr2:settings';

const DEFAULT_SETTINGS = {
  controls: {
    scheme: "touch",
    sensitivity: 1.0,
    deadZone: 0.1,
    invertSteer: false
  },
  video: {
    zoom: 1.0,
    cameraLerp: 0.12,
    particles: true,
    shadows: true,
    showFPS: false
  },
  audio: {
    master: 1.0,
    music: 0.8,
    selectedTrack: "default",
    mute: false
  }
};

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SettingsScene' });
    this.settings = null;
    this.activeTab = 'controls';
  }

  init() {
    this.settings = this._loadSettings();
  }

  create() {
  const { width, height } = this.scale;

  // Fondo base
  this.cameras.main.setBackgroundColor('#0b1020');

  // Fondo imagen (si existe en el juego)
  if (this.textures.exists('menu_bg')) {
    const bg = this.add.image(width / 2, height / 2, 'menu_bg').setOrigin(0.5);
    this._fitCover(bg);
  }

  // Layout (similar al lobby)
  const pad = Math.max(14, Math.min(24, Math.floor(width * 0.03)));
  const topH = Math.max(64, Math.min(88, Math.floor(height * 0.14)));

  // Panel principal
  const panelX = pad;
  const panelY = topH + 12;
  const panelW = width - pad * 2;
  const panelH = height - panelY - pad;

  // Header + Tabs + Contenido dentro del panel
  this._buildHeader(width, topH, pad);
  this._buildPanel(panelX, panelY, panelW, panelH);
  this._buildTabs(panelX, panelY, panelW);
  this._renderTabContent(panelX, panelY, panelW, panelH);
}

  // ===============================
  // Header
  // ===============================

_buildHeader(width, topH, pad) {
  // Barra superior sutil (como HUD)
  const bar = this.add.rectangle(0, 0, width, topH, 0x0b1020, 0.35).setOrigin(0);
  bar.setDepth(10);

  // Botón BACK tipo pill
  const x = pad;
  const y = Math.floor(topH / 2);

  const btnW = 84;
  const btnH = 38;

  const g = this.add.graphics();
  g.setDepth(11);

  const draw = (pressed) => {
    g.clear();
    g.fillStyle(0x141b33, pressed ? 0.85 : 0.55);
    g.fillRoundedRect(x, y - btnH / 2, btnW, btnH, 16);
    g.lineStyle(1, 0xb7c0ff, pressed ? 0.45 : 0.22);
    g.strokeRoundedRect(x, y - btnH / 2, btnW, btnH, 16);
  };
  draw(false);

  const label = this.add.text(x + btnW / 2, y, '← VOLVER', {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '13px',
    color: '#ffffff',
    fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(12);

  const hit = this.add.rectangle(x, y - btnH / 2, btnW, btnH, 0x000000, 0.001)
    .setOrigin(0)
    .setInteractive({ useHandCursor: true })
    .setDepth(13);

  hit.on('pointerdown', () => { draw(true); });
  hit.on('pointerup', () => { draw(false); this.scene.start('menu'); });
  hit.on('pointerout', () => { draw(false); });

  // Título centrado
  this.add.text(width / 2, y, 'CONFIGURACIÓN', {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '18px',
    color: '#ffffff',
    fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(12);
}
_buildPanel(x, y, w, h) {
  // Panel principal estilo overlay del lobby
  const bg = this.add.rectangle(x, y, w, h, 0x0b1020, 0.72)
    .setOrigin(0)
    .setStrokeStyle(1, 0xb7c0ff, 0.18);

  // Header interior (zona tabs)
  const headH = 56;
  const head = this.add.rectangle(x, y, w, headH, 0x141b33, 0.70).setOrigin(0);

  // Guardamos métricas internas
  this._panel = { x, y, w, h, headH };
}
  // ===============================
  // Tabs
  // ===============================

_buildTabs(panelX, panelY, panelW) {
  const { headH } = this._panel;

  const tabs = ['controls', 'video', 'audio'];
  const labels = { controls: 'CONTROLES', video: 'VÍDEO', audio: 'AUDIO' };

  const pad = 14;
  const pillH = 36;
  const gap = 10;

  let x = panelX + pad;
  const y = panelY + Math.floor((headH - pillH) / 2);

  tabs.forEach(tab => {
    const isActive = tab === this.activeTab;

    const textObj = this.add.text(0, 0, labels[tab], {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    const pillPadX = 16;
    const pw = Math.max(118, textObj.width + pillPadX * 2);
    textObj.destroy(); // solo lo usamos para medir

    const g = this.add.graphics();
    const draw = (selected, pressed) => {
      g.clear();
      g.fillStyle(0x141b33, selected ? 0.85 : 0.45);
      g.fillRoundedRect(0, 0, pw, pillH, 16);
      g.lineStyle(1, selected ? 0x2bff88 : 0xb7c0ff, selected ? 0.55 : 0.22);
      g.strokeRoundedRect(0, 0, pw, pillH, 16);

      if (pressed) {
        g.fillStyle(0x000000, 0.10);
        g.fillRoundedRect(0, 0, pw, pillH, 16);
      }
    };
    draw(isActive, false);

    const t = this.add.text(Math.floor(pw / 2), Math.floor(pillH / 2), labels[tab], {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, pw, pillH, 0x000000, 0.001)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });

    const c = this.add.container(x, y, [g, t, hit]);

hit.on('pointerdown', () => {
  draw(tab === this.activeTab, true);
  c.setScale(0.98);
});

hit.on('pointerout', () => {
  draw(tab === this.activeTab, false);
  c.setScale(1.0);
});

hit.on('pointerup', () => {
  draw(tab === this.activeTab, false);
  c.setScale(1.0);

  if (this.activeTab === tab) return;

  this.activeTab = tab;

  // Micro transición (para que no parezca un refresh feo)
  this.cameras.main.fadeOut(90, 11, 16, 32);
  this.time.delayedCall(95, () => this.scene.restart());
});

// avanzar cursor y cerrar tab
x += pw + gap;
  });
}
  // ===============================
  // Tab Content
  // ===============================

_renderTabContent(panelX, panelY, panelW, panelH) {
  const { headH } = this._panel;

  const pad = 16;
  const contentX = panelX + pad;
  const contentY = panelY + headH + pad;

  // Footer
  const footerH = 54;
  const footerY = panelY + panelH - footerH;

  // Línea separadora
  this.add.rectangle(panelX + 10, footerY, panelW - 20, 1, 0xffffff, 0.08).setOrigin(0);

  // Botón "Restablecer" (por ahora solo UI)
  const reset = this.add.rectangle(contentX, footerY + 10, 140, 34, 0x141b33, 0.55)
    .setOrigin(0)
    .setStrokeStyle(1, 0xb7c0ff, 0.18)
    .setInteractive({ useHandCursor: true });

  const resetTxt = this.add.text(contentX + 70, footerY + 27, 'RESTABLECER', {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '12px',
    color: '#ffffff',
    fontStyle: 'bold'
  }).setOrigin(0.5);

  reset.on('pointerdown', () => {
    // Nota: ahora mismo solo resetea y guarda
    this.settings = structuredClone(DEFAULT_SETTINGS);
    this._saveSettings();
    this.scene.restart();
  });

  // Estado guardado
  this.add.text(panelX + panelW - pad, footerY + 27, 'Guardado ✓', {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '12px',
    color: '#2bff88',
    fontStyle: 'bold'
  }).setOrigin(1, 0.5);

  // Zona de contenido útil (para no chocar con footer)
  const maxY = footerY - 12;

  let y = contentY;

  const title = (txt) => {
    this._sectionTitle(txt, contentX, y);
    y += 28;
  };

  const rowGap = 14;

  if (this.activeTab === 'controls') {
    title('CONTROLES');
    this._textLine(`Tipo de control: ${this.settings.controls.scheme}`, contentX, y);
    y += 26 + rowGap;

    this._sectionTitle('Invertir dirección', contentX, y);
    y += 26;
    this._toggleButton(
      this.settings.controls.invertSteer,
      contentX,
      y,
      (value) => {
        this.settings.controls.invertSteer = value;
        this._saveSettings();
        this.scene.restart();
      }
    );
  }

  if (this.activeTab === 'video') {
    title('VÍDEO');

    this._sectionTitle('Mostrar FPS', contentX, y);
    y += 26;
    this._toggleButton(
      this.settings.video.showFPS,
      contentX,
      y,
      (value) => {
        this.settings.video.showFPS = value;
        this._saveSettings();
        this.scene.restart();
      }
    );
  }

  if (this.activeTab === 'audio') {
    title('AUDIO');

    this._sectionTitle('Modo silencio', contentX, y);
    y += 26;
    this._toggleButton(
      this.settings.audio.mute,
      contentX,
      y,
      (value) => {
        this.settings.audio.mute = value;
        this._saveSettings();
        this.scene.restart();
      }
    );
  }
}

  // ===============================
  // UI Helpers
  // ===============================

  _sectionTitle(text, x, y) {
    this.add.text(x, y, text, {
      fontSize: '15px',
      color: '#ffffff'
    });
  }

  _textLine(text, x, y) {
    this.add.text(x, y, text, {
      fontSize: '13px',
      color: '#b7c0ff'
    });
  }

_toggleButton(value, x, y, onChange) {
  // Switch estilo iOS / consola
  const w = 96;
  const h = 34;
  const r = 17;

  const c = this.add.container(x, y);

  const g = this.add.graphics();

  const knobR = 13;
  const knobY = Math.floor(h / 2);

  const knob = this.add.circle(value ? (w - r) : r, knobY, knobR, 0xffffff, 1);

  const txt = this.add.text(w + 12, knobY, value ? 'ON' : 'OFF', {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '12px',
    color: value ? '#2bff88' : '#b7c0ff',
    fontStyle: 'bold'
  }).setOrigin(0, 0.5);

  const draw = (v, pressed = false) => {
    g.clear();

    // Track
    g.fillStyle(v ? 0x2bff88 : 0x141b33, pressed ? 0.95 : 0.85);
    g.fillRoundedRect(0, 0, w, h, r);

    // Stroke
    g.lineStyle(1, v ? 0x2bff88 : 0xb7c0ff, v ? 0.45 : 0.22);
    g.strokeRoundedRect(0, 0, w, h, r);

    // Highlight superior sutil
    g.fillStyle(0xffffff, v ? 0.14 : 0.10);
    g.fillRoundedRect(2, 2, w - 4, Math.max(6, Math.floor(h * 0.35)), r - 2);

    // Knob
    knob.setFillStyle(0xffffff, 1);
    knob.x = v ? (w - r) : r;

    // Texto
    txt.setText(v ? 'ON' : 'OFF');
    txt.setColor(v ? '#2bff88' : '#b7c0ff');
  };

  draw(value, false);

  const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0.001)
    .setOrigin(0)
    .setInteractive({ useHandCursor: true });

  const press = () => {
    c.setScale(0.98);
    draw(value, true);
  };

  const release = () => {
    c.setScale(1.0);
    draw(value, false);
  };

  hit.on('pointerdown', press);
  hit.on('pointerout', release);
  hit.on('pointerup', () => {
    release();

    // Animación knob (suave)
    const next = !value;

    // animación visual del knob (sin depender del restart)
    this.tweens.add({
      targets: knob,
      x: next ? (w - r) : r,
      duration: 140,
      ease: 'Sine.easeOut'
    });

    onChange(next);
  });

  c.add([g, knob, hit, txt]);
  return c;
}
_fitCover(img) {
  const sw = this.scale.width;
  const sh = this.scale.height;
  const sx = sw / (img.width || 1);
  const sy = sh / (img.height || 1);
  const s = Math.max(sx, sy); // cover
  img.setScale(s);
  img.setPosition(sw / 2, sh / 2);
}
  // ===============================
  // Storage
  // ===============================

  _loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return structuredClone(DEFAULT_SETTINGS);
    }
  }

  _saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {}
  }
}
