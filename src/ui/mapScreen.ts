import Phaser from "phaser";
import { canvasTexture, darken, lighten, rgba } from "../art/draw";
import { vividCard } from "../art/ps";
import { MAX_STAGE } from "../data/balance";
import { BOSS_EVERY, bossForStage } from "../data/bosses";
import { MODE_INFO, modeForStage } from "../data/modes";
import { REGIONS, Region, STAGES_PER_REGION, regionForStage, regionUnlocked } from "../data/regions";
import { persist, save, stageCap } from "../systems/save";
import { Host, Screen } from "./screens";
import { button, fitText, text } from "./widgets";

/** Where each world floats in space (x as a share of the width), one under the other. */
const SPOTS = [0.5, 0.74, 0.28, 0.72, 0.3];
const GAP = 560;

/**
 * The worlds map: deep space with a planet for each land. Every planet has its name, a row of
 * little progress icons (bosses beaten, stages cleared) and your face on the one you are on.
 * Lands you have not reached are dark with a lock. Tap a planet for its 20 stages, tap a stage
 * and PLAY. Developer mode (tap the title 5 times) opens every stage.
 */
export class MapScreen extends Screen {
  private world: Phaser.GameObjects.Container;
  private sheet: Phaser.GameObjects.Container;
  private top: number;
  private bottom: number;
  private height = 0;
  private drag = { on: false, y: 0, oy: 0, moved: 0 };
  private picked = 1;

  constructor(scene: Phaser.Scene, host: Host, onBack: () => void) {
    super(scene, host, null);
    const s = scene;
    const W = s.scale.width;
    this.top = host.L.headerBottom;
    this.bottom = host.L.navTop;
    this.root.add(s.add.image(0, 0, spaceTexture(s, W, this.bottom)).setOrigin(0).setInteractive());
    // twinkling stars
    for (let i = 0; i < 40; i++) {
      const st = s.add.star((i * 977) % W, this.top + ((i * 613) % (this.bottom - this.top)), 4, 2, 7 + (i % 3) * 3, 0xffffff).setAlpha(0.6);
      s.tweens.add({ targets: st, alpha: 0.1, scale: 0.6, duration: 700 + (i % 5) * 300, yoyo: true, repeat: -1, delay: i * 90 });
      this.root.add(st);
    }
    this.world = s.add.container(0, 0);
    // the worlds scroll in the space under the title
    const mask = s.make.graphics({}, false).fillRect(0, this.top + 130, W, this.bottom - this.top - 130);
    this.world.setMask(mask.createGeometryMask());
    this.sheet = s.add.container(0, 0).setVisible(false);
    this.root.add([this.world, this.sheet]);
    // the title (tap it 5 times for developer mode) and a big red Back
    // a dark band behind the title so the worlds scroll under it
    const band = s.add.graphics();
    band.fillGradientStyle(0x0b1530, 0x0b1530, 0x0b1530, 0x0b1530, 1, 1, 0, 0).fillRect(0, this.top, W, 170);
    this.root.add(band);
    const title = text(s, W / 2, this.top + 60, "YOUR WORLDS", 64, "#ffffff", { stroke: 12 });
    this.devTaps(title);
    this.root.add(title);
    this.root.add(button(s, W / 2, this.bottom - 90, 360, 120, "red", "BACK", onBack, { size: 56 }));
    s.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.visible || this.sheet.visible || p.y < this.top + 120 || p.y > this.bottom - 160) return;
      this.drag = { on: true, y: p.y, oy: this.world.y, moved: 0 };
    });
    s.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.drag.on || !p.isDown) return;
      this.drag.moved = Math.max(this.drag.moved, Math.abs(p.y - this.drag.y));
      this.world.y = this.clampY(this.drag.oy + p.y - this.drag.y);
    });
    s.input.on("pointerup", () => (this.drag.on = false));
  }

  private clampY(y: number): number {
    const view = this.bottom - this.top - 260;
    return Phaser.Math.Clamp(y, Math.min(0, view - this.height), 0);
  }

  protected onShow(): void {
    this.sheet.setVisible(false).removeAll(true);
    this.drawWorlds();
    // start with your world in view
    const i = REGIONS.indexOf(regionForStage(save.stage));
    const mid = (this.top + this.bottom) / 2 - 60;
    this.world.y = this.clampY(mid - (this.top + 360 + i * GAP));
  }

  update(): void {}

  private drawWorlds(): void {
    const s = this.scene;
    const W = s.scale.width;
    const w = this.world.removeAll(true);
    const y0 = this.top + 360;
    this.height = REGIONS.length * GAP + 200;
    // a dotted space route from world to world
    const route = s.add.graphics();
    REGIONS.forEach((_, i) => {
      if (i === REGIONS.length - 1) return;
      const [ax, ay] = [W * SPOTS[i], y0 + i * GAP];
      const [bx, by] = [W * SPOTS[i + 1], y0 + (i + 1) * GAP];
      for (let k = 1; k < 12; k++) {
        const t = k / 12;
        route.fillStyle(0xffffff, 0.35).fillCircle(ax + (bx - ax) * t, ay + (by - ay) * t, 6);
      }
    });
    w.add(route);
    REGIONS.forEach((r, i) => this.drawPlanet(r, i, W * SPOTS[i], y0 + i * GAP));
  }

  /** One world: the planet, its name, its progress icons, and you if you are there. */
  private drawPlanet(r: Region, i: number, x: number, y: number): void {
    const s = this.scene;
    const open = regionUnlocked(r, save.bestStage) || save.dev;
    const here = regionForStage(save.stage) === r;
    const planet = s.add.image(x, y, planetTexture(s, r)).setScale(here ? 1.05 : 0.9);
    if (!open) planet.setTint(0x40404c);
    s.tweens.add({ targets: planet, angle: 360, duration: 120000, repeat: -1 });
    const glow = s.add.image(x, y, "glow").setTint(open ? lighten(r.crystal, 0.3) : 0x30304a).setScale(3.4).setAlpha(0.35);
    // name above (a little "World N" over the big name), progress icons beside it
    const last = r.from + STAGES_PER_REGION - 1;
    const cleared = Phaser.Math.Clamp(save.bestStage - r.from, 0, STAGES_PER_REGION);
    const bosses = Math.floor(cleared / BOSS_EVERY);
    const parts: Phaser.GameObjects.GameObject[] = [
      glow, planet,
      text(s, x, y - 290, `World ${i + 1}`, 34, "#ffffff", { stroke: 8 }),
      fitText(text(s, x, y - 240, r.name, 58, "#ffffff", { stroke: 12 }), 560),
    ];
    const icons: [string, string][] = open
      ? [["mode_boss", `${bosses}/${STAGES_PER_REGION / BOSS_EVERY}`], ["icon_star", `${cleared}/${STAGES_PER_REGION}`]]
      : [["icon_lock", `stage ${r.from}`]];
    icons.forEach(([icon, val], k) => {
      const ix = x + (k - (icons.length - 1) / 2) * 170;
      const img = s.add.image(ix - 50, y - 182, icon);
      img.setScale(52 / Math.max(img.width, img.height));
      parts.push(img, text(s, ix - 16, y - 182, val, 32, "#ffffff", { stroke: 8 }).setOrigin(0, 0.5));
    });
    if (!open) parts.push(s.add.image(x, y, "icon_lock").setScale(1.4));
    if (here) {
      // you: your hero in a white circle on top of the planet
      const [mx, my] = [x + 150, y - 110];
      const ring = s.add.circle(mx, my, 54, 0xffffff).setStrokeStyle(6, 0x111111);
      const me = s.add.image(mx, my + 4, "hero").setScale(0.42);
      const ping = s.add.circle(mx, my, 54).setStrokeStyle(6, 0xffe066);
      s.tweens.add({ targets: ping, scale: 1.5, alpha: 0, duration: 1000, repeat: -1 });
      s.tweens.add({ targets: [ring, me], y: "-=10", duration: 600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      parts.push(ping, ring, me);
    }
    // the whole planet is a button
    const zone = s.add.zone(x, y, 420, 420).setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => {
      if (this.drag.moved > 14) return;
      if (!open) {
        this.host.toast(`Reach stage ${r.from} to open ${r.name}`, "#ffd0d0");
        return;
      }
      this.openSheet(r, Phaser.Math.Clamp(here ? save.stage : Math.min(last, Math.max(r.from, save.bestStage)), r.from, last));
    });
    parts.push(zone);
    this.world.add(parts);
  }

  /** A world's 20 stages as bubbles (bosses show their face), and PLAY. */
  private openSheet(r: Region, pick: number): void {
    const s = this.scene;
    const W = s.scale.width;
    const sh = this.sheet.removeAll(true).setVisible(true);
    this.root.bringToTop(sh);
    const h = 1180;
    const cy = this.bottom - h / 2 - 20;
    const dim = s.add.rectangle(0, 0, W, this.bottom, 0x0a0820, 0.7).setOrigin(0).setInteractive();
    dim.on("pointerup", () => sh.setVisible(false).removeAll(true));
    sh.add([dim, s.add.image(W / 2 + 4, cy + 6, vividCard(s, r.crystal, 1000, h))]);
    sh.add(fitText(text(s, W / 2, cy - h / 2 + 70, r.name, 64, "#ffffff", { stroke: 12 }), 800));
    this.picked = pick;
    const bubbles: { st: number; ring: Phaser.GameObjects.Arc }[] = [];
    const info = s.add.container(0, 0);
    const choose = (st: number) => {
      this.picked = st;
      bubbles.forEach((b) => b.ring.setVisible(b.st === st));
      const boss = st % BOSS_EVERY === 0;
      const mode = MODE_INFO[modeForStage(st)];
      info.removeAll(true);
      info.add([
        s.add.image(W / 2 - 330, cy + 300, mode.icon).setScale(0.8),
        text(s, W / 2 - 270, cy + 280, boss ? `BOSS ${st}` : `STAGE ${st}`, 50, "#ffffff", { stroke: 10 }).setOrigin(0, 0.5),
        fitText(text(s, W / 2 - 270, cy + 330, boss ? bossForStage(st).name : mode.name, 32, mode.css, { stroke: 8 }).setOrigin(0, 0.5), 340),
      ]);
    };
    for (let k = 0; k < STAGES_PER_REGION; k++) {
      const st = r.from + k;
      const x = W / 2 + ((k % 5) - 2) * 176;
      const y = cy - h / 2 + 230 + Math.floor(k / 5) * 170;
      const boss = st % BOSS_EVERY === 0;
      const done = st < save.bestStage;
      const can = st <= stageCap() && st <= MAX_STAGE;
      const fill = !can ? 0x6a6a7a : done ? 0xffcf3a : st === save.stage ? 0xff9a3c : 0xffffff;
      const c = s.add.container(x, y);
      c.add(s.add.circle(0, 6, 66, 0x111111));
      c.add(s.add.circle(0, 0, 64, fill).setStrokeStyle(7, 0x111111));
      if (boss) {
        const face = s.add.image(0, 4, bossForStage(st).tex);
        face.setScale(100 / Math.max(face.width, face.height));
        if (!can) face.setTintFill(0x22222e);
        c.add(face);
      } else c.add(text(s, 0, 0, `${st}`, 44, can ? "#ffffff" : "#c8c8d0", { stroke: 9 }));
      if (done) c.add(s.add.image(42, -42, "icon_check").setScale(0.34));
      if (!can) c.add(s.add.image(40, 40, "icon_lock").setScale(0.36));
      const ring = s.add.circle(0, 0, 80).setStrokeStyle(10, 0x5aff8a).setVisible(false);
      s.tweens.add({ targets: ring, scale: 1.12, duration: 420, yoyo: true, repeat: -1 });
      c.add(ring);
      c.setSize(140, 140).setInteractive({ useHandCursor: true });
      c.on("pointerup", () => {
        if (!can) {
          this.host.toast("Beat the stage before it first", "#ffd0d0");
          return;
        }
        choose(st);
      });
      bubbles.push({ st, ring });
      sh.add(c);
    }
    sh.add(info);
    sh.add(button(s, W / 2 + 270, cy + 300, 300, 130, "green", "PLAY", () => {
      sh.setVisible(false);
      this.host.pickStage(this.picked, true);
    }, { size: 56 }));
    choose(pick);
    sh.setAlpha(0);
    s.tweens.add({ targets: sh, alpha: 1, duration: 160 });
  }

  /** For the developer: tap the title 5 times quickly to switch developer mode (play any stage). */
  private devTaps(title: Phaser.GameObjects.Text): void {
    let taps = 0;
    let first = 0;
    title.setInteractive().on("pointerup", () => {
      const now = this.scene.time.now;
      if (now - first > 2000) {
        taps = 0;
        first = now;
      }
      if (++taps < 5) return;
      taps = 0;
      save.dev = !save.dev;
      persist();
      this.host.toast(save.dev ? "Developer mode ON: every stage is open" : "Developer mode OFF", save.dev ? "#ff9ad8" : "#ffffff");
      this.onShow();
    });
  }
}

/** Deep space: a dark blue gradient with stars of all sizes and a few soft nebula clouds. */
function spaceTexture(scene: Phaser.Scene, w: number, h: number): string {
  return canvasTexture(scene, `space_${w}_${h}`, w, h, (c) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0b1530");
    g.addColorStop(1, "#141f45");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (const [x, y, r, col] of [[w * 0.2, h * 0.3, 380, "rgba(120,80,200,0.18)"], [w * 0.8, h * 0.7, 420, "rgba(60,140,220,0.16)"]] as [number, number, number, string][]) {
      const n = c.createRadialGradient(x, y, 0, x, y, r);
      n.addColorStop(0, col);
      n.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = n;
      c.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 260; i++) {
      const x = (i * 7919) % w;
      const y = (i * 104729) % h;
      c.fillStyle = `rgba(255,255,255,${0.25 + (i % 5) * 0.12})`;
      c.beginPath();
      c.arc(x, y, (i % 7 === 0 ? 2.6 : 1.2), 0, Math.PI * 2);
      c.fill();
    }
  });
}

/** A round cartoon planet in a land's colours: sea, land blobs, shading, a shine and clouds. */
function planetTexture(scene: Phaser.Scene, r: Region): string {
  return canvasTexture(scene, `planet_${r.id}`, 440, 440, (c) => {
    const cx = 220;
    const cy = 220;
    const R = 170;
    const sea = r.detail === "snow" ? 0x8fd8ff : r.detail === "sand" ? 0x3fb8d8 : 0x3a9ff0;
    c.save();
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.clip();
    const g = c.createRadialGradient(cx - 50, cy - 60, 20, cx, cy, R);
    g.addColorStop(0, rgba(lighten(sea, 0.3)));
    g.addColorStop(1, rgba(darken(sea, 0.15)));
    c.fillStyle = g;
    c.fillRect(0, 0, 440, 440);
    // land
    const blobs: [number, number, number][] = [[-70, -50, 90], [60, 40, 110], [-40, 90, 60], [90, -90, 55], [-110, 40, 50]];
    for (const [dx, dy, br] of blobs) {
      c.fillStyle = rgba(r.ground);
      c.beginPath();
      for (let k = 0; k <= 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const rr = br * (0.8 + ((k * 37 + dx) % 9) / 30);
        if (k === 0) c.moveTo(cx + dx + Math.cos(a) * rr, cy + dy + Math.sin(a) * rr);
        else c.lineTo(cx + dx + Math.cos(a) * rr, cy + dy + Math.sin(a) * rr);
      }
      c.fill();
      c.fillStyle = rgba(r.groundLight);
      c.beginPath();
      c.arc(cx + dx - br * 0.25, cy + dy - br * 0.25, br * 0.45, 0, Math.PI * 2);
      c.fill();
    }
    // night side shading and a shine
    const sh = c.createRadialGradient(cx - 70, cy - 80, R * 0.4, cx, cy, R * 1.05);
    sh.addColorStop(0, "rgba(0,0,0,0)");
    sh.addColorStop(1, "rgba(10,20,60,0.45)");
    c.fillStyle = sh;
    c.fillRect(0, 0, 440, 440);
    c.restore();
    c.fillStyle = "rgba(255,255,255,0.35)";
    c.beginPath();
    c.ellipse(cx - 70, cy - 95, 50, 22, -0.6, 0, Math.PI * 2);
    c.fill();
    // fluffy clouds hugging the edge
    c.fillStyle = "#ffffff";
    for (const [a, size] of [[-0.6, 1], [0.5, 0.8], [2.2, 1.1], [3.4, 0.9], [4.6, 0.7]] as [number, number][]) {
      const px = cx + Math.cos(a) * R * 0.92;
      const py = cy + Math.sin(a) * R * 0.92;
      for (const [ox, oy, cr] of [[0, 0, 30], [32, 6, 24], [-30, 8, 22], [10, -16, 22]]) {
        c.beginPath();
        c.arc(px + ox * size, py + oy * size, cr * size, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
}
