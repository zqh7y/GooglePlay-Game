import Phaser from "phaser";
import { INK_N, canvasTexture, darken, rgba } from "../art/draw";
import { makeGunTextures } from "../art/guns";
import { makePickupTextures } from "../art/pickups";
import { BtnColor, btnTexture, panelTexture, ribbonTexture } from "../art/ui";
import { BOOSTS } from "../data/boosts";
import { DICE_LUCK, TIER_INFO, Tier, rollDiceTier } from "../data/tiers";
import { dailyDay } from "../systems/goals";
import { persist, save } from "../systems/save";
import { buzz, sfx } from "../systems/sound";
import { POTION_GEMS, potionMinutes, potionMult } from "../systems/stats";
import { fmt } from "./format";
import { Host, Screen } from "./screens";
import { Button, button, fitText, label, text } from "./widgets";

const FREE_GIFT_MS = 10 * 60 * 1000;
const WHEEL_MS = 4 * 60 * 60 * 1000;
const WHEEL_GEMS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

const income = (minutes: number) => Math.max(1000, save.cashPerSec * 60 * minutes);
const day = () => Math.floor(Date.now() / DAY_MS);
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`;
};

/** Something you get: shown with an icon and an amount, then added to the save. */
interface Reward {
  icon: string;
  amount: string;
  give: () => void;
}

const diceReward = (tier: Tier, n: number): Reward => ({ icon: `die_${tier}`, amount: `x${n}`, give: () => (save.dice[tier] += n) });
const cashReward = (cash: number): Reward => ({ icon: "icon_cash", amount: fmt(cash), give: () => (save.cash += cash) });
const gemReward = (n: number): Reward => ({ icon: "icon_gem", amount: `x${n}`, give: () => (save.gems += n) });
const potionReward = (minutes: number): Reward => ({
  icon: "icon_potion", amount: `${minutes}m`, give: () => (save.potionUntil = Math.max(Date.now(), save.potionUntil) + minutes * 60000),
});

/** Several dice rolled for the current stage (plus a bonus), grouped by tier. */
function diceRewards(n: number, bonus: number): Reward[] {
  const got: Partial<Record<Tier, number>> = {};
  for (let i = 0; i < n; i++) {
    const t = rollDiceTier(save.stage + bonus);
    got[t] = (got[t] ?? 0) + 1;
  }
  return (Object.entries(got) as [Tier, number][]).map(([t, k]) => diceReward(t, k));
}

interface ChestDef {
  id: string;
  name: string;
  tex: string;
  color: BtnColor;
  hint: string;
  gems: number;
  /** price in minutes of income, for chests bought with money */
  minutes: number;
  rewards: () => Reward[];
}

const CHESTS: ChestDef[] = [
  {
    id: "wood", name: "Wooden Chest", tex: "chest", color: "orange", hint: "4-6 dice + money", gems: 0, minutes: 20,
    rewards: () => [...diceRewards(4 + Math.floor(Math.random() * 3), 5), cashReward(income(5))],
  },
  {
    id: "silver", name: "Silver Chest", tex: "chest_silver", color: "blue", hint: "8-12 better dice + gems", gems: 25, minutes: 0,
    rewards: () => [...diceRewards(8 + Math.floor(Math.random() * 5), 20), gemReward(3 + Math.floor(Math.random() * 4)), cashReward(income(15))],
  },
  {
    id: "gold", name: "Golden Chest", tex: "chest_gold", color: "gold", hint: "15-20 rare dice + lots more", gems: 80, minutes: 0,
    rewards: () => [...diceRewards(15 + Math.floor(Math.random() * 6), 40), gemReward(10), potionReward(10), cashReward(income(45))],
  },
];

interface Deal {
  title: string;
  desc: string;
  icons: string[];
  was: number;
  gems: number;
  rewards: () => Reward[];
}

/** One Deal of the Day, a different one each day. */
const DEALS: Deal[] = [
  { title: "MEGA DICE BOX", desc: "20 A dice + 8 B dice + 2 C dice", icons: ["die_A", "die_B", "die_C"], was: 140, gems: 55, rewards: () => [diceReward("A", 20), diceReward("B", 8), diceReward("C", 2)] },
  { title: "LUCKY BUNDLE", desc: "3 Luck Potions + 5 B dice", icons: ["icon_potion", "icon_clover", "die_B"], was: 60, gems: 25, rewards: () => [potionReward(potionMinutes() * 3), diceReward("B", 5)] },
  { title: "BOOST PACK", desc: "2 of every Battle Boost", icons: ["gun_deagle", "pk_heart", "skill_orb"], was: 90, gems: 35, rewards: () => BOOSTS.map((b) => ({ icon: b.icon, amount: "x2", give: () => (save.boosts[b.id] = (save.boosts[b.id] ?? 0) + 2) })) },
  { title: "RARE ROLLER", desc: "4 C dice + 1 D die", icons: ["die_C", "die_D", "die_C"], was: 120, gems: 50, rewards: () => [diceReward("C", 4), diceReward("D", 1)] },
  { title: "TREASURE TRIO", desc: "3 Silver Chests in one", icons: ["chest_silver", "chest_silver", "chest_silver"], was: 75, gems: 35, rewards: () => [0, 1, 2].flatMap(() => CHESTS[1].rewards()) },
];

/** The lucky wheel: 8 prizes, rarer ones less likely. */
const WHEEL: { icon: string; label: string; color: number; weight: number; jackpot?: boolean; rewards: () => Reward[] }[] = [
  { icon: "die_A", label: "5", color: 0xff7ab8, weight: 20, rewards: () => [diceReward("A", 5)] },
  { icon: "icon_cash", label: "10m", color: 0xffd23f, weight: 20, rewards: () => [cashReward(income(10))] },
  { icon: "die_B", label: "3", color: 0x5ac8ff, weight: 14, rewards: () => [diceReward("B", 3)] },
  { icon: "icon_gem", label: "5", color: 0x7ad651, weight: 12, rewards: () => [gemReward(5)] },
  { icon: "icon_cash", label: "30m", color: 0xb46aff, weight: 12, rewards: () => [cashReward(income(30))] },
  { icon: "icon_potion", label: "5m", color: 0xff9a3a, weight: 10, rewards: () => [potionReward(5)] },
  { icon: "die_C", label: "1", color: 0x2fd0c0, weight: 8, rewards: () => [diceReward("C", 1)] },
  { icon: "icon_star", label: "MEGA", color: 0xff5a5a, weight: 4, jackpot: true, rewards: () => [gemReward(20), diceReward("D", 2)] },
];

/** The colourful wheel face (8 segments, gold rim with bulbs). */
function wheelTexture(scene: Phaser.Scene): string {
  return canvasTexture(scene, "shop_wheel", 460, 460, (ctx) => {
    const c = 230;
    ctx.beginPath();
    ctx.arc(c, c, 226, 0, Math.PI * 2);
    ctx.fillStyle = "#4a2f1d";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c, c, 216, 0, Math.PI * 2);
    ctx.fillStyle = "#ffcf3a";
    ctx.fill();
    WHEEL.forEach((seg, i) => {
      const a0 = -Math.PI / 2 + (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, 196, a0, a0 + Math.PI / 4);
      ctx.closePath();
      const g = ctx.createRadialGradient(c, c, 30, c, c, 196);
      g.addColorStop(0, rgba(0xffffff));
      g.addColorStop(0.35, rgba(seg.color));
      g.addColorStop(1, rgba(darken(seg.color, 0.15)));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#4a2f1d";
      ctx.stroke();
    });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * 207, c + Math.sin(a) * 207, 6, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? "#ffffff" : "#ff5a5a";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(c, c, 40, 0, Math.PI * 2);
    ctx.fillStyle = "#4a2f1d";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c, c, 32, 0, Math.PI * 2);
    ctx.fillStyle = "#ffcf3a";
    ctx.fill();
  });
}

/**
 * The shop: Deal of the Day, free gifts, a lucky wheel, treasure chests you open with a
 * show, Battle Boosts bought with money, dice, potions, money and gems.
 */
export class ShopScreen extends Screen {
  private list: Phaser.GameObjects.Container;
  private top: number;
  private bottom: number;
  private max = 0;
  private drag = { on: false, y: 0, oy: 0, moved: 0 };
  private refreshers: (() => void)[] = [];
  private ticking: (() => void)[] = [];
  private wheel!: Phaser.GameObjects.Container;
  private spinning = false;
  private overlay: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, host: Host) {
    super(scene, host, "shop");
    const s = scene;
    makePickupTextures(s);
    makeGunTextures(s);
    const W = s.scale.width;
    this.top = host.L.headerBottom + 10;
    this.bottom = host.L.navTop - 10;
    this.list = s.add.container(0, 0);
    const mask = s.make.graphics({}, false).fillRect(0, this.top, W, this.bottom - this.top);
    this.list.setMask(mask.createGeometryMask());
    this.root.add(this.list);
    this.build();
    s.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.visible || this.overlay || p.y < this.top || p.y > this.bottom) return;
      this.drag = { on: true, y: p.y, oy: this.list.y, moved: 0 };
    });
    s.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.drag.on || !p.isDown) return;
      this.drag.moved = Math.max(this.drag.moved, Math.abs(p.y - this.drag.y));
      this.list.y = Phaser.Math.Clamp(this.drag.oy + p.y - this.drag.y, -this.max, 0);
    });
    s.input.on("pointerup", () => (this.drag.on = false));
  }

  /** A tap that was really a scroll should not buy anything. */
  private get scrolled(): boolean {
    return this.drag.moved > 24;
  }

  // ───────────────────────── building blocks ─────────────────────────

  private header(y: number, title: string, color: BtnColor): number {
    const s = this.scene;
    const W = s.scale.width;
    this.list.add([s.add.image(W / 2, y + 50, ribbonTexture(s, color, 640, 110)), text(s, W / 2, y + 38, title, 48)]);
    return y + 120;
  }

  /** A price button that buys with gems or money and then refreshes the shop. */
  private priceButton(x: number, y: number, w: number, h: number, price: () => { label: string; icon?: string; color: BtnColor; ok: boolean }, buy: () => boolean): Button {
    const s = this.scene;
    const p0 = price();
    const btn = button(s, x, y, w, h, p0.color, p0.label, () => {
      if (this.scrolled || this.overlay) return;
      if (!price().ok) {
        sfx.error();
        return;
      }
      if (buy()) {
        sfx.buy();
        buzz(30);
        s.tweens.add({ targets: btn, scale: 1.12, duration: 90, yoyo: true });
        persist();
      }
      this.refreshAll();
    }, { size: 30, icon: p0.icon, iconSize: 38 });
    this.refreshers.push(() => {
      const p = price();
      btn.setLabel(p.label).setColor(p.color);
    });
    return btn;
  }

  private gemsPrice(gems: number, color: BtnColor = "green") {
    return () => ({ label: `${gems}`, icon: "icon_gem", color: save.gems >= gems ? color : "grey", ok: save.gems >= gems });
  }

  private cashPrice(cash: () => number, color: BtnColor = "green") {
    return () => ({ label: fmt(cash()), icon: "icon_cash", color: save.cash >= cash() ? color : "grey", ok: save.cash >= cash() });
  }

  private spendGems(n: number): boolean {
    if (save.gems < n) {
      this.host.toast("Not enough gems! Beat bosses and open chests to get more.", "#ff9a9a");
      return false;
    }
    save.gems -= n;
    return true;
  }

  /**
   * A colourful shop tile: the name on a coloured band, a big glowing icon (a little pile of
   * them when count > 1), a line of text and a price button along the bottom.
   */
  private tile(x: number, y: number, w: number, h: number, bg: BtnColor, icon: string, iconSize: number, title: string, desc: () => string, btn: Button, count = 1): void {
    const s = this.scene;
    const top = y - h / 2;
    const bot = y + h / 2;
    const size = Math.min(iconSize, h - 240);
    const glow = s.add.image(x, 0, "glow").setTint(0xffffff).setScale((size / 256) * 2.4).setAlpha(0.5);
    s.tweens.add({ targets: glow, alpha: 0.85, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const icons = s.add.container(x, 0);
    for (let i = 0; i < count; i++) {
      const k = count === 1 ? 0 : i / (count - 1) - 0.5;
      const img = s.add.image(k * size * 0.8, Math.abs(k) * size * 0.2, icon).setAngle(k * 30);
      img.setScale((count === 1 ? size : size * 0.75) / Math.max(img.width, img.height));
      icons.add(img);
    }
    // the last ones in the pile sit on top, so put the middle one there
    if (count > 1) icons.bringToTop(icons.list[Math.floor(count / 2)]);
    const d = label(s, x, bot - 104, desc(), 24, "#4a2f1d", w - 70).setOrigin(0.5, 1);
    const place = () => {
      const iy = (top + 66 + bot - 104 - d.height) / 2;
      icons.y = iy;
      glow.y = iy;
    };
    place();
    this.refreshers.push(() => {
      d.setText(desc());
      place();
    });
    btn.setPosition(x, bot - 52);
    this.list.add([
      s.add.image(x, y, btnTexture(s, bg, w, h)),
      s.add.image(x, y + 4, panelTexture(s, "cream", w - 34, h - 112)).setAlpha(0.92),
      glow, icons,
      fitText(text(s, x, top + 32, title, 34), w - 40),
      d, btn,
    ]);
  }

  // ───────────────────────── the shop ─────────────────────────

  private build(): void {
    const s = this.scene;
    const W = s.scale.width;
    let y = this.top + 20;

    // ── Deal of the Day
    const deal = DEALS[day() % DEALS.length];
    const dh = 380;
    const cy = y + dh / 2;
    const rays = s.add.image(200, cy, "rays").setScale(0.75).setTint(0xffe066).setAlpha(0.5);
    s.tweens.add({ targets: rays, angle: 360, duration: 12000, repeat: -1 });
    const pile = deal.icons.map((ic, i) => {
      const img = s.add.image(150 + i * 60, cy + 30 - (i === 1 ? 40 : 0), ic);
      img.setScale((i === 1 ? 140 : 110) / Math.max(img.width, img.height)).setAngle((i - 1) * 14);
      s.tweens.add({ targets: img, y: img.y - 10, duration: 900 + i * 150, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      return img;
    });
    const sticker = s.add.container(W - 110, y + 46, [
      s.add.star(0, 0, 12, 50, 62, 0xff4a5a).setStrokeStyle(5, INK_N),
      text(s, 0, -2, `-${Math.round((1 - deal.gems / deal.was) * 100)}%`, 34),
    ]).setAngle(12);
    s.tweens.add({ targets: sticker, scale: 1.1, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const timer = text(s, 660, cy + 60, "", 28, "#fff3dc");
    this.ticking.push(() => timer.setText(save.dealDay === day() ? "Bought! New deal tomorrow" : `Ends in ${clock((day() + 1) * DAY_MS - Date.now())}`));
    const was = text(s, 520, cy + 132, `${deal.was}`, 34, "#ffd0d0");
    const strike = s.add.rectangle(520, cy + 132, 70, 5, 0xff4a5a);
    const dealBtn = this.priceButton(730, cy + 130, 300, 110, () => {
      const bought = save.dealDay === day();
      const ok = !bought && save.gems >= deal.gems;
      return { label: bought ? "SOLD OUT" : `${deal.gems}`, icon: bought ? undefined : "icon_gem", color: ok ? "gold" : "grey", ok };
    }, () => {
      if (!this.spendGems(deal.gems)) return false;
      save.dealDay = day();
      const r = deal.rewards();
      r.forEach((x) => x.give());
      this.rewardShow(deal.title, null, r);
      return true;
    });
    this.list.add([
      s.add.image(W / 2, cy, btnTexture(s, "purple", 1000, dh)), rays, ...pile,
      text(s, W / 2, y + 38, "DEAL OF THE DAY", 34, "#fff3dc"),
      text(s, 660, cy - 70, deal.title, 56, "#ffe066"),
      fitText(text(s, 660, cy, deal.desc, 30), 560),
      timer, was, strike, dealBtn, sticker,
    ]);
    y += dh + 40;

    // ── free stuff
    y = this.header(y, "FREE", "green");
    const fh = 360;
    const giftBtn = this.priceButton(0, 0, 260, 88, () => {
      const left = save.freeGiftAt - Date.now();
      return { label: left > 0 ? clock(left) : "OPEN", color: left > 0 ? "grey" : "green", ok: left <= 0 };
    }, () => {
      const gems = 2 + Math.floor(Math.random() * 4);
      const r = [gemReward(gems), diceReward("A", 3), cashReward(income(5))];
      r.forEach((x) => x.give());
      save.freeGiftAt = Date.now() + FREE_GIFT_MS;
      this.rewardShow("FREE GIFT", null, r);
      return true;
    });
    this.tile(W / 2 - 255, y + fh / 2, 490, fh, "green", "icon_gift", 120, "Free Gift", () => "Gems, dice and money every 10 minutes", giftBtn);
    const dailyBtn = this.priceButton(0, 0, 260, 88, () => {
      const ready = dailyDay() >= 0;
      return { label: ready ? "CLAIM" : "TOMORROW", color: ready ? "gold" : "grey", ok: true };
    }, () => {
      this.host.showDaily();
      return false;
    });
    this.tile(W / 2 + 255, y + fh / 2, 490, fh, "gold", "icon_star", 120, "Daily Reward", () => (dailyDay() >= 0 ? `Day ${dailyDay() + 1} of 7 is waiting for you!` : `Day ${(save.dailyStreak - 1) % 7 + 1} of 7 claimed. Come back tomorrow!`), dailyBtn);
    y += fh + 40;

    // ── lucky wheel
    y = this.header(y, "LUCKY WHEEL", "pink");
    const wh = 560;
    const wy = y + wh / 2;
    this.list.add(s.add.image(W / 2, wy, btnTexture(s, "pink", 1000, wh)));
    this.wheel = s.add.container(330, wy + 10);
    this.wheel.add(s.add.image(0, 0, wheelTexture(s)));
    WHEEL.forEach((seg, i) => {
      const a = -Math.PI / 2 + (i + 0.5) * (Math.PI / 4);
      const img = s.add.image(Math.cos(a) * 140, Math.sin(a) * 140, seg.icon);
      img.setScale(64 / Math.max(img.width, img.height)).setRotation(a + Math.PI / 2);
      const t = text(s, Math.cos(a) * 86, Math.sin(a) * 86, seg.label, seg.label.length > 3 ? 22 : 28).setRotation(a + Math.PI / 2);
      this.wheel.add([img, t]);
    });
    const pointer = s.add.triangle(330, wy - 222, 0, 0, 56, 0, 28, 50, 0xff4a5a).setStrokeStyle(5, INK_N);
    const wheelBtn = this.priceButton(800, wy + 130, 300, 120, () => {
      const free = Date.now() >= save.wheelAt;
      const ok = !this.spinning && (free || save.gems >= WHEEL_GEMS);
      return { label: free ? "FREE SPIN" : `${WHEEL_GEMS}`, icon: free ? undefined : "icon_gem", color: ok ? (free ? "green" : "purple") : "grey", ok };
    }, () => {
      if (Date.now() >= save.wheelAt) save.wheelAt = Date.now() + WHEEL_MS;
      else if (!this.spendGems(WHEEL_GEMS)) return false;
      this.spin();
      return true;
    });
    const wheelInfo = label(s, 800, wy - 60, "", 28, "#4a2f1d", 340);
    this.ticking.push(() => wheelInfo.setText(Date.now() >= save.wheelAt ? "A free spin is ready!" : `Free spin in ${clock(save.wheelAt - Date.now())}`));
    this.list.add([
      this.wheel, pointer,
      text(s, 800, wy - 170, "Spin to win!", 46, "#ffffff"),
      label(s, 800, wy - 110, "Dice, gems, money, potions... or the MEGA JACKPOT", 26, "#4a2f1d", 340),
      wheelInfo, wheelBtn,
    ]);
    y += wh + 40;

    // ── treasure chests
    y = this.header(y, "TREASURE CHESTS", "orange");
    const ch = 440;
    CHESTS.forEach((c, i) => {
      const x = W / 2 + (i - 1) * 345;
      const btn = this.priceButton(0, 0, 280, 88, c.gems ? this.gemsPrice(c.gems, c.color) : this.cashPrice(() => income(c.minutes), c.color), () => {
        if (c.gems) {
          if (!this.spendGems(c.gems)) return false;
        } else {
          save.cash -= income(c.minutes);
        }
        const r = c.rewards();
        r.forEach((x2) => x2.give());
        this.rewardShow(c.name.toUpperCase(), c.tex, r);
        return true;
      });
      this.tile(x, y + ch / 2, 325, ch, c.color, c.tex, 190, c.name, () => c.hint, btn);
    });
    y += ch + 40;

    // ── battle boosts (bought with money)
    y = this.header(y, "BATTLE BOOSTS", "blue");
    const bh = 390;
    BOOSTS.forEach((b, i) => {
      const x = W / 2 + (i % 2 ? 255 : -255);
      const by = y + Math.floor(i / 2) * (bh + 30) + bh / 2;
      const btn = this.priceButton(0, 0, 280, 88, this.cashPrice(() => income(b.minutes), "blue"), () => {
        save.cash -= income(b.minutes);
        save.boosts[b.id] = (save.boosts[b.id] ?? 0) + 1;
        this.host.toast(`${b.name} ready for your next fight!`, "#9ae6ff");
        return true;
      });
      this.tile(x, by, 490, bh, "blue", b.icon, 130, b.name, () => `${b.desc}${save.boosts[b.id] ? `  (you have ${save.boosts[b.id]})` : ""}`, btn);
    });
    y += 2 * (bh + 30) + 10;

    // ── dice
    y = this.header(y, "DICE", "purple");
    const dh2 = 370;
    const dice: [Tier, number, number, number][] = [["A", 10, 0, 10], ["A", 50, 20, 0], ["B", 10, 25, 0], ["C", 5, 60, 0], ["D", 2, 120, 0], ["E", 1, 300, 0]];
    dice.forEach(([tier, n, gems, minutes], i) => {
      const x = W / 2 + ((i % 3) - 1) * 345;
      const ty = y + Math.floor(i / 3) * (dh2 + 30) + dh2 / 2;
      const price = gems ? this.gemsPrice(gems, "purple") : this.cashPrice(() => income(minutes), "purple");
      const btn = this.priceButton(0, 0, 270, 88, price, () => {
        if (gems) {
          if (!this.spendGems(gems)) return false;
        } else {
          save.cash -= income(minutes);
        }
        save.dice[tier] += n;
        this.host.afterPurchase();
        this.host.toast(`+${n} ${tier} dice!`, TIER_INFO[tier].css);
        return true;
      });
      this.tile(x, ty, 325, dh2, "purple", `die_${tier}`, 120, `${n} ${tier} Dice`, () => `x${fmt(DICE_LUCK[tier])} luck per roll\nYou have ${fmt(save.dice[tier])}`, btn);
    });
    y += 2 * (dh2 + 30) + 10;

    // ── potions and lucky rolls
    y = this.header(y, "POTIONS", "mint");
    const ph = 370;
    const potions: [string, string, () => string, number, () => void][] = [
      ["icon_potion", "Luck Potion", () => `x${potionMult()} luck for ${potionMinutes()} min`, POTION_GEMS, () => (save.potionUntil = Math.max(Date.now(), save.potionUntil) + potionMinutes() * 60000)],
      ["icon_clock", "Speed Potion", () => "Roll twice as fast for 10 min", 12, () => (save.speedUntil = Math.max(Date.now(), save.speedUntil) + 10 * 60000)],
      ["icon_clover", "10 Lucky Rolls", () => `Your next 10 rolls are Lucky (${save.luckyBoost} left)`, 15, () => (save.luckyBoost += 10)],
    ];
    potions.forEach(([icon, name, desc, gems, give], i) => {
      const x = W / 2 + (i - 1) * 345;
      const btn = this.priceButton(0, 0, 270, 88, this.gemsPrice(gems, "mint"), () => {
        if (!this.spendGems(gems)) return false;
        give();
        return true;
      });
      this.tile(x, y + ph / 2, 325, ph, "mint", icon, 120, name, desc, btn);
    });
    y += ph + 40;

    // ── money
    y = this.header(y, "MONEY", "green");
    const mh = 360;
    ([["Bag of Money", 15, 5], ["Chest of Money", 120, 30], ["Vault of Money", 720, 150]] as [string, number, number][]).forEach(([name, minutes, gems], i) => {
      const x = W / 2 + (i - 1) * 345;
      const btn = this.priceButton(0, 0, 270, 88, this.gemsPrice(gems, "green"), () => {
        if (!this.spendGems(gems)) return false;
        save.cash += income(minutes);
        this.host.coinShower(x, this.list.y + y + mh / 2, 12);
        return true;
      });
      this.tile(x, y + mh / 2, 325, mh, "green", "icon_cash", 110, name, () => `+${fmt(income(minutes))} money`, btn, 1 + i * 2);
    });
    y += mh + 40;

    // ── gems (real money in the finished game)
    y = this.header(y, "GEMS", "blue");
    ([["Handful", 80, "$0.99"], ["Bag", 500, "$4.99"], ["Chest", 1200, "$9.99"]] as [string, number, string][]).forEach(([name, n, price], i) => {
      const x = W / 2 + (i - 1) * 345;
      const btn = this.priceButton(0, 0, 270, 88, () => ({ label: price, color: "grey", ok: false }), () => false);
      this.tile(x, y + mh / 2, 325, mh, "blue", "icon_gem", 110, `${name} of Gems`, () => `${n} gems\n(coming soon)`, btn, 1 + i * 2);
    });
    y += mh + 60;
    this.max = Math.max(0, y - this.bottom);
  }

  // ───────────────────────── the wheel ─────────────────────────

  private spin(): void {
    const s = this.scene;
    this.spinning = true;
    const total = WHEEL.reduce((a, w) => a + w.weight, 0);
    let r = Math.random() * total;
    let pick = 0;
    for (; pick < WHEEL.length - 1; pick++) {
      r -= WHEEL[pick].weight;
      if (r <= 0) break;
    }
    // land the middle of the picked segment under the pointer, after a few turns
    const from = this.wheel.angle;
    const base = from - (((from % 360) + 360) % 360);
    const target = base + 360 * 5 + (360 - (pick * 45 + 22.5)) + (Math.random() - 0.5) * 30;
    let last = Math.floor(from / 45);
    s.tweens.add({
      targets: this.wheel, angle: target, duration: 3600, ease: "Cubic.easeOut",
      onUpdate: () => {
        const k = Math.floor(this.wheel.angle / 45);
        if (k !== last) {
          last = k;
          sfx.tick(k);
        }
      },
      onComplete: () => {
        this.spinning = false;
        const seg = WHEEL[pick];
        const rewards = seg.rewards();
        rewards.forEach((x) => x.give());
        persist();
        this.rewardShow(seg.jackpot ? "MEGA JACKPOT!!!" : "YOU WON", null, rewards);
        this.refreshAll();
      },
    });
  }

  // ───────────────────────── opening things ─────────────────────────

  /** Full-screen reveal: a chest shakes and pops open (or a gift bursts), then the rewards fly out. */
  private rewardShow(title: string, chest: string | null, rewards: Reward[]): void {
    const s = this.scene;
    const W = s.scale.width;
    const H = s.scale.height;
    const cy = H * 0.4;
    const dim = s.add.rectangle(0, 0, W, H, 0x1a0e08, 0.82).setOrigin(0).setInteractive();
    const rays = s.add.image(W / 2, cy, "rays").setScale(2).setTint(0xffe066).setAlpha(0);
    const head = text(s, W / 2, cy - 380, title, 84, "#ffe066").setScale(0);
    const box = s.add.image(W / 2, cy, chest ?? "icon_gift").setScale(chest ? 2.6 : 2.2);
    const tap = text(s, W / 2, H - 260, "TAP TO CONTINUE", 40).setAlpha(0);
    const root = s.add.container(0, 0, [dim, rays, head, box, tap]).setDepth(6500);
    this.overlay = root;
    s.tweens.add({ targets: head, scale: 1, duration: 350, ease: "Back.out" });
    s.tweens.add({ targets: box, angle: { from: -8, to: 8 }, duration: 90, yoyo: true, repeat: 5 });
    const openAt = 650;
    s.time.delayedCall(openAt, () => {
      sfx.fanfare();
      buzz(120);
      s.cameras.main.flash(200, 255, 245, 210);
      if (chest) box.setTexture(`${chest}_open`);
      else s.tweens.add({ targets: box, scale: 0, alpha: 0, duration: 200 });
      s.tweens.add({ targets: rays, alpha: 0.55, duration: 300 });
      s.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
      // rewards burst out into a grid
      const cols = Math.min(4, rewards.length);
      rewards.forEach((rw, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = W / 2 + (col - (cols - 1) / 2) * 220;
        const y = cy + 250 + row * 210;
        const icon = s.add.image(0, 0, rw.icon);
        icon.setScale(110 / Math.max(icon.width, icon.height));
        const item = s.add.container(W / 2, cy, [
          s.add.image(0, 0, "glow").setTint(0xffe066).setScale(0.9).setAlpha(0.7), icon, text(s, 0, 78, rw.amount, 40),
        ]).setScale(0);
        root.add(item);
        s.tweens.add({ targets: item, x, y, scale: 1, duration: 420, delay: 120 + i * 140, ease: "Back.out", onStart: () => sfx.reveal(2 + Math.min(4, i)) });
      });
      s.tweens.add({ targets: tap, alpha: 1, duration: 300, delay: 400 + rewards.length * 140 });
      s.time.delayedCall(500 + rewards.length * 140, () => dim.once("pointerup", close));
    });
    const close = () => {
      s.tweens.add({ targets: root, alpha: 0, duration: 200, onComplete: () => root.destroy() });
      this.overlay = null;
      this.host.coinShower(W / 2, cy, 10);
      this.host.afterPurchase();
      this.refreshAll();
    };
  }

  private refreshAll(): void {
    this.refreshers.forEach((f) => f());
  }

  protected onShow(): void {
    this.refreshAll();
  }

  private nextTick = 0;

  update(time: number): void {
    if (!this.visible || time < this.nextTick) return;
    this.nextTick = time + 250;
    this.ticking.forEach((f) => f());
    // countdown buttons (gift, wheel) tick too
    this.refreshers.forEach((f) => f());
  }
}

export const freeGiftReady = () => Date.now() >= save.freeGiftAt;
