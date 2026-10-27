import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAR_SPECS } from '../src/sim/cars.js';
import { buildLevel } from '../src/sim/levels.js';
import { findSolution } from '../src/sim/solver.js';
import { findCollisions } from '../src/sim/contacts.js';
import { evaluatePose } from '../src/sim/scoring.js';

const S = CAR_SPECS.sedan;

for (const ex of ['garage', 'parallel']) {
  test(`solver finds ${ex} L1 sedan with a valid path`, () => {
    const w = buildLevel(ex, 1, 'sedan');
    const r = findSolution(w, S);
    assert.equal(r.found, true);
    assert.ok(r.path.length > 1);
    for (const p of r.path) assert.deepEqual(findCollisions(w, p, S), []);
    assert.deepEqual(evaluatePose(w, r.path.at(-1), S).faults, []);
  });
}

test('solver gives up on an impossible spot', () => {
  const w = buildLevel('garage', 1, 'sedan');
  const blocked = { ...w, obstacles: [...w.obstacles, { id: 'block', kind: 'wall', rect: { ...w.target, length: 1, cy: w.target.cy }, height: 1 }] };
  const r = findSolution(blocked, S, { maxExpansions: 20000 });
  assert.equal(r.found, false);
});
