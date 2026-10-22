import Phaser from "phaser";
import { ITEMS, Variant } from "../data/items";
import {
  Ctx, INK, boltPath, canvasTexture, darken, ellipse, fill, fillOutline, gloss, lighten, linear, outline,
  radial, rainbowGradient, rgba, shadeVolume, starPath, twinkle,
} from "./draw";

// ───────────────────────── pets ─────────────────────────

type Accessory = "pebble" | "leaf" | "ember" | "bubble" | "spark" | "frost" | "lava" | "thunder" | "void" | "crown";

interface PetArt {
  body: "slime" | "cat";
  color: number;
  acc: Accessory;
}

/** How each pet looks. Keyed by item id from data/items.ts. */
export const PET_ART: Record<string, PetArt> = {
  pebble: { body: "slime", color: 0x9ea3b5, acc: "pebble" },
  leaf: { body: "slime", color: 0x8bdc3c, acc: "leaf" },
  ember: { body: "slime", color: 0xff8a3d, acc: "ember" },
  bubble: { body: "cat", color: 0x7fd3ff, acc: "bubble" },
  spark: { body: "slime", color: 0xffd23f, acc: "spark" },
  frost: { body: "slime", color: 0x7fe8ff, acc: "frost" },
  lava: { body: "slime", color: 0xe8432e, acc: "lava" },
  thunderCat: { body: "cat", color: 0x6f7dff, acc: "thunder" },
  voidSlime: { body: "slime", color: 0x5b2a9e, acc: "void" },
  goldenCat: { body: "cat", color: 0xffc933, acc: "crown" },
};

export const PET_W = 180;
export const PET_H = 170;
export const petKey = (id: string, v: Variant) => `pet_${id}_${v}`;

const GOLD = 0xffc52e;

function bodyStyle(ctx: Ctx, color: number, variant: Variant, cx: number, cy: number, r: number): string | CanvasGradient {
  if (variant === "rainbow") return rainbowGradient(ctx, cx - r, cy - r, cx + r, cy + r);
  const c = variant === "golden" ? GOLD : color;
  return linear(ctx, cx, cy - r, cx, cy + r, [[0, rgba(lighten(c, 0.25))], [0.6, rgba(c)], [1, rgba(darken(c, 0.12))]]);
}

function eyes(ctx: Ctx, x1: number, x2: number, y: number, s = 1, glow = false): void {
  for (const x of [x1, x2]) {
    if (glow) {
      ellipse(ctx, x, y, 13 * s, 15 * s);
      fill(ctx, radial(ctx, x, y, 16 * s, [[0, "#ffffff"], [0.5, "#f3d9ff"], [1, "rgba(220,150,255,0)"]]));
      continue;
    }
    ellipse(ctx, x, y, 10 * s, 13 * s);
    fill(ctx, INK);
    ellipse(ctx, x + 3 * s, y - 5 * s, 4.2 * s, 4.6 * s);
    fill(ctx, "#ffffff");
    ellipse(ctx, x - 3 * s, y + 5 * s, 2 * s, 2 * s);
    fill(ctx, "rgba(255,255,255,0.8)");
  }
}

function blush(ctx: Ctx, x1: number, x2: number, y: number, s = 1): void {
  for (const x of [x1, x2]) {
    ellipse(ctx, x, y, 11 * s, 6.5 * s);
    fill(ctx, "rgba(255,110,150,0.45)");
  }
}

function smile(ctx: Ctx, x: number, y: number, s = 1): void {
  ctx.beginPath();
  ctx.arc(x, y, 8 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  outline(ctx, 4.5 * s);
}

function sparkles(ctx: Ctx, w: number, h: number, color: string, n = 4): void {
  const spots = [[0.12, 0.2, 13], [0.88, 0.3, 10], [0.84, 0.82, 8], [0.1, 0.72, 9], [0.5, 0.06, 8]];
  spots.slice(0, n).forEach(([x, y, r]) => twinkle(ctx, x * w, y * h, r, color));
}

function slimePath(ctx: Ctx, cx: number, top: number, base: number, half: number): void {
  ctx.beginPath();
  ctx.moveTo(cx - half + 6, base);
  ctx.bezierCurveTo(cx - half - 10, base - 55, cx - half + 22, top, cx, top);
  ctx.bezierCurveTo(cx + half - 22, top, cx + half + 10, base - 55, cx + half - 6, base);
  ctx.quadraticCurveTo(cx, base + 12, cx - half + 6, base);
  ctx.closePath();
}

function drawSlimePet(ctx: Ctx, art: PetArt, variant: Variant): void {
  const cx = PET_W / 2;
  const top = 40;
  const base = 150;
  const half = 70;
  const color = variant === "golden" ? GOLD : art.color;

  ellipse(ctx, cx, base + 8, 62, 11);
  fill(ctx, "rgba(20,0,40,0.22)");

  // accessories behind the body
  if (art.acc === "leaf") {
    ctx.beginPath();
    ctx.moveTo(cx, top + 6);
    ctx.quadraticCurveTo(cx - 4, top - 14, cx + 4, top - 24);
    outline(ctx, 9);
    ctx.beginPath();
    ctx.moveTo(cx, top + 6);
    ctx.quadraticCurveTo(cx - 4, top - 14, cx + 4, top - 24);
    outline(ctx, 4, "#3f9a2a");
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      const lx = cx + 4;
      const ly = top - 24;
      ctx.moveTo(lx, ly);
      ctx.bezierCurveTo(lx + dir * 14, ly - 22, lx + dir * 40, ly - 14, lx + dir * 44, ly + 2);
      ctx.bezierCurveTo(lx + dir * 30, ly + 10, lx + dir * 12, ly + 8, lx, ly);
      fillOutline(ctx, linear(ctx, lx, ly - 20, lx, ly + 10, [[0, "#9cf05a"], [1, "#3fae2f"]]), 4.5);
      ctx.beginPath();
      ctx.moveTo(lx + dir * 4, ly - 1);
      ctx.quadraticCurveTo(lx + dir * 22, ly - 10, lx + dir * 38, ly);
      outline(ctx, 2.5, "rgba(38,24,63,0.5)");
    }
  }
  if (art.acc === "void") {
    ellipse(ctx, cx, top - 12, 34, 9);
    outline(ctx, 10, INK);
    ellipse(ctx, cx, top - 12, 34, 9);
    outline(ctx, 5, "#f0c8ff");
  }

  // body
  slimePath(ctx, cx, top, base, half);
  fill(ctx, bodyStyle(ctx, art.color, variant, cx, (top + base) / 2, half));
  slimePath(ctx, cx, top, base, half);
  shadeVolume(ctx, cx, (top + base) / 2 + 5, half);

  // patterns clipped to the body
  ctx.save();
  slimePath(ctx, cx, top, base, half);
  ctx.clip();
  if (art.acc === "pebble") {
    for (const [x, y, r] of [[-38, 62, 9], [30, 118, 11], [44, 70, 6], [-22, 128, 7]]) {
      ellipse(ctx, cx + x, y, r, r * 0.8);
      fill(ctx, rgba(darken(color, 0.22), 0.7));
    }
  }
  if (art.acc === "lava") {
    ctx.shadowColor = "#ffb02e";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(cx - 52, 96); ctx.lineTo(cx - 34, 108); ctx.lineTo(cx - 40, 128);
    ctx.moveTo(cx + 54, 84); ctx.lineTo(cx + 36, 100); ctx.lineTo(cx + 44, 120); ctx.lineTo(cx + 30, 140);
    ctx.moveTo(cx - 10, 52); ctx.lineTo(cx + 6, 60);
    outline(ctx, 5, "#ffcf3a");
    ctx.shadowBlur = 0;
  }
  if (art.acc === "void") {
    for (const [x, y, r] of [[-40, 70, 6], [36, 60, 5], [42, 122, 7], [-30, 130, 5], [8, 50, 4], [-54, 104, 4]]) {
      twinkle(ctx, cx + x, y, r, "rgba(255,230,255,0.9)");
    }
  }
  if (art.acc === "frost") {
    for (const [x, y] of [[-44, 112], [46, 96], [26, 132]]) twinkle(ctx, cx + x, y, 7, "rgba(255,255,255,0.85)");
  }
  // bottom inner shadow
  ellipse(ctx, cx, base + 6, half, 22);
  fill(ctx, "rgba(20,0,40,0.18)");
  ctx.restore();

  slimePath(ctx, cx, top, base, half);
  outline(ctx, 6.5);

  // face
  const ey = 98;
  eyes(ctx, cx - 24, cx + 24, ey, 1, art.acc === "void");
  blush(ctx, cx - 42, cx + 42, ey + 18);
  smile(ctx, cx, ey + 10);
  gloss(ctx, cx - 36, top + 28, 15, 9);

  // accessories in front
  if (art.acc === "pebble") {
    ellipse(ctx, cx + 30, top + 4, 16, 11, 0.2);
    fillOutline(ctx, linear(ctx, 0, top - 8, 0, top + 16, [[0, "#d7dae6"], [1, "#8d93a8"]]), 4.5);
    ellipse(ctx, cx + 25, top, 5, 3, 0.2);
    fill(ctx, "rgba(255,255,255,0.8)");
  }
  if (art.acc === "ember") {
    const fx = cx + 2;
    const fy = top + 8;
    ctx.beginPath();
    ctx.moveTo(fx - 22, fy);
    ctx.bezierCurveTo(fx - 30, fy - 24, fx - 8, fy - 30, fx - 6, fy - 52);
    ctx.bezierCurveTo(fx + 4, fy - 36, fx + 12, fy - 40, fx + 14, fy - 58);
    ctx.bezierCurveTo(fx + 34, fy - 34, fx + 30, fy - 10, fx + 22, fy);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, fy - 58, 0, fy, [[0, "#ffe066"], [0.5, "#ff9a2e"], [1, "#ff5a1f"]]), 5);
    ctx.beginPath();
    ctx.moveTo(fx - 8, fy);
    ctx.bezierCurveTo(fx - 12, fy - 14, fx, fy - 18, fx + 4, fy - 30);
    ctx.bezierCurveTo(fx + 16, fy - 16, fx + 14, fy - 6, fx + 10, fy);
    ctx.closePath();
    fill(ctx, "#fff3a8");
  }
  if (art.acc === "spark") {
    ctx.beginPath();
    ctx.moveTo(cx + 6, top + 4);
    ctx.quadraticCurveTo(cx + 12, top - 16, cx + 4, top - 26);
    outline(ctx, 9);
    ctx.beginPath();
    ctx.moveTo(cx + 6, top + 4);
    ctx.quadraticCurveTo(cx + 12, top - 16, cx + 4, top - 26);
    outline(ctx, 4, "#a8a8c0");
    boltPath(ctx, cx + 4, top - 36, 18);
    fillOutline(ctx, linear(ctx, 0, top - 54, 0, top - 18, [[0, "#fffbd0"], [1, "#ffcf1f"]]), 4);
    for (const [x, y, a] of [[-78, 70, -0.6], [78, 64, 0.6], [-80, 120, 0.4]]) {
      ctx.save();
      ctx.translate(cx + x, y);
      ctx.rotate(a);
      boltPath(ctx, 0, 0, 11);
      fill(ctx, "#fff27a");
      ctx.restore();
    }
  }
  if (art.acc === "frost") {
    const crystals: [number, number, number][] = [[-26, 16, 26], [0, 22, 38], [26, 16, 26]];
    for (const [dx, w, h] of crystals) {
      const x = cx + dx;
      const y = top + 10 - Math.abs(dx) * 0.25;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x, y - h);
      ctx.lineTo(x + w / 2, y);
      ctx.lineTo(x, y + 8);
      ctx.closePath();
      fillOutline(ctx, linear(ctx, x - w / 2, y - h, x + w / 2, y, [[0, "#ffffff"], [0.5, "#bff4ff"], [1, "#5cc8f0"]]), 4.5);
    }
  }
  if (art.acc === "lava") {
    ctx.beginPath();
    ctx.moveTo(cx + 48, 118);
    ctx.quadraticCurveTo(cx + 62, 132, cx + 56, 146);
    ctx.quadraticCurveTo(cx + 48, 150, cx + 46, 138);
    ctx.closePath();
    fillOutline(ctx, "#ffb02e", 4);
    ellipse(ctx, cx - 6, top + 2, 20, 12, -0.1);
    fillOutline(ctx, linear(ctx, 0, top - 10, 0, top + 14, [[0, "#6b5a6e"], [1, "#3a2c40"]]), 4.5);
    ellipse(ctx, cx - 10, top - 1, 6, 3);
    fill(ctx, "#ff9a2e");
  }

  if (variant !== "normal") sparkles(ctx, PET_W, PET_H, variant === "golden" ? "#fff6b0" : "#ffffff", 5);
}

function catEar(ctx: Ctx, x: number, y: number, dir: number, color: number, variant: Variant, cx: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + 18);
  ctx.lineTo(x + dir * 10, y - 34);
  ctx.lineTo(x + dir * 44, y);
  ctx.closePath();
  fill(ctx, bodyStyle(ctx, color, variant, cx, y, 50));
  outline(ctx, 6);
  ctx.beginPath();
  ctx.moveTo(x + dir * 8, y + 8);
  ctx.lineTo(x + dir * 13, y - 18);
  ctx.lineTo(x + dir * 32, y + 2);
  ctx.closePath();
  fill(ctx, "rgba(255,150,180,0.85)");
}

function drawCatPet(ctx: Ctx, art: PetArt, variant: Variant): void {
  const cx = PET_W / 2;
  const color = variant === "golden" ? GOLD : art.color;

  ellipse(ctx, cx, 160, 58, 9);
  fill(ctx, "rgba(20,0,40,0.22)");

  // tail
  ctx.beginPath();
  ctx.moveTo(cx + 34, 140);
  ctx.bezierCurveTo(cx + 78, 140, cx + 80, 96, cx + 62, 88);
  outline(ctx, 20);
  ctx.beginPath();
  ctx.moveTo(cx + 34, 140);
  ctx.bezierCurveTo(cx + 78, 140, cx + 80, 96, cx + 62, 88);
  ctx.strokeStyle = bodyStyle(ctx, color, variant, cx + 60, 110, 40);
  ctx.lineWidth = 12;
  ctx.stroke();

  // body
  ellipse(ctx, cx, 128, 46, 32);
  fill(ctx, bodyStyle(ctx, color, variant, cx, 128, 46));
  ellipse(ctx, cx, 128, 46, 32);
  shadeVolume(ctx, cx, 128, 46);
  ellipse(ctx, cx, 128, 46, 32);
  outline(ctx, 6);
  ellipse(ctx, cx, 134, 24, 18);
  fill(ctx, rgba(lighten(color, 0.6), 0.9));
  for (const dx of [-20, 20]) {
    ellipse(ctx, cx + dx, 156, 14, 9);
    fillOutline(ctx, rgba(lighten(color, 0.3)), 5);
  }

  // head
  catEar(ctx, cx - 50, 50, 1, art.color, variant, cx);
  catEar(ctx, cx + 50, 50, -1, art.color, variant, cx);
  ellipse(ctx, cx, 76, 62, 50);
  fill(ctx, bodyStyle(ctx, art.color, variant, cx, 76, 62));
  ellipse(ctx, cx, 76, 62, 50);
  shadeVolume(ctx, cx, 76, 62, 0.8);
  if (art.acc === "thunder") {
    ctx.save();
    ellipse(ctx, cx, 76, 62, 50);
    ctx.clip();
    for (const [x, y, s] of [[-44, 92, 12], [46, 94, 12]]) {
      boltPath(ctx, cx + x, y, s);
      fill(ctx, "rgba(255,230,90,0.95)");
    }
    ctx.restore();
  }
  ellipse(ctx, cx, 76, 62, 50);
  outline(ctx, 6.5);

  // face
  eyes(ctx, cx - 24, cx + 24, 80, 1.05);
  blush(ctx, cx - 42, cx + 42, 96);
  ctx.beginPath();
  ctx.moveTo(cx - 6, 90);
  ctx.lineTo(cx + 6, 90);
  ctx.lineTo(cx, 97);
  ctx.closePath();
  fill(ctx, "#ff7aa2");
  ctx.beginPath();
  ctx.arc(cx - 6, 98, 6, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.moveTo(cx + 12, 98);
  ctx.arc(cx + 6, 98, 6, 0.1 * Math.PI, 0.9 * Math.PI);
  outline(ctx, 3.5);
  ctx.globalAlpha = 0.55;
  for (const dir of [-1, 1]) {
    for (const dy of [-4, 6]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 46, 92 + dy * 0.4);
      ctx.lineTo(cx + dir * 74, 88 + dy);
      outline(ctx, 2.5);
    }
  }
  ctx.globalAlpha = 1;
  gloss(ctx, cx - 34, 52, 14, 8);

  if (art.acc === "thunder") {
    boltPath(ctx, cx, 46, 16);
    fillOutline(ctx, linear(ctx, 0, 30, 0, 62, [[0, "#fffbd0"], [1, "#ffcf1f"]]), 4);
  }
  if (art.acc === "bubble") {
    ctx.beginPath();
    ctx.arc(cx - 62, 122, 22, 0, Math.PI * 2);
    fill(ctx, radial(ctx, cx - 62, 122, 22, [[0, "rgba(255,255,255,0.05)"], [0.75, "rgba(200,240,255,0.35)"], [1, "rgba(255,255,255,0.8)"]]));
    ctx.beginPath();
    ctx.arc(cx - 62, 122, 22, 0, Math.PI * 2);
    outline(ctx, 3, "rgba(38,24,63,0.6)");
    gloss(ctx, cx - 70, 113, 6, 4, -0.6, 0.9);
    ctx.beginPath();
    ctx.arc(cx - 40, 30, 9, 0, Math.PI * 2);
    fill(ctx, "rgba(220,245,255,0.5)");
    ctx.beginPath();
    ctx.arc(cx - 40, 30, 9, 0, Math.PI * 2);
    outline(ctx, 2.5, "rgba(38,24,63,0.5)");
  }
  if (art.acc === "crown") {
    const y = 30;
    ctx.beginPath();
    ctx.moveTo(cx - 30, y + 8);
    ctx.lineTo(cx - 34, y - 22);
    ctx.lineTo(cx - 16, y - 6);
    ctx.lineTo(cx, y - 30);
    ctx.lineTo(cx + 16, y - 6);
    ctx.lineTo(cx + 34, y - 22);
    ctx.lineTo(cx + 30, y + 8);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, y - 30, 0, y + 8, [[0, "#fff3a0"], [1, "#f0a400"]]), 5);
    for (const [dx, c] of [[-16, "#ff4f6d"], [0, "#4fc3ff"], [16, "#5ef08a"]] as [number, string][]) {
      ctx.beginPath();
      ctx.arc(cx + dx, y + 1, 4.5, 0, Math.PI * 2);
      fillOutline(ctx, c, 2.5);
    }
  }

  if (variant !== "normal" || art.acc === "crown") sparkles(ctx, PET_W, PET_H, variant === "rainbow" ? "#ffffff" : "#fff6b0", 5);
}

export function makePetTextures(scene: Phaser.Scene): void {
  for (const id of Object.keys(ITEMS)) {
    const art = PET_ART[id];
    for (const v of ["normal", "golden", "rainbow"] as Variant[]) {
      canvasTexture(scene, petKey(id, v), PET_W, PET_H, (ctx) => (art.body === "cat" ? drawCatPet(ctx, art, v) : drawSlimePet(ctx, art, v)));
    }
    // dark silhouette for undiscovered pets in the collection
    canvasTexture(scene, `pet_${id}_locked`, PET_W, PET_H, (ctx) => {
      ctx.drawImage(scene.textures.get(petKey(id, "normal")).getSourceImage() as HTMLCanvasElement, 0, 0);
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "#2c2f66";
      ctx.fillRect(0, 0, PET_W, PET_H);
    });
  }
}

// ───────────────────────── hero ─────────────────────────

export const HERO_W = 260;
export const HERO_H = 210;
/** Where the blaster muzzle is, relative to the hero's feet (origin 0.5, 0.94). */
export const HERO_MUZZLE = { x: 108, y: -65 };

function drawHero(ctx: Ctx): void {
  const orange = 0xff9f3a;
  const cream = "#fff1d6";
  const body = (cx: number, cy: number, r: number) =>
    linear(ctx, cx, cy - r, cx, cy + r, [[0, rgba(lighten(orange, 0.25))], [0.6, rgba(orange)], [1, rgba(darken(orange, 0.1))]]);

  ellipse(ctx, 112, 198, 80, 11);
  fill(ctx, "rgba(20,0,40,0.25)");

  // headband tails (behind)
  for (const [dy, len] of [[0, 1], [16, 0.8]]) {
    ctx.beginPath();
    ctx.moveTo(58, 62 + dy * 0.3);
    ctx.bezierCurveTo(30, 52 + dy, 20, 76 + dy, 4 + (1 - len) * 30, 66 + dy);
    ctx.lineTo(10 + (1 - len) * 30, 82 + dy);
    ctx.bezierCurveTo(26, 90 + dy, 36, 70 + dy, 60, 76 + dy * 0.3);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, 50, 0, 100, [[0, "#ff5a5a"], [1, "#c81e3a"]]), 5);
  }

  // tail
  ctx.beginPath();
  ctx.moveTo(70, 168);
  ctx.bezierCurveTo(22, 176, 14, 128, 34, 104);
  outline(ctx, 26);
  ctx.beginPath();
  ctx.moveTo(70, 168);
  ctx.bezierCurveTo(22, 176, 14, 128, 34, 104);
  ctx.strokeStyle = body(40, 140, 40);
  ctx.lineWidth = 16;
  ctx.stroke();
  for (const [x, y] of [[30, 150], [24, 128]]) {
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x + 8, y - 3);
    outline(ctx, 5, rgba(darken(orange, 0.3)));
  }

  // feet
  for (const x of [82, 136]) {
    ellipse(ctx, x, 188, 22, 12);
    fillOutline(ctx, rgba(lighten(orange, 0.15)), 5.5);
  }

  // body
  ellipse(ctx, 108, 150, 54, 44);
  fill(ctx, body(108, 150, 54));
  ellipse(ctx, 108, 150, 54, 44);
  shadeVolume(ctx, 108, 150, 54);
  ellipse(ctx, 108, 150, 54, 44);
  outline(ctx, 6.5);
  ellipse(ctx, 124, 158, 28, 28);
  fill(ctx, cream);

  // ears
  const ear = (x1: number, x2: number, x3: number, tipY: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, 52);
    ctx.lineTo(x2, tipY);
    ctx.lineTo(x3, 38);
    ctx.closePath();
    fillOutline(ctx, body(x2, 30, 40), 6);
    ctx.beginPath();
    ctx.moveTo(x1 + (x3 - x1) * 0.2, 46);
    ctx.lineTo(x2, tipY + 14);
    ctx.lineTo(x3 - (x3 - x1) * 0.2, 40);
    ctx.closePath();
    fill(ctx, "rgba(255,150,180,0.85)");
  };
  ear(56, 66, 100, 2);
  ear(126, 160, 168, 4);

  // head
  ellipse(ctx, 116, 82, 66, 56);
  fill(ctx, body(116, 82, 66));
  ellipse(ctx, 116, 82, 66, 56);
  shadeVolume(ctx, 116, 82, 66, 0.8);
  // tabby stripes
  ctx.save();
  ellipse(ctx, 116, 82, 66, 56);
  ctx.clip();
  for (const [x, y, a] of [[100, 30, 0.1], [118, 28, 0], [136, 30, -0.1]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ellipse(ctx, 0, 0, 5, 14);
    fill(ctx, rgba(darken(orange, 0.25)));
    ctx.restore();
  }
  for (const y of [86, 100]) {
    ctx.beginPath();
    ctx.moveTo(48, y);
    ctx.lineTo(66, y + 3);
    outline(ctx, 6, rgba(darken(orange, 0.25)));
  }
  ctx.restore();
  ellipse(ctx, 116, 82, 66, 56);
  outline(ctx, 6.5);

  // headband
  ctx.beginPath();
  ctx.moveTo(54, 66);
  ctx.quadraticCurveTo(110, 40, 178, 58);
  ctx.lineTo(180, 74);
  ctx.quadraticCurveTo(110, 56, 56, 82);
  ctx.closePath();
  fillOutline(ctx, linear(ctx, 0, 44, 0, 82, [[0, "#ff6b6b"], [1, "#d42a45"]]), 5);
  ctx.beginPath();
  ctx.moveTo(112, 56);
  ctx.lineTo(132, 56);
  outline(ctx, 4, "rgba(255,255,255,0.6)");

  // muzzle & face (looking right)
  ellipse(ctx, 150, 104, 30, 20);
  fill(ctx, cream);
  ellipse(ctx, 124, 90, 10, 13);
  fill(ctx, INK);
  ellipse(ctx, 166, 88, 8, 12);
  fill(ctx, INK);
  for (const [x, y, r] of [[127, 85, 4.4], [168, 83, 3.6]]) {
    ellipse(ctx, x, y, r, r * 1.1);
    fill(ctx, "#ffffff");
  }
  // determined brows
  ctx.beginPath();
  ctx.moveTo(112, 70);
  ctx.lineTo(134, 74);
  ctx.moveTo(158, 72);
  ctx.lineTo(176, 68);
  outline(ctx, 5);
  ctx.beginPath();
  ctx.moveTo(156, 98);
  ctx.lineTo(168, 97);
  ctx.lineTo(162, 105);
  ctx.closePath();
  fill(ctx, "#ff7aa2");
  ctx.beginPath();
  ctx.moveTo(150, 112);
  ctx.quadraticCurveTo(158, 118, 166, 111);
  outline(ctx, 4);
  ellipse(ctx, 104, 106, 11, 6.5);
  fill(ctx, "rgba(255,110,150,0.45)");
  gloss(ctx, 84, 50, 13, 7);

  // blaster
  const gx = 130;
  const gy = 122;
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(-0.06);
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(70, 0);
  ctx.lineTo(80, 10);
  ctx.lineTo(80, 30);
  ctx.lineTo(4, 34);
  ctx.closePath();
  fillOutline(ctx, linear(ctx, 0, 0, 0, 34, [[0, "#7f8db8"], [0.5, "#4f5c86"], [1, "#323a5c"]]), 5);
  ctx.beginPath();
  ctx.rect(78, 8, 28, 18);
  fillOutline(ctx, linear(ctx, 0, 8, 0, 26, [[0, "#6d7aa6"], [1, "#363f63"]]), 4.5);
  ctx.beginPath();
  ctx.rect(10, 8, 48, 7);
  fill(ctx, "#ff9a1f");
  ctx.beginPath();
  ctx.rect(26, 20, 22, 8);
  fill(ctx, "#5ff0ff");
  ctx.shadowColor = "#5ff0ff";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(108, 17, 8, 0, Math.PI * 2);
  fillOutline(ctx, "#bffbff", 4);
  ctx.shadowBlur = 0;
  ctx.restore();
  // paws on the gun
  for (const [x, y] of [[140, 156], [186, 146]]) {
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    fillOutline(ctx, rgba(lighten(orange, 0.2)), 5);
  }
}

// ───────────────────────── enemies (face left) ─────────────────────────

function angryEyes(ctx: Ctx, x1: number, x2: number, y: number, s = 1, pupil = INK): void {
  for (const x of [x1, x2]) {
    ellipse(ctx, x, y, 11 * s, 12 * s);
    fillOutline(ctx, "#ffffff", 4 * s);
    ellipse(ctx, x - 4 * s, y + 2 * s, 5.5 * s, 6.5 * s);
    fill(ctx, pupil);
  }
  ctx.beginPath();
  ctx.moveTo(x1 - 14 * s, y - 16 * s);
  ctx.lineTo(x1 + 10 * s, y - 9 * s);
  ctx.moveTo(x2 - 10 * s, y - 9 * s);
  ctx.lineTo(x2 + 14 * s, y - 16 * s);
  outline(ctx, 6 * s);
}

function fangMouth(ctx: Ctx, x: number, y: number, w: number, s = 1): void {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y + 18 * s, x + w / 2, y);
  ctx.closePath();
  fillOutline(ctx, "#5a1030", 4 * s);
  for (const dx of [-w / 4, w / 4]) {
    ctx.beginPath();
    ctx.moveTo(x + dx - 5 * s, y + 1);
    ctx.lineTo(x + dx, y + 10 * s);
    ctx.lineTo(x + dx + 5 * s, y + 1);
    ctx.closePath();
    fill(ctx, "#ffffff");
  }
}

function drawEvilSlime(ctx: Ctx): void {
  const cx = 74;
  const color = 0x9b5cf0;
  ellipse(ctx, cx, 124, 60, 9);
  fill(ctx, "rgba(20,0,40,0.25)");
  slimePath(ctx, cx, 26, 118, 66);
  fill(ctx, linear(ctx, 0, 26, 0, 118, [[0, rgba(lighten(color, 0.25))], [1, rgba(darken(color, 0.15))]]));
  slimePath(ctx, cx, 26, 118, 66);
  shadeVolume(ctx, cx, 72, 66);
  // drips
  for (const [x, h] of [[cx - 40, 10], [cx + 30, 14]]) {
    ellipse(ctx, x, 118 + h / 2, 6, h);
    fill(ctx, rgba(darken(color, 0.1)));
  }
  slimePath(ctx, cx, 26, 118, 66);
  outline(ctx, 6.5);
  angryEyes(ctx, cx - 24, cx + 14, 72);
  fangMouth(ctx, cx - 6, 92, 34);
  gloss(ctx, cx + 30, 46, 12, 7, 0.5, 0.6);
}

function drawBat(ctx: Ctx): void {
  const cx = 85;
  const cy = 56;
  const wing = (dir: number) => {
    ctx.beginPath();
    ctx.moveTo(cx + dir * 18, cy - 8);
    ctx.quadraticCurveTo(cx + dir * 50, cy - 46, cx + dir * 82, cy - 26);
    ctx.quadraticCurveTo(cx + dir * 74, cy - 6, cx + dir * 80, cy + 10);
    ctx.quadraticCurveTo(cx + dir * 64, cy + 2, cx + dir * 56, cy + 18);
    ctx.quadraticCurveTo(cx + dir * 42, cy + 6, cx + dir * 30, cy + 20);
    ctx.quadraticCurveTo(cx + dir * 24, cy + 8, cx + dir * 14, cy + 10);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, cy - 40, 0, cy + 20, [[0, "#6d4bb0"], [1, "#3b2670"]]), 5.5);
    ctx.beginPath();
    ctx.moveTo(cx + dir * 22, cy - 6);
    ctx.lineTo(cx + dir * 56, cy + 14);
    ctx.moveTo(cx + dir * 30, cy - 14);
    ctx.lineTo(cx + dir * 76, cy + 6);
    outline(ctx, 2.5, "rgba(38,24,63,0.6)");
  };
  wing(-1);
  wing(1);
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + dir * 6, cy - 20);
    ctx.lineTo(cx + dir * 18, cy - 42);
    ctx.lineTo(cx + dir * 24, cy - 14);
    ctx.closePath();
    fillOutline(ctx, "#5a3d96", 5);
  }
  ellipse(ctx, cx, cy, 30, 27);
  fill(ctx, linear(ctx, 0, cy - 27, 0, cy + 27, [[0, "#8a68d0"], [1, "#4a3188"]]));
  ellipse(ctx, cx, cy, 30, 27);
  shadeVolume(ctx, cx, cy, 30);
  ellipse(ctx, cx, cy, 30, 27);
  outline(ctx, 6);
  for (const x of [cx - 12, cx + 6]) {
    ctx.save();
    ctx.shadowColor = "#ff3355";
    ctx.shadowBlur = 10;
    ellipse(ctx, x, cy - 4, 6, 7);
    fill(ctx, "#ff4d6d");
    ctx.restore();
    ellipse(ctx, x - 1, cy - 6, 2, 2);
    fill(ctx, "#fff");
  }
  fangMouth(ctx, cx - 4, cy + 10, 20, 0.8);
}

function drawZombie(ctx: Ctx, king: boolean): void {
  const skin = king ? 0x7fae4a : 0x8fcf5a;
  const skinFill = (y0: number, y1: number) => linear(ctx, 0, y0, 0, y1, [[0, rgba(lighten(skin, 0.2))], [1, rgba(darken(skin, 0.12))]]);
  if (king) {
    // cape
    ctx.beginPath();
    ctx.moveTo(56, 92);
    ctx.lineTo(100, 92);
    ctx.lineTo(118, 198);
    ctx.quadraticCurveTo(80, 206, 40, 198);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, 92, 0, 200, [[0, "#c0264f"], [1, "#6e0f2c"]]), 5.5);
  }
  ellipse(ctx, 74, 206, 46, 8);
  fill(ctx, "rgba(20,0,40,0.25)");
  // legs
  for (const [x, a] of [[60, 0.08], [88, -0.08]]) {
    ctx.save();
    ctx.translate(x, 160);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.rect(-10, 0, 20, 36);
    fillOutline(ctx, "#3b3f6e", 5);
    ellipse(ctx, -4, 40, 15, 8);
    fillOutline(ctx, "#5b3b2a", 5);
    ctx.restore();
  }
  // back arm
  ctx.beginPath();
  ctx.moveTo(78, 104);
  ctx.lineTo(18, 98);
  ctx.lineTo(18, 114);
  ctx.lineTo(78, 120);
  ctx.closePath();
  fillOutline(ctx, skinFill(96, 120), 5);
  // torso
  ctx.beginPath();
  ctx.moveTo(48, 92);
  ctx.lineTo(100, 92);
  ctx.lineTo(104, 164);
  ctx.lineTo(90, 158);
  ctx.lineTo(80, 168);
  ctx.lineTo(68, 158);
  ctx.lineTo(56, 168);
  ctx.lineTo(44, 160);
  ctx.closePath();
  fillOutline(ctx, linear(ctx, 0, 92, 0, 168, [[0, king ? "#7b4bd6" : "#3fb5ac"], [1, king ? "#4a2a8f" : "#2a7d77"]]), 5.5);
  ctx.beginPath();
  ctx.moveTo(60, 120);
  ctx.lineTo(70, 128);
  ctx.lineTo(64, 136);
  outline(ctx, 3, "rgba(38,24,63,0.6)");
  // front arm reaching left
  ctx.beginPath();
  ctx.moveTo(70, 112);
  ctx.lineTo(8, 112);
  ctx.quadraticCurveTo(0, 120, 8, 128);
  ctx.lineTo(70, 130);
  ctx.closePath();
  fillOutline(ctx, skinFill(110, 130), 5);
  // head
  ellipse(ctx, 72, 60, 40, 38);
  fill(ctx, skinFill(22, 98));
  ellipse(ctx, 72, 60, 40, 38);
  shadeVolume(ctx, 72, 60, 40);
  ellipse(ctx, 72, 60, 40, 38);
  outline(ctx, 6);
  // stitches
  ctx.beginPath();
  ctx.moveTo(88, 34);
  ctx.lineTo(102, 52);
  outline(ctx, 3.5);
  for (const t of [0.3, 0.65]) {
    const x = 88 + 14 * t;
    const y = 34 + 18 * t;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 4);
    ctx.lineTo(x + 5, y - 4);
    outline(ctx, 3);
  }
  // hair tuft
  ctx.beginPath();
  ctx.moveTo(50, 30);
  ctx.quadraticCurveTo(60, 8, 74, 22);
  ctx.quadraticCurveTo(82, 4, 94, 26);
  ctx.quadraticCurveTo(80, 24, 72, 30);
  ctx.closePath();
  fillOutline(ctx, "#4a3a5c", 4.5);
  // face (looking left)
  ellipse(ctx, 52, 58, 12, 13);
  fillOutline(ctx, "#fffbe0", 4);
  ellipse(ctx, 48, 60, 5, 5);
  fill(ctx, "#d62d4f");
  ellipse(ctx, 76, 56, 8, 8);
  fillOutline(ctx, "#fffbe0", 4);
  ellipse(ctx, 73, 57, 3.5, 3.5);
  fill(ctx, "#d62d4f");
  ctx.beginPath();
  ctx.moveTo(42, 80);
  ctx.lineTo(70, 82);
  outline(ctx, 5);
  for (const x of [48, 56, 64]) {
    ctx.beginPath();
    ctx.moveTo(x, 77);
    ctx.lineTo(x, 85);
    outline(ctx, 2.5);
  }
  if (king) {
    const y = 20;
    ctx.beginPath();
    ctx.moveTo(46, y + 6);
    ctx.lineTo(42, y - 22);
    ctx.lineTo(58, y - 6);
    ctx.lineTo(72, y - 30);
    ctx.lineTo(86, y - 6);
    ctx.lineTo(102, y - 22);
    ctx.lineTo(98, y + 6);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, y - 30, 0, y + 6, [[0, "#fff3a0"], [1, "#f0a400"]]), 5);
    ctx.beginPath();
    ctx.arc(72, y - 2, 5, 0, Math.PI * 2);
    fillOutline(ctx, "#ff4f6d", 2.5);
  }
}

// ───────────────────────── effects ─────────────────────────

export function makeCharacterTextures(scene: Phaser.Scene): void {
  makePetTextures(scene);
  canvasTexture(scene, "hero", HERO_W, HERO_H, drawHero);
  canvasTexture(scene, "e_slime", 148, 136, drawEvilSlime);
  canvasTexture(scene, "e_bat", 170, 100, drawBat);
  canvasTexture(scene, "e_zombie", 130, 216, (ctx) => drawZombie(ctx, false));
  canvasTexture(scene, "e_boss", 130, 216, (ctx) => drawZombie(ctx, true));

  canvasTexture(scene, "orb", 64, 64, (ctx) => {
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    fill(ctx, radial(ctx, 32, 32, 30, [[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,255,255,0.95)"], [0.6, "rgba(255,255,255,0.45)"], [1, "rgba(255,255,255,0)"]]));
  });
  canvasTexture(scene, "bolt", 72, 30, (ctx) => {
    ctx.shadowColor = "#5ff0ff";
    ctx.shadowBlur = 12;
    ellipse(ctx, 36, 15, 28, 8);
    fill(ctx, "#7ff6ff");
    ctx.shadowBlur = 0;
    ellipse(ctx, 40, 15, 20, 4);
    fill(ctx, "#ffffff");
  });
  canvasTexture(scene, "spark", 48, 48, (ctx) => twinkle(ctx, 24, 24, 22));
  canvasTexture(scene, "puff", 40, 40, (ctx) => {
    ctx.beginPath();
    ctx.arc(20, 20, 18, 0, Math.PI * 2);
    fill(ctx, radial(ctx, 20, 20, 18, [[0, "rgba(255,255,255,1)"], [0.7, "rgba(255,255,255,0.8)"], [1, "rgba(255,255,255,0)"]]));
  });
  canvasTexture(scene, "ring", 160, 160, (ctx) => {
    ctx.beginPath();
    ctx.arc(80, 80, 70, 0, Math.PI * 2);
    outline(ctx, 12, "rgba(255,255,255,0.9)");
  });
  canvasTexture(scene, "flash", 90, 90, (ctx) => {
    starPath(ctx, 45, 45, 42, 0.35, 8);
    fill(ctx, radial(ctx, 45, 45, 42, [[0, "#ffffff"], [0.4, "#fff6a0"], [1, "rgba(255,180,40,0)"]]));
  });
  canvasTexture(scene, "glow", 256, 256, (ctx) => {
    ctx.beginPath();
    ctx.arc(128, 128, 128, 0, Math.PI * 2);
    fill(ctx, radial(ctx, 128, 128, 128, [[0, "rgba(255,255,255,0.9)"], [0.35, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,0)"]]));
  });
  canvasTexture(scene, "rays", 640, 640, (ctx) => {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = a0 + (Math.PI / n) * 0.9;
      ctx.beginPath();
      ctx.moveTo(320, 320);
      ctx.arc(320, 320, 320, a0, a1);
      ctx.closePath();
      fill(ctx, radial(ctx, 320, 320, 320, [[0, "rgba(255,255,255,0.7)"], [1, "rgba(255,255,255,0)"]]));
    }
  });
}
