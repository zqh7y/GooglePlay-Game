import Phaser from "phaser";
import { HERO_HAND } from "../art/characters";
import { INK_N } from "../art/draw";
import { GROUND_SCALE, PATCH_R, makeGround } from "../art/ground";
import { petTexture } from "../art/pets";
import { makePickupTextures } from "../art/pickups";
import { crystalKey, makeWorldTextures } from "../art/world";
import {
  BOSS, CRYSTAL_HP, ELITE_MULT, FLYER, HERO_BASE_DMG, HERO_FIRE_MS, HERO_HP, HERO_TEAM_SHARE, MAX_MONSTERS, MAX_STAGE, MINUTES,
  MonsterStats, RAIDER_SHARE, STAGE_MS, WALKER_A, WALKER_B, monsterCash, monsterHp, spawnGap, xpFor,
} from "../data/balance";
import { ITEMS, ItemDef, levelMult } from "../data/items";
import { REGIONS, Region, regionForStage } from "../data/regions";
import { SKILL_BY_ID, SkillId, skillChoices } from "../data/skills";
import { ARENA, Arena, clampX, clampY, getArena } from "../game/arena";
import { GAME_W, Layout, layoutFor } from "../layout";
import { questEvent } from "../systems/goals";
import { persist, save } from "../systems/save";
import { buzz, music, sfx } from "../systems/sound";
import {
  cashMult, chestMult, critChance, critDamage, dmgMult, gemsPerBoss, heroDmgMult, moveSpeedMult, rangeMult, villageHpMult,
} from "../systems/stats";
import { fmt } from "../ui/format";
import { drawBar, ribbonBanner, text } from "../ui/widgets";

const HERO_SPEED = 390;
const HERO_RANGE = 620;
const PET_RANGE = 650;
const HERO_R = 40;
const PICK_R = 150;
const REVIVE_GEMS = 5;

/** Where coins fly to (the money counter in the HUD, screen coordinates). */
const CASH_TARGET = { x: GAME_W - 300, y: 150 };

/** Live numbers the HUD (UI scene) reads. */
export const battle = {
  /** ms survived this stage */
  time: 0,
  bossFrac: -1,
  crystal: 1,
  hp: 1,
  level: 1,
  xp: 0,
  dps: 0,
  combo: 0,
  heroX: 0,
  heroY: 0,
  /** a level-up skill choice is open */
  choosing: false,
  /** the run is over (won or lost) */
  over: false,
  skills: {} as Partial<Record<SkillId, number>>,
};

export interface StageResult {
  stage: number;
  reason: "hero" | "crystal";
  time: number;
  kills: number;
  earned: number;
  dice: number;
  canRevive: boolean;
  reviveGems: number;
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
  raider: boolean;
  elite: boolean;
  aura?: Phaser.GameObjects.Image;
  flashUntil: number;
  atkTimer: number;
  /** last time an orbit blade hit it */
  bladeAt: number;
  attacking: boolean;
  /** boss charge: walk, wind up, dash */
  phase: "walk" | "windup" | "dash";
  phaseT: number;
  dashX: number;
  dashY: number;
}

interface Pet {
  def: ItemDef;
  level: number;
  img: Phaser.GameObjects.Image;
  timer: number;
  ox: number;
  oy: number;
}

interface Shot {
  img: Phaser.GameObjects.Image;
  target: Enemy;
  tx: number;
  ty: number;
  dmg: number;
  speed: number;
  splash: number;
}

interface Strike {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  until: number;
  color: number;
  beam: boolean;
}

type PickKind = "dice" | "heart" | "magnet" | "bomb" | "freeze" | "orb" | "chest";

interface Pickup {
  kind: PickKind;
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  /** dropped items vanish after a while; placed ones stay */
  until: number;
}

interface Gem {
  img: Phaser.GameObjects.Image;
  value: number;
  pulled: boolean;
  speed: number;
}

const PET_SPOTS = [[-150, 30], [150, 30], [-95, 125], [95, 125], [-245, 100], [245, 100]];
const PET_SCALE = 0.7;
const NO_JOY = { active: false, id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
const BUCKET = 600;
const POWERUPS: PickKind[] = ["heart", "magnet", "bomb", "freeze"];
const PICK_TEX: Record<PickKind, string> = {
  dice: "dice_token", heart: "pk_heart", magnet: "pk_magnet", bomb: "pk_bomb", freeze: "pk_freeze", orb: "skill_orb", chest: "chest",
};
const PICK_GLOW: Record<PickKind, number> = {
  dice: 0xffd23f, heart: 0xff6a8a, magnet: 0x8a9aff, bomb: 0xffa64d, freeze: 0x8ae6ff, orb: 0xffe066, chest: 0xffd23f,
};

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * One stage: survive 5 minutes on a big open field while monsters come faster and tougher
 * every minute, keep the crystal in the middle alive, then beat the boss.
 */
export class BattleScene extends Phaser.Scene {
  private L!: Layout;
  private land!: Region;
  private arena!: Arena;
  private hero!: Phaser.GameObjects.Image;
  private gun!: Phaser.GameObjects.Image;
  private crystal!: Phaser.GameObjects.Image;
  private heroTimer = 0;
  private walkTimer = 0;
  private walkFrame = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private joy = { ...NO_JOY };
  private joyG!: Phaser.GameObjects.Graphics;

  private state: "intro" | "fight" | "boss" | "won" | "lost" = "intro";
  private elapsed = 0;
  private minute = 0;
  private heroHp = HERO_HP;
  private heroMax = HERO_HP;
  private crystalHp = CRYSTAL_HP;
  private crystalMax = CRYSTAL_HP;
  private hurtAt = 0;
  private level = 1;
  private xp = 0;
  private pendingLevels = 0;
  private skills: Partial<Record<SkillId, number>> = {};
  private revived = false;
  private stageKills = 0;
  private stageEarned = 0;
  private stageDice = 0;
  private frozenUntil = 0;
  private warnedAt = 0;

  private pets: Pet[] = [];
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private strikes: Strike[] = [];
  private pickups: Pickup[] = [];
  private gems: Gem[] = [];
  private blades: Phaser.GameObjects.Image[] = [];
  private auraImg!: Phaser.GameObjects.Image;
  private spawnTimer = 0;
  private eliteTimer = 0;
  private chestTimer = 0;
  private skillT = { lightning: 0, rocket: 0, aura: 0, guard: 0 };
  private bladeAngle = 0;
  private combo = 0;
  private comboTimer = 0;
  private comboText!: Phaser.GameObjects.Text;

  private fx!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private puff!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dmgTexts: Phaser.GameObjects.Text[] = [];
  private cashTexts: Phaser.GameObjects.Container[] = [];
  private flyingCash = 0;
  private mapTimer = 0;

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

  create(): void {
    this.L = layoutFor(this.scale.height);
    makeWorldTextures(this, REGIONS);
    makePickupTextures(this);
    this.land = regionForStage(save.stage);
    this.arena = getArena(this.land.id);
    Object.assign(this, {
      pets: [], enemies: [], shots: [], strikes: [], pickups: [], gems: [], blades: [], dmgTexts: [], cashTexts: [],
      state: "intro", elapsed: 0, minute: 0, hurtAt: 0, level: 1, xp: 0, pendingLevels: 0, skills: {}, revived: false,
      stageKills: 0, stageEarned: 0, stageDice: 0, frozenUntil: 0, warnedAt: 0, spawnTimer: 0, eliteTimer: 25000,
      chestTimer: 45000 + Math.random() * 20000, skillT: { lightning: 0, rocket: 0, aura: 0, guard: 0 },
      bladeAngle: 0, combo: 0, comboTimer: 0, flyingCash: 0, buckets: new Map(), shown: new Set(), grid: new Map(),
    });
    this.joy = { ...NO_JOY };
    this.heroMax = HERO_HP * villageHpMult();
    this.heroHp = this.heroMax;
    this.crystalMax = CRYSTAL_HP * villageHpMult();
    this.crystalHp = this.crystalMax;
    Object.assign(battle, { time: 0, bossFrac: -1, crystal: 1, hp: 1, level: 1, xp: 0, dps: 0, combo: 0, choosing: false, over: false, skills: this.skills });
    this.cameras.main.fadeIn(500, 74, 47, 29);
    this.drawArena();

    const [cx, cy] = this.arena.center;
    this.hero = this.add.image(cx, cy + 260, "hero").setOrigin(0.5, 0.95);
    this.gun = this.add.image(0, 0, "gun").setOrigin(20 / 96, 28 / 40);
    this.auraImg = this.add.image(cx, cy, "glow").setTint(0xff6a3a).setAlpha(0).setDepth(-500);
    // keep the hero in the middle of the open play area (between the HUD and the bottom bar)
    const playCenter = (this.L.hudBottom + this.L.navTop) / 2;
    this.cameras.main.setBounds(0, 0, ARENA, ARENA);
    this.cameras.main.startFollow(this.hero, true, 0.14, 0.14, 0, playCenter - this.scale.height / 2);

    this.fx = this.add.graphics().setDepth(9000);
    this.bars = this.add.graphics().setDepth(9100);
    this.overlay = this.add.graphics().setScrollFactor(0).setDepth(9500);
    this.joyG = this.add.graphics().setScrollFactor(0).setDepth(9600);
    this.add.image(22, this.L.hudBottom + 24, `mini_${this.land.id}`).setOrigin(0).setScrollFactor(0).setDepth(9490).setDisplaySize(180, 180).setAlpha(0.92);
    this.puff = this.add.particles(0, 0, "puff", { speed: { min: 80, max: 340 }, lifespan: 500, scale: { start: 1.2, end: 0 }, emitting: false }).setDepth(8900);
    this.sparks = this.add.particles(0, 0, "spark", {
      speed: { min: 120, max: 360 }, lifespan: 320, scale: { start: 0.7, end: 0 }, rotate: { min: 0, max: 90 }, emitting: false,
    }).setDepth(8950);
    this.add.particles(0, 0, "petal", {
      x: { min: -100, max: GAME_W }, y: { min: 0, max: 300 }, lifespan: 9000, speedX: { min: 20, max: 60 }, speedY: { min: 40, max: 90 },
      rotate: { start: 0, end: 360 }, alpha: { start: 0.9, end: 0 }, frequency: 420, tint: this.land.ambient,
    }).setScrollFactor(0).setDepth(9200);
    for (let i = 0; i < 60; i++) this.dmgTexts.push(text(this, 0, 0, "", 42).setDepth(9300).setVisible(false));
    for (let i = 0; i < 24; i++) {
      this.cashTexts.push(this.add.container(0, 0, [
        this.add.image(-8, 0, "icon_cash").setScale(0.42).setOrigin(1, 0.5),
        text(this, 0, 0, "", 40, "#8af06a").setOrigin(0, 0.5),
      ]).setDepth(9350).setVisible(false));
    }
    this.comboText = text(this, 0, 0, "", 46, "#ffe066").setDepth(9400).setVisible(false);

    this.buildPets();
    this.placePickups();
    this.setupControls();
    const on: [string, (...a: never[]) => void][] = [
      ["pets-changed", this.buildPets],
      ["skill-picked", this.onSkillPicked],
      ["revive", this.revive],
      ["retry", this.retry],
    ];
    for (const [ev, fn] of on) this.game.events.on(ev, fn, this);
    this.events.once("shutdown", () => {
      for (const [ev, fn] of on) this.game.events.off(ev, fn, this);
    });
    this.cull(true);
    music.play("battle");
    // first time in a land: celebrate it before the fight starts
    const idx = REGIONS.indexOf(this.land);
    let intro = 1800;
    if (idx > save.regionShown) {
      save.regionShown = idx;
      persist();
      intro = 3600;
      this.time.delayedCall(500, () => {
        sfx.fanfare();
        buzz(120);
        this.game.events.emit("land-unlocked", this.land.name);
      });
    } else {
      ribbonBanner(this, GAME_W / 2, this.L.hudBottom + 150, `STAGE ${save.stage}`, "peach", 900);
    }
    this.time.delayedCall(intro, () => {
      ribbonBanner(this, GAME_W / 2, this.L.hudBottom + 150, "SURVIVE 5:00!", "red", 900);
      sfx.alarm();
      this.state = "fight";
      this.game.events.emit("stage-start");
    });
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
    this.crystal = this.add.image(cx, cy + 70, crystalKey(this.land.id)).setOrigin(0.5, 1).setDepth(cy + 70);
    this.tweens.add({ targets: this.crystal, y: cy + 60, duration: 1500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.add.particles(cx, cy - 120, "spark", {
      x: { min: -90, max: 90 }, y: { min: -120, max: 80 }, lifespan: 1400, speedY: { min: -40, max: -10 },
      scale: { start: 0.5, end: 0 }, tint: [this.land.crystal, 0xffffff], frequency: 160,
    }).setDepth(cy + 71);
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
    for (let i = 0; i < 14; i++) this.addPickup("dice", ...this.randomSpot(700, 2650), 0);
    for (let i = 0; i < 8; i++) this.addPickup(POWERUPS[i % POWERUPS.length], ...this.randomSpot(500, 2650), 0);
    for (let i = 0; i < 3; i++) this.addPickup("orb", ...this.randomSpot(1400, 2650), 0);
  }

  private addPickup(kind: PickKind, x: number, y: number, life: number): void {
    const glow = this.add.image(x, y - 30, "glow").setTint(PICK_GLOW[kind]).setScale(kind === "chest" ? 1.2 : 0.8).setAlpha(0.6).setDepth(y - 1);
    const img = this.add.image(x, y, PICK_TEX[kind]).setOrigin(0.5, kind === "chest" ? 1 : 0.8).setDepth(y).setScale(0);
    this.tweens.add({ targets: img, scale: kind === "dice" ? 0.9 : 1, duration: 300, ease: "Back.out" });
    if (kind !== "chest") this.tweens.add({ targets: img, y: y - 16, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.tweens.add({ targets: glow, alpha: 0.95, scale: glow.scale * 1.2, duration: 800, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.pickups.push({ kind, img, glow, x, y, until: life ? this.time.now + life : 0 });
  }

  private updatePickups(delta: number): void {
    const fighting = this.state === "fight" || this.state === "boss";
    this.chestTimer -= delta;
    if (fighting && this.chestTimer <= 0) {
      this.chestTimer = 55000 + Math.random() * 30000;
      this.addPickup("chest", ...this.randomSpot(600, 1400, [this.hero.x, this.hero.y]), 50000);
      this.game.events.emit("toast", "A treasure chest appeared!", "#ffe066");
      sfx.lucky();
    }
    const reach = PICK_R * this.magnetMult() * 0.6;
    this.pickups = this.pickups.filter((p) => {
      const near = Math.abs(p.x - this.hero.x) < Math.max(80, reach * 0.6) && Math.abs(p.y - this.hero.y) < Math.max(70, reach * 0.5);
      if (near && fighting) {
        this.collect(p);
        return false;
      }
      if (p.until && this.time.now > p.until) {
        this.tweens.add({ targets: [p.img, p.glow], alpha: 0, duration: 400, onComplete: () => (p.img.destroy(), p.glow.destroy()) });
        return false;
      }
      return true;
    });
  }

  private collect(p: Pickup): void {
    p.glow.destroy();
    this.tweens.killTweensOf(p.img);
    const [x, y] = [p.x, p.y - 50];
    this.sparks.setParticleTint(PICK_GLOW[p.kind]);
    this.sparks.explode(18, x, y);
    switch (p.kind) {
      case "dice":
        this.addDice(1);
        break;
      case "heart":
        this.heal(0.4);
        this.game.events.emit("toast", "+40% health", "#ff9ab0");
        break;
      case "magnet":
        this.gems.forEach((g) => (g.pulled = true));
        sfx.lucky();
        this.game.events.emit("toast", "MAGNET! All XP flies to you", "#a8b8ff");
        break;
      case "bomb":
        this.bomb();
        break;
      case "freeze":
        this.frozenUntil = this.time.now + 5000;
        this.enemies.forEach((e) => e.img.setTint(0x9ae6ff));
        this.cameras.main.flash(200, 200, 240, 255);
        sfx.lucky();
        this.game.events.emit("toast", "FREEZE! Monsters can't move for 5s", "#9ae6ff");
        break;
      case "orb":
        sfx.fanfare();
        this.game.events.emit("toast", "Skill orb! Pick a free skill", "#ffe066");
        this.pendingLevels++;
        this.offerSkill();
        break;
      case "chest":
        this.openChest(p);
        return;
    }
    this.tweens.add({ targets: p.img, y: y - 80, scale: 1.4, alpha: 0, duration: 350, onComplete: () => p.img.destroy() });
  }

  private addDice(n: number): void {
    save.dice += n;
    this.stageDice += n;
    persist();
    sfx.dice();
    buzz(25);
    this.game.events.emit("dice", n);
    questEvent("dice", n);
  }

  private openChest(c: Pickup): void {
    const cash = Math.max(300, save.cashPerSec * 30, monsterCash(40, save.stage)) * chestMult();
    const gems = Math.random() < 0.35 ? 2 + Math.floor(Math.random() * 4) : 0;
    const dice = 2 + Math.floor(Math.random() * 3);
    save.cash += cash;
    save.gems += gems;
    this.stageEarned += cash;
    this.addDice(dice);
    sfx.fanfare();
    buzz(80);
    c.img.setTexture("chest_open");
    this.tweens.add({ targets: c.img, scaleX: 1.25, scaleY: 0.8, duration: 90, yoyo: true });
    this.tweens.add({ targets: c.img, alpha: 0, delay: 1200, duration: 400, onComplete: () => c.img.destroy() });
    this.sparks.setParticleTint(0xffe066);
    this.sparks.explode(30, c.x, c.y - 50);
    this.flyCash(c.x, c.y - 60, 12);
    this.game.events.emit("toast", `Treasure! +${fmt(cash)} money  +${dice} dice${gems ? `  +${gems} gems` : ""}`, "#ffe066");
  }

  /** XP gems fly to you once you are close (the magnet skill reaches farther). */
  private updateGems(delta: number): void {
    const reach = PICK_R * this.magnetMult();
    const hx = this.hero.x;
    const hy = this.hero.y - 50;
    this.gems = this.gems.filter((g) => {
      const dx = hx - g.img.x;
      const dy = hy - g.img.y;
      const d = Math.hypot(dx, dy);
      if (!g.pulled && d < reach) g.pulled = true;
      if (!g.pulled) return true;
      g.speed = Math.min(2200, g.speed + delta * 2.4);
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

  private dropGem(x: number, y: number, value: number): void {
    if (this.gems.length >= 250) {
      // too many lying around: add the value to an old one
      const g = this.gems[Math.floor(Math.random() * this.gems.length)];
      g.value += value;
      g.img.setTexture(g.value >= 5 ? "xp_l" : g.value >= 2 ? "xp_m" : "xp_s");
      return;
    }
    const img = this.add.image(x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-10, 10), value >= 5 ? "xp_l" : value >= 2 ? "xp_m" : "xp_s")
      .setScale(0).setDepth(y);
    this.tweens.add({ targets: img, scale: 0.8, duration: 200, ease: "Back.out" });
    this.gems.push({ img, value, pulled: false, speed: 300 });
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
    if (battle.choosing || this.state === "won" || this.state === "lost" || !this.pendingLevels) return;
    const choices = skillChoices(this.skills);
    if (!choices.length) {
      this.pendingLevels = 0;
      this.heal(0.2);
      return;
    }
    battle.choosing = true;
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
    if (id === "vitality") {
      const f = this.heroHp / this.heroMax;
      this.heroMax = HERO_HP * villageHpMult() * (1 + 0.25 * lv);
      this.heroHp = this.heroMax * f;
      this.heal(0.3);
    }
    if (id === "guard") this.crystalHp = Math.min(this.crystalMax, this.crystalHp + this.crystalMax * 0.25);
    if (id === "orbit") this.buildBlades();
    if (id === "fury") this.pets.forEach((p) => (p.timer = 0));
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

  private buildBlades(): void {
    this.blades.forEach((b) => b.destroy());
    this.blades = [];
    for (let i = 0; i < 1 + this.lv("orbit"); i++) this.blades.push(this.add.image(0, 0, "blade").setDepth(9000));
  }

  private heal(frac: number): void {
    this.heroHp = Math.min(this.heroMax, this.heroHp + this.heroMax * frac);
    this.sparks.setParticleTint(0x8af06a);
    this.sparks.explode(14, this.hero.x, this.hero.y - 80);
  }

  /** Skills that work on their own: blades, lightning, fire aura, rockets and the crystal's zap. */
  private useSkills(time: number, delta: number): void {
    const dmg = this.heroDamage();
    const orbit = this.lv("orbit");
    if (orbit) {
      this.bladeAngle += (delta / 1000) * (2.6 + 0.35 * orbit);
      const R = 170;
      this.blades.forEach((b, i) => {
        const a = this.bladeAngle + (i / this.blades.length) * Math.PI * 2;
        b.setPosition(this.hero.x + Math.cos(a) * R, this.hero.y - 60 + Math.sin(a) * R * 0.8).setRotation(this.bladeAngle * 3);
      });
      for (const e of this.near(this.hero.x, this.hero.y - 60, R + 60)) {
        if (time - e.bladeAt < 380) continue;
        if (this.blades.some((b) => Math.abs(b.x - e.img.x) < 50 + e.r * 0.5 && Math.abs(b.y - (e.img.y - 30)) < 60 + e.r * 0.5)) {
          e.bladeAt = time;
          this.hit(e, dmg * 0.7);
        }
      }
    }
    const zap = this.lv("lightning");
    if (zap && (this.skillT.lightning -= delta) <= 0) {
      this.skillT.lightning = 2000;
      const near = Phaser.Utils.Array.Shuffle(this.near(this.hero.x, this.hero.y, 750)).slice(0, 1 + zap);
      for (const t of near) this.zap(t, dmg * (1.2 + 0.3 * zap), 0xc8a8ff, time);
      if (near.length) sfx.zap();
    }
    const aura = this.lv("aura");
    this.auraImg.setVisible(aura > 0);
    if (aura) {
      const R = 150 + 25 * aura;
      this.auraImg.setPosition(this.hero.x, this.hero.y - 20).setScale((R / 128) * (1 + Math.sin(time / 120) * 0.04), (R / 128) * 0.75).setAlpha(0.55);
      if ((this.skillT.aura -= delta) <= 0) {
        this.skillT.aura = 500;
        for (const e of this.near(this.hero.x, this.hero.y - 20, R)) this.hit(e, dmg * (0.3 + 0.12 * aura), true);
      }
    }
    const rockets = this.lv("rocket");
    if (rockets && (this.skillT.rocket -= delta) <= 0) {
      this.skillT.rocket = 2500;
      const near = Phaser.Utils.Array.Shuffle(this.near(this.hero.x, this.hero.y, 900)).slice(0, rockets);
      near.forEach((t, i) => this.time.delayedCall(i * 90, () => {
        const img = this.add.image(this.hero.x, this.hero.y - 100, "rocket").setDepth(9000);
        this.shots.push({ img, target: t, tx: t.img.x, ty: t.img.y, dmg: dmg * 2, speed: 1000, splash: 140 + 20 * rockets });
      }));
    }
    const guard = this.lv("guard");
    if (guard && (this.skillT.guard -= delta) <= 0) {
      this.skillT.guard = Math.max(500, 1500 - 180 * guard);
      const [cx, cy] = this.arena.center;
      const t = this.near(cx, cy, 650)[0];
      if (t) this.zap(t, dmg * (1 + 0.5 * guard), this.land.crystal, time, [cx, cy - 200]);
    }
  }

  private zap(t: Enemy, dmg: number, color: number, time: number, from?: [number, number]): void {
    const ty = t.img.y - t.img.displayHeight * 0.4;
    const [fx, fy] = from ?? [t.img.x, ty - 600];
    this.strikes.push({ x1: fx, y1: fy, x2: t.img.x, y2: ty, until: time + 160, color, beam: !!from });
    const f = this.add.image(t.img.x, ty, "flash").setTint(color).setDepth(9050).setScale(1.2);
    this.tweens.add({ targets: f, scale: 1.9, alpha: 0, duration: 220, onComplete: () => f.destroy() });
    this.hit(t, dmg);
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

  // ───────────────────────── controls ─────────────────────────

  /** Drag anywhere in the open play area for a floating joystick (WASD / arrows on desktop). */
  private setupControls(): void {
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.joy.active || !this.cameras.main.visible || p.y < this.L.hudBottom + 10 || p.y > this.L.navTop - 20) return;
      if (p.x < 220 && p.y < this.L.hudBottom + 700) return;
      if (p.x > GAME_W - 440 && p.y < this.L.hudBottom + 160) return;
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

  private moveHero(time: number, delta: number): void {
    const k = this.keys;
    let vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (this.joy.active && Math.hypot(this.joy.dx, this.joy.dy) > 8) {
      vx = this.joy.dx / 90;
      vy = this.joy.dy / 90;
    }
    if (this.state === "lost" || this.state === "won") vx = vy = 0;
    const len = Math.hypot(vx, vy);
    if (len > 1) {
      vx /= len;
      vy /= len;
    }
    if (len > 0.05) {
      const step = (HERO_SPEED * moveSpeedMult() * (1 + 0.12 * this.lv("boots")) * delta) / 1000;
      this.hero.setPosition(clampX(this.hero.x + vx * step), clampY(this.hero.y + vy * step)).setScale(1);
      if (Math.abs(vx) > 0.1) this.hero.setFlipX(vx < 0);
      this.walkTimer += delta;
      if (this.walkTimer > 130) {
        this.walkTimer = 0;
        this.walkFrame ^= 1;
        this.hero.setTexture(this.walkFrame ? "hero_w1" : "hero_w2");
      }
    } else if (this.state !== "lost") {
      this.hero.setTexture("hero");
      this.hero.setScale(1 + Math.sin(time / 300) * 0.02, 1 - Math.sin(time / 300) * 0.02);
    }
    this.hero.setDepth(this.hero.y);
    const dir = this.hero.flipX ? -1 : 1;
    this.gun.setPosition(this.hero.x + HERO_HAND.x * dir, this.hero.y + HERO_HAND.y).setDepth(this.hero.y + 1);
    battle.heroX = this.hero.x;
    battle.heroY = this.hero.y;

    this.joyG.clear();
    if (this.joy.active) {
      const { bx, by, dx, dy } = this.joy;
      this.joyG.fillStyle(INK_N, 0.25).fillCircle(bx, by, 100);
      this.joyG.lineStyle(5, 0xfff3dc, 0.6).strokeCircle(bx, by, 100);
      this.joyG.fillStyle(0xfff3dc, 0.85).fillCircle(bx + dx, by + dy, 44);
      this.joyG.lineStyle(5, INK_N, 0.8).strokeCircle(bx + dx, by + dy, 44);
    }
  }

  // ───────────────────────── pets ─────────────────────────

  private buildPets(): void {
    this.pets.forEach((p) => p.img.destroy());
    this.pets = save.equipped.slice(0, PET_SPOTS.length).map((id, i) => {
      const def = ITEMS[id];
      const [ox, oy] = PET_SPOTS[i];
      const img = this.add.image(this.hero.x + ox, this.hero.y + oy, petTexture(this, id)).setOrigin(0.5, 0.95).setScale(0);
      this.tweens.add({ targets: img, scale: PET_SCALE, duration: 300, ease: "Back.out" });
      return { def, level: save.pets[id]?.level ?? 1, img, timer: Math.random() * def.cooldown, ox, oy };
    });
  }

  /** Pets trail the hero in a loose formation and hop along. */
  private movePets(time: number, delta: number): void {
    const k = 1 - Math.exp((-delta / 1000) * 6);
    this.pets.forEach((p, i) => {
      const dx = this.hero.x + p.ox - p.img.x;
      const dy = this.hero.y + p.oy - p.img.y;
      const far = Math.hypot(dx, dy);
      if (far > 700) p.img.setPosition(this.hero.x + p.ox * 0.4, this.hero.y + p.oy * 0.4);
      else p.img.setPosition(p.img.x + dx * k, p.img.y + dy * k);
      if (Math.abs(dx) > 4) p.img.setFlipX(dx < 0);
      const hop = far > 12 ? Math.abs(Math.sin(time / 110 + i)) * 0.08 : Math.sin(time / 400 + i) * 0.03;
      if (p.img.scaleX > 0.5) p.img.setScale(PET_SCALE * (1 + hop * 0.6), PET_SCALE * (1 - hop));
      p.img.setDepth(p.img.y);
    });
  }

  private petDamage(p: Pet): number {
    return p.def.damage * levelMult(p.level) * (1 + 0.2 * this.lv("fury"));
  }

  /** Team damage multiplier: tree upgrades plus "buff" pets. */
  private damageMult(): number {
    const buff = this.pets.filter((p) => p.def.kind === "buff").reduce((s, p) => s + this.petDamage(p) / 100, 0);
    return dmgMult() * (1 + buff);
  }

  private heroDamage(): number {
    const team = this.pets.filter((p) => p.def.kind !== "buff").reduce((s, p) => s + this.petDamage(p), 0);
    return (HERO_BASE_DMG + team * HERO_TEAM_SHARE) * this.damageMult() * heroDmgMult() * (1 + 0.35 * this.lv("power"));
  }

  // ───────────────────────── the stage clock ─────────────────────────

  private tick(delta: number): void {
    if (this.state !== "fight" && this.state !== "boss") return;
    this.elapsed += delta;
    battle.time = this.elapsed;
    const minute = Math.min(MINUTES, Math.floor(this.elapsed / 60000));
    if (minute > this.minute) {
      this.minute = minute;
      questEvent("wave");
      if (minute < MINUTES) {
        sfx.alarm();
        buzz(60);
        ribbonBanner(this, GAME_W / 2, this.L.hudBottom + 150, minute === MINUTES - 1 ? "LAST MINUTE!" : `${MINUTES - minute} MINUTES LEFT`, "red", 1000);
        this.game.events.emit("toast", "Monsters get stronger!", "#ff9a9a");
        this.swarm(10 + minute * 4);
      }
    }
    if (this.state === "fight" && this.elapsed >= STAGE_MS) this.startBoss();
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
    if (this.state !== "fight" && this.state !== "boss") return;
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = spawnGap(this.minute) * (this.state === "boss" ? 1.6 : 1);
      const group = 1 + Math.floor(this.minute / 3) + (save.stage > 40 ? 1 : 0);
      for (let i = 0; i < group && this.enemies.length < MAX_MONSTERS; i++) {
        const raider = this.elapsed > 20000 && Math.random() < RAIDER_SHARE;
        const [x, y] = raider ? this.randomSpot(1500, 2300) : this.offScreen();
        this.addEnemy(this.pickType(), x, y, raider);
      }
    }
    // tough elites carry dice
    this.eliteTimer -= delta;
    if (this.eliteTimer <= 0 && this.elapsed > 50000) {
      this.eliteTimer = 25000 - this.minute * 2500;
      const [x, y] = this.offScreen();
      this.addEnemy(this.types().b, x, y, false, true);
    }
  }

  /** A point just outside the screen around the hero. */
  private offScreen(): [number, number] {
    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * Math.PI * 2;
      const x = clampX(this.hero.x + Math.cos(a) * 720);
      const y = clampY(this.hero.y + Math.sin(a) * 1080);
      if (Math.hypot(x - this.hero.x, y - this.hero.y) > 600) return [x, y];
    }
    return this.randomSpot(800, 1600, [this.hero.x, this.hero.y]);
  }

  /** Every minute a ring of monsters closes in on you. */
  private swarm(n: number): void {
    for (let i = 0; i < n && this.enemies.length < MAX_MONSTERS; i++) {
      const a = (i / n) * Math.PI * 2;
      this.addEnemy(this.pickType(), clampX(this.hero.x + Math.cos(a) * 700), clampY(this.hero.y + Math.sin(a) * 900), false);
    }
  }

  private addEnemy(type: EnemyType, x: number, y: number, raider: boolean, elite = false): Enemy {
    const stage = save.stage;
    const scale = type.boss ? 1.3 : elite ? 1.45 : 1;
    const img = this.add.image(x, y, type.tex).setOrigin(0.5, type.flying ? 0.5 : 0.94).setDepth(y).setAlpha(0).setScale(0.3);
    this.tweens.add({ targets: img, alpha: 1, scale, duration: 350, ease: "Back.out" });
    if (type.flying) this.tweens.add({ targets: img, scaleY: scale * 0.85, duration: 160, yoyo: true, repeat: -1, delay: 350 });
    else this.tweens.add({ targets: img, angle: { from: -5, to: 5 }, duration: 260, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: 350 });
    const hp = Math.round(monsterHp(type.stats.hp, stage, this.minute) * (elite ? ELITE_MULT : 1));
    const e: Enemy = {
      img, type, hp, maxHp: hp, raider, elite,
      cash: monsterCash(type.stats.cash, stage) * (elite ? 5 : 1),
      xp: elite ? 8 : type.stats.xp,
      dmg: type.stats.dmg * (1 + 0.05 * (stage - 1)) * (1 + 0.2 * this.minute) * (elite ? 1.5 : 1),
      r: type.boss ? 90 : elite ? 48 : type.flying ? 30 : 34,
      flashUntil: 0, atkTimer: 0, bladeAt: 0, attacking: false, phase: "walk", phaseT: 3000, dashX: 0, dashY: 0,
    };
    if (elite) {
      e.aura = this.add.image(x, y, "glow").setTint(0xff4a4a).setScale(1.3, 0.6).setAlpha(0.7).setDepth(y - 1);
      this.tweens.add({ targets: e.aura, alpha: 0.35, duration: 400, yoyo: true, repeat: -1 });
    }
    this.enemies.push(e);
    return e;
  }

  private startBoss(): void {
    this.state = "boss";
    const [x, y] = this.offScreen();
    const boss = this.addEnemy({ tex: this.land.boss, stats: BOSS, fx: 0xffb03b, boss: true }, x, y, false);
    boss.hp = boss.maxHp = Math.round(monsterHp(BOSS.hp, save.stage, MINUTES));
    sfx.alarm();
    buzz(150);
    music.play("boss");
    this.cameras.main.shake(500, 0.008);
    ribbonBanner(this, GAME_W / 2, this.L.hudBottom + 150, "BOSS!", "red", 1200);
    this.game.events.emit("toast", "Defeat the boss to clear the stage!", "#ff9a9a");
  }

  private stageWon(): void {
    this.state = "won";
    battle.over = true;
    // everything left runs away in a puff
    for (const e of [...this.enemies]) this.kill(e, true);
    const gems = gemsPerBoss();
    save.gems += gems;
    this.addDice(5);
    const cleared = save.stage;
    if (save.stage < MAX_STAGE) save.stage++;
    save.bestStage = Math.max(save.bestStage, save.stage);
    persist();
    this.time.timeScale = 0.35;
    this.tweens.timeScale = 0.35;
    this.cameras.main.zoomTo(1.12, 350);
    window.setTimeout(() => {
      this.time.timeScale = 1;
      this.tweens.timeScale = 1;
      this.cameras.main.zoomTo(1, 500);
    }, 900);
    music.play("calm");
    this.game.events.emit("stage-clear", { stage: cleared, earned: this.stageEarned, gems, dice: this.stageDice, final: cleared === MAX_STAGE });
    this.game.events.emit("stage-up");
    this.time.delayedCall(4200, () => {
      this.cameras.main.fadeOut(600, 74, 47, 29);
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.restart());
    });
  }

  private stageLost(reason: "hero" | "crystal"): void {
    if (this.state === "lost" || this.state === "won") return;
    const before = this.state;
    this.state = "lost";
    battle.over = true;
    this.joy = { ...NO_JOY };
    sfx.error();
    buzz(300);
    this.cameras.main.shake(500, 0.012);
    music.play("calm");
    if (reason === "hero") {
      this.hero.setTint(0x8a8a8a);
      this.tweens.add({ targets: this.hero, angle: this.hero.flipX ? -90 : 90, duration: 400, ease: "Bounce.out" });
    } else {
      this.crystal.setTint(0x6a6a6a);
      this.boom(this.crystal.x, this.crystal.y - 100, 2.5);
    }
    ribbonBanner(this, GAME_W / 2, this.L.hudBottom + 150, reason === "hero" ? "YOU FELL!" : "CRYSTAL BROKE!", "red", 1100);
    this.time.delayedCall(1300, () => {
      const result: StageResult = {
        stage: save.stage, reason, time: this.elapsed, kills: this.stageKills, earned: this.stageEarned, dice: this.stageDice,
        canRevive: !this.revived, reviveGems: REVIVE_GEMS,
      };
      this.reviveState = before;
      this.game.events.emit("stage-failed", result);
    });
  }

  private reviveState: "fight" | "boss" | "intro" | "won" | "lost" = "fight";

  /** Spend gems to get back up once per stage: full health and a blast that clears the area. */
  private revive(): void {
    if (this.state !== "lost" || this.revived || save.gems < REVIVE_GEMS) return;
    save.gems -= REVIVE_GEMS;
    persist();
    this.revived = true;
    this.state = this.reviveState === "boss" ? "boss" : "fight";
    battle.over = false;
    this.heroHp = this.heroMax;
    this.crystalHp = Math.max(this.crystalHp, this.crystalMax * 0.5);
    this.hero.clearTint().setAngle(0);
    this.crystal.clearTint();
    this.frozenUntil = this.time.now + 2500;
    music.play(this.state === "boss" ? "boss" : "battle");
    sfx.fanfare();
    this.cameras.main.flash(300, 255, 255, 220);
    for (const e of [...this.enemies]) {
      const d = Math.hypot(e.img.x - this.hero.x, e.img.y - this.hero.y);
      if (d < 900 && !e.type.boss) this.hit(e, e.maxHp * 10);
    }
    ribbonBanner(this, GAME_W / 2, this.L.hudBottom + 150, "REVIVED!", "green", 900);
  }

  private retry(): void {
    this.cameras.main.fadeOut(400, 74, 47, 29);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.restart());
  }

  // ───────────────────────── loop ─────────────────────────

  update(time: number, delta: number): void {
    if (battle.choosing) return;
    this.trackStats(delta);
    this.tick(delta);
    this.moveHero(time, delta);
    this.movePets(time, delta);
    this.updatePickups(delta);
    this.updateGems(delta);
    this.spawn(delta);
    const fighting = this.state === "fight" || this.state === "boss";
    if (fighting) {
      // slowly heal between hits
      if (time - this.hurtAt > 3000) this.heroHp = Math.min(this.heroMax, this.heroHp + this.heroMax * 0.01 * (delta / 1000));
      this.crystalHp = Math.min(this.crystalMax, this.crystalHp + this.crystalMax * 0.003 * (delta / 1000));
    }
    battle.hp = this.heroHp / this.heroMax;
    battle.crystal = this.crystalHp / this.crystalMax;
    const boss = this.enemies.find((e) => e.type.boss);
    battle.bossFrac = boss ? boss.hp / boss.maxHp : -1;

    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.combo = battle.combo = 0;
        this.comboText.setVisible(false);
      }
    }
    this.comboText.setPosition(this.hero.x, this.hero.y - 230);

    this.moveEnemies(time, delta);
    if (fighting) {
      this.heroAttack(delta);
      this.petAttacks(time, delta);
      this.useSkills(time, delta);
    }
    this.moveShots(delta);
    this.drawFx(time);
    this.mapTimer -= delta;
    if (this.mapTimer <= 0) {
      this.mapTimer = 100;
      this.drawOverlay();
    }
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

  /** Chasers hunt you, raiders go for the crystal; everyone keeps a little space from each other. */
  private moveEnemies(time: number, delta: number): void {
    const frozen = time < this.frozenUntil;
    if (!frozen && this.enemies.length && this.enemies[0].img.tintTopLeft === 0x9ae6ff) this.enemies.forEach((e) => e.img.clearTint());
    const [cx, cy] = this.arena.center;
    const fighting = this.state === "fight" || this.state === "boss";
    // spatial grid for keeping monsters apart
    const G = 90;
    this.grid.clear();
    for (const e of this.enemies) {
      const k = Math.floor(e.img.x / G) * 1000 + Math.floor(e.img.y / G);
      const cell = this.grid.get(k);
      if (cell) cell.push(e);
      else this.grid.set(k, [e]);
    }
    for (const e of this.enemies) {
      if (e.flashUntil && time > e.flashUntil) {
        e.flashUntil = 0;
        if (frozen) e.img.setTint(0x9ae6ff);
        else e.img.clearTint();
      }
      e.aura?.setPosition(e.img.x, e.img.y - 10).setDepth(e.img.y - 1);
      if (frozen || !fighting) continue;
      const tx = e.raider ? cx : this.hero.x;
      const ty = e.raider ? cy + 40 : this.hero.y;
      const dx = tx - e.img.x;
      const dy = ty - e.img.y;
      const d = Math.hypot(dx, dy) || 1;
      const stop = e.raider ? 200 : HERO_R + e.r - 10;
      let speed = e.type.stats.speed;
      if (e.type.boss) speed = this.bossMove(e, delta, dx / d, dy / d);
      if (d > stop) {
        const step = (speed * delta) / 1000;
        const [mx, my] = e.phase === "dash" ? [e.dashX, e.dashY] : [dx / d, dy / d];
        let nx = e.img.x + mx * step;
        let ny = e.img.y + my * step;
        // push away from close neighbours
        const gx = Math.floor(e.img.x / G);
        const gy = Math.floor(e.img.y / G);
        for (let ix = gx - 1; ix <= gx + 1; ix++) {
          for (let iy = gy - 1; iy <= gy + 1; iy++) {
            for (const o of this.grid.get(ix * 1000 + iy) ?? []) {
              if (o === e) continue;
              const ox = nx - o.img.x;
              const oy = ny - o.img.y;
              const od = Math.hypot(ox, oy);
              const min = (e.r + o.r) * 0.8;
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
      const hd = Math.hypot(this.hero.x - e.img.x, this.hero.y - e.img.y);
      if (hd < HERO_R + e.r + 10 && e.atkTimer <= 0) {
        e.atkTimer = 800;
        this.hurt(e.dmg);
        if (this.state !== "fight" && this.state !== "boss") return;
      }
      // raiders chip away at the crystal
      if (e.raider && d <= stop + 10 && e.atkTimer <= 0) {
        e.atkTimer = 1500;
        e.attacking = true;
        this.tweens.add({ targets: e.img, x: e.img.x + (dx / d) * 24, y: e.img.y + (dy / d) * 24, duration: 90, yoyo: true });
        this.crystalHp -= e.dmg;
        this.crystal.setTintFill(0xff8a8a);
        this.time.delayedCall(80, () => this.crystal.clearTint());
        if (time - this.warnedAt > 8000) {
          this.warnedAt = time;
          this.game.events.emit("toast", "The crystal is under attack!", "#ff9a9a");
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

  /** The boss walks at you, then every few seconds winds up and charges. */
  private bossMove(e: Enemy, delta: number, ux: number, uy: number): number {
    e.phaseT -= delta;
    if (e.phase === "walk") {
      if (e.phaseT <= 0) {
        e.phase = "windup";
        e.phaseT = 700;
        e.dashX = ux;
        e.dashY = uy;
        this.tweens.add({ targets: e.img, scaleX: 1.45, scaleY: 1.1, duration: 140, yoyo: true, repeat: 2 });
      }
      return e.type.stats.speed * 1.4;
    }
    if (e.phase === "windup") {
      if (e.phaseT <= 0) {
        e.phase = "dash";
        e.phaseT = 600;
        this.cameras.main.shake(200, 0.006);
      }
      return 0;
    }
    if (e.phaseT <= 0) {
      e.phase = "walk";
      e.phaseT = 3200 + Math.random() * 1500;
    }
    return 1000;
  }

  private hurt(dmg: number): void {
    this.heroHp -= dmg;
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

  private heroAttack(delta: number): void {
    const shots = 1 + this.lv("multi");
    const targets = this.nearestEnemies(this.hero.x, this.hero.y, HERO_RANGE * rangeMult(), shots);
    const target = targets[0];
    const aim = target
      ? Math.atan2(target.img.y - target.img.displayHeight * 0.4 - this.gun.y, target.img.x - this.gun.x)
      : this.hero.flipX ? Math.PI : 0;
    this.gun.setRotation(Phaser.Math.Angle.RotateTo(this.gun.rotation, aim, target ? 0.3 : 0.15));
    this.gun.setFlipY(Math.abs(this.gun.rotation) > Math.PI / 2);
    this.heroTimer -= delta;
    if (this.heroTimer > 0 || !target) return;
    this.heroTimer = HERO_FIRE_MS / (1 + 0.25 * this.lv("rapid"));
    const mx = this.gun.x + Math.cos(this.gun.rotation) * 70;
    const my = this.gun.y + Math.sin(this.gun.rotation) * 70;
    const dmg = this.heroDamage();
    for (let i = 0; i < shots; i++) this.fire(mx, my, targets[i % targets.length], dmg, "bolt", 0xffffff, 0, 1);
    sfx.shoot();
    this.gun.x -= Math.cos(this.gun.rotation) * 5;
    const flash = this.add.image(mx, my, "flash").setDepth(9050).setScale(0.5);
    this.tweens.add({ targets: flash, scale: 0.9, alpha: 0, duration: 110, onComplete: () => flash.destroy() });
  }

  private petAttacks(time: number, delta: number): void {
    const mult = this.damageMult();
    const speed = 1 + 0.2 * this.lv("fury");
    for (const p of this.pets) {
      p.timer -= delta * speed;
      if (p.def.kind === "buff") {
        if (p.timer <= 0) {
          p.timer = 2200;
          this.sparks.setParticleTint(0xffe680);
          this.sparks.explode(5, p.img.x, p.img.y - 80);
        }
        continue;
      }
      if (p.timer > 0) continue;
      const near = this.near(p.img.x, p.img.y, PET_RANGE * rangeMult());
      if (!near.length) continue;
      p.timer = p.def.cooldown;
      const dmg = this.petDamage(p) * mult;
      const color = p.def.fx;
      const sx = p.img.x;
      const sy = p.img.y - 70;
      const picks = Phaser.Utils.Array.Shuffle(near).slice(0, p.def.count);
      this.tweens.add({ targets: p.img, scaleY: PET_SCALE * 0.8, duration: 70, yoyo: true });
      switch (p.def.kind) {
        case "shot":
          picks.forEach((t, i) => this.time.delayedCall(i * 80, () => this.fire(sx, sy, t, dmg, "orb", color, 0, 0.7)));
          break;
        case "splash":
          picks.forEach((t) => this.fire(sx, sy, t, dmg, "orb", color, 150, 1.2));
          break;
        case "zap":
          picks.forEach((t) => this.zap(t, dmg, color, time));
          break;
        case "pierce":
          picks.forEach((t) => {
            const ty = t.img.y - t.img.displayHeight * 0.4;
            const ang = Math.atan2(ty - sy, t.img.x - sx);
            this.strikes.push({ x1: sx, y1: sy, x2: sx + Math.cos(ang) * 900, y2: sy + Math.sin(ang) * 900, until: time + 200, color, beam: true });
            for (const e of [...this.enemies]) {
              const px = e.img.x - sx;
              const py = e.img.y - e.img.displayHeight * 0.4 - sy;
              const along = px * Math.cos(ang) + py * Math.sin(ang);
              const off = Math.abs(-px * Math.sin(ang) + py * Math.cos(ang));
              if (along > 0 && along < 900 && off < 60) this.hit(e, dmg);
            }
          });
          break;
      }
    }
  }

  private fire(x: number, y: number, target: Enemy, dmg: number, tex: string, color: number, splash: number, scale: number): void {
    if (!this.enemies.includes(target)) return;
    const img = this.add.image(x, y, tex).setScale(scale).setDepth(9000);
    if (tex !== "bolt") img.setTint(color);
    this.shots.push({ img, target, tx: target.img.x, ty: target.img.y, dmg, speed: splash ? 1100 : 1800, splash });
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
      s.img.setRotation(Math.atan2(dy, dx));
      if (d > step + 14) {
        s.img.x += (dx / d) * step;
        s.img.y += (dy / d) * step;
        return true;
      }
      if (s.splash) {
        this.boom(s.tx, s.ty, s.img.texture.key === "rocket" ? 1.3 : 0.9);
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
    this.tweens.add({ targets: t, y: y - 80, alpha: 0, delay: 300, duration: 450, onComplete: () => t.setVisible(false) });
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
    this.stageKills++;
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
    this.stageEarned += cash;
    questEvent("kill");
    if (e.type.boss) questEvent("boss");
    if (this.combo >= 5) questEvent("combo", this.combo);
    this.game.events.emit("kill", e.type.boss);
    if (e.elite || e.type.boss || Math.random() < 0.15) this.cashPop(e.img.x, cy - 40, cash);
    this.flyCash(e.img.x, cy, e.type.boss ? 14 : e.elite ? 4 : Math.random() < 0.3 ? 1 : 0);
    if (!e.type.boss) this.dropGem(e.img.x, e.img.y - 20, e.xp);
    // lucky drops
    if (e.elite) this.addPickup("dice", e.img.x, e.img.y, 30000);
    else if (Math.random() < 0.006) this.addPickup("dice", e.img.x, e.img.y, 30000);
    else if (Math.random() < 0.006) this.addPickup(POWERUPS[Math.floor(Math.random() * POWERUPS.length)], e.img.x, e.img.y, 30000);
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
    this.tweens.add({ targets: c, y: y - 70, alpha: 0, delay: 450, duration: 450, onComplete: () => c.setVisible(false) });
  }

  /** Money bills pop out of defeated monsters and fly into the money counter. */
  private flyCash(wx: number, wy: number, n: number): void {
    const cam = this.cameras.main;
    const x = wx - cam.scrollX;
    const y = wy - cam.scrollY;
    if (x < -50 || x > GAME_W + 50 || y < 0 || y > this.scale.height) return;
    for (let i = 0; i < n && this.flyingCash < 30; i++) {
      this.flyingCash++;
      const c = this.add.image(x, y, "icon_cash").setScale(0.5).setDepth(9700).setScrollFactor(0).setAngle(Phaser.Math.Between(-30, 30));
      this.tweens.add({
        targets: c, x: x + Phaser.Math.Between(-80, 80), y: y - Phaser.Math.Between(30, 110), duration: 260, ease: "Quad.out",
        onComplete: () => this.tweens.add({
          targets: c, x: CASH_TARGET.x, y: CASH_TARGET.y, scale: 0.32, angle: 0, duration: 520, delay: i * 40, ease: "Cubic.in",
          onComplete: () => {
            c.destroy();
            this.flyingCash--;
            sfx.coin();
            this.game.events.emit("cash-arrived");
          },
        }),
      });
    }
  }

  private drawFx(time: number): void {
    this.strikes = this.strikes.filter((s) => s.until > time);
    this.fx.clear();
    for (const s of this.strikes) {
      if (s.beam) {
        this.fx.lineStyle(34, s.color, 0.35).lineBetween(s.x1, s.y1, s.x2, s.y2);
        this.fx.lineStyle(16, s.color, 0.9).lineBetween(s.x1, s.y1, s.x2, s.y2);
        this.fx.lineStyle(6, 0xffffff, 1).lineBetween(s.x1, s.y1, s.x2, s.y2);
        continue;
      }
      const seed = Math.floor(s.until);
      for (const [w, c, a] of [[18, s.color, 0.35], [8, s.color, 1], [3, 0xffffff, 1]] as [number, number, number][]) {
        this.fx.lineStyle(w, c, a).beginPath();
        let y = s.y1;
        this.fx.moveTo(s.x2 + ((seed * 7) % 50) - 25, y);
        let k = 1;
        while (y < s.y2) {
          y = Math.min(s.y2, y + 70);
          this.fx.lineTo(y === s.y2 ? s.x2 : s.x2 + (((seed * (k + 3) * 13) % 56) - 28), y);
          k++;
        }
        this.fx.strokePath();
      }
    }
    // boss charge warning
    for (const e of this.enemies) {
      if (e.phase !== "windup") continue;
      const a = time % 200 < 100 ? 0.5 : 0.25;
      this.fx.lineStyle(60, 0xff3a3a, a).lineBetween(e.img.x, e.img.y - 40, e.img.x + e.dashX * 650, e.img.y - 40 + e.dashY * 650);
    }
    this.bars.clear();
    for (const e of this.enemies) {
      if (e.hp >= e.maxHp && !e.type.boss && !e.elite) continue;
      const w = e.type.boss ? 260 : e.elite ? 130 : 88;
      const y = e.img.y - e.img.displayHeight * (e.type.flying ? 0.5 : 0.95) - 18;
      drawBar(this.bars, e.img.x - w / 2, y, w, e.type.boss ? 22 : 12, e.hp / e.maxHp, e.type.boss || e.elite ? 0xf26464 : 0x7ad651);
    }
    // your health under your feet, the crystal's above it
    const hf = this.heroHp / this.heroMax;
    drawBar(this.bars, this.hero.x - 60, this.hero.y + 14, 120, 14, hf, hf > 0.35 ? 0x7ad651 : 0xf26464);
    const [hx, hy] = this.arena.center;
    const f = this.crystalHp / this.crystalMax;
    drawBar(this.bars, hx - 120, hy - 300, 240, 24, f, f > 0.4 ? 0x67c3ff : 0xf26464);
  }

  /** Minimap dots, plus arrows pointing at the crystal (when attacked), chests and the boss. */
  private drawOverlay(): void {
    const g = this.overlay;
    g.clear();
    const mx = 22;
    const my = this.L.hudBottom + 24;
    const s = 180 / ARENA;
    g.lineStyle(6, INK_N, 1).strokeRoundedRect(mx - 3, my - 3, 186, 186, 12);
    const [hx, hy] = this.arena.center;
    g.fillStyle(this.land.crystal, 1).fillCircle(mx + hx * s, my + hy * s, 7);
    g.lineStyle(2, 0xffffff, 1).strokeCircle(mx + hx * s, my + hy * s, 7);
    for (const p of this.pickups) {
      g.fillStyle(p.kind === "dice" ? 0xffd23f : p.kind === "orb" ? 0xff9a2a : p.kind === "chest" ? 0xffe066 : 0xffffff, 1);
      const r = p.kind === "orb" || p.kind === "chest" ? 5 : 3.5;
      g.fillRect(mx + p.x * s - r, my + p.y * s - r, r * 2, r * 2);
    }
    for (const e of this.enemies) {
      g.fillStyle(e.raider ? 0xff9a3a : 0xf26464, 1).fillCircle(mx + e.img.x * s, my + e.img.y * s, e.type.boss ? 5 : 2);
    }
    g.fillStyle(0xffffff, 1).fillCircle(mx + this.hero.x * s, my + this.hero.y * s, 5);
    g.lineStyle(3, 0xff8a3a, 1).strokeCircle(mx + this.hero.x * s, my + this.hero.y * s, 5);
    const cam = this.cameras.main;
    g.lineStyle(2, 0xffffff, 0.7).strokeRect(mx + cam.scrollX * s, my + cam.scrollY * s, cam.width * s, cam.height * s);

    const top = this.L.hudBottom + 30;
    const bottom = this.L.navTop - 40;
    const cxs = GAME_W / 2;
    const cys = (top + bottom) / 2;
    const arrow = (wx: number, wy: number, color: number) => {
      const sx = wx - cam.scrollX;
      const sy = wy - cam.scrollY;
      if (sx > 0 && sx < GAME_W && sy > top && sy < bottom) return;
      const a = Math.atan2(sy - cys, sx - cxs);
      const ax = Phaser.Math.Clamp(cxs + Math.cos(a) * 2000, 50, GAME_W - 50);
      const ay = Phaser.Math.Clamp(cys + Math.sin(a) * 2000, top + 20, bottom - 20);
      const pt = (o: number, r: number) => [ax + Math.cos(a + o) * r, ay + Math.sin(a + o) * r];
      const [p1, p2, p3] = [pt(0, 34), pt(2.4, 28), pt(-2.4, 28)];
      g.fillStyle(color, 0.95).fillTriangle(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
      g.lineStyle(4, INK_N, 1).strokeTriangle(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
    };
    if (this.enemies.some((e) => e.attacking && e.raider) && this.time.now % 600 < 400) arrow(hx, hy, 0xf26464);
    for (const p of this.pickups) if (p.kind === "chest") arrow(p.x, p.y - 40, 0xffd23f);
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
      save.cashPerSec = save.cashPerSec ? save.cashPerSec * 0.6 + rate * 0.4 : rate;
      this.earnedWindow = 0;
      this.rateTimer = 0;
    }
    if (this.saveTimer >= 5000) {
      this.saveTimer = 0;
      persist();
    }
  }
}

export { mmss };
