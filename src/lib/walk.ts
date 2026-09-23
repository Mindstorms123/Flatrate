import type { Coords, NavTarget } from "./geo";
import type { Journey, Leg } from "./transit";

export type FootRoute = { coords: [number, number][]; distance: number; duration: number };

const FOOT_ROUTER = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

export async function fetchFootRoute(from: Coords, to: Coords): Promise<FootRoute | null> {
  const url = `${FOOT_ROUTER}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    code?: string;
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  };
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route) return null;
  return {
    coords: route.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
    distance: route.distance,
    duration: route.duration,
  };
}

/** A walk between a personal place (home, work, current position) and a stop. */
export type AccessWalk = { place: NavTarget; seconds: number; distance: number };

function walkLeg(from: NavTarget, to: NavTarget, startMs: number, walk: AccessWalk): Leg {
  const start = new Date(startMs).toISOString();
  const end = new Date(startMs + walk.seconds * 1000).toISOString();
  return {
    mode: "WALK",
    duration: walk.seconds,
    distance: walk.distance,
    realTime: false,
    cancelled: false,
    dticket: true,
    stops: 0,
    from: { name: from.name, lat: from.lat, lon: from.lon, time: start, scheduledTime: start },
    to: { name: to.name, lat: to.lat, lon: to.lon, time: end, scheduledTime: end },
  };
}

/** Adds walks to the first stop and/or from the last stop to the journey. */
export function withAccessWalks(journey: Journey, start?: AccessWalk | null, end?: AccessWalk | null): Journey {
  if (!start && !end) return journey;
  const legs = [...journey.legs];
  const first = legs[0];
  const last = legs.at(-1);
  if (start && first) {
    const startMs = new Date(first.from.time).getTime() - start.seconds * 1000;
    legs.unshift(walkLeg(start.place, first.from, startMs, start));
  }
  if (end && last) {
    legs.push(walkLeg(last.to, end.place, new Date(last.to.time).getTime(), end));
  }
  const startTime = legs[0]!.from.time;
  const endTime = legs.at(-1)!.to.time;
  return {
    ...journey,
    id: `${journey.id}${start ? "-walkin" : ""}${end ? "-walkout" : ""}`,
    startTime,
    endTime,
    duration: Math.max(0, (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000),
    legs,
    walkSeconds: journey.walkSeconds + (start?.seconds ?? 0) + (end?.seconds ?? 0),
  };
}

export async function computeAccessWalk(from: NavTarget, to: NavTarget, place: NavTarget): Promise<AccessWalk | null> {
  const route = await fetchFootRoute(from, to);
  if (!route) return null;
  return { place, seconds: Math.round(route.duration), distance: route.distance };
}
