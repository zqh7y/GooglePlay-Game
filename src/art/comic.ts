import Phaser from "phaser";
import { INK, Ctx, canvasTexture } from "./draw";

/** Comic-book hit effects: a spiky starburst ("POW!" goes on top) and a little cartoon star. */
export function makeComicTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "comic_burst", 240, 200, (c) => {
    const spikes = 12;
    const shape = (rOut: number, rIn: number) => {
      c.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? rIn : rOut * (0.85 + 0.15 * ((i * 7) % 3) / 2);
        c.lineTo(120 + Math.cos(a) * r * 1.15, 100 + Math.sin(a) * r * 0.95);
      }
      c.closePath();
    };
    shape(96, 62);
    c.fillStyle = "#ff3b3b";
    c.fill();
    c.lineWidth = 8;
    c.strokeStyle = "#1a1030";
    c.stroke();
    shape(72, 48);
    c.fillStyle = "#ffe066";
    c.fill();
  });
  canvasTexture(scene, "comic_star", 64, 64, (c) => {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 12 : 28;
      c.lineTo(32 + Math.cos(a) * r, 33 + Math.sin(a) * r);
    }
    c.closePath();
    c.fillStyle = "#ffe066";
    c.fill();
    c.lineWidth = 5;
    c.strokeStyle = "#1a1030";
    c.stroke();
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.beginPath();
    c.arc(26, 26, 5, 0, Math.PI * 2);
    c.fill();
  });
}

/** The manga close-ups of you (your box face, eyes in the dark band): shocked, determined, scared, happy. */
export type ComicMood = "shock" | "determined" | "scared" | "happy";

export function makeComicFaces(scene: Phaser.Scene): void {
  for (const mood of ["shock", "determined", "scared", "happy"] as ComicMood[]) canvasTexture(scene, `comic_face_${mood}`, 600, 600, (c) => comicFace(c, mood));
}

function comicFace(c: Ctx, mood: ComicMood): void {
  c.lineJoin = "round";
  c.lineCap = "round";
  const shape = (pts: [number, number][], fill: string | CanvasGradient, w = 10) => {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = w;
    c.strokeStyle = INK;
    c.stroke();
  };
  const grad = (y0: number, y1: number, a: string, b: string) => {
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
  };
  // the open top (dark inside) and the two flaps sticking up
  shape([[60, 170], [110, 128], [585, 128], [540, 170]], "#2a1608");
  shape([[62, 168], [24, 62], [262, 44], [292, 158]], grad(44, 168, "#d8a56a", "#a8743a"));
  shape([[318, 158], [352, 40], [578, 70], [540, 168]], grad(40, 168, "#c8955a", "#9a6a34"));
  // the side (in shadow) and the front
  shape([[540, 170], [585, 128], [585, 620], [540, 620]], grad(128, 600, "#b8844a", "#6a4420"));
  shape([[60, 170], [540, 170], [540, 620], [60, 620]], grad(170, 600, "#e0ae72", "#b07c42"));
  // cardboard: tape down the middle, creases, "this way up" arrows
  c.fillStyle = "rgba(240,220,170,0.75)";
  c.fillRect(270, 170, 60, 90);
  c.strokeStyle = "rgba(120,80,40,0.35)";
  c.lineWidth = 4;
  for (const [x0, y0, x1, y1] of [[90, 470, 160, 520], [470, 200, 520, 240], [440, 520, 520, 560]]) {
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }
  c.strokeStyle = "rgba(70,40,20,0.6)";
  c.lineWidth = 7;
  for (const x of [110, 150]) {
    c.beginPath();
    c.moveTo(x, 580);
    c.lineTo(x, 520);
    c.moveTo(x - 14, 536);
    c.lineTo(x, 520);
    c.lineTo(x + 14, 536);
    c.stroke();
  }
  // the dark band your eyes shine through
  c.beginPath();
  c.roundRect(105, 280, 390, 140, 34);
  c.fillStyle = "#170e12";
  c.fill();
  c.lineWidth = 10;
  c.strokeStyle = INK;
  c.stroke();
  const glow = (x: number, y: number, r: number) => {
    const g = c.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  };
  const eyes: [number, number][] = [[215, 350], [385, 350]];
  for (const [x, y] of eyes) glow(x, y, 90);
  c.fillStyle = "#ffffff";
  c.strokeStyle = "#ffffff";
  if (mood === "shock") {
    for (const [x, y] of eyes) {
      c.beginPath();
      c.arc(x, y, 48, 0, Math.PI * 2);
      c.fillStyle = "#ffffff";
      c.fill();
      c.beginPath();
      c.arc(x, y, 11, 0, Math.PI * 2);
      c.fillStyle = "#170e12";
      c.fill();
    }
  } else if (mood === "determined") {
    for (const [x, y] of eyes) {
      const d = x < 300 ? 1 : -1;
      c.beginPath();
      c.moveTo(x - 50, y - 18 * d - 8);
      c.lineTo(x + 50, y + 18 * d - 8);
      c.lineTo(x + 46, y + 30);
      c.quadraticCurveTo(x, y + 44, x - 46, y + 30);
      c.closePath();
      c.fillStyle = "#ffffff";
      c.fill();
    }
  } else if (mood === "scared") {
    for (const [x, y] of eyes) {
      c.beginPath();
      for (let i = 0; i <= 24; i++) {
        const t = (i / 24) * Math.PI * 2;
        const r = 38 + Math.sin(t * 6) * 3;
        c.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r * 1.15);
      }
      c.fillStyle = "#ffffff";
      c.fill();
      c.beginPath();
      c.arc(x + 4, y + 8, 8, 0, Math.PI * 2);
      c.fillStyle = "#170e12";
      c.fill();
    }
    // a tear running down
    c.fillStyle = "#8ad8ff";
    c.beginPath();
    c.moveTo(395, 425);
    c.quadraticCurveTo(420, 470, 400, 488);
    c.quadraticCurveTo(378, 470, 395, 425);
    c.fill();
    c.lineWidth = 5;
    c.strokeStyle = INK;
    c.stroke();
  } else {
    c.lineWidth = 20;
    c.strokeStyle = "#ffffff";
    for (const [x, y] of eyes) {
      c.beginPath();
      c.arc(x, y + 22, 40, Math.PI * 1.15, Math.PI * 1.85);
      c.stroke();
    }
    c.fillStyle = "rgba(255,110,140,0.55)";
    for (const x of [170, 430]) {
      c.beginPath();
      c.ellipse(x, 470, 46, 22, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  // a sweat drop when things look bad
  if (mood === "shock" || mood === "scared") {
    c.fillStyle = "#8ad8ff";
    c.beginPath();
    c.moveTo(500, 200);
    c.quadraticCurveTo(540, 262, 510, 280);
    c.quadraticCurveTo(478, 262, 500, 200);
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = INK;
    c.stroke();
  }
}
