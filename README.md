# Dice Idle (working title)

An idle RNG game for Android. Roll dice for **100 pets** (from 1 in 2 up to 1 in 500Sp),
grow your **luck** through the **upgrade tree**, and fight with your box-shaped survivor and pets:
every stage is a **5 minute survival run** (Survivor.io style) on a big open field where you also have to
protect the land's crystal. The game ends at **stage 100**.

Built with **Phaser 3 + TypeScript + Vite**. Will be wrapped for Google Play with **Capacitor**.

## Run it

```bash
npm install
npm run dev      # open the URL it prints (add --host to try it on your phone on the same Wi-Fi)
npm run build    # production build into dist/
```

Dev pages (with `npm run dev`): `/dev/petsheet.html` shows all 100 pets, `/dev/chars.html` the hero and
monsters, `/dev/world.html` every tree, plant, rock and crystal.

Balance check: `npx esbuild dev/sim.ts --bundle --platform=node --outfile=/tmp/sim.js && node /tmp/sim.js`
plays the game run by run with the real numbers and prints how many hours (and failed runs) a steady
player needs per stage.

## How the game works

- **Rolling costs one die.** Dice are found on the battle map (and in chests, on elites and from the boss),
  or bought with gems in the Shop. Each roll checks pets from rarest to most common with a chance of
  `luck / N` ("1 in N"). Reels spin at the bottom of the screen; rare pulls get a slower, suspenseful reel.
  Every 10th roll is a Lucky Roll (x2 luck).
- **Pets** come in one kind only. Extra copies **level a pet up** (+15% damage per level, up to Lv.30).
  Pet damage grows with rarity, so rarer pets are what push you further.
- **Screens** (bottom tab bar): **Shop** (free gift every 10 minutes, daily reward, potions, dice, lucky
  rolls, money packs), **Pets** (team, levels, Index), **Battle**, **Roll** (luck, the big die, reels, auto/fast,
  quick upgrades) and **Upgrades** (the honeycomb tree). The **Map** (from Battle) shows the 100-stage journey.
- **Lands**: five big open fields (you can walk everywhere), 20 stages each: Sunny Meadow (1-20), Golden
  Fields (21-40), Misty Forest (41-60), Sunset Dunes (61-80) and Frost Peak (81-100).
- **A stage**: drag anywhere to move (WASD / arrows on desktop); your hero and pets shoot by themselves.
  Survive **5:00** while monsters come faster and tougher every minute (with a swarm closing in at each
  minute mark), then **kill the boss** (it charges, watch the red line). Most monsters hunt you; raiders go
  for the crystal. If you fall or the crystal breaks, the run is over: revive once for gems or try again.
- **Skills**: kills drop XP gems. Every level up freezes the fight and offers 3 of 12 skills (Power Shot,
  Rapid Fire, Multi Shot, Orbit Blades, Lightning, Fire Aura, Rockets, Swift Boots, Magnet, Vitality,
  Crystal Guard, Pet Fury), each up to level 5. They reset every stage.
- **On the map**: dice, hearts, magnets, bombs, freeze, skill orbs (a free skill) and treasure chests.
- **Music**: little synthesized chiptune loops (calm, battle and boss); Music and Sound toggles in Settings.
- **The upgrade tree** is a honeycomb of 101 hexagons in six colour-coded branches (luck, rolling, money,
  power, team, gems and potions). Bright = bought, glowing = you can buy it, grey = too expensive, dark "?" = locked.
- **Goals**: quests, a 7-day daily reward, +25% luck for every 10 pets in the Index, gems from bosses for luck potions.

## Where things live

| File | What it does |
|---|---|
| `src/data/pets.ts` | The 100 pets: name, species, colours, accessories, pattern, eyes |
| `src/data/items.ts` | Turns that table into pets with odds, rarity, attack type, damage and levels |
| `src/data/tree.ts` | Every upgrade hexagon: position, price, effect |
| `src/data/balance.ts` | Stage length, monster health / speed / money per stage and minute, spawn rate, XP (shared with the simulator) |
| `src/data/skills.ts` | The 12 in-run skills |
| `src/data/regions.ts` | The five lands: stages, colours, crystal, scenery, monsters |
| `src/data/rarity.ts` | The 10 rarity tiers and their colours |
| `src/systems/roll.ts` | The RNG roll and odds per tier |
| `src/systems/stats.ts` | Luck, roll speed, money and damage from the tree and potions |
| `src/systems/save.ts` | Save game, pets and levels, equipping |
| `src/systems/goals.ts` | Quests, daily rewards and Index milestones |
| `src/systems/sound.ts` | Synthesized sound effects, the music sequencer and vibration |
| `src/game/arena.ts` | Lays out each land's field (tree fence, groves, plants, ground patches) |
| `src/scenes/Battle.ts` | A stage: clock, spawning, movement, camera, pets, skills, pickups, boss, win / lose |
| `src/scenes/UI.ts` | Tab bar, top bar, battle HUD, skill picker, defeat screen, rolling, celebrations, quests and popups |
| `src/ui/rollScreen.ts` | The Roll screen and its reel animation |
| `src/ui/petsScreen.ts` | My Pets, Index and the pet popup with levelling |
| `src/ui/shopScreen.ts` | The Shop screen |
| `src/ui/mapScreen.ts` | The 100-stage journey map |
| `src/ui/treeScreen.ts` | The honeycomb upgrade tree screen |
| `src/art/pets.ts` | Draws every pet (20 species + accessories + patterns) |
| `src/art/characters.ts` | The box survivor hero, the blaster, monsters and effects |
| `src/art/world.ts` | Trees, plants, rocks, chests and each land's crystal |
| `src/art/ground.ts` | Paints each land's seamless floor tile, ground patches, the stone circle and the minimap |
| `src/art/pickups.ts` | XP gems, dice, power-ups, skill orbs and skill icons |
| `src/art/ui.ts` | Buttons, panels, cards, dice skins, icons |
| `src/ui/widgets.ts` | Reusable UI pieces: text, buttons, pet cards, popups |

All art is drawn with code on a canvas, so there are no image files yet.
To use real artwork later, load images under the same texture keys.
