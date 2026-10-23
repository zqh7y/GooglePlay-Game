import { FUSE_COST, ItemKey, PET_LIST, makeKey, nextVariant, parseKey } from "../data/items";

export interface SaveData {
  cash: number;
  gems: number;
  /** item key -> how many you own */
  inventory: Record<ItemKey, number>;
  /** pets fighting next to the cat */
  equipped: ItemKey[];
  /** pet ids ever obtained */
  discovered: string[];
  stage: number;
  wave: number;
  bestStage: number;
  /** upgrade tree node id -> level */
  tree: Record<string, number>;
  autoRoll: boolean;
  potionUntil: number;
  totalRolls: number;
  /** rarest "1 in N" ever rolled */
  bestRoll: number;
  lastSeen: number;
  cashPerSec: number;
}

const STORAGE_KEY = "dice-idle-save-v2";
const STARTER = PET_LIST[0].id;

function fresh(): SaveData {
  return {
    cash: 0,
    gems: 10,
    inventory: { [makeKey(STARTER, "normal")]: 1 },
    equipped: [makeKey(STARTER, "normal")],
    discovered: [STARTER],
    stage: 1,
    wave: 1,
    bestStage: 1,
    tree: {},
    autoRoll: false,
    potionUntil: 0,
    totalRolls: 0,
    bestRoll: 2,
    lastSeen: Date.now(),
    cashPerSec: 0,
  };
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = { ...fresh(), ...JSON.parse(raw) } as SaveData;
      // drop anything that no longer exists
      for (const key of Object.keys(data.inventory)) if (!parseKey(key).def) delete data.inventory[key];
      data.equipped = data.equipped.filter((k) => data.inventory[k]);
      return data;
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
  if (wasEquipped && !save.equipped.includes(key) && !save.equipped.includes(newKey)) save.equipped.push(newKey);
  persist();
  return newKey;
}

export function toggleEquip(key: ItemKey, maxSlots: number): void {
  if (save.equipped.includes(key)) {
    save.equipped = save.equipped.filter((k) => k !== key);
  } else if (save.equipped.length < maxSlots) {
    save.equipped.push(key);
  }
  persist();
}

export function resetSave(): void {
  Object.assign(save, fresh());
  persist();
}
