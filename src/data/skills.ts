/**
 * Skills you pick during a stage. Each levels up to MAX_SKILL and they all reset when the
 * stage ends, so every run builds up again from nothing.
 */
export type SkillId =
  | "mag" | "reload" | "damage" | "firerate" | "range" | "boom" | "speed" | "magnet" | "mend" | "luck" | "tough" | "link" | "fort" | "pack";

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  /** badge colour */
  color: number;
  /** what the next level does (level = current level, 0 if new) */
  text: (level: number) => string;
}

export const MAX_SKILL = 5;

export const SKILLS: SkillDef[] = [
  { id: "mag", name: "Big Mag", icon: "sk_mag", color: 0xffc93a, text: () => "+40% bullets per magazine" },
  { id: "reload", name: "Quick Reload", icon: "sk_reload", color: 0x7ad651, text: () => "Reload 20% faster" },
  { id: "damage", name: "Hollow Points", icon: "sk_damage", color: 0xff8a3a, text: () => "+30% gun damage" },
  { id: "firerate", name: "Hair Trigger", icon: "sk_firerate", color: 0xffe066, text: () => "Shoot 15% faster" },
  { id: "range", name: "Long Barrel", icon: "sk_range", color: 0x5ac8ff, text: () => "+20% shooting distance" },
  { id: "boom", name: "Boom Rounds", icon: "sk_boom", color: 0xff5a4a, text: (l) => (l === 0 ? "Bullets explode on hit" : "Bigger, stronger blasts") },
  { id: "speed", name: "Swift Boots", icon: "icon_boot", color: 0x4fd0b0, text: () => "+12% move speed" },
  { id: "magnet", name: "Magnet", icon: "pk_magnet", color: 0x8a9aff, text: () => "Grab bones and meat from 50% farther" },
  { id: "mend", name: "Crystal Mend", icon: "sk_mend", color: 0x67c3ff, text: () => "Crystal heals 35% and slowly regrows" },
  { id: "luck", name: "Lucky Drops", icon: "sk_luck", color: 0x3fd08a, text: () => "Better guns in airdrops, and more often" },
  { id: "tough", name: "Thick Cardboard", icon: "pk_heart", color: 0xff6a8a, text: () => "+25% max health, heal 30%" },
  { id: "link", name: "Crystal Link", icon: "sk_link", color: 0xb98aff, text: (l) => (l === 0 ? "A beam from the crystal to you burns monsters" : "Hotter, wider beam") },
  { id: "fort", name: "Box Fort", icon: "sk_fort", color: 0xc8935a, text: () => "Stand still: take 12% less damage, shoot 10% faster" },
  { id: "pack", name: "Pack Leader", icon: "icon_paw", color: 0xffa64d, text: () => "Pets attack 20% faster and harder" },
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;

/** Three different skills to offer (only ones not maxed yet). */
export function skillChoices(levels: Partial<Record<SkillId, number>>, n = 3): SkillId[] {
  const open = SKILLS.filter((s) => (levels[s.id] ?? 0) < MAX_SKILL).map((s) => s.id);
  for (let i = open.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [open[i], open[j]] = [open[j], open[i]];
  }
  return open.slice(0, n);
}
