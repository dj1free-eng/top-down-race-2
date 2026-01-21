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

    this.hud = null;

    // Upgrades/UI refs
    this.carId = 'stock';
    this.upgrades = { engine: 0, brakes: 0, tires: 0 };
    this.UPGRADE_CAPS = { engine: 3, brakes: 3, tires: 3 };

    this.upUI = null;
    this.upTxt = null;
    this._saveUpgrades = null;
    this.buyUpgrade = null;

    // Car rig
    this.carBody = null;
    this.carRig = null;
  }

  init(data) {
    // 1) Resolver coche seleccionado (prioridad: data -> localStorage -> stock)
    this.carId = data?.carId || localStorage.getItem('tdr2:carId') || 'stock';

    // 2) Base spec
    const baseSpec = CAR_SPECS[this.carId] || CAR_SPECS.stock;

    // === UPGRADES: cargar niveles por coche ===
    const upgradesKey = `tdr2:upgrades:${this.carId}`;
    const defaultUpgrades = { engine: 0, brakes: 0, tires: 0 };

    try {
      this.upgrades = JSON.parse(localStorage.getItem(upgradesKey) || 'null') || defaultUpgrades;
    } catch {
      this.upgrades = defaultUpgrades;
    }

    // Convierte niveles -> “tornillos”
    const tuningFromUpgrades = (u) => {
      const engineLv = u.engine || 0;
      const brakesLv = u.brakes || 0;
      const tiresLv  = u.tires  || 0;

      return {
        // Motor
        accelMult: 1.0 + engineLv * 0.08, // +8% por nivel
        maxFwdAdd: engineLv * 35,         // +35 px/s por nivel

        // Frenos
        brakeMult: 1.0 + brakesLv * 0.10, // +10% por nivel

        // Otros neutros (por ahora)
        dragMult: 1.0,
        turnRateMult: 1.0,
        turnMinAdd: 0,
        maxRevAdd: 0,

        // Neumáticos (si tu resolveCarParams los usa, perfecto; si no, se ignoran sin romper)
        gripDriveAdd: tiresLv * 0.02,
        gripCoastAdd: tiresLv * 0.01,
        gripBrakeAdd: tiresLv * 0.015
      };
    };

    // Tuning derivado desde upgrades
    this.tuning = tuningFromUpgrades(this.upgrades);

    // Helper para aplicar params al “motor”
    this.applyCarParams = () => {
      this.carParams = resolveCarParams(baseSpec, this.tuning);

      this.accel = this.carParams.accel;
      this.maxFwd = this.carParams.maxFwd;
      this.maxRev = this.carParams.maxRev;

      this.brakeForce = this.carParams.brakeForce;
      this.engineBrake = this.carParams.engineBrake;
      this.linearDrag = this.carParams.linearDrag;

      this.turnRate = this.carParams.turnRate;
      this.turnMin = this.carParams.turnMin;

      this.gripCoast = this.carParams.gripCoast;
      this.gripDrive = this.carParams.gripDrive;
      this.gripBrake = this.carParams.gripBrake;
    };

    this.applyCarParams();

    // Guardar upgrades
    this._saveUpgrades = () => {
      try { localStorage.setItem(upgradesKey, JSON.stringify(this.upgrades)); } catch {}
    };

    // Comprar upgrades
    this.buyUpgrade = (kind) => {
      const cap = this.UPGRADE_CAPS[kind] ?? 0;
      const cur = this.upgrades[kind] ?? 0;
      if (cur >= cap) return false;

      this.upgrades[kind] = cur + 1;
      this._saveUpgrades();

      this.tuning = tuningFromUpgrades(this.upgrades);
      this.applyCarParams();

      return true;
    };
  }

  create() {
    // World bounds
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

    // Texturas procedurales
    this.ensureBgTexture();
    this.ensureCarTexture();

    // Fondo
    this.add.tileSprite(0, 0, this.worldW, this.worldH, 'bgGrid').setOrigin(0);

    // === Car rig: body físico + sprite visual adelantado ===
    const body = this.physics.add.image(4000, 2500, null);
    body.setCircle(14);
    body.setCollideWorldBounds(true);
    body.setBounce(0);
    body.setDrag(0, 0);

    const carSprite = this.add.sprite(0, 0, 'car');
    carSprite.x = 12;
    carSprite.y = 0;

    const rig = this.add.container(body.x, body.y, [carSprite]);
    rig.setDepth(5);

    this.carBody = body;
    this.carRig = rig;
    this.car = body; // para tu update()

    // === Track 01 (óvalo) + TrackBuilder ribbon + culling ===
    const t01 = makeTrack01Oval();

    this.worldW = t01.worldW;
    this.worldH = t01.worldH;
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);

    // Recolocar coche al start del track
    this.car.setPosition(t01.start.x, t01.start.y);
    this.car.rotation = t01.start.r;

    this.track = {
      meta: t01,
      geom: buildTrackRibbon({
        centerline: t01.centerline,
        trackWidth: t01.trackWidth,
        sampleStepPx: 12,
        cellSize: 400
      }),
      gfxByCell: new Map(),
      activeCells: new Set(),
      cullRadiusCells: 2
    };
      this.trackAsphaltColor = 0x2a2f3a;
  
    // === DEBUG: línea de meta (roja) ===
// OJO: según tu track puede llamarse finish o finishLine.
// Probamos ambos para que lo veas sí o sí.
const finish = t01.finish || t01.finishLine;

if (finish?.a && finish?.b) {
  this.finishGfx = this.add.graphics();
  this.finishGfx.lineStyle(6, 0xff2d2d, 1);
  this.finishGfx.beginPath();
  this.finishGfx.moveTo(finish.a.x, finish.a.y);
  this.finishGfx.lineTo(finish.b.x, finish.b.y);
  this.finishGfx.strokePath();
  this.finishGfx.setDepth(50); // por encima de la pista
} else {
  console.warn('No se encontró finish/finishLine en el track:', t01);
}
// === META: datos + estado de vueltas ===
this.finishLine = t01.finishLine || t01.finish; // según cómo lo llames en el track
this.lapCount = 0;

// Guardamos "de qué lado" veníamos para detectar cruce con cambio de signo
this.lastFinishSide = null;

// Para evaluar cruce entre frame anterior y actual (segmento de movimiento)
this.prevCarX = this.car.x;
this.prevCarY = this.car.y;
    // Cámara follow
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

    // HUD principal (arriba-izquierda)
    this.hud = this.add.text(12, 12, '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '14px',
      color: '#ffffff'
    }).setScrollFactor(0).setDepth(1100);

    // iOS: multitouch (stick + botón a la vez)
    this.input.addPointer(2);

    // Controles táctiles
    this.touch = this.createTouchControls();

    // === UI Upgrades (arriba-derecha) ===
    this.buildUpgradesUI();

    // Volver al menú
    this.keys.back.on('down', () => {
      this.scene.start('menu');
    });
  }

  buildUpgradesUI() {
    // Si ya existía (por reinicio de escena) la destruimos
    if (this.upUI) {
      this.upUI.destroy(true);
      this.upUI = null;
      this.upTxt = null;
    }

    const pad = 12;
    const boxW = 220;
    const boxH = 134;

    const uiX = this.scale.width - pad - boxW;
    const uiY = pad;

    this.upUI = this.add.container(0, 0).setScrollFactor(0).setDepth(1200);

    const bg = this.add.rectangle(uiX, uiY, boxW, boxH, 0x0b1020, 0.45)
      .setOrigin(0)
      .setStrokeStyle(1, 0xb7c0ff, 0.18);

    const title = this.add.text(uiX + 12, uiY + 10, 'UPGRADES', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#b7c0ff',
      fontStyle: 'bold'
    });

    this.upTxt = this.add.text(uiX + 12, uiY + 30, '', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '12px',
      color: '#ffffff',
      lineSpacing: 4
    });

    const makeBtn = (x, y, label, onClick) => {
      const bw = 66, bh = 28;

      const r = this.add.rectangle(x, y, bw, bh, 0x0b1020, 0.35)
        .setOrigin(0)
        .setStrokeStyle(1, 0x2bff88, 0.20);

      const t = this.add.text(x + bw / 2, y + bh / 2, label, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: '12px',
        color: '#2bff88',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      r.setInteractive({ useHandCursor: true });
      r.on('pointerdown', () => onClick());

      return [r, t];
    };

    const refresh = () => {
      const u = this.upgrades || { engine: 0, brakes: 0, tires: 0 };
      this.upTxt.setText(
        `Motor:  ${u.engine}/${this.UPGRADE_CAPS.engine}\n` +
        `Frenos: ${u.brakes}/${this.UPGRADE_CAPS.brakes}\n` +
        `Neum.:  ${u.tires}/${this.UPGRADE_CAPS.tires}`
      );
    };

    const btnY = uiY + 92;
    const [b1, t1] = makeBtn(uiX + 12,  btnY, 'MOTOR+', () => { if (this.buyUpgrade) this.buyUpgrade('engine'); refresh(); });
    const [b2, t2] = makeBtn(uiX + 80,  btnY, 'FRENO+', () => { if (this.buyUpgrade) this.buyUpgrade('brakes'); refresh(); });
    const [b3, t3] = makeBtn(uiX + 148, btnY, 'NEUM+',  () => { if (this.buyUpgrade) this.buyUpgrade('tires');  refresh(); });

    this.upUI.add([bg, title, this.upTxt, b1, t1, b2, t2, b3, t3]);
    refresh();

    // Reposicionar si rota/cambia tamaño
    this.scale.off('resize', this._onResizeUpUI);
    this._onResizeUpUI = () => this.buildUpgradesUI();
    this.scale.on('resize', this._onResizeUpUI);
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

    // Límite de velocidad por sentido
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

    // 1) Teclado: volante clásico
    if (left && !right) this.car.rotation -= maxTurn * dt;
    if (right && !left) this.car.rotation += maxTurn * dt;

    // 2) Táctil: alineamiento por stick (solo si hay stick activo)
const stickMag = Math.sqrt(t.stickX * t.stickX + t.stickY * t.stickY);
const movingEnough = speed > 8; // umbral pequeño (px/s)
if (!left && !right && stickMag > 0.15 && movingEnough) {
const target = Math.atan2(t.stickY, t.stickX);
      const diff = wrapPi(target - this.car.rotation);

      const EPS = 0.02;
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
          g.setDepth(1);
          this.track.gfxByCell.set(key, g);
        }

        if (!g.visible) g.setVisible(true);

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
// === VUELTAS: detectar cruce de línea de meta ===
if (this.finishLine?.a && this.finishLine?.b && this.finishLine?.normal) {
  const a = this.finishLine.a;
  const b = this.finishLine.b;
  const n = this.finishLine.normal; // normal apuntando "hacia delante" de carrera

  const x0 = this.prevCarX;
  const y0 = this.prevCarY;
  const x1 = this.car.x;
  const y1 = this.car.y;

  // Distancia firmada a la recta de meta (usando normal)
  const side0 = (x0 - a.x) * n.x + (y0 - a.y) * n.y;
  const side1 = (x1 - a.x) * n.x + (y1 - a.y) * n.y;

  // Comprobamos si el punto está "a la altura" del segmento AB (proyección 0..1)
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;

  const proj0 = len2 > 0 ? ((x0 - a.x) * abx + (y0 - a.y) * aby) / len2 : -1;
  const proj1 = len2 > 0 ? ((x1 - a.x) * abx + (y1 - a.y) * aby) / len2 : -1;

  const within0 = proj0 >= 0 && proj0 <= 1;
  const within1 = proj1 >= 0 && proj1 <= 1;

  // Inicializar lado la primera vez
  if (this.lastFinishSide === null) this.lastFinishSide = side1;

  // Cruce válido: veníamos "antes" (lado negativo) y pasamos a "después" (lado positivo),
  // y el movimiento pasa por la zona del segmento.
  const crossedForward = (side0 < 0 && side1 >= 0);
  const crossedInSegment = within0 || within1;

  if (crossedForward && crossedInSegment) {
    this.lapCount += 1;
    // Evita dobles conteos si te quedas encima
    this.lastFinishSide = side1 + 0.0001;
  } else {
    this.lastFinishSide = side1;
  }

  // Actualizar prev para el próximo frame
  this.prevCarX = x1;
  this.prevCarY = y1;
}
    // HUD
    const kmh = speed * 0.12;
    const u = this.upgrades || { engine: 0, brakes: 0, tires: 0 };

    this.hud.setText(
      'RaceScene\n' +
      `Vueltas: ${this.lapCount}\n` +
      `Car: ${this.carId} | Upg E${u.engine} B${u.brakes} T${u.tires}\n` +
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

    rt.fill(0x0b1020, 1);

    const g = this.add.graphics();
    g.lineStyle(1, 0xffffff, 0.06);
    for (let i = 0; i <= size; i += 64) {
      g.lineBetween(i, 0, i, size);
      g.lineBetween(0, i, size, i);
    }

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

    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(2, 4, w, h, 10);

    g.fillStyle(0xffffff, 0.95);
    g.fillRoundedRect(0, 0, w, h, 10);

    g.fillStyle(0x141b33, 0.9);
    g.fillRoundedRect(16, 6, 18, 14, 6);

    g.fillStyle(0x2bff88, 0.95);
    g.fillRoundedRect(34, 9, 10, 8, 4);

    g.lineStyle(2, 0x0b1020, 0.6);
    g.strokeRoundedRect(0, 0, w, h, 10);

    g.generateTexture('car', w + 4, h + 6);
    g.destroy();
  }

  createTouchControls() {
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

        g.fillStyle(0x0b1020, 0.35);
        g.fillCircle(state.baseX, state.baseY, state.stickR + 10);
        g.lineStyle(2, 0xb7c0ff, 0.25);
        g.strokeCircle(state.baseX, state.baseY, state.stickR + 10);

        const knobR = Math.floor(state.stickR * 0.46);
        g.fillStyle(0xffffff, state.leftActive ? 0.22 : 0.14);
        g.fillCircle(state.knobX, state.knobY, knobR);
        if (state.leftActive) {
          g.lineStyle(2, 0x2bff88, 0.35);
          g.strokeCircle(state.knobX, state.knobY, knobR);
        }

        g.fillStyle(0x0b1020, state.rightThrottle ? 0.50 : 0.28);
        g.fillRoundedRect(state.rightX, state.throttleY, state.btnW, state.btnH, 16);
        g.lineStyle(2, state.rightThrottle ? 0x2bff88 : 0xb7c0ff, state.rightThrottle ? 0.55 : 0.22);
        g.strokeRoundedRect(state.rightX, state.throttleY, state.btnW, state.btnH, 16);

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

      state._draw = draw;
      state._draw();
    };

    build();
    this.scale.on('resize', build);

    const hitThrottle = (x, y) =>
      x >= state.rightX && x <= state.rightX + state.btnW &&
      y >= state.throttleY && y <= state.throttleY + state.btnH;

    const hitBrake = (x, y) =>
      x >= state.rightX && x <= state.rightX + state.btnW &&
      y >= state.brakeY && y <= state.brakeY + state.btnH;

    const updateStick = (x, y) => {
      const dx = x - state.baseX;
      const dy = y - state.baseY;
      const d = Math.sqrt(dx * dx + dy * dy);

      const clamped = Math.min(d, state.stickMax);

      const kx = state.baseX + (d > 0.0001 ? (dx / d) * clamped : 0);
      const ky = state.baseY + (d > 0.0001 ? (dy / d) * clamped : 0);

      state.knobX = kx;
      state.knobY = ky;

      const rawX = (state.knobX - state.baseX) / state.stickMax;
      const rawY = (state.knobY - state.baseY) / state.stickMax;

      state.stickX = Math.abs(rawX) < 0.12 ? 0 : clamp(rawX, -1, 1);
      state.stickY = Math.abs(rawY) < 0.12 ? 0 : clamp(rawY, -1, 1);

      state.steer = state.stickX;
      // Ángulo objetivo del stick (para dirección absoluta)
if (state.stickX === 0 && state.stickY === 0) {
  state.targetAngle = null;
} else {
  // Corrección -90º para que "arriba" del stick sea "arriba" en el coche
  state.targetAngle = Math.atan2(state.stickY, state.stickX) - (Math.PI / 2);
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
        state.stickX = 0;
        state.stickY = 0;
        state.targetAngle = null;
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
