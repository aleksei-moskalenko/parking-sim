// Procedural canvas textures. Surfaces with grain and pattern give the eye
// distance and motion cues that flat colours cannot.

import * as THREE from 'three';
import { createRng } from '../sim/rng.js';

const cache = new Map();

function canvasTexture(key, width, height, draw) {
  if (!cache.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height, createRng(key.length * 7919));
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    cache.set(key, t);
  }
  return cache.get(key);
}

function speckle(g, w, h, rng, count, colors, size = 2) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[Math.floor(rng() * colors.length)];
    g.fillRect(rng() * w, rng() * h, size * (0.5 + rng()), size * (0.5 + rng()));
  }
}

// Each entry: texture and the real-world size (metres) one tile covers.
const KINDS = {
  asphalt: { tile: [4, 4], make: () => canvasTexture('asphalt', 512, 512, (g, w, h, rng) => {
    g.fillStyle = '#4b4e53';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, rng, 9000, ['#3d4045', '#5a5d62', '#44474c', '#62656a'], 2.2);
    g.strokeStyle = 'rgba(30,30,32,0.5)';
    g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      let x = rng() * w, y = rng() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) g.lineTo((x += (rng() - 0.5) * 80), (y += (rng() - 0.5) * 80));
      g.stroke();
    }
  }) },
  concrete: { tile: [3, 3], make: () => canvasTexture('concrete', 512, 512, (g, w, h, rng) => {
    g.fillStyle = '#9d9a93';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, rng, 6000, ['#8e8b84', '#aaa7a0', '#959289'], 2);
    g.strokeStyle = 'rgba(60,60,60,0.45)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, w, h);
  }) },
  sidewalk: { tile: [2, 2], make: () => canvasTexture('sidewalk', 512, 512, (g, w, h, rng) => {
    g.fillStyle = '#b3afa6';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, rng, 3000, ['#a5a198', '#c0bcb3'], 2);
    g.strokeStyle = '#8b877f';
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke();
    }
  }) },
  brick: { tile: [1, 1], make: () => canvasTexture('brick', 512, 512, (g, w, h, rng) => {
    g.fillStyle = '#cfc5b5';
    g.fillRect(0, 0, w, h);
    const rows = 15, bw = w / 4, bh = h / rows;      // 25 × 6.7 cm bricks
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? bw / 2 : 0;
      for (let c = -1; c < 5; c++) {
        const shade = 150 + Math.floor(rng() * 40);
        g.fillStyle = `rgb(${shade}, ${Math.floor(shade * 0.55)}, ${Math.floor(shade * 0.42)})`;
        g.fillRect(c * bw + off + 3, r * bh + 3, bw - 6, bh - 6);
      }
    }
  }) },
  // Painted garage wall, one texture = full 2.4 m height: hazard band at bumper height.
  garage: { tile: [2, 2.4], make: () => canvasTexture('garage', 512, 512, (g, w, h, rng) => {
    g.fillStyle = '#d9d6cf';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, rng, 2500, ['#cfccc5', '#e2dfd8'], 2);
    const y0 = h * (1 - 0.70 / 2.4), y1 = h * (1 - 0.45 / 2.4);
    g.save();
    g.beginPath(); g.rect(0, y0, w, y1 - y0); g.clip();
    g.fillStyle = '#f2c200';
    g.fillRect(0, y0, w, y1 - y0);
    g.fillStyle = '#1c1c1c';
    for (let x = -h; x < w + h; x += 64) {
      g.beginPath();
      g.moveTo(x, y1); g.lineTo(x + 32, y1); g.lineTo(x + 32 + (y1 - y0), y0); g.lineTo(x + (y1 - y0), y0);
      g.fill();
    }
    g.restore();
    g.fillStyle = 'rgba(70,70,70,0.35)';
    g.fillRect(0, h * (1 - 0.12 / 2.4), w, h);
  }) },
  door: { tile: [3, 2.4], make: () => canvasTexture('door', 256, 256, (g, w, h) => {
    g.fillStyle = '#7d8790';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      g.fillStyle = '#69737c';
      g.fillRect(0, y, w, 4);
      g.fillStyle = '#939da6';
      g.fillRect(0, y + 4, w, 2);
    }
  }) },
  fence: { tile: [2, 1.6], make: () => canvasTexture('fence', 256, 256, (g, w, h) => {
    g.fillStyle = '#5d636a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#80878f';
    for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 10, h);
    g.fillRect(0, 20, w, 10);
    g.fillRect(0, h - 30, w, 10);
  }) },
  facade: { tile: [3, 3], make: () => canvasTexture('facade', 256, 256, (g, w, h, rng) => {
    g.fillStyle = '#efe9df';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, rng, 1500, ['#e4ded3', '#f6f1e8'], 2);
    g.fillStyle = '#4c5966';
    g.fillRect(w * 0.28, h * 0.22, w * 0.44, h * 0.5);
    g.fillStyle = '#d0c8bb';
    g.fillRect(w * 0.24, h * 0.72, w * 0.52, h * 0.05);
  }) },
};

// Material whose texture repeats once per real-world tile on a surface of size u × v metres.
export function texturedMaterial(kind, u, v, color = 0xffffff) {
  const k = KINDS[kind];
  const map = k.make().clone();
  map.repeat.set(u / k.tile[0], v / k.tile[1]);
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map, color, roughness: 0.95 });
}
