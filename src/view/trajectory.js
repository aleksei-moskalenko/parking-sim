// Where each wheel goes if the steering wheel stays where it is now.

import { advancePose, wheelCenters } from '../sim/vehicle.js';

export function predictWheelPaths(state, spec, { distance = 8, step = 0.25 } = {}) {
  const n = Math.round(distance / step);
  const result = {};
  for (const [name, dir] of [['forward', 1], ['reverse', -1]]) {
    const paths = { fl: [], fr: [], rl: [], rr: [] };
    for (let i = 0; i <= n; i++) {
      const pose = advancePose(state, spec.wheelbase, state.steer, dir * i * step);
      const centers = wheelCenters(pose, spec);
      for (const k of Object.keys(paths)) paths[k].push(centers[k]);
    }
    result[name] = paths;
  }
  return result;
}
