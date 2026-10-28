import { RARITY_INFO, RARITY_ORDER } from "../data/rarity";
import { Tier } from "../data/tiers";
import { persist, save } from "./save";

// ───────────────────────── quests ─────────────────────────

export type QuestType = "kill" | "roll" | "wave" | "buy" | "boss" | "combo" | "rare" | "dice" | "fish";

export interface Quest {
  type: QuestType;
  target: number;
  progress: number;
}

const QUEST_TYPES: QuestType[] = ["kill", "roll", "wave", "buy", "boss", "combo", "rare", "dice", "fish"];
export const QUEST_SLOTS = 3;

function makeQuest(tier: number, avoid: QuestType[]): Quest {
  const pool = QUEST_TYPES.filter((t) => !avoid.includes(t));
  const type = pool[Math.floor(Math.random() * pool.length)];
  const target = {
    kill: Math.round(60 * 1.35 ** tier),
    roll: Math.round(10 * 1.25 ** tier),
    // minutes survived
    wave: 4 + tier * 2,
    dice: 8 + tier * 3,
    buy: 2 + Math.ceil(tier / 2),
    boss: 1 + Math.floor(tier / 3),
    combo: 20 + tier * 10,
    fish: 6 + tier * 4,
    // rarity rank to roll
    rare: Math.min(RARITY_ORDER.length - 1, 2 + Math.floor(tier / 2)),
  }[type];
  return { type, target, progress: 0 };
}

/** Fill empty quest slots; called on start and after claiming. */
export function ensureQuests(): void {
  while (save.quests.length < QUEST_SLOTS) save.quests.push(makeQuest(save.questTier, save.quests.map((q) => q.type)));
}

export function questText(q: Quest): string {
  switch (q.type) {
    case "kill": return `Defeat ${q.target} monsters`;
    case "roll": return `Roll ${q.target} times`;
    case "wave": return `Survive ${q.target} minutes`;
    case "dice": return `Find ${q.target} dice`;
    case "buy": return `Buy ${q.target} upgrades`;
    case "boss": return `Defeat ${q.target} boss${q.target > 1 ? "es" : ""}`;
    case "combo": return `Reach a ${q.target} kill streak`;
    case "fish": return `Catch ${q.target} things fishing`;
    case "rare": return `Roll a ${RARITY_INFO[RARITY_ORDER[q.target]].label} pet`;
  }
}

/** A short name (the numbers go on the bar) and an icon for each kind of quest. */
export function questTitle(q: Quest): string {
  switch (q.type) {
    case "kill": return "Defeat monsters";
    case "roll": return "Roll dice";
    case "wave": return "Survive minutes";
    case "dice": return "Find dice";
    case "buy": return "Buy upgrades";
    case "boss": return "Beat bosses";
    case "combo": return "Kill streak";
    case "fish": return "Go fishing";
    case "rare": return `Roll ${RARITY_INFO[RARITY_ORDER[q.target]].label}`;
  }
}

export const QUEST_ICON: Record<QuestType, string> = {
  kill: "icon_skull", roll: "icon_dice", wave: "icon_clock", dice: "icon_dice", buy: "icon_star",
  boss: "mode_boss", combo: "icon_bolt", fish: "icon_fish", rare: "icon_egg",
};

/** For progress bars: "rare" is a yes/no goal. */
export const questGoal = (q: Quest) => (q.type === "rare" ? 1 : q.target);
export const questDone = (q: Quest) => q.progress >= questGoal(q);
export const questsReady = () => save.quests.filter(questDone).length;

/** Report something the player did. `amount` is a count, or the value reached for combo / rare. */
export function questEvent(type: QuestType, amount = 1): void {
  for (const q of save.quests) {
    if (q.type !== type || questDone(q)) continue;
    if (type === "combo") q.progress = Math.max(q.progress, Math.min(amount, q.target));
    else if (type === "rare") q.progress = amount >= q.target ? 1 : 0;
    else q.progress = Math.min(q.target, q.progress + amount);
  }
}

export function questReward(): { gems: number; cash: number } {
  return { gems: 3 + Math.floor(save.questTier / 2), cash: Math.max(300, save.cashPerSec * 150) };
}

export function claimQuest(i: number): { gems: number; cash: number } | null {
  const q = save.quests[i];
  if (!q || !questDone(q)) return null;
  const r = questReward();
  save.gems += r.gems;
  save.cash += r.cash;
  save.questsDone++;
  // every 3 quests the next ones get harder (and pay more)
  save.questTier = Math.floor(save.questsDone / 3);
  save.quests.splice(i, 1);
  ensureQuests();
  persist();
  return r;
}

// ───────────────────────── daily reward ─────────────────────────

export interface DailyReward {
  /** what the day's card says, its picture and colour */
  name: string;
  icon: string;
  color: number;
  gems: number;
  /** minutes of money income */
  cashMin: number;
  /** minutes of luck potion */
  potionMin: number;
  /** dice of a tier */
  dice?: [Tier, number];
}

export const DAILY: DailyReward[] = [
  { name: "Luck Potion", icon: "icon_potion", color: 0xffa83a, gems: 0, cashMin: 0, potionMin: 10 },
  { name: "B Dice", icon: "die_B", color: 0xff7ad8, gems: 0, cashMin: 0, potionMin: 0, dice: ["B", 5] },
  { name: "Gems", icon: "icon_gem", color: 0xf04a5a, gems: 10, cashMin: 0, potionMin: 0 },
  { name: "Money Bag", icon: "icon_cash", color: 0x4fa8ff, gems: 0, cashMin: 30, potionMin: 0 },
  { name: "C Dice", icon: "die_C", color: 0x5fc85a, gems: 0, cashMin: 0, potionMin: 0, dice: ["C", 5] },
  { name: "Gem Pile", icon: "icon_gem", color: 0xa86aff, gems: 25, cashMin: 0, potionMin: 0 },
  { name: "OP REWARDS!", icon: "chest_gold", color: 0x8a4ae0, gems: 50, cashMin: 0, potionMin: 30, dice: ["D", 3] },
];

const dayKey = (t: number) => new Date(t).toDateString();

/** Streak day (0-6) that can be claimed today, or -1 if already claimed. */
export function dailyDay(): number {
  const today = dayKey(Date.now());
  if (save.dailyLast === today) return -1;
  const yesterday = dayKey(Date.now() - 86400000);
  return save.dailyLast === yesterday ? save.dailyStreak % DAILY.length : 0;
}

export const dailyCash = (r: DailyReward) => Math.max(500, save.cashPerSec * 60 * r.cashMin);

export function claimDaily(): DailyReward | null {
  const day = dailyDay();
  if (day < 0) return null;
  const r = DAILY[day];
  save.gems += r.gems;
  if (r.cashMin) save.cash += dailyCash(r);
  if (r.potionMin) save.potionUntil = Math.max(Date.now(), save.potionUntil) + r.potionMin * 60000;
  if (r.dice) save.dice[r.dice[0]] += r.dice[1];
  save.dailyStreak = day + 1;
  save.dailyLast = dayKey(Date.now());
  persist();
  return r;
}

// ───────────────────────── index milestones ─────────────────────────

export const INDEX_STEP = 10;
export const INDEX_LUCK = 0.25;

/** Permanent luck from collecting: +25% for every 10 different pets found. */
export const indexBonus = () => 1 + INDEX_LUCK * Math.floor(save.discovered.length / INDEX_STEP);

/** Gives gems for newly reached collection milestones; returns how many were reached. */
export function checkIndexMilestones(): number {
  const reached = Math.floor(save.discovered.length / INDEX_STEP);
  const fresh = reached - save.indexMilestones;
  if (fresh <= 0) return 0;
  for (let m = save.indexMilestones + 1; m <= reached; m++) save.gems += 10 * m;
  save.indexMilestones = reached;
  persist();
  return fresh;
}
