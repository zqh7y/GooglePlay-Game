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
export const PATH_H = 36000;
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

/** The field you are on: keeps everyone inside it (set by getArena / getPathArena). */
let bounds = { w: ARENA, h: ARENA };

export function useArena(a: Arena): void {
  bounds = { w: a.w, h: a.h };
}

export const clampX = (x: number) => Math.max(EDGE, Math.min(bounds.w - EDGE, x));
export const clampY = (y: number) => Math.max(EDGE + 80, Math.min(bounds.h - EDGE / 2, y));
