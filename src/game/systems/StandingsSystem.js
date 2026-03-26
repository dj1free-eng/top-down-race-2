/**

- StandingsSystem.js
- Pure JavaScript standings module for Top Down Race 2 (TDR2)
- 
- Ranks cars by: lap → checkpoint index → progress (0–1 between checkpoints)
- Deterministic: ties are broken by insertion order (car ID string sort as fallback)
- 
- Usage:
- import { createStandingsSystem } from ‘./StandingsSystem.js’;
- 
- const standings = createStandingsSystem();
- 
- // Each frame / on update:
- standings.updateCar({ id: ‘player’,  lap: 2, checkpointIndex: 3, progress: 0.72 });
- standings.updateCar({ id: ‘ai_01’,   lap: 2, checkpointIndex: 3, progress: 0.55 });
- standings.updateCar({ id: ‘ai_02’,   lap: 1, checkpointIndex: 7, progress: 0.99 });
- 
- const result = standings.getStandings();
- // [
- //   { id: ‘player’, position: 1, lap: 2, checkpointIndex: 3, progress: 0.72 },
- //   { id: ‘ai_01’,  position: 2, lap: 2, checkpointIndex: 3, progress: 0.55 },
- //   { id: ‘ai_02’,  position: 3, lap: 1, checkpointIndex: 7, progress: 0.99 },
- // ]
- 
- standings.removeCar(‘ai_02’);   // remove a car (e.g. DNF)
- standings.reset();              // clear all cars
- standings.getPosition(‘player’); // → 1
  */

export function createStandingsSystem() {
/** @type {Map<string, CarData>} */
const cars = new Map();

// ─── Internal helpers ────────────────────────────────────────────────────

/**

- Normalise and validate incoming car data.
- Missing / non-numeric fields default to 0 so ranking is always safe.
- @param {object} raw
- @returns {CarData}
  */
  function _normalise(raw) {
const id = String(raw?.id ?? '');
if (!id) throw new Error('[StandingsSystem] updateCar: id is required');
```
return {
  id,
  lap:             Number.isFinite(raw?.lap)             ? raw.lap             : 0,
  checkpointIndex: Number.isFinite(raw?.checkpointIndex) ? raw.checkpointIndex : 0,
  progress:        Number.isFinite(raw?.progress)        ? Math.max(0, Math.min(1, raw.progress)) : 0,
};
```

}

/**

- Comparator: higher rank → earlier in array (position 1 first).
- Tie-break order:
- 1. lap (desc)
- 1. checkpointIndex (desc)
- 1. progress (desc)
- 1. id (asc, lexicographic) – ensures determinism across identical snapshots
- @param {CarData} a
- @param {CarData} b
- @returns {number}
  */
  function _compare(a, b) {
  if (b.lap !== a.lap)                           return b.lap - a.lap;
  if (b.checkpointIndex !== a.checkpointIndex)   return b.checkpointIndex - a.checkpointIndex;
  if (b.progress !== a.progress)                 return b.progress - a.progress;
  // Final deterministic tie-break
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }

// ─── Public API ──────────────────────────────────────────────────────────

/**

- Register or update a car’s race data.
- Safe to call every frame.
- @param {{ id: string, lap: number, checkpointIndex: number, progress: number }} data
  */
  function updateCar(data) {
  const car = _normalise(data);
  cars.set(car.id, car);
  }

/**

- Returns a sorted standings array with 1-based position added.
- Always returns a fresh array — safe to mutate externally.
- @returns {Array<CarData & { position: number }>}
  */
  function getStandings() {
  const sorted = Array.from(cars.values()).sort(_compare);

```
return sorted.map((car, index) => ({
  ...car,
  position: index + 1,
}));
```

}

/**

- Returns the current 1-based race position of a car, or null if unknown.
- O(n) — fine for typical field sizes (≤ 20 cars).
- @param {string} id
- @returns {number|null}
  */
  function getPosition(id) {
  const entry = getStandings().find(c => c.id === id);
  return entry ? entry.position : null;
  }

/**

- Remove a car from the standings (DNF, finished, despawned, etc.).
- @param {string} id
  */
  function removeCar(id) {
  cars.delete(String(id));
  }

/**

- Remove all cars. Useful on race restart.
  */
  function reset() {
  cars.clear();
  }

/**

- Returns the current number of tracked cars.
- @returns {number}
  */
  function getCarCount() {
  return cars.size;
  }

return {
updateCar,
getStandings,
getPosition,
removeCar,
reset,
getCarCount,
};
}

// ─── JSDoc typedef (editor intellisense only) ────────────────────────────────
/**

- @typedef {{ id: string, lap: number, checkpointIndex: number, progress: number }} CarData
  */
