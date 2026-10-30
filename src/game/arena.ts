import { REGIONS, Region, RegionId } from "../data/regions";

/**
 * Every land is one big open field with the crystal in the middle. Nothing blocks walking:
 * trees, rocks and plants are only scenery you pass in front of or behind.
 */
export const ARENA = 5800;
/** how far from the edge anyone can walk */
export const EDGE = 140;

export type Pt = [number, number];

export interface ArenaObj {
  tex: string;
  x: number;
  /** bottom of the sprite (depth sorting) */
  y: number;
  flip?: boolean;
  scale?: number;
}

/** A painted ground decoration (flower meadow, wheat, moss, dune, ice) of radius r. */
export interface Patch {
  x: number;
  y: number;
  r: number;
}

export interface Arena {
  land: Region;
  center: Pt;
  objects: ArenaObj[];
  patches: Patch[];
  /** size of the field (the open lands are ARENA x ARENA; story paths are long and thin) */
  w: number;
  h: number;
  /** story paths: where you start, where the path ends (y) and the strip you can walk on (x) */
  path?: { kind: PathKind; startY: number; endY: number; x0: number; x1: number };
  /** the sea stage: open water, nothing on it (the ocean: a big one to sail across) */
  sea?: boolean;
  ocean?: boolean;
  /** the lighthouse island: an oval of land in the sea (centre, radii), the fire bowls and the lighthouse */
  island?: { cx: number; cy: number; rx: number; ry: number; bowls: Pt[]; tower: Pt };
  /** the volcano's crater: its ash floor (an oval in a sea of lava), the lava lake in the middle, the water geysers */
  crater?: Oval & { lake: Oval; vents: Pt[] };
  /** the storm flight: a patch of stormy sky that fits on one screen (you fly the helicopter in it) */
  sky?: boolean;
}

/** An oval: centre and radii. */
export interface Oval {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Is a point inside an oval (`margin` in from its edge; `k` shrinks it)? */
export function inOval(o: Oval, x: number, y: number, margin = 0, k = 1): boolean {
  return ((x - o.cx) / (o.rx * k - margin)) ** 2 + ((y - o.cy) / (o.ry * k - margin)) ** 2 <= 1;
}

/** The nearest point inside an oval (`margin` in from its edge; `k` shrinks it). */
export function toOval(o: Oval, x: number, y: number, margin = 0, k = 1): Pt {
  const d = Math.hypot((x - o.cx) / (o.rx * k - margin), (y - o.cy) / (o.ry * k - margin));
  return d <= 1 ? [x, y] : [o.cx + (x - o.cx) / d, o.cy + (y - o.cy) / d];
}

/** A story path: through the woods to the village, or down to the sea. */
export type PathKind = "village" | "sea";

export function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const cache = new Map<RegionId, Arena>();

/** The arena of a land (the same every time, so it is built once). */
export function getArena(id: RegionId): Arena {
  const a = arenaFor(id);
  useArena(a);
  return a;
}

function arenaFor(id: RegionId): Arena {
  if (!cache.has(id)) cache.set(id, buildArena(REGIONS.find((r) => r.id === id)!));
  return cache.get(id)!;
}

function buildArena(land: Region): Arena {
  const rand = seeded(1234 + REGIONS.indexOf(land) * 7777);
  const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
  const c = ARENA / 2;
  const objects: ArenaObj[] = [];
  const taken: { x: number; y: number; r: number }[] = [{ x: c, y: c, r: 420 }];
  const free = (x: number, y: number, r: number) => !taken.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + r);

  // a fence of trees along the edge, so you can see where the land ends
  const step = 120;
  for (let s = 0; s < ARENA; s += step) {
    for (const [x, y] of [[s, 70], [s + 60, ARENA - 20], [40, s + 60], [ARENA - 40, s]] as Pt[]) {
      objects.push({ tex: pick(land.trees), x: x + (rand() - 0.5) * 30, y: y + (rand() - 0.5) * 20, flip: rand() < 0.5, scale: 0.95 + rand() * 0.25 });
    }
  }

  // a few small groves, far apart
  for (let n = 0, tries = 0; n < 42 && tries < 600; tries++) {
    const gx = 400 + rand() * (ARENA - 800);
    const gy = 400 + rand() * (ARENA - 800);
    if (!free(gx, gy, 260)) continue;
    taken.push({ x: gx, y: gy, r: 200 });
    const count = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      objects.push({ tex: pick(land.trees), x: gx + (rand() - 0.5) * 200, y: gy + (rand() - 0.5) * 140, flip: rand() < 0.5, scale: 0.85 + rand() * 0.3 });
    }
    n++;
  }

  // little plants sprinkled around
  for (let n = 0, tries = 0; n < 220 && tries < 2000; tries++) {
    const x = 250 + rand() * (ARENA - 500);
    const y = 250 + rand() * (ARENA - 500);
    if (!free(x, y, 40)) continue;
    objects.push({ tex: pick(land.plants), x, y, flip: rand() < 0.5 });
    n++;
  }

  const patches: Patch[] = [];
  for (let n = 0; n < 90; n++) patches.push({ x: 300 + rand() * (ARENA - 600), y: 300 + rand() * (ARENA - 600), r: 90 + rand() * 120 });
  return { land, center: [c, c], objects, patches, w: ARENA, h: ARENA };
}

/** Story paths: a long, thin field (PATH_W x PATH_H) with deep woods down both sides. */
export const PATH_W = 2000;
export const PATH_H = 19950;
/** the open strip in the middle you walk along */
export const PATH_HALF = 380;

const pathCache = new Map<string, Arena>();

/** The long path through the woods of a land, ending at the village or the sea. */
export function getPathArena(land: Region, kind: PathKind): Arena {
  const key = `${land.id}_${kind}`;
  if (!pathCache.has(key)) pathCache.set(key, buildPath(land, kind));
  const a = pathCache.get(key)!;
  useArena(a);
  return a;
}

function buildPath(land: Region, kind: PathKind): Arena {
  const rand = seeded(777 + REGIONS.indexOf(land) * 31 + (kind === "sea" ? 5 : 0));
  const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
  const [w, h] = [PATH_W, PATH_H];
  const mid = w / 2;
  const x0 = mid - PATH_HALF;
  const x1 = mid + PATH_HALF;
  // the end of the path: the village (or the beach) fills the top of the field
  const endY = 1500;
  const startY = h - 450;
  const objects: ArenaObj[] = [];
  const trees = land.trees.filter((t) => t !== "rock");
  // deep woods down both sides: rows of trees, thick near the edge, thinning toward the path
  for (let y = endY + 200; y < h + 60; y += 115) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const d = PATH_HALF + 70 + k * 108 + rand() * 60;
        if (k === 0 && rand() < 0.35) continue;
        objects.push({ tex: pick(trees), x: mid + side * d, y: y + (rand() - 0.5) * 60, flip: rand() < 0.5, scale: 0.9 + rand() * 0.35 });
      }
    }
  }
  // the edge of the path: bushes, flowers and stumps, a few rocks on it
  for (let y = endY + 200; y < h; y += 70) {
    for (const side of [-1, 1]) if (rand() < 0.7) objects.push({ tex: pick(land.plants), x: mid + side * (PATH_HALF - 10 + rand() * 50), y: y + rand() * 40, flip: rand() < 0.5 });
    if (rand() < 0.06) objects.push({ tex: "rock", x: x0 + 80 + rand() * (x1 - x0 - 160), y, scale: 0.6 + rand() * 0.2 });
  }
  // the sides of the top: trees all the way up beside the village (or the beach)
  for (let y = 120; y < endY + 200; y += 110) {
    for (const side of [-1, 1]) objects.push({ tex: pick(trees), x: mid + side * (900 + rand() * 60), y, flip: rand() < 0.5, scale: 1 + rand() * 0.2 });
  }
  const patches: Patch[] = [];
  for (let y = 300; y < h; y += 260) patches.push({ x: mid + (rand() - 0.5) * 900, y: y + rand() * 120, r: 90 + rand() * 120 });
  return { land, center: [mid, startY], objects, patches, w, h, path: { kind, startY, endY, x0, x1 } };
}

/** The sea stage: a small patch of open sea (you are on a boat in the middle of it). */
export const SEA_W = 1600;
export const SEA_H = 2600;

export function getSeaArena(land: Region): Arena {
  const a: Arena = { land, center: [SEA_W / 2, SEA_H / 2], objects: [], patches: [], w: SEA_W, h: SEA_H, sea: true };
  useArena(a);
  return a;
}

/** The open ocean (stage 7): a big stretch of sea to sail across looking for land. */
export const OCEAN_W = 6000;
export const OCEAN_H = 24000;

export function getOceanArena(land: Region): Arena {
  const a: Arena = { land, center: [OCEAN_W / 2, OCEAN_H - 600], objects: [], patches: [], w: OCEAN_W, h: OCEAN_H, sea: true, ocean: true };
  useArena(a);
  return a;
}

/** The lighthouse island (stage 8): an oval of land with the sea all round, the lighthouse up top. */
export const ISLE_W = 5200;
export const ISLE_H = 5000;
const ISLE_RX = 2150;
const ISLE_RY = 1900;

const isleCache = new Map<RegionId, Arena>();

export function getIslandArena(land: Region): Arena {
  if (!isleCache.has(land.id)) isleCache.set(land.id, buildIsland(land));
  const a = isleCache.get(land.id)!;
  useArena(a);
  return a;
}

/** Is a point on the island's land (`margin` in from the shore)? */
export function onIsle(a: Arena, x: number, y: number, margin = 0): boolean {
  return inOval(a.island!, x, y, margin);
}

/** The nearest point on the island's land (`margin` in from the shore). */
export function toIsle(a: Arena, x: number, y: number, margin = 0): Pt {
  return toOval(a.island!, x, y, margin);
}

function buildIsland(land: Region): Arena {
  const rand = seeded(4242 + REGIONS.indexOf(land) * 13);
  const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
  const [cx, cy] = [ISLE_W / 2, ISLE_H / 2 + 100];
  const tower: Pt = [cx, cy - 1150];
  const bowls: Pt[] = [[cx - 1350, cy + 250], [cx + 1350, cy + 150], [cx - 750, cy - 850], [cx + 800, cy - 800]];
  const start: Pt = [cx, cy + ISLE_RY - 350];
  const taken = [...bowls, start].map(([x, y]) => ({ x, y, r: 330 }));
  taken.push({ x: tower[0], y: tower[1] - 100, r: 420 });
  const free = (x: number, y: number, r: number) => !taken.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + r);
  const inside = (x: number, y: number, m: number) => ((x - cx) / (ISLE_RX - m)) ** 2 + ((y - cy) / (ISLE_RY - m)) ** 2 <= 1;
  const objects: ArenaObj[] = [];
  // palms round the shore
  for (let a = 0; a < Math.PI * 2; a += 0.09) {
    if (rand() < 0.35) continue;
    const k = 0.84 + rand() * 0.08;
    const [x, y] = [cx + Math.cos(a) * ISLE_RX * k, cy + Math.sin(a) * ISLE_RY * k];
    if (!free(x, y, 60)) continue;
    objects.push({ tex: "palm", x, y, flip: rand() < 0.5, scale: 0.9 + rand() * 0.3 });
  }
  // groves inland
  const trees = land.trees.filter((t) => t !== "rock");
  for (let n = 0, tries = 0; n < 22 && tries < 500; tries++) {
    const [x, y] = [cx + (rand() - 0.5) * ISLE_RX * 1.6, cy + (rand() - 0.5) * ISLE_RY * 1.6];
    if (!inside(x, y, 500) || !free(x, y, 220)) continue;
    taken.push({ x, y, r: 180 });
    for (let i = 0, m = 1 + Math.floor(rand() * 3); i < m; i++) {
      objects.push({ tex: pick(trees), x: x + (rand() - 0.5) * 200, y: y + (rand() - 0.5) * 140, flip: rand() < 0.5, scale: 0.85 + rand() * 0.3 });
    }
    n++;
  }
  // rocks and little plants
  for (let n = 0, tries = 0; n < 160 && tries < 2000; tries++) {
    const [x, y] = [cx + (rand() - 0.5) * ISLE_RX * 2, cy + (rand() - 0.5) * ISLE_RY * 2];
    if (!inside(x, y, 300) || !free(x, y, 40)) continue;
    objects.push({ tex: rand() < 0.15 ? "rock" : pick(land.plants), x, y, flip: rand() < 0.5, scale: rand() < 0.15 ? 0.6 : undefined });
    n++;
  }
  const patches: Patch[] = [];
  for (let n = 0; n < 60; n++) {
    const [x, y] = [cx + (rand() - 0.5) * ISLE_RX * 1.6, cy + (rand() - 0.5) * ISLE_RY * 1.6];
    if (inside(x, y, 450)) patches.push({ x, y, r: 90 + rand() * 120 });
  }
  return {
    land, center: start, objects, patches, w: ISLE_W, h: ISLE_H,
    island: { cx, cy, rx: ISLE_RX, ry: ISLE_RY, bowls, tower },
  };
}

/** The storm flight (stage 9): open sky, the same size as the sea stage (it fits on one screen). */
export function getSkyArena(land: Region): Arena {
  // (you start on the left, the storm comes at you from the right)
  const a: Arena = { land, center: [450, 1300], objects: [], patches: [], w: SEA_W, h: SEA_H, sky: true };
  useArena(a);
  return a;
}

/** The volcano's crater (stage 10): an oval ash floor in a sea of lava, the lava lake in the middle. */
export const CRATER_W = 4400;
export const CRATER_H = 4200;

const craterCache = new Map<RegionId, Arena>();

export function getCraterArena(land: Region): Arena {
  if (!craterCache.has(land.id)) craterCache.set(land.id, buildCrater(land));
  const a = craterCache.get(land.id)!;
  useArena(a);
  return a;
}

function buildCrater(land: Region): Arena {
  const rand = seeded(9090 + REGIONS.indexOf(land) * 17);
  const [cx, cy] = [CRATER_W / 2, CRATER_H / 2];
  const floor: Oval = { cx, cy, rx: 1800, ry: 1550 };
  const lake: Oval = { cx, cy: cy - 150, rx: 520, ry: 360 };
  // (well inside the floor: still safe once the lava closes in)
  const vents: Pt[] = [[cx - 820, cy + 520], [cx + 820, cy + 520], [cx, cy - 860]];
  const start: Pt = [cx, cy + 1150];
  const taken = [...vents, start].map(([x, y]) => ({ x, y, r: 260 }));
  const objects: ArenaObj[] = [];
  // jagged rocks and old bones round the edge of the floor, a few out in the middle
  for (let n = 0, tries = 0; n < 70 && tries < 1500; tries++) {
    const a = rand() * Math.PI * 2;
    const k = rand() < 0.75 ? 0.82 + rand() * 0.12 : 0.45 + rand() * 0.3;
    const [x, y] = [cx + Math.cos(a) * floor.rx * k, cy + Math.sin(a) * floor.ry * k];
    if (inOval(lake, x, y, -260) || taken.some((t) => Math.hypot(t.x - x, t.y - y) < t.r)) continue;
    const r = rand();
    objects.push({ tex: r < 0.55 ? "rock" : r < 0.7 ? "skull" : r < 0.85 ? "rock_small" : "dry_bush", x, y, flip: rand() < 0.5, scale: r < 0.55 ? 0.7 + rand() * 0.6 : undefined });
    n++;
  }
  return { land, center: start, objects, patches: [], w: CRATER_W, h: CRATER_H, crater: { ...floor, lake, vents } };
}

/** The field you are on: keeps everyone inside it (set by getArena / getPathArena). */
let bounds = { w: ARENA, h: ARENA };

export function useArena(a: Arena): void {
  bounds = { w: a.w, h: a.h };
}

export const clampX = (x: number) => Math.max(EDGE, Math.min(bounds.w - EDGE, x));
export const clampY = (y: number) => Math.max(EDGE + 80, Math.min(bounds.h - EDGE / 2, y));
