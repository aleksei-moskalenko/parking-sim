// Final-pose evaluation and the Russian texts for every fault.

import { rectInsideRect, axisAngleDiff, localPoint } from './geometry.js';
import { bodyRect, bodyCenter, wheelCenters } from './vehicle.js';

export const LIMITS = { curbDistance: 0.30, angleDeg: 3, lateralOffset: 0.15, spotTolerance: 0.05 };

const toDeg = (r) => r * 180 / Math.PI;
const cm = (m) => Math.round(m * 100);

// Gap from the curb line to the outer edge of the curb-side wheels (the worse of the two).
function curbDistance(world, state, spec) {
  const { y, sidewalkSign } = world.curbLine;
  const gaps = Object.values(wheelCenters(state, spec))
    .map(([, wy]) => (wy - y) * -sidewalkSign - spec.tireWidth / 2)
    .sort((a, b) => a - b);
  return Math.max(gaps[0], gaps[1]);
}

export function evaluatePose(world, state, spec) {
  const faults = [];
  const measures = {};

  if (!rectInsideRect(bodyRect(state, spec), world.target, LIMITS.spotTolerance)) {
    faults.push({ code: 'not-in-spot' });
  }

  if (world.curbLine) {
    measures.curbDistance = curbDistance(world, state, spec);
    if (measures.curbDistance > LIMITS.curbDistance) faults.push({ code: 'too-far', value: measures.curbDistance });
  }

  measures.angleDeg = toDeg(axisAngleDiff(state.heading, world.targetAxis));
  if (measures.angleDeg > LIMITS.angleDeg) faults.push({ code: 'angle', value: measures.angleDeg });

  if (world.exercise === 'garage') {
    measures.lateralOffset = Math.abs(localPoint(world.target, bodyCenter(state, spec))[1]);
    if (measures.lateralOffset > LIMITS.lateralOffset) faults.push({ code: 'off-center', value: measures.lateralOffset });
  }

  return { faults, measures };
}

const CONTACT_TEXT = { car: 'машина', cone: 'конус', wall: 'стена' };

export function formatFault(fault, exercise) {
  switch (fault.code) {
    case 'contact': return `Касание: ${CONTACT_TEXT[fault.kind]}`;
    case 'curb': return 'Наезд на бордюр';
    case 'not-in-spot': return exercise === 'garage' ? 'Машина не целиком в боксе' : 'Машина не целиком в разметке места';
    case 'too-far': return `Далеко от бордюра: ${cm(fault.value)} см (норма ≤ 30 см)`;
    case 'angle': return `Криво: ${fault.value.toFixed(1)}° (норма ≤ 3°)`;
    case 'off-center': return `Не по центру бокса: ${cm(fault.value)} см (норма ≤ 15 см)`;
    default: return fault.code;
  }
}
