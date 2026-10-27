import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAR_SPECS } from '../src/sim/cars.js';
import { createVehicle, bodyRect, wheelRects } from '../src/sim/vehicle.js';
import { rectsIntersect, inflateRect } from '../src/sim/geometry.js';
import { buildLevel, ROW_EDGE, LEVEL_NAMES, PARALLEL_LEVELS, GARAGE_LEVELS } from '../src/sim/levels.js';
import { createRng } from '../src/sim/rng.js';
import { near } from './helpers.js';

test('six named levels per exercise', () => {
  assert.deepEqual(LEVEL_NAMES, ['Лёгкий', 'Базовый', 'Средний', 'Сложный', 'Эксперт', 'Мастер']);
  assert.equal(PARALLEL_LEVELS.length, 6);
  assert.equal(GARAGE_LEVELS.length, 6);
});

test('rng is deterministic and in [0,1)', () => {
  const a = createRng(7), b = createRng(7);
  for (let i = 0; i < 100; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

for (const ex of ['parallel', 'garage']) {
  for (const car of ['sedan', 'minivan']) {
    for (let n = 1; n <= 6; n++) {
      test(`${ex} ${car} L${n}: start pose collision-free and deterministic`, () => {
        const w = buildLevel(ex, n, car), spec = CAR_SPECS[car], v = createVehicle(spec, w.start);
        assert.ok(!w.obstacles.some((o) => rectsIntersect(o.rect, bodyRect(v, spec))));
        assert.ok(!w.curbs.some((c) => Object.values(wheelRects(v, spec)).some((r) => rectsIntersect(c.rect, r))));
        assert.deepEqual(buildLevel(ex, n, car), w);
        assert.ok(!w.obstacles.some((o) => rectsIntersect(o.rect, inflateRect(w.target, -0.01))), 'target is free');
      });
    }
  }
}

test('parallel L3 sedan spot', () => {
  const w = buildLevel('parallel', 3, 'sedan');
  near(w.target.length, 4.7 + 1.5, 1e-9);
  near(w.target.width, 1.8 + 0.5, 1e-9);
  const touching = w.obstacles.filter((o) => o.kind === 'car' && rectsIntersect(o.rect, inflateRect(w.target, 0.01)));
  assert.equal(touching.length, 2);
});

test('parallel free width', () => {
  const w = buildLevel('parallel', 5, 'minivan');
  const nearEdge = Math.min(...w.obstacles.filter((o) => o.rect.cy > ROW_EDGE).map((o) => o.rect.cy - o.rect.width / 2));
  near(nearEdge, ROW_EDGE + 3.6, 1e-9);
});

test('sides', () => {
  const r = buildLevel('parallel', 1, 'sedan'), l = buildLevel('parallel', 4, 'sedan');
  assert.equal(r.curbLine.sidewalkSign, -1);
  assert.ok(r.start.y > r.target.cy);
  assert.equal(l.curbLine.sidewalkSign, 1);
  assert.ok(l.start.y < l.target.cy);
});

test('L1/L2 use cones, L3+ opposite cars', () => {
  assert.ok(buildLevel('parallel', 1, 'sedan').obstacles.some((o) => o.kind === 'cone'));
  assert.ok(buildLevel('parallel', 2, 'sedan').obstacles.some((o) => o.kind === 'cone'));
  assert.ok(!buildLevel('parallel', 3, 'sedan').obstacles.some((o) => o.kind === 'cone'));
});

test('garage L6 minivan dims', () => {
  const w = buildLevel('garage', 6, 'minivan');
  near(w.target.width, 1.95 + 0.25, 1e-9);
  near(w.target.length, 5.10 + 0.5, 1e-9);
  assert.equal(w.targetAxis, Math.PI / 2);
  assert.equal(w.curbLine, null);
  const across = Math.min(...w.obstacles.filter((o) => o.rect.cy > 0).map((o) => o.rect.cy - o.rect.width / 2));
  near(across, 4.5, 1e-9);
});

test('garage target box is open, neighbours closed', () => {
  const w = buildLevel('garage', 1, 'sedan');
  const mouth = { cx: 0, cy: 0.05, length: w.target.width - 0.02, width: 0.4, heading: 0 };
  assert.ok(!w.obstacles.some((o) => rectsIntersect(o.rect, mouth)), 'target door open');
  const neighbourMouth = { ...mouth, cx: w.target.width + 0.2 };
  assert.ok(w.obstacles.some((o) => o.kind === 'wall' && rectsIntersect(o.rect, neighbourMouth)), 'neighbour closed');
});
