import Phaser from "phaser";
import { DICE_TIERS, TIER_INFO, Tier, tierIndex } from "../data/tiers";
import { FONT } from "../ui/widgets";
import { makeSkillTextures } from "./skills";
import { INK, Ctx, canvasTexture, circle, darken, ellipse, fill, fillOutline, lighten, linear, outline, radial, rgba, rr, starPath } from "./draw";

/** Bones and meat (XP), dice of every tier, airdrops, map power-ups and skill icons. */

/** XP glows: a soft green light with a twinkle, so bones and meat read as experience. */
function xpGlow(ctx: Ctx, x: number, y: number, r: number): void {
  circle(ctx, x, y, r);
  fill(ctx, radial(ctx, x, y, r, [[0, "rgba(150,255,200,0.8)"], [0.5, "rgba(120,255,180,0.35)"], [1, "rgba(120,255,180,0)"]]));
  starPath(ctx, x + r * 0.55, y - r * 0.5, r * 0.2, 0.3, 4, 0);
  fill(ctx, "rgba(255,255,255,0.95)");
}

/** A little bone (small XP). Thick outline so it reads on any ground. */
function bone(ctx: Ctx): void {
  ctx.save();
  ctx.translate(32, 22);
  ctx.rotate(-0.3);
  const path = () => {
    ctx.beginPath();
    rr(ctx, -16, -5, 32, 10, 4);
    for (const [x, y] of [[-17, -6], [-17, 6], [17, -6], [17, 6]]) {
      ctx.moveTo(x + 7.5, y);
      ctx.arc(x, y, 7.5, 0, Math.PI * 2);
    }
  };
  path();
  ctx.lineWidth = 9;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = "#e8d8b8";
  ctx.fill();
  ctx.translate(-1.5, -2);
  path();
  ctx.fillStyle = "#fffaf0";
  ctx.fill();
  ctx.restore();
}

/** A drumstick (more XP), or a big ham from elites. */
function meat(big: boolean) {
  return (ctx: Ctx) => {
    const s = big ? 1.35 : 1;
    ctx.save();
    ctx.scale(s, s);
    // bone handle
    ctx.beginPath();
    rr(ctx, 6, 22, 20, 9, 4);
    ctx.moveTo(12, 21);
    ctx.arc(7, 21, 6, 0, Math.PI * 2);
    ctx.moveTo(12, 32);
    ctx.arc(7, 32, 6, 0, Math.PI * 2);
    ctx.lineWidth = 7;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = "#fff6e2";
    ctx.fill();
    // the meat
    ctx.beginPath();
    ctx.ellipse(39, 26, 18, 15, -0.2, 0, Math.PI * 2);
    fillOutline(ctx, linear(ctx, 0, 11, 0, 41, [[0, "#ffa07a"], [1, "#b8442e"]]), 5);
    ellipse(ctx, 35, 19, 7, 4, -0.4);
    fill(ctx, "rgba(255,255,255,0.6)");
    ctx.restore();
  };
}

/** A die in its tier colour with the tier letter on it. */
/**
 * A tier die as a little 3D cube: a front face with the tier letter, a lit top with two pips and a
 * shaded side, all in the tier colour; S and better get a gold rim and sparkles.
 */
function tierDie(t: Tier) {
  return (ctx: Ctx) => {
    const { color } = TIER_INFO[t];
    const rich = tierIndex(t) >= 5;
    const rim = rich ? "#ffd23f" : INK;
    const f = 50;
    const d = 15;
    const x0 = 8;
    const y0 = 8 + d + 4;
    ctx.lineJoin = "round";
    // a soft shadow on the ground
    ellipse(ctx, x0 + f / 2 + 6, y0 + f + 2, 30, 6, 0);
    fill(ctx, "rgba(0,0,0,0.25)");
    const face = (pts: [number, number][], paint: string | CanvasGradient) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = paint;
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
    };
    // top
    face([[x0, y0], [x0 + d, y0 - d], [x0 + d + f, y0 - d], [x0 + f, y0]], rgba(lighten(color, 0.6)));
    // side
    face([[x0 + f, y0], [x0 + f + d, y0 - d], [x0 + f + d, y0 - d + f], [x0 + f, y0 + f]], rgba(darken(color, 0.3)));
    // front
    rr(ctx, x0, y0, f, f, 8);
    ctx.fillStyle = t === "uSSS"
      ? linear(ctx, x0, y0, x0 + f, y0 + f, [[0, "#ff7a9a"], [0.25, "#ffd23f"], [0.5, "#7af07a"], [0.75, "#5ac8ff"], [1, "#b36aff"]])
      : linear(ctx, x0, y0, x0 + f, y0 + f, [[0, rgba(lighten(color, 0.4))], [1, rgba(color)]]);
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    if (rich) {
      rr(ctx, x0 + 3, y0 + 3, f - 6, f - 6, 6);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = rim;
      ctx.stroke();
    }
    // gloss on the front
    ellipse(ctx, x0 + 14, y0 + 10, 9, 4, -0.5);
    fill(ctx, "rgba(255,255,255,0.6)");
    // two pips on the top (squashed by the angle) and one on the side
    for (const k of [0.3, 0.7]) {
      ellipse(ctx, x0 + d / 2 + f * k, y0 - d / 2, 4.5, 2.2, 0);
      fill(ctx, "#ffffff");
    }
    ellipse(ctx, x0 + f + d / 2, y0 - d / 2 + f / 2, 2.4, 4.5, 0);
    fill(ctx, "rgba(255,255,255,0.75)");
    // the tier letter
    const size = t.length >= 4 ? 16 : t.length === 3 ? 19 : 30;
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 5;
    ctx.strokeStyle = INK;
    ctx.strokeText(t, x0 + f / 2, y0 + f / 2 + 1);
    ctx.fillStyle = rich ? "#fff3a0" : "#ffffff";
    ctx.fillText(t, x0 + f / 2, y0 + f / 2 + 1);
    if (rich) {
      // sparkles
      for (const [sx, sy, r] of [[70, 12, 5], [6, 60, 4], [72, 56, 3]]) {
        ctx.beginPath();
        ctx.moveTo(sx, sy - r * 2);
        ctx.lineTo(sx + r * 0.5, sy - r * 0.5);
        ctx.lineTo(sx + r * 2, sy);
        ctx.lineTo(sx + r * 0.5, sy + r * 0.5);
        ctx.lineTo(sx, sy + r * 2);
        ctx.lineTo(sx - r * 0.5, sy + r * 0.5);
        ctx.lineTo(sx - r * 2, sy);
        ctx.lineTo(sx - r * 0.5, sy - r * 0.5);
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
    }
  };
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
    ctx.arc(40, 38, 22, Math.PI, 0, false);
    ctx.moveTo(18, 38);
    ctx.lineTo(18, 66);
    ctx.moveTo(62, 38);
    ctx.lineTo(62, 66);
    ctx.lineWidth = w;
    ctx.strokeStyle = c;
    ctx.stroke();
  }
  for (const x of [18, 62]) {
    rr(ctx, x - 10, 56, 20, 13, 2);
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

/** The claw that comes out of the storm and carries the crystal away. */
function claw(shut: boolean) {
  return (ctx: Ctx) => {
    const cx = 120;
    // the arm, hanging from the sky
    ctx.beginPath();
    ctx.moveTo(cx - 34, 0);
    ctx.lineTo(cx + 34, 0);
    ctx.lineTo(cx + 40, 330);
    ctx.lineTo(cx - 40, 330);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, cx - 40, 0, cx + 40, 0, [[0, "#3a2a4a"], [0.45, "#6a4f86"], [1, "#2a1e36"]]), 6);
    for (let y = 40; y < 330; y += 48) {
      rr(ctx, cx - 44, y, 88, 16, 6);
      fillOutline(ctx, "#8a6aa8", 4);
    }
    // the hand
    ctx.beginPath();
    ctx.ellipse(cx, 360, 62, 46, 0, 0, Math.PI * 2);
    fillOutline(ctx, radial(ctx, cx - 18, 344, 70, [[0, "#8a6aa8"], [1, "#3a2a4a"]]), 6);
    // three big claws
    for (const k of [-1, 0, 1]) {
      const spread = shut ? 0.25 : 0.75;
      const a = Math.PI / 2 + k * spread;
      const bx = cx + k * 40;
      const by = 390;
      const tipX = bx + Math.cos(a) * 90 - (shut ? k * 30 : 0);
      const tipY = by + Math.sin(a) * 110;
      ctx.beginPath();
      ctx.moveTo(bx - 14, by - 6);
      ctx.quadraticCurveTo(bx + Math.cos(a) * 40 - 18, by + 60, tipX, tipY);
      ctx.quadraticCurveTo(bx + Math.cos(a) * 40 + 18, by + 50, bx + 14, by - 6);
      ctx.closePath();
      fillOutline(ctx, linear(ctx, 0, by, 0, tipY, [[0, "#e8e0f0"], [1, "#9a8aa8"]]), 5);
    }
    // glowing eyes on the back of the hand: it is alive
    for (const x of [cx - 22, cx + 22]) {
      ellipse(ctx, x, 352, 9, 6);
      fill(ctx, "#ff3a5a");
      ellipse(ctx, x - 2, 350, 3, 2);
      fill(ctx, "#ffd0d8");
    }
  };
}

/** A dark storm cloud. */
function storm(ctx: Ctx): void {
  const puffs: [number, number, number][] = [[90, 150, 80], [190, 110, 100], [310, 100, 110], [420, 130, 90], [500, 160, 60], [260, 170, 90], [140, 180, 60], [380, 180, 70]];
  for (const [x, y, r] of puffs) {
    circle(ctx, x, y, r + 5);
    fill(ctx, INK);
  }
  for (const [x, y, r] of puffs) {
    circle(ctx, x, y, r);
    fill(ctx, radial(ctx, x - r * 0.3, y - r * 0.4, r * 1.3, [[0, "#7a6a8a"], [1, "#2e2638"]]));
  }
}

/** A crystal shard (tinted per land) for the Crystal Shards skill. */
function shard(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(18, 2);
  ctx.lineTo(32, 26);
  ctx.lineTo(18, 58);
  ctx.lineTo(4, 26);
  ctx.closePath();
  fillOutline(ctx, linear(ctx, 0, 2, 0, 58, [[0, "#ffffff"], [1, "#c8c8d8"]]), 4);
  ctx.beginPath();
  ctx.moveTo(18, 8);
  ctx.lineTo(24, 26);
  ctx.lineTo(18, 30);
  ctx.closePath();
  fill(ctx, "rgba(255,255,255,0.9)");
}

/** Military supply crate. */
function crate(ctx: Ctx): void {
  rr(ctx, 8, 22, 104, 74, 8);
  fillOutline(ctx, linear(ctx, 0, 22, 0, 96, [[0, "#7c9452"], [1, "#4a5e30"]]), 6);
  rr(ctx, 8, 22, 104, 16, 6);
  fillOutline(ctx, "#8aa45c", 5);
  for (const x of [24, 96]) {
    rr(ctx, x - 6, 36, 12, 60, 2);
    fillOutline(ctx, "#5a6e3a", 4);
  }
  rr(ctx, 38, 52, 44, 24, 4);
  fillOutline(ctx, "#ffd23f", 4);
  ctx.font = `20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = INK;
  ctx.fillText("GUN", 60, 65);
  ellipse(ctx, 30, 28, 12, 3, 0);
  fill(ctx, "rgba(255,255,255,0.4)");
}

function parachute(ctx: Ctx): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const x of [22, 60, 100, 138]) {
    ctx.moveTo(x, 58);
    ctx.lineTo(80, 128);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10, 62);
  ctx.quadraticCurveTo(14, 6, 80, 6);
  ctx.quadraticCurveTo(146, 6, 150, 62);
  for (let i = 4; i >= 0; i--) ctx.quadraticCurveTo(10 + i * 35 + 17, 48, 10 + i * 35, 62);
  ctx.closePath();
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? "#ffffff" : "#ff5a5a";
    ctx.beginPath();
    ctx.moveTo(80, 0);
    ctx.lineTo(i * 35 - 5, 70);
    ctx.lineTo(i * 35 + 30, 70);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(0, 10, 160, 10);
  ctx.restore();
}

/** The bubble that protects the crystal. */
function shield(ctx: Ctx): void {
  const g = ctx.createRadialGradient(150, 150, 60, 150, 150, 146);
  g.addColorStop(0, "rgba(120,220,255,0.05)");
  g.addColorStop(0.8, "rgba(120,220,255,0.25)");
  g.addColorStop(1, "rgba(200,245,255,0.75)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(150, 150, 146, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(220,250,255,0.9)";
  ctx.lineWidth = 5;
  ctx.stroke();
  // honeycomb sheen
  ctx.save();
  ctx.beginPath();
  ctx.arc(150, 150, 144, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  const r = 22;
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 10; col++) {
      const x = col * r * 1.75 + (row % 2) * r * 0.87;
      const y = row * r * 1.5 * 0.87;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        ctx[k ? "lineTo" : "moveTo"](x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
  ellipse(ctx, 100, 70, 46, 16, -0.6);
  fill(ctx, "rgba(255,255,255,0.35)");
}


export function makePickupTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "xp_bone", 100, 84, (ctx) => {
    xpGlow(ctx, 50, 42, 46);
    ctx.translate(18, 20);
    bone(ctx);
  });
  canvasTexture(scene, "xp_meat", 100, 88, (ctx) => {
    xpGlow(ctx, 50, 44, 48);
    ctx.translate(19, 19);
    meat(false)(ctx);
  });
  canvasTexture(scene, "xp_ham", 134, 114, (ctx) => {
    xpGlow(ctx, 67, 57, 64);
    ctx.translate(25, 24);
    meat(true)(ctx);
  });
  canvasTexture(scene, "sky_claw", 240, 520, claw(false));
  canvasTexture(scene, "sky_claw_shut", 240, 520, claw(true));
  canvasTexture(scene, "storm", 590, 270, storm);
  canvasTexture(scene, "shard", 36, 60, shard);
  for (const t of DICE_TIERS) canvasTexture(scene, `die_${t}`, 80, 80, tierDie(t));
  canvasTexture(scene, "pk_heart", 80, 80, heart);
  canvasTexture(scene, "pk_magnet", 80, 80, magnet);
  canvasTexture(scene, "pk_bomb", 80, 80, bomb);
  canvasTexture(scene, "pk_freeze", 80, 80, freeze);
  canvasTexture(scene, "skill_orb", 110, 110, skillOrb);
  canvasTexture(scene, "airdrop", 120, 104, crate);
  canvasTexture(scene, "parachute", 160, 132, parachute);
  canvasTexture(scene, "shield", 300, 300, shield);
  makeSkillTextures(scene);
  canvasTexture(scene, "sk_luck", 240, 240, (ctx) => {
    ctx.scale(2, 2);
    ctx.save();
    ctx.translate(14, 4);
    ctx.scale(0.58, 0.58);
    parachute(ctx);
    ctx.restore();
    ctx.save();
    ctx.translate(26, 62);
    ctx.scale(0.58, 0.52);
    crate(ctx);
    ctx.restore();
  });
}
