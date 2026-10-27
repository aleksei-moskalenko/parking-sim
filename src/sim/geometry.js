// Oriented-box (Rect) maths. Rect = { cx, cy, length, width, heading };
// `length` runs along `heading`, `width` across it.

const EPS = 1e-9;

export function normalizeAngle(a) {
  let r = a % (2 * Math.PI);
  if (r <= -Math.PI) r += 2 * Math.PI;
  if (r > Math.PI) r -= 2 * Math.PI;
  return r;
}

// Angle between two undirected axes, in [0, π/2].
export function axisAngleDiff(a, b) {
  const d = Math.abs(normalizeAngle(a - b)) % Math.PI;
  return Math.min(d, Math.PI - d);
}

function axes(rect) {
  const c = Math.cos(rect.heading), s = Math.sin(rect.heading);
  return [[c, s], [-s, c]];
}

// Corners in order: rear-right, front-right, front-left, rear-left.
export function rectCorners(rect) {
  const [f, l] = axes(rect);
  const hl = rect.length / 2, hw = rect.width / 2;
  return [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([a, b]) => [
    rect.cx + f[0] * a + l[0] * b,
    rect.cy + f[1] * a + l[1] * b,
  ]);
}

// Point in the rect's own frame: [along heading, across (left +)].
export function localPoint(rect, [x, y]) {
  const [f, l] = axes(rect);
  const dx = x - rect.cx, dy = y - rect.cy;
  return [dx * f[0] + dy * f[1], dx * l[0] + dy * l[1]];
}

function project(corners, [ax, ay]) {
  let min = Infinity, max = -Infinity;
  for (const [x, y] of corners) {
    const p = x * ax + y * ay;
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return [min, max];
}

// Separating axis test; boxes that merely touch do not intersect.
export function rectsIntersect(a, b) {
  const ca = rectCorners(a), cb = rectCorners(b);
  for (const axis of [...axes(a), ...axes(b)]) {
    const [amin, amax] = project(ca, axis);
    const [bmin, bmax] = project(cb, axis);
    if (amax <= bmin + EPS || bmax <= amin + EPS) return false;
  }
  return true;
}

export function rectInsideRect(inner, outer, tol = 0) {
  const hl = outer.length / 2 + tol, hw = outer.width / 2 + tol;
  return rectCorners(inner).every((p) => {
    const [a, b] = localPoint(outer, p);
    return Math.abs(a) <= hl + EPS && Math.abs(b) <= hw + EPS;
  });
}

export function inflateRect(rect, d) {
  return { ...rect, length: rect.length + 2 * d, width: rect.width + 2 * d };
}
