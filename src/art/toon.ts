import { Ctx, rgba, darken } from "./draw";

/**
 * Drawing kit for the chunky cartoon style (pets, hero, monsters): shapes made of joined
 * sub-paths get one clean outline, a soft shadow side and a lit side.
 */
export interface Toon {
  ctx: Ctx;
  /** ellipse sub-path */
  E(x: number, y: number, rx: number, ry: number, rot?: number): void;
  C(x: number, y: number, r: number): void;
  /** rounded polygon sub-path (wound like ellipses so unions fill solid) */
  poly(pts: [number, number][], r?: number): void;
  /** rounded rectangle sub-path, centred */
  rect(x: number, y: number, w: number, h: number, r: number): void;
  /** outlined + shaded shape */
  part(path: () => void, color: number, deco?: () => void, lw?: number): void;
  /** outlined thick stroke */
  tube(path: () => void, w: number, color: number): void;
  paint(color: string | CanvasGradient, path: () => void): void;
  gloss(x: number, y: number, rx: number, ry: number, rot?: number): void;
}

export function toon(ctx: Ctx, ol: string, lw = 6): Toon {
  const E = (x: number, y: number, rx: number, ry: number, rot = 0) => {
    ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  };
  const poly = (pts: [number, number][], r = 6) => {
    let area = 0;
    pts.forEach(([x, y], i) => {
      const [nx, ny] = pts[(i + 1) % pts.length];
      area += x * ny - nx * y;
    });
    const p = area < 0 ? [...pts].reverse() : pts;
    const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const start = mid(p[p.length - 1], p[0]);
    ctx.moveTo(start[0], start[1]);
    p.forEach((pt, i) => ctx.arcTo(pt[0], pt[1], ...mid(pt, p[(i + 1) % p.length]), r));
    ctx.closePath();
  };
  const paint = (color: string | CanvasGradient, path: () => void) => {
    ctx.beginPath();
    path();
    ctx.fillStyle = color;
    ctx.fill();
  };
  return {
    ctx,
    E,
    C: (x, y, r) => E(x, y, r, r),
    poly,
    rect: (x, y, w, h, r) => poly([[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]], r),
    part(path, color, deco, w = lw) {
      ctx.beginPath();
      path();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = w * 2;
      ctx.strokeStyle = ol;
      ctx.stroke();
      ctx.fillStyle = rgba(darken(color, 0.16));
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.translate(-3, -5);
      ctx.beginPath();
      path();
      ctx.fillStyle = rgba(color);
      ctx.fill();
      ctx.translate(3, 5);
      deco?.();
      ctx.restore();
    },
    tube(path, w, color) {
      ctx.beginPath();
      path();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = w + lw * 2;
      ctx.strokeStyle = ol;
      ctx.stroke();
      ctx.lineWidth = w;
      ctx.strokeStyle = rgba(color);
      ctx.stroke();
    },
    paint,
    gloss: (x, y, rx, ry, rot = -0.5) => paint("rgba(255,255,255,0.4)", () => E(x, y, rx, ry, rot)),
  };
}
