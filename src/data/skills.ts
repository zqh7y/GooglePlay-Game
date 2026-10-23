/**
 * Skills you pick during a stage. Each levels up to MAX_SKILL and they all reset when the
 * stage ends, so every run builds up again from nothing.
 */
export type SkillId =
  | "mag" | "reload" | "damage" | "firerate" | "range" | "boom" | "speed" | "magnet" | "mend" | "luck" | "tough" | "shards" | "fort" | "pack";

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
/** You can carry at most this many different skills in one stage. */
export const SKILL_SLOTS = 4;

export const SKILLS: SkillDef[] = [
  { id: "mag", name: "Multi-Throw", icon: "sk_mag", color: 0xffc93a, text: (l) => (l % 2 === 0 ? "Every gadget throws one more" : "+15% gadget damage") },
  { id: "reload", name: "Bigger Booms", icon: "sk_reload", color: 0x7ad651, text: () => "+25% explosion size (rockets, mines, bombs, grenades)" },
  { id: "damage", name: "Power Up", icon: "sk_damage", color: 0xff8a3a, text: () => "+30% gadget damage" },
  { id: "firerate", name: "Overclock", icon: "sk_firerate", color: 0xffe066, text: () => "Gadgets fire 15% faster" },
  { id: "range", name: "Long Reach", icon: "sk_range", color: 0x5ac8ff, text: () => "+20% gadget reach" },
  { id: "boom", name: "Boom Throws", icon: "sk_boom", color: 0xff5a4a, text: (l) => (l === 0 ? "Shuriken and balls explode on hit" : "Bigger, stronger blasts") },
  { id: "speed", name: "Swift Boots", icon: "icon_boot", color: 0x4fd0b0, text: () => "+12% move speed" },
  { id: "magnet", name: "Magnet", icon: "pk_magnet", color: 0x8a9aff, text: () => "Grab bones and meat from 50% farther" },
  { id: "mend", name: "Crystal Mend", icon: "sk_mend", color: 0x67c3ff, text: () => "Crystal heals 35% and slowly regrows" },
  { id: "luck", name: "Lucky Drops", icon: "sk_luck", color: 0x3fd08a, text: () => "Better gadgets in airdrops, and more often" },
  { id: "tough", name: "Thick Cardboard", icon: "pk_heart", color: 0xff6a8a, text: () => "+25% max health, heal 30%" },
  { id: "shards", name: "Crystal Shards", icon: "sk_shards", color: 0xb98aff, text: (l) => (l === 0 ? "The crystal shoots shards at monsters around it" : "More shards, more damage") },
  { id: "fort", name: "Box Fort", icon: "sk_fort", color: 0xc8935a, text: () => "Stand still: take 12% less damage, gadgets 10% faster" },
  { id: "pack", name: "Pack Leader", icon: "icon_paw", color: 0xffa64d, text: () => "Pets attack 20% faster and harder" },
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;

/** Three different skills to offer: ones not maxed yet, and new ones only while a slot is free. */
export function skillChoices(levels: Partial<Record<SkillId, number>>, n = 3): SkillId[] {
  const owned = Object.keys(levels).length;
  const open = SKILLS.filter((s) => {
    const lv = levels[s.id] ?? 0;
    return lv < MAX_SKILL && (lv > 0 || owned < SKILL_SLOTS);
  }).map((s) => s.id);
  for (let i = open.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [open[i], open[j]] = [open[j], open[i]];
  }
  return open.slice(0, n);
}
