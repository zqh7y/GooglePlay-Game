import Phaser from "phaser";
import { box } from "./pets";
import {
  Ctx, INK, boltPath, canvasTexture, celShape, circle, ellipse, fill, fillOutline, linear, outline, radial,
  starPath, strokeShape, twinkle,
} from "./draw";

// ───────────────────────── hero ─────────────────────────

export const HERO_W = 190;
export const HERO_H = 200;
/** Where the gun is held, relative to the hero's feet (origin 0.5, 0.95). */
export const HERO_HAND = { x: 46, y: -62 };

function drawHero(ctx: Ctx, step: number): void {
  const base = "#ffa64d";
  const dark = "#e9853a";
  const cream = "#fff3dc";
  const cx = 95;
  const block = (x: number, y: number, w: number, h: number, r: number, b = base, d = dark, deco?: () => void) =>
    celShape(ctx, () => box(ctx, x, y, w, h, r), b, d, Math.min(w, h) / 2, () => {
      deco?.();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(x - w / 2, y - h / 2, w, h * 0.16);
    });
  ellipse(ctx, cx, 192, 60, 8);
  fill(ctx, "rgba(74,47,29,0.22)");

  // headband tails flutter behind
  for (const [dy, len] of [[0, 1], [14, 0.8]]) {
    ctx.beginPath();
    ctx.moveTo(cx - 56, 62 + dy * 0.3);
    ctx.lineTo(cx - 92 + (1 - len) * 26, 56 + dy);
    ctx.lineTo(cx - 88 + (1 - len) * 26, 72 + dy);
    ctx.lineTo(cx - 54, 76 + dy * 0.3);
    ctx.closePath();
    fillOutline(ctx, "#e8434f", 4.5);
  }
  strokeShape(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(cx + 40, 170);
    ctx.lineTo(cx + 78, 170);
    ctx.lineTo(cx + 78, 122);
  }, 15, base);

  // legs (walk cycle)
  const lift = [0, -7, 7][step];
  for (const [x, dy] of [[cx - 22, lift], [cx + 22, -lift]]) {
    box(ctx, x, 182 + Math.min(0, dy), 26, 22 + Math.abs(dy) * 0.3, 7);
    fillOutline(ctx, cream, 4.5);
  }

  block(cx, 152, 104, 56, 20);
  box(ctx, cx, 158, 54, 34, 12);
  fill(ctx, cream);

  for (const dir of [-1, 1]) {
    celShape(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 68, 64);
      ctx.lineTo(cx + dir * 58, 12);
      ctx.lineTo(cx + dir * 20, 40);
      ctx.closePath();
    }, base, dark, 24);
    ctx.beginPath();
    ctx.moveTo(cx + dir * 60, 56);
    ctx.lineTo(cx + dir * 55, 28);
    ctx.lineTo(cx + dir * 34, 44);
    ctx.closePath();
    fill(ctx, "rgba(255,150,180,0.9)");
  }

  block(cx, 86, 142, 110, 32, base, dark, () => {
    for (const dx of [-18, 0, 18]) {
      ctx.fillStyle = dark;
      ctx.fillRect(cx + dx - 4, 32, 8, 20);
    }
    for (const dir of [-1, 1]) {
      for (const dy of [0, 14]) {
        ctx.fillStyle = dark;
        ctx.fillRect(dir < 0 ? cx - 71 : cx + 55, 90 + dy, 16, 7);
      }
    }
    box(ctx, cx, 116, 64, 30, 12);
    fill(ctx, cream);
  });

  // headband
  ctx.beginPath();
  ctx.moveTo(cx - 71, 58);
  ctx.lineTo(cx + 71, 58);
  ctx.lineTo(cx + 71, 74);
  ctx.lineTo(cx - 71, 74);
  ctx.closePath();
  fillOutline(ctx, "#e8434f", 4.5);
  box(ctx, cx, 66, 26, 14, 4);
  fillOutline(ctx, "#ffd23f", 3.5);

  // face
  for (const dir of [-1, 1]) {
    box(ctx, cx + dir * 26, 96, 17, 24, 7);
    fill(ctx, INK);
    box(ctx, cx + dir * 26 + 3, 90, 7, 8, 2.5);
    fill(ctx, "#ffffff");
    ctx.beginPath();
    ctx.moveTo(cx + dir * 38, 80);
    ctx.lineTo(cx + dir * 15, 85);
    outline(ctx, 6);
    box(ctx, cx + dir * 46, 112, 20, 10, 5);
    fill(ctx, "rgba(255,120,150,0.45)");
  }
  box(ctx, cx, 108, 12, 8, 3);
  fill(ctx, "#ff8fae");
  ctx.beginPath();
  ctx.moveTo(cx - 11, 116);
  ctx.lineTo(cx - 5, 121);
  ctx.lineTo(cx, 116);
  ctx.lineTo(cx + 5, 121);
  ctx.lineTo(cx + 11, 116);
  outline(ctx, 3.5);
  box(ctx, cx - 44, 48, 20, 9, 4);
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
  ellipse(ctx, cx, 118, 54, 8);
  fill(ctx, "rgba(74,47,29,0.22)");
  celShape(ctx, () => box(ctx, cx, 70, 116, 92, 28), "#a46cf0", "#7f4cc8", 46, () => {
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(cx - 58, 24, 116, 14);
  });
  box(ctx, cx - 32, 40, 18, 9, 4);
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
  canvasTexture(scene, "hero", HERO_W, HERO_H, (ctx) => drawHero(ctx, 0));
  canvasTexture(scene, "hero_w1", HERO_W, HERO_H, (ctx) => drawHero(ctx, 1));
  canvasTexture(scene, "hero_w2", HERO_W, HERO_H, (ctx) => drawHero(ctx, 2));
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
