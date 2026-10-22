import Phaser from "phaser";

export interface EnemyType {
  key: string;
  texture: string;
  tint: number;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  scale: number;
  radius: number;
  /** seconds into the run before this enemy starts spawning */
  from: number;
  /** relative spawn chance once unlocked */
  weight: number;
}

export const ENEMY_TYPES: EnemyType[] = [
  { key: "slime", texture: "slime", tint: 0x4ade80, hp: 20, speed: 75, damage: 8, xp: 1, scale: 1, radius: 18, from: 0, weight: 10 },
  { key: "bat", texture: "bat", tint: 0xa78bfa, hp: 12, speed: 140, damage: 6, xp: 1, scale: 1, radius: 14, from: 30, weight: 6 },
  { key: "brute", texture: "brute", tint: 0xef4444, hp: 90, speed: 55, damage: 18, xp: 5, scale: 1.1, radius: 28, from: 75, weight: 3 },
];

export const BOSS: EnemyType = {
  key: "boss", texture: "brute", tint: 0x9f1239, hp: 5000, speed: 65, damage: 35, xp: 100, scale: 2.6, radius: 70, from: 0, weight: 0,
};

let nextUid = 1;

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  uid = 0;
  hp = 1;
  maxHp = 1;
  speed = 0;
  damage = 0;
  xp = 1;
  isBoss = false;
  flashUntil = 0;
  /** last time each orbit weapon hit this enemy (by weapon index) */
  hitTimes: Record<number, number> = {};

  spawn(x: number, y: number, type: EnemyType, hpScale: number): void {
    this.enableBody(true, x, y, true, true);
    this.uid = nextUid++;
    this.setTexture(type.texture).setTint(type.tint).setScale(type.scale).setDepth(type === BOSS ? 4 : 3);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(type.radius / type.scale, this.width / 2 - type.radius / type.scale, this.height / 2 - type.radius / type.scale);
    this.maxHp = this.hp = Math.round(type.hp * hpScale);
    this.speed = type.speed * Phaser.Math.FloatBetween(0.9, 1.1);
    this.damage = type.damage;
    this.xp = type.xp;
    this.isBoss = type === BOSS;
    this.flashUntil = 0;
    this.hitTimes = {};
    this.setData("tint", type.tint);
  }
}
