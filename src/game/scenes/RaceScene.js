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

    // === Físicas afinadas (Iteración 6) ===
        // Afinado
    this.accel = 640;          // menos explosiva
this.maxFwd = 620;         // punta un poco mayor (tarda más en llegar)
this.maxRev = 260;

this.brakeForce = 980;     // freno firme, sin clavada absurda
this.engineBrake = 260;    // MUCHÍSIMO menos retención (no se para de golpe)
this.linearDrag = 0.030;   // menos drag base (desacelera menos inmediata)

this.turnRate = 3.4;
this.turnMin = 0.28;

// Agarres laterales (clave del derrape coherente)
this.gripCoast = 0.22;     // agarre lateral al soltar gas (más agarre = menos patinaje raro)
this.gripDrive = 0.06;     // agarre lateral acelerando (menos agarre = derrape bajo carga)
this.gripBrake = 0.14;     // agarre lateral frenando (intermedio)
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
        // === Car rig: body físico + sprite visual adelantado ===
    // Body físico (invisible)
    const body = this.physics.add.image(4000, 2500, null);
    body.setCircle(14); // radio físico
    body.setCollideWorldBounds(true);
    body.setBounce(0);
    body.setDrag(0, 0);

    // Sprite visual (visible) dentro de un container
    const carSprite = this.add.sprite(0, 0, 'car');

    // Offset hacia delante (punta del coche)
    // +X porque el coche mira hacia la derecha cuando rotation = 0 en este proyecto
    carSprite.x = 12;   // cuanto más, más “eje delantero”
    carSprite.y = 0;

    // Container que seguirá al body y rotará con él
    const rig = this.add.container(body.x, body.y, [carSprite]);
    rig.setDepth(5);

    // Guardar referencias
    this.carBody = body;
    this.carRig = rig;
    this.car = body; // para que tu update() siga funcionando sin tocar derrape

    // Cámara follow
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
this.cameras.main.startFollow(this.carRig, true, 0.12, 0.12);
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
    // iOS: multitouch (stick + botón a la vez)
    this.input.addPointer(2);

    // Controles táctiles visibles (solo móvil/touch, pero no molesta en desktop)
    this.touch = this.createTouchControls();
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

    // Inputs
    const t = this.touch || { steer: 0, throttle: 0, brake: 0 };

    const up =
      this.keys.up.isDown ||
      this.keys.up2.isDown ||
      t.throttle > 0.5;

    const down =
      this.keys.down.isDown ||
      this.keys.down2.isDown ||
      t.brake > 0.5;

    const left =
      this.keys.left.isDown ||
      this.keys.left2.isDown ||
      t.steer < -0.15;

    const right =
      this.keys.right.isDown ||
      this.keys.right2.isDown ||
      t.steer > 0.15;

    const body = this.car.body;

    // Dirección del coche
    const rot = this.car.rotation;
    const dirX = Math.cos(rot);
    const dirY = Math.sin(rot);

    // Velocidad actual
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);

    // Aceleración simple
    if (up && !down) {
      body.velocity.x += dirX * this.accel * dt;
      body.velocity.y += dirY * this.accel * dt;
    }

    if (down) {
      body.velocity.x -= dirX * this.brakeForce * dt;
      body.velocity.y -= dirY * this.brakeForce * dt;
    }

    // Drag
    const drag = Math.max(0, 1 - this.linearDrag * dt * 60);
    body.velocity.x *= drag;
    body.velocity.y *= drag;

    // Límite de velocidad
    // Límite de velocidad por sentido (delante vs atrás)
const fwdSpeed = body.velocity.x * dirX + body.velocity.y * dirY;

const newSpeed = Math.sqrt(
  body.velocity.x * body.velocity.x +
  body.velocity.y * body.velocity.y
);

const maxSpeed = fwdSpeed >= 0 ? this.maxFwd : this.maxRev;

if (newSpeed > maxSpeed) {
  const s = maxSpeed / newSpeed;
  body.velocity.x *= s;
  body.velocity.y *= s;
}

    // Giro
    const speed01 = clamp(speed / this.maxFwd, 0, 1);
    const turnFactor = clamp(1 - speed01, this.turnMin, 1);
    const turn = this.turnRate * turnFactor * dt;

    if (left && !right) this.car.rotation -= turn;
    if (right && !left) this.car.rotation += turn;

    // HUD
    const kmh = speed * 0.12;
    this.hud.setText(
      'RaceScene\n' +
      'Vel: ' + kmh.toFixed(0) + ' km/h\n' +
      'Zoom: ' + this.zoom.toFixed(1)
    );
           // === C) Sincronizar rig visual con body físico ===
    if (this.carRig && this.carBody) {
      this.carRig.x = this.carBody.x;
      this.carRig.y = this.carBody.y;
      this.carRig.rotation = this.carBody.rotation;
    }
  
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
    createTouchControls() {
    // UI táctil visible:
    // - Izquierda: joystick (steer analógico)
    // - Derecha: dos botones grandes (GAS / FRENO)

    const state = {
      steer: 0,
      throttle: 0,
      brake: 0,

      leftId: -1,
      rightId: -1,

      leftActive: false,
      rightThrottle: false,
      rightBrake: false,

      baseX: 0,
      baseY: 0,
      knobX: 0,
      knobY: 0,

      stickR: 0,
      stickMax: 0,

      rightX: 0,
      throttleY: 0,
      brakeY: 0,
      btnW: 0,
      btnH: 0
    };

    const ui = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    const build = () => {
      ui.removeAll(true);

      const w = this.scale.width;
      const h = this.scale.height;
      const pad = 16;

      // Stick
      const stickR = Math.max(54, Math.floor(Math.min(w, h) * 0.07));
      const stickMax = stickR * 0.85;

      const baseX = pad + stickR + 10;
      const baseY = h - pad - stickR - 10;

      state.baseX = baseX;
      state.baseY = baseY;
      state.knobX = baseX;
      state.knobY = baseY;
      state.stickR = stickR;
      state.stickMax = stickMax;

      // Botones derecha
      const btnW = Math.max(110, Math.floor(w * 0.22));
      const btnH = Math.max(78, Math.floor(h * 0.115));
      const gap = 14;

      const rightX = w - pad - btnW;
      const throttleY = h - pad - btnH * 2 - gap;
      const brakeY = h - pad - btnH;

      state.rightX = rightX;
      state.throttleY = throttleY;
      state.brakeY = brakeY;
      state.btnW = btnW;
      state.btnH = btnH;

      // Paneles de zona (para que siempre se vean)
      const zoneG = this.add.graphics();
      zoneG.fillStyle(0x000000, 0.14);

      const leftW = Math.floor(w * 0.46) - 14;
      const rightW = Math.floor(w * 0.46) - 14;

      zoneG.fillRoundedRect(10, h - 230, leftW, 220, 18);
      zoneG.lineStyle(2, 0xb7c0ff, 0.18);
      zoneG.strokeRoundedRect(10, h - 230, leftW, 220, 18);

      zoneG.fillRoundedRect(Math.floor(w * 0.54) + 4, h - 230, rightW, 220, 18);
      zoneG.lineStyle(2, 0xb7c0ff, 0.18);
      zoneG.strokeRoundedRect(Math.floor(w * 0.54) + 4, h - 230, rightW, 220, 18);

      const leftLabel = this.add.text(22, h - 220, 'GIRO', {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '12px',
        color: '#b7c0ff',
        fontStyle: 'bold'
      });

      const rightLabel = this.add.text(Math.floor(w * 0.54) + 16, h - 220, 'GAS / FRENO', {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '12px',
        color: '#b7c0ff',
        fontStyle: 'bold'
      });

      const g = this.add.graphics();

      const draw = () => {
        g.clear();

        // Base stick
        g.fillStyle(0x0b1020, 0.35);
        g.fillCircle(state.baseX, state.baseY, state.stickR + 10);
        g.lineStyle(2, 0xb7c0ff, 0.25);
        g.strokeCircle(state.baseX, state.baseY, state.stickR + 10);

        // Knob stick
        const knobR = Math.floor(state.stickR * 0.46);
        g.fillStyle(0xffffff, state.leftActive ? 0.22 : 0.14);
        g.fillCircle(state.knobX, state.knobY, knobR);
        if (state.leftActive) {
          g.lineStyle(2, 0x2bff88, 0.35);
          g.strokeCircle(state.knobX, state.knobY, knobR);
        }

        // GAS
        g.fillStyle(0x0b1020, state.rightThrottle ? 0.50 : 0.28);
        g.fillRoundedRect(state.rightX, state.throttleY, state.btnW, state.btnH, 16);
        g.lineStyle(2, state.rightThrottle ? 0x2bff88 : 0xb7c0ff, state.rightThrottle ? 0.55 : 0.22);
        g.strokeRoundedRect(state.rightX, state.throttleY, state.btnW, state.btnH, 16);

        // FRENO
        g.fillStyle(0x0b1020, state.rightBrake ? 0.50 : 0.28);
        g.fillRoundedRect(state.rightX, state.brakeY, state.btnW, state.btnH, 16);
        g.lineStyle(2, state.rightBrake ? 0xff5a7a : 0xb7c0ff, state.rightBrake ? 0.55 : 0.22);
        g.strokeRoundedRect(state.rightX, state.brakeY, state.btnW, state.btnH, 16);
      };

      const tText = this.add.text(state.rightX + state.btnW / 2, state.throttleY + state.btnH / 2, 'GAS', {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '16px',
        color: '#2bff88',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const bText = this.add.text(state.rightX + state.btnW / 2, state.brakeY + state.btnH / 2, 'FRENO', {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '16px',
        color: '#ff5a7a',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      ui.add([zoneG, leftLabel, rightLabel, g, tText, bText]);

      // Guardar draw para refrescar sin optional chaining
      state._draw = draw;
      state._draw();
    };

    build();
    this.scale.on('resize', build);

    const hitThrottle = (x, y) => {
      return x >= state.rightX && x <= state.rightX + state.btnW &&
             y >= state.throttleY && y <= state.throttleY + state.btnH;
    };

    const hitBrake = (x, y) => {
      return x >= state.rightX && x <= state.rightX + state.btnW &&
             y >= state.brakeY && y <= state.brakeY + state.btnH;
    };

    const updateStick = (x, y) => {
      const dx = x - state.baseX;
      const dy = y - state.baseY;
      const d = Math.sqrt(dx * dx + dy * dy);

      var nx = 0;
      if (d > 0.0001) nx = dx / d;

      const clamped = Math.min(d, state.stickMax);

      // knob se mueve en dirección completa, pero steer solo usa X
      const kx = state.baseX + (d > 0.0001 ? (dx / d) * clamped : 0);
      const ky = state.baseY + (d > 0.0001 ? (dy / d) * clamped : 0);

      state.knobX = kx;
      state.knobY = ky;

      // deadzone
      const raw = (state.knobX - state.baseX) / state.stickMax;
      state.steer = Math.abs(raw) < 0.12 ? 0 : clamp(raw, -1, 1);
    };

    this.input.on('pointerdown', (p) => {
      const w = this.scale.width;

      if (p.x < w * 0.5) {
        state.leftId = p.id;
        state.leftActive = true;
        updateStick(p.x, p.y);
      } else {
        state.rightId = p.id;
        state.rightThrottle = hitThrottle(p.x, p.y);
        state.rightBrake = hitBrake(p.x, p.y);
        state.throttle = state.rightThrottle ? 1 : 0;
        state.brake = state.rightBrake ? 1 : 0;
      }

      if (state._draw) state._draw();
    });

    this.input.on('pointermove', (p) => {
      if (!p.isDown) return;

      if (state.leftId === p.id) {
        state.leftActive = true;
        updateStick(p.x, p.y);
        if (state._draw) state._draw();
        return;
      }

      if (state.rightId === p.id) {
        state.rightThrottle = hitThrottle(p.x, p.y);
        state.rightBrake = hitBrake(p.x, p.y);
        state.throttle = state.rightThrottle ? 1 : 0;
        state.brake = state.rightBrake ? 1 : 0;
        if (state._draw) state._draw();
      }
    });

    this.input.on('pointerup', (p) => {
      if (state.leftId === p.id) {
        state.leftId = -1;
        state.leftActive = false;
        state.steer = 0;
        state.knobX = state.baseX;
        state.knobY = state.baseY;
      }

      if (state.rightId === p.id) {
        state.rightId = -1;
        state.rightThrottle = false;
        state.rightBrake = false;
        state.throttle = 0;
        state.brake = 0;
      }

      if (state._draw) state._draw();
    });

    return state;
  }
}
