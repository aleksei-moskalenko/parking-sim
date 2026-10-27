// Left, right and rear-view mirrors: a camera per mirror renders into a
// texture shown (horizontally flipped) on a small plane in front of the driver.

import * as THREE from 'three';
import { LAYER } from './layers.js';

const DEG = Math.PI / 180;
const v3 = (p) => new THREE.Vector3(p.x, p.z, -p.y);

const MIRRORS = [
  { key: 'left', size: [0.20, 0.13], rt: [640, 416], fov: 30, yaw: 90 - 10, layers: [LAYER.world, LAYER.ownBody, LAYER.roof] },
  { key: 'right', size: [0.20, 0.13], rt: [640, 416], fov: 30, yaw: 90 + 10, layers: [LAYER.world, LAYER.ownBody, LAYER.roof] },
  { key: 'center', size: [0.25, 0.07], rt: [1024, 288], fov: 25, yaw: 90, layers: [LAYER.world, LAYER.roof] },
];
const PITCH = -3 * DEG;

export function createMirrors(spec) {
  const group = new THREE.Group();
  const eye = v3(spec.eye);
  const mirrors = MIRRORS.map((m) => {
    const pos = v3(spec.mirrors[m.key]);
    const target = new THREE.WebGLRenderTarget(m.rt[0], m.rt[1]);
    target.texture.wrapS = THREE.RepeatWrapping;
    target.texture.repeat.x = -1;
    target.texture.offset.x = 1;

    const [w, h] = m.size;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: target.texture }));
    const housing = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, h + 0.03, 0.04), new THREE.MeshStandardMaterial({ color: 0x1b1d21 }));
    housing.position.z = -0.025;
    const holder = new THREE.Group();
    holder.position.copy(pos);
    holder.lookAt(eye);              // group not yet attached: local == world
    holder.add(plane, housing);
    holder.traverse((o) => o.layers.set(LAYER.cockpit));
    group.add(holder);

    // Camera looks back from the mirror; three cameras look along −Z, rotation.y = 90° faces −X.
    const camera = new THREE.PerspectiveCamera(m.fov, w / h, 0.05, 300);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(PITCH, m.yaw * DEG, 0);
    camera.position.copy(pos);
    camera.layers.disableAll();
    for (const l of m.layers) camera.layers.enable(l);
    group.add(camera);
    return { key: m.key, camera, target, aspect: w / h };
  });

  return {
    group,
    render(renderer, scene) {
      for (const m of mirrors) {
        renderer.setRenderTarget(m.target);
        renderer.render(scene, m.camera);
      }
      renderer.setRenderTarget(null);
    },
    dispose() {
      for (const m of mirrors) m.target.dispose();
    },
    mirrors,
  };
}

// The same three mirror images as large screen insets, so they are readable
// without hunting for the small mirrors in the cabin.
const INSET = {
  left: { width: 0.2, x: 'left', y: 0.6 },
  right: { width: 0.2, x: 'right', y: 0.6 },
  center: { width: 0.3, x: 'center', y: 0.1 },
};
const MARGIN = 14;
const FRAME = 4;

export function createMirrorOverlay(mirrorSet) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  const quads = mirrorSet.mirrors.map((m) => {
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x15171a, depthTest: false }));
    const image = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: m.target.texture, depthTest: false }));
    frame.renderOrder = 0;
    image.renderOrder = 1;
    scene.add(frame, image);
    return { ...m, frame, image };
  });

  return {
    render(renderer, width, height) {
      camera.right = width;
      camera.top = height;
      camera.updateProjectionMatrix();
      for (const q of quads) {
        const spec = INSET[q.key];
        const w = width * spec.width, h = w / q.aspect;
        const cx = spec.x === 'left' ? MARGIN + w / 2 : spec.x === 'right' ? width - MARGIN - w / 2 : width / 2;
        const cy = height * (1 - spec.y) - h / 2;
        q.image.position.set(cx, cy, 0);
        q.image.scale.set(w, h, 1);
        q.frame.position.set(cx, cy, 0);
        q.frame.scale.set(w + 2 * FRAME, h + 2 * FRAME, 1);
      }
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = autoClear;
    },
  };
}
