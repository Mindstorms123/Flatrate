import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { PlaceInput } from "@/components/PlaceInput";
import { DateTimeField } from "@/components/DateTimeField";
import { JourneyCard } from "@/components/JourneyCard";
import { SavedRoutes } from "@/components/SavedRoutes";
import { Button } from "@/components/ui/button";
import { planJourneys } from "@/lib/transit.functions";
import { toInputValue, type Journey, type Place } from "@/lib/transit";
import { loadTickets, TICKETS_CHANGED_EVENT } from "@/lib/tickets";
import { loadSavedRoutes, saveSavedRoutes, type SavedRoute, type SavedRouteKind } from "@/lib/saved-routes";
import { loadActiveTrip, TRIP_CHANGED_EVENT, type ActiveTrip } from "@/lib/active-trip";
import { loadMainSearch, saveMainSearch, type SearchRequest } from "@/lib/search-session";
import { ArrowUpDown, CheckCircle2, RefreshCw, Search, Star, BriefcaseBusiness, Ticket, Route as RouteIcon } from "lucide-react";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flatrate – Verbindungen mit dem Deutschlandticket" },
      {
        name: "description",
        content:
          "Verbindungssuche für Deutschlandticket- und Semesterticket-Nutzer: Busse, Trams, Fähren, Regionalzüge in Echtzeit, mit Steigen, Anschluss-Alternativen und Fußweg-Navigation.",
      },
      { property: "og:title", content: "Flatrate – Verbindungen mit dem Deutschlandticket" },
      {
        property: "og:description",
        content:
          "Alle Verbindungen, die dein Deutschlandticket abdeckt – inklusive Anschluss-Rettung bei Verspätung.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [time, setTime] = useState("");
  const [arriveBy, setArriveBy] = useState(false);
  const [allowLongDistance, setAllowLongDistance] = useState(false);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasTicket, setHasTicket] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);

  const [lastSearch, setLastSearch] = useState<SearchRequest | null>(null);
  const restored = useRef(false);

  useEffect(() => {
    const saved = loadMainSearch();
    if (saved) {
      setFrom(saved.from);
      setTo(saved.to);
      setTime(saved.time);
      setArriveBy(saved.arriveBy);
      setAllowLongDistance(saved.allowLongDistance);
      setJourneys(saved.journeys);
      setCursor(saved.cursor);
      setLastSearch(saved.lastSearch);
      window.requestAnimationFrame(() => window.scrollTo({ top: saved.scrollY }));
    } else {
      setTime(toInputValue(new Date()));
    }
    window.requestAnimationFrame(() => {
      restored.current = true;
    });
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    saveMainSearch({
      from,
      to,
      time,
      arriveBy,
      allowLongDistance,
      journeys,
      ...(cursor ? { cursor } : {}),
      lastSearch,
      scrollY: window.scrollY,
    });
  }, [from, to, time, arriveBy, allowLongDistance, journeys, cursor, lastSearch]);

  useEffect(() => {
    const updateTicketStatus = () => setHasTicket(loadTickets().length > 0);
    updateTicketStatus();
    window.addEventListener(TICKETS_CHANGED_EVENT, updateTicketStatus);
    window.addEventListener("storage", updateTicketStatus);
    return () => {
      window.removeEventListener(TICKETS_CHANGED_EVENT, updateTicketStatus);
      window.removeEventListener("storage", updateTicketStatus);
    };
  }, []);

  useEffect(() => {
    setSavedRoutes(loadSavedRoutes());
  }, []);

  useEffect(() => {
    const sync = () => setActiveTrip(loadActiveTrip());
    sync();
    window.addEventListener(TRIP_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TRIP_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);



  const plan = planJourneys;

  const placeValue = (p: Place) => (p.isStop ? p.id : `${p.lat},${p.lon}`);

  const search = useMutation({
    mutationFn: async (opts: { append?: boolean; refresh?: boolean; request?: NonNullable<typeof lastSearch> }) => {
      const request = opts.request ?? (from && to ? {
        from: placeValue(from),
        to: placeValue(to),
        fromName: from.name,
        toName: to.name,
        time: new Date(time).toISOString(),
        arriveBy,
        allowLongDistance,
      } : null);
      if (!request) throw new Error("Bitte Start und Ziel wählen.");
      const res = await plan({
        data: {
          ...request,
          ...(opts.append && cursor ? { pageCursor: cursor } : {}),
        },
      });
      return { res, append: Boolean(opts.append), refresh: Boolean(opts.refresh), request };
    },
    onSuccess: ({ res, append, request }) => {
      setJourneys((prev) => (append ? [...prev, ...res.journeys] : res.journeys));
      setCursor(res.nextCursor);
      setLastSearch(request);
      setLastUpdated(new Date());
    },
  });

  useEffect(() => {
    if (!lastSearch || journeys.length === 0) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !search.isPending) {
        search.mutate({ request: lastSearch, refresh: true });
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [journeys.length, lastSearch, search.isPending]);

  const persistRoutes = (next: SavedRoute[]) => {
    setSavedRoutes(next);
    saveSavedRoutes(next);
  };

  const existingRoute = (kind: SavedRouteKind) =>
    from && to
      ? savedRoutes.find((route) => route.kind === kind && route.from.id === from.id && route.to.id === to.id)
      : undefined;

  const toggleCurrentRoute = (kind: SavedRouteKind) => {
    if (!from || !to) return;
    const existing = existingRoute(kind);
    if (existing) {
      persistRoutes(savedRoutes.filter((route) => route.id !== existing.id));
      return;
    }
    const typicalTime = kind === "commute" ? time.slice(11, 16) : undefined;
    persistRoutes([
      ...savedRoutes,
      {
        id: crypto.randomUUID(),
        kind,
        from,
        to,
        allowLongDistance,
        ...(typicalTime ? { typicalTime } : {}),
      },
    ]);
  };

  const openSavedRoute = (route: SavedRoute) => {
    setFrom(route.from);
    setTo(route.to);
    setAllowLongDistance(route.allowLongDistance);
    const nextTime = new Date();
    if (route.typicalTime) {
      const [hours, minutes] = route.typicalTime.split(":").map(Number);
      nextTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    }
    const inputTime = toInputValue(nextTime);
    setTime(inputTime);
    setArriveBy(false);
    search.mutate({
      request: {
        from: placeValue(route.from),
        to: placeValue(route.to),
        fromName: route.from.name,
        toName: route.to.name,
        time: nextTime.toISOString(),
        arriveBy: false,
        allowLongDistance: route.allowLongDistance,
      },
    });
  };

  /** Search the same route 30 minutes earlier or later when the times don't fit. */
  const shiftSearch = (deltaMinutes: number) => {
    const base = lastSearch ?? (from && to
      ? {
          from: placeValue(from),
          to: placeValue(to),
          fromName: from.name,
          toName: to.name,
          time: new Date(time).toISOString(),
          arriveBy,
          allowLongDistance,
        }
      : null);
    if (!base) return;
    const nextTime = new Date(new Date(base.time).getTime() + deltaMinutes * 60000);
    setTime(toInputValue(nextTime));
    setCursor(undefined);
    search.mutate({ request: { ...base, time: nextTime.toISOString() } });
  };

  const destination = to ? { value: placeValue(to), name: to.name } : null;
  const origin = from ? { value: placeValue(from), name: from.name } : null;


  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Fahren, was das Ticket hergibt.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bus, Tram, U-/S-Bahn, Fähre und Regionalzug – nur Verbindungen, die dein
          Deutschlandticket abdeckt. Mit Echtzeit, Steig-Angaben und Anschluss-Rettung.
        </p>
        {hasTicket && (
          <Link to="/tickets" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-success">
            <CheckCircle2 size={15} /> Deutschlandticket hinterlegt
          </Link>
        )}
      </header>

      {activeTrip && (
        <Link
          to="/trip"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm"
        >
          <RouteIcon size={18} className="text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Reise läuft: {activeTrip.origin.name} → {activeTrip.destination.name}</span>
            <span className="text-xs text-muted-foreground">Live-Übersicht mit Umstiegen und Steigen öffnen</span>
          </span>
        </Link>
      )}



      <SavedRoutes
        routes={savedRoutes}
        onSelect={openSavedRoute}
        onRemove={(id) => persistRoutes(savedRoutes.filter((route) => route.id !== id))}
        onUpdate={(updated) =>
          persistRoutes(savedRoutes.map((route) => (route.id === updated.id ? updated : route)))
        }
      />

      <section className="rounded-2xl border border-border bg-card p-4 shadow-elevated">
        <div className="space-y-3">
          <PlaceInput label="Von" value={from} onChange={setFrom} placeholder="Haltestelle oder Ort" />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
              aria-label="Start und Ziel tauschen"
              className="rounded-full border border-border p-2 text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
            >
              <ArrowUpDown size={16} />
            </button>
          </div>
          <PlaceInput label="Nach" value={to} onChange={setTo} placeholder="Haltestelle oder Ort" />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <DateTimeField
            label={arriveBy ? "Ankunft" : "Abfahrt"}
            value={time}
            onChange={setTime}
          />
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setArriveBy((v) => !v)}
              className={`flex-1 rounded-xl border px-3 py-3 text-xs font-semibold transition-colors ${
                arriveBy ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {arriveBy ? "Ankunftszeit" : "Abfahrtszeit"}
            </button>
            <button
              type="button"
              onClick={() => setTime(toInputValue(new Date()))}
              className="rounded-xl border border-border px-3 py-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-ring"
            >
              Jetzt
            </button>
          </div>
        </div>

        <label className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 text-xs">
          <input
            type="checkbox"
            checked={allowLongDistance}
            onChange={(e) => setAllowLongDistance(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--primary)]"
          />
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">Fernverkehr mit anzeigen</span> – für
            ICE-/IC-Kurzstrecken, die fürs Deutschlandticket freigegeben sind. Solche Fahrten werden
            als „Zusatzticket nötig“ markiert; prüfe die Freigabe für deine Strecke.
          </span>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={existingRoute("favorite") ? "default" : "outline"}
            size="sm"
            disabled={!from || !to}
            onClick={() => toggleCurrentRoute("favorite")}
          >
            <Star /> {existingRoute("favorite") ? "Favorit gespeichert" : "Als Favorit"}
          </Button>
          <Button
            type="button"
            variant={existingRoute("commute") ? "default" : "outline"}
            size="sm"
            disabled={!from || !to}
            onClick={() => toggleCurrentRoute("commute")}
          >
            <BriefcaseBusiness />{" "}
            {existingRoute("commute") ? "Pendelstrecke gespeichert" : "Als Pendelstrecke"}
          </Button>
        </div>
        <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
          Gespeicherte Strecken findest du auch unter „Meine Reise“ – dort siehst du direkt die nächsten
          Abfahrten und wann du losgehen musst.
        </p>

        <button
          onClick={() => search.mutate({})}
          disabled={!from || !to || search.isPending}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-display font-bold text-primary-foreground transition-opacity disabled:opacity-40"
        >
          <Search size={16} />
          {search.isPending ? "Suche …" : "Verbindungen suchen"}
        </button>

        {search.isError && (
          <p className="mt-3 text-sm text-destructive">{(search.error as Error).message}</p>
        )}
      </section>

      {journeys.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw size={13} className={search.isPending ? "animate-spin" : ""} />
            {search.isPending ? "Live-Daten werden aktualisiert" : "Automatische Aktualisierung alle 30 Sekunden"}
          </span>
          {lastUpdated && <span>Stand {lastUpdated.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {journeys.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => shiftSearch(-30)}
              disabled={search.isPending}
              className="rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-ring disabled:opacity-40"
            >
              Frühere Verbindungen
            </button>
            <button
              onClick={() => shiftSearch(30)}
              disabled={search.isPending}
              className="rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-ring disabled:opacity-40"
            >
              Spätere Verbindungen
            </button>
          </div>
        )}
        {journeys.map((j) => (
          <JourneyCard
            key={j.id}
            journey={j}
            origin={origin ?? { value: "", name: "Start" }}
            destination={destination ?? { value: "", name: "Ziel" }}
            allowLongDistance={allowLongDistance}
          />

        ))}
        {journeys.length > 0 && cursor && (
          <button
            onClick={() => search.mutate({ append: true })}
            disabled={search.isPending}
            className="w-full rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-ring disabled:opacity-40"
          >
            Noch spätere Verbindungen anhängen
          </button>
        )}
        {journeys.length === 0 && !search.isPending && !hasTicket && (
          <Link
            to="/tickets"
            className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground transition-colors hover:border-ring"
          >
            <Ticket size={18} className="text-primary" />
            Ticket aus der Wallet importieren – dann hast du es unterwegs immer dabei.
          </Link>
        )}
      </div>
    </div>
  );
}
