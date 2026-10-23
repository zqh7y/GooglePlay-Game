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
}

export function seeded(seed: number): () => number {
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
  return { land, center: [c, c], objects, patches };
}

export const clampX = (x: number) => Math.max(EDGE, Math.min(ARENA - EDGE, x));
export const clampY = (y: number) => Math.max(EDGE + 80, Math.min(ARENA - EDGE / 2, y));
