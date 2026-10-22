# Dice Idle (working title)

An idle auto-battler for Android, in the style of Idle Cat Gunner / Slime RNG:
your cat gunner and the pets you roll from dice fight waves automatically,
earning coins that you spend on more rolls and upgrades.

Built with **Phaser 3 + TypeScript + Vite**. Will be wrapped for Google Play with **Capacitor**.

## Run it

```bash
npm install
npm run dev      # open the URL it prints (works on your phone on the same Wi-Fi with --host)
npm run build    # production build into dist/
```

## Where things live

| File | What it does |
|---|---|
| `src/data/items.ts` | All pets (name, rarity, attack type, damage) |
| `src/data/dice.ts` | Dice types, cost, and drop weights (odds) |
| `src/data/upgrades.ts` | Coin upgrades: power, fire rate, health, luck |
| `src/data/rarity.ts` | Rarity names and colours |
| `src/systems/roll.ts` | The RNG roll, luck and pity system |
| `src/systems/save.ts` | Save game, inventory, equipping, fusing |
| `src/scenes/Battle.ts` | Top half: the auto battle, waves, stages, bosses |
| `src/scenes/UI.ts` | Bottom half: Roll / Pets / Upgrade tabs, offline earnings |
| `src/scenes/Boot.ts` | Placeholder art drawn in code — replace with real sprites |
