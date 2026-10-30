import Phaser from "phaser";
import { INK, Ctx, canvasTexture, rr } from "./draw";

type Pt = [number, number];

/** A filled polygon with the ink outline. */
export function poly(c: Ctx, pts: Pt[], fill: string | CanvasGradient, stroke = true): void {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) c.stroke();
}

export function lin(c: Ctx, x0: number, y0: number, x1: number, y1: number, colors: string[]): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  colors.forEach((col, i) => g.addColorStop(i / (colors.length - 1), col));
  return g;
}

/** A soft dark shadow on the ground under a building. */
export function groundShadow(c: Ctx, x: number, y: number, rx: number, ry: number): void {
  const g = c.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, "rgba(20,10,20,0.45)");
  g.addColorStop(1, "rgba(20,10,20,0)");
  c.save();
  c.scale(1, ry / rx);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, (y * rx) / ry, rx, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** A window set into a wall (a dark frame, warm glass, a sill with a top face), skewed for side walls. */
function windowLit(c: Ctx, x: number, y: number, w: number, h: number, skew = 0): void {
  const at = (dx: number, dy: number): Pt => [x + dx, y + dy + (dx / w) * skew];
  poly(c, [at(-6, -6), at(w + 6, -6), at(w + 6, h + 6), at(-6, h + 6)], "#5a3a22");
  const g = c.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#fff4b8");
  g.addColorStop(0.5, "#ffc84a");
  g.addColorStop(1, "#e8862a");
  poly(c, [at(0, 0), at(w, 0), at(w, h), at(0, h)], g, false);
  // the inner shadow along the top and left: the glass sits back in the wall
  poly(c, [at(0, 0), at(w, 0), at(w, 6), at(6, 6), at(6, h), at(0, h)], "rgba(90,40,0,0.45)", false);
  c.save();
  c.lineWidth = 4;
  c.beginPath();
  const [m1, m2] = [at(w / 2, 0), at(w / 2, h)];
  const [m3, m4] = [at(0, h / 2), at(w, h / 2)];
  c.moveTo(m1[0], m1[1]);
  c.lineTo(m2[0], m2[1]);
  c.moveTo(m3[0], m3[1]);
  c.lineTo(m4[0], m4[1]);
  c.strokeStyle = "#5a3a22";
  c.stroke();
  c.restore();
  poly(c, [at(-10, h + 4), at(w + 10, h + 4), at(w + 6, h + 14), at(-6, h + 14)], lin(c, 0, y + h, 0, y + h + 14, ["#e8d8c0", "#a89478"]));
}

/** Rows of roof tiles on a roof plane (lines parallel to the eave). */
function tileRows(c: Ctx, a: Pt, b: Pt, e1: Pt, e2: Pt, rows: number, color: string): void {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = 3;
  for (let i = 1; i < rows; i++) {
    const t = i / rows;
    c.beginPath();
    c.moveTo(a[0] + (e1[0] - a[0]) * t, a[1] + (e1[1] - a[1]) * t);
    c.lineTo(b[0] + (e2[0] - b[0]) * t, b[1] + (e2[1] - b[1]) * t);
    c.stroke();
  }
  c.restore();
}

function house3d(c: Ctx, roof: string, roofDark: string): void {
  c.lineJoin = "round";
  c.lineWidth = 5;
  c.strokeStyle = INK;
  groundShadow(c, 220, 432, 210, 34);
  // the long side wall, going back to the right (in shade)
  poly(c, [[250, 240], [395, 186], [395, 384], [250, 436]], lin(c, 250, 0, 395, 0, ["#b8a68c", "#8e7c66"]));
  // stone footing along the bottom of both walls
  poly(c, [[250, 410], [395, 360], [395, 384], [250, 436]], "#7a6a5a");
  windowLit(c, 285, 268, 42, 50, -16);
  windowLit(c, 345, 248, 34, 46, -12);
  // the gable wall facing you: plaster lit from the left, timber frame
  poly(c, [[44, 240], [146, 132], [250, 240], [250, 436], [44, 436]], lin(c, 44, 140, 250, 436, ["#fff3dc", "#e8d4b4", "#cdb594"]));
  poly(c, [[44, 410], [250, 410], [250, 436], [44, 436]], "#8a7a68");
  c.save();
  c.strokeStyle = "#7a4a2a";
  c.lineWidth = 9;
  c.beginPath();
  c.moveTo(48, 246);
  c.lineTo(246, 246);
  c.moveTo(146, 140);
  c.lineTo(146, 246);
  c.stroke();
  c.restore();
  // an attic window up in the gable and two windows below
  windowLit(c, 128, 178, 36, 40);
  windowLit(c, 66, 280, 46, 54);
  // the door: a frame, planks and a step
  poly(c, [[160, 436], [160, 318], [236, 318], [236, 436]], "#5a3a22");
  poly(c, [[168, 436], [168, 326], [228, 326], [228, 436]], lin(c, 168, 0, 228, 0, ["#b8743e", "#8a5228", "#6a3a18"]));
  c.save();
  c.strokeStyle = "rgba(60,30,10,0.5)";
  c.lineWidth = 3;
  for (const x of [188, 208]) {
    c.beginPath();
    c.moveTo(x, 330);
    c.lineTo(x, 434);
    c.stroke();
  }
  c.restore();
  c.fillStyle = "#ffe066";
  c.beginPath();
  c.arc(218, 384, 5, 0, Math.PI * 2);
  c.fill();
  poly(c, [[150, 436], [246, 436], [252, 450], [144, 450]], lin(c, 0, 436, 0, 450, ["#cfc2ae", "#8e8070"]));
  // the roof: the long plane catching light, its thick eave edge, and the barge board on the gable
  const ridgeA: Pt = [146, 112];
  const ridgeB: Pt = [292, 58];
  const eaveA: Pt = [268, 250];
  const eaveB: Pt = [414, 196];
  poly(c, [ridgeA, ridgeB, eaveB, eaveA], lin(c, 200, 70, 340, 230, [roof, roof, roofDark]));
  tileRows(c, ridgeA, ridgeB, eaveA, eaveB, 6, "rgba(0,0,0,0.22)");
  poly(c, [eaveA, eaveB, [414, 210], [268, 264]], roofDark);
  poly(c, [[26, 250], ridgeA, [146, 132], [44, 240]], roofDark);
  poly(c, [ridgeA, eaveA, [268, 264], [252, 256], [146, 132]], lin(c, 146, 120, 268, 260, [roof, roofDark]));
  // ridge cap
  c.save();
  c.lineWidth = 12;
  c.strokeStyle = roofDark;
  c.beginPath();
  c.moveTo(ridgeA[0], ridgeA[1]);
  c.lineTo(ridgeB[0], ridgeB[1]);
  c.stroke();
  c.restore();
  // a chimney with a lit front and a shaded side, sitting on the roof
  poly(c, [[300, 54], [326, 44], [326, 128], [300, 140]], lin(c, 0, 40, 0, 140, ["#a89888", "#7a6a5a"]));
  poly(c, [[276, 62], [300, 54], [300, 140], [276, 148]], lin(c, 276, 0, 300, 0, ["#d8c8b4", "#b8a690"]));
  // its top: a lit rim round a sooty opening
  poly(c, [[276, 62], [300, 54], [326, 44], [302, 52]], "#e8dccb");
  poly(c, [[284, 60], [300, 55], [318, 47], [302, 52]], "#2a2024", false);
}

function ruin3d(c: Ctx): void {
  c.lineJoin = "round";
  c.lineWidth = 5;
  c.strokeStyle = INK;
  groundShadow(c, 270, 470, 260, 36);
  // the side wall going back, broken off along the top
  poly(c, [[300, 260], [470, 196], [490, 250], [470, 300], [500, 330], [500, 400], [300, 476]], lin(c, 300, 0, 500, 0, ["#7a6e66", "#5a504a"]));
  windowLit(c, 350, 300, 40, 46, -14);
  c.fillStyle = "rgba(20,12,16,0.85)";
  c.fillRect(354, 296, 34, 44);
  // the front wall, jagged where it fell in, black with soot
  poly(c, [[50, 476], [50, 260], [96, 210], [130, 250], [176, 180], [214, 236], [256, 214], [300, 260], [300, 476]],
    lin(c, 50, 180, 300, 476, ["#a89a8c", "#857868", "#5e544c"]));
  const soot = c.createRadialGradient(170, 300, 10, 170, 300, 150);
  soot.addColorStop(0, "rgba(20,12,12,0.6)");
  soot.addColorStop(1, "rgba(20,12,12,0)");
  c.fillStyle = soot;
  c.fillRect(50, 180, 250, 296);
  // stone courses
  c.save();
  c.strokeStyle = "rgba(40,30,30,0.35)";
  c.lineWidth = 3;
  for (let y = 300; y < 470; y += 34) {
    c.beginPath();
    c.moveTo(54, y);
    c.lineTo(296, y);
    c.stroke();
  }
  c.restore();
  // a dark doorway with no door, and an empty window
  poly(c, [[136, 476], [136, 360], [214, 360], [214, 476]], "#1e1418");
  poly(c, [[136, 360], [214, 360], [214, 372], [148, 372], [148, 476], [136, 476]], "rgba(0,0,0,0.5)", false);
  poly(c, [[70, 290], [114, 290], [114, 340], [70, 340]], "#1e1418");
  // charred roof beams leaning in, round and burnt at the ends
  for (const [x0, y0, x1, y1] of [[70, 250], [300, 120]].map(([a, b], i) => (i === 0 ? [a, b, 320, 110] : [250, 140, 480, 290]))) {
    c.save();
    c.lineCap = "round";
    c.strokeStyle = INK;
    c.lineWidth = 30;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    c.strokeStyle = "#3a2820";
    c.lineWidth = 20;
    c.stroke();
    c.strokeStyle = "#6a4a38";
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(x0, y0 - 5);
    c.lineTo(x1, y1 - 5);
    c.stroke();
    // embers still glowing along the wood
    c.strokeStyle = "rgba(255,120,40,0.85)";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(x0 + (x1 - x0) * 0.35, y0 + (y1 - y0) * 0.35 + 3);
    c.lineTo(x0 + (x1 - x0) * 0.5, y0 + (y1 - y0) * 0.5 + 3);
    c.stroke();
    c.restore();
  }
  // a few tiles still hanging on
  for (const [x, y, a] of [[150, 170, -0.5], [196, 150, -0.45], [430, 250, 0.6]]) {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    poly(c, [[-30, -12], [30, -12], [30, 8], [-30, 8]], "#a8483a");
    poly(c, [[-30, 8], [30, 8], [30, 14], [-30, 14]], "#6a2a20");
    c.restore();
  }
  // rubble heaped in front: rocks with a lit top
  for (const [x, y, r] of [[80, 470, 34], [146, 482, 24], [300, 476, 42], [372, 470, 26], [470, 440, 32], [226, 486, 20]]) {
    c.beginPath();
    c.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2);
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, 2, x, y, r);
    g.addColorStop(0, "#b8ac9c");
    g.addColorStop(1, "#5e544a");
    c.fillStyle = g;
    c.fill();
    c.stroke();
  }
}

function gate3d(c: Ctx): void {
  c.lineJoin = "round";
  c.lineWidth = 5;
  c.strokeStyle = INK;
  // two round posts (lit on the left, shade on the right), with a stone foot
  for (const x of [60, 800]) {
    groundShadow(c, x + 22, 428, 60, 12);
    poly(c, [[x, 70], [x + 44, 70], [x + 44, 420], [x, 420]], lin(c, x, 0, x + 44, 0, ["#c08048", "#8a5228", "#4a2810"]));
    poly(c, [[x - 10, 392], [x + 54, 392], [x + 54, 428], [x - 10, 428]], lin(c, x - 10, 0, x + 54, 0, ["#cfc2ae", "#8e8070"]));
  }
  // the beam: a lit top face and a front face
  poly(c, [[16, 40], [880, 40], [868, 28], [28, 28]], "#e0a06a");
  poly(c, [[16, 40], [880, 40], [880, 88], [16, 88]], lin(c, 0, 40, 0, 88, ["#b8743e", "#7a4420"]));
  // the sign board with its thickness along the bottom and right
  poly(c, [[250, 82], [650, 82], [650, 192], [250, 192]], lin(c, 250, 82, 650, 192, ["#e8b07a", "#c8884e"]));
  poly(c, [[250, 192], [650, 192], [660, 202], [258, 202]], "#7a4420");
  poly(c, [[650, 82], [660, 92], [660, 202], [650, 192]], "#8a5228");
  // hanging lanterns
  for (const x of [160, 740]) {
    c.beginPath();
    c.moveTo(x, 88);
    c.lineTo(x, 118);
    c.stroke();
    const g = c.createRadialGradient(x - 4, 146, 3, x, 148, 30);
    g.addColorStop(0, "#fffbe0");
    g.addColorStop(0.5, "#ffd24a");
    g.addColorStop(1, "#d8701a");
    poly(c, [[x - 20, 122], [x + 20, 122], [x + 20, 174], [x - 20, 174]], g);
    poly(c, [[x - 24, 116], [x + 24, 116], [x + 20, 124], [x - 20, 124]], "#3a2a20");
    poly(c, [[x - 24, 174], [x + 24, 174], [x + 20, 182], [x - 20, 182]], "#3a2a20");
  }
}

function torch3d(c: Ctx): void {
  c.lineJoin = "round";
  c.lineWidth = 5;
  c.strokeStyle = INK;
  groundShadow(c, 55, 232, 40, 9);
  // the post: round, lit from the left, with iron bands
  poly(c, [[44, 74], [66, 74], [70, 234], [40, 234]], lin(c, 40, 0, 70, 0, ["#c08048", "#8a5228", "#4a2810"]));
  for (const y of [120, 180]) poly(c, [[42, y], [68, y], [68, y + 9], [42, y + 9]], lin(c, 42, 0, 68, 0, ["#9aa0aa", "#4a505a"]));
  // the fire bowl: iron, with its round rim and the coals glowing inside
  c.beginPath();
  c.moveTo(10, 46);
  c.quadraticCurveTo(14, 92, 55, 96);
  c.quadraticCurveTo(96, 92, 100, 46);
  c.closePath();
  c.fillStyle = lin(c, 10, 0, 100, 0, ["#8a909a", "#4a505a", "#22262c"]);
  c.fill();
  c.stroke();
  c.beginPath();
  c.ellipse(55, 46, 45, 14, 0, 0, Math.PI * 2);
  c.fillStyle = "#3a3e46";
  c.fill();
  c.stroke();
  const coals = c.createRadialGradient(55, 46, 2, 55, 46, 40);
  coals.addColorStop(0, "#fff3a0");
  coals.addColorStop(0.4, "#ff9a2a");
  coals.addColorStop(1, "#8a2a10");
  c.beginPath();
  c.ellipse(55, 47, 36, 9, 0, 0, Math.PI * 2);
  c.fillStyle = coals;
  c.fill();
  // a rim of light on the bowl from the fire
  c.save();
  c.strokeStyle = "rgba(255,200,120,0.7)";
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(55, 46, 45, 14, 0, Math.PI * 0.05, Math.PI * 0.95);
  c.stroke();
  c.restore();
}

/**
 * Pictures for the story stages: the soft light that cuts through the night, the dirt path through
 * the woods, the village at its end (cottages with warm windows, a gate), the two burnt-out
 * buildings in the village square, the hand lantern you find, and the beach, the sea and a pier.
 */
export function makeStoryTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("night_light")) return;
  // a round light, solid in the middle and fading out (cut out of the darkness)
  canvasTexture(scene, "night_light", 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.85)");
    g.addColorStop(0.75, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
  // a warm glow drawn on top of a light (lanterns and torches tint the ground orange)
  canvasTexture(scene, "warm_glow", 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,190,90,0.55)");
    g.addColorStop(0.5, "rgba(255,150,60,0.2)");
    g.addColorStop(1, "rgba(255,120,40,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });

  // the dirt path: packed earth with ruts, pebbles and soft grassy edges (tiles up and down)
  canvasTexture(scene, "path_dirt", 420, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 420, 0);
    g.addColorStop(0, "rgba(160,120,70,0)");
    g.addColorStop(0.08, "rgba(170,128,76,0.85)");
    g.addColorStop(0.2, "#b8895a");
    g.addColorStop(0.5, "#c49766");
    g.addColorStop(0.8, "#b8895a");
    g.addColorStop(0.92, "rgba(170,128,76,0.85)");
    g.addColorStop(1, "rgba(160,120,70,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 420, 512);
    // two wheel ruts
    for (const x of [150, 270]) {
      c.fillStyle = "rgba(120,84,50,0.35)";
      c.fillRect(x - 12, 0, 24, 512);
      c.fillStyle = "rgba(230,190,140,0.25)";
      c.fillRect(x + 12, 0, 5, 512);
    }
    // pebbles and little cracks (kept away from the top and bottom so the tile repeats cleanly)
    let s = 3;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 46; i++) {
      const x = 50 + r() * 320;
      const y = 14 + r() * 484;
      const rad = 3 + r() * 7;
      c.fillStyle = r() < 0.5 ? "#8a6a48" : "#d8b88a";
      c.beginPath();
      c.ellipse(x, y, rad, rad * 0.7, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = "rgba(110,76,44,0.4)";
    c.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const x = 70 + r() * 280;
      const y = 40 + r() * 430;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 14 - r() * 28, y + 18);
      c.lineTo(x + 6 - r() * 12, y + 34);
      c.stroke();
    }
  });

  // a cottage in 3/4 view: the gable end faces you, the long side runs back to the right
  for (const [key, roof, roofDark] of [["house_a", "#d8573e", "#8e2e20"], ["house_b", "#4f84d0", "#26508e"]] as const) {
    canvasTexture(scene, key, 440, 460, (c) => house3d(c, roof, roofDark));
  }
  // a burnt-out building: the same kind of house, broken open, charred and caved in
  canvasTexture(scene, "ruin", 560, 500, (c) => ruin3d(c));
  // the village gate: two round posts, a beam with a top face and a thick sign board
  canvasTexture(scene, "gate", 900, 440, (c) => gate3d(c));
  // a torch: a round wooden post with an iron fire bowl full of glowing coals
  canvasTexture(scene, "torch3d", 110, 240, (c) => torch3d(c));

  // the lantern you find on the path: a brass lamp with glass sides and a warm flame
  canvasTexture(scene, "lantern", 90, 130, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 5;
    c.strokeStyle = INK;
    c.beginPath();
    c.arc(45, 26, 16, Math.PI, 0);
    c.stroke();
    // brass cap with a top face
    poly(c, [[18, 34], [72, 34], [66, 46], [24, 46]], lin(c, 18, 0, 72, 0, ["#ffe08a", "#c8902e", "#8a5a1a"]));
    // glass: lit from inside, darker at the far edge
    const g = c.createRadialGradient(40, 76, 4, 45, 78, 34);
    g.addColorStop(0, "#fffbe0");
    g.addColorStop(0.45, "#ffd24a");
    g.addColorStop(1, "#d8701a");
    poly(c, [[24, 46], [66, 46], [66, 106], [24, 106]], g);
    // the side panel in shadow and the brass corner bars
    poly(c, [[56, 46], [66, 46], [66, 106], [56, 106]], "rgba(120,50,0,0.35)", false);
    for (const x of [24, 45, 66]) poly(c, [[x - 3, 46], [x + 3, 46], [x + 3, 106], [x - 3, 106]], lin(c, x - 3, 0, x + 3, 0, ["#ffe08a", "#8a5a1a"]));
    poly(c, [[14, 104], [76, 104], [70, 122], [20, 122]], lin(c, 14, 0, 76, 0, ["#ffe08a", "#c8902e", "#7a4a12"]));
  });
  // a cobbled street (tiles both ways): rounded stones with a lit top edge and dark joints
  canvasTexture(scene, "cobble", 160, 160, (c) => {
    c.fillStyle = "#6e665e";
    c.fillRect(0, 0, 160, 160);
    let sd = 5;
    const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const x = col * 32 + (row % 2) * 16 + 2;
        const y = row * 32 + 2;
        for (const dx of [0, -160, 160]) {
          const g = c.createLinearGradient(0, y, 0, y + 28);
          const tone = 150 + Math.floor(r() * 40);
          g.addColorStop(0, `rgb(${tone + 30},${tone + 24},${tone + 14})`);
          g.addColorStop(1, `rgb(${tone - 30},${tone - 34},${tone - 40})`);
          c.fillStyle = g;
          rr(c, x + dx, y, 28, 28, 8);
          c.fill();
        }
      }
    }
  });
  // a flame (it flickers by scaling): orange outside, yellow and white inside
  canvasTexture(scene, "flame", 64, 96, (c) => {
    const shape = (w: number, top: number, col: string) => {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(32, top);
      c.bezierCurveTo(32 + w, 40, 32 + w * 1.1, 70, 32, 94);
      c.bezierCurveTo(32 - w * 1.1, 70, 32 - w, 40, 32, top);
      c.fill();
    };
    shape(28, 2, "#ff6a1a");
    shape(20, 22, "#ffb52a");
    shape(11, 44, "#fff3b0");
  });
  // a campfire: crossed logs round a ring of stones
  canvasTexture(scene, "campfire", 220, 120, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 5;
    c.strokeStyle = INK;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const [x, y] = [110 + Math.cos(a) * 92, 80 + Math.sin(a) * 30];
      c.beginPath();
      c.ellipse(x, y, 20, 13, 0, 0, Math.PI * 2);
      c.fillStyle = lin(c, 0, y - 13, 0, y + 13, ["#c8beb0", "#7a7064"]);
      c.fill();
      c.stroke();
    }
    for (const [x0, y0, x1, y1] of [[50, 95, 170, 60], [50, 60, 170, 95], [110, 50, 110, 104]]) {
      c.save();
      c.lineCap = "round";
      c.lineWidth = 26;
      c.strokeStyle = INK;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
      c.lineWidth = 17;
      c.strokeStyle = "#8a5228";
      c.stroke();
      c.restore();
    }
    const g = c.createRadialGradient(110, 78, 2, 110, 78, 40);
    g.addColorStop(0, "rgba(255,240,160,0.9)");
    g.addColorStop(1, "rgba(255,120,40,0)");
    c.fillStyle = g;
    c.fillRect(60, 40, 100, 80);
  });

  // beach sand and the sea (both tile)
  canvasTexture(scene, "sand_tile", 256, 256, (c) => {
    c.fillStyle = "#f0d8a0";
    c.fillRect(0, 0, 256, 256);
    let s = 9;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      c.fillStyle = r() < 0.5 ? "rgba(200,160,100,0.45)" : "rgba(255,240,200,0.6)";
      c.beginPath();
      c.arc(8 + r() * 240, 8 + r() * 240, 2 + r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  });
  canvasTexture(scene, "sea_tile", 256, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#2a6ac8");
    g.addColorStop(1, "#3a8ae0");
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = "rgba(255,255,255,0.55)";
    c.lineWidth = 6;
    c.lineCap = "round";
    for (const [x, y] of [[30, 40], [150, 90], [60, 170], [190, 210], [110, 240]]) {
      c.beginPath();
      c.arc(x, y, 20, Math.PI * 1.1, Math.PI * 1.9);
      c.arc(x + 36, y, 20, Math.PI * 1.1, Math.PI * 1.9);
      c.stroke();
    }
  });
  // the white foam where the waves meet the sand
  canvasTexture(scene, "foam", 256, 60, (c) => {
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.beginPath();
    c.moveTo(0, 0);
    for (let x = 0; x <= 256; x += 32) c.quadraticCurveTo(x + 16, 48, x + 32, 14);
    c.lineTo(256, 0);
    c.closePath();
    c.fill();
  });
  // a wooden pier out into the sea: planks with a lit top and a dark front edge, round posts
  canvasTexture(scene, "pier", 240, 780, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 5;
    c.strokeStyle = INK;
    for (const x of [20, 196]) poly(c, [[x, 0], [x + 24, 0], [x + 24, 780], [x, 780]], lin(c, x, 0, x + 24, 0, ["#8a5a32", "#5a3418", "#3a200c"]));
    for (let y = 8; y < 760; y += 44) {
      poly(c, [[10, y], [226, y], [226, y + 30], [10, y + 30]], lin(c, 0, y, 0, y + 30, ["#e0b07a", "#b8824e"]));
      poly(c, [[10, y + 30], [226, y + 30], [226, y + 40], [10, y + 40]], "#6a4022");
    }
  });

}
