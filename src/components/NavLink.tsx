import { Suspense, lazy, useState, type ReactNode } from "react";
import { Loader2, Navigation } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { NavTarget } from "@/lib/geo";

const NavMap = lazy(() => import("@/components/NavMap"));

type NavLinkProps = {
  to: NavTarget;
  from?: NavTarget | null;
  label: ReactNode;
  className?: string;
  iconSize?: number;
};

/** Opens the in-app OpenStreetMap walking map to the given stop. */
export function NavLink({ to, from, label, className, iconSize = 14 }: NavLinkProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Navigation size={iconSize} /> {label}
      </button>
      <Drawer open={open} onOpenChange={setOpen} handleOnly>
        <DrawerContent className="h-[92dvh] max-h-[92dvh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle>Fußweg zu {to.name}</DrawerTitle>
            <DrawerDescription>
              Karte und Route aus OpenStreetMap – kennt auch Wege durch Bahnhöfe.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1">
            {open && (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Loader2 className="animate-spin" size={20} />
                  </div>
                }
              >
                <NavMap to={to} from={from} />
              </Suspense>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
