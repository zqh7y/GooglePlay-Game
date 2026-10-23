import { TREE, TREE_BY_ID, TreeNode, nodeCost } from "../data/tree";
import { persist, save } from "./save";

/** Everything the upgrade tree (and the luck potion) adds up to. */
function level(node: TreeNode): number {
  return save.tree[node.id] ?? 0;
}

function sum(effect: TreeNode["effect"]): number {
  return TREE.filter((t) => t.effect === effect).reduce((s, t) => s + t.per * level(t), 0);
}

function product(effect: TreeNode["effect"]): number {
  return TREE.filter((t) => t.effect === effect).reduce((p, t) => p * t.per ** level(t), 1);
}

export const potionActive = () => Date.now() < save.potionUntil;
export const potionMult = () => 2 + sum("potionPower");
export const potionMinutes = () => 5 + sum("potionTime");
export const POTION_GEMS = 10;

export const dieSkin = () => TREE.filter((t) => t.effect === "die" && level(t) > 0).length;

export function luckParts(): { base: number; mult: number; die: number; potion: number } {
  return {
    base: 1 + sum("luckAdd"),
    mult: product("luckMult"),
    die: product("die"),
    potion: potionActive() ? potionMult() : 1,
  };
}

export function luck(): number {
  const p = luckParts();
  return p.base * p.mult * p.die * p.potion;
}

/** Milliseconds between rolls. */
export const rollTime = () => Math.max(150, 2000 * TREE.filter((t) => t.effect === "speed").reduce((m, t) => m * (1 - t.per) ** level(t), 1));
export const dicePerRoll = () => 1 + sum("multi");
export const autoUnlocked = () => sum("auto") > 0;
export const cashMult = () => (1 + sum("cashAdd")) * product("cashMult");
export const dmgMult = () => (1 + sum("dmgAdd")) * product("dmgMult");
export const petSlots = () => 3 + sum("slot");
export const critChance = () => 0.05 + sum("crit");
export const offlineRate = () => 0.25 + sum("offline");
export const gemsPerBoss = () => 2 + sum("gems");

// ───────────────────────── tree purchases ─────────────────────────

export const nodeLevel = (id: string) => save.tree[id] ?? 0;

export function nodeUnlocked(node: TreeNode): boolean {
  return node.req.every((r) => nodeLevel(r) > 0);
}

export function canBuy(node: TreeNode): boolean {
  return nodeUnlocked(node) && nodeLevel(node.id) < node.max && save.cash >= nodeCost(node, nodeLevel(node.id));
}

export function buyNode(id: string): boolean {
  const node = TREE_BY_ID[id];
  if (!canBuy(node)) return false;
  save.cash -= nodeCost(node, nodeLevel(id));
  save.tree[id] = nodeLevel(id) + 1;
  persist();
  return true;
}
