import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LineBadge, ModeIcon } from "@/components/ModeBadge";
import { AlternativesDialog } from "@/components/AlternativesDialog";
import { RoutePlanner } from "@/components/RoutePlanner";
import { TripNotifications } from "@/components/TripNotifications";
import { Button } from "@/components/ui/button";
import { legRealtime, planJourneys } from "@/lib/transit.functions";
import {
  applyLegUpdates,
  delayMinutes,
  formatDuration,
  formatTime,
  getTransferRisks,
  getTripProgress,
  getRideProgress,
  matchJourney,
  remainingRides,
  type Journey,
  type LegEnd,
} from "@/lib/transit";
import {
  clearActiveTrip,
  loadActiveTrip,
  saveActiveTrip,
  TRIP_CHANGED_EVENT,
  type ActiveTrip,
} from "@/lib/active-trip";
import { NavLink } from "@/components/NavLink";
import { startLiveNotification, stopLiveNotification } from "@/lib/trip-live";
import {
  CheckCircle2,
  MapPin,
  RefreshCw,
  Route as RouteIcon,
  TriangleAlert,
  X,
} from "lucide-react";

export const Route = createFileRoute("/trip")({
  head: () => ({
    meta: [
      { title: "Meine Reise – Flatrate" },
      {
        name: "description",
        content:
          "Hinterlegte Reise mit Live-Fortschritt: aktuelle Fahrt, nächster Umstieg, Steig-Angaben, Verspätungen und Alternativen in Echtzeit.",
      },
      { property: "og:title", content: "Meine Reise – Flatrate" },
      {
        property: "og:description",
        content: "Live-Begleitung deiner hinterlegten ÖPNV-Reise: Umstiege, Steige und Alternativen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TripPage,
});

function stopValue(stop: LegEnd) {
  return stop.stopId ?? `${stop.lat},${stop.lon}`;
}

function TripPage() {
  const [trip, setTrip] = useState<ActiveTrip | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [altStop, setAltStop] = useState<{ stop: LegEnd; time: string } | null>(null);
  const plan = planJourneys;
  const legLive = legRealtime;

  useEffect(() => {
    const sync = () => setTrip(loadActiveTrip());
    sync();
    window.addEventListener(TRIP_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TRIP_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 20000);
    return () => window.clearInterval(timer);
  }, []);

  const live = useQuery({
    queryKey: ["trip-live", trip?.id],
    enabled: Boolean(trip && !trip.preserveSelectedJourney),
    refetchInterval: 30000,
    queryFn: async () => {
      if (!trip) throw new Error("Keine Reise hinterlegt");
      const res = await plan({
        data: {
          from: trip.origin.value,
          to: trip.destination.value,
          fromName: trip.origin.name,
          toName: trip.destination.name,
          time: trip.journey.startTime,
          allowLongDistance: trip.allowLongDistance,
        },
      });
      return matchJourney(res.journeys, trip.journey) ?? null;
    },
  });

  const planned: Journey | null = trip?.preserveSelectedJourney
    ? trip.journey
    : live.data ?? trip?.journey ?? null;

  // Some operators only publish realtime on the departure board, so every
  // upcoming ride is refreshed from its boarding stop as well.
  const legs = useQuery({
    queryKey: [
      "trip-legs",
      trip?.id,
      planned?.legs.map((l) => `${l.from.stopId ?? ""}|${l.line ?? l.mode}|${l.from.scheduledTime}`).join(";"),
    ],
    enabled: Boolean(planned),
    refetchInterval: 30000,
    queryFn: async () => {
      if (!planned) return [];
      const queries = planned.legs
        .map((leg, index) => ({ leg, index }))
        .filter(({ leg }) => leg.mode !== "WALK" && leg.from.stopId)
        .map(({ leg, index }) => ({
          index,
          ...(leg.from.stopId ? { stopId: leg.from.stopId } : {}),
          ...(leg.line ? { line: leg.line } : {}),
          mode: leg.mode,
          scheduledTime: leg.from.scheduledTime || leg.from.time,
        }));
      if (queries.length === 0) return [];
      return legLive({ data: { legs: queries } });
    },
  });

  const rebase = useMutation({
    mutationFn: async (stop: LegEnd) => {
      if (!trip) throw new Error("Keine Reise hinterlegt");
      const res = await plan({
        data: {
          from: stopValue(stop),
          to: trip.destination.value,
          fromName: stop.name,
          toName: trip.destination.name,
          time: new Date().toISOString(),
          allowLongDistance: trip.allowLongDistance,
        },
      });
      const next = res.journeys[0];
      if (!next) throw new Error("Von hier aus wurde gerade keine Weiterfahrt gefunden.");
      saveActiveTrip({
        ...trip,
        id: crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        journey: next,
        origin: { value: stopValue(stop), name: stop.name },
      });
    },
  });

  // Live journey: one ongoing notification that keeps updating on its own, also
  // with the app closed or the screen off.
  const liveJourney: Journey | null = trip ? applyLegUpdates(planned ?? trip.journey, legs.data ?? []) : null;
  const liveSignature = liveJourney
    ? `${liveJourney.id}|${liveJourney.legs
        .map((l) => `${l.from.time}${l.to.time}${l.from.track ?? ""}`)
        .join(";")}`
    : "";

  useEffect(() => {
    if (!liveJourney || new Date(liveJourney.endTime).getTime() < Date.now()) {
      void stopLiveNotification();
      return;
    }
    void startLiveNotification(liveJourney);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSignature]);

  if (!trip || !liveJourney) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
        <h1 className="font-display text-2xl font-bold">Keine Reise hinterlegt</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tippe auf eine gespeicherte Strecke – du siehst sofort, wann du losgehen musst und welche
          Verbindungen als Nächstes fahren. Oder suche eine Verbindung und hinterlege sie dort.
        </p>
        <RoutePlanner title="Gespeicherte Strecken · jetzt losfahren" />
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-display font-bold text-primary-foreground"
        >
          <RouteIcon size={16} /> Verbindung suchen
        </Link>
      </div>
    );
  }

  const journey: Journey = liveJourney;
  const progress = getTripProgress(journey, now);
  const risks = getTransferRisks(journey);
  const risk = risks[0];
  const ridingLeg = progress.ridingIndex >= 0 ? journey.legs[progress.ridingIndex] : undefined;
  const nextLeg = progress.nextIndex >= 0 ? journey.legs[progress.nextIndex] : undefined;
  const arrivalDelay = delayMinutes(journey.endTime, journey.legs.at(-1)?.to.scheduledTime ?? journey.endTime);
  const ride = ridingLeg && ridingLeg.mode !== "WALK" ? getRideProgress(ridingLeg, now) : undefined;
  // Where the traveller physically is while waiting: the stop of the last finished leg.
  const currentStop =
    progress.completedIndex >= 0 ? journey.legs[progress.completedIndex]?.to : undefined;
  const ridesLeft = remainingRides(
    journey,
    progress.ridingIndex >= 0 ? progress.ridingIndex : progress.completedIndex,
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-primary">Meine Reise</p>
          <h1 className="truncate font-display text-2xl font-bold tracking-tight">
            {trip.origin.name} → {trip.destination.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ankunft {formatTime(journey.endTime)}
            {arrivalDelay > 0 && <span className="text-warning"> (+{arrivalDelay} min)</span>} ·{" "}
            {journey.transfers === 0 ? "direkt" : `${journey.transfers}× umsteigen`}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => clearActiveTrip()}>
          <X /> Beenden
        </Button>
      </header>

      <section className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
        {progress.phase === "done" ? (
          <p className="font-display text-lg font-bold">Angekommen in {trip.destination.name}.</p>
        ) : ridingLeg ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Du bist unterwegs</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {ridingLeg.mode === "WALK" ? (
                <span className="font-display text-lg font-bold">Fußweg zu {ridingLeg.to.name}</span>
              ) : (
                <>
                  <LineBadge mode={ridingLeg.mode} line={ridingLeg.line} color={ridingLeg.color} />
                  <span className="font-display text-lg font-bold">Richtung {ridingLeg.headsign}</span>
                </>
              )}
            </div>
            <p className="mt-2 text-sm">
              Aussteigen in <span className="font-semibold">{ridingLeg.to.name}</span> um{" "}
              {formatTime(ridingLeg.to.time)}
              {ridingLeg.to.track && <> · Steig {ridingLeg.to.track}</>}
            </p>
            {ride && (
              <>
                <p className="mt-2 text-sm">
                  Eingestiegen in <span className="font-semibold">{ridingLeg.from.name}</span> ·{" "}
                  noch{" "}
                  <span className="font-semibold">
                    {ride.remainingStops} von {ride.totalStops} Halten
                  </span>{" "}
                  ({ride.minutesToExit} min)
                </p>
                <div
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-primary/20"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={ride.totalStops}
                  aria-valuenow={ride.passedStops}
                  aria-label="Fortschritt in dieser Fahrt"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round((ride.passedStops / ride.totalStops) * 100)}%` }}
                  />
                </div>
              </>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {ridesLeft === 0
                ? `Letzte Fahrt – danach bist du in ${trip.destination.name}.`
                : `Danach noch ${ridesLeft}× fahren bis ${trip.destination.name}.`}
            </p>
          </>
        ) : nextLeg ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {progress.phase === "before_start" ? "Reise beginnt" : "Umsteigen"}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {nextLeg.mode !== "WALK" && (
                <LineBadge mode={nextLeg.mode} line={nextLeg.line} color={nextLeg.color} />
              )}
              <span className="font-display text-lg font-bold">
                {nextLeg.mode === "WALK" ? `Fußweg zu ${nextLeg.to.name}` : `Richtung ${nextLeg.headsign}`}
              </span>
            </div>
            {currentStop && progress.phase === "transfer" && (
              <p className="mt-2 text-sm">
                Du bist in <span className="font-semibold">{currentStop.name}</span>
                {currentStop.track && <> · Steig {currentStop.track}</>}
              </p>
            )}
            <p className="mt-2 text-sm">
              Ab <span className="font-semibold">{nextLeg.from.name}</span> um {formatTime(nextLeg.from.time)}
              {nextLeg.from.track && <> · Steig {nextLeg.from.track}</>} · in {Math.max(0, progress.minutesToNext)} min
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {nextLeg.mode !== "WALK" && nextLeg.stops > 0 && <>{nextLeg.stops} Halte · </>}
              {ridesLeft <= 1
                ? `Letzte Fahrt bis ${trip.destination.name}.`
                : `Noch ${ridesLeft}× fahren bis ${trip.destination.name}.`}
            </p>
            <NavLink
              to={nextLeg.from}
              label="Weg zum Steig"
              iconSize={13}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"
            />
          </>
        ) : null}
      </section>

      {risk && (
        <section className="mt-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert size={16} className="text-destructive" />
            {risk.status === "missed" ? "Anschluss gefährdet" : "Umstieg wird knapp"} in {risk.stop.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nur {Math.max(0, risk.availableMinutes)} min Umsteigezeit, empfohlen sind {risk.requiredMinutes} min.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setAltStop({ stop: risk.stop, time: risk.stop.time })}
          >
            Alternativen ab {risk.stop.name}
          </Button>
        </section>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <TripNotifications tripId={trip.id} journey={journey} progress={progress} risks={risks} now={now} />
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw size={13} className={live.isFetching ? "animate-spin" : ""} />
          {live.isFetching || legs.isFetching
            ? "Live-Daten werden geladen"
            : "Aktualisiert sich automatisch alle 30 Sekunden"}
        </p>
      </div>

      <ol className="mt-4 space-y-3">
        {journey.legs.map((leg, i) => {
          const past = progress.phase === "done" || i <= progress.completedIndex;
          const active = i === progress.ridingIndex || i === progress.nextIndex;
          return (
            <li
              key={i}
              className={`rounded-2xl border p-4 ${
                active ? "border-primary/50 bg-card shadow-elevated" : "border-border bg-card/60"
              } ${past ? "opacity-60" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div className="pt-0.5 text-muted-foreground">
                  {past ? <CheckCircle2 size={18} className="text-success" /> : <ModeIcon mode={leg.mode} />}
                </div>
                <div className="min-w-0 flex-1">
                  {leg.mode === "WALK" ? (
                    <p className="text-sm text-muted-foreground">
                      {`${Math.max(1, Math.round(leg.duration / 60))} min Fußweg von ${leg.from.name} zu ${leg.to.name}`}
                      <NavLink
                        from={leg.from}
                        to={leg.to}
                        label="Navigation"
                        iconSize={12}
                        className="ml-2 inline-flex items-center gap-1 font-semibold text-primary"
                      />
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <LineBadge mode={leg.mode} line={leg.line} color={leg.color} />
                        <span className="text-sm text-muted-foreground">→ {leg.headsign}</span>
                        {leg.realTime && (
                          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-success">
                            live
                          </span>
                        )}
                      </div>
                      <div className="mt-2 space-y-1 text-sm">
                        <p>
                          <span className="font-display font-semibold tabular-nums">{formatTime(leg.from.time)}</span>{" "}
                          {delayMinutes(leg.from.time, leg.from.scheduledTime) > 0 && (
                            <span className="text-warning">
                              {" "}
                              (+{delayMinutes(leg.from.time, leg.from.scheduledTime)})
                            </span>
                          )}{" "}
                          Einstieg {leg.from.name}
                          {leg.from.track && (
                            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[0.7rem] text-muted-foreground">
                              Steig {leg.from.track}
                            </span>
                          )}
                        </p>
                        <p>
                          <span className="font-display font-semibold tabular-nums">{formatTime(leg.to.time)}</span>{" "}
                          {delayMinutes(leg.to.time, leg.to.scheduledTime) > 0 && (
                            <span className="text-warning">
                              {" "}
                              (+{delayMinutes(leg.to.time, leg.to.scheduledTime)})
                            </span>
                          )}{" "}
                          Ausstieg {leg.to.name}
                          {leg.to.track && (
                            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[0.7rem] text-muted-foreground">
                              Steig {leg.to.track}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={rebase.isPending}
                          onClick={() => rebase.mutate(leg.to)}
                        >
                          <MapPin /> Ich bin in {leg.to.name}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAltStop({ stop: leg.from, time: leg.from.time })}
                        >
                          Alternativen
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {rebase.isError && (
        <p className="mt-3 text-sm text-destructive">{(rebase.error as Error).message}</p>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Gesamtdauer {formatDuration(journey.duration)} · hinterlegt am{" "}
        {new Date(trip.savedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
      </p>

      <RoutePlanner title="Andere gespeicherte Strecke jetzt planen" />

      {altStop && (
        <AlternativesDialog
          open
          onOpenChange={(o) => !o && setAltStop(null)}
          stop={altStop.stop}
          baselineTime={altStop.time}
          destination={trip.destination}
          allowLongDistance={trip.allowLongDistance}
        />
      )}
    </div>
  );
}
