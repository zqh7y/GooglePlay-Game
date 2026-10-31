import Phaser from "phaser";
import { INK, Ctx, canvasTexture, rgba } from "./draw";
import { poly } from "./story";

/**
 * Quake island (stage 9): the volcano out at sea, the lava holes the island crumbles into (molten,
 * then cooled to a black crust), the glowing cracks that warn you first, and the mode's icon.
 */
export function makeQuakeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("quake_hole")) return;
  canvasTexture(scene, "volcano_pro", 1000, 780, (c) => volcanoPro(c));
  canvasTexture(scene, "quake_hole", HOLE, HOLE, (c) => hole(c, 11, true));
  canvasTexture(scene, "quake_hole2", HOLE, HOLE, (c) => hole(c, 37, true));
  canvasTexture(scene, "quake_crust", HOLE, HOLE, (c) => hole(c, 11, false));
  canvasTexture(scene, "quake_crack", HOLE, HOLE, (c) => cracks(c, 5));
  canvasTexture(scene, "quake_crack2", HOLE, HOLE, (c) => cracks(c, 19));
  // meteors: three shapes of round, lit, cratered rock glowing through its cracks
  canvasTexture(scene, "meteor_a", 260, 240, (c) => meteor(c, 3, 1, 1, 0.05));
  canvasTexture(scene, "meteor_b", 260, 240, (c) => meteor(c, 17, 0.95, 0.95, 0.16));
  canvasTexture(scene, "meteor_c", 260, 240, (c) => meteor(c, 29, 1.18, 0.78, 0.09));
  // the mode's icon: a smoking volcano over cracked ground with lava in the cracks
  canvasTexture(scene, "mode_quake", 128, 128, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 6;
    c.strokeStyle = INK;
    const bg = c.createLinearGradient(0, 8, 0, 120);
    bg.addColorStop(0, "#3a1a2a");
    bg.addColorStop(1, "#ff7a2a");
    c.fillStyle = bg;
    c.beginPath();
    c.arc(64, 64, 56, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.save();
    c.beginPath();
    c.arc(64, 64, 53, 0, Math.PI * 2);
    c.clip();
    // smoke, the cone and its glowing top
    for (const [x, y, r] of [[58, 22, 10], [70, 16, 12], [80, 8, 10]]) {
      c.fillStyle = "#6a5a5e";
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    poly(c, [[22, 84], [52, 34], [76, 34], [106, 84]], "#4a3036");
    poly(c, [[52, 34], [76, 34], [70, 46], [64, 40], [58, 48]], "#ffb02a");
    // the ground, split by a lava crack
    poly(c, [[6, 84], [122, 84], [122, 124], [6, 124]], "#7a5a3a");
    c.lineWidth = 9;
    c.strokeStyle = "#ff8a1a";
    c.beginPath();
    c.moveTo(30, 84);
    c.lineTo(48, 100);
    c.lineTo(40, 112);
    c.lineTo(62, 124);
    c.moveTo(48, 100);
    c.lineTo(76, 96);
    c.lineTo(92, 110);
    c.stroke();
    c.lineWidth = 3;
    c.strokeStyle = "#ffe880";
    c.stroke();
    c.restore();
  });
}

/** A lava hole fills one 400 px piece of the island, with a little to spare so neighbours join up. */
const HOLE = 440;

/** The edge of a hole: a rounded square with a rough, broken outline. */
function edge(seed: number, inset: number): [number, number][] {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pts: [number, number][] = [];
  const R = HOLE / 2 - 14 - inset;
  for (let i = 0; i < 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    const [co, si] = [Math.cos(t), Math.sin(t)];
    const k = R / Math.pow(Math.abs(co) ** 4 + Math.abs(si) ** 4, 0.25);
    const d = k * (0.93 + r() * 0.07);
    pts.push([HOLE / 2 + co * d, HOLE / 2 + si * d]);
  }
  return pts;
}

/** Molten (bright lava, floating bits of crust, a hot rim) or cooled (black crust, faint red seams). */
function hole(c: Ctx, seed: number, hot: boolean): void {
  const out = edge(seed, 0);
  const path = (pts: [number, number][]) => {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
  };
  const m = HOLE / 2;
  // the broken rock rim
  path(out);
  c.fillStyle = hot ? "#3a2018" : "#2a2226";
  c.fill();
  c.lineWidth = 8;
  c.strokeStyle = INK;
  c.stroke();
  const inner = edge(seed + 3, 22);
  path(inner);
  const g = c.createRadialGradient(m, m, 20, m, m, m);
  if (hot) {
    g.addColorStop(0, "#ffe46a");
    g.addColorStop(0.45, "#ff9a24");
    g.addColorStop(0.85, "#e8501a");
    g.addColorStop(1, "#a8281a");
  } else {
    g.addColorStop(0, "#4a3e44");
    g.addColorStop(1, "#2e262a");
  }
  c.fillStyle = g;
  c.fill();
  c.save();
  path(inner);
  c.clip();
  let s = seed * 7 + 1;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // floating plates of crust (molten) or the pattern of cracks in it (cooled)
  for (let i = 0; i < 9; i++) {
    const [x, y] = [40 + r() * (HOLE - 80), 40 + r() * (HOLE - 80)];
    const rad = 16 + r() * 34;
    const pts: [number, number][] = [];
    for (let k = 0; k < 7; k++) {
      const t = (k / 7) * Math.PI * 2 + r() * 0.5;
      const d = rad * (0.7 + r() * 0.4);
      pts.push([x + Math.cos(t) * d, y + Math.sin(t) * d * 0.8]);
    }
    path(pts);
    c.fillStyle = hot ? rgba(0x3a2018, 0.85) : "#3c3236";
    c.fill();
    c.lineWidth = hot ? 4 : 5;
    c.strokeStyle = hot ? rgba(0xffd060, 0.8) : rgba(0xff5a1a, 0.35);
    c.stroke();
  }
  if (hot) {
    // bright swirls of the hottest lava
    c.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      const [x, y] = [60 + r() * (HOLE - 120), 60 + r() * (HOLE - 120)];
      c.arc(x, y, 20 + r() * 30, r() * 6, r() * 6 + 2);
      c.lineWidth = 6;
      c.strokeStyle = rgba(0xfff0a0, 0.7);
      c.stroke();
    }
  }
  c.restore();
  // a lip of light (or ash) round the inside of the rim
  path(inner);
  c.lineWidth = 6;
  c.strokeStyle = hot ? rgba(0xffc040, 0.9) : rgba(0x6a5a5e, 0.9);
  c.stroke();
}

/** The warning: cracks running out from the middle, glowing orange where lava shows through. */
function cracks(c: Ctx, seed: number): void {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const m = HOLE / 2;
  const lines: [number, number][][] = [];
  const grow = (x: number, y: number, a: number, len: number, depth: number) => {
    const pts: [number, number][] = [[x, y]];
    for (let i = 0; i < 4; i++) {
      a += (r() - 0.5) * 0.9;
      x += Math.cos(a) * (len / 4);
      y += Math.sin(a) * (len / 4);
      pts.push([x, y]);
      if (depth > 0 && r() < 0.35) grow(x, y, a + (r() < 0.5 ? 0.9 : -0.9), len * 0.5, depth - 1);
    }
    lines.push(pts);
  };
  for (let i = 0; i < 6; i++) grow(m, m, (i / 6) * Math.PI * 2 + r() * 0.6, 150 + r() * 40, 2);
  // the whole piece glows hot, a dashed edge where it will break off
  c.beginPath();
  edge(seed, 6).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  const g = c.createRadialGradient(m, m, 30, m, m, m);
  g.addColorStop(0, rgba(0xff8a1a, 0.4));
  g.addColorStop(1, rgba(0xff3a1a, 0.18));
  c.fillStyle = g;
  c.fill();
  c.setLineDash([28, 18]);
  c.lineWidth = 12;
  c.strokeStyle = rgba(0x2a1410, 0.8);
  c.stroke();
  c.lineWidth = 6;
  c.strokeStyle = "#ff8a1a";
  c.stroke();
  c.setLineDash([]);
  c.lineCap = "round";
  c.lineJoin = "round";
  const draw = (w: number, col: string) => {
    c.lineWidth = w;
    c.strokeStyle = col;
    for (const pts of lines) {
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    }
  };
  draw(30, rgba(0xff6a1a, 0.35));
  draw(13, INK);
  draw(7, "#ff8a1a");
  draw(3, "#ffe880");
  // the ground in the middle has already sunk a little
  c.beginPath();
  c.ellipse(m, m, 34, 26, 0, 0, Math.PI * 2);
  c.fillStyle = "#ff8a1a";
  c.fill();
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.stroke();
}

/**
 * A volcano painted properly: a concave cone of layered rock lit from the left (gullies and ridges
 * running down it, strata bands, rocky grain), a broken crater rim with a lava pool glowing inside,
 * lava rivers with bright cores and soft glows, boulders on its slopes, and a rim of light on its edge.
 */
function volcanoPro(c: Ctx): void {
  const W = 1000;
  const H = 780;
  let s = 23;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cone = () => {
    c.beginPath();
    c.moveTo(20, H);
    c.bezierCurveTo(240, 620, 330, 330, 400, 190);
    c.lineTo(440, 170);
    c.lineTo(470, 186);
    c.lineTo(520, 166);
    c.lineTo(560, 180);
    c.lineTo(600, 192);
    c.bezierCurveTo(670, 330, 760, 620, 980, H);
    c.closePath();
  };
  // the glow over the crater, behind everything
  const glow = c.createRadialGradient(500, 160, 10, 500, 160, 260);
  glow.addColorStop(0, "rgba(255,170,60,0.6)");
  glow.addColorStop(1, "rgba(255,90,20,0)");
  c.fillStyle = glow;
  c.fillRect(200, 0, 600, 420);
  // the cone: lit from the left, darker toward its foot
  cone();
  const body = c.createLinearGradient(160, 0, 860, 0);
  body.addColorStop(0, "#9a7a68");
  body.addColorStop(0.45, "#5e4640");
  body.addColorStop(1, "#22161a");
  c.fillStyle = body;
  c.fill();
  c.save();
  cone();
  c.clip();
  const foot = c.createLinearGradient(0, 200, 0, H);
  foot.addColorStop(0, "rgba(20,10,12,0)");
  foot.addColorStop(1, "rgba(20,10,12,0.55)");
  c.fillStyle = foot;
  c.fillRect(0, 0, W, H);
  // strata: faint curved bands of rock
  for (let i = 0; i < 9; i++) {
    const y = 260 + i * 58;
    c.strokeStyle = i % 2 ? "rgba(30,16,16,0.22)" : "rgba(200,170,150,0.12)";
    c.lineWidth = 10 + r() * 8;
    c.beginPath();
    c.moveTo(0, y + 40);
    c.quadraticCurveTo(500, y - 30, W, y + 40);
    c.stroke();
  }
  // gullies and ridges running down from the top (dark grooves with a lit edge)
  for (let i = 0; i < 16; i++) {
    const x0 = 410 + r() * 180;
    const x1 = 60 + (i / 15) * 880 + (r() - 0.5) * 60;
    const bend = (r() - 0.5) * 120;
    c.strokeStyle = "rgba(24,12,12,0.45)";
    c.lineWidth = 6 + r() * 10;
    c.beginPath();
    c.moveTo(x0, 200);
    c.quadraticCurveTo((x0 + x1) / 2 + bend, 470, x1, H);
    c.stroke();
    c.strokeStyle = "rgba(230,200,180,0.16)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x0 - 6, 204);
    c.quadraticCurveTo((x0 + x1) / 2 + bend - 8, 470, x1 - 8, H);
    c.stroke();
  }
  // rocky grain
  for (let i = 0; i < 700; i++) {
    const [x, y] = [r() * W, 180 + r() * (H - 180)];
    c.fillStyle = r() < 0.5 ? "rgba(20,10,10,0.3)" : "rgba(210,180,160,0.18)";
    c.beginPath();
    c.ellipse(x, y, 2 + r() * 5, 1.5 + r() * 3, r() * 3, 0, Math.PI * 2);
    c.fill();
  }
  // lava rivers: a soft glow, a hot body and a bright core, branching on the way down
  const river = (pts: [number, number][], w: number) => {
    for (const [lw, col] of [[w * 3.4, "rgba(255,90,10,0.28)"], [w * 1.6, "#e8481a"], [w, "#ff9a2a"], [w * 0.4, "#fff0a0"]] as const) {
      c.strokeStyle = col;
      c.lineWidth = lw;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length - 1; k++) c.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
      c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      c.stroke();
    }
  };
  river([[470, 190], [450, 300], [400, 420], [380, 560], [330, 700], [300, H]], 14);
  river([[540, 186], [560, 290], [610, 400], [640, 520], [700, 660], [740, H]], 12);
  river([[400, 420], [340, 470], [250, 600], [200, H]], 8);
  river([[610, 400], [680, 450], [780, 600], [840, H]], 7);
  c.restore();
  // a rim of light on the lit edge, and the ink outline
  c.save();
  c.strokeStyle = "rgba(255,220,190,0.5)";
  c.lineWidth = 8;
  c.beginPath();
  c.moveTo(40, H - 10);
  c.bezierCurveTo(250, 610, 336, 330, 404, 196);
  c.stroke();
  c.restore();
  cone();
  c.lineWidth = 8;
  c.strokeStyle = "#140a0a";
  c.stroke();
  // the crater: a dark broken rim round a glowing lava pool
  c.beginPath();
  c.ellipse(500, 182, 104, 26, 0, 0, Math.PI * 2);
  c.fillStyle = "#2a1414";
  c.fill();
  c.stroke();
  const pool = c.createRadialGradient(500, 184, 4, 500, 184, 92);
  pool.addColorStop(0, "#fffbe0");
  pool.addColorStop(0.35, "#ffd040");
  pool.addColorStop(0.75, "#ff6a1a");
  pool.addColorStop(1, "#a82a10");
  c.beginPath();
  c.ellipse(500, 186, 88, 18, 0, 0, Math.PI * 2);
  c.fillStyle = pool;
  c.fill();
  c.strokeStyle = "rgba(255,240,180,0.9)";
  c.lineWidth = 4;
  c.beginPath();
  c.ellipse(500, 182, 100, 23, 0, Math.PI * 0.05, Math.PI * 0.95);
  c.stroke();
  // boulders on its slopes
  for (const [x, y, rr] of [[230, 640, 30], [300, 700, 22], [700, 650, 34], [800, 720, 26], [560, 740, 20]] as const) {
    const g = c.createRadialGradient(x - rr * 0.4, y - rr * 0.4, 2, x, y, rr);
    g.addColorStop(0, "#8a7068");
    g.addColorStop(1, "#2a1a1a");
    c.beginPath();
    c.ellipse(x, y, rr, rr * 0.75, 0, 0, Math.PI * 2);
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 5;
    c.strokeStyle = "#140a0a";
    c.stroke();
  }
}

/**
 * A meteor rock in 3D: a lumpy ball lit from the top left (a soft highlight, a dark far side), craters
 * with lit lower lips, lava glowing in its cracks, orange light bouncing up from below, a contact shadow.
 */
function meteor(c: Ctx, seed: number, sx: number, sy: number, lumpy: number): void {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const [cx, cy, R] = [130, 112, 92];
  // the shadow it casts on the ground
  const sh = c.createRadialGradient(cx, 214, 4, cx, 214, 120);
  sh.addColorStop(0, "rgba(0,0,0,0.5)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = sh;
  c.beginPath();
  c.ellipse(cx, 212, 118 * sx, 26, 0, 0, Math.PI * 2);
  c.fill();
  const pts: [number, number][] = [];
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) * Math.PI * 2;
    const d = R * (1 - lumpy + r() * lumpy * 2) * (1 + Math.sin(t * 3 + seed) * lumpy * 0.5);
    pts.push([cx + Math.cos(t) * d * sx, cy + Math.sin(t) * d * sy]);
  }
  const body = () => {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
  };
  body();
  const g = c.createRadialGradient(cx - R * 0.38 * sx, cy - R * 0.42 * sy, 6, cx, cy, R * 1.15);
  g.addColorStop(0, "#a8949a");
  g.addColorStop(0.35, "#6a585e");
  g.addColorStop(0.75, "#3a2c32");
  g.addColorStop(1, "#1e1418");
  c.fillStyle = g;
  c.fill();
  c.save();
  body();
  c.clip();
  // orange light from the lava below, on the underside
  const up = c.createLinearGradient(0, cy + R * 0.2, 0, cy + R);
  up.addColorStop(0, "rgba(255,120,30,0)");
  up.addColorStop(1, "rgba(255,120,30,0.55)");
  c.fillStyle = up;
  c.fillRect(0, 0, 260, 240);
  // craters: a dark bowl with a lit lower lip
  for (let i = 0; i < 6; i++) {
    const [x, y] = [cx + (r() - 0.5) * R * 1.3 * sx, cy + (r() - 0.5) * R * 1.2 * sy];
    const cr = 8 + r() * 16;
    c.fillStyle = "rgba(20,10,14,0.55)";
    c.beginPath();
    c.ellipse(x, y, cr, cr * 0.75, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(220,200,205,0.45)";
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(x, y, cr, cr * 0.75, 0, 0.2, Math.PI - 0.2);
    c.stroke();
  }
  // glowing cracks
  c.lineCap = "round";
  c.lineJoin = "round";
  const cracks: [number, number][][] = [];
  for (let i = 0; i < 3; i++) {
    let [x, y] = [cx + (r() - 0.5) * R, cy + (r() - 0.5) * R * 0.8];
    let a = r() * Math.PI * 2;
    const line: [number, number][] = [[x, y]];
    for (let k = 0; k < 4; k++) {
      a += (r() - 0.5) * 1.4;
      x += Math.cos(a) * 22;
      y += Math.sin(a) * 18;
      line.push([x, y]);
    }
    cracks.push(line);
  }
  for (const [w, col] of [[16, "rgba(255,110,20,0.35)"], [7, "#ff7a1a"], [3, "#ffe070"]] as [number, string][]) {
    c.lineWidth = w;
    c.strokeStyle = col;
    for (const line of cracks) {
      c.beginPath();
      line.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    }
  }
  // a soft shine on the lit side
  const shine = c.createRadialGradient(cx - R * 0.45 * sx, cy - R * 0.5 * sy, 2, cx - R * 0.45 * sx, cy - R * 0.5 * sy, R * 0.5);
  shine.addColorStop(0, "rgba(255,255,255,0.45)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = shine;
  c.fillRect(0, 0, 260, 240);
  c.restore();
  body();
  c.lineWidth = 7;
  c.strokeStyle = INK;
  c.stroke();
}
