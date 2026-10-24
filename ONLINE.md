# Online play: setup guide

The game has online features: **leaderboards** (best stage, rarest pet, pets found), **how many players
own each pet**, and **optional Google Play sign-in**. They run on **Firebase** (free plan is enough to
start). Everything is already built and tested against a local copy of Firebase; this guide is what only
you can do: create *your* Firebase project and connect it to *your* Google Play app.

Until you do this, the game simply plays offline. Nothing breaks.

> **Never commit or share keys.** Nothing in this guide goes into the code. The two files you download
> (`google-services.json`) and anything you put in `.env.local` are ignored by git, and a check runs
> before every commit that refuses anything that looks like a Google API key or private key
> (`npm run check-secrets`). Before publishing a web build anywhere, run `npm run check-bundle`.

## How it works (short)

- **No sign-up, no sign-in screen.** On first start the game quietly creates a guest account. The player
  can later tap **Settings → GOOGLE PLAY** to sign in with Google Play Games (optional); their guest
  account is linked, so their leaderboard entry and counted pets carry over.
- Data in Firestore:
  - `players/{id}`: name, best stage, rarest pet, pets found, rolls, Boss Rush best, and the list of pets
    that player has counted.
  - `stats/pets`: one small document with the number of players owning each pet (one read loads all 100).
- `firestore.rules` (already written and tested) only lets a player write their own entry, and add **+1**
  to a pet's count **once ever**, in the same write that adds the pet to their own list. Nobody can lower
  counts, count twice, delete, or touch another player's entry.

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> → **Add project** (Google Analytics optional).
2. **Build → Firestore Database → Create database** → *Production mode* → pick a region near your players.
3. **Build → Authentication → Get started → Sign-in method**, enable:
   - **Anonymous** (the silent guest accounts),
   - **Play Games** (you fill in its client ID/secret in step 3.4).

## 2. Upload the security rules

On your computer, in the project folder:

```bash
npm install
npx firebase login
npx firebase use --add          # choose your project, give it the alias "default"
npx firebase deploy --only firestore:rules
```

(`firebase use --add` writes `.firebaserc` with your project's id. That is not a secret, but you can keep
it out of git if you like.)

## 3. Google Play Games + the Android app

1. **Package name**: open `capacitor.config.ts` and set `appId` to your package name (now
   `com.diceidle.game`). Use the same name everywhere below. Then run `npx cap sync android`.
   It must be the same as in `android/app/build.gradle` (`applicationId`) and `strings.xml`
   (`package_name`, `custom_url_scheme`).
2. **Play Console** (<https://play.google.com/console>): create the app with that package name.
   Then **Grow users → Play Games Services → Setup and management → Configuration**:
   - create a Play Games Services project,
   - **Credentials → Add credential → Android**: your package name and the **SHA-1** of your signing key
     (both the *upload* key and the *app signing* key from **Test and release → App integrity**),
   - **Credentials → Add credential → Game server**: this creates an OAuth **web client**. Note its
     client ID; the client *secret* goes **only** into the Firebase console (next steps), never into the game.
   - Copy the **Project ID** (a long number) into `android/app/src/main/res/values/strings.xml`:
     `<string name="game_services_project_id" ...>YOUR_NUMBER</string>`.
3. **Firebase console → Project settings → Your apps → Add app → Android**: same package name, and add
   the same **SHA-1** and **SHA-256** fingerprints. Download **`google-services.json`** and put it at
   `android/app/google-services.json` (git ignores it; do not send it to anyone).
4. **Firebase → Authentication → Sign-in method → Play Games**: paste the *Game server* web client ID and
   secret from step 2, save.
5. Play Console → Play Games Services → **Testers**: add your Google account while testing.

## 4. Build the app

```bash
npm run build
npx cap sync android
npx cap open android      # Android Studio: Build → Generate Signed App Bundle
```

The game's JavaScript does **not** need any key for Android: the native Firebase SDK reads
`google-services.json`. (Any Android app that uses Firebase carries its project identifiers inside the
APK; that is normal and safe as long as the protections below are on.)

## 5. Lock it down (recommended)

- **Restrict the API key**: Google Cloud console → APIs & Services → Credentials → the "Android key"
  created by Firebase → *Application restrictions: Android apps* → add your package name + SHA-1;
  *API restrictions*: only the Firebase / Identity Toolkit / Cloud Firestore APIs.
- **App Check** (Firebase → App Check → Play Integrity): only your real app can reach your database.
- **Budget alert**: Google Cloud → Billing → Budgets, in case the game gets popular.

What it costs: the free plan allows 50,000 reads and 20,000 writes a day. A player writes their entry at
most every 30 s while playing (usually every 2 min), one write per new pet, and reads 1 document for all
pet counts plus ~20 per leaderboard view.

## Trying it in a browser (optional)

Only for testing on your computer: copy `.env.example` to `.env.local` and paste your web app config
(Firebase → Project settings → Your apps → Web app) on one line as `VITE_FIREBASE_CONFIG={...}`.
`npm run dev` then plays online as a guest. Never publish a build made with `.env.local`
(`npm run check-bundle` refuses it).

## Testing without any project (what was used to build this)

```bash
npm run test:rules        # the security rules tests, on a local fake Firestore
npm run emulators         # local fake Firebase; then open the game with ?online=emulator
```

The emulators use a made-up `demo-` project that exists only on your computer.
