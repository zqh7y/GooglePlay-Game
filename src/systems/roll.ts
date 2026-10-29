import { petChances, stageLuck } from "../data/luck";
import { ItemDef } from "../data/items";
import { rollPet } from "../data/luck";
import { addPet, persist, save } from "./save";

export interface RollResult {
  item: ItemDef;
  isNew: boolean;
  /** how rare it was for you, with your luck right now: 1 in this many */
  youOneIn: number;
}

/** Roll `n` pets with the same luck and add them to your collection. */
export function rollMany(n: number, rawLuck: number): RollResult[] {
  const luck = stageLuck(rawLuck, save.bestStage);
  const results: RollResult[] = [];
  const chances = petChances(luck);
  for (let i = 0; i < n; i++) {
    const item = rollPet(luck);
    const isNew = !save.discovered.includes(item.id);
    if (isNew) {
      save.discovered.push(item.id);
      save.newPets.push(item.id);
    }
    addPet(item.id);
    save.bestRoll = Math.max(save.bestRoll, item.oneIn);
    results.push({ item, isNew, youOneIn: 1 / Math.max(1e-300, chances[item.index]) });
  }
  persist();
  return results;
}
