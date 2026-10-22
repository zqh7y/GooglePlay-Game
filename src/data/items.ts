import type { Rarity } from "./rarity";

/**
 * How a pet attacks:
 * - shot:   fires at the closest enemy
 * - pierce: a beam that hits every enemy in its lane
 * - splash: lobs a blob that damages an area
 * - zap:    lightning on random enemies
 * - buff:   no attack, boosts all damage by `damage`%
 */
export type PetKind = "shot" | "pierce" | "splash" | "zap" | "buff";

export interface ItemDef {
  id: string;
  name: string;
  rarity: Rarity;
  kind: PetKind;
  sprite: "pet_slime" | "pet_cat";
  color: number;
  damage: number;
  /** milliseconds between attacks */
  cooldown: number;
  /** targets per attack */
  count: number;
  description: string;
}

/**
 * Every pet that can be rolled.
 * To add a new pet: add an entry here, then add it to a die in dice.ts.
 */
export const ITEMS: Record<string, ItemDef> = {
  pebble: {
    id: "pebble", name: "Pebble Slime", rarity: "common", kind: "shot", sprite: "pet_slime", color: 0xa8a29e,
    damage: 6, cooldown: 1200, count: 1, description: "Spits little rocks.",
  },
  leaf: {
    id: "leaf", name: "Leaf Slime", rarity: "common", kind: "shot", sprite: "pet_slime", color: 0x84cc16,
    damage: 4, cooldown: 700, count: 1, description: "Fast leaf shots.",
  },
  ember: {
    id: "ember", name: "Ember Slime", rarity: "uncommon", kind: "splash", sprite: "pet_slime", color: 0xfb923c,
    damage: 10, cooldown: 1800, count: 1, description: "Lobs fireballs that hit an area.",
  },
  bubble: {
    id: "bubble", name: "Bubble Cat", rarity: "uncommon", kind: "buff", sprite: "pet_cat", color: 0x7dd3fc,
    damage: 20, cooldown: 0, count: 0, description: "Cheers the team on.",
  },
  spark: {
    id: "spark", name: "Spark Slime", rarity: "rare", kind: "zap", sprite: "pet_slime", color: 0xfacc15,
    damage: 25, cooldown: 1600, count: 2, description: "Zaps random enemies.",
  },
  frost: {
    id: "frost", name: "Frost Slime", rarity: "rare", kind: "pierce", sprite: "pet_slime", color: 0x67e8f9,
    damage: 18, cooldown: 1500, count: 1, description: "Ice beam through a whole lane.",
  },
  lava: {
    id: "lava", name: "Lava Slime", rarity: "epic", kind: "splash", sprite: "pet_slime", color: 0xef4444,
    damage: 45, cooldown: 1500, count: 2, description: "Rains lava on the horde.",
  },
  thunderCat: {
    id: "thunderCat", name: "Thunder Cat", rarity: "legendary", kind: "zap", sprite: "pet_cat", color: 0xfde047,
    damage: 90, cooldown: 1200, count: 4, description: "Calls down a lightning storm.",
  },
  voidSlime: {
    id: "voidSlime", name: "Void Slime", rarity: "mythical", kind: "pierce", sprite: "pet_slime", color: 0xa855f7,
    damage: 220, cooldown: 1000, count: 2, description: "Tears holes in reality.",
  },
  goldenCat: {
    id: "goldenCat", name: "Golden Cat", rarity: "secret", kind: "shot", sprite: "pet_cat", color: 0xffd700,
    damage: 800, cooldown: 400, count: 2, description: "Meow. Deletes everything.",
  },
};

export type Variant = "normal" | "golden" | "rainbow";

export const VARIANT_INFO: Record<Variant, { label: string; mult: number }> = {
  normal: { label: "", mult: 1 },
  golden: { label: "Golden ", mult: 2.5 },
  rainbow: { label: "Rainbow ", mult: 6 },
};

/** How many copies fuse into the next variant. */
export const FUSE_COST = 5;

export function nextVariant(v: Variant): Variant | null {
  return v === "normal" ? "golden" : v === "golden" ? "rainbow" : null;
}

/** Inventory key, e.g. "pebble:golden". */
export type ItemKey = string;
export const makeKey = (id: string, v: Variant): ItemKey => `${id}:${v}`;
export function parseKey(key: ItemKey): { def: ItemDef; variant: Variant } {
  const [id, v] = key.split(":");
  return { def: ITEMS[id], variant: v as Variant };
}
