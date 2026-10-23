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

Dev pages (with `npm run dev`): `/dev/petsheet.html` shows all 100 pets (`?frame=1` / `2` for the walk
frames), `/dev/chars.html` the hero and monsters, `/dev/world.html` every tree, plant, rock and crystal,
`/dev/guns.html` every gun, pickup and skill icon.

Balance check: `npx esbuild dev/sim.ts --bundle --platform=node --outfile=/tmp/sim.js && node /tmp/sim.js`
plays the game run by run with the real numbers and prints how many hours (and failed runs) a steady
player needs per stage.

## How the game works

- **Rolling costs one die.** Dice are found in battle (on the map, in chests, on elites and from the boss)
  or bought with gems in the Shop. Dice come in tiers **A, B, C, D, E, S, SSS, uSSS**; which tiers drop
  depends on the stage (a D die is a dream at stage 10 and normal at stage 100; uSSS stays very rare), and a
  rarer die multiplies the roll's luck. Each roll checks pets from rarest to most common with a chance of
  `luck / N` ("1 in N"). Reels spin at the bottom of the screen; rare pulls get a slower, suspenseful reel.
  Every 10th roll is a Lucky Roll (x2 luck).
- **Pets** come in one kind only. Extra copies **level a pet up** (+15% damage per level, up to Lv.30).
  Pet damage grows with rarity, so rarer pets are what push you further.
- **Screens** (bottom tab bar): **Shop**, **Pets**, **Battle**, **Roll** and **Upgrades** (the honeycomb
  tree), all described below. The **Map** (from Battle) shows the 100-stage journey.
- **Top bar**: one slim row with settings, money, gems and dice. Tap money or gems to open the Shop, or
  dice to open Roll. During a fight only the money stays.
- **The Roll screen**:
  - The die sits inside a **lucky ring**. Each roll lights one segment; when the ring is full and gold,
    the next roll is a lucky roll.
  - Two meters fill as you roll:
    - **SUPER ROLL**: every 50th roll has x10 luck.
    - **Roll gift**: every 25 rolls a present pops out with dice and gems.
  - **Hot streak**: rolling again within a few seconds adds +2% luck per roll, up to +50%.
  - Before a big pull the die **charges up** through each rarity colour with rising notes and shakes.
  - Rare pulls bring rays, flashes, confetti, a **NEW RECORD!** stamp when it is your rarest pet ever,
    and "LEVEL UP READY!" when a copy completes a level.
  - **Next to find** shows the three easiest pets you are missing, with your own chance per roll.
- **Pet classes**: every pet has a class from **A** to **uSSS**, like dice and guns:

  | Class | A | B | C | D | E | S | SSS | uSSS |
  |---|---|---|---|---|---|---|---|---|
  | Pets | 18 | 16 | 15 | 14 | 12 | 11 | 9 | 5 |

  The class badge and the pet's chance are drawn in the class colours, and the letters move:
  - A stays still, and B and C gently glow.
  - D and E shimmer.
  - S burns red and gold.
  - SSS cycles jewel colours.
  - uSSS is a fast rainbow.

  S and up also glow and pulse. The class shows on cards, the Index, the team stage, the
  roll reveal ("S CLASS!"), the battlefield labels and the odds popup. The odds popup gives
  your chance per roll for each class.
- **The Pets screen**:
  - Your team stands on a **lit stage** with a **TEAM POWER** number that counts up when it grows.
  - The **collection** tracker shows found pets, the next luck reward, and a check per finished rarity.
  - The grid has **NEW** tags, green glow on pets ready to level, sorting (Power, Rarity, Level, Newest),
    and "roll to find" teasers for the next pets.
  - The pet popup shows its power now and at the next level. Levelling up bursts with "+POWER".
- **Lands**: five big open fields (you can walk everywhere), 20 stages each: Sunny Meadow (1-20), Golden
  Fields (21-40), Misty Forest (41-60), Sunset Dunes (61-80) and Frost Peak (81-100).
- **The Shop**:
  - **Deal of the Day**: a different bundle every day at about half price. It can be bought once and shows a
    countdown to midnight.
  - **Free**: a gift every 10 minutes (gems, dice and money) and the daily reward.
  - **Lucky Wheel**: one free spin every 4 hours, then 8 gems a spin. Prizes are dice, money, gems, a
    potion, or the rare MEGA jackpot.
  - **Treasure Chests**: Wooden (money), Silver and Golden (gems). Each one shakes, pops open and throws out
    dice rolled for your stage plus bonus gems, money and potions.
  - **Battle Boosts**, bought with money and used up by your next fight:
    - Golden Start: a C-tier toy gun.
    - Second Chance: a free revive.
    - Head Start: 2 skills right away.
    - Crystal Armor: +50% crystal health.

    Boosts you own are shown above the BATTLE button.
  - **Shelves**: dice, potions, money and gems (real-money gems are "coming soon").
- **The Battle tab is a lobby**: the fight only starts when you press **BATTLE**. During a fight the tab bar
  and shops are gone; you only get **Pause** (resume, sound, music, give up) and **Stats**.
- **A stage**: drag anywhere to move (WASD / arrows on desktop); your hero shoots by itself. The camera is
  zoomed out (1.66x) so you see more of the field. Survive **5:00** against hordes of monsters that come
  faster and tougher every minute (a ring of them closes in at each minute mark). If you fall or the crystal
  breaks, the run is over: revive once for gems, try again, or go back to the lobby.
- **The boss**: at 5:00 every monster runs off, a WARNING flashes, a storm rolls in and a claw carries the
  crystal into the sky. The boss drops down next to you with a title card and its own music. It is just you
  and your pets against it (health of 100 normal monsters). It charges (red marks on the ground), stomps
  (a red circle) and throws rocks. Beat it and the crystal floats back down.
- **Pets** (a team of up to 3: one at the start, two Pet Slot upgrades) run around the field after monsters
  near you: shooters throw orbs, bombers lob bombs, pouncers leap and bite, star throwers throw spinning
  stars; support pets stay by your side. Monsters that bump into a pet hurt it; at zero health it is knocked
  out for 8 s. Over each pet: its name and odds ("Kitty 1 in 10A") and a health bar. No lasers anywhere.
- **The crystal shield**: the crystal is open for 45 s, then shielded for 45 s, and so on. While it is open,
  monsters marching in from far away go for the crystal (and turn on you if you get close); while it is
  shielded every monster hunts you, and the ones hunting you keep hunting you afterwards.
- **Toy guns**: every stage starts with a Water Pistol. **Airdrops** parachute in about every 40 s with a
  gun of tier A (Common), B (Rare), C (Super Rare), D (Epic), E (Legendary), S (Mythic) or SSS (Titanic,
  almost impossible); the longer you survive the better the odds. A light beam shows the tier before you open
  it. Better guns are equipped right away, worse ones are scrapped for money. 14 toys, each with its own
  ammo: Water Pistol, Cork Popper, Foam Blaster, Bubble Blaster, Confetti Cannon, Candy Shooter, Paintball
  Rifle, Snowball Rifle, Pea Shooter, Firework Blaster, Gumball Gatling, Water Balloon Launcher, Dragon
  Breath and Rainbow Star Blaster (damage, fire rate, magazine, reload, spread, range, pierce, splash).
- **Crystal dice**: every 30 s you survive, the crystal pops out a die that lands nearby. It is an A die on
  stages 1-20, B on 21-40, C on 41-60, D on 61-80 and E on 81-100.
- **Numbers**: A = thousand, B = million, C = billion and so on (1.5A = 1,500).
- **Skills**: monsters drop small glowing bones and meat (XP). Every level up freezes the fight and offers 3
  skills. You carry at most **4 different skills** per stage, each up to level 5, and a good run levels high
  enough (about 22) to max all four. They reset every stage: Big Mag, Quick Reload, Hollow Points, Hair
  Trigger, Long Barrel, Boom Rounds, Swift Boots, Magnet, Crystal Mend, Lucky Drops (better airdrops), Thick
  Cardboard, Crystal Shards (the crystal shoots shards at monsters around it), Box Fort (stand still to dig
  in) and Pack Leader (pets).
- **On the map**: dice, hearts, magnets, bombs, freeze, skill orbs (a free skill), treasure chests and airdrops.
- **Pets** walk and run with a stepping animation (floating pets bob). Every pet card shows its odds at the top.
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
| `src/data/skills.ts` | The 14 in-run skills |
| `src/data/guns.ts` | The 14 guns and their stats |
| `src/data/tiers.ts` | Tiers A to uSSS: names, colours, dice odds per stage, airdrop odds, dice luck |
| `src/data/regions.ts` | The five lands: stages, colours, crystal, scenery, monsters |
| `src/data/rarity.ts` | The 10 rarity tiers and their colours |
| `src/systems/roll.ts` | The RNG roll and odds per tier |
| `src/systems/stats.ts` | Luck, roll speed, money and damage from the tree and potions |
| `src/systems/save.ts` | Save game, pets and levels, equipping |
| `src/systems/goals.ts` | Quests, daily rewards and Index milestones |
| `src/systems/sound.ts` | Synthesized sound effects, the music sequencer and vibration |
| `src/game/arena.ts` | Lays out each land's field (tree fence, groves, plants, ground patches) |
| `src/scenes/Battle.ts` | A stage: lobby, clock, crystal shield, spawning, guns and bullets, airdrops, pets, skills, pickups, boss, win / lose |
| `src/scenes/UI.ts` | Tab bar, top bar, lobby, battle HUD (minimap, joystick, gun panel), pause, stats, skill picker, defeat screen, rolling, popups |
| `src/ui/rollScreen.ts` | The Roll screen: lucky ring, SUPER ROLL and gift meters, hot streak, charge-up and reel reveal, next-to-find |
| `src/ui/classText.ts` | Pet class badges and the animated class colours |
| `src/ui/petsScreen.ts` | The Pets screen: team stage and power, collection, sorted grid, Index, pet popup with levelling |
| `src/ui/shopScreen.ts` | The Shop: deal of the day, free gifts, lucky wheel, chests and their opening show, boosts, shelves |
| `src/data/boosts.ts` | The four Battle Boosts |
| `src/ui/mapScreen.ts` | The 100-stage journey map |
| `src/ui/treeScreen.ts` | The honeycomb upgrade tree screen |
| `src/art/pets.ts` | Draws every pet (20 species + accessories + patterns) |
| `src/art/characters.ts` | The box survivor hero, the blaster, monsters and effects |
| `src/art/world.ts` | Trees, plants, rocks, chests and each land's crystal |
| `src/art/ground.ts` | Paints each land's seamless floor tile, ground patches, the stone circle and the minimap |
| `src/art/pickups.ts` | Bones and meat, dice of every tier, airdrop crate and parachute, crystal shield, power-ups, skill icons |
| `src/art/guns.ts` | The cartoon guns and bullets |
| `src/art/ui.ts` | Buttons, panels, cards, dice skins, icons |
| `src/ui/widgets.ts` | Reusable UI pieces: text, buttons, pet cards, popups |

All art is drawn with code on a canvas, so there are no image files yet.
To use real artwork later, load images under the same texture keys.
