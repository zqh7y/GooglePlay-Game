import { MAX_STAGE } from "../data/balance";
import { ITEMS, MAX_LEVEL, PET_LIST, copiesFor } from "../data/items";

export interface PetState {
  level: number;
  /** spare copies, spent to level up */
  copies: number;
}

export interface SaveData {
  cash: number;
  gems: number;
  /** pets you own: id -> level and spare copies */
  pets: Record<string, PetState>;
  /** pet ids fighting next to the hero */
  equipped: string[];
  /** pet ids in the order they were found */
  discovered: string[];
  stage: number;
  wave: number;
  bestStage: number;
  /** upgrade tree: node id -> 1 when bought */
  tree: Record<string, number>;
  autoRoll: boolean;
  potionUntil: number;
  totalRolls: number;
  /** rolls since the last lucky roll */
  luckyCount: number;
  /** rarest "1 in N" ever rolled */
  bestRoll: number;
  lastSeen: number;
  cashPerSec: number;
  /** hero walks to monsters by itself */
  autoHunt: boolean;
  quests: { type: import("./goals").QuestType; target: number; progress: number }[];
  questTier: number;
  questsDone: number;
  /** date string of the last daily reward claimed */
  dailyLast: string;
  dailyStreak: number;
  /** collection milestones already rewarded */
  indexMilestones: number;
  /** highest region whose "new land" cutscene was shown */
  regionShown: number;
  /** treasure chest id -> time it can be opened again */
  chests: Record<string, number>;
  totalKills: number;
  /** when the shop's free gift can be claimed again */
  freeGiftAt: number;
  /** speed potion: rolls are twice as fast until this time */
  speedUntil: number;
  /** lucky dice bought in the shop: this many upcoming rolls are lucky rolls */
  luckyBoost: number;
}

const STORAGE_KEY = "dice-idle-save-v3";
const STARTER = PET_LIST[0].id;

function fresh(): SaveData {
  return {
    cash: 0,
    gems: 10,
    pets: { [STARTER]: { level: 1, copies: 0 } },
    equipped: [STARTER],
    discovered: [STARTER],
    stage: 1,
    wave: 1,
    bestStage: 1,
    tree: {},
    autoRoll: false,
    potionUntil: 0,
    totalRolls: 0,
    luckyCount: 0,
    bestRoll: 2,
    lastSeen: Date.now(),
    cashPerSec: 0,
    autoHunt: true,
    quests: [],
    questTier: 0,
    questsDone: 0,
    dailyLast: "",
    dailyStreak: 0,
    indexMilestones: 0,
    regionShown: 0,
    chests: {},
    totalKills: 0,
    freeGiftAt: 0,
    speedUntil: 0,
    luckyBoost: 0,
  };
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = { ...fresh(), ...JSON.parse(raw) } as SaveData;
      // drop anything that no longer exists
      for (const id of Object.keys(data.pets)) if (!ITEMS[id]) delete data.pets[id];
      data.equipped = data.equipped.filter((id) => data.pets[id]);
      data.discovered = data.discovered.filter((id) => ITEMS[id]);
      data.stage = Math.min(data.stage, MAX_STAGE);
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

/** Add a rolled pet: the first copy unlocks it, later ones are spare copies for levelling. */
export function addPet(id: string): void {
  const p = save.pets[id];
  if (p) p.copies++;
  else save.pets[id] = { level: 1, copies: 0 };
}

export const petLevel = (id: string) => save.pets[id]?.level ?? 0;
export const canLevelUp = (id: string) => {
  const p = save.pets[id];
  return !!p && p.level < MAX_LEVEL && p.copies >= copiesFor(p.level);
};

/** Spend copies on one level. Returns true if it levelled up. */
export function levelUp(id: string): boolean {
  if (!canLevelUp(id)) return false;
  const p = save.pets[id];
  p.copies -= copiesFor(p.level);
  p.level++;
  return true;
}

export function toggleEquip(id: string, maxSlots: number): void {
  if (save.equipped.includes(id)) {
    save.equipped = save.equipped.filter((k) => k !== id);
  } else if (save.equipped.length < maxSlots) {
    save.equipped.push(id);
  }
  persist();
}

export function resetSave(): void {
  Object.assign(save, fresh());
  persist();
}
