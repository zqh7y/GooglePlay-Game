import Phaser from "phaser";
import { ARENA, Arena, seeded } from "../game/arena";
import { Region } from "../data/regions";
import { darken, lighten, rgba } from "./draw";

/** Ground art is painted at half resolution and shown at 2x. */
export const GROUND_SCALE = 0.5;
/** The floor is one seamless tile (this many world pixels wide) repeated over the arena. */
export const TILE = 1024;
/** Patch textures are painted for this radius and scaled to each patch. */
export const PATCH_R = 150;

type Ctx = CanvasRenderingContext2D;

/** Batch many tiny shapes per colour into one path (much faster than one path each). */
class Batch {
  private paths = new Map<string, { stroke: boolean; width: number; draw: (() => void)[] }>();
  add(color: string, stroke: boolean, width: number, draw: () => void): void {
    const key = `${color}|${stroke}|${width}`;
    if (!this.paths.has(key)) this.paths.set(key, { stroke, width, draw: [] });
    this.paths.get(key)!.draw.push(draw);
  }
  flush(ctx: Ctx): void {
    ctx.lineCap = "round";
    for (const [key, p] of this.paths) {
      const color = key.split("|")[0];
      ctx.beginPath();
      p.draw.forEach((d) => d());
      if (p.stroke) {
        ctx.lineWidth = p.width;
        ctx.strokeStyle = color;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
    this.paths.clear();
  }
}

function softBlob(ctx: Ctx, x: number, y: number, r: number, color: number, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** One meadow / wheat field / moss / dune / snow drift, centred on (x, y). */
function paintPatch(ctx: Ctx, land: Region, x: number, y: number, r: number, rand: () => number): void {
  const b = new Batch();
  const dot = (color: string, px: number, py: number, rad: number) =>
    b.add(color, false, 0, () => {
      ctx.moveTo(px + rad, py);
      ctx.arc(px, py, rad, 0, Math.PI * 2);
    });
  const spot = (): Pt => {
    const ang = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * r;
    return [x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.7];
  };
  switch (land.detail) {
    case "grass": {
      softBlob(ctx, x, y, r * 1.2, land.groundLight, 0.7);
      const colors = ["#ffffff", "#ffb3d1", "#ffe066", "#c8b8ff"];
      for (let i = 0; i < r / 3; i++) {
        const [fx, fy] = spot();
        dot(colors[Math.floor(rand() * colors.length)], fx, fy, 6);
        dot("#ffd23f", fx, fy, 2.5);
      }
      break;
    }
    case "wheat":
      softBlob(ctx, x, y, r * 1.25, 0xe8c860, 0.9);
      for (let i = 0; i < r * 1.4; i++) {
        const [sx, sy] = spot();
        b.add(rgba(0xc9a23a), true, 3, () => {
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + 2, sy - 16);
        });
        b.add(rgba(0xf6dc7a), false, 0, () => {
          ctx.moveTo(sx + 6, sy - 18);
          ctx.ellipse(sx + 2, sy - 18, 3.5, 6, 0.2, 0, Math.PI * 2);
        });
      }
      break;
    case "moss":
      softBlob(ctx, x, y, r * 1.2, land.groundDark, 0.8);
      for (let i = 0; i < r / 2; i++) {
        const [lx, ly] = spot();
        const rot = rand() * 3;
        b.add(rgba(rand() < 0.5 ? 0x8a6a3a : 0x4f8a3a), false, 0, () => {
          ctx.moveTo(lx + 6, ly);
          ctx.ellipse(lx, ly, 6, 3, rot, 0, Math.PI * 2);
        });
      }
      break;
    case "sand":
      softBlob(ctx, x, y, r * 1.3, land.groundLight, 0.8);
      for (let i = 0; i < 5; i++) {
        const ly = y - r * 0.5 + i * r * 0.25;
        b.add(rgba(darken(land.ground, 0.1)), true, 5, () => {
          ctx.moveTo(x - r * 0.8, ly);
          ctx.quadraticCurveTo(x, ly - 18, x + r * 0.8, ly);
        });
      }
      break;
    case "snow":
      ctx.fillStyle = "#cfe8f8";
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e6f6ff";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.1, y - r * 0.08, r * 0.8, r * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  b.flush(ctx);
}

type Pt = [number, number];

/** Call `draw` at (x, y) and at its copies across the tile edges, so the tile repeats seamlessly. */
function wrap(x: number, y: number, r: number, draw: (x: number, y: number) => void): void {
  for (const dx of [-TILE, 0, TILE]) {
    for (const dy of [-TILE, 0, TILE]) {
      if (x + dx + r < 0 || x + dx - r > TILE || y + dy + r < 0 || y + dy - r > TILE) continue;
      draw(x + dx, y + dy);
    }
  }
}

/** The repeating floor tile: base colour, soft colour variation and tiny grass / sand / snow details. */
function paintTile(ctx: Ctx, land: Region, rand: () => number): void {
  ctx.fillStyle = rgba(land.ground);
  ctx.fillRect(0, 0, TILE, TILE);
  for (let i = 0; i < 14; i++) {
    const r = 90 + rand() * 200;
    const color = rand() < 0.5 ? land.groundDark : land.groundLight;
    wrap(rand() * TILE, rand() * TILE, r, (x, y) => softBlob(ctx, x, y, r, color, 0.45));
  }
  const b = new Batch();
  for (let n = 0; n < 700; n++) {
    const x0 = rand() * TILE;
    const y0 = rand() * TILE;
    const a = rand();
    const w = 4 + rand() * 7;
    wrap(x0, y0, 20, (x, y) => {
      if (land.detail === "sand") {
        b.add(rgba(a < 0.5 ? darken(land.ground, 0.08) : lighten(land.ground, 0.2)), true, 4, () => {
          ctx.moveTo(x - 16, y);
          ctx.quadraticCurveTo(x, y - 7, x + 16, y);
        });
      } else if (land.detail === "snow") {
        b.add(a < 0.6 ? "rgba(170,200,230,0.5)" : "#ffffff", false, 0, () => {
          ctx.moveTo(x + w, y);
          ctx.ellipse(x, y, w, 2.5, 0, 0, Math.PI * 2);
        });
      } else {
        b.add(rgba(a < 0.6 ? land.groundDark : lighten(land.ground, 0.14)), true, 4, () => {
          ctx.moveTo(x - 6, y);
          ctx.lineTo(x - 9, y - 12);
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - 16);
          ctx.moveTo(x + 6, y);
          ctx.lineTo(x + 9, y - 12);
        });
      }
    });
  }
  b.flush(ctx);
}

/** A ring of flat stones around the crystal (centred in a 760 x 560 texture). */
function paintCircle(ctx: Ctx, land: Region): void {
  const [cx, cy] = [380, 280];
  softBlob(ctx, cx, cy, 340, darken(land.ground, 0.12), 0.6);
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    const x = cx + Math.cos(ang) * 250;
    const y = cy + Math.sin(ang) * 190;
    for (const [dy, rx, ry, c] of [[5, 30, 20, "#7a7a86"], [0, 28, 18, "#c8c8d2"]] as [number, number, number, string][]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(x, y + dy, rx, ry, ang, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.ellipse(x - 6, y - 5, 10, 5, ang, 0, Math.PI * 2);
    ctx.fill();
  }
}

function half(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement("canvas");
  canvas.width = w * GROUND_SCALE;
  canvas.height = h * GROUND_SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(GROUND_SCALE, GROUND_SCALE);
  draw(ctx);
  scene.textures.addCanvas(key, canvas);
}

export interface GroundKeys {
  tile: string;
  patches: string[];
  circle: string;
  mini: string;
}

/** Paint a land's floor pieces (shown at 1 / GROUND_SCALE) and its minimap. */
export function makeGround(scene: Phaser.Scene, a: Arena): GroundKeys {
  const land = a.land;
  const id = land.id;
  const keys: GroundKeys = { tile: `tile_${id}`, patches: [0, 1, 2].map((k) => `patch_${id}_${k}`), circle: `circle_${id}`, mini: `mini_${id}` };
  const rand = seeded(4242 + land.from);
  half(scene, keys.tile, TILE, TILE, (ctx) => paintTile(ctx, land, rand));
  keys.patches.forEach((k) => half(scene, k, PATCH_R * 2.8, PATCH_R * 2, (ctx) => paintPatch(ctx, land, PATCH_R * 1.4, PATCH_R, PATCH_R, rand)));
  half(scene, keys.circle, 760, 560, (ctx) => paintCircle(ctx, land));
  if (!scene.textures.exists(keys.mini)) {
    const mini = document.createElement("canvas");
    mini.width = 200;
    mini.height = 200;
    const ctx = mini.getContext("2d")!;
    const s = 200 / ARENA;
    ctx.fillStyle = rgba(land.ground);
    ctx.fillRect(0, 0, 200, 200);
    for (const p of a.patches) {
      ctx.fillStyle = rgba(land.groundLight, 0.8);
      ctx.beginPath();
      ctx.ellipse(p.x * s, p.y * s, p.r * s, p.r * s * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = rgba(darken(land.groundDark, 0.25), 0.8);
    for (const o of a.objects) {
      if (!land.trees.includes(o.tex)) continue;
      ctx.beginPath();
      ctx.arc(o.x * s, o.y * s, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    scene.textures.addCanvas(keys.mini, mini);
  }
  return keys;
}
