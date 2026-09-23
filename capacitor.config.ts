import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.flatrate.mobility",
  appName: "Flatrate",
  webDir: "dist/client",
  server: { androidScheme: "https" },
  android: { allowMixedContent: false },
};

export default config;
