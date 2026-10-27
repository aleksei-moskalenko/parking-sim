// Procedural interior seen from the driver's seat. Car-local sim coordinates
// (x forward from the rear axle, y left, z up) map to three as (x, z, -y).
// The hood's front edge sits exactly at the real front bumper.

import * as THREE from 'three';
import { setLayer } from './models.js';
import { LAYER } from './layers.js';

const CABIN = {
  sedan: { hood: 1.0, sill: 0.95, hoodDrop: 0.15 },
  minivan: { hood: 1.15, sill: 1.1, hoodDrop: 0.2 },
};
const WHEEL_TURNS_LOCK_TO_CENTRE = 1.5;   // 540° of steering wheel at full lock
const COLORS = { interior: 0x22252a, trim: 0x34383f, body: 0xd6d8da, wheel: 0x15171a, marker: 0xffcc00 };

const v3 = (x, y, z) => new THREE.Vector3(x, z, -y);
const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 });

function box(size, center, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.z, size.y), mat(color));
  m.position.copy(v3(center.x, center.y, center.z));
  return m;
}

// Thin bar between two car-local points.
function beam(a, b, thickness, color) {
  const pa = v3(a.x, a.y, a.z), pb = v3(b.x, b.y, b.z);
  const len = pa.distanceTo(pb);
  const m = new THREE.Mesh(new THREE.BoxGeometry(thickness, len, thickness), mat(color));
  m.position.copy(pa).add(pb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pb.clone().sub(pa).normalize());
  return m;
}

export function buildCockpit(spec) {
  const c = CABIN[spec.id];
  const eye = spec.eye;
  const group = new THREE.Group();
  const halfW = spec.width / 2;
  const roofZ = spec.height - 0.05;
  const front = spec.wheelbase + spec.frontOverhang;
  const dashBack = eye.x + 0.45, dashFront = eye.x + 0.85;

  // Dashboard.
  // Its top stays below the hood line so the whole hood is visible.
  group.add(box({ x: dashFront - dashBack, y: spec.width - 0.15, z: 0.35 }, { x: (dashBack + dashFront) / 2, y: 0, z: c.hood - 0.235 }, COLORS.interior));

  // Hood, sloping down to the front bumper.
  const hoodLen = front - dashFront;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(hoodLen, 0.04, spec.width - 0.1), mat(COLORS.body));
  hood.position.copy(v3(dashFront + hoodLen / 2, 0, c.hood - c.hoodDrop / 2));
  hood.rotation.z = -Math.atan2(c.hoodDrop, hoodLen);
  group.add(hood);

  // Pillars, roof and sills on both sides.
  for (const s of [1, -1]) {
    group.add(beam({ x: dashFront + 0.05, y: s * (halfW - 0.1), z: c.hood }, { x: eye.x + 0.35, y: s * (halfW - 0.15), z: roofZ }, 0.07, COLORS.trim));
    group.add(beam({ x: eye.x - 0.5, y: s * (halfW - 0.08), z: c.sill }, { x: eye.x - 0.5, y: s * (halfW - 0.12), z: roofZ }, 0.09, COLORS.trim));
    group.add(beam({ x: -0.35, y: s * (halfW - 0.1), z: c.sill }, { x: 0.25, y: s * (halfW - 0.15), z: roofZ }, 0.16, COLORS.trim));
    group.add(box({ x: dashFront - (-spec.rearOverhang + 0.3), y: 0.06, z: c.sill - 0.35 }, { x: (dashFront + (-spec.rearOverhang + 0.3)) / 2, y: s * (halfW - 0.05), z: c.sill - 0.175 }, COLORS.interior));
  }
  group.add(box({ x: eye.x + 0.2 - 0.25, y: spec.width - 0.2, z: 0.03 }, { x: (eye.x + 0.2 + 0.25) / 2, y: 0, z: roofZ }, COLORS.trim));
  group.add(box({ x: eye.x + 0.2 - 0.25, y: spec.width - 0.2, z: 0.02 }, { x: (eye.x + 0.2 + 0.25) / 2, y: 0, z: roofZ + 0.02 }, COLORS.interior));
  // Rear parcel shelf.
  group.add(box({ x: 0.5, y: spec.width - 0.2, z: 0.04 }, { x: -spec.rearOverhang + 0.6, y: 0, z: c.sill }, COLORS.interior));

  // Steering wheel: column pivot → spinner (turns) → rim + spokes + top marker.
  const column = new THREE.Group();
  column.position.copy(v3(eye.x + 0.50, eye.y, eye.z - 0.42));
  column.rotation.z = 0.35;
  const spinner = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 10, 36), mat(COLORS.wheel));
  rim.rotation.y = Math.PI / 2;
  const spokes = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.34), mat(COLORS.wheel));
  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.03), mat(COLORS.marker));
  marker.position.y = 0.18;
  spinner.add(rim, spokes, marker);
  column.add(spinner);
  group.add(column);

  setLayer(group, LAYER.cockpit);
  const maxSteer = spec.maxSteerDeg * Math.PI / 180;
  return {
    group,
    setSteer(steer) {
      // Positive steer (left) turns the rim counter-clockwise for the driver.
      spinner.rotation.x = -(steer / maxSteer) * WHEEL_TURNS_LOCK_TO_CENTRE * 2 * Math.PI;
    },
  };
}
