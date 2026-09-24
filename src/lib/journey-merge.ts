import type { Journey, Place } from "@/lib/transit";

/** One planned connection together with the stops it actually uses. */
export type JourneyOption = {
  journey: Journey;
  from: Place;
  to: Place;
};

const transitLegs = (journey: Journey) => journey.legs.filter((l) => l.mode !== "WALK");

const departAt = (o: JourneyOption) => new Date(o.journey.startTime).getTime();
const arriveAt = (o: JourneyOption) => new Date(o.journey.endTime).getTime();

/**
 * Two options describe the same physical ride when they use the same lines and
 * reach the destination at the same minute – only the stop where the traveller
 * gets on or off differs (e.g. one stop earlier).
 */
function rideKey(journey: Journey): string {
  const legs = transitLegs(journey);
  const last = legs[legs.length - 1];
  const lines = legs.map((l) => `${l.mode}:${l.line ?? ""}`).join(">");
  return `${lines}@${last?.to.scheduledTime ?? journey.endTime}`;
}

/** Of two options for the same ride, keep the one with less walking and later start. */
function prefer(a: JourneyOption, b: JourneyOption): JourneyOption {
  if (a.journey.walkSeconds !== b.journey.walkSeconds) {
    return a.journey.walkSeconds < b.journey.walkSeconds ? a : b;
  }
  return departAt(a) >= departAt(b) ? a : b;
}

/**
 * Merges the results of all start/destination combinations into one clean list:
 * only duplicates of the same ride are dropped, sorted by departure.
 */
export function mergeJourneyOptions(options: JourneyOption[]): JourneyOption[] {
  const byRide = new Map<string, JourneyOption>();
  for (const option of options) {
    if (transitLegs(option.journey).length === 0) continue; // pure walking is not a connection
    const key = rideKey(option.journey);
    const existing = byRide.get(key);
    byRide.set(key, existing ? prefer(option, existing) : option);
  }

  // No "dominance" pruning: a connection that looks slower on paper (e.g. a train
  // from another stop) may be exactly the one the traveller wants, so every
  // distinct ride stays visible.
  const unique = [...byRide.values()];
  return unique.sort((a, b) => departAt(a) - departAt(b) || arriveAt(a) - arriveAt(b));
}
