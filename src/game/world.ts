import { HOUSE_ROOFS, houseKey } from "../art/world";
import { REGIONS, Region, RegionId } from "../data/regions";

/** The whole map is one big square; every land is a slice of it. */
export const WORLD = 4000;
const CELL = 50;
const GRID = WORLD / CELL;

export type Pt = [number, number];

/** Something that blocks walking: a circle (r) or a box (w x h around x, y). */
export interface Collider {
  x: number;
  y: number;
  r?: number;
  w?: number;
  h?: number;
}

export interface WorldObj {
  tex: string;
  x: number;
  /** bottom of the sprite (depth sorting) */
  y: number;
  flip?: boolean;
  scale?: number;
  /** fixed depth for things lying on the ground */
  depth?: number;
  angle?: number;
}

export interface Road {
  pts: Pt[];
  width: number;
}

export interface Lake {
  x: number;
  y: number;
  rx: number;
  ry: number;
  ice?: boolean;
}

export interface World {
  objects: WorldObj[];
  colliders: Collider[];
  roads: Road[];
  river: Pt[];
  lakes: Lake[];
  fields: { x: number; y: number; w: number; h: number }[];
  plazas: { x: number; y: number; r: number; region: Region }[];
  portals: Record<RegionId, Pt[]>;
  chests: { id: string; x: number; y: number; region: RegionId }[];
  windmill: Pt;
  /** smoking chimneys */
  chimneys: Pt[];
}

// ───────────────────────── lands ─────────────────────────

/** Gentle wobble so borders between lands are not straight lines. */
const wobble = (x: number, y: number) => Math.sin(x * 0.0041 + y * 0.0013) * 70 + Math.cos(y * 0.0037 - x * 0.0021) * 60;

/** Index into REGIONS of the land at a point, plus how close the next land is (for soft ground blending). */
export function regionInfo(x: number, y: number): { i: number; j: number; edge: number } {
  let i = 0;
  let j = 0;
  let d1 = Infinity;
  let d2 = Infinity;
  REGIONS.forEach((r, k) => {
    const d = Math.hypot(x - r.heart[0], y - r.heart[1]) + wobble(x + k * 977, y - k * 613);
    if (d < d1) {
      d2 = d1;
      j = i;
      d1 = d;
      i = k;
    } else if (d < d2) {
      d2 = d;
      j = k;
    }
  });
  return { i, j, edge: d2 - d1 };
}

export const regionAt = (x: number, y: number) => REGIONS[regionInfo(x, y).i];

// ───────────────────────── geometry helpers ─────────────────────────

function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Smooth curve through control points (Catmull-Rom), sampled every ~40px. */
function spline(ctrl: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 40));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

function distToPolyline(x: number, y: number, pts: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

const circlePts = (cx: number, cy: number, r: number, n = 48): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r] as Pt);

// ───────────────────────── building the world ─────────────────────────

const R = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, Region>;

let cached: World | null = null;
/** The world is the same every time, so it is built once. */
export const getWorld = () => (cached ??= buildWorld());

function buildWorld(): World {
  const rand = seeded(20240611);
  const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
  const objects: WorldObj[] = [];
  const colliders: Collider[] = [];
  const chimneys: Pt[] = [];
  const v = R.village.heart;

  // roads: from the village to every land, plus loops inside the lands
  const roads: Road[] = [
    { pts: spline([v, [2350, 2160], [2650, 2230], [2950, 2330], R.farm.heart]), width: 120 },
    { pts: spline([v, [1960, 1700], [2120, 1300], R.woods.heart]), width: 120 },
    { pts: spline([v, [1650, 2420], [1180, 2760], R.desert.heart]), width: 120 },
    { pts: spline([v, [1560, 1760], [1120, 1260], R.frost.heart]), width: 120 },
    { pts: circlePts(v[0], v[1], 600), width: 90 },
    { pts: spline([[R.farm.heart[0] - 500, R.farm.heart[1] - 520], [R.farm.heart[0] + 520, R.farm.heart[1] - 520], [R.farm.heart[0] + 560, R.farm.heart[1] + 480], [R.farm.heart[0] - 300, R.farm.heart[1] + 560], [R.farm.heart[0] - 500, R.farm.heart[1] - 520]]), width: 90 },
    { pts: spline([R.woods.heart, [2500, 1050], [2900, 700], [2600, 300], [2050, 250], [1600, 500], R.woods.heart]), width: 80 },
    { pts: spline([R.desert.heart, [1300, 3450], [1100, 3800], [500, 3700], [300, 3300], R.desert.heart]), width: 90 },
    { pts: spline([R.frost.heart, [400, 1250], [300, 700], [700, 350], [1150, 500], R.frost.heart]), width: 90 },
  ];
  const nearRoad = (x: number, y: number, pad: number) => roads.some((r) => distToPolyline(x, y, r.pts) < r.width / 2 + pad);

  // water: a lake in the north-east feeding a river that runs south past the village
  const lakes: Lake[] = [
    { x: 3360, y: 760, rx: 330, ry: 230 },
    { x: 1600, y: 2420, rx: 150, ry: 95 },
    { x: 2480, y: 560, rx: 170, ry: 110 },
    { x: 1060, y: 3040, rx: 150, ry: 95 },
    { x: 980, y: 600, rx: 230, ry: 140, ice: true },
  ];
  const river = spline([[3160, 940], [2950, 1260], [2770, 1620], [2650, 1980], [2640, 2280], [2700, 2700], [2820, 3150], [2900, 3600], [2950, 4060]]);
  const inLake = (x: number, y: number, pad: number) => lakes.some((l) => !l.ice && ((x - l.x) / (l.rx + pad)) ** 2 + ((y - l.y) / (l.ry + pad)) ** 2 < 1);
  const nearWater = (x: number, y: number, pad: number) => inLake(x, y, pad) || distToPolyline(x, y, river) < 70 + pad;

  // bridges where roads cross the river
  const bridges: Pt[] = [];
  for (const road of roads) {
    for (const p of road.pts) {
      if (distToPolyline(p[0], p[1], river) < 30 && !bridges.some((b) => Math.hypot(b[0] - p[0], b[1] - p[1]) < 200)) bridges.push(p);
    }
  }
  for (const [bx, by] of bridges) {
    const road = roads.find((r) => distToPolyline(bx, by, r.pts) < 40)!;
    const i = road.pts.findIndex((p) => Math.hypot(p[0] - bx, p[1] - by) < 60);
    const a = road.pts[Math.max(0, i - 1)];
    const b = road.pts[Math.min(road.pts.length - 1, i + 1)];
    objects.push({ tex: "bridge", x: bx, y: by + 90, depth: -500, angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI });
  }
  river.forEach(([x, y], i) => {
    if (i % 1 === 0 && !bridges.some((b) => Math.hypot(b[0] - x, b[1] - y) < 120)) colliders.push({ x, y, r: 62 });
  });
  for (const l of lakes) {
    if (l.ice) continue;
    for (let x = l.x - l.rx; x <= l.x + l.rx; x += 50) {
      for (let y = l.y - l.ry; y <= l.y + l.ry; y += 50) {
        if (((x - l.x) / (l.rx - 20)) ** 2 + ((y - l.y) / (l.ry - 20)) ** 2 < 1) colliders.push({ x, y, r: 36 });
      }
    }
  }

  // land hearts on their plazas
  const plazas = REGIONS.map((r) => ({ x: r.heart[0], y: r.heart[1], r: r.id === "village" ? 290 : 250, region: r }));
  const taken: Collider[] = plazas.map((p) => ({ x: p.x, y: p.y, r: p.r + 30 }));
  const hearts: Record<RegionId, [WorldObj, Collider]> = {
    village: [{ tex: "fountain", x: v[0], y: v[1] + 60 }, { x: v[0], y: v[1] + 20, w: 270, h: 90 }],
    farm: [{ tex: "windmill", x: R.farm.heart[0], y: R.farm.heart[1] + 40 }, { x: R.farm.heart[0], y: R.farm.heart[1] + 10, w: 120, h: 60 }],
    woods: [{ tex: "great_tree", x: R.woods.heart[0], y: R.woods.heart[1] + 60 }, { x: R.woods.heart[0], y: R.woods.heart[1] + 30, w: 150, h: 60 }],
    desert: [{ tex: "obelisk", x: R.desert.heart[0], y: R.desert.heart[1] + 50 }, { x: R.desert.heart[0], y: R.desert.heart[1] + 30, w: 140, h: 40 }],
    frost: [{ tex: "ice_crystal", x: R.frost.heart[0], y: R.frost.heart[1] + 60 }, { x: R.frost.heart[0], y: R.frost.heart[1] + 30, r: 80 }],
  };
  for (const [obj, col] of Object.values(hearts)) {
    objects.push(obj);
    colliders.push(col);
  }
  const windmill: Pt = [R.farm.heart[0], R.farm.heart[1] + 40 - 238];

  const blocked = (x: number, y: number, r: number) =>
    x < 160 || y < 200 || x > WORLD - 160 || y > WORLD - 80 || taken.some((c) => Math.hypot(c.x - x, c.y - y) < (c.r ?? 0) + r);
  const free = (x: number, y: number, r: number, roadPad = 60) => !blocked(x, y, r) && !nearRoad(x, y, roadPad) && !nearWater(x, y, r * 0.6 + 20);
  const place = (obj: WorldObj, col: Collider | null, r: number) => {
    objects.push(obj);
    if (col) colliders.push(col);
    taken.push({ x: obj.x, y: obj.y - 40, r });
  };

  // farm fields with crops and fences
  const fields: World["fields"] = [];
  const fh = R.farm.heart;
  for (const [dx, dy] of [[-560, -330], [-40, -400], [430, -330], [-560, 320], [440, 300], [-40, 470]]) {
    const w = 380;
    const h = 250;
    const x = fh[0] + dx - w / 2;
    const y = fh[1] + dy - h / 2;
    const corners: Pt[] = [[x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y + h / 2]];
    if (corners.some(([cx, cy]) => nearRoad(cx, cy, 20) || nearWater(cx, cy, 40) || cx > WORLD - 150)) continue;
    fields.push({ x, y, w, h });
    taken.push({ x: x + w / 2, y: y + h / 2, r: 230 });
    const crop = pick(["crop_wheat", "crop_carrot", "crop_cabbage", "crop_corn", "crop_pumpkin"]);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) objects.push({ tex: crop, x: x + 52 + col * 69, y: y + 82 + row * 72 });
    for (let fx = x; fx < x + w - 10; fx += 120) {
      objects.push({ tex: "fence_h", x: fx + 60, y: y + 8 });
      objects.push({ tex: "fence_h", x: fx + 60, y: y + h + 24 });
    }
    colliders.push({ x: x + w / 2, y: y + 2, w, h: 16 }, { x: x + w / 2, y: y + h + 18, w, h: 16 });
    if (rand() < 0.6) objects.push({ tex: "scarecrow", x: x + w * 0.5, y: y + h * 0.6 });
  }

  // buildings
  const building = (region: Region, tex: string, count: number, rMin: number, rMax: number, w: number, extra?: (x: number, y: number) => void) => {
    for (let n = 0, tries = 0; n < count && tries < 400; tries++) {
      const a = rand() * Math.PI * 2;
      const d = rMin + rand() * (rMax - rMin);
      const x = region.heart[0] + Math.cos(a) * d;
      const y = region.heart[1] + Math.sin(a) * d;
      if (regionAt(x, y) !== region || !free(x, y - 60, w * 0.55, 30)) continue;
      const t = typeof tex === "string" && tex === "house" ? houseKey(pick(region.id === "farm" ? [0xc9423a, 0xf0a030] : HOUSE_ROOFS), region.id === "frost") : tex;
      place({ tex: t, x, y }, { x, y: y - 40, w: w * 0.8, h: 70 }, w * 0.6);
      if (t.startsWith("house")) chimneys.push([x + 46, y - 196]);
      extra?.(x, y);
      n++;
    }
  };
  const props = (x: number, y: number, list: string[]) => {
    if (rand() < 0.7) {
      const px = x + (rand() < 0.5 ? -130 : 130);
      if (free(px, y, 30, 10)) objects.push({ tex: pick(list), x: px, y: y - 4 });
    }
  };
  building(R.village, "house", 16, 380, 1000, 220, (x, y) => props(x, y, ["crate", "barrel", "hay", "bush"]));
  building(R.village, "stall", 4, 320, 420, 190);
  building(R.village, "well", 2, 330, 700, 120);
  building(R.farm, "barn", 3, 300, 900, 250, (x, y) => props(x, y, ["hay", "hay", "pumpkin", "logs"]));
  building(R.farm, "house", 3, 300, 900, 220, (x, y) => props(x, y, ["hay", "crate", "pumpkin"]));
  building(R.woods, "house", 3, 340, 900, 220, (x, y) => props(x, y, ["logs", "stump", "barrel"]));
  building(R.desert, "tent", 6, 300, 900, 190, (x, y) => props(x, y, ["crate", "barrel", "skull"]));
  building(R.frost, "igloo", 5, 300, 900, 190, (x, y) => props(x, y, ["snowman", "crate"]));
  building(R.frost, "house", 3, 340, 900, 220, (x, y) => props(x, y, ["snowman", "barrel"]));

  // lamp posts along the main roads
  for (const road of roads.slice(0, 5)) {
    road.pts.forEach(([x, y], i) => {
      if (i % 7 !== 3) return;
      const side = i % 14 === 3 ? 1 : -1;
      const lx = x + side * (road.width / 2 + 30);
      if (free(lx, y, 20, 0) && regionAt(lx, y).id !== "desert") place({ tex: "lamp", x: lx, y: y + 10 }, { x: lx, y, r: 14 }, 30);
    });
  }

  // trees, rocks and plants: dense woods, palms and cacti in the dunes, snowy pines up north
  const spacing: Record<RegionId, number> = { village: 230, farm: 260, woods: 120, desert: 260, frost: 170 };
  for (let y = 120; y < WORLD; y += 60) {
    for (let x = 60; x < WORLD; x += 60) {
      const jx = x + (rand() - 0.5) * 50;
      const jy = y + (rand() - 0.5) * 50;
      const region = regionAt(jx, jy);
      const edge = jx < 220 || jy < 260 || jx > WORLD - 220 || jy > WORLD - 140;
      const s = edge ? 95 : spacing[region.id];
      if (rand() > (60 * 60) / (s * s)) continue;
      const tex = pick(region.trees);
      const r = tex.startsWith("tree") || tex === "palm" ? 60 : 40;
      if (!edge && !free(jx, jy - 30, r, 50)) continue;
      if (edge && (nearRoad(jx, jy, 30) || nearWater(jx, jy, 20) || taken.some((c) => Math.hypot(c.x - jx, c.y - jy) < (c.r ?? 0) + 20))) continue;
      const solid = tex !== "bush";
      place({ tex, x: jx, y: jy, flip: rand() < 0.5, scale: 0.9 + rand() * 0.25 }, solid ? { x: jx, y: jy - 12, r: tex.startsWith("rock") ? 34 : 24 } : null, edge ? 30 : r);
    }
  }
  // extra rocks and stumps
  for (let n = 0; n < 70; n++) {
    const x = 200 + rand() * (WORLD - 400);
    const y = 260 + rand() * (WORLD - 400);
    const region = regionAt(x, y);
    const tex = region.id === "frost" ? "rock_snow" : region.id === "desert" ? pick(["rock_sand", "skull"]) : pick(["rock", "stump", "bush"]);
    if (free(x, y, 40, 30)) place({ tex, x, y, flip: rand() < 0.5 }, tex === "rock" || tex.startsWith("rock_") ? { x, y: y - 12, r: 32 } : null, 45);
  }

  // treasure chests to find while exploring
  const chests: World["chests"] = [];
  for (const region of REGIONS) {
    for (let n = 0, tries = 0; n < 3 && tries < 500; tries++) {
      const a = rand() * Math.PI * 2;
      const d = 450 + rand() * 650;
      const x = region.heart[0] + Math.cos(a) * d;
      const y = region.heart[1] + Math.sin(a) * d;
      if (regionAt(x, y) !== region || !free(x, y, 50, 20)) continue;
      chests.push({ id: `${region.id}${n}`, x, y, region: region.id });
      taken.push({ x, y, r: 70 });
      n++;
    }
  }

  const world: World = {
    objects, colliders, roads, river, lakes, fields, plazas, chests, windmill, chimneys,
    portals: {} as Record<RegionId, Pt[]>,
  };
  // monster portals: spread around each heart, far enough to give you time to react
  for (const region of REGIONS) {
    const dist = flowField(world, region.id, REGIONS.map((r) => r.id)).dist;
    const out: Pt[] = [];
    for (let k = 0; k < 16 && out.length < 4; k++) {
      const a = (k / 16) * Math.PI * 2 + (k % 2) * 0.2;
      for (const d of [900, 800, 700, 600]) {
        const x = region.heart[0] + Math.cos(a) * d;
        const y = region.heart[1] + Math.sin(a) * d;
        const c = cellOf(x, y);
        if (c < 0 || !isFinite(dist[c]) || regionAt(x, y) !== region || out.some((p) => Math.hypot(p[0] - x, p[1] - y) < 600)) continue;
        out.push([x, y]);
        break;
      }
    }
    world.portals[region.id] = out;
    for (const [x, y] of out) objects.push({ tex: "portal", x, y: y + 100, depth: -400 });
  }
  return world;
}

// ───────────────────────── walking: collisions ─────────────────────────

let hash: Map<number, Collider[]> | null = null;
let hashFor: Collider[] | null = null;
const HCELL = 200;

function buildHash(colliders: Collider[]): Map<number, Collider[]> {
  const m = new Map<number, Collider[]>();
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
  return m;
}

/** Push a walker (circle of radius r) out of anything solid, and keep it on the map. */
export function pushOut(x: number, y: number, r: number, colliders: Collider[]): Pt {
  if (hashFor !== colliders) {
    hash = buildHash(colliders);
    hashFor = colliders;
  }
  const near = hash!.get(Math.floor(x / HCELL) * 1000 + Math.floor(y / HCELL)) ?? [];
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
  return [Math.max(80, Math.min(WORLD - 80, x)), Math.max(150, Math.min(WORLD - 40, y))];
}

// ───────────────────────── walking: monster pathfinding ─────────────────────────

const cellOf = (x: number, y: number) => {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  return cx < 0 || cy < 0 || cx >= GRID || cy >= GRID ? -1 : cy * GRID + cx;
};

let blockedGrid: Uint8Array | null = null;
let blockedFor: Collider[] | null = null;

function blockedCells(colliders: Collider[]): Uint8Array {
  if (blockedFor === colliders && blockedGrid) return blockedGrid;
  const g = new Uint8Array(GRID * GRID);
  for (const c of colliders) {
    const ext = (c.r ?? Math.max(c.w ?? 0, c.h ?? 0) / 2) + 10;
    for (let gx = Math.floor((c.x - ext) / CELL); gx <= Math.floor((c.x + ext) / CELL); gx++) {
      for (let gy = Math.floor((c.y - ext) / CELL); gy <= Math.floor((c.y + ext) / CELL); gy++) {
        if (gx < 0 || gy < 0 || gx >= GRID || gy >= GRID) continue;
        const px = (gx + 0.5) * CELL;
        const py = (gy + 0.5) * CELL;
        const inside = c.r !== undefined
          ? Math.hypot(px - c.x, py - c.y) < c.r + 8
          : Math.abs(px - c.x) < (c.w ?? 0) / 2 + 8 && Math.abs(py - c.y) < (c.h ?? 0) / 2 + 8;
        if (inside) g[gy * GRID + gx] = 1;
      }
    }
  }
  blockedGrid = g;
  blockedFor = colliders;
  return g;
}

export interface Flow {
  dist: Float32Array;
  /** walking direction per cell */
  dx: Float32Array;
  dy: Float32Array;
}

const flowCache = new Map<string, Flow>();

/** Distance-to-heart map for one land, walking only through the given (unlocked) lands. */
export function flowField(world: World, target: RegionId, open: RegionId[]): Flow {
  const key = `${target}|${open.join(",")}`;
  const cached = flowCache.get(key);
  if (cached) return cached;
  const blocked = blockedCells(world.colliders);
  const allowed = new Uint8Array(GRID * GRID);
  for (let i = 0; i < GRID * GRID; i++) {
    if (blocked[i]) continue;
    const x = ((i % GRID) + 0.5) * CELL;
    const y = (Math.floor(i / GRID) + 0.5) * CELL;
    if (open.includes(regionAt(x, y).id)) allowed[i] = 1;
  }
  const dist = new Float32Array(GRID * GRID).fill(Infinity);
  const heart = REGIONS.find((r) => r.id === target)!.heart;
  const start = cellOf(heart[0], heart[1] + 160);
  const queue: number[] = [start];
  dist[start] = 0;
  const steps: [number, number, number][] = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [1, -1, 1.41], [-1, 1, 1.41], [-1, -1, 1.41]];
  // Dijkstra-lite: a few relaxation passes over a FIFO queue are plenty on this grid
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    const cx = c % GRID;
    const cy = Math.floor(c / GRID);
    for (const [sx, sy, cost] of steps) {
      const nx = cx + sx;
      const ny = cy + sy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const n = ny * GRID + nx;
      if (!allowed[n] && n !== start) continue;
      if (sx && sy && (!allowed[cy * GRID + nx] || !allowed[ny * GRID + cx])) continue;
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
  flowCache.set(key, flow);
  return flow;
}

/** Which way a monster at (x, y) should walk to reach the heart (null = no path: walk straight). */
export function flowDir(flow: Flow, x: number, y: number): Pt | null {
  const c = cellOf(x, y);
  if (c < 0 || !isFinite(flow.dist[c]) || (flow.dx[c] === 0 && flow.dy[c] === 0)) return null;
  return [flow.dx[c], flow.dy[c]];
}
