// Closed cabin seen from the driver's seat, built for judging the car's
// extent rather than for detail: solid dash and floor, doors up to the window
// line, pillars placed so both side mirrors show through the side windows,
// a hood ending at the real front bumper and (sedan) a trunk lid ending at
// the real rear bumper.
// Car-local sim coordinates (x forward from the rear axle, y left, z up) map
// to three as (x, z, -y).

import * as THREE from 'three';
import { setLayer } from './models.js';
import { LAYER } from './layers.js';

// Heights in metres; x positions relative to the rear axle.
const CABIN = {
  sedan: {
    floor: 0.30, belt: 0.95, hood: 1.00, hoodDrop: 0.15, color: 0xe8613c,
    rearSeat: 0.15, rearWindowBase: -0.45, cPillarTop: 0.20, trunk: { z: 0.98, drop: 0.08 },
  },
  minivan: {
    floor: 0.42, belt: 1.12, hood: 1.15, hoodDrop: 0.25, color: 0x5b7fd0,
    rearSeat: 0.25, rearWindowBase: -0.95, cPillarTop: -0.95, trunk: null,
  },
};
const WS_BASE = 0.95;     // windscreen base / A-pillar foot, ahead of the eye
const WS_TOP = 0.35;      // windscreen top, ahead of the eye
const DASH_BACK = 0.55;   // dashboard rear face, ahead of the eye
const B_PILLAR = -0.35;   // behind the eye
const WHEEL = { ahead: 0.45, below: 0.30, radius: 0.19, tilt: 0.42, turnsToLock: 1.5 };
const COLORS = {
  dash: 0x2b2e33, door: 0x3b3f46, trim: 0x6b6f76, headliner: 0x9c9993,
  floor: 0x1e2024, seat: 0x33363c, wheel: 0x141518, marker: 0xffcc00,
};

const v3 = (x, y, z) => new THREE.Vector3(x, z, -y);
const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });

// Axis-aligned box from car-local extents.
function block([x0, x1], [y0, y1], [z0, z1], color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0), mat(color));
  m.position.copy(v3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  return m;
}

// Square bar between two car-local points.
function beam(a, b, thickness, color) {
  const pa = v3(...a), pb = v3(...b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(thickness, pa.distanceTo(pb), thickness), mat(color));
  m.position.copy(pa).add(pb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pb.clone().sub(pa).normalize());
  return m;
}

// Thin panel from x0 to x1 whose height goes from z0 to z1 (hood, trunk lid).
function slopedPanel(x0, x1, z0, z1, halfWidth, color) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 2 * halfWidth), mat(color));
  m.position.copy(v3((x0 + x1) / 2, 0, (z0 + z1) / 2));
  m.rotation.z = Math.atan2(z1 - z0, x1 - x0);
  return m;
}

function steeringWheel(eye) {
  const column = new THREE.Group();
  column.position.copy(v3(eye.x + WHEEL.ahead, eye.y, eye.z - WHEEL.below));
  column.rotation.z = -WHEEL.tilt;           // column rises toward the driver, rim top leans away
  const spinner = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL.radius, 0.028, 12, 48), mat(COLORS.wheel));
  rim.rotation.y = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20), mat(COLORS.wheel));
  hub.rotation.z = Math.PI / 2;
  spinner.add(rim, hub);
  for (const angle of [Math.PI / 2, Math.PI * 7 / 6, -Math.PI / 6]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.02, WHEEL.radius, 0.035), mat(COLORS.wheel));
    spoke.position.set(0, Math.sin(angle) * WHEEL.radius / 2, -Math.cos(angle) * WHEEL.radius / 2);
    spoke.rotation.x = angle - Math.PI / 2;
    spinner.add(spoke);
  }
  const marker = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.04), mat(COLORS.marker));
  marker.position.y = WHEEL.radius;
  spinner.add(marker);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.45, 12), mat(COLORS.dash));
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = 0.24;
  column.add(spinner, shaft);
  return { column, spinner };
}

export function buildCockpit(spec) {
  const c = CABIN[spec.id];
  const eye = spec.eye;
  const g = new THREE.Group();
  const hw = spec.width / 2 - 0.06;                  // inner door surface
  const roofZ = spec.height - 0.06;
  const front = spec.wheelbase + spec.frontOverhang;
  const rear = -spec.rearOverhang;
  const wsBase = eye.x + WS_BASE, wsTop = eye.x + WS_TOP, dashBack = eye.x + DASH_BACK;
  const cabinRear = c.trunk ? c.rearWindowBase : rear + 0.08;

  // Floor, dashboard (solid, full width, its top meets the hood), centre console.
  g.add(block([cabinRear, wsBase], [-hw, hw], [c.floor - 0.05, c.floor], COLORS.floor));
  g.add(block([dashBack, wsBase], [-hw, hw], [c.floor, c.hood], COLORS.dash));
  g.add(block([eye.x - 0.5, dashBack], [-0.13, 0.13], [c.floor, c.floor + 0.32], COLORS.dash));

  // Hood from the windscreen base to the real front bumper.
  g.add(slopedPanel(wsBase, front, c.hood, c.hood - c.hoodDrop, spec.width / 2 - 0.04, c.color));

  // Doors up to the window line, roof lining, pillars.
  for (const s of [1, -1]) {
    g.add(block([cabinRear, wsBase], s > 0 ? [hw, hw + 0.06] : [-hw - 0.06, -hw], [c.floor, c.belt], COLORS.door));
    g.add(beam([wsBase, s * (hw - 0.02), c.belt], [wsTop, s * (hw - 0.05), roofZ], 0.08, COLORS.trim));
    g.add(beam([eye.x + B_PILLAR, s * (hw - 0.02), c.belt], [eye.x + B_PILLAR - 0.05, s * (hw - 0.05), roofZ], 0.1, COLORS.trim));
    g.add(beam([c.rearWindowBase, s * (hw - 0.03), c.belt], [c.cPillarTop, s * (hw - 0.06), roofZ], 0.18, COLORS.trim));
  }
  g.add(block([c.cPillarTop - 0.05, wsTop], [-hw - 0.06, hw + 0.06], [roofZ, roofZ + 0.04], COLORS.headliner));

  // Rear bench and, on the sedan, parcel shelf + trunk lid to the real rear bumper.
  g.add(block([c.rearSeat - 0.15, c.rearSeat], [-hw, hw], [c.floor, c.belt - 0.05], COLORS.seat));
  if (c.trunk) {
    g.add(block([c.rearWindowBase, c.rearSeat - 0.15], [-hw, hw], [c.belt - 0.02, c.belt], COLORS.dash));
    g.add(slopedPanel(c.rearWindowBase, rear, c.trunk.z, c.trunk.z - c.trunk.drop, spec.width / 2 - 0.04, c.color));
  } else {
    g.add(block([rear, rear + 0.08], [-hw, hw], [c.floor, c.belt], COLORS.door));   // tailgate below the window
  }

  const wheel = steeringWheel(eye);
  g.add(wheel.column);

  setLayer(g, LAYER.cockpit);
  const maxSteer = spec.maxSteerDeg * Math.PI / 180;
  return {
    group: g,
    setSteer(steer) {
      // Positive steer (left) turns the rim counter-clockwise for the driver.
      wheel.spinner.rotation.x = -(steer / maxSteer) * WHEEL.turnsToLock * 2 * Math.PI;
    },
  };
}
