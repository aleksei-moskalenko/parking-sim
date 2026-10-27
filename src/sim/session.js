// One parking run: integrates the car, blocks it on contact, counts faults,
// and evaluates the final pose when the driver selects P.

import { CAR_SPECS } from './cars.js';
import { buildLevel } from './levels.js';
import { createVehicle, stepVehicle, shiftGear } from './vehicle.js';
import { findCollisions, ContactTracker } from './contacts.js';
import { evaluatePose } from './scoring.js';

const MAX_DT = 0.05;
const SUBSTEP = 1 / 120;
const RELEASE_DISTANCE = 0.10;
const MOVING_SPEED = 0.05;
const MIN_DISTANCE_TO_FINISH = 1.0;

export class Session {
  constructor(world, spec) {
    this.world = world;
    this.spec = spec;
    this.vehicle = createVehicle(spec, world.start);
    this.faults = [];
    this.hints = { top: false, trajectories: false };
    this.hintsUsed = false;
    this.directionChanges = 0;
    this.distance = 0;
    this.finished = false;
    this.result = null;
    this.tracker = new ContactTracker();
    this.lastDir = 0;
  }

  update(input, dt) {
    const newFaults = [];
    if (this.finished) return { newFaults };

    const total = Math.min(MAX_DT, dt);
    const n = Math.max(1, Math.ceil(total / SUBSTEP));
    for (let i = 0; i < n; i++) {
      const prev = this.vehicle;
      const next = stepVehicle(prev, this.spec, input, total / n);
      const hits = findCollisions(this.world, next, this.spec);
      if (hits.length) {
        for (const h of this.tracker.onBlocked(hits)) {
          const fault = h.kind === 'curb' ? { code: 'curb' } : { code: 'contact', kind: h.kind };
          this.faults.push(fault);
          newFaults.push(fault);
        }
        this.vehicle = { ...prev, steer: next.steer, speed: 0 };
      } else {
        this.distance += Math.hypot(next.x - prev.x, next.y - prev.y);
        this.vehicle = next;
      }
      this.trackDirection();
      this.tracker.release(findCollisions(this.world, this.vehicle, this.spec, RELEASE_DISTANCE));
    }
    return { newFaults };
  }

  trackDirection() {
    const v = this.vehicle.speed;
    if (Math.abs(v) <= MOVING_SPEED) return;
    const dir = Math.sign(v);
    if (this.lastDir && dir !== this.lastDir) this.directionChanges++;
    this.lastDir = dir;
  }

  shift(gear, brakeHeld) {
    if (this.finished) return { ok: false, reason: null };
    const r = shiftGear(this.vehicle, gear, brakeHeld);
    if (r.ok) this.vehicle = r.state;
    if (r.ok && gear === 'P' && this.distance > MIN_DISTANCE_TO_FINISH) this.finish();
    return { ok: r.ok, reason: r.reason };
  }

  setHint(name, on) {
    this.hints[name] = on;
    if (on) this.hintsUsed = true;
  }

  finish() {
    const evaluation = evaluatePose(this.world, this.vehicle, this.spec);
    const faults = [...this.faults, ...evaluation.faults];
    this.finished = true;
    this.result = {
      passed: faults.length === 0,
      faults,
      measures: evaluation.measures,
      directionChanges: this.directionChanges,
      hintsUsed: this.hintsUsed,
    };
  }
}

export function createSession({ exercise, level, carId }) {
  return new Session(buildLevel(exercise, level, carId), CAR_SPECS[carId]);
}
