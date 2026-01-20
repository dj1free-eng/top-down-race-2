import Phaser from 'phaser';
import { makeTrack01Oval } from '../tracks/track01_oval.js';
import { buildTrackRibbon } from '../tracks/TrackBuilder.js';
import { CAR_SPECS } from '../cars/carSpecs.js';
import { resolveCarParams } from '../cars/resolveCarParams.js';
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function wrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export class RaceScene extends Phaser.Scene {
  constructor() {
    super('race');

    this.worldW = 8000;
    this.worldH = 5000;

    this.car = null;
    this.keys = null;

    this.zoom = 1.0;

// === Car params (BaseSpec + Tuning) ===
// Selector simple de coche (cambia este id para probar)
// Opciones: 'stock' | 'touring' | 'power'
const CAR_ID = 'stock';

const data = this.scene.settings.data || {};
const carId = data.carId || localStorage.getItem('tdr2:carId') || 'stock';
const baseSpec = CAR_SPECS[carId] || CAR_SPECS.stock;

// Tornillos por defecto (neutros)
// (más adelante podrás cargarlos de localStorage o aplicar upgrades)
this.tuning = {
  accelMult: 1.0,
  brakeMult: 1.0,
  dragMult: 1.0,
  turnRateMult: 1.0,
  maxFwdAdd: 0,
  maxRevAdd: 0,
  turnMinAdd: 0
};

this.carParams = resolveCarParams(baseSpec, this.tuning);

// Asignación FINAL a la física (una sola fuente de verdad)
this.accel = this.carParams.accel;
this.maxFwd = this.carParams.maxFwd;
this.maxRev = this.carParams.maxRev;

this.brakeForce = this.carParams.brakeForce;
this.engineBrake = this.carParams.engineBrake; // si no existe en spec, lo añadimos en el paso 2
this.linearDrag = this.carParams.linearDrag;

this.turnRate = this.carParams.turnRate;
this.turnMin = this.carParams.turnMin;

// Agarres laterales (se mantienen porque forman parte del “feeling”)
this.gripCoast = this.carParams.gripCoast;
this.gripDrive = this.carParams.gripDrive;
this.gripBrake = this.carParams.gripBrake;
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
this.targetHeading = this.car.rotation;
    // === Track 01 (óvalo) + TrackBuilder ribbon + culling ===
const t01 = makeTrack01Oval();

// Asegura mundo grande si aún no lo tenías así
this.worldW = t01.worldW;
this.worldH = t01.worldH;
this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);

// Recolocar coche al start del track
this.car.setPosition(t01.start.x, t01.start.y);
this.car.rotation = t01.start.r;

// Construimos geometría de pista
this.track = {
  meta: t01,
  geom: buildTrackRibbon({
    centerline: t01.centerline,
    trackWidth: t01.trackWidth,
    sampleStepPx: 12,  // dentro de 10–20
    cellSize: 400
  }),
  // pool de graphics por celda
  gfxByCell: new Map(),
  activeCells: new Set(),
  cullRadiusCells: 2
};

// Render: asfalto como ribbon (polígonos)
this.trackAsphaltColor = 0x2a2f3a;

// Debug opcional (si quieres luego): this.trackDebug = true/false
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
    })
      .setScrollFactor(0).setDepth(10);

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
  const t = this.touch || { steer: 0, throttle: 0, brake: 0, stickX: 0, stickY: 0 };

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
  this.keys.left2.isDown;

const right =
  this.keys.right.isDown ||
  this.keys.right2.isDown;

  const body = this.car.body;

  // Dirección del coche
  const rot = this.car.rotation;
  const dirX = Math.cos(rot);
  const dirY = Math.sin(rot);

  // Velocidad actual
  const vx = body.velocity.x;
  const vy = body.velocity.y;
  const speed = Math.sqrt(vx * vx + vy * vy);

  // Aceleración / freno
  if (up && !down) {
    body.velocity.x += dirX * this.accel * dt;
    body.velocity.y += dirY * this.accel * dt;
  }
  if (down) {
    body.velocity.x -= dirX * this.brakeForce * dt;
    body.velocity.y -= dirY * this.brakeForce * dt;
  }

  // Drag base
  const drag = Math.max(0, 1 - this.linearDrag * dt * 60);
  body.velocity.x *= drag;
  body.velocity.y *= drag;

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

  // Giro (depende de velocidad)
  const speed01 = clamp(speed / this.maxFwd, 0, 1);
  const turnFactor = clamp(1 - speed01, this.turnMin, 1);
  const maxTurn = this.turnRate * turnFactor; // rad/s

  // 1) Teclado: volante clásico (relativo)
  if (left && !right) this.car.rotation -= maxTurn * dt;
  if (right && !left) this.car.rotation += maxTurn * dt;

  // 2) Táctil: SOLO gira mientras el stick está activo.
  // Y NO permitimos girar en parado total (para evitar trompos “sobre el eje”).
  const stickMag = Math.sqrt(t.stickX * t.stickX + t.stickY * t.stickY);
  const movingEnough = speed > 8; // umbral pequeño (px/s)
  const applyingPower = up || down; // gas o freno pulsados

  if (!left && !right && stickMag > 0.15 && (movingEnough || applyingPower)) {
    // OJO: aquí NO va +PI/2 en tu proyecto.
const target = t.targetAngle;
if (typeof target !== 'number') return; // por seguridad
const diff = wrapPi(target - this.car.rotation);

    // Para cuando llega (evita que se quede corrigiendo infinitamente)
    const EPS = 0.02; // ~1.1º
    if (Math.abs(diff) > EPS) {
      const step = clamp(diff, -maxTurn * dt, maxTurn * dt);
      this.car.rotation += step;
    } else {
      this.car.rotation = target;
    }
  }
// === Track culling render (solo celdas cercanas) ===
if (this.track && this.track.geom && this.track.geom.cells) {
  const cellSize = this.track.geom.cellSize;
  const cx = Math.floor(this.car.x / cellSize);
  const cy = Math.floor(this.car.y / cellSize);

  const want = new Set();
  const R = this.track.cullRadiusCells;

  for (let yy = cy - R; yy <= cy + R; yy++) {
    for (let xx = cx - R; xx <= cx + R; xx++) {
      want.add(`${xx},${yy}`);
    }
  }

  // Ocultar celdas que ya no se quieren
  for (const key of this.track.activeCells) {
    if (!want.has(key)) {
      const g = this.track.gfxByCell.get(key);
      if (g) g.setVisible(false);
    }
  }

  // Mostrar/crear las que sí se quieren
  for (const key of want) {
    const cellData = this.track.geom.cells.get(key);
    if (!cellData) continue;

    let g = this.track.gfxByCell.get(key);
    if (!g) {
      g = this.add.graphics();
g.setDepth(1); // pista por debajo del coche
      this.track.gfxByCell.set(key, g);
    }

    if (!g.visible) g.setVisible(true);

    // Redibujamos (simple y robusto; optimizable luego)
    g.clear();
g.fillStyle(this.trackAsphaltColor, 1);

    for (const poly of cellData.polys) {
      g.beginPath();
      g.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) g.lineTo(poly[i].x, poly[i].y);
      g.closePath();
      g.fillPath();
    }
  }

  this.track.activeCells = want;
}
  // HUD
  const kmh = speed * 0.12;
  this.hud.setText(
    'RaceScene\n' +
    'Vel: ' + kmh.toFixed(0) + ' km/h\n' +
    'Zoom: ' + this.zoom.toFixed(1)
  );

  // Sincronizar rig visual con body físico
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
      stickX: 0,
      stickY: 0,
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

// stick estable: dirección unitaria + deadzone por distancia
const dead = state.stickMax * 0.18;

if (d < dead) {
  state.stickX = 0;
  state.stickY = 0;
} else {
  state.stickX = dx / d;
  state.stickY = dy / d;
}

// mantenemos steer por compatibilidad
state.steer = state.stickX;
      // Guardar ángulo objetivo estable del stick
if (state.stickX === 0 && state.stickY === 0) {
  state.targetAngle = null;
} else {
  state.targetAngle = Math.atan2(state.stickY, state.stickX);
}
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
