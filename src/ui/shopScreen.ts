import Phaser from "phaser";
import { INK_N, canvasTexture, darken, lighten, rgba } from "../art/draw";
import { makeEventTextures } from "../art/fishing";
import { makeGadgetTextures } from "../art/gadgets";
import { petTexture } from "../art/pets";
import { makePickupTextures } from "../art/pickups";
import { BtnColor, btnTexture, panelTexture } from "../art/ui";
import { itemSplash, vividCard } from "../art/ps";
import { BOOSTS } from "../data/boosts";
import { PASSES } from "../data/passes";
import { FISH_UPGRADES, upgradeCost } from "../data/fishing";
import { ITEMS, ItemDef, PET_LIST, PREMIUM, rollPremium } from "../data/items";
import { DICE_LUCK, DICE_TIERS, TIER_INFO, Tier, rollDiceTier, tierIndex } from "../data/tiers";
import { fishLv } from "../systems/fishing";
import { dailyDay } from "../systems/goals";
import { addPet, hasPass, persist, save } from "../systems/save";
import { buzz, sfx } from "../systems/sound";
import { POTION_GEMS, potionMinutes, potionMult } from "../systems/stats";
import { fmt } from "./format";
import { Host, Screen } from "./screens";
import { Button, button, fitText, label, text } from "./widgets";

/** Free gifts pile up: one every 30 minutes, up to 8, all opened with one tap. */
const FREE_GIFT_MS = 30 * 60 * 1000;
const FREE_GIFT_MAX = 8;
export const freeGifts = () => (Date.now() < save.freeGiftAt ? 0 : Math.min(FREE_GIFT_MAX, 1 + Math.floor((Date.now() - save.freeGiftAt) / FREE_GIFT_MS)));
const WHEEL_MS = 4 * 60 * 60 * 1000;
const WHEEL_GEMS = 25;
const DAY_MS = 24 * 60 * 60 * 1000;

const income = (minutes: number) => Math.max(1000, save.cashPerSec * 60 * minutes);
const day = () => Math.floor(Date.now() / DAY_MS);
/** "2d 5h" for long waits. */
const days = (ms: number) => {
  const h = Math.max(0, Math.floor(ms / 3600000));
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : clock(ms);
};
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

/** Same rewards added up for showing (x3 + x5 dice of a tier = x8, 10m + 5m potion = 15m). */
function mergeRewards(list: Reward[]): Reward[] {
  const out: Reward[] = [];
  for (const r of list) {
    const m = /^(x?)(\d+)(m?)$/.exec(r.amount);
    const same = m && out.find((o) => o.icon === r.icon && new RegExp(`^${m[1]}\\d+${m[3]}$`).test(o.amount));
    if (m && same) {
      const n = Number(/\d+/.exec(same.amount)![0]) + Number(m[2]);
      same.amount = `${m[1]}${n}${m[3]}`;
    } else out.push({ ...r });
  }
  return out;
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
    id: "silver", name: "Silver Chest", tex: "chest_silver", color: "blue", hint: "8-12 better dice + gems", gems: 75, minutes: 0,
    rewards: () => [...diceRewards(8 + Math.floor(Math.random() * 5), 20), gemReward(3 + Math.floor(Math.random() * 4)), cashReward(income(15))],
  },
  {
    id: "gold", name: "Golden Chest", tex: "chest_gold", color: "gold", hint: "15-20 rare dice + lots more", gems: 240, minutes: 0,
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
  { title: "MEGA DICE BOX", desc: "20 A dice + 8 B dice + 2 C dice", icons: ["die_A", "die_B", "die_C"], was: 420, gems: 165, rewards: () => [diceReward("A", 20), diceReward("B", 8), diceReward("C", 2)] },
  { title: "LUCKY BUNDLE", desc: "3 Luck Potions + 5 B dice", icons: ["icon_potion", "icon_clover", "die_B"], was: 180, gems: 75, rewards: () => [potionReward(potionMinutes() * 3), diceReward("B", 5)] },
  { title: "BOOST PACK", desc: "2 of every Battle Boost", icons: ["gd_bubble", "pk_heart", "skill_orb"], was: 270, gems: 105, rewards: () => BOOSTS.map((b) => ({ icon: b.icon, amount: "x2", give: () => (save.boosts[b.id] = (save.boosts[b.id] ?? 0) + 2) })) },
  { title: "RARE ROLLER", desc: "4 C dice + 1 D die", icons: ["die_C", "die_D", "die_C"], was: 360, gems: 150, rewards: () => [diceReward("C", 4), diceReward("D", 1)] },
  { title: "TREASURE TRIO", desc: "3 Silver Chests in one", icons: ["chest_silver", "chest_silver", "chest_silver"], was: 225, gems: 105, rewards: () => [0, 1, 2].flatMap(() => CHESTS[1].rewards()) },
];

// ───────────────────────── the Event Shop ─────────────────────────

/** Three offers that change every 8 hours, and a legendary special every week. */
const ROTATION_MS = 8 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const slotNow = () => Math.floor(Date.now() / ROTATION_MS);
const weekNow = () => Math.floor(Date.now() / WEEK_MS);

/** A small seeded random, so every player sees the same offers at the same time. */
function seeded(n: number): () => number {
  let a = (n * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Your best pet class so far (0 = A ... 7 = uSSS). */
const bestClass = () => Math.max(0, ...Object.keys(save.pets).filter((id) => ITEMS[id]).map((id) => tierIndex(ITEMS[id].cls)));

/** A pet from the classes lo..hi; within a class the rarer ones come out a little less often. */
function eggPet(lo: number, hi: number): ItemDef {
  const pool = PET_LIST.filter((p) => tierIndex(p.cls) >= lo && tierIndex(p.cls) <= hi);
  const w = pool.map((p) => 1 / p.oneIn ** 0.12);
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

interface Offer {
  id: string;
  name: string;
  icon: string;
  /** Golden Tickets */
  price: number;
  desc: () => string;
  /** what it gives (worked out when bought) */
  rewards: (scene: Phaser.Scene) => Reward[];
}

/** An egg hatches one pet from `from` to `to` classes above your best. */
const eggReward = (scene: Phaser.Scene, from: number, to: number): Reward[] => {
  const b = bestClass();
  const pet = eggPet(Math.min(7, b + from), Math.min(7, b + to));
  return [{
    icon: petTexture(scene, pet.id), amount: pet.name,
    give: () => {
      if (!save.discovered.includes(pet.id)) {
        save.discovered.push(pet.id);
        save.newPets.push(pet.id);
      }
      addPet(pet.id);
      save.bestRoll = Math.max(save.bestRoll, pet.oneIn);
    },
  }];
};
const className = (k: number) => DICE_TIERS[Math.min(7, k)];

const OFFERS: Offer[] = [
  { id: "egg", name: "Lucky Egg", icon: "icon_egg", price: 3, desc: () => `A pet of class ${className(bestClass())} or ${className(bestClass() + 1)}`, rewards: (sc) => eggReward(sc, 0, 1) },
  { id: "sss", name: "2 SSS Dice", icon: "die_SSS", price: 3, desc: () => `x${fmt(DICE_LUCK.SSS)} luck per roll`, rewards: () => [diceReward("SSS", 2)] },
  { id: "s", name: "3 S Dice", icon: "die_S", price: 2, desc: () => `x${fmt(DICE_LUCK.S)} luck per roll`, rewards: () => [diceReward("S", 3)] },
  { id: "potion", name: "Mega Potion", icon: "icon_potion", price: 1, desc: () => `x${potionMult()} luck for 60 min`, rewards: () => [potionReward(60)] },
  { id: "boosts", name: "Boost Crate", icon: "skill_orb", price: 1, desc: () => "3 of every Battle Boost", rewards: () => BOOSTS.map((b) => ({ icon: b.icon, amount: "x3", give: () => (save.boosts[b.id] = (save.boosts[b.id] ?? 0) + 3) })) },
  { id: "gems", name: "Gem Hoard", icon: "icon_gem", price: 2, desc: () => "150 gems", rewards: () => [gemReward(150)] },
  { id: "lucky", name: "50 Lucky Rolls", icon: "icon_clover", price: 1, desc: () => "Your next 50 rolls are Lucky", rewards: () => [{ icon: "icon_clover", amount: "x50", give: () => (save.luckyBoost += 50) }] },
  { id: "vault", name: "Golden Vault", icon: "chest_gold", price: 1, desc: () => `${fmt(income(180))} money (3 hours)`, rewards: () => [cashReward(income(180))] },
  {
    id: "shells", name: "Pearl Treasure", icon: "fish_shell", price: 2, desc: () => `${fmt(shellPrize())} shells for fishing upgrades`,
    rewards: () => [{ icon: "fish_shell", amount: fmt(shellPrize()), give: () => (save.fishing.shells += shellPrize()) }],
  },
];

/** Enough shells for the next level of every fishing upgrade. */
const shellPrize = () => Math.max(500, FISH_UPGRADES.filter((u) => fishLv(u.id) < u.max).reduce((a, u) => a + upgradeCost(u, fishLv(u.id)), 0));

/** The weekly specials take turns. */
const SPECIALS: Offer[] = [
  { id: "usss", name: "uSSS Die", icon: "die_uSSS", price: 16, desc: () => `The rarest die: x${fmt(DICE_LUCK.uSSS)} luck on one roll`, rewards: () => [diceReward("uSSS", 1)] },
  { id: "mythic", name: "Mythic Egg", icon: "icon_egg", price: 5, desc: () => `A pet of class ${className(bestClass() + 1)} or ${className(bestClass() + 2)}`, rewards: (sc) => eggReward(sc, 1, 2) },
];

/** This rotation's three offers. */
function offersNow(): Offer[] {
  const rnd = seeded(slotNow());
  const pool = [...OFFERS];
  const out: Offer[] = [];
  while (out.length < 3) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
const specialNow = () => SPECIALS[weekNow() % SPECIALS.length];

/** What you already bought in this rotation and this week. */
function shopState() {
  const e = save.eventShop;
  if (e.slot !== slotNow()) {
    e.slot = slotNow();
    e.bought = [];
  }
  if (e.week !== weekNow()) {
    e.week = weekNow();
    e.special = false;
  }
  return e;
}

// ───────────────────────── the Traveling Merchant ─────────────────────────

/** The merchant restocks every 30 minutes: 6 slots, each a random ware of a random rarity. */
const MERCHANT_MS = 30 * 60 * 1000;
const REROLL_GEMS = 45;
const cycleNow = () => Math.floor(Date.now() / MERCHANT_MS);
const RARITY_NAMES = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"];
const RARITY_BG: BtnColor[] = ["mint", "blue", "purple", "orange", "gold"];
/** chance of each rarity per slot, in % */
const RARITY_ODDS = [48, 28, 15, 7, 2];

interface Ware {
  id: string;
  name: string;
  icon: string;
  /** price in gems, or else in minutes of your income */
  gems?: number;
  minutes?: number;
  rewards: (scene: Phaser.Scene) => Reward[];
}

const boostPack = (n: number): Reward[] => {
  const b = BOOSTS[Math.floor(Math.random() * BOOSTS.length)];
  return [{ icon: b.icon, amount: `x${n}`, give: () => (save.boosts[b.id] = (save.boosts[b.id] ?? 0) + n) }];
};
const stageTierPlus = (k: number): Tier => DICE_TIERS[Math.min(DICE_TIERS.indexOf("SSS"), Math.floor((save.stage - 1) / 20) + k)];

/** Wares by rarity (common to legendary). Dice follow your stage's tier. */
const WARES: Ware[][] = [
  [
    { id: "dice0", name: "Dice Bag", icon: "die_A", minutes: 8, rewards: () => [diceReward(stageTierPlus(0), 8)] },
    { id: "cash0", name: "Coin Sack", icon: "icon_cash", gems: 12, rewards: () => [cashReward(income(30))] },
    { id: "speed0", name: "Speed Potion", icon: "icon_clock", gems: 15, rewards: () => [{ icon: "icon_clock", amount: "10m", give: () => (save.speedUntil = Math.max(Date.now(), save.speedUntil) + 600000) }] },
    { id: "shell0", name: "Shell Pouch", icon: "fish_shell", minutes: 10, rewards: () => [{ icon: "fish_shell", amount: "x60", give: () => (save.fishing.shells += 60) }] },
  ],
  [
    { id: "dice1", name: "Better Dice", icon: "die_B", gems: 36, rewards: () => [diceReward(stageTierPlus(1), 4)] },
    { id: "potion1", name: "Luck Potion", icon: "icon_potion", gems: 24, rewards: () => [potionReward(10)] },
    { id: "boost1", name: "Battle Boost", icon: "skill_orb", minutes: 12, rewards: () => boostPack(1) },
    { id: "lucky1", name: "Lucky Rolls", icon: "icon_clover", gems: 30, rewards: () => [{ icon: "icon_clover", amount: "x10", give: () => (save.luckyBoost += 10) }] },
  ],
  [
    { id: "dice2", name: "Rare Dice", icon: "die_C", gems: 105, rewards: () => [diceReward(stageTierPlus(2), 3)] },
    { id: "boost2", name: "Boost Bundle", icon: "pk_heart", gems: 75, rewards: () => BOOSTS.map((b) => ({ icon: b.icon, amount: "x1", give: () => (save.boosts[b.id] = (save.boosts[b.id] ?? 0) + 1) })) },
    { id: "chest2", name: "Silver Chest", icon: "chest_silver", gems: 60, rewards: () => CHESTS[1].rewards() },
  ],
  [
    { id: "dice3", name: "Epic Dice", icon: "die_D", gems: 270, rewards: () => [diceReward(stageTierPlus(3), 2)] },
    { id: "chest3", name: "Golden Chest", icon: "chest_gold", gems: 180, rewards: () => CHESTS[2].rewards() },
    { id: "potion3", name: "Mega Potion", icon: "icon_potion", gems: 120, rewards: () => [potionReward(45)] },
  ],
  [
    { id: "dice4", name: "Legendary Die", icon: "die_S", gems: 900, rewards: () => [diceReward(stageTierPlus(4), 1)] },
    { id: "egg4", name: "Lucky Egg", icon: "icon_egg", gems: 1350, rewards: (sc) => eggReward(sc, 0, 1) },
    { id: "ticket4", name: "Golden Ticket", icon: "icon_ticket", gems: 2400, rewards: () => [{ icon: "icon_ticket", amount: "x1", give: () => save.tickets++ }] },
  ],
];

interface Slot {
  ware: Ware;
  rarity: number;
  stock: number;
}

/** This restock's six slots (everyone sees the same ones, until they buy a reroll). */
function merchantNow(): Slot[] {
  const m = save.merchant;
  if (m.cycle !== cycleNow()) {
    m.cycle = cycleNow();
    m.shift = 0;
    m.bought = [];
  }
  const rnd = seeded(cycleNow() * 31 + m.shift * 7919 + 17);
  const used = new Set<string>();
  return [0, 1, 2, 3, 4, 5].map(() => {
    let r = rnd() * 100;
    let rarity = 0;
    while (rarity < 4 && r >= RARITY_ODDS[rarity]) r -= RARITY_ODDS[rarity++];
    // no ware twice: take the next rarity up when this one is used up
    while (rarity < 4 && WARES[rarity].every((w) => used.has(w.id))) rarity++;
    const pool = WARES[rarity].filter((w) => !used.has(w.id));
    const ware = pool.length ? pool[Math.floor(rnd() * pool.length)] : WARES[rarity][0];
    used.add(ware.id);
    return { ware, rarity, stock: rarity >= 3 ? 1 : 1 + Math.floor(rnd() * 3) };
  });
}

// ───────────────────────── Playtime Gifts ─────────────────────────

/** Gifts that unlock as you play today (minutes), better and better. */
const PLAY_GIFTS = [1, 3, 5, 8, 12, 16, 20, 25, 30, 40, 50, 60];

function playState() {
  const p = save.playtime;
  if (p.day !== day()) {
    p.day = day();
    p.secs = 0;
    p.claimed = [];
  }
  return p;
}

/** Counts time played (called every frame by the game). */
export function tickPlaytime(ms: number): void {
  playState().secs += ms / 1000;
}

/** A playtime gift is waiting. */
export const playGiftReady = () => {
  const p = playState();
  return PLAY_GIFTS.some((m, i) => p.secs >= m * 60 && !p.claimed.includes(i));
};

function playGiftRewards(i: number): Reward[] {
  const big = i === PLAY_GIFTS.length - 1;
  if (big) return [diceReward(stageTierPlus(2), 3), gemReward(15), potionReward(15)];
  switch (i % 4) {
    case 0: return [diceReward(stageTierPlus(Math.floor(i / 4)), 3 + i)];
    case 1: return [gemReward(2 + Math.floor(i / 2))];
    case 2: return [cashReward(income(5 + i * 2)), ...(i >= 6 ? boostPack(1) : [])];
    default: return [potionReward(3 + i), { icon: "fish_shell", amount: `x${20 + i * 10}`, give: () => (save.fishing.shells += 20 + i * 10) }];
  }
}

export type ShopTab = "featured" | "merchant" | "gifts" | "items";
const SHOP_TABS: { id: ShopTab; label: string; icon: string; color: BtnColor }[] = [
  { id: "featured", label: "FEATURED", icon: "icon_star", color: "gold" },
  { id: "merchant", label: "MERCHANT", icon: "chest", color: "orange" },
  { id: "gifts", label: "GIFTS", icon: "icon_gift", color: "pink" },
  { id: "items", label: "ITEMS", icon: "icon_dice", color: "blue" },
];

// ───────────────────────── the look (PS99-style) ─────────────────────────

/** Width of the category rail on the left, and how much the content is scaled to fit beside it. */
/** the shop's categories are a row of tabs along the top (no side rail any more) */
const RAIL = 0;
const TAB_H = 112;
const CARD_HEX: Record<string, number> = {
  peach: 0xffb08a, mint: 0x5fe0a8, orange: 0xff9a3a, green: 0x6fd25a, red: 0xff5a5a, grey: 0xa8b0bc, blue: 0x4fa8ff,
  purple: 0xb36aff, gold: 0xffc93a, brown: 0xb07a4a, cream: 0xf4dcb0, pink: 0xff7ab8,
};
/** Paint splat colours behind rewards, like inventory slots. */
const SPLASH = [0x7fd8ff, 0xffe066, 0xff9ad0, 0x9cf07a, 0xc9a0ff, 0xffb070];
/** The daily pack chain: the first step costs gems, then every next one is free. */
/**
 * The Classic Pack: a long chain. Every 5th step costs gems (more each time), the 4 after it are
 * FREE, 10 times over, and the very last step is 5 uSSS dice. Progress is kept until you finish.
 */
const PACK_PAID = [60, 120, 200, 300, 450, 650, 900, 1200, 1600, 2000];
const PACK_STEPS = PACK_PAID.length * 5;
const packTier = (t: number): Tier => DICE_TIERS[Math.min(6, Math.floor(t * 0.7))];
function packStep(i: number): { gems: number; rewards: () => Reward[] } {
  const t = Math.floor(i / 5);
  const k = i % 5;
  if (i === PACK_STEPS - 1) return { gems: 0, rewards: () => [diceReward("uSSS", 5)] };
  if (k === 0) return { gems: PACK_PAID[t], rewards: () => [diceReward(DICE_TIERS[Math.min(6, Math.floor(t * 0.7) + 1)], 5)] };
  if (k === 1) return { gems: 0, rewards: () => [gemReward(5 + 5 * t)] };
  if (k === 2) return { gems: 0, rewards: () => [potionReward(10 + 5 * t)] };
  if (k === 3) return { gems: 0, rewards: () => [diceReward(packTier(t), 3 + t)] };
  return { gems: 0, rewards: () => [cashReward(income(30 + 30 * t))] };
}

/** The shop window: bright sky blue with soft diagonal stripes. */
function shopBg(scene: Phaser.Scene, w: number, h: number): string {
  return canvasTexture(scene, `ps_shop_bg_${w}_${h}`, w, h, (c) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#d4f4ff");
    g.addColorStop(0.5, "#9fdcff");
    g.addColorStop(1, "#6cb8f5");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.save();
    c.globalAlpha = 0.18;
    c.fillStyle = "#ffffff";
    for (let x = -h; x < w; x += 90) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 40, 0);
      c.lineTo(x + 40 + h, h);
      c.lineTo(x + h, h);
      c.fill();
    }
    c.restore();
    // the darker rail on the left
    const r = c.createLinearGradient(0, 0, RAIL, 0);
    r.addColorStop(0, "rgba(20,33,61,0.55)");
    r.addColorStop(1, "rgba(20,33,61,0.35)");
    c.fillStyle = r;
    c.fillRect(0, 0, RAIL, h);
  });
}

/** An item card: a vivid gradient with sunburst rays, sparkles and a thick black outline. */
function psCard(scene: Phaser.Scene, color: number, w: number, h: number): string {
  return vividCard(scene, color, w, h);
}

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
  private drag = { on: false, y: 0, oy: 0, moved: 0, x: 0, ox: 0, axis: "" as "" | "x" | "y", strip: false };
  /** the Classic Pack's sideways strip, and how far it can scroll */
  private packStrip: Phaser.GameObjects.Container | null = null;
  private packMin = 0;
  private packBox = { y0: 0, y1: 0 };
  private refreshers: (() => void)[] = [];
  private ticking: (() => void)[] = [];
  private wheel!: Phaser.GameObjects.Container;
  private spinning = false;
  private overlay: Phaser.GameObjects.Container | null = null;
  /** the Event Shop's offers change with the rotation: the shop is rebuilt then */
  private builtSlot = -1;
  private builtCycle = -1;
  private tab: ShopTab = "featured";
  private tabBtns: { id: ShopTab; bg: Phaser.GameObjects.Image; dot: Phaser.GameObjects.Arc }[] = [];
  /** content scale beside the rail, and where the list sits when scrolled to the top */
  private readonly k = 1;
  private baseY = 0;
  private tabW = 240;

  constructor(scene: Phaser.Scene, host: Host) {
    super(scene, host, null);
    const s = scene;
    makePickupTextures(s);
    makeGadgetTextures(s);
    makeEventTextures(s);
    const W = s.scale.width;
    this.root.add(s.add.image(0, 0, shopBg(s, W, host.L.navTop)).setOrigin(0).setInteractive());
    // categories in a row of tabs along the top, the items below them
    const tabsTop = host.L.headerBottom + 8;
    this.buildTabs(tabsTop);
    this.top = tabsTop + TAB_H + 8;
    this.bottom = host.L.navTop - 10;
    this.list = s.add.container(RAIL, 0).setScale(this.k);
    this.baseY = this.top * (1 - this.k) - 6;
    this.list.y = this.baseY;
    const mask = s.make.graphics({}, false).fillRect(RAIL, this.top, W - RAIL, this.bottom - this.top);
    this.list.setMask(mask.createGeometryMask());
    this.root.add(this.list);
    this.build();
    s.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.visible || this.overlay || p.y < this.top || p.y > this.bottom || p.x < RAIL) return;
      // is the finger on the Classic Pack strip? (its box is in list space)
      const ly = (p.y - this.list.y) / this.k;
      const strip = !!this.packStrip && ly > this.packBox.y0 && ly < this.packBox.y1;
      this.drag = { on: true, y: p.y, oy: this.list.y, moved: 0, x: p.x, ox: this.packStrip?.x ?? 0, axis: "", strip };
    });
    s.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.drag.on || !p.isDown) return;
      const dx = p.x - this.drag.x;
      const dy = p.y - this.drag.y;
      this.drag.moved = Math.max(this.drag.moved, Math.abs(dx), Math.abs(dy));
      if (!this.drag.axis && Math.hypot(dx, dy) > 12) this.drag.axis = this.drag.strip && Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (this.drag.axis === "x" && this.packStrip) this.placeStrip(this.drag.ox + dx / this.k);
      else if (this.drag.axis === "y") this.list.y = Phaser.Math.Clamp(this.drag.oy + dy, this.baseY - this.max, this.baseY);
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
    const bar = s.add.graphics();
    bar.fillStyle(0x14213d, 0.35).fillRoundedRect(40, y + 8, 1000, 88, 28);
    bar.fillStyle(CARD_HEX[color] ?? 0xffffff, 1).fillRoundedRect(52, y + 22, 14, 60, 7);
    this.list.add([bar, text(s, 86, y + 52, title, 50, "#ffffff", { stroke: 10 }).setOrigin(0, 0.5)]);
    return y + 116;
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
    const tint = CARD_HEX[bg] ?? 0xffffff;
    // a shine spins slowly behind every item
    const glow = s.add.image(x, 0, "paint_splash").setTint(lighten(tint, 0.6)).setScale((size * 1.45) / 200).setAngle(Math.random() * 360);
    s.tweens.add({ targets: glow, scale: glow.scale * 1.06, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const icons = s.add.container(x, 0);
    for (let i = 0; i < count; i++) {
      const k = count === 1 ? 0 : i / (count - 1) - 0.5;
      const img = s.add.image(k * size * 0.8, Math.abs(k) * size * 0.2, icon).setAngle(k * 30);
      img.setScale((count === 1 ? size : size * 0.75) / Math.max(img.width, img.height));
      icons.add(img);
    }
    // the last ones in the pile sit on top, so put the middle one there
    if (count > 1) icons.bringToTop(icons.list[Math.floor(count / 2)]);
    const d = label(s, x, bot - 104, desc(), 24, "#ffffff", w - 70).setOrigin(0.5, 1).setStroke("#111111", 6);
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
      s.add.image(x + 2, y + 4, psCard(s, tint, w, h)),
      glow, icons,
      fitText(text(s, x, top + 40, title, 40, "#ffffff", { stroke: 10 }), w - 40),
      d, btn,
    ]);
  }

  // ───────────────────────── the shop ─────────────────────────

  private build(): void {
    const s = this.scene;
    const W = s.scale.width;
    let y = this.top + 20;
    // PS99-style: one tab of the shop at a time
    const tab = this.tab;
    if (tab === "featured") {
      y = this.buildPremium(y);
      y = this.buildEventShop(y);
      y = this.buildPack(y);
      y = this.buildPasses(y);
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
        s.add.image(W / 2, cy, vividCard(s, 0xb36aff, 1000, dh)), rays, ...pile,
        text(s, W / 2, y + 38, "DEAL OF THE DAY", 34, "#fff3dc"),
        text(s, 660, cy - 70, deal.title, 60, "#ffe066", { stroke: 10 }),
        fitText(text(s, 660, cy, deal.desc, 30), 560),
        timer, was, strike, dealBtn, sticker,
      ]);
      y += dh + 40;

      // ── lucky wheel
      y = this.header(y, "LUCKY WHEEL", "pink");
      const wh = 560;
      const wy = y + wh / 2;
      this.list.add(s.add.image(W / 2, wy, vividCard(s, 0xff7ab8, 1000, wh)));
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
      const wheelInfo = label(s, 800, wy - 60, "", 28, "#ffffff", 340).setStroke("#111111", 6);
      this.ticking.push(() => wheelInfo.setText(Date.now() >= save.wheelAt ? "A free spin is ready!" : `Free spin in ${clock(save.wheelAt - Date.now())}`));
      this.list.add([
        this.wheel, pointer,
        text(s, 800, wy - 170, "Spin to win!", 52, "#ffffff", { stroke: 10 }),
        label(s, 800, wy - 110, "Dice, gems, money, potions... or the MEGA JACKPOT", 26, "#ffffff", 340).setStroke("#111111", 6),
        wheelInfo, wheelBtn,
      ]);
      y += wh + 40;

    }
    if (tab === "merchant") y = this.buildMerchant(y);
    if (tab === "gifts") {
      y = this.buildPlaytime(y);
      // ── free stuff
      y = this.header(y, "FREE", "green");
      const fh = 360;
      const giftBtn = this.priceButton(0, 0, 260, 88, () => {
        const n = freeGifts();
        return { label: n ? `OPEN x${n}` : clock(save.freeGiftAt - Date.now()), color: n ? "green" : "grey", ok: n > 0 };
      }, () => {
        const n = freeGifts();
        let gems = 0;
        for (let i = 0; i < n; i++) gems += 1 + Math.floor(Math.random() * 2);
        const r = [gemReward(gems), diceReward("A", 3 * n), cashReward(income(5 * n))];
        r.forEach((x) => x.give());
        save.freeGiftAt = Date.now() + FREE_GIFT_MS;
        this.rewardShow(n > 1 ? `${n} FREE GIFTS!` : "FREE GIFT", null, r);
        return true;
      });
      this.tile(W / 2 - 255, y + fh / 2, 490, fh, "green", "icon_gift", 120, "Free Gifts", () => `${freeGifts()}/${FREE_GIFT_MAX} waiting  •  +1 every 30 min`, giftBtn, 3);
      const dailyBtn = this.priceButton(0, 0, 260, 88, () => {
        const ready = dailyDay() >= 0;
        return { label: ready ? "CLAIM" : "TOMORROW", color: ready ? "gold" : "grey", ok: true };
      }, () => {
        this.host.showDaily();
        return false;
      });
      this.tile(W / 2 + 255, y + fh / 2, 490, fh, "gold", "icon_star", 120, "Daily Reward", () => (dailyDay() >= 0 ? `Day ${dailyDay() + 1} of 7 is waiting for you!` : `Day ${(save.dailyStreak - 1) % 7 + 1} of 7 claimed. Come back tomorrow!`), dailyBtn);
      y += fh + 40;

    }
    if (tab === "items") {
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
      const dice: [Tier, number, number, number][] = [["A", 10, 0, 10], ["A", 50, 60, 0], ["B", 10, 75, 0], ["C", 5, 180, 0], ["D", 2, 360, 0], ["E", 1, 900, 0]];
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
        ["icon_clock", "Speed Potion", () => "Roll twice as fast for 10 min", 36, () => (save.speedUntil = Math.max(Date.now(), save.speedUntil) + 10 * 60000)],
        ["icon_clover", "10 Lucky Rolls", () => `Your next 10 rolls are Lucky (${save.luckyBoost} left)`, 45, () => (save.luckyBoost += 10)],
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
      ([["Bag of Money", 15, 15], ["Chest of Money", 120, 90], ["Vault of Money", 720, 450]] as [string, number, number][]).forEach(([name, minutes, gems], i) => {
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
    }
    this.max = Math.max(0, y * this.k + this.baseY - this.bottom + 20);
  }

  // ───────────────────────── tabs ─────────────────────────

  /** The category rail: big square buttons down the left side, the open one lit up. */
  private buildTabs(top: number): void {
    const s = this.scene;
    const W = s.scale.width;
    const n = SHOP_TABS.length;
    const gap = 12;
    const w = (W - 32 - gap * (n - 1)) / n;
    const bar = s.add.graphics();
    bar.fillStyle(0x14213d, 0.4).fillRoundedRect(8, top - 4, W - 16, TAB_H + 8, 30);
    this.root.add(bar);
    SHOP_TABS.forEach((t, i) => {
      const x = 16 + w / 2 + i * (w + gap);
      const y = top + TAB_H / 2;
      const bg = s.add.image(0, 0, btnTexture(s, t.id === this.tab ? t.color : "blue", w, TAB_H - 8));
      const icon = s.add.image(-w / 2 + 46, -2, t.icon);
      icon.setScale(58 / Math.max(icon.width, icon.height));
      const c = s.add.container(x, y, [bg, icon, fitText(text(s, 22, -2, t.label, 28, "#ffffff", { stroke: 7 }), w - 100)]).setSize(w, TAB_H - 8).setInteractive({ useHandCursor: true });
      c.on("pointerdown", () => s.tweens.add({ targets: c, scale: 0.92, duration: 60 }));
      c.on("pointerout", () => c.setScale(1));
      c.on("pointerup", () => {
        c.setScale(1);
        this.setShopTab(t.id);
      });
      const dot = s.add.circle(x + w / 2 - 12, top + 8, 14, 0xf03e3e).setStrokeStyle(4, INK_N).setVisible(false);
      s.tweens.add({ targets: dot, scale: 1.2, duration: 420, yoyo: true, repeat: -1 });
      this.root.add([c, dot]);
      this.tabBtns.push({ id: t.id, bg, dot });
    });
    this.tabW = w;
  }

  private setShopTab(t: ShopTab): void {
    if (this.overlay || this.spinning) return;
    sfx.click();
    this.tab = t;
    for (const b of this.tabBtns) b.bg.setTexture(btnTexture(this.scene, b.id === t ? SHOP_TABS.find((x) => x.id === b.id)!.color : "blue", this.tabW, TAB_H - 8));
    this.rebuild(true);
  }

  /** Builds the list again (new tab, new offers); `top` scrolls back up. */
  private rebuild(top = false): void {
    const y = this.list.y;
    this.list.removeAll(true);
    this.packStrip = null;
    this.refreshers = [];
    this.ticking = [];
    this.build();
    this.list.y = top ? this.baseY : Phaser.Math.Clamp(y, this.baseY - this.max, this.baseY);
  }

  // ───────────────────────── the Traveling Merchant ─────────────────────────

  /** A striped market awning with the merchant's name, the restock timer and a reroll. */
  private buildMerchant(y0: number): number {
    const s = this.scene;
    const W = s.scale.width;
    this.builtCycle = cycleNow();
    let y = y0;
    const aw = s.add.graphics();
    for (let i = 0; i < 10; i++) {
      aw.fillStyle(i % 2 ? 0xfff3dc : 0xe8434f, 1).fillRect(40 + i * 100, y, 100, 70);
      aw.fillStyle(i % 2 ? 0xfff3dc : 0xe8434f, 1).fillCircle(90 + i * 100, y + 70, 50);
    }
    aw.lineStyle(6, INK_N, 1).strokeRect(40, y, 1000, 70);
    const sign = s.add.container(W / 2, y + 150, [
      s.add.image(0, 0, btnTexture(s, "brown", 760, 120)),
      text(s, 0, -14, "TRAVELING MERCHANT", 46, "#ffe066"),
    ]);
    const timer = text(s, 0, 34, "", 24, "#fff3dc");
    sign.add(timer);
    this.ticking.push(() => timer.setText(`New wares in ${clock((cycleNow() + 1) * MERCHANT_MS - Date.now())}`));
    this.list.add([aw, sign]);
    y += 240;
    // the odds, like a real shop sign
    const odds = RARITY_NAMES.map((n, i) => `${n} ${RARITY_ODDS[i]}%`).join("   ");
    this.list.add(fitText(text(s, W / 2, y, odds, 22, "#4a2f1d", { stroke: false }), 980));
    y += 40;
    const slots = merchantNow();
    const th = 420;
    slots.forEach((sl, i) => {
      const x = W / 2 + ((i % 3) - 1) * 345;
      const ty = y + Math.floor(i / 3) * (th + 26) + th / 2;
      const left = () => sl.stock - (save.merchant.bought[i] ?? 0);
      const w = sl.ware;
      const price = () => {
        const out = left() <= 0;
        const cost = w.gems ?? income(w.minutes ?? 0);
        const have = w.gems ? save.gems : save.cash;
        const ok = !out && have >= cost;
        return { label: out ? "SOLD OUT" : fmt(cost), icon: out ? undefined : w.gems ? "icon_gem" : "icon_cash", color: (ok ? RARITY_BG[sl.rarity] : "grey") as BtnColor, ok };
      };
      const btn = this.priceButton(0, 0, 270, 88, price, () => {
        if (w.gems) {
          if (!this.spendGems(w.gems)) return false;
        } else save.cash -= income(w.minutes ?? 0);
        save.merchant.bought[i] = (save.merchant.bought[i] ?? 0) + 1;
        const r = w.rewards(s);
        r.forEach((x2) => x2.give());
        this.rewardShow(w.name.toUpperCase(), null, r);
        return true;
      });
      this.tile(x, ty, 325, th, RARITY_BG[sl.rarity], w.icon, 130, w.name, () => `${RARITY_NAMES[sl.rarity]}\n${left() > 0 ? `${left()} left` : "Sold out"}`, btn);
      if (sl.rarity >= 3) {
        const star = s.add.star(x + 130, ty - th / 2 + 30, 6, 16, 30, sl.rarity === 4 ? 0xffe066 : 0xff9a3a).setStrokeStyle(4, INK_N);
        s.tweens.add({ targets: star, angle: 360, duration: 3000, repeat: -1 });
        this.list.add(star);
      }
    });
    y += 2 * (th + 26) + 10;
    const reroll = this.priceButton(W / 2, y + 60, 520, 110, () => ({ label: `REROLL  ${REROLL_GEMS}`, icon: "icon_gem", color: save.gems >= REROLL_GEMS ? "purple" : "grey", ok: save.gems >= REROLL_GEMS }), () => {
      if (!this.spendGems(REROLL_GEMS)) return false;
      save.merchant.shift++;
      save.merchant.bought = [];
      this.host.toast("New wares!", "#ffe066");
      this.scene.time.delayedCall(50, () => this.rebuild());
      return true;
    });
    this.list.add([reroll, label(s, W / 2, y + 140, "Don't like the wares? Reroll them now", 24, "#7a5236")]);
    return y + 200;
  }

  // ───────────────────────── Playtime Gifts ─────────────────────────

  /** 12 gifts that open as you play today; the last one is big. */
  /** The Classic Pack: a long chain you swipe through sideways. */
  private buildPack(y0: number): number {
    const s = this.scene;
    const W = s.scale.width;
    const y = this.header(y0, "CLASSIC PACK", "blue");
    if (save.pack.step >= PACK_STEPS) save.pack.step = 0;
    const ph = 440;
    const cy = y + ph / 2;
    this.list.add(s.add.image(W / 2, cy, vividCard(s, 0x4fa8ff, 1000, ph)));
    // the goal at the end, and how far you are
    const goal = s.add.container(W / 2 + 330, y + 46, [
      itemSplash(s, "die_uSSS", 70, 0xffe066).setPosition(-60, 0),
      text(s, 10, 0, "x5", 34, "#ffe066", { stroke: 8 }),
    ]);
    const prog = text(s, 90, y + 46, "", 30, "#ffffff", { stroke: 8 }).setOrigin(0, 0.5);
    this.refreshers.push(() => prog.setText(`${Math.min(save.pack.step, PACK_STEPS)}/${PACK_STEPS}`));
    const hint = text(s, W / 2, y + ph - 30, "swipe  >>", 26, "#ffffff", { stroke: 6 });
    this.tweens(hint);
    this.list.add([goal, prog, hint]);
    // the strip of steps
    const step = 196;
    const strip = s.add.container(0, 0);
    this.packStrip = strip;
    this.packBox = { y0: y + 80, y1: y + ph - 50 };
    this.packMin = -(PACK_STEPS - 4.5) * step;
    const sy = cy + 4;
    for (let i = 0; i < PACK_STEPS; i++) {
      const p = packStep(i);
      const x = 200 + i * step;
      const paid = p.gems > 0;
      const last = i === PACK_STEPS - 1;
      const slot = s.add.graphics();
      const fill = last ? 0xffe066 : paid ? 0xd8b8ff : 0xffffff;
      slot.fillStyle(0x000000, 0.25).fillRoundedRect(-80, sy - 128, 164, 184, 24);
      slot.fillStyle(fill, 0.95).fillRoundedRect(-84, sy - 134, 164, 184, 24);
      slot.lineStyle(6, 0x111111, 1).strokeRoundedRect(-84, sy - 134, 164, 184, 24);
      slot.setX(x);
      const r = p.rewards()[0];
      const item = itemSplash(s, r.icon, 112, SPLASH[i % SPLASH.length], r.amount, last || paid).setPosition(x - 2, sy - 50);
      const parts: Phaser.GameObjects.GameObject[] = [slot, item];
      if (paid) parts.push(text(s, x - 2, sy - 150, `TIER ${Math.floor(i / 5) + 1}`, 24, "#ffffff", { stroke: 6 }));
      if (last) {
        const glow = s.add.image(x - 2, sy - 50, "rays").setTint(0xffe066).setScale(0.45).setAlpha(0.8);
        s.tweens.add({ targets: glow, angle: 360, duration: 5000, repeat: -1 });
        parts.unshift(glow);
      }
      if (i < PACK_STEPS - 1) parts.push(s.add.triangle(x + step / 2, sy - 50, 0, 0, 0, 26, 18, 13, 0xffe066).setStrokeStyle(4, 0x111111));
      const btn = this.priceButton(x - 2, sy + 102, 170, 80, () => {
        const done = save.pack.step > i;
        const now = save.pack.step === i;
        if (done) return { label: "DONE", color: "grey", ok: false };
        if (paid) return { label: `${p.gems}`, icon: "icon_gem", color: now && save.gems >= p.gems ? "purple" : "grey", ok: now && save.gems >= p.gems };
        return { label: "FREE", color: now ? "green" : "grey", ok: now };
      }, () => {
        if (p.gems && !this.spendGems(p.gems)) return false;
        save.pack.step = i + 1;
        const got = p.rewards();
        got.forEach((g) => g.give());
        this.rewardShow(last ? "CLASSIC PACK DONE!" : paid ? `TIER ${Math.floor(i / 5) + 1}!` : "FREE!", null, got);
        return true;
      });
      parts.push(btn);
      strip.add(parts);
    }
    this.list.add(strip);
    // start with the step you are on near the left
    this.placeStrip(-(Math.max(0, save.pack.step - 1)) * step);
    return y + ph + 40;
  }

  /** Scroll the pack strip; steps outside the card fade out. */
  private placeStrip(x: number): void {
    const strip = this.packStrip;
    if (!strip) return;
    strip.x = Phaser.Math.Clamp(x, this.packMin, 0);
    const W = this.scene.scale.width;
    for (const o of strip.list as unknown as (Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.Components.Visible & { x: number })[]) {
      const sx = o.x + strip.x;
      // the card's inside runs from 50 to W-50 and a step is ~170 wide: a step is fully gone
      // before any part of it reaches the border
      const edge = Math.min(sx - 140, W - 140 - sx);
      o.setVisible(edge > 0);
      o.setAlpha(Phaser.Math.Clamp(edge / 70, 0, 1));
    }
  }

  /** A gentle pulse for a hint. */
  private tweens(t: Phaser.GameObjects.Text): void {
    this.scene.tweens.add({ targets: t, alpha: 0.4, x: t.x + 14, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  }

  /** Gamepasses: bought once, bonuses forever. */
  /**
   * The Premium Egg, like a Pet Simulator egg card: the egg on the left, its five exclusive pets with
   * their chances (the two rarest stay dark until you own them) and four buy buttons with discounts.
   */
  private buildPremium(y0: number): number {
    const s = this.scene;
    const W = s.scale.width;
    const y = y0 + 10;
    const ch = 520;
    const cy = y + ch / 2;
    this.list.add(s.add.image(W / 2, cy, vividCard(s, 0x8a4ae0, 1020, ch)));
    // the egg
    const egg = s.add.image(150, cy - 20, premiumEggTexture(s));
    s.tweens.add({ targets: egg, angle: { from: -5, to: 5 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const eggGlow = s.add.image(150, cy - 20, "glow").setTint(0xb98aff).setScale(2.4).setAlpha(0.7);
    s.tweens.add({ targets: eggGlow, alpha: 0.3, duration: 800, yoyo: true, repeat: -1 });
    const hot = s.add.container(W - 110, y + 54, [text(s, 0, 0, "HOT!", 50, "#ff8a3a", { stroke: 11 })]).setAngle(10);
    s.tweens.add({ targets: hot, scale: 1.12, duration: 420, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.list.add([eggGlow, egg, hot,
      text(s, 330, y + 62, "PREMIUM", 64, "#ffffff", { stroke: 13 }).setOrigin(0, 0.5),
      text(s, 640, y + 66, "Egg", 58, "#ffe066", { stroke: 12 }).setOrigin(0, 0.5),
    ]);
    // the five pets and their chances
    PREMIUM.forEach((p, i) => {
      const x = 340 + i * 150;
      const py = cy - 50;
      const have = !!save.pets[p.def.id];
      const secret = i >= 3 && !have;
      if (i >= 3) {
        const frame = s.add.graphics();
        frame.fillStyle(0x111111, 0.85).fillRoundedRect(x - 62, py - 70, 124, 124, 16);
        frame.lineStyle(6, 0x111111, 1).strokeRoundedRect(x - 62, py - 70, 124, 124, 16);
        this.list.add(frame);
      }
      const img = s.add.image(x, py - 8, petTexture(s, p.def.id)).setScale(0.62);
      if (secret) img.setTintFill(0x9a9aa8);
      s.tweens.add({ targets: img, y: py - 18, duration: 600 + i * 90, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      const pct = `${+(p.chance * 100).toFixed(2)}%`;
      const zone = s.add.zone(x, py, 130, 150).setInteractive({ useHandCursor: true });
      zone.on("pointerup", () => !this.scrolled && this.host.toast(`${p.def.name}: Exclusive, ${Math.round(p.share * 100)}% of your best pet`, "#e6c8ff"));
      this.list.add([img, text(s, x, py + 72, pct, 32, "#ffffff", { stroke: 8 }), zone]);
    });
    // four ways to buy, bigger ones cheaper per egg
    const deals: [number, number, string][] = [[100, 4000, "-33%"], [10, 480, "-20%"], [3, 160, ""], [1, 60, ""]];
    deals.forEach(([n, gems, off], i) => {
      const x = W / 2 + (i - 1.5) * 245;
      const by = cy + 170;
      const btn = this.priceButton(x, by, 225, 100, () => ({ label: `${gems}`, icon: "icon_gem", color: "green", ok: true }), () => {
        if (!this.spendGems(gems)) return false;
        this.openPremium(n);
        return true;
      });
      this.list.add([text(s, x, by - 74, `${n} ${n === 1 ? "egg" : "eggs"}`, 26, "#ffffff", { stroke: 6 }), btn]);
      if (off) this.list.add(text(s, x + 82, by - 52, off, 30, "#ff5a5a", { stroke: 7 }).setAngle(12));
    });
    return y + ch + 40;
  }

  /** Opens n Premium Eggs: the pets join your collection and show up grouped. */
  private openPremium(n: number): void {
    const count: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const p = rollPremium();
      count[p.def.id] = (count[p.def.id] ?? 0) + 1;
    }
    const got: Reward[] = Object.entries(count)
      .sort((a, b) => ITEMS[b[0]].index - ITEMS[a[0]].index)
      .map(([id, k]) => ({ icon: petTexture(this.scene, id), amount: `x${k}`, give: () => { for (let i = 0; i < k; i++) addPet(id); } }));
    got.forEach((r) => r.give());
    persist();
    this.host.petsChanged();
    this.rewardShow(n > 1 ? `${n} PREMIUM EGGS!` : "PREMIUM EGG!", null, got);
  }

  /**
   * Gamepasses like Pet Simulator's: a big bright card each, the name huge on top, the art big on
   * a spinning sunburst, a few big words for what it does and a chunky green price button.
   */
  private buildPasses(y0: number): number {
    const s = this.scene;
    const W = s.scale.width;
    let y = this.header(y0, "GAMEPASSES", "gold");
    const cw = 490;
    const ch = 520;
    PASSES.forEach((p, i) => {
      const col = i % 2;
      if (i > 0 && col === 0) y += ch + 30;
      const x = W / 2 + (col ? 255 : -255);
      const cy = y + ch / 2;
      const owned = hasPass(p.id);
      const rays = s.add.image(x, cy - 30, "rays").setScale(0.62).setAlpha(0.55);
      s.tweens.add({ targets: rays, angle: 360, duration: 10000, repeat: -1 });
      const art = s.add.image(x, cy - 30, p.icon);
      art.setScale(220 / Math.max(art.width, art.height));
      s.tweens.add({ targets: art, y: cy - 44, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: i * 120 });
      const twinkle = s.add.star(x + 120, cy - 130, 4, 6, 22, 0xffffff);
      s.tweens.add({ targets: twinkle, scale: 0.3, alpha: 0.3, duration: 600, yoyo: true, repeat: -1, delay: i * 200 });
      const btn = this.priceButton(x, cy + ch / 2 - 72, 330, 112, () => {
        if (hasPass(p.id)) return { label: "OWNED", color: "gold", ok: false };
        return { label: `${p.gems}`, icon: "icon_gem", color: "green", ok: true };
      }, () => {
        if (hasPass(p.id) || !this.spendGems(p.gems)) return false;
        save.passes.push(p.id);
        this.host.toast(`${p.name.replace("!", "")} is yours forever!`, "#ffe066");
        s.cameras.main.flash(200, 255, 240, 180);
        return true;
      });
      this.list.add([
        s.add.image(x + 2, cy + 4, psCard(s, CARD_HEX[p.color] ?? 0xffffff, cw, ch)),
        rays, art, twinkle,
        fitText(text(s, x, y + 58, p.name.replace("!", ""), 58, "#ffffff", { stroke: 13 }), cw - 50),
        fitText(text(s, x, cy + 110, p.short, 40, "#ffe066", { stroke: 10 }), cw - 50),
        btn,
      ]);
      if (owned) this.list.add(s.add.image(x + cw / 2 - 60, y + 60, "icon_check").setScale(0.7));
    });
    return y + ch + 40;
  }

  /**
   * Playtime gifts as one track: 12 gifts along a bar that fills as you play today, and one
   * CLAIM ALL that opens every gift that is ready (and the stacked free gifts) at once.
   */
  private buildPlaytime(y0: number): number {
    const s = this.scene;
    const W = s.scale.width;
    const y = this.header(y0, "PLAYTIME GIFTS", "pink");
    const ch = 520;
    const cy = y + ch / 2;
    this.list.add(s.add.image(W / 2, cy, vividCard(s, 0xff7ab8, 1000, ch)));
    const played = text(s, W / 2, y + 50, "", 34, "#ffffff", { stroke: 8 });
    this.list.add(played);
    // the track
    const x0 = 110;
    const x1 = W - 110;
    const ty = cy - 10;
    const step = (x1 - x0) / (PLAY_GIFTS.length - 1);
    const bar = s.add.graphics();
    this.list.add(bar);
    const nodes = PLAY_GIFTS.map((mins, i) => {
      const x = x0 + i * step;
      const big = i === PLAY_GIFTS.length - 1;
      const glow = s.add.image(x, ty - 70, "glow").setTint(0xffe066).setScale(0.6).setVisible(false);
      const box = s.add.image(x, ty - 70, big ? "chest_gold" : "icon_gift");
      box.setScale((big ? 96 : 66) / Math.max(box.width, box.height));
      const check = s.add.image(x + 22, ty - 50, "icon_check").setScale(0.36).setVisible(false);
      const lbl = text(s, x, ty + 46, `${mins}m`, 24, "#ffffff", { stroke: 6 });
      this.list.add([glow, box, check, lbl]);
      return { mins, box, glow, check, bounce: null as Phaser.Tweens.Tween | null };
    });
    const next = text(s, W / 2, cy + 110, "", 30, "#ffffff", { stroke: 7 });
    const btn = this.priceButton(W / 2, cy + 190, 520, 120, () => {
      const n = this.giftsReady();
      return { label: n ? `CLAIM ALL  (${n})` : "KEEP PLAYING", color: n ? "green" : "grey", ok: n > 0 };
    }, () => {
      this.claimAllGifts();
      return true;
    });
    this.list.add([next, btn]);
    const refresh = () => {
      const p = playState();
      played.setText(`Played today: ${clock(p.secs * 1000)}`);
      // the bar fills between the gifts you have reached
      let k = 0;
      while (k < PLAY_GIFTS.length && p.secs >= PLAY_GIFTS[k] * 60) k++;
      const prev = k ? PLAY_GIFTS[k - 1] * 60 : 0;
      const part = k >= PLAY_GIFTS.length ? 0 : Math.min(1, (p.secs - prev) / (PLAY_GIFTS[k] * 60 - prev));
      const fx = k === 0 ? x0 + part * 0 : x0 + (k - 1 + (k < PLAY_GIFTS.length ? part : 0)) * step;
      bar.clear();
      bar.fillStyle(0x14213d, 0.5).fillRoundedRect(x0 - 20, ty - 14, x1 - x0 + 40, 28, 14);
      bar.fillStyle(0xffe066, 1).fillRoundedRect(x0 - 20, ty - 14, Math.max(28, fx - x0 + 20), 28, 14);
      bar.lineStyle(5, 0x111111, 1).strokeRoundedRect(x0 - 20, ty - 14, x1 - x0 + 40, 28, 14);
      nodes.forEach((nd, i) => {
        const done = p.claimed.includes(i);
        const ready = !done && p.secs >= nd.mins * 60;
        nd.check.setVisible(done);
        nd.box.setAlpha(done ? 0.4 : 1);
        nd.glow.setVisible(ready);
        if (ready && !nd.bounce) nd.bounce = s.tweens.add({ targets: nd.box, angle: { from: -12, to: 12 }, duration: 160, yoyo: true, repeat: -1 });
        if (!ready && nd.bounce) {
          nd.bounce.stop();
          nd.bounce = null;
          nd.box.setAngle(0);
        }
      });
      const upcoming = PLAY_GIFTS.find((m, i) => p.secs < m * 60 && !p.claimed.includes(i));
      next.setText(upcoming ? `Next gift in ${clock((upcoming * 60 - p.secs) * 1000)}` : "All gifts reached today: new ones tomorrow!");
    };
    refresh();
    this.ticking.push(refresh);
    return y + ch + 40;
  }

  /** Gifts waiting: playtime gifts reached and not opened, plus the stacked free gifts. */
  private giftsReady(): number {
    const p = playState();
    return PLAY_GIFTS.filter((m, i) => p.secs >= m * 60 && !p.claimed.includes(i)).length + freeGifts();
  }

  /** Opens every ready gift in one go and shows what you got, grouped. */
  private claimAllGifts(): void {
    const p = playState();
    const got: Reward[] = [];
    PLAY_GIFTS.forEach((m, i) => {
      if (p.secs >= m * 60 && !p.claimed.includes(i)) {
        p.claimed.push(i);
        got.push(...playGiftRewards(i));
      }
    });
    const n = freeGifts();
    if (n) {
      let gems = 0;
      for (let i = 0; i < n; i++) gems += 1 + Math.floor(Math.random() * 2);
      got.push(gemReward(gems), diceReward("A", 3 * n), cashReward(income(5 * n)));
      save.freeGiftAt = Date.now() + FREE_GIFT_MS;
    }
    got.forEach((r) => r.give());
    persist();
    this.rewardShow("GIFTS!", "chest_gold", mergeRewards(got));
  }

  // ───────────────────────── the Event Shop ─────────────────────────

  /** A price in Golden Tickets; "SOLD" once bought in this rotation. */
  private ticketPrice(price: number, sold: () => boolean) {
    return () => {
      const done = sold();
      const ok = !done && save.tickets >= price;
      return { label: done ? "SOLD" : `${price}`, icon: done ? undefined : "icon_ticket", color: (ok ? "gold" : "grey") as BtnColor, ok };
    };
  }

  private buyOffer(o: Offer): boolean {
    if (save.tickets < o.price) {
      this.host.toast(`You need ${o.price} Golden Tickets. They are rare: find them in events!`, "#ffe066");
      return false;
    }
    save.tickets -= o.price;
    const r = o.rewards(this.scene);
    r.forEach((x) => x.give());
    this.rewardShow(o.name.toUpperCase(), null, r);
    if (o.icon === "icon_egg") this.host.petsChanged();
    return true;
  }

  /**
   * The EVENT SHOP, first in the shop: limited-time offers you can only buy with Golden Tickets,
   * the rarest thing in the game. A legendary special for the week, three offers that change every
   * 8 hours, one of each per player.
   */
  private buildEventShop(y0: number): number {
    const s = this.scene;
    const W = s.scale.width;
    this.builtSlot = slotNow();
    const state = shopState();
    let y = y0;
    // the header: sparkling gold, with your tickets
    y = this.header(y, "EVENT SHOP", "gold");
    const tickets = text(s, 0, 0, "", 40, "#ffe066").setOrigin(0, 0.5);
    const pill = s.add.container(W / 2, y + 20, [s.add.image(0, 0, panelTexture(s, "glass", 560, 84)), s.add.image(-200, 0, "icon_ticket").setScale(0.62), tickets]);
    this.refreshers.push(() => {
      tickets.setText(`${save.tickets} Golden Ticket${save.tickets === 1 ? "" : "s"}`);
      fitText(tickets, 360);
      tickets.setX(-140);
    });
    const note = label(s, W / 2, y + 96, "So rare you're lucky to find one! They come only from events.", 26, "#4a2f1d", 900);
    this.list.add([pill, note]);
    y += 140;

    // the weekly legendary special: a wide tile in deep purple and gold
    const sp = specialNow();
    const sh = 330;
    const sy = y + sh / 2;
    const rays = s.add.image(220, sy, "rays").setTint(0xffd23f).setAlpha(0.45).setScale(0.7);
    s.tweens.add({ targets: rays, angle: 360, duration: 10000, repeat: -1 });
    const glow = s.add.image(220, sy, "glow").setTint(0xff9aff).setScale(1.4).setAlpha(0.6);
    s.tweens.add({ targets: glow, alpha: 0.25, duration: 800, yoyo: true, repeat: -1 });
    const icon = s.add.image(220, sy, sp.icon);
    icon.setScale(170 / Math.max(icon.width, icon.height));
    s.tweens.add({ targets: icon, y: sy - 12, angle: { from: -5, to: 5 }, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const timer = text(s, 680, sy + 40, "", 26, "#ffe6b8");
    this.ticking.push(() => timer.setText(state.special && save.eventShop.week === weekNow() ? "Yours! A new special next week" : `Ends in ${days((weekNow() + 1) * WEEK_MS - Date.now())}`));
    const spBtn = this.priceButton(680, sy + 110, 320, 100, this.ticketPrice(sp.price, () => shopState().special), () => {
      if (!this.buyOffer(sp)) return false;
      shopState().special = true;
      return true;
    });
    const tag = s.add.container(W - 120, y + 34, [s.add.star(0, 0, 10, 44, 56, 0xff4fd8).setStrokeStyle(5, INK_N), text(s, 0, -2, "WEEK", 24)]).setAngle(10);
    s.tweens.add({ targets: tag, scale: 1.1, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.list.add([
      s.add.image(W / 2, sy, btnTexture(s, "purple", 1000, sh)), rays, glow, icon,
      text(s, 680, sy - 112, "LEGENDARY SPECIAL", 28, "#ff9aff"),
      fitText(text(s, 680, sy - 64, sp.name, 54, "#ffe066"), 560),
      fitText(label(s, 680, sy - 10, sp.desc(), 28, "#ffffff", 560), 560),
      timer, spBtn, tag,
    ]);
    y += sh + 30;

    // three offers for 8 hours
    const offers = offersNow();
    const oh = 400;
    const otimer = text(s, W / 2, y + 16, "", 28, "#4a2f1d");
    this.ticking.push(() => otimer.setText(`New offers in ${clock((slotNow() + 1) * ROTATION_MS - Date.now())}`));
    this.list.add(otimer);
    y += 44;
    offers.forEach((o, i) => {
      const x = W / 2 + (i - 1) * 345;
      const btn = this.priceButton(0, 0, 270, 88, this.ticketPrice(o.price, () => shopState().bought.includes(o.id)), () => {
        if (!this.buyOffer(o)) return false;
        shopState().bought.push(o.id);
        return true;
      });
      this.tile(x, y + oh / 2, 325, oh, "gold", o.icon, 130, o.name, o.desc, btn);
    });
    return y + oh + 50;
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
    // everything is centred on the screen: a chest sits above its rewards, a gift bursts
    // right where its rewards appear, and the light rays shine from behind them
    const cols = Math.min(4, rewards.length);
    const rows = Math.ceil(rewards.length / cols);
    const rowH = 210;
    const block = (rows - 1) * rowH;
    const cy = chest ? H / 2 - 120 - block / 2 : H / 2 - block / 2;
    const firstRow = chest ? cy + 270 : cy;
    const dim = s.add.rectangle(0, 0, W, H, 0x1a0e08, 0.82).setOrigin(0).setInteractive();
    const rays = s.add.image(W / 2, chest ? cy : cy + block / 2, "rays").setScale(2).setTint(0xffe066).setAlpha(0);
    const head = text(s, W / 2, cy - 330, title, 84, "#ffe066").setScale(0);
    const box = s.add.image(W / 2, cy, chest ?? "icon_gift").setScale(chest ? 2.6 : 2.2);
    const tap = text(s, W / 2, firstRow + block + 230, "TAP TO CONTINUE", 40).setAlpha(0);
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
      // rewards burst out into a centred grid
      rewards.forEach((rw, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const inRow = Math.min(cols, rewards.length - row * cols);
        const x = W / 2 + (col - (inRow - 1) / 2) * 220;
        const y = firstRow + row * rowH;
        const icon = s.add.image(0, 0, rw.icon);
        icon.setScale(110 / Math.max(icon.width, icon.height));
        const item = s.add.container(W / 2, cy, [
          s.add.image(0, 0, "paint_splash").setTint(SPLASH[i % SPLASH.length]).setScale(0.95).setAngle(i * 67), icon, text(s, 52, 58, rw.amount, 40, "#ffffff", { stroke: 9 }).setOrigin(0.5),
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
    // new Event Shop offers: build the shop again (keeping where you scrolled to)
    const stale = (this.tab === "featured" && slotNow() !== this.builtSlot) || (this.tab === "merchant" && cycleNow() !== this.builtCycle);
    if (stale && !this.overlay && !this.spinning) this.rebuild();
    // red dots: gifts waiting, a free spin, the free gift
    for (const b of this.tabBtns) {
      b.dot.setVisible(
        (b.id === "gifts" && (playGiftReady() || freeGiftReady() || dailyDay() >= 0)) || (b.id === "featured" && Date.now() >= save.wheelAt),
      );
    }
    this.ticking.forEach((f) => f());
    // countdown buttons (gift, wheel) tick too
    this.refreshers.forEach((f) => f());
  }
}

export const freeGiftReady = () => Date.now() >= save.freeGiftAt;

/** The Premium Egg: a glossy blue egg with a glowing swirl and a wizard hat with a moon. */
function premiumEggTexture(scene: Phaser.Scene): string {
  return canvasTexture(scene, "premium_egg", 260, 320, (c) => {
    c.lineJoin = "round";
    c.beginPath();
    c.ellipse(130, 200, 100, 118, 0, 0, Math.PI * 2);
    const g = c.createLinearGradient(40, 90, 220, 310);
    g.addColorStop(0, "#5ad8ff");
    g.addColorStop(0.5, "#3a4ad8");
    g.addColorStop(1, "#1a1a6a");
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 9;
    c.strokeStyle = "#111111";
    c.stroke();
    // the glowing swirl
    c.strokeStyle = "#7affd0";
    c.lineWidth = 12;
    c.lineCap = "round";
    c.beginPath();
    c.arc(130, 210, 40, Math.PI * 0.2, Math.PI * 1.7);
    c.stroke();
    c.beginPath();
    c.arc(130, 210, 14, Math.PI * 1.2, Math.PI * 2.4);
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.45)";
    c.beginPath();
    c.ellipse(90, 150, 22, 36, -0.5, 0, Math.PI * 2);
    c.fill();
    // the wizard hat
    c.fillStyle = "#7a3ad8";
    c.strokeStyle = "#111111";
    c.lineWidth = 8;
    c.beginPath();
    c.ellipse(130, 104, 110, 26, -0.1, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(60, 100);
    c.quadraticCurveTo(120, 20, 210, 8);
    c.quadraticCurveTo(170, 50, 196, 96);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = "#ffd23f";
    c.beginPath();
    c.arc(140, 64, 20, 0.6, Math.PI * 1.6);
    c.arc(150, 58, 15, Math.PI * 1.5, 0.7, true);
    c.closePath();
    c.fill();
    c.lineWidth = 4;
    c.stroke();
  });
}
