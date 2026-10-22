export interface DiceEntry {
  itemId: string;
  /** relative chance — odds are weight / total weight */
  weight: number;
}

export interface DiceDef {
  id: string;
  name: string;
  cost: number;
  color: number;
  pool: DiceEntry[];
}

/**
 * Dice types (like eggs in Pet Simulator X).
 * Weights add up to 10,000 so 1 weight = 0.01%.
 */
export const DICE: DiceDef[] = [
  {
    id: "wooden",
    name: "Wooden Die",
    cost: 50,
    color: 0xc08552,
    pool: [
      { itemId: "pebble", weight: 3500 },
      { itemId: "leaf", weight: 3500 },
      { itemId: "ember", weight: 1200 },
      { itemId: "bubble", weight: 1200 },
      { itemId: "spark", weight: 300 },
      { itemId: "frost", weight: 250 },
      { itemId: "lava", weight: 40 },
      { itemId: "thunderCat", weight: 9 },
      { itemId: "voidSlime", weight: 1 },
    ],
  },
  {
    id: "crystal",
    name: "Crystal Die",
    cost: 400,
    color: 0x7dd3fc,
    pool: [
      { itemId: "ember", weight: 3000 },
      { itemId: "bubble", weight: 3000 },
      { itemId: "spark", weight: 1800 },
      { itemId: "frost", weight: 1500 },
      { itemId: "lava", weight: 500 },
      { itemId: "thunderCat", weight: 150 },
      { itemId: "voidSlime", weight: 45 },
      { itemId: "goldenCat", weight: 5 },
    ],
  },
];

/** Every this many rolls without a Legendary or better, the next roll is guaranteed Legendary+. */
export const PITY_ROLLS = 100;
