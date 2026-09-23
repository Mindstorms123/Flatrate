import type { Place } from "@/lib/transit";

export type SavedRouteKind = "favorite" | "commute";

export type SavedRoute = {
  id: string;
  kind: SavedRouteKind;
  from: Place;
  to: Place;
  allowLongDistance: boolean;
  typicalTime?: string;
  /** Further stops that also work as a starting point for this route. */
  altFrom?: Place[];
  /** Further stops that also work as a destination for this route. */
  altTo?: Place[];
};

const KEY = "flatrate.saved-routes.v1";

function asPlaces(value: unknown): Place[] {
  if (Array.isArray(value)) return value as Place[];
  return value ? [value as Place] : [];
}

/** Accepts older entries that only stored a single alternative stop. */
function normalize(route: SavedRoute): SavedRoute {
  return { ...route, altFrom: asPlaces(route.altFrom), altTo: asPlaces(route.altTo) };
}

export function loadSavedRoutes(): SavedRoute[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? (value as SavedRoute[]).map(normalize) : [];
  } catch {
    return [];
  }
}

export function saveSavedRoutes(routes: SavedRoute[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(routes));
}

/** The matching return trip for a saved route (e.g. the way back from a commute). */
export function reverseSavedRoute(route: SavedRoute): SavedRoute {
  const { typicalTime: _typicalTime, ...rest } = normalize(route);
  return {
    ...rest,
    from: route.to,
    to: route.from,
    altFrom: asPlaces(route.altTo),
    altTo: asPlaces(route.altFrom),
  };
}

export type RouteDirection = {
  key: string;
  label: string;
  icon: "favorite" | "commute" | "reverse";
  route: SavedRoute;
};

/** Forward trip plus, for commutes, the return trip. */
export function routeDirections(route: SavedRoute): RouteDirection[] {
  if (route.kind !== "commute") {
    return [{ key: `${route.id}-fwd`, label: "Favorit · nächste Abfahrten", icon: "favorite", route: normalize(route) }];
  }
  return [
    { key: `${route.id}-fwd`, label: "Pendelstrecke · nächste Abfahrten", icon: "commute", route: normalize(route) },
    { key: `${route.id}-rev`, label: "Rückfahrt · nächste Abfahrten", icon: "reverse", route: reverseSavedRoute(route) },
  ];
}

/** Every start/destination the traveller allowed for this direction. */
export function routeStopOptions(route: SavedRoute): { origins: Place[]; destinations: Place[] } {
  const dedupe = (places: Place[]) => {
    const seen = new Set<string>();
    return places.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  };
  return {
    origins: dedupe([route.from, ...asPlaces(route.altFrom)]),
    destinations: dedupe([route.to, ...asPlaces(route.altTo)]),
  };
}
