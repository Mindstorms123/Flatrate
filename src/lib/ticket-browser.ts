import { Capacitor, registerPlugin } from "@capacitor/core";

export type CapturedPass = { base64: string; name: string };

type TicketBrowserPlugin = {
  open(options: { url: string }): Promise<CapturedPass>;
};

const TicketBrowser = registerPlugin<TicketBrowserPlugin>("TicketBrowser");

export async function openTicketProvider(url: string): Promise<CapturedPass | null> {
  if (!Capacitor.isNativePlatform()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return null;
  }
  return TicketBrowser.open({ url });
}
