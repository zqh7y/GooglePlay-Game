import { FUSE_COST, ItemKey, makeKey, nextVariant, parseKey } from "../data/items";
import type { UpgradeId } from "../data/upgrades";

export interface SaveData {
  coins: number;
  /** item key -> how many you own */
  inventory: Record<ItemKey, number>;
  /** up to MAX_EQUIPPED pets fighting next to the cat */
  equipped: ItemKey[];
  /** rolls since the last Legendary+ */
  pity: number;
  totalRolls: number;
  /** item ids ever obtained (for the NEW! tag) */
  discovered: string[];
  stage: number;
  wave: number;
  bestStage: number;
  upgrades: Record<UpgradeId, number>;
  /** for offline earnings */
  lastSeen: number;
  coinsPerSec: number;
}

export const MAX_EQUIPPED = 4;
const STORAGE_KEY = "dice-idle-save-v1";

function fresh(): SaveData {
  return {
    coins: 300,
    inventory: { [makeKey("pebble", "normal")]: 1 },
    equipped: [makeKey("pebble", "normal")],
    pity: 0,
    totalRolls: 0,
    discovered: ["pebble"],
    stage: 1,
    wave: 1,
    bestStage: 1,
    upgrades: { power: 0, fireRate: 0, health: 0, luck: 0 },
    lastSeen: Date.now(),
    coinsPerSec: 0,
  };
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return { ...fresh(), ...data, upgrades: { ...fresh().upgrades, ...data.upgrades } };
    }
  } catch {
    // storage unavailable (private mode etc.) — play without saving
  }
  return fresh();
}

export const save: SaveData = load();
/** When the player was last playing (before this session), for offline earnings. */
export const lastSeenAtLoad = save.lastSeen;

export function persist(): void {
  save.lastSeen = Date.now();
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
