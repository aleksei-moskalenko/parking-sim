import assert from 'node:assert/strict';

export function near(actual, expected, tol, msg) {
  assert.ok(Math.abs(actual - expected) <= tol, msg ?? `expected ${actual} ≈ ${expected} (±${tol})`);
}
