// One run on screen: session + scene + cameras + render loop.
// States: ready (waiting for the first click) → running ⇄ paused → finished.

import * as THREE from 'three';
import { createSession } from './sim/session.js';
import { createInput } from './input.js';
import { buildEnvironment, disposeObject } from './render/scene.js';
import { makeModelMesh, setLayer, steerWheels } from './render/models.js';
import { createTopCamera, createTrajectoryLines } from './render/hints.js';
import { createMirrors, createMirrorOverlay } from './render/mirrors.js';
import { predictWheelPaths } from './view/trajectory.js';
import { buildCockpit } from './render/cockpit.js';
import { LAYER } from './render/layers.js';
import { createHead, applyMouse, resetHead, updateHead, headOffset } from './view/head.js';

const GEARS = { Digit1: 'P', Digit2: 'R', Digit3: 'N', Digit4: 'D' };
// Sun offset from the car (three coords): low enough for readable shadows.
const SUN_OFFSET = new THREE.Vector3(-18, 26, 12);
const SHADOW_HALF_SIZE = 22;
const SHIFT_MESSAGES = {
  moving: 'Сначала остановитесь',
  'need-brake': 'Нажмите тормоз (S), чтобы переключить передачу',
};

let renderer = null;

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;   // refreshed once per frame, shared by all views
    document.getElementById('app').appendChild(renderer.domElement);
    window.addEventListener('resize', () => renderer.setSize(window.innerWidth, window.innerHeight));
  }
  return renderer;
}

function buildScene(world, models) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbcd4ea);
  scene.fog = new THREE.Fog(0xbcd4ea, 60, 160);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5d6650, 0.9));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -SHADOW_HALF_SIZE, right: SHADOW_HALF_SIZE, top: SHADOW_HALF_SIZE, bottom: -SHADOW_HALF_SIZE, near: 1, far: 90 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  scene.add(buildEnvironment(world, models));
  return { scene, sun };
}

function buildOwnCar(spec, models) {
  const car = new THREE.Group();   // origin = rear-axle centre
  const body = makeModelMesh(spec.model, spec, models, 0xe8e8e8);
  body.position.x = spec.length / 2 - spec.rearOverhang;
  setLayer(body, LAYER.ownBody);
  car.add(body);
  car.userData.body = body;
  return car;
}

function createDriverCamera() {
  const camera = new THREE.PerspectiveCamera(65, 1, 0.05, 400);
  camera.rotation.order = 'YXZ';
  camera.layers.set(LAYER.world);
  camera.layers.enable(LAYER.cockpit);
  camera.layers.enable(LAYER.roof);
  return camera;
}

export class Run {
  constructor(config, { models, hud, ui }) {
    this.config = config;
    this.hud = hud;
    this.ui = ui;
    this.state = 'running';   // the exam is live at once; the car waits in P
    this.session = createSession(config);
    this.renderer = getRenderer();
    this.canvas = this.renderer.domElement;
    ({ scene: this.scene, sun: this.sun } = buildScene(this.session.world, models));
    this.car = buildOwnCar(this.session.spec, models);
    this.cockpit = buildCockpit(this.session.spec);
    this.car.add(this.cockpit.group);
    this.mirrors = createMirrors(this.session.spec);
    this.car.add(this.mirrors.group);
    this.mirrorOverlay = createMirrorOverlay(this.mirrors);
    this.screenMirrors = true;
    this.scene.add(this.car);
    this.paths = createTrajectoryLines();
    this.scene.add(this.paths.object);
    this.driverCam = createDriverCamera();
    this.top = createTopCamera();
    this.head = createHead();
    this.input = createInput(window);
    this.input.onKey((code) => this.onKey(code));

    this.onClick = () => {
      if (document.pointerLockElement === this.canvas) resetHead(this.head);
      else if (this.state !== 'finished') this.lock();
    };
    // Leaving the window must stop the car even when the mouse is not captured.
    this.onBlur = () => {
      if (this.state === 'running') this.pause();
    };
    this.onVisibility = () => {
      if (document.hidden && this.state === 'running') this.pause();
    };
    this.onMouseMove = (e) => {
      if (document.pointerLockElement === this.canvas) applyMouse(this.head, e.movementX, e.movementY);
    };
    this.onEscape = (e) => {
      if (e.code === 'Escape' && this.state === 'running' && document.pointerLockElement !== this.canvas) this.pause();
    };
    this.onLockChange = () => {
      if (document.pointerLockElement === this.canvas) this.resume();
      else if (this.state === 'running') this.pause();
    };
    this.canvas.addEventListener('click', this.onClick);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onLockChange);
    window.addEventListener('keydown', this.onEscape);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);

    hud.show(true);
    hud.message('Зажмите S и нажмите 4 (D), чтобы поехать', 6000);
    ui.onReady(this);
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  lock() {
    try {
      const p = this.canvas.requestPointerLock();
      p?.catch?.(() => this.resume());
    } catch {
      this.resume();
    }
  }

  resume() {
    if (this.state === 'finished') return;
    this.state = 'running';
    this.ui.onResume(this);
  }

  pause() {
    this.state = 'paused';
    this.input.releaseAll();
    this.ui.onPause(this);
  }

  onKey(code) {
    if (this.state !== 'running') return;
    const s = this.session;
    if (GEARS[code]) {
      const r = s.shift(GEARS[code], this.input.state.brake);
      if (!r.ok && SHIFT_MESSAGES[r.reason]) this.hud.message(SHIFT_MESSAGES[r.reason]);
      if (s.finished) this.finish();
    } else if (code === 'KeyT') {
      s.setHint('top', !s.hints.top);
    } else if (code === 'KeyH') {
      s.setHint('trajectories', !s.hints.trajectories);
    } else if (code === 'KeyM') {
      this.screenMirrors = !this.screenMirrors;
    }
  }

  finish() {
    this.state = 'finished';
    // Show the final placement from above; the result is already scored.
    this.session.hints.top = true;
    this.input.releaseAll();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.ui.onFinish(this);
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.state === 'running') {
      const { newFaults } = this.session.update(this.input.state, dt);
      if (newFaults.length) {
        this.hud.flash();
        this.hud.beep();
      }
    }
    updateHead(this.head, dt);
    this.syncCar();
    this.syncPaths();
    this.hud.update(this.session, { screenMirrors: this.screenMirrors, mouseLook: document.pointerLockElement === this.canvas });
    this.renderer.shadowMap.needsUpdate = true;
    const top = this.session.hints.top;
    if (!top) this.mirrors.render(this.renderer, this.scene);
    this.renderer.render(this.scene, this.currentCamera());
    if (!top && this.screenMirrors) this.mirrorOverlay.render(this.renderer, window.innerWidth, window.innerHeight);
    this.raf = requestAnimationFrame(this.frame);
  }

  currentCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    if (this.session.hints.top) {
      this.top.update(this.session, aspect);
      return this.top.camera;
    }
    const { eye } = this.session.spec;
    const off = headOffset(this.head);
    const cam = this.driverCam;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    cam.position.copy(this.car.localToWorld(new THREE.Vector3(eye.x + off.x, eye.z + off.z, -(eye.y + off.y))));
    cam.rotation.set(this.head.pitch, this.session.vehicle.heading - Math.PI / 2 + this.head.yaw, 0);
    return cam;
  }

  syncCar() {
    const v = this.session.vehicle;
    this.car.position.set(v.x, 0, -v.y);
    this.car.rotation.y = v.heading;
    this.car.updateMatrixWorld(true);
    this.cockpit.setSteer(v.steer);
    steerWheels(this.car.userData.body, v.steer);
    this.sun.target.position.copy(this.car.position);
    this.sun.position.copy(this.car.position).add(SUN_OFFSET);
    this.sun.target.updateMatrixWorld();
  }

  syncPaths() {
    const on = this.session.hints.trajectories;
    this.paths.object.visible = on;
    if (on) this.paths.update(predictWheelPaths(this.session.vehicle, this.session.spec));
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.input.dispose();
    this.canvas.removeEventListener('click', this.onClick);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    window.removeEventListener('keydown', this.onEscape);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.mirrors.dispose();
    disposeObject(this.scene);
  }
}

export function startRun(config, deps) {
  return new Run(config, deps);
}
