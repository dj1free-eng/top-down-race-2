import { CAR_SPECS } from './carSpecs.js';

// key de SAVED (persistente)
function lsKey(carId) {
  return `tdr2:carSpecs:${carId}`;
}

function readSaved(carId) {
  try {
    const raw = localStorage.getItem(lsKey(carId));
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch {
    return {};
  }
}

/**
 * Spec real del coche (lo que "posee actualmente"):
 * factory (CAR_SPECS) + saved override (localStorage)
 */
export function getEffectiveCarSpec(carId) {
  const factory = CAR_SPECS[carId] || CAR_SPECS.stock;
  const saved = readSaved(carId);
  return { ...factory, ...saved };
}
