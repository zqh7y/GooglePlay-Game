# Dice Idle (working title)

An idle RNG game for Android. Roll dice for **100 pets** (from 1 in 2 up to 1 in 500Sp),
grow your **luck** through the **upgrade tree**, and explore a big world with your survivor
and pets, protecting each land's heart from waves of monsters. The run ends at **stage 100**.

Built with **Phaser 3 + TypeScript + Vite**. Will be wrapped for Google Play with **Capacitor**.

## Run it

```bash
npm install
npm run dev      # open the URL it prints (add --host to try it on your phone on the same Wi-Fi)
npm run build    # production build into dist/
```

Dev pages (with `npm run dev`): `/dev/petsheet.html` shows all 100 pets, `/dev/chars.html` the hero and
monsters, `/dev/world.html` every building, tree and prop.

Balance check: `npx esbuild dev/sim.ts --bundle --platform=node --outfile=/tmp/sim.js && node /tmp/sim.js`
plays the game with the real numbers and prints how many hours a steady player needs per stage.

## How the game works

- **Rolling** is free with a cooldown. Each roll checks pets from rarest to most common with a chance of
  `luck / N` ("1 in N"). Reels spin at the bottom of the screen; rare pulls get a slower, suspenseful reel.
  Every 10th roll is a Lucky Roll (x2 luck).
- **Pets** come in one kind only. Extra copies **level a pet up** (+15% damage per level, up to Lv.30).
  Pet damage grows with rarity, so rarer pets are what push you further.
- **The world** is one big map with five lands, 20 stages each: Sunny Village (1-20), Harvest Farms (21-40),
  Misty Woods (41-60), Sunset Dunes (61-80) and Frost Peak (81-100). Lands are hidden under clouds until you
  reach them, then the camera flies over and the clouds blow away.
- **Fighting**: drag anywhere to move (WASD / arrows on desktop), or let **Hunt** chase monsters for you.
  Monsters come out of portals and walk around obstacles to the land's heart (fountain, windmill, great tree,
  obelisk, ice crystal). If the heart falls you drop back a wave. Each stage has 5 waves; wave 5 is a boss.
- **Treasure chests** are hidden around the map (they refill after a few minutes).
- **The upgrade tree** is a honeycomb of 101 hexagons in six colour-coded branches (luck, rolling, money,
  power, team, gems and potions). Bright = bought, glowing = you can buy it, grey = too expensive, dark "?" = locked.
- **Goals**: quests, a 7-day daily reward, +25% luck for every 10 pets in the Index, gems from bosses for luck potions.

## Where things live

| File | What it does |
|---|---|
| `src/data/pets.ts` | The 100 pets: name, species, colours, accessories, pattern, eyes |
| `src/data/items.ts` | Turns that table into pets with odds, rarity, attack type, damage and levels |
| `src/data/tree.ts` | Every upgrade hexagon: position, price, effect |
| `src/data/balance.ts` | Monster health, money and wave sizes per stage (shared with the simulator) |
| `src/data/regions.ts` | The five lands: stages, heart, colours, monsters |
| `src/data/rarity.ts` | The 10 rarity tiers and their colours |
| `src/systems/roll.ts` | The RNG roll and odds per tier |
| `src/systems/stats.ts` | Luck, roll speed, money and damage from the tree and potions |
| `src/systems/save.ts` | Save game, pets and levels, equipping |
| `src/systems/goals.ts` | Quests, daily rewards and Index milestones |
| `src/systems/sound.ts` | Synthesized sound effects and vibration |
| `src/game/world.ts` | Lays out the world: roads, river, lakes, buildings, trees, chests, portals, collisions, monster paths |
| `src/scenes/Battle.ts` | The world scene: movement, camera, pets, monsters, bosses, cutscenes, money drops |
| `src/scenes/UI.ts` | HUD, side buttons, roll reveal, celebrations, quests, map and popups |
| `src/ui/treeScreen.ts` | The honeycomb upgrade tree screen |
| `src/ui/petsScreen.ts` | My Pets, Index and the pet popup with levelling |
| `src/art/pets.ts` | Draws every pet (20 species + accessories + patterns) |
| `src/art/characters.ts` | The survivor hero, the blaster, monsters and effects |
| `src/art/world.ts` | Houses, landmarks, trees, props, chests, portals, clouds |
| `src/art/ground.ts` | Paints the ground of the whole map once (lands, roads, water, fields) |
| `src/art/ui.ts` | Buttons, panels, cards, dice skins, icons |
| `src/ui/widgets.ts` | Reusable UI pieces: text, buttons, pet cards, popups |

All art is drawn with code on a canvas, so there are no image files yet.
To use real artwork later, load images under the same texture keys.
