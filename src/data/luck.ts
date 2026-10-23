import { ItemDef, PET_LIST } from "./items";
import { DICE_TIERS, tierIndex } from "./tiers";

/**
 * How luck turns into pets. Luck x1B means a pet far rarer than 1 in 1B is 1B times more
 * likely than with no luck, but it never guarantees anything: every roll draws its own luck,
 * anywhere from x1 up to a top luck (evenly on a log scale), then checks the pets from rarest
 * to most common, each with chance (that roll's luck) / (its 1-in-N odds). The top luck is
 * set so the draws average out to your luck. So with x1B luck a 1-in-2 pet still turns up
 * now and then, a 1 in 1B pet is common, and rarer pets are 1B times easier than without luck.
 */
const RAREST_FIRST = [...PET_LIST].reverse();

/** True with probability p, accurate even for tiny chances like 1 in 500Sp. */
function chance(p: number): boolean {
  if (p >= 1) return true;
  while (p < 1e-9) {
    if (Math.random() >= 1e-9) return false;
    p *= 1e9;
  }
  return Math.random() < p;
}

/** The highest luck a roll can draw: the top of a log-even spread from x1 that averages `luck`. */
export function topLuck(luck: number): number {
  if (luck <= 1.0001) return 1;
  // the average of top^u for u in 0..1 is (top - 1) / ln(top); solve it for `luck`
  let top = luck * Math.log(luck) + luck;
  for (let i = 0; i < 60; i++) top = 1 + luck * Math.log(top);
  return top;
}

/** The luck one roll gets: a random amount between x1 and the top luck. */
export const rollLuck = (luck: number) => topLuck(luck) ** Math.random();

export function rollPet(luck: number): ItemDef {
  const l = rollLuck(luck);
  for (const p of RAREST_FIRST) {
    if (p.index === 0) break;
    if (chance(l / p.oneIn)) return p;
  }
  return PET_LIST[0];
}

/** Steps used to average over the luck a roll can draw. */
const STEPS = 256;

/** Chance per roll of each pet (by index), with the given luck. */
export function petChances(luck: number): number[] {
  const out = PET_LIST.map(() => 0);
  const lnL = Math.log(topLuck(luck));
  for (let k = 0; k < STEPS; k++) {
    const l = Math.exp(lnL * ((k + 0.5) / STEPS));
    let remaining = 1 / STEPS;
    for (const p of RAREST_FIRST) {
      if (p.index === 0) break;
      const c = Math.min(1, l / p.oneIn);
      out[p.index] += remaining * c;
      remaining *= 1 - c;
      if (remaining <= 0) break;
    }
    out[0] += remaining;
  }
  return out;
}

/** Chance per roll of landing each pet class (A to uSSS), with the given luck. */
export function classChances(luck: number): number[] {
  const out = DICE_TIERS.map(() => 0);
  petChances(luck).forEach((c, i) => (out[tierIndex(PET_LIST[i].cls)] += c));
  return out;
}
