export const TRACK_REGISTRY = {};

export function createTrack(trackId) {
  const factory = TRACK_REGISTRY[trackId];

  if (!factory) {
    throw new Error(`Track no encontrado: ${trackId}`);
  }

  return factory();
}

export function registerTrack(trackId, factory) {
  TRACK_REGISTRY[trackId] = factory;
}
