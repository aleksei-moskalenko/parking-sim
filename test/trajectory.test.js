import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAR_SPECS } from '../src/sim/cars.js';
import { createVehicle } from '../src/sim/vehicle.js';
import { predictWheelPaths } from '../src/view/trajectory.js';
import { near } from './helpers.js';

const S = CAR_SPECS.sedan;

test('straight path', () => {
  const p = predictWheelPaths(createVehicle(S, { x: 0, y: 0, heading: 0 }), S).forward.fl;
  assert.ok(p.every(([, y]) => Math.abs(y - p[0][1]) < 1e-9));
  near(p.at(-1)[0] - p[0][0], 8, 0.25);
});

test('reverse goes backwards', () => {
  const p = predictWheelPaths(createVehicle(S, { x: 0, y: 0, heading: 0 }), S).reverse.rr;
  near(p.at(-1)[0], -8, 0.25);
});

test('full-lock rear-left radius', () => {
  const max = S.maxSteerDeg * Math.PI / 180, R = S.wheelbase / Math.tan(max);
  const p = predictWheelPaths({ ...createVehicle(S, { x: 0, y: 0, heading: 0 }), steer: max }, S).forward.rl;
  assert.ok(p.every(([x, y]) => Math.abs(Math.hypot(x, y - R) - (R - S.track / 2)) < 0.01));
});

test('all four wheels in both directions', () => {
  const r = predictWheelPaths(createVehicle(S, { x: 0, y: 0, heading: 0 }), S);
  for (const d of ['forward', 'reverse']) assert.deepEqual(Object.keys(r[d]).sort(), ['fl', 'fr', 'rl', 'rr']);
});
