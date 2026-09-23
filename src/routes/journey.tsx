import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Clock3, LoaderCircle, RotateCcw, Route as RouteIcon, Ticket, TriangleAlert } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { LineBadge, ModeIcon } from "@/components/ModeBadge";
import { saveActiveTrip } from "@/lib/active-trip";
import { loadJourneyDetail, saveJourneyDetail, type JourneyDetail } from "@/lib/journey-detail";
import { mergeJourneyOptions, type JourneyOption } from "@/lib/journey-merge";

import { planJourneys } from "@/lib/transit.functions";
import { delayMinutes, formatDuration, formatTime, getTransferRisks, MODE_LABEL, type Journey, type LegEnd, type TransferRisk } from "@/lib/transit";

export const Route = createFileRoute("/journey")({
  head: () => ({
    meta: [
      { title: "Verbindungsdetails – Flatrate" },
      { name: "description", content: "Alle Fahrten, Umstiege, Haltestellen, Zeiten und Steige einer ausgewählten Verbindung." },
      { property: "og:title", content: "Verbindungsdetails – Flatrate" },
      { property: "og:description", content: "Eine ÖPNV-Verbindung mit allen Fahrten und Umstiegen im Detail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JourneyDetailPage,
});

function EndTime({ end }: { end: LegEnd }) {
  const delay = delayMinutes(end.time, end.scheduledTime);
  return (
    <span className="font-display font-bold tabular-nums">
      {formatTime(end.time)}
      {delay > 0 && <span className="ml-1 text-warning">+{delay}</span>}
    </span>
  );
}

function replaceJourneyAfterRisk(original: Journey, risk: TransferRisk, replacement: Journey): Journey {
  const legs = [...original.legs.slice(0, risk.legIndex + 1), ...replacement.legs];
  const startTime = legs[0]?.from.time ?? original.startTime;
  const endTime = legs.at(-1)?.to.time ?? replacement.endTime;
  return {
    id: `${original.id}-alternative-${replacement.id}`,
    startTime,
    endTime,
    duration: Math.max(0, (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000),
    transfers: Math.max(0, legs.filter((leg) => leg.mode !== "WALK").length - 1),
    legs,
    dticketOnly: legs.every((leg) => leg.dticket),
    walkSeconds: legs.filter((leg) => leg.mode === "WALK").reduce((sum, leg) => sum + leg.duration, 0),
  };
}

function placeValue(place: NonNullable<JourneyDetail["toPlace"]>): string {
  return place.isStop ? place.id : `${place.lat},${place.lon}`;
}

function TransferAlternatives({ detail, risk, onChoose }: { detail: JourneyDetail; risk: TransferRisk; onChoose: (option: JourneyOption) => void }) {
  const departureTime = new Date(new Date(risk.stop.time).getTime() + risk.requiredMinutes * 60_000).toISOString();
  const coordinates = `${risk.stop.lat},${risk.stop.lon}`;
  const fallbackDestination = detail.toPlace ? [detail.toPlace] : [];
  const destinations = detail.destinationOptions?.length ? detail.destinationOptions : fallbackDestination;
  const destinationKey = destinations.map((place) => place.id).sort().join(",") || detail.destination.value;
  const alternatives = useQuery({
    queryKey: ["journey-transfer-alternatives", coordinates, destinationKey, departureTime, detail.allowLongDistance],
    queryFn: async () => {
      const targets = destinations.length > 0
        ? destinations
        : [{ id: detail.destination.value, name: detail.destination.name, lat: 0, lon: 0, area: "", isStop: true }];
      const from = { id: `transfer:${coordinates}`, name: risk.stop.name, lat: risk.stop.lat, lon: risk.stop.lon, area: "", isStop: false };
      const results = await Promise.all(targets
        .filter((target) => target.id !== risk.stop.stopId)
        .map(async (to) => {
          try {
            const result = await planJourneys({
              data: {
                from: coordinates,
                fromName: risk.stop.name,
                to: destinations.length > 0 ? placeValue(to) : detail.destination.value,
                toName: to.name,
                time: departureTime,
                allowLongDistance: detail.allowLongDistance,
              },
            });
            return result.journeys.map((journey): JourneyOption => ({ journey, from, to }));
          } catch {
            return [] as JourneyOption[];
          }
        }));
      return mergeJourneyOptions(results.flat());
    },
  });

  return (
    <section className="mt-3 overflow-hidden rounded-lg border border-primary/35 bg-primary/5">
      <div className="border-b border-primary/20 px-3 py-2.5">
        <p className="font-semibold text-foreground">Nächsten Anschluss wählen</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Antippen zeigt die Reise mit dieser Weiterfahrt.</p>
      </div>
      {alternatives.isLoading && <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"><LoaderCircle className="animate-spin" size={16} /> Nächste Fahrten werden gesucht …</p>}
      {alternatives.isError && <p className="px-3 py-4 text-sm text-destructive">Nächste Fahrten konnten nicht geladen werden.</p>}
      <div className="divide-y divide-border">
        {alternatives.data?.slice(0, 5).map((option) => {
          const replacement = option.journey;
          const firstRide = replacement.legs.find((leg) => leg.mode !== "WALK");
          if (!firstRide) return null;
          return (
            <Button key={`${option.to.id}-${replacement.id}`} type="button" variant="ghost" className="h-auto w-full justify-start rounded-none px-3 py-3 text-left" onClick={() => onChoose({ ...option, journey: replaceJourneyAfterRisk(detail.journey, risk, replacement) })}>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <LineBadge mode={firstRide.mode} line={firstRide.line} color={firstRide.color} />
                  <span className="font-display font-bold tabular-nums">{formatTime(firstRide.from.time)}</span>
                  <ArrowRight size={13} className="text-muted-foreground" />
                  <span className="font-display font-bold tabular-nums">{formatTime(replacement.endTime)}</span>
                </span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">Ankunft {formatTime(replacement.endTime)} · {formatDuration(replacement.duration)}{replacement.transfers > 0 ? ` · ${replacement.transfers}× umsteigen` : " · direkt"}</span>
                {destinations.length > 1 && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">bis {option.to.name}</span>}
              </span>
              <Check size={17} className="shrink-0 text-primary" />
            </Button>
          );
        })}
      </div>
      {alternatives.data?.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">Keine spätere Verbindung gefunden.</p>}
    </section>
  );
}


function JourneyDetailPage() {
  const [detail, setDetail] = useState<JourneyDetail | null>(null);
  const [originalDetail, setOriginalDetail] = useState<JourneyDetail | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loaded = loadJourneyDetail();
    setDetail(loaded);
    setOriginalDetail(loaded);
  }, []);

  const chooseAlternative = (option: JourneyOption) => {
    setDetail((current) => {
      if (!current) return current;
      const next = {
        ...current,
        journey: option.journey,
        destination: { value: placeValue(option.to), name: option.to.name },
        toPlace: option.to,
      };
      saveJourneyDetail(next);
      return next;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetJourney = () => {
    if (!originalDetail) return;
    setDetail(originalDetail);
    saveJourneyDetail(originalDetail);
  };

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else void navigate({ to: "/" });
  };


  if (!detail) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-5">
        <Button type="button" variant="ghost" onClick={goBack}><ArrowLeft /> Zurück</Button>
        <p className="mt-8 text-sm text-muted-foreground">Diese Verbindung ist nicht mehr verfügbar.</p>
      </div>
    );
  }

  const { journey } = detail;
  const risks = getTransferRisks(journey);
  const changed = originalDetail !== null && originalDetail.journey.id !== journey.id;


  const store = () => {
    saveActiveTrip({
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      journey,
      origin: detail.origin,
      destination: detail.destination,
      allowLongDistance: detail.allowLongDistance,
      preserveSelectedJourney: changed,
    });
    void navigate({ to: "/trip" });
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-4">
      <Button type="button" variant="ghost" className="-ml-2" onClick={goBack}>
        <ArrowLeft /> Zurück zu den Verbindungen
      </Button>

      <header className="mt-3 border-b border-border pb-5">
        <p className="text-sm text-muted-foreground">{detail.origin.name} → {detail.destination.name}</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-bold tabular-nums">
            {formatTime(journey.startTime)} – {formatTime(journey.endTime)}
          </h1>
          <p className="pb-1 text-right text-xs text-muted-foreground">
            {formatDuration(journey.duration)}<br />
            {journey.transfers === 0 ? "Direkt" : `${journey.transfers}× umsteigen`}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {journey.dticketOnly ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-1 text-xs font-semibold text-success"><Ticket size={13} /> Deutschlandticket</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-1 text-xs font-semibold text-warning"><TriangleAlert size={13} /> Zusatzticket prüfen</span>
          )}
          {risks.length > 0 && <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-1 text-xs font-semibold text-destructive"><TriangleAlert size={13} /> Umstieg knapp</span>}
          {changed && <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-xs font-semibold text-primary"><Check size={13} /> Anschluss geändert</span>}
        </div>
        {changed && (
          <Button type="button" variant="ghost" size="sm" className="mt-2 -ml-2 h-9 text-xs" onClick={resetJourney}>
            <RotateCcw size={14} /> Ursprüngliche Verbindung
          </Button>
        )}
      </header>


      <ol className="py-5">
        {journey.legs.map((leg, index) => {
          const risk = risks.find((item) => item.legIndex === index);
          const alternativesForRisk = risks.find((item) =>
            journey.legs.findIndex((candidate, candidateIndex) => candidateIndex > item.legIndex && candidate.mode !== "WALK") === index,
          );
          return (
            <li key={`${leg.from.time}-${leg.to.time}-${index}`} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2">
              <div className="flex flex-col items-center text-muted-foreground">
                <span className="grid size-9 place-items-center rounded-full border border-border bg-card"><ModeIcon mode={leg.mode} size={18} /></span>
                {index < journey.legs.length - 1 && <span className="min-h-8 w-px flex-1 bg-border" />}
              </div>
              <div className="min-w-0 pb-6">
                {leg.mode === "WALK" ? (
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="font-semibold">{MODE_LABEL[leg.mode]} · {formatDuration(leg.duration)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Von {leg.from.name} nach {leg.to.name}{leg.distance ? ` · ${Math.round(leg.distance)} m` : ""}</p>
                    <NavLink from={leg.from} to={leg.to} label="Navigation öffnen" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary" />
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <LineBadge mode={leg.mode} line={leg.line} color={leg.color} />
                      <span className="min-w-0 text-sm text-muted-foreground">Richtung {leg.headsign ?? leg.to.name}</span>
                      {leg.realTime && <span className="ml-auto text-[0.65rem] font-semibold uppercase text-success">live</span>}
                    </div>
                    <div className="mt-4 grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2 gap-y-3 text-sm">
                      <EndTime end={leg.from} />
                      <div className="min-w-0"><span className="font-semibold">{leg.from.name}</span>{leg.from.track && <span className="ml-2 text-xs text-muted-foreground">Steig {leg.from.track}</span>}</div>
                      <EndTime end={leg.to} />
                      <div className="min-w-0"><span className="font-semibold">{leg.to.name}</span>{leg.to.track && <span className="ml-2 text-xs text-muted-foreground">Steig {leg.to.track}</span>}</div>
                    </div>
                    <p className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {leg.stops > 0 && <span>{leg.stops} Zwischenhalte</span>}
                      {leg.agency && <span>{leg.agency}</span>}
                    </p>
                  </div>
                )}
                {risk && (
                  <div className="mt-2 flex gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                    <Clock3 size={15} className="shrink-0" />
                    <span>{risk.status === "missed" ? "Anschluss voraussichtlich verpasst" : `Nur ${risk.availableMinutes} Minuten zum Umsteigen`}</span>
                  </div>
                )}
                {alternativesForRisk && <TransferAlternatives detail={detail} risk={alternativesForRisk} onChoose={chooseAlternative} />}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="fixed inset-x-0 bottom-[4.7rem] z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto max-w-2xl">
          <Button type="button" size="lg" className="h-12 w-full text-base" onClick={store}>
            <RouteIcon /> Diese Reise hinterlegen <Check />
          </Button>
        </div>
      </div>
    </div>
  );
}