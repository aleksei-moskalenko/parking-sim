// Collision queries against a World, and per-touch fault counting.

import { rectsIntersect, inflateRect } from './geometry.js';
import { bodyRect, wheelRects } from './vehicle.js';

const radius = (r) => Math.hypot(r.length, r.width) / 2;

// Cheap bounding-circle reject before the SAT test.
function overlaps(a, b) {
  const reach = radius(a) + radius(b);
  if (Math.abs(a.cx - b.cx) > reach || Math.abs(a.cy - b.cy) > reach) return false;
  return rectsIntersect(a, b);
}

// Body vs obstacles, wheels vs curbs (sidewalk zones). Returns [{ id, kind }].
export function findCollisions(world, state, spec, inflate = 0) {
  const hits = [];
  const body = inflateRect(bodyRect(state, spec), inflate);
  for (const o of world.obstacles) {
    if (overlaps(o.rect, body)) hits.push({ id: o.id, kind: o.kind });
  }
  if (world.curbs.length) {
    const wheels = Object.values(wheelRects(state, spec)).map((r) => inflateRect(r, inflate));
    for (const c of world.curbs) {
      if (wheels.some((w) => overlaps(c.rect, w))) hits.push({ id: c.id, kind: 'curb' });
    }
  }
  return hits;
}

// A touch counts once; it re-arms only after the car moves away from that object.
export class ContactTracker {
  constructor() {
    this.engaged = new Set();
  }

  onBlocked(hits) {
    const fresh = hits.filter((h) => !this.engaged.has(h.id));
    for (const h of fresh) this.engaged.add(h.id);
    return fresh;
  }

  release(nearHits) {
    const near = new Set(nearHits.map((h) => h.id));
    for (const id of this.engaged) if (!near.has(id)) this.engaged.delete(id);
  }
}
