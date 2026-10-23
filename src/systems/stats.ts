import { indexBonus } from "./goals";
import { Effect, TREE, TREE_BY_ID, TreeNode } from "../data/tree";
import { persist, save } from "./save";

/** Everything the upgrade tree (and the luck potion) adds up to. */
const owned = (node: TreeNode) => (save.tree[node.id] ?? 0) > 0;
const sum = (effect: Effect) => TREE.reduce((s, t) => (t.effect === effect && owned(t) ? s + t.per : s), 0);
const product = (effect: Effect) => TREE.reduce((p, t) => (t.effect === effect && owned(t) ? p * t.per : p), 1);

export const potionActive = () => Date.now() < save.potionUntil;
export const potionMult = () => 2 + sum("potionPower");
export const potionMinutes = () => 5 + sum("potionTime");
export const POTION_GEMS = 10;

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
  return p.tree * p.die * p.index * p.potion;
}

/** Every Nth roll is a lucky roll. */
export const luckyEvery = () => 10 - sum("luckyEvery");
export const luckyMult = () => 2 + sum("luckyPower");

/** Milliseconds between rolls. */
export const speedActive = () => Date.now() < save.speedUntil;
export const rollTime = () =>
  Math.max(120, 2000 * TREE.reduce((m, t) => (t.effect === "speed" && owned(t) ? m * (1 - t.per) : m), 1) * (speedActive() ? 0.5 : 1));
export const dicePerRoll = () => 1 + sum("multi");
export const autoUnlocked = () => sum("auto") > 0;
export const cashMult = () => product("cash");
export const dmgMult = () => product("dmg");
export const heroDmgMult = () => product("heroDmg");
export const petSlots = () => 3 + sum("slot");
export const critChance = () => 0.05 + sum("crit");
export const critDamage = () => 3 + sum("critDmg");
export const offlineRate = () => 0.25 + sum("offline");
export const gemsPerBoss = () => 2 + sum("gems");
export const villageHpMult = () => 1 + sum("villageHp");
export const moveSpeedMult = () => 1 + sum("moveSpeed");
export const rangeMult = () => 1 + sum("range");
export const chestMult = () => product("chest");

export const dieSkin = () => TREE.filter((t) => t.effect === "die" && owned(t)).length;

// ───────────────────────── tree purchases ─────────────────────────

export const nodeOwned = (id: string) => id === "start" || (save.tree[id] ?? 0) > 0;
export const nodeUnlocked = (node: TreeNode) => node.req.every(nodeOwned);
export const canBuy = (node: TreeNode) => nodeUnlocked(node) && !nodeOwned(node.id) && save.cash >= node.cost;

export function buyNode(id: string): boolean {
  const node = TREE_BY_ID[id];
  if (!canBuy(node)) return false;
  save.cash -= node.cost;
  save.tree[id] = 1;
  persist();
  return true;
}
