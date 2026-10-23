import { PET_ROWS, Species } from "./pets";
import { RARITY_ORDER, Rarity } from "./rarity";
import { DICE_TIERS, Tier } from "./tiers";

/**
 * How a pet attacks:
 * - shot:   fires at the closest enemy
 * - pierce: a beam through everything in a line
 * - splash: an explosion that damages an area
 * - zap:    lightning on random enemies
 * - buff:   no attack, boosts the whole team's damage by `damage`%
 */
export type PetKind = "shot" | "pierce" | "splash" | "zap" | "buff";

export interface ItemDef {
  id: string;
  index: number;
  name: string;
  /** base chance: 1 in this many rolls (before luck) */
  oneIn: number;
  rarity: Rarity;
  /** class A (easy) to uSSS (the hardest few), shown as a coloured, animated badge */
  cls: Tier;
  species: Species;
  color: string;
  /** secondary colour: belly, shell, inner ears ("" = automatic) */
  accent: string;
  accs: string[];
  pattern: string;
  eyes: string;
  kind: PetKind;
  /** attack colour */
  fx: number;
  /** damage per attack at level 1 (buff pets: % team damage) */
  damage: number;
  /** milliseconds between attacks */
  cooldown: number;
  /** targets per attack */
  count: number;
  description: string;
}

const NICE = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5];

/** Rounds to a "nice" number: integers below 20, steps of 5 below 100, then 1/1.2/1.5/2/2.5/3/4/5/6/7.5 x 10^n. */
function niceSteps(v: number): number[] {
  if (v < 20) return [Math.max(2, Math.round(v))];
  if (v < 100) return [Math.round(v / 5) * 5];
  const e = Math.floor(Math.log10(v));
  return NICE.map((m) => m * 10 ** e).concat(10 ** (e + 1));
}

function nextNice(after: number): number {
  if (after < 19) return after + 1;
  if (after < 95) return Math.ceil((after + 1) / 5) * 5;
  const e = Math.floor(Math.log10(after));
  const steps = NICE.map((m) => m * 10 ** e).concat(10 ** (e + 1), 1.2 * 10 ** (e + 1));
  return steps.find((s) => s > after * 1.0001)!;
}

/** 1 in 2 for the first pet, rising along a curve to 1 in 500Sp for the last. */
function oddsCurve(count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    if (i === count - 1) {
      out.push(5e26);
      continue;
    }
    const v = 2 * 10 ** (26.4 * (i / (count - 1)) ** 1.6);
    const steps = niceSteps(v);
    let n = steps.reduce((best, s) => (Math.abs(Math.log(s / v)) < Math.abs(Math.log(best / v)) ? s : best), steps[0]);
    const prev = out[i - 1] ?? 1;
    if (n <= prev) n = nextNice(prev);
    out.push(n);
  }
  return out;
}

function kindFor(accs: string[], pattern: string): PetKind {
  const has = (...a: string[]) => a.some((x) => accs.includes(x) || pattern === x);
  if (has("halo", "wings", "flower")) return "buff";
  if (has("flame", "cracks")) return "splash";
  if (has("bolt")) return "zap";
  if (has("crystal", "frost", "galaxy", "moon", "star")) return "pierce";
  return "shot";
}

const FX: Record<PetKind, number> = { shot: 0xfff2a0, pierce: 0x9ff3ff, splash: 0xffa23a, zap: 0xffe14d, buff: 0xffd86b };

const DESCRIPTION: Record<PetKind, string> = {
  shot: "Runs after monsters and pelts them with orbs.",
  pierce: "Throws spinning stars that fly through several monsters.",
  splash: "Lobs bombs that blow up a whole group.",
  zap: "Pounces on monsters and bites hard.",
  buff: "Cheers the team on: boosts all damage.",
};

/** Pet damage grows with rarity: base x (1-in-N odds) ^ power. */
export const PET_DMG_BASE = 6;
export const PET_DMG_POWER = 0.55;

const ODDS = oddsCurve(PET_ROWS.length);

/** How many pets each class holds, A to uSSS: fewer and fewer up to the 5 uSSS pets. */
export const CLASS_SIZES = [18, 16, 15, 14, 12, 11, 9, 5];
function classFor(index: number): Tier {
  let end = 0;
  for (let i = 0; i < CLASS_SIZES.length; i++) {
    end += CLASS_SIZES[i];
    if (index < end) return DICE_TIERS[i];
  }
  return DICE_TIERS[DICE_TIERS.length - 1];
}

export const PET_LIST: ItemDef[] = PET_ROWS.map(([name, species, color, accent, accs, pattern, eyes], index) => {
  const accList = accs ? accs.split(",") : [];
  const tier = Math.floor(index / 10);
  // very rare angels attack with holy lightning instead of only cheering
  const kind = kindFor(accList, pattern) === "buff" && tier >= 6 ? "zap" : kindFor(accList, pattern);
  const base = PET_DMG_BASE * ODDS[index] ** PET_DMG_POWER;
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    index,
    name,
    oneIn: ODDS[index],
    rarity: RARITY_ORDER[Math.min(tier, RARITY_ORDER.length - 1)],
    cls: classFor(index),
    species,
    color,
    accent,
    accs: accList,
    pattern,
    eyes,
    kind,
    fx: FX[kind],
    damage: kind === "buff" ? 8 + tier * 6 : Math.round(base * (kind === "splash" ? 0.8 : kind === "shot" ? 1 : 0.9)),
    cooldown: { shot: 1000, pierce: 1500, splash: 1600, zap: 1400, buff: 0 }[kind],
    count: 1 + Math.floor(tier / 3),
    description: DESCRIPTION[kind],
  };
});

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(PET_LIST.map((p) => [p.id, p]));

// ───────────────────────── pet levels ─────────────────────────

/** Duplicates level a pet up (no golden/rainbow versions). */
export const MAX_LEVEL = 30;
/** Copies needed to go from `level` to `level + 1`. */
export const copiesFor = (level: number) => 2 + level;
/** Damage multiplier at a level: +15% per level. */
export const levelMult = (level: number) => 1 + 0.15 * (level - 1);
