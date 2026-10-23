import Phaser from "phaser";
import { Layout } from "../layout";
import { Ctx, canvasTexture, circle, ellipse, fill, linear, outline, rgba } from "./draw";

function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** A fluffy canopy: outline all circles first, then fill, so they merge into one shape. */
function canopy(ctx: Ctx, rand: () => number, x: number, y: number, size: number, pink: boolean): void {
  const base = pink ? 0xf7b6c9 : 0xbcc65c;
  const shade = pink ? 0xe993b0 : 0x9aa446;
  const hi = pink ? 0xffd9e5 : 0xd6de86;
  const edge = pink ? "#c9708f" : "#7b8636";
  const blobs: [number, number, number][] = [];
  const n = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * size * 0.55;
    blobs.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, size * (0.38 + rand() * 0.3)]);
  }
  for (const [bx, by, r] of blobs) {
    circle(ctx, bx, by, r);
    outline(ctx, 8, edge);
  }
  for (const [bx, by, r] of blobs) {
    circle(ctx, bx, by, r);
    fill(ctx, rgba(shade));
  }
  for (const [bx, by, r] of blobs) {
    circle(ctx, bx - r * 0.12, by - r * 0.16, r * 0.86);
    fill(ctx, rgba(base));
  }
  for (const [bx, by, r] of blobs.slice(0, 3)) {
    circle(ctx, bx - r * 0.3, by - r * 0.35, r * 0.3);
    fill(ctx, rgba(hi));
  }
  if (pink) {
    for (let i = 0; i < 6; i++) {
      const [bx, by, r] = blobs[Math.floor(rand() * blobs.length)];
      circle(ctx, bx + (rand() - 0.5) * r, by + (rand() - 0.5) * r, 3 + rand() * 3);
      fill(ctx, "#fff0f5");
    }
  }
}

function grassMark(ctx: Ctx, x: number, y: number, s: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(x - 6 * s, y - 8 * s);
  ctx.lineTo(x - 2 * s, y);
  ctx.lineTo(x + 1 * s, y - 10 * s);
  ctx.lineTo(x + 4 * s, y);
  ctx.lineTo(x + 8 * s, y - 7 * s);
  outline(ctx, 3 * s, color);
}

function drawMap(ctx: Ctx, w: number, L: Layout): void {
  const { H, cliffLeft, cliffRight } = L;
  const rand = seeded(7);
  const edgeY = (x: number) => cliffLeft + (cliffRight - cliffLeft) * (x / w) + Math.sin(x / 70) * 8;

  // meadow plateau
  ctx.fillStyle = linear(ctx, 0, 0, 0, cliffLeft, [[0, "#d9eda8"], [1, "#c8e296"]]);
  ctx.fillRect(0, 0, w, cliffLeft + 40);
  for (let i = 0; i < 26; i++) {
    ellipse(ctx, rand() * w, rand() * cliffLeft, 60 + rand() * 120, 30 + rand() * 50, rand());
    fill(ctx, "rgba(240,250,205,0.45)");
  }
  for (let i = 0; i < 70; i++) grassMark(ctx, rand() * w, 300 + rand() * (cliffLeft - 320), 0.9 + rand() * 0.6, "#a3c972");
  const flowers = ["#ffffff", "#ffb3c9", "#ffe066"];
  for (let i = 0; i < 40; i++) {
    circle(ctx, rand() * w, 320 + rand() * (cliffLeft - 340), 3.5);
    fill(ctx, flowers[i % 3]);
  }

  // cliff face and lower ground
  ctx.beginPath();
  ctx.moveTo(0, edgeY(0));
  for (let x = 0; x <= w; x += 30) ctx.lineTo(x, edgeY(x));
  ctx.lineTo(w, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  fill(ctx, linear(ctx, 0, cliffRight, 0, H, [[0, "#9aa652"], [1, "#86923f"]]));
  ctx.beginPath();
  ctx.moveTo(0, edgeY(0));
  for (let x = 0; x <= w; x += 30) ctx.lineTo(x, edgeY(x));
  for (let x = w; x >= 0; x -= 30) ctx.lineTo(x, edgeY(x) + 150 + Math.sin(x / 45) * 14);
  ctx.closePath();
  fill(ctx, linear(ctx, 0, cliffRight, 0, cliffLeft + 170, [[0, "#9c6a43"], [1, "#7a4f31"]]));
  for (const dy of [50, 95, 130]) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 30) {
      const y = edgeY(x) + dy + Math.sin(x / 33 + dy) * 6;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    outline(ctx, 4, "rgba(74,47,29,0.35)");
  }
  ctx.beginPath();
  for (let x = 0; x <= w; x += 30) {
    const y = edgeY(x);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  outline(ctx, 16, "#a9d46c");
  ctx.beginPath();
  for (let x = 0; x <= w; x += 30) {
    const y = edgeY(x) + 9;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  outline(ctx, 4, "#4a2f1d");
  for (let i = 0; i < 60; i++) {
    const x = rand() * w;
    grassMark(ctx, x, edgeY(x) + 190 + rand() * (H - edgeY(x) - 200), 1 + rand() * 0.5, "#7a8638");
  }

  // forest of cherry trees and bushes along the top and sides
  for (let x = -40; x < w + 80; x += 120 + rand() * 50) canopy(ctx, rand, x, 250 + rand() * 90, 95 + rand() * 40, rand() > 0.3);
  for (let x = 20; x < w; x += 170 + rand() * 80) canopy(ctx, rand, x, 400 + rand() * 80, 70 + rand() * 30, rand() > 0.45);
  for (const side of [0, w]) {
    for (let y = 520; y < L.catY - 120; y += 150 + rand() * 60) {
      canopy(ctx, rand, side + (side ? -40 : 40) + (rand() - 0.5) * 60, y, 70 + rand() * 30, rand() > 0.4);
    }
  }

  // soft vignette
  ctx.fillStyle = linear(ctx, 0, 0, w, 0, [[0, "rgba(74,47,29,0.14)"], [0.1, "rgba(74,47,29,0)"], [0.9, "rgba(74,47,29,0)"], [1, "rgba(74,47,29,0.14)"]]);
  ctx.fillRect(0, 0, w, H);
}

export function mapTexture(scene: Phaser.Scene, w: number, L: Layout): string {
  return canvasTexture(scene, `map_${w}_${L.H}`, w, L.H, (ctx) => drawMap(ctx, w, L));
}

/** Small pink petal that drifts across the field. */
export function makePetalTexture(scene: Phaser.Scene): void {
  canvasTexture(scene, "petal", 20, 14, (ctx) => {
    ellipse(ctx, 10, 7, 8, 5, 0.3);
    fill(ctx, "#ffc4d6");
  });
}
