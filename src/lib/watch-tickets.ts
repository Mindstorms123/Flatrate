import { Capacitor, registerPlugin } from "@capacitor/core";

type WatchTicket = {
  id: string;
  title: string;
  validUntil?: string;
  barcodeBytes?: string;
  barcodeFormat?: string;
  source: "pkpass" | "photo";
};

type WatchTicketsPlugin = {
  sync(options: { tickets: string }): Promise<void>;
};

const WatchTickets = registerPlugin<WatchTicketsPlugin>("WatchTickets");

export async function syncTicketsToWatch(tickets: WatchTicket[]): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
  const transferable = tickets
    .filter((ticket) => ticket.source === "pkpass" && ticket.barcodeBytes)
    .map(({ id, title, validUntil, barcodeBytes, barcodeFormat }) => ({
      id,
      title,
      ...(validUntil ? { validUntil } : {}),
      barcodeBytes,
      barcodeFormat: barcodeFormat ?? "QR",
    }));
  try {
    await WatchTickets.sync({ tickets: JSON.stringify(transferable) });
  } catch {
    // A paired watch is optional; tickets stay available on the phone.
  }
}