import { Ctx, darken, lighten, linear, mix, radial, rgba } from "./draw";
import { arms, head, legs, squash, sway } from "./pose";
import { Toon, toon } from "./toon";

/**
 * The twenty bosses, each drawn as its own creature (250 x ~250, feet at the bottom): big readable
 * silhouettes, lit 3D forms (toon pro mode), glowing eyes, armour, crowns, horns, fur and auras.
 */

type P = [number, number];
const TAU = Math.PI * 2;

/** Ink outline a shade of the body colour (not pure black: richer). */
const ink = (c: number) => rgba(mix(darken(c, 0.7), 0x14080e, 0.55));

/** Soft contact shadow on the ground. */
export function groundShadow(ctx: Ctx, x: number, y: number, rx: number, k = 0.42): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.2);
  ctx.fillStyle = radial(ctx, 0, 0, rx, [[0, `rgba(20,8,20,${k})`], [0.65, `rgba(20,8,20,${k * 0.45})`], [1, "rgba(20,8,20,0)"]]);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A coloured glow (behind a boss, round its eyes, from a gem...). */
export function aura(ctx: Ctx, x: number, y: number, r: number, color: number, a = 0.55, sy = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, sy);
  ctx.fillStyle = radial(ctx, 0, 0, r, [[0, rgba(color, a)], [0.5, rgba(color, a * 0.35)], [1, rgba(color, 0)]]);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Mean slanted glowing eyes with a dark brow over each. */
function glowEyes(t: Toon, x: number, y: number, gap: number, s: number, color: number, brow = true): void {
  const { ctx } = t;
  for (const d of [-1, 1]) {
    const ex = x + d * gap;
    aura(ctx, ex, y, 26 * s, color, 0.65);
    // angry almond eyes: the outer corner high, the inner corner low
    const eye = (k: number): P[] => [[ex + d * 15 * k * s, y - 7 * k * s], [ex - d * 13 * k * s, y + 1 * s], [ex - d * 9 * k * s, y + 8 * k * s], [ex + d * 11 * k * s, y + 6 * k * s]];
    t.paint(rgba(0x14080e), () => t.poly(eye(1.22), 4 * s));
    t.paint(radial(ctx, ex, y + 1 * s, 14 * s, [[0, "#ffffff"], [0.3, rgba(lighten(color, 0.55))], [0.75, rgba(color)], [1, rgba(darken(color, 0.3))]]), () => t.poly(eye(1), 3 * s));
    t.paint("rgba(255,255,255,0.95)", () => t.E(ex - d * 2 * s, y + 1 * s, 2 * s, 4.5 * s));
    if (brow) {
      ctx.lineCap = "round";
      ctx.lineWidth = 6 * s;
      ctx.strokeStyle = "#14080e";
      ctx.beginPath();
      ctx.moveTo(ex + d * 17 * s, y - 12 * s);
      ctx.lineTo(ex - d * 9 * s, y - 4 * s);
      ctx.stroke();
    }
  }
}

/** A wide mouth full of teeth (open), with a tongue. */
function maw(t: Toon, x: number, y: number, w: number, h: number, fangs = 4): void {
  const { ctx } = t;
  t.paint("#14080e", () => t.E(x, y, w, h));
  t.paint(radial(ctx, x, y + h * 0.4, w, [[0, "#c8304a"], [1, "#5a0a1a"]]), () => t.E(x, y + h * 0.15, w * 0.85, h * 0.75));
  t.paint("#ff6a8a", () => t.E(x + w * 0.15, y + h * 0.55, w * 0.45, h * 0.3));
  ctx.fillStyle = "#fff8ec";
  for (let i = 0; i < fangs; i++) {
    const fx = x - w * 0.75 + (i + 0.5) * ((w * 1.5) / fangs);
    const big = i === 0 || i === fangs - 1;
    t.paint("#fff8ec", () => t.poly([[fx - w * 0.12, y - h * 0.82], [fx + w * 0.12, y - h * 0.82], [fx, y - h * (big ? 0.05 : 0.35)]], 1));
    t.paint("#f0e6d6", () => t.poly([[fx - w * 0.1, y + h * 0.85], [fx + w * 0.1, y + h * 0.85], [fx, y + h * 0.4]], 1));
  }
}

/** A gold crown with jewels and a ruby on top, centred on (x, y = its bottom). */
function crown(t: Toon, x: number, y: number, s = 1, gem = 0xff3a5a, tilt = 0): void {
  const { ctx } = t;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  t.part(() => t.poly([[-38 * s, 0], [-44 * s, -38 * s], [-22 * s, -20 * s], [0, -48 * s], [22 * s, -20 * s], [44 * s, -38 * s], [38 * s, 0]], 4), 0xffc83a, () => {
    t.paint(rgba(0xb8862a), () => t.rect(0, -6 * s, 80 * s, 10 * s, 3));
    for (const gx of [-24, 0, 24]) {
      t.paint(rgba(gx ? 0x4ac8ff : gem), () => t.C(gx * s, -6 * s, 5 * s));
      t.paint("rgba(255,255,255,0.9)", () => t.C(gx * s - 1.5 * s, -7.5 * s, 1.6 * s));
    }
  }, 4);
  for (const [px, py] of [[-44, -38], [0, -48], [44, -38]] as P[]) {
    t.part(() => t.C(px * s, py * s, 6 * s), 0xffe27a, undefined, 3);
  }
  ctx.restore();
}

/** A curved horn from (x, y) pointing at angle a (radians, 0 = right), bending by `bend`. */
function horn(t: Toon, x: number, y: number, len: number, w: number, a: number, bend: number, color: number, rings = true): void {
  const left: P[] = [];
  const right: P[] = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const ang = a + bend * k * k;
    // walk along the bent spine
    let px = x;
    let py = y;
    for (let j = 0; j < i; j++) {
      const kk = j / n;
      const aa = a + bend * kk * kk;
      px += Math.cos(aa) * (len / n);
      py += Math.sin(aa) * (len / n);
    }
    const hw = (w / 2) * (1 - k * 0.95);
    left.push([px + Math.cos(ang - Math.PI / 2) * hw, py + Math.sin(ang - Math.PI / 2) * hw]);
    right.push([px + Math.cos(ang + Math.PI / 2) * hw, py + Math.sin(ang + Math.PI / 2) * hw]);
  }
  const pts = [...left, ...right.reverse()];
  t.part(() => t.poly(pts, 3), color, () => {
    if (!rings) return;
    const { ctx } = t;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = rgba(darken(color, 0.35), 0.6);
    for (let i = 1; i < 5; i++) {
      const a1 = left[i * 1.5 | 0];
      const b1 = pts[pts.length - 1 - (i * 1.5 | 0)];
      ctx.beginPath();
      ctx.moveTo(a1[0], a1[1]);
      ctx.lineTo(b1[0], b1[1]);
      ctx.stroke();
    }
  }, 4);
}

/** Little white fangs hanging from a lip line. */
function fangs(t: Toon, x: number, y: number, gap: number, h: number): void {
  for (const d of [-1, 1]) t.part(() => t.poly([[x + d * gap - h * 0.35, y], [x + d * gap + h * 0.35, y], [x + d * gap, y + h]], 1.5), 0xfff6e8, undefined, 2.5);
}

/** Floating sparkles / motes around a boss. */
function motes(t: Toon, pts: [number, number, number][], color: number): void {
  const { ctx } = t;
  for (const [x, y, r] of pts) {
    aura(ctx, x, y, r * 3, color, 0.5);
    t.paint("rgba(255,255,255,0.95)", () => t.C(x, y, r * 0.6));
    ctx.strokeStyle = rgba(lighten(color, 0.5), 0.9);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - r * 2, y);
    ctx.lineTo(x + r * 2, y);
    ctx.moveTo(x, y - r * 2);
    ctx.lineTo(x, y + r * 2);
    ctx.stroke();
  }
}

/** Strokes of fur (lighter and darker) over an area, along a direction. */
function furStrokes(ctx: Ctx, x: number, y: number, w: number, h: number, color: number, n = 40, seed = 3): void {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const px = x + r() * w;
    const py = y + r() * h;
    const l = 6 + r() * 9;
    ctx.lineWidth = 1.6 + r() * 1.4;
    ctx.strokeStyle = i % 3 ? rgba(darken(color, 0.25), 0.35) : rgba(lighten(color, 0.4), 0.45);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + 2, py + l * 0.5, px - 1, py + l);
    ctx.stroke();
  }
}

// ───────────────────────── World 1: Sunny Meadow ─────────────────────────

/** Slime King: a big wobbly jelly with things floating inside, drips, a tilted crown and a sceptre. */
export function slimeKing(ctx: Ctx): void {
  const c = 0x6fd34a;
  const t = toon(ctx, ink(c), 6, true);
  groundShadow(ctx, 125, 236, 110);
  // a puddle of goo it sits in
  t.part(() => t.E(125, 230, 108, 16), darken(c, 0.12));
  sway(ctx, 214, 228, 0.12, () => {
  // the sceptre stuck in its side
  t.tube(() => {
    ctx.moveTo(214, 228);
    ctx.lineTo(232, 92);
  }, 9, 0xb8862a);
  t.part(() => t.C(233, 86, 13), 0xff4a8a, () => t.gloss(229, 81, 6, 4));
  });
  squash(ctx, 125, 230, () => {
  // the body
  const body = () => t.poly([[30, 226], [24, 168], [48, 104], [92, 70], [125, 64], [162, 72], [204, 106], [226, 168], [220, 226]], 46);
  t.part(body, c, () => {
    // jelly inside: bubbles, a swallowed bone and a coin
    for (const [x, y, r] of [[70, 190, 9], [168, 200, 7], [100, 150, 5], [186, 150, 6], [60, 140, 4]] as [number, number, number][]) {
      t.paint(rgba(lighten(c, 0.5), 0.55), () => t.C(x, y, r));
      t.paint("rgba(255,255,255,0.7)", () => t.C(x - r * 0.35, y - r * 0.35, r * 0.3));
    }
    ctx.save();
    ctx.translate(150, 196);
    ctx.rotate(0.5);
    t.paint(rgba(0xf4ecd8, 0.75), () => {
      t.rect(0, 0, 34, 7, 3);
      t.C(-17, -4, 5);
      t.C(-17, 4, 5);
      t.C(17, -4, 5);
      t.C(17, 4, 5);
    });
    ctx.restore();
    t.paint(rgba(0xffd23f, 0.7), () => t.C(88, 206, 8));
    // a lighter belly
    t.paint(rgba(lighten(c, 0.25), 0.55), () => t.E(125, 196, 74, 30));
  });
  // drips running down
  for (const [x, y, l] of [[46, 150, 26], [204, 140, 32], [64, 112, 18]] as [number, number, number][]) {
    t.part(() => {
      t.rect(x, y + l / 2, 12, l, 6);
      t.C(x, y + l, 8);
    }, c, undefined, 3);
  }
  t.gloss(78, 100, 26, 11, -0.6);
  t.gloss(176, 104, 10, 5, 0.6);
  glowEyes(t, 125, 128, 30, 1, 0xff4a2a);
  maw(t, 125, 166, 30, 12, 4);
  crown(t, 110, 80, 1.05, 0xff3a5a, -0.22);
  });
}

/** Mushroom Titan: a hulking stalk-body with big arms, a huge spotted cap with gills, and mini mushrooms. */
export function mushroomTitan(ctx: Ctx): void {
  const cap = 0xe8434f;
  const stalk = 0xf2e2c8;
  const t = toon(ctx, ink(cap), 6, true);
  groundShadow(ctx, 125, 240, 105);
  legs(ctx, 125, () => {
  // legs
  t.part(() => {
    t.rect(92, 220, 40, 40, 14);
    t.rect(158, 220, 40, 40, 14);
  }, darken(stalk, 0.12));
  });
  arms(ctx, 125, 48, 150, 0.16, () => {
  // arms with fists
  t.tube(() => {
    ctx.moveTo(78, 148);
    ctx.quadraticCurveTo(28, 158, 26, 206);
    ctx.moveTo(172, 148);
    ctx.quadraticCurveTo(222, 158, 224, 206);
  }, 26, stalk);
  t.part(() => {
    t.C(26, 212, 21);
    t.C(224, 212, 21);
  }, darken(stalk, 0.05), () => {
    const { ctx: c } = t;
    c.lineWidth = 3;
    c.strokeStyle = rgba(darken(stalk, 0.4), 0.6);
    for (const x of [26, 224]) {
      c.beginPath();
      c.moveTo(x - 10, 208);
      c.lineTo(x + 8, 206);
      c.stroke();
    }
  });
  });
  // the stalk body
  t.part(() => t.poly([[78, 228], [72, 140], [90, 104], [160, 104], [178, 140], [172, 228]], 30), stalk, () => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(darken(stalk, 0.25), 0.5);
    for (const x of [100, 125, 150]) {
      ctx.beginPath();
      ctx.moveTo(x, 110);
      ctx.quadraticCurveTo(x + 4, 170, x - 2, 226);
      ctx.stroke();
    }
    // a ring of skirt (annulus)
    t.paint(rgba(darken(stalk, 0.1)), () => t.E(125, 132, 58, 10));
  });
  head(ctx, 125, 110, () => {
  // underside of the cap with gills
  t.part(() => t.E(125, 96, 112, 26), 0xd8b89a, () => {
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = rgba(0x8a6a4a, 0.6);
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(125 + i * 4, 92);
      ctx.lineTo(125 + i * 10.5, 118);
      ctx.stroke();
    }
  });
  // the cap
  t.part(() => t.poly([[12, 92], [30, 44], [80, 12], [125, 6], [170, 12], [220, 44], [238, 92], [190, 100], [125, 104], [60, 100]], 34), cap, () => {
    for (const [x, y, r] of [[60, 50, 13], [118, 30, 16], [176, 46, 12], [92, 78, 9], [150, 76, 10], [210, 78, 8], [34, 80, 7]] as [number, number, number][]) {
      t.paint("#fff4e6", () => t.E(x, y, r, r * 0.85));
      t.paint(rgba(0xd8c8b0, 0.7), () => t.E(x + r * 0.2, y + r * 0.25, r * 0.7, r * 0.5));
    }
  });
  t.gloss(70, 36, 24, 9, -0.35);
  });
  // tiny mushrooms growing on the shoulders
  for (const [x, y] of [[84, 112], [168, 112]] as P[]) {
    t.part(() => t.rect(x, y + 4, 8, 12, 3), stalk, undefined, 2.5);
    t.part(() => t.E(x, y - 3, 12, 7), cap, () => t.paint("#fff4e6", () => t.C(x - 3, y - 5, 2.5)), 2.5);
  }
  glowEyes(t, 125, 150, 22, 0.85, 0xffd23f);
  maw(t, 125, 188, 24, 10, 4);
}

/** Bat Queen: wide membrane wings with finger bones, a fluffy chest, huge ears, fangs and a tiara. */
export function batQueen(ctx: Ctx): void {
  const c = 0x7a4ac0;
  const t = toon(ctx, ink(c), 6, true);
  groundShadow(ctx, 125, 236, 90);
  aura(ctx, 125, 130, 120, 0xb36aff, 0.25);
  arms(ctx, 125, 40, 112, 0.28, () => {
  // wings
  for (const d of [-1, 1]) {
    const m = (x: number) => 125 + d * x;
    t.part(() => t.poly([[m(30), 100], [m(70), 40], [m(124), 28], [m(118), 78], [m(122), 128], [m(100), 116], [m(84), 150], [m(64), 132], [m(44), 160]], 6), darken(c, 0.18), () => {
      // finger bones and membrane veins
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.strokeStyle = rgba(lighten(c, 0.15));
      ctx.beginPath();
      ctx.moveTo(m(36), 104);
      ctx.lineTo(m(70), 44);
      ctx.lineTo(m(120), 32);
      ctx.moveTo(m(70), 44);
      ctx.lineTo(m(116), 124);
      ctx.moveTo(m(70), 44);
      ctx.lineTo(m(84), 146);
      ctx.moveTo(m(70), 44);
      ctx.lineTo(m(48), 154);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rgba(lighten(c, 0.3), 0.5);
      for (const [x1, y1, x2, y2] of [[90, 60, 104, 96], [80, 90, 66, 120], [100, 50, 118, 70]]) {
        ctx.beginPath();
        ctx.moveTo(m(x1), y1);
        ctx.lineTo(m(x2), y2);
        ctx.stroke();
      }
    });
    t.part(() => t.poly([[m(66), 36], [m(74), 22], [m(80), 40]], 2), 0xf0e6ff, undefined, 3);
  }
  }, true);
  legs(ctx, 125, () => {
  // feet
  t.part(() => {
    t.E(108, 226, 13, 8);
    t.E(142, 226, 13, 8);
  }, darken(c, 0.3));
  }, 5);
  // body and fluffy chest
  t.part(() => t.E(125, 168, 52, 60), c, () => {
    t.paint(rgba(0xe8d8ff), () => {
      t.E(125, 186, 34, 38);
      for (let i = 0; i < 7; i++) t.C(98 + i * 9, 150 + (i % 2) * 4, 8);
    });
    furStrokes(ctx, 96, 150, 58, 70, 0xe8d8ff, 30, 7);
  });
  head(ctx, 125, 130, () => {
  // head with big ears
  t.part(() => {
    t.E(125, 104, 46, 40);
    t.poly([[86, 92], [70, 26], [108, 74]], 8);
    t.poly([[142, 74], [180, 26], [164, 92]], 8);
  }, c, () => {
    t.paint(rgba(0xff8ac8, 0.85), () => {
      t.poly([[84, 80], [76, 40], [100, 72]], 5);
      t.poly([[150, 72], [174, 40], [166, 80]], 5);
    });
  });
  t.gloss(104, 84, 14, 6);
  glowEyes(t, 125, 102, 19, 0.8, 0xff3a5a);
  t.paint("#3a1a3a", () => t.E(125, 122, 7, 4));
  fangs(t, 125, 128, 8, 11);
  crown(t, 125, 66, 0.62, 0x4ac8ff);
  });
}

/** Stone Golem: carved rock slabs with glowing rune cracks, moss and a crystal heart. */
export function stoneGolem(ctx: Ctx): void {
  const c = 0x9aa0ac;
  const t = toon(ctx, "#22222c", 6, true);
  groundShadow(ctx, 125, 240, 110);
  aura(ctx, 125, 150, 90, 0xffc83a, 0.18);
  const rune = (pts: P[]) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [w, st] of [[9, "rgba(255,170,40,0.35)"], [4, "rgba(255,210,90,0.95)"], [1.5, "#fff6cc"]] as [number, string][]) {
      ctx.lineWidth = w;
      ctx.strokeStyle = st;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  };
  legs(ctx, 125, () => {
  // legs
  t.part(() => {
    t.poly([[70, 194], [114, 194], [118, 240], [64, 240]], 10);
    t.poly([[136, 194], [180, 194], [186, 240], [132, 240]], 10);
  }, darken(c, 0.12));
  });
  arms(ctx, 125, 64, 100, 0.14, () => {
  // arms: big boulder fists
  for (const d of [-1, 1]) {
    t.part(() => t.poly([[125 + d * 62, 96], [125 + d * 104, 108], [125 + d * 112, 158], [125 + d * 74, 150]], 12), darken(c, 0.05));
    t.part(() => t.poly([[125 + d * 82, 156], [125 + d * 122, 152], [125 + d * 124, 206], [125 + d * 80, 206]], 16), darken(c, 0.1), () => rune([[125 + d * 92, 176], [125 + d * 110, 186]]));
  }
  });
  // the torso
  t.part(() => t.poly([[60, 70], [190, 70], [204, 140], [176, 204], [74, 204], [46, 140]], 22), c, () => {
    t.paint(rgba(0x6fbf4a), () => {
      t.E(84, 74, 30, 12, -0.15);
      t.E(170, 76, 22, 9, 0.2);
      t.E(60, 120, 10, 18);
    });
    rune([[80, 120], [100, 140], [92, 170]]);
    rune([[168, 120], [152, 146], [162, 178]]);
    rune([[116, 186], [134, 196]]);
  });
  // glowing crystal heart
  aura(ctx, 125, 160, 34, 0xffc83a, 0.8);
  t.part(() => t.poly([[125, 136], [142, 158], [125, 184], [108, 158]], 3), 0xffd23f, () => t.gloss(119, 152, 5, 8, 0.2), 3);
  head(ctx, 125, 88, () => {
  // head block sunk into the shoulders
  t.part(() => t.poly([[90, 34], [160, 34], [170, 88], [80, 88]], 16), lighten(c, 0.05), () => t.paint(rgba(0x6fbf4a), () => t.E(108, 36, 22, 7)));
  t.gloss(100, 50, 12, 6);
  glowEyes(t, 125, 64, 18, 0.75, 0xffb22e);
  });
}

/** Magma King: a hulking molten rock giant, glowing lava in every crack, a burning crown and a furnace heart. */
export function magmaKing(ctx: Ctx): void {
  const c = 0x4a3a3a;
  const t = toon(ctx, "#1a0c0c", 6, true);
  groundShadow(ctx, 125, 240, 118);
  aura(ctx, 125, 140, 110, 0xff6a1a, 0.3);
  const crack = (pts: P[]) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [w, st] of [[11, "rgba(255,90,20,0.4)"], [5, "rgba(255,150,40,0.95)"], [2, "#fff2a0"]] as [number, string][]) {
      ctx.lineWidth = w;
      ctx.strokeStyle = st;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  };
  legs(ctx, 125, () => {
  // stumpy legs of cooled rock, lava dripping between the plates
  t.part(() => {
    t.poly([[66, 192], [112, 192], [116, 240], [60, 240]], 10);
    t.poly([[138, 192], [184, 192], [190, 240], [134, 240]], 10);
  }, darken(c, 0.15), () => {
    crack([[80, 204], [92, 222], [86, 236]]);
    crack([[164, 206], [158, 226]]);
  });
  });
  arms(ctx, 125, 62, 100, 0.16, () => {
  // huge arms ending in molten fists
  for (const d of [-1, 1]) {
    t.part(() => t.poly([[125 + d * 60, 92], [125 + d * 108, 102], [125 + d * 116, 160], [125 + d * 74, 152]], 12), darken(c, 0.05), () => crack([[125 + d * 82, 110], [125 + d * 98, 132], [125 + d * 92, 148]]));
    aura(ctx, 125 + d * 104, 182, 34, 0xff7a1a, 0.7);
    t.part(() => t.poly([[125 + d * 82, 156], [125 + d * 124, 150], [125 + d * 128, 208], [125 + d * 80, 208]], 16), 0xd8431a, () => {
      t.paint(rgba(0xffb030), () => t.E(125 + d * 102, 176, 14, 9));
      crack([[125 + d * 88, 192], [125 + d * 118, 196]]);
    });
  }
  });
  // the torso: a cracked boulder chest
  t.part(() => t.poly([[56, 66], [194, 66], [208, 138], [180, 204], [70, 204], [42, 138]], 22), c, () => {
    t.paint(rgba(darken(c, 0.25)), () => {
      t.E(70, 92, 14, 9, -0.3);
      t.E(184, 110, 10, 14);
    });
    crack([[72, 110], [96, 132], [86, 168], [100, 190]]);
    crack([[178, 104], [156, 136], [168, 172]]);
    crack([[110, 78], [124, 96], [140, 80]]);
  });
  // the furnace heart, blazing
  aura(ctx, 125, 152, 46, 0xffa020, 0.95);
  t.part(() => t.poly([[125, 122], [150, 150], [125, 186], [100, 150]], 4), 0xffc030, () => {
    t.paint("rgba(255,255,220,0.95)", () => t.E(125, 152, 10, 16));
  }, 3);
  head(ctx, 125, 84, () => {
  // the head sunk into the shoulders, a crown of fire on top
  for (const [x, h, w] of [[96, 46, 12], [112, 62, 14], [125, 74, 16], [138, 62, 14], [154, 46, 12]] as const) {
    aura(ctx, x, 30 - h * 0.3, w * 1.4, 0xff8a1a, 0.6);
    t.part(() => t.poly([[x - w, 34], [x, 34 - h], [x + w, 34]], 3), 0xff7a1a, () => t.paint("rgba(255,230,120,0.95)", () => t.poly([[x - w * 0.45, 34], [x, 34 - h * 0.55], [x + w * 0.45, 34]], 2)), 3);
  }
  t.part(() => t.poly([[86, 30], [164, 30], [174, 88], [76, 88]], 16), lighten(c, 0.06), () => crack([[100, 40], [112, 52]]));
  t.gloss(100, 46, 12, 6);
  glowEyes(t, 125, 62, 19, 0.8, 0xffe040);
  // a glowing grin
  t.paint("rgba(40,10,0,0.9)", () => t.poly([[100, 74], [150, 74], [142, 84], [108, 84]], 4));
  t.paint("rgba(255,160,40,0.95)", () => t.poly([[106, 76], [144, 76], [139, 81], [111, 81]], 2));
  });
}

/** Scarecrow: a stitched sack head with burning eyes, a torn hat, crows, straw everywhere and a lantern. */
export function scarecrow(ctx: Ctx): void {
  const t = toon(ctx, "#24140c", 6, true);
  groundShadow(ctx, 125, 240, 74);
  sway(ctx, 125, 238, 0.035, () => {
  // the post
  t.tube(() => {
    ctx.moveTo(125, 238);
    ctx.lineTo(125, 120);
  }, 16, 0x7a4e2e);
  t.tube(() => {
    ctx.moveTo(20, 124);
    ctx.lineTo(230, 124);
  }, 14, 0x7a4e2e);
  // straw spilling out everywhere
  const straw = (x: number, y: number, a: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const aa = a + (i - n / 2) * 0.22;
      t.part(() => t.poly([[x, y - 3], [x + Math.cos(aa) * 30, y + Math.sin(aa) * 30], [x, y + 3]], 1), i % 2 ? 0xf0d070 : 0xd8b04a, undefined, 2.5);
    }
  };
  straw(34, 124, Math.PI, 5);
  straw(216, 124, 0, 5);
  straw(100, 214, Math.PI / 2, 4);
  straw(150, 214, Math.PI / 2, 4);
  // the coat with patches and stitches
  t.part(() => t.poly([[54, 112], [196, 112], [184, 214], [66, 214]], 14), 0x6a4a9a, () => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(40,20,70,0.55)";
    for (const x of [90, 125, 160]) {
      ctx.beginPath();
      ctx.moveTo(x, 112);
      ctx.lineTo(x + 2, 214);
      ctx.stroke();
    }
    t.paint(rgba(0xd89a4a), () => t.rect(152, 176, 30, 26, 4));
    t.paint(rgba(0x4a8a5a), () => t.rect(88, 150, 24, 20, 3));
    ctx.strokeStyle = "#f0e0c0";
    ctx.lineWidth = 2;
    for (const [x, y] of [[140, 168], [140, 184], [164, 164], [178, 190], [80, 146], [102, 160]]) {
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 3);
      ctx.lineTo(x + 4, y + 3);
      ctx.stroke();
    }
    // a rope belt
    t.paint(rgba(0xc8a060), () => t.rect(125, 196, 124, 9, 4));
  });
  // a little lantern hanging from the arm
  t.tube(() => {
    ctx.moveTo(204, 124);
    ctx.lineTo(204, 150);
  }, 3, 0x3a2a1a);
  aura(ctx, 204, 166, 34, 0xffa83a, 0.75);
  t.part(() => t.rect(204, 166, 22, 28, 5), 0x5a4a3a, () => t.paint(radial(ctx, 204, 166, 12, [[0, "#fff6b0"], [1, "#ff9a2a"]]), () => t.rect(204, 166, 14, 18, 3)), 3);
  head(ctx, 125, 120, () => {
  // sack head
  t.part(() => t.E(125, 82, 48, 44), 0xd8b47a, () => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(90,60,30,0.35)";
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(80, 82 + i * 9);
      ctx.lineTo(170, 82 + i * 9);
      ctx.stroke();
    }
    // stitched mouth
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#3a1a0a";
    ctx.beginPath();
    ctx.moveTo(98, 104);
    ctx.quadraticCurveTo(125, 116, 152, 104);
    ctx.stroke();
    ctx.lineWidth = 3;
    for (let x = 102; x <= 148; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, 100);
      ctx.lineTo(x + 2, 116);
      ctx.stroke();
    }
  });
  glowEyes(t, 125, 76, 19, 0.75, 0xff7a1a, false);
  // torn hat
  t.part(() => {
    t.E(125, 44, 84, 13);
    t.poly([[86, 46], [96, 6], [140, 2], [164, 46]], 10);
  }, 0xb88a4a, () => {
    t.paint(rgba(0x9a2a1a), () => t.rect(125, 38, 74, 9, 3));
    t.paint(rgba(0x3a2a1a), () => t.poly([[150, 14], [160, 26], [146, 24]], 2));
  });
  });
  sway(ctx, 44, 120, 0.25, () => {
  // a crow perched on the arm
  t.part(() => {
    t.E(44, 108, 14, 11);
    t.C(54, 98, 8);
    t.poly([[30, 110], [16, 116], [32, 116]], 2);
  }, 0x2a2a36, () => t.paint("#ffcf3a", () => t.poly([[60, 96], [70, 99], [60, 102]], 1)), 3);
  t.paint("#ff3a2a", () => t.C(55, 96, 2));
  });
  });
}

/** Thunder Crow: a huge storm crow with layered feathers, glowing eyes and crackling lightning. */
export function thunderCrow(ctx: Ctx): void {
  const c = 0x2e2e40;
  const t = toon(ctx, "#0e0e18", 6, true);
  groundShadow(ctx, 125, 236, 88);
  aura(ctx, 125, 110, 130, 0xffe066, 0.22);
  const bolt = (x: number, y: number, s: number) => {
    const pts: P[] = [[x, y], [x + 14 * s, y + 24], [x + 4 * s, y + 24], [x + 18 * s, y + 52], [x - 6 * s, y + 20], [x + 4 * s, y + 20]];
    aura(ctx, x + 6 * s, y + 26, 30, 0xffe066, 0.5);
    t.part(() => t.poly(pts, 2), 0xffe066, undefined, 3);
  };
  arms(ctx, 125, 30, 100, 0.3, () => {
  // wings of layered feathers
  for (const d of [-1, 1]) {
    const m = (x: number) => 125 + d * x;
    for (let row = 0; row < 3; row++) {
      t.part(() => {
        for (let i = 0; i < 5; i++) {
          const fx = m(40 + i * 18 + row * 4);
          const fy = 70 + i * 8 + row * 18;
          t.poly([[m(30 + row * 6), 96 + row * 12], [fx + d * 6, fy - 26], [fx + d * 16, fy + 20], [m(36 + row * 6), 120 + row * 12]], 5);
        }
      }, row === 0 ? darken(c, 0.1) : row === 1 ? c : lighten(c, 0.08));
    }
  }
  }, true);
  // tail feathers
  t.part(() => {
    t.poly([[110, 196], [92, 240], [118, 226], [125, 244], [132, 226], [158, 240], [140, 196]], 4);
  }, darken(c, 0.15));
  legs(ctx, 125, () => {
  // talons
  t.part(() => {
    t.poly([[106, 214], [96, 232], [112, 226], [114, 236], [122, 222]], 2);
    t.poly([[144, 214], [154, 232], [138, 226], [136, 236], [128, 222]], 2);
  }, 0xe8b83a, undefined, 3);
  }, 6);
  // body
  t.part(() => t.E(125, 156, 50, 58), c, () => {
    t.paint(rgba(0x4a4a66), () => t.E(125, 176, 30, 34));
    for (let i = 0; i < 4; i++) {
      t.paint(rgba(0x5a5a7a, 0.6), () => {
        for (let j = 0; j < 3; j++) t.E(110 + j * 15, 154 + i * 15, 7, 5);
      });
    }
  });
  head(ctx, 125, 120, () => {
  // head with a crest of feathers
  t.part(() => {
    t.C(125, 92, 40);
    t.poly([[106, 62], [96, 22], [118, 54]], 3);
    t.poly([[120, 54], [126, 12], [134, 54]], 3);
    t.poly([[132, 54], [154, 22], [144, 62]], 3);
  }, c);
  t.gloss(106, 74, 12, 5);
  glowEyes(t, 125, 88, 17, 0.75, 0xffe066);
  // a big hooked beak
  t.part(() => t.poly([[108, 102], [142, 102], [134, 116], [125, 134], [118, 116]], 4), 0xffb82e, () => t.paint(rgba(0xd88a1a), () => t.rect(125, 114, 30, 3, 1)), 4);
  });
  bolt(22, 30, 1);
  bolt(214, 54, -1);
  bolt(206, 176, 1);
  bolt(40, 170, -1);
}

/** Haystack Brute: a hulking bale with rope bands, pitchfork horns, straw fists and burning eyes. */
export function hayBrute(ctx: Ctx): void {
  const hay = 0xe0bc52;
  const t = toon(ctx, "#3a2410", 6, true);
  groundShadow(ctx, 125, 240, 108);
  const strawLines = (x0: number, y0: number, w: number, h: number) => {
    ctx.lineWidth = 2;
    let s = 5;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 70; i++) {
      const x = x0 + r() * w;
      const y = y0 + r() * h;
      ctx.strokeStyle = i % 3 ? "rgba(140,96,20,0.45)" : "rgba(255,240,170,0.7)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 6, y + 10 + r() * 8);
      ctx.stroke();
    }
  };
  // pitchfork prongs as horns
  for (const d of [-1, 1]) horn(t, 125 + d * 52, 52, 54, 12, -Math.PI / 2 + d * 0.5, -d * 0.4, 0xbfc6d0, false);
  legs(ctx, 125, () => {
  // legs
  t.part(() => {
    t.rect(88, 222, 46, 36, 12);
    t.rect(162, 222, 46, 36, 12);
  }, darken(hay, 0.15), () => strawLines(64, 204, 122, 36));
  });
  arms(ctx, 125, 70, 110, 0.15, () => {
  // arms
  for (const d of [-1, 1]) {
    t.part(() => t.poly([[125 + d * 70, 104], [125 + d * 112, 116], [125 + d * 118, 176], [125 + d * 84, 168]], 14), darken(hay, 0.06), () => strawLines(d < 0 ? 7 : 190, 104, 54, 74));
    t.part(() => t.C(125 + d * 106, 190, 24), darken(hay, 0.1), () => strawLines(d < 0 ? 0 : 206, 166, 48, 48));
  }
  });
  head(ctx, 125, 210, () => {
  // the bale
  t.part(() => t.rect(125, 140, 156, 150, 34), hay, () => {
    strawLines(48, 66, 156, 150);
    for (const y of [92, 186]) {
      t.paint(rgba(0xa82a1a), () => t.rect(125, y, 160, 12, 4));
      t.paint(rgba(0xd84a3a, 0.8), () => t.rect(125, y - 3, 160, 3, 1));
    }
    // a knot
    t.paint(rgba(0xa82a1a), () => {
      t.C(178, 186, 8);
      t.poly([[182, 192], [196, 214], [186, 214]], 2);
    });
  });
  t.gloss(78, 82, 18, 7);
  glowEyes(t, 125, 128, 28, 1, 0xff4a1a);
  maw(t, 125, 166, 28, 11, 5);
  });
}

/** Pumpkin King: a carved pumpkin head blazing inside, a cape, vine arms with claws and a crown. */
export function pumpkinKing(ctx: Ctx): void {
  const c = 0xff7a1a;
  const t = toon(ctx, ink(c), 6, true);
  groundShadow(ctx, 125, 240, 106);
  // the cape behind
  t.part(() => t.poly([[44, 112], [206, 112], [232, 236], [180, 222], [125, 238], [70, 222], [18, 236]], 10), 0x3a1a4a, () =>
    t.paint(rgba(0x7a2a8a), () => t.poly([[54, 120], [196, 120], [210, 160], [40, 160]], 8)));
  arms(ctx, 125, 70, 150, 0.22, () => {
  // vine arms with leafy claws
  for (const d of [-1, 1]) {
    t.tube(() => {
      ctx.moveTo(125 + d * 70, 150);
      ctx.quadraticCurveTo(125 + d * 120, 130, 125 + d * 108, 92);
    }, 11, 0x3f8a2a);
    t.part(() => {
      t.poly([[125 + d * 108, 92], [125 + d * 92, 66], [125 + d * 112, 80]], 2);
      t.poly([[125 + d * 108, 92], [125 + d * 118, 62], [125 + d * 120, 86]], 2);
      t.poly([[125 + d * 108, 92], [125 + d * 132, 76], [125 + d * 124, 96]], 2);
    }, 0x5ab83a, undefined, 3);
  }
  });
  head(ctx, 125, 230, () => {
  // the pumpkin
  t.part(() => {
    t.E(80, 156, 52, 74);
    t.E(170, 156, 52, 74);
    t.E(125, 152, 56, 82);
  }, c, () => {
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(darken(c, 0.3), 0.7);
    for (const x of [62, 96, 154, 188]) {
      ctx.beginPath();
      ctx.moveTo(x, 86);
      ctx.quadraticCurveTo(x + (x < 125 ? -18 : 18), 156, x, 226);
      ctx.stroke();
    }
  });
  t.gloss(80, 104, 20, 9, -0.4);
  // the carved face blazing from inside
  const glow = radial(ctx, 125, 160, 80, [[0, "#fffbd0"], [0.35, "#ffd23f"], [1, "#ff6a1a"]]);
  aura(ctx, 125, 160, 90, 0xffb83a, 0.35);
  t.paint("#3a1004", () => {
    t.poly([[72, 112], [110, 124], [90, 146]], 3);
    t.poly([[178, 112], [140, 124], [160, 146]], 3);
    t.poly([[64, 170], [86, 162], [100, 178], [114, 162], [125, 178], [136, 162], [150, 178], [164, 162], [186, 170], [168, 210], [82, 210]], 4);
  });
  t.paint(glow, () => {
    t.poly([[76, 115], [106, 125], [90, 141]], 3);
    t.poly([[174, 115], [144, 125], [160, 141]], 3);
    t.poly([[70, 173], [86, 167], [100, 183], [114, 167], [125, 183], [136, 167], [150, 183], [164, 167], [180, 173], [164, 204], [86, 204]], 4);
  });
  // stem and crown
  t.tube(() => {
    ctx.moveTo(125, 76);
    ctx.quadraticCurveTo(128, 56, 142, 48);
  }, 12, 0x4f8a2a);
  crown(t, 116, 74, 0.82, 0xb36aff, -0.12);
  });
}

/** Old Treant: a gnarled bark giant with a hollow glowing face, root feet, branch arms and a full canopy. */
export function treant(ctx: Ctx): void {
  const bark = 0x7a5032;
  const leaf = 0x48a83a;
  const t = toon(ctx, "#20140c", 6, true);
  groundShadow(ctx, 125, 246, 112);
  legs(ctx, 125, () => {
  // roots
  t.part(() => {
    t.poly([[86, 214], [40, 246], [74, 244], [96, 232]], 4);
    t.poly([[164, 214], [210, 246], [176, 244], [154, 232]], 4);
    t.poly([[112, 226], [104, 250], [130, 250], [138, 226]], 4);
  }, darken(bark, 0.12));
  }, 6);
  arms(ctx, 125, 44, 150, 0.12, () => {
  // branch arms with twigs and leaves
  for (const d of [-1, 1]) {
    t.tube(() => {
      ctx.moveTo(125 + d * 44, 150);
      ctx.quadraticCurveTo(125 + d * 100, 150, 125 + d * 112, 100);
      ctx.moveTo(125 + d * 100, 124);
      ctx.lineTo(125 + d * 122, 128);
    }, 15, bark);
    t.part(() => {
      t.C(125 + d * 112, 92, 16);
      t.C(125 + d * 124, 126, 10);
    }, lighten(leaf, 0.05), undefined, 4);
  }
  });
  // trunk
  t.part(() => t.poly([[80, 230], [78, 120], [96, 96], [154, 96], [172, 120], [170, 230]], 22), bark, () => {
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = rgba(darken(bark, 0.4), 0.7);
    for (const x of [90, 112, 140, 160]) {
      ctx.beginPath();
      ctx.moveTo(x, 104);
      ctx.bezierCurveTo(x + 8, 150, x - 8, 190, x + 2, 228);
      ctx.stroke();
    }
    // a knot hole
    t.paint(rgba(darken(bark, 0.5)), () => t.E(150, 204, 8, 11));
  });
  // hollow face glowing green
  t.paint("#140a04", () => t.E(125, 194, 30, 14));
  t.paint(radial(ctx, 125, 194, 26, [[0, "#d8ffb0"], [0.5, "#6aff4a"], [1, "#1a4a0a"]]), () => t.E(125, 196, 22, 8));
  glowEyes(t, 125, 158, 22, 0.8, 0x7aff4a);
  head(ctx, 125, 120, () => {
  // the canopy
  t.part(() => {
    t.C(70, 66, 44);
    t.C(125, 44, 50);
    t.C(180, 66, 44);
    t.C(100, 90, 34);
    t.C(152, 90, 34);
  }, leaf, () => {
    for (const [x, y, r] of [[96, 34, 18], [150, 50, 14], [62, 66, 12], [190, 64, 10], [124, 80, 12]] as [number, number, number][]) {
      t.paint(rgba(lighten(leaf, 0.3), 0.8), () => t.C(x, y, r));
    }
    for (const [x, y] of [[80, 88], [170, 90], [124, 100]] as P[]) t.paint(rgba(darken(leaf, 0.3), 0.6), () => t.C(x, y, 10));
  });
  // apples / glowing fruit
  for (const [x, y] of [[84, 54], [160, 40], [196, 86], [56, 92]] as P[]) {
    aura(ctx, x, y, 14, 0xff4a3a, 0.4);
    t.part(() => t.C(x, y, 7), 0xe8343a, () => t.gloss(x - 2, y - 2, 3, 2), 2.5);
  }
  }, 5, 0.06);
}

// ───────────────────────── World 2-3: Fields and Misty Forest ─────────────────────────

/** Spore Mother: a glowing blue matriarch mushroom with a frilled skirt, tendrils and floating spores. */
export function sporeMother(ctx: Ctx): void {
  const cap = 0x2ab8d8;
  const t = toon(ctx, ink(cap), 6, true);
  groundShadow(ctx, 125, 238, 96);
  aura(ctx, 125, 110, 130, 0x6ae8ff, 0.3);
  legs(ctx, 125, () => {
  // tendrils trailing on the ground
  for (const [x, b] of [[78, -46], [104, -20], [146, 20], [172, 46]] as P[]) {
    aura(ctx, x + b, 230, 18, 0x6affff, 0.5);
    t.tube(() => {
      ctx.moveTo(x, 206);
      ctx.bezierCurveTo(x + b * 0.2, 226, x + b * 0.8, 214, x + b, 232);
    }, 7, 0x9ae8ff);
    t.part(() => t.C(x + b, 232, 6), 0xd8ffff, undefined, 3);
  }
  }, 7);
  // a frilled skirt
  t.part(() => {
    for (let i = 0; i < 9; i++) t.E(64 + i * 15.5, 196, 13, 22);
  }, 0xd0f4ff);
  // body
  t.part(() => t.poly([[84, 210], [80, 130], [96, 104], [154, 104], [170, 130], [166, 210]], 26), 0xe8f8ff, () => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(90,170,210,0.5)";
    for (const x of [104, 125, 146]) {
      ctx.beginPath();
      ctx.moveTo(x, 110);
      ctx.lineTo(x, 206);
      ctx.stroke();
    }
  });
  head(ctx, 125, 110, () => {
  // the cap: wide with a wavy rim and glowing spots
  t.part(() => {
    t.poly([[14, 96], [36, 48], [84, 16], [125, 10], [166, 16], [214, 48], [236, 96], [200, 108], [160, 100], [125, 110], [90, 100], [50, 108]], 30);
  }, cap, () => {
    for (const [x, y, r] of [[60, 56, 13], [118, 34, 16], [178, 52, 12], [92, 84, 9], [154, 82, 10], [212, 86, 7], [36, 84, 7]] as [number, number, number][]) {
      aura(ctx, x, y, r * 2, 0xbfffff, 0.6);
      t.paint("#e8ffff", () => t.C(x, y, r));
    }
  });
  t.gloss(72, 40, 22, 8, -0.35);
  });
  glowEyes(t, 125, 146, 20, 0.75, 0x6affff);
  t.paint("#14303a", () => t.E(125, 176, 14, 7));
  fangs(t, 125, 172, 7, 8);
  motes(t, [[30, 40, 4], [214, 30, 5], [228, 140, 4], [22, 150, 4], [60, 12, 3], [196, 180, 3]], 0x6affff);
}

/** Shadow Wolf: a dark wolf with a spiky mane, glowing eyes, big fangs and smoke curling off it. */
export function shadowWolf(ctx: Ctx): void {
  const c = 0x3a2a6a;
  const t = toon(ctx, "#0c0818", 6, true);
  groundShadow(ctx, 125, 242, 104);
  aura(ctx, 125, 150, 120, 0x6a3aff, 0.3);
  // smoke wisps
  for (const [x, y, r] of [[40, 200, 22], [210, 196, 26], [70, 230, 18], [186, 232, 18]] as [number, number, number][]) aura(ctx, x, y, r, 0x8a6aff, 0.55);
  sway(ctx, 180, 190, 0.3, () => {
  // tail
  t.part(() => t.poly([[180, 186], [236, 140], [226, 176], [244, 168], [206, 214]], 10), darken(c, 0.1));
  });
  legs(ctx, 125, () => {
  // back legs and front legs
  t.part(() => {
    t.poly([[78, 190], [64, 240], [96, 240], [104, 196]], 8);
    t.poly([[146, 196], [154, 240], [186, 240], [172, 190]], 8);
  }, darken(c, 0.15), () => t.paint("#d8d0f0", () => {
    for (const x of [70, 80, 90, 160, 170, 180]) t.poly([[x, 236], [x + 4, 246], [x + 8, 236]], 1);
  }));
  });
  // body with a spiky mane
  t.part(() => {
    t.E(125, 172, 70, 50);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (1.05 + (i / 8) * 0.9);
      t.poly([[125 + Math.cos(a - 0.2) * 60, 130 + Math.sin(a - 0.2) * 44], [125 + Math.cos(a) * 100, 130 + Math.sin(a) * 80], [125 + Math.cos(a + 0.2) * 60, 130 + Math.sin(a + 0.2) * 44]], 4);
    }
  }, c, () => {
    t.paint(rgba(0x6a5aa0, 0.8), () => t.E(125, 196, 36, 22));
    furStrokes(ctx, 70, 120, 110, 90, c, 50, 11);
  });
  head(ctx, 125, 140, () => {
  // head
  t.part(() => {
    t.E(125, 106, 46, 40);
    t.poly([[90, 92], [76, 30], [114, 76]], 6);
    t.poly([[136, 76], [174, 30], [160, 92]], 6);
  }, lighten(c, 0.05), () => t.paint(rgba(0xa070ff, 0.7), () => {
    t.poly([[90, 82], [82, 44], [106, 74]], 4);
    t.poly([[144, 74], [168, 44], [160, 82]], 4);
  }));
  // snout
  t.part(() => t.E(125, 130, 28, 20), 0x5a4a90, () => t.paint("#14081c", () => t.E(125, 120, 10, 6)));
  glowEyes(t, 125, 98, 20, 0.8, 0x3affff);
  t.paint("#14081c", () => t.E(125, 142, 18, 6));
  fangs(t, 125, 140, 10, 14);
  t.gloss(104, 88, 12, 5);
  });
}

/** Moss Troll: a hulking green troll with tusks, a big nose, a mossy back with mushrooms and a club. */
export function mossTroll(ctx: Ctx): void {
  const c = 0x5a8a3a;
  const t = toon(ctx, "#142008", 6, true);
  groundShadow(ctx, 125, 240, 112);
  sway(ctx, 200, 120, 0.12, () => {
  // a log club
  t.tube(() => {
    ctx.moveTo(216, 214);
    ctx.lineTo(236, 108);
  }, 16, 0x7a5032);
  t.part(() => t.E(236, 100, 18, 26, 0.15), 0x8a5a3a, () => {
    t.paint(rgba(0x6fbf4a), () => t.E(230, 84, 14, 6));
    for (const [x, y] of [[226, 104], [244, 112], [240, 92]] as P[]) t.paint("#d8d0c0", () => t.poly([[x, y], [x + 8, y + 3], [x, y + 6]], 1));
  });
  });
  legs(ctx, 125, () => {
  // legs
  t.part(() => {
    t.E(88, 222, 28, 22);
    t.E(162, 222, 28, 22);
  }, darken(c, 0.12));
  });
  arms(ctx, 125, 64, 115, 0.12, () => {
  // long arms
  t.part(() => {
    t.poly([[64, 110], [26, 140], [20, 206], [50, 210], [56, 150], [80, 128]], 14);
    t.poly([[186, 110], [224, 140], [226, 196], [200, 200], [194, 150], [170, 128]], 14);
  }, c, () => t.paint(rgba(darken(c, 0.2)), () => {
    t.C(36, 206, 16);
    t.C(214, 200, 16);
  }));
  });
  // the hunched body
  t.part(() => t.E(125, 156, 84, 70), c, () => {
    t.paint(rgba(lighten(c, 0.25), 0.8), () => t.E(125, 182, 46, 32));
    // moss on the back and shoulders
    t.paint(rgba(0x3f8a2a), () => {
      t.E(70, 104, 30, 16, -0.4);
      t.E(180, 104, 30, 16, 0.4);
      t.E(125, 92, 40, 14);
    });
    furStrokes(ctx, 50, 90, 150, 30, 0x3f8a2a, 30, 17);
  });
  // mushrooms on the shoulders
  for (const [x, y, k] of [[66, 92, 1], [186, 94, 0.8], [146, 84, 0.6]] as [number, number, number][]) {
    t.part(() => t.rect(x, y + 6 * k, 8 * k, 14 * k, 3), 0xf2e2c8, undefined, 2.5);
    t.part(() => t.E(x, y - 2 * k, 14 * k, 8 * k), 0xe8434f, () => t.paint("#fff4e6", () => t.C(x - 4 * k, y - 4 * k, 2.5 * k)), 2.5);
  }
  head(ctx, 125, 150, () => {
  // head sunk between the shoulders, big nose, tusks
  t.part(() => t.E(125, 128, 46, 36), lighten(c, 0.08));
  glowEyes(t, 125, 116, 20, 0.7, 0xffd23f);
  t.part(() => t.E(125, 136, 16, 13), lighten(c, 0.12), () => t.paint(rgba(darken(c, 0.4)), () => {
    t.C(119, 140, 3);
    t.C(131, 140, 3);
  }), 4);
  t.paint("#14200a", () => t.E(125, 156, 22, 6));
  for (const d of [-1, 1]) t.part(() => t.poly([[125 + d * 12, 156], [125 + d * 22, 156], [125 + d * 26, 134]], 3), 0xfff2dc, undefined, 3);
  });
}

/** Mummy Pharaoh: wrapped in bandages with a striped gold-blue headdress, scarab amulet and green eyes. */
export function mummy(ctx: Ctx): void {
  const wrap = 0xe8dcc0;
  const t = toon(ctx, "#2a2010", 6, true);
  groundShadow(ctx, 125, 240, 84);
  const bandages = (x0: number, y0: number, w: number, h: number) => {
    ctx.lineWidth = 3;
    for (let y = y0; y < y0 + h; y += 11) {
      ctx.strokeStyle = "rgba(120,96,60,0.45)";
      ctx.beginPath();
      ctx.moveTo(x0, y + ((y / 11) % 2) * 4);
      ctx.lineTo(x0 + w, y + 6 - ((y / 11) % 2) * 4);
      ctx.stroke();
    }
  };
  // a loose bandage trailing
  t.tube(() => {
    ctx.moveTo(160, 200);
    ctx.bezierCurveTo(196, 214, 210, 190, 236, 210);
  }, 10, wrap);
  legs(ctx, 125, () => {
  // legs
  t.part(() => {
    t.rect(104, 220, 32, 36, 10);
    t.rect(146, 220, 32, 36, 10);
  }, darken(wrap, 0.08), () => bandages(86, 200, 80, 40));
  });
  arms(ctx, 125, 40, 124, 0.12, () => {
  // reaching arms
  for (const d of [-1, 1]) {
    t.part(() => t.poly([[125 + d * 40, 114], [125 + d * 112, 108], [125 + d * 114, 132], [125 + d * 46, 140]], 12), wrap, () => bandages(d < 0 ? 10 : 165, 104, 76, 40));
    t.part(() => t.C(125 + d * 114, 120, 13), darken(wrap, 0.05), undefined, 4);
  }
  });
  // body
  t.part(() => t.rect(125, 164, 92, 108, 30), wrap, () => {
    bandages(78, 114, 94, 104);
    // gold collar
    t.paint(linear(ctx, 0, 112, 0, 140, [[0, "#ffe27a"], [1, "#c8902a"]]), () => t.E(125, 118, 50, 18));
    for (let i = 0; i < 7; i++) t.paint(rgba(i % 2 ? 0x2a5ac8 : 0xe8343a), () => t.C(90 + i * 11.5, 124 + Math.sin(i / 6 * Math.PI) * 6, 3.5));
  });
  // scarab amulet
  aura(ctx, 125, 168, 22, 0x4ae8a8, 0.6);
  t.part(() => {
    t.E(125, 168, 13, 16);
    t.C(125, 152, 7);
  }, 0x2ab88a, () => t.gloss(121, 162, 4, 6, 0.2), 3);
  head(ctx, 125, 110, () => {
  // head with the striped headdress (nemes)
  t.part(() => t.poly([[70, 70], [92, 30], [158, 30], [180, 70], [170, 124], [146, 104], [104, 104], [80, 124]], 14), 0xffcf3a, () => {
    for (let i = 0; i < 6; i++) {
      t.paint(rgba(0x2a4ab0), () => t.poly([[70 + i * 4, 54 + i * 12], [180 - i * 4, 54 + i * 12], [180 - i * 4, 59 + i * 12], [70 + i * 4, 59 + i * 12]], 1));
    }
  });
  t.part(() => t.E(125, 72, 34, 36), wrap, () => {
    bandages(90, 40, 70, 70);
    t.paint("#14080a", () => t.rect(125, 72, 56, 16, 6));
  });
  glowEyes(t, 125, 72, 15, 0.6, 0x5aff8a, false);
  // cobra on the brow
  t.part(() => t.poly([[118, 40], [125, 20], [132, 40]], 3), 0xffcf3a, () => t.paint("#e8343a", () => t.C(125, 32, 2.5)), 3);
  });
}

/** Sand Worm: a segmented worm bursting out of the sand, a round maw of teeth, spikes and flying sand. */
export function sandWorm(ctx: Ctx): void {
  const c = 0xd89a62;
  const t = toon(ctx, "#3a1e0c", 6, true);
  groundShadow(ctx, 125, 244, 116);
  // the sand mound it bursts from
  t.part(() => t.E(125, 228, 116, 24), 0xe8c88a, () => {
    for (const [x, y] of [[60, 226], [96, 236], [170, 232], [200, 222], [140, 240]] as P[]) t.paint(rgba(0xc8a060, 0.7), () => t.C(x, y, 3));
  });
  sway(ctx, 118, 232, 0.07, () => {
  // segments, curving up
  const segs: [number, number, number][] = [[118, 204, 50], [112, 172, 48], [116, 140, 46], [128, 110, 44], [140, 82, 46]];
  for (const [x, y, r] of segs) {
    t.part(() => t.E(x, y, r, r * 0.72), c, () => {
      t.paint(rgba(lighten(c, 0.2), 0.7), () => t.E(x - r * 0.2, y + r * 0.2, r * 0.6, r * 0.3));
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(darken(c, 0.3), 0.6);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.9, r * 0.6, 0, 0.2, Math.PI - 0.2);
      ctx.stroke();
    });
    // back spikes
    t.part(() => t.poly([[x + r * 0.7, y - r * 0.3], [x + r * 1.15, y - r * 0.5], [x + r * 0.85, y - r * 0.05]], 2), 0x8a5a3a, undefined, 3);
  }
  // the head: a round gaping maw full of teeth
  t.part(() => t.E(146, 56, 58, 46), lighten(c, 0.05));
  t.paint("#14040a", () => t.E(146, 54, 42, 32));
  t.paint(radial(ctx, 146, 54, 40, [[0, "#ff5a6a"], [0.5, "#a81a2a"], [1, "#2a040a"]]), () => t.E(146, 56, 32, 24));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const [ox, oy] = [146 + Math.cos(a) * 40, 54 + Math.sin(a) * 30];
    const [ix, iy] = [146 + Math.cos(a) * 26, 54 + Math.sin(a) * 19];
    t.paint("#fff6e4", () => t.poly([[ox + Math.cos(a + 1.57) * 5, oy + Math.sin(a + 1.57) * 4], [ox - Math.cos(a + 1.57) * 5, oy - Math.sin(a + 1.57) * 4], [ix, iy]], 1));
  }
  // little glowing eyes round the rim
  for (const [x, y] of [[96, 46], [104, 24], [196, 46], [188, 24]] as P[]) {
    aura(ctx, x, y, 10, 0xff8a2a, 0.8);
    t.paint("#fff0a0", () => t.C(x, y, 3.5));
  }
  });
  // sand spraying up
  for (const [x, y, r] of [[34, 196, 8], [210, 190, 7], [24, 170, 5], [222, 160, 5], [50, 150, 4]] as [number, number, number][]) {
    t.part(() => t.C(x, y, r), 0xe8c88a, undefined, 2.5);
  }
}

/** Cactus Colossus: a giant spiny cactus with arms, blooming flowers, a mean face and a sombrero. */
export function cactusColossus(ctx: Ctx): void {
  const c = 0x4aa83a;
  const t = toon(ctx, "#102a0a", 6, true);
  groundShadow(ctx, 125, 240, 92);
  const spines = (pts: P[]) => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#fff8d8";
    for (const [x, y] of pts) {
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 2);
      ctx.lineTo(x + 5, y + 2);
      ctx.moveTo(x - 2, y + 5);
      ctx.lineTo(x + 2, y - 5);
      ctx.stroke();
    }
  };
  // clay pot it stands in
  t.part(() => t.poly([[70, 206], [180, 206], [168, 244], [82, 244]], 6), 0xc8683a, () => t.paint(rgba(0xe8884a), () => t.rect(125, 210, 116, 10, 3)));
  arms(ctx, 125, 52, 140, 0.14, () => {
  // arms
  t.part(() => {
    t.rect(38, 118, 36, 80, 18);
    t.rect(58, 150, 40, 30, 15);
    t.rect(212, 96, 36, 76, 18);
    t.rect(192, 130, 40, 30, 15);
  }, darken(c, 0.05), () => spines([[30, 100], [44, 130], [32, 156], [220, 80], [206, 110], [222, 140]]));
  });
  // the trunk
  t.part(() => t.rect(125, 130, 104, 170, 52), c, () => {
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(darken(c, 0.3), 0.6);
    for (const x of [96, 125, 154]) {
      ctx.beginPath();
      ctx.moveTo(x, 54);
      ctx.lineTo(x, 210);
      ctx.stroke();
    }
    spines([[86, 70], [110, 60], [140, 62], [164, 74], [84, 190], [166, 186], [110, 196], [142, 200]]);
  });
  // flowers
  for (const [x, y, k] of [[38, 76, 1], [212, 58, 0.9], [92, 176, 0.7]] as [number, number, number][]) {
    t.part(() => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        t.E(x + Math.cos(a) * 9 * k, y + Math.sin(a) * 9 * k, 8 * k, 5 * k, a);
      }
    }, 0xff6aa0, undefined, 3);
    t.paint("#ffe066", () => t.C(x, y, 5 * k));
  }
  glowEyes(t, 125, 116, 22, 0.8, 0xff4a2a);
  maw(t, 125, 150, 22, 9, 4);
  head(ctx, 125, 60, () => {
  // sombrero
  t.part(() => {
    t.E(125, 52, 86, 15);
    t.poly([[94, 54], [104, 10], [146, 10], [156, 54]], 14);
  }, 0xe8c060, () => {
    t.paint(rgba(0xe8343a), () => t.rect(125, 44, 62, 8, 3));
    for (let i = 0; i < 6; i++) t.paint(rgba(0x2ab88a), () => t.C(98 + i * 11, 44, 2.5));
  });
  });
}

/** Sand Scorpion: armoured plates, two big open pincers in front, a thick segmented tail with a glowing venom stinger. */
export function scorpion(ctx: Ctx): void {
  const c = 0xc88a3a;
  const t = toon(ctx, "#2a1406", 6, true);
  groundShadow(ctx, 130, 214, 118);
  legs(ctx, 142, () => {
  // legs
  t.tube(() => {
    for (const [x1, x2, y2] of [[110, 90, 214], [128, 116, 218], [156, 166, 218], [174, 196, 214]]) {
      ctx.moveTo(x1, 186);
      ctx.quadraticCurveTo((x1 + x2) / 2, 168, x2, y2);
    }
  }, 8, darken(c, 0.25));
  }, 6);
  sway(ctx, 196, 172, 0.09, () => {
  // the tail: thick armoured segments arching up over the back
  const tail: [number, number, number][] = [[200, 160, 26], [226, 124, 24], [232, 84, 22], [218, 50, 20], [192, 30, 18]];
  for (const [x, y, r] of tail) {
    t.part(() => t.C(x, y, r), c, () => {
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(darken(c, 0.35), 0.7);
      ctx.beginPath();
      ctx.arc(x, y, r * 0.72, -2.4, -0.6);
      ctx.stroke();
    });
  }
  // the stinger, curving down, dripping venom
  aura(ctx, 160, 46, 34, 0x8aff4a, 0.7);
  t.part(() => t.poly([[178, 20], [178, 44], [158, 58], [148, 70], [160, 40]], 4), 0x5a2a3a, () => t.paint("#aaff6a", () => t.C(170, 34, 4)));
  t.part(() => t.C(146, 80, 5), 0xaaff6a, undefined, 2.5);
  });
  sway(ctx, 98, 172, -0.12, () => {
  // pincers reaching forward (left), jaws open
  for (const [ax, ay, x, y] of [[96, 156, 46, 128], [100, 186, 40, 198]] as [number, number, number, number][]) {
    t.tube(() => {
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + x) / 2, (ay + y) / 2 - 10, x + 14, y);
    }, 13, darken(c, 0.1));
    t.part(() => {
      t.E(x + 12, y, 22, 17);
      t.poly([[x + 2, y - 8], [x - 34, y - 24], [x - 22, y - 4]], 4);
      t.poly([[x + 2, y + 8], [x - 32, y + 18], [x - 20, y + 4]], 4);
    }, darken(c, 0.04), () => t.paint(rgba(lighten(c, 0.25), 0.6), () => t.E(x + 8, y - 4, 10, 6)));
  }
  });
  // armoured body plates
  t.part(() => t.E(140, 170, 66, 38), c, () => {
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(darken(c, 0.35), 0.8);
    for (const x of [126, 152, 176]) {
      ctx.beginPath();
      ctx.arc(x, 170, 32, -1.15, 1.15);
      ctx.stroke();
    }
  });
  head(ctx, 104, 190, () => {
  // head
  t.part(() => t.E(104, 168, 30, 24), lighten(c, 0.05));
  t.gloss(94, 154, 10, 5);
  glowEyes(t, 104, 164, 12, 0.58, 0xaaff4a);
  t.paint("#14040a", () => t.E(98, 184, 11, 5));
  fangs(t, 98, 182, 6, 8);
  }, 3);
}

// ───────────────────────── World 5: Frozen Peaks ─────────────────────────

/** Penguin Emperor: a royal penguin with a cape, a crown, medals and an ice-crystal sceptre. */
export function penguinEmperor(ctx: Ctx): void {
  const c = 0x1e2a4a;
  const t = toon(ctx, "#080c1a", 6, true);
  groundShadow(ctx, 125, 240, 92);
  // the royal cape
  t.part(() => t.poly([[54, 90], [196, 90], [220, 236], [125, 228], [30, 236]], 12), 0xb81a2a, () => {
    t.paint(rgba(0xffffff), () => {
      for (let i = 0; i < 9; i++) t.C(40 + i * 21, 232, 9);
    });
    for (let i = 0; i < 9; i++) t.paint("#14141a", () => t.C(40 + i * 21, 232, 2.5));
  });
  legs(ctx, 125, () => {
  // feet
  t.part(() => {
    t.E(100, 230, 22, 9);
    t.E(150, 230, 22, 9);
  }, 0xffa020);
  }, 6);
  // body
  t.part(() => t.E(125, 150, 66, 84), c, () => {
    t.paint(linear(ctx, 0, 90, 0, 230, [[0, "#ffffff"], [1, "#d8e4f4"]]), () => t.E(125, 166, 44, 66));
  });
  arms(ctx, 125, 56, 120, 0.3, () => {
  // flippers
  for (const d of [-1, 1]) t.part(() => t.E(125 + d * 62, 150, 14, 40, d * 0.35), c);
  }, true);
  // medals
  for (const [x, col] of [[106, 0xffcf3a], [124, 0x4ac8ff]] as [number, number][]) {
    t.part(() => t.poly([[x - 4, 124], [x + 4, 124], [x + 3, 136], [x - 3, 136]], 1), 0xe8343a, undefined, 2);
    t.part(() => t.C(x, 140, 6), col, undefined, 2.5);
  }
  head(ctx, 125, 110, () => {
  // head
  t.part(() => t.C(125, 74, 46), c, () => t.paint("#ffffff", () => {
    t.E(108, 80, 14, 16);
    t.E(142, 80, 14, 16);
  }));
  t.gloss(104, 54, 12, 6);
  glowEyes(t, 125, 78, 17, 0.6, 0x4ac8ff);
  t.part(() => t.poly([[110, 92], [140, 92], [125, 112]], 4), 0xffa020, undefined, 4);
  crown(t, 125, 36, 0.72, 0x4ac8ff);
  });
  sway(ctx, 206, 224, 0.06, () => {
  // the ice sceptre
  t.tube(() => {
    ctx.moveTo(206, 224);
    ctx.lineTo(214, 96);
  }, 7, 0xc8d8f0);
  aura(ctx, 216, 74, 34, 0x8ae8ff, 0.7);
  t.part(() => t.poly([[216, 46], [232, 76], [216, 104], [200, 76]], 3), 0xbff0ff, () => t.gloss(211, 68, 5, 10, 0.2), 4);
  });
}

/** Ice Golem: jagged ice blocks with crystal spikes, a glowing frozen core and frosty breath. */
export function iceGolem(ctx: Ctx): void {
  const c = 0x8fd0ee;
  const t = toon(ctx, "#123048", 6, true);
  groundShadow(ctx, 125, 240, 110);
  aura(ctx, 125, 140, 110, 0x8ae8ff, 0.3);
  const crystal = (x: number, y: number, h: number, a: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    t.part(() => t.poly([[-9, 0], [0, -h], [9, 0]], 2), 0xd8f6ff, () => t.paint("rgba(255,255,255,0.7)", () => t.poly([[-4, -2], [0, -h * 0.85], [1, -2]], 1)), 3);
    ctx.restore();
  };
  legs(ctx, 125, () => {
  // legs
  t.part(() => {
    t.poly([[74, 194], [114, 194], [118, 240], [66, 240]], 10);
    t.poly([[136, 194], [176, 194], [184, 240], [132, 240]], 10);
  }, darken(c, 0.1));
  });
  arms(ctx, 125, 62, 96, 0.14, () => {
  // arms
  for (const d of [-1, 1]) {
    t.part(() => t.poly([[125 + d * 60, 92], [125 + d * 104, 104], [125 + d * 112, 156], [125 + d * 74, 148]], 12), darken(c, 0.05));
    t.part(() => t.poly([[125 + d * 80, 150], [125 + d * 122, 148], [125 + d * 124, 204], [125 + d * 78, 202]], 16), c);
  }
  });
  // shoulder crystals
  for (const [x, y, h, a] of [[64, 88, 40, -0.5], [80, 80, 30, -0.2], [186, 88, 40, 0.5], [170, 80, 30, 0.2], [26, 150, 24, -0.9], [224, 150, 24, 0.9]] as [number, number, number, number][]) crystal(x, y, h, a);
  // torso
  t.part(() => t.poly([[62, 74], [188, 74], [200, 140], [174, 204], [76, 204], [50, 140]], 22), c, () => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    for (const [x1, y1, x2, y2] of [[80, 100, 96, 136], [96, 136, 90, 170], [168, 104, 150, 140], [150, 140, 160, 180]]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    // frost speckle
    for (let i = 0; i < 16; i++) t.paint("rgba(255,255,255,0.75)", () => t.C(70 + ((i * 37) % 110), 90 + ((i * 53) % 100), 1.8));
  });
  // frozen core
  aura(ctx, 125, 158, 40, 0x4ae8ff, 0.9);
  t.part(() => t.poly([[125, 132], [144, 158], [125, 186], [106, 158]], 3), 0x6ae8ff, () => t.gloss(119, 152, 5, 9, 0.2), 3);
  head(ctx, 125, 84, () => {
  // head
  t.part(() => t.poly([[90, 30], [160, 30], [170, 84], [80, 84]], 16), lighten(c, 0.08));
  crystal(108, 34, 24, -0.2);
  crystal(142, 34, 28, 0.15);
  glowEyes(t, 125, 60, 18, 0.72, 0x3ae8ff);
  });
  // frosty breath
  for (const [x, y, r] of [[110, 98, 12], [130, 104, 10], [146, 96, 8]] as [number, number, number][]) aura(ctx, x, y, r, 0xffffff, 0.7);
}

/** Frost Yeti: a shaggy giant with curled horns, an icy blue face, fangs and huge clawed arms. */
export function yeti(ctx: Ctx): void {
  const fur = 0xeef4ff;
  const t = toon(ctx, "#1e2e50", 6, true);
  groundShadow(ctx, 125, 244, 108);
  legs(ctx, 125, () => {
  // legs
  t.part(() => {
    t.E(92, 224, 24, 22);
    t.E(158, 224, 24, 22);
  }, darken(fur, 0.08), () => furStrokes(ctx, 66, 206, 120, 36, fur, 24, 21));
  });
  head(ctx, 125, 140, () => {
  // curled horns
  for (const d of [-1, 1]) horn(t, 125 + d * 40, 70, 64, 20, -Math.PI / 2 - d * 0.9, d * 2.2, 0xb8c4d8);
  });
  arms(ctx, 125, 70, 110, 0.16, () => {
  // big arms with claws
  for (const d of [-1, 1]) {
    t.part(() => {
      t.E(125 + d * 86, 150, 30, 58, d * 0.25);
      for (let i = 0; i < 4; i++) t.C(125 + d * (82 + i * 8), 202 + (i % 2) * 4, 9);
    }, darken(fur, 0.04), () => furStrokes(ctx, d < 0 ? 18 : 176, 96, 60, 110, fur, 28, 23 + d));
    for (let i = 0; i < 3; i++) t.part(() => t.poly([[125 + d * (80 + i * 10), 210], [125 + d * (84 + i * 10), 226], [125 + d * (88 + i * 10), 210]], 1), 0x8aa8c8, undefined, 2);
  }
  });
  // the shaggy body
  t.part(() => {
    t.E(125, 150, 78, 86);
    for (let i = 0; i < 10; i++) {
      const a = Math.PI * (0.1 + (i / 9) * 0.8);
      t.C(125 + Math.cos(a) * 74, 150 + Math.sin(a) * 82, 13);
    }
  }, fur, () => {
    furStrokes(ctx, 54, 70, 142, 160, fur, 80, 27);
    t.paint(rgba(0xd0e0f4, 0.7), () => t.E(125, 182, 40, 34));
  });
  head(ctx, 125, 140, () => {
  // icy face
  t.part(() => t.E(125, 120, 50, 42), 0x6a98e0, () => {
    t.paint("rgba(255,255,255,0.25)", () => t.E(110, 102, 26, 10, -0.3));
    t.paint(rgba(0x5a84c8), () => t.E(125, 148, 26, 12));
  });
  glowEyes(t, 125, 112, 18, 0.72, 0x9affff);
  t.paint("#0c1428", () => t.E(125, 144, 18, 8));
  fangs(t, 125, 140, 11, 13);
  });
}

/** Frost Dragon: horned head, spiny back, huge ice wings, scaly belly, a tail with an ice blade, frost mist. */
export function frostDragon(ctx: Ctx): void {
  const c = 0x7ac0ec;
  const t = toon(ctx, "#0e2a48", 6, true);
  groundShadow(ctx, 125, 244, 108);
  aura(ctx, 125, 120, 130, 0xbff0ff, 0.3);
  arms(ctx, 125, 36, 120, 0.22, () => {
  // wings
  for (const d of [-1, 1]) {
    const m = (x: number) => 125 + d * x;
    t.part(() => t.poly([[m(36), 120], [m(78), 30], [m(122), 8], [m(116), 60], [m(124), 92], [m(102), 92], [m(104), 128], [m(80), 118], [m(66), 150]], 5), 0xa8dcf8, () => {
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.strokeStyle = rgba(0x4a90c8);
      ctx.beginPath();
      ctx.moveTo(m(40), 124);
      ctx.lineTo(m(80), 34);
      ctx.lineTo(m(120), 12);
      ctx.moveTo(m(80), 34);
      ctx.lineTo(m(118), 88);
      ctx.moveTo(m(80), 34);
      ctx.lineTo(m(100), 124);
      ctx.moveTo(m(80), 34);
      ctx.lineTo(m(68), 146);
      ctx.stroke();
      t.paint("rgba(255,255,255,0.35)", () => t.poly([[m(84), 40], [m(110), 22], [m(104), 60]], 3));
    });
  }
  }, true);
  sway(ctx, 162, 214, 0.15, () => {
  // tail with an ice blade
  t.part(() => t.poly([[160, 200], [214, 214], [236, 190], [226, 222], [170, 228]], 8), darken(c, 0.08));
  t.part(() => t.poly([[226, 196], [246, 168], [240, 206]], 2), 0xe0f8ff, undefined, 3);
  });
  legs(ctx, 125, () => {
  // legs
  t.part(() => {
    t.E(94, 222, 22, 20);
    t.E(156, 222, 22, 20);
  }, darken(c, 0.12), () => t.paint("#ffffff", () => {
    for (const x of [80, 92, 104, 142, 154, 166]) t.poly([[x, 236], [x + 4, 246], [x + 8, 236]], 1);
  }));
  }, 7);
  // body with a scaly belly
  t.part(() => t.E(125, 168, 56, 62), c, () => {
    t.paint(rgba(0xe4f6ff), () => t.E(125, 182, 32, 46));
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(90,150,200,0.6)";
    for (let y = 148; y < 226; y += 12) {
      ctx.beginPath();
      ctx.moveTo(100, y);
      ctx.quadraticCurveTo(125, y + 6, 150, y);
      ctx.stroke();
    }
    for (let i = 0; i < 12; i++) t.paint(rgba(darken(c, 0.2), 0.5), () => t.E(78 + (i % 3) * 8 + (i > 5 ? 82 : 0), 140 + Math.floor((i % 6) / 3) * 30 + (i % 3) * 8, 5, 3.5));
  });
  // neck spines
  for (let i = 0; i < 4; i++) t.part(() => t.poly([[110 + i * 10, 116 - i * 3], [116 + i * 10, 96 - i * 4], [122 + i * 10, 116 - i * 3]], 2), 0xe0f8ff, undefined, 3);
  head(ctx, 125, 120, () => {
  // head with horns and a long snout
  for (const d of [-1, 1]) horn(t, 125 + d * 22, 62, 46, 14, -Math.PI / 2 - d * 0.6, d * 0.8, 0xe8f4ff);
  t.part(() => {
    t.E(125, 86, 38, 32);
    t.E(125, 110, 26, 18);
  }, lighten(c, 0.08), () => t.paint(rgba(0x3a6aa0), () => {
    t.E(116, 114, 3, 2);
    t.E(134, 114, 3, 2);
  }));
  t.gloss(108, 70, 12, 5);
  glowEyes(t, 125, 82, 16, 0.6, 0x3affff);
  fangs(t, 125, 124, 12, 9);
  // frost mist curling from the jaws
  for (const [x, y, r] of [[100, 132, 14], [150, 134, 12], [125, 142, 16]] as [number, number, number][]) aura(ctx, x, y, r, 0xffffff, 0.8);
  motes(t, [[30, 180, 3], [220, 120, 3], [40, 60, 3], [210, 40, 3]], 0xbff0ff);
  });
}

/** Every boss picture: key, width, height, painter (feet near the bottom, origin 0.5 x 0.94). */
export const BOSS_ART: Record<string, [number, number, (ctx: Ctx) => void]> = {
  b_slimeking: [250, 250, slimeKing],
  b_mushtitan: [250, 252, mushroomTitan],
  b_batqueen: [250, 250, batQueen],
  e_golem: [250, 250, stoneGolem],
  b_magmaking: [250, 250, magmaKing],
  b_scarecrow: [250, 250, scarecrow],
  b_thundercrow: [250, 250, thunderCrow],
  b_haybrute: [250, 256, hayBrute],
  e_pumpking: [250, 250, pumpkinKing],
  b_sporemother: [250, 252, sporeMother],
  b_shadowwolf: [250, 256, shadowWolf],
  b_mosstroll: [250, 252, mossTroll],
  e_treant: [250, 256, treant],
  b_mummy: [250, 252, mummy],
  b_sandworm: [250, 254, sandWorm],
  b_cactus: [250, 252, cactusColossus],
  e_scorpion: [260, 224, scorpion],
  b_penguin: [250, 250, penguinEmperor],
  b_icegolem: [250, 250, iceGolem],
  e_yeti: [250, 262, yeti],
  b_frostdragon: [250, 254, frostDragon],
};
