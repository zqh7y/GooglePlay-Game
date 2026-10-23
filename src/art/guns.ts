import Phaser from "phaser";
import { GUNS, GunDef, gunKey } from "../data/guns";
import { Ctx, canvasTexture, darken, lighten, rgba, starPath } from "./draw";

/**
 * Toy guns: bright plastic in thick dark outlines with a top-lit gradient and a shine
 * stripe. Each one shoots its own silly ammo (water, corks, foam darts, bubbles, confetti,
 * candy, paintballs, snowballs, peas, fireworks, gumballs, water balloons, fire, stars).
 * All point right; data/guns.ts says where the grip and the muzzle are.
 */
const OL = "#1b1720";
const LW = 4;

const DARK = 0x3a3550;
const BLUE = 0x3ab0ff;
const ORANGE = 0xff8a2a;
const YELLOW = 0xffd23f;
const RED = 0xff5a5a;
const PINK = 0xff7ab8;
const PURPLE = 0xb46aff;
const LIME = 0x7ad651;
const TEAL = 0x2fd0c0;
const WHITE = 0xf2f6fb;
const ICE = 0x9ae0ff;
const GREEN = 0x5ac84a;
const LEAF = 0x3a9a3a;
const GOLD = 0xf2c23a;
const DRAGON = 0xd8323a;
const BROWN = 0xb8743a;

let ctx: Ctx;

type Path = () => void;

/** Rounded rectangle sub-path. */
const R = (x: number, y: number, w: number, h: number, r = 4): Path => () => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

/** Rounded polygon sub-path. */
const P = (pts: [number, number][], r = 5): Path => () => {
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const s = mid(pts[pts.length - 1], pts[0]);
  ctx.moveTo(s[0], s[1]);
  pts.forEach((p, i) => ctx.arcTo(p[0], p[1], ...mid(p, pts[(i + 1) % pts.length]), r));
  ctx.closePath();
};

const C = (x: number, y: number, r: number): Path => () => {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
};

const E = (x: number, y: number, rx: number, ry: number): Path => () => {
  ctx.moveTo(x + rx, y);
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
};

/** An outlined part with a top-lit gradient and a shine stripe. */
function part(path: Path, color: number, y0: number, y1: number, shine = 0.3, lw = LW): void {
  ctx.beginPath();
  path();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = lw * 2;
  ctx.strokeStyle = OL;
  ctx.stroke();
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(lighten(color, 0.3)));
  g.addColorStop(0.45, rgba(color));
  g.addColorStop(1, rgba(darken(color, 0.25)));
  ctx.fillStyle = g;
  ctx.fill();
  if (shine > 0) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = `rgba(255,255,255,${shine})`;
    ctx.fillRect(0, y0 + 2, 1000, Math.max(2, (y1 - y0) * 0.22));
    ctx.restore();
  }
}

/** Plain fill, no outline (decals, liquid, things inside glass). */
function paint(path: Path, color: string): void {
  ctx.beginPath();
  path();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Paint stripes / decals clipped to a part, then redraw its outline on top. */
function clipped(path: Path, draw: () => void, lw = LW): void {
  ctx.save();
  ctx.beginPath();
  path();
  ctx.clip();
  draw();
  ctx.restore();
  ctx.beginPath();
  path();
  ctx.lineWidth = lw;
  ctx.strokeStyle = OL;
  ctx.stroke();
}

function line(pts: [number, number][], w: number, color: string): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Outlined thick stroke (handles, guards, strings). */
function tube(path: Path, w: number, color: number): void {
  ctx.beginPath();
  path();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = w + LW * 2;
  ctx.strokeStyle = OL;
  ctx.stroke();
  ctx.lineWidth = w;
  ctx.strokeStyle = rgba(color);
  ctx.stroke();
}

const guard = (cx: number, cy: number, r: number, color: number) => tube(() => ctx.arc(cx, cy, r, 0.1, Math.PI - 0.1), 5, color);

const star = (x: number, y: number, r: number, color: number) => part(() => starPath(ctx, x, y, r), color, y - r, y + r, 0.3, 2.5);

const dots = (pts: [number, number, number][], color: string) => pts.forEach(([x, y, r]) => paint(C(x, y, r), color));

function glow(x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

const stripes = (x0: number, x1: number, y0: number, y1: number, w: number, colors: string[]) => {
  let k = 0;
  for (let x = x0 - (y1 - y0); x < x1; x += w) {
    ctx.fillStyle = colors[k++ % colors.length];
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x + w / 2, y1);
    ctx.lineTo(x + w / 2 + (y1 - y0), y0);
    ctx.lineTo(x + (y1 - y0), y0);
    ctx.closePath();
    ctx.fill();
  }
};

// ───────────────────────── the guns ─────────────────────────

const ART: Record<string, () => void> = {
  /** A: a squirt gun with a water tank on top. */
  glock() {
    const tank = R(46, 6, 58, 28, 12);
    part(tank, 0xbff4ff, 6, 34, 0.5);
    paint(R(50, 18, 50, 13, 6), "rgba(58,200,255,0.85)");
    dots([[60, 14, 3], [76, 12, 2], [88, 15, 2.5]], "rgba(255,255,255,0.8)");
    part(R(66, 1, 16, 9, 3), ORANGE, 1, 10, 0.3);
    part(P([[14, 32], [118, 28], [138, 34], [138, 50], [64, 54], [40, 56], [14, 52]], 12), BLUE, 28, 56, 0.4);
    part(R(130, 33, 16, 12, 4), ORANGE, 33, 45, 0.35);
    dots([[30, 42, 4], [104, 38, 3]], "rgba(255,255,255,0.55)");
    guard(84, 60, 10, ORANGE);
    part(P([[34, 52], [66, 52], [60, 94], [28, 94]], 12), ORANGE, 52, 94, 0.3);
  },

  /** A: a pop gun that fires corks on a string. */
  revolver() {
    line([[44, 44], [110, 64], [180, 34]], 2.5, "#7a5236");
    part(R(66, 22, 112, 20, 9), RED, 22, 42, 0.4);
    paint(R(72, 28, 100, 5, 2), "rgba(255,255,255,0.45)");
    part(R(168, 20, 20, 24, 6), 0xd8a060, 20, 44, 0.35);
    dots([[174, 28, 1.8], [182, 34, 1.8], [175, 39, 1.5]], "rgba(110,70,30,0.6)");
    part(P([[26, 18], [42, 12], [46, 26], [34, 28]], 4), RED, 12, 28, 0.3);
    part(P([[36, 20], [84, 20], [88, 56], [40, 60]], 10), YELLOW, 20, 60, 0.4);
    star(62, 38, 10, RED);
    guard(76, 62, 10, YELLOW);
    part(P([[38, 54], [64, 54], [58, 76], [50, 96], [24, 96], [30, 74]], 12), PURPLE, 54, 96, 0.35);
  },

  /** B: a foam dart blaster. */
  uzi() {
    tube(() => {
      ctx.moveTo(30, 38);
      ctx.lineTo(8, 42);
      ctx.lineTo(10, 64);
      ctx.lineTo(28, 62);
    }, 7, BLUE);
    part(R(140, 30, 26, 22, 8), BLUE, 30, 52, 0.4);
    part(R(160, 32, 9, 18, 3), ORANGE, 32, 50, 0.3);
    part(R(26, 22, 120, 38, 12), ORANGE, 22, 60, 0.4);
    paint(R(34, 38, 104, 8, 4), "rgba(58,138,255,0.75)");
    part(R(40, 11, 90, 13, 6), BLUE, 11, 24, 0.4);
    part(R(116, 3, 16, 12, 4), YELLOW, 3, 15, 0.3);
    part(R(56, 56, 32, 58, 8), YELLOW, 56, 114, 0.35);
    dots([[64, 63, 4], [72, 63, 4], [80, 63, 4]], rgba(ORANGE));
    guard(104, 64, 9, BLUE);
    part(P([[92, 56], [116, 56], [112, 98], [92, 98]], 10), BLUE, 56, 98, 0.3);
  },

  /** B: a bubble machine with a wand at the front. */
  mp5() {
    part(R(116, 54, 40, 50, 14), 0xffc8e8, 54, 104, 0.5);
    paint(R(120, 72, 32, 28, 10), "rgba(255,122,200,0.8)");
    part(P([[4, 30], [32, 28], [32, 56], [4, 60]], 8), TEAL, 28, 60, 0.35);
    part(P([[24, 26], [180, 22], [196, 30], [196, 56], [24, 60]], 14), PURPLE, 22, 60, 0.4);
    part(C(62, 41, 13), DARK, 28, 54, 0.2);
    line([[54, 41], [70, 41]], 3, "rgba(255,255,255,0.6)");
    line([[62, 33], [62, 49]], 3, "rgba(255,255,255,0.6)");
    for (const [x, y, r] of [[110, 34, 6], [134, 40, 4], [156, 32, 5]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.stroke();
    }
    part(R(190, 34, 14, 12, 4), YELLOW, 34, 46, 0.3);
    paint(E(214, 40, 10, 18), "rgba(200,240,255,0.55)");
    tube(E(214, 40, 10, 18), 5, YELLOW);
    guard(110, 62, 9, TEAL);
    part(P([[84, 56], [110, 56], [104, 98], [82, 98]], 10), TEAL, 56, 98, 0.3);
  },

  /** C: a party cannon that blasts confetti. */
  shotgun() {
    const stock = P([[6, 36], [84, 24], [84, 52], [66, 54], [16, 70], [4, 66]], 10);
    part(stock, PINK, 24, 70, 0.35);
    star(36, 50, 7, YELLOW);
    const bell: Path = () => {
      ctx.moveTo(124, 26);
      ctx.lineTo(214, 22);
      ctx.quadraticCurveTo(250, 12, 266, 4);
      ctx.lineTo(266, 72);
      ctx.quadraticCurveTo(250, 64, 214, 54);
      ctx.lineTo(124, 50);
      ctx.closePath();
    };
    part(bell, TEAL, 4, 72, 0.4);
    clipped(bell, () => stripes(124, 266, 4, 72, 34, ["rgba(255,122,184,0.85)", "rgba(255,210,63,0.85)"]));
    part(E(264, 38, 6, 34), WHITE, 4, 72, 0.3, 3);
    part(R(80, 20, 48, 34, 9), YELLOW, 20, 54, 0.4);
    for (const [x, y, r, c] of [[236, 6, 0.4, "#ff5a8a"], [252, 70, -0.6, "#5ac8ff"], [222, 66, 0.9, "#7ad651"]] as [number, number, number, string][]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r);
      ctx.fillStyle = c;
      ctx.fillRect(-5, -3, 10, 6);
      ctx.restore();
    }
    guard(100, 56, 10, PINK);
  },

  /** C: a candy-cane pistol. */
  deagle() {
    const slide = R(18, 20, 150, 30, 14);
    part(slide, WHITE, 20, 50, 0.4);
    clipped(slide, () => stripes(18, 168, 20, 50, 26, ["rgba(240,64,80,0.95)", "rgba(255,255,255,0)"]));
    part(R(160, 23, 16, 24, 7), PINK, 23, 47, 0.35);
    part(P([[34, 48], [150, 48], [150, 62], [80, 62], [76, 70], [38, 70]], 6), PINK, 48, 70, 0.35);
    guard(92, 66, 11, PINK);
    part(P([[38, 62], [78, 62], [70, 106], [28, 106]], 12), 0x7ad6c8, 62, 106, 0.35);
    part(C(52, 86, 13), WHITE, 73, 99, 0.2, 2.5);
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) ctx.lineTo(52 + Math.cos(a) * a * 0.8, 86 + Math.sin(a) * a * 0.8);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ff5a8a";
    ctx.stroke();
  },

  /** D: a paintball marker with a hopper full of paint. */
  ak47() {
    part(P([[6, 42], [98, 34], [100, 58], [70, 60], [16, 78], [4, 74]], 10), ORANGE, 34, 78, 0.35);
    part(R(228, 36, 52, 12, 5), DARK, 36, 48, 0.3);
    part(R(274, 32, 14, 20, 5), LIME, 32, 52, 0.3);
    part(R(176, 58, 54, 18, 9), BLUE, 58, 76, 0.4);
    const body = P([[94, 30], [234, 30], [238, 56], [94, 60]], 10);
    part(body, LIME, 30, 60, 0.4);
    clipped(body, () => {
      dots([[120, 50, 9], [128, 44, 4], [182, 40, 8], [190, 50, 4], [216, 52, 6]], "rgba(255,90,138,0.85)");
      dots([[150, 36, 5], [204, 38, 4]], "rgba(90,200,255,0.9)");
    });
    const hopper = R(136, 0, 58, 34, 16);
    part(hopper, 0xfff7c0, 0, 34, 0.5);
    clipped(hopper, () => {
      const cols = ["#ff5a8a", "#5ac8ff", "#ffd23f", "#7ad651", "#b46aff"];
      let k = 0;
      for (let y = 12; y < 36; y += 9) for (let x = 142; x < 194; x += 10) dots([[x + (y % 2) * 4, y, 5]], cols[k++ % cols.length]);
    }, 3);
    part(R(156, 30, 16, 6, 2), DARK, 30, 36, 0.2);
    guard(130, 64, 10, DARK);
    part(P([[106, 56], [130, 56], [124, 100], [102, 98]], 10), DARK, 56, 100, 0.25);
  },

  /** D: an icy rifle that shoots snowballs. */
  m4a1() {
    part(P([[6, 40], [74, 38], [74, 62], [22, 64], [6, 70]], 10), WHITE, 38, 70, 0.35);
    part(R(234, 40, 46, 12, 5), 0x5ab0e0, 40, 52, 0.3);
    part(R(274, 35, 14, 22, 6), WHITE, 35, 57, 0.3);
    part(P([[70, 30], [240, 30], [244, 58], [70, 62]], 12), ICE, 30, 62, 0.4);
    for (const x of [96, 130, 170, 210]) part(P([[x - 8, 60], [x + 8, 60], [x, 76]], 3), 0xd8f6ff, 60, 76, 0.3, 2.5);
    part(() => {
      for (let x = 82; x <= 232; x += 25) C(x, 32, 11)();
    }, WHITE, 21, 43, 0.2, 3);
    part(C(160, 14, 16), WHITE, -2, 30, 0.4, 3);
    line([[152, 14], [168, 14]], 2.5, "#7ac8f0");
    line([[160, 6], [160, 22]], 2.5, "#7ac8f0");
    guard(132, 64, 10, 0x3a7ac8);
    part(P([[108, 58], [132, 58], [128, 100], [106, 98]], 10), 0x3a7ac8, 58, 100, 0.3);
  },

  /** E: a long pea-pod sniper. */
  awp() {
    part(P([[6, 30], [40, 16], [70, 26], [40, 36]], 8), LEAF, 16, 36, 0.3);
    part(P([[6, 40], [110, 34], [114, 62], [84, 66], [60, 86], [14, 86], [6, 80]], 12), LEAF, 34, 86, 0.35);
    const pod: Path = () => {
      ctx.moveTo(110, 30);
      ctx.quadraticCurveTo(220, 14, 326, 38);
      ctx.quadraticCurveTo(334, 48, 326, 58);
      ctx.quadraticCurveTo(220, 72, 110, 62);
      ctx.closePath();
    };
    part(pod, GREEN, 14, 72, 0.4);
    line([[128, 46], [318, 47]], 18, "rgba(40,110,40,0.9)");
    for (let x = 142; x <= 304; x += 30) part(C(x, 46, 10), 0xa8f070, 36, 56, 0.45, 2.5);
    tube(() => {
      ctx.moveTo(172, 30);
      ctx.lineTo(172, 18);
    }, 4, LEAF);
    part(C(172, 12, 11), 0xa8f070, 1, 23, 0.45, 3);
    part(P([[180, 8], [200, 2], [196, 14]], 4), LEAF, 2, 14, 0.3, 2.5);
    guard(128, 64, 9, BROWN);
    part(P([[110, 58], [132, 58], [126, 100], [104, 98]], 10), BROWN, 58, 100, 0.3);
  },

  /** E: a fireworks launcher with a bundle of rockets underneath. */
  aa12() {
    part(P([[8, 30], [74, 28], [74, 62], [22, 64], [8, 72]], 10), DARK, 28, 72, 0.3);
    const cols = [PINK, BLUE, LIME];
    cols.forEach((c, i) => {
      const x = 124 + i * 26;
      part(R(x, 58, 22, 54, 4), c, 58, 112, 0.35, 3);
      line([[x + 11, 112], [x + 7, 122]], 2.5, "#4a2f1d");
      star(x + 6, 124, 4, YELLOW);
    });
    part(P([[70, 26], [222, 26], [228, 58], [70, 62]], 12), RED, 26, 62, 0.4);
    star(110, 42, 9, YELLOW);
    star(196, 40, 7, YELLOW);
    part(R(218, 28, 38, 28, 9), YELLOW, 28, 56, 0.4);
    paint(E(252, 42, 4, 10), "#2a1a20");
    guard(112, 64, 9, DARK);
    part(P([[90, 58], [112, 58], [108, 104], [88, 102]], 10), DARK, 58, 104, 0.3);
  },

  /** S: a gumball machine on spinning barrels. */
  minigun() {
    for (const [y, c] of [[62, PINK], [74, YELLOW], [86, BLUE]] as [number, number][]) part(R(130, y, 160, 11, 5), c, y, y + 11, 0.45, 3);
    part(R(272, 56, 16, 44, 5), WHITE, 56, 100, 0.3);
    part(R(196, 58, 12, 40, 4), WHITE, 58, 98, 0.3);
    tube(() => {
      ctx.moveTo(40, 82);
      ctx.lineTo(22, 82);
      ctx.lineTo(22, 96);
    }, 5, DARK);
    part(C(22, 100, 6), YELLOW, 94, 106, 0.3, 3);
    part(R(36, 56, 100, 54, 16), RED, 56, 110, 0.4);
    part(R(74, 86, 24, 8, 3), DARK, 86, 94, 0.2, 2.5);
    const globe = C(86, 34, 30);
    part(globe, 0xe8f8ff, 4, 64, 0.2);
    clipped(globe, () => {
      const cols = ["#ff5a8a", "#5ac8ff", "#ffd23f", "#7ad651", "#b46aff", "#ff9a3a"];
      let k = 0;
      for (let y = 20; y < 66; y += 11) for (let x = 60; x < 114; x += 11) dots([[x + (y % 2) * 5, y, 5.5]], cols[k++ % cols.length]);
      paint(E(74, 20, 9, 5), "rgba(255,255,255,0.7)");
    });
    part(R(76, 0, 20, 8, 3), RED, 0, 8, 0.3, 3);
    part(P([[96, 104], [124, 104], [120, 138], [96, 136]], 8), DARK, 104, 138, 0.25);
  },

  /** S: a big tube that lobs water balloons. */
  launcher() {
    part(P([[6, 42], [72, 38], [76, 62], [22, 70], [6, 76]], 10), YELLOW, 38, 76, 0.35);
    part(R(120, 64, 60, 36, 12), 0xbff4ff, 64, 100, 0.5);
    paint(R(124, 80, 52, 16, 6), "rgba(58,200,255,0.85)");
    part(R(70, 24, 180, 44, 20), BLUE, 24, 68, 0.4);
    paint(R(120, 24, 12, 44, 2), "rgba(255,255,255,0.6)");
    paint(R(178, 24, 12, 44, 2), "rgba(255,255,255,0.6)");
    part(E(250, 46, 20, 24), RED, 22, 70, 0.45);
    part(P([[226, 44], [234, 38], [234, 54]], 2), RED, 38, 54, 0.2, 2.5);
    guard(98, 70, 9, YELLOW);
    part(P([[86, 62], [110, 62], [104, 104], [82, 102]], 10), YELLOW, 62, 104, 0.3);
  },

  /** SSS: a golden gatling with a dragon head that breathes fire. */
  dragon() {
    for (const [y, w] of [[50, 150], [63, 156], [76, 150]] as [number, number][]) part(R(134, y, w, 11, 4), GOLD, y, y + 11, 0.45);
    part(R(206, 46, 14, 44, 3), DRAGON, 46, 90, 0.25);
    const head = P([[266, 40], [300, 44], [318, 60], [318, 74], [298, 92], [266, 94], [256, 66]], 8);
    part(head, DRAGON, 40, 94);
    part(P([[270, 42], [262, 22], [284, 40]], 3), GOLD, 22, 42, 0.3);
    part(P([[286, 44], [290, 24], [300, 46]], 3), GOLD, 24, 46, 0.3);
    paint(E(292, 56, 6, 4), "#ffe14a");
    paint(E(293, 56, 1.8, 3.6), "#14101a");
    for (const x of [296, 304, 312]) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(x, 72);
      ctx.lineTo(x + 3, 80);
      ctx.lineTo(x + 6, 72);
      ctx.fill();
    }
    tube(() => {
      ctx.moveTo(72, 42);
      ctx.lineTo(82, 20);
      ctx.lineTo(120, 20);
      ctx.lineTo(128, 42);
    }, 7, GOLD);
    const body = R(36, 40, 102, 64, 14);
    part(body, DRAGON, 40, 104);
    clipped(body, () => {
      ctx.fillStyle = "#ffb02e";
      ctx.beginPath();
      ctx.moveTo(36, 104);
      for (let i = 0; i <= 6; i++) ctx.lineTo(40 + i * 16, i % 2 ? 70 : 86);
      ctx.lineTo(138, 104);
      ctx.fill();
      ctx.fillStyle = "#ffe14a";
      ctx.beginPath();
      ctx.moveTo(36, 104);
      for (let i = 0; i <= 6; i++) ctx.lineTo(44 + i * 16, i % 2 ? 84 : 94);
      ctx.lineTo(138, 104);
      ctx.fill();
    });
    part(C(110, 66, 14), GOLD, 52, 80, 0.35);
    part(P([[96, 98], [124, 98], [120, 144], [96, 142]], 8), DARK, 98, 144, 0.2);
  },

  /** SSS: a cloud-white blaster with a rainbow and a star that fires stars. */
  plasma() {
    glow(272, 48, 46, "rgba(255,240,150,0.6)");
    const stock = P([[6, 36], [62, 32], [62, 62], [18, 66], [6, 60]], 12);
    part(stock, WHITE, 32, 66, 0.4);
    const body = P([[60, 30], [210, 22], [240, 34], [240, 62], [150, 68], [60, 64]], 16);
    part(body, WHITE, 22, 68, 0.5);
    clipped(body, () => {
      ["#ff5a5a", "#ffb347", "#ffe066", "#7ad651", "#5ac8ff", "#b46aff"].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(60, 40 + i * 4, 200, 4);
      });
    });
    for (const [x, y] of [[90, 30], [180, 26]]) part(() => (C(x, y, 8)(), C(x + 10, y - 3, 9)(), C(x + 20, y, 7)()), WHITE, y - 12, y + 8, 0.2, 2.5);
    star(270, 48, 28, GOLD);
    star(270, 49, 12, WHITE);
    part(P([[104, 62], [128, 62], [122, 106], [100, 104]], 10), PURPLE, 62, 106, 0.3);
  },
};

// ───────────────────────── ammo ─────────────────────────

const AMMO: Record<string, [number, number, () => void]> = {
  water: [36, 24, () => part(P([[33, 12], [16, 3], [4, 12], [16, 21]], 9), 0x6ad0ff, 3, 21, 0.5, 2)],
  cork: [34, 24, () => {
    part(R(4, 4, 26, 16, 5), 0xd8a060, 4, 20, 0.35, 2);
    dots([[12, 10, 1.6], [22, 15, 1.6]], "rgba(110,70,30,0.6)");
  }],
  dart: [46, 20, () => {
    part(R(3, 5, 30, 10, 4), BLUE, 5, 15, 0.4, 2);
    part(R(30, 3, 13, 14, 7), ORANGE, 3, 17, 0.4, 2);
  }],
  bubble: [38, 38, () => {
    const g = ctx.createRadialGradient(15, 14, 2, 19, 19, 17);
    g.addColorStop(0, "rgba(255,255,255,0.15)");
    g.addColorStop(0.75, "rgba(200,240,255,0.35)");
    g.addColorStop(1, "rgba(255,170,240,0.75)");
    ctx.beginPath();
    C(19, 19, 16)();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.stroke();
    paint(E(13, 12, 5, 3), "rgba(255,255,255,0.9)");
  }],
  confetti: [22, 16, () => part(R(3, 3, 16, 10, 2), WHITE, 3, 13, 0.3, 1.5)],
  candy: [46, 26, () => {
    part(P([[2, 4], [12, 13], [2, 22]], 2), PINK, 4, 22, 0.3, 2);
    part(P([[44, 4], [34, 13], [44, 22]], 2), PINK, 4, 22, 0.3, 2);
    part(E(23, 13, 12, 9), WHITE, 4, 22, 0.4, 2);
    clipped(E(23, 13, 12, 9), () => stripes(11, 35, 4, 22, 10, ["rgba(240,64,80,0.9)", "rgba(255,255,255,0)"]), 2);
  }],
  paint: [26, 26, () => part(C(13, 13, 10), WHITE, 3, 23, 0.5, 2)],
  snow: [30, 30, () => {
    part(C(15, 15, 12), WHITE, 3, 27, 0.5, 2);
    dots([[11, 18, 2], [19, 12, 1.5]], "rgba(122,200,240,0.6)");
  }],
  pea: [32, 32, () => part(C(16, 16, 13), 0x8ae85a, 3, 29, 0.5, 2.5)],
  firework: [46, 20, () => {
    star(6, 10, 6, YELLOW);
    part(R(10, 4, 24, 12, 3), WHITE, 4, 16, 0.4, 2);
    part(P([[34, 4], [44, 10], [34, 16]], 2), WHITE, 4, 16, 0.4, 2);
  }],
  gum: [26, 26, () => {
    part(C(13, 13, 10), WHITE, 3, 23, 0.3, 2);
    paint(E(9, 9, 4, 2.5), "rgba(255,255,255,0.95)");
  }],
  balloon: [40, 34, () => {
    part(E(18, 17, 15, 13), WHITE, 4, 30, 0.4, 2.5);
    part(P([[33, 17], [39, 12], [39, 22]], 2), WHITE, 12, 22, 0.3, 2);
    paint(E(12, 11, 5, 3), "rgba(255,255,255,0.9)");
  }],
  fire: [48, 32, () => {
    glow(30, 16, 16, "rgba(255,180,60,0.9)");
    ctx.beginPath();
    ctx.moveTo(44, 16);
    ctx.quadraticCurveTo(36, 2, 22, 6);
    ctx.quadraticCurveTo(10, 4, 2, 16);
    ctx.quadraticCurveTo(10, 28, 22, 26);
    ctx.quadraticCurveTo(36, 30, 44, 16);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 44, 0);
    g.addColorStop(0, "rgba(255,90,40,0)");
    g.addColorStop(0.5, "#ff7a3a");
    g.addColorStop(1, "#ffe066");
    ctx.fillStyle = g;
    ctx.fill();
    paint(C(34, 16, 6), "#fff6c8");
  }],
  star: [38, 38, () => {
    starPath(ctx, 19, 20, 16);
    const g = ctx.createLinearGradient(3, 4, 35, 36);
    ["#ff5a5a", "#ffb347", "#ffe066", "#7ad651", "#5ac8ff", "#b46aff"].forEach((c, i) => g.addColorStop(i / 5, c));
    ctx.fillStyle = g;
    ctx.lineWidth = 4;
    ctx.strokeStyle = OL;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.fill();
    paint(C(15, 15, 3), "rgba(255,255,255,0.9)");
  }],
};

/** Draw one gun (pointing right) into a context. */
export function drawGun(c: Ctx, gun: GunDef): void {
  ctx = c;
  ART[gun.id]?.();
}

/** Make every gun texture and its ammo. */
export function makeGunTextures(scene: Phaser.Scene): void {
  for (const g of GUNS) canvasTexture(scene, gunKey(g.id), g.w, g.h, (c) => drawGun(c, g));
  for (const [id, [w, h, draw]] of Object.entries(AMMO)) {
    canvasTexture(scene, `ammo_${id}`, w, h, (c) => {
      ctx = c;
      draw();
    });
  }
}
