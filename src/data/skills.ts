/**
 * Skills you pick during a stage (Survivor.io style). Each levels up to MAX_SKILL and they all
 * reset when the stage ends, so every run builds up again from nothing.
 */
export type SkillId =
  | "power" | "rapid" | "multi" | "orbit" | "lightning" | "aura" | "rocket" | "boots" | "magnet" | "vitality" | "guard" | "fury";

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  /** badge colour */
  color: number;
  /** what the next level does */
  text: (level: number) => string;
}

export const MAX_SKILL = 5;

export const SKILLS: SkillDef[] = [
  { id: "power", name: "Power Shot", icon: "sk_power", color: 0xff8a3a, text: () => "+35% shot damage" },
  { id: "rapid", name: "Rapid Fire", icon: "sk_rapid", color: 0xffc93a, text: () => "Shoot 25% faster" },
  { id: "multi", name: "Multi Shot", icon: "sk_multi", color: 0x7ad651, text: () => "+1 bullet per shot" },
  { id: "orbit", name: "Orbit Blades", icon: "sk_orbit", color: 0x5ac8ff, text: (l) => (l === 0 ? "2 blades spin around you" : "+1 blade, spins faster") },
  { id: "lightning", name: "Lightning", icon: "sk_lightning", color: 0xb98aff, text: (l) => (l === 0 ? "Zap 2 monsters every 2s" : "+1 zap, more damage") },
  { id: "aura", name: "Fire Aura", icon: "sk_aura", color: 0xff5a4a, text: (l) => (l === 0 ? "Burn monsters close to you" : "Bigger, hotter flames") },
  { id: "rocket", name: "Rockets", icon: "sk_rocket", color: 0xef6a8a, text: (l) => (l === 0 ? "Fire a rocket every 2.5s" : "+1 rocket, bigger blast") },
  { id: "boots", name: "Swift Boots", icon: "icon_boot", color: 0x4fd0b0, text: () => "+12% move speed" },
  { id: "magnet", name: "Magnet", icon: "pk_magnet", color: 0x8a9aff, text: () => "Pick things up from 50% farther" },
  { id: "vitality", name: "Vitality", icon: "pk_heart", color: 0xff6a8a, text: () => "+25% max health, heal 30%" },
  { id: "guard", name: "Crystal Guard", icon: "icon_shield", color: 0x67c3ff, text: (l) => (l === 0 ? "Crystal zaps nearby monsters, heals 25%" : "Crystal zaps harder, heals 25%") },
  { id: "fury", name: "Pet Fury", icon: "icon_paw", color: 0xffa64d, text: () => "Pets attack 20% faster and harder" },
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
