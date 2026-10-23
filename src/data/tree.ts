/**
 * The upgrade tree: a honeycomb of single-purchase hexagons growing out from the middle.
 *
 * Six main branches leave the centre in the six hex directions. Side forks always turn
 * 60 degrees counter-clockwise, so every fork stays inside its own wedge and nothing overlaps.
 * Positions are axial hex coordinates (q, r).
 *
 * Effects:
 * - luck, cash, dmg, heroDmg, chest: multiply by `per`
 * - die: multiply luck by `per` and unlock a new die skin
 * - speed: roll time x (1 - per)
 * - multi: +1 die per roll; auto: unlocks auto roll
 * - slot: +1 pet in your team
 * - crit: +per critical-hit chance; critDmg: +per critical damage (x3 base)
 * - offline: +per of normal earnings while away
 * - villageHp, moveSpeed, range: +per (0.25 = +25%)
 * - gems: +per gems per boss; potionPower: +per x potion luck; potionTime: +per minutes
 * - luckyEvery: lucky roll comes `per` rolls sooner; luckyPower: +per x lucky roll luck
 */
export type Effect =
  | "start" | "luck" | "die" | "speed" | "multi" | "auto" | "cash" | "offline" | "dmg" | "heroDmg" | "crit" | "critDmg"
  | "slot" | "villageHp" | "moveSpeed" | "range" | "gems" | "potionPower" | "potionTime" | "chest" | "luckyEvery" | "luckyPower";

export type Branch = "start" | "luck" | "roll" | "money" | "power" | "team" | "gems";

export const BRANCH_INFO: Record<Branch, { label: string; color: number; light: number }> = {
  start: { label: "Start", color: 0xffffff, light: 0xffffff },
  luck: { label: "Luck", color: 0x3fcf6a, light: 0xb8f5c6 },
  roll: { label: "Rolling", color: 0xffa62e, light: 0xffe0a8 },
  money: { label: "Money", color: 0xf2c21f, light: 0xfff0a0 },
  power: { label: "Power", color: 0xf2545b, light: 0xffc2c4 },
  team: { label: "Team", color: 0xa66bff, light: 0xe2cfff },
  gems: { label: "Gems & Potions", color: 0x3fb8f2, light: 0xb8e8ff },
};

export interface TreeNode {
  id: string;
  name: string;
  icon: string;
  branch: Branch;
  q: number;
  r: number;
  req: string[];
  cost: number;
  effect: Effect;
  per: number;
}

type Dir = "E" | "NE" | "NW" | "W" | "SW" | "SE";
const DIRS: Record<Dir, [number, number]> = { E: [1, 0], NE: [1, -1], NW: [0, -1], W: [-1, 0], SW: [-1, 1], SE: [0, 1] };
const TURN: Record<Dir, Dir> = { E: "NE", NE: "NW", NW: "W", W: "SW", SW: "SE", SE: "E" };

/** Prices are bent upward so late hexagons take real saving up: price = base ^ COST_POWER. */
export const COST_POWER = 1.16;
const price = (c: number) => (c < 100 ? Math.round(c) : Math.round(c ** COST_POWER / 10 ** (2 * (COST_POWER - 1))));

/** [id, name, icon, cost, effect, per] */
type Spec = [string, string, string, number, Effect, number];

export const TREE: TreeNode[] = [{ id: "start", name: "Start", icon: "star", branch: "start", q: 0, r: 0, req: [], cost: 0, effect: "start", per: 0 }];
const byId = () => Object.fromEntries(TREE.map((t) => [t.id, t]));

/** Lay a straight run of nodes from `from`, each requiring the one before. */
function run(branch: Branch, from: string, dir: Dir, specs: Spec[]): void {
  let prev = byId()[from];
  const [dq, dr] = DIRS[dir];
  for (const [id, name, icon, cost, effect, per] of specs) {
    const node: TreeNode = { id, name, icon, branch, q: prev.q + dq, r: prev.r + dr, req: [prev.id], cost: price(cost), effect, per };
    TREE.push(node);
    prev = node;
  }
}

/** A main branch from the centre, plus forks that turn off it. */
function branch(b: Branch, dir: Dir, main: Spec[], forks: Record<string, Spec[]>): void {
  run(b, "start", dir, main);
  for (const [from, specs] of Object.entries(forks)) run(b, from, TURN[dir], specs);
}

const R = ["I", "II", "III", "IV", "V"];
/** Numbered fork: "Four Leaf I", "Four Leaf II", ... with costs multiplied by `step`. */
const series = (id: string, name: string, icon: string, n: number, cost: number, step: number, effect: Effect, per: number): Spec[] =>
  Array.from({ length: n }, (_, i) => [`${id}${i + 1}`, `${name} ${R[i]}`, icon, cost * step ** i, effect, per]);

branch("money", "E", [
  ["piggy", "Piggy Bank", "cash", 40, "cash", 1.5],
  ["magnet", "Coin Magnet", "cash", 700, "cash", 1.5],
  ["vault", "Bank Vault", "cash", 12e3, "cash", 2],
  ["goose", "Golden Goose", "cash", 250e3, "cash", 2],
  ["tmap", "Treasure Map", "chest", 6e6, "chest", 2],
  ["mine", "Gold Mine", "cash", 150e6, "cash", 2],
  ["mint", "Royal Mint", "cash", 5e9, "cash", 2.5],
  ["hoard", "Dragon Hoard", "cash", 200e9, "cash", 2.5],
  ["midas", "Midas Touch", "cash", 10e12, "cash", 3],
  ["infcash", "Endless Wealth", "cash", 600e12, "cash", 3],
], {
  magnet: series("off", "Idle Income", "clock", 3, 3000, 12, "offline", 0.15),
  goose: series("coin", "Lucky Coins", "cash", 3, 1e6, 15, "cash", 1.3),
  mint: series("interest", "Interest", "cash", 2, 20e9, 20, "cash", 1.5),
});

branch("luck", "NE", [
  ["paw", "Lucky Paw", "paw", 25, "luck", 2],
  ["clover", "Clover", "clover", 300, "luck", 3],
  ["horseshoe", "Horseshoe", "clover", 5e3, "luck", 3],
  ["golddie", "Gold Die", "dice", 90e3, "die", 4],
  ["lstar", "Lucky Star", "star", 2e6, "luck", 5],
  ["crystaldie", "Crystal Die", "dice", 60e6, "die", 6],
  ["charm", "Fortune Charm", "clover", 2e9, "luck", 8],
  ["cosmicdie", "Cosmic Die", "dice", 80e9, "die", 10],
  ["fate", "Fate Weaver", "star", 4e12, "luck", 12],
  ["galaxydie", "Galaxy Die", "dice", 200e12, "die", 15],
  ["destiny", "Destiny", "star", 10e15, "luck", 20],
  ["influck", "Infinite Luck", "clover", 500e15, "luck", 30],
], {
  clover: series("leaf", "Four Leaf", "clover", 3, 1200, 6, "luck", 2),
  lstar: series("wish", "Wishbone", "star", 3, 8e6, 8, "luck", 3),
  cosmicdie: series("shard", "Star Shard", "star", 3, 300e9, 10, "luck", 4),
  destiny: series("moonstone", "Moonstone", "star", 2, 30e15, 10, "luck", 6),
});

branch("roll", "NW", [
  ["quick", "Quick Hands", "clock", 30, "speed", 0.15],
  ["auto", "Auto Roll", "auto", 400, "auto", 1],
  ["double", "Double Dice", "dice", 8e3, "multi", 1],
  ["swift", "Swift Roll", "clock", 150e3, "speed", 0.15],
  ["triple", "Triple Dice", "dice", 4e6, "multi", 1],
  ["rapid", "Rapid Roll", "clock", 120e6, "speed", 0.15],
  ["quad", "Quad Dice", "dice", 5e9, "multi", 1],
  ["lightning", "Lightning Roll", "bolt", 200e9, "speed", 0.2],
  ["penta", "Penta Dice", "dice", 10e12, "multi", 1],
  ["instant", "Instant Roll", "bolt", 600e12, "speed", 0.2],
], {
  quick: series("streak", "Lucky Streak", "star", 2, 2500, 40, "luckyEvery", 2),
  swift: series("spd", "Nimble Fingers", "clock", 3, 500e3, 10, "speed", 0.08),
  quad: series("lpow", "Lucky Roll Power", "star", 2, 20e9, 30, "luckyPower", 1),
});

branch("power", "W", [
  ["claws", "Sharp Claws", "sword", 50, "dmg", 1.5],
  ["powerup", "Power Up", "sword", 900, "dmg", 1.6],
  ["blaster", "Hero Blaster", "target", 15e3, "heroDmg", 2],
  ["fury", "Fury", "sword", 300e3, "dmg", 2],
  ["crit", "Critical Eye", "target", 5e6, "crit", 0.05],
  ["titan", "Titan Strength", "sword", 120e6, "dmg", 2.5],
  ["rifle", "Hero Rifle", "target", 4e9, "heroDmg", 3],
  ["rage", "Rage", "sword", 150e9, "dmg", 3],
  ["deadly", "Deadly Crits", "target", 8e12, "crit", 0.05],
  ["infdmg", "Infinite Power", "sword", 500e12, "dmg", 5],
], {
  powerup: series("str", "Strength", "sword", 3, 3000, 12, "dmg", 1.3),
  crit: series("cdmg", "Crit Power", "target", 2, 20e6, 30, "critDmg", 1),
  rage: series("berserk", "Berserk", "sword", 2, 600e9, 25, "dmg", 2),
});

branch("team", "SW", [
  ["slot1", "Pet Slot", "slots", 600, "slot", 1],
  ["walls", "Village Walls", "shield", 3e3, "villageHp", 0.5],
  ["slot2", "Pet Slot II", "slots", 150e3, "slot", 1],
  ["boots", "Running Shoes", "boot", 600e3, "moveSpeed", 0.2],
  ["walls2", "Stone Walls", "shield", 15e6, "villageHp", 0.5],
  ["slot3", "Pet Power", "paw", 800e6, "dmg", 2],
  ["bond", "Pet Bond", "paw", 30e9, "dmg", 2],
  ["fortress", "Fortress", "shield", 1e12, "villageHp", 1],
], {
  walls: series("tower", "Watchtower", "target", 2, 20e3, 50, "range", 0.15),
  boots: series("sprint", "Sprint", "boot", 2, 2e6, 40, "moveSpeed", 0.15),
  bond: series("pack", "Pack Spirit", "paw", 2, 100e9, 30, "dmg", 1.5),
});

branch("gems", "SE", [
  ["gemfind", "Gem Finder", "gem", 300, "gems", 1],
  ["brewer", "Potion Brewer", "potion", 5e3, "potionPower", 1],
  ["longpot", "Long Potion", "clock", 80e3, "potionTime", 5],
  ["gemhunt", "Gem Hunter", "gem", 2e6, "gems", 1],
  ["strongpot", "Strong Potion", "potion", 60e6, "potionPower", 1],
  ["gemmaster", "Gem Master", "gem", 3e9, "gems", 2],
  ["elixir", "Elixir", "clock", 150e9, "potionTime", 10],
  ["ultpot", "Ultimate Potion", "potion", 10e12, "potionPower", 2],
], {
  longpot: series("thunt", "Treasure Hunter", "gift", 2, 300e3, 30, "chest", 1.5),
  gemmaster: series("gemrain", "Gem Rain", "gem", 2, 10e9, 30, "gems", 1),
});

export const TREE_BY_ID: Record<string, TreeNode> = byId();

/** Pixel position of a node (pointy-top hexagons of the given radius). */
export function hexPos(node: TreeNode, size: number): { x: number; y: number } {
  return { x: size * Math.sqrt(3) * (node.q + node.r / 2), y: size * 1.5 * node.r };
}

/** Short text for what a node does. */
export function effectText(node: TreeNode): string {
  const p = node.per;
  const pct = `${Math.round(p * 100)}%`;
  switch (node.effect) {
    case "start": return "Where it all begins";
    case "luck": return `x${p} luck`;
    case "die": return `x${p} luck + a new die`;
    case "speed": return `Rolls ${pct} faster`;
    case "multi": return "+1 die every roll";
    case "auto": return "Rolls automatically";
    case "cash": return `x${p} money`;
    case "offline": return `+${pct} money while away`;
    case "dmg": return `x${p} team damage`;
    case "heroDmg": return `x${p} hero damage`;
    case "crit": return `+${pct} critical hit chance`;
    case "critDmg": return `+${p}x critical damage`;
    case "slot": return "+1 pet in your team";
    case "villageHp": return `+${pct} health (you and the crystal)`;
    case "moveSpeed": return `+${pct} walking speed`;
    case "range": return `+${pct} attack range`;
    case "gems": return `+${p} gem${p > 1 ? "s" : ""} per boss`;
    case "potionPower": return `+${p}x potion luck`;
    case "potionTime": return `+${p} min potion time`;
    case "chest": return `x${p} treasure chest rewards`;
    case "luckyEvery": return `Lucky roll ${p} rolls sooner`;
    case "luckyPower": return `+${p}x lucky roll luck`;
  }
}
