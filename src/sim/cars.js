// Real-world dimensions (metres). Positions (eye, mirrors) are relative to the
// rear-axle centre: x forward, y left, z up.

export const CAR_SPECS = {
  sedan: {
    id: 'sedan',
    name: 'Седан',
    model: 'sedan',
    length: 4.70, width: 1.80, height: 1.45,
    wheelbase: 2.75,
    frontOverhang: 0.95, rearOverhang: 1.00,
    track: 1.56, tireWidth: 0.22, wheelRadius: 0.32,
    maxSteerDeg: 35,
    eye: { x: 1.15, y: 0.37, z: 1.15 },
    mirrors: {
      left: { x: 1.95, y: 1.00, z: 1.08 },
      right: { x: 1.95, y: -1.00, z: 1.08 },
      center: { x: 1.80, y: 0, z: 1.30 },
    },
  },
  minivan: {
    id: 'minivan',
    name: 'Минивэн',
    model: 'van',
    length: 5.10, width: 1.95, height: 1.80,
    wheelbase: 3.00,
    frontOverhang: 0.95, rearOverhang: 1.15,
    track: 1.70, tireWidth: 0.23, wheelRadius: 0.34,
    maxSteerDeg: 33,
    eye: { x: 1.35, y: 0.40, z: 1.40 },
    mirrors: {
      left: { x: 2.20, y: 1.08, z: 1.30 },
      right: { x: 2.20, y: -1.08, z: 1.30 },
      center: { x: 2.00, y: 0, z: 1.60 },
    },
  },
};

// Cars that stand around the target spot.
export const PARKED_TYPES = [
  { model: 'sedan', length: 4.6, width: 1.8, height: 1.45 },
  { model: 'suv', length: 4.8, width: 1.9, height: 1.7 },
  { model: 'hatchback', length: 4.2, width: 1.78, height: 1.4 },
  { model: 'taxi', length: 4.6, width: 1.8, height: 1.5 },
  { model: 'van', length: 5.0, width: 1.95, height: 1.9 },
];
