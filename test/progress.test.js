import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadProgress, markPassed, isPassed } from '../src/progress.js';

const memoryStorage = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
};

afterEach(() => { delete globalThis.localStorage; });

test('no storage → empty, never throws', () => {
  assert.deepEqual(loadProgress(), {});
  assert.doesNotThrow(() => markPassed('parallel', 'sedan', 1));
  assert.equal(isPassed('parallel', 'sedan', 1), false);
});

test('remembers passed levels', () => {
  globalThis.localStorage = memoryStorage();
  markPassed('garage', 'minivan', 6);
  assert.equal(isPassed('garage', 'minivan', 6), true);
  assert.equal(isPassed('garage', 'sedan', 6), false);
  assert.deepEqual(loadProgress(), { 'garage:minivan:6': true });
});

test('broken storage → empty', () => {
  globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadProgress(), {});
  assert.doesNotThrow(() => markPassed('parallel', 'sedan', 2));
});

test('corrupt JSON → empty', () => {
  globalThis.localStorage = memoryStorage();
  globalThis.localStorage.setItem('parking-sim-progress-v1', '{oops');
  assert.deepEqual(loadProgress(), {});
});
