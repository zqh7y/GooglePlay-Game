import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The Android app (Google Play). `appId` must be the package name you register in the Play
 * Console and in Firebase; change it once, before the first upload (see ONLINE.md).
 */
const config: CapacitorConfig = {
  appId: "com.diceidle.game",
  appName: "Dice Idle",
  webDir: "dist",
  android: { backgroundColor: "#4a2f1d" },
  plugins: {
    // keep the game between the phone's status bar (time, battery) and its navigation bar: the page
    // doesn't ask for viewport-fit=cover, so the webview is padded to the safe area (light icons on brown)
    SystemBars: { insetsHandling: "native", initialViewportFitValueHint: "contain", style: "DARK" },
    FirebaseAuthentication: {
      // sign in natively; Google Play Games is the only provider (guests use anonymous accounts)
      skipNativeAuth: false,
      providers: ["playgames.google.com"],
    },
  },
};

export default config;
