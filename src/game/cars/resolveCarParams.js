// src/game/cars/resolveCarParams.js
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

/**
 * Aplica "tornillos" (tuning) a una baseSpec y devuelve params finales.
 * Unidades internas: px/s, px/s^2, rad/s, coeficientes adimensionales.
 */
export function resolveCarParams(baseSpec, tuning = {}) {
  const t = {
    accelMult: 1.0,
    brakeMult: 1.0,
    dragMult: 1.0,
    turnRateMult: 1.0,
    maxFwdAdd: 0,
    maxRevAdd: 0,
    turnMinAdd: 0,

    // NUEVO: neumáticos (sumas directas a agarres)
    gripCoastAdd: 0,
    gripDriveAdd: 0,
    gripBrakeAdd: 0,

    ...tuning
  };

  const out = {
    ...baseSpec,
    name: baseSpec.name || baseSpec.id,

    // Longitudinal
    accel: Math.max(0, (baseSpec.accel || 0) * t.accelMult),
    brakeForce: Math.max(0, (baseSpec.brakeForce || 0) * t.brakeMult),
    engineBrake: Math.max(0, (baseSpec.engineBrake || 0)), // lo dejamos tal cual (por ahora)
    linearDrag: Math.max(0, (baseSpec.linearDrag || 0) * t.dragMult),

    // Velocidades
    maxFwd: Math.max(0, (baseSpec.maxFwd || 0) + t.maxFwdAdd),
    maxRev: Math.max(0, (baseSpec.maxRev || 0) + t.maxRevAdd),

    // Dirección
    turnRate: Math.max(0, (baseSpec.turnRate || 0) * t.turnRateMult),
    turnMin: clamp((baseSpec.turnMin || 0) + t.turnMinAdd, 0.05, 0.95),

    // Agarres
    gripCoast: clamp((baseSpec.gripCoast || 0) + t.gripCoastAdd, 0.00, 0.95),
    gripDrive: clamp((baseSpec.gripDrive || 0) + t.gripDriveAdd, 0.00, 0.95),
    gripBrake: clamp((baseSpec.gripBrake || 0) + t.gripBrakeAdd, 0.00, 0.95),
  };

  return out;
}
