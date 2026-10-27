import { test } from 'node:test';
import assert from 'node:assert/strict';
import { robustSpan } from '../src/view/fit.js';
import { near } from './helpers.js';

const range = (n, a, b) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

// Measured on the Kenney sedan: flat sides hold many vertices at ±0.65, mirrors reach ±0.75.
test('mirror outliers do not widen the body', () => {
  const body = [...Array(200).fill(-0.65), ...range(570, -0.65, 0.65), ...Array(200).fill(0.65)];
  const mirrors = [...Array(15).fill(0.75), ...Array(15).fill(-0.75)];
  const s = robustSpan([...body, ...mirrors]);
  near(s.size, 1.3, 0.02);
  near(s.center, 0, 0.01);
});

test('flat-sided body keeps its full extent', () => {
  const s = robustSpan([...Array(300).fill(0.2), ...range(400, 0.2, 2.2), ...Array(300).fill(2.2)]);
  near(s.size, 2.0, 0.02);
  near(s.center, 1.2, 0.01);
});
