/**
 * StandingsSystem.js
 * Pure JavaScript standings module for Top Down Race 2 (TDR2)
 *
 * Ranks cars by: lap -> checkpoint index -> progress (0..1 between checkpoints)
 * Deterministic: ties are broken by car ID string sort as final fallback
 */

export function createStandingsSystem() {
  /** @type {Map<string, CarData>} */
  const cars = new Map();

  /**
   * Normalise and validate incoming car data.
   * Missing or non-numeric fields default to 0 so ranking is always safe.
   * @param {object} raw
   * @returns {CarData}
   */
  function _normalise(raw) {
    const id = String(raw?.id ?? '');
    if (!id) throw new Error('[StandingsSystem] updateCar: id is required');

    return {
      id,
      lap: Number.isFinite(raw?.lap) ? raw.lap : 0,
      checkpointIndex: Number.isFinite(raw?.checkpointIndex) ? raw.checkpointIndex : 0,
      progress: Number.isFinite(raw?.progress)
        ? Math.max(0, Math.min(1, raw.progress))
        : 0
    };
  }

  /**
   * Comparator: higher rank -> earlier in array (position 1 first).
   * Tie-break order:
   * 1. lap (desc)
   * 2. checkpointIndex (desc)
   * 3. progress (desc)
   * 4. id (asc, lexicographic) for deterministic ordering
   * @param {CarData} a
   * @param {CarData} b
   * @returns {number}
   */
  function _compare(a, b) {
    if (b.lap !== a.lap) return b.lap - a.lap;
    if (b.checkpointIndex !== a.checkpointIndex) return b.checkpointIndex - a.checkpointIndex;
    if (b.progress !== a.progress) return b.progress - a.progress;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }

  /**
   * Register or update a car's race data.
   * Safe to call every frame.
   * @param {{ id: string, lap: number, checkpointIndex: number, progress: number }} data
   */
  function updateCar(data) {
    const car = _normalise(data);
    cars.set(car.id, car);
  }

  /**
   * Returns a sorted standings array with 1-based position added.
   * Always returns a fresh array.
   * @returns {Array<CarData & { position: number }>}
   */
  function getStandings() {
    const sorted = Array.from(cars.values()).sort(_compare);

    return sorted.map((car, index) => ({
      ...car,
      position: index + 1
    }));
  }

  /**
   * Returns the current 1-based race position of a car, or null if unknown.
   * @param {string} id
   * @returns {number|null}
   */
  function getPosition(id) {
    const entry = getStandings().find((c) => c.id === id);
    return entry ? entry.position : null;
  }

  /**
   * Remove a car from standings.
   * @param {string} id
   */
  function removeCar(id) {
    cars.delete(String(id));
  }

  /**
   * Remove all cars.
   */
  function reset() {
    cars.clear();
  }

  /**
   * Returns the current number of tracked cars.
   * @returns {number}
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
    getCarCount
  };
}

/**
 * @typedef {{ id: string, lap: number, checkpointIndex: number, progress: number }} CarData
 */
