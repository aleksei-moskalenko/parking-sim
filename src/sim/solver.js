// Weighted hybrid-A* over short arcs. Used only to prove that a level can be
// passed (any number of shuffles allowed); the game never calls it.

import { advancePose, bodyCenter, maxSteer } from './vehicle.js';
import { findCollisions } from './contacts.js';
import { evaluatePose } from './scoring.js';
import { axisAngleDiff, normalizeAngle } from './geometry.js';

const ARC = 0.3;
const SUBSTEPS = 3;
const DEFAULT_CELL = 0.1;
const DEFAULT_ANGLE_CELL_DEG = 3;
const DIR_CHANGE_COST = 1.0;
const H_WEIGHT = 1.5;
const SEARCH_MARGIN = 8;
const OBSTACLE_RADIUS = 25;

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

// Same world, but only the obstacles that can matter near start and target.
function localWorld(world) {
  const { start, target } = world;
  const near = (r) => Math.min(Math.hypot(r.cx - start.x, r.cy - start.y), Math.hypot(r.cx - target.cx, r.cy - target.cy)) < OBSTACLE_RADIUS;
  return { ...world, obstacles: world.obstacles.filter((o) => near(o.rect)) };
}

export function findSolution(world, spec, { maxExpansions = 400000, cell = DEFAULT_CELL, angleCellDeg = DEFAULT_ANGLE_CELL_DEG } = {}) {
  const angleCell = angleCellDeg * Math.PI / 180;
  const w = localWorld(world);
  const max = maxSteer(spec);
  const steers = [-max, -max / 2, 0, max / 2, max];
  const { start, target } = w;
  const box = {
    minX: Math.max(w.bounds.minX, Math.min(start.x, target.cx) - SEARCH_MARGIN),
    maxX: Math.min(w.bounds.maxX, Math.max(start.x, target.cx) + SEARCH_MARGIN),
    minY: w.bounds.minY,
    maxY: w.bounds.maxY,
  };

  const key = (p) => `${Math.round(p.x / cell)},${Math.round(p.y / cell)},${Math.round(normalizeAngle(p.heading) / angleCell)}`;
  const heuristic = (p) => {
    const [cx, cy] = bodyCenter(p, spec);
    return H_WEIGHT * (Math.hypot(cx - target.cx, cy - target.cy) + 2 * axisAngleDiff(p.heading, w.targetAxis));
  };
  const free = (p, steer) =>
    p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY &&
    findCollisions(w, { ...p, steer }, spec).length === 0;

  const open = new MinHeap();
  const closed = new Set();
  const startPose = { x: start.x, y: start.y, heading: start.heading };
  open.push({ pose: startPose, g: 0, f: heuristic(startPose), dir: 0, steer: 0, parent: null });

  let expansions = 0;
  while (open.size && expansions < maxExpansions) {
    const node = open.pop();
    const k = key(node.pose);
    if (closed.has(k)) continue;
    closed.add(k);
    expansions++;

    if (evaluatePose(w, node.pose, spec).faults.length === 0) {
      const path = [];
      for (let n = node; n; n = n.parent) path.push({ ...n.pose, steer: n.steer, dir: n.dir });
      return { found: true, path: path.reverse(), expansions };
    }

    for (const dir of [1, -1]) {
      for (const steer of steers) {
        let p = node.pose;
        let ok = true;
        for (let s = 0; s < SUBSTEPS && ok; s++) {
          p = advancePose(p, spec.wheelbase, steer, (dir * ARC) / SUBSTEPS);
          ok = free(p, steer);
        }
        if (!ok || closed.has(key(p))) continue;
        const g = node.g + ARC + (node.dir && node.dir !== dir ? DIR_CHANGE_COST : 0);
        open.push({ pose: p, g, f: g + heuristic(p), dir, steer, parent: node });
      }
    }
  }
  return { found: false, path: [], expansions };
}
