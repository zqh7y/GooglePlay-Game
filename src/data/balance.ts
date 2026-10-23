/**
 * Difficulty and reward curves, shared by the game and the progression simulator
 * (so tuning here is what players actually get).
 *
 * A stage is a 5 minute survival run: monsters come faster and tougher every minute,
 * and at 5:00 the boss arrives. Kill it to clear the stage.
 */
export const MAX_STAGE = 100;
export const STAGE_MS = 5 * 60 * 1000;
/** the stage timer is shown as 5 marks, one per minute */
export const MINUTES = 5;

/**
 * Monster health grows every stage: very steeply over the first stages (your first good
 * pets do not carry you far), steeply through the first lands, gentler in the middle and
 * steep again in the final land.
 */
export const START_HP_GROWTH = 2.0;
export const EARLY_HP_GROWTH = 1.45;
export const MID_HP_GROWTH = 1.27;
export const LATE_HP_GROWTH = 1.42;
const growthAt = (s: number) => (s < 10 ? START_HP_GROWTH : s < 25 ? EARLY_HP_GROWTH : s < 80 ? MID_HP_GROWTH : LATE_HP_GROWTH);
const HP_TABLE: number[] = [1];
for (let s = 1; s <= MAX_STAGE + 1; s++) HP_TABLE.push(HP_TABLE[s - 1] * growthAt(s));
/** Money from monsters grows by this factor every stage. */
export const CASH_GROWTH = 1.25;
/** Within a stage, monsters get this much tougher every minute. */
export const MINUTE_HP_STEP = 0.3;

/** Damage of one Glock bullet before upgrades (other guns multiply it). */
export const HERO_BASE_DMG = 6;
/** Hero adds this share of the team's pet damage to each bullet. */
export const HERO_TEAM_SHARE = 0.2;
export const HERO_HP = 100;

export const CRYSTAL_HP = 800;
/** The crystal is open for 45 s, then shielded for 45 s, and so on. */
export const SHIELD_MS = 45000;
/** Monsters appear this often (ms) at the start; every minute they come faster. Hordes! */
export const SPAWN_MS = 312;
export const SPAWN_SPEEDUP = 0.35;
export const MAX_MONSTERS = 350;
/** Share of monsters that walk in from far away towards the crystal while it is open. */
export const CRYSTAL_SPAWN_SHARE = 0.4;
/** First airdrop, and time between airdrops. */
export const AIRDROP_FIRST_MS = 25000;
export const AIRDROP_MS = 40000;

export interface MonsterStats {
  hp: number;
  speed: number;
  cash: number;
  /** damage to you on touch, or to the crystal per second */
  dmg: number;
  xp: number;
}

export const WALKER_A: MonsterStats = { hp: 4, speed: 165, cash: 0.1, dmg: 4, xp: 1 };
export const WALKER_B: MonsterStats = { hp: 7, speed: 135, cash: 0.15, dmg: 6, xp: 2 };
export const FLYER: MonsterStats = { hp: 3, speed: 235, cash: 0.1, dmg: 3, xp: 1 };
export const ELITE_MULT = 8;
/** The boss has as much health as a hundred normal monsters (at the end of the stage). */
export const BOSS_HP_MULT = 100;
export const BOSS: MonsterStats = { hp: ((WALKER_A.hp + WALKER_B.hp) / 2) * BOSS_HP_MULT, speed: 120, cash: 60, dmg: 22, xp: 0 };

export const minuteMult = (minute: number) => 1 + MINUTE_HP_STEP * minute;
export const monsterHp = (base: number, stage: number, minute: number) => base * HP_TABLE[Math.max(0, stage - 1)] * minuteMult(minute);
export const monsterCash = (base: number, stage: number) => base * CASH_GROWTH ** (stage - 1);
/** Time between spawns at this point of the stage. */
export const spawnGap = (minute: number) => SPAWN_MS / (1 + SPAWN_SPEEDUP * minute);

/** XP needed to go from `level` to the next one (a good run reaches ~22: four skills at level 5). */
export const xpFor = (level: number) => 10 + level * 6;
