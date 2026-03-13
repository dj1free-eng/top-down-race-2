import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeTrack01Oval } from '../src/game/tracks/track01_oval.js';
import { makeTrack02Technical } from '../src/game/tracks/track02_technical.js';
import { makeTrack03Drift } from '../src/game/tracks/track03_drift.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outBase = path.join(__dirname, '../src/game/tracks/library');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function toGameJson(track, slug, name, brand, category, difficulty, lengthLabel) {
  const centerline = (track.centerline || []).map((p) => {
    if (Array.isArray(p)) return { x: p[0], y: p[1], width: track.trackWidth };
    return {
      x: p.x,
      y: p.y,
      width: Number.isFinite(Number(p.width)) ? Number(p.width) : track.trackWidth
    };
  });

  const first = centerline[0] || { x: 400, y: 400, width: track.trackWidth };
  const second = centerline[1] || first;
  const startAngle = Math.atan2(second.y - first.y, second.x - first.x);

  return {
    name,
    brand,
    category,
    difficulty,
    lengthLabel,
    worldW: track.worldW,
    worldH: track.worldH,
    trackWidth: track.trackWidth,
    grassMargin: track.grassMargin ?? 120,
    sampleStepPx: track.sampleStepPx ?? 12,
    cellSize: track.cellSize ?? 400,
    shoulderPx: track.shoulderPx ?? 10,
    start: {
      x: first.x,
      y: first.y,
      r: startAngle
    },
    centerline
  };
}

const tracks = [
  {
    slug: 'track01',
    json: toGameJson(makeTrack01Oval(), 'track01', 'ÓVALO', 'TDR', 'Velocidad', 'Fácil', 'Corta')
  },
  {
    slug: 'track02',
    json: toGameJson(makeTrack02Technical(), 'track02', 'TÉCNICO', 'TDR', 'Grip', 'Media', 'Media')
  },
  {
    slug: 'track03',
    json: toGameJson(makeTrack03Drift(), 'track03', 'DRIFT', 'TDR', 'Drift', 'Alta', 'Media')
  }
];

for (const t of tracks) {
  const dir = path.join(outBase, t.slug);
  ensureDir(dir);
  fs.writeFileSync(
    path.join(dir, 'track.json'),
    JSON.stringify(t.json, null, 2),
    'utf8'
  );
}

console.log('OK: tracks legacy exportados a src/game/tracks/library/');
