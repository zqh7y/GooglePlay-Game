import Phaser from "phaser";
import { ITEMS, ItemDef, Variant } from "../data/items";
import { Species } from "../data/pets";
import {
  Ctx, INK, Paint, boltPath, canvasTexture, celShape, circle, darken, ellipse, fill, fillOutline, hexToNum,
  lighten, linear, outline, radial, rainbowGradient, rgba, starPath, strokeShape, twinkle,
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
const PINK = "rgba(255,150,180,0.9)";
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

// ───────────────────────── faces ─────────────────────────

function eyes(ctx: Ctx, L: Look, x1: number, x2: number, y: number, s = 1): void {
  for (const x of [x1, x2]) {
    if (L.eyes === "glow") {
      ellipse(ctx, x, y, 11 * s, 12 * s);
      fill(ctx, radial(ctx, x, y, 12 * s, [[0, "#ffffff"], [0.55, "#f0e0ff"], [1, "rgba(200,140,255,0.2)"]]));
      continue;
    }
    if (L.eyes === "happy") {
      ctx.beginPath();
      ctx.arc(x, y + 4 * s, 7.5 * s, Math.PI * 1.15, Math.PI * 1.85);
      outline(ctx, 4.5 * s);
      continue;
    }
    ellipse(ctx, x, y, 7.5 * s, 10 * s);
    fill(ctx, INK);
    ellipse(ctx, x + 2.5 * s, y - 4 * s, 3 * s, 3.4 * s);
    fill(ctx, "#ffffff");
  }
}

function blush(ctx: Ctx, x1: number, x2: number, y: number): void {
  for (const x of [x1, x2]) {
    ellipse(ctx, x, y, 9, 5.5);
    fill(ctx, "rgba(255,120,150,0.45)");
  }
}

function smile(ctx: Ctx, x: number, y: number, r = 7): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI);
  outline(ctx, 4);
}

function catMouth(ctx: Ctx, x: number, y: number): void {
  ctx.beginPath();
  ctx.arc(x - 5, y, 5, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.moveTo(x + 10, y);
  ctx.arc(x + 5, y, 5, 0.1 * Math.PI, 0.9 * Math.PI);
  outline(ctx, 3.5);
}

function shine(ctx: Ctx, x: number, y: number, s = 1): void {
  ellipse(ctx, x, y, 10 * s, 6 * s, -0.6);
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

// ───────────────────────── species ─────────────────────────

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

function bodyBlob(ctx: Ctx, L: Look, x: number, y: number, rx: number, ry: number, belly = true): void {
  celShape(ctx, () => ellipse(ctx, x, y, rx, ry), L.base, L.dark, rx, () => pattern(ctx, L, x, y, rx));
  if (belly) {
    ellipse(ctx, x, y + ry * 0.2, rx * 0.55, ry * 0.58);
    fill(ctx, L.light);
  }
}

function paws(ctx: Ctx, L: Look, y = 150, dx = 15): void {
  for (const x of [80 - dx, 80 + dx]) {
    ellipse(ctx, x, y, 11, 7);
    fillOutline(ctx, L.light, 4);
  }
}

const SPECIES: Record<Species, (ctx: Ctx, L: Look) => Anchor> = {
  slime: (ctx, L) => {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(24, 146);
      ctx.bezierCurveTo(10, 98, 40, 42, 80, 42);
      ctx.bezierCurveTo(120, 42, 150, 98, 136, 146);
      ctx.quadraticCurveTo(80, 156, 24, 146);
      ctx.closePath();
    };
    celShape(ctx, path, L.base, L.dark, 60, () => pattern(ctx, L, 80, 98, 60));
    shine(ctx, 52, 68);
    eyes(ctx, L, 58, 102, 100);
    blush(ctx, 42, 118, 114);
    smile(ctx, 80, 110);
    return { hx: 80, hy: 44, hr: 56, ey: 100, edx: 22 };
  },

  cat: (ctx, L) => {
    strokeShape(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(110, 138);
      ctx.bezierCurveTo(150, 140, 152, 100, 134, 90);
    }, 12, L.base);
    bodyBlob(ctx, L, 80, 128, 40, 25);
    paws(ctx, L);
    ear(ctx, L, [30, 62, 38, 14, 66, 40], PINK);
    ear(ctx, L, [130, 62, 122, 14, 94, 40], PINK);
    celShape(ctx, () => ellipse(ctx, 80, 76, 56, 44), L.base, L.dark, 56, () => pattern(ctx, L, 80, 76, 56));
    shine(ctx, 50, 52);
    eyes(ctx, L, 58, 102, 78);
    blush(ctx, 40, 120, 92);
    ctx.beginPath();
    ctx.moveTo(75, 88);
    ctx.lineTo(85, 88);
    ctx.lineTo(80, 94);
    ctx.closePath();
    fill(ctx, "#ff8fae");
    catMouth(ctx, 80, 96);
    ctx.globalAlpha = 0.45;
    for (const dir of [-1, 1]) {
      for (const dy of [-3, 5]) {
        ctx.beginPath();
        ctx.moveTo(80 + dir * 44, 90 + dy * 0.3);
        ctx.lineTo(80 + dir * 66, 86 + dy);
        outline(ctx, 2.5);
      }
    }
    ctx.globalAlpha = 1;
    return { hx: 80, hy: 34, hr: 56, ey: 78, edx: 22 };
  },

  dog: (ctx, L) => {
    strokeShape(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(112, 128);
      ctx.quadraticCurveTo(132, 122, 138, 104);
    }, 11, L.base);
    bodyBlob(ctx, L, 80, 130, 40, 24);
    paws(ctx, L);
    celShape(ctx, () => ellipse(ctx, 80, 80, 52, 44), L.base, L.dark, 52, () => pattern(ctx, L, 80, 80, 52));
    const earC = rgba(darken(L.color, 0.28));
    const earD = rgba(darken(L.color, 0.4));
    for (const dir of [-1, 1]) {
      celShape(ctx, () => ellipse(ctx, 80 + dir * 50, 82, 15, 29, dir * 0.35), earC, earD, 18);
    }
    shine(ctx, 54, 54);
    ellipse(ctx, 80, 101, 23, 15);
    fillOutline(ctx, L.light, 4);
    ellipse(ctx, 80, 94, 8, 6);
    fill(ctx, INK);
    ellipse(ctx, 78, 92, 3, 2);
    fill(ctx, "rgba(255,255,255,0.8)");
    smile(ctx, 80, 101, 6);
    eyes(ctx, L, 61, 99, 76);
    blush(ctx, 44, 116, 94);
    return { hx: 80, hy: 38, hr: 52, ey: 76, edx: 19 };
  },

  bunny: (ctx, L) => {
    bodyBlob(ctx, L, 80, 134, 36, 21);
    paws(ctx, L, 151, 14);
    for (const dir of [-1, 1]) {
      celShape(ctx, () => ellipse(ctx, 80 + dir * 20, 40, 13, 34, dir * 0.18), L.base, L.dark, 16);
      ellipse(ctx, 80 + dir * 20, 44, 6, 23, dir * 0.18);
      fill(ctx, PINK);
    }
    celShape(ctx, () => ellipse(ctx, 80, 96, 48, 40), L.base, L.dark, 48, () => pattern(ctx, L, 80, 96, 48));
    shine(ctx, 56, 76);
    eyes(ctx, L, 62, 98, 96);
    blush(ctx, 46, 114, 110);
    ellipse(ctx, 80, 106, 5, 3.5);
    fill(ctx, "#ff8fae");
    catMouth(ctx, 80, 111);
    return { hx: 80, hy: 58, hr: 48, ey: 96, edx: 18 };
  },

  bear: (ctx, L) => {
    const panda = L.pattern === "panda";
    bodyBlob(ctx, L, 80, 132, 42, 24);
    paws(ctx, L);
    for (const x of [36, 124]) {
      if (panda) {
        circle(ctx, x, 50, 17);
        fillOutline(ctx, "#3a2f3a");
      } else {
        celShape(ctx, () => circle(ctx, x, 50, 17), L.base, L.dark, 17);
        circle(ctx, x, 51, 8);
        fill(ctx, L.light);
      }
    }
    celShape(ctx, () => ellipse(ctx, 80, 86, 52, 46), L.base, L.dark, 52, () => {
      if (!panda) pattern(ctx, L, 80, 86, 52);
    });
    if (panda) {
      for (const dir of [-1, 1]) {
        ellipse(ctx, 80 + dir * 20, 88, 12, 15, dir * 0.45);
        fill(ctx, "#3a2f3a");
      }
    }
    shine(ctx, 54, 58);
    ellipse(ctx, 80, 106, 20, 14);
    fillOutline(ctx, L.light, 4);
    ellipse(ctx, 80, 100, 8, 5.5);
    fill(ctx, INK);
    smile(ctx, 80, 106, 5);
    if (panda) {
      for (const x of [60, 100]) {
        circle(ctx, x, 87, 6);
        fill(ctx, "#ffffff");
        circle(ctx, x + 1, 88, 3.5);
        fill(ctx, INK);
      }
    } else {
      eyes(ctx, L, 60, 100, 86);
    }
    blush(ctx, 42, 118, 100);
    return { hx: 80, hy: 40, hr: 52, ey: 86, edx: 20 };
  },

  chick: (ctx, L) => {
    for (const x of [66, 94]) {
      ellipse(ctx, x, 151, 10, 6);
      fillOutline(ctx, "#ff9a3c", 4);
    }
    for (const dir of [-1, 1]) {
      celShape(ctx, () => ellipse(ctx, 80 + dir * 50, 104, 12, 20, dir * -0.4), L.base, L.dark, 16);
    }
    for (const [dx, h] of [[-8, 16], [4, 22], [14, 14]]) {
      ctx.beginPath();
      ctx.moveTo(80 + dx - 6, 50);
      ctx.quadraticCurveTo(80 + dx - 4, 50 - h, 80 + dx + 4, 48 - h);
      ctx.quadraticCurveTo(80 + dx + 2, 44 - h * 0.4, 80 + dx + 6, 50);
      fillOutline(ctx, L.base, 4);
    }
    celShape(ctx, () => ellipse(ctx, 80, 98, 54, 52), L.base, L.dark, 54, () => pattern(ctx, L, 80, 98, 54));
    ellipse(ctx, 80, 122, 30, 20);
    fill(ctx, L.light);
    shine(ctx, 50, 70);
    eyes(ctx, L, 62, 98, 90);
    blush(ctx, 46, 114, 104);
    ctx.beginPath();
    ctx.moveTo(69, 100);
    ctx.lineTo(91, 100);
    ctx.lineTo(80, 112);
    ctx.closePath();
    fillOutline(ctx, "#ff9a3c", 4);
    return { hx: 80, hy: 48, hr: 50, ey: 90, edx: 18 };
  },

  fox: (ctx, L) => {
    celShape(ctx, () => ellipse(ctx, 124, 112, 22, 36, -0.7), L.base, L.dark, 26);
    ellipse(ctx, 140, 92, 11, 13, -0.7);
    fillOutline(ctx, CREAM, 4);
    bodyBlob(ctx, L, 80, 132, 36, 22);
    paws(ctx, L, 151, 13);
    ear(ctx, L, [34, 68, 36, 14, 70, 44], "rgba(80,40,30,0.55)");
    ear(ctx, L, [126, 68, 124, 14, 90, 44], "rgba(80,40,30,0.55)");
    const head = () => ellipse(ctx, 80, 84, 52, 42);
    celShape(ctx, head, L.base, L.dark, 52, () => {
      pattern(ctx, L, 80, 84, 52);
      ellipse(ctx, 80, 106, 38, 20);
      fill(ctx, CREAM);
    });
    shine(ctx, 54, 60);
    eyes(ctx, L, 62, 98, 82);
    blush(ctx, 44, 116, 96);
    ellipse(ctx, 80, 98, 6, 4.5);
    fill(ctx, INK);
    catMouth(ctx, 80, 104);
    return { hx: 80, hy: 42, hr: 52, ey: 82, edx: 18 };
  },

  frog: (ctx, L) => {
    bodyBlob(ctx, L, 80, 134, 42, 20);
    for (const x of [54, 106]) {
      ellipse(ctx, x, 151, 14, 7);
      fillOutline(ctx, L.base, 4);
    }
    for (const x of [52, 108]) celShape(ctx, () => circle(ctx, x, 66, 20), L.base, L.dark, 20);
    celShape(ctx, () => ellipse(ctx, 80, 100, 62, 40), L.base, L.dark, 62, () => pattern(ctx, L, 80, 100, 62));
    shine(ctx, 46, 86);
    if (L.eyes === "glow" || L.eyes === "happy") {
      eyes(ctx, L, 52, 108, 64);
    } else {
      for (const x of [52, 108]) {
        circle(ctx, x, 64, 13);
        fillOutline(ctx, "#ffffff", 3.5);
        ellipse(ctx, x, 66, 6, 7.5);
        fill(ctx, INK);
        circle(ctx, x + 2, 63, 2.5);
        fill(ctx, "#ffffff");
      }
    }
    ctx.beginPath();
    ctx.arc(80, 96, 28, 0.15 * Math.PI, 0.85 * Math.PI);
    outline(ctx, 4.5);
    blush(ctx, 38, 122, 108);
    return { hx: 80, hy: 46, hr: 60, ey: 64, edx: 28 };
  },

  ghost: (ctx, L) => {
    for (const dir of [-1, 1]) {
      ellipse(ctx, 80 + dir * 56, 106, 11, 7, dir * -0.5);
      fillOutline(ctx, L.base, 4);
    }
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(26, 140);
      ctx.lineTo(26, 82);
      ctx.arc(80, 82, 54, Math.PI, 0);
      ctx.lineTo(134, 140);
      ctx.quadraticCurveTo(125, 154, 116, 142);
      ctx.quadraticCurveTo(107, 130, 98, 142);
      ctx.quadraticCurveTo(89, 154, 80, 142);
      ctx.quadraticCurveTo(71, 130, 62, 142);
      ctx.quadraticCurveTo(53, 154, 44, 142);
      ctx.quadraticCurveTo(35, 130, 26, 140);
      ctx.closePath();
    };
    celShape(ctx, path, L.base, L.dark, 56, () => pattern(ctx, L, 80, 86, 56));
    shine(ctx, 52, 52);
    eyes(ctx, L, 62, 98, 86);
    blush(ctx, 46, 114, 100);
    ellipse(ctx, 80, 104, 6, 7);
    fill(ctx, INK);
    return { hx: 80, hy: 28, hr: 54, ey: 86, edx: 18 };
  },

  dragon: (ctx, L) => {
    const wingC = rgba(darken(L.color, 0.12));
    const wingD = rgba(darken(L.color, 0.3));
    for (const dir of [-1, 1]) {
      celShape(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(80 + dir * 30, 112);
        ctx.lineTo(80 + dir * 72, 56);
        ctx.quadraticCurveTo(80 + dir * 70, 82, 80 + dir * 76, 92);
        ctx.quadraticCurveTo(80 + dir * 62, 92, 80 + dir * 64, 106);
        ctx.quadraticCurveTo(80 + dir * 50, 104, 80 + dir * 48, 120);
        ctx.closePath();
      }, wingC, wingD, 30);
    }
    strokeShape(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(108, 140);
      ctx.quadraticCurveTo(140, 142, 148, 120);
    }, 11, L.base);
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(80 + dir * 14, 50);
      ctx.quadraticCurveTo(80 + dir * 26, 26, 80 + dir * 32, 14);
      ctx.quadraticCurveTo(80 + dir * 34, 34, 80 + dir * 30, 52);
      ctx.closePath();
      fillOutline(ctx, "#fff1cf", 4);
    }
    bodyBlob(ctx, L, 80, 130, 40, 24);
    paws(ctx, L);
    celShape(ctx, () => ellipse(ctx, 80, 80, 52, 44), L.base, L.dark, 52, () => pattern(ctx, L, 80, 80, 52));
    shine(ctx, 54, 56);
    ellipse(ctx, 80, 101, 26, 16);
    fillOutline(ctx, L.light, 4);
    for (const x of [72, 88]) {
      ellipse(ctx, x, 97, 3, 2.5);
      fill(ctx, INK);
    }
    smile(ctx, 80, 103, 8);
    eyes(ctx, L, 60, 100, 74);
    blush(ctx, 42, 118, 90);
    return { hx: 80, hy: 38, hr: 52, ey: 74, edx: 20 };
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
