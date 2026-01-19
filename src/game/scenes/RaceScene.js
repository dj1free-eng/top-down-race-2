import Phaser from 'phaser';

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
export class RaceScene extends Phaser.Scene {
  constructor() {
    super('race');
    this.worldW = 8000;
    this.worldH = 5000;

    this.car = null;
    this.keys = null;
    this.zoom = 1.0;

    // conducción (Arcade) — valores por defecto ajustables más adelante
    this.params = {
      accel: 520,           // px/s^2
      maxSpeedFwd: 520,     // px/s
      maxSpeedRev: 220,     // px/s
      linearDrag: 0.985,    // factor por frame (aprox)
      turnRate: 2.6,        // rad/s a baja velocidad (se reduce con velocidad)
      turnMinFactor: 0.35   // factor mínimo de giro a alta velocidad
    };
  }

  create() {
    // Mundo + bounds
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

    // Fondo (tile) simple sin assets: generamos una textura procedimental
    this.createProceduralBackground();

    const bg = this.add.tileSprite(0, 0, this.worldW, this.worldH, 'bgGrid').setOrigin(0);
    bg.setScrollFactor(1);

    // Coche (sprite procedural)
    this.createCarTexture();

    this.car = this.physics.add.sprite(4000, 2500, 'car');
    this.car.setDamping(false);
    this.car.setDrag(0); // controlaremos drag manualmente
    this.car.setMaxVelocity(this.params.maxSpeedFwd, this.params.maxSpeedFwd);
    this.car.setCollideWorldBounds(true);
    this.car.setBounce(0);

    // Cámara follow
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.startFollow(this.car, true, 0.12, 0.12);
    this.zoom = 1.0;
    this.cameras.main.setZoom(this.zoom);

    // Input
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

    // UI mínima (texto fijo en pantalla)
    this.hud = this.add.text(12, 12, '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#ffffff'
    }).setScrollFactor(0).setDepth(10);

    // Táctil: joystick simple (izquierda mover, derecha girar)
    this.touch = this.createTouchControls();

    // Salida a menú (por ahora)
    this.keys.back.on('down', () => {
      this.scene.start('menu');
    });
  }

  update(time, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);

    // Entradas unificadas
    const up = this.keys.up.isDown || this.keys.up2.isDown || this.touch.throttle > 0.2;
    const down = this.keys.down.isDown || this.keys.down2.isDown || this.touch.brake > 0.2;
    const left = this.keys.left.isDown || this.keys.left2.isDown || this.touch.steer < -0.2;
    const right = this.keys.right.isDown || this.keys.right2.isDown || this.touch.steer > 0.2;

    // Zoom
    if (Phaser.Input.Keyboard.JustDown(this.keys.zoomIn)) {
      this.zoom = clamp(this.zoom + 0.1, 0.6, 1.6);
      this.cameras.main.setZoom(this.zoom);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.zoomOut)) {
      this.zoom = clamp(this.zoom - 0.1, 0.6, 1.6);
      this.cameras.main.setZoom(this.zoom);
    }

    // Velocidad actual
    const vx = this.car.body.velocity.x;
    const vy = this.car.body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);

    // Dirección del coche (rotation en rad)
    const rot = this.car.rotation;

    // Aceleración / marcha atrás (fuerza en el eje del coche)
    let accel = 0;
    if (up && !down) accel = this.params.accel;
    else if (down && !up) accel = -this.params.accel;

    // Limitar marcha atrás (cap menor)
    const maxSpeed = accel >= 0 ? this.params.maxSpeedFwd : this.params.maxSpeedRev;

    if (accel !== 0) {
      const ax = Math.cos(rot) * accel;
      const ay = Math.sin(rot) * accel;
      this.car.body.velocity.x += ax * dt;
      this.car.body.velocity.y += ay * dt;

      // clamp speed
      const nvx = this.car.body.velocity.x;
      const nvy = this.car.body.velocity.y;
      const ns = Math.sqrt(nvx * nvx + nvy * nvy);
      if (ns > maxSpeed) {
        const s = maxSpeed / ns;
        this.car.body.velocity.x *= s;
        this.car.body.velocity.y *= s;
      }
    } else {
      // Desaceleración natural al soltar (drag manual)
      this.car.body.velocity.x *= Math.pow(this.params.linearDrag, dt * 60);
      this.car.body.velocity.y *= Math.pow(this.params.linearDrag, dt * 60);
    }

    // Giro dependiente de velocidad (menos giro cuanto más rápido)
    const speed01 = clamp(speed / this.params.maxSpeedFwd, 0, 1);
    const turnFactor = clamp(1 - speed01, this.params.turnMinFactor, 1);
    const turn = this.params.turnRate * turnFactor;

    if (left && !right) this.car.rotation -= turn * dt;
    if (right && !left) this.car.rotation += turn * dt;

    // HUD
    const kmh = speed * 0.12; // “fake km/h”
    this.hud.setText(
      `RaceScene (Fase 3)\n` +
      `Track seleccionado: ${this.registry.get('selectedTrack') || '—'}\n` +
      `Pos: ${this.car.x.toFixed(0)}, ${this.car.y.toFixed(0)}\n` +
      `Vel: ${kmh.toFixed(0)} km/h (simulado)\n` +
      `Zoom: ${this.zoom.toFixed(1)}  (Q/E)\n` +
      `ESC: menú`
    );
  }

  createProceduralBackground() {
    if (this.textures.exists('bgGrid')) return;

    const size = 256;
    const rt = this.make.renderTexture({ width: size, height: size }, false);
    rt.fill(0x141b33, 1);

    // “asfalto” con puntitos
    const g = this.add.graphics();
    g.fillStyle(0x0b1020, 0.55);
    g.fillRect(0, 0, size, size);

    // líneas grid suaves
    g.lineStyle(1, 0xffffff, 0.06);
    for (let i = 0; i <= size; i += 64) {
      g.lineBetween(i, 0, i, size);
      g.lineBetween(0, i, size, i);
    }

    // “ruido” con pequeños puntos
    g.fillStyle(0xffffff, 0.03);
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      g.fillRect(x, y, 2, 2);
    }

    rt.draw(g, 0, 0);
    g.destroy();
    rt.saveTexture('bgGrid');
    rt.destroy();
  }

  createCarTexture() {
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

    // morro “verde”
    g.fillStyle(0x2bff88, 0.95);
    g.fillRoundedRect(34, 9, 10, 8, 4);

    // contorno
    g.lineStyle(2, 0x0b1020, 0.6);
    g.strokeRoundedRect(0, 0, w, h, 10);

    g.generateTexture('car', w + 4, h + 6);
    g.destroy();
  }

  createTouchControls() {
    // Controles táctiles minimalistas:
    // - lado izquierdo: throttle/brake vertical
    // - lado derecho: steer horizontal
    const state = {
      steer: 0,     // -1..1
      throttle: 0,  // 0..1
      brake: 0      // 0..1
    };

    const w = this.scale.width;
    const h = this.scale.height;

    const hint = this.add.text(w / 2, h - 18, 'Táctil: izq acel/frena, dcha gira', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#b7c0ff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10);

    this.input.on('pointerdown', (p) => this.updateTouchState(p, state));
    this.input.on('pointermove', (p) => this.updateTouchState(p, state));
    this.input.on('pointerup', (p) => {
      // solo reseteamos el “lado” que soltó
      if (p.x < this.scale.width * 0.5) {
        state.throttle = 0;
        state.brake = 0;
      } else {
        state.steer = 0;
      }
    });

    // Reposicionar hint al resize
    this.scale.on('resize', ({ width: nw, height: nh }) => {
      hint.setPosition(nw / 2, nh - 18);
    });

    return state;
  }

  updateTouchState(p, state) {
    const w = this.scale.width;
    const h = this.scale.height;

    if (!p.isDown) return;

    if (p.x < w * 0.5) {
      // Izquierda: vertical => throttle (arriba) / brake (abajo)
      const y01 = clamp(p.y / h, 0, 1);
      const v = (0.5 - y01) * 2; // arriba positivo, abajo negativo
      state.throttle = clamp(v, 0, 1);
      state.brake = clamp(-v, 0, 1);
    } else {
      // Derecha: horizontal => steer
      const x01 = clamp((p.x - w * 0.5) / (w * 0.5), 0, 1);
      state.steer = (x01 - 0.5) * 2;
      state.steer = clamp(state.steer, -1, 1);
    }
  }
}
