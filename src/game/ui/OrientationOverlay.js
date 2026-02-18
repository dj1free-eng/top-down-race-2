// src/game/ui/OrientationOverlay.js
import Phaser from 'phaser';

function isPortraitLike(scene) {
  const { width, height } = scene.scale;
  // “portrait” o casi-portrait (evita falsos positivos en tablets)
  return width < height * 1.02;
}

export class OrientationOverlay {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} opts
   * @param {string} opts.imageKey - textura ya cargada
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.imageKey = opts.imageKey || 'ui_rotate_landscape';

    this._root = scene.add.container(0, 0).setDepth(999999);
    this._dim = scene.add.rectangle(0, 0, 1, 1, 0x000000, 0.72).setOrigin(0);
    this._dim.setInteractive(); // bloquea input por detrás

    this._img = scene.add.image(0, 0, this.imageKey).setOrigin(0.5);

    this._root.add([this._dim, this._img]);

    this._blocked = false;

    this._onResize = () => this._layout();
    scene.scale.on('resize', this._onResize);

    this._layout();
  }

  _layout() {
    const scene = this.scene;
    const { width, height } = scene.scale;

    // Fullscreen hitbox
    this._dim.setSize(width, height);
    this._dim.setPosition(0, 0);

    // Imagen centrada + “cover” suave
    this._img.setPosition(Math.floor(width / 2), Math.floor(height / 2));

    // Escalado para que se lea bien en móviles
    const iw = this._img.width || 1;
    const ih = this._img.height || 1;

    // Queremos que ocupe aprox 80% del ancho o 80% del alto (lo que limite)
    const targetW = width * 0.86;
    const targetH = height * 0.86;
    const s = Math.min(targetW / iw, targetH / ih);

    this._img.setScale(s);

    // Activación/desactivación
    const shouldBlock = isPortraitLike(scene);
    if (shouldBlock !== this._blocked) {
      this._blocked = shouldBlock;
      this._root.setVisible(shouldBlock);

      // Bloqueo “duro”: sin input (y pausa arcade si existe)
      if (scene.input) scene.input.enabled = !shouldBlock;
      if (scene.physics && scene.physics.world) scene.physics.world.isPaused = shouldBlock;
    } else {
      this._root.setVisible(this._blocked);
    }
  }

  destroy() {
    const scene = this.scene;
    if (!scene) return;

    scene.scale.off('resize', this._onResize);

    this._root?.destroy(true);
    this._root = null;
    this._dim = null;
    this._img = null;
    this.scene = null;
  }
}
