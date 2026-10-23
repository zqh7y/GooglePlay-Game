import { ItemDef, PET_LIST, makeKey } from "../data/items";
import { RARITY_ORDER, rarityRank } from "../data/rarity";
import { addItem, persist, save } from "./save";

const RAREST_FIRST = [...PET_LIST].reverse();

/** True with probability p, accurate even for tiny chances like 1 in 500Sp. */
function chance(p: number): boolean {
  if (p >= 1) return true;
  while (p < 1e-9) {
    if (Math.random() >= 1e-9) return false;
    p *= 1e9;
  }
  return Math.random() < p;
}

/**
 * RNG roll in the style of Roblox RNG games: check pets from rarest to most common,
 * each with chance luck / oneIn. Luck higher than a pet's odds guarantees at least that pet.
 */
export function rollPet(luck: number): ItemDef {
  for (const p of RAREST_FIRST) {
    if (p.index === 0) break;
    if (chance(luck / p.oneIn)) return p;
  }
  return PET_LIST[0];
}

export interface RollResult {
  item: ItemDef;
  isNew: boolean;
}

export function rollMany(n: number, luck: number): RollResult[] {
  const results: RollResult[] = [];
  for (let i = 0; i < n; i++) {
    const item = rollPet(luck);
    const isNew = !save.discovered.includes(item.id);
    if (isNew) save.discovered.push(item.id);
    addItem(makeKey(item.id, "normal"));
    save.totalRolls++;
    save.bestRoll = Math.max(save.bestRoll, item.oneIn);
    results.push({ item, isNew });
  }
  persist();
  return results;
}

/** Chance per roll of landing each rarity tier, with the given luck. */
export function tierChances(luck: number): number[] {
  const out = RARITY_ORDER.map(() => 0);
  let remaining = 1;
  for (const p of RAREST_FIRST) {
    if (p.index === 0) break;
    const c = Math.min(1, luck / p.oneIn);
    out[rarityRank(p.rarity)] += remaining * c;
    remaining *= 1 - c;
  }
  out[0] += remaining;
  return out;
}

/** The rarest pet whose odds your luck already beats (you'll never roll worse). */
export function luckFloor(luck: number): ItemDef {
  return RAREST_FIRST.find((p) => p.oneIn <= luck) ?? PET_LIST[0];
}
