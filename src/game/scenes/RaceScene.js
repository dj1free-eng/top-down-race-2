import Phaser from 'phaser';
import { makeTrack01Oval } from '../tracks/track01_oval.js';
import { makeTrack02Technical } from '../tracks/track02_technical.js';
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

    // 1.1) Resolver circuito seleccionado (prioridad: data -> localStorage -> track02)
    const incomingTrack = data?.trackKey;
    const savedTrack = localStorage.getItem('tdr2:trackKey');

    const valid = (k) => (k === 'track01' || k === 'track02');

    this.trackKey = valid(incomingTrack)
      ? incomingTrack
      : (valid(savedTrack) ? savedTrack : 'track02');

    localStorage.setItem('tdr2:trackKey', this.trackKey);

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
  _hideMissingTextures() {
  const missKeys = new Set(['__MISSING', '__missing', 'missing', 'MISSING']);
  let count = 0;
  const offenders = [];

  for (const obj of this.children.list) {
    // Muchos objetos no tienen texture/frame
    const key1 = obj?.texture?.key;
    const key2 = obj?.frame?.texture?.key;

    const isMissing =
      (typeof key1 === 'string' && missKeys.has(key1)) ||
      (typeof key2 === 'string' && missKeys.has(key2));

    if (isMissing) {
      count++;
      // guardamos info útil
      offenders.push(
        `${obj.constructor?.name || 'Object'} key=${key1 || key2 || '??'}`
      );

      // lo ocultamos para que deje de “ensuciar” la pantalla
      if (obj.setVisible) obj.setVisible(false);
      if (obj.setActive) obj.setActive(false);
    }
  }

  // Te lo saco por pantalla (y también consola por si acaso)
  const msg = count
    ? `MISSING FOUND: ${count}\n${offenders.slice(0, 6).join('\n')}`
    : `MISSING FOUND: 0`;

  console.log(msg);
  if (this._dbgSet) this._dbgSet(msg);

  return { count, offenders };
}
  _dbg(msg) {
  if (!this._dbgText) {
    this._dbgText = this.add.text(12, 130, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffcc66',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: { x: 6, y: 4 }
    }).setScrollFactor(0).setDepth(5000);
  }
  this._dbgText.setText(msg);
}
    _hudLog(msg) {
    // Logs en pantalla (mata-logs friendly)
    try { this._dbg(String(msg)); } catch {}
  }
  create() {
    // Alias compatible con código viejo
    this._dbgSet = (m) => this._dbg(m);
    // 1) Track meta primero (define world real)
const t01 = (this.trackKey === 'track01') ? makeTrack01Oval() : makeTrack02Technical();


    this.worldW = t01.worldW;
    this.worldH = t01.worldH;

    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);
    this.cameras.main.setBounds(0, 0, this.worldW, this.worldH);
// Producción: asegurar que NO hay debug gráfico de físicas (si se creó en algún momento)
this.physics.world.drawDebug = false;

if (this.physics.world.debugGraphic) {
  this.physics.world.debugGraphic.clear();
  this.physics.world.debugGraphic.destroy();
  this.physics.world.debugGraphic = null;
}
// 2) Texturas procedurales (no deben romper la escena)
try { this.ensureBgTexture(); } catch (e) {}
try {
  this.ensureAsphaltTexture();
  this._dbg('asphalt OK');
} catch (e) {
  this._dbg('asphalt ERROR');
}
try { this.ensureCarTexture(); } catch (e) {}

// 3) Fondo del mundo: SOLO grass (sin bgGrid en producción)
const bgKey = this.textures.exists('grass') ? 'grass' : null;

if (bgKey) {
  this.bgWorld = this.add.tileSprite(0, 0, this.worldW, this.worldH, bgKey)
    .setOrigin(0, 0)
    .setScrollFactor(1)
    .setDepth(0); // césped debajo del asfalto (asfalto está en depth 10)
  this.bgKey = bgKey;
} else {
  this.bgWorld = null;
  this.add.rectangle(0, 0, this.worldW, this.worldH, 0x111111, 1)
    .setOrigin(0, 0)
    .setDepth(0);
}

    // 4) Coche (body físico + rig visual)
    // Cuerpo físico SIN sprite (evita __MISSING)
const body = this.physics.add.sprite(t01.start.x, t01.start.y, '__BODY__');
body.setVisible(false);
body.setCircle(14);
body.setCollideWorldBounds(true);
body.setBounce(0);
body.setDrag(0, 0);
body.rotation = t01.start.r;

    const carSprite = this.add.sprite(0, 0, 'car');
    carSprite.x = 12;
    carSprite.y = 0;

    const rig = this.add.container(body.x, body.y, [carSprite]);
    rig.setDepth(30);

    this.carBody = body;
    this.carRig = rig;
    this.car = body; // compat con tu update()

// 5) Track ribbon (geom + culling state)
this.track = {
  meta: t01,
  geom: buildTrackRibbon({
    centerline: t01.centerline,
    trackWidth: t01.trackWidth,
    sampleStepPx: 22,
    cellSize: 400
  }),
  gfxByCell: new Map(),
  activeCells: new Set(),
  cullRadiusCells: 2
};
    this._cullEnabled = true;
this._hudLog(`[track geom] cells=${this.track.geom?.cells?.size ?? 'null'}`);
 this._trackCells = this.track.geom?.cells?.size ?? null;
this._trackDiag = `cells=${this._trackCells}`;
this._trackDiag2 = '';
    this.trackAsphaltColor = 0x2a2f3a;

    // 6) Meta y vueltas (datos)
    this.finishLine = t01.finishLine || t01.finish;
    this.lapCount = 0;
    this.lastFinishSide = null;
    this.prevCarX = this.car.x;
    this.prevCarY = this.car.y;
    this._lapCooldownMs = 0;

    // Debug: línea de meta (si existe)
    const finish = t01.finish || t01.finishLine;
    if (finish?.a && finish?.b) {
      this.finishGfx = this.add.graphics();
      this.finishGfx.lineStyle(6, 0xff2d2d, 1);
      this.finishGfx.beginPath();
      this.finishGfx.moveTo(finish.a.x, finish.a.y);
      this.finishGfx.lineTo(finish.b.x, finish.b.y);
      this.finishGfx.strokePath();
      this.finishGfx.setDepth(50);
    }

    // 7) Cámara
    this.cameras.main.startFollow(this.carRig, true, 0.12, 0.12);
    this.cameras.main.setZoom(this.zoom);

    // 8) Input teclado
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
  back: Phaser.Input.Keyboard.KeyCodes.ESC,

  // DEBUG: alternar culling
  toggleCull: Phaser.Input.Keyboard.KeyCodes.C
});


      // HUD (caja + texto legible)
const hudX = 12;
const hudY = 12;

this.hudBox = this.add.rectangle(hudX, hudY, 340, 98, 0x000000, 0.55)
  .setOrigin(0, 0)
  .setScrollFactor(0)
  .setDepth(1099)
  .setStrokeStyle(1, 0xffffff, 0.12);

this.hud = this.add.text(hudX + 10, hudY + 8, '', {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
  fontSize: '13px',
  color: '#ffffff',
  lineSpacing: 3
}).setScrollFactor(0).setDepth(1100);

// Ajuste automático del alto de la caja según el texto (para que no tape)
// Ajuste automático del alto de la caja según el texto (para que no tape)
this._fitHud = () => {
  const w = 340;
  const h = Math.max(68, (this.hud.height || 0) + 16);
  this.hudBox.setSize(w, h);
};

// =================================================
// DEBUG_ZOOM_UI (táctil) — borrar cuando no haga falta
// =================================================
const makeZoomBtn = (x, y, label, onClick) => {
  const bw = 44, bh = 32;

  const r = this.add.rectangle(x, y, bw, bh, 0x000000, 0.55)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(1101)
    .setStrokeStyle(1, 0xffffff, 0.18);

  const t = this.add.text(x + bw / 2, y + bh / 2, label, {
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
    fontSize: '18px',
    color: '#ffffff',
    fontStyle: 'bold'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(1102);

  r.setInteractive({ useHandCursor: true });
  r.on('pointerdown', () => onClick());

  return { r, t };
};

// Colócalos a la derecha del HUD
const zoomBtnX = hudX + 340 + 10;
const zoomBtnY = hudY;

// + (zoom in)
this._zoomBtnPlus = makeZoomBtn(zoomBtnX, zoomBtnY, '+', () => {
  this.zoom = clamp((this.zoom ?? 1) + 0.1, 0.6, 1.6);
  this.cameras.main.setZoom(this.zoom);
});

// − (zoom out)
this._zoomBtnMinus = makeZoomBtn(zoomBtnX, zoomBtnY + 38, '−', () => {
  this.zoom = clamp((this.zoom ?? 1) - 0.1, 0.6, 1.6);
  this.cameras.main.setZoom(this.zoom);
});

// CULL (toggle)
this._zoomBtnCull = makeZoomBtn(zoomBtnX, zoomBtnY + 76, 'CULL', () => {
  this._cullEnabled = !this._cullEnabled;
  this._hudLog(`[culling] ${this._cullEnabled ? 'ON' : 'OFF'}`);
});


    // 10) iOS multitouch + controles táctiles
    this.input.addPointer(2);
    this.touch = this.createTouchControls();

    // 11) UI Upgrades
    this.buildUpgradesUI();
// =================================================
// UI CAMERA (HUD no afectado por zoom del mundo)
// =================================================
this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
this.uiCam.setScroll(0, 0);
this.uiCam.setZoom(1);

// 1) La cámara principal NO debe renderizar UI
this.cameras.main.ignore([
  this.hudBox,
  this.hud,
  this.upUI,
  this._dbgText,

  // Botones de zoom
  this._zoomBtnPlus?.r,
  this._zoomBtnPlus?.t,
  this._zoomBtnMinus?.r,
  this._zoomBtnMinus?.t,
this._zoomBtnCull?.r,
this._zoomBtnCull?.t,
  // Controles táctiles
  this.touchUI
].filter(Boolean));


// 2) La cámara UI NO debe renderizar mundo (lo que ya existe ahora)
if (this.bgWorld) this.uiCam.ignore(this.bgWorld);
if (this.carRig) this.uiCam.ignore(this.carRig);
if (this.finishGfx) this.uiCam.ignore(this.finishGfx);

// Mantener tamaño si rota/cambia viewport
this.scale.on('resize', (gameSize) => {
  this.uiCam.setSize(gameSize.width, gameSize.height);
});

  // 12) Volver al menú
  if (this.keys?.back) {
    this.keys.back.on('down', () => this.scene.start('menu'));
  }

  // =================================================
  // 👇 AQUÍ VA EL PUNTO B (ESTO ES LO QUE AÑADES)
  // =================================================

  // 🔎 Detecta y apaga cualquier objeto con textura missing
  this._hideMissingTextures();

  // Re-chequeo por si algo aparece tras resize / UI
  this.time.delayedCall(250, () => this._hideMissingTextures());
  this.time.delayedCall(800, () => this._hideMissingTextures());

  // Flag para update()
  this._trackReady = true;


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
    const dt = Math.min(0.05, (deltaMs || 0) / 1000);

    // Guardas duras: si create() no terminó, no reventamos el loop.
    if (!this.cameras?.main) return;

    // Si no hay coche todavía, como mínimo no crashees.
    if (!this.car || !this.car.body) {

      return;
    }

    // Keys pueden no existir si create() se cortó antes de input
    const keys = this.keys || {};
    const justDown = Phaser?.Input?.Keyboard?.JustDown;

    // Zoom (solo si existen teclas)
    if (justDown && keys.zoomIn && justDown(keys.zoomIn)) {
      this.zoom = clamp((this.zoom ?? 1) + 0.1, 0.6, 1.6);
      this.cameras.main.setZoom(this.zoom);
    }
    if (justDown && keys.zoomOut && justDown(keys.zoomOut)) {
      this.zoom = clamp((this.zoom ?? 1) - 0.1, 0.6, 1.6);
      this.cameras.main.setZoom(this.zoom);
    }
// DEBUG: toggle culling (ON / OFF)
if (justDown && keys.toggleCull && justDown(keys.toggleCull)) {
  this._cullEnabled = !this._cullEnabled;
  this._hudLog(`[culling] ${this._cullEnabled ? 'ON' : 'OFF'}`);
}
    // Inputs
    const t = this.touch || { steer: 0, throttle: 0, brake: 0, stickX: 0, stickY: 0 };

    const up =
      (keys.up?.isDown) ||
      (keys.up2?.isDown) ||
      (t.throttle > 0.5);

    const down =
      (keys.down?.isDown) ||
      (keys.down2?.isDown) ||
      (t.brake > 0.5);

    const left =
      (keys.left?.isDown) ||
      (keys.left2?.isDown);

    const right =
      (keys.right?.isDown) ||
      (keys.right2?.isDown);

    const body = this.car.body;

    // Dirección del coche
    const rot = this.car.rotation || 0;
    const dirX = Math.cos(rot);
    const dirY = Math.sin(rot);

    // Velocidad actual
    const vx = body.velocity?.x || 0;
    const vy = body.velocity?.y || 0;
    const speed = Math.sqrt(vx * vx + vy * vy);

    // Params (por si init no llegó a setearlos aún)
    const accel = this.accel ?? 0;
    const brakeForce = this.brakeForce ?? 0;
    const linearDrag = this.linearDrag ?? 0;
    const maxFwd = this.maxFwd ?? 1;
    const maxRev = this.maxRev ?? 1;
    const turnRate = this.turnRate ?? 0;
    const turnMin = this.turnMin ?? 0.1;

    // Aceleración / freno
    if (up && !down) {
      body.velocity.x += dirX * accel * dt;
      body.velocity.y += dirY * accel * dt;
    }
    if (down) {
      body.velocity.x -= dirX * brakeForce * dt;
      body.velocity.y -= dirY * brakeForce * dt;
    }

    // Drag base
    const drag = Math.max(0, 1 - linearDrag * dt * 60);
    body.velocity.x *= drag;
    body.velocity.y *= drag;

    // Límite de velocidad por sentido
    const fwdSpeed = body.velocity.x * dirX + body.velocity.y * dirY;
    const newSpeed = Math.sqrt(
      body.velocity.x * body.velocity.x +
      body.velocity.y * body.velocity.y
    );
    const maxSpeed = fwdSpeed >= 0 ? maxFwd : maxRev;

    if (newSpeed > maxSpeed) {
      const s = maxSpeed / newSpeed;
      body.velocity.x *= s;
      body.velocity.y *= s;
    }

    // Giro (depende de velocidad)
    const speed01 = clamp(speed / maxFwd, 0, 1);
    const turnFactor = clamp(1 - speed01, turnMin, 1);
    const maxTurn = turnRate * turnFactor; // rad/s

    // 1) Teclado: volante clásico
    if (left && !right) this.car.rotation -= maxTurn * dt;
    if (right && !left) this.car.rotation += maxTurn * dt;

    // 2) Táctil: alineamiento por stick (solo si hay stick activo)
    const stickMag = Math.sqrt(t.stickX * t.stickX + t.stickY * t.stickY);
    const movingEnough = speed > 8;

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
// IMPORTANTE: si aquí explota, no debe tumbar el update entero.
try {
  const geom = this.track?.geom;
  const cells = geom?.cells;

  if (cells && this.car) {
    const cellSize = geom.cellSize;
    const cx = Math.floor(this.car.x / cellSize);
    const cy = Math.floor(this.car.y / cellSize);

    // Diagnóstico 1 sola vez (sin variables fuera de scope)
    if (!this._trackOnce) {
      this._trackOnce = true;

      const key0 = `${cx},${cy}`;
      const cd0 = cells.get(key0);

      const polysLen0 = cd0?.polys?.length ?? 0;
      const poly0 = (cd0?.polys && cd0.polys.length) ? cd0.polys[0] : null;
      const p0raw = (Array.isArray(poly0) && poly0.length) ? poly0[0] : null;

      let p0s = 'null';
      if (p0raw && typeof p0raw.x === 'number' && typeof p0raw.y === 'number') {
        p0s = `{x:${p0raw.x.toFixed(1)},y:${p0raw.y.toFixed(1)}}`;
      } else if (Array.isArray(p0raw) && p0raw.length >= 2) {
        p0s = `[${Number(p0raw[0]).toFixed(1)},${Number(p0raw[1]).toFixed(1)}]`;
      }

      const cellsSize = cells.size ?? null;
      this._trackDiag = `[track] cells=${cellsSize} carCell=${key0} hasCell=${!!cd0} polys=${polysLen0} p0=${p0s}`;
      this._hudLog(this._trackDiag);
    }

    const want = new Set();
    const R = this.track.cullRadiusCells ?? 2;

    for (let yy = cy - R; yy <= cy + R; yy++) {
      for (let xx = cx - R; xx <= cx + R; xx++) {
        want.add(`${xx},${yy}`);
      }
    }

    // Ocultar celdas que ya no se quieren
    for (const k of (this.track.activeCells || [])) {
      if (!want.has(k)) {
        const cell = this.track.gfxByCell.get(k);
        if (cell) {
          cell.tile?.clearMask?.(true);
          cell.mask?.destroy?.();
          cell.maskG?.destroy?.();
          cell.tile?.destroy?.();
          cell.stroke?.destroy?.();
          this.track.gfxByCell.delete(k);
        }
      }
    }

    // Mostrar/crear las que sí se quieren (ASPHALT TEXTURE + MASK)
    for (const k of want) {
      const cellData = cells.get(k);
      if (!cellData || !cellData.polys || cellData.polys.length === 0) continue;

      let cell = this.track.gfxByCell.get(k);

      if (!cell) {
        const [ix, iy] = k.split(',').map(Number);
        const x = ix * cellSize;
        const y = iy * cellSize;

// 1) Imagen de asfalto (NO tileSprite: evita costuras con mask + cámara)
const tile = this.add.image(x, y, 'asphalt')
  .setOrigin(0, 0)
  .setDisplaySize(cellSize, cellSize)
  .setScrollFactor(1)
  .setDepth(10);


        // 2) Mask con forma de pista
        const maskG = this.make.graphics({ x, y, add: false });
   // UI camera no debe renderizar chunks ni su máscara
this.uiCam?.ignore?.(tile);
this.uiCam?.ignore?.(maskG);
    
        maskG.clear();
        maskG.fillStyle(0xffffff, 1);

        const getXY = (pt) => {
          if (!pt) return { x: NaN, y: NaN };
          if (typeof pt.x === 'number' && typeof pt.y === 'number') return { x: pt.x, y: pt.y };
          if (Array.isArray(pt) && pt.length >= 2) return { x: pt[0], y: pt[1] };
          return { x: NaN, y: NaN };
        };

        for (const poly of cellData.polys) {
          if (!poly || poly.length < 3) continue;

          const p0 = getXY(poly[0]);
          if (!Number.isFinite(p0.x) || !Number.isFinite(p0.y)) continue;

          const looksWorld =
            (p0.x > cellSize * 1.5) || (p0.y > cellSize * 1.5) ||
            (p0.x < -cellSize * 0.5) || (p0.y < -cellSize * 0.5);

          const x0 = looksWorld ? (p0.x - x) : p0.x;
          const y0 = looksWorld ? (p0.y - y) : p0.y;

          maskG.beginPath();
          maskG.moveTo(x0, y0);

          for (let i = 1; i < poly.length; i++) {
            const pi = getXY(poly[i]);
            if (!Number.isFinite(pi.x) || !Number.isFinite(pi.y)) continue;

            const lx = looksWorld ? (pi.x - x) : pi.x;
            const ly = looksWorld ? (pi.y - y) : pi.y;
            maskG.lineTo(lx, ly);
          }

          maskG.closePath();
          maskG.fillPath();
        }

        const mask = maskG.createGeometryMask();
        tile.setMask(mask);

        const stroke = null; // bordes desactivados
        cell = { tile, stroke, maskG, mask };

        this.track.gfxByCell.set(k, cell);
      }

      if (cell.tile && !cell.tile.visible) cell.tile.setVisible(true);
      if (cell.stroke && !cell.stroke.visible) cell.stroke.setVisible(true);
    }

    this.track.activeCells = want;
  }
} catch (e) {
  if (!this._cullErrLogged) {
    this._cullErrLogged = true;
    this._hudLog(`[cull ERROR] ${e?.message || e}`);
  }
}
    // === VUELTAS: detectar cruce de línea de meta (robusto) ===
    try {
      if (this.finishLine?.a && this.finishLine?.b && this.finishLine?.normal) {
        const a = this.finishLine.a;
        const b = this.finishLine.b;
        const n = this.finishLine.normal;

        const x0 = (this.prevCarX ?? this.car.x);
        const y0 = (this.prevCarY ?? this.car.y);
        const x1 = this.car.x;
        const y1 = this.car.y;

        const side0 = (x0 - a.x) * n.x + (y0 - a.y) * n.y;
        const side1 = (x1 - a.x) * n.x + (y1 - a.y) * n.y;

        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const len2 = abx * abx + aby * aby;
        const proj1 = len2 > 0 ? ((x1 - a.x) * abx + (y1 - a.y) * aby) / len2 : -1;
        const within = proj1 >= 0 && proj1 <= 1;

        const crossed = (side0 === 0) ? (side1 !== 0) : ((side0 > 0) !== (side1 > 0));

        const vvx = body.velocity?.x || 0;
        const vvy = body.velocity?.y || 0;
        const forward = (vvx * n.x + vvy * n.y) > 0;

        if (this._lapCooldownMs == null) this._lapCooldownMs = 0;
        this._lapCooldownMs = Math.max(0, this._lapCooldownMs - (deltaMs || 0));

        if (within && crossed && forward && this._lapCooldownMs === 0) {
          this.lapCount = (this.lapCount || 0) + 1;
          this._lapCooldownMs = 700;
        }
      }
    } catch (e) {
    }

    // Actualizar prev SIEMPRE
    this.prevCarX = this.car.x;
    this.prevCarY = this.car.y;

    // === HUD ===
    const kmh = speed * 0.12;
    if (this.hud?.setText) {
      const u = this.upgrades || { engine: 0, brakes: 0, tires: 0 };
const bgKey = this.bgKey || '(no bg ref)';

      this.hud.setText(
  'RaceScene\n' +
  `BG: ${bgKey}\n` +
  `Vueltas: ${this.lapCount || 0}\n` +
  `Car: ${this.carId || 'stock'} | Upg E${u.engine} B${u.brakes} T${u.tires}\n` +
  'Vel: ' + kmh.toFixed(0) + ' km/h\n' +
  'Zoom: ' + (this.zoom ?? 1).toFixed(1) + '\n' +
  `Track: ${this._trackDiag || ''}\n` +
  `Track2: ${this._trackDiag2 || ''}`
);
    }

    // Sincronizar rig visual con body físico
    if (this.carRig && this.carBody) {
      this.carRig.x = this.carBody.x;
      this.carRig.y = this.carBody.y;
      this.carRig.rotation = this.carBody.rotation;
    }


  }
  ensureBgTexture() {
  const size = 256;

  // Producción: solo 'grass'. Eliminamos cualquier rastro de 'bgGrid'.
  if (this.textures.exists('grass')) this.textures.remove('grass');
  if (this.textures.exists('bgGrid')) this.textures.remove('bgGrid');

  const g = this.add.graphics();

  // Base verde
  g.fillStyle(0x1a6a2a, 1);
  g.fillRect(0, 0, size, size);

  // Ruido de variación (manchitas)
  for (let i = 0; i < 900; i++) {
    const alpha = 0.06 + Math.random() * 0.08;
    const col = Math.random() > 0.5 ? 0x134e20 : 0x2b8c3b;

    g.fillStyle(col, alpha);
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 2 + Math.random() * 3;
    const h = 2 + Math.random() * 3;
    g.fillRect(x, y, w, h);
  }

  // Briznas suaves
  g.lineStyle(1, 0x0f3a18, 0.10);
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.lineBetween(
      x,
      y,
      x + (Math.random() * 10 - 5),
      y - (6 + Math.random() * 12)
    );
  }

  g.generateTexture('grass', size, size);
  g.destroy();
}
  ensureAsphaltTexture() {
    const key = 'asphalt';
    const size = 256;

    // CLAVE: si ya existía, la borramos. Esto evita que “asphalt” se quede apuntando a una textura vieja (la rejilla).
    if (this.textures.exists(key)) this.textures.remove(key);

    const g = this.add.graphics();

    // Base asfalto (gris oscuro neutro)
    g.fillStyle(0x2a2f3a, 1);
    g.fillRect(0, 0, size, size);

    // Grano fino claro
    g.fillStyle(0xffffff, 0.045);
    for (let i = 0; i < 1100; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const s = Math.random() < 0.92 ? 1 : 2;
      g.fillRect(x, y, s, s);
    }

    // Grano fino oscuro
    g.fillStyle(0x000000, 0.07);
    for (let i = 0; i < 900; i++) {
      g.fillRect(Math.random() * size, Math.random() * size, 1, 1);
    }

    // Parches suaves (manchas de reparación)
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const w = 26 + Math.random() * 70;
      const h = 16 + Math.random() * 44;
      const a = 0.04 + Math.random() * 0.06;
      g.fillStyle(0x000000, a);
      g.fillRoundedRect(x, y, w, h, 6);
    }

    // Marcas de goma muy sutiles (tire marks)
    g.lineStyle(2, 0x10141b, 0.10);
    for (let i = 0; i < 12; i++) {
      const x1 = Math.random() * size;
      const y1 = Math.random() * size;
      const x2 = x1 + 80 + Math.random() * 120;
      const y2 = y1 + (Math.random() * 18 - 9);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.strokePath();
    }

    // Micro “rayas” de rodadura (longitudinales, casi invisibles)
    g.lineStyle(1, 0xffffff, 0.018);
    for (let i = 0; i < 160; i++) {
      const y = Math.random() * size;
      g.lineBetween(0, y, size, y + (Math.random() * 6 - 3));
    }

    g.generateTexture(key, size, size);
    g.destroy();
  }


  ensureCarTexture() {
    if (!this.textures.exists('__BODY__')) {
  const g = this.add.graphics();
  g.fillStyle(0xffffff, 0.001);
  g.fillRect(0, 0, 2, 2);
  g.generateTexture('__BODY__', 2, 2);
  g.destroy();
}
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
this.touchUI = ui; // ← referencia para cámaras

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
