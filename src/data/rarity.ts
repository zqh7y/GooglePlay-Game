import Phaser from "phaser";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythical" | "secret";

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythical", "secret"];

export const RARITY_INFO: Record<Rarity, { label: string; color: number; css: string }> = {
  common: { label: "Common", color: 0x9aa7c2, css: "#c9d2e6" },
  uncommon: { label: "Uncommon", color: 0x4fcf4a, css: "#7dec6a" },
  rare: { label: "Rare", color: 0x3a9bff, css: "#6cc0ff" },
  epic: { label: "Epic", color: 0xae5cff, css: "#d39bff" },
  legendary: { label: "Legendary", color: 0xffad1f, css: "#ffd04d" },
  mythical: { label: "Mythical", color: 0xff4f9a, css: "#ff8ac4" },
  secret: { label: "Secret", color: 0xffffff, css: "#ffffff" },
};

export function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

/** Rainbow colour that cycles over time — used for Secret rarity and Rainbow variants. */
export function rainbowColor(time: number, offset = 0): number {
  const hue = ((time / 1500 + offset) % 1 + 1) % 1;
  return Phaser.Display.Color.HSVToRGB(hue, 0.6, 1).color as number;
}
