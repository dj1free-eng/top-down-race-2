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
    const up = this.keys.up.isDown || this.keys.up2.isDown || this.touch.throttle > 0.5;
const down = this.keys.down.isDown || this.keys.down2.isDown || this.touch.brake > 0.5;

const left = this.keys.left.isDown || this.keys.left2.isDown || this.touch.steer < -0.15;
const right = this.keys.right.isDown || this.keys.right2.isDown || this.touch.steer > 0.15;
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
  // UI táctil visible:
  // - Izquierda: joystick (steer)
  // - Derecha: dos botones (throttle / brake)

  const state = {
    steer: 0,        // -1..1
    throttle: 0,     // 0..1
    brake: 0,        // 0..1
    leftId: null,
    rightId: null,
    leftActive: false,
    rightThrottle: false,
    rightBrake: false,
    stickBaseX: 0,
    stickBaseY: 0,
    stickCurX: 0,
    stickCurY: 0,
    ui: null
  };

  const ui = this.add.container(0, 0).setScrollFactor(0).setDepth(50);
  state.ui = ui;

  const buildUI = () => {
    ui.removeAll(true);

    const w = this.scale.width;
    const h = this.scale.height;

    // Zonas
    const pad = 16;
    const stickRadius = Math.max(46, Math.floor(Math.min(w, h) * 0.06));
    const stickDead = stickRadius * 0.18;
    const stickMax = stickRadius * 0.85;

    // Base joystick (izquierda)
    const baseX = pad + stickRadius + 10;
    const baseY = h - pad - stickRadius - 10;

    state.stickBaseX = baseX;
    state.stickBaseY = baseY;
    state.stickCurX = baseX;
    state.stickCurY = baseY;

    // Botones derecha
    const btnW = Math.max(92, Math.floor(w * 0.20));
    const btnH = Math.max(72, Math.floor(h * 0.11));
    const gap = 14;

    const rightX = w - pad - btnW;
    const throttleY = h - pad - btnH * 2 - gap;
    const brakeY = h - pad - btnH;

    // Ayuda arriba (mínima)
    const hint = this.add.text(w / 2, 12, 'Táctil: joystick (izq) / acelerar-frenar (dcha)', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#b7c0ff'
    }).setOrigin(0.5, 0);

    // Joystick graphics
    const g = this.add.graphics();

    const draw = () => {
      g.clear();

      // Base
      g.fillStyle(0x0b1020, 0.35);
      g.fillCircle(state.stickBaseX, state.stickBaseY, stickRadius + 10);
      g.lineStyle(2, 0xb7c0ff, 0.25);
      g.strokeCircle(state.stickBaseX, state.stickBaseY, stickRadius + 10);

      // Knob
      const knobR = Math.floor(stickRadius * 0.46);
      g.fillStyle(0xffffff, state.leftActive ? 0.22 : 0.14);
      g.fillCircle(state.stickCurX, state.stickCurY, knobR);
      g.lineStyle(2, 0x2bff88, state.leftActive ? 0.35 : 0.0);
      if (state.leftActive) g.strokeCircle(state.stickCurX, state.stickCurY, knobR);

      // Botón throttle
      const tAlpha = state.rightThrottle ? 0.50 : 0.28;
      g.fillStyle(0x0b1020, tAlpha);
      g.fillRoundedRect(rightX, throttleY, btnW, btnH, 16);
      g.lineStyle(2, state.rightThrottle ? 0x2bff88 : 0xb7c0ff, state.rightThrottle ? 0.55 : 0.22);
      g.strokeRoundedRect(rightX, throttleY, btnW, btnH, 16);

      // Botón brake
      const bAlpha = state.rightBrake ? 0.50 : 0.28;
      g.fillStyle(0x0b1020, bAlpha);
      g.fillRoundedRect(rightX, brakeY, btnW, btnH, 16);
      g.lineStyle(2, state.rightBrake ? 0xff5a7a : 0xb7c0ff, state.rightBrake ? 0.55 : 0.22);
      g.strokeRoundedRect(rightX, brakeY, btnW, btnH, 16);

      // Textos
      // (sin assets extra; lo mantenemos simple)
    };

    // Textos encima de botones
    const tText = this.add.text(rightX + btnW / 2, throttleY + btnH / 2, 'GAS', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '16px',
      color: '#2bff88',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const bText = this.add.text(rightX + btnW / 2, brakeY + btnH / 2, 'FRENO', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '16px',
      color: '#ff5a7a',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    ui.add([g, hint, tText, bText]);

    // Guardamos geometría en state para hit-testing
    state._geom = {
      stickRadius,
      stickDead,
      stickMax,
      btnW,
      btnH,
      rightX,
      throttleY,
      brakeY,
      pad
    };

    draw();
    state._draw = draw;
  };

  buildUI();

  // Rebuild al rotar / resize
  this.scale.on('resize', () => buildUI());

  const hitThrottle = (x, y) => {
    const { rightX, throttleY, btnW, btnH } = state._geom;
    return x >= rightX && x <= rightX + btnW && y >= throttleY && y <= throttleY + btnH;
  };

  const hitBrake = (x, y) => {
    const { rightX, brakeY, btnW, btnH } = state._geom;
    return x >= rightX && x <= rightX + btnW && y >= brakeY && y <= brakeY + btnH;
  };

  const updateStick = (x, y) => {
    const { stickDead, stickMax } = state._geom;

    const baseX = state.stickBaseX;
    const baseY = state.stickBaseY;

    const d = dist(x, y, baseX, baseY);
    const clampedD = Math.min(d, stickMax);

    // vector normalizado
    let nx = 0, ny = 0;
    if (d > 0.0001) {
      nx = (x - baseX) / d;
      ny = (y - baseY) / d;
    }

    state.stickCurX = baseX + nx * clampedD;
    state.stickCurY = baseY + ny * clampedD;

    // steer solo por eje X
    const raw = (state.stickCurX - baseX) / stickMax; // -1..1
    state.steer = Math.abs(raw) < (stickDead / stickMax) ? 0 : clamp(raw, -1, 1);
  };

  // Pointer handling
  this.input.on('pointerdown', (p) => {
    // Derecha: botones
    if (p.x >= this.scale.width * 0.5) {
      state.rightId = p.id;
      state.rightThrottle = hitThrottle(p.x, p.y);
      state.rightBrake = hitBrake(p.x, p.y);
      state.throttle = state.rightThrottle ? 1 : 0;
      state.brake = state.rightBrake ? 1 : 0;
    } else {
      // Izquierda: joystick
      state.leftId = p.id;
      state.leftActive = true;
      updateStick(p.x, p.y);
    }
    state._draw?.();
  });

  this.input.on('pointermove', (p) => {
    if (!p.isDown) return;

    if (state.leftId === p.id) {
      state.leftActive = true;
      updateStick(p.x, p.y);
      state._draw?.();
      return;
    }

    if (state.rightId === p.id) {
      state.rightThrottle = hitThrottle(p.x, p.y);
      state.rightBrake = hitBrake(p.x, p.y);
      state.throttle = state.rightThrottle ? 1 : 0;
      state.brake = state.rightBrake ? 1 : 0;
      state._draw?.();
      return;
    }
  });

  this.input.on('pointerup', (p) => {
    if (state.leftId === p.id) {
      state.leftId = null;
      state.leftActive = false;
      state.steer = 0;
      state.stickCurX = state.stickBaseX;
      state.stickCurY = state.stickBaseY;
    }
    if (state.rightId === p.id) {
      state.rightId = null;
      state.rightThrottle = false;
      state.rightBrake = false;
      state.throttle = 0;
      state.brake = 0;
    }
    state._draw?.();
  });

  return state;
}
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
