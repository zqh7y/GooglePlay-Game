import Phaser from "phaser";
import { HERO_HAND } from "../art/characters";
import { INK_N } from "../art/draw";
import { GROUND_SCALE, PATCH_R, makeGround } from "../art/ground";
import { makeGunTextures } from "../art/guns";
import { petTexture } from "../art/pets";
import { makePickupTextures } from "../art/pickups";
import { crystalKey, makeWorldTextures } from "../art/world";
import {
  AIRDROP_FIRST_MS, AIRDROP_MS, BOSS, CRYSTAL_DIE_MS, CRYSTAL_HP, CRYSTAL_SPAWN_SHARE, ELITE_MULT, FLYER, HERO_BASE_DMG, HERO_HP, HERO_TEAM_SHARE,
  MAX_MONSTERS, MAX_STAGE, MINUTES, MonsterStats, SHIELD_MS, STAGE_MS, WALKER_A, WALKER_B, monsterCash, monsterHp, spawnGap, xpFor,
} from "../data/balance";
import { GunDef, STARTER_GUN, gunDps, gunKey, gunsOfTier } from "../data/guns";
import { ITEMS, ItemDef, levelMult } from "../data/items";
import { REGIONS, Region, regionForStage } from "../data/regions";
import { SKILL_BY_ID, SkillId, skillChoices } from "../data/skills";
import { DICE_TIERS, TIER_INFO, Tier, rollDiceTier, rollGunTier, tierIndex } from "../data/tiers";
import { ARENA, Arena, clampX, clampY, getArena } from "../game/arena";
import { GAME_W, Layout, layoutFor } from "../layout";
import { questEvent } from "../systems/goals";
import { persist, save } from "../systems/save";
import { buzz, music, sfx } from "../systems/sound";
import {
  cashMult, chestMult, critChance, critDamage, dmgMult, gemsPerBoss, heroDmgMult, moveSpeedMult, petSlots, rangeMult, villageHpMult,
} from "../systems/stats";
import { RARITY_INFO, rarityRank } from "../data/rarity";
import { fmt, oneIn } from "../ui/format";
import { drawBar, text } from "../ui/widgets";

/** The camera shows 1.66x more of the field during a fight (a bit closer in the lobby). */
const ZOOM = 1 / 1.66;
const LOBBY_ZOOM = 0.85;
const HERO_SPEED = 390;
/** Pets run after monsters this far from you, and come back if you get farther away. */
const PET_LEASH = 1000;
const PET_SPEED = 520;
const HERO_R = 40;
const PICK_R = 150;
/** While the crystal is open, monsters this close to you go for you instead. */
const AGGRO = 420;
const REVIVE_GEMS = 5;

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
  combo: 0,
  /** a level-up skill choice is open */
  choosing: false,
  shielded: false,
  /** ms until the shield goes up or down */
  shieldLeft: SHIELD_MS,
  gun: STARTER_GUN as GunDef,
  ammo: 0,
  mag: 0,
  /** reload progress 0..1, or -1 when not reloading */
  reload: -1,
  skills: {} as Partial<Record<SkillId, number>>,
  stats: freshStats(),
  /** the boss has taken the crystal: it is just you, your pets and the boss */
  bossFight: false,
};

export interface StageResult {
  stage: number;
  reason: "hero" | "crystal" | "quit";
  time: number;
  stats: RunStats;
  canRevive: boolean;
  reviveGems: number;
}

export interface GunFound {
  gun: GunDef;
  equipped: boolean;
  scrap: number;
}

interface EnemyType {
  tex: string;
  stats: MonsterStats;
  flying?: boolean;
  boss?: boolean;
  fx: number;
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
  attacking: boolean;
  /** boss moves: walk, wind up a charge and dash, stomp, throw rocks */
  phase: "walk" | "windup" | "dash" | "stomp" | "throw";
  phaseT: number;
  dashX: number;
  dashY: number;
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

/** Gun bullets fly straight and hit whatever they touch. */
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
}

/** Rocks the boss throws at you. */
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
  gun?: GunDef;
  /** airdrops can be opened once they have landed */
  ready: boolean;
  extra: Phaser.GameObjects.GameObject[];
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
  private gunImg!: Phaser.GameObjects.Image;
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
  private skills: Partial<Record<SkillId, number>> = {};
  private revived = false;
  private reviveState: "fight" | "boss" = "fight";
  private stats = freshStats();
  private frozenUntil = 0;
  private warnedAt = 0;

  private gun: GunDef = STARTER_GUN;
  private ammo = 0;
  private fireTimer = 0;
  private reloadLeft = 0;
  private reloadTotal = 1;
  private idleGun = 0;

  private pets: Pet[] = [];
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private bullets: Bullet[] = [];
  private rocks: Rock[] = [];
  private pickups: Pickup[] = [];
  private food: Food[] = [];
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
  private combo = 0;
  private comboTimer = 0;
  private comboText!: Phaser.GameObjects.Text;

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

  create(data: { autostart?: boolean }): void {
    this.L = layoutFor(this.scale.height);
    makeWorldTextures(this, REGIONS);
    makePickupTextures(this);
    makeGunTextures(this);
    this.land = regionForStage(save.stage);
    this.arena = getArena(this.land.id);
    Object.assign(this, {
      pets: [], enemies: [], shots: [], bullets: [], rocks: [], pickups: [], food: [], dmgTexts: [], cashTexts: [],
      state: "lobby", elapsed: 0, minute: 0, shielded: false, hurtAt: 0, stillFor: 0, level: 1, xp: 0, pendingLevels: 0, skills: {},
      revived: false, stats: freshStats(), frozenUntil: 0, warnedAt: 0, gun: STARTER_GUN, fireTimer: 0, reloadLeft: 0, idleGun: 0,
      spawnTimer: 0, eliteTimer: 25000, chestTimer: 50000 + Math.random() * 20000, dropTimer: AIRDROP_FIRST_MS, shardTimer: 0, crystalDieAt: CRYSTAL_DIE_MS,
      combo: 0, comboTimer: 0, buckets: new Map(), shown: new Set(), grid: new Map(),
    });
    this.joy = { ...NO_JOY };
    this.heroMax = HERO_HP * villageHpMult();
    this.heroHp = this.heroMax;
    this.crystalMax = CRYSTAL_HP * villageHpMult();
    this.crystalHp = this.crystalMax;
    this.ammo = this.magSize();
    Object.assign(battle, {
      mode: "lobby", time: 0, bossFrac: -1, crystal: 1, hp: 1, level: 1, xp: 0, dps: 0, combo: 0, choosing: false,
      shielded: false, shieldLeft: SHIELD_MS, gun: this.gun, ammo: this.ammo, mag: this.ammo, reload: -1, skills: this.skills, stats: this.stats,
      bossFight: false,
    });
    this.cameras.main.fadeIn(500, 74, 47, 29);
    this.drawArena();

    const [cx, cy] = this.arena.center;
    this.hero = this.add.image(cx, cy + 260, "hero").setOrigin(0.5, 0.95);
    this.gunImg = this.add.image(0, 0, gunKey(this.gun.id));
    this.setGun(this.gun);
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
    for (let i = 0; i < 70; i++) this.dmgTexts.push(text(this, 0, 0, "", 66).setDepth(9300).setVisible(false));
    for (let i = 0; i < 24; i++) {
      this.cashTexts.push(this.add.container(0, 0, [
        this.add.image(-10, 0, "icon_cash").setScale(0.66).setOrigin(1, 0.5),
        text(this, 0, 0, "", 62, "#8af06a").setOrigin(0, 0.5),
      ]).setDepth(9350).setVisible(false));
    }
    this.comboText = text(this, 0, 0, "", 74, "#ffe066").setDepth(9400).setVisible(false);

    this.buildPets();
    this.setupControls();
    const on: [string, (...a: never[]) => void][] = [
      ["pets-changed", this.buildPets],
      ["battle-start", this.begin],
      ["skill-picked", this.onSkillPicked],
      ["revive", this.revive],
      ["retry", this.retry],
      ["give-up", this.giveUp],
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
    if (idx > save.regionShown) {
      save.regionShown = idx;
      persist();
      this.time.delayedCall(500, () => {
        sfx.fanfare();
        buzz(120);
        this.game.events.emit("land-unlocked", this.land.name);
      });
    }
    if (data?.autostart) this.time.delayedCall(350, () => this.begin());
  }

  /** Keep the hero in the middle of the open part of the screen at any zoom. */
  private followOffset(): void {
    const cam = this.cameras.main;
    const bottom = battle.mode === "lobby" ? this.L.navTop - 420 : this.scale.height;
    const mid = (this.L.hudBottom + bottom) / 2;
    cam.setFollowOffset(0, (mid - this.scale.height / 2) / cam.zoom);
  }

  /** The BATTLE button: the run starts. */
  private begin(): void {
    if (this.state !== "lobby") return;
    this.state = "intro";
    battle.mode = "run";
    this.cameras.main.zoomTo(ZOOM, 900, "Sine.easeInOut");
    this.placePickups();
    sfx.alarm();
    this.banner(`STAGE ${save.stage}`, "peach", 900);
    this.time.delayedCall(1500, () => {
      this.banner("SURVIVE 5:00!", "red", 900);
      this.state = "fight";
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
      if (near && p.ready && this.fighting) {
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

  /** A gun crate parachutes down near you. The longer you survive, the better the gun inside. */
  private airdrop(): void {
    const tier = rollGunTier(this.elapsed / 60000, this.lv("luck"));
    const options = gunsOfTier(tier);
    const gun = options[Math.floor(Math.random() * options.length)];
    const [x, y] = this.randomSpot(500, 1200, [this.hero.x, this.hero.y]);
    const p = this.addPickup("airdrop", x, y, 60000);
    p.tier = tier;
    p.gun = gun;
    p.ready = false;
    const color = TIER_INFO[tier].color;
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
        // a light beam in the gun's tier colour, so you know what is waiting
        const beam = this.add.rectangle(x, y - 320, 56, 640, color, 0.35).setDepth(y - 2);
        this.tweens.add({ targets: beam, alpha: 0.12, duration: 500, yoyo: true, repeat: -1 });
        p.extra.push(beam);
      },
    });
    this.banner("AIRDROP!", "gold", 900);
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
        this.toast("Skill orb! Pick a free skill", "#ffe066");
        this.pendingLevels++;
        this.offerSkill();
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

  /** Better guns are equipped right away; worse ones are scrapped for money and XP. */
  private openAirdrop(p: Pickup): void {
    const gun = p.gun!;
    this.stats.airdrops++;
    const better = tierIndex(gun.tier) > tierIndex(this.gun.tier) || (gun.tier === this.gun.tier && gunDps(gun) > gunDps(this.gun));
    let scrap = 0;
    if (better) {
      this.setGun(gun);
    } else {
      scrap = monsterCash(25, save.stage) * (1 + tierIndex(gun.tier)) * cashMult();
      save.cash += scrap;
      this.stats.earned += scrap;
      this.gainXp(4);
    }
    const rank = tierIndex(gun.tier);
    if (rank >= 3) {
      this.cameras.main.flash(250, 255, 245, 220);
      buzz(120);
    }
    sfx.reveal(Math.min(8, Math.round(rank * 1.4)));
    this.puff.setParticleTint(TIER_INFO[gun.tier].color);
    this.puff.explode(24, p.x, p.y - 50);
    this.tweens.add({ targets: p.img, scaleX: 1.3, scaleY: 0.7, alpha: 0, duration: 260, onComplete: () => p.img.destroy() });
    const found: GunFound = { gun, equipped: better, scrap };
    this.game.events.emit("gun-found", found);
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
    if (this.pendingLevels) this.offerSkill();
  }

  private offerSkill(): void {
    if (battle.choosing || !this.fighting || !this.pendingLevels) return;
    const choices = skillChoices(this.skills);
    if (!choices.length) {
      this.pendingLevels = 0;
      this.heal(0.2);
      return;
    }
    battle.choosing = true;
    this.joy = { ...NO_JOY };
    sfx.levelUp();
    buzz(40);
    this.game.events.emit("skill-choice", { choices, levels: { ...this.skills }, level: this.level });
    this.scene.pause();
  }

  private onSkillPicked(id: SkillId): void {
    if (!battle.choosing) return;
    battle.choosing = false;
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
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
    if (id === "mag") this.ammo = Math.min(this.magSize(), this.ammo + Math.round(this.gun.mag * 0.4));
    if (id === "pack") this.pets.forEach((p) => (p.timer = 0));
    this.sparks.setParticleTint(SKILL_BY_ID[id].color);
    this.sparks.explode(24, this.hero.x, this.hero.y - 80);
    this.game.events.emit("skills-changed");
    if (this.pendingLevels > 0) this.time.delayedCall(300, () => this.offerSkill());
  }

  private lv(id: SkillId): number {
    return this.skills[id] ?? 0;
  }

  private magnetMult(): number {
    return 1 + 0.5 * this.lv("magnet");
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
    const dmg = this.bulletDamage() * (0.8 + 0.3 * lv);
    targets.forEach((t, i) => this.time.delayedCall(i * 70, () => this.fire(cx, cy - 160, t, dmg, "shard", this.land.crystal, 0, 1.1, 1500)));
  }

  // ───────────────────────── guns ─────────────────────────

  private setGun(gun: GunDef): void {
    this.gun = gun;
    battle.gun = gun;
    this.gunImg.setTexture(gunKey(gun.id)).setOrigin(gun.grip[0] / gun.w, gun.grip[1] / gun.h).setScale(gun.hold);
    this.ammo = this.magSize();
    this.reloadLeft = 0;
    this.fireTimer = 200;
  }

  private magSize(): number {
    return Math.round(this.gun.mag * (1 + 0.4 * this.lv("mag")));
  }

  private reloadMs(): number {
    return this.gun.reloadMs * 0.8 ** this.lv("reload");
  }

  private fireMs(): number {
    return this.gun.fireMs / (1 + 0.15 * this.lv("firerate")) / (this.fortified ? 1 + 0.1 * this.lv("fort") : 1);
  }

  private gunRange(): number {
    return this.gun.range * rangeMult() * (1 + 0.2 * this.lv("range"));
  }

  private bulletDamage(): number {
    return this.heroDamage() * this.gun.dmg;
  }

  /** Where bullets leave the barrel right now. */
  private muzzle(): [number, number] {
    const g = this.gun;
    const flip = this.gunImg.flipY ? -1 : 1;
    const dx = (g.muzzle[0] - g.grip[0]) * g.hold;
    const dy = (g.muzzle[1] - g.grip[1]) * g.hold * flip;
    const r = this.gunImg.rotation;
    return [this.gunImg.x + dx * Math.cos(r) - dy * Math.sin(r), this.gunImg.y + dx * Math.sin(r) + dy * Math.cos(r)];
  }

  private startReload(): void {
    if (this.reloadLeft > 0) return;
    this.reloadTotal = this.reloadMs();
    this.reloadLeft = this.reloadTotal;
    sfx.reload();
  }

  /** Aim at the closest monster and fire; reload when the magazine runs dry. */
  private heroAttack(delta: number): void {
    const target = this.nearestEnemies(this.hero.x, this.hero.y, this.gunRange(), 1)[0];
    const aim = target
      ? Math.atan2(target.img.y - target.img.displayHeight * 0.4 - this.gunImg.y, target.img.x - this.gunImg.x)
      : this.hero.flipX ? Math.PI : 0;
    this.gunImg.setRotation(Phaser.Math.Angle.RotateTo(this.gunImg.rotation, aim, target ? 0.35 : 0.15));
    this.gunImg.setFlipY(Math.abs(this.gunImg.rotation) > Math.PI / 2);
    this.fireTimer -= delta;
    if (this.reloadLeft > 0) {
      this.reloadLeft -= delta;
      if (this.reloadLeft <= 0) {
        this.ammo = this.magSize();
        sfx.click();
      }
      return;
    }
    if (!target) {
      // nothing to shoot: top up the magazine
      this.idleGun += delta;
      if (this.idleGun > 1200 && this.ammo < this.magSize()) this.startReload();
      return;
    }
    this.idleGun = 0;
    if (this.fireTimer > 0) return;
    this.fireTimer = this.fireMs();
    const g = this.gun;
    const [mx, my] = this.muzzle();
    const dmg = this.bulletDamage();
    const boom = this.lv("boom");
    for (let i = 0; i < g.pellets; i++) {
      const a = this.gunImg.rotation + (Math.random() - 0.5) * 2 * g.spread;
      const img = this.add.image(mx, my, `ammo_${g.ammo}`).setRotation(a).setDepth(9000).setScale(g.dmg >= 5 ? 1.5 : 1.2);
      if (g.tints) img.setTint(g.tints[Math.floor(Math.random() * g.tints.length)]);
      const speed = g.speed * (0.92 + Math.random() * 0.16);
      this.bullets.push({
        img, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: (this.gunRange() / speed) * 1000, dmg, pierce: g.pierce + 1,
        explode: g.explode + (boom ? 60 + 20 * boom : 0), splash: g.explode ? 1 : boom ? 0.35 + 0.1 * boom : 0, hit: [], spin: g.spin ?? 0, burst: g.id === "launcher",
      });
    }
    this.stats.shots++;
    this.ammo--;
    sfx.shoot(g.dmg * g.pellets >= 5);
    // recoil and a muzzle flash
    this.gunImg.x -= Math.cos(this.gunImg.rotation) * (4 + Math.min(10, g.dmg));
    const flash = this.add.image(mx, my, "flash").setDepth(9050).setScale(0.45 + Math.min(0.6, g.dmg * 0.05)).setTint(g.color);
    this.tweens.add({ targets: flash, scale: flash.scale * 1.8, alpha: 0, duration: 90, onComplete: () => flash.destroy() });
    if (this.ammo <= 0) this.startReload();
  }

  private moveBullets(delta: number): void {
    const dt = delta / 1000;
    const G = 90;
    this.bullets = this.bullets.filter((b) => {
      b.img.x += b.vx * dt;
      b.img.y += b.vy * dt;
      if (b.spin) b.img.rotation += b.spin * dt;
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
      if (this.joy.active || battle.mode !== "run" || !this.cameras.main.visible || p.y < this.L.hudBottom + 10) return;
      if (p.x < 220 && p.y < this.L.hudBottom + 230) return;
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
    const k = this.keys;
    let vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (this.joy.active && Math.hypot(this.joy.dx, this.joy.dy) > 8) {
      vx = this.joy.dx / 90;
      vy = this.joy.dy / 90;
    }
    if (!this.fighting) vx = vy = 0;
    const len = Math.hypot(vx, vy);
    if (len > 1) {
      vx /= len;
      vy /= len;
    }
    if (len > 0.05) {
      this.stillFor = 0;
      const step = (HERO_SPEED * moveSpeedMult() * (1 + 0.12 * this.lv("speed")) * delta) / 1000;
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
    // recoil springs back
    this.gunImg.setPosition(this.gunImg.x + (gx - this.gunImg.x) * 0.4, gy).setDepth(this.hero.y + 1);
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
      const odds = text(this, img.x, img.y, `${def.name}  ${oneIn(def.oneIn)}`, 30, RARITY_INFO[def.rarity].css).setDepth(9200);
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
    return dmgMult() * (1 + buff);
  }

  private heroDamage(): number {
    const team = this.pets.filter((p) => p.def.kind !== "buff").reduce((s, p) => s + this.petDamage(p), 0);
    return (HERO_BASE_DMG + team * HERO_TEAM_SHARE) * this.damageMult() * heroDmgMult() * (1 + 0.3 * this.lv("damage"));
  }

  // ───────────────────────── the stage clock ─────────────────────────

  private tick(delta: number): void {
    if (!this.fighting) return;
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
        const atCrystal = !this.shielded && this.elapsed > 8000 && Math.random() < CRYSTAL_SPAWN_SHARE;
        const [x, y] = atCrystal ? this.randomSpot(1600, 2500) : this.offScreen();
        this.addEnemy(this.pickType(), x, y).huntHero = !atCrystal;
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

  private addEnemy(type: EnemyType, x: number, y: number, elite = false): Enemy {
    const stage = save.stage;
    const scale = type.boss ? 1.3 : elite ? 1.45 : 1;
    const img = this.add.image(x, y, type.tex).setOrigin(0.5, type.flying ? 0.5 : 0.94).setDepth(y).setAlpha(0).setScale(0.3);
    this.tweens.add({ targets: img, alpha: 1, scale, duration: 350, ease: "Back.out" });
    if (type.flying) this.tweens.add({ targets: img, scaleY: scale * 0.85, duration: 160, yoyo: true, repeat: -1, delay: 350 });
    else this.tweens.add({ targets: img, angle: { from: -5, to: 5 }, duration: 260, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: 350 });
    const hp = Math.round(monsterHp(type.stats.hp, stage, this.minute) * (elite ? ELITE_MULT : 1));
    const e: Enemy = {
      img, type, hp, maxHp: hp, elite,
      cash: monsterCash(type.stats.cash, stage) * (elite ? 5 : 1),
      xp: elite ? 8 : type.stats.xp,
      dmg: type.stats.dmg * (1 + 0.05 * (stage - 1)) * (1 + 0.2 * this.minute) * (elite ? 1.5 : 1),
      r: type.boss ? 90 : elite ? 48 : type.flying ? 30 : 34,
      flashUntil: 0, atkTimer: 0, toCrystal: false, huntHero: false, attacking: false, phase: "walk", phaseT: 3000, dashX: 0, dashY: 0,
    };
    if (elite) {
      e.aura = this.add.image(x, y, "glow").setTint(0xff4a4a).setScale(1.3, 0.6).setAlpha(0.7).setDepth(y - 1);
      this.tweens.add({ targets: e.aura, alpha: 0.35, duration: 400, yoyo: true, repeat: -1 });
    }
    this.enemies.push(e);
    return e;
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
    const faller = this.add.image(x, y - 1400, this.land.boss).setOrigin(0.5, 0.94).setScale(1.3).setDepth(y);
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
        const boss = this.addEnemy({ tex: this.land.boss, stats: BOSS, fx: 0xffb03b, boss: true }, x, y);
        boss.hp = boss.maxHp = Math.round(monsterHp(BOSS.hp, save.stage, MINUTES));
        boss.huntHero = true;
        boss.phaseT = 2500;
        music.play("boss");
        this.game.events.emit("boss-intro", { name: this.land.bossName, tex: this.land.boss });
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

  /** Spend gems to get back up once per stage: full health and a blast that clears the area. */
  private revive(): void {
    if (this.state !== "lost" || this.revived || save.gems < REVIVE_GEMS) return;
    save.gems -= REVIVE_GEMS;
    persist();
    this.revived = true;
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
    this.banner("REVIVED!", "green", 900);
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
      // slowly heal between hits; the crystal regrows a little (more with Crystal Mend)
      if (time - this.hurtAt > 3000) this.heroHp = Math.min(this.heroMax, this.heroHp + this.heroMax * 0.01 * (delta / 1000));
      this.crystalHp = Math.min(this.crystalMax, this.crystalHp + this.crystalMax * (0.003 + 0.008 * this.lv("mend")) * (delta / 1000));
    }
    battle.hp = this.heroHp / this.heroMax;
    battle.crystal = this.crystalHp / this.crystalMax;
    battle.ammo = this.ammo;
    battle.mag = this.magSize();
    battle.reload = this.reloadLeft > 0 ? 1 - this.reloadLeft / this.reloadTotal : -1;
    const boss = this.enemies.find((e) => e.type.boss);
    battle.bossFrac = boss ? boss.hp / boss.maxHp : -1;

    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.combo = battle.combo = 0;
        this.comboText.setVisible(false);
      }
    }
    this.comboText.setPosition(this.hero.x, this.hero.y - 260);

    this.moveEnemies(time, delta);
    if (fighting) {
      this.heroAttack(delta);
      this.petAttacks(delta);
      this.crystalShards(delta);
    }
    this.moveRocks(delta);
    this.moveBullets(delta);
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
      if (frozen || !fighting) continue;
      const heroD = Math.hypot(this.hero.x - e.img.x, this.hero.y - e.img.y);
      if (this.shielded || e.type.boss || heroD <= AGGRO) e.huntHero = true;
      e.toCrystal = !e.huntHero;
      if (!e.toCrystal) e.attacking = false;
      const tx = e.toCrystal ? cx : this.hero.x;
      const ty = e.toCrystal ? cy + 40 : this.hero.y;
      const dx = tx - e.img.x;
      const dy = ty - e.img.y;
      const d = Math.hypot(dx, dy) || 1;
      const stop = e.toCrystal ? 200 : HERO_R + e.r - 10;
      let speed = e.type.stats.speed;
      if (e.type.boss) speed = this.bossMove(e, delta, dx / d, dy / d);
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
      if (heroD < HERO_R + e.r + 10 && e.atkTimer <= 0) {
        e.atkTimer = 800;
        this.hurt(e.dmg * hurtMult);
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
   * The boss walks at you and every few seconds does one of three moves, each shown before
   * it lands: a charge (red marks on the ground), a stomp (a red circle) or a volley of rocks.
   */
  private bossMove(e: Enemy, delta: number, ux: number, uy: number): number {
    e.phaseT -= delta;
    if (this.state !== "boss") return 0;
    switch (e.phase) {
      case "walk": {
        if (e.phaseT > 0) return e.type.stats.speed * 1.3;
        const d = Math.hypot(this.hero.x - e.img.x, this.hero.y - e.img.y);
        const r = Math.random();
        if (r < 0.35 && d < 650) {
          e.phase = "stomp";
          e.phaseT = 950;
          this.tweens.add({ targets: e.img, scaleY: 1.1, scaleX: 1.45, duration: 300, yoyo: true, repeat: 1 });
        } else if (r < 0.7) {
          e.phase = "windup";
          e.phaseT = 750;
          e.dashX = ux;
          e.dashY = uy;
          this.tweens.add({ targets: e.img, scaleX: 1.45, scaleY: 1.1, duration: 140, yoyo: true, repeat: 2 });
        } else {
          e.phase = "throw";
          e.phaseT = 550;
          this.tweens.add({ targets: e.img, angle: -12, duration: 250, yoyo: true });
        }
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
          // shockwave
          const ring = this.add.image(e.img.x, e.img.y - 20, "ring").setTint(0xffb03b).setScale(0.5, 0.25).setDepth(e.img.y + 1);
          this.tweens.add({ targets: ring, scaleX: 4.6, scaleY: 2.3, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
          this.boom(e.img.x, e.img.y - 30, 1.6);
          this.cameras.main.shake(350, 0.014);
          for (const p of this.pets) if (Math.hypot(p.img.x - e.img.x, (p.img.y - e.img.y) * 1.4) < 360) this.hurtPet(p, e.dmg * 1.5);
          if (Math.hypot(this.hero.x - e.img.x, (this.hero.y - e.img.y) * 1.4) < 360) this.hurt(e.dmg * 1.5);
          this.bossRest(e);
        }
        return 0;
      case "throw":
        if (e.phaseT <= 0) {
          const a0 = Math.atan2(this.hero.y - 40 - (e.img.y - 100), this.hero.x - e.img.x);
          for (let k = -2; k <= 2; k++) {
            const a = a0 + k * 0.22;
            const img = this.add.image(e.img.x, e.img.y - 100, "rock_small").setScale(1.4).setDepth(9000);
            this.rocks.push({ img, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, life: 2200, dmg: e.dmg * 0.8 });
          }
          sfx.boom();
          this.bossRest(e);
        }
        return 0;
    }
    return 0;
  }

  private bossRest(e: Enemy): void {
    e.phase = "walk";
    e.phaseT = 1600 + Math.random() * 1400;
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
    const speed = 1 + 0.2 * this.lv("pack");
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
    if (!this.enemies.includes(e)) return;
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
    if (e.hp <= 0) this.kill(e);
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
    const cy = e.img.y - e.img.displayHeight * 0.4;
    this.puff.setParticleTint(e.type.fx);
    this.puff.explode(e.type.boss ? 60 : sweep ? 6 : 14, e.img.x, cy);
    this.tweens.killTweensOf(e.img);
    this.tweens.add({ targets: e.img, scale: e.type.boss ? 1.6 : 0, alpha: 0, angle: 30, duration: e.type.boss ? 500 : 160, onComplete: () => e.img.destroy() });
    if (sweep) return;
    this.stats.kills++;
    save.totalKills++;
    this.combo++;
    battle.combo = this.combo;
    this.comboTimer = 2200;
    if (this.combo >= 10 && this.combo % 5 === 0) {
      const c = this.combo;
      this.comboText.setText(`x${c} COMBO!`).setColor(c >= 100 ? "#ff6a8a" : c >= 40 ? "#ffb347" : "#ffe066").setVisible(true).setScale(1.35);
      this.tweens.add({ targets: this.comboText, scale: 1, duration: 150 });
      if (c % 25 === 0) sfx.lucky();
    }
    this.boom(e.img.x, cy, e.type.boss ? 2.4 : e.elite ? 1.2 : 0.7);
    // combos pay up to +100% extra
    const cash = e.cash * cashMult() * (1 + Math.min(this.combo, 100) * 0.01);
    save.cash += cash;
    this.earnedWindow += cash;
    this.stats.earned += cash;
    questEvent("kill");
    if (e.type.boss) questEvent("boss");
    if (this.combo >= 5) questEvent("combo", this.combo);
    this.game.events.emit("kill", e.type.boss);
    if (e.elite || e.type.boss || Math.random() < 0.05) this.cashPop(e.img.x, cy - 40, cash);
    this.flyCash(e.img.x, cy, e.type.boss ? 14 : e.elite ? 4 : Math.random() < 0.1 ? 1 : 0);
    if (!e.type.boss) this.dropFood(e.img.x, e.img.y - 20, e.xp);
    // lucky drops
    if (e.elite) this.addDie(rollDiceTier(save.stage), e.img.x, e.img.y, 30000);
    else if (Math.random() < 0.0015) this.addDie(rollDiceTier(save.stage), e.img.x, e.img.y, 30000);
    else if (Math.random() < 0.0015) this.addPickup(POWERUPS[Math.floor(Math.random() * POWERUPS.length)], e.img.x, e.img.y, 30000);
    if (e.type.boss) {
      this.cameras.main.shake(500, 0.014);
      this.cameras.main.flash(200, 255, 240, 200);
      buzz(200);
      this.stageWon();
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
    for (const e of this.enemies) {
      const blink = time % 200 < 100 ? 0.55 : 0.3;
      if (e.phase === "windup") {
        // a trail of red marks where the boss will charge
        for (let d = 120; d <= 700; d += 75) {
          this.fx.fillStyle(0xff3a3a, blink).fillEllipse(e.img.x + e.dashX * d, e.img.y + e.dashY * d, 70, 32);
        }
      } else if (e.phase === "stomp") {
        const f = 1 - Math.max(0, e.phaseT) / 950;
        this.fx.fillStyle(0xff3a3a, 0.15 + f * 0.25).fillEllipse(e.img.x, e.img.y, 720 * f, 504 * f);
        this.fx.lineStyle(8, 0xff3a3a, blink).strokeEllipse(e.img.x, e.img.y, 720, 504);
      }
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
    // your health (and reload) under your feet, the crystal's health above it
    const hf = this.heroHp / this.heroMax;
    drawBar(this.bars, this.hero.x - 80, this.hero.y + 16, 160, 20, hf, hf > 0.35 ? 0x7ad651 : 0xf26464);
    if (this.reloadLeft > 0) drawBar(this.bars, this.hero.x - 80, this.hero.y + 50, 160, 14, 1 - this.reloadLeft / this.reloadTotal, 0xffd23f);
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
      if (p.kind === "airdrop") arrow(p.x, p.y - 40, TIER_INFO[p.tier!].color);
      if (p.kind === "dice" && tierIndex(p.tier!) >= 3) arrow(p.x, p.y - 40, TIER_INFO[p.tier!].color);
    }
    for (const e of this.enemies) if (e.type.boss) arrow(e.img.x, e.img.y, 0xb98aff);
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
