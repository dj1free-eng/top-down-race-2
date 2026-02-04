// src/game/cars/resolveCarParams.js
import { HANDLING_PROFILES } from './handlingProfiles.js';
import { deepMerge } from '../dev/devTuningStore.js';

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

// Aplica perfil + tuning + overrides (externo + local)
export function resolveCarParams(baseSpec, tuning = {}, overrides = {}) {
  const t = {
    accelMult: 1.0,
    brakeMult: 1.0,
    dragMult: 1.0,
    turnRateMult: 1.0,
    maxFwdAdd: 0,
    maxRevAdd: 0,
    turnMinAdd: 0,

    gripCoastAdd: 0,
    gripDriveAdd: 0,
    gripBrakeAdd: 0,

    ...tuning
  };

  // Perfil elegido por el coche (o default)
  const profileId = baseSpec.handlingProfile || baseSpec.steeringProfile || 'ARCADE';
  const baseProfile = HANDLING_PROFILES[profileId] || HANDLING_PROFILES.ARCADE;

  // Overrides (por perfil y por coche)
  // overrides = { profiles:{...}, cars:{...} }
  const profOv = overrides?.profiles?.[profileId] || {};
  const carOv  = overrides?.cars?.[baseSpec.id] || {};

  // Perfil final = baseProfile + overrides
  const profileFinal = deepMerge(deepMerge(baseProfile, profOv), carOv);

  const out = {
    ...baseSpec,
    name: baseSpec.name || baseSpec.id,

    // Longitudinal “base”
    accel: Math.max(0, (baseSpec.accel || 0) * t.accelMult),
    brakeForce: Math.max(0, (baseSpec.brakeForce || 0) * t.brakeMult),
    engineBrake: Math.max(0, (baseSpec.engineBrake || 0)),
    linearDrag: Math.max(0, (baseSpec.linearDrag || 0) * t.dragMult),

    // Velocidades
    maxFwd: Math.max(0, (baseSpec.maxFwd || 0) + t.maxFwdAdd),
    maxRev: Math.max(0, (baseSpec.maxRev || 0) + t.maxRevAdd),

    // Dirección base
    turnRate: Math.max(0, (baseSpec.turnRate || 0) * t.turnRateMult),
    turnMin: clamp((baseSpec.turnMin || 0) + t.turnMinAdd, 0.05, 0.95),

    // Agarres base
    gripCoast: clamp((baseSpec.gripCoast || 0) + t.gripCoastAdd, 0.00, 0.95),
    gripDrive: clamp((baseSpec.gripDrive || 0) + t.gripDriveAdd, 0.00, 0.95),
    gripBrake: clamp((baseSpec.gripBrake || 0) + t.gripBrakeAdd, 0.00, 0.95),

    // Módulos por perfil
    handlingProfile: profileId,
    steering: {
      profile: profileId,
      yawSpeedMin: profileFinal.steering?.yawSpeedMin ?? 12,
      steerSat: profileFinal.steering?.steerSat ?? 0.45,
      lowSpeedSteer: profileFinal.steering?.lowSpeedSteer ?? 0.35,
      highSpeedLimit: profileFinal.steering?.highSpeedLimit ?? 0.75,
      lateralGrip: profileFinal.steering?.lateralGrip ?? 6
    },
    engine: {
      throttleGamma: profileFinal.engine?.throttleGamma ?? 1.35,
      coastDrag: profileFinal.engine?.coastDrag ?? 0.016,
      brakeDrag: profileFinal.engine?.brakeDrag ?? 0.055
    },
    tires: {
      gripSpeedGain: profileFinal.tires?.gripSpeedGain ?? 0.04
    }
  };

  return out;
}
