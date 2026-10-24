import Phaser from "phaser";
import { INK, Ctx, canvasTexture } from "./draw";
import { Toon, toon } from "./toon";

/**
 * Level-up skill icons (`sk_<id>`, 120 x 120): one big, chunky picture each, so a skill reads at
 * a glance on its card and in the small skill bar. (The Lucky Box icon is drawn with the airdrop
 * crate in pickups.ts.)
 */

type Pt = [number, number];

/** A spiky burst of `n` points. */
function burst(t: Toon, x: number, y: number, r: number, n: number, color: number): void {
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const d = i % 2 ? r * 0.55 : r;
    pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
  }
  t.part(() => t.poly(pts, 3), color);
}

/** A four-pointed throwing star. */
function star4(t: Toon, x: number, y: number, r: number, color: number): void {
  const k = r * 0.3;
  t.part(() => t.poly([[x, y - r], [x + k, y - k], [x + r, y], [x + k, y + k], [x, y + r], [x - k, y + k], [x - r, y], [x - k, y - k]], 3), color, () => {
    t.paint("#3a3a4a", () => t.C(x, y, r * 0.2));
  });
}

/** A little sheet ghost with a wavy hem. */
function ghost(t: Toon, x: number, y: number, s: number, color: number): void {
  const c = t.ctx;
  t.part(() => {
    c.moveTo(x - 26 * s, y + 28 * s);
    c.lineTo(x - 26 * s, y);
    c.arc(x, y, 26 * s, Math.PI, 0);
    c.lineTo(x + 26 * s, y + 28 * s);
    for (let i = 0; i < 4; i++) {
      const x0 = x + 26 * s - i * 13 * s;
      c.quadraticCurveTo(x0 - 6.5 * s, y + (i % 2 ? 36 : 20) * s, x0 - 13 * s, y + 28 * s);
    }
    c.closePath();
  }, color);
  t.paint(INK, () => {
    t.E(x - 9 * s, y + 2 * s, 4 * s, 6 * s);
    t.E(x + 9 * s, y + 2 * s, 4 * s, 6 * s);
  });
}

function heart(t: Toon, x: number, y: number, s: number, color = 0xff5a7a): void {
  const c = t.ctx;
  t.part(() => {
    c.moveTo(x, y + 16 * s);
    c.bezierCurveTo(x - 32 * s, y - 4 * s, x - 16 * s, y - 30 * s, x, y - 12 * s);
    c.bezierCurveTo(x + 16 * s, y - 30 * s, x + 32 * s, y - 4 * s, x, y + 16 * s);
    c.closePath();
  }, color, () => t.gloss(x - 8 * s, y - 8 * s, 5 * s, 3 * s, -0.6));
}

/** A cardboard box seen from the front, with its flaps up. */
function box(t: Toon, x: number, y: number, s: number): void {
  t.part(() => t.poly([[x - 40 * s, y - 30 * s], [x - 30 * s, y - 44 * s], [x + 30 * s, y - 44 * s], [x + 40 * s, y - 30 * s]], 3), 0xc08850);
  t.part(() => t.rect(x, y, 80 * s, 62 * s, 6), 0xd9a066, () => t.paint("rgba(255,240,200,0.55)", () => t.rect(x, y - 24 * s, 18 * s, 14 * s, 2)));
}

function crystal(t: Toon, x: number, y: number, s: number, color: number): void {
  t.part(() => t.poly([[x, y - 46 * s], [x + 24 * s, y - 18 * s], [x + 14 * s, y + 42 * s], [x - 14 * s, y + 42 * s], [x - 24 * s, y - 18 * s]], 4), color, () => {
    t.paint("rgba(255,255,255,0.45)", () => t.poly([[x, y - 40 * s], [x + 6 * s, y - 16 * s], [x, y + 36 * s], [x - 10 * s, y - 16 * s]], 2));
  });
}

const ICONS: Record<string, (ctx: Ctx) => void> = {
  // two throwing stars: one more of everything
  double: (ctx) => {
    const t = toon(ctx, INK, 5);
    star4(t, 42, 44, 30, 0xb8c8e0);
    star4(t, 76, 74, 34, 0xeef4ff);
  },
  // a sword: hit harder
  power: (ctx) => {
    const t = toon(ctx, INK, 5);
    t.part(() => t.poly([[30, 84], [86, 20], [102, 16], [98, 32], [38, 92]], 4), 0xe8eef6, () => {
      t.paint("rgba(255,255,255,0.8)", () => t.poly([[40, 82], [88, 26], [94, 26], [46, 86]], 2));
    });
    t.part(() => t.poly([[16, 76], [26, 66], [56, 96], [46, 106]], 4), 0xffcf3a);
    t.tube(() => {
      ctx.moveTo(30, 94);
      ctx.lineTo(14, 110);
    }, 10, 0x8a5a3a);
  },
  // a stopwatch with a lightning bolt: faster
  hyper: (ctx) => {
    const t = toon(ctx, INK, 5);
    t.part(() => t.rect(60, 16, 24, 14, 4), 0xff8a3a);
    t.part(() => t.C(60, 66, 42), 0xffffff, () => t.paint("rgba(0,0,0,0.07)", () => t.C(60, 72, 36)));
    t.part(() => t.poly([[68, 32], [42, 72], [58, 72], [50, 102], [80, 58], [64, 58]], 3), 0xffd23f);
  },
  // a big explosion: bigger blasts
  bigbang: (ctx) => {
    const t = toon(ctx, INK, 5);
    burst(t, 60, 62, 52, 10, 0xff7a3a);
    burst(t, 60, 62, 32, 8, 0xffe066);
    t.paint("#ffffff", () => t.C(60, 62, 10));
  },
  // three bursts joined by a crackle: one blows up the next
  chain: (ctx) => {
    const t = toon(ctx, INK, 5);
    ctx.save();
    ctx.setLineDash([9, 7]);
    t.tube(() => {
      ctx.moveTo(28, 84);
      ctx.lineTo(58, 36);
      ctx.lineTo(92, 82);
    }, 6, 0xffb03a);
    ctx.restore();
    burst(t, 28, 84, 22, 7, 0xff5a4a);
    burst(t, 92, 82, 22, 7, 0xff5a4a);
    burst(t, 58, 36, 28, 8, 0xffcf3a);
  },
  // a ghost in a purple glow: hurts monsters near you
  haunt: (ctx) => {
    const t = toon(ctx, INK, 5);
    for (const [r, a] of [[54, 0.4], [42, 0.7]]) {
      ctx.beginPath();
      ctx.ellipse(60, 64, r, r * 0.9, 0, 0, Math.PI * 2);
      ctx.lineWidth = 7;
      ctx.strokeStyle = `rgba(160,110,255,${a})`;
      ctx.stroke();
    }
    ghost(t, 60, 58, 1.05, 0xffffff);
  },
  // a see-through ghost dashing with a ring: phase and shockwave
  phase: (ctx) => {
    const t = toon(ctx, INK, 5);
    ctx.beginPath();
    ctx.ellipse(64, 66, 50, 44, 0, 0, Math.PI * 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(185,138,255,0.75)";
    ctx.stroke();
    for (const y of [46, 64, 82]) {
      t.tube(() => {
        ctx.moveTo(8, y);
        ctx.lineTo(26, y);
      }, 5, 0xffffff);
    }
    ctx.globalAlpha = 0.65;
    ghost(t, 68, 58, 1.1, 0xe6d8ff);
    ctx.globalAlpha = 1;
  },
  // a drumstick and a heart: heal on kills
  snack: (ctx) => {
    const t = toon(ctx, INK, 5);
    t.tube(() => {
      ctx.moveTo(52, 64);
      ctx.lineTo(24, 94);
    }, 12, 0xfff6e8);
    t.part(() => {
      t.C(18, 92, 9);
      t.C(26, 102, 9);
    }, 0xfff6e8);
    t.part(() => t.E(64, 50, 34, 27, -0.7), 0xc8663a, () => t.gloss(56, 40, 9, 5, -0.7));
    heart(t, 88, 86, 0.9);
  },
  // a box with a heart: more health
  tough: (ctx) => {
    const t = toon(ctx, INK, 5);
    box(t, 60, 70, 1);
    heart(t, 60, 74, 1.05);
  },
  // a box behind a shield: stand still, take less damage
  fort: (ctx) => {
    const t = toon(ctx, INK, 5);
    box(t, 46, 64, 0.8);
    t.part(() => t.poly([[56, 42], [102, 42], [102, 70], [79, 104], [56, 70]], 6), 0x5aa8ff, () => {
      t.paint("rgba(255,255,255,0.85)", () => t.poly([[75, 48], [83, 48], [83, 94], [79, 98], [75, 94]], 2));
    });
  },
  // a sneaker with speed lines: move faster
  zoom: (ctx) => {
    const t = toon(ctx, INK, 5);
    for (const y of [56, 70, 84]) {
      t.tube(() => {
        ctx.moveTo(6, y);
        ctx.lineTo(20, y);
      }, 5, 0xffffff);
    }
    t.part(() => t.poly([[28, 88], [32, 54], [52, 50], [66, 64], [98, 70], [108, 86], [108, 96], [28, 96]], 8), 0xff5a5a, () => {
      t.paint("#ffffff", () => t.rect(68, 92, 82, 10, 3));
      t.paint("rgba(255,255,255,0.9)", () => {
        t.rect(48, 62, 14, 4, 2);
        t.rect(54, 70, 14, 4, 2);
      });
    });
  },
  // a magnet pulling a bone: grab XP from farther
  vacuum: (ctx) => {
    const t = toon(ctx, INK, 5);
    t.tube(() => {
      ctx.moveTo(34, 36);
      ctx.lineTo(34, 70);
      ctx.arc(60, 70, 26, Math.PI, 0, true);
      ctx.lineTo(86, 36);
    }, 20, 0xe8434f);
    t.part(() => {
      t.rect(34, 30, 26, 16, 3);
      t.rect(86, 30, 26, 16, 3);
    }, 0xdfe8f2);
    t.part(() => {
      t.rect(60, 18, 26, 9, 4);
      t.C(46, 14, 6);
      t.C(46, 22, 6);
      t.C(74, 14, 6);
      t.C(74, 22, 6);
    }, 0xfff6e8);
  },
  // a paw with a party hat: pets hit harder and faster
  pack: (ctx) => {
    const t = toon(ctx, INK, 5);
    t.part(() => {
      t.E(56, 82, 26, 21);
      t.C(28, 56, 10);
      t.C(44, 42, 10);
      t.C(64, 40, 10);
      t.C(82, 52, 10);
    }, 0xffa64d);
    t.part(() => t.poly([[76, 40], [104, 40], [92, 8]], 3), 0x5ac8ff, () => {
      t.paint("#ffe066", () => {
        t.rect(90, 30, 30, 6, 1);
        t.rect(92, 18, 30, 5, 1);
      });
    });
    t.part(() => t.C(92, 8, 5), 0xff6a8a);
  },
  // a crystal with a plus: the crystal heals
  mend: (ctx) => {
    const t = toon(ctx, INK, 5);
    crystal(t, 52, 60, 1.05, 0xff9ad0);
    t.part(() => {
      t.rect(92, 86, 14, 38, 4);
      t.rect(92, 86, 38, 14, 4);
    }, 0x5ad86a);
  },
  // a crystal throwing shards
  shards: (ctx) => {
    const t = toon(ctx, INK, 5);
    crystal(t, 60, 66, 0.85, 0xd8a8ff);
    for (const [x, y, a] of [[20, 30, -0.8], [100, 30, 0.8], [104, 92, 2.2], [16, 92, -2.2]] as [number, number, number][]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      t.part(() => t.poly([[0, -14], [7, 6], [-7, 6]], 2), 0xb98aff);
      ctx.restore();
    }
  },
};

export function makeSkillTextures(scene: Phaser.Scene): void {
  for (const [id, draw] of Object.entries(ICONS)) canvasTexture(scene, `sk_${id}`, 120, 120, draw);
}
