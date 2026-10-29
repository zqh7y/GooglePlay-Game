import { Ctx, darken, lighten, linear, mix, radial, rgba } from "./draw";

/**
 * Drawing kit for the chunky cartoon style (pets, hero, monsters): shapes made of joined
 * sub-paths get one clean outline, a soft shadow side and a lit side.
 *
 * In `pro` mode (monsters and bosses) every part is painted like a lit 3D form: a gradient body,
 * a soft key light from the top left, a core shadow bottom right, bounce light along the bottom,
 * a rim highlight, darker soft edges and a fine skin texture.
 */
export interface Toon {
  ctx: Ctx;
  pro: boolean;
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

/** A tiny repeatable random (so a texture always draws the same). */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function toon(ctx: Ctx, ol: string, lw = 6, pro = false): Toon {
  // the box around what a path() call drew (for gradients in pro mode)
  const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (x0: number, y0: number, x1: number, y1: number) => {
    bb.x0 = Math.min(bb.x0, x0);
    bb.y0 = Math.min(bb.y0, y0);
    bb.x1 = Math.max(bb.x1, x1);
    bb.y1 = Math.max(bb.y1, y1);
  };
  const E = (x: number, y: number, rx: number, ry: number, rot = 0) => {
    grow(x - Math.max(rx, ry), y - Math.max(rx, ry), x + Math.max(rx, ry), y + Math.max(rx, ry));
    ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  };
  const poly = (pts: [number, number][], r = 6) => {
    for (const [x, y] of pts) grow(x, y, x, y);
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
  const flatPart = (path: () => void, color: number, deco: (() => void) | undefined, w: number) => {
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
  };

  // ── pro mode works on masks: the true outline of a part, even when it is made of many overlapping pieces
  const PATH_CALLS = ["moveTo", "lineTo", "arc", "arcTo", "ellipse", "quadraticCurveTo", "bezierCurveTo", "closePath", "rect"] as const;
  const pool: HTMLCanvasElement[] = [];
  const layer = (i: number): CanvasRenderingContext2D => {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    let cv = pool[i];
    if (!cv) cv = pool[i] = document.createElement("canvas");
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    const l = cv.getContext("2d")!;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = "source-over";
    l.filter = "none";
    l.globalAlpha = 1;
    l.clearRect(0, 0, W, H);
    return l;
  };
  /** The part's silhouette, white on clear, drawn by replaying path() onto a side canvas. */
  const capture = (path: () => void): HTMLCanvasElement => {
    const m = layer(0);
    m.setTransform(ctx.getTransform());
    const hook = ctx as unknown as Record<string, unknown>;
    for (const n of PATH_CALLS) hook[n] = (...a: unknown[]) => (m[n] as (...b: unknown[]) => void)(...a);
    m.beginPath();
    try {
      path();
    } finally {
      for (const n of PATH_CALLS) delete hook[n];
    }
    m.fillStyle = "#ffffff";
    m.fill();
    return m.canvas;
  };
  /** Paint a colour over the band where the silhouette and a shifted (and softened) copy differ. */
  const band = (mask: HTMLCanvasElement, slot: number, style: string, dx: number, dy: number, soft: number, inner: boolean) => {
    const l = layer(slot);
    l.fillStyle = style;
    l.fillRect(0, 0, l.canvas.width, l.canvas.height);
    l.globalCompositeOperation = "destination-out";
    l.filter = soft > 0 ? `blur(${soft}px)` : "none";
    l.drawImage(mask, dx, dy);
    l.filter = "none";
    l.globalCompositeOperation = "destination-in";
    l.drawImage(mask, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (inner) ctx.globalCompositeOperation = "source-atop";
    ctx.drawImage(l.canvas, 0, 0);
    ctx.restore();
  };

  const proPart = (path: () => void, color: number, deco: (() => void) | undefined, w: number) => {
    bb.x0 = bb.y0 = Infinity;
    bb.x1 = bb.y1 = -Infinity;
    ctx.beginPath();
    path();
    if (!isFinite(bb.x0)) {
      bb.x0 = 0;
      bb.y0 = 0;
      bb.x1 = ctx.canvas.width;
      bb.y1 = ctx.canvas.height;
    }
    const bw = Math.max(8, bb.x1 - bb.x0);
    const bh = Math.max(8, bb.y1 - bb.y0);
    const cx = (bb.x0 + bb.x1) / 2;
    const cy = (bb.y0 + bb.y1) / 2;
    const big = Math.max(bw, bh);
    // outline, then a body that runs light (top) to deep (bottom)
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = w * 2;
    ctx.strokeStyle = ol;
    ctx.stroke();
    ctx.fillStyle = linear(ctx, 0, bb.y0, 0, bb.y1, [[0, rgba(lighten(color, 0.2))], [0.5, rgba(color)], [1, rgba(darken(color, 0.3))]]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    // core shadow on the bottom-right side
    ctx.fillStyle = radial(ctx, cx + bw * 0.42, cy + bh * 0.5, big * 0.8, [[0, rgba(darken(color, 0.55), 0.45)], [0.6, rgba(darken(color, 0.5), 0.12)], [1, rgba(darken(color, 0.5), 0)]]);
    ctx.fillRect(bb.x0 - 4, bb.y0 - 4, bw + 8, bh + 8);
    // key light from the top left
    ctx.fillStyle = radial(ctx, cx - bw * 0.22, cy - bh * 0.28, big * 0.62, [[0, "rgba(255,255,255,0.32)"], [0.55, "rgba(255,255,255,0.08)"], [1, "rgba(255,255,255,0)"]]);
    ctx.fillRect(bb.x0 - 4, bb.y0 - 4, bw + 8, bh + 8);
    // fine skin texture: freckles of light and shade
    const r = rng(color + Math.round(bw * 7 + bh));
    const n = Math.min(70, Math.round((bw * bh) / 380));
    for (let i = 0; i < n; i++) {
      const x = bb.x0 + r() * bw;
      const y = bb.y0 + r() * bh;
      ctx.fillStyle = i % 2 ? rgba(lighten(color, 0.5), 0.12) : rgba(darken(color, 0.5), 0.1);
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + r() * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // edge light and shade from the real silhouette (device pixels)
    const k = Math.abs(ctx.getTransform().a) || 1;
    const mask = capture(path);
    // soft darker edges all round (the form turning away)
    band(mask, 1, rgba(darken(color, 0.5), 0.3), 0, 0, Math.max(3, big * 0.06 * k), true);
    // warm bounce light along the bottom
    band(mask, 1, rgba(mix(lighten(color, 0.35), 0xfff2d8, 0.4), 0.42), 0, -Math.max(3, bh * 0.045 * k), 1.5, true);
    // rim light along the top-left edge
    band(mask, 1, rgba(lighten(color, 0.62), 0.6), Math.max(2.5, bw * 0.032 * k), Math.max(3, bh * 0.04 * k), 1, true);
    if (deco) {
      ctx.save();
      ctx.beginPath();
      path();
      ctx.clip();
      deco();
      ctx.restore();
    }
  };

  return {
    ctx,
    pro,
    E,
    C: (x, y, r) => E(x, y, r, r),
    poly,
    rect: (x, y, w, h, r) => poly([[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]], r),
    part(path, color, deco, w = lw) {
      (pro ? proPart : flatPart)(path, color, deco, w);
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
      if (pro) {
        // a lit stripe along the tube
        ctx.lineWidth = Math.max(2, w * 0.3);
        ctx.strokeStyle = rgba(lighten(color, 0.4), 0.55);
        ctx.save();
        ctx.translate(-w * 0.15, -w * 0.18);
        ctx.beginPath();
        path();
        ctx.stroke();
        ctx.restore();
      }
    },
    paint,
    gloss: (x, y, rx, ry, rot = -0.5) => {
      if (!pro) return paint("rgba(255,255,255,0.4)", () => E(x, y, rx, ry, rot));
      // a soft specular: bright core fading out, plus a tiny sharp glint
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(1, ry / rx);
      ctx.fillStyle = radial(ctx, 0, 0, rx, [[0, "rgba(255,255,255,0.75)"], [0.5, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,0)"]]);
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      paint("rgba(255,255,255,0.95)", () => E(x - rx * 0.25, y - ry * 0.1, Math.max(1.5, rx * 0.22), Math.max(1.2, ry * 0.3), rot));
    },
  };
}
