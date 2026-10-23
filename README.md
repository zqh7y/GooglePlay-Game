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
- **Rolling** shows slot-machine reels at the bottom. Every 10th roll is a Lucky Roll (x2 luck).
- **The village**: drag anywhere to move the cat (WASD / arrows on desktop). Monsters come in
  from the forest roads and attack the fountain; if the village's health runs out you drop back
  a wave. Each stage has 5 waves and wave 5 is a boss. "Hunt" makes the cat chase monsters by itself.
  Kill streaks build a combo that pays up to +100% money.
- **Map**: travel to Harvest Farms (stage 10), Misty Woods (25) and Frost Peak (45). Tougher
  monsters, much more money.
- **Goals**: three quests at a time (harder and better paid as you go), a 7-day daily reward
  streak, and +25% permanent luck for every 10 different pets in the Index.
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
| `src/systems/goals.ts` | Quests, daily rewards and Index milestones |
| `src/systems/sound.ts` | Synthesized sound effects and vibration |
| `src/data/areas.ts` | The places you can travel to and their look |
| `src/game/world.ts` | Lays out a village: roads, houses, farms, pond, forest, collisions |
| `src/scenes/Battle.ts` | The village fight: movement, camera, pets, monsters, bosses, money drops |
| `src/scenes/UI.ts` | HUD, side buttons, roll button, cards, tree screen, pet screens, popups |
| `src/art/pets.ts` | Draws every pet (species + accessories + patterns) |
| `src/art/characters.ts` | The cat gunner, its blaster, monsters and effects |
| `src/art/village.ts` | Houses, barns, windmill, fountain, trees, crops, fences, props |
| `src/art/ui.ts` | Buttons, panels, cards, dice skins, icons, tree nodes |
| `src/ui/widgets.ts` | Reusable UI pieces: text, buttons, pet cards, popups |

All art is drawn with code on a canvas, so there are no image files yet.
To use real artwork later, load images under the same texture keys.
