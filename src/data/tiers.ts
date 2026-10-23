/**
 * Rarity tiers shared by gadgets (A to SSS), pet classes and dice (A to uSSS). A is the most common.
 */
export const DICE_TIERS = ["A", "B", "C", "D", "E", "S", "SSS", "uSSS"] as const;
export type Tier = (typeof DICE_TIERS)[number];
export const GADGET_TIERS: Tier[] = ["A", "B", "C", "D", "E", "S", "SSS"];

export const TIER_INFO: Record<Tier, { name: string; color: number; css: string }> = {
  A: { name: "Common", color: 0xb8c2cc, css: "#d8e0e8" },
  B: { name: "Rare", color: 0x6fd25a, css: "#8af06a" },
  C: { name: "Super Rare", color: 0x4fa8ff, css: "#7ac4ff" },
  D: { name: "Epic", color: 0xb36aff, css: "#c89aff" },
  E: { name: "Legendary", color: 0xffb02e, css: "#ffc65a" },
  S: { name: "Mythic", color: 0xff4f5e, css: "#ff7a86" },
  SSS: { name: "Titanic", color: 0xff4fd8, css: "#ff8ae6" },
  uSSS: { name: "Ultra Titanic", color: 0x3ff0e0, css: "#7afff2" },
};

export const tierIndex = (t: Tier) => DICE_TIERS.indexOf(t);

/** Pick an index from relative weights. */
export function pickWeighted(weights: number[], r = Math.random()): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i];
    if (x <= 0) return i;
  }
  return 0;
}

/**
 * Tier weights: each step up is `steps[i] * g` times as likely as the one below, so a
 * bigger g (later stage, longer fight, more luck) makes every rarer tier more likely.
 */
function stepWeights(steps: number[], g: number): number[] {
  const w = [1];
  for (const s of steps) w.push(w[w.length - 1] * s * g);
  return w;
}

// ───────────────────────── dice ─────────────────────────

const DICE_STEPS = [1, 0.73, 0.55, 0.4, 0.2, 0.05, 0.02];

/** How a stage shifts dice towards rarer tiers: D is a dream at stage 10, normal at 100. */
const diceG = (stage: number) => Math.max(0.025, (Math.min(stage, 100) / 100) ** 0.8);

export const diceTierWeights = (stage: number) => stepWeights(DICE_STEPS, diceG(stage));
export const diceTierChances = (stage: number) => {
  const w = diceTierWeights(stage);
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
};
export const rollDiceTier = (stage: number): Tier => DICE_TIERS[pickWeighted(diceTierWeights(stage))];

/** Rolling with a rarer die multiplies your luck for that roll. */
export const DICE_LUCK: Record<Tier, number> = { A: 1, B: 2, C: 5, D: 15, E: 50, S: 250, SSS: 2500, uSSS: 50000 };

// ───────────────────────── gadget airdrops ─────────────────────────

const GADGET_STEPS = [0.7, 0.5, 0.35, 0.2, 0.06, 0.01];

/** Airdrops get better the longer you survive (and with the Lucky Drops skill). */
export function gadgetTierWeights(minutes: number, luckLevel: number): number[] {
  return stepWeights(GADGET_STEPS, (0.15 + 0.17 * minutes) * (1 + 0.25 * luckLevel));
}
export const rollGadgetTier = (minutes: number, luckLevel: number): Tier => GADGET_TIERS[pickWeighted(gadgetTierWeights(minutes, luckLevel))];
