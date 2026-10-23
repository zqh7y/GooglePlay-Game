import { Tier } from "./tiers";

/**
 * Toy guns your hero finds in airdrops during a stage (every stage starts with the Water
 * Pistol). Each shoots its own silly ammo. `dmg` multiplies the hero's base shot damage;
 * a rarer tier is always a big step up.
 */
export interface GunDef {
  id: string;
  name: string;
  tier: Tier;
  dmg: number;
  /** ms between shots */
  fireMs: number;
  mag: number;
  reloadMs: number;
  /** projectiles per shot (cannons) */
  pellets: number;
  /** random aim spread in radians */
  spread: number;
  range: number;
  speed: number;
  /** extra monsters a shot passes through (on top of the one every shot gets) */
  pierce: number;
  /** blast radius on hit (0 = none) */
  explode: number;
  /** muzzle flash colour */
  color: number;
  /** ammo texture (ammo_<name>), random tints for colourful ammo, spin speed */
  ammo: string;
  tints?: number[];
  spin?: number;
  /** canvas size and where the hand grips it / where shots come out */
  w: number;
  h: number;
  grip: [number, number];
  muzzle: [number, number];
  /** size in the hero's hand */
  hold: number;
}

const G = (g: Omit<GunDef, "pellets" | "spread" | "pierce" | "explode" | "speed"> & Partial<GunDef>): GunDef => ({
  pellets: 1, spread: 0.03, pierce: 0, explode: 0, speed: 2200, ...g,
});

const PARTY = [0xff5a8a, 0x5ac8ff, 0xffd23f, 0x7ad651, 0xb46aff, 0xff9a3a];

export const GUNS: GunDef[] = [
  G({ id: "glock", name: "Water Pistol", tier: "A", dmg: 1, fireMs: 300, mag: 17, reloadMs: 1000, range: 700, color: 0x6ad0ff, ammo: "water", w: 150, h: 100, grip: [48, 74], muzzle: [142, 39], hold: 0.5 }),
  G({ id: "revolver", name: "Cork Popper", tier: "A", dmg: 2.6, fireMs: 850, mag: 6, reloadMs: 1500, range: 780, pierce: 1, color: 0xffd08a, ammo: "cork", w: 190, h: 100, grip: [44, 74], muzzle: [186, 32], hold: 0.48 }),
  G({ id: "uzi", name: "Foam Blaster", tier: "B", dmg: 0.65, fireMs: 110, mag: 32, reloadMs: 1400, spread: 0.12, range: 620, color: 0xffb060, ammo: "dart", w: 170, h: 120, grip: [102, 78], muzzle: [166, 41], hold: 0.55 }),
  G({ id: "mp5", name: "Bubble Blaster", tier: "B", dmg: 0.9, fireMs: 140, mag: 30, reloadMs: 1500, spread: 0.06, range: 720, speed: 1500, color: 0xc8f0ff, ammo: "bubble", w: 230, h: 110, grip: [96, 78], muzzle: [224, 40], hold: 0.55 }),
  G({ id: "shotgun", name: "Confetti Cannon", tier: "C", dmg: 1.4, pellets: 6, fireMs: 800, mag: 6, reloadMs: 1900, spread: 0.35, range: 520, color: 0xffe066, ammo: "confetti", tints: PARTY, spin: 14, w: 270, h: 90, grip: [96, 66], muzzle: [264, 38], hold: 0.55 }),
  G({ id: "deagle", name: "Candy Shooter", tier: "C", dmg: 5, fireMs: 500, mag: 7, reloadMs: 1300, range: 850, pierce: 1, color: 0xff8ac8, ammo: "candy", spin: 10, w: 180, h: 110, grip: [52, 84], muzzle: [174, 35], hold: 0.52 }),
  G({ id: "ak47", name: "Paintball Rifle", tier: "D", dmg: 2.1, fireMs: 130, mag: 30, reloadMs: 1800, spread: 0.07, range: 850, color: 0xff8ac8, ammo: "paint", tints: PARTY, w: 290, h: 120, grip: [118, 82], muzzle: [286, 42], hold: 0.55 }),
  G({ id: "m4a1", name: "Snowball Rifle", tier: "D", dmg: 1.8, fireMs: 100, mag: 30, reloadMs: 1600, spread: 0.04, range: 900, color: 0xe8f8ff, ammo: "snow", w: 290, h: 120, grip: [120, 84], muzzle: [286, 46], hold: 0.55 }),
  G({ id: "awp", name: "Pea Shooter", tier: "E", dmg: 22, fireMs: 900, mag: 5, reloadMs: 2200, range: 1300, pierce: 5, speed: 4200, spread: 0, color: 0x9aee6a, ammo: "pea", w: 330, h: 120, grip: [118, 80], muzzle: [328, 46], hold: 0.55 }),
  G({ id: "aa12", name: "Firework Blaster", tier: "E", dmg: 1.6, pellets: 6, fireMs: 260, mag: 20, reloadMs: 2200, spread: 0.32, range: 560, color: 0xffd23f, ammo: "firework", tints: PARTY, w: 260, h: 130, grip: [100, 86], muzzle: [258, 42], hold: 0.55 }),
  G({ id: "minigun", name: "Gumball Gatling", tier: "S", dmg: 2.2, fireMs: 45, mag: 200, reloadMs: 3500, spread: 0.1, range: 850, color: 0xff8ac8, ammo: "gum", tints: PARTY, w: 300, h: 140, grip: [110, 108], muzzle: [294, 74], hold: 0.55 }),
  G({ id: "launcher", name: "Water Balloon Launcher", tier: "S", dmg: 14, fireMs: 600, mag: 6, reloadMs: 2500, explode: 200, speed: 1300, spread: 0.02, range: 900, color: 0x6ad0ff, ammo: "balloon", tints: [0x5ac8ff, 0xff5a8a, 0xffd23f, 0xb46aff], w: 270, h: 130, grip: [96, 88], muzzle: [264, 46], hold: 0.55 }),
  G({ id: "dragon", name: "Dragon Breath", tier: "SSS", dmg: 4.5, fireMs: 40, mag: 300, reloadMs: 3000, spread: 0.09, explode: 70, range: 950, color: 0xff7a3a, ammo: "fire", w: 320, h: 150, grip: [116, 104], muzzle: [314, 66], hold: 0.55 }),
  G({ id: "plasma", name: "Rainbow Star Blaster", tier: "SSS", dmg: 9, fireMs: 90, mag: 60, reloadMs: 1500, pierce: 99, speed: 3200, spread: 0.02, range: 1100, color: 0xffffff, ammo: "star", spin: 10, w: 300, h: 130, grip: [118, 88], muzzle: [294, 48], hold: 0.55 }),
];

export const GUN_BY_ID = Object.fromEntries(GUNS.map((g) => [g.id, g])) as Record<string, GunDef>;
export const STARTER_GUN = GUNS[0];
export const gunsOfTier = (t: Tier) => GUNS.filter((g) => g.tier === t);
/** Rough damage per second (for comparing guns). */
export const gunDps = (g: GunDef) => ((g.dmg * g.pellets * 1000) / g.fireMs) * (g.mag / (g.mag + (g.reloadMs / g.fireMs))) * (1 + Math.min(g.pierce, 4) * 0.15 + g.explode / 150);
export const gunKey = (id: string) => `gun_${id}`;
