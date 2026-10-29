import { BOSS, MAX_STAGE, monsterHp } from "./balance";

/**
 * Boss moves. Every boss walks at you and, every few seconds, does one of its three moves;
 * each one shows where it will land first (red marks, circles or a cone) so you can dodge.
 */
export type BossMoveId = "charge" | "stomp" | "rocks" | "jump" | "ring" | "volley" | "summon" | "spin" | "rain" | "blink" | "burrow" | "breath";

export const BOSS_MOVES: Record<BossMoveId, string> = {
  charge: "Charge",
  stomp: "Stomp",
  rocks: "Rock Throw",
  jump: "Jump Slam",
  ring: "Bullet Ring",
  volley: "Aimed Shots",
  summon: "Call Minions",
  spin: "Spin Attack",
  rain: "Sky Rain",
  blink: "Teleport",
  burrow: "Burrow",
  breath: "Breath",
};

/**
 * Every boss's own SPECIAL: an attack that reaches you anywhere on the map (running away doesn't
 * help, it gets used more when you are far). Each shows its danger first, then you must dodge.
 */
export type SpecialId =
  | "goo" | "spores" | "bats" | "quake" | "crows" | "thunder" | "hay" | "pumpkins" | "toxic" | "pounce"
  | "boulders" | "roots" | "curse" | "quicksand" | "needles" | "snipe" | "slide" | "icegrid" | "avalanche" | "nova";

export const BOSS_SPECIALS: Record<SpecialId, string> = {
  goo: "Goo Storm", spores: "Spore Burst", bats: "Bat Swarm", quake: "Earthquake", crows: "Crow Dive",
  thunder: "Thunder Chase", hay: "Hay Rollers", pumpkins: "Pumpkin Bombs", toxic: "Toxic Ring", pounce: "Shadow Pounce",
  boulders: "Boulder Roll", roots: "Root Burst", curse: "Curse Cross", quicksand: "Quicksand", needles: "Needle Spiral",
  snipe: "Tail Snipe", slide: "Belly Slide", icegrid: "Icicle Grid", avalanche: "Avalanche", nova: "Frost Nova",
};

export interface BossDef {
  id: string;
  name: string;
  tex: string;
  color: number;
  moves: [BossMoveId, BossMoveId, BossMoveId];
  special: SpecialId;
}

/**
 * Twenty bosses, a new one every 5 stages (four in each land). The same bosses guard the
 * stages and line up in the Boss Rush.
 */
export const BOSSES: BossDef[] = [
  { id: "slimeking", name: "Slime King", tex: "b_slimeking", color: 0x7fd35a, moves: ["jump", "summon", "ring"], special: "goo" },
  { id: "mushtitan", name: "Mushroom Titan", tex: "b_mushtitan", color: 0xe8434f, moves: ["stomp", "ring", "summon"], special: "spores" },
  { id: "batqueen", name: "Bat Queen", tex: "b_batqueen", color: 0x8a5ad0, moves: ["charge", "summon", "volley"], special: "bats" },
  { id: "golem", name: "Stone Golem", tex: "e_golem", color: 0xa8adb8, moves: ["stomp", "rocks", "jump"], special: "quake" },
  { id: "scarecrow", name: "Scarecrow", tex: "b_scarecrow", color: 0xc89a4a, moves: ["summon", "spin", "rain"], special: "crows" },
  { id: "thundercrow", name: "Thunder Crow", tex: "b_thundercrow", color: 0xffe066, moves: ["charge", "rain", "volley"], special: "thunder" },
  { id: "haybrute", name: "Haystack Brute", tex: "b_haybrute", color: 0xe8c860, moves: ["spin", "stomp", "rocks"], special: "hay" },
  { id: "pumpking", name: "Pumpkin King", tex: "e_pumpking", color: 0xff8a2a, moves: ["jump", "ring", "summon"], special: "pumpkins" },
  { id: "sporemother", name: "Spore Mother", tex: "b_sporemother", color: 0x3fd0e8, moves: ["ring", "rain", "summon"], special: "toxic" },
  { id: "shadowwolf", name: "Shadow Wolf", tex: "b_shadowwolf", color: 0x6a4ab0, moves: ["charge", "blink", "spin"], special: "pounce" },
  { id: "mosstroll", name: "Moss Troll", tex: "b_mosstroll", color: 0x7a9a4a, moves: ["stomp", "rocks", "jump"], special: "boulders" },
  { id: "treant", name: "Old Treant", tex: "e_treant", color: 0x4fae3a, moves: ["rain", "summon", "stomp"], special: "roots" },
  { id: "mummy", name: "Mummy Pharaoh", tex: "b_mummy", color: 0xe8dcc0, moves: ["blink", "ring", "summon"], special: "curse" },
  { id: "sandworm", name: "Sand Worm", tex: "b_sandworm", color: 0xd9a26a, moves: ["burrow", "rocks", "ring"], special: "quicksand" },
  { id: "cactus", name: "Cactus Colossus", tex: "b_cactus", color: 0x5fb84a, moves: ["ring", "jump", "stomp"], special: "needles" },
  { id: "scorpion", name: "Sand Scorpion", tex: "e_scorpion", color: 0xd9a24a, moves: ["charge", "volley", "burrow"], special: "snipe" },
  { id: "penguin", name: "Penguin Emperor", tex: "b_penguin", color: 0x2a3a5a, moves: ["charge", "summon", "rain"], special: "slide" },
  { id: "icegolem", name: "Ice Golem", tex: "b_icegolem", color: 0x9fdcf4, moves: ["stomp", "rain", "breath"], special: "icegrid" },
  { id: "yeti", name: "Frost Yeti", tex: "e_yeti", color: 0xf2f6ff, moves: ["jump", "rocks", "charge"], special: "avalanche" },
  { id: "frostdragon", name: "Frost Dragon", tex: "b_frostdragon", color: 0x8fd8ff, moves: ["breath", "rain", "charge"], special: "nova" },
];

/** A different boss every this many stages. */
export const BOSS_EVERY = 5;
export const bossForStage = (stage: number) => BOSSES[Math.min(BOSSES.length - 1, Math.floor((Math.max(1, stage) - 1) / BOSS_EVERY))];

// ───────────────────────── Boss Rush ─────────────────────────

/** Seconds you get to beat each boss in the Boss Rush. */
export const RUSH_MS = 15000;

/**
 * Boss Rush boss n guards stage n: beating it moves you on to stage n + 1, so it has to be about as hard
 * as clearing the stage. Its health is a share of the stage boss's health (stage -> share, in between it
 * slides), tuned with the simulator (dev/sim.ts): the rush and normal runs each clear about half the stages.
 * A team that got strong catches up fast, but the rush does not push you far past what you can survive
 * in a normal run. A starter team can beat boss 1; past stage 40 normal runs send twice the monsters, so
 * the rush bosses get about twice as tough there too.
 */
const RUSH_HP_MULT: [number, number][] = [[1, 0.45], [3, 1.65], [6, 0.85], [9, 0.3], [38, 0.3], [44, 0.68], [MAX_STAGE, 0.68]];
const rushHpMult = (n: number) => {
  const i = RUSH_HP_MULT.findIndex(([s]) => s >= n);
  if (i <= 0) return RUSH_HP_MULT[0][1];
  const [s0, m0] = RUSH_HP_MULT[i - 1];
  const [s1, m1] = RUSH_HP_MULT[i];
  return m0 * (m1 / m0) ** ((n - s0) / (s1 - s0));
};
export const rushBossHp = (n: number) => Math.round(monsterHp(BOSS.hp, Math.min(n, MAX_STAGE), 0) * rushHpMult(n));
