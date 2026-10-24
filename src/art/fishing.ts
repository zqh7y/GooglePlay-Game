import Phaser from "phaser";
import { INK, Ctx, canvasTexture, circle, ellipse, fill, linear, outline, radial, starPath, twinkle } from "./draw";
import { Toon, toon } from "./toon";

/**
 * Fishing art: the prizes (`fp_<id>`, 160 x 160), the upgrade icons (`fu_<id>`, 120 x 120),
 * the shell you pay upgrades with, the tab icon and the pieces of the pond scene (the pier is
 * drawn in perspective by the fishing screen itself).
 */

type Pt = [number, number];
const T = (c: Ctx, lw = 5): Toon => toon(c, INK, lw);

/** A fish facing left: body, tail, fin, eye; `stripe` paints a band along its side. */
function fish(t: Toon, x: number, y: number, len: number, color: number, belly: string, stripe?: string, spots = false): void {
  const h = len * 0.42;
  t.part(() => t.poly([[x + len * 0.38, y], [x + len * 0.62, y - h * 0.62], [x + len * 0.56, y], [x + len * 0.62, y + h * 0.62]], 4), color);
  t.part(() => t.E(x, y, len * 0.46, h * 0.5), color, () => {
    t.paint(belly, () => t.E(x - len * 0.04, y + h * 0.22, len * 0.38, h * 0.26));
    if (stripe) t.paint(stripe, () => t.E(x + len * 0.02, y - h * 0.02, len * 0.4, h * 0.1));
    if (spots) for (const [dx, dy] of [[0.05, -0.2], [0.2, -0.05], [-0.1, -0.28]] as Pt[]) t.paint("rgba(255,255,255,0.55)", () => t.C(x + dx * len, y + dy * h, len * 0.035));
    t.paint("rgba(0,0,0,0.18)", () => t.E(x + len * 0.24, y, len * 0.03, h * 0.3));
  });
  t.part(() => t.poly([[x - len * 0.02, y - h * 0.42], [x + len * 0.16, y - h * 0.82], [x + len * 0.22, y - h * 0.4]], 3), color);
  t.paint("#ffffff", () => t.C(x - len * 0.27, y - h * 0.08, len * 0.075));
  t.paint(INK, () => t.C(x - len * 0.285, y - h * 0.08, len * 0.04));
  t.paint("#ffffff", () => t.C(x - len * 0.3, y - h * 0.12, len * 0.015));
  t.gloss(x - len * 0.12, y - h * 0.26, len * 0.12, h * 0.08);
}

/** A round potion flask with a cork and a symbol on it. */
function flask(t: Toon, liquid: number, mark: (c: Ctx) => void): void {
  const c = t.ctx;
  t.part(() => t.rect(80, 34, 30, 30, 6), 0xd8b48a);
  t.part(() => {
    t.C(80, 98, 48);
    t.rect(80, 50, 34, 30, 6);
  }, 0xd8f4ff, () => {
    t.paint(linear(c, 0, 70, 0, 146, [[0, "rgba(255,255,255,0)"], [0.05, `#${liquid.toString(16).padStart(6, "0")}`], [1, `#${liquid.toString(16).padStart(6, "0")}`]]), () => t.E(80, 112, 46, 36));
    t.paint("rgba(255,255,255,0.35)", () => t.C(64, 120, 6));
    t.paint("rgba(255,255,255,0.35)", () => t.C(92, 128, 4));
  });
  mark(c);
  t.gloss(60, 80, 12, 20, 0.4);
}

const PRIZE_ART: Record<string, (c: Ctx) => void> = {
  boot: (c) => {
    const t = T(c);
    t.part(() => t.poly([[52, 26], [98, 26], [102, 92], [140, 104], [142, 132], [44, 132], [42, 90]], 10), 0x8a5a3a, () => {
      t.paint("#6e432a", () => t.rect(92, 128, 108, 14, 4));
      for (let y = 42; y < 90; y += 14) t.paint("#f3e2c0", () => t.rect(74, y, 30, 5, 2));
    });
    t.part(() => t.rect(75, 24, 58, 12, 5), 0xa87a52);
    // water dripping out
    for (const [x, y, r] of [[118, 146, 6], [134, 150, 4], [100, 152, 4]] as [number, number, number][]) t.part(() => t.E(x, y, r * 0.8, r), 0x7ad0ff, undefined, 3);
    // a weed hanging off it
    t.tube(() => {
      c.moveTo(56, 30);
      c.quadraticCurveTo(36, 50, 46, 76);
    }, 6, 0x6fbf4a);
  },
  sardine: (c) => {
    const t = T(c);
    c.save();
    c.translate(80, 84);
    c.rotate(-0.2);
    fish(t, 0, 0, 120, 0x9ab8d8, "#e8f4ff", "#5a7ab0");
    c.restore();
  },
  pouch: (c) => {
    const t = T(c);
    t.part(() => {
      t.E(80, 104, 50, 42);
      t.poly([[58, 50], [102, 50], [96, 72], [64, 72]], 6);
    }, 0xb07a48, () => t.paint("rgba(255,255,255,0.15)", () => t.E(66, 92, 18, 22)));
    t.part(() => t.rect(80, 70, 50, 10, 5), 0xe85a4a);
    for (const [x, y] of [[48, 42], [80, 36], [110, 44]] as Pt[]) {
      t.part(() => t.C(x, y, 15), 0xffd23f, () => t.paint("#ffb02e", () => t.C(x + 2, y + 2, 9)));
      t.paint("#fff3a8", () => t.rect(x - 1, y, 4, 12, 2));
    }
    t.paint("#ffe066", () => {
      c.font = "bold 34px sans-serif";
      c.textAlign = "center";
      c.fillText("$", 80, 118);
    });
  },
  oyster: (c) => {
    const t = T(c);
    // bottom shell, top shell open, pearl
    t.part(() => t.E(80, 112, 62, 30), 0xe8b8c8, () => {
      for (let i = -3; i <= 3; i++) t.paint("rgba(150,80,110,0.25)", () => t.rect(80 + i * 16, 112, 4, 40, 2));
    });
    t.part(() => {
      c.moveTo(20, 100);
      c.quadraticCurveTo(30, 20, 80, 26);
      c.quadraticCurveTo(130, 20, 140, 100);
      c.quadraticCurveTo(80, 70, 20, 100);
    }, 0xf0c8d8);
    t.part(() => t.E(80, 100, 44, 16), 0xb06a8a);
    t.part(() => t.C(80, 92, 20), 0xfffaf0, () => t.paint("#e8d8f0", () => t.C(86, 98, 12)));
    t.gloss(74, 86, 7, 5);
    twinkle(c, 108, 70, 12);
  },
  luckPotion: (c) => {
    const t = T(c);
    flask(t, 0x6fe07a, (cx) => {
      for (const a of [0, 1, 2, 3]) {
        cx.save();
        cx.translate(80, 108);
        cx.rotate((a * Math.PI) / 2 + Math.PI / 4);
        t.part(() => t.E(0, -13, 10, 13), 0x2f9a3a, undefined, 3);
        cx.restore();
      }
    });
    twinkle(c, 120, 60, 12);
  },
  salmon: (c) => {
    const t = T(c);
    c.save();
    c.translate(84, 84);
    c.rotate(-0.25);
    fish(t, 0, 0, 140, 0xff9a7a, "#ffe0d0", "#e8605a", true);
    c.restore();
  },
  speedPotion: (c) => {
    const t = T(c);
    flask(t, 0x5ac8ff, (cx) => {
      cx.save();
      cx.translate(80, 108);
      t.part(() => t.poly([[6, -26], [-14, 4], [0, 4], [-6, 26], [16, -6], [2, -6]], 2), 0xfff35c, undefined, 3);
      cx.restore();
    });
    for (const y of [70, 92]) t.tube(() => {
      c.moveTo(18, y);
      c.lineTo(36, y);
    }, 5, 0xffffff);
  },
  chest: (c) => {
    const t = T(c);
    t.part(() => t.rect(80, 108, 118, 64, 10), 0x9a5a2a, () => {
      for (const y of [90, 116]) t.paint("rgba(0,0,0,0.12)", () => t.rect(80, y, 118, 4, 2));
    });
    // open lid, gold heaped up inside
    t.part(() => {
      t.E(80, 70, 48, 20);
    }, 0xffd23f, () => {
      for (const [x, y] of [[60, 66], [84, 60], [104, 70], [72, 76]] as Pt[]) t.paint("#ffb02e", () => t.C(x, y, 8));
    });
    t.part(() => t.poly([[22, 76], [30, 34], [130, 34], [138, 76]], 12), 0xb06a32, () => t.paint("rgba(255,255,255,0.15)", () => t.rect(80, 44, 100, 10, 4)));
    for (const x of [36, 124]) t.part(() => t.rect(x, 108, 12, 64, 3), 0xd8a050);
    t.part(() => t.rect(80, 104, 22, 26, 5), 0xffd23f, () => t.paint(INK, () => t.C(80, 102, 4)));
    twinkle(c, 120, 30, 14);
    twinkle(c, 44, 46, 9);
  },
  clover: (c) => {
    const t = T(c);
    t.tube(() => {
      c.moveTo(80, 92);
      c.quadraticCurveTo(84, 130, 104, 146);
    }, 9, 0x3f9a3a);
    for (let a = 0; a < 4; a++) {
      c.save();
      c.translate(80, 80);
      c.rotate((a * Math.PI) / 2 + Math.PI / 4);
      t.part(() => {
        t.E(-12, -30, 20, 24, -0.4);
        t.E(12, -30, 20, 24, 0.4);
      }, 0x6fd25a, () => t.paint("rgba(255,255,255,0.25)", () => t.E(-8, -34, 6, 10)));
      c.restore();
    }
    for (const [x, y] of [[40, 40], [124, 116]] as Pt[]) t.part(() => t.E(x, y, 7, 9), 0x9ae6ff, undefined, 3);
    twinkle(c, 126, 36, 12);
  },
  bottle: (c) => {
    const t = T(c);
    c.save();
    c.translate(80, 84);
    c.rotate(-0.6);
    t.part(() => t.rect(0, -58, 18, 22, 4), 0xc8945a);
    t.part(() => {
      t.rect(0, 6, 54, 96, 18);
      t.rect(0, -42, 22, 26, 6);
    }, 0xa8e8d0, () => {
      t.paint("rgba(255,255,255,0.3)", () => t.rect(-14, 6, 8, 70, 4));
    });
    // the rolled-up note inside
    t.part(() => t.rect(4, 10, 26, 58, 6), 0xfff0c8, () => t.paint("#e85a4a", () => t.rect(4, 10, 28, 6, 2)));
    c.restore();
    twinkle(c, 124, 40, 12);
  },
  koi: (c) => {
    const t = T(c);
    c.save();
    c.translate(84, 82);
    c.rotate(-0.3);
    fish(t, 0, 0, 140, 0xffc23a, "#fff3c0", "#ff7a2e", true);
    c.restore();
    twinkle(c, 30, 40, 14);
    twinkle(c, 132, 120, 11);
    twinkle(c, 128, 32, 8);
  },
  crown: (c) => {
    const t = T(c);
    t.part(() => t.poly([[24, 120], [20, 46], [52, 80], [80, 30], [108, 80], [140, 46], [136, 120]], 6), 0xffd23f, () => {
      t.paint("#ffb02e", () => t.rect(80, 112, 116, 14, 4));
    });
    for (const [x, y, col] of [[80, 92, 0xff4f5e], [48, 98, 0x4fa8ff], [112, 98, 0x6fd25a]] as [number, number, number][]) t.part(() => t.C(x, y, 9), col, undefined, 3);
    for (const [x, y] of [[20, 44], [80, 28], [140, 44]] as Pt[]) t.part(() => t.C(x, y, 9), 0xfffaf0, undefined, 3);
    t.gloss(50, 74, 10, 6);
    twinkle(c, 128, 132, 12);
  },
  trident: (c) => {
    const t = T(c);
    c.save();
    c.translate(80, 82);
    c.rotate(0.5);
    t.part(() => t.rect(0, 30, 14, 110, 6), 0xffc23a);
    t.part(() => {
      c.moveTo(-34, -46);
      c.quadraticCurveTo(-34, -6, 0, -6);
      c.quadraticCurveTo(34, -6, 34, -46);
      c.lineTo(24, -46);
      c.quadraticCurveTo(24, -18, 0, -18);
      c.quadraticCurveTo(-24, -18, -24, -46);
      c.closePath();
    }, 0xffd23f);
    for (const x of [-29, 0, 29]) t.part(() => t.poly([[x - 9, -40], [x, -70], [x + 9, -40]], 2), 0xfff3a8);
    t.part(() => t.rect(0, -16, 10, 34, 4), 0xffd23f);
    t.part(() => t.C(0, 8, 10), 0x5ac8ff);
    c.restore();
    twinkle(c, 36, 34, 14);
    twinkle(c, 128, 126, 10);
  },
  leviathan: (c) => {
    const t = T(c);
    c.fillStyle = radial(c, 80, 80, 78, [[0, "rgba(255,120,240,0.85)"], [0.55, "rgba(120,80,255,0.35)"], [1, "rgba(120,80,255,0)"]]);
    c.fillRect(0, 0, 160, 160);
    // tentacles curling around a glowing heart
    for (const [sx, sy, k] of [[22, 140, 1], [138, 140, -1], [20, 30, 1]] as [number, number, number][]) t.tube(() => {
      c.moveTo(sx, sy);
      c.bezierCurveTo(sx + 40 * k, sy - 20, 80 - 10 * k, 120, 80 + 24 * k, 96);
    }, 12, 0x6a3aa8);
    t.part(() => {
      c.moveTo(80, 128);
      c.bezierCurveTo(30, 92, 34, 44, 62, 44);
      c.bezierCurveTo(74, 44, 80, 54, 80, 60);
      c.bezierCurveTo(80, 54, 86, 44, 98, 44);
      c.bezierCurveTo(126, 44, 130, 92, 80, 128);
    }, 0xff4fd8, () => {
      t.paint("rgba(255,255,255,0.35)", () => t.E(64, 66, 10, 14, -0.4));
      t.paint("rgba(90,200,255,0.5)", () => t.E(92, 96, 14, 10, 0.4));
    });
    starPath(c, 80, 84, 14, 0.45, 4);
    fill(c, "#fff8ff");
    twinkle(c, 30, 70, 12);
    twinkle(c, 132, 64, 12);
  },
};

const UP_ART: Record<string, (c: Ctx) => void> = {
  // a fishing reel spinning fast
  speed: (c) => {
    const t = T(c);
    t.part(() => t.C(60, 64, 40), 0x5ac8ff, () => t.paint("#3a8ad8", () => t.C(60, 64, 24)));
    t.part(() => t.C(60, 64, 10), 0xd8e0e8);
    t.part(() => t.rect(98, 64, 30, 12, 5), 0xd8e0e8);
    t.part(() => t.C(112, 64, 9), 0xffd23f);
    for (const a of [-2.4, -1.9]) t.tube(() => c.arc(60, 64, 52, a, a + 0.35), 5, 0xffffff);
  },
  // a wriggly worm on a hook, with a sparkle
  luck: (c) => {
    const t = T(c);
    t.tube(() => {
      c.moveTo(62, 10);
      c.lineTo(62, 76);
      c.arc(46, 76, 16, 0, Math.PI * 0.95);
    }, 7, 0xb8c2cc);
    t.tube(() => {
      c.moveTo(40, 40);
      c.bezierCurveTo(90, 30, 30, 70, 84, 84);
    }, 14, 0xff8ab0);
    twinkle(c, 96, 30, 16, "#fff35c");
  },
  // deeper water: waves and an arrow down
  pond: (c) => {
    const t = T(c);
    t.part(() => t.rect(60, 70, 100, 80, 18), 0x4fa8ff, () => {
      t.paint("#2a6ab8", () => t.rect(60, 96, 100, 40, 10));
      for (const y of [44, 60]) t.paint("rgba(255,255,255,0.5)", () => t.rect(60, y, 70, 5, 2));
    });
    t.part(() => t.poly([[48, 54], [72, 54], [72, 82], [88, 82], [60, 110], [32, 82], [48, 82]], 3), 0xffe066);
  },
  // two hooks
  hook: (c) => {
    const t = T(c);
    for (const [x, k] of [[44, 1], [80, -1]] as [number, number][]) t.tube(() => {
      c.moveTo(x, 14);
      c.lineTo(x, 80);
      c.arc(x + 14 * k, 80, 14, Math.PI * (k > 0 ? 1 : 0), Math.PI * (k > 0 ? 0 : 1), k > 0);
      c.lineTo(x + 28 * k, 66);
    }, 8, 0xd8e0e8);
    t.part(() => t.C(62, 16, 10), 0xffd23f);
  },
  // a golden spool of line
  gold: (c) => {
    const t = T(c);
    t.part(() => t.rect(60, 64, 64, 70, 10), 0xffd23f, () => {
      for (let y = 40; y < 92; y += 10) t.paint("rgba(180,110,0,0.35)", () => t.rect(60, y, 60, 3, 1));
    });
    for (const y of [28, 100]) t.part(() => t.E(60, y, 44, 12), 0xd89a2a);
    twinkle(c, 100, 36, 14);
  },
  // a net full of holes
  net: (c) => {
    const t = T(c);
    t.part(() => t.E(60, 66, 46, 40), 0xe8d8b8, () => {
      c.strokeStyle = "rgba(120,80,40,0.55)";
      c.lineWidth = 4;
      for (let i = -3; i <= 3; i++) {
        c.beginPath();
        c.moveTo(60 + i * 14 - 30, 20);
        c.lineTo(60 + i * 14 + 30, 112);
        c.moveTo(60 + i * 14 + 30, 20);
        c.lineTo(60 + i * 14 - 30, 112);
        c.stroke();
      }
    });
    t.tube(() => c.ellipse(60, 66, 46, 40, 0, 0, Math.PI * 2), 6, 0x9a6a3a);
    t.tube(() => {
      c.moveTo(96, 92);
      c.lineTo(116, 114);
    }, 9, 0x9a6a3a);
  },
  // a fish with a lightning bolt
  super: (c) => {
    const t = T(c);
    c.save();
    c.translate(56, 70);
    fish(t, 0, 0, 84, 0xb98aff, "#efe0ff");
    c.restore();
    t.part(() => t.poly([[96, 8], [74, 54], [92, 54], [80, 100], [116, 44], [98, 44]], 3), 0xfff35c);
  },
  // a shiny spoon lure
  shiny: (c) => {
    const t = T(c);
    t.part(() => t.E(56, 62, 24, 42, 0.5), 0xd8e0e8, () => {
      t.paint(linear(c, 30, 30, 80, 100, [[0, "#ffffff"], [0.5, "#c8d0e0"], [1, "#8a9ab0"]]), () => t.E(54, 60, 18, 34, 0.5));
    });
    t.tube(() => {
      c.moveTo(78, 96);
      c.lineTo(90, 112);
    }, 5, 0xb8c2cc);
    twinkle(c, 92, 28, 16, "#fff35c");
    twinkle(c, 24, 100, 10, "#fff35c");
  },
  // a cooler box
  cooler: (c) => {
    const t = T(c);
    t.part(() => t.rect(60, 74, 96, 60, 10), 0x5ac8ff, () => t.paint("#ffffff", () => t.rect(60, 70, 80, 12, 5)));
    t.part(() => t.rect(60, 38, 104, 20, 8), 0xffffff);
    t.tube(() => {
      c.moveTo(36, 30);
      c.quadraticCurveTo(60, 6, 84, 30);
    }, 6, 0x3a8ad8);
    twinkle(c, 100, 96, 10);
  },
};

/** The shell you buy fishing upgrades with. */
function shell(c: Ctx): void {
  const t = T(c, 4);
  t.part(() => {
    c.moveTo(32, 56);
    c.lineTo(8, 26);
    c.quadraticCurveTo(32, -6, 56, 26);
    c.closePath();
  }, 0xffa0b8, () => {
    for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
      c.beginPath();
      c.moveTo(32, 54);
      c.lineTo(32 + Math.sin(a) * 30, 30 - Math.cos(a) * 26);
      c.lineWidth = 3;
      c.strokeStyle = "rgba(200,80,110,0.5)";
      c.stroke();
    }
  });
  t.part(() => t.rect(32, 54, 18, 8, 3), 0xe87898);
  t.gloss(24, 22, 6, 4);
}

/** Tab icon: a fish on a hook. */
function tabIcon(c: Ctx): void {
  const t = T(c, 5);
  t.tube(() => {
    c.moveTo(66, 4);
    c.lineTo(66, 34);
  }, 4, 0xe8e0d0);
  c.save();
  c.translate(48, 60);
  c.rotate(-0.5);
  fish(t, 0, 0, 74, 0x5ac8ff, "#e8f8ff", "#3a8ad8");
  c.restore();
  t.tube(() => c.arc(62, 36, 6, Math.PI, Math.PI * 2.2), 4, 0xd8e0e8);
}

/** A bird far away: two curved wings. */
function bird(c: Ctx): void {
  c.lineCap = "round";
  c.lineWidth = 6;
  c.strokeStyle = "#3a4a5a";
  c.beginPath();
  c.moveTo(4, 14);
  c.quadraticCurveTo(14, 2, 26, 14);
  c.quadraticCurveTo(38, 2, 48, 14);
  c.stroke();
}

/** A see-through bubble with a shine. */
function bubble(c: Ctx): void {
  circle(c, 16, 16, 13);
  fill(c, radial(c, 12, 11, 16, [[0, "rgba(255,255,255,0.55)"], [0.6, "rgba(200,240,255,0.15)"], [1, "rgba(200,240,255,0.35)"]]));
  outline(c, 2.5, "rgba(230,250,255,0.8)");
  ellipse(c, 11, 10, 4, 2.5, -0.6);
  fill(c, "rgba(255,255,255,0.9)");
}

function bobber(c: Ctx): void {
  const t = T(c, 4);
  t.part(() => t.rect(24, 10, 6, 16, 2), 0xe8e0d0);
  t.part(() => t.C(24, 38, 20), 0xffffff, () => t.paint("#f04a4a", () => t.rect(24, 26, 44, 24, 2)));
  t.gloss(18, 28, 6, 4);
}

/** A fish's shadow under the water. */
function shadow(c: Ctx): void {
  c.fillStyle = "rgba(20,40,70,1)";
  ellipse(c, 80, 40, 60, 22);
  c.fill();
  c.beginPath();
  c.moveTo(130, 40);
  c.lineTo(170, 14);
  c.lineTo(162, 40);
  c.lineTo(170, 66);
  c.closePath();
  c.fill();
}

/** Far hills with a line of trees, for the back of the pond. */
function hills(c: Ctx, w: number): void {
  c.fillStyle = linear(c, 0, 40, 0, 260, [[0, "#9ad8a0"], [1, "#6ab87a"]]);
  c.beginPath();
  c.moveTo(0, 260);
  for (let x = 0; x <= w; x += 20) c.lineTo(x, 120 + Math.sin(x / 170) * 40 + Math.sin(x / 61) * 12);
  c.lineTo(w, 260);
  c.closePath();
  c.fill();
  for (let x = 30; x < w; x += 74 + ((x * 7) % 40)) {
    const y = 128 + Math.sin(x / 170) * 40 + Math.sin(x / 61) * 12;
    c.fillStyle = "#4a9a5a";
    circle(c, x, y - 18, 26);
    c.fill();
    circle(c, x + 18, y - 6, 18);
    c.fill();
  }
  c.fillStyle = linear(c, 0, 150, 0, 260, [[0, "#7ac88a"], [1, "#4f9a62"]]);
  c.beginPath();
  c.moveTo(0, 260);
  for (let x = 0; x <= w; x += 20) c.lineTo(x, 200 + Math.sin(x / 120 + 2) * 22);
  c.lineTo(w, 260);
  c.closePath();
  c.fill();
}

function cloud(c: Ctx): void {
  c.fillStyle = "rgba(255,255,255,0.95)";
  for (const [x, y, r] of [[60, 64, 34], [104, 50, 44], [150, 66, 32], [110, 74, 30]] as [number, number, number][]) {
    circle(c, x, y, r);
    c.fill();
  }
}

function lily(c: Ctx): void {
  const t = T(c, 4);
  t.part(() => {
    c.moveTo(60, 36);
    c.ellipse(60, 36, 54, 24, 0, 0.25, Math.PI * 2 - 0.05);
    c.closePath();
  }, 0x6fd25a, () => t.paint("rgba(255,255,255,0.18)", () => t.E(46, 28, 20, 7)));
  t.part(() => {
    for (let i = 0; i < 6; i++) t.E(76 + Math.cos(i) * 8, 26 + Math.sin(i) * 4, 9, 6, i);
  }, 0xffa0c8);
  t.part(() => t.C(76, 26, 5), 0xffe066, undefined, 3);
}

function reeds(c: Ctx): void {
  const t = T(c, 4);
  for (const [x, h, lean] of [[40, 220, -0.15], [80, 250, 0.05], [118, 200, 0.2]] as [number, number, number][]) {
    t.tube(() => {
      c.moveTo(x, 260);
      c.quadraticCurveTo(x + lean * 60, 260 - h / 2, x + lean * 100, 260 - h);
    }, 6, 0x5a9a3a);
    t.part(() => t.rect(x + lean * 94, 260 - h + 40, 16, 50, 8), 0x8a5a32);
  }
  t.part(() => {
    t.E(60, 236, 30, 10, -0.5);
    t.E(110, 240, 30, 10, 0.5);
  }, 0x6fbf4a);
}

function bucket(c: Ctx): void {
  const t = T(c, 5);
  t.tube(() => c.arc(66, 56, 44, Math.PI * 1.05, Math.PI * 1.95), 5, 0x8a9ab0);
  t.part(() => t.poly([[18, 50], [114, 50], [100, 116], [32, 116]], 8), 0xb8c8d8, () => {
    t.paint("rgba(255,255,255,0.3)", () => t.rect(40, 84, 10, 50, 4));
    t.paint("#5a7ab0", () => t.rect(66, 72, 84, 6, 2));
  });
  t.part(() => t.E(66, 50, 48, 12), 0x4fa8ff);
  // a tail sticking out
  t.part(() => t.poly([[70, 46], [86, 18], [94, 26], [80, 50]], 3), 0xffa060);
}

/** Make (once) everything the fishing screen draws with. */
export function makeFishTextures(scene: Phaser.Scene): void {
  for (const [id, draw] of Object.entries(PRIZE_ART)) canvasTexture(scene, `fp_${id}`, 160, 160, draw);
  for (const [id, draw] of Object.entries(UP_ART)) canvasTexture(scene, `fu_${id}`, 120, 120, draw);
  canvasTexture(scene, "fish_shell", 64, 64, shell);
  canvasTexture(scene, "fish_bird", 52, 20, bird);
  canvasTexture(scene, "fish_bubble", 32, 32, bubble);
  canvasTexture(scene, "fish_bobber", 48, 64, bobber);
  canvasTexture(scene, "fish_shadow", 172, 80, shadow);
  canvasTexture(scene, "fish_hills", 1080, 260, (c) => hills(c, 1080));
  canvasTexture(scene, "fish_cloud", 200, 110, cloud);
  canvasTexture(scene, "fish_lily", 120, 64, lily);
  canvasTexture(scene, "fish_reeds", 160, 260, reeds);
  canvasTexture(scene, "fish_bucket", 132, 124, bucket);
  canvasTexture(scene, "fish_drop", 24, 30, (c) => {
    c.beginPath();
    c.moveTo(12, 2);
    c.quadraticCurveTo(24, 20, 12, 28);
    c.quadraticCurveTo(0, 20, 12, 2);
    fill(c, "#bfe8ff");
    outline(c, 3, "rgba(40,90,140,0.8)");
  });
}

/** Tab icon, made with the other icons. */
export function makeFishIcon(scene: Phaser.Scene): void {
  canvasTexture(scene, "icon_fish", 96, 96, tabIcon);
}

// ───────────────────────── the fishing event (its card in the lobby) ─────────────────────────

/** The event card: a little lake at sunset in a golden frame (the fish and the text go on top). */
function eventCard(c: Ctx, w: number, h: number): void {
  const r = 30;
  const shape = (inset: number) => {
    c.beginPath();
    c.roundRect(inset, inset, w - inset * 2, h - inset * 2, r - inset * 0.5);
  };
  shape(3);
  fill(c, INK);
  c.save();
  shape(9);
  c.clip();
  const water = h * 0.5;
  c.fillStyle = linear(c, 0, 0, 0, water, [[0, "#ff9ac8"], [0.55, "#ffd29a"], [1, "#fff0c8"]]);
  c.fillRect(0, 0, w, water);
  // the sun going down behind far hills
  c.fillStyle = radial(c, w * 0.68, water - 14, 70, [[0, "rgba(255,250,210,1)"], [0.3, "rgba(255,230,150,0.8)"], [1, "rgba(255,200,150,0)"]]);
  c.fillRect(0, 0, w, water);
  circle(c, w * 0.68, water - 14, 20);
  fill(c, "#fff6c8");
  c.fillStyle = "#7ab86a";
  c.beginPath();
  c.moveTo(0, water);
  c.quadraticCurveTo(w * 0.25, water - 34, w * 0.5, water - 8);
  c.quadraticCurveTo(w * 0.75, water - 30, w, water - 6);
  c.lineTo(w, water);
  c.fill();
  c.fillStyle = linear(c, 0, water, 0, h, [[0, "#6fd0ff"], [0.5, "#2f8ad8"], [1, "#1a4a90"]]);
  c.fillRect(0, water, w, h - water);
  // the sun's path on the water and a few waves
  c.fillStyle = "rgba(255,240,190,0.55)";
  for (let k = 0; k < 6; k++) c.fillRect(w * 0.68 - 26 + k * 3 - (k % 2) * 8, water + 8 + k * 14, 52 - k * 4, 4);
  c.strokeStyle = "rgba(255,255,255,0.45)";
  c.lineWidth = 3;
  c.lineCap = "round";
  for (const [x, y, len] of [[30, water + 40, 40], [140, water + 70, 50], [50, water + 100, 60], [170, water + 120, 40]] as [number, number, number][]) {
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + len / 4, y - 6, x + len / 2, y);
    c.quadraticCurveTo(x + (len * 3) / 4, y + 6, x + len, y);
    c.stroke();
  }
  // a dark band at the bottom for the title
  c.fillStyle = linear(c, 0, h - 96, 0, h, [[0, "rgba(10,30,70,0)"], [1, "rgba(10,30,70,0.75)"]]);
  c.fillRect(0, h - 96, w, 96);
  // shine across the top left
  c.fillStyle = "rgba(255,255,255,0.25)";
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(w * 0.55, 0);
  c.lineTo(0, h * 0.4);
  c.fill();
  c.restore();
  // golden frame
  shape(9);
  c.lineWidth = 7;
  c.strokeStyle = linear(c, 0, 0, w, h, [[0, "#fff3a0"], [0.5, "#ffc23a"], [1, "#e88a1a"]]);
  c.stroke();
  shape(14);
  c.lineWidth = 2;
  c.strokeStyle = "rgba(90,50,10,0.5)";
  c.stroke();
}

/** A red ribbon with notched tails ("EVENT" goes on it). */
function eventRibbon(c: Ctx, w: number, h: number): void {
  const tail = 26;
  const band = (dy: number, x0: number, x1: number) => {
    c.beginPath();
    c.moveTo(x0, 6 + dy);
    c.lineTo(x1, 6 + dy);
    c.lineTo(x1, h - 8 + dy);
    c.lineTo(x0, h - 8 + dy);
    c.closePath();
  };
  // the tails, folded behind
  for (const side of [-1, 1]) {
    const x = side < 0 ? 4 : w - 4;
    c.beginPath();
    c.moveTo(x, 14);
    c.lineTo(x - side * (tail + 18), 14);
    c.lineTo(x - side * (tail + 18), h - 2);
    c.lineTo(x, h - 2);
    c.lineTo(x - side * 14, (h + 12) / 2);
    c.closePath();
    fill(c, "#9a1e2e");
    outline(c, 5);
  }
  band(0, tail, w - tail);
  fill(c, linear(c, 0, 6, 0, h - 8, [[0, "#ff6a6a"], [0.5, "#e8434f"], [1, "#b02a38"]]));
  outline(c, 6);
  c.fillStyle = "rgba(255,255,255,0.3)";
  c.fillRect(tail + 6, 12, w - tail * 2 - 12, 7);
  c.strokeStyle = "#ffd23f";
  c.lineWidth = 3;
  c.setLineDash([8, 6]);
  c.strokeRect(tail + 7, 14, w - tail * 2 - 14, h - 30);
  c.setLineDash([]);
}

/** A fish leaping (it flies over the card's water). */
function leapingFish(c: Ctx): void {
  const t = T(c, 5);
  c.save();
  c.translate(60, 40);
  fish(t, 0, 0, 92, 0xffa23a, "#fff3d0", "#ff6a2a", true);
  c.restore();
}

/** A Golden Ticket: notched gold card, perforation, a star, ADMIT ONE and a shine. */
function goldenTicket(c: Ctx): void {
  const w = 150;
  const h = 96;
  const shape = () => {
    c.beginPath();
    c.moveTo(14, 8);
    c.lineTo(w - 14, 8);
    c.arc(w - 8, h / 2, 14, -Math.PI / 2, Math.PI / 2, true);
    c.lineTo(w - 14, h - 8);
    c.lineTo(14, h - 8);
    c.arc(8, h / 2, 14, Math.PI / 2, -Math.PI / 2, true);
    c.closePath();
  };
  c.save();
  c.translate(5, 0);
  shape();
  fill(c, linear(c, 0, 8, 0, h - 8, [[0, "#fff6b0"], [0.45, "#ffd23f"], [1, "#e8961a"]]));
  outline(c, 6);
  c.save();
  shape();
  c.clip();
  c.fillStyle = "rgba(255,255,255,0.45)";
  c.beginPath();
  c.moveTo(20, 8);
  c.lineTo(62, 8);
  c.lineTo(30, h - 8);
  c.lineTo(-10, h - 8);
  c.fill();
  c.restore();
  c.strokeStyle = "rgba(140,80,10,0.7)";
  c.lineWidth = 3;
  c.setLineDash([6, 5]);
  c.beginPath();
  c.moveTo(42, 16);
  c.lineTo(42, h - 16);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = "#e85a2a";
  starPath(c, 24, h / 2, 11, 0.45);
  c.fill();
  c.fillStyle = "#8a4a0a";
  c.font = "bold 19px sans-serif";
  c.textAlign = "center";
  c.fillText("GOLDEN", 90, h / 2 - 4);
  c.font = "bold 15px sans-serif";
  c.fillText("TICKET", 92, h / 2 + 18);
  c.restore();
  twinkle(c, w - 6, 14, 10);
}

/** A lucky egg: golden, with coloured spots and a sparkle. */
function luckyEgg(c: Ctx): void {
  const t = T(c, 6);
  t.part(() => t.E(60, 70, 44, 54), 0xffd86a, () => {
    for (const [x, y, r, col] of [[44, 52, 9, "#ff7ab8"], [74, 40, 7, "#5ac8ff"], [78, 80, 10, "#8af06a"], [48, 92, 7, "#b36aff"], [62, 66, 5, "#ff9a3a"]] as [number, number, number, string][]) {
      t.paint(col, () => t.C(x, y, r));
    }
    t.paint("rgba(255,255,255,0.5)", () => t.E(44, 40, 10, 16, -0.4));
  });
  twinkle(c, 100, 22, 12);
  twinkle(c, 18, 40, 8);
}

export function makeEventTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "icon_ticket", 160, 100, goldenTicket);
  canvasTexture(scene, "icon_egg", 120, 130, luckyEgg);
  canvasTexture(scene, "event_card", 240, 270, (c) => eventCard(c, 240, 270));
  canvasTexture(scene, "event_ribbon", 220, 64, (c) => eventRibbon(c, 220, 64));
  canvasTexture(scene, "event_fish", 120, 80, leapingFish);
}
