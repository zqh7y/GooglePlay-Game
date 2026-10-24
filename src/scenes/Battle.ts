import Phaser from "phaser";
import { HERO_HAND } from "../art/characters";
import { INK_N, lighten, rgba } from "../art/draw";
import { GROUND_SCALE, PATCH_R, makeGround } from "../art/ground";
import { makeGadgetTextures } from "../art/gadgets";
import { petTexture } from "../art/pets";
import { makePickupTextures } from "../art/pickups";
import { crystalKey, makeWorldTextures } from "../art/world";
import {
  AIRDROP_FIRST_MS, AIRDROP_MS, BOSS, BOSS_HEAL, CRYSTAL_DIE_MS, HEALING_BOSS_HP, SEALS, SEAL_MS, CRYSTAL_HP, ELITE_MULT, crystalHpAt, raiderShare, FLYER, HERO_BASE_DMG, HERO_HP, HERO_TEAM_SHARE,
  MAX_MONSTERS, MAX_STAGE, MINUTES, MonsterStats, SHIELD_MS, STAGE_MS, WALKER_A, WALKER_B, monsterCash, monsterHp, spawnGap, xpFor,
} from "../data/balance";
import { BOOSTS, BoostDef } from "../data/boosts";
import {
  GADGETS, GADGET_KINDS, GADGET_SLOTS, GadgetBase, GadgetKind, MAX_GADGET_LEVEL, STARTER_GADGET, gadgetKey, gadgetName, gadgetStats,
} from "../data/gadgets";
import { ITEMS, ItemDef, levelMult } from "../data/items";
import { REGIONS, Region, regionForStage } from "../data/regions";
import { SKILL_BY_ID, SkillId, skillChoices } from "../data/skills";
import { MUTATION_BY_ID, MutationId, rollMutations } from "../data/mutations";
import { makeMutationTextures } from "../art/mutations";
import { makeBossTextures } from "../art/bosses";
import { makePlaceTextures } from "../art/places";
import { BOSS_EVERY, BOSS_MOVES, BossMoveId, RUSH_MS, bossForStage, rushBossHp } from "../data/bosses";
import { DICE_TIERS, GADGET_TIERS, TIER_INFO, Tier, rollDiceTier, rollGadgetTier, tierIndex } from "../data/tiers";
import { ARENA, Arena, clampX, clampY, getArena } from "../game/arena";
import { GAME_W, Layout, layoutFor } from "../layout";
import { questEvent } from "../systems/goals";
import { persist, save } from "../systems/save";
import { buzz, music, sfx } from "../systems/sound";
import {
  cashMult, chestMult, critChance, critDamage, dmgMult, gadgetTierCap, gemsPerBoss, heroDmgMult, moveSpeedMult, petSlots, rangeMult, villageHpMult,
} from "../systems/stats";
import { rarityRank } from "../data/rarity";
import { fmt, oneIn } from "../ui/format";
import { classText } from "../ui/classText";
import { drawBar, text } from "../ui/widgets";

/** The camera shows 1.66x more of the field during a fight (a bit closer in the lobby). */
const ZOOM = 1 / 1.66;
const LOBBY_ZOOM = 0.85;
const HERO_SPEED = 390;
/** Pets run after monsters this far from you, and come back if you get farther away. */
const PET_LEASH = 1000;
const PET_SPEED = 520;
const HERO_R = 40;
const PICK_R = 210;
/** While the crystal is open, monsters this close to you go for you instead. */
const AGGRO = 420;
/** Crystal raiders keep marching on the crystal unless you get right in their way (or the shield is up). */
const RAIDER_AGGRO = 140;
/** Kills in a row: the streak lasts while each kill comes within STREAK_MS of the last; every STREAK_STEP kills add +1%. */
const STREAK_MS = 3000;
const STREAK_STEP = 50;
const REVIVE_GEMS = 5;
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
export type FightKind = "battle" | "rush";

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
  reason: "hero" | "crystal" | "quit";
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
  phase: "walk" | "windup" | "dash" | "stomp" | "throw" | "ring" | "volley" | "summon" | "spin" | "rain" | "jump" | "blink" | "burrow" | "rise" | "breath";
  phaseT: number;
  /** shots left in a ring or volley */
  shots: number;
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
}

/** Rocks the boss throws at you. */
/** A red circle on the ground that blows up when its time comes. */
interface Strike {
  x: number;
  y: number;
  r: number;
  at: number;
  ms: number;
  dmg: number;
}

interface Rock {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
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
  /** a Second Chance boost: get back up once without gems */
  private freeRevive = false;
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
  private rangs: { img: Phaser.GameObjects.Image; dx: number; dy: number; speed: number; went: number; max: number; back: boolean; dmg: number; hit: Set<Enemy> }[] = [];
  private holes: { img: Phaser.GameObjects.Image; x: number; y: number; r: number; until: number; dmg: number }[] = [];

  private pets: Pet[] = [];
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private bullets: Bullet[] = [];
  private rocks: Rock[] = [];
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
  private puff!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dmgTexts: Phaser.GameObjects.Text[] = [];
  private cashTexts: Phaser.GameObjects.Container[] = [];

  private buckets = new Map<number, Phaser.GameObjects.Image[]>();
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

  create(data: { autostart?: boolean; rush?: boolean }): void {
    this.L = layoutFor(this.scale.height);
    makeWorldTextures(this, REGIONS);
    makePickupTextures(this);
    makeGadgetTextures(this);
    makeMutationTextures(this);
    makeBossTextures(this);
    makePlaceTextures(this);
    this.rush = !!data?.rush;
    this.land = regionForStage(save.stage);
    this.arena = getArena(this.land.id);
    Object.assign(this, {
      pets: [], enemies: [], shots: [], bullets: [], rocks: [], pickups: [], food: [], dmgTexts: [], cashTexts: [],
      state: "lobby", elapsed: 0, minute: 0, shielded: false, hurtAt: 0, stillFor: 0, level: 1, xp: 0, pendingLevels: 0, pendingSkills: 0, gadgetOpts: [], skills: {},
      revived: false, freeRevive: false, rushLeft: 0, rushBeaten: 0, rushGems: 0, stats: freshStats(), frozenUntil: 0, warnedAt: 0,
      gadgets: [{ kind: STARTER_GADGET, tier: "A", level: 1, timer: 300 }], wisps: [], bubbles: [], puddles: [], kite: null, kiteT: 0, rangs: [], holes: [],
      spawnTimer: 0, eliteTimer: 25000, chestTimer: 50000 + Math.random() * 20000, dropTimer: AIRDROP_FIRST_MS, shardTimer: 0, crystalDieAt: CRYSTAL_DIE_MS,
      streak: 0, streakTimer: 0, buckets: new Map(), shown: new Set(), grid: new Map(), seals: [], healPopT: 0, strikes: [],
      roamDiceT: ROAM_DICE_MS, wander: null, entering: false, hauntT: 0, ghostT: 0, phasingUntil: 0,
    });
    this.joy = { ...NO_JOY };
    this.heroMax = HERO_HP * villageHpMult();
    this.heroHp = this.heroMax;
    this.crystalMax = crystalHpAt(save.stage) * villageHpMult();
    this.crystalHp = this.crystalMax;
    Object.assign(battle, {
      mode: "lobby", time: 0, bossFrac: -1, crystal: 1, hp: 1, level: 1, xp: 0, dps: 0, streak: 0, choosing: false,
      shielded: false, shieldLeft: SHIELD_MS, gadgets: this.gadgets, skills: this.skills, stats: this.stats,
      bossFight: false, rush: this.rush, rushBoss: save.stage, rushLeft: RUSH_MS, seals: 0, sealsTotal: 0,
    });
    this.cameras.main.fadeIn(500, 74, 47, 29);
    this.drawArena();

    const [cx, cy] = this.arena.center;
    this.hero = this.add.image(cx, cy + 260, "hero").setOrigin(0.5, 0.95);
    this.handImg = this.add.image(0, 0, gadgetKey(STARTER_GADGET));
    this.refreshHand();
    this.fortImg = this.add.image(0, 0, "ring").setTint(0xffd08a).setAlpha(0).setScale(1.4, 0.7);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, ARENA, ARENA).setZoom(LOBBY_ZOOM);
    cam.startFollow(this.hero, true, 0.14, 0.14);
    this.followOffset();

    this.fx = this.add.graphics().setDepth(9000);
    this.bars = this.add.graphics().setDepth(9100);
    this.puff = this.add.particles(0, 0, "puff", { speed: { min: 80, max: 340 }, lifespan: 500, scale: { start: 1.2, end: 0 }, emitting: false }).setDepth(8900);
    this.sparks = this.add.particles(0, 0, "spark", {
      speed: { min: 120, max: 360 }, lifespan: 320, scale: { start: 0.7, end: 0 }, rotate: { min: 0, max: 90 }, emitting: false,
    }).setDepth(8950);
    this.trail = this.add.particles(0, 0, "puff", {
      speed: 0, lifespan: 300, scale: { start: 0.9, end: 0 }, alpha: { start: 0.75, end: 0 }, blendMode: "ADD", emitting: false,
    }).setDepth(8990);
    for (let i = 0; i < 70; i++) this.dmgTexts.push(text(this, 0, 0, "", 66).setDepth(9300).setVisible(false));
    for (let i = 0; i < 24; i++) {
      this.cashTexts.push(this.add.container(0, 0, [
        this.add.image(-10, 0, "icon_cash").setScale(0.66).setOrigin(1, 0.5),
        text(this, 0, 0, "", 62, "#8af06a").setOrigin(0, 0.5),
      ]).setDepth(9350).setVisible(false));
    }
    this.streakText = text(this, 0, 0, "", 74, "#ffe066").setDepth(9400).setVisible(false);

    this.buildPets();
    this.setupControls();
    const on: [string, (...a: never[]) => void][] = [
      ["pets-changed", this.buildPets],
      ["battle-start", this.begin],
      ["skill-picked", this.onSkillPicked],
      ["gadget-picked", this.onGadgetPicked],
      ["revive", this.revive],
      ["retry", this.retry],
      ["give-up", this.giveUp],
      ["rush-start", this.startRush],
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
        const boss = this.addEnemy({ tex: def.tex, stats: BOSS, fx: def.color, boss: true, moves: def.moves }, x, y, false, false, 1, n);
        boss.hp = boss.maxHp = rushBossHp(n);
        // the clock is the real danger here: rush bosses hit softer
        boss.dmg *= 0.5;
        boss.huntHero = true;
        boss.phaseT = 1500;
        this.toast(`${def.name}: ${def.moves.map((m) => BOSS_MOVES[m]).join(", ")}`, rgba(lighten(def.color, 0.3)));
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
    this.strikes = [];
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

  /** The BATTLE button: the start animation, then the run starts. */
  private begin(skipEnter = false): void {
    if (this.state !== "lobby" || this.entering) return;
    if (skipEnter) {
      this.startRun();
      return;
    }
    this.enter("battle", () => {
      // back out by the crystal, where every run starts
      const [cx, cy] = this.arena.center;
      this.hero.setPosition(cx, cy + 260).setScale(1).setAlpha(1).setTexture("hero");
      this.pets.forEach((p) => p.img.setPosition(cx + p.ox, cy + 260 + p.oy).setAlpha(1));
      this.handImg.setVisible(true);
      this.entering = false;
      this.cameras.main.fadeIn(400, 74, 47, 29);
      this.startRun();
    });
  }

  /** The run starts: a fresh clock, the field fills with pickups. */
  private startRun(): void {
    this.state = "intro";
    // dice picked up while roaming the lobby are not part of this run's results
    this.stats = freshStats();
    battle.stats = this.stats;
    battle.mode = "run";
    this.cameras.main.zoomTo(ZOOM, 900, "Sine.easeInOut");
    this.placePickups();
    sfx.alarm();
    this.banner(`STAGE ${save.stage}`, "peach", 900);
    const boosts = this.useBoosts();
    this.time.delayedCall(1500, () => {
      this.banner("SURVIVE 5:00!", "red", 900);
      this.state = "fight";
      music.play("battle");
      this.game.events.emit("stage-start");
      if (boosts.length) this.toast(`Boosts on: ${boosts.map((b) => b.name).join(", ")}`, "#9ae6ff");
      if (boosts.some((b) => b.id === "start")) {
        this.pendingSkills += 2;
        this.time.delayedCall(1400, () => this.offerChoice());
      }
    });
  }

  /** Battle Boosts bought in the shop: each owned one is used up by this fight. */
  private useBoosts(): BoostDef[] {
    const used: BoostDef[] = [];
    for (const b of BOOSTS) {
      if (!save.boosts[b.id]) continue;
      save.boosts[b.id]--;
      used.push(b);
      if (b.id === "gun") {
        const kinds = GADGET_KINDS.filter((k) => k !== STARTER_GADGET);
        this.addGadget(kinds[Math.floor(Math.random() * kinds.length)], GADGET_TIERS[Math.min(2, gadgetTierCap())]);
      } else if (b.id === "revive") {
        this.freeRevive = true;
      } else if (b.id === "armor") {
        this.crystalMax *= 1.5;
        this.crystalHp = this.crystalMax;
      }
    }
    if (used.length) persist();
    return used;
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
    let pace = 1;
    if (dice.length) {
      const dist = (p: Pickup) => Math.hypot(p.x - this.hero.x, p.y - this.hero.y);
      const p = dice.reduce((a, b) => (dist(b) < dist(a) ? b : a));
      [tx, ty] = [p.x, p.y];
      this.wander = null;
    } else {
      if (!this.wander || Math.hypot(this.wander[0] - this.hero.x, this.wander[1] - this.hero.y) < 40) this.wander = this.randomSpot(200, 900);
      [tx, ty] = this.wander;
      pace = 0.5;
    }
    const [vx, vy] = [tx - this.hero.x, ty - this.hero.y];
    const d = Math.hypot(vx, vy);
    return d < 20 ? [0, 0] : [(vx / d) * pace, (vy / d) * pace];
  }

  // ───────────────────────── arena ─────────────────────────

  /** Scenery far from the camera is hidden, so the big field stays fast. */
  private addStatic(obj: Phaser.GameObjects.Image, x: number, y: number): void {
    const k = Math.floor(x / BUCKET) * 1000 + Math.floor(y / BUCKET);
    if (!this.buckets.has(k)) this.buckets.set(k, []);
    this.buckets.get(k)!.push(obj);
    obj.setVisible(false);
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
  }

  private drawArena(): void {
    const a = this.arena;
    const keys = makeGround(this, a);
    const s = 1 / GROUND_SCALE;
    this.add.tileSprite(0, 0, ARENA * GROUND_SCALE, ARENA * GROUND_SCALE, keys.tile).setOrigin(0).setScale(s).setDepth(-1000);
    a.patches.forEach((p, i) => {
      const img = this.add.image(p.x, p.y, keys.patches[i % keys.patches.length]).setScale((s * p.r) / PATCH_R).setDepth(-900).setFlipX(i % 2 === 1);
      this.addStatic(img, p.x, p.y);
    });
    const [cx, cy] = a.center;
    this.add.image(cx, cy + 40, keys.circle).setScale(s).setDepth(-800);
    for (const o of a.objects) {
      const img = this.add.image(o.x, o.y, o.tex).setOrigin(0.5, 1).setDepth(o.y).setFlipX(!!o.flip);
      if (o.scale) img.setScale(o.scale);
      this.addStatic(img, o.x, o.y);
      if (o.tex.startsWith("tree") || o.tex === "palm") {
        this.tweens.add({ targets: img, angle: { from: -1.5, to: 1.5 }, duration: 2200 + (o.x % 900), yoyo: true, repeat: -1, ease: "Sine.inOut" });
      }
    }
    // the crystal you protect: bobbing, glowing and sparkling
    const glow = this.add.image(cx, cy - 110, "glow").setTint(this.land.crystal).setScale(2.4).setAlpha(0.5).setDepth(cy - 1);
    this.tweens.add({ targets: glow, alpha: 0.85, scale: 2.8, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.crystalGlow = glow;
    this.crystalHome = [cx, cy + 70];
    this.crystal = this.add.image(cx, cy + 70, crystalKey(this.land.id)).setOrigin(0.5, 1).setDepth(cy + 70);
    this.tweens.add({ targets: this.crystal, y: cy + 60, duration: 1500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.gloom = this.add.rectangle(0, 0, ARENA, ARENA, 0x1a1030, 0).setOrigin(0).setDepth(15000);
    this.crystalSparkle = this.add.particles(cx, cy - 120, "spark", {
      x: { min: -90, max: 90 }, y: { min: -120, max: 80 }, lifespan: 1400, speedY: { min: -40, max: -10 },
      scale: { start: 0.5, end: 0 }, tint: [this.land.crystal, 0xffffff], frequency: 160,
    }).setDepth(cy + 71);
    this.shieldImg = this.add.image(cx, cy - 60, "shield").setScale(0).setAlpha(0.9).setDepth(cy + 80);
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
    const [cx, cy] = from ?? this.arena.center;
    const a = Math.random() * Math.PI * 2;
    const d = min + Math.random() * (max - min);
    return [clampX(cx + Math.cos(a) * d), clampY(cy + Math.sin(a) * d)];
  }

  /** Dice (they pay for rolls), power-ups and skill orbs are spread all over the field. */
  private placePickups(): void {
    for (let i = 0; i < 14; i++) this.addDie(rollDiceTier(save.stage), ...this.randomSpot(700, 2650), 0);
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
  private addDie(tier: Tier, x: number, y: number, life: number): void {
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
    this.pickups.push({ kind: "dice", img, glow, x, y, until: life ? this.time.now + life : 0, tier, ready: true, extra });
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
    const img = this.add.image(cx, cy - 220, `die_${tier}`).setScale(0).setDepth(9000);
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
    const chute = this.add.image(x, y - 1110, "parachute").setOrigin(0.5, 1).setDepth(9050);
    p.img.setY(y - 1000).setDepth(9051);
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
    const gems = Math.random() < 0.35 ? 2 + Math.floor(Math.random() * 4) : 0;
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
      const choices = skillChoices(this.skills);
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
    const t = text(this, this.hero.x, this.hero.y - 250, str, 60, color).setDepth(9450).setScale(0.3);
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
      this.heroMax = HERO_HP * villageHpMult() * (1 + 0.25 * lv);
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
    return 1 + 0.5 * this.lv("vacuum");
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
    sfx.charge(5);
  }

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
      switch (g.kind) {
        case "shuriken": {
          for (let i = 0; i < st.count; i++) {
            const t = targets[i % targets.length];
            const a = Math.atan2(t.img.y - t.img.displayHeight * 0.4 - hy, t.img.x - hx) + (i >= targets.length ? (Math.random() - 0.5) * 0.4 : 0);
            const img = this.add.image(hx, hy, "gd_shuriken").setDepth(9000).setScale(1.35);
            this.bullets.push({ img, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed, life: (st.range / st.speed) * 1000, dmg, pierce: st.pierce, explode: 0, splash: 0, hit: [], spin: 20, trail: 0x9ad0ff });
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
            const img = this.add.image(hx, hy, "gd_bubble").setDepth(9000).setScale(0.4);
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
            const img = this.add.image(hx, hy, "gd_kernel").setDepth(9000).setScale(1.6);
            this.bullets.push({ img, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed, life: (st.range / st.speed) * 1000, dmg, pierce: st.pierce, explode: 0, splash: 0, hit: [], spin: 8, trail: 0xffb347 });
          }
          sfx.shoot(false);
          break;
        }
        case "boomerang":
          for (let i = 0; i < st.count; i++) {
            const t = targets[0];
            const a = Math.atan2(t.img.y - 40 - hy, t.img.x - hx) + (i - (st.count - 1) / 2) * 0.35;
            const img = this.add.image(hx, hy, "gd_boomerang").setDepth(9000).setScale(1.45);
            this.rangs.push({ img, dx: Math.cos(a), dy: Math.sin(a), speed: st.speed, went: 0, max: st.range, back: false, dmg, hit: new Set() });
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
    const blob = this.add.image(sx, sy, "gd_glue").setDepth(9200).setScale(1);
    const k = { t: 0 };
    this.tweens.add({
      targets: k, t: 1, duration: 450,
      onUpdate: () => {
        blob.setPosition(sx + (tx - sx) * k.t, sy + (ty - sy) * k.t - Math.sin(k.t * Math.PI) * 200).setAngle(k.t * 360);
        this.trailAt(blob.x, blob.y, 0xe8f0f8);
      },
      onComplete: () => {
        blob.destroy();
        const img = this.add.image(tx, ty, "gd_puddle").setDepth(-600).setScale(0.2).setAlpha(0.95);
        this.tweens.add({ targets: img, scale: r / 100, duration: 220, ease: "Back.out" });
        this.puddles.push({ img, x: tx, y: ty, r, until: this.time.now + 4000, dmg, tick: 0 });
      },
    });
  }

  /** The kite calls lightning onto a monster; it jumps on to the nearest ones it has not hit yet. */
  private lightning(first: Enemy, dmg: number, jumps: number): void {
    let [px, py] = this.kite ? [this.kite.x, this.kite.y + 40] : [this.hero.x, this.hero.y - 220];
    const g = this.add.graphics().setDepth(9100);
    const hit: Enemy[] = [];
    let cur: Enemy | undefined = first;
    while (cur && hit.length <= jumps) {
      const x: number = cur.img.x;
      const y: number = cur.img.y - cur.img.displayHeight * 0.4;
      // a jagged bolt, a wide yellow glow under a thin white core
      const pts: [number, number][] = [[px, py]];
      for (let k = 1; k < 6; k++) pts.push([px + ((x - px) * k) / 6 + (Math.random() - 0.5) * 50, py + ((y - py) * k) / 6 + (Math.random() - 0.5) * 50]);
      pts.push([x, y]);
      for (const [w, c] of [[16, 0xffe066], [6, 0xffffff]] as [number, number][]) {
        g.lineStyle(w, c, 0.95).beginPath().moveTo(pts[0][0], pts[0][1]);
        for (const [qx, qy] of pts.slice(1)) g.lineTo(qx, qy);
        g.strokePath();
      }
      hit.push(cur);
      this.hit(cur, dmg);
      this.sparks.setParticleTint(0xffe066);
      this.sparks.explode(6, x, y);
      [px, py] = [x, y];
      cur = this.nearestEnemies(x, y + 40, 380, 6).find((e) => !hit.includes(e));
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
  }

  /** A bubble pops: a splash that hurts everything around it. */
  private popBubble(b: { img: Phaser.GameObjects.Image; dmg: number; r: number }): void {
    this.blast(b.img.x, b.img.y + 30, b.r, b.dmg, null, 0xb8e8ff);
    b.img.destroy();
  }

  /** Grenades fly in an arc; S tier and up open a black hole that pulls monsters in before it bursts. */
  private lobGrenade(t: Enemy, dmg: number, r: number, hole: boolean): void {
    const sx = this.hero.x;
    const sy = this.hero.y - 70;
    const tx = t.img.x;
    const ty = t.img.y - 10;
    const img = this.add.image(sx, sy, "gd_grenade").setDepth(9200).setScale(1.3);
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
          return false;
        }
        b.img.x += (dx / d) * step * 1.1;
        b.img.y += (dy / d) * step * 1.1;
      }
      b.img.rotation += dt * 16;
      this.trailAt(b.img.x, b.img.y, 0xffcf3a);
      if (fighting) for (const e of this.near(b.img.x, b.img.y + 40, 70)) {
        if (b.hit.has(e)) continue;
        b.hit.add(e);
        this.hit(e, b.dmg);
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
      if (!alive) b.img.destroy();
      return alive;
    });
  }

  /** An explosion (or a water balloon splash) that hurts everything around (except the monster already hit). */
  private blast(x: number, y: number, r: number, dmg: number, skip: Enemy | null, splash = 0): void {
    if (splash) {
      sfx.boom();
      const s = this.add.image(x, y, "ring").setTint(splash).setScale(0.3).setDepth(8990);
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
      const step = (HERO_SPEED * moveSpeedMult() * (1 + 0.12 * this.lv("zoom")) * delta) / 1000;
      this.hero.setPosition(clampX(this.hero.x + vx * step), clampY(this.hero.y + vy * step)).setScale(1);
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
      const odds = classText(this, img.x, img.y, `${def.cls}  ${def.name}  ${oneIn(def.oneIn)}`, 26, def.cls).setDepth(9200);
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
    if (this.state === "fight") this.setShield(Math.floor(this.elapsed / SHIELD_MS) % 2 === 1);
    const minute = Math.min(MINUTES, Math.floor(this.elapsed / 60000));
    if (minute > this.minute) {
      this.minute = minute;
      questEvent("wave");
      if (minute < MINUTES) {
        sfx.alarm();
        buzz(60);
        this.banner(minute === MINUTES - 1 ? "LAST MINUTE!" : `${MINUTES - minute} MINUTES LEFT`, "red", 1000);
        this.toast("Monsters get stronger!", "#ff9a9a");
        this.swarm(30 + minute * 12);
      }
    }
    if (this.state === "fight" && this.elapsed >= this.crystalDieAt) {
      this.crystalDieAt += CRYSTAL_DIE_MS;
      this.crystalDie();
    }
    if (this.state === "fight" && this.elapsed >= STAGE_MS) this.bossCutscene();
  }

  private types(): Record<"a" | "b" | "f", EnemyType> {
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
    if (this.state !== "fight") return;
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      // the first stages go a little easier on new players
      this.spawnTimer = spawnGap(this.minute) * (1 + Math.max(0, 4 - save.stage) / 6);
      const group = 1 + (save.stage > 40 ? 1 : 0);
      for (let i = 0; i < group && this.enemies.length < MAX_MONSTERS; i++) {
        // while the crystal is open many monsters march on it from far away
        // (the ones that appear around you come for you)
        const atCrystal = !this.shielded && this.elapsed > 8000 && Math.random() < raiderShare(save.stage);
        const [x, y] = atCrystal ? this.randomSpot(1600, 2500) : this.offScreen();
        const e = this.addEnemy(this.pickType(), x, y);
        e.huntHero = !atCrystal;
        e.raider = atCrystal;
      }
    }
    // tough elites carry dice
    this.eliteTimer -= delta;
    if (this.eliteTimer <= 0 && this.elapsed > 50000) {
      this.eliteTimer = 25000 - this.minute * 2500;
      const [x, y] = this.offScreen();
      this.addEnemy(this.types().b, x, y, true).huntHero = true;
    }
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
    const img = this.add.image(x, y, type.tex).setOrigin(0.5, type.flying ? 0.5 : 0.94).setDepth(y).setAlpha(0).setScale(0.3);
    this.tweens.add({ targets: img, alpha: 1, scale, duration: 350, ease: "Back.out" });
    if (type.flying) this.tweens.add({ targets: img, scaleY: scale * 0.85, duration: 160, yoyo: true, repeat: -1, delay: 350 });
    else this.tweens.add({ targets: img, angle: { from: -5, to: 5 }, duration: 260, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: 350 });
    const hp = Math.round(monsterHp(type.stats.hp, stage, this.minute) * (elite ? ELITE_MULT : 1) * (has("giant") ? 3 : 1));
    // mutated monsters pay a little more
    const bonus = muts.length ? 1 + 0.5 * muts.length : 1;
    const e: Enemy = {
      img, type, hp, maxHp: hp, elite,
      cash: monsterCash(type.stats.cash, stage) * (elite ? 5 : 1) * bonus,
      xp: Math.round((elite ? 8 : type.stats.xp) * bonus),
      dmg: type.stats.dmg * (1 + 0.05 * (stage - 1)) * (1 + 0.2 * this.minute) * (elite ? 1.5 : 1),
      r: (type.boss ? 90 : elite ? 48 : type.flying ? 30 : 34) * (has("giant") ? 1.3 : 1) * size,
      flashUntil: 0, atkTimer: 0, toCrystal: false, huntHero: false, raider: false, attacking: false, phase: "walk", phaseT: 3000, dashX: 0, dashY: 0, shots: 0, tickT: 0,
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
   * 5:00 - every monster runs off, a storm rolls in over the crystal, a claw comes out of
   * the sky and carries the crystal away, then the boss drops down next to you.
   */
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
    const [cx, cy] = this.crystalHome;
    cam.stopFollow();
    cam.pan(cx, cy - 300, 900, "Sine.easeInOut");
    cam.zoomTo(0.72, 900, "Sine.easeInOut");
    this.tweens.add({ targets: this.gloom, fillAlpha: 0.45, duration: 1200 });
    const storm = this.add.image(cx, cy - 1050, "storm").setAlpha(0).setScale(0.6).setDepth(20000);
    this.tweens.add({ targets: storm, alpha: 1, scale: 1.5, duration: 900, delay: 400, ease: "Back.out" });
    this.tweens.add({ targets: storm, x: cx + 30, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: 1300 });
    for (const t of [1000, 1700, 3000]) this.time.delayedCall(t, () => {
      cam.flash(120, 255, 255, 255);
      sfx.thunder();
    });
    const claw = this.add.image(cx, cy - 1500, "sky_claw").setOrigin(0.5, 1).setDepth(19999);
    this.tweens.add({ targets: claw, y: cy - 40, duration: 900, delay: 1400, ease: "Quad.in" });
    this.time.delayedCall(2350, () => {
      claw.setTexture("sky_claw_shut");
      sfx.claw();
      cam.shake(300, 0.01);
      this.tweens.killTweensOf(this.crystal);
      this.crystalSparkle.stop();
      this.tweens.killTweensOf(this.crystalGlow);
      this.tweens.add({ targets: this.crystalGlow, alpha: 0, duration: 400 });
      const lift = cy - 40 - this.crystal.y;
      this.tweens.add({
        targets: claw, y: cy - 2600, duration: 1600, delay: 300, ease: "Sine.in",
        onUpdate: () => this.crystal.setY(claw.y - lift).setDepth(19998),
      });
    });
    this.time.delayedCall(4200, () => {
      this.tweens.add({ targets: storm, alpha: 0, duration: 600, onComplete: () => storm.destroy() });
      this.tweens.add({ targets: this.gloom, fillAlpha: 0.18, duration: 800 });
      claw.destroy();
      this.crystal.setVisible(false);
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
        const boss = this.addEnemy({ tex: def.tex, stats: BOSS, fx: def.color, boss: true, moves: def.moves }, x, y);
        boss.hp = boss.maxHp = Math.round(monsterHp(BOSS.hp, save.stage, MINUTES) * HEALING_BOSS_HP);
        boss.huntHero = true;
        boss.phaseT = 2500;
        this.placeSeals();
        music.play("boss");
        this.game.events.emit("boss-intro", { name: def.name, tex: def.tex, moves: def.moves.map((m) => BOSS_MOVES[m]) });
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
    if (save.stage < MAX_STAGE) save.stage++;
    save.bestStage = Math.max(save.bestStage, save.stage);
    persist();
    this.time.timeScale = 0.35;
    this.tweens.timeScale = 0.35;
    window.setTimeout(() => {
      this.time.timeScale = 1;
      this.tweens.timeScale = 1;
    }, 900);
    music.play("calm");
    // the crystal floats back down from the sky
    const [hx, hy] = this.crystalHome;
    this.rocks.forEach((r) => r.img.destroy());
    this.rocks = [];
    this.tweens.add({ targets: this.gloom, fillAlpha: 0, duration: 1500 });
    this.crystal.setVisible(true).setPosition(hx, hy - 1600).setDepth(hy);
    this.tweens.add({ targets: this.crystal, y: hy, duration: 1600, delay: 600, ease: "Bounce.out" });
    this.time.delayedCall(2300, () => {
      this.crystalSparkle.start();
      this.tweens.add({ targets: this.crystalGlow, alpha: 0.8, duration: 500 });
      this.sparks.setParticleTint(this.land.crystal);
      this.sparks.explode(40, hx, hy - 120);
    });
    battle.bossFight = false;
    this.game.events.emit("stage-clear", { stage: cleared, earned: this.stats.earned, gems, dice: this.stats.dice, final: cleared === MAX_STAGE });
    this.game.events.emit("stage-up");
    this.time.delayedCall(4800, () => {
      this.cameras.main.fadeOut(600, 74, 47, 29);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.restart({}));
    });
  }

  private stageLost(reason: "hero" | "crystal" | "quit"): void {
    if (this.rush) {
      this.rushOver(reason === "quit" ? "quit" : "hero");
      return;
    }
    if (!this.fighting && this.state !== "intro" && this.state !== "cutscene") return;
    if (this.state === "fight" || this.state === "boss") this.reviveState = this.state;
    this.state = "lost";
    battle.mode = "over";
    this.joy = { ...NO_JOY };
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
    this.banner(reason === "hero" ? "YOU FELL!" : reason === "crystal" ? "CRYSTAL BROKE!" : "YOU GAVE UP", "red", 1100);
    if (this.freeRevive && reason !== "quit") {
      this.freeRevive = false;
      this.time.delayedCall(1300, () => {
        this.banner("SECOND CHANCE!", "green", 900);
        this.revive(true);
      });
      return;
    }
    this.time.delayedCall(reason === "quit" ? 300 : 1300, () => {
      const result: StageResult = {
        stage: save.stage, reason, time: this.elapsed, stats: this.stats, canRevive: !this.revived && reason !== "quit", reviveGems: REVIVE_GEMS,
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
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.restart({ autostart: start }));
  }

  // ───────────────────────── loop ─────────────────────────

  update(time: number, delta: number): void {
    if (battle.choosing) return;
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
    const boss = this.enemies.find((e) => e.type.boss);
    battle.bossFrac = boss ? boss.hp / boss.maxHp : -1;

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
    if (this.state === "boss" && !this.rush) this.sealsTick(delta);
    if (this.state === "lobby" && !this.rush) this.roamTick(delta);
    if (fighting) {
      this.ghostSkills(delta);
      this.gadgetsTick(delta);
      this.petAttacks(delta);
      this.crystalShards(delta);
    }
    this.moveRocks(delta);
    this.strikesTick();
    this.moveBullets(delta);
    this.moveGadgets(time, delta);
    this.moveShots(delta);
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
      else if (this.shielded || e.type.boss || heroD <= AGGRO) e.huntHero = true;
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
    const walk = e.type.stats.speed * 1.3;
    switch (e.phase) {
      case "walk": {
        if (e.phaseT > 0) return walk;
        const moves = e.type.moves ?? ["charge", "stomp", "rocks"];
        const far = Math.hypot(this.hero.x - e.img.x, this.hero.y - e.img.y) > 650;
        // stomps and breath only reach you up close
        const ok = moves.filter((m) => !far || (m !== "stomp" && m !== "breath"));
        this.startBossMove(e, ok.length ? ok[Math.floor(Math.random() * ok.length)] : "charge", ux, uy);
        return 0;
      }
      case "windup":
        if (e.phaseT <= 0) {
          e.phase = "dash";
          e.phaseT = 600;
          this.cameras.main.shake(200, 0.006);
        }
        return 0;
      case "dash":
        if (e.phaseT <= 0) this.bossRest(e);
        return 1000;
      case "stomp":
        if (e.phaseT <= 0) {
          this.shockwave(e.img.x, e.img.y, 360, e.dmg * 1.5);
          this.bossRest(e);
        }
        return 0;
      case "throw":
        if (e.phaseT <= 0) {
          const a0 = Math.atan2(this.hero.y - 40 - (e.img.y - 100), this.hero.x - e.img.x);
          for (let k = -2; k <= 2; k++) this.bossShot(e, a0 + k * 0.22, 720, e.dmg * 0.8, "rock_small");
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
          this.addStrike(e.img.x, e.img.y, 240, 650, e.dmg * 1.6);
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
            this.puff.setParticleTint(e.type.fx);
            const a = Math.atan2(e.dashY, e.dashX);
            for (let k = 0; k < 4; k++) {
              const aa = a + (Math.random() - 0.5) * 0.8;
              const r = 120 + Math.random() * 560;
              this.puff.explode(2, e.img.x + Math.cos(aa) * r, e.img.y - 60 + Math.sin(aa) * r);
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
          this.addStrike(this.hero.x + Math.cos(a) * d, this.hero.y + Math.sin(a) * d * 0.7, 150, 800 + k * 120, e.dmg * 1.1, e.type.fx);
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

  /** Is the hero inside the boss's breath cone? */
  private inCone(e: Enemy): boolean {
    const dx = this.hero.x - e.img.x;
    const dy = this.hero.y - 40 - (e.img.y - 60);
    const d = Math.hypot(dx, dy);
    if (d > BREATH_LEN) return false;
    const diff = Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - Math.atan2(e.dashY, e.dashX));
    return Math.abs(diff) < BREATH_HALF;
  }

  /** A shot from the boss (an orb in its colour, or a rock) flying straight. */
  private bossShot(e: Enemy, a: number, speed: number, dmg: number, tex = "b_orb"): void {
    const img = this.add.image(e.img.x, e.img.y - 100, tex).setScale(tex === "b_orb" ? 1.1 : 1.4).setDepth(9000);
    if (tex === "b_orb") img.setTint(e.type.fx);
    this.rocks.push({ img, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 2600, dmg });
  }

  /** A ring blast on the ground: hurts you and your pets inside it. */
  private shockwave(x: number, y: number, r: number, dmg: number): void {
    const hits = dmg > 0;
    const ring = this.add.image(x, y - 20, "ring").setTint(0xffb03b).setScale(0.5, 0.25).setDepth(y + 1);
    this.tweens.add({ targets: ring, scaleX: (r / 360) * 4.6, scaleY: (r / 360) * 2.3, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    this.boom(x, y - 30, (r / 360) * 1.6);
    this.cameras.main.shake(350, 0.014);
    if (!hits) return;
    for (const p of this.pets) if (Math.hypot(p.img.x - x, (p.img.y - y) * 1.4) < r) this.hurtPet(p, dmg);
    if (Math.hypot(this.hero.x - x, (this.hero.y - y) * 1.4) < r) this.hurt(dmg);
  }

  /** A red circle on the ground that blows up after `ms` (with something falling from the sky if `fall` is set). */
  private addStrike(x: number, y: number, r: number, ms: number, dmg: number, fall?: number): void {
    const [sx, sy] = [clampX(x), clampY(y)];
    this.strikes.push({ x: sx, y: sy, r, at: this.time.now + ms, ms, dmg });
    if (fall === undefined) return;
    const img = this.add.image(sx, sy - 1500, "b_orb").setTint(fall).setScale(1.9).setDepth(sy + 5);
    this.tweens.add({ targets: img, y: sy - 40, duration: ms, ease: "Quad.in", onComplete: () => img.destroy() });
  }

  private strikesTick(): void {
    const now = this.time.now;
    this.strikes = this.strikes.filter((s) => {
      if (now < s.at) return true;
      this.shockwave(s.x, s.y, s.r, this.fighting ? s.dmg : 0);
      return false;
    });
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
    e.phaseT = 1600 + Math.random() * 1400;
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
      const t = text(this, boss.img.x + (Math.random() - 0.5) * 120, boss.img.y - boss.img.displayHeight * 0.7, `+${fmt(perSec)}`, 64, "#7af08a").setDepth(9300);
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
    const bolt = this.add.graphics().setDepth(9050);
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

  /** Boss rocks fly straight; dodge them. */
  private moveRocks(delta: number): void {
    const dt = delta / 1000;
    this.rocks = this.rocks.filter((r) => {
      r.img.x += r.vx * dt;
      r.img.y += r.vy * dt;
      r.img.rotation += 6 * dt;
      r.life -= delta;
      const hit = this.fighting && Math.hypot(r.img.x - this.hero.x, r.img.y - (this.hero.y - 60)) < 60;
      if (hit) {
        this.hurt(r.dmg);
        this.puff.setParticleTint(0xa89a8a);
        this.puff.explode(8, r.img.x, r.img.y);
      }
      if (hit || r.life <= 0) {
        r.img.destroy();
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
              const bite = this.add.image(e.img.x, e.img.y - e.img.displayHeight * 0.4, "flash").setTint(color).setDepth(9050).setScale(0.8);
              this.tweens.add({ targets: bite, scale: 1.4, alpha: 0, angle: 45, duration: 180, onComplete: () => bite.destroy() });
              this.hit(e, dmg * 1.3);
            }
          });
          break;
        }
        case "pierce":
          picks.forEach((e) => {
            const a = Math.atan2(e.img.y - e.img.displayHeight * 0.4 - sy, e.img.x - sx);
            const img = this.add.image(sx, sy, "icon_star").setScale(0.42).setTint(color).setDepth(9000);
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
    const img = this.add.image(x, y, tex).setScale(scale).setDepth(9000).setTint(color);
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

  private boom(x: number, y: number, scale: number): void {
    sfx.boom();
    const b = this.add.image(x, y, "boom").setDepth(8990).setScale(scale * 0.3).setAngle(Phaser.Math.Between(0, 360));
    this.tweens.add({ targets: b, scale, duration: 140, ease: "Quad.out" });
    this.tweens.add({ targets: b, alpha: 0, delay: 120, duration: 260, onComplete: () => b.destroy() });
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
      if (crit) this.boom(e.img.x, hy + 30, 0.55);
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

  private damageNumber(x: number, y: number, amount: number, crit: boolean): void {
    const t = this.dmgTexts.find((d) => !d.visible);
    if (!t) return;
    t.setText(crit ? `${fmt(amount)}!` : fmt(amount)).setColor(crit ? "#ff5a5a" : "#ffffff").setPosition(x + Phaser.Math.Between(-30, 30), y).setVisible(true).setAlpha(1).setScale(0.5);
    this.tweens.add({ targets: t, scale: crit ? 1.5 : 1, duration: 120, ease: "Back.out" });
    this.tweens.add({ targets: t, y: y - 110, alpha: 0, delay: 300, duration: 450, onComplete: () => t.setVisible(false) });
  }

  /** `sweep`: cleared away at the end of a stage (no rewards). */
  private kill(e: Enemy, sweep = false): void {
    this.enemies = this.enemies.filter((o) => o !== e);
    e.aura?.destroy();
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
    this.tweens.killTweensOf(e.img);
    this.tweens.add({ targets: e.img, scale: e.type.boss ? 1.6 : 0, alpha: 0, angle: 30, duration: e.type.boss ? 500 : 160, onComplete: () => e.img.destroy() });
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
      else this.stageWon();
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
    for (const e of this.enemies) {
      const blink = time % 200 < 100 ? 0.55 : 0.3;
      if (e.phase === "windup") {
        // a trail of red marks where the boss will charge
        for (let d = 120; d <= 700; d += 75) {
          this.fx.fillStyle(0xff3a3a, blink).fillEllipse(e.img.x + e.dashX * d, e.img.y + e.dashY * d, 70, 32);
        }
      } else if (e.phase === "breath") {
        const a = Math.atan2(e.dashY, e.dashX);
        const [ox, oy] = [e.img.x, e.img.y - 60];
        const firing = e.phaseT < 700;
        this.fx.fillStyle(firing ? 0xffa03a : 0xff3a3a, firing ? 0.4 : blink * 0.7).fillTriangle(
          ox, oy, ox + Math.cos(a - BREATH_HALF) * BREATH_LEN, oy + Math.sin(a - BREATH_HALF) * BREATH_LEN,
          ox + Math.cos(a + BREATH_HALF) * BREATH_LEN, oy + Math.sin(a + BREATH_HALF) * BREATH_LEN,
        );
      } else if (e.phase === "burrow") {
        this.fx.fillStyle(0x8a6a3a, 0.85).fillEllipse(e.img.x, e.img.y, 150, 56);
        this.fx.fillStyle(0xc8a878, 0.9).fillEllipse(e.img.x, e.img.y - 8, 100, 34);
      } else if (e.phase === "stomp") {
        const f = 1 - Math.max(0, e.phaseT) / 950;
        this.fx.fillStyle(0xff3a3a, 0.15 + f * 0.25).fillEllipse(e.img.x, e.img.y, 720 * f, 504 * f);
        this.fx.lineStyle(8, 0xff3a3a, blink).strokeEllipse(e.img.x, e.img.y, 720, 504);
      }
    }
    for (const st of this.strikes) {
      const f = Phaser.Math.Clamp(1 - (st.at - time) / st.ms, 0, 1);
      const blink = time % 200 < 100 ? 0.75 : 0.4;
      this.fx.fillStyle(0xff3a3a, 0.1 + f * 0.3).fillEllipse(st.x, st.y, st.r * 2 * f, (st.r * 2 * f) / 1.4);
      this.fx.lineStyle(8, 0xff3a3a, blink).strokeEllipse(st.x, st.y, st.r * 2, (st.r * 2) / 1.4);
    }
    this.bars.clear();
    for (const e of this.enemies) {
      // only bosses and elites get bars (a horde of bars is just noise)
      if (!e.type.boss && !e.elite) continue;
      const w = e.type.boss ? 300 : e.elite ? 170 : 120;
      const y = e.img.y - e.img.displayHeight * (e.type.flying ? 0.5 : 0.95) - 24;
      drawBar(this.bars, e.img.x - w / 2, y, w, e.type.boss ? 30 : 18, e.hp / e.maxHp, e.type.boss || e.elite ? 0xf26464 : 0x7ad651);
    }
    for (const p of this.pets) {
      drawBar(this.bars, p.img.x - 55, p.img.y - 128, 110, 12, p.hp / p.maxHp, p.down > 0 ? 0x9a9aa8 : p.hp / p.maxHp > 0.35 ? 0x7ad651 : 0xf26464);
    }
    if (battle.mode === "lobby") return;
    if (this.lv("haunt") && this.fighting) {
      const r = this.hauntR();
      this.fx.fillStyle(0xb98aff, 0.08 + Math.sin(this.time.now / 300) * 0.03).fillEllipse(this.hero.x, this.hero.y, r * 2, r * 1.4);
      this.fx.lineStyle(5, 0xd8b8ff, 0.4).strokeEllipse(this.hero.x, this.hero.y, r * 2, r * 1.4);
    }
    // your health (and reload) under your feet, the crystal's health above it
    const hf = this.heroHp / this.heroMax;
    drawBar(this.bars, this.hero.x - 80, this.hero.y + 16, 160, 20, hf, hf > 0.35 ? 0x7ad651 : 0xf26464);
    if (battle.bossFight) return;
    const [hx, hy] = this.arena.center;
    const f = this.crystalHp / this.crystalMax;
    drawBar(this.bars, hx - 150, hy - 330, 300, 30, f, this.shielded ? 0x9ae6ff : f > 0.4 ? 0x67c3ff : 0xf26464);
  }

  /** Minimap, plus arrows to the crystal (when attacked), airdrops, chests, rare dice and the boss; drawn by the UI scene. */
  drawOverlay(g: Phaser.GameObjects.Graphics, mx: number, my: number, size: number, top: number, bottom: number): void {
    g.clear();
    const s = size / ARENA;
    g.lineStyle(6, INK_N, 1).strokeRoundedRect(mx - 3, my - 3, size + 6, size + 6, 12);
    const [hx, hy] = this.arena.center;
    g.fillStyle(this.shielded ? 0x9ae6ff : this.land.crystal, 1).fillCircle(mx + hx * s, my + hy * s, 7);
    g.lineStyle(2, 0xffffff, 1).strokeCircle(mx + hx * s, my + hy * s, this.shielded ? 11 : 7);
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
    if (this.state === "boss") for (const sl of this.seals) if (!sl.done) arrow(sl.x, sl.y, 0xd8b8ff);
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
