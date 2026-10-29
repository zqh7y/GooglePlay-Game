import Phaser from "phaser";
import { Ctx, INK, canvasTexture, celShape, circle, ellipse, fillOutline, linear, outline, radial, rgba, lighten, darken, twinkle } from "./draw";

/**
 * Boss attack art: what the boss throws at you (cartoon objects with ink outlines), the warnings
 * on the ground (glowing zones that fill up, lanes with arrows) and what happens when they hit
 * (bolts, splats, blasts, spikes, ice). Warnings and beams are white so they can be tinted.
 */

// ───────────────────────── warnings ─────────────────────────

/** A danger zone: soft glow getting stronger toward a thick rim, with arrows pointing in. */
function warnDisc(c: Ctx): void {
  const R = 124;
  c.translate(128, 128);
  circle(c, 0, 0, R);
  c.fillStyle = radial(c, 0, 0, R, [[0, "rgba(255,255,255,0.05)"], [0.6, "rgba(255,255,255,0.16)"], [0.92, "rgba(255,255,255,0.42)"], [1, "rgba(255,255,255,0.5)"]]);
  c.fill();
  circle(c, 0, 0, R - 6);
  c.lineWidth = 10;
  c.strokeStyle = "rgba(255,255,255,0.95)";
  c.stroke();
  // a dark edge so it reads on bright ground
  circle(c, 0, 0, R - 1);
  c.lineWidth = 3;
  c.strokeStyle = "rgba(40,20,10,0.55)";
  c.stroke();
  circle(c, 0, 0, R - 12);
  c.lineWidth = 2;
  c.strokeStyle = "rgba(40,20,10,0.35)";
  c.stroke();
  for (let k = 0; k < 8; k++) {
    c.save();
    c.rotate((k / 8) * Math.PI * 2);
    c.beginPath();
    c.moveTo(R - 22, -14);
    c.lineTo(R - 44, 0);
    c.lineTo(R - 22, 14);
    c.lineWidth = 8;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.stroke();
    c.restore();
  }
}

/** A dashed ring that turns over the zone. */
function warnDash(c: Ctx): void {
  c.translate(128, 128);
  for (let k = 0; k < 16; k++) {
    c.beginPath();
    const a = (k / 16) * Math.PI * 2;
    c.arc(0, 0, 100, a, a + 0.22);
    c.lineWidth = 7;
    c.lineCap = "round";
    c.strokeStyle = "#ffffff";
    c.stroke();
  }
}

/** The glow that fills a zone until it hits. */
function warnFill(c: Ctx): void {
  circle(c, 128, 128, 124);
  c.fillStyle = radial(c, 128, 128, 124, [[0, "rgba(255,255,255,0.55)"], [0.7, "rgba(255,255,255,0.4)"], [1, "rgba(255,255,255,0.85)"]]);
  c.fill();
}

/** A lane: bright edges, a faint inside and arrows along it (pointing right). */
function warnLane(c: Ctx): void {
  const [w, h] = [512, 96];
  c.fillStyle = linear(c, 0, 0, 0, h, [[0, "rgba(255,255,255,0.55)"], [0.12, "rgba(255,255,255,0.22)"], [0.5, "rgba(255,255,255,0.12)"], [0.88, "rgba(255,255,255,0.22)"], [1, "rgba(255,255,255,0.55)"]]);
  c.fillRect(0, 0, w, h);
  c.fillStyle = "#ffffff";
  c.fillRect(0, 2, w, 6);
  c.fillRect(0, h - 8, w, 6);
  c.fillStyle = "rgba(40,20,10,0.5)";
  c.fillRect(0, 0, w, 2);
  c.fillRect(0, h - 2, w, 2);
  for (let x = 30; x < w; x += 64) {
    c.beginPath();
    c.moveTo(x, h / 2 - 22);
    c.lineTo(x + 24, h / 2);
    c.lineTo(x, h / 2 + 22);
    c.lineWidth = 9;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = "rgba(255,255,255,0.85)";
    c.stroke();
  }
}

/** A cone (pointing right), for breath attacks. */
function warnCone(c: Ctx): void {
  const [w, h] = [512, 400];
  c.beginPath();
  c.moveTo(0, h / 2);
  c.lineTo(w, 0);
  c.quadraticCurveTo(w + 30, h / 2, w, h);
  c.closePath();
  c.fillStyle = linear(c, 0, 0, w, 0, [[0, "rgba(255,255,255,0.1)"], [1, "rgba(255,255,255,0.45)"]]);
  c.fill();
  c.lineWidth = 10;
  c.strokeStyle = "rgba(255,255,255,0.9)";
  c.stroke();
  c.lineWidth = 3;
  c.strokeStyle = "rgba(40,20,10,0.5)";
  c.stroke();
  for (let x = 90; x < w; x += 90) {
    c.beginPath();
    c.moveTo(x, h / 2 - 20);
    c.lineTo(x + 22, h / 2);
    c.lineTo(x, h / 2 + 20);
    c.lineWidth = 9;
    c.lineCap = "round";
    c.strokeStyle = "rgba(255,255,255,0.85)";
    c.stroke();
  }
}

// ───────────────────────── beams and hits ─────────────────────────

/** A beam: glow fading out to both sides of a bright core. Stretched along x. */
function beam(c: Ctx): void {
  c.fillStyle = linear(c, 0, 0, 0, 64, [[0, "rgba(255,255,255,0)"], [0.25, "rgba(255,255,255,0.45)"], [0.42, "rgba(255,255,255,0.95)"], [0.58, "rgba(255,255,255,0.95)"], [0.75, "rgba(255,255,255,0.45)"], [1, "rgba(255,255,255,0)"]]);
  c.fillRect(0, 0, 64, 64);
}

/** A lightning bolt from the sky (the bottom touches the ground). */
function bolt(c: Ctx): void {
  const pts: [number, number][] = [[70, 0]];
  let x = 70;
  for (let y = 60; y < 680; y += 60) {
    x = 70 + (Math.random() - 0.5) * 70;
    pts.push([x, y]);
  }
  pts.push([70, 700]);
  const path = () => {
    c.beginPath();
    pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
  };
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const [w, col] of [[44, "rgba(255,240,140,0.25)"], [26, "rgba(255,240,140,0.6)"], [14, "#fff6b0"], [6, "#ffffff"]] as const) {
    path();
    c.lineWidth = w;
    c.strokeStyle = col;
    c.stroke();
  }
  // a few side forks
  for (let k = 2; k < pts.length - 2; k += 3) {
    const [px, py] = pts[k];
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(px + (k % 2 ? 50 : -50), py + 40);
    c.lineTo(px + (k % 2 ? 70 : -70), py + 90);
    c.lineWidth = 6;
    c.strokeStyle = "#fff6b0";
    c.stroke();
  }
}

/** A goo splat on the ground (white, tinted). */
function splat(c: Ctx): void {
  c.translate(128, 100);
  c.beginPath();
  const n = 14;
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const r = (k % 2 ? 70 : 95) + Math.sin(k * 2.3) * 12;
    const [x, y] = [Math.cos(a) * r, Math.sin(a) * r * 0.55];
    if (k === 0) c.moveTo(x, y);
    else c.quadraticCurveTo(Math.cos(a - Math.PI / n) * r * 1.25, Math.sin(a - Math.PI / n) * r * 0.7, x, y);
  }
  c.closePath();
  c.fillStyle = radial(c, -10, -10, 110, [[0, "#ffffff"], [0.7, "#e6e6e6"], [1, "#c8c8c8"]]);
  c.fill();
  c.lineWidth = 6;
  c.strokeStyle = "rgba(60,40,30,0.55)";
  c.stroke();
  for (const [x, y, r] of [[-110, -40, 12], [112, 30, 10], [60, -62, 9], [-70, 55, 11]] as const) {
    ellipse(c, x, y, r, r * 0.7);
    c.fillStyle = "#e6e6e6";
    c.fill();
  }
  ellipse(c, -30, -18, 26, 10, -0.3);
  c.fillStyle = "rgba(255,255,255,0.9)";
  c.fill();
}

/** A cartoon explosion: spiky star of fire with an ink outline. */
function blast(c: Ctx): void {
  c.translate(128, 128);
  const spikes = (r1: number, r2: number, n: number) => {
    c.beginPath();
    for (let k = 0; k < n * 2; k++) {
      const a = (k / (n * 2)) * Math.PI * 2;
      const r = k % 2 ? r2 : r1 * (0.85 + ((k * 7) % 5) * 0.05);
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
  };
  spikes(122, 78, 11);
  fillOutline(c, "#ff6a2a", 7);
  spikes(92, 58, 9);
  c.fillStyle = "#ffb03b";
  c.fill();
  circle(c, 0, 0, 48);
  c.fillStyle = radial(c, 0, 0, 48, [[0, "#ffffff"], [0.5, "#fff6a8"], [1, "#ffd23f"]]);
  c.fill();
}

/** Spikes bursting out of the ground: rock, root or ice. */
function spikes(kind: "rock" | "root" | "ice") {
  return (c: Ctx) => {
    const [base, dark] = kind === "rock" ? ["#b8a28a", "#7a644e"] : kind === "root" ? ["#8a6a3a", "#5a4020"] : ["#bff0ff", "#5ab8e8"];
    const list: [number, number, number][] = [[-56, 70, 26], [52, 80, 28], [0, 130, 36], [-26, 95, 24], [30, 105, 26]];
    c.translate(110, 168);
    for (const [x, h, w] of list.sort((a, b) => a[1] - b[1])) {
      const path = () => {
        c.beginPath();
        c.moveTo(x - w, 0);
        if (kind === "root") {
          c.quadraticCurveTo(x - w * 0.6, -h * 0.6, x + w * 0.2, -h);
          c.quadraticCurveTo(x + w * 0.4, -h * 0.5, x + w, 0);
        } else {
          c.lineTo(x - w * 0.15, -h);
          c.lineTo(x + w * 0.25, -h * 0.92);
          c.lineTo(x + w, 0);
        }
        c.closePath();
      };
      celShape(c, path, base, dark, w, () => {
        if (kind === "ice") {
          c.beginPath();
          c.moveTo(x - w * 0.4, -10);
          c.lineTo(x - w * 0.1, -h * 0.8);
          c.lineWidth = 5;
          c.strokeStyle = "rgba(255,255,255,0.9)";
          c.stroke();
        } else if (kind === "root") {
          for (let k = 1; k < 4; k++) {
            c.beginPath();
            c.moveTo(x - w * 0.5, -h * k * 0.22);
            c.lineTo(x + w * 0.4, -h * k * 0.22 - 6);
            c.lineWidth = 3;
            c.strokeStyle = "rgba(40,24,10,0.5)";
            c.stroke();
          }
        }
      }, 5);
    }
    ellipse(c, 0, 0, 100, 16);
    c.fillStyle = kind === "ice" ? "rgba(200,240,255,0.8)" : "rgba(90,64,40,0.7)";
    c.fill();
  };
}

/** A scorch mark left on the ground. */
function scorch(c: Ctx): void {
  ellipse(c, 128, 64, 120, 56);
  c.fillStyle = radial(c, 128, 64, 120, [[0, "rgba(30,20,15,0.65)"], [0.6, "rgba(40,28,20,0.35)"], [1, "rgba(40,28,20,0)"]]);
  c.fill();
}

/** A ring of dust and air for stomps (white, tinted). */
function shock(c: Ctx): void {
  c.translate(128, 128);
  for (const [r, w, a] of [[110, 22, 0.35], [104, 10, 0.9], [90, 5, 0.6]] as const) {
    circle(c, 0, 0, r);
    c.lineWidth = w;
    c.strokeStyle = `rgba(255,255,255,${a})`;
    c.stroke();
  }
}

/** A dirt mound for burrowing bosses. */
function mound(c: Ctx): void {
  ellipse(c, 90, 60, 82, 34);
  fillOutline(c, linear(c, 0, 26, 0, 94, [[0, "#c8a878"], [1, "#7a5a32"]]), 5);
  for (const [x, y, r] of [[60, 50, 9], [110, 44, 7], [92, 70, 8], [130, 62, 6]] as const) {
    circle(c, x, y, r);
    c.fillStyle = "#6a4a28";
    c.fill();
  }
}

/** A wind swirl for spinning bosses (white, tinted). */
function whirl(c: Ctx): void {
  c.translate(128, 128);
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    c.arc(0, 0, 110 - k * 22, k * 2.1, k * 2.1 + Math.PI * 1.1);
    c.lineWidth = 14 - k * 3;
    c.lineCap = "round";
    c.strokeStyle = `rgba(255,255,255,${0.85 - k * 0.2})`;
    c.stroke();
  }
}

// ───────────────────────── what bosses throw ─────────────────────────

/** A glowing magic orb in a colour (cached per colour). */
export function orbTexture(scene: Phaser.Scene, color: number): string {
  return canvasTexture(scene, `bp_orb_${color.toString(16)}`, 96, 96, (c) => {
    circle(c, 48, 48, 46);
    c.fillStyle = radial(c, 48, 48, 46, [[0, rgba(lighten(color, 0.5), 0.9)], [0.55, rgba(color, 0.45)], [1, rgba(color, 0)]]);
    c.fill();
    circle(c, 48, 48, 24);
    c.fillStyle = radial(c, 42, 40, 26, [[0, "#ffffff"], [0.45, rgba(lighten(color, 0.55))], [1, rgba(color)]]);
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = rgba(darken(color, 0.45));
    c.stroke();
    ellipse(c, 40, 39, 8, 5, -0.6);
    c.fillStyle = "rgba(255,255,255,0.95)";
    c.fill();
  });
}

function goo(c: Ctx): void {
  c.translate(48, 52);
  const path = () => {
    c.beginPath();
    c.moveTo(0, -40);
    c.bezierCurveTo(26, -10, 36, 8, 30, 22);
    c.bezierCurveTo(22, 40, -22, 40, -30, 22);
    c.bezierCurveTo(-36, 8, -26, -10, 0, -40);
    c.closePath();
  };
  celShape(c, path, "#8af06a", "#4fae3a", 36, () => {
    ellipse(c, -10, 4, 9, 13, -0.4);
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.fill();
    circle(c, 10, 18, 4);
    c.fill();
  });
}

function spore(c: Ctx): void {
  c.translate(44, 44);
  const path = () => {
    c.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      c.arc(Math.cos(a) * 24, Math.sin(a) * 24, 14, a - 1.4, a + 1.4);
    }
    c.closePath();
  };
  celShape(c, path, "#ff7a8a", "#c8434f", 34, () => {
    for (const [x, y, r] of [[-10, -8, 6], [10, 4, 5], [-4, 14, 4], [14, -14, 4]] as const) {
      circle(c, x, y, r);
      c.fillStyle = "#fff0e0";
      c.fill();
    }
  });
}

function bat(up: boolean) {
  return (c: Ctx) => {
    c.translate(64, 44);
    const wing = (s: number) => {
      c.beginPath();
      c.moveTo(s * 12, 0);
      if (up) {
        c.quadraticCurveTo(s * 34, -40, s * 58, -30);
        c.quadraticCurveTo(s * 48, -18, s * 54, -6);
        c.quadraticCurveTo(s * 40, -10, s * 36, 4);
        c.quadraticCurveTo(s * 26, -2, s * 12, 8);
      } else {
        c.quadraticCurveTo(s * 34, 6, s * 58, 30);
        c.quadraticCurveTo(s * 44, 26, s * 40, 36);
        c.quadraticCurveTo(s * 32, 24, s * 24, 30);
        c.quadraticCurveTo(s * 20, 16, s * 12, 10);
      }
      c.closePath();
      fillOutline(c, "#6a3ab0", 4);
    };
    wing(-1);
    wing(1);
    ellipse(c, 0, 4, 18, 20);
    fillOutline(c, "#8a5ad0", 4);
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 6, -12);
      c.lineTo(s * 14, -26);
      c.lineTo(s * 16, -10);
      fillOutline(c, "#8a5ad0", 3);
      circle(c, s * 7, 0, 4);
      c.fillStyle = "#ffe066";
      c.fill();
    }
  };
}

function crow(c: Ctx): void {
  c.translate(66, 40);
  // diving to the right
  c.beginPath();
  c.moveTo(-60, -26);
  c.quadraticCurveTo(-20, -10, 0, -4);
  c.quadraticCurveTo(-30, -30, -40, -34);
  c.closePath();
  fillOutline(c, "#2a2a3a", 4);
  ellipse(c, 0, 4, 34, 16);
  fillOutline(c, "#33334a", 4);
  c.beginPath();
  c.moveTo(-34, 6);
  c.lineTo(-62, 0);
  c.lineTo(-60, 16);
  c.closePath();
  fillOutline(c, "#2a2a3a", 4);
  circle(c, 30, -2, 14);
  fillOutline(c, "#33334a", 4);
  c.beginPath();
  c.moveTo(40, -6);
  c.lineTo(62, 2);
  c.lineTo(40, 6);
  c.closePath();
  fillOutline(c, "#ffb03b", 3);
  circle(c, 32, -5, 4);
  c.fillStyle = "#ff3a3a";
  c.fill();
}

function hay(c: Ctx): void {
  c.translate(64, 64);
  circle(c, 0, 0, 56);
  fillOutline(c, radial(c, -14, -14, 70, [[0, "#ffe9a0"], [1, "#d8a83a"]]), 6);
  c.lineWidth = 4;
  c.strokeStyle = "#a87a20";
  c.beginPath();
  for (let a = 0; a < Math.PI * 9; a += 0.2) {
    const r = 4 + a * 1.8;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.stroke();
  for (const a of [0.7, 2.6]) {
    c.beginPath();
    c.arc(0, 0, 56, a, a + 0.5);
    c.lineWidth = 10;
    c.strokeStyle = "#c8432a";
    c.stroke();
  }
}

function pumpkin(c: Ctx): void {
  c.translate(50, 56);
  for (const [x, w] of [[-18, 22], [18, 22], [0, 24]] as const) {
    ellipse(c, x, 4, w, 32);
    fillOutline(c, radial(c, x - 6, -6, 34, [[0, "#ffb060"], [1, "#e86a1a"]]), 4);
  }
  c.beginPath();
  c.moveTo(-2, -26);
  c.quadraticCurveTo(0, -40, 8, -44);
  c.lineWidth = 7;
  c.strokeStyle = INK;
  c.stroke();
  twinkle(c, 10, -46, 9, "#ffe066");
  // a grinning face
  c.fillStyle = "#3a1a0a";
  for (const s of [-1, 1]) {
    c.beginPath();
    c.moveTo(s * 14, -6);
    c.lineTo(s * 6, 4);
    c.lineTo(s * 20, 4);
    c.fill();
  }
  c.beginPath();
  c.moveTo(-16, 14);
  c.quadraticCurveTo(0, 26, 16, 14);
  c.quadraticCurveTo(0, 20, -16, 14);
  c.fill();
}

function boulder(c: Ctx): void {
  c.translate(70, 66);
  const path = () => {
    c.beginPath();
    c.moveTo(-58, 10);
    c.lineTo(-46, -36);
    c.lineTo(-8, -56);
    c.lineTo(38, -44);
    c.lineTo(60, -6);
    c.lineTo(50, 38);
    c.lineTo(6, 56);
    c.lineTo(-40, 46);
    c.closePath();
  };
  celShape(c, path, "#a8a090", "#6e6658", 56, () => {
    ellipse(c, -16, -40, 30, 12, -0.3);
    c.fillStyle = "#6fae4a";
    c.fill();
    c.beginPath();
    c.moveTo(-10, 0);
    c.lineTo(10, 14);
    c.lineTo(4, 34);
    c.lineWidth = 4;
    c.strokeStyle = "rgba(60,50,40,0.6)";
    c.stroke();
  }, 6);
}

function thorn(c: Ctx): void {
  c.beginPath();
  c.moveTo(4, 5);
  c.lineTo(86, 13);
  c.lineTo(4, 21);
  c.quadraticCurveTo(12, 13, 4, 5);
  c.closePath();
  fillOutline(c, linear(c, 0, 5, 0, 21, [[0, "#e0ffb0"], [0.5, "#8ae05a"], [1, "#3a8a2a"]]), 3);
}

function sting(c: Ctx): void {
  ellipse(c, 56, 20, 52, 16);
  c.fillStyle = radial(c, 80, 20, 60, [[0, "rgba(255,240,180,0.9)"], [1, "rgba(255,170,40,0)"]]);
  c.fill();
  c.beginPath();
  c.moveTo(18, 12);
  c.lineTo(104, 20);
  c.lineTo(18, 28);
  c.quadraticCurveTo(28, 20, 18, 12);
  c.closePath();
  fillOutline(c, linear(c, 18, 0, 104, 0, [[0, "#ffb03b"], [1, "#fff3c0"]]), 3);
}

function snowball(c: Ctx): void {
  circle(c, 56, 56, 50);
  fillOutline(c, radial(c, 40, 38, 70, [[0, "#ffffff"], [0.7, "#e6f4ff"], [1, "#a8d0f0"]]), 6);
  for (const [x, y, r] of [[30, 66, 6], [70, 40, 5], [64, 78, 7]] as const) {
    circle(c, x, y, r);
    c.fillStyle = "rgba(150,190,230,0.6)";
    c.fill();
  }
}

function sand(c: Ctx): void {
  c.translate(36, 36);
  const path = () => {
    c.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const r = k % 2 ? 22 : 30;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
  };
  celShape(c, path, "#f0c880", "#b8884a", 30);
}

function icicle(c: Ctx): void {
  const path = () => {
    c.beginPath();
    c.moveTo(6, 6);
    c.lineTo(44, 6);
    c.lineTo(28, 144);
    c.lineTo(24, 144);
    c.closePath();
  };
  celShape(c, path, "#d8f6ff", "#6ac0ec", 20, () => {
    c.beginPath();
    c.moveTo(16, 14);
    c.lineTo(24, 110);
    c.lineWidth = 4;
    c.strokeStyle = "rgba(255,255,255,0.95)";
    c.stroke();
  }, 4);
}

// ───────────────────────── hits and attacks ─────────────────────────

/** A sharp white 4-point hit star with a soft glow (tinted per attack). */
function hitStar(c: Ctx): void {
  c.translate(64, 64);
  c.fillStyle = radial(c, 0, 0, 60, [[0, "rgba(255,255,255,0.9)"], [0.35, "rgba(255,255,255,0.35)"], [1, "rgba(255,255,255,0)"]]);
  c.beginPath();
  c.arc(0, 0, 60, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#ffffff";
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 ? 9 : i % 4 === 0 ? 58 : 34;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
}

/** A crescent slash (white, tinted). */
function slash(c: Ctx): void {
  c.translate(80, 80);
  c.beginPath();
  c.arc(0, 0, 70, -2.4, 0.6);
  c.arc(-10, 12, 56, 0.6, -2.4, true);
  c.closePath();
  c.fillStyle = linear(c, -70, -40, 60, 40, [[0, "rgba(255,255,255,0)"], [0.6, "rgba(255,255,255,0.9)"], [1, "#ffffff"]]);
  c.fill();
}

/** A thin bright ring (white, tinted) for muzzle flashes and pops. */
function thinRing(c: Ctx): void {
  c.translate(64, 64);
  for (const [w, a] of [[14, 0.25], [6, 0.9]] as [number, number][]) {
    c.beginPath();
    c.arc(0, 0, 54, 0, Math.PI * 2);
    c.lineWidth = w;
    c.strokeStyle = `rgba(255,255,255,${a})`;
    c.stroke();
  }
}

/** A soft round smoke puff with a shaded bottom. */
function smoke(c: Ctx): void {
  for (const [x, y, r] of [[48, 56, 30], [76, 50, 34], [100, 60, 26], [70, 72, 30]] as [number, number, number][]) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = radial(c, x - r * 0.3, y - r * 0.4, r * 1.3, [[0, "rgba(255,255,255,0.95)"], [0.7, "rgba(200,200,210,0.85)"], [1, "rgba(150,150,170,0)"]]);
    c.fill();
  }
}

export function makeBossFxTextures(scene: Phaser.Scene): void {
  const art: [string, number, number, (c: Ctx) => void][] = [
    ["bx_warn", 256, 256, warnDisc],
    ["bx_dash", 256, 256, warnDash],
    ["bx_fill", 256, 256, warnFill],
    ["bx_lane", 512, 96, warnLane],
    ["bx_cone", 560, 400, warnCone],
    ["bx_beam", 64, 64, beam],
    ["bx_bolt", 140, 700, bolt],
    ["bx_splat", 256, 200, splat],
    ["bx_blast", 256, 256, blast],
    ["bx_spike_rock", 220, 180, spikes("rock")],
    ["bx_spike_root", 220, 180, spikes("root")],
    ["bx_spike_ice", 220, 180, spikes("ice")],
    ["bx_scorch", 256, 128, scorch],
    ["bx_shock", 256, 256, shock],
    ["bx_mound", 180, 110, mound],
    ["bx_whirl", 256, 256, whirl],
    ["bp_goo", 96, 100, goo],
    ["bp_spore", 88, 88, spore],
    ["bp_bat0", 128, 88, bat(true)],
    ["bp_bat1", 128, 88, bat(false)],
    ["bp_crow", 132, 80, crow],
    ["bp_hay", 128, 128, hay],
    ["bp_pumpkin", 100, 100, pumpkin],
    ["bp_boulder", 140, 132, boulder],
    ["bp_thorn", 90, 26, thorn],
    ["bp_sting", 110, 40, sting],
    ["bp_snow", 112, 112, snowball],
    ["bp_sand", 72, 72, sand],
    ["bp_icicle", 50, 150, icicle],
    ["fx_star", 128, 128, hitStar],
    ["fx_slash", 160, 160, slash],
    ["fx_ring", 128, 128, thinRing],
    ["fx_smoke", 140, 110, smoke],
  ];
  for (const [key, w, h, draw] of art) canvasTexture(scene, key, w, h, draw);
  void outline;
}
