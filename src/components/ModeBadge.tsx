import { Bus, Footprints, Ship, TrainFront, TramFront } from "lucide-react";
import { MODE_LABEL, isDticketMode } from "@/lib/transit";

export function ModeIcon({ mode, size = 15 }: { mode: string; size?: number }) {
  if (mode === "WALK") return <Footprints size={size} />;
  if (mode === "BUS" || mode === "COACH") return <Bus size={size} />;
  if (mode === "FERRY") return <Ship size={size} />;
  if (mode === "TRAM" || mode === "SUBWAY" || mode === "METRO") return <TramFront size={size} />;
  return <TrainFront size={size} />;
}

export function LineBadge({
  mode,
  line,
  color,
}: {
  mode: string;
  line?: string | undefined;
  color?: string | undefined;
}) {

  const covered = isDticketMode(mode);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-display text-xs font-bold leading-none ${
        covered ? "bg-secondary text-secondary-foreground" : "bg-warning/15 text-warning"
      }`}
      style={color ? { boxShadow: `inset 0 -2px 0 0 ${color}` } : undefined}
    >
      <ModeIcon mode={mode} size={13} />
      {line ?? MODE_LABEL[mode] ?? mode}
    </span>
  );
}
