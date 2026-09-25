// Ongoing "live" journey notification (Android foreground service).
// The whole journey timeline is pre-computed and handed to the service, so the
// notification keeps updating while the app is closed or the screen is off.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { delayMinutes, formatTime, type Journey, type Leg } from "@/lib/transit";

export type LiveStep = {
  /** Epoch milliseconds from which this text applies. */
  at: number;
  title: string;
  body: string;
  /** Very short watch-face / status-chip text, e.g. "ab 8:42". */
  chip: string;
  lines: string[];
};

export type LiveSegment = {
  startAt: number;
  endAt: number;
  kind: "walk" | "ride";
};

type TripLivePlugin = {
  start(options: {
    steps: LiveStep[];
    segments: LiveSegment[];
    startsAt: number;
    endsAt: number;
  }): Promise<void>;
  stop(): Promise<void>;
};

const TripLive = registerPlugin<TripLivePlugin>("TripLive");

function label(leg: Leg) {
  if (leg.mode === "WALK") return "Fußweg";
  return leg.line ?? "Fahrt";
}

function delayNote(time: string, scheduled?: string) {
  const delay = delayMinutes(time, scheduled ?? time);
  return delay > 0 ? ` (+${delay} min)` : "";
}

/** One readable line per leg, marking what is done, running and still ahead. */
function timelineLines(journey: Journey, at: number): string[] {
  return journey.legs.map((leg) => {
    const start = new Date(leg.from.time).getTime();
    const end = new Date(leg.to.time).getTime();
    const marker = end <= at ? "✓" : start <= at ? "▶" : "·";
    const track = leg.from.track ? ` Steig ${leg.from.track}` : "";
    return `${marker} ${formatTime(leg.from.time)} ${label(leg)} ab ${leg.from.name}${track}${delayNote(
      leg.from.time,
      leg.from.scheduledTime,
    )} → ${formatTime(leg.to.time)} ${leg.to.name}`;
  });
}

function stepAt(journey: Journey, at: number): LiveStep {
  const legs = journey.legs;
  const arrival = `Ankunft ${formatTime(journey.endTime)}${delayNote(
    journey.endTime,
    legs.at(-1)?.to.scheduledTime,
  )}`;
  const lines = timelineLines(journey, at);

  if (at >= new Date(journey.endTime).getTime()) {
    return { at, title: "Angekommen", body: `Ziel ${legs.at(-1)?.to.name ?? ""}`, chip: "Ziel", lines };
  }

  const riding = legs.find(
    (leg) => new Date(leg.from.time).getTime() <= at && new Date(leg.to.time).getTime() > at,
  );
  const next = legs.find((leg) => new Date(leg.from.time).getTime() > at);

  if (!riding && next) {
    const track = next.from.track ? ` · Gl. ${next.from.track}` : "";
    const title = `${formatTime(next.from.time)} ${label(next)}${track}`;
    return {
      at,
      title,
      body: `ab ${next.from.name} · ${arrival}`,
      chip: `ab ${formatTime(next.from.time)}`,
      lines,
    };
  }

  if (riding) {
    const rest = next
      ? `Umstieg ${formatTime(next.from.time)} ${next.from.name}${
          next.from.track ? ` (Steig ${next.from.track})` : ""
        }`
      : arrival;
    return {
      at,
      title: `Aus ${formatTime(riding.to.time)} ${riding.to.name}`,
      body: `${label(riding)} · ${rest}`,
      chip: `aus ${formatTime(riding.to.time)}`,
      lines,
    };
  }

  return { at, title: "Reise läuft", body: arrival, chip: "Live", lines };
}

/** Builds every moment at which the notification text has to change. */
export function buildLiveSteps(journey: Journey, from: Date = new Date()): LiveStep[] {
  const moments = new Set<number>([from.getTime()]);
  journey.legs.forEach((leg) => {
    moments.add(new Date(leg.from.time).getTime());
    moments.add(new Date(leg.to.time).getTime());
  });
  moments.add(new Date(journey.endTime).getTime());
  return [...moments]
    .sort((a, b) => a - b)
    .map((at) => stepAt(journey, at));
}

function buildLiveSegments(journey: Journey): LiveSegment[] {
  return journey.legs
    .map((leg) => ({
      startAt: new Date(leg.from.time).getTime(),
      endAt: new Date(leg.to.time).getTime(),
      kind: leg.mode === "WALK" ? ("walk" as const) : ("ride" as const),
    }))
    .filter((segment) => segment.endAt > segment.startAt);
}

export function liveNotificationSupported() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/** Starts or refreshes the ongoing notification for this journey. */
export async function startLiveNotification(journey: Journey) {
  if (!liveNotificationSupported()) return;
  const steps = buildLiveSteps(journey);
  if (steps.length === 0) return;
  try {
    await TripLive.start({
      steps,
      segments: buildLiveSegments(journey),
      startsAt: new Date(journey.startTime).getTime(),
      endsAt: new Date(journey.endTime).getTime(),
    });
  } catch {
    // The live notification is a comfort feature – the trip screen still works.
  }
}

export async function stopLiveNotification() {
  if (!liveNotificationSupported()) return;
  try {
    await TripLive.stop();
  } catch {
    // Nothing to stop.
  }
}
