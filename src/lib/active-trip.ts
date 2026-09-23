import type { Journey } from "./transit";

export type ActiveTrip = {
  id: string;
  savedAt: string;
  journey: Journey;
  /** Place value ("id" or "lat,lon") of the final destination, for re-planning. */
  destination: { value: string; name: string };
  origin: { value: string; name: string };
  allowLongDistance: boolean;
  /** Keep a manually selected rescue connection instead of replacing it during full-trip refresh. */
  preserveSelectedJourney?: boolean;
};

const KEY = "flatrate.active-trip.v1";
export const TRIP_CHANGED_EVENT = "flatrate:trip-changed";

export function loadActiveTrip(): ActiveTrip | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActiveTrip) : null;
  } catch {
    return null;
  }
}

export function saveActiveTrip(trip: ActiveTrip) {
  window.localStorage.setItem(KEY, JSON.stringify(trip));
  window.dispatchEvent(new Event(TRIP_CHANGED_EVENT));
}

export function clearActiveTrip() {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(TRIP_CHANGED_EVENT));
}
