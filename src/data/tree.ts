/**
 * The upgrade tree. Buying a node unlocks the nodes connected above it.
 * x/y are grid positions (root at 0,0; the tree grows upward).
 *
 * Effects (per level):
 * - luckAdd:  +per to base luck (0.2 = +20%)
 * - luckMult: luck x per
 * - die:      luck x per and a new die skin (one level only)
 * - speed:    roll time x (1 - per)
 * - multi:    +1 die per roll
 * - auto:     unlocks auto roll
 * - cashAdd / cashMult, dmgAdd / dmgMult: same idea for money and damage
 * - slot:     +1 pet in your team
 * - crit:     +per critical-hit chance
 * - offline:  +per of normal earnings while away
 * - gems:     +per gems per boss
 * - potionPower: luck potion x(2 + level)
 * - potionTime:  +per minutes per potion
 */
export type Effect =
  | "luckAdd" | "luckMult" | "die" | "speed" | "multi" | "auto"
  | "cashAdd" | "cashMult" | "dmgAdd" | "dmgMult" | "slot" | "crit" | "offline" | "gems" | "potionPower" | "potionTime";

export interface TreeNode {
  id: string;
  name: string;
  icon: string;
  x: number;
  y: number;
  req: string[];
  max: number;
  base: number;
  growth: number;
  effect: Effect;
  per: number;
}

const n = (id: string, name: string, icon: string, x: number, y: number, req: string[], max: number, base: number, growth: number, effect: Effect, per: number): TreeNode =>
  ({ id, name, icon, x, y, req, max, base, growth, effect, per });

export const TREE: TreeNode[] = [
  // trunk: luck
  n("paw", "Lucky Paw", "clover", 0, 0, [], 5, 15, 1.6, "luckAdd", 0.2),
  n("clover", "Four-Leaf Clover", "clover", 0, -1, ["paw"], 5, 250, 1.7, "luckAdd", 0.5),
  n("iron", "Iron Die", "dice", 0, -2, ["clover"], 1, 2500, 1, "die", 2),
  n("horseshoe", "Horseshoe", "clover", 0, -3, ["iron"], 10, 12000, 1.8, "luckMult", 1.25),
  n("golddie", "Golden Die", "dice", 0, -4, ["horseshoe"], 1, 5e5, 1, "die", 3),
  n("star", "Shooting Star", "star", 0, -5, ["golddie"], 10, 4e6, 1.9, "luckMult", 1.3),
  n("crystaldie", "Crystal Die", "dice", 0, -6, ["star"], 1, 3e8, 1, "die", 5),
  n("rainbow", "Rainbow Luck", "clover", 0, -7, ["crystaldie"], 10, 5e9, 2, "luckMult", 1.5),
  n("cosmicdie", "Cosmic Die", "dice", 0, -8, ["rainbow"], 1, 2e12, 1, "die", 10),
  n("infinite", "Infinite Luck", "star", 0, -9, ["cosmicdie"], 999, 5e13, 1.35, "luckMult", 1.15),

  // left: rolling
  n("auto", "Auto Roll", "auto", -1, 0, ["paw"], 1, 40, 1, "auto", 1),
  n("quick", "Quick Hands", "clock", -2, 0, ["auto"], 8, 120, 1.7, "speed", 0.12),
  n("double", "Double Roll", "dice", -2, -1, ["quick"], 1, 3000, 1, "multi", 1),
  n("speedy", "Speedy Dice", "clock", -2, -2, ["double"], 8, 40000, 1.8, "speed", 0.1),
  n("triple", "Triple Roll", "dice", -2, -3, ["speedy"], 1, 1.5e6, 1, "multi", 1),
  n("lightning", "Lightning Dice", "bolt", -2, -4, ["triple"], 10, 1e8, 1.9, "speed", 0.08),
  n("quad", "Quad Roll", "dice", -2, -5, ["lightning"], 1, 2e10, 1, "multi", 1),
  n("penta", "Penta Roll", "dice", -2, -6, ["quad"], 1, 5e12, 1, "multi", 1),

  // left-middle: gems and potions
  n("gems", "Gem Finder", "gem", -1, -2, ["clover"], 5, 5000, 2, "gems", 1),
  n("potion", "Strong Potion", "potion", -1, -4, ["gems"], 3, 2e5, 5, "potionPower", 1),
  n("potiontime", "Long Potion", "potion", -1, -6, ["potion"], 3, 1e7, 10, "potionTime", 2),

  // right-middle: money
  n("piggy", "Piggy Bank", "cash", 1, 0, ["paw"], 10, 30, 1.5, "cashAdd", 0.25),
  n("magnet", "Cash Magnet", "cash", 1, -1, ["piggy"], 5, 1500, 2, "cashMult", 1.5),
  n("vault", "Bank Vault", "cash", 1, -3, ["magnet"], 5, 2e5, 2.5, "cashMult", 2),
  n("offline", "Night Shift", "clock", 1, -4, ["vault"], 4, 3e6, 3, "offline", 0.25),
  n("goose", "Golden Goose", "cash", 1, -5, ["offline"], 5, 5e8, 3, "cashMult", 3),
  n("infcash", "Infinite Money", "cash", 1, -6, ["goose"], 999, 1e12, 1.4, "cashMult", 1.2),

  // right: power and team
  n("claws", "Sharp Claws", "sword", 2, 0, ["piggy"], 10, 60, 1.55, "dmgAdd", 0.3),
  n("slot1", "Pet Slot", "slots", 2, -1, ["claws"], 1, 800, 1, "slot", 1),
  n("power", "Power Up", "sword", 2, -2, ["slot1"], 10, 20000, 1.8, "dmgMult", 1.5),
  n("slot2", "Pet Slot II", "slots", 2, -3, ["power"], 1, 1e6, 1, "slot", 1),
  n("crit", "Critical Hit", "target", 3, -3, ["slot2"], 6, 5e6, 2, "crit", 0.05),
  n("fury", "Fury", "sword", 2, -4, ["slot2"], 10, 5e7, 2.2, "dmgMult", 2),
  n("slot3", "Pet Slot III", "slots", 2, -5, ["fury"], 1, 1e9, 1, "slot", 1),
  n("titan", "Titan Strength", "sword", 2, -6, ["slot3"], 10, 1e11, 2.5, "dmgMult", 3),
  n("infdmg", "Infinite Power", "sword", 2, -7, ["titan"], 999, 1e13, 1.4, "dmgMult", 1.25),
];

export const TREE_BY_ID: Record<string, TreeNode> = Object.fromEntries(TREE.map((t) => [t.id, t]));

export const nodeCost = (node: TreeNode, level: number) => Math.round(node.base * node.growth ** level);

/** Short text for what one node level does. */
export function effectText(node: TreeNode): string {
  const p = node.per;
  switch (node.effect) {
    case "luckAdd": return `+${Math.round(p * 100)}% luck`;
    case "luckMult": return `x${p} luck`;
    case "die": return `x${p} luck + new die`;
    case "speed": return `-${Math.round(p * 100)}% roll time`;
    case "multi": return "+1 die every roll";
    case "auto": return "Rolls automatically";
    case "cashAdd": return `+${Math.round(p * 100)}% money`;
    case "cashMult": return `x${p} money`;
    case "dmgAdd": return `+${Math.round(p * 100)}% damage`;
    case "dmgMult": return `x${p} damage`;
    case "slot": return "+1 pet in your team";
    case "crit": return `+${Math.round(p * 100)}% critical hits`;
    case "offline": return `+${Math.round(p * 100)}% money while away`;
    case "gems": return "+1 gem per boss";
    case "potionPower": return "+1x potion luck";
    case "potionTime": return `+${p} min potion time`;
  }
}
