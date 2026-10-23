import { ItemDef } from "../data/items";
import { rollPet } from "../data/luck";
import { addPet, persist, save } from "./save";

export interface RollResult {
  item: ItemDef;
  isNew: boolean;
}

/** Roll `n` pets with the same luck and add them to your collection. */
export function rollMany(n: number, luck: number): RollResult[] {
  const results: RollResult[] = [];
  for (let i = 0; i < n; i++) {
    const item = rollPet(luck);
    const isNew = !save.discovered.includes(item.id);
    if (isNew) {
      save.discovered.push(item.id);
      save.newPets.push(item.id);
    }
    addPet(item.id);
    save.bestRoll = Math.max(save.bestRoll, item.oneIn);
    results.push({ item, isNew });
  }
  persist();
  return results;
}
