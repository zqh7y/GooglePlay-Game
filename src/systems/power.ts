import { HERO_BASE_DMG, HERO_TEAM_SHARE, heroHpAt } from "../data/balance";
import { GadgetKind, STARTER_GADGET, gadgetDps } from "../data/gadgets";
import { ITEMS, levelMult } from "../data/items";
import { save } from "./save";
import { critChance, critDamage, dmgMult, heroDmgMult, petSlots, villageHpMult } from "./stats";

/**
 * Damage per second of the hero and the team as they would start a fight (no in-fight
 * skills yet), using the same formulas as the battle: pets add a share of their damage to
 * the hero, "buff" pets raise everyone's damage, and crits are averaged in.
 */
export function teamDps(gadget: GadgetKind = STARTER_GADGET): { hero: number; pets: number; total: number; perPet: Record<string, number> } {
  const team = save.equipped.slice(0, petSlots()).filter((id) => ITEMS[id] && save.pets[id]);
  const petHit = (id: string) => ITEMS[id].damage * levelMult(save.pets[id].level);
  const buff = team.filter((id) => ITEMS[id].kind === "buff").reduce((s, id) => s + petHit(id) / 100, 0);
  const mult = dmgMult() * (1 + buff);
  const crit = 1 + critChance() * (critDamage() - 1);
  const fighters = team.filter((id) => ITEMS[id].kind !== "buff");
  const share = fighters.reduce((s, id) => s + petHit(id), 0) * HERO_TEAM_SHARE;
  const heroHit = (HERO_BASE_DMG + share) * mult * heroDmgMult();
  // the gadget you start a fight with, at tier A
  const hero = heroHit * gadgetDps(gadget, "A", 1) * crit;
  const perPet: Record<string, number> = {};
  for (const id of fighters) {
    const d = ITEMS[id];
    perPet[id] = (petHit(id) * mult * d.count * 1000 * crit) / d.cooldown;
  }
  const pets = Object.values(perPet).reduce((a, b) => a + b, 0);
  return { hero, pets, total: hero + pets, perPet };
}

export const heroMaxHp = () => heroHpAt(save.stage) * villageHpMult();
