import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/input.js';

const ev = (type, code, extra = {}) => Object.assign(new Event(type), { code, key: '', repeat: false, ...extra });
const kd = (code, key = '', extra = {}) => ev('keydown', code, { key, ...extra });
const ku = (code) => ev('keyup', code);

test('uses event.code not event.key', () => {
  const t = new EventTarget(), i = createInput(t);
  t.dispatchEvent(kd('KeyW', 'ц'));
  assert.equal(i.state.throttle, true);
});

test('WASD map to throttle/brake/left/right', () => {
  const t = new EventTarget(), i = createInput(t);
  for (const c of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) t.dispatchEvent(kd(c));
  assert.deepEqual(i.state, { throttle: true, brake: true, left: true, right: true });
});

test('keyup releases', () => {
  const t = new EventTarget(), i = createInput(t);
  t.dispatchEvent(kd('KeyA'));
  t.dispatchEvent(ku('KeyA'));
  assert.equal(i.state.left, false);
});

test('releaseAll on blur', () => {
  const t = new EventTarget(), i = createInput(t);
  t.dispatchEvent(kd('KeyW'));
  t.dispatchEvent(kd('KeyA'));
  t.dispatchEvent(new Event('blur'));
  assert.deepEqual(i.state, { throttle: false, brake: false, left: false, right: false });
});

test('single-press keys fire once per press', () => {
  const t = new EventTarget(), i = createInput(t);
  const got = [];
  i.onKey((c) => got.push(c));
  t.dispatchEvent(kd('Digit2'));
  t.dispatchEvent(kd('Digit2', '', { repeat: true }));
  t.dispatchEvent(kd('KeyT'));
  t.dispatchEvent(kd('KeyQ'));
  assert.deepEqual(got, ['Digit2', 'KeyT']);
});

test('dispose stops listening', () => {
  const t = new EventTarget(), i = createInput(t);
  i.dispose();
  t.dispatchEvent(kd('KeyW'));
  assert.equal(i.state.throttle, false);
});
