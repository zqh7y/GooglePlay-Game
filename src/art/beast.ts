import Phaser from "phaser";
import { Ctx, canvasTexture, linear, radial } from "./draw";

/**
 * Art for the Feed the Beast cage (a round iron birdcage in two halves, so the beast stands
 * inside it: back bars behind, front bars, dome and padlock in front), its rune platform, the
 * flying bars when it breaks out, and the Air Zone's poison fog, toxic clouds and puddles.
 */

const INK = "#161420";

/** A metal tube with a dark outline, a steel body and a shine down one side. */
function tube(c: Ctx, path: () => void, w: number, body: string | CanvasGradient, shine = "rgba(255,255,255,0.7)"): void {
  c.lineCap = "round";
  c.lineJoin = "round";
  c.beginPath();
  path();
  c.lineWidth = w + 9;
  c.strokeStyle = INK;
  c.stroke();
  c.lineWidth = w;
  c.strokeStyle = body;
  c.stroke();
  c.save();
  c.translate(-w * 0.22, -w * 0.05);
  c.beginPath();
  path();
  c.lineWidth = Math.max(2, w * 0.28);
  c.strokeStyle = shine;
  c.stroke();
  c.restore();
}

const CX = 300;
const TOP_Y = 130;
const BOT_Y = 520;
const RX = 252;
const TOP_RY = 46;
const BOT_RY = 62;

/** One vertical bar at angle th round the cage (0 = facing you), bulging out a little. */
function bar(c: Ctx, th: number, back: boolean, w: number, steel: CanvasGradient): void {
  const s = Math.sin(th);
  const k = back ? -Math.cos(th) : Math.cos(th);
  const x0 = CX + RX * 0.86 * s;
  const y0 = TOP_Y + TOP_RY * k;
  const x1 = CX + RX * s;
  const y1 = BOT_Y + BOT_RY * k;
  tube(c, () => {
    c.moveTo(x0, y0);
    c.quadraticCurveTo(CX + RX * 1.1 * s, (y0 + y1) / 2, x1, y1);
  }, w, steel, back ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.75)");
}

/** Half a ring (front or back) of an ellipse, as a thick metal band with rivets. */
function band(c: Ctx, y: number, rx: number, ry: number, back: boolean, w: number, steel: string | CanvasGradient, rivets: boolean): void {
  tube(c, () => c.ellipse(CX, y, rx, ry, 0, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI), w, steel);
  if (!rivets || back) return;
  for (let i = 1; i < 12; i++) {
    const a = (i / 12) * Math.PI;
    const [x, yy] = [CX + Math.cos(a) * rx, y + Math.sin(a) * ry];
    c.beginPath();
    c.arc(x, yy, 4.5, 0, Math.PI * 2);
    c.fillStyle = "#ffe08a";
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = INK;
    c.stroke();
  }
}

function cageBack(c: Ctx): void {
  const steel = linear(c, 0, 0, 600, 0, [[0, "#3a4258"], [0.5, "#5a6480"], [1, "#2a3044"]]);
  for (let i = 0; i < 9; i++) bar(c, -Math.PI / 2 + ((i + 0.5) / 9) * Math.PI, true, 13, steel);
  band(c, TOP_Y, RX * 0.86, TOP_RY, true, 18, "#4a5470", false);
  band(c, BOT_Y, RX, BOT_RY, true, 24, "#4a5470", false);
  // dark inside of the cage floor
  c.beginPath();
  c.ellipse(CX, BOT_Y, RX - 14, BOT_RY - 10, 0, 0, Math.PI * 2);
  c.fillStyle = radial(c, CX, BOT_Y, RX, [[0, "rgba(10,8,20,0.45)"], [1, "rgba(10,8,20,0.15)"]]);
  c.fill();
}

function cageFront(c: Ctx): void {
  const steel = linear(c, 0, 0, 600, 0, [[0, "#6a748e"], [0.35, "#dfe6f2"], [0.55, "#aab4c8"], [1, "#5a6480"]]);
  const gold = linear(c, 0, 0, 0, 600, [[0, "#fff0a0"], [0.5, "#f0b830"], [1, "#a8701a"]]);
  // the dome: ribs rising from the top ring to the finial
  for (const s of [-1, -0.55, 0, 0.55, 1]) {
    tube(c, () => {
      c.moveTo(CX + RX * 0.86 * s, TOP_Y + TOP_RY * Math.sqrt(1 - s * s));
      c.quadraticCurveTo(CX + RX * 0.7 * s, TOP_Y - 70, CX, 40);
    }, s === 0 ? 14 : 12, steel);
  }
  // the finial on top: a gold ring and a glowing gem
  c.beginPath();
  c.arc(CX, 30, 34, 0, Math.PI * 2);
  c.fillStyle = radial(c, CX, 30, 34, [[0, "rgba(255,120,200,0.8)"], [1, "rgba(255,120,200,0)"]]);
  c.fill();
  tube(c, () => c.arc(CX, 26, 16, 0, Math.PI * 2), 8, gold);
  c.beginPath();
  c.moveTo(CX, 40);
  c.lineTo(CX + 12, 56);
  c.lineTo(CX, 72);
  c.lineTo(CX - 12, 56);
  c.closePath();
  c.fillStyle = "#ff5ab8";
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = INK;
  c.stroke();
  // front bars
  for (let i = 0; i < 9; i++) bar(c, -Math.PI / 2 + ((i + 0.5) / 9) * Math.PI, false, 16, steel);
  // the bands: top, middle and a thick gold-riveted bottom
  band(c, TOP_Y, RX * 0.86, TOP_RY, false, 20, steel, true);
  band(c, 330, RX * 1.06, 54, false, 12, steel, false);
  band(c, BOT_Y, RX, BOT_RY, false, 30, steel, true);
  // the door: a frame on the front with cross bars
  const door = (x0: number, x1: number) => tube(c, () => {
    c.moveTo(x0, 240);
    c.lineTo(x1, 240);
    c.moveTo(x0, 430);
    c.lineTo(x1, 430);
  }, 10, steel);
  door(CX - 70, CX + 70);
  // chains wrapped round the door
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = CX - 90 + t * 180;
    const y = 360 + Math.sin(t * Math.PI) * 26;
    c.save();
    c.translate(x, y);
    c.rotate(i % 2 ? 0.5 : -0.5);
    c.beginPath();
    c.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2);
    c.lineWidth = 9;
    c.strokeStyle = INK;
    c.stroke();
    c.lineWidth = 5;
    c.strokeStyle = i % 2 ? "#c8d0dc" : "#9aa4b8";
    c.stroke();
    c.restore();
  }
  // a big gold padlock with a keyhole
  tube(c, () => c.arc(CX, 382, 26, Math.PI, 0), 11, steel);
  c.beginPath();
  c.roundRect(CX - 40, 380, 80, 68, 14);
  c.fillStyle = gold;
  c.fill();
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.stroke();
  c.fillStyle = "rgba(255,255,255,0.5)";
  c.beginPath();
  c.roundRect(CX - 32, 386, 22, 52, 8);
  c.fill();
  c.fillStyle = INK;
  c.beginPath();
  c.arc(CX, 406, 9, 0, Math.PI * 2);
  c.moveTo(CX - 5, 410);
  c.lineTo(CX + 5, 410);
  c.lineTo(CX + 3, 430);
  c.lineTo(CX - 3, 430);
  c.fill();
}

/** A round stone platform with a glowing rune circle, cracks and moss. */
function cageBase(c: Ctx): void {
  const [cx, cy, rx, ry, depth] = [330, 90, 310, 86, 64];
  // the side of the stone drum
  c.beginPath();
  c.ellipse(cx, cy + depth, rx, ry, 0, 0, Math.PI);
  c.lineTo(cx - rx, cy);
  c.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
  c.closePath();
  c.fillStyle = linear(c, 0, cy, 0, cy + depth + ry, [[0, "#6a6e82"], [1, "#3a3c4e"]]);
  c.fill();
  c.lineWidth = 8;
  c.strokeStyle = INK;
  c.stroke();
  // stone blocks on the side
  c.lineWidth = 3;
  c.strokeStyle = "rgba(20,20,30,0.45)";
  for (let i = 1; i < 10; i++) {
    const a = (i / 10) * Math.PI;
    const x = cx + Math.cos(a) * rx;
    c.beginPath();
    c.moveTo(x, cy + Math.sin(a) * ry);
    c.lineTo(x, cy + depth + Math.sin(a) * ry);
    c.stroke();
  }
  // the top
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = radial(c, cx - 60, cy - 30, rx, [[0, "#d8dce8"], [0.7, "#a0a6b8"], [1, "#7a8094"]]);
  c.fill();
  c.lineWidth = 8;
  c.strokeStyle = INK;
  c.stroke();
  // moss patches
  for (const [x, y, w] of [[90, 104, 50], [520, 70, 40], [380, 150, 36]] as [number, number, number][]) {
    c.beginPath();
    c.ellipse(x, y, w, w * 0.32, 0, 0, Math.PI * 2);
    c.fillStyle = "rgba(90,150,60,0.75)";
    c.fill();
  }
  // cracks
  c.lineWidth = 3;
  c.strokeStyle = "rgba(40,40,60,0.55)";
  c.beginPath();
  c.moveTo(150, 60);
  c.lineTo(180, 80);
  c.lineTo(170, 104);
  c.moveTo(470, 120);
  c.lineTo(500, 104);
  c.lineTo(530, 112);
  c.stroke();
  // the carved rune ring (the glow goes on top in the game)
  c.lineWidth = 5;
  c.strokeStyle = "rgba(60,50,90,0.6)";
  c.beginPath();
  c.ellipse(cx, cy, rx * 0.82, ry * 0.82, 0, 0, Math.PI * 2);
  c.stroke();
}

/** The glowing runes on the platform (white, tinted; pulses in the game). */
function runes(c: Ctx): void {
  const [cx, cy, rx, ry] = [330, 90, 254, 70];
  c.shadowColor = "#ffffff";
  c.shadowBlur = 14;
  c.lineWidth = 5;
  c.strokeStyle = "rgba(255,255,255,0.95)";
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  c.stroke();
  c.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const [x, y] = [cx + Math.cos(a) * rx * 0.9, cy + Math.sin(a) * ry * 0.9];
    c.save();
    c.translate(x, y);
    c.scale(1, 0.4);
    c.beginPath();
    // little angular runes
    const k = i % 3;
    if (k === 0) {
      c.moveTo(-10, -14);
      c.lineTo(10, 0);
      c.lineTo(-10, 14);
    } else if (k === 1) {
      c.moveTo(0, -16);
      c.lineTo(0, 16);
      c.moveTo(-10, -6);
      c.lineTo(10, 6);
    } else {
      c.arc(0, 0, 10, 0, Math.PI * 2);
      c.moveTo(-14, 0);
      c.lineTo(14, 0);
    }
    c.stroke();
    c.restore();
  }
}

/** One iron bar flying off when the cage bursts. */
function flyingBar(c: Ctx): void {
  const steel = linear(c, 0, 0, 40, 0, [[0, "#6a748e"], [0.4, "#dfe6f2"], [1, "#5a6480"]]);
  tube(c, () => {
    c.moveTo(20, 14);
    c.quadraticCurveTo(28, 90, 20, 166);
  }, 14, steel);
}

// ───────────────────────── poison air ─────────────────────────

/** Seamless swirling poison clouds (purple and sickly green), tiled over the whole map. */
function toxicFog(c: Ctx, seed: number, cols: string[]): void {
  const S = 512;
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 46; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 40 + r() * 110;
    const col = cols[i % cols.length];
    // drawn wrapped so the tile repeats without seams
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        const g = radial(c, x + dx, y + dy, rad, [[0, col], [1, col.replace(/[\d.]+\)$/, "0)")]]);
        c.fillStyle = g;
        c.beginPath();
        c.arc(x + dx, y + dy, rad, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  // thin curling wisps
  c.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    const x = r() * S;
    const y = r() * S;
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        c.beginPath();
        c.arc(x + dx, y + dy, 30 + r() * 40, r() * 6, r() * 6 + 2.4);
        c.lineWidth = 6;
        c.strokeStyle = "rgba(200,255,150,0.12)";
        c.stroke();
      }
    }
  }
}

/** A puffy toxic cloud (billowing along the edge of the air zone). */
function toxicCloud(c: Ctx, skull = true): void {
  for (const [x, y, rr, col] of [
    [70, 110, 60, "rgba(110,40,150,0.85)"], [140, 90, 70, "rgba(120,60,170,0.9)"], [200, 112, 56, "rgba(100,40,140,0.85)"],
    [110, 70, 50, "rgba(140,200,80,0.55)"], [170, 60, 44, "rgba(150,90,200,0.7)"],
  ] as [number, number, number, string][]) {
    c.beginPath();
    c.arc(x, y, rr, 0, Math.PI * 2);
    c.fillStyle = radial(c, x - rr * 0.3, y - rr * 0.3, rr * 1.2, [[0, col.replace(/[\d.]+\)$/, "1)")], [0.6, col], [1, col.replace(/[\d.]+\)$/, "0)")]]);
    c.fill();
  }
  if (!skull) return;
  // a little skull in the cloud
  c.fillStyle = "rgba(230,255,200,0.8)";
  c.beginPath();
  c.arc(140, 92, 20, 0, Math.PI * 2);
  c.fill();
  c.fillRect(128, 100, 24, 16);
  c.fillStyle = "rgba(60,20,80,0.9)";
  c.beginPath();
  c.arc(132, 92, 6, 0, Math.PI * 2);
  c.arc(148, 92, 6, 0, Math.PI * 2);
  c.fill();
}

/** A bubbling poison puddle on the ground. */
function toxicPuddle(c: Ctx): void {
  c.beginPath();
  c.ellipse(110, 50, 100, 38, 0, 0, Math.PI * 2);
  c.fillStyle = radial(c, 110, 50, 100, [[0, "rgba(170,255,90,0.9)"], [0.6, "rgba(90,200,60,0.8)"], [1, "rgba(60,120,40,0)"]]);
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = "rgba(40,90,30,0.6)";
  c.beginPath();
  c.ellipse(110, 50, 84, 30, 0, 0, Math.PI * 2);
  c.stroke();
  for (const [x, y, rr] of [[80, 44, 10], [130, 56, 8], [110, 36, 6], [150, 40, 5]] as [number, number, number][]) {
    c.beginPath();
    c.arc(x, y, rr, 0, Math.PI * 2);
    c.fillStyle = "rgba(220,255,170,0.85)";
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = "rgba(40,90,30,0.7)";
    c.stroke();
  }
}

/** A single poison bubble (rises and pops). */
function toxicBubble(c: Ctx): void {
  c.beginPath();
  c.arc(20, 20, 16, 0, Math.PI * 2);
  c.fillStyle = radial(c, 15, 14, 20, [[0, "rgba(240,255,200,0.95)"], [0.5, "rgba(150,240,80,0.75)"], [1, "rgba(80,160,40,0.6)"]]);
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = "rgba(40,90,30,0.8)";
  c.stroke();
}

/** The beast's wishes: a wooden bucket of water, and a striped beach ball. */
function bucket(c: Ctx): void {
  c.lineJoin = "round";
  c.lineWidth = 6;
  c.strokeStyle = INK;
  // the handle
  c.beginPath();
  c.arc(64, 54, 44, Math.PI * 1.05, Math.PI * 1.95);
  c.stroke();
  c.beginPath();
  c.moveTo(22, 52);
  c.lineTo(32, 118);
  c.quadraticCurveTo(64, 128, 96, 118);
  c.lineTo(106, 52);
  c.closePath();
  c.fillStyle = linear(c, 22, 0, 106, 0, [[0, "#d89a5a"], [0.5, "#b0703a"], [1, "#6a3a18"]]);
  c.fill();
  c.stroke();
  c.lineWidth = 4;
  for (const y of [72, 100]) {
    c.beginPath();
    c.moveTo(26 + (y - 52) * 0.15, y);
    c.quadraticCurveTo(64, y + 8, 102 - (y - 52) * 0.15, y);
    c.strokeStyle = "#5a5f6a";
    c.stroke();
  }
  c.strokeStyle = INK;
  c.lineWidth = 5;
  c.beginPath();
  c.ellipse(64, 52, 42, 12, 0, 0, Math.PI * 2);
  c.fillStyle = radial(c, 58, 50, 40, [[0, "#e8fbff"], [0.5, "#6ad0ff"], [1, "#1a6ac8"]]);
  c.fill();
  c.stroke();
  c.fillStyle = "rgba(255,255,255,0.85)";
  c.beginPath();
  c.ellipse(52, 48, 10, 3, -0.2, 0, Math.PI * 2);
  c.fill();
}

function beachBall(c: Ctx): void {
  const [x, y, r] = [64, 64, 54];
  const cols = ["#ff5a5a", "#ffffff", "#3a8ad8", "#ffffff", "#ffd23f", "#ffffff"];
  for (let i = 0; i < 6; i++) {
    c.beginPath();
    c.moveTo(x, y);
    c.arc(x, y, r, (i / 6) * Math.PI * 2, ((i + 1) / 6) * Math.PI * 2);
    c.closePath();
    c.fillStyle = cols[i];
    c.fill();
  }
  c.fillStyle = radial(c, x - 18, y - 20, r * 1.3, [[0, "rgba(255,255,255,0.55)"], [0.4, "rgba(255,255,255,0)"], [1, "rgba(0,0,30,0.35)"]]);
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.stroke();
  c.beginPath();
  c.arc(x, y, 9, 0, Math.PI * 2);
  c.fillStyle = "#ffffff";
  c.fill();
  c.lineWidth = 4;
  c.stroke();
}

export function makeBeastTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "beast_bucket", 128, 132, bucket);
  canvasTexture(scene, "beast_ball", 128, 128, beachBall);
  canvasTexture(scene, "cage_back", 600, 620, cageBack);
  canvasTexture(scene, "cage_front", 600, 620, cageFront);
  canvasTexture(scene, "cage_base2", 660, 260, cageBase);
  canvasTexture(scene, "cage_runes", 660, 200, runes);
  canvasTexture(scene, "cage_bar", 40, 180, flyingBar);
  canvasTexture(scene, "toxic_fog", 512, 512, (c) => toxicFog(c, 11, ["rgba(90,30,130,0.55)", "rgba(60,20,90,0.6)", "rgba(110,160,60,0.3)", "rgba(130,60,170,0.45)"]));
  canvasTexture(scene, "toxic_fog2", 512, 512, (c) => toxicFog(c, 47, ["rgba(150,220,90,0.35)", "rgba(120,50,170,0.4)", "rgba(80,30,110,0.35)"]));
  canvasTexture(scene, "toxic_cloud", 280, 190, (c) => toxicCloud(c));
  canvasTexture(scene, "toxic_cloud2", 280, 190, (c) => toxicCloud(c, false));
  canvasTexture(scene, "toxic_puddle", 220, 100, toxicPuddle);
  canvasTexture(scene, "toxic_bubble", 40, 40, toxicBubble);
}
