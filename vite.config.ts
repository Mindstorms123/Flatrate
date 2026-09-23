// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const mobile = process.env["CAPACITOR_BUILD"] === "1";
// Static GitHub Pages build: PAGES_BASE="/<repo>/" (must start and end with "/").
const pagesBase = process.env["PAGES_BASE"];
const staticBuild = mobile || Boolean(pagesBase);

export default defineConfig({
  ...(staticBuild ? { nitro: false } : {}),
  ...(pagesBase ? { vite: { base: pagesBase } } : {}),
  tanstackStart: {
    ...(staticBuild
      ? { spa: { enabled: true, maskPath: "/", prerender: { outputPath: "/index.html" } } }
      : {}),
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
