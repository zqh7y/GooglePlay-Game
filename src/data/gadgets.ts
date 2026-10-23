import { Tier, tierIndex } from "./tiers";

/**
 * Gadgets: the hero's weapons. They all fire on their own; you carry up to three at once.
 * Airdrops bring a gadget of some tier (A to SSS): a new kind fills a free slot, the same
 * kind upgrades to the better tier or gains a level.
 */
export type GadgetKind = "shuriken" | "saw" | "rocket" | "mine" | "drone" | "boomerang" | "ball" | "grenade";

export interface GadgetBase {
  kind: GadgetKind;
  name: string;
  desc: string;
  color: number;
  /** damage per hit, times the hero's damage */
  dmg: number;
  /** milliseconds between uses (saws: between hits on the same monster) */
  cd: number;
  /** projectiles per use (saws: blades; mines: how many can lie around) */
  count: number;
  range: number;
  /** explosion radius (0 = none) */
  radius: number;
  /** extra monsters a projectile goes through (shuriken) or bounces to (ball) */
  pierce: number;
  speed: number;
}

export const GADGETS: Record<GadgetKind, GadgetBase> = {
  shuriken: { kind: "shuriken", name: "Shuriken", desc: "Throws spinning stars that cut through monsters", color: 0xb8c8e0, dmg: 1.2, cd: 420, count: 1, range: 900, radius: 0, pierce: 1, speed: 1300 },
  saw: { kind: "saw", name: "Saw Blades", desc: "Blades spin around you and shred anything close", color: 0xff9a3a, dmg: 0.7, cd: 350, count: 2, range: 190, radius: 0, pierce: 0, speed: 3.4 },
  rocket: { kind: "rocket", name: "Rockets", desc: "Homing rockets that blow up groups", color: 0xff4a4a, dmg: 3, cd: 1500, count: 1, range: 1100, radius: 150, pierce: 0, speed: 750 },
  mine: { kind: "mine", name: "Mines", desc: "Drops mines behind you that go off when stepped on", color: 0xe84a5a, dmg: 4, cd: 900, count: 5, range: 0, radius: 170, pierce: 0, speed: 0 },
  drone: { kind: "drone", name: "Bomber Drone", desc: "A little drone flies over monsters and drops bombs", color: 0x5ac8ff, dmg: 2.2, cd: 1300, count: 1, range: 750, radius: 130, pierce: 0, speed: 0 },
  boomerang: { kind: "boomerang", name: "Boomerang", desc: "Flies out through monsters and comes back to you", color: 0xffcf3a, dmg: 1.6, cd: 1100, count: 1, range: 650, radius: 0, pierce: 99, speed: 1100 },
  ball: { kind: "ball", name: "Bouncy Ball", desc: "Bounces from monster to monster", color: 0xff6ad8, dmg: 1.4, cd: 1000, count: 1, range: 800, radius: 0, pierce: 3, speed: 1200 },
  grenade: { kind: "grenade", name: "Grenade", desc: "Lobs grenades into crowds. S tier and up: black holes!", color: 0x6fd25a, dmg: 3.5, cd: 1700, count: 1, range: 800, radius: 200, pierce: 0, speed: 0 },
};

export const GADGET_KINDS = Object.keys(GADGETS) as GadgetKind[];
export const STARTER_GADGET: GadgetKind = "shuriken";
export const GADGET_SLOTS = 3;
export const MAX_GADGET_LEVEL = 5;

export const gadgetKey = (kind: GadgetKind) => `gd_${kind}`;

/** A gadget's numbers at a tier and level. Higher tiers hit much harder, fire faster and throw more. */
export function gadgetStats(kind: GadgetKind, tier: Tier, level: number): GadgetBase {
  const b = GADGETS[kind];
  const t = tierIndex(tier);
  return {
    ...b,
    dmg: b.dmg * (1 + 0.55 * t + 0.08 * t * t) * (1 + 0.2 * (level - 1)),
    cd: b.cd * 0.94 ** t,
    count: b.count + Math.floor(t / 2),
    radius: b.radius * (1 + 0.08 * t),
    pierce: b.pierce + (kind === "boomerang" ? 0 : Math.floor(t / 2)),
  };
}

/** Rough damage per second (as a multiple of the hero's damage), for comparing and the DPS panel. */
export function gadgetDps(kind: GadgetKind, tier: Tier, level: number): number {
  const s = gadgetStats(kind, tier, level);
  // how many monsters a use usually hits
  const hits = { shuriken: 1 + Math.min(2, s.pierce) * 0.5, saw: 2.5, rocket: 3, mine: 3, drone: 2.5, boomerang: 2.5, ball: 1 + s.pierce * 0.7, grenade: 3.5 }[kind];
  const count = kind === "saw" ? s.count : kind === "mine" ? 1 : s.count;
  return (s.dmg * count * hits * 1000) / s.cd;
}

/** What a gadget is called at a tier (grenades become black holes at S). */
export const gadgetName = (kind: GadgetKind, tier: Tier) => (kind === "grenade" && tierIndex(tier) >= 5 ? "Black Hole" : GADGETS[kind].name);
