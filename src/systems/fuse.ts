import { ItemDef, PET_LIST } from "../data/items";
import { DICE_TIERS, Tier } from "../data/tiers";
import { addPet, persist, save } from "./save";

/**
 * Fusing: 100 spare copies of one class's pets become 1 random pet of the next class (the common
 * ones of that class come more often, like in a roll). Only spare copies are used: you never lose
 * a pet you own. Exclusive pets can't be fused, and uSSS is the top.
 */
export const FUSE_COST = 100;
export const FUSE_CLASSES: Tier[] = DICE_TIERS.slice(0, -1);
export const nextClass = (cls: Tier): Tier => DICE_TIERS[DICE_TIERS.indexOf(cls) + 1];

/** Spare copies of a class's pets you have. */
export function spareCopies(cls: Tier): number {
  return PET_LIST.reduce((n, p) => n + (p.cls === cls ? (save.pets[p.id]?.copies ?? 0) : 0), 0);
}

/** Can any class be fused right now? */
export const canFuse = () => FUSE_CLASSES.some((c) => spareCopies(c) >= FUSE_COST);

/** Fuse once: takes 100 spare copies of `cls` (from the pets with the most first). */
export function fuse(cls: Tier): ItemDef | null {
  if (spareCopies(cls) < FUSE_COST) return null;
  let left = FUSE_COST;
  const mine = PET_LIST.filter((p) => p.cls === cls && save.pets[p.id]?.copies).sort((a, b) => save.pets[b.id].copies - save.pets[a.id].copies);
  for (const p of mine) {
    const take = Math.min(left, save.pets[p.id].copies);
    save.pets[p.id].copies -= take;
    left -= take;
    if (!left) break;
  }
  // a pet of the next class, weighted by its odds
  const pool = PET_LIST.filter((p) => p.cls === nextClass(cls));
  const total = pool.reduce((t, p) => t + 1 / p.oneIn, 0);
  let r = Math.random() * total;
  const pick = pool.find((p) => (r -= 1 / p.oneIn) <= 0) ?? pool[0];
  addPet(pick.id);
  if (!save.discovered.includes(pick.id)) {
    save.discovered.push(pick.id);
    save.newPets.push(pick.id);
  }
  persist();
  return pick;
}
