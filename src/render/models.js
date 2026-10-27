// Kenney Car Kit (CC0) models, normalised to real dimensions; a simple box
// stands in for any model that fails to load.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { robustSpan } from '../view/fit.js';

export const MODEL_FILES = {
  sedan: 'sedan.glb',
  van: 'van.glb',
  suv: 'suv.glb',
  hatchback: 'hatchback-sports.glb',
  taxi: 'taxi.glb',
  cone: 'cone.glb',
};

// Extra yaw so a model's nose points along +X after the long-axis alignment.
const MODEL_YAW_FIX = 0;

export async function loadModels() {
  const loader = new GLTFLoader();
  const models = new Map();
  await Promise.all(Object.entries(MODEL_FILES).map(async ([key, file]) => {
    try {
      models.set(key, (await loader.loadAsync(`assets/models/${file}`)).scene);
    } catch (e) {
      console.warn(`Модель ${file} не загрузилась, вместо неё коробка:`, e?.message ?? e);
      models.set(key, null);
    }
  }));
  return models;
}

const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });

function boxCar({ length, width, height }, color) {
  const g = new THREE.Group();
  const clearance = 0.18;
  const lower = new THREE.Mesh(new THREE.BoxGeometry(length, height * 0.5, width), material(color));
  lower.position.y = clearance + height * 0.25;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(length * 0.5, height * 0.5 - clearance, width * 0.9), material(0x2a3440));
  cabin.position.set(-length * 0.05, clearance + height * 0.5 + (height * 0.5 - clearance) / 2, 0);
  g.add(lower, cabin);
  return g;
}

function boxCone({ height }) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.15, height, 12), material(0xff6a00));
  m.position.y = height / 2;
  return m;
}

// Body width without protruding side mirrors (they do not count for collisions).
function bodyWidthSpan(holder) {
  holder.updateMatrixWorld(true);
  const root = holder.getObjectByName('body') ?? holder;
  const zs = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) zs.push(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).z);
  });
  return robustSpan(zs);
}

// Group whose forward is +X, centred on the body centre, bottom at y = 0;
// the body (not the mirrors) fills dims exactly.
export function makeModelMesh(key, dims, models, color = 0x8899aa) {
  const group = new THREE.Group();
  const src = models.get(key);
  if (!src) {
    group.add(key === 'cone' ? boxCone(dims) : boxCar(dims, color));
    return shadows(group);
  }
  const obj = src.clone(true);
  const raw = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  obj.rotation.y = (raw.z > raw.x ? Math.PI / 2 : 0) + MODEL_YAW_FIX;

  const holder = new THREE.Group();
  holder.add(obj);
  holder.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
  const width = key === 'cone' ? { size: size.z, center: 0 } : bodyWidthSpan(holder);
  holder.scale.set(dims.length / size.x, dims.height / size.y, dims.width / width.size);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const center = box.getCenter(new THREE.Vector3());
  holder.position.set(-center.x, -box.min.y, -width.center * holder.scale.z);
  group.add(holder);

  group.userData.frontWheels = ['wheel-front-left', 'wheel-front-right']
    .map((n) => obj.getObjectByName(n))
    .filter(Boolean)
    .map((w) => ({ node: w, base: w.quaternion.clone() }));
  return shadows(group);
}

const UP = new THREE.Vector3(0, 1, 0);
const steerQ = new THREE.Quaternion();

// Turn a model's front wheels; positive steer = left.
export function steerWheels(group, steer) {
  steerQ.setFromAxisAngle(UP, steer);
  for (const w of group.userData.frontWheels ?? []) w.node.quaternion.copy(steerQ).multiply(w.base);
}

function shadows(group) {
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}

export function setLayer(object, layer) {
  object.traverse((o) => o.layers.set(layer));
  return object;
}
