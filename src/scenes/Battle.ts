import Phaser from "phaser";
import { HERO_HAND } from "../art/characters";
import { INK_N, canvasTexture, lighten, rgba } from "../art/draw";
import { GROUND_SCALE, PATCH_R, makeGround } from "../art/ground";
import { makeGadgetTextures } from "../art/gadgets";
import { makeComicTextures } from "../art/comic";
import { makeModeTextures } from "../art/modes";
import { makeBeastTextures } from "../art/beast";
import {
  AIR_EVERY, AIR_PREVIEW, AIR_SECS, BIG_BOSS_HP, BOSS_KIDS, FEEDS, FEED_EVERY, FEED_FIRST, FRIEND_BOSS_HP, HUNGER_MS, KID_HP, MODE_INFO, StageMode, modeForStage, stageInfo,
} from "../data/modes";
import { petTexture } from "../art/pets";
import { makePickupTextures } from "../art/pickups";
import { crystalKey, makeWorldTextures } from "../art/world";
import {
  AIRDROP_FIRST_MS, AIRDROP_MS, BATTLE_BOSS_MULT, BOSS, BOSS_HEAL, CRYSTAL_DIE_MS, HEALING_BOSS_HP, SEALS, SEAL_MS, CRYSTAL_HP, ELITE_MULT, crystalHpAt, raiderShare, FLYER, HERO_BASE_DMG, HERO_HP, HERO_TEAM_SHARE, heroHpAt,
  MAX_MONSTERS, MAX_STAGE, MINUTES, MonsterStats, SHIELD_MS, STAGE_MS, WALKER_A, WALKER_B, monsterCash, monsterHp, spawnGap, xpFor,
} from "../data/balance";
import {
  GADGETS, GADGET_KINDS, GADGET_SLOTS, GadgetBase, GadgetKind, MAX_GADGET_LEVEL, STARTER_GADGET, gadgetKey, gadgetName, gadgetStats,
} from "../data/gadgets";
import { ITEMS, ItemDef, PET_LIST, levelMult } from "../data/items";
import { REGIONS, Region, regionForStage } from "../data/regions";
import { CRYSTAL_SKILLS, SKILLS, SKILL_BY_ID, SKILL_SLOTS, SkillId, skillChoices } from "../data/skills";
import { MUTATION_BY_ID, MutationId, rollMutations } from "../data/mutations";
import { makeMutationTextures } from "../art/mutations";
import { bossFrame, bossFrames, makeBossTextures } from "../art/bosses";
import { walkKey } from "../art/characters";
import { makeBossFxTextures, orbTexture } from "../art/bossfx";
import { makePlaceTextures } from "../art/places";
import { makeStoryTextures } from "../art/story";
import { makeSeaTextures } from "../art/sea";
import { HUNT_DICE, LANTERN_AT, PATH_BOSSES, StoryChapter, storyFor } from "../data/story";
import { Night } from "../game/night";
import { SPEED_BTN } from "../devtools";
import { BOSS_EVERY, BOSS_MOVES, BOSS_SPECIALS, BossMoveId, RUSH_MS, SpecialId, bossForStage, rushBossHp } from "../data/bosses";
import { DICE_TIERS, GADGET_TIERS, TIER_INFO, Tier, rollDiceTier, rollGadgetTier, tierIndex } from "../data/tiers";
import { ARENA, Arena, EDGE, PATH_HALF, clampX, clampY, getArena, getOceanArena, getPathArena, getSeaArena } from "../game/arena";
import { GAME_W, Layout, layoutFor } from "../layout";
import { RAIN_WIN_DROPS, dodgeDrops } from "../data/diceEvent";
import { questEvent } from "../systems/goals";
import { hasPass, persist, save, stageCap } from "../systems/save";
import { buzz, music, sfx } from "../systems/sound";
import { applyShake, effectsOn } from "../systems/settings";
import {
  cashMult, chestMult, critChance, critDamage, dmgMult, gadgetTierCap, gemsPerBoss, heroDmgMult, moveSpeedMult, petSlots, rangeMult, villageHpMult,
} from "../systems/stats";
import { rarityRank } from "../data/rarity";
import { fmt, oneIn } from "../ui/format";
import { classText } from "../ui/classText";
import { drawBar, fitText, text } from "../ui/widgets";
import type { Goal } from "../ui/goalPins";

/** The camera shows 1.66x more of the field during a fight (a bit closer in the lobby). */
const ZOOM = 1 / 1.66;
/** Everything drawn over the world (effects, bars, numbers, storm) sits above this, so even the
 * long story paths (whose ground objects take their y as depth) stay underneath. */
const TOP = 100000;
/** the story's big boss (stage 4) is this much tougher than a Boss Battle's big boss: you start maxed out */
const BIG_STORY_BOSS = 5;
/** the sea stage: 3:00 of attacks before the tsunami */
const SEA_MS = 180000;
/** Land Ho!: time to find the big island */
const OCEAN_MS = 240000;

/** A tsunami wave: the wall of water and the shadow it throws ahead; `side` is where it comes from (0 top, 1 bottom, 2 left, 3 right). */
interface Wave {
  wall: Phaser.GameObjects.TileSprite;
  shade: Phaser.GameObjects.Image;
  side: number;
  len: number;
}
const LOBBY_ZOOM = 0.85;
const HERO_SPEED = 390;
/** Pets run after monsters this far from you, and come back if you get farther away. */
const PET_LEASH = 1000;
const PET_SPEED = 520;
const HERO_R = 40;
/** Dice Rain: how often each tier of falling die shows up */
const RAIN_TIERS: [Tier, number][] = [["A", 40], ["B", 25], ["C", 15], ["D", 9], ["E", 6], ["S", 3], ["SSS", 1.5], ["uSSS", 0.5]];
const pickWeighted = <T,>(list: [T, number][]): T => {
  let r = Math.random() * list.reduce((t, [, w]) => t + w, 0);
  for (const [v, w] of list) if ((r -= w) <= 0) return v;
  return list[0][0];
};
/** The safe air square: two thirds as wide as the old 10%-of-the-map zone. */
const AIR_ZONE = Math.round((ARENA * Math.sqrt(0.1) * 2) / 3);
const PICK_R = 210;
/** While the crystal is open, monsters this close to you go for you instead. */
const AGGRO = 420;
/** Crystal raiders keep marching on the crystal unless you get right in their way (or the shield is up). */
const RAIDER_AGGRO = 140;
/** Kills in a row: the streak lasts while each kill comes within STREAK_MS of the last; every STREAK_STEP kills add +1%. */
const STREAK_MS = 3000;
const STREAK_STEP = 50;
const REVIVE_GEMS = 5;
/** Boss Rush plays slower: you and the bosses move this many times slower */
const RUSH_SLOW = 1.5;
/** Stand this close to a boss seal to close it; seals glow up when you are within SEAL_SEE. */
/** Boss breath: a cone this long and this wide (half-angle, radians). */
const BREATH_LEN = 700;
const BREATH_HALF = 0.45;
const SEAL_R = 130;
const SEAL_SEE = 900;
/** Free roam in the lobby: ROAM_START dice to begin with, then one every ROAM_DICE_MS, up to ROAM_MAX lying around. */
const ROAM_START = 6;
const ROAM_DICE_MS = 15000;
const ROAM_MAX = 15;
export type FightKind = "battle" | "rush" | "event";

export type BattleMode = "lobby" | "run" | "over";

export interface RunStats {
  kills: number;
  damage: number;
  shots: number;
  earned: number;
  airdrops: number;
  hurt: number;
  crystalHurt: number;
  dice: Record<Tier, number>;
}

/** A shuffled copy. */
function shuffle<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const noDice = () => Object.fromEntries(DICE_TIERS.map((t) => [t, 0])) as Record<Tier, number>;
const freshStats = (): RunStats => ({ kills: 0, damage: 0, shots: 0, earned: 0, airdrops: 0, hurt: 0, crystalHurt: 0, dice: noDice() });

/** Live numbers the HUD (UI scene) reads. */
export const battle = {
  mode: "lobby" as BattleMode,
  /** ms survived this stage */
  time: 0,
  bossFrac: -1,
  crystal: 1,
  hp: 1,
  level: 1,
  xp: 0,
  dps: 0,
  /** kills in a row (each one within STREAK_MS of the last) */
  streak: 0,
  /** a level-up skill choice is open */
  choosing: false,
  shielded: false,
  /** ms until the shield goes up or down */
  shieldLeft: SHIELD_MS,
  /** the gadgets you carry (up to three) */
  gadgets: [] as GadgetSlot[],
  skills: {} as Partial<Record<SkillId, number>>,
  stats: freshStats(),
  /** the boss has taken the crystal: it is just you, your pets and the boss */
  bossFight: false,
  /** Boss Rush: one boss after another, 15 s each */
  rush: false,
  rushBoss: 0,
  rushLeft: 0,
  /** boss seals closed / placed this fight */
  seals: 0,
  sealsTotal: 0,
  /** this stage's mode, and what the HUD shows instead of the crystal in the other modes */
  stageMode: "crystal" as StageMode,
  /** a story chapter's clock: its time limit and the time left (ms; 0 / -1 when there is none) */
  limit: 0,
  left: -1,
  /** on a long story path (no minimap) */
  path: false,
  /** developer x3: how fast the fight runs */
  speed: 1,
  /** developer: where the next fight starts (the beginning, the middle, near the end, the boss) */
  devJump: "start" as "start" | "mid" | "end" | "boss",
  goal: null as { frac: number; text: string; color: number; icon: string; alarm: boolean } | null,
};

/** How a Boss Rush ended. */
export interface RushResult {
  reason: "time" | "hero" | "done" | "quit";
  /** the boss you will fight next time */
  next: number;
  beaten: number;
  earned: number;
  gems: number;
  dice: Record<Tier, number>;
}

export interface StageResult {
  stage: number;
  reason: "hero" | "crystal" | "quit" | "time" | "beast";
  time: number;
  stats: RunStats;
  canRevive: boolean;
  reviveGems: number;
}

/** A gadget you carry: its kind, tier and level, and when it fires next. */
export interface GadgetSlot {
  kind: GadgetKind;
  tier: Tier;
  level: number;
  timer: number;
  /** the wait after its last shot (the HUD draws the cooldown sweep from it) */
  cd: number;
}

/** A gadget offered on level up: a new kind, the next level, or the next tier of one you carry. */
export interface GadgetOption {
  what: "new" | "level" | "tier";
  kind: GadgetKind;
  tier: Tier;
  level: number;
}

interface EnemyType {
  tex: string;
  stats: MonsterStats;
  flying?: boolean;
  boss?: boolean;
  fx: number;
  /** a boss's three special moves */
  moves?: BossMoveId[];
  /** its own SPECIAL that reaches you anywhere (main bosses only) */
  special?: SpecialId;
}

interface Enemy {
  img: Phaser.GameObjects.Image;
  type: EnemyType;
  hp: number;
  maxHp: number;
  cash: number;
  xp: number;
  dmg: number;
  r: number;
  elite: boolean;
  aura?: Phaser.GameObjects.Image;
  /** a boss's move warning (a lane, zone, cone...) */
  tele?: Phaser.GameObjects.Image;
  /** walk frames: moved this frame, and a time offset so a crowd doesn't step in sync */
  moving: boolean;
  seed: number;
  flashUntil: number;
  atkTimer: number;
  /** heading for the crystal right now */
  toCrystal: boolean;
  /** once a monster goes for you (shield up, or you came close) it keeps hunting you */
  huntHero: boolean;
  /** a crystal raider: it goes for the crystal whenever the shield is down */
  raider: boolean;
  attacking: boolean;
  /** what a boss is doing: walking, or one of its moves (see bossMove) */
  phase: "walk" | "windup" | "dash" | "stomp" | "throw" | "ring" | "volley" | "summon" | "spin" | "rain" | "jump" | "blink" | "burrow" | "rise" | "breath" | "cast";
  phaseT: number;
  /** shots left in a ring or volley (or dashes left in a chain) */
  shots: number;
  /** moves done so far (every third one is the special), and the current dash's speed, length and wind-up */
  casts: number;
  dashV: number;
  dashMs: number;
  dashWind: number;
  tickT: number;
  dashX: number;
  dashY: number;
  /** mutations (see data/mutations.ts) and their state */
  muts: MutationId[];
  badge?: Phaser.GameObjects.Image;
  speedMult: number;
  lives: number;
  blinkT: number;
  ghostT: number;
  phased: boolean;
  /** held in a bubble until then */
  stunUntil: number;
}

interface Pet {
  def: ItemDef;
  id: string;
  level: number;
  img: Phaser.GameObjects.Image;
  timer: number;
  ox: number;
  oy: number;
  frame: number;
  frameT: number;
  /** the monster this pet is running after */
  target: Enemy | null;
  retarget: number;
  /** "Name 1 in N" over its head */
  odds: Phaser.GameObjects.Text;
  hp: number;
  maxHp: number;
  hurtAt: number;
  /** knocked out: ms until it gets back up */
  down: number;
}

/** Homing things: pet orbs and bombs, crystal shards. */
interface Shot {
  img: Phaser.GameObjects.Image;
  target: Enemy;
  tx: number;
  ty: number;
  dmg: number;
  speed: number;
  splash: number;
}

/** Thrown gadgets (shuriken, pet stars) fly straight and hit whatever they touch. */
interface Bullet {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  pierce: number;
  explode: number;
  /** share of the damage the blast does */
  splash: number;
  hit: Enemy[];
  /** thrown stars spin */
  spin: number;
  /** water balloons pop where they land even if they hit nothing */
  burst?: boolean;
  /** color of the glowing trail it leaves */
  trail?: number;
  /** a soft glow that travels with it */
  glow?: Phaser.GameObjects.Image;
}

/** Rocks the boss throws at you. */
/** How a danger zone hits: what (if anything) falls on it, and what it looks like when it lands. */
type StrikeStyle = "slam" | "goo" | "thunder" | "pumpkin" | "ice" | "rock" | "root" | "toxic" | "sand" | "magic";
type ImpactKind = "dust" | "splat" | "bolt" | "blast" | "ice" | "rock" | "root";
const STRIKE_LOOK: Record<StrikeStyle, { color: number; fall?: string; impact: ImpactKind }> = {
  slam: { color: 0xff4a3a, impact: "dust" },
  goo: { color: 0x7fd35a, fall: "bp_goo", impact: "splat" },
  thunder: { color: 0xffd23f, impact: "bolt" },
  pumpkin: { color: 0xff8a2a, fall: "bp_pumpkin", impact: "blast" },
  ice: { color: 0x8fd8ff, fall: "bp_icicle", impact: "ice" },
  rock: { color: 0xff7a3a, impact: "rock" },
  root: { color: 0x7ad651, impact: "root" },
  toxic: { color: 0xb04aff, impact: "splat" },
  sand: { color: 0xe8b060, impact: "rock" },
  magic: { color: 0xd04aff, fall: "orb", impact: "blast" },
};

/** A danger zone on the ground that hits when its time comes. */
interface Strike {
  x: number;
  y: number;
  r: number;
  at: number;
  ms: number;
  dmg: number;
  style: StrikeStyle;
  color: number;
  /** its warning (and whatever is falling on it) */
  objs: Phaser.GameObjects.GameObject[];
}

interface Rock {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  /** hit radius (default 60) */
  r?: number;
  /** turns toward you this many radians a second */
  home?: number;
  /** ms it waits (showing its aim line) before it flies; `track` keeps aiming at you while it waits */
  wait?: number;
  track?: boolean;
  bounce?: boolean;
  speed?: number;
  /** turned to where it flies (else it spins `spin` per second) */
  face?: boolean;
  spin?: number;
  /** flapping: textures it cycles through */
  frames?: string[];
  glow?: Phaser.GameObjects.Image;
  /** the red lane it shows while it waits */
  aim?: Phaser.GameObjects.Image;
}

/** A beam lane: red first, then it fires along its whole length. */
interface Lane {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  at: number;
  ms: number;
  dmg: number;
  color: number;
  obj: Phaser.GameObjects.Container;
}

type PickKind = "dice" | "heart" | "magnet" | "bomb" | "freeze" | "orb" | "chest" | "airdrop";
type ItemKind = Exclude<PickKind, "dice">;

interface Pickup {
  kind: PickKind;
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  /** dropped items vanish after a while; placed ones stay */
  until: number;
  tier?: Tier;
  gadget?: { kind: GadgetKind; tier: Tier };
  /** airdrops can be opened once they have landed */
  ready: boolean;
  extra: Phaser.GameObjects.GameObject[];
  /** one of the village's lost dice (the dice hunt counts them) */
  quest?: boolean;
}

/** A rune circle on the ground: stand on it to close it and cut the boss's healing. */
interface Seal {
  x: number;
  y: number;
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  /** ms stood on it so far */
  t: number;
  done: boolean;
}

interface Food {
  img: Phaser.GameObjects.Image;
  value: number;
  pulled: boolean;
  speed: number;
}

const PET_SPOTS = [[-150, 30], [150, 30], [0, 140]];
/** Pets get knocked out for this long when their health runs out. */
const PET_DOWN_MS = 8000;
const PET_SCALE = 0.7;
const NO_JOY = { active: false, id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
const BUCKET = 600;
const POWERUPS: ItemKind[] = ["heart", "magnet", "bomb", "freeze"];
const PICK_TEX: Record<ItemKind, string> = {
  heart: "pk_heart", magnet: "pk_magnet", bomb: "pk_bomb", freeze: "pk_freeze", orb: "skill_orb", chest: "chest", airdrop: "airdrop",
};
const PICK_GLOW: Record<ItemKind, number> = {
  heart: 0xff6a8a, magnet: 0x8a9aff, bomb: 0xffa64d, freeze: 0x8ae6ff, orb: 0xffe066, chest: 0xffd23f, airdrop: 0xffffff,
};
/** Bones for small monsters, meat for big ones, a ham for elites. */
const FOOD_TEX = (v: number) => (v >= 6 ? "xp_ham" : v >= 2 ? "xp_meat" : "xp_bone");

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * One stage. In the lobby the hero waits by the crystal; once you press BATTLE you have to
 * survive 5 minutes while monsters come faster and tougher every minute, keep the crystal
 * alive (it is shielded every other 45 s), grab guns from airdrops, then beat the boss.
 */
export class BattleScene extends Phaser.Scene {
  private L!: Layout;
  private land!: Region;
  private arena!: Arena;
  private hero!: Phaser.GameObjects.Image;
  /** the main gadget, held in the hero's hand */
  private handImg!: Phaser.GameObjects.Image;
  /** the gadget shown in the hand (the last one that fired), its aim and the kick of the last shot */
  private handKind: GadgetKind = STARTER_GADGET;
  private handAim = 0;
  private handKick = 0;
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter;
  private trailTick = 0;
  private crystal!: Phaser.GameObjects.Image;
  /** this stage's mode (see data/modes.ts) */
  private stageMode: StageMode = "crystal";
  /** a Dice Rain event run: does not change your stage, pays the event prize */
  private eventRun = false;
  private air!: { zone: Phaser.GameObjects.Graphics | null; next: Phaser.GameObjects.Graphics | null; x: number; y: number; nx: number; ny: number; t: number; oxygen: number; choke: number };
  private beast!: {
    img: Phaser.GameObjects.Image; cage: Phaser.GameObjects.Image; bar: Phaser.GameObjects.Graphics; tex: string;
    hunger: number; fed: number; foodAt: number; food: Phaser.GameObjects.Image | null; carried: boolean;
    friend: boolean; escaped: boolean; stompT: number;
    /** the cage's back half, the rune ring, the glow behind the beast; timers for its moods */
    back: Phaser.GameObjects.Image; runes: Phaser.GameObjects.Image; aura: Phaser.GameObjects.Image; moodT: number; dustT: number;
  } | null;
  /** Air Zone poison: two drifting fog layers masked round the zone, and the mask */
  private fogLayers: Phaser.GameObjects.TileSprite[] = [];
  private fogMask: Phaser.GameObjects.Graphics | null = null;
  private coughT = 0;
  private rain!: { t: number; dodged: number; drops: number };
  /** the wooden board where the crystal used to stand in the lobby: next stage and its mode */
  private stageSign: Phaser.GameObjects.Container | null = null;
  /** mode props (signs, pillars, bubbles) to clear when the zone moves */
  private airFx: Phaser.GameObjects.GameObject[] = [];
  private feedSign: Phaser.GameObjects.Container | null = null;
  /** Air Zone: poison fog over everything outside the zone, and how dizzy you are (0..1) */
  private fog: Phaser.GameObjects.Graphics | null = null;
  private fogPuffs: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private dizzy = 0;
  private dizzyCam = false;
  /** Air Zone: bubbles of air out in the fog (grab one for +35% air) */
  private airBubbles: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; life: number }[] = [];
  private airBubT = 4000;
  /** Feed the Beast: the thought bubble over the cage */
  private beastThought: Phaser.GameObjects.Container | null = null;
  private roarT = 0;
  private dizzyStars: Phaser.GameObjects.Image[] = [];
  private vignette: Phaser.FX.Vignette | null = null;
  /** the story chapter this run plays (stages 1-5), its night, and the lights that cut through it */
  private story: StoryChapter | null = null;
  private night: Night | null = null;
  private lamps: { x: number; y: number; r: number }[] = [];
  /** your lantern: lying on the path until you find it, then in your hand */
  private lantern: Phaser.GameObjects.Image[] | null = null;
  private hasLantern = false;
  private heldLantern: Phaser.GameObjects.Image | null = null;
  private heroGlow: Phaser.GameObjects.Image | null = null;
  /** story paths: when the bosses still to come drop in (ms) */
  private pathBosses: number[] = [];
  private pathCullT = 0;
  /** path bosses and when they landed (they charge in bursts) */
  private pathChargers = new Map<Enemy, number>();
  /** the village's dice hunt: how many found */
  private huntFound = 0;
  /** story clock (the big boss's 3:00 counts from when it lands) */
  private storyClock = 0;
  private bigBoss: Enemy | null = null;
  private speedNow = 1;
  /** night-only warm glows (shown when a story fight starts), and whether the village is drawn */
  private warmGlows: Phaser.GameObjects.Image[] = [];
  private placeDrawn = false;
  /** the lobby's peek at the next fight (cleared when the fight starts) */
  private preview: Phaser.GameObjects.GameObject[] = [];
  /** story reminders: the last "seconds left" said, and when to check your pace again */
  private saidLeft = Infinity;
  private paceT = 12000;
  private ambientT = 6000;
  private halfSaid = false;
  /** the sea stage: attack level, timers, your boat, the tsunami's waves and the islands */
  private sea = {
    lv: 1, diceT: 3000, whaleT: 8000, tentT: 4500, gullT: 0, wakeT: 0, dir: 1, tilt: 0, sprayT: 0,
    under: new Set<Enemy>(), bubT: 0,
    tsunami: 0, phase: "calm" as "calm" | "warn" | "wave" | "rest", phaseT: 0, waveP: 0, hit: false,
    waves: [] as Wave[], islands: [] as { x: number; y: number; r: number; objs: Phaser.GameObjects.GameObject[] }[],
    rain: null as Phaser.GameObjects.Particles.ParticleEmitter | null,
  };
  /** Land Ho!: where the big island is, the next tsunami, the wave and the little islands to hide on */
  private ocean = {
    x: 0, y: 0, img: null as Phaser.GameObjects.Image | null, nextT: 20000, phase: "calm" as "calm" | "warn" | "wave",
    phaseT: 0, wave: null as Wave | null, from: 0, to: 0, hit: false, found: false, gx: 0, gy: 0,
  };
  private boat: Phaser.GameObjects.Image | null = null;
  /** Land Ho!: where the wave starts and ends this time */
  private oceanSpan: [number, number] = [0, 0];
  /** things you cannot walk through (houses, ruins, the gate's posts) */
  private solids: Phaser.Geom.Rectangle[] = [];
  private shieldImg!: Phaser.GameObjects.Image;
  private fortImg!: Phaser.GameObjects.Image;
  private walkTimer = 0;
  private walkFrame = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  joy = { ...NO_JOY };

  private state: "lobby" | "intro" | "fight" | "cutscene" | "boss" | "won" | "lost" = "lobby";
  private elapsed = 0;
  private minute = 0;
  private shielded = false;
  private heroHp = HERO_HP;
  private heroMax = HERO_HP;
  private crystalHp = CRYSTAL_HP;
  private crystalMax = CRYSTAL_HP;
  private hurtAt = 0;
  private stillFor = 0;
  private level = 1;
  private xp = 0;
  private pendingLevels = 0;
  /** skill picks waiting (from skill orbs, airdrops and elites) */
  private pendingSkills = 0;
  private gadgetOpts: GadgetOption[] = [];
  private skills: Partial<Record<SkillId, number>> = {};
  private revived = false;
  /** Boss Rush mode, the time left on the current boss, and this run's haul */
  private rush = false;
  private rushLeft = 0;
  private rushBeaten = 0;
  private rushGems = 0;
  private reviveState: "fight" | "boss" = "fight";
  private stats = freshStats();
  private frozenUntil = 0;
  private warnedAt = 0;

  private gadgets: GadgetSlot[] = [];
  private wisps: { img: Phaser.GameObjects.Image; state: "orbit" | "out" | "back"; target: Enemy | null; dmg: number }[] = [];
  private bubbles: { img: Phaser.GameObjects.Image; vx: number; vy: number; life: number; dmg: number; r: number; held: Enemy | null; popAt: number }[] = [];
  private puddles: { img: Phaser.GameObjects.Image; x: number; y: number; r: number; until: number; dmg: number; tick: number }[] = [];
  private kite: Phaser.GameObjects.Image | null = null;
  private kiteT = 0;
  private rangs: { img: Phaser.GameObjects.Image; dx: number; dy: number; speed: number; went: number; max: number; back: boolean; dmg: number; hit: Set<Enemy>; glow?: Phaser.GameObjects.Image }[] = [];
  private holes: { img: Phaser.GameObjects.Image; x: number; y: number; r: number; until: number; dmg: number }[] = [];

  private pets: Pet[] = [];
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private bullets: Bullet[] = [];
  private rocks: Rock[] = [];
  private lanes: Lane[] = [];
  /** your speed (smoothed), so bosses can aim where you are going */
  private heroVel: [number, number] = [0, 0];
  private heroPrev: [number, number] = [0, 0];
  private strikes: Strike[] = [];
  private pickups: Pickup[] = [];
  private food: Food[] = [];
  private seals: Seal[] = [];
  private healPopT = 0;
  private roamDiceT = 0;
  private wander: [number, number] | null = null;
  /** on the way into a fight (its start animation) */
  private entering = false;
  /** Spooky Aura ticks, Ghost Phase timer and how long you stay see-through */
  private hauntT = 0;
  private ghostT = 0;
  private phasingUntil = 0;
  private spawnTimer = 0;
  private eliteTimer = 0;
  private chestTimer = 0;
  private dropTimer = 0;
  private shardTimer = 0;
  private crystalDieAt = CRYSTAL_DIE_MS;
  private crystalHome: [number, number] = [0, 0];
  private crystalGlow!: Phaser.GameObjects.Image;
  private crystalSparkle!: Phaser.GameObjects.Particles.ParticleEmitter;
  private gloom!: Phaser.GameObjects.Rectangle;
  private streak = 0;
  private streakTimer = 0;
  private streakText!: Phaser.GameObjects.Text;

  private fx!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  /** health numbers on the bars (reused every frame) */
  private hpLabels: Phaser.GameObjects.Text[] = [];
  private hpUsed = 0;
  private puff!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dmgTexts: Phaser.GameObjects.Text[] = [];
  /** comic "POW!" bursts, reused */
  private bursts: Phaser.GameObjects.Container[] = [];
  private stars!: Phaser.GameObjects.Particles.ParticleEmitter;
  private cashTexts: Phaser.GameObjects.Container[] = [];

  private buckets = new Map<number, (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible)[]>();
  private shown = new Set<number>();
  private cullTimer = 0;
  private grid = new Map<number, Enemy[]>();

  private dmgWindow = 0;
  private dpsTimer = 0;
  private earnedWindow = 0;
  private rateTimer = 0;
  private saveTimer = 0;

  constructor() {
    super("Battle");
  }

  get landId(): string {
    return this.land.id;
  }

  create(data: { autostart?: boolean; rush?: boolean; event?: boolean }): void {
    this.eventRun = !!data?.event;
    applyShake(this);
    this.L = layoutFor(this.scale.height);
    makeWorldTextures(this, REGIONS);
    makePickupTextures(this);
    makeGadgetTextures(this);
    makeMutationTextures(this);
    makeBossTextures(this);
    // ?frames: lets the art preview make any boss's walk frames
    if (location.search.includes("frames")) (window as unknown as { __bf: (k: string) => void }).__bf = (k) => bossFrames(this, k);
    makeBossFxTextures(this);
    makePlaceTextures(this);
    this.rush = !!data?.rush;
    makeModeTextures(this);
    makeBeastTextures(this);
    makeStoryTextures(this);
    makeSeaTextures(this);
    this.stageMode = battle.stageMode = this.rush ? "crystal" : modeForStage(save.stage);
    // the story is at night: the lobby too (a little lighter than the fights)
    const nightLobby = !this.rush && !data?.event && storyFor(save.stage);
    battle.goal = null;
    this.air = { zone: null, next: null, x: 0, y: 0, nx: 0, ny: 0, t: AIR_EVERY, oxygen: 1, choke: 0 };
    this.beast = null;
    this.rain = { t: 2500, dodged: 0, drops: 0 };
    this.airFx = [];
    this.feedSign = null;
    this.fog = null;
    this.fogPuffs = null;
    this.fogLayers = [];
    this.fogMask = null;
    this.dizzy = 0;
    this.dizzyCam = false;
    this.dizzyStars = [];
    this.airBubbles = [];
    this.airBubT = 4000;
    this.beastThought = null;
    this.roarT = 0;
    this.vignette = null;
    this.story = null;
    this.night = null;
    this.lamps = [];
    this.lantern = null;
    this.hasLantern = false;
    this.heldLantern = null;
    this.heroGlow = null;
    this.pathBosses = [];
    this.pathChargers = new Map();
    this.warmGlows = [];
    this.placeDrawn = false;
    this.preview = [];
    this.saidLeft = Infinity;
    this.paceT = 12000;
    this.ambientT = 6000;
    this.halfSaid = false;
    this.sea = { lv: 1, diceT: 3000, whaleT: 8000, tentT: 4500, gullT: 0, wakeT: 0, dir: 1, tilt: 0, sprayT: 0, under: new Set(), bubT: 0, tsunami: 0, phase: "calm", phaseT: 0, waveP: 0, hit: false, waves: [], islands: [], rain: null };
    this.boat = null;
    this.solids = [];
    this.ocean = { x: 0, y: 0, img: null, nextT: 20000, phase: "calm", phaseT: 0, wave: null, from: 0, to: 0, hit: false, found: false, gx: 0, gy: 0 };
    this.huntFound = 0;
    this.storyClock = 0;
    this.bigBoss = null;
    this.land = regionForStage(save.stage);
    // story paths are their own long map: the fight starts on it (the lobby is the open land)
    const onPath = !this.rush && !data?.event && !!data?.autostart && modeForStage(save.stage) === "path";
    const own = !this.rush && !data?.event && !!data?.autostart ? modeForStage(save.stage) : null;
    this.arena = onPath ? getPathArena(this.land, save.stage >= 5 ? "sea" : "village")
      : own === "sea" ? getSeaArena(this.land) : own === "ocean" ? getOceanArena(this.land) : getArena(this.land.id);
    Object.assign(this, {
      pets: [], enemies: [], shots: [], bullets: [], rocks: [], pickups: [], food: [], dmgTexts: [], cashTexts: [],
      state: "lobby", elapsed: 0, minute: 0, shielded: false, hurtAt: 0, stillFor: 0, level: 1, xp: 0, pendingLevels: 0, pendingSkills: 0, gadgetOpts: [], skills: {},
      revived: false, rushLeft: 0, rushBeaten: 0, rushGems: 0, stats: freshStats(), frozenUntil: 0, warnedAt: 0,
      gadgets: [{ kind: STARTER_GADGET, tier: "A", level: 1, timer: 300 }], wisps: [], bubbles: [], puddles: [], kite: null, kiteT: 0, rangs: [], holes: [],
      spawnTimer: 0, eliteTimer: 25000, chestTimer: 50000 + Math.random() * 20000, dropTimer: AIRDROP_FIRST_MS, shardTimer: 0, crystalDieAt: CRYSTAL_DIE_MS,
      streak: 0, streakTimer: 0, buckets: new Map(), shown: new Set(), grid: new Map(), seals: [], healPopT: 0, strikes: [],
      roamDiceT: ROAM_DICE_MS, wander: null, entering: false, hauntT: 0, ghostT: 0, phasingUntil: 0, hauntRing: null, hauntRing2: null, zoomT: 0, lanes: [], coughT: 0,
    });
    this.joy = { ...NO_JOY };
    this.heroMax = heroHpAt(save.stage) * villageHpMult();
    this.heroHp = this.heroMax;
    this.crystalMax = crystalHpAt(save.stage) * villageHpMult();
    this.crystalHp = this.crystalMax;
    Object.assign(battle, {
      mode: "lobby", time: 0, bossFrac: -1, crystal: 1, hp: 1, level: 1, xp: 0, dps: 0, streak: 0, choosing: false,
      shielded: false, shieldLeft: SHIELD_MS, gadgets: this.gadgets, skills: this.skills, stats: this.stats,
      bossFight: false, rush: this.rush, rushBoss: save.stage, rushLeft: RUSH_MS, seals: 0, sealsTotal: 0, limit: 0, left: -1, path: !!this.arena.path || !!this.arena.sea,
    });
    this.speedNow = 1;
    this.cameras.main.fadeIn(500, 74, 47, 29);
    if (nightLobby) this.night = new Night(this, nightLobby.dark * 0.85, TOP + 8700);
    this.drawArena();
    this.drawPlace();
    if (!data?.autostart) this.drawPreview();

    const [hx0, hy0] = this.heroStart();
    this.hero = this.add.image(hx0, hy0, "hero").setOrigin(0.5, 0.95);
    this.handImg = this.add.image(0, 0, gadgetKey(STARTER_GADGET));
    this.refreshHand();
    this.fortImg = this.add.image(0, 0, "ring").setTint(0xffd08a).setAlpha(0).setScale(1.4, 0.7);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.arena.w, this.arena.h).setZoom(this.arena.path ? ZOOM : LOBBY_ZOOM);
    cam.startFollow(this.hero, true, 0.14, 0.14);
    this.followOffset();

    this.fx = this.add.graphics().setDepth(TOP + 9000);
    this.bars = this.add.graphics().setDepth(TOP + 9100);
    this.hpLabels = [];
    this.puff = this.add.particles(0, 0, "puff", { speed: { min: 80, max: 340 }, lifespan: 500, scale: { start: 1.2, end: 0 }, emitting: false }).setDepth(TOP + 8900);
    this.sparks = this.add.particles(0, 0, "spark", {
      speed: { min: 120, max: 360 }, lifespan: 320, scale: { start: 0.7, end: 0 }, rotate: { min: 0, max: 90 }, emitting: false,
    }).setDepth(TOP + 8950);
    this.trail = this.add.particles(0, 0, "puff", {
      speed: 0, lifespan: 300, scale: { start: 0.9, end: 0 }, alpha: { start: 0.75, end: 0 }, blendMode: "ADD", emitting: false,
    }).setDepth(TOP + 8990);
    for (let i = 0; i < 70; i++) this.dmgTexts.push(text(this, 0, 0, "", 66).setStroke("#1a1030", 14).setDepth(TOP + 9300).setVisible(false));
    // cartoon extras: comic bursts, star pops, and magic sparkles floating over the field
    makeComicTextures(this);
    this.bursts = [];
    for (let i = 0; i < 6; i++) {
      this.bursts.push(this.add.container(0, 0, [this.add.image(0, 0, "comic_burst"), text(this, 0, -4, "", 44, "#ffffff").setStroke("#1a1030", 10)]).setDepth(TOP + 9250).setVisible(false));
    }
    this.stars = this.add.particles(0, 0, "comic_star", {
      speed: { min: 180, max: 420 }, lifespan: 650, scale: { start: 0.9, end: 0 }, rotate: { start: 0, end: 360 }, gravityY: 500, emitting: false,
    }).setDepth(TOP + 9000);
    this.add.particles(0, 0, "spark", {
      x: { min: 0, max: this.scale.width }, y: { min: 0, max: this.scale.height }, lifespan: 3500, speedY: { min: -40, max: -10 }, speedX: { min: -15, max: 15 },
      scale: { start: 0.45, end: 0 }, alpha: { start: 0.9, end: 0 }, frequency: 140, tint: [0xffffff, 0xffe066, 0xff9ad0, 0x9ae6ff, 0xb98aff],
    }).setScrollFactor(0).setDepth(TOP + 8800);
    for (let i = 0; i < 24; i++) {
      this.cashTexts.push(this.add.container(0, 0, [
        this.add.image(-10, 0, "icon_cash").setScale(0.66).setOrigin(1, 0.5),
        text(this, 0, 0, "", 62, "#8af06a").setOrigin(0, 0.5),
      ]).setDepth(TOP + 9350).setVisible(false));
    }
    this.streakText = text(this, 0, 0, "", 74, "#ffe066").setDepth(TOP + 9400).setVisible(false);

    this.buildPets();
    this.setupControls();
    if (this.night && save.stage > 1) {
      this.hasLantern = true;
      this.holdLantern(false);
    }
    // a finger lifted while the fight was paused never let go of the joystick: let go now
    this.events.on("resume", () => (this.joy = { ...NO_JOY }));
    const on: [string, (...a: never[]) => void][] = [
      ["pets-changed", this.buildPets],
      ["battle-start", this.begin],
      ["event-start", this.beginEvent],
      ["skill-picked", this.onSkillPicked],
      ["gadget-picked", this.onGadgetPicked],
      ["revive", this.revive],
      ["retry", this.retry],
      ["give-up", this.giveUp],
      ["rush-start", this.startRush],
      ["stage-pick", this.pickStage],
    ];
    for (const [ev, fn] of on) this.game.events.on(ev, fn, this);
    this.events.once("shutdown", () => {
      for (const [ev, fn] of on) this.game.events.off(ev, fn, this);
    });
    this.cull(true);
    this.game.events.emit("battle-ready", this.land);
    music.play("calm");
    // first time in a land: celebrate it
    const idx = REGIONS.indexOf(this.land);
    if (idx > save.regionShown && !this.rush) {
      save.regionShown = idx;
      persist();
      this.time.delayedCall(500, () => {
        sfx.fanfare();
        buzz(120);
        this.game.events.emit("land-unlocked", this.land.name);
      });
    }
    if (data?.autostart) this.time.delayedCall(350, () => this.begin(true));
    else if (!this.rush) for (let i = 0; i < ROAM_START; i++) this.roamDie();
    if (this.rush) this.time.delayedCall(300, () => this.beginRush());
  }

  // ───────────────────────── Boss Rush ─────────────────────────

  /** From the lobby (or the results screen): restart the scene as a Boss Rush. */
  private startRush(): void {
    if (this.fighting || this.state === "intro" || this.state === "cutscene" || this.entering) return;
    if (this.state === "lobby" && !this.rush) {
      this.enter("rush", () => this.scene.restart({ rush: true }));
      return;
    }
    this.cameras.main.fadeOut(300, 40, 20, 40);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.restart({ rush: true }));
  }

  /** Just you, your pets and the bosses: no crystal, no monsters, no skills. */
  private beginRush(): void {
    this.state = "intro";
    battle.mode = "run";
    battle.bossFight = true;
    for (const o of [this.crystal, this.crystalGlow, this.shieldImg]) o.setVisible(false);
    this.crystalSparkle.stop();
    this.cameras.main.zoomTo(ZOOM, 700, "Sine.easeInOut");
    sfx.alarm();
    this.banner("BOSS RUSH!", "purple", 1000);
    this.toast(`Beat each boss in ${RUSH_MS / 1000} seconds!`, "#e6b8ff");
    this.game.events.emit("stage-start");
    this.time.delayedCall(1500, () => this.nextRushBoss());
  }

  /** The boss of your stage drops in; its clock starts when it lands. */
  private nextRushBoss(): void {
    const n = save.stage;
    const def = bossForStage(n);
    battle.rushBoss = n;
    this.prepareBoss(n + 1);
    this.rushLeft = RUSH_MS;
    battle.rushLeft = RUSH_MS;
    const [x, y] = this.randomSpot(450, 600, [this.hero.x, this.hero.y]);
    const faller = this.add.image(x, y - 1200, def.tex).setOrigin(0.5, 0.94).setScale(1.3).setDepth(y);
    this.banner(`BOSS ${n}`, "red", 800);
    this.tweens.add({
      targets: faller, y, duration: 420, ease: "Quad.in",
      onComplete: () => {
        faller.destroy();
        this.cameras.main.shake(400, 0.015);
        buzz(150);
        this.boom(x, y - 60, 2.2);
        const boss = this.addEnemy({ tex: def.tex, stats: BOSS, fx: def.color, boss: true, moves: def.moves, special: def.special }, x, y, false, false, 1, n);
        boss.hp = boss.maxHp = rushBossHp(n);
        // the clock is the real danger here: rush bosses hit softer
        boss.dmg *= 0.5;
        boss.huntHero = true;
        boss.phaseT = 1500;
        this.toast(`${def.name}: SPECIAL ${BOSS_SPECIALS[def.special]}! Dodge it`, rgba(lighten(def.color, 0.3)));
        this.state = "boss";
      },
    });
  }

  private rushTick(delta: number): void {
    if (this.state !== "boss") return;
    this.rushLeft -= delta;
    battle.rushLeft = Math.max(0, this.rushLeft);
    if (this.rushLeft <= 0) this.rushOver("time");
  }

  /** A boss beaten in time clears its stage: rewards, a little heal, and on to the next one. */
  private rushBossDown(): void {
    const n = save.stage;
    const secs = (RUSH_MS - this.rushLeft) / 1000;
    this.rushBeaten++;
    for (const e of [...this.enemies]) if (!e.type.boss) this.kill(e, true);
    this.clearBossAttacks();
    save.stage = Math.min(MAX_STAGE, n + 1);
    save.bestStage = Math.max(save.bestStage, save.stage);
    save.bossRushBest = Math.max(save.bossRushBest, n);
    if (n % BOSS_EVERY === 0) {
      save.gems += 3;
      this.rushGems += 3;
      this.addDice(rollDiceTier(n), 2);
    }
    persist();
    this.state = "intro";
    this.heal(0.25);
    sfx.fanfare();
    this.banner(`BOSS ${n} DOWN!  ${secs.toFixed(1)}s`, "green", 900);
    const land = regionForStage(n + 1);
    if (n < MAX_STAGE && land !== regionForStage(n)) this.time.delayedCall(700, () => this.toast(`${land.name} unlocked!`, "#ffe066"));
    if (n >= MAX_STAGE) {
      this.time.delayedCall(1200, () => this.rushOver("done"));
      return;
    }
    this.time.delayedCall(1500, () => this.nextRushBoss());
  }

  /** The run ends: the clock ran out, you fell, gave up, or beat them all. */
  private rushOver(reason: RushResult["reason"]): void {
    if (this.state === "lost" || this.state === "won") return;
    const boss = this.enemies.find((e) => e.type.boss);
    if (boss && reason === "time") {
      // it got away: it flies off laughing
      this.enemies = this.enemies.filter((e) => e !== boss);
      boss.aura?.destroy();
      boss.badge?.destroy();
      this.tweens.killTweensOf(boss.img);
      this.tweens.add({ targets: boss.img, y: boss.img.y - 900, alpha: 0, angle: 30, duration: 900, ease: "Quad.in", onComplete: () => boss.img.destroy() });
    }
    this.state = reason === "done" ? "won" : "lost";
    battle.mode = "over";
    this.joy = { ...NO_JOY };
    music.play("calm");
    if (reason === "hero") {
      this.hero.setTint(0x8a8a8a);
      this.tweens.add({ targets: this.hero, angle: this.hero.flipX ? -90 : 90, duration: 400, ease: "Bounce.out" });
    }
    if (reason !== "quit") this.banner(reason === "time" ? "TIME'S UP!" : reason === "hero" ? "YOU FELL!" : "ALL BOSSES BEATEN!", reason === "done" ? "gold" : "red", 1100);
    sfx[reason === "done" ? "fanfare" : "error"]();
    this.time.delayedCall(reason === "quit" ? 300 : 1400, () => {
      const result: RushResult = { reason, next: save.stage, beaten: this.rushBeaten, earned: this.stats.earned, gems: this.rushGems, dice: this.stats.dice };
      this.game.events.emit("rush-over", result);
    });
  }

  /** Keep the hero in the middle of the open part of the screen at any zoom. */
  private followOffset(): void {
    const cam = this.cameras.main;
    const bottom = battle.mode === "lobby" ? this.L.navTop - 420 : this.scale.height;
    const mid = (this.L.hudBottom + bottom) / 2;
    cam.setFollowOffset(0, (mid - this.scale.height / 2) / cam.zoom);
  }

  /** Where the hero stands when a fight starts: by the crystal, or at the bottom of a story path. */
  private heroStart(): [number, number] {
    const [cx, cy] = this.arena.center;
    return this.arena.path ? [cx, this.arena.path.startY] : this.arena.sea ? [cx, cy] : [cx, cy + 260];
  }

  /** The beginners' Dice Rain event: a Dice Rain run at your stage. */
  private beginEvent(): void {
    if (this.state !== "lobby" || this.entering) return;
    this.eventRun = true;
    this.begin();
  }

  private begin(skipEnter = false): void {
    if (this.state !== "lobby" || this.entering) return;
    if (skipEnter) {
      this.startRun();
      return;
    }
    // a story path is a map of its own: the world is rebuilt for it
    const own = modeForStage(save.stage);
    if (!this.eventRun && ((own === "path" && !this.arena.path) || (own === "sea" && !this.arena.sea) || (own === "ocean" && !this.arena.ocean))) {
      this.enter("battle", () => this.scene.restart({ autostart: true }));
      return;
    }
    this.enter("battle", () => {
      // back out by the crystal, where every run starts
      const [hx, hy] = this.heroStart();
      this.hero.setPosition(hx, hy).setScale(1).setAlpha(1).setTexture("hero");
      this.pets.forEach((p) => p.img.setPosition(hx + p.ox, hy + p.oy).setAlpha(1));
      this.handImg.setVisible(true);
      this.entering = false;
      this.cameras.main.fadeIn(400, 74, 47, 29);
      this.startRun();
    });
  }

  /** The run starts: a fresh clock, the field fills with pickups. */
  private startRun(): void {
    this.state = "intro";
    // the mode comes from the stage picked right now (the lobby may have switched stages since the world was built)
    if (!this.rush) this.stageMode = battle.stageMode = this.eventRun ? "dice" : modeForStage(save.stage);
    // the story's first five stages are chapters, played at night
    this.story = this.rush || this.eventRun ? null : storyFor(save.stage);
    battle.limit = this.story && this.stageMode !== "boss" ? this.story.limit : 0;
    battle.left = -1;
    if (!this.story && this.night) {
      // a Dice Rain run at a story stage is played by day
      this.night.destroy();
      this.night = null;
      this.warmGlows.forEach((g) => g.setAlpha(0));
    }
    if (this.story) {
      if (this.night) this.night.want = this.story.dark;
      else this.night = new Night(this, this.story.dark, TOP + 8700);
      for (const g of this.warmGlows) this.tweens.add({ targets: g, alpha: g.getData("night") as number, duration: 800 });
      this.nightLife();
      // you keep the lantern you found on the first path
      this.hasLantern = save.stage > 1;
      if (this.hasLantern && !this.heldLantern) this.holdLantern(false);
    }
    // dice picked up while roaming the lobby are not part of this run's results
    this.stats = freshStats();
    battle.stats = this.stats;
    battle.mode = "run";
    if (this.arena.sea && !this.arena.ocean) this.seaCamera(900);
    else this.cameras.main.zoomTo(ZOOM, 900, "Sine.easeInOut");
    this.placePickups();
    sfx.alarm();
    if (!this.rush) this.game.events.emit("mode-intro", this.stageMode, !!this.story);
    this.modeStart();
    // this stage's boss: its walk frames are made now, a little at a time, so it lands without a hitch
    if (!this.rush) this.prepareBoss(save.stage);
    // a story chapter: its card, then the camera flies over to the main goal and back
    const tour = this.story && battle.devJump === "start" ? this.storyTour() : 0;
    this.time.delayedCall(this.story ? Math.max(2400, tour) : 1500, () => {
      if (this.rush) this.banner(MODE_INFO[this.stageMode].banner, "red", 900);
      this.state = "fight";
      if (this.stageMode === "boss") this.time.delayedCall(this.story ? 1500 : 900, () => this.state === "fight" && this.bossCutscene());
      this.devJumpTo();
      music.play("battle");
      this.game.events.emit("stage-start");
    });
  }

  private banner(str: string, color: string, ms: number): void {
    this.game.events.emit("banner", str, color, ms);
  }

  private toast(str: string, color = "#ffffff"): void {
    this.game.events.emit("toast", str, color);
  }

  /** World position to screen position (for things the UI scene draws). */
  toScreen(x: number, y: number): [number, number] {
    const cam = this.cameras.main;
    return [(x - cam.worldView.x) * cam.zoom, (y - cam.worldView.y) * cam.zoom];
  }

  private get fighting(): boolean {
    return this.state === "fight" || this.state === "boss";
  }

  /** Free to walk around the lobby (not on the way into a fight). */
  private get roaming(): boolean {
    return this.state === "lobby" && !this.rush && !this.entering;
  }

  // ───────────────────────── free roam ─────────────────────────

  /**
   * Off to the fight: the hero gives a big hop in a burst of sparkles (the pets hop too), the screen
   * flashes and fades, then `then` starts it.
   */
  private enter(kind: FightKind, then: () => void): void {
    this.entering = true;
    this.joy = { ...NO_JOY };
    this.handImg.setVisible(false);
    const cam = this.cameras.main;
    const color = kind === "rush" ? 0xc080ff : 0xffb03a;
    const [x, y] = [this.hero.x, this.hero.y];
    this.hero.setTexture("hero");
    sfx.lucky();
    buzz(60);
    const ring = this.add.image(x, y - 10, "ring").setTint(color).setScale(0.3, 0.15).setDepth(y - 1);
    this.tweens.add({ targets: ring, scaleX: 3.4, scaleY: 1.7, alpha: 0, duration: 650, onComplete: () => ring.destroy() });
    this.tweens.add({ targets: this.hero, y: y - 170, duration: 280, yoyo: true, ease: "Quad.out" });
    this.pets.forEach((p, i) => this.tweens.add({ targets: p.img, y: p.img.y - 120, duration: 250, yoyo: true, delay: 60 + i * 50, ease: "Quad.out" }));
    this.sparks.setParticleTint(color);
    this.sparks.explode(34, x, y - 90);
    this.time.delayedCall(560, () => {
      cam.flash(180, 255, 240, 200);
      cam.fadeOut(350, kind === "rush" ? 40 : 74, kind === "rush" ? 20 : 47, kind === "rush" ? 40 : 29);
      cam.once("camerafadeoutcomplete", then);
    });
  }

  /** A die turns up somewhere around you. */
  private roamDie(): void {
    this.addDie(rollDiceTier(save.stage), ...this.randomSpot(450, 1700, [this.hero.x, this.hero.y]), 0);
  }

  /** Free roam: dice keep turning up around you. */
  private roamTick(delta: number): void {
    this.roamDiceT -= delta;
    if (this.roamDiceT > 0) return;
    this.roamDiceT = ROAM_DICE_MS;
    if (this.pickups.filter((p) => p.kind === "dice").length < ROAM_MAX) this.roamDie();
  }

  /** AFK: walk to the nearest die; with none around, stroll between spots near the crystal. */
  private afkStep(): [number, number] {
    const dice = this.pickups.filter((p) => p.kind === "dice");
    let tx: number;
    let ty: number;
    // AFK walks at a third of your speed: collecting by hand is faster
    let pace = 1 / 3;
    if (dice.length) {
      const dist = (p: Pickup) => Math.hypot(p.x - this.hero.x, p.y - this.hero.y);
      const p = dice.reduce((a, b) => (dist(b) < dist(a) ? b : a));
      [tx, ty] = [p.x, p.y];
      this.wander = null;
    } else {
      if (!this.wander || Math.hypot(this.wander[0] - this.hero.x, this.wander[1] - this.hero.y) < 40) this.wander = this.randomSpot(200, 900);
      [tx, ty] = this.wander;
      pace = 1 / 6;
    }
    const [vx, vy] = [tx - this.hero.x, ty - this.hero.y];
    const d = Math.hypot(vx, vy);
    return d < 20 ? [0, 0] : [(vx / d) * pace, (vy / d) * pace];
  }

  // ───────────────────────── arena ─────────────────────────

  /** Scenery far from the camera is hidden, so the big field stays fast. */
  private addStatic(obj: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible, x: number, y: number): void {
    const k = Math.floor(x / BUCKET) * 1000 + Math.floor(y / BUCKET);
    if (!this.buckets.has(k)) this.buckets.set(k, []);
    this.buckets.get(k)!.push(obj);
    // added while its patch of ground is already on screen: keep it shown
    obj.setVisible(this.shown.has(k));
  }

  private cull(force = false): void {
    const v = this.cameras.main.worldView;
    const want = new Set<number>();
    for (let bx = Math.floor((v.x - 300) / BUCKET); bx <= Math.floor((v.right + 300) / BUCKET); bx++) {
      for (let by = Math.floor((v.y - 300) / BUCKET); by <= Math.floor((v.bottom + 500) / BUCKET); by++) want.add(bx * 1000 + by);
    }
    for (const k of this.shown) if (!want.has(k)) this.buckets.get(k)?.forEach((o) => o.setVisible(false));
    for (const k of want) if (force || !this.shown.has(k)) this.buckets.get(k)?.forEach((o) => o.setVisible(true));
    this.shown = want;
    // moving things far off screen are not drawn (they still move and fight); a wide margin so
    // nothing pops in at the edge of the screen, even tall bosses
    const [x0, x1, y0, y1] = [v.x - 400, v.right + 400, v.y - 400, v.bottom + 700];
    const near = (x: number, y: number) => x > x0 && x < x1 && y > y0 && y < y1;
    for (const e of this.enemies) {
      const on = e.type.boss || near(e.img.x, e.img.y);
      if (e.img.visible !== on) {
        e.img.setVisible(on);
        e.aura?.setVisible(on);
        e.badge?.setVisible(on);
      }
    }
    for (const f of this.food) f.img.setVisible(near(f.img.x, f.img.y));
    for (const p of this.pickups) {
      const on = near(p.x, p.y);
      p.img.setVisible(on);
      p.glow.setVisible(on);
    }
  }

  private drawArena(): void {
    const a = this.arena;
    const keys = makeGround(this, a);
    const s = 1 / GROUND_SCALE;
    const beach = this.beachLobby();
    if (a.sea) this.drawSea();
    else if (beach) this.add.tileSprite(0, 0, a.w, a.h, "sand_tile").setOrigin(0).setDepth(-1000);
    else this.add.tileSprite(0, 0, a.w * GROUND_SCALE, a.h * GROUND_SCALE, keys.tile).setOrigin(0).setScale(s).setDepth(-1000);
    // toaster mode: fewer ground patches and scenery
    const toaster = save.settings.toaster;
    if (!beach) a.patches.forEach((p, i) => {
      if (toaster && i % 3) return;
      const img = this.add.image(p.x, p.y, keys.patches[i % keys.patches.length]).setScale((s * p.r) / PATCH_R).setDepth(-900).setFlipX(i % 2 === 1);
      this.addStatic(img, p.x, p.y);
    });
    const [cx, cy] = a.center;
    if (a.path) this.drawPath();
    else if (beach) this.drawBeach();
    else if (!a.sea) this.add.image(cx, cy + 40, keys.circle).setScale(s).setDepth(-800);
    if (!beach) a.objects.forEach((o, i) => {
      if (toaster && i % 3) return;
      const img = this.add.image(o.x, o.y, o.tex).setOrigin(0.5, 1).setDepth(o.y).setFlipX(!!o.flip);
      if (o.scale) img.setScale(o.scale);
      this.addStatic(img, o.x, o.y);
      // the woods along a path are thick: only some of them sway
      if ((o.tex.startsWith("tree") || o.tex === "palm") && (!a.path || i % 5 === 0)) {
        this.tweens.add({ targets: img, angle: { from: -1.5, to: 1.5 }, duration: 2200 + (o.x % 900), yoyo: true, repeat: -1, ease: "Sine.inOut" });
      }
    });
    // the crystal you protect: bobbing, glowing and sparkling
    const glow = this.add.image(cx, cy - 110, "glow").setTint(this.land.crystal).setScale(2.4).setAlpha(0.5).setDepth(cy - 1);
    this.tweens.add({ targets: glow, alpha: 0.85, scale: 2.8, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.crystalGlow = glow;
    this.crystalHome = [cx, cy + 70];
    this.crystal = this.add.image(cx, cy + 70, crystalKey(this.land.id)).setOrigin(0.5, 1).setDepth(cy + 70);
    this.tweens.add({ targets: this.crystal, y: cy + 60, duration: 1500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.gloom = this.add.rectangle(0, 0, a.w, a.h, 0x1a1030, 0).setOrigin(0).setDepth(TOP + 15000);
    this.crystalSparkle = this.add.particles(cx, cy - 120, "spark", {
      x: { min: -90, max: 90 }, y: { min: -120, max: 80 }, lifespan: 1400, speedY: { min: -40, max: -10 },
      scale: { start: 0.5, end: 0 }, tint: [this.land.crystal, 0xffffff], frequency: 160,
    }).setDepth(cy + 71);
    this.shieldImg = this.add.image(cx, cy - 60, "shield").setScale(0).setAlpha(0.9).setDepth(cy + 80);
    // the crystal only comes down for Crystal stages; the lobby shows a signboard instead
    this.crystal.setVisible(false);
    glow.setVisible(false);
    this.crystalSparkle.stop();
    if (!this.rush && !a.path && !a.sea) this.refreshSign();
  }

  /**
   * A story path: a dirt track up the middle of the woods, and at its end the village (cottages
   * with warm windows behind a wooden gate) or the beach and the sea with a pier.
   */
  private drawPath(): void {
    const p = this.arena.path!;
    const mid = this.arena.w / 2;
    const add = (o: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible, x: number, y: number) => this.addStatic(o, x, y);
    // the track, in pieces so far-off ones are hidden
    const tileH = 1024;
    for (let y = p.endY - 200; y < this.arena.h; y += tileH) {
      add(this.add.tileSprite(mid, y, 420, tileH / 2, "path_dirt").setOrigin(0.5, 0).setScale(2).setDepth(-850), mid, y + tileH / 2);
    }
    if (p.kind === "village") {
      // the gate over the path, a little square and cottages all round
      const gy = p.endY + 120;
      const gate = this.add.image(mid, gy, "gate").setOrigin(0.5, 1).setDepth(gy);
      add(gate, mid, gy);
      const name = text(this, mid, gy - 300, "VILLAGE", 58, "#5a3418", { stroke: false });
      name.setPosition(mid, gy - 440 + 137);
      name.setDepth(gy + 1);
      add(name, mid, gy);
      add(this.add.ellipse(mid, 800, 1300, 900, 0xc49766, 0.85).setDepth(-860), mid, 800);
      const houses: [number, number, string][] = [
        [mid - 560, 1250, "house_a"], [mid + 560, 1200, "house_b"], [mid - 620, 760, "house_b"], [mid + 640, 720, "house_a"],
        [mid - 300, 380, "house_a"], [mid + 300, 400, "house_b"],
      ];
      for (const x of [mid - 400, mid + 400]) this.solid(x + 22, gy, 70, 50);
      for (const [x, y, key] of houses) {
        add(this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y), x, y);
        this.solid(x, y, 360, 150);
        // the windows glow in the night
        for (const dx of [-60, 90]) this.lamps.push({ x: x + dx, y: y - 140, r: 230 });
        add(this.add.image(x, y - 140, "warm_glow").setScale(3.6).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 8701), x, y);
      }
      for (const dx of [-420, 420]) {
        const x = mid + dx;
        this.addTorch(x, gy + 40);
      }
      this.lamps.push({ x: mid, y: gy - 150, r: 420 });
      this.nightGlow(mid, gy - 150, 5, 0.6);
    } else {
      // the beach: sand, the sea with foam rolling in, a pier and the sun coming up
      const shore = p.endY - 100;
      add(this.add.tileSprite(0, shore, this.arena.w, 520, "sand_tile").setOrigin(0).setDepth(-870), mid, shore + 260);
      const sea = this.add.tileSprite(0, 0, this.arena.w, shore, "sea_tile").setOrigin(0).setDepth(-865);
      add(sea, mid, shore - 300);
      this.tweens.add({ targets: sea, tilePositionY: -256, duration: 6000, repeat: -1 });
      const foam = this.add.tileSprite(0, shore - 20, this.arena.w, 60, "foam").setOrigin(0).setDepth(-864);
      add(foam, mid, shore);
      this.tweens.add({ targets: foam, y: shore - 50, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      const pier = this.add.image(mid + 420, shore + 120, "pier").setOrigin(0.5, 1).setDepth(-863);
      add(pier, mid + 420, shore - 200);
      this.lamps.push({ x: mid, y: shore - 200, r: 700 });
      this.nightGlow(mid, shore - 150, 9, 0.35);
    }
  }

  /** Torches on a square grid round the middle, 800 apart: (-n..n) x (-n..n), the centre left free. */
  private torchGrid(n: number): void {
    const [cx, cy] = this.arena.center;
    for (let gy = -n; gy <= n; gy++) {
      for (let gx = -n; gx <= n; gx++) if (gx || gy) this.addTorch(clampX(cx + gx * 800), clampY(cy + gy * 800 + 140));
    }
  }

  /** The lobby before a sea stage is the beach: the sea starts above you. */
  private beachLobby(): boolean {
    const m = modeForStage(save.stage);
    return !this.rush && !this.arena.path && !this.arena.sea && (m === "sea" || m === "ocean");
  }

  /**
   * The beach: the sea along the top with foam rolling in, a pier with your boat tied up, palm trees
   * and shells on the sand.
   */
  private drawBeach(): void {
    const a = this.arena;
    const [cx, cy] = a.center;
    const shore = cy - 330;
    const sea = this.add.tileSprite(0, 0, a.w, shore, "sea_tile").setOrigin(0).setDepth(-990);
    this.tweens.add({ targets: sea, tilePositionY: -256, duration: 7000, repeat: -1 });
    const foam = this.add.tileSprite(0, shore - 20, a.w, 60, "foam").setOrigin(0).setDepth(-985);
    this.tweens.add({ targets: foam, y: shore - 50, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    // wet sand along the water
    this.add.rectangle(0, shore, a.w, 160, 0xc8a870, 0.45).setOrigin(0).setDepth(-988);
    const px = cx + 420;
    this.add.image(px, shore + 260, "pier").setOrigin(0.5, 1).setDepth(-980);
    const boat = this.add.image(px - 170, shore - 300, "sea_boat").setDepth(-975);
    this.tweens.add({ targets: boat, y: boat.y - 10, angle: { from: -3, to: 3 }, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const textures = this.textures.exists("palm") ? "palm" : "tree_green";
    for (const [dx, dy] of [[-520, 120], [-700, 620], [560, 760], [-1000, 300], [1000, 200], [-600, 1200], [700, 1300], [-1400, 900], [1400, 900]]) {
      const [x, y] = [cx + dx, cy + dy];
      const t = this.add.image(x, y, textures).setOrigin(0.5, 1).setDepth(y);
      this.tweens.add({ targets: t, angle: { from: -2, to: 2 }, duration: 2000 + (x % 700), yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }
    for (let i = 0; i < 26; i++) {
      const [x, y] = [cx + (Math.random() - 0.5) * 3200, shore + 300 + Math.random() * 2400];
      this.add.circle(x, y, 7 + Math.random() * 6, i % 2 ? 0xffd8e8 : 0xfff3dc).setStrokeStyle(3, 0x8a6a4a).setDepth(-900);
    }
  }

  /**
   * In the lobby, a peek at the next fight: the beast in its cage, the crystal, the air zone's
   * pillars, a ring of torches for a boss battle, the road to the sea. It goes up in a puff when
   * the fight starts.
   */
  private drawPreview(): void {
    if (this.rush || this.arena.path || this.arena.sea || this.beachLobby()) return;
    const [cx, cy] = this.arena.center;
    const m = modeForStage(save.stage);
    // in the open space to the right of where you stand (clear of the lobby's cards)
    const [x, y] = [cx + 360, cy + 640];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.preview.push(o);
      return o;
    };
    if (m === "feed") {
      const def = PET_LIST[((storyFor(save.stage) ? 3 : save.stage) * 7) % PET_LIST.length];
      add(this.add.image(x, y, "cage_back").setOrigin(0.5, 520 / 620).setDepth(y - 2).setScale(0.6));
      const pet = add(this.add.image(x, y - 10, petTexture(this, def.id)).setOrigin(0.5, 0.9).setDepth(y - 1));
      pet.setScale(230 / pet.height);
      this.tweens.add({ targets: pet, scaleY: pet.scaleY * 1.05, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      add(this.add.image(x, y, "cage_front").setOrigin(0.5, 520 / 620).setDepth(y + 1).setScale(0.6));
    } else if (m === "crystal") {
      const glow = add(this.add.image(x, y - 160, "glow").setTint(this.land.crystal).setScale(2.2).setAlpha(0.6).setDepth(y - 1));
      this.tweens.add({ targets: glow, alpha: 0.9, scale: 2.6, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      const cr = add(this.add.image(x, y, crystalKey(this.land.id)).setOrigin(0.5, 1).setDepth(y).setScale(0.6));
      this.tweens.add({ targets: cr, y: y - 14, duration: 1500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    } else if (m === "air") {
      const z = 420;
      const g = add(this.add.graphics().setDepth(5));
      g.lineStyle(14, 0x5affc8, 0.8).strokeRoundedRect(x - z / 2, y - z / 2, z, z, 30).fillStyle(0xaefff0, 0.12).fillRoundedRect(x - z / 2, y - z / 2, z, z, 30);
      for (const [px, py] of [[x - z / 2, y - z / 2], [x + z / 2, y - z / 2], [x - z / 2, y + z / 2], [x + z / 2, y + z / 2]]) {
        const pil = add(this.add.image(px, py, "zone_pillar").setOrigin(0.5, 1).setDisplaySize(80, 520).setBlendMode(Phaser.BlendModes.ADD).setDepth(py + 1).setAlpha(0.8));
        this.tweens.add({ targets: pil, alpha: 0.4, duration: 800, yoyo: true, repeat: -1 });
      }
    } else if (m === "boss" && !this.placeDrawn) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const [tx, ty] = [cx + Math.cos(a) * 760, cy + 60 + Math.sin(a) * 520];
        add(this.add.image(tx, ty, "torch3d").setOrigin(0.5, 1).setDepth(ty));
        const f = add(this.add.image(tx, ty - 196, "flame").setOrigin(0.5, 0.95).setDepth(ty + 1));
        this.tweens.add({ targets: f, scaleY: { from: 0.85, to: 1.15 }, duration: 200, yoyo: true, repeat: -1 });
      }
    } else if (m === "path" && save.stage >= 5) {
      // the road out of the village down to the sea
      add(this.add.tileSprite(cx, cy - 400, 420, 1400, "path_dirt").setOrigin(0.5, 1).setScale(2, 1).setDepth(-860));
      add(this.sign(cx - 330, cy - 560, "THE SEA", "this way!", "#9ad8ff"));
    }
  }

  /** A burning torch (with its pool of light in the night). */
  private addTorch(x: number, y: number): void {
    this.addStatic(this.add.image(x, y, "torch3d").setOrigin(0.5, 1).setDepth(y), x, y);
    // the flame flickers (a sprite, not particles: dozens of torches stay cheap)
    // (normal blending: additive sprites mixed in among the scenery break the draw batches and lag)
    const flame = this.add.image(x, y - 196, "flame").setOrigin(0.5, 0.95).setDepth(y + 1);
    this.tweens.add({ targets: flame, scaleY: { from: 0.85, to: 1.15 }, scaleX: { from: 1.05, to: 0.9 }, duration: 160 + Math.random() * 120, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.addStatic(flame, x, y);
    this.addStatic(this.add.image(x, y - 220, "glow").setTint(0xffa040).setScale(0.9).setAlpha(0.45).setDepth(y), x, y);
    // at night it lights up the ground round it (the warm glow shows once night falls)
    this.nightGlow(x, y - 100, 3.8, 0.75);
    this.lamps.push({ x, y: y - 100, r: 340 });
  }

  /** A building's footprint (centred on x, its front edge on y): you cannot walk through it. */
  private solid(x: number, y: number, w: number, h: number): void {
    this.solids.push(new Phaser.Geom.Rectangle(x - w / 2, y - h, w, h + 10));
  }

  private blocked(x: number, y: number): boolean {
    for (const r of this.solids) if (r.contains(x, y)) return true;
    return false;
  }

  /** A coloured glow over the night (so things that shine show in the dark). */
  private topGlow(x: number, y: number, scale: number, tint: number): Phaser.GameObjects.Image {
    const g = this.add.image(x, y, "glow").setTint(tint).setScale(scale).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 8702);
    this.tweens.add({ targets: g, alpha: 0.4, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    return g;
  }

  /** A warm glow on the ground that only shows at night. */
  private nightGlow(x: number, y: number, scale: number, alpha: number): void {
    const g = this.add.image(x, y, "warm_glow").setScale(scale).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 8701).setAlpha(this.night || this.arena.path ? alpha : 0);
    g.setData("night", alpha);
    this.warmGlows.push(g);
    this.addStatic(g, x, y);
  }

  /**
   * Where you are in the story shows in the lobby and the fights of the first land: at stage 1 your
   * camp in the woods (a campfire, a sign to the village); from stage 2 the village, with cobbled
   * streets in a grid (four up and down, four across), torches where the streets cross, cottages in
   * the blocks between, and at stage 2 two of them still burnt out.
   */
  private drawPlace(): void {
    if (this.rush || this.arena.path || this.arena.sea || this.land.id !== "village" || this.beachLobby()) return;
    const [cx, cy] = this.arena.center;
    if (save.stage <= 1) {
      const [fx, fy] = [cx + 380, cy + 420];
      this.addStatic(this.add.image(fx, fy, "campfire").setOrigin(0.5, 0.8).setDepth(fy), fx, fy);
      const flame = this.add.image(fx, fy - 30, "flame").setOrigin(0.5, 0.95).setScale(1.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(fy + 1);
      this.tweens.add({ targets: flame, scaleY: { from: 1.2, to: 1.6 }, scaleX: { from: 1.5, to: 1.25 }, duration: 180, yoyo: true, repeat: -1 });
      this.addStatic(flame, fx, fy);
      this.addStatic(this.add.image(fx, fy - 60, "glow").setTint(0xff9a3a).setScale(2.4).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD).setDepth(fy - 1), fx, fy);
      const sg = this.sign(cx - 420, cy - 300, "VILLAGE", "up the path!", "#ffe6a0");
      this.addStatic(sg, cx - 420, cy - 300);
      // a thick ring of woods round the camp
      for (let i = 0; i < 46; i++) {
        const a = (i / 46) * Math.PI * 2;
        const d = 1250 + (i % 3) * 140;
        const [tx, ty] = [cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9];
        if (Math.abs(tx - cx) < 260 && ty < cy) continue;
        this.addStatic(this.add.image(tx, ty, i % 2 ? "tree_dark" : "tree_pine").setOrigin(0.5, 1).setDepth(ty).setScale(1.1), tx, ty);
      }
      return;
    }
    // the streets: four up and down and four across, all the way over the land
    const offs = [-1050, -350, 350, 1050];
    for (const o of offs) {
      const v = this.add.tileSprite(cx + o, 0, 150, ARENA, "cobble").setOrigin(0.5, 0).setDepth(-880);
      const h = this.add.tileSprite(0, cy + o, ARENA, 150, "cobble").setOrigin(0, 0.5).setDepth(-879);
      v.setVisible(true);
      h.setVisible(true);
    }
    for (const ox of offs) for (const oy of offs) this.addTorch(cx + ox + 95, cy + oy + 75);
    // cottages in the blocks (two still burnt out at stage 2)
    const ruined = save.stage === 2;
    const homes: [number, number, string][] = [
      [-700, -650, ruined ? "ruin" : "house_a"], [700, -650, ruined ? "ruin" : "house_b"],
      [-700, 760, "house_a"], [700, 760, "house_b"], [-1400, -650, "house_b"], [1400, -650, "house_a"],
      [0, -1350, "house_a"], [-1400, 1450, "house_b"], [1400, 1450, "house_a"], [0, 1450, "house_b"],
    ];
    for (const [dx, dy, key] of homes) {
      const [x, y] = [cx + dx, cy + dy];
      this.addStatic(this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y).setFlipX(key === "ruin" && dx > 0), x, y);
      this.solid(x, y, key === "ruin" ? 470 : 360, 150);
      if (key === "ruin") {
        if (effectsOn()) this.addStatic(this.add.particles(x, y - 300, "puff", {
          x: { min: -120, max: 120 }, lifespan: 2400, speedY: { min: -80, max: -40 }, scale: { start: 0.6, end: 2.2 }, alpha: { start: 0.35, end: 0 },
          tint: 0x6a6070, frequency: 320,
        }).setDepth(y + 1), x, y);
      } else {
        this.nightGlow(x, y - 140, 3.4, 0.65);
        this.lamps.push({ x: x - 50, y: y - 150, r: 220 });
      }
    }
    this.placeDrawn = true;
  }

  /** The lobby signboard: the stage you will play and its mode. */
  private refreshSign(): void {
    this.stageSign?.destroy();
    const [cx, cy] = this.arena.center;
    const mode = stageInfo(save.stage);
    this.stageSign = this.sign(cx, cy + 70, `STAGE ${save.stage}`, mode.name, "#ffffff", mode.css);
    const icon = this.add.image(150, -236, mode.icon).setScale(0.6);
    this.tweens.add({ targets: icon, y: icon.y - 12, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.stageSign.add(icon);
  }

  /** A wooden signboard on two posts that pops up and sways a little. */
  private sign(x: number, y: number, title: string, sub = "", color = "#ffffff", subColor = "#fff3dc"): Phaser.GameObjects.Container {
    const c = this.add.container(x, y, [
      this.add.image(0, 0, "sign_board").setOrigin(0.5, 1),
      fitText(text(this, -6, -198, title, 46, color, { stroke: 10 }), 290),
      fitText(text(this, -6, -140, sub, 30, subColor, { stroke: 7 }), 290),
    ]).setDepth(y).setScale(0);
    this.tweens.add({ targets: c, scale: 1, duration: 450, ease: "Back.out" });
    this.tweens.add({ targets: c, angle: { from: -2, to: 2 }, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    return c;
  }

  /** A yellow warning sign. */
  private warnSign(x: number, y: number): void {
    const w = this.add.image(x, y, "sign_warn").setOrigin(0.5, 1).setDepth(y).setScale(0);
    this.tweens.add({ targets: w, scale: 1, duration: 400, ease: "Back.out" });
    this.tweens.add({ targets: w, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  }

  /** Crystal stages: the crystal drops out of the sky onto its stand. */
  private crystalArrive(): void {
    const [hx, hy] = this.crystalHome;
    this.tweens.killTweensOf(this.crystal);
    this.crystal.setVisible(true).setPosition(hx, hy - 1400);
    this.tweens.add({
      targets: this.crystal, y: hy, duration: 900, ease: "Bounce.out",
      onComplete: () => {
        this.cameras.main.shake(200, 0.006);
        this.sparks.setParticleTint(this.land.crystal);
        this.sparks.explode(40, hx, hy - 120);
        this.crystalGlow.setVisible(true);
        this.crystalSparkle.start();
        this.tweens.add({ targets: this.crystal, y: hy - 10, duration: 1500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      },
    });
  }

  // ───────────────────────── the crystal shield ─────────────────────────

  /** Every other 45 s the crystal is shielded and every monster comes for you instead. */
  private setShield(on: boolean): void {
    if (on === this.shielded) return;
    this.shielded = on;
    battle.shielded = on;
    this.tweens.killTweensOf(this.shieldImg);
    if (on) {
      sfx.shield(true);
      this.shieldImg.setScale(0).setAlpha(0.9);
      this.tweens.add({ targets: this.shieldImg, scale: 1.45, duration: 500, ease: "Back.out" });
      this.tweens.add({ targets: this.shieldImg, alpha: 0.6, duration: 900, yoyo: true, repeat: -1, delay: 500 });
      this.banner("CRYSTAL SHIELDED!", "blue", 1000);
      this.toast("Every monster is coming for YOU now!", "#9ae6ff");
      this.enemies.forEach((e) => (e.attacking = false));
    } else {
      sfx.shield(false);
      this.tweens.add({ targets: this.shieldImg, scale: 0, duration: 300, ease: "Back.in" });
      this.banner("SHIELD DOWN!", "red", 1000);
      this.toast("Monsters go for the crystal again - defend it!", "#ff9a9a");
    }
  }

  // ───────────────────────── things to find on the map ─────────────────────────

  private randomSpot(min: number, max: number, from?: [number, number]): [number, number] {
    // never inside a building (a die you could not reach)
    for (let k = 0; k < 10; k++) {
      const p = this.spotOnce(min, max, from);
      if (!this.solids.length || (!this.blocked(p[0], p[1]) && !this.blocked(p[0], p[1] - 80) && !this.blocked(p[0], p[1] + 80))) return p;
    }
    return this.spotOnce(min, max, from);
  }

  private spotOnce(min: number, max: number, from?: [number, number]): [number, number] {
    const [cx, cy] = from ?? this.arena.center;
    const a = Math.random() * Math.PI * 2;
    const d = min + Math.random() * (max - min);
    const p = this.arena.path;
    // on a path: somewhere along the open strip (not deep in the woods)
    if (p) return [Phaser.Math.Clamp(cx + Math.cos(a) * d, p.x0 + 60, p.x1 - 60), Phaser.Math.Clamp(cy + Math.sin(a) * d, p.endY + 200, p.startY + 100)];
    return [clampX(cx + Math.cos(a) * d), clampY(cy + Math.sin(a) * d)];
  }

  /** Dice (they pay for rolls), power-ups and skill orbs are spread all over the field. */
  private placePickups(): void {
    const p = this.arena.path;
    if (p) {
      // a path: dice and power-ups along the way
      const along = (k: number) => [p.x0 + 80 + Math.random() * (p.x1 - p.x0 - 160), p.startY - 600 - k * (p.startY - p.endY - 800)] as [number, number];
      for (let i = 0; i < 12; i++) this.addDie(rollDiceTier(save.stage), ...along(Math.random()), 0);
      for (let i = 0; i < 6; i++) this.addPickup(POWERUPS[i % POWERUPS.length], ...along((i + 0.5) / 6), 0);
      return;
    }
    // the village hunt has its own dice to find
    if (this.stageMode !== "hunt") for (let i = 0; i < 14; i++) this.addDie(rollDiceTier(save.stage), ...this.randomSpot(700, 2650), 0);
    for (let i = 0; i < 8; i++) this.addPickup(POWERUPS[i % POWERUPS.length], ...this.randomSpot(500, 2650), 0);
    for (let i = 0; i < 3; i++) this.addPickup("orb", ...this.randomSpot(1400, 2650), 0);
  }

  private addPickup(kind: ItemKind, x: number, y: number, life: number): Pickup {
    const glow = this.add.image(x, y - 30, "glow").setTint(PICK_GLOW[kind]).setScale(kind === "chest" ? 1.2 : 0.8).setAlpha(0.6).setDepth(y - 1);
    const img = this.add.image(x, y, PICK_TEX[kind]).setOrigin(0.5, kind === "chest" || kind === "airdrop" ? 1 : 0.8).setDepth(y).setScale(0);
    this.tweens.add({ targets: img, scale: 1, duration: 300, ease: "Back.out" });
    if (kind !== "chest" && kind !== "airdrop") this.tweens.add({ targets: img, y: y - 16, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.tweens.add({ targets: glow, alpha: 0.95, scale: glow.scale * 1.2, duration: 800, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const p: Pickup = { kind, img, glow, x, y, until: life ? this.time.now + life : 0, ready: true, extra: [] };
    this.pickups.push(p);
    return p;
  }

  /** A die lying on the ground, glowing in its tier colour (rare ones shine a light beam). */
  private addDie(tier: Tier, x: number, y: number, life: number): Pickup {
    const rank = tierIndex(tier);
    const color = TIER_INFO[tier].color;
    const glow = this.add.image(x, y - 30, "glow").setTint(color).setScale(0.8 + rank * 0.15).setAlpha(0.7).setDepth(y - 1);
    const img = this.add.image(x, y, `die_${tier}`).setOrigin(0.5, 0.8).setDepth(y).setScale(0);
    this.tweens.add({ targets: img, scale: 1 + rank * 0.06, duration: 300, ease: "Back.out" });
    this.tweens.add({ targets: img, y: y - 16, angle: { from: -8, to: 8 }, duration: 800, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.tweens.add({ targets: glow, alpha: 1, scale: glow.scale * 1.25, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const extra: Phaser.GameObjects.GameObject[] = [];
    if (rank >= 3) {
      const beam = this.add.rectangle(x, y - 300, 40, 600, color, 0.35).setDepth(y - 2);
      this.tweens.add({ targets: beam, alpha: 0.12, duration: 600, yoyo: true, repeat: -1 });
      extra.push(beam);
    }
    const p: Pickup = { kind: "dice", img, glow, x, y, until: life ? this.time.now + life : 0, tier, ready: true, extra };
    this.pickups.push(p);
    return p;
  }

  private removePickup(p: Pickup): void {
    const objs = [p.img, p.glow, ...p.extra];
    this.tweens.add({ targets: objs, alpha: 0, duration: 400, onComplete: () => objs.forEach((o) => o.destroy()) });
  }

  private updatePickups(delta: number): void {
    this.chestTimer -= delta;
    if (this.fighting && this.chestTimer <= 0) {
      this.chestTimer = 55000 + Math.random() * 30000;
      this.addPickup("chest", ...this.randomSpot(700, 1500, [this.hero.x, this.hero.y]), 50000);
      this.toast("A treasure chest appeared!", "#ffe066");
      sfx.lucky();
    }
    this.dropTimer -= delta;
    if (this.fighting && this.dropTimer <= 0) {
      this.dropTimer = AIRDROP_MS / (1 + 0.15 * this.lv("luck"));
      this.airdrop();
    }
    const reach = Math.max(90, PICK_R * this.magnetMult() * 0.45);
    this.pickups = this.pickups.filter((p) => {
      const near = Math.abs(p.x - this.hero.x) < reach && Math.abs(p.y - this.hero.y) < reach * 0.8;
      if (near && p.ready && (this.fighting || this.roaming)) {
        this.collect(p);
        return false;
      }
      if (p.until && this.time.now > p.until) {
        this.removePickup(p);
        return false;
      }
      return true;
    });
  }

  /** Every 30 s alive the crystal pops out a die that lands nearby; it gets a tier rarer every 20 stages. */
  private crystalDie(): void {
    const tier = DICE_TIERS[Math.min(DICE_TIERS.length - 1, Math.floor((save.stage - 1) / 20))];
    const [cx, cy] = this.crystalHome;
    const a = Math.random() * Math.PI * 2;
    const d = 230 + Math.random() * 160;
    const [x, y] = [clampX(cx + Math.cos(a) * d), clampY(cy + Math.sin(a) * d * 0.7)];
    const img = this.add.image(cx, cy - 220, `die_${tier}`).setScale(0).setDepth(TOP + 9000);
    const shadow = this.add.ellipse(x, y, 40, 14, 0x000000, 0.25).setDepth(y - 1).setScale(0.3);
    this.sparks.setParticleTint(TIER_INFO[tier].color);
    this.sparks.explode(16, cx, cy - 220);
    sfx.lucky();
    this.tweens.add({ targets: img, scale: 1.2, duration: 250, ease: "Back.out" });
    this.tweens.add({ targets: img, x, duration: 750, delay: 200 });
    this.tweens.add({ targets: img, y: cy - 420, duration: 300, delay: 200, ease: "Quad.out" });
    this.tweens.add({ targets: img, y, angle: 360, duration: 450, delay: 500, ease: "Bounce.out" });
    this.tweens.add({ targets: shadow, scale: 1, duration: 750, delay: 200 });
    this.time.delayedCall(980, () => {
      img.destroy();
      shadow.destroy();
      this.addDie(tier, x, y, 0);
    });
    this.toast(`The crystal dropped a ${tier} die!`, TIER_INFO[tier].css);
  }

  /** A gadget crate parachutes down near you. The longer you survive, the better the gadget inside. */
  /** A skill crate parachutes down near you: open it to pick one of three skills. */
  private airdrop(): void {
    const [x, y] = this.randomSpot(500, 1200, [this.hero.x, this.hero.y]);
    const p = this.addPickup("airdrop", x, y, 60000);
    p.ready = false;
    const color = 0xffd23f;
    p.glow.setTint(color).setAlpha(0);
    const shadow = this.add.ellipse(x, y, 30, 12, 0x000000, 0.25).setDepth(y - 2);
    const chute = this.add.image(x, y - 1110, "parachute").setOrigin(0.5, 1).setDepth(TOP + 9050);
    p.img.setY(y - 1000).setDepth(TOP + 9051);
    p.extra.push(shadow);
    this.tweens.add({ targets: chute, angle: { from: -8, to: 8 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.tweens.add({ targets: shadow, scaleX: 3.4, scaleY: 3.4, duration: 3000 });
    this.tweens.add({
      targets: chute, y: y - 110, duration: 3000, ease: "Sine.in",
      onUpdate: () => p.img.setY(chute.y + 110),
      onComplete: () => {
        p.img.setPosition(x, y).setDepth(y);
        p.ready = true;
        this.puff.setParticleTint(0xe8d8b8);
        this.puff.explode(14, x, y - 20);
        sfx.boom();
        this.tweens.add({ targets: chute, alpha: 0, y: chute.y - 60, duration: 600, onComplete: () => chute.destroy() });
        p.glow.setAlpha(0.9);
        // a golden light beam so you can find it
        const beam = this.add.rectangle(x, y - 320, 56, 640, color, 0.35).setDepth(y - 2);
        this.tweens.add({ targets: beam, alpha: 0.12, duration: 500, yoyo: true, repeat: -1 });
        p.extra.push(beam);
      },
    });
    this.banner("SKILL DROP!", "gold", 900);
    sfx.airdrop();
  }

  private collect(p: Pickup): void {
    this.tweens.killTweensOf(p.img);
    p.glow.destroy();
    p.extra.forEach((o) => o.destroy());
    const [x, y] = [p.x, p.y - 50];
    this.sparks.setParticleTint(p.kind === "dice" ? TIER_INFO[p.tier!].color : PICK_GLOW[p.kind]);
    this.sparks.explode(18, x, y);
    switch (p.kind) {
      case "dice":
        this.addDice(p.tier!, 1);
        if (p.quest) this.huntDie();
        break;
      case "heart":
        this.heal(0.4);
        this.toast("+40% health", "#ff9ab0");
        break;
      case "magnet":
        this.food.forEach((g) => (g.pulled = true));
        sfx.lucky();
        this.toast("MAGNET! All bones and meat fly to you", "#a8b8ff");
        break;
      case "bomb":
        this.bomb();
        break;
      case "freeze":
        this.frozenUntil = this.time.now + 5000;
        this.enemies.forEach((e) => e.img.setTint(0x9ae6ff));
        this.cameras.main.flash(200, 200, 240, 255);
        sfx.lucky();
        this.toast("FREEZE! Monsters can't move for 5s", "#9ae6ff");
        break;
      case "orb":
        sfx.fanfare();
        this.toast("Skill orb! Pick a skill", "#ffe066");
        this.pendingSkills++;
        this.offerChoice();
        break;
      case "chest":
        this.openChest(p);
        return;
      case "airdrop":
        this.openAirdrop(p);
        return;
    }
    this.tweens.add({ targets: p.img, y: y - 80, scale: 1.4, alpha: 0, duration: 350, onComplete: () => p.img.destroy() });
  }

  /**
   * A new kind of gadget fills a free slot (or replaces your weakest one if it is stronger);
   * the same kind moves up to the better tier or gains a level; anything else is scrapped
   * for money and XP.
   */
  /** A skill crate opens: pick one of three skills. */
  private openAirdrop(p: Pickup): void {
    this.stats.airdrops++;
    this.cameras.main.flash(200, 255, 245, 220);
    sfx.reveal(4);
    this.puff.setParticleTint(0xffd23f);
    this.puff.explode(24, p.x, p.y - 50);
    this.tweens.add({ targets: p.img, scaleX: 1.3, scaleY: 0.7, alpha: 0, duration: 260, onComplete: () => p.img.destroy() });
    this.pendingSkills++;
    this.offerChoice();
  }

  private addDice(tier: Tier, n: number): void {
    // the Super Drops pass: every die counts twice
    if (hasPass("drops")) n *= 2;
    save.dice[tier] += n;
    this.stats.dice[tier] += n;
    persist();
    sfx.dice();
    buzz(25);
    this.game.events.emit("dice", tier, n);
    questEvent("dice", n);
    if (tierIndex(tier) >= 3) this.toast(`${TIER_INFO[tier].name.toUpperCase()} DIE (${tier})!`, TIER_INFO[tier].css);
  }

  private openChest(c: Pickup): void {
    const cash = Math.max(300, save.cashPerSec * 30, monsterCash(40, save.stage)) * chestMult();
    const gems = Math.random() < 0.1 ? 1 + Math.floor(Math.random() * 2) : 0;
    save.cash += cash;
    save.gems += gems;
    this.stats.earned += cash;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.addDice(rollDiceTier(save.stage + 5), 1);
    sfx.fanfare();
    buzz(80);
    c.img.setTexture("chest_open");
    this.tweens.add({ targets: c.img, scaleX: 1.25, scaleY: 0.8, duration: 90, yoyo: true });
    this.tweens.add({ targets: c.img, alpha: 0, delay: 1200, duration: 400, onComplete: () => c.img.destroy() });
    this.sparks.setParticleTint(0xffe066);
    this.sparks.explode(30, c.x, c.y - 50);
    this.flyCash(c.x, c.y - 60, 12);
    this.toast(`Treasure! +${fmt(cash)} money  +${n} dice${gems ? `  +${gems} gems` : ""}`, "#ffe066");
  }

  /** Bones and meat fly to you once you are close (the magnet skill reaches farther). */
  private updateFood(delta: number): void {
    const reach = PICK_R * this.magnetMult();
    const hx = this.hero.x;
    const hy = this.hero.y - 50;
    this.food = this.food.filter((g) => {
      const dx = hx - g.img.x;
      const dy = hy - g.img.y;
      const d = Math.hypot(dx, dy);
      if (!g.pulled && d < reach) g.pulled = true;
      if (!g.pulled) return true;
      g.speed = Math.min(2400, g.speed + delta * 2.6);
      const step = (g.speed * delta) / 1000;
      if (d <= step + 30) {
        g.img.destroy();
        this.gainXp(g.value);
        sfx.xp();
        return false;
      }
      g.img.x += (dx / d) * step;
      g.img.y += (dy / d) * step;
      g.img.setDepth(g.img.y);
      return true;
    });
  }

  private dropFood(x: number, y: number, value: number): void {
    if (this.food.length >= 300) {
      // too much lying around: add it to an old piece
      const g = this.food[Math.floor(Math.random() * this.food.length)];
      g.value += value;
      g.img.setTexture(FOOD_TEX(g.value));
      return;
    }
    const img = this.add.image(x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-10, 10), FOOD_TEX(value))
      .setScale(0).setAngle(Phaser.Math.Between(-30, 30)).setDepth(y);
    this.tweens.add({ targets: img, scale: 0.95, duration: 200, ease: "Back.out" });
    this.food.push({ img, value, pulled: false, speed: 300 });
  }

  // ───────────────────────── levels and skills ─────────────────────────

  private gainXp(v: number): void {
    this.xp += v;
    while (this.xp >= xpFor(this.level)) {
      this.xp -= xpFor(this.level);
      this.level++;
      this.pendingLevels++;
    }
    battle.level = this.level;
    battle.xp = this.xp / xpFor(this.level);
    if (this.pendingLevels) this.offerChoice();
  }

  /** Level-ups offer gadgets; skill orbs, airdrops and elites offer skills. Gadgets go first. */
  private offerChoice(): void {
    if (battle.choosing || !this.fighting) return;
    if (this.pendingLevels > 0) {
      const options = this.gadgetChoices();
      if (options.length) {
        this.gadgetOpts = options;
        this.openChoice("gadget-choice", { options, level: this.level, slots: this.gadgets.length });
        return;
      }
      // everything is maxed out: a heal instead
      this.pendingLevels = 0;
      this.heal(0.2);
    }
    if (this.pendingSkills > 0) {
      const choices = skillChoices(this.skills, 3, this.stageMode !== "crystal");
      if (!choices.length) {
        this.pendingSkills = 0;
        this.heal(0.2);
        return;
      }
      this.openChoice("skill-choice", { choices, levels: { ...this.skills }, level: this.level });
    }
  }

  private openChoice(event: string, info: object): void {
    battle.choosing = true;
    this.joy = { ...NO_JOY };
    sfx.levelUp();
    buzz(40);
    this.game.events.emit(event, info);
    this.scene.pause();
  }

  /** Up to three gadget offers: level up or tier up what you carry, or a new kind while a slot is free. */
  private gadgetChoices(): GadgetOption[] {
    const cap = gadgetTierCap();
    const upgrades: GadgetOption[] = [];
    for (const g of this.gadgets) {
      const t = tierIndex(g.tier);
      if (g.level < MAX_GADGET_LEVEL) upgrades.push({ what: "level", kind: g.kind, tier: g.tier, level: g.level + 1 });
      else if (t < cap) upgrades.push({ what: "tier", kind: g.kind, tier: GADGET_TIERS[t + 1], level: g.level });
    }
    const fresh: GadgetOption[] = [];
    if (this.gadgets.length < GADGET_SLOTS) {
      for (const kind of shuffle(GADGET_KINDS.filter((k) => !this.gadgets.some((g) => g.kind === k)))) {
        const rolled = tierIndex(rollGadgetTier(this.elapsed / 60000, this.lv("luck")));
        fresh.push({ what: "new", kind, tier: GADGET_TIERS[Math.min(cap, rolled)], level: 1 });
      }
    }
    // with a free slot there is always at least one new gadget on offer
    const rest = shuffle([...fresh.slice(1), ...upgrades]);
    return (fresh.length ? [fresh[0], ...rest] : rest).slice(0, 3);
  }

  private onGadgetPicked(i: number): void {
    if (!battle.choosing) return;
    battle.choosing = false;
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
    const o = this.gadgetOpts[i];
    if (o) {
      const own = this.gadgets.find((g) => g.kind === o.kind);
      if (own) {
        own.tier = o.tier;
        own.level = o.level;
      } else {
        this.addGadget(o.kind, o.tier);
      }
      this.refreshHand(o.kind);
      this.handKick = 1;
      this.sparks.setParticleTint(TIER_INFO[o.tier].color);
      this.sparks.explode(28, this.hero.x, this.hero.y - 80);
      const what = o.what === "new" ? "NEW!" : o.what === "level" ? `Lv ${o.level}` : `${o.tier}!`;
      this.callout(`${gadgetName(o.kind, o.tier)} ${what}`, TIER_INFO[o.tier].css);
    }
    this.time.delayedCall(300, () => this.offerChoice());
  }

  /** A name that pops up over the hero and floats away (what you just picked). */
  private callout(str: string, color: string): void {
    const t = text(this, this.hero.x, this.hero.y - 250, str, 60, color).setDepth(TOP + 9450).setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: "Back.out" });
    this.tweens.add({ targets: t, y: t.y - 120, alpha: 0, delay: 1100, duration: 500, onComplete: () => t.destroy() });
  }

  private onSkillPicked(id: SkillId): void {
    if (!battle.choosing) return;
    battle.choosing = false;
    this.pendingSkills = Math.max(0, this.pendingSkills - 1);
    const lv = (this.skills[id] ?? 0) + 1;
    this.skills[id] = lv;
    battle.skills = this.skills;
    if (id === "tough") {
      const f = this.heroHp / this.heroMax;
      this.heroMax = heroHpAt(save.stage) * villageHpMult() * (1 + 0.25 * lv);
      this.heroHp = this.heroMax * f;
      this.heal(0.3);
    }
    if (id === "mend") this.crystalHp = Math.min(this.crystalMax, this.crystalHp + this.crystalMax * 0.35);
    if (id === "pack") this.pets.forEach((p) => (p.timer = 0));
    this.sparks.setParticleTint(SKILL_BY_ID[id].color);
    this.sparks.explode(24, this.hero.x, this.hero.y - 80);
    this.callout(`${SKILL_BY_ID[id].name} ${lv === 1 ? "NEW!" : `Lv ${lv}`}`, rgba(lighten(SKILL_BY_ID[id].color, 0.3)));
    this.game.events.emit("skills-changed");
    this.time.delayedCall(300, () => this.offerChoice());
  }

  private lv(id: SkillId): number {
    return this.skills[id] ?? 0;
  }

  private magnetMult(): number {
    return (1 + 0.5 * this.lv("vacuum"));
  }

  private heal(frac: number): void {
    this.heroHp = Math.min(this.heroMax, this.heroHp + this.heroMax * frac);
    this.sparks.setParticleTint(0x8af06a);
    this.sparks.explode(14, this.hero.x, this.hero.y - 80);
  }

  /** Standing still for a moment builds a box fort (with the Box Fort skill). */
  private get fortified(): boolean {
    return this.lv("fort") > 0 && this.stillFor > 1000;
  }

  /** Crystal Shards: the crystal fires homing shards at monsters around it. */
  private crystalShards(delta: number): void {
    const lv = this.lv("shards");
    if (!lv || battle.bossFight || (this.shardTimer -= delta) > 0) return;
    this.shardTimer = 1300 - 120 * lv;
    const [cx, cy] = this.crystalHome;
    const targets = this.nearestEnemies(cx, cy, 700 + 80 * lv, 1 + lv);
    const dmg = this.heroDamage() * (0.8 + 0.3 * lv);
    targets.forEach((t, i) => this.time.delayedCall(i * 70, () => this.fire(cx, cy - 160, t, dmg, "shard", this.land.crystal, 0, 1.1, 1500)));
  }

  // ───────────────────────── gadgets ─────────────────────────

  private addGadget(kind: GadgetKind, tier: Tier, level = 1): void {
    this.gadgets.push({ kind, tier, level, timer: 300, cd: 0 });
    this.refreshHand();
  }

  private refreshHand(kind?: GadgetKind): void {
    battle.gadgets = this.gadgets;
    if (kind) this.handKind = kind;
    if (!this.gadgets.some((g) => g.kind === this.handKind)) {
      if (!this.gadgets[0]) return;
      this.handKind = this.gadgets[0].kind;
    }
    this.handImg.setTexture(gadgetKey(this.handKind));
  }

  /** A soft coloured glow that rides along with a shot. */
  private shotGlow(x: number, y: number, color: number): Phaser.GameObjects.Image | undefined {
    if (!effectsOn()) return undefined;
    return this.add.image(x, y, "glow").setTint(color).setScale(0.55).setAlpha(0.75).setDepth(TOP + 8999).setBlendMode(Phaser.BlendModes.ADD);
  }

  /** A glowing dot behind something thrown (every other frame, so it stays light). */
  private trailAt(x: number, y: number, color: number): void {
    if (this.trailTick & 1) return;
    this.trail.setParticleTint(color);
    this.trail.emitParticleAt(x, y, 1);
  }

  /** A gadget's numbers right now, with this run's skills. */
  private gStats(g: GadgetSlot): GadgetBase {
    const s = gadgetStats(g.kind, g.tier, g.level);
    const quick = (1 + 0.15 * this.lv("hyper")) * (this.fortified ? 1 + 0.1 * this.lv("fort") : 1) * (1 + this.streakBonus);
    // Double Trouble: odd levels throw one more, even levels hit harder
    const multi = this.lv("double");
    return {
      ...s,
      dmg: s.dmg * (1 + 0.15 * Math.floor(multi / 2)),
      cd: s.cd / quick,
      count: s.count + Math.ceil(multi / 2),
      range: s.range * rangeMult(),
      radius: s.radius * (1 + 0.25 * this.lv("bigbang")),
      speed: s.speed,
    };
  }

  /** Spooky Aura hurts monsters close to you; Ghost Phase makes you see-through now and then with a shockwave. */
  private ghostSkills(delta: number): void {
    const haunt = this.lv("haunt");
    // Spooky Aura: a ghostly ring of wisps turning round you, as wide as its reach
    if (haunt) {
      if (!this.hauntRing) {
        this.hauntRing = this.add.image(0, 0, "bx_whirl").setTint(0x8a5ae8);
        this.hauntRing2 = this.add.image(0, 0, "bx_dash").setTint(0xb98aff);
      }
      const r = this.hauntR();
      const t = this.time.now;
      this.hauntRing.setPosition(this.hero.x, this.hero.y - 20).setDisplaySize(r * 2.1, r * 1.5).setRotation(t / 700).setAlpha(0.35 + Math.sin(t / 240) * 0.1).setDepth(6);
      this.hauntRing2!.setPosition(this.hero.x, this.hero.y - 20).setDisplaySize(r * 2, r * 1.4).setRotation(-t / 900).setAlpha(0.5).setDepth(6);
    }
    // Zoomies: dust and speed lines kick up behind you when you run
    if (this.lv("zoom") && Math.hypot(...this.heroVel) > 250) {
      this.zoomT -= delta;
      if (this.zoomT <= 0) {
        this.zoomT = 90;
        this.puff.setParticleTint(0xbff0e0);
        this.puff.explode(2, this.hero.x - Math.sign(this.heroVel[0]) * 30, this.hero.y);
        const ln = this.add.image(this.hero.x, this.hero.y - 60 + Phaser.Math.Between(-40, 40), "bx_beam").setTint(0x4fd0b0).setDisplaySize(120, 10)
          .setRotation(Math.atan2(this.heroVel[1], this.heroVel[0])).setAlpha(0.7).setDepth(this.hero.y - 2).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: ln, x: ln.x - this.heroVel[0] * 0.2, y: ln.y - this.heroVel[1] * 0.2, alpha: 0, duration: 260, onComplete: () => ln.destroy() });
      }
    }
    if (haunt) {
      this.hauntT -= delta;
      if (this.hauntT <= 0) {
        this.hauntT = 500;
        const r = this.hauntR();
        for (const e of this.near(this.hero.x, this.hero.y, r)) this.hit(e, this.heroDamage() * 0.3 * haunt, true);
      }
    }
    const phase = this.lv("phase");
    if (!phase) return;
    this.ghostT -= delta;
    if (this.ghostT > 0) return;
    this.ghostT = 7000 - 800 * (phase - 1);
    this.phasingUntil = this.time.now + 1000;
    this.tweens.add({ targets: this.hero, alpha: 0.4, duration: 120, yoyo: true, hold: 760 });
    this.blast(this.hero.x, this.hero.y - 40, 240 + 20 * phase, this.heroDamage() * 2 * phase, null, 0xb98aff);
    // a ghostly shockwave and ghost faces flying out
    const rr = 240 + 20 * phase;
    const sw = this.add.image(this.hero.x, this.hero.y - 20, "bx_shock").setTint(0xc8a8ff).setScale(0.3, 0.2).setDepth(TOP + 9000).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: sw, scaleX: rr / 60, scaleY: rr / 90, alpha: 0, duration: 420, ease: "Quad.out", onComplete: () => sw.destroy() });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const gh = this.add.image(this.hero.x, this.hero.y - 80, "gd_wisp").setTint(0xd8c8ff).setScale(0.6).setAlpha(0.9).setDepth(TOP + 9001);
      this.tweens.add({ targets: gh, x: gh.x + Math.cos(a) * rr, y: gh.y + Math.sin(a) * rr * 0.7, alpha: 0, scale: 1.1, duration: 480, ease: "Quad.out", onComplete: () => gh.destroy() });
    }
    sfx.charge(5);
  }

  private hauntRing: Phaser.GameObjects.Image | null = null;
  private hauntRing2: Phaser.GameObjects.Image | null = null;
  private zoomT = 0;

  private hauntR(): number {
    return 210 + 25 * this.lv("haunt");
  }

  /** Every gadget fires on its own when it is ready and something is in reach. */
  private gadgetsTick(delta: number): void {
    const hx = this.hero.x;
    const hy = this.hero.y - 60;
    const first = this.nearestEnemies(hx, hy, 1000, 1)[0];
    const aim = first ? Math.atan2(first.img.y - first.img.displayHeight * 0.4 - this.handImg.y, first.img.x - this.handImg.x) : this.hero.flipX ? Math.PI : 0;
    this.handAim = Phaser.Math.Angle.RotateTo(this.handAim, aim, 0.25);
    // the gadget that just fired kicks up in your hand
    this.handKick = Math.max(0, this.handKick - delta / 220);
    const kick = Math.sin(this.handKick * Math.PI);
    this.handImg.setRotation(this.handAim - kick * 0.8 * (Math.cos(this.handAim) < 0 ? -1 : 1));
    this.handImg.setScale((56 / Math.max(this.handImg.width, this.handImg.height)) * (1 + 0.5 * kick));
    this.trailTick++;
    const base = this.heroDamage();
    for (const g of this.gadgets) {
      g.timer -= delta;
      if (g.timer > 0) continue;
      const st = this.gStats(g);
      const dmg = base * st.dmg;
      const targets = this.nearestEnemies(hx, hy, st.range, Math.max(1, st.count));
      if (!targets.length) continue;
      g.timer = g.cd = st.cd;
      this.stats.shots++;
      if (g.kind !== this.handKind) this.refreshHand(g.kind);
      this.handKick = 1;
      this.sparks.setParticleTint(GADGETS[g.kind].color);
      this.sparks.explode(4, this.handImg.x, this.handImg.y);
      // a muzzle flash ring at your hand
      const mz = this.add.image(this.handImg.x, this.handImg.y, "fx_ring").setTint(GADGETS[g.kind].color).setScale(0.15).setDepth(TOP + 9060).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: mz, scale: 0.6, alpha: 0, duration: 180, onComplete: () => mz.destroy() });
      switch (g.kind) {
        case "shuriken": {
          for (let i = 0; i < st.count; i++) {
            const t = targets[i % targets.length];
            const a = Math.atan2(t.img.y - t.img.displayHeight * 0.4 - hy, t.img.x - hx) + (i >= targets.length ? (Math.random() - 0.5) * 0.4 : 0);
            const img = this.add.image(hx, hy, "gd_shuriken").setDepth(TOP + 9000).setScale(1.35);
            this.bullets.push({ img, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed, life: (st.range / st.speed) * 1000, dmg, pierce: st.pierce, explode: 0, splash: 0, hit: [], spin: 20, trail: 0x9ad0ff, glow: this.shotGlow(hx, hy, 0x9ad0ff) });
          }
          sfx.shoot(false);
          break;
        }
        case "wisp":
          // every wisp circling you darts at a different monster
          this.wisps.filter((w) => w.state === "orbit").forEach((w, i) => {
            w.state = "out";
            w.target = targets[i % targets.length];
            w.dmg = dmg;
          });
          break;
        case "bubble":
          for (let i = 0; i < st.count; i++) {
            const t = targets[i % targets.length];
            const a = Math.atan2(t.img.y - 40 - hy, t.img.x - hx) + (i ? (Math.random() - 0.5) * 0.6 : 0);
            const img = this.add.image(hx, hy, "gd_bubble").setDepth(TOP + 9000).setScale(0.4);
            this.tweens.add({ targets: img, scale: 1.45, duration: 300, ease: "Back.out" });
            this.bubbles.push({ img, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed, life: (st.range / st.speed) * 1000 + 600, dmg, r: st.radius, held: null, popAt: 0 });
          }
          sfx.shoot(false);
          break;
        case "glue":
          for (let i = 0; i < st.count; i++) this.splatGlue(targets[i % targets.length], dmg, st.radius);
          sfx.shoot(false);
          break;
        case "kite":
          for (let i = 0; i < st.count; i++) this.lightning(targets[i % targets.length], dmg, st.pierce);
          sfx.shoot(true);
          break;
        case "popcorn": {
          const off = Math.random() * Math.PI;
          for (let i = 0; i < st.count; i++) {
            const a = off + (i / st.count) * Math.PI * 2;
            const img = this.add.image(hx, hy, "gd_kernel").setDepth(TOP + 9000).setScale(1.6);
            this.bullets.push({ img, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed, life: (st.range / st.speed) * 1000, dmg, pierce: st.pierce, explode: 0, splash: 0, hit: [], spin: 8, trail: 0xffb347, glow: this.shotGlow(hx, hy, 0xffb347) });
          }
          sfx.shoot(false);
          break;
        }
        case "boomerang":
          for (let i = 0; i < st.count; i++) {
            const t = targets[0];
            const a = Math.atan2(t.img.y - 40 - hy, t.img.x - hx) + (i - (st.count - 1) / 2) * 0.35;
            const img = this.add.image(hx, hy, "gd_boomerang").setDepth(TOP + 9000).setScale(1.45);
            this.rangs.push({ img, dx: Math.cos(a), dy: Math.sin(a), speed: st.speed, went: 0, max: st.range, back: false, dmg, hit: new Set(), glow: this.shotGlow(hx, hy, 0xffcf3a) });
          }
          sfx.shoot(false);
          break;
        case "grenade":
          for (let i = 0; i < st.count; i++) this.lobGrenade(targets[i % targets.length], dmg, st.radius, tierIndex(g.tier) >= 5);
          sfx.shoot(true);
          break;
      }
    }
  }

  /** A blob of glue flies onto a monster and spreads into a sticky puddle for 4 s. */
  private splatGlue(t: Enemy, dmg: number, r: number): void {
    const [sx, sy] = [this.hero.x, this.hero.y - 70];
    const [tx, ty] = [t.img.x, t.img.y];
    const blob = this.add.image(sx, sy, "gd_glue").setDepth(TOP + 9200).setScale(1);
    const k = { t: 0 };
    this.tweens.add({
      targets: k, t: 1, duration: 450,
      onUpdate: () => {
        blob.setPosition(sx + (tx - sx) * k.t, sy + (ty - sy) * k.t - Math.sin(k.t * Math.PI) * 200).setAngle(k.t * 360);
        this.trailAt(blob.x, blob.y, 0xe8f0f8);
      },
      onComplete: () => {
        blob.destroy();
        const sp = this.add.image(tx, ty - 10, "bx_splat").setTint(0xf0f6ff).setScale(0.2).setDepth(ty + 5);
        this.tweens.add({ targets: sp, scale: r / 120, duration: 140, ease: "Back.out" });
        this.tweens.add({ targets: sp, alpha: 0, delay: 200, duration: 300, onComplete: () => sp.destroy() });
        this.puff.setParticleTint(0xf0f6ff);
        this.puff.explode(8, tx, ty);
        const img = this.add.image(tx, ty, "gd_puddle").setDepth(-600).setScale(0.2).setAlpha(0.95);
        this.tweens.add({ targets: img, scale: r / 100, duration: 220, ease: "Back.out" });
        this.puddles.push({ img, x: tx, y: ty, r, until: this.time.now + 4000, dmg, tick: 0 });
      },
    });
  }

  /** The kite calls lightning onto a monster; it jumps on to the nearest ones it has not hit yet. */
  private lightning(first: Enemy, dmg: number, jumps: number): void {
    let [px, py] = this.kite ? [this.kite.x, this.kite.y + 40] : [this.hero.x, this.hero.y - 220];
    const g = this.add.graphics().setDepth(TOP + 9100);
    const hit: Enemy[] = [];
    let cur: Enemy | undefined = first;
    while (cur && hit.length <= jumps) {
      const x: number = cur.img.x;
      const y: number = cur.img.y - cur.img.displayHeight * 0.4;
      // a jagged bolt, a wide yellow glow under a thin white core
      const pts: [number, number][] = [[px, py]];
      for (let k = 1; k < 6; k++) pts.push([px + ((x - px) * k) / 6 + (Math.random() - 0.5) * 50, py + ((y - py) * k) / 6 + (Math.random() - 0.5) * 50]);
      pts.push([x, y]);
      for (const [w, c, a] of [[34, 0xffe066, 0.25], [16, 0xffe066, 0.95], [6, 0xffffff, 1]] as [number, number, number][]) {
        g.lineStyle(w, c, a).beginPath().moveTo(pts[0][0], pts[0][1]);
        for (const [qx, qy] of pts.slice(1)) g.lineTo(qx, qy);
        g.strokePath();
      }
      // little forks crackling off the bolt
      for (let f = 1; f < pts.length - 1; f += 2) {
        const [fx, fy] = pts[f];
        const a = Math.random() * Math.PI * 2;
        g.lineStyle(4, 0xfff6b0, 0.9).beginPath().moveTo(fx, fy).lineTo(fx + Math.cos(a) * 40, fy + Math.sin(a) * 40).lineTo(fx + Math.cos(a + 0.6) * 70, fy + Math.sin(a + 0.6) * 70).strokePath();
      }
      this.hitFx(x, y, 0xffe066, 0.9);
      hit.push(cur);
      this.hit(cur, dmg);
      this.sparks.setParticleTint(0xffe066);
      this.sparks.explode(6, x, y);
      [px, py] = [x, y];
      cur = this.nearestEnemies(x, y + 40, 380, 6).find((e) => !hit.includes(e));
    }
    g.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: g, alpha: 0.3, duration: 50, yoyo: true, repeat: 1 });
    this.tweens.add({ targets: g, alpha: 0, delay: 200, duration: 200, onComplete: () => g.destroy() });
  }

  /** A bubble pops: a splash that hurts everything around it. */
  private popBubble(b: { img: Phaser.GameObjects.Image; dmg: number; r: number }): void {
    this.blast(b.img.x, b.img.y + 30, b.r, b.dmg, null, 0xb8e8ff);
    const ring = this.add.image(b.img.x, b.img.y, "fx_ring").setTint(0xd8f4ff).setScale(0.3).setDepth(TOP + 9050);
    this.tweens.add({ targets: ring, scale: b.r / 50, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    this.sparks.setParticleTint(0xb8e8ff);
    this.sparks.explode(12, b.img.x, b.img.y);
    b.img.destroy();
  }

  /** Grenades fly in an arc; S tier and up open a black hole that pulls monsters in before it bursts. */
  private lobGrenade(t: Enemy, dmg: number, r: number, hole: boolean): void {
    const sx = this.hero.x;
    const sy = this.hero.y - 70;
    const tx = t.img.x;
    const ty = t.img.y - 10;
    const img = this.add.image(sx, sy, "gd_grenade").setDepth(TOP + 9200).setScale(1.3);
    const k = { t: 0 };
    this.tweens.add({
      targets: k, t: 1, duration: 600, ease: "Linear",
      onUpdate: () => {
        img.setPosition(sx + (tx - sx) * k.t, sy + (ty - sy) * k.t - Math.sin(k.t * Math.PI) * 260).setAngle(k.t * 540);
        this.trailAt(img.x, img.y, hole ? 0xb98aff : 0xffa64d);
      },
      onComplete: () => {
        img.destroy();
        if (!hole) {
          this.blast(tx, ty, r, dmg, null);
          return;
        }
        const h = this.add.image(tx, ty - 30, "gd_hole").setDepth(ty - 3).setScale(0.2);
        this.tweens.add({ targets: h, scale: (r / 75) * 1.1, duration: 250, ease: "Back.out" });
        this.tweens.add({ targets: h, angle: -720, duration: 1000 });
        this.holes.push({ img: h, x: tx, y: ty, r: r * 1.5, until: this.time.now + 950, dmg: dmg * 1.6 });
        // purple sparks spiralling into it, a whirl spinning round it
        const swirl = this.add.image(tx, ty - 30, "bx_whirl").setTint(0xb98aff).setScale(0.2).setAlpha(0.8).setDepth(ty - 2).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: swirl, scale: (r / 100) * 1.4, angle: -900, duration: 950, onComplete: () => swirl.destroy() });
        if (effectsOn()) {
          const suck = this.add.particles(tx, ty - 30, "spark", {
            lifespan: 450, scale: { start: 0.6, end: 0 }, tint: [0xb98aff, 0xffffff, 0x6a3aff], blendMode: Phaser.BlendModes.ADD, frequency: 20, quantity: 2,
            emitZone: { type: "edge", source: new Phaser.Geom.Circle(0, 0, r * 1.4), quantity: 24 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
            moveToX: 0, moveToY: 0,
          }).setDepth(ty);
          this.time.delayedCall(950, () => suck.destroy());
        }
        sfx.thunder();
      },
    });
  }

  /** Everything gadgets leave behind: wisps, the kite, bubbles, glue, boomerangs and black holes. */
  private moveGadgets(time: number, delta: number): void {
    const dt = delta / 1000;
    const fighting = this.fighting;
    // ghost wisps circle you, dart at a monster and come back
    const wisp = this.gadgets.find((g) => g.kind === "wisp");
    if (wisp) {
      const st = this.gStats(wisp);
      while (this.wisps.length < st.count) this.wisps.push({ img: this.add.image(this.hero.x, this.hero.y - 80, "gd_wisp").setScale(1.3), state: "orbit", target: null, dmg: 0 });
      while (this.wisps.length > st.count) this.wisps.pop()!.img.destroy();
      this.wisps.forEach((w, i) => {
        const a = time / 600 + (i / this.wisps.length) * Math.PI * 2;
        const ox = this.hero.x + Math.cos(a) * 150;
        const oy = this.hero.y - 90 + Math.sin(a) * 100;
        if (w.state === "out" && (!w.target || !this.enemies.includes(w.target))) w.state = "back";
        if (w.state === "orbit") {
          w.img.setPosition(ox, oy);
        } else {
          const t = w.target;
          const [tx, ty] = w.state === "out" && t ? [t.img.x, t.img.y - t.img.displayHeight * 0.4] : [ox, oy];
          const dx = tx - w.img.x;
          const dy = ty - w.img.y;
          const d = Math.hypot(dx, dy);
          const step = st.speed * dt;
          if (d > step + 30) {
            w.img.setPosition(w.img.x + (dx / d) * step, w.img.y + (dy / d) * step);
            this.trailAt(w.img.x, w.img.y, 0x7ee0ff);
          } else if (w.state === "out" && t) {
            if (fighting) this.hit(t, w.dmg);
            this.sparks.setParticleTint(0x7ee0ff);
            this.sparks.explode(6, tx, ty);
            w.state = "back";
          } else {
            w.state = "orbit";
          }
        }
        w.img.setDepth(w.img.y + 60).setScale(1.3 + Math.sin(time / 120 + i) * 0.08);
      });
    }
    // the storm kite flies over your shoulder
    if (this.gadgets.some((g) => g.kind === "kite")) {
      if (!this.kite) this.kite = this.add.image(this.hero.x - 120, this.hero.y - 300, "gd_kite").setScale(1.2);
      this.kiteT += dt;
      const x = this.hero.x - 120 + Math.cos(this.kiteT * 1.1) * 60;
      const y = this.hero.y - 300 + Math.sin(this.kiteT * 2.2) * 24;
      this.kite.setPosition(this.kite.x + (x - this.kite.x) * 0.08, this.kite.y + (y - this.kite.y) * 0.08).setAngle(Math.sin(this.kiteT * 2) * 12).setDepth(this.hero.y + 300);
    }
    // bubbles float on; one that touches a monster holds it, then pops
    this.bubbles = this.bubbles.filter((b) => {
      if (b.held) {
        if (this.enemies.includes(b.held)) b.img.setPosition(b.held.img.x, b.held.img.y - b.held.img.displayHeight * 0.45);
        if (this.time.now < b.popAt) return true;
        this.popBubble(b);
        return false;
      }
      b.img.x += b.vx * dt;
      b.img.y += b.vy * dt;
      b.life -= delta;
      this.trailAt(b.img.x, b.img.y + 20, 0x9ae6ff);
      const e = fighting ? this.near(b.img.x, b.img.y + 50, 70)[0] : undefined;
      if (e) {
        b.held = e;
        b.popAt = this.time.now + (e.type.boss ? 0 : 1100);
        if (!e.type.boss) e.stunUntil = b.popAt;
        this.tweens.add({ targets: b.img, scale: 1.8, duration: 160, ease: "Back.out" });
        return true;
      }
      if (b.life > 0) return true;
      this.popBubble(b);
      return false;
    });
    // glue puddles slow monsters down and keep hurting them
    this.puddles = this.puddles.filter((p) => {
      if (this.time.now > p.until) {
        this.tweens.add({ targets: p.img, alpha: 0, duration: 300, onComplete: () => p.img.destroy() });
        return false;
      }
      p.tick -= delta;
      if (fighting && p.tick <= 0) {
        p.tick = 500;
        for (const e of this.near(p.x, p.y, p.r)) if (Math.hypot(e.img.x - p.x, (e.img.y - p.y) * 2) < p.r) this.hit(e, p.dmg, true);
      }
      return true;
    });
    // boomerangs fly out, then home back to you
    this.rangs = this.rangs.filter((b) => {
      const step = b.speed * dt;
      if (!b.back) {
        b.img.x += b.dx * step;
        b.img.y += b.dy * step;
        b.went += step;
        if (b.went >= b.max) {
          b.back = true;
          b.hit.clear();
        }
      } else {
        const dx = this.hero.x - b.img.x;
        const dy = this.hero.y - 60 - b.img.y;
        const d = Math.hypot(dx, dy);
        if (d < 50) {
          b.img.destroy();
          b.glow?.destroy();
          return false;
        }
        b.img.x += (dx / d) * step * 1.1;
        b.img.y += (dy / d) * step * 1.1;
      }
      b.img.rotation += dt * 16;
      b.glow?.setPosition(b.img.x, b.img.y);
      this.trailAt(b.img.x, b.img.y, 0xffcf3a);
      if (fighting) for (const e of this.near(b.img.x, b.img.y + 40, 70)) {
        if (b.hit.has(e)) continue;
        b.hit.add(e);
        this.hit(e, b.dmg);
        this.hitFx(b.img.x, b.img.y, 0xffcf3a, 0.6);
      }
      return true;
    });
    // black holes pull monsters in, then burst
    this.holes = this.holes.filter((h) => {
      for (const e of this.near(h.x, h.y, h.r)) {
        if (e.type.boss) continue;
        const dx = h.x - e.img.x;
        const dy = h.y - e.img.y;
        const d = Math.hypot(dx, dy) || 1;
        e.img.x += (dx / d) * Math.min(d, 520 * dt);
        e.img.y += (dy / d) * Math.min(d, 520 * dt);
      }
      if (time < h.until) return true;
      this.tweens.add({ targets: h.img, scale: 0, alpha: 0, duration: 200, onComplete: () => h.img.destroy() });
      this.blast(h.x, h.y - 20, h.r, h.dmg, null);
      this.cameras.main.shake(140, 0.005);
      return false;
    });
  }

  /** Clear thrown things (the boss is coming). */
  private clearThrown(): void {
    [...this.rangs, ...this.bubbles, ...this.puddles, ...this.holes].forEach((b) => b.img.destroy());
    this.rangs.forEach((b) => b.glow?.destroy());
    this.rangs = [];
    this.bubbles = [];
    this.puddles = [];
    this.holes = [];
  }

  private moveBullets(delta: number): void {
    const dt = delta / 1000;
    const G = 90;
    this.bullets = this.bullets.filter((b) => {
      b.img.x += b.vx * dt;
      b.img.y += b.vy * dt;
      if (b.spin) b.img.rotation += b.spin * dt;
      if (b.trail !== undefined) this.trailAt(b.img.x, b.img.y, b.trail);
      b.glow?.setPosition(b.img.x, b.img.y);
      b.life -= delta;
      let alive = b.life > 0;
      // look for a monster it touches (around where that monster's feet would be)
      const gx = Math.floor(b.img.x / G);
      const gy = Math.floor((b.img.y + 45) / G);
      outer: for (let ix = gx - 1; ix <= gx + 1; ix++) {
        for (let iy = gy - 1; iy <= gy + 1; iy++) {
          for (const e of this.grid.get(ix * 1000 + iy) ?? []) {
            if (b.hit.includes(e) || e.hp <= 0) continue;
            const ey = e.img.y - e.img.displayHeight * (e.type.flying ? 0.5 : 0.4);
            if (Math.hypot(e.img.x - b.img.x, ey - b.img.y) > e.r + 18) continue;
            b.hit.push(e);
            this.hit(e, b.dmg);
            if (b.trail !== undefined) this.hitFx(b.img.x, b.img.y, b.trail, 0.55);
            if (b.explode) this.blast(b.img.x, b.img.y, b.explode, b.dmg * b.splash, e, b.burst ? b.img.tintTopLeft : 0);
            if (b.pierce-- <= 0) {
              alive = false;
              break outer;
            }
          }
        }
      }
      // grenades that reach the end of their flight go off anyway
      if (b.life <= 0 && !b.hit.length && b.burst) this.blast(b.img.x, b.img.y, b.explode, b.dmg, null, b.img.tintTopLeft);
      if (!alive) {
        b.img.destroy();
        b.glow?.destroy();
      }
      return alive;
    });
  }

  /** An explosion (or a water balloon splash) that hurts everything around (except the monster already hit). */
  private blast(x: number, y: number, r: number, dmg: number, skip: Enemy | null, splash = 0): void {
    if (splash) {
      sfx.boom();
      const s = this.add.image(x, y, "ring").setTint(splash).setScale(0.3).setDepth(TOP + 8990);
      this.tweens.add({ targets: s, scale: r / 70, alpha: 0, duration: 300, onComplete: () => s.destroy() });
      this.puff.setParticleTint(splash);
      this.puff.explode(12, x, y);
    } else {
      this.boom(x, y, r / 120);
    }
    for (const e of this.near(x, y + 40, r)) if (e !== skip) this.hit(e, dmg, true);
  }

  // ───────────────────────── controls ─────────────────────────

  /** Drag anywhere in the open play area for a floating joystick (WASD / arrows on desktop). */
  private setupControls(): void {
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const roam = battle.mode === "lobby" && this.roaming;
      if (this.joy.active || (battle.mode !== "run" && !roam) || !this.cameras.main.visible || p.y < this.L.hudBottom + 10) return;
      if (p.x < 220 && p.y < this.L.hudBottom + 230) return;
      // the developer speed button
      if (Math.abs(p.x - SPEED_BTN.x) < SPEED_BTN.w / 2 + 10 && Math.abs(p.y - SPEED_BTN.y) < SPEED_BTN.h / 2 + 10) return;
      // the lobby's buttons and pills sit at the bottom
      if (roam && p.y > this.L.navTop - 380) return;
      this.joy = { active: true, id: p.id, bx: p.x, by: p.y, dx: 0, dy: 0 };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.joy.active || p.id !== this.joy.id) return;
      const v = new Phaser.Math.Vector2(p.x - this.joy.bx, p.y - this.joy.by);
      if (v.length() > 90) v.setLength(90);
      this.joy.dx = v.x;
      this.joy.dy = v.y;
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id === this.joy.id) this.joy = { ...NO_JOY };
    };
    this.input.on("pointerup", release);
    this.input.on("pointerupoutside", release);
  }

  /** Joystick ring and knob, drawn by the UI scene (screen space). */
  drawJoystick(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    if (!this.joy.active) return;
    const { bx, by, dx, dy } = this.joy;
    g.fillStyle(INK_N, 0.25).fillCircle(bx, by, 100);
    g.lineStyle(5, 0xfff3dc, 0.6).strokeCircle(bx, by, 100);
    g.fillStyle(0xfff3dc, 0.85).fillCircle(bx + dx, by + dy, 44);
    g.lineStyle(5, INK_N, 0.8).strokeCircle(bx + dx, by + dy, 44);
  }

  private moveHero(time: number, delta: number): void {
    if (this.entering) {
      this.hero.setDepth(this.hero.y);
      return;
    }
    const k = this.keys;
    let vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (this.joy.active && Math.hypot(this.joy.dx, this.joy.dy) > 8) {
      vx = this.joy.dx / 90;
      vy = this.joy.dy / 90;
    }
    const roaming = this.roaming;
    if (roaming && save.afk && Math.hypot(vx, vy) < 0.05) [vx, vy] = this.afkStep();
    if (!this.fighting && !roaming) vx = vy = 0;
    const len = Math.hypot(vx, vy);
    if (len > 1) {
      vx /= len;
      vy /= len;
    }
    if (len > 0.05) {
      this.stillFor = 0;
      const step = (HERO_SPEED * moveSpeedMult() * (1 + 0.12 * this.lv("zoom")) * (this.rush ? 1 / RUSH_SLOW : 1) * delta) / 1000;
      const p = this.arena.path;
      let nx = p ? Phaser.Math.Clamp(this.hero.x + vx * step, p.x0 + 40, p.x1 - 40) : clampX(this.hero.x + vx * step);
      let ny = p ? Math.min(clampY(this.hero.y + vy * step), p.startY + 150) : clampY(this.hero.y + vy * step);
      // buildings are solid: slide along their walls
      if (this.solids.length && this.blocked(nx, ny)) {
        if (!this.blocked(nx, this.hero.y)) ny = this.hero.y;
        else if (!this.blocked(this.hero.x, ny)) nx = this.hero.x;
        else [nx, ny] = [this.hero.x, this.hero.y];
      }
      this.hero.setPosition(nx, ny).setScale(1);
      if (Math.abs(vx) > 0.1) this.hero.setFlipX(vx < 0);
      this.walkTimer += delta;
      if (this.walkTimer > 130) {
        this.walkTimer = 0;
        this.walkFrame ^= 1;
        this.hero.setTexture(this.walkFrame ? "hero_w1" : "hero_w2");
      }
    } else if (this.state !== "lost") {
      this.stillFor += delta;
      this.hero.setTexture("hero");
      this.hero.setScale(1 + Math.sin(time / 300) * 0.02, 1 - Math.sin(time / 300) * 0.02);
    }
    this.hero.setDepth(this.hero.y);
    const dir = this.hero.flipX ? -1 : 1;
    const gx = this.hero.x + HERO_HAND.x * dir;
    const gy = this.hero.y + HERO_HAND.y;
    this.handImg.setPosition(gx, gy).setDepth(this.hero.y + 1);
    const fort = this.fortified;
    this.fortImg.setPosition(this.hero.x, this.hero.y - 10).setDepth(this.hero.y - 1).setAlpha(fort ? 0.6 + Math.sin(time / 150) * 0.2 : 0);
  }

  // ───────────────────────── pets ─────────────────────────

  private buildPets(): void {
    this.pets.forEach((p) => (p.img.destroy(), p.odds.destroy()));
    this.pets = save.equipped.slice(0, Math.min(PET_SPOTS.length, petSlots())).map((id, i) => {
      const def = ITEMS[id];
      const [ox, oy] = PET_SPOTS[i];
      petTexture(this, id, 1);
      petTexture(this, id, 2);
      const img = this.add.image(this.hero.x + ox, this.hero.y + oy, petTexture(this, id)).setOrigin(0.5, 0.95).setScale(0);
      this.tweens.add({ targets: img, scale: PET_SCALE, duration: 300, ease: "Back.out" });
      const odds = classText(this, img.x, img.y, `${def.cls}  ${def.name}  ${oneIn(def.oneIn)}`, 26, def.cls).setDepth(TOP + 9200);
      const level = save.pets[id]?.level ?? 1;
      const maxHp = this.heroMax * (0.6 + 0.08 * rarityRank(def.rarity)) * Math.sqrt(levelMult(level));
      return {
        def, id, level, img, timer: Math.random() * def.cooldown, ox, oy, frame: 0, frameT: Math.random() * 150, target: null, retarget: 0, odds,
        hp: maxHp, maxHp, hurtAt: 0, down: 0,
      };
    });
  }

  /** A monster bit a pet. At zero health it is knocked out for a while. */
  private hurtPet(p: Pet, dmg: number): void {
    if (p.down > 0) return;
    p.hp -= dmg;
    p.hurtAt = this.time.now;
    p.img.setTintFill(0xff6a6a);
    this.time.delayedCall(90, () => p.down <= 0 && p.img.clearTint());
    if (p.hp > 0) return;
    p.hp = 0;
    p.down = PET_DOWN_MS;
    p.target = null;
    this.tweens.killTweensOf(p.img);
    p.img.setTexture(petTexture(this, p.id)).setTint(0x9a9aa8).setAlpha(0.6).setAngle(p.img.flipX ? -80 : 80).setScale(PET_SCALE);
    p.odds.setAlpha(0.5);
    this.puff.setParticleTint(0xffffff);
    this.puff.explode(10, p.img.x, p.img.y - 40);
    this.toast(`${p.def.name} is knocked out!`, "#ffb3b3");
  }

  /** A knocked-out pet gets back up next to you with half its health. */
  private petUp(p: Pet): void {
    p.down = 0;
    p.hp = p.maxHp * 0.5;
    p.img.clearTint().setAlpha(1).setAngle(0).setPosition(this.hero.x + p.ox * 0.5, this.hero.y + p.oy * 0.5);
    p.odds.setAlpha(1);
    this.puff.setParticleTint(0xffffff);
    this.puff.explode(10, p.img.x, p.img.y - 40);
  }

  /** How close a pet has to be to attack (pouncers bite, the rest throw things). */
  private petReach(p: Pet): number {
    return p.def.kind === "zap" ? 90 : p.def.kind === "splash" ? 380 : 440;
  }

  /**
   * Pets run around the field after monsters near you and come back when there is nothing
   * to hunt (or you got too far away). Support pets stay at your side.
   */
  private movePets(time: number, delta: number): void {
    const k = 1 - Math.exp((-delta / 1000) * 6);
    this.pets.forEach((p, i) => {
      p.odds.setPosition(p.img.x, p.img.y - 150);
      if (p.down > 0) {
        p.down -= delta;
        if (p.down <= 0) this.petUp(p);
        return;
      }
      if (time - p.hurtAt > 3000) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.03 * (delta / 1000));
      const hunter = p.def.kind !== "buff" && this.fighting;
      if (hunter) {
        p.retarget -= delta;
        const lost = !p.target || p.target.hp <= 0 || !this.enemies.includes(p.target)
          || Math.hypot(p.target.img.x - this.hero.x, p.target.img.y - this.hero.y) > PET_LEASH;
        if (lost || p.retarget <= 0) {
          p.retarget = 400;
          p.target = this.nearestEnemies(p.img.x, p.img.y, 900, 6)
            .find((e) => Math.hypot(e.img.x - this.hero.x, e.img.y - this.hero.y) < PET_LEASH) ?? null;
        }
      } else {
        p.target = null;
      }
      let dx: number;
      let dy: number;
      let moving: boolean;
      if (p.target) {
        dx = p.target.img.x - p.img.x;
        dy = p.target.img.y + 10 - p.img.y;
        const d = Math.hypot(dx, dy) || 1;
        moving = d > this.petReach(p) * 0.8;
        if (moving) {
          const step = Math.min(d, (PET_SPEED * delta) / 1000);
          p.img.setPosition(p.img.x + (dx / d) * step, p.img.y + (dy / d) * step);
        }
      } else {
        dx = this.hero.x + p.ox - p.img.x;
        dy = this.hero.y + p.oy - p.img.y;
        moving = Math.hypot(dx, dy) > 14;
        p.img.setPosition(p.img.x + dx * k, p.img.y + dy * k);
      }
      // ran off too far: hop back to you in a puff
      if (Math.hypot(this.hero.x - p.img.x, this.hero.y - p.img.y) > PET_LEASH + 500) {
        this.puff.setParticleTint(0xffffff);
        this.puff.explode(8, p.img.x, p.img.y - 40);
        p.img.setPosition(this.hero.x + p.ox * 0.5, this.hero.y + p.oy * 0.5);
        p.target = null;
      }
      if (Math.abs(dx) > 4) p.img.setFlipX(dx < 0);
      p.frameT -= delta;
      if (moving && p.frameT <= 0) {
        p.frameT = p.target ? 110 : 150;
        p.frame = p.frame === 1 ? 2 : 1;
        p.img.setTexture(petTexture(this, p.id, p.frame));
      } else if (!moving && p.frame) {
        p.frame = 0;
        p.img.setTexture(petTexture(this, p.id));
      }
      const bob = moving ? 0 : Math.sin(time / 400 + i) * 0.03;
      if (p.img.scaleX > 0.5 && !this.tweens.isTweening(p.img)) p.img.setScale(PET_SCALE * (1 + bob * 0.6), PET_SCALE * (1 - bob));
      p.img.setDepth(p.img.y);
    });
  }

  private petDamage(p: Pet): number {
    return p.def.damage * levelMult(p.level) * (1 + 0.2 * this.lv("pack"));
  }

  /** Team damage multiplier: tree upgrades plus "buff" pets. */
  private damageMult(): number {
    const buff = this.pets.filter((p) => p.def.kind === "buff").reduce((s, p) => s + this.petDamage(p) / 100, 0);
    return dmgMult() * (1 + buff) * (1 + this.streakBonus);
  }

  /** +1% damage and attack speed for every 50 kills in the current streak. */
  private get streakBonus(): number {
    return Math.floor(this.streak / STREAK_STEP) * 0.01;
  }

  private heroDamage(): number {
    const team = this.pets.filter((p) => p.def.kind !== "buff").reduce((s, p) => s + this.petDamage(p), 0);
    return (HERO_BASE_DMG + team * HERO_TEAM_SHARE) * this.damageMult() * heroDmgMult() * (1 + 0.3 * this.lv("power"));
  }

  // ───────────────────────── the stage clock ─────────────────────────

  private tick(delta: number): void {
    if (!this.fighting) return;
    if (this.rush) {
      this.rushTick(delta);
      return;
    }
    this.elapsed += delta;
    battle.time = this.elapsed;
    battle.shieldLeft = SHIELD_MS - (this.elapsed % SHIELD_MS);
    if (this.state === "fight" && this.stageMode === "crystal") this.setShield(Math.floor(this.elapsed / SHIELD_MS) % 2 === 1);
    const minute = Math.min(MINUTES, Math.floor(this.elapsed / 60000));
    if (minute > this.minute) {
      this.minute = minute;
      questEvent("wave");
      // story chapters keep their own clock (only the beast's stage runs the usual 5:00)
      const own = (!!this.story && this.stageMode !== "feed") || this.stageMode === "sea" || this.stageMode === "ocean";
      if (own && this.state === "fight" && !this.arena.sea) {
        this.swarm(this.arena.path ? 10 + minute * 6 : 20 + minute * 10);
      } else if (!own && minute < MINUTES) {
        sfx.alarm();
        buzz(60);
        this.banner(minute === MINUTES - 1 ? "LAST MINUTE!" : `${MINUTES - minute} MINUTES LEFT`, "red", 1000);
        this.toast("Monsters get stronger!", "#ff9a9a");
        this.swarm(30 + minute * 12);
      }
    }
    if (this.story) this.storyTick(delta);
    if (this.state === "fight" && this.stageMode === "crystal" && this.elapsed >= this.crystalDieAt) {
      this.crystalDieAt += CRYSTAL_DIE_MS;
      this.crystalDie();
    }
    if (this.state === "fight" && this.elapsed >= STAGE_MS && (!this.story || this.stageMode === "feed") && this.stageMode !== "sea" && this.stageMode !== "ocean") this.bossCutscene();
  }

  private types(): Record<"a" | "b" | "f", EnemyType> {
    if (this.stageMode === "sea" || this.stageMode === "ocean") {
      return {
        a: { tex: "e_octo", stats: WALKER_A, fx: 0xb46ad8 },
        b: { tex: "e_octo_r", stats: WALKER_B, fx: 0xff7a5a },
        f: { tex: "e_crow", stats: FLYER, fx: 0xffffff, flying: true },
      };
    }
    const [a, b, f] = this.land.enemies;
    return {
      a: { tex: a, stats: WALKER_A, fx: 0x9ad46a },
      b: { tex: b, stats: WALKER_B, fx: 0xef6a5a },
      f: { tex: f, stats: FLYER, fx: 0x8a6ad0, flying: true },
    };
  }

  private pickType(): EnemyType {
    const t = this.types();
    const r = Math.random();
    if (this.minute >= 1 && r < 0.25) return t.f;
    if ((this.minute >= 1 || save.stage > 1) && r < 0.6) return t.b;
    return t.a;
  }

  private spawn(delta: number): void {
    if (this.state !== "fight" || this.stageMode === "boss") return;
    // the tsunami washes the monsters away
    if (this.stageMode === "sea" && this.sea.tsunami > 0) return;
    if (this.stageMode === "ocean" && this.ocean.phase === "wave") return;
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      // the first stages go a little easier on new players
      this.spawnTimer = spawnGap(this.minute) * (1 + Math.max(0, 4 - save.stage) / 6) * (this.arena.path ? 0.8 : 1) * (this.arena.sea ? 2.6 : 1);
      const group = 1 + (save.stage > 40 ? 1 : 0);
      for (let i = 0; i < group && this.enemies.length < MAX_MONSTERS; i++) {
        // while the crystal is open many monsters march on it from far away
        // (the ones that appear around you come for you)
        const atCrystal = this.stageMode === "crystal" && !this.shielded && this.elapsed > 8000 && Math.random() < raiderShare(save.stage);
        const [x, y] = atCrystal ? this.randomSpot(1600, 2500) : this.spawnPoint();
        const e = this.addEnemy(this.pickType(), x, y, false, true, 1, this.mobStage());
        // octopi swim a bit slower than monsters walk, and start out under the water
        if (this.arena.sea) {
          e.speedMult *= 0.7;
          if (!e.type.flying) this.sea.under.add(e);
        }
        e.huntHero = !atCrystal;
        e.raider = atCrystal;
      }
    }
    // tough elites carry dice
    this.eliteTimer -= delta;
    if (this.eliteTimer <= 0 && this.elapsed > 50000) {
      this.eliteTimer = 25000 - this.minute * 2500;
      const [x, y] = this.spawnPoint();
      this.addEnemy(this.types().b, x, y, true, true, 1, this.mobStage()).huntHero = true;
    }
  }

  /** The village hunt and the sea path: monsters come down from the top, not in from the sides. */
  private fromAbove(): boolean {
    return !!this.story && (this.stageMode === "hunt" || (this.stageMode === "path" && this.arena.path?.kind === "sea"));
  }

  /** Where a new monster turns up: from the top, out of the trees, or just off screen. */
  private spawnPoint(): [number, number] {
    // at sea: up out of the water at the edges (on the open ocean: just off screen)
    if (this.arena.sea && !this.arena.ocean) {
      const a = this.arena;
      const side = Math.floor(Math.random() * 4);
      const k = Math.random();
      return side === 0 ? [120 + k * (a.w - 240), 260] : side === 1 ? [120 + k * (a.w - 240), a.h - 120] : side === 2 ? [120, 260 + k * (a.h - 380)] : [a.w - 120, 260 + k * (a.h - 380)];
    }
    if (this.fromAbove()) {
      const v = this.cameras.main.worldView;
      const p = this.arena.path;
      const x = this.hero.x + (Math.random() - 0.5) * v.width * 0.95;
      const y = this.hero.y - v.height * 0.55 - Math.random() * 300;
      if (p) return [Phaser.Math.Clamp(x, p.x0 + 50, p.x1 - 50), Math.max(p.endY + 150, y)];
      return [clampX(x), clampY(y)];
    }
    return this.arena.path ? this.fromTrees() : this.offScreen();
  }

  /** How strong the monsters are: on a story path you run, so they are as weak as the first stage's. */
  private mobStage(): number {
    return this.arena.path ? Math.min(save.stage, 2) : save.stage;
  }

  /** On a path monsters step out of the woods on either side, mostly up ahead of you (some block the path). */
  private fromTrees(): [number, number] {
    const v = this.cameras.main.worldView;
    if (Math.random() < 0.2) {
      const p = this.arena.path!;
      return [p.x0 + 60 + Math.random() * (p.x1 - p.x0 - 120), Math.max(p.endY + 200, this.hero.y - v.height * 0.5 - 100)];
    }
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = this.arena.w / 2 + side * (PATH_HALF + 220 + Math.random() * 380);
    // never out past the end of the path (in the sea or behind the village)
    const y = Math.max(this.arena.path!.endY + 150, clampY(this.hero.y - v.height * 0.55 + Math.random() * v.height * 0.85));
    return [x, y];
  }

  /** A point just outside the screen around the hero. */
  private offScreen(): [number, number] {
    const v = this.cameras.main.worldView;
    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * Math.PI * 2;
      const x = clampX(this.hero.x + Math.cos(a) * (v.width / 2 + 180));
      const y = clampY(this.hero.y + Math.sin(a) * (v.height / 2 + 180));
      if (!v.contains(x, y)) return [x, y];
    }
    return this.randomSpot(1300, 2000, [this.hero.x, this.hero.y]);
  }

  /** Every minute a ring of monsters closes in on you. */
  private swarm(n: number): void {
    const v = this.cameras.main.worldView;
    if (this.arena.path || this.fromAbove()) {
      for (let i = 0; i < n && this.enemies.length < MAX_MONSTERS; i++) this.addEnemy(this.pickType(), ...this.spawnPoint(), false, true, 1, this.mobStage()).huntHero = true;
      return;
    }
    for (let i = 0; i < n && this.enemies.length < MAX_MONSTERS; i++) {
      const a = (i / n) * Math.PI * 2;
      const e = this.addEnemy(this.pickType(), clampX(this.hero.x + Math.cos(a) * v.width * 0.55), clampY(this.hero.y + Math.sin(a) * v.height * 0.45));
      e.huntHero = true;
    }
  }

  /**
   * A new monster. Most can spawn mutated (faster, teleporting, an extra life... more and
   * harder mutations on later stages); `mutate: false` for the halves of a splitter.
   */
  private addEnemy(type: EnemyType, x: number, y: number, elite = false, mutate = true, size = 1, stage = save.stage): Enemy {
    const muts = mutate ? rollMutations(stage, elite, !!type.boss) : [];
    const has = (m: MutationId) => muts.includes(m);
    const scale = (type.boss ? 1.3 : elite ? 1.45 : 1) * (has("giant") ? 1.4 : 1) * size;
    if (type.boss) bossFrames(this, type.tex);
    // elites climb out of a purple portal
    if (elite && !type.boss && effectsOn()) {
      const portal = this.add.image(x, y, "bx_warn").setTint(0xb36aff).setScale(0.2, 0.12).setDepth(5);
      this.tweens.add({ targets: portal, scaleX: 0.8, scaleY: 0.5, duration: 220, ease: "Back.out" });
      this.tweens.add({ targets: portal, angle: 180, alpha: 0, delay: 600, duration: 400, onComplete: () => portal.destroy() });
      this.sparks.setParticleTint(0xb36aff);
      this.sparks.explode(10, x, y - 40);
    }
    const img = this.add.image(x, y, type.tex).setOrigin(0.5, type.flying ? 0.5 : 0.94).setDepth(y).setAlpha(0).setScale(0.3);
    this.tweens.add({ targets: img, alpha: 1, scale, duration: 350, ease: "Back.out" });
    // their legs, arms and heads move by walk frames (see moveEnemies); a gentle lean on top
    if (type.flying) this.tweens.add({ targets: img, y: "-=6", duration: 320, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: 350 });
    else this.tweens.add({ targets: img, angle: { from: -2.5, to: 2.5 }, duration: 520, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: 350 });
    const hp = Math.round(monsterHp(type.stats.hp, stage, this.minute) * (elite ? ELITE_MULT : 1) * (has("giant") ? 3 : 1));
    // mutated monsters pay a little more
    const bonus = muts.length ? 1 + 0.5 * muts.length : 1;
    const e: Enemy = {
      img, type, hp, maxHp: hp, elite,
      cash: monsterCash(type.stats.cash, stage) * (elite ? 5 : 1) * bonus,
      xp: Math.round((elite ? 8 : type.stats.xp) * bonus),
      dmg: type.stats.dmg * (1 + 0.05 * (stage - 1)) * (1 + 0.2 * this.minute) * (elite ? 1.5 : 1),
      r: (type.boss ? 90 : elite ? 48 : type.flying ? 30 : 34) * (has("giant") ? 1.3 : 1) * size,
      flashUntil: 0, atkTimer: 0, toCrystal: false, huntHero: false, raider: false, attacking: false, moving: false, seed: Math.random() * 1000, phase: "walk", phaseT: 3000, dashX: 0, dashY: 0, shots: 0, tickT: 0, casts: 0, dashV: 1000, dashMs: 600, dashWind: 750,
      muts, speedMult: (has("swift") ? 1.6 : 1) * (has("giant") ? 0.8 : 1), lives: has("lives") ? 1 : 0,
      blinkT: 1500 + Math.random() * 2500, ghostT: Math.random() * 4500, phased: false, stunUntil: 0,
    };
    if (elite || muts.length >= 2) {
      const color = elite ? 0xff4a4a : MUTATION_BY_ID[muts[1]].color;
      e.aura = this.add.image(x, y, "glow").setTint(color).setScale(1.3 * scale, 0.6 * scale).setAlpha(0.7).setDepth(y - 1);
      this.tweens.add({ targets: e.aura, alpha: 0.35, duration: 400, yoyo: true, repeat: -1 });
    }
    if (muts.length) {
      e.badge = this.add.image(x, y, `mut_${muts[0]}`).setScale(type.boss ? 1.7 : 1.15);
      this.announceMutations(muts);
    }
    this.enemies.push(e);
    return e;
  }

  /** The first time you meet a mutation, a big warning says what it does. */
  private announceMutations(muts: MutationId[]): void {
    for (const m of muts) {
      if (save.mutSeen.includes(m)) continue;
      save.mutSeen.push(m);
      persist();
      const def = MUTATION_BY_ID[m];
      this.banner("NEW MUTATION!", "purple", 1000);
      this.toast(`${def.name}: this monster ${def.desc}!`, rgba(def.color === 0xe8f4ff ? 0xffffff : def.color));
    }
  }

  /** The mutation badge follows the monster (or goes away when it has none left). */
  private refreshBadge(e: Enemy): void {
    if (!e.muts.length) {
      e.badge?.destroy();
      e.badge = undefined;
      return;
    }
    e.badge?.setTexture(`mut_${e.muts[0]}`);
  }

  /**
   * 5:00 - every monster runs off, a storm rolls in over the crystal, a beam of light shines down
   * from the clouds and the crystal dissolves up into it, then the boss drops down next to you.
   */
  /** The player picked a stage they have reached (in the lobby); a new land rebuilds the world. */
  private pickStage(n: number): void {
    if (this.state !== "lobby") return;
    const st = Phaser.Math.Clamp(Math.round(n), 1, Math.min(MAX_STAGE, stageCap()));
    if (st === save.stage) return;
    save.stage = st;
    persist();
    this.refreshSign();
    // every stage has its own look in the lobby: the world is rebuilt for it
    {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.restart({}));
    }
  }

  // ───────────────────────── stage modes ─────────────────────────

  /** Sets up this stage's mode when the run starts. */
  private modeStart(): void {
    const m = this.stageMode;
    for (const o of this.preview) {
      const t = o as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
      this.tweens.add({ targets: t, alpha: 0, scale: 0.4, duration: 300, onComplete: () => o.destroy() });
      if (typeof t.x === "number") {
        this.puff.setParticleTint(0xffffff);
        this.puff.explode(6, t.x, t.y - 60);
      }
    }
    this.preview = [];
    // the lobby signboard poofs away
    const sg = this.stageSign;
    if (sg) {
      this.stageSign = null;
      this.tweens.killTweensOf(sg);
      this.tweens.add({ targets: sg, scale: 0, angle: 20, duration: 300, ease: "Back.in", onComplete: () => sg.destroy() });
      this.puff.setParticleTint(0xc89060);
      this.puff.explode(20, sg.x, sg.y - 100);
    }
    const [cx, cy] = this.arena.center;
    if (m === "crystal") {
      this.crystalArrive();
      return;
    }
    if (m === "dice") {
      this.sign(cx, cy + 520, "DICE RAIN!", "watch the shadows", "#ffe066");
      for (const [dx, dy] of [[-420, 380], [420, 380], [-300, -260], [300, -260]]) this.warnSign(cx + dx, cy + dy);
    }
    if (m === "boss") {
      this.sign(cx, cy + 520, "BOSS ARENA", this.story ? "beat the big one!" : "beat all four!", "#ff8a8a");
      // burning torches in neat rows and columns round the arena (the village has its own at the crossings)
      if (!this.placeDrawn) this.torchGrid(2);
    }
    // only the crystal stage has a crystal to guard
    this.crystal.setVisible(false);
    this.crystalGlow.setAlpha(0);
    this.crystalSparkle.stop();
    if (m === "air") this.airMove(true);
    if (m === "feed") this.beastSpawn();
    if (m === "boss") this.fullPower();
    if (m === "boss" && this.story) this.beastAlly();
    if (m === "path") this.pathStart();
    if (m === "sea") this.seaStart();
    if (m === "ocean") this.oceanStart();
    if (m === "hunt") this.huntStart();
  }

  /**
   * Developer: start the fight further on (picked on the DEV panel): the middle, near the end, or
   * right at the boss (the tsunami at sea, the boss's landing on a path, all dice found in the village).
   */
  private devJumpTo(): void {
    const j = battle.devJump;
    battle.devJump = "start";
    if (j === "start" || this.rush || this.stageMode === "boss") return;
    const m = this.stageMode;
    const full = this.story?.limit || (m === "sea" ? SEA_MS : STAGE_MS);
    let at = j === "mid" ? full * 0.5 : j === "end" ? full - 15000 : full - 2500;
    const p = this.arena.path;
    if (p) {
      // up the path: the boss moment is just before the first boss drops in
      const f = j === "mid" ? 0.5 : j === "end" ? 0.88 : 0.35;
      at = j === "boss" ? (PATH_BOSSES[save.stage]?.[0] ?? 45000) - 1500 : j === "mid" ? full * 0.5 : full - 20000;
      this.hero.y = p.startY - (p.startY - p.endY) * f;
      if (f > LANTERN_AT && this.lantern) this.holdLantern(true);
      this.pathBosses = this.pathBosses.filter((t) => t >= at);
    }
    if (m === "hunt") {
      const want = j === "mid" ? 10 : HUNT_DICE - 1;
      for (const q of this.pickups.filter((d) => d.quest).slice(0, Math.max(0, want - this.huntFound))) {
        this.removePickup(q);
        this.pickups = this.pickups.filter((d) => d !== q);
        this.huntFound++;
      }
      if (j === "boss") {
        const last = this.pickups.find((d) => d.quest);
        if (last) {
          this.removePickup(last);
          this.pickups = this.pickups.filter((d) => d !== last);
        }
        this.huntDie();
      }
      at = j === "mid" ? full * 0.5 : full - 20000;
    }
    if (m === "feed" && this.beast) {
      this.beast.fed = j === "mid" ? 3 : j === "end" ? FEEDS - 1 : FEEDS;
      if (j === "boss") this.beastFriend();
      this.beast.foodAt = at + 2000;
      this.beast.hunger = 1;
    }
    if (m === "crystal") this.crystalDieAt = at + CRYSTAL_DIE_MS;
    if (m === "ocean") {
      const o = this.ocean;
      if (j === "boss") o.nextT = 0;
      else {
        const f = j === "mid" ? 0.5 : 0.88;
        this.hero.setPosition(this.hero.x + (o.x - this.hero.x) * f, this.hero.y + (o.y + 300 - this.hero.y) * f);
      }
      at = j === "mid" ? OCEAN_MS * 0.5 : j === "end" ? OCEAN_MS - 30000 : at;
      if (j === "boss") at = 30000;
    }
    this.elapsed = at;
    this.minute = Math.min(MINUTES, Math.floor(at / 60000));
    this.saidLeft = Infinity;
    this.toast(`DEV: ${j === "mid" ? "the middle" : j === "end" ? "near the end" : "the boss / finale"}`, "#e6b8ff");
  }

  // ── The sea stage (6, 11, 16...)

  /** Open water as far as you can see; buoys on a rope mark the edge of where you can go. */
  private drawSea(): void {
    const a = this.arena;
    const m = 1600;
    const water = this.add.tileSprite(-m, -m, a.w + m * 2, a.h + m * 2, "sea_tile").setOrigin(0).setDepth(-1000);
    this.tweens.add({ targets: water, tilePositionY: -256, tilePositionX: 64, duration: 7000, repeat: -1 });
    // a second, lighter layer of ripples drifting the other way
    const ripples = this.add.tileSprite(-m, -m, a.w + m * 2, a.h + m * 2, "sea_tile").setOrigin(0).setDepth(-999).setAlpha(0.25).setScale(1.6);
    this.tweens.add({ targets: ripples, tilePositionX: -256, duration: 9000, repeat: -1 });
    // the rope of buoys round the edge
    const g = this.add.graphics().setDepth(-990);
    g.lineStyle(10, 0xfff3dc, 0.9).strokeRect(40, 160, a.w - 80, a.h - 200);
    g.lineStyle(4, 0x8a5a32, 1).strokeRect(40, 160, a.w - 80, a.h - 200);
    const per = (len: number) => Math.max(2, Math.round(len / 260));
    const buoy = (x: number, y: number, i: number) => {
      const b = this.add.circle(x, y, 22, i % 2 ? 0xff4a4a : 0xffffff).setStrokeStyle(6, 0x4a2f1d).setDepth(-980);
      this.tweens.add({ targets: b, y: y - 8, duration: 900 + (i % 5) * 120, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    };
    let i = 0;
    for (let k = 0; k <= per(a.w); k++) {
      buoy(40 + (k / per(a.w)) * (a.w - 80), 160, i++);
      buoy(40 + (k / per(a.w)) * (a.w - 80), a.h - 40, i++);
    }
    for (let k = 1; k < per(a.h); k++) {
      buoy(40, 160 + (k / per(a.h)) * (a.h - 200), i++);
      buoy(a.w - 40, 160 + (k / per(a.h)) * (a.h - 200), i++);
    }
    // sparkles of sunlight on the water
    if (effectsOn()) this.add.particles(0, 0, "spark", {
      x: { min: 0, max: a.w }, y: { min: 160, max: a.h }, lifespan: 900, scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 },
      tint: [0xffffff, 0xd8f4ff], frequency: 90, blendMode: Phaser.BlendModes.ADD,
    }).setDepth(-970);
  }

  /** The whole patch of sea on screen at once: the camera stays put, zoomed to fit (below the HUD). */
  private seaCamera(ms: number): void {
    const a = this.arena;
    const cam = this.cameras.main;
    const { width: W, height: H } = this.scale;
    const top = this.L.hudBottom + 20;
    const zoom = Math.min(W / (a.w + 80), (H - top - 60) / (a.h + 80));
    cam.stopFollow();
    cam.removeBounds();
    // the middle of the free part of the screen
    const midY = (top + H - 60) / 2;
    const cy = a.h / 2 - (midY - H / 2) / zoom;
    if (ms) {
      cam.zoomTo(zoom, ms, "Sine.easeInOut");
      cam.pan(a.w / 2, cy, ms, "Sine.easeInOut");
    } else cam.setZoom(zoom).centerOn(a.w / 2, cy);
  }

  /** Off you go in your little boat: the clock runs 3:00, the attacks get worse every 30 s. */
  private seaStart(): void {
    this.boat = this.add.image(this.hero.x, this.hero.y + 20, "sea_boat").setOrigin(0.5, 0.7).setScale(1.1);
    battle.limit = SEA_MS;
    this.time.delayedCall(1700, () => {
      this.toast("Dodge the falling dice and what comes up from below! Survive 3:00", "#9ad8ff");
      sfx.shield(true);
    });
    // gulls circling, now and then
    this.sea.gullT = 4000;
  }

  private seaTick(delta: number, fighting: boolean): void {
    const sea = this.sea;
    this.boatTick(delta);
    if (!fighting) return;
    if (!sea.tsunami) this.seaMonsters(delta);
    // gulls fly over the sea now and then
    sea.gullT -= delta;
    if (sea.gullT <= 0) {
      sea.gullT = 6000 + Math.random() * 6000;
      this.gulls();
    }
    if (sea.tsunami) {
      this.tsunamiTick(delta);
      return;
    }
    const left = SEA_MS - this.elapsed;
    battle.left = Math.max(0, left);
    const lv = Math.min(6, 1 + Math.floor(this.elapsed / 30000));
    if (lv > sea.lv) {
      sea.lv = lv;
      this.banner(`ATTACK LEVEL ${lv}!`, lv >= 5 ? "red" : "blue", 1000);
      this.toast(lv >= 5 ? "The sea is furious!" : "More dice, more monsters from below!", "#9ad8ff");
      sfx.alarm();
      this.cameras.main.shake(300, 0.006);
    }
    // dice from the sky, a whale, tentacles: quicker and more of them each level
    sea.diceT -= delta;
    if (sea.diceT <= 0) {
      sea.diceT = Math.max(700, 2500 - lv * 260) * (0.75 + Math.random() * 0.5);
      for (let i = 0; i < 1 + (lv >= 4 ? 1 : 0); i++) {
        const a = Math.random() * Math.PI * 2;
        const d = i === 0 && Math.random() < 0.6 ? Math.random() * 180 : 250 + Math.random() * 600;
        this.dropBigDie(clampX(this.hero.x + Math.cos(a) * d), clampY(this.hero.y + Math.sin(a) * d));
      }
    }
    sea.whaleT -= delta;
    if (sea.whaleT <= 0) {
      sea.whaleT = Math.max(3500, 9500 - lv * 900);
      this.whaleAttack();
    }
    sea.tentT -= delta;
    if (sea.tentT <= 0) {
      sea.tentT = Math.max(2000, 5400 - lv * 500);
      this.tentacles(1 + Math.floor(lv / 2));
    }
    if (left <= 0) this.startTsunami();
  }

  /**
   * Your boat: it faces the way you go and swings round with a splash when you turn back, its nose
   * lifts going up and dips going down, it rocks on the waves, throws spray off the bow at speed and
   * leaves a white wake.
   */
  private boatTick(delta: number): void {
    const b = this.boat;
    if (!b) return;
    const sea = this.sea;
    const t = this.time.now;
    const [vx, vy] = [this.hero.x - this.heroPrev[0], this.hero.y - this.heroPrev[1]];
    const per = Math.max(1, delta) / 1000;
    const speed = Math.hypot(vx, vy) / per;
    const moving = speed > 40;
    // turning round: a quick swing (it squashes to nothing and back, the other way) and a splash
    const want = vx < -0.6 ? -1 : vx > 0.6 ? 1 : sea.dir;
    if (want !== sea.dir) {
      sea.dir = want;
      this.tweens.killTweensOf(b);
      b.setScale(0.15, 1.1);
      this.tweens.add({ targets: b, scaleX: 1.1, duration: 260, ease: "Back.out" });
      this.splash(this.hero.x, this.hero.y + 30, 8, 0.6);
    }
    b.setFlipX(sea.dir < 0);
    // nose up going up, down going down (smoothed), plus the rocking of the waves
    const pitch = Phaser.Math.Clamp((vy / per / HERO_SPEED) * 18 * sea.dir, -20, 20);
    sea.tilt += ((moving ? pitch : 0) - sea.tilt) * Math.min(1, delta / 180);
    const rock = Math.sin(t / 650) * 4;
    const bob = Math.sin(t / 420) * 5;
    b.setPosition(this.hero.x, this.hero.y + 24 + bob).setAngle(sea.tilt + rock).setDepth(this.hero.y - 1);
    this.hero.setAngle(sea.tilt * 0.5 + rock * 0.7);
    if (!effectsOn()) return;
    sea.wakeT -= delta;
    if (moving && sea.wakeT <= 0) {
      sea.wakeT = 80;
      const w = this.add.image(this.hero.x - sea.dir * 80 + Phaser.Math.Between(-15, 15), this.hero.y + 40, "puff").setTint(0xffffff).setAlpha(0.85).setScale(0.6).setDepth(this.hero.y - 2);
      this.tweens.add({ targets: w, x: w.x - sea.dir * 60, scale: 2, alpha: 0, duration: 800, onComplete: () => w.destroy() });
    }
    // spray off the bow at full speed
    sea.sprayT -= delta;
    if (speed > HERO_SPEED * 0.7 && sea.sprayT <= 0) {
      sea.sprayT = 140;
      this.puff.setParticleTint(0xffffff);
      this.puff.explode(3, this.hero.x + sea.dir * 95, this.hero.y + 20);
    }
  }

  /**
   * Octopi swim under the water (a dark shape and a trail of bubbles; you cannot hit them there).
   * Close to you they burst up out of the water to attack; far away again they dive back down.
   */
  private seaMonsters(delta: number): void {
    const sea = this.sea;
    sea.bubT -= delta;
    const bubbles = sea.bubT <= 0 && effectsOn();
    if (bubbles) sea.bubT = 260;
    for (const e of this.enemies) {
      if (e.type.flying || e.type.boss) continue;
      const d = Math.hypot(e.img.x - this.hero.x, e.img.y - this.hero.y);
      const under = sea.under.has(e);
      if (under && d < 320) {
        // up it comes!
        sea.under.delete(e);
        e.img.clearTint();
        this.tweens.add({ targets: e.img, alpha: 1, duration: 160 });
        this.tweens.add({ targets: e.img, y: e.img.y - 40, duration: 180, yoyo: true, ease: "Quad.out" });
        e.aura?.setVisible(true);
        e.badge?.setVisible(true);
        this.splash(e.img.x, e.img.y, 10, 0.7);
        e.atkTimer = Math.max(e.atkTimer, 250);
      } else if (!under && d > 800) {
        sea.under.add(e);
        this.splash(e.img.x, e.img.y, 6, 0.5);
      }
      if (sea.under.has(e)) {
        e.img.setAlpha(0.28).setTint(0x2a4a8a);
        e.aura?.setVisible(false);
        e.badge?.setVisible(false);
        if (bubbles && Math.random() < 0.5) {
          const bub = this.add.circle(e.img.x + Phaser.Math.Between(-20, 20), e.img.y - 30, 5 + Math.random() * 4).setStrokeStyle(3, 0xffffff, 0.8).setDepth(e.img.y + 1);
          this.tweens.add({ targets: bub, y: bub.y - 40, alpha: 0, duration: 600, onComplete: () => bub.destroy() });
        }
      }
    }
    for (const e of [...sea.under]) if (!this.enemies.includes(e)) sea.under.delete(e);
  }

  /** A splash of white water. */
  private splash(x: number, y: number, n: number, size = 1): void {
    this.puff.setParticleTint(0xe8f8ff);
    this.puff.explode(n, x, y);
    const ring = this.add.ellipse(x, y, 160 * size, 60 * size).setStrokeStyle(10, 0xffffff, 0.9).setDepth(y + 1);
    this.tweens.add({ targets: ring, scaleX: 2.4, scaleY: 2.4, alpha: 0, duration: 600, ease: "Quad.out", onComplete: () => ring.destroy() });
  }

  /** A whale's shadow grows under the water where you are... then it bursts up and crashes down. */
  private whaleAttack(): void {
    const [x, y] = [clampX(this.hero.x + Phaser.Math.Between(-140, 140)), clampY(this.hero.y + Phaser.Math.Between(-140, 140))];
    const R = 250 + this.sea.lv * 12;
    const shadow = this.add.ellipse(x, y, R * 2, R, 0x0a1a3a, 0.45).setDepth(3).setScale(0.2);
    const ring = this.add.ellipse(x, y, R * 2, R).setStrokeStyle(10, 0xff4a4a, 0.9).setDepth(4);
    this.tweens.add({ targets: ring, alpha: 0.3, duration: 160, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: shadow, scale: 1, duration: 1500, ease: "Quad.in" });
    // bubbles boiling up over it
    const bub = effectsOn() ? this.add.particles(x, y, "puff", {
      x: { min: -R * 0.8, max: R * 0.8 }, y: { min: -R * 0.3, max: R * 0.3 }, lifespan: 500, speedY: { min: -60, max: -20 }, scale: { start: 0.2, end: 0.6 },
      alpha: { start: 0.9, end: 0 }, tint: 0xd8f4ff, frequency: 40,
    }).setDepth(5) : null;
    sfx.charge(2);
    this.time.delayedCall(1500, () => {
      shadow.destroy();
      ring.destroy();
      bub?.destroy();
      if (!this.fighting) return;
      const whale = this.add.image(x, y + 60, "sea_whale").setOrigin(0.5, 0.8).setScale(0.3).setDepth(y + 50).setFlipX(Math.random() < 0.5);
      this.tweens.add({ targets: whale, scale: 1.25, y: y - 140, angle: whale.flipX ? 12 : -12, duration: 380, ease: "Back.out" });
      this.tweens.add({ targets: whale, y: y + 120, scaleY: 0.6, alpha: 0, delay: 700, duration: 500, ease: "Quad.in", onComplete: () => whale.destroy() });
      this.splash(x, y, 40, 1.6);
      this.time.delayedCall(700, () => this.splash(x, y + 20, 30, 1.8));
      this.cameras.main.shake(450, 0.014);
      sfx.boom();
      buzz(180);
      if (Math.hypot(this.hero.x - x, (this.hero.y - y) * 2) < R + HERO_R) {
        this.hurt(this.heroMax * (0.18 + this.sea.lv * 0.025));
        this.callout("WHALE!", "#9ad8ff");
      }
      for (const e of this.near(x, y, R)) if (!e.type.boss) this.hit(e, e.maxHp * 2);
    });
  }

  /** Purple rings, then tentacles slam up out of the water. */
  private tentacles(n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = i === 0 ? Math.random() * 120 : 200 + Math.random() * 450;
      const [x, y] = [clampX(this.hero.x + Math.cos(a) * d), clampY(this.hero.y + Math.sin(a) * d)];
      const R = 130;
      const ring = this.add.ellipse(x, y, R * 2, R).setStrokeStyle(8, 0xb04aff, 0.95).setFillStyle(0x4a1a6a, 0.25).setDepth(4).setScale(0.3);
      this.tweens.add({ targets: ring, scale: 1, duration: 950, ease: "Quad.in" });
      this.time.delayedCall(950 + i * 120, () => {
        ring.destroy();
        if (!this.fighting) return;
        const t = this.add.image(x, y + 20, "sea_tentacle").setOrigin(0.5, 1).setScale(1, 0).setDepth(y + 30).setFlipX(Math.random() < 0.5);
        this.tweens.add({ targets: t, scaleY: 1.15, duration: 160, ease: "Back.out" });
        this.tweens.add({ targets: t, angle: { from: -6, to: 6 }, duration: 140, yoyo: true, repeat: 2 });
        this.tweens.add({ targets: t, scaleY: 0, delay: 650, duration: 260, ease: "Quad.in", onComplete: () => t.destroy() });
        this.splash(x, y, 18, 0.8);
        sfx.claw();
        this.cameras.main.shake(140, 0.005);
        if (Math.hypot(this.hero.x - x, (this.hero.y - y) * 2) < R + HERO_R) {
          this.hurt(this.heroMax * (0.1 + this.sea.lv * 0.012));
          this.callout("SLAP!", "#e6b8ff");
        }
      });
    }
  }

  /** Seagulls flying across the sea (and a feather or two). */
  private gulls(): void {
    const a = this.arena;
    const fromLeft = Math.random() < 0.5;
    const y = 400 + Math.random() * (a.h - 800);
    for (let i = 0; i < 3; i++) {
      const g = this.add.image(fromLeft ? -200 : a.w + 200, y + i * 70 - (i % 2) * 40, "e_crow").setTint(0xffffff).setScale(0.6).setDepth(TOP + 50).setFlipX(!fromLeft);
      this.tweens.add({ targets: g, x: fromLeft ? a.w + 200 : -200, duration: 5000 + i * 300, delay: i * 200, onComplete: () => g.destroy() });
      this.tweens.add({ targets: g, scaleY: 0.4, duration: 180, yoyo: true, repeat: -1 });
    }
  }

  // ── the tsunami: three waves from every side, each faster; only the islands are safe

  private startTsunami(): void {
    const sea = this.sea;
    sea.tsunami = 1;
    battle.left = -1;
    battle.limit = 0;
    for (const e of [...this.enemies]) this.kill(e, true);
    this.banner("TSUNAMI!", "red", 1400);
    this.toast("Three giant waves are coming! Get on an island!", "#9ad8ff");
    sfx.alarm();
    sfx.thunder();
    this.cameras.main.flash(200, 255, 255, 255);
    // the storm rolls in: a dark sky, rain and lightning
    this.tweens.add({ targets: this.gloom, fillAlpha: 0.32, duration: 1500 });
    if (effectsOn()) {
      const a = this.arena;
      sea.rain = this.add.particles(0, 0, "puff", {
        x: { min: -400, max: a.w + 400 }, y: { min: -200, max: a.h }, lifespan: 500, speedY: { min: 1600, max: 2000 }, speedX: -300,
        scaleX: 0.08, scaleY: 0.9, alpha: { start: 0.6, end: 0 }, tint: 0xcfe8ff, frequency: 12,
      }).setDepth(TOP + 60);
    }
    this.time.addEvent({ delay: 3500, repeat: 8, callback: () => {
      if (!this.fighting) return;
      this.cameras.main.flash(120, 230, 240, 255);
      sfx.thunder();
    } });
    this.nextWave();
  }

  // ── tsunami waves (the sea's finale and Land Ho!)

  /** A wall of water coming in from one side (0 top, 1 bottom, 2 left, 3 right), `len` long. */
  private makeWave(side: number, len: number): Wave {
    const angle = [180, 0, 90, -90][side];
    const wall = this.add.tileSprite(0, 0, len, 460, "tsunami_wall").setOrigin(0.5, 0).setAngle(angle).setDepth(TOP + 41);
    this.tweens.add({ targets: wall, tilePositionX: 512, duration: 1400, repeat: -1 });
    const shade = this.add.image(0, 0, "tsunami_shade").setOrigin(0.5, 1).setDisplaySize(len, 260).setAngle(angle).setDepth(TOP + 40);
    return { wall, shade, side, len };
  }

  /** Puts a wave's front at `pos` (y for top/bottom, x for left/right) centred on `along`; `rise` = how tall it is (0..1). */
  private placeWave(w: Wave, pos: number, along: number, rise: number): void {
    const vertical = w.side < 2;
    const [x, y] = vertical ? [along, pos] : [pos, along];
    w.wall.setPosition(x, y).setScale(1, rise);
    w.shade.setPosition(x, y);
    // foam and spray thrown off the crest
    if (effectsOn() && Math.random() < 0.7) {
      const k = (Math.random() - 0.5) * Math.min(w.len, 2600);
      const [fx, fy] = vertical ? [along + k, pos] : [pos, along + k];
      this.puff.setParticleTint(0xffffff);
      this.puff.explode(2, fx, fy);
      this.sparks.setParticleTint(0xd8f8ff);
      this.sparks.explode(1, fx, fy);
    }
  }

  /** The wave breaks: it crashes down in spray and is gone. */
  private dropWave(w: Wave): void {
    this.tweens.add({ targets: w.wall, scaleY: 0.05, alpha: 0, duration: 500, ease: "Quad.in", onComplete: () => w.wall.destroy() });
    this.tweens.add({ targets: w.shade, alpha: 0, duration: 400, onComplete: () => w.shade.destroy() });
  }

  /** The roar of a tsunami coming: a rumble that grows, the screen shakes. */
  private waveRoar(): void {
    sfx.whoosh();
    sfx.thunder();
    this.cameras.main.shake(1400, 0.008);
    for (const t of [500, 1000, 1500]) this.time.delayedCall(t, () => this.fighting && sfx.boom());
  }

  /** A wave rolls over you: safe on an island, or swept away (a big hit, a tumble and a splash). */
  private waveHits(): void {
    if (this.onIsland()) {
      this.callout("SAFE!", "#b6ff8a");
      sfx.levelUp();
      return;
    }
    this.hurt(this.heroMax * 0.5);
    this.splash(this.hero.x, this.hero.y, 60, 2.2);
    this.cameras.main.shake(600, 0.022);
    this.cameras.main.flash(250, 120, 200, 255);
    this.tweens.add({ targets: this.hero, angle: 360, duration: 600, ease: "Quad.out", onComplete: () => this.hero.setAngle(0) });
    this.callout("WIPED OUT!", "#9ad8ff");
  }

  /** A little island to shelter on pops up out of the water. */
  private miniIsland(x: number, y: number): { x: number; y: number; r: number; objs: Phaser.GameObjects.GameObject[] } {
    const img = this.add.image(x, y + 60, "sea_island").setOrigin(0.5, 0.75).setScale(0).setDepth(y - 5);
    this.tweens.add({ targets: img, scale: 1, duration: 500, ease: "Back.out" });
    const glow = this.add.ellipse(x, y + 20, 360, 130).setStrokeStyle(10, 0x7aff8a, 0.9).setDepth(y - 6);
    this.tweens.add({ targets: glow, alpha: 0.3, scaleX: 1.08, scaleY: 1.08, duration: 400, yoyo: true, repeat: -1 });
    this.splash(x, y + 30, 20, 1.2);
    return { x, y: y + 20, r: 150, objs: [img, glow] };
  }

  // ── Land Ho! (stage 7): sail the ocean to find the big island; tsunamis come at random

  /** The big island lies somewhere far up the ocean; the clock gives you 4:00. */
  private oceanStart(): void {
    const a = this.arena;
    const o = this.ocean;
    o.x = 900 + Math.random() * (a.w - 1800);
    o.y = 1500 + Math.random() * 2500;
    this.oceanGuess();
    o.img = this.add.image(o.x, o.y + 140, "sea_bigisland").setOrigin(0.5, 0.75).setDepth(o.y);
    this.tweens.add({ targets: o.img, y: o.img.y - 8, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.boat = this.add.image(this.hero.x, this.hero.y + 20, "sea_boat").setOrigin(0.5, 0.7).setScale(1.1);
    battle.limit = OCEAN_MS;
    o.nextT = 18000 + Math.random() * 6000;
    this.time.delayedCall(1700, () => this.toast("Find the big island before the clock runs out! Watch out for tsunamis", "#a8e8ff"));
  }

  /** The compass's guess: off by up to a few thousand (shrinking as you get close), new after each tsunami. */
  private oceanGuess(): void {
    const a = Math.random() * Math.PI * 2;
    const d = 2500 + Math.random() * 2500;
    this.ocean.gx = Math.cos(a) * d;
    this.ocean.gy = Math.sin(a) * d * 0.5;
  }

  private oceanTick(delta: number, fighting: boolean): void {
    const o = this.ocean;
    const sea = this.sea;
    this.boatTick(delta);
    if (!fighting) return;
    sea.gullT -= delta;
    if (sea.gullT <= 0) {
      sea.gullT = 7000 + Math.random() * 7000;
      this.gulls();
    }
    const left = OCEAN_MS - this.elapsed;
    battle.left = Math.max(0, left);
    if (left <= 0) {
      this.stageLost("time");
      return;
    }
    if (o.phase !== "wave") this.seaMonsters(delta);
    // a tentacle now and then
    sea.tentT -= delta;
    if (sea.tentT <= 0 && o.phase === "calm") {
      sea.tentT = 7000 + Math.random() * 4000;
      this.tentacles(1 + (this.elapsed > 120000 ? 1 : 0));
    }
    // land ho!
    if (!o.found && Math.abs(this.hero.x - o.x) < 380 && Math.abs(this.hero.y - o.y) < 150) {
      o.found = true;
      this.banner("LAND HO!", "gold", 1200);
      this.cameras.main.stopFollow();
      this.cameras.main.pan(o.x, o.y - 100, 1200, "Sine.easeInOut");
      this.cameras.main.zoomTo(0.55, 1200, "Sine.easeInOut");
      this.fireworks(o.x, o.y - 400, 7);
      sfx.whoosh();
      this.stageWon();
      return;
    }
    o.phaseT -= delta;
    if (o.phase === "calm") {
      o.nextT -= delta;
      if (o.nextT > 0) return;
      // a tsunami is coming: little islands rise near you, 4.5 s to get on one
      o.phase = "warn";
      o.phaseT = 4500;
      o.hit = false;
      for (const isl of sea.islands) isl.objs.forEach((ob) => ob.destroy());
      sea.islands = [];
      for (let tries = 0; sea.islands.length < 3 && tries < 100; tries++) {
        const ang = Math.random() * Math.PI * 2;
        const d = 450 + Math.random() * 550;
        const [x, y] = [clampX(this.hero.x + Math.cos(ang) * d), clampY(this.hero.y + Math.sin(ang) * d * 0.9)];
        if (sea.islands.some((q) => Math.hypot(q.x - x, q.y - y) < 500)) continue;
        sea.islands.push(this.miniIsland(x, y));
      }
      o.from = Math.floor(Math.random() * 4);
      this.banner("TSUNAMI COMING!", "red", 1200);
      this.toast(`From the ${["north", "south", "west", "east"][o.from]}! Get on an island!`, "#9ad8ff");
      this.game.events.emit("hurry", true);
      sfx.alarm();
      this.tweens.add({ targets: this.gloom, fillAlpha: 0.25, duration: 800 });
      return;
    }
    const v = this.cameras.main.worldView;
    const span = o.from < 2 ? v.height : v.width;
    if (o.phase === "warn") {
      if (o.phaseT > 0) return;
      // here it comes, across the whole view
      o.phase = "wave";
      o.phaseT = 4200;
      o.wave = this.makeWave(o.from, Math.max(v.width, v.height) + 2400);
      // the wave sweeps the monsters away
      for (const e of [...this.enemies]) if (!e.type.flying) this.kill(e, true);
      const c = o.from < 2 ? this.hero.y : this.hero.x;
      const sign = o.from === 0 || o.from === 2 ? 1 : -1;
      this.oceanSpan = [c - sign * (span / 2 + 500), c + sign * (span / 2 + 700)];
      this.waveRoar();
      return;
    }
    if (o.phase === "wave" && o.wave) {
      const k = 1 - Math.max(0, o.phaseT) / 4200;
      const [p0, p1] = this.oceanSpan;
      const pos = p0 + (p1 - p0) * k;
      const along = o.from < 2 ? this.hero.x : this.hero.y;
      this.placeWave(o.wave, pos, along, 0.35 + 0.65 * Math.min(1, k * 3));
      const me = o.from < 2 ? this.hero.y : this.hero.x;
      const passed = o.from === 0 || o.from === 2 ? pos > me : pos < me;
      if (passed && !o.hit) {
        o.hit = true;
        this.waveHits();
      }
      if (o.phaseT <= 0) {
        this.dropWave(o.wave);
        o.wave = null;
        o.phase = "calm";
        o.nextT = 22000 + Math.random() * 16000;
        for (const isl of sea.islands) this.tweens.add({ targets: isl.objs, alpha: 0, y: "+=40", duration: 700, onComplete: () => isl.objs.forEach((ob) => ob.destroy()) });
        sea.islands = [];
        this.tweens.add({ targets: this.gloom, fillAlpha: 0, duration: 1200 });
        this.oceanGuess();
        this.toast("The sea is calm. Keep looking for land!", "#b6ff8a");
      }
    }
  }

  /** Islands rise somewhere new; a few seconds later the wave comes from every side. */
  private nextWave(): void {
    const sea = this.sea;
    for (const isl of sea.islands) this.tweens.add({ targets: isl.objs, alpha: 0, scale: 0.5, duration: 400, onComplete: () => isl.objs.forEach((o) => o.destroy()) });
    sea.islands = [];
    const a = this.arena;
    const n = 4 - Math.min(2, sea.tsunami - 1);
    for (let tries = 0; sea.islands.length < n && tries < 200; tries++) {
      const [x, y] = [300 + Math.random() * (a.w - 600), 520 + Math.random() * (a.h - 900)];
      if (sea.islands.some((q) => Math.hypot(q.x - x, q.y - y) < 600)) continue;
      sea.islands.push(this.miniIsland(x, y));
    }
    sea.phase = "warn";
    sea.phaseT = [3200, 2600, 2200][sea.tsunami - 1];
    sea.hit = false;
    this.banner(`WAVE ${sea.tsunami}!`, "blue", 900);
    sfx.hurry();
  }

  private onIsland(): boolean {
    return this.sea.islands.some((q) => Math.hypot(this.hero.x - q.x, (this.hero.y - q.y) * 1.8) < q.r);
  }

  private tsunamiTick(delta: number): void {
    const sea = this.sea;
    const a = this.arena;
    sea.phaseT -= delta;
    if (sea.phase === "warn") {
      if (sea.phaseT > 0) return;
      // the waves rise at all four edges
      sea.phase = "wave";
      sea.waveP = 0;
      const big = Math.max(a.w, a.h) + 1600;
      sea.waves = [0, 1, 2, 3].map((side) => this.makeWave(side, big));
      this.waveRoar();
      return;
    }
    if (sea.phase === "wave") {
      const dur = [6500, 4800, 3400][sea.tsunami - 1];
      sea.waveP = Math.min(1, sea.waveP + delta / dur);
      const p = sea.waveP;
      const [top, bottom, left, right] = [(p * a.h) / 2, a.h - (p * a.h) / 2, (p * a.w) / 2, a.w - (p * a.w) / 2];
      // the walls rise as they come in, and throw foam off their crests
      const rise = 0.3 + 0.7 * Math.min(1, p * 2.5);
      [top, bottom, left, right].forEach((pos, i) => this.placeWave(sea.waves[i], pos, i < 2 ? a.w / 2 : a.h / 2, rise));
      // the wave has rolled over you
      const over = this.hero.y < top || this.hero.y > bottom || this.hero.x < left || this.hero.x > right;
      if (over && !sea.hit) {
        sea.hit = true;
        this.waveHits();
      }
      if (p >= 1) {
        for (const w of sea.waves) this.dropWave(w);
        sea.waves = [];
        this.splash(a.w / 2, a.h / 2, 60, 3);
        this.cameras.main.shake(400, 0.012);
        sea.phase = "rest";
        sea.phaseT = 1400;
      }
      return;
    }
    if (sea.phase === "rest" && sea.phaseT <= 0) {
      if (sea.tsunami >= 3) {
        sea.rain?.destroy();
        sea.rain = null;
        this.banner("YOU SURVIVED THE SEA!", "gold", 1200);
        this.fireworks(a.w / 2, a.h / 2 - 300, 6);
        this.stageWon();
        return;
      }
      sea.tsunami++;
      this.nextWave();
    }
  }

  // ── Story: the path (stages 1 and 5)

  /** The lantern lies a fifth of the way up (first path only); the bosses wait their turn. */
  private pathStart(): void {
    const p = this.arena.path!;
    this.pathBosses = [...(PATH_BOSSES[save.stage] ?? [])];
    if (!this.hasLantern) {
      const ly = p.startY - (p.startY - p.endY) * LANTERN_AT;
      const x = this.arena.w / 2 + 120;
      const glow = this.add.image(x, ly - 60, "glow").setTint(0xffd24a).setScale(1.8).setAlpha(0.8).setDepth(ly - 1).setBlendMode(Phaser.BlendModes.ADD);
      const img = this.add.image(x, ly, "lantern").setOrigin(0.5, 1).setDepth(ly).setScale(1.4);
      this.tweens.add({ targets: img, y: ly - 24, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.tweens.add({ targets: glow, scale: 2.3, alpha: 0.5, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.lantern = [img, glow, this.topGlow(x, ly - 60, 2.6, 0xffd24a)];
      this.lamps.push({ x, y: ly - 60, r: 260 });
    }
    this.time.delayedCall(2600, () => this.toast(this.story!.goal, "#c8f0a0"));
  }

  /** The lantern goes into your hand: the dark pulls back round you. */
  private holdLantern(found: boolean): void {
    this.hasLantern = true;
    this.heldLantern = this.add.image(this.hero.x, this.hero.y, "lantern").setOrigin(0.5, 0.1).setScale(0.7);
    this.heroGlow = this.add.image(this.hero.x, this.hero.y, "warm_glow").setScale(6).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 8701);
    if (!found) return;
    const l = this.lantern;
    this.lantern = null;
    if (l) {
      this.tweens.killTweensOf(l);
      l.forEach((o) => o.destroy());
      this.lamps = this.lamps.filter((x) => x.r !== 260);
    }
    this.cameras.main.flash(300, 255, 220, 140);
    const flare = this.add.image(this.hero.x, this.hero.y - 100, "glow").setTint(0xffd24a).setScale(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 8703);
    this.tweens.add({ targets: flare, scale: 9, alpha: 0, duration: 900, ease: "Quad.out", onComplete: () => flare.destroy() });
    this.sparks.setParticleTint(0xffd24a);
    this.sparks.explode(30, this.hero.x, this.hero.y - 120);
    sfx.fanfare();
    this.banner("LANTERN!", "gold", 900);
    this.toast("Now you can see in the dark!", "#ffe6a0");
  }

  /** Paths: find the lantern, bosses come down the path, the run ends at the top (or when time is up). */
  private pathTick(delta: number): void {
    const p = this.arena.path!;
    const [hx, hy] = [this.hero.x, this.hero.y];
    if (this.lantern && Math.hypot(hx - this.lantern[0].x, hy - this.lantern[0].y) < 160) this.holdLantern(true);
    // path bosses charge in bursts: 4 s quicker than you, then 6 s slower (outrun it or fight it)
    for (const [b, born] of this.pathChargers) {
      if (!this.enemies.includes(b)) {
        this.pathChargers.delete(b);
        continue;
      }
      const charging = (this.elapsed - born) % 10000 < 4000;
      b.speedMult = ((charging ? 1.1 : 0.7) * HERO_SPEED * moveSpeedMult()) / BOSS.speed;
    }
    if (this.pathBosses.length && this.elapsed >= this.pathBosses[0]) {
      this.pathBosses.shift();
      this.pathBoss();
    }
    // monsters you left far behind give up (so new ones can come out of the trees ahead)
    this.pathCullT -= delta;
    if (this.pathCullT <= 0) {
      this.pathCullT = 1000;
      for (const e of [...this.enemies]) {
        if (e.type.boss || e.img.y < hy + 2600) continue;
        this.enemies = this.enemies.filter((o) => o !== e);
        e.aura?.destroy();
        e.badge?.destroy();
        e.tele?.destroy();
        this.tweens.killTweensOf(e.img);
        e.img.destroy();
      }
    }
    // through the gate (or onto the beach) counts
    if (hy <= p.endY + 160) this.pathDone();
  }

  /** A boss drops onto the path ahead of you and comes running (it is quick!). */
  private pathBoss(): void {
    const p = this.arena.path!;
    const v = this.cameras.main.worldView;
    const def = bossForStage(save.stage);
    const x = this.arena.w / 2 + (Math.random() - 0.5) * 300;
    const y = Math.max(p.endY + 300, this.hero.y - v.height * 0.42);
    sfx.alarm();
    buzz(150);
    this.banner("BOSS!", "red", 900);
    this.toast(`${def.name} is coming down the path! It's fast!`, "#ffb0b0");
    const faller = this.add.image(x, y - 1400, def.tex).setOrigin(0.5, 0.94).setScale(1.3).setDepth(y);
    this.tweens.add({
      targets: faller, y, duration: 500, ease: "Quad.in",
      onComplete: () => {
        faller.destroy();
        if (!this.fighting) return;
        this.cameras.main.shake(400, 0.015);
        this.boom(x, y - 60, 2.4);
        // the one before (if you could not beat it) gives up and flies off: never two at once
        for (const old of this.enemies.filter((e) => e.type.boss)) {
          this.enemies = this.enemies.filter((e) => e !== old);
          old.aura?.destroy();
          old.badge?.destroy();
          this.tweens.killTweensOf(old.img);
          this.tweens.add({ targets: old.img, y: old.img.y - 900, alpha: 0, angle: 30, duration: 900, ease: "Quad.in", onComplete: () => old.img.destroy() });
        }
        const boss = this.addEnemy({ tex: def.tex, stats: BOSS, fx: def.color, boss: true, moves: def.moves, special: def.special }, x, y, false, false, 1, this.mobStage());
        // as strong as the path's monsters (a path is for running) and it hits softer, but it is quicker than you
        boss.hp = boss.maxHp = Math.round(monsterHp(BOSS.hp, this.mobStage(), this.minute) * HEALING_BOSS_HP);
        boss.speedMult = (1.1 * HERO_SPEED * moveSpeedMult()) / BOSS.speed;
        boss.dmg *= 0.35;
        this.pathChargers.set(boss, this.elapsed);
        boss.huntHero = true;
        boss.phaseT = 1800;
      },
    });
  }

  /** You made it to the end of the path: the camera takes in the village (or the sea) and fireworks go up. */
  private pathDone(): void {
    const p = this.arena.path!;
    const sea = p.kind === "sea";
    this.callout(sea ? "THE SEA!" : "THE VILLAGE!", "#ffe066");
    if (sea && this.night) this.night.want = 0;
    else if (this.night) this.night.want = this.night.dark * 0.45;
    const cam = this.cameras.main;
    const [tx, ty] = [this.arena.w / 2, sea ? p.endY - 500 : 800];
    cam.stopFollow();
    cam.pan(tx, ty, 1400, "Sine.easeInOut");
    cam.zoomTo(0.5, 1400, "Sine.easeInOut");
    sfx.whoosh();
    this.fireworks(tx, ty - 200, 7);
    this.stageWon();
  }

  /** Fireworks bursting in the sky over a spot: a whistle, a bang, a ball of coloured sparks. */
  private fireworks(x: number, y: number, n: number): void {
    const colors = [0xff5a8a, 0xffe066, 0x5ac8ff, 0x8af06a, 0xb98aff, 0xff9a3a];
    for (let i = 0; i < n; i++) {
      this.time.delayedCall(300 + i * 420, () => {
        const [fx, fy] = [x + Phaser.Math.Between(-600, 600), y + Phaser.Math.Between(-350, 250)];
        const col = colors[i % colors.length];
        sfx.firework();
        const ring = this.add.image(fx, fy, "fx_ring").setTint(col).setScale(0.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 9500);
        this.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 700, ease: "Quad.out", onComplete: () => ring.destroy() });
        this.sparks.setParticleTint(col);
        this.sparks.explode(40, fx, fy);
        this.stars.explode(10, fx, fy);
      });
    }
  }

  /**
   * At the start of a chapter the camera flies over to what it is all about (the village or the sea
   * at the end of the path, the lost dice, the beast's cage) and comes back to you. Returns when it is
   * back (ms), so the fight starts then.
   */
  private storyTour(): number {
    const p = this.arena.path;
    let target: [number, number, string] | null = null;
    if (p) target = [this.arena.w / 2, p.endY + 200, p.kind === "sea" ? "THE SEA" : "THE VILLAGE"];
    else if (this.stageMode === "hunt") {
      const q = this.pickups.find((d) => d.quest);
      if (q) target = [q.x, q.y, "LOST DICE GLOW GOLD"];
    } else if (this.stageMode === "feed" && this.beast) target = [this.beast.img.x, this.beast.img.y - 150, "THE BEAST"];
    if (!target) return 0;
    const [tx, ty, name] = target;
    const cam = this.cameras.main;
    const start = 3300;
    const far = Math.hypot(tx - this.hero.x, ty - this.hero.y);
    const go = Phaser.Math.Clamp(far * 0.06, 700, 1500);
    this.time.delayedCall(start, () => {
      cam.stopFollow();
      sfx.whoosh();
      cam.pan(tx, ty, go, "Sine.easeInOut");
      cam.zoomTo(ZOOM * 0.9, go, "Sine.easeInOut");
    });
    this.time.delayedCall(start + go, () => {
      this.banner(name, "gold", 1000);
      this.sparks.setParticleTint(0xffe066);
      this.sparks.explode(30, tx, ty);
      sfx.lucky();
    });
    this.time.delayedCall(start + go + 1300, () => {
      sfx.whoosh();
      cam.pan(this.hero.x, this.hero.y, go, "Sine.easeInOut");
      cam.zoomTo(ZOOM, go, "Sine.easeInOut");
    });
    this.time.delayedCall(start + go * 2 + 1350, () => cam.startFollow(this.hero, true, 0.14, 0.14));
    return start + go * 2 + 1450;
  }

  /** Night life: fireflies drifting round you, leaves falling on the woods paths. */
  private nightLife(): void {
    if (!effectsOn()) return;
    const flies = this.add.particles(0, 0, "spark", {
      x: { min: -900, max: 900 }, y: { min: -1400, max: 1000 }, lifespan: 3200, speedX: { min: -25, max: 25 }, speedY: { min: -30, max: 10 },
      scale: { start: 0.5, end: 0.1 }, alpha: { start: 1, end: 0 }, tint: [0xd8ff6a, 0xfff38a, 0xaaff8a], blendMode: Phaser.BlendModes.ADD, frequency: 110,
    }).setDepth(TOP + 8702);
    flies.startFollow(this.hero);
    if (this.arena.path) {
      const leaves = this.add.particles(0, 0, "petal", {
        x: { min: -1000, max: 1000 }, y: -1500, lifespan: 6000, speedX: { min: -60, max: 60 }, speedY: { min: 120, max: 220 },
        rotate: { start: 0, end: 360 }, scale: { start: 1.4, end: 1 }, tint: [0x6ab84a, 0xc8a040, 0x8ad65a], frequency: 260,
      }).setDepth(TOP + 8702);
      leaves.startFollow(this.hero);
    }
  }

  // ── Story: the village dice hunt (stage 2)

  /** Two burnt-out buildings in the square, torches round the village and 20 lost dice in the dark. */
  private huntStart(): void {
    // (the ruined village, its streets and torches are drawn with the land: see drawPlace)
    if (!this.placeDrawn) this.torchGrid(2);
    for (const p of this.pickups.filter((q) => q.kind === "dice")) this.removePickup(p);
    this.pickups = this.pickups.filter((q) => q.kind !== "dice");
    for (let i = 0; i < HUNT_DICE; i++) {
      const p = this.addDie("A", ...this.randomSpot(500 + (i % 5) * 450, 950 + (i % 5) * 450), 0);
      p.quest = true;
      // the lost dice shine gold, with a beam of light so you can spot them in the dark
      p.glow.setTint(0xffd23f).setScale(1.3);
      const beam = this.add.image(p.x, p.y, "zone_pillar").setOrigin(0.5, 1).setDisplaySize(70, 420).setTint(0xffe090).setAlpha(0.5).setDepth(p.y - 2);
      this.tweens.add({ targets: beam, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
      p.extra.push(beam, this.topGlow(p.x, p.y - 40, 1.6, 0xffd23f));
    }
    this.time.delayedCall(2600, () => this.toast(`Find all ${HUNT_DICE} dice! Follow the arrow`, "#ffe0a0"));
  }

  /** One more of the lost dice. */
  private huntDie(): void {
    this.huntFound++;
    sfx.found(this.huntFound);
    const ring = this.add.image(this.hero.x, this.hero.y - 60, "fx_ring").setTint(0xffd23f).setScale(0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(TOP + 9050);
    this.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 500, ease: "Quad.out", onComplete: () => ring.destroy() });
    const left = HUNT_DICE - this.huntFound;
    this.callout(`${this.huntFound}/${HUNT_DICE}`, "#ffe066");
    if (left > 0) return;
    this.banner("ALL DICE FOUND!", "gold", 1000);
    this.time.delayedCall(900, () => this.state === "fight" && this.bossCutscene());
  }

  // ── Story: the big boss (stage 4)

  /** Your beast from the cage comes with you to fight the big boss. */
  private beastAlly(): void {
    const def = PET_LIST[(3 * 7) % PET_LIST.length];
    const tex = petTexture(this, def.id);
    const [x, y] = [this.hero.x - 260, this.hero.y + 40];
    const img = this.add.image(x, y, tex).setOrigin(0.5, 0.9).setDepth(y);
    img.setScale(300 / img.height);
    const aura = this.add.image(x, y - 140, "glow").setTint(0x7aff8a).setScale(3.2, 3).setAlpha(0.4).setDepth(y - 1);
    const none = this.add.image(0, 0, "glow").setVisible(false);
    const bar = this.add.graphics();
    this.beast = { img, cage: none, bar, tex, hunger: 1, fed: FEEDS, foodAt: 0, food: null, carried: false, friend: true, escaped: false, stompT: 0, back: none, runes: none, aura, moodT: 0, dustT: 0 };
    this.time.delayedCall(800, () => this.callout("ROAR!", "#b6ff8a"));
  }

  /** The fight is won: your beast says goodbye and runs off home. */
  private beastLeaves(): void {
    const b = this.beast;
    if (!b || !b.friend) return;
    const img = b.img;
    this.time.delayedCall(1400, () => {
      if (!img.active) return;
      this.callout("BYE BYE!", "#b6ff8a");
      for (let i = 0; i < 6; i++) {
        const h = this.add.image(img.x + Phaser.Math.Between(-120, 120), img.y - 200, "pk_heart").setScale(0.2).setDepth(img.y + 100);
        this.tweens.add({ targets: h, y: h.y - 260 - i * 30, scale: 0.9, alpha: 0, duration: 1200, delay: i * 90, onComplete: () => h.destroy() });
      }
      img.setFlipX(false);
      this.tweens.add({ targets: [img, b.aura], x: img.x + 1600, y: img.y - 900, duration: 2400, delay: 500, ease: "Quad.in" });
      this.tweens.add({ targets: [img, b.aura], alpha: 0, duration: 600, delay: 2300 });
    });
    this.beast = null;
  }

  // ── Story: the clock, the night and the lights

  /** A chapter's own rules each frame: its time limit, its path, its lights. */
  private storyTick(delta: number): void {
    const ch = this.story!;
    const m = this.stageMode;
    if (m === "path" && this.state === "fight") this.pathTick(delta);
    // the clock: paths and the hunt run against it from the start, the big boss from when it lands
    let left = -1;
    if (ch.limit && (m === "path" || m === "hunt") && this.state === "fight") left = ch.limit - this.elapsed;
    if (ch.limit && m === "boss" && this.state === "boss") {
      this.storyClock += delta;
      battle.limit = ch.limit;
      left = ch.limit - this.storyClock;
    }
    battle.left = left;
    if (left !== -1 && left <= 0) {
      this.stageLost("time");
      return;
    }
    if (left > 0) this.storyReminders(left, delta);
  }

  /**
   * The clock talks to you: "1 MINUTE LEFT", "30 SECONDS!", "10 SECONDS!", and every few seconds,
   * when you are behind (not far enough up the path, too few dice found), a HURRY UP with a red flash.
   */
  private storyReminders(left: number, delta: number): void {
    for (const at of [60000, 30000, 10000]) {
      if (left <= at && this.saidLeft > at) {
        this.saidLeft = at;
        const big = at <= 10000;
        this.banner(at === 60000 ? "1 MINUTE LEFT!" : `${at / 1000} SECONDS!`, "red", big ? 1100 : 900);
        sfx.hurry();
        buzz(big ? 200 : 80);
        this.game.events.emit("hurry", big);
      }
    }
    if (this.state !== "fight") return;
    this.paceT -= delta;
    if (this.paceT > 0) return;
    this.paceT = 9000;
    const ch = this.story!;
    const used = 1 - left / ch.limit;
    let done = -1;
    const p = this.arena.path;
    if (this.stageMode === "path" && p) done = (p.startY - this.hero.y) / (p.startY - p.endY);
    if (this.stageMode === "hunt") done = this.huntFound / HUNT_DICE;
    if (done < 0) return;
    // where you should be by now (with some slack), and a cheer when you are well ahead
    if (done < used * 1.1 - 0.06) {
      this.banner("HURRY UP!", "red", 900);
      this.toast(this.stageMode === "path" ? "Too slow! Keep running up the path!" : "Find the dice faster! Follow the arrow", "#ffb0a0");
      sfx.hurry();
      buzz(90);
      this.game.events.emit("hurry", false);
    } else if (done > 0.45 && done < 0.6 && !this.halfSaid) {
      this.halfSaid = true;
      this.callout(this.stageMode === "path" ? "HALFWAY THERE!" : "HALF THE DICE!", "#b6ff8a");
      sfx.levelUp();
    }
  }

  /** The night: the lights round you, the torches and windows, the dice and the snack. */
  private nightTick(delta: number): void {
    const n = this.night;
    if (!n) return;
    const t = this.time.now;
    const flicker = 1 + Math.sin(t / 90) * 0.02 + Math.sin(t / 37) * 0.015;
    // your light is the hole in the night; torches, windows and dice glow on top of it
    // (in the lobby the camera is closer, so the light is smaller and the night shows round you)
    const reach = this.state === "lobby" ? 430 : this.hasLantern ? 760 : 400;
    n.update(this.hero.x, this.hero.y - 80, reach * flicker, delta);
    // the night is alive: an owl now and then, crickets
    if (!this.story) return;
    this.ambientT -= delta;
    if (this.ambientT <= 0 && this.fighting) {
      this.ambientT = 5000 + Math.random() * 7000;
      if (Math.random() < 0.4) sfx.owl();
      else sfx.crickets();
    }
    // the lantern swings in your free hand
    if (this.heldLantern) {
      const dir = this.hero.flipX ? 1 : -1;
      this.heldLantern.setPosition(this.hero.x + dir * 46, this.hero.y - 120).setDepth(this.hero.y + 2).setAngle(Math.sin(t / 220) * 10);
      this.heroGlow?.setPosition(this.hero.x, this.hero.y - 80).setScale(6 * flicker);
    }
  }

  private modeTick(delta: number): void {
    const fighting = this.fighting;
    const m = this.stageMode;
    if (m === "air" && fighting) this.airTick(delta);
    if (m === "air") {
      const outside = !!this.air.zone && !this.inAir();
      this.dizzyTick(delta, outside);
      this.fogTick(delta, outside);
    }
    if (m === "feed" || this.beast) this.beastTick(delta, fighting);
    if (m === "dice" && fighting) this.rainTick(delta);
    if (m === "sea") this.seaTick(delta, fighting);
    if (m === "ocean") this.oceanTick(delta, fighting);
    battle.goal = this.modeGoal();
  }

  /** What the HUD shows for this mode instead of the crystal. */
  private modeGoal(): typeof battle.goal {
    const m = this.stageMode;
    const p = this.arena.path;
    if (m === "path" && p) {
      const f = Phaser.Math.Clamp((p.startY - this.hero.y) / (p.startY - p.endY), 0, 1);
      const where = p.kind === "sea" ? "SEA" : "VILLAGE";
      return { frac: f, text: `${where} ${Math.floor(f * 100)}%${this.hasLantern ? "" : "  •  find the lantern"}`, color: 0x8ad65a, icon: p.kind === "sea" ? "icon_fish" : "house_a", alarm: battle.left >= 0 && battle.left < 15000 };
    }
    if (m === "ocean") {
      const o = this.ocean;
      if (o.phase !== "calm") {
        const safe = this.onIsland();
        return { frac: 1, text: safe ? "SAFE ON THE ISLAND" : "TSUNAMI! GET ON AN ISLAND!", color: safe ? 0x7ad651 : 0x4fa8ff, icon: "mode_sea", alarm: !safe };
      }
      const start = this.arena.h - 600;
      const far = Math.hypot(this.hero.x - o.x, this.hero.y - o.y);
      return { frac: Phaser.Math.Clamp(1 - far / Math.hypot(this.arena.w / 2 - o.x, start - o.y), 0, 1), text: far < 2200 ? `LAND HO!  •  ${Math.round(far / 100)}m` : "FIND LAND", color: 0x7ad651, icon: "mode_sea", alarm: false };
    }
    if (m === "sea") {
      const sea = this.sea;
      if (sea.tsunami) {
        const safe = this.onIsland();
        return { frac: sea.phase === "wave" ? sea.waveP : 0, text: `TSUNAMI ${sea.tsunami}/3  •  ${safe ? "SAFE ON THE ISLAND" : "GET ON AN ISLAND!"}`, color: safe ? 0x7ad651 : 0x4fa8ff, icon: "mode_sea", alarm: !safe };
      }
      return { frac: Math.min(1, sea.lv / 6), text: `ATTACK LEVEL ${sea.lv}`, color: sea.lv >= 5 ? 0xf26464 : 0x4fa8ff, icon: "mode_sea", alarm: false };
    }
    if (m === "hunt" && !battle.bossFight) {
      return { frac: this.huntFound / HUNT_DICE, text: `DICE FOUND ${this.huntFound}/${HUNT_DICE}`, color: 0xffb03a, icon: "die_A", alarm: battle.left >= 0 && battle.left < 20000 };
    }
    if (m === "air") {
      const o = this.air.oxygen;
      const inside = this.inAir();
      const text = inside ? `AIR ${Math.round(o * 100)}%  •  moves in ${Math.max(0, Math.ceil(this.air.t / 1000))}s` : `NO AIR HERE!  ${Math.round(o * 100)}% left`;
      return { frac: o, text, color: o > 0.35 ? 0x4fd8ff : 0xf26464, icon: "mode_air", alarm: !inside };
    }
    const b = this.beast;
    if (m === "feed" && b) {
      if (b.friend) return { frac: 1, text: "The beast is your friend!", color: 0x7ad651, icon: "mode_feed", alarm: false };
      if (b.escaped) return { frac: 0, text: "THE BEAST ESCAPED! Run!", color: 0xf26464, icon: "mode_feed", alarm: true };
      const what = b.carried ? "bring it to the cage!" : b.food ? "grab the snack!" : "hunger";
      return { frac: b.hunger, text: `FED ${b.fed}/${FEEDS}  •  ${what}`, color: b.hunger > 0.35 ? 0xffa040 : 0xf26464, icon: "mode_feed", alarm: b.hunger < 0.3 };
    }
    if (m === "dice") return { frac: 1, text: this.eventRun ? `DODGED ${this.rain.dodged}  •  ${this.rain.drops} DROPS` : `DICE DODGED: ${this.rain.dodged}`, color: 0xffe066, icon: "mode_dice", alarm: false };
    if (m === "boss") {
      const left = this.enemies.filter((e) => e.type.boss).length;
      return { frac: Math.max(0, battle.bossFrac), text: left ? `BOSSES LEFT: ${left}` : "Get ready...", color: 0xf26464, icon: "mode_boss", alarm: false };
    }
    return null;
  }

  // ── 1. Air Zone

  private inAir(): boolean {
    const a = this.air;
    return !!a.zone && this.hero.x >= a.x && this.hero.x <= a.x + AIR_ZONE && this.hero.y >= a.y && this.hero.y <= a.y + AIR_ZONE;
  }

  /** The zone on the ground: green now, a blinking yellow one for where it goes next. */
  private zoneGfx(x: number, y: number, next: boolean): Phaser.GameObjects.Graphics {
    // a glowing wall of light: soft wide glow, a bright core, and a sparkling inner rim
    const g = this.add.graphics().setDepth(TOP + (next ? 14001 : 14002));
    const c = next ? 0xffe066 : 0x5affc8;
    const r = 40;
    for (const [w, a] of [[90, 0.12], [56, 0.22], [30, 0.45]] as const) g.lineStyle(w, c, a).strokeRoundedRect(x, y, AIR_ZONE, AIR_ZONE, r);
    g.lineStyle(12, 0xffffff, next ? 0.6 : 0.95).strokeRoundedRect(x, y, AIR_ZONE, AIR_ZONE, r);
    if (!next) {
      g.fillStyle(0xaefff0, 0.06).fillRoundedRect(x, y, AIR_ZONE, AIR_ZONE, r);
      g.fillStyle(0xffffff, 0.9);
      for (let i = 0; i < 40; i++) {
        const t = i / 40;
        const side = i % 4;
        const k = ((i * 0.618) % 1) * AIR_ZONE;
        const [px, py] = side === 0 ? [x + k, y] : side === 1 ? [x + AIR_ZONE, y + k] : side === 2 ? [x + k, y + AIR_ZONE] : [x, y + k];
        g.fillCircle(px, py, 5 + (t * 7) % 6);
      }
      this.tweens.add({ targets: g, alpha: 0.75, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    } else this.tweens.add({ targets: g, alpha: 0.3, duration: 300, yoyo: true, repeat: -1 });
    return g;
  }

  /** Somewhere else on the map, far enough that you have to run. */
  private zoneSpot(): [number, number] {
    const lo = EDGE;
    const hi = ARENA - EDGE - AIR_ZONE;
    let x = lo;
    let y = lo;
    for (let k = 0; k < 20; k++) {
      x = lo + Math.random() * (hi - lo);
      y = lo + Math.random() * (hi - lo);
      const d = Math.hypot(x - this.air.x, y - this.air.y);
      if (d > AIR_ZONE * 1.5 && d < 2400) break;
    }
    return [x, y];
  }

  private airMove(first = false): void {
    const a = this.air;
    if (first) {
      a.x = Phaser.Math.Clamp(this.hero.x - AIR_ZONE / 2, EDGE, ARENA - EDGE - AIR_ZONE);
      a.y = Phaser.Math.Clamp(this.hero.y - AIR_ZONE / 2, EDGE, ARENA - EDGE - AIR_ZONE);
    } else {
      a.x = a.nx;
      a.y = a.ny;
      this.banner("THE AIR MOVED!", "blue", 800);
      sfx.shield(true);
    }
    const old = a.zone;
    if (old) this.tweens.add({ targets: old, alpha: 0, duration: 500, onComplete: () => old.destroy() });
    for (const o of this.airFx) {
      this.tweens.killTweensOf(o);
      this.tweens.add({ targets: o, alpha: 0, duration: 400, onComplete: () => o.destroy() });
    }
    a.next?.destroy();
    a.next = null;
    a.zone = this.zoneGfx(a.x, a.y, false);
    this.drawFog();
    a.zone.setAlpha(0);
    this.tweens.add({ targets: a.zone, alpha: 1, duration: 500 });
    a.t = AIR_EVERY;
    // glowing pillars on the corners, bubbles rising inside and a sign
    const fx: Phaser.GameObjects.GameObject[] = [];
    if (effectsOn()) for (const [px, py] of [[a.x, a.y], [a.x + AIR_ZONE, a.y], [a.x, a.y + AIR_ZONE], [a.x + AIR_ZONE, a.y + AIR_ZONE]]) {
      const pil = this.add.image(px, py, "zone_pillar").setOrigin(0.5, 1).setDisplaySize(110, 760).setBlendMode(Phaser.BlendModes.ADD).setDepth(py + 1).setAlpha(0.8);
      this.tweens.add({ targets: pil, alpha: 0.4, displayWidth: 150, duration: 800, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      fx.push(pil);
    }
    if (effectsOn()) fx.push(this.add.particles(0, 0, "spark", {
      x: { min: a.x, max: a.x + AIR_ZONE }, y: { min: a.y, max: a.y + AIR_ZONE }, lifespan: 2200, speedY: { min: -90, max: -40 },
      scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.8, end: 0 }, tint: [0xffffff, 0xaef4ff, 0x7affb0], frequency: 40,
    }).setDepth(5));
    fx.push(this.sign(a.x + 230, a.y + 300, "AIR ZONE", "stay inside!", "#7affb0"));
    if (effectsOn()) {
      // a wall of toxic clouds billowing round the outside of the zone
      const n = Math.ceil(AIR_ZONE / 210);
      for (let side = 0; side < 4; side++) {
        for (let i = 0; i <= n; i++) {
          const k = (i / n) * AIR_ZONE;
          const [px, py] = side === 0 ? [a.x + k, a.y - 70] : side === 1 ? [a.x + AIR_ZONE + 80, a.y + k] : side === 2 ? [a.x + k, a.y + AIR_ZONE + 60] : [a.x - 80, a.y + k];
          const cl = this.add.image(px, py, (i + side) % 3 ? "toxic_cloud2" : "toxic_cloud").setDepth(TOP + 14000).setScale(0.7 + Math.random() * 0.4).setAlpha(0).setFlipX(Math.random() < 0.5);
          this.tweens.add({ targets: cl, alpha: 0.85, duration: 500, delay: i * 30 });
          this.tweens.add({ targets: cl, scale: cl.scale * 1.15, angle: { from: -4, to: 4 }, duration: 1300 + Math.random() * 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
          fx.push(cl);
        }
      }
      // poison puddles bubbling all over the fog
      for (let i = 0; i < 18; i++) {
        const [x, y] = [EDGE + Math.random() * (ARENA - EDGE * 2), EDGE + Math.random() * (ARENA - EDGE * 2)];
        if (x > a.x - 200 && x < a.x + AIR_ZONE + 200 && y > a.y - 200 && y < a.y + AIR_ZONE + 200) continue;
        const pud = this.add.image(x, y, "toxic_puddle").setDepth(3).setScale(0).setAlpha(0.9);
        this.tweens.add({ targets: pud, scale: 1.2 + Math.random(), duration: 600, ease: "Back.out" });
        const bub = this.add.particles(x, y - 10, "toxic_bubble", {
          lifespan: 900, speedY: { min: -70, max: -30 }, speedX: { min: -15, max: 15 }, scale: { start: 0.3, end: 1 }, alpha: { start: 0.9, end: 0 },
          frequency: 500, emitZone: { type: "random", source: new Phaser.Geom.Ellipse(0, 0, 160, 50), quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        }).setDepth(4);
        fx.push(pud, bub);
      }
    }
    this.airFx = fx;
  }

  /** Things drawn every frame for the mode: your air ring, the path to the cage. */
  private modeFx(): void {
    if (battle.mode !== "run") return;
    const g = this.fx;
    const t = this.time.now;
    if (this.stageMode === "air" && this.air.zone && this.air.oxygen < 0.999) {
      // a ring of air around you, emptying as you run out
      const o = this.air.oxygen;
      const c = o > 0.35 ? 0x4fd8ff : t % 300 < 150 ? 0xffffff : 0xf26464;
      const [hx, hy] = [this.hero.x, this.hero.y - 100];
      g.lineStyle(20, 0x111111, 0.45).strokeCircle(hx, hy, 150);
      g.lineStyle(12, c, 0.95).beginPath().arc(hx, hy, 150, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * o).strokePath();
    }
    // a trail of arrows on the ground from you toward the main goal, marching the way to go
    const goal = this.goalSpots()[0];
    if (goal) {
      const [hx, hy] = [this.hero.x, this.hero.y];
      const d = Math.hypot(goal.x - hx, goal.y - hy);
      const a = Math.atan2(goal.y - hy, goal.x - hx);
      const [ux, uy] = [Math.cos(a), Math.sin(a)];
      const steps = Math.min(9, Math.floor((d - 140) / 110));
      for (let i = 0; i < steps; i++) {
        const k = 150 + (i + ((t / 450) % 1)) * 110;
        const [px, py] = [hx + ux * k, hy + uy * k];
        const fade = Math.min(1, (steps - i) / 3) * 0.9;
        const tri = (s: number) => [px + ux * 34 * s, py + uy * 34 * s, px - ux * 20 * s - uy * 30 * s, py - uy * 20 * s + ux * 30 * s, px - ux * 20 * s + uy * 30 * s, py - uy * 20 * s - ux * 30 * s] as const;
        const o = tri(1.75);
        g.fillStyle(0x2a1a12, fade).fillTriangle(o[0], o[1], o[2], o[3], o[4], o[5]);
        const w = tri(1.5);
        g.fillStyle(0xffffff, fade).fillTriangle(w[0], w[1], w[2], w[3], w[4], w[5]);
        const c = tri(1.2);
        g.fillStyle(goal.color, fade).fillTriangle(c[0], c[1], c[2], c[3], c[4], c[5]);
      }
    }
  }

  /** Air bubbles float out in the fog: grab one for a gulp of air. */
  private airBubbleTick(delta: number): void {
    this.airBubT -= delta;
    if (this.airBubT <= 0) {
      this.airBubT = 4500;
      if (this.airBubbles.length < 5) {
        for (let k = 0; k < 10; k++) {
          const [x, y] = this.randomSpot(350, 900, [this.hero.x, this.hero.y]);
          const a = this.air;
          if (x > a.x - 60 && x < a.x + AIR_ZONE + 60 && y > a.y - 60 && y < a.y + AIR_ZONE + 60) continue;
          const glow = this.add.image(x, y - 60, "glow").setTint(0x9ef0ff).setScale(1.2).setAlpha(0.7).setDepth(TOP + 14004);
          const img = this.add.image(x, y - 60, "mode_air").setScale(0).setDepth(TOP + 14005);
          this.tweens.add({ targets: img, scale: 1, duration: 300, ease: "Back.out" });
          this.tweens.add({ targets: [img, glow], y: y - 100, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
          this.airBubbles.push({ img, glow, life: 14000 });
          break;
        }
      }
    }
    for (const bb of [...this.airBubbles]) {
      bb.life -= delta;
      const got = Math.hypot(this.hero.x - bb.img.x, this.hero.y - 60 - bb.img.y) < 130;
      if (got || bb.life <= 0) {
        this.airBubbles = this.airBubbles.filter((o) => o !== bb);
        this.tweens.killTweensOf([bb.img, bb.glow]);
        if (got) {
          this.air.oxygen = Math.min(1, this.air.oxygen + 0.35);
          this.sparks.setParticleTint(0x9ef0ff);
          this.sparks.explode(20, bb.img.x, bb.img.y);
          this.callout("+AIR!", "#9ef0ff");
          sfx.coin();
        }
        this.tweens.add({ targets: [bb.img, bb.glow], scale: got ? 1.8 : 0, alpha: 0, duration: 250, onComplete: () => [bb.img, bb.glow].forEach((o) => o.destroy()) });
      }
    }
  }

  /**
   * Poison fog over the whole map except the air zone: two layers of swirling purple-green clouds
   * drifting different ways (cut out round the zone by a mask). Toaster mode: a flat tint.
   */
  private drawFog(): void {
    const a = this.air;
    const z = AIR_ZONE;
    if (effectsOn()) {
      if (!this.fogLayers.length) {
        this.fogMask = this.make.graphics({}, false);
        const mask = this.fogMask.createGeometryMask();
        mask.setInvertAlpha(true);
        for (const [key, alpha, scale, depth] of [["toxic_fog", 0.75, 1.6, 13998], ["toxic_fog2", 0.6, 2.4, 13999]] as [string, number, number, number][]) {
          const layer = this.add.tileSprite(ARENA / 2, ARENA / 2, ARENA / scale, ARENA / scale, key).setScale(scale).setAlpha(alpha).setDepth(depth);
          layer.setMask(mask);
          this.fogLayers.push(layer);
        }
        this.fogPuffs = this.add.particles(0, 0, "puff", {
          lifespan: 3000, speedX: { min: -30, max: 30 }, speedY: { min: -20, max: 10 },
          scale: { start: 3, end: 6 }, alpha: { start: 0.16, end: 0 }, tint: [0x7a3aa8, 0x5a8a3a, 0x9a4ac8], frequency: 90, emitting: false,
          emitZone: { type: "random", source: new Phaser.Geom.Rectangle(-800, -1000, 1600, 700), quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        }).setDepth(TOP + 14003);
        this.fogPuffs.startFollow(this.hero);
      }
      // the clear hole the zone cuts in the fog, with soft rounded corners
      this.fogMask!.clear().fillStyle(0xffffff).fillRoundedRect(a.x, a.y, z, z, 40);
      return;
    }
    if (!this.fog) this.fog = this.add.graphics().setDepth(TOP + 14000);
    const f = this.fog.clear();
    f.fillStyle(0x3a1a5a, 0.42);
    f.fillRect(0, 0, ARENA, a.y);
    f.fillRect(0, a.y + z, ARENA, ARENA - a.y - z);
    f.fillRect(0, a.y, a.x, z);
    f.fillRect(a.x + z, a.y, ARENA - a.x - z, z);
  }

  /** The fog drifts and swirls; outside the zone you cough green puffs and go a little green. */
  private fogTick(delta: number, outside: boolean): void {
    const [l1, l2] = this.fogLayers;
    if (l1) {
      l1.tilePositionX += delta * 0.012;
      l1.tilePositionY += delta * 0.006;
      l2.tilePositionX -= delta * 0.008;
      l2.tilePositionY += delta * 0.01;
      l2.setAlpha(0.5 + Math.sin(this.time.now / 1400) * 0.12);
    }
    if (!outside || !this.fighting) {
      if (this.hero.tintTopLeft === 0xb8ff9a) this.hero.clearTint();
      return;
    }
    const choking = this.air.oxygen < 0.35;
    if (choking && this.time.now % 400 < 200) this.hero.setTint(0xb8ff9a);
    else if (this.hero.tintTopLeft === 0xb8ff9a) this.hero.clearTint();
    this.coughT -= delta;
    if (this.coughT <= 0) {
      this.coughT = choking ? 450 : 1100;
      const [x, y] = [this.hero.x + (this.hero.flipX ? -30 : 30), this.hero.y - 120];
      for (let k = 0; k < (choking ? 3 : 1); k++) {
        const p = this.add.image(x, y, "toxic_bubble").setScale(0.5).setDepth(TOP + 14004);
        this.tweens.add({ targets: p, x: x + Phaser.Math.Between(-60, 60), y: y - 70 - k * 20, scale: 1.1, alpha: 0, duration: 650, delay: k * 90, onComplete: () => p.destroy() });
      }
    }
  }

  /** Out of air you get dizzy: the hero sways and staggers, stars spin round their head, the screen wobbles. */
  private dizzyTick(delta: number, outside: boolean): void {
    const want = outside && this.fighting ? 0.35 + 0.65 * (1 - this.air.oxygen) : 0;
    this.dizzy += (want - this.dizzy) * Math.min(1, delta / 400);
    const d = this.dizzy;
    const t = this.time.now / 1000;
    const cam = this.cameras.main;
    this.fogPuffs?.setVisible(true);
    if (this.fogPuffs) this.fogPuffs.emitting = outside && this.fighting;
    if (d < 0.02) {
      if (this.dizzyCam) {
        this.dizzyCam = false;
        cam.setRotation(0);
        cam.setZoom(ZOOM);
      }
      this.hero.setAngle(0);
      this.dizzyStars.forEach((st) => st.setVisible(false));
      if (this.vignette) this.vignette.strength = 0;
      return;
    }
    // swaying and staggering like you are drunk
    this.hero.setAngle(Math.sin(t * 5) * 16 * d);
    if (this.fighting) {
      this.hero.x = clampX(this.hero.x + Math.sin(t * 2.3) * 70 * d * (delta / 1000));
      this.hero.y = clampY(this.hero.y + Math.cos(t * 1.7) * 50 * d * (delta / 1000));
    }
    this.dizzyCam = true;
    cam.setRotation(Math.sin(t * 1.6) * 0.05 * d);
    cam.setZoom(ZOOM * (1 + Math.sin(t * 2.4) * 0.04 * d));
    if (d > 0.5 && Math.random() < 0.02) cam.shake(200, 0.004 * d);
    // dizzy stars
    if (!this.dizzyStars.length) for (let i = 0; i < 3; i++) this.dizzyStars.push(this.add.image(0, 0, "comic_star").setScale(0.55).setDepth(TOP + 14010));
    this.dizzyStars.forEach((st, i) => {
      const a = t * 4 + (i * Math.PI * 2) / 3;
      st.setVisible(true).setAlpha(Math.min(1, d * 1.5)).setPosition(this.hero.x + Math.cos(a) * 70, this.hero.y - 230 + Math.sin(a) * 20).setAngle(t * 200);
    });
    // a dark purple edge closing in (WebGL only)
    if (!this.vignette && cam.postFX && effectsOn()) this.vignette = cam.postFX.addVignette(0.5, 0.5, 0.9, 0);
    if (this.vignette) {
      this.vignette.radius = 0.9 - 0.35 * d;
      this.vignette.strength = 0.25 + 0.3 * d * (0.8 + 0.2 * Math.sin(t * 6));
    }
  }

  private airTick(delta: number): void {
    const a = this.air;
    a.t -= delta;
    if (a.t <= AIR_PREVIEW && !a.next) {
      [a.nx, a.ny] = this.zoneSpot();
      a.next = this.zoneGfx(a.nx, a.ny, true);
      this.toast("The air is moving: run to the yellow zone!", "#ffe066");
      sfx.alarm();
    }
    if (a.t <= 0) this.airMove();
    this.airBubbleTick(delta);
    const inside = this.inAir();
    a.oxygen = Phaser.Math.Clamp(a.oxygen + (inside ? 0.5 : -1 / AIR_SECS) * (delta / 1000), 0, 1);
    // no air left: you choke, a bite of health every half second
    if (a.oxygen <= 0) {
      a.choke -= delta;
      if (a.choke <= 0) {
        a.choke = 500;
        this.hurt(this.heroMax * 0.07);
      }
    } else a.choke = 0;
  }

  // ── 3. Feed the Beast

  private beastSpawn(): void {
    const [cx, cy] = this.arena.center;
    // the story's beast is the same one you meet again at the big boss
    const def = PET_LIST[((this.story ? 3 : save.stage) * 7) % PET_LIST.length];
    const tex = petTexture(this, def.id);
    const img = this.add.image(cx, cy + 40, tex).setOrigin(0.5, 0.9).setDepth(cy + 40);
    img.setScale(420 / img.height);
    // it breathes: belly swells and the whole body rises a little
    this.tweens.add({ targets: img, scaleY: img.scaleY * 1.05, scaleX: img.scaleX * 0.98, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    // a round stone platform with a ring of runes that glow and pulse
    this.add.image(cx, cy + 70, "cage_base2").setOrigin(330 / 660, 90 / 260).setDepth(cy - 6);
    const runes = this.add.image(cx, cy + 70, "cage_runes").setOrigin(330 / 660, 90 / 200).setTint(0x6ac8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(cy - 5);
    this.tweens.add({ targets: runes, alpha: 0.45, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    // a glow behind the beast: calm blue, turning red as it starves
    const aura = this.add.image(cx, cy - 140, "glow").setTint(0x6ac8ff).setScale(4.6, 4.2).setAlpha(0.4).setDepth(cy + 20);
    this.add.ellipse(cx, cy + 46, 300, 70, 0x000000, 0.3).setDepth(cy + 25);
    // a round iron birdcage in two halves: the back bars behind the beast, the front bars, dome and lock in front
    const back = this.add.image(cx, cy + 70, "cage_back").setOrigin(0.5, 520 / 620).setDepth(cy + 30);
    const cage = this.add.image(cx, cy + 70, "cage_front").setOrigin(0.5, 520 / 620).setDepth(cy + 41);
    cage.once("destroy", () => back.destroy());
    const bar = this.add.graphics().setDepth(cy + 42);
    this.feedSign = this.sign(cx + 470, cy + 260, "FEED ME!", `0/${FEEDS} snacks`, "#ffd29a");
    for (const [dx, dy] of [[-380, 190], [-300, 260], [360, 120]]) this.addStatic(this.add.image(cx + dx, cy + dy, "food_bowl").setDepth(cy + dy), cx + dx, cy + dy);
    // a thought bubble: what the beast wants
    const tg = this.add.graphics();
    tg.fillStyle(0xffffff, 1).fillEllipse(0, 0, 170, 130).fillCircle(-60, 90, 18).fillCircle(-84, 124, 10);
    tg.lineStyle(6, 0x111111, 1).strokeEllipse(0, 0, 170, 130).strokeCircle(-60, 90, 18).strokeCircle(-84, 124, 10);
    this.beastThought = this.add.container(cx + 250, cy - 520, [tg, this.add.image(0, 0, "mode_feed").setScale(0.8)]).setDepth(cy + 600).setVisible(false);
    this.beast = { img, cage, bar, tex, hunger: 1, fed: 0, foodAt: FEED_FIRST, food: null, carried: false, friend: false, escaped: false, stompT: 0, back, runes, aura, moodT: 2000, dustT: 0 };
    // at night its cage glows (the runes light it up)
    if (this.night) this.nightGlow(cx, cy - 160, 5, 0.6);
  }

  private beastTick(delta: number, fighting: boolean): void {
    const b = this.beast;
    if (!b || b.escaped) return;
    if (b.friend) {
      if (fighting) this.friendTick(delta);
      return;
    }
    const [cx, cy] = this.arena.center;
    if (this.state === "fight") {
      // the story's beast is a little more patient (losing it loses the stage)
      b.hunger -= delta / (HUNGER_MS * (this.story ? 1.35 : 1));
      if (b.hunger <= 0) {
        this.beastEscape();
        return;
      }
      if (!b.food && b.fed < FEEDS && this.elapsed >= b.foodAt) {
        b.foodAt += FEED_EVERY;
        const [x, y] = this.randomSpot(1200, 2200, [cx, cy]);
        b.food = this.add.image(x, y - 60, "mode_feed").setScale(0).setDepth(y);
        this.tweens.add({ targets: b.food, scale: 1.6, duration: 400, ease: "Back.out" });
        this.tweens.add({ targets: b.food, angle: { from: -10, to: 10 }, duration: 400, yoyo: true, repeat: -1 });
        this.tweens.add({ targets: b.food, y: y - 110, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        // a glow, a shadow and a beam of light so you can't miss it
        const glow = this.add.image(x, y - 80, "glow").setTint(0xffa040).setScale(1.6).setAlpha(0.7).setDepth(y - 2);
        const shadow = this.add.ellipse(x, y, 110, 34, 0x000000, 0.3).setDepth(y - 3);
        const beam = this.add.image(x, y, "zone_pillar").setOrigin(0.5, 1).setDisplaySize(90, 600).setTint(0xffc070).setBlendMode(Phaser.BlendModes.ADD).setDepth(y - 1);
        this.tweens.add({ targets: [glow, beam], alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });
        const top = this.night ? this.topGlow(x, y - 80, 2.2, 0xffa040) : null;
        b.food.once("destroy", () => [glow, shadow, beam, top].forEach((o) => o?.destroy()));
        b.food.setData("fx", [glow, shadow, beam, ...(top ? [top] : [])]);
        this.toast("A snack appeared! Bring it to the beast", "#ffd29a");
        sfx.gift();
      }
    }
    if (b.food) {
      if (!b.carried && Math.hypot(this.hero.x - b.food.x, this.hero.y - b.food.y) < 130) {
        b.carried = true;
        this.tweens.killTweensOf(b.food);
        (b.food.getData("fx") as Phaser.GameObjects.GameObject[]).forEach((o) => o.destroy());
        b.food.setScale(1.3).setAngle(0);
        sfx.coin();
      }
      if (b.carried) {
        b.food.setPosition(this.hero.x, this.hero.y - 250).setDepth(this.hero.y + 5);
        if (Math.hypot(this.hero.x - cx, this.hero.y - cy) < 380) this.feedBeast();
      }
    }
    // the hunger bar over the cage; a starving beast rattles the bars
    b.bar.clear();
    drawBar(b.bar, cx - 200, b.cage.y - 600, 400, 30, b.hunger, b.hunger > 0.35 ? 0xffa040 : 0xf26464);
    const rattle = b.hunger < 0.3 && this.time.now % 300 < 150 ? Phaser.Math.Between(-10, 10) : 0;
    b.cage.x = cx + rattle;
    b.back.x = cx + rattle * 0.6;
    this.beastMood(delta);
    const th = this.beastThought;
    if (th) {
      th.setVisible(b.hunger < 0.75);
      th.setScale(b.hunger < 0.3 ? 1 + Math.sin(this.time.now / 80) * 0.12 : 1 + Math.sin(this.time.now / 300) * 0.05);
    }
    // a hungry beast roars and rattles its cage
    if (this.state === "fight" && b.hunger < 0.3) {
      this.roarT -= delta;
      if (this.roarT <= 0) {
        this.roarT = 2500;
        this.cameras.main.shake(250, 0.006);
        this.tweens.add({ targets: b.img, scaleX: b.img.scaleX * 1.12, duration: 120, yoyo: true, repeat: 1 });
        this.callout("GRRR!", "#ff8a6a");
        sfx.alarm();
      }
    }
  }

  /** The beast's moods: calm and curious when fed, steaming and red with rage when starving. */
  private beastMood(delta: number): void {
    const b = this.beast!;
    const h = b.hunger;
    // the glow and the runes go from calm blue to angry red
    const mood = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xff3a3a), Phaser.Display.Color.ValueToColor(0x6ac8ff), 100, Math.round(Phaser.Math.Clamp(h * 1.4, 0, 1) * 100));
    const col = Phaser.Display.Color.GetColor(mood.r, mood.g, mood.b);
    b.aura.setTint(col).setAlpha(0.3 + (h < 0.35 ? 0.25 + Math.sin(this.time.now / 120) * 0.15 : 0.1));
    b.runes.setTint(col);
    // starving: its body flushes red in pulses
    if (h < 0.35 && this.time.now % 500 < 220) b.img.setTint(0xff9a8a);
    else b.img.clearTint();
    b.moodT -= delta;
    if (b.moodT > 0) return;
    if (h < 0.35) {
      // angry steam out of its head, and it grabs the bars
      b.moodT = 380;
      for (const s of [-1, 1]) {
        const p = this.add.image(b.img.x + s * 70, b.img.y - b.img.displayHeight * 0.85, "puff").setTint(0xffd0c8).setScale(0.6).setAlpha(0.8).setDepth(b.img.depth + 2);
        this.tweens.add({ targets: p, x: p.x + s * 60, y: p.y - 120, scale: 1.6, alpha: 0, duration: 700, onComplete: () => p.destroy() });
      }
      if (Math.random() < 0.3) this.tweens.add({ targets: [b.cage, b.back], scaleX: 1.04, scaleY: 0.97, duration: 80, yoyo: true });
    } else {
      // calm: it looks around, now and then a happy hop
      b.moodT = 1800 + Math.random() * 1800;
      b.img.setFlipX(!b.img.flipX);
      if (Math.random() < 0.4) this.tweens.add({ targets: b.img, y: b.img.y - 30, duration: 160, yoyo: true, ease: "Quad.out" });
    }
  }

  private feedBeast(): void {
    const b = this.beast!;
    const food = b.food!;
    b.food = null;
    b.carried = false;
    this.tweens.add({ targets: food, x: b.img.x, y: b.img.y - 220, scale: 0.3, duration: 300, onComplete: () => food.destroy() });
    b.hunger = 1;
    b.fed++;
    b.aura.setTint(0xff7ab8).setAlpha(0.9);
    this.tweens.add({ targets: b.runes, scale: 1.08, duration: 150, yoyo: true });
    this.tweens.add({ targets: b.img, scaleX: b.img.scaleX * 1.15, duration: 120, yoyo: true, repeat: 2 });
    this.sparks.setParticleTint(0xff7ab8);
    this.sparks.explode(30, b.img.x, b.img.y - 250);
    // hearts float up out of the cage
    for (let i = 0; i < 6; i++) {
      const h = this.add.image(b.img.x + Phaser.Math.Between(-160, 160), b.img.y - 200, "pk_heart").setScale(0.2).setDepth(b.img.y + 100);
      this.tweens.add({ targets: h, y: h.y - 260 - i * 30, scale: 0.9, alpha: 0, angle: Phaser.Math.Between(-30, 30), duration: 1200, delay: i * 90, onComplete: () => h.destroy() });
    }
    const fs = this.feedSign;
    if (fs) {
      (fs.list[2] as Phaser.GameObjects.Text).setText(`${b.fed}/${FEEDS} snacks`);
      this.tweens.add({ targets: fs, scale: 1.2, duration: 120, yoyo: true });
    }
    sfx.levelUp();
    this.addDie(rollDiceTier(save.stage + 5), b.img.x + 260, b.img.y + 160, 30000);
    if (b.fed >= FEEDS) this.beastFriend();
    else this.callout(`YUM! ${b.fed}/${FEEDS}`, "#ffd29a");
  }

  /** Fed all 6 times: the cage flies off and the beast fights on your side. */
  private beastFriend(): void {
    const b = this.beast!;
    b.friend = true;
    b.bar.clear();
    this.beastThought?.destroy();
    this.beastThought = null;
    const cage = b.cage;
    // the cage unlocks: the lock pops, both halves lift off into the sky
    this.sparks.setParticleTint(0xffd23f);
    this.sparks.explode(30, cage.x, cage.y - 160);
    this.tweens.add({ targets: [cage, b.back], y: cage.y - 1100, alpha: 0, angle: 25, duration: 1000, ease: "Back.in", onComplete: () => cage.destroy() });
    this.tweens.add({ targets: b.runes, alpha: 0, duration: 800 });
    b.aura.setTint(0x7aff8a);
    this.tweens.killTweensOf(b.img);
    this.tweens.add({ targets: b.img, scale: (300 / b.img.height), duration: 500, ease: "Back.out" });
    this.banner("BEST FRIENDS!", "green", 1000);
    this.toast("The beast will fight the boss with you!", "#b6ff8a");
    this.sparks.setParticleTint(0xff7ab8);
    this.sparks.explode(60, b.img.x, b.img.y - 200);
    sfx.superRoll();
  }

  /** Your beast walks with you and stomps monsters (and the boss). */
  private friendTick(delta: number): void {
    const b = this.beast!;
    const img = b.img;
    const target = this.enemies.find((e) => e.type.boss) ?? this.nearestEnemies(img.x, img.y, 900, 1)[0];
    const tx = target ? target.img.x : this.hero.x - 200;
    const ty = target ? target.img.y + 30 : this.hero.y + 60;
    const d = Math.hypot(tx - img.x, ty - img.y);
    if (d > 120) {
      const step = Math.min(d - 100, (360 * delta) / 1000);
      img.x += ((tx - img.x) / d) * step;
      img.y += ((ty - img.y) / d) * step;
      img.setFlipX(tx < img.x).setDepth(img.y);
      // a heavy waddle and dust kicking up at its feet
      img.setAngle(Math.sin(this.time.now / 110) * 7);
      b.dustT -= delta;
      if (b.dustT <= 0) {
        b.dustT = 220;
        this.puff.setParticleTint(0xd8c8a8);
        this.puff.explode(3, img.x + Phaser.Math.Between(-60, 60), img.y);
      }
    } else img.setAngle(0);
    b.aura.setPosition(img.x, img.y - img.displayHeight * 0.45).setDepth(img.depth - 1).setScale(3.2, 3).setAlpha(0.35 + Math.sin(this.time.now / 300) * 0.1);
    b.stompT -= delta;
    if (target && d < 330 && b.stompT <= 0) {
      b.stompT = 1200;
      this.tweens.add({ targets: img, y: img.y - 60, duration: 140, yoyo: true, ease: "Quad.out" });
      this.cameras.main.shake(100, 0.004);
      this.time.delayedCall(140, () => this.impact(img.x, img.y, 300, "dust", 0xffa040));
      this.blast(img.x, img.y - 40, 300, this.heroDamage() * 4, null, 0xffa040);
    }
  }

  /** Too hungry: it breaks out of the cage and hunts you. */
  private beastEscape(): void {
    const b = this.beast!;
    b.escaped = true;
    b.bar.clear();
    this.beastThought?.destroy();
    this.beastThought = null;
    b.food?.destroy();
    b.food = null;
    b.carried = false;
    const cage = b.cage;
    this.tweens.add({ targets: [cage, b.back], alpha: 0, scale: 1.4, duration: 400, onComplete: () => cage.destroy() });
    this.tweens.add({ targets: b.aura, alpha: 0, duration: 600, onComplete: () => b.aura.destroy() });
    b.runes.setTint(0xff3a3a);
    this.tweens.killTweensOf(b.runes);
    this.tweens.add({ targets: b.runes, alpha: 0, duration: 1200 });
    // the bars and the padlock fly off in every direction, spinning
    const [ox, oy] = [cage.x, cage.y - 220];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const piece = this.add.image(ox, oy, "cage_bar").setDepth(cage.y + 500).setAngle(i * 26).setScale(1.2);
      const fly = 600 + Math.random() * 400;
      this.tweens.add({ targets: piece, x: ox + Math.cos(a) * fly, y: oy + Math.sin(a) * fly * 0.65 - 160, angle: piece.angle + 900, duration: 900, ease: "Quad.out" });
      this.tweens.add({ targets: piece, y: "+=380", alpha: 0, delay: 900, duration: 500, ease: "Quad.in", onComplete: () => piece.destroy() });
    }
    this.boom(ox, oy, 2.4);
    this.impact(cage.x, cage.y - 40, 320, "blast", 0xff3a3a);
    this.puff.setParticleTint(0x9aa4b8);
    this.puff.explode(40, cage.x, cage.y);
    this.cameras.main.shake(500, 0.015);
    sfx.alarm();
    buzz(200);
    this.banner("THE BEAST ESCAPED!", "red", 1200);
    // the story's beast must not get away: the stage is lost
    if (this.story) this.time.delayedCall(1600, () => this.fighting && this.stageLost("beast"));
    const [x, y] = [b.img.x, b.img.y];
    b.img.destroy();
    const e = this.addEnemy({ tex: b.tex, stats: { ...BOSS, hp: BOSS.hp * 0.5, speed: 230, dmg: BOSS.dmg * 1.6, xp: 40, cash: 80 }, fx: 0xffa040 }, x, y, true, false, 1.9);
    e.huntHero = true;
    // enraged: a red glow round it and steam pouring off
    const rage = this.add.image(x, y - 120, "glow").setTint(0xff2a2a).setScale(3.4, 3).setAlpha(0.55).setDepth(y - 2);
    this.tweens.add({ targets: rage, alpha: 0.25, duration: 300, yoyo: true, repeat: -1 });
    const steam = this.time.addEvent({
      delay: 260, loop: true, callback: () => {
        if (!e.img.active || !this.enemies.includes(e)) {
          rage.destroy();
          steam.remove();
          return;
        }
        rage.setPosition(e.img.x, e.img.y - 120).setDepth(e.img.depth - 1);
        const p = this.add.image(e.img.x + Phaser.Math.Between(-50, 50), e.img.y - e.img.displayHeight * 0.8, "puff").setTint(0xffb0a8).setScale(0.5).setAlpha(0.7).setDepth(e.img.depth + 2);
        this.tweens.add({ targets: p, y: p.y - 120, scale: 1.5, alpha: 0, duration: 650, onComplete: () => p.destroy() });
      },
    });
  }

  // ── 4. Dice Rain

  private rainTick(delta: number): void {
    const r = this.rain;
    r.t -= delta;
    if (r.t > 0) return;
    r.t = (this.state === "boss" ? 1700 : Math.max(700, 2000 - this.minute * 300)) * (0.75 + Math.random() * 0.5);
    const n = 1 + (this.minute >= 2 && Math.random() < 0.5 ? 1 : 0) + (this.minute >= 4 && Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      // most land near you, some a bit further away
      const a = Math.random() * Math.PI * 2;
      const d = i === 0 && Math.random() < 0.6 ? Math.random() * 160 : 250 + Math.random() * 650;
      this.dropBigDie(clampX(this.hero.x + Math.cos(a) * d), clampY(this.hero.y + Math.sin(a) * d));
    }
  }

  /**
   * A giant die of a random tier (A is common, uSSS very rare). The rarer it is, the bigger it hits
   * and the wider, the faster it falls and the louder its show: trails, flashes, shockwaves.
   * Its shadow and a ring in its colour warn you where it lands.
   */
  private dropBigDie(x: number, y: number): void {
    const tier = pickWeighted(RAIN_TIERS);
    const rank = tierIndex(tier);
    const color = TIER_INFO[tier].color;
    const R = 150 + rank * 28;
    const fall = Math.max(600, 1450 - rank * 115);
    const dmg = this.heroMax * (0.14 + rank * 0.045);
    const shadow = this.add.ellipse(x, y, R * 2, R, 0x000000, 0.35).setScale(0.15).setDepth(4);
    const ring = this.add.ellipse(x, y, R * 2, R).setStrokeStyle(8 + rank, rank >= 3 ? color : 0xff3a3a, 0.95).setDepth(4);
    const inner = this.add.ellipse(x, y, R * 2, R, rank >= 3 ? color : 0xff3a3a, 0.18).setDepth(4).setScale(0);
    this.tweens.add({ targets: ring, alpha: 0.3, duration: Math.max(80, 180 - rank * 15), yoyo: true, repeat: -1 });
    this.tweens.add({ targets: [shadow, inner], scale: 1, duration: fall, ease: "Quad.in" });
    // it starts small (high up) and grows as it comes down
    const size = 2.4 + rank * 0.28;
    const die = this.add.image(x, y - 1500, `die_${tier}`).setScale(size * 0.3).setDepth(y + 2000);
    this.tweens.add({ targets: die, angle: Phaser.Math.Between(-400, 400) * (1 + rank * 0.3), scale: size, duration: fall, ease: "Quad.in" });
    // rare ones glow and leave a trail of sparks on the way down
    let trail: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    if (rank >= 2) {
      trail = this.add.particles(0, 0, "spark", {
        speed: { min: 20, max: 80 }, lifespan: 500, scale: { start: 0.6 + rank * 0.1, end: 0 }, tint: [color, 0xffffff],
        blendMode: Phaser.BlendModes.ADD, frequency: Math.max(12, 50 - rank * 6),
      }).setDepth(y + 1999);
      trail.startFollow(die);
      if (rank >= 5) sfx.charge(3);
    }
    const atSea = !!this.arena.sea;
    const rolls = !atSea && rank <= 2 && Math.random() < 0.3;
    this.tweens.add({
      targets: die, y: y - 40, duration: fall, ease: "Quad.in",
      onComplete: () => {
        ring.destroy();
        shadow.destroy();
        inner.destroy();
        trail?.stop();
        this.time.delayedCall(600, () => trail?.destroy());
        if (!this.fighting) {
          this.tweens.add({ targets: die, alpha: 0, duration: 300, onComplete: () => die.destroy() });
          return;
        }
        this.cameras.main.shake(140 + rank * 50, 0.006 + rank * 0.002);
        sfx.boom();
        buzz(30 + rank * 15);
        if (rank >= 4) this.cameras.main.flash(120 + rank * 20, (color >> 16) & 255, (color >> 8) & 255, color & 255);
        this.puff.setParticleTint(atSea ? 0xe8f8ff : 0xd8c8a8);
        this.puff.explode(20 + rank * 6, x, y);
        if (atSea) this.splash(x, y, 24 + rank * 6, 1.2 + rank * 0.15);
        else this.stars.explode(6 + rank * 3, x, y - 80);
        if (rank >= 2) {
          this.sparks.setParticleTint(color);
          this.sparks.explode(15 + rank * 8, x, y - 60);
        }
        die.setAngle(Math.round(die.angle / 90) * 90);
        this.tweens.add({ targets: die, scaleY: size * 0.75, scaleX: size * 1.25, duration: 90, yoyo: true });
        // one shockwave, more for the rare ones
        for (let k = 0; k <= Math.floor(rank / 2); k++) {
          const wave = this.add.ellipse(x, y, R * 2, R).setStrokeStyle(14, k ? color : 0xffffff, 0.9).setDepth(5).setScale(0.4);
          this.tweens.add({ targets: wave, scale: 1.8 + k * 0.4, alpha: 0, duration: 450 + k * 120, delay: k * 110, ease: "Quad.out", onComplete: () => wave.destroy() });
        }
        if (!atSea) {
          const crack = this.add.image(x, y, "dice_crack").setDepth(3).setScale(1 + rank * 0.18);
          this.tweens.add({ targets: crack, alpha: 0, delay: 2200, duration: 800, onComplete: () => crack.destroy() });
        }
        if (Math.hypot(this.hero.x - x, (this.hero.y - y) * 2) < R + HERO_R) {
          this.hurt(dmg);
          this.callout(rank >= 5 ? `${tier} SMASH!` : "SQUASHED!", "#ff8a8a");
        } else {
          this.rain.dodged++;
          if (this.eventRun) this.rain.drops += dodgeDrops(rank);
        }
        // monsters under it get squashed too
        for (const e of this.near(x, y, R)) if (!e.type.boss) this.hit(e, e.maxHp * (0.6 + rank * 0.2) + this.heroDamage() * (3 + rank));
        // the rare ones leave a real die behind
        if (rank >= 4) {
          this.addDie(rollDiceTier(save.stage + rank), x + 70, y + 30, 30000);
          this.callout(`${tier} DIE!`, TIER_INFO[tier].css);
        } else if (Math.random() < 0.1) this.addDie(rollDiceTier(save.stage), x, y, 30000);
        die.setDepth(y + 10);
        if (rolls) {
          // it tumbles on across the ground: get out of its way!
          const a = Math.random() * Math.PI * 2;
          let hitYou = false;
          this.tweens.add({
            targets: die, x: clampX(x + Math.cos(a) * 650), y: clampY(y + Math.sin(a) * 450) - 40, angle: die.angle + (Math.cos(a) > 0 ? 540 : -540),
            duration: 900, delay: 250, ease: "Quad.out",
            onUpdate: () => {
              die.setDepth(die.y + 60);
              if (!hitYou && this.fighting && Math.hypot(this.hero.x - die.x, this.hero.y - (die.y + 40)) < 150) {
                hitYou = true;
                this.hurt(dmg * 0.7);
                this.callout("BONK!", "#ff8a8a");
              }
              for (const en of this.near(die.x, die.y + 40, 140)) if (!en.type.boss) this.hit(en, en.maxHp);
            },
          });
          this.tweens.add({ targets: die, alpha: 0, delay: 1300, duration: 300, onComplete: () => die.destroy() });
          return;
        }
        if (atSea) {
          // it goes under: sinks, turns blue and fades, with bubbles coming up after it
          die.setDepth(y - 5);
          this.tweens.add({ targets: die, y: y + 60, scale: size * 0.55, angle: die.angle + Phaser.Math.Between(-60, 60), alpha: 0, duration: 1100, ease: "Quad.in", onComplete: () => die.destroy() });
          this.tweens.addCounter({ from: 0, to: 100, duration: 500, onUpdate: (tw) => {
            const k = (tw.getValue() ?? 0) / 100;
            die.setTint(Phaser.Display.Color.GetColor(255 - 160 * k, 255 - 90 * k, 255));
          } });
          if (effectsOn()) for (let b = 0; b < 6; b++) {
            const bub = this.add.circle(x + Phaser.Math.Between(-40, 40), y + 20, 6 + Math.random() * 6).setStrokeStyle(3, 0xffffff, 0.9).setDepth(y + 1);
            this.tweens.add({ targets: bub, y: bub.y - 70 - Math.random() * 40, alpha: 0, scale: 1.6, delay: 300 + b * 120, duration: 700, onComplete: () => bub.destroy() });
          }
          return;
        }
        this.tweens.add({ targets: die, y: y - 110, duration: 200, yoyo: true, ease: "Quad.out" });
        this.tweens.add({ targets: die, alpha: 0, delay: 700 + rank * 100, duration: 400, onComplete: () => die.destroy() });
      },
    });
  }

  // ── 5. Boss Battle

  /** Hardcore: you start with your best gadgets maxed out and a full set of skills. */
  private fullPower(): void {
    const tier = GADGET_TIERS[gadgetTierCap()];
    this.gadgets = [];
    for (const k of shuffle([...GADGET_KINDS]).slice(0, GADGET_SLOTS)) this.addGadget(k, tier, MAX_GADGET_LEVEL);
    for (const sk of shuffle(SKILLS.filter((k) => !CRYSTAL_SKILLS.includes(k.id))).slice(0, SKILL_SLOTS)) this.skills[sk.id] = 3;
    battle.skills = this.skills;
    if (this.skills.tough) {
      this.heroMax = heroHpAt(save.stage) * villageHpMult() * (1 + 0.25 * this.skills.tough);
      this.heroHp = this.heroMax;
    }
    this.game.events.emit("skills-changed");
    this.time.delayedCall(700, () => this.callout("FULL POWER!", "#ffe066"));
  }

  /** The big boss grows HUGE and three smaller bosses join it. */
  private bossKids(boss: Enemy, x: number, y: number): void {
    boss.hp = boss.maxHp = Math.round(boss.maxHp * BIG_BOSS_HP);
    boss.r *= 1.4;
    this.tweens.add({ targets: boss.img, scale: 1.3 * 1.6, duration: 500, delay: 400, ease: "Back.out" });
    boss.aura?.destroy();
    boss.aura = this.add.image(x, y, "glow").setTint(0xff3a3a).setScale(3.6, 1.4).setAlpha(0.7).setDepth(y - 1);
    this.tweens.add({ targets: boss.aura, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    for (let i = 0; i < BOSS_KIDS; i++) {
      const kid = bossForStage(((save.stage - 1 + (i + 1) * BOSS_EVERY) % MAX_STAGE) + 1);
      // the kids come out on the far side of the boss, never on top of you
      const away = Math.atan2(y - this.hero.y, x - this.hero.x);
      const a = away + (i - (BOSS_KIDS - 1) / 2) * 0.9;
      const e = this.addEnemy({ tex: kid.tex, stats: BOSS, fx: kid.color, boss: true, moves: kid.moves }, clampX(x + Math.cos(a) * 420), clampY(y + Math.sin(a) * 300), false, false, 0.7);
      e.hp = e.maxHp = Math.round(boss.maxHp * KID_HP);
      // each kid comes out of a purple portal
      const portal = this.add.ellipse(e.img.x, e.img.y, 260, 90).setStrokeStyle(12, 0xb36aff).setFillStyle(0x2a0a44, 0.6).setDepth(e.img.y - 2).setScale(0);
      this.tweens.add({ targets: portal, scale: 1.2, duration: 300, ease: "Back.out" });
      this.tweens.add({ targets: portal, scale: 0, alpha: 0, delay: 1200, duration: 400, onComplete: () => portal.destroy() });
      this.puff.setParticleTint(0xb36aff);
      this.puff.explode(20, e.img.x, e.img.y - 40);
      e.huntHero = true;
      e.phaseT = 3500 + i * 900;
    }
  }

  /** A health number like 1.2K / 3K on a bar (labels are reused frame to frame). */
  private hpNum(x: number, y: number, hp: number, max: number, size: number): void {
    if (!save.settings.hpNumbers) return;
    let t = this.hpLabels[this.hpUsed];
    if (!t) {
      t = text(this, 0, 0, "", size, "#ffffff", { stroke: 6 }).setDepth(TOP + 9102);
      this.hpLabels.push(t);
    }
    this.hpUsed++;
    // changing a text's size or words redraws its texture, so only do it when they change
    if (t.getData("size") !== size) {
      t.setData("size", size);
      t.setFontSize(size);
    }
    t.setVisible(true).setPosition(x, y).setText(`${fmt(Math.max(0, Math.ceil(hp)))} / ${fmt(Math.ceil(max))}`);
  }

  private bossCutscene(): void {
    this.state = "cutscene";
    battle.bossFight = true;
    this.joy = { ...NO_JOY };
    for (const e of [...this.enemies]) this.kill(e, true);
    this.bullets.forEach((b) => b.img.destroy());
    this.bullets = [];
    this.clearThrown();
    this.shielded = battle.shielded = false;
    this.tweens.killTweensOf(this.shieldImg);
    this.tweens.add({ targets: this.shieldImg, scale: 0, duration: 300 });
    music.play("calm");
    sfx.alarm();
    buzz(200);
    this.game.events.emit("boss-warning");
    const cam = this.cameras.main;
    if (this.stageMode !== "crystal") {
      // no crystal to take: a quick storm and the boss drops in
      this.tweens.add({ targets: this.gloom, fillAlpha: 0.3, duration: 800 });
      for (const t of [500, 1300]) this.time.delayedCall(t, () => {
        cam.flash(120, 255, 255, 255);
        sfx.thunder();
      });
      this.time.delayedCall(2400, () => this.dropBoss());
      return;
    }
    const [cx, cy] = this.crystalHome;
    cam.stopFollow();
    cam.pan(cx, cy - 300, 900, "Sine.easeInOut");
    cam.zoomTo(0.72, 900, "Sine.easeInOut");
    this.tweens.add({ targets: this.gloom, fillAlpha: 0.45, duration: 1200 });
    const storm = this.add.image(cx, cy - 1050, "storm").setAlpha(0).setScale(0.6).setDepth(TOP + 20000);
    this.tweens.add({ targets: storm, alpha: 1, scale: 1.5, duration: 900, delay: 400, ease: "Back.out" });
    this.tweens.add({ targets: storm, x: cx + 30, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: 1300 });
    for (const t of [1000, 1700, 3000]) this.time.delayedCall(t, () => {
      cam.flash(120, 255, 255, 255);
      sfx.thunder();
    });
    // a beam of light from the clouds onto the crystal
    canvasTexture(this, "light_beam", 128, 256, (c) => {
      const g = c.createLinearGradient(0, 0, 128, 0);
      g.addColorStop(0, "rgba(255,240,180,0)");
      g.addColorStop(0.3, "rgba(255,245,200,0.75)");
      g.addColorStop(0.5, "rgba(255,255,255,1)");
      g.addColorStop(0.7, "rgba(255,245,200,0.75)");
      g.addColorStop(1, "rgba(255,240,180,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 256);
    });
    const beamTop = cy - 1050;
    const beam = this.add.image(cx, beamTop, "light_beam").setOrigin(0.5, 0).setDepth(TOP + 19999).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(260, 1).setAlpha(0.95);
    const halo = this.add.image(cx, cy - 120, "glow").setTint(0xfff3b0).setScale(0).setDepth(TOP + 19998).setBlendMode(Phaser.BlendModes.ADD);
    this.time.delayedCall(1400, () => {
      sfx.shield(true);
      this.tweens.add({ targets: beam, displayHeight: cy - beamTop + 40, duration: 450, ease: "Quad.in" });
      this.tweens.add({ targets: halo, scale: 2.4, duration: 600, delay: 400, ease: "Back.out" });
      this.tweens.add({ targets: beam, displayWidth: 320, duration: 300, yoyo: true, repeat: -1, delay: 450 });
    });
    this.time.delayedCall(2350, () => {
      sfx.superRoll();
      cam.shake(300, 0.008);
      cam.flash(250, 255, 250, 210);
      this.tweens.killTweensOf(this.crystal);
      this.crystalSparkle.stop();
      this.tweens.killTweensOf(this.crystalGlow);
      this.tweens.add({ targets: this.crystalGlow, alpha: 0, duration: 400 });
      this.crystal.setTintFill(0xffffff).setDepth(TOP + 19998);
      // the crystal rises into the light, shrinking to a sparkle, and is gone
      this.tweens.add({ targets: this.crystal, y: this.crystal.y - 260, scaleX: 0.05, scaleY: 0.4, alpha: 0, duration: 1200, ease: "Quad.in" });
      for (let i = 0; i < 4; i++) this.time.delayedCall(i * 220, () => {
        this.sparks.setParticleTint(0xfff3b0);
        this.sparks.explode(18, cx, cy - 120 - i * 120);
      });
    });
    this.time.delayedCall(3500, () => {
      this.tweens.add({ targets: [beam, halo], alpha: 0, duration: 600, onComplete: () => {
        beam.destroy();
        halo.destroy();
      } });
    });
    this.time.delayedCall(4200, () => {
      this.tweens.add({ targets: storm, alpha: 0, duration: 600, onComplete: () => storm.destroy() });
      this.tweens.add({ targets: this.gloom, fillAlpha: 0.18, duration: 800 });
      this.crystal.setVisible(false).clearTint().setAlpha(1);
      cam.pan(this.hero.x, this.hero.y - 100, 700, "Sine.easeInOut");
      cam.zoomTo(ZOOM, 700, "Sine.easeInOut");
    });
    this.time.delayedCall(5000, () => {
      cam.startFollow(this.hero, true, 0.14, 0.14);
      this.dropBoss();
    });
  }

  /** The boss falls out of the sky next to you: thud, dust, title card, boss music. */
  private dropBoss(): void {
    const [x, y] = this.randomSpot(550, 700, [this.hero.x, this.hero.y]);
    const def = bossForStage(save.stage);
    const faller = this.add.image(x, y - 1400, def.tex).setOrigin(0.5, 0.94).setScale(1.3).setDepth(y);
    const shadow = this.add.ellipse(x, y, 60, 22, 0x000000, 0.3).setDepth(y - 1);
    this.tweens.add({ targets: shadow, scaleX: 3.5, scaleY: 3.5, duration: 500, ease: "Quad.in" });
    this.tweens.add({
      targets: faller, y, duration: 500, ease: "Quad.in",
      onComplete: () => {
        faller.destroy();
        shadow.destroy();
        this.cameras.main.shake(600, 0.02);
        buzz(250);
        this.boom(x, y - 60, 3);
        this.puff.setParticleTint(0xd8c8a8);
        this.puff.explode(40, x, y);
        const boss = this.addEnemy({ tex: def.tex, stats: BOSS, fx: def.color, boss: true, moves: def.moves, special: def.special }, x, y);
        // Battle bosses are twice as tough as in Boss Rush
        boss.hp = boss.maxHp = Math.round(monsterHp(BOSS.hp, save.stage, MINUTES) * HEALING_BOSS_HP * BATTLE_BOSS_MULT);
        boss.huntHero = true;
        boss.phaseT = 2500;
        // the village's boss comes after a minute or two, not after a full 5:00 of levelling up
        if (this.story && this.stageMode === "hunt") {
          boss.hp = boss.maxHp = Math.round(monsterHp(BOSS.hp, save.stage, Math.max(1, this.minute)) * HEALING_BOSS_HP * 0.8);
          boss.dmg *= 0.4;
        }
        if (this.beast?.friend && !this.story) {
          boss.hp = boss.maxHp = Math.round(boss.maxHp * FRIEND_BOSS_HP);
          this.toast("Your beast is with you, so the boss is extra strong!", "#ffd29a");
        }
        this.bigBoss = boss;
        if (this.stageMode === "boss") this.bossKids(boss, x, y);
        // the story's big boss is the chapter's whole fight (with everything maxed out): it lasts
        if (this.story && this.stageMode === "boss") {
          boss.hp = boss.maxHp = Math.round(boss.maxHp * BIG_STORY_BOSS);
          for (const e of this.enemies) if (e.type.boss) e.dmg *= 0.35;
        }
        // the beast's stage: its boss hits softer too (you are still new)
        if (this.story && this.stageMode === "feed") boss.dmg *= 0.5;
        // story bosses don't heal (no seals to find in the dark)
        else if (!this.story) this.placeSeals();
        music.play("boss");
        if (this.story && this.stageMode === "boss") this.time.delayedCall(2400, () => this.toast(`Beat ${def.name} in ${mmss(this.story!.limit)}! The kids run when it falls`, "#ffd0d0"));
        this.game.events.emit("boss-intro", { name: this.stageMode === "boss" ? `${def.name} & ${BOSS_KIDS} kids` : def.name, tex: def.tex, moves: [`${BOSS_SPECIALS[def.special]}!`, ...def.moves.map((m) => BOSS_MOVES[m])] });
        this.time.delayedCall(1800, () => {
          if (this.state !== "cutscene") return;
          this.state = "boss";
          this.banner("FIGHT!", "red", 700);
        });
      },
    });
  }

  private stageWon(): void {
    this.state = "won";
    for (const sl of this.seals) this.tweens.add({ targets: [sl.img, sl.glow], alpha: 0, duration: 600 });
    battle.mode = "over";
    this.joy = { ...NO_JOY };
    // everything left runs away in a puff
    for (const e of [...this.enemies]) this.kill(e, true);
    const gems = gemsPerBoss();
    save.gems += gems;
    for (let i = 0; i < 5; i++) this.addDice(rollDiceTier(save.stage + 15), 1);
    const cleared = save.stage;
    // cleared for the first time (the story opens things then)
    const first = !this.eventRun && save.bestStage <= cleared;
    if (this.eventRun) {
      // the event: Rain Drops for every dodge plus a bonus for surviving; your stage stays where it was
      save.diceWins++;
      this.bankRain(RAIN_WIN_DROPS);
    } else if (save.stage < MAX_STAGE) save.stage++;
    save.bestStage = Math.max(save.bestStage, save.stage);
    persist();
    this.time.timeScale = 0.35 * battle.speed;
    this.tweens.timeScale = 0.35 * battle.speed;
    window.setTimeout(() => {
      this.time.timeScale = battle.speed;
      this.tweens.timeScale = battle.speed;
    }, 900);
    battle.left = -1;
    battle.limit = 0;
    // the story: the night lifts a little; after the big boss your beast goes home
    if (this.night && this.stageMode !== "path") this.night.want = this.night.dark * 0.6;
    if (this.story && this.stageMode === "boss") this.beastLeaves();
    music.play("calm");
    // the crystal floats back down from the sky
    const [hx, hy] = this.crystalHome;
    this.clearBossAttacks();
    this.tweens.add({ targets: this.gloom, fillAlpha: 0, duration: 1500 });
    if (this.stageMode === "crystal") this.crystal.setVisible(true).setScale(1).setAlpha(1).clearTint().setPosition(hx, hy - 1600).setDepth(hy);
    this.tweens.add({ targets: this.crystal, y: hy, duration: 1600, delay: 600, ease: "Bounce.out" });
    if (this.stageMode === "crystal") this.time.delayedCall(2300, () => {
      this.crystalSparkle.start();
      this.tweens.add({ targets: this.crystalGlow, alpha: 0.8, duration: 500 });
      this.sparks.setParticleTint(this.land.crystal);
      this.sparks.explode(40, hx, hy - 120);
    });
    battle.bossFight = false;
    this.game.events.emit("stage-clear", { event: this.eventRun, stage: cleared, earned: this.stats.earned, gems, dice: this.stats.dice, final: cleared === MAX_STAGE, first });
    this.game.events.emit("stage-up");
    this.time.delayedCall(4800, () => {
      this.cameras.main.fadeOut(600, 74, 47, 29);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.restart({}));
    });
  }

  /** Puts this event fight's Rain Drops (and a bonus) on the event track. */
  private bankRain(bonus: number): void {
    const n = this.rain.drops + bonus;
    this.rain.drops = 0;
    if (n <= 0) return;
    save.rain.drops += n;
    persist();
    this.game.events.emit("rain-drops", n);
  }

  private stageLost(reason: StageResult["reason"]): void {
    if (this.rush) {
      this.rushOver(reason === "quit" ? "quit" : "hero");
      return;
    }
    if (!this.fighting && this.state !== "intro" && this.state !== "cutscene") return;
    if (this.state === "fight" || this.state === "boss") this.reviveState = this.state;
    this.state = "lost";
    battle.mode = "over";
    this.joy = { ...NO_JOY };
    // the Rain Drops you earned are yours even if you fall
    if (this.eventRun) this.bankRain(0);
    sfx.error();
    buzz(300);
    music.play("calm");
    if (reason === "hero") {
      this.cameras.main.shake(500, 0.012);
      this.hero.setTint(0x8a8a8a);
      this.tweens.add({ targets: this.hero, angle: this.hero.flipX ? -90 : 90, duration: 400, ease: "Bounce.out" });
    } else if (reason === "crystal") {
      this.cameras.main.shake(500, 0.012);
      this.crystal.setTint(0x6a6a6a);
      this.boom(this.crystal.x, this.crystal.y - 100, 2.5);
    }
    battle.left = -1;
    const title = { hero: "YOU FELL!", crystal: "CRYSTAL BROKE!", quit: "YOU GAVE UP", time: "TIME'S UP!", beast: "THE BEAST ESCAPED!" }[reason];
    this.banner(title, "red", 1100);
    this.time.delayedCall(reason === "quit" ? 300 : 1300, () => {
      const result: StageResult = {
        stage: save.stage, reason, time: this.elapsed, stats: this.stats, canRevive: false, reviveGems: REVIVE_GEMS,
      };
      this.game.events.emit("stage-failed", result);
    });
  }

  private giveUp(): void {
    this.stageLost("quit");
  }

  /**
   * Spend gems to get back up once per stage (or a free Second Chance): full health and a
   * blast that clears the area.
   */
  private revive(free = false): void {
    if (this.state !== "lost") return;
    if (!free) {
      if (this.revived || save.gems < REVIVE_GEMS) return;
      save.gems -= REVIVE_GEMS;
      persist();
      this.revived = true;
    }
    this.state = this.reviveState;
    battle.mode = "run";
    this.heroHp = this.heroMax;
    this.crystalHp = Math.max(this.crystalHp, this.crystalMax * 0.5);
    this.hero.clearTint().setAngle(0);
    this.pets.forEach((p) => (p.down > 0 ? this.petUp(p) : (p.hp = p.maxHp)));
    this.crystal.clearTint();
    this.frozenUntil = this.time.now + 2500;
    music.play(this.state === "boss" ? "boss" : "battle");
    sfx.fanfare();
    this.cameras.main.flash(300, 255, 255, 220);
    for (const e of [...this.enemies]) {
      if (Math.hypot(e.img.x - this.hero.x, e.img.y - this.hero.y) < 1200 && !e.type.boss) this.hit(e, e.maxHp * 10);
    }
    if (!free) this.banner("REVIVED!", "green", 900);
  }

  private retry(start: boolean): void {
    this.cameras.main.fadeOut(400, 74, 47, 29);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.restart({ autostart: start, event: start && this.eventRun }));
  }

  // ───────────────────────── loop ─────────────────────────

  update(time: number, delta: number): void {
    if (battle.choosing) return;
    // developer x3: everything in the fight runs three times as fast
    if (battle.speed !== this.speedNow) {
      this.speedNow = battle.speed;
      this.time.timeScale = battle.speed;
      this.tweens.timeScale = battle.speed;
    }
    delta *= this.speedNow;
    this.followOffset();
    this.trackStats(delta);
    this.tick(delta);
    this.moveHero(time, delta);
    this.movePets(time, delta);
    this.updatePickups(delta);
    this.updateFood(delta);
    this.spawn(delta);
    const fighting = this.fighting;
    if (fighting) {
      // you slowly heal between hits; the crystal never heals by itself
      if (time - this.hurtAt > 3000) this.heroHp = Math.min(this.heroMax, this.heroHp + this.heroMax * 0.01 * (delta / 1000));
    }
    battle.hp = this.heroHp / this.heroMax;
    battle.crystal = this.crystalHp / this.crystalMax;
    const bosses = this.enemies.filter((e) => e.type.boss);
    battle.bossFrac = bosses.length ? bosses.reduce((t, e) => t + Math.max(0, e.hp), 0) / bosses.reduce((t, e) => t + e.maxHp, 0) : -1;
    if (!this.rush && this.state !== "lobby") this.modeTick(delta);

    if (this.streakTimer > 0) {
      this.streakTimer -= delta;
      if (this.streakTimer <= 0) {
        if (this.streak >= 50) this.toast(`Streak over: ${this.streak} kills`, "#ffd0a0");
        this.streak = battle.streak = 0;
        this.streakText.setVisible(false);
      }
    }
    this.streakText.setPosition(this.hero.x, this.hero.y - 260);

    this.moveEnemies(time, delta);
    if (this.state === "boss" && !this.rush && this.stageMode !== "boss") this.sealsTick(delta);
    if (this.state === "lobby" && !this.rush) this.roamTick(delta);
    if (fighting) {
      this.ghostSkills(delta);
      this.gadgetsTick(delta);
      this.petAttacks(delta);
      this.crystalShards(delta);
    }
    this.moveRocks(delta);
    this.strikesTick();
    this.lanesTick();
    this.moveBullets(delta);
    this.moveGadgets(time, delta);
    this.moveShots(delta);
    this.nightTick(delta);
    this.drawFx(time);
    this.cullTimer -= delta;
    if (this.cullTimer <= 0) {
      this.cullTimer = 200;
      this.cull();
    }
  }

  /** Enemies within `r` of a point. */
  private near(x: number, y: number, r: number): Enemy[] {
    return this.enemies.filter((e) => e.img.alpha >= 0.9 && Math.abs(e.img.x - x) < r && Math.abs(e.img.y - y) < r && Math.hypot(e.img.x - x, e.img.y - y) < r);
  }

  /**
   * While the crystal is open new monsters go for it first and only turn on you when you
   * come close; while it is shielded every monster hunts you (and keeps hunting you after
   * the shield drops). Everyone keeps a little space.
   */
  private moveEnemies(time: number, delta: number): void {
    // walk frames: legs step, arms swing, heads bob (faster for quick monsters, idle shuffle when still)
    for (const e of this.enemies) {
      const ms = e.type.boss ? 150 : e.type.flying ? 90 : 125;
      const k = walkKey(e.type.tex, time + e.seed, e.moving ? ms : ms * 2.4);
      if (e.img.texture.key !== k && e.phase !== "jump" && e.phase !== "burrow") e.img.setTexture(k);
      e.moving = false;
    }
    const frozen = time < this.frozenUntil;
    if (!frozen && this.enemies.length && this.enemies[0].img.tintTopLeft === 0x9ae6ff) this.enemies.forEach((e) => e.img.clearTint());
    const [cx, cy] = this.arena.center;
    const fighting = this.fighting;
    const G = 90;
    this.grid.clear();
    for (const e of this.enemies) {
      const k = Math.floor(e.img.x / G) * 1000 + Math.floor(e.img.y / G);
      const cell = this.grid.get(k);
      if (cell) cell.push(e);
      else this.grid.set(k, [e]);
    }
    const hurtMult = this.fortified ? 1 - 0.12 * this.lv("fort") : 1;
    for (const e of this.enemies) {
      if (e.flashUntil && time > e.flashUntil) {
        e.flashUntil = 0;
        if (frozen) e.img.setTint(0x9ae6ff);
        else e.img.clearTint();
      }
      e.aura?.setPosition(e.img.x, e.img.y - 10).setDepth(e.img.y - 1);
      e.badge?.setPosition(e.img.x, e.img.y - e.img.displayHeight * (e.type.flying ? 0.5 : 0.95) - 24).setDepth(e.img.y + 2);
      if (frozen || !fighting || this.time.now < e.stunUntil) continue;
      if (e.muts.length) this.mutantTick(e, delta);
      const heroD = Math.hypot(this.hero.x - e.img.x, this.hero.y - e.img.y);
      // raiders go back to the crystal as soon as the shield drops; everyone else hunts you once you come close
      if (e.raider && !e.type.boss) e.huntHero = this.shielded || heroD <= RAIDER_AGGRO;
      else if (this.shielded || e.type.boss || heroD <= AGGRO || this.stageMode !== "crystal") e.huntHero = true;
      e.toCrystal = !e.huntHero;
      if (!e.toCrystal) e.attacking = false;
      const tx = e.toCrystal ? cx : this.hero.x;
      const ty = e.toCrystal ? cy + 40 : this.hero.y;
      const dx = tx - e.img.x;
      const dy = ty - e.img.y;
      const d = Math.hypot(dx, dy) || 1;
      const stop = e.toCrystal ? 200 : HERO_R + e.r - 10;
      let speed = e.type.stats.speed * e.speedMult;
      if (e.type.boss) speed = this.bossMove(e, delta, dx / d, dy / d) * e.speedMult;
      if (this.rush) speed /= RUSH_SLOW;
      if (this.puddles.some((p) => Math.hypot(p.x - e.img.x, (p.y - e.img.y) * 2) < p.r)) speed *= e.type.boss ? 0.7 : 0.4;
      if (this.lv("haunt") && heroD < this.hauntR()) speed *= 0.85;
      // blinkers teleport a good way toward their target every few seconds
      if (e.muts.includes("blink") && d > stop + 220) {
        e.blinkT -= delta;
        if (e.blinkT <= 0) {
          e.blinkT = 2600 + Math.random() * 1800;
          const jump = Math.min(d - stop - 80, 360);
          this.puff.setParticleTint(0xb36aff);
          this.puff.explode(10, e.img.x, e.img.y - 40);
          e.img.setPosition(clampX(e.img.x + (dx / d) * jump), clampY(e.img.y + (dy / d) * jump));
          this.puff.explode(10, e.img.x, e.img.y - 40);
        }
      }
      if (d > stop) {
        const step = (speed * delta) / 1000;
        const [mx, my] = e.phase === "dash" ? [e.dashX, e.dashY] : [dx / d, dy / d];
        let nx = e.img.x + mx * step;
        let ny = e.img.y + my * step;
        const gx = Math.floor(e.img.x / G);
        const gy = Math.floor(e.img.y / G);
        for (let ix = gx - 1; ix <= gx + 1; ix++) {
          for (let iy = gy - 1; iy <= gy + 1; iy++) {
            for (const o of this.grid.get(ix * 1000 + iy) ?? []) {
              if (o === e) continue;
              const ox = nx - o.img.x;
              const oy = ny - o.img.y;
              const od = Math.hypot(ox, oy);
              const min = (e.r + o.r) * 0.7;
              if (od < min && od > 0.01) {
                nx += (ox / od) * (min - od) * 0.5;
                ny += (oy / od) * (min - od) * 0.5;
              }
            }
          }
        }
        e.img.setPosition(clampX(nx), clampY(ny)).setDepth(ny);
        e.moving = true;
        if (Math.abs(mx) > 0.2) e.img.setFlipX(mx < 0);
      }
      e.atkTimer -= delta;
      // touching you hurts
      const away = e.phase === "jump" || e.phase === "burrow" || e.phase === "rise";
      if (heroD < HERO_R + e.r + 10 && e.atkTimer <= 0 && !away) {
        e.atkTimer = 800;
        this.hurt(e.dmg * hurtMult);
        // vampires heal by biting
        if (e.muts.includes("vampire")) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.3);
        if (!this.fighting) return;
      }
      // ...and so does bumping into a pet
      if (e.atkTimer <= 0) {
        for (const p of this.pets) {
          if (p.down > 0 || Math.abs(p.img.x - e.img.x) > e.r + 40 || Math.abs(p.img.y - e.img.y) > e.r + 40) continue;
          e.atkTimer = 800;
          this.hurtPet(p, e.dmg);
          break;
        }
      }
      // at the open crystal they chip away at it
      if (e.toCrystal && d <= stop + 10 && e.atkTimer <= 0) {
        e.atkTimer = 2000;
        e.attacking = true;
        this.tweens.add({ targets: e.img, x: e.img.x + (dx / d) * 24, y: e.img.y + (dy / d) * 24, duration: 90, yoyo: true });
        this.crystalHp -= e.dmg;
        this.stats.crystalHurt += e.dmg;
        this.crystal.setTintFill(0xff8a8a);
        this.time.delayedCall(80, () => this.crystal.clearTint());
        if (time - this.warnedAt > 8000) {
          this.warnedAt = time;
          this.toast("The crystal is under attack!", "#ff9a9a");
          sfx.alarm();
        }
        if (this.crystalHp <= 0) {
          this.crystalHp = 0;
          this.stageLost("crystal");
          return;
        }
      }
    }
  }

  /**
   * The boss walks at you and every few seconds does one of its three moves (see data/bosses.ts),
   * each shown before it lands: red marks for a charge, red circles for stomps, slams and falling
   * rain, a red cone for breath. Returns the boss's walking speed this frame.
   */
  private bossMove(e: Enemy, delta: number, ux: number, uy: number): number {
    e.phaseT -= delta;
    if (this.state !== "boss") return 0;
    // bosses keep up with you: running away doesn't work
    const walk = Math.max(e.type.stats.speed * 1.3, HERO_SPEED * moveSpeedMult() * 0.85);
    switch (e.phase) {
      case "walk": {
        if (e.phaseT > 0) return walk;
        const moves = e.type.moves ?? ["charge", "stomp", "rocks"];
        const dist = Math.hypot(this.hero.x - e.img.x, this.hero.y - e.img.y);
        const far = dist > 650;
        // every third move is its SPECIAL (and every move while you keep far away)
        if (e.type.special && (++e.casts % 3 === 0 || dist > 1000)) {
          this.bossSpecial(e, ux, uy);
          return 0;
        }
        // stomps and breath only reach you up close
        const ok = moves.filter((m) => !far || (m !== "stomp" && m !== "breath"));
        this.startBossMove(e, ok.length ? ok[Math.floor(Math.random() * ok.length)] : "charge", ux, uy);
        return 0;
      }
      case "windup":
        if (e.phaseT <= 0) {
          e.phase = "dash";
          e.phaseT = e.dashMs;
          this.cameras.main.shake(200, 0.006);
        }
        return 0;
      case "dash":
        // afterimages and dust behind it
        e.tickT -= delta;
        if (e.tickT <= 0) {
          e.tickT = 45;
          const ghost = this.add.image(e.img.x, e.img.y, e.img.texture.key).setOrigin(e.img.originX, e.img.originY)
            .setScale(e.img.scaleX, e.img.scaleY).setFlipX(e.img.flipX).setAngle(e.img.angle).setTintFill(e.type.fx).setAlpha(0.55).setDepth(e.img.depth - 1);
          this.tweens.add({ targets: ghost, alpha: 0, scaleX: ghost.scaleX * 0.9, duration: 320, onComplete: () => ghost.destroy() });
          this.puff.setParticleTint(0xd8c8a8);
          this.puff.explode(2, e.img.x, e.img.y);
        }
        // long slides bounce off the walls
        if (clampX(e.img.x + e.dashX * 30) !== e.img.x + e.dashX * 30) e.dashX *= -1;
        if (clampY(e.img.y + e.dashY * 30) !== e.img.y + e.dashY * 30) e.dashY *= -1;
        if (e.phaseT <= 0) {
          if (e.shots > 0) {
            // chained dashes: aim again and go
            e.shots--;
            const a = Math.atan2(this.hero.y - e.img.y, this.hero.x - e.img.x);
            [e.dashX, e.dashY] = [Math.cos(a), Math.sin(a)];
            e.phase = "windup";
            e.phaseT = e.dashWind;
            sfx.charge(2);
          } else this.bossRest(e);
        }
        return e.dashV;
      case "cast":
        if (e.phaseT <= 0) this.bossRest(e);
        return walk * 0.25;
      case "stomp":
        if (e.phaseT <= 0) {
          this.shockwave(e.img.x, e.img.y, 360, e.dmg * 1.5);
          this.bossRest(e);
        }
        return 0;
      case "throw":
        if (e.phaseT <= 0) {
          const a0 = Math.atan2(this.hero.y - 40 - (e.img.y - 100), this.hero.x - e.img.x);
          for (let k = -2; k <= 2; k++) this.bossShot(e, a0 + k * 0.22, 720, e.dmg * 0.8, "boulder");
          sfx.boom();
          this.bossRest(e);
        }
        return 0;
      case "ring":
        if (e.phaseT <= 0) {
          // a ring of shots all around; the second ring is turned half a step
          const n = 12;
          for (let k = 0; k < n; k++) this.bossShot(e, ((k + (e.shots % 2) * 0.5) / n) * Math.PI * 2, 520, e.dmg * 0.7);
          sfx.shoot(true);
          if (--e.shots > 0) e.phaseT = 520;
          else this.bossRest(e);
        }
        return 0;
      case "volley":
        if (e.phaseT <= 0) {
          this.bossShot(e, Math.atan2(this.hero.y - 40 - (e.img.y - 100), this.hero.x - e.img.x), 820, e.dmg * 0.7);
          sfx.shoot(false);
          if (--e.shots > 0) e.phaseT = 240;
          else this.bossRest(e);
        }
        return 0;
      case "summon":
        if (e.phaseT <= 0) {
          this.summonMinions(e);
          this.bossRest(e);
        }
        return 0;
      case "spin":
        if (e.phaseT <= 0) {
          this.tweens.add({ targets: e.img, angle: 0, duration: 150 });
          this.bossRest(e);
          return 0;
        }
        e.img.angle += delta * 1.1;
        return walk * 2.1;
      case "rain":
        if (e.phaseT <= 0) this.bossRest(e);
        return walk * 0.4;
      case "burrow":
        // a mound of dirt rushes at you underground
        e.tickT -= delta;
        if (e.tickT <= 0) {
          e.tickT = 90;
          this.puff.setParticleTint(0xc8a878);
          this.puff.explode(3, e.img.x, e.img.y);
        }
        if (e.phaseT <= 0) {
          e.phase = "rise";
          e.phaseT = 650;
          this.addStrike(e.img.x, e.img.y, 240, 650, e.dmg * 1.6, "sand");
        }
        return 560;
      case "rise":
        if (e.phaseT <= 0) {
          this.tweens.add({ targets: e.img, alpha: 1, duration: 120 });
          this.puff.setParticleTint(0xc8a878);
          this.puff.explode(26, e.img.x, e.img.y - 40);
          this.bossRest(e);
        }
        return 0;
      case "breath":
        // first the cone is shown, then it burns for a moment
        if (e.phaseT < 700) {
          e.tickT -= delta;
          if (e.tickT <= 0) {
            e.tickT = 160;
            // real flames (or frost) pouring out along the cone
            const a = Math.atan2(e.dashY, e.dashX);
            const [ox, oy] = [e.img.x + Math.cos(a) * 60, e.img.y - 60 + Math.sin(a) * 60];
            // fire, or frost for the icy ones
            const frost = (e.type.fx & 255) > ((e.type.fx >> 16) & 255);
            const pal = frost ? [0x6ac0ff, 0xbff0ff, 0xffffff] : [0xff4a1a, 0xff9a2a, 0xffe066];
            for (let k = 0; k < 9; k++) {
              const aa = a + (Math.random() - 0.5) * BREATH_HALF * 1.7;
              const d = 220 + Math.random() * (BREATH_LEN - 200);
              const f = this.add.image(ox, oy, orbTexture(this, pal[k % 3])).setScale(0.45).setDepth(TOP + 9050);
              this.tweens.add({ targets: f, x: ox + Math.cos(aa) * d, y: oy + Math.sin(aa) * d, scale: 1.7 + Math.random(), alpha: 0, duration: 420 + Math.random() * 160, ease: "Quad.out", onComplete: () => f.destroy() });
            }
            if (this.inCone(e)) this.hurt(e.dmg * 0.45);
          }
        }
        if (e.phaseT <= 0) this.bossRest(e);
        return 0;
    }
    // jump and blink are moved by their tweens
    return 0;
  }

  /** Starts a boss move: each one shows itself first so you can get out of the way. */
  private startBossMove(e: Enemy, move: BossMoveId, ux: number, uy: number): void {
    this.bossAlert(e, BOSS_MOVES[move]);
    const glowUp = (color: number) => {
      e.img.setTintFill(color);
      this.time.delayedCall(90, () => e.img.clearTint());
    };
    switch (move) {
      case "charge":
        e.phase = "windup";
        e.phaseT = 750;
        e.dashX = ux;
        e.dashY = uy;
        e.shots = 0;
        e.dashV = 1000;
        e.dashMs = 600;
        e.dashWind = 750;
        this.tweens.add({ targets: e.img, scaleX: e.img.scaleX * 1.12, scaleY: e.img.scaleY * 0.85, duration: 140, yoyo: true, repeat: 2 });
        break;
      case "stomp":
        e.phase = "stomp";
        e.phaseT = 950;
        this.tweens.add({ targets: e.img, scaleY: e.img.scaleY * 0.85, scaleX: e.img.scaleX * 1.12, duration: 300, yoyo: true, repeat: 1 });
        break;
      case "rocks":
        e.phase = "throw";
        e.phaseT = 550;
        this.tweens.add({ targets: e.img, angle: -12, duration: 250, yoyo: true });
        break;
      case "ring":
        e.phase = "ring";
        e.phaseT = 600;
        e.shots = 2;
        glowUp(e.type.fx);
        this.tweens.add({ targets: e.img, scaleX: e.img.scaleX * 1.1, scaleY: e.img.scaleY * 1.1, duration: 280, yoyo: true });
        break;
      case "volley":
        e.phase = "volley";
        e.phaseT = 500;
        e.shots = 5;
        glowUp(e.type.fx);
        break;
      case "summon":
        e.phase = "summon";
        e.phaseT = 900;
        this.tweens.add({ targets: e.img, angle: { from: -10, to: 10 }, duration: 110, yoyo: true, repeat: 3 });
        this.puff.setParticleTint(0xb36aff);
        this.puff.explode(20, e.img.x, e.img.y - 80);
        sfx.alarm();
        break;
      case "spin":
        e.phase = "spin";
        e.phaseT = 1800;
        sfx.charge(3);
        break;
      case "rain": {
        e.phase = "rain";
        e.phaseT = 1500;
        // one lands right on you, the rest around you
        for (let k = 0; k < 6; k++) {
          const a = Math.random() * Math.PI * 2;
          const d = k === 0 ? 0 : 120 + Math.random() * 300;
          this.addStrike(this.hero.x + Math.cos(a) * d, this.hero.y + Math.sin(a) * d * 0.7, 150, 800 + k * 120, e.dmg * 1.1, "magic", e.type.fx);
        }
        this.tweens.add({ targets: e.img, y: e.img.y - 30, duration: 200, yoyo: true });
        break;
      }
      case "jump": {
        e.phase = "jump";
        e.phaseT = 99999;
        const [sx, sy] = [e.img.x, e.img.y];
        const [tx, ty] = [clampX(this.hero.x), clampY(this.hero.y)];
        this.addStrike(tx, ty, 270, 1000, e.dmg * 1.6);
        const k = { t: 0 };
        this.tweens.add({
          targets: k, t: 1, duration: 1000, ease: "Sine.inOut",
          onUpdate: () => e.img.setPosition(sx + (tx - sx) * k.t, sy + (ty - sy) * k.t - Math.sin(k.t * Math.PI) * 520).setDepth(ty + 400),
          onComplete: () => {
            this.puff.setParticleTint(0xd8c8a8);
            this.puff.explode(24, tx, ty);
            this.bossRest(e);
          },
        });
        break;
      }
      case "blink": {
        e.phase = "blink";
        e.phaseT = 99999;
        this.puff.setParticleTint(0xb36aff);
        this.puff.explode(16, e.img.x, e.img.y - 60);
        this.tweens.add({
          targets: e.img, alpha: 0.15, duration: 250,
          onComplete: () => {
            const a = Math.random() * Math.PI * 2;
            e.img.setPosition(clampX(this.hero.x + Math.cos(a) * 300), clampY(this.hero.y + Math.sin(a) * 220));
            this.puff.explode(16, e.img.x, e.img.y - 60);
            this.tweens.add({ targets: e.img, alpha: 1, duration: 200 });
            // straight into a quick stomp
            e.phase = "stomp";
            e.phaseT = 650;
          },
        });
        break;
      }
      case "burrow":
        e.phase = "burrow";
        e.phaseT = 1400;
        e.tickT = 0;
        this.tweens.add({ targets: e.img, alpha: 0.08, duration: 250 });
        this.puff.setParticleTint(0xc8a878);
        this.puff.explode(24, e.img.x, e.img.y);
        break;
      case "breath":
        e.phase = "breath";
        e.phaseT = 1500;
        e.tickT = 0;
        e.dashX = ux;
        e.dashY = uy;
        this.tweens.add({ targets: e.img, scaleY: e.img.scaleY * 1.08, duration: 400, yoyo: true });
        break;
    }
  }

  /** Before every boss move: a big red "!" with the move's name, and the boss flashes red. */
  private bossAlert(e: Enemy, name: string): void {
    const top = e.img.y - e.img.displayHeight * 0.95 - 120;
    const bubble = this.add.container(e.img.x, top, [
      this.add.image(0, 0, "comic_burst").setScale(0.9, 0.75),
      text(this, 0, -4, "!", 92, "#ffffff", { stroke: 14 }),
      text(this, 0, 92, `${name.toUpperCase()}!`, 46, "#ffe066", { stroke: 10 }),
    ]).setDepth(TOP + 9300).setScale(0);
    this.tweens.add({ targets: bubble, scale: 1, duration: 220, ease: "Back.out" });
    this.tweens.add({ targets: bubble, y: top - 30, alpha: 0, delay: 900, duration: 300, onComplete: () => bubble.destroy() });
    // keep the bubble over the boss while it moves
    const follow = this.time.addEvent({ delay: 16, repeat: 70, callback: () => bubble.active && e.img.active && bubble.setX(e.img.x) });
    bubble.once("destroy", () => follow.remove());
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 180, () => {
      if (!e.img.active) return;
      e.img.setTintFill(0xff3a3a);
      this.time.delayedCall(90, () => e.img.active && e.img.clearTint());
    });
    sfx.charge(2);
  }

  /** Each boss move's warning as a picture: a charge lane, an aim lane, a zone, a cone, a mound or a whirl. */
  private bossTele(e: Enemy, time: number): void {
    const want = (key: string) => {
      if (!e.tele || !e.tele.active || e.tele.texture.key !== key) {
        e.tele?.destroy();
        e.tele = this.add.image(0, 0, key);
      }
      return e.tele.setVisible(true).setDepth(7).setOrigin(0.5).setRotation(0);
    };
    const blink = time % 200 < 100 ? 1 : 0.6;
    switch (e.phase) {
      case "windup": {
        const L = (e.dashV * e.dashMs) / 1000 + 100;
        want("bx_lane").setOrigin(0, 0.5).setPosition(e.img.x, e.img.y).setRotation(Math.atan2(e.dashY, e.dashX)).setDisplaySize(L, 170).setTint(0xff3a3a).setAlpha(blink);
        break;
      }
      case "throw":
      case "volley": {
        const [ox, oy] = [e.img.x, e.img.y - 100];
        const d = Math.hypot(this.hero.x - ox, this.hero.y - 40 - oy);
        want("bx_lane").setOrigin(0, 0.5).setPosition(ox, oy).setRotation(Math.atan2(this.hero.y - 40 - oy, this.hero.x - ox)).setDisplaySize(Math.min(1500, d + 80), 90).setTint(0xff5a3a).setAlpha(blink * 0.9);
        break;
      }
      case "ring": {
        const R = 450 * (1 - Math.max(0, e.phaseT) / 600) + 50;
        want("bx_warn").setPosition(e.img.x, e.img.y).setDisplaySize(R * 2, (R * 2) / 1.4).setTint(0xff3a3a).setAlpha(blink);
        break;
      }
      case "breath": {
        const firing = e.phaseT < 700;
        want("bx_cone").setOrigin(0, 0.5).setPosition(e.img.x, e.img.y - 60).setRotation(Math.atan2(e.dashY, e.dashX))
          .setDisplaySize(BREATH_LEN * 1.1, Math.tan(BREATH_HALF) * BREATH_LEN * 2).setTint(firing ? 0xffa03a : 0xff3a3a).setAlpha(firing ? 0.5 : blink * 0.85);
        break;
      }
      case "stomp": {
        const f = 1 - Math.max(0, e.phaseT) / 950;
        want("bx_warn").setPosition(e.img.x, e.img.y).setDisplaySize(720 * (0.6 + 0.4 * f), 504 * (0.6 + 0.4 * f)).setTint(0xff3a3a).setAlpha(0.55 + 0.45 * f * blink);
        break;
      }
      case "burrow":
        want("bx_mound").setOrigin(0.5, 0.7).setPosition(e.img.x, e.img.y).clearTint().setScale(1 + Math.sin(time / 60) * 0.06).setAlpha(1).setDepth(e.img.y + 1);
        break;
      case "spin":
        want("bx_whirl").setPosition(e.img.x, e.img.y - e.img.displayHeight * 0.4).setScale(e.img.displayWidth / 120).clearTint()
          .setRotation(time / 70).setAlpha(0.95).setDepth(e.img.depth + 1);
        break;
      default:
        e.tele?.setVisible(false);
    }
  }

  /** Is the hero inside the boss's breath cone? */
  private inCone(e: Enemy): boolean {
    const dx = this.hero.x - e.img.x;
    const dy = this.hero.y - 40 - (e.img.y - 60);
    const d = Math.hypot(dx, dy);
    if (d > BREATH_LEN) return false;
    const diff = Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - Math.atan2(e.dashY, e.dashX));
    return Math.abs(diff) < BREATH_HALF;
  }

  /** A stomp: dust, rocks bursting up around it, and it hurts you and your pets inside. */
  private shockwave(x: number, y: number, r: number, dmg: number): void {
    this.impact(x, y, r, "dust", 0xff4a3a);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      this.impact(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.5, 70, "rock", 0xff7a3a);
    }
    this.boom(x, y - 30, (r / 360) * 1.6);
    this.cameras.main.shake(350, 0.014);
    if (dmg > 0) this.areaHit(x, y, r, dmg);
  }

  /** A danger zone on the ground that fills up, then hits in its own way (`style`). */
  private addStrike(x: number, y: number, r: number, ms: number, dmg: number, style: StrikeStyle = "slam", orb?: number): void {
    if (!this.bossUp()) return;
    const [sx, sy] = [clampX(x), clampY(y)];
    const look = STRIKE_LOOK[style];
    // the zone is always a bright warning colour; `orb` colours what falls on it
    const col = look.color;
    const k = r / 124;
    const warn = this.add.image(0, 0, "bx_warn").setTint(col);
    const dash = this.add.image(0, 0, "bx_dash").setTint(lighten(col, 0.6)).setAlpha(0.9);
    const fill = this.add.image(0, 0, "bx_fill").setTint(col).setScale(0).setAlpha(0.35);
    const zone = this.add.container(sx, sy, [warn, fill, dash]).setScale(k * 0.6, (k / 1.4) * 0.6).setDepth(6).setAlpha(0);
    this.tweens.add({ targets: zone, scaleX: k, scaleY: k / 1.4, alpha: 1, duration: 180, ease: "Back.out" });
    this.tweens.add({ targets: dash, angle: 360, duration: 2400, repeat: -1 });
    this.tweens.add({ targets: fill, scale: 1, alpha: 0.75, duration: ms, ease: "Quad.in" });
    this.tweens.add({ targets: warn, alpha: 0.55, duration: 160, yoyo: true, repeat: -1 });
    const objs: Phaser.GameObjects.GameObject[] = [zone];
    // something falls out of the sky onto it (with its shadow growing)
    const fallTex = look.fall === "orb" ? orbTexture(this, orb ?? col) : look.fall;
    if (fallTex) {
      const shadow = this.add.ellipse(sx, sy, r * 0.9, r * 0.36, 0x000000, 0.35).setScale(0.2).setDepth(7);
      const img = this.add.image(sx, sy - 1500, fallTex).setScale(look.fall === "orb" ? 1.6 : 1.3).setDepth(sy + 5);
      if (look.fall === "bp_icicle") img.setScale(1.2);
      else img.setAngle(Phaser.Math.Between(-30, 30));
      this.tweens.add({ targets: shadow, scale: 1, duration: ms, ease: "Quad.in" });
      this.tweens.add({ targets: img, y: sy - 30, duration: ms, ease: "Quad.in" });
      objs.push(shadow, img);
    }
    this.strikes.push({ x: sx, y: sy, r, at: this.time.now + ms, ms, dmg, style, color: col, objs });
  }

  private strikesTick(): void {
    const now = this.time.now;
    this.strikes = this.strikes.filter((s) => {
      if (now < s.at) return true;
      s.objs.forEach((o) => o.destroy());
      this.impact(s.x, s.y, s.r, STRIKE_LOOK[s.style].impact, s.color);
      if (this.fighting) this.areaHit(s.x, s.y, s.r, s.dmg);
      return false;
    });
  }

  /** What a hit looks like where it lands. */
  private impact(x: number, y: number, r: number, kind: ImpactKind, color: number): void {
    const k = r / 124;
    const scorch = (a = 0.9) => {
      const sc = this.add.image(x, y, "bx_scorch").setScale(k * 1.1).setAlpha(a).setDepth(2);
      this.tweens.add({ targets: sc, alpha: 0, delay: 1400, duration: 900, onComplete: () => sc.destroy() });
    };
    const ring = (tint: number, grow = 2.1) => {
      const w = this.add.image(x, y, "bx_shock").setTint(tint).setScale(k * 0.5, (k / 1.4) * 0.5).setDepth(8);
      this.tweens.add({ targets: w, scaleX: k * grow, scaleY: (k / 1.4) * grow, alpha: 0, duration: 420, ease: "Quad.out", onComplete: () => w.destroy() });
    };
    const spikes = (tex: string, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = n === 1 ? 0 : (i / n) * Math.PI * 2;
        const d = n === 1 ? 0 : r * 0.55;
        const [px, py] = [x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7];
        const sp = this.add.image(px, py, tex).setOrigin(0.5, 0.94).setScale(k * (n === 1 ? 1.1 : 0.6), 0).setDepth(py + 2);
        this.tweens.add({ targets: sp, scaleY: k * (n === 1 ? 1.1 : 0.6), duration: 120, delay: i * 25, ease: "Back.out" });
        this.tweens.add({ targets: sp, scaleY: 0, alpha: 0, delay: 650, duration: 300, ease: "Quad.in", onComplete: () => sp.destroy() });
      }
    };
    switch (kind) {
      case "dust":
        ring(0xf6e6c8);
        this.puff.setParticleTint(0xd8c8a8);
        this.puff.explode(18, x, y);
        scorch(0.6);
        this.cameras.main.shake(180, 0.008);
        break;
      case "splat": {
        const sp = this.add.image(x, y, "bx_splat").setTint(color).setScale(k * 0.3).setDepth(3);
        this.tweens.add({ targets: sp, scale: k * 1.15, duration: 160, ease: "Back.out" });
        this.tweens.add({ targets: sp, alpha: 0, delay: 1500, duration: 700, onComplete: () => sp.destroy() });
        ring(lighten(color, 0.4), 1.6);
        this.puff.setParticleTint(color);
        this.puff.explode(16, x, y - 20);
        sfx.boom();
        break;
      }
      case "bolt": {
        const b = this.add.image(x, y, "bx_bolt").setOrigin(0.5, 1).setScale(Phaser.Math.FloatBetween(0.9, 1.2) * (Math.random() < 0.5 ? -1 : 1), 1.6).setDepth(TOP + 9100).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: b, alpha: 0.2, duration: 50, yoyo: true, repeat: 2, onComplete: () => this.tweens.add({ targets: b, alpha: 0, duration: 160, onComplete: () => b.destroy() }) });
        const flash = this.add.image(x, y - 40, "glow").setTint(0xfff3a0).setScale(k * 3.2).setDepth(TOP + 9099).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: flash, alpha: 0, scale: k * 4, duration: 380, onComplete: () => flash.destroy() });
        this.sparks.setParticleTint(0xffe066);
        this.sparks.explode(20, x, y - 30);
        ring(0xfff3a0, 1.8);
        scorch();
        sfx.boom();
        this.cameras.main.shake(160, 0.009);
        break;
      }
      case "blast": {
        const bl = this.add.image(x, y - 40, "bx_blast").setScale(k * 0.3).setAngle(Phaser.Math.Between(0, 360)).setDepth(TOP + 9050);
        this.tweens.add({ targets: bl, scale: k * 1.35, duration: 150, ease: "Quad.out" });
        this.tweens.add({ targets: bl, alpha: 0, angle: bl.angle + 40, delay: 140, duration: 300, onComplete: () => bl.destroy() });
        this.sparks.setParticleTint(color);
        this.sparks.explode(22, x, y - 40);
        this.puff.setParticleTint(0x6a5a4a);
        this.puff.explode(12, x, y - 20);
        ring(0xffd23f, 1.9);
        scorch();
        sfx.boom();
        this.cameras.main.shake(220, 0.012);
        break;
      }
      case "ice":
        spikes("bx_spike_ice", 1);
        spikes("bx_spike_ice", 5);
        this.sparks.setParticleTint(0xd8f6ff);
        this.sparks.explode(22, x, y - 40);
        ring(0xbff0ff, 1.7);
        sfx.boom();
        this.cameras.main.shake(150, 0.007);
        break;
      case "rock":
      case "root":
        spikes(kind === "rock" ? "bx_spike_rock" : "bx_spike_root", 1);
        this.puff.setParticleTint(kind === "rock" ? 0xc8b8a0 : 0x8a6a3a);
        this.puff.explode(14, x, y);
        ring(kind === "rock" ? 0xf0dcc0 : 0xb8e08a, 1.5);
        this.cameras.main.shake(120, 0.006);
        break;
    }
  }

  /** Damage to you and your pets inside an area (squashed like the ground). */
  private areaHit(x: number, y: number, r: number, dmg: number): void {
    for (const p of this.pets) if (Math.hypot(p.img.x - x, (p.img.y - y) * 1.4) < r) this.hurtPet(p, dmg);
    if (Math.hypot(this.hero.x - x, (this.hero.y - y) * 1.4) < r) this.hurt(dmg);
  }

  /** Make a stage boss's walk frames in the background (one frame every few hundred ms). */
  private prepareBoss(stage: number): void {
    const key = bossForStage(Math.min(MAX_STAGE, Math.max(1, stage))).tex;
    for (let i = 0; i < 3; i++) this.time.delayedCall(1200 + i * 600, () => bossFrame(this, key, i));
  }

  /** The boss calls a few monsters of this land around it. */
  private summonMinions(e: Enemy): void {
    const stage = this.rush ? battle.rushBoss : save.stage;
    const n = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const [x, y] = [clampX(e.img.x + Math.cos(a) * 220), clampY(e.img.y + Math.sin(a) * 160)];
      this.puff.setParticleTint(0xb36aff);
      this.puff.explode(10, x, y - 30);
      const m = this.addEnemy(this.types().a, x, y, false, false, 1, stage);
      m.huntHero = true;
    }
  }

  private bossRest(e: Enemy): void {
    e.phase = "walk";
    e.phaseT = 1100 + Math.random() * 900;
  }

  // ───────────────────────── boss specials ─────────────────────────

  /**
   * The boss's own SPECIAL: it reaches you anywhere on the map, shows its danger first (red marks,
   * lanes or aim lines), and then you have to dodge. While it plays the boss stands and casts.
   */
  private bossSpecial(e: Enemy, ux: number, uy: number): void {
    const sp = e.type.special!;
    this.bossAlert(e, BOSS_SPECIALS[sp]);
    this.banner(`${BOSS_SPECIALS[sp].toUpperCase()}!`, "red", 700);
    const D = e.dmg;
    const fx = e.type.fx;
    const [hx, hy] = [this.hero.x, this.hero.y];
    const [bx, by] = [e.img.x, e.img.y];
    const toHero = Math.atan2(hy - by, hx - bx);
    // keeps going only while the fight and the boss are still on
    const later = (ms: number, fn: () => void) => this.time.delayedCall(ms, () => this.fighting && e.hp > 0 && e.img.active && fn());
    const lead = (s: number): [number, number] => [this.hero.x + this.heroVel[0] * s, this.hero.y + this.heroVel[1] * s];
    const cast = (ms: number) => {
      e.phase = "cast";
      e.phaseT = ms;
      e.img.setTintFill(fx);
      this.time.delayedCall(120, () => e.img.active && e.img.clearTint());
    };
    const dash = (n: number, v: number, ms: number, wind: number) => {
      e.phase = "windup";
      e.phaseT = wind;
      e.shots = n - 1;
      e.dashV = v;
      e.dashMs = ms;
      e.dashWind = wind;
      e.dashX = ux;
      e.dashY = uy;
    };
    switch (sp) {
      case "goo":
        // three waves of goo in a 3x3 square on you, one gap each time
        cast(3200);
        for (let w = 0; w < 3; w++) later(w * 1000, () => {
          const [cx, cy] = [this.hero.x, this.hero.y];
          const gap = Math.floor(Math.random() * 9);
          for (let i = 0; i < 9; i++) if (i !== gap) this.addStrike(cx + ((i % 3) - 1) * 250, cy + (Math.floor(i / 3) - 1) * 180, 135, 1000, D * 1.3, "goo");
        });
        break;
      case "spores":
        // four turning rings of spores that fly across the whole map
        cast(2400);
        for (let w = 0; w < 4; w++) later(w * 500, () => {
          for (let k = 0; k < 18; k++) this.hazardShot(e.img.x, e.img.y - 100, ((k + w * 0.5) / 18) * Math.PI * 2, 460, D * 0.9, { tex: "bp_spore", r: 48, spin: 3, life: 7000 });
          sfx.shoot(true);
        });
        break;
      case "bats":
        // bats that follow you: turn hard to shake them
        cast(1800);
        for (let k = 0; k < 7; k++) later(k * 150, () => {
          this.hazardShot(e.img.x, e.img.y - 120, toHero + (k - 3) * 0.35, 430, D * 0.9, { tex: "bp_bat0", frames: ["bp_bat0", "bp_bat1"], r: 50, home: 1.5, spin: 0, life: 5500 });
          sfx.shoot(false);
        });
        break;
      case "quake":
        // three cracks race out of the ground toward you
        cast(2600);
        for (const da of [-0.4, 0, 0.4]) {
          for (let s = 1; s <= 14; s++) this.addStrike(bx + Math.cos(toHero + da) * s * 170, by + Math.sin(toHero + da) * s * 170 * 0.75, 115, 600 + s * 90, D * 1.2, "rock");
        }
        break;
      case "crows":
        // crows dive at you from every side, twice
        cast(2600);
        for (let w = 0; w < 2; w++) later(w * 1100, () => {
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + w * 0.4;
            const [sx, sy] = [this.hero.x + Math.cos(a) * 1000, this.hero.y + Math.sin(a) * 750];
            this.hazardShot(sx, sy, Math.atan2(this.hero.y - 40 - sy, this.hero.x - sx), 1100, D, { tex: "bp_crow", face: true, r: 55, wait: 800, life: 2600 });
          }
        });
        break;
      case "thunder":
        // lightning keeps landing where you are: don't stop moving
        cast(3000);
        for (let k = 0; k < 7; k++) later(k * 380, () => {
          const [x, y] = lead(0.3);
          this.addStrike(x, y, 150, 700, D * 1.3, "thunder");
        });
        break;
      case "hay": {
        // rows of hay bales roll across: find the empty row
        cast(3200);
        const wave = (dir: number) => {
          const gap = Math.floor(Math.random() * 7) - 3;
          for (let k = -3; k <= 3; k++) {
            if (k === gap) continue;
            const [sx, sy] = [this.hero.x - dir * 950, this.hero.y + k * 200];
            this.hazardShot(sx, sy, dir > 0 ? 0 : Math.PI, 950, D * 1.2, { tex: "bp_hay", scale: 1.6, r: 100, wait: 900, spin: 8 * dir, life: 3200 });
          }
        };
        wave(1);
        later(1400, () => wave(-1));
        break;
      }
      case "pumpkins":
        // pumpkins lobbed to where you are going
        cast(2600);
        for (let k = 0; k < 6; k++) later(k * 300, () => {
          const [x, y] = lead(0.9);
          this.addStrike(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 90, 175, 1100, D * 1.4, "pumpkin");
        });
        break;
      case "toxic": {
        // a poison ring closes around you; get out through the gap before the middle blows
        cast(2600);
        const gap = Math.floor(Math.random() * 12);
        for (let k = 0; k < 12; k++) {
          if (k === gap || k === (gap + 1) % 12) continue;
          const a = (k / 12) * Math.PI * 2;
          this.addStrike(hx + Math.cos(a) * 360, hy + Math.sin(a) * 260, 120, 1300, D * 1.2, "toxic");
        }
        this.addStrike(hx, hy, 250, 1900, D * 1.6, "toxic");
        break;
      }
      case "pounce":
        // four fast pounces, each one aimed again
        dash(4, 1600, 450, 400);
        break;
      case "boulders":
        // huge boulders that bounce off the walls
        cast(2400);
        for (let k = 0; k < 3; k++) later(k * 400, () => {
          const [x, y] = lead(0.6);
          this.hazardShot(e.img.x, e.img.y - 60, Math.atan2(y - e.img.y, x - e.img.x), 760, D * 1.4, { tex: "bp_boulder", scale: 1.5, r: 105, wait: 500, bounce: true, spin: 5, life: 6000 });
        });
        break;
      case "roots": {
        // rings of roots burst out of the ground one after another; each ring has a gap
        cast(3000);
        for (let j = 1; j <= 5; j++) {
          const R = j * 300;
          const n = Math.round((Math.PI * 2 * R) / 230);
          const gap = Math.floor(Math.random() * n);
          for (let k = 0; k < n; k++) {
            if (Math.abs(k - gap) <= 1 || Math.abs(k - gap) >= n - 1) continue;
            const a = (k / n) * Math.PI * 2;
            this.addStrike(bx + Math.cos(a) * R, by + Math.sin(a) * R * 0.75, 120, 700 + j * 350, D * 1.2, "root");
          }
        }
        break;
      }
      case "curse":
        // a cross of curse beams through you, then an X
        cast(2600);
        this.addLane(hx - 1600, hy, hx + 1600, hy, 170, 1000, D * 1.4, 0xc04aff);
        this.addLane(hx, hy - 1300, hx, hy + 1300, 170, 1000, D * 1.4, 0xc04aff);
        later(1100, () => {
          const [x, y] = [this.hero.x, this.hero.y];
          this.addLane(x - 1100, y - 1100, x + 1100, y + 1100, 170, 900, D * 1.4, 0xc04aff);
          this.addLane(x - 1100, y + 1100, x + 1100, y - 1100, 170, 900, D * 1.4, 0xc04aff);
        });
        break;
      case "quicksand":
        // the ground opens under you three times and throws sand all around
        cast(3400);
        for (let k = 0; k < 3; k++) later(k * 850, () => {
          const [x, y] = [this.hero.x, this.hero.y];
          this.addStrike(x, y, 210, 800, D * 1.4, "sand");
          later(800, () => {
            for (let i = 0; i < 10; i++) this.hazardShot(x, y - 40, (i / 10) * Math.PI * 2 + k, 600, D * 0.8, { tex: "bp_sand", r: 45, life: 1700 });
          });
        });
        break;
      case "needles": {
        // a spinning spiral of needles: slip between the arms
        cast(3300);
        let a = toHero;
        this.time.addEvent({
          delay: 90, repeat: 33, callback: () => {
            if (!this.fighting || e.hp <= 0) return;
            for (let arm = 0; arm < 3; arm++) this.hazardShot(e.img.x, e.img.y - 100, a + (arm * Math.PI * 2) / 3, 500, D * 0.7, { tex: "bp_thorn", scale: 1.9, face: true, r: 40, life: 6000 });
            a += 0.27;
          },
        });
        break;
      }
      case "snipe":
        // the tail locks on (a red line), then fires very fast
        cast(3000);
        for (let k = 0; k < 4; k++) later(k * 650, () => {
          this.hazardShot(e.img.x, e.img.y - 120, Math.atan2(this.hero.y - 40 - (e.img.y - 120), this.hero.x - e.img.x), 2000, D * 1.3, { tex: "bp_sting", scale: 1.5, face: true, glow: 0xffb03b, r: 50, wait: 750, track: true, life: 1600 });
        });
        break;
      case "slide":
        // three long belly slides that bounce off the walls
        dash(3, 1400, 900, 600);
        break;
      case "icegrid": {
        // a checkerboard of icicles, then the other half
        cast(2600);
        const [cx, cy] = [hx, hy];
        for (const [parity, ms] of [[0, 1000], [1, 1900]] as const) {
          for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
            if ((((i + j) % 2) + 2) % 2 !== parity) continue;
            this.addStrike(cx + i * 240, cy + j * 172, 125, ms, D * 1.3, "ice");
          }
        }
        break;
      }
      case "avalanche": {
        // rows of snowballs roll down from above; find the gap
        cast(3000);
        const wave = () => {
          const gap = Math.floor(Math.random() * 8) - 4;
          for (let k = -4; k <= 4; k++) {
            if (k === gap || k === gap + 1) continue;
            this.hazardShot(this.hero.x + k * 210, this.hero.y - 1200, Math.PI / 2, 1000, D * 1.2, { tex: "bp_snow", scale: 1.7, r: 95, wait: 800, spin: 7, life: 3000 });
          }
        };
        wave();
        later(1300, wave);
        break;
      }
      case "nova":
        // a frost beam sweeps all the way around, then icicles fall on you
        cast(3400);
        for (let i = 0; i < 18; i++) {
          const a = toHero - 0.9 + i * 0.35;
          this.addLane(bx, by - 40, bx + Math.cos(a) * 1700, by - 40 + Math.sin(a) * 1700 * 0.75, 150, 800 + i * 110, D * 1.3, 0x8fd8ff);
        }
        later(1500, () => {
          for (let k = 0; k < 5; k++) {
            const a = Math.random() * Math.PI * 2;
            const d = k === 0 ? 0 : 160 + Math.random() * 220;
            this.addStrike(this.hero.x + Math.cos(a) * d, this.hero.y + Math.sin(a) * d * 0.7, 140, 900, D * 1.2, "ice");
          }
        });
        break;
    }
  }

  /** A shot that can wait (showing its aim lane), follow you, bounce off walls, face where it flies, or glow. */
  private hazardShot(
    x: number, y: number, a: number, speed: number, dmg: number,
    o: { tex?: string; tint?: number; scale?: number; r?: number; home?: number; wait?: number; track?: boolean; bounce?: boolean; life?: number; face?: boolean; spin?: number; frames?: string[]; glow?: number } = {},
  ): void {
    if (!this.bossUp()) return;
    const tex = o.tex ?? "b_orb";
    const img = this.add.image(x, y, tex).setScale(o.scale ?? 1).setDepth(TOP + 9000);
    if (o.tint !== undefined) img.setTint(o.tint);
    if (o.face) img.setRotation(a);
    const rock: Rock = {
      img, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: o.life ?? 2600, dmg,
      r: o.r, home: o.home, wait: o.wait, track: o.track, bounce: o.bounce, speed, face: o.face, spin: o.spin ?? (o.face ? 0 : 6), frames: o.frames,
    };
    if (o.glow !== undefined) rock.glow = this.add.image(x, y, "glow").setTint(o.glow).setScale((o.r ?? 60) / 70).setAlpha(0.7).setDepth(TOP + 8999).setBlendMode(Phaser.BlendModes.ADD);
    if (o.wait) {
      img.setAlpha(0.75).setScale(img.scale * 0.6);
      this.tweens.add({ targets: img, scale: o.scale ?? 1, alpha: 1, duration: o.wait, ease: "Back.out" });
      const L = Math.min(2400, speed * 1.6);
      rock.aim = this.add.image(x, y, "bx_lane").setOrigin(0, 0.5).setTint(0xff3a3a).setDisplaySize(L, (o.r ?? 60) * 1.6).setRotation(a).setAlpha(0).setDepth(7);
      this.tweens.add({ targets: rock.aim, alpha: 0.85, duration: 200 });
    }
    this.rocks.push(rock);
  }

  /** A shot from the boss: a glowing orb in its colour, or a thrown boulder. */
  private bossShot(e: Enemy, a: number, speed: number, dmg: number, tex?: string): void {
    if (tex === "boulder") this.hazardShot(e.img.x, e.img.y - 100, a, speed, dmg, { tex: "bp_boulder", scale: 0.6, r: 55, spin: 8 });
    else this.hazardShot(e.img.x, e.img.y - 100, a, speed, dmg, { tex: orbTexture(this, e.type.fx), scale: 1.1, glow: e.type.fx, r: 50 });
  }

  /** Only a boss that is still standing throws things (moves queued up before it fell are dropped). */
  private bossUp(): boolean {
    return this.enemies.some((o) => o.type.boss && o.hp > 0);
  }

  /** The boss is gone: every warning, beam and shot it left on the map fades away. */
  private clearBossAttacks(): void {
    const objs: Phaser.GameObjects.GameObject[] = [];
    for (const s of this.strikes) objs.push(...s.objs);
    for (const l of this.lanes) objs.push(l.obj);
    for (const r of this.rocks) objs.push(...[r.img, r.glow, r.aim].filter((o): o is Phaser.GameObjects.Image => !!o));
    this.strikes = [];
    this.lanes = [];
    this.rocks = [];
    for (const o of objs) {
      this.tweens.killTweensOf(o);
      if (o instanceof Phaser.GameObjects.Container) this.tweens.killTweensOf(o.list);
      this.tweens.add({ targets: o, alpha: 0, duration: 350, onComplete: () => o.destroy() });
    }
  }

  private dropRock(r: Rock): void {
    r.img.destroy();
    r.glow?.destroy();
    r.aim?.destroy();
  }

  /** A beam lane: shown first (a lane with arrows that fills up), then it fires along its whole length. */
  private addLane(x1: number, y1: number, x2: number, y2: number, w: number, ms: number, dmg: number, color = 0xffffff): void {
    if (!this.bossUp()) return;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const a = Math.atan2(y2 - y1, x2 - x1);
    const warn = this.add.image(0, 0, "bx_lane").setOrigin(0, 0.5).setTint(color).setDisplaySize(len, w);
    const fill = this.add.image(0, 0, "bx_beam").setOrigin(0, 0.5).setTint(color).setDisplaySize(len, w).setAlpha(0.6);
    const fy = fill.scaleY;
    fill.scaleY = 0;
    const lane = this.add.container(x1, y1, [warn, fill]).setRotation(a).setDepth(7).setAlpha(0);
    this.tweens.add({ targets: lane, alpha: 1, duration: 160 });
    this.tweens.add({ targets: fill, scaleY: fy, duration: ms, ease: "Quad.in" });
    this.tweens.add({ targets: warn, alpha: 0.55, duration: 150, yoyo: true, repeat: -1 });
    this.lanes.push({ x1, y1, x2, y2, w, at: this.time.now + ms, ms, dmg, color, obj: lane });
  }

  private lanesTick(): void {
    const now = this.time.now;
    this.lanes = this.lanes.filter((l) => {
      if (now < l.at) return true;
      l.obj.destroy();
      // the beam: a coloured glow with a white-hot core that flickers out
      const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
      const a = Math.atan2(l.y2 - l.y1, l.x2 - l.x1);
      const glow = this.add.image(0, 0, "bx_beam").setOrigin(0, 0.5).setTint(l.color).setDisplaySize(len, l.w * 1.5).setAlpha(0.85);
      const core = this.add.image(0, 0, "bx_beam").setOrigin(0, 0.5).setDisplaySize(len, l.w * 0.5).setAlpha(0.8);
      const beam = this.add.container(l.x1, l.y1, [glow, core]).setRotation(a).setDepth(TOP + 9200);
      this.tweens.add({ targets: beam, scaleY: 1.35, duration: 60, yoyo: true, repeat: 2 });
      this.tweens.add({ targets: beam, alpha: 0, delay: 260, duration: 260, onComplete: () => beam.destroy() });
      this.sparks.setParticleTint(l.color);
      for (let t = 0.15; t <= 1; t += 0.2) this.sparks.explode(5, l.x1 + Math.cos(a) * len * t, l.y1 + Math.sin(a) * len * t);
      this.cameras.main.shake(140, 0.006);
      if (!this.fighting) return false;
      const t = Phaser.Math.Clamp(((this.hero.x - l.x1) * (l.x2 - l.x1) + (this.hero.y - 40 - l.y1) * (l.y2 - l.y1)) / (len * len || 1), 0, 1);
      const [px, py] = [l.x1 + (l.x2 - l.x1) * t, l.y1 + (l.y2 - l.y1) * t];
      if (Math.hypot(this.hero.x - px, this.hero.y - 40 - py) < l.w / 2 + 30) this.hurt(l.dmg);
      return false;
    });
  }

  // ───────────────────────── boss seals ─────────────────────────

  /** Five seals hidden around the field: stand on one for 3 s to close it and cut the boss's healing. */
  private placeSeals(): void {
    const spots: [number, number][] = [];
    for (let tries = 0; spots.length < SEALS && tries < 300; tries++) {
      const p = this.randomSpot(700, 1900, [this.hero.x, this.hero.y]);
      if (spots.every(([x, y]) => Math.hypot(x - p[0], y - p[1]) > 650)) spots.push(p);
    }
    this.seals = spots.map(([x, y]) => {
      const glow = this.add.image(x, y - 10, "glow").setTint(0xb98aff).setScale(2.2, 1).setAlpha(0.2).setDepth(-660);
      const img = this.add.image(x, y, "seal").setDepth(-650).setAlpha(0.35).setScale(0);
      this.tweens.add({ targets: img, scale: 1, duration: 500, delay: 600, ease: "Back.out" });
      this.tweens.add({ targets: glow, scaleX: 2.6, scaleY: 1.2, duration: 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      return { x, y, img, glow, t: 0, done: false };
    });
    battle.seals = 0;
    battle.sealsTotal = this.seals.length;
    this.time.delayedCall(2400, () => this.toast(`The boss heals! Stand on the ${SEALS} hidden seals to stop it`, "#e6d4ff"));
  }

  /** Standing on seals closes them; the boss heals for every seal still open. */
  private sealsTick(delta: number): void {
    const boss = this.enemies.find((e) => e.type.boss);
    if (!boss || !this.seals.length) return;
    let open = 0;
    for (const sl of this.seals) {
      if (sl.done) continue;
      open++;
      const d = Math.hypot(sl.x - this.hero.x, (sl.y - this.hero.y) * 1.5);
      sl.img.setAlpha(d < SEAL_SEE ? 1 : 0.35);
      sl.glow.setAlpha(d < SEAL_SEE ? 0.55 : 0.2);
      const was = sl.t;
      sl.t = d < SEAL_R ? sl.t + delta : Math.max(0, sl.t - delta * 0.5);
      if (sl.t > was && Math.floor(sl.t / 500) > Math.floor(was / 500)) sfx.charge(1 + Math.floor(sl.t / 500));
      if (sl.t >= SEAL_MS) this.closeSeal(sl, boss);
    }
    if (!open || boss.hp <= 0 || boss.hp >= boss.maxHp) return;
    const perSec = boss.maxHp * BOSS_HEAL * (open / SEALS);
    boss.hp = Math.min(boss.maxHp, boss.hp + (perSec * delta) / 1000);
    this.healPopT -= delta;
    if (this.healPopT <= 0) {
      this.healPopT = 1000;
      const t = text(this, boss.img.x + (Math.random() - 0.5) * 120, boss.img.y - boss.img.displayHeight * 0.7, `+${fmt(perSec)}`, 64, "#7af08a").setDepth(TOP + 9300);
      this.tweens.add({ targets: t, y: t.y - 140, alpha: 0, duration: 900, ease: "Quad.out", onComplete: () => t.destroy() });
    }
  }

  private closeSeal(sl: Seal, boss: Enemy): void {
    sl.done = true;
    battle.seals++;
    sfx.fanfare();
    buzz(80);
    this.tweens.killTweensOf(sl.glow);
    sl.img.setTexture("seal_on").setAlpha(1);
    sl.glow.setTint(0xffe066).setAlpha(0.7);
    this.tweens.add({ targets: sl.img, scale: 1.25, duration: 160, yoyo: true });
    const beam = this.add.rectangle(sl.x, sl.y - 450, 90, 900, 0xffe066, 0.5).setDepth(sl.y - 2);
    this.tweens.add({ targets: beam, alpha: 0, scaleX: 0.2, duration: 1200, onComplete: () => beam.destroy() });
    this.sparks.setParticleTint(0xffe066);
    this.sparks.explode(30, sl.x, sl.y - 40);
    // a bolt of light from the seal to the boss
    const bolt = this.add.graphics().setDepth(TOP + 9050);
    bolt.lineStyle(16, 0xffe066, 0.9).lineBetween(sl.x, sl.y - 40, boss.img.x, boss.img.y - boss.img.displayHeight * 0.5);
    this.tweens.add({ targets: bolt, alpha: 0, duration: 500, onComplete: () => bolt.destroy() });
    this.tweens.add({ targets: boss.img, angle: { from: -8, to: 8 }, duration: 70, yoyo: true, repeat: 2, onComplete: () => boss.img.setAngle(0) });
    if (battle.seals < SEALS) {
      this.toast(`Seal ${battle.seals}/${SEALS} closed! The boss heals slower`, "#ffe066");
    } else {
      this.banner("ALL SEALS CLOSED!", "gold", 900);
      this.toast("The boss can't heal anymore!", "#ffe066");
    }
  }

  /** Boss rocks and shots: they fly straight, or wait and aim first, follow you, or bounce. */
  private moveRocks(delta: number): void {
    const dt = delta / 1000;
    if (dt > 0) {
      const k = Math.min(1, dt * 4);
      this.heroVel[0] += ((this.hero.x - this.heroPrev[0]) / dt - this.heroVel[0]) * k;
      this.heroVel[1] += ((this.hero.y - this.heroPrev[1]) / dt - this.heroVel[1]) * k;
      this.heroPrev = [this.hero.x, this.hero.y];
      // a teleport or a new fight is not speed
      if (Math.hypot(...this.heroVel) > 1500) this.heroVel = [0, 0];
    }
    this.rocks = this.rocks.filter((r) => {
      const speed = r.speed ?? Math.hypot(r.vx, r.vy);
      const aim = Math.atan2(this.hero.y - 40 - r.img.y, this.hero.x - r.img.x);
      if (r.wait) {
        r.wait -= delta;
        if (r.track && r.wait > 250) [r.vx, r.vy] = [Math.cos(aim) * speed, Math.sin(aim) * speed];
        const dir = Math.atan2(r.vy, r.vx);
        if (r.face) r.img.setRotation(dir);
        r.aim?.setPosition(r.img.x, r.img.y).setRotation(dir);
        // locked on: the lane goes white-hot just before it flies
        if (r.aim && r.wait < 250) r.aim.setTint(0xffffff);
        if (r.wait > 0) return true;
        r.wait = 0;
        r.aim?.destroy();
        r.aim = undefined;
      }
      if (r.home) {
        const cur = Math.atan2(r.vy, r.vx);
        const a = cur + Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(aim - cur), -r.home * dt, r.home * dt);
        [r.vx, r.vy] = [Math.cos(a) * speed, Math.sin(a) * speed];
      }
      r.img.x += r.vx * dt;
      r.img.y += r.vy * dt;
      if (r.bounce) {
        if (clampX(r.img.x) !== r.img.x) r.vx *= -1;
        if (clampY(r.img.y) !== r.img.y) r.vy *= -1;
        r.img.setPosition(clampX(r.img.x), clampY(r.img.y));
      }
      if (r.face) r.img.setRotation(Math.atan2(r.vy, r.vx));
      else r.img.rotation += (r.spin ?? 6) * dt;
      if (r.frames) r.img.setTexture(r.frames[Math.floor(this.time.now / 110) % r.frames.length]);
      r.glow?.setPosition(r.img.x, r.img.y);
      r.life -= delta;
      const hit = this.fighting && Math.hypot(r.img.x - this.hero.x, r.img.y - (this.hero.y - 60)) < (r.r ?? 60);
      if (hit) {
        this.hurt(r.dmg);
        this.puff.setParticleTint(0xa89a8a);
        this.puff.explode(8, r.img.x, r.img.y);
        this.sparks.setParticleTint(0xffffff);
        this.sparks.explode(8, r.img.x, r.img.y);
      }
      // the last moment it fades out instead of popping away
      if (r.life < 250) r.img.setAlpha(Math.max(0, r.life / 250));
      if (hit || r.life <= 0) {
        this.dropRock(r);
        return false;
      }
      return true;
    });
  }

  private hurt(dmg: number): void {
    if (this.time.now < this.phasingUntil) return;
    this.heroHp -= dmg;
    this.stats.hurt += dmg;
    this.hurtAt = this.time.now;
    this.hero.setTintFill(0xff5a5a);
    this.time.delayedCall(90, () => this.state !== "lost" && this.hero.clearTint());
    sfx.hurt();
    buzz(20);
    this.cameras.main.shake(120, 0.004);
    if (this.heroHp <= 0) {
      this.heroHp = 0;
      this.stageLost("hero");
    }
  }

  // ───────────────────────── attacking ─────────────────────────

  private nearestEnemies(x: number, y: number, range: number, n: number): Enemy[] {
    const list: [number, Enemy][] = [];
    for (const e of this.enemies) {
      if (e.img.alpha < 0.9) continue;
      const d = (e.img.x - x) ** 2 + (e.img.y - y) ** 2;
      if (d < range * range) list.push([d, e]);
    }
    return list.sort((a, b) => a[0] - b[0]).slice(0, n).map((l) => l[1]);
  }

  /** Pets attack the monster they are chasing once they are close enough. No lasers: orbs, bombs, bites and stars. */
  private petAttacks(delta: number): void {
    const mult = this.damageMult();
    const speed = (1 + 0.2 * this.lv("pack")) * (1 + this.streakBonus);
    for (const p of this.pets) {
      if (p.down > 0) continue;
      p.timer -= delta * speed;
      if (p.def.kind === "buff") {
        if (p.timer <= 0) {
          p.timer = 2200;
          this.sparks.setParticleTint(0xffe680);
          this.sparks.explode(5, p.img.x, p.img.y - 80);
        }
        continue;
      }
      const t = p.target;
      if (p.timer > 0 || !t || !this.enemies.includes(t)) continue;
      const d = Math.hypot(t.img.x - p.img.x, t.img.y - p.img.y);
      if (d > this.petReach(p) + 40) continue;
      p.timer = p.def.cooldown;
      const dmg = this.petDamage(p) * mult;
      const color = p.def.fx;
      const sx = p.img.x;
      const sy = p.img.y - 60;
      const others = this.near(t.img.x, t.img.y, 300).filter((e) => e !== t);
      const picks = [t, ...Phaser.Utils.Array.Shuffle(others)].slice(0, p.def.count);
      switch (p.def.kind) {
        case "shot":
          picks.forEach((e, i) => this.time.delayedCall(i * 80, () => this.fire(sx, sy, e, dmg, "orb", color, 0, 0.9, 1500)));
          this.tweens.add({ targets: p.img, scaleY: PET_SCALE * 0.8, duration: 70, yoyo: true });
          break;
        case "splash":
          picks.forEach((e) => this.fire(sx, sy, e, dmg, "pk_bomb", 0xffffff, 160, 0.45, 900));
          this.tweens.add({ targets: p.img, scaleY: PET_SCALE * 0.8, duration: 70, yoyo: true });
          break;
        case "zap": {
          // pounce: leap at the monster, bite, land back
          const lx = (t.img.x - p.img.x) * 0.7;
          const ly = (t.img.y - p.img.y) * 0.7;
          this.tweens.add({ targets: p.img, x: p.img.x + lx, y: p.img.y + ly, scaleX: PET_SCALE * 1.15, scaleY: PET_SCALE * 0.85, duration: 90, yoyo: true, ease: "Quad.out" });
          this.time.delayedCall(90, () => {
            for (const e of picks) {
              if (!this.enemies.includes(e)) continue;
              const bite = this.add.image(e.img.x, e.img.y - e.img.displayHeight * 0.4, "flash").setTint(color).setDepth(TOP + 9050).setScale(0.8);
              this.tweens.add({ targets: bite, scale: 1.4, alpha: 0, angle: 45, duration: 180, onComplete: () => bite.destroy() });
              this.hit(e, dmg * 1.3);
            }
          });
          break;
        }
        case "pierce":
          picks.forEach((e) => {
            const a = Math.atan2(e.img.y - e.img.displayHeight * 0.4 - sy, e.img.x - sx);
            const img = this.add.image(sx, sy, "icon_star").setScale(0.42).setTint(color).setDepth(TOP + 9000);
            this.bullets.push({ img, vx: Math.cos(a) * 1300, vy: Math.sin(a) * 1300, life: 700, dmg, pierce: 3, explode: 0, splash: 0, hit: [], spin: 14 });
          });
          this.tweens.add({ targets: p.img, angle: { from: -15, to: 15 }, duration: 80, yoyo: true, onComplete: () => p.img.setAngle(0) });
          break;
      }
    }
  }

  /** The bomb power-up: everything on screen takes a huge hit. */
  private bomb(): void {
    this.cameras.main.flash(250, 255, 220, 150);
    this.cameras.main.shake(400, 0.012);
    buzz(120);
    const v = this.cameras.main.worldView;
    for (const e of [...this.enemies]) {
      if (!v.contains(e.img.x, e.img.y)) continue;
      this.boom(e.img.x, e.img.y - 40, 1);
      this.hit(e, e.type.boss ? e.maxHp * 0.15 : e.maxHp * 10);
    }
  }

  private fire(x: number, y: number, target: Enemy, dmg: number, tex: string, color: number, splash: number, scale: number, speed: number): void {
    if (!this.enemies.includes(target)) return;
    const img = this.add.image(x, y, tex).setScale(scale).setDepth(TOP + 9000).setTint(color);
    this.shots.push({ img, target, tx: target.img.x, ty: target.img.y, dmg, speed, splash });
  }

  private moveShots(delta: number): void {
    this.shots = this.shots.filter((s) => {
      if (this.enemies.includes(s.target)) {
        s.tx = s.target.img.x;
        s.ty = s.target.img.y - s.target.img.displayHeight * 0.4;
      }
      const dx = s.tx - s.img.x;
      const dy = s.ty - s.img.y;
      const d = Math.hypot(dx, dy);
      const step = (s.speed * delta) / 1000;
      if (s.img.texture.key === "pk_bomb") s.img.rotation += delta / 60;
      else s.img.setRotation(Math.atan2(dy, dx) + (s.img.texture.key === "shard" ? Math.PI / 2 : 0));
      if (d > step + 14) {
        s.img.x += (dx / d) * step;
        s.img.y += (dy / d) * step;
        return true;
      }
      if (s.splash) {
        this.boom(s.tx, s.ty, 0.9);
        for (const e of this.near(s.tx, s.ty + 40, s.splash)) this.hit(e, s.dmg);
      } else if (this.enemies.includes(s.target)) {
        this.hit(s.target, s.dmg);
      }
      s.img.destroy();
      return false;
    });
  }

  /** An explosion: a cartoon fire burst, a flash, a shock ring and (for the big ones) rolling smoke. */
  private boom(x: number, y: number, scale: number): void {
    sfx.boom();
    const k = scale * 0.55;
    const flash = this.add.image(x, y, "glow").setTint(0xfff0b0).setScale(k * 2.2).setDepth(TOP + 8989).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: flash, alpha: 0, scale: k * 3, duration: 220, onComplete: () => flash.destroy() });
    const b = this.add.image(x, y, "bx_blast").setDepth(TOP + 8990).setScale(k * 0.3).setAngle(Phaser.Math.Between(0, 360));
    this.tweens.add({ targets: b, scale: k, duration: 130, ease: "Quad.out" });
    this.tweens.add({ targets: b, alpha: 0, angle: b.angle + 50, scale: k * 1.15, delay: 110, duration: 240, onComplete: () => b.destroy() });
    const ring = this.add.image(x, y + 10, "bx_shock").setTint(0xffd27a).setScale(k * 0.4, k * 0.25).setDepth(TOP + 8988);
    this.tweens.add({ targets: ring, scaleX: k * 1.9, scaleY: k * 1.1, alpha: 0, duration: 340, ease: "Quad.out", onComplete: () => ring.destroy() });
    if (scale < 1 || !effectsOn()) return;
    for (let i = 0; i < 3; i++) {
      const sm = this.add.image(x + Phaser.Math.Between(-40, 40) * k, y, "fx_smoke").setScale(k * 0.5).setAlpha(0.8).setTint(0x8a8a9a).setDepth(TOP + 8987);
      this.tweens.add({ targets: sm, y: y - 120 * k - i * 30, x: sm.x + Phaser.Math.Between(-50, 50), scale: k * 1.2, alpha: 0, duration: 700 + i * 120, delay: 80, ease: "Quad.out", onComplete: () => sm.destroy() });
    }
  }

  /** A hit flash: a sharp star in the attack's colour, spinning out fast. */
  private hitFx(x: number, y: number, color: number, size = 0.5): void {
    const st = this.add.image(x, y, "fx_star").setTint(color).setScale(size * 0.3).setAngle(Phaser.Math.Between(0, 90)).setDepth(TOP + 9050).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: st, scale: size, angle: st.angle + 45, alpha: 0, duration: 200, ease: "Quad.out", onComplete: () => st.destroy() });
  }

  private hit(e: Enemy, dmg: number, quiet = false): void {
    if (!this.enemies.includes(e) || e.phased) return;
    if (e.muts.includes("armor")) dmg *= 0.5;
    const crit = Math.random() < critChance();
    const amount = Math.max(1, Math.round(dmg * (crit ? critDamage() : 1) * Phaser.Math.FloatBetween(0.9, 1.1)));
    e.hp -= amount;
    this.dmgWindow += amount;
    this.stats.damage += amount;
    e.img.setTintFill(0xffffff);
    e.flashUntil = this.time.now + 70;
    const hy = e.img.y - e.img.displayHeight * (e.type.flying ? 0.5 : 0.9);
    if (!quiet) {
      sfx.hit();
      this.sparks.setParticleTint(0xffffff);
      this.sparks.explode(3, e.img.x, hy + 30);
      this.hitFx(e.img.x + Phaser.Math.Between(-14, 14), hy + 40, crit ? 0xffd23f : 0xffffff, crit ? 0.8 : 0.45);
      if (crit) {
        const sl = this.add.image(e.img.x, hy + 40, "fx_slash").setTint(0xfff0a0).setScale(0.4).setAngle(Phaser.Math.Between(-40, 40)).setDepth(TOP + 9051).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: sl, scale: 1, alpha: 0, angle: sl.angle + 60, duration: 220, ease: "Quad.out", onComplete: () => sl.destroy() });
        this.boom(e.img.x, hy + 30, 0.55);
        this.comicBurst(e.img.x, hy - 40, true);
      }
      // a cartoon squash
      if (!e.type.boss && !this.tweens.isTweening(e.img)) {
        const sx = e.img.scaleX;
        const sy = e.img.scaleY;
        this.tweens.add({ targets: e.img, scaleX: sx * 1.18, scaleY: sy * 0.82, duration: 60, yoyo: true, onComplete: () => e.img.setScale(sx, sy) });
      }
    }
    this.damageNumber(e.img.x, hy, amount, crit);
    if (e.hp <= 0 && e.lives > 0) {
      // an extra life: it pops back up with some health
      e.lives--;
      e.hp = e.maxHp * 0.6;
      e.muts = e.muts.filter((m) => m !== "lives");
      this.refreshBadge(e);
      this.puff.setParticleTint(0xff6a8a);
      this.puff.explode(16, e.img.x, hy + 30);
      this.tweens.add({ targets: e.img, scaleY: e.img.scaleY * 1.3, duration: 120, yoyo: true });
      return;
    }
    if (e.hp <= 0) this.kill(e);
  }

  /** Mutations that act over time: regrowing health and ghosts fading in and out. */
  private mutantTick(e: Enemy, delta: number): void {
    if (e.muts.includes("regen") && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.04 * (delta / 1000));
    if (e.muts.includes("ghost")) {
      e.ghostT = (e.ghostT + delta) % 4500;
      const phased = e.ghostT < 1100;
      if (phased !== e.phased) {
        e.phased = phased;
        this.tweens.add({ targets: e.img, alpha: phased ? 0.3 : 1, duration: 200 });
      }
    }
  }

  /** Chunky cartoon numbers: they pop, tilt and bounce up (crits are big, red and shouting). */
  private damageNumber(x: number, y: number, amount: number, crit: boolean): void {
    if (!save.settings.dmgNumbers) return;
    const t = this.dmgTexts.find((d) => !d.visible);
    if (!t) return;
    t.setText(crit ? `${fmt(amount)}!` : fmt(amount)).setColor(crit ? "#ff4a4a" : "#fff3a0").setPosition(x + Phaser.Math.Between(-30, 30), y).setVisible(true).setAlpha(1).setScale(0.3).setAngle(Phaser.Math.Between(-14, 14));
    this.tweens.add({ targets: t, scale: crit ? 1.7 : 1.1, duration: 160, ease: "Back.out" });
    this.tweens.add({ targets: t, y: y - 60, duration: 260, ease: "Quad.out" });
    this.tweens.add({ targets: t, y: y - 120, alpha: 0, scale: 0.6, delay: 380, duration: 380, ease: "Quad.in", onComplete: () => t.setVisible(false) });
  }

  /** A comic-book word in a spiky burst: POW! BAM! ZAP! */
  private comicBurst(x: number, y: number, big = false): void {
    const b = this.bursts.find((o) => !o.visible);
    if (!b) return;
    const words = ["POW!", "BAM!", "ZAP!", "BOOM!", "WHAM!", "BONK!", "KAPOW!"];
    const t = b.list[1] as Phaser.GameObjects.Text;
    t.setText(words[Math.floor(Math.random() * words.length)]);
    b.setPosition(x + Phaser.Math.Between(-40, 40), y).setVisible(true).setAlpha(1).setScale(0.2).setAngle(Phaser.Math.Between(-18, 18));
    this.tweens.add({ targets: b, scale: big ? 1.1 : 0.8, duration: 140, ease: "Back.out" });
    this.tweens.add({ targets: b, alpha: 0, scale: big ? 1.3 : 1, delay: 380, duration: 220, onComplete: () => b.setVisible(false) });
  }

  /** `sweep`: cleared away at the end of a stage (no rewards). */
  private kill(e: Enemy, sweep = false): void {
    this.enemies = this.enemies.filter((o) => o !== e);
    e.aura?.destroy();
    e.tele?.destroy();
    e.badge?.destroy();
    if (!sweep && e.muts.includes("split")) {
      // a splitter breaks into two smaller monsters
      for (const side of [-1, 1]) {
        const c = this.addEnemy(e.type, clampX(e.img.x + side * 50), e.img.y, false, false, 0.7);
        c.hp = c.maxHp = Math.max(1, Math.round(e.maxHp * 0.3));
        c.huntHero = true;
      }
    }
    if (!sweep && e.muts.includes("bomb")) {
      // an exploder blows up: stay away!
      this.boom(e.img.x, e.img.y - 40, 1.8);
      this.cameras.main.shake(120, 0.005);
      if (Math.hypot(this.hero.x - e.img.x, this.hero.y - e.img.y) < 220) this.hurt(e.dmg * 1.2);
    }
    const cy = e.img.y - e.img.displayHeight * 0.4;
    this.puff.setParticleTint(e.type.fx);
    this.puff.explode(e.type.boss ? 60 : sweep ? 6 : 14, e.img.x, cy);
    // cartoon stars pop out; big ones and every so often a comic word
    if (!sweep) {
      this.stars.explode(e.type.boss ? 24 : 4, e.img.x, cy);
      if (e.type.boss || e.elite || Math.random() < 0.08) this.comicBurst(e.img.x, cy - 60, e.type.boss || !!e.elite);
    }
    this.tweens.killTweensOf(e.img);
    if (e.type.boss || sweep) {
      this.tweens.add({ targets: e.img, scale: e.type.boss ? 1.6 : 0, alpha: 0, angle: 30, duration: e.type.boss ? 500 : 160, onComplete: () => e.img.destroy() });
    } else {
      // it flashes white, stretches up, then pops into a ring of chunks in its colour
      e.img.setTintFill(0xffffff);
      const [sx, sy] = [e.img.scaleX, e.img.scaleY];
      this.tweens.add({
        targets: e.img, scaleX: sx * 0.7, scaleY: sy * 1.35, y: e.img.y - 18, duration: 90, ease: "Quad.out",
        onComplete: () => {
          this.tweens.add({ targets: e.img, scaleX: sx * 1.6, scaleY: 0, alpha: 0, duration: 110, onComplete: () => e.img.destroy() });
          const pop = this.add.image(e.img.x, cy, "fx_ring").setTint(e.type.fx).setScale(0.2).setDepth(TOP + 9040);
          this.tweens.add({ targets: pop, scale: e.elite ? 1.3 : 0.8, alpha: 0, duration: 260, ease: "Quad.out", onComplete: () => pop.destroy() });
          this.sparks.setParticleTint(e.type.fx);
          this.sparks.explode(e.elite ? 14 : 7, e.img.x, cy);
        },
      });
    }
    if (sweep) return;
    // Chain Reaction: the monster bursts (bursts can set off more bursts)
    const chain = this.lv("chain");
    if (chain && !e.type.boss) {
      const [bx, by] = [e.img.x, cy];
      this.time.delayedCall(90, () => this.blast(bx, by, 110 + 20 * chain, this.heroDamage() * 0.5 * chain, null, 0xff6a4a));
    }
    // Ghost Snacks: a little health back for every monster
    const snack = this.lv("snack");
    if (snack && this.fighting) this.heroHp = Math.min(this.heroMax, this.heroHp + this.heroMax * 0.003 * snack);
    this.stats.kills++;
    save.totalKills++;
    this.streak++;
    battle.streak = this.streak;
    this.streakTimer = STREAK_MS;
    const c = this.streak;
    if (c % STREAK_STEP === 0) {
      // every 50 kills in a row: +1% damage and attack speed while the streak lasts
      this.streakText.setText(`STREAK ${c}!  +${Math.round(this.streakBonus * 100)}%`).setColor("#ff8a3a").setVisible(true).setScale(1.7);
      this.tweens.add({ targets: this.streakText, scale: 1, duration: 260, ease: "Back.out" });
      this.sparks.setParticleTint(0xffb03a);
      this.sparks.explode(20, this.hero.x, this.hero.y - 200);
      sfx.lucky();
    } else if (c >= 10 && c % 5 === 0) {
      this.streakText.setText(`STREAK ${c}`).setColor(c >= 100 ? "#ff6a8a" : c >= 40 ? "#ffb347" : "#ffe066").setVisible(true).setScale(1.3);
      this.tweens.add({ targets: this.streakText, scale: 1, duration: 150 });
    }
    this.boom(e.img.x, cy, e.type.boss ? 2.4 : e.elite ? 1.2 : 0.7);
    // streaks pay up to +100% extra
    const cash = e.cash * cashMult() * (1 + Math.min(this.streak, 100) * 0.01);
    save.cash += cash;
    this.earnedWindow += cash;
    this.stats.earned += cash;
    questEvent("kill");
    if (e.type.boss) questEvent("boss");
    if (this.streak >= 5) questEvent("combo", this.streak);
    this.game.events.emit("kill", e.type.boss);
    if (e.elite || e.type.boss || Math.random() < 0.05) this.cashPop(e.img.x, cy - 40, cash);
    this.flyCash(e.img.x, cy, e.type.boss ? 14 : e.elite ? 4 : Math.random() < 0.1 ? 1 : 0);
    if (!e.type.boss) this.dropFood(e.img.x, e.img.y - 20, e.xp);
    // lucky drops
    if (e.elite) this.addDie(rollDiceTier(save.stage), e.img.x, e.img.y, 30000);
    if (e.elite && Math.random() < 0.5) this.addPickup("orb", clampX(e.img.x + 60), e.img.y, 30000);
    else if (Math.random() < 0.0015) this.addDie(rollDiceTier(save.stage), e.img.x, e.img.y, 30000);
    else if (Math.random() < 0.0015) this.addPickup(POWERUPS[Math.floor(Math.random() * POWERUPS.length)], e.img.x, e.img.y, 30000);
    if (e.type.boss) {
      this.cameras.main.shake(500, 0.014);
      this.cameras.main.flash(200, 255, 240, 200);
      buzz(200);
      if (this.rush) this.rushBossDown();
      else if (this.state === "fight") {
        // a boss on the way (a story path): one less to worry about, and a reward
        this.banner("BOSS DOWN!", "gold", 900);
        for (let i = 0; i < 3; i++) this.addDie(rollDiceTier(save.stage + 5), clampX(e.img.x + (i - 1) * 90), e.img.y, 30000);
      } else if (e === this.bigBoss && this.story) {
        // the big boss is down: its kids run for it
        for (const o of [...this.enemies]) if (o.type.boss) this.kill(o, true);
        this.stageWon();
      } else if (this.enemies.some((o) => o.type.boss)) {
        const left = this.enemies.filter((o) => o.type.boss).length;
        this.banner(`BOSS DOWN!  ${left} LEFT`, "gold", 900);
      } else this.stageWon();
    }
  }

  private cashPop(x: number, y: number, amount: number): void {
    const c = this.cashTexts.find((t) => !t.visible);
    if (!c) return;
    (c.list[1] as Phaser.GameObjects.Text).setText(fmt(amount));
    c.setPosition(x, y).setVisible(true).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: c, scale: 1, duration: 140, ease: "Back.out" });
    this.tweens.add({ targets: c, y: y - 100, alpha: 0, delay: 450, duration: 450, onComplete: () => c.setVisible(false) });
  }

  /** Money bills pop out of defeated monsters and fly into the money counter (the UI scene animates them). */
  private flyCash(wx: number, wy: number, n: number): void {
    if (n <= 0) return;
    const [x, y] = this.toScreen(wx, wy);
    if (x < -50 || x > GAME_W + 50 || y < 0 || y > this.scale.height) return;
    this.game.events.emit("cash-fly", x, y, n);
  }

  /** Warnings for the boss's moves (marks on the ground, no lines) and health bars. */
  private drawFx(time: number): void {
    this.fx.clear();
    this.modeFx();
    for (const sl of this.seals) {
      if (sl.done) continue;
      if (Math.hypot(sl.x - this.hero.x, sl.y - this.hero.y) < SEAL_SEE) {
        this.fx.lineStyle(6, 0xe6d4ff, 0.35 + Math.sin(time / 200) * 0.15).strokeEllipse(sl.x, sl.y, SEAL_R * 2, (SEAL_R * 2) / 1.5);
      }
      if (sl.t > 0) {
        this.fx.lineStyle(26, INK_N, 0.9).beginPath().arc(sl.x, sl.y - 170, 70, -Math.PI / 2, Math.PI * 1.5).strokePath();
        this.fx.lineStyle(16, 0xffe066, 1).beginPath().arc(sl.x, sl.y - 170, 70, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * sl.t) / SEAL_MS).strokePath();
      }
    }
    for (const e of this.enemies) if (e.type.boss) this.bossTele(e, time);
    this.bars.clear();
    this.hpUsed = 0;
    const numbers = battle.mode === "run";
    for (const e of this.enemies) {
      // only bosses and elites get bars (a horde of bars is just noise)
      if (!e.type.boss && !e.elite) continue;
      const w = e.type.boss ? 300 : e.elite ? 170 : 120;
      const y = e.img.y - e.img.displayHeight * (e.type.flying ? 0.5 : 0.95) - 24;
      drawBar(this.bars, e.img.x - w / 2, y, w, e.type.boss ? 30 : 18, e.hp / e.maxHp, e.type.boss || e.elite ? 0xf26464 : 0x7ad651);
      if (numbers && e.type.boss) this.hpNum(e.img.x, y + 15, e.hp, e.maxHp, 26);
    }
    for (const p of this.pets) {
      drawBar(this.bars, p.img.x - 55, p.img.y - 128, 110, 12, p.hp / p.maxHp, p.down > 0 ? 0x9a9aa8 : p.hp / p.maxHp > 0.35 ? 0x7ad651 : 0xf26464);
      if (numbers) this.hpNum(p.img.x, p.img.y - 146, p.hp, p.maxHp, 20);
    }
    if (numbers) this.hpNum(this.hero.x, this.hero.y + 26, this.heroHp, this.heroMax, 24);
    for (let i = this.hpUsed; i < this.hpLabels.length; i++) this.hpLabels[i].setVisible(false);
    if (battle.mode === "lobby") return;
    if (this.lv("haunt") && this.fighting) {
      const r = this.hauntR();
      this.fx.fillStyle(0xb98aff, 0.08 + Math.sin(this.time.now / 300) * 0.03).fillEllipse(this.hero.x, this.hero.y, r * 2, r * 1.4);
      this.fx.lineStyle(5, 0xd8b8ff, 0.4).strokeEllipse(this.hero.x, this.hero.y, r * 2, r * 1.4);
    }
    // your health (and reload) under your feet, the crystal's health above it
    const hf = this.heroHp / this.heroMax;
    drawBar(this.bars, this.hero.x - 80, this.hero.y + 16, 160, 20, hf, hf > 0.35 ? 0x7ad651 : 0xf26464);
    if (battle.bossFight || !this.crystal.visible) return;
    const [hx, hy] = this.arena.center;
    const f = this.crystalHp / this.crystalMax;
    drawBar(this.bars, hx - 150, hy - 330, 300, 30, f, this.shielded ? 0x9ae6ff : f > 0.4 ? 0x67c3ff : 0xf26464);
  }

  /** Minimap, plus arrows to the crystal (when attacked), airdrops, chests, rare dice and the boss; drawn by the UI scene. */
  drawOverlay(g: Phaser.GameObjects.Graphics, mx: number, my: number, size: number, top: number, bottom: number): void {
    g.clear();
    // a story path has no minimap (the bar at the top shows how far you are), the sea is all on screen
    if (this.arena.path || this.arena.sea) return;
    const s = size / ARENA;
    g.lineStyle(6, INK_N, 1).strokeRoundedRect(mx - 3, my - 3, size + 6, size + 6, 12);
    const [hx, hy] = this.arena.center;
    if (this.crystal.visible) {
      g.fillStyle(this.shielded ? 0x9ae6ff : this.land.crystal, 1).fillCircle(mx + hx * s, my + hy * s, 7);
      g.lineStyle(2, 0xffffff, 1).strokeCircle(mx + hx * s, my + hy * s, this.shielded ? 11 : 7);
    }
    if (this.stageMode === "air" && this.air.zone) {
      g.lineStyle(3, 0x5aff8a, 1).strokeRect(mx + this.air.x * s, my + this.air.y * s, AIR_ZONE * s, AIR_ZONE * s);
      if (this.air.next) g.lineStyle(2, 0xffe066, 1).strokeRect(mx + this.air.nx * s, my + this.air.ny * s, AIR_ZONE * s, AIR_ZONE * s);
    }
    if (this.beast?.food) g.fillStyle(0xffa040, 1).fillCircle(mx + this.beast.food.x * s, my + this.beast.food.y * s, 6);
    if (this.beast && !this.beast.escaped) g.fillStyle(this.beast.friend ? 0x7ad651 : 0xffa040, 1).fillCircle(mx + this.beast.img.x * s, my + this.beast.img.y * s, 8);
    for (const p of this.pickups) {
      const color = p.kind === "dice" ? TIER_INFO[p.tier!].color : p.kind === "orb" ? 0xff9a2a : p.kind === "airdrop" ? 0xffffff : p.kind === "chest" ? 0xffe066 : 0xd8d8d8;
      const r = p.kind === "airdrop" || p.kind === "chest" || p.kind === "orb" ? 5 : 3.5;
      g.fillStyle(color, 1).fillRect(mx + p.x * s - r, my + p.y * s - r, r * 2, r * 2);
    }
    for (const sl of this.seals) {
      if (sl.done) continue;
      g.fillStyle(0xd8b8ff, 1).fillCircle(mx + sl.x * s, my + sl.y * s, 6);
      g.lineStyle(2, INK_N, 1).strokeCircle(mx + sl.x * s, my + sl.y * s, 6);
    }
    for (const e of this.enemies) g.fillStyle(e.toCrystal ? 0xff9a3a : 0xf26464, 1).fillCircle(mx + e.img.x * s, my + e.img.y * s, e.type.boss ? 5 : 2);
    g.fillStyle(0xffffff, 1).fillCircle(mx + this.hero.x * s, my + this.hero.y * s, 5);
    g.lineStyle(3, 0xff8a3a, 1).strokeCircle(mx + this.hero.x * s, my + this.hero.y * s, 5);
    const v = this.cameras.main.worldView;
    g.lineStyle(2, 0xffffff, 0.7).strokeRect(mx + v.x * s, my + v.y * s, v.width * s, v.height * s);
    if (battle.mode !== "run") return;

    const cxs = GAME_W / 2;
    const cys = (top + bottom) / 2;
    const arrow = (wx: number, wy: number, color: number) => {
      const [sx, sy] = this.toScreen(wx, wy);
      if (sx > 0 && sx < GAME_W && sy > top && sy < bottom) return;
      const a = Math.atan2(sy - cys, sx - cxs);
      const ax = Phaser.Math.Clamp(cxs + Math.cos(a) * 2000, 50, GAME_W - 50);
      const ay = Phaser.Math.Clamp(cys + Math.sin(a) * 2000, top + 20, bottom - 20);
      const pt = (o: number, r: number) => [ax + Math.cos(a + o) * r, ay + Math.sin(a + o) * r];
      const [p1, p2, p3] = [pt(0, 34), pt(2.4, 28), pt(-2.4, 28)];
      g.fillStyle(color, 0.95).fillTriangle(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
      g.lineStyle(4, INK_N, 1).strokeTriangle(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
    };
    if (this.enemies.some((e) => e.attacking) && this.time.now % 600 < 400) arrow(hx, hy, 0xf26464);
    for (const p of this.pickups) {
      if (p.kind === "chest") arrow(p.x, p.y - 40, 0xffd23f);
      if (p.kind === "airdrop") arrow(p.x, p.y - 40, 0xffd23f);
      if (p.kind === "dice" && tierIndex(p.tier!) >= 3) arrow(p.x, p.y - 40, TIER_INFO[p.tier!].color);
    }
    for (const e of this.enemies) if (e.type.boss) arrow(e.img.x, e.img.y, 0xf26464);
    // the mode's goals (air zone, snack, cage) get big markers from the UI scene: see goals()
    if (this.state === "boss") for (const sl of this.seals) if (!sl.done) arrow(sl.x, sl.y, 0xd8b8ff);
  }

  /** World spots the mode wants you to get to, most important first. */
  private goalSpots(): { x: number; y: number; icon: string; label: string; color: number }[] {
    if (battle.mode !== "run") return [];
    const out: { x: number; y: number; icon: string; label: string; color: number }[] = [];
    if (this.stageMode === "air" && this.air.zone) {
      const z = AIR_ZONE / 2;
      if (!this.inAir()) out.push({ x: this.air.x + z, y: this.air.y + z, icon: "mode_air", label: "GET AIR!", color: 0x5aff8a });
      if (this.air.next) out.push({ x: this.air.nx + z, y: this.air.ny + z, icon: "mode_air", label: "NEXT ZONE", color: 0xffe066 });
    }
    const p = this.arena.path;
    if (p && this.state === "fight") {
      // the lantern first (it is on the way), then the end of the path
      if (this.lantern) out.push({ x: this.lantern[0].x, y: this.lantern[0].y - 60, icon: "lantern", label: "LANTERN", color: 0xffd24a });
      else out.push({ x: this.arena.w / 2, y: p.endY, icon: p.kind === "sea" ? "icon_fish" : "house_a", label: p.kind === "sea" ? "THE SEA" : "VILLAGE", color: 0x8ad65a });
    }
    if (this.stageMode === "ocean" && this.state === "fight") {
      // a rough compass: it points near the island, more truly the closer you get
      const o = this.ocean;
      if (o.phase === "calm") {
        const far = Math.hypot(this.hero.x - o.x, this.hero.y - o.y);
        const k = Math.min(1, far / 9000);
        const near = far < 2200;
        out.push({ x: o.x + o.gx * k, y: o.y - 200 + o.gy * k, icon: "sea_bigisland", label: near ? "LAND HO!" : "LAND?", color: near ? 0x7ad651 : 0xa8e8ff });
      }
    }
    if ((this.stageMode === "sea" && this.sea.tsunami || this.stageMode === "ocean" && this.ocean.phase !== "calm") && !this.onIsland()) {
      const d = (q: { x: number; y: number }) => Math.hypot(q.x - this.hero.x, q.y - this.hero.y);
      const near = this.sea.islands.reduce<{ x: number; y: number } | null>((a, c) => (!a || d(c) < d(a) ? c : a), null);
      if (near) out.push({ x: near.x, y: near.y - 60, icon: "sea_island", label: "ISLAND!", color: 0x7ad651 });
    }
    if (this.stageMode === "hunt" && this.state === "fight") {
      const lost = this.pickups.filter((q) => q.quest);
      const d = (q: Pickup) => Math.hypot(q.x - this.hero.x, q.y - this.hero.y);
      if (lost.length) {
        const q = lost.reduce((a, c) => (d(c) < d(a) ? c : a));
        out.push({ x: q.x, y: q.y - 40, icon: "die_A", label: `DICE ${this.huntFound}/${HUNT_DICE}`, color: 0xffb03a });
      }
    }
    const b = this.beast;
    if (b && !b.friend && !b.escaped) {
      if (b.food && !b.carried) out.push({ x: b.food.x, y: b.food.y, icon: "mode_feed", label: "SNACK!", color: 0xffa040 });
      if (b.carried) out.push({ x: b.cage.x, y: b.cage.y - 120, icon: b.tex, label: "FEED IT!", color: 0xffa040 });
    }
    return out;
  }

  /** The mode's goals on the screen, for the UI scene's big markers. */
  goals(): Goal[] {
    return this.goalSpots().map((g) => {
      const [sx, sy] = this.toScreen(g.x, g.y);
      return { sx, sy, icon: g.icon, label: g.label, color: g.color, m: Math.hypot(g.x - this.hero.x, g.y - this.hero.y) / 100 };
    });
  }

  /** DPS readout, money per second (for offline earnings) and autosave. */
  private trackStats(delta: number): void {
    this.dpsTimer += delta;
    if (this.dpsTimer >= 1000) {
      battle.dps = battle.dps * 0.6 + (this.dmgWindow / (this.dpsTimer / 1000)) * 0.4;
      this.dmgWindow = 0;
      this.dpsTimer = 0;
    }
    this.rateTimer += delta;
    this.saveTimer += delta;
    if (this.rateTimer >= 15000) {
      const rate = this.earnedWindow / (this.rateTimer / 1000);
      if (this.fighting) save.cashPerSec = save.cashPerSec ? save.cashPerSec * 0.6 + rate * 0.4 : rate;
      this.earnedWindow = 0;
      this.rateTimer = 0;
    }
    if (this.saveTimer >= 5000) {
      this.saveTimer = 0;
      persist();
    }
  }
}
