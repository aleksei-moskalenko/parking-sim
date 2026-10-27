// One run on screen: session + scene + cameras + render loop.

import * as THREE from 'three';
import { createSession } from './sim/session.js';
import { createInput } from './input.js';
import { buildEnvironment, disposeObject } from './render/scene.js';
import { makeModelMesh, setLayer } from './render/models.js';
import { createTopCamera } from './render/hints.js';
import { LAYER } from './render/layers.js';

const GEARS = { Digit1: 'P', Digit2: 'R', Digit3: 'N', Digit4: 'D' };

let renderer = null;

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('app').appendChild(renderer.domElement);
    window.addEventListener('resize', () => renderer.setSize(window.innerWidth, window.innerHeight));
  }
  return renderer;
}

function buildScene(world, models) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbcd4ea);
  scene.fog = new THREE.Fog(0xbcd4ea, 60, 160);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5d6650, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(30, 50, 20);
  scene.add(sun);
  scene.add(buildEnvironment(world, models));
  return scene;
}

function buildOwnCar(spec, models) {
  const car = new THREE.Group();   // origin = rear-axle centre
  const body = makeModelMesh(spec.model, spec, models, 0xe8e8e8);
  body.position.x = spec.length / 2 - spec.rearOverhang;
  setLayer(body, LAYER.ownBody);
  car.add(body);
  return car;
}

export class Run {
  constructor(config, { models }) {
    this.config = config;
    this.session = createSession(config);
    this.renderer = getRenderer();
    this.scene = buildScene(this.session.world, models);
    this.car = buildOwnCar(this.session.spec, models);
    this.scene.add(this.car);
    this.top = createTopCamera();
    this.input = createInput(window);
    this.input.onKey((code) => this.onKey(code));
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  onKey(code) {
    const s = this.session;
    if (GEARS[code]) s.shift(GEARS[code], this.input.state.brake);
    else if (code === 'KeyT') s.setHint('top', !s.hints.top);
    else if (code === 'KeyH') s.setHint('trajectories', !s.hints.trajectories);
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.session.update(this.input.state, dt);
    this.syncCar();
    const aspect = window.innerWidth / window.innerHeight;
    this.top.update(this.session, aspect);
    this.renderer.render(this.scene, this.top.camera);
    this.raf = requestAnimationFrame(this.frame);
  }

  syncCar() {
    const v = this.session.vehicle;
    this.car.position.set(v.x, 0, -v.y);
    this.car.rotation.y = v.heading;
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.input.dispose();
    disposeObject(this.scene);
  }
}

export function startRun(config, deps) {
  return new Run(config, deps);
}
