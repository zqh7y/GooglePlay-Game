/** Battle Boosts bought in the shop with money; each one is used up by the next fight. */
export type BoostId = "gun" | "revive" | "start" | "armor";

export interface BoostDef {
  id: BoostId;
  name: string;
  icon: string;
  desc: string;
  /** price in minutes of your income */
  minutes: number;
}

export const BOOSTS: BoostDef[] = [
  { id: "gun", name: "Golden Start", icon: "gun_deagle", desc: "Start the next fight with a C-tier toy gun", minutes: 15 },
  { id: "revive", name: "Second Chance", icon: "pk_heart", desc: "Get back up once for free in the next fight", minutes: 20 },
  { id: "start", name: "Head Start", icon: "skill_orb", desc: "Start the next fight with 2 free skills", minutes: 10 },
  { id: "armor", name: "Crystal Armor", icon: "icon_shield", desc: "The crystal has +50% health next fight", minutes: 10 },
];

export const BOOST_BY_ID = Object.fromEntries(BOOSTS.map((b) => [b.id, b])) as Record<BoostId, BoostDef>;
