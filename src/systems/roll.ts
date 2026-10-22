import { DiceDef, DiceEntry, PITY_ROLLS } from "../data/dice";
import { ITEMS, ItemDef, makeKey } from "../data/items";
import { rarityRank } from "../data/rarity";
import { addItem, persist, save } from "./save";

const LEGENDARY = rarityRank("legendary");

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
  /** true when this roll was forced by the pity counter */
  pity: boolean;
  /** first time the player has ever owned this item */
  isNew: boolean;
}

/** Roll one die: pays nothing (caller pays), adds the item to the inventory. */
export function rollDie(die: DiceDef): RollResult {
  save.pity++;
  save.totalRolls++;

  let pool = die.pool;
  const pity = save.pity >= PITY_ROLLS;
  if (pity) {
    pool = die.pool.filter((e) => rarityRank(ITEMS[e.itemId].rarity) >= LEGENDARY);
  }

  const item = ITEMS[pickWeighted(pool).itemId];
  if (rarityRank(item.rarity) >= LEGENDARY) save.pity = 0;

  const key = makeKey(item.id, "normal");
  const isNew = !save.discovered.includes(item.id);
  if (isNew) save.discovered.push(item.id);
  addItem(key);
  persist();
  return { item, pity, isNew };
}

/** Odds of each entry as a percentage string, for the odds popup. */
export function oddsOf(die: DiceDef): { item: ItemDef; percent: string }[] {
  const total = die.pool.reduce((s, e) => s + e.weight, 0);
  return die.pool.map((e) => {
    const p = (e.weight / total) * 100;
    const percent = p >= 1 ? p.toFixed(1) + "%" : p >= 0.1 ? p.toFixed(2) + "%" : `1 in ${Math.round(total / e.weight).toLocaleString()}`;
    return { item: ITEMS[e.itemId], percent };
  });
}
