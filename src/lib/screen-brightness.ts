import { Capacitor, registerPlugin } from "@capacitor/core";

type ScreenBrightnessPlugin = {
  maximize(): Promise<void>;
  restore(): Promise<void>;
};

const ScreenBrightness = registerPlugin<ScreenBrightnessPlugin>("ScreenBrightness");

export async function maximizeTicketBrightness(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await ScreenBrightness.maximize();
}

export async function restoreTicketBrightness(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await ScreenBrightness.restore();
}