import Phaser from "phaser";
import { AreaDef } from "../data/areas";
import { houseKey } from "../art/village";

export const WORLD_W = 2400;
export const WORLD_H = 3000;

/** Axis-aligned box that blocks walking (x1,y1 top-left, x2,y2 bottom-right). */
export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface WorldObj {
  tex: string;
  x: number;
  /** bottom of the sprite (used for depth sorting) */
  y: number;
  flip?: boolean;
}

export interface Field {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface World {
  heart: { x: number; y: number };
  plazaR: number;
  roads: [number, number][][];
  fields: Field[];
  pond: { x: number; y: number; rx: number; ry: number };
  objects: WorldObj[];
  colliders: Rect[];
  /** where monsters come in */
  gates: [number, number][];
  windmill: { x: number; y: number } | null;
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const overlaps = (a: Rect, b: Rect, pad = 0) => a.x1 - pad < b.x2 && a.x2 + pad > b.x1 && a.y1 - pad < b.y2 && a.y2 + pad > b.y1;

/** Lays out a village for an area: plaza with the fountain, four roads, houses, farms, a pond and a forest border. */
export function buildWorld(area: AreaDef): World {
  const t = area.theme;
  const rand = seeded(area.id.split("").reduce((s, c) => s * 31 + c.charCodeAt(0), 7) % 2147483647);
  const cx = WORLD_W / 2;
  const cy = WORLD_H / 2;
  const plazaR = 250;
  const wob = (v: number) => Math.sin(v / 260) * 45;

  const roads: [number, number][][] = [[], [], [], []];
  for (let d = 0; d <= cy; d += 100) {
    roads[0].push([cx + wob(d), cy - d]);
    roads[1].push([cx - wob(d), cy + d]);
  }
  for (let d = 0; d <= cx; d += 100) {
    roads[2].push([cx + d, cy + wob(d)]);
    roads[3].push([cx - d, cy - wob(d)]);
  }
  const gates: [number, number][] = [[cx + wob(cy - 80), 80], [cx - wob(cy - 80), WORLD_H - 80], [WORLD_W - 80, cy + wob(cx - 80)], [80, cy - wob(cx - 80)]];

  const blocked: Rect[] = [
    { x1: cx - plazaR - 60, y1: cy - plazaR - 60, x2: cx + plazaR + 60, y2: cy + plazaR + 60 },
    { x1: cx - 140, y1: 0, x2: cx + 140, y2: WORLD_H },
    { x1: 0, y1: cy - 140, x2: WORLD_W, y2: cy + 140 },
  ];
  const objects: WorldObj[] = [];
  const colliders: Rect[] = [];
  const free = (r: Rect, pad = 30) => !blocked.some((b) => overlaps(r, b, pad));

  objects.push({ tex: "fountain", x: cx, y: cy + 60 });
  colliders.push({ x1: cx - 115, y1: cy - 10, x2: cx + 115, y2: cy + 50 });

  // houses along the roads
  const dirs: [number, number][] = [[0, -1], [0, 1], [1, 0], [-1, 0]];
  dirs.forEach(([dx, dy]) => {
    for (const dist of [520, 860, 1180]) {
      for (const side of [-1, 1]) {
        if (rand() > 0.72) continue;
        const along = dx ? cy + wob(dist) * (dx > 0 ? 1 : -1) : cx + wob(dist) * (dy < 0 ? 1 : -1);
        const x = dx ? cx + dx * dist : along + side * 270;
        const y = dy ? cy + dy * dist + 90 : along + side * 250 + 90;
        const barn = t.barns && rand() < 0.35;
        const r: Rect = { x1: x - 105, y1: y - 120, x2: x + 105, y2: y - 10 };
        if (!free(r, 20) || r.y1 < 260 || r.y2 > WORLD_H - 200 || r.x1 < 200 || r.x2 > WORLD_W - 200) continue;
        blocked.push({ x1: r.x1, y1: y - 230, x2: r.x2, y2: y });
        colliders.push(r);
        objects.push({ tex: barn ? "barn" : houseKey(t.roofs[Math.floor(rand() * t.roofs.length)], t.snow), x, y, flip: rand() < 0.5 });
        if (rand() < 0.6) objects.push({ tex: t.props[Math.floor(rand() * t.props.length)], x: x + (rand() < 0.5 ? -125 : 125), y: y - 4 });
      }
    }
  });

  // farm fields in the corners between roads
  const fields: Field[] = [];
  for (const [sx, sy] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
    if (rand() < 0.15) continue;
    const w = 440;
    const h = 320;
    const f = { x: cx + sx * 660 - w / 2, y: cy + sy * 720 - h / 2, w, h };
    const r: Rect = { x1: f.x, y1: f.y - 40, x2: f.x + w, y2: f.y + h + 30 };
    if (!free(r, 10)) continue;
    blocked.push(r);
    fields.push(f);
    const cropTex = t.crops[Math.floor(rand() * t.crops.length)];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) objects.push({ tex: cropTex, x: f.x + 48 + col * 69, y: f.y + 72 + row * 68 });
    }
    for (let x = f.x; x < f.x + w - 10; x += 120) {
      objects.push({ tex: "fence_h", x: x + 60, y: f.y + 8 });
      objects.push({ tex: "fence_h", x: x + 60, y: f.y + h + 22 });
    }
    for (let y = f.y + 124; y <= f.y + h + 30; y += 124) {
      objects.push({ tex: "fence_v", x: f.x - 2, y });
      objects.push({ tex: "fence_v", x: f.x + w + 2, y });
    }
    if (t.props.includes("hay") && rand() < 0.8) objects.push({ tex: "hay", x: f.x + w + 70, y: f.y + h - 20 });
  }

  // windmill next to a field
  let windmill: World["windmill"] = null;
  if (t.windmill && fields.length) {
    const f = fields[0];
    const x = f.x + f.w + 150;
    const y = f.y + 200;
    const r: Rect = { x1: x - 60, y1: y - 60, x2: x + 60, y2: y };
    if (free(r) && x < WORLD_W - 150) {
      windmill = { x, y };
      objects.push({ tex: "windmill", x, y: y + 6 });
      colliders.push(r);
      blocked.push({ x1: x - 130, y1: y - 300, x2: x + 130, y2: y + 10 });
    }
  }

  // pond near the plaza
  const pond = { x: cx - 420, y: cy + 430, rx: 150, ry: 95 };
  const pr: Rect = { x1: pond.x - pond.rx, y1: pond.y - pond.ry, x2: pond.x + pond.rx, y2: pond.y + pond.ry };
  colliders.push({ x1: pr.x1 + 20, y1: pr.y1 + 15, x2: pr.x2 - 20, y2: pr.y2 - 15 });
  blocked.push(pr);

  // lamp posts along the roads
  roads.forEach((pts) => {
    pts.forEach(([x, y], i) => {
      if (i < 4 || i % 4 !== 0) return;
      const horiz = Math.abs(pts[1][0] - pts[0][0]) > 1;
      objects.push({ tex: "lamp", x: horiz ? x : x + 125, y: horiz ? y - 115 : y });
    });
  });

  // forest border and scattered trees
  const tree = (x: number, y: number) => {
    objects.push({ tex: t.trees[Math.floor(rand() * t.trees.length)], x, y, flip: rand() < 0.5 });
    colliders.push({ x1: x - 20, y1: y - 24, x2: x + 20, y2: y });
  };
  const nearGate = (x: number, y: number) => gates.some(([gx, gy]) => Math.abs(gx - x) < 210 && Math.abs(gy - y) < 260);
  for (let x = 40; x < WORLD_W; x += 105 + rand() * 40) {
    for (const y of [110 + rand() * 40, WORLD_H - 30 - rand() * 30, 250 + rand() * 50]) {
      if (!nearGate(x, y) && (y < 200 || y > WORLD_H - 120 || rand() < 0.55)) tree(x, y);
    }
  }
  for (let y = 260; y < WORLD_H - 120; y += 120 + rand() * 50) {
    for (const x of [40 + rand() * 30, WORLD_W - 40 - rand() * 30, 170 + rand() * 40, WORLD_W - 170 - rand() * 40]) {
      if (!nearGate(x, y) && (x < 100 || x > WORLD_W - 100 || rand() < 0.5)) tree(x, y);
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = 300 + rand() * (WORLD_W - 600);
    const y = 380 + rand() * (WORLD_H - 700);
    const r: Rect = { x1: x - 70, y1: y - 180, x2: x + 70, y2: y };
    if (free(r, 30)) {
      blocked.push(r);
      tree(x, y);
    }
  }
  return { heart: { x: cx, y: cy + 20 }, plazaR, roads, fields, pond, objects, colliders, gates, windmill };
}

/** Push a circle of radius r at (x, y) out of any blocking box. */
export function pushOut(x: number, y: number, r: number, colliders: Rect[]): [number, number] {
  for (const c of colliders) {
    if (x + r <= c.x1 || x - r >= c.x2 || y + r * 0.5 <= c.y1 || y - r * 0.5 >= c.y2) continue;
    const left = x + r - c.x1;
    const right = c.x2 - (x - r);
    const up = y + r * 0.5 - c.y1;
    const down = c.y2 - (y - r * 0.5);
    const m = Math.min(left, right, up, down);
    if (m === left) x -= left;
    else if (m === right) x += right;
    else if (m === up) y -= up;
    else y += down;
  }
  return [Phaser.Math.Clamp(x, 40, WORLD_W - 40), Phaser.Math.Clamp(y, 60, WORLD_H - 20)];
}

