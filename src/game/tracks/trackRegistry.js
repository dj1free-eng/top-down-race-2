import { makeTrack01Oval } from './library/ovalo/track01_oval.js';
import { makeTrack02Technical } from './library/tecnico/track02_technical.js';
import { makeTrack03Drift } from './library/drift/track03_drift.js';

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
