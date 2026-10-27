// Fixed difficulty levels and the worlds built from them.
// Margins are relative to the chosen car, so the minivan is honestly harder.

import { CAR_SPECS, PARKED_TYPES } from './cars.js';
import { createRng } from './rng.js';

export const LEVEL_NAMES = ['Лёгкий', 'Базовый', 'Средний', 'Сложный', 'Эксперт', 'Мастер'];

export const PARALLEL_LEVELS = [
  { margin: 3.0, side: 'right', oppositeRow: false, freeWidth: 6.0 },
  { margin: 2.0, side: 'right', oppositeRow: false, freeWidth: 5.5 },
  { margin: 1.5, side: 'right', oppositeRow: true, freeWidth: 4.5 },
  { margin: 1.1, side: 'left', oppositeRow: true, freeWidth: 4.0 },
  { margin: 0.9, side: 'right', oppositeRow: true, freeWidth: 3.6 },
  { margin: 0.7, side: 'left', oppositeRow: true, freeWidth: 3.3 },
];

export const GARAGE_LEVELS = [
  { widthMargin: 1.2, depthMargin: 1.0, driveWidth: 9.0, opposite: 'empty' },
  { widthMargin: 0.9, depthMargin: 0.9, driveWidth: 7.5, opposite: 'empty' },
  { widthMargin: 0.7, depthMargin: 0.8, driveWidth: 6.5, opposite: 'cars' },
  { widthMargin: 0.5, depthMargin: 0.7, driveWidth: 5.5, opposite: 'cars' },
  { widthMargin: 0.35, depthMargin: 0.6, driveWidth: 5.0, opposite: 'cars' },
  { widthMargin: 0.25, depthMargin: 0.5, driveWidth: 4.5, opposite: 'cars' },
];

// Outer edge of the own parked row, metres from the curb line.
export const ROW_EDGE = 2.2;

const CONE = { size: 0.3, height: 0.5, spacing: 2.0 };
const WALL = { thickness: 0.2, height: 2.4 };
const SIDEWALK_DEPTH = 4;
const GAP_MIN = 0.8, GAP_MAX = 2.0;

// Axis-aligned Rect from x/y extents.
const box = (x0, x1, y0, y1) => ({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, length: x1 - x0, width: y1 - y0, heading: 0 });

function makeBuilder(seed) {
  const rng = createRng(seed);
  const obstacles = [];
  let nextId = 0;
  return {
    rng,
    obstacles,
    between: (a, b) => a + (b - a) * rng(),
    pickType: () => PARKED_TYPES[Math.floor(rng() * PARKED_TYPES.length)],
    add(kind, rect, height, model) {
      obstacles.push({ id: `${kind}-${nextId++}`, kind, rect, height, ...(model ? { model } : {}) });
    },
  };
}

// Cars along a line from x0 to x1; `place(type, xStart)` adds one and returns its length.
function fillRow(b, x0, x1, place) {
  let x = x0 + b.between(0, GAP_MAX);
  while (x < x1) {
    x += place(b.pickType(), x) + b.between(GAP_MIN, GAP_MAX);
  }
}

function buildings(b, x0, x1, y0, y1) {
  const out = [];
  let x = x0;
  while (x < x1) {
    const len = b.between(8, 15);
    out.push({ ...box(x, Math.min(x1, x + len), y0, y1), height: b.between(6, 15) });
    x += len + b.between(0.5, 2);
  }
  return out;
}

function buildParallel(cfg, spec, b) {
  const T = spec.length + cfg.margin;
  const minX = -30, maxX = T + 30;
  const target = box(0, T, 0, spec.width + 0.5);

  const addParked = (type, x0, heading, cy) => {
    b.add('car', { cx: x0 + type.length / 2, cy, length: type.length, width: type.width, heading }, type.height, type.model);
    return type.length;
  };
  const ownCy = (type) => b.between(0.15, 0.25) + type.width / 2;

  // Neighbours exactly at the ends of the spot, then the rest of the row.
  const rear = b.pickType();
  addParked(rear, -rear.length, 0, ownCy(rear));
  let x = -rear.length;
  while (x > minX) {
    const t = b.pickType();
    x -= b.between(GAP_MIN, GAP_MAX) + t.length;
    addParked(t, x, 0, ownCy(t));
  }
  const front = b.pickType();
  addParked(front, T, 0, ownCy(front));
  fillRow(b, T + front.length, maxX, (t, x0) => addParked(t, x0, 0, ownCy(t)));

  const line = ROW_EDGE + cfg.freeWidth;
  let farCurb;
  if (cfg.oppositeRow) {
    fillRow(b, minX, maxX, (t, x0) => addParked(t, x0, Math.PI, line + t.width / 2));
    farCurb = line + 2.2;
  } else {
    for (let cx = minX; cx <= maxX; cx += CONE.spacing) {
      b.add('cone', { cx, cy: line + CONE.size / 2, length: CONE.size, width: CONE.size, heading: 0 }, CONE.height, 'cone');
    }
    farCurb = line + 1.0;
  }

  const sidewalkFar = farCurb + SIDEWALK_DEPTH;
  return {
    bounds: { minX, maxX, minY: -SIDEWALK_DEPTH, maxY: farCurb },
    obstacles: b.obstacles,
    curbs: [
      { id: 'curb-near', rect: box(minX, maxX, -SIDEWALK_DEPTH, 0) },
      { id: 'curb-far', rect: box(minX, maxX, farCurb, sidewalkFar) },
    ],
    target,
    targetAxis: 0,
    curbLine: { y: 0, sidewalkSign: -1 },
    start: { x: -10, y: ROW_EDGE + Math.min(1.0 + spec.width / 2, cfg.freeWidth / 2), heading: 0 },
    decor: {
      buildings: [
        ...buildings(b, minX, maxX, -SIDEWALK_DEPTH - 10, -SIDEWALK_DEPTH),
        ...buildings(b, minX, maxX, sidewalkFar, sidewalkFar + 10),
      ],
      roofs: [],
    },
  };
}

const mirrorRect = (r) => ({ ...r, cy: -r.cy, heading: -r.heading });

function mirrorWorld(w) {
  return {
    ...w,
    bounds: { ...w.bounds, minY: -w.bounds.maxY, maxY: -w.bounds.minY },
    obstacles: w.obstacles.map((o) => ({ ...o, rect: mirrorRect(o.rect) })),
    curbs: w.curbs.map((c) => ({ ...c, rect: mirrorRect(c.rect) })),
    target: mirrorRect(w.target),
    curbLine: { y: 0, sidewalkSign: 1 },
    start: { x: w.start.x, y: -w.start.y, heading: -w.start.heading },
    decor: { buildings: w.decor.buildings.map(mirrorRect), roofs: w.decor.roofs.map(mirrorRect) },
  };
}

function buildGarage(cfg, spec, b) {
  const wi = spec.width + cfg.widthMargin;
  const depth = spec.length + cfg.depthMargin;
  const t = WALL.thickness;
  const pitch = wi + t;
  const minX = -25, maxX = 25;
  const rowX0 = -2.5 * pitch - t / 2, rowX1 = 2.5 * pitch + t / 2;
  const wall = (rect) => b.add('wall', rect, WALL.height);

  for (let j = 0; j <= 5; j++) {
    const x = rowX0 + j * pitch;
    wall(box(x, x + t, -depth - t, 0));
  }
  wall(box(rowX0, rowX1, -depth - t, -depth));
  for (let k = -2; k <= 2; k++) {
    if (k !== 0) wall(box(k * pitch - wi / 2, k * pitch + wi / 2, -t, 0));
  }
  // Building facade continuing the garage line on both sides.
  wall(box(minX, rowX0, -t, 0));
  wall(box(rowX1, maxX, -t, 0));

  const dw = cfg.driveWidth;
  let fenceY;
  if (cfg.opposite === 'empty') {
    for (let cx = minX; cx <= maxX; cx += CONE.spacing) {
      b.add('cone', { cx, cy: dw + CONE.size / 2, length: CONE.size, width: CONE.size, heading: 0 }, CONE.height, 'cone');
    }
    fenceY = dw + 1.5;
  } else {
    fillRow(b, minX, maxX, (type, x0) => {
      b.add('car', { cx: x0 + type.length / 2, cy: dw + type.width / 2, length: type.length, width: type.width, heading: 0 }, type.height, type.model);
      return type.length;
    });
    fenceY = dw + 2.2;
  }
  b.add('wall', box(minX, maxX, fenceY, fenceY + t), 1.6);

  return {
    bounds: { minX, maxX, minY: -depth - t, maxY: fenceY },
    obstacles: b.obstacles,
    curbs: [],
    target: { cx: 0, cy: -depth / 2, length: depth, width: wi, heading: Math.PI / 2 },
    targetAxis: Math.PI / 2,
    curbLine: null,
    start: { x: -8, y: dw / 2, heading: 0 },
    decor: {
      buildings: buildings(b, minX, maxX, fenceY + 3, fenceY + 13),
      roofs: [{ ...box(rowX0, rowX1, -depth - t, 0.3), height: WALL.height }],
    },
  };
}

export function buildLevel(exercise, level, carId) {
  const spec = CAR_SPECS[carId];
  const seed = level * 100 + (exercise === 'garage' ? 50 : 0) + (carId === 'minivan' ? 1 : 0);
  const b = makeBuilder(seed);
  let world;
  if (exercise === 'parallel') {
    const cfg = PARALLEL_LEVELS[level - 1];
    world = buildParallel(cfg, spec, b);
    if (cfg.side === 'left') world = mirrorWorld(world);
  } else {
    world = buildGarage(GARAGE_LEVELS[level - 1], spec, b);
  }
  return { exercise, level, carId, ...world };
}
