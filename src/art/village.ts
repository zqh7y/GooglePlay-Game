import Phaser from "phaser";
import { Theme } from "../data/areas";
import { box } from "./pets";
import { Ctx, INK, canvasTexture, celShape, circle, darken, ellipse, fill, fillOutline, lighten, outline, rgba, twinkle } from "./draw";

/**
 * Village art in the same flat, boxy cartoon style as the pets:
 * houses, barns, windmill, the fountain you defend, trees, crops, fences and props.
 */
function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function shadow(ctx: Ctx, x: number, y: number, rx: number, ry = rx * 0.22): void {
  ellipse(ctx, x, y, rx, ry);
  fill(ctx, "rgba(74,47,29,0.22)");
}

/** Boxy cel-shaded block, with a lighter top band. */
function block(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, c: number): void {
  celShape(ctx, () => box(ctx, x, y, w, h, r), rgba(c), rgba(darken(c, 0.15)), Math.min(w, h) / 2, () => {
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x - w / 2, y - h / 2, w, h * 0.14);
  });
}

function grassTile(ctx: Ctx, t: Theme): void {
  const rand = seeded(11);
  ctx.fillStyle = rgba(t.grass);
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 10; i++) {
    ellipse(ctx, rand() * 256, rand() * 256, 30 + rand() * 40, 14 + rand() * 20, rand());
    fill(ctx, rgba(lighten(t.grass, 0.18), 0.5));
  }
  for (let i = 0; i < 16; i++) {
    const x = rand() * 240 + 8;
    const y = rand() * 240 + 8;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 7);
    ctx.lineTo(x - 2, y);
    ctx.lineTo(x + 1, y - 9);
    ctx.lineTo(x + 4, y);
    ctx.lineTo(x + 8, y - 6);
    outline(ctx, 3, rgba(t.grassDark));
  }
  if (!t.snow) {
    const flowers = ["#ffffff", "#ffb3c9", "#ffe066"];
    for (let i = 0; i < 5; i++) {
      circle(ctx, rand() * 246 + 5, rand() * 246 + 5, 3.5);
      fill(ctx, flowers[i % 3]);
    }
  }
}

function house(ctx: Ctx, roof: number, wall: number, snow: boolean): void {
  const cx = 115;
  shadow(ctx, cx, 214, 96, 14);
  block(ctx, cx + 52, 58, 26, 46, 4, 0xb08a70);
  block(ctx, cx, 160, 172, 104, 10, wall);
  // roof
  celShape(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 104, 118);
    ctx.lineTo(cx - 60, 40);
    ctx.lineTo(cx + 60, 40);
    ctx.lineTo(cx + 104, 118);
    ctx.closePath();
  }, rgba(roof), rgba(darken(roof, 0.18)), 60, () => {
    for (const y of [64, 88, 112]) {
      ctx.fillStyle = rgba(darken(roof, 0.12));
      ctx.fillRect(cx - 110, y, 220, 5);
    }
  });
  if (snow) {
    ctx.beginPath();
    ctx.moveTo(cx - 70, 52);
    ctx.lineTo(cx - 60, 36);
    ctx.lineTo(cx + 60, 36);
    ctx.lineTo(cx + 74, 56);
    ctx.quadraticCurveTo(cx + 40, 66, cx + 20, 54);
    ctx.quadraticCurveTo(cx - 20, 70, cx - 70, 52);
    ctx.closePath();
    fillOutline(ctx, "#ffffff", 4);
  }
  box(ctx, cx, 182, 42, 60, 8);
  fillOutline(ctx, "#8a5a3a", 4);
  circle(ctx, cx + 11, 184, 3.5);
  fill(ctx, "#ffd23f");
  for (const x of [cx - 56, cx + 56]) {
    box(ctx, x, 156, 38, 34, 6);
    fillOutline(ctx, "#bfeaff", 4);
    ctx.fillStyle = INK;
    ctx.fillRect(x - 2, 141, 4, 30);
    ctx.fillRect(x - 17, 154, 34, 4);
    box(ctx, x, 178, 46, 10, 3);
    fillOutline(ctx, rgba(darken(roof, 0.1)), 3);
  }
}

function barn(ctx: Ctx): void {
  const cx = 125;
  shadow(ctx, cx, 236, 110, 16);
  block(ctx, cx, 168, 196, 128, 10, 0xd0453c);
  celShape(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 112, 112);
    ctx.lineTo(cx - 84, 52);
    ctx.lineTo(cx, 26);
    ctx.lineTo(cx + 84, 52);
    ctx.lineTo(cx + 112, 112);
    ctx.closePath();
  }, "#8a2f2a", "#6e2420", 60);
  box(ctx, cx, 190, 76, 84, 6);
  fillOutline(ctx, "#ffffff", 4);
  ctx.beginPath();
  ctx.moveTo(cx - 34, 152);
  ctx.lineTo(cx + 34, 228);
  ctx.moveTo(cx + 34, 152);
  ctx.lineTo(cx - 34, 228);
  outline(ctx, 6, "#d0453c");
  box(ctx, cx, 84, 36, 30, 4);
  fillOutline(ctx, "#ffffff", 4);
}

function windmillBase(ctx: Ctx): void {
  const cx = 100;
  shadow(ctx, cx, 290, 70, 12);
  celShape(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 62, 284);
    ctx.lineTo(cx - 40, 70);
    ctx.lineTo(cx + 40, 70);
    ctx.lineTo(cx + 62, 284);
    ctx.closePath();
  }, "#f0e2c8", "#d6c4a4", 60);
  celShape(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 54, 80);
    ctx.lineTo(cx, 22);
    ctx.lineTo(cx + 54, 80);
    ctx.closePath();
  }, "#8a5a3a", "#6e4429", 30);
  box(ctx, cx, 252, 34, 56, 8);
  fillOutline(ctx, "#8a5a3a", 4);
  box(ctx, cx, 160, 28, 28, 6);
  fillOutline(ctx, "#bfeaff", 4);
}

function windmillBlades(ctx: Ctx): void {
  const c = 130;
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate((i * Math.PI) / 2);
    box(ctx, 0, -66, 12, 116, 4);
    fillOutline(ctx, "#8a5a3a", 4);
    box(ctx, 16, -74, 30, 90, 4);
    fillOutline(ctx, "#fff6e4", 4);
    ctx.restore();
  }
  circle(ctx, c, c, 14);
  fillOutline(ctx, "#6e4429", 4);
}

/** The village heart players defend. */
function fountain(ctx: Ctx): void {
  const cx = 150;
  shadow(ctx, cx, 222, 130, 20);
  ellipse(ctx, cx, 176, 126, 50);
  fillOutline(ctx, "#c9c2b6", 5);
  ellipse(ctx, cx, 166, 112, 40);
  fillOutline(ctx, "#e8e2d6", 4);
  ellipse(ctx, cx, 168, 96, 30);
  fill(ctx, "#7fd3f0");
  ellipse(ctx, cx - 30, 162, 26, 7);
  fill(ctx, "rgba(255,255,255,0.6)");
  block(ctx, cx, 120, 36, 92, 8, 0xd8d0c2);
  ellipse(ctx, cx, 80, 56, 18);
  fillOutline(ctx, "#e8e2d6", 4);
  ellipse(ctx, cx, 78, 44, 11);
  fill(ctx, "#7fd3f0");
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + dir * 20, 74);
    ctx.quadraticCurveTo(cx + dir * 70, 40, cx + dir * 86, 150);
    outline(ctx, 7, "rgba(127,211,240,0.9)");
  }
  ctx.beginPath();
  ctx.moveTo(cx, 70);
  ctx.lineTo(cx, 24);
  outline(ctx, 9, "rgba(170,230,255,0.95)");
  circle(ctx, cx, 22, 10);
  fill(ctx, "#ffffff");
  for (const [x, y] of [[cx - 70, 150], [cx + 56, 182], [cx + 12, 40]]) twinkle(ctx, x, y, 8);
}

function boxTree(ctx: Ctx, leaf: number, snow: boolean, blossom: boolean): void {
  const cx = 85;
  shadow(ctx, cx, 196, 60, 12);
  block(ctx, cx, 168, 26, 50, 6, 0x9c6a43);
  const parts: [number, number, number, number][] = [[cx - 30, 106, 80, 72], [cx + 30, 106, 80, 72], [cx, 68, 100, 84]];
  for (const [x, y, w, h] of parts) block(ctx, x, y, w, h, 22, leaf);
  if (blossom) {
    const rand = seeded(5);
    for (let i = 0; i < 9; i++) {
      box(ctx, cx - 55 + rand() * 110, 40 + rand() * 90, 9, 9, 3);
      fill(ctx, "#fff0f6");
    }
  }
  if (snow) {
    for (const [x, y, w] of [[cx, 34, 80], [cx - 34, 76, 54], [cx + 34, 76, 54]]) {
      box(ctx, x, y, w, 16, 8);
      fillOutline(ctx, "#ffffff", 3.5);
    }
  }
}

function pine(ctx: Ctx, leaf: number, snow: boolean): void {
  const cx = 75;
  shadow(ctx, cx, 216, 50, 10);
  block(ctx, cx, 196, 22, 40, 5, 0x8a5a3a);
  for (const [y, w] of [[150, 130], [104, 104], [62, 74]]) {
    celShape(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, y + 30);
      ctx.lineTo(cx - w * 0.16, y - 34);
      ctx.lineTo(cx + w * 0.16, y - 34);
      ctx.lineTo(cx + w / 2, y + 30);
      ctx.closePath();
    }, rgba(leaf), rgba(darken(leaf, 0.18)), w / 2);
    if (snow) {
      box(ctx, cx, y - 30, w * 0.36, 12, 6);
      fillOutline(ctx, "#ffffff", 3);
    }
  }
}

function crop(ctx: Ctx, kind: string): void {
  const c = 32;
  shadow(ctx, c, 56, 20, 5);
  const leaf = (x: number, y: number, w: number, h: number, col = "#6fbf4a") => {
    box(ctx, x, y, w, h, w / 2);
    fillOutline(ctx, col, 3);
  };
  switch (kind) {
    case "crop_wheat":
      for (const dx of [-12, 0, 12]) {
        ctx.fillStyle = "#c9a040";
        ctx.fillRect(c + dx - 2, 24, 4, 32);
        leaf(c + dx, 20, 12, 24, "#f2cf5a");
      }
      break;
    case "crop_carrot":
      leaf(c - 8, 30, 10, 26);
      leaf(c + 8, 30, 10, 26);
      leaf(c, 24, 10, 30);
      box(ctx, c, 50, 22, 14, 6);
      fillOutline(ctx, "#ff8a3c", 3);
      break;
    case "crop_cabbage":
      block(ctx, c, 40, 46, 36, 14, 0x8fd46a);
      leaf(c, 36, 20, 18, "#b6ec8f");
      break;
    case "crop_pumpkin":
      leaf(c + 4, 18, 8, 16, "#5a8a3a");
      block(ctx, c, 40, 52, 38, 14, 0xff9a3c);
      ctx.fillStyle = "rgba(160,80,20,0.4)";
      ctx.fillRect(c - 10, 26, 4, 30);
      ctx.fillRect(c + 8, 26, 4, 30);
      break;
    case "crop_corn":
      leaf(c - 12, 34, 10, 40);
      leaf(c + 12, 34, 10, 40);
      box(ctx, c, 26, 16, 40, 8);
      fillOutline(ctx, "#ffd84a", 3);
      break;
    case "crop_mushroom":
      box(ctx, c, 46, 14, 20, 5);
      fillOutline(ctx, "#fff0d6", 3);
      box(ctx, c, 32, 44, 22, 11);
      fillOutline(ctx, "#a46cf0", 3.5);
      box(ctx, c - 8, 28, 7, 7, 3);
      fill(ctx, "#ffffff");
      break;
    case "crop_crystal":
      for (const [dx, h, col] of [[-12, 30, "#c9a8ff"], [12, 26, "#a8e4ff"], [0, 42, "#e0f6ff"]] as [number, number, string][]) {
        ctx.beginPath();
        ctx.moveTo(c + dx - 8, 54);
        ctx.lineTo(c + dx - 8, 54 - h * 0.7);
        ctx.lineTo(c + dx, 54 - h);
        ctx.lineTo(c + dx + 8, 54 - h * 0.7);
        ctx.lineTo(c + dx + 8, 54);
        ctx.closePath();
        fillOutline(ctx, col, 3);
      }
      break;
  }
}

function prop(ctx: Ctx, kind: string): void {
  switch (kind) {
    case "crate":
      shadow(ctx, 36, 66, 30, 6);
      block(ctx, 36, 40, 58, 52, 6, 0xc98a4b);
      ctx.beginPath();
      ctx.moveTo(12, 18);
      ctx.lineTo(60, 62);
      outline(ctx, 4, "rgba(74,47,29,0.5)");
      break;
    case "barrel":
      shadow(ctx, 30, 70, 26, 6);
      block(ctx, 30, 40, 48, 60, 14, 0xa86a3a);
      for (const y of [24, 56]) {
        ctx.fillStyle = "#5a5a6a";
        ctx.fillRect(7, y, 46, 5);
      }
      break;
    case "hay":
      shadow(ctx, 46, 66, 42, 7);
      block(ctx, 46, 40, 86, 52, 14, 0xf2cf5a);
      for (const x of [26, 46, 66]) {
        ctx.fillStyle = "rgba(180,130,40,0.45)";
        ctx.fillRect(x, 18, 4, 44);
      }
      break;
    case "stump":
      shadow(ctx, 34, 48, 30, 6);
      block(ctx, 34, 32, 56, 34, 8, 0x9c6a43);
      ellipse(ctx, 34, 18, 26, 8);
      fillOutline(ctx, "#e8c98f", 3.5);
      break;
    case "rock":
      shadow(ctx, 38, 50, 34, 6);
      block(ctx, 38, 32, 70, 40, 14, 0xb0b4bc);
      break;
    case "snowman":
      shadow(ctx, 40, 106, 34, 7);
      block(ctx, 40, 80, 66, 50, 22, 0xffffff);
      block(ctx, 40, 36, 50, 44, 18, 0xffffff);
      for (const x of [32, 48]) {
        box(ctx, x, 32, 6, 8, 3);
        fill(ctx, INK);
      }
      ctx.beginPath();
      ctx.moveTo(40, 40);
      ctx.lineTo(58, 44);
      ctx.lineTo(40, 46);
      ctx.closePath();
      fillOutline(ctx, "#ff8a3c", 2.5);
      box(ctx, 40, 14, 36, 14, 4);
      fillOutline(ctx, "#e8434f", 3.5);
      break;
    case "mushroom_big":
      shadow(ctx, 50, 104, 36, 7);
      block(ctx, 50, 82, 34, 44, 10, 0xfff0d6);
      block(ctx, 50, 44, 96, 52, 22, 0xe8434f);
      for (const [x, y] of [[30, 36], [56, 30], [72, 48]]) {
        box(ctx, x, y, 12, 12, 5);
        fill(ctx, "#ffffff");
      }
      break;
    case "lamp":
      shadow(ctx, 20, 132, 18, 4);
      box(ctx, 20, 80, 10, 104, 4);
      fillOutline(ctx, "#4a4a5a", 3.5);
      box(ctx, 20, 26, 32, 30, 6);
      fillOutline(ctx, "#ffe680", 4);
      break;
  }
}

function fenceH(ctx: Ctx): void {
  for (const y of [20, 38]) {
    box(ctx, 60, y, 120, 10, 4);
    fillOutline(ctx, "#c98a4b", 3.5);
  }
  for (const x of [10, 110]) {
    box(ctx, x, 30, 14, 52, 4);
    fillOutline(ctx, "#a86a3a", 3.5);
  }
}

function fenceV(ctx: Ctx): void {
  box(ctx, 14, 60, 10, 112, 4);
  fillOutline(ctx, "#c98a4b", 3.5);
  for (const y of [14, 106]) {
    box(ctx, 14, y, 18, 30, 4);
    fillOutline(ctx, "#a86a3a", 3.5);
  }
}

/** Draw every village texture needed for a theme (each only once). */
export function makeVillageTextures(scene: Phaser.Scene, t: Theme): void {
  const key = (k: string) => (t.snow ? `${k}_snow` : k);
  canvasTexture(scene, `grass_${t.grass.toString(16)}`, 256, 256, (ctx) => grassTile(ctx, t));
  for (const roof of t.roofs) canvasTexture(scene, key(`house_${roof.toString(16)}`), 230, 230, (ctx) => house(ctx, roof, t.wall, t.snow));
  canvasTexture(scene, "barn", 250, 250, barn);
  canvasTexture(scene, "windmill", 200, 300, windmillBase);
  canvasTexture(scene, "windmill_blades", 260, 260, windmillBlades);
  canvasTexture(scene, "fountain", 300, 240, fountain);
  const trees: Record<string, (ctx: Ctx) => void> = {
    tree_green: (ctx) => boxTree(ctx, 0x6fc45a, false, false),
    tree_pink: (ctx) => boxTree(ctx, 0xf5a9c4, false, true),
    tree_orange: (ctx) => boxTree(ctx, 0xf09a3c, false, false),
    tree_yellow: (ctx) => boxTree(ctx, 0xf2cf4a, false, false),
    tree_dark: (ctx) => boxTree(ctx, 0x4f9a4f, false, false),
    tree_snowround: (ctx) => boxTree(ctx, 0x6fa88a, true, false),
    tree_pine: (ctx) => pine(ctx, 0x4f9a5a, false),
    tree_snowpine: (ctx) => pine(ctx, 0x5f9a8a, true),
  };
  for (const tr of t.trees) canvasTexture(scene, tr, tr.includes("pine") ? 150 : 170, tr.includes("pine") ? 226 : 206, trees[tr]);
  for (const c of t.crops) canvasTexture(scene, c, 64, 64, (ctx) => crop(ctx, c));
  for (const p of [...t.props, "lamp"]) {
    const size: Record<string, [number, number]> = {
      crate: [72, 72], barrel: [60, 78], hay: [92, 74], stump: [68, 54], rock: [76, 58], snowman: [80, 114], mushroom_big: [100, 112], lamp: [40, 138],
    };
    const [w, h] = size[p];
    canvasTexture(scene, p, w, h, (ctx) => prop(ctx, p));
  }
  canvasTexture(scene, "fence_h", 120, 60, fenceH);
  canvasTexture(scene, "fence_v", 28, 124, fenceV);
}

export const houseKey = (roof: number, snow: boolean) => (snow ? `house_${roof.toString(16)}_snow` : `house_${roof.toString(16)}`);
