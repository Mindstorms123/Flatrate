import type { Journey, Place } from "./transit";
import type { NavTarget } from "./geo";

export type JourneyDetail = {
  journey: Journey;
  origin: { value: string; name: string };
  destination: { value: string; name: string };
  allowLongDistance: boolean;
  fromPlace?: Place;
  toPlace?: Place;
  /** Every destination stop accepted for this saved commute direction. */
  destinationOptions?: Place[];
  /** Saved home / work points for the walk to the first and from the last stop. */
  accessStart?: NavTarget;
  accessEnd?: NavTarget;
};

const KEY = "flatrate.journey-detail.v1";

export function saveJourneyDetail(detail: JourneyDetail) {
  window.sessionStorage.setItem(KEY, JSON.stringify(detail));
}

export function loadJourneyDetail(): JourneyDetail | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as JourneyDetail) : null;
  } catch {
    return null;
  }
}