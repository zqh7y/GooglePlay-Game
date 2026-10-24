import Phaser from "phaser";
import { Ctx, canvasTexture, circle, ellipse, linear, radial, rr } from "./draw";

const INK = "#2a1c1c";

/** Fill a path with a paint, then outline it in ink. */
function shape(c: Ctx, path: () => void, paint: string | CanvasGradient, lw = 4): void {
  c.beginPath();
  path();
  c.fillStyle = paint;
  c.fill();
  c.lineWidth = lw;
  c.lineJoin = "round";
  c.strokeStyle = INK;
  c.stroke();
}

function shine(c: Ctx, x: number, y: number, rx: number, ry: number): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, -0.5, 0, Math.PI * 2);
  c.fillStyle = "rgba(255,255,255,0.55)";
  c.fill();
}

/** Every gadget picture: `gd_<kind>` (the icons, and what flies), plus the glue puddle, popcorn kernel and black hole. */
const ART: Record<string, [number, number, (c: Ctx) => void]> = {
  // a four-pointed throwing star with a hole in the middle
  shuriken: [72, 72, (c) => {
    shape(c, () => {
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 4;
        const r = i % 2 ? 12 : 32;
        const x = 36 + Math.cos(a) * r;
        const y = 36 + Math.sin(a) * r;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.closePath();
    }, linear(c, 0, 4, 0, 68, [[0, "#f4f8ff"], [1, "#8a98b0"]]));
    shape(c, () => circle(c, 36, 36, 7), "#3a3a4a", 3);
  }],
  // a little blue ghost flame with eyes
  wisp: [72, 84, (c) => {
    shape(c, () => {
      c.moveTo(36, 6);
      c.bezierCurveTo(52, 22, 64, 40, 62, 56);
      c.quadraticCurveTo(58, 78, 36, 79);
      c.quadraticCurveTo(14, 78, 10, 56);
      c.bezierCurveTo(8, 42, 22, 34, 26, 20);
      c.quadraticCurveTo(32, 26, 36, 6);
      c.closePath();
    }, linear(c, 0, 6, 0, 80, [[0, "#e8fbff"], [0.5, "#7ee0ff"], [1, "#3a9aff"]]));
    for (const x of [28, 44]) shape(c, () => ellipse(c, x, 56, 4.5, 6.5), "#1a2a4a", 2);
    shine(c, 24, 42, 6, 3);
  }],
  // a big soap bubble with a rainbow sheen
  bubble: [84, 84, (c) => {
    circle(c, 42, 42, 36);
    c.fillStyle = radial(c, 42, 42, 36, [[0, "rgba(200,240,255,0.15)"], [0.75, "rgba(170,220,255,0.35)"], [1, "rgba(255,170,240,0.75)"]]);
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = "rgba(42,28,28,0.75)";
    c.stroke();
    shine(c, 30, 26, 10, 5);
    shine(c, 56, 60, 4, 2.5);
  }],
  // a squeezy glue bottle (the gadget's icon)
  glue: [64, 88, (c) => {
    shape(c, () => {
      c.moveTo(30, 4);
      c.lineTo(34, 4);
      c.lineTo(38, 22);
      c.lineTo(26, 22);
      c.closePath();
    }, "#ff8a3a", 3);
    shape(c, () => rr(c, 12, 22, 40, 62, 12), linear(c, 0, 22, 0, 84, [[0, "#ffffff"], [1, "#dfe8f0"]]));
    shape(c, () => rr(c, 16, 40, 32, 22, 5), "#5ac8ff", 3);
    shape(c, () => ellipse(c, 32, 51, 7, 5), "#ffffff", 2);
    shine(c, 22, 34, 4, 8);
  }],
  // a sticky glue puddle lying on the ground
  puddle: [220, 120, (c) => {
    c.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = 1 + Math.sin(i * 2.7) * 0.08;
      const x = 110 + Math.cos(a) * 100 * r;
      const y = 60 + Math.sin(a) * 50 * r;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.closePath();
    c.fillStyle = radial(c, 110, 60, 100, [[0, "rgba(255,255,255,0.85)"], [1, "rgba(200,225,240,0.75)"]]);
    c.fill();
    c.lineWidth = 5;
    c.strokeStyle = "rgba(42,28,28,0.5)";
    c.stroke();
    for (const [x, y, r] of [[80, 50, 9], [130, 66, 7], [150, 44, 5]]) shine(c, x, y, r, r * 0.5);
  }],
  // a diamond kite with a bow tail
  kite: [96, 120, (c) => {
    c.beginPath();
    c.moveTo(48, 92);
    c.bezierCurveTo(30, 100, 60, 106, 40, 116);
    c.lineWidth = 3;
    c.strokeStyle = INK;
    c.stroke();
    for (const [x, y] of [[40, 102], [46, 114]]) shape(c, () => c.ellipse(x, y, 7, 4, 0.4, 0, Math.PI * 2), "#ff5a6a", 2);
    shape(c, () => {
      c.moveTo(48, 4);
      c.lineTo(88, 44);
      c.lineTo(48, 92);
      c.lineTo(8, 44);
      c.closePath();
    }, linear(c, 0, 4, 0, 92, [[0, "#ffe066"], [1, "#ff9a2a"]]));
    c.beginPath();
    c.moveTo(48, 4);
    c.lineTo(48, 92);
    c.moveTo(8, 44);
    c.lineTo(88, 44);
    c.lineWidth = 3;
    c.strokeStyle = "rgba(42,28,28,0.6)";
    c.stroke();
    // a lightning bolt painted on it
    shape(c, () => {
      c.moveTo(54, 20);
      c.lineTo(38, 48);
      c.lineTo(50, 48);
      c.lineTo(42, 72);
      c.lineTo(60, 40);
      c.lineTo(48, 40);
      c.closePath();
    }, "#ffffff", 2.5);
  }],
  // a striped bucket of popcorn (the gadget's icon)
  popcorn: [80, 88, (c) => {
    for (const [x, y, r] of [[22, 30, 12], [40, 22, 14], [58, 30, 12], [30, 14, 10], [52, 14, 10]]) shape(c, () => circle(c, x, y, r), "#fff6d8", 3);
    shape(c, () => {
      c.moveTo(10, 34);
      c.lineTo(70, 34);
      c.lineTo(62, 84);
      c.lineTo(18, 84);
      c.closePath();
    }, "#ffffff");
    c.save();
    c.beginPath();
    c.moveTo(10, 34);
    c.lineTo(70, 34);
    c.lineTo(62, 84);
    c.lineTo(18, 84);
    c.closePath();
    c.clip();
    c.fillStyle = "#ff4a5a";
    for (let x = 14; x < 70; x += 16) c.fillRect(x, 30, 8, 60);
    c.restore();
    c.beginPath();
    c.moveTo(10, 34);
    c.lineTo(70, 34);
    c.lineTo(62, 84);
    c.lineTo(18, 84);
    c.closePath();
    c.lineWidth = 4;
    c.strokeStyle = INK;
    c.stroke();
  }],
  // one popped kernel
  kernel: [40, 36, (c) => {
    for (const [x, y, r] of [[14, 20, 9], [24, 14, 10], [27, 24, 8]]) shape(c, () => circle(c, x, y, r), "#fff6d8", 2.5);
    shape(c, () => ellipse(c, 22, 22, 4, 3), "#ffb03a", 1.5);
  }],
  // a yellow V boomerang
  boomerang: [84, 84, (c) => {
    shape(c, () => {
      c.moveTo(10, 20);
      c.quadraticCurveTo(14, 8, 26, 12);
      c.lineTo(44, 50);
      c.lineTo(72, 30);
      c.quadraticCurveTo(82, 32, 76, 44);
      c.lineTo(44, 74);
      c.quadraticCurveTo(36, 76, 32, 68);
      c.closePath();
    }, linear(c, 0, 8, 0, 76, [[0, "#fff27a"], [1, "#ffa62e"]]));
    c.strokeStyle = "#e85a3a";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(22, 22);
    c.lineTo(38, 56);
    c.lineTo(66, 38);
    c.stroke();
  }],
  // a cartoon grenade with its pin
  grenade: [62, 74, (c) => {
    c.strokeStyle = INK;
    c.lineWidth = 3.5;
    c.beginPath();
    c.arc(46, 14, 8, 0, Math.PI * 2);
    c.stroke();
    shape(c, () => c.roundRect(22, 10, 18, 12, 3), "#8a94a8", 3);
    shape(c, () => ellipse(c, 31, 46, 23, 25), linear(c, 0, 20, 0, 72, [[0, "#8ae66a"], [1, "#3f8a3a"]]));
    c.strokeStyle = "rgba(20,60,20,0.5)";
    c.lineWidth = 3;
    for (const x of [24, 38]) {
      c.beginPath();
      c.moveTo(x, 24);
      c.lineTo(x, 68);
      c.stroke();
    }
    shine(c, 22, 38, 6, 4);
  }],
  // a black hole: a swirl of purple around a dark middle
  hole: [150, 150, (c) => {
    const g = radial(c, 75, 75, 74, [[0, "rgba(10,0,30,1)"], [0.35, "rgba(40,10,90,0.95)"], [0.7, "rgba(160,90,255,0.55)"], [1, "rgba(160,90,255,0)"]]);
    c.fillStyle = g;
    c.fillRect(0, 0, 150, 150);
    c.strokeStyle = "rgba(220,190,255,0.8)";
    c.lineWidth = 4;
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      for (let i = 0; i <= 30; i++) {
        const a = k * ((Math.PI * 2) / 3) + i * 0.16;
        const r = 18 + i * 1.7;
        const x = 75 + Math.cos(a) * r;
        const y = 75 + Math.sin(a) * r;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      c.stroke();
    }
  }],
};

export function makeGadgetTextures(scene: Phaser.Scene): void {
  for (const [id, [w, h, draw]] of Object.entries(ART)) canvasTexture(scene, `gd_${id}`, w, h, draw);
}
