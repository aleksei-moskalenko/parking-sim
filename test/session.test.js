import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../src/sim/session.js';
import { CAR_SPECS } from '../src/sim/cars.js';
import { createVehicle, poseFromBodyCenter, bodyRect } from '../src/sim/vehicle.js';
import { rectsIntersect, inflateRect } from '../src/sim/geometry.js';

const DT = 1 / 60;
const idle = { throttle: false, brake: false, left: false, right: false };
const brake = { ...idle, brake: true };
const S = CAR_SPECS.sedan;
// Curb-side wheels' outer edges 15 cm from the curb.
const IDEAL_Y = 0.15 + S.track / 2 + S.tireWidth / 2;
const newSession = () => createSession({ exercise: 'parallel', level: 1, carId: 'sedan' });

function run(s, input, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) s.update(input, DT);
}

const contacts = (s) => s.faults.filter((f) => f.code === 'contact');

function frontNeighbour(s) {
  const t = s.world.target;
  const end = { cx: t.cx + t.length / 2, cy: t.cy, length: 0.02, width: t.width, heading: 0 };
  return s.world.obstacles.find((o) => o.kind === 'car' && rectsIntersect(o.rect, inflateRect(end, 0.01)));
}

// Body front `gap` metres behind the front neighbour, inside the spot, in D.
function placeBehindFront(s, gap) {
  const n = frontNeighbour(s);
  const frontX = n.rect.cx - n.rect.length / 2 - gap;
  s.vehicle = { ...createVehicle(s.spec, poseFromBodyCenter(s.spec, frontX - s.spec.length / 2, IDEAL_Y, 0)), gear: 'D' };
  return n;
}

test('P at start does not finish', () => {
  const s = newSession();
  s.shift('P', true);
  assert.equal(s.finished, false);
});

test('P while moving refused', () => {
  const s = newSession();
  s.shift('D', true);
  run(s, idle, 1);
  const r = s.shift('P', false);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'moving');
  assert.equal(s.finished, false);
});

test('hitting the car ahead: stops, one fault, no overlap', () => {
  const s = newSession();
  const n = placeBehindFront(s, 0.05);
  run(s, idle, 2);
  assert.equal(contacts(s).length, 1);
  assert.equal(contacts(s)[0].kind, 'car');
  assert.equal(s.vehicle.speed, 0);
  assert.equal(rectsIntersect(bodyRect(s.vehicle, s.spec), n.rect), false);
});

test('back off and touch again counts twice', () => {
  const s = newSession();
  placeBehindFront(s, 0.05);
  run(s, idle, 2);
  s.shift('R', true);
  run(s, idle, 1);
  run(s, brake, 0.5);
  s.shift('D', true);
  run(s, idle, 2);
  assert.equal(contacts(s).length, 2);
});

test('large dt does not tunnel', () => {
  const s = newSession();
  const n = placeBehindFront(s, 0.1);
  s.vehicle = { ...s.vehicle, speed: 1.5 };
  for (let i = 0; i < 3; i++) {
    s.update(idle, 1.0);
    assert.equal(rectsIntersect(bodyRect(s.vehicle, s.spec), n.rect), false);
  }
  assert.equal(contacts(s).length, 1);
});

test('direction changes', () => {
  const s = newSession();
  s.shift('D', true);
  run(s, idle, 1);
  run(s, brake, 0.5);
  s.shift('R', true);
  run(s, idle, 1);
  run(s, brake, 0.5);
  s.shift('D', true);
  run(s, idle, 1);
  assert.equal(s.directionChanges, 2);
});

test('finish in ideal pose passes; hints flagged', () => {
  const s = newSession();
  s.shift('D', true);
  run(s, idle, 2);
  run(s, brake, 0.5);
  s.vehicle = { ...createVehicle(s.spec, poseFromBodyCenter(s.spec, s.world.target.cx, IDEAL_Y, 0)), gear: 'D' };
  s.setHint('top', true);
  s.shift('P', true);
  assert.equal(s.finished, true);
  assert.equal(s.result.passed, true);
  assert.equal(s.result.hintsUsed, true);
  assert.equal(s.result.directionChanges, 0);
});

test('finish outside the spot fails with geometry fault', () => {
  const s = newSession();
  s.shift('D', true);
  run(s, idle, 2);
  run(s, brake, 0.5);
  s.shift('P', true);
  assert.equal(s.finished, true);
  assert.equal(s.result.passed, false);
  assert.ok(s.result.faults.some((f) => f.code === 'not-in-spot'));
  assert.equal(s.result.hintsUsed, false);
});

test('no updates after finish', () => {
  const s = newSession();
  s.shift('D', true);
  run(s, idle, 2);
  run(s, brake, 0.5);
  s.shift('P', true);
  const x = s.vehicle.x;
  s.shift('D', true);
  run(s, idle, 1);
  assert.equal(s.vehicle.x, x);
});

test('turning the wheel at rest beside the curb does not freeze the car', () => {
  const s = newSession();
  s.shift('D', true);
  run(s, idle, 2);
  run(s, brake, 0.5);
  // Curb-side wheels 3 cm from the curb.
  s.vehicle = { ...createVehicle(s.spec, poseFromBodyCenter(s.spec, s.world.target.cx, 0.03 + S.track / 2 + S.tireWidth / 2, 0)), gear: 'D' };
  run(s, { ...brake, right: true }, 1);
  run(s, { ...brake, left: true }, 0.5);
  const x0 = s.vehicle.x;
  run(s, idle, 1);
  assert.ok(s.vehicle.x - x0 > 0.3, `car moved ${s.vehicle.x - x0} m`);
  assert.equal(s.faults.filter((f) => f.code === 'curb').length, 0);
});
