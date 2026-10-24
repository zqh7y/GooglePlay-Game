import { BOOSTS } from "../data/boosts";
import {
  FISH_UPGRADES, FISH_UP_BY_ID, FishUpId, PRIZES, Prize, ROW_SHELLS, SHINY_MULT, SUPER_LUCK, catchSecs, coolerHours, doubleChance, fishLuck, goldMult,
  netMult, prizesOpen, rollPrize, shinyChance, superEvery, upgradeCost,
} from "../data/fishing";
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
}

export const fishLv = (id: FishUpId) => save.fishing.lv[id] ?? 0;
export const catchMs = () => catchSecs(fishLv("speed")) * 1000;
export const currentLuck = () => fishLuck(fishLv("luck"));
export const openPrizes = () => prizesOpen(fishLv("pond"));
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
  const open = openPrizes();
  const out = [land(rollPrize(luck, open), isSuper, false)];
  if (Math.random() < doubleChance(fishLv("hook"))) out.push(land(rollPrize(luck, open), isSuper, true));
  out.forEach(pay);
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
