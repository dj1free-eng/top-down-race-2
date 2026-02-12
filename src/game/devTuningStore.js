// src/game/dev/devTuningStore.js

const LS_KEY = 'tdr2_dev_tuning_v1';

export function loadLocalOverrides() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  catch { return {}; }
}

export function saveLocalOverrides(obj) {
  localStorage.setItem(LS_KEY, JSON.stringify(obj || {}));
}

export function clearLocalOverrides() {
  localStorage.removeItem(LS_KEY);
}

// Carga overrides externos (public/dev/handling-overrides.json)
// cache bust para que puedas editar y recargar sin pelearte con caché
export async function fetchExternalOverrides() {
  try {
    const url = `dev/handling-overrides.json?v=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

// Merge simple (deep-ish) para objetos pequeños
export function deepMerge(a, b) {
  const out = { ...(a || {}) };
  for (const k of Object.keys(b || {})) {
    const av = out[k];
    const bv = b[k];
    if (av && bv && typeof av === 'object' && typeof bv === 'object' && !Array.isArray(av) && !Array.isArray(bv)) {
      out[k] = deepMerge(av, bv);
    } else {
      out[k] = bv;
    }
  }
  return out;
}
