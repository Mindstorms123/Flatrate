import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { ChevronDown, FastForward } from "lucide-react";
import { LineBadge } from "@/components/ModeBadge";
import { Button } from "@/components/ui/button";
import { planJourneys } from "@/lib/transit.functions";
import { delayMinutes, formatTime, type Journey, type Leg } from "@/lib/transit";
import { saveActiveTrip, type ActiveTrip } from "@/lib/active-trip";
import type { Coords } from "@/lib/geo";

/** Collapsible list of intermediate stops with a "you are here" marker. */
export function LiveStops({ leg, now, defaultOpen }: { leg: Leg; now: Date; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  const stops = leg.intermediate ?? [];
  if (stops.length === 0) return null;
  const t = now.getTime();
  const rows = [
    { name: leg.from.name, time: leg.from.time, scheduledTime: leg.from.scheduledTime, track: leg.from.track },
    ...stops,
    { name: leg.to.name, time: leg.to.time, scheduledTime: leg.to.scheduledTime, track: leg.to.track },
  ];
  // Index of the last stop already passed.
  let passed = -1;
  rows.forEach((row, i) => {
    if (row.time && new Date(row.time).getTime() <= t) passed = i;
  });
  const riding = passed >= 0 && passed < rows.length - 1;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
      >
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Zwischenhalte ausblenden" : `${stops.length} Zwischenhalte anzeigen`}
      </button>
      {open && (
        <ol className="mt-2 border-l-2 border-border pl-3">
          {rows.map((row, i) => {
            const done = i <= passed;
            const delay = row.time && row.scheduledTime ? delayMinutes(row.time, row.scheduledTime) : 0;
            return (
              <li key={`${row.name}-${i}`} className="relative py-1 text-sm">
                <span
                  className={`absolute -left-[1.03rem] top-2.5 h-2.5 w-2.5 rounded-full ${
                    done ? "bg-muted-foreground/50" : "bg-primary/60"
                  }`}
                />
                <span className={done ? "text-muted-foreground" : ""}>
                  <span className="font-display font-semibold tabular-nums">
                    {row.time ? formatTime(row.time) : "–"}
                  </span>
                  {delay > 0 && <span className="text-warning"> (+{delay})</span>} {row.name}
                  {row.track && <span className="text-xs text-muted-foreground"> · Steig {row.track}</span>}
                </span>
                {riding && i === passed && (
                  <span className="mt-1 flex items-center gap-2 text-xs font-semibold text-primary">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
                    Du bist hier – nächster Halt {rows[i + 1]?.name}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function distanceMeters(a: Coords, b: Coords) {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

/** Re-reads the position every minute while the trip page is open. */
function useLivePosition(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(null);
  useEffect(() => {
    let active = true;
    const read = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const p = await Geolocation.checkPermissions();
          if (p.location !== "granted" && p.coarseLocation !== "granted") return;
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
          if (active) setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        } else if (navigator.geolocation && navigator.permissions) {
          const state = await navigator.permissions.query({ name: "geolocation" });
          if (state.state !== "granted") return;
          navigator.geolocation.getCurrentPosition(
            (pos) => active && setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            () => undefined,
            { enableHighAccuracy: true, timeout: 15000 },
          );
        }
      } catch {
        /* position is optional */
      }
    };
    void read();
    const timer = window.setInterval(read, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);
  return coords;
}

type AheadMatch = { name: string; lat: number; lon: number; stopId?: string; plannedAt: number };

/** Finds a planned stop the traveller already is at, clearly before the plan expects it. */
function findAhead(journey: Journey, pos: Coords, now: number, nextBoardIndex: number): AheadMatch | null {
  let best: (AheadMatch & { dist: number }) | null = null;
  journey.legs.forEach((leg, i) => {
    if (leg.mode === "WALK") return;
    const points: { name: string; lat?: number; lon?: number; stopId?: string; time: string; boarding: boolean }[] = [
      { ...leg.from, boarding: true },
      ...(leg.intermediate ?? []).map((s) => ({ ...s, boarding: false })),
      { ...leg.to, boarding: false },
    ];
    points.forEach((p) => {
      if (typeof p.lat !== "number" || typeof p.lon !== "number" || !p.time) return;
      // Waiting at the stop you are about to board is normal.
      if (p.boarding && i === nextBoardIndex) return;
      const plannedAt = new Date(p.time).getTime();
      if (plannedAt - now < 3 * 60000) return;
      const dist = distanceMeters(pos, { lat: p.lat, lon: p.lon });
      if (dist > 250) return;
      if (!best || dist < best.dist) {
        best = { name: p.name, lat: p.lat, lon: p.lon, plannedAt, dist, ...(p.stopId ? { stopId: p.stopId } : {}) };
      }
    });
  });
  return best;
}

/**
 * When the position shows the traveller is further along than planned (e.g. an
 * earlier bus), suggest connections onward from where they actually are.
 */
export function AheadSuggestions({
  trip,
  journey,
  now,
  nextBoardIndex,
}: {
  trip: ActiveTrip;
  journey: Journey;
  now: Date;
  nextBoardIndex: number;
}) {
  const pos = useLivePosition();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const match = pos ? findAhead(journey, pos, now.getTime(), nextBoardIndex) : null;
  const key = match ? `${trip.id}|${match.name}` : "";

  const options = useQuery({
    queryKey: ["trip-ahead", key],
    enabled: Boolean(match) && dismissed !== key,
    staleTime: 60000,
    queryFn: async () => {
      if (!match) return [];
      const res = await planJourneys({
        data: {
          from: match.stopId ?? `${match.lat},${match.lon}`,
          fromName: match.name,
          to: trip.destination.value,
          toName: trip.destination.name,
          time: new Date(Date.now() - 60000).toISOString(),
          allowLongDistance: trip.allowLongDistance,
        },
      });
      const plannedEnd = new Date(journey.endTime).getTime();
      return res.journeys
        .filter((j) => new Date(j.endTime).getTime() <= plannedEnd)
        .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
        .slice(0, 3);
    },
  });

  if (!match || dismissed === key) return null;
  const minutesAhead = Math.round((match.plannedAt - now.getTime()) / 60000);

  const choose = (next: Journey) => {
    saveActiveTrip({
      ...trip,
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      journey: next,
      origin: { value: match.stopId ?? `${match.lat},${match.lon}`, name: match.name },
      preserveSelectedJourney: true,
    });
  };

  return (
    <section className="mt-3 rounded-2xl border border-success/40 bg-success/10 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <FastForward size={16} className="text-success" />
        Du bist schon in {match.name} – {minutesAhead} min früher als geplant
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Vielleicht hast du einen früheren Bus erwischt. Von hier aus erreichst du auch diese Verbindungen:
      </p>
      {options.isPending ? (
        <p className="mt-2 text-xs text-muted-foreground">Suche frühere Verbindungen …</p>
      ) : options.data && options.data.length > 0 ? (
        <div className="mt-2 space-y-2">
          {options.data.map((j) => {
            const first = j.legs.find((l) => l.mode !== "WALK");
            return (
              <button
                key={j.id}
                type="button"
                onClick={() => choose(j)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {first && <LineBadge mode={first.mode} line={first.line} color={first.color} />}
                  <span className="text-sm">
                    ab <span className="font-semibold tabular-nums">{formatTime(first?.from.time ?? j.startTime)}</span>
                    {first?.from.track && <> · Steig {first.from.track}</>}
                  </span>
                </span>
                <span className="text-sm">
                  an <span className="font-semibold tabular-nums">{formatTime(j.endTime)}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Keine schnellere Verbindung gefunden – deine Reise passt.</p>
      )}
      <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setDismissed(key)}>
        Ausblenden
      </Button>
    </section>
  );
}
