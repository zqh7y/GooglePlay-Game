import Phaser from "phaser";
import { INK, canvasTexture, lighten, linear, mix, rr } from "../art/draw";
import { rainbowColor } from "../data/rarity";
import { TIER_INFO, Tier } from "../data/tiers";
import { text } from "./widgets";

/**
 * Pet classes (A to uSSS) are shown in their colour, and the letters move: A is calm, B and C
 * breathe, D and E shimmer, S burns, SSS cycles through jewel colours and uSSS is a fast rainbow.
 * Every animated text or badge is tinted each frame by `animateClassTexts`.
 */
const PALETTE: Record<Tier, number[]> = {
  A: [0xd8e0e8, 0xffffff],
  B: [0x6fd25a, 0xd2ffb8],
  C: [0x4fa8ff, 0xc4ecff],
  D: [0xb36aff, 0xff9ae6, 0xe4ccff],
  E: [0xffa020, 0xffe066, 0xfff6d0],
  S: [0xff3f4e, 0xff9a3a, 0xffe066],
  SSS: [0xff4fd8, 0xb36aff, 0x4fa8ff, 0xffe066],
  uSSS: [],
};
/** A class's main colour (uSSS: pink, it is a rainbow when animated). */
export const classColor = (cls: Tier): number => (cls === "uSSS" ? 0xff4fd8 : PALETTE[cls][0]);

/** Milliseconds for one colour cycle (0 = still). */
const PERIOD: Record<Tier, number> = { A: 0, B: 1800, C: 1500, D: 1200, E: 1000, S: 750, SSS: 650, uSSS: 420 };

type Tintable = Phaser.GameObjects.Text | Phaser.GameObjects.Image;
const live = new Map<Tintable, Tier>();

function colorAt(cls: Tier, time: number, offset: number): number {
  if (cls === "uSSS") return lighten(rainbowColor(time * 3.5, offset), 0.15);
  const pal = PALETTE[cls];
  if (!PERIOD[cls]) return pal[0];
  const p = (((time / PERIOD[cls] + offset) % 1) + 1) % 1;
  const k = p * pal.length;
  const i = Math.floor(k);
  // ease between neighbours so the colours glide instead of stepping
  const f = 0.5 - 0.5 * Math.cos((k - i) * Math.PI);
  return mix(pal[i % pal.length], pal[(i + 1) % pal.length], f);
}

/** Colour every class text and badge for this frame (called once per frame by the UI scene). */
export function animateClassTexts(time: number): void {
  for (const [obj, cls] of live) {
    if (!obj.scene) {
      live.delete(obj);
      continue;
    }
    if (!obj.visible) continue;
    // corners a little apart in the cycle: a shine sweeping across
    obj.setTint(colorAt(cls, time, 0), colorAt(cls, time, 0.22), colorAt(cls, time, 0.08), colorAt(cls, time, 0.3));
  }
}

/** Register a white text or image to be coloured as a class (or change its class). */
export function setClassTint(obj: Tintable, cls: Tier): void {
  live.set(obj, cls);
  obj.setTint(colorAt(cls, 0, 0));
}

/** Text in a class's animated colours (drawn white, then tinted). */
export function classText(scene: Phaser.Scene, x: number, y: number, str: string, size: number, cls: Tier): Phaser.GameObjects.Text {
  const t = text(scene, x, y, str, size, "#ffffff");
  setClassTint(t, cls);
  return t;
}

const badgeW = (cls: Tier, h: number) => Math.round(h * (cls.length === 1 ? 1.15 : cls.length === 3 ? 1.75 : 2.05));

/** White rounded plate with an ink outline: tinted into the class colours. */
function plateTexture(scene: Phaser.Scene, w: number, h: number): string {
  return canvasTexture(scene, `cls_plate_${w}_${h}`, w, h, (ctx) => {
    const r = h * 0.38;
    rr(ctx, 3, 3, w - 6, h - 6, r);
    ctx.fillStyle = INK;
    ctx.fill();
    rr(ctx, 7, 7, w - 14, h - 14, r - 4);
    ctx.fillStyle = linear(ctx, 0, 7, 0, h - 7, [[0, "#ffffff"], [0.55, "#e8e8e8"], [1, "#b4b4b4"]]);
    ctx.fill();
    rr(ctx, 12, 10, w - 24, (h - 20) * 0.42, r * 0.6);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
  });
}

/**
 * A class badge: the letter(s) on a plate in the class colours. S and up also glow and
 * pulse. `setClass` swaps it to another class (used by the spinning roll reels).
 */
export class ClassBadge extends Phaser.GameObjects.Container {
  private plate: Phaser.GameObjects.Image;
  private letter: Phaser.GameObjects.Text;
  private glow: Phaser.GameObjects.Image;
  private pulse: Phaser.Tweens.Tween | null = null;
  cls: Tier;

  constructor(scene: Phaser.Scene, x: number, y: number, cls: Tier, private h: number) {
    super(scene, x, y);
    this.cls = cls;
    this.glow = scene.add.image(0, 0, "glow");
    this.plate = scene.add.image(0, 0, "__DEFAULT");
    this.letter = text(scene, 0, -2, "", 10);
    this.add([this.glow, this.plate, this.letter]);
    scene.add.existing(this);
    this.setClass(cls);
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.pulse?.remove());
  }

  setClass(cls: Tier): this {
    const s = this.scene;
    const h = this.h;
    const w = badgeW(cls, h);
    this.cls = cls;
    this.plate.setTexture(plateTexture(s, w, h));
    setClassTint(this.plate, cls);
    this.letter.setText(cls).setFontSize(Math.round(h * (cls.length === 1 ? 0.66 : cls.length === 3 ? 0.52 : 0.48)));
    this.letter.setStroke("#4a2f1d", Math.max(3, Math.round(h * 0.1)));
    const rank = Math.max(0, ["A", "B", "C", "D", "E", "S", "SSS", "uSSS"].indexOf(cls));
    this.glow.setVisible(rank >= 4).setTint(TIER_INFO[cls].color).setScale((w / 256) * 2.2, (h / 256) * 2.6).setAlpha(0.8);
    if (rank >= 5 && !this.pulse) this.pulse = s.tweens.add({ targets: this, scale: { from: 1, to: 1.12 }, duration: 520 - (rank - 5) * 120, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    else if (rank < 5 && this.pulse) {
      this.pulse.remove();
      this.pulse = null;
      this.setScale(1);
    }
    this.setSize(w, h);
    return this;
  }
}

export const classBadge = (scene: Phaser.Scene, x: number, y: number, cls: Tier, h = 48) => new ClassBadge(scene, x, y, cls, h);
