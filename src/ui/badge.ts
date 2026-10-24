import Phaser from "phaser";
import { INK_N, lighten } from "../art/draw";
import { TIER_INFO, Tier } from "../data/tiers";
import { text } from "./widgets";

export interface BadgeOpts {
  /** a tier chip on the top left (gadgets) */
  tier?: Tier;
  /** a level number on the bottom right */
  level?: number;
  /** the top level: the number turns gold */
  max?: number;
  /** spinning rays behind the medal */
  glow?: boolean;
  /** the picture bobs and wiggles and a glint runs over the medal */
  live?: boolean;
}

/**
 * A round medal with a skill or gadget on it: the same look on level-up cards, the HUD and the
 * stats popup, so you always recognise what you carry. `size` is the medal's width.
 */
export function badge(scene: Phaser.Scene, x: number, y: number, size: number, color: number, icon: string, o: BadgeOpts = {}): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const k = size / 200;
  const loops: Phaser.Tweens.Tween[] = [];
  if (o.glow) {
    const rays = scene.add.image(0, 0, "rays").setTint(lighten(color, 0.3)).setAlpha(0.6).setScale(size / 330);
    c.add(rays);
    loops.push(scene.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 }));
  }
  const base = scene.add.image(0, 0, "medal").setScale(k).setTint(color);
  const pic = scene.add.image(0, -size * 0.02, icon);
  const fit = (size * 0.64) / Math.max(pic.width, pic.height);
  pic.setScale(fit);
  const gloss = scene.add.image(0, 0, "medal_gloss").setScale(k);
  c.add([base, pic, gloss]);
  if (o.live) {
    loops.push(scene.tweens.add({ targets: pic, y: pic.y - size * 0.05, duration: 760, yoyo: true, repeat: -1, ease: "Sine.inOut" }));
    loops.push(scene.tweens.add({ targets: pic, angle: { from: -6, to: 6 }, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.inOut" }));
    const glint = scene.add.image(-size * 0.28, -size * 0.28, "spark").setScale(size / 140).setAlpha(0);
    c.add(glint);
    loops.push(scene.tweens.add({ targets: glint, alpha: { from: 0, to: 1 }, angle: 90, duration: 260, yoyo: true, repeat: -1, repeatDelay: 1700, delay: Math.random() * 1500 }));
  }
  if (o.tier) {
    const info = TIER_INFO[o.tier];
    const r = size * 0.17;
    c.add([
      scene.add.circle(-size * 0.36, -size * 0.36, r, info.color).setStrokeStyle(Math.max(3, size * 0.03), INK_N),
      text(scene, -size * 0.36, -size * 0.37, o.tier, Math.round(r * (o.tier.length > 2 ? 0.85 : o.tier.length > 1 ? 1.05 : 1.3))),
    ]);
  }
  if (o.level !== undefined) {
    const top = o.max !== undefined && o.level >= o.max;
    const r = size * 0.18;
    c.add([
      scene.add.circle(size * 0.35, size * 0.35, r, top ? 0xffb02e : 0x4a2f1d).setStrokeStyle(Math.max(3, size * 0.03), top ? 0xfff3a8 : 0xffffff),
      text(scene, size * 0.35, size * 0.34, `${o.level}`, Math.round(r * 1.35), top ? "#fff3a8" : "#ffffff"),
    ]);
  }
  c.once("destroy", () => loops.forEach((t) => t.remove()));
  return c;
}
