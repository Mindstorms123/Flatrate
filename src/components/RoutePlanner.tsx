import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Route as RouteIcon,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineBadge } from "@/components/ModeBadge";
import { planJourneys } from "@/lib/transit.functions";
import { formatDuration, formatTime, type Place } from "@/lib/transit";
import { mergeJourneyOptions, type JourneyOption } from "@/lib/journey-merge";
import { loadSavedRoutes, routeDirections, routeStopOptions, type SavedRoute } from "@/lib/saved-routes";
import { saveJourneyDetail } from "@/lib/journey-detail";
import { loadPlannerSearch, savePlannerSearch } from "@/lib/search-session";

function placeValue(p: Place) {
  return p.isStop ? p.id : `${p.lat},${p.lon}`;
}

const STEP_MINUTES = 30;
const MAX_COMBINATIONS = 9;

/**
 * Lets the traveller tap a saved route and immediately see the next possible
 * departures from now – across every allowed start and destination stop.
 */
export function RoutePlanner({ title }: { title: string }) {
  const [routes] = useState<SavedRoute[]>(() => loadSavedRoutes());
  const [selected, setSelected] = useState<SavedRoute | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [shift, setShift] = useState(0);
  const [options, setOptions] = useState<JourneyOption[]>([]);
  const restored = useRef(false);
  const plan = planJourneys;
  const navigate = useNavigate();

  useEffect(() => {
    const saved = loadPlannerSearch();
    if (saved) {
      setSelected(saved.selected);
      setSelectedKey(saved.selectedKey);
      setShift(saved.shift);
      setOptions(saved.options);
      window.requestAnimationFrame(() => window.scrollTo({ top: saved.scrollY }));
    }
    window.requestAnimationFrame(() => {
      restored.current = true;
    });
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    savePlannerSearch({ selected, selectedKey, shift, options, scrollY: window.scrollY });
  }, [selected, selectedKey, shift, options]);

  const search = useMutation({
    mutationFn: async ({ route, minutes }: { route: SavedRoute; minutes: number }) => {
      const { origins, destinations } = routeStopOptions(route);
      const time = new Date(Date.now() + minutes * 60000).toISOString();
      const combos = origins
        .flatMap((from) => destinations.map((to) => ({ from, to })))
        .filter(({ from, to }) => from.id !== to.id)
        .slice(0, MAX_COMBINATIONS);

      const results = await Promise.all(
        combos.map(async ({ from, to }) => {
          try {
            const res = await plan({
              data: {
                from: placeValue(from),
                to: placeValue(to),
                fromName: from.name,
                toName: to.name,
                time,
                arriveBy: false,
                allowLongDistance: route.allowLongDistance,
              },
            });
            return res.journeys.map((journey): JourneyOption => ({ journey, from, to }));
          } catch {
            return [] as JourneyOption[];
          }
        }),
      );
      return mergeJourneyOptions(results.flat());
    },
  });

  const runSearch = (route: SavedRoute, minutes: number) => {
    search.mutate(
      { route, minutes },
      { onSuccess: (result) => setOptions(result) },
    );
  };

  const start = (route: SavedRoute, key: string) => {
    setSelected(route);
    setSelectedKey(key);
    setShift(0);
    setOptions([]);
    runSearch(route, 0);
  };

  const shiftBy = (delta: number) => {
    if (!selected) return;
    const next = shift + delta;
    setShift(next);
    runSearch(selected, next);
  };

  const openDetails = (option: JourneyOption) => {
    if (!selected) return;
    const destinationOptions = routeStopOptions(selected).destinations;
    savePlannerSearch({ selected, selectedKey, shift, options, scrollY: window.scrollY });
    saveJourneyDetail({
      journey: option.journey,
      origin: { value: placeValue(option.from), name: option.from.name },
      destination: { value: placeValue(option.to), name: option.to.name },
      allowLongDistance: selected.allowLongDistance,
      fromPlace: option.from,
      toPlace: option.to,
      destinationOptions,
    });
    void navigate({ to: "/journey" });
  };

  if (routes.length === 0) return null;
  const now = Date.now();
  const entries = routes.flatMap(routeDirections);
  const shiftLabel =
    shift === 0 ? "ab jetzt" : shift > 0 ? `ab in ${shift} min` : `ab vor ${Math.abs(shift)} min`;
  const stops = selected ? routeStopOptions(selected) : null;
  const multiStop = Boolean(stops && (stops.origins.length > 1 || stops.destinations.length > 1));

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map(({ key, route, label, icon }) => {
          const options = routeStopOptions(route);
          const extra = options.origins.length + options.destinations.length - 2;
          return (
            <Button
              key={key}
              type="button"
              variant={selectedKey === key ? "default" : "outline"}
              className="h-auto min-w-0 justify-start whitespace-normal px-3 py-2.5 text-left"
              onClick={() => start(route, key)}
            >
              {icon === "reverse" ? <ArrowLeftRight /> : icon === "commute" ? <BriefcaseBusiness /> : <Star />}
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {route.from.name} → {route.to.name}
                </span>
                <span className="block text-xs font-normal opacity-80">
                  {label}
                  {extra > 0 ? ` · +${extra} Haltestellen` : ""}
                </span>
              </span>
            </Button>
          );
        })}
      </div>

      {search.isPending && (
        <p className="mt-3 text-sm text-muted-foreground">Nächste Verbindungen werden gesucht …</p>
      )}
      {search.isError && (
        <p className="mt-3 text-sm text-destructive">{(search.error as Error).message}</p>
      )}

      {selected && options.length >= 0 && (search.data || options.length > 0) && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            {multiStop
              ? `Schnellste Verbindungen über alle hinterlegten Haltestellen (${shiftLabel}).`
              : `Abfahrten ab ${selected.from.name} (${shiftLabel}) – wähle, wann du losfahren willst.`}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={search.isPending}
              onClick={() => shiftBy(-STEP_MINUTES)}
            >
              <ChevronUp /> Früher
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={search.isPending}
              onClick={() => shiftBy(STEP_MINUTES)}
            >
              <ChevronDown /> Später
            </Button>
          </div>
          {!search.isPending && options.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Zu dieser Zeit keine Verbindung gefunden – probier „Früher“ oder „Später“.
            </p>
          )}
          {options.map((option) => {
            const { journey } = option;
            const leaveIn = Math.round((new Date(journey.startTime).getTime() - now) / 60000);
            const lines = journey.legs.filter((l) => l.mode !== "WALK");
            return (
              <Button
                key={`${option.from.id}-${option.to.id}-${journey.id}`}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start whitespace-normal rounded-2xl border border-border bg-card p-4 text-left"
                onClick={() => openDetails(option)}
              >
                <div className="w-full">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-lg font-bold tabular-nums">
                    {formatTime(journey.startTime)} → {formatTime(journey.endTime)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(journey.duration)} ·{" "}
                    {journey.transfers === 0 ? "direkt" : `${journey.transfers}× umsteigen`}
                  </p>
                </div>
                {multiStop && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin size={13} />
                    ab {option.from.name} · bis {option.to.name}
                  </p>
                )}
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <Clock size={14} />
                  {leaveIn <= 0 ? "Jetzt losgehen" : `Losgehen in ${leaveIn} min`}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {lines.map((leg, i) => (
                    <LineBadge key={i} mode={leg.mode} line={leg.line} color={leg.color} />
                  ))}
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <RouteIcon /> Details ansehen
                </p>
                </div>
              </Button>
            );
          })}
        </div>
      )}
    </section>
  );
}
