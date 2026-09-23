import {
  isDticketMode,
  type Departure,
  type Journey,
  type Leg,
  type LegUpdate,
  type Place,
  type PlanResult,
} from "./transit";


const API = "https://api.transitous.org/api";

async function apiGet<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      "user-agent": "Flatrate-DTicket-App/1.0 (+https://lovable.app)",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fahrplandaten nicht verfügbar [${res.status}]: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/* ----------------------------- place search ----------------------------- */

type GeoItem = {
  type: string;
  id: string;
  name: string;
  lat: number;
  lon: number;
  country?: string;
  areas?: { name: string; adminLevel: number; matched?: boolean }[];
};

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export async function searchPlaces({ data: input }: { data: { query: string; lat?: number; lon?: number } }): Promise<Place[]> {
    const data = {
      query: String(input.query ?? "").slice(0, 120),
      ...(Number.isFinite(input.lat) ? { lat: Number(input.lat) } : {}),
      ...(Number.isFinite(input.lon) ? { lon: Number(input.lon) } : {}),
    };
    if (data.query.trim().length < 2) return [];
    const near = data.lat !== undefined && data.lon !== undefined;
    const items = await apiGet<GeoItem[]>("/v1/geocode", {
      text: data.query,
      language: "de",
      // Bias the geocoder towards the traveller so nearby stops rank first.
      ...(near ? { place: `${data.lat},${data.lon}`, placeBias: "12" } : {}),
    });

    // Keep the geocoder's relevance ranking first (it is already biased towards
    // the traveller), then order those best matches by real distance so the
    // closest stop with a fitting name wins.
    const inDe = items.filter((i) => (i.country ?? "DE") === "DE").slice(0, 10);
    const withDistance = near
      ? inDe
          .map((i) => ({ ...i, distance: distanceKm(data.lat ?? 0, data.lon ?? 0, i.lat, i.lon) }))
          .sort((a, b) => a.distance - b.distance)
      : inDe.map((i) => ({ ...i, distance: undefined as number | undefined }));

    return withDistance
      .slice(0, 8)
      .map((i) => ({
        id: i.id,
        name: i.name,
        lat: i.lat,
        lon: i.lon,
        isStop: i.type === "STOP",
        ...(i.distance !== undefined ? { distanceKm: i.distance } : {}),
        area:
          i.areas
            ?.filter((a) => a.adminLevel >= 4 && a.adminLevel <= 8)
            .map((a) => a.name)
            .slice(0, 2)
            .join(", ") ?? "",
      }));
}

/* ------------------------------- journeys ------------------------------- */

type MotisEnd = {
  name: string;
  stopId?: string;
  lat: number;
  lon: number;
  track?: string;
  scheduledTrack?: string;
  departure?: string;
  arrival?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
};

type MotisLeg = {
  mode: string;
  duration: number;
  distance?: number;
  realTime: boolean;
  cancelled?: boolean;
  headsign?: string;
  displayName?: string;
  routeShortName?: string;
  routeColor?: string;
  agencyName?: string;
  from: MotisEnd;
  to: MotisEnd;
  intermediateStops?: unknown[];
};

type MotisItinerary = {
  id?: string;
  startTime: string;
  endTime: string;
  duration: number;
  transfers: number;
  legs: MotisLeg[];
};

function mapLeg(l: MotisLeg): Leg {
  const line = l.displayName || l.routeShortName || undefined;
  return {
    mode: l.mode,
    ...(line ? { line } : {}),
    ...(l.headsign ? { headsign: l.headsign } : {}),
    ...(l.agencyName ? { agency: l.agencyName } : {}),
    ...(l.routeColor ? { color: `#${l.routeColor}` } : {}),
    duration: l.duration,
    ...(l.distance !== undefined ? { distance: l.distance } : {}),
    realTime: Boolean(l.realTime),
    cancelled: Boolean(l.cancelled),
    dticket: l.mode === "WALK" ? true : isDticketMode(l.mode),
    stops: l.intermediateStops?.length ?? 0,
    from: {
      name: l.from.name === "START" ? "Start" : l.from.name,
      ...(l.from.stopId ? { stopId: l.from.stopId } : {}),
      lat: l.from.lat,
      lon: l.from.lon,
      ...(l.from.track ? { track: l.from.track } : {}),
      ...(l.from.scheduledTrack ? { scheduledTrack: l.from.scheduledTrack } : {}),
      time: l.from.departure ?? l.from.arrival ?? "",
      scheduledTime: l.from.scheduledDeparture ?? l.from.departure ?? "",
    },
    to: {
      name: l.to.name === "END" ? "Ziel" : l.to.name,
      ...(l.to.stopId ? { stopId: l.to.stopId } : {}),
      lat: l.to.lat,
      lon: l.to.lon,
      ...(l.to.track ? { track: l.to.track } : {}),
      ...(l.to.scheduledTrack ? { scheduledTrack: l.to.scheduledTrack } : {}),
      time: l.to.arrival ?? l.to.departure ?? "",
      scheduledTime: l.to.scheduledArrival ?? l.to.arrival ?? "",
    },
  };
}

function mapItinerary(it: MotisItinerary, index: number): Journey {
  const legs = it.legs.map(mapLeg);
  return {
    id: it.id ?? `${it.startTime}-${index}`,
    startTime: it.startTime,
    endTime: it.endTime,
    duration: it.duration,
    transfers: it.transfers,
    legs,
    dticketOnly: legs.every((l) => l.dticket),
    walkSeconds: legs.filter((l) => l.mode === "WALK").reduce((s, l) => s + l.duration, 0),
  };
}

type PlanInput = {
  from: string;
  to: string;
  fromName?: string;
  toName?: string;
  time?: string;
  arriveBy?: boolean;
  allowLongDistance?: boolean;
  pageCursor?: string;
};

export async function planJourneys({ data }: { data: PlanInput }): Promise<PlanResult> {
    // "RAIL" is a catch-all in MOTIS that also matches ICE/IC, so the
    // Deutschlandticket request lists the regional modes explicitly.
    const modes = data.allowLongDistance
      ? "TRANSIT"
      : "BUS,TRAM,SUBWAY,METRO,FERRY,REGIONAL_RAIL,REGIONAL_FAST_RAIL,SUBURBAN,OTHER";
    const res = await apiGet<{
      itineraries: MotisItinerary[];
      nextPageCursor?: string;
      from?: { name: string };
      to?: { name: string };
    }>("/v2/plan", {
      fromPlace: data.from,
      toPlace: data.to,
      transitModes: modes,
      numItineraries: "6",
      detailedTransfers: "false",
      maxPreTransitTime: "600",
      maxPostTransitTime: "900",
      ...(data.time ? { time: data.time } : {}),
      ...(data.arriveBy ? { arriveBy: "true" } : {}),
      ...(data.pageCursor ? { pageCursor: data.pageCursor } : {}),
    });
    const journeys = (res.itineraries ?? [])
      .map(mapItinerary)
      // Without the long-distance toggle, only show what the ticket covers.
      .filter((j) => (data.allowLongDistance ? true : j.dticketOnly));
    return {
      journeys,
      ...(res.nextPageCursor ? { nextCursor: res.nextPageCursor } : {}),
      fromName: data.fromName ?? res.from?.name ?? "",
      toName: data.toName ?? res.to?.name ?? "",
    };
}

/* ------------------------ departures at one stop ------------------------ */

type StopTime = {
  place: MotisEnd & { cancelled?: boolean };
  mode: string;
  realTime: boolean;
  headsign?: string;
  displayName?: string;
  routeShortName?: string;
};

export async function stopDepartures({ data }: { data: { stopId: string; time?: string; allowLongDistance?: boolean } }): Promise<Departure[]> {
    const res = await apiGet<{ stopTimes: StopTime[] }>("/v1/stoptimes", {
      stopId: data.stopId,
      n: "12",
      radius: "300",
      ...(data.time ? { time: data.time } : {}),
    });
    return (res.stopTimes ?? [])
      .map((s) => ({
        line: s.displayName || s.routeShortName || s.mode,
        mode: s.mode,
        headsign: s.headsign ?? "",
        time: s.place.departure ?? s.place.arrival ?? "",
        scheduledTime: s.place.scheduledDeparture ?? s.place.departure ?? "",
        ...(s.place.track ? { track: s.place.track } : {}),
        realTime: Boolean(s.realTime),
        cancelled: Boolean(s.place.cancelled),
        dticket: isDticketMode(s.mode),
        stopName: s.place.name,
        stopId: s.place.stopId ?? data.stopId,
        lat: s.place.lat,
        lon: s.place.lon,
      }))
      .filter((d) => (data.allowLongDistance ? true : d.dticket));
}

/* ------------------- realtime refresh for single rides ------------------- */

type LegQuery = {
  index: number;
  stopId?: string;
  lat?: number;
  lon?: number;
  line?: string;
  mode: string;
  scheduledTime: string;
};

function sameLine(a: string | undefined, b: string | undefined): boolean {
  const norm = (s?: string) => (s ?? "").replace(/\s+/g, "").toLowerCase();
  return norm(a) !== "" && norm(a) === norm(b);
}

/**
 * Asks the departure board of each boarding stop for the specific ride, so
 * delays show up even when the planner response carries no realtime flag.
 */
export async function legRealtime({ data }: { data: { legs: LegQuery[] } }): Promise<LegUpdate[]> {
    const results = await Promise.all(
      data.legs.slice(0, 6).map(async (leg): Promise<LegUpdate | null> => {
        const stopId = leg.stopId;
        if (!stopId) return null;
        try {
          const res = await apiGet<{ stopTimes: StopTime[] }>("/v1/stoptimes", {
            stopId,
            n: "24",
            radius: "150",
            time: new Date(new Date(leg.scheduledTime).getTime() - 15 * 60000).toISOString(),
          });
          const scheduled = new Date(leg.scheduledTime).getTime();
          const candidates = (res.stopTimes ?? []).filter((s) => {
            const line = s.displayName || s.routeShortName;
            const planned = s.place.scheduledDeparture ?? s.place.departure;
            if (!planned) return false;
            if (Math.abs(new Date(planned).getTime() - scheduled) > 6 * 60000) return false;
            if (leg.line) return sameLine(line, leg.line);
            return s.mode === leg.mode;
          });
          const hit = candidates.sort((a, b) => {
            const t = (s: StopTime) =>
              Math.abs(
                new Date(s.place.scheduledDeparture ?? s.place.departure ?? 0).getTime() - scheduled,
              );
            return t(a) - t(b);
          })[0];
          if (!hit) return null;
          const departure = hit.place.departure ?? hit.place.scheduledDeparture;
          if (!departure) return null;
          return {
            index: leg.index,
            departure,
            ...(hit.place.track ? { track: hit.place.track } : {}),
            realTime: Boolean(hit.realTime),
            cancelled: Boolean(hit.place.cancelled),
          };
        } catch {
          return null;
        }
      }),
    );
    return results.filter((r): r is LegUpdate => r !== null);
}
