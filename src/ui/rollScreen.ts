import Phaser from "phaser";
import { INK_N, canvasTexture, linear } from "../art/draw";
import { petKey, petTexture } from "../art/pets";
import { makePickupTextures } from "../art/pickups";
import { CARD_H, CARD_W, dieTexture, panelTexture, pillTexture } from "../art/ui";
import { ItemDef, PET_LIST } from "../data/items";
import { petChances } from "../data/luck";
import { RARITY_INFO, RARITY_ORDER, rainbowColor, rarityRank } from "../data/rarity";
import { DICE_LUCK, DICE_TIERS, TIER_INFO, Tier, tierIndex } from "../data/tiers";
import { TOP_ROW, TOP_Y } from "../layout";
import { RollResult } from "../systems/roll";
import { ROLL_BATCHES, persist, save, totalDice } from "../systems/save";
import { buzz, sfx } from "../systems/sound";
import { autoUnlocked, dieSkin, luck, luckParts, luckyEvery, luckyMult, potionActive, rollTime, speedActive } from "../systems/stats";
import { fmt, luckText, oneIn } from "./format";
import { classBadge, classText, setClassTint } from "./classText";
import { Host, Screen } from "./screens";
import { Button, button, drawBar, fitText, label, lockedCard, text } from "./widgets";

/** Every this many rolls is a SUPER ROLL with x10 luck. */
export const SUPER_EVERY = 50;
export const SUPER_MULT = 10;
/** Every this many rolls you get a little gift of dice and gems. */
export const GIFT_EVERY = 25;
/** Hot streak: each roll soon after the last adds +2% luck, up to +50%. */
const STREAK_STEP = 0.02;
const STREAK_MAX = 25;
const streakWindow = () => 7000 + rollTime();
export const streakMult = (n: number) => 1 + Math.min(STREAK_MAX, Math.max(0, n - 1)) * STREAK_STEP;

const DIE_SCALE = 1.8;
/** The roll reveal covers the whole screen, top bar and tabs included. */
const REVEAL_DEPTH = 4800;
/** How long a good roll stays up before moving on. */
const GOOD_HOLD_MS = 3000;
const RING_R = 196;

/** What made this roll special, for the reveal. */
export interface RollInfo {
  lucky: boolean;
  superRoll: boolean;
  /** rarest pet ever rolled */
  record: boolean;
  /** a new pet, a record or a pull far beyond your luck: it stays up for a few seconds */
  good: boolean;
}

/** A cartoon flame for the hot streak badge. */
function flameTexture(scene: Phaser.Scene): string {
  return canvasTexture(scene, "roll_flame", 90, 110, (ctx) => {
    const drop = (s: number, dy: number) => {
      ctx.save();
      ctx.translate(45, 104 + dy);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.moveTo(0, -98);
      ctx.bezierCurveTo(30, -70, 40, -40, 34, -20);
      ctx.quadraticCurveTo(26, 4, 0, 4);
      ctx.quadraticCurveTo(-26, 4, -34, -20);
      ctx.bezierCurveTo(-40, -44, -22, -54, -14, -78);
      ctx.quadraticCurveTo(-4, -60, 0, -98);
      ctx.closePath();
      ctx.restore();
    };
    drop(1, 0);
    ctx.fillStyle = linear(ctx, 0, 0, 0, 110, [[0, "#ffcf3a"], [0.5, "#ff7a2a"], [1, "#e8434f"]]);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#4a2f1d";
    ctx.stroke();
    drop(0.55, -4);
    ctx.fillStyle = linear(ctx, 0, 40, 0, 110, [[0, "#fff6b0"], [1, "#ffcf3a"]]);
    ctx.fill();
  });
}

/**
 * The rolling screen, built to feel great to press: a big die inside a ring that charges up
 * to the next lucky roll, meters for the SUPER ROLL and the roll gift, a hot streak, a die
 * that glows up through the rarity colours before a big pull, confetti and records.
 */
export class RollScreen extends Screen {
  revealing = false;
  private rollBtn: Button;
  private rollGlow: Phaser.GameObjects.Image;
  private autoBtn: Button;
  private fastBtn: Button;
  private rollBar: Phaser.GameObjects.Graphics;
  private die: Phaser.GameObjects.Image;
  private dieY: number;
  private dieRays: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Graphics;
  private luckText: Phaser.GameObjects.Text;
  private chips: Phaser.GameObjects.Text;
  private chase: Phaser.GameObjects.Container;
  private chaseKey = "";
  private meterG: Phaser.GameObjects.Graphics;
  private superLabel: Phaser.GameObjects.Text;
  private superCount: Phaser.GameObjects.Text;
  private giftCount: Phaser.GameObjects.Text;
  private giftIcon: Phaser.GameObjects.Image;
  private superIcon: Phaser.GameObjects.Image;
  private meterY: number;
  private streakBadge: Phaser.GameObjects.Container;
  private streakText: Phaser.GameObjects.Text;
  private streakSub: Phaser.GameObjects.Text;
  private streak = 0;
  private streakAt = 0;
  private history: Phaser.GameObjects.Container;
  private recent: ItemDef[] = [];
  private burst: Phaser.GameObjects.Particles.ParticleEmitter;
  private readyAt = 0;
  private reelY: number;
  private tierChips: { tier: Tier; box: Phaser.GameObjects.Container; count: Phaser.GameObjects.Text; ring: Phaser.GameObjects.Arc }[] = [];
  private batchBtns: { n: number; btn: Button }[] = [];
  private batchY: number;
  private btnY: number;

  constructor(scene: Phaser.Scene, host: Host) {
    super(scene, host, "roll");
    const s = scene;
    const W = s.scale.width;
    const top = host.L.headerBottom;
    const bottom = host.L.navTop;
    const r = this.root;
    makePickupTextures(s);
    // tall phones: spread things out instead of leaving a gap
    const extra = Math.max(0, bottom - 1480);

    // drifting sparkles behind everything
    r.add(s.add.particles(0, 0, "spark", {
      x: { min: 0, max: W }, y: { min: top + 200, max: bottom - 200 }, lifespan: 4000, speedY: { min: -40, max: -15 }, speedX: { min: -10, max: 10 },
      scale: { start: 0.35, end: 0 }, alpha: { start: 0.7, end: 0 }, frequency: 260, tint: [0xffffff, 0xffe066, 0xb98aff],
    }));

    // luck panel
    const panelY = top + 74;
    r.add(s.add.image(W / 2, panelY, panelTexture(s, "glass", 1000, 128)));
    r.add(s.add.image(90, panelY, "icon_clover").setScale(0.9));
    this.luckText = text(s, 150, panelY - 22, "", 54, "#b6f59a").setOrigin(0, 0.5);
    this.chips = text(s, 150, panelY + 32, "", 26, "#fff3dc").setOrigin(0, 0.5);
    r.add([this.luckText, this.chips]);
    r.add(button(s, W - 120, panelY, 170, 100, "green", "ODDS", () => host.showOdds(), { icon: "icon_odds", iconSize: 40, size: 28 }));

    // SUPER ROLL and roll gift meters
    this.meterY = top + 196;
    const my = this.meterY;
    r.add(s.add.image(W / 2, my, panelTexture(s, "glass", 1000, 92)));
    this.meterG = s.add.graphics();
    this.superIcon = s.add.image(88, my, "icon_star").setScale(0.62);
    this.superLabel = text(s, 136, my - 22, "SUPER ROLL  x10 luck", 24, "#e6d4ff").setOrigin(0, 0.5);
    this.superCount = text(s, 316, my + 16, "", 22);
    this.giftIcon = s.add.image(592, my, "icon_gift").setScale(0.62);
    const giftLabel = text(s, 640, my - 22, `GIFT every ${GIFT_EVERY} rolls`, 24, "#ffe6b8").setOrigin(0, 0.5);
    this.giftCount = text(s, 814, my + 16, "", 22);
    r.add([this.meterG, this.superIcon, this.superLabel, this.superCount, this.giftIcon, giftLabel, this.giftCount]);
    s.tweens.add({ targets: [this.superIcon, this.giftIcon], angle: { from: -8, to: 8 }, duration: 800, yoyo: true, repeat: -1, ease: "Sine.inOut" });

    // the big die inside its lucky ring, on a glowing pedestal
    const dieY = top + 462 + extra * 0.35;
    this.dieY = dieY;
    this.dieRays = s.add.image(W / 2, dieY, "rays").setScale(0.9).setAlpha(0.25).setTint(0xffe066);
    s.tweens.add({ targets: this.dieRays, angle: 360, duration: 16000, repeat: -1 });
    const ped = s.add.graphics();
    ped.fillStyle(0x2a1f4a, 0.6).fillEllipse(W / 2, dieY + 150, 300, 66);
    ped.fillStyle(0xffe066, 0.25).fillEllipse(W / 2, dieY + 145, 240, 48);
    this.ring = s.add.graphics();
    this.die = s.add.image(W / 2, dieY, dieTexture(s, dieSkin(), 5)).setScale(DIE_SCALE);
    s.tweens.add({ targets: this.die, y: dieY - 16, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    r.add([this.dieRays, ped, this.ring, this.die]);

    // hot streak badge
    this.streakText = text(s, 34, -14, "", 46, "#ffe066");
    this.streakSub = text(s, 34, 24, "", 22, "#ffd0a0");
    this.streakBadge = s.add.container(W / 2 + 330, dieY - 120, [
      s.add.image(0, 0, pillTexture(s, "dark", 210, 96)).setAlpha(0.9),
      s.add.image(-72, -6, flameTexture(s)).setScale(0.72),
      this.streakText, this.streakSub,
    ]).setVisible(false);
    r.add(this.streakBadge);

    // every roll costs one die (found in battle); rarer dice multiply your luck
    const chipY = dieY + 278;
    DICE_TIERS.forEach((tier, i) => {
      const x = W / 2 + (i - 3.5) * 128;
      const ring = s.add.circle(0, -4, 58, TIER_INFO[tier].color, 0.35).setStrokeStyle(6, 0xffe066).setVisible(false);
      const count = text(s, 0, 46, "0", 28);
      const box = s.add.container(x, chipY, [ring, s.add.image(0, -8, `die_${tier}`).setScale(0.82), count]).setSize(120, 130).setInteractive({ useHandCursor: true });
      box.on("pointerup", () => {
        save.diceTier = tier;
        persist();
        sfx.click();
        const n = save.dice[tier];
        host.toast(`${TIER_INFO[tier].name} dice: x${fmt(DICE_LUCK[tier])} luck  (${n} left)`, TIER_INFO[tier].css);
      });
      r.add(box);
      this.tierChips.push({ tier, box, count, ring });
    });

    // buttons
    const btnY = bottom - 210;
    this.btnY = btnY;
    this.batchY = btnY - 116;
    this.reelY = (chipY + 65 + this.batchY - 40) / 2;
    // the pets you have not found yet (hidden while the reels spin in the same spot)
    this.chase = s.add.container(W / 2, this.reelY);
    r.add(this.chase);
    this.autoBtn = button(s, 175, btnY, 220, 122, "mint", "AUTO", () => {
      if (!autoUnlocked()) {
        host.toast("Unlock Auto Roll in Upgrades!", "#ffe680");
        return;
      }
      save.autoRoll = !save.autoRoll;
      persist();
    }, { icon: "icon_auto", iconSize: 52, stack: true, size: 30 });
    this.rollGlow = s.add.image(W / 2, btnY, "glow").setScale(2.6, 1.3).setTint(0xffb03a);
    s.tweens.add({ targets: this.rollGlow, alpha: { from: 0.35, to: 0.95 }, duration: 650, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.rollBtn = button(s, W / 2, btnY, 400, 152, "orange", "ROLL", () => host.roll(), { icon: dieTexture(s, dieSkin(), 5), iconSize: 80, size: 56, sub: "" });
    s.tweens.add({ targets: this.rollBtn.icon, angle: { from: -8, to: 8 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.fastBtn = button(s, W - 175, btnY, 220, 122, "grey", "FAST", () => host.setFast(!host.isFast()), { icon: "icon_bolt", iconSize: 50, stack: true, size: 30 });
    this.rollBar = s.add.graphics();
    r.add([this.autoBtn, this.rollGlow, this.rollBtn, this.fastBtn, this.rollBar]);

    // how many dice one press rolls: x1, x3 or x10 (each die is one roll)
    ROLL_BATCHES.forEach((n, i) => {
      const btn = button(s, W / 2 + (i - 1) * 140, this.batchY, 124, 66, "mint", `x${n}`, () => {
        save.rollBatch = n;
        persist();
        sfx.click();
        host.toast(n === 1 ? "Rolling 1 die at a time" : `Rolling ${n} dice at once`, "#ffe680");
      }, { size: 32 });
      r.add(btn);
      this.batchBtns.push({ n, btn });
    });

    // recent pulls
    const histY = bottom - 72;
    r.add(s.add.image(W / 2, histY, panelTexture(s, "glass", 1000, 92)));
    r.add(text(s, 86, histY, "LAST", 28, "#e8e0ff"));
    this.history = s.add.container(0, histY);
    r.add(this.history);

    this.burst = s.add.particles(0, 0, "spark", {
      speed: { min: 200, max: 620 }, lifespan: 800, scale: { start: 0.9, end: 0 }, rotate: { min: 0, max: 180 }, gravityY: 500, emitting: false,
    });
    r.add(this.burst);
  }

  setReadyAt(t: number): void {
    this.readyAt = t;
  }

  refreshDie(): void {
    this.die.setTexture(dieTexture(this.scene, dieSkin(), 5));
    this.rollBtn.icon?.setTexture(dieTexture(this.scene, dieSkin(), 5));
  }

  /** Count a roll toward the hot streak; returns the luck multiplier the streak gives. */
  bumpStreak(now: number): number {
    this.streak = now - this.streakAt < streakWindow() ? this.streak + 1 : 1;
    this.streakAt = now;
    if (this.streak >= 2) {
      const b = this.streakBadge.setVisible(true).setAlpha(1);
      this.scene.tweens.killTweensOf(b);
      b.setScale(1.25);
      this.scene.tweens.add({ targets: b, scale: 1, duration: 220, ease: "Back.out" });
    }
    return streakMult(this.streak);
  }

  // ───────────────────────── every frame ─────────────────────────

  update(time: number): void {
    if (!this.visible) return;
    const W = this.scene.scale.width;
    const p = luckParts();
    this.luckText.setText(`Luck ${luckText(luck())}`);
    const chips = [`Best: ${oneIn(save.bestRoll)}`];
    if (save.luckyBoost > 0) chips.push(`${save.luckyBoost} lucky rolls`);
    if (p.index > 1) chips.push(`Index x${p.index.toFixed(2)}`);
    if (potionActive()) chips.push(`Potion x${p.potion}`);
    if (speedActive()) chips.push("Speed x2");
    fitText(this.chips.setText(chips.join("  •  ")), 680);
    fitText(this.luckText, 680);

    // hot streak: keeps going while revealing, fades when you stop rolling
    if (this.revealing) this.streakAt = time;
    if (this.streak >= 2 && time - this.streakAt > streakWindow()) {
      this.streak = 0;
      this.scene.tweens.add({ targets: this.streakBadge, alpha: 0, scale: 0.6, duration: 250, onComplete: () => this.streakBadge.setVisible(false) });
    }
    if (this.streak >= 2) {
      this.streakText.setText(`x${this.streak}`);
      this.streakSub.setText(`+${Math.round((streakMult(this.streak) - 1) * 100)}% luck`);
    }

    const key = `${save.discovered.length}|${save.diceTier}|${luck().toPrecision(3)}`;
    if (key !== this.chaseKey) {
      this.chaseKey = key;
      this.buildChase();
    }

    // meters (a batch of dice can hold the lucky roll or the SUPER ROLL)
    const batch = Math.max(1, Math.min(save.rollBatch, totalDice()));
    const superIn = SUPER_EVERY - 1 - save.superCount;
    const superNext = superIn < batch;
    const giftLeft = GIFT_EVERY - save.giftCount;
    const g = this.meterG.clear();
    drawBar(g, 136, this.meterY + 4, 360, 26, superNext ? 1 : save.superCount / (SUPER_EVERY - 1), superNext ? rainbowColor(time) : 0xb06cff);
    drawBar(g, 640, this.meterY + 4, 340, 26, save.giftCount / GIFT_EVERY, 0xffb22e);
    this.superCount.setText(superIn === 0 ? "NEXT ROLL!" : superNext ? `IN THIS x${batch}!` : `${superIn} rolls`);
    this.superLabel.setColor(superNext ? "#fff27a" : "#e6d4ff");
    this.giftCount.setText(`${giftLeft} roll${giftLeft === 1 ? "" : "s"}`);
    this.superIcon.setScale(superNext ? 0.7 + Math.sin(time / 120) * 0.08 : 0.62);
    this.giftIcon.setScale(giftLeft <= 3 ? 0.68 + Math.sin(time / 140) * 0.08 : 0.62);

    // the lucky ring around the die: one light per roll, gold when the next roll is lucky
    const every = luckyEvery();
    const segs = Math.max(1, every - 1);
    const luckyNow = save.luckyBoost > 0 || save.luckyCount >= segs;
    const lit = luckyNow ? segs : save.luckyCount;
    const luckyIn = luckyNow ? 0 : segs - lit;
    const luckyNext = luckyIn < batch;
    const rg = this.ring.clear();
    const cx = W / 2;
    const cy = this.dieY;
    const gap = segs > 1 ? 0.07 : 0;
    for (let i = 0; i < segs; i++) {
      const a0 = -Math.PI / 2 + (i / segs) * Math.PI * 2 + gap;
      const a1 = -Math.PI / 2 + ((i + 1) / segs) * Math.PI * 2 - gap;
      rg.lineStyle(26, INK_N, 1).beginPath().arc(cx, cy, RING_R, a0, a1).strokePath();
      const on = i < lit;
      const color = luckyNow ? (Math.sin(time / 110 + i) > 0 ? 0xffe066 : 0xffb22e) : on ? 0x7ad651 : 0x3a2f5a;
      rg.lineStyle(16, color, 1).beginPath().arc(cx, cy, RING_R, a0, a1).strokePath();
    }

    // roll button
    const left = this.readyAt - time;
    const none = totalDice() <= 0;
    const tier = save.dice[save.diceTier] > 0 ? save.diceTier : DICE_TIERS.find((t) => save.dice[t] > 0) ?? save.diceTier;
    for (const c of this.tierChips) {
      const n = save.dice[c.tier];
      c.count.setText(fmt(n)).setColor(n ? "#ffffff" : "#9a8aa8");
      c.ring.setVisible(c.tier === tier && !none);
      c.box.setAlpha(n ? 1 : 0.4).setScale(c.tier === tier && !none ? 1.1 : 1);
    }
    const busy = left > 0 || this.revealing;
    const times = batch > 1 ? ` x${batch}` : "";
    this.rollBtn.setLabel(none ? "NO DICE" : left > 0 ? `${(left / 1000).toFixed(1)}s` : superNext ? `SUPER${times}!` : `ROLL${times}`);
    this.rollBtn.setSub(none ? "Find dice in battle!" : superNext ? `x${SUPER_MULT} luck roll!` : luckyNext ? (batch > 1 ? "With a LUCKY roll!" : `LUCKY ${tier} ROLL!`) : `Lucky in ${luckyIn}  •  ${tier} die`);
    this.rollBtn.subText?.setColor((luckyNext || superNext) && !none ? "#fff27a" : "#ffffff");
    this.rollBtn.setColor(none ? "grey" : busy ? "peach" : superNext ? "purple" : luckyNext ? "gold" : "orange");
    this.rollGlow.setVisible(!none && !busy).setTint(superNext ? rainbowColor(time) : luckyNext ? 0xffe066 : 0xffb03a);
    this.rollBar.clear();
    if (left > 0) drawBar(this.rollBar, W / 2 - 150, this.btnY + 42, 300, 12, 1 - left / rollTime(), 0xffe066);
    const unlocked = autoUnlocked();
    this.autoBtn.setColor(unlocked && save.autoRoll ? "green" : unlocked ? "mint" : "grey");
    this.autoBtn.setLabel(unlocked ? (save.autoRoll ? "AUTO ON" : "AUTO") : "LOCKED");
    this.fastBtn.setColor(this.host.isFast() ? "green" : "mint");
    for (const b of this.batchBtns) b.btn.setColor(b.n === save.rollBatch ? "gold" : "mint").setScale(b.n === save.rollBatch ? 1.08 : 1);

  }

  /**
   * "NEXT TO FIND": the three easiest pets you have not rolled yet, as silhouettes with their
   * odds and your own chance with the luck and dice you have now.
   */
  private buildChase(): void {
    const s = this.scene;
    const c = this.chase.removeAll(true);
    const missing = PET_LIST.filter((p) => !save.discovered.includes(p.id)).sort((a, b) => a.oneIn - b.oneIn).slice(0, 3);
    c.add(s.add.image(0, 0, panelTexture(s, "glass", 1000, 250)));
    if (!missing.length) {
      c.add(text(s, 0, -20, "You found all 100 pets!", 44, "#ffe066"));
      c.add(text(s, 0, 36, "Keep rolling to level them all up", 28, "#e8e0ff"));
      return;
    }
    c.add(text(s, -470, -100, `NEXT TO FIND  •  ${save.discovered.length}/${PET_LIST.length} found`, 26, "#ffe066").setOrigin(0, 0.5));
    const tier = save.dice[save.diceTier] > 0 ? save.diceTier : DICE_TIERS.find((t) => save.dice[t] > 0) ?? save.diceTier;
    const mine = petChances(luck() * DICE_LUCK[tier]);
    missing.forEach((def, i) => {
      const x = (i - 1) * 330;
      const card = lockedCard(s, x - 88, 18, def.id).setScale(0.6);
      const glow = s.add.image(x - 88, 18, "glow").setTint(RARITY_INFO[def.rarity].color).setScale(0.75).setAlpha(0.5);
      s.tweens.add({ targets: glow, alpha: 0.9, duration: 800 + i * 150, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      c.add([
        glow, card,
        classBadge(s, x + 40 + (def.cls.length === 1 ? 23 : def.cls.length === 3 ? 35 : 41), -40, def.cls, 40),
        classText(s, x + 40, 6, oneIn(def.oneIn), 30, def.cls).setOrigin(0, 0.5),
        label(s, x + 40, 50, `for you:\n${oneIn(1 / mine[def.index])}`, 22, "#d9ccff").setOrigin(0, 0.5),
      ]);
    });
  }

  /** Recent pulls strip: newest first, popping in from the left. */
  addHistory(results: RollResult[]): void {
    const s = this.scene;
    this.recent = [...results.map((r) => r.item).reverse(), ...this.recent].slice(0, 8);
    this.history.removeAll(true);
    this.recent.forEach((def, i) => {
      const x = 196 + i * 106;
      const parts: Phaser.GameObjects.GameObject[] = [];
      const color = TIER_INFO[def.cls].color;
      if (tierIndex(def.cls) >= 3) parts.push(s.add.image(0, 0, "glow").setTint(color).setScale(0.5).setAlpha(0.8));
      parts.push(s.add.circle(0, 0, 40, color).setStrokeStyle(5, 0x2a1a10), s.add.image(0, 4, petTexture(s, def.id)).setScale(0.42));
      const c = s.add.container(x, 0, parts);
      this.history.add(c);
      if (i < results.length) {
        c.setScale(0);
        s.tweens.add({ targets: c, scale: 1, duration: 260, delay: 300, ease: "Back.out" });
      }
    });
  }

  /** A pet to flash on the reel: mostly below the real result, sometimes a teasing rarer one. */
  private fakePet(rank: number): ItemDef {
    const r = Math.random();
    const tier = r < 0.5 ? Math.max(0, rank - 1 - Math.floor(Math.random() * 2)) : r < 0.82 ? rank : Math.min(9, rank + 1 + Math.floor(Math.random() * 2));
    return PET_LIST[Math.min(PET_LIST.length - 1, tier * 10 + Math.floor(Math.random() * 10))];
  }

  /** Colourful paper raining down from the top of the screen. */
  private confetti(colors: number[], n: number): void {
    const s = this.scene;
    const e = s.add.particles(0, this.host.L.headerBottom - 40, "petal", {
      x: { min: 0, max: s.scale.width }, speedY: { min: 250, max: 650 }, speedX: { min: -220, max: 220 }, rotate: { start: 0, end: 720 },
      lifespan: 2400, gravityY: 380, scale: { min: 0.9, max: 1.6 }, tint: colors, emitting: false,
    }).setDepth(5000);
    e.explode(n);
    s.time.delayedCall(2600, () => e.destroy());
  }

  /** Big floating words ("SUPER ROLL!", "NEW RECORD!"). */
  private shout(parent: Phaser.GameObjects.Container, str: string, y: number, size: number, color: string, ms = 1100): void {
    const s = this.scene;
    const t = text(s, s.scale.width / 2, y, str, size, color).setScale(0);
    parent.add(t);
    s.tweens.add({ targets: t, scale: 1, duration: 260, ease: "Back.out" });
    s.tweens.add({ targets: t, alpha: 0, y: y - 60, delay: ms, duration: 400, onComplete: () => t.destroy() });
  }

  /**
   * The roll takes over the screen: everything else goes dark and only the rolled pets show,
   * as big as they fit. They spin like reels while a glow charges up through the rarity
   * colours, then land. A good roll (a new pet, a record or a pull far beyond your luck) stays
   * up for 3 s to enjoy (tap to skip); otherwise the pets fly straight into your collection.
   */
  reveal(results: RollResult[], info: RollInfo, done: () => void): void {
    const s = this.scene;
    const W = s.scale.width;
    const H = s.scale.height;
    this.revealing = true;
    const n = results.length;
    const layer = s.add.container(0, 0).setDepth(REVEAL_DEPTH);
    const shade = s.add.rectangle(W / 2, H / 2, W, H, 0x0a0614, 0.88).setAlpha(0).setInteractive();
    layer.add(shade);
    s.tweens.add({ targets: shade, alpha: 1, duration: 160 });

    // as big as they fit, preferring wide rows
    const areaTop = this.host.L.headerBottom + 170;
    const areaBottom = H - 300;
    const pitchW = CARD_W + 16;
    const pitchH = CARD_H + 64;
    const fit = (c: number) => Math.min(1.5, 1000 / (c * pitchW), (areaBottom - areaTop) / (Math.ceil(n / c) * pitchH));
    let most = 0;
    for (let c = 1; c <= n; c++) most = Math.max(most, fit(c));
    let cols = 1;
    for (let c = n; c >= 1; c--) {
      if (fit(c) >= most * 0.9) {
        cols = c;
        break;
      }
    }
    const scale = fit(cols);
    const rows = Math.ceil(n / cols);
    const midY = (areaTop + areaBottom) / 2;
    const spot = (i: number): [number, number] => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const col = i - row * cols;
      return [W / 2 + (col - (inRow - 1) / 2) * pitchW * scale, midY + (row - (rows - 1) / 2) * pitchH * scale];
    };

    const bestRank = Math.max(...results.map((r) => rarityRank(r.item.rarity)));
    const best = results.reduce((a, b) => (b.item.oneIn > a.item.oneIn ? b : a));
    const fast = this.host.isFast();
    const suspense = !fast && bestRank >= 3;
    const quick = Phaser.Math.Clamp(rollTime() / 2000, 0.12, 1) * (fast ? 0.5 : 1);
    const spin = Math.max(140, 1000 * quick) + (suspense ? 500 + bestRank * 90 : 0) + (info.superRoll && !fast ? 500 : 0);
    const hold = Math.max(150, 700 * quick) + (suspense ? 300 : 0) + bestRank * 60;
    const fly = Math.max(140, 360 * quick);
    const burst = s.add.particles(0, 0, "spark", {
      speed: { min: 200, max: 620 }, lifespan: 800, scale: { start: 0.9, end: 0 }, rotate: { min: 0, max: 180 }, gravityY: 500, emitting: false,
    });

    // the die still tumbles behind the shade
    const tumble = Math.min(spin, 900);
    s.tweens.add({ targets: this.die, angle: this.die.angle + 720, duration: tumble, ease: "Cubic.out" });
    const faces = s.time.addEvent({ delay: 70, repeat: Math.floor(tumble / 70), callback: () => this.die.setTexture(dieTexture(s, dieSkin(), 1 + Math.floor(Math.random() * 6))) });
    s.time.delayedCall(tumble + 80, () => {
      faces.remove();
      this.die.setTexture(dieTexture(s, dieSkin(), 6));
    });

    // charge up: a glow behind the cards climbs through each rarity colour up to the best one rolled
    const aura = s.add.image(W / 2, midY, "glow").setTint(0xffffff).setAlpha(0.25).setScale(4);
    const auraRays = s.add.image(W / 2, midY, "rays").setAlpha(0).setScale(1.6);
    layer.add([auraRays, aura]);
    s.tweens.add({ targets: auraRays, angle: 360, duration: 12000, repeat: -1 });
    if (!fast && bestRank >= 2) {
      const stepMs = Math.min(spin * 0.85, 300 + bestRank * 170) / bestRank;
      for (let k = 1; k <= bestRank; k++) {
        s.time.delayedCall(k * stepMs, () => {
          const c = RARITY_INFO[RARITY_ORDER[k]].color;
          aura.setTint(c).setAlpha(0.5 + k * 0.05).setScale(4 + k * 0.4);
          auraRays.setTint(c).setAlpha(0.12 + k * 0.04);
          sfx.charge(k);
          if (k >= 4) s.cameras.main.shake(90, 0.002 * (k - 3));
          if (k >= 4) buzz(15 + k * 4);
        });
      }
    }

    const shoutY = areaTop - 90;
    if (info.superRoll) {
      sfx.superRoll();
      buzz(120);
      this.shout(layer, `SUPER ROLL!  x${SUPER_MULT} LUCK`, shoutY, 58, "#e6b8ff", 1300);
      s.cameras.main.flash(250, 200, 140, 255);
      s.cameras.main.shake(300, 0.006);
    } else if (info.lucky) {
      sfx.lucky();
      this.shout(layer, `LUCKY ROLL!  x${luckyMult()} LUCK`, shoutY, 50, "#ffe066");
      s.cameras.main.flash(150, 255, 230, 120);
    }

    const cards: Phaser.GameObjects.Container[] = [];
    const extras: Phaser.GameObjects.GameObject[] = [];
    let landed = 0;
    results.forEach((res, i) => {
      const [x, y] = spot(i);
      // with many cards only the best one makes the big noises and flashes
      const loud = n <= 3 || res === best;
      const rank = rarityRank(res.item.rarity);
      const color = RARITY_INFO[res.item.rarity].color;
      const glow = s.add.image(x, y, "glow").setAlpha(0.35).setScale(scale * 1.8);
      const rays = s.add.image(x, y, "rays").setAlpha(0).setScale(scale * 0.6);
      const frame = s.add.image(0, 0, "card_common");
      const rar = text(s, 18, -CARD_H / 2 + 25, "", 24);
      const pet = s.add.image(0, -12, "icon_dice").setScale(1.3);
      const odds = classText(s, 0, CARD_H / 2 - 66, "", 23, "A");
      const badge = classBadge(s, -CARD_W / 2 + 6, -CARD_H / 2 + 6, "A", 46);
      const name = text(s, 0, CARD_H / 2 - 27, "", 25);
      const card = s.add.container(x, y + 200, [frame, rar, pet, odds, name, badge]).setScale(0);
      layer.add([rays, glow, card]);
      cards.push(card);
      extras.push(glow, rays);
      const show = (def: ItemDef, real: boolean) => {
        frame.setTexture(`card_${def.rarity}`);
        fitText(rar.setText(RARITY_INFO[def.rarity].label.toUpperCase()), CARD_W - 84);
        if (badge.cls !== def.cls) badge.setClass(def.cls);
        setClassTint(odds, def.cls);
        fitText(name.setText(def.name), CARD_W - 36);
        fitText(odds.setText(oneIn(def.oneIn)), CARD_W - 40);
        const key = petKey(def.id);
        if (real) pet.setTexture(petTexture(s, def.id)).setScale(0.9);
        else if (s.textures.exists(key)) pet.setTexture(key).setScale(0.9);
        else pet.setTexture("icon_dice").setScale(1.3).setAngle(Phaser.Math.Between(-20, 20));
        glow.setTint(RARITY_INFO[def.rarity].color);
      };
      const stagger = n > 3 ? 30 : 60;
      s.tweens.add({ targets: card, scale, y, duration: 220, delay: i * stagger, ease: "Back.out" });
      let t = 0;
      let k = 0;
      const tick = () => {
        show(this.fakePet(rank), false);
        if (i === 0) sfx.tick(k);
        k++;
        const p = t / spin;
        s.tweens.add({ targets: card, y: y - 10, duration: 30, yoyo: true });
        if (suspense && p > 0.55) {
          card.setAngle(Phaser.Math.Between(-4, 4));
          glow.setAlpha(0.35 + p * 0.5).setScale(scale * (1.8 + p * 0.8));
        }
        const delay = 40 + (suspense ? 200 : 120) * p * p;
        t += delay;
        s.time.delayedCall(delay, t < spin ? tick : land);
      };
      const land = () => {
        show(res.item, true);
        card.setAngle(0);
        pet.setAngle(0);
        if (loud || rank >= 2) sfx.reveal(rank);
        glow.setAlpha(0.95);
        if (rank >= 3) {
          rays.setTint(color);
          s.tweens.add({ targets: rays, alpha: 0.85, scale: scale * (0.75 + rank * 0.05), duration: 250 });
          s.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
          if (loud) s.cameras.main.flash(180, (color >> 16) & 255, (color >> 8) & 255, color & 255);
          if (res === best) this.confetti([color, 0xffffff, 0xffe066, 0xff7ab8, 0x5ac8ff], 30 + rank * 12);
        }
        s.tweens.add({ targets: card, scaleX: scale * 1.22, scaleY: scale * 0.84, duration: 80, yoyo: true, ease: "Quad.out" });
        s.tweens.add({ targets: glow, scale: scale * (2.2 + rank * 0.25), alpha: 0.6, duration: 260 });
        if (rank >= 1) {
          burst.setParticleTint(color);
          burst.explode(8 + rank * 9, x, y);
        }
        const crank = tierIndex(res.item.cls);
        if (crank >= (n > 3 ? 3 : 1)) {
          // the class shouts out in its own animated colours
          const call = classText(s, x, y - (CARD_H * scale) / 2 - 30, `${res.item.cls} CLASS!`, (36 + crank * 5) * Math.min(1, scale), res.item.cls).setScale(0);
          layer.add(call);
          s.tweens.add({ targets: call, scale: 1, duration: 200, ease: "Back.out" });
          s.tweens.add({ targets: call, alpha: 0, y: call.y - 30, delay: hold + 400, duration: 300, onComplete: () => call.destroy() });
        }
        if (rank >= 4 && loud) {
          s.cameras.main.shake(180 + rank * 30, 0.004 + rank * 0.001);
          buzz(40 + rank * 15);
        }
        if (info.record && res === best) {
          sfx.record();
          const stamp = text(s, 0, 30, "NEW RECORD!", 40, "#ffe066").setAngle(-12).setScale(3).setAlpha(0);
          card.add(stamp);
          s.tweens.add({ targets: stamp, scale: 1, alpha: 1, duration: 260, delay: 120, ease: "Back.out" });
        }
        if (res.isNew) {
          const tag = text(s, CARD_W / 2 - 16, -CARD_H / 2 - 2, "NEW!", 34, "#ff6a8a").setAngle(14).setScale(2.5);
          card.add(tag);
          s.tweens.add({ targets: tag, scale: 1, duration: 200, ease: "Back.out" });
        } else if (save.pets[res.item.id]) {
          const pst = save.pets[res.item.id];
          const ready = pst.copies >= 2 + pst.level;
          card.add(text(s, 0, CARD_H / 2 + 26, ready ? "LEVEL UP READY!" : `+1 copy  (Lv.${pst.level})`, 26, ready ? "#8af06a" : "#b6f59a"));
        }
        if (++landed === n) allLanded();
      };
      s.time.delayedCall(i * stagger + 140 + (info.superRoll && !fast ? 300 : 0), tick);
    });
    layer.add(burst);

    // everything is on the table: a good roll gets its moment, then the pets fly to your collection
    const allLanded = () => {
      const ms = info.good ? (fast ? GOOD_HOLD_MS / 2 : GOOD_HOLD_MS) : hold;
      const stopShow = info.good ? this.showcase(layer, cards, results.indexOf(best), shoutY, areaBottom, ms, info, results.some((r) => r.isNew)) : null;
      let over = false;
      const finish = () => {
        if (over) return;
        over = true;
        wait.remove();
        const target = this.host.tabPos("pets");
        s.tweens.add({ targets: [...extras, aura, auraRays], alpha: 0, duration: 200 });
        cards.forEach((card, i) => {
          s.tweens.killTweensOf(card);
          s.tweens.add({ targets: card, x: target.x, y: target.y, scale: 0.06, angle: 200, duration: fly, delay: i * 15, ease: "Cubic.in" });
        });
        s.tweens.add({
          targets: shade, alpha: 0, duration: 220, delay: fly * 0.6 + cards.length * 15,
          onComplete: () => {
            // stop the endless spins and bobs before their objects go
            s.tweens.killTweensOf([...layer.list]);
            stopShow?.();
            layer.destroy();
            this.revealing = false;
            done();
          },
        });
      };
      const wait = s.time.delayedCall(ms, finish);
      if (info.good) shade.once("pointerup", finish);
    };
  }

  /** A good roll: the cards bob, the best one shines, a title on top and a 3 s bar to the end. */
  private showcase(
    layer: Phaser.GameObjects.Container, cards: Phaser.GameObjects.Container[], bestIdx: number, y: number, bottom: number, ms: number,
    info: RollInfo, isNew: boolean,
  ): () => void {
    const s = this.scene;
    const W = s.scale.width;
    sfx.fanfare();
    const title = info.record ? "NEW RECORD!" : isNew ? "NEW PET!" : "GREAT ROLL!";
    const head = text(s, W / 2, y, title, 76, info.record ? "#ffe066" : isNew ? "#ff8ab0" : "#b6f59a").setScale(0);
    layer.add(head);
    s.tweens.add({ targets: head, scale: 1, duration: 280, ease: "Back.out" });
    s.tweens.add({ targets: head, scale: 1.08, duration: 420, delay: 300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    cards.forEach((card, i) => {
      if (i === bestIdx) {
        s.tweens.add({ targets: card, scale: card.scale * 1.12, duration: 300, ease: "Back.out" });
        s.tweens.add({ targets: card, angle: { from: -3, to: 3 }, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      }
      s.tweens.add({ targets: card, y: card.y - 14, duration: 520, delay: i * 70, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    });
    // how long until it moves on
    const bar = s.add.graphics();
    const hint = text(s, W / 2, bottom + 150, "Tap to continue", 30, "#e8e0ff");
    layer.add([bar, hint]);
    const left = { v: 1 };
    const countdown = s.tweens.add({ targets: left, v: 0, duration: ms, onUpdate: () => drawBar(bar.clear(), W / 2 - 200, bottom + 90, 400, 18, left.v, 0xffe066) });
    return () => countdown.remove();
  }

  /** The roll gift: a present flies out of its meter, bursts open, and the dice and gems fly to the top bar. */
  giftPop(tier: Tier, dice: number, gems: number): void {
    const s = this.scene;
    const W = s.scale.width;
    sfx.gift();
    const m = this.giftIcon.getWorldTransformMatrix();
    const box = s.add.image(m.tx, m.ty, "icon_gift").setScale(0.62).setDepth(5000);
    const cy = this.dieY;
    s.tweens.add({ targets: box, x: W / 2, y: cy, scale: 2.4, duration: 380, ease: "Back.out" });
    s.tweens.add({ targets: box, angle: { from: -10, to: 10 }, duration: 70, yoyo: true, repeat: 4, delay: 400 });
    s.time.delayedCall(1000, () => {
      box.destroy();
      sfx.fanfare();
      buzz(60);
      this.burst.setParticleTint(0xffcf3a);
      this.burst.explode(40, W / 2, cy);
      const items: [string, string, number][] = [[`die_${tier}`, `+${dice}`, TOP_ROW.dice], ["icon_gem", `+${gems}`, TOP_ROW.gems]];
      items.forEach(([icon, str, tx], i) => {
        const img = s.add.image(0, 0, icon);
        img.setScale(110 / Math.max(img.width, img.height));
        const c = s.add.container(W / 2, cy, [s.add.image(0, 0, "glow").setTint(0xffe066).setScale(0.8).setAlpha(0.7), img, text(s, 0, 74, str, 44)]).setDepth(5000).setScale(0);
        s.tweens.add({ targets: c, x: W / 2 + (i ? 150 : -150), scale: 1, duration: 300, ease: "Back.out" });
        s.tweens.add({
          targets: c, x: tx, y: TOP_Y, scale: 0.3, duration: 450, delay: 1000, ease: "Cubic.in",
          onComplete: () => {
            c.destroy();
            sfx.coin();
          },
        });
      });
      const t = text(s, W / 2, cy - 170, "ROLL GIFT!", 64, "#ffe066").setDepth(5000).setScale(0);
      s.tweens.add({ targets: t, scale: 1, duration: 260, ease: "Back.out" });
      s.tweens.add({ targets: t, alpha: 0, y: t.y - 50, delay: 1100, duration: 350, onComplete: () => t.destroy() });
    });
  }
}
