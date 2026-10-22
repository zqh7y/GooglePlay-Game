import type { Rarity } from "./rarity";

/** How a weapon behaves during a run. */
export type WeaponKind = "bolt" | "orbit" | "aura" | "nova" | "lightning";

export interface ItemDef {
  id: string;
  name: string;
  rarity: Rarity;
  kind: WeaponKind;
  color: number;
  damage: number;
  /** milliseconds between attacks (aura: between damage ticks) */
  cooldown: number;
  /** projectiles / blades / strikes per attack */
  count: number;
  /** projectile speed, orbit radius or aura radius depending on kind */
  range: number;
  pierce?: number;
  description: string;
}

/**
 * All weapons that can come out of dice.
 * To add a new weapon: add an entry here, then add it to a die in dice.ts.
 */
export const ITEMS: Record<string, ItemDef> = {
  pebble: {
    id: "pebble", name: "Pebble Shooter", rarity: "common", kind: "bolt", color: 0xd6d3d1,
    damage: 20, cooldown: 600, count: 1, range: 560, pierce: 1,
    description: "Shoots a pebble at the nearest enemy.",
  },
  twig: {
    id: "twig", name: "Twig Spinner", rarity: "common", kind: "orbit", color: 0xa16207,
    damage: 8, cooldown: 0, count: 2, range: 90,
    description: "Sticks spin around you.",
  },
  ember: {
    id: "ember", name: "Ember Aura", rarity: "uncommon", kind: "aura", color: 0xfb923c,
    damage: 6, cooldown: 500, count: 1, range: 110,
    description: "Burns enemies close to you.",
  },
  stoneNova: {
    id: "stoneNova", name: "Stone Nova", rarity: "uncommon", kind: "nova", color: 0x94a3b8,
    damage: 14, cooldown: 2200, count: 8, range: 380, pierce: 2,
    description: "Bursts rocks in every direction.",
  },
  spark: {
    id: "spark", name: "Spark Rod", rarity: "rare", kind: "lightning", color: 0x93c5fd,
    damage: 30, cooldown: 1500, count: 2, range: 450,
    description: "Zaps random nearby enemies.",
  },
  iceDarts: {
    id: "iceDarts", name: "Ice Darts", rarity: "rare", kind: "bolt", color: 0x67e8f9,
    damage: 14, cooldown: 450, count: 2, range: 700, pierce: 2,
    description: "Fast piercing darts.",
  },
  flameRing: {
    id: "flameRing", name: "Flame Ring", rarity: "epic", kind: "orbit", color: 0xef4444,
    damage: 22, cooldown: 0, count: 4, range: 120,
    description: "A ring of fire orbits you.",
  },
  thunderCrown: {
    id: "thunderCrown", name: "Thunder Crown", rarity: "legendary", kind: "lightning", color: 0xfde047,
    damage: 60, cooldown: 1100, count: 5, range: 600,
    description: "Calls down a storm of lightning.",
  },
  voidNova: {
    id: "voidNova", name: "Void Nova", rarity: "mythical", kind: "nova", color: 0xa855f7,
    damage: 55, cooldown: 1300, count: 20, range: 600, pierce: 6,
    description: "Tears space apart around you.",
  },
  catCannon: {
    id: "catCannon", name: "Golden Cat Cannon", rarity: "secret", kind: "bolt", color: 0xffd700,
    damage: 250, cooldown: 350, count: 3, range: 900, pierce: 99,
    description: "Meow. Deletes everything.",
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
