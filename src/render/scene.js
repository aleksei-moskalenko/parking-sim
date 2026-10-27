// Static environment meshes built from a World.
// Sim (x, y, up) maps to three (x, up, -y); rotation.y = heading.

import * as THREE from 'three';
import { rectCorners } from '../sim/geometry.js';
import { makeModelMesh, setLayer } from './models.js';
import { LAYER } from './layers.js';

const COLORS = {
  ground: 0x76875f,
  asphalt: 0x4a4d52,
  sidewalk: 0xaaa69d,
  wall: 0xbfae94,
  fence: 0x6f757d,
  roof: 0x5d544c,
  line: 0xf4f4f4,
};
const BUILDING_COLORS = [0xd9c8a9, 0xc8b8a4, 0xb6c3c8, 0xd5b29f, 0xc1c9ae, 0xe0d5c3];
const CAR_COLORS = [0x9b2335, 0x2e5c8a, 0xd9d9d9, 0x1f1f1f, 0x6d7b84, 0x3c6e47, 0xb08a2e];
const SIDEWALK_HEIGHT = 0.15;
const LINE_WIDTH = 0.1;

const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });

export function placeOnGround(obj, rect, y = 0) {
  obj.position.set(rect.cx, y, -rect.cy);
  obj.rotation.y = rect.heading;
  return obj;
}

function slab(rect, height, color, y0 = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(rect.length, height, rect.width), mat(color));
  return placeOnGround(m, rect, y0 + height / 2);
}

function flat(rect, color, y) {
  const g = new THREE.PlaneGeometry(rect.length, rect.width);
  g.rotateX(-Math.PI / 2);
  return placeOnGround(new THREE.Mesh(g, mat(color)), rect, y);
}

function outline(rect, y) {
  const group = new THREE.Group();
  const c = rectCorners(rect);
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = c[i], [bx, by] = c[(i + 1) % 4];
    const edge = {
      cx: (ax + bx) / 2, cy: (ay + by) / 2,
      length: Math.hypot(bx - ax, by - ay) + LINE_WIDTH, width: LINE_WIDTH,
      heading: Math.atan2(by - ay, bx - ax),
    };
    group.add(flat(edge, COLORS.line, y));
  }
  return group;
}

export function buildEnvironment(world, models) {
  const env = new THREE.Group();
  const b = world.bounds;
  const area = { cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, length: b.maxX - b.minX, width: b.maxY - b.minY, heading: 0 };

  env.add(flat({ ...area, length: area.length + 200, width: area.width + 200 }, COLORS.ground, -0.01));
  env.add(flat(area, COLORS.asphalt, 0));
  for (const c of world.curbs) env.add(slab(c.rect, SIDEWALK_HEIGHT, COLORS.sidewalk));
  env.add(outline(world.target, 0.012));

  world.decor.buildings.forEach((r, i) => env.add(slab(r, r.height, BUILDING_COLORS[i % BUILDING_COLORS.length])));
  // Roofs are hidden from the top view so the box interior stays visible.
  for (const r of world.decor.roofs) env.add(setLayer(slab(r, 0.15, COLORS.roof, r.height), LAYER.roof));

  let carIndex = 0;
  for (const o of world.obstacles) {
    if (o.kind === 'wall') {
      env.add(slab(o.rect, o.height, o.height < 2 ? COLORS.fence : COLORS.wall));
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
      for (const m of [].concat(o.material ?? [])) m.dispose();
    }
  });
}
