// Left, right and rear-view mirrors: a camera per mirror renders into a
// texture shown (horizontally flipped) on a small plane in front of the driver.

import * as THREE from 'three';
import { LAYER } from './layers.js';

const DEG = Math.PI / 180;
const v3 = (p) => new THREE.Vector3(p.x, p.z, -p.y);

const MIRRORS = [
  { key: 'left', size: [0.20, 0.13], rt: [512, 320], fov: 30, yaw: 90 - 10, layers: [LAYER.world, LAYER.ownBody, LAYER.roof] },
  { key: 'right', size: [0.20, 0.13], rt: [512, 320], fov: 30, yaw: 90 + 10, layers: [LAYER.world, LAYER.ownBody, LAYER.roof] },
  { key: 'center', size: [0.25, 0.07], rt: [640, 192], fov: 25, yaw: 90, layers: [LAYER.world, LAYER.cockpit, LAYER.roof] },
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
    return { camera, target };
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
  };
}
