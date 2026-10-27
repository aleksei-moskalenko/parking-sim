import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAR_SPECS } from '../src/sim/cars.js';
import { createVehicle, poseFromBodyCenter } from '../src/sim/vehicle.js';
import { buildLevel } from '../src/sim/levels.js';
import { evaluatePose, formatFault } from '../src/sim/scoring.js';
import { near } from './helpers.js';

const S = CAR_SPECS.sedan;
const at = (cx, cy, heading = 0) => createVehicle(S, poseFromBodyCenter(S, cx, cy, heading));
const IDEAL_Y = 0.15 + 1.56 / 2 + 0.22 / 2;
const w1 = buildLevel('parallel', 1, 'sedan');
const codes = (r) => r.faults.map((f) => f.code);

test('parallel ideal → no faults', () => {
  const r = evaluatePose(w1, at(w1.target.cx, IDEAL_Y), S);
  assert.deepEqual(r.faults, []);
  near(r.measures.curbDistance, 0.15, 1e-6);
  near(r.measures.angleDeg, 0, 1e-9);
});

test('too far', () => {
  const r = evaluatePose(w1, at(w1.target.cx, IDEAL_Y + 0.30), S);
  assert.equal(r.faults[0].code, 'too-far');
  assert.equal(formatFault(r.faults[0], 'parallel'), 'Далеко от бордюра: 45 см (норма ≤ 30 см)');
});

test('angle 4°', () => {
  const r = evaluatePose(w1, at(w1.target.cx, IDEAL_Y + 0.1, 4 * Math.PI / 180), S);
  assert.ok(codes(r).includes('angle'));
  assert.equal(formatFault(r.faults.find((f) => f.code === 'angle'), 'parallel'), 'Криво: 4.0° (норма ≤ 3°)');
});

test('outside spot', () => {
  const r = evaluatePose(w1, at(w1.target.cx + 3, IDEAL_Y), S);
  assert.ok(codes(r).includes('not-in-spot'));
  assert.equal(formatFault({ code: 'not-in-spot' }, 'parallel'), 'Машина не целиком в разметке места');
});

test('left-side ideal (mirrored) → no faults', () => {
  const w4 = buildLevel('parallel', 4, 'sedan');
  const r = evaluatePose(w4, at(w4.target.cx, -IDEAL_Y), S);
  assert.deepEqual(r.faults, []);
  near(r.measures.curbDistance, 0.15, 1e-6);
});

test('garage ideal / off-center / outside', () => {
  const g = buildLevel('garage', 1, 'sedan');
  const d = g.target.length;
  assert.deepEqual(evaluatePose(g, at(0, -d / 2, Math.PI / 2), S).faults, []);

  assert.deepEqual(evaluatePose(g, at(0.24, -d / 2, Math.PI / 2), S).faults, [], '24 cm off is still centred');
  const off = evaluatePose(g, at(0.3, -d / 2, Math.PI / 2), S);
  assert.deepEqual(codes(off), ['off-center']);
  assert.equal(formatFault(off.faults[0], 'garage'), 'Не по центру бокса: 30 см (норма ≤ 25 см)');
  near(off.measures.lateralOffset, 0.3, 1e-9);

  const out = evaluatePose(g, at(0, -d / 2 + 2, Math.PI / 2), S);
  assert.ok(codes(out).includes('not-in-spot'));
  assert.equal(formatFault({ code: 'not-in-spot' }, 'garage'), 'Машина не целиком в боксе');
});

test('garage driven in nose-first is not a reverse park', () => {
  const g = buildLevel('garage', 1, 'sedan');
  const r = evaluatePose(g, at(0, -g.target.length / 2, -Math.PI / 2), S);
  assert.deepEqual(codes(r), ['nose-in']);
  assert.equal(formatFault(r.faults[0], 'garage'), 'Заезд не задним ходом');
});

test('contact and curb texts', () => {
  assert.equal(formatFault({ code: 'contact', kind: 'car' }, 'parallel'), 'Касание: машина');
  assert.equal(formatFault({ code: 'contact', kind: 'cone' }, 'parallel'), 'Касание: конус');
  assert.equal(formatFault({ code: 'contact', kind: 'wall' }, 'garage'), 'Касание: стена');
  assert.equal(formatFault({ code: 'curb' }, 'parallel'), 'Наезд на бордюр');
});
