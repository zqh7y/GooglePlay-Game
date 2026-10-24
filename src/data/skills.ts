/**
 * Skills you pick during a stage: from skill orbs on the map, skill drops (airdrops) and orbs
 * that elites drop. Each levels up to MAX_SKILL and they all reset when the stage ends, so
 * every run builds up again from nothing. (Level-ups give gadgets.)
 */
export type SkillId =
  | "double" | "power" | "hyper" | "bigbang" | "chain" | "zoom" | "vacuum" | "mend" | "luck" | "tough" | "shards" | "fort" | "pack" | "haunt"
  | "snack" | "phase";

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  /** badge colour: red hits harder, yellow faster, blue keeps you alive, green helps, purple is spooky */
  color: number;
  /** what the next level does (level = current level, 0 if new) */
  text: (level: number) => string;
}

export const MAX_SKILL = 5;
/** You can carry at most this many different skills in one stage. */
export const SKILL_SLOTS = 4;

export const SKILLS: SkillDef[] = [
  { id: "double", name: "Double Trouble", icon: "sk_double", color: 0xffc93a, text: (l) => (l % 2 === 0 ? "Every gadget throws one more" : "+15% gadget damage") },
  { id: "power", name: "Sharp Corners", icon: "sk_power", color: 0xff6a4a, text: () => "+30% gadget damage" },
  { id: "hyper", name: "Hyper Hands", icon: "sk_hyper", color: 0xffe066, text: () => "Gadgets fire 15% faster" },
  { id: "bigbang", name: "Big Bang", icon: "sk_bigbang", color: 0xff8a3a, text: () => "+25% size for blasts, bubbles and glue" },
  { id: "chain", name: "Chain Reaction", icon: "sk_chain", color: 0xff4a6a, text: (l) => (l === 0 ? "Defeated monsters burst and hurt the ones around them" : "Bigger, stronger bursts") },
  { id: "haunt", name: "Spooky Aura", icon: "sk_haunt", color: 0xb98aff, text: (l) => (l === 0 ? "Monsters close to you get hurt and slowed" : "Wider and stronger aura") },
  { id: "phase", name: "Ghost Phase", icon: "sk_phase", color: 0x9a7aff, text: (l) => (l === 0 ? "Every 7s: turn see-through (no damage) and let out a shockwave" : "Phase 1s sooner, bigger shockwave") },
  { id: "snack", name: "Ghost Snacks", icon: "sk_snack", color: 0xff8ab0, text: () => "Every monster you defeat heals you a little" },
  { id: "tough", name: "Thick Cardboard", icon: "sk_tough", color: 0x5aa8ff, text: () => "+25% max health, heal 30%" },
  { id: "fort", name: "Box Fort", icon: "sk_fort", color: 0xc8935a, text: () => "Stand still: take 12% less damage, gadgets 10% faster" },
  { id: "zoom", name: "Zoomies", icon: "sk_zoom", color: 0x4fd0b0, text: () => "+12% move speed" },
  { id: "vacuum", name: "Ghost Vacuum", icon: "sk_vacuum", color: 0x8a9aff, text: () => "Grab bones and meat from 50% farther" },
  { id: "pack", name: "Pet Party", icon: "sk_pack", color: 0xffa64d, text: () => "Pets attack 20% faster and harder" },
  { id: "mend", name: "Crystal Glue", icon: "sk_mend", color: 0x67c3ff, text: () => "The crystal heals 35% right away (it never heals by itself)" },
  { id: "shards", name: "Crystal Shards", icon: "sk_shards", color: 0xd8a8ff, text: (l) => (l === 0 ? "The crystal shoots shards at monsters around it" : "More shards, more damage") },
  { id: "luck", name: "Lucky Box", icon: "sk_luck", color: 0x3fd08a, text: () => "Level-ups offer better gadget tiers, and skill drops come more often" },
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
