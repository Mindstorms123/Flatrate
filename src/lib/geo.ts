import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export type Coords = { lat: number; lon: number };

const KEY = "flatrate.last-position.v1";
export const POSITION_CHANGED_EVENT = "flatrate:position-changed";

export function loadLastPosition(): Coords | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Coords;
    if (typeof parsed?.lat !== "number" || typeof parsed?.lon !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function storePosition(coords: Coords) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(coords));
    window.dispatchEvent(new CustomEvent<Coords>(POSITION_CHANGED_EVENT, { detail: coords }));
  } catch {
    /* storage may be unavailable */
  }
}

/**
 * Last known position of the traveller, used to rank stop suggestions by
 * distance. Falls back to the stored position when permission is missing.
 */
export function useUserPosition(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => {
    let active = true;
    const accept = (next: Coords) => {
      if (!active) return;
      storePosition(next);
      setCoords(next);
    };
    const onPosition = (event: Event) => {
      const next = (event as CustomEvent<Coords>).detail;
      if (next) setCoords(next);
    };
    window.addEventListener(POSITION_CHANGED_EVENT, onPosition);

    const locate = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const permission = await Geolocation.checkPermissions();
          const granted = permission.location === "granted" || permission.coarseLocation === "granted";
          if (!granted) {
            if (active) setCoords(loadLastPosition());
            return;
          }
          const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 });
          accept({ lat: position.coords.latitude, lon: position.coords.longitude });
        } catch {
          if (active) setCoords(loadLastPosition());
        }
        return;
      }
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        if (active) setCoords(loadLastPosition());
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => accept({ lat: position.coords.latitude, lon: position.coords.longitude }),
        () => { if (active) setCoords(loadLastPosition()); },
        { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 },
      );
    };
    void locate();
    return () => {
      active = false;
      window.removeEventListener(POSITION_CHANGED_EVENT, onPosition);
    };
  }, []);

  return coords;
}

export type NavTarget = { lat: number; lon: number; name: string };

/** Google Maps walking route with exact coordinates (not a place name). */
export function googleWalkingUrl(to: NavTarget, from?: NavTarget | null): string {
  const base = `https://www.google.com/maps/dir/?api=1&travelmode=walking&destination=${to.lat},${to.lon}`;
  return from ? `${base}&origin=${from.lat},${from.lon}` : base;
}

/** OpenStreetMap foot routing – knows pedestrian paths through stations. */
export function osmWalkingUrl(to: NavTarget, from?: NavTarget | null): string {
  const route = from ? `${from.lat},${from.lon};${to.lat},${to.lon}` : `;${to.lat},${to.lon}`;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${encodeURIComponent(route)}`;
}

/** Android geo: URI – opens the system's app chooser (Google Maps, OsmAnd, Organic Maps, …). */
export function geoUri(to: NavTarget): string {
  return `geo:${to.lat},${to.lon}?q=${to.lat},${to.lon}(${encodeURIComponent(to.name)})`;
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}
