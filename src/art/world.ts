import Phaser from "phaser";
import { Ctx, canvasTexture, darken, lighten, linear, radial, rgba, twinkle } from "./draw";
import { Toon, toon } from "./toon";

/**
 * Everything standing in the world, in the same chunky cartoon style as the pets.
 * All sprites stand on their bottom-centre point (origin 0.5, 1).
 */
const OL = "#33241e";
const WOOD = 0x9a6440;

const shadow = (t: Toon, x: number, y: number, rx: number) => t.paint("rgba(30,20,20,0.2)", () => t.E(x, y, rx, rx * 0.22));

function roundTree(leaf: number, opts: { blossom?: boolean; snow?: boolean } = {}): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, OL, 5);
    shadow(t, 90, 210, 62);
    t.part(() => {
      t.rect(90, 176, 26, 64, 10);
      t.poly([[70, 210], [110, 210], [100, 196], [80, 196]], 4);
    }, WOOD);
    t.part(() => {
      t.C(90, 98, 58);
      t.C(52, 122, 40);
      t.C(128, 122, 40);
      t.C(66, 70, 36);
      t.C(114, 70, 36);
      t.C(90, 140, 40);
    }, leaf, () => {
      t.paint(rgba(darken(leaf, 0.12)), () => t.E(90, 160, 70, 26));
      t.paint(rgba(lighten(leaf, 0.25)), () => {
        t.C(66, 62, 16);
        t.C(102, 56, 13);
        t.C(48, 104, 11);
      });
      if (opts.blossom) for (const [x, y] of [[60, 90], [110, 84], [86, 120], [130, 118], [44, 128], [92, 66], [72, 140]]) t.paint("#fff0f6", () => t.C(x, y, 5));
      if (opts.snow) {
        t.paint("#ffffff", () => {
          t.E(80, 52, 34, 14, -0.2);
          t.E(124, 92, 18, 8, 0.4);
          t.E(46, 96, 16, 7, -0.4);
        });
      }
    });
  };
}

function pine(leaf: number, snow: boolean): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, OL, 5);
    shadow(t, 80, 222, 52);
    t.part(() => t.rect(80, 206, 22, 36, 8), WOOD);
    const tiers: [number, number, number][] = [[196, 64, 72], [150, 52, 62], [106, 40, 54]];
    for (const [base, half, h] of tiers) {
      t.part(() => t.poly([[80 - half, base], [80, base - h - 18], [80 + half, base]], 12), leaf, () => {
        t.paint(rgba(darken(leaf, 0.14)), () => t.poly([[80, base - h], [80 + half + 6, base + 4], [80, base + 4]], 2));
        if (snow) t.paint("#ffffff", () => t.poly([[80 - half * 0.45, base - h * 0.5], [80, base - h - 14], [80 + half * 0.45, base - h * 0.5], [80 + 6, base - h * 0.62], [80 - 8, base - h * 0.55]], 6));
      });
    }
  };
}

function palm(ctx: Ctx): void {
  const t = toon(ctx, OL, 5);
  shadow(t, 96, 232, 50);
  t.tube(() => {
    ctx.moveTo(90, 226);
    ctx.quadraticCurveTo(80, 150, 104, 80);
  }, 20, 0xb07a4a);
  ctx.lineWidth = 3;
  ctx.strokeStyle = rgba(darken(0xb07a4a, 0.3));
  for (let i = 0; i < 6; i++) {
    const y = 210 - i * 22;
    ctx.beginPath();
    ctx.moveTo(80 + i * 2, y);
    ctx.lineTo(98 + i * 2, y - 4);
    ctx.stroke();
  }
  const leaf = 0x4fbf4a;
  for (const [a, len] of [[-2.7, 70], [-2.1, 64], [-0.4, 70], [-1.0, 64], [-1.6, 56], [0.3, 56], [2.9, 56]] as [number, number][]) {
    t.part(() => t.E(104 + Math.cos(a) * len * 0.5, 80 + Math.sin(a) * len * 0.5 + 10, len * 0.55, 14, a), leaf, () => {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = rgba(darken(leaf, 0.25));
      ctx.beginPath();
      ctx.moveTo(104, 88);
      ctx.lineTo(104 + Math.cos(a) * len, 88 + Math.sin(a) * len);
      ctx.stroke();
    });
  }
  t.part(() => {
    t.C(96, 92, 9);
    t.C(112, 94, 9);
  }, 0x7a4a2a, undefined, 3);
}

function cactusBig(ctx: Ctx): void {
  const c = 0x5fb84a;
  const t = toon(ctx, OL, 5);
  shadow(t, 60, 164, 36);
  t.part(() => {
    t.rect(60, 100, 40, 128, 20);
    t.rect(24, 92, 18, 48, 9);
    t.rect(34, 112, 26, 16, 8);
    t.rect(96, 76, 18, 46, 9);
    t.rect(86, 96, 24, 16, 8);
  }, c, () => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(darken(c, 0.25));
    for (const x of [52, 68]) {
      ctx.beginPath();
      ctx.moveTo(x, 44);
      ctx.lineTo(x, 160);
      ctx.stroke();
    }
  });
  t.part(() => t.C(60, 36, 7), 0xff7aa8, undefined, 3);
}

function mushroomBig(ctx: Ctx): void {
  const t = toon(ctx, OL, 5);
  shadow(t, 60, 122, 40);
  t.part(() => t.rect(60, 96, 30, 50, 12), 0xf2e6d8);
  t.paint(radial(ctx, 60, 50, 64, [[0, "rgba(190,140,255,0.45)"], [1, "rgba(190,140,255,0)"]]), () => t.C(60, 50, 64));
  t.part(() => {
    ctx.moveTo(8, 70);
    ctx.bezierCurveTo(4, 18, 116, 18, 112, 70);
    ctx.quadraticCurveTo(60, 80, 8, 70);
    ctx.closePath();
  }, 0x9a6af0, () => {
    for (const [x, y, r] of [[36, 44, 8], [70, 34, 10], [94, 56, 6], [52, 62, 5]] as [number, number, number][]) t.paint("#f4ecff", () => t.C(x, y, r));
  });
}

function bush(ctx: Ctx): void {
  const t = toon(ctx, OL, 5);
  const c = 0x5fb84a;
  shadow(t, 60, 84, 50);
  t.part(() => {
    t.C(40, 58, 26);
    t.C(80, 58, 26);
    t.C(60, 44, 28);
  }, c, () => {
    t.paint(rgba(lighten(c, 0.25)), () => t.C(50, 34, 10));
    for (const [x, y] of [[36, 56], [70, 40], [86, 62], [56, 66]]) t.paint("#ff5a6a", () => t.C(x, y, 4.5));
  });
}

function rock(color: number, snow = false): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, OL, 5);
    shadow(t, 50, 74, 44);
    t.part(() => t.poly([[8, 72], [16, 36], [40, 18], [72, 22], [92, 46], [92, 72]], 10), color, () => {
      t.paint(rgba(lighten(color, 0.25)), () => t.poly([[24, 40], [42, 26], [62, 28], [44, 44]], 6));
      if (snow) t.paint("#ffffff", () => t.poly([[16, 40], [40, 18], [72, 22], [88, 42], [66, 36], [44, 40]], 8));
    });
  };
}
















function hay(ctx: Ctx): void {
  const t = toon(ctx, OL, 4);
  const c = 0xf2cf5a;
  shadow(t, 46, 70, 42);
  t.part(() => t.rect(46, 42, 82, 52, 14), c, () => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(darken(c, 0.22));
    for (const x of [22, 46, 70]) {
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.lineTo(x + 4, 66);
      ctx.stroke();
    }
    t.paint(rgba(0xc9423a), () => ctx.rect(0, 38, 92, 6));
  });
}

function stump(ctx: Ctx): void {
  const t = toon(ctx, OL, 4);
  shadow(t, 34, 50, 30);
  t.part(() => t.rect(34, 34, 48, 30, 10), WOOD);
  t.part(() => t.E(34, 20, 24, 9), 0xe8c48a, () => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(0xb08a5a);
    ctx.beginPath();
    ctx.ellipse(34, 20, 12, 4.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }, 3);
}

function snowman(ctx: Ctx): void {
  const t = toon(ctx, "#2a4a6a", 4);
  shadow(t, 40, 110, 32);
  t.part(() => t.C(40, 84, 26), 0xffffff);
  t.part(() => t.C(40, 46, 19), 0xffffff, () => {
    t.paint("#24161e", () => {
      t.C(33, 42, 3);
      t.C(47, 42, 3);
    });
    t.paint("#ff8a3a", () => t.poly([[40, 47], [56, 50], [40, 52]], 1));
  });
  t.part(() => t.rect(40, 22, 30, 16, 4), 0x3a3a4a, undefined, 3);
  t.part(() => t.poly([[22, 62], [58, 62], [52, 70], [28, 70]], 3), 0xe8534f, undefined, 3);
}

function pumpkin(ctx: Ctx): void {
  const t = toon(ctx, OL, 4);
  const c = 0xff8a2a;
  shadow(t, 36, 58, 32);
  t.part(() => {
    t.E(24, 38, 18, 18);
    t.E(48, 38, 18, 18);
    t.E(36, 38, 18, 20);
  }, c);
  t.tube(() => {
    ctx.moveTo(36, 20);
    ctx.lineTo(40, 10);
  }, 5, 0x4f8a2a);
}


function logs(ctx: Ctx): void {
  const t = toon(ctx, OL, 4);
  shadow(t, 50, 62, 46);
  for (const [x, y] of [[30, 46], [70, 46], [50, 24]]) {
    t.part(() => t.C(x, y, 18), WOOD, () => {
      t.paint(rgba(0xe8c48a), () => t.C(x - 2, y - 2, 11));
    });
  }
}

function skull(ctx: Ctx): void {
  const t = toon(ctx, OL, 4);
  shadow(t, 40, 46, 30);
  t.tube(() => {
    ctx.moveTo(10, 40);
    ctx.lineTo(70, 30);
  }, 6, 0xf2ead8);
  t.part(() => t.C(40, 24, 16), 0xf2ead8, () => {
    t.paint("#3a2a22", () => {
      t.C(34, 24, 4);
      t.C(46, 24, 4);
    });
  });
}







/** A treasure chest: wood with gold bands, or silver / gold for the shop's better chests. */
function chest(open: boolean, body = 0xb0703a, lid = 0xc98a4a, band = 0xffcf3a, inside = 0x8a5428): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, OL, 5);
    shadow(t, 55, 96, 46);
    if (open) t.paint(radial(ctx, 55, 40, 50, [[0, "rgba(255,240,140,0.9)"], [1, "rgba(255,220,80,0)"]]), () => t.C(55, 40, 50));
    t.part(() => t.rect(55, 70, 84, 48, 8), body, () => {
      t.paint(rgba(band), () => {
        ctx.rect(13, 62, 84, 8);
        ctx.rect(30, 46, 8, 48);
        ctx.rect(72, 46, 8, 48);
      });
    });
    if (open) {
      t.part(() => t.poly([[13, 46], [20, 10], [90, 10], [97, 46]], 8), inside);
      for (const [x, y] of [[40, 44], [56, 40], [70, 46]]) t.part(() => t.C(x, y, 8), 0xffd23f, undefined, 3);
    } else {
      t.part(() => {
        ctx.moveTo(13, 50);
        ctx.bezierCurveTo(13, 14, 97, 14, 97, 50);
        ctx.closePath();
      }, lid, () => t.paint(rgba(band), () => {
        ctx.rect(30, 14, 8, 40);
        ctx.rect(72, 14, 8, 40);
      }));
      t.part(() => t.rect(55, 52, 18, 20, 4), band, () => t.paint("#3a2a22", () => t.C(55, 52, 3)), 3);
    }
  };
}


function flowers(ctx: Ctx): void {
  const t = toon(ctx, OL, 3);
  for (const [x, y, c] of [[22, 40, 0xff7ab8], [44, 30, 0xffe066], [64, 42, 0xffffff], [36, 52, 0xb8a8ff], [56, 56, 0xff9a5a]] as [number, number, number][]) {
    t.tube(() => {
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x, 66);
    }, 3, 0x4fae3a);
    t.part(() => {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        t.E(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5, 4, a);
      }
    }, c, undefined, 2.5);
    t.paint("#ffd23f", () => t.C(x, y, 3.5));
  }
}

function fern(ctx: Ctx): void {
  const t = toon(ctx, OL, 3);
  const c = 0x4fa848;
  for (const a of [-2.4, -1.9, -1.5, -1.1, -0.7]) {
    t.part(() => t.E(50 + Math.cos(a) * 26, 64 + Math.sin(a) * 26, 26, 7, a), c, () => {
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(darken(c, 0.25));
      ctx.beginPath();
      ctx.moveTo(50, 64);
      ctx.lineTo(50 + Math.cos(a) * 50, 64 + Math.sin(a) * 50);
      ctx.stroke();
    });
  }
}

function rockSmall(ctx: Ctx): void {
  const t = toon(ctx, OL, 4);
  shadow(t, 32, 44, 28);
  t.part(() => {
    t.poly([[6, 42], [12, 22], [30, 14], [46, 22], [50, 42]], 6);
  }, 0xa8a8b0, () => t.paint("rgba(255,255,255,0.35)", () => t.poly([[16, 24], [28, 18], [36, 22], [24, 28]], 3)));
}

function dryBush(ctx: Ctx): void {
  const t = toon(ctx, OL, 3);
  shadow(t, 40, 56, 30);
  for (const [a, l] of [[-2.6, 34], [-2.0, 40], [-1.5, 44], [-1.0, 40], [-0.5, 34]] as [number, number][]) {
    t.tube(() => {
      ctx.moveTo(40, 56);
      ctx.lineTo(40 + Math.cos(a) * l, 56 + Math.sin(a) * l);
    }, 4, 0xb08a4a);
  }
}

function iceSpike(ctx: Ctx): void {
  const t = toon(ctx, "#1f4a78", 4);
  shadow(t, 44, 92, 36);
  const g = linear(ctx, 0, 10, 0, 92, [[0, "#f0fdff"], [1, "#6ac8f0"]]);
  t.part(() => {
    t.poly([[18, 90], [26, 34], [36, 90]], 3);
    t.poly([[32, 90], [44, 8], [58, 90]], 3);
    t.poly([[54, 90], [64, 44], [72, 90]], 3);
  }, 0x8fd8ff, () => {
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 90, 100);
    t.paint("rgba(255,255,255,0.6)", () => t.poly([[40, 86], [44, 20], [46, 86]], 1));
  });
}

/** The glowing crystal in the middle of every arena, in that land's colour. */
function heartCrystal(color: number): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, rgba(darken(color, 0.6)), 5);
    shadow(t, 120, 300, 100);
    t.part(() => t.E(120, 284, 104, 26), 0xa8a8b0, () => {
      t.paint(rgba(0xc8c8d0), () => t.E(120, 278, 96, 18));
      for (let i = 0; i < 8; i++) t.paint(rgba(color, 0.9), () => t.C(120 + Math.cos((i / 8) * Math.PI * 2) * 76, 280 + Math.sin((i / 8) * Math.PI * 2) * 12, 4));
    });
    t.paint(radial(ctx, 120, 170, 130, [[0, rgba(lighten(color, 0.4), 0.7)], [1, rgba(color, 0)]]), () => t.C(120, 170, 130));
    const g = linear(ctx, 0, 30, 0, 290, [[0, rgba(lighten(color, 0.75))], [0.5, rgba(lighten(color, 0.2))], [1, rgba(darken(color, 0.15))]]);
    for (const [x, w, h, lean] of [[72, 24, 110, -16], [168, 24, 100, 16], [120, 40, 230, 0], [96, 22, 150, -6], [146, 22, 140, 8]] as [number, number, number, number][]) {
      t.part(() => t.poly([[x - w, 282], [x - w * 0.8 + lean, 282 - h], [x + lean, 282 - h - 26], [x + w * 0.8 + lean, 282 - h], [x + w, 282]], 4), color, () => {
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 240, 310);
        t.paint("rgba(255,255,255,0.55)", () => t.poly([[x - w * 0.3, 272], [x - w * 0.2 + lean, 292 - h], [x + lean * 0.5, 282 - h - 10], [x, 272]], 2));
      });
    }
    twinkle(ctx, 92, 70, 10);
    twinkle(ctx, 160, 120, 7);
  };
}

/** Every world texture: key -> [width, height, painter]. */
const ART: Record<string, [number, number, (ctx: Ctx) => void]> = {
  tree_green: [180, 220, roundTree(0x6cc45a)],
  tree_pink: [180, 220, roundTree(0xf5a9c4, { blossom: true })],
  tree_orange: [180, 220, roundTree(0xf0943c)],
  tree_yellow: [180, 220, roundTree(0xf2cf4a)],
  tree_dark: [180, 220, roundTree(0x3f8f4a)],
  tree_snowround: [180, 220, roundTree(0x6fa88a, { snow: true })],
  tree_pine: [160, 230, pine(0x3f9a52, false)],
  tree_snowpine: [160, 230, pine(0x4f8a7a, true)],
  palm: [200, 240, palm],
  cactus_big: [120, 170, cactusBig],
  mushroom_big: [120, 130, mushroomBig],
  bush: [120, 92, bush],
  rock: [100, 82, rock(0xa8a8b0)],
  rock_sand: [100, 82, rock(0xd9a868)],
  rock_snow: [100, 82, rock(0x9aaabc, true)],
  rock_small: [56, 50, rockSmall],
  hay: [92, 74, hay],
  stump: [68, 56, stump],
  snowman: [80, 116, snowman],
  pumpkin: [72, 62, pumpkin],
  logs: [100, 66, logs],
  skull: [80, 50, skull],
  flowers: [86, 70, flowers],
  fern: [100, 70, fern],
  dry_bush: [80, 60, dryBush],
  ice_spike: [90, 100, iceSpike],
  chest: [110, 100, chest(false)],
  chest_open: [110, 100, chest(true)],
  chest_silver: [110, 100, chest(false, 0x8a9ab4, 0xb8c8e0, 0xf2f6ff, 0x5a6a84)],
  chest_silver_open: [110, 100, chest(true, 0x8a9ab4, 0xb8c8e0, 0xf2f6ff, 0x5a6a84)],
  chest_gold: [110, 100, chest(false, 0xe0a820, 0xffcf3a, 0xff5a8a, 0xa87010)],
  chest_gold_open: [110, 100, chest(true, 0xe0a820, 0xffcf3a, 0xff5a8a, 0xa87010)],
};

export const crystalKey = (id: string) => `crystal_${id}`;

export function makeWorldTextures(scene: Phaser.Scene, crystals: { id: string; crystal: number }[]): void {
  for (const [key, [w, h, draw]] of Object.entries(ART)) canvasTexture(scene, key, w, h, draw);
  for (const c of crystals) canvasTexture(scene, crystalKey(c.id), 240, 310, heartCrystal(c.crystal));
}

/** Small falling leaf / petal / snowflake; white so each land can tint it. */
export function makePetalTexture(scene: Phaser.Scene): void {
  canvasTexture(scene, "petal", 20, 14, (ctx) => {
    ctx.beginPath();
    ctx.ellipse(10, 7, 8, 5, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  });
}
