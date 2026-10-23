import Phaser from "phaser";
import { HERO_HAND } from "../art/characters";
import { INK_N } from "../art/draw";
import { GROUND_SCALE, makeGround } from "../art/ground";
import { petTexture } from "../art/pets";
import { makeWorldTextures } from "../art/world";
import {
  BOSS, FLYER, HERO_BASE_DMG, HERO_FIRE_MS, HERO_TEAM_SHARE, MAX_STAGE, MonsterStats, SPAWN_MAX, SPAWN_MIN, VILLAGE_HP,
  WALKER_A, WALKER_B, WAVES_PER_STAGE, monsterCash, monsterHp, waveSize,
} from "../data/balance";
import { ITEMS, ItemDef, levelMult } from "../data/items";
import { REGIONS, Region, RegionId, regionForStage, regionUnlocked } from "../data/regions";
import { Flow, WORLD, World, flowDir, flowField, getWorld, pushOut, regionAt } from "../game/world";
import { GAME_W, Layout, layoutFor } from "../layout";
import { questEvent } from "../systems/goals";
import { persist, save } from "../systems/save";
import { buzz, sfx } from "../systems/sound";
import {
  cashMult, chestMult, critChance, critDamage, dmgMult, gemsPerBoss, heroDmgMult, moveSpeedMult, rangeMult, villageHpMult,
} from "../systems/stats";
import { fmt } from "../ui/format";
import { drawBar, ribbonBanner, text } from "../ui/widgets";

export { WAVES_PER_STAGE };
const HERO_SPEED = 430;
const HERO_RANGE = 580;
const PET_RANGE = 650;

/** Where coins fly to (the money counter in the HUD, screen coordinates). */
export const CASH_TARGET = { x: GAME_W - 300, y: 150 };

/** Live numbers the HUD (UI scene) reads. */
export const battle = {
  progress: 0, bossFrac: -1, village: 1, dps: 0, combo: 0,
  heroX: 0, heroY: 0, here: "village" as RegionId, cutscene: false,
};

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
  stopR: number;
  flashUntil: number;
  attacking: boolean;
  atkTimer: number;
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

interface ChestView {
  id: string;
  img: Phaser.GameObjects.Image;
  arrow: Phaser.GameObjects.Image;
  x: number;
  y: number;
}

const PET_SPOTS = [[-150, 30], [150, 30], [-95, 125], [95, 125], [-245, 100], [245, 100]];
const PET_SCALE = 0.7;
const NO_JOY = { active: false, id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
const BUCKET = 500;
const CHEST_RESPAWN = 8 * 60 * 1000;

/** The big world: walk anywhere you have unlocked, protect the heart of the land you are fighting for. */
export class BattleScene extends Phaser.Scene {
  private L!: Layout;
  private world!: World;
  private fight!: Region;
  private flow!: Flow;
  private hero!: Phaser.GameObjects.Image;
  private gun!: Phaser.GameObjects.Image;
  private heroTimer = 0;
  private walkTimer = 0;
  private walkFrame = 0;
  private lastManual = -99999;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private joy = { ...NO_JOY };
  private joyG!: Phaser.GameObjects.Graphics;

  private pets: Pet[] = [];
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private strikes: Strike[] = [];
  private spawnQueue: EnemyType[] = [];
  private spawnTimer = 0;
  private waveDelay = 0;
  private waveSize = 1;
  private kills = 0;
  private villageHp = VILLAGE_HP;
  private villageMax = VILLAGE_HP;
  private warned = false;
  private combo = 0;
  private comboTimer = 0;
  private comboText!: Phaser.GameObjects.Text;
  private stageEarned = 0;

  private fx!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private ambient!: Phaser.GameObjects.Particles.ParticleEmitter;
  private puff!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dmgTexts: Phaser.GameObjects.Text[] = [];
  private cashTexts: Phaser.GameObjects.Container[] = [];
  private flyingCash = 0;
  private mapTimer = 0;

  private buckets = new Map<number, Phaser.GameObjects.GameObject[]>();
  private shown = new Set<number>();
  private cullTimer = 0;
  private fog = new Map<RegionId, Phaser.GameObjects.Image[]>();
  private fogLabels = new Map<RegionId, Phaser.GameObjects.Container>();
  private portalSwirls: { img: Phaser.GameObjects.Image; region: RegionId }[] = [];
  private chests: ChestView[] = [];
  private regionTimer = 0;
  private miniFog!: Phaser.GameObjects.Image;

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
    makeWorldTextures(this);
    this.world = getWorld();
    Object.assign(this, {
      pets: [], enemies: [], shots: [], strikes: [], spawnQueue: [], dmgTexts: [], cashTexts: [], chests: [], portalSwirls: [],
      waveDelay: 0, flyingCash: 0, combo: 0, comboTimer: 0, lastManual: -99999, stageEarned: 0,
      buckets: new Map(), shown: new Set(), fog: new Map(), fogLabels: new Map(),
    });
    this.joy = { ...NO_JOY };
    battle.dps = 0;
    battle.combo = 0;
    battle.cutscene = false;
    this.cameras.main.fadeIn(400, 74, 47, 29);
    this.drawWorld();

    this.fight = regionForStage(save.stage);
    const [hx, hy] = this.fight.heart;
    this.hero = this.add.image(hx, hy + 220, "hero").setOrigin(0.5, 0.95);
    this.gun = this.add.image(0, 0, "gun").setOrigin(34 / 152, 46 / 68);
    // keep the hero in the middle of the open play area (between the HUD and the bottom panel)
    const playCenter = (this.L.hudBottom + this.L.slotsY - 120) / 2;
    this.cameras.main.setBounds(0, 0, WORLD, WORLD);
    this.cameras.main.startFollow(this.hero, true, 0.12, 0.12, 0, playCenter - this.scale.height / 2);

    this.fx = this.add.graphics().setDepth(9000);
    this.bars = this.add.graphics().setDepth(9100);
    this.overlay = this.add.graphics().setScrollFactor(0).setDepth(9500);
    this.joyG = this.add.graphics().setScrollFactor(0).setDepth(9600);
    this.add.image(22, this.L.hudBottom + 24, "world_mini").setOrigin(0).setScrollFactor(0).setDepth(9490).setDisplaySize(200, 200)
      .setInteractive().on("pointerup", () => this.game.events.emit("open-map"));
    this.miniFog = this.add.image(22, this.L.hudBottom + 24, "__DEFAULT").setOrigin(0).setScrollFactor(0).setDepth(9491);
    this.drawMiniFog();
    this.puff = this.add.particles(0, 0, "puff", { speed: { min: 80, max: 340 }, lifespan: 500, scale: { start: 1.2, end: 0 }, emitting: false }).setDepth(8900);
    this.sparks = this.add.particles(0, 0, "spark", {
      speed: { min: 120, max: 360 }, lifespan: 320, scale: { start: 0.7, end: 0 }, rotate: { min: 0, max: 90 }, emitting: false,
    }).setDepth(8950);
    this.ambient = this.add.particles(0, 0, "petal", {
      x: { min: -100, max: GAME_W }, y: { min: 0, max: 300 }, lifespan: 9000, speedX: { min: 20, max: 60 }, speedY: { min: 40, max: 90 },
      rotate: { start: 0, end: 360 }, alpha: { start: 0.9, end: 0 }, frequency: 420,
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
    this.setupControls();
    this.useFight();
    this.game.events.on("pets-changed", this.buildPets, this);
    this.events.once("shutdown", () => this.game.events.off("pets-changed", this.buildPets, this));
    this.cull(true);
    this.startWave();
  }

  // ───────────────────────── world ─────────────────────────

  private bucketOf(x: number, y: number): number {
    return Math.floor(x / BUCKET) * 100 + Math.floor(y / BUCKET);
  }

  /** Static scenery is hidden when far from the camera, so a huge map stays fast. */
  private addStatic(obj: Phaser.GameObjects.Image, x: number, y: number): void {
    const k = this.bucketOf(x, y);
    if (!this.buckets.has(k)) this.buckets.set(k, []);
    this.buckets.get(k)!.push(obj);
    obj.setVisible(false);
  }

  private cull(force = false): void {
    const v = this.cameras.main.worldView;
    const want = new Set<number>();
    for (let bx = Math.floor((v.x - 300) / BUCKET); bx <= Math.floor((v.right + 300) / BUCKET); bx++) {
      for (let by = Math.floor((v.y - 200) / BUCKET); by <= Math.floor((v.bottom + 500) / BUCKET); by++) want.add(bx * 100 + by);
    }
    const show = (o: Phaser.GameObjects.GameObject, on: boolean) => {
      (o as Phaser.GameObjects.Image).setVisible(on);
      if (o instanceof Phaser.GameObjects.Particles.ParticleEmitter) {
        if (on) o.resume();
        else o.pause();
      }
    };
    for (const k of this.shown) if (!want.has(k)) this.buckets.get(k)?.forEach((o) => show(o, false));
    for (const k of want) if (force || !this.shown.has(k)) this.buckets.get(k)?.forEach((o) => show(o, true));
    this.shown = want;
  }

  private drawWorld(): void {
    const w = this.world;
    const keys = makeGround(this, w);
    this.add.image(0, 0, keys.ground).setOrigin(0).setScale(1 / GROUND_SCALE).setDepth(-1000);
    for (const o of w.objects) {
      const img = this.add.image(o.x, o.y, o.tex).setOrigin(0.5, 1).setDepth(o.depth ?? o.y);
      if (o.flip && !o.tex.startsWith("house") && o.tex !== "barn") img.setFlipX(true);
      if (o.scale) img.setScale(o.scale);
      if (o.angle !== undefined) img.setOrigin(0.5).setPosition(o.x, o.y - img.height / 2).setAngle(o.angle);
      if (o.tex === "portal") {
        const swirl = this.add.image(o.x, o.y - 96, "portal_swirl").setDepth(-399).setTint(0xe0b0ff).setScale(0.9, 0.65);
        this.portalSwirls.push({ img: swirl, region: regionAt(o.x, o.y - 100).id });
        this.addStatic(swirl, o.x, o.y);
      }
      this.addStatic(img, o.x, o.y);
    }
    const [mx, my] = w.windmill;
    const blades = this.add.image(mx, my, "windmill_blades").setDepth(my + 245);
    this.tweens.add({ targets: blades, angle: 360, duration: 7000, repeat: -1 });
    this.addStatic(blades, mx, my + 240);
    for (const [cx, cy] of w.chimneys) {
      const smoke = this.add.particles(cx, cy, "puff", {
        speedY: { min: -60, max: -30 }, speedX: { min: 5, max: 25 }, lifespan: 2600, scale: { start: 0.6, end: 1.6 },
        alpha: { start: 0.5, end: 0 }, tint: 0xd8d8e0, frequency: 700,
      }).setDepth(cy + 200);
      this.buckets.get(this.bucketOf(cx, cy + 200))?.push(smoke) ?? this.buckets.set(this.bucketOf(cx, cy + 200), [smoke]);
      smoke.setVisible(false);
    }
    // treasure chests
    for (const c of w.chests) {
      const img = this.add.image(c.x, c.y, "chest").setOrigin(0.5, 1).setDepth(c.y);
      const arrow = this.add.image(c.x, c.y - 130, "icon_gift").setScale(0.5).setDepth(c.y + 1);
      this.tweens.add({ targets: arrow, y: c.y - 150, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.addStatic(img, c.x, c.y);
      this.addStatic(arrow, c.x, c.y);
      this.chests.push({ id: c.id, img, arrow, x: c.x, y: c.y });
    }
    this.refreshChests();
    // clouds over lands you have not reached yet
    for (let y = 100; y < WORLD; y += 230) {
      for (let x = 80; x < WORLD; x += 260) {
        const jx = x + ((x * 7 + y * 3) % 90) - 45;
        const jy = y + ((x * 3 + y * 11) % 70) - 35;
        const r = regionAt(jx, jy);
        if (regionUnlocked(r, save.bestStage)) continue;
        const cloud = this.add.image(jx, jy, "cloud").setDepth(7000 + jy).setScale(1.5 + ((x + y) % 5) * 0.08).setFlipX((x + y) % 2 === 0);
        this.tweens.add({ targets: cloud, x: jx + 30, duration: 4000 + ((x * y) % 3000), yoyo: true, repeat: -1, ease: "Sine.inOut" });
        if (!this.fog.has(r.id)) this.fog.set(r.id, []);
        this.fog.get(r.id)!.push(cloud);
        this.addStatic(cloud, jx, jy);
      }
    }
    for (const r of REGIONS) {
      if (regionUnlocked(r, save.bestStage)) continue;
      const [x, y] = r.heart;
      const label = this.add.container(x, y, [
        this.add.image(0, -70, "icon_lock").setScale(1.4),
        text(this, 0, 30, r.name, 64),
        text(this, 0, 96, `Reach stage ${r.from}`, 44, "#ffe680"),
      ]).setDepth(8800);
      this.fogLabels.set(r.id, label);
    }
  }

  /** Clouds on the minimap, drawn once (and again when a land opens). */
  private drawMiniFog(): void {
    const key = `minifog_${REGIONS.filter((r) => regionUnlocked(r, save.bestStage)).length}`;
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, 200, 200)!;
      const ctx = tex.getContext();
      ctx.fillStyle = "rgba(232,236,246,0.9)";
      for (let y = 0; y < 200; y += 5) {
        for (let x = 0; x < 200; x += 5) {
          if (this.isLocked(((x + 2.5) / 200) * WORLD, ((y + 2.5) / 200) * WORLD)) ctx.fillRect(x, y, 5, 5);
        }
      }
      tex.refresh();
    }
    this.miniFog.setTexture(key);
  }

  /** Remove the clouds over a land (when you first reach it). */
  private clearFog(id: RegionId, animate: boolean): void {
    const clouds = this.fog.get(id) ?? [];
    const [hx, hy] = REGIONS.find((r) => r.id === id)!.heart;
    for (const c of clouds) {
      this.tweens.killTweensOf(c);
      for (const list of this.buckets.values()) {
        const i = list.indexOf(c);
        if (i >= 0) list.splice(i, 1);
      }
      if (!animate) {
        c.destroy();
        continue;
      }
      c.setVisible(true);
      const d = Phaser.Math.Distance.Between(c.x, c.y, hx, hy);
      this.tweens.add({
        targets: c, scale: c.scale * 1.8, alpha: 0, x: c.x + (c.x - hx) * 0.4, y: c.y + (c.y - hy) * 0.4,
        delay: d * 0.5, duration: 900, ease: "Quad.out", onComplete: () => c.destroy(),
      });
    }
    this.fog.delete(id);
    const label = this.fogLabels.get(id);
    if (label) {
      this.tweens.add({ targets: label, scale: 1.4, alpha: 0, duration: 500, onComplete: () => label.destroy() });
      this.fogLabels.delete(id);
    }
  }

  private isLocked(x: number, y: number): boolean {
    return !regionUnlocked(regionAt(x, y), save.bestStage);
  }

  /** The land whose heart we defend follows the stage number. */
  private useFight(): void {
    this.fight = regionForStage(save.stage);
    const open = REGIONS.filter((r) => regionUnlocked(r, save.bestStage)).map((r) => r.id);
    this.flow = flowField(this.world, this.fight.id, open);
    for (const p of this.portalSwirls) {
      const active = p.region === this.fight.id;
      this.tweens.killTweensOf(p.img);
      p.img.setAlpha(active ? 1 : 0.25);
      if (active) this.tweens.add({ targets: p.img, angle: 360, duration: 2400, repeat: -1 });
    }
  }

  private refreshChests(): void {
    const now = Date.now();
    for (const c of this.chests) {
      const ready = (save.chests[c.id] ?? 0) <= now && !this.isLocked(c.x, c.y);
      c.img.setTexture(ready ? "chest" : "chest_open").setAlpha(ready ? 1 : 0.7);
      c.arrow.setAlpha(ready ? 1 : 0);
    }
  }

  private openChest(c: ChestView): void {
    save.chests[c.id] = Date.now() + CHEST_RESPAWN;
    const cash = Math.max(300, save.cashPerSec * 45) * chestMult();
    const gems = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 4) : 0;
    save.cash += cash;
    save.gems += gems;
    persist();
    sfx.fanfare();
    buzz(80);
    this.refreshChests();
    this.tweens.add({ targets: c.img, scaleX: 1.25, scaleY: 0.8, duration: 90, yoyo: true });
    this.sparks.setParticleTint(0xffe066);
    this.sparks.explode(30, c.x, c.y - 50);
    this.flyCash(c.x, c.y - 60, 12);
    this.game.events.emit("toast", `Treasure! +${fmt(cash)} money${gems ? `  +${gems} gems` : ""}`, "#ffe066");
  }

  // ───────────────────────── controls ─────────────────────────

  /** Drag anywhere in the open play area for a floating joystick (WASD / arrows on desktop). */
  private setupControls(): void {
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.joy.active || battle.cutscene || p.y < this.L.hudBottom + 10 || p.y > this.L.slotsY - 80) return;
      if (p.x < 240 && p.y < this.L.hudBottom + 240) return;
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

  /** Move a walker, sliding along walls and never into a land that is still clouded over. */
  private walk(x: number, y: number, vx: number, vy: number, r: number): [number, number] {
    let [nx, ny] = pushOut(x + vx, y + vy, r, this.world.colliders);
    if (this.isLocked(nx, ny)) {
      [nx, ny] = pushOut(x + vx, y, r, this.world.colliders);
      if (this.isLocked(nx, ny)) [nx, ny] = pushOut(x, y + vy, r, this.world.colliders);
      if (this.isLocked(nx, ny)) return [x, y];
    }
    return [nx, ny];
  }

  private moveHero(time: number, delta: number): void {
    const k = this.keys;
    let vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (this.joy.active && Math.hypot(this.joy.dx, this.joy.dy) > 8) {
      vx = this.joy.dx / 90;
      vy = this.joy.dy / 90;
    }
    if (battle.cutscene) {
      vx = 0;
      vy = 0;
    } else if (vx || vy) {
      this.lastManual = time;
    } else if (save.autoHunt && time - this.lastManual > 1500) {
      // auto-hunt: chase the closest monster, or walk back to guard the heart
      const [hx, hy] = this.fight.heart;
      const target = this.nearestEnemy(this.hero.x, this.hero.y, 1500, true) ?? this.nearestEnemy(hx, hy, 1600, true);
      const [tx, ty, stop] = target ? [target.img.x, target.img.y, HERO_RANGE * rangeMult() * 0.55] : [hx, hy + 220, 50];
      const d = Math.hypot(tx - this.hero.x, ty - this.hero.y);
      if (d > stop) {
        const dir = d > 500 ? flowDir(this.flow, this.hero.x, this.hero.y) : null;
        vx = dir && !target ? dir[0] : (tx - this.hero.x) / d;
        vy = dir && !target ? dir[1] : (ty - this.hero.y) / d;
      }
    }
    const len = Math.hypot(vx, vy);
    if (len > 1) {
      vx /= len;
      vy /= len;
    }
    if (len > 0.05) {
      const step = (HERO_SPEED * moveSpeedMult() * delta) / 1000;
      const [nx, ny] = this.walk(this.hero.x, this.hero.y, vx * step, vy * step, 30);
      this.hero.setPosition(nx, ny).setScale(1);
      if (Math.abs(vx) > 0.1) this.hero.setFlipX(vx < 0);
      this.walkTimer += delta;
      if (this.walkTimer > 130) {
        this.walkTimer = 0;
        this.walkFrame ^= 1;
        this.hero.setTexture(this.walkFrame ? "hero_w1" : "hero_w2");
      }
    } else {
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
    // treasure chests open when you walk up to them
    for (const c of this.chests) {
      if (c.arrow.alpha > 0 && Math.abs(c.x - this.hero.x) < 90 && Math.abs(c.y - this.hero.y) < 70) this.openChest(c);
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

  /** Pets trail the hero in a loose formation, bump into walls like everyone else, and hop. */
  private movePets(time: number, delta: number): void {
    const k = 1 - Math.exp((-delta / 1000) * 5);
    this.pets.forEach((p, i) => {
      const tx = this.hero.x + p.ox;
      const ty = this.hero.y + p.oy;
      const dx = tx - p.img.x;
      const dy = ty - p.img.y;
      const far = Math.hypot(dx, dy);
      if (far > 520) {
        // got stuck behind something: hop back to the hero in a puff
        this.puff.setParticleTint(0xffffff);
        this.puff.explode(8, p.img.x, p.img.y - 40);
        p.img.setPosition(this.hero.x + p.ox * 0.4, this.hero.y + p.oy * 0.4);
        this.puff.explode(8, p.img.x, p.img.y - 40);
      } else {
        const [nx, ny] = this.walk(p.img.x, p.img.y, dx * k, dy * k, 20);
        p.img.setPosition(nx, ny);
      }
      if (Math.abs(dx) > 4) p.img.setFlipX(dx < 0);
      const hop = far > 12 ? Math.abs(Math.sin(time / 110 + i)) * 0.08 : Math.sin(time / 400 + i) * 0.03;
      if (p.img.scaleX > 0.5) p.img.setScale(PET_SCALE * (1 + hop * 0.6), PET_SCALE * (1 - hop));
      p.img.setDepth(p.img.y);
    });
  }

  private petDamage(p: Pet): number {
    return p.def.damage * levelMult(p.level);
  }

  /** Team damage multiplier: tree upgrades plus "buff" pets. */
  private damageMult(): number {
    const buff = this.pets.filter((p) => p.def.kind === "buff").reduce((s, p) => s + this.petDamage(p) / 100, 0);
    return dmgMult() * (1 + buff);
  }

  private heroDamage(): number {
    const team = this.pets.filter((p) => p.def.kind !== "buff").reduce((s, p) => s + this.petDamage(p), 0);
    return (HERO_BASE_DMG + team * HERO_TEAM_SHARE) * this.damageMult() * heroDmgMult();
  }

  // ───────────────────────── waves and stages ─────────────────────────

  private startWave(): void {
    this.useFight();
    const { stage, wave } = save;
    const boss = wave === WAVES_PER_STAGE;
    const [a, b, f] = this.fight.enemies;
    const types: Record<string, EnemyType> = {
      a: { tex: a, stats: WALKER_A, fx: 0x9ad46a },
      b: { tex: b, stats: WALKER_B, fx: 0xef6a5a },
      f: { tex: f, stats: FLYER, fx: 0x8a6ad0, flying: true },
    };
    this.spawnQueue = [];
    const n = waveSize(stage, wave);
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      this.spawnQueue.push(wave >= 3 && r < 0.25 ? types.f : (wave >= 2 || stage > 1) && r < 0.55 ? types.b : types.a);
    }
    if (boss) this.spawnQueue.splice(1, 0, { tex: this.fight.boss, stats: BOSS, fx: 0xffb03b, boss: true });
    this.waveSize = this.spawnQueue.length;
    this.kills = 0;
    this.villageMax = VILLAGE_HP * villageHpMult();
    this.villageHp = this.villageMax;
    this.warned = false;
    this.spawnTimer = 900;
    if (wave === 1) this.stageEarned = 0;
    if (boss) {
      sfx.alarm();
      buzz(120);
    }
    ribbonBanner(this, GAME_W / 2, this.L.hudBottom + 150, boss ? "BOSS!" : `WAVE ${stage}-${wave}`, boss ? "red" : "peach", 900);
  }

  private waveCleared(): void {
    questEvent("wave");
    if (save.wave < WAVES_PER_STAGE) {
      save.wave++;
      persist();
      sfx.levelUp();
      this.game.events.emit("wave-cleared");
      this.waveDelay = 1500;
      return;
    }
    // stage cleared: slow motion, then the celebration
    const gems = gemsPerBoss();
    save.gems += gems;
    const cleared = save.stage;
    const beforeBest = save.bestStage;
    if (save.stage < MAX_STAGE) save.stage++;
    save.wave = 1;
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
    this.game.events.emit("stage-clear", { stage: cleared, earned: this.stageEarned, gems, final: cleared === MAX_STAGE });
    this.game.events.emit("stage-up");
    this.waveDelay = 3600;
    const newLand = REGIONS.find((r) => r.from > beforeBest && r.from <= save.bestStage);
    if (newLand) this.time.delayedCall(3000, () => this.landCutscene(newLand));
  }

  /** Camera flies to the new land, the clouds blow away, then back to the hero. */
  private landCutscene(r: Region): void {
    battle.cutscene = true;
    this.waveDelay = 999999;
    const cam = this.cameras.main;
    cam.stopFollow();
    const [x, y] = r.heart;
    cam.pan(x, y, 1300, "Sine.easeInOut");
    this.time.delayedCall(1300, () => {
      this.clearFog(r.id, true);
      this.drawMiniFog();
      sfx.fanfare();
      buzz(150);
      this.game.events.emit("land-unlocked", r.name);
      save.regionShown = Math.max(save.regionShown, REGIONS.indexOf(r));
      persist();
      this.refreshChests();
      this.useFight();
    });
    this.time.delayedCall(4300, () => {
      cam.pan(this.hero.x, this.hero.y + (this.scale.height / 2 - (this.L.hudBottom + this.L.slotsY - 120) / 2), 1000, "Sine.easeInOut");
    });
    this.time.delayedCall(5400, () => {
      const playCenter = (this.L.hudBottom + this.L.slotsY - 120) / 2;
      cam.startFollow(this.hero, true, 0.12, 0.12, 0, playCenter - this.scale.height / 2);
      battle.cutscene = false;
      this.waveDelay = 600;
    });
  }

  private villageFell(): void {
    this.enemies.forEach((e) => e.img.destroy());
    this.shots.forEach((s) => s.img.destroy());
    this.enemies = [];
    this.shots = [];
    this.spawnQueue = [];
    save.wave = Math.max(1, save.wave - 1);
    persist();
    sfx.error();
    this.cameras.main.shake(400, 0.01);
    ribbonBanner(this, GAME_W / 2, this.L.hudBottom + 150, "HEART FELL!", "red", 1400);
    this.game.events.emit("toast", "Get stronger pets or upgrades and try again!", "#ffb3b3");
    this.waveDelay = 2200;
  }

  // ───────────────────────── loop ─────────────────────────

  update(time: number, delta: number): void {
    this.trackStats(delta);
    this.moveHero(time, delta);
    this.movePets(time, delta);

    if (this.waveDelay > 0) {
      this.waveDelay -= delta;
      if (this.waveDelay <= 0) this.startWave();
    } else {
      this.spawn(delta);
      if (this.spawnQueue.length === 0 && this.enemies.length === 0) this.waveCleared();
    }
    battle.progress = this.kills / this.waveSize;
    battle.village = this.villageHp / this.villageMax;
    const boss = this.enemies.find((e) => e.type.boss);
    battle.bossFrac = boss ? boss.hp / boss.maxHp : -1;

    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.combo = battle.combo = 0;
        this.comboText.setVisible(false);
      }
    }
    this.comboText.setPosition(this.hero.x, this.hero.y - 250);

    this.moveEnemies(time, delta);
    this.heroAttack(delta);
    this.petAttacks(time, delta);
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
    this.regionTimer -= delta;
    if (this.regionTimer <= 0) {
      this.regionTimer = 1000;
      const here = regionAt(this.hero.x, this.hero.y);
      if (here.id !== battle.here) {
        battle.here = here.id;
        this.ambient.setParticleTint(here.ambient);
        this.game.events.emit("entered-land", here.name);
      }
      this.refreshChests();
    }
  }

  private spawn(delta: number): void {
    if (!this.spawnQueue.length || battle.cutscene) return;
    this.spawnTimer -= delta;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = Phaser.Math.Between(SPAWN_MIN, SPAWN_MAX);
    const type = this.spawnQueue.shift()!;
    const { stage, wave } = save;
    const portals = this.world.portals[this.fight.id];
    const [gx, gy] = portals[Phaser.Math.Between(0, portals.length - 1)];
    const x = gx + Phaser.Math.Between(-40, 40);
    const y = gy + Phaser.Math.Between(-20, 30);
    const img = this.add.image(x, y, type.tex).setOrigin(0.5, type.flying ? 0.5 : 0.94).setDepth(y).setAlpha(0).setScale(0.3);
    this.tweens.add({ targets: img, alpha: 1, scale: 1, duration: 350, ease: "Back.out" });
    if (type.flying) this.tweens.add({ targets: img, scaleY: 0.85, duration: 160, yoyo: true, repeat: -1, delay: 350 });
    else this.tweens.add({ targets: img, angle: { from: -5, to: 5 }, duration: 260, yoyo: true, repeat: -1, ease: "Sine.inOut", delay: 350 });
    const hp = Math.round(monsterHp(type.stats.hp, stage, wave));
    this.enemies.push({
      img, type, hp, maxHp: hp,
      cash: monsterCash(type.stats.cash, stage),
      stopR: type.boss ? 230 : Phaser.Math.Between(150, 230),
      flashUntil: 0, attacking: false, atkTimer: 0,
    });
    if (type.boss) {
      this.cameras.main.shake(500, 0.008);
      this.game.events.emit("toast", "A BOSS is coming!", "#ff9a9a");
    }
  }

  /** Monsters follow the paths to the heart and chip away at its health. */
  private moveEnemies(time: number, delta: number): void {
    const [hx, hy] = this.fight.heart;
    const ty = hy + 40;
    for (const e of this.enemies) {
      const dx = hx - e.img.x;
      const dy = ty - e.img.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > e.stopR) {
        const step = (e.type.stats.speed * delta) / 1000;
        let dir: [number, number] = [dx / d, dy / d];
        if (!e.type.flying && d > 280) dir = flowDir(this.flow, e.img.x, e.img.y) ?? dir;
        let nx = e.img.x + dir[0] * step;
        let ny = e.img.y + dir[1] * step;
        if (!e.type.flying) [nx, ny] = pushOut(nx, ny, 24, this.world.colliders);
        e.img.setPosition(nx, ny).setDepth(ny);
        if (Math.abs(dir[0]) > 0.2) e.img.setFlipX(dir[0] < 0);
      } else {
        if (!e.attacking) {
          e.attacking = true;
          if (!this.warned) {
            this.warned = true;
            this.game.events.emit("toast", `${this.fight.name} is under attack!`, "#ff9a9a");
            sfx.alarm();
          }
        }
        e.atkTimer -= delta;
        if (e.atkTimer <= 0) {
          e.atkTimer = 1000;
          this.tweens.add({ targets: e.img, x: e.img.x + (dx / d) * 24, y: e.img.y + (dy / d) * 24, duration: 90, yoyo: true });
          this.villageHp -= e.type.stats.dmg;
          if (this.villageHp <= 0) {
            this.villageFell();
            return;
          }
        }
      }
      if (e.flashUntil && time > e.flashUntil) {
        e.flashUntil = 0;
        e.img.clearTint();
      }
    }
  }

  // ───────────────────────── attacking ─────────────────────────

  private nearestEnemy(x: number, y: number, range: number, any = false): Enemy | undefined {
    let best: Enemy | undefined;
    let bestD = range * range;
    for (const e of this.enemies) {
      if (!any && e.img.alpha < 0.9) continue;
      const d = (e.img.x - x) ** 2 + (e.img.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private heroAttack(delta: number): void {
    const target = this.nearestEnemy(this.hero.x, this.hero.y, HERO_RANGE * rangeMult());
    const aim = target
      ? Math.atan2(target.img.y - target.img.displayHeight * 0.4 - this.gun.y, target.img.x - this.gun.x)
      : this.hero.flipX ? Math.PI : 0;
    this.gun.setRotation(Phaser.Math.Angle.RotateTo(this.gun.rotation, aim, target ? 0.3 : 0.15));
    this.gun.setFlipY(Math.abs(this.gun.rotation) > Math.PI / 2);
    this.heroTimer -= delta;
    if (this.heroTimer > 0 || !target || battle.cutscene) return;
    this.heroTimer = HERO_FIRE_MS;
    const mx = this.gun.x + Math.cos(this.gun.rotation) * 110;
    const my = this.gun.y + Math.sin(this.gun.rotation) * 110;
    this.fire(mx, my, target, this.heroDamage(), "bolt", 0xffffff, 0, 1);
    sfx.shoot();
    // a little recoil
    this.gun.x -= Math.cos(this.gun.rotation) * 8;
    const flash = this.add.image(mx, my, "flash").setDepth(9050).setScale(0.5);
    this.tweens.add({ targets: flash, scale: 0.9, alpha: 0, duration: 110, onComplete: () => flash.destroy() });
  }

  private petAttacks(time: number, delta: number): void {
    const mult = this.damageMult();
    for (const p of this.pets) {
      p.timer -= delta;
      if (p.def.kind === "buff") {
        if (p.timer <= 0) {
          p.timer = 2200;
          this.sparks.setParticleTint(0xffe680);
          this.sparks.explode(5, p.img.x, p.img.y - 80);
        }
        continue;
      }
      if (p.timer > 0) continue;
      const near = this.enemies.filter((e) => e.img.alpha >= 0.9 && Phaser.Math.Distance.Between(e.img.x, e.img.y, p.img.x, p.img.y) < PET_RANGE * rangeMult());
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
          picks.forEach((t) => {
            const ty = t.img.y - t.img.displayHeight * 0.4;
            this.strikes.push({ x1: t.img.x, y1: ty - 600, x2: t.img.x, y2: ty, until: time + 160, color, beam: false });
            const f = this.add.image(t.img.x, ty, "flash").setTint(color).setDepth(9050).setScale(1.2);
            this.tweens.add({ targets: f, scale: 1.9, alpha: 0, duration: 220, onComplete: () => f.destroy() });
            this.hit(t, dmg);
          });
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
        this.boom(s.tx, s.ty, 0.9);
        for (const e of [...this.enemies]) {
          if (Phaser.Math.Distance.Between(e.img.x, e.img.y - e.img.displayHeight * 0.4, s.tx, s.ty) < s.splash) this.hit(e, s.dmg);
        }
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

  private hit(e: Enemy, dmg: number): void {
    if (!this.enemies.includes(e)) return;
    const crit = Math.random() < critChance();
    const amount = Math.max(1, Math.round(dmg * (crit ? critDamage() : 1) * Phaser.Math.FloatBetween(0.9, 1.1)));
    e.hp -= amount;
    this.dmgWindow += amount;
    e.img.setTintFill(0xffffff);
    e.flashUntil = this.time.now + 70;
    sfx.hit();
    const hy = e.img.y - e.img.displayHeight * (e.type.flying ? 0.5 : 0.9);
    this.sparks.setParticleTint(0xffffff);
    this.sparks.explode(3, e.img.x, hy + 30);
    if (crit) this.boom(e.img.x, hy + 30, 0.55);
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

  private kill(e: Enemy): void {
    this.enemies = this.enemies.filter((o) => o !== e);
    this.kills++;
    save.totalKills++;
    this.combo++;
    battle.combo = this.combo;
    this.comboTimer = 2200;
    if (this.combo >= 5) {
      const c = this.combo;
      this.comboText.setText(`x${c} COMBO!`).setColor(c >= 50 ? "#ff6a8a" : c >= 20 ? "#ffb347" : "#ffe066").setVisible(true).setScale(1.35);
      this.tweens.add({ targets: this.comboText, scale: 1, duration: 150 });
      if (c % 10 === 0) sfx.lucky();
    }
    const cy = e.img.y - e.img.displayHeight * 0.4;
    this.puff.setParticleTint(e.type.fx);
    this.puff.explode(e.type.boss ? 60 : 14, e.img.x, cy);
    this.boom(e.img.x, cy, e.type.boss ? 2.4 : 0.8);
    // combos pay up to +100% extra
    const cash = e.cash * cashMult() * (1 + Math.min(this.combo, 100) * 0.01);
    save.cash += cash;
    this.earnedWindow += cash;
    this.stageEarned += cash;
    questEvent("kill");
    if (e.type.boss) questEvent("boss");
    if (this.combo >= 5) questEvent("combo", this.combo);
    this.game.events.emit("kill", e.type.boss);
    this.cashPop(e.img.x, cy - 40, cash);
    this.flyCash(e.img.x, cy, e.type.boss ? 14 : 2);
    if (e.type.boss) {
      this.cameras.main.shake(500, 0.014);
      this.cameras.main.flash(200, 255, 240, 200);
      buzz(200);
    }
    this.tweens.killTweensOf(e.img);
    this.tweens.add({ targets: e.img, scale: e.type.boss ? 1.4 : 0, alpha: 0, angle: 30, duration: e.type.boss ? 500 : 160, onComplete: () => e.img.destroy() });
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
    this.bars.clear();
    for (const e of this.enemies) {
      if (e.hp >= e.maxHp && !e.type.boss) continue;
      const w = e.type.boss ? 240 : 88;
      const y = e.img.y - e.img.displayHeight * (e.type.flying ? 0.5 : 0.95) - 18;
      drawBar(this.bars, e.img.x - w / 2, y, w, e.type.boss ? 22 : 12, e.hp / e.maxHp, e.type.boss ? 0xf26464 : 0x7ad651);
    }
    const [hx, hy] = this.fight.heart;
    const f = this.villageHp / this.villageMax;
    drawBar(this.bars, hx - 120, hy - 300, 240, 24, f, f > 0.4 ? 0x67c3ff : 0xf26464);
  }

  /** Minimap dots, plus arrows pointing at monsters attacking the heart off screen. */
  private drawOverlay(): void {
    const g = this.overlay;
    g.clear();
    const mx = 22;
    const my = this.L.hudBottom + 24;
    const s = 200 / WORLD;
    g.lineStyle(6, INK_N, 1).strokeRoundedRect(mx - 3, my - 3, 206, 206, 12);
    const [hx, hy] = this.fight.heart;
    g.fillStyle(0x67c3ff, 1).fillCircle(mx + hx * s, my + hy * s, 6);
    g.lineStyle(2, 0xffffff, 1).strokeCircle(mx + hx * s, my + hy * s, 6);
    g.fillStyle(0xffd23f, 1);
    for (const c of this.chests) if (c.arrow.alpha > 0) g.fillRect(mx + c.x * s - 3, my + c.y * s - 3, 6, 6);
    g.fillStyle(0xf26464, 1);
    for (const e of this.enemies) g.fillCircle(mx + e.img.x * s, my + e.img.y * s, e.type.boss ? 5 : 2.5);
    g.fillStyle(0xffffff, 1).fillCircle(mx + this.hero.x * s, my + this.hero.y * s, 5);
    g.lineStyle(3, 0xff8a3a, 1).strokeCircle(mx + this.hero.x * s, my + this.hero.y * s, 5);
    const cam = this.cameras.main;
    g.lineStyle(2, 0xffffff, 0.7).strokeRect(mx + cam.scrollX * s, my + cam.scrollY * s, cam.width * s, cam.height * s);

    const top = this.L.hudBottom + 30;
    const bottom = this.L.slotsY - 120;
    const cxs = GAME_W / 2;
    const cys = (top + bottom) / 2;
    const targets = this.enemies.filter((e) => e.attacking).slice(0, 5);
    if (!targets.length && Math.hypot(this.hero.x - hx, this.hero.y - hy) > 900 && this.enemies.length) targets.push(this.enemies[0]);
    for (const e of targets) {
      const sx = e.img.x - cam.scrollX;
      const sy = e.img.y - cam.scrollY;
      if (sx > 0 && sx < GAME_W && sy > top && sy < bottom) continue;
      const a = Math.atan2(sy - cys, sx - cxs);
      const ax = Phaser.Math.Clamp(cxs + Math.cos(a) * 2000, 50, GAME_W - 50);
      const ay = Phaser.Math.Clamp(cys + Math.sin(a) * 2000, top + 20, bottom - 20);
      const pt = (o: number, r: number) => [ax + Math.cos(a + o) * r, ay + Math.sin(a + o) * r];
      const [p1, p2, p3] = [pt(0, 32), pt(2.4, 26), pt(-2.4, 26)];
      g.fillStyle(e.attacking ? 0xf26464 : 0xffb347, 0.95).fillTriangle(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
      g.lineStyle(4, INK_N, 1).strokeTriangle(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
    }
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
