import type { Journey, Place } from "./transit";
import type { JourneyOption } from "./journey-merge";
import type { SavedRoute } from "./saved-routes";

export type SearchRequest = {
  from: string;
  to: string;
  fromName: string;
  toName: string;
  time: string;
  arriveBy: boolean;
  allowLongDistance: boolean;
};

export type MainSearchSession = {
  from: Place | null;
  to: Place | null;
  time: string;
  arriveBy: boolean;
  allowLongDistance: boolean;
  journeys: Journey[];
  cursor?: string;
  lastSearch: SearchRequest | null;
  scrollY: number;
};

export type PlannerSession = {
  selected: SavedRoute | null;
  selectedKey: string | null;
  shift: number;
  options: JourneyOption[];
  scrollY: number;
};

const MAIN_KEY = "flatrate.main-search.v1";
const PLANNER_KEY = "flatrate.route-planner.v1";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const loadMainSearch = () => read<MainSearchSession>(MAIN_KEY);
export const loadPlannerSearch = () => read<PlannerSession>(PLANNER_KEY);

export function saveMainSearch(value: MainSearchSession) {
  window.sessionStorage.setItem(MAIN_KEY, JSON.stringify(value));
}

export function savePlannerSearch(value: PlannerSession) {
  window.sessionStorage.setItem(PLANNER_KEY, JSON.stringify(value));
}