// src/game/cars/resolveCarParams.js
// Combina: baseSpec + tuning (tornillos) + upgrades (futuro)

export function resolveCarParams(baseSpec, tuning = {}, upgrades = []) {
  // Clonamos base
  let p = { ...baseSpec };

  // --- TORNILLOS (tuning) ---
  // Multiplicadores
  if (tuning.accelMult != null) p.accel *= tuning.accelMult;
  if (tuning.brakeMult != null) p.brakeForce *= tuning.brakeMult;
  if (tuning.dragMult != null) p.linearDrag *= tuning.dragMult;
  if (tuning.turnRateMult != null) p.turnRate *= tuning.turnRateMult;

  // Aditivos
  if (tuning.maxFwdAdd != null) p.maxFwd += tuning.maxFwdAdd;
  if (tuning.maxRevAdd != null) p.maxRev += tuning.maxRevAdd;
  if (tuning.turnMinAdd != null) p.turnMin += tuning.turnMinAdd;

  // --- UPGRADES (no usamos aún, pero queda listo) ---
  for (const up of upgrades) {
    if (typeof up.apply === 'function') {
      p = up.apply(p);
    }
  }

  return p;
}
