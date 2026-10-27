import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAR_SPECS } from '../src/sim/cars.js';
import { createVehicle, poseFromBodyCenter } from '../src/sim/vehicle.js';
import { buildLevel } from '../src/sim/levels.js';
import { findCollisions, ContactTracker } from '../src/sim/contacts.js';

const S = CAR_SPECS.sedan;
const at = (cx, cy, heading = 0) => createVehicle(S, poseFromBodyCenter(S, cx, cy, heading));

test('tracker counts each new touch once', () => {
  const t = new ContactTracker(), A = [{ id: 'a', kind: 'car' }];
  assert.equal(t.onBlocked(A).length, 1);
  assert.equal(t.onBlocked(A).length, 0);
  t.release([]);
  assert.equal(t.onBlocked(A).length, 1);
});

test('tracker keeps contacts that are still near', () => {
  const t = new ContactTracker(), A = [{ id: 'a', kind: 'car' }];
  t.onBlocked(A);
  t.release(A);
  assert.equal(t.onBlocked(A).length, 0);
});

test('findCollisions detects curb by wheels', () => {
  const w = buildLevel('parallel', 1, 'sedan');
  const hits = findCollisions(w, at(w.target.cx, 0.73), S);
  assert.ok(hits.some((h) => h.kind === 'curb'));
  assert.deepEqual(findCollisions(w, at(w.target.cx, 1.04), S), []);
});

test('findCollisions detects a parked car by body', () => {
  const w = buildLevel('parallel', 1, 'sedan');
  const hits = findCollisions(w, at(w.target.cx + w.target.length / 2, 1.04), S);
  assert.ok(hits.some((h) => h.kind === 'car'));
});

test('inflate finds near obstacles', () => {
  const w = buildLevel('parallel', 1, 'sedan');
  const cx = w.target.cx + w.target.length / 2 - S.length / 2 - 0.05;   // 5 cm from the front neighbour
  assert.equal(findCollisions(w, at(cx, 1.04), S).length, 0);
  assert.ok(findCollisions(w, at(cx, 1.04), S, 0.1).some((h) => h.kind === 'car'));
});
