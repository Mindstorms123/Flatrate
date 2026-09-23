import { useMemo, useState } from "react";
import { de } from "date-fns/locale";
import { CalendarIcon, Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

const pad = (n: number) => String(n).padStart(2, "0");

const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const fromLocalInput = (value: string): Date => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function ScrollColumn({
  values,
  selected,
  onPick,
  label,
}: {
  values: number[];
  selected: number;
  onPick: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex-1">
      <p className="mb-1 text-center text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border bg-input/30 p-1">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onPick(v)}
            className={`block w-full rounded-lg py-1.5 text-center text-sm font-semibold transition-colors ${
              v === selected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
            }`}
          >
            {pad(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = useMemo(() => value ? fromLocalInput(value) : null, [value]);
  const [draft, setDraft] = useState<Date>(() => current ?? new Date());

  const openPicker = (next: boolean) => {
    if (next) setDraft(value ? fromLocalInput(value) : new Date());
    setOpen(next);
  };

  const setPart = (patch: Partial<{ date: Date; hour: number; minute: number }>) => {
    setDraft((prev) => {
      const next = new Date(prev);
      if (patch.date) next.setFullYear(patch.date.getFullYear(), patch.date.getMonth(), patch.date.getDate());
      if (patch.hour !== undefined) next.setHours(patch.hour);
      if (patch.minute !== undefined) next.setMinutes(patch.minute);
      next.setSeconds(0, 0);
      return next;
    });
  };

  return (
    <div>
      <label className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </label>
      <Drawer open={open} onOpenChange={openPicker}>
        <DrawerTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-border bg-input/40 px-3 py-3 text-sm outline-none transition-colors focus:border-ring"
          >
            <span className="flex items-center gap-2 font-semibold text-foreground">
              <CalendarIcon size={15} className="text-muted-foreground" />
               {current ? fmtDate(current) : "Wird geladen …"}
            </span>
            <span className="flex items-center gap-2 font-semibold text-foreground">
              <Clock size={15} className="text-muted-foreground" />
               {current ? fmtTime(current) : "--:--"}
            </span>
          </button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader>
            <DrawerTitle>Datum und Uhrzeit</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 overflow-y-auto px-4 pb-2">
            <div className="flex justify-center rounded-xl border border-border bg-input/30 p-2">
              <Calendar
                mode="single"
                selected={draft}
                onSelect={(d) => d && setPart({ date: d })}
                locale={de}
                initialFocus
                className="pointer-events-auto p-1"
              />
            </div>
            <div className="flex gap-3">
              <ScrollColumn
                values={HOURS}
                selected={draft.getHours()}
                onPick={(hour) => setPart({ hour })}
                label="Stunde"
              />
              <ScrollColumn
                values={MINUTES}
                selected={MINUTES.reduce((best, m) =>
                  Math.abs(m - draft.getMinutes()) < Math.abs(best - draft.getMinutes()) ? m : best,
                )}
                onPick={(minute) => setPart({ minute })}
                label="Minute"
              />
            </div>
          </div>
          <DrawerFooter className="gap-2">
            <Button
              type="button"
              className="h-12 w-full text-base"
              onClick={() => {
                onChange(toLocalInput(draft));
                setOpen(false);
              }}
            >
              Übernehmen · {fmtDate(draft)}, {fmtTime(draft)}
            </Button>
            <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setPart({ date: new Date(), hour: new Date().getHours(), minute: new Date().getMinutes() })}>
              Jetzt
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
