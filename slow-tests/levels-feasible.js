// Proves every level is passable with both cars. Run: npm run test:levels
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAR_SPECS } from '../src/sim/cars.js';
import { buildLevel } from '../src/sim/levels.js';
import { findSolution } from '../src/sim/solver.js';

// Tight levels need a finer search grid before the solver can prove them.
const FINE = { maxExpansions: 1500000, cell: 0.05, angleCellDeg: 1.5 };

for (const ex of ['parallel', 'garage']) {
  for (const car of ['sedan', 'minivan']) {
    for (let n = 1; n <= 6; n++) {
      test(`${ex} ${car} L${n} is passable`, () => {
        const t0 = Date.now();
        const world = buildLevel(ex, n, car);
        let r = findSolution(world, CAR_SPECS[car]);
        let grid = 'coarse';
        if (!r.found) {
          r = findSolution(world, CAR_SPECS[car], FINE);
          grid = 'fine';
        }
        const changes = r.path.filter((p, i) => i > 0 && r.path[i - 1].dir && p.dir !== r.path[i - 1].dir).length;
        console.log(`${ex} ${car} L${n}: found=${r.found} grid=${grid} expansions=${r.expansions} dirChanges=${changes} ${Date.now() - t0}ms`);
        assert.equal(r.found, true);
      });
    }
  }
}
