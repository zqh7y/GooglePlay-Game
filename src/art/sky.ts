import Phaser from "phaser";
import { INK, Ctx, canvasTexture, darken, lighten, rgba } from "./draw";
import { angryFace, olFor } from "./characters";
import { poly } from "./story";
import { toon } from "./toon";

/**
 * The storm flight (stage 9), seen from the side and all sky: your bubble-cockpit helicopter (you sit
 * inside it), storm clouds above and a floor of clouds below, near clouds drifting past, the Storm
 * Twister (a tornado painted like the monsters), wind swooshes, the volcano, the helipad and the icon.
 */
export function makeSkyTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("heli_side")) return;
  // the sky: night-blue at the top, a storm grey-green down at the horizon
  canvasTexture(scene, "sky_side", 64, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#0e1530");
    g.addColorStop(0.45, "#26365a");
    g.addColorStop(0.8, "#48607a");
    g.addColorStop(1, "#6a7e8a");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 512);
  });
  // a bank of storm clouds along the top (wraps left to right), dark with lit rims
  canvasTexture(scene, "cloudbank", 1024, 420, (c) => {
    let s = 5;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const puff = (x: number, y: number, rad: number, dark: string, rim: string) => {
      for (const dx of [-1024, 0, 1024]) {
        const g = c.createRadialGradient(x + dx - rad * 0.25, y - rad * 0.35, rad * 0.1, x + dx, y, rad);
        g.addColorStop(0, rim);
        g.addColorStop(0.45, dark);
        g.addColorStop(1, "rgba(14,20,44,0)");
        c.fillStyle = g;
        c.beginPath();
        c.arc(x + dx, y, rad, 0, Math.PI * 2);
        c.fill();
      }
    };
    c.fillStyle = "#121a36";
    c.fillRect(0, 0, 1024, 170);
    for (let i = 0; i < 34; i++) puff(r() * 1024, 150 + r() * 120, 70 + r() * 90, "rgba(28,36,66,0.95)", "rgba(96,110,150,0.95)");
    for (let i = 0; i < 18; i++) puff(r() * 1024, 250 + r() * 70, 50 + r() * 60, "rgba(36,46,80,0.9)", "rgba(130,146,186,0.9)");
  });
  // one soft cloud (drifts past in front and behind you)
  canvasTexture(scene, "cloud_puff", 520, 260, (c) => {
    for (const [x, y, rad] of [[140, 160, 90], [250, 120, 120], [370, 150, 95], [300, 180, 90], [190, 190, 80]] as const) {
      const g = c.createRadialGradient(x - rad * 0.3, y - rad * 0.4, rad * 0.1, x, y, rad);
      g.addColorStop(0, "rgba(236,242,255,0.95)");
      g.addColorStop(0.5, "rgba(170,182,214,0.85)");
      g.addColorStop(1, "rgba(110,122,160,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, rad, 0, Math.PI * 2);
      c.fill();
    }
  });
  // a floor of fluffy clouds far below (wraps left to right)
  canvasTexture(scene, "cloudfloor", 1024, 460, (c) => {
    let s = 17;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    c.fillStyle = "#6a7298";
    c.fillRect(0, 160, 1024, 300);
    for (let i = 0; i < 40; i++) {
      const [x, y, rad] = [r() * 1024, 120 + r() * 120, 60 + r() * 70];
      for (const dx of [-1024, 0, 1024]) {
        const g = c.createRadialGradient(x + dx - rad * 0.3, y - rad * 0.4, rad * 0.1, x + dx, y, rad);
        g.addColorStop(0, "rgba(236,240,255,1)");
        g.addColorStop(0.55, "rgba(160,170,206,1)");
        g.addColorStop(1, "rgba(106,114,152,0)");
        c.fillStyle = g;
        c.beginPath();
        c.arc(x + dx, y, rad, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
  canvasTexture(scene, "heli_side", 300, 200, (c) => heliSide(c));
  canvasTexture(scene, "heli_back", 300, 200, (c) => heliBack(c));
  canvasTexture(scene, "heli_front", 300, 200, (c) => heliFront(c));
  // the main rotor blade seen edge-on (squashed back and forth to spin), its blur, the tail rotor
  canvasTexture(scene, "heli_blade", 360, 20, (c) => {
    c.lineCap = "round";
    c.lineWidth = 10;
    c.strokeStyle = INK;
    c.beginPath();
    c.moveTo(10, 10);
    c.lineTo(350, 10);
    c.stroke();
  });
  canvasTexture(scene, "heli_blur", 460, 60, (c) => {
    const g = c.createRadialGradient(230, 30, 10, 230, 30, 230);
    g.addColorStop(0, "rgba(230,236,255,0.5)");
    g.addColorStop(1, "rgba(230,236,255,0)");
    c.fillStyle = g;
    c.save();
    c.scale(1, 60 / 460);
    c.beginPath();
    c.arc(230, 230, 230, 0, Math.PI * 2);
    c.fill();
    c.restore();
  });
  canvasTexture(scene, "heli_tail", 60, 60, (c) => {
    c.lineCap = "round";
    c.lineWidth = 7;
    c.strokeStyle = INK;
    c.beginPath();
    c.moveTo(6, 30);
    c.lineTo(54, 30);
    c.moveTo(30, 6);
    c.lineTo(30, 54);
    c.stroke();
  });
  // the Storm Twister: a tornado painted like the game's monsters (lit 3D form, angry face)
  canvasTexture(scene, "twister", 440, 1000, (c) => twister(c));
  // a cartoon gust of wind: three long swoosh lines, the middle one ending in a curl (blowing to the right)
  canvasTexture(scene, "wind_curl", 520, 220, (c) => {
    c.lineCap = "round";
    c.lineJoin = "round";
    for (const [w, col] of [[20, "#1a3a6a"], [10, "#ffffff"]] as const) {
      c.lineWidth = w;
      c.strokeStyle = col;
      c.beginPath();
      c.moveTo(20, 60);
      c.quadraticCurveTo(220, 40, 360, 56);
      c.moveTo(60, 112);
      c.quadraticCurveTo(260, 104, 380, 112);
      c.bezierCurveTo(470, 116, 480, 190, 420, 186);
      c.bezierCurveTo(380, 182, 384, 146, 414, 146);
      c.moveTo(30, 170);
      c.quadraticCurveTo(170, 180, 290, 168);
      c.stroke();
    }
  });
  canvasTexture(scene, "volcano_pro", 1000, 780, (c) => volcanoPro(c));
  // the helipad on the beach (seen from the front)
  canvasTexture(scene, "helipad", 420, 220, (c) => {
    c.lineWidth = 6;
    c.strokeStyle = INK;
    c.beginPath();
    c.ellipse(210, 110, 200, 100, 0, 0, Math.PI * 2);
    c.fillStyle = "#4a4e58";
    c.fill();
    c.stroke();
    c.beginPath();
    c.ellipse(210, 110, 170, 82, 0, 0, Math.PI * 2);
    c.strokeStyle = "#ffe066";
    c.lineWidth = 8;
    c.stroke();
    c.fillStyle = "#ffffff";
    c.fillRect(160, 70, 18, 80);
    c.fillRect(242, 70, 18, 80);
    c.fillRect(160, 102, 100, 16);
  });
  // the mode's icon: the helicopter in a stormy circle under a lightning bolt
  canvasTexture(scene, "mode_heli", 128, 128, (c) => {
    c.lineJoin = "round";
    c.lineWidth = 6;
    c.strokeStyle = INK;
    const bg = c.createLinearGradient(0, 8, 0, 120);
    bg.addColorStop(0, "#1a2448");
    bg.addColorStop(1, "#5a7090");
    c.fillStyle = bg;
    c.beginPath();
    c.arc(64, 64, 56, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    poly(c, [[74, 10], [56, 42], [70, 42], [52, 70], [86, 34], [72, 34], [86, 10]], "#ffe066");
    c.save();
    c.translate(64, 84);
    c.scale(0.32, 0.32);
    c.translate(-170, -110);
    heliSide(c);
    c.restore();
  });
}

/**
 * The helicopter from the side, nose to the right: a bubble-cockpit chopper, kept simple. It comes in two
 * layers so the pilot (you) can sit between them: the cabin behind (dark inside, the seat), and in front
 * the big clear glass bubble, the red body under it, the thin tail with its fin, the mast and the skids.
 */
const BUBBLE: [number, number, number] = [196, 92, 74];

function heliBack(c: Ctx): void {
  const [bx, by, br] = BUBBLE;
  c.beginPath();
  c.arc(bx, by, br - 4, 0, Math.PI * 2);
  c.fillStyle = "#24304a";
  c.fill();
  // the seat behind you
  c.fillStyle = "#4a4e58";
  c.beginPath();
  c.roundRect(bx - 66, by - 24, 30, 70, 10);
  c.fill();
}

function heliFront(c: Ctx): void {
  const [bx, by, br] = BUBBLE;
  c.lineJoin = "round";
  c.lineCap = "round";
  c.lineWidth = 7;
  c.strokeStyle = INK;
  // skids
  c.beginPath();
  c.moveTo(160, 160);
  c.lineTo(150, 186);
  c.moveTo(232, 160);
  c.lineTo(242, 186);
  c.moveTo(118, 188);
  c.lineTo(276, 188);
  c.quadraticCurveTo(290, 188, 292, 176);
  c.stroke();
  // the thin tail and its fin
  poly(c, [[134, 104], [26, 96], [26, 108], [134, 124]], "#ff5a5a");
  poly(c, [[16, 66], [38, 94], [38, 112], [10, 114]], "#ff5a5a");
  // the red body under the bubble
  c.beginPath();
  c.moveTo(120, 112);
  c.quadraticCurveTo(196, 108, 272, 112);
  c.quadraticCurveTo(268, 166, 196, 168);
  c.quadraticCurveTo(124, 166, 120, 112);
  c.closePath();
  c.fillStyle = "#ff5a5a";
  c.fill();
  c.stroke();
  c.fillStyle = "rgba(120,10,30,0.25)";
  c.beginPath();
  c.ellipse(196, 156, 60, 7, 0, 0, Math.PI * 2);
  c.fill();
  // the glass bubble: clear, a light tint, a bright glare
  c.beginPath();
  c.arc(bx, by, br, Math.PI * 0.94, Math.PI * 2.06);
  c.fillStyle = "rgba(200,238,255,0.2)";
  c.fill();
  c.stroke();
  c.strokeStyle = "rgba(255,255,255,0.85)";
  c.lineWidth = 7;
  c.beginPath();
  c.arc(bx, by, br - 14, Math.PI * 1.18, Math.PI * 1.42);
  c.stroke();
  c.lineWidth = 4;
  c.beginPath();
  c.arc(bx, by, br - 14, Math.PI * 1.5, Math.PI * 1.56);
  c.stroke();
  // the mast on top
  c.strokeStyle = INK;
  c.lineWidth = 7;
  poly(c, [[bx - 9, by - br + 2], [bx + 9, by - br + 2], [bx + 7, by - br - 16], [bx - 7, by - br - 16]], "#4a4e58");
}

/** The whole helicopter in one picture (lobby, icon, comic), with a little you inside. */
function heliSide(c: Ctx): void {
  const [bx, by] = BUBBLE;
  heliBack(c);
  c.lineWidth = 4;
  c.strokeStyle = INK;
  c.fillStyle = "#c89060";
  c.beginPath();
  c.rect(bx - 22, by - 30, 50, 52);
  c.fill();
  c.stroke();
  c.fillStyle = "#24161e";
  for (const x of [bx + 10, bx + 22]) {
    c.beginPath();
    c.arc(x, by - 10, 5, 0, Math.PI * 2);
    c.fill();
  }
  heliFront(c);
}

/**
 * A volcano painted properly: a concave cone of layered rock lit from the left (gullies and ridges
 * running down it, strata bands, rocky grain), a broken crater rim with a lava pool glowing inside,
 * lava rivers with bright cores and soft glows, boulders on its slopes, and a rim of light on its edge.
 */
function volcanoPro(c: Ctx): void {
  const W = 1000;
  const H = 780;
  let s = 23;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cone = () => {
    c.beginPath();
    c.moveTo(20, H);
    c.bezierCurveTo(240, 620, 330, 330, 400, 190);
    c.lineTo(440, 170);
    c.lineTo(470, 186);
    c.lineTo(520, 166);
    c.lineTo(560, 180);
    c.lineTo(600, 192);
    c.bezierCurveTo(670, 330, 760, 620, 980, H);
    c.closePath();
  };
  // the glow over the crater, behind everything
  const glow = c.createRadialGradient(500, 160, 10, 500, 160, 260);
  glow.addColorStop(0, "rgba(255,170,60,0.6)");
  glow.addColorStop(1, "rgba(255,90,20,0)");
  c.fillStyle = glow;
  c.fillRect(200, 0, 600, 420);
  // the cone: lit from the left, darker toward its foot
  cone();
  const body = c.createLinearGradient(160, 0, 860, 0);
  body.addColorStop(0, "#9a7a68");
  body.addColorStop(0.45, "#5e4640");
  body.addColorStop(1, "#22161a");
  c.fillStyle = body;
  c.fill();
  c.save();
  cone();
  c.clip();
  const foot = c.createLinearGradient(0, 200, 0, H);
  foot.addColorStop(0, "rgba(20,10,12,0)");
  foot.addColorStop(1, "rgba(20,10,12,0.55)");
  c.fillStyle = foot;
  c.fillRect(0, 0, W, H);
  // strata: faint curved bands of rock
  for (let i = 0; i < 9; i++) {
    const y = 260 + i * 58;
    c.strokeStyle = i % 2 ? "rgba(30,16,16,0.22)" : "rgba(200,170,150,0.12)";
    c.lineWidth = 10 + r() * 8;
    c.beginPath();
    c.moveTo(0, y + 40);
    c.quadraticCurveTo(500, y - 30, W, y + 40);
    c.stroke();
  }
  // gullies and ridges running down from the top (dark grooves with a lit edge)
  for (let i = 0; i < 16; i++) {
    const x0 = 410 + r() * 180;
    const x1 = 60 + (i / 15) * 880 + (r() - 0.5) * 60;
    const bend = (r() - 0.5) * 120;
    c.strokeStyle = "rgba(24,12,12,0.45)";
    c.lineWidth = 6 + r() * 10;
    c.beginPath();
    c.moveTo(x0, 200);
    c.quadraticCurveTo((x0 + x1) / 2 + bend, 470, x1, H);
    c.stroke();
    c.strokeStyle = "rgba(230,200,180,0.16)";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x0 - 6, 204);
    c.quadraticCurveTo((x0 + x1) / 2 + bend - 8, 470, x1 - 8, H);
    c.stroke();
  }
  // rocky grain
  for (let i = 0; i < 700; i++) {
    const [x, y] = [r() * W, 180 + r() * (H - 180)];
    c.fillStyle = r() < 0.5 ? "rgba(20,10,10,0.3)" : "rgba(210,180,160,0.18)";
    c.beginPath();
    c.ellipse(x, y, 2 + r() * 5, 1.5 + r() * 3, r() * 3, 0, Math.PI * 2);
    c.fill();
  }
  // lava rivers: a soft glow, a hot body and a bright core, branching on the way down
  const river = (pts: [number, number][], w: number) => {
    for (const [lw, col] of [[w * 3.4, "rgba(255,90,10,0.28)"], [w * 1.6, "#e8481a"], [w, "#ff9a2a"], [w * 0.4, "#fff0a0"]] as const) {
      c.strokeStyle = col;
      c.lineWidth = lw;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let k = 1; k < pts.length - 1; k++) c.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
      c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      c.stroke();
    }
  };
  river([[470, 190], [450, 300], [400, 420], [380, 560], [330, 700], [300, H]], 14);
  river([[540, 186], [560, 290], [610, 400], [640, 520], [700, 660], [740, H]], 12);
  river([[400, 420], [340, 470], [250, 600], [200, H]], 8);
  river([[610, 400], [680, 450], [780, 600], [840, H]], 7);
  c.restore();
  // a rim of light on the lit edge, and the ink outline
  c.save();
  c.strokeStyle = "rgba(255,220,190,0.5)";
  c.lineWidth = 8;
  c.beginPath();
  c.moveTo(40, H - 10);
  c.bezierCurveTo(250, 610, 336, 330, 404, 196);
  c.stroke();
  c.restore();
  cone();
  c.lineWidth = 8;
  c.strokeStyle = "#140a0a";
  c.stroke();
  // the crater: a dark broken rim round a glowing lava pool
  c.beginPath();
  c.ellipse(500, 182, 104, 26, 0, 0, Math.PI * 2);
  c.fillStyle = "#2a1414";
  c.fill();
  c.stroke();
  const pool = c.createRadialGradient(500, 184, 4, 500, 184, 92);
  pool.addColorStop(0, "#fffbe0");
  pool.addColorStop(0.35, "#ffd040");
  pool.addColorStop(0.75, "#ff6a1a");
  pool.addColorStop(1, "#a82a10");
  c.beginPath();
  c.ellipse(500, 186, 88, 18, 0, 0, Math.PI * 2);
  c.fillStyle = pool;
  c.fill();
  c.strokeStyle = "rgba(255,240,180,0.9)";
  c.lineWidth = 4;
  c.beginPath();
  c.ellipse(500, 182, 100, 23, 0, Math.PI * 0.05, Math.PI * 0.95);
  c.stroke();
  // boulders on its slopes
  for (const [x, y, rr] of [[230, 640, 30], [300, 700, 22], [700, 650, 34], [800, 720, 26], [560, 740, 20]] as const) {
    const g = c.createRadialGradient(x - rr * 0.4, y - rr * 0.4, 2, x, y, rr);
    g.addColorStop(0, "#8a7068");
    g.addColorStop(1, "#2a1a1a");
    c.beginPath();
    c.ellipse(x, y, rr, rr * 0.75, 0, 0, Math.PI * 2);
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 5;
    c.strokeStyle = "#140a0a";
    c.stroke();
  }
}


/**
 * The Storm Twister: a funnel of storm cloud painted with the monsters' shading (a lit 3D form, rim light,
 * soft shadow side), wind whirling round it, lumpy cloud on top, bits of debris, and an angry face.
 */
function twister(ctx: Ctx): void {
  const col = 0x6e7eae;
  const t = toon(ctx, olFor(col), 6, true);
  const edge = (k: number): [number, number, number] => {
    const y = 120 + k * 850;
    const w = 175 * Math.pow(1 - k, 1.25) + 16;
    const x = 220 + Math.sin(k * 5.5) * 34 * k;
    return [x, y, w];
  };
  // the funnel
  t.part(() => {
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const [x, y, w] = edge(i / n);
      if (i === 0) ctx.moveTo(x - w, y);
      else ctx.lineTo(x - w, y);
    }
    for (let i = n; i >= 0; i--) {
      const [x, y, w] = edge(i / n);
      ctx.lineTo(x + w, y);
    }
    ctx.closePath();
  }, col, () => {
    // wind whirling round it: curved streaks, light on the lit side, dark on the shadow side
    ctx.lineCap = "round";
    for (let i = 0; i < 16; i++) {
      const k = 0.03 + i * 0.058;
      const [x, y, w] = edge(k);
      const light = i % 2 === 0;
      ctx.strokeStyle = light ? rgba(lighten(col, 0.55), 0.75) : rgba(darken(col, 0.35), 0.6);
      ctx.lineWidth = light ? 6 : 4;
      ctx.beginPath();
      ctx.ellipse(x + (light ? -w * 0.12 : w * 0.1), y + (light ? 0 : 10), w * (light ? 0.7 : 0.8), 14 + 10 * (1 - k), -0.15, light ? Math.PI * 0.95 : Math.PI * 0.05, light ? Math.PI * 1.75 : Math.PI * 0.75);
      ctx.stroke();
    }
  });
  // the lumpy storm cloud it hangs from
  t.part(() => {
    for (const [x, y, rx, ry] of [[110, 110, 90, 60], [220, 80, 120, 72], [330, 110, 96, 60], [220, 140, 150, 50]] as const) t.E(x, y, rx, ry);
  }, darken(col, 0.12), () => {
    t.paint(rgba(lighten(col, 0.35), 0.7), () => t.E(190, 60, 60, 20, -0.2));
  });
  t.gloss(160, 74, 34, 12, -0.25);
  angryFace(t, 220, 200, 40, 1.5);
  // debris caught up in it
  for (const [x, y, r] of [[60, 380, 12], [380, 470, 10], [110, 640, 9], [320, 760, 8]] as const) {
    t.part(() => t.poly([[x - r, y - r * 0.6], [x + r, y - r], [x + r * 0.8, y + r * 0.7], [x - r * 0.9, y + r * 0.5]], 3), 0x7a5a3a);
  }
}
