import Phaser from "phaser";
import { GUNS, GunDef, gunKey } from "../data/guns";
import { Ctx, canvasTexture, darken, lighten, rgba } from "./draw";

/**
 * Cartoon guns: every part has a thick dark outline, a top-lit metal / wood / plastic
 * gradient and a soft shine stripe, so they read well both tiny in the hero's hand and
 * big on the airdrop card. All guns point right; data/guns.ts says where the grip and
 * muzzle are.
 */
const OL = "#1b1720";
const LW = 4;

const METAL = 0x4c5361;
const DARK = 0x2e323c;
const STEEL = 0xa4adbc;
const WOOD = 0xb8662c;
const WOOD2 = 0x8c4a20;
const TAN = 0xc9a46c;
const GREEN = 0x5f7744;
const OLIVE = 0x434d38;
const GOLD = 0xf2c23a;
const RED = 0xc8262e;
const WHITE = 0xe9eef6;
const CYAN = 0x45f0ff;

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

/** An outlined part with a top-lit gradient and a shine stripe. */
function part(path: Path, color: number, y0: number, y1: number, shine = 0.3): void {
  ctx.beginPath();
  path();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = LW * 2;
  ctx.strokeStyle = OL;
  ctx.stroke();
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(lighten(color, 0.28)));
  g.addColorStop(0.45, rgba(color));
  g.addColorStop(1, rgba(darken(color, 0.32)));
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

/** A line detail (grooves, seams) drawn on top of a part. */
function line(pts: [number, number][], w: number, color: string): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Outlined thick stroke (trigger guards, handles, wire stocks). */
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

const screw = (x: number, y: number, r = 3) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(20,16,24,0.55)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fill();
};

const grooves = (x0: number, x1: number, y0: number, y1: number, step: number, color = "rgba(20,16,24,0.35)") => {
  for (let x = x0; x <= x1; x += step) line([[x, y0], [x, y1]], 2.5, color);
};

const guard = (cx: number, cy: number, r: number) => tube(() => ctx.arc(cx, cy, r, 0.1, Math.PI - 0.1), 4, DARK);

const trigger = (x: number, y: number) => tube(() => {
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 2, y + 8, x - 3, y + 12);
}, 3, METAL);

/** Wood grain lines inside the last part. */
function grain(path: Path, x0: number, x1: number, y0: number, y1: number): void {
  ctx.save();
  ctx.beginPath();
  path();
  ctx.clip();
  for (let i = 0; i < 4; i++) {
    const y = y0 + ((y1 - y0) * (i + 1)) / 5;
    line([[x0, y], [x0 + (x1 - x0) * 0.4, y + 3], [x1, y - 2]], 2, "rgba(90,40,10,0.35)");
  }
  ctx.restore();
}

/** Diamond knurling for grips. */
function knurl(path: Path, x0: number, x1: number, y0: number, y1: number): void {
  ctx.save();
  ctx.beginPath();
  path();
  ctx.clip();
  for (let k = -60; k < 60; k += 8) {
    line([[x0 + k, y0], [x0 + k + (y1 - y0) * 0.5, y1]], 1.5, "rgba(255,255,255,0.16)");
    line([[x1 + k, y0], [x1 + k - (y1 - y0) * 0.5, y1]], 1.5, "rgba(0,0,0,0.25)");
  }
  ctx.restore();
}

function glow(x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ───────────────────────── the guns ─────────────────────────

const ART: Record<string, () => void> = {
  glock() {
    part(R(126, 27, 12, 14, 3), DARK, 27, 41, 0);
    const slide = R(16, 20, 116, 28, 6);
    part(slide, METAL, 20, 48);
    grooves(26, 44, 25, 43, 5);
    part(R(82, 25, 24, 9, 2), DARK, 25, 34, 0);
    part(R(20, 13, 9, 8, 2), DARK, 13, 21, 0);
    part(R(120, 13, 7, 8, 2), DARK, 13, 21, 0);
    part(P([[30, 46], [124, 46], [124, 58], [74, 58], [70, 64], [34, 64]], 4), DARK, 46, 64, 0.15);
    guard(84, 60, 11);
    trigger(84, 56);
    const grip = P([[34, 56], [72, 56], [66, 94], [26, 94]], 8);
    part(grip, DARK, 56, 94, 0.15);
    knurl(grip, 30, 70, 62, 90);
  },

  revolver() {
    part(R(72, 18, 108, 8, 3), STEEL, 18, 26);
    part(R(70, 24, 112, 16, 5), STEEL, 24, 40);
    part(P([[168, 18], [176, 8], [180, 18]], 2), DARK, 8, 18, 0);
    part(P([[38, 22], [80, 22], [84, 52], [42, 58]], 6), STEEL, 22, 58);
    const cyl = R(52, 20, 42, 36, 10);
    part(cyl, darken(STEEL, 0.12), 20, 56);
    for (const y of [27, 38, 49]) line([[56, y], [90, y]], 3, "rgba(30,26,40,0.45)");
    part(P([[28, 18], [44, 13], [48, 26], [36, 28]], 3), DARK, 13, 28, 0);
    guard(76, 60, 10);
    trigger(76, 56);
    const grip = P([[38, 50], [64, 50], [60, 72], [52, 96], [24, 96], [30, 70]], 10);
    part(grip, WOOD, 50, 96);
    grain(grip, 24, 62, 54, 94);
    screw(46, 72, 3.5);
  },

  uzi() {
    tube(() => {
      ctx.moveTo(34, 38);
      ctx.lineTo(8, 42);
      ctx.lineTo(10, 64);
      ctx.lineTo(30, 62);
    }, 5, DARK);
    part(R(140, 33, 24, 14, 3), DARK, 33, 47, 0);
    part(R(30, 26, 116, 34, 6), METAL, 26, 60);
    grooves(118, 138, 32, 52, 6);
    part(R(108, 17, 14, 11, 3), DARK, 17, 28, 0);
    part(R(36, 15, 10, 12, 2), DARK, 15, 27, 0);
    part(R(128, 15, 8, 12, 2), DARK, 15, 27, 0);
    guard(98, 64, 10);
    trigger(98, 60);
    const grip = P([[60, 56], [88, 56], [86, 112], [58, 112]], 6);
    part(grip, DARK, 56, 112, 0.15);
    knurl(grip, 58, 88, 62, 104);
    part(R(56, 108, 34, 10, 3), METAL, 108, 118, 0);
  },

  mp5() {
    const stock = P([[8, 30], [62, 28], [62, 52], [30, 52], [12, 60]], 6);
    part(stock, DARK, 28, 60, 0.15);
    part(R(4, 28, 12, 34, 3), METAL, 28, 62, 0);
    part(R(208, 35, 20, 10, 3), DARK, 35, 45, 0);
    part(R(168, 28, 46, 22, 10), METAL, 28, 50);
    grooves(176, 206, 32, 46, 6);
    part(P([[60, 24], [172, 24], [176, 52], [60, 56]], 6), DARK, 24, 56);
    part(R(196, 16, 10, 14, 3), DARK, 16, 30, 0);
    part(C(80, 18, 7), DARK, 11, 25, 0);
    part(P([[128, 52], [146, 52], [158, 96], [142, 102]], 5), DARK, 52, 102, 0.15);
    guard(112, 58, 9);
    trigger(112, 54);
    const grip = P([[92, 52], [118, 52], [112, 94], [90, 94]], 8);
    part(grip, DARK, 52, 94, 0.15);
    knurl(grip, 90, 116, 58, 90);
    screw(150, 40);
  },

  shotgun() {
    const stock = P([[6, 36], [84, 24], [84, 50], [66, 52], [16, 68], [4, 64]], 8);
    part(stock, WOOD, 24, 68);
    grain(stock, 6, 84, 28, 64);
    part(R(2, 34, 10, 32, 3), DARK, 34, 66, 0);
    part(R(112, 38, 138, 11, 4), DARK, 38, 49, 0.15);
    part(R(112, 24, 154, 13, 4), METAL, 24, 37);
    part(C(258, 21, 3.5), STEEL, 17, 25, 0);
    const pump = R(170, 33, 62, 22, 8);
    part(pump, WOOD, 33, 55);
    grooves(180, 222, 37, 51, 7, "rgba(90,40,10,0.45)");
    part(P([[80, 20], [126, 20], [126, 50], [80, 52]], 5), DARK, 20, 52);
    screw(92, 32);
    screw(114, 32);
    guard(100, 54, 10);
    trigger(100, 50);
  },

  deagle() {
    part(R(160, 28, 12, 14, 3), DARK, 28, 42, 0);
    const slide = P([[18, 22], [168, 20], [168, 48], [18, 50]], 6);
    part(slide, STEEL, 20, 50, 0.4);
    line([[60, 30], [160, 29]], 3, "rgba(40,40,60,0.35)");
    grooves(26, 46, 26, 44, 5);
    part(R(14, 22, 10, 14, 3), DARK, 22, 36, 0);
    part(R(156, 13, 8, 9, 2), DARK, 13, 22, 0);
    part(P([[34, 48], [150, 48], [150, 60], [80, 60], [76, 68], [38, 68]], 4), darken(STEEL, 0.25), 48, 68, 0.2);
    guard(92, 64, 12);
    trigger(92, 60);
    const grip = P([[38, 60], [78, 60], [70, 106], [28, 106]], 10);
    part(grip, DARK, 60, 106, 0.12);
    knurl(grip, 30, 76, 66, 100);
    screw(54, 84, 4);
  },

  ak47() {
    const stock = P([[6, 40], [98, 32], [100, 56], [70, 58], [16, 76], [4, 72]], 8);
    part(stock, WOOD, 32, 76);
    grain(stock, 6, 98, 36, 72);
    part(R(2, 38, 10, 38, 3), DARK, 38, 76, 0);
    part(R(238, 36, 42, 8, 2), DARK, 36, 44, 0);
    part(R(274, 32, 14, 15, 2), DARK, 32, 47, 0);
    part(P([[258, 36], [262, 20], [268, 20], [270, 36]], 2), DARK, 20, 36, 0);
    part(R(194, 24, 66, 8, 3), METAL, 24, 32);
    const hg = R(194, 32, 48, 22, 6);
    part(hg, WOOD, 32, 54);
    grain(hg, 194, 242, 34, 52);
    part(P([[94, 30], [198, 30], [198, 54], [94, 58]], 5), METAL, 30, 58);
    line([[104, 36], [186, 36]], 3, "rgba(255,255,255,0.25)");
    part(R(174, 22, 12, 9, 2), DARK, 22, 31, 0);
    screw(110, 46);
    screw(184, 46);
    // the curved banana magazine
    const mag: Path = () => {
      ctx.moveTo(146, 54);
      ctx.lineTo(172, 54);
      ctx.quadraticCurveTo(178, 84, 198, 106);
      ctx.lineTo(178, 116);
      ctx.quadraticCurveTo(158, 92, 146, 54);
      ctx.closePath();
    };
    part(mag, DARK, 54, 116, 0.15);
    line([[160, 66], [168, 64]], 2, "rgba(255,255,255,0.2)");
    line([[166, 84], [175, 80]], 2, "rgba(255,255,255,0.2)");
    guard(128, 62, 10);
    trigger(128, 58);
    const grip = P([[106, 54], [130, 54], [124, 100], [102, 98]], 8);
    part(grip, WOOD2, 54, 100);
    grain(grip, 102, 130, 58, 96);
  },

  m4a1() {
    part(R(58, 40, 44, 11, 4), DARK, 40, 51, 0);
    const stock = P([[6, 38], [72, 36], [72, 60], [22, 62], [6, 68]], 5);
    part(stock, TAN, 36, 68);
    part(R(2, 36, 10, 34, 3), DARK, 36, 70, 0);
    part(R(246, 40, 32, 8, 2), DARK, 40, 48, 0);
    part(R(274, 37, 12, 14, 2), DARK, 37, 51, 0);
    part(P([[238, 32], [250, 14], [258, 32]], 3), DARK, 14, 32, 0);
    const hg = R(184, 30, 66, 24, 6);
    part(hg, TAN, 30, 54);
    for (let x = 192; x < 244; x += 10) part(R(x, 38, 6, 8, 1), darken(TAN, 0.35), 38, 46, 0);
    part(P([[96, 30], [188, 30], [188, 56], [96, 58]], 5), 0x34383f, 30, 58);
    part(R(100, 18, 82, 12, 3), DARK, 18, 30, 0.2);
    for (let x = 106; x < 178; x += 8) line([[x, 20], [x, 27]], 2, "rgba(255,255,255,0.22)");
    part(R(104, 8, 14, 12, 3), DARK, 8, 20, 0);
    screw(176, 44);
    part(P([[148, 56], [170, 56], [176, 104], [152, 106]], 5), DARK, 56, 106, 0.15);
    guard(132, 62, 10);
    trigger(132, 58);
    const grip = P([[108, 56], [132, 56], [128, 98], [106, 96]], 8);
    part(grip, DARK, 56, 98, 0.12);
    knurl(grip, 106, 130, 62, 94);
  },

  awp() {
    const stock = P([[6, 36], [112, 32], [116, 60], [84, 64], [62, 88], [14, 88], [6, 82]], 10);
    part(stock, GREEN, 32, 88);
    // thumbhole
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(70, 62, 16, 9, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(70, 62, 16, 9, -0.2, 0, Math.PI * 2);
    ctx.lineWidth = LW;
    ctx.strokeStyle = OL;
    ctx.stroke();
    part(R(2, 34, 10, 52, 3), DARK, 34, 86, 0);
    part(R(196, 40, 120, 10, 4), DARK, 40, 50, 0.2);
    part(R(310, 35, 18, 20, 3), DARK, 35, 55, 0);
    tube(() => {
      ctx.moveTo(214, 52);
      ctx.lineTo(244, 74);
      ctx.moveTo(220, 52);
      ctx.lineTo(258, 70);
    }, 3, METAL);
    part(R(108, 34, 92, 26, 6), GREEN, 34, 60);
    part(R(150, 58, 22, 24, 3), DARK, 58, 82, 0.15);
    tube(() => {
      ctx.moveTo(184, 56);
      ctx.lineTo(196, 68);
    }, 3, STEEL);
    part(C(198, 70, 5), STEEL, 65, 75, 0);
    part(R(138, 24, 8, 12, 2), DARK, 24, 36, 0);
    part(R(184, 24, 8, 12, 2), DARK, 24, 36, 0);
    part(R(118, 9, 96, 18, 9), DARK, 9, 27, 0.25);
    part(R(110, 7, 14, 22, 4), DARK, 7, 29, 0);
    part(R(206, 4, 18, 28, 5), DARK, 4, 32, 0);
    const lens = ctx.createLinearGradient(212, 6, 222, 30);
    lens.addColorStop(0, "#c8fff6");
    lens.addColorStop(1, "#2aa8c8");
    ctx.fillStyle = lens;
    ctx.beginPath();
    ctx.ellipse(219, 18, 4, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    guard(128, 64, 9);
    trigger(128, 60);
  },

  aa12() {
    const stock = P([[8, 30], [74, 28], [74, 62], [22, 64], [8, 72]], 8);
    part(stock, OLIVE, 28, 72);
    part(R(4, 28, 10, 44, 3), DARK, 28, 72, 0);
    part(R(218, 34, 36, 14, 4), DARK, 34, 48, 0);
    tube(() => {
      ctx.moveTo(110, 28);
      ctx.lineTo(116, 12);
      ctx.lineTo(186, 12);
      ctx.lineTo(192, 28);
    }, 6, DARK);
    part(P([[70, 26], [222, 26], [226, 58], [70, 62]], 8), OLIVE, 26, 62);
    grooves(180, 214, 32, 54, 7);
    screw(84, 40);
    screw(206, 40);
    const drum = C(152, 88, 30);
    part(drum, DARK, 58, 118, 0.2);
    part(C(152, 88, 17), METAL, 71, 105, 0.2);
    screw(152, 88, 5);
    guard(114, 64, 9);
    trigger(114, 60);
    const grip = P([[92, 58], [118, 58], [112, 104], [90, 102]], 8);
    part(grip, DARK, 58, 104, 0.12);
    knurl(grip, 90, 116, 64, 98);
  },

  minigun() {
    // ammo belt
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const x = 70 - t * 40;
      const y = 98 + t * 36;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.6 + t * 0.5);
      part(R(-4, -9, 8, 18, 3), GOLD, -9, 9, 0.35);
      ctx.restore();
    }
    for (const [y, w] of [[48, 160], [60, 166], [72, 160]] as [number, number][]) part(R(130, y, w, 10, 4), STEEL, y, y + 10, 0.4);
    part(R(272, 42, 16, 44, 4), DARK, 42, 86, 0.2);
    part(R(196, 44, 14, 40, 3), DARK, 44, 84, 0.2);
    tube(() => {
      ctx.moveTo(70, 40);
      ctx.lineTo(80, 20);
      ctx.lineTo(116, 20);
      ctx.lineTo(124, 40);
    }, 7, DARK);
    const body = R(36, 38, 98, 60, 14);
    part(body, METAL, 38, 98);
    grooves(52, 76, 50, 86, 7);
    part(C(108, 68, 14), DARK, 54, 82, 0.2);
    screw(108, 68, 5);
    const grip = P([[94, 92], [122, 92], [118, 136], [94, 134]], 8);
    part(grip, DARK, 92, 136, 0.12);
    knurl(grip, 94, 120, 98, 130);
  },

  launcher() {
    const stock = P([[6, 40], [72, 36], [76, 60], [22, 68], [6, 74]], 8);
    part(stock, DARK, 36, 74, 0.15);
    part(R(2, 38, 10, 38, 3), METAL, 38, 76, 0);
    part(R(184, 30, 80, 32, 10), OLIVE, 30, 62);
    ctx.fillStyle = "#14101a";
    ctx.beginPath();
    ctx.ellipse(262, 46, 4, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    grooves(196, 230, 36, 56, 9);
    part(R(68, 34, 82, 24, 6), DARK, 34, 58, 0.2);
    part(R(156, 18, 32, 12, 3), DARK, 18, 30, 0);
    const cyl = R(116, 36, 74, 56, 18);
    part(cyl, GREEN, 36, 92);
    for (const [x, y] of [[134, 54], [160, 52], [148, 76], [174, 74]]) {
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(20,16,24,0.5)";
      ctx.fill();
    }
    part(P([[210, 62], [228, 62], [226, 98], [208, 98]], 6), DARK, 62, 98, 0.12);
    guard(96, 62, 9);
    trigger(96, 58);
    const grip = P([[82, 56], [108, 56], [104, 102], [80, 100]], 8);
    part(grip, DARK, 56, 102, 0.12);
    knurl(grip, 80, 106, 62, 96);
  },

  dragon() {
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      ctx.save();
      ctx.translate(74 - t * 44, 110 + t * 36);
      ctx.rotate(0.6 + t * 0.5);
      part(R(-4, -10, 8, 20, 3), GOLD, -10, 10, 0.4);
      ctx.restore();
    }
    for (const [y, w] of [[50, 150], [63, 156], [76, 150]] as [number, number][]) part(R(134, y, w, 11, 4), GOLD, y, y + 11, 0.45);
    part(R(206, 46, 14, 44, 3), RED, 46, 90, 0.25);
    // dragon head at the muzzle
    const head = P([[266, 40], [300, 44], [318, 60], [318, 74], [298, 92], [266, 94], [256, 66]], 8);
    part(head, RED, 40, 94);
    part(P([[270, 42], [262, 22], [284, 40]], 3), GOLD, 22, 42, 0.3);
    part(P([[286, 44], [290, 24], [300, 46]], 3), GOLD, 24, 46, 0.3);
    ctx.fillStyle = "#ffe14a";
    ctx.beginPath();
    ctx.ellipse(292, 56, 6, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#14101a";
    ctx.beginPath();
    ctx.ellipse(293, 56, 1.8, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
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
    part(body, RED, 40, 104);
    // flame decal
    ctx.save();
    ctx.beginPath();
    body();
    ctx.clip();
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
    ctx.restore();
    part(C(110, 66, 14), GOLD, 52, 80, 0.35);
    screw(110, 66, 5);
    const grip = P([[96, 98], [124, 98], [120, 144], [96, 142]], 8);
    part(grip, DARK, 98, 144, 0.12);
    knurl(grip, 96, 122, 104, 138);
  },

  plasma() {
    glow(270, 50, 46, "rgba(70,240,255,0.55)");
    const stock = P([[6, 36], [64, 32], [64, 62], [18, 68], [6, 60]], 10);
    part(stock, WHITE, 32, 68, 0.4);
    line([[12, 50], [60, 46]], 4, rgba(CYAN));
    part(R(234, 36, 52, 22, 7), DARK, 36, 58, 0.2);
    for (let x = 242; x < 282; x += 8) line([[x, 38], [x, 56]], 3, rgba(CYAN));
    part(R(282, 36, 14, 30, 5), CYAN, 36, 66, 0.5);
    part(P([[150, 26], [178, 6], [204, 26]], 4), WHITE, 6, 26, 0.4);
    part(P([[60, 30], [204, 22], [240, 34], [240, 62], [150, 68], [60, 64]], 14), WHITE, 22, 68, 0.45);
    line([[70, 56], [230, 52]], 3, "rgba(60,80,110,0.35)");
    // the energy core
    const core = R(118, 34, 64, 20, 10);
    ctx.beginPath();
    core();
    ctx.lineWidth = LW * 2;
    ctx.strokeStyle = OL;
    ctx.stroke();
    const cg = ctx.createLinearGradient(118, 34, 118, 54);
    cg.addColorStop(0, "#d8ffff");
    cg.addColorStop(0.5, rgba(CYAN));
    cg.addColorStop(1, "#1a8aa8");
    ctx.fillStyle = cg;
    ctx.fill();
    glow(150, 44, 26, "rgba(200,255,255,0.7)");
    line([[124, 44], [134, 38], [142, 48], [152, 38], [162, 48], [174, 42]], 2.5, "#ffffff");
    const grip = P([[104, 62], [128, 62], [122, 106], [100, 104]], 8);
    part(grip, DARK, 62, 106, 0.12);
    knurl(grip, 100, 126, 68, 100);
    guard(124, 66, 8);
  },
};

/** Draw one gun (pointing right) into a context. */
export function drawGun(c: Ctx, gun: GunDef): void {
  ctx = c;
  ART[gun.id]?.();
}

/** Make every gun texture plus the bullets. */
export function makeGunTextures(scene: Phaser.Scene): void {
  for (const g of GUNS) canvasTexture(scene, gunKey(g.id), g.w, g.h, (c) => drawGun(c, g));
  canvasTexture(scene, "bullet", 46, 16, (c) => {
    const g = c.createLinearGradient(0, 0, 46, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.6, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "#ffffff");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(26, 8, 20, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.ellipse(38, 8, 7, 4, 0, 0, Math.PI * 2);
    c.fill();
  });
  canvasTexture(scene, "grenade", 34, 26, (c) => {
    ctx = c;
    part(R(4, 4, 26, 18, 8), GREEN, 4, 22, 0.35);
    part(R(24, 6, 6, 14, 2), GOLD, 6, 20, 0.3);
  });
}
