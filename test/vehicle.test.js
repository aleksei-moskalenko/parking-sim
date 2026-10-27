import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAR_SPECS } from '../src/sim/cars.js';
import { createVehicle, stepVehicle, shiftGear, bodyRect, bodyCenter, poseFromBodyCenter, wheelCenters } from '../src/sim/vehicle.js';
import { near } from './helpers.js';

const S = CAR_SPECS.sedan;
const DT = 1 / 60;
const idle = { throttle: false, brake: false, left: false, right: false };
const inD = () => ({ ...createVehicle(S, { x: 0, y: 0, heading: 0 }), gear: 'D' });

function run(state, input, seconds, spec = S) {
  let s = state;
  for (let i = 0; i < Math.round(seconds / DT); i++) s = stepVehicle(s, spec, input, DT);
  return s;
}

test('specs: overhangs + wheelbase add up to length', () => {
  for (const spec of Object.values(CAR_SPECS)) {
    near(spec.frontOverhang + spec.wheelbase + spec.rearOverhang, spec.length, 1e-9);
  }
});

test('D creeps to 1.5 m/s', () => {
  const s = run(inD(), idle, 3);
  near(s.speed, 1.5, 0.05);
  near(s.y, 0, 1e-9);
  assert.ok(s.x > 0);
});

test('brake holds in D', () => {
  assert.equal(run(inD(), { ...idle, brake: true }, 1).speed, 0);
});

test('throttle+brake → brake wins', () => {
  assert.equal(run(inD(), { ...idle, throttle: true, brake: true }, 1).speed, 0);
});

test('throttle accelerates', () => {
  near(run(inD(), { ...idle, throttle: true }, 2).speed, 4.0, 0.1);
});

test('throttle capped at max speed in D', () => {
  near(run(inD(), { ...idle, throttle: true }, 10).speed, 8, 1e-9);
});

test('R creeps backwards', () => {
  near(run({ ...inD(), gear: 'R' }, idle, 3).speed, -1.2, 0.05);
});

test('N rolls down by drag', () => {
  near(run({ ...inD(), gear: 'N', speed: 2 }, idle, 1).speed, 1.7, 0.02);
});

test('P never moves', () => {
  const s = run(createVehicle(S, { x: 0, y: 0, heading: 0 }), { ...idle, throttle: true }, 1);
  assert.equal(s.x, 0);
  assert.equal(s.speed, 0);
});

test('steering rate, hold, clamp, both keys', () => {
  const max = 35 * Math.PI / 180;
  const half = run(inD(), { ...idle, brake: true, left: true }, 0.75);
  near(half.steer, max / 2, max * 0.01);
  near(run(half, { ...idle, brake: true }, 1).steer, half.steer, 1e-9);
  near(run(inD(), { ...idle, brake: true, left: true }, 3).steer, max, 1e-9);
  near(run(half, { ...idle, brake: true, left: true, right: true }, 1).steer, half.steer, 1e-9);
  near(run(inD(), { ...idle, brake: true, right: true }, 3).steer, -max, 1e-9);
});

test('turning radius = wheelbase/tan(maxSteer)', () => {
  const max = 35 * Math.PI / 180, R = 2.75 / Math.tan(max);
  const s = run({ ...inD(), steer: max, speed: 1.5 }, idle, 5);
  near(Math.hypot(s.x - 0, s.y - R), R, 0.02);
});

test('shiftGear rules', () => {
  assert.equal(shiftGear({ ...inD(), speed: 1 }, 'R', true).reason, 'moving');
  assert.equal(shiftGear({ ...inD(), speed: 1 }, 'P', false).reason, 'moving');
  assert.equal(shiftGear(inD(), 'R', false).reason, 'need-brake');
  const r = shiftGear(inD(), 'R', true);
  assert.equal(r.ok, true);
  assert.equal(r.state.gear, 'R');
});

test('bodyRect sedan', () => {
  const r = bodyRect(createVehicle(S, { x: 0, y: 0, heading: 0 }), S);
  near(r.cx, 1.35, 1e-9);
  assert.equal(r.length, 4.7);
  assert.equal(r.width, 1.8);
});

test('poseFromBodyCenter inverts bodyCenter', () => {
  const p = poseFromBodyCenter(S, 3, 1, 0.3);
  const c = bodyCenter({ ...p }, S);
  near(c[0], 3, 1e-9);
  near(c[1], 1, 1e-9);
  near(p.heading, 0.3, 1e-9);
});

test('wheelCenters: rear at axle ±track/2, front at wheelbase', () => {
  const w = wheelCenters(createVehicle(S, { x: 0, y: 0, heading: 0 }), S);
  assert.deepEqual(w.rl.map((v) => +v.toFixed(6)), [0, 0.78]);
  assert.deepEqual(w.fr.map((v) => +v.toFixed(6)), [2.75, -0.78]);
});
