import Phaser from "phaser";
import { INK_N, canvasTexture } from "../art/draw";
import { catchMs, setTapLuck, tapCut } from "../systems/fishing";
import { persist, save } from "../systems/save";
import { buzz, sfx } from "../systems/sound";
import { text } from "./widgets";

/**
 * TAP RUSH on the fishing screen: glowing circles pop up all over the pond, each one for 2
 * seconds. Tap it in time and the next catch comes sooner, and your streak grows: every tap in
 * a row adds luck to your catches. Miss one and the streak is gone. Golden circles are worth
 * three. Big streaks get big shouts, and the circles come faster the longer you keep it up.
 */

const LIFE = 2000;
/** luck per tap in the streak, up to MAX_LUCK */
const LUCK_PER = 0.04;
const MAX_LUCK = 5;
/** a tap takes this share of the catch time off the wait (a golden one three times as much) */
const CUT = 0.06;
const R = 96;

const SHOUTS: [number, string, string][] = [
  [5, "NICE!", "#9ef0ff"],
  [10, "GREAT!", "#7affb0"],
  [20, "AMAZING!", "#ffe066"],
  [30, "ON FIRE!", "#ff9a3a"],
  [50, "UNSTOPPABLE!", "#ff6ad5"],
  [75, "LEGENDARY!", "#ffd23f"],
  [100, "GODLIKE!!", "#ffffff"],
  [150, "FISH MASTER!!!", "#ffe066"],
];

interface Circle {
  box: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Graphics;
  born: number;
  gold: boolean;
  done: boolean;
}

export const tapLuck = (streak: number) => Math.min(MAX_LUCK, 1 + LUCK_PER * streak);

export class TapRush {
  private circles: Circle[] = [];
  private streak = 0;
  private nextAt = 0;
  private hud: Phaser.GameObjects.Container;
  private streakText: Phaser.GameObjects.Text;
  private luckText: Phaser.GameObjects.Text;
  private bestText: Phaser.GameObjects.Text;
  private fire: Phaser.GameObjects.Image;

  constructor(
    private scene: Phaser.Scene,
    private root: Phaser.GameObjects.Container,
    /** where circles may pop up */
    private area: { x: number; y: number; w: number; h: number },
    hudX: number,
    hudY: number,
  ) {
    canvasTexture(scene, "tap_disc", R * 2 + 16, R * 2 + 16, (c) => {
      const g = c.createRadialGradient(R + 8 - R * 0.3, R + 8 - R * 0.35, 4, R + 8, R + 8, R);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.35, "#e8faff");
      g.addColorStop(1, "#b9e6ff");
      c.beginPath();
      c.arc(R + 8, R + 8, R, 0, Math.PI * 2);
      c.fillStyle = g;
      c.fill();
      c.lineWidth = 8;
      c.strokeStyle = "#2a1a12";
      c.stroke();
      c.beginPath();
      c.arc(R + 8, R + 8, R * 0.55, 0, Math.PI * 2);
      c.lineWidth = 6;
      c.strokeStyle = "rgba(42,26,18,0.25)";
      c.stroke();
    });
    this.fire = scene.add.image(0, 0, "glow").setScale(1.5, 0.9).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.streakText = text(scene, 0, -18, "", 60, "#ffffff", { stroke: 12 });
    this.luckText = text(scene, 0, 34, "", 36, "#7affb0");
    this.bestText = text(scene, 0, 74, "", 28, "#e8e0ff");
    this.hud = scene.add.container(hudX, hudY, [this.fire, this.streakText, this.luckText, this.bestText]);
    root.add(this.hud);
    this.refreshHud();
  }

  private get best(): number {
    return save.fishing.bestStreak ?? 0;
  }

  private refreshHud(): void {
    const s = this.streak;
    this.streakText.setText(s ? `STREAK x${s}` : "TAP THE CIRCLES!");
    this.streakText.setFontSize(s ? 60 : 44);
    this.luckText.setText(s ? `LUCK x${tapLuck(s).toFixed(2)}` : "faster catches + more luck");
    this.bestText.setText(`BEST ${this.best}`);
    const hot = Math.min(1, s / 30);
    this.fire.setTint(s >= 50 ? 0xff6ad5 : s >= 20 ? 0xff9a3a : 0x5ac8ff).setAlpha(0.25 + hot * 0.55);
  }

  /** Called every frame while the fishing screen is open; `busy` holds new circles back (a big reveal is up). */
  update(time: number, busy: boolean): void {
    const now = this.scene.time.now;
    if (!this.nextAt) this.nextAt = now + 900;
    if (!busy && now >= this.nextAt && this.circles.length < 3) {
      this.spawn(now);
      // the longer the streak, the faster they come
      this.nextAt = now + Math.max(650, 1500 - this.streak * 12) + Math.random() * 500;
    }
    for (const c of this.circles) {
      if (c.done) continue;
      const left = 1 - (now - c.born) / LIFE;
      if (left <= 0) {
        this.miss(c);
        continue;
      }
      // the timer ring runs out around the circle, going from green to red
      const col = left > 0.5 ? (c.gold ? 0xffd23f : 0x5aff8a) : left > 0.25 ? 0xffe066 : 0xff4a4a;
      c.ring.clear();
      c.ring.lineStyle(16, INK_N, 0.6).beginPath().arc(0, 0, R + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left).strokePath();
      c.ring.lineStyle(10, col, 1).beginPath().arc(0, 0, R + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left).strokePath();
      if (left < 0.3) c.box.setAngle(Math.sin(time / 30) * 4);
    }
    this.circles = this.circles.filter((c) => !c.done || c.box.active);
    if (this.streak) this.hud.setScale(1 + Math.max(0, Math.sin(time / 120)) * Math.min(0.08, this.streak / 600));
  }

  private spawn(now: number): void {
    const s = this.scene;
    const a = this.area;
    let x = 0;
    let y = 0;
    // not on top of another circle
    for (let i = 0; i < 12; i++) {
      x = a.x + R + 20 + Math.random() * (a.w - 2 * R - 40);
      y = a.y + R + 20 + Math.random() * (a.h - 2 * R - 40);
      if (this.circles.every((c) => c.done || Math.hypot(c.box.x - x, c.box.y - y) > R * 2.6)) break;
    }
    const gold = Math.random() < 0.1;
    const glow = s.add.image(0, 0, "glow").setScale(1.3).setTint(gold ? 0xffd23f : 0x5ac8ff).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD);
    const disc = s.add.image(0, 0, "tap_disc");
    if (gold) disc.setTint(0xffe58a);
    const icon = s.add.image(0, -6, gold ? "icon_star" : "icon_clover").setScale(0.9);
    const word = text(s, 0, 44, gold ? "x3!" : "TAP!", 28, gold ? "#ffe066" : "#ffffff");
    const ring = s.add.graphics();
    const box = s.add.container(x, y, [glow, ring, disc, icon, word]).setScale(0);
    box.setSize(R * 2 + 40, R * 2 + 40).setInteractive({ useHandCursor: true });
    this.root.add(box);
    s.tweens.add({ targets: box, scale: 1, duration: 220, ease: "Back.out" });
    s.tweens.add({ targets: glow, scale: 1.6, alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
    const c: Circle = { box, ring, born: now, gold, done: false };
    box.on("pointerdown", () => this.hit(c));
    this.circles.push(c);
  }

  private hit(c: Circle): void {
    if (c.done) return;
    c.done = true;
    const s = this.scene;
    const age = s.time.now - c.born;
    const before = this.streak;
    this.streak += c.gold ? 3 : 1;
    if (this.streak > this.best) {
      save.fishing.bestStreak = this.streak;
      persist();
    }
    setTapLuck(tapLuck(this.streak));
    const cut = Math.max(250, catchMs() * CUT * (c.gold ? 3 : 1));
    tapCut(cut);
    // pop: a burst of drops, a ring, and what you got
    const { x, y } = c.box;
    c.box.disableInteractive();
    s.tweens.killTweensOf(c.box);
    s.tweens.add({ targets: c.box, scale: 1.5, alpha: 0, duration: 220, onComplete: () => c.box.destroy() });
    const ring = s.add.circle(x, y, R, 0, 0).setStrokeStyle(10, c.gold ? 0xffd23f : 0xffffff);
    this.root.add(ring);
    s.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const d = s.add.circle(x, y, 10 + Math.random() * 8, c.gold ? 0xffd23f : [0x5ac8ff, 0x7affb0, 0xffffff][i % 3]).setStrokeStyle(3, INK_N);
      this.root.add(d);
      s.tweens.add({ targets: d, x: x + Math.cos(a) * 170, y: y + Math.sin(a) * 170, scale: 0.2, duration: 450, ease: "Cubic.out", onComplete: () => d.destroy() });
    }
    const fast = age < 700;
    this.float(x, y - 40, fast ? "FAST!" : `-${(cut / 1000).toFixed(1)}s`, fast ? "#ffe066" : "#9ef0ff", fast ? 48 : 40);
    if (fast) this.float(x, y + 20, `-${(cut / 1000).toFixed(1)}s`, "#9ef0ff", 32);
    // the note climbs with the streak
    sfx.tick(this.streak);
    if (c.gold) sfx.lucky();
    buzz(15);
    const shout = SHOUTS.filter(([n]) => before < n && this.streak >= n).pop();
    if (shout) this.shout(shout[1], shout[2]);
    else if (this.streak > 0 && this.streak % 10 === 0) this.shout(`${this.streak} IN A ROW!`, "#ffffff");
    this.refreshHud();
    s.tweens.add({ targets: this.streakText, scale: { from: 1.35, to: 1 }, duration: 220, ease: "Back.out" });
  }

  private miss(c: Circle): void {
    c.done = true;
    const s = this.scene;
    c.box.disableInteractive();
    s.tweens.killTweensOf(c.box);
    s.tweens.add({ targets: c.box, scale: 0, alpha: 0, duration: 220, onComplete: () => c.box.destroy() });
    this.float(c.box.x, c.box.y, "MISS", "#ff6a6a", 44);
    if (this.streak >= 5) {
      sfx.error();
      this.shout(`STREAK LOST (${this.streak})`, "#ff9a9a", 0.8);
    }
    this.streak = 0;
    setTapLuck(1);
    this.refreshHud();
  }

  private float(x: number, y: number, str: string, color: string, size: number): void {
    const s = this.scene;
    const t = text(s, x, y, str, size, color);
    this.root.add(t);
    s.tweens.add({ targets: t, y: y - 110, alpha: 0, duration: 800, ease: "Cubic.out", onComplete: () => t.destroy() });
  }

  /** A big shout across the screen for streak milestones. */
  private shout(str: string, color: string, k = 1): void {
    const s = this.scene;
    const a = this.area;
    const rays = s.add.image(0, 0, "rays").setTint(0xffe066).setScale(0.9 * k).setAlpha(0.6);
    const t = text(s, 0, 0, str, Math.round(96 * k), color, { stroke: 16 });
    const box = s.add.container(a.x + a.w / 2, a.y + a.h * 0.45, [rays, t]).setScale(0.3);
    this.root.add(box);
    s.tweens.add({ targets: rays, angle: 160, duration: 1850 });
    s.tweens.add({ targets: box, scale: 1, duration: 320, ease: "Back.out" });
    s.tweens.add({ targets: box, alpha: 0, y: box.y - 80, delay: 1400, duration: 450, onComplete: () => box.destroy() });
    if (k >= 1) {
      sfx.record();
      buzz(60);
      s.cameras.main.shake(180, 0.006);
    }
  }

  /** The screen was left: circles go away and the streak ends (its luck too). */
  stop(): void {
    for (const c of this.circles) c.box.destroy();
    this.circles = [];
    this.streak = 0;
    this.nextAt = 0;
    setTapLuck(1);
    this.refreshHud();
  }
}
