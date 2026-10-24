import Phaser from "phaser";
import { INK, Ctx, canvasTexture, circle, fill, fillOutline, linear, radial, rgba, starPath } from "./draw";
import { toon } from "./toon";

/** Places on the field: the boss seals and the two buildings of the free-roam lobby. */

/** A rune circle lying flat on the ground: purple while open, gold once you closed it. */
function seal(on: boolean) {
  return (ctx: Ctx) => {
    const main = on ? "#ffcf3a" : "#a070e8";
    const light = on ? "#fff3a8" : "#ead8ff";
    const glow = on ? 0xffe066 : 0xb98aff;
    ctx.save();
    ctx.translate(150, 80);
    ctx.scale(1, 0.5);
    circle(ctx, 0, 0, 146);
    fill(ctx, radial(ctx, 0, 0, 146, [[0, rgba(glow, 0.6)], [0.7, rgba(glow, 0.25)], [1, rgba(glow, 0)]]));
    for (const [r, w, color] of [[128, 9, main], [96, 6, light]] as [number, number, string][]) {
      circle(ctx, 0, 0, r);
      ctx.lineWidth = w + 8;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = w;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
    // runes between the rings
    ctx.lineCap = "round";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.translate(Math.cos(a) * 112, Math.sin(a) * 112);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(0, 9);
      ctx.moveTo(-7, i % 2 ? -3 : 3);
      ctx.lineTo(7, i % 2 ? 3 : -3);
      ctx.lineWidth = 5;
      ctx.strokeStyle = light;
      ctx.stroke();
      ctx.restore();
    }
    starPath(ctx, 0, 0, 62, 0.42, 5);
    fillOutline(ctx, linear(ctx, 0, -62, 0, 62, [[0, light], [1, main]]), 6);
    ctx.restore();
  };
}

/** BATTLE: a little stone arena with red towers, a crossed-swords banner and a glowing gate. */
function battleHall(ctx: Ctx): void {
  const T = toon(ctx, INK, 6);
  // towers behind the wall
  for (const x of [80, 440]) {
    T.part(() => T.rect(x, 300, 110, 330, 10), 0xc9bfae, () => {
      for (let y = 190; y < 440; y += 60) T.paint("rgba(0,0,0,0.12)", () => T.rect(x, y, 90, 6, 3));
    });
    T.part(() => T.poly([[x - 70, 145], [x + 70, 145], [x, 40]], 8), 0xe8434f, () => T.paint("rgba(255,255,255,0.25)", () => T.poly([[x - 30, 140], [x - 6, 140], [x - 2, 70]], 4)));
    // flag
    T.tube(() => {
      ctx.moveTo(x, 44);
      ctx.lineTo(x, 8);
    }, 5, 0x8a5a3a);
    T.part(() => T.poly([[x, 8], [x + 44, 18], [x, 30]], 4), 0xffcf3a);
  }
  // the wall with battlements
  T.part(() => {
    T.rect(260, 400, 380, 250, 12);
    for (let i = 0; i < 6; i++) T.rect(105 + i * 62, 268, 40, 40, 6);
  }, 0xd8cfbe, () => {
    for (let y = 320; y < 520; y += 46) for (let x = 90 + ((y / 46) % 2) * 30; x < 430; x += 70) T.paint("rgba(0,0,0,0.1)", () => T.rect(x, y, 56, 6, 3));
  });
  // the gate: a glowing arch
  T.part(() => T.poly([[190, 525], [190, 400], [215, 350], [260, 330], [305, 350], [330, 400], [330, 525]], 30), 0x6a3a22);
  T.paint(radial(ctx, 260, 450, 120, [[0, "rgba(255,240,150,1)"], [0.5, "rgba(255,150,60,0.95)"], [1, "rgba(200,70,30,0.9)"]]), () => {
    T.poly([[206, 525], [206, 404], [226, 362], [260, 346], [294, 362], [314, 404], [314, 525]], 26);
  });
  // banner with crossed swords over the gate
  T.part(() => T.poly([[200, 210], [320, 210], [320, 300], [260, 324], [200, 300]], 8), 0xd8434f);
  for (const s of [-1, 1]) {
    T.tube(() => {
      ctx.moveTo(260 - s * 34, 292);
      ctx.lineTo(260 + s * 30, 226);
    }, 9, 0xf2f2f8);
    T.tube(() => {
      ctx.moveTo(260 - s * 46, 268);
      ctx.lineTo(260 - s * 18, 284);
    }, 8, 0xffcf3a);
  }
  // steps
  T.part(() => T.rect(260, 538, 200, 26, 8), 0xb8ad9a);
}

/** BOSS RUSH: a dark spiky tower with a crowned skull and a purple door. */
function bossTower(ctx: Ctx): void {
  const T = toon(ctx, INK, 6);
  // side spires
  for (const x of [110, 410]) {
    T.part(() => T.rect(x, 380, 96, 300, 10), 0x5a4a7a, () => T.paint("rgba(255,255,255,0.08)", () => T.rect(x - 26, 380, 18, 280, 6)));
    T.part(() => T.poly([[x - 62, 240], [x + 62, 240], [x, 110]], 8), 0x3a2a5a);
    T.paint(radial(ctx, x, 300, 18, [[0, "rgba(255,220,255,1)"], [1, "rgba(200,120,255,0.9)"]]), () => T.C(x, 300, 14));
  }
  // the main tower
  T.part(() => T.rect(260, 330, 230, 420, 14), 0x6a5a8e, () => {
    for (let y = 170; y < 530; y += 52) T.paint("rgba(0,0,0,0.14)", () => T.rect(260, y, 200, 6, 3));
    T.paint("rgba(255,255,255,0.1)", () => T.rect(180, 330, 26, 400, 8));
  });
  // spiky crown roof and an orb
  T.part(() => T.poly([[130, 130], [160, 60], [195, 120], [225, 30], [260, 110], [295, 30], [325, 120], [360, 60], [390, 130]], 6), 0x3a2a5a);
  T.paint(radial(ctx, 260, 38, 40, [[0, "#ffffff"], [0.4, "rgba(230,180,255,1)"], [1, "rgba(150,80,255,0)"]]), () => T.C(260, 38, 40));
  // crowned skull
  T.part(() => T.poly([[215, 205], [228, 170], [245, 195], [260, 162], [275, 195], [292, 170], [305, 205]], 4), 0xffcf3a);
  T.part(() => {
    T.E(260, 245, 48, 42);
    T.rect(260, 282, 52, 26, 8);
  }, 0xf2ecdf);
  for (const x of [242, 278]) T.paint("#2a1a3a", () => T.E(x, 245, 12, 14));
  T.paint("#c080ff", () => {
    T.C(242, 247, 4);
    T.C(278, 247, 4);
  });
  // the door
  T.part(() => T.poly([[200, 540], [200, 420], [225, 375], [260, 362], [295, 375], [320, 420], [320, 540]], 30), 0x2a1a3a);
  T.paint(radial(ctx, 260, 470, 120, [[0, "rgba(255,230,255,1)"], [0.45, "rgba(200,120,255,0.95)"], [1, "rgba(110,40,200,0.9)"]]), () => {
    T.poly([[214, 540], [214, 424], [232, 388], [260, 378], [288, 388], [306, 424], [306, 540]], 26);
  });
  T.part(() => T.rect(260, 552, 220, 26, 8), 0x4a3a6a);
}

export function makePlaceTextures(scene: Phaser.Scene): void {
  canvasTexture(scene, "seal", 300, 160, seal(false));
  canvasTexture(scene, "seal_on", 300, 160, seal(true));
  canvasTexture(scene, "bld_battle", 520, 570, battleHall);
  canvasTexture(scene, "bld_rush", 520, 580, bossTower);
}
