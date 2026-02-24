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
    this.cameras.main.setBackgroundColor('#0b1020');

    this._buildHeader(width);
    this._buildTabs(width);
    this._renderTabContent(width, height);
  }

  // ===============================
  // Header
  // ===============================

  _buildHeader(width) {
    const header = this.add.rectangle(0, 0, width, 64, 0x141b33, 0.95)
      .setOrigin(0);

    const back = this.add.text(20, 20, '←', {
      fontSize: '24px',
      color: '#ffffff'
    }).setInteractive({ useHandCursor: true });

    back.on('pointerdown', () => {
      this.scene.start('menu');
    });

    this.add.text(width / 2, 22, 'CONFIGURACIÓN', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5);
  }

  // ===============================
  // Tabs
  // ===============================

  _buildTabs(width) {
    const tabs = ['controls', 'video', 'audio'];
    const labels = {
      controls: 'CONTROLES',
      video: 'VÍDEO',
      audio: 'AUDIO'
    };

    let x = 40;
    tabs.forEach(tab => {
      const isActive = tab === this.activeTab;

      const btn = this.add.rectangle(x, 80, 120, 36,
        0x141b33,
        isActive ? 0.85 : 0.45
      ).setOrigin(0);

      btn.setStrokeStyle(1, isActive ? 0x2bff88 : 0xb7c0ff, 0.5);
      btn.setInteractive({ useHandCursor: true });

      const text = this.add.text(x + 60, 98, labels[tab], {
        fontSize: '13px',
        color: '#ffffff'
      }).setOrigin(0.5);

      btn.on('pointerdown', () => {
        this.activeTab = tab;
        this.scene.restart();
      });

      x += 140;
    });
  }

  // ===============================
  // Tab Content
  // ===============================

  _renderTabContent(width, height) {
    const startY = 140;

    if (this.activeTab === 'controls') {
      this._sectionTitle('Tipo de control', 40, startY);
      this._textLine(`Actual: ${this.settings.controls.scheme}`, 40, startY + 30);

      this._sectionTitle('Invertir dirección', 40, startY + 90);
      this._toggleButton(
        this.settings.controls.invertSteer,
        40,
        startY + 120,
        (value) => {
          this.settings.controls.invertSteer = value;
          this._saveSettings();
          this.scene.restart();
        }
      );
    }

    if (this.activeTab === 'video') {
      this._sectionTitle('Mostrar FPS', 40, startY);
      this._toggleButton(
        this.settings.video.showFPS,
        40,
        startY + 30,
        (value) => {
          this.settings.video.showFPS = value;
          this._saveSettings();
          this.scene.restart();
        }
      );
    }

    if (this.activeTab === 'audio') {
      this._sectionTitle('Modo silencio', 40, startY);
      this._toggleButton(
        this.settings.audio.mute,
        40,
        startY + 30,
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
    const label = value ? 'ON' : 'OFF';

    const btn = this.add.rectangle(x, y, 80, 32,
      value ? 0x2bff88 : 0x141b33,
      0.9
    ).setOrigin(0);

    btn.setStrokeStyle(1, 0xb7c0ff, 0.5);
    btn.setInteractive({ useHandCursor: true });

    this.add.text(x + 40, y + 16, label, {
      fontSize: '13px',
      color: value ? '#0b1020' : '#ffffff'
    }).setOrigin(0.5);

    btn.on('pointerdown', () => {
      onChange(!value);
    });
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
