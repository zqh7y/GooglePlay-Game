import Phaser from "phaser";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythical" | "secret";

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythical", "secret"];

export const RARITY_INFO: Record<Rarity, { label: string; color: number; css: string }> = {
  common: { label: "Common", color: 0xb0b8c4, css: "#b0b8c4" },
  uncommon: { label: "Uncommon", color: 0x4ade80, css: "#4ade80" },
  rare: { label: "Rare", color: 0x60a5fa, css: "#60a5fa" },
  epic: { label: "Epic", color: 0xc084fc, css: "#c084fc" },
  legendary: { label: "Legendary", color: 0xfbbf24, css: "#fbbf24" },
  mythical: { label: "Mythical", color: 0xf472b6, css: "#f472b6" },
  secret: { label: "SECRET", color: 0xffffff, css: "#ffffff" },
};

export function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

/** Rainbow color that cycles over time — used for Secret rarity and Rainbow variants. */
export function rainbowColor(time: number, offset = 0): number {
  const hue = ((time / 1500 + offset) % 1 + 1) % 1;
  return Phaser.Display.Color.HSVToRGB(hue, 0.6, 1).color as number;
}
