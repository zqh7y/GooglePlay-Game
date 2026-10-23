import { BOSS, MAX_STAGE, monsterHp } from "./balance";

/**
 * Twenty bosses, a new one every 5 stages (four in each land). The same bosses guard the
 * stages and line up in the Boss Rush.
 */
export interface BossDef {
  id: string;
  name: string;
  tex: string;
  color: number;
}

export const BOSSES: BossDef[] = [
  { id: "slimeking", name: "Slime King", tex: "b_slimeking", color: 0x7fd35a },
  { id: "mushtitan", name: "Mushroom Titan", tex: "b_mushtitan", color: 0xe8434f },
  { id: "batqueen", name: "Bat Queen", tex: "b_batqueen", color: 0x8a5ad0 },
  { id: "golem", name: "Stone Golem", tex: "e_golem", color: 0xa8adb8 },
  { id: "scarecrow", name: "Scarecrow", tex: "b_scarecrow", color: 0xc89a4a },
  { id: "thundercrow", name: "Thunder Crow", tex: "b_thundercrow", color: 0xffe066 },
  { id: "haybrute", name: "Haystack Brute", tex: "b_haybrute", color: 0xe8c860 },
  { id: "pumpking", name: "Pumpkin King", tex: "e_pumpking", color: 0xff8a2a },
  { id: "sporemother", name: "Spore Mother", tex: "b_sporemother", color: 0x3fd0e8 },
  { id: "shadowwolf", name: "Shadow Wolf", tex: "b_shadowwolf", color: 0x6a4ab0 },
  { id: "mosstroll", name: "Moss Troll", tex: "b_mosstroll", color: 0x7a9a4a },
  { id: "treant", name: "Old Treant", tex: "e_treant", color: 0x4fae3a },
  { id: "mummy", name: "Mummy Pharaoh", tex: "b_mummy", color: 0xe8dcc0 },
  { id: "sandworm", name: "Sand Worm", tex: "b_sandworm", color: 0xd9a26a },
  { id: "cactus", name: "Cactus Colossus", tex: "b_cactus", color: 0x5fb84a },
  { id: "scorpion", name: "Sand Scorpion", tex: "e_scorpion", color: 0xd9a24a },
  { id: "penguin", name: "Penguin Emperor", tex: "b_penguin", color: 0x2a3a5a },
  { id: "icegolem", name: "Ice Golem", tex: "b_icegolem", color: 0x9fdcf4 },
  { id: "yeti", name: "Frost Yeti", tex: "e_yeti", color: 0xf2f6ff },
  { id: "frostdragon", name: "Frost Dragon", tex: "b_frostdragon", color: 0x8fd8ff },
];

/** A different boss every this many stages. */
export const BOSS_EVERY = 5;
export const bossForStage = (stage: number) => BOSSES[Math.min(BOSSES.length - 1, Math.floor((Math.max(1, stage) - 1) / BOSS_EVERY))];

// ───────────────────────── Boss Rush ─────────────────────────

/** Seconds you get to beat each boss in the Boss Rush. */
export const RUSH_MS = 15000;
/** Boss Rush bosses: one per stage, 1 to 100. */
export const RUSH_BOSSES = MAX_STAGE;
/** Rush bosses are much smaller than the stage bosses: no skills or airdrops to help you. */
export const RUSH_HP_MULT = 0.045;
export const rushBossHp = (n: number) => Math.round(monsterHp(BOSS.hp, Math.min(n, MAX_STAGE), 0) * RUSH_HP_MULT);
