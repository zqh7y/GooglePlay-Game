import { Tier, tierIndex } from "./tiers";

/**
 * Gadgets: the hero's weapons. They all fire on their own; you carry up to three at once.
 * Airdrops bring a gadget of some tier (A to SSS): a new kind fills a free slot, the same
 * kind upgrades to the better tier or gains a level.
 */
export type GadgetKind = "shuriken" | "wisp" | "bubble" | "glue" | "kite" | "boomerang" | "popcorn" | "grenade";

export interface GadgetBase {
  kind: GadgetKind;
  name: string;
  desc: string;
  color: number;
  /** damage per hit, times the hero's damage */
  dmg: number;
  /** milliseconds between uses */
  cd: number;
  /** projectiles per use (wisps: how many circle you; popcorn: kernels in the ring) */
  count: number;
  range: number;
  /** blast or puddle radius (0 = none) */
  radius: number;
  /** extra monsters a projectile goes through (shuriken, kernels) or the lightning jumps to (kite) */
  pierce: number;
  speed: number;
}

export const GADGETS: Record<GadgetKind, GadgetBase> = {
  shuriken: { kind: "shuriken", name: "Shuriken", desc: "Throws spinning stars that cut through monsters", color: 0xb8c8e0, dmg: 1.2, cd: 420, count: 1, range: 900, radius: 0, pierce: 1, speed: 1300 },
  wisp: { kind: "wisp", name: "Ghost Wisps", desc: "Little ghost flames circle you and dart at monsters, then come back", color: 0x7ee0ff, dmg: 1.9, cd: 700, count: 2, range: 560, radius: 0, pierce: 0, speed: 1500 },
  bubble: { kind: "bubble", name: "Bubble Wand", desc: "Blows bubbles that trap a monster, then pop and splash everyone near", color: 0xb8e8ff, dmg: 4, cd: 1500, count: 1, range: 950, radius: 140, pierce: 0, speed: 460 },
  glue: { kind: "glue", name: "Glue Splat", desc: "Splats sticky glue: monsters in it are slowed and keep getting hurt", color: 0xe8f0f8, dmg: 0.7, cd: 1600, count: 1, range: 700, radius: 170, pierce: 0, speed: 0 },
  kite: { kind: "kite", name: "Storm Kite", desc: "A kite above you calls lightning that jumps from monster to monster", color: 0xffcf3a, dmg: 2.4, cd: 1100, count: 1, range: 850, radius: 0, pierce: 2, speed: 0 },
  boomerang: { kind: "boomerang", name: "Boomerang", desc: "Flies out through monsters and comes back to you", color: 0xffcf3a, dmg: 1.6, cd: 1100, count: 1, range: 650, radius: 0, pierce: 99, speed: 1100 },
  popcorn: { kind: "popcorn", name: "Popcorn Pop", desc: "Pops a ring of hot kernels in every direction", color: 0xfff0c0, dmg: 1.2, cd: 1100, count: 8, range: 520, radius: 0, pierce: 0, speed: 950 },
  grenade: { kind: "grenade", name: "Grenade", desc: "Lobs grenades into crowds. S tier and up: black holes!", color: 0x6fd25a, dmg: 3.5, cd: 1700, count: 1, range: 800, radius: 200, pierce: 0, speed: 0 },
};

export const GADGET_KINDS = Object.keys(GADGETS) as GadgetKind[];
export const STARTER_GADGET: GadgetKind = "shuriken";
export const GADGET_SLOTS = 3;
export const MAX_GADGET_LEVEL = 5;

export const gadgetKey = (kind: GadgetKind) => `gd_${kind}`;
/** The big, sharp picture of a gadget for cards, medals and the HUD. */
export const gadgetIcon = (kind: GadgetKind) => `gdi_${kind}`;

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
  // glue hurts every half second for 4 s, about three monsters at a time; kernels often miss
  const hits = { shuriken: 1 + Math.min(2, s.pierce) * 0.5, wisp: 1.4, bubble: 2.5, glue: 3 * 8, kite: 1 + s.pierce * 0.8, boomerang: 2.5, popcorn: 0.6 + s.pierce * 0.3, grenade: 3.5 }[kind];
  return (s.dmg * s.count * hits * 1000) / s.cd;
}

/** What a gadget is called at a tier (grenades become black holes at S). */
export const gadgetName = (kind: GadgetKind, tier: Tier) => (kind === "grenade" && tierIndex(tier) >= 5 ? "Black Hole" : GADGETS[kind].name);
