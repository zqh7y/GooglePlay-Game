import Phaser from "phaser";
import { REGIONS } from "../data/regions";
import { WORLD, World, regionAt, regionInfo } from "../game/world";
import { darken, lighten, mix, rgba } from "./draw";

/** The ground is painted once at half resolution and shown at 2x (it is big: 4000 x 4000). */
export const GROUND_SCALE = 0.5;

function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Land colours blended softly where two lands meet. */
function paintBiomes(ctx: CanvasRenderingContext2D): void {
  const N = 200;
  const low = document.createElement("canvas");
  low.width = N;
  low.height = N;
  const lctx = low.getContext("2d")!;
  const img = lctx.createImageData(N, N);
  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      const x = ((px + 0.5) / N) * WORLD;
      const y = ((py + 0.5) / N) * WORLD;
      const { i, j, edge } = regionInfo(x, y);
      const t = edge < 160 ? 0.5 - edge / 320 : 0;
      let c = mix(REGIONS[i].ground, REGIONS[j].ground, t);
      const n = Math.sin(x * 0.011 + Math.cos(y * 0.007) * 2) * Math.cos(y * 0.009 - x * 0.003);
      c = n > 0 ? lighten(c, n * 0.06) : darken(c, -n * 0.06);
      const k = (py * N + px) * 4;
      img.data[k] = (c >> 16) & 255;
      img.data[k + 1] = (c >> 8) & 255;
      img.data[k + 2] = c & 255;
      img.data[k + 3] = 255;
    }
  }
  lctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(low, 0, 0, WORLD, WORLD);
}

/** Thousands of little grass tufts, flowers, dune ripples and snow sparkles. */
function paintDetails(ctx: CanvasRenderingContext2D, rand: () => number): void {
  const batches = new Map<string, { kind: "stroke" | "fill"; width: number; draw: (() => void)[] }>();
  const add = (color: string, kind: "stroke" | "fill", width: number, draw: () => void) => {
    const key = `${color}|${kind}|${width}`;
    if (!batches.has(key)) batches.set(key, { kind, width, draw: [] });
    batches.get(key)!.draw.push(draw);
  };
  for (let n = 0; n < 26000; n++) {
    const x = rand() * WORLD;
    const y = rand() * WORLD;
    const r = regionAt(x, y);
    const g = r.ground;
    if (r.id === "desert") {
      const c = rgba(rand() < 0.5 ? darken(g, 0.08) : lighten(g, 0.15));
      add(c, "stroke", 4, () => {
        ctx.moveTo(x - 18, y);
        ctx.quadraticCurveTo(x, y - 8, x + 18, y);
      });
    } else if (r.id === "frost") {
      add(rand() < 0.5 ? "rgba(170,200,230,0.55)" : "#ffffff", "fill", 0, () => {
        ctx.moveTo(x + 4, y);
        ctx.ellipse(x, y, 5 + rand() * 6, 2.5, 0, 0, Math.PI * 2);
      });
    } else {
      const c = rgba(rand() < 0.6 ? darken(g, 0.13) : lighten(g, 0.12));
      add(c, "stroke", 4, () => {
        ctx.moveTo(x - 6, y);
        ctx.lineTo(x - 9, y - 12);
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - 16);
        ctx.moveTo(x + 6, y);
        ctx.lineTo(x + 9, y - 12);
      });
      if (r.id !== "woods" && rand() < 0.08) {
        const fc = r.id === "farm" ? "#ffe066" : ["#ffffff", "#ffb3d1", "#ffe066", "#b8a8ff"][Math.floor(rand() * 4)];
        add(fc, "fill", 0, () => {
          for (let k = 0; k < 4; k++) {
            const fx = x + (rand() - 0.5) * 40;
            const fy = y + (rand() - 0.5) * 24;
            ctx.moveTo(fx + 5, fy);
            ctx.arc(fx, fy, 5, 0, Math.PI * 2);
          }
        });
      }
      if (r.id === "woods" && rand() < 0.1) {
        add(rgba(0x8a6a3a), "fill", 0, () => {
          ctx.moveTo(x + 5, y);
          ctx.ellipse(x, y, 6, 3, 0.5, 0, Math.PI * 2);
        });
      }
    }
  }
  ctx.lineCap = "round";
  for (const [key, b] of batches) {
    const color = key.split("|")[0];
    ctx.beginPath();
    b.draw.forEach((d) => d());
    if (b.kind === "stroke") {
      ctx.lineWidth = b.width;
      ctx.strokeStyle = color;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

function polyline(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
}

function paintWater(ctx: CanvasRenderingContext2D, w: World): void {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // river
  for (const [width, color] of [[190, "#e8d8a8"], [150, "#3f9fd8"], [104, "#5cc0ee"], [40, "rgba(160,230,255,0.6)"]] as [number, string][]) {
    polyline(ctx, w.river);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  // lakes and ponds
  for (const l of w.lakes) {
    ctx.beginPath();
    ctx.ellipse(l.x, l.y, l.rx + 22, l.ry + 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = l.ice ? "#c8dff2" : "#e8d8a8";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(l.x, l.y, l.rx, l.ry, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(l.x, l.y, 10, l.x, l.y, l.rx);
    if (l.ice) {
      g.addColorStop(0, "#f2fbff");
      g.addColorStop(1, "#a8d8f2");
    } else {
      g.addColorStop(0, "#2f86c8");
      g.addColorStop(1, "#5cc0ee");
    }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = l.ice ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.ellipse(l.x - l.rx * 0.25, l.y - l.ry * 0.3, l.rx * 0.35, l.ry * 0.12, -0.2, 0, Math.PI * 2);
    ctx.stroke();
    if (l.ice) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(120,170,210,0.7)";
      ctx.beginPath();
      ctx.moveTo(l.x - l.rx * 0.6, l.y + 10);
      ctx.lineTo(l.x - 20, l.y - 20);
      ctx.lineTo(l.x + l.rx * 0.4, l.y + 30);
      ctx.moveTo(l.x - 20, l.y - 20);
      ctx.lineTo(l.x + 10, l.y - l.ry * 0.7);
      ctx.stroke();
    } else {
      for (const [dx, dy] of [[0.5, 0.2], [-0.4, 0.4], [0.2, -0.5]]) {
        ctx.beginPath();
        ctx.arc(l.x + dx * l.rx, l.y + dy * l.ry, 14, 0, Math.PI * 2);
        ctx.fillStyle = "#6fbf4a";
        ctx.fill();
      }
    }
  }
}

function paintRoads(ctx: CanvasRenderingContext2D, w: World, rand: () => number): void {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const pass of [0, 1]) {
    for (const road of w.roads) {
      for (let i = 0; i < road.pts.length - 1; i++) {
        const [ax, ay] = road.pts[i];
        const [bx, by] = road.pts[i + 1];
        const r = regionAt((ax + bx) / 2, (ay + by) / 2);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineWidth = pass ? road.width : road.width + 26;
        ctx.strokeStyle = rgba(pass ? r.road : r.roadEdge);
        ctx.stroke();
      }
    }
  }
  // stones and wheel ruts
  for (const road of w.roads) {
    road.pts.forEach(([x, y], i) => {
      if (i % 2) return;
      const r = regionAt(x, y);
      for (let k = 0; k < 3; k++) {
        const sx = x + (rand() - 0.5) * road.width * 0.8;
        const sy = y + (rand() - 0.5) * road.width * 0.8;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 7 + rand() * 6, 4 + rand() * 3, rand(), 0, Math.PI * 2);
        ctx.fillStyle = rgba(darken(r.road, 0.12));
        ctx.fill();
      }
    });
  }
}

function paintPlazas(ctx: CanvasRenderingContext2D, w: World): void {
  for (const p of w.plazas) {
    const c = p.region.plaza;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 16, 0, Math.PI * 2);
    ctx.fillStyle = rgba(p.region.roadEdge);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(c);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = rgba(darken(c, 0.12));
    for (const r of [0.4, 0.7]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * p.r * 0.4, p.y + Math.sin(a) * p.r * 0.4);
      ctx.lineTo(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r);
      ctx.stroke();
    }
  }
}

function paintFields(ctx: CanvasRenderingContext2D, w: World): void {
  for (const f of w.fields) {
    ctx.fillStyle = "#6a4528";
    ctx.beginPath();
    ctx.roundRect(f.x - 8, f.y - 8, f.w + 16, f.h + 16, 22);
    ctx.fill();
    ctx.fillStyle = "#9a6a42";
    ctx.beginPath();
    ctx.roundRect(f.x, f.y, f.w, f.h, 16);
    ctx.fill();
    ctx.fillStyle = "#86593a";
    for (let r = 0; r < 3; r++) {
      ctx.beginPath();
      ctx.roundRect(f.x + 16, f.y + 64 + r * 72, f.w - 32, 18, 9);
      ctx.fill();
    }
  }
}

/** Paint the whole world; returns texture keys for the ground, the minimap and the big map. */
export function makeGround(scene: Phaser.Scene, w: World): { ground: string; mini: string; map: string } {
  const keys = { ground: "world_ground", mini: "world_mini", map: "world_map" };
  if (scene.textures.exists(keys.ground)) return keys;
  const rand = seeded(777);
  const size = WORLD * GROUND_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(GROUND_SCALE, GROUND_SCALE);
  paintBiomes(ctx);
  paintDetails(ctx, rand);
  paintPlazas(ctx, w);
  paintFields(ctx, w);
  paintWater(ctx, w);
  paintRoads(ctx, w, rand);
  scene.textures.addCanvas(keys.ground, canvas);
  for (const [key, px] of [[keys.mini, 220], [keys.map, 880]] as [string, number][]) {
    const c = document.createElement("canvas");
    c.width = px;
    c.height = px;
    c.getContext("2d")!.drawImage(canvas, 0, 0, px, px);
    scene.textures.addCanvas(key, c);
  }
  return keys;
}
