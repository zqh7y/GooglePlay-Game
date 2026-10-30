import Phaser from "phaser";
import { INK, Ctx, canvasTexture } from "./draw";
import { pose, squash } from "./pose";

/**
 * The sea stage: the octopus (a monster with walk frames: its tentacles curl in turn), a whale that
 * bursts out of the water, a tentacle that slams up, your little boat, a sandy island to shelter on
 * from the tsunami, and the tsunami's breaking wave.
 */
export function octopus(body: string, dark: string): (c: Ctx) => void {
  return (c) => {
    c.lineJoin = "round";
    c.lineCap = "round";
    // the shadow on the water
    c.fillStyle = "rgba(10,30,60,0.25)";
    c.beginPath();
    c.ellipse(75, 140, 52, 9, 0, 0, Math.PI * 2);
    c.fill();
    squash(c, 75, 138, () => {
      // six tentacles, curling in turn with the walk pose
      for (let i = 0; i < 6; i++) {
        const x0 = 38 + i * 15;
        const curl = ((i % 2 ? 1 : -1) * (pose.leg || 0.4) + (i - 2.5) * 0.25) * 18;
        c.strokeStyle = INK;
        c.lineWidth = 17;
        c.beginPath();
        c.moveTo(x0, 96);
        c.quadraticCurveTo(x0 + curl, 122, x0 + curl * 1.6, 136);
        c.stroke();
        c.strokeStyle = body;
        c.lineWidth = 11;
        c.stroke();
        c.fillStyle = "rgba(255,230,240,0.8)";
        for (const k of [0.45, 0.75]) {
          c.beginPath();
          c.arc(x0 + curl * k * 1.3, 96 + 40 * k, 2.4, 0, Math.PI * 2);
          c.fill();
        }
      }
      // the head: a round dome, lit from the top left
      const g = c.createRadialGradient(60, 46, 6, 75, 66, 52);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.18, body);
      g.addColorStop(1, dark);
      c.fillStyle = g;
      c.strokeStyle = INK;
      c.lineWidth = 6;
      c.beginPath();
      c.ellipse(75, 66, 44, 42, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      // spots, angry eyes and brows
      c.fillStyle = "rgba(255,255,255,0.25)";
      for (const [x, y, r] of [[96, 46, 6], [104, 62, 4], [52, 40, 4]]) {
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
      for (const x of [60, 90]) {
        c.fillStyle = "#ffffff";
        c.beginPath();
        c.ellipse(x, 76, 11, 13, 0, 0, Math.PI * 2);
        c.fill();
        c.lineWidth = 4;
        c.stroke();
        c.fillStyle = "#1a1030";
        c.beginPath();
        c.arc(x + 2, 79, 6, 0, Math.PI * 2);
        c.fill();
      }
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(48, 60);
      c.lineTo(68, 66);
      c.moveTo(102, 60);
      c.lineTo(82, 66);
      c.stroke();
    });
  };
}

export function makeSeaTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("sea_boat")) return;
  // the mode's icon: a whale's tail over a wave
  canvasTexture(scene, "mode_sea", 128, 128, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 6;
    c.strokeStyle = INK;
    const g = c.createLinearGradient(0, 8, 0, 120);
    g.addColorStop(0, "#8fd8ff");
    g.addColorStop(1, "#2a6ac8");
    c.fillStyle = g;
    c.beginPath();
    c.arc(64, 64, 56, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#2a4a9a";
    c.beginPath();
    c.moveTo(64, 86);
    c.quadraticCurveTo(60, 52, 36, 34);
    c.quadraticCurveTo(58, 40, 64, 56);
    c.quadraticCurveTo(70, 40, 92, 34);
    c.quadraticCurveTo(68, 52, 64, 86);
    c.fill();
    c.stroke();
    c.strokeStyle = "#ffffff";
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(16, 90);
    for (let x = 16; x < 112; x += 24) c.quadraticCurveTo(x + 12, 78, x + 24, 90);
    c.stroke();
  });
  // your boat: a little wooden rowing boat seen from above and a bit behind
  canvasTexture(scene, "sea_boat", 220, 130, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 6;
    c.strokeStyle = INK;
    c.fillStyle = "rgba(10,30,60,0.3)";
    c.beginPath();
    c.ellipse(110, 104, 100, 18, 0, 0, Math.PI * 2);
    c.fill();
    const hull = c.createLinearGradient(0, 40, 0, 110);
    hull.addColorStop(0, "#c8823e");
    hull.addColorStop(1, "#6a3a18");
    c.fillStyle = hull;
    c.beginPath();
    c.moveTo(12, 56);
    c.quadraticCurveTo(110, 40, 208, 56);
    c.quadraticCurveTo(190, 104, 110, 106);
    c.quadraticCurveTo(30, 104, 12, 56);
    c.closePath();
    c.fill();
    c.stroke();
    // the inside, the seat and a stripe
    c.fillStyle = "#8a5228";
    c.beginPath();
    c.ellipse(110, 58, 84, 14, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#e8b878";
    c.fillRect(96, 46, 28, 22);
    c.strokeRect(96, 46, 28, 22);
    c.strokeStyle = "#ffffff";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(30, 76);
    c.quadraticCurveTo(110, 92, 190, 76);
    c.stroke();
  });
  // a whale bursting up: a big blue body, white belly, open mouth
  canvasTexture(scene, "sea_whale", 520, 300, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 8;
    c.strokeStyle = INK;
    const g = c.createLinearGradient(0, 30, 0, 260);
    g.addColorStop(0, "#5a9ae8");
    g.addColorStop(1, "#2a4a9a");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(40, 170);
    c.bezierCurveTo(40, 60, 200, 30, 330, 50);
    c.bezierCurveTo(430, 66, 470, 120, 460, 170);
    c.bezierCurveTo(450, 230, 330, 260, 220, 256);
    c.bezierCurveTo(120, 252, 40, 230, 40, 170);
    c.closePath();
    c.fill();
    c.stroke();
    // the tail flukes
    c.beginPath();
    c.moveTo(450, 140);
    c.lineTo(510, 90);
    c.lineTo(500, 150);
    c.lineTo(512, 210);
    c.closePath();
    c.fill();
    c.stroke();
    // belly stripes
    c.fillStyle = "#e8f2ff";
    c.beginPath();
    c.moveTo(60, 200);
    c.bezierCurveTo(140, 250, 300, 250, 420, 200);
    c.bezierCurveTo(330, 236, 150, 238, 60, 200);
    c.closePath();
    c.fill();
    c.stroke();
    // the open mouth and an angry eye
    c.fillStyle = "#3a0a1a";
    c.beginPath();
    c.moveTo(44, 170);
    c.quadraticCurveTo(120, 200, 200, 176);
    c.quadraticCurveTo(120, 230, 50, 200);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.ellipse(170, 120, 18, 20, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#1a1030";
    c.beginPath();
    c.arc(166, 124, 9, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(140, 92);
    c.lineTo(190, 104);
    c.stroke();
  });
  // a tentacle slamming up out of the water
  canvasTexture(scene, "sea_tentacle", 120, 300, (c) => {
    c.lineJoin = "round";
    c.lineCap = "round";
    c.strokeStyle = INK;
    c.lineWidth = 40;
    c.beginPath();
    c.moveTo(60, 296);
    c.bezierCurveTo(20, 220, 100, 140, 60, 70);
    c.quadraticCurveTo(40, 30, 76, 20);
    c.stroke();
    c.strokeStyle = "#b04aa0";
    c.lineWidth = 30;
    c.stroke();
    c.fillStyle = "#ffd8f0";
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.arc(66 + Math.sin(i) * 14, 270 - i * 40, 6, 0, Math.PI * 2);
      c.fill();
    }
  });
  // a sandy island with a palm, safe from the tsunami
  canvasTexture(scene, "sea_island", 340, 260, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 6;
    c.strokeStyle = INK;
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.beginPath();
    c.ellipse(170, 196, 160, 52, 0, 0, Math.PI * 2);
    c.fill();
    const g = c.createRadialGradient(150, 176, 10, 170, 196, 140);
    g.addColorStop(0, "#fff0c0");
    g.addColorStop(1, "#d8b070");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(170, 192, 140, 44, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // palm trunk and leaves
    c.strokeStyle = INK;
    c.lineWidth = 16;
    c.beginPath();
    c.moveTo(180, 190);
    c.quadraticCurveTo(170, 120, 196, 50);
    c.stroke();
    c.strokeStyle = "#8a5a32";
    c.lineWidth = 9;
    c.stroke();
    c.fillStyle = "#4ac85a";
    c.strokeStyle = INK;
    c.lineWidth = 5;
    for (const a of [-2.6, -1.9, -1.2, -0.5, 0.2]) {
      c.beginPath();
      c.moveTo(196, 50);
      c.quadraticCurveTo(196 + Math.cos(a) * 60, 30 + Math.sin(a) * 50, 196 + Math.cos(a) * 100, 60 + Math.sin(a) * 40);
      c.quadraticCurveTo(196 + Math.cos(a) * 50, 60 + Math.sin(a) * 20, 196, 54);
      c.fill();
      c.stroke();
    }
  });
  // the tsunami's breaking crest (it tiles sideways)
  canvasTexture(scene, "sea_wave", 256, 220, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 220);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.25, "#bfe8ff");
    g.addColorStop(0.6, "#3a8ae0");
    g.addColorStop(1, "rgba(30,90,200,0)");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 220);
    c.lineTo(0, 70);
    for (let x = 0; x <= 256; x += 64) c.quadraticCurveTo(x + 32, -10, x + 64, 70);
    c.lineTo(256, 220);
    c.closePath();
    c.fill();
    c.fillStyle = "rgba(255,255,255,0.9)";
    for (let x = 0; x < 256; x += 64) {
      c.beginPath();
      c.ellipse(x + 32, 40, 22, 9, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
}
