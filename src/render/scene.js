// Static environment meshes built from a World.
// Sim (x, y, up) maps to three (x, up, -y); rotation.y = heading.

import * as THREE from 'three';
import { rectCorners } from '../sim/geometry.js';
import { ROW_EDGE } from '../sim/levels.js';
import { makeModelMesh, setLayer } from './models.js';
import { texturedMaterial } from './textures.js';
import { LAYER } from './layers.js';

const COLORS = {
  ground: 0x76875f,
  roof: 0x5d544c,
  line: 0xf4f4f4,
  curbStone: 0xd4cfc6,
};
const BUILDING_TINTS = [0xf0dcc0, 0xdcd0c4, 0xc9d6dc, 0xeccab8, 0xd5dcc0, 0xf2eadc];
const CAR_COLORS = [0x9b2335, 0x2e5c8a, 0xd9d9d9, 0x1f1f1f, 0x6d7b84, 0x3c6e47, 0xb08a2e];
const SIDEWALK_HEIGHT = 0.15;
const CURB_STONE = { width: 0.18, height: 0.16 };
const LINE_WIDTH = 0.1;
const DASH = { length: 1.5, gap: 1.5 };

const plain = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });

export function placeOnGround(obj, rect, y = 0) {
  obj.position.set(rect.cx, y, -rect.cy);
  obj.rotation.y = rect.heading;
  return obj;
}

function slab(rect, height, material, y0 = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(rect.length, height, rect.width), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return placeOnGround(m, rect, y0 + height / 2);
}

function flat(rect, material, y) {
  const g = new THREE.PlaneGeometry(rect.length, rect.width);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  return placeOnGround(m, rect, y);
}

function outline(rect, y) {
  const group = new THREE.Group();
  const c = rectCorners(rect);
  const material = plain(COLORS.line);
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = c[i], [bx, by] = c[(i + 1) % 4];
    const edge = {
      cx: (ax + bx) / 2, cy: (ay + by) / 2,
      length: Math.hypot(bx - ax, by - ay) + LINE_WIDTH, width: LINE_WIDTH,
      heading: Math.atan2(by - ay, bx - ax),
    };
    group.add(flat(edge, material, y));
  }
  return group;
}

// Wall material per look; textures repeat per real-world metre so distance reads.
function wallMaterial(o) {
  const along = Math.max(o.rect.length, o.rect.width);
  switch (o.look) {
    case 'garage': return texturedMaterial('garage', along, o.height);
    case 'door': return texturedMaterial('door', along, o.height);
    case 'fence': return texturedMaterial('fence', along, o.height);
    default: return texturedMaterial('brick', along, o.height);
  }
}

// Sidewalk with a curb stone along both long edges.
function sidewalk(rect) {
  const group = new THREE.Group();
  group.add(slab(rect, SIDEWALK_HEIGHT, texturedMaterial('sidewalk', rect.length, rect.width)));
  for (const side of [1, -1]) {
    const stone = { ...rect, cy: rect.cy + side * (rect.width / 2 - CURB_STONE.width / 2), width: CURB_STONE.width };
    group.add(slab(stone, CURB_STONE.height, plain(COLORS.curbStone)));
  }
  return group;
}

// Dashed line along the outer edge of the parking lane.
function laneLine(world) {
  const group = new THREE.Group();
  const y = -world.curbLine.sidewalkSign * ROW_EDGE;
  const material = plain(COLORS.line);
  for (let x = world.bounds.minX; x < world.bounds.maxX; x += DASH.length + DASH.gap) {
    group.add(flat({ cx: x + DASH.length / 2, cy: y, length: DASH.length, width: LINE_WIDTH, heading: 0 }, material, 0.011));
  }
  return group;
}

export function buildEnvironment(world, models) {
  const env = new THREE.Group();
  const b = world.bounds;
  const area = { cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, length: b.maxX - b.minX, width: b.maxY - b.minY, heading: 0 };

  env.add(flat({ ...area, length: area.length + 200, width: area.width + 200 }, plain(COLORS.ground), -0.01));
  env.add(flat(area, texturedMaterial('asphalt', area.length, area.width), 0));
  for (const c of world.curbs) env.add(sidewalk(c.rect));
  if (world.curbLine) env.add(laneLine(world));
  env.add(outline(world.target, 0.012));

  world.decor.buildings.forEach((r, i) => {
    env.add(slab(r, r.height, texturedMaterial('facade', Math.max(r.length, r.width), r.height, BUILDING_TINTS[i % BUILDING_TINTS.length])));
  });
  for (const r of world.decor.roofs) {
    env.add(flat(r, texturedMaterial('concrete', r.length, r.width), 0.004));   // garage floor
    const roof = slab(r, 0.15, plain(COLORS.roof), r.height);
    roof.castShadow = false;   // keep the boxes lit; their walls still cast shadows
    // Roofs are hidden from the top view so the box interior stays visible.
    env.add(setLayer(roof, LAYER.roof));
  }

  let carIndex = 0;
  for (const o of world.obstacles) {
    if (o.kind === 'wall') {
      env.add(slab(o.rect, o.height, wallMaterial(o)));
    } else {
      const dims = { length: o.rect.length, width: o.rect.width, height: o.height };
      const color = CAR_COLORS[carIndex++ % CAR_COLORS.length];
      env.add(placeOnGround(makeModelMesh(o.model, dims, models, color), o.rect));
    }
  }
  return env;
}

export function disposeObject(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose();
      for (const m of [].concat(o.material ?? [])) {
        m.map?.dispose();
        m.dispose();
      }
    }
  });
}
