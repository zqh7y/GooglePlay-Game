import Phaser from "phaser";
import {
  Ctx, INK, boltPath, canvasTexture, celShape, circle, ellipse, fill, fillOutline, linear, outline, radial,
  starPath, strokeShape, twinkle,
} from "./draw";

// ───────────────────────── hero ─────────────────────────

export const HERO_W = 190;
export const HERO_H = 200;
/** Where the gun is held, relative to the hero's feet (origin 0.5, 0.95). */
export const HERO_HAND = { x: 46, y: -62 };

function drawHero(ctx: Ctx): void {
  const base = "#ffa64d";
  const dark = "#e9853a";
  const cream = "#fff3dc";
  const cx = 95;
  ellipse(ctx, cx, 190, 62, 9);
  fill(ctx, "rgba(74,47,29,0.22)");

  // headband tails flutter behind
  for (const [dy, len] of [[0, 1], [14, 0.8]]) {
    ctx.beginPath();
    ctx.moveTo(cx - 52, 66 + dy * 0.3);
    ctx.bezierCurveTo(cx - 76, 54 + dy, cx - 84, 80 + dy, cx - 92 + (1 - len) * 26, 72 + dy);
    ctx.lineTo(cx - 86 + (1 - len) * 26, 86 + dy);
    ctx.bezierCurveTo(cx - 74, 92 + dy, cx - 66, 76 + dy, cx - 50, 80 + dy * 0.3);
    ctx.closePath();
    fillOutline(ctx, "#e8434f", 4.5);
  }
  strokeShape(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx + 34, 170);
    ctx.bezierCurveTo(cx + 84, 172, cx + 86, 126, cx + 64, 114);
  }, 15, base);
  for (const [x, y] of [[cx + 78, 150], [cx + 74, 130]]) {
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x + 7, y - 2);
    outline(ctx, 4, dark);
  }

  // body
  celShape(ctx, () => ellipse(ctx, cx, 156, 48, 32), base, dark, 48);
  ellipse(ctx, cx, 162, 26, 20);
  fill(ctx, cream);
  for (const x of [cx - 20, cx + 20]) {
    ellipse(ctx, x, 186, 14, 8);
    fillOutline(ctx, cream, 4.5);
  }

  // ears
  for (const dir of [-1, 1]) {
    celShape(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 62, 72);
      ctx.lineTo(cx + dir * 52, 18);
      ctx.lineTo(cx + dir * 18, 46);
      ctx.closePath();
    }, base, dark, 24);
    ctx.beginPath();
    ctx.moveTo(cx + dir * 54, 62);
    ctx.lineTo(cx + dir * 49, 32);
    ctx.lineTo(cx + dir * 30, 48);
    ctx.closePath();
    fill(ctx, "rgba(255,150,180,0.9)");
  }

  // head with tabby stripes
  celShape(ctx, () => ellipse(ctx, cx, 88, 66, 52), base, dark, 66, () => {
    for (const dx of [-16, 0, 16]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, 34);
      ctx.lineTo(cx + dx * 1.1, 52);
      outline(ctx, 7, dark);
    }
    for (const dir of [-1, 1]) {
      for (const dy of [0, 14]) {
        ctx.beginPath();
        ctx.moveTo(cx + dir * 66, 92 + dy);
        ctx.lineTo(cx + dir * 50, 94 + dy);
        outline(ctx, 6, dark);
      }
    }
    ellipse(ctx, cx, 112, 30, 20);
    fill(ctx, cream);
  });

  // headband
  ctx.beginPath();
  ctx.moveTo(cx - 64, 66);
  ctx.quadraticCurveTo(cx, 40, cx + 64, 66);
  ctx.lineTo(cx + 62, 80);
  ctx.quadraticCurveTo(cx, 56, cx - 62, 80);
  ctx.closePath();
  fillOutline(ctx, "#e8434f", 4.5);
  ctx.beginPath();
  ctx.rect(cx - 12, 50, 24, 13);
  fillOutline(ctx, "#ffd23f", 3.5);

  // face
  for (const dir of [-1, 1]) {
    ellipse(ctx, cx + dir * 24, 92, 9, 12);
    fill(ctx, INK);
    ellipse(ctx, cx + dir * 24 + 3, 87, 3.5, 4);
    fill(ctx, "#ffffff");
    ctx.beginPath();
    ctx.moveTo(cx + dir * 34, 74);
    ctx.lineTo(cx + dir * 14, 79);
    outline(ctx, 5);
    ellipse(ctx, cx + dir * 42, 108, 10, 6);
    fill(ctx, "rgba(255,120,150,0.45)");
  }
  ctx.beginPath();
  ctx.moveTo(cx - 6, 104);
  ctx.lineTo(cx + 6, 104);
  ctx.lineTo(cx, 110);
  ctx.closePath();
  fill(ctx, "#ff8fae");
  ctx.beginPath();
  ctx.arc(cx - 6, 112, 6, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.moveTo(cx + 12, 112);
  ctx.arc(cx + 6, 112, 6, 0.1 * Math.PI, 0.9 * Math.PI);
  outline(ctx, 3.5);
  ellipse(ctx, cx - 36, 60, 12, 7, -0.6);
  fill(ctx, "rgba(255,255,255,0.55)");
}

/** The blaster is a separate sprite so it can aim at enemies. Points right; held at x=38. */
function drawGun(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(14, 20);
  ctx.lineTo(96, 16);
  ctx.lineTo(104, 24);
  ctx.lineTo(104, 40);
  ctx.lineTo(18, 44);
  ctx.closePath();
  fillOutline(ctx, linear(ctx, 0, 16, 0, 44, [[0, "#9aa6c4"], [0.5, "#6a76a0"], [1, "#4a5478"]]), 4.5);
  ctx.beginPath();
  ctx.rect(102, 22, 26, 16);
  fillOutline(ctx, "#5a6690", 4);
  ctx.beginPath();
  ctx.rect(26, 22, 48, 7);
  fill(ctx, "#ff9a3c");
  ctx.beginPath();
  ctx.moveTo(30, 42);
  ctx.lineTo(48, 42);
  ctx.lineTo(42, 60);
  ctx.lineTo(28, 60);
  ctx.closePath();
  fillOutline(ctx, "#5a3a28", 4);
  ctx.save();
  ctx.shadowColor = "#5ff0ff";
  ctx.shadowBlur = 12;
  circle(ctx, 130, 30, 7);
  fillOutline(ctx, "#bffbff", 3.5);
  ctx.restore();
  circle(ctx, 38, 46, 11);
  fillOutline(ctx, "#fff3dc", 4);
}

// ───────────────────────── enemies (front view) ─────────────────────────

function angryFace(ctx: Ctx, cx: number, y: number, s = 1, eye = "#ffffff", pupil = INK): void {
  for (const dir of [-1, 1]) {
    ellipse(ctx, cx + dir * 18 * s, y, 10 * s, 11 * s);
    fillOutline(ctx, eye, 3.5 * s);
    ellipse(ctx, cx + dir * 16 * s, y + 3 * s, 5 * s, 6 * s);
    fill(ctx, pupil);
  }
  ctx.beginPath();
  ctx.moveTo(cx - 32 * s, y - 16 * s);
  ctx.lineTo(cx - 8 * s, y - 9 * s);
  ctx.moveTo(cx + 8 * s, y - 9 * s);
  ctx.lineTo(cx + 32 * s, y - 16 * s);
  outline(ctx, 6 * s);
  ctx.beginPath();
  ctx.moveTo(cx - 14 * s, y + 18 * s);
  ctx.quadraticCurveTo(cx, y + 30 * s, cx + 14 * s, y + 18 * s);
  ctx.closePath();
  fillOutline(ctx, "#6a1a32", 3.5 * s);
  for (const dx of [-7, 7]) {
    ctx.beginPath();
    ctx.moveTo(cx + (dx - 4) * s, y + 19 * s);
    ctx.lineTo(cx + dx * s, y + 27 * s);
    ctx.lineTo(cx + (dx + 4) * s, y + 19 * s);
    ctx.closePath();
    fill(ctx, "#ffffff");
  }
}

function drawEvilSlime(ctx: Ctx): void {
  const cx = 66;
  ellipse(ctx, cx, 116, 54, 8);
  fill(ctx, "rgba(74,47,29,0.22)");
  celShape(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 52, 112);
    ctx.bezierCurveTo(cx - 64, 66, cx - 34, 22, cx, 22);
    ctx.bezierCurveTo(cx + 34, 22, cx + 64, 66, cx + 52, 112);
    ctx.quadraticCurveTo(cx, 122, cx - 52, 112);
    ctx.closePath();
  }, "#a46cf0", "#7f4cc8", 56);
  ellipse(ctx, cx - 26, 46, 10, 6, -0.6);
  fill(ctx, "rgba(255,255,255,0.55)");
  angryFace(ctx, cx, 70);
}

function drawMushroom(ctx: Ctx): void {
  const cx = 64;
  ellipse(ctx, cx, 136, 44, 7);
  fill(ctx, "rgba(74,47,29,0.22)");
  for (const dir of [-1, 1]) {
    ellipse(ctx, cx + dir * 16, 130, 12, 8);
    fillOutline(ctx, "#c9a27a", 4);
  }
  celShape(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 30, 128);
    ctx.quadraticCurveTo(cx - 36, 84, cx - 26, 64);
    ctx.lineTo(cx + 26, 64);
    ctx.quadraticCurveTo(cx + 36, 84, cx + 30, 128);
    ctx.closePath();
  }, "#fff0d6", "#e8d2b0", 34);
  celShape(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 60, 72);
    ctx.bezierCurveTo(cx - 62, 10, cx + 62, 10, cx + 60, 72);
    ctx.quadraticCurveTo(cx, 84, cx - 60, 72);
    ctx.closePath();
  }, "#ef4a5a", "#c8323f", 60);
  for (const [dx, dy, r] of [[-30, 46, 9], [6, 30, 11], [34, 50, 8], [-6, 58, 6]]) {
    circle(ctx, cx + dx, dy, r);
    fill(ctx, "#ffffff");
  }
  angryFace(ctx, cx, 92, 0.75);
}

function drawBat(ctx: Ctx): void {
  const cx = 80;
  const cy = 52;
  for (const dir of [-1, 1]) {
    celShape(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 18, cy - 8);
      ctx.quadraticCurveTo(cx + dir * 50, cy - 48, cx + dir * 78, cy - 26);
      ctx.quadraticCurveTo(cx + dir * 70, cy - 6, cx + dir * 76, cy + 10);
      ctx.quadraticCurveTo(cx + dir * 60, cy + 2, cx + dir * 54, cy + 18);
      ctx.quadraticCurveTo(cx + dir * 40, cy + 6, cx + dir * 30, cy + 20);
      ctx.quadraticCurveTo(cx + dir * 24, cy + 8, cx + dir * 14, cy + 10);
      ctx.closePath();
    }, "#7a5ac0", "#5a3e98", 40);
    ctx.beginPath();
    ctx.moveTo(cx + dir * 6, cy - 20);
    ctx.lineTo(cx + dir * 18, cy - 44);
    ctx.lineTo(cx + dir * 24, cy - 14);
    ctx.closePath();
    fillOutline(ctx, "#6a4cb0", 4);
  }
  celShape(ctx, () => ellipse(ctx, cx, cy, 30, 28), "#8a6ad0", "#6a4cb0", 30);
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.shadowColor = "#ff3355";
    ctx.shadowBlur = 8;
    ellipse(ctx, cx + dir * 11, cy - 3, 6, 7);
    fill(ctx, "#ff4d6d");
    ctx.restore();
    circle(ctx, cx + dir * 11 + 2, cy - 5, 2);
    fill(ctx, "#ffffff");
  }
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy + 10);
  ctx.quadraticCurveTo(cx, cy + 16, cx + 8, cy + 10);
  outline(ctx, 3.5);
  for (const dx of [-5, 5]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx - 3, cy + 11);
    ctx.lineTo(cx + dx, cy + 18);
    ctx.lineTo(cx + dx + 3, cy + 11);
    ctx.closePath();
    fill(ctx, "#ffffff");
  }
}

function drawGolem(ctx: Ctx): void {
  const cx = 120;
  ellipse(ctx, cx, 222, 92, 13);
  fill(ctx, "rgba(74,47,29,0.25)");
  for (const dir of [-1, 1]) {
    celShape(ctx, () => ellipse(ctx, cx + dir * 92, 150, 26, 36, dir * 0.3), "#9aa0ad", "#787e8c", 30);
    celShape(ctx, () => ellipse(ctx, cx + dir * 40, 212, 30, 16), "#9aa0ad", "#787e8c", 30);
  }
  celShape(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx - 82, 200);
    ctx.bezierCurveTo(cx - 102, 120, cx - 70, 52, cx, 50);
    ctx.bezierCurveTo(cx + 70, 52, cx + 102, 120, cx + 82, 200);
    ctx.quadraticCurveTo(cx, 220, cx - 82, 200);
    ctx.closePath();
  }, "#a7adba", "#81879a", 96, () => {
    for (const [x, y, rx, ry] of [[-40, 74, 30, 14], [44, 96, 24, 12], [-10, 186, 40, 14]]) {
      ellipse(ctx, cx + x, y, rx, ry, 0.2);
      fill(ctx, "#7fbf5a");
    }
    ctx.beginPath();
    ctx.moveTo(cx + 50, 140);
    ctx.lineTo(cx + 34, 156);
    ctx.lineTo(cx + 44, 176);
    ctx.moveTo(cx - 60, 120);
    ctx.lineTo(cx - 44, 134);
    outline(ctx, 4);
  });
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.shadowColor = "#ffe14d";
    ctx.shadowBlur = 16;
    ellipse(ctx, cx + dir * 30, 118, 14, 10, dir * -0.25);
    fill(ctx, "#ffe14d");
    ctx.restore();
    ellipse(ctx, cx + dir * 30, 118, 14, 10, dir * -0.25);
    outline(ctx, 4);
    ctx.beginPath();
    ctx.moveTo(cx + dir * 50, 96);
    ctx.lineTo(cx + dir * 14, 106);
    outline(ctx, 8);
  }
  ctx.beginPath();
  ctx.moveTo(cx - 30, 156);
  ctx.lineTo(cx + 30, 156);
  outline(ctx, 7);
  // crown
  const y = 54;
  ctx.beginPath();
  ctx.moveTo(cx - 40, y + 8);
  ctx.lineTo(cx - 46, y - 30);
  ctx.lineTo(cx - 22, y - 10);
  ctx.lineTo(cx, y - 40);
  ctx.lineTo(cx + 22, y - 10);
  ctx.lineTo(cx + 46, y - 30);
  ctx.lineTo(cx + 40, y + 8);
  ctx.closePath();
  fillOutline(ctx, linear(ctx, 0, y - 40, 0, y + 8, [[0, "#fff3a0"], [1, "#f0a400"]]), 5);
  for (const [dx, c] of [[-22, "#ff4f6d"], [0, "#4fc3ff"], [22, "#5ef08a"]] as [number, string][]) {
    circle(ctx, cx + dx, y - 2, 6);
    fillOutline(ctx, c, 3);
  }
}

// ───────────────────────── textures ─────────────────────────

export function makeCharacterTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "hero", HERO_W, HERO_H, drawHero);
  canvasTexture(scene, "gun", 142, 64, drawGun);
  canvasTexture(scene, "e_slime", 132, 128, drawEvilSlime);
  canvasTexture(scene, "e_mush", 128, 146, drawMushroom);
  canvasTexture(scene, "e_bat", 160, 96, drawBat);
  canvasTexture(scene, "e_golem", 240, 236, drawGolem);

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
