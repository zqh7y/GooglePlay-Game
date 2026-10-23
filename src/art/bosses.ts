import Phaser from "phaser";
import { angryFace, bat, cactus, golemOf, mushroom, olFor, slime } from "./characters";
import { Ctx, canvasTexture, darken, lighten, radial, rgba } from "./draw";
import { Toon, toon } from "./toon";

/** A gold crown with gems, centred on (x, y = its bottom). */
function crown(t: Toon, x: number, y: number, s = 1, gem = 0xff4a6a): void {
  t.part(() => t.poly([[x - 34 * s, y], [x - 38 * s, y - 34 * s], [x - 16 * s, y - 16 * s], [x, y - 42 * s], [x + 16 * s, y - 16 * s], [x + 38 * s, y - 34 * s], [x + 34 * s, y]], 4), 0xffcf3a, () => {
    t.paint(rgba(gem), () => t.C(x, y - 14 * s, 6 * s));
  }, 4);
}

/** Draw a smaller monster painter blown up to boss size. */
function scaled(draw: (ctx: Ctx) => void, s: number, dx: number, dy: number): (ctx: Ctx) => void {
  return (ctx) => {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.scale(s, s);
    draw(ctx);
    ctx.restore();
  };
}

function slimeKing(ctx: Ctx): void {
  scaled(slime(0x7fd35a), 1.75, 2, 12)(ctx);
  crown(toon(ctx, olFor(0x7fd35a), 5), 128, 82, 1.1);
}

function mushroomTitan(ctx: Ctx): void {
  const t = toon(ctx, olFor(0xe8434f), 6);
  t.tube(() => {
    ctx.moveTo(70, 180);
    ctx.quadraticCurveTo(26, 190, 22, 230);
    ctx.moveTo(180, 180);
    ctx.quadraticCurveTo(224, 190, 228, 230);
  }, 18, 0xf2e0c8);
  t.part(() => {
    t.C(22, 232, 16);
    t.C(228, 232, 16);
  }, 0xf2e0c8);
  scaled(mushroom(0xe8434f, 0xfff0dc), 1.62, 20, 6)(ctx);
}

function batQueen(ctx: Ctx): void {
  scaled(bat(0x8a5ad0), 1.45, 2, 70)(ctx);
  const t = toon(ctx, olFor(0x8a5ad0), 5);
  t.paint("rgba(30,15,25,0.22)", () => t.E(125, 240, 80, 10));
  crown(t, 125, 92, 1, 0x5ac8ff);
}

function thunderCrow(ctx: Ctx): void {
  const t = toon(ctx, "#1a1a28", 5);
  for (const [x, y, s] of [[30, 40, 1], [220, 60, -1], [200, 200, 1]] as [number, number, number][]) {
    t.part(() => t.poly([[x, y], [x + 14 * s, y + 26], [x + 4 * s, y + 26], [x + 16 * s, y + 52], [x - 6 * s, y + 20], [x + 4 * s, y + 20]], 2), 0xffe066, undefined, 3);
  }
  scaled(bat(0x3a3a4a, true), 1.45, 2, 64)(ctx);
  t.paint("rgba(30,15,25,0.22)", () => t.E(125, 240, 80, 10));
}

function sporeMother(ctx: Ctx): void {
  scaled(mushroom(0x3fd0e8, 0xe8f6ff, true), 1.62, 20, 6)(ctx);
  const t = toon(ctx, olFor(0x3fd0e8), 4);
  for (const [x, y, r] of [[30, 40, 8], [214, 30, 10], [226, 120, 7], [20, 140, 9], [60, 18, 6]] as [number, number, number][]) {
    t.paint(radial(ctx, x, y, r * 2.2, [[0, "rgba(160,255,255,0.9)"], [1, "rgba(160,255,255,0)"]]), () => t.C(x, y, r * 2.2));
    t.part(() => t.C(x, y, r), 0xbffcff, undefined, 2.5);
  }
}

function cactusColossus(ctx: Ctx): void {
  scaled(cactus, 1.55, 24, -6)(ctx);
  const t = toon(ctx, olFor(0x5fb84a), 5);
  for (const [x, y] of [[48, 116], [196, 98], [96, 64]] as [number, number][]) {
    t.part(() => {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        t.E(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 7, 5, a);
      }
    }, 0xff7aa8, undefined, 3);
    t.paint("#ffe066", () => t.C(x, y, 4));
  }
}

const iceGolem = golemOf(0x9fdcf4, 0xffffff, "rgba(80,220,255,0.95)");

function scarecrow(ctx: Ctx): void {
  const t = toon(ctx, "#2a1a10", 6);
  t.paint("rgba(30,15,25,0.25)", () => t.E(125, 240, 70, 10));
  t.tube(() => {
    ctx.moveTo(125, 236);
    ctx.lineTo(125, 120);
  }, 16, 0x8a5a3a);
  t.tube(() => {
    ctx.moveTo(26, 128);
    ctx.lineTo(224, 128);
  }, 14, 0x8a5a3a);
  // straw poking out of the sleeves
  for (const s of [-1, 1]) {
    t.part(() => {
      for (let i = 0; i < 4; i++) t.poly([[125 + s * 92, 120 + i * 5], [125 + s * (116 + i * 3), 104 + i * 12], [125 + s * 100, 128 + i * 4]], 2);
    }, 0xf0d070, undefined, 3);
  }
  t.part(() => t.poly([[60, 116], [190, 116], [178, 206], [72, 206]], 12), 0x8a6ab0, () => {
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(60,30,90,0.5)";
    for (const x of [92, 124, 156]) {
      ctx.beginPath();
      ctx.moveTo(x, 116);
      ctx.lineTo(x, 206);
      ctx.stroke();
    }
    t.paint(rgba(0xd8a85a), () => t.rect(150, 176, 30, 24, 4));
  });
  t.part(() => t.E(125, 82, 50, 46), 0xdcbc80, () => {
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#5a3a1a";
    ctx.beginPath();
    ctx.moveTo(98, 104);
    for (let x = 98; x <= 152; x += 9) ctx.lineTo(x, x % 2 ? 108 : 100);
    ctx.stroke();
  });
  angryFace(t, 125, 76, 20, 1.1, "rgba(255,150,40,0.95)");
  t.part(() => {
    t.E(125, 44, 82, 14);
    t.poly([[90, 44], [102, 12], [148, 12], [160, 44]], 10);
  }, 0xc89a4a, () => t.paint(rgba(0xb03a2a), () => t.rect(125, 36, 70, 10, 3)));
}

function hayBrute(ctx: Ctx): void {
  const hay = 0xe8c860;
  const t = toon(ctx, olFor(hay), 6);
  t.paint("rgba(30,15,25,0.25)", () => t.E(125, 240, 96, 12));
  t.part(() => {
    t.rect(86, 222, 42, 34, 12);
    t.rect(164, 222, 42, 34, 12);
  }, darken(hay, 0.15));
  t.part(() => {
    t.C(26, 150, 28);
    t.C(224, 150, 28);
  }, darken(hay, 0.06));
  t.part(() => t.rect(125, 140, 180, 164, 40), hay, () => {
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(darken(hay, 0.25));
    for (let i = 0; i < 14; i++) {
      const x = 46 + i * 12;
      ctx.beginPath();
      ctx.moveTo(x, 64 + (i % 3) * 6);
      ctx.lineTo(x + 6, 214 - (i % 4) * 5);
      ctx.stroke();
    }
    t.paint(rgba(0xc8302e), () => {
      t.rect(125, 94, 190, 10, 2);
      t.rect(125, 186, 190, 10, 2);
    });
  });
  t.part(() => {
    t.poly([[64, 66], [50, 26], [84, 56]], 3);
    t.poly([[186, 66], [200, 26], [166, 56]], 3);
  }, lighten(hay, 0.2), undefined, 4);
  t.gloss(80, 84, 18, 7);
  angryFace(t, 125, 136, 30, 1.5, "rgba(255,80,40,0.95)");
}

function shadowWolf(ctx: Ctx): void {
  const fur = 0x3a2a5a;
  const t = toon(ctx, "#140c24", 6);
  t.paint("rgba(30,15,25,0.25)", () => t.E(125, 240, 96, 12));
  // mane of spikes
  t.part(() => {
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (0.95 + (i / 10) * 1.1);
      const x = 125 + Math.cos(a) * 92;
      const y = 140 + Math.sin(a) * 92;
      t.poly([[125 + Math.cos(a - 0.14) * 60, 140 + Math.sin(a - 0.14) * 60], [x, y], [125 + Math.cos(a + 0.14) * 60, 140 + Math.sin(a + 0.14) * 60]], 4);
    }
  }, darken(fur, 0.15));
  t.part(() => {
    t.rect(84, 214, 40, 44, 14);
    t.rect(166, 214, 40, 44, 14);
  }, darken(fur, 0.1));
  t.part(() => t.E(125, 168, 76, 66), fur, () => t.paint(rgba(lighten(fur, 0.15)), () => t.E(125, 196, 40, 30)));
  t.part(() => {
    t.poly([[68, 84], [62, 22], [104, 64]], 6);
    t.poly([[182, 84], [188, 22], [146, 64]], 6);
  }, fur, () => t.paint(rgba(0x8a5ad0), () => {
    t.poly([[74, 72], [70, 38], [94, 62]], 4);
    t.poly([[176, 72], [180, 38], [156, 62]], 4);
  }));
  t.part(() => t.E(125, 108, 66, 54), fur);
  t.part(() => t.E(125, 136, 34, 24), lighten(fur, 0.25), () => t.paint("#0a0614", () => t.E(125, 124, 12, 8)));
  t.paint("#ffffff", () => {
    t.poly([[106, 150], [114, 150], [110, 164]], 1);
    t.poly([[136, 150], [144, 150], [140, 164]], 1);
  });
  angryFace(t, 125, 96, 30, 1.2, "rgba(80,240,255,0.95)");
}

function mossTroll(ctx: Ctx): void {
  const skin = 0x7a9a4a;
  const t = toon(ctx, olFor(skin), 6);
  t.paint("rgba(30,15,25,0.25)", () => t.E(125, 240, 100, 12));
  t.tube(() => {
    ctx.moveTo(48, 120);
    ctx.quadraticCurveTo(20, 170, 30, 220);
    ctx.moveTo(202, 120);
    ctx.quadraticCurveTo(230, 170, 220, 220);
  }, 26, skin);
  t.part(() => {
    t.C(30, 226, 22);
    t.C(220, 226, 22);
  }, darken(skin, 0.1));
  t.part(() => {
    t.rect(96, 228, 40, 26, 10);
    t.rect(154, 228, 40, 26, 10);
  }, darken(skin, 0.15));
  t.part(() => t.E(125, 156, 86, 78), skin, () => {
    t.paint(rgba(lighten(skin, 0.18)), () => t.E(125, 186, 50, 40));
    t.paint(rgba(0x4f8a2a), () => {
      t.E(80, 96, 34, 14, -0.3);
      t.E(170, 92, 30, 12, 0.3);
      t.E(125, 84, 26, 10);
    });
  });
  t.part(() => t.E(125, 132, 18, 22), lighten(skin, 0.1));
  t.paint("#fff6e0", () => {
    t.poly([[96, 160], [104, 160], [100, 140]], 2);
    t.poly([[146, 160], [154, 160], [150, 140]], 2);
  });
  angryFace(t, 125, 112, 30, 1.2);
  t.part(() => t.E(160, 74, 22, 12), 0xe8434f, () => t.paint("#fff6ec", () => {
    t.C(152, 70, 4);
    t.C(166, 74, 3);
  }), 4);
  t.tube(() => {
    ctx.moveTo(160, 84);
    ctx.lineTo(160, 92);
  }, 8, 0xfff0dc);
}

function mummy(ctx: Ctx): void {
  const wrap = 0xe8dcc0;
  const t = toon(ctx, "#3a2a1a", 6);
  t.paint("rgba(30,15,25,0.25)", () => t.E(125, 240, 80, 10));
  t.tube(() => {
    ctx.moveTo(70, 112);
    ctx.lineTo(20, 120);
    ctx.moveTo(180, 112);
    ctx.lineTo(230, 120);
  }, 24, wrap);
  t.part(() => {
    t.rect(100, 224, 36, 34, 10);
    t.rect(150, 224, 36, 34, 10);
  }, darken(wrap, 0.1));
  t.part(() => t.rect(125, 140, 120, 176, 50), wrap, () => {
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(darken(wrap, 0.25));
    for (let y = 70; y < 230; y += 18) {
      ctx.beginPath();
      ctx.moveTo(60, y + 10);
      ctx.lineTo(190, y - 6);
      ctx.stroke();
    }
  });
  // a gold pharaoh collar and a loose strip blowing in the wind
  t.part(() => t.E(125, 132, 64, 16), 0xffcf3a, () => t.paint(rgba(0x3a8aff), () => t.rect(125, 132, 100, 6, 2)));
  t.tube(() => {
    ctx.moveTo(180, 80);
    ctx.bezierCurveTo(210, 70, 214, 40, 240, 30);
  }, 10, wrap);
  t.paint("#1a0e08", () => t.rect(125, 92, 92, 26, 10));
  angryFace(t, 125, 92, 24, 1.1, "rgba(120,255,140,0.95)");
}

function sandWorm(ctx: Ctx): void {
  const c = 0xd9a26a;
  const t = toon(ctx, olFor(c), 6);
  t.part(() => t.E(125, 228, 110, 24), 0xecd08a, () => t.paint(rgba(0xdcbc72), () => t.E(150, 236, 60, 10)));
  for (const [x, y, r] of [[118, 210, 46], [126, 172, 48], [136, 134, 50], [132, 96, 54]] as [number, number, number][]) {
    t.part(() => t.C(x, y, r), c, () => t.paint(rgba(lighten(c, 0.25)), () => t.E(x - r * 0.1, y + r * 0.5, r * 0.75, r * 0.22)));
  }
  // the mouth: a ring of teeth
  t.part(() => t.E(132, 78, 54, 40), darken(c, 0.15));
  t.paint("#3a0a12", () => t.E(132, 80, 40, 28));
  t.paint("#ff6a7a", () => t.E(132, 92, 22, 10));
  t.paint("#fff6e0", () => {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = 132 + Math.cos(a) * 40;
      const y = 80 + Math.sin(a) * 28;
      t.poly([[x + Math.cos(a + 1.5) * 6, y + Math.sin(a + 1.5) * 6], [132 + Math.cos(a) * 26, 80 + Math.sin(a) * 18], [x + Math.cos(a - 1.5) * 6, y + Math.sin(a - 1.5) * 6]], 1);
    }
  });
  for (const s of [-1, 1]) t.paint(radial(ctx, 132 + s * 64, 112, 12, [[0, "#ffffff"], [0.35, "rgba(255,120,40,0.95)"], [1, "rgba(0,0,0,0)"]]), () => t.C(132 + s * 64, 112, 12));
}

function penguinEmperor(ctx: Ctx): void {
  const navy = 0x2a3a5a;
  const t = toon(ctx, "#101828", 6);
  t.paint("rgba(30,15,25,0.25)", () => t.E(125, 240, 86, 11));
  // royal cape behind
  t.part(() => t.poly([[54, 90], [196, 90], [226, 230], [24, 230]], 16), 0xc8303e);
  t.part(() => {
    t.E(92, 236, 26, 12);
    t.E(158, 236, 26, 12);
  }, 0xff9a2a);
  t.part(() => {
    t.E(46, 160, 18, 46, 0.4);
    t.E(204, 160, 18, 46, -0.4);
  }, navy);
  t.part(() => t.E(125, 150, 80, 92), navy, () => t.paint("#f6f8ff", () => t.E(125, 170, 56, 70)));
  t.part(() => t.poly([[108, 116], [142, 116], [125, 140]], 4), 0xff9a2a, undefined, 4);
  angryFace(t, 125, 96, 24, 1.1);
  crown(t, 125, 66, 1, 0x5ac8ff);
  // an ice scepter
  t.tube(() => {
    ctx.moveTo(214, 220);
    ctx.lineTo(228, 110);
  }, 8, 0x9adcff);
  t.part(() => t.poly([[228, 70], [244, 100], [228, 120], [212, 100]], 3), 0xd8f6ff, undefined, 4);
}

function frostDragon(ctx: Ctx): void {
  const c = 0x8fd8ff;
  const t = toon(ctx, "#1a3a5a", 6);
  t.paint("rgba(30,15,25,0.25)", () => t.E(125, 242, 100, 12));
  // wings behind
  for (const s of [-1, 1]) {
    const m = (x: number) => 125 + s * x;
    t.part(() => t.poly([[m(40), 120], [m(118), 30], [m(122), 74], [m(110), 90], [m(120), 128], [m(96), 140], [m(70), 150]], 6), lighten(c, 0.35), () => {
      ctx.lineWidth = 4;
      ctx.strokeStyle = rgba(darken(c, 0.2));
      for (const x of [70, 96]) {
        ctx.beginPath();
        ctx.moveTo(m(44), 124);
        ctx.lineTo(m(x + 20), 60);
        ctx.stroke();
      }
    });
  }
  // tail
  t.tube(() => {
    ctx.moveTo(160, 220);
    ctx.quadraticCurveTo(230, 230, 226, 186);
  }, 18, c);
  t.part(() => t.poly([[214, 186], [240, 168], [234, 196]], 3), 0xffffff, undefined, 4);
  t.part(() => {
    t.rect(96, 226, 38, 30, 12);
    t.rect(154, 226, 38, 30, 12);
  }, darken(c, 0.12));
  t.part(() => t.E(125, 176, 64, 60), c, () => {
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(darken(c, 0.15));
    for (let y = 150; y < 230; y += 16) {
      ctx.beginPath();
      ctx.moveTo(104, y);
      ctx.lineTo(146, y);
      ctx.stroke();
    }
  });
  // head with horns and ice spikes
  t.part(() => {
    t.poly([[90, 70], [70, 18], [104, 56]], 4);
    t.poly([[160, 70], [180, 18], [146, 56]], 4);
  }, 0xffffff, undefined, 5);
  t.part(() => t.E(125, 92, 58, 46), c, () => t.paint(rgba(lighten(c, 0.3)), () => t.E(125, 116, 34, 18)));
  t.part(() => {
    t.poly([[112, 50], [118, 30], [126, 50]], 2);
    t.poly([[126, 48], [134, 26], [140, 50]], 2);
  }, 0xd8f6ff, undefined, 3);
  t.paint("#1a3a5a", () => {
    t.C(114, 116, 4);
    t.C(136, 116, 4);
  });
  angryFace(t, 125, 88, 26, 1.2, "rgba(120,240,255,0.95)");
  for (const [x, y] of [[40, 200], [214, 40], [30, 60]] as [number, number][]) {
    t.paint("rgba(220,250,255,0.9)", () => t.poly([[x, y - 10], [x + 4, y], [x, y + 10], [x - 4, y]], 1));
  }
}

/** The new boss pictures (the five older ones live with the other monsters). */
const ART: Record<string, [number, number, (ctx: Ctx) => void]> = {
  b_slimeking: [250, 250, slimeKing],
  b_mushtitan: [250, 252, mushroomTitan],
  b_batqueen: [250, 250, batQueen],
  b_scarecrow: [250, 250, scarecrow],
  b_thundercrow: [250, 250, thunderCrow],
  b_haybrute: [250, 256, hayBrute],
  b_sporemother: [250, 252, sporeMother],
  b_shadowwolf: [250, 256, shadowWolf],
  b_mosstroll: [250, 252, mossTroll],
  b_mummy: [250, 252, mummy],
  b_sandworm: [250, 254, sandWorm],
  b_cactus: [250, 252, cactusColossus],
  b_penguin: [250, 250, penguinEmperor],
  b_icegolem: [250, 250, iceGolem],
  b_frostdragon: [250, 254, frostDragon],
};

export function makeBossTextures(scene: Phaser.Scene): void {
  for (const [key, [w, h, draw]] of Object.entries(ART)) canvasTexture(scene, key, w, h, draw);
}
