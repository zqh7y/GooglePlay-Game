# Dice Idle (working title)

An idle RNG game for Android. Roll dice for **100 pets** (from 1 in 2 up to 1 in 500Sp),
grow your **luck** through the **upgrade tree**, and fight with your box-shaped survivor and pets:
every stage is a **5 minute survival run** (Survivor.io style) on a big open field where you also have to
protect the land's crystal. Meanwhile your hero's **fishing line** catches money, dice, gems, potions and
legends around the clock. The game ends at **stage 100**.

Built with **Phaser 3 + TypeScript + Vite** (the 3D loading screen and story intro use **three.js**), wrapped for Google Play with **Capacitor** (`android/`).
Online features (leaderboards, world pet counts, optional Google Play sign-in) run on **Firebase**: see
**[ONLINE.md](ONLINE.md)** for the setup (`npm run online -- setup` does the whole Firebase side, `npm run
android -- keystore / bundle` makes your upload key and the Play Store bundle, and GitHub Actions builds the
Android app on every push). No API key is ever in the code or in git: a check refuses any
commit that contains one (`npm run check-secrets`), and `npm run check-bundle` checks a build before you
publish it.

## Run it

```bash
npm install
npm run dev      # open the URL it prints (add --host to try it on your phone on the same Wi-Fi)
npm run build    # production build into dist/
```

Dev pages (with `npm run dev`): `/dev/petsheet.html` shows all 100 pets (`?frame=1` / `2` for the walk
frames), `/dev/chars.html` the hero and monsters, `/dev/world.html` every tree, plant, rock and crystal,
`/dev/gadgets.html` every gadget, pickup, mutation badge and skill icon, `/dev/bosses.html` all 20 bosses,
`/dev/places.html` the boss seals.

Start-up flags: `?nointro` skips the loading screen and story (for automated tests), `?intro` always plays
the story.

Balance check: `npx esbuild dev/sim.ts --bundle --platform=node --outfile=/tmp/sim.js && node /tmp/sim.js`
plays the game run by run (and tries the Boss Rush after each run) with the real numbers, fishing all the
while, and prints how many hours (and failed runs) a steady player needs per stage and when each Forge level
is bought. It is tuned so **stage 100 takes about 100 hours** and the **Titan Forge** (the best, SSS gadgets)
about **110-125 hours**. `dev/fishsim.ts` (same way) shows how fast fishing upgrades max out and what an
hour of fishing brings.

## How the game works

- **Loading screen (fully 3D)**: while the game loads, the camera sweeps around the first floating land at
  golden hour: its glowing crystal with dice circling it, the box ghost hopping about, the other four lands
  floating off into the haze over a sea of clouds, with sparkles, light beams, drifting rocks and a glow
  (bloom) pass. On top: the DICE IDLE logo (letters pop in and float), a striped loading bar and tips, then
  **TAP TO START** (the tap also turns the sound on). Without 3D support it still shows the logo and bar.
- **The story** (once, for new players; again from **Settings → WATCH THE STORY**; SKIP at any time),
  about 40 s with cinema bars, captions and its own music: five lands float above the clouds, each lit by a
  Crystal; the Storm comes with lightning; monsters rain down on the lands and a crowned boss rises from the
  clouds and drinks every Crystal's light; the lands go dark... until a pair of eyes lights up in an old
  cardboard box; the flaps burst open, three lucky dice fall and pop into the first friends; dawn breaks
  over the dark lands ahead and the title comes up: **TAP TO PLAY**. Then the tutorial takes over.

- **Rolling costs one die.** Dice are found in battle (on the map, in chests, on elites and from the boss)
  or bought with gems in the Shop. Dice come in tiers **A, B, C, D, E, S, SSS, uSSS**; which tiers drop
  depends on the stage (a D die is a dream at stage 10 and normal at stage 100; uSSS stays very rare), and a
  rarer die multiplies the roll's luck. Every 10th roll is a Lucky Roll (x2 luck).
- **Luck raises your chances, it never guarantees a pet.** With luck x1B, a pet much rarer than 1 in 1B is
  1B times more likely than with no luck, but every roll is still a mix: each roll draws its own luck,
  anywhere from x1 up to a top luck (evenly on a log scale, averaging your luck), then checks the pets from
  rarest to most common with a chance of `(that roll's luck) / N` ("1 in N"). So with x1B luck about 1 roll
  in 8 is still a common A-class pet, while about 1 in 5 lands a pet at least as rare as 1 in 1B. The ODDS
  button shows your chance per roll of each class.
- **Roll x1, x3 or x10** with the buttons over ROLL. Every die is one roll: a x10 uses 10 dice and counts as
  10 rolls for the lucky ring, the SUPER ROLL and gift meters, quests and stats (so a x10 can hold the lucky
  roll or the SUPER ROLL).
- **Pets** come in one kind only. Extra copies **level a pet up** (+15% damage per level, up to Lv.30).
  Pet damage grows with rarity, so rarer pets are what push you further.
- **Screens** (bottom tab bar): **Shop**, **Pets**, **Battle**, **Roll** and **Upgrades** (the
  honeycomb tree), all described below. Fishing is an **event** inside the Battle lobby (see Fishing). The **Map** (from Battle) shows the 100-stage journey:
  - a road through the five lands, each with its own colours, trees, banner and sparkles, and clouds drifting by
  - every 5th stage shows its boss (a dark shape until you get there), and cleared stages get a gold star
  - lands you haven't reached are hidden in fog
  - a panel up top shows your stage and the next boss, with a HERE button
- **Top bar**: one slim row with settings, money, gems and dice. Tap money or gems to open the Shop, or
  dice to open Roll. During a fight only the money stays.
- **The Roll screen**:
  - It sits in a **night sky over a sea of clouds**: a nebula, twinkling stars, the moon, now and then a
    shooting star, dice of every tier drifting up, and the story's floating lands far away with their
    crystals still glowing. Behind the die a big glow takes the colour of the dice you roll with.
  - The die sits inside a **lucky ring**. Each roll lights one segment; when the ring is full and gold,
    the next roll is a lucky roll.
  - Two meters fill as you roll:
    - **SUPER ROLL**: every 50th roll has x10 luck.
    - **Roll gift**: every 25 rolls a present pops out with dice and gems.
  - **Hot streak**: rolling again within a few seconds adds +2% luck per roll, up to +50%.
  - **When you roll, the screen goes dark and only your rolls show**, as big as they fit (a x10 fills
    the screen in a grid). They spin like reels (rare pulls get a slower, suspenseful reel) while a glow
    behind them **charges up** through each rarity colour with rising notes and shakes, then land.
  - Rare pulls bring rays, flashes, confetti, a **NEW RECORD!** stamp when it is your rarest pet ever,
    and "LEVEL UP READY!" when a copy completes a level.
  - **A good roll stays up for 3 seconds** (a new pet, a new record, or a pet 10x rarer than your die's
    luck): "NEW PET!" / "NEW RECORD!" / "GREAT ROLL!" on top, the cards bob, the best one shines, and a bar
    counts down (tap to skip). Other rolls fly straight into your collection.
  - **AUTO and FAST** are on the dark roll screen too, so you can always stop auto rolling.
  - No upgrade cards here: the screen is all rolling. Luck, rolling speed and money upgrades are in the
    Upgrades tab.
  - **Next to find** shows the three easiest pets you are missing, with your own chance per roll.
- **Pet classes**: every pet has a class from **A** to **uSSS**, like dice and gadgets:

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
  - **EVENT SHOP** (first in the shop): limited-time offers you can only buy with **Golden Tickets**, the
    rarest thing in the game. Tickets come only from events: every fishing catch has a tiny chance to hook
    one (about 1 in 20,000 at first, a bit better with Lucky Bait, x3 on a SUPER catch), and each event
    round's big prize has a 1 in 5 chance of one. The simulator finds about a dozen in a whole game (the
    first around hour 9). Finding one takes over the screen: **GOLDEN TICKET!** spinning in over golden rays.
    - **Legendary special** of the week: a **uSSS Die** (4 tickets) or a **Mythic Egg** (5: a pet one or two
      classes above your best), with a countdown.
    - **Three offers** that change every 8 hours (everyone sees the same ones), one of each per player: Lucky
      Egg (a pet of your best class or one better), 2 SSS Dice, 3 S Dice, Mega Potion (60 min), Boost Crate
      (3 of every Battle Boost), Gem Hoard (150 gems), 50 Lucky Rolls, Golden Vault (3 hours of money) or
      Pearl Treasure (shells for every next fishing upgrade). 1 to 3 tickets each.
  - **Deal of the Day**: a different bundle every day at about half price. It can be bought once and shows a
    countdown to midnight.
  - **Free**: a gift every 10 minutes (gems, dice and money) and the daily reward.
  - **Lucky Wheel**: one free spin every 4 hours, then 8 gems a spin. Prizes are dice, money, gems, a
    potion, or the rare MEGA jackpot.
  - **Treasure Chests**: Wooden (money), Silver and Golden (gems). Each one shakes, pops open and throws out
    dice rolled for your stage plus bonus gems, money and potions.
  - **Battle Boosts**, bought with money and used up by your next fight:
    - Golden Start: an extra C-tier gadget.
    - Second Chance: a free revive.
    - Head Start: 2 skills right away.
    - Crystal Armor: +50% crystal health.

    Boosts you own are shown above the BATTLE button.
  - **Shelves**: dice, potions, money and gems (real-money gems are "coming soon").
- **Monster mutations**: from stage 2 on, some monsters spawn mutated, with a badge over their head.
  Deeper stages have more mutated monsters, and they can stack 2 or 3 mutations.

  | Mutation | First stage | What it does |
  |---|---|---|
  | Swift | 2 | Runs much faster |
  | Extra Life | 4 | Gets back up once |
  | Blink | 7 | Teleports toward you |
  | Armored | 12 | Takes half damage |
  | Regrowing | 18 | Heals over time |
  | Giant | 25 | Huge, with triple health |
  | Splitter | 35 | Splits in two when beaten |
  | Ghost | 45 | Fades out and can't be hit |
  | Vampire | 60 | Heals when it bites you |
  | Exploder | 75 | Blows up when beaten |

  Bosses get mutations from stage 20. The first time you meet a mutation, a warning explains it. The
  lobby lists the mutations of the current stage, and mutated monsters pay more.
- **Lobby**: small round shortcuts (Map, Quests, Daily, Hero, AFK), your **total DPS** (hero plus pets) and
  your luck. Tapping DPS or Hero opens **My Hero**: your character up close, total damage per second
  split between the hero and each pet, health, speed and crits.
- **Free roam**: outside a fight the lobby is a field you can walk around with the joystick (the minimap is
  top right). Six dice are lying around when you get there, and another turns up every 15 s (up to 15 at
  once); walk over them to pick them up.
  **AFK** puts your hero on autopilot: it walks to the nearest die by itself and strolls around when there
  are none.
- **Starting a fight**: BATTLE and BOSS RUSH first ask **"Start?"** with that fight's info (stage, land,
  boss, mutations, best and rewards). START: your hero and pets hop in a burst of sparkles, the screen
  flashes, and the fight begins.
- **Upgrades**:
  - One chip per path at the top shows what it is for and how much you own. Tap a chip to jump there.
  - A legend explains the states: owned, can buy, need money, locked.
  - Every open hexagon shows its price (green when affordable).
  - A bouncing **NEXT** marker and the **Best next upgrade** bar (with BUY) say what to get next.
- **The Battle tab is a lobby**: the fight only starts when you press **BATTLE** (and say yes). During a fight the tab bar
  and shops are gone; you only get **Pause** (resume, sound, music, give up) and **Stats**.
- **A stage**: drag anywhere to move (WASD / arrows on desktop); your hero shoots by itself. The camera is
  zoomed out (1.66x) so you see more of the field. Survive **5:00** against hordes of monsters that come
  faster and tougher every minute (a ring of them closes in at each minute mark). If you fall or the crystal
  breaks, the run is over: revive once for gems, try again, or go back to the lobby.
- **The boss**: at 5:00 every monster runs off, a WARNING flashes, a storm rolls in and a claw carries the
  crystal into the sky. The boss drops down next to you with a title card (its name and its three moves)
  and its own music. It is just you and your pets against it. Beat it and the crystal floats back down.
- **Boss seals**: stage bosses **heal themselves** (2% of their health a second; not in the Boss Rush).
  Five rune seals appear around the field when the boss lands: faint until you get close, on the minimap
  and with purple arrows at the screen edge. **Stand on one for 3 s** (a ring fills up) to close it: a gold
  beam, a bolt hits the boss, and the healing drops by a fifth. Close all five and it can't heal at all. A
  strong team can hit through the healing; a skilled player closes the seals. (Healing bosses start with
  75% of their old health, so closing the seals keeps them as hard as before.)
- **Boss moves**: every boss walks at you and, every few seconds, does one of **its three moves**. Each one
  shows where it will land first:

  | Move | What you see, then what happens |
  |---|---|
  | Charge | red marks on the ground, then a dash along them |
  | Stomp | a red circle around it, then a shockwave |
  | Rock Throw | it rears back, then a fan of 5 rocks |
  | Jump Slam | it leaps; a red circle where you stood, where it lands |
  | Bullet Ring | it glows, then two rings of shots in every direction |
  | Aimed Shots | it glows, then 5 quick shots at you |
  | Call Minions | it shakes, then 3-5 monsters of the land pop up around it |
  | Spin Attack | it spins at you for a moment (don't touch it) |
  | Sky Rain | red circles around you (one right on you), then things fall from the sky |
  | Teleport | it fades, appears next to you and stomps |
  | Burrow | it digs in; a mound of dirt chases you, a red circle, then it bursts out |
  | Breath | a red cone in front of it, then it breathes along the cone |

  | Boss | Moves |
  |---|---|
  | Slime King | Jump Slam, Call Minions, Bullet Ring |
  | Mushroom Titan | Stomp, Bullet Ring, Call Minions |
  | Bat Queen | Charge, Call Minions, Aimed Shots |
  | Stone Golem | Stomp, Rock Throw, Jump Slam |
  | Scarecrow | Call Minions, Spin Attack, Sky Rain |
  | Thunder Crow | Charge, Sky Rain, Aimed Shots |
  | Haystack Brute | Spin Attack, Stomp, Rock Throw |
  | Pumpkin King | Jump Slam, Bullet Ring, Call Minions |
  | Spore Mother | Bullet Ring, Sky Rain, Call Minions |
  | Shadow Wolf | Charge, Teleport, Spin Attack |
  | Moss Troll | Stomp, Rock Throw, Jump Slam |
  | Old Treant | Sky Rain, Call Minions, Stomp |
  | Mummy Pharaoh | Teleport, Bullet Ring, Call Minions |
  | Sand Worm | Burrow, Rock Throw, Bullet Ring |
  | Cactus Colossus | Bullet Ring, Jump Slam, Stomp |
  | Sand Scorpion | Charge, Aimed Shots, Burrow |
  | Penguin Emperor | Charge, Call Minions, Sky Rain |
  | Ice Golem | Stomp, Sky Rain, Breath |
  | Frost Yeti | Jump Slam, Rock Throw, Charge |
  | Frost Dragon | Breath, Sky Rain, Charge |
- **20 bosses**, a new one every 5 stages (four per land):

  | Land | Bosses (stages) |
  |---|---|
  | Sunny Meadow | Slime King (1-5), Mushroom Titan (6-10), Bat Queen (11-15), Stone Golem (16-20) |
  | Golden Fields | Scarecrow (21-25), Thunder Crow (26-30), Haystack Brute (31-35), Pumpkin King (36-40) |
  | Misty Forest | Spore Mother (41-45), Shadow Wolf (46-50), Moss Troll (51-55), Old Treant (56-60) |
  | Sunset Dunes | Mummy Pharaoh (61-65), Sand Worm (66-70), Cactus Colossus (71-75), Sand Scorpion (76-80) |
  | Frost Peak | Penguin Emperor (81-85), Ice Golem (86-90), Frost Yeti (91-95), Frost Dragon (96-100) |
- **Boss Rush** (the purple button next to BATTLE): the fast way through the stages.
  - Boss n guards stage n. The rush starts at the boss of your stage, and you have **15 seconds** to beat it.
  - There is no crystal, no monsters, no skills and no airdrops: just you, your gadget and your pets.
  - Beat a boss in time and **that stage is cleared**: your stage goes up and the next boss drops right in
    (you heal a little).
  - Run out of time (the boss flies away) or fall, and the rush ends on that stage. If you beat 60 bosses
    in time but not boss 61, you are on stage 61, in normal runs and in the next rush.
  - Every boss pays money; every 5th also gives gems and dice. The button shows the boss of your stage.
  - Rush bosses are tuned with the simulator so the rush and normal runs each clear about half the stages:
    a team that got strong catches up fast, without landing on stages it cannot survive.
- **Pets** (a team of up to 3: one at the start, two Pet Slot upgrades) run around the field after monsters
  near you: shooters throw orbs, bombers lob bombs, pouncers leap and bite, star throwers throw spinning
  stars; support pets stay by your side. Monsters that bump into a pet hurt it; at zero health it is knocked
  out for 8 s. Over each pet: its name and odds ("Kitty 1 in 10A") and a health bar. No lasers anywhere.
- **The crystal shield**: the crystal is open for 45 s, then shielded for 45 s, and so on. While it is open,
  raiders march in from far away and **bite the crystal** (they only turn on you if you get right in their
  way); while it is shielded every monster hunts you. **The crystal never heals by itself** (only the Crystal
  Glue skill mends it), so defend it while it is open. Its health grows 5% a stage, as fast as the bites, and
  the first stages send fewer raiders.
- **The hero**: something living in a cardboard box. You only see its glowing eyes through a dark slot,
  plus two little legs. It is drawn as a 3D box: a lit front, a shaded side and an open top with flaps.
- **Gadgets** (the weapons): they all fire on their own, and you carry up to **3** at once. Every stage
  starts with a Shuriken.

  | Gadget | What it does |
  |---|---|
  | Shuriken | Spinning stars that cut through monsters |
  | Ghost Wisps | Little ghost flames circle you, dart at a monster each, and come back |
  | Bubble Wand | Slow bubbles that trap the first monster they touch, then pop and splash everyone near |
  | Glue Splat | Splats a glue puddle on monsters: anything in it is slowed and keeps getting hurt for 4 s |
  | Storm Kite | A kite over your shoulder calls lightning that jumps from monster to monster |
  | Boomerang | Flies out and back, hitting both ways |
  | Popcorn Pop | Pops a ring of hot kernels in every direction |
  | Grenade | Lobbed into crowds; at S tier and up it becomes a Black Hole that pulls monsters in, then bursts |

  **Gadgets come from levelling up.** Every level up freezes the fight and three cards fly in:
  - **NEW!**: a gadget you don't have (while a slot is free there is always one), in a tier rolled for how
    long you have survived.
  - **Lv 2 → 3**: the next level of one you carry (up to 5, +20% damage each).
  - **C → D**: the next tier of a maxed one (more damage, faster, more shots or jumps).

  Tiers: A (Common), B (Rare), C (Super Rare), D (Epic), E (Legendary), S (Mythic), SSS (Titanic). How high
  they go is set by the **Forge** in the upgrade tree: C at first, then D, E, S and finally SSS with the
  **Titan Forge**, the most expensive upgrade in the game (about 120 hours in).

  You can tell what you picked: each card has a living medal (bobbing icon, tier chip, rays for good tiers),
  stars for the level, and the medal flies to its slot. In the fight the top right panel shows a medal per
  gadget (tier top left, level bottom right) with a dark **cooldown sweep**; it pops every time that gadget
  fires. The gadget in your hero's hand swaps to whichever just fired and kicks up, and thrown things are
  bigger and leave **glowing trails** (blue stars, orange kernels, gold boomerangs, purple black holes...).
  The name of what you picked floats over your hero.
- **Crystal dice**: every 30 s you survive, the crystal pops out a die that lands nearby. It is an A die on
  stages 1-20, B on 21-40, C on 41-60, D on 61-80 and E on 81-100.
- **Numbers**: A = thousand, B = million, C = billion and so on (1.5A = 1,500).
- **Skills come from drops**: airdrops (a gold beam and "SKILL DROP!"), skill orbs on the map, and elites
  (half of them drop an orb). Each one freezes the fight with three skill cards. Monsters still drop bones
  and meat (XP), which level you up for gadgets. You carry at most **4 different skills** per stage, each up
  to level 5; they reset every stage and sit as medals along the bottom. Each has a big picture icon and a
  badge colour (red hits harder, yellow faster, blue keeps you alive, green helps, purple is spooky):

  | Skill | What it does |
  |---|---|
  | Double Trouble | Every gadget throws one more (even levels: +15% damage) |
  | Sharp Corners | +30% gadget damage |
  | Hyper Hands | Gadgets fire 15% faster |
  | Big Bang | +25% size for blasts, bubbles and glue |
  | Chain Reaction | Defeated monsters burst and hurt the ones around them (bursts can set off bursts) |
  | Spooky Aura | Monsters close to you get hurt every half second and move slower |
  | Ghost Phase | Every 7 s (sooner with levels) you turn see-through for 1 s, take no damage, and let out a shockwave |
  | Ghost Snacks | Every monster you defeat heals you a little |
  | Thick Cardboard | +25% max health, heal 30% |
  | Box Fort | Stand still: take less damage, gadgets fire faster |
  | Zoomies | +12% move speed |
  | Ghost Vacuum | Grab bones and meat from 50% farther |
  | Pet Party | Pets attack 20% faster and harder |
  | Crystal Glue | The crystal heals 35% right away (it never heals by itself) |
  | Crystal Shards | The crystal shoots shards at monsters around it |
  | Lucky Box | Level-ups offer better gadget tiers, and skill drops come more often |

- **STREAK**: kills in a row (each within 3 s of the last). Every **50** in a row gives **+1% damage and +1%
  attack speed** (gadgets and pets) for as long as the streak lasts; it shows under the gadgets.
- **Stats** (the bar chart button in a fight): your gadgets and skills as medals with their level number,
  then the numbers as icons: time, monsters defeated, damage, DPS, money, airdrops, damage taken, shots,
  and the dice you found.
- **On the map**: dice, hearts, magnets, bombs, freeze, skill orbs (a free skill), treasure chests and skill airdrops.
- **Fishing** is the **FISHING EVENT**, a card on the right of the Battle lobby (a little lake at sunset with
  a fish leaping out, an EVENT ribbon, the bar to the next reward, "CLAIM!" and a "!" when something is
  waiting). Tap it to open the event; the arrow at the top goes back to the lobby. Your hero sits on a dock
  and fishes, **all the time**: on this screen, while you fight or roll, and while you are away (until the
  Cooler Box is full).
  - **Event rewards, for your next fights**: every catch (offline ones too) fills the EVENT bar under the
    pond. Each round has **10 rewards** at 5, 12, 20, 30, 42, 56, 72, 90, 110 and 135 catches: shells, dice
    of your stage's tier, gems, a Battle Boost, a luck potion, more shells, more dice, lucky rolls, two
    Battle Boosts, and a **BIG PRIZE** (a die one tier better plus gems). Tap the bar to claim what is ready
    (they pop up big), or to see the whole round. Then the next round starts, asking 1.5x more catches each
    time (up to round 12) with more shells and gems. With the event, the simulator reaches stage 100 at
    about 98 h and the Titan Forge at about 114 h.
  - **One catch every 60 s** at first, down to **every 5 s**. Every catch also brings **shells**, which buy
    the fishing upgrades.
  - **The prizes**, 4 per row and 5 rows, from junk to legends. **Every prize can bite from the start**:
    the deep rows just have microscopic chances that grow with Lucky Bait and Deeper Water.

    | Row | Prizes |
    |---|---|
    | Common | Old Boot (shells), Sardine (money), Soggy Die (A), Coin Pouch (money) |
    | Good | Puffer Die (B), Pearl Oyster (gem), Luck Potion, Fat Salmon (money) |
    | Rare | Speed Potion, Coral Die (C), Sunken Chest (money), Sea Clover (lucky rolls) |
    | Epic | Message Bottle (a Battle Boost), Swordfish Die (D), Golden Koi (money), Mermaid Crown (gems) |
    | Legend | Sun Die (E), Kraken Die (S), Titan Trident (SSS die), Leviathan Heart (uSSS die + 100 gems) |

    Money prizes are worth what fighting earns you in about 4 s (Sardine) up to 10 minutes (Golden Koi)
    right now.
  - **The board** shows each prize as just its picture floating over its shadow (no boxes), with its
    **chance in %** at the picture's bottom right in a running **rainbow** (faster for rarer rows; epic and
    legend pictures glow). Below 0.01% the number hides: **?** under 0.01%, **??** under 0.001%, **???** under
    0.0001%, and under 0.00001% a scrambling, flickering mystery. Tap a prize for its name, reward, chance and
    how many you caught. Your first catch of each prize brings bonus shells.
  - **The scene is in 3D perspective**: a wooden pier reaches from the front corner out over the water, its
    planks shrinking into the distance, with posts, mooring posts and a coil of rope, and your hero sits at
    its end. Waves roll in from the horizon and spread as they come closer, the hills and sun are mirrored in
    the water, the sun lays a glittering path, a haze sits on the horizon, birds and clouds drift by, lily
    pads and fish shadows are smaller the farther they are, and reeds stand in front. The view sways gently
    (far things move less than near ones). The bobber floats far out and sends out ripples; as a bite nears,
    a fish swims up and nibbles, then a "!" pops over your hero, the bobber goes under with a splash, the rod
    bends, and the prize **leaps out and flies at you**, growing as it comes closer with its shadow sliding
    over the water. Commons bounce and fly to their place on the board; rare, shiny, super and first-ever
    catches get a **full-screen reveal** (rays, name, what you got, tags; legends flash and shake, tap to go
    on). Then the rod swings and the bobber plops back in.
  - **Upgrades** (paid in shells):

    | Upgrade | Max | Effect |
    |---|---|---|
    | Quick Reel | 24 | A catch every 60 s → 5 s |
    | Lucky Bait | 30 | Fishing luck x1 → x30 (lifts the rare rows; commons stay common) |
    | Deeper Water | 12 | Rare, Epic and Legend prizes x1 → x2 more likely |
    | Double Hook | 15 | Up to 30% chance of two prizes at once |
    | Golden Line | 20 | Up to x3 shells |
    | Big Net | 10 | Up to x1.5 dice, gems and potions per prize |
    | Super Bite | 25 | Every 40th → every 15th catch is a SUPER catch with x10 luck (the water glows gold before it) |
    | Shiny Lure | 15 | Up to 19% chance a catch is shiny: x2 the prize |
    | Cooler Box | 22 | Fishes on while you are away for 2 h → 24 h |

  - Coming back after a while shows **GONE FISHING**: how long the line fished and everything it caught.
    Rare catches made while you are on another screen pop up as a note. The event card gets a "!" when a
    reward is ready or an upgrade is affordable, and there are fishing quests.
- **Pets** walk and run with a stepping animation (floating pets bob). Every pet card shows its odds at the top.
- **Music**: little synthesized chiptune loops (calm, battle and boss); Music and Sound toggles in Settings.
- **The upgrade tree** is a honeycomb of 101 hexagons in six colour-coded branches (luck, rolling, money,
  power, team, gems and potions). Bright = bought, glowing = you can buy it, grey = too expensive, dark "?" = locked.
  **Most hexagons come in 3 steps** (three dots on top), so there is nearly always something to buy: the steps
  cost 25%, 33% and 42% of the hexagon's price and each gives a third of its effect (x2 luck: x1.26, x1.59,
  x2). The hexagons after it open once all its steps are bought. Whole things (a pet slot, auto roll, the
  Forge, a new die, lucky-roll timing) stay one purchase. Its popup says "Step 2 of 3" and stays open after
  a step so you can buy the next. Prices are 2.5x what they were, because fishing now pays 10x the money.
- **Goals**: quests, a 7-day daily reward, +25% luck for every 10 pets in the Index, gems from bosses for luck potions.
- **Online** (when set up, see ONLINE.md):
  - **No sign-up or sign-in needed**: the game quietly makes a guest account. **Settings → GOOGLE PLAY**
    optionally signs in with Google Play Games (the guest's entry and counted pets carry over).
  - **Leaderboards** (the trophy "Ranks" button in the lobby): best stage, rarest pet, pets found. The top
    players with medals for the top 3, your own row highlighted, and your rank if you are further down.
    Change your name there or in Settings.
  - **How many players own each pet**: on every pet's popup ("Players who have it"), and a note when you
    roll a new S class pet or rarer ("Only 3 players in the world have Galaxy Fox!", or "You are the
    FIRST...").
  - Offline, or before setup, everything else works the same; the testing tools in Settings only show in
    the offline version.

## Where things live

| File | What it does |
|---|---|
| `src/data/pets.ts` | The 100 pets: name, species, colours, accessories, pattern, eyes |
| `src/data/items.ts` | Turns that table into pets with odds, rarity, attack type, damage and levels |
| `src/data/tree.ts` | Every upgrade hexagon: position, price, effect |
| `src/data/balance.ts` | Stage length, monster health / speed / money per stage and minute, spawn rate, XP (shared with the simulator) |
| `src/data/skills.ts` | The 16 in-run skills (from drops) |
| `src/data/gadgets.ts` | The 8 gadgets, their tiers, levels and stats |
| `src/data/tiers.ts` | Tiers A to uSSS: names, colours, dice odds per stage, airdrop odds, dice luck |
| `src/data/regions.ts` | The five lands: stages, colours, crystal, scenery, monsters |
| `src/data/rarity.ts` | The 10 rarity tiers and their colours |
| `src/data/luck.ts` | How luck turns into pets: the roll and the chance of each pet and class (shared with the simulator) |
| `src/systems/roll.ts` | Rolling pets into your collection |
| `src/systems/stats.ts` | Luck, roll speed, money and damage from the tree and potions |
| `src/systems/save.ts` | Save game, pets and levels, equipping |
| `src/systems/goals.ts` | Quests, daily rewards and Index milestones |
| `src/systems/sound.ts` | Synthesized sound effects, the music sequencer and vibration |
| `src/game/arena.ts` | Lays out each land's field (tree fence, groves, plants, ground patches) |
| `src/scenes/Battle.ts` | A stage (lobby, clock, crystal shield, spawning, mutations, gadgets, airdrops, pets, skills, pickups, boss, win / lose) and the Boss Rush |
| `src/main.ts`, `src/game.ts` | Start-up: the loading screen, the story for new players, then the game |
| `src/intro/world3d.ts` | The 3D world (three.js): floating lands, crystals, the box ghost, dice, slimes and the boss, sky moods, storm, sparkles, bloom |
| `src/intro/loading.ts`, `src/intro/story.ts` | The loading screen's camera and life; the story's shots, captions, lightning, monsters, dice and pets on one clock |
| `src/intro/overlay.ts`, `src/intro/intro.ts` | The logo, loading bar, tips, cinema bars, captions and SKIP (HTML); what runs when |
| `src/scenes/UI.ts` | Tab bar, top bar, lobby, battle HUD (minimap, joystick, gadget medals), pause, stats, gadget and skill pickers, defeat screen, rolling, fishing ticks, popups |
| `src/ui/rollScreen.ts` | The Roll screen: lucky ring, SUPER ROLL and gift meters, hot streak, x1/x3/x10, the full-screen reveal and its 3 s showcase, next-to-find |
| `src/ui/classText.ts` | Pet class badges and the animated class colours |
| `src/ui/petsScreen.ts` | The Pets screen: team stage and power, collection, sorted grid, Index, pet popup with levelling |
| `src/ui/shopScreen.ts` | The Shop: deal of the day, free gifts, lucky wheel, chests and their opening show, boosts, shelves |
| `src/data/boosts.ts` | The four Battle Boosts |
| `src/data/mutations.ts` | Monster mutations and how often they appear per stage |
| `src/systems/power.ts` | Damage per second of the hero and team (lobby and My Hero) |
| `src/ui/mapScreen.ts` | The 100-stage journey map: lands, road, boss portraits, fog, clouds |
| `src/data/bosses.ts` | The 20 bosses, their three moves, which stages they guard, and the Boss Rush numbers |
| `src/art/bosses.ts` | The 15 newer boss pictures (the other 5 are with the monsters) |
| `src/ui/treeScreen.ts` | The honeycomb upgrade tree screen |
| `src/art/pets.ts` | Draws every pet (20 species + accessories + patterns) |
| `src/art/characters.ts` | The Box Ghost hero, monsters and effects |
| `src/art/world.ts` | Trees, plants, rocks, chests and each land's crystal |
| `src/art/ground.ts` | Paints each land's seamless floor tile, ground patches, the stone circle and the minimap |
| `src/art/pickups.ts` | Bones and meat, dice of every tier, airdrop crate and parachute, crystal shield, power-ups |
| `src/art/skills.ts` | The skill icons, the medal every skill and gadget sits on, the card shine |
| `src/ui/badge.ts` | The living medal (icon, tier chip, level, glow, bob) used on cards, the HUD and Stats |
| `src/data/fishing.ts` | Fishing prizes, rows, chances and how they show, upgrades, the event's goals and rewards (shared with the simulators) |
| `src/systems/fishing.ts` | The fishing line: catches, payouts, offline catches, buying upgrades, claiming event rewards |
| `src/ui/fishScreen.ts` | The Fishing Event screen: prize grid with living chances, the animated pond, catch reveals, the event bar, its rewards and claims, upgrades |
| `src/art/fishing.ts` | Prize pictures, upgrade icons, shells, dock, bobber, fish shadows, hills, lily pads, reeds, bucket, the event card, ribbon and leaping fish |
| `src/art/places.ts` | The boss seals |
| `src/art/gadgets.ts` | The gadgets (icons and the things they throw), the glue puddle, popcorn kernel and black hole |
| `src/art/mutations.ts` | The mutation badges over monsters |
| `src/art/ui.ts` | Buttons, panels, cards, dice skins, icons |
| `src/ui/widgets.ts` | Reusable UI pieces: text, buttons, pet cards, popups |
| `src/online/online.ts` | Online play: guest / Google Play account, syncing your entry, leaderboards, pet owner counts |
| `dev/online.mjs` | `npm run online -- setup / sha / games-id / status`: sets up your Firebase project from your computer |
| `dev/android.mjs` | `npm run android -- keystore / sha / bundle / bump / github`: upload key, fingerprints, the Play Store bundle |
| `.github/workflows/android.yml` | GitHub builds the Android app: a test APK on every push, the signed bundle once your secrets are added |
| `src/online/backend.ts` | The Firebase calls (loaded only when online is set up) |
| `src/online/config.ts` | Where the Firebase config comes from (never from the code: `.env.local` or Android's google-services.json) |
| `src/ui/leaderboard.ts` | The leaderboard popup and the name box |
| `firestore.rules` | Who may read and write what online (tested by `dev/online/rules.test.mjs`) |
| `capacitor.config.ts`, `android/` | The Android app (package name, Play Games sign-in) |

All art is drawn with code on a canvas, so there are no image files yet.
To use real artwork later, load images under the same texture keys.
