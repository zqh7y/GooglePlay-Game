import Phaser from "phaser";
import { Ctx, canvasTexture, ellipse, fill, linear, radial, rgba, twinkle } from "./draw";

/** Height of the walkable ground strip at the bottom of the battle area. */
export const GROUND_H = 360;

function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function tree(ctx: Ctx, x: number, y: number, s: number, dark: string, light: string): void {
  ctx.fillStyle = "#6b4a3a";
  ctx.fillRect(x - 7 * s, y - 30 * s, 14 * s, 34 * s);
  for (const [dx, dy, r, c] of [[-22, -46, 26, dark], [22, -48, 26, dark], [0, -72, 32, dark], [-8, -78, 18, light], [-24, -52, 12, light]] as [number, number, number, string][]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    fill(ctx, c);
  }
}

function tuft(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(x - 12 * s, y);
  ctx.quadraticCurveTo(x - 10 * s, y - 14 * s, x - 14 * s, y - 24 * s);
  ctx.quadraticCurveTo(x - 4 * s, y - 14 * s, x - 2 * s, y - 6 * s);
  ctx.quadraticCurveTo(x, y - 20 * s, x + 2 * s, y - 30 * s);
  ctx.quadraticCurveTo(x + 6 * s, y - 16 * s, x + 6 * s, y - 6 * s);
  ctx.quadraticCurveTo(x + 10 * s, y - 16 * s, x + 16 * s, y - 22 * s);
  ctx.quadraticCurveTo(x + 12 * s, y - 10 * s, x + 12 * s, y);
  ctx.closePath();
  fill(ctx, color);
}

function drawBackground(ctx: Ctx, w: number, h: number): void {
  const rand = seeded(42);
  const groundTop = h - GROUND_H;

  // sky
  ctx.fillStyle = linear(ctx, 0, 0, 0, groundTop, [[0, "#3fa6ff"], [0.6, "#86d0ff"], [1, "#d6f3ff"]]);
  ctx.fillRect(0, 0, w, groundTop + 40);
  const sunX = w * 0.8;
  const sunY = Math.min(240, groundTop * 0.35);
  ctx.beginPath();
  ctx.arc(sunX, sunY, 220, 0, Math.PI * 2);
  fill(ctx, radial(ctx, sunX, sunY, 220, [[0, "rgba(255,250,210,0.9)"], [0.3, "rgba(255,245,200,0.35)"], [1, "rgba(255,245,200,0)"]]));
  ctx.beginPath();
  ctx.arc(sunX, sunY, 62, 0, Math.PI * 2);
  fill(ctx, "#fffbe0");

  // far mountains
  const mBase = groundTop - 60;
  ctx.beginPath();
  ctx.moveTo(0, mBase);
  const peaks: [number, number][] = [];
  for (let x = -60; x <= w + 60; x += 170) {
    const py = mBase - 140 - rand() * 120;
    peaks.push([x + 85, py]);
    ctx.lineTo(x + 85, py);
    ctx.lineTo(x + 170, mBase - 40 - rand() * 40);
  }
  ctx.lineTo(w, mBase + 80);
  ctx.lineTo(0, mBase + 80);
  ctx.closePath();
  fill(ctx, linear(ctx, 0, mBase - 260, 0, mBase, [[0, "#9db8ec"], [1, "#b9d0f5"]]));
  for (const [px, py] of peaks) {
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - 34, py + 44);
    ctx.lineTo(px - 12, py + 36);
    ctx.lineTo(px + 4, py + 48);
    ctx.lineTo(px + 34, py + 42);
    ctx.closePath();
    fill(ctx, "rgba(255,255,255,0.85)");
  }

  // rolling hills
  const hills: [string, number, number][] = [["#9fe08e", groundTop - 70, 90], ["#7fd072", groundTop - 25, 70]];
  for (const [color, base, amp] of hills) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, base);
    for (let x = 0; x <= w; x += 240) {
      ctx.quadraticCurveTo(x + 120, base - amp * (0.5 + rand() * 0.6), x + 240, base);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    fill(ctx, color);
  }

  // tree line
  for (let x = 20; x < w; x += 90 + rand() * 70) {
    tree(ctx, x, groundTop + 6, 0.7 + rand() * 0.5, "#3e9a50", "#5cbf63");
  }

  // ground
  ctx.fillStyle = linear(ctx, 0, groundTop, 0, h, [[0, "#78d860"], [1, "#4fb44a"]]);
  ctx.fillRect(0, groundTop, w, h - groundTop);
  ctx.fillStyle = "#5fc552";
  ctx.fillRect(0, groundTop, w, 10);

  // dirt path the battle happens on
  const pTop = groundTop + 50;
  const pBot = h - 34;
  ctx.beginPath();
  ctx.moveTo(0, pTop + 10);
  for (let x = 0; x <= w; x += 60) ctx.lineTo(x, pTop + Math.sin(x / 90) * 8);
  ctx.lineTo(w, pBot);
  for (let x = w; x >= 0; x -= 60) ctx.lineTo(x, pBot + Math.sin(x / 70) * 7);
  ctx.closePath();
  fill(ctx, linear(ctx, 0, pTop, 0, pBot, [[0, "#f0d79a"], [1, "#d9b26b"]]));
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgba(120,80,30,0.12)";
  ctx.fillRect(0, pTop, w, 18);
  for (let i = 0; i < 70; i++) {
    ellipse(ctx, rand() * w, pTop + 20 + rand() * (pBot - pTop - 30), 4 + rand() * 8, 3 + rand() * 4);
    fill(ctx, rand() > 0.5 ? "rgba(160,110,50,0.3)" : "rgba(255,245,210,0.45)");
  }
  ctx.restore();

  // grass tufts and flowers
  for (let i = 0; i < 26; i++) tuft(ctx, rand() * w, pTop + 6 + rand() * 6, 0.9 + rand() * 0.4, "#5cc552");
  for (let i = 0; i < 30; i++) tuft(ctx, rand() * w, h - 4 - rand() * 20, 1 + rand() * 0.6, "#3fa041");
  const flowers = ["#ffffff", "#ff8ab3", "#ffe14d", "#b48cff"];
  for (let i = 0; i < 22; i++) {
    const fx = rand() * w;
    const fy = rand() > 0.5 ? groundTop + 18 + rand() * 24 : h - 14 - rand() * 16;
    const c = flowers[Math.floor(rand() * flowers.length)];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * 6, fy + Math.sin(a) * 6, 5, 0, Math.PI * 2);
      fill(ctx, c);
    }
    ctx.beginPath();
    ctx.arc(fx, fy, 4, 0, Math.PI * 2);
    fill(ctx, "#ffb300");
  }

  // soft vignette
  ctx.fillStyle = linear(ctx, 0, 0, w, 0, [[0, "rgba(10,0,40,0.18)"], [0.12, "rgba(10,0,40,0)"], [0.88, "rgba(10,0,40,0)"], [1, "rgba(10,0,40,0.18)"]]);
  ctx.fillRect(0, 0, w, h);
  for (const [x, y] of [[w * 0.15, 90], [w * 0.4, 50], [w * 0.62, 130]]) twinkle(ctx, x, y, 5, "rgba(255,255,255,0.6)");
}

export function backgroundTexture(scene: Phaser.Scene, w: number, h: number): string {
  return canvasTexture(scene, `bg_${w}_${h}`, w, h, (ctx) => drawBackground(ctx, w, h));
}

export function makeCloudTextures(scene: Phaser.Scene): void {
  const shapes: [number, number, number][][] = [
    [[70, 80, 46], [130, 58, 60], [200, 74, 50], [250, 92, 36], [40, 98, 30]],
    [[60, 70, 36], [110, 52, 48], [165, 70, 40]],
  ];
  shapes.forEach((circles, i) => {
    const w = i === 0 ? 300 : 220;
    canvasTexture(scene, `cloud_${i}`, w, 140, (ctx) => {
      ctx.save();
      ctx.beginPath();
      for (const [x, y, r] of circles) {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.rect(circles[0][0], 80, w - circles[0][0] - 40, 40);
      ctx.fillStyle = linear(ctx, 0, 10, 0, 125, [[0, "#ffffff"], [0.7, "#f2f8ff"], [1, rgba(0xcfe3fb)]]);
      ctx.fill();
      ctx.restore();
    });
  });
}
