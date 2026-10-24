import { Tier } from "./tiers";

/**
 * Fishing: an AFK reward grind. The hero sits on the dock and catches one prize every so often
 * (60 s at first, 5 s at best), even while you fight or are away (until the cooler box is full).
 * Every catch also brings shells, which buy the fishing upgrades.
 *
 * Prizes sit in 5 rows of 4, from junk to legends. Fishing luck (x1 to x30) raises the rare rows:
 * a prize's weight is multiplied by luck^pow, so commons stay common and legends get less impossible.
 */

export type PrizeKind = "shells" | "cash" | "dice" | "gems" | "luckPotion" | "speedPotion" | "lucky" | "boost" | "jackpot";

export interface Prize {
  id: string;
  name: string;
  kind: PrizeKind;
  /**
   * shells, gems, dice, potion minutes or lucky rolls; for money: seconds of your fighting income
   * (jackpot: dice of `tier` plus `gems` gems)
   */
  amount: number;
  tier?: Tier;
  gems?: number;
  /** relative chance at luck x1 (the weights add up to about 100, so about a %) */
  weight: number;
  /** how much fishing luck lifts it: its weight is multiplied by luck^pow */
  pow: number;
  /** 0 (junk) to 4 (legend) */
  row: number;
}

export const PRIZES: Prize[] = [
  // row 0: everyday catches
  { id: "boot", name: "Old Boot", kind: "shells", amount: 4, weight: 34, pow: 0, row: 0 },
  { id: "sardine", name: "Sardine", kind: "cash", amount: 4, weight: 28, pow: 0, row: 0 },
  { id: "dieA", name: "Soggy Die", kind: "dice", amount: 1, tier: "A", weight: 5, pow: 0, row: 0 },
  { id: "pouch", name: "Coin Pouch", kind: "cash", amount: 12, weight: 12, pow: 0, row: 0 },
  // row 1: good catches
  { id: "puffer", name: "Puffer Die", kind: "dice", amount: 1, tier: "B", weight: 3, pow: 0.25, row: 1 },
  { id: "oyster", name: "Pearl Oyster", kind: "gems", amount: 1, weight: 0.6, pow: 0.15, row: 1 },
  { id: "luckPotion", name: "Luck Potion", kind: "luckPotion", amount: 1, weight: 1.4, pow: 0.15, row: 1 },
  { id: "salmon", name: "Fat Salmon", kind: "cash", amount: 25, weight: 3, pow: 0.25, row: 1 },
  // row 2: rare catches (from here down: tiny chances at first that luck lifts a lot)
  { id: "speedPotion", name: "Speed Potion", kind: "speedPotion", amount: 2, weight: 0.42, pow: 0.6, row: 2 },
  { id: "dieC", name: "Coral Die", kind: "dice", amount: 1, tier: "C", weight: 0.3, pow: 0.6, row: 2 },
  { id: "chest", name: "Sunken Chest", kind: "cash", amount: 100, weight: 0.27, pow: 0.6, row: 2 },
  { id: "clover", name: "Sea Clover", kind: "lucky", amount: 3, weight: 0.15, pow: 0.6, row: 2 },
  // row 3: epic catches
  { id: "bottle", name: "Message Bottle", kind: "boost", amount: 1, weight: 0.05, pow: 0.9, row: 3 },
  { id: "swordfish", name: "Swordfish Die", kind: "dice", amount: 1, tier: "D", weight: 0.025, pow: 0.9, row: 3 },
  { id: "koi", name: "Golden Koi", kind: "cash", amount: 600, weight: 0.01, pow: 0.9, row: 3 },
  { id: "crown", name: "Mermaid Crown", kind: "gems", amount: 10, weight: 0.0015, pow: 0.9, row: 3 },
  // row 4: legends (the chances hide behind question marks)
  { id: "dieE", name: "Sun Die", kind: "dice", amount: 1, tier: "E", weight: 0.0008, pow: 1.1, row: 4 },
  { id: "kraken", name: "Kraken Die", kind: "dice", amount: 1, tier: "S", weight: 0.00009, pow: 1.1, row: 4 },
  { id: "trident", name: "Titan Trident", kind: "dice", amount: 1, tier: "SSS", weight: 0.000004, pow: 1.1, row: 4 },
  { id: "leviathan", name: "Leviathan Heart", kind: "jackpot", amount: 1, tier: "uSSS", gems: 100, weight: 0.0000002, pow: 1.1, row: 4 },
];

export const PRIZE_BY_ID: Record<string, Prize> = Object.fromEntries(PRIZES.map((p) => [p.id, p]));

/** Row colors, junk to legend. */
export const ROW_COLORS = [0xb8c2cc, 0x6fd25a, 0x4fa8ff, 0xb36aff, 0xff4fd8];
export const ROW_NAMES = ["Common", "Good", "Rare", "Epic", "Legend"];

/** Shells that come with every catch, by row (then times the Golden Line). */
export const ROW_SHELLS = [1, 2, 5, 15, 60];
/** The first catch of each prize brings this many times its row's shells. */
export const FIRST_CATCH_SHELLS = 25;

// ───────────────────────── upgrades ─────────────────────────

export type FishUpId = "speed" | "luck" | "pond" | "hook" | "gold" | "net" | "super" | "shiny" | "cooler";

export interface FishUpgrade {
  id: FishUpId;
  name: string;
  icon: string;
  max: number;
  /** shell cost of the first level; each level costs `growth` times more */
  cost: number;
  growth: number;
  /** the effect at a level, as shown on the button */
  show: (lv: number) => string;
  desc: string;
}

export const catchSecs = (lv: number) => Math.max(5, 60 * 0.9 ** lv);
export const fishLuck = (lv: number) => 30 ** (lv / 30);
/** Deeper Water: the Rare, Epic and Legend rows bite more often. */
export const deepMult = (lv: number) => 1 + lv / 12;
export const doubleChance = (lv: number) => 0.02 * lv;
export const goldMult = (lv: number) => 1 + 0.1 * lv;
export const netMult = (lv: number) => 1 + 0.05 * lv;
export const superEvery = (lv: number) => 40 - lv;
export const SUPER_LUCK = 10;
export const shinyChance = (lv: number) => 0.0125 * lv;
export const SHINY_MULT = 2;
export const coolerHours = (lv: number) => 2 + lv;

const secs = (s: number) => (s >= 10 ? `${Math.round(s)}s` : `${s.toFixed(1)}s`);
const lk = (l: number) => (l >= 10 ? `x${Math.round(l)}` : `x${l.toFixed(1)}`);

export const FISH_UPGRADES: FishUpgrade[] = [
  { id: "speed", name: "Quick Reel", icon: "fu_speed", max: 24, cost: 4, growth: 1.42, show: (l) => secs(catchSecs(l)), desc: "Catch something sooner" },
  { id: "luck", name: "Lucky Bait", icon: "fu_luck", max: 30, cost: 6, growth: 1.385, show: (l) => lk(fishLuck(l)), desc: "Rare prizes bite more often" },
  { id: "pond", name: "Deeper Water", icon: "fu_pond", max: 12, cost: 25, growth: 2.15, show: (l) => `x${deepMult(l).toFixed(2)}`, desc: "Rare, Epic and Legend prizes bite more often" },
  { id: "hook", name: "Double Hook", icon: "fu_hook", max: 15, cost: 30, growth: 1.5, show: (l) => `${Math.round(doubleChance(l) * 100)}%`, desc: "Chance to catch two prizes at once" },
  { id: "gold", name: "Golden Line", icon: "fu_gold", max: 20, cost: 15, growth: 1.42, show: (l) => `x${goldMult(l).toFixed(1)}`, desc: "More shells from every catch" },
  { id: "net", name: "Big Net", icon: "fu_net", max: 10, cost: 60, growth: 1.7, show: (l) => `x${netMult(l).toFixed(1)}`, desc: "Dice, gems and potions come in bigger bunches" },
  { id: "super", name: "Super Bite", icon: "fu_super", max: 25, cost: 50, growth: 1.35, show: (l) => `every ${superEvery(l)}`, desc: `Every few catches is a SUPER catch with x${SUPER_LUCK} luck` },
  { id: "shiny", name: "Shiny Lure", icon: "fu_shiny", max: 15, cost: 40, growth: 1.48, show: (l) => `${Math.round(shinyChance(l) * 100)}%`, desc: `Chance a catch is shiny: x${SHINY_MULT} the prize` },
  { id: "cooler", name: "Cooler Box", icon: "fu_cooler", max: 22, cost: 10, growth: 1.3, show: (l) => `${coolerHours(l)}h`, desc: "Keep fishing while you are away for longer" },
];

export const FISH_UP_BY_ID = Object.fromEntries(FISH_UPGRADES.map((u) => [u.id, u])) as Record<FishUpId, FishUpgrade>;

export const upgradeCost = (u: FishUpgrade, lv: number) => Math.ceil(u.cost * u.growth ** lv);

// ───────────────────────── catching ─────────────────────────

/** The chance of each prize. Every prize can always bite; luck and Deeper Water lift the rare ones. */
export function prizeChances(luck: number, deep = 1): number[] {
  const w = PRIZES.map((p) => p.weight * luck ** p.pow * (p.row >= 2 ? deep : 1));
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
}

export function rollPrize(luck: number, deep: number, r = Math.random()): number {
  const ch = prizeChances(luck, deep);
  let x = r;
  for (let i = 0; i < ch.length; i++) {
    x -= ch[i];
    if (x < 0) return i;
  }
  return 0;
}

/**
 * A chance as the fishing screen shows it, in %: real numbers down to 0.01%, then ever more
 * question marks, and below 0.00001% nothing but a mystery.
 */
export function chanceLabel(p: number): { text: string; mystery: number } {
  const pct = p * 100;
  if (pct >= 10) return { text: `${pct.toFixed(1)}%`, mystery: 0 };
  if (pct >= 1) return { text: `${pct.toFixed(2)}%`, mystery: 0 };
  if (pct >= 0.01) return { text: `${pct.toPrecision(2)}%`, mystery: 0 };
  if (pct >= 0.001) return { text: "?", mystery: 1 };
  if (pct >= 0.0001) return { text: "??", mystery: 2 };
  if (pct >= 0.00001) return { text: "???", mystery: 3 };
  return { text: "", mystery: 4 };
}

// ───────────────────────── for the simulators ─────────────────────────

export interface Haul {
  shells: number;
  /** seconds of fighting income */
  cashSecs: number;
  dice: Partial<Record<Tier, number>>;
  gems: number;
  potionMin: number;
}

/** What one catch brings on average at some upgrade levels (super catches, double hook and shiny included). */
export function expectedCatch(lv: Record<FishUpId, number>): Haul {
  const luck = fishLuck(lv.luck);
  const every = superEvery(lv.super);
  const deep = deepMult(lv.pond);
  const ch = prizeChances(luck, deep);
  const chS = prizeChances(luck * SUPER_LUCK, deep);
  const mult = (1 + doubleChance(lv.hook)) * (1 + shinyChance(lv.shiny) * (SHINY_MULT - 1));
  const out: Haul = { shells: 0, cashSecs: 0, dice: {}, gems: 0, potionMin: 0 };
  PRIZES.forEach((p, i) => {
    const c = ((ch[i] * (every - 1) + chS[i]) / every) * mult;
    out.shells += c * ROW_SHELLS[p.row] * goldMult(lv.gold);
    if (p.kind === "shells") out.shells += c * p.amount * goldMult(lv.gold);
    if (p.kind === "cash") out.cashSecs += c * p.amount;
    if (p.kind === "dice" || p.kind === "jackpot") out.dice[p.tier!] = (out.dice[p.tier!] ?? 0) + c * p.amount * netMult(lv.net);
    if (p.kind === "gems") out.gems += c * p.amount * netMult(lv.net);
    if (p.kind === "jackpot") out.gems += c * (p.gems ?? 0);
    if (p.kind === "luckPotion") out.potionMin += c * p.amount * netMult(lv.net);
  });
  return out;
}
