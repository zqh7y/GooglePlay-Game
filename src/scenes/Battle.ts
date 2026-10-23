import Phaser from "phaser";
import { HERO_HAND } from "../art/characters";
import { mapTexture } from "../art/background";
import { petTexture } from "../art/pets";
import { ItemDef, VARIANT_INFO, Variant, parseKey } from "../data/items";
import { rainbowColor } from "../data/rarity";
import { GAME_W, Layout, layoutFor } from "../layout";
import { persist, save } from "../systems/save";
import { cashMult, critChance, dmgMult, gemsPerBoss } from "../systems/stats";
import { fmt } from "../ui/format";
import { drawBar, ribbonBanner, text } from "../ui/widgets";

export const WAVES_PER_STAGE = 5;
const BOSS_TIME = 30000;

/** Where coins fly to (the money counter in the HUD). */
export const CASH_TARGET = { x: GAME_W - 300, y: 150 };

/** Live numbers the HUD (UI scene) shows. */
export const battle = { progress: 0, bossLeft: 0, dps: 0 };

interface EnemyType {
  name: string;
  tex: string;
  fx: number;
  hp: number;
  speed: number;
  cash: number;
  originY: number;
  flying?: boolean;
  boss?: boolean;
}

const ENEMIES: Record<string, EnemyType> = {
  slime: { name: "Goo", tex: "e_slime", fx: 0xb07cff, hp: 30, speed: 70, cash: 2, originY: 0.92 },
  mush: { name: "Shroom", tex: "e_mush", fx: 0xef4a5a, hp: 55, speed: 50, cash: 3, originY: 0.94 },
  bat: { name: "Bat", tex: "e_bat", fx: 0x8a6ad0, hp: 20, speed: 110, cash: 2, originY: 0.5, flying: true },
  boss: { name: "ROCK GOLEM", tex: "e_golem", fx: 0xa7adba, hp: 900, speed: 40, cash: 40, originY: 0.94, boss: true },
};

interface Enemy {
  img: Phaser.GameObjects.Image;
  type: EnemyType;
  hp: number;
  maxHp: number;
  cash: number;
  stopR: number;
  flashUntil: number;
  arrived: boolean;
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

const PET_SPOTS = [[-175, 30], [175, 30], [-110, 130], [110, 130], [-285, 110], [285, 110]];
const PET_SCALE = 0.74;

/** The battlefield: the cat gunner and its pets fight monsters coming out of the forest. */
export class BattleScene extends Phaser.Scene {
  private W = GAME_W;
  private L!: Layout;
  private hero!: Phaser.GameObjects.Image;
  private gun!: Phaser.GameObjects.Image;
  private heroTimer = 0;
  private pets: Pet[] = [];
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private strikes: Strike[] = [];
  private spawnQueue: EnemyType[] = [];
  private spawnTimer = 0;
  private waveDelay = 0;
  private waveSize = 1;
  private kills = 0;
  private bossLeft = 0;

  private fx!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private puff!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dmgTexts: Phaser.GameObjects.Text[] = [];
  private cashTexts: Phaser.GameObjects.Container[] = [];
  private flyingCash = 0;

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
    this.pets = [];
    this.enemies = [];
    this.shots = [];
    this.strikes = [];
    this.spawnQueue = [];
    this.waveDelay = 0;
    this.dmgTexts = [];
    this.cashTexts = [];
    this.flyingCash = 0;
    battle.dps = 0;

    this.add.image(0, 0, mapTexture(this, this.W, this.L)).setOrigin(0).setDepth(-100);
    this.add.particles(0, 0, "petal", {
      x: { min: -100, max: this.W }, y: { min: 120, max: 300 }, lifespan: 9000, speedX: { min: 30, max: 70 }, speedY: { min: 40, max: 90 },
      rotate: { start: 0, end: 360 }, alpha: { start: 0.9, end: 0 }, frequency: 500, quantity: 1,
    }).setDepth(4000);

    this.fx = this.add.graphics().setDepth(3000);
    this.bars = this.add.graphics().setDepth(3100);
    this.puff = this.add.particles(0, 0, "puff", {
      speed: { min: 80, max: 340 }, lifespan: 500, scale: { start: 1.2, end: 0 }, emitting: false,
    }).setDepth(2900);
    this.sparks = this.add.particles(0, 0, "spark", {
      speed: { min: 120, max: 360 }, lifespan: 320, scale: { start: 0.7, end: 0 }, rotate: { min: 0, max: 90 }, emitting: false,
    }).setDepth(2950);
    for (let i = 0; i < 60; i++) this.dmgTexts.push(text(this, 0, 0, "", 42).setDepth(3500).setVisible(false));
    for (let i = 0; i < 24; i++) {
      const c = this.add.container(0, 0, [
        this.add.image(-8, 0, "icon_cash").setScale(0.42).setOrigin(1, 0.5),
        text(this, 0, 0, "", 40, "#8af06a").setOrigin(0, 0.5),
      ]).setDepth(3600).setVisible(false);
      this.cashTexts.push(c);
    }

    const { catX, catY } = this.L;
    this.hero = this.add.image(catX, catY, "hero").setOrigin(0.5, 0.95).setDepth(catY);
    this.tweens.add({ targets: this.hero, scaleY: 0.96, scaleX: 1.03, duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.gun = this.add.image(catX + HERO_HAND.x, catY + HERO_HAND.y, "gun").setOrigin(38 / 142, 0.47).setDepth(catY + 1);
    this.buildPets();

    this.game.events.on("pets-changed", this.buildPets, this);
    this.events.once("shutdown", () => this.game.events.off("pets-changed", this.buildPets, this));
    this.startWave();
  }

  // ───────────────────────── pets ─────────────────────────

  private buildPets(): void {
    this.pets.forEach((p) => p.img.destroy());
    const { catX, catY } = this.L;
    this.pets = save.equipped.slice(0, PET_SPOTS.length).map((key, i) => {
      const { def, variant } = parseKey(key);
      const [dx, dy] = PET_SPOTS[i];
      const img = this.add.image(catX + dx, catY + dy, petTexture(this, def.id, variant)).setOrigin(0.5, 0.95).setDepth(catY + dy).setScale(0);
      this.tweens.add({
        targets: img, scale: PET_SCALE, duration: 300, ease: "Back.out",
        onComplete: () => this.tweens.add({
          targets: img, scaleY: PET_SCALE * 0.92, scaleX: PET_SCALE * 1.06, duration: 380 + i * 50, yoyo: true, repeat: -1, ease: "Sine.inOut",
        }),
      });
      return { def, variant, img, timer: Math.random() * def.cooldown };
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
    const n = boss ? 6 : 6 + wave * 2 + Math.min(stage, 20);
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
    this.bossLeft = boss ? BOSS_TIME : 0;
    this.spawnTimer = 400;
    ribbonBanner(this, this.W / 2, this.L.hudBottom + 150, boss ? "BOSS!" : `WAVE ${stage}-${wave}`, boss ? "red" : "peach", 900);
  }

  private waveCleared(): void {
    if (save.wave >= WAVES_PER_STAGE) {
      save.stage++;
      save.wave = 1;
      save.bestStage = Math.max(save.bestStage, save.stage);
      const gems = gemsPerBoss();
      save.gems += gems;
      this.game.events.emit("toast", `Boss defeated! +${gems} gems`, "#8fe3ff");
      this.cameras.main.flash(250, 255, 245, 200);
    } else {
      save.wave++;
    }
    persist();
    this.waveDelay = 1200;
  }

  private bossEscaped(): void {
    this.enemies.forEach((e) => e.img.destroy());
    this.enemies = [];
    this.shots.forEach((s) => s.img.destroy());
    this.shots = [];
    this.spawnQueue = [];
    save.wave = WAVES_PER_STAGE - 1;
    persist();
    this.cameras.main.shake(300, 0.008);
    ribbonBanner(this, this.W / 2, this.L.hudBottom + 150, "BOSS ESCAPED!", "red", 1300);
    this.waveDelay = 1800;
  }

  // ───────────────────────── loop ─────────────────────────

  update(time: number, delta: number): void {
    this.trackStats(delta);

    if (this.waveDelay > 0) {
      this.waveDelay -= delta;
      if (this.waveDelay <= 0) this.startWave();
    } else {
      this.spawn(delta);
      if (this.bossLeft > 0) {
        this.bossLeft -= delta;
        if (this.bossLeft <= 0) this.bossEscaped();
      }
      if (this.waveDelay <= 0 && this.spawnQueue.length === 0 && this.enemies.length === 0) this.waveCleared();
    }
    battle.progress = this.kills / this.waveSize;
    battle.bossLeft = Math.max(0, this.bossLeft);

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
    this.spawnTimer = Phaser.Math.Between(300, 650);
    const type = this.spawnQueue.shift()!;
    const { stage, wave } = save;
    const { catX, catY } = this.L;
    // appear at the forest edge, inside the screen
    const a = Phaser.Math.FloatBetween(Math.PI * 1.05, Math.PI * 1.95);
    const x = type.boss ? catX : Phaser.Math.Clamp(catX + Math.cos(a) * 640, 70, this.W - 70);
    const y = type.boss ? this.L.hudBottom + 200 : Phaser.Math.Clamp(catY + Math.sin(a) * 640, this.L.hudBottom + 30, catY - 200);
    const img = this.add.image(x, y, type.tex).setOrigin(0.5, type.originY).setDepth(y).setAlpha(0);
    this.tweens.add({ targets: img, alpha: 1, duration: 250 });
    if (type.flying) this.tweens.add({ targets: img, scaleY: 0.85, duration: 160, yoyo: true, repeat: -1 });
    else this.tweens.add({ targets: img, angle: { from: -5, to: 5 }, duration: 260, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const hp = Math.round(type.hp * 1.2 ** (stage - 1) * (1 + 0.15 * (wave - 1)));
    this.enemies.push({
      img, type, hp, maxHp: hp,
      cash: type.cash * 1.18 ** (stage - 1),
      stopR: type.boss ? 330 : Phaser.Math.Between(230, 330),
      flashUntil: 0, arrived: false,
    });
    if (type.boss) this.cameras.main.shake(400, 0.006);
  }

  private moveEnemies(time: number, delta: number): void {
    const { catX, catY } = this.L;
    for (const e of this.enemies) {
      const dx = catX - e.img.x;
      const dy = catY - 60 - e.img.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > e.stopR) {
        const step = (e.type.speed * delta) / 1000;
        e.img.x += (dx / d) * step;
        e.img.y += (dy / d) * step;
        e.img.setDepth(e.img.y);
      } else if (!e.arrived) {
        e.arrived = true;
        this.tweens.add({ targets: e.img, y: e.img.y + 14, duration: 140, yoyo: true, repeat: -1, repeatDelay: 600 });
      }
      if (e.flashUntil && time > e.flashUntil) {
        e.flashUntil = 0;
        e.img.clearTint();
      }
    }
  }

  // ───────────────────────── attacking ─────────────────────────

  private nearestEnemy(): Enemy | undefined {
    const { catX, catY } = this.L;
    let best: Enemy | undefined;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (!this.inView(e)) continue;
      const d = (e.img.x - catX) ** 2 + (e.img.y - catY) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /** Only fight enemies that are on screen and fully faded in. */
  private inView(e: Enemy): boolean {
    return e.img.alpha >= 0.9 && e.img.y > this.L.hudBottom && e.img.x > 30 && e.img.x < this.W - 30;
  }

  private heroAttack(delta: number): void {
    const target = this.nearestEnemy();
    if (target) {
      const ang = Math.atan2(target.img.y - target.img.displayHeight * 0.4 - this.gun.y, target.img.x - this.gun.x);
      this.gun.setRotation(Phaser.Math.Angle.RotateTo(this.gun.rotation, ang, 0.25));
      this.gun.setFlipY(Math.abs(this.gun.rotation) > Math.PI / 2);
    }
    this.heroTimer -= delta;
    if (this.heroTimer > 0 || !target) return;
    this.heroTimer = 450;
    const mx = this.gun.x + Math.cos(this.gun.rotation) * 95;
    const my = this.gun.y + Math.sin(this.gun.rotation) * 95;
    this.fire(mx, my, target, this.heroDamage(), "bolt", 0xffffff, 0, 1);
    const flash = this.add.image(mx, my, "flash").setDepth(3050).setScale(0.5);
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
          this.sparks.explode(5, p.img.x, p.img.y - 90);
        }
        continue;
      }
      const targets = this.enemies.filter((e) => this.inView(e));
      if (p.timer > 0 || !targets.length) continue;
      p.timer = p.def.cooldown;
      const dmg = p.def.damage * VARIANT_INFO[p.variant].mult * mult;
      const color = p.variant === "rainbow" ? rainbowColor(time) : p.variant === "golden" ? 0xffd84a : p.def.fx;
      const sx = p.img.x;
      const sy = p.img.y - 80;
      this.tweens.add({ targets: p.img, y: p.img.y - 16, duration: 90, yoyo: true, ease: "Quad.out" });
      const picks = Phaser.Utils.Array.Shuffle(targets).slice(0, p.def.count);
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
            const f = this.add.image(t.img.x, ty, "flash").setTint(color).setDepth(3050).setScale(1.2);
            this.tweens.add({ targets: f, scale: 1.9, alpha: 0, duration: 220, onComplete: () => f.destroy() });
            this.hit(t, dmg);
          });
          break;
        case "pierce":
          picks.forEach((t) => {
            const ty = t.img.y - t.img.displayHeight * 0.4;
            const ang = Math.atan2(ty - sy, t.img.x - sx);
            const ex = sx + Math.cos(ang) * 1400;
            const ey = sy + Math.sin(ang) * 1400;
            this.strikes.push({ x1: sx, y1: sy, x2: ex, y2: ey, until: time + 200, color, beam: true });
            for (const e of [...this.enemies]) {
              const px = e.img.x - sx;
              const py = e.img.y - e.img.displayHeight * 0.4 - sy;
              const along = px * Math.cos(ang) + py * Math.sin(ang);
              const off = Math.abs(-px * Math.sin(ang) + py * Math.cos(ang));
              if (along > 0 && off < 60) this.hit(e, dmg);
            }
          });
          break;
      }
    }
  }

  private fire(x: number, y: number, target: Enemy, dmg: number, tex: string, color: number, splash: number, scale: number): void {
    if (!this.enemies.includes(target)) return;
    const img = this.add.image(x, y, tex).setScale(scale).setDepth(3000);
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
    const b = this.add.image(x, y, "boom").setDepth(2990).setScale(scale * 0.3).setAngle(Phaser.Math.Between(0, 360));
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
    t.setText(fmt(amount))
      .setColor(crit ? "#ff5a5a" : "#ffffff")
      .setPosition(x + Phaser.Math.Between(-30, 30), y)
      .setVisible(true)
      .setAlpha(1)
      .setScale(0.5);
    this.tweens.add({ targets: t, scale: crit ? 1.45 : 1, duration: 120, ease: "Back.out" });
    this.tweens.add({ targets: t, y: y - 80, alpha: 0, delay: 300, duration: 450, onComplete: () => t.setVisible(false) });
  }

  private kill(e: Enemy): void {
    this.enemies = this.enemies.filter((o) => o !== e);
    this.kills++;
    const cy = e.img.y - e.img.displayHeight * 0.4;
    this.puff.setParticleTint(e.type.fx);
    this.puff.explode(e.type.boss ? 60 : 14, e.img.x, cy);
    this.boom(e.img.x, cy, e.type.boss ? 2.2 : 0.8);
    const cash = e.cash * cashMult();
    save.cash += cash;
    this.earnedWindow += cash;
    this.cashPop(e.img.x, cy - 40, cash);
    this.flyCash(e.img.x, cy, e.type.boss ? 10 : 2);
    if (e.type.boss) {
      this.cameras.main.shake(400, 0.012);
      this.bossLeft = 0;
    }
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

  /** Money bills pop out of defeated enemies and fly into the money counter. */
  private flyCash(x: number, y: number, n: number): void {
    for (let i = 0; i < n && this.flyingCash < 30; i++) {
      this.flyingCash++;
      const c = this.add.image(x, y, "icon_cash").setScale(0.5).setDepth(3700).setAngle(Phaser.Math.Between(-30, 30));
      this.tweens.add({
        targets: c, x: x + Phaser.Math.Between(-80, 80), y: y - Phaser.Math.Between(30, 110), duration: 260, ease: "Quad.out",
        onComplete: () => {
          this.tweens.add({
            targets: c, x: CASH_TARGET.x, y: CASH_TARGET.y, scale: 0.32, angle: 0, duration: 520, delay: i * 40, ease: "Cubic.in",
            onComplete: () => {
              c.destroy();
              this.flyingCash--;
              this.game.events.emit("cash-arrived");
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
      if (e.type.boss) continue;
      if (e.hp >= e.maxHp) continue;
      const y = e.img.y - e.img.displayHeight * (e.type.flying ? 0.5 : 0.95) - 18;
      drawBar(this.bars, e.img.x - 44, y, 88, 12, e.hp / e.maxHp, 0x7ad651);
    }
    const boss = this.enemies.find((e) => e.type.boss);
    if (boss) drawBar(this.bars, boss.img.x - 110, boss.img.y - boss.img.displayHeight - 26, 220, 22, boss.hp / boss.maxHp, 0xf26464);
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
