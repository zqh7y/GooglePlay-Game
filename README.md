# Dice Idle (working title)

An idle RNG game for Android. Roll dice for **100 pets** (from 1 in 2 up to 1 in 500Sp),
grow your **luck** through the **upgrade tree**, and let your cat gunner and pets fight
waves of monsters to earn the money that buys more upgrades.

Built with **Phaser 3 + TypeScript + Vite**. Will be wrapped for Google Play with **Capacitor**.

## Run it

```bash
npm install
npm run dev      # open the URL it prints (add --host to try it on your phone on the same Wi-Fi)
npm run build    # production build into dist/
```

`/dev/petsheet.html` (with `npm run dev`) shows all 100 pets on one page. Add `?v=golden` or `?v=rainbow` to see the fused versions.

## How the game works

- **Rolling** is free but has a cooldown. Each roll checks pets from rarest to most common
  with a chance of `luck / N` ("1 in N"), like Roblox RNG games. Higher luck means you
  stop rolling the common pets at all.
- **The upgrade tree** is the main progression: luck (trunk), roll speed and multi-roll
  (left), gems and potions, money (right) and power and pet slots (far right).
  The three mint cards at the bottom are shortcuts to the next luck, speed and money node.
- **Battle**: stages have 5 waves; wave 5 is a boss with a 30 second timer. Bosses drop gems.
- **Gems** buy luck potions (x2 luck for 5 minutes, upgradable in the tree).
- **Fusing**: 5 copies make a Golden pet (x3 power), 5 Golden make a Rainbow pet (x10).

## Where things live

| File | What it does |
|---|---|
| `src/data/pets.ts` | The 100 pets: name, species, colour, accessories, pattern |
| `src/data/items.ts` | Turns that table into pets with odds, rarity, attack type and damage |
| `src/data/tree.ts` | Every upgrade tree node: position, cost, effect |
| `src/data/rarity.ts` | The 10 rarity tiers and their colours |
| `src/systems/roll.ts` | The RNG roll and odds per tier |
| `src/systems/stats.ts` | Luck, roll speed, money and damage from the tree and potions |
| `src/systems/save.ts` | Save game, inventory, equipping, fusing |
| `src/scenes/Battle.ts` | The battlefield: cat, pets, monsters, bosses, money drops |
| `src/scenes/UI.ts` | HUD, side buttons, roll button, cards, tree screen, pet screens, popups |
| `src/art/pets.ts` | Draws every pet (species + accessories + patterns) |
| `src/art/characters.ts` | The cat gunner, its blaster, monsters and effects |
| `src/art/background.ts` | The battle map |
| `src/art/ui.ts` | Buttons, panels, cards, dice skins, icons, tree nodes |
| `src/ui/widgets.ts` | Reusable UI pieces: text, buttons, pet cards, popups |

All art is drawn with code on a canvas, so there are no image files yet.
To use real artwork later, load images under the same texture keys.
