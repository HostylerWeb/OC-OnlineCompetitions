import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "win.onlinecompetitions.mobile",
  appName: "Online Competitions",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
    iosScheme: "https",
  },
  ios: {
    contentInset: "always",
    preferredContentMode: "mobile",
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: "#0f0f12",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      android: {
        splashImage: "splash",
      },
      ios: {
        splashImage: "splash",
      },
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0f0f12",
      overlaysWebView: false,
    },
  },
};

export default config;
