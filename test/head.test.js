import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHead, applyMouse, resetHead, updateHead, headOffset } from '../src/view/head.js';
import { near } from './helpers.js';

const frames = (h, n, dt = 1 / 60) => { for (let i = 0; i < n; i++) updateHead(h, dt); };

test('mouse target clamps', () => {
  const h = createHead();
  applyMouse(h, -1e6, 0);
  near(h.targetYaw, 160 * Math.PI / 180, 1e-9);
  applyMouse(h, 0, 1e6);
  near(h.targetPitch, -40 * Math.PI / 180, 1e-9);
});

test('mouse right looks right (yaw decreases)', () => {
  const h = createHead();
  applyMouse(h, 100, 0);
  assert.ok(h.targetYaw < 0);
});

test('smooth, no jump', () => {
  const h = createHead();
  h.targetYaw = 1;
  updateHead(h, 1 / 60);
  assert.ok(h.yaw > 0 && h.yaw < 0.5);
});

test('settles', () => {
  const h = createHead();
  h.targetYaw = 1;
  frames(h, 120);
  near(h.yaw, 1, 0.01);
});

test('reset returns smoothly', () => {
  const h = createHead();
  h.targetYaw = 1;
  frames(h, 120);
  resetHead(h);
  updateHead(h, 1 / 60);
  assert.ok(h.yaw > 0.5);
  frames(h, 120);
  near(h.yaw, 0, 0.01);
});

test('stable with large dt', () => {
  const h = createHead();
  h.targetYaw = 1;
  frames(h, 10, 0.05);
  assert.ok(h.yaw <= 1.0001 && h.yaw > 0.9);
});

test('head leans to cabin centre only when looking back', () => {
  const h = createHead();
  assert.deepEqual(headOffset(h), { x: 0, y: 0, z: 0 });
  h.yaw = -Math.PI * 160 / 180;
  near(headOffset(h).y, -0.25, 1e-9);
});
