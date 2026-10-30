import Phaser from "phaser";
import { INK, canvasTexture } from "./draw";

/**
 * The sea stage: the octopus (a monster with walk frames: its tentacles curl in turn), a whale that
 * bursts out of the water, a tentacle that slams up, your little boat, a sandy island to shelter on
 * from the tsunami, and the tsunami's breaking wave.
 */
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
    // shading: a wet shine along the back, the far side in shadow, barnacles, water pouring off
    const shine = c.createLinearGradient(0, 40, 0, 120);
    shine.addColorStop(0, "rgba(255,255,255,0.55)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = shine;
    c.beginPath();
    c.ellipse(250, 78, 150, 22, -0.08, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(10,20,70,0.25)";
    c.beginPath();
    c.ellipse(360, 190, 90, 40, -0.3, 0, Math.PI * 2);
    c.fill();
    for (const [x, y, r] of [[300, 70, 9], [318, 84, 6], [286, 88, 5], [380, 92, 7]]) {
      c.fillStyle = "#d8d0c0";
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = 3;
      c.stroke();
      c.fillStyle = "#6a6458";
      c.beginPath();
      c.arc(x, y, r * 0.4, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "rgba(200,235,255,0.85)";
    for (const [x, y] of [[120, 250], [200, 262], [300, 258], [400, 236], [250, 276]]) {
      c.beginPath();
      c.moveTo(x, y - 14);
      c.quadraticCurveTo(x + 7, y, x, y + 6);
      c.quadraticCurveTo(x - 7, y, x, y - 14);
      c.fill();
    }
    // the throat grooves on the belly
    c.strokeStyle = "rgba(120,150,190,0.7)";
    c.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      c.moveTo(90 + k * 70, 214 + k * 2);
      c.quadraticCurveTo(140 + k * 70, 226, 180 + k * 70, 220 - k * 2);
      c.stroke();
    }
    c.strokeStyle = INK;
    c.lineWidth = 8;
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
    c.strokeStyle = "#a03a92";
    c.lineWidth = 30;
    c.stroke();
    // lit side and a wet highlight along the tentacle
    c.strokeStyle = "#c86ab8";
    c.lineWidth = 16;
    c.save();
    c.translate(-5, -2);
    c.stroke();
    c.strokeStyle = "rgba(255,255,255,0.55)";
    c.lineWidth = 4;
    c.translate(-4, 0);
    c.stroke();
    c.restore();
    // suction cups with their little shadows
    for (let i = 0; i < 6; i++) {
      const [x, y] = [70 + Math.sin(i * 0.9) * 14, 272 - i * 40];
      c.fillStyle = "#ffd8f0";
      c.beginPath();
      c.ellipse(x, y, 7, 5.5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "rgba(120,30,90,0.5)";
      c.beginPath();
      c.ellipse(x + 1, y + 1, 3, 2.4, 0, 0, Math.PI * 2);
      c.fill();
    }
    // water dripping off it
    c.fillStyle = "rgba(200,235,255,0.9)";
    for (const [x, y] of [[30, 120], [96, 180], [40, 230]]) {
      c.beginPath();
      c.moveTo(x, y - 10);
      c.quadraticCurveTo(x + 5, y, x, y + 4);
      c.quadraticCurveTo(x - 5, y, x, y - 10);
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
  // the tsunami: a towering wall of water (tiles sideways); its crest is the top edge, the body runs
  // down behind it, deep blue with streaks of light, and a white curl of foam rolls over the top
  canvasTexture(scene, "tsunami_wall", 512, 460, (c) => {
    const body = c.createLinearGradient(0, 40, 0, 460);
    body.addColorStop(0, "#7af0ff");
    body.addColorStop(0.18, "#3ab8e8");
    body.addColorStop(0.55, "#1a6ac8");
    body.addColorStop(0.85, "#124a9a");
    body.addColorStop(1, "rgba(18,74,154,0)");
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(0, 460);
    c.lineTo(0, 60);
    for (let x = 0; x <= 512; x += 128) {
      c.bezierCurveTo(x + 30, 20, x + 80, 10, x + 104, 40);
      c.quadraticCurveTo(x + 118, 58, x + 128, 60);
    }
    c.lineTo(512, 460);
    c.closePath();
    c.fill();
    // streaks of light running down the face (the water rushing)
    c.lineCap = "round";
    for (let i = 0; i < 18; i++) {
      const x = (i * 29 + 11) % 512;
      c.strokeStyle = `rgba(200,245,255,${0.12 + (i % 3) * 0.08})`;
      c.lineWidth = 4 + (i % 4) * 2;
      c.beginPath();
      c.moveTo(x, 90 + (i % 5) * 12);
      c.quadraticCurveTo(x + 16, 200, x + 6, 330 + (i % 3) * 30);
      c.stroke();
    }
    // the curl: thick white foam along the crest with blobs and bubbles
    c.fillStyle = "#ffffff";
    for (let x = 0; x <= 512; x += 128) {
      c.beginPath();
      c.moveTo(x, 64);
      c.bezierCurveTo(x + 26, 12, x + 84, 0, x + 108, 36);
      c.quadraticCurveTo(x + 96, 30, x + 84, 44);
      c.quadraticCurveTo(x + 60, 30, x + 40, 56);
      c.quadraticCurveTo(x + 20, 70, x, 64);
      c.fill();
    }
    c.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i < 40; i++) {
      const x = (i * 37 + 5) % 512;
      const y = 50 + ((i * 53) % 60);
      c.beginPath();
      c.arc(x, y, 3 + (i % 4) * 2.5, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = "rgba(10,40,100,0.25)";
    for (let x = 0; x <= 512; x += 128) {
      c.beginPath();
      c.ellipse(x + 70, 80, 40, 10, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
  // a whirlpool: a dark funnel of water with white foam spiralling into it (it spins)
  canvasTexture(scene, "whirlpool", 360, 360, (c) => {
    const g = c.createRadialGradient(180, 180, 6, 180, 180, 175);
    g.addColorStop(0, "#04122e");
    g.addColorStop(0.3, "#0e3a7a");
    g.addColorStop(0.75, "#2a7ad8");
    g.addColorStop(1, "rgba(42,122,216,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(180, 180, 175, 0, Math.PI * 2);
    c.fill();
    c.lineCap = "round";
    for (let arm = 0; arm < 4; arm++) {
      c.strokeStyle = `rgba(255,255,255,${0.75 - arm * 0.1})`;
      c.lineWidth = 9 - arm;
      c.beginPath();
      for (let k = 0; k <= 60; k++) {
        const t = k / 60;
        const a = arm * (Math.PI / 2) + t * Math.PI * 2.6;
        const r = 160 * (1 - t) + 14;
        const [x, y] = [180 + Math.cos(a) * r, 180 + Math.sin(a) * r];
        if (k === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
  });

  // the shadow the wave throws ahead of itself on the water
  canvasTexture(scene, "tsunami_shade", 8, 128, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "rgba(5,20,60,0)");
    g.addColorStop(1, "rgba(5,20,60,0.55)");
    c.fillStyle = g;
    c.fillRect(0, 0, 8, 128);
  });
  // the new land: a big island with grass, palms, rocks and a flag on top
  canvasTexture(scene, "sea_bigisland", 900, 620, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 8;
    c.strokeStyle = INK;
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.beginPath();
    c.ellipse(450, 470, 440, 140, 0, 0, Math.PI * 2);
    c.fill();
    const sand = c.createRadialGradient(400, 440, 20, 450, 470, 420);
    sand.addColorStop(0, "#fff0c0");
    sand.addColorStop(1, "#d8b070");
    c.fillStyle = sand;
    c.beginPath();
    c.ellipse(450, 460, 410, 126, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    const grass = c.createLinearGradient(0, 300, 0, 480);
    grass.addColorStop(0, "#8ae05a");
    grass.addColorStop(1, "#4aa83a");
    c.fillStyle = grass;
    c.beginPath();
    c.moveTo(150, 470);
    c.bezierCurveTo(150, 380, 300, 300, 450, 300);
    c.bezierCurveTo(620, 300, 760, 380, 750, 470);
    c.quadraticCurveTo(450, 520, 150, 470);
    c.closePath();
    c.fill();
    c.stroke();
    // rocks
    for (const [x, y, r] of [[230, 450, 34], [690, 440, 40], [600, 480, 24]]) {
      c.fillStyle = "#9a9488";
      c.beginPath();
      c.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    // palms
    for (const [x, y, s] of [[300, 380, 1], [580, 360, 1.15], [440, 330, 0.9]]) {
      c.strokeStyle = INK;
      c.lineWidth = 18 * s;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x - 14 * s, y - 90 * s, x + 16 * s, y - 180 * s);
      c.stroke();
      c.strokeStyle = "#8a5a32";
      c.lineWidth = 10 * s;
      c.stroke();
      c.fillStyle = "#3ac85a";
      c.strokeStyle = INK;
      c.lineWidth = 6;
      for (const a of [-2.7, -2, -1.3, -0.6, 0.1]) {
        const [tx, ty] = [x + 16 * s, y - 180 * s];
        c.beginPath();
        c.moveTo(tx, ty);
        c.quadraticCurveTo(tx + Math.cos(a) * 80 * s, ty - 30 * s + Math.sin(a) * 50 * s, tx + Math.cos(a) * 130 * s, ty + 20 * s + Math.sin(a) * 40 * s);
        c.quadraticCurveTo(tx + Math.cos(a) * 60 * s, ty + Math.sin(a) * 20 * s, tx, ty + 6);
        c.fill();
        c.stroke();
      }
    }
    // a flag on the hill
    c.strokeStyle = INK;
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(460, 320);
    c.lineTo(460, 170);
    c.stroke();
    c.fillStyle = "#ff4a5a";
    c.beginPath();
    c.moveTo(460, 172);
    c.lineTo(540, 196);
    c.lineTo(460, 222);
    c.closePath();
    c.fill();
    c.stroke();
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
