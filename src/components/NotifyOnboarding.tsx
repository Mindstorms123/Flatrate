// One-time notification permission ask on app start.
import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { Button } from "@/components/ui/button";
import { notifyStatus, requestNotifyPermission } from "@/lib/notifications";
import { POSITION_CHANGED_EVENT, type Coords } from "@/lib/geo";

const ASKED_KEY = "flatrate.notify-asked.v1";
const LOCATION_ASKED_KEY = "flatrate.location-asked.v1";

function alreadyAsked() {
  try {
    return window.localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return true;
  }
}

function markAsked(key = ASKED_KEY) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // ignore
  }
}

export function NotifyOnboarding() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (Capacitor.isNativePlatform()) {
      let active = true;
      const requestNativePermissions = async () => {
        // Android only shows one runtime permission dialog reliably at a time.
        // Wait for the notification result before requesting location.
        if (!alreadyAsked()) {
          try {
            await requestNotifyPermission();
            markAsked();
          } catch {
            // Continue with location; Android may cancel one permission request during startup.
          }
        }
        if (!active) return;

        try {
          const location = await Geolocation.checkPermissions();
          const unanswered =
            location.location === "prompt" ||
            location.location === "prompt-with-rationale" ||
            location.coarseLocation === "prompt" ||
            location.coarseLocation === "prompt-with-rationale";
          const locationAsked = window.localStorage.getItem(LOCATION_ASKED_KEY) === "1";
          if (unanswered && !locationAsked) {
            // Let Android finish closing the first system dialog before opening the next one.
            await new Promise((resolve) => window.setTimeout(resolve, 300));
            if (!active) return;
            const result = await Geolocation.requestPermissions({ permissions: ["location"] });
            markAsked(LOCATION_ASKED_KEY);
            const granted = result.location === "granted" || result.coarseLocation === "granted";
            if (granted && active) {
              const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, maximumAge: 0, timeout: 10000 });
              const coords: Coords = { lat: position.coords.latitude, lon: position.coords.longitude };
              window.localStorage.setItem("flatrate.last-position.v1", JSON.stringify(coords));
              window.dispatchEvent(new CustomEvent<Coords>(POSITION_CHANGED_EVENT, { detail: coords }));
            }
          }
        } catch {
          // Keep the location flag unset so a temporary Android error can be retried next start.
        }
      };
      void requestNativePermissions();
      return () => {
        active = false;
      };
    }
    if (alreadyAsked()) {
      return undefined;
    }
    // Browsers reject permission prompts without a user gesture -> show a banner.
    if (notifyStatus() === "default") setShowBanner(true);
    return undefined;
  }, []);

  const allow = useCallback(async () => {
    markAsked();
    setShowBanner(false);
    await requestNotifyPermission();
  }, []);

  const later = useCallback(() => {
    markAsked();
    setShowBanner(false);
  }, []);

  if (!showBanner) return null;

  return (
    <div className="border-b border-border bg-secondary/60">
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-2.5">
        <Bell size={18} className="shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-xs text-foreground">
          Benachrichtigungen bei Verspätungen und knappen Umstiegen erlauben?
        </p>
        <Button type="button" size="sm" onClick={() => void allow()}>
          Erlauben
        </Button>
        <Button type="button" size="icon" variant="ghost" aria-label="Später" onClick={later}>
          <X size={16} />
        </Button>
      </div>
    </div>
  );
}
