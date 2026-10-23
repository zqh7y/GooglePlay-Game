import Phaser from "phaser";
import { DICE_TIERS, TIER_INFO, Tier } from "../data/tiers";
import { FONT } from "../ui/widgets";
import { INK, Ctx, canvasTexture, circle, darken, ellipse, fill, fillOutline, lighten, linear, outline, radial, rgba, rr, starPath } from "./draw";

/** Bones and meat (XP), dice of every tier, airdrops, map power-ups and skill icons. */

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
function tierDie(t: Tier) {
  return (ctx: Ctx) => {
    const { color } = TIER_INFO[t];
    ctx.save();
    ctx.translate(40, 40);
    ctx.rotate(-0.15);
    rr(ctx, -30, -30, 60, 64, 14);
    fill(ctx, INK);
    rr(ctx, -26, -26, 52, 54, 11);
    fill(ctx, rgba(darken(color, 0.3)));
    rr(ctx, -26, -26, 52, 48, 11);
    fill(ctx, linear(ctx, 0, -26, 0, 22, [[0, rgba(lighten(color, 0.55))], [1, rgba(color)]]));
    ellipse(ctx, -12, -16, 9, 4, -0.4);
    fill(ctx, "rgba(255,255,255,0.6)");
    const size = t.length >= 4 ? 18 : t.length === 3 ? 22 : 34;
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.strokeText(t, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(t, 0, 0);
    ctx.restore();
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

/** Skill icon glyphs (drawn on a 120 x 120 canvas, centred). */
const GLYPHS: Record<string, (ctx: Ctx) => void> = {
  damage: (ctx) => {
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
  firerate: (ctx) => {
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
  mag: (ctx) => {
    for (let i = 0; i < 3; i++) {
      rr(ctx, 40 + i * 14, 12, 11, 22, 5);
      fillOutline(ctx, "#ffd23f", 3);
    }
    ctx.beginPath();
    ctx.moveTo(36, 30);
    ctx.lineTo(84, 30);
    ctx.quadraticCurveTo(84, 80, 98, 106);
    ctx.lineTo(56, 108);
    ctx.quadraticCurveTo(40, 80, 36, 30);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, 30, 0, 108, [[0, "#6a7280"], [1, "#2e323c"]]), 5);
    for (const y of [52, 72]) {
      ctx.beginPath();
      ctx.moveTo(48, y);
      ctx.lineTo(80, y);
      outline(ctx, 3, "rgba(255,255,255,0.3)");
    }
  },
  reload: (ctx) => {
    ctx.lineCap = "round";
    for (const [w, c] of [[18, INK], [10, "#7ad651"]] as [number, string][]) {
      ctx.beginPath();
      ctx.arc(60, 60, 36, -0.4, Math.PI * 1.6);
      ctx.lineWidth = w;
      ctx.strokeStyle = c;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(104, 34);
    ctx.lineTo(96, 66);
    ctx.lineTo(70, 46);
    ctx.closePath();
    fillOutline(ctx, "#7ad651", 5);
    rr(ctx, 50, 44, 20, 34, 9);
    fillOutline(ctx, "#ffd23f", 4);
  },
  range: (ctx) => {
    circle(ctx, 60, 60, 38);
    fillOutline(ctx, "rgba(90,200,255,0.35)", 6);
    circle(ctx, 60, 60, 18);
    outline(ctx, 5);
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of [[60, 14, 60, 40], [60, 80, 60, 106], [14, 60, 40, 60], [80, 60, 106, 60]]) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    outline(ctx, 6);
    circle(ctx, 60, 60, 5);
    fill(ctx, "#ff4a4a");
  },
  boom: (ctx) => {
    starPath(ctx, 60, 62, 48, 0.55, 10);
    fillOutline(ctx, linear(ctx, 0, 14, 0, 110, [[0, "#ffe066"], [1, "#ff5a3a"]]), 6);
    starPath(ctx, 60, 62, 24, 0.55, 8);
    fill(ctx, "#fff6c8");
  },
  mend: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(48, 20);
    ctx.lineTo(70, 20);
    ctx.lineTo(82, 52);
    ctx.lineTo(60, 104);
    ctx.lineTo(36, 52);
    ctx.closePath();
    fillOutline(ctx, linear(ctx, 0, 20, 0, 104, [[0, "#c8f4ff"], [1, "#3a9ae8"]]), 5);
    rr(ctx, 74, 66, 36, 12, 4);
    fillOutline(ctx, "#7ad651", 4);
    rr(ctx, 86, 54, 12, 36, 4);
    fillOutline(ctx, "#7ad651", 4);
  },
  shards: (ctx) => {
    for (const [x, y, r, sc] of [[40, 64, -0.5, 1], [76, 50, 0.4, 1.15], [62, 92, 0.1, 0.8]] as [number, number, number, number][]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r);
      ctx.scale(sc, sc);
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(14, -4);
      ctx.lineTo(0, 30);
      ctx.lineTo(-14, -4);
      ctx.closePath();
      fillOutline(ctx, linear(ctx, 0, -30, 0, 30, [[0, "#f2e6ff"], [1, "#9a6aff"]]), 5);
      ctx.restore();
    }
  },
  fort: (ctx) => {
    rr(ctx, 18, 44, 84, 62, 6);
    fillOutline(ctx, linear(ctx, 0, 44, 0, 106, [[0, "#e0b07a"], [1, "#b07a46"]]), 5);
    for (const x of [18, 46, 74]) {
      rr(ctx, x, 30, 20, 20, 3);
      fillOutline(ctx, "#d8a46c", 4);
    }
    rr(ctx, 54, 60, 12, 46, 2);
    fill(ctx, "rgba(255,240,200,0.6)");
    ctx.beginPath();
    ctx.moveTo(60, 30);
    ctx.lineTo(60, 8);
    outline(ctx, 4);
    ctx.beginPath();
    ctx.moveTo(60, 8);
    ctx.lineTo(84, 14);
    ctx.lineTo(60, 20);
    ctx.closePath();
    fillOutline(ctx, "#ff5a5a", 3);
  },
};

export function makePickupTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "xp_bone", 64, 44, bone);
  canvasTexture(scene, "xp_meat", 62, 50, meat(false));
  canvasTexture(scene, "xp_ham", 84, 66, meat(true));
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
  for (const [id, draw] of Object.entries(GLYPHS)) canvasTexture(scene, `sk_${id}`, 120, 120, draw);
  canvasTexture(scene, "sk_luck", 120, 120, (ctx) => {
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
