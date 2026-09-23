import { useState } from "react";
import { ArrowLeftRight, BriefcaseBusiness, Check, MapPin, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { PlaceInput } from "@/components/PlaceInput";
import { reverseSavedRoute, type SavedRoute } from "@/lib/saved-routes";
import type { Place } from "@/lib/transit";

type Props = {
  routes: SavedRoute[];
  onSelect: (route: SavedRoute) => void;
  onRemove: (id: string) => void;
  onUpdate: (route: SavedRoute) => void;
};

/** Editor for as many extra start and destination stops as the traveller wants. */
function StopOptions({ route, onUpdate }: { route: SavedRoute; onUpdate: (r: SavedRoute) => void }) {
  const [open, setOpen] = useState(false);
  const [altFrom, setAltFrom] = useState<Place[]>(route.altFrom ?? []);
  const [altTo, setAltTo] = useState<Place[]>(route.altTo ?? []);
  const extra = (route.altFrom?.length ?? 0) + (route.altTo?.length ?? 0);

  const changeOpen = (next: boolean) => {
    if (next) {
      setAltFrom(route.altFrom ?? []);
      setAltTo(route.altTo ?? []);
    }
    setOpen(next);
  };

  const add = (field: "altFrom" | "altTo", place: Place | null) => {
    if (!place) return;
    const current = field === "altFrom" ? altFrom : altTo;
    if (current.some((p) => p.id === place.id) || place.id === route.from.id || place.id === route.to.id) return;
    if (field === "altFrom") setAltFrom([...current, place]);
    else setAltTo([...current, place]);
  };

  const remove = (field: "altFrom" | "altTo", id: string) => {
    if (field === "altFrom") setAltFrom((places) => places.filter((place) => place.id !== id));
    else setAltTo((places) => places.filter((place) => place.id !== id));
  };

  const list = (field: "altFrom" | "altTo", places: Place[]) =>
    places.length > 0 && (
      <ul className="space-y-1">
        {places.map((p) => (
          <li key={p.id} className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <MapPin size={15} className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${p.name} entfernen`}
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => remove(field, p.id)}
            >
              <X size={16} />
            </Button>
          </li>
        ))}
      </ul>
    );

  return (
    <Drawer open={open} onOpenChange={changeOpen}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Alternative Haltestellen verwalten"
          title="Alternative Haltestellen"
          className={extra > 0 ? "text-primary" : ""}
        >
          <MapPin />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[92dvh] max-h-[92dvh]">
        <DrawerHeader className="border-b border-border px-4 pb-4 text-left">
          <DrawerTitle>Weitere Haltestellen</DrawerTitle>
          <DrawerDescription>
            Beliebig viele Start- und Zielhaltestellen. Sie werden in allen Kombinationen geprüft und nur die
            sinnvollsten Verbindungen angezeigt.
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5">
          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Auch hier starten</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">Bisher: {route.from.name}</p>
            </div>
            <PlaceInput
              label="Weitere Starthaltestelle"
              value={null}
              clearOnSelect
              onChange={(place) => add("altFrom", place)}
              placeholder="Haltestelle oder Ort suchen"
            />
            {list("altFrom", altFrom)}
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <div>
              <p className="text-sm font-semibold">Auch hier ankommen</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">Bisher: {route.to.name}</p>
            </div>
            <PlaceInput
              label="Weitere Zielhaltestelle"
              value={null}
              clearOnSelect
              onChange={(place) => add("altTo", place)}
              placeholder="Haltestelle oder Ort suchen"
            />
            {list("altTo", altTo)}
          </section>
        </div>

        <DrawerFooter className="border-t border-border bg-background pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            className="h-12 w-full text-base"
            onClick={() => {
              onUpdate({ ...route, altFrom, altTo });
              setOpen(false);
            }}
          >
            <Check /> Übernehmen
          </Button>
          <DrawerClose asChild>
            <Button type="button" variant="ghost" className="h-11 w-full">Abbrechen</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export function SavedRoutes({ routes, onSelect, onRemove, onUpdate }: Props) {
  if (routes.length === 0) return null;

  return (
    <section className="mb-5">
      <h2 className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Gespeicherte Strecken
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {routes.map((route) => {
          const extra = (route.altFrom?.length ?? 0) + (route.altTo?.length ?? 0);
          return (
            <div key={route.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
              <Button
                type="button"
                variant="ghost"
                className="h-auto min-w-0 flex-1 justify-start whitespace-normal px-2 py-1.5 text-left"
                onClick={() => onSelect(route)}
              >
                {route.kind === "commute" ? (
                  <BriefcaseBusiness className="text-primary" />
                ) : (
                  <Star className="text-primary" />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{route.from.name} → {route.to.name}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {route.kind === "commute" ? `Pendelstrecke · meist ${route.typicalTime ?? "jetzt"}` : "Favorit"}
                    {extra > 0 ? ` · +${extra} Haltestellen` : ""}
                  </span>
                </span>
              </Button>
              {route.kind === "commute" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Gegenstrecke: ${route.to.name} nach ${route.from.name}`}
                  title="Gegenstrecke suchen"
                  onClick={() => onSelect(reverseSavedRoute(route))}
                >
                  <ArrowLeftRight />
                </Button>
              )}
              <StopOptions route={route} onUpdate={onUpdate} />
              <Button type="button" variant="ghost" size="icon" aria-label="Gespeicherte Strecke löschen" onClick={() => onRemove(route.id)}>
                <Trash2 />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
