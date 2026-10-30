import Phaser from "phaser";

/**
 * Languages. The game is written in English; every text the player sees goes through `t()`, which
 * looks it up in the chosen language's dictionary (`src/i18n/<code>.json`, English text -> translation).
 * Texts with numbers or names in them are matched by their pattern: "Next catch in {0}s" also matches
 * "Next catch in 21s", and the parts in the braces are kept (and translated too when they are words).
 *
 * Rather than wrap every text in the code, `installTextHook()` translates at the two places all text
 * passes through: Phaser's Text.setText and the canvas fillText / strokeText used by the drawn art
 * (signs, ribbons). Anything not in the dictionary stays as it is (numbers, pet names, tier letters).
 */
export interface Lang {
  code: string;
  /** its own name, as the picker shows it */
  name: string;
  /** written right to left */
  rtl?: boolean;
}

export const LANGS: Lang[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "ru", name: "Русский" },
  { code: "tr", name: "Türkçe" },
  { code: "ar", name: "العربية", rtl: true },
  { code: "he", name: "עברית", rtl: true },
  { code: "hi", name: "हिन्दी" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "th", name: "ไทย" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "zh", name: "简体中文" },
];

const STORE = "dice-idle-lang";
const files = import.meta.glob<{ default: Record<string, string> }>("./*.json");

/** The language picked in Settings, or the phone's language the first time (English if we don't have it). */
function pick(): string {
  try {
    const saved = localStorage.getItem(STORE);
    if (saved && LANGS.some((l) => l.code === saved)) return saved;
  } catch {
    // storage unavailable
  }
  for (const n of navigator.languages ?? [navigator.language]) {
    const code = (n || "").toLowerCase().split("-")[0];
    // old code for Hebrew
    const c = code === "iw" ? "he" : code === "in" ? "id" : code;
    if (LANGS.some((l) => l.code === c)) return c;
  }
  return "en";
}

let code = "en";
let exact = new Map<string, string>();
let patterns: { re: RegExp; to: string }[] = [];
const cache = new Map<string, string>();

export const lang = (): Lang => LANGS.find((l) => l.code === code) ?? LANGS[0];

/** Remember a new language (the game reloads to use it). */
export function setLang(c: string): void {
  try {
    localStorage.setItem(STORE, c);
  } catch {
    // storage unavailable
  }
}

const escape = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&");

/** Load the dictionary for the picked language (before the game starts). */
export async function loadLang(): Promise<void> {
  code = pick();
  document.documentElement.lang = code;
  // the page (loading screen, story captions) reads right to left in Hebrew and Arabic
  document.documentElement.dir = LANGS.find((l) => l.code === code)?.rtl ? "rtl" : "ltr";
  if (code === "en") return;
  const file = files[`./${code}.json`];
  if (!file) {
    code = "en";
    return;
  }
  const dict = (await file()).default;
  exact = new Map();
  patterns = [];
  for (const [en, to] of Object.entries(dict)) {
    if (!to) continue;
    exact.set(en, to);
    // patterns need some words around the gaps, so "{0} {1}" alone never matches everything
    if (/\{\d\}/.test(en) && /[A-Za-z]{2}/.test(en.replace(/\{\d\}/g, ""))) {
      const re = new RegExp("^" + en.split(/(\{\d\})/).map((p) => (/^\{\d\}$/.test(p) ? "(.+?)" : escape(p))).join("") + "$", "s");
      patterns.push({ re, to });
    }
  }
  // longer patterns first: they are the more specific ones
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);
}

/** Translate one text (it comes back as it was when there is no translation). */
export function t(s: string): string {
  if (code === "en" || !s || !/[A-Za-z]/.test(s)) return s;
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  let out = exact.get(s);
  if (out === undefined) {
    // keep the spaces around it (some texts are padded)
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!;
    const core = m[2];
    out = exact.get(core);
    if (out === undefined) {
      for (const p of patterns) {
        const g = p.re.exec(core);
        if (!g) continue;
        const parts = g.slice(1);
        out = p.to.replace(/\{(\d)\}/g, (_, i: string) => t(parts[+i] ?? ""));
        break;
      }
    }
    if (out === undefined) {
      // a level in Roman numerals stays as it is: "Strength II"
      const r = /^(.+) (I|II|III|IV|V)$/.exec(core);
      if (r && exact.has(r[1])) out = exact.get(r[1]) + " " + r[2];
    }
    if (out === undefined && /\s+•\s+|\n/.test(core)) {
      // texts put together from parts ("Stage 7  •  CRYSTAL", two lines): each part on its own
      const parts = core.split(/(\s+•\s+|\n)/);
      const done = parts.map((p, i) => (i % 2 ? p : t(p)));
      if (done.some((p, i) => p !== parts[i])) out = done.join("");
    }
    out = out === undefined ? s : m[1] + out + m[3];
  }
  if (cache.size > 5000) cache.clear();
  cache.set(s, out);
  return out;
}

/** For tests: texts shown that have no translation (only collected when asked for). */
export const missing = new Set<string>();
let collect = false;
export const collectMissing = () => (collect = true);

/** Translate every text at the place it is drawn. */
export function installTextHook(): void {
  if (code === "en" && !collect) return;
  const proto = Phaser.GameObjects.Text.prototype as unknown as { setText: (v: unknown) => unknown };
  const setText = proto.setText;
  proto.setText = function (this: Phaser.GameObjects.Text, v: unknown) {
    if (typeof v === "string") {
      const out = t(v);
      if (collect && out === v && /[A-Za-z]{2}/.test(v)) missing.add(v);
      return setText.call(this, out);
    }
    return setText.call(this, v);
  };
  const ctx = CanvasRenderingContext2D.prototype;
  for (const name of ["fillText", "strokeText"] as const) {
    const draw = ctx[name];
    ctx[name] = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
      const s = String(text);
      const out = t(s);
      if (out !== s && maxWidth === undefined) {
        // drawn art was sized for the English: squeeze a longer translation into about the same width
        const w0 = this.measureText(s).width;
        if (this.measureText(out).width > w0 * 1.15) maxWidth = w0 * 1.15;
      }
      return maxWidth === undefined ? draw.call(this, out, x, y) : draw.call(this, out, x, y, maxWidth);
    };
  }
}
