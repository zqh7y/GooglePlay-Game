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
export const MID_HP_GROWTH = 1.25;
export const LATE_HP_GROWTH = 1.36;
const growthAt = (s: number) => (s < 10 ? START_HP_GROWTH : s < 25 ? EARLY_HP_GROWTH : s < 80 ? MID_HP_GROWTH : LATE_HP_GROWTH);
const HP_TABLE: number[] = [1];
for (let s = 1; s <= MAX_STAGE + 1; s++) HP_TABLE.push(HP_TABLE[s - 1] * growthAt(s));
/** Money from monsters grows by this factor every stage. */
export const CASH_GROWTH = 1.25;
/** Within a stage, monsters get this much tougher every minute. */
export const MINUTE_HP_STEP = 0.3;

export const HERO_BASE_DMG = 6;
/** Hero adds this share of the team's pet damage to each shot. */
export const HERO_TEAM_SHARE = 0.2;
export const HERO_FIRE_MS = 420;
export const HERO_HP = 100;

export const CRYSTAL_HP = 250;
/** Monsters appear this often (ms) at the start; every minute they come faster. */
export const SPAWN_MS = 1250;
export const SPAWN_SPEEDUP = 0.5;
export const MAX_MONSTERS = 140;
/** Share of monsters that go for the crystal instead of you. */
export const RAIDER_SHARE = 0.3;

export interface MonsterStats {
  hp: number;
  speed: number;
  cash: number;
  /** damage to you on touch, or to the crystal per second */
  dmg: number;
  xp: number;
}

export const WALKER_A: MonsterStats = { hp: 10, speed: 165, cash: 0.4, dmg: 6, xp: 1 };
export const WALKER_B: MonsterStats = { hp: 18, speed: 135, cash: 0.6, dmg: 9, xp: 2 };
export const FLYER: MonsterStats = { hp: 7, speed: 235, cash: 0.4, dmg: 5, xp: 1 };
export const ELITE_MULT = 4;
export const BOSS: MonsterStats = { hp: 700, speed: 120, cash: 60, dmg: 25, xp: 30 };

export const minuteMult = (minute: number) => 1 + MINUTE_HP_STEP * minute;
export const monsterHp = (base: number, stage: number, minute: number) => base * HP_TABLE[Math.max(0, stage - 1)] * minuteMult(minute);
export const monsterCash = (base: number, stage: number) => base * CASH_GROWTH ** (stage - 1);
/** Time between spawns at this point of the stage. */
export const spawnGap = (minute: number) => SPAWN_MS / (1 + SPAWN_SPEEDUP * minute);

/** XP needed to go from `level` to the next one. */
export const xpFor = (level: number) => 6 + level * 5;
