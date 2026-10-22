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
  pips: number;
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
    pips: 0x3b2414,
    pool: [
      { itemId: "pebble", weight: 3500 },
      { itemId: "twig", weight: 3500 },
      { itemId: "ember", weight: 1200 },
      { itemId: "stoneNova", weight: 1200 },
      { itemId: "spark", weight: 300 },
      { itemId: "iceDarts", weight: 250 },
      { itemId: "flameRing", weight: 40 },
      { itemId: "thunderCrown", weight: 9 },
      { itemId: "voidNova", weight: 1 },
    ],
  },
  {
    id: "crystal",
    name: "Crystal Die",
    cost: 400,
    color: 0x7dd3fc,
    pips: 0x1e3a8a,
    pool: [
      { itemId: "ember", weight: 3000 },
      { itemId: "stoneNova", weight: 3000 },
      { itemId: "spark", weight: 1800 },
      { itemId: "iceDarts", weight: 1500 },
      { itemId: "flameRing", weight: 500 },
      { itemId: "thunderCrown", weight: 150 },
      { itemId: "voidNova", weight: 45 },
      { itemId: "catCannon", weight: 5 },
    ],
  },
];

/** Every this many rolls without a Legendary or better, the next roll is guaranteed Legendary+. */
export const PITY_ROLLS = 100;
