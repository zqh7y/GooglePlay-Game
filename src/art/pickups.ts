import Phaser from "phaser";
import { INK, Ctx, boltPath, canvasTexture, circle, ellipse, fill, fillOutline, linear, outline, radial, rr, starPath } from "./draw";

/** XP gems, dice tokens, map power-ups and skill icons. */

function xpGem(top: string, bottom: string) {
  return (ctx: Ctx) => {
    ctx.beginPath();
    ctx.moveTo(24, 4);
    ctx.lineTo(42, 22);
    ctx.lineTo(24, 52);
    ctx.lineTo(6, 22);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, 4, 0, 52, [[0, top], [1, bottom]]), 4);
    ctx.beginPath();
    ctx.moveTo(15, 20);
    ctx.lineTo(24, 10);
    ctx.lineTo(28, 20);
    ctx.closePath();
    fill(ctx, "rgba(255,255,255,0.7)");
  };
}

/** A little die lying on the ground (what rolls cost). */
function diceToken(ctx: Ctx): void {
  ctx.save();
  ctx.translate(40, 40);
  ctx.rotate(-0.2);
  rr(ctx, -28, -28, 56, 60, 14);
  fill(ctx, INK);
  rr(ctx, -24, -24, 48, 50, 11);
  fill(ctx, "#ffb84a");
  rr(ctx, -24, -24, 48, 44, 11);
  fill(ctx, "#fff6d8");
  for (const [x, y] of [[-11, -11], [11, -11], [0, -2], [-11, 8], [11, 8]]) {
    circle(ctx, x, y, 5);
    fill(ctx, x === 0 ? "#e8434f" : INK);
  }
  ctx.restore();
}

function heart(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(40, 68);
  ctx.bezierCurveTo(4, 44, 6, 12, 26, 12);
  ctx.bezierCurveTo(34, 12, 40, 20, 40, 24);
  ctx.bezierCurveTo(40, 20, 46, 12, 54, 12);
  ctx.bezierCurveTo(74, 12, 76, 44, 40, 68);
  ctx.closePath();
  fillOutline(ctx, linear(ctx, 0, 12, 0, 68, [[0, "#ff8aa6"], [1, "#e8434f"]]), 5);
  ellipse(ctx, 24, 26, 8, 5, -0.6);
  fill(ctx, "rgba(255,255,255,0.75)");
}

function magnet(ctx: Ctx): void {
  ctx.lineCap = "butt";
  for (const [w, c] of [[30, INK], [20, "#e8434f"]] as [number, string][]) {
    ctx.beginPath();
    ctx.arc(40, 36, 22, Math.PI, 0, true);
    ctx.moveTo(18, 36);
    ctx.lineTo(18, 64);
    ctx.moveTo(62, 36);
    ctx.lineTo(62, 64);
    ctx.lineWidth = w;
    ctx.strokeStyle = c;
    ctx.stroke();
  }
  for (const x of [18, 62]) {
    rr(ctx, x - 10, 54, 20, 14, 2);
    fill(ctx, "#e8ecf2");
  }
}

function bomb(ctx: Ctx): void {
  circle(ctx, 38, 46, 26);
  fillOutline(ctx, radial(ctx, 30, 38, 30, [[0, "#6a6a7a"], [1, "#2a2a36"]]), 5);
  rr(ctx, 44, 14, 16, 14, 4);
  fillOutline(ctx, "#8a8a9a", 4);
  ctx.beginPath();
  ctx.moveTo(54, 14);
  ctx.quadraticCurveTo(62, 2, 72, 8);
  outline(ctx, 4);
  starPath(ctx, 72, 8, 9, 0.45, 6);
  fill(ctx, "#ffd23f");
  ellipse(ctx, 28, 36, 7, 4, -0.6);
  fill(ctx, "rgba(255,255,255,0.5)");
}

function freeze(ctx: Ctx): void {
  ctx.lineCap = "round";
  for (const [w, c] of [[14, INK], [7, "#bfefff"]] as [number, string][]) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      const [dx, dy] = [Math.cos(a) * 30, Math.sin(a) * 30];
      ctx.moveTo(40 - dx, 40 - dy);
      ctx.lineTo(40 + dx, 40 + dy);
      for (const s of [1, -1]) {
        const [bx, by] = [40 + s * dx * 0.6, 40 + s * dy * 0.6];
        for (const t of [0.6, -0.6]) {
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a + (s > 0 ? 0 : Math.PI) + t * 1.4) * 11, by + Math.sin(a + (s > 0 ? 0 : Math.PI) + t * 1.4) * 11);
        }
      }
    }
    ctx.lineWidth = w;
    ctx.strokeStyle = c;
    ctx.stroke();
  }
}

/** A floating orb that grants a free skill. */
function skillOrb(ctx: Ctx): void {
  circle(ctx, 55, 55, 52);
  fill(ctx, radial(ctx, 55, 55, 52, [[0.55, "rgba(255,230,120,0.6)"], [1, "rgba(255,230,120,0)"]]));
  circle(ctx, 55, 55, 34);
  fillOutline(ctx, radial(ctx, 45, 42, 40, [[0, "#fff6c8"], [0.6, "#ffcf3a"], [1, "#ff9a2a"]]), 5);
  starPath(ctx, 55, 57, 20);
  fillOutline(ctx, "#ffffff", 4);
}

/** Skill icon glyphs (drawn on a 120 x 120 canvas, centred). */
const GLYPHS: Record<string, (ctx: Ctx) => void> = {
  power: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(30, 70);
    ctx.lineTo(70, 30);
    ctx.lineTo(92, 26);
    ctx.lineTo(88, 48);
    ctx.lineTo(48, 88);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 30, 90, 90, 30, [[0, "#ff8a3a"], [1, "#ffe066"]]), 6);
    for (const [x, y] of [[26, 94], [18, 80], [40, 102]]) {
      circle(ctx, x, y, 6);
      fillOutline(ctx, "#ffd23f", 4);
    }
  },
  rapid: (ctx) => {
    for (const y of [36, 60, 84]) {
      rr(ctx, 22 + (y - 36) / 3, y - 9, 56, 18, 9);
      fillOutline(ctx, "#ffd23f", 5);
      ctx.beginPath();
      ctx.moveTo(84 + (y - 36) / 3, y);
      ctx.lineTo(70 + (y - 36) / 3, y - 9);
      ctx.lineTo(70 + (y - 36) / 3, y + 9);
      ctx.closePath();
      fillOutline(ctx, "#ff8a3a", 4);
    }
  },
  multi: (ctx) => {
    for (const a of [-0.55, 0, 0.55]) {
      ctx.save();
      ctx.translate(30, 86);
      ctx.rotate(-Math.PI / 4 + a);
      rr(ctx, 0, -8, 64, 16, 8);
      fillOutline(ctx, "#b6f08a", 5);
      ctx.restore();
    }
  },
  orbit: (ctx) => {
    ctx.beginPath();
    ctx.arc(60, 60, 34, 0, Math.PI * 2);
    outline(ctx, 4, "rgba(74,47,29,0.4)");
    circle(ctx, 60, 60, 12);
    fillOutline(ctx, "#ffffff", 5);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      starPath(ctx, 60 + Math.cos(a) * 34, 60 + Math.sin(a) * 34, 15, 0.4, 4, a);
      fillOutline(ctx, "#bfefff", 4);
    }
  },
  lightning: (ctx) => {
    boltPath(ctx, 60, 60, 46);
    fillOutline(ctx, "#fff35c", 6);
  },
  aura: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(60, 14);
    ctx.bezierCurveTo(96, 50, 96, 104, 60, 104);
    ctx.bezierCurveTo(24, 104, 24, 60, 44, 40);
    ctx.bezierCurveTo(46, 56, 52, 60, 56, 60);
    ctx.bezierCurveTo(50, 40, 58, 24, 60, 14);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, 14, 0, 104, [[0, "#ffe066"], [1, "#ff5a3a"]]), 6);
    ellipse(ctx, 60, 84, 12, 16);
    fill(ctx, "#fff3a8");
  },
  rocket: (ctx) => {
    ctx.save();
    ctx.translate(60, 60);
    ctx.rotate(-Math.PI / 4);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-20, 12 * s);
      ctx.lineTo(-34, 26 * s);
      ctx.lineTo(-30, 6 * s);
      ctx.closePath();
      fillOutline(ctx, "#e8434f", 4);
    }
    ctx.beginPath();
    ctx.moveTo(42, 0);
    ctx.quadraticCurveTo(26, -16, -28, -13);
    ctx.lineTo(-28, 13);
    ctx.quadraticCurveTo(26, 16, 42, 0);
    ctx.closePath();
    fillOutline(ctx, "#f2f4f8", 5);
    circle(ctx, 12, 0, 7);
    fillOutline(ctx, "#5ac8ff", 3);
    ellipse(ctx, -38, 0, 10, 7);
    fill(ctx, "#ffb347");
    ctx.restore();
  },
};

export function makePickupTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "xp_s", 48, 56, xpGem("#a8f0ff", "#2f9ae8"));
  canvasTexture(scene, "xp_m", 48, 56, xpGem("#c8ffb0", "#3fb84a"));
  canvasTexture(scene, "xp_l", 48, 56, xpGem("#ffd0ff", "#a24ae8"));
  canvasTexture(scene, "dice_token", 80, 80, diceToken);
  canvasTexture(scene, "pk_heart", 80, 80, heart);
  canvasTexture(scene, "pk_magnet", 80, 80, magnet);
  canvasTexture(scene, "pk_bomb", 80, 80, bomb);
  canvasTexture(scene, "pk_freeze", 80, 80, freeze);
  canvasTexture(scene, "skill_orb", 110, 110, skillOrb);
  for (const [id, draw] of Object.entries(GLYPHS)) canvasTexture(scene, `sk_${id}`, 120, 120, draw);
  // an orbiting blade and a rocket for the skills in action
  canvasTexture(scene, "blade", 64, 64, (ctx) => {
    starPath(ctx, 32, 32, 28, 0.38, 4);
    fillOutline(ctx, linear(ctx, 0, 0, 64, 64, [[0, "#ffffff"], [1, "#8ad8ff"]]), 4);
    circle(ctx, 32, 32, 6);
    fill(ctx, INK);
  });
  canvasTexture(scene, "rocket", 90, 40, (ctx) => {
    ctx.translate(46, 20);
    ctx.beginPath();
    ctx.moveTo(38, 0);
    ctx.quadraticCurveTo(22, -13, -26, -11);
    ctx.lineTo(-26, 11);
    ctx.quadraticCurveTo(22, 13, 38, 0);
    ctx.closePath();
    fillOutline(ctx, "#f2f4f8", 4);
    rr(ctx, -28, -14, 12, 28, 3);
    fillOutline(ctx, "#e8434f", 3);
    ellipse(ctx, -36, 0, 8, 6);
    fill(ctx, "#ffb347");
  });
}
