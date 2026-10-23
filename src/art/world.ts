import Phaser from "phaser";
import { Ctx, canvasTexture, darken, lighten, linear, radial, rgba, twinkle } from "./draw";
import { Toon, toon } from "./toon";

/**
 * Everything standing in the world, in the same chunky cartoon style as the pets.
 * All sprites stand on their bottom-centre point (origin 0.5, 1).
 */
const OL = "#33241e";
const WOOD = 0x9a6440;
const STONE = 0xb4b2ae;
const WALL = 0xfff0d8;

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

function house(roof: number, snow: boolean): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, OL, 5);
    shadow(t, 120, 232, 100);
    t.part(() => t.rect(166, 74, 26, 48, 6), STONE);
    t.part(() => t.rect(120, 176, 168, 108, 14), WALL, () => {
      t.paint(rgba(darken(WALL, 0.08)), () => ctx.rect(36, 200, 168, 40));
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(darken(WALL, 0.15));
      for (const y of [150, 176]) {
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(200, y);
        ctx.stroke();
      }
    });
    // door and windows
    t.part(() => {
      ctx.moveTo(104, 230);
      ctx.lineTo(104, 186);
      ctx.quadraticCurveTo(120, 166, 136, 186);
      ctx.lineTo(136, 230);
      ctx.closePath();
    }, 0x9a5a34, () => t.paint("#ffd23f", () => t.C(130, 206, 3.5)), 4);
    for (const x of [64, 176]) {
      t.part(() => t.rect(x, 184, 36, 34, 6), 0x8fd8ff, () => {
        t.paint("rgba(255,255,255,0.6)", () => t.poly([[x - 14, 172], [x - 4, 172], [x - 14, 184]], 1));
        ctx.lineWidth = 3;
        ctx.strokeStyle = OL;
        ctx.beginPath();
        ctx.moveTo(x, 167);
        ctx.lineTo(x, 201);
        ctx.moveTo(x - 18, 184);
        ctx.lineTo(x + 18, 184);
        ctx.stroke();
      }, 4);
      t.part(() => t.rect(x, 206, 42, 10, 4), WOOD, () => {
        for (const dx of [-12, 0, 12]) t.paint(dx ? "#ff6a8a" : "#ffe066", () => t.C(x + dx, 199, 5));
      }, 3);
    }
    t.part(() => t.poly([[16, 130], [120, 40], [224, 130]], 16), roof, () => {
      ctx.lineWidth = 4;
      ctx.strokeStyle = rgba(darken(roof, 0.2));
      for (const y of [76, 98, 120]) {
        ctx.beginPath();
        ctx.moveTo(120 - (y - 40) * 1.15, y);
        ctx.lineTo(120 + (y - 40) * 1.15, y);
        ctx.stroke();
      }
      if (snow) t.paint("#ffffff", () => t.poly([[30, 118], [120, 44], [210, 118], [196, 112], [170, 122], [140, 108], [110, 122], [80, 108], [52, 124]], 8));
    });
    if (snow) t.paint("#ffffff", () => t.rect(166, 52, 30, 10, 5));
  };
}

function barn(ctx: Ctx): void {
  const t = toon(ctx, OL, 5);
  const red = 0xd9433a;
  shadow(t, 135, 240, 110);
  t.part(() => t.poly([[36, 236], [36, 112], [135, 52], [234, 112], [234, 236]], 10), red, () => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(darken(red, 0.2));
    for (let x = 52; x < 230; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, 100);
      ctx.lineTo(x, 236);
      ctx.stroke();
    }
  });
  t.part(() => t.poly([[24, 120], [135, 44], [246, 120], [234, 128], [135, 62], [36, 128]], 6), 0x6a4a3a);
  t.part(() => t.rect(135, 196, 80, 80, 6), 0xffffff, () => {
    ctx.lineWidth = 7;
    ctx.strokeStyle = rgba(red);
    ctx.beginPath();
    ctx.moveTo(101, 162);
    ctx.lineTo(169, 230);
    ctx.moveTo(169, 162);
    ctx.lineTo(101, 230);
    ctx.stroke();
  }, 4);
  t.part(() => t.rect(135, 116, 40, 34, 6), 0xffe8a8, () => t.paint("#e8b84a", () => ctx.rect(115, 118, 40, 16)), 4);
}

function windmillBase(ctx: Ctx): void {
  const t = toon(ctx, OL, 5);
  shadow(t, 105, 312, 80);
  t.part(() => t.poly([[48, 308], [72, 96], [138, 96], [162, 308]], 10), 0xf2e2c4, () => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(darken(0xf2e2c4, 0.15));
    for (const y of [150, 200, 250]) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(170, y);
      ctx.stroke();
    }
  });
  t.part(() => t.poly([[58, 104], [105, 46], [152, 104]], 10), 0xc9423a);
  t.part(() => {
    ctx.moveTo(88, 308);
    ctx.lineTo(88, 262);
    ctx.quadraticCurveTo(105, 244, 122, 262);
    ctx.lineTo(122, 308);
    ctx.closePath();
  }, 0x9a5a34, undefined, 4);
  t.part(() => t.C(105, 170, 14), 0x8fd8ff, undefined, 4);
  t.part(() => t.C(105, 96, 14), 0x6a4a3a, undefined, 4);
}

function windmillBlades(ctx: Ctx): void {
  const t = toon(ctx, OL, 4);
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(140, 140);
    ctx.rotate((i * Math.PI) / 2);
    t.part(() => t.rect(0, -72, 14, 130, 4), WOOD);
    t.part(() => t.rect(20, -76, 30, 108, 4), 0xfff6e6, () => {
      ctx.lineWidth = 2;
      ctx.strokeStyle = rgba(0xc9b08a);
      for (let y = -124; y < -24; y += 18) {
        ctx.beginPath();
        ctx.moveTo(6, y);
        ctx.lineTo(34, y);
        ctx.stroke();
      }
    }, 3);
    ctx.restore();
  }
  t.part(() => t.C(140, 140, 16), 0x6a4a3a);
}

function fountain(ctx: Ctx): void {
  const t = toon(ctx, OL, 5);
  shadow(t, 150, 236, 140);
  t.part(() => t.E(150, 196, 138, 46), STONE, () => t.paint(rgba(lighten(STONE, 0.2)), () => t.E(150, 182, 130, 36)));
  t.part(() => t.E(150, 186, 116, 34), 0x5ac8f0, () => {
    t.paint(rgba(0x8fe0ff), () => t.E(140, 180, 86, 20));
    for (const [x, y] of [[96, 186], [196, 182], [150, 198]]) twinkle(ctx, x, y, 7);
  }, 4);
  t.part(() => t.rect(150, 140, 30, 80, 8), STONE);
  t.part(() => t.E(150, 108, 58, 18), STONE);
  t.part(() => t.E(150, 104, 46, 12), 0x5ac8f0, undefined, 3);
  t.part(() => t.rect(150, 76, 16, 44, 6), STONE);
  t.paint(linear(ctx, 0, 30, 0, 110, [[0, "rgba(255,255,255,0.95)"], [1, "rgba(140,220,255,0.55)"]]), () => {
    ctx.moveTo(150, 34);
    ctx.quadraticCurveTo(110, 40, 100, 104);
    ctx.lineTo(108, 104);
    ctx.quadraticCurveTo(118, 50, 150, 46);
    ctx.quadraticCurveTo(182, 50, 192, 104);
    ctx.lineTo(200, 104);
    ctx.quadraticCurveTo(190, 40, 150, 34);
    ctx.closePath();
  });
  t.part(() => t.C(150, 40, 10), 0xffe066, undefined, 3);
}

function greatTree(ctx: Ctx): void {
  const t = toon(ctx, OL, 6);
  shadow(t, 180, 386, 150);
  const bark = 0x7a5034;
  t.part(() => {
    t.poly([[120, 390], [140, 230], [220, 230], [240, 390]], 16);
    t.poly([[86, 392], [130, 350], [150, 392]], 8);
    t.poly([[210, 392], [230, 350], [276, 392]], 8);
  }, bark, () => {
    ctx.lineWidth = 5;
    ctx.strokeStyle = rgba(darken(bark, 0.3));
    for (const x of [158, 184, 206]) {
      ctx.beginPath();
      ctx.moveTo(x, 240);
      ctx.quadraticCurveTo(x - 8, 310, x + 4, 386);
      ctx.stroke();
    }
    t.paint("rgba(140,255,200,0.9)", () => {
      t.poly([[176, 296], [184, 282], [192, 296], [184, 310]], 2);
      t.C(160, 334, 4);
      t.C(206, 326, 4);
    });
  });
  const leaf = 0x3f9a4a;
  t.part(() => {
    t.C(180, 150, 110);
    t.C(84, 196, 72);
    t.C(276, 196, 72);
    t.C(110, 104, 66);
    t.C(250, 104, 66);
    t.C(180, 66, 66);
  }, leaf, () => {
    t.paint(rgba(darken(leaf, 0.14)), () => t.E(180, 250, 170, 50));
    t.paint(rgba(lighten(leaf, 0.22)), () => {
      t.C(140, 70, 24);
      t.C(206, 52, 18);
      t.C(96, 150, 18);
    });
  });
  for (const [x, y] of [[120, 214], [240, 220], [180, 230], [70, 236], [290, 232]]) {
    t.paint(radial(ctx, x, y, 18, [[0, "rgba(255,240,150,1)"], [1, "rgba(255,200,80,0)"]]), () => t.C(x, y, 18));
    t.part(() => t.rect(x, y, 12, 16, 4), 0xffe08a, undefined, 3);
  }
}

function obelisk(ctx: Ctx): void {
  const t = toon(ctx, OL, 5);
  const sand = 0xe0b878;
  shadow(t, 80, 292, 70);
  t.part(() => t.rect(80, 274, 140, 34, 6), darken(sand, 0.1));
  t.part(() => t.poly([[48, 258], [58, 70], [80, 40], [102, 70], [112, 258]], 6), sand, () => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(darken(sand, 0.28));
    for (const y of [120, 160, 200, 236]) {
      ctx.beginPath();
      ctx.moveTo(66, y);
      ctx.lineTo(76, y - 10);
      ctx.lineTo(86, y);
      ctx.moveTo(84, y + 14);
      ctx.lineTo(96, y + 14);
      ctx.stroke();
    }
  });
  t.paint(radial(ctx, 80, 90, 40, [[0, "rgba(120,255,240,0.9)"], [1, "rgba(120,255,240,0)"]]), () => t.C(80, 90, 40));
  t.part(() => t.poly([[80, 74], [92, 90], [80, 108], [68, 90]], 3), 0x4ff0d8, undefined, 4);
}

function iceCrystal(ctx: Ctx): void {
  const t = toon(ctx, "#1f4a78", 5);
  shadow(t, 110, 292, 90);
  t.paint(radial(ctx, 110, 170, 120, [[0, "rgba(160,230,255,0.6)"], [1, "rgba(160,230,255,0)"]]), () => t.C(110, 170, 120));
  t.part(() => t.E(110, 278, 96, 22), 0xd8ecff);
  const g = linear(ctx, 0, 30, 0, 280, [[0, "#f0fdff"], [1, "#5ac0f0"]]);
  for (const [x, w, h, lean] of [[62, 26, 120, -14], [158, 26, 110, 14], [110, 38, 236, 0], [86, 22, 160, -6], [136, 22, 150, 8]] as [number, number, number, number][]) {
    t.part(() => t.poly([[x - w, 280], [x - w * 0.8 + lean, 280 - h], [x + lean, 280 - h - 26], [x + w * 0.8 + lean, 280 - h], [x + w, 280]], 4), 0x8fd8ff, () => {
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 220, 300);
      t.paint("rgba(255,255,255,0.6)", () => t.poly([[x - w * 0.3, 270], [x - w * 0.2 + lean, 290 - h], [x + lean * 0.5, 280 - h - 10], [x, 270]], 2));
    });
  }
}

function igloo(ctx: Ctx): void {
  const t = toon(ctx, "#2a4a6a", 5);
  shadow(t, 100, 146, 90);
  t.part(() => {
    ctx.moveTo(12, 140);
    ctx.bezierCurveTo(12, 30, 188, 30, 188, 140);
    ctx.closePath();
  }, 0xf2f8ff, () => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(120,160,200,0.6)";
    for (const y of [70, 100, 124]) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(190, y);
      ctx.stroke();
    }
  });
  t.part(() => {
    ctx.moveTo(74, 142);
    ctx.bezierCurveTo(74, 92, 126, 92, 126, 142);
    ctx.closePath();
  }, 0x2a3a5a, undefined, 4);
}

function tent(ctx: Ctx): void {
  const t = toon(ctx, OL, 5);
  shadow(t, 100, 154, 92);
  t.part(() => t.poly([[10, 150], [100, 28], [190, 150]], 8), 0xf2e2c4, () => {
    for (const x of [44, 100, 156]) t.paint(rgba(0xe8534f), () => t.poly([[x - 12, 160], [100, 28], [x + 12, 160]], 1));
  });
  t.part(() => t.poly([[80, 150], [100, 96], [120, 150]], 4), 0x5a3a28, undefined, 4);
  t.tube(() => {
    ctx.moveTo(100, 28);
    ctx.lineTo(100, 8);
  }, 4, WOOD);
  t.part(() => t.poly([[100, 8], [126, 14], [100, 22]], 2), 0xffd23f, undefined, 3);
}

function stall(ctx: Ctx): void {
  const t = toon(ctx, OL, 5);
  shadow(t, 100, 172, 90);
  t.part(() => t.rect(100, 140, 170, 56, 8), WOOD, () => t.paint(rgba(lighten(WOOD, 0.2)), () => ctx.rect(15, 112, 170, 10)));
  for (const [x, c] of [[50, 0xff6a3a], [80, 0xffd23f], [110, 0x7ad651], [140, 0xff6a8a]] as [number, number][]) {
    t.part(() => {
      t.C(x - 6, 110, 9);
      t.C(x + 6, 110, 9);
      t.C(x, 102, 9);
    }, c, undefined, 3);
  }
  t.tube(() => {
    ctx.moveTo(24, 112);
    ctx.lineTo(24, 46);
    ctx.moveTo(176, 112);
    ctx.lineTo(176, 46);
  }, 6, WOOD);
  t.part(() => t.poly([[8, 60], [26, 26], [174, 26], [192, 60]], 6), 0xffffff, () => {
    for (let x = 8; x < 192; x += 36) t.paint(rgba(0xe8534f), () => t.poly([[x, 64], [x + 10, 20], [x + 28, 20], [x + 18, 64]], 1));
  });
}

function well(ctx: Ctx): void {
  const t = toon(ctx, OL, 5);
  shadow(t, 65, 144, 56);
  t.part(() => t.rect(65, 116, 100, 52, 12), STONE, () => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(darken(STONE, 0.2));
    for (const [x, y] of [[30, 106], [62, 104], [94, 106], [46, 126], [78, 126]]) {
      ctx.strokeRect(x - 14, y - 8, 28, 16);
    }
  });
  t.part(() => t.E(65, 92, 50, 12), 0x3a5a7a, undefined, 4);
  t.tube(() => {
    ctx.moveTo(22, 92);
    ctx.lineTo(22, 34);
    ctx.moveTo(108, 92);
    ctx.lineTo(108, 34);
  }, 7, WOOD);
  t.part(() => t.poly([[8, 40], [65, 6], [122, 40]], 6), 0xc9423a);
  t.part(() => t.rect(65, 62, 16, 18, 4), WOOD, undefined, 3);
}

function lamp(ctx: Ctx): void {
  const t = toon(ctx, OL, 4);
  shadow(t, 25, 146, 18);
  t.part(() => t.rect(25, 136, 26, 16, 5), 0x4a4a58);
  t.tube(() => {
    ctx.moveTo(25, 130);
    ctx.lineTo(25, 46);
  }, 7, 0x4a4a58);
  t.paint(radial(ctx, 25, 34, 26, [[0, "rgba(255,240,150,0.9)"], [1, "rgba(255,220,100,0)"]]), () => t.C(25, 34, 26));
  t.part(() => t.rect(25, 34, 22, 26, 6), 0xffe8a0, undefined, 4);
  t.part(() => t.poly([[10, 22], [25, 10], [40, 22]], 3), 0x4a4a58, undefined, 4);
}

function crate(ctx: Ctx): void {
  const t = toon(ctx, OL, 4);
  shadow(t, 36, 68, 32);
  t.part(() => t.rect(36, 40, 56, 54, 6), 0xc98a4a, () => {
    ctx.lineWidth = 5;
    ctx.strokeStyle = rgba(darken(0xc98a4a, 0.3));
    ctx.beginPath();
    ctx.moveTo(12, 16);
    ctx.lineTo(60, 64);
    ctx.stroke();
  });
}

function barrel(ctx: Ctx): void {
  const t = toon(ctx, OL, 4);
  shadow(t, 30, 74, 26);
  t.part(() => t.rect(30, 42, 48, 60, 14), WOOD, () => {
    t.paint(rgba(0x5a5a68), () => {
      ctx.rect(4, 24, 52, 6);
      ctx.rect(4, 56, 52, 6);
    });
  });
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

function scarecrow(ctx: Ctx): void {
  const t = toon(ctx, OL, 4);
  shadow(t, 60, 152, 30);
  t.tube(() => {
    ctx.moveTo(60, 150);
    ctx.lineTo(60, 40);
    ctx.moveTo(14, 76);
    ctx.lineTo(106, 76);
  }, 7, WOOD);
  t.part(() => t.poly([[36, 68], [84, 68], [90, 120], [30, 120]], 8), 0x4f8fe8, () => t.paint(rgba(0xe8534f), () => t.rect(60, 92, 14, 14, 3)));
  t.part(() => t.C(60, 48, 18), 0xf2d6a2, () => {
    t.paint("#24161e", () => {
      t.C(53, 46, 2.5);
      t.C(67, 46, 2.5);
    });
  });
  t.part(() => t.poly([[30, 36], [60, 12], [90, 36]], 6), 0xc9a24a);
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

function fenceH(ctx: Ctx): void {
  const t = toon(ctx, OL, 4);
  t.part(() => {
    t.rect(60, 26, 120, 10, 4);
    t.rect(60, 42, 120, 10, 4);
  }, 0xd9a868);
  t.part(() => {
    t.rect(14, 34, 12, 46, 4);
    t.rect(60, 34, 12, 46, 4);
    t.rect(106, 34, 12, 46, 4);
  }, 0xc49058);
}

function fenceV(ctx: Ctx): void {
  const t = toon(ctx, OL, 4);
  t.part(() => t.rect(14, 64, 10, 112, 4), 0xd9a868);
  t.part(() => t.rect(14, 104, 14, 36, 4), 0xc49058);
}

function crop(kind: string): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, OL, 3);
    const leaf = 0x5fbf4a;
    if (kind === "wheat") {
      for (const dx of [-12, 0, 12]) {
        t.tube(() => {
          ctx.moveTo(32 + dx, 64);
          ctx.lineTo(32 + dx * 1.3, 24);
        }, 3, 0xc9a24a);
        t.part(() => t.E(32 + dx * 1.3, 20, 5, 12), 0xf2cf5a);
      }
    } else if (kind === "carrot") {
      t.part(() => {
        t.E(26, 30, 5, 14, -0.3);
        t.E(38, 30, 5, 14, 0.3);
      }, leaf);
      t.part(() => t.E(32, 50, 12, 10), 0xff8a2a);
    } else if (kind === "cabbage") {
      t.part(() => {
        t.C(24, 46, 14);
        t.C(40, 46, 14);
        t.C(32, 36, 14);
      }, 0x9ad46a, () => t.paint(rgba(0xc8f0a0), () => t.C(32, 38, 7)));
    } else if (kind === "corn") {
      t.part(() => {
        t.E(24, 40, 6, 22, -0.4);
        t.E(40, 40, 6, 22, 0.4);
      }, leaf);
      t.part(() => t.E(32, 30, 8, 18), 0xffd23f);
    } else {
      t.part(() => {
        t.E(24, 48, 13, 13);
        t.E(40, 48, 13, 13);
        t.E(32, 48, 13, 15);
      }, 0xff8a2a);
      t.tube(() => {
        ctx.moveTo(32, 34);
        ctx.lineTo(34, 26);
      }, 4, 0x4f8a2a);
    }
  };
}

function bridge(ctx: Ctx): void {
  const t = toon(ctx, OL, 5);
  t.part(() => t.rect(140, 90, 260, 120, 10), 0xc98a4a, () => {
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(darken(0xc98a4a, 0.3));
    for (let x = 22; x < 270; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 30);
      ctx.lineTo(x, 150);
      ctx.stroke();
    }
  });
  t.part(() => {
    t.rect(140, 30, 270, 12, 5);
    t.rect(140, 150, 270, 12, 5);
  }, WOOD);
  t.part(() => {
    for (const x of [12, 76, 140, 204, 268]) {
      t.rect(x, 30, 16, 28, 4);
      t.rect(x, 150, 16, 28, 4);
    }
  }, darken(WOOD, 0.15));
}

function portal(ctx: Ctx): void {
  const t = toon(ctx, "#1a0e2a", 5);
  t.paint(radial(ctx, 100, 100, 100, [[0, "rgba(180,90,255,0.55)"], [1, "rgba(180,90,255,0)"]]), () => t.C(100, 100, 100));
  t.part(() => t.E(100, 104, 74, 54), 0x3a2a4a, () => {
    t.paint(radial(ctx, 100, 104, 70, [[0, "#ffffff"], [0.25, "#e0a8ff"], [0.7, "#7a3ad8"], [1, "#2a0a4a"]]), () => t.E(100, 104, 64, 46));
  });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    t.part(() => t.poly([[100 + Math.cos(a) * 70 - 9, 104 + Math.sin(a) * 52], [100 + Math.cos(a) * 78, 104 + Math.sin(a) * 58 - 16], [100 + Math.cos(a) * 86 + 9, 104 + Math.sin(a) * 64]], 4), 0x6a6a7a, undefined, 3);
  }
}

function portalSwirl(ctx: Ctx): void {
  ctx.lineCap = "round";
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2.2; a += 0.1) {
      const r = 6 + a * 9;
      const x = 64 + Math.cos(a + (k * Math.PI * 2) / 3) * r;
      const y = 64 + Math.sin(a + (k * Math.PI * 2) / 3) * r;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.stroke();
  }
}

function chest(open: boolean): (ctx: Ctx) => void {
  return (ctx) => {
    const t = toon(ctx, OL, 5);
    shadow(t, 55, 96, 46);
    if (open) t.paint(radial(ctx, 55, 40, 50, [[0, "rgba(255,240,140,0.9)"], [1, "rgba(255,220,80,0)"]]), () => t.C(55, 40, 50));
    t.part(() => t.rect(55, 70, 84, 48, 8), 0xb0703a, () => {
      t.paint(rgba(0xffcf3a), () => {
        ctx.rect(13, 62, 84, 8);
        ctx.rect(30, 46, 8, 48);
        ctx.rect(72, 46, 8, 48);
      });
    });
    if (open) {
      t.part(() => t.poly([[13, 46], [20, 10], [90, 10], [97, 46]], 8), 0x8a5428);
      for (const [x, y] of [[40, 44], [56, 40], [70, 46]]) t.part(() => t.C(x, y, 8), 0xffd23f, undefined, 3);
    } else {
      t.part(() => {
        ctx.moveTo(13, 50);
        ctx.bezierCurveTo(13, 14, 97, 14, 97, 50);
        ctx.closePath();
      }, 0xc98a4a, () => t.paint(rgba(0xffcf3a), () => {
        ctx.rect(30, 14, 8, 40);
        ctx.rect(72, 14, 8, 40);
      }));
      t.part(() => t.rect(55, 52, 18, 20, 4), 0xffcf3a, () => t.paint("#3a2a22", () => t.C(55, 52, 3)), 3);
    }
  };
}

function cloud(ctx: Ctx): void {
  const t = toon(ctx, "rgba(0,0,0,0)", 0);
  const puffs: [number, number, number][] = [[160, 120, 78], [92, 132, 56], [228, 130, 58], [124, 84, 54], [196, 80, 58], [160, 150, 64]];
  t.paint("rgba(150,160,190,0.9)", () => puffs.forEach(([x, y, r]) => t.C(x, y + 10, r)));
  t.paint("rgba(240,244,255,1)", () => puffs.forEach(([x, y, r]) => t.C(x - 4, y - 2, r * 0.94)));
  t.paint("rgba(255,255,255,1)", () => puffs.slice(3).forEach(([x, y, r]) => t.C(x - 10, y - 14, r * 0.55)));
}

const ROOFS = [0xe8534f, 0x4f8fe8, 0xf0a030, 0x8a5cd6, 0xc9423a];
export const houseKey = (roof: number, snow = false) => `house_${roof.toString(16)}${snow ? "_snow" : ""}`;

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
  barn: [270, 250, barn],
  windmill: [210, 320, windmillBase],
  windmill_blades: [280, 280, windmillBlades],
  fountain: [300, 250, fountain],
  great_tree: [360, 400, greatTree],
  obelisk: [160, 300, obelisk],
  ice_crystal: [220, 300, iceCrystal],
  igloo: [200, 150, igloo],
  tent: [200, 160, tent],
  stall: [200, 180, stall],
  well: [130, 150, well],
  lamp: [50, 150, lamp],
  crate: [72, 72, crate],
  barrel: [60, 78, barrel],
  hay: [92, 74, hay],
  stump: [68, 56, stump],
  snowman: [80, 116, snowman],
  pumpkin: [72, 62, pumpkin],
  scarecrow: [120, 156, scarecrow],
  logs: [100, 66, logs],
  skull: [80, 50, skull],
  fence_h: [120, 60, fenceH],
  fence_v: [28, 124, fenceV],
  crop_wheat: [64, 70, crop("wheat")],
  crop_carrot: [64, 70, crop("carrot")],
  crop_cabbage: [64, 70, crop("cabbage")],
  crop_corn: [64, 70, crop("corn")],
  crop_pumpkin: [64, 70, crop("pumpkin")],
  bridge: [280, 180, bridge],
  portal: [200, 200, portal],
  portal_swirl: [128, 128, portalSwirl],
  chest: [110, 100, chest(false)],
  chest_open: [110, 100, chest(true)],
  cloud: [320, 220, cloud],
};
for (const roof of ROOFS) {
  ART[houseKey(roof)] = [240, 240, house(roof, false)];
  ART[houseKey(roof, true)] = [240, 240, house(roof, true)];
}
export const HOUSE_ROOFS = ROOFS;

export function makeWorldTextures(scene: Phaser.Scene): void {
  for (const [key, [w, h, draw]] of Object.entries(ART)) canvasTexture(scene, key, w, h, draw);
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
