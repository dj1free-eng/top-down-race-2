import Phaser from 'phaser';

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export class RaceScene extends Phaser.Scene {
  constructor() {
    super('race');

    this.worldW = 8000;
    this.worldH = 5000;

    this.car = null;
    this.keys = null;

    this.zoom = 1.0;

    // Físicas arcade base (tuneo vendrá después)
    this.accel = 520;       // px/s^2
    this.maxFwd = 520;      // px/s
    this.maxRev = 220;      // px/s
    this.drag = 0.985;      // factor por frame
    this.turnRate = 2.6;    // rad/s
    this.turnMin = 0.35;    // mínimo giro a alta velocidad

    this.hud = null;
  }

  create() {
    // World bounds
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

    // Texturas procedurales
    this.ensureBgTexture();
    this.ensureCarTexture();

    // Fondo
    this.add.tileSprite(0, 0, this.worldW, this.worldH, 'bgGrid').setOrigin(0);

    // Coche
    this.car = this.physics.add.sprite(4000, 2500, 'car');
    this.car.setCollideWorldBounds(true);
    this.car.setBounce(0);

    // Cámara follow
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.startFollow(this.car, true, 0.12, 0.12);
    this.cameras.main.setZoom(this.zoom);

    // Input teclado
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,

      up2: Phaser.Input.Keyboard.KeyCodes.UP,
      down2: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left2: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right2: Phaser.Input.Keyboard.KeyCodes.RIGHT,

      zoomIn: Phaser.Input.Keyboard.KeyCodes.E,
      zoomOut: Phaser.Input.Keyboard.KeyCodes.Q,
      back: Phaser.Input.Keyboard.KeyCodes.ESC
    });

    // HUD
    this.hud = this.add.text(12, 12, '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#ffffff'
    }).setScrollFactor(0).setDepth(10);

    // Volver al menú
    this.keys.back.on('down', () => {
      this.scene.start('menu');
    });
  }

  update(time, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);

    // Zoom
    if (Phaser.Input.Keyboard.JustDown(this.keys.zoomIn)) {
      this.zoom = clamp(this.zoom + 0.1, 0.6, 1.6);
      this.cameras.main.setZoom(this.zoom);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.zoomOut)) {
      this.zoom = clamp(this.zoom - 0.1, 0.6, 1.6);
      this.cameras.main.setZoom(this.zoom);
    }

    const up = this.keys.up.isDown || this.keys.up2.isDown;
    const down = this.keys.down.isDown || this.keys.down2.isDown;
    const left = this.keys.left.isDown || this.keys.left2.isDown;
    const right = this.keys.right.isDown || this.keys.right2.isDown;

    // Velocidad actual
    const vx = this.car.body.velocity.x;
    const vy = this.car.body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);

    // Aceleración (en dirección del coche)
    var a = 0;
    if (up && !down) a = this.accel;
    else if (down && !up) a = -this.accel;

    var maxSpeed = a >= 0 ? this.maxFwd : this.maxRev;

    if (a !== 0) {
      const ax = Math.cos(this.car.rotation) * a;
      const ay = Math.sin(this.car.rotation) * a;

      this.car.body.velocity.x += ax * dt;
      this.car.body.velocity.y += ay * dt;

      // clamp velocidad
      const nvx = this.car.body.velocity.x;
      const nvy = this.car.body.velocity.y;
      const ns = Math.sqrt(nvx * nvx + nvy * nvy);
      if (ns > maxSpeed) {
        const s = maxSpeed / ns;
        this.car.body.velocity.x *= s;
        this.car.body.velocity.y *= s;
      }
    } else {
      // Drag al soltar
      const f = Math.pow(this.drag, dt * 60);
      this.car.body.velocity.x *= f;
      this.car.body.velocity.y *= f;
    }

    // Giro dependiente de velocidad
    const speed01 = clamp(speed / this.maxFwd, 0, 1);
    const turnFactor = clamp(1 - speed01, this.turnMin, 1);
    const turn = this.turnRate * turnFactor;

    if (left && !right) this.car.rotation -= turn * dt;
    if (right && !left) this.car.rotation += turn * dt;

    // HUD
    const kmh = speed * 0.12;
    this.hud.setText(
      'RaceScene (Fase 3 estable)\n' +
      'WASD / Flechas: conducir\n' +
      'Q/E: zoom  |  ESC: menú\n' +
      'Pos: ' + this.car.x.toFixed(0) + ', ' + this.car.y.toFixed(0) + '\n' +
      'Vel: ' + kmh.toFixed(0) + ' km/h (sim)'
    );
  }

  ensureBgTexture() {
    if (this.textures.exists('bgGrid')) return;

    const size = 256;
    const rt = this.make.renderTexture({ width: size, height: size }, false);

    // fondo oscuro
    rt.fill(0x0b1020, 1);

    // grid suave
    const g = this.add.graphics();
    g.lineStyle(1, 0xffffff, 0.06);
    for (let i = 0; i <= size; i += 64) {
      g.lineBetween(i, 0, i, size);
      g.lineBetween(0, i, size, i);
    }

    // puntitos ruido
    g.fillStyle(0xffffff, 0.03);
    for (let k = 0; k < 220; k++) {
      g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }

    rt.draw(g, 0, 0);
    g.destroy();

    rt.saveTexture('bgGrid');
    rt.destroy();
  }

  ensureCarTexture() {
    if (this.textures.exists('car')) return;

    const w = 44, h = 26;
    const g = this.add.graphics();

    // sombra
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(2, 4, w, h, 10);

    // cuerpo
    g.fillStyle(0xffffff, 0.95);
    g.fillRoundedRect(0, 0, w, h, 10);

    // cabina
    g.fillStyle(0x141b33, 0.9);
    g.fillRoundedRect(16, 6, 18, 14, 6);

    // morro
    g.fillStyle(0x2bff88, 0.95);
    g.fillRoundedRect(34, 9, 10, 8, 4);

    // contorno
    g.lineStyle(2, 0x0b1020, 0.6);
    g.strokeRoundedRect(0, 0, w, h, 10);

    g.generateTexture('car', w + 4, h + 6);
    g.destroy();
  }
}
