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

/** b is at least as good in every aspect and strictly better in one. */
function dominates(b: JourneyOption, a: JourneyOption): boolean {
  const notWorse =
    departAt(b) >= departAt(a) &&
    arriveAt(b) <= arriveAt(a) &&
    b.journey.transfers <= a.journey.transfers &&
    b.journey.walkSeconds <= a.journey.walkSeconds + 120;
  const better =
    departAt(b) > departAt(a) ||
    arriveAt(b) < arriveAt(a) ||
    b.journey.transfers < a.journey.transfers;
  return notWorse && better;
}

/**
 * Merges the results of all start/destination combinations into one clean list:
 * duplicates of the same ride and clearly worse options are dropped, the rest is
 * sorted by arrival time.
 */
export function mergeJourneyOptions(options: JourneyOption[]): JourneyOption[] {
  const byRide = new Map<string, JourneyOption>();
  for (const option of options) {
    if (transitLegs(option.journey).length === 0) continue; // pure walking is not a connection
    const key = rideKey(option.journey);
    const existing = byRide.get(key);
    byRide.set(key, existing ? prefer(option, existing) : option);
  }

  const unique = [...byRide.values()];
  const pruned = unique.filter((a) => !unique.some((b) => b !== a && dominates(b, a)));
  return pruned.sort((a, b) => arriveAt(a) - arriveAt(b) || departAt(b) - departAt(a));
}
