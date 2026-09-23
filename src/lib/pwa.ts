/** Service worker registration plus pick-up of wallet files shared into the app. */
import { Capacitor } from "@capacitor/core";

const SHARED_CACHE = "flatrate-shared-pass";
const SHARED_KEY = "/__shared-pass";

export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (Capacitor.isNativePlatform()) return;
  if (!("serviceWorker" in navigator)) return;
  void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
}

export type IncomingPass = { bytes: Uint8Array; name: string };

/** Reads a .pkpass that the OS share sheet handed to the service worker. */
export async function takeSharedPass(): Promise<IncomingPass | null> {
  if (typeof window === "undefined" || !("caches" in window)) return null;
  try {
    const cache = await caches.open(SHARED_CACHE);
    const res = await cache.match(SHARED_KEY);
    if (!res) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const name = decodeURIComponent(res.headers.get("x-file-name") ?? "ticket.pkpass");
    await cache.delete(SHARED_KEY);
    if (bytes.length === 0) return null;
    return { bytes, name };
  } catch {
    return null;
  }
}

type LaunchParams = { files?: FileSystemFileHandle[] };
type LaunchQueue = { setConsumer: (cb: (params: LaunchParams) => void) => void };

/** Receives .pkpass files opened with the installed app (file handlers). */
export function onLaunchFiles(handler: (pass: IncomingPass) => void): void {
  if (typeof window === "undefined") return;
  const queue = (window as unknown as { launchQueue?: LaunchQueue }).launchQueue;
  if (!queue) return;
  queue.setConsumer((params) => {
    void (async () => {
      for (const entry of params.files ?? []) {
        try {
          const file = await entry.getFile();
          handler({ bytes: new Uint8Array(await file.arrayBuffer()), name: file.name });
        } catch {
          /* ignore unreadable handles */
        }
      }
    })();
  });
}

export function useIsOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine === false;
}
