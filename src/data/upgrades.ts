import { save } from "../systems/save";

export type UpgradeId = "power" | "fireRate" | "health" | "luck";

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  color: number;
  maxLevel: number;
  cost: (lvl: number) => number;
  /** human readable value at a level, e.g. "+50%" */
  value: (lvl: number) => string;
}

/** Coin upgrades for the cat gunner (Upgrades tab). */
export const UPGRADES: UpgradeDef[] = [
  {
    id: "power", name: "Power", color: 0xef4444, maxLevel: 200,
    cost: (l) => Math.floor(25 * 1.17 ** l),
    value: (l) => `x${powerMult(l).toFixed(2)} all damage`,
  },
  {
    id: "fireRate", name: "Fire Rate", color: 0x38bdf8, maxLevel: 30,
    cost: (l) => Math.floor(40 * 1.28 ** l),
    value: (l) => `${(1000 / heroInterval(l)).toFixed(1)} shots/s`,
  },
  {
    id: "health", name: "Health", color: 0x4ade80, maxLevel: 200,
    cost: (l) => Math.floor(30 * 1.19 ** l),
    value: (l) => `${heroMaxHp(l)} HP`,
  },
  {
    id: "luck", name: "Luck", color: 0xfbbf24, maxLevel: 50,
    cost: (l) => Math.floor(200 * 1.35 ** l),
    value: (l) => `x${luckMult(l).toFixed(1)} luck`,
  },
];

export const powerMult = (l = save.upgrades.power) => (1 + 0.2 * l) * 1.03 ** l;
export const heroInterval = (l = save.upgrades.fireRate) => Math.max(120, 600 * 0.94 ** l);
export const heroMaxHp = (l = save.upgrades.health) => Math.round(100 * (1 + 0.25 * l));
export const luckMult = (l = save.upgrades.luck) => 1 + 0.1 * l;
export const HERO_DAMAGE = 8;
