import Phaser from "phaser";
import { INK, INK_N, canvasTexture, darken, lighten, linear, radial, rainbowGradient, rgba, rr, starPath } from "../art/draw";
import { lockedTexture, petTexture } from "../art/pets";
import { ITEMS, MAX_LEVEL, PET_LIST, PREMIUM, copiesFor, isPremium } from "../data/items";
import { save } from "../systems/save";
import type { Tier } from "../data/tiers";
import { classBadge, classColor, setClassTint } from "./classText";
import { fitText, text } from "./widgets";

/**
 * Ten ideas for a simpler pet card (the player picks one). Each card shows the pet big and only
 * one or two things more. Every style is drawn at 200 x 250.
 */
export interface CardState {
  level: number;
  /** copies toward the next level, 0..1 */
  frac: number;
  ready: boolean;
  equipped: boolean;
  exclusive: boolean;
  /** never rolled: a dark silhouette and a "?" */
  locked?: boolean;
  isNew?: boolean;
}

export const CARD_STYLE_NAMES = [
  "Clean Pop", "Simple Tile", "Bubble", "Name Strip", "Dark Gem",
  "Hexagon", "Holo Stars", "Platform", "Sticker", "Half & Half",
];

const W = 200;
const H = 250;

/** A white rounded card (tint it), with a soft glow in the middle. */
function whiteCard(scene: Phaser.Scene, key: string, w: number, h: number, r: number): string {
  return canvasTexture(scene, key, w + 8, h + 8, (c) => {
    rr(c, 4, 4, w, h, r);
    c.fillStyle = radial(c, w / 2 + 4, h * 0.42, w * 0.75, [[0, "#ffffff"], [1, "#c8c8c8"]]);
    c.fill();
  });
}

/** Just the ink outline and a gloss stripe of a rounded card (not tinted). */
function cardEdge(scene: Phaser.Scene, key: string, w: number, h: number, r: number, width = 6): string {
  return canvasTexture(scene, key, w + 8, h + 8, (c) => {
    rr(c, 4 + width / 2, 4 + width / 2, w - width, h - width, r);
    c.lineWidth = width;
    c.strokeStyle = INK;
    c.stroke();
    rr(c, 16, 14, w - 24, h * 0.16, r * 0.5);
    c.fillStyle = "rgba(255,255,255,0.35)";
    c.fill();
  });
}

function hexTex(scene: Phaser.Scene, key: string, r: number, line: boolean): string {
  return canvasTexture(scene, key, r * 2 + 12, r * 2 + 12, (c) => {
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      c.lineTo(r + 6 + Math.cos(a) * r, r + 6 + Math.sin(a) * r);
    }
    c.closePath();
    if (line) {
      c.lineWidth = 7;
      c.strokeStyle = INK;
      c.stroke();
    } else {
      c.fillStyle = radial(c, r + 6, r, r * 1.1, [[0, "#ffffff"], [1, "#bcbcbc"]]);
      c.fill();
    }
  });
}

const petImg = (scene: Phaser.Scene, x: number, y: number, id: string, size: number) => {
  const img = scene.add.image(x, y, petTexture(scene, id));
  return img.setScale(size / Math.max(img.width, img.height));
};

/** A small round "+" (ready to level up). */
const plus = (scene: Phaser.Scene, x: number, y: number) => {
  const c = scene.add.container(x, y, [scene.add.circle(0, 0, 20, 0x6fd64a).setStrokeStyle(5, INK_N), text(scene, 0, -2, "+", 32)]);
  scene.tweens.add({ targets: c, scale: 1.18, duration: 380, yoyo: true, repeat: -1, ease: "Sine.inOut" });
  return c;
};
const check = (scene: Phaser.Scene, x: number, y: number) => scene.add.image(x, y, "icon_check").setScale(0.42);

/** One card in style `n` (0..9). */
export function cardOption(scene: Phaser.Scene, x: number, y: number, id: string, n: number, st: CardState): Phaser.GameObjects.Container {
  const def = ITEMS[id];
  const cls: Tier = def.cls;
  const col = st.exclusive ? 0xb36aff : classColor(cls);
  const parts: Phaser.GameObjects.GameObject[] = [];
  const tint = (o: Phaser.GameObjects.Image) => {
    if (st.exclusive) o.setTint(0xb36aff, 0xff4fd8, 0x6a4ae0, 0xb36aff);
    else setClassTint(o, cls);
    return o;
  };
  const letter = st.exclusive ? "EX" : cls;
  switch (n) {
    case 0: {
      // a bright class-coloured square, the pet on a sunburst, a small level number
      parts.push(tint(scene.add.image(0, 0, whiteCard(scene, "co_card", W, 220, 36))));
      const rays = scene.add.image(0, -6, "rays").setScale(0.36).setAlpha(0.45);
      scene.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
      parts.push(rays, scene.add.image(0, 0, cardEdge(scene, "co_edge", W, 220, 36)), petImg(scene, 0, -4, id, 170));
      parts.push(scene.add.circle(W / 2 - 30, 220 / 2 - 30, 24, INK_N), text(scene, W / 2 - 30, 220 / 2 - 31, `${st.level}`, 28));
      if (st.ready) parts.push(plus(scene, W / 2 - 26, -220 / 2 + 26));
      if (st.equipped) parts.push(check(scene, -W / 2 + 30, 220 / 2 - 30));
      break;
    }
    case 1: {
      // a white tile with a thick class-coloured rim, a tiny class tag and "Lv 5"
      const rim = tint(scene.add.image(0, 0, whiteCard(scene, "co_rim", W, 230, 30)));
      parts.push(rim, scene.add.rectangle(0, 0, W - 26, 230 - 26, 0xf6f8fc).setStrokeStyle(0), scene.add.image(0, 0, cardEdge(scene, "co_rim_e", W, 230, 30)));
      parts.push(petImg(scene, 0, -12, id, 165));
      parts.push(text(scene, 0, 230 / 2 - 34, `Lv ${st.level}`, 26, "#3a4a66", { stroke: false }));
      if (!st.exclusive) parts.push(classBadge(scene, -W / 2 + 10, -230 / 2 + 10, cls, 34));
      else parts.push(text(scene, -W / 2 + 34, -230 / 2 + 26, "EX", 26, "#b36aff"));
      if (st.ready) parts.push(plus(scene, W / 2 - 24, -230 / 2 + 24));
      if (st.equipped) parts.push(check(scene, W / 2 - 28, 230 / 2 - 34));
      break;
    }
    case 2: {
      // a round bubble; the pet pops out of its top; the ring around fills with copies
      const bubble = tint(scene.add.image(0, 20, canvasTexture(scene, "co_bub", 200, 200, (c) => {
        c.beginPath();
        c.arc(100, 100, 90, 0, Math.PI * 2);
        c.fillStyle = radial(c, 80, 70, 110, [[0, "#ffffff"], [1, "#b8b8b8"]]);
        c.fill();
      })));
      const ring = scene.add.graphics();
      ring.lineStyle(14, INK_N, 1).strokeCircle(0, 20, 92);
      ring.lineStyle(9, st.ready ? 0x7ad651 : 0xffffff, 1).beginPath().arc(0, 20, 92, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (st.ready ? 1 : st.frac)).strokePath();
      const gloss = scene.add.ellipse(-34, -26, 50, 26, 0xffffff, 0.5).setAngle(-30);
      parts.push(bubble, ring, gloss, petImg(scene, 0, -6, id, 175));
      parts.push(scene.add.rectangle(0, 112, 76, 36, INK_N).setStrokeStyle(0), text(scene, 0, 110, `${st.level}`, 26));
      if (st.equipped) parts.push(check(scene, 74, 96));
      break;
    }
    case 3: {
      // the pet on a gradient card; only its name, on a ribbon in its class colour
      parts.push(tint(scene.add.image(0, 0, whiteCard(scene, "co_strip", W, H, 26))), scene.add.image(0, 0, cardEdge(scene, "co_strip_e", W, H, 26)));
      parts.push(petImg(scene, 0, -28, id, 170));
      const rib = scene.add.image(0, H / 2 - 38, canvasTexture(scene, "co_rib", W + 20, 64, (c) => {
        c.beginPath();
        c.moveTo(4, 8);
        c.lineTo(W + 16, 8);
        c.lineTo(W + 6, 32);
        c.lineTo(W + 16, 56);
        c.lineTo(4, 56);
        c.lineTo(14, 32);
        c.closePath();
        c.fillStyle = "#5a5a5a";
        c.fill();
        c.lineWidth = 5;
        c.strokeStyle = INK;
        c.stroke();
      }));
      rib.setTint(darken(col, 0.15));
      parts.push(rib, fitText(text(scene, 0, H / 2 - 40, def.name, 26), W - 30));
      if (st.ready) parts.push(plus(scene, W / 2 - 22, -H / 2 + 22));
      if (st.equipped) parts.push(check(scene, -W / 2 + 26, -H / 2 + 26));
      break;
    }
    case 4: {
      // dark card, the pet glowing in its class colour, a gem with the class, a thin bar
      // the card is its class colour, just dark (grey drawn, then tinted)
      parts.push(scene.add.image(0, 0, canvasTexture(scene, "co_dark", W + 8, H + 8, (c) => {
        rr(c, 4, 4, W, H, 26);
        c.fillStyle = linear(c, 0, 0, 0, H, [[0, "#ffffff"], [1, "#8c8c8c"]]);
        c.fill();
        c.lineWidth = 5;
        c.strokeStyle = "#000000";
        c.stroke();
      })).setTint(darken(col, st.locked ? 0.78 : 0.62)));
      const glow = scene.add.image(0, -12, "glow").setTint(col).setScale(1.5).setAlpha(0.75);
      scene.tweens.add({ targets: glow, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
      if (st.locked) {
        const sil = scene.add.image(0, -14, lockedTexture(scene, id)).setAlpha(0.8);
        parts.push(glow.setAlpha(0.3), sil.setScale(165 / Math.max(sil.width, sil.height)));
      } else parts.push(glow, petImg(scene, 0, -14, id, 165));
      const gem = tint(scene.add.image(-W / 2 + 32, -H / 2 + 32, canvasTexture(scene, "co_gem", 60, 60, (c) => {
        c.beginPath();
        c.moveTo(30, 4);
        c.lineTo(56, 30);
        c.lineTo(30, 56);
        c.lineTo(4, 30);
        c.closePath();
        c.fillStyle = radial(c, 24, 22, 34, [[0, "#ffffff"], [1, "#b0b0b0"]]);
        c.fill();
        c.lineWidth = 4;
        c.strokeStyle = "#0a0d1a";
        c.stroke();
      })));
      parts.push(gem, text(scene, -W / 2 + 32, -H / 2 + 31, letter, letter.length > 2 ? 15 : 20, "#ffffff", { stroke: 4 }));
      if (st.locked) parts.push(text(scene, 0, H / 2 - 30, "?", 34, "#8a92b8"));
      else {
        const bar = scene.add.graphics();
        bar.fillStyle(0x0a0d1a, 1).fillRoundedRect(-W / 2 + 22, H / 2 - 30, W - 44, 12, 6);
        bar.fillStyle(st.ready ? 0x7ad651 : col, 1).fillRoundedRect(-W / 2 + 22, H / 2 - 30, (W - 44) * (st.ready ? 1 : Math.max(0.08, st.frac)), 12, 6);
        parts.push(bar);
      }
      if (st.isNew) {
        const nw = text(scene, W / 2 - 22, -H / 2 - 4, "NEW!", 30, "#ff6a8a").setAngle(14);
        scene.tweens.add({ targets: nw, scale: 1.15, duration: 400, yoyo: true, repeat: -1 });
        parts.push(nw);
      }
      if (st.ready) parts.push(plus(scene, W / 2 - 24, -H / 2 + 24));
      if (st.equipped) parts.push(check(scene, W / 2 - 26, H / 2 - 52));
      break;
    }
    case 5: {
      // a hexagon in the class colour; the level in a little hexagon below
      parts.push(tint(scene.add.image(0, -6, hexTex(scene, "co_hex", 110, false))), scene.add.image(0, -6, hexTex(scene, "co_hex_l", 110, true)));
      parts.push(petImg(scene, 0, -10, id, 160));
      parts.push(scene.add.image(0, 100, hexTex(scene, "co_hexs", 26, false)).setTint(INK_N), text(scene, 0, 99, `${st.level}`, 24));
      if (st.ready) parts.push(plus(scene, 76, -82));
      if (st.equipped) parts.push(check(scene, -78, 76));
      break;
    }
    case 6: {
      // a shiny card (rainbow foil for the top classes); the level as stars
      const foil = st.exclusive || ["S", "SSS", "uSSS"].includes(cls);
      const bg = scene.add.image(0, 0, foil
        ? canvasTexture(scene, "co_foil", W + 8, H + 8, (c) => {
          rr(c, 4, 4, W, H, 24);
          c.fillStyle = rainbowGradient(c, 0, 0, W, H);
          c.fill();
          rr(c, 4, 4, W, H, 24);
          c.fillStyle = "rgba(255,255,255,0.35)";
          c.fill();
        })
        : whiteCard(scene, "co_holo", W, H, 24));
      if (!foil) bg.setTint(lighten(col, 0.45));
      parts.push(bg, scene.add.image(0, 0, cardEdge(scene, "co_holo_e", W, H, 24)));
      // a shine sweeping across
      const shine = scene.add.rectangle(-W, 0, 34, H * 1.3, 0xffffff, 0.5).setAngle(20);
      scene.tweens.add({ targets: shine, x: W, duration: 1600, repeat: -1, repeatDelay: 900 });
      parts.push(shine, petImg(scene, 0, -20, id, 165));
      const stars = Math.min(5, Math.ceil(st.level / 6));
      for (let k = 0; k < 5; k++) {
        const s = scene.add.image(-64 + k * 32, H / 2 - 32, canvasTexture(scene, "co_star", 34, 34, (c) => {
          starPath(c, 17, 17, 15);
          c.fillStyle = "#ffffff";
          c.fill();
          c.lineWidth = 3;
          c.strokeStyle = INK;
          c.stroke();
        }));
        s.setTint(k < stars ? 0xffd23f : 0x9a9a9a);
        parts.push(s);
      }
      if (st.ready) parts.push(plus(scene, W / 2 - 22, -H / 2 + 22));
      if (st.equipped) parts.push(check(scene, -W / 2 + 26, -H / 2 + 26));
      break;
    }
    case 7: {
      // no card: the pet stands on a glowing platform in its class colour; dots for the level
      const glow = scene.add.image(0, 64, "glow").setTint(col).setScale(1.6, 0.6).setAlpha(0.9);
      scene.tweens.add({ targets: glow, alpha: 0.5, duration: 800, yoyo: true, repeat: -1 });
      const pad = tint(scene.add.image(0, 74, canvasTexture(scene, "co_pad", 180, 70, (c) => {
        c.beginPath();
        c.ellipse(90, 32, 84, 28, 0, 0, Math.PI * 2);
        c.fillStyle = radial(c, 90, 26, 90, [[0, "#ffffff"], [1, "#b0b0b0"]]);
        c.fill();
        c.lineWidth = 5;
        c.strokeStyle = INK;
        c.stroke();
      })));
      parts.push(glow, pad, petImg(scene, 0, -10, id, 175));
      for (let k = 0; k < 5; k++) parts.push(scene.add.circle(-40 + k * 20, 116, 7, k < Math.ceil(st.level / 6) ? 0xffd23f : 0x6a6a7a).setStrokeStyle(3, INK_N));
      parts.push(text(scene, 70, -100, letter, 30, "#ffffff"));
      if (!st.exclusive) setClassTint(parts[parts.length - 1] as Phaser.GameObjects.Text, cls);
      if (st.ready) parts.push(plus(scene, -72, -96));
      if (st.equipped) parts.push(check(scene, 76, 70));
      break;
    }
    case 8: {
      // a sticker: the pet with a thick white edge on a pastel square, a bit tilted
      parts.push(scene.add.image(0, 0, whiteCard(scene, "co_stk", W - 10, H - 30, 30)).setTint(lighten(col, 0.6)));
      const tex = petTexture(scene, id);
      const base = petImg(scene, 0, -6, id, 165);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        parts.push(scene.add.image(Math.cos(a) * 7, -6 + Math.sin(a) * 7, tex).setScale(base.scale).setTintFill(0xffffff));
      }
      parts.push(base);
      const bub = scene.add.container(64, -84, [scene.add.circle(0, 0, 26, 0xffffff).setStrokeStyle(4, INK_N), text(scene, 0, -1, letter, letter.length > 2 ? 18 : 24, rgba(darken(col, 0.2)), { stroke: false })]);
      parts.push(bub);
      if (st.ready) parts.push(plus(scene, -70, -86));
      if (st.equipped) parts.push(check(scene, 70, 86));
      parts.push(text(scene, -64, 92, `${st.level}`, 26));
      break;
    }
    default: {
      // top half in the class colour, white below; the pet sits across; a chunky level bar
      parts.push(scene.add.image(0, 0, canvasTexture(scene, "co_half", W + 8, H + 8, (c) => {
        rr(c, 4, 4, W, H, 26);
        c.fillStyle = "#f6f8fc";
        c.fill();
      })));
      const top = tint(scene.add.image(0, -H / 4 + 2, canvasTexture(scene, "co_half_t", W, H / 2, (c) => {
        rr(c, 0, 0, W, H / 2 + 30, 26);
        c.fillStyle = "#ffffff";
        c.fill();
      })).setCrop(0, 0, W, H / 2));
      parts.push(top, scene.add.image(0, 0, cardEdge(scene, "co_half_e", W, H, 26)), petImg(scene, 0, -10, id, 160));
      const bar = scene.add.graphics();
      bar.fillStyle(INK_N, 1).fillRoundedRect(-W / 2 + 16, H / 2 - 50, W - 32, 34, 17);
      bar.fillStyle(0x5b3a24, 1).fillRoundedRect(-W / 2 + 20, H / 2 - 46, W - 40, 26, 13);
      bar.fillStyle(st.ready ? 0x7ad651 : 0x5ac8ff, 1).fillRoundedRect(-W / 2 + 20, H / 2 - 46, Math.max(26, (W - 40) * (st.ready ? 1 : st.frac)), 26, 13);
      parts.push(bar, text(scene, 0, H / 2 - 34, st.ready ? "LEVEL UP!" : `Lv ${st.level}`, 22));
      if (st.equipped) parts.push(check(scene, W / 2 - 26, -H / 2 + 26));
      break;
    }
  }
  return scene.add.container(x, y, parts).setSize(W, H).setAngle(n === 8 ? -3 : 0);
}

/** A page showing styles `from`..`from+4`, four sample pets each (for choosing). */
export function cardShowcase(scene: Phaser.Scene, from: number): Phaser.GameObjects.Container {
  const SW = scene.scale.width;
  const SH = scene.scale.height;
  const root = scene.add.container(0, 0).setDepth(9500);
  root.add(scene.add.rectangle(0, 0, SW, SH, 0x1e2440).setOrigin(0));
  root.add(text(scene, SW / 2, 60, `PET CARD OPTIONS ${from + 1}-${from + 5}`, 54, "#ffe066"));
  const byClass = (c: Tier) => PET_LIST.find((p) => p.cls === c)!.id;
  const samples: [string, CardState][] = [
    [byClass("A"), { level: 3, frac: 0.4, ready: false, equipped: false, exclusive: false }],
    [byClass("C"), { level: 8, frac: 1, ready: true, equipped: false, exclusive: false }],
    [byClass("S"), { level: 22, frac: 0.7, ready: false, equipped: true, exclusive: false }],
    [PREMIUM[4].def.id, { level: 12, frac: 0.3, ready: false, equipped: false, exclusive: true }],
  ];
  const rowH = (SH - 140) / 5;
  for (let i = 0; i < 5; i++) {
    const n = from + i;
    const y = 130 + i * rowH;
    root.add(text(scene, 40, y + 4, `${n + 1}. ${CARD_STYLE_NAMES[n]}`, 40, "#ffffff").setOrigin(0, 0.5));
    samples.forEach(([id, st], k) => {
      const sc = Math.min(1, (rowH - 70) / H);
      root.add(cardOption(scene, SW / 2 + (k - 1.5) * 240, y + 50 + (H * sc) / 2, id, n, st).setScale(sc));
    });
  }
  return root;
}

/**
 * The pet card the game uses (the "Dark Gem" style the player picked): dark card, the pet glowing in
 * its class colour, a gem with the class, a thin bar of copies toward the next level, a green "+" when
 * it can level up and a check when it is on your team. Never-rolled pets are dark silhouettes.
 */
export function gemCard(scene: Phaser.Scene, x: number, y: number, id: string, opts: { equipped?: boolean; isNew?: boolean } = {}): Phaser.GameObjects.Container {
  const p = save.pets[id];
  const need = p ? copiesFor(p.level) : 1;
  const max = !!p && p.level >= MAX_LEVEL;
  const st: CardState = {
    level: p?.level ?? 1,
    frac: max ? 1 : p ? Math.min(1, p.copies / need) : 0,
    ready: !!p && !max && p.copies >= need,
    equipped: !!opts.equipped,
    exclusive: isPremium(id),
    locked: !p,
    isNew: opts.isNew,
  };
  return cardOption(scene, x, y, id, 4, st);
}
