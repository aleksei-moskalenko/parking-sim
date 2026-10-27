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
