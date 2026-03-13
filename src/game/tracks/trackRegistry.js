const trackModules = import.meta.glob('./library/*/track.json', { eager: true });

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeCenterline(centerline, fallbackWidth = 80) {
  if (!Array.isArray(centerline)) return [];

  return centerline.map((p) => {
    if (Array.isArray(p) && p.length >= 2) {
      return {
        x: Number(p[0]),
        y: Number(p[1]),
        width: fallbackWidth
      };
    }

    if (p && typeof p.x === 'number' && typeof p.y === 'number') {
      return {
        x: Number(p.x),
        y: Number(p.y),
        width: Number.isFinite(Number(p.width)) ? Number(p.width) : fallbackWidth
      };
    }

    return null;
  }).filter(Boolean);
}

function buildRegistry() {
  const out = {};

  for (const [path, mod] of Object.entries(trackModules)) {
    const json = mod?.default ?? mod;
    if (!json || typeof json !== 'object') continue;

    const m = path.match(/\/library\/([^/]+)\/track\.json$/);
    if (!m) continue;

    const slug = m[1];
    const fallbackWidth = Number(json.trackWidth) || 80;

    out[slug] = {
      id: slug,
      key: slug,
      name: json.name || slug.toUpperCase(),
      brand: json.brand || 'CUSTOM',
      category: json.category || 'Nuevo',
      difficulty: json.difficulty || 'Media',
      lengthLabel: json.lengthLabel || 'Media',
      worldW: Number(json.worldW) || 8000,
      worldH: Number(json.worldH) || 5000,
      trackWidth: fallbackWidth,
      grassMargin: Number(json.grassMargin) || 120,
      sampleStepPx: Number(json.sampleStepPx) || 12,
      cellSize: Number(json.cellSize) || 400,
      shoulderPx: Number(json.shoulderPx) || 10,
      start: json.start || { x: 400, y: 400, r: 0 },
      centerline: normalizeCenterline(json.centerline, fallbackWidth),
      closed: json.closed !== false
    };
  }

  return out;
}

export const TRACK_REGISTRY = buildRegistry();

export function createTrack(trackId) {
  const track = TRACK_REGISTRY[trackId];
  if (!track) {
    throw new Error(`Track no encontrado: ${trackId}`);
  }
  return clone(track);
}

export function getTrackKeys() {
  return Object.keys(TRACK_REGISTRY);
}

export function hasTrack(trackId) {
  return !!TRACK_REGISTRY[trackId];
}
