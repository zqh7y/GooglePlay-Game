/**
 * Difficulty and reward curves, shared by the game and the progression simulator
 * (so tuning here is what players actually get).
 */
export const WAVES_PER_STAGE = 5;
export const MAX_STAGE = 100;

/**
 * Monster health grows every stage: steeply in the first lands (so early pets do not
 * carry you too far), gentler in the middle, and steep again in the final land.
 */
export const EARLY_HP_GROWTH = 1.5;
export const MID_HP_GROWTH = 1.32;
export const LATE_HP_GROWTH = 1.45;
const growthAt = (s: number) => (s < 25 ? EARLY_HP_GROWTH : s < 80 ? MID_HP_GROWTH : LATE_HP_GROWTH);
const HP_TABLE: number[] = [1];
for (let s = 1; s <= MAX_STAGE + 1; s++) HP_TABLE.push(HP_TABLE[s - 1] * growthAt(s));
/** Money from monsters grows by this factor every stage. */
export const CASH_GROWTH = 1.25;
/** Later waves of a stage are a bit tougher. */
export const WAVE_HP_STEP = 0.12;

export const HERO_BASE_DMG = 6;
/** Hero adds this share of the team's pet damage to each shot. */
export const HERO_TEAM_SHARE = 0.2;
export const HERO_FIRE_MS = 420;

export const VILLAGE_HP = 100;
/** Time between monsters appearing, in ms. */
export const SPAWN_MIN = 650;
export const SPAWN_MAX = 1050;

export interface MonsterStats {
  hp: number;
  speed: number;
  cash: number;
  dmg: number;
}

export const WALKER_A: MonsterStats = { hp: 14, speed: 82, cash: 2, dmg: 2 };
export const WALKER_B: MonsterStats = { hp: 25, speed: 64, cash: 3, dmg: 3 };
export const FLYER: MonsterStats = { hp: 10, speed: 125, cash: 2, dmg: 2 };
export const BOSS: MonsterStats = { hp: 450, speed: 46, cash: 60, dmg: 15 };

export const monsterHp = (base: number, stage: number, wave: number) => base * HP_TABLE[Math.max(0, stage - 1)] * (1 + WAVE_HP_STEP * (wave - 1));
export const monsterCash = (base: number, stage: number) => base * CASH_GROWTH ** (stage - 1);

/** How many monsters a wave sends (the boss wave sends a boss plus minions). */
export const waveSize = (stage: number, wave: number) => (wave === WAVES_PER_STAGE ? 10 : 14 + wave * 3 + Math.floor(((stage - 1) % 20) / 3));
