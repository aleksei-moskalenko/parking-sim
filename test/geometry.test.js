import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rectsIntersect, rectInsideRect, axisAngleDiff, normalizeAngle, inflateRect, rectCorners, localPoint } from '../src/sim/geometry.js';
import { near } from './helpers.js';

const sq = (cx, cy, heading = 0) => ({ cx, cy, length: 2, width: 2, heading });

test('axis-aligned overlap', () => {
  assert.equal(rectsIntersect(sq(0, 0), sq(1.9, 0)), true);
  assert.equal(rectsIntersect(sq(0, 0), sq(2.1, 0)), false);
});

test('rotated corner', () => {
  assert.equal(rectsIntersect(sq(0, 0), sq(2.3, 0, Math.PI / 4)), true);
  assert.equal(rectsIntersect(sq(0, 0), sq(2.5, 0, Math.PI / 4)), false);
});

test('touching edges do not intersect', () => {
  assert.equal(rectsIntersect(sq(0, 0), sq(2, 0)), false);
});

test('containment with tolerance', () => {
  const outer = { cx: 0, cy: 0, length: 5, width: 2.3, heading: 0 };
  const car = (dx) => ({ cx: dx, cy: 0, length: 4, width: 1.8, heading: 0 });
  assert.equal(rectInsideRect(car(0.4), outer), true);
  assert.equal(rectInsideRect(car(0.6), outer), false);
  assert.equal(rectInsideRect(car(0.6), outer, 0.15), true);
});

test('axisAngleDiff', () => {
  near(axisAngleDiff(0.05, Math.PI + 0.05), 0, 1e-9);
  near(axisAngleDiff(0, Math.PI / 2), Math.PI / 2, 1e-9);
  near(axisAngleDiff(0.1, -0.1), 0.2, 1e-9);
});

test('normalizeAngle', () => {
  near(normalizeAngle(3 * Math.PI), Math.PI, 1e-9);
  near(normalizeAngle(-Math.PI / 2 - 2 * Math.PI), -Math.PI / 2, 1e-9);
});

test('inflateRect grows both sides', () => {
  const r = inflateRect(sq(0, 0), 0.5);
  assert.equal(r.length, 3);
  assert.equal(r.width, 3);
});

test('rectCorners order: rear-right, front-right, front-left, rear-left', () => {
  const c = rectCorners({ cx: 0, cy: 0, length: 4, width: 2, heading: 0 });
  assert.deepEqual(c.map(([x, y]) => [Math.round(x), Math.round(y)]), [[-2, -1], [2, -1], [2, 1], [-2, 1]]);
});

test('localPoint', () => {
  const [a, b] = localPoint({ cx: 1, cy: 1, length: 4, width: 2, heading: Math.PI / 2 }, [1, 3]);
  near(a, 2, 1e-9);
  near(b, 0, 1e-9);
});
