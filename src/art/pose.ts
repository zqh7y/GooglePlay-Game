import type { Ctx } from "./draw";

/**
 * Walk poses for monsters and bosses. A painter draws its legs, arms (or wings), head and tail
 * through these helpers; each animation frame is the same painter drawn with a different pose:
 * legs step (one lifts while the other plants), arms swing or wings flap, the head bobs.
 */
export interface Pose {
  /** -1..1: which leg is lifted (and how far) */
  leg: number;
  /** -1..1: arm swing / wing flap */
  arm: number;
  /** -1..1: head bob (positive = down) */
  head: number;
}

export const pose: Pose = { leg: 0, arm: 0, head: 0 };

/** The walk cycle: frames A, B, C, B (B is the passing pose). */
export const WALK_POSES: Pose[] = [
  { leg: 1, arm: 1, head: 1 },
  { leg: 0, arm: 0, head: -1 },
  { leg: -1, arm: -1, head: 1 },
];
export const WALK_KEYS = ["_a", "_b", "_c", "_b"];

/** Draw with a pose, then go back to neutral. */
export function withPose(p: Pose, draw: () => void): void {
  Object.assign(pose, p);
  try {
    draw();
  } finally {
    Object.assign(pose, { leg: 0, arm: 0, head: 0 });
  }
}

/** Draw `fn` twice, once for each side of x = cx (clipped), so each side can move on its own. */
function halves(ctx: Ctx, cx: number, fn: (d: number) => void): void {
  const W = ctx.canvas.width * 4;
  const H = ctx.canvas.height * 4;
  for (const d of [-1, 1]) {
    ctx.save();
    ctx.beginPath();
    if (d < 0) ctx.rect(-W, -H, W + cx, H * 2);
    else ctx.rect(cx, -H, W, H * 2);
    ctx.clip();
    fn(d);
    ctx.restore();
  }
}

/** Legs: the side whose turn it is lifts and steps forward. */
export function legs(ctx: Ctx, cx: number, fn: () => void, lift = 10): void {
  if (!pose.leg) return fn();
  halves(ctx, cx, (d) => {
    const k = pose.leg * d;
    ctx.translate(k * lift * 0.4, -Math.max(0, k) * lift);
    fn();
  });
}

/**
 * Arms (each side turns round its shoulder at cx ± dx, y). `flap`: both sides move together, like
 * wings; otherwise they swing in turn.
 */
export function arms(ctx: Ctx, cx: number, dx: number, y: number, amp: number, fn: () => void, flap = false): void {
  if (!pose.arm) return fn();
  halves(ctx, cx, (d) => {
    const x = cx + d * dx;
    const a = flap ? -d * pose.arm * amp : pose.arm * amp;
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.translate(-x, -y);
    fn();
  });
}

/** The head (or anything that bobs): down a little and a slight tilt, round (x, y). */
export function head(ctx: Ctx, x: number, y: number, fn: () => void, bob = 4, tilt = 0.04): void {
  ctx.save();
  ctx.translate(x, y + pose.head * bob);
  ctx.rotate(pose.head * tilt);
  ctx.translate(-x, -y);
  fn();
  ctx.restore();
}

/** A tail, a pincer, a sceptre: swings round (x, y) with the arms. */
export function sway(ctx: Ctx, x: number, y: number, amp: number, fn: () => void): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(pose.arm * amp);
  ctx.translate(-x, -y);
  fn();
  ctx.restore();
}

/** A blob with no legs: squashes down and stretches up, standing on (x, y). */
export function squash(ctx: Ctx, x: number, y: number, fn: () => void, k = 0.06): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 + pose.head * k, 1 - pose.head * k);
  ctx.translate(-x, -y);
  fn();
  ctx.restore();
}
