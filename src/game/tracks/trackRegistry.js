
export const TRACK_REGISTRY = {
  track01: makeTrack01Oval,
  track02: makeTrack02Technical,
  track03: makeTrack03Drift
};

export function createTrack(trackId) {
  const factory = TRACK_REGISTRY[trackId];
  if (!factory) {
    throw new Error(`Track no encontrado: ${trackId}`);
  }
  return factory();
}
