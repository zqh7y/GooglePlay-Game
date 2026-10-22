import Phaser from "phaser";
import { ItemKey, VARIANT_INFO, parseKey } from "../data/items";
import { RARITY_INFO, rainbowColor } from "../data/rarity";

export const FONT = "'Trebuchet MS', 'Arial Rounded MT Bold', Arial, sans-serif";

export function text(
  scene: Phaser.Scene, x: number, y: number, str: string, size = 32, color = "#ffffff",
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, str, {
      fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: "bold",
      stroke: "#000000", strokeThickness: Math.max(2, size / 8), align: "center",
    })
    .setOrigin(0.5);
}

export interface Button extends Phaser.GameObjects.Container {
  label: Phaser.GameObjects.Text;
  bg: Phaser.GameObjects.Rectangle;
  setEnabled(on: boolean): Button;
}

/** Chunky mobile-style button with a press animation. */
export function button(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  str: string, color: number, onClick: () => void, size = 34,
): Button {
  const shadow = scene.add.rectangle(0, 6, w, h, 0x000000, 0.35).setOrigin(0.5);
  const bg = scene.add.rectangle(0, 0, w, h, color).setStrokeStyle(4, 0x000000, 0.4);
  const label = text(scene, 0, 0, str, size);
  const c = scene.add.container(x, y, [shadow, bg, label]) as Button;
  c.label = label;
  c.bg = bg;
  c.setSize(w, h);
  let enabled = true;
  c.setEnabled = (on: boolean) => {
    enabled = on;
    c.setAlpha(on ? 1 : 0.45);
    return c;
  };
  // The container itself is the hit area so buttons also work when fixed to a moving camera.
  c.setInteractive({ useHandCursor: true })
    .on("pointerdown", () => {
      if (!enabled) return;
      scene.tweens.add({ targets: c, scale: 0.92, duration: 60, yoyo: true });
    })
    .on("pointerup", () => {
      if (enabled) onClick();
    });
  return c;
}

/** A card showing an owned item. Rainbow/secret borders animate via `updateRainbow`. */
export function itemCard(
  scene: Phaser.Scene, x: number, y: number, key: ItemKey, count: number | null, w = 150, h = 190,
): Phaser.GameObjects.Container {
  const { def, variant } = parseKey(key);
  const rarity = RARITY_INFO[def.rarity];
  const border = variant === "golden" ? 0xffd700 : rarity.color;

  const bg = scene.add.rectangle(0, 0, w, h, 0x1e2140).setStrokeStyle(6, border);
  const glow = scene.add.rectangle(0, -h / 2 + 18, w - 12, 30, rarity.color, 0.25);
  const rarityText = text(scene, 0, -h / 2 + 18, rarity.label, 18, rarity.css);
  const icon = scene.add.image(0, -8, def.sprite).setTint(variant === "golden" ? 0xffd700 : def.color).setScale(1.25);
  const name = text(scene, 0, h / 2 - 42, VARIANT_INFO[variant].label + def.name, 17)
    .setWordWrapWidth(w - 10);
  const parts: Phaser.GameObjects.GameObject[] = [bg, glow, rarityText, icon, name];
  if (count !== null) {
    parts.push(text(scene, w / 2 - 22, -h / 2 + 50, `x${count}`, 20, "#fde68a"));
  }
  if (variant === "golden") {
    parts.push(text(scene, -w / 2 + 22, -h / 2 + 50, "★", 26, "#ffd700"));
  }
  const c = scene.add.container(x, y, parts);
  c.setSize(w, h);
  if (variant === "rainbow" || def.rarity === "secret") {
    c.setData("rainbow", { bg, rarityText, icon: variant === "rainbow" ? icon : null });
  }
  return c;
}

/** Call from a scene's update() to animate rainbow borders. */
export function updateRainbow(containers: Phaser.GameObjects.Container[], time: number): void {
  for (const c of containers) {
    const r = c.active && c.getData("rainbow");
    if (!r) continue;
    const col = rainbowColor(time, c.x / 700);
    r.bg.setStrokeStyle(6, col);
    r.rarityText.setColor("#" + col.toString(16).padStart(6, "0"));
    r.icon?.setTint(col);
  }
}

export function coinLabel(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, "", {
      fontFamily: FONT, fontSize: "34px", color: "#fde047", fontStyle: "bold",
      stroke: "#000", strokeThickness: 5,
    })
    .setOrigin(1, 0.5);
}
