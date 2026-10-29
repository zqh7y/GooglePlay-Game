import type { Tier } from "./tiers";
import { RAIN_PETS } from "./items";

/**
 * The Dice Rain beginner event (the first 14 days): in its fight, giant dice fall on you. Every
 * die you dodge gives Rain Drops (rarer dice give more), surviving the 5 minutes gives a bonus,
 * and the drops fill a reward track of 15 prizes, with two exclusive pets on it.
 */
export type RainRewardKind = "dice" | "gems" | "potion" | "lucky" | "ticket" | "pet";

export interface RainReward {
  kind: RainRewardKind;
  amount: number;
  tier?: Tier;
  pet?: string;
}

/** Drops for dodging a die of rank 0 (A) to 7 (uSSS). */
export const dodgeDrops = (rank: number) => 1 + rank;
/** Drops for surviving the whole fight. */
export const RAIN_WIN_DROPS = 50;

export const RAIN_TRACK: { goal: number; reward: RainReward }[] = [
  { goal: 20, reward: { kind: "dice", amount: 10, tier: "A" } },
  { goal: 50, reward: { kind: "potion", amount: 15 } },
  { goal: 90, reward: { kind: "dice", amount: 6, tier: "B" } },
  { goal: 140, reward: { kind: "gems", amount: 10 } },
  { goal: 200, reward: { kind: "lucky", amount: 10 } },
  { goal: 280, reward: { kind: "dice", amount: 4, tier: "C" } },
  { goal: 380, reward: { kind: "pet", amount: 1, pet: RAIN_PETS.drizzle.id } },
  { goal: 500, reward: { kind: "potion", amount: 30 } },
  { goal: 650, reward: { kind: "dice", amount: 3, tier: "D" } },
  { goal: 850, reward: { kind: "gems", amount: 20 } },
  { goal: 1100, reward: { kind: "ticket", amount: 1 } },
  { goal: 1400, reward: { kind: "dice", amount: 2, tier: "E" } },
  { goal: 1750, reward: { kind: "lucky", amount: 25 } },
  { goal: 2150, reward: { kind: "dice", amount: 1, tier: "S" } },
  { goal: 2600, reward: { kind: "pet", amount: 1, pet: RAIN_PETS.dragon.id } },
];
