import { indexBonus } from "./goals";
import { Effect, TREE, TREE_BY_ID, TreeNode, perAt, stepCost, stepsOf } from "../data/tree";
import { hasPass, persist, save } from "./save";

/** Everything the upgrade tree (and the luck potion) adds up to. A hexagon bought in part counts in part. */
export const stepsBought = (node: TreeNode) => save.tree[node.id] ?? 0;
const owned = (node: TreeNode) => stepsBought(node) >= stepsOf(node);
const sum = (effect: Effect) => TREE.reduce((s, t) => (t.effect === effect && stepsBought(t) ? s + perAt(t, stepsBought(t)) : s), 0);
const product = (effect: Effect) => TREE.reduce((p, t) => (t.effect === effect && stepsBought(t) ? p * perAt(t, stepsBought(t)) : p), 1);

export const potionActive = () => Date.now() < save.potionUntil;
export const potionMult = () => 2 + sum("potionPower");
export const potionMinutes = () => 5 + sum("potionTime");
export const POTION_GEMS = 30;

export function luckParts(): { tree: number; die: number; index: number; potion: number } {
  return {
    tree: product("luck"),
    die: product("die"),
    index: indexBonus(),
    potion: potionActive() ? potionMult() : 1,
  };
}

export function luck(): number {
  const p = luckParts();
  return p.tree * p.die * p.index * p.potion * (hasPass("luck") ? 1.5 : 1);
}

/** Every Nth roll is a lucky roll. */
export const luckyEvery = () => 10 - sum("luckyEvery");
export const luckyMult = () => 2 + sum("luckyPower");

/** Milliseconds between rolls. */
export const speedActive = () => Date.now() < save.speedUntil;
export const rollTime = () =>
  Math.max(120, 2000 * TREE.reduce((m, t) => (t.effect === "speed" && stepsBought(t) ? m * (1 - perAt(t, stepsBought(t))) : m), 1) * (speedActive() ? 0.5 : 1));
export const dicePerRoll = () => 1 + sum("multi");
export const autoUnlocked = () => sum("auto") > 0;
export const cashMult = () => product("cash") * (hasPass("vip") ? 1.25 : 1);
export const dmgMult = () => product("dmg");
export const heroDmgMult = () => product("heroDmg");
/** You start with one pet in your team and can unlock up to three. */
export const MAX_PETS = 3;
export const petSlots = () => Math.min(MAX_PETS, 1 + sum("slot"));
export const critChance = () => 0.05 + sum("crit");
export const critDamage = () => 3 + sum("critDmg");
export const offlineRate = () => 0.25 + sum("offline");
export const gemsPerBoss = () => (2 + sum("gems")) * (hasPass("gems") ? 2 : 1);
export const villageHpMult = () => 1 + sum("villageHp");
export const moveSpeedMult = () => 1 + sum("moveSpeed");
export const rangeMult = () => 1 + sum("range");
export const chestMult = () => product("chest");
/** The best gadget tier you can reach in a fight (index into GADGET_TIERS): C to start, the Forge raises it to SSS. */
export const gadgetTierCap = () => Math.min(6, 2 + sum("forge"));

export const dieSkin = () => TREE.filter((t) => t.effect === "die" && owned(t)).length;

// ───────────────────────── tree purchases ─────────────────────────

/** All its steps bought (the hexagons after it open). */
export const nodeOwned = (id: string) => id === "start" || owned(TREE_BY_ID[id]);
export const nodeUnlocked = (node: TreeNode) => node.req.every(nodeOwned);
/** Price of the next step of a hexagon. */
export const nextCost = (node: TreeNode) => (paysGems(node) ? gemCost(stepCost(node, stepsBought(node))) : stepCost(node, stepsBought(node)));
/** The Gems & Potions hexagons are paid with gems (their money price, turned into gems). */
export const paysGems = (node: TreeNode) => node.branch === "gems";
const gemCost = (cash: number) => Math.max(15, Math.round((15 * Math.pow(cash / 300, 0.25)) / 5) * 5);
const wallet = (node: TreeNode) => (paysGems(node) ? save.gems : save.cash);
export const canBuy = (node: TreeNode) => nodeUnlocked(node) && !nodeOwned(node.id) && wallet(node) >= nextCost(node);

export function buyNode(id: string): boolean {
  const node = TREE_BY_ID[id];
  if (!canBuy(node)) return false;
  if (paysGems(node)) save.gems -= nextCost(node);
  else save.cash -= nextCost(node);
  save.tree[id] = stepsBought(node) + 1;
  persist();
  return true;
}
