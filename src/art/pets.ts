import Phaser from "phaser";
import { ITEMS, ItemDef } from "../data/items";
import { Species } from "../data/pets";
import { Ctx, boltPath, canvasTexture, darken, hexToNum, lighten, linear, mix, radial, rgba, starPath, twinkle } from "./draw";

/**
 * Pet art: chunky outlines in a deep shade of each pet's colour, soft two-tone shading,
 * small shiny eyes and blush. Each species is hand-shaped; accessories and patterns
 * are layered on top. Textures are drawn on first use.
 */
export const PET_SIZE = 160;
/** Canvas height: extra room on top for hats, halos and flames. */
export const PET_H = 178;
const HEADROOM = PET_H - PET_SIZE;
export const petKey = (id: string) => `pet_${id}`;

const EYE = "#2a1f2d";
const LW = 6;

interface Pal {
  body: number;
  accent: number;
  /** outline colour */
  ol: string;
  pattern: string;
  eyes: string;
  seed: number;
}

/** Where hats sit (top of the head), how wide the head is, where the face and back are. */
interface Anchor {
  top: [number, number];
  hr: number;
  face: [number, number];
  back: [number, number];
}

const lum = (c: number) => (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;

function palette(def: ItemDef): Pal {
  const body = hexToNum(def.color);
  const accent = def.accent ? hexToNum(def.accent) : lighten(body, 0.55);
  const ol = rgba(lum(body) < 0.25 ? 0x0e0a18 : mix(darken(body, 0.62), 0x2b1d2e, 0.45));
  return { body, accent, ol, pattern: def.pattern, eyes: def.eyes, seed: def.index * 7919 + 13 };
}

function rand(P: Pal): () => number {
  let s = P.seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ───────────────────────── shape helpers ─────────────────────────

let ctx: Ctx;

/** Ellipse sub-path (no beginPath, so several can be joined into one silhouette). */
function E(x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}
const C = (x: number, y: number, r: number) => E(x, y, r, r);

/** Rounded polygon sub-path, always wound the same way as ellipses so unions fill solid. */
function poly(pts: [number, number][], r = 6): void {
  let area = 0;
  pts.forEach(([x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length];
    area += x * ny - nx * y;
  });
  const p = area < 0 ? [...pts].reverse() : pts;
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(p[p.length - 1], p[0]);
  ctx.moveTo(start[0], start[1]);
  p.forEach((pt, i) => {
    const next = p[(i + 1) % p.length];
    ctx.arcTo(pt[0], pt[1], ...mid(pt, next), r);
  });
  ctx.closePath();
}

/**
 * One outlined, shaded piece. The outline is a double-width stroke drawn first,
 * so joined sub-paths get a single clean outline around the whole silhouette.
 */
function part(P: Pal, path: () => void, color: number, deco?: () => void, lw = LW): void {
  ctx.beginPath();
  path();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = lw * 2;
  ctx.strokeStyle = P.ol;
  ctx.stroke();
  ctx.fillStyle = rgba(darken(color, 0.15));
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.translate(-3, -5);
  ctx.beginPath();
  path();
  ctx.fillStyle = rgba(color);
  ctx.fill();
  ctx.translate(3, 5);
  deco?.();
  ctx.restore();
}

/** Thick outlined stroke (tails, legs, stalks). */
function tube(P: Pal, path: () => void, w: number, color: number): void {
  ctx.beginPath();
  path();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = w + LW * 2;
  ctx.strokeStyle = P.ol;
  ctx.stroke();
  ctx.lineWidth = w;
  ctx.strokeStyle = rgba(color);
  ctx.stroke();
}

function paint(color: string | CanvasGradient, path: () => void): void {
  ctx.beginPath();
  path();
  ctx.fillStyle = color;
  ctx.fill();
}

const gloss = (x: number, y: number, rx: number, ry: number, rot = -0.5) => paint("rgba(255,255,255,0.42)", () => E(x, y, rx, ry, rot));

// ───────────────────────── faces ─────────────────────────

function eye(P: Pal, x: number, y: number, s: number): void {
  switch (P.eyes) {
    case "happy":
      ctx.beginPath();
      ctx.moveTo(x - 6 * s, y + 2 * s);
      ctx.quadraticCurveTo(x, y - 7 * s, x + 6 * s, y + 2 * s);
      ctx.lineWidth = 4 * s;
      ctx.lineCap = "round";
      ctx.strokeStyle = EYE;
      ctx.stroke();
      return;
    case "glow": {
      const g = rgba(lighten(P.accent, 0.3), 0.55);
      paint(radial(ctx, x, y, 13 * s, [[0, "rgba(255,255,255,0.9)"], [0.45, g], [1, "rgba(255,255,255,0)"]]), () => C(x, y, 13 * s));
      paint("#ffffff", () => E(x, y, 5 * s, 6.6 * s));
      return;
    }
    case "star":
      starPath(ctx, x, y, 8 * s, 0.5);
      ctx.fillStyle = "#ffe066";
      ctx.fill();
      ctx.lineWidth = 2.4 * s;
      ctx.strokeStyle = EYE;
      ctx.lineJoin = "round";
      ctx.stroke();
      return;
    default:
      paint(EYE, () => E(x, y, 5.4 * s, 7 * s));
      paint("#ffffff", () => C(x - 1.8 * s, y - 2.6 * s, 2.3 * s));
      paint("rgba(255,255,255,0.8)", () => C(x + 1.9 * s, y + 2.8 * s, 1.1 * s));
  }
}

function mouth(x: number, y: number, kind: "w" | "smile" | "o" | "open", s = 1): void {
  ctx.lineWidth = 3.2 * s;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = EYE;
  ctx.beginPath();
  if (kind === "w") {
    ctx.moveTo(x - 6 * s, y - 1 * s);
    ctx.quadraticCurveTo(x - 3 * s, y + 4 * s, x, y);
    ctx.quadraticCurveTo(x + 3 * s, y + 4 * s, x + 6 * s, y - 1 * s);
    ctx.stroke();
  } else if (kind === "smile") {
    ctx.moveTo(x - 7 * s, y - 2 * s);
    ctx.quadraticCurveTo(x, y + 6 * s, x + 7 * s, y - 2 * s);
    ctx.stroke();
  } else if (kind === "o") {
    paint(EYE, () => E(x, y + 1 * s, 3.6 * s, 4.4 * s));
  } else {
    ctx.moveTo(x - 6 * s, y - 2 * s);
    ctx.quadraticCurveTo(x, y + 9 * s, x + 6 * s, y - 2 * s);
    ctx.closePath();
    ctx.fillStyle = EYE;
    ctx.fill();
    paint("#ff7d8f", () => E(x, y + 3 * s, 3 * s, 2 * s));
  }
}

function blush(x1: number, x2: number, y: number, s = 1): void {
  paint("rgba(255,105,140,0.42)", () => {
    E(x1, y, 7 * s, 4 * s);
    E(x2, y, 7 * s, 4 * s);
  });
}

/** Two eyes, blush and a mouth. */
function face(P: Pal, cx: number, cy: number, gap: number, s = 1, m: "w" | "smile" | "o" | "open" = "w"): void {
  eye(P, cx - gap, cy, s);
  eye(P, cx + gap, cy, s);
  blush(cx - gap - 8 * s, cx + gap + 8 * s, cy + 10 * s, s);
  mouth(cx, cy + 9 * s, m, s);
}

// ───────────────────────── patterns (drawn inside the main body) ─────────────────────────

function pattern(P: Pal, base: number, cx: number, cy: number, rx: number, ry: number): void {
  const r = rand(P);
  switch (P.pattern) {
    case "spots": {
      const c = lum(base) > 0.6 ? mix(base, 0x6b4a3a, 0.5) : lighten(base, 0.75);
      for (let i = 0; i < 7; i++) {
        const a = r() * Math.PI * 2;
        const d = 0.25 + r() * 0.6;
        paint(rgba(c), () => E(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 5 + r() * 5, 4 + r() * 4));
      }
      return;
    }
    case "stripes":
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.strokeStyle = rgba(darken(base, 0.22));
      for (const dx of [-0.35, 0, 0.35]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * rx - 6, cy - ry * 1.05);
        ctx.quadraticCurveTo(cx + dx * rx + 4, cy - ry * 0.7, cx + dx * rx - 2, cy - ry * 0.45);
        ctx.stroke();
      }
      return;
    case "galaxy": {
      paint(radial(ctx, cx - rx * 0.2, cy - ry * 0.2, Math.max(rx, ry) * 1.3, [[0, rgba(lighten(base, 0.25))], [1, rgba(darken(base, 0.35))]]),
        () => E(cx, cy, rx * 1.6, ry * 1.6));
      paint(rgba(P.accent, 0.4), () => E(cx + rx * 0.25, cy - ry * 0.15, rx * 0.55, ry * 0.25, -0.5));
      paint(rgba(lighten(P.accent, 0.4), 0.3), () => E(cx - rx * 0.3, cy + ry * 0.3, rx * 0.4, ry * 0.18, 0.4));
      for (let i = 0; i < 16; i++) paint("rgba(255,255,255,0.9)", () => C(cx + (r() - 0.5) * rx * 1.8, cy + (r() - 0.5) * ry * 1.8, 0.8 + r() * 1.6));
      for (let i = 0; i < 3; i++) twinkle(ctx, cx + (r() - 0.5) * rx * 1.4, cy + (r() - 0.5) * ry * 1.4, 5 + r() * 3);
      return;
    }
    case "stars":
      for (let i = 0; i < 4; i++) twinkle(ctx, cx + (r() - 0.5) * rx * 1.4, cy + (r() - 0.3) * ry * 1.2, 5 + r() * 3, "#fff3a0");
      return;
    case "gold":
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.7);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(-150, -18, 300, 11);
      ctx.fillRect(-150, -2, 300, 5);
      ctx.restore();
      return;
    case "frost":
      paint("rgba(255,255,255,0.9)", () => {
        ctx.moveTo(cx - rx * 1.2, cy - ry * 1.2);
        ctx.lineTo(cx + rx * 1.2, cy - ry * 1.2);
        ctx.lineTo(cx + rx * 1.2, cy - ry * 0.55);
        for (let i = 6; i >= 0; i--) {
          const x = cx - rx * 1.2 + (i / 6) * rx * 2.4;
          ctx.quadraticCurveTo(x + rx * 0.2, cy - ry * (i % 2 ? 0.25 : 0.6), x, cy - ry * 0.55);
        }
        ctx.closePath();
      });
      return;
    case "cracks":
      ctx.save();
      ctx.shadowColor = "#ffb03b";
      ctx.shadowBlur = 8;
      ctx.strokeStyle = "#ffd36b";
      ctx.lineWidth = 3.5;
      ctx.lineJoin = "round";
      for (let i = 0; i < 3; i++) {
        let x = cx + (r() - 0.5) * rx * 1.2;
        let y = cy - ry * 0.7 + r() * ry * 0.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 3; k++) {
          x += (r() - 0.5) * 22;
          y += 10 + r() * 10;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
      return;
  }
}

// ───────────────────────── species ─────────────────────────

const ORANGE = 0xffa53a;

const SPECIES: Record<Species, (P: Pal) => Anchor> = {
  blob: (P) => {
    part(P, () => {
      ctx.moveTo(30, 147);
      ctx.bezierCurveTo(12, 146, 16, 110, 34, 90);
      ctx.bezierCurveTo(48, 70, 58, 44, 84, 42);
      ctx.bezierCurveTo(114, 42, 134, 74, 137, 106);
      ctx.bezierCurveTo(140, 134, 134, 148, 120, 148);
      ctx.closePath();
    }, P.body, () => {
      paint(rgba(lighten(P.body, 0.18)), () => E(84, 130, 40, 16));
      pattern(P, P.body, 82, 100, 52, 48);
    });
    gloss(60, 72, 13, 7);
    face(P, 86, 102, 15, 1.15);
    return { top: [84, 46], hr: 40, face: [86, 102], back: [84, 96] };
  },

  bunny: (P) => {
    part(P, () => C(28, 128, 13), lighten(P.body, 0.35));
    part(P, () => {
      E(72, 58, 27, 12, 0.66);
      E(88, 52, 25, 11, 0.95);
    }, P.body, () => paint(rgba(P.accent), () => {
      E(72, 57, 17, 5.5, 0.66);
      E(88, 51, 15, 5, 0.95);
    }));
    part(P, () => {
      ctx.moveTo(40, 148);
      ctx.bezierCurveTo(14, 148, 14, 104, 38, 88);
      ctx.bezierCurveTo(56, 74, 84, 70, 104, 74);
      ctx.bezierCurveTo(130, 78, 142, 100, 140, 122);
      ctx.bezierCurveTo(139, 142, 130, 148, 118, 148);
      ctx.closePath();
    }, P.body, () => pattern(P, P.body, 80, 110, 56, 36));
    part(P, () => {
      E(102, 146, 11, 6.5);
      E(126, 145, 10, 6.5);
    }, lighten(P.body, 0.2));
    gloss(64, 90, 14, 6, -0.3);
    face(P, 114, 106, 12, 1);
    return { top: [104, 78], hr: 32, face: [114, 106], back: [74, 94] };
  },

  cat: (P) => {
    tube(P, () => {
      ctx.moveTo(106, 140);
      ctx.quadraticCurveTo(148, 140, 136, 98);
    }, 12, P.body);
    part(P, () => E(80, 128, 38, 24), P.body, () => paint(rgba(P.accent), () => E(80, 136, 22, 16)));
    part(P, () => {
      E(80, 90, 50, 41);
      poly([[34, 80], [44, 30], [78, 56]], 8);
      poly([[82, 56], [116, 30], [126, 80]], 8);
    }, P.body, () => {
      paint(rgba(mix(P.accent, 0xff9ab0, 0.45)), () => {
        poly([[46, 62], [49, 42], [64, 54]], 3);
        poly([[96, 54], [111, 42], [114, 62]], 3);
      });
      pattern(P, P.body, 80, 90, 48, 40);
    });
    part(P, () => {
      E(63, 150, 12, 7);
      E(97, 150, 12, 7);
    }, lighten(P.body, 0.2));
    gloss(56, 66, 12, 6);
    face(P, 80, 94, 17, 1.1);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = rgba(darken(P.body, 0.45), 0.7);
    for (const s of [-1, 1]) {
      for (const dy of [-3, 4]) {
        ctx.beginPath();
        ctx.moveTo(80 + s * 34, 104 + dy);
        ctx.lineTo(80 + s * 48, 101 + dy * 1.6);
        ctx.stroke();
      }
    }
    return { top: [80, 52], hr: 46, face: [80, 94], back: [80, 112] };
  },

  pup: (P) => {
    tube(P, () => {
      ctx.moveTo(110, 132);
      ctx.quadraticCurveTo(134, 128, 132, 104);
    }, 10, P.body);
    part(P, () => E(80, 128, 36, 23), P.body, () => paint(rgba(P.accent), () => E(80, 136, 20, 15)));
    part(P, () => E(80, 88, 48, 40), P.body, () => pattern(P, P.body, 80, 88, 46, 38));
    const ear = darken(P.body, P.pattern === "spots" ? 0.25 : 0.12);
    part(P, () => {
      E(38, 94, 14, 26, 0.32);
      E(122, 94, 14, 26, -0.32);
    }, ear);
    part(P, () => E(80, 104, 20, 13), P.accent);
    paint(EYE, () => E(80, 97, 7, 5));
    paint("rgba(255,255,255,0.7)", () => E(78, 95.5, 2.4, 1.4));
    part(P, () => {
      E(63, 150, 12, 7);
      E(97, 150, 12, 7);
    }, lighten(P.body, 0.15));
    gloss(58, 64, 12, 6);
    eye(P, 62, 86, 1.1);
    eye(P, 98, 86, 1.1);
    blush(50, 110, 100);
    mouth(80, 107, "w", 0.9);
    return { top: [80, 50], hr: 46, face: [80, 88], back: [80, 110] };
  },

  bird: (P) => {
    part(P, () => {
      E(73, 52, 6.5, 13, -0.4);
      E(85, 50, 6.5, 14, 0.3);
    }, P.body);
    part(P, () => {
      E(34, 108, 14, 22, 0.5);
      E(126, 108, 14, 22, -0.5);
    }, darken(P.body, 0.1));
    part(P, () => E(80, 102, 48, 46), P.body, () => {
      paint(rgba(P.accent), () => E(80, 126, 30, 25));
      pattern(P, P.body, 80, 96, 46, 40);
    });
    tube(P, () => {
      ctx.moveTo(70, 146);
      ctx.lineTo(68, 153);
      ctx.moveTo(90, 146);
      ctx.lineTo(92, 153);
    }, 5, ORANGE);
    gloss(58, 72, 13, 7);
    eye(P, 64, 90, 1.1);
    eye(P, 96, 90, 1.1);
    blush(51, 109, 104);
    part(P, () => poly([[71, 97], [89, 97], [80, 110]], 4), 0xffb83f, undefined, 3.5);
    return { top: [80, 58], hr: 42, face: [80, 92], back: [80, 100] };
  },

  frog: (P) => {
    part(P, () => {
      E(36, 146, 14, 7);
      E(124, 146, 14, 7);
    }, darken(P.body, 0.08));
    part(P, () => {
      E(80, 118, 60, 32);
      C(54, 82, 20);
      C(106, 82, 20);
    }, P.body, () => {
      paint(rgba(P.accent), () => E(80, 136, 36, 14));
      pattern(P, P.body, 80, 108, 56, 34);
    });
    gloss(46, 72, 8, 5);
    gloss(98, 72, 8, 5);
    eye(P, 54, 84, 1.2);
    eye(P, 106, 84, 1.2);
    blush(40, 120, 112);
    ctx.beginPath();
    ctx.moveTo(62, 112);
    ctx.quadraticCurveTo(80, 126, 98, 112);
    ctx.lineWidth = 3.4;
    ctx.lineCap = "round";
    ctx.strokeStyle = EYE;
    ctx.stroke();
    return { top: [80, 66], hr: 48, face: [80, 100], back: [80, 110] };
  },

  snail: (P) => {
    tube(P, () => {
      ctx.moveTo(118, 74);
      ctx.lineTo(110, 48);
      ctx.moveTo(132, 72);
      ctx.lineTo(138, 48);
    }, 5, P.body);
    part(P, () => {
      C(110, 46, 6.5);
      C(138, 46, 6.5);
    }, P.body);
    part(P, () => {
      ctx.moveTo(18, 148);
      ctx.quadraticCurveTo(14, 134, 34, 134);
      ctx.lineTo(98, 134);
      ctx.bezierCurveTo(100, 104, 104, 74, 122, 70);
      ctx.bezierCurveTo(140, 66, 148, 90, 144, 110);
      ctx.bezierCurveTo(140, 130, 146, 146, 128, 148);
      ctx.closePath();
    }, P.body);
    part(P, () => C(62, 102, 38), P.accent, () => {
      pattern(P, P.accent, 62, 102, 36, 36);
      ctx.beginPath();
      for (let t = 0; t < Math.PI * 4.2; t += 0.15) {
        const r = 3 + t * 2.4;
        const x = 66 + Math.cos(t) * r;
        const y = 104 + Math.sin(t) * r;
        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 5;
      ctx.strokeStyle = rgba(darken(P.accent, 0.28));
      ctx.stroke();
    });
    gloss(44, 80, 10, 6);
    face(P, 126, 98, 8, 0.9, "smile");
    return { top: [124, 72], hr: 26, face: [126, 98], back: [62, 96] };
  },

  cricket: (P) => {
    const leg = darken(P.body, 0.2);
    part(P, () => E(56, 106, 26, 11, -0.65), leg);
    tube(P, () => {
      ctx.moveTo(38, 122);
      ctx.lineTo(28, 147);
      ctx.moveTo(96, 124);
      ctx.lineTo(98, 147);
      ctx.moveTo(110, 120);
      ctx.lineTo(120, 146);
    }, 5, leg);
    tube(P, () => {
      ctx.moveTo(122, 78);
      ctx.quadraticCurveTo(128, 40, 154, 26);
      ctx.moveTo(110, 78);
      ctx.quadraticCurveTo(104, 40, 122, 16);
    }, 2.5, darken(P.body, 0.35));
    part(P, () => E(74, 114, 40, 22, -0.12), P.body, () => pattern(P, P.body, 74, 114, 40, 22));
    part(P, () => E(64, 103, 38, 13, -0.2), P.accent, () => {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = rgba(darken(P.accent, 0.25));
      ctx.beginPath();
      ctx.moveTo(30, 110);
      ctx.lineTo(98, 96);
      ctx.moveTo(50, 98);
      ctx.lineTo(60, 112);
      ctx.moveTo(70, 94);
      ctx.lineTo(80, 108);
      ctx.stroke();
    });
    part(P, () => C(116, 100, 25), P.body);
    gloss(108, 86, 8, 5);
    face(P, 117, 101, 9, 0.95, "smile");
    return { top: [116, 76], hr: 24, face: [117, 101], back: [66, 100] };
  },

  bat: (P) => {
    ctx.translate(0, -8);
    const wing = (s: number) => {
      const m = (x: number) => (s < 0 ? 160 - x : x);
      poly([[m(56), 94], [m(14), 66], [m(10), 104], [m(26), 116], [m(44), 126], [m(60), 116]], 5);
    };
    part(P, () => {
      wing(1);
      wing(-1);
    }, P.accent, () => {
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(darken(P.accent, 0.3));
      ctx.beginPath();
      for (const s of [1, -1]) {
        const m = (x: number) => (s < 0 ? 160 - x : x);
        ctx.moveTo(m(54), 98);
        ctx.lineTo(m(18), 76);
        ctx.moveTo(m(54), 102);
        ctx.lineTo(m(26), 112);
      }
      ctx.stroke();
    });
    part(P, () => {
      E(80, 100, 36, 32);
      poly([[52, 82], [52, 44], [78, 72]], 6);
      poly([[82, 72], [108, 44], [108, 82]], 6);
    }, P.body, () => {
      paint(rgba(lighten(P.body, 0.3)), () => E(80, 116, 20, 14));
      pattern(P, P.body, 80, 96, 36, 32);
    });
    part(P, () => {
      E(72, 133, 5, 4);
      E(88, 133, 5, 4);
    }, darken(P.body, 0.2));
    gloss(64, 80, 9, 5);
    eye(P, 68, 98, 1);
    eye(P, 92, 98, 1);
    blush(58, 102, 108, 0.9);
    mouth(80, 106, "smile", 0.8);
    paint("#ffffff", () => {
      poly([[74, 109], [79, 109], [76.5, 116]], 1);
      poly([[81, 109], [86, 109], [83.5, 116]], 1);
    });
    ctx.translate(0, 8);
    return { top: [80, 62], hr: 34, face: [80, 92], back: [80, 88] };
  },

  fish: (P) => {
    ctx.translate(0, -6);
    part(P, () => poly([[46, 100], [12, 72], [24, 100], [12, 128]], 6), P.accent);
    part(P, () => {
      ctx.moveTo(58, 74);
      ctx.quadraticCurveTo(74, 42, 106, 56);
      ctx.lineTo(102, 76);
      ctx.closePath();
    }, P.accent);
    part(P, () => E(86, 100, 48, 36), P.body, () => {
      paint(rgba(lighten(P.body, 0.3)), () => E(92, 122, 40, 16));
      pattern(P, P.body, 86, 100, 46, 34);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = rgba(darken(P.body, 0.12));
      for (let row = 0; row < 3; row++) {
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(58 + k * 13, 86 + row * 13 + (k % 2) * 6, 6, -1.2, 1.2);
          ctx.stroke();
        }
      }
    });
    part(P, () => E(84, 114, 13, 8, 0.6), P.accent);
    gloss(78, 76, 14, 6, -0.2);
    if (P.eyes === "glow" || P.eyes === "star") {
      eye(P, 112, 92, 1.4);
    } else {
      part(P, () => C(112, 92, 12), 0xffffff, undefined, 3);
      paint(EYE, () => E(114, 93, 6.5, 7.5));
      paint("#ffffff", () => C(112, 90, 2.5));
    }
    part(P, () => C(134, 104, 4.5), 0xff8fa0, undefined, 3);
    blush(110, 110, 110, 0.9);
    ctx.translate(0, 6);
    return { top: [94, 58], hr: 36, face: [112, 92], back: [82, 90] };
  },

  beetle: (P) => {
    const leg = darken(P.accent, 0.1);
    tube(P, () => {
      ctx.moveTo(56, 128);
      ctx.lineTo(48, 147);
      ctx.moveTo(78, 132);
      ctx.lineTo(78, 148);
      ctx.moveTo(100, 128);
      ctx.lineTo(108, 147);
    }, 5, leg);
    part(P, () => {
      ctx.moveTo(126, 98);
      ctx.quadraticCurveTo(150, 84, 148, 56);
      ctx.quadraticCurveTo(142, 80, 122, 90);
      ctx.closePath();
    }, P.accent);
    part(P, () => C(120, 108, 21), P.accent);
    part(P, () => E(70, 102, 48, 35), P.body, () => {
      pattern(P, P.body, 70, 102, 46, 33);
      paint("rgba(255,255,255,0.35)", () => E(62, 82, 30, 7, -0.25));
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(darken(P.body, 0.3));
      ctx.beginPath();
      ctx.moveTo(30, 108);
      ctx.quadraticCurveTo(70, 118, 112, 100);
      ctx.stroke();
    });
    eye(P, 116, 104, 0.85);
    eye(P, 130, 104, 0.85);
    blush(110, 136, 114, 0.7);
    mouth(123, 112, "smile", 0.6);
    return { top: [72, 70], hr: 40, face: [123, 104], back: [70, 96] };
  },

  hamster: (P) => {
    part(P, () => {
      C(46, 70, 13);
      C(114, 70, 13);
    }, P.body, () => paint(rgba(mix(P.accent, 0xff9ab0, 0.5)), () => {
      C(47, 71, 6);
      C(113, 71, 6);
    }));
    part(P, () => {
      E(60, 150, 11, 6);
      E(100, 150, 11, 6);
    }, darken(P.body, 0.08));
    part(P, () => E(80, 108, 54, 43), P.body, () => {
      paint(rgba(P.accent), () => {
        E(80, 130, 36, 24);
        E(54, 112, 16, 12);
        E(106, 112, 16, 12);
      });
      pattern(P, P.body, 80, 100, 52, 40);
    });
    part(P, () => E(80, 124, 6, 9), 0xc9925a, undefined, 3.5);
    part(P, () => {
      E(70, 124, 8, 6);
      E(90, 124, 8, 6);
    }, lighten(P.body, 0.25), undefined, 3.5);
    gloss(56, 80, 12, 6);
    eye(P, 63, 98, 0.95);
    eye(P, 97, 98, 0.95);
    blush(50, 110, 110, 1.1);
    paint("#ff8fa3", () => E(80, 105, 4, 3));
    mouth(80, 111, "w", 0.7);
    return { top: [80, 66], hr: 48, face: [80, 100], back: [80, 104] };
  },

  bear: (P) => {
    const panda = P.pattern === "panda";
    const dark = panda ? P.accent : P.body;
    part(P, () => {
      C(44, 54, 16);
      C(116, 54, 16);
    }, dark, () => paint(rgba(panda ? lighten(P.accent, 0.15) : mix(P.accent, P.body, 0.3)), () => {
      C(45, 55, 8);
      C(115, 55, 8);
    }));
    part(P, () => E(80, 132, 36, 20), panda ? P.accent : P.body);
    part(P, () => E(80, 88, 48, 40), P.body, () => {
      if (panda) {
        paint(rgba(P.accent), () => {
          E(60, 88, 12, 15, 0.5);
          E(100, 88, 12, 15, -0.5);
        });
      } else {
        pattern(P, P.body, 80, 88, 46, 38);
      }
    });
    part(P, () => E(80, 101, 19, 13), panda ? 0xffffff : P.accent);
    paint(EYE, () => E(80, 95, 7, 5));
    part(P, () => {
      E(62, 150, 12, 7);
      E(98, 150, 12, 7);
    }, panda ? P.accent : lighten(P.body, 0.15));
    gloss(58, 64, 12, 6);
    if (panda) {
      for (const x of [60, 100]) {
        paint("#ffffff", () => C(x, 88, 5.5));
        paint(EYE, () => C(x + 1, 89, 3.5));
      }
    } else {
      eye(P, 62, 86, 1.05);
      eye(P, 98, 86, 1.05);
    }
    blush(50, 110, 102);
    mouth(80, 108, "w", 0.8);
    return { top: [80, 50], hr: 46, face: [80, 88], back: [80, 110] };
  },

  fox: (P) => {
    part(P, () => E(124, 112, 20, 38, 0.55), P.body, () => paint(rgba(P.accent), () => E(140, 86, 14, 16, 0.55)));
    part(P, () => E(78, 130, 34, 21), P.body, () => paint(rgba(P.accent), () => E(78, 138, 18, 14)));
    part(P, () => {
      E(78, 90, 46, 37);
      poly([[34, 80], [38, 28], [72, 58]], 7);
      poly([[84, 58], [118, 28], [122, 80]], 7);
    }, P.body, () => {
      paint(rgba(darken(P.body, 0.35)), () => {
        poly([[44, 64], [45, 40], [62, 56]], 3);
        poly([[94, 56], [111, 40], [112, 64]], 3);
      });
      pattern(P, P.body, 78, 84, 44, 34);
      paint(rgba(P.accent), () => {
        E(58, 108, 24, 15, -0.3);
        E(98, 108, 24, 15, 0.3);
      });
    });
    paint(EYE, () => E(78, 101, 5, 4));
    part(P, () => {
      E(62, 150, 11, 7);
      E(94, 150, 11, 7);
    }, darken(P.body, 0.3));
    gloss(54, 70, 11, 6);
    eye(P, 60, 90, 1.05);
    eye(P, 96, 90, 1.05);
    blush(48, 108, 102);
    mouth(78, 108, "w", 0.75);
    return { top: [78, 54], hr: 44, face: [78, 92], back: [78, 110] };
  },

  penguin: (P) => {
    part(P, () => {
      E(38, 108, 11, 26, 0.35);
      E(122, 108, 11, 26, -0.35);
    }, P.body);
    part(P, () => E(80, 100, 44, 50), P.body, () => {
      pattern(P, P.body, 80, 80, 40, 30);
      paint(rgba(P.accent), () => {
        E(80, 118, 32, 33);
        C(66, 86, 17);
        C(94, 86, 17);
      });
    });
    part(P, () => {
      E(66, 150, 12, 6);
      E(94, 150, 12, 6);
    }, ORANGE);
    gloss(60, 64, 11, 6);
    eye(P, 67, 86, 0.95);
    eye(P, 93, 86, 0.95);
    blush(56, 104, 98, 0.9);
    part(P, () => poly([[71, 93], [89, 93], [80, 104]], 4), ORANGE, undefined, 3.5);
    return { top: [80, 52], hr: 42, face: [80, 88], back: [80, 96] };
  },

  ghost: (P) => {
    ctx.translate(0, -8);
    part(P, () => {
      E(32, 100, 9, 14, 0.5);
      E(128, 100, 9, 14, -0.5);
    }, P.body);
    part(P, () => {
      ctx.moveTo(34, 136);
      ctx.lineTo(34, 92);
      ctx.bezierCurveTo(34, 58, 56, 40, 80, 40);
      ctx.bezierCurveTo(104, 40, 126, 58, 126, 92);
      ctx.lineTo(126, 136);
      ctx.quadraticCurveTo(114.5, 150, 103, 136);
      ctx.quadraticCurveTo(91.5, 150, 80, 136);
      ctx.quadraticCurveTo(68.5, 150, 57, 136);
      ctx.quadraticCurveTo(45.5, 150, 34, 136);
      ctx.closePath();
    }, P.body, () => {
      paint(rgba(P.accent, 0.5), () => E(80, 138, 50, 12));
      pattern(P, P.body, 80, 92, 46, 48);
    });
    gloss(58, 62, 12, 7);
    face(P, 80, 88, 14, 1.1, "o");
    ctx.translate(0, 8);
    return { top: [80, 36], hr: 44, face: [80, 80], back: [80, 84] };
  },

  dragon: (P) => {
    const wing = (s: number) => {
      const m = (x: number) => (s < 0 ? 160 - x : x);
      poly([[m(54), 104], [m(20), 70], [m(26), 96], [m(12), 106], [m(32), 112], [m(28), 126], [m(54), 120]], 4);
    };
    part(P, () => {
      wing(1);
      wing(-1);
    }, P.accent);
    tube(P, () => {
      ctx.moveTo(104, 140);
      ctx.quadraticCurveTo(140, 144, 144, 114);
    }, 12, P.body);
    part(P, () => poly([[136, 114], [146, 92], [156, 114], [146, 120]], 4), P.accent);
    part(P, () => E(80, 130, 34, 21), P.body, () => {
      paint(rgba(P.accent), () => E(80, 138, 20, 15));
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = rgba(darken(P.accent, 0.25));
      for (const y of [130, 138, 146]) {
        ctx.beginPath();
        ctx.moveTo(66, y);
        ctx.lineTo(94, y);
        ctx.stroke();
      }
    });
    part(P, () => {
      poly([[56, 62], [46, 30], [70, 52]], 5);
      poly([[90, 52], [114, 30], [104, 62]], 5);
    }, P.accent);
    part(P, () => E(80, 90, 46, 38), P.body, () => pattern(P, P.body, 80, 88, 44, 36));
    gloss(58, 68, 12, 6);
    eye(P, 62, 88, 1.05);
    eye(P, 98, 88, 1.05);
    blush(50, 110, 101);
    paint(rgba(darken(P.body, 0.45)), () => {
      C(74, 100, 2.2);
      C(86, 100, 2.2);
    });
    mouth(80, 108, "smile", 0.8);
    paint("#ffffff", () => poly([[84, 109], [89, 109], [86.5, 115]], 1));
    return { top: [80, 54], hr: 44, face: [80, 90], back: [80, 110] };
  },

  axolotl: (P) => {
    part(P, () => {
      E(32, 72, 13, 6, -0.6);
      E(25, 90, 14, 6, 0);
      E(32, 108, 13, 6, 0.6);
      E(128, 72, 13, 6, 0.6);
      E(135, 90, 14, 6, 0);
      E(128, 108, 13, 6, -0.6);
    }, P.accent);
    part(P, () => E(120, 132, 22, 9, -0.35), P.body);
    part(P, () => E(82, 130, 30, 18), P.body);
    part(P, () => {
      E(66, 148, 9, 5);
      E(98, 148, 9, 5);
    }, P.body);
    part(P, () => E(80, 92, 50, 36), P.body, () => {
      paint(rgba(lighten(P.body, 0.3)), () => E(80, 112, 34, 12));
      pattern(P, P.body, 80, 90, 48, 34);
    });
    gloss(58, 70, 13, 6);
    eye(P, 58, 90, 1);
    eye(P, 102, 90, 1);
    blush(46, 114, 102);
    ctx.beginPath();
    ctx.moveTo(68, 101);
    ctx.quadraticCurveTo(80, 112, 92, 101);
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = EYE;
    ctx.stroke();
    return { top: [80, 58], hr: 46, face: [80, 94], back: [80, 100] };
  },

  turtle: (P) => {
    part(P, () => {
      E(42, 144, 12, 8);
      E(110, 144, 12, 8);
    }, P.body);
    part(P, () => poly([[28, 130], [12, 138], [28, 142]], 3), P.body);
    part(P, () => C(126, 108, 20), P.body);
    part(P, () => {
      ctx.moveTo(22, 136);
      ctx.bezierCurveTo(22, 72, 118, 70, 128, 136);
      ctx.closePath();
    }, P.accent, () => {
      pattern(P, P.accent, 74, 112, 50, 30);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = rgba(darken(P.accent, 0.25));
      ctx.beginPath();
      for (const [x, y] of [[54, 112], [76, 100], [98, 112], [76, 126]]) {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const px = x + Math.cos(a) * 11;
          const py = y + Math.sin(a) * 9;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      }
      ctx.stroke();
    });
    part(P, () => E(75, 136, 56, 7), lighten(P.accent, 0.3));
    gloss(56, 96, 14, 6, -0.4);
    gloss(118, 98, 6, 4);
    face(P, 127, 104, 7, 0.85, "smile");
    return { top: [74, 86], hr: 40, face: [127, 104], back: [74, 104] };
  },

  owl: (P) => {
    part(P, () => {
      E(36, 108, 13, 28, 0.25);
      E(124, 108, 13, 28, -0.25);
    }, darken(P.body, 0.1));
    part(P, () => {
      E(80, 102, 46, 48);
      poly([[42, 76], [40, 44], [66, 62]], 6);
      poly([[94, 62], [120, 44], [118, 76]], 6);
    }, P.body, () => {
      paint(rgba(P.accent), () => E(80, 130, 30, 22));
      pattern(P, P.body, 80, 96, 44, 44);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = rgba(darken(P.accent, 0.2));
      for (const [x, y] of [[70, 124], [90, 124], [80, 134], [64, 136], [96, 136]]) {
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 2);
        ctx.lineTo(x, y + 2);
        ctx.lineTo(x + 4, y - 2);
        ctx.stroke();
      }
      paint(rgba(lighten(P.accent, 0.25)), () => {
        C(63, 92, 19);
        C(97, 92, 19);
      });
    });
    part(P, () => {
      E(68, 150, 8, 5);
      E(92, 150, 8, 5);
    }, ORANGE, undefined, 4);
    eye(P, 63, 92, 1.45);
    eye(P, 97, 92, 1.45);
    part(P, () => poly([[73, 101], [87, 101], [80, 113]], 3), ORANGE, undefined, 3.5);
    return { top: [80, 60], hr: 42, face: [80, 94], back: [80, 100] };
  },
};

// ───────────────────────── accessories ─────────────────────────

type Acc = (P: Pal, A: Anchor) => void;

const GOLD_OL = "#8a5a10";

function solid(path: () => void, fillStyle: string | CanvasGradient, stroke: string, w = 4): void {
  ctx.beginPath();
  path();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = w * 2;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function wingShape(s: number, bx: number, by: number, bat: boolean): void {
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(s, 1);
  if (bat) {
    poly([[0, 0], [-30, -42], [-72, -38], [-62, -22], [-66, -8], [-50, -12], [-46, 2], [-32, -4], [-26, 10]], 3);
  } else {
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-14, -30, -52, -50, -76, -34);
    ctx.quadraticCurveTo(-62, -24, -68, -12);
    ctx.quadraticCurveTo(-52, -12, -56, 0);
    ctx.quadraticCurveTo(-40, -4, -40, 10);
    ctx.quadraticCurveTo(-22, 4, 0, 6);
    ctx.closePath();
  }
  ctx.restore();
}

const BACK: Record<string, Acc> = {
  wings: (_P, A) => {
    const [bx, by] = A.back;
    solid(() => {
      wingShape(1, bx - A.hr * 0.45, by - 6, false);
      wingShape(-1, bx + A.hr * 0.45, by - 6, false);
    }, linear(ctx, 0, by - 50, 0, by + 10, [[0, "#ffffff"], [1, "#ffeec8"]]), "#b8915a");
  },
  batwings: (_P, A) => {
    const [bx, by] = A.back;
    solid(() => {
      wingShape(1, bx - A.hr * 0.45, by - 4, true);
      wingShape(-1, bx + A.hr * 0.45, by - 4, true);
    }, linear(ctx, 0, by - 46, 0, by + 10, [[0, "#6a3a7a"], [1, "#2e1a3a"]]), "#140a1c");
  },
};

const FRONT: Record<string, Acc> = {
  crown: (_P, A) => {
    const [x, y0] = A.top;
    const y = y0 + 6;
    const w = A.hr * 1.05;
    const h = w * 0.55;
    solid(() => poly([[x - w / 2, y], [x - w / 2, y - h * 0.75], [x - w / 4, y - h * 0.4], [x, y - h], [x + w / 4, y - h * 0.4], [x + w / 2, y - h * 0.75], [x + w / 2, y]], 3),
      linear(ctx, 0, y - h, 0, y, [[0, "#fff0a0"], [1, "#ffb31f"]]), GOLD_OL);
    paint("#ff5a7a", () => C(x, y - h * 0.45, 4.5));
    paint("#5ad1ff", () => {
      C(x - w / 3, y - h * 0.25, 3.2);
      C(x + w / 3, y - h * 0.25, 3.2);
    });
  },
  halo: (_P, A) => {
    const [x, y] = A.top;
    ctx.beginPath();
    ctx.ellipse(x, y - 18, A.hr * 0.6, 9, 0, 0, Math.PI * 2);
    ctx.lineWidth = 16;
    ctx.strokeStyle = "rgba(255,230,120,0.4)";
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#ffcf3a";
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#fff7c8";
    ctx.stroke();
  },
  horns: (_P, A) => {
    const [x, y] = A.top;
    const g = linear(ctx, 0, y - 34, 0, y + 4, [[0, "#ff6a7a"], [1, "#5a1a2a"]]);
    for (const s of [-1, 1]) {
      const hx = x + s * A.hr * 0.45;
      solid(() => {
        ctx.moveTo(hx - 8 * s, y + 6);
        ctx.quadraticCurveTo(hx - 12 * s, y - 20, hx + 6 * s, y - 30);
        ctx.quadraticCurveTo(hx + 2 * s, y - 12, hx + 9 * s, y + 6);
        ctx.closePath();
      }, g, "#2a0a14", 3.5);
    }
  },
  flower: (_P, A) => {
    const x = A.top[0] + A.hr * 0.5;
    const y = A.top[1] + 12;
    solid(() => {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        E(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7.5, 6, a);
      }
    }, "#ffffff", "#b0806a", 3);
    solid(() => C(x, y, 6), "#ffc93a", "#b0806a", 2.5);
  },
  bow: (_P, A) => {
    const x = A.top[0] + A.hr * 0.5;
    const y = A.top[1] + 12;
    solid(() => {
      E(x - 11, y, 12, 8, -0.3);
      E(x + 11, y, 12, 8, 0.3);
    }, "#ff7aa8", "#a83a62", 3);
    solid(() => C(x, y, 5), "#ff9ac0", "#a83a62", 3);
  },
  sprout: (_P, A) => {
    const [x, y] = A.top;
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.quadraticCurveTo(x - 2, y - 6, x + 2, y - 14);
    ctx.lineWidth = 9;
    ctx.strokeStyle = "#2f5a1f";
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#6fcf4a";
    ctx.stroke();
    solid(() => {
      E(x - 10, y - 16, 11, 6, 0.4);
      E(x + 13, y - 19, 12, 6.5, -0.5);
    }, linear(ctx, 0, y - 26, 0, y - 8, [[0, "#a8f070"], [1, "#4fb83a"]]), "#2f5a1f", 3);
  },
  flame: (_P, A) => {
    const [x, y0] = A.top;
    const y = y0 + 10;
    solid(() => {
      ctx.moveTo(x - 18, y);
      ctx.bezierCurveTo(x - 24, y - 24, x - 6, y - 30, x - 4, y - 48);
      ctx.bezierCurveTo(x + 6, y - 34, x + 22, y - 30, x + 18, y);
      ctx.closePath();
    }, linear(ctx, 0, y - 48, 0, y, [[0, "#ffe066"], [1, "#ff5a1f"]]), "#9a2a0a", 3.5);
    paint("#fff3a0", () => {
      ctx.moveTo(x - 8, y);
      ctx.bezierCurveTo(x - 10, y - 12, x, y - 16, x + 1, y - 26);
      ctx.bezierCurveTo(x + 6, y - 16, x + 12, y - 12, x + 8, y);
      ctx.closePath();
    });
  },
  star: (_P, A) => {
    const x = A.top[0] + A.hr * 0.95;
    const y = A.top[1] - 2;
    solid(() => starPath(ctx, x, y, 14, 0.48), linear(ctx, 0, y - 14, 0, y + 14, [[0, "#fff6a8"], [1, "#ffbf1f"]]), "#9a6a0a", 3);
    twinkle(ctx, x + 14, y - 14, 5);
  },
  crystal: (_P, A) => {
    const [x, y0] = A.top;
    const y = y0 + 8;
    const g = linear(ctx, 0, y - 36, 0, y, [[0, "#e8fdff"], [1, "#48bff0"]]);
    solid(() => {
      poly([[x - 20, y], [x - 16, y - 20], [x - 10, y - 24], [x - 6, y]], 2);
      poly([[x - 7, y], [x - 4, y - 32], [x + 1, y - 38], [x + 7, y]], 2);
      poly([[x + 6, y], [x + 11, y - 18], [x + 17, y - 22], [x + 20, y]], 2);
    }, g, "#1f6a98", 3);
    paint("rgba(255,255,255,0.7)", () => poly([[x - 3, y - 6], [x - 1, y - 28], [x + 1, y - 6]], 1));
  },
  bolt: (_P, A) => {
    const x = A.top[0] + A.hr * 0.95;
    const y = A.top[1] + 12;
    solid(() => boltPath(ctx, x, y, 18), "#ffe14d", "#8a5a0a", 3);
  },
  wizard: (_P, A) => {
    const [x, y0] = A.top;
    const y = y0 + 6;
    const w = A.hr * 0.8;
    const g = linear(ctx, 0, y - 56, 0, y, [[0, "#8a6af0"], [1, "#4a2fa0"]]);
    solid(() => {
      ctx.moveTo(x - w * 0.62, y);
      ctx.quadraticCurveTo(x - 6, y - 30, x + 24, y - 54);
      ctx.quadraticCurveTo(x + 8, y - 26, x + w * 0.62, y);
      ctx.closePath();
    }, g, "#1f1450", 3.5);
    solid(() => E(x, y + 2, w, 8), "#5a3ac0", "#1f1450", 3.5);
    twinkle(ctx, x - 4, y - 22, 6, "#ffe066");
    twinkle(ctx, x + 10, y - 38, 4, "#ffe066");
  },
  beanie: (_P, A) => {
    const [x, y0] = A.top;
    const y = y0 + 14;
    const w = A.hr * 0.72;
    solid(() => {
      ctx.moveTo(x - w, y);
      ctx.bezierCurveTo(x - w, y - 34, x + w, y - 34, x + w, y);
      ctx.closePath();
    }, linear(ctx, 0, y - 30, 0, y, [[0, "#ff7a6a"], [1, "#d93a3a"]]), "#6a1414", 3.5);
    solid(() => ctx.rect(x - w - 2, y - 8, w * 2 + 4, 12), "#ffefe6", "#6a1414", 3);
    solid(() => C(x, y - 28, 8), "#ffffff", "#6a1414", 3);
  },
  moon: (_P, A) => {
    const x = A.top[0] - A.hr * 0.95;
    const y = A.top[1] - 2;
    const r = 14;
    solid(() => {
      ctx.arc(x, y, r, 1.015, Math.PI * 2 - 1.015, false);
      ctx.arc(x + r * 0.5, y, r * 0.85, -1.538, 1.538, true);
      ctx.closePath();
    }, linear(ctx, 0, y - r, 0, y + r, [[0, "#fff6b0"], [1, "#ffcf3a"]]), "#9a6a0a", 3);
  },
};

const FLOATING: Species[] = ["bat", "fish", "ghost"];

export function drawPet(c: Ctx, def: ItemDef): void {
  ctx = c;
  ctx.translate(0, HEADROOM);
  const P = palette(def);
  const float = FLOATING.includes(def.species);
  paint(rgba(0x2a1a2e, 0.2), () => E(80, 151, float ? 32 : 46, float ? 5 : 7));
  // anchors are fixed per species: draw a scratch copy to find them without painting
  const real = ctx;
  ctx = document.createElement("canvas").getContext("2d")!;
  const A = SPECIES[def.species](P);
  ctx = real;
  for (const acc of def.accs) BACK[acc]?.(P, A);
  SPECIES[def.species](P);
  for (const acc of def.accs) FRONT[acc]?.(P, A);
  if (def.pattern === "gold") {
    for (const [x, y, r] of [[18, 34, 9], [146, 50, 7], [140, 136, 6], [14, 114, 6]]) twinkle(ctx, x, y, r, "#fff6b0");
  }
}

/** Texture key for a pet, drawing it on first use. */
export function petTexture(scene: Phaser.Scene, id: string): string {
  return canvasTexture(scene, petKey(id), PET_SIZE, PET_H, (c) => drawPet(c, ITEMS[id]));
}

/** Dark silhouette for pets not discovered yet. */
export function lockedTexture(scene: Phaser.Scene, id: string): string {
  return canvasTexture(scene, `pet_${id}_locked`, PET_SIZE, PET_H, (c) => {
    drawPet(c, ITEMS[id]);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = "#6b5440";
    c.fillRect(0, 0, PET_SIZE, PET_H);
  });
}
