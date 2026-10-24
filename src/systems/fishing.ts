import { BOOSTS } from "../data/boosts";
import {
  EVENT_REWARDS, EventReward, FIRST_CATCH_SHELLS, FISH_UPGRADES, FISH_UP_BY_ID, FishUpId, PRIZES, Prize, ROW_SHELLS, SHINY_MULT, SUPER_LUCK, catchSecs, coolerHours,
  deepMult, doubleChance, eventGoal, eventReward, fishLuck, goldMult, netMult, rollPrize, shinyChance, superEvery, upgradeCost,
} from "../data/fishing";
import { questEvent } from "./goals";
import { save } from "./save";

/**
 * The fishing line runs all the time: catches come in on the fishing screen, while you fight
 * and (until the cooler box is full) while you are away. This module catches and pays out;
 * the fishing screen only shows it.
 */

export interface Catch {
  /** index in PRIZES */
  prize: number;
  /** what you got: dice, gems, shells, minutes, lucky rolls or money */
  amount: number;
  /** the shells that came with it */
  shells: number;
  shiny: boolean;
  super: boolean;
  /** the second prize of a double hook */
  double: boolean;
  /** a battle boost from a message bottle */
  boost?: string;
  /** extra shells for the first catch of this prize ever */
  bonus?: number;
}

export const fishLv = (id: FishUpId) => save.fishing.lv[id] ?? 0;
export const catchMs = () => catchSecs(fishLv("speed")) * 1000;
export const currentLuck = () => fishLuck(fishLv("luck"));
export const currentDeep = () => deepMult(fishLv("pond"));
/** Catches left until the next SUPER catch (1 = the next one). */
export const superIn = () => Math.max(1, superEvery(fishLv("super")) - save.fishing.superCount);

/** Money a prize is worth: seconds of what fighting earns you now. */
export const cashFor = (secs: number) => Math.max(1, Math.floor(Math.max(3, save.cashPerSec) * secs));

/** Round a fractional amount up or down at random, so 1.3 is 1 most times and 2 sometimes. */
const lucky = (x: number) => Math.floor(x) + (Math.random() < x % 1 ? 1 : 0);

/** One prize and what it pays (without paying it yet). */
function land(prizeIdx: number, isSuper: boolean, double: boolean): Catch {
  const p = PRIZES[prizeIdx];
  const shiny = Math.random() < shinyChance(fishLv("shiny"));
  const k = shiny ? SHINY_MULT : 1;
  const gold = goldMult(fishLv("gold"));
  const net = netMult(fishLv("net"));
  let amount = p.amount * k;
  if (p.kind === "cash") amount = cashFor(amount);
  else if (p.kind === "shells") amount = Math.round(amount * gold);
  else amount = lucky(amount * net);
  const c: Catch = { prize: prizeIdx, amount, shells: Math.round(ROW_SHELLS[p.row] * gold * k), shiny, super: isSuper, double };
  if (p.kind === "boost") c.boost = BOOSTS[Math.floor(Math.random() * BOOSTS.length)].id;
  return c;
}

/** Pay a catch out. */
function pay(c: Catch): void {
  const p: Prize = PRIZES[c.prize];
  const f = save.fishing;
  f.shells += c.shells;
  if (!f.caught[p.id]) {
    c.bonus = Math.round(ROW_SHELLS[p.row] * FIRST_CATCH_SHELLS * goldMult(fishLv("gold")));
    f.shells += c.bonus;
  }
  f.caught[p.id] = (f.caught[p.id] ?? 0) + 1;
  const now = Date.now();
  switch (p.kind) {
    case "shells":
      f.shells += c.amount;
      break;
    case "cash":
      save.cash += c.amount;
      break;
    case "dice":
      save.dice[p.tier!] += c.amount;
      break;
    case "jackpot":
      save.dice[p.tier!] += c.amount;
      save.gems += p.gems ?? 0;
      break;
    case "gems":
      save.gems += c.amount;
      break;
    case "luckPotion":
      save.potionUntil = Math.max(now, save.potionUntil) + c.amount * 60000;
      break;
    case "speedPotion":
      save.speedUntil = Math.max(now, save.speedUntil) + c.amount * 60000;
      break;
    case "lucky":
      save.luckyBoost += c.amount;
      break;
    case "boost":
      save.boosts[c.boost!] = (save.boosts[c.boost!] ?? 0) + c.amount;
      break;
  }
}

/** One cast: a prize (two with the double hook), paid out. Every few casts is a SUPER catch. */
export function fishOnce(): Catch[] {
  const f = save.fishing;
  f.catches++;
  f.superCount++;
  const isSuper = f.superCount >= superEvery(fishLv("super"));
  if (isSuper) f.superCount = 0;
  const luck = currentLuck() * (isSuper ? SUPER_LUCK : 1);
  const deep = currentDeep();
  const out = [land(rollPrize(luck, deep), isSuper, false)];
  if (Math.random() < doubleChance(fishLv("hook"))) out.push(land(rollPrize(luck, deep), isSuper, true));
  out.forEach(pay);
  // every catch fills the event bar
  f.event.points += out.length;
  questEvent("fish", out.length);
  return out;
}

/** Catch whatever is due by now. At most `max` casts at once (the rest wait for the next call). */
export function fishTick(now = Date.now(), max = 20): Catch[] {
  const f = save.fishing;
  if (!f.nextAt) f.nextAt = now + catchMs();
  const out: Catch[] = [];
  for (let i = 0; i < max && now >= f.nextAt; i++) {
    out.push(...fishOnce());
    f.nextAt += catchMs();
  }
  return out;
}

/**
 * Back after a while: the line kept fishing until the cooler box was full. Returns the catches
 * (already paid) and how long it fished.
 */
export function fishAway(now = Date.now()): { catches: Catch[]; secs: number } {
  const f = save.fishing;
  if (!f.nextAt || now < f.nextAt) return { catches: [], secs: 0 };
  const cap = coolerHours(fishLv("cooler")) * 3600 * 1000;
  const from = f.nextAt;
  const until = Math.min(now, from + cap);
  const n = Math.floor((until - from) / catchMs()) + 1;
  const catches: Catch[] = [];
  for (let i = 0; i < n; i++) catches.push(...fishOnce());
  f.nextAt = now + catchMs();
  return { catches, secs: (until - from) / 1000 };
}

export const canBuyFish = (id: FishUpId) => {
  const u = FISH_UP_BY_ID[id];
  return fishLv(id) < u.max && save.fishing.shells >= upgradeCost(u, fishLv(id));
};
export const anyFishUpgrade = () => FISH_UPGRADES.some((u) => canBuyFish(u.id));

export function buyFish(id: FishUpId): boolean {
  if (!canBuyFish(id)) return false;
  const u = FISH_UP_BY_ID[id];
  const wasMs = catchMs();
  save.fishing.shells -= upgradeCost(u, fishLv(id));
  save.fishing.lv[id] = fishLv(id) + 1;
  // a quicker reel also brings the next catch closer
  if (id === "speed") save.fishing.nextAt -= wasMs - catchMs();
  return true;
}

// ───────────────────────── the fishing event ─────────────────────────

/** The next reward of the event round and how far along it is. */
export function eventNext(): { k: number; reward: EventReward; from: number; goal: number } {
  const e = save.fishing.event;
  const k = Math.min(e.claimed, EVENT_REWARDS - 1);
  return { k, reward: eventReward(e.round, k, save.stage), from: k ? eventGoal(e.round, k - 1) : 0, goal: eventGoal(e.round, k) };
}

/** How many event rewards are waiting to be claimed. */
export function eventReady(): number {
  const e = save.fishing.event;
  let n = 0;
  for (let k = e.claimed; k < EVENT_REWARDS && e.points >= eventGoal(e.round, k); k++) n++;
  return n;
}

export function payEventReward(r: EventReward): void {
  const now = Date.now();
  switch (r.kind) {
    case "shells":
      save.fishing.shells += r.amount;
      break;
    case "dice":
      save.dice[r.tier!] += r.amount;
      break;
    case "gems":
      save.gems += r.amount;
      break;
    case "boost":
      save.boosts[r.boost!] = (save.boosts[r.boost!] ?? 0) + r.amount;
      break;
    case "luckPotion":
      save.potionUntil = Math.max(now, save.potionUntil) + r.amount * 60000;
      break;
    case "lucky":
      save.luckyBoost += r.amount;
      break;
    case "grand":
      save.dice[r.tier!] += r.amount;
      save.gems += r.gems ?? 0;
      break;
  }
}

/**
 * Claim every event reward that is ready. After the 10th the next round starts (catches beyond its
 * goal carry over). Returns what was paid.
 */
export function claimEvent(): EventReward[] {
  const e = save.fishing.event;
  const out: EventReward[] = [];
  while (e.claimed < EVENT_REWARDS && e.points >= eventGoal(e.round, e.claimed)) {
    const r = eventReward(e.round, e.claimed, save.stage);
    payEventReward(r);
    out.push(r);
    e.claimed++;
    if (e.claimed >= EVENT_REWARDS) {
      e.points -= eventGoal(e.round, EVENT_REWARDS - 1);
      e.round++;
      e.claimed = 0;
    }
  }
  return out;
}
