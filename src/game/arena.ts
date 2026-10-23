import { REGIONS, Region, RegionId } from "../data/regions";

/** Every land is an open square arena of nature with the crystal in the middle. */
export const ARENA = 2600;
const CELL = 50;
const GRID = ARENA / CELL;

export type Pt = [number, number];

/** Something that blocks walking: a circle (r) or a box (w x h around x, y). */
export interface Collider {
  x: number;
  y: number;
  r?: number;
  w?: number;
  h?: number;
}

export interface ArenaObj {
  tex: string;
  x: number;
  /** bottom of the sprite (depth sorting) */
  y: number;
  flip?: boolean;
  scale?: number;
}

export interface Pond {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** Painted ground decoration: flower meadows, wheat, moss, dunes, ice. */
export interface Patch {
  x: number;
  y: number;
  r: number;
}

export interface Arena {
  land: Region;
  center: Pt;
  objects: ArenaObj[];
  colliders: Collider[];
  ponds: Pond[];
  patches: Patch[];
  /** where monsters step in, all around the edge */
  spawns: Pt[];
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const cache = new Map<RegionId, Arena>();

/** The arena of a land (the same every time, so it is built once). */
export function getArena(id: RegionId): Arena {
  if (!cache.has(id)) cache.set(id, buildArena(REGIONS.find((r) => r.id === id)!));
  return cache.get(id)!;
}

function buildArena(land: Region): Arena {
  const rand = seeded(1234 + REGIONS.indexOf(land) * 7777);
  const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
  const c = ARENA / 2;
  const center: Pt = [c, c];
  const objects: ArenaObj[] = [];
  const colliders: Collider[] = [];
  const taken: { x: number; y: number; r: number }[] = [{ x: c, y: c, r: 430 }];
  // the crystal itself
  colliders.push({ x: c, y: c + 20, r: 95 });
  const free = (x: number, y: number, r: number) => !taken.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + r);
  const solid = (tex: string, x: number, y: number) => {
    const rockish = tex.startsWith("rock");
    colliders.push({ x, y: y - 12, r: rockish ? 34 : tex === "mushroom_big" ? 30 : 24 });
  };

  // ponds in the green lands
  const ponds: Pond[] = [];
  if (land.ponds) {
    for (let n = 0, tries = 0; n < 2 && tries < 100; tries++) {
      const a = rand() * Math.PI * 2;
      const d = 560 + rand() * 300;
      const p = { x: c + Math.cos(a) * d, y: c + Math.sin(a) * d, rx: 150 + rand() * 60, ry: 90 + rand() * 30 };
      if (!free(p.x, p.y, p.rx + 60)) continue;
      ponds.push(p);
      taken.push({ x: p.x, y: p.y, r: p.rx + 40 });
      for (let x = p.x - p.rx; x <= p.x + p.rx; x += 45) {
        for (let y = p.y - p.ry; y <= p.y + p.ry; y += 45) {
          if (((x - p.x) / (p.rx - 18)) ** 2 + ((y - p.y) / (p.ry - 18)) ** 2 < 1) colliders.push({ x, y, r: 32 });
        }
      }
    }
  }

  // a thick natural wall of trees and rocks around the edge
  for (const row of [70, 170, 270]) {
    for (let k = 0; k < (ARENA / 95) * 4; k++) {
      const along = (k * 95 + rand() * 40) % (ARENA * 4);
      const side = Math.floor(along / ARENA);
      const s = along % ARENA;
      const inset = row + (rand() - 0.5) * 50;
      const [x, y] = [[s, inset], [ARENA - inset, s], [ARENA - s, ARENA - inset], [inset, ARENA - s]][side];
      if (x < 40 || y < 120 || x > ARENA - 40 || y > ARENA - 10) continue;
      const tex = row === 270 && rand() < 0.3 ? pick(land.plants) : pick(land.trees);
      objects.push({ tex, x, y, flip: rand() < 0.5, scale: 0.95 + rand() * 0.25 });
      if (land.trees.includes(tex)) solid(tex, x, y);
    }
  }

  // groves and rock piles inside
  for (let n = 0, tries = 0; n < 14 && tries < 300; tries++) {
    const a = rand() * Math.PI * 2;
    const d = 520 + rand() * 520;
    const gx = c + Math.cos(a) * d;
    const gy = c + Math.sin(a) * d;
    if (!free(gx, gy, 140)) continue;
    taken.push({ x: gx, y: gy, r: 170 });
    const count = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const x = gx + (rand() - 0.5) * 220;
      const y = gy + (rand() - 0.5) * 160;
      const tex = pick(land.trees);
      objects.push({ tex, x, y, flip: rand() < 0.5, scale: 0.85 + rand() * 0.3 });
      solid(tex, x, y);
    }
    n++;
  }

  // plants and little things you walk past
  for (let n = 0, tries = 0; n < 90 && tries < 900; tries++) {
    const x = 330 + rand() * (ARENA - 660);
    const y = 360 + rand() * (ARENA - 660);
    if (Math.hypot(x - c, y - c) < 300 || !free(x, y, 30)) continue;
    objects.push({ tex: pick(land.plants), x, y, flip: rand() < 0.5 });
    n++;
  }

  // painted ground patches
  const patches: Patch[] = [];
  for (let n = 0; n < 46; n++) {
    patches.push({ x: 300 + rand() * (ARENA - 600), y: 300 + rand() * (ARENA - 600), r: 60 + rand() * 110 });
  }

  // monsters walk in from a ring near the edge, all the way around
  const spawns: Pt[] = [];
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    for (let d = 960; d > 700; d -= 40) {
      const x = c + Math.cos(a) * d;
      const y = c + Math.sin(a) * d;
      if (colliders.some((col) => Math.hypot(col.x - x, col.y - y) < (col.r ?? 0) + 40)) continue;
      spawns.push([x, y]);
      break;
    }
  }
  return { land, center, objects, colliders, ponds, patches, spawns };
}

// ───────────────────────── walking: collisions ─────────────────────────

const hashes = new Map<Collider[], Map<number, Collider[]>>();
const HCELL = 200;

function hashFor(colliders: Collider[]): Map<number, Collider[]> {
  let m = hashes.get(colliders);
  if (m) return m;
  m = new Map();
  for (const c of colliders) {
    const ext = c.r ?? Math.max(c.w ?? 0, c.h ?? 0) / 2;
    for (let gx = Math.floor((c.x - ext) / HCELL); gx <= Math.floor((c.x + ext) / HCELL); gx++) {
      for (let gy = Math.floor((c.y - ext) / HCELL); gy <= Math.floor((c.y + ext) / HCELL); gy++) {
        const k = gx * 1000 + gy;
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(c);
      }
    }
  }
  hashes.set(colliders, m);
  return m;
}

/** Push a walker (circle of radius r) out of anything solid, and keep it inside the arena. */
export function pushOut(x: number, y: number, r: number, colliders: Collider[]): Pt {
  const near = hashFor(colliders).get(Math.floor(x / HCELL) * 1000 + Math.floor(y / HCELL)) ?? [];
  for (const c of near) {
    if (c.r !== undefined) {
      const dx = x - c.x;
      const dy = y - c.y;
      const d = Math.hypot(dx, dy);
      const min = c.r + r;
      if (d < min && d > 0.01) {
        x = c.x + (dx / d) * min;
        y = c.y + (dy / d) * min;
      }
      continue;
    }
    const hw = (c.w ?? 0) / 2 + r;
    const hh = (c.h ?? 0) / 2 + r * 0.6;
    const dx = x - c.x;
    const dy = y - c.y;
    if (Math.abs(dx) >= hw || Math.abs(dy) >= hh) continue;
    const px = hw - Math.abs(dx);
    const py = hh - Math.abs(dy);
    if (px < py) x += dx < 0 ? -px : px;
    else y += dy < 0 ? -py : py;
  }
  return [Math.max(120, Math.min(ARENA - 120, x)), Math.max(200, Math.min(ARENA - 60, y))];
}

// ───────────────────────── walking: monster paths ─────────────────────────

export interface Flow {
  dist: Float32Array;
  dx: Float32Array;
  dy: Float32Array;
}

const flows = new Map<Arena, Flow>();
const cellOf = (x: number, y: number) => {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  return cx < 0 || cy < 0 || cx >= GRID || cy >= GRID ? -1 : cy * GRID + cx;
};

/** Distance-to-crystal map so monsters walk around trees and ponds. */
export function flowField(arena: Arena): Flow {
  const cached = flows.get(arena);
  if (cached) return cached;
  const blocked = new Uint8Array(GRID * GRID);
  for (const c of arena.colliders) {
    const ext = (c.r ?? Math.max(c.w ?? 0, c.h ?? 0) / 2) + 10;
    for (let gx = Math.floor((c.x - ext) / CELL); gx <= Math.floor((c.x + ext) / CELL); gx++) {
      for (let gy = Math.floor((c.y - ext) / CELL); gy <= Math.floor((c.y + ext) / CELL); gy++) {
        if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) continue;
        const px = (gx + 0.5) * CELL;
        const py = (gy + 0.5) * CELL;
        if (Math.hypot(px - c.x, py - c.y) < (c.r ?? 0) + 8) blocked[gy * GRID + gx] = 1;
      }
    }
  }
  const dist = new Float32Array(GRID * GRID).fill(Infinity);
  const start = cellOf(arena.center[0], arena.center[1] + 170);
  const queue = [start];
  dist[start] = 0;
  const steps: [number, number, number][] = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [1, -1, 1.41], [-1, 1, 1.41], [-1, -1, 1.41]];
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    const cx = c % GRID;
    const cy = Math.floor(c / GRID);
    for (const [sx, sy, cost] of steps) {
      const nx = cx + sx;
      const ny = cy + sy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const n = ny * GRID + nx;
      if (blocked[n] || (sx && sy && (blocked[cy * GRID + nx] || blocked[ny * GRID + cx]))) continue;
      const d = dist[c] + cost;
      if (d < dist[n] - 0.01) {
        dist[n] = d;
        queue.push(n);
      }
    }
  }
  const dx = new Float32Array(GRID * GRID);
  const dy = new Float32Array(GRID * GRID);
  for (let c = 0; c < GRID * GRID; c++) {
    if (!isFinite(dist[c])) continue;
    const cx = c % GRID;
    const cy = Math.floor(c / GRID);
    let best = dist[c];
    let bx = 0;
    let by = 0;
    for (const [sx, sy] of steps) {
      const nx = cx + sx;
      const ny = cy + sy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const n = ny * GRID + nx;
      if (dist[n] < best) {
        best = dist[n];
        bx = sx;
        by = sy;
      }
    }
    const len = Math.hypot(bx, by) || 1;
    dx[c] = bx / len;
    dy[c] = by / len;
  }
  const flow = { dist, dx, dy };
  flows.set(arena, flow);
  return flow;
}

/** Which way a monster at (x, y) should walk (null = no path known: walk straight). */
export function flowDir(flow: Flow, x: number, y: number): Pt | null {
  const c = cellOf(x, y);
  if (c < 0 || !isFinite(flow.dist[c]) || (flow.dx[c] === 0 && flow.dy[c] === 0)) return null;
  return [flow.dx[c], flow.dy[c]];
}
