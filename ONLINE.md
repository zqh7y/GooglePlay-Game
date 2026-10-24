# Online play: setup guide

The game has online features: **leaderboards** (best stage, rarest pet, pets found), **how many players
own each pet**, and **optional Google Play sign-in**. They run on **Firebase** (free plan is enough to
start). Everything is built, tested against a local copy of Firebase, and the Android app builds on GitHub.
What is left needs **your** Google accounts, so only you can do it. Most of it is now one command each.

Until you do this, the game simply plays offline. Nothing breaks.

> **Never commit or share keys.** Nothing in this guide goes into the code. `google-services.json`, your
> upload key (`android/upload-key.jks`) and `android/keystore.properties` are ignored by git, and a check
> runs before every commit that refuses them and anything that looks like a Google API key or private key
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
- The web version (the artifact link) stays offline on purpose: going online there would put Firebase's
  key in a public page. Online play is for the Android app.

## Setup, step by step (about 45 minutes)

You need: a computer with **Node.js** (<https://nodejs.org>, LTS) and **Git**, your **Google account**, and a
**Google Play developer account** (<https://play.google.com/console>, a one-time $25 fee).

### 1. Get the project

```bash
git clone https://github.com/zqh7y/GooglePlay-Game.git
cd GooglePlay-Game
npm install
```

### 2. Firebase: one command

```bash
npx firebase login             # a browser opens: sign in with your Google account
npm run online -- setup        # creates everything on the Firebase side
```

`setup` creates your Firebase project (or reuses one: `--project <id>`), the Firestore database (Europe;
`--location nam5` for the US), uploads the security rules, turns on guest sign-in (and Google, which makes
the web client Play Games needs), registers the Android app `com.diceidle.game` and saves
`android/app/google-services.json`. Run it again any time; it only does what is missing.
`npm run online -- status` shows what is done.

### 3. Your upload key

```bash
npm run android -- keystore    # asks for a password, makes your upload key
```

It needs Java: install **Android Studio** (<https://developer.android.com/studio>, it brings Java and the
Android SDK) or any JDK 17+. **Back up `android/upload-key.jks` and `android/keystore.properties`** (a USB
stick, a password manager). Never send them to anyone.

### 4. Build the app

Either on your computer (Android Studio installed, and the `android` folder opened in it once):

```bash
npm run android -- bundle      # → android/app/build/outputs/bundle/release/app-release.aab
```

or on GitHub, with no Android Studio: `npm run android -- github` prints what to paste into **GitHub →
your repository → Settings → Secrets and variables → Actions** (3 secrets). Then **Actions → Android
build → Run workflow**, and download **dice-idle-release-aab** from the finished run. (Every push also
builds **dice-idle-debug-apk**, a test version you can install on a phone straight away.)

### 5. Google Play Console

1. **Create app**: name *Dice Idle*, game, free. Use the package name `com.diceidle.game`.
2. **Test and release → Testing → Internal testing**: create a release and upload the `.aab`. Accept
   **Play App Signing** when asked. Add yourself as a tester.
3. **Test and release → App integrity → App signing**: copy the **SHA-1** and **SHA-256** of the
   *app signing key* and the *upload key*, and give them to Firebase:
   ```bash
   npm run online -- sha <SHA-1> <SHA-256>     # once for each key
   ```
4. **Grow users → Play Games Services → Setup and management → Configuration**:
   - create the Play Games project with **"Use an existing Google Cloud project"** and pick your Firebase
     project (`npm run online -- status` shows its id);
   - **Credentials → Add credential → Android**: package `com.diceidle.game` (it finds your signing key);
   - **Credentials → Add credential → Game server**: choose **Web client (auto created by Google Service)**;
   - copy the **Project ID** (a long number) and run:
     ```bash
     npm run online -- games-id <that number>
     ```
   - **Testers**: add your Google account.
5. **Firebase console → Authentication → Sign-in method → Play Games → Enable**: paste the client ID and
   client secret of that same web client (Google Cloud console → APIs & Services → Credentials → *Web client
   (auto created by Google Service)*). This secret only ever goes into the Firebase console.

### 6. Build again and play online

```bash
npm run android -- bump        # Google Play wants a new version for every upload
npm run android -- bundle      # or, on GitHub: push your changes (git commit -am "Play Games id" && git push),
                               # update the GOOGLE_SERVICES_JSON secret, and run the workflow again
```

Upload the new `.aab` to internal testing and install the game from the Play Store test link. Leaderboards
(**Ranks** in the lobby), world pet counts and **Settings → GOOGLE PLAY** now work.

## Lock it down (recommended)

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

## If the setup script can't do a step

Do it in the Firebase console (<https://console.firebase.google.com>), then run `npm run online -- setup`
again for the rest:
- **Add project**; **Build → Firestore Database → Create database** (production mode);
- **Build → Authentication → Sign-in method**: enable **Anonymous** and **Google**;
- rules by hand: `npx firebase use --add` then `npx firebase deploy --only firestore`.
