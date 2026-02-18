// src/game/scenes/BaseScene.js
import Phaser from 'phaser';
import { OrientationOverlay } from '../ui/OrientationOverlay.js';

export class BaseScene extends Phaser.Scene {
  create() {
    // Overlay global (portrait -> bloquea)
    this._orientationOverlay = new OrientationOverlay(this, {
      imageKey: 'ui_rotate_landscape'
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this._orientationOverlay?.destroy();
      this._orientationOverlay = null;
    });
  }
}
