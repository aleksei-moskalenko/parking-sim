// Size of a model along one axis, ignoring a few protruding vertices
// (side mirrors), so the visible body matches the collision box.

const QUANTILE = 0.97;

export function robustSpan(values) {
  const v = [...values].sort((a, b) => a - b);
  const at = (q) => v[Math.round(q * (v.length - 1))];
  const lo = at(1 - QUANTILE), hi = at(QUANTILE);
  return { size: hi - lo, center: (hi + lo) / 2 };
}
