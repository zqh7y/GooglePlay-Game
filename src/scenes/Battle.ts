import Phaser from "phaser";
import { ItemDef, VARIANT_INFO, Variant, parseKey } from "../data/items";
import { rainbowColor } from "../data/rarity";
import { HERO_DAMAGE, heroInterval, heroMaxHp, powerMult } from "../data/upgrades";
import { persist, save } from "../systems/save";
import { fmt } from "../ui/format";
import { text } from "../ui/widgets";

export const BATTLE_H = 600;
export const WAVES_PER_STAGE = 10;

const HERO = { x: 120, y: 470 };
const PET_SPOTS = [
  { x: 205, y: 430 }, { x: 205, y: 545 }, { x: 38, y: 425 }, { x: 38, y: 550 },
];
const FRONT_LINE = 275;
const SPAWN_X = 780;

interface EnemyType {
  tex: string; tint: number; hp: number; speed: number; dmg: number; coins: number;
  flying?: boolean; scale?: number;
}

const ENEMIES: Record<string, EnemyType> = {
  slime: { tex: "e_slime", tint: 0x22c55e, hp: 14, speed: 45, dmg: 4, coins: 2 },
  bat: { tex: "e_bat", tint: 0x8b5cf6, hp: 9, speed: 75, dmg: 3, coins: 2, flying: true },
  zombie: { tex: "e_zombie", tint: 0x65a30d, hp: 40, speed: 30, dmg: 8, coins: 5 },
  boss: { tex: "e_zombie", tint: 0x9f1239, hp: 300, speed: 22, dmg: 12, coins: 60, scale: 2.2 },
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
  speed: number;
  splash: number;
}

export class BattleScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Image;
  private heroHp = 100;
  private heroTimer = 0;
  private pets: Pet[] = [];
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private spawnQueue: EnemyType[] = [];
  private spawnTimer = 0;
  private waveDelay = 0;
  private fx!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private strikes: { x1: number; y1: number; x2: number; y2: number; until: number; color: number; beam: boolean }[] = [];
  private puff!: Phaser.GameObjects.Particles.ParticleEmitter;
  private popTexts: Phaser.GameObjects.Text[] = [];
  private stageText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private earnedWindow = 0;
  private rateTimer = 0;
  private saveTimer = 0;

  constructor() {
    super("Battle");
  }

  create(): void {
    this.cameras.main.setViewport(0, 0, this.scale.width, BATTLE_H);
    this.drawBackground();

    this.fx = this.add.graphics().setDepth(900);
    this.bars = this.add.graphics().setDepth(950);
    this.puff = this.add.particles(0, 0, "particle", {
      speed: { min: 60, max: 240 }, lifespan: 450, scale: { start: 1.4, end: 0 }, emitting: false,
    }).setDepth(800);
    for (let i = 0; i < 40; i++) this.popTexts.push(text(this, 0, 0, "", 22).setDepth(1000).setVisible(false));

    this.hero = this.add.image(HERO.x, HERO.y, "hero").setDepth(HERO.y);
    this.tweens.add({ targets: this.hero, scaleY: 0.96, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.heroHp = heroMaxHp();
    this.buildPets();

    this.stageText = text(this, 20, 34, "", 30).setOrigin(0, 0.5).setDepth(1001);
    this.coinText = text(this, this.scale.width - 20, 34, "", 34, "#fde047").setOrigin(1, 0.5).setDepth(1001);

    this.game.events.on("pets-changed", this.buildPets, this);
    this.game.events.on("upgrades-changed", () => (this.heroHp = heroMaxHp()), this);
    this.events.once("shutdown", () => {
      this.game.events.off("pets-changed", this.buildPets, this);
      this.game.events.off("upgrades-changed");
    });

    this.startWave();
  }

  private drawBackground(): void {
    const W = this.scale.width;
    const g = this.add.graphics().setDepth(-10);
    g.fillGradientStyle(0x60a5fa, 0x60a5fa, 0xbae6fd, 0xbae6fd, 1).fillRect(0, 0, W, 400);
    g.fillStyle(0xfef9c3).fillCircle(600, 120, 46);
    g.fillStyle(0x86efac).fillEllipse(130, 410, 420, 140).fillEllipse(520, 405, 520, 120);
    g.fillStyle(0x4ade80).fillRect(0, 390, W, BATTLE_H - 390);
    g.fillStyle(0x22c55e).fillRect(0, 390, W, 14);
    g.fillStyle(0x16a34a, 0.5);
    for (let i = 0; i < 40; i++) g.fillCircle(Phaser.Math.Between(0, W), Phaser.Math.Between(415, BATTLE_H), Phaser.Math.Between(3, 7));
    g.fillStyle(0x000000, 0.25).fillRect(0, BATTLE_H - 6, W, 6);
    for (let i = 0; i < 3; i++) {
      const cloud = this.add.ellipse(Phaser.Math.Between(0, W), 60 + i * 70, 160, 46, 0xffffff, 0.85).setDepth(-9);
      this.tweens.add({ targets: cloud, x: cloud.x + W + 200, duration: 60000 + i * 15000, repeat: -1, onRepeat: () => (cloud.x = -200) });
    }
  }

  private buildPets(): void {
    this.pets.forEach((p) => p.img.destroy());
    this.pets = save.equipped.map((key, i) => {
      const { def, variant } = parseKey(key);
      const spot = PET_SPOTS[i];
      const img = this.add.image(spot.x, spot.y, def.sprite).setTint(variant === "golden" ? 0xffd700 : def.color).setDepth(spot.y);
      this.tweens.add({ targets: img, y: spot.y - 8, duration: 350 + i * 40, yoyo: true, repeat: -1, ease: "Sine.inOut" });
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
    if (wave === WAVES_PER_STAGE) {
      this.spawnQueue.length = Math.ceil(n / 2);
      this.spawnQueue.splice(2, 0, ENEMIES.boss);
    }
    this.spawnTimer = 400;
    this.heroHp = heroMaxHp();
    this.banner(wave === WAVES_PER_STAGE ? "⚠ BOSS WAVE ⚠" : `Wave ${wave}`, wave === WAVES_PER_STAGE ? "#f43f5e" : "#ffffff");
  }

  private waveCleared(): void {
    if (save.wave >= WAVES_PER_STAGE) {
      save.stage++;
      save.wave = 1;
      save.bestStage = Math.max(save.bestStage, save.stage);
      this.banner(`STAGE ${save.stage}!`, "#fde047", 1400);
      this.cameras.main.flash(250);
    } else {
      save.wave++;
    }
    persist();
    this.waveDelay = 1200;
  }

  private retreat(): void {
    this.enemies.forEach((e) => e.img.destroy());
    this.enemies = [];
    this.shots.forEach((s) => s.img.destroy());
    this.shots = [];
    save.wave = Math.max(1, save.wave - 1);
    persist();
    this.cameras.main.shake(300, 0.01);
    this.banner("Retreat! Get stronger 💪", "#f87171", 1400);
    this.waveDelay = 1600;
  }

  private banner(str: string, color: string, ms = 900): void {
    const t = text(this, this.scale.width / 2, 230, str, 50, color).setDepth(1002).setScale(0);
    this.tweens.add({ targets: t, scale: 1, duration: 250, ease: "Back.out" });
    this.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 400, onComplete: () => t.destroy() });
  }

  // ───────────────────────── loop ─────────────────────────

  update(time: number, delta: number): void {
    this.coinText.setText(`🪙 ${fmt(save.coins)}`);
    this.stageText.setText(`Stage ${save.stage}  •  ${save.wave === WAVES_PER_STAGE ? "BOSS" : `Wave ${save.wave}/${WAVES_PER_STAGE}`}`);
    this.pets.forEach((p, i) => p.variant === "rainbow" && p.img.setTint(rainbowColor(time, i * 0.2)));
    this.trackEarnings(delta);

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
    const hpMult = 1.32 ** (stage - 1) * (1 + 0.08 * (wave - 1));
    const y = type.flying ? Phaser.Math.Between(300, 370) : type.scale ? 480 : Phaser.Math.Between(420, 565);
    const img = this.add.image(SPAWN_X, y, type.tex).setTint(type.tint).setScale(type.scale ?? 1).setDepth(y);
    if (type.flying) this.tweens.add({ targets: img, y: y - 18, duration: 300, yoyo: true, repeat: -1 });
    else this.tweens.add({ targets: img, angle: { from: -4, to: 4 }, duration: 260, yoyo: true, repeat: -1 });
    const hp = Math.round(type.hp * hpMult);
    this.enemies.push({
      img, type, hp, maxHp: hp,
      dmg: Math.round(type.dmg * 1.18 ** (stage - 1)),
      coins: Math.ceil(type.coins * 1.22 ** (stage - 1)),
      stopX: FRONT_LINE + Phaser.Math.Between(0, 50) + (type.scale ? 60 : 0),
      atkTimer: 0, flashUntil: 0, boss: type === ENEMIES.boss,
    });
  }

  private moveEnemies(time: number, delta: number): void {
    for (const e of this.enemies) {
      if (e.img.x > e.stopX) {
        e.img.x -= (e.type.speed * delta) / 1000;
      } else {
        e.atkTimer -= delta;
        if (e.atkTimer <= 0) {
          e.atkTimer = 1000;
          this.tweens.add({ targets: e.img, x: e.img.x - 18, duration: 90, yoyo: true });
          this.hurtHero(e.dmg);
        }
      }
      if (e.flashUntil && time > e.flashUntil) {
        e.flashUntil = 0;
        e.img.setTint(e.type.tint);
      }
    }
  }

  private hurtHero(dmg: number): void {
    if (this.waveDelay > 0) return;
    this.heroHp -= dmg;
    this.hero.setTintFill(0xff6666);
    this.time.delayedCall(80, () => this.hero.clearTint());
    if (this.heroHp <= 0) this.retreat();
  }

  // ───────────────────────── attacking ─────────────────────────

  private frontEnemy(): Enemy | undefined {
    let best: Enemy | undefined;
    for (const e of this.enemies) if (e.img.x < 740 && (!best || e.img.x < best.img.x)) best = e;
    return best;
  }

  private heroAttack(delta: number): void {
    this.heroTimer -= delta;
    if (this.heroTimer > 0) return;
    const target = this.frontEnemy();
    if (!target) return;
    this.heroTimer = heroInterval();
    this.fire(HERO.x + 55, HERO.y - 12, target, HERO_DAMAGE * this.damageMult(), 0x60a5fa, 0, 1);
    this.tweens.add({ targets: this.hero, x: HERO.x - 5, duration: 50, yoyo: true });
  }

  private petAttacks(time: number, delta: number): void {
    const mult = this.damageMult();
    for (const p of this.pets) {
      if (p.def.kind === "buff") continue;
      p.timer -= delta;
      if (p.timer > 0 || !this.enemies.length) continue;
      p.timer = p.def.cooldown;
      const dmg = p.def.damage * VARIANT_INFO[p.variant].mult * mult;
      const color = p.variant === "rainbow" ? rainbowColor(time) : p.variant === "golden" ? 0xffd700 : p.def.color;
      const { x, y } = p.img;
      this.tweens.add({ targets: p.img, scaleX: 1.2, scaleY: 0.85, duration: 80, yoyo: true });

      const targets = Phaser.Utils.Array.Shuffle(this.enemies.filter((e) => e.img.x < 740)).slice(0, Math.max(1, p.def.count));
      if (!targets.length) continue;
      switch (p.def.kind) {
        case "shot":
          for (let i = 0; i < p.def.count; i++) {
            const t = this.frontEnemy()!;
            this.time.delayedCall(i * 90, () => this.fire(x + 20, y - 10, t, dmg, color, 0, 0.9));
          }
          break;
        case "splash":
          targets.forEach((t) => this.fire(x, y - 20, t, dmg, color, 90, 1.6));
          break;
        case "zap":
          targets.forEach((t) => {
            this.strikes.push({ x1: t.img.x, y1: -20, x2: t.img.x, y2: t.img.y, until: time + 150, color, beam: false });
            this.hit(t, dmg);
          });
          break;
        case "pierce":
          targets.slice(0, p.def.count).forEach((t) => {
            const ly = t.img.y;
            this.strikes.push({ x1: x + 20, y1: y - 10, x2: 760, y2: ly, until: time + 180, color, beam: true });
            // everything near the beam line takes damage
            for (const e of [...this.enemies]) {
              const lineY = y - 10 + ((ly - (y - 10)) * (e.img.x - x)) / (760 - x);
              if (Math.abs(e.img.y - lineY) < 40) this.hit(e, dmg);
            }
          });
          break;
      }
    }
  }

  private fire(x: number, y: number, target: Enemy, dmg: number, color: number, splash: number, scale: number): void {
    if (!this.enemies.includes(target)) return;
    const img = this.add.image(x, y, "bullet").setTint(color).setScale(scale).setDepth(850);
    this.shots.push({ img, target, tx: target.img.x, ty: target.img.y, dmg, speed: splash ? 650 : 1100, splash });
  }

  private moveShots(delta: number): void {
    this.shots = this.shots.filter((s) => {
      if (this.enemies.includes(s.target)) {
        s.tx = s.target.img.x;
        s.ty = s.target.img.y;
      }
      const dx = s.tx - s.img.x;
      const dy = s.ty - s.img.y;
      const d = Math.hypot(dx, dy);
      const step = (s.speed * delta) / 1000;
      if (d > step + 10) {
        s.img.x += (dx / d) * step;
        s.img.y += (dy / d) * step;
        return true;
      }
      if (s.splash) {
        this.puff.setParticleTint(s.img.tintTopLeft);
        this.puff.explode(14, s.tx, s.ty);
        for (const e of [...this.enemies]) {
          if (Phaser.Math.Distance.Between(e.img.x, e.img.y, s.tx, s.ty) < s.splash) this.hit(e, s.dmg);
        }
      } else if (this.enemies.includes(s.target)) {
        this.hit(s.target, s.dmg);
      }
      s.img.destroy();
      return false;
    });
  }

  private hit(e: Enemy, dmg: number): void {
    if (!this.enemies.includes(e)) return;
    const amount = Math.max(1, Math.round(dmg * Phaser.Math.FloatBetween(0.9, 1.1)));
    e.hp -= amount;
    e.img.setTintFill(0xffffff);
    e.flashUntil = this.time.now + 60;
    this.pop(e.img.x, e.img.y - e.img.displayHeight / 2, fmt(amount), "#ffffff");
    if (e.hp <= 0) this.kill(e);
  }

  private kill(e: Enemy): void {
    this.enemies = this.enemies.filter((o) => o !== e);
    this.puff.setParticleTint(e.type.tint);
    this.puff.explode(e.boss ? 50 : 10, e.img.x, e.img.y);
    const coins = e.coins;
    save.coins += coins;
    this.earnedWindow += coins;
    this.pop(e.img.x, e.img.y - 10, `+${fmt(coins)} 🪙`, "#fde047");
    if (e.boss) this.cameras.main.shake(300, 0.012);
    e.img.destroy();
  }

  private pop(x: number, y: number, str: string, color: string): void {
    const t = this.popTexts.find((p) => !p.visible);
    if (!t) return;
    t.setText(str).setColor(color).setPosition(x + Phaser.Math.Between(-10, 10), y).setVisible(true).setAlpha(1);
    this.tweens.add({ targets: t, y: y - 45, alpha: 0, duration: 650, onComplete: () => t.setVisible(false) });
  }

  private drawFx(time: number): void {
    this.strikes = this.strikes.filter((s) => s.until > time);
    this.fx.clear();
    for (const s of this.strikes) {
      if (s.beam) {
        this.fx.lineStyle(14, s.color, 0.45).lineBetween(s.x1, s.y1, s.x2, s.y2);
        this.fx.lineStyle(5, 0xffffff, 0.9).lineBetween(s.x1, s.y1, s.x2, s.y2);
        continue;
      }
      this.fx.lineStyle(5, s.color, 1).beginPath();
      let y = s.y1;
      this.fx.moveTo(s.x2 + Phaser.Math.Between(-25, 25), y);
      while (y < s.y2) {
        y = Math.min(s.y2, y + 60);
        this.fx.lineTo(y === s.y2 ? s.x2 : s.x2 + Phaser.Math.Between(-22, 22), y);
      }
      this.fx.strokePath();
      this.fx.fillStyle(0xffffff, 0.8).fillCircle(s.x2, s.y2, 16);
    }

    // health bars
    this.bars.clear();
    const maxHp = heroMaxHp();
    this.bars.fillStyle(0x000000, 0.6).fillRect(HERO.x - 45, HERO.y - 70, 90, 12);
    this.bars.fillStyle(0x22c55e).fillRect(HERO.x - 44, HERO.y - 69, 88 * Phaser.Math.Clamp(this.heroHp / maxHp, 0, 1), 10);
    for (const e of this.enemies) {
      if (e.hp >= e.maxHp && !e.boss) continue;
      const w = e.boss ? 140 : 50;
      const y = e.img.y - e.img.displayHeight / 2 - 12;
      this.bars.fillStyle(0x000000, 0.6).fillRect(e.img.x - w / 2, y, w, 8);
      this.bars.fillStyle(e.boss ? 0xbe123c : 0xef4444).fillRect(e.img.x - w / 2 + 1, y + 1, (w - 2) * (e.hp / e.maxHp), 6);
    }
  }

  /** Keeps a smoothed coins-per-second figure for offline earnings, and autosaves. */
  private trackEarnings(delta: number): void {
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
