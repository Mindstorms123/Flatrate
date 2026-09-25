// Shared, browser-safe transit types & helpers.

export type TransitMode =
  | "WALK"
  | "BUS"
  | "COACH"
  | "TRAM"
  | "SUBWAY"
  | "METRO"
  | "FERRY"
  | "RAIL"
  | "REGIONAL_RAIL"
  | "REGIONAL_FAST_RAIL"
  | "SUBURBAN"
  | "HIGHSPEED_RAIL"
  | "LONG_DISTANCE"
  | "NIGHT_RAIL"
  | "AIRPLANE"
  | "OTHER";

/** Modes that are covered by the Deutschlandticket. */
export const DTICKET_MODES = [
  "BUS",
  "TRAM",
  "SUBWAY",
  "METRO",
  "FERRY",
  "RAIL",
  "REGIONAL_RAIL",
  "REGIONAL_FAST_RAIL",
  "SUBURBAN",
  "OTHER",
] as const;

/** Modes that normally need an extra ticket (except released ICE short runs). */
export const LONG_DISTANCE_MODES = [
  "HIGHSPEED_RAIL",
  "LONG_DISTANCE",
  "NIGHT_RAIL",
  "COACH",
  "AIRPLANE",
] as const;

export function isDticketMode(mode: string): boolean {
  return (DTICKET_MODES as readonly string[]).includes(mode);
}

export const MODE_LABEL: Record<string, string> = {
  WALK: "Fußweg",
  BUS: "Bus",
  COACH: "Fernbus",
  TRAM: "Tram",
  SUBWAY: "U-Bahn",
  METRO: "Stadtbahn",
  FERRY: "Fähre",
  RAIL: "Zug",
  REGIONAL_RAIL: "Regionalzug",
  REGIONAL_FAST_RAIL: "RE",
  SUBURBAN: "S-Bahn",
  HIGHSPEED_RAIL: "ICE / Fernzug",
  LONG_DISTANCE: "IC / EC",
  NIGHT_RAIL: "Nachtzug",
  AIRPLANE: "Flug",
  OTHER: "ÖPNV",
};

export type Place = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  area: string;
  isStop: boolean;
  /** Luftlinie in km zur zuletzt bekannten Position, falls verfügbar. */
  distanceKm?: number;
};

export type LegEnd = {
  name: string;
  stopId?: string;
  lat: number;
  lon: number;
  track?: string;
  scheduledTrack?: string;
  time: string;
  scheduledTime: string;
};

export type Leg = {
  mode: string;
  line?: string;
  headsign?: string;
  agency?: string;
  color?: string;
  duration: number;
  distance?: number;
  realTime: boolean;
  cancelled: boolean;
  dticket: boolean;
  from: LegEnd;
  to: LegEnd;
  stops: number;
  /** Intermediate stops with times (may be missing for older saved trips). */
  intermediate?: {
    name: string;
    time: string;
    scheduledTime: string;
    track?: string;
    lat?: number;
    lon?: number;
  }[];
};

export type Journey = {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  transfers: number;
  legs: Leg[];
  dticketOnly: boolean;
  walkSeconds: number;
};

export type PlanResult = {
  journeys: Journey[];
  nextCursor?: string;
  fromName: string;
  toName: string;
};

export type TransferRisk = {
  legIndex: number;
  stop: LegEnd;
  nextDeparture: LegEnd;
  availableMinutes: number;
  requiredMinutes: number;
  status: "tight" | "missed";
};

/** Evaluates transfers using live times, walking time and a two-minute safety margin. */
export function getTransferRisks(journey: Journey): TransferRisk[] {
  const risks: TransferRisk[] = [];
  const transitIndices = journey.legs
    .map((leg, index) => ({ leg, index }))
    .filter(({ leg }) => leg.mode !== "WALK");

  for (let i = 0; i < transitIndices.length - 1; i += 1) {
    const current = transitIndices[i];
    const next = transitIndices[i + 1];
    if (!current || !next) continue;
    const walkingSeconds = journey.legs
      .slice(current.index + 1, next.index)
      .filter((leg) => leg.mode === "WALK")
      .reduce((total, leg) => total + leg.duration, 0);
    const availableMinutes = Math.floor(
      (new Date(next.leg.from.time).getTime() - new Date(current.leg.to.time).getTime()) / 60000,
    );
    const requiredMinutes = Math.ceil(walkingSeconds / 60) + 2;
    if (availableMinutes <= requiredMinutes + 3) {
      risks.push({
        legIndex: current.index,
        stop: current.leg.to,
        nextDeparture: next.leg.from,
        availableMinutes,
        requiredMinutes,
        status: availableMinutes < requiredMinutes ? "missed" : "tight",
      });
    }
  }
  return risks;
}

/** Where the traveller currently is within a saved journey. */
export type TripProgress = {
  phase: "before_start" | "riding" | "transfer" | "done";
  /** Index of the leg currently being ridden, or -1. */
  ridingIndex: number;
  /** Index of the next leg to board, or -1 when finished. */
  nextIndex: number;
  /** Index of the last leg that is already finished, or -1. */
  completedIndex: number;
  minutesToNext: number;
  minutesToArrival: number;
};

export function getTripProgress(journey: Journey, now: Date = new Date()): TripProgress {
  const t = now.getTime();
  const arrival = new Date(journey.endTime).getTime();
  const minutesToArrival = Math.round((arrival - t) / 60000);

  const at = (iso: string) => new Date(iso).getTime();

  let completedIndex = -1;
  let ridingIndex = -1;
  for (let i = 0; i < journey.legs.length; i += 1) {
    const leg = journey.legs[i];
    if (!leg) continue;
    if (at(leg.to.time) <= t) {
      completedIndex = i;
      continue;
    }
    if (at(leg.from.time) <= t && ridingIndex < 0) ridingIndex = i;
  }

  // Next leg = first leg that has not finished yet and is not the current ride.
  const nextIndex = journey.legs.findIndex(
    (leg, i) => i > completedIndex && i !== ridingIndex && at(leg.to.time) > t,
  );
  const nextLeg = nextIndex >= 0 ? journey.legs[nextIndex] : undefined;
  const minutesToNext = nextLeg ? Math.round((at(nextLeg.from.time) - t) / 60000) : 0;

  const startsLater = t < at(journey.startTime);
  const phase: TripProgress["phase"] =
    t >= arrival ? "done" : startsLater ? "before_start" : ridingIndex >= 0 ? "riding" : "transfer";

  return { phase, ridingIndex, nextIndex, completedIndex, minutesToNext, minutesToArrival };
}


/** Progress inside the ride the traveller is currently sitting in. */
export type RideProgress = {
  totalStops: number;
  passedStops: number;
  remainingStops: number;
  minutesToExit: number;
};

export function getRideProgress(leg: Leg, now: Date = new Date()): RideProgress {
  const start = new Date(leg.from.time).getTime();
  const end = new Date(leg.to.time).getTime();
  const clamped = Math.min(Math.max(now.getTime(), start), end);
  const fraction = end > start ? (clamped - start) / (end - start) : 1;
  const totalStops = Math.max(leg.stops, 1);
  const passedStops = Math.min(totalStops, Math.floor(totalStops * fraction));
  return {
    totalStops,
    passedStops,
    remainingStops: Math.max(0, totalStops - passedStops),
    minutesToExit: Math.max(0, Math.round((end - now.getTime()) / 60000)),
  };
}

/** Remaining transit rides (excluding walks) after the given leg index. */
export function remainingRides(journey: Journey, afterIndex: number): number {
  return journey.legs.filter((leg, i) => i > afterIndex && leg.mode !== "WALK").length;
}

/** Finds the refreshed version of a journey inside a new plan result. */
export function matchJourney(candidates: Journey[], reference: Journey): Journey | undefined {
  const refLegs = reference.legs.filter((l) => l.mode !== "WALK");
  const refFirst = refLegs[0];
  const exact = candidates.find((c) => c.id === reference.id);
  if (exact) return exact;
  if (!refFirst) return undefined;
  return candidates.find((c) => {
    const legs = c.legs.filter((l) => l.mode !== "WALK");
    const first = legs[0];
    if (!first) return false;
    return (
      first.line === refFirst.line &&
      legs.length === refLegs.length &&
      first.from.scheduledTime === refFirst.from.scheduledTime
    );
  });
}

export type Departure = {

  line: string;
  mode: string;
  headsign: string;
  time: string;
  scheduledTime: string;
  track?: string;
  realTime: boolean;
  cancelled: boolean;
  dticket: boolean;
  stopName: string;
  stopId: string;
  lat: number;
  lon: number;
};

export function delayMinutes(time: string, scheduled: string): number {
  return Math.round((new Date(time).getTime() - new Date(scheduled).getTime()) / 60000);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export function formatDayTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export function walkingDirectionsUrl(end: { lat: number; lon: number; name: string }): string {
  return `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${end.lat},${end.lon}`;
}

/** Local datetime string (Europe/Berlin approximation via input value) for <input type="datetime-local">. */
export function toInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/* --------------------- realtime updates per single ride --------------------- */

export type LegUpdate = {
  /** index of the leg inside the journey */
  index: number;
  departure: string;
  arrival?: string;
  track?: string;
  realTime: boolean;
  cancelled: boolean;
};

function shift(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

/**
 * Merges per-ride realtime data (from the stop's departure board) into a
 * journey. Some operators only publish realtime on the departure board, not in
 * the planner response, so this keeps later legs current as well.
 */
export function applyLegUpdates(journey: Journey, updates: LegUpdate[]): Journey {
  if (updates.length === 0) return normalizeJourney(journey);
  const byIndex = new Map(updates.map((u) => [u.index, u]));
  const legs = journey.legs.map((leg, i) => {
    const u = byIndex.get(i);
    if (!u) return leg;
    const delay = new Date(u.departure).getTime() - new Date(leg.from.scheduledTime).getTime();
    const arrival =
      u.arrival ?? (delay > 0 ? shift(leg.to.scheduledTime, delay) : leg.to.time);
    return propagateStopDelays({
      ...leg,
      realTime: u.realTime || leg.realTime,
      cancelled: u.cancelled || leg.cancelled,
      from: {
        ...leg.from,
        time: u.departure,
        ...(u.track ? { track: u.track } : {}),
      },
      to: { ...leg.to, time: arrival },
    });
  });
  return normalizeJourney({ ...journey, legs });
}

/** Carries a ride's delay into its intermediate stops (interpolated from departure to arrival delay). */
export function propagateStopDelays(leg: Leg): Leg {
  const stops = leg.intermediate;
  if (!stops || stops.length === 0 || leg.mode === "WALK") return leg;
  const dep = new Date(leg.from.time).getTime() - new Date(leg.from.scheduledTime).getTime();
  const arr = new Date(leg.to.time).getTime() - new Date(leg.to.scheduledTime).getTime();
  if (dep <= 0 && arr <= 0) return leg;
  const n = stops.length + 1;
  return {
    ...leg,
    intermediate: stops.map((s, i) => {
      const own = new Date(s.time).getTime() - new Date(s.scheduledTime).getTime();
      const expected = Math.round(dep + ((arr - dep) * (i + 1)) / n);
      return expected > own ? { ...s, time: shift(s.scheduledTime, expected) } : s;
    }),
  };
}

/**
 * Keeps the timeline consistent after delays: a walk never starts before the
 * previous ride arrives, and intermediate stops follow the ride's delay.
 */
export function normalizeJourney(journey: Journey): Journey {
  const legs: Leg[] = [];
  journey.legs.forEach((raw) => {
    let leg = propagateStopDelays(raw);
    const prev = legs.at(-1);
    if (prev && leg.mode === "WALK") {
      const prevEnd = new Date(prev.to.time).getTime();
      const start = new Date(leg.from.time).getTime();
      if (prevEnd > start) {
        const ms = prevEnd - start;
        leg = {
          ...leg,
          from: { ...leg.from, time: shift(leg.from.time, ms) },
          to: { ...leg.to, time: shift(leg.to.time, ms) },
        };
      }
    }
    legs.push(leg);
  });
  const last = legs.at(-1);
  return {
    ...journey,
    legs,
    startTime: legs[0]?.from.time ?? journey.startTime,
    endTime: last?.to.time ?? journey.endTime,
  };
}
