import Phaser from "phaser";
import { BOSS_ART } from "./bossart";
import { Ctx, canvasTexture, radial } from "./draw";
import { walkFrames } from "./characters";
import { WALK_POSES, withPose } from "./pose";

/** A glossy white shot with a dark rim: tinted in each boss's colour for its rings, volleys and rain. */
function orb(ctx: Ctx): void {
  ctx.beginPath();
  ctx.arc(34, 34, 26, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#3a2516";
  ctx.stroke();
  ctx.fillStyle = radial(ctx, 26, 24, 30, [[0, "#ffffff"], [0.6, "#e8e8e8"], [1, "#b8b8b8"]]);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(25, 23, 8, 5, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fill();
}

export function makeBossTextures(scene: Phaser.Scene): void {
  for (const key of Object.keys(BOSS_ART)) canvasTexture(scene, key, ...padded(key));
  canvasTexture(scene, "b_orb", 68, 68, orb);
}

/** One of a boss's walk frames (0..2), so they can be made a little at a time ahead of the fight. */
export function bossFrame(scene: Phaser.Scene, key: string, i: number): void {
  if (!BOSS_ART[key]) return;
  const [w, h, draw] = padded(key);
  const k = key + ["_a", "_b", "_c"][i];
  if (!scene.textures.exists(k)) withPose(WALK_POSES[i], () => canvasTexture(scene, k, w, h, draw));
}

/** A boss's walk frames, made the first time it shows up. */
export function bossFrames(scene: Phaser.Scene, key: string): void {
  if (BOSS_ART[key]) walkFrames(scene, key, ...padded(key));
}

/** Room round each boss so flapping wings and swinging arms stay inside the picture. */
const PAD = 22;
function padded(key: string): [number, number, (ctx: Ctx) => void] {
  const [w, h, draw] = BOSS_ART[key];
  return [w + PAD * 2, h + PAD, (ctx) => {
    ctx.translate(PAD, PAD);
    draw(ctx);
  }];
}
