import Phaser from "phaser";
import { ITEMS, ItemDef, Variant } from "../data/items";
import { Species } from "../data/pets";
import {
  Ctx, INK, Paint, boltPath, canvasTexture, celShape, circle, darken, ellipse, fill, fillOutline, hexToNum,
  lighten, linear, outline, radial, rainbowGradient, rgba, rr, starPath, strokeShape, twinkle,
} from "./draw";

/**
 * Flat 2D pet art, built from a species body plus accessories and patterns.
 * Textures are drawn on first use (100 pets x 3 variants would be a lot to draw up front).
 */
export const PET_SIZE = 160;
/** Canvas height: extra room on top for hats, halos and flames. */
export const PET_H = 178;
const HEADROOM = PET_H - PET_SIZE;
export const petKey = (id: string, v: Variant) => `pet_${id}_${v}`;

const GOLD = 0xffcf3f;
const CREAM = "#fff6e6";

interface Look {
  base: Paint;
  dark: Paint;
  light: string;
  color: number;
  pattern: string;
  eyes: string;
  sparkle: string | null;
}

/** Where hats go (top of the head) and where the eyes are. */
interface Anchor {
  hx: number;
  hy: number;
  hr: number;
  ey: number;
  edx: number;
}

function lookFor(ctx: Ctx, def: ItemDef, v: Variant): Look {
  const rainbow = v === "rainbow" || (def.color === "rainbow" && v !== "golden");
  const gold = v === "golden";
  const color = gold ? GOLD : def.color === "rainbow" ? 0xffe0f2 : hexToNum(def.color);
  return {
    base: rainbow ? rainbowGradient(ctx, 0, 34, 0, 150) : rgba(color),
    dark: rainbow ? rainbowGradient(ctx, 0, 34, 0, 150, 0.2) : rgba(darken(color, 0.17)),
    light: rgba(lighten(color, 0.6)),
    color,
    pattern: def.pattern,
    eyes: def.eyes,
    sparkle: gold || def.pattern === "gold" ? "#fff6b0" : rainbow ? "#ffffff" : null,
  };
}

// ───────────────────────── faces (boxy style) ─────────────────────────

/** Rounded-rectangle path centred on (x, y). */
export function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  rr(ctx, x - w / 2, y - h / 2, w, h, r);
}

function eyes(ctx: Ctx, L: Look, x1: number, x2: number, y: number, s = 1): void {
  for (const x of [x1, x2]) {
    if (L.eyes === "glow") {
      box(ctx, x, y, 18 * s, 23 * s, 7 * s);
      fill(ctx, radial(ctx, x, y, 14 * s, [[0, "#ffffff"], [0.6, "#f0e0ff"], [1, "rgba(200,140,255,0.5)"]]));
      continue;
    }
    if (L.eyes === "happy") {
      ctx.beginPath();
      ctx.moveTo(x - 8 * s, y + 4 * s);
      ctx.lineTo(x, y - 4 * s);
      ctx.lineTo(x + 8 * s, y + 4 * s);
      outline(ctx, 5 * s);
      continue;
    }
    box(ctx, x, y, 14 * s, 20 * s, 6 * s);
    fill(ctx, INK);
    box(ctx, x + 2.5 * s, y - 4.5 * s, 5.5 * s, 6.5 * s, 2 * s);
    fill(ctx, "#ffffff");
  }
}

function blush(ctx: Ctx, x1: number, x2: number, y: number): void {
  for (const x of [x1, x2]) {
    box(ctx, x, y, 18, 9, 4.5);
    fill(ctx, "rgba(255,120,150,0.45)");
  }
}

function smile(ctx: Ctx, x: number, y: number, w = 14): void {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 4, y + w * 0.32);
  ctx.lineTo(x + w / 4, y + w * 0.32);
  ctx.lineTo(x + w / 2, y);
  outline(ctx, 4);
}

function catMouth(ctx: Ctx, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x - 5, y + 5);
  ctx.lineTo(x, y);
  ctx.lineTo(x + 5, y + 5);
  ctx.lineTo(x + 10, y);
  outline(ctx, 3.5);
}

function shine(ctx: Ctx, x: number, y: number, s = 1): void {
  box(ctx, x, y, 16 * s, 8 * s, 4 * s);
  fill(ctx, "rgba(255,255,255,0.6)");
}

// ───────────────────────── patterns (drawn clipped inside a body part) ─────────────────────────

function pattern(ctx: Ctx, L: Look, cx: number, cy: number, r: number): void {
  const d = (t: number, a = 1) => rgba(darken(L.color, t), a);
  switch (L.pattern) {
    case "stone":
      for (const [x, y, s] of [[-0.5, -0.3, 0.16], [0.4, 0.3, 0.2], [0.55, -0.35, 0.1], [-0.25, 0.45, 0.12]]) {
        ellipse(ctx, cx + x * r, cy + y * r, s * r, s * r * 0.8);
        fill(ctx, d(0.22, 0.7));
      }
      break;
    case "drops":
      for (const [x, y, s] of [[-0.45, -0.1, 0.09], [0.35, 0.35, 0.07], [0.5, -0.2, 0.05]]) {
        circle(ctx, cx + x * r, cy + y * r, s * r);
        fill(ctx, "rgba(255,255,255,0.7)");
      }
      break;
    case "spots":
      for (const [x, y, s] of [[-0.55, -0.15, 0.22], [0.45, 0.35, 0.26], [0.35, -0.5, 0.14]]) {
        ellipse(ctx, cx + x * r, cy + y * r, s * r, s * r * 0.85, 0.4);
        fill(ctx, d(0.4, 0.75));
      }
      break;
    case "stripes":
      for (const dx of [-0.28, 0, 0.28]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * r, cy - r);
        ctx.quadraticCurveTo(cx + dx * r * 1.3, cy - r * 0.6, cx + dx * r * 0.9, cy - r * 0.4);
        outline(ctx, r * 0.12, d(0.25));
      }
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + dir * r, cy + r * 0.05);
        ctx.lineTo(cx + dir * r * 0.72, cy + r * 0.1);
        outline(ctx, r * 0.1, d(0.25));
      }
      break;
    case "sprinkles": {
      const cols = ["#ff6b81", "#5ac8ff", "#fff35c", "#6ff08a", "#ffffff", "#b98aff"];
      [[-0.5, -0.4], [0.4, -0.5], [0.6, 0.1], [-0.3, 0.4], [0.2, 0.55], [-0.65, 0.1], [0.05, -0.75]].forEach(([x, y], i) => {
        ctx.save();
        ctx.translate(cx + x * r, cy + y * r);
        ctx.rotate(i * 1.1);
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(-r * 0.08, -r * 0.025, r * 0.16, r * 0.05);
        ctx.restore();
      });
      break;
    }
    case "frost":
      for (const [x, y, s] of [[-0.55, 0.2, 0.12], [0.5, -0.1, 0.1], [0.3, 0.5, 0.08]]) twinkle(ctx, cx + x * r, cy + y * r, s * r, "rgba(255,255,255,0.9)");
      break;
    case "cracks":
      ctx.save();
      ctx.shadowColor = "#ffb02e";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.8, cy);
      ctx.lineTo(cx - r * 0.5, cy + r * 0.2);
      ctx.lineTo(cx - r * 0.55, cy + r * 0.5);
      ctx.moveTo(cx + r * 0.85, cy - r * 0.2);
      ctx.lineTo(cx + r * 0.55, cy + r * 0.05);
      ctx.lineTo(cx + r * 0.65, cy + r * 0.4);
      outline(ctx, 4.5, "#ffcf3a");
      ctx.restore();
      break;
    case "rivets":
      for (const [x, y] of [[-0.6, 0.15], [0.6, 0.15], [-0.45, 0.5], [0.45, 0.5]]) {
        circle(ctx, cx + x * r, cy + y * r, r * 0.06);
        fill(ctx, d(0.35));
      }
      break;
    case "facets":
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(cx - r, cy + r * 0.1);
      ctx.lineTo(cx - r * 0.2, cy - r);
      ctx.lineTo(cx + r * 0.1, cy - r);
      ctx.lineTo(cx - r, cy + r * 0.45);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.2, cy + r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx + r, cy + r * 0.3);
      ctx.lineTo(cx + r * 0.5, cy + r);
      ctx.fill();
      break;
    case "galaxy":
      for (const [x, y, s, c] of [[-0.4, -0.3, 0.5, "rgba(255,90,200,0.35)"], [0.45, 0.3, 0.55, "rgba(90,160,255,0.35)"]] as [number, number, number, string][]) {
        ellipse(ctx, cx + x * r, cy + y * r, s * r, s * r * 0.6, 0.5);
        fill(ctx, radial(ctx, cx + x * r, cy + y * r, s * r, [[0, c], [1, "rgba(0,0,0,0)"]]));
      }
      for (const [x, y, s] of [[-0.6, 0.1, 0.07], [0.1, -0.6, 0.06], [0.55, -0.2, 0.08], [-0.15, 0.45, 0.05], [0.35, 0.6, 0.05], [-0.45, -0.55, 0.05]]) {
        twinkle(ctx, cx + x * r, cy + y * r, s * r * 1.6, "#ffffff");
      }
      break;
    case "stars":
      for (const [x, y, s] of [[-0.6, -0.2, 0.09], [0.55, 0.3, 0.08], [0.3, -0.55, 0.06], [-0.35, 0.5, 0.06]]) {
        starPath(ctx, cx + x * r, cy + y * r, s * r * 1.4);
        fill(ctx, "rgba(255,240,150,0.9)");
      }
      break;
  }
}

// ───────────────────────── species (boxy style) ─────────────────────────

function ear(ctx: Ctx, L: Look, pts: number[], inner: string | null): void {
  const [ax, ay, bx, by, cx, cy] = pts;
  celShape(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.closePath();
  }, L.base, L.dark, 22);
  if (!inner) return;
  const mx = (ax + bx + cx) / 3;
  const my = (ay + by + cy) / 3;
  ctx.beginPath();
  ctx.moveTo(mx + (ax - mx) * 0.55, my + (ay - my) * 0.55);
  ctx.lineTo(mx + (bx - mx) * 0.6, my + (by - my) * 0.6);
  ctx.lineTo(mx + (cx - mx) * 0.55, my + (cy - my) * 0.55);
  ctx.closePath();
  fill(ctx, inner);
}

/** A boxy body part: flat colour, cel shadow bottom-right and a lighter "top face" band. */
function block(ctx: Ctx, L: Look, x: number, y: number, w: number, h: number, r: number, paint?: { base: Paint; dark: Paint }, deco = true): void {
  const half = Math.min(w, h) / 2;
  celShape(ctx, () => box(ctx, x, y, w, h, r), paint?.base ?? L.base, paint?.dark ?? L.dark, half, () => {
    if (deco) pattern(ctx, L, x, y, half * 1.1);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x - w / 2, y - h / 2, w, h * 0.16);
  });
}

function body(ctx: Ctx, L: Look, y: number, w: number, h: number): void {
  block(ctx, L, 80, y, w, h, 16);
  box(ctx, 80, y + h * 0.12, w * 0.5, h * 0.55, 10);
  fill(ctx, L.light);
}

function paws(ctx: Ctx, L: Look, y = 151, dx = 16): void {
  for (const x of [80 - dx, 80 + dx]) {
    box(ctx, x, y, 22, 13, 5);
    fillOutline(ctx, L.light, 4);
  }
}

function lTail(ctx: Ctx, L: Look, pts: number[], w = 13): void {
  strokeShape(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  }, w, L.base);
}

const SPECIES: Record<Species, (ctx: Ctx, L: Look) => Anchor> = {
  slime: (ctx, L) => {
    block(ctx, L, 80, 100, 126, 100, 32);
    shine(ctx, 50, 66);
    eyes(ctx, L, 58, 102, 100);
    blush(ctx, 42, 118, 116);
    smile(ctx, 80, 113);
    return { hx: 80, hy: 52, hr: 60, ey: 100, edx: 22 };
  },

  cat: (ctx, L) => {
    lTail(ctx, L, [110, 140, 142, 140, 142, 100]);
    body(ctx, L, 132, 84, 42);
    paws(ctx, L);
    ear(ctx, L, [26, 62, 34, 12, 66, 40], "rgba(255,150,180,0.9)");
    ear(ctx, L, [134, 62, 126, 12, 94, 40], "rgba(255,150,180,0.9)");
    block(ctx, L, 80, 78, 120, 92, 28);
    shine(ctx, 46, 50);
    eyes(ctx, L, 58, 102, 80);
    blush(ctx, 38, 122, 96);
    box(ctx, 80, 91, 11, 7, 3);
    fill(ctx, "#ff8fae");
    catMouth(ctx, 80, 97);
    ctx.globalAlpha = 0.45;
    for (const dir of [-1, 1]) {
      for (const dy of [-3, 5]) {
        ctx.beginPath();
        ctx.moveTo(80 + dir * 44, 92 + dy * 0.3);
        ctx.lineTo(80 + dir * 66, 88 + dy);
        outline(ctx, 2.5);
      }
    }
    ctx.globalAlpha = 1;
    return { hx: 80, hy: 34, hr: 58, ey: 80, edx: 22 };
  },

  dog: (ctx, L) => {
    lTail(ctx, L, [112, 130, 134, 130, 138, 106], 11);
    body(ctx, L, 132, 82, 40);
    paws(ctx, L);
    block(ctx, L, 80, 80, 112, 90, 28);
    const ears = { base: rgba(darken(L.color, 0.28)), dark: rgba(darken(L.color, 0.4)) };
    for (const dir of [-1, 1]) block(ctx, L, 80 + dir * 54, 86, 28, 58, 12, ears, false);
    shine(ctx, 52, 52);
    box(ctx, 80, 102, 48, 30, 12);
    fillOutline(ctx, L.light, 4);
    box(ctx, 80, 94, 17, 11, 5);
    fill(ctx, INK);
    smile(ctx, 80, 106, 12);
    eyes(ctx, L, 61, 99, 76);
    blush(ctx, 46, 114, 92);
    return { hx: 80, hy: 36, hr: 54, ey: 76, edx: 19 };
  },

  bunny: (ctx, L) => {
    body(ctx, L, 136, 76, 36);
    paws(ctx, L, 152, 14);
    for (const dir of [-1, 1]) {
      block(ctx, L, 80 + dir * 19, 40, 25, 66, 12, undefined, false);
      box(ctx, 80 + dir * 19, 44, 11, 44, 5);
      fill(ctx, "rgba(255,150,180,0.9)");
    }
    block(ctx, L, 80, 98, 108, 86, 28);
    shine(ctx, 50, 70);
    eyes(ctx, L, 62, 98, 98);
    blush(ctx, 44, 116, 112);
    box(ctx, 80, 108, 10, 7, 3);
    fill(ctx, "#ff8fae");
    catMouth(ctx, 80, 114);
    return { hx: 80, hy: 58, hr: 52, ey: 98, edx: 18 };
  },

  bear: (ctx, L) => {
    const panda = L.pattern === "panda";
    body(ctx, L, 134, 88, 40);
    paws(ctx, L);
    for (const x of [36, 124]) {
      if (panda) {
        box(ctx, x, 50, 34, 32, 12);
        fillOutline(ctx, "#3a2f3a");
      } else {
        block(ctx, L, x, 50, 34, 32, 12, undefined, false);
        box(ctx, x, 52, 16, 14, 5);
        fill(ctx, L.light);
      }
    }
    block(ctx, L, 80, 88, 116, 96, 30, undefined, !panda);
    if (panda) {
      for (const dir of [-1, 1]) {
        box(ctx, 80 + dir * 21, 89, 26, 30, 10);
        fill(ctx, "#3a2f3a");
      }
    }
    shine(ctx, 48, 58);
    box(ctx, 80, 109, 44, 28, 12);
    fillOutline(ctx, L.light, 4);
    box(ctx, 80, 101, 16, 10, 5);
    fill(ctx, INK);
    smile(ctx, 80, 110, 10);
    if (panda) {
      for (const x of [59, 101]) {
        box(ctx, x, 88, 12, 15, 5);
        fill(ctx, "#ffffff");
        box(ctx, x + 1, 90, 7, 9, 3);
        fill(ctx, INK);
      }
    } else {
      eyes(ctx, L, 60, 100, 88);
    }
    blush(ctx, 40, 120, 102);
    return { hx: 80, hy: 40, hr: 56, ey: 88, edx: 20 };
  },

  chick: (ctx, L) => {
    for (const x of [66, 94]) {
      box(ctx, x, 152, 22, 10, 4);
      fillOutline(ctx, "#ff9a3c", 4);
    }
    for (const dir of [-1, 1]) block(ctx, L, 80 + dir * 54, 106, 22, 40, 10, undefined, false);
    for (const [dx, h] of [[-9, 16], [3, 24], [14, 14]]) {
      box(ctx, 80 + dx, 50 - h / 2, 10, h + 6, 5);
      fillOutline(ctx, L.base, 4);
    }
    block(ctx, L, 80, 100, 116, 104, 32);
    box(ctx, 80, 124, 64, 40, 16);
    fill(ctx, L.light);
    shine(ctx, 46, 66);
    eyes(ctx, L, 62, 98, 92);
    blush(ctx, 44, 116, 106);
    ctx.beginPath();
    ctx.moveTo(69, 102);
    ctx.lineTo(91, 102);
    ctx.lineTo(80, 113);
    ctx.closePath();
    fillOutline(ctx, "#ff9a3c", 4);
    return { hx: 80, hy: 48, hr: 54, ey: 92, edx: 18 };
  },

  fox: (ctx, L) => {
    ctx.save();
    ctx.translate(126, 112);
    ctx.rotate(-0.6);
    block(ctx, L, 0, 0, 40, 78, 18, undefined, false);
    box(ctx, 0, -32, 30, 22, 10);
    fillOutline(ctx, CREAM, 4);
    ctx.restore();
    body(ctx, L, 134, 74, 36);
    paws(ctx, L, 152, 13);
    ear(ctx, L, [32, 68, 34, 12, 70, 44], "rgba(80,40,30,0.55)");
    ear(ctx, L, [128, 68, 126, 12, 90, 44], "rgba(80,40,30,0.55)");
    celShape(ctx, () => box(ctx, 80, 84, 116, 88, 26), L.base, L.dark, 44, () => {
      pattern(ctx, L, 80, 84, 48);
      box(ctx, 80, 110, 84, 36, 14);
      fill(ctx, CREAM);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(22, 40, 116, 14);
    });
    shine(ctx, 46, 58);
    eyes(ctx, L, 62, 98, 82);
    blush(ctx, 42, 118, 96);
    box(ctx, 80, 99, 13, 9, 4);
    fill(ctx, INK);
    catMouth(ctx, 80, 105);
    return { hx: 80, hy: 40, hr: 56, ey: 82, edx: 18 };
  },

  frog: (ctx, L) => {
    body(ctx, L, 136, 86, 34);
    for (const x of [54, 106]) {
      box(ctx, x, 152, 30, 12, 5);
      fillOutline(ctx, L.base, 4);
    }
    for (const x of [52, 108]) block(ctx, L, x, 66, 42, 38, 14, undefined, false);
    block(ctx, L, 80, 100, 130, 80, 28);
    shine(ctx, 38, 82);
    if (L.eyes === "glow" || L.eyes === "happy") {
      eyes(ctx, L, 52, 108, 64);
    } else {
      for (const x of [52, 108]) {
        box(ctx, x, 64, 28, 24, 9);
        fillOutline(ctx, "#ffffff", 3.5);
        box(ctx, x, 66, 11, 15, 5);
        fill(ctx, INK);
        box(ctx, x + 3, 62, 5, 5, 2);
        fill(ctx, "#ffffff");
      }
    }
    ctx.beginPath();
    ctx.moveTo(52, 100);
    ctx.lineTo(60, 110);
    ctx.lineTo(100, 110);
    ctx.lineTo(108, 100);
    outline(ctx, 4.5);
    blush(ctx, 36, 124, 108);
    return { hx: 80, hy: 46, hr: 60, ey: 64, edx: 28 };
  },

  ghost: (ctx, L) => {
    for (const dir of [-1, 1]) {
      box(ctx, 80 + dir * 58, 106, 20, 14, 6);
      fillOutline(ctx, L.base, 4);
    }
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(26, 142);
      ctx.lineTo(26, 62);
      ctx.arcTo(26, 28, 60, 28, 34);
      ctx.lineTo(100, 28);
      ctx.arcTo(134, 28, 134, 62, 34);
      ctx.lineTo(134, 142);
      for (const [x, y] of [[121, 130], [108, 142], [94, 130], [80, 142], [66, 130], [52, 142], [39, 130]]) ctx.lineTo(x, y);
      ctx.closePath();
    };
    celShape(ctx, path, L.base, L.dark, 54, () => {
      pattern(ctx, L, 80, 86, 56);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(20, 28, 120, 16);
    });
    shine(ctx, 48, 52);
    eyes(ctx, L, 62, 98, 86);
    blush(ctx, 44, 116, 100);
    box(ctx, 80, 106, 12, 14, 5);
    fill(ctx, INK);
    return { hx: 80, hy: 28, hr: 54, ey: 86, edx: 18 };
  },

  dragon: (ctx, L) => {
    const wing = { base: rgba(darken(L.color, 0.12)), dark: rgba(darken(L.color, 0.3)) };
    for (const dir of [-1, 1]) {
      celShape(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(80 + dir * 30, 114);
        ctx.lineTo(80 + dir * 74, 54);
        ctx.lineTo(80 + dir * 74, 90);
        ctx.lineTo(80 + dir * 62, 92);
        ctx.lineTo(80 + dir * 62, 106);
        ctx.lineTo(80 + dir * 48, 108);
        ctx.lineTo(80 + dir * 48, 120);
        ctx.closePath();
      }, wing.base, wing.dark, 30);
    }
    lTail(ctx, L, [108, 140, 146, 140, 146, 118], 11);
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(80 + dir * 16, 50);
      ctx.lineTo(80 + dir * 26, 14);
      ctx.lineTo(80 + dir * 36, 50);
      ctx.closePath();
      fillOutline(ctx, "#fff1cf", 4);
    }
    body(ctx, L, 132, 82, 42);
    paws(ctx, L);
    block(ctx, L, 80, 80, 114, 90, 28);
    shine(ctx, 46, 52);
    box(ctx, 80, 103, 56, 30, 12);
    fillOutline(ctx, L.light, 4);
    for (const x of [71, 89]) {
      box(ctx, x, 97, 6, 5, 2);
      fill(ctx, INK);
    }
    smile(ctx, 80, 107, 14);
    eyes(ctx, L, 60, 100, 74);
    blush(ctx, 40, 120, 90);
    return { hx: 80, hy: 36, hr: 56, ey: 74, edx: 20 };
  },
};

// ───────────────────────── accessories ─────────────────────────

function crescent(ctx: Ctx, x: number, y: number, r: number): void {
  const cx = x + r * 0.5;
  const cy = y - r * 0.3;
  const r2 = r * 0.85;
  const d = Math.hypot(cx - x, cy - y);
  const a = (r * r - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r * r - a * a));
  const ux = (cx - x) / d;
  const uy = (cy - y) / d;
  const px = x + a * ux;
  const py = y + a * uy;
  const p1 = [px - h * uy, py + h * ux];
  const p2 = [px + h * uy, py - h * ux];
  ctx.beginPath();
  ctx.arc(x, y, r, Math.atan2(p1[1] - y, p1[0] - x), Math.atan2(p2[1] - y, p2[0] - x));
  ctx.arc(cx, cy, r2, Math.atan2(p2[1] - cy, p2[0] - cx), Math.atan2(p1[1] - cy, p1[0] - cx), true);
  ctx.closePath();
}

type AccDraw = (ctx: Ctx, A: Anchor, L: Look) => void;

/** Accessories drawn behind the body. */
const BACK: Record<string, AccDraw> = {
  wings: (ctx) => {
    for (const dir of [-1, 1]) {
      celShape(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(80 + dir * 26, 116);
        ctx.quadraticCurveTo(80 + dir * 56, 52, 80 + dir * 78, 62);
        ctx.quadraticCurveTo(80 + dir * 70, 76, 80 + dir * 78, 84);
        ctx.quadraticCurveTo(80 + dir * 66, 92, 80 + dir * 72, 102);
        ctx.quadraticCurveTo(80 + dir * 58, 104, 80 + dir * 60, 116);
        ctx.quadraticCurveTo(80 + dir * 44, 112, 80 + dir * 26, 116);
        ctx.closePath();
      }, "#ffffff", "#e6dcf2", 30);
    }
  },
  batwings: (ctx) => {
    for (const dir of [-1, 1]) {
      celShape(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(80 + dir * 28, 112);
        ctx.lineTo(80 + dir * 74, 58);
        ctx.lineTo(80 + dir * 70, 84);
        ctx.lineTo(80 + dir * 78, 96);
        ctx.lineTo(80 + dir * 62, 98);
        ctx.lineTo(80 + dir * 60, 114);
        ctx.closePath();
      }, "#4a2a5a", "#2e1a3a", 30);
    }
  },
  sun: (ctx, A) => {
    const cx = A.hx;
    const cy = A.hy + A.hr * 0.8;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r1 = A.hr + 4;
      const r2 = A.hr + 26;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - 0.14) * r1, cy + Math.sin(a - 0.14) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.lineTo(cx + Math.cos(a + 0.14) * r1, cy + Math.sin(a + 0.14) * r1);
      ctx.closePath();
      fillOutline(ctx, i % 2 ? "#ffcf3f" : "#ff9a3c", 4);
    }
  },
};

/** Accessories drawn on top. */
const FRONT: Record<string, AccDraw> = {
  halo: (ctx, A) => {
    ellipse(ctx, A.hx, A.hy - 14, 30, 8);
    outline(ctx, 12);
    ellipse(ctx, A.hx, A.hy - 14, 30, 8);
    outline(ctx, 6, "#ffe066");
  },
  crown: (ctx, A) => {
    const x = A.hx;
    const y = A.hy + 4;
    ctx.beginPath();
    ctx.moveTo(x - 28, y + 6);
    ctx.lineTo(x - 32, y - 22);
    ctx.lineTo(x - 15, y - 8);
    ctx.lineTo(x, y - 30);
    ctx.lineTo(x + 15, y - 8);
    ctx.lineTo(x + 32, y - 22);
    ctx.lineTo(x + 28, y + 6);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, y - 30, 0, y + 6, [[0, "#fff3a0"], [1, "#f0a400"]]), 4.5);
    for (const [dx, c] of [[-15, "#ff4f6d"], [0, "#4fc3ff"], [15, "#5ef08a"]] as [number, string][]) {
      circle(ctx, x + dx, y - 1, 4.5);
      fillOutline(ctx, c, 2.5);
    }
  },
  sprout: (ctx, A) => {
    const x = A.hx;
    const y = A.hy + 4;
    strokeShape(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - 4, y - 14, x + 2, y - 22);
    }, 4, "#3f9a2a");
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + 2, y - 22);
      ctx.bezierCurveTo(x + 2 + dir * 12, y - 42, x + 2 + dir * 36, y - 34, x + 2 + dir * 40, y - 20);
      ctx.bezierCurveTo(x + 2 + dir * 28, y - 12, x + 2 + dir * 12, y - 14, x + 2, y - 22);
      fillOutline(ctx, dir < 0 ? "#8ee05a" : "#6fcf45", 4);
    }
  },
  flame: (ctx, A) => {
    const x = A.hx + 2;
    const y = A.hy + 10;
    ctx.beginPath();
    ctx.moveTo(x - 22, y);
    ctx.bezierCurveTo(x - 30, y - 24, x - 8, y - 30, x - 6, y - 52);
    ctx.bezierCurveTo(x + 4, y - 36, x + 12, y - 40, x + 14, y - 58);
    ctx.bezierCurveTo(x + 34, y - 34, x + 30, y - 10, x + 22, y);
    ctx.closePath();
    fillOutline(ctx, "#ff8a2a", 4.5);
    ctx.beginPath();
    ctx.moveTo(x - 9, y);
    ctx.bezierCurveTo(x - 12, y - 14, x, y - 18, x + 4, y - 32);
    ctx.bezierCurveTo(x + 16, y - 16, x + 14, y - 6, x + 10, y);
    ctx.closePath();
    fill(ctx, "#ffe066");
  },
  icecrown: (ctx, A) => {
    for (const [dx, w, h] of [[-24, 16, 24], [0, 22, 36], [24, 16, 24]]) {
      const x = A.hx + dx;
      const y = A.hy + 10 - Math.abs(dx) * 0.2;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x, y - h);
      ctx.lineTo(x + w / 2, y);
      ctx.lineTo(x, y + 7);
      ctx.closePath();
      fillOutline(ctx, linear(ctx, x - w / 2, y - h, x + w / 2, y, [[0, "#ffffff"], [0.5, "#c9f6ff"], [1, "#69c9ee"]]), 4);
    }
  },
  crystal: (ctx, A) => {
    for (const [dx, w, h, c] of [[-18, 18, 30, "#d9a8ff"], [16, 18, 30, "#8fe8ff"], [0, 24, 46, "#b7f3ff"]] as [number, number, number, string][]) {
      const x = A.hx + dx;
      const y = A.hy + 10;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x - w / 2, y - h * 0.6);
      ctx.lineTo(x, y - h);
      ctx.lineTo(x + w / 2, y - h * 0.6);
      ctx.lineTo(x + w / 2, y);
      ctx.closePath();
      fillOutline(ctx, c, 4);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.2, y - 2);
      ctx.lineTo(x - w * 0.2, y - h * 0.65);
      outline(ctx, 3, "rgba(255,255,255,0.8)");
    }
  },
  bolt: (ctx, A) => {
    boltPath(ctx, A.hx, A.hy + A.hr * 0.32, 13);
    fillOutline(ctx, "#ffe14d", 4);
  },
  sparkantenna: (ctx, A) => {
    strokeShape(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(A.hx + 4, A.hy + 4);
      ctx.quadraticCurveTo(A.hx + 10, A.hy - 12, A.hx + 4, A.hy - 22);
    }, 4, "#b5b5c8");
    boltPath(ctx, A.hx + 4, A.hy - 34, 16);
    fillOutline(ctx, "#ffe14d", 4);
  },
  antenna: (ctx, A) => {
    strokeShape(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(A.hx, A.hy + 4);
      ctx.lineTo(A.hx, A.hy - 20);
    }, 4, "#9aa4b8");
    ctx.save();
    ctx.shadowColor = "#ff4d6d";
    ctx.shadowBlur = 10;
    circle(ctx, A.hx, A.hy - 26, 8);
    fillOutline(ctx, "#ff4d6d", 4);
    ctx.restore();
  },
  ninja: (ctx, A) => {
    const y = A.ey - 18;
    ctx.beginPath();
    ctx.moveTo(A.hx - A.hr * 0.98, y);
    ctx.quadraticCurveTo(A.hx, y - 14, A.hx + A.hr * 0.98, y);
    ctx.lineTo(A.hx + A.hr * 0.95, y + 14);
    ctx.quadraticCurveTo(A.hx, y, A.hx - A.hr * 0.95, y + 14);
    ctx.closePath();
    fillOutline(ctx, "#2f2f3f", 4);
    ctx.beginPath();
    ctx.rect(A.hx - 10, y - 7, 20, 12);
    fillOutline(ctx, "#c9cdd8", 3);
    for (const dy of [0, 12]) {
      ctx.beginPath();
      ctx.moveTo(A.hx + A.hr * 0.9, y + 4);
      ctx.quadraticCurveTo(A.hx + A.hr + 16, y + dy - 6, A.hx + A.hr + 24, y + dy + 4);
      outline(ctx, 7);
      ctx.beginPath();
      ctx.moveTo(A.hx + A.hr * 0.9, y + 4);
      ctx.quadraticCurveTo(A.hx + A.hr + 16, y + dy - 6, A.hx + A.hr + 24, y + dy + 4);
      outline(ctx, 3, "#2f2f3f");
    }
  },
  bandana: (ctx, A) => {
    ctx.beginPath();
    ctx.moveTo(A.hx - A.hr * 0.9, A.hy + A.hr * 0.45);
    ctx.quadraticCurveTo(A.hx, A.hy - A.hr * 0.35, A.hx + A.hr * 0.9, A.hy + A.hr * 0.45);
    ctx.quadraticCurveTo(A.hx, A.hy + A.hr * 0.25, A.hx - A.hr * 0.9, A.hy + A.hr * 0.45);
    ctx.closePath();
    fillOutline(ctx, "#e8434f", 4);
    for (const [x, y] of [[-0.4, 0.15], [0.1, 0.05], [0.45, 0.2]]) {
      circle(ctx, A.hx + x * A.hr, A.hy + y * A.hr + 4, 3);
      fill(ctx, "#ffffff");
    }
  },
  eyepatch: (ctx, A) => {
    const x = A.hx + A.edx;
    ctx.beginPath();
    ctx.moveTo(A.hx - A.hr * 0.8, A.ey - 22);
    ctx.lineTo(x + 18, A.ey + 8);
    outline(ctx, 4);
    ellipse(ctx, x, A.ey, 12, 11);
    fillOutline(ctx, "#2a2230", 4);
  },
  helmet: (ctx, A) => {
    ctx.beginPath();
    ctx.moveTo(A.hx - A.hr * 0.95, A.hy + A.hr * 0.62);
    ctx.bezierCurveTo(A.hx - A.hr, A.hy - A.hr * 0.25, A.hx + A.hr, A.hy - A.hr * 0.25, A.hx + A.hr * 0.95, A.hy + A.hr * 0.62);
    ctx.lineTo(A.hx + A.hr * 0.6, A.hy + A.hr * 0.66);
    ctx.lineTo(A.hx - A.hr * 0.6, A.hy + A.hr * 0.66);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, A.hy - 10, 0, A.hy + A.hr * 0.6, [[0, "#e8ecf4"], [1, "#9aa4b8"]]), 4.5);
    ctx.beginPath();
    ctx.moveTo(A.hx, A.hy - A.hr * 0.05);
    ctx.quadraticCurveTo(A.hx + 6, A.hy - 34, A.hx + 26, A.hy - 30);
    ctx.quadraticCurveTo(A.hx + 14, A.hy - 18, A.hx + 4, A.hy);
    fillOutline(ctx, "#e8434f", 4);
  },
  wizard: (ctx, A) => {
    const y = A.hy + 8;
    ctx.beginPath();
    ctx.moveTo(A.hx - 30, y);
    ctx.quadraticCurveTo(A.hx - 8, y - 30, A.hx + 18, y - 62);
    ctx.quadraticCurveTo(A.hx + 14, y - 28, A.hx + 30, y);
    ctx.closePath();
    fillOutline(ctx, "#7b4bd6", 4.5);
    ellipse(ctx, A.hx, y, 44, 10);
    fillOutline(ctx, "#6a3ac0", 4.5);
    starPath(ctx, A.hx + 4, y - 26, 9);
    fill(ctx, "#ffe066");
  },
  moon: (ctx, A) => {
    crescent(ctx, A.hx + 18, A.hy - 4, 17);
    fillOutline(ctx, "#fff2a8", 4);
  },
  star: (ctx, A) => {
    starPath(ctx, A.hx + 2, A.hy - 8, 19, 0.48);
    fillOutline(ctx, linear(ctx, 0, A.hy - 26, 0, A.hy + 10, [[0, "#fff6b0"], [1, "#ffc21f"]]), 4);
  },
  bubble: (ctx, A) => {
    const x = A.hx - A.hr - 2;
    const y = A.hy + A.hr * 1.5;
    circle(ctx, x, y, 18);
    fill(ctx, radial(ctx, x, y, 18, [[0, "rgba(255,255,255,0.1)"], [0.7, "rgba(190,235,255,0.45)"], [1, "rgba(255,255,255,0.85)"]]));
    circle(ctx, x, y, 18);
    outline(ctx, 3, "rgba(74,47,29,0.6)");
    ellipse(ctx, x - 6, y - 7, 5, 3, -0.6);
    fill(ctx, "#ffffff");
  },
  cloud: (ctx, A) => {
    const pts: [number, number, number][] = [[-16, 2, 12], [0, -8, 16], [16, 2, 12]];
    for (const [dx, dy, r] of pts) {
      circle(ctx, A.hx + dx, A.hy + dy, r);
      outline(ctx, 9);
    }
    for (const [dx, dy, r] of pts) {
      circle(ctx, A.hx + dx, A.hy + dy, r);
      fill(ctx, "#ffffff");
    }
  },
  flower: (ctx, A) => {
    const x = A.hx + A.hr * 0.55;
    const y = A.hy + A.hr * 0.25;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      circle(ctx, x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7.5);
      fillOutline(ctx, "#ff9ec4", 3);
    }
    circle(ctx, x, y, 6);
    fillOutline(ctx, "#ffd23f", 3);
  },
  mushroom: (ctx, A) => {
    const y = A.hy + 14;
    ctx.beginPath();
    ctx.moveTo(A.hx - 44, y);
    ctx.bezierCurveTo(A.hx - 44, y - 40, A.hx + 44, y - 40, A.hx + 44, y);
    ctx.closePath();
    fillOutline(ctx, "#e8434f", 4.5);
    for (const [dx, dy, r] of [[-22, -10, 6], [4, -20, 7], [24, -8, 5]]) {
      circle(ctx, A.hx + dx, y + dy, r);
      fill(ctx, "#ffffff");
    }
  },
  pumpkin: (ctx, A) => {
    strokeShape(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(A.hx, A.hy + 6);
      ctx.quadraticCurveTo(A.hx - 2, A.hy - 10, A.hx + 8, A.hy - 16);
    }, 7, "#5a8a3a");
    ctx.beginPath();
    ctx.moveTo(A.hx + 4, A.hy - 4);
    ctx.bezierCurveTo(A.hx + 20, A.hy - 20, A.hx + 34, A.hy - 6, A.hx + 26, A.hy + 2);
    fillOutline(ctx, "#7cc04a", 3.5);
  },
  bow: (ctx, A) => {
    const x = A.hx + A.hr * 0.55;
    const y = A.hy + A.hr * 0.2;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dir * 18, y - 12);
      ctx.lineTo(x + dir * 18, y + 12);
      ctx.closePath();
      fillOutline(ctx, "#ff6b9a", 4);
    }
    circle(ctx, x, y, 6);
    fillOutline(ctx, "#ff4f86", 3.5);
  },
  beanie: (ctx, A) => {
    ctx.beginPath();
    ctx.moveTo(A.hx - A.hr * 0.85, A.hy + A.hr * 0.5);
    ctx.bezierCurveTo(A.hx - A.hr * 0.85, A.hy - A.hr * 0.4, A.hx + A.hr * 0.85, A.hy - A.hr * 0.4, A.hx + A.hr * 0.85, A.hy + A.hr * 0.5);
    ctx.closePath();
    fillOutline(ctx, "#5aa8ff", 4.5);
    ctx.beginPath();
    ctx.rect(A.hx - A.hr * 0.88, A.hy + A.hr * 0.36, A.hr * 1.76, 14);
    fillOutline(ctx, "#ffffff", 4);
    circle(ctx, A.hx, A.hy - A.hr * 0.2, 9);
    fillOutline(ctx, "#ffffff", 4);
  },
  glasses: (ctx, A) => {
    for (const dir of [-1, 1]) {
      circle(ctx, A.hx + dir * A.edx, A.ey, 13);
      fill(ctx, "rgba(200,240,255,0.35)");
      circle(ctx, A.hx + dir * A.edx, A.ey, 13);
      outline(ctx, 4);
    }
    ctx.beginPath();
    ctx.moveTo(A.hx - A.edx + 13, A.ey);
    ctx.lineTo(A.hx + A.edx - 13, A.ey);
    outline(ctx, 4);
  },
  rock: (ctx, A) => {
    ellipse(ctx, A.hx - 6, A.hy + 4, 20, 12, -0.1);
    fillOutline(ctx, "#4a3a44", 4.5);
    ctx.beginPath();
    ctx.moveTo(A.hx - 16, A.hy + 2);
    ctx.lineTo(A.hx - 4, A.hy + 6);
    ctx.lineTo(A.hx + 6, A.hy);
    outline(ctx, 3, "#ffb02e");
  },
  pebble: (ctx, A) => {
    ellipse(ctx, A.hx + 26, A.hy + 4, 15, 10, 0.2);
    fillOutline(ctx, "#cfcac2", 4);
    ellipse(ctx, A.hx + 22, A.hy + 1, 5, 3, 0.2);
    fill(ctx, "rgba(255,255,255,0.8)");
  },
  horns: (ctx, A) => {
    for (const dir of [-1, 1]) {
      const x = A.hx + dir * A.hr * 0.45;
      const y = A.hy + A.hr * 0.18;
      ctx.beginPath();
      ctx.moveTo(x - dir * 10, y + 4);
      ctx.quadraticCurveTo(x + dir * 2, y - 26, x + dir * 18, y - 30);
      ctx.quadraticCurveTo(x + dir * 8, y - 10, x + dir * 10, y + 6);
      ctx.closePath();
      fillOutline(ctx, "#8a1f3a", 4);
    }
  },
};

export function drawPet(ctx: Ctx, def: ItemDef, v: Variant): void {
  ctx.translate(0, HEADROOM);
  const L = lookFor(ctx, def, v);
  ellipse(ctx, 80, 152, 52, 8);
  fill(ctx, "rgba(74,47,29,0.2)");
  // Anchors are only known after drawing the body, but back accessories go first:
  // use a dry run on a scratch canvas to find them.
  const scratch = document.createElement("canvas").getContext("2d")!;
  const A = SPECIES[def.species](scratch, lookFor(scratch, def, v));
  for (const acc of def.accs) BACK[acc]?.(ctx, A, L);
  SPECIES[def.species](ctx, L);
  for (const acc of def.accs) FRONT[acc]?.(ctx, A, L);
  if (L.sparkle) {
    for (const [x, y, r] of [[18, 30, 10], [146, 46, 8], [140, 132, 7], [14, 112, 7]]) twinkle(ctx, x, y, r, L.sparkle);
  }
}

/** Texture key for a pet, drawing it on first use. */
export function petTexture(scene: Phaser.Scene, id: string, v: Variant): string {
  return canvasTexture(scene, petKey(id, v), PET_SIZE, PET_H, (ctx) => drawPet(ctx, ITEMS[id], v));
}

/** Dark silhouette for pets not discovered yet. */
export function lockedTexture(scene: Phaser.Scene, id: string): string {
  return canvasTexture(scene, `pet_${id}_locked`, PET_SIZE, PET_H, (ctx) => {
    drawPet(ctx, ITEMS[id], "normal");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "#6b5440";
    ctx.fillRect(0, 0, PET_SIZE, PET_H);
  });
}
