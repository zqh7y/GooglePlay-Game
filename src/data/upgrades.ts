import { save } from "../systems/save";

export type UpgradeId = "power" | "fireRate" | "health" | "luck";

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** what the value means, e.g. "all damage" */
  desc: string;
  icon: string;
  maxLevel: number;
  cost: (lvl: number) => number;
  /** short value at a level, e.g. "x1.50" */
  value: (lvl: number) => string;
}

/** Coin upgrades for the cat gunner (Upgrade tab). */
export const UPGRADES: UpgradeDef[] = [
  {
    id: "power", name: "Power", desc: "all damage", icon: "icon_sword", maxLevel: 200,
    cost: (l) => Math.floor(25 * 1.17 ** l),
    value: (l) => `x${powerMult(l).toFixed(2)}`,
  },
  {
    id: "fireRate", name: "Fire Rate", desc: "shots / sec", icon: "icon_bolt", maxLevel: 30,
    cost: (l) => Math.floor(40 * 1.28 ** l),
    value: (l) => (1000 / heroInterval(l)).toFixed(1),
  },
  {
    id: "health", name: "Health", desc: "HP", icon: "icon_heart", maxLevel: 200,
    cost: (l) => Math.floor(30 * 1.19 ** l),
    value: (l) => String(heroMaxHp(l)),
  },
  {
    id: "luck", name: "Luck", desc: "roll luck", icon: "icon_clover", maxLevel: 50,
    cost: (l) => Math.floor(200 * 1.35 ** l),
    value: (l) => `x${luckMult(l).toFixed(1)}`,
  },
];

export const powerMult = (l = save.upgrades.power) => (1 + 0.2 * l) * 1.03 ** l;
export const heroInterval = (l = save.upgrades.fireRate) => Math.max(120, 600 * 0.94 ** l);
export const heroMaxHp = (l = save.upgrades.health) => Math.round(100 * (1 + 0.25 * l));
export const luckMult = (l = save.upgrades.luck) => 1 + 0.1 * l;
export const HERO_DAMAGE = 8;
