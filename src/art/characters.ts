import Phaser from "phaser";
import {
  Ctx, boltPath, canvasTexture, circle, darken, ellipse, fill, fillOutline, lighten, mix, outline, radial, rgba,
  starPath, twinkle,
} from "./draw";
import { Toon, toon } from "./toon";

const EYE = "#24161e";

// ───────────────────────── hero ─────────────────────────

export const HERO_W = 120;
export const HERO_H = 160;
/** Where the blaster is held, relative to the hero's feet (origin 0.5, 0.95). */
export const HERO_HAND = { x: 36, y: -50 };

const BOX = 0xff9a3c;
const RED = 0xe8453f;

/**
 * The hero: a small, simple orange box (2:3) with a face, a red headband and tiny feet.
 * step 0 = standing, 1 and 2 = walking.
 */
function drawHero(ctx: Ctx, step: number): void {
  const t = toon(ctx, "#2a1c1c", 4.5);
  const { E, C, poly, rect, part, paint, gloss } = t;
  const b = step ? -2 : 0;
  paint("rgba(42,26,30,0.22)", () => E(60, 152, 36, 6));
  // feet
  const lift = [0, -5, 5][step];
  for (const [x, dy] of [[46, lift], [74, -lift]] as [number, number][]) {
    part(() => rect(x, 144 + Math.min(0, dy), 22, 14, 6), 0x4a3a44);
  }
  // headband tails behind
  part(() => poly([[30, 52 + b], [8, 44 + b], [14, 56 + b], [6, 66 + b], [30, 62 + b]], 3), RED, undefined, 3.5);
  // the box
  part(() => rect(60, 84 + b, 76, 112, 14), BOX, () => {
    paint(rgba(lighten(BOX, 0.25)), () => rect(60, 34 + b, 76, 14, 6));
  });
  gloss(36, 40 + b, 7, 4);
  // headband
  part(() => rect(60, 56 + b, 80, 13, 4), RED, () => paint("rgba(255,255,255,0.7)", () => {
    C(44, 56 + b, 2);
    C(60, 56 + b, 2);
    C(76, 56 + b, 2);
  }), 3.5);
  // face
  for (const x of [48, 72]) {
    paint(EYE, () => E(x, 82 + b, 5.5, 7));
    paint("#ffffff", () => C(x - 1.8, 79 + b, 2.2));
  }
  paint("rgba(255,90,110,0.45)", () => {
    E(38, 95 + b, 6, 3.5);
    E(82, 95 + b, 6, 3.5);
  });
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.strokeStyle = EYE;
  ctx.beginPath();
  ctx.moveTo(54, 96 + b);
  ctx.quadraticCurveTo(60, 101 + b, 66, 96 + b);
  ctx.stroke();
  // little arm reaching for the blaster
  part(() => rect(96, 104 + b, 14, 22, 6), darken(BOX, 0.12), undefined, 3.5);
}

/** The blaster: a separate sprite so it can aim. Points right; the grip is at x=20. */
function drawGun(ctx: Ctx): void {
  const t = toon(ctx, "#1e1a22", 3.5);
  const { C, poly, rect, part, paint } = t;
  part(() => poly([[14, 22], [28, 22], [24, 36], [14, 36]], 3), 0x4a3a30);
  part(() => poly([[6, 10], [62, 8], [68, 14], [68, 24], [8, 26]], 5), 0x5a6488, () => paint("#ff9a3c", () => ctx.rect(14, 12, 36, 4)));
  part(() => rect(76, 17, 14, 9, 3), 0x3a3a44, undefined, 3);
  ctx.save();
  ctx.shadowColor = "#5ff0ff";
  ctx.shadowBlur = 8;
  circle(ctx, 84, 17, 4);
  fillOutline(ctx, "#bffbff", 2.5);
  ctx.restore();
  part(() => C(20, 28, 8), 0x3a3a44);
}

// ───────────────────────── monsters ─────────────────────────

const olFor = (c: number) => rgba(mix(darken(c, 0.65), 0x1a0e18, 0.5));

/** Angry eyes with brows and a toothy grin. */
function angryFace(t: Toon, cx: number, cy: number, gap: number, s = 1, glow?: string): void {
  const { ctx, E, C, paint } = t;
  for (const d of [-1, 1]) {
    if (glow) {
      paint(radial(ctx, cx + d * gap, cy, 14 * s, [[0, "#ffffff"], [0.35, glow], [1, "rgba(0,0,0,0)"]]), () => C(cx + d * gap, cy, 14 * s));
    } else {
      t.part(() => E(cx + d * gap, cy, 8 * s, 9 * s), 0xffffff, undefined, 3 * s);
      paint(EYE, () => C(cx + d * gap - d * 1.5 * s, cy + 1.5 * s, 4.5 * s));
      paint("#ffffff", () => C(cx + d * gap - d * 2.5 * s, cy - 0.5 * s, 1.5 * s));
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
  paint("#ffffff", () => {
    t.poly([[cx - 9 * s, cy + 13.5 * s], [cx - 4 * s, cy + 13.5 * s], [cx - 6.5 * s, cy + 18 * s]], 1);
    t.poly([[cx + 4 * s, cy + 13.5 * s], [cx + 9 * s, cy + 13.5 * s], [cx + 6.5 * s, cy + 18 * s]], 1);
  });
}

function slime(color: number, extra = ""): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, olFor(color), 5);
    t.paint("rgba(30,15,25,0.22)", () => t.E(70, 124, 50, 7));
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
  };
}

function mushroom(cap: number, stem: number, glow = false): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, olFor(cap), 5);
    t.paint("rgba(30,15,25,0.22)", () => t.E(65, 142, 40, 6));
    t.part(() => {
      t.E(46, 140, 12, 6);
      t.E(84, 140, 12, 6);
    }, darken(stem, 0.2));
    t.part(() => t.rect(65, 106, 62, 64, 22), stem);
    angryFace(t, 65, 102, 14, 0.95);
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
  };
}

function bat(color: number, beak = false): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, olFor(color), 5);
    const wing = (s: number) => {
      const m = (x: number) => (s < 0 ? 170 - x : x);
      t.poly([[m(62), 48], [m(10), 20], [m(14), 54], [m(26), 50], [m(30), 70], [m(44), 62], [m(54), 76], [m(66), 66]], 4);
    };
    t.part(() => {
      wing(1);
      wing(-1);
    }, darken(color, 0.15));
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

function cactus(ctx: Ctx): void {
  const c = 0x5fb84a;
  const t = toon(ctx, olFor(c), 5);
  t.paint("rgba(30,15,25,0.22)", () => t.E(65, 152, 40, 6));
  t.part(() => {
    t.rect(65, 98, 56, 104, 28);
    t.rect(26, 84, 22, 40, 11);
    t.rect(36, 102, 30, 18, 9);
    t.rect(104, 74, 22, 38, 11);
    t.rect(94, 90, 30, 18, 9);
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
  t.part(() => {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      t.E(65 + Math.cos(a) * 7, 44 + Math.sin(a) * 7, 6, 5, a);
    }
  }, 0xff7aa8, undefined, 3);
  t.paint("#ffe066", () => t.C(65, 44, 4));
  angryFace(t, 65, 92, 13, 0.9);
}

function golem(ctx: Ctx): void {
  const c = 0xa8adb8;
  const t = toon(ctx, "#2a2a36", 6);
  t.paint("rgba(30,15,25,0.25)", () => t.E(125, 238, 96, 12));
  t.part(() => {
    t.rect(84, 214, 44, 40, 14);
    t.rect(166, 214, 44, 40, 14);
  }, darken(c, 0.15));
  t.part(() => {
    t.C(34, 150, 30);
    t.C(216, 150, 30);
  }, darken(c, 0.08));
  t.part(() => t.rect(125, 130, 170, 150, 44), c, () => {
    t.paint(rgba(0x6fbf4a), () => {
      t.E(80, 66, 30, 12, -0.2);
      t.E(176, 70, 22, 9, 0.2);
    });
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(darken(c, 0.3));
    ctx.beginPath();
    ctx.moveTo(70, 150);
    ctx.lineTo(96, 170);
    ctx.lineTo(90, 196);
    ctx.moveTo(180, 160);
    ctx.lineTo(160, 182);
    ctx.stroke();
  });
  t.gloss(78, 80, 20, 8);
  angryFace(t, 125, 118, 32, 1.6, "rgba(255,210,60,0.95)");
}

function pumpkinKing(ctx: Ctx): void {
  const c = 0xff8a2a;
  const t = toon(ctx, olFor(c), 6);
  t.paint("rgba(30,15,25,0.25)", () => t.E(125, 238, 96, 12));
  t.tube(() => {
    ctx.moveTo(40, 150);
    ctx.quadraticCurveTo(10, 120, 26, 92);
    ctx.moveTo(210, 150);
    ctx.quadraticCurveTo(240, 120, 224, 92);
  }, 10, 0x4f8a2a);
  t.part(() => {
    t.E(125, 150, 100, 84);
  }, c, () => {
    ctx.lineWidth = 5;
    ctx.strokeStyle = rgba(darken(c, 0.2));
    for (const x of [70, 105, 145, 180]) {
      ctx.beginPath();
      ctx.moveTo(x, 72);
      ctx.quadraticCurveTo(x + (x < 125 ? -26 : 26), 150, x, 230);
      ctx.stroke();
    }
  });
  t.gloss(80, 100, 22, 10);
  t.paint(radial(ctx, 125, 150, 70, [[0, "rgba(255,240,120,0.9)"], [1, "rgba(255,160,40,0.2)"]]), () => {
    t.poly([[78, 116], [110, 126], [92, 140]], 3);
    t.poly([[172, 116], [140, 126], [158, 140]], 3);
    t.poly([[74, 168], [92, 160], [108, 176], [125, 160], [142, 176], [158, 160], [176, 168], [160, 196], [90, 196]], 4);
  });
  t.tube(() => {
    ctx.moveTo(125, 70);
    ctx.lineTo(128, 44);
  }, 10, 0x4f8a2a);
  t.part(() => t.poly([[84, 66], [84, 34], [104, 48], [125, 24], [146, 48], [166, 34], [166, 66]], 4), 0xffcf3a, () => {
    t.paint("#ff4a6a", () => t.C(125, 50, 6));
  });
}

function treant(ctx: Ctx): void {
  const bark = 0x8a5a3a;
  const t = toon(ctx, "#2a1a14", 6);
  t.paint("rgba(30,15,25,0.25)", () => t.E(125, 248, 96, 12));
  t.tube(() => {
    ctx.moveTo(80, 230);
    ctx.lineTo(60, 248);
    ctx.moveTo(170, 230);
    ctx.lineTo(190, 248);
  }, 16, darken(bark, 0.15));
  t.tube(() => {
    ctx.moveTo(70, 150);
    ctx.quadraticCurveTo(30, 140, 16, 104);
    ctx.moveTo(180, 150);
    ctx.quadraticCurveTo(220, 140, 234, 104);
  }, 16, bark);
  t.part(() => t.rect(125, 170, 110, 130, 36), bark, () => {
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(darken(bark, 0.3));
    for (const x of [92, 120, 152]) {
      ctx.beginPath();
      ctx.moveTo(x, 116);
      ctx.quadraticCurveTo(x + 6, 170, x - 4, 230);
      ctx.stroke();
    }
  });
  const leaf = 0x4fae3a;
  t.part(() => {
    t.C(80, 80, 46);
    t.C(125, 56, 54);
    t.C(172, 82, 46);
    t.C(125, 104, 50);
    t.C(20, 98, 18);
    t.C(232, 98, 18);
  }, leaf, () => {
    t.paint(rgba(lighten(leaf, 0.25)), () => {
      t.C(100, 40, 16);
      t.C(150, 60, 12);
      t.C(64, 74, 10);
    });
  });
  angryFace(t, 125, 166, 26, 1.4, "rgba(150,255,120,0.95)");
}

function scorpion(ctx: Ctx): void {
  const c = 0xd9a24a;
  const t = toon(ctx, olFor(c), 6);
  t.paint("rgba(30,15,25,0.25)", () => t.E(130, 214, 110, 12));
  t.tube(() => {
    for (const [x1, x2] of [[90, 70], [110, 100], [150, 160], [170, 190]]) {
      ctx.moveTo(x1, 190);
      ctx.lineTo(x2, 212);
    }
  }, 7, darken(c, 0.2));
  // tail arcing over the body
  t.part(() => {
    for (const [x, y, r] of [[196, 160, 22], [216, 124, 19], [214, 86, 17], [192, 58, 15]] as [number, number, number][]) t.C(x, y, r);
  }, c);
  t.part(() => t.poly([[176, 52], [150, 40], [172, 66]], 4), 0x7a2a3a);
  // claws
  for (const s of [-1, 1]) {
    const x = s < 0 ? 46 : 124;
    t.part(() => {
      t.E(x, 132, 26, 20);
      t.poly([[x - 26, 126], [x - 40, 104], [x - 14, 116]], 4);
      t.poly([[x - 10, 114], [x - 6, 94], [x + 8, 114]], 4);
    }, darken(c, 0.08));
  }
  t.part(() => t.E(130, 168, 72, 40), c, () => {
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(darken(c, 0.25));
    for (const x of [110, 140, 168]) {
      ctx.beginPath();
      ctx.arc(x, 168, 34, -1.1, 1.1);
      ctx.stroke();
    }
  });
  t.gloss(100, 146, 18, 7, -0.2);
  angryFace(t, 104, 162, 18, 1.2);
}

function yeti(ctx: Ctx): void {
  const fur = 0xf2f6ff;
  const t = toon(ctx, "#2a3a5a", 6);
  t.paint("rgba(30,15,25,0.25)", () => t.E(125, 244, 96, 12));
  t.part(() => {
    t.rect(92, 226, 40, 34, 14);
    t.rect(158, 226, 40, 34, 14);
  }, darken(fur, 0.08));
  t.part(() => {
    t.E(36, 160, 24, 46, 0.2);
    t.E(214, 160, 24, 46, -0.2);
  }, darken(fur, 0.05));
  t.part(() => {
    t.poly([[70, 64], [56, 20], [92, 52]], 6);
    t.poly([[158, 52], [194, 20], [180, 64]], 6);
  }, 0xc9d8f0);
  t.part(() => {
    t.E(125, 150, 92, 92);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.15 + (i / 8) * 0.7);
      t.C(125 + Math.cos(a) * 88, 150 + Math.sin(a) * 88, 12);
    }
  }, fur);
  t.part(() => t.E(125, 132, 58, 48), 0x7aa8e8, () => t.paint("rgba(255,255,255,0.25)", () => t.E(110, 110, 30, 12, -0.3)));
  angryFace(t, 125, 128, 24, 1.4);
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
  e_golem: [250, 250, golem],
  e_pumpking: [250, 250, pumpkinKing],
  e_treant: [250, 256, treant],
  e_scorpion: [260, 224, scorpion],
  e_yeti: [250, 262, yeti],
};

export function makeCharacterTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "hero", HERO_W, HERO_H, (ctx) => drawHero(ctx, 0));
  canvasTexture(scene, "hero_w1", HERO_W, HERO_H, (ctx) => drawHero(ctx, 1));
  canvasTexture(scene, "hero_w2", HERO_W, HERO_H, (ctx) => drawHero(ctx, 2));
  canvasTexture(scene, "gun", 96, 40, drawGun);
  for (const [key, [w, h, draw]] of Object.entries(MONSTER_ART)) canvasTexture(scene, key, w, h, draw);


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
