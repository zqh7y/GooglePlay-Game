import Phaser from "phaser";
import { ARENA, Arena } from "../game/arena";
import { darken, lighten, rgba } from "./draw";

/** The arena floor is painted once at half resolution and shown at 2x. */
export const GROUND_SCALE = 0.5;

function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

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

function paintPatches(ctx: Ctx, a: Arena, rand: () => number): void {
  const land = a.land;
  const b = new Batch();
  for (const p of a.patches) {
    switch (land.detail) {
      case "grass": {
        softBlob(ctx, p.x, p.y, p.r * 1.2, land.groundLight, 0.7);
        const colors = ["#ffffff", "#ffb3d1", "#ffe066", "#c8b8ff"];
        for (let i = 0; i < p.r / 3; i++) {
          const ang = rand() * Math.PI * 2;
          const d = Math.sqrt(rand()) * p.r;
          const fx = p.x + Math.cos(ang) * d;
          const fy = p.y + Math.sin(ang) * d * 0.7;
          b.add(colors[Math.floor(rand() * colors.length)], false, 0, () => {
            ctx.moveTo(fx + 6, fy);
            ctx.arc(fx, fy, 6, 0, Math.PI * 2);
          });
          b.add("#ffd23f", false, 0, () => {
            ctx.moveTo(fx + 2.5, fy);
            ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
          });
        }
        break;
      }
      case "wheat": {
        softBlob(ctx, p.x, p.y, p.r * 1.25, 0xe8c860, 0.9);
        for (let i = 0; i < p.r * 1.4; i++) {
          const ang = rand() * Math.PI * 2;
          const d = Math.sqrt(rand()) * p.r;
          const sx = p.x + Math.cos(ang) * d;
          const sy = p.y + Math.sin(ang) * d * 0.7;
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
      }
      case "moss":
        softBlob(ctx, p.x, p.y, p.r * 1.2, land.groundDark, 0.8);
        for (let i = 0; i < p.r / 2; i++) {
          const lx = p.x + (rand() - 0.5) * p.r * 1.6;
          const ly = p.y + (rand() - 0.5) * p.r;
          b.add(rgba(rand() < 0.5 ? 0x8a6a3a : 0x4f8a3a), false, 0, () => {
            ctx.moveTo(lx + 6, ly);
            ctx.ellipse(lx, ly, 6, 3, rand() * 3, 0, Math.PI * 2);
          });
        }
        break;
      case "sand":
        softBlob(ctx, p.x, p.y, p.r * 1.3, land.groundLight, 0.8);
        for (let i = 0; i < 5; i++) {
          const y = p.y - p.r * 0.5 + i * p.r * 0.25;
          b.add(rgba(darken(land.ground, 0.1)), true, 5, () => {
            ctx.moveTo(p.x - p.r * 0.8, y);
            ctx.quadraticCurveTo(p.x, y - 18, p.x + p.r * 0.8, y);
          });
        }
        break;
      case "snow":
        ctx.fillStyle = "#cfe8f8";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e6f6ff";
        ctx.beginPath();
        ctx.ellipse(p.x - p.r * 0.1, p.y - p.r * 0.08, p.r * 0.8, p.r * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        b.add("rgba(255,255,255,0.95)", true, 4, () => {
          ctx.moveTo(p.x - p.r * 0.5, p.y - p.r * 0.12);
          ctx.lineTo(p.x - p.r * 0.1, p.y - p.r * 0.2);
          ctx.moveTo(p.x + p.r * 0.1, p.y + p.r * 0.05);
          ctx.lineTo(p.x + p.r * 0.35, p.y);
        });
        break;
    }
  }
  b.flush(ctx);
}

function paintDetails(ctx: Ctx, a: Arena, rand: () => number): void {
  const land = a.land;
  const b = new Batch();
  for (let n = 0; n < 12000; n++) {
    const x = rand() * ARENA;
    const y = rand() * ARENA;
    if (land.detail === "sand") {
      b.add(rgba(rand() < 0.5 ? darken(land.ground, 0.08) : lighten(land.ground, 0.2)), true, 4, () => {
        ctx.moveTo(x - 16, y);
        ctx.quadraticCurveTo(x, y - 7, x + 16, y);
      });
      if (rand() < 0.1) b.add(rgba(darken(land.ground, 0.25)), false, 0, () => {
        ctx.moveTo(x + 4, y);
        ctx.arc(x, y, 4, 0, Math.PI * 2);
      });
    } else if (land.detail === "snow") {
      b.add(rand() < 0.6 ? "rgba(170,200,230,0.5)" : "#ffffff", false, 0, () => {
        ctx.moveTo(x + 6, y);
        ctx.ellipse(x, y, 4 + rand() * 7, 2.5, 0, 0, Math.PI * 2);
      });
    } else {
      const c = rgba(rand() < 0.6 ? land.groundDark : lighten(land.ground, 0.14));
      b.add(c, true, 4, () => {
        ctx.moveTo(x - 6, y);
        ctx.lineTo(x - 9, y - 12);
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - 16);
        ctx.moveTo(x + 6, y);
        ctx.lineTo(x + 9, y - 12);
      });
    }
  }
  b.flush(ctx);
}

/** A ring of flat stones around the crystal. */
function paintCircle(ctx: Ctx, a: Arena): void {
  const [cx, cy] = a.center;
  softBlob(ctx, cx, cy, 340, darken(a.land.ground, 0.12), 0.6);
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    const x = cx + Math.cos(ang) * 250;
    const y = cy + Math.sin(ang) * 190;
    ctx.fillStyle = "#7a7a86";
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 30, 20, ang, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c8c8d2";
    ctx.beginPath();
    ctx.ellipse(x, y, 28, 18, ang, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.ellipse(x - 6, y - 5, 10, 5, ang, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintPonds(ctx: Ctx, a: Arena, rand: () => number): void {
  for (const p of a.ponds) {
    ctx.fillStyle = rgba(darken(a.land.ground, 0.15));
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 8, p.rx + 26, p.ry + 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8d8a8";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx + 18, p.ry + 16, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, p.rx);
    g.addColorStop(0, "#2f86c8");
    g.addColorStop(1, "#5cc0ee");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.ellipse(p.x - p.rx * 0.25, p.y - p.ry * 0.3, p.rx * 0.35, p.ry * 0.12, -0.2, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const lx = p.x + (rand() - 0.5) * p.rx * 1.2;
      const ly = p.y + (rand() - 0.5) * p.ry * 1.0;
      ctx.fillStyle = "#4fae3a";
      ctx.beginPath();
      ctx.arc(lx, ly, 15, 0.3, Math.PI * 2 - 0.3);
      ctx.lineTo(lx, ly);
      ctx.fill();
      if (i === 0) {
        ctx.fillStyle = "#ff9ac8";
        ctx.beginPath();
        ctx.arc(lx + 4, ly - 4, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function paintEdges(ctx: Ctx, a: Arena): void {
  const shade = rgba(darken(a.land.groundDark, 0.35), 0.5);
  const clear = rgba(a.land.groundDark, 0);
  const band = 420;
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [
    [0, 0, 0, band, 0, 0, ARENA, band],
    [0, ARENA, 0, ARENA - band, 0, ARENA - band, ARENA, band],
    [0, 0, band, 0, 0, 0, band, ARENA],
    [ARENA, 0, ARENA - band, 0, ARENA - band, 0, band, ARENA],
  ]) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, shade);
    g.addColorStop(1, clear);
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  }
}

/** Paint a land's arena floor; returns texture keys for the ground and the minimap. */
export function makeGround(scene: Phaser.Scene, a: Arena): { ground: string; mini: string } {
  const keys = { ground: `ground_${a.land.id}`, mini: `mini_${a.land.id}` };
  // only keep the current land's (big) floor in memory
  for (const k of scene.textures.getTextureKeys()) {
    if ((k.startsWith("ground_") || k.startsWith("mini_")) && k !== keys.ground && k !== keys.mini) scene.textures.remove(k);
  }
  if (scene.textures.exists(keys.ground)) return keys;
  const rand = seeded(4242 + a.land.from);
  const size = ARENA * GROUND_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(GROUND_SCALE, GROUND_SCALE);
  ctx.fillStyle = rgba(a.land.ground);
  ctx.fillRect(0, 0, ARENA, ARENA);
  for (let i = 0; i < 120; i++) {
    softBlob(ctx, rand() * ARENA, rand() * ARENA, 90 + rand() * 220, rand() < 0.5 ? a.land.groundDark : a.land.groundLight, 0.45);
  }
  paintCircle(ctx, a);
  paintPatches(ctx, a, rand);
  paintDetails(ctx, a, rand);
  paintPonds(ctx, a, rand);
  paintEdges(ctx, a);
  scene.textures.addCanvas(keys.ground, canvas);
  const mini = document.createElement("canvas");
  mini.width = 200;
  mini.height = 200;
  mini.getContext("2d")!.drawImage(canvas, 0, 0, 200, 200);
  scene.textures.addCanvas(keys.mini, mini);
  return keys;
}
