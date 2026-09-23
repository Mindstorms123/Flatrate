import { useEffect, useRef, useState } from "react";
import { searchPlaces } from "@/lib/transit.functions";
import { useUserPosition } from "@/lib/geo";
import type { Place } from "@/lib/transit";
import { MapPin, TrainFront } from "lucide-react";

type Props = {
  label: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
  placeholder?: string;
  clearOnSelect?: boolean;
};

export function PlaceInput({ label, value, onChange, placeholder, clearOnSelect = false }: Props) {
  const search = searchPlaces;
  const position = useUserPosition();
  const positionRef = useRef(position);
  positionRef.current = position;
  const searchRef = useRef(search);
  searchRef.current = search;
  const [text, setText] = useState(value?.name ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    setText(value?.name ?? "");
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const q = text.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const here = positionRef.current;
        const res = await searchRef.current({
          data: { query: q, ...(here ? { lat: here.lat, lon: here.lon } : {}) },
        });
        if (id === reqId.current) setResults(res);
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [text, open, position?.lat, position?.lon]);


  return (
    <div className="relative">
      <label className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </label>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-input/40 px-3 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-input/70"
      />
      {open && (text.trim().length >= 2 || loading) && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-popover shadow-elevated">
          {loading && results.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted-foreground">Suche …</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted-foreground">Keine Treffer</li>
          )}
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(p);
                  setText(clearOnSelect ? "" : p.name);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
              >
                <span className="mt-0.5 text-muted-foreground">
                  {p.isStop ? <TrainFront size={16} /> : <MapPin size={16} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{p.name}</span>
                  {(p.area || p.distanceKm !== undefined) && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.distanceKm !== undefined && (
                        <span className="text-primary">
                          {p.distanceKm < 1
                            ? `${Math.round(p.distanceKm * 1000)} m`
                            : `${p.distanceKm.toFixed(p.distanceKm < 10 ? 1 : 0)} km`}
                        </span>
                      )}
                      {p.distanceKm !== undefined && p.area ? " · " : ""}
                      {p.area}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
