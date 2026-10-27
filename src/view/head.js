// Driver's head: the mouse sets a target, the head follows it smoothly
// (critically damped), so looking around never snaps. Yaw + = look left.

const DEG = Math.PI / 180;
const MAX_YAW = 160 * DEG;
const MAX_PITCH = 40 * DEG;
const SMOOTH_TIME = 0.12;
const LEAN = 0.25;

const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v));

export function createHead() {
  return { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0, yawVel: 0, pitchVel: 0 };
}

export function applyMouse(head, dx, dy, sens = 0.0025) {
  head.targetYaw = clamp(head.targetYaw - dx * sens, MAX_YAW);
  head.targetPitch = clamp(head.targetPitch - dy * sens, MAX_PITCH);
}

export function resetHead(head) {
  head.targetYaw = 0;
  head.targetPitch = 0;
}

// Critically damped spring (stable for any dt).
function smoothDamp(current, target, vel, dt) {
  const omega = 2 / SMOOTH_TIME;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (vel + omega * change) * dt;
  return [target + (change + temp) * decay, (vel - omega * temp) * decay];
}

export function updateHead(head, dt) {
  [head.yaw, head.yawVel] = smoothDamp(head.yaw, head.targetYaw, head.yawVel, dt);
  [head.pitch, head.pitchVel] = smoothDamp(head.pitch, head.targetPitch, head.pitchVel, dt);
}

const smoothstep = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Car-local eye offset: lean toward the cabin centre when looking back.
export function headOffset(head) {
  const lean = smoothstep(90 * DEG, MAX_YAW, Math.abs(head.yaw));
  return { x: 0, y: lean ? -LEAN * lean : 0, z: 0 };
}
