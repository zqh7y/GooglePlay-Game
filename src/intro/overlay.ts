/**
 * The page layer over the 3D world: the game's logo, the loading bar with tips, "TAP TO START",
 * and for the story the cinema bars, captions, a SKIP button, lightning flashes and fades.
 * Plain HTML and CSS, so the text is sharp on every screen.
 */

const CSS = `
#intro { position: fixed; inset: 0; z-index: 50; overflow: hidden; background: #140c26; color: #fff;
  font-family: Jua, "Trebuchet MS", sans-serif; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
  cursor: pointer; transition: opacity .7s ease; }
#intro.gone { opacity: 0; pointer-events: none; }
#intro canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#intro .vig { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse 85% 70% at 50% 45%, transparent 50%, rgba(12,6,30,.55) 100%); }
#intro .layer { position: absolute; inset: 0; pointer-events: none; transition: opacity .6s ease; }
#intro .layer.off { opacity: 0; }

#intro .logo { position: absolute; left: 0; right: 0; top: calc(env(safe-area-inset-top, 0px) + 7vh); text-align: center;
  filter: drop-shadow(0 0 22px rgba(255,190,80,.45)); }
#intro .word { display: block; white-space: nowrap; font-size: min(20vw, 14vh, 132px); line-height: .92; }
#intro .word + .word { margin-top: -.04em; }
#intro .ch { display: inline-block; position: relative; margin: 0 -.015em;
  animation: i-pop .75s cubic-bezier(.2,1.7,.4,1) both; }
#intro .in { display: inline-block; animation: i-float 2.8s ease-in-out infinite; }
#intro .back { position: absolute; left: 0; top: 0; color: #7a3a0a; -webkit-text-stroke: .15em #2a1206;
  text-shadow: 0 .03em 0 #6a2e06, 0 .06em 0 #5a2606, 0 .09em 0 #4a1e04, 0 .12em 0 #3a1602, 0 .15em 0 #2a1002, 0 .26em .22em rgba(0,0,0,.55); }
#intro .front { position: relative; color: transparent; -webkit-background-clip: text; background-clip: text;
  background-image: linear-gradient(180deg, #fffdf0 0%, #ffe680 38%, #ffbf2e 56%, #ff8a1a 100%); }
#intro .word.b .back { color: #4a1a7a; text-shadow: 0 .03em 0 #42166e, 0 .06em 0 #3a1262, 0 .09em 0 #320e56, 0 .12em 0 #2a0a4a, 0 .15em 0 #22083e, 0 .26em .22em rgba(0,0,0,.55); -webkit-text-stroke-color: #1a0630; }
#intro .word.b .front { background-image: linear-gradient(180deg, #ffffff 0%, #c8f4ff 38%, #6fd0ff 56%, #9a6aff 100%); }
#intro .tag { margin-top: 2.2vh; font-size: min(4.4vw, 22px); letter-spacing: .28em; color: #fff4d6;
  text-shadow: 0 2px 0 rgba(60,20,10,.6), 0 0 12px rgba(0,0,0,.4); animation: i-in 1s 1s both; }

#intro .bottom { position: absolute; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 8vh); transform: translateX(-50%);
  width: min(80vw, 440px); text-align: center; }
#intro .bar { position: relative; height: 24px; border-radius: 14px; background: rgba(20,10,40,.6); border: 3px solid #fff1c8;
  box-shadow: 0 5px 0 rgba(30,10,20,.45), 0 0 18px rgba(255,200,100,.35), inset 0 3px 6px rgba(0,0,0,.45); overflow: hidden; }
#intro .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; border-radius: 10px;
  background: linear-gradient(180deg, #fff3a0 0%, #ffcf3a 45%, #ff9a1a 100%); box-shadow: 0 0 14px rgba(255,190,60,.9); }
#intro .fill::after { content: ""; position: absolute; inset: 0; border-radius: inherit;
  background: repeating-linear-gradient(-45deg, rgba(255,255,255,.35) 0 10px, transparent 10px 20px); animation: i-stripes .8s linear infinite; }
#intro .fill::before { content: ""; position: absolute; left: 4px; right: 4px; top: 3px; height: 5px; border-radius: 4px; background: rgba(255,255,255,.55); z-index: 1; }
#intro .pct { margin-top: 10px; font-size: 18px; letter-spacing: .12em; color: #fff4d6; text-shadow: 0 2px 0 rgba(40,15,10,.6); }
#intro .tip { margin: 14px auto 0; min-height: 2.6em; max-width: 92%; font-size: 16px; line-height: 1.3; color: #fff;
  text-shadow: 0 2px 4px rgba(0,0,0,.7); transition: opacity .45s ease; }
#intro .tip b { color: #ffd34a; font-weight: normal; }
#intro .tap { position: absolute; left: 0; right: 0; bottom: calc(env(safe-area-inset-bottom, 0px) + 12vh); text-align: center;
  font-size: min(8vw, 38px); letter-spacing: .08em; color: #fff; opacity: 0; transition: opacity .5s;
  text-shadow: 0 3px 0 #b05a10, 0 5px 0 #6a2e06, 0 0 24px rgba(255,200,80,.9); }
#intro .tap.on { opacity: 1; animation: i-pulse 1.3s ease-in-out infinite; }

#intro .lb { position: absolute; left: 0; right: 0; height: 0; background: #000; transition: height 1.1s cubic-bezier(.3,.9,.3,1); }
#intro .lb.top { top: 0; } #intro .lb.bot { bottom: 0; }
#intro.cinema .lb { height: 13vh; }
#intro .cap { position: absolute; left: 5%; right: 5%; bottom: 0; height: 13vh; display: flex; align-items: center; justify-content: center;
  text-align: center; font-size: clamp(17px, 4.7vw, 30px); line-height: 1.25; color: #fff8e8; transition: opacity .5s ease;
  text-shadow: 0 0 12px rgba(255,210,140,.35); }
#intro .cap div { max-width: 640px; }
#intro .cap span { opacity: 0; transition: opacity .3s ease; }
#intro .cap span.on { opacity: 1; }
#intro .cap em { font-style: normal; color: #ffd34a; }
#intro .skip { position: absolute; top: calc(env(safe-area-inset-top, 0px) + 2.5vh); right: 16px; padding: 8px 18px; border-radius: 22px;
  font: inherit; font-size: 17px; letter-spacing: .08em; color: #fff; background: rgba(255,255,255,.1); border: 2px solid rgba(255,255,255,.45);
  opacity: 0; transition: opacity .5s; pointer-events: none; }
#intro .skip.on { opacity: 1; pointer-events: auto; }
#intro .flash { position: absolute; inset: 0; background: #f2ecff; opacity: 0; pointer-events: none; mix-blend-mode: screen; }
#intro .fade { position: absolute; inset: 0; background: #000; opacity: 0; pointer-events: none; transition: opacity .8s ease; }
#intro .fade.on { opacity: 1; }
#intro .title { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0; transition: opacity .4s; }
#intro .title.on { opacity: 1; }
#intro .title .logo { position: static; }
#intro .title .tap { position: static; margin-top: 6vh; }

@keyframes i-pop { 0% { transform: translateY(-60%) scale(.2) rotate(-25deg); opacity: 0; } 100% { transform: none; opacity: 1; } }
@keyframes i-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5%); } }
@keyframes i-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: none; } }
@keyframes i-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
@keyframes i-stripes { 0% { background-position: 0 0; } 100% { background-position: 28px 0; } }
`;

const TIPS = [
  "Rarer <b>dice</b> roll rarer pets.",
  "When the Crystal's <b>shield</b> goes down, protect it!",
  "Bosses heal. Stand on the glowing <b>seals</b> to stop them.",
  "Your hero keeps <b>fishing</b>, even while you're away.",
  "Extra copies of a pet <b>level it up</b>.",
  "Every level-up brings a new <b>gadget</b>.",
  "Five lands, five Crystals. Bring back <b>all</b> their light!",
  "Airdrops, elites and orbs give you <b>skills</b>.",
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, html = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  parent.appendChild(e);
  return e;
}

/** The logo: every letter has a gold front and a dark extruded back, and pops in one after the other. */
function logo(parent: HTMLElement, delay = 0.15): HTMLElement {
  const box = el("div", "logo", parent);
  let n = 0;
  for (const [word, cls] of [["DICE", "word"], ["IDLE", "word b"]]) {
    const w = el("div", cls, box);
    for (const c of word) {
      const ch = el("span", "ch", w);
      ch.style.animationDelay = `${delay + n * 0.09}s`;
      const inner = el("span", "in", ch);
      inner.style.animationDelay = `${-n * 0.3}s`;
      el("span", "back", inner, c);
      el("span", "front", inner, c);
      n++;
    }
  }
  return box;
}

export class Overlay {
  readonly root: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  private load: HTMLElement;
  private fill: HTMLElement;
  private pct: HTMLElement;
  private tip: HTMLElement;
  private tapLine: HTMLElement;
  private story: HTMLElement;
  private cap: HTMLElement;
  private flashEl: HTMLElement;
  private fadeEl: HTMLElement;
  private title: HTMLElement;
  readonly skipBtn: HTMLButtonElement;
  private tipAt = 0;
  private tipIndex = Math.floor(Math.random() * TIPS.length);
  private capText = "";
  private capSpans: HTMLElement[] = [];

  constructor() {
    if (!document.getElementById("intro-style")) {
      const st = document.createElement("style");
      st.id = "intro-style";
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    this.root = document.createElement("div");
    this.root.id = "intro";
    this.canvas = el("canvas", "", this.root);
    el("div", "vig", this.root);
    this.load = el("div", "layer", this.root);
    logo(this.load);
    el("div", "tag", this.load.firstElementChild as HTMLElement, "ROLL · FIGHT · COLLECT");
    const bottom = el("div", "bottom", this.load);
    const bar = el("div", "bar", bottom);
    this.fill = el("div", "fill", bar);
    this.pct = el("div", "pct", bottom, "LOADING 0%");
    this.tip = el("div", "tip", bottom, TIPS[this.tipIndex]);
    this.tapLine = el("div", "tap", this.load, "TAP TO START");
    this.story = el("div", "layer off", this.root);
    el("div", "lb top", this.story);
    el("div", "lb bot", this.story);
    this.cap = el("div", "cap", this.story);
    this.title = el("div", "title", this.story);
    this.flashEl = el("div", "flash", this.root);
    this.fadeEl = el("div", "fade", this.root);
    this.skipBtn = el("button", "skip", this.root, "SKIP ▸▸");
    this.skipBtn.type = "button";
    document.body.appendChild(this.root);
  }

  /** Loading progress, 0..1. */
  setProgress(f: number, now: number): void {
    const p = Math.round(f * 100);
    this.fill.style.width = `${Math.max(4, p)}%`;
    this.pct.textContent = `LOADING ${p}%`;
    if (now - this.tipAt > 3.2) {
      this.tipAt = now;
      this.tip.style.opacity = "0";
      window.setTimeout(() => {
        this.tipIndex = (this.tipIndex + 1) % TIPS.length;
        this.tip.innerHTML = TIPS[this.tipIndex];
        this.tip.style.opacity = "1";
      }, 450);
    }
  }

  /** Loading is done: the bar makes way for "TAP TO START". */
  showTap(): void {
    (this.fill.parentElement!.parentElement as HTMLElement).style.opacity = "0";
    (this.fill.parentElement!.parentElement as HTMLElement).style.transition = "opacity .4s";
    this.tapLine.classList.add("on");
  }

  /** Switch from the loading screen to the story: logo and bar go, the cinema bars come in. */
  startStory(): void {
    this.load.classList.add("off");
    this.story.classList.remove("off");
    this.root.classList.add("cinema");
    this.root.style.cursor = "default";
  }

  showSkip(on: boolean): void {
    this.skipBtn.classList.toggle("on", on);
  }

  /** The caption under the picture; letters appear one by one (`shown` = how many). */
  caption(text: string, shown: number, visible: boolean): void {
    if (text !== this.capText) {
      this.capText = text;
      this.cap.innerHTML = "";
      const line = el("div", "", this.cap);
      this.capSpans = [];
      // *word* marks a highlighted word
      let hi = false;
      for (const c of text) {
        if (c === "*") {
          hi = !hi;
          continue;
        }
        const s = document.createElement(hi ? "em" : "span");
        if (hi) s.style.cssText = "opacity:0;transition:opacity .3s";
        s.textContent = c;
        line.appendChild(s);
        this.capSpans.push(s);
      }
    }
    this.capSpans.forEach((s, i) => {
      const on = i < shown;
      if (s.tagName === "EM") s.style.opacity = on ? "1" : "0";
      else s.classList.toggle("on", on);
    });
    this.cap.style.opacity = visible ? "1" : "0";
  }

  flash(a: number): void {
    this.flashEl.style.opacity = `${Math.max(0, Math.min(1, a))}`;
  }

  fade(on: boolean, seconds = 0.8): void {
    this.fadeEl.style.transitionDuration = `${seconds}s`;
    this.fadeEl.classList.toggle("on", on);
  }

  /** The end title: the logo again, with "TAP TO PLAY". */
  showTitle(): void {
    if (this.title.childElementCount) return;
    this.cap.style.opacity = "0";
    logo(this.title, 0);
    el("div", "tap on", this.title, "TAP TO PLAY");
    this.title.classList.add("on");
    this.root.style.cursor = "pointer";
  }

  /** Fade the whole layer away, then remove it. */
  close(): Promise<void> {
    this.root.classList.add("gone");
    return new Promise((done) =>
      window.setTimeout(() => {
        this.root.remove();
        done();
      }, 750),
    );
  }
}
