import Phaser from 'phaser';

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export class OrientationOverlay {
  constructor(scene, textureKey = 'ui_orientation_portrait') {
    this.scene = scene;
    this.textureKey = textureKey;

    this._root = scene.add.container(0, 0).setDepth(999999);
    this._root.setVisible(false);

    this._dim = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.72).setOrigin(0);
    this._img = scene.add.image(0, 0, textureKey).setOrigin(0.5);

    this._root.add([this._dim, this._img]);

    this._onResize = () => this._layoutAndToggle();
    scene.scale.on('resize', this._onResize);

    // Primera evaluación
    this._layoutAndToggle();
  }

  destroy() {
    if (!this.scene) return;
    this.scene.scale.off('resize', this._onResize);
    this._root?.destroy(true);
    this.scene = null;
  }

  _layoutAndToggle() {
    const { width, height } = this.scene.scale;
    const isPortrait = height > width;

    // Toggle
    this._root.setVisible(isPortrait);
    if (!isPortrait) return;

    // Layout
    this._dim.setSize(width, height);

    // Ajuste imagen tipo "contain" (sin recortar)
    const pad = clamp(Math.floor(Math.min(width, height) * 0.06), 16, 36);
    const maxW = width - pad * 2;
    const maxH = height - pad * 2;

    const iw = this._img.width || 1;
    const ih = this._img.height || 1;

    const s = Math.min(maxW / iw, maxH / ih);

    this._img.setScale(s);
    this._img.setPosition(Math.floor(width / 2), Math.floor(height / 2));
  }
}
