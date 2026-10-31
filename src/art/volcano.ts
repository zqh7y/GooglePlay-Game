import Phaser from "phaser";
import { INK, Ctx, canvasTexture } from "./draw";
import { groundShadow, lin, poly } from "./story";

/**
 * The volcano stage (9): molten lava, the crater's ash floor, the Magma King's lava bombs, the water
 * geysers that crack its armour, the mode's icon and the smoking volcano in the lobby.
 */
export function makeVolcanoTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("lava_tile")) return;
  // lava: molten rock flowing in swirls, bright veins, plates of dark crust riding on it (wraps round)
  canvasTexture(scene, "lava_tile", 512, 512, (c) => lavaTile(c));
  // the crater floor: slabs of basalt (each lit on its top left, shadowed bottom right), warm seams, grit
  canvasTexture(scene, "ash_tile", 512, 512, (c) => basaltTile(c));
  // the crater's walls behind the floor: layered cliffs (some with a lava fall), the near lip of boulders,
  // and the bowl's shading (dark toward the rim)
  canvasTexture(scene, "crater_wall", 400, 560, (c) => craterWall(c, 5, false));
  canvasTexture(scene, "crater_wall2", 400, 560, (c) => craterWall(c, 23, false));
  canvasTexture(scene, "crater_fall", 400, 560, (c) => craterWall(c, 41, true));
  canvasTexture(scene, "crater_lip", 420, 220, (c) => craterLip(c));
  canvasTexture(scene, "crater_shade", 256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 40, 128, 128, 128);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.7, "rgba(10,4,6,0.12)");
    g.addColorStop(0.92, "rgba(10,4,6,0.5)");
    g.addColorStop(1, "rgba(10,4,6,0.7)");
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  });
  // a lava bomb: a glowing rock with a fiery tail
  canvasTexture(scene, "lava_bomb", 120, 160, (c) => {
    const tail = c.createLinearGradient(0, 0, 0, 100);
    tail.addColorStop(0, "rgba(255,120,20,0)");
    tail.addColorStop(1, "rgba(255,180,40,0.9)");
    c.fillStyle = tail;
    c.beginPath();
    c.moveTo(40, 0);
    c.lineTo(80, 0);
    c.lineTo(92, 100);
    c.lineTo(28, 100);
    c.closePath();
    c.fill();
    c.lineWidth = 5;
    c.strokeStyle = INK;
    const g = c.createRadialGradient(52, 104, 4, 60, 112, 40);
    g.addColorStop(0, "#fff3a0");
    g.addColorStop(0.35, "#ff8a1a");
    g.addColorStop(1, "#5a1a0a");
    c.fillStyle = g;
    c.beginPath();
    c.arc(60, 114, 38, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.strokeStyle = "rgba(40,10,6,0.8)";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(38, 104);
    c.lineTo(56, 118);
    c.lineTo(50, 138);
    c.moveTo(70, 96);
    c.lineTo(80, 120);
    c.stroke();
  });
  // a water geyser vent: a ring of mossy stones round a pool of blue water
  canvasTexture(scene, "geyser", 220, 150, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 5;
    c.strokeStyle = INK;
    groundShadow(c, 110, 112, 104, 26);
    c.beginPath();
    c.ellipse(110, 92, 100, 46, 0, 0, Math.PI * 2);
    c.fillStyle = lin(c, 10, 0, 210, 0, ["#9a9298", "#6a6268", "#3a3438"]);
    c.fill();
    c.stroke();
    const w = c.createRadialGradient(100, 82, 4, 110, 88, 70);
    w.addColorStop(0, "#e8fbff");
    w.addColorStop(0.4, "#6ad0ff");
    w.addColorStop(1, "#1a5aa8");
    c.beginPath();
    c.ellipse(110, 86, 70, 28, 0, 0, Math.PI * 2);
    c.fillStyle = w;
    c.fill();
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.8)";
    for (const [x, y, r] of [[86, 80, 6], [126, 90, 4], [110, 76, 3]]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    for (const [x, y] of [[22, 96], [60, 128], [160, 128], [198, 96], [110, 136]]) {
      c.beginPath();
      c.ellipse(x, y, 20, 13, 0, 0, Math.PI * 2);
      c.fillStyle = "#7a7278";
      c.fill();
      c.stroke();
    }
  });
  // a ball of water flying at the boss
  canvasTexture(scene, "water_ball", 96, 96, (c) => {
    const g = c.createRadialGradient(40, 38, 4, 48, 48, 44);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, "#9ae6ff");
    g.addColorStop(1, "rgba(40,120,220,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(48, 48, 44, 0, Math.PI * 2);
    c.fill();
  });
  canvasTexture(scene, "mode_volcano", 128, 128, (c) => volcano(c, 128, 128, true));
  canvasTexture(scene, "volcano_mini", 560, 420, (c) => volcano(c, 560, 420, false));
}

/** A volcano: a dark cone with lava running down from its glowing crater (and a round badge for the icon). */
function volcano(c: Ctx, w: number, h: number, icon: boolean): void {
  c.lineJoin = "round";
  c.lineWidth = icon ? 6 : 8;
  c.strokeStyle = INK;
  if (icon) {
    const bg = c.createLinearGradient(0, 8, 0, 120);
    bg.addColorStop(0, "#5a1a2a");
    bg.addColorStop(1, "#ff7a2a");
    c.fillStyle = bg;
    c.beginPath();
    c.arc(64, 64, 56, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  } else groundShadow(c, w / 2, h - 16, w * 0.46, 26);
  const k = w / 128;
  const base = icon ? 106 : h - 20;
  const top = icon ? 40 : 80;
  const cone: [number, number][] = [[w * 0.08, base], [w * 0.4, top], [w * 0.6, top], [w * 0.92, base]];
  poly(c, cone, lin(c, w * 0.1, 0, w * 0.9, 0, ["#7a5a50", "#4a3632", "#2a1c1a"]));
  // lava running down from the crater
  c.save();
  c.beginPath();
  c.moveTo(cone[0][0], cone[0][1]);
  for (const p of cone.slice(1)) c.lineTo(p[0], p[1]);
  c.closePath();
  c.clip();
  c.strokeStyle = "#ff8a1a";
  c.lineCap = "round";
  for (const [x0, x1, lw] of [[0.47, 0.32, 9], [0.53, 0.66, 7], [0.5, 0.48, 6]]) {
    c.lineWidth = lw * k * 0.7;
    c.beginPath();
    c.moveTo(w * x0, top);
    c.quadraticCurveTo(w * (x0 + x1) / 2 + 6 * k, (top + base) / 2, w * x1, base);
    c.stroke();
  }
  c.restore();
  c.beginPath();
  c.ellipse(w / 2, top, w * 0.1, 6 * k * (icon ? 1 : 0.6), 0, 0, Math.PI * 2);
  c.fillStyle = "#ffd040";
  c.fill();
  c.stroke();
  if (icon) {
    c.fillStyle = "rgba(60,50,60,0.85)";
    for (const [x, y, r] of [[60, 28, 9], [72, 20, 7], [56, 16, 6]]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  }
}

/** Repeat a draw call at the 9 wrapped positions so a tile joins up seamlessly. */
function wrap(size: number, draw: (dx: number, dy: number) => void): void {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(dx, dy);
}

function lavaTile(c: Ctx): void {
  const S = 512;
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const base = c.createLinearGradient(0, 0, S, S);
  base.addColorStop(0, "#b8280c");
  base.addColorStop(0.5, "#d8401a");
  base.addColorStop(1, "#b8280c");
  c.fillStyle = base;
  c.fillRect(0, 0, S, S);
  // hot pools
  for (let i = 0; i < 14; i++) {
    const [x, y, rad] = [r() * S, r() * S, 50 + r() * 70];
    wrap(S, (dx, dy) => {
      const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      g.addColorStop(0, "rgba(255,236,120,0.9)");
      g.addColorStop(0.5, "rgba(255,150,30,0.6)");
      g.addColorStop(1, "rgba(255,90,20,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(x + dx, y + dy, rad, 0, Math.PI * 2);
      c.fill();
    });
  }
  // flowing streaks
  c.lineCap = "round";
  for (let i = 0; i < 18; i++) {
    const [x, y] = [r() * S, r() * S];
    const pts: [number, number][] = [[x, y]];
    let a = r() * Math.PI * 2;
    for (let k = 0; k < 6; k++) {
      a += (r() - 0.5) * 0.8;
      const [px, py] = pts[pts.length - 1];
      pts.push([px + Math.cos(a) * 30, py + Math.sin(a) * 30]);
    }
    const w = 3 + r() * 6;
    wrap(S, (dx, dy) => {
      for (const [lw, col] of [[w * 3, "rgba(255,170,40,0.25)"], [w, "rgba(255,240,150,0.75)"]] as [number, string][]) {
        c.lineWidth = lw;
        c.strokeStyle = col;
        c.beginPath();
        pts.forEach(([px, py], j) => (j ? c.lineTo(px + dx, py + dy) : c.moveTo(px + dx, py + dy)));
        c.stroke();
      }
    });
  }
  // plates of dark crust, their edges glowing
  for (let i = 0; i < 16; i++) {
    const [x, y, rad] = [r() * S, r() * S, 16 + r() * 34];
    const pts: [number, number][] = [];
    for (let k = 0; k < 7; k++) {
      const t = (k / 7) * Math.PI * 2 + r() * 0.5;
      const d = rad * (0.6 + r() * 0.5);
      pts.push([Math.cos(t) * d, Math.sin(t) * d * 0.8]);
    }
    wrap(S, (dx, dy) => {
      c.beginPath();
      pts.forEach(([px, py], j) => (j ? c.lineTo(x + px + dx, y + py + dy) : c.moveTo(x + px + dx, y + py + dy)));
      c.closePath();
      const g = c.createLinearGradient(x + dx - rad, y + dy - rad, x + dx + rad, y + dy + rad);
      g.addColorStop(0, "#5a2a1e");
      g.addColorStop(1, "#2a1210");
      c.fillStyle = g;
      c.fill();
      c.lineWidth = 4;
      c.strokeStyle = "rgba(255,200,80,0.8)";
      c.stroke();
    });
  }
}

function basaltTile(c: Ctx): void {
  const S = 512;
  const N = 5;
  let s = 11;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  c.fillStyle = "#2a2024";
  c.fillRect(0, 0, S, S);
  // a jittered grid of slabs: corners shared (and wrapped) so the seams join up
  const step = S / N;
  const jit: [number, number][][] = [];
  for (let i = 0; i < N; i++) {
    jit.push([]);
    for (let j = 0; j < N; j++) jit[i].push([(r() - 0.5) * step * 0.5, (r() - 0.5) * step * 0.5]);
  }
  const corner = (i: number, j: number): [number, number] => {
    const [jx, jy] = jit[((i % N) + N) % N][((j % N) + N) % N];
    return [i * step + jx, j * step + jy];
  };
  for (let i = -1; i <= N; i++) for (let j = -1; j <= N; j++) {
    const q = [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)];
    const inset = (p: [number, number], k: number): [number, number] => {
      const mx = (q[0][0] + q[2][0]) / 2;
      const my = (q[0][1] + q[2][1]) / 2;
      return [p[0] + (mx - p[0]) * k, p[1] + (my - p[1]) * k];
    };
    const v = 0.85 + r() * 0.3;
    const shade = (base: number) => Math.round(base * v);
    const path = (k: number) => {
      c.beginPath();
      q.map((p) => inset(p, k)).forEach(([x, y], n) => (n ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
    };
    path(0.06);
    const g = c.createLinearGradient(q[0][0], q[0][1], q[2][0], q[2][1]);
    g.addColorStop(0, `rgb(${shade(118)},${shade(100)},${shade(104)})`);
    g.addColorStop(1, `rgb(${shade(70)},${shade(56)},${shade(60)})`);
    c.fillStyle = g;
    c.fill();
    // bevel: light along the top and left edges, dark along the bottom and right
    const [a, b, d, e] = q.map((p) => inset(p, 0.06));
    c.lineWidth = 5;
    c.strokeStyle = "rgba(200,180,186,0.35)";
    c.beginPath();
    c.moveTo(e[0], e[1]);
    c.lineTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.stroke();
    c.strokeStyle = "rgba(10,4,6,0.45)";
    c.beginPath();
    c.moveTo(b[0], b[1]);
    c.lineTo(d[0], d[1]);
    c.lineTo(e[0], e[1]);
    c.stroke();
    // grit
    for (let k = 0; k < 14; k++) {
      const [x, y] = inset([q[0][0] + r() * step, q[0][1] + r() * step], 0.2);
      c.fillStyle = r() < 0.5 ? "rgba(160,140,146,0.5)" : "rgba(20,12,14,0.45)";
      c.beginPath();
      c.arc(x, y, 1.5 + r() * 2.5, 0, Math.PI * 2);
      c.fill();
    }
  }
  // the seams glow faintly with the heat below
  c.lineWidth = 3;
  c.strokeStyle = "rgba(255,110,30,0.28)";
  for (let i = -1; i <= N; i++) for (let j = -1; j <= N; j++) {
    const [p, q2, q3] = [corner(i, j), corner(i + 1, j), corner(i, j + 1)];
    c.beginPath();
    c.moveTo(q2[0], q2[1]);
    c.lineTo(p[0], p[1]);
    c.lineTo(q3[0], q3[1]);
    c.stroke();
  }
}

/** A stretch of the crater's cliff: a jagged top, strata bands, gullies, ledges; maybe a lava fall. */
function craterWall(c: Ctx, seed: number, fall: boolean): void {
  const [W, H] = [400, 560];
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const top: [number, number][] = [[-10, 140]];
  for (let x = 20; x <= W - 20; x += 40) top.push([x, 60 + r() * 90]);
  top.push([W + 10, 140]);
  const shape = () => {
    c.beginPath();
    c.moveTo(-10, H);
    top.forEach(([x, y]) => c.lineTo(x, y));
    c.lineTo(W + 10, H);
    c.closePath();
  };
  shape();
  const g = c.createLinearGradient(0, 60, 0, H);
  g.addColorStop(0, "#7a6a70");
  g.addColorStop(0.35, "#4a3c42");
  g.addColorStop(0.8, "#2a1e22");
  g.addColorStop(1, "#5a2a1a");
  c.fillStyle = g;
  c.fill();
  c.save();
  shape();
  c.clip();
  // strata bands
  for (let y = 150; y < H; y += 46 + r() * 30) {
    c.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.14)";
    c.beginPath();
    c.moveTo(0, y);
    for (let x = 0; x <= W; x += 50) c.lineTo(x, y + (r() - 0.5) * 14);
    c.lineTo(W, y + 22);
    c.lineTo(0, y + 22);
    c.closePath();
    c.fill();
  }
  // gullies running down and ridges between them (lit on their left)
  for (let i = 0; i < 7; i++) {
    const x = 20 + r() * (W - 40);
    c.lineWidth = 8 + r() * 10;
    c.strokeStyle = "rgba(10,4,6,0.35)";
    c.beginPath();
    c.moveTo(x, 120);
    c.quadraticCurveTo(x + (r() - 0.5) * 60, H * 0.6, x + (r() - 0.5) * 40, H);
    c.stroke();
    c.lineWidth = 3;
    c.strokeStyle = "rgba(220,200,206,0.18)";
    c.beginPath();
    c.moveTo(x - 10, 120);
    c.quadraticCurveTo(x - 10 + (r() - 0.5) * 60, H * 0.6, x - 10 + (r() - 0.5) * 40, H);
    c.stroke();
  }
  // ledges
  for (let i = 0; i < 4; i++) {
    const [x, y, w] = [r() * W, 200 + r() * 260, 50 + r() * 70];
    c.fillStyle = "rgba(150,132,138,0.4)";
    c.beginPath();
    c.ellipse(x, y, w, 7, 0, 0, Math.PI * 2);
    c.fill();
  }
  // the lava at the foot lights it from below
  const glow = c.createLinearGradient(0, H - 160, 0, H);
  glow.addColorStop(0, "rgba(255,110,30,0)");
  glow.addColorStop(1, "rgba(255,110,30,0.6)");
  c.fillStyle = glow;
  c.fillRect(0, 0, W, H);
  if (fall) {
    // a lava fall pouring over the edge
    const x = W / 2 + (r() - 0.5) * 60;
    const fg = c.createLinearGradient(x - 40, 0, x + 40, 0);
    fg.addColorStop(0, "rgba(255,90,20,0.2)");
    fg.addColorStop(0.5, "rgba(255,230,120,1)");
    fg.addColorStop(1, "rgba(255,90,20,0.2)");
    c.fillStyle = fg;
    c.beginPath();
    c.moveTo(x - 26, 70);
    c.bezierCurveTo(x - 30, 250, x - 46, 420, x - 60, H);
    c.lineTo(x + 60, H);
    c.bezierCurveTo(x + 46, 420, x + 30, 250, x + 26, 70);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(255,250,200,0.8)";
    c.lineWidth = 4;
    for (let k = 0; k < 4; k++) {
      const ox = (r() - 0.5) * 30;
      c.beginPath();
      c.moveTo(x + ox * 0.5, 90);
      c.quadraticCurveTo(x + ox, 300, x + ox * 1.6, H);
      c.stroke();
    }
  }
  c.restore();
  // the lit rim along the top
  c.beginPath();
  top.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.lineWidth = 8;
  c.strokeStyle = "rgba(230,200,190,0.6)";
  c.stroke();
  shape();
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.stroke();
}

/** The near edge of the crater: a row of big round boulders seen from above, lit on top. */
function craterLip(c: Ctx): void {
  let s = 77;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const rocks: [number, number, number][] = [];
  for (let x = 30; x < 410; x += 60 + r() * 30) rocks.push([x, 110 + (r() - 0.5) * 30, 50 + r() * 30]);
  rocks.sort((a, b) => a[1] - b[1]);
  for (const [x, y, rad] of rocks) {
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.beginPath();
    c.ellipse(x + 6, y + rad * 0.55, rad, rad * 0.4, 0, 0, Math.PI * 2);
    c.fill();
    const g = c.createRadialGradient(x - rad * 0.35, y - rad * 0.4, 4, x, y, rad * 1.1);
    g.addColorStop(0, "#9a8a90");
    g.addColorStop(0.5, "#5a4a50");
    g.addColorStop(1, "#22181c");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(x, y, rad, rad * 0.78, 0, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = INK;
    c.stroke();
    c.lineWidth = 4;
    c.strokeStyle = "rgba(255,120,40,0.5)";
    c.beginPath();
    c.ellipse(x, y, rad - 4, rad * 0.78 - 4, 0, 0.3, Math.PI - 0.3);
    c.stroke();
  }
}
