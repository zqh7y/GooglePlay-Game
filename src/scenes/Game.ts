import Phaser from "phaser";
import { ItemDef, VARIANT_INFO, Variant, parseKey } from "../data/items";
import { BOSS, ENEMY_TYPES, Enemy, EnemyType } from "../game/Enemy";
import { persist, save } from "../systems/save";
import { button, text } from "../ui/widgets";

export const RUN_LENGTH = 300; // seconds to survive for victory
const BOSS_AT = 180;
const MAX_ENEMIES = 350;
const MAX_LEVEL = 5;

export function formatTime(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Weapon {
  def: ItemDef;
  variant: Variant;
  level: number;
  timer: number;
  angle: number;
  blades: Phaser.GameObjects.Image[];
  aura?: Phaser.GameObjects.Image;
}

interface Choice {
  title: string;
  desc: string;
  color: number;
  apply: () => void;
}

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private gems: Phaser.GameObjects.Image[] = [];
  private dmgTexts: Phaser.GameObjects.Text[] = [];
  private weapons: Weapon[] = [];
  private bg!: Phaser.GameObjects.TileSprite;
  private bolts!: Phaser.GameObjects.Graphics;
  private strikes: { x: number; y: number; until: number; color: number }[] = [];
  private deathFx!: Phaser.GameObjects.Particles.ParticleEmitter;

  // HUD
  private hpBar!: Phaser.GameObjects.Graphics;
  private xpBar!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;
  private bossBar?: Phaser.GameObjects.Graphics;

  // Joystick
  private joy = { active: false, id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
  private joyGfx!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  // Run state
  private elapsed = 0;
  private spawnTimer = 0;
  private paused = false;
  private ended = false;
  private bossSpawned = false;
  private boss?: Enemy;
  private kills = 0;
  private bonusCoins = 0;
  private hp = 100;
  private maxHp = 100;
  private invulnUntil = 0;
  private xp = 0;
  private level = 1;
  private xpNeeded = 5;
  private stats = { dmg: 1, cd: 1, speed: 1, magnet: 140 };

  constructor() {
    super("Game");
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    Object.assign(this, {
      gems: [], dmgTexts: [], weapons: [], strikes: [], elapsed: 0, spawnTimer: 0, paused: false, ended: false,
      bossSpawned: false, boss: undefined, bossBar: undefined, kills: 0, bonusCoins: 0, hp: 100, maxHp: 100,
      invulnUntil: 0, xp: 0, level: 1, xpNeeded: 5, stats: { dmg: 1, cd: 1, speed: 1, magnet: 140 },
    });
    this.joy = { active: false, id: -1, bx: 0, by: 0, dx: 0, dy: 0 };

    this.bg = this.add.tileSprite(0, 0, W, H, "grid").setOrigin(0).setScrollFactor(0);
    this.physics.world.resume();

    this.player = this.physics.add.sprite(0, 0, "player").setDepth(5);
    (this.player.body as Phaser.Physics.Arcade.Body).setCircle(22, 10, 14);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    this.enemies = this.physics.add.group({ classType: Enemy, maxSize: MAX_ENEMIES, runChildUpdate: false });
    this.bullets = this.physics.add.group({ defaultKey: "bullet", maxSize: 500 });
    this.bolts = this.add.graphics().setDepth(8);
    this.deathFx = this.add.particles(0, 0, "particle", {
      speed: { min: 60, max: 220 }, lifespan: 380, scale: { start: 1.2, end: 0 }, emitting: false,
    }).setDepth(6);

    for (let i = 0; i < 40; i++) {
      this.dmgTexts.push(text(this, 0, 0, "", 22).setDepth(20).setVisible(false));
    }

    // Weapons from the equipped dice items
    save.equipped.forEach((key) => {
      const { def, variant } = parseKey(key);
      const w: Weapon = { def, variant, level: 1, timer: 0, angle: 0, blades: [] };
      if (def.kind === "aura") {
        w.aura = this.add.image(0, 0, "ring").setTint(def.color).setDepth(2).setAlpha(0.7);
      }
      this.weapons.push(w);
    });
    this.weapons.forEach((w) => this.syncBlades(w));

    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => this.bulletHit(b as Phaser.Physics.Arcade.Image, e as Enemy));
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.touchEnemy(e as Enemy));

    this.createHud();
    this.createControls();
  }

  // ───────────────────────── HUD & controls ─────────────────────────

  private createHud(): void {
    const W = this.scale.width;
    this.xpBar = this.add.graphics().setScrollFactor(0).setDepth(50);
    this.hpBar = this.add.graphics().setDepth(9);
    this.levelText = text(this, W / 2, 38, "", 22).setScrollFactor(0).setDepth(51);
    this.timerText = text(this, W / 2, 90, "", 44).setScrollFactor(0).setDepth(51);
    this.killText = text(this, W - 20, 90, "", 26, "#fca5a5").setOrigin(1, 0.5).setScrollFactor(0).setDepth(51);
    button(this, 60, 92, 80, 64, "II", 0x334155, () => this.showPause(), 30).setScrollFactor(0, 0, true).setDepth(51);
  }

  private createControls(): void {
    this.joyGfx = this.add.graphics().setScrollFactor(0).setDepth(60);
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.paused || this.joy.active || p.y < 140) return;
      this.joy = { active: true, id: p.id, bx: p.x, by: p.y, dx: 0, dy: 0 };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.joy.active || p.id !== this.joy.id) return;
      const v = new Phaser.Math.Vector2(p.x - this.joy.bx, p.y - this.joy.by);
      if (v.length() > 80) v.setLength(80);
      this.joy.dx = v.x;
      this.joy.dy = v.y;
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id === this.joy.id) this.joy = { active: false, id: -1, bx: 0, by: 0, dx: 0, dy: 0 };
    };
    this.input.on("pointerup", release);
    this.input.on("pointerupoutside", release);
  }

  private drawHud(): void {
    const W = this.scale.width;
    this.xpBar.clear();
    this.xpBar.fillStyle(0x000000, 0.6).fillRect(0, 0, W, 18);
    this.xpBar.fillStyle(0x38bdf8).fillRect(0, 0, (W * this.xp) / this.xpNeeded, 18);
    this.levelText.setText(`LV ${this.level}`);
    const left = Math.max(0, RUN_LENGTH - this.elapsed);
    this.timerText.setText(formatTime(left));
    this.killText.setText(`💀 ${this.kills}`);

    this.hpBar.clear();
    const x = this.player.x - 32;
    const y = this.player.y + 36;
    this.hpBar.fillStyle(0x000000, 0.7).fillRect(x, y, 64, 9);
    this.hpBar.fillStyle(0xef4444).fillRect(x + 1, y + 1, 62 * (this.hp / this.maxHp), 7);

    this.joyGfx.clear();
    if (this.joy.active) {
      this.joyGfx.fillStyle(0xffffff, 0.12).fillCircle(this.joy.bx, this.joy.by, 90);
      this.joyGfx.lineStyle(3, 0xffffff, 0.3).strokeCircle(this.joy.bx, this.joy.by, 90);
      this.joyGfx.fillStyle(0xffffff, 0.45).fillCircle(this.joy.bx + this.joy.dx, this.joy.by + this.joy.dy, 40);
    }

    if (this.boss?.active) {
      if (!this.bossBar) this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(50);
      this.bossBar.clear();
      this.bossBar.fillStyle(0x000000, 0.7).fillRect(60, 140, W - 120, 22);
      this.bossBar.fillStyle(0xbe123c).fillRect(62, 142, (W - 124) * (this.boss.hp / this.boss.maxHp), 18);
    } else {
      this.bossBar?.clear();
    }
  }

  // ───────────────────────── main loop ─────────────────────────

  update(time: number, delta: number): void {
    this.bg.setTilePosition(this.cameras.main.scrollX, this.cameras.main.scrollY);
    this.drawHud();
    if (this.paused || this.ended) return;

    const dt = delta / 1000;
    this.elapsed += dt;
    if (this.elapsed >= RUN_LENGTH) return this.endRun(true);

    this.movePlayer();
    this.spawnEnemies(delta);
    this.moveEnemies(time);
    this.updateWeapons(time, delta);
    this.updateBullets(time);
    this.updateGems(dt);
    this.drawStrikes(time);
  }

  private movePlayer(): void {
    const k = this.keys;
    let vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (this.joy.active && (this.joy.dx || this.joy.dy)) {
      vx = this.joy.dx / 80;
      vy = this.joy.dy / 80;
    }
    const v = new Phaser.Math.Vector2(vx, vy);
    if (v.length() > 1) v.normalize();
    const speed = 240 * this.stats.speed;
    this.player.setVelocity(v.x * speed, v.y * speed);
    if (vx !== 0) this.player.setFlipX(vx < 0);
  }

  private spawnEnemies(delta: number): void {
    const t = this.elapsed;
    if (!this.bossSpawned && t >= BOSS_AT) {
      this.bossSpawned = true;
      this.boss = this.spawnEnemy(BOSS, 1 + t / 120);
      const warn = text(this, 360, 400, "⚠ BOSS INCOMING ⚠", 52, "#f43f5e").setScrollFactor(0).setDepth(70);
      this.tweens.add({ targets: warn, alpha: 0, delay: 1500, duration: 600, onComplete: () => warn.destroy() });
      this.cameras.main.shake(500, 0.01);
    }

    this.spawnTimer -= delta;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = Math.max(150, 1000 - t * 4);
    const batch = 1 + Math.floor(t / 30);
    const unlocked = ENEMY_TYPES.filter((e) => t >= e.from);
    const total = unlocked.reduce((s, e) => s + e.weight, 0);
    for (let i = 0; i < batch; i++) {
      let r = Math.random() * total;
      const type = unlocked.find((e) => (r -= e.weight) < 0) ?? unlocked[0];
      this.spawnEnemy(type, 1 + t / 50);
    }
  }

  private spawnEnemy(type: EnemyType, hpScale: number): Enemy | undefined {
    const a = Math.random() * Math.PI * 2;
    const x = this.player.x + Math.cos(a) * 780;
    const y = this.player.y + Math.sin(a) * 780;
    const e = this.enemies.get(x, y) as Enemy | null;
    if (!e) return undefined;
    e.spawn(x, y, type, hpScale);
    return e;
  }

  private moveEnemies(time: number): void {
    const px = this.player.x;
    const py = this.player.y;
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy;
      if (!e.active) continue;
      const dx = px - e.x;
      const dy = py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      // Teleport far-behind enemies back in front of the player instead of losing them
      if (d > 1300 && !e.isBoss) {
        e.setPosition(px - dx * 0.55, py - dy * 0.55);
        continue;
      }
      e.setVelocity((dx / d) * e.speed, (dy / d) * e.speed);
      e.setFlipX(dx < 0);
      if (e.flashUntil && time > e.flashUntil) {
        e.flashUntil = 0;
        e.setTint(e.getData("tint"));
      }
    }
  }

  // ───────────────────────── weapons ─────────────────────────

  private weaponDamage(w: Weapon): number {
    return w.def.damage * VARIANT_INFO[w.variant].mult * (1 + 0.3 * (w.level - 1)) * this.stats.dmg;
  }
  private weaponCount(w: Weapon): number {
    return w.def.count + Math.floor((w.level - 1) / 2);
  }
  private weaponCooldown(w: Weapon): number {
    return w.def.cooldown * this.stats.cd * (1 - 0.07 * (w.level - 1));
  }

  private syncBlades(w: Weapon): void {
    if (w.def.kind !== "orbit") return;
    while (w.blades.length < this.weaponCount(w)) {
      w.blades.push(this.add.image(0, 0, "blade").setTint(w.def.color).setDepth(6));
    }
  }

  private updateWeapons(time: number, delta: number): void {
    const px = this.player.x;
    const py = this.player.y;
    this.weapons.forEach((w, wi) => {
      const dmg = this.weaponDamage(w);
      switch (w.def.kind) {
        case "orbit": {
          w.angle += (delta / 1000) * 3.4;
          const n = w.blades.length;
          w.blades.forEach((b, i) => {
            const a = w.angle + (i / n) * Math.PI * 2;
            b.setPosition(px + Math.cos(a) * w.def.range, py + Math.sin(a) * w.def.range).setRotation(a + Math.PI / 2);
            this.forEachEnemyNear(b.x, b.y, 26, (e) => {
              if (time - (e.hitTimes[wi] ?? 0) < 400) return;
              e.hitTimes[wi] = time;
              this.damageEnemy(e, dmg, time);
            });
          });
          return;
        }
        case "aura": {
          const radius = w.def.range * (1 + 0.12 * (w.level - 1));
          w.aura!.setPosition(px, py).setScale((radius * 2) / 256);
          w.timer -= delta;
          if (w.timer <= 0) {
            w.timer = this.weaponCooldown(w);
            this.forEachEnemyNear(px, py, radius, (e) => this.damageEnemy(e, dmg, time));
          }
          return;
        }
      }

      w.timer -= delta;
      if (w.timer > 0) return;
      w.timer = this.weaponCooldown(w);
      const count = this.weaponCount(w);

      if (w.def.kind === "bolt") {
        const target = this.nearestEnemy(px, py, 750);
        if (!target) {
          w.timer = 100;
          return;
        }
        const base = Math.atan2(target.y - py, target.x - px);
        for (let i = 0; i < count; i++) {
          const a = base + (i - (count - 1) / 2) * 0.14;
          this.fireBullet(px, py, a, w.def.range, dmg, w.def.pierce ?? 1, w.def.color, w.def.id === "catCannon" ? 2 : 1);
        }
      } else if (w.def.kind === "nova") {
        const off = Math.random() * Math.PI;
        for (let i = 0; i < count; i++) {
          this.fireBullet(px, py, off + (i / count) * Math.PI * 2, w.def.range, dmg, w.def.pierce ?? 1, w.def.color, 1.2);
        }
      } else if (w.def.kind === "lightning") {
        const near = this.activeEnemies().filter((e) => Phaser.Math.Distance.Between(px, py, e.x, e.y) < w.def.range);
        Phaser.Utils.Array.Shuffle(near).slice(0, count).forEach((e) => {
          this.strikes.push({ x: e.x, y: e.y, until: time + 140, color: w.def.color });
          this.damageEnemy(e, dmg, time);
        });
      }
    });
  }

  private fireBullet(x: number, y: number, angle: number, speed: number, dmg: number, pierce: number, color: number, scale: number): void {
    const b = this.bullets.get(x, y) as Phaser.Physics.Arcade.Image | null;
    if (!b) return;
    b.enableBody(true, x, y, true, true);
    b.setTint(color).setScale(scale).setDepth(7);
    (b.body as Phaser.Physics.Arcade.Body).setCircle(8);
    b.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    b.setData({ dmg, pierce, hit: new Set<number>(), expire: this.time.now + 1500 });
  }

  private updateBullets(time: number): void {
    for (const obj of this.bullets.getChildren()) {
      const b = obj as Phaser.Physics.Arcade.Image;
      if (b.active && time > b.getData("expire")) b.disableBody(true, true);
    }
  }

  private bulletHit(b: Phaser.Physics.Arcade.Image, e: Enemy): void {
    if (!b.active || !e.active) return;
    const hit: Set<number> = b.getData("hit");
    if (hit.has(e.uid)) return;
    hit.add(e.uid);
    this.damageEnemy(e, b.getData("dmg"), this.time.now);
    const pierce = b.getData("pierce") - 1;
    b.setData("pierce", pierce);
    if (pierce <= 0) b.disableBody(true, true);
  }

  private drawStrikes(time: number): void {
    this.strikes = this.strikes.filter((s) => s.until > time);
    this.bolts.clear();
    for (const s of this.strikes) {
      this.bolts.lineStyle(5, s.color, 1);
      this.bolts.beginPath();
      let x = s.x + Phaser.Math.Between(-30, 30);
      let y = s.y - 500;
      this.bolts.moveTo(x, y);
      while (y < s.y) {
        y = Math.min(s.y, y + 70);
        x = y === s.y ? s.x : s.x + Phaser.Math.Between(-28, 28);
        this.bolts.lineTo(x, y);
      }
      this.bolts.strokePath();
      this.bolts.fillStyle(0xffffff, 0.8).fillCircle(s.x, s.y, 18);
    }
  }

  // ───────────────────────── enemies, damage, pickups ─────────────────────────

  private activeEnemies(): Enemy[] {
    return (this.enemies.getChildren() as Enemy[]).filter((e) => e.active);
  }

  private nearestEnemy(x: number, y: number, max: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = max * max;
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy;
      if (!e.active) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private forEachEnemyNear(x: number, y: number, r: number, fn: (e: Enemy) => void): void {
    for (const obj of this.enemies.getChildren()) {
      const e = obj as Enemy;
      if (!e.active) continue;
      const rr = r + e.displayWidth * 0.35;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 < rr * rr) fn(e);
    }
  }

  private damageEnemy(e: Enemy, dmg: number, time: number): void {
    if (!e.active) return;
    const amount = Math.round(dmg * Phaser.Math.FloatBetween(0.9, 1.1));
    e.hp -= amount;
    e.setTintFill(0xffffff);
    e.flashUntil = time + 60;
    this.showDamage(e.x, e.y - e.displayHeight / 2, amount);
    if (e.hp <= 0) this.killEnemy(e);
  }

  private showDamage(x: number, y: number, amount: number): void {
    const t = this.dmgTexts.find((d) => !d.visible);
    if (!t) return;
    t.setText(String(amount)).setPosition(x + Phaser.Math.Between(-12, 12), y).setVisible(true).setAlpha(1);
    t.setColor(amount >= 100 ? "#fbbf24" : "#ffffff");
    this.tweens.add({ targets: t, y: y - 45, alpha: 0, duration: 550, onComplete: () => t.setVisible(false) });
  }

  private killEnemy(e: Enemy): void {
    this.kills++;
    this.deathFx.setParticleTint(e.getData("tint"));
    this.deathFx.explode(e.isBoss ? 60 : 6, e.x, e.y);
    this.dropGem(e.x, e.y, e.xp);
    if (e.isBoss) {
      this.bonusCoins += 300;
      this.cameras.main.flash(300);
      const t = text(this, 360, 400, "BOSS DEFEATED! +300 🪙", 46, "#fde047").setScrollFactor(0).setDepth(70);
      this.tweens.add({ targets: t, alpha: 0, delay: 1500, duration: 600, onComplete: () => t.destroy() });
    }
    e.disableBody(true, true);
  }

  private dropGem(x: number, y: number, value: number): void {
    let g = this.gems.find((gm) => !gm.active);
    if (!g) {
      if (this.gems.length >= 400) return this.gainXp(value);
      g = this.add.image(0, 0, "gem").setDepth(1);
      this.gems.push(g);
    }
    const color = value >= 50 ? 0xf43f5e : value >= 5 ? 0x22c55e : 0x38bdf8;
    g.setActive(true).setVisible(true).setPosition(x, y).setTint(color).setScale(value >= 5 ? 1.5 : 1);
    g.setData({ value, homing: false });
  }

  private updateGems(dt: number): void {
    const px = this.player.x;
    const py = this.player.y;
    for (const g of this.gems) {
      if (!g.active) continue;
      const d = Phaser.Math.Distance.Between(px, py, g.x, g.y);
      if (d < this.stats.magnet) g.setData("homing", true);
      if (!g.getData("homing")) continue;
      if (d < 28) {
        g.setActive(false).setVisible(false);
        this.gainXp(g.getData("value"));
        continue;
      }
      const sp = 650 * dt;
      g.x += ((px - g.x) / d) * sp;
      g.y += ((py - g.y) / d) * sp;
    }
  }

  private touchEnemy(e: Enemy): void {
    const now = this.time.now;
    if (this.ended || now < this.invulnUntil || !e.active) return;
    this.invulnUntil = now + 450;
    this.hp -= e.damage;
    this.cameras.main.shake(100, 0.006);
    this.player.setTintFill(0xff4444);
    this.time.delayedCall(90, () => this.player.clearTint());
    if (this.hp <= 0) {
      this.hp = 0;
      this.endRun(false);
    }
  }

  // ───────────────────────── leveling ─────────────────────────

  private gainXp(v: number): void {
    this.xp += v;
    if (this.xp >= this.xpNeeded && !this.paused && !this.ended) {
      this.xp -= this.xpNeeded;
      this.level++;
      this.xpNeeded = Math.floor(5 + this.level * 4 + this.level ** 1.6);
      this.showLevelUp();
    }
  }

  private buildChoices(): Choice[] {
    const pool: Choice[] = [];
    for (const w of this.weapons) {
      if (w.level >= MAX_LEVEL) continue;
      pool.push({
        title: `${VARIANT_INFO[w.variant].label}${w.def.name}`,
        desc: `Level ${w.level} → ${w.level + 1}\n+30% damage${w.level % 2 === 1 && w.def.kind !== "aura" ? ", +1 amount" : ""}`,
        color: w.def.color,
        apply: () => {
          w.level++;
          this.syncBlades(w);
        },
      });
    }
    pool.push(
      { title: "Power", desc: "+15% damage\nfor all weapons", color: 0xef4444, apply: () => (this.stats.dmg += 0.15) },
      { title: "Haste", desc: "-8% cooldown\nfor all weapons", color: 0x38bdf8, apply: () => (this.stats.cd *= 0.92) },
      { title: "Swift Paws", desc: "+12% move speed", color: 0x4ade80, apply: () => (this.stats.speed += 0.12) },
      { title: "Big Heart", desc: "+25 max HP\nand heal 25", color: 0xf472b6, apply: () => {
        this.maxHp += 25;
        this.hp = Math.min(this.maxHp, this.hp + 25);
      } },
      { title: "Magnet", desc: "+40% pickup range", color: 0xa78bfa, apply: () => (this.stats.magnet *= 1.4) },
      { title: "Snack", desc: "Heal 50% HP", color: 0xfbbf24, apply: () => (this.hp = Math.min(this.maxHp, this.hp + this.maxHp / 2)) },
    );
    return Phaser.Utils.Array.Shuffle(pool).slice(0, 3);
  }

  private showLevelUp(): void {
    this.setPaused(true);
    const W = this.scale.width;
    const objs: Phaser.GameObjects.GameObject[] = [];
    objs.push(this.add.rectangle(0, 0, W, this.scale.height, 0x000000, 0.7).setOrigin(0).setScrollFactor(0).setDepth(80));
    objs.push(text(this, W / 2, 300, "LEVEL UP!", 72, "#fde047").setScrollFactor(0).setDepth(81));
    objs.push(text(this, W / 2, 380, "Choose an upgrade", 30, "#cbd5e1").setScrollFactor(0).setDepth(81));
    this.buildChoices().forEach((c, i) => {
      const y = 540 + i * 210;
      const b = button(this, W / 2, y, 600, 180, "", 0x1e2140, () => {
        c.apply();
        objs.forEach((o) => o.destroy());
        this.setPaused(false);
      }).setScrollFactor(0, 0, true).setDepth(81);
      b.bg.setStrokeStyle(5, c.color);
      b.add(text(this, 0, -40, c.title, 34, "#" + c.color.toString(16).padStart(6, "0")).setScrollFactor(0));
      b.add(text(this, 0, 25, c.desc, 26, "#e2e8f0").setScrollFactor(0));
      objs.push(b);
    });
  }

  private showPause(): void {
    if (this.paused || this.ended) return;
    this.setPaused(true);
    const W = this.scale.width;
    const objs: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(0, 0, W, this.scale.height, 0x000000, 0.7).setOrigin(0).setScrollFactor(0).setDepth(80).setInteractive(),
      text(this, W / 2, 400, "PAUSED", 72).setScrollFactor(0).setDepth(81),
    ];
    objs.push(
      button(this, W / 2, 600, 420, 100, "Resume", 0x22c55e, () => {
        objs.forEach((o) => o.destroy());
        this.setPaused(false);
      }, 36).setScrollFactor(0, 0, true).setDepth(81),
      button(this, W / 2, 740, 420, 100, "Give up", 0xdc2626, () => {
        objs.forEach((o) => o.destroy());
        this.endRun(false);
      }, 36).setScrollFactor(0, 0, true).setDepth(81),
    );
  }

  private setPaused(on: boolean): void {
    this.paused = on;
    this.joy.active = false;
    if (on) {
      this.physics.world.pause();
    } else {
      this.physics.world.resume();
    }
  }

  // ───────────────────────── end of run ─────────────────────────

  private endRun(victory: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.paused = true;
    this.physics.world.pause();

    const timeCoins = Math.floor(this.elapsed) * 2;
    const winBonus = victory ? 500 : 0;
    const total = this.kills + timeCoins + this.bonusCoins + winBonus;
    save.coins += total;
    save.bestTime = Math.max(save.bestTime, Math.floor(this.elapsed));
    persist();

    const W = this.scale.width;
    this.add.rectangle(0, 0, W, this.scale.height, 0x000000, 0.8).setOrigin(0).setScrollFactor(0).setDepth(90);
    text(this, W / 2, 300, victory ? "VICTORY!" : "DEFEATED", 84, victory ? "#4ade80" : "#f87171").setScrollFactor(0).setDepth(91);
    text(
      this, W / 2, 560,
      `Survived: ${formatTime(this.elapsed)}\nLevel: ${this.level}\n\n` +
        `Kills: ${this.kills}  →  🪙 ${this.kills}\n` +
        `Time bonus  →  🪙 ${timeCoins}\n` +
        (this.bonusCoins ? `Boss bonus  →  🪙 ${this.bonusCoins}\n` : "") +
        (victory ? `Victory bonus  →  🪙 ${winBonus}\n` : ""),
      32, "#e2e8f0",
    ).setScrollFactor(0).setDepth(91);
    text(this, W / 2, 820, `+ 🪙 ${total}`, 64, "#fde047").setScrollFactor(0).setDepth(91);
    button(this, W / 2, 980, 460, 110, "🎲 Roll Dice", 0xa855f7, () => this.scene.start("Dice"), 40).setScrollFactor(0, 0, true).setDepth(91);
    button(this, W / 2, 1120, 460, 90, "Home", 0x475569, () => this.scene.start("Hub"), 34).setScrollFactor(0, 0, true).setDepth(91);
  }
}
