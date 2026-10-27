// Hint visuals: the top-down camera.

import * as THREE from 'three';
import { bodyCenter } from '../sim/vehicle.js';
import { LAYER } from './layers.js';

const TOP_VIEW_WIDTH = 24;
const TOP_VIEW_HEIGHT = 30;

export function createTopCamera() {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.up.set(0, 0, -1);          // sim +y is screen-up
  camera.layers.enable(LAYER.ownBody);
  return {
    camera,
    update(session, aspect) {
      const half = TOP_VIEW_WIDTH / 2;
      camera.left = -half;
      camera.right = half;
      camera.top = half / aspect;
      camera.bottom = -half / aspect;
      camera.updateProjectionMatrix();
      const [cx, cy] = bodyCenter(session.vehicle, session.spec);
      camera.position.set(cx, TOP_VIEW_HEIGHT, -cy);
      camera.lookAt(cx, 0, -cy);
    },
  };
}

// Wheel paths as flat ribbons on the road: front axle yellow, rear axle cyan,
// reverse paths fainter.
const RIBBON_WIDTH = 0.07;
const RIBBON_Y = 0.02;
const PATH_COLORS = { front: 0xffcc00, rear: 0x00d0ff };

function ribbonMesh(points, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points * 2 * 3), 3));
  const index = [];
  for (let i = 0; i < points - 1; i++) {
    const a = 2 * i;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

function writeRibbon(mesh, path) {
  const pos = mesh.geometry.attributes.position;
  const n = path.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = path[Math.max(0, i - 1)], [bx, by] = path[Math.min(n - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (-(by - ay) / len) * (RIBBON_WIDTH / 2), ny = ((bx - ax) / len) * (RIBBON_WIDTH / 2);
    const [x, y] = path[i];
    pos.setXYZ(2 * i, x + nx, RIBBON_Y, -(y + ny));
    pos.setXYZ(2 * i + 1, x - nx, RIBBON_Y, -(y - ny));
  }
  pos.needsUpdate = true;
}

export function createTrajectoryLines(points = 33) {
  const object = new THREE.Group();
  const meshes = [];
  for (const dir of ['forward', 'reverse']) {
    for (const wheel of ['fl', 'fr', 'rl', 'rr']) {
      const color = wheel[0] === 'f' ? PATH_COLORS.front : PATH_COLORS.rear;
      const material = new THREE.MeshBasicMaterial({
        color, side: THREE.DoubleSide, transparent: true, opacity: dir === 'forward' ? 1 : 0.6, depthWrite: false,
      });
      const mesh = ribbonMesh(points, material);
      meshes.push({ dir, wheel, mesh });
      object.add(mesh);
    }
  }
  object.visible = false;
  return {
    object,
    update(paths) {
      for (const m of meshes) writeRibbon(m.mesh, paths[m.dir][m.wheel]);
    },
  };
}
