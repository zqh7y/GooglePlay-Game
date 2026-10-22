import Phaser from "phaser";
import { DICE } from "../data/dice";
import { RARITY_INFO, RARITY_ORDER, Rarity } from "../data/rarity";
import {
  Ctx, INK, boltPath, canvasTexture, darken, ellipse, fill, fillOutline, gloss, lighten, linear, outline,
  radial, rgba, rr, starPath, twinkle,
} from "./draw";

// ───────────────────────── buttons & panels ─────────────────────────

export type BtnColor = "green" | "purple" | "orange" | "blue" | "red" | "grey" | "gold" | "dark" | "teal";

/** [top highlight, base, bottom edge] */
const BTN: Record<BtnColor, [number, number, number]> = {
  green: [0x8cf25a, 0x3fc02c, 0x23861a],
  purple: [0xcf9bff, 0x8c4dff, 0x5626b8],
  orange: [0xffcc5c, 0xff8a1f, 0xbf560a],
  blue: [0x7ad8ff, 0x2f97f0, 0x1c5fb0],
  red: [0xff8585, 0xe53b3b, 0xa32020],
  grey: [0x9ea6c9, 0x6b7399, 0x454b6e],
  gold: [0xfff08a, 0xffc21f, 0xc28400],
  dark: [0x5560b0, 0x3a4188, 0x252a5e],
  teal: [0x6ff0d8, 0x1fbfa4, 0x0f7d6c],
};

export const btnEdge = (h: number) => Math.round(Math.max(7, h * 0.1));

export function btnTexture(scene: Phaser.Scene, color: BtnColor, w: number, h: number): string {
  return canvasTexture(scene, `btn_${color}_${w}_${h}`, w, h, (ctx) => {
    const [top, base, edge] = BTN[color];
    const o = 5;
    const d = btnEdge(h);
    const r = Math.min(h * 0.32, 34);
    rr(ctx, 0, 0, w, h, r);
    fill(ctx, INK);
    rr(ctx, o, o, w - o * 2, h - o * 2, r - o);
    fill(ctx, rgba(edge));
    rr(ctx, o, o, w - o * 2, h - o * 2 - d, r - o);
    fill(ctx, linear(ctx, 0, o, 0, h - d, [[0, rgba(top)], [0.55, rgba(base)], [1, rgba(darken(base, 0.08))]]));
    rr(ctx, o + 8, o + 6, w - o * 2 - 16, (h - o * 2 - d) * 0.42, (r - o) * 0.75);
    fill(ctx, "rgba(255,255,255,0.25)");
    ellipse(ctx, o + 20, o + 14, 7, 4.5, -0.3);
    fill(ctx, "rgba(255,255,255,0.75)");
  });
}

export type PanelStyle = "card" | "inset" | "modal" | "row";

export function panelTexture(scene: Phaser.Scene, style: PanelStyle, w: number, h: number): string {
  return canvasTexture(scene, `panel_${style}_${w}_${h}`, w, h, (ctx) => {
    const r = style === "row" ? 26 : 30;
    if (style === "inset") {
      rr(ctx, 0, 0, w, h, r);
      fill(ctx, linear(ctx, 0, 0, 0, h, [[0, "#12143a"], [1, "#1c2050"]]));
      ctx.save();
      rr(ctx, 0, 0, w, h, r);
      ctx.clip();
      rr(ctx, -10, -10, w + 20, 34, 0);
      fill(ctx, "rgba(0,0,0,0.25)");
      ctx.restore();
      rr(ctx, 1.5, 1.5, w - 3, h - 3, r);
      outline(ctx, 3, "rgba(255,255,255,0.08)");
      return;
    }
    const o = style === "modal" ? 6 : 5;
    const [c0, c1] = style === "modal" ? ["#4a52b8", "#2c3178"] : style === "row" ? ["#3c438f", "#2b3070"] : ["#363c86", "#262b68"];
    rr(ctx, 0, 0, w, h, r);
    fill(ctx, INK);
    rr(ctx, o, o, w - o * 2, h - o * 2, r - o);
    fill(ctx, linear(ctx, 0, 0, 0, h, [[0, c0], [1, c1]]));
    rr(ctx, o + 4, o + 4, w - o * 2 - 8, h - o * 2 - 8, r - o - 4);
    outline(ctx, 3, style === "modal" ? "rgba(160,170,255,0.45)" : "rgba(255,255,255,0.12)");
    rr(ctx, o + 10, o + 8, w - o * 2 - 20, Math.min(40, h * 0.18), 16);
    fill(ctx, "rgba(255,255,255,0.06)");
  });
}

export function pillTexture(scene: Phaser.Scene, w: number, h: number): string {
  return canvasTexture(scene, `pill_${w}_${h}`, w, h, (ctx) => {
    rr(ctx, 2, 2, w - 4, h - 4, (h - 4) / 2);
    fill(ctx, "rgba(18,14,48,0.62)");
    rr(ctx, 2, 2, w - 4, h - 4, (h - 4) / 2);
    outline(ctx, 3.5, "rgba(255,255,255,0.22)");
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
    fillOutline(ctx, linear(ctx, 0, 4, 0, h * 0.8, [[0, rgba(top)], [0.6, rgba(base)], [1, rgba(darken(base, 0.1))]]), 5.5);
    rr(ctx, tail + 10, 10, w - tail * 2 - 20, h * 0.25, 10);
    fill(ctx, "rgba(255,255,255,0.25)");
  });
}

/** Full-width background for the bottom half of the screen. */
export function bottomPanelTexture(scene: Phaser.Scene, w: number, h: number): string {
  return canvasTexture(scene, `bottom_${w}_${h}`, w, h, (ctx) => {
    ctx.fillStyle = linear(ctx, 0, 0, 0, h, [[0, "#2a2f73"], [1, "#171a45"]]);
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 18;
    for (let x = -h; x < w; x += 70) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + h, 0);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, w, 8);
    ctx.fillStyle = "#5a63c7";
    ctx.fillRect(0, 8, w, 5);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 13, w, 10);
  });
}

// ───────────────────────── item cards ─────────────────────────

export const CARD_W = 220;
export const CARD_H = 280;

function drawCard(ctx: Ctx, rarity: Rarity): void {
  const c = RARITY_INFO[rarity].color;
  const secret = rarity === "secret";
  const W = CARD_W;
  const H = CARD_H;
  rr(ctx, 0, 0, W, H, 26);
  fill(ctx, INK);
  rr(ctx, 5, 5, W - 10, H - 10, 22);
  if (secret) {
    const g = ctx.createConicGradient ? ctx.createConicGradient(0, W / 2, H / 2) : null;
    if (g) {
      ["#ff5f6d", "#ffb347", "#fff35c", "#5ef08a", "#4fc3ff", "#b67bff", "#ff5f6d"].forEach((s, i, a) => g.addColorStop(i / (a.length - 1), s));
      fill(ctx, g);
    } else {
      fill(ctx, linear(ctx, 0, 0, W, H, [[0, "#ff5f6d"], [0.5, "#5ef08a"], [1, "#b67bff"]]));
    }
  } else {
    fill(ctx, linear(ctx, 0, 5, 0, H - 5, [[0, rgba(lighten(c, 0.35))], [0.5, rgba(c)], [1, rgba(darken(c, 0.25))]]));
  }
  rr(ctx, 11, 9, W - 22, 34, 14);
  fill(ctx, "rgba(255,255,255,0.2)");

  // inner window
  rr(ctx, 15, 48, W - 30, 182, 16);
  fill(ctx, secret
    ? radial(ctx, W / 2, 130, 140, [[0, "#7b3fd0"], [0.6, "#2a1258"], [1, "#130a2e"]])
    : radial(ctx, W / 2, 128, 140, [[0, rgba(lighten(c, 0.2))], [0.55, rgba(darken(c, 0.4))], [1, rgba(darken(c, 0.68))]]));
  ctx.save();
  rr(ctx, 15, 48, W - 30, 182, 16);
  ctx.clip();
  ctx.fillStyle = linear(ctx, 0, 48, 0, 76, [[0, "rgba(0,0,0,0.3)"], [1, "rgba(0,0,0,0)"]]);
  ctx.fillRect(15, 48, W - 30, 30);
  if (secret || rarity === "legendary" || rarity === "mythical") {
    for (const [x, y, r] of [[40, 70, 7], [182, 86, 6], [46, 200, 5], [176, 196, 8], [110, 62, 4]]) twinkle(ctx, x, y, r, "rgba(255,255,255,0.75)");
  }
  ctx.restore();
  rr(ctx, 15, 48, W - 30, 182, 16);
  outline(ctx, 4, "rgba(38,24,63,0.7)");

  rr(ctx, 15, 236, W - 30, 36, 12);
  fill(ctx, "rgba(20,10,40,0.42)");
}

export function makeCardTextures(scene: Phaser.Scene): void {
  for (const r of RARITY_ORDER) canvasTexture(scene, `card_${r}`, CARD_W, CARD_H, (ctx) => drawCard(ctx, r));
  canvasTexture(scene, "card_locked", CARD_W, CARD_H, (ctx) => {
    rr(ctx, 0, 0, CARD_W, CARD_H, 26);
    fill(ctx, INK);
    rr(ctx, 5, 5, CARD_W - 10, CARD_H - 10, 22);
    fill(ctx, linear(ctx, 0, 0, 0, CARD_H, [[0, "#3a3f72"], [1, "#24284f"]]));
    rr(ctx, 15, 48, CARD_W - 30, 182, 16);
    fill(ctx, "#181b3f");
    rr(ctx, 15, 236, CARD_W - 30, 36, 12);
    fill(ctx, "rgba(20,10,40,0.42)");
  });
  canvasTexture(scene, "card_empty", CARD_W, CARD_H, (ctx) => {
    rr(ctx, 6, 6, CARD_W - 12, CARD_H - 12, 24);
    fill(ctx, "rgba(10,8,35,0.45)");
    ctx.setLineDash([18, 12]);
    rr(ctx, 6, 6, CARD_W - 12, CARD_H - 12, 24);
    outline(ctx, 5, "rgba(255,255,255,0.25)");
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(CARD_W / 2 - 22, CARD_H / 2);
    ctx.lineTo(CARD_W / 2 + 22, CARD_H / 2);
    ctx.moveTo(CARD_W / 2, CARD_H / 2 - 22);
    ctx.lineTo(CARD_W / 2, CARD_H / 2 + 22);
    outline(ctx, 9, "rgba(255,255,255,0.25)");
  });
}

// ───────────────────────── dice ─────────────────────────

export const DIE_SIZE = 180;
export const dieKey = (dieId: string, face: number) => `die_${dieId}_${face}`;

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function drawDie(ctx: Ctx, dieId: string, color: number, face: number): void {
  const S = DIE_SIZE;
  const crystal = dieId === "crystal";
  rr(ctx, 10, 10, S - 20, S - 14, 38);
  fill(ctx, INK);
  rr(ctx, 16, 16, S - 32, S - 26, 32);
  fill(ctx, rgba(darken(color, 0.38)));
  const fx = 16;
  const fy = 16;
  const fw = S - 32;
  const fh = S - 44;
  rr(ctx, fx, fy, fw, fh, 32);
  fill(ctx, crystal
    ? linear(ctx, fx, fy, fx + fw, fy + fh, [[0, "#e8fbff"], [0.45, "#8fe3ff"], [1, "#3fa9e0"]])
    : linear(ctx, 0, fy, 0, fy + fh, [[0, rgba(lighten(color, 0.3))], [1, rgba(color)]]));
  ctx.save();
  rr(ctx, fx, fy, fw, fh, 32);
  ctx.clip();
  if (crystal) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(fx, fy + fh * 0.55);
    ctx.lineTo(fx + fw * 0.55, fy);
    ctx.lineTo(fx + fw * 0.75, fy);
    ctx.lineTo(fx, fy + fh * 0.8);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(fx + fw * 0.4, fy + fh);
    ctx.lineTo(fx + fw, fy + fh * 0.35);
    ctx.lineTo(fx + fw, fy + fh * 0.55);
    ctx.lineTo(fx + fw * 0.6, fy + fh);
    ctx.fill();
  } else {
    ctx.strokeStyle = rgba(darken(color, 0.25), 0.45);
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const y = fy + 14 + i * 22;
      ctx.beginPath();
      ctx.moveTo(fx - 4, y);
      ctx.bezierCurveTo(fx + fw * 0.3, y - 8, fx + fw * 0.6, y + 10, fx + fw + 4, y - 2);
      ctx.stroke();
    }
    ellipse(ctx, fx + fw * 0.72, fy + fh * 0.7, 9, 5, 0.2);
    outline(ctx, 3, rgba(darken(color, 0.3), 0.5));
  }
  ctx.restore();
  rr(ctx, fx + 6, fy + 5, fw - 12, fh - 10, 26);
  outline(ctx, 3.5, "rgba(255,255,255,0.35)");

  const pip = crystal ? "#1b2f78" : INK;
  const cx = fx + fw / 2;
  const cy = fy + fh / 2;
  for (const [px, py] of PIPS[face]) {
    const x = cx + px * fw * 0.27;
    const y = cy + py * fh * 0.27;
    ctx.beginPath();
    ctx.arc(x, y, face === 1 ? 19 : 14, 0, Math.PI * 2);
    fill(ctx, face === 1 && !crystal ? "#d62d4f" : pip);
    ctx.beginPath();
    ctx.arc(x + 2, y + 3, face === 1 ? 13 : 9, 0, Math.PI * 2);
    fill(ctx, "rgba(255,255,255,0.14)");
  }
  if (crystal) for (const [x, y, r] of [[fx + 22, fy + 22, 9], [fx + fw - 26, fy + fh - 20, 7]]) twinkle(ctx, x, y, r);
}

export function makeDiceTextures(scene: Phaser.Scene): void {
  for (const d of DICE) {
    for (let f = 1; f <= 6; f++) canvasTexture(scene, dieKey(d.id, f), DIE_SIZE, DIE_SIZE, (ctx) => drawDie(ctx, d.id, d.color, f));
  }
}

// ───────────────────────── icons ─────────────────────────

const I = 96;

const ICONS: Record<string, (ctx: Ctx) => void> = {
  coin: (ctx) => {
    ctx.beginPath();
    ctx.arc(48, 50, 42, 0, Math.PI * 2);
    fill(ctx, INK);
    ctx.beginPath();
    ctx.arc(48, 50, 37, 0, Math.PI * 2);
    fill(ctx, "#d98a00");
    ctx.beginPath();
    ctx.arc(48, 46, 37, 0, Math.PI * 2);
    fill(ctx, linear(ctx, 0, 10, 0, 84, [[0, "#fff09a"], [0.5, "#ffc928"], [1, "#f0a000"]]));
    ctx.beginPath();
    ctx.arc(48, 46, 26, 0, Math.PI * 2);
    outline(ctx, 4, "rgba(190,110,0,0.65)");
    starPath(ctx, 48, 47, 15, 0.45);
    fill(ctx, "#f2a600");
    starPath(ctx, 48, 45, 15, 0.45);
    fill(ctx, "#ffe680");
    gloss(ctx, 32, 28, 10, 5, -0.7, 0.8);
  },
  dice: (ctx) => {
    ctx.save();
    ctx.translate(48, 48);
    ctx.rotate(-0.18);
    rr(ctx, -34, -34, 68, 72, 18);
    fill(ctx, INK);
    rr(ctx, -30, -30, 60, 62, 14);
    fill(ctx, "#c9cbe0");
    rr(ctx, -30, -30, 60, 56, 14);
    fill(ctx, linear(ctx, 0, -30, 0, 26, [[0, "#ffffff"], [1, "#e6e8f5"]]));
    for (const [x, y] of [[-14, -14], [14, -14], [0, -1], [-14, 12], [14, 12]]) {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      fill(ctx, x === 0 ? "#e8324f" : INK);
    }
    ctx.restore();
  },
  paw: (ctx) => {
    ellipse(ctx, 48, 62, 24, 20);
    fillOutline(ctx, linear(ctx, 0, 40, 0, 82, [[0, "#ffffff"], [1, "#ffd0e0"]]), 5);
    for (const [x, y, r] of [[22, 38, 10], [38, 24, 10.5], [58, 24, 10.5], [74, 38, 10]]) {
      ellipse(ctx, x, y, r, r * 1.15);
      fillOutline(ctx, "#ffb3cc", 5);
    }
  },
  up: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(48, 8);
    ctx.lineTo(86, 48);
    ctx.lineTo(64, 48);
    ctx.lineTo(64, 86);
    ctx.lineTo(32, 86);
    ctx.lineTo(32, 48);
    ctx.lineTo(10, 48);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, 8, 0, 86, [[0, "#b3ff7a"], [1, "#2fae2a"]]), 6);
    ctx.beginPath();
    ctx.moveTo(48, 20);
    ctx.lineTo(70, 42);
    outline(ctx, 4, "rgba(255,255,255,0.55)");
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
      fillOutline(ctx, linear(ctx, 0, -36, 0, 0, [[0, "#9cf05a"], [1, "#2f9e2a"]]), 5);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(48, 50);
    ctx.quadraticCurveTo(54, 74, 66, 86);
    outline(ctx, 9);
    ctx.beginPath();
    ctx.moveTo(48, 50);
    ctx.quadraticCurveTo(54, 74, 66, 86);
    outline(ctx, 4, "#2f9e2a");
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
    fillOutline(ctx, linear(ctx, -10, 0, 10, 0, [[0, "#ffffff"], [0.5, "#d8dcf0"], [1, "#9aa0c0"]]), 5);
    rr(ctx, -24, 12, 48, 12, 6);
    fillOutline(ctx, "#ffc21f", 5);
    rr(ctx, -6, 22, 12, 18, 4);
    fillOutline(ctx, "#8a4b2a", 5);
    ctx.beginPath();
    ctx.arc(0, 44, 7, 0, Math.PI * 2);
    fillOutline(ctx, "#ffc21f", 4.5);
    ctx.restore();
  },
  bolt: (ctx) => {
    boltPath(ctx, 48, 48, 42);
    fillOutline(ctx, linear(ctx, 0, 6, 0, 90, [[0, "#fffbd0"], [1, "#ffb81f"]]), 6);
  },
  heart: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(48, 84);
    ctx.bezierCurveTo(8, 58, 4, 26, 26, 16);
    ctx.bezierCurveTo(38, 10, 46, 18, 48, 28);
    ctx.bezierCurveTo(50, 18, 58, 10, 70, 16);
    ctx.bezierCurveTo(92, 26, 88, 58, 48, 84);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, 12, 0, 84, [[0, "#ff8a9a"], [1, "#e0203f"]]), 6);
    gloss(ctx, 28, 30, 9, 6, -0.8, 0.8);
  },
  star: (ctx) => {
    starPath(ctx, 48, 50, 42, 0.48);
    fillOutline(ctx, linear(ctx, 0, 8, 0, 90, [[0, "#fff3a0"], [1, "#ffb300"]]), 6);
  },
  skull: (ctx) => {
    ctx.beginPath();
    ctx.arc(48, 42, 32, Math.PI * 0.85, Math.PI * 2.15);
    ctx.lineTo(66, 82);
    ctx.lineTo(30, 82);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, 10, 0, 82, [[0, "#ffffff"], [1, "#cfd3e6"]]), 6);
    for (const x of [34, 62]) {
      ellipse(ctx, x, 46, 9, 10);
      fill(ctx, INK);
    }
    ctx.beginPath();
    ctx.moveTo(48, 56);
    ctx.lineTo(43, 66);
    ctx.lineTo(53, 66);
    ctx.closePath();
    fill(ctx, INK);
  },
  check: (ctx) => {
    ctx.beginPath();
    ctx.arc(48, 48, 40, 0, Math.PI * 2);
    fillOutline(ctx, linear(ctx, 0, 8, 0, 88, [[0, "#8cf25a"], [1, "#2a9a1f"]]), 6);
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
  auto: (ctx) => {
    for (const a of [0, Math.PI]) {
      ctx.save();
      ctx.translate(48, 48);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.arc(0, 0, 28, Math.PI * 1.05, Math.PI * 1.85);
      outline(ctx, 18);
      ctx.beginPath();
      ctx.arc(0, 0, 28, Math.PI * 1.05, Math.PI * 1.85);
      outline(ctx, 9, "#ffffff");
      ctx.beginPath();
      ctx.moveTo(14, -40);
      ctx.lineTo(36, -24);
      ctx.lineTo(12, -12);
      ctx.closePath();
      fillOutline(ctx, "#ffffff", 5);
      ctx.restore();
    }
  },
  fast: (ctx) => {
    for (const x of [14, 46]) {
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x + 36, 48);
      ctx.lineTo(x, 76);
      ctx.closePath();
      fillOutline(ctx, "#ffffff", 6);
    }
  },
  odds: (ctx) => {
    for (const [x, h] of [[14, 34], [38, 58], [62, 44]]) {
      rr(ctx, x, 84 - h, 20, h, 5);
      fillOutline(ctx, "#ffffff", 5);
    }
    ctx.beginPath();
    ctx.moveTo(10, 88);
    ctx.lineTo(88, 88);
    outline(ctx, 5, "#ffffff");
  },
  close: (ctx) => {
    ctx.beginPath();
    ctx.arc(48, 48, 42, 0, Math.PI * 2);
    fill(ctx, INK);
    ctx.beginPath();
    ctx.arc(48, 46, 37, 0, Math.PI * 2);
    fill(ctx, linear(ctx, 0, 8, 0, 84, [[0, "#ff8585"], [1, "#d42a2a"]]));
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
    outline(ctx, 8, "#c9cde6");
    rr(ctx, 20, 40, 56, 46, 10);
    fillOutline(ctx, linear(ctx, 0, 40, 0, 86, [[0, "#ffd75a"], [1, "#e09a00"]]), 6);
    ctx.beginPath();
    ctx.arc(48, 60, 7, 0, Math.PI * 2);
    fill(ctx, INK);
  },
  ad: (ctx) => {
    rr(ctx, 8, 18, 80, 60, 14);
    fillOutline(ctx, "#ffffff", 6);
    ctx.beginPath();
    ctx.moveTo(38, 32);
    ctx.lineTo(62, 48);
    ctx.lineTo(38, 64);
    ctx.closePath();
    fill(ctx, "#8c4dff");
  },
  clock: (ctx) => {
    ctx.beginPath();
    ctx.arc(48, 50, 38, 0, Math.PI * 2);
    fillOutline(ctx, linear(ctx, 0, 12, 0, 88, [[0, "#ffffff"], [1, "#d6dbf2"]]), 6);
    ctx.beginPath();
    ctx.moveTo(48, 50);
    ctx.lineTo(48, 26);
    ctx.moveTo(48, 50);
    ctx.lineTo(66, 58);
    outline(ctx, 6);
  },
  target: (ctx) => {
    for (const [r, c] of [[38, "#ff5a5a"], [26, "#ffffff"], [14, "#ff5a5a"]] as [number, string][]) {
      ctx.beginPath();
      ctx.arc(48, 48, r, 0, Math.PI * 2);
      fillOutline(ctx, c, 5);
    }
  },
  fuse: (ctx) => {
    ctx.beginPath();
    ctx.arc(48, 48, 40, 0, Math.PI * 2);
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
    fillOutline(ctx, "#ffffff", 5);
  },
  gem: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(24, 16);
    ctx.lineTo(72, 16);
    ctx.lineTo(90, 38);
    ctx.lineTo(48, 86);
    ctx.lineTo(6, 38);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, 16, 0, 86, [[0, "#9ff3ff"], [1, "#2a7fe0"]]), 6);
    ctx.beginPath();
    ctx.moveTo(6, 38);
    ctx.lineTo(90, 38);
    ctx.moveTo(34, 16);
    ctx.lineTo(28, 38);
    ctx.lineTo(48, 86);
    ctx.moveTo(62, 16);
    ctx.lineTo(68, 38);
    outline(ctx, 3, "rgba(38,24,63,0.5)");
  },
};

export function makeIconTextures(scene: Phaser.Scene): void {
  for (const [name, draw] of Object.entries(ICONS)) canvasTexture(scene, `icon_${name}`, I, I, draw);
  // round badge behind upgrade icons
  canvasTexture(scene, "badge_round", 120, 120, (ctx) => {
    ctx.beginPath();
    ctx.arc(60, 60, 56, 0, Math.PI * 2);
    fill(ctx, INK);
    ctx.beginPath();
    ctx.arc(60, 60, 50, 0, Math.PI * 2);
    fill(ctx, radial(ctx, 60, 50, 56, [[0, "#ffffff"], [1, "#cfd4ee"]]));
  });
  canvasTexture(scene, "badge_count", 72, 52, (ctx) => {
    rr(ctx, 2, 2, 68, 48, 24);
    fillOutline(ctx, linear(ctx, 0, 2, 0, 50, [[0, "#4a4f8f"], [1, "#24285c"]]), 4);
  });
}
