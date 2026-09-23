import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineBadge } from "@/components/ModeBadge";
import { planJourneys, stopDepartures } from "@/lib/transit.functions";
import {
  delayMinutes,
  formatDuration,
  formatTime,
  type LegEnd,
} from "@/lib/transit";
import { ArrowRight, Footprints } from "lucide-react";
import { NavLink } from "@/components/NavLink";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop: LegEnd;
  destination: { value: string; name: string };
  baselineTime: string;
  allowLongDistance: boolean;
};

const OFFSETS = [0, 5, 10, 15, 30];

export function AlternativesDialog({
  open,
  onOpenChange,
  stop,
  destination,
  baselineTime,
  allowLongDistance,
}: Props) {
  const [offset, setOffset] = useState(0);
  const plan = planJourneys;
  const departures = stopDepartures;

  const time = new Date(new Date(baselineTime).getTime() + offset * 60000).toISOString();
  const coords = `${stop.lat},${stop.lon}`;

  const alt = useQuery({
    queryKey: ["alt", coords, destination.value, time, allowLongDistance],
    enabled: open,
    queryFn: () =>
      plan({
        data: {
          from: coords,
          to: destination.value,
          time,
          allowLongDistance,
          toName: destination.name,
        },
      }),
  });

  const dep = useQuery({
    queryKey: ["dep", stop.stopId, time, allowLongDistance],
    enabled: open && Boolean(stop.stopId),
    queryFn: () => departures({ data: { stopId: stop.stopId as string, time, allowLongDistance } }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Weiter ab {stop.name}
            {stop.track ? ` (Steig ${stop.track})` : ""}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Ab {formatTime(time)} nach {destination.name}. Fußwege zu Haltestellen in der Nähe sind
          eingerechnet.
        </p>

        <div className="flex flex-wrap gap-2">
          {OFFSETS.map((o) => (
            <button
              key={o}
              onClick={() => setOffset(o)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                offset === o
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-ring"
              }`}
            >
              {o === 0 ? "planmäßig" : `+${o} min Verspätung`}
            </button>
          ))}
        </div>

        <section className="space-y-2">
          <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Alternative Verbindungen
          </h3>
          {alt.isLoading && <p className="text-sm text-muted-foreground">Suche Alternativen …</p>}
          {alt.isError && (
            <p className="text-sm text-destructive">Alternativen konnten nicht geladen werden.</p>
          )}
          {alt.data?.journeys.slice(0, 4).map((j) => {
            const first = j.legs.find((l) => l.mode !== "WALK");
            return (
              <div key={j.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-display text-base font-semibold">
                    {formatTime(j.startTime)} <ArrowRight className="inline" size={14} />{" "}
                    {formatTime(j.endTime)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDuration(j.duration)} · {j.transfers} Umst.
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {j.legs
                    .filter((l) => l.mode !== "WALK")
                    .map((l, i) => (
                      <LineBadge key={i} mode={l.mode} line={l.line} color={l.color} />
                    ))}
                </div>
                {first && (
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      ab {first.from.name}
                      {first.from.track ? ` · Steig ${first.from.track}` : ""}
                    </span>
                    <NavLink
                      to={first.from}
                      label="Hinlaufen"
                      iconSize={12}
                      className="inline-flex items-center gap-1 font-semibold text-primary"
                    />
                  </div>
                )}
                {j.walkSeconds > 0 && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Footprints size={12} /> {formatDuration(j.walkSeconds)} Fußweg
                  </div>
                )}
              </div>
            );
          })}
          {alt.data && alt.data.journeys.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Alternative gefunden.</p>
          )}
        </section>

        {stop.stopId && (
          <section className="space-y-2">
            <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Nächste Abfahrten an dieser Haltestelle
            </h3>
            {dep.isLoading && <p className="text-sm text-muted-foreground">Lade Abfahrten …</p>}
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {dep.data?.slice(0, 8).map((d, i) => {
                const delay = delayMinutes(d.time, d.scheduledTime);
                return (
                  <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <LineBadge mode={d.mode} line={d.line} />
                    <span className="min-w-0 flex-1 truncate text-sm">{d.headsign}</span>
                    {d.track && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[0.7rem] text-muted-foreground">
                        {d.track}
                      </span>
                    )}
                    <span className="font-display text-sm font-semibold tabular-nums">
                      {formatTime(d.time)}
                    </span>
                    {delay > 0 && (
                      <span className="text-xs font-semibold text-warning">+{delay}</span>
                    )}
                  </li>
                );
              })}
              {dep.data && dep.data.length === 0 && (
                <li className="px-3 py-3 text-sm text-muted-foreground">Keine Abfahrten gefunden.</li>
              )}
            </ul>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
