import Phaser from "phaser";
import { HERO_HAND } from "../art/characters";
import { INK_N, lighten, rgba } from "../art/draw";
import { makeEventTextures, makeFishTextures } from "../art/fishing";
import { panelTexture } from "../art/ui";
import { BOOSTS, BOOST_BY_ID } from "../data/boosts";
import {
  EVENT_REWARDS, EventReward, FISH_UPGRADES, FishUpgrade, PRIZES, Prize, ROW_COLORS, ROW_NAMES, SHINY_MULT, SUPER_LUCK, chanceLabel, doubleChance, eventGoal,
  eventReward, goldMult, netMult, prizeChances, upgradeCost,
} from "../data/fishing";
import { TIER_INFO } from "../data/tiers";
import { Catch, buyFish, canBuyFish, cashFor, catchMs, claimEvent, currentDeep, currentLuck, eventNext, eventReady, fishLv, superIn } from "../systems/fishing";
import { persist, save } from "../systems/save";
import { buzz, sfx } from "../systems/sound";
import { fmt } from "./format";
import { Host, Screen } from "./screens";
import { Button, button, drawBar, fitText, iconButton, label, modal, text } from "./widgets";

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

/** The picture of an event reward. */
export function eventRewardIcon(r: EventReward): string {
  switch (r.kind) {
    case "shells": return "fish_shell";
    case "dice": return `die_${r.tier}`;
    case "gems": return "icon_gem";
    case "boost": return BOOST_BY_ID[r.boost!].icon;
    case "luckPotion": return "icon_potion";
    case "lucky": return "fp_clover";
    case "grand": return "icon_gift";
  }
}

/** An event reward in a few words. */
export function eventRewardText(r: EventReward): string {
  switch (r.kind) {
    case "shells": return `${fmt(r.amount)} shells`;
    case "dice": return `${r.amount} ${r.tier} dice`;
    case "gems": return `${r.amount} gems`;
    case "boost": return `${r.amount}x ${BOOST_BY_ID[r.boost!].name}`;
    case "luckPotion": return `${r.amount} min luck potion`;
    case "lucky": return `${r.amount} lucky rolls`;
    case "grand": return `${r.tier} die + ${r.gems} gems`;
  }
}

/** A short amount for the corner of a reward icon. */
const rewardAmount = (r: EventReward) => (r.kind === "grand" ? r.tier! : r.kind === "luckPotion" ? `${r.amount}m` : `x${fmt(r.amount)}`);

const hsv = (h: number, s: number, v: number) => Phaser.Display.Color.HSVToRGB(((h % 1) + 1) % 1, s, v).color;
const GLYPHS = "?#%&@!*$?";

/** A prize on the board: just its picture floating over a shadow, and its chance at the bottom right. */
interface Tile {
  c: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
  chance: Phaser.GameObjects.Text;
  mystery: number;
  x: number;
  y: number;
  /** last scramble of the mystery glyphs */
  scrambleAt: number;
}

/** A fish swimming under the surface, in pond space (x across, z = distance). */
interface Shadow {
  img: Phaser.GameObjects.Image;
  X: number;
  Z: number;
  vX: number;
  vZ: number;
  turnAt: number;
}

type Phase = "cast" | "wait" | "bite" | "reel" | "show";

const COL_W = 270;
const ROW_H = 128;
/** Where things stand in the pond: x across (pixels at distance 1), z distance, y height above the water. */
const PIER = { x1: -700, x2: -330, top: 46, zEnd: 1.95 };
const HERO_AT = { X: -500, Z: 1.9 };
const BOB_AT = { X: 230, Z: 3.4 };

/**
 * The fishing screen. Top: every prize (4 x 5, junk to legends) floating over its shadow with its
 * chance in rainbow colors at its bottom right (the rarest hide behind question marks). Middle:
 * the pond in perspective: water rolling in from the horizon, reflections, the pier reaching out with
 * the hero at its end, fish swimming at different depths; each catch leaps out of the water towards
 * you and flies up to its prize, rare ones get a big reveal. Bottom: time to the next catch, shells,
 * and the upgrades.
 */
export class FishScreen extends Screen {
  private tiles: Tile[] = [];
  private head!: Phaser.GameObjects.Text;
  private pond!: Phaser.GameObjects.Container;
  private far!: Phaser.GameObjects.Container;
  private front!: Phaser.GameObjects.Container;
  private pondTop = 0;
  private pondH = 0;
  private skyH = 0;
  /** camera height: the pond's perspective (see P) */
  private hc = 0;
  private readonly vpx = 560;
  private sunX = 880;
  private waves!: Phaser.GameObjects.Graphics;
  private glints!: Phaser.GameObjects.Graphics;
  private rod!: Phaser.GameObjects.Graphics;
  private hero!: Phaser.GameObjects.Image;
  private bobber!: Phaser.GameObjects.Image;
  private bobberRest = { x: 0, y: 0, k: 1 };
  private clouds: Phaser.GameObjects.Image[] = [];
  private birds: { img: Phaser.GameObjects.Image; v: number }[] = [];
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
  private eventBar!: Phaser.GameObjects.Graphics;
  private eventText!: Phaser.GameObjects.Text;
  private eventRound!: Phaser.GameObjects.Text;
  private eventIcon!: Phaser.GameObjects.Image;
  private eventAmount!: Phaser.GameObjects.Text;
  private eventGlow!: Phaser.GameObjects.Image;
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
  private refreshT = 0;
  private lastLuck = -1;
  private lastDeep = -1;

  constructor(scene: Phaser.Scene, host: Host) {
    super(scene, host, null);
    makeFishTextures(scene);
    makeEventTextures(scene);
    const { width: W } = scene.scale;
    const L = host.L;
    const top = L.headerBottom + 8;
    const gridBottom = top + 60 + 5 * ROW_H;
    // the whole screen is the pond's world: the prizes float in its sky, with nothing behind them
    this.root.add(scene.add.zone(0, 0, W, L.navTop).setOrigin(0).setInteractive());
    this.pondTop = 0;
    const pondBottom = L.navTop - 340;
    this.pondH = pondBottom;
    this.skyH = gridBottom + 24;
    this.buildPond(W);
    // ── the event's title, with the way back to the lobby (the event lives there)
    this.root.add(iconButton(scene, 64, top + 30, "icon_back", 78, () => host.setTab("battle")));
    this.root.add(text(scene, 118, top + 30, "FISHING EVENT", 40, "#ffe066").setOrigin(0, 0.5));
    this.head = text(scene, W - 46, top + 30, "", 30, "#ffffff").setOrigin(1, 0.5);
    this.root.add(this.head);
    PRIZES.forEach((p, i) => this.tiles.push(this.makeTile(p, i, 135 + (i % 4) * COL_W, top + 60 + ROW_H / 2 + Math.floor(i / 4) * ROW_H)));
    // ── next catch, the event's rewards, shells and upgrades
    const by = pondBottom + 14;
    this.bar = scene.add.graphics();
    this.barText = text(scene, W / 2 + 40, by + 44, "", 30);
    this.root.add([
      scene.add.image(W / 2, by + 156, panelTexture(scene, "glass", 1050, 304)),
      scene.add.image(70, by + 44, "fish_bobber").setScale(1.05),
      this.bar, this.barText,
    ]);
    this.buildEventRow(W / 2, by + 144);
    const shellPill = scene.add.container(200, by + 250, [
      scene.add.image(0, 0, panelTexture(scene, "glass", 320, 92)),
      scene.add.image(-110, 0, "fish_shell").setScale(1.1),
    ]);
    this.shellText = text(scene, -60, 0, "", 44).setOrigin(0, 0.5);
    shellPill.add(this.shellText);
    this.upBtn = button(scene, 700, by + 250, 600, 104, "green", "UPGRADES", () => this.showUpgrades(), { size: 44, icon: "fu_speed", iconSize: 70 });
    this.upBadge = scene.add.container(990, by + 208, [scene.add.circle(0, 0, 22, 0xf03e3e).setStrokeStyle(5, INK_N), text(scene, 0, -1, "!", 30)]);
    scene.tweens.add({ targets: this.upBadge, scale: 1.18, duration: 420, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.root.add([shellPill, this.upBtn, this.upBadge]);
    scene.game.events.on("fish-caught", this.onCatch, this);
  }

  // ───────────────────────── the event ─────────────────────────

  /** The event bar: how far to the next reward (its picture on the right); tap to claim or see them all. */
  private buildEventRow(x: number, y: number): void {
    const s = this.scene;
    const bg = s.add.graphics();
    bg.fillStyle(0x0a2a50, 0.55).fillRoundedRect(-505, -46, 1010, 92, 22);
    bg.lineStyle(3, 0xffd23f, 0.8).strokeRoundedRect(-505, -46, 1010, 92, 22);
    this.eventGlow = s.add.image(0, 0, "glow").setTint(0xffd23f).setScale(4.2, 0.55).setAlpha(0);
    s.tweens.add({ targets: this.eventGlow, alpha: { from: 0.2, to: 0.6 }, duration: 520, yoyo: true, repeat: -1 });
    const ribbon = s.add.image(-410, -10, "event_ribbon").setScale(0.62);
    const word = text(s, -410, -14, "EVENT", 26, "#fff3c8");
    this.eventRound = text(s, -410, 28, "", 20, "#9ae6ff");
    this.eventBar = s.add.graphics();
    this.eventText = text(s, -40, 24, "", 24);
    this.eventIcon = s.add.image(400, -4, "fish_shell");
    this.eventAmount = text(s, 446, 26, "", 24, "#ffe066").setOrigin(1, 0.5);
    const c = s.add.container(x, y, [this.eventGlow, bg, ribbon, word, this.eventRound, this.eventBar, this.eventText, this.eventIcon, this.eventAmount])
      .setSize(1010, 92).setInteractive({ useHandCursor: true });
    c.on("pointerdown", () => s.tweens.add({ targets: c, scale: 0.97, duration: 60 }));
    c.on("pointerout", () => c.setScale(1));
    c.on("pointerup", () => {
      c.setScale(1);
      if (eventReady()) this.claim();
      else this.showEvent();
    });
    s.tweens.add({ targets: this.eventIcon, angle: { from: -6, to: 6 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.root.add(c);
  }

  private refreshEvent(): void {
    const e = save.fishing.event;
    const ready = eventReady();
    const n = eventNext();
    this.eventRound.setText(`ROUND ${e.round}`);
    this.eventBar.clear();
    const f = ready ? 1 : (e.points - n.from) / Math.max(1, n.goal - n.from);
    drawBar(this.eventBar, -320, -30, 560, 30, Phaser.Math.Clamp(f, 0, 1), ready ? 0xffd23f : 0x5ac8ff);
    this.eventText.setText(ready ? (ready > 1 ? `${ready} REWARDS READY! TAP TO CLAIM` : "REWARD READY! TAP TO CLAIM") : `Next reward: ${fmt(e.points)} / ${fmt(n.goal)} catches`);
    this.eventText.setColor(ready ? "#ffe066" : "#ffffff");
    fitText(this.eventText, 560);
    this.eventIcon.setTexture(eventRewardIcon(n.reward));
    this.eventIcon.setScale(74 / Math.max(this.eventIcon.width, this.eventIcon.height));
    this.eventAmount.setText(rewardAmount(n.reward));
    this.eventGlow.setVisible(ready > 0);
  }

  /** Every reward of this round: done, ready or how many catches away. */
  private showEvent(): void {
    sfx.click();
    const s = this.scene;
    const e = save.fishing.event;
    const h = 1500;
    const m = this.host.showModal(modal(s, 960, h, "FISHING EVENT", "blue"));
    const ready = eventReady();
    const last = eventGoal(e.round, EVENT_REWARDS - 1);
    const bar = s.add.graphics();
    drawBar(bar, -400, -h / 2 + 196, 800, 36, Math.min(1, e.points / last), 0x5ac8ff);
    m.body.add([
      label(s, 0, -h / 2 + 110, `Round ${e.round}: every catch counts, even while you are away.\nThe rewards help your next fights!`, 30, "#7a5236", 860),
      bar, text(s, 0, -h / 2 + 196, `${fmt(e.points)} / ${fmt(last)} catches`, 26),
    ]);
    for (let k = 0; k < EVENT_REWARDS; k++) {
      const r = eventReward(e.round, k, save.stage);
      const col = k % 2;
      const row = Math.floor(k / 2);
      const x = col ? 220 : -220;
      const y = -h / 2 + 330 + row * 196;
      const done = k < e.claimed;
      const open = !done && e.points >= eventGoal(e.round, k);
      const big = k === EVENT_REWARDS - 1;
      const parts: Phaser.GameObjects.GameObject[] = [s.add.image(0, 0, panelTexture(s, "row", 420, 176)).setAlpha(done ? 0.55 : 1)];
      if (open || big) {
        const glow = s.add.image(-120, -6, "glow").setTint(big ? 0xff9a3a : 0xffd23f).setScale(0.6).setAlpha(0.6);
        s.tweens.add({ targets: glow, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
        parts.push(glow);
      }
      const icon = s.add.image(-120, -6, eventRewardIcon(r)).setAlpha(done ? 0.5 : 1);
      icon.setScale((big ? 104 : 88) / Math.max(icon.width, icon.height));
      parts.push(icon, text(s, -80, 40, rewardAmount(r), 24, "#ffe066").setOrigin(1, 0.5));
      parts.push(fitText(label(s, 60, -34, eventRewardText(r), 26, "#4a2f1d").setOrigin(0.5), 230));
      if (done) parts.push(s.add.image(150, 40, "icon_check").setScale(0.5), label(s, 40, 40, "Claimed", 24, "#3f9a4f"));
      else if (open) parts.push(label(s, 60, 40, "READY!", 30, "#e8434f"));
      else parts.push(label(s, 60, 40, `${fmt(eventGoal(e.round, k))} catches`, 24, "#9a7a5a"));
      if (big) parts.push(text(s, 60, 6, "BIG PRIZE  •  1 in 5: +GOLDEN TICKET", 18, "#ff8a2a"));
      m.body.add(s.add.container(x, y, parts));
    }
    m.body.add(button(s, 0, h / 2 - 100, 460, 110, ready ? "green" : "grey", ready ? "CLAIM" : "OK", () => {
      m.close();
      if (ready) this.claim();
    }, { size: 40 }));
  }

  /** Claim what is ready: the rewards pop up big, then into your pockets. */
  private claim(): void {
    const got = claimEvent();
    if (!got.length) return;
    persist();
    sfx.gift();
    sfx.fanfare();
    buzz(60);
    const s = this.scene;
    const n = got.length;
    const rowH = 130;
    const newRound = save.fishing.event.claimed === 0;
    const won = got.some((r) => r.ticket);
    // notes under the rewards: a new round, and a Golden Ticket in the big prize
    const notes = [newRound ? [`Round ${save.fishing.event.round} starts: bigger rewards!`, "#3f9a4f"] : null, won ? ["...and a GOLDEN TICKET was inside!", "#e8434f"] : null].filter(Boolean) as string[][];
    const h = 330 + n * rowH + notes.length * 50;
    const m = this.host.showModal(modal(s, 820, h, "EVENT REWARDS!", "orange"));
    got.forEach((r, i) => {
      const y = -h / 2 + 170 + i * rowH;
      const glow = s.add.image(-260, y, "glow").setTint(r.kind === "dice" || r.kind === "grand" ? TIER_INFO[r.tier!].color : 0xffd23f).setScale(0.55).setAlpha(0.6);
      const icon = s.add.image(-260, y, eventRewardIcon(r));
      icon.setScale(96 / Math.max(icon.width, icon.height));
      const lbl = fitText(label(s, -180, y, eventRewardText(r), 36, "#4a2f1d").setOrigin(0, 0.5), 520);
      const row = s.add.container(0, 0, [glow, icon, lbl]).setAlpha(0);
      m.body.add(row);
      s.tweens.add({ targets: row, alpha: 1, duration: 200, delay: 150 + i * 160 });
      s.tweens.add({ targets: icon, scale: { from: 0, to: icon.scale }, duration: 360, delay: 150 + i * 160, ease: "Back.out" });
    });
    notes.forEach(([str, col], i) => m.body.add(text(s, 0, -h / 2 + 130 + n * rowH + i * 50, str, 30, col)));
    m.body.add(button(s, 0, h / 2 - 90, 360, 110, "green", "GREAT!", () => m.close(), { size: 40 }));
    // the whole screen celebrates the ticket once the rewards are out
    if (won) s.time.delayedCall(400 + n * 160, () => this.host.ticketShow("It was inside the event's big prize!"));
    this.refreshEvent();
  }

  // ───────────────────────── the prizes ─────────────────────────

  private makeTile(p: Prize, i: number, x: number, y: number): Tile {
    const s = this.scene;
    const color = ROW_COLORS[p.row];
    const parts: Phaser.GameObjects.GameObject[] = [];
    // epic and legend prizes glow softly behind
    if (p.row >= 3) {
      const glow = s.add.image(-30, -6, "glow").setTint(color).setScale(0.55).setAlpha(0.45);
      s.tweens.add({ targets: glow, alpha: 0.15, scale: 0.48, duration: 800 + p.row * 150, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      parts.push(glow);
    }
    const icon = s.add.image(-30, -6, prizeIcon(p));
    icon.setScale(100 / Math.max(icon.width, icon.height));
    const chance = text(s, 2, 38, "", 34).setOrigin(0, 0.5);
    parts.push(icon, chance);
    const c = s.add.container(x, y, parts).setSize(240, ROW_H).setInteractive({ useHandCursor: true });
    // float gently in the sky, each a little out of step
    s.tweens.add({ targets: icon, y: -16, duration: 1300 + (i % 5) * 110, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: i * 90 });
    c.on("pointerdown", () => s.tweens.add({ targets: c, scale: 0.92, duration: 60 }));
    c.on("pointerout", () => c.setScale(1));
    c.on("pointerup", () => {
      c.setScale(1);
      this.showPrize(i);
    });
    this.root.add(c);
    return { c, icon, chance, mystery: 0, x, y, scrambleAt: 0 };
  }

  private refreshTiles(): void {
    const luck = currentLuck();
    const deep = currentDeep();
    const ch = prizeChances(luck, deep);
    this.head.setText(`LUCK x${luck >= 10 ? Math.round(luck) : luck.toFixed(1)}  •  DEEP x${deep.toFixed(2)}`);
    PRIZES.forEach((_, i) => {
      const t = this.tiles[i];
      const lbl = chanceLabel(ch[i]);
      t.mystery = lbl.mystery;
      if (lbl.mystery < 4) t.chance.setText(lbl.text);
      t.chance.setFontSize(lbl.mystery ? 44 : 34);
      fitText(t.chance, 150);
    });
    this.lastLuck = luck;
    this.lastDeep = deep;
  }

  /** Every chance runs through the rainbow (rarer rows faster); the question marks wobble, the deepest scramble. */
  private animateTiles(time: number): void {
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i];
      const row = PRIZES[i].row;
      const h = time / (2600 - row * 380) + i * 0.13;
      t.chance.setTint(hsv(h, 0.55, 1), hsv(h + 0.12, 0.55, 1), hsv(h + 0.24, 0.6, 1), hsv(h + 0.36, 0.6, 1));
      if (t.mystery === 0) {
        t.chance.setAngle(0);
        continue;
      }
      const ph = time / 1000 + i * 0.37;
      t.chance.setAngle(Math.sin(ph * (2 + t.mystery)) * (4 + 2 * t.mystery));
      if (t.mystery === 4) {
        if (time - t.scrambleAt > 90) {
          t.scrambleAt = time;
          let str = "";
          for (let k = 0; k < 4; k++) str += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          t.chance.setText(str);
          fitText(t.chance, 150);
        }
        t.chance.setAlpha(0.65 + 0.35 * Math.abs(Math.sin(ph * 7)));
        t.chance.setX(2 + (Math.random() - 0.5) * 4);
      }
    }
  }

  private showPrize(i: number): void {
    sfx.click();
    const s = this.scene;
    const p = PRIZES[i];
    const caught = save.fishing.caught[p.id] ?? 0;
    const color = ROW_COLORS[p.row];
    const m = this.host.showModal(modal(s, 820, 880, p.name, "blue"));
    const icon = s.add.image(0, -200, prizeIcon(p));
    icon.setScale(230 / Math.max(icon.width, icon.height));
    const rays = s.add.image(0, -200, "rays").setTint(color).setAlpha(0.45).setScale(0.75);
    s.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
    s.tweens.add({ targets: icon, y: -214, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const lbl = chanceLabel(prizeChances(currentLuck(), currentDeep())[i]);
    const chance = lbl.mystery === 4 ? "Chance: a complete mystery..." : lbl.mystery ? `Chance: ${lbl.text}  (tiny, tiny)` : `Chance: ${lbl.text} per catch`;
    m.body.add([
      rays, icon,
      text(s, 0, -40, ROW_NAMES[p.row].toUpperCase(), 40, rgba(lighten(color, 0.2))),
      label(s, 0, 40, `You get: ${prizeGift(p)}`, 36, "#4a2f1d", 700),
      label(s, 0, 120, chance, 32, "#7a5236", 700),
      label(s, 0, 190, caught ? `Caught ${fmt(caught)} ${caught === 1 ? "time" : "times"}` : "Never caught yet", 30, "#9a7a5a"),
      label(s, 0, 260, p.row >= 2 ? "Lucky Bait and Deeper Water make it bite more often" : "Always easy to catch", 26, "#9a7a5a", 700),
      button(s, 0, 350, 360, 110, "green", "OK", () => m.close(), { size: 40 }),
    ]);
  }

  // ───────────────────────── the pond, in perspective ─────────────────────────

  /** Pond space to screen: x across and y height above the water, at distance z (1 = the bottom edge). */
  private P(X: number, Z: number, Y = 0): [number, number] {
    return [this.vpx + X / Z, this.skyH + (this.hc - Y) / Z];
  }

  private buildPond(W: number): void {
    const s = this.scene;
    const h = this.pondH;
    const skyH = this.skyH;
    this.hc = h - skyH + 10;
    const pond = s.add.container(0, this.pondTop);
    this.pond = pond;
    // sky, and the water getting lighter and hazier towards the horizon
    const g = s.add.graphics();
    g.fillGradientStyle(0x6cbcf0, 0x6cbcf0, 0xd8f3ff, 0xd8f3ff, 1).fillRect(0, 0, W, skyH);
    g.fillGradientStyle(0xa8e2f8, 0xa8e2f8, 0x3f9ad8, 0x3f9ad8, 1).fillRect(0, skyH, W, (h - skyH) * 0.45);
    g.fillGradientStyle(0x3f9ad8, 0x3f9ad8, 0x174a80, 0x174a80, 1).fillRect(0, skyH + (h - skyH) * 0.45 - 1, W, (h - skyH) * 0.55 + 1);
    pond.add(g);
    // far away: sun, clouds, hills and their reflection (they sway the least)
    const far = s.add.container(0, 0);
    this.far = far;
    const sunY = skyH * 0.36;
    const sun = s.add.image(this.sunX, sunY, "glow").setTint(0xfff3a8).setScale(0.9).setAlpha(0.9);
    s.tweens.add({ targets: sun, scale: 1, duration: 2200, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    far.add([sun, s.add.circle(this.sunX, sunY, 40, 0xfff7c0)]);
    for (let i = 0; i < 4; i++) {
      const c = s.add.image(80 + i * 300, skyH * (0.14 + 0.13 * (i % 3)), "fish_cloud").setScale(0.45 + 0.18 * (i % 3)).setAlpha(0.9);
      this.clouds.push(c);
      far.add(c);
    }
    const hillK = Math.min(1, (skyH * 0.75) / 260);
    far.add(s.add.image(-20, skyH + 2, "fish_hills").setOrigin(0, 1).setScale(1.04, hillK));
    far.add(s.add.image(-20, skyH, "fish_hills").setOrigin(0, 1).setScale(1.04, -hillK * 0.55).setAlpha(0.22).setTint(0x8fd0f0));
    far.add(s.add.image(this.sunX, skyH + (h - skyH) * 0.2, "glow").setTint(0xfff3a8).setScale(0.5, 1.6).setAlpha(0.25));
    for (let i = 0; i < 2; i++) {
      const b = s.add.image(-60 - i * 400, skyH * (0.25 + 0.2 * i), "fish_bird").setScale(0.5 - 0.15 * i);
      this.birds.push({ img: b, v: 0.7 - 0.25 * i });
      far.add(b);
    }
    pond.add(far);
    // a white haze along the horizon
    const haze = s.add.graphics();
    haze.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0, 0, 0.45, 0.45).fillRect(0, skyH - 24, W, 24);
    haze.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.45, 0.45, 0, 0).fillRect(0, skyH, W, 30);
    pond.add(haze);
    // waves rolling in, and the sun's glitter path (drawn every frame)
    this.waves = s.add.graphics();
    this.glints = s.add.graphics();
    pond.add([this.waves, this.glints]);
    // lily pads and fish shadows at their distances
    for (const [X, Z] of [[700, 1.6], [-60, 3.8], [880, 3], [180, 6.5], [620, 8]] as [number, number][]) {
      const [x, y] = this.P(X, Z);
      const lily = s.add.image(x, y, "fish_lily").setScale(1.5 / Z);
      this.lilies.push(lily);
      pond.add(lily);
    }
    for (let i = 0; i < 4; i++) {
      const img = s.add.image(0, 0, "fish_shadow").setAlpha(0.22);
      this.shadows.push({ img, X: -100 + i * 260, Z: 1.6 + i * 1.1, vX: (i % 2 ? 1 : -1) * 120, vZ: 0, turnAt: 0 });
      pond.add(img);
    }
    this.superGlow = s.add.image(0, 0, "glow").setTint(0xffd23f).setAlpha(0);
    pond.add(this.superGlow);
    // the pier reaching out over the water
    const pier = s.add.graphics();
    this.drawPier(pier);
    pond.add(pier);
    const [bx, by] = this.P(-640, 1.72, PIER.top);
    pond.add(s.add.image(bx, by, "fish_bucket").setOrigin(0.5, 0.95).setScale(1.25 / 1.72));
    const [hx, hy] = this.P(HERO_AT.X, HERO_AT.Z, PIER.top);
    this.hero = s.add.image(hx, hy, "hero").setOrigin(0.5, 0.95).setScale(2 / HERO_AT.Z);
    s.tweens.add({ targets: this.hero, scaleY: this.hero.scaleY * 0.975, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    pond.add(this.hero);
    this.rod = s.add.graphics();
    pond.add(this.rod);
    const [rx, ry] = this.P(BOB_AT.X, BOB_AT.Z);
    this.bobberRest = { x: rx, y: ry, k: 2.4 / BOB_AT.Z };
    this.bobber = s.add.image(rx, ry, "fish_bobber").setOrigin(0.5, 0.75).setScale(this.bobberRest.k);
    pond.add(this.bobber);
    this.superText = text(s, rx, ry - 90, "SUPER BITE!", 38, "#ffe066").setAlpha(0);
    pond.add(this.superText);
    this.bang = s.add.container(hx, hy - this.hero.displayHeight - 50, [s.add.circle(0, 0, 38, 0xffffff).setStrokeStyle(6, INK_N), text(s, 0, -2, "!", 58, "#ff4a4a")]).setScale(0);
    pond.add(this.bang);
    // close to you: tall reeds in front (they sway the most)
    const front = s.add.container(0, 0);
    this.front = front;
    front.add(s.add.image(W - 50, h + 20, "fish_reeds").setOrigin(0.5, 1).setScale(Math.min(1.5, h / 330)));
    front.add(s.add.image(W - 190, h + 30, "fish_reeds").setOrigin(0.5, 1).setScale(Math.min(1.1, h / 450)).setFlipX(true));
    pond.add(front);
    // what the line is like right now
    const chip = (x: number, icon: string) => {
      const t = text(s, x + 34, h - 48, "", 30).setOrigin(0, 0.5);
      pond.add([s.add.image(x + 74, h - 48, panelTexture(s, "glass", 200, 64)), s.add.image(x + 6, h - 48, icon).setScale(0.48), t]);
      this.chips.push(t);
    };
    chip(20, "icon_clock");
    chip(232, "fu_hook");
    chip(444, "fu_super");
    // nothing spills over the bottom panel
    const mask = s.make.graphics({}, false);
    mask.fillStyle(0xffffff).fillRect(0, this.pondTop, W, h);
    pond.setMask(mask.createGeometryMask());
    this.root.add(pond);
  }

  /** Planks in perspective (thinner further away), the side beam, posts going into the water with their reflections. */
  private drawPier(g: Phaser.GameObjects.Graphics): void {
    const V = (X: number, Z: number, Y: number) => new Phaser.Math.Vector2(...this.P(X, Z, Y));
    const { x1, x2, top, zEnd } = PIER;
    const z0 = Math.max(0.5, (this.hc - top) / (this.pondH + 40 - this.skyH));
    // a soft shade on the water along the pier
    g.fillStyle(0x0a2a50, 0.25).fillPoints([V(x2, z0, 0), V(x2 + 120, z0, 0), V(x2 + 50, zEnd, 0), V(x2, zEnd, 0)], true);
    // posts (with wobbly reflections) along the side we can see
    for (let z = zEnd - 0.04; z > z0; z -= 0.32) {
      const w = 30 / z;
      const [px, py] = this.P(x2 - 14, z, top - 22);
      const [, wy] = this.P(x2 - 14, z, 0);
      for (let k = 0; k < 6; k++) g.fillStyle(0x3a2412, 0.22 - k * 0.03).fillRect(px - w / 2 + Math.sin(k * 1.7) * 4, wy + (k * 14) / z, w, 12 / z);
      g.fillStyle(0x5a3a20, 1).fillRect(px - w / 2, py, w, wy - py + 10 / z);
      g.fillStyle(0x7a5232, 1).fillRect(px - w / 2, py, w * 0.4, wy - py + 10 / z);
      g.fillStyle(0xffffff, 0.35).fillRect(px - w / 2 - 2, wy + 4 / z, w + 4, 3);
    }
    // the side beam
    g.fillStyle(0x6e4426, 1).fillPoints([V(x2, z0, top), V(x2, zEnd, top), V(x2, zEnd, top - 24), V(x2, z0, top - 24)], true);
    g.fillStyle(0x000000, 0.2).fillPoints([V(x2, z0, top - 14), V(x2, zEnd, top - 14), V(x2, zEnd, top - 24), V(x2, z0, top - 24)], true);
    // the planks: same size in the world, so they shrink into the distance
    let n = 0;
    for (let z = z0; z < zEnd; z += 0.085) {
      const z2 = Math.min(zEnd, z + 0.07);
      const light = n++ % 2 ? 0xc8884a : 0xd49556;
      g.fillStyle(light, 1).fillPoints([V(x1, z, top), V(x2, z, top), V(x2, z2, top), V(x1, z2, top)], true);
      g.fillStyle(0xffffff, 0.12).fillPoints([V(x1, z, top), V(x2, z, top), V(x2, z + 0.012, top), V(x1, z + 0.012, top)], true);
      g.fillStyle(0x5a3a20, 0.8).fillPoints([V(x1, z2, top), V(x2, z2, top), V(x2, z2 + 0.015, top), V(x1, z2 + 0.015, top)], true);
      for (const X of [x1 + 30, x2 - 30]) {
        const [nx, ny] = this.P(X, (z + z2) / 2, top);
        g.fillStyle(0x4a2f1d, 1).fillCircle(nx, ny, 5 / z);
      }
    }
    g.lineStyle(5, INK_N, 1).strokePoints([V(x2, z0, top), V(x2, zEnd, top), V(x1, zEnd, top)]);
    // two mooring posts at the end, one with a coil of rope
    for (const X of [x1 + 40, x2 - 40]) {
      const z = zEnd - 0.03;
      const w = 34 / z;
      const [px, py] = this.P(X, z, top + 58);
      const [, by] = this.P(X, z, top);
      g.fillStyle(0x5a3a20, 1).fillRect(px - w / 2, py, w, by - py);
      g.fillStyle(0x8a5a32, 1).fillRect(px - w / 2, py, w * 0.45, by - py);
      g.fillStyle(0xa8743e, 1).fillEllipse(px, py, w, w * 0.4);
      g.lineStyle(3, INK_N, 1).strokeRect(px - w / 2, py, w, by - py);
      if (X === x1 + 40) {
        g.lineStyle(7, 0xe8d0a0, 1).strokeEllipse(px, by - w * 0.6, w * 1.4, w * 0.5);
        g.lineStyle(7, 0xd8bc88, 1).strokeEllipse(px, by - w * 1.0, w * 1.2, w * 0.42);
      }
    }
  }

  /** Rod from the hero's hand: it bends when something pulls and swings when you cast. */
  private drawRod(time: number): { tx: number; ty: number } {
    const g = this.rod;
    g.clear();
    const k = this.hero.scaleX;
    const hx = this.hero.x + HERO_HAND.x * k;
    const hy = this.hero.y + HERO_HAND.y * k;
    const len = 290 * k;
    const a = -0.9 + this.bend * 0.6 + this.swing + Math.sin(time / 900) * 0.02;
    const tx = hx + Math.cos(a) * len;
    const ty = hy + Math.sin(a) * len;
    const mx = hx + Math.cos(a - this.bend * 0.3) * len * 0.55;
    const my = hy + Math.sin(a - this.bend * 0.3) * len * 0.55;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push(new Phaser.Math.Vector2((1 - t) * (1 - t) * hx + 2 * (1 - t) * t * mx + t * t * tx, (1 - t) * (1 - t) * hy + 2 * (1 - t) * t * my + t * t * ty));
    }
    g.lineStyle(14 * k, INK_N, 1).strokePoints(pts);
    g.lineStyle(8 * k, 0xc8884a, 1).strokePoints(pts.slice(0, 9));
    g.lineStyle(6 * k, 0xe8c070, 1).strokePoints(pts.slice(8));
    g.lineStyle(2 * k, 0xffffff, 0.5).strokePoints(pts.slice(1, 12));
    const rx = hx + Math.cos(a) * 36 * k;
    const ry = hy + Math.sin(a) * 36 * k;
    g.fillStyle(0xd8e0e8, 1).fillCircle(rx, ry, 11 * k);
    g.lineStyle(4, INK_N, 1).strokeCircle(rx, ry, 11 * k);
    const end = this.lineTo ?? { x: this.bobber.x, y: this.bobber.y - this.bobber.displayHeight * 0.7 };
    if (this.bobber.visible || this.lineTo) {
      const cx = (tx + end.x) / 2;
      const cy = (ty + end.y) / 2 + 80 * this.slack;
      const line: Phaser.Math.Vector2[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        line.push(new Phaser.Math.Vector2((1 - t) * (1 - t) * tx + 2 * (1 - t) * t * cx + t * t * end.x, (1 - t) * (1 - t) * ty + 2 * (1 - t) * t * cy + t * t * end.y));
      }
      g.lineStyle(3, 0xffffff, 0.85).strokePoints(line);
    }
    return { tx, ty };
  }

  /** Lines of ripples roll in from the horizon, spreading and growing as they come closer; the sun glitters on them. */
  private drawWaves(time: number): void {
    const g = this.waves;
    g.clear();
    const W = this.scene.scale.width;
    const top = this.skyH;
    const wh = this.pondH - top;
    const N = 16;
    for (let i = 0; i < N; i++) {
      const u = (i / N + time / 14000) % 1;
      const y = top + 6 + wh * u ** 1.8;
      const amp = 1 + 8 * u;
      const seg = 18 + 150 * u;
      const gap = seg * (0.7 + 0.3 * Math.sin(i * 2.1));
      const off = (i * 137 + time * 0.012 * (0.4 + u)) % (seg + gap);
      g.lineStyle(1.5 + 5 * u, 0xffffff, Math.min(0.42, 0.08 + 0.6 * u) * (1 - Math.max(0, u - 0.85) / 0.15));
      for (let x = -off; x < W; x += seg + gap) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + seg * 0.5, y - amp);
        g.lineTo(x + seg, y);
        g.strokePath();
      }
    }
    const gl = this.glints;
    gl.clear();
    const tick = Math.floor(time / 140);
    for (let k = 0; k < 26; k++) {
      const r = Math.sin(k * 12.9898 + tick * 78.233) * 43758.5453;
      const rnd = r - Math.floor(r);
      const u = (k / 26) ** 1.4;
      const y = top + 8 + wh * 0.75 * u;
      const x = this.sunX + this.far.x + (rnd - 0.5) * (30 + 260 * u);
      gl.fillStyle(0xffffff, 0.35 + 0.5 * rnd).fillEllipse(x, y, 6 + 34 * u * rnd, 2 + 3 * u);
    }
  }

  private ripple(x: number, y: number, k: number, big = false): void {
    const s = this.scene;
    const r = s.add.image(x, y, "ring").setScale((big ? 0.5 : 0.25) * k, (big ? 0.15 : 0.08) * k).setAlpha(0.8);
    this.pond.add(r);
    this.pond.moveBelow(r, this.bobber);
    s.tweens.add({ targets: r, scaleX: (big ? 1.8 : 1) * k, scaleY: (big ? 0.55 : 0.3) * k, alpha: 0, duration: big ? 900 : 1300, ease: "Quad.out", onComplete: () => r.destroy() });
  }

  /** Water drops flying up from a point (smaller far away). */
  private splash(x: number, y: number, n: number, k: number): void {
    const s = this.scene;
    for (let i = 0; i < n; i++) {
      const d = s.add.image(x, y, "fish_drop").setScale((0.6 + Math.random() * 0.7) * k);
      this.pond.add(d);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const v = (120 + Math.random() * 180) * k;
      s.tweens.add({ targets: d, x: x + Math.cos(a) * v, duration: 600, ease: "Linear" });
      s.tweens.add({ targets: d, y: y + Math.sin(a) * v, duration: 300, ease: "Quad.out", yoyo: true, onComplete: () => d.destroy() });
    }
    this.ripple(x, y, k, true);
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
    this.splash(this.bobberRest.x, this.bobberRest.y, 10, this.bobberRest.k);
    this.superGlow.setAlpha(0);
    s.time.delayedCall(this.hurry ? 160 : 320, () => {
      sfx.reel();
      this.bobber.setVisible(false);
      this.showGroup(group, 0);
    });
  }

  /**
   * Each prize leaps out where the bobber was and comes flying at you: it grows as it gets closer,
   * with its shadow sliding over the water under it, and a spray of drops behind.
   */
  private showGroup(group: Catch[], i: number): void {
    const s = this.scene;
    if (i >= group.length) {
      this.lineTo = null;
      this.cast();
      return;
    }
    const c = group[i];
    const p = PRIZES[c.prize];
    const img = s.add.image(0, 0, prizeIcon(p));
    const base = 120 / Math.max(img.width, img.height);
    const shade = s.add.ellipse(0, 0, 90, 22, 0x0a2a50, 0.4);
    this.pond.add([shade, img]);
    const end = { X: 60, Z: 1.25, Y: this.hc * 0.42 };
    const k = { t: 0 };
    this.phase = "show";
    const place = () => {
      const t = k.t;
      const Z = 1 / (1 / BOB_AT.Z + (1 / end.Z - 1 / BOB_AT.Z) * t);
      const X = BOB_AT.X + (end.X - BOB_AT.X) * t;
      const Y = end.Y * t + Math.sin(t * Math.PI) * this.hc * 0.3;
      const [x, y] = this.P(X, Z, Y);
      const [sx, sy] = this.P(X, Z, 0);
      img.setPosition(x, y).setScale(base * (1.6 / Z)).setAngle(t * 360);
      shade.setPosition(sx, sy).setScale(1.3 / Z).setAlpha(0.4 * (1 - Math.min(0.8, Y / this.hc)));
    };
    place();
    s.tweens.add({
      targets: k, t: 1, duration: this.hurry ? 420 : 620, ease: "Quad.out",
      onUpdate: () => {
        place();
        this.lineTo = { x: img.x, y: img.y };
        if (Math.random() < 0.45) {
          const d = s.add.image(img.x, img.y, "fish_drop").setScale(img.scale * 2);
          this.pond.add(d);
          s.tweens.add({ targets: d, y: d.y + 90, alpha: 0, duration: 420, onComplete: () => d.destroy() });
        }
      },
      onComplete: () => {
        shade.destroy();
        this.lineTo = null;
        this.slack = 1;
        const k2 = { b: this.bend };
        s.tweens.add({ targets: k2, b: 0, duration: 260, ease: "Back.out", onUpdate: () => (this.bend = k2.b) });
        const big = p.row >= 2 || c.shiny || c.super || !(save.fishing.caught[p.id] > 1);
        const after = () => this.flyToTile(img, c, () => this.showGroup(group, i + 1));
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
    s.tweens.add({ targets: img, scale: base * 1.25, duration: 120, yoyo: true });
    const t = text(s, img.x, img.y - img.displayHeight * 0.7, prizeGift(p, c), 36, rgba(lighten(ROW_COLORS[p.row], 0.35)));
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
    if (first) tags.push(c.bonus ? `NEW PRIZE!  +${fmt(c.bonus)} shells` : "NEW PRIZE!");
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

  /** The prize flies up to its place on the board, which pops. */
  private flyToTile(img: Phaser.GameObjects.Image, c: Catch, done: () => void): void {
    const s = this.scene;
    const t = this.tiles[c.prize];
    const p = PRIZES[c.prize];
    this.pond.remove(img);
    this.root.add(img);
    img.setPosition(img.x, img.y + this.pondTop);
    s.tweens.add({
      targets: img, x: t.x + t.icon.x, y: t.y + t.icon.y, scale: t.icon.scale, angle: 0, duration: this.hurry ? 320 : 460, ease: "Cubic.in",
      onComplete: () => {
        img.destroy();
        sfx.coin();
        t.c.setScale(1.3);
        s.tweens.add({ targets: t.c, scale: 1, duration: 300, ease: "Back.out" });
        const ring = s.add.circle(t.x + t.icon.x, t.y + t.icon.y, 50).setStrokeStyle(8, ROW_COLORS[p.row]);
        this.root.add(ring);
        s.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
        if (p.kind === "cash") this.host.coinShower(t.x, t.y, 4);
        this.refreshTiles();
      },
    });
    s.time.delayedCall(this.hurry ? 120 : 220, done);
  }

  /** Swing the rod back and forward: the bobber flies out and plops into the water far away. */
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
      this.bobber.setVisible(true).setPosition(tx, ty).setAngle(0).setScale(this.hero.scaleX * 1.1);
      this.slack = 0.3;
      const f = { t: 0 };
      s.tweens.add({
        targets: f, t: 1, duration: this.hurry ? 300 : 460, ease: "Sine.in",
        onUpdate: () => {
          this.bobber.setPosition(tx + (end.x - tx) * f.t, ty + (end.y - ty) * f.t - Math.sin(f.t * Math.PI) * 160).setAngle(f.t * 360)
            .setScale(this.hero.scaleX * 1.1 + (end.k - this.hero.scaleX * 1.1) * f.t);
          this.slack = 0.3 + 0.7 * f.t;
        },
        onComplete: () => {
          this.bobber.setAngle(0);
          sfx.plop();
          this.splash(end.x, end.y, 6, end.k);
          this.phase = "wait";
        },
      });
    });
  }

  // ───────────────────────── upgrades ─────────────────────────

  private showUpgrades(): void {
    sfx.click();
    const s = this.scene;
    const rowH = 150;
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
      const name = label(s, -310, y - 48, u.name, 38, "#4a2f1d").setOrigin(0, 0.5);
      const lv = label(s, 0, y - 48, "", 28, "#c9663a").setOrigin(0, 0.5);
      const desc = fitText(label(s, -310, y - 12, u.desc, 24, "#9a7a5a").setOrigin(0, 0.5), 470);
      const eff = label(s, -310, y + 20, "", 30, "#3f9a4f").setOrigin(0, 0.5);
      // how far this upgrade is: one notch per level
      const bar = s.add.graphics();
      const barText = text(s, 210, y + 50, "", 22).setOrigin(1, 0.5);
      const icon = s.add.image(-380, y, u.icon).setScale(0.82);
      const buy: Button = button(s, 330, y - 8, 240, 104, "green", "", () => {
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
      m.body.add([s.add.image(0, y, panelTexture(s, "row", 900, rowH - 10)), icon, name, lv, desc, eff, bar, barText, buy]);
      rows.push(() => {
        const l = fishLv(u.id);
        const max = l >= u.max;
        lv.setText(`Lv ${l}/${u.max}`).setX(-310 + name.width + 20);
        eff.setText(max ? `${u.show(l)}  (max)` : `${u.show(l)}  →  ${u.show(l + 1)}`);
        bar.clear();
        drawBar(bar, -400, y + 40, 620, 22, l / u.max, max ? 0xffcf3a : 0x5ac8ff);
        if (u.max <= 30) for (let k = 1; k < u.max; k++) bar.fillStyle(0x4a2f1d, 0.35).fillRect(-400 + (620 * k) / u.max - 1, y + 40, 2, 22);
        barText.setText(max ? "COMPLETE!" : `${l}/${u.max}`).setColor(max ? "#ffe066" : "#ffffff");
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
    this.bobber.setVisible(true).setPosition(this.bobberRest.x, this.bobberRest.y).setAngle(0).setScale(this.bobberRest.k);
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
    const W = s.scale.width;
    const now = Date.now();
    const left = Math.max(0, save.fishing.nextAt - now);
    this.refreshT -= 16;
    if (this.refreshT <= 0) {
      this.refreshT = 250;
      if (currentLuck() !== this.lastLuck || currentDeep() !== this.lastDeep) this.refreshTiles();
      const secs = catchMs() / 1000;
      this.chips[0].setText(secs >= 10 ? `${Math.round(secs)}s` : `${secs.toFixed(1)}s`);
      this.chips[1].setText(`${Math.round(doubleChance(fishLv("hook")) * 100)}%`);
      this.chips[2].setText(superIn() === 1 ? "NEXT!" : `in ${superIn()}`);
      this.shellText.setText(fmt(save.fishing.shells));
      fitText(this.shellText, 190);
      this.upBadge.setVisible(FISH_UPGRADES.some((u: FishUpgrade) => canBuyFish(u.id)));
      this.refreshEvent();
    }
    const f = 1 - left / catchMs();
    this.bar.clear();
    drawBar(this.bar, 120, this.pondTop + this.pondH + 14 + 24, 900, 40, Phaser.Math.Clamp(f, 0, 1), left < 1000 ? 0xffe066 : 0x5ac8ff);
    this.barText.setText(left < 900 ? "Something's biting...!" : `Next catch in ${Math.ceil(left / 1000)}s`);
    this.animateTiles(time);
    // the camera sways a little: far things move less than near ones
    const sway = Math.sin(time / 2600) * 10;
    this.far.x = -sway * 0.5;
    this.front.x = sway * 1.3;
    this.drawWaves(time);
    for (const c of this.clouds) {
      c.x += 0.12 + c.scale * 0.2;
      if (c.x > W + 140) c.x = -140;
    }
    for (const b of this.birds) {
      b.img.x += b.v;
      b.img.y += Math.sin(time / 300 + b.v * 10) * 0.25;
      b.img.setScale(b.img.scaleX, Math.abs(b.img.scaleX) * (0.6 + 0.4 * Math.abs(Math.sin(time / 140 + b.v * 5))));
      if (b.img.x > W + 80) b.img.x = -80 - Math.random() * 600;
    }
    this.lilies.forEach((l, i) => l.setAngle(Math.sin(time / 1300 + i) * 3));
    // fish swim about at their depths; when a bite is near, one heads for the bobber
    for (const sh of this.shadows) {
      if (time > sh.turnAt) {
        sh.turnAt = time + 2500 + Math.random() * 4000;
        sh.vX = (Math.random() < 0.5 ? -1 : 1) * (80 + Math.random() * 120);
        sh.vZ = (Math.random() - 0.5) * 0.5;
      }
      if ((this.phase === "bite" || left < 1500) && sh === this.shadows[0]) {
        sh.vX = Phaser.Math.Clamp((BOB_AT.X + 70 - sh.X) * 2, -260, 260);
        sh.vZ = Phaser.Math.Clamp((BOB_AT.Z + 0.05 - sh.Z) * 2, -1, 1);
      }
      sh.X = Phaser.Math.Clamp(sh.X + sh.vX / 60, -250, 1300);
      sh.Z = Phaser.Math.Clamp(sh.Z + sh.vZ / 60, 1.25, 7);
      const [x, y] = this.P(sh.X, sh.Z, -14);
      sh.img.setPosition(x, y).setScale(1.1 / sh.Z).setFlipX(sh.vX > 0).setAlpha(0.12 + 0.12 / sh.Z);
    }
    this.rippleT -= 16;
    if (this.phase === "wait" && this.rippleT <= 0) {
      this.rippleT = 1400;
      this.ripple(this.bobber.x, this.bobber.y, this.bobberRest.k);
    }
    // a SUPER catch is next: the water around the bobber glows gold
    const superNext = superIn() === 1;
    const k = this.bobberRest.k;
    this.superGlow.setPosition(this.bobberRest.x, this.bobberRest.y).setScale(1.4 * k, 0.45 * k).setAlpha(superNext && this.phase !== "show" ? 0.45 + 0.25 * Math.sin(time / 180) : 0);
    this.superText.setAlpha(superNext && this.phase === "wait" ? 0.75 + 0.25 * Math.sin(time / 150) : 0);
    // bobbing, nibbling, biting
    if (this.phase === "wait" || this.phase === "bite") {
      const nibble = left < 1500 ? Math.max(0, Math.sin(time / 60)) * 10 * k * (1 - left / 1500) : 0;
      this.bobber.setPosition(this.bobberRest.x, this.bobberRest.y + Math.sin(time / 420) * 3 * k + nibble).setAlpha(1);
      if (left < 1500 && this.phase === "wait") this.phase = "bite";
    } else if (this.phase === "reel" && this.bobber.visible) {
      this.bobber.y += (this.bobberRest.y + 20 * k - this.bobber.y) * 0.3;
      this.bobber.setAlpha(0.5);
    }
    if ((this.phase === "wait" || this.phase === "bite") && this.queue.length) this.reel(this.queue.shift()!);
    this.drawRod(time);
  }
}
