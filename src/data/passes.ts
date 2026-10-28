/**
 * Gamepasses: bought once, kept forever. For now they cost gems (real money in the finished game).
 */
export type PassId = "vip" | "luck" | "drops" | "fish" | "gems" | "super";

export interface PassDef {
  id: PassId;
  name: string;
  desc: string;
  icon: string;
  gems: number;
  /** the card's colour */
  color: "gold" | "pink" | "red" | "purple" | "blue" | "green";
}

export const PASSES: PassDef[] = [
  { id: "vip", name: "VIP!", desc: "+25% money from everything, forever", icon: "pass_vip", gems: 2400, color: "gold" },
  { id: "luck", name: "Magic Dice!", desc: "+50% luck on every roll", icon: "die_E", gems: 3600, color: "pink" },
  { id: "drops", name: "Super Drops!", desc: "Every die you find in battle counts twice", icon: "icon_gift", gems: 3000, color: "red" },
  { id: "super", name: "Super Roller!", desc: "A SUPER ROLL every 30 rolls instead of 50", icon: "icon_star", gems: 2700, color: "purple" },
  { id: "fish", name: "Fast Fisher!", desc: "Your line catches twice as fast", icon: "fu_speed", gems: 2100, color: "blue" },
  { id: "gems", name: "Gem Hunter!", desc: "Bosses give double gems", icon: "icon_gem", gems: 2700, color: "green" },
];
