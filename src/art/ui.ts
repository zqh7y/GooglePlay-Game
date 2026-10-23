import Phaser from "phaser";
import { RARITY_INFO, RARITY_ORDER, Rarity } from "../data/rarity";
import {
  Ctx, INK, RAINBOW, boltPath, canvasTexture, circle, darken, ellipse, fill, fillOutline, lighten, linear, outline,
  radial, rgba, rr, starPath, twinkle,
} from "./draw";

// ───────────────────────── buttons & panels ─────────────────────────

export type BtnColor = "peach" | "mint" | "orange" | "green" | "red" | "grey" | "blue" | "purple" | "gold" | "brown" | "cream" | "pink";

/** [top highlight, base, bottom edge] */
const BTN: Record<BtnColor, [number, number, number]> = {
  peach: [0xffe6bf, 0xffcf8f, 0xd99652],
  mint: [0xc9fff0, 0x8ff0d6, 0x45b897],
  orange: [0xffc98a, 0xff9a4a, 0xd0652a],
  green: [0xb8f58a, 0x76d651, 0x3f9a2f],
  red: [0xffa0a0, 0xf26464, 0xb83a3a],
  grey: [0xe2dbd0, 0xc6bcad, 0x958978],
  blue: [0xb3e4ff, 0x67c3ff, 0x2f86d0],
  purple: [0xe2c4ff, 0xb98aff, 0x7d4fd6],
  gold: [0xfff2a8, 0xffcf3f, 0xd09a10],
  brown: [0x8a6244, 0x6b4a32, 0x4a2f1d],
  cream: [0xfffaf0, 0xfff1d6, 0xe0c39a],
  pink: [0xffd3e3, 0xffa9c8, 0xe0709a],
};

export const btnEdge = (h: number) => Math.round(Math.max(6, h * 0.085));

export function btnTexture(scene: Phaser.Scene, color: BtnColor, w: number, h: number): string {
  return canvasTexture(scene, `btn_${color}_${w}_${h}`, w, h, (ctx) => {
    const [top, base, edge] = BTN[color];
    const o = 5;
    const d = btnEdge(h);
    const r = Math.min(h * 0.3, 30);
    rr(ctx, 0, 0, w, h, r);
    fill(ctx, INK);
    rr(ctx, o, o, w - o * 2, h - o * 2, r - o);
    fill(ctx, rgba(edge));
    rr(ctx, o, o, w - o * 2, h - o * 2 - d, r - o);
    fill(ctx, linear(ctx, 0, o, 0, h - d, [[0, rgba(top)], [0.45, rgba(base)], [1, rgba(base)]]));
    rr(ctx, o + 8, o + 5, w - o * 2 - 16, Math.max(6, (h - o * 2 - d) * 0.22), 8);
    fill(ctx, "rgba(255,255,255,0.35)");
  });
}

export type PanelStyle = "cream" | "inset" | "row" | "glass";

export function panelTexture(scene: Phaser.Scene, style: PanelStyle, w: number, h: number): string {
  return canvasTexture(scene, `panel_${style}_${w}_${h}`, w, h, (ctx) => {
    const r = 28;
    if (style === "glass") {
      rr(ctx, 2, 2, w - 4, h - 4, r);
      fill(ctx, "rgba(74,47,29,0.55)");
      rr(ctx, 2, 2, w - 4, h - 4, r);
      outline(ctx, 4, "rgba(255,240,215,0.35)");
      return;
    }
    if (style === "inset") {
      rr(ctx, 0, 0, w, h, r);
      fill(ctx, "#f0dcb8");
      ctx.save();
      rr(ctx, 0, 0, w, h, r);
      ctx.clip();
      ctx.fillStyle = "rgba(120,80,40,0.16)";
      ctx.fillRect(0, 0, w, 14);
      ctx.restore();
      rr(ctx, 2, 2, w - 4, h - 4, r);
      outline(ctx, 4, "#d9bb8c");
      return;
    }
    const o = style === "row" ? 4 : 6;
    rr(ctx, 0, 0, w, h, r);
    fill(ctx, INK);
    rr(ctx, o, o, w - o * 2, h - o * 2, r - o);
    fill(ctx, style === "row" ? "#fff8ec" : linear(ctx, 0, 0, 0, h, [[0, "#fff6e4"], [1, "#ffeccc"]]));
    rr(ctx, o + 5, o + 5, w - o * 2 - 10, h - o * 2 - 10, r - o - 4);
    outline(ctx, 3, "#ecd1a6");
  });
}

/** Cream/dark/glass pill for currency and price tags. */
export function pillTexture(scene: Phaser.Scene, style: "cream" | "dark" | "glass", w: number, h: number): string {
  return canvasTexture(scene, `pill_${style}_${w}_${h}`, w, h, (ctx) => {
    const r = (h - 4) / 2;
    rr(ctx, 2, 2, w - 4, h - 4, r);
    if (style === "glass") {
      fill(ctx, "rgba(74,47,29,0.55)");
      rr(ctx, 2, 2, w - 4, h - 4, r);
      outline(ctx, 3, "rgba(255,240,215,0.4)");
      return;
    }
    fill(ctx, style === "cream" ? "#fff3dc" : "#5b3a24");
    rr(ctx, 2, 2, w - 4, h - 4, r);
    outline(ctx, 4.5);
    if (style === "cream") {
      rr(ctx, 10, 7, w - 20, h * 0.28, h * 0.14);
      fill(ctx, "rgba(255,255,255,0.7)");
    }
  });
}

export function ribbonTexture(scene: Phaser.Scene, color: BtnColor, w: number, h: number): string {
  return canvasTexture(scene, `ribbon_${color}_${w}_${h}`, w, h, (ctx) => {
    const [top, base, edge] = BTN[color];
    const tail = w * 0.12;
    for (const dir of [-1, 1]) {
      const x0 = dir < 0 ? 4 : w - 4;
      ctx.beginPath();
      ctx.moveTo(x0 - dir * tail * 1.5, h * 0.3);
      ctx.lineTo(x0, h * 0.3);
      ctx.lineTo(x0 - dir * tail * 0.45, h * 0.62);
      ctx.lineTo(x0, h * 0.96);
      ctx.lineTo(x0 - dir * tail * 1.5, h * 0.96);
      ctx.closePath();
      fillOutline(ctx, rgba(edge), 5);
    }
    rr(ctx, tail, 4, w - tail * 2, h * 0.76, 16);
    fillOutline(ctx, linear(ctx, 0, 4, 0, h * 0.8, [[0, rgba(top)], [0.5, rgba(base)], [1, rgba(base)]]), 5);
    rr(ctx, tail + 10, 10, w - tail * 2 - 20, h * 0.18, 8);
    fill(ctx, "rgba(255,255,255,0.35)");
  });
}

/** Round slot for an equipped pet. */
export function slotTexture(scene: Phaser.Scene, size: number, locked: boolean): string {
  return canvasTexture(scene, `slot_${size}_${locked ? "l" : "o"}`, size, size, (ctx) => {
    const c = size / 2;
    circle(ctx, c, c, c - 3);
    fill(ctx, INK);
    circle(ctx, c, c, c - 9);
    fill(ctx, locked ? "#a89a88" : radial(ctx, c, c - 8, c, [[0, "#fffaf0"], [1, "#f2dcb6"]]));
    circle(ctx, c, c, c - 14);
    outline(ctx, 3, locked ? "#8e8070" : "#e6c99c");
  });
}

// ───────────────────────── pet cards ─────────────────────────

export const CARD_W = 220;
export const CARD_H = 290;

function drawCard(ctx: Ctx, rarity: Rarity | "locked"): void {
  const W = CARD_W;
  const H = CARD_H;
  const locked = rarity === "locked";
  const c = locked ? 0xc9bba6 : RARITY_INFO[rarity].color;
  const secret = rarity === "secret";
  rr(ctx, 0, 0, W, H, 26);
  fill(ctx, INK);
  rr(ctx, 5, 5, W - 10, H - 10, 22);
  if (secret) {
    const g = ctx.createConicGradient ? ctx.createConicGradient(0, W / 2, H / 2) : null;
    if (g) {
      [...RAINBOW, RAINBOW[0]].forEach((s, i, a) => g.addColorStop(i / (a.length - 1), s));
      fill(ctx, g);
    } else {
      fill(ctx, linear(ctx, 0, 0, W, H, RAINBOW.map((s, i) => [i / (RAINBOW.length - 1), s])));
    }
  } else {
    fill(ctx, linear(ctx, 0, 5, 0, H - 5, [[0, rgba(lighten(c, 0.3))], [1, rgba(darken(c, 0.12))]]));
  }
  rr(ctx, 11, 9, W - 22, 30, 12);
  fill(ctx, "rgba(255,255,255,0.3)");
  // window
  rr(ctx, 14, 44, W - 28, 196, 16);
  fill(ctx, locked
    ? "#e9dcc6"
    : radial(ctx, W / 2, 140, 150, [[0, "#fffdf6"], [0.55, rgba(lighten(c, 0.6))], [1, rgba(lighten(c, 0.25))]]));
  if (!locked && rarity !== "common" && rarity !== "uncommon") {
    ctx.save();
    rr(ctx, 14, 44, W - 28, 196, 16);
    ctx.clip();
    for (const [x, y, s] of [[40, 70, 8], [182, 82, 6], [44, 214, 5], [178, 206, 8]]) twinkle(ctx, x, y, s, rgba(lighten(c, 0.2), 0.8));
    ctx.restore();
  }
  rr(ctx, 14, 44, W - 28, 196, 16);
  outline(ctx, 4, "rgba(74,47,29,0.55)");
  rr(ctx, 14, 246, W - 28, 36, 12);
  fill(ctx, "rgba(74,47,29,0.5)");
}

export function makeCardTextures(scene: Phaser.Scene): void {
  for (const r of RARITY_ORDER) canvasTexture(scene, `card_${r}`, CARD_W, CARD_H, (ctx) => drawCard(ctx, r));
  canvasTexture(scene, "card_locked", CARD_W, CARD_H, (ctx) => drawCard(ctx, "locked"));
}

// ───────────────────────── dice ─────────────────────────

export const DIE_SIZE = 180;
export interface DieSkin {
  id: string;
  name: string;
  color: number;
  pip: string;
}
/** Dice skins, unlocked through the upgrade tree. Each multiplies luck. */
export const DIE_SKINS: DieSkin[] = [
  { id: "wood", name: "Wooden Die", color: 0xd29a5c, pip: INK },
  { id: "iron", name: "Iron Die", color: 0xb7bfcc, pip: "#2f3442" },
  { id: "gold", name: "Golden Die", color: 0xffcf3f, pip: "#7a4a10" },
  { id: "crystal", name: "Crystal Die", color: 0x8fe8ff, pip: "#1b3f8a" },
  { id: "cosmic", name: "Cosmic Die", color: 0x4a3aa0, pip: "#ffe066" },
];

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function drawDie(ctx: Ctx, skin: DieSkin, face: number): void {
  const S = DIE_SIZE;
  const c = skin.color;
  rr(ctx, 10, 10, S - 20, S - 14, 38);
  fill(ctx, INK);
  rr(ctx, 16, 16, S - 32, S - 26, 32);
  fill(ctx, rgba(darken(c, 0.32)));
  const fx = 16;
  const fy = 16;
  const fw = S - 32;
  const fh = S - 44;
  rr(ctx, fx, fy, fw, fh, 32);
  fill(ctx, linear(ctx, 0, fy, 0, fy + fh, [[0, rgba(lighten(c, 0.3))], [1, rgba(c)]]));
  ctx.save();
  rr(ctx, fx, fy, fw, fh, 32);
  ctx.clip();
  if (skin.id === "wood") {
    for (let i = 0; i < 6; i++) {
      const y = fy + 14 + i * 22;
      ctx.beginPath();
      ctx.moveTo(fx - 4, y);
      ctx.bezierCurveTo(fx + fw * 0.3, y - 8, fx + fw * 0.6, y + 10, fx + fw + 4, y - 2);
      outline(ctx, 3, rgba(darken(c, 0.25), 0.45));
    }
  } else if (skin.id === "iron") {
    for (const [x, y] of [[fx + 16, fy + 16], [fx + fw - 16, fy + 16], [fx + 16, fy + fh - 16], [fx + fw - 16, fy + fh - 16]]) {
      circle(ctx, x, y, 5);
      fill(ctx, "#8a93a4");
    }
  } else if (skin.id === "crystal" || skin.id === "gold") {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(fx, fy + fh * 0.55);
    ctx.lineTo(fx + fw * 0.55, fy);
    ctx.lineTo(fx + fw * 0.75, fy);
    ctx.lineTo(fx, fy + fh * 0.8);
    ctx.fill();
  } else {
    for (const [x, y, r] of [[fx + 24, fy + 30, 5], [fx + fw - 30, fy + 26, 4], [fx + fw - 22, fy + fh - 26, 6], [fx + 30, fy + fh - 24, 4]]) twinkle(ctx, x, y, r * 1.6);
  }
  ctx.restore();
  rr(ctx, fx + 6, fy + 5, fw - 12, fh - 10, 26);
  outline(ctx, 3.5, "rgba(255,255,255,0.4)");
  const cx = fx + fw / 2;
  const cy = fy + fh / 2;
  for (const [px, py] of PIPS[face]) {
    const x = cx + px * fw * 0.27;
    const y = cy + py * fh * 0.27;
    circle(ctx, x, y, face === 1 ? 19 : 14);
    fill(ctx, face === 1 && skin.id === "wood" ? "#e8434f" : skin.pip);
    circle(ctx, x + 2, y + 3, face === 1 ? 13 : 9);
    fill(ctx, "rgba(255,255,255,0.15)");
  }
}

export const dieKey = (skin: number, face: number) => `die_${DIE_SKINS[skin].id}_${face}`;

export function dieTexture(scene: Phaser.Scene, skin: number, face: number): string {
  return canvasTexture(scene, dieKey(skin, face), DIE_SIZE, DIE_SIZE, (ctx) => drawDie(ctx, DIE_SKINS[skin], face));
}

// ───────────────────────── icons ─────────────────────────

const I = 96;

const ICONS: Record<string, (ctx: Ctx) => void> = {
  cash: (ctx) => {
    ctx.save();
    ctx.translate(48, 50);
    ctx.rotate(-0.25);
    rr(ctx, -42, -26, 84, 52, 8);
    fillOutline(ctx, "#3f9a4f", 5);
    rr(ctx, -34, -18, 68, 36, 6);
    fill(ctx, "#6fd27a");
    circle(ctx, 0, 0, 13);
    fillOutline(ctx, "#3f9a4f", 3);
    ctx.fillStyle = "#e8ffe0";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 0, 1);
    ctx.restore();
  },
  gem: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(24, 18);
    ctx.lineTo(72, 18);
    ctx.lineTo(90, 40);
    ctx.lineTo(48, 86);
    ctx.lineTo(6, 40);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, 18, 0, 86, [[0, "#b3f3ff"], [1, "#3a8fe8"]]), 5);
    ctx.beginPath();
    ctx.moveTo(6, 40);
    ctx.lineTo(90, 40);
    ctx.moveTo(34, 18);
    ctx.lineTo(28, 40);
    ctx.lineTo(48, 86);
    ctx.moveTo(62, 18);
    ctx.lineTo(68, 40);
    outline(ctx, 3, "rgba(74,47,29,0.45)");
  },
  dice: (ctx) => {
    ctx.save();
    ctx.translate(48, 48);
    ctx.rotate(-0.18);
    rr(ctx, -34, -34, 68, 72, 18);
    fill(ctx, INK);
    rr(ctx, -30, -30, 60, 62, 14);
    fill(ctx, "#d9c6a8");
    rr(ctx, -30, -30, 60, 56, 14);
    fill(ctx, "#fffaf0");
    for (const [x, y] of [[-14, -14], [14, -14], [0, -1], [-14, 12], [14, 12]]) {
      circle(ctx, x, y, 6);
      fill(ctx, x === 0 ? "#e8434f" : INK);
    }
    ctx.restore();
  },
  paw: (ctx) => {
    ellipse(ctx, 48, 62, 24, 20);
    fillOutline(ctx, "#fff3e6");
    for (const [x, y, r] of [[22, 38, 10], [38, 24, 10.5], [58, 24, 10.5], [74, 38, 10]]) {
      ellipse(ctx, x, y, r, r * 1.15);
      fillOutline(ctx, "#ffb3cc");
    }
  },
  tree: (ctx) => {
    rr(ctx, 40, 52, 16, 36, 4);
    fillOutline(ctx, "#9c6a43");
    for (const [x, y, r] of [[30, 48, 20], [66, 48, 20], [48, 30, 24]]) {
      circle(ctx, x, y, r);
      outline(ctx, 9);
    }
    for (const [x, y, r] of [[30, 48, 20], [66, 48, 20], [48, 30, 24]]) {
      circle(ctx, x, y, r);
      fill(ctx, "#7ad651");
    }
    for (const [x, y] of [[36, 30], [60, 42], [42, 52]]) {
      circle(ctx, x, y, 5);
      fill(ctx, "#ffe066");
    }
  },
  clover: (ctx) => {
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(48, 46);
      ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-24, -10, -20, -38, 0, -26);
      ctx.bezierCurveTo(20, -38, 24, -10, 0, 0);
      fillOutline(ctx, linear(ctx, 0, -36, 0, 0, [[0, "#a8f06a"], [1, "#46a83a"]]));
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(48, 50);
    ctx.quadraticCurveTo(54, 74, 66, 86);
    outline(ctx, 9);
    ctx.beginPath();
    ctx.moveTo(48, 50);
    ctx.quadraticCurveTo(54, 74, 66, 86);
    outline(ctx, 4, "#46a83a");
  },
  potion: (ctx) => {
    rr(ctx, 38, 8, 20, 16, 4);
    fillOutline(ctx, "#c9a27a");
    ctx.beginPath();
    ctx.moveTo(40, 22);
    ctx.lineTo(56, 22);
    ctx.lineTo(56, 36);
    ctx.quadraticCurveTo(84, 48, 80, 70);
    ctx.quadraticCurveTo(76, 90, 48, 90);
    ctx.quadraticCurveTo(20, 90, 16, 70);
    ctx.quadraticCurveTo(12, 48, 40, 36);
    ctx.closePath();
    fillOutline(ctx, "#e9f9ff");
    ctx.save();
    ctx.clip();
    ctx.fillStyle = linear(ctx, 0, 52, 0, 90, [[0, "#9cf06a"], [1, "#3fae3a"]]);
    ctx.fillRect(0, 54, 96, 40);
    ctx.restore();
    for (const [x, y] of [[36, 66], [56, 74]]) twinkle(ctx, x, y, 6);
  },
  book: (ctx) => {
    rr(ctx, 14, 14, 68, 72, 8);
    fillOutline(ctx, "#e8434f");
    rr(ctx, 22, 20, 52, 58, 4);
    fill(ctx, "#fff3dc");
    starPath(ctx, 48, 46, 15, 0.45);
    fillOutline(ctx, "#ffcf3f", 3);
  },
  boss: (ctx) => {
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(48 + dir * 22, 30);
      ctx.quadraticCurveTo(48 + dir * 40, 22, 48 + dir * 38, 6);
      ctx.quadraticCurveTo(48 + dir * 30, 20, 48 + dir * 14, 22);
      ctx.closePath();
      fillOutline(ctx, "#fff3dc");
    }
    circle(ctx, 48, 52, 34);
    fillOutline(ctx, "#ff6a3a");
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(48 + dir * 22, 42);
      ctx.lineTo(48 + dir * 6, 50);
      ctx.lineTo(48 + dir * 20, 54);
      ctx.closePath();
      fill(ctx, INK);
    }
    ctx.beginPath();
    ctx.moveTo(32, 68);
    ctx.lineTo(64, 68);
    outline(ctx, 5);
  },
  odds: (ctx) => {
    for (const [x, h, c] of [[14, 30, "#7ad651"], [38, 54, "#67c3ff"], [62, 42, "#ffcf3f"]] as [number, number, string][]) {
      rr(ctx, x, 84 - h, 20, h, 5);
      fillOutline(ctx, c);
    }
  },
  gear: (ctx) => {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? 30 : 40;
      ctx.lineTo(48 + Math.cos(a) * r, 48 + Math.sin(a) * r);
    }
    ctx.closePath();
    fillOutline(ctx, "#c6bcad");
    circle(ctx, 48, 48, 13);
    fillOutline(ctx, "#6b4a32");
  },
  auto: (ctx) => {
    for (const a of [0, Math.PI]) {
      ctx.save();
      ctx.translate(48, 48);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.arc(0, 0, 28, Math.PI * 1.05, Math.PI * 1.85);
      outline(ctx, 17);
      ctx.beginPath();
      ctx.arc(0, 0, 28, Math.PI * 1.05, Math.PI * 1.85);
      outline(ctx, 9, "#ffffff");
      ctx.beginPath();
      ctx.moveTo(14, -40);
      ctx.lineTo(36, -24);
      ctx.lineTo(12, -12);
      ctx.closePath();
      fillOutline(ctx, "#ffffff");
      ctx.restore();
    }
  },
  close: (ctx) => {
    circle(ctx, 48, 48, 42);
    fill(ctx, INK);
    circle(ctx, 48, 46, 36);
    fill(ctx, linear(ctx, 0, 10, 0, 82, [[0, "#ff9a9a"], [1, "#e04848"]]));
    for (const [a, b, c, d] of [[32, 30, 64, 62], [64, 30, 32, 62]]) {
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.lineTo(c, d);
      outline(ctx, 15);
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.lineTo(c, d);
      outline(ctx, 8, "#ffffff");
    }
  },
  lock: (ctx) => {
    ctx.beginPath();
    ctx.arc(48, 40, 20, Math.PI, 0);
    outline(ctx, 16);
    ctx.beginPath();
    ctx.arc(48, 40, 20, Math.PI, 0);
    outline(ctx, 8, "#d6cfc4");
    rr(ctx, 20, 40, 56, 46, 10);
    fillOutline(ctx, linear(ctx, 0, 40, 0, 86, [[0, "#ffd75a"], [1, "#e09a00"]]));
    circle(ctx, 48, 60, 7);
    fill(ctx, INK);
  },
  check: (ctx) => {
    circle(ctx, 48, 48, 40);
    fillOutline(ctx, linear(ctx, 0, 8, 0, 88, [[0, "#a8f06a"], [1, "#3f9a2f"]]), 6);
    ctx.beginPath();
    ctx.moveTo(28, 50);
    ctx.lineTo(42, 64);
    ctx.lineTo(70, 34);
    outline(ctx, 16);
    ctx.beginPath();
    ctx.moveTo(28, 50);
    ctx.lineTo(42, 64);
    ctx.lineTo(70, 34);
    outline(ctx, 9, "#ffffff");
  },
  fuse: (ctx) => {
    circle(ctx, 48, 48, 40);
    fillOutline(ctx, linear(ctx, 0, 8, 0, 88, [[0, "#ffcc5c"], [1, "#e86a0a"]]), 6);
    ctx.beginPath();
    ctx.moveTo(48, 20);
    ctx.lineTo(72, 48);
    ctx.lineTo(58, 48);
    ctx.lineTo(58, 74);
    ctx.lineTo(38, 74);
    ctx.lineTo(38, 48);
    ctx.lineTo(24, 48);
    ctx.closePath();
    fillOutline(ctx, "#ffffff");
  },
  star: (ctx) => {
    starPath(ctx, 48, 50, 42, 0.48);
    fillOutline(ctx, linear(ctx, 0, 8, 0, 90, [[0, "#fff3a0"], [1, "#ffb300"]]), 6);
  },
  shop: (ctx) => {
    rr(ctx, 16, 44, 64, 44, 6);
    fillOutline(ctx, "#fff3dc", 5);
    rr(ctx, 38, 58, 20, 30, 4);
    fillOutline(ctx, "#9a5a34", 4);
    ctx.beginPath();
    ctx.moveTo(8, 46);
    ctx.lineTo(16, 16);
    ctx.lineTo(80, 16);
    ctx.lineTo(88, 46);
    ctx.closePath();
    fillOutline(ctx, "#ffffff", 5);
    for (const x of [16, 40, 64]) {
      ctx.beginPath();
      ctx.moveTo(x + 2, 18);
      ctx.lineTo(x + 14, 18);
      ctx.lineTo(x + 16, 44);
      ctx.lineTo(x - 2, 44);
      ctx.closePath();
      fill(ctx, "#ff5a5a");
    }
    ctx.beginPath();
    ctx.moveTo(8, 46);
    ctx.lineTo(16, 16);
    ctx.lineTo(80, 16);
    ctx.lineTo(88, 46);
    ctx.closePath();
    outline(ctx, 5);
  },
  back: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(14, 48);
    ctx.lineTo(48, 14);
    ctx.lineTo(48, 32);
    ctx.lineTo(84, 32);
    ctx.lineTo(84, 64);
    ctx.lineTo(48, 64);
    ctx.lineTo(48, 82);
    ctx.closePath();
    fillOutline(ctx, "#ffffff", 6);
  },
  shield: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(48, 8);
    ctx.lineTo(84, 20);
    ctx.quadraticCurveTo(84, 66, 48, 90);
    ctx.quadraticCurveTo(12, 66, 12, 20);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, 8, 0, 90, [[0, "#9fd8ff"], [1, "#3f8fd8"]]), 6);
    ctx.beginPath();
    ctx.moveTo(48, 20);
    ctx.lineTo(72, 28);
    ctx.quadraticCurveTo(72, 60, 48, 76);
    ctx.closePath();
    fill(ctx, "rgba(255,255,255,0.35)");
  },
  boot: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(26, 10);
    ctx.lineTo(56, 10);
    ctx.lineTo(56, 52);
    ctx.lineTo(84, 62);
    ctx.quadraticCurveTo(90, 66, 88, 82);
    ctx.lineTo(18, 82);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, 10, 0, 82, [[0, "#c98a4a"], [1, "#8a5428"]]), 6);
    ctx.beginPath();
    ctx.rect(18, 74, 70, 10);
    fillOutline(ctx, "#4a3a30", 5);
    ctx.beginPath();
    ctx.rect(24, 24, 34, 8);
    fill(ctx, "#ffd23f");
  },
  map: (ctx) => {
    const xs = [8, 36, 60, 88];
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const up = i % 2 === 0;
      ctx.moveTo(xs[i], up ? 18 : 10);
      ctx.lineTo(xs[i + 1], up ? 10 : 18);
      ctx.lineTo(xs[i + 1], up ? 80 : 88);
      ctx.lineTo(xs[i], up ? 88 : 80);
      ctx.closePath();
      fillOutline(ctx, i === 1 ? "#cfe9a0" : "#f4e4b8", 5);
    }
    ctx.setLineDash([6, 7]);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#c9663a";
    ctx.beginPath();
    ctx.moveTo(18, 70);
    ctx.quadraticCurveTo(40, 30, 66, 52);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#e8443f";
    ctx.beginPath();
    ctx.moveTo(62, 26);
    ctx.lineTo(78, 42);
    ctx.moveTo(78, 26);
    ctx.lineTo(62, 42);
    ctx.stroke();
  },
  gift: (ctx) => {
    rr(ctx, 12, 40, 72, 48, 8);
    fillOutline(ctx, linear(ctx, 0, 40, 0, 88, [[0, "#ff7a8a"], [1, "#e0485c"]]));
    rr(ctx, 6, 26, 84, 22, 7);
    fillOutline(ctx, "#ff8f9c");
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(41, 27, 14, 60);
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.strokeRect(41, 27, 14, 60);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(48 + s * 15, 18, 15, 9, s * 0.5, 0, Math.PI * 2);
      fillOutline(ctx, "#ffd23f", 5);
    }
  },
  quest: (ctx) => {
    rr(ctx, 14, 12, 68, 80, 10);
    fillOutline(ctx, "#a8714a");
    rr(ctx, 22, 22, 52, 62, 6);
    fillOutline(ctx, "#fff6e0", 4);
    rr(ctx, 34, 6, 28, 16, 6);
    fillOutline(ctx, "#c9cbd6", 4);
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = "#7ad651";
      ctx.beginPath();
      ctx.moveTo(30, 40 + i * 16);
      ctx.lineTo(34, 45 + i * 16);
      ctx.lineTo(41, 35 + i * 16);
      ctx.stroke();
      ctx.strokeStyle = "#c9b08a";
      ctx.beginPath();
      ctx.moveTo(48, 40 + i * 16);
      ctx.lineTo(66, 40 + i * 16);
      ctx.stroke();
    }
  },
  sword: (ctx) => {
    ctx.save();
    ctx.translate(48, 48);
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, -44);
    ctx.lineTo(10, -30);
    ctx.lineTo(10, 14);
    ctx.lineTo(-10, 14);
    ctx.lineTo(-10, -30);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, -10, 0, 10, 0, [[0, "#ffffff"], [0.5, "#dfe3f0"], [1, "#a6acc4"]]));
    rr(ctx, -24, 12, 48, 12, 6);
    fillOutline(ctx, "#ffc21f");
    rr(ctx, -6, 22, 12, 18, 4);
    fillOutline(ctx, "#8a4b2a");
    ctx.restore();
  },
  bolt: (ctx) => {
    boltPath(ctx, 48, 48, 42);
    fillOutline(ctx, linear(ctx, 0, 6, 0, 90, [[0, "#fffbd0"], [1, "#ffb81f"]]), 6);
  },
  clock: (ctx) => {
    circle(ctx, 48, 50, 38);
    fillOutline(ctx, "#fffaf0", 6);
    ctx.beginPath();
    ctx.moveTo(48, 50);
    ctx.lineTo(48, 26);
    ctx.moveTo(48, 50);
    ctx.lineTo(66, 58);
    outline(ctx, 6);
  },
  target: (ctx) => {
    for (const [r, c] of [[38, "#ff6a6a"], [26, "#ffffff"], [14, "#ff6a6a"]] as [number, string][]) {
      circle(ctx, 48, 48, r);
      fillOutline(ctx, c);
    }
  },
  slots: (ctx) => {
    for (const [x, y] of [[30, 34], [66, 34], [30, 68], [66, 68]]) {
      circle(ctx, x, y, 15);
      fillOutline(ctx, "#ffb3cc");
    }
  },
  ad: (ctx) => {
    rr(ctx, 8, 18, 80, 60, 14);
    fillOutline(ctx, "#ffffff", 6);
    ctx.beginPath();
    ctx.moveTo(38, 32);
    ctx.lineTo(62, 48);
    ctx.lineTo(38, 64);
    ctx.closePath();
    fill(ctx, "#b98aff");
  },
  skull: (ctx) => {
    ctx.beginPath();
    ctx.arc(48, 42, 32, Math.PI * 0.85, Math.PI * 2.15);
    ctx.lineTo(66, 82);
    ctx.lineTo(30, 82);
    ctx.closePath();
    fillOutline(ctx, "#fffaf0", 6);
    for (const x of [34, 62]) {
      ellipse(ctx, x, 46, 9, 10);
      fill(ctx, INK);
    }
  },
};

export function makeIconTextures(scene: Phaser.Scene): void {
  for (const [name, draw] of Object.entries(ICONS)) canvasTexture(scene, `icon_${name}`, I, I, draw);
}

// ───────────────────────── upgrade tree nodes ─────────────────────────

export type NodeState = "locked" | "open" | "ready" | "max";

export function nodeTexture(scene: Phaser.Scene, state: NodeState): string {
  const S = 150;
  return canvasTexture(scene, `node_${state}`, S, S, (ctx) => {
    const c = S / 2;
    if (state === "ready") {
      circle(ctx, c, c, c - 2);
      fill(ctx, radial(ctx, c, c, c, [[0.6, "rgba(140,255,120,0.8)"], [1, "rgba(140,255,120,0)"]]));
    }
    const [face, rim] = {
      locked: ["#c9bfb2", "#9a8e80"],
      open: ["#fff4de", "#e6c99c"],
      ready: ["#f2ffe6", "#7ad651"],
      max: ["#fff3a8", "#ffbf1f"],
    }[state];
    circle(ctx, c, c, 58);
    fill(ctx, INK);
    circle(ctx, c, c, 52);
    fill(ctx, rim);
    circle(ctx, c, c - 3, 44);
    fill(ctx, face);
    ellipse(ctx, c - 16, c - 26, 14, 7, -0.5);
    fill(ctx, "rgba(255,255,255,0.7)");
  });
}
