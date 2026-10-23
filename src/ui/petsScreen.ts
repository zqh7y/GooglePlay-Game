import Phaser from "phaser";
import { CARD_H, CARD_W, panelTexture, slotTexture } from "../art/ui";
import { ITEMS, MAX_LEVEL, PET_LIST, copiesFor, levelMult } from "../data/items";
import { canLevelUp, levelUp, persist, save, toggleEquip } from "../systems/save";
import { INDEX_STEP, indexBonus } from "../systems/goals";
import { petSlots } from "../systems/stats";
import { buzz, sfx } from "../systems/sound";
import { fmt } from "./format";
import { Modal, button, drawBar, label, lockedCard, modal, petCard, text } from "./widgets";

const KIND_LABEL = { shot: "Shooter", pierce: "Beam", splash: "Explosion", zap: "Lightning", buff: "Support" };

/** Rough strength of a pet at its level, used by "Equip Best". */
export function petScore(id: string): number {
  const def = ITEMS[id];
  const m = levelMult(save.pets[id]?.level ?? 1);
  if (def.kind === "buff") return def.damage * m * 0.05 * (1 + def.index);
  return ((def.damage * m * def.count) / (def.cooldown / 1000)) * (def.kind === "splash" || def.kind === "pierce" ? 1.4 : 1);
}

export const anyLevelReady = () => Object.keys(save.pets).some(canLevelUp);

interface Scroller {
  list: Phaser.GameObjects.Container;
  top: number;
  bottom: number;
  max: number;
  items: { obj: Phaser.GameObjects.Container; onTap: () => void }[];
}

/** "My Pets" and "Index" sheets plus the pet detail popup. */
export class PetsScreen {
  private sheet: Modal | null = null;
  private kind: "pets" | "index" = "pets";
  private scroller: Scroller | null = null;
  private detail: Modal | null = null;
  private drag = { on: false, y: 0, oy: 0, moved: false };

  constructor(private scene: Phaser.Scene, private onChanged: () => void, private toast: (s: string, c?: string) => void) {
    const s = scene;
    s.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      const sc = this.scroller;
      if (!sc || this.detail || p.y < sc.top || p.y > sc.bottom) return;
      this.drag = { on: true, y: p.y, oy: sc.list.y, moved: false };
    });
    s.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.drag.on || !p.isDown || !this.scroller) return;
      const dy = p.y - this.drag.y;
      if (Math.abs(dy) > 14) this.drag.moved = true;
      this.scroller.list.y = Phaser.Math.Clamp(this.drag.oy + dy, -this.scroller.max, 0);
    });
    s.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.drag.on) return;
      this.drag.on = false;
      if (this.drag.moved || !this.scroller) return;
      const hit = this.scroller.items.find(({ obj }) => {
        const m = obj.getWorldTransformMatrix();
        return Math.abs(p.x - m.tx) < (CARD_W * m.scaleX) / 2 && Math.abs(p.y - m.ty) < (CARD_H * m.scaleY) / 2;
      });
      hit?.onTap();
    });
  }

  get isOpen(): boolean {
    return !!this.sheet || !!this.detail;
  }

  close(): void {
    this.detail?.close();
    this.sheet?.close();
  }

  open(kind: "pets" | "index"): void {
    this.sheet?.close();
    const s = this.scene;
    const W = s.scale.width;
    const H = s.scale.height;
    const top = 350;
    const h = H - top - 30;
    const cy = top + h / 2;
    const title = kind === "pets" ? "MY PETS" : `INDEX ${save.discovered.length}/${PET_LIST.length}`;
    const m = modal(s, 1030, h, title, kind === "pets" ? "orange" : "blue", () => {
      if (this.sheet === m) {
        this.sheet = null;
        this.scroller = null;
      }
    }, cy);
    this.sheet = m;
    this.kind = kind;
    const body = m.body;
    let gridTop = -h / 2 + 90;

    if (kind === "index") {
      const next = (Math.floor(save.discovered.length / INDEX_STEP) + 1) * INDEX_STEP;
      body.add(label(s, 0, -h / 2 + 100, `Collection bonus: Luck x${indexBonus().toFixed(2)}  •  +25% more at ${next} pets`, 30, "#4a2f1d"));
      gridTop += 44;
    } else {
      const slots = petSlots();
      body.add(label(s, -470, -h / 2 + 100, `TEAM ${save.equipped.length}/${slots}`, 34).setOrigin(0, 0.5));
      for (let i = 0; i < slots; i++) {
        const x = -440 + i * 112;
        const y = -h / 2 + 222;
        const id = save.equipped[i];
        if (id) {
          const c = petCard(s, x, y, id, { noOdds: true }).setScale(0.44);
          c.setInteractive({ useHandCursor: true }).on("pointerup", () => this.openPet(id));
          body.add(c);
        } else {
          body.add(s.add.image(x, y, slotTexture(s, 100, false)));
        }
      }
      body.add(button(s, 330, -h / 2 + 150, 300, 96, "blue", "EQUIP BEST", () => this.equipBest(), { icon: "icon_star", iconSize: 46, size: 30 }));
      body.add(button(s, 330, -h / 2 + 260, 300, 96, anyLevelReady() ? "green" : "grey", "LEVEL ALL", () => this.levelAll(), { icon: "icon_fuse", iconSize: 46, size: 30 }));
      gridTop = -h / 2 + 330;
    }

    const gridBottom = h / 2 - 30;
    body.add(s.add.image(0, (gridTop + gridBottom) / 2, panelTexture(s, "inset", 970, gridBottom - gridTop)));
    const list = s.add.container(0, 0);
    const mask = s.make.graphics({}, false).fillRect(0, cy + gridTop + 6, W, gridBottom - gridTop - 12);
    list.setMask(mask.createGeometryMask());
    body.add(list);

    const scale = kind === "pets" ? 0.8 : 0.72;
    const cols = 4;
    const colW = 238;
    const rowH = CARD_H * scale + 20;
    const items: Scroller["items"] = [];
    const place = (i: number) => ({ x: (i % cols - (cols - 1) / 2) * colW, y: gridTop + 18 + (CARD_H * scale) / 2 + Math.floor(i / cols) * rowH });

    const ids = kind === "pets"
      ? Object.keys(save.pets).sort((a, b) => ITEMS[b].index - ITEMS[a].index)
      : PET_LIST.map((p) => p.id);
    ids.forEach((id, i) => {
      const { x, y } = place(i);
      const owned = !!save.pets[id];
      const card = owned
        ? petCard(s, x, y, id, { level: true, equipped: kind === "pets" && save.equipped.includes(id) }).setScale(scale)
        : lockedCard(s, x, y, id).setScale(scale);
      list.add(card);
      if (owned) items.push({ obj: card, onTap: () => this.openPet(id) });
    });
    this.scroller = { list, top: cy + gridTop, bottom: cy + gridBottom, max: Math.max(0, Math.ceil(ids.length / cols) * rowH + 36 - (gridBottom - gridTop)), items };
  }

  private reopen(): void {
    if (!this.sheet) return;
    const y = this.scroller?.list.y ?? 0;
    this.sheet.root.destroy();
    this.sheet = null;
    this.open(this.kind);
    if (this.scroller) this.scroller.list.y = Phaser.Math.Clamp(y, -this.scroller.max, 0);
  }

  private changed(): void {
    persist();
    this.onChanged();
    this.reopen();
  }

  private equipBest(): void {
    save.equipped = Object.keys(save.pets).sort((a, b) => petScore(b) - petScore(a)).slice(0, petSlots());
    sfx.buy();
    this.changed();
  }

  private levelAll(): void {
    let n = 0;
    for (const id of Object.keys(save.pets)) while (levelUp(id)) n++;
    if (!n) {
      this.toast("Roll more copies to level up your pets!", "#ffe680");
      return;
    }
    sfx.levelUp();
    buzz(60);
    this.scene.cameras.main.flash(200, 200, 255, 170);
    this.toast(`+${n} pet level${n > 1 ? "s" : ""}!`, "#8af06a");
    this.changed();
  }

  openPet(id: string): void {
    const s = this.scene;
    const def = ITEMS[id];
    const h = 1180;
    const m = modal(s, 920, h, def.name, "purple", () => {
      if (this.detail === m) this.detail = null;
    });
    this.detail = m;
    const content = s.add.container(0, 0);
    m.body.add(content);
    const draw = () => {
      content.removeAll(true);
      const p = save.pets[id];
      const mult = levelMult(p.level);
      const max = p.level >= MAX_LEVEL;
      const need = copiesFor(p.level);
      const card = petCard(s, 0, -300, id, { level: true }).setScale(1.15);
      content.add(card);
      s.tweens.add({ targets: card, y: -308, duration: 1200, yoyo: true, repeat: -1, ease: "Sine.inOut" });
      content.add(label(s, 0, -92, def.description, 32, "#7a5236", 760));
      content.add(s.add.image(0, 70, panelTexture(s, "inset", 780, 240)));
      const dmg = (lv: number) => def.damage * levelMult(lv);
      const rows: [string, string, string][] = def.kind === "buff"
        ? [["icon_star", "Type", KIND_LABEL[def.kind]], ["icon_sword", "Team damage", `+${fmt(dmg(p.level))}%`]]
        : [
          ["icon_sword", "Damage", max ? fmt(dmg(p.level)) : `${fmt(dmg(p.level))}  →  ${fmt(dmg(p.level + 1))}`],
          ["icon_clock", "Attacks every", `${(def.cooldown / 1000).toFixed(1)}s`],
          ["icon_target", `${KIND_LABEL[def.kind]} targets`, String(def.count)],
        ];
      rows.forEach(([icon, name, value], i) => {
        const y = -2 + i * 72 + (rows.length === 2 ? 36 : 0);
        content.add([
          s.add.image(-330, y, icon).setScale(0.48),
          label(s, -290, y, name, 32).setOrigin(0, 0.5),
          text(s, 350, y, value, 36, "#ffe066").setOrigin(1, 0.5),
        ]);
      });
      // level bar
      const g = s.add.graphics();
      drawBar(g, -360, 228, 720, 36, max ? 1 : Math.min(1, p.copies / need), max ? 0xffcf3a : p.copies >= need ? 0x7ad651 : 0x5ac8ff);
      content.add(g);
      content.add(text(s, 0, 245, max ? `MAX LEVEL (x${mult.toFixed(2)})` : `Lv.${p.level}  •  copies ${p.copies}/${need}  •  power x${mult.toFixed(2)}`, 28));

      const equipped = save.equipped.includes(id);
      const full = !equipped && save.equipped.length >= petSlots();
      content.add(button(s, -205, 410, 380, 134, equipped ? "red" : "green", equipped ? "UNEQUIP" : full ? "SWAP IN" : "EQUIP", () => {
        if (full) {
          const weakest = [...save.equipped].sort((a, b) => petScore(a) - petScore(b))[0];
          save.equipped = save.equipped.filter((k) => k !== weakest);
        }
        toggleEquip(id, petSlots());
        sfx.buy();
        m.close();
        this.changed();
      }, { size: 42 }));
      const ready = canLevelUp(id);
      content.add(button(s, 205, 410, 380, 134, ready ? "orange" : "grey", max ? "MAXED" : "LEVEL UP", () => {
        if (!levelUp(id)) {
          this.toast(`Roll ${need - p.copies} more ${def.name} to level up`, "#ffe680");
          return;
        }
        persist();
        this.levelBurst(card);
        this.onChanged();
        s.time.delayedCall(450, () => {
          if (this.detail === m) draw();
          this.reopen();
        });
      }, { size: 40, sub: max ? "" : `${Math.min(p.copies, need)}/${need} copies` }).setEnabled(ready));
    };
    draw();
  }

  /** Sparkly "LEVEL UP!" moment on a card. */
  private levelBurst(card: Phaser.GameObjects.Container): void {
    const s = this.scene;
    sfx.levelUp();
    buzz(50);
    const m = card.getWorldTransformMatrix();
    const fx = s.add.particles(m.tx, m.ty, "spark", {
      speed: { min: 200, max: 520 }, lifespan: 700, scale: { start: 0.9, end: 0 }, tint: [0xffe066, 0x8af06a, 0xffffff], emitting: false,
    }).setDepth(6000);
    fx.explode(36);
    const t = text(s, m.tx, m.ty - 120, "LEVEL UP!", 72, "#8af06a").setDepth(6001).setScale(0);
    s.tweens.add({ targets: t, scale: 1, duration: 260, ease: "Back.out" });
    s.tweens.add({ targets: t, y: t.y - 60, alpha: 0, delay: 700, duration: 400, onComplete: () => t.destroy() });
    s.tweens.add({ targets: card, scale: card.scale * 1.15, duration: 120, yoyo: true });
    s.time.delayedCall(900, () => fx.destroy());
  }
}
