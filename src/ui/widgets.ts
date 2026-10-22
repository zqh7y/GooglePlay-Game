import Phaser from "phaser";
import { petKey } from "../art/characters";
import { INK_N } from "../art/draw";
import { BtnColor, CARD_H, CARD_W, btnEdge, btnTexture, panelTexture, pillTexture, ribbonTexture } from "../art/ui";
import { ITEMS, ItemKey, parseKey } from "../data/items";
import { RARITY_INFO } from "../data/rarity";

export const DISPLAY = "'Lilita One', 'Arial Black', sans-serif";
export const BODY = "'Fredoka', 'Trebuchet MS', sans-serif";
export const INK_CSS = "#26183f";

export interface TextOpts {
  font?: "display" | "body";
  stroke?: number | false;
  shadow?: boolean;
  wrap?: number;
  align?: "left" | "center" | "right";
  lineSpacing?: number;
}

/** Game-styled text: chunky display font with a dark outline and drop shadow. */
export function text(
  scene: Phaser.Scene, x: number, y: number, str: string, size: number, color = "#ffffff", opts: TextOpts = {},
): Phaser.GameObjects.Text {
  const display = (opts.font ?? "display") === "display";
  const stroke = opts.stroke === false ? 0 : opts.stroke ?? Math.max(3, Math.round(size * (display ? 0.17 : 0.13)));
  const t = scene.add
    .text(x, y, str, {
      fontFamily: display ? DISPLAY : BODY,
      fontSize: `${size}px`,
      fontStyle: display ? "normal" : "600",
      color,
      stroke: INK_CSS,
      strokeThickness: stroke,
      align: opts.align ?? "center",
      lineSpacing: opts.lineSpacing ?? 0,
      wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined,
      padding: { x: 3, y: 5 },
    })
    .setOrigin(0.5);
  if (opts.shadow !== false && stroke > 0) t.setShadow(0, Math.max(2, Math.round(size * 0.07)), "rgba(20,8,40,0.6)", 0, true, true);
  return t;
}

/** Shrink a text so it fits a width. */
export function fitText(t: Phaser.GameObjects.Text, maxW: number): Phaser.GameObjects.Text {
  t.setScale(1);
  if (t.width > maxW) t.setScale(maxW / t.width);
  return t;
}

export interface ButtonOpts {
  size?: number;
  icon?: string;
  iconSize?: number;
  /** icon above the label instead of beside it */
  stack?: boolean;
  /** small second line, e.g. a price */
  sub?: string;
  subIcon?: string;
}

/** Glossy 3D mobile-game button with press feedback. */
export class Button extends Phaser.GameObjects.Container {
  bg: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
  subText?: Phaser.GameObjects.Text;
  subIcon?: Phaser.GameObjects.Image;
  private enabled = true;
  private color: BtnColor;
  private readonly bw: number;
  private readonly bh: number;
  private readonly opts: ButtonOpts;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: BtnColor, str: string, onClick: () => void, opts: ButtonOpts = {}) {
    super(scene, x, y);
    this.color = color;
    this.bw = w;
    this.bh = h;
    this.opts = opts;
    this.bg = scene.add.image(0, 0, btnTexture(scene, color, w, h));
    this.label = text(scene, 0, 0, str, opts.size ?? Math.round(h * 0.36));
    this.add([this.bg, this.label]);
    if (opts.icon) {
      this.icon = scene.add.image(0, 0, opts.icon);
      this.icon.setScale((opts.iconSize ?? h * 0.5) / this.icon.width);
      this.add(this.icon);
    }
    if (opts.sub !== undefined) {
      this.subText = text(scene, 0, 0, opts.sub, Math.round((opts.size ?? h * 0.36) * 0.72));
      this.add(this.subText);
      if (opts.subIcon) {
        this.subIcon = scene.add.image(0, 0, opts.subIcon);
        this.subIcon.setScale((this.subText.height * 0.85) / this.subIcon.height);
        this.add(this.subIcon);
      }
    }
    this.layout();
    scene.add.existing(this);

    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    let pressed = false;
    this.on("pointerdown", () => {
      pressed = true;
      scene.tweens.add({ targets: this, scale: 0.93, duration: 70 });
    });
    this.on("pointerout", () => {
      pressed = false;
      scene.tweens.add({ targets: this, scale: 1, duration: 90 });
    });
    this.on("pointerup", () => {
      scene.tweens.add({ targets: this, scale: 1, duration: 120, ease: "Back.out" });
      if (pressed && this.enabled) onClick();
      pressed = false;
    });
  }

  private layout(): void {
    const faceY = -btnEdge(this.bh) / 2;
    const gap = 12;
    const { label, icon, subText, subIcon } = this;
    fitText(label, this.bw - 30 - (icon && !this.opts.stack ? icon.displayWidth + gap : 0));
    if (icon && this.opts.stack) {
      icon.setPosition(0, faceY - this.bh * 0.13);
      label.setPosition(0, faceY + this.bh * 0.25);
      return;
    }
    const mainY = subText ? faceY - this.bh * 0.14 : faceY;
    if (icon) {
      const total = icon.displayWidth + gap + label.displayWidth;
      icon.setPosition(-total / 2 + icon.displayWidth / 2, mainY);
      label.setPosition(-total / 2 + icon.displayWidth + gap + label.displayWidth / 2, mainY);
    } else {
      label.setPosition(0, mainY);
    }
    if (subText) {
      const subY = faceY + this.bh * 0.21;
      const iw = subIcon ? subIcon.displayWidth + 6 : 0;
      const total = iw + subText.displayWidth;
      subIcon?.setPosition(-total / 2 + iw / 2 - 3, subY);
      subText.setPosition(-total / 2 + iw + subText.displayWidth / 2, subY);
    }
  }

  setLabel(str: string): this {
    this.label.setText(str);
    this.layout();
    return this;
  }

  setSub(str: string): this {
    this.subText?.setText(str);
    this.layout();
    return this;
  }

  setColor(color: BtnColor): this {
    this.color = color;
    if (this.enabled) this.bg.setTexture(btnTexture(this.scene, color, this.bw, this.bh));
    return this;
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.bg.setTexture(btnTexture(this.scene, on ? this.color : "grey", this.bw, this.bh));
    this.label.setAlpha(on ? 1 : 0.75);
    this.icon?.setAlpha(on ? 1 : 0.7);
    return this;
  }
}

export function button(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: BtnColor, str: string, onClick: () => void, opts: ButtonOpts = {},
): Button {
  return new Button(scene, x, y, w, h, color, str, onClick, opts);
}

/** Small round icon-only button (e.g. the close X). */
export function iconButton(scene: Phaser.Scene, x: number, y: number, icon: string, size: number, onClick: () => void): Phaser.GameObjects.Image {
  const base = size / 96;
  const img = scene.add.image(x, y, icon).setScale(base).setInteractive({ useHandCursor: true });
  img.on("pointerdown", () => scene.tweens.add({ targets: img, scale: base * 0.88, duration: 70 }));
  img.on("pointerout", () => img.setScale(base));
  img.on("pointerup", () => {
    img.setScale(base);
    onClick();
  });
  return img;
}

// ───────────────────────── cards ─────────────────────────

export interface CardOpts {
  count?: number;
  equipped?: boolean;
  fuseReady?: boolean;
  oneIn?: string;
  isNew?: boolean;
}

/** A pet card with rarity frame, art, name and badges. Size CARD_W x CARD_H at scale 1. */
export function petCard(scene: Phaser.Scene, x: number, y: number, key: ItemKey, opts: CardOpts = {}): Phaser.GameObjects.Container {
  const { def, variant } = parseKey(key);
  const rarity = RARITY_INFO[def.rarity];
  const parts: Phaser.GameObjects.GameObject[] = [
    scene.add.image(0, 0, `card_${def.rarity}`),
    fitText(text(scene, 0, -CARD_H / 2 + 27, rarity.label.toUpperCase(), 24), CARD_W - 40),
    scene.add.image(0, 2, petKey(def.id, variant)).setScale(0.96),
    fitText(text(scene, 0, CARD_H / 2 - 25, def.name, 24), CARD_W - 40),
  ];
  if (variant !== "normal") {
    parts.push(text(scene, 0, CARD_H / 2 - 62, variant === "golden" ? "GOLDEN" : "RAINBOW", 22, variant === "golden" ? "#ffd84a" : "#ff9ae0"));
  }
  if (opts.oneIn) parts.push(text(scene, 0, CARD_H / 2 - 62, opts.oneIn, 20, "#ffe680"));
  if (opts.count !== undefined) {
    parts.push(scene.add.image(CARD_W / 2 - 34, -CARD_H / 2 + 70, "badge_count"));
    parts.push(fitText(text(scene, CARD_W / 2 - 34, -CARD_H / 2 + 69, `x${opts.count}`, 24, "#ffe680"), 60));
  }
  if (opts.equipped) parts.push(scene.add.image(-CARD_W / 2 + 32, -CARD_H / 2 + 70, "icon_check").setScale(0.5));
  const c = scene.add.container(x, y, parts);
  if (opts.fuseReady) {
    const f = scene.add.image(CARD_W / 2 - 30, CARD_H / 2 - 76, "icon_fuse").setScale(0.48);
    c.add(f);
    scene.tweens.add({ targets: f, y: f.y - 8, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  }
  if (opts.isNew) {
    const n = text(scene, CARD_W / 2 - 18, -CARD_H / 2 - 4, "NEW!", 30, "#5ff0ff").setAngle(14);
    c.add(n);
    scene.tweens.add({ targets: n, scale: 1.15, duration: 400, yoyo: true, repeat: -1 });
  }
  c.setSize(CARD_W, CARD_H);
  return c;
}

/** Card for a pet the player has never rolled. */
export function lockedCard(scene: Phaser.Scene, x: number, y: number, itemId: string): Phaser.GameObjects.Container {
  const def = ITEMS[itemId];
  const rarity = RARITY_INFO[def.rarity];
  return scene.add.container(x, y, [
    scene.add.image(0, 0, "card_locked"),
    text(scene, 0, -CARD_H / 2 + 27, rarity.label.toUpperCase(), 24, rarity.css),
    scene.add.image(0, 2, `pet_${itemId}_locked`).setScale(0.96).setAlpha(0.9),
    scene.add.image(0, 10, "icon_lock").setScale(0.6),
    text(scene, 0, CARD_H / 2 - 25, "???", 26, "#8a90c0"),
  ]).setSize(CARD_W, CARD_H);
}

// ───────────────────────── bars, pills, banners ─────────────────────────

/** Draw a chunky rounded progress bar into a Graphics object. */
export function drawBar(
  g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, color: number, track = 0x1a1640,
): void {
  const r = h / 2;
  g.fillStyle(INK_N, 1).fillRoundedRect(x - 4, y - 4, w + 8, h + 8, r + 4);
  g.fillStyle(track, 1).fillRoundedRect(x, y, w, h, r);
  const fw = Math.max(0, Math.min(1, frac)) * w;
  if (fw > 2) {
    g.fillStyle(color, 1).fillRoundedRect(x, y, Math.max(fw, h), h, r);
    g.fillStyle(0xffffff, 0.3).fillRoundedRect(x + 4, y + 3, Math.max(fw - 8, h - 8), h * 0.32, h * 0.16);
  }
}

/** Dark rounded pill with an icon on the left and a value — used for coins, DPS, luck... */
export class Pill extends Phaser.GameObjects.Container {
  value: Phaser.GameObjects.Text;
  icon: Phaser.GameObjects.Image;
  private readonly pw: number;
  private readonly iconScale: number;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, icon: string, size: number, color = "#ffffff") {
    super(scene, x, y);
    this.pw = w;
    const bg = scene.add.image(0, 0, pillTexture(scene, w, h));
    this.iconScale = (h * 1.1) / 96;
    this.icon = scene.add.image(-w / 2 + h * 0.45, 0, icon).setScale(this.iconScale);
    this.value = text(scene, 0, -2, "", size, color);
    this.add([bg, this.icon, this.value]);
    scene.add.existing(this);
  }

  setValue(str: string): this {
    if (this.value.text === str) return this;
    this.value.setText(str);
    const left = -this.pw / 2 + this.icon.displayWidth * 0.95;
    fitText(this.value, this.pw / 2 - left - 20);
    this.value.setX((left + this.pw / 2 - 16) / 2);
    return this;
  }

  bump(): void {
    this.scene.tweens.killTweensOf(this.icon);
    this.icon.setScale(this.iconScale);
    this.scene.tweens.add({ targets: this.icon, scale: this.iconScale * 1.25, duration: 80, yoyo: true });
  }
}

/** Pop-in ribbon banner ("WAVE 3", "STAGE 2!"). */
export function ribbonBanner(scene: Phaser.Scene, x: number, y: number, str: string, color: BtnColor, ms = 1000, depth = 3000): void {
  const w = 640;
  const h = 130;
  const c = scene.add.container(x, y, [
    scene.add.image(0, 0, ribbonTexture(scene, color, w, h)),
    fitText(text(scene, 0, -14, str, 58), w * 0.66),
  ]).setDepth(depth).setScale(0.3).setAlpha(0);
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 280, ease: "Back.out" });
  scene.tweens.add({ targets: c, alpha: 0, y: y - 40, delay: ms, duration: 350, onComplete: () => c.destroy() });
}

// ───────────────────────── modal ─────────────────────────

export interface Modal {
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  close: () => void;
}

/** Centered popup with dimmed background, title ribbon and close button. */
export function modal(scene: Phaser.Scene, w: number, h: number, title: string, color: BtnColor, onClose?: () => void): Modal {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const dim = scene.add.rectangle(0, 0, W, H, 0x0a0620, 0.72).setOrigin(0).setInteractive();
  const body = scene.add.container(W / 2, H / 2);
  body.add(scene.add.image(0, 0, panelTexture(scene, "modal", w, h)));
  const rw = Math.min(w - 40, 640);
  body.add(scene.add.container(0, -h / 2, [
    scene.add.image(0, 0, ribbonTexture(scene, color, rw, 120)),
    fitText(text(scene, 0, -12, title, 50), rw * 0.7),
  ]));
  const root = scene.add.container(0, 0, [dim, body]).setDepth(5000);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scene.tweens.add({ targets: body, scale: 0.85, alpha: 0, duration: 120, onComplete: () => root.destroy() });
    scene.tweens.add({ targets: dim, alpha: 0, duration: 120 });
    onClose?.();
  };
  body.add(iconButton(scene, w / 2 - 26, -h / 2 + 26, "icon_close", 88, close));
  body.setScale(0.8).setAlpha(0);
  dim.setAlpha(0);
  scene.tweens.add({ targets: body, scale: 1, alpha: 1, duration: 220, ease: "Back.out" });
  scene.tweens.add({ targets: dim, alpha: 0.72, duration: 160 });
  return { root, body, close };
}
