import Phaser from "phaser";

/** Low-level canvas helpers shared by all the procedural art. */
export type Ctx = CanvasRenderingContext2D;
export type Paint = string | CanvasGradient;

/** The warm dark-brown outline used on every character and UI element. */
export const INK = "#4a2f1d";
export const INK_N = 0x4a2f1d;

export function rgba(c: number, a = 1): string {
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
}

export function hexToNum(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
export const lighten = (c: number, t: number) => mix(c, 0xffffff, t);
export const darken = (c: number, t: number) => mix(c, 0x000000, t);

/** Rounded-rectangle path (not filled). */
export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

export function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

export function linear(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

export function radial(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][], x0 = x, y0 = y, r0 = 0): CanvasGradient {
  const g = ctx.createRadialGradient(x0, y0, r0, x, y, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

export function outline(ctx: Ctx, width = 5, color = INK): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

export function fill(ctx: Ctx, style: Paint): void {
  ctx.fillStyle = style;
  ctx.fill();
}

/** Fill the current path, then outline it. */
export function fillOutline(ctx: Ctx, style: Paint, width = 5): void {
  fill(ctx, style);
  outline(ctx, width);
}

/**
 * Flat 2D cel-shaded shape: dark colour, then the base colour shifted up-left
 * (leaving a shadow crescent bottom-right), optional decoration, then the outline.
 */
export function celShape(ctx: Ctx, path: () => void, base: Paint, dark: Paint, r: number, deco?: () => void, width = 5): void {
  path();
  fill(ctx, dark);
  ctx.save();
  path();
  ctx.clip();
  ctx.save();
  ctx.translate(-r * 0.1, -r * 0.14);
  path();
  fill(ctx, base);
  ctx.restore();
  deco?.();
  ctx.restore();
  path();
  outline(ctx, width);
}

/** A thick outlined stroke (tails, stems, antennae). */
export function strokeShape(ctx: Ctx, path: () => void, width: number, paint: Paint): void {
  path();
  outline(ctx, width + 9);
  path();
  ctx.lineWidth = width;
  ctx.strokeStyle = paint;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

/** Four-pointed twinkle star. */
export function twinkle(ctx: Ctx, x: number, y: number, r: number, color = "#ffffff"): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  fill(ctx, color);
}

export function starPath(ctx: Ctx, x: number, y: number, r: number, inner = 0.45, points = 5, rot = -Math.PI / 2): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = rot + (i * Math.PI) / points;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function boltPath(ctx: Ctx, x: number, y: number, s: number): void {
  const pts = [[0.15, -1], [-0.55, 0.12], [-0.05, 0.12], [-0.3, 1], [0.6, -0.25], [0.08, -0.25], [0.45, -1]];
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * s, y + py * s) : ctx.moveTo(x + px * s, y + py * s)));
  ctx.closePath();
}

export const RAINBOW = ["#ff6b81", "#ffb347", "#fff35c", "#6ff08a", "#5ac8ff", "#b98aff"];

export function rainbowGradient(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, dark = 0): CanvasGradient {
  return linear(ctx, x0, y0, x1, y1, RAINBOW.map((c, i) => [i / (RAINBOW.length - 1), dark ? rgba(darken(hexToNum(c), dark)) : c]));
}

/** Create (once) a canvas texture of the given size and draw into it. Returns the key. */
export function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h));
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.save();
  draw(ctx);
  ctx.restore();
  tex.refresh();
  return key;
}
