import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { z } from "zod";

const MAX_BYTES = 4 * 1024 * 1024;

function validatePass(bytes: Uint8Array): void {
  if (bytes.length === 0) throw new Error("Die Datei war leer.");
  if (bytes.length > MAX_BYTES) throw new Error("Die Datei ist zu groß.");
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new Error("Hinter dem Link steckt keine Wallet-Datei (evtl. eine Login-Seite).");
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
}

function responseBytes(data: unknown): Uint8Array {
  if (typeof data === "string") {
    const bin = atob(data);
    return Uint8Array.from(bin, (char) => char.charCodeAt(0));
  }
  if (Array.isArray(data)) return Uint8Array.from(data as number[]);
  throw new Error("Die Wallet-Datei konnte nicht gelesen werden.");
}

/** Downloads a Wallet pass directly on the device, without a Flatrate website. */
export async function downloadPass({ data: input }: { data: { url: string } }) {
  const data = z.object({ url: z.string().url() }).parse(input);
  const url = new URL(data.url);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Dieser Link kann nicht geladen werden.");
  }

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url: url.toString(),
      responseType: "arraybuffer",
      headers: { Accept: "application/vnd.apple.pkpass,application/octet-stream,*/*" },
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Der Anbieter antwortete mit Status ${res.status}.`);
    }
    const bytes = responseBytes(res.data);
    validatePass(bytes);
    return { base64: bytesToBase64(bytes), contentType: res.headers?.["content-type"] ?? "" };
  }

  const res = await fetch(url.toString(), {
    redirect: "follow",
    headers: { accept: "application/vnd.apple.pkpass,application/octet-stream,*/*" },
  });
  if (!res.ok) throw new Error(`Der Anbieter antwortete mit Status ${res.status}.`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  validatePass(bytes);
  return { base64: bytesToBase64(bytes), contentType: res.headers.get("content-type") ?? "" };
}
