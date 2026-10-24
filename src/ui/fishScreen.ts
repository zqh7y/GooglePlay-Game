import Phaser from "phaser";
import { HERO_HAND } from "../art/characters";
import { INK_N, darken, lighten, rgba } from "../art/draw";
import { makeFishTextures } from "../art/fishing";
import { panelTexture } from "../art/ui";
import { BOOSTS } from "../data/boosts";
import {
  BASE_PRIZES, FISH_UPGRADES, FishUpgrade, PRIZES, Prize, ROW_COLORS, ROW_NAMES, SHINY_MULT, SUPER_LUCK, chanceLabel, doubleChance, goldMult,
  netMult, prizeChances, upgradeCost,
} from "../data/fishing";
import { Catch, buyFish, canBuyFish, cashFor, catchMs, currentLuck, fishLv, openPrizes, superIn } from "../systems/fishing";
import { persist, save } from "../systems/save";
import { buzz, sfx } from "../systems/sound";
import { fmt } from "./format";
import { Host, Screen } from "./screens";
import { Button, button, drawBar, fitText, label, modal, text } from "./widgets";

/** The picture of a prize: dice prizes show their die. */
export const prizeIcon = (p: Prize) => (p.kind === "dice" ? `die_${p.tier}` : `fp_${p.id}`);

/** What one catch of a prize gives, in a few words ("+3 shells", "1 C die", "2 min luck potion"). */
export function prizeGift(p: Prize, c?: Catch): string {
  const net = netMult(fishLv("net"));
  const n = c ? c.amount : p.kind === "shells" ? Math.round(p.amount * goldMult(fishLv("gold"))) : p.kind === "cash" ? cashFor(p.amount) : p.amount * net;
  const num = Number.isInteger(n) ? fmt(n) : n.toFixed(1);
  switch (p.kind) {
    case "shells": return `+${num} shells`;
    case "cash": return `+${num} money`;
    case "dice": return `${num} ${p.tier} ${n === 1 ? "die" : "dice"}`;
    case "jackpot": return `${num} ${p.tier} die + ${p.gems} gems`;
    case "gems": return `+${num} gems`;
    case "luckPotion": return `${num} min luck potion`;
    case "speedPotion": return `${num} min speed potion`;
    case "lucky": return `${num} lucky rolls`;
    case "boost": return c?.boost ? BOOSTS.find((b) => b.id === c.boost)!.name : "a battle boost";
  }
}

/** Short amount for a prize tile. */
function tileAmount(p: Prize): string {
  const net = netMult(fishLv("net"));
  const k = (x: number) => (Number.isInteger(x) ? `${x}` : x.toFixed(1));
  switch (p.kind) {
    case "shells": return `+${Math.round(p.amount * goldMult(fishLv("gold")))}`;
    case "cash": return `+${fmt(cashFor(p.amount))}`;
    case "dice": case "jackpot": return `x${k(p.amount * net)}`;
    case "gems": return `+${k(p.amount * net)}`;
    case "luckPotion": case "speedPotion": return `${k(p.amount * net)}m`;
    case "lucky": return `x${k(p.amount * net)}`;
    case "boost": return "x1";
  }
}

const hsv = (h: number, s: number, v: number) => Phaser.Display.Color.HSVToRGB(((h % 1) + 1) % 1, s, v).color;
const ROW_HUE = [0.58, 0.3, 0.57, 0.78, 0];
const GLYPHS = "?#%&@!*$?";

interface Tile {
  c: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
  amount: Phaser.GameObjects.Text;
  chance: Phaser.GameObjects.Text;
  lock: Phaser.GameObjects.Container;
  flash: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Graphics | null;
  mystery: number;
  x: number;
  y: number;
  /** last scramble of the mystery glyphs */
  scrambleAt: number;
}

interface Shadow {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  turnAt: number;
}

type Phase = "cast" | "wait" | "bite" | "reel" | "show";

const TILE_W = 246;
const TILE_H = 124;

/**
 * The fishing screen. Top: every prize in the pond (4 x 5, junk to legends) with its chance in
 * living colors (the rarest hide behind question marks). Middle: the hero fishing on the dock;
 * each catch jumps out of the water and flies to its tile, rare ones get a big reveal.
 * Bottom: time to the next catch, shells, and the upgrades.
 */
export class FishScreen extends Screen {
  private tiles: Tile[] = [];
  private head!: Phaser.GameObjects.Text;
  private pond!: Phaser.GameObjects.Container;
  private pondTop = 0;
  private pondH = 0;
  private skyH = 0;
  private waves!: Phaser.GameObjects.Graphics;
  private rod!: Phaser.GameObjects.Graphics;
  private hero!: Phaser.GameObjects.Image;
  private bobber!: Phaser.GameObjects.Image;
  private bobberRest = { x: 0, y: 0 };
  private clouds: Phaser.GameObjects.Image[] = [];
  private lilies: Phaser.GameObjects.Image[] = [];
  private shadows: Shadow[] = [];
  private superGlow!: Phaser.GameObjects.Image;
  private superText!: Phaser.GameObjects.Text;
  private bang!: Phaser.GameObjects.Container;
  private chips: Phaser.GameObjects.Text[] = [];
  private bar!: Phaser.GameObjects.Graphics;
  private barText!: Phaser.GameObjects.Text;
  private shellText!: Phaser.GameObjects.Text;
  private upBtn!: Button;
  private upBadge!: Phaser.GameObjects.Container;
  private phase: Phase = "wait";
  /** casts waiting to be shown (each is one or two catches) */
  private queue: Catch[][] = [];
  /** the rod: how much it bends (a fish pulls) and swings (a cast) */
  private bend = 0;
  private swing = 0;
  /** the line goes slack to the bobber, or tight to a prize coming out */
  private lineTo: { x: number; y: number } | null = null;
  private slack = 1;
  private reveal: Phaser.GameObjects.Container | null = null;
  private rippleT = 0;
  private sparkleT = 0;
  private refreshT = 0;
  private lastLuck = -1;
  private lastOpen = -1;

  constructor(scene: Phaser.Scene, host: Host) {
    super(scene, host, null);
    makeFishTextures(scene);
    const { width: W } = scene.scale;
    const L = host.L;
    const back = scene.add.graphics();
    back.fillGradientStyle(0x123a5c, 0x123a5c, 0x0e2a44, 0x0e2a44, 1).fillRect(0, 0, W, L.navTop);
    back.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, L.navTop), Phaser.Geom.Rectangle.Contains);
    this.root.add(back);
    const top = L.headerBottom + 8;
    // ── the prizes
    this.root.add(scene.add.image(W / 2, top + 30 + 340, panelTexture(scene, "glass", 1050, 740)));
    this.root.add(text(scene, 46, top + 34, "PRIZES", 40, "#ffe066").setOrigin(0, 0.5));
    this.head = text(scene, W - 46, top + 34, "", 30, "#bfe8ff").setOrigin(1, 0.5);
    this.root.add(this.head);
    const x0 = (W - (4 * TILE_W + 3 * 10)) / 2;
    const y0 = top + 70;
    PRIZES.forEach((p, i) => this.tiles.push(this.makeTile(p, i, x0 + TILE_W / 2 + (i % 4) * (TILE_W + 10), y0 + TILE_H / 2 + Math.floor(i / 4) * (TILE_H + 8))));
    // ── the pond
    this.pondTop = y0 + 5 * TILE_H + 4 * 8 + 16;
    const pondBottom = L.navTop - 236;
    this.pondH = pondBottom - this.pondTop;
    this.buildPond(W);
    // ── next catch, shells, upgrades
    const by = pondBottom + 14;
    this.bar = scene.add.graphics();
    this.barText = text(scene, W / 2 + 40, by + 44, "", 30);
    this.root.add([
      scene.add.image(W / 2, by + 104, panelTexture(scene, "glass", 1050, 200)),
      scene.add.image(70, by + 44, "fish_bobber").setScale(1.05),
      this.bar, this.barText,
    ]);
    const shellPill = scene.add.container(200, by + 146, [
      scene.add.image(0, 0, panelTexture(scene, "glass", 320, 92)),
      scene.add.image(-110, 0, "fish_shell").setScale(1.1),
    ]);
    this.shellText = text(scene, -60, 0, "", 44).setOrigin(0, 0.5);
    shellPill.add(this.shellText);
    this.upBtn = button(scene, 700, by + 146, 600, 104, "green", "UPGRADES", () => this.showUpgrades(), { size: 44, icon: "fu_speed", iconSize: 70 });
    this.upBadge = scene.add.container(990, by + 104, [scene.add.circle(0, 0, 22, 0xf03e3e).setStrokeStyle(5, INK_N), text(scene, 0, -1, "!", 30)]);
    scene.tweens.add({ targets: this.upBadge, scale: 1.18, duration: 420, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.root.add([shellPill, this.upBtn, this.upBadge]);
    scene.game.events.on("fish-caught", this.onCatch, this);
  }

  // ───────────────────────── prize tiles ─────────────────────────

  private makeTile(p: Prize, i: number, x: number, y: number): Tile {
    const s = this.scene;
    const color = ROW_COLORS[p.row];
    const bg = s.add.graphics();
    bg.fillStyle(darken(color, 0.72), 0.85).fillRoundedRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 20);
    bg.fillStyle(color, 0.16).fillRoundedRect(-TILE_W / 2 + 6, -TILE_H / 2 + 6, TILE_W - 12, TILE_H / 2 - 6, 14);
    bg.lineStyle(5, color, 0.95).strokeRoundedRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 20);
    let glow: Phaser.GameObjects.Graphics | null = null;
    if (p.row >= 3) {
      glow = s.add.graphics();
      glow.lineStyle(12, lighten(color, 0.3), 1).strokeRoundedRect(-TILE_W / 2 - 4, -TILE_H / 2 - 4, TILE_W + 8, TILE_H + 8, 24);
      s.tweens.add({ targets: glow, alpha: 0.15, duration: 700 + p.row * 120, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }
    const icon = s.add.image(-64, 0, prizeIcon(p));
    icon.setScale(92 / Math.max(icon.width, icon.height));
    const amount = text(s, 112, -32, "", 28).setOrigin(1, 0.5);
    const chance = text(s, 112, 30, "", 32).setOrigin(1, 0.5);
    const flash = s.add.graphics();
    flash.fillStyle(0xffffff, 1).fillRoundedRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 20);
    flash.setAlpha(0);
    const need = i - BASE_PRIZES + 1;
    const lock = s.add.container(0, 0, [
      s.add.rectangle(0, 0, TILE_W - 8, TILE_H - 8, 0x0a1420, 0.72),
      s.add.image(-64, -2, "icon_lock").setScale(0.62),
      text(s, 40, -16, "Deeper", 26, "#bfe8ff"),
      text(s, 40, 18, `Water ${need}`, 26, "#bfe8ff"),
    ]);
    const parts: Phaser.GameObjects.GameObject[] = [bg, icon, amount, chance, flash, lock];
    if (glow) parts.unshift(glow);
    const c = s.add.container(x, y, parts).setSize(TILE_W, TILE_H).setInteractive({ useHandCursor: true });
    c.on("pointerdown", () => s.tweens.add({ targets: c, scale: 0.94, duration: 60 }));
    c.on("pointerout", () => c.setScale(1));
    c.on("pointerup", () => {
      c.setScale(1);
      this.showPrize(i);
    });
    this.root.add(c);
    return { c, icon, amount, chance, lock, flash, glow, mystery: 0, x, y, scrambleAt: 0 };
  }

  /** Chances, amounts, locks and silhouettes (prizes never caught are dark shapes). */
  private refreshTiles(): void {
    const open = openPrizes();
    const luck = currentLuck();
    const ch = prizeChances(luck, open);
    this.head.setText(`LUCK x${luck >= 10 ? Math.round(luck) : luck.toFixed(1)}  •  ${open}/${PRIZES.length} PRIZES`);
    PRIZES.forEach((p, i) => {
      const t = this.tiles[i];
      const isOpen = i < open;
      t.lock.setVisible(!isOpen);
      t.amount.setVisible(isOpen).setText(tileAmount(p));
      fitText(t.amount, 120);
      t.chance.setVisible(isOpen);
      const known = (save.fishing.caught[p.id] ?? 0) > 0;
      if (known) t.icon.clearTint();
      else t.icon.setTintFill(0x1c2c44);
      if (!isOpen) return;
      const lbl = chanceLabel(ch[i]);
      t.mystery = lbl.mystery;
      if (lbl.mystery < 4) t.chance.setText(lbl.text);
      t.chance.setFontSize(lbl.mystery ? 40 : 30);
      fitText(t.chance, 130);
    });
    this.lastLuck = luck;
    this.lastOpen = open;
  }

  /** The chances shimmer: commons softly, rarer rows through more colors, mysteries scramble. */
  private animateTiles(time: number): void {
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i];
      if (!t.chance.visible) continue;
      const row = PRIZES[i].row;
      const ph = time / 1000 + i * 0.37;
      if (t.mystery === 0) {
        if (row === 0) {
          const v = 0.85 + 0.15 * Math.sin(ph * 2);
          t.chance.setTint(hsv(0.58, 0.15, v));
        } else if (row === 4) {
          const h = ph * 0.5;
          t.chance.setTint(hsv(h, 0.6, 1), hsv(h + 0.15, 0.6, 1), hsv(h + 0.3, 0.6, 1), hsv(h + 0.45, 0.6, 1));
        } else {
          const h = ROW_HUE[row] + 0.06 * Math.sin(ph * 1.5);
          t.chance.setTint(hsv(h, 0.45, 1), hsv(h + 0.05, 0.3, 1), hsv(h - 0.05, 0.55, 1), hsv(h, 0.45, 1));
        }
        t.chance.setAngle(0);
        continue;
      }
      // question marks: they wobble, glow and change color; the deepest ones scramble
      const h = ph * (0.2 + 0.15 * t.mystery);
      t.chance.setTint(hsv(h, 0.55, 1), hsv(h + 0.2, 0.55, 1), hsv(h + 0.4, 0.55, 1), hsv(h + 0.6, 0.55, 1));
      t.chance.setAngle(Math.sin(ph * (2 + t.mystery)) * (4 + 2 * t.mystery));
      if (t.mystery === 4) {
        if (time - t.scrambleAt > 90) {
          t.scrambleAt = time;
          let s = "";
          for (let k = 0; k < 4; k++) s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          t.chance.setText(s);
          fitText(t.chance, 130);
        }
        t.chance.setAlpha(0.65 + 0.35 * Math.abs(Math.sin(ph * 7)));
        t.chance.setX(112 + (Math.random() - 0.5) * 4);
      }
    }
  }

  private showPrize(i: number): void {
    sfx.click();
    const s = this.scene;
    const p = PRIZES[i];
    const open = i < openPrizes();
    const caught = save.fishing.caught[p.id] ?? 0;
    const color = ROW_COLORS[p.row];
    const m = this.host.showModal(modal(s, 820, 900, caught ? p.name : "???", "blue"));
    const icon = s.add.image(0, -200, prizeIcon(p));
    icon.setScale(230 / Math.max(icon.width, icon.height));
    if (!caught) icon.setTintFill(0x2a3a54);
    const rays = s.add.image(0, -200, "rays").setTint(color).setAlpha(0.45).setScale(0.75);
    s.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
    s.tweens.add({ targets: icon, y: -214, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const lbl = chanceLabel(prizeChances(currentLuck(), openPrizes())[i]);
    const chance = !open ? "Not in reach yet" : lbl.mystery === 4 ? "A complete mystery..." : lbl.mystery ? `Chance: ${lbl.text}  (very, very rare)` : `Chance: ${lbl.text} per catch`;
    m.body.add([
      rays, icon,
      text(s, 0, -40, ROW_NAMES[p.row].toUpperCase(), 40, rgba(lighten(color, 0.2))),
      label(s, 0, 40, caught ? `You get: ${prizeGift(p)}` : "Catch it once to see what it is!", 36, "#4a2f1d", 700),
      label(s, 0, 120, chance, 32, "#7a5236", 700),
      label(s, 0, 190, caught ? `Caught ${fmt(caught)} ${caught === 1 ? "time" : "times"}` : "Never caught", 30, "#9a7a5a"),
      label(s, 0, 260, open ? "Lucky Bait makes rare prizes bite more often" : `Unlock it with Deeper Water level ${i - BASE_PRIZES + 1}`, 26, "#9a7a5a", 700),
      button(s, 0, 360, 360, 110, "green", "OK", () => m.close(), { size: 40 }),
    ]);
  }

  // ───────────────────────── the pond ─────────────────────────

  private buildPond(W: number): void {
    const s = this.scene;
    const h = this.pondH;
    const skyH = Math.round(h * 0.34);
    this.skyH = skyH;
    const pond = s.add.container(0, this.pondTop);
    this.pond = pond;
    const g = s.add.graphics();
    g.fillGradientStyle(0x7cc8f2, 0x7cc8f2, 0xd8f3ff, 0xd8f3ff, 1).fillRect(0, 0, W, skyH);
    g.fillGradientStyle(0x62bfe8, 0x62bfe8, 0x225f9c, 0x225f9c, 1).fillRect(0, skyH, W, h - skyH);
    pond.add(g);
    const sun = s.add.image(900, skyH * 0.34, "glow").setTint(0xfff3a8).setScale(0.9).setAlpha(0.9);
    s.tweens.add({ targets: sun, scale: 1, duration: 2200, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    pond.add([sun, s.add.circle(900, skyH * 0.34, 42, 0xfff7c0)]);
    for (let i = 0; i < 3; i++) {
      const c = s.add.image(150 + i * 360, skyH * (0.18 + 0.16 * (i % 2)), "fish_cloud").setScale(0.7 + 0.2 * (i % 2)).setAlpha(0.95);
      this.clouds.push(c);
      pond.add(c);
    }
    pond.add(s.add.image(0, skyH + 4, "fish_hills").setOrigin(0, 1).setScale(1, Math.min(1, (skyH * 0.8) / 260)));
    // the far shore's reflection, then the ripples drawn every frame
    pond.add(s.add.rectangle(0, skyH, W, 10, 0xffffff, 0.35).setOrigin(0));
    this.waves = s.add.graphics();
    pond.add(this.waves);
    const water = (f: number) => skyH + (h - skyH) * f;
    for (const [x, f, k] of [[560, 0.72, 0.9], [990, 0.3, 0.75], [140, 0.86, 0.8]] as [number, number, number][]) {
      const lily = s.add.image(x, water(f), "fish_lily").setScale(k);
      this.lilies.push(lily);
      pond.add(lily);
    }
    for (let i = 0; i < 3; i++) {
      const img = s.add.image(500 + i * 180, water(0.35 + i * 0.2), "fish_shadow").setAlpha(0.2).setScale(0.6 + 0.15 * i);
      this.shadows.push({ img, vx: (i % 2 ? 1 : -1) * (30 + i * 12), vy: 0, turnAt: 0 });
      pond.add(img);
    }
    this.superGlow = s.add.image(0, 0, "glow").setTint(0xffd23f).setAlpha(0).setScale(1.2, 0.5);
    pond.add(this.superGlow);
    pond.add(s.add.image(W - 70, h + 6, "fish_reeds").setOrigin(0.5, 1).setScale(Math.min(1, h / 420)));
    // the dock, the hero on it with a bucket, the rod and line, the bobber
    pond.add(s.add.image(-30, skyH - 52, "fish_dock").setOrigin(0));
    pond.add(s.add.image(190, skyH - 4, "fish_bucket").setOrigin(0.5, 0.95));
    this.hero = s.add.image(350, skyH - 6, "hero").setOrigin(0.5, 0.95).setScale(1.15);
    s.tweens.add({ targets: this.hero, scaleY: 1.12, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    pond.add(this.hero);
    this.rod = s.add.graphics();
    pond.add(this.rod);
    this.bobberRest = { x: 780, y: water(0.42) };
    this.bobber = s.add.image(this.bobberRest.x, this.bobberRest.y, "fish_bobber").setOrigin(0.5, 0.75);
    pond.add(this.bobber);
    this.superText = text(s, this.bobberRest.x, this.bobberRest.y - 110, "SUPER BITE!", 40, "#ffe066").setAlpha(0);
    pond.add(this.superText);
    this.bang = s.add.container(350, skyH - 230, [s.add.circle(0, 0, 40, 0xffffff).setStrokeStyle(6, INK_N), text(s, 0, -2, "!", 62, "#ff4a4a")]).setScale(0);
    pond.add(this.bang);
    // what the line is like right now
    const chip = (x: number, icon: string) => {
      const t = text(s, x + 34, 40, "", 30).setOrigin(0, 0.5);
      pond.add([s.add.image(x + 74, 40, panelTexture(s, "glass", 200, 64)), s.add.image(x + 6, 40, icon).setScale(0.48), t]);
      this.chips.push(t);
    };
    chip(20, "icon_clock");
    chip(232, "fu_hook");
    chip(444, "fu_super");
    // a frame around the scene
    const frame = s.add.graphics();
    frame.lineStyle(10, INK_N, 1).strokeRoundedRect(4, 0, W - 8, h, 26);
    pond.add(frame);
    this.root.add(pond);
  }

  /** Rod from the hero's hand: it bends when something pulls and swings when you cast. */
  private drawRod(time: number): { tx: number; ty: number } {
    const g = this.rod;
    g.clear();
    const k = this.hero.scaleX;
    const hx = this.hero.x + HERO_HAND.x * k;
    const hy = this.hero.y + HERO_HAND.y * k;
    const len = 330;
    const a = -0.95 + this.bend * 0.6 + this.swing + Math.sin(time / 900) * 0.02;
    const tx = hx + Math.cos(a) * len;
    const ty = hy + Math.sin(a) * len;
    // a curved rod: the middle lags behind the tip
    const mx = hx + Math.cos(a - this.bend * 0.3) * len * 0.55;
    const my = hy + Math.sin(a - this.bend * 0.3) * len * 0.55;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push(new Phaser.Math.Vector2((1 - t) * (1 - t) * hx + 2 * (1 - t) * t * mx + t * t * tx, (1 - t) * (1 - t) * hy + 2 * (1 - t) * t * my + t * t * ty));
    }
    g.lineStyle(16, INK_N, 1).strokePoints(pts);
    g.lineStyle(9, 0xc8884a, 1).strokePoints(pts.slice(0, 9));
    g.lineStyle(7, 0xe8c070, 1).strokePoints(pts.slice(8));
    g.fillStyle(0xd8e0e8, 1).fillCircle(hx + Math.cos(a) * 40, hy + Math.sin(a) * 40, 12);
    g.lineStyle(4, INK_N, 1).strokeCircle(hx + Math.cos(a) * 40, hy + Math.sin(a) * 40, 12);
    // the line: slack to the bobber, tight to a prize being pulled out
    const end = this.lineTo ?? { x: this.bobber.x, y: this.bobber.y - this.bobber.displayHeight * 0.7 };
    if (this.bobber.visible || this.lineTo) {
      const cx = (tx + end.x) / 2;
      const cy = (ty + end.y) / 2 + 90 * this.slack;
      const line: Phaser.Math.Vector2[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        line.push(new Phaser.Math.Vector2((1 - t) * (1 - t) * tx + 2 * (1 - t) * t * cx + t * t * end.x, (1 - t) * (1 - t) * ty + 2 * (1 - t) * t * cy + t * t * end.y));
      }
      g.lineStyle(3, 0xffffff, 0.85).strokePoints(line);
    }
    return { tx, ty };
  }

  private drawWaves(time: number): void {
    const g = this.waves;
    g.clear();
    const W = this.scene.scale.width;
    const top = this.skyH;
    const h = this.pondH - top;
    for (let k = 0; k < 7; k++) {
      const y0 = top + 22 + (k / 7) * (h - 30) + Math.sin(time / 1700 + k) * 6;
      const amp = 4 + k * 1.2;
      g.lineStyle(3 + k * 0.4, 0xffffff, 0.12 + 0.04 * (k % 3));
      g.beginPath();
      for (let x = -20; x <= W + 20; x += 30) {
        const y = y0 + Math.sin(x / (90 + k * 14) + time / (700 + k * 90) + k) * amp;
        if (x === -20) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    }
  }

  private ripple(x: number, y: number, big = false): void {
    const s = this.scene;
    const r = s.add.image(x, y, "ring").setScale(big ? 0.5 : 0.25, big ? 0.17 : 0.09).setAlpha(0.8);
    this.pond.add(r);
    this.pond.bringToTop(this.bobber);
    s.tweens.add({ targets: r, scaleX: big ? 1.8 : 1, scaleY: big ? 0.6 : 0.33, alpha: 0, duration: big ? 900 : 1300, ease: "Quad.out", onComplete: () => r.destroy() });
  }

  /** Water drops flying up from a point. */
  private splash(x: number, y: number, n: number): void {
    const s = this.scene;
    for (let i = 0; i < n; i++) {
      const d = s.add.image(x, y, "fish_drop").setScale(0.6 + Math.random() * 0.7);
      this.pond.add(d);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const v = 120 + Math.random() * 180;
      s.tweens.add({ targets: d, x: x + Math.cos(a) * v, duration: 600, ease: "Linear" });
      s.tweens.add({ targets: d, y: y + Math.sin(a) * v, duration: 300, ease: "Quad.out", yoyo: true, onComplete: () => d.destroy() });
    }
    this.ripple(x, y, true);
  }

  // ───────────────────────── the catch ─────────────────────────

  private onCatch(catches: Catch[]): void {
    if (!this.visible) return;
    for (const c of catches) {
      if (c.double && this.queue.length) this.queue[this.queue.length - 1].push(c);
      else this.queue.push([c]);
    }
    // came back to lots of catches: only keep the last few to show
    if (this.queue.length > 6) this.queue = this.queue.slice(-6);
  }

  private get hurry(): boolean {
    return this.queue.length > 2 || catchMs() < 7000;
  }

  /** Something bites: the bobber goes under, the rod bends, out comes the prize. */
  private reel(group: Catch[]): void {
    const s = this.scene;
    this.phase = "reel";
    sfx.bite();
    buzz(30);
    this.bang.setScale(0);
    s.tweens.add({ targets: this.bang, scale: 1, duration: 160, ease: "Back.out", yoyo: true, hold: 300 });
    const k = { b: this.bend };
    s.tweens.add({ targets: k, b: 1, duration: 140, onUpdate: () => (this.bend = k.b) });
    this.slack = 0;
    const bx = this.bobber.x;
    const by = this.bobber.y;
    this.splash(bx, by, 10);
    this.superGlow.setAlpha(0);
    s.time.delayedCall(this.hurry ? 160 : 320, () => {
      sfx.reel();
      this.bobber.setVisible(false);
      this.showGroup(group, 0, bx, by);
    });
  }

  private showGroup(group: Catch[], i: number, bx: number, by: number): void {
    const s = this.scene;
    if (i >= group.length) {
      this.lineTo = null;
      this.cast();
      return;
    }
    const c = group[i];
    const p = PRIZES[c.prize];
    const img = s.add.image(bx, by, prizeIcon(p));
    const size = 120 / Math.max(img.width, img.height);
    img.setScale(size * 0.4);
    this.pond.add(img);
    this.lineTo = { x: bx, y: by };
    const spot = { x: 600, y: this.skyH - 170 };
    const k = { t: 0 };
    this.phase = "show";
    s.tweens.add({
      targets: k, t: 1, duration: this.hurry ? 380 : 560, ease: "Quad.out",
      onUpdate: () => {
        img.setPosition(bx + (spot.x - bx) * k.t, by + (spot.y - by) * k.t - Math.sin(k.t * Math.PI) * 140).setAngle(k.t * 360).setScale(size * (0.4 + 0.8 * k.t));
        this.lineTo = { x: img.x, y: img.y };
        if (Math.random() < 0.4) {
          const d = s.add.image(img.x, img.y, "fish_drop").setScale(0.5);
          this.pond.add(d);
          s.tweens.add({ targets: d, y: d.y + 80, alpha: 0, duration: 420, onComplete: () => d.destroy() });
        }
      },
      onComplete: () => {
        this.lineTo = null;
        this.slack = 1;
        const k2 = { b: this.bend };
        s.tweens.add({ targets: k2, b: 0, duration: 260, ease: "Back.out", onUpdate: () => (this.bend = k2.b) });
        const big = p.row >= 2 || c.shiny || c.super || !(save.fishing.caught[p.id] > 1);
        const after = () => this.flyToTile(img, c, () => this.showGroup(group, i + 1, bx, by));
        if (big && !(this.hurry && p.row < 3 && !c.shiny && save.fishing.caught[p.id] > 1)) this.bigReveal(c, img, after);
        else this.smallPop(c, img, after);
      },
    });
  }

  /** A common catch: a quick bounce and what it gave. */
  private smallPop(c: Catch, img: Phaser.GameObjects.Image, done: () => void): void {
    const s = this.scene;
    const p = PRIZES[c.prize];
    sfx.catch(p.row);
    const base = img.scale;
    s.tweens.add({ targets: img, scale: base * 1.3, duration: 120, yoyo: true });
    const t = text(s, img.x, img.y - 90, prizeGift(p, c), 36, rgba(lighten(ROW_COLORS[p.row], 0.35)));
    fitText(t, 520);
    this.pond.add(t);
    s.tweens.add({ targets: t, y: t.y - 60, alpha: 0, delay: 500, duration: 400, onComplete: () => t.destroy() });
    s.time.delayedCall(this.hurry ? 200 : 380, done);
  }

  /**
   * A rare (or shiny, super or first-ever) catch: the screen goes dark around it, rays spin,
   * its name and what it gave come up. Legends hold longer, with flashes. Tap to go on.
   */
  private bigReveal(c: Catch, img: Phaser.GameObjects.Image, done: () => void): void {
    const s = this.scene;
    const { width: W, height: H } = s.scale;
    const p = PRIZES[c.prize];
    const color = ROW_COLORS[p.row];
    const first = (save.fishing.caught[p.id] ?? 0) <= 1;
    sfx.catch(p.row);
    if (p.row >= 3) sfx.fanfare();
    buzz(p.row >= 3 ? 80 : 30);
    const dim = s.add.rectangle(0, 0, W, H, 0x050a14, 0.8).setOrigin(0).setInteractive();
    const rays = s.add.image(W / 2, H * 0.42, "rays").setTint(color).setScale(1.6).setAlpha(0.7);
    s.tweens.add({ targets: rays, angle: 360, duration: 6000, repeat: -1 });
    const pic = s.add.image(W / 2, H * 0.42, img.texture.key).setScale(0);
    const fit = 300 / Math.max(pic.width, pic.height);
    s.tweens.add({ targets: pic, scale: fit, duration: 380, ease: "Back.out" });
    s.tweens.add({ targets: pic, y: H * 0.42 - 16, duration: 800, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: 380 });
    const tags: string[] = [];
    if (c.super) tags.push(`SUPER CATCH  x${SUPER_LUCK} LUCK`);
    if (c.shiny) tags.push(`SHINY  x${SHINY_MULT}`);
    if (first) tags.push("NEW PRIZE!");
    const css = rgba(lighten(color, 0.35));
    const parts: Phaser.GameObjects.GameObject[] = [
      dim, rays, pic,
      text(s, W / 2, H * 0.42 - 270, `${ROW_NAMES[p.row].toUpperCase()} CATCH!`, 72, css),
      fitText(text(s, W / 2, H * 0.42 + 220, p.name, 76, "#ffffff"), W - 80),
      fitText(text(s, W / 2, H * 0.42 + 310, prizeGift(p, c), 48, "#8af06a"), W - 80),
      ...tags.map((str, k) => fitText(text(s, W / 2, H * 0.42 + 390 + k * 64, str, 40, k === 0 && c.super ? "#ffe066" : "#ff8ae6"), W - 80)),
      text(s, W / 2, H - 260, "tap to continue", 30, "#bfd8f0").setAlpha(0.8),
    ];
    if (c.shiny) {
      const shine = s.add.image(W / 2, H * 0.42, "glow").setTint(0xfff3a8).setAlpha(0.6).setScale(1.4);
      s.tweens.add({ targets: shine, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
      parts.splice(2, 0, shine);
    }
    const root = s.add.container(0, 0, parts).setDepth(4600);
    this.reveal = root;
    if (p.row >= 4) {
      const flash = s.add.rectangle(0, 0, W, H, 0xffffff, 1).setOrigin(0).setDepth(4700);
      s.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
      s.cameras.main.shake(400, 0.008);
    }
    // sparkles bursting around it
    for (let k = 0; k < 8 + p.row * 4; k++) {
      const sp = s.add.image(W / 2, H * 0.42, "spark").setTint(k % 2 ? color : 0xffffff).setScale(0.6);
      root.add(sp);
      const a = Math.random() * Math.PI * 2;
      const d = 180 + Math.random() * 260;
      s.tweens.add({ targets: sp, x: W / 2 + Math.cos(a) * d, y: H * 0.42 + Math.sin(a) * d, scale: 0, angle: 180, duration: 700 + Math.random() * 500, delay: Math.random() * 300, ease: "Quad.out" });
    }
    img.setVisible(false);
    let over = false;
    const finish = () => {
      if (over) return;
      over = true;
      s.tweens.add({
        targets: root, alpha: 0, duration: 200,
        onComplete: () => {
          root.destroy();
          if (this.reveal === root) this.reveal = null;
          img.setVisible(true);
          done();
        },
      });
    };
    const hold = this.hurry ? [700, 700, 900, 1600, 3000][p.row] : [1100, 1100, 1400, 2000, 3500][p.row];
    s.time.delayedCall(hold, finish);
    s.time.delayedCall(350, () => dim.on("pointerup", finish));
  }

  /** The prize flies up into its tile, which flashes. */
  private flyToTile(img: Phaser.GameObjects.Image, c: Catch, done: () => void): void {
    const s = this.scene;
    const t = this.tiles[c.prize];
    const p = PRIZES[c.prize];
    this.pond.remove(img);
    this.root.add(img);
    img.setPosition(img.x, img.y + this.pondTop);
    s.tweens.add({
      targets: img, x: t.x - 64, y: t.y, scale: (92 / Math.max(img.width, img.height)), angle: 0, duration: this.hurry ? 320 : 460, ease: "Cubic.in",
      onComplete: () => {
        img.destroy();
        sfx.coin();
        t.flash.setAlpha(0.8);
        s.tweens.add({ targets: t.flash, alpha: 0, duration: 380 });
        t.c.setScale(1.15);
        s.tweens.add({ targets: t.c, scale: 1, duration: 260, ease: "Back.out" });
        if (p.kind === "cash") this.host.coinShower(t.x, t.y, 4);
        this.refreshTiles();
      },
    });
    s.time.delayedCall(this.hurry ? 120 : 220, done);
  }

  /** Swing the rod back and forward: the bobber flies out and plops into the water. */
  private cast(): void {
    const s = this.scene;
    this.phase = "cast";
    const k = { w: 0 };
    s.tweens.add({
      targets: k, w: 1, duration: this.hurry ? 320 : 520,
      onUpdate: () => (this.swing = k.w < 0.4 ? -0.7 * (k.w / 0.4) : -0.7 + 0.9 * ((k.w - 0.4) / 0.6)),
      onComplete: () => s.tweens.add({ targets: this, swing: 0, duration: 260, ease: "Back.out" }),
    });
    s.time.delayedCall(this.hurry ? 130 : 220, () => {
      sfx.cast();
      const { tx, ty } = this.drawRod(s.time.now);
      const end = this.bobberRest;
      this.bobber.setVisible(true).setPosition(tx, ty).setAngle(0);
      this.slack = 0.3;
      const f = { t: 0 };
      s.tweens.add({
        targets: f, t: 1, duration: this.hurry ? 300 : 460, ease: "Sine.in",
        onUpdate: () => {
          this.bobber.setPosition(tx + (end.x - tx) * f.t, ty + (end.y - ty) * f.t - Math.sin(f.t * Math.PI) * 160).setAngle(f.t * 360);
          this.slack = 0.3 + 0.7 * f.t;
        },
        onComplete: () => {
          this.bobber.setAngle(0);
          sfx.plop();
          this.splash(end.x, end.y, 6);
          this.phase = "wait";
        },
      });
    });
  }

  // ───────────────────────── upgrades ─────────────────────────

  private showUpgrades(): void {
    sfx.click();
    const s = this.scene;
    const rowH = 132;
    const h = 260 + FISH_UPGRADES.length * rowH;
    const m = this.host.showModal(modal(s, 980, h, "FISHING UPGRADES", "blue"));
    const shells = text(s, 0, -h / 2 + 116, "", 44, "#ffe066");
    const shellIcon = s.add.image(0, -h / 2 + 116, "fish_shell").setScale(0.9);
    m.body.add([shells, shellIcon]);
    const rows: (() => void)[] = [];
    const refresh = () => {
      shells.setText(fmt(save.fishing.shells));
      shellIcon.setX(-shells.width / 2 - 40);
      rows.forEach((r) => r());
    };
    FISH_UPGRADES.forEach((u, i) => {
      const y = -h / 2 + 200 + rowH / 2 + i * rowH;
      const name = label(s, -310, y - 36, u.name, 38, "#4a2f1d").setOrigin(0, 0.5);
      const lv = label(s, 0, y - 36, "", 28, "#c9663a").setOrigin(0, 0.5);
      const desc = fitText(label(s, -310, y + 2, u.desc, 24, "#9a7a5a").setOrigin(0, 0.5), 470);
      const eff = label(s, -310, y + 40, "", 30, "#3f9a4f").setOrigin(0, 0.5);
      const icon = s.add.image(-380, y, u.icon).setScale(0.82);
      const buy: Button = button(s, 330, y, 240, 104, "green", "", () => {
        if (!buyFish(u.id)) {
          sfx.error();
          return;
        }
        sfx.buy();
        buzz(20);
        persist();
        s.tweens.add({ targets: icon, scale: 1.1, duration: 120, yoyo: true });
        for (let k = 0; k < 6; k++) {
          const sp = s.add.image(-380, y, "spark").setScale(0.5);
          m.body.add(sp);
          const a = (k / 6) * Math.PI * 2;
          s.tweens.add({ targets: sp, x: -380 + Math.cos(a) * 80, y: y + Math.sin(a) * 80, scale: 0, duration: 400, onComplete: () => sp.destroy() });
        }
        refresh();
        this.refreshTiles();
      }, { icon: "fish_shell", iconSize: 48, size: 34 });
      m.body.add([s.add.image(0, y, panelTexture(s, "row", 900, rowH - 10)), icon, name, lv, desc, eff, buy]);
      rows.push(() => {
        const l = fishLv(u.id);
        const max = l >= u.max;
        lv.setText(`Lv ${l}/${u.max}`).setX(-310 + name.width + 20);
        eff.setText(max ? `${u.show(l)}  (max)` : `${u.show(l)}  →  ${u.show(l + 1)}`);
        buy.setLabel(max ? "MAX" : fmt(upgradeCost(u, l)));
        buy.setColor(max ? "grey" : canBuyFish(u.id) ? "green" : "grey");
      });
    });
    refresh();
  }

  // ───────────────────────── every frame ─────────────────────────

  protected onShow(): void {
    this.queue = [];
    this.phase = "wait";
    this.bend = 0;
    this.swing = 0;
    this.lineTo = null;
    this.slack = 1;
    this.bobber.setVisible(true).setPosition(this.bobberRest.x, this.bobberRest.y).setAngle(0);
    this.refreshTiles();
  }

  protected onHide(): void {
    this.reveal?.destroy();
    this.reveal = null;
    this.queue = [];
  }

  update(time: number): void {
    if (!this.visible) return;
    const s = this.scene;
    const now = Date.now();
    const left = Math.max(0, save.fishing.nextAt - now);
    // live numbers
    this.refreshT -= 16;
    if (this.refreshT <= 0) {
      this.refreshT = 250;
      if (currentLuck() !== this.lastLuck || openPrizes() !== this.lastOpen) this.refreshTiles();
      const secs = catchMs() / 1000;
      this.chips[0].setText(secs >= 10 ? `${Math.round(secs)}s` : `${secs.toFixed(1)}s`);
      this.chips[1].setText(`${Math.round(doubleChance(fishLv("hook")) * 100)}%`);
      this.chips[2].setText(superIn() === 1 ? "NEXT!" : `in ${superIn()}`);
      this.shellText.setText(fmt(save.fishing.shells));
      fitText(this.shellText, 190);
      this.upBadge.setVisible(FISH_UPGRADES.some((u: FishUpgrade) => canBuyFish(u.id)));
    }
    const f = 1 - left / catchMs();
    this.bar.clear();
    drawBar(this.bar, 120, this.pondTop + this.pondH + 14 + 24, 900, 40, Phaser.Math.Clamp(f, 0, 1), left < 1000 ? 0xffe066 : 0x5ac8ff);
    this.barText.setText(left < 900 ? "Something's biting...!" : `Next catch in ${Math.ceil(left / 1000)}s`);
    this.animateTiles(time);
    // the pond
    this.drawWaves(time);
    const W = s.scale.width;
    for (const c of this.clouds) {
      c.x += 0.25;
      if (c.x > W + 120) c.x = -120;
    }
    this.lilies.forEach((l, i) => l.setAngle(Math.sin(time / 1300 + i) * 4).setY(l.y + Math.sin(time / 700 + i) * 0.08));
    const water = this.skyH + 40;
    for (const sh of this.shadows) {
      if (time > sh.turnAt) {
        sh.turnAt = time + 2500 + Math.random() * 4000;
        sh.vx = (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 40);
        sh.vy = (Math.random() - 0.5) * 16;
      }
      // when a bite is coming, one fish heads for the bobber
      if ((this.phase === "bite" || left < 1500) && sh === this.shadows[0]) {
        const dx = this.bobber.x + 60 - sh.img.x;
        const dy = this.bobber.y + 30 - sh.img.y;
        sh.vx = Phaser.Math.Clamp(dx * 2, -160, 160);
        sh.vy = Phaser.Math.Clamp(dy * 2, -80, 80);
      }
      sh.img.x = Phaser.Math.Clamp(sh.img.x + sh.vx / 60, 420, W - 60);
      sh.img.y = Phaser.Math.Clamp(sh.img.y + sh.vy / 60, water, this.pondH - 50);
      sh.img.setFlipX(sh.vx > 0);
    }
    this.rippleT -= 16;
    if (this.phase === "wait" && this.rippleT <= 0) {
      this.rippleT = 1400;
      this.ripple(this.bobber.x, this.bobber.y);
    }
    this.sparkleT -= 16;
    if (this.sparkleT <= 0) {
      this.sparkleT = 260;
      const sp = s.add.image(Phaser.Math.Between(420, W - 40), Phaser.Math.Between(water, this.pondH - 30), "spark").setScale(0).setAlpha(0.9);
      this.pond.add(sp);
      this.pond.bringToTop(this.bobber);
      s.tweens.add({ targets: sp, scale: 0.4, angle: 90, duration: 300, yoyo: true, onComplete: () => sp.destroy() });
    }
    // a SUPER catch is next: the water around the bobber glows gold
    const superNext = superIn() === 1;
    this.superGlow.setPosition(this.bobberRest.x, this.bobberRest.y).setAlpha(superNext && this.phase !== "show" ? 0.45 + 0.25 * Math.sin(time / 180) : 0);
    this.superText.setAlpha(superNext && this.phase === "wait" ? 0.75 + 0.25 * Math.sin(time / 150) : 0);
    // bobbing, nibbling, biting
    if (this.phase === "wait" || this.phase === "bite") {
      const nibble = left < 1500 ? Math.max(0, Math.sin(time / 60)) * 10 * (1 - left / 1500) : 0;
      this.bobber.setPosition(this.bobberRest.x, this.bobberRest.y + Math.sin(time / 420) * 4 + nibble).setAlpha(1);
      if (left < 1500 && this.phase === "wait") this.phase = "bite";
    } else if (this.phase === "reel" && this.bobber.visible) {
      this.bobber.y += (this.bobberRest.y + 24 - this.bobber.y) * 0.3;
      this.bobber.setAlpha(0.5);
    }
    if ((this.phase === "wait" || this.phase === "bite") && this.queue.length) this.reel(this.queue.shift()!);
    this.drawRod(time);
  }
}
