import { useNavigate } from "@tanstack/react-router";
import { LineBadge, ModeIcon } from "@/components/ModeBadge";
import { Button } from "@/components/ui/button";
import { saveJourneyDetail } from "@/lib/journey-detail";
import { loadMainSearch, saveMainSearch } from "@/lib/search-session";
import {
  delayMinutes,
  formatDuration,
  formatTime,
  getTransferRisks,
  type Journey,
} from "@/lib/transit";
import { ChevronRight, Ticket, TriangleAlert, Zap } from "lucide-react";

export function JourneyCard({
  journey,
  origin,
  destination,
  allowLongDistance,
}: {
  journey: Journey;
  origin: { value: string; name: string };
  destination: { value: string; name: string };
  allowLongDistance: boolean;
}) {
  const navigate = useNavigate();

  const ridden = journey.legs.filter((l) => l.mode !== "WALK");
  const risks = getTransferRisks(journey);
  const primaryRisk = risks[0];
  const totalDelay = journey.endTime
    ? delayMinutes(journey.endTime, journey.legs.at(-1)?.to.scheduledTime ?? journey.endTime)
    : 0;

  const openDetails = () => {
    const search = loadMainSearch();
    if (search) saveMainSearch({ ...search, scrollY: window.scrollY });
    saveJourneyDetail({ journey, origin, destination, allowLongDistance });
    void navigate({ to: "/journey" });
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
      <Button
        type="button"
        variant="ghost"
        onClick={openDetails}
        className="h-auto w-full justify-start whitespace-normal rounded-none px-4 py-4 text-left hover:bg-accent/40"
      >
        <div className="w-full">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-display text-2xl font-bold tabular-nums tracking-tight">
            {formatTime(journey.startTime)}
            <span className="mx-1.5 text-muted-foreground">–</span>
            {formatTime(journey.endTime)}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="font-semibold text-foreground">{formatDuration(journey.duration)}</div>
            <div>{journey.transfers === 0 ? "direkt" : `${journey.transfers}× umsteigen`}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {ridden.map((l, i) => (
            <LineBadge key={i} mode={l.mode} line={l.line} color={l.color} />
          ))}
          {journey.walkSeconds > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ModeIcon mode="WALK" size={12} /> {Math.round(journey.walkSeconds / 60)} min
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {journey.dticketOnly ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-1 font-semibold text-success">
              <Ticket size={12} /> Deutschlandticket
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-1 font-semibold text-warning">
              <Zap size={12} /> Zusatzticket nötig
            </span>
          )}
          {totalDelay > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-1 font-semibold text-destructive">
              <TriangleAlert size={12} /> {totalDelay} min später
            </span>
          )}
          {primaryRisk && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-1 font-semibold text-destructive">
              <TriangleAlert size={12} /> {primaryRisk.status === "missed" ? "Anschluss gefährdet" : "Umstieg knapp"}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-primary">
            Details <ChevronRight size={14} />
          </span>
        </div>
        </div>
      </Button>
    </article>
  );
}
