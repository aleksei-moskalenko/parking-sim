// Passed levels, remembered in this browser only. Storage may be missing or
// blocked (private mode), so every access is guarded.

const KEY = 'parking-sim-progress-v1';
const id = (exercise, carId, level) => `${exercise}:${carId}:${level}`;

export function loadProgress() {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function markPassed(exercise, carId, level) {
  try {
    const progress = loadProgress();
    progress[id(exercise, carId, level)] = true;
    globalThis.localStorage?.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Progress is a convenience; losing it is fine.
  }
}

export function isPassed(exercise, carId, level) {
  return loadProgress()[id(exercise, carId, level)] === true;
}
