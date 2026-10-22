import Phaser from "phaser";
import { GROUND_H, backgroundTexture } from "../art/background";
import { HERO_MUZZLE, petKey } from "../art/characters";
import { INK_N } from "../art/draw";
import { pillTexture } from "../art/ui";
import { ItemDef, VARIANT_INFO, Variant, parseKey } from "../data/items";
import { rainbowColor } from "../data/rarity";
import { HERO_DAMAGE, heroInterval, heroMaxHp, powerMult } from "../data/upgrades";
import { GAME_W, battleHeight } from "../layout";
import { persist, save } from "../systems/save";
import { fmt } from "../ui/format";
import { Pill, drawBar, ribbonBanner, text } from "../ui/widgets";

export const WAVES_PER_STAGE = 10;

interface EnemyType {
  name: string;
  tex: string;
  fx: number;
  hp: number;
  speed: number;
  dmg: number;
  coins: number;
  originY: number;
  flying?: boolean;
  scale?: number;
}

const ENEMIES: Record<string, EnemyType> = {
  slime: { name: "Goo", tex: "e_slime", fx: 0xb07cff, hp: 14, speed: 68, dmg: 4, coins: 2, originY: 0.91 },
  bat: { name: "Bat", tex: "e_bat", fx: 0x7b5cc4, hp: 9, speed: 112, dmg: 3, coins: 2, originY: 0.5, flying: true },
  zombie: { name: "Zombie", tex: "e_zombie", fx: 0x8fcf5a, hp: 40, speed: 45, dmg: 8, coins: 5, originY: 0.95 },
  boss: { name: "ZOMBIE KING", tex: "e_boss", fx: 0xd0305a, hp: 300, speed: 33, dmg: 12, coins: 60, originY: 0.95, scale: 1.7 },
};

interface Enemy {
  img: Phaser.GameObjects.Image;
  type: EnemyType;
  hp: number;
  maxHp: number;
  dmg: number;
  coins: number;
  stopX: number;
  atkTimer: number;
  flashUntil: number;
  boss: boolean;
}

interface Pet {
  def: ItemDef;
  variant: Variant;
  img: Phaser.GameObjects.Image;
  timer: number;
}

interface Shot {
  img: Phaser.GameObjects.Image;
  target: Enemy;
  tx: number;
  ty: number;
  dmg: number;
  crit: boolean;
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

/** Top half of the screen: the cat gunner and pets auto-fight waves of enemies. */
export class BattleScene extends Phaser.Scene {
  private W = GAME_W;
  private H = 0;
  private groundTop = 0;
  private heroPos = { x: 0, y: 0 };
  private petSpots: { x: number; y: number }[] = [];
  private frontLine = 0;

  private hero!: Phaser.GameObjects.Image;
  private heroHp = 100;
  private heroTimer = 0;
  private pets: Pet[] = [];
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private strikes: Strike[] = [];
  private spawnQueue: EnemyType[] = [];
  private spawnTimer = 0;
  private waveDelay = 0;

  private fx!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private puff!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dmgTexts: Phaser.GameObjects.Text[] = [];
  private flyingCoins = 0;

  private stageText!: Phaser.GameObjects.Text;
  private coinPill!: Pill;
  private dpsPill!: Pill;
  private bossLabel?: Phaser.GameObjects.Container;
  private dps = 0;
  private dmgWindow = 0;
  private dpsTimer = 0;
  private earnedWindow = 0;
  private rateTimer = 0;
  private saveTimer = 0;

  constructor() {
    super("Battle");
  }

  create(): void {
    this.H = battleHeight(this.scale.height);
    this.groundTop = this.H - GROUND_H;
    const gt = this.groundTop;
    this.heroPos = { x: 225, y: gt + 222 };
    this.petSpots = [{ x: 400, y: gt + 140 }, { x: 405, y: gt + 318 }, { x: 78, y: gt + 128 }, { x: 82, y: gt + 318 }];
    this.frontLine = 560;
    this.pets = [];
    this.enemies = [];
    this.shots = [];
    this.strikes = [];
    this.spawnQueue = [];
    this.waveDelay = 0;
    this.dmgTexts = [];
    this.flyingCoins = 0;
    this.bossLabel = undefined;
    this.dps = 0;

    this.cameras.main.setViewport(0, 0, this.W, this.H);
    this.add.image(0, 0, backgroundTexture(this, this.W, this.H)).setOrigin(0).setDepth(-100);
    this.spawnClouds();

    this.fx = this.add.graphics().setDepth(2000);
    this.bars = this.add.graphics().setDepth(2100);
    this.hud = this.add.graphics().setDepth(3000);
    this.puff = this.add.particles(0, 0, "puff", {
      speed: { min: 80, max: 320 }, lifespan: 500, scale: { start: 1.1, end: 0 }, alpha: { start: 1, end: 0.2 }, emitting: false,
    }).setDepth(1900);
    this.sparks = this.add.particles(0, 0, "spark", {
      speed: { min: 120, max: 360 }, lifespan: 300, scale: { start: 0.7, end: 0 }, rotate: { min: 0, max: 90 }, emitting: false,
    }).setDepth(1950);
    for (let i = 0; i < 50; i++) this.dmgTexts.push(text(this, 0, 0, "", 40).setDepth(2500).setVisible(false));

    this.hero = this.add.image(this.heroPos.x, this.heroPos.y, "hero").setOrigin(0.5, 0.94).setDepth(this.heroPos.y);
    this.tweens.add({ targets: this.hero, scaleY: 0.97, scaleX: 1.02, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.heroHp = heroMaxHp();
    this.buildPets();
    this.createHud();

    this.game.events.on("pets-changed", this.buildPets, this);
    this.game.events.on("upgrades-changed", this.onUpgrade, this);
    this.events.once("shutdown", () => {
      this.game.events.off("pets-changed", this.buildPets, this);
      this.game.events.off("upgrades-changed", this.onUpgrade, this);
    });

    this.startWave();
  }

  private onUpgrade(): void {
    this.heroHp = heroMaxHp();
  }

  private spawnClouds(): void {
    for (let i = 0; i < 4; i++) {
      const y = 150 + i * Math.max(40, Math.min(90, (this.groundTop - 300) / 4));
      const cloud = this.add.image(Phaser.Math.Between(0, this.W), y, `cloud_${i % 2}`).setDepth(-90).setAlpha(0.95).setScale(0.8 + Math.random() * 0.5);
      const dur = 70000 + i * 20000;
      this.tweens.add({
        targets: cloud, x: this.W + 200, duration: (dur * (this.W + 200 - cloud.x)) / (this.W + 400),
        onComplete: () => {
          cloud.x = -200;
          this.tweens.add({ targets: cloud, x: this.W + 200, duration: dur, repeat: -1 });
        },
      });
    }
  }

  private createHud(): void {
    const top = 70;
    this.add.image(246, top + 22, pillTexture(this, 440, 150)).setDepth(2990);
    this.stageText = text(this, 64, top - 8, "", 50, "#ffffff").setOrigin(0, 0.5).setDepth(3001);
    this.coinPill = new Pill(this, this.W - 210, top, 370, 96, "icon_coin", 50, "#ffe680").setDepth(3001);
    this.dpsPill = new Pill(this, this.W - 175, top + 104, 300, 72, "icon_sword", 34).setDepth(3001);
    this.dpsPill.setValue("0 DPS");
  }

  /** Wave progress dots under the stage name. */
  private drawHud(): void {
    const g = this.hud;
    g.clear();
    const y = 108;
    for (let i = 0; i < WAVES_PER_STAGE; i++) {
      const x = 64 + i * 37;
      const done = i + 1 < save.wave;
      const current = i + 1 === save.wave;
      const boss = i + 1 === WAVES_PER_STAGE;
      g.fillStyle(INK_N, 1).fillRoundedRect(x - 3, y - 3, 34, 28, 10);
      g.fillStyle(done ? 0x5ee05a : current ? 0xffc21f : boss ? 0x8a2343 : 0x2e3270, 1).fillRoundedRect(x, y, 28, 22, 8);
      if (done || current) g.fillStyle(0xffffff, 0.35).fillRoundedRect(x + 4, y + 3, 20, 6, 3);
    }
  }

  // ───────────────────────── pets ─────────────────────────

  private buildPets(): void {
    this.pets.forEach((p) => p.img.destroy());
    this.pets = save.equipped.map((key, i) => {
      const { def, variant } = parseKey(key);
      const spot = this.petSpots[i];
      const img = this.add.image(spot.x, spot.y, petKey(def.id, variant)).setOrigin(0.5, 0.94).setDepth(spot.y).setScale(0);
      this.tweens.add({
        targets: img, scale: 1, duration: 300, ease: "Back.out",
        onComplete: () => this.tweens.add({ targets: img, scaleY: 0.92, scaleX: 1.06, duration: 380 + i * 50, yoyo: true, repeat: -1, ease: "Sine.inOut" }),
      });
      return { def, variant, img, timer: Math.random() * def.cooldown };
    });
  }

  private damageMult(): number {
    const buff = this.pets
      .filter((p) => p.def.kind === "buff")
      .reduce((s, p) => s + (p.def.damage / 100) * VARIANT_INFO[p.variant].mult, 0);
    return powerMult() * (1 + buff);
  }

  // ───────────────────────── waves ─────────────────────────

  private startWave(): void {
    const { stage, wave } = save;
    const n = 5 + wave + stage;
    this.spawnQueue = [];
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      if ((stage >= 2 || wave >= 5) && r < 0.2) this.spawnQueue.push(ENEMIES.zombie);
      else if (wave >= 3 && r < 0.45) this.spawnQueue.push(ENEMIES.bat);
      else this.spawnQueue.push(ENEMIES.slime);
    }
    const bossWave = wave === WAVES_PER_STAGE;
    if (bossWave) {
      this.spawnQueue.length = Math.ceil(n / 2);
      this.spawnQueue.splice(2, 0, ENEMIES.boss);
    }
    this.spawnTimer = 500;
    this.heroHp = heroMaxHp();
    this.stageText.setText(`STAGE ${save.stage}`);
    this.drawHud();
    ribbonBanner(this, this.W / 2, this.groundTop - 160, bossWave ? "BOSS WAVE!" : `WAVE ${wave}`, bossWave ? "red" : "blue", 900);
  }

  private waveCleared(): void {
    if (save.wave >= WAVES_PER_STAGE) {
      save.stage++;
      save.wave = 1;
      save.bestStage = Math.max(save.bestStage, save.stage);
      this.cameras.main.flash(250, 255, 240, 200);
    } else {
      save.wave++;
    }
    persist();
    this.waveDelay = 1300;
  }

  private retreat(): void {
    this.enemies.forEach((e) => e.img.destroy());
    this.enemies = [];
    this.shots.forEach((s) => s.img.destroy());
    this.shots = [];
    this.bossLabel?.destroy();
    this.bossLabel = undefined;
    save.wave = Math.max(1, save.wave - 1);
    persist();
    this.cameras.main.shake(300, 0.01);
    ribbonBanner(this, this.W / 2, this.groundTop - 160, "RETREAT!", "red", 1300);
    this.waveDelay = 1800;
  }

  // ───────────────────────── loop ─────────────────────────

  update(time: number, delta: number): void {
    this.coinPill.setValue(fmt(save.coins));
    this.trackStats(delta);

    if (this.waveDelay > 0) {
      this.waveDelay -= delta;
      if (this.waveDelay <= 0) this.startWave();
    } else {
      this.spawn(delta);
      if (this.spawnQueue.length === 0 && this.enemies.length === 0) this.waveCleared();
    }

    this.moveEnemies(time, delta);
    this.heroAttack(delta);
    this.petAttacks(time, delta);
    this.moveShots(delta);
    this.drawFx(time);
  }

  private spawn(delta: number): void {
    if (!this.spawnQueue.length) return;
    this.spawnTimer -= delta;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = Phaser.Math.Between(450, 900);
    const type = this.spawnQueue.shift()!;
    const { stage, wave } = save;
    const gt = this.groundTop;
    const hpMult = 1.32 ** (stage - 1) * (1 + 0.08 * (wave - 1));
    const boss = type === ENEMIES.boss;
    const y = type.flying ? Phaser.Math.Between(gt - 150, gt - 50) : boss ? gt + 250 : Phaser.Math.Between(gt + 110, gt + 320);
    const scale = type.scale ?? 1;
    const img = this.add.image(this.W + 130, y, type.tex).setOrigin(0.5, type.originY).setScale(scale).setDepth(y);
    if (type.flying) {
      this.tweens.add({ targets: img, y: y - 26, duration: 320, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.tweens.add({ targets: img, scaleY: 0.85, duration: 160, yoyo: true, repeat: -1 });
    } else {
      this.tweens.add({ targets: img, angle: { from: -4, to: 4 }, duration: 280, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      this.tweens.add({ targets: img, scaleY: scale * 0.94, duration: 280, yoyo: true, repeat: -1 });
    }
    const hp = Math.round(type.hp * hpMult);
    this.enemies.push({
      img, type, hp, maxHp: hp,
      dmg: Math.round(type.dmg * 1.18 ** (stage - 1)),
      coins: Math.ceil(type.coins * 1.22 ** (stage - 1)),
      stopX: this.frontLine + Phaser.Math.Between(0, 80) + (boss ? 90 : 0),
      atkTimer: 300, flashUntil: 0, boss,
    });
    if (boss) {
      this.cameras.main.shake(400, 0.008);
      this.bossLabel?.destroy();
      this.bossLabel = this.add.container(this.W / 2, 262, [
        this.add.image(-320, 44, "icon_skull").setScale(0.62),
        text(this, -290, 0, type.name, 34, "#ff8a9a").setOrigin(0, 0.5),
      ]).setDepth(3001);
    }
  }

  private moveEnemies(time: number, delta: number): void {
    for (const e of this.enemies) {
      if (e.img.x > e.stopX) {
        e.img.x -= (e.type.speed * delta) / 1000;
      } else {
        e.atkTimer -= delta;
        if (e.atkTimer <= 0) {
          e.atkTimer = 1000;
          this.tweens.add({ targets: e.img, x: e.img.x - 26, duration: 90, yoyo: true, ease: "Quad.out" });
          this.hurtHero(e.dmg);
        }
      }
      if (e.flashUntil && time > e.flashUntil) {
        e.flashUntil = 0;
        e.img.clearTint();
      }
    }
  }

  private hurtHero(dmg: number): void {
    if (this.waveDelay > 0) return;
    this.heroHp -= dmg;
    this.hero.setTintFill(0xff5a5a);
    this.time.delayedCall(90, () => this.hero.clearTint());
    if (this.heroHp <= 0) this.retreat();
  }

  // ───────────────────────── attacking ─────────────────────────

  private frontEnemy(): Enemy | undefined {
    let best: Enemy | undefined;
    for (const e of this.enemies) if (e.img.x < this.W + 20 && (!best || e.img.x < best.img.x)) best = e;
    return best;
  }

  private heroAttack(delta: number): void {
    this.heroTimer -= delta;
    if (this.heroTimer > 0) return;
    const target = this.frontEnemy();
    if (!target) return;
    this.heroTimer = heroInterval();
    const mx = this.heroPos.x + HERO_MUZZLE.x;
    const my = this.heroPos.y + HERO_MUZZLE.y;
    this.fire(mx, my, target, HERO_DAMAGE * this.damageMult(), "bolt", 0xffffff, 0, 1);
    const flash = this.add.image(mx + 6, my, "flash").setDepth(2050).setScale(0.5);
    this.tweens.add({ targets: flash, scale: 0.9, alpha: 0, duration: 110, onComplete: () => flash.destroy() });
    this.tweens.add({ targets: this.hero, x: this.heroPos.x - 8, duration: 50, yoyo: true });
  }

  private petAttacks(time: number, delta: number): void {
    const mult = this.damageMult();
    for (const p of this.pets) {
      p.timer -= delta;
      if (p.def.kind === "buff") {
        if (p.timer <= 0) {
          p.timer = 2200;
          this.sparks.setParticleTint(0xffe680);
          this.sparks.explode(5, p.img.x, p.img.y - 90);
        }
        continue;
      }
      const targets = this.enemies.filter((e) => e.img.x < this.W + 10);
      if (p.timer > 0 || !targets.length) continue;
      p.timer = p.def.cooldown;
      const dmg = p.def.damage * VARIANT_INFO[p.variant].mult * mult;
      const color = p.variant === "rainbow" ? rainbowColor(time) : p.variant === "golden" ? 0xffd84a : p.def.color;
      const sx = p.img.x + 30;
      const sy = p.img.y - 85;

      const picks = Phaser.Utils.Array.Shuffle(targets).slice(0, Math.max(1, p.def.count));
      switch (p.def.kind) {
        case "shot":
          for (let i = 0; i < p.def.count; i++) {
            const t = this.frontEnemy();
            if (t) this.time.delayedCall(i * 90, () => this.fire(sx, sy, t, dmg, "orb", color, 0, 0.75));
          }
          break;
        case "splash":
          picks.forEach((t) => this.fire(sx, sy, t, dmg, "orb", color, 135, 1.3));
          break;
        case "zap":
          picks.forEach((t) => {
            const ty = t.img.y - t.img.displayHeight * 0.4;
            this.strikes.push({ x1: t.img.x, y1: -40, x2: t.img.x, y2: ty, until: time + 160, color, beam: false });
            const f = this.add.image(t.img.x, ty, "flash").setTint(color).setDepth(2050).setScale(1.2);
            this.tweens.add({ targets: f, scale: 1.8, alpha: 0, duration: 200, onComplete: () => f.destroy() });
            this.hit(t, dmg);
          });
          break;
        case "pierce":
          picks.forEach((t) => {
            const ty = t.img.y - t.img.displayHeight * 0.4;
            const slope = (ty - sy) / Math.max(1, t.img.x - sx);
            const ex = this.W + 40;
            this.strikes.push({ x1: sx, y1: sy, x2: ex, y2: sy + slope * (ex - sx), until: time + 200, color, beam: true });
            for (const e of [...this.enemies]) {
              const ey = e.img.y - e.img.displayHeight * 0.4;
              if (e.img.x > sx && Math.abs(ey - (sy + slope * (e.img.x - sx))) < 70) this.hit(e, dmg);
            }
          });
          break;
      }
    }
  }

  private fire(x: number, y: number, target: Enemy, dmg: number, tex: string, color: number, splash: number, scale: number): void {
    if (!this.enemies.includes(target)) return;
    const crit = Math.random() < 0.1;
    const img = this.add.image(x, y, tex).setScale(scale).setDepth(2000);
    if (tex !== "bolt") img.setTint(color);
    this.shots.push({
      img, target, tx: target.img.x, ty: target.img.y, dmg: crit ? dmg * 2 : dmg, crit,
      speed: splash ? 1000 : 1700, splash,
    });
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
        const ring = this.add.image(s.tx, s.ty, "ring").setTint(s.img.tintTopLeft).setDepth(1990).setScale(0.3);
        this.tweens.add({ targets: ring, scale: (s.splash * 2) / 140, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
        this.puff.setParticleTint(s.img.tintTopLeft);
        this.puff.explode(12, s.tx, s.ty);
        for (const e of [...this.enemies]) {
          if (Phaser.Math.Distance.Between(e.img.x, e.img.y - e.img.displayHeight * 0.4, s.tx, s.ty) < s.splash) this.hit(e, s.dmg, s.crit);
        }
      } else if (this.enemies.includes(s.target)) {
        this.hit(s.target, s.dmg, s.crit);
      }
      s.img.destroy();
      return false;
    });
  }

  private hit(e: Enemy, dmg: number, crit = false): void {
    if (!this.enemies.includes(e)) return;
    const amount = Math.max(1, Math.round(dmg * Phaser.Math.FloatBetween(0.9, 1.1)));
    e.hp -= amount;
    this.dmgWindow += amount;
    e.img.setTintFill(0xffffff);
    e.flashUntil = this.time.now + 70;
    const hy = e.img.y - e.img.displayHeight * (e.type.flying ? 0.5 : 0.95);
    this.sparks.setParticleTint(0xffffff);
    this.sparks.explode(3, e.img.x - 10, hy + 40);
    this.damageNumber(e.img.x, hy, amount, crit);
    if (e.hp <= 0) this.kill(e);
  }

  private damageNumber(x: number, y: number, amount: number, crit: boolean): void {
    const t = this.dmgTexts.find((d) => !d.visible);
    if (!t) return;
    t.setText(crit ? `${fmt(amount)}!` : fmt(amount))
      .setColor(crit ? "#ffd84a" : "#ffffff")
      .setPosition(x + Phaser.Math.Between(-20, 20), y)
      .setVisible(true)
      .setAlpha(1)
      .setScale(crit ? 0.6 : 0.5);
    this.tweens.add({ targets: t, scale: crit ? 1.35 : 1, duration: 120, ease: "Back.out" });
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, delay: 250, duration: 450, onComplete: () => t.setVisible(false) });
  }

  private kill(e: Enemy): void {
    this.enemies = this.enemies.filter((o) => o !== e);
    const cy = e.img.y - e.img.displayHeight * 0.4;
    this.puff.setParticleTint(e.type.fx);
    this.puff.explode(e.boss ? 60 : 14, e.img.x, cy);
    save.coins += e.coins;
    this.earnedWindow += e.coins;
    this.flyCoins(e.img.x, cy, e.boss ? 8 : 1 + Math.min(2, Math.floor(e.coins / 5)));
    if (e.boss) {
      this.cameras.main.shake(400, 0.014);
      this.cameras.main.flash(200, 255, 255, 255);
      this.bossLabel?.destroy();
      this.bossLabel = undefined;
    }
    this.tweens.killTweensOf(e.img);
    this.tweens.add({ targets: e.img, scale: 0, alpha: 0, angle: 30, duration: 160, onComplete: () => e.img.destroy() });
  }

  /** Coins pop out of defeated enemies and fly into the coin counter. */
  private flyCoins(x: number, y: number, n: number): void {
    const tx = this.coinPill.x + this.coinPill.icon.x;
    const ty = this.coinPill.y;
    for (let i = 0; i < n && this.flyingCoins < 30; i++) {
      this.flyingCoins++;
      const c = this.add.image(x, y, "icon_coin").setScale(0.42).setDepth(2600);
      this.tweens.add({
        targets: c, x: x + Phaser.Math.Between(-60, 60), y: y - Phaser.Math.Between(40, 110), duration: 260, ease: "Quad.out",
        onComplete: () => {
          this.tweens.add({
            targets: c, x: tx, y: ty, scale: 0.3, duration: 480, delay: i * 40, ease: "Cubic.in",
            onComplete: () => {
              c.destroy();
              this.flyingCoins--;
              this.coinPill.bump();
            },
          });
        },
      });
    }
  }

  private drawFx(time: number): void {
    this.strikes = this.strikes.filter((s) => s.until > time);
    this.fx.clear();
    for (const s of this.strikes) {
      if (s.beam) {
        this.fx.lineStyle(30, s.color, 0.35).lineBetween(s.x1, s.y1, s.x2, s.y2);
        this.fx.lineStyle(14, s.color, 0.9).lineBetween(s.x1, s.y1, s.x2, s.y2);
        this.fx.lineStyle(5, 0xffffff, 1).lineBetween(s.x1, s.y1, s.x2, s.y2);
        continue;
      }
      for (const [w, c, a] of [[16, s.color, 0.35], [7, s.color, 1], [3, 0xffffff, 1]] as [number, number, number][]) {
        this.fx.lineStyle(w, c, a).beginPath();
        let y = s.y1;
        const seed = Math.floor(s.until);
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

    // health bars
    this.bars.clear();
    const hp = Phaser.Math.Clamp(this.heroHp / heroMaxHp(), 0, 1);
    drawBar(this.bars, this.heroPos.x - 70, this.heroPos.y - 224, 140, 18, hp, hp > 0.35 ? 0x5ee05a : 0xff5a5a);
    for (const e of this.enemies) {
      if (e.boss) {
        drawBar(this.bars, this.W / 2 - 290, 290, 620, 34, e.hp / e.maxHp, 0xe8324f);
        continue;
      }
      if (e.hp >= e.maxHp) continue;
      const y = e.img.y - e.img.displayHeight * (e.type.flying ? 0.5 : 1) - 18;
      drawBar(this.bars, e.img.x - 44, y, 88, 12, e.hp / e.maxHp, 0xff5a5a);
    }
  }

  /** DPS readout, coins-per-second (for offline earnings) and autosave. */
  private trackStats(delta: number): void {
    this.dpsTimer += delta;
    if (this.dpsTimer >= 1000) {
      this.dps = this.dps * 0.6 + (this.dmgWindow / (this.dpsTimer / 1000)) * 0.4;
      this.dmgWindow = 0;
      this.dpsTimer = 0;
      this.dpsPill.setValue(`${fmt(this.dps)} DPS`);
    }
    this.rateTimer += delta;
    this.saveTimer += delta;
    if (this.rateTimer >= 15000) {
      const rate = this.earnedWindow / (this.rateTimer / 1000);
      save.coinsPerSec = save.coinsPerSec ? save.coinsPerSec * 0.6 + rate * 0.4 : rate;
      this.earnedWindow = 0;
      this.rateTimer = 0;
    }
    if (this.saveTimer >= 5000) {
      this.saveTimer = 0;
      persist();
    }
  }
}
