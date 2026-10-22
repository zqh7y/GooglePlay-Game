import { DiceDef, DiceEntry, PITY_ROLLS } from "../data/dice";
import { ITEMS, ItemDef, makeKey } from "../data/items";
import { rarityRank } from "../data/rarity";
import { addItem, persist, save } from "./save";

const RARE = rarityRank("rare");
const LEGENDARY = rarityRank("legendary");

/** Luck multiplies the weight of Rare and better entries. */
function luckyPool(die: DiceDef, luck: number): DiceEntry[] {
  return die.pool.map((e) => ({
    itemId: e.itemId,
    weight: rarityRank(ITEMS[e.itemId].rarity) >= RARE ? e.weight * luck : e.weight,
  }));
}

function pickWeighted(pool: DiceEntry[]): DiceEntry {
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r < 0) return e;
  }
  return pool[pool.length - 1];
}

export interface RollResult {
  item: ItemDef;
  /** "1 in N" chance of this result with the luck used */
  oneIn: number;
  /** true when this roll was forced by the pity counter */
  pity: boolean;
  /** first time the player has ever owned this item */
  isNew: boolean;
}

/** Roll one die: pays nothing (caller pays), adds the pet to the inventory. */
export function rollDie(die: DiceDef, luck: number): RollResult {
  save.pity++;
  save.totalRolls++;

  let pool = luckyPool(die, luck);
  const pity = save.pity >= PITY_ROLLS;
  if (pity) {
    pool = pool.filter((e) => rarityRank(ITEMS[e.itemId].rarity) >= LEGENDARY);
  }

  const item = ITEMS[pickWeighted(pool).itemId];
  if (rarityRank(item.rarity) >= LEGENDARY) save.pity = 0;

  const isNew = !save.discovered.includes(item.id);
  if (isNew) save.discovered.push(item.id);
  addItem(makeKey(item.id, "normal"));
  persist();
  return { item, oneIn: oneIn(die, item.id, luck), pity, isNew };
}

export function oneIn(die: DiceDef, itemId: string, luck: number): number {
  const pool = luckyPool(die, luck);
  const total = pool.reduce((s, e) => s + e.weight, 0);
  const entry = pool.find((e) => e.itemId === itemId);
  return entry ? Math.max(1, Math.round(total / entry.weight)) : 0;
}

/** Odds of each entry, for the odds popup. */
export function oddsOf(die: DiceDef, luck: number): { item: ItemDef; percent: string }[] {
  const pool = luckyPool(die, luck);
  const total = pool.reduce((s, e) => s + e.weight, 0);
  return pool.map((e) => {
    const p = (e.weight / total) * 100;
    const percent = p >= 1 ? p.toFixed(1) + "%" : p >= 0.1 ? p.toFixed(2) + "%" : `1 in ${Math.round(total / e.weight).toLocaleString()}`;
    return { item: ITEMS[e.itemId], percent };
  });
}
