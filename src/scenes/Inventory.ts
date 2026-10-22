import Phaser from "phaser";
import { FUSE_COST, ItemKey, VARIANT_INFO, nextVariant, parseKey } from "../data/items";
import { RARITY_INFO, rarityRank } from "../data/rarity";
import { MAX_EQUIPPED, fuse, save, toggleEquip } from "../systems/save";
import { button, coinLabel, itemCard, text, updateRainbow } from "../ui/widgets";

const VARIANT_RANK = { normal: 0, golden: 1, rainbow: 2 };
const TOP = 250;

export class InventoryScene extends Phaser.Scene {
  private list!: Phaser.GameObjects.Container;
  private cards: { key: ItemKey; card: Phaser.GameObjects.Container }[] = [];
  private popup: Phaser.GameObjects.GameObject[] = [];
  private maxScroll = 0;

  constructor() {
    super("Inventory");
  }

  create(): void {
    const W = this.scale.width;
    this.popup = [];
    this.add.tileSprite(0, 0, W, this.scale.height, "grid").setOrigin(0).setAlpha(0.5);
    this.list = this.add.container(0, 0);
    this.buildList();

    // Header drawn above the scrolling list
    this.add.rectangle(0, 0, W, TOP - 20, 0x0f1020).setOrigin(0).setDepth(10);
    button(this, 90, 50, 140, 64, "◀ Back", 0x334155, () => this.scene.start("Hub"), 26).setDepth(11);
    coinLabel(this, W - 30, 50).setText(`🪙 ${save.coins.toLocaleString()}`).setDepth(11);
    text(this, W / 2, 130, `Inventory  •  Equipped ${save.equipped.length}/${MAX_EQUIPPED}`, 30).setDepth(11);
    button(this, W / 2, 190, 360, 54, `✨ Fuse All (${FUSE_COST} → 1)`, 0xd97706, () => {
      let fused = 0;
      let again = true;
      while (again) {
        again = false;
        for (const key of Object.keys(save.inventory)) {
          if (fuse(key)) {
            fused++;
            again = true;
          }
        }
      }
      if (fused > 0) this.cameras.main.flash(200, 255, 215, 0);
      this.scene.restart();
    }, 24).setDepth(11);

    this.setupScrolling();
  }

  update(time: number): void {
    updateRainbow(this.cards.map((c) => c.card), time);
  }

  private buildList(): void {
    const keys = Object.keys(save.inventory).sort((a, b) => {
      const A = parseKey(a);
      const B = parseKey(b);
      return (
        rarityRank(B.def.rarity) - rarityRank(A.def.rarity) ||
        VARIANT_RANK[B.variant] - VARIANT_RANK[A.variant] ||
        A.def.name.localeCompare(B.def.name)
      );
    });
    this.cards = keys.map((key, i) => {
      const x = 105 + (i % 4) * 170;
      const y = TOP + 110 + Math.floor(i / 4) * 215;
      const card = itemCard(this, x, y, key, save.inventory[key]);
      if (save.equipped.includes(key)) {
        card.add(this.add.rectangle(-54, -10, 30, 30, 0x16a34a).setStrokeStyle(2, 0x000000));
        card.add(text(this, -54, -10, "E", 20));
      }
      if (save.inventory[key] >= FUSE_COST && nextVariant(parseKey(key).variant)) {
        card.add(text(this, 50, -10, "⬆", 26, "#fbbf24"));
      }
      this.list.add(card);
      return { key, card };
    });
    const rows = Math.ceil(keys.length / 4);
    this.maxScroll = Math.max(0, TOP + rows * 215 + 40 - this.scale.height);
  }

  /** Drag to scroll; a short tap opens the item. */
  private setupScrolling(): void {
    let startY = 0;
    let startList = 0;
    let dragging = false;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.popup.length || p.y < TOP - 20) return;
      startY = p.y;
      startList = this.list.y;
      dragging = true;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!dragging || !p.isDown) return;
      this.list.y = Phaser.Math.Clamp(startList + (p.y - startY), -this.maxScroll, 0);
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(p.y - startY) > 12) return;
      const hit = this.cards.find(({ card }) =>
        Math.abs(p.x - card.x) < 75 && Math.abs(p.y - (card.y + this.list.y)) < 95);
      if (hit) this.openItem(hit.key);
    });
  }

  private openItem(key: ItemKey): void {
    const W = this.scale.width;
    const { def, variant } = parseKey(key);
    const count = save.inventory[key] ?? 0;
    const mult = VARIANT_INFO[variant].mult;
    const equipped = save.equipped.includes(key);
    const next = nextVariant(variant);
    const close = () => {
      this.popup.forEach((o) => o.destroy());
      this.popup = [];
    };

    const dim = this.add.rectangle(0, 0, W, this.scale.height, 0x000000, 0.75).setOrigin(0).setInteractive().setDepth(50);
    const panel = this.add.rectangle(W / 2, 640, 620, 900, 0x1e2140).setStrokeStyle(5, RARITY_INFO[def.rarity].color).setDepth(50);
    const card = itemCard(this, W / 2, 400, key, count).setScale(1.5).setDepth(51);
    const kindLabel = { bolt: "Projectile", orbit: "Orbiting", aura: "Area", nova: "Burst", lightning: "Lightning" }[def.kind];
    const stats = text(
      this, W / 2, 720,
      `${def.description}\n\nType: ${kindLabel}\nDamage: ${Math.round(def.damage * mult)}` +
        (variant !== "normal" ? `  (x${mult})` : "") +
        (def.cooldown ? `\nAttack every ${(def.cooldown / 1000).toFixed(1)}s` : "") +
        `\nAmount: ${def.count}`,
      26, "#e2e8f0",
    ).setDepth(51).setWordWrapWidth(540);
    this.popup.push(dim, panel, card, stats);

    const canEquip = equipped || save.equipped.length < MAX_EQUIPPED;
    this.popup.push(
      button(this, W / 2 - 150, 900, 270, 90, equipped ? "Unequip" : canEquip ? "Equip" : "Slots full", equipped ? 0xdc2626 : 0x16a34a, () => {
        toggleEquip(key);
        this.scene.restart();
      }, 30).setDepth(52).setEnabled(canEquip),
    );
    if (next) {
      this.popup.push(
        button(this, W / 2 + 150, 900, 270, 90, `Fuse ${Math.min(count, FUSE_COST)}/${FUSE_COST}\n→ ${VARIANT_INFO[next].label.trim()}`, 0xd97706, () => {
          if (fuse(key)) this.cameras.main.flash(200, 255, 215, 0);
          this.scene.restart();
        }, 24).setDepth(52).setEnabled(count >= FUSE_COST),
      );
    }
    this.popup.push(button(this, W / 2, 1020, 240, 70, "Close", 0x475569, close, 28).setDepth(52));
  }
}
