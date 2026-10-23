import Phaser from "phaser";
import { HERO_HAND } from "../art/characters";
import { INK_N } from "../art/draw";
import { petTexture } from "../art/pets";
import { makeVillageTextures } from "../art/village";
import { AREA_BY_ID, AreaDef } from "../data/areas";
import { ItemDef, VARIANT_INFO, Variant, parseKey } from "../data/items";
import { rainbowColor } from "../data/rarity";
import { WORLD_H, WORLD_W, World, buildWorld, pushOut } from "../game/world";
import { GAME_W, Layout, layoutFor } from "../layout";
import { persist, save } from "../systems/save";
import { questEvent } from "../systems/goals";
import { sfx } from "../systems/sound";
import { cashMult, critChance, dmgMult, gemsPerBoss } from "../systems/stats";
import { fmt } from "../ui/format";
import { drawBar, ribbonBanner, text } from "../ui/widgets";

export const WAVES_PER_STAGE = 5;
const VILLAGE_HP = 100;
const HERO_SPEED = 430;
const HERO_RANGE = 580;
const PET_RANGE = 650;

/** Where coins fly to (the money counter in the HUD, screen coordinates). */
export const CASH_TARGET = { x: GAME_W - 300, y: 150 };

/** Live numbers the HUD (UI scene) shows. */
export const battle = { progress: 0, bossFrac: -1, village: 1, dps: 0, combo: 0 };

interface EnemyType {
  tex: string;
  fx: number;
  hp: number;
  speed: number;
  cash: number;
  dmg: number;
  originY: number;
  flying?: boolean;
  boss?: boolean;
}

const ENEMIES: Record<string, EnemyType> = {
  slime: { tex: "e_slime", fx: 0xb07cff, hp: 30, speed: 85, cash: 2, dmg: 2, originY: 0.92 },
  mush: { tex: "e_mush", fx: 0xef4a5a, hp: 55, speed: 65, cash: 3, dmg: 3, originY: 0.94 },
  bat: { tex: "e_bat", fx: 0x8a6ad0, hp: 20, speed: 130, cash: 2, dmg: 2, originY: 0.5, flying: true },
  boss: { tex: "e_golem", fx: 0xa7adba, hp: 900, speed: 50, cash: 40, dmg: 12, originY: 0.94, boss: true },
};

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
  variant: Variant;
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

const PET_SPOTS = [[-150, 30], [150, 30], [-95, 125], [95, 125], [-245, 100], [245, 100]];
const PET_SCALE = 0.7;
const NO_JOY = { active: false, id: -1, bx: 0, by: 0, dx: 0, dy: 0 };

/** The village: walk around with the cat gunner, pets follow, monsters attack the fountain. */
export class BattleScene extends Phaser.Scene {
  private L!: Layout;
  private area!: AreaDef;
  private world!: World;
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
  private warned = false;
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
    this.area = AREA_BY_ID[save.area] ?? AREA_BY_ID.village;
    makeVillageTextures(this, this.area.theme);
    this.world = buildWorld(this.area);
    this.pets = [];
    this.enemies = [];
    this.shots = [];
    this.strikes = [];
    this.spawnQueue = [];
    this.dmgTexts = [];
    this.cashTexts = [];
    this.waveDelay = 0;
    this.flyingCash = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.lastManual = -99999;
    this.joy = { ...NO_JOY };
    battle.dps = 0;
    battle.combo = 0;
    this.cameras.main.fadeIn(350, 74, 47, 29);
    this.drawWorld();

    const { heart } = this.world;
    this.hero = this.add.image(heart.x, heart.y + 190, "hero").setOrigin(0.5, 0.95);
    this.gun = this.add.image(0, 0, "gun").setOrigin(38 / 142, 0.47);
    // keep the hero in the middle of the open play area (between the HUD and the bottom panel)
    const playCenter = (this.L.hudBottom + this.L.slotsY - 120) / 2;
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.hero, true, 0.12, 0.12, 0, playCenter - this.scale.height / 2);

    this.fx = this.add.graphics().setDepth(9000);
    this.bars = this.add.graphics().setDepth(9100);
    this.overlay = this.add.graphics().setScrollFactor(0).setDepth(9500);
    this.joyG = this.add.graphics().setScrollFactor(0).setDepth(9600);
    this.puff = this.add.particles(0, 0, "puff", { speed: { min: 80, max: 340 }, lifespan: 500, scale: { start: 1.2, end: 0 }, emitting: false }).setDepth(8900);
    this.sparks = this.add.particles(0, 0, "spark", {
      speed: { min: 120, max: 360 }, lifespan: 320, scale: { start: 0.7, end: 0 }, rotate: { min: 0, max: 90 }, emitting: false,
    }).setDepth(8950);
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
    this.game.events.on("pets-changed", this.buildPets, this);
    this.events.once("shutdown", () => this.game.events.off("pets-changed", this.buildPets, this));
    this.startWave();
  }

  // ───────────────────────── world ─────────────────────────

  private drawWorld(): void {
    const t = this.area.theme;
    const w = this.world;
    this.add.tileSprite(0, 0, WORLD_W, WORLD_H, `grass_${t.grass.toString(16)}`).setOrigin(0).setDepth(-1000);
    // ground shapes are drawn once into a half-size texture (redrawing Graphics every frame is slow on phones)
    const g = this.make.graphics({}, false);
    const darker = (c: number, n: number) => Phaser.Display.Color.ValueToColor(c).darken(n).color;
    for (const f of w.fields) {
      g.fillStyle(INK_N, 1).fillRoundedRect(f.x - 6, f.y - 6, f.w + 12, f.h + 12, 18);
      g.fillStyle(t.soil, 1).fillRoundedRect(f.x, f.y, f.w, f.h, 14);
      g.fillStyle(darker(t.soil, 12), 1);
      for (let r = 0; r < 4; r++) g.fillRoundedRect(f.x + 16, f.y + 54 + r * 68, f.w - 32, 18, 8);
    }
    for (const pts of w.roads) {
      for (const [width, color] of [[176, t.pathEdge], [150, t.path]] as [number, number][]) {
        g.lineStyle(width, color, 1).beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.strokePath();
        for (const [x, y] of pts) g.fillStyle(color, 1).fillCircle(x, y, width / 2);
      }
    }
    const { heart, plazaR, pond } = w;
    g.fillStyle(t.pathEdge, 1).fillCircle(heart.x, heart.y, plazaR + 14);
    g.fillStyle(t.plaza, 1).fillCircle(heart.x, heart.y, plazaR);
    g.lineStyle(5, darker(t.plaza, 12), 1);
    for (const r of [plazaR * 0.45, plazaR * 0.75]) g.strokeCircle(heart.x, heart.y, r);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.lineBetween(heart.x + Math.cos(a) * plazaR * 0.45, heart.y + Math.sin(a) * plazaR * 0.45, heart.x + Math.cos(a) * plazaR, heart.y + Math.sin(a) * plazaR);
    }
    g.fillStyle(INK_N, 1).fillEllipse(pond.x, pond.y, pond.rx * 2 + 12, pond.ry * 2 + 12);
    g.fillStyle(t.pathEdge, 1).fillEllipse(pond.x, pond.y, pond.rx * 2, pond.ry * 2);
    g.fillStyle(t.water, 1).fillEllipse(pond.x, pond.y + 4, pond.rx * 2 - 22, pond.ry * 2 - 20);
    g.fillStyle(0xffffff, 0.5).fillEllipse(pond.x - 50, pond.y - 25, 60, 14);
    if (!t.snow) for (const [dx, dy] of [[40, 20], [-70, 30], [80, -30]]) g.fillStyle(0x6fbf4a, 1).fillCircle(pond.x + dx, pond.y + dy, 14);
    g.setScale(0.5);
    this.add.renderTexture(0, 0, WORLD_W / 2, WORLD_H / 2).setOrigin(0).setScale(2).setDepth(-900).draw(g);
    g.destroy();

    const noFlip = (tex: string) => tex.startsWith("house") || tex === "barn" || tex === "lamp" || tex === "fountain";
    for (const o of w.objects) this.add.image(o.x, o.y, o.tex).setOrigin(0.5, 1).setDepth(o.y).setFlipX(!!o.flip && !noFlip(o.tex));
    if (w.windmill) {
      const blades = this.add.image(w.windmill.x, w.windmill.y - 238, "windmill_blades").setDepth(w.windmill.y + 7);
      this.tweens.add({ targets: blades, angle: 360, duration: 6000, repeat: -1 });
    }
    const tint = { village: 0xffc4d6, farm: 0xffb347, woods: 0x9fd47a, frost: 0xffffff }[this.area.id] ?? 0xffffff;
    this.add.particles(0, 0, "petal", {
      x: { min: -100, max: GAME_W }, y: { min: 0, max: 300 }, lifespan: 9000, speedX: { min: 20, max: 60 }, speedY: { min: 40, max: 90 },
      rotate: { start: 0, end: 360 }, alpha: { start: 0.9, end: 0 }, frequency: 450, tint,
    }).setScrollFactor(0).setDepth(9200);
  }

  // ───────────────────────── controls ─────────────────────────

  /** Drag anywhere in the open play area for a floating joystick (WASD / arrows on desktop). */
  private setupControls(): void {
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.joy.active || p.y < this.L.hudBottom + 10 || p.y > this.L.slotsY - 80) return;
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
    if (vx || vy) {
      this.lastManual = time;
    } else if (save.autoHunt && time - this.lastManual > 1500) {
      // auto-hunt: walk toward the closest monster, or back to guard the fountain
      const target = this.nearestEnemy(this.hero.x, this.hero.y, 1400, true);
      const { heart } = this.world;
      const [tx, ty, stop] = target ? [target.img.x, target.img.y, HERO_RANGE * 0.6] : [heart.x, heart.y + 190, 40];
      const d = Math.hypot(tx - this.hero.x, ty - this.hero.y);
      if (d > stop) {
        vx = (tx - this.hero.x) / d;
        vy = (ty - this.hero.y) / d;
      }
    }
    const len = Math.hypot(vx, vy);
    if (len > 1) {
      vx /= len;
      vy /= len;
    }
    if (len > 0.05) {
      const step = (HERO_SPEED * delta) / 1000;
      const [nx, ny] = pushOut(this.hero.x + vx * step, this.hero.y + vy * step, 34, this.world.colliders);
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
    this.pets = save.equipped.slice(0, PET_SPOTS.length).map((key, i) => {
      const { def, variant } = parseKey(key);
      const [ox, oy] = PET_SPOTS[i];
      const img = this.add.image(this.hero.x + ox, this.hero.y + oy, petTexture(this, def.id, variant)).setOrigin(0.5, 0.95).setScale(0);
      this.tweens.add({ targets: img, scale: PET_SCALE, duration: 300, ease: "Back.out" });
      return { def, variant, img, timer: Math.random() * def.cooldown, ox, oy };
    });
  }

  /** Pets trail the hero in a loose formation and hop while they move. */
  private movePets(time: number, delta: number): void {
    const k = 1 - Math.exp((-delta / 1000) * 5);
    this.pets.forEach((p, i) => {
      const dx = this.hero.x + p.ox - p.img.x;
      const dy = this.hero.y + p.oy - p.img.y;
      p.img.x += dx * k;
      p.img.y += dy * k;
      if (Math.abs(dx) > 4) p.img.setFlipX(dx < 0);
      const hop = Math.hypot(dx, dy) > 12 ? Math.abs(Math.sin(time / 110 + i)) * 0.08 : Math.sin(time / 400 + i) * 0.03;
      if (p.img.scaleX > 0.5) p.img.setScale(PET_SCALE * (1 + hop * 0.6), PET_SCALE * (1 - hop));
      p.img.setDepth(p.img.y);
    });
  }

  /** Team damage multiplier: tree upgrades plus "buff" pets. */
  private damageMult(): number {
    const buff = this.pets.filter((p) => p.def.kind === "buff").reduce((s, p) => s + (p.def.damage / 100) * VARIANT_INFO[p.variant].mult, 0);
    return dmgMult() * (1 + buff);
  }

  private heroDamage(): number {
    const team = this.pets.filter((p) => p.def.kind !== "buff").reduce((s, p) => s + p.def.damage * VARIANT_INFO[p.variant].mult, 0);
    return (5 + team * 0.2) * this.damageMult();
  }

  // ───────────────────────── waves ─────────────────────────

  private startWave(): void {
    const { stage, wave } = save;
    const boss = wave === WAVES_PER_STAGE;
    const n = boss ? 8 : 8 + wave * 2 + Math.floor(Math.min(stage, 20) / 2);
    this.spawnQueue = [];
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      if (wave >= 3 && r < 0.25) this.spawnQueue.push(ENEMIES.bat);
      else if ((wave >= 2 || stage > 1) && r < 0.55) this.spawnQueue.push(ENEMIES.mush);
      else this.spawnQueue.push(ENEMIES.slime);
    }
    if (boss) this.spawnQueue.splice(1, 0, ENEMIES.boss);
    this.waveSize = this.spawnQueue.length;
    this.kills = 0;
    this.villageHp = VILLAGE_HP;
    this.warned = false;
    this.spawnTimer = 600;
    if (boss) sfx.alarm();
    ribbonBanner(this, GAME_W / 2, this.L.hudBottom + 150, boss ? "BOSS!" : `WAVE ${stage}-${wave}`, boss ? "red" : "peach", 900);
  }

  private waveCleared(): void {
    if (save.wave >= WAVES_PER_STAGE) {
      save.stage++;
      save.wave = 1;
      save.bestStage = Math.max(save.bestStage, save.stage);
      const gems = gemsPerBoss();
      save.gems += gems;
      this.game.events.emit("toast", `Boss defeated! +${gems} gems`, "#8fe3ff");
      this.game.events.emit("stage-up");
      sfx.levelUp();
      this.cameras.main.flash(250, 255, 245, 200);
    } else {
      save.wave++;
    }
    questEvent("wave");
    this.game.events.emit("wave-cleared");
    persist();
    this.waveDelay = 1500;
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
    ribbonBanner(this, GAME_W / 2, this.L.hudBottom + 150, "VILLAGE FELL!", "red", 1400);
    this.waveDelay = 2000;
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
    battle.village = this.villageHp / VILLAGE_HP;
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
    this.heroAttack(delta);
    this.petAttacks(time, delta);
    this.moveShots(delta);
    this.drawFx(time);
    this.mapTimer -= delta;
    if (this.mapTimer <= 0) {
      this.mapTimer = 100;
      this.drawOverlay();
    }
  }

  private spawn(delta: number): void {
    if (!this.spawnQueue.length) return;
    this.spawnTimer -= delta;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = Phaser.Math.Between(450, 900);
    const type = this.spawnQueue.shift()!;
    const { stage, wave } = save;
    const gates = this.world.gates;
    const [gx, gy] = type.boss ? gates[0] : gates[Phaser.Math.Between(0, gates.length - 1)];
    const x = gx + Phaser.Math.Between(-70, 70);
    const y = gy + Phaser.Math.Between(-40, 40);
    const img = this.add.image(x, y, type.tex).setOrigin(0.5, type.originY).setDepth(y).setAlpha(0);
    this.tweens.add({ targets: img, alpha: 1, duration: 300 });
    if (type.flying) this.tweens.add({ targets: img, scaleY: 0.85, duration: 160, yoyo: true, repeat: -1 });
    else this.tweens.add({ targets: img, angle: { from: -5, to: 5 }, duration: 260, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const hp = Math.round(type.hp * 1.2 ** (stage - 1) * (1 + 0.15 * (wave - 1)) * this.area.hp);
    this.enemies.push({
      img, type, hp, maxHp: hp,
      cash: type.cash * 1.18 ** (stage - 1) * this.area.cash,
      stopR: type.boss ? 230 : Phaser.Math.Between(150, 230),
      flashUntil: 0, attacking: false, atkTimer: 0,
    });
    if (type.boss) this.cameras.main.shake(400, 0.006);
  }

  /** Monsters march on the fountain and chip away at the village's health. */
  private moveEnemies(time: number, delta: number): void {
    const { heart } = this.world;
    for (const e of this.enemies) {
      const dx = heart.x - e.img.x;
      const dy = heart.y - e.img.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > e.stopR) {
        const step = (e.type.speed * delta) / 1000;
        let nx = e.img.x + (dx / d) * step;
        let ny = e.img.y + (dy / d) * step;
        if (!e.type.flying) [nx, ny] = pushOut(nx, ny, 26, this.world.colliders);
        e.img.setPosition(nx, ny).setDepth(ny);
      } else {
        if (!e.attacking) {
          e.attacking = true;
          if (!this.warned) {
            this.warned = true;
            this.game.events.emit("toast", "The village is under attack!", "#ff9a9a");
            sfx.alarm();
          }
        }
        e.atkTimer -= delta;
        if (e.atkTimer <= 0) {
          e.atkTimer = 1000;
          this.tweens.add({ targets: e.img, x: e.img.x + (dx / d) * 24, y: e.img.y + (dy / d) * 24, duration: 90, yoyo: true });
          this.villageHp -= e.type.dmg;
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
    const target = this.nearestEnemy(this.hero.x, this.hero.y, HERO_RANGE);
    const aim = target
      ? Math.atan2(target.img.y - target.img.displayHeight * 0.4 - this.gun.y, target.img.x - this.gun.x)
      : this.hero.flipX ? Math.PI : 0;
    this.gun.setRotation(Phaser.Math.Angle.RotateTo(this.gun.rotation, aim, target ? 0.3 : 0.15));
    this.gun.setFlipY(Math.abs(this.gun.rotation) > Math.PI / 2);
    this.heroTimer -= delta;
    if (this.heroTimer > 0 || !target) return;
    this.heroTimer = 420;
    const mx = this.gun.x + Math.cos(this.gun.rotation) * 95;
    const my = this.gun.y + Math.sin(this.gun.rotation) * 95;
    this.fire(mx, my, target, this.heroDamage(), "bolt", 0xffffff, 0, 1);
    sfx.shoot();
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
      const near = this.enemies.filter((e) => e.img.alpha >= 0.9 && Phaser.Math.Distance.Between(e.img.x, e.img.y, p.img.x, p.img.y) < PET_RANGE);
      if (!near.length) continue;
      p.timer = p.def.cooldown;
      const dmg = p.def.damage * VARIANT_INFO[p.variant].mult * mult;
      const color = p.variant === "rainbow" ? rainbowColor(time) : p.variant === "golden" ? 0xffd84a : p.def.fx;
      const sx = p.img.x;
      const sy = p.img.y - 70;
      const picks = Phaser.Utils.Array.Shuffle(near).slice(0, p.def.count);
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
    const amount = Math.max(1, Math.round(dmg * (crit ? 3 : 1) * Phaser.Math.FloatBetween(0.9, 1.1)));
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
    t.setText(fmt(amount)).setColor(crit ? "#ff5a5a" : "#ffffff").setPosition(x + Phaser.Math.Between(-30, 30), y).setVisible(true).setAlpha(1).setScale(0.5);
    this.tweens.add({ targets: t, scale: crit ? 1.45 : 1, duration: 120, ease: "Back.out" });
    this.tweens.add({ targets: t, y: y - 80, alpha: 0, delay: 300, duration: 450, onComplete: () => t.setVisible(false) });
  }

  private kill(e: Enemy): void {
    this.enemies = this.enemies.filter((o) => o !== e);
    this.kills++;
    this.combo++;
    battle.combo = this.combo;
    this.comboTimer = 2200;
    if (this.combo >= 5) {
      const c = this.combo;
      this.comboText.setText(`x${c} COMBO!`).setColor(c >= 50 ? "#ff6a8a" : c >= 20 ? "#ffb347" : "#ffe066").setVisible(true).setScale(1.3);
      this.tweens.add({ targets: this.comboText, scale: 1, duration: 150 });
    }
    const cy = e.img.y - e.img.displayHeight * 0.4;
    this.puff.setParticleTint(e.type.fx);
    this.puff.explode(e.type.boss ? 60 : 14, e.img.x, cy);
    this.boom(e.img.x, cy, e.type.boss ? 2.2 : 0.8);
    // combos pay up to +100% extra
    const cash = e.cash * cashMult() * (1 + Math.min(this.combo, 100) * 0.01);
    save.cash += cash;
    this.earnedWindow += cash;
    questEvent("kill");
    if (e.type.boss) questEvent("boss");
    if (this.combo >= 5) questEvent("combo", this.combo);
    this.game.events.emit("kill", e.type.boss);
    this.cashPop(e.img.x, cy - 40, cash);
    this.flyCash(e.img.x, cy, e.type.boss ? 10 : 2);
    if (e.type.boss) this.cameras.main.shake(400, 0.012);
    this.tweens.killTweensOf(e.img);
    this.tweens.add({ targets: e.img, scale: 0, alpha: 0, angle: 30, duration: 160, onComplete: () => e.img.destroy() });
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
      const w = e.type.boss ? 220 : 88;
      const y = e.img.y - e.img.displayHeight * (e.type.flying ? 0.5 : 0.95) - 18;
      drawBar(this.bars, e.img.x - w / 2, y, w, e.type.boss ? 20 : 12, e.hp / e.maxHp, e.type.boss ? 0xf26464 : 0x7ad651);
    }
    const { heart } = this.world;
    drawBar(this.bars, heart.x - 110, heart.y - 260, 220, 22, this.villageHp / VILLAGE_HP, this.villageHp > 40 ? 0x67c3ff : 0xf26464);
  }

  /** Minimap, plus arrows pointing at monsters attacking the village off screen. */
  private drawOverlay(): void {
    const g = this.overlay;
    g.clear();
    const mw = 170;
    const mh = (mw * WORLD_H) / WORLD_W;
    const mx = 22;
    const my = this.L.hudBottom + 24;
    const s = mw / WORLD_W;
    g.fillStyle(INK_N, 0.6).fillRoundedRect(mx - 6, my - 6, mw + 12, mh + 12, 14);
    g.fillStyle(this.area.theme.grassDark, 0.9).fillRoundedRect(mx, my, mw, mh, 10);
    g.lineStyle(5, this.area.theme.path, 1);
    for (const pts of this.world.roads) {
      const [a, b] = [pts[0], pts[pts.length - 1]];
      g.lineBetween(mx + a[0] * s, my + a[1] * s, mx + b[0] * s, my + b[1] * s);
    }
    const { heart } = this.world;
    g.fillStyle(0x67c3ff, 1).fillCircle(mx + heart.x * s, my + heart.y * s, 7);
    g.fillStyle(0xf26464, 1);
    for (const e of this.enemies) g.fillCircle(mx + e.img.x * s, my + e.img.y * s, e.type.boss ? 6 : 3.5);
    g.fillStyle(0xffffff, 1).fillCircle(mx + this.hero.x * s, my + this.hero.y * s, 6);
    g.lineStyle(3, 0xffa64d, 1).strokeCircle(mx + this.hero.x * s, my + this.hero.y * s, 6);
    const cam = this.cameras.main;
    g.lineStyle(2, 0xffffff, 0.7).strokeRect(mx + cam.scrollX * s, my + cam.scrollY * s, cam.width * s, cam.height * s);

    const top = this.L.hudBottom + 30;
    const bottom = this.L.slotsY - 120;
    const cxs = GAME_W / 2;
    const cys = (top + bottom) / 2;
    let drawn = 0;
    for (const e of this.enemies) {
      if (drawn >= 5 || !e.attacking) continue;
      const sx = e.img.x - cam.scrollX;
      const sy = e.img.y - cam.scrollY;
      if (sx > 0 && sx < GAME_W && sy > top && sy < bottom) continue;
      const a = Math.atan2(sy - cys, sx - cxs);
      const ax = Phaser.Math.Clamp(cxs + Math.cos(a) * 2000, 50, GAME_W - 50);
      const ay = Phaser.Math.Clamp(cys + Math.sin(a) * 2000, top + 20, bottom - 20);
      const pt = (o: number, r: number) => [ax + Math.cos(a + o) * r, ay + Math.sin(a + o) * r];
      const [p1, p2, p3] = [pt(0, 32), pt(2.4, 26), pt(-2.4, 26)];
      g.fillStyle(0xf26464, 0.95).fillTriangle(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
      g.lineStyle(4, INK_N, 1).strokeTriangle(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
      drawn++;
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
