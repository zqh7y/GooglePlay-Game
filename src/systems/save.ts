import { FUSE_COST, ItemKey, makeKey, nextVariant, parseKey } from "../data/items";

export interface SaveData {
  coins: number;
  /** item key -> how many you own */
  inventory: Record<ItemKey, number>;
  /** up to MAX_EQUIPPED item keys used in runs */
  equipped: ItemKey[];
  /** rolls since the last Legendary+ */
  pity: number;
  totalRolls: number;
  bestTime: number;
  /** item ids ever obtained (for the collection / NEW! tag) */
  discovered: string[];
}

export const MAX_EQUIPPED = 4;
const STORAGE_KEY = "dice-survivor-save-v1";

function fresh(): SaveData {
  return {
    coins: 300,
    inventory: { [makeKey("pebble", "normal")]: 1 },
    equipped: [makeKey("pebble", "normal")],
    pity: 0,
    totalRolls: 0,
    bestTime: 0,
    discovered: ["pebble"],
  };
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    // storage unavailable (private mode etc.) — play without saving
  }
  return fresh();
}

export const save: SaveData = load();

export function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // ignore
  }
}

export function addItem(key: ItemKey, n = 1): void {
  save.inventory[key] = (save.inventory[key] ?? 0) + n;
}

export function removeItem(key: ItemKey, n: number): void {
  const left = (save.inventory[key] ?? 0) - n;
  if (left > 0) {
    save.inventory[key] = left;
  } else {
    delete save.inventory[key];
    save.equipped = save.equipped.filter((k) => k !== key);
  }
}

/** Fuse FUSE_COST copies into one of the next variant. Returns the new key or null. */
export function fuse(key: ItemKey): ItemKey | null {
  const { def, variant } = parseKey(key);
  const next = nextVariant(variant);
  if (!next || (save.inventory[key] ?? 0) < FUSE_COST) return null;
  const wasEquipped = save.equipped.includes(key);
  removeItem(key, FUSE_COST);
  const newKey = makeKey(def.id, next);
  addItem(newKey);
  // keep the slot pointing at something useful
  if (wasEquipped && !save.equipped.includes(key) && !save.equipped.includes(newKey)) {
    save.equipped.push(newKey);
  }
  persist();
  return newKey;
}

export function toggleEquip(key: ItemKey): void {
  if (save.equipped.includes(key)) {
    save.equipped = save.equipped.filter((k) => k !== key);
  } else if (save.equipped.length < MAX_EQUIPPED) {
    save.equipped.push(key);
  }
  persist();
}

export function resetSave(): void {
  Object.assign(save, fresh());
  persist();
}
