// Local trip notifications: permission handling, settings and alert building.
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  delayMinutes,
  formatTime,
  type Journey,
  type TransferRisk,
  type TripProgress,
} from "@/lib/transit";

const KEY = "flatrate.notify.v1";
export const NOTIFY_CHANGED_EVENT = "flatrate:notify-changed";

export type NotifySettings = {
  /** Master switch for trip notifications. */
  enabled: boolean;
  /** Minimum delay in minutes before we alert. */
  minDelay: number;
  /** Remind before boarding, in minutes. */
  boardingLead: number;
};

export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = {
  enabled: false,
  minDelay: 5,
  boardingLead: 7,
};

export function loadNotifySettings(): NotifySettings {
  if (typeof window === "undefined") return DEFAULT_NOTIFY_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_NOTIFY_SETTINGS;
    return { ...DEFAULT_NOTIFY_SETTINGS, ...(JSON.parse(raw) as Partial<NotifySettings>) };
  } catch {
    return DEFAULT_NOTIFY_SETTINGS;
  }
}

export function saveNotifySettings(settings: NotifySettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event(NOTIFY_CHANGED_EVENT));
}

export type NotifyStatus = "unsupported" | "needs_tab" | "default" | "granted" | "denied";

export function notifyStatus(): NotifyStatus {
  if (Capacitor.isNativePlatform()) return "granted";
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  const permission = Notification.permission;
  if (permission === "granted") return "granted";
  if (permission === "denied") return "denied";
  // Browsers silently reject permission prompts inside a cross-origin preview frame.
  if (window.top !== window.self) return "needs_tab";
  return "default";
}

export async function requestNotifyPermission(): Promise<NotifyStatus> {
  if (Capacitor.isNativePlatform()) {
    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted" ? "granted" : "denied";
  }
  const status = notifyStatus();
  if (status !== "default") return status;
  const permission = await Notification.requestPermission();
  return permission === "granted" ? "granted" : permission === "denied" ? "denied" : "default";
}

export type AlertLevel = "info" | "warn" | "critical";

export type TripAlert = {
  /** Stable key so the same situation is announced only once. */
  key: string;
  title: string;
  body: string;
  level: AlertLevel;
  at: string;
};

function bucket(minutes: number, size = 5) {
  return Math.floor(minutes / size) * size;
}

/** Builds the alerts that currently apply to a live journey. */
export function buildTripAlerts(params: {
  journey: Journey;
  progress: TripProgress;
  risks: TransferRisk[];
  settings: NotifySettings;
  now?: Date;
}): TripAlert[] {
  const { journey, progress, risks, settings } = params;
  const now = params.now ?? new Date();
  const t = now.getTime();
  const at = now.toISOString();
  const alerts: TripAlert[] = [];

  journey.legs.forEach((leg, i) => {
    if (leg.mode === "WALK") return;
    const finished = new Date(leg.to.time).getTime() <= t;
    if (finished) return;

    if (leg.cancelled) {
      alerts.push({
        key: `cancel:${i}`,
        level: "critical",
        title: "Fahrt fällt aus",
        body: `${leg.line ?? "Deine Fahrt"} ab ${leg.from.name} entfällt. Öffne Alternativen.`,
        at,
      });
      return;
    }

    const delay = delayMinutes(leg.from.time, leg.from.scheduledTime);
    if (delay >= settings.minDelay) {
      alerts.push({
        key: `delay:${i}:${bucket(delay)}`,
        level: delay >= 15 ? "warn" : "info",
        title: `${leg.line ?? "Fahrt"} +${delay} min`,
        body: `Ab ${leg.from.name} jetzt ${formatTime(leg.from.time)} statt ${formatTime(leg.from.scheduledTime)}.`,
        at,
      });
    }

    if (leg.from.track && leg.from.scheduledTrack && leg.from.track !== leg.from.scheduledTrack) {
      alerts.push({
        key: `track:${i}:${leg.from.track}`,
        level: "warn",
        title: "Steigwechsel",
        body: `${leg.line ?? "Deine Fahrt"} fährt in ${leg.from.name} von Steig ${leg.from.track} (statt ${leg.from.scheduledTrack}).`,
        at,
      });
    }
  });

  risks.forEach((risk) => {
    alerts.push({
      key: `risk:${risk.legIndex}:${risk.status}`,
      level: risk.status === "missed" ? "critical" : "warn",
      title: risk.status === "missed" ? "Anschluss gefährdet" : "Umstieg wird knapp",
      body: `In ${risk.stop.name} bleiben nur ${Math.max(0, risk.availableMinutes)} min – empfohlen sind ${risk.requiredMinutes} min.`,
      at,
    });
  });

  const minutesToStart = Math.round((new Date(journey.startTime).getTime() - t) / 60_000);
  if (progress.phase === "before_start" && minutesToStart >= 0 && minutesToStart <= 10) {
    const firstLeg = journey.legs[0];
    alerts.push({
      key: `start:${minutesToStart <= 5 ? "5" : "10"}`,
      level: "warn",
      title: `Losgehen – Reise startet in ${minutesToStart} min`,
      body: firstLeg
        ? `${firstLeg.mode === "WALK" ? "Fußweg" : firstLeg.line ?? "Abfahrt"} ab ${firstLeg.from.name}${
            firstLeg.from.track ? `, Steig ${firstLeg.from.track}` : ""
          } um ${formatTime(firstLeg.from.time)}.`
        : `Abfahrt um ${formatTime(journey.startTime)}.`,
      at,
    });
  }

  const nextLeg = progress.nextIndex >= 0 ? journey.legs[progress.nextIndex] : undefined;

  if (
    nextLeg &&
    nextLeg.mode !== "WALK" &&
    progress.minutesToNext >= 0 &&
    progress.minutesToNext <= settings.boardingLead
  ) {
    alerts.push({
      key: `boarding:${progress.nextIndex}`,
      level: "info",
      title: `In ${progress.minutesToNext} min einsteigen`,
      body: `${nextLeg.line ?? "Weiterfahrt"} ab ${nextLeg.from.name}${
        nextLeg.from.track ? `, Steig ${nextLeg.from.track}` : ""
      } um ${formatTime(nextLeg.from.time)}.`,
      at,
    });
  }

  const lastLeg = journey.legs.at(-1);
  const arrivalDelay = lastLeg ? delayMinutes(journey.endTime, lastLeg.to.scheduledTime) : 0;
  if (progress.phase !== "done" && arrivalDelay >= settings.minDelay) {
    alerts.push({
      key: `arrival:${bucket(arrivalDelay)}`,
      level: "info",
      title: `Ankunft ${arrivalDelay} min später`,
      body: `Du kommst jetzt um ${formatTime(journey.endTime)} an.`,
      at,
    });
  }

  return alerts;
}

/** Shows an alert as a system notification when allowed, always as an in-app toast. */
export function showAlert(alert: TripAlert) {
  if (Capacitor.isNativePlatform()) {
    void LocalNotifications.schedule({
      notifications: [
        {
          id: Math.abs(Array.from(alert.key).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7)),
          title: alert.title,
          body: alert.body,
          schedule: { at: new Date(Date.now() + 250) },
        },
      ],
    }).catch(() => undefined);
  } else if (notifyStatus() === "granted") {
    try {
      const notification = new Notification(alert.title, {
        body: alert.body,
        tag: alert.key,
        icon: "/icons/icon-512.png",
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch {
      // Ignore: some browsers require a service worker; the toast still informs.
    }
  }
  const options = { description: alert.body };
  if (alert.level === "critical") toast.error(alert.title, options);
  else if (alert.level === "warn") toast.warning(alert.title, options);
  else toast.info(alert.title, options);
}
