import Phaser from "phaser";
import { CARD_H, CARD_W, panelTexture, slotTexture } from "../art/ui";
import { ITEMS, MAX_LEVEL, PET_LIST, copiesFor, levelMult } from "../data/items";
import { INDEX_STEP, indexBonus } from "../systems/goals";
import { canLevelUp, levelUp, persist, save, toggleEquip } from "../systems/save";
import { buzz, sfx } from "../systems/sound";
import { petSlots } from "../systems/stats";
import { fmt } from "./format";
import { Host, Screen } from "./screens";
import { Button, Modal, button, drawBar, label, lockedCard, modal, petCard, text } from "./widgets";

const KIND_LABEL = { shot: "Shooter", pierce: "Star thrower", splash: "Bomber", zap: "Pouncer", buff: "Support" };

/** Rough strength of a pet at its level, used by "Equip Best". */
export function petScore(id: string): number {
  const def = ITEMS[id];
  const m = levelMult(save.pets[id]?.level ?? 1);
  if (def.kind === "buff") return def.damage * m * 0.05 * (1 + def.index);
  return ((def.damage * m * def.count) / (def.cooldown / 1000)) * (def.kind === "splash" || def.kind === "pierce" ? 1.4 : 1);
}

export const anyLevelReady = () => Object.keys(save.pets).some(canLevelUp);

/** My Pets (team + collection with levels) and the Index of all 100 pets. */
export class PetsScreen extends Screen {
  private tab: "pets" | "index" = "pets";
  private content: Phaser.GameObjects.Container;
  private list: Phaser.GameObjects.Container | null = null;
  private listTop = 0;
  private listBottom = 0;
  private listMax = 0;
  private items: { obj: Phaser.GameObjects.Container; onTap: () => void }[] = [];
  private tabBtns: Record<"pets" | "index", Button>;
  private detail: Modal | null = null;
  private drag = { on: false, y: 0, oy: 0, moved: false };

  constructor(scene: Phaser.Scene, host: Host) {
    super(scene, host, "pets");
    const s = scene;
    const W = s.scale.width;
    const y = host.L.headerBottom + 56;
    this.tabBtns = {
      pets: button(s, W / 2 - 230, y, 420, 100, "orange", "MY PETS", () => this.setTab("pets"), { icon: "icon_paw", iconSize: 52, size: 36 }),
      index: button(s, W / 2 + 230, y, 420, 100, "grey", "INDEX", () => this.setTab("index"), { icon: "icon_book", iconSize: 52, size: 36 }),
    };
    this.content = s.add.container(0, 0);
    this.root.add([this.tabBtns.pets, this.tabBtns.index, this.content]);

    s.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.visible || !this.list || this.detail || p.y < this.listTop || p.y > this.listBottom) return;
      this.drag = { on: true, y: p.y, oy: this.list.y, moved: false };
    });
    s.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.drag.on || !p.isDown || !this.list) return;
      const dy = p.y - this.drag.y;
      if (Math.abs(dy) > 14) this.drag.moved = true;
      this.list.y = Phaser.Math.Clamp(this.drag.oy + dy, -this.listMax, 0);
    });
    s.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.drag.on) return;
      this.drag.on = false;
      if (this.drag.moved || !this.list) return;
      const hit = this.items.find(({ obj }) => {
        const m = obj.getWorldTransformMatrix();
        return Math.abs(p.x - m.tx) < (CARD_W * m.scaleX) / 2 && Math.abs(p.y - m.ty) < (CARD_H * m.scaleY) / 2;
      });
      hit?.onTap();
    });
  }

  protected onShow(): void {
    this.build();
  }

  private setTab(tab: "pets" | "index"): void {
    this.tab = tab;
    this.build();
  }

  /** Rebuild the screen, keeping the scroll position. */
  build(): void {
    const keepY = this.list?.y ?? 0;
    const s = this.scene;
    const W = s.scale.width;
    const L = this.host.L;
    this.tabBtns.pets.setColor(this.tab === "pets" ? "orange" : "grey");
    this.tabBtns.index.setColor(this.tab === "index" ? "blue" : "grey");
    this.content.removeAll(true);
    this.items = [];
    let gridTop = L.headerBottom + 130;

    if (this.tab === "index") {
      const next = (Math.floor(save.discovered.length / INDEX_STEP) + 1) * INDEX_STEP;
      this.content.add(s.add.image(W / 2, gridTop + 40, panelTexture(s, "glass", 1000, 80)));
      this.content.add(text(s, W / 2, gridTop + 40, `Found ${save.discovered.length}/${PET_LIST.length}  •  Luck x${indexBonus().toFixed(2)}  •  +25% at ${next}`, 32));
      gridTop += 100;
    } else {
      const slots = petSlots();
      const teamY = gridTop + 110;
      this.content.add(s.add.image(W / 2, teamY, panelTexture(s, "cream", 1040, 230)));
      this.content.add(label(s, 60, teamY - 82, `TEAM ${save.equipped.length}/${slots}`, 32).setOrigin(0, 0.5));
      for (let i = 0; i < 6; i++) {
        const x = 110 + i * 112;
        const id = save.equipped[i];
        if (i >= slots) {
          this.content.add(s.add.image(x, teamY + 20, slotTexture(s, 100, true)));
          this.content.add(s.add.image(x, teamY + 20, "icon_lock").setScale(0.4));
        } else if (id) {
          const c = petCard(s, x, teamY + 20, id, { noOdds: true }).setScale(0.44);
          c.setInteractive({ useHandCursor: true }).on("pointerup", () => this.openPet(id));
          this.content.add(c);
        } else {
          this.content.add(s.add.image(x, teamY + 20, slotTexture(s, 100, false)));
        }
      }
      this.content.add(button(s, W - 170, teamY - 48, 280, 90, "blue", "EQUIP BEST", () => this.equipBest(), { icon: "icon_star", iconSize: 42, size: 28 }));
      this.content.add(button(s, W - 170, teamY + 56, 280, 90, anyLevelReady() ? "green" : "grey", "LEVEL ALL", () => this.levelAll(), { icon: "icon_fuse", iconSize: 42, size: 28 }));
      gridTop = teamY + 140;
    }

    const gridBottom = L.navTop - 20;
    this.content.add(s.add.image(W / 2, (gridTop + gridBottom) / 2, panelTexture(s, "inset", 1040, gridBottom - gridTop)));
    const list = s.add.container(0, 0);
    const mask = s.make.graphics({}, false).fillRect(0, gridTop + 6, W, gridBottom - gridTop - 12);
    list.setMask(mask.createGeometryMask());
    this.content.add(list);
    const scale = this.tab === "pets" ? 0.8 : 0.72;
    const cols = 4;
    const colW = 245;
    const rowH = CARD_H * scale + 20;
    const ids = this.tab === "pets" ? Object.keys(save.pets).sort((a, b) => ITEMS[b].index - ITEMS[a].index) : PET_LIST.map((p) => p.id);
    ids.forEach((id, i) => {
      const x = W / 2 + ((i % cols) - (cols - 1) / 2) * colW;
      const y = gridTop + 18 + (CARD_H * scale) / 2 + Math.floor(i / cols) * rowH;
      const owned = !!save.pets[id];
      const card = owned
        ? petCard(s, x, y, id, { level: true, equipped: this.tab === "pets" && save.equipped.includes(id) }).setScale(scale)
        : lockedCard(s, x, y, id).setScale(scale);
      list.add(card);
      if (owned) this.items.push({ obj: card, onTap: () => this.openPet(id) });
    });
    this.list = list;
    this.listTop = gridTop;
    this.listBottom = gridBottom;
    this.listMax = Math.max(0, Math.ceil(ids.length / cols) * rowH + 36 - (gridBottom - gridTop));
    list.y = Phaser.Math.Clamp(keepY, -this.listMax, 0);
  }

  private changed(): void {
    persist();
    this.host.petsChanged();
    this.build();
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
      this.host.toast("Roll more copies to level up your pets!", "#ffe680");
      return;
    }
    sfx.levelUp();
    buzz(60);
    this.scene.cameras.main.flash(200, 200, 255, 170);
    this.host.toast(`+${n} pet level${n > 1 ? "s" : ""}!`, "#8af06a");
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
          this.host.toast(`Roll ${need - p.copies} more ${def.name} to level up`, "#ffe680");
          return;
        }
        persist();
        this.levelBurst(card);
        this.host.petsChanged();
        s.time.delayedCall(450, () => {
          if (this.detail === m) draw();
          this.build();
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
