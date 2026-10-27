// Low-speed kinematic ("bicycle") car model with an automatic gearbox.
// Pose (x, y) is the centre of the rear axle; heading is CCW from +x.

export const PHYS = {
  steerTimeToLock: 1.5,
  creepD: 1.5,
  creepR: 1.2,
  creepAccel: 1.0,
  throttleAccel: 2.0,
  maxSpeedD: 8,
  maxSpeedR: 3,
  brakeDecel: 6.0,
  drag: 0.3,
  shiftSpeedEps: 0.1,
};

const WHEEL_PATCH_LENGTH = 0.4;

export const maxSteer = (spec) => spec.maxSteerDeg * Math.PI / 180;

export function createVehicle(spec, pose) {
  return { x: pose.x, y: pose.y, heading: pose.heading, speed: 0, steer: 0, gear: 'P' };
}

// Exact arc of the rear axle for signed distance ds at a constant steer angle.
export function advancePose(pose, wheelbase, steer, ds) {
  const h = pose.heading;
  if (Math.abs(steer) < 1e-9) {
    return { x: pose.x + ds * Math.cos(h), y: pose.y + ds * Math.sin(h), heading: h };
  }
  const R = wheelbase / Math.tan(steer);
  const dh = ds / R;
  return {
    x: pose.x + R * (Math.sin(h + dh) - Math.sin(h)),
    y: pose.y + R * (Math.cos(h) - Math.cos(h + dh)),
    heading: h + dh,
  };
}

const toward = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

function nextSpeed(state, input, dt) {
  const { gear, speed } = state;
  if (input.brake) return toward(speed, 0, PHYS.brakeDecel * dt);
  if (gear === 'N') return toward(speed, 0, PHYS.drag * dt);

  const dir = gear === 'D' ? 1 : -1;
  const along = dir * speed;
  if (input.throttle) {
    const max = gear === 'D' ? PHYS.maxSpeedD : PHYS.maxSpeedR;
    return dir * Math.min(max, along + PHYS.throttleAccel * dt);
  }
  const creep = gear === 'D' ? PHYS.creepD : PHYS.creepR;
  const step = (along < creep ? PHYS.creepAccel : PHYS.drag) * dt;
  return dir * toward(along, creep, step);
}

export function stepVehicle(state, spec, input, dt) {
  let steer = state.steer;
  if (input.left !== input.right) {
    const max = maxSteer(spec);
    steer += (input.left ? 1 : -1) * (max / PHYS.steerTimeToLock) * dt;
    steer = Math.max(-max, Math.min(max, steer));
  }
  if (state.gear === 'P') return { ...state, steer, speed: 0 };

  const speed = nextSpeed(state, input, dt);
  const pose = advancePose(state, spec.wheelbase, steer, speed * dt);
  return { ...state, ...pose, speed, steer };
}

export function shiftGear(state, gear, brakeHeld) {
  if (gear === state.gear) return { state, ok: true, reason: null };
  if (Math.abs(state.speed) >= PHYS.shiftSpeedEps) return { state, ok: false, reason: 'moving' };
  if (!brakeHeld) return { state, ok: false, reason: 'need-brake' };
  return { state: { ...state, gear, speed: 0 }, ok: true, reason: null };
}

const centerOffset = (spec) => spec.length / 2 - spec.rearOverhang;

export function bodyCenter(state, spec) {
  const d = centerOffset(spec);
  return [state.x + d * Math.cos(state.heading), state.y + d * Math.sin(state.heading)];
}

export function bodyRect(state, spec) {
  const [cx, cy] = bodyCenter(state, spec);
  return { cx, cy, length: spec.length, width: spec.width, heading: state.heading };
}

export function poseFromBodyCenter(spec, cx, cy, heading) {
  const d = centerOffset(spec);
  return { x: cx - d * Math.cos(heading), y: cy - d * Math.sin(heading), heading };
}

export function wheelCenters(state, spec) {
  const c = Math.cos(state.heading), s = Math.sin(state.heading);
  const at = (fwd, left) => [state.x + c * fwd - s * left, state.y + s * fwd + c * left];
  const t = spec.track / 2;
  return {
    fl: at(spec.wheelbase, t),
    fr: at(spec.wheelbase, -t),
    rl: at(0, t),
    rr: at(0, -t),
  };
}

export function wheelRects(state, spec) {
  const centers = wheelCenters(state, spec);
  const rect = ([cx, cy], heading) => ({ cx, cy, length: WHEEL_PATCH_LENGTH, width: spec.tireWidth, heading });
  return {
    fl: rect(centers.fl, state.heading + state.steer),
    fr: rect(centers.fr, state.heading + state.steer),
    rl: rect(centers.rl, state.heading),
    rr: rect(centers.rr, state.heading),
  };
}
