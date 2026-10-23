import Phaser from "phaser";
import { INK_N, darken, lighten, rgba } from "../art/draw";
import { crystalKey } from "../art/world";
import { ribbonTexture, panelTexture } from "../art/ui";
import { MAX_STAGE } from "../data/balance";
import { BOSS_EVERY, bossForStage } from "../data/bosses";
import { REGIONS, STAGES_PER_REGION, regionForStage, regionUnlocked } from "../data/regions";
import { save } from "../systems/save";
import { Host, Screen } from "./screens";
import { button, drawBar, fitText, iconButton, label, text } from "./widgets";

const STEP = 160;

/**
 * The journey: 100 stages winding up through the five lands on a road. Every 5th stage is a
 * boss (its portrait, dark until you get there), each land has its own colours, scenery and
 * falling sparkles, clouds drift by, lands you haven't reached hide in fog, and a panel up
 * top says where you are and which boss is next.
 */
export class MapScreen extends Screen {
  private path: Phaser.GameObjects.Container;
  private top: number;
  private bottom: number;
  private height = 0;
  private drag = { on: false, y: 0, oy: 0, v: 0, lastY: 0 };
  private info: Phaser.GameObjects.Container;
  private ambient: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, host: Host, onBack: () => void) {
    super(scene, host, "map");
    const s = scene;
    const W = s.scale.width;
    this.top = host.L.headerBottom;
    this.bottom = host.L.navTop;
    this.path = s.add.container(0, 0);
    const mask = s.make.graphics({}, false).fillRect(0, this.top, W, this.bottom - this.top);
    this.path.setMask(mask.createGeometryMask());
    this.ambient = s.add.particles(0, this.top, "spark", {
      x: { min: 0, max: W }, y: { min: 0, max: this.bottom - this.top }, lifespan: 5000, speedY: { min: 10, max: 40 }, speedX: { min: -20, max: 20 },
      scale: { start: 0.45, end: 0 }, alpha: { start: 0.8, end: 0 }, frequency: 220,
    });
    this.info = s.add.container(0, 0);
    this.root.add([this.path, this.ambient, this.info]);
    this.root.add(iconButton(s, 70, this.top + 70, "icon_back", 100, onBack));
    s.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.visible || p.y < this.top + 150 || p.y > this.bottom) return;
      this.drag = { on: true, y: p.y, oy: this.path.y, v: 0, lastY: p.y };
    });
    s.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.drag.on || !p.isDown) return;
      this.drag.v = p.y - this.drag.lastY;
      this.drag.lastY = p.y;
      this.path.y = this.clampY(this.drag.oy + p.y - this.drag.y);
    });
    s.input.on("pointerup", () => (this.drag.on = false));
  }

  private nodePos(stage: number): { x: number; y: number } {
    const W = this.scene.scale.width;
    return { x: W / 2 + Math.sin(stage * 0.55) * 290, y: this.height - 260 - (stage - 1) * STEP };
  }

  private clampY(y: number): number {
    const viewH = this.bottom - this.top;
    return Phaser.Math.Clamp(y, this.top + viewH - this.height, this.top);
  }

  /** Smooth scroll to a stage. */
  private scrollTo(stage: number, ms = 500): void {
    const y = this.clampY((this.top + this.bottom) / 2 + 60 - this.nodePos(stage).y);
    this.scene.tweens.add({ targets: this.path, y, duration: ms, ease: "Cubic.out" });
  }

  update(): void {
    if (!this.visible || this.drag.on) return;
    // a little glide after a flick
    if (Math.abs(this.drag.v) > 0.5) {
      this.path.y = this.clampY(this.path.y + this.drag.v);
      this.drag.v *= 0.92;
    }
    // sparkles in the colour of the land in view
    const mid = (this.top + this.bottom) / 2 - this.path.y;
    const stage = Phaser.Math.Clamp(Math.round((this.height - 260 - mid) / STEP) + 1, 1, MAX_STAGE);
    this.ambient.setParticleTint(regionForStage(stage).ambient);
  }

  protected onShow(): void {
    const s = this.scene;
    const W = s.scale.width;
    this.path.removeAll(true);
    this.height = MAX_STAGE * STEP + 520;
    this.drawLands(W);
    this.drawRoad();
    this.drawNodes();
    this.drawClouds(W);
    this.drawFog(W);
    this.drawInfo(W);
    this.path.y = this.clampY((this.top + this.bottom) / 2 + 60 - this.nodePos(save.stage).y);
  }

  /** Each land: its ground, scattered blobs, rows of its trees and plants, and a big banner. */
  private drawLands(W: number): void {
    const s = this.scene;
    REGIONS.forEach((r, i) => {
      const y0 = this.nodePos(r.from + STAGES_PER_REGION - 1).y - STEP * 0.7;
      const y1 = i === 0 ? this.height : this.nodePos(r.from).y + STEP * 0.3;
      const g = s.add.graphics();
      g.fillGradientStyle(r.groundLight, r.groundLight, r.ground, r.ground, 1).fillRect(0, y0, W, y1 - y0);
      g.fillStyle(r.groundDark, 0.6);
      for (let k = 0; k < 18; k++) g.fillEllipse((k * 197 + i * 53) % W, y0 + ((k * 331 + i * 71) % (y1 - y0)), 200 + (k % 3) * 60, 70 + (k % 2) * 30);
      this.path.add(g);
      // scenery down both sides, bigger near the edges
      for (let k = 0; k < 16; k++) {
        const left = k % 2 === 0;
        const tx = left ? 40 + ((k * 37) % 90) : W - 40 - ((k * 53) % 90);
        const ty = y0 + 120 + k * ((y1 - y0 - 160) / 16);
        const key = k % 3 === 2 ? r.plants[k % r.plants.length] : r.trees[k % r.trees.length];
        this.path.add(s.add.image(tx, ty, key).setOrigin(0.5, 1).setScale(0.55 + (k % 3) * 0.12).setFlipX(!left));
      }
      // the land's banner with its crystal
      const by = y1 - 70;
      const color = ({ village: "pink", farm: "gold", woods: "green", desert: "orange", frost: "blue" } as const)[r.id];
      const banner = s.add.container(W / 2, by, [
        s.add.image(0, 0, ribbonTexture(s, color, 720, 120)),
        s.add.image(-290, -8, crystalKey(r.id)).setScale(0.28),
        fitText(text(s, 20, -18, r.name.toUpperCase(), 50), 480),
        text(s, 20, 26, `Stages ${r.from}-${r.from + STAGES_PER_REGION - 1}`, 26, "#fff3dc"),
      ]);
      this.path.add(banner);
    });
  }

  /** A dirt road with an outline, a dashed middle and pebbles along it. */
  private drawRoad(): void {
    const s = this.scene;
    const g = s.add.graphics();
    const trace = (w: number, color: number, alpha = 1) => {
      g.lineStyle(w, color, alpha).beginPath();
      for (let st = 1; st <= MAX_STAGE; st++) {
        const p = this.nodePos(st);
        if (st === 1) g.moveTo(p.x, p.y + 260);
        g.lineTo(p.x, p.y);
      }
      g.strokePath();
    };
    trace(78, 0x2a1a10, 0.25);
    trace(66, INK_N);
    trace(52, 0xe8c890);
    trace(24, 0xf6dcaa);
    // dashes and pebbles, and the part you have walked glows gold
    for (let st = 1; st < MAX_STAGE; st++) {
      const a = this.nodePos(st);
      const b = this.nodePos(st + 1);
      const walked = st < save.stage;
      for (let k = 1; k < 4; k++) {
        const t = k / 4;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        g.fillStyle(walked ? 0xffcf3a : 0xc8a068, 1).fillCircle(x, y, walked ? 8 : 6);
      }
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const n = Math.hypot(nx, ny) || 1;
      g.fillStyle(0xb8a890, 1).fillEllipse(a.x + (nx / n) * 40, a.y + 70 + (ny / n) * 40, 14, 10);
    }
    this.path.add(g);
  }

  private drawNodes(): void {
    const s = this.scene;
    for (let st = 1; st <= MAX_STAGE; st++) {
      const { x, y } = this.nodePos(st);
      const boss = st % BOSS_EVERY === 0;
      const done = st < save.stage;
      const here = st === save.stage;
      const locked = st > save.bestStage;
      const land = regionForStage(st);
      if (boss) {
        const def = bossForStage(st);
        const r = 78;
        const g = s.add.graphics();
        g.fillStyle(0x000000, 0.25).fillEllipse(x, y + r * 0.85, r * 2, r * 0.5);
        g.fillStyle(INK_N, 1).fillCircle(x, y + 6, r + 8);
        g.fillStyle(done ? 0x7ad651 : locked ? 0x5a5a6a : 0xf26464, 1).fillCircle(x, y, r);
        g.fillStyle(locked ? 0x3a3a4a : lighten(def.color, 0.5), 1).fillCircle(x, y, r - 12);
        this.path.add(g);
        if (!locked && !done) {
          const glow = s.add.image(x, y, "glow").setTint(0xff5a5a).setScale(1.3).setAlpha(0.5);
          s.tweens.add({ targets: glow, alpha: 0.9, scale: 1.5, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
          this.path.addAt(glow, this.path.list.indexOf(g));
        }
        const face = s.add.image(x, y + 6, def.tex);
        face.setScale(((r - 8) * 2) / Math.max(face.width, face.height));
        // bosses you haven't reached are dark shapes
        if (locked) face.setTintFill(0x1a1a28).setAlpha(0.85);
        this.path.add(face);
        const tag = s.add.container(x, y + r + 22, [
          s.add.image(0, 0, panelTexture(s, "glass", 250, 48)),
          fitText(text(s, 0, -1, locked ? `BOSS ${st}  ???` : `BOSS ${st}  ${def.name}`, 22, done ? "#b6ff8a" : "#ffffff"), 236),
        ]);
        this.path.add(tag);
        if (done) this.path.add(s.add.image(x + r * 0.7, y - r * 0.7, "icon_check").setScale(0.5));
      } else {
        const r = 44;
        const g = s.add.graphics();
        g.fillStyle(INK_N, 1).fillCircle(x, y + 6, r + 7);
        const color = here ? 0xff9a3c : done ? 0xffcf3a : locked ? 0x9aa4b2 : lighten(land.crystal, 0.55);
        g.fillStyle(darken(color, 0.2), 1).fillCircle(x, y + 3, r);
        g.fillStyle(color, 1).fillCircle(x, y - 2, r - 3);
        g.fillStyle(0xffffff, 0.4).fillEllipse(x - r * 0.25, y - r * 0.45, r * 0.9, r * 0.32);
        this.path.add(g);
        if (done) this.path.add(s.add.image(x, y - 2, "icon_star").setScale(0.42));
        else this.path.add(text(s, x, y - 2, `${st}`, 34, locked ? "#e8ecf2" : "#ffffff"));
      }
      if (here) this.drawHere(x, y, boss);
    }
  }

  /** You are here: the hero on the node, a pulsing ring and a flag. */
  private drawHere(x: number, y: number, boss: boolean): void {
    const s = this.scene;
    const r = boss ? 92 : 56;
    const ring = s.add.circle(x, y, r).setStrokeStyle(8, 0xffe066);
    s.tweens.add({ targets: ring, scale: 1.3, alpha: 0, duration: 900, repeat: -1 });
    const me = s.add.image(x + (boss ? 110 : 0), y - (boss ? 10 : 40), "hero").setScale(0.75).setOrigin(0.5, 0.95);
    s.tweens.add({ targets: me, y: me.y - 18, duration: 450, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    let f = 0;
    s.time.addEvent({ delay: 220, loop: true, callback: () => me.active && me.setTexture(++f % 2 ? "hero_w1" : "hero_w2") });
    const flag = s.add.container(me.x, me.y - 150, [
      s.add.image(0, 0, panelTexture(s, "glass", 110, 44)),
      text(s, 0, -1, "YOU", 26, "#ffe066"),
    ]);
    s.tweens.add({ targets: flag, y: flag.y - 18, duration: 450, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.path.add([ring, me, flag]);
  }

  /** Big soft clouds drifting across. */
  private drawClouds(W: number): void {
    const s = this.scene;
    for (let k = 0; k < 14; k++) {
      const y = 200 + ((k * 977) % (this.height - 400));
      const c = s.add.container((k * 313) % W, y);
      const g = s.add.graphics();
      g.fillStyle(0xffffff, 0.55);
      for (const [dx, dy, rr] of [[0, 0, 60], [60, 10, 48], [-60, 12, 44], [24, -30, 46]]) g.fillCircle(dx, dy, rr);
      c.add(g);
      c.setScale(0.8 + (k % 3) * 0.3);
      this.path.add(c);
      s.tweens.add({ targets: c, x: c.x + (k % 2 ? 260 : -260), duration: 14000 + k * 900, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    }
  }

  /** Lands you have not reached yet are hidden in fog, with a lock. */
  private drawFog(W: number): void {
    const s = this.scene;
    REGIONS.forEach((r) => {
      if (regionUnlocked(r, save.bestStage)) return;
      const y0 = this.nodePos(r.from + STAGES_PER_REGION - 1).y - STEP * 0.7;
      const y1 = this.nodePos(r.from).y + STEP * 0.3;
      const g = s.add.graphics();
      g.fillStyle(0xdde6f2, 0.55).fillRect(0, y0, W, y1 - y0);
      g.fillStyle(0xffffff, 0.35);
      for (let k = 0; k < 10; k++) g.fillCircle((k * 211) % W, y0 + ((k * 389) % (y1 - y0)), 140);
      const mid = (y0 + y1) / 2;
      this.path.add([
        g,
        s.add.image(W / 2, mid - 60, "icon_lock").setScale(1.6),
        label(s, W / 2, mid + 70, `Reach stage ${r.from} to explore ${r.name}`, 36, "#4a5a6a", 700),
      ]);
    });
  }

  /** Where you are and which boss is next, pinned at the top. */
  private drawInfo(W: number): void {
    const s = this.scene;
    const c = this.info.removeAll(true);
    const y = this.top + 70;
    const next = Math.min(MAX_STAGE, Math.ceil(save.stage / BOSS_EVERY) * BOSS_EVERY);
    const def = bossForStage(next);
    const g = s.add.graphics();
    drawBar(g, 150, y + 16, 480, 22, (save.stage - 1) / MAX_STAGE, 0xffcf3a);
    const face = s.add.image(W - 150, y, def.tex);
    face.setScale(120 / Math.max(face.width, face.height));
    c.add([
      s.add.image(W / 2 + 40, y, panelTexture(s, "glass", 920, 130)),
      text(s, 150, y - 26, `Stage ${save.stage} of ${MAX_STAGE}`, 36).setOrigin(0, 0.5),
      g,
      s.add.image(W - 150, y, "glow").setTint(0xff5a5a).setScale(0.6).setAlpha(0.7),
      face,
      fitText(text(s, W - 150, y + 52, next === save.stage ? "BOSS NOW!" : `boss at ${next}`, 22, "#ffd0d0"), 180),
      fitText(text(s, W - 330, y - 30, def.name, 26, rgba(lighten(def.color, 0.4))), 210),
      button(s, W - 330, y + 24, 130, 56, "orange", "HERE", () => this.scrollTo(save.stage), { size: 24 }),
    ]);
  }
}
