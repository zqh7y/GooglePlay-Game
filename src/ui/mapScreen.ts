import Phaser from "phaser";
import { INK_N, darken, lighten } from "../art/draw";
import { MAX_STAGE } from "../data/balance";
import { REGIONS, STAGES_PER_REGION, regionUnlocked } from "../data/regions";
import { save } from "../systems/save";
import { Host, Screen } from "./screens";
import { iconButton, text } from "./widgets";

const STEP = 150;

/** The journey: 100 stages winding up through the five lands. */
export class MapScreen extends Screen {
  private path: Phaser.GameObjects.Container;
  private top: number;
  private bottom: number;
  private height = 0;
  private drag = { on: false, y: 0, oy: 0 };

  constructor(scene: Phaser.Scene, host: Host, onBack: () => void) {
    super(scene, host, "map");
    const s = scene;
    const W = s.scale.width;
    this.top = host.L.headerBottom;
    this.bottom = host.L.navTop;
    this.path = s.add.container(0, 0);
    const mask = s.make.graphics({}, false).fillRect(0, this.top, W, this.bottom - this.top);
    this.path.setMask(mask.createGeometryMask());
    this.root.add(this.path);
    this.root.add(iconButton(s, 70, this.top + 60, "icon_back", 100, onBack));
    s.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.visible || p.y < this.top || p.y > this.bottom) return;
      this.drag = { on: true, y: p.y, oy: this.path.y };
    });
    s.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.drag.on || !p.isDown) return;
      this.path.y = this.clampY(this.drag.oy + p.y - this.drag.y);
    });
    s.input.on("pointerup", () => (this.drag.on = false));
  }

  private nodePos(stage: number): { x: number; y: number } {
    const W = this.scene.scale.width;
    return { x: W / 2 + Math.sin(stage * 0.55) * 300, y: this.height - 200 - (stage - 1) * STEP };
  }

  private clampY(y: number): number {
    const viewH = this.bottom - this.top;
    return Phaser.Math.Clamp(y, this.top + viewH - this.height, this.top);
  }

  protected onShow(): void {
    const s = this.scene;
    const W = s.scale.width;
    this.path.removeAll(true);
    this.height = MAX_STAGE * STEP + 400;
    // land bands with their scenery
    REGIONS.forEach((r, i) => {
      const y0 = this.nodePos(r.from + STAGES_PER_REGION - 1).y - STEP / 2;
      const y1 = this.nodePos(r.from).y + STEP / 2 + (i === 0 ? 150 : 0);
      const open = regionUnlocked(r, save.bestStage);
      const band = s.add.graphics();
      band.fillStyle(open ? r.ground : 0x8a96a6, 1).fillRect(0, y0, W, y1 - y0);
      band.fillStyle(open ? darken(r.ground, 0.08) : 0x7a8696, 1);
      for (let k = 0; k < 14; k++) band.fillEllipse(((k * 197) % W), y0 + ((k * 331) % (y1 - y0)), 220, 90);
      this.path.add(band);
      for (let k = 0; k < 8; k++) {
        const tx = k % 2 ? W - 80 - ((k * 37) % 60) : 80 + ((k * 53) % 60);
        const ty = y0 + 200 + k * ((y1 - y0 - 300) / 8);
        const tree = s.add.image(tx, ty, r.trees[k % r.trees.length]).setOrigin(0.5, 1).setScale(0.7);
        if (!open) tree.setTint(0x6a7686);
        this.path.add(tree);
      }
      const bannerY = y1 - 60;
      const ribbon = s.add.graphics();
      ribbon.fillStyle(INK_N, 1).fillRoundedRect(W / 2 - 330, bannerY - 50, 660, 100, 26);
      ribbon.fillStyle(open ? lighten(r.crystal, 0.2) : 0x9aa4b2, 1).fillRoundedRect(W / 2 - 322, bannerY - 42, 644, 84, 22);
      this.path.add([ribbon, text(s, W / 2, bannerY - 2, `${r.name}  •  ${r.from}-${r.from + STAGES_PER_REGION - 1}`, 40)]);
      if (!open) this.path.add(s.add.image(W / 2 - 290, bannerY, "icon_lock").setScale(0.6));
    });
    // the path itself
    const g = s.add.graphics();
    for (const [w, c] of [[44, INK_N], [30, 0xfff3dc]] as [number, number][]) {
      g.lineStyle(w, c, 1).beginPath();
      for (let st = 1; st <= MAX_STAGE; st++) {
        const p = this.nodePos(st);
        if (st === 1) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.strokePath();
    }
    this.path.add(g);
    for (let st = 1; st <= MAX_STAGE; st++) {
      const { x, y } = this.nodePos(st);
      const land = REGIONS[Math.floor((st - 1) / STAGES_PER_REGION)];
      const boss = st % STAGES_PER_REGION === 0;
      const done = st < save.stage;
      const here = st === save.stage;
      const locked = st > save.bestStage;
      const r = boss ? 62 : 44;
      const node = s.add.graphics();
      node.fillStyle(INK_N, 1).fillCircle(x, y + 5, r + 6);
      node.fillStyle(here ? 0xff9a3c : done ? 0xffcf3a : locked ? 0x9aa4b2 : 0xfff3dc, 1).fillCircle(x, y, r);
      node.fillStyle(0xffffff, 0.35).fillEllipse(x - r * 0.25, y - r * 0.4, r * 0.9, r * 0.35);
      this.path.add(node);
      if (boss) this.path.add(s.add.image(x, y - 4, land.boss).setScale(0.36));
      else this.path.add(text(s, x, y, `${st}`, 36, locked ? "#e8ecf2" : "#ffffff"));
      if (done && !boss) this.path.add(s.add.image(x + 32, y - 32, "icon_check").setScale(0.36));
      if (here) {
        const me = s.add.image(x, y - 50, "hero").setScale(0.6).setOrigin(0.5, 0.95);
        s.tweens.add({ targets: me, y: y - 66, duration: 500, yoyo: true, repeat: -1, ease: "Sine.inOut" });
        const ring = s.add.circle(x, y, r + 14).setStrokeStyle(8, 0xffe066);
        s.tweens.add({ targets: ring, scale: 1.25, alpha: 0, duration: 900, repeat: -1 });
        this.path.add([ring, me]);
      }
    }
    // start with the current stage in view
    const here = this.nodePos(save.stage);
    this.path.y = this.clampY((this.top + this.bottom) / 2 - here.y);
  }
}
