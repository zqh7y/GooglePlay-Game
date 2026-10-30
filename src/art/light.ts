import Phaser from "phaser";
import { INK, Ctx, canvasTexture } from "./draw";
import { groundShadow, lin, poly } from "./story";

/**
 * The lighthouse stage (8): the old lighthouse on the hill (dark, then lit), the stone fire bowls you
 * light (cold, then burning), the lighthouse's sweeping beam and the mode's icon.
 */
export function makeLightTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("lighthouse")) return;
  canvasTexture(scene, "lighthouse", 360, 900, (c) => lighthouse(c, false));
  canvasTexture(scene, "lighthouse_lit", 360, 900, (c) => lighthouse(c, true));
  canvasTexture(scene, "brazier", 180, 200, (c) => brazier(c, false));
  canvasTexture(scene, "brazier_lit", 180, 200, (c) => brazier(c, true));
  // the beam: a soft cone of light from its left end, fading out along its length
  canvasTexture(scene, "lh_beam", 512, 256, (c) => {
    for (let i = 0; i < 6; i++) {
      const half = 128 * (1 - i * 0.15);
      const g = c.createLinearGradient(0, 0, 512, 0);
      g.addColorStop(0, "rgba(255,246,200,0.3)");
      g.addColorStop(0.5, "rgba(255,240,180,0.16)");
      g.addColorStop(1, "rgba(255,240,180,0)");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, 128 - 6);
      c.lineTo(512, 128 - half);
      c.lineTo(512, 128 + half);
      c.lineTo(0, 128 + 6);
      c.closePath();
      c.fill();
    }
  });
  // the mode's icon: a lighthouse at night with its light shining out both ways
  canvasTexture(scene, "mode_light", 128, 128, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 6;
    c.strokeStyle = INK;
    const bg = c.createLinearGradient(0, 8, 0, 120);
    bg.addColorStop(0, "#2a3a8a");
    bg.addColorStop(1, "#5a3a8a");
    c.fillStyle = bg;
    c.beginPath();
    c.arc(64, 64, 56, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "rgba(255,236,150,0.75)";
    for (const d of [-1, 1]) {
      c.beginPath();
      c.moveTo(64, 38);
      c.lineTo(64 + d * 56, 22);
      c.lineTo(64 + d * 56, 56);
      c.closePath();
      c.fill();
    }
    poly(c, [[50, 106], [78, 106], [72, 46], [56, 46]], lin(c, 50, 0, 78, 0, ["#ffffff", "#e8e0d8", "#a8a0a0"]));
    for (const y of [60, 84]) poly(c, [[54, y], [74, y], [75, y + 10], [53, y + 10]], "#e8434f", false);
    poly(c, [[52, 46], [76, 46], [76, 32], [52, 32]], "#ffe066");
    poly(c, [[50, 32], [78, 32], [64, 20]], "#e8434f");
  });
}

/** The lighthouse: a stone base, a tapering red and white tower, a gallery and the lamp room on top. */
function lighthouse(c: Ctx, lit: boolean): void {
  c.lineJoin = "round";
  c.lineWidth = 6;
  c.strokeStyle = INK;
  groundShadow(c, 180, 872, 170, 28);
  // the stone base: a low round plinth with a top face
  poly(c, [[30, 800], [330, 800], [318, 872], [42, 872]], lin(c, 30, 0, 330, 0, ["#b8b0a4", "#8a8278", "#5a544c"]));
  c.beginPath();
  c.ellipse(180, 800, 150, 26, 0, 0, Math.PI * 2);
  c.fillStyle = "#c8c0b4";
  c.fill();
  c.stroke();
  c.save();
  c.lineWidth = 3;
  c.strokeStyle = "rgba(74,47,29,0.5)";
  for (let x = 60; x < 320; x += 52) {
    c.beginPath();
    c.moveTo(x, 828);
    c.lineTo(x + 4, 870);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(36, 836);
  c.lineTo(324, 836);
  c.stroke();
  c.restore();
  // the tower: round, lit from the left; red bands that curve round it
  const tower: [number, number][] = [[72, 804], [288, 804], [246, 252], [114, 252]];
  c.save();
  c.beginPath();
  c.moveTo(tower[0][0], tower[0][1]);
  for (const p of tower.slice(1)) c.lineTo(p[0], p[1]);
  c.closePath();
  c.clip();
  c.fillStyle = lin(c, 70, 0, 290, 0, ["#ffffff", "#f2ece4", "#c8bcb4", "#8a8088"]);
  c.fillRect(0, 240, 360, 580);
  for (const [y0, y1] of [[330, 420], [520, 610], [710, 800]]) {
    const band = lin(c, 70, 0, 290, 0, ["#ff6a6a", "#e8434f", "#a82a36", "#6a1a2a"]);
    c.fillStyle = band;
    c.beginPath();
    c.moveTo(0, y0);
    c.quadraticCurveTo(180, y0 + 26, 360, y0);
    c.lineTo(360, y1);
    c.quadraticCurveTo(180, y1 + 26, 0, y1);
    c.closePath();
    c.fill();
  }
  // a soft shine down the lit side
  c.fillStyle = "rgba(255,255,255,0.22)";
  c.fillRect(110, 240, 26, 580);
  c.restore();
  c.beginPath();
  c.moveTo(tower[0][0], tower[0][1]);
  for (const p of tower.slice(1)) c.lineTo(p[0], p[1]);
  c.closePath();
  c.stroke();
  // little windows up the tower (warm once it is lit)
  for (const [x, y] of [[176, 470], [184, 660], [172, 300]]) {
    c.beginPath();
    c.ellipse(x, y, 12, 18, 0, 0, Math.PI * 2);
    c.fillStyle = lit ? "#ffe9a0" : "#2a3048";
    c.fill();
    c.stroke();
  }
  // the door: an arch of planks
  c.beginPath();
  c.moveTo(146, 804);
  c.lineTo(146, 742);
  c.quadraticCurveTo(180, 704, 214, 742);
  c.lineTo(214, 804);
  c.closePath();
  c.fillStyle = lin(c, 146, 0, 214, 0, ["#a86a38", "#6a3a18"]);
  c.fill();
  c.stroke();
  c.save();
  c.lineWidth = 3;
  for (const x of [166, 186, 204]) {
    c.beginPath();
    c.moveTo(x - 4, 732);
    c.lineTo(x - 4, 802);
    c.stroke();
  }
  c.restore();
  c.beginPath();
  c.arc(204, 770, 5, 0, Math.PI * 2);
  c.fillStyle = "#ffd24a";
  c.fill();
  // the gallery round the top, with its railing
  c.beginPath();
  c.ellipse(180, 252, 112, 22, 0, 0, Math.PI * 2);
  c.fillStyle = "#3a3e46";
  c.fill();
  c.stroke();
  c.save();
  c.lineWidth = 4;
  for (let x = 82; x <= 278; x += 24) {
    c.beginPath();
    c.moveTo(x, 252 + Math.sin(((x - 70) / 220) * Math.PI) * 16);
    c.lineTo(x, 214 + Math.sin(((x - 70) / 220) * Math.PI) * 14);
    c.stroke();
  }
  c.beginPath();
  c.ellipse(180, 214, 100, 18, 0, 0, Math.PI);
  c.stroke();
  c.restore();
  // the lamp room: glass panes in an iron frame (black when dark, blazing when lit)
  const glass = lit ? lin(c, 0, 150, 0, 236, ["#ffffff", "#fff3a0", "#ffc040"]) : lin(c, 130, 0, 230, 0, ["#5a6a8a", "#2a3048", "#1a1e30"]);
  poly(c, [[128, 236], [232, 236], [232, 150], [128, 150]], glass);
  c.save();
  c.lineWidth = 4;
  for (const x of [154, 180, 206]) {
    c.beginPath();
    c.moveTo(x, 150);
    c.lineTo(x, 236);
    c.stroke();
  }
  c.restore();
  if (lit) {
    c.beginPath();
    c.arc(180, 194, 22, 0, Math.PI * 2);
    c.fillStyle = "#ffffff";
    c.fill();
  } else {
    c.fillStyle = "rgba(255,255,255,0.35)";
    c.fillRect(136, 158, 10, 70);
  }
  // the dome roof and its little ball on top
  c.beginPath();
  c.moveTo(116, 152);
  c.quadraticCurveTo(180, 70, 244, 152);
  c.closePath();
  c.fillStyle = lin(c, 116, 0, 244, 0, ["#ff6a6a", "#d83a46", "#8a1a2a"]);
  c.fill();
  c.stroke();
  c.beginPath();
  c.arc(180, 92, 13, 0, Math.PI * 2);
  c.fillStyle = "#3a3e46";
  c.fill();
  c.stroke();
}

/** A stone fire bowl on a short pillar: cold grey ashes, or glowing coals. */
function brazier(c: Ctx, lit: boolean): void {
  c.lineJoin = "round";
  c.lineWidth = 5;
  c.strokeStyle = INK;
  groundShadow(c, 90, 190, 70, 12);
  // the pillar: three stacked stones
  poly(c, [[58, 120], [122, 120], [128, 190], [52, 190]], lin(c, 52, 0, 128, 0, ["#c8c0b4", "#8a8278", "#4a443c"]));
  c.save();
  c.lineWidth = 3;
  c.strokeStyle = "rgba(74,47,29,0.6)";
  for (const y of [144, 168]) {
    c.beginPath();
    c.moveTo(56, y);
    c.lineTo(126, y);
    c.stroke();
  }
  c.restore();
  // the bowl
  c.beginPath();
  c.moveTo(14, 66);
  c.quadraticCurveTo(22, 124, 90, 126);
  c.quadraticCurveTo(158, 124, 166, 66);
  c.closePath();
  c.fillStyle = lin(c, 14, 0, 166, 0, ["#b8b0a4", "#7a7268", "#3a342c"]);
  c.fill();
  c.stroke();
  // carved runes round the bowl (they glow once it burns)
  c.save();
  c.lineWidth = 4;
  c.strokeStyle = lit ? "#ffd24a" : "rgba(40,30,30,0.55)";
  for (const x of [50, 90, 130]) {
    c.beginPath();
    c.moveTo(x - 8, 88);
    c.lineTo(x, 104);
    c.lineTo(x + 8, 88);
    c.stroke();
  }
  c.restore();
  c.beginPath();
  c.ellipse(90, 66, 76, 20, 0, 0, Math.PI * 2);
  c.fillStyle = "#4a443c";
  c.fill();
  c.stroke();
  const inside = c.createRadialGradient(90, 68, 2, 90, 68, 64);
  if (lit) {
    inside.addColorStop(0, "#fff3a0");
    inside.addColorStop(0.4, "#ff9a2a");
    inside.addColorStop(1, "#8a2a10");
  } else {
    inside.addColorStop(0, "#8a8480");
    inside.addColorStop(1, "#3a3634");
  }
  c.beginPath();
  c.ellipse(90, 68, 64, 14, 0, 0, Math.PI * 2);
  c.fillStyle = inside;
  c.fill();
  if (lit) {
    c.save();
    c.strokeStyle = "rgba(255,200,120,0.8)";
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(90, 66, 76, 20, 0, Math.PI * 0.05, Math.PI * 0.95);
    c.stroke();
    c.restore();
  }
}
