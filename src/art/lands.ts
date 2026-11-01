import { INK, Ctx } from "./draw";
import { groundShadow, lin, poly } from "./story";

/**
 * Scenery for the newer places: the Moon (round grey boulders with craters, purple crystal clusters,
 * a little landed rocket, pebbles) and the Sea's beach (a pink shell and a starfish).
 */
export const LAND_ART: Record<string, [number, number, (c: Ctx) => void]> = {
  moon_rock: [180, 150, (c) => moonRock(c, 90, 96, 76, 56)],
  moon_pebble: [90, 60, (c) => moonRock(c, 45, 36, 32, 20)],
  moon_crystal: [160, 190, (c) => crystals(c, 80, 170, 1)],
  moon_crystal_s: [90, 100, (c) => crystals(c, 45, 90, 0.5)],
  moon_rocket: [150, 240, rocket],
  shell_pink: [80, 64, shell],
  starfish: [80, 72, starfish],
};

function moonRock(c: Ctx, x: number, y: number, rx: number, ry: number): void {
  groundShadow(c, x, y + ry * 0.85, rx * 1.05, ry * 0.3);
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  const g = c.createRadialGradient(x - rx * 0.35, y - ry * 0.4, 4, x, y, rx * 1.1);
  g.addColorStop(0, "#e2e0ec");
  g.addColorStop(0.55, "#a4a2b4");
  g.addColorStop(1, "#5e5c70");
  c.fillStyle = g;
  c.fill();
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.stroke();
  // craters with a lit lower lip
  for (const [dx, dy, r] of [[-0.3, -0.15, 0.22], [0.3, 0.1, 0.16], [-0.05, 0.35, 0.12]]) {
    const [cx, cy, cr] = [x + dx * rx, y + dy * ry, r * rx];
    c.fillStyle = "rgba(60,58,80,0.5)";
    c.beginPath();
    c.ellipse(cx, cy, cr, cr * 0.7, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,0.55)";
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(cx, cy, cr, cr * 0.7, 0, 0.3, Math.PI - 0.3);
    c.stroke();
  }
}

function crystals(c: Ctx, x: number, base: number, s: number): void {
  groundShadow(c, x, base, 60 * s, 14 * s);
  const shards: [number, number, number, number][] = [[-34, 90, 20, -0.3], [30, 100, 22, 0.25], [0, 150, 28, 0], [-14, 70, 16, -0.12], [18, 80, 16, 0.4]];
  for (const [dx, h, w, tilt] of shards.sort((a, b) => a[1] - b[1])) {
    c.save();
    c.translate(x + dx * s, base);
    c.rotate(tilt);
    const [H, Wd] = [h * s, w * s];
    poly(c, [[-Wd, 0], [-Wd, -H * 0.75], [0, -H], [Wd, -H * 0.75], [Wd, 0]], lin(c, -Wd, 0, Wd, 0, ["#e8d0ff", "#a070f0", "#5a2ab0"]));
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.beginPath();
    c.moveTo(-Wd * 0.6, -H * 0.1);
    c.lineTo(-Wd * 0.6, -H * 0.7);
    c.lineTo(-Wd * 0.1, -H * 0.85);
    c.lineTo(-Wd * 0.2, -H * 0.1);
    c.closePath();
    c.fill();
    c.restore();
  }
}

/** A little cartoon rocket standing on its fins. */
function rocket(c: Ctx): void {
  groundShadow(c, 75, 226, 56, 12);
  c.lineJoin = "round";
  // fins
  poly(c, [[38, 220], [50, 160], [58, 210]], "#e8434f");
  poly(c, [[112, 220], [100, 160], [92, 210]], "#e8434f");
  // body
  c.beginPath();
  c.moveTo(48, 210);
  c.bezierCurveTo(40, 120, 52, 50, 75, 14);
  c.bezierCurveTo(98, 50, 110, 120, 102, 210);
  c.closePath();
  c.fillStyle = lin(c, 44, 0, 106, 0, ["#ffffff", "#d8dce8", "#9aa0b4"]);
  c.fill();
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.stroke();
  // nose cone and a stripe
  c.save();
  c.clip();
  c.fillStyle = "#e8434f";
  c.fillRect(0, 0, 150, 58);
  c.fillRect(0, 170, 150, 12);
  c.restore();
  // round window
  c.beginPath();
  c.arc(75, 104, 18, 0, Math.PI * 2);
  c.fillStyle = "#7ad8ff";
  c.fill();
  c.lineWidth = 6;
  c.strokeStyle = "#4a5068";
  c.stroke();
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.beginPath();
  c.arc(69, 98, 6, 0, Math.PI * 2);
  c.fill();
}

function shell(c: Ctx): void {
  groundShadow(c, 40, 54, 30, 7);
  c.beginPath();
  c.moveTo(40, 54);
  c.bezierCurveTo(4, 50, 6, 10, 40, 8);
  c.bezierCurveTo(74, 10, 76, 50, 40, 54);
  c.fillStyle = lin(c, 0, 8, 0, 54, ["#ffe0ec", "#ff9ac0"]);
  c.fill();
  c.lineWidth = 5;
  c.strokeStyle = INK;
  c.stroke();
  c.strokeStyle = "rgba(200,80,130,0.6)";
  c.lineWidth = 3;
  for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
    c.beginPath();
    c.moveTo(40, 50);
    c.lineTo(40 + Math.sin(a) * 30, 50 - Math.cos(a) * 36);
    c.stroke();
  }
}

function starfish(c: Ctx): void {
  groundShadow(c, 40, 60, 30, 7);
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 ? 13 : 32;
    pts.push([40 + Math.cos(a) * r, 36 + Math.sin(a) * r * 0.85]);
  }
  poly(c, pts, lin(c, 0, 4, 0, 64, ["#ffb060", "#ff7a3a"]));
  c.fillStyle = "#fff0d8";
  for (const [x, y] of [[40, 22], [28, 34], [52, 34], [34, 46], [46, 46]]) {
    c.beginPath();
    c.arc(x, y, 2.5, 0, Math.PI * 2);
    c.fill();
  }
}
