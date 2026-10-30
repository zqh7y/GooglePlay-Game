import Phaser from "phaser";
import {
  Ctx, boltPath, canvasTexture, circle, darken, ellipse, fill, fillOutline, lighten, mix, outline, radial, rgba,
  starPath, twinkle,
} from "./draw";
import { Toon, toon } from "./toon";
import { WALK_KEYS, WALK_POSES, arms, head, legs, pose, squash, withPose } from "./pose";

const EYE = "#24161e";

// ───────────────────────── hero ─────────────────────────

export const HERO_W = 120;
export const HERO_H = 160;
/** Where the hero holds its main gadget, relative to its feet (origin 0.5, 0.95). */
export const HERO_HAND = { x: 44, y: -48 };

const HERO_INK = "#2a1c1c";

/**
 * The hero: something lives in a cardboard box. Drawn as a 3D box seen from the front-right:
 * a lit front face with the dark slot and glowing eyes, a shaded side face, an open top
 * with flaps, and two little legs. step 0 = standing, 1 and 2 = walking.
 */
function drawHero(ctx: Ctx, step: number): void {
  const b = step ? -3 : 0;
  const shape = (pts: [number, number][], paint: string | CanvasGradient, lw = 4) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + b) : ctx.moveTo(x, y + b)));
    ctx.closePath();
    ctx.fillStyle = paint;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
    ctx.strokeStyle = HERO_INK;
    ctx.stroke();
  };
  const grad = (y0: number, y1: number, a: string, c: string) => {
    const g = ctx.createLinearGradient(0, y0 + b, 0, y1 + b);
    g.addColorStop(0, a);
    g.addColorStop(1, c);
    return g;
  };
  // the box: front face x 16..86, side face 20 deep, top 12 up
  const F = { l: 16, r: 86, t: 54, bot: 126 };
  const D = { x: 20, y: -12 };
  ellipse(ctx, 64, 151, 40, 7);
  fill(ctx, "rgba(42,26,30,0.25)");
  // legs: thin and dark, swinging when it walks
  const swing = [0, 7, -7][step];
  ctx.lineCap = "round";
  for (const [x, dir] of [[40, 1], [70, -1]] as [number, number][]) {
    const fx = x + swing * dir;
    ctx.beginPath();
    ctx.moveTo(x, 120 + b);
    ctx.lineTo(fx, 145);
    ctx.lineWidth = 10;
    ctx.strokeStyle = HERO_INK;
    ctx.stroke();
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = "#4a3a44";
    ctx.stroke();
    ellipse(ctx, fx + 4, 148, 11, 6);
    fill(ctx, "#4a3a44");
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = HERO_INK;
    ctx.stroke();
  }
  // back flap, standing up behind the opening
  shape([[F.l + D.x, F.t + D.y], [F.l + D.x - 4, F.t + D.y - 26], [F.r + D.x + 2, F.t + D.y - 30], [F.r + D.x, F.t + D.y]], grad(10, 44, "#c8955a", "#a8743a"));
  // the inside of the box (dark) seen through the open top
  shape([[F.l, F.t], [F.l + D.x, F.t + D.y], [F.r + D.x, F.t + D.y], [F.r, F.t]], "#2a1608");
  ctx.fillStyle = "rgba(255,200,120,0.12)";
  ctx.beginPath();
  ctx.moveTo(F.l + 6, F.t - 1 + b);
  ctx.lineTo(F.l + D.x + 4, F.t + D.y + 2 + b);
  ctx.lineTo(F.l + D.x + 18, F.t + D.y + 2 + b);
  ctx.lineTo(F.l + 22, F.t - 1 + b);
  ctx.fill();
  // side face, in shadow
  shape([[F.r, F.t], [F.r + D.x, F.t + D.y], [F.r + D.x, F.bot + D.y], [F.r, F.bot]], grad(F.t, F.bot, "#b8844a", "#7a5226"));
  ctx.strokeStyle = "rgba(60,30,10,0.35)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(F.r + 10, F.t - 6 + b);
  ctx.lineTo(F.r + 10, F.bot - 6 + b);
  ctx.stroke();
  // front face, in the light
  shape([[F.l, F.t], [F.r, F.t], [F.r, F.bot], [F.l, F.bot]], grad(F.t, F.bot, "#f0c88c", "#b8803e"));
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(F.l + 3, F.t + 3 + b, F.r - F.l - 6, 5);
  // packing tape over the front and across the top
  ctx.fillStyle = "rgba(120,70,25,0.3)";
  ctx.fillRect(44, F.t + b, 14, F.bot - F.t);
  ctx.beginPath();
  ctx.moveTo(44, F.t + b);
  ctx.lineTo(44 + D.x * 0.9, F.t + D.y * 0.9 + b);
  ctx.lineTo(58 + D.x * 0.9, F.t + D.y * 0.9 + b);
  ctx.lineTo(58, F.t + b);
  ctx.fill();
  // side flaps, opened out
  shape([[F.l, F.t], [F.l + D.x, F.t + D.y], [F.l + D.x - 14, F.t + D.y - 20], [F.l - 12, F.t - 14]], grad(20, 60, "#e6b97c", "#c08a4a"), 3.5);
  shape([[F.r, F.t], [F.r + D.x, F.t + D.y], [F.r + D.x + 10, F.t + D.y - 22], [F.r + 8, F.t - 16]], grad(20, 60, "#c8955a", "#9a6a34"), 3.5);
  // "this side up" arrows
  ctx.strokeStyle = "rgba(70,36,12,0.5)";
  ctx.lineWidth = 3;
  for (const x of [28, 74]) {
    ctx.beginPath();
    ctx.moveTo(x, 120 + b);
    ctx.lineTo(x, 106 + b);
    ctx.moveTo(x - 5, 111 + b);
    ctx.lineTo(x, 105 + b);
    ctx.lineTo(x + 5, 111 + b);
    ctx.stroke();
  }
  // the dark slot, cut in with a little depth, and the eyes glowing inside
  shape([[22, 68], [80, 68], [80, 88], [22, 88]], "#0a0614", 3.5);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(24, 84 + b, 54, 3);
  for (const x of [40, 64]) {
    const g = radial(ctx, x, 78 + b, 11, [[0, "rgba(255,255,255,0.95)"], [0.4, "rgba(255,250,200,0.5)"], [1, "rgba(255,250,200,0)"]]);
    ctx.fillStyle = g;
    ctx.fillRect(x - 11, 68 + b, 22, 20);
    ellipse(ctx, x, 78 + b, 4, 5);
    fill(ctx, "#ffffff");
  }
  // a hand pokes out of the side to hold the gadget
  ctx.beginPath();
  circle(ctx, 104, 104 + b, 8);
  fill(ctx, "#4a3a44");
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = HERO_INK;
  ctx.stroke();
}

// ───────────────────────── monsters ─────────────────────────

export const olFor = (c: number) => rgba(mix(darken(c, 0.65), 0x1a0e18, 0.5));

/** Angry eyes with brows and a toothy grin. */
export function angryFace(t: Toon, cx: number, cy: number, gap: number, s = 1, glow?: string): void {
  const { ctx, E, C, paint } = t;
  for (const d of [-1, 1]) {
    const ex = cx + d * gap;
    if (glow) {
      // glowing eyes: a wide bloom, a hot core and a slit
      paint(radial(ctx, ex, cy, 22 * s, [[0, glow], [0.45, glow.replace(/[\d.]+\)$/, "0.35)")], [1, "rgba(0,0,0,0)"]]), () => C(ex, cy, 22 * s));
      paint(radial(ctx, ex, cy, 14 * s, [[0, "#ffffff"], [0.35, glow], [1, "rgba(0,0,0,0)"]]), () => C(ex, cy, 14 * s));
      if (t.pro) paint("rgba(255,255,255,0.95)", () => E(ex, cy, 2.2 * s, 5 * s));
    } else if (t.pro) {
      // a shaded eyeball, a coloured iris, a pupil and two glints
      t.part(() => E(ex, cy, 8.5 * s, 9.5 * s), 0xf4f0ea, undefined, 3 * s);
      paint(radial(ctx, ex - d * 1.5 * s, cy + 1.5 * s, 5.2 * s, [[0, "#ffb84a"], [0.55, "#e0602a"], [1, "#6a1a12"]]), () => C(ex - d * 1.5 * s, cy + 1.5 * s, 5.2 * s));
      paint(EYE, () => C(ex - d * 1.5 * s, cy + 1.5 * s, 2.8 * s));
      paint("#ffffff", () => C(ex - d * 3 * s, cy - 0.8 * s, 1.7 * s));
      paint("rgba(255,255,255,0.7)", () => C(ex - d * 0.2 * s, cy + 3.2 * s, 0.9 * s));
      // the upper lid casts a shadow on the eye
      paint("rgba(40,20,30,0.28)", () => E(ex, cy - 6 * s, 8.5 * s, 3.5 * s));
    } else {
      t.part(() => E(ex, cy, 8 * s, 9 * s), 0xffffff, undefined, 3 * s);
      paint(EYE, () => C(ex - d * 1.5 * s, cy + 1.5 * s, 4.5 * s));
      paint("#ffffff", () => C(ex - d * 2.5 * s, cy - 0.5 * s, 1.5 * s));
    }
    ctx.lineWidth = 5 * s;
    ctx.lineCap = "round";
    ctx.strokeStyle = EYE;
    ctx.beginPath();
    ctx.moveTo(cx + d * (gap + 11 * s), cy - 13 * s);
    ctx.lineTo(cx + d * (gap - 7 * s), cy - 6 * s);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 12 * s, cy + 13 * s);
  ctx.quadraticCurveTo(cx, cy + 22 * s, cx + 12 * s, cy + 13 * s);
  ctx.closePath();
  ctx.fillStyle = EYE;
  ctx.fill();
  if (t.pro) {
    // a red mouth with a tongue inside
    paint("#7a1a2a", () => E(cx, cy + 16.5 * s, 7 * s, 3 * s));
    paint("#e8506a", () => E(cx + 1 * s, cy + 18 * s, 4.5 * s, 2 * s));
  }
  paint("#ffffff", () => {
    t.poly([[cx - 9 * s, cy + 13.5 * s], [cx - 4 * s, cy + 13.5 * s], [cx - 6.5 * s, cy + 18 * s]], 1);
    t.poly([[cx + 4 * s, cy + 13.5 * s], [cx + 9 * s, cy + 13.5 * s], [cx + 6.5 * s, cy + 18 * s]], 1);
  });
}

export function slime(color: number, extra = ""): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, olFor(color), 5, true);
    t.paint("rgba(30,15,25,0.22)", () => t.E(70, 124, 50, 7));
    squash(ctx, 70, 122, () => {
    if (extra === "stem") {
      t.tube(() => {
        ctx.moveTo(70, 34);
        ctx.quadraticCurveTo(72, 18, 82, 12);
      }, 7, 0x4f8a2a);
      t.part(() => t.E(92, 22, 13, 6, -0.5), 0x6fcf4a, undefined, 3);
    }
    t.part(() => {
      ctx.moveTo(22, 120);
      ctx.bezierCurveTo(8, 118, 16, 80, 34, 62);
      ctx.bezierCurveTo(50, 44, 58, 32, 72, 32);
      ctx.bezierCurveTo(92, 32, 112, 52, 120, 78);
      ctx.bezierCurveTo(128, 104, 126, 122, 108, 122);
      ctx.closePath();
    }, color, () => {
      t.paint(rgba(lighten(color, 0.2)), () => t.E(70, 108, 40, 12));
      if (extra === "stem") {
        ctx.lineWidth = 4;
        ctx.strokeStyle = rgba(darken(color, 0.2));
        for (const x of [48, 92]) {
          ctx.beginPath();
          ctx.moveTo(x, 44);
          ctx.quadraticCurveTo(x + (x < 70 ? -14 : 14), 80, x, 118);
          ctx.stroke();
        }
      }
      if (extra === "sand") for (const [x, y] of [[40, 70], [96, 66], [104, 96], [34, 98]]) t.paint(rgba(darken(color, 0.25)), () => t.C(x, y, 3));
    });
    if (extra === "ice") {
      t.part(() => {
        t.poly([[52, 42], [56, 18], [64, 38]], 2);
        t.poly([[66, 36], [74, 8], [82, 36]], 2);
        t.poly([[84, 40], [94, 20], [96, 44]], 2);
      }, 0xe8fbff, undefined, 3);
    }
    t.gloss(46, 52, 10, 6);
    angryFace(t, 72, 78, 17, 1);
    }, 0.08);
  };
}

export function mushroom(cap: number, stem: number, glow = false): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, olFor(cap), 5, true);
    t.paint("rgba(30,15,25,0.22)", () => t.E(65, 142, 40, 6));
    legs(ctx, 65, () => t.part(() => {
      t.E(46, 140, 12, 6);
      t.E(84, 140, 12, 6);
    }, darken(stem, 0.2)), 6);
    t.part(() => t.rect(65, 106, 62, 64, 22), stem);
    angryFace(t, 65, 102, 14, 0.95);
    head(ctx, 65, 74, () => {
    if (glow) t.paint(radial(ctx, 65, 46, 70, [[0, rgba(cap, 0.45)], [1, rgba(cap, 0)]]), () => t.C(65, 46, 70));
    t.part(() => {
      ctx.moveTo(8, 72);
      ctx.bezierCurveTo(4, 20, 126, 20, 122, 72);
      ctx.quadraticCurveTo(65, 84, 8, 72);
      ctx.closePath();
    }, cap, () => {
      for (const [x, y, r] of [[40, 42, 9], [76, 34, 11], [100, 56, 7], [28, 62, 6], [62, 60, 6]] as [number, number, number][]) {
        t.paint(glow ? "rgba(255,255,255,0.85)" : "#fff6ec", () => t.C(x, y, r));
      }
    });
    t.gloss(36, 34, 12, 5);
    }, 3, 0.05);
  };
}

export function bat(color: number, beak = false): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, olFor(color), 5, true);
    const wing = (s: number) => {
      const m = (x: number) => (s < 0 ? 170 - x : x);
      t.poly([[m(62), 48], [m(10), 20], [m(14), 54], [m(26), 50], [m(30), 70], [m(44), 62], [m(54), 76], [m(66), 66]], 4);
    };
    arms(ctx, 85, 22, 52, 0.4, () => t.part(() => {
      wing(1);
      wing(-1);
    }, darken(color, 0.15)), true);
    if (beak) {
      t.part(() => t.poly([[66, 86], [104, 86], [85, 104]], 4), 0x2a2a34);
    }
    t.part(() => {
      t.E(85, 58, 34, 30);
      if (!beak) {
        t.poly([[58, 40], [58, 8], [80, 32]], 5);
        t.poly([[90, 32], [112, 8], [112, 40]], 5);
      } else {
        t.poly([[76, 30], [82, 10], [92, 30]], 4);
      }
    }, color, () => t.paint(rgba(lighten(color, 0.2)), () => t.E(85, 74, 18, 10)));
    t.gloss(66, 40, 8, 5);
    angryFace(t, 85, 56, 14, 0.85);
    if (beak) t.part(() => t.poly([[76, 68], [94, 68], [85, 84]], 3), 0xffb83f, undefined, 3);
  };
}

export function cactus(ctx: Ctx): void {
  const c = 0x5fb84a;
  const t = toon(ctx, olFor(c), 5, true);
  t.paint("rgba(30,15,25,0.22)", () => t.E(65, 152, 40, 6));
  arms(ctx, 65, 26, 104, 0.2, () => t.part(() => {
    t.rect(26, 84, 22, 40, 11);
    t.rect(36, 102, 30, 18, 9);
    t.rect(104, 74, 22, 38, 11);
    t.rect(94, 90, 30, 18, 9);
  }, darken(c, 0.04)));
  t.part(() => {
    t.rect(65, 98, 56, 104, 28);
  }, c, () => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(darken(c, 0.25));
    for (const x of [52, 78]) {
      ctx.beginPath();
      ctx.moveTo(x, 54);
      ctx.lineTo(x, 146);
      ctx.stroke();
    }
  });
  ctx.strokeStyle = "#fff6d0";
  ctx.lineWidth = 2;
  for (const [x, y] of [[42, 60], [88, 66], [40, 130], [92, 128], [20, 72], [110, 60]]) {
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 4, y);
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y + 4);
    ctx.stroke();
  }
  head(ctx, 65, 60, () => {
    t.part(() => {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        t.E(65 + Math.cos(a) * 7, 44 + Math.sin(a) * 7, 6, 5, a);
      }
    }, 0xff7aa8, undefined, 3);
    t.paint("#ffe066", () => t.C(65, 44, 4));
  }, 3, 0.1);
  angryFace(t, 65, 92, 13, 0.9);
}

/**
 * An octopus for the sea stage, shaded like the other monsters: a glossy domed head with spots, a
 * pale lip, six tentacles that curl in turn as it swims (suction cups underneath), angry eyes.
 */
function octopus(color: number, cups: number): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, olFor(color), 5, true);
    t.paint("rgba(10,30,60,0.28)", () => t.E(75, 141, 56, 8));
    squash(ctx, 75, 138, () => {
      // tentacles: the back ones darker, each curling the other way to its neighbour with the walk pose
      for (const back of [true, false]) {
        for (let i = back ? 1 : 0; i < 6; i += 2) {
          const x0 = 34 + i * 16.4;
          const side = i < 3 ? -1 : 1;
          const sway = ((i % 2 ? 1 : -1) * (pose.leg || 0.5) * 9) + side * 5;
          const c = back ? darken(color, 0.18) : color;
          t.tube(() => {
            ctx.moveTo(x0, 90);
            ctx.bezierCurveTo(x0 + sway * 0.2, 110, x0 + sway, 122, x0 + sway * 1.5, 128);
            ctx.quadraticCurveTo(x0 + sway * 2.1, 131, x0 + sway * 1.85, 119);
          }, back ? 12 : 14, c);
          // suction cups down the tentacle
          for (const k of [0.35, 0.6, 0.82]) {
            const x = x0 + sway * k * 1.3;
            const y = 90 + 36 * k;
            t.paint(rgba(cups), () => t.C(x, y, 2.8));
            t.paint("rgba(80,20,40,0.35)", () => t.C(x + 0.6, y + 0.6, 1.3));
          }
        }
      }
      // the head (mantle) and the lip under it
      t.part(() => {
        ctx.moveTo(28, 96);
        ctx.bezierCurveTo(16, 44, 46, 14, 75, 14);
        ctx.bezierCurveTo(104, 14, 134, 44, 122, 96);
        ctx.quadraticCurveTo(75, 110, 28, 96);
        ctx.closePath();
      }, color, () => {
        t.paint(rgba(lighten(color, 0.25)), () => t.E(75, 96, 42, 8));
        for (const [x, y, r] of [[98, 34, 7], [108, 52, 5], [50, 30, 5], [90, 22, 3.5], [114, 72, 4]] as const) {
          t.paint(rgba(darken(color, 0.22)), () => t.C(x, y, r));
          t.paint("rgba(255,255,255,0.25)", () => t.C(x - r * 0.3, y - r * 0.3, r * 0.4));
        }
      });
      // wet shine on the dome
      t.gloss(56, 34, 15, 8, -0.6);
      t.paint("rgba(255,255,255,0.9)", () => t.C(46, 44, 3));
      angryFace(t, 75, 70, 15, 0.95);
    });
  };
}

/** A crab out of the sand: a wide shell, eyes on stalks, big claws up (they snap with the arm pose), six legs stepping in turn. */
function crab(color: number): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, olFor(color), 5, true);
    const dark = darken(color, 0.2);
    t.paint("rgba(60,40,20,0.28)", () => t.E(80, 122, 62, 8));
    squash(ctx, 80, 118, () => {
      // legs: three a side, stepping in turn
      for (const d of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const lift = (i % 2 ? 1 : -1) * d * pose.leg * 6;
          const x0 = 80 + d * (22 + i * 9);
          const y0 = 92 + i * 2;
          t.tube(() => {
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(x0 + d * 24, y0 - 10 - lift, x0 + d * (32 + i * 5), y0 + 22 - lift);
          }, 8, dark);
        }
      }
      // the claws on their arms
      for (const d of [-1, 1]) {
        const up = d * pose.arm * 5;
        const [cx, cy] = [80 + d * 56, 46 + up];
        t.tube(() => {
          ctx.moveTo(80 + d * 28, 82);
          ctx.quadraticCurveTo(80 + d * 54, 80, cx, cy + 14);
        }, 11, color);
        t.part(() => t.E(cx + d * 11, cy + 15, 10, 6, d * 0.6), color);
        t.part(() => t.E(cx, cy, 19, 14, d * -0.5), color, () => t.paint(rgba(lighten(color, 0.3)), () => t.E(cx - d * 4, cy - 5, 8, 4, d * -0.5)));
        t.paint(rgba(darken(color, 0.5)), () => t.E(cx + d * 9, cy + 9, 7, 2.2, d * 0.4));
      }
      // eye stalks
      for (const d of [-1, 1]) {
        t.tube(() => {
          ctx.moveTo(80 + d * 10, 70);
          ctx.lineTo(80 + d * 14, 42);
        }, 7, color);
      }
      // the shell, bumpy on top
      t.part(() => t.E(80, 84, 46, 28), color, () => {
        t.paint(rgba(lighten(color, 0.22)), () => t.E(80, 100, 34, 7));
        for (const [x, y, r] of [[62, 74, 5], [98, 72, 4], [80, 66, 3.5], [108, 86, 3]] as const) t.paint(rgba(dark), () => t.C(x, y, r));
      });
      t.gloss(64, 70, 12, 6, -0.3);
      // angry eyes on the stalks and a grumpy mouth
      for (const d of [-1, 1]) {
        t.part(() => t.C(80 + d * 14, 36, 9), 0xffffff);
        t.paint("#1a1030", () => t.C(80 + d * 12.5, 37.5, 4.4));
        t.paint("#ffffff", () => t.C(80 + d * 11, 35, 1.6));
        t.tube(() => {
          ctx.moveTo(80 + d * 22, 24 + 0);
          ctx.lineTo(80 + d * 7, 29);
        }, 4, 0x2a1020);
      }
      t.paint("rgba(60,10,20,0.9)", () => t.E(80, 94, 9, 3.5));
    });
  };
}

// ───────────────────────── textures ─────────────────────────

/** Monster textures: key, width, height, painter. */
export const MONSTER_ART: Record<string, [number, number, (ctx: Ctx) => void]> = {
  e_slime_g: [140, 132, slime(0x7fd35a)],
  e_slime_o: [140, 132, slime(0xff9a2e, "stem")],
  e_slime_v: [140, 132, slime(0xa86af0)],
  e_slime_s: [140, 132, slime(0xe8c470, "sand")],
  e_slime_i: [140, 132, slime(0x8fe0ff, "ice")],
  e_mush_r: [130, 150, mushroom(0xe8434f, 0xfff0dc)],
  e_mush_b: [130, 150, mushroom(0x9a6440, 0xf2e2c8)],
  e_mush_c: [130, 150, mushroom(0x3fd0e8, 0xe8f6ff, true)],
  e_mush_w: [130, 150, mushroom(0xe8f4ff, 0xb8d0ec)],
  e_bat_p: [170, 110, bat(0x8a5ad0)],
  e_bat_d: [170, 110, bat(0x3a4a5a)],
  e_bat_i: [170, 110, bat(0xcfe8ff)],
  e_crow: [170, 110, bat(0x3a3a4a, true)],
  e_vulture: [170, 110, bat(0x9a6a4a, true)],
  e_cactus: [130, 158, cactus],
  // the sea stage's octopi (purple and red)
  e_octo: [150, 150, octopus(0xb46ad8, 0xffd0f0)],
  e_octo_r: [150, 150, octopus(0xff7a5a, 0xffe0c8)],
  // the lighthouse island's crabs (red and blue)
  e_crab: [160, 130, crab(0xe8543a)],
  e_crab_b: [160, 130, crab(0x3a8ad8)],
};

export function makeCharacterTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "hero", HERO_W, HERO_H, (ctx) => drawHero(ctx, 0));
  canvasTexture(scene, "hero_w1", HERO_W, HERO_H, (ctx) => drawHero(ctx, 1));
  canvasTexture(scene, "hero_w2", HERO_W, HERO_H, (ctx) => drawHero(ctx, 2));
  for (const [key, [w, h, draw]] of Object.entries(MONSTER_ART)) {
    canvasTexture(scene, key, w, h, draw);
    walkFrames(scene, key, w, h, draw);
  }


  canvasTexture(scene, "orb", 64, 64, (ctx) => {
    circle(ctx, 32, 32, 30);
    fill(ctx, radial(ctx, 32, 32, 30, [[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,255,255,0.95)"], [0.6, "rgba(255,255,255,0.45)"], [1, "rgba(255,255,255,0)"]]));
  });
  canvasTexture(scene, "bolt", 64, 28, (ctx) => {
    ctx.shadowColor = "#ffe14d";
    ctx.shadowBlur = 10;
    ellipse(ctx, 32, 14, 24, 7);
    fill(ctx, "#fff27a");
    ctx.shadowBlur = 0;
    ellipse(ctx, 36, 14, 16, 3.5);
    fill(ctx, "#ffffff");
  });
  canvasTexture(scene, "spark", 48, 48, (ctx) => twinkle(ctx, 24, 24, 22));
  canvasTexture(scene, "puff", 40, 40, (ctx) => {
    circle(ctx, 20, 20, 18);
    fill(ctx, radial(ctx, 20, 20, 18, [[0, "rgba(255,255,255,1)"], [0.7, "rgba(255,255,255,0.85)"], [1, "rgba(255,255,255,0)"]]));
  });
  canvasTexture(scene, "ring", 160, 160, (ctx) => {
    circle(ctx, 80, 80, 70);
    outline(ctx, 12, "rgba(255,255,255,0.9)");
  });
  canvasTexture(scene, "flash", 90, 90, (ctx) => {
    starPath(ctx, 45, 45, 42, 0.35, 8);
    fill(ctx, radial(ctx, 45, 45, 42, [[0, "#ffffff"], [0.4, "#fff6a0"], [1, "rgba(255,180,40,0)"]]));
  });
  // big cartoon explosion cloud, like the yellow blasts in idle shooters
  canvasTexture(scene, "boom", 200, 200, (ctx) => {
    const puffs: [number, number, number][] = [[100, 100, 62], [56, 92, 40], [144, 90, 42], [96, 54, 40], [110, 146, 40], [62, 136, 30], [146, 134, 32]];
    for (const [x, y, r] of puffs) {
      circle(ctx, x, y, r);
      fill(ctx, "#ffb43a");
    }
    for (const [x, y, r] of puffs) {
      circle(ctx, x - 4, y - 4, r * 0.82);
      fill(ctx, "#ffe14d");
    }
    for (const [x, y, r] of puffs.slice(0, 4)) {
      circle(ctx, x - 8, y - 8, r * 0.5);
      fill(ctx, "#fffbe0");
    }
  });
  canvasTexture(scene, "glow", 256, 256, (ctx) => {
    circle(ctx, 128, 128, 128);
    fill(ctx, radial(ctx, 128, 128, 128, [[0, "rgba(255,255,255,0.9)"], [0.35, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,0)"]]));
  });
  canvasTexture(scene, "rays", 640, 640, (ctx) => {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(320, 320);
      ctx.arc(320, 320, 320, a0, a0 + (Math.PI / n) * 0.9);
      ctx.closePath();
      fill(ctx, radial(ctx, 320, 320, 320, [[0, "rgba(255,255,255,0.7)"], [1, "rgba(255,255,255,0)"]]));
    }
  });
  canvasTexture(scene, "zap", 60, 60, (ctx) => {
    boltPath(ctx, 30, 30, 26);
    fillOutline(ctx, "#fff27a", 4);
  });
}

/** The three walk poses of a creature (key_a, key_b, key_c), made once. */
export function walkFrames(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  WALK_POSES.forEach((p, i) => {
    const k = key + ["_a", "_b", "_c"][i];
    if (!scene.textures.exists(k)) withPose(p, () => canvasTexture(scene, k, w, h, draw));
  });
}

/** Which walk frame a creature shows at this moment (it steps faster when it moves faster). */
export const walkKey = (key: string, time: number, ms: number) => key + WALK_KEYS[Math.floor(time / ms) % WALK_KEYS.length];
