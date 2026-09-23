import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Footprints, Loader2, LocateFixed, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { geoUri, googleWalkingUrl, isNativeApp, osmWalkingUrl, type Coords, type NavTarget } from "@/lib/geo";

type Route = { coords: [number, number][]; distance: number; duration: number };

const FOOT_ROUTER = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

function metres(a: Coords, b: Coords) {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const x = dLon * Math.cos(lat);
  return Math.sqrt(dLat * dLat + x * x) * r;
}

function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

async function fetchFootRoute(from: Coords, to: Coords): Promise<Route | null> {
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

function dot(color: string, ring: string) {
  return L.divIcon({
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};box-shadow:0 0 0 4px ${ring}"></span>`,
  });
}

/** Walking navigation on an OpenStreetMap map, routed with the FOSSGIS foot profile. */
export function NavMap({ to, from }: { to: NavTarget; from?: NavTarget | null | undefined }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const meRef = useRef<L.Marker | null>(null);
  const startRef = useRef<L.Marker | null>(null);
  const [position, setPosition] = useState<Coords | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [followMe, setFollowMe] = useState(true);

  const target = useMemo<Coords>(() => ({ lat: to.lat, lon: to.lon }), [to.lat, to.lon]);
  // A planned walking leg must always be routed between its two stops. The
  // live position is only the fallback for "walk to this stop" actions.
  const start = from ? { lat: from.lat, lon: from.lon } : position;

  // map setup
  useEffect(() => {
    if (!holder.current || mapRef.current) return;
    const map = L.map(holder.current, { zoomControl: false, attributionControl: true }).setView(
      [target.lat, target.lon],
      16,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    L.marker([target.lat, target.lon], { icon: dot("#f5c542", "rgba(245,197,66,0.3)") })
      .addTo(map)
      .bindTooltip(to.name, { permanent: false });
    if (from) {
      startRef.current = L.marker([from.lat, from.lon], { icon: dot("#22c55e", "rgba(34,197,94,0.3)") })
        .addTo(map)
        .bindTooltip(from.name, { permanent: false });
    }
    map.on("dragstart", () => setFollowMe(false));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [from, target.lat, target.lon, to.name]);

  // live position
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setStatus((s) => (s === "loading" ? "error" : s)),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // route, refreshed when the traveller moved more than 25 m
  const lastRouted = useRef<Coords | null>(null);
  useEffect(() => {
    if (!start) return;
    if (lastRouted.current && metres(lastRouted.current, start) < 25) return;
    lastRouted.current = start;
    setStatus("loading");
    fetchFootRoute(start, target)
      .then((r) => {
        setRoute(r);
        setStatus(r ? "idle" : "error");
      })
      .catch(() => setStatus("error"));
  }, [start?.lat, start?.lon, target.lat, target.lon]);

  // draw route + me
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (route) {
      lineRef.current?.remove();
      lineRef.current = L.polyline(route.coords, { color: "#f5c542", weight: 6, opacity: 0.9 }).addTo(map);
      if (followMe) map.fitBounds(lineRef.current.getBounds(), { padding: [40, 40] });
    }
  }, [route, followMe]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;
    if (meRef.current) meRef.current.setLatLng([position.lat, position.lon]);
    else meRef.current = L.marker([position.lat, position.lon], { icon: dot("#38bdf8", "rgba(56,189,248,0.3)") }).addTo(map);
  }, [position]);

  const recenter = () => {
    setFollowMe(true);
    const map = mapRef.current;
    if (!map) return;
    if (lineRef.current) map.fitBounds(lineRef.current.getBounds(), { padding: [40, 40] });
    else map.setView([target.lat, target.lon], 17);
  };

  const openExternal = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <div ref={holder} className="h-full w-full" />
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label="Karte auf die Route zentrieren"
          className="absolute right-3 top-3 z-[500] h-11 w-11 shadow-lg"
          onClick={recenter}
        >
          <LocateFixed size={18} />
        </Button>
      </div>
      <div className="space-y-3 border-t border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Footprints size={16} className="shrink-0 text-primary" />
          {status === "loading" && !route ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Fußweg wird berechnet …
            </span>
          ) : route ? (
            <span>
              <strong>{formatDistance(route.distance)}</strong> · {Math.max(1, Math.round(route.duration / 60))} min zu
              Fuß
            </span>
          ) : (
            <span className="text-muted-foreground">
              {status === "error"
                ? "Fußweg konnte nicht berechnet werden – das Ziel ist auf der Karte markiert."
                : "Warte auf deinen Standort …"}
            </span>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 justify-start gap-2"
            onClick={() => openExternal(osmWalkingUrl(to, from ?? (position ? { ...position, name: "Standort" } : null)))}
          >
            <MapPin size={16} className="text-primary" /> OpenStreetMap
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 justify-start gap-2"
            onClick={() => openExternal(googleWalkingUrl(to, from ?? (position ? { ...position, name: "Standort" } : null)))}
          >
            <MapPin size={16} className="text-primary" /> Google Maps
          </Button>
          {isNativeApp() && (
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start gap-2"
              onClick={() => {
                window.location.href = geoUri(to);
              }}
            >
              <MapPin size={16} className="text-primary" /> Karten-App
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default NavMap;
