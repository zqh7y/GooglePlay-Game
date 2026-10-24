import { BOSS, MAX_STAGE, monsterHp } from "../data/balance";
import { rushBossHp } from "../data/bosses";
import { ITEMS, MAX_LEVEL, PET_LIST, copiesFor } from "../data/items";
import { DICE_TIERS, Tier } from "../data/tiers";

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
  bestStage: number;
  /** dice found in battle, per rarity tier; every roll costs one */
  dice: Record<Tier, number>;
  /** which dice tier the Roll screen uses */
  diceTier: Tier;
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
  /** lucky rolls bought in the shop: this many upcoming rolls are lucky rolls */
  luckyBoost: number;
  /** when the shop's lucky wheel has a free spin again */
  wheelAt: number;
  /** day number of the last bought Deal of the Day */
  dealDay: number;
  /** battle boosts waiting for the next fight: id -> count */
  boosts: Record<string, number>;
  /** rolls since the last SUPER ROLL */
  superCount: number;
  /** rolls since the last roll gift */
  giftCount: number;
  /** pets found but not looked at yet on the Pets screen */
  newPets: string[];
  /** monster mutations already announced */
  mutSeen: string[];
  /** how many dice one press of ROLL uses (each die is one roll) */
  rollBatch: number;
  /** free roam on autopilot: the hero walks to the dice lying around the lobby */
  afk: boolean;
  /** highest Boss Rush boss beaten (the rush starts at your stage: boss n guards stage n) */
  bossRushBest: number;
  fishing: FishingState;
}

export interface FishingState {
  /** fishing upgrade levels */
  lv: Record<string, number>;
  shells: number;
  /** when the next catch comes in */
  nextAt: number;
  catches: number;
  /** catches since the last SUPER catch */
  superCount: number;
  /** prize id -> how many you caught */
  caught: Record<string, number>;
}

export const freshFishing = (): FishingState => ({ lv: {}, shells: 0, nextAt: 0, catches: 0, superCount: 0, caught: {} });

const STORAGE_KEY = "dice-idle-save-v3";
/** Roll 1, 3 or 10 dice at once. */
export const ROLL_BATCHES = [1, 3, 10];
/** Boss Rush boss health share before the rush moved your stage (for older saves). */
const OLD_RUSH_HP = 0.045;
const STARTER = PET_LIST[0].id;

function fresh(): SaveData {
  return {
    cash: 0,
    gems: 10,
    pets: { [STARTER]: { level: 1, copies: 0 } },
    equipped: [STARTER],
    discovered: [STARTER],
    stage: 1,
    bestStage: 1,
    dice: noDice({ A: 10 }),
    diceTier: "A",
    tree: {},
    autoRoll: false,
    potionUntil: 0,
    totalRolls: 0,
    luckyCount: 0,
    bestRoll: 2,
    lastSeen: Date.now(),
    cashPerSec: 0,
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
    wheelAt: 0,
    dealDay: -1,
    boosts: {},
    superCount: 0,
    giftCount: 0,
    newPets: [],
    mutSeen: [],
    rollBatch: 1,
    afk: false,
    bossRushBest: 0,
    fishing: freshFishing(),
  };
}

function noDice(some: Partial<Record<Tier, number>> = {}): Record<Tier, number> {
  return Object.fromEntries(DICE_TIERS.map((t) => [t, some[t] ?? 0])) as Record<Tier, number>;
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = { ...fresh(), ...JSON.parse(raw) } as SaveData & { bossRush?: number };
      // older saves had one plain dice count
      const dice = data.dice as unknown;
      data.dice = noDice(typeof dice === "number" ? { A: dice } : (dice as Partial<Record<Tier, number>>));
      if (!DICE_TIERS.includes(data.diceTier)) data.diceTier = "A";
      if (!ROLL_BATCHES.includes(data.rollBatch)) data.rollBatch = 1;
      // drop anything that no longer exists
      for (const id of Object.keys(data.pets)) if (!ITEMS[id]) delete data.pets[id];
      data.equipped = data.equipped.filter((id) => data.pets[id]);
      data.discovered = data.discovered.filter((id) => ITEMS[id]);
      data.newPets = data.newPets.filter((id) => data.pets[id]);
      data.fishing = { ...freshFishing(), ...data.fishing };
      // the first Boss Rush kept its own place and had weaker bosses. Now its bosses are the stages:
      // move on to the first stage whose boss is tougher than the last one you beat back then
      if (data.bossRush && data.bossRush > 1) {
        const beaten = OLD_RUSH_HP * monsterHp(BOSS.hp, Math.min(MAX_STAGE, data.bossRush - 1), 0);
        let stage = 1;
        while (stage < MAX_STAGE && rushBossHp(stage) <= beaten) stage++;
        data.stage = Math.max(data.stage, stage);
      }
      delete data.bossRush;
      data.stage = Math.min(data.stage, MAX_STAGE);
      data.bestStage = Math.max(data.bestStage, data.stage);
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

export const totalDice = () => DICE_TIERS.reduce((s, t) => s + save.dice[t], 0);

export function resetSave(): void {
  Object.assign(save, fresh());
  persist();
}
