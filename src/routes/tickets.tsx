import { DataBackup } from "@/components/DataBackup";
import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  KIND_LABEL,
  base64ToBytes,
  loadTickets,
  needsRenewal,
  parsePkpass,
  parsePkpassBytes,
  saveTickets,
  ticketExpiresInDays,
  ticketFromPhoto,
  type StoredTicket,
  type TicketKind,
} from "@/lib/tickets";
import { downloadPass } from "@/lib/tickets.functions";
import { openTicketProvider } from "@/lib/ticket-browser";
import { maximizeTicketBrightness, restoreTicketBrightness } from "@/lib/screen-brightness";
import { onLaunchFiles, takeSharedPass, type IncomingPass } from "@/lib/pwa";
import { TicketBarcode } from "@/components/TicketBarcode";
import { Button } from "@/components/ui/button";
import {
  Barcode,
  CheckCircle2,
  ChevronUp,
  Expand,
  Image as ImageIcon,
  Link as LinkIcon,
  LogIn,
  Plus,
  RefreshCw,
  RotateCw,
  Trash2,
  TriangleAlert,
  Upload,
  WifiOff,
  X,
} from "lucide-react";


const PENDING_PROVIDER_KEY = "flatrate.pending-ticket-provider.v1";
type PendingProvider = { downloadUrl?: string; loginUrl?: string };

function loadPendingProvider(): PendingProvider {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(PENDING_PROVIDER_KEY) ?? "{}") as PendingProvider;
  } catch {
    return {};
  }
}

function savePendingProvider(value: PendingProvider): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_PROVIDER_KEY, JSON.stringify(value));
}

export const Route = createFileRoute("/tickets")({
  head: () => ({
    meta: [
      { title: "Meine Tickets – Deutschlandticket & Semesterticket" },
      {
        name: "description",
        content:
          "Deutschlandticket oder Semesterticket aus der Wallet (.pkpass) oder als Foto importieren und unterwegs griffbereit halten. Alles bleibt lokal auf dem Gerät.",
      },
      { property: "og:title", content: "Meine Tickets – Deutschlandticket & Semesterticket" },
      {
        property: "og:description",
        content: "Wallet-Ticket importieren und unterwegs griffbereit halten – lokal auf dem Gerät.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Tickets,
});
/** Removes keys the patch explicitly set to undefined. */
function stripUndefined(ticket: StoredTicket, patch: Record<string, unknown>): StoredTicket {
  const copy: Record<string, unknown> = { ...ticket };
  for (const [key, value] of Object.entries(patch)) if (value === undefined) delete copy[key];
  return copy as StoredTicket;
}

function Tickets() {
  const [tickets, setTickets] = useState<StoredTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [photoTitle, setPhotoTitle] = useState("");
  const [photoKind, setPhotoKind] = useState<TicketKind>("dticket");
  const [enlargedTicket, setEnlargedTicket] = useState<StoredTicket | null>(null);
  const [renewing, setRenewing] = useState<string | null>(null);
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [loginDrafts, setLoginDrafts] = useState<Record<string, string>>({});
  const [newDownloadUrl, setNewDownloadUrl] = useState("");
  const [newLoginUrl, setNewLoginUrl] = useState("");
  const [addingFromLink, setAddingFromLink] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [imported, setImported] = useState<string | null>(null);

  const passInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const fetchPass = downloadPass;
  const autoTried = useRef(false);

  useEffect(() => {
    const stored = loadTickets();
    setTickets(stored);
    if (stored.length === 0) setAddOpen(true);
  }, []);

  useEffect(() => {
    if (!enlargedTicket) return;
    void maximizeTicketBrightness();
    return () => {
      void restoreTicketBrightness();
    };
  }, [enlargedTicket]);


  const persist = (next: StoredTicket[]) => {
    setTickets(next);
    saveTickets(next);
    if (tickets.length === 0 && next.length > 0) setAddOpen(false);
  };

  type TicketPatch = { [K in keyof StoredTicket]?: StoredTicket[K] | undefined };
  const updateTicket = useCallback((id: string, patch: TicketPatch) => {
    setTickets((prev) => {
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
      const next = prev.map((t) =>
        t.id === id ? ({ ...stripUndefined(t, patch), ...clean } as StoredTicket) : t,
      );
      saveTickets(next);
      return next;
    });
  }, []);

  /** Downloads the pkpass again and replaces the ticket when the new one is valid. */
  const renewTicket = useCallback(
    async (ticket: StoredTicket) => {
      if (!ticket.renewUrl) return;
      setRenewing(ticket.id);
      try {
        const res = await fetchPass({ data: { url: ticket.renewUrl } });
        const fresh = parsePkpassBytes(base64ToBytes(res.base64), "ticket.pkpass");
        if (!fresh.barcodeMessage) throw new Error("Im neuen Ticket steckt kein Code.");
        const days = ticketExpiresInDays(fresh);
        if (days !== undefined && days < 0) throw new Error("Das neue Ticket ist schon abgelaufen.");
        updateTicket(ticket.id, {
          ...fresh,
          id: ticket.id,
          renewUrl: ticket.renewUrl,
          autoRenew: ticket.autoRenew ?? true,
          lastRenewAt: new Date().toISOString(),
          lastRenewError: undefined,
        });
      } catch (err) {
        updateTicket(ticket.id, {
          lastRenewAt: new Date().toISOString(),
          lastRenewError: (err as Error).message,
        });
      } finally {
        setRenewing(null);
      }
    },
    [fetchPass, updateTicket],
  );

  /** Takes over a .pkpass that arrived via share sheet or "open with". */
  const acceptIncoming = useCallback((pass: IncomingPass) => {
    try {
      const fresh = parsePkpassBytes(pass.bytes, pass.name);
      const pending = loadPendingProvider();
      setTickets((prev) => {
        const match = prev.find((t) => t.source === "pkpass" && (t.title === fresh.title || t.holder === fresh.holder));
        const next = match
          ? prev.map((t) =>
              t.id === match.id
                ? ({
                    ...fresh,
                    id: match.id,
                    ...(match.renewUrl ? { renewUrl: match.renewUrl } : {}),
                    ...(match.loginUrl ? { loginUrl: match.loginUrl } : {}),
                    ...(match.autoRenew !== undefined ? { autoRenew: match.autoRenew } : {}),
                    lastRenewAt: new Date().toISOString(),
                  } as StoredTicket)
                : t,
            )
          : [{
              ...fresh,
              ...(pending.downloadUrl ? { renewUrl: pending.downloadUrl, autoRenew: true } : {}),
              ...(pending.loginUrl ? { loginUrl: pending.loginUrl } : {}),
            }, ...prev];
        saveTickets(next);
        return next;
      });
      setImported(fresh.title);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const addFromDownloadLink = async () => {
    const downloadUrl = newDownloadUrl.trim();
    const loginUrl = newLoginUrl.trim();
    if (!downloadUrl) {
      setError("Bitte füge den Download-Link zur Wallet-Datei ein.");
      return;
    }
    setAddingFromLink(true);
    setError(null);
    savePendingProvider({ downloadUrl, ...(loginUrl ? { loginUrl } : {}) });
    try {
      const res = await fetchPass({ data: { url: downloadUrl } });
      const fresh = parsePkpassBytes(base64ToBytes(res.base64), "ticket.pkpass");
      if (!fresh.barcodeMessage) throw new Error("Im Ticket steckt kein Kontrollcode.");
      const added: StoredTicket = {
        ...fresh,
        renewUrl: downloadUrl,
        ...(loginUrl ? { loginUrl } : {}),
        autoRenew: true,
        lastRenewAt: new Date().toISOString(),
      };
      persist([added, ...tickets]);
      setImported(added.title);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingFromLink(false);
    }
  };

  const openProviderLogin = async () => {
    const loginUrl = newLoginUrl.trim();
    const downloadUrl = newDownloadUrl.trim();
    if (!loginUrl) {
      setError("Bitte füge die Login-Seite deines Anbieters ein.");
      return;
    }
    savePendingProvider({ ...(downloadUrl ? { downloadUrl } : {}), loginUrl });
    setError(null);
    try {
      const pass = await openTicketProvider(loginUrl);
      if (pass) acceptIncoming({ bytes: base64ToBytes(pass.base64), name: pass.name });
    } catch (err) {
      const message = (err as Error).message;
      if (!message.toLowerCase().includes("abgebrochen")) setError(message);
    }
  };

  useEffect(() => {
    void takeSharedPass().then((pass) => {
      if (pass) acceptIncoming(pass);
    });
    onLaunchFiles(acceptIncoming);
  }, [acceptIncoming]);

  // Automatic renewal once per visit for tickets that are (nearly) expired.
  useEffect(() => {
    if (autoTried.current || tickets.length === 0) return;
    autoTried.current = true;
    const due = tickets.filter((t) => {
      if (!needsRenewal(t)) return false;
      if (!t.lastRenewAt) return true;
      return Date.now() - new Date(t.lastRenewAt).getTime() > 6 * 3600 * 1000;
    });
    void Promise.all(due.map((t) => renewTicket(t)));
  }, [renewTicket, tickets]);

  const expiring = tickets.filter((t) => {
    const days = ticketExpiresInDays(t);
    return t.source === "pkpass" && days !== undefined && days <= 7;
  });

  const goToRenew = (id: string) => {
    setAddOpen(false);
    setHighlighted(id);
    requestAnimationFrame(() => {
      document.getElementById(`renew-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };


  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">Meine Tickets</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Deutschlandticket, Jobticket oder Semesterticket – egal von welchem Anbieter. Importiere die
        Wallet-Datei (.pkpass) oder ein Foto. Die App berücksichtigt dein Ticket bei der Suche und du
        kannst es bei der Kontrolle direkt vorzeigen. Alles bleibt nur auf diesem Gerät gespeichert.
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
        <WifiOff size={13} /> Ticket und Code funktionieren auch ohne Internet.
      </p>
      {imported && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 size={13} /> „{imported}“ wurde übernommen.
        </p>
      )}

      {expiring.length > 0 && (
        <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
            <TriangleAlert size={15} /> Ticket läuft ab
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Kein neues Ticket anlegen – erneuere unten einfach das vorhandene.
          </p>
          <div className="mt-2 grid gap-2">
            {expiring.map((t) => (
              <Button key={t.id} type="button" variant="secondary" className="justify-start" onClick={() => goToRenew(t.id)}>
                <RefreshCw size={15} /> „{t.title}“ erneuern
              </Button>
            ))}
          </div>
        </div>
      )}

      <Button
        type="button"
        variant={addOpen ? "outline" : "default"}
        className="mt-5 h-12 w-full text-base"
        onClick={() => setAddOpen((v) => !v)}
        aria-expanded={addOpen}
      >
        {addOpen ? <ChevronUp size={18} /> : <Plus size={18} />}
        {addOpen ? "Schließen" : "Neues Ticket hinzufügen"}
      </Button>

      {addOpen && (
        <>
      <section className="mt-4 rounded-lg border border-border bg-card p-4 shadow-elevated">

        <p className="flex items-center gap-2 font-display font-semibold">
          <LogIn size={18} className="text-primary" /> Ticket beim Anbieter hinterlegen
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Das funktioniert auch beim ersten Ticket: Download-Link einfügen oder beim Anbieter einloggen
          und die Wallet-Datei anschließend mit Flatrate öffnen.
        </p>
        <div className="mt-3 space-y-2">
          <input
            value={newDownloadUrl}
            onChange={(event) => setNewDownloadUrl(event.target.value)}
            placeholder="Download-Link zur .pkpass-Datei"
            inputMode="url"
            className="w-full rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-ring"
          />
          <input
            value={newLoginUrl}
            onChange={(event) => setNewLoginUrl(event.target.value)}
            placeholder="Login-Seite des Anbieters (falls nötig)"
            inputMode="url"
            className="w-full rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-ring"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="secondary" onClick={() => void addFromDownloadLink()} disabled={addingFromLink}>
              <LinkIcon size={15} /> {addingFromLink ? "Ticket wird geprüft…" : "Link prüfen & hinterlegen"}
            </Button>
            <Button type="button" onClick={() => void openProviderLogin()}>
              <LogIn size={15} /> Einloggen & Ticket holen
            </Button>
          </div>
        </div>
      </section>


      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => passInput.current?.click()}
          className="h-auto flex-col items-start gap-2 whitespace-normal rounded-lg bg-card p-4 text-left"
        >
          <Upload size={18} className="text-primary" />
          <span className="font-display font-semibold">Wallet-Datei importieren</span>
          <span className="text-xs text-muted-foreground">
            .pkpass aus Apple/Google Wallet – Code und Gültigkeit werden übernommen.
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => photoInput.current?.click()}
          className="h-auto flex-col items-start gap-2 whitespace-normal rounded-lg bg-card p-4 text-left"
        >
          <ImageIcon size={18} className="text-primary" />
          <span className="font-display font-semibold">Foto / Screenshot</span>
          <span className="text-xs text-muted-foreground">
            Ticket abfotografieren oder Screenshot hochladen.
          </span>
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          value={photoTitle}
          onChange={(e) => setPhotoTitle(e.target.value)}
          placeholder="Bezeichnung fürs Foto (z. B. Semesterticket WiSe)"
          className="rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-ring"
        />
        <select
          value={photoKind}
          onChange={(e) => setPhotoKind(e.target.value as TicketKind)}
          className="rounded-xl border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-ring"
        >
          <option value="dticket">Deutschlandticket</option>
          <option value="semester">Semesterticket</option>
          <option value="other">Anderes Ticket</option>
        </select>
      </div>
        </>
      )}


      <input
        ref={passInput}
        type="file"
        accept=".pkpass,application/vnd.apple.pkpass,application/zip"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setError(null);
          try {
            persist([await parsePkpass(file), ...tickets]);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setError(null);
          try {
            persist([await ticketFromPhoto(file, photoTitle, photoKind), ...tickets]);
            setPhotoTitle("");
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      />

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-6 space-y-3">
        {tickets.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Noch kein Ticket hinterlegt.
          </p>
        )}
        {tickets.map((t) => (
          <article key={t.id} className="rounded-lg border border-border bg-card p-4 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-success/15 px-2 py-0.5 text-[0.7rem] font-semibold text-success">
                  {KIND_LABEL[t.kind]}
                </span>
                <h2 className="mt-2 font-display text-lg font-semibold leading-tight">{t.title}</h2>
                {t.holder && <p className="mt-1 text-sm font-medium">{t.holder}</p>}
                {t.provider && t.provider !== t.title && (
                  <p className="mt-1 text-xs text-muted-foreground">Ausgestellt von {t.provider}</p>
                )}
                {t.validUntil && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    gültig bis{" "}
                    {new Date(t.validUntil).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => persist(tickets.filter((x) => x.id !== t.id))}
                aria-label="Ticket entfernen"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 size={15} />
              </Button>
            </div>

            {t.barcodeMessage && (
              <div className="mt-4 overflow-hidden rounded-lg bg-foreground p-4 text-background">
                <p className="mb-3 flex items-center justify-between gap-3 text-xs font-semibold">
                  <span className="inline-flex items-center gap-1.5"><Barcode size={14} /> Für die Ticketkontrolle</span>
                  <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 size={14} /> Bereit</span>
                </p>
                <TicketBarcode ticket={t} />
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => setEnlargedTicket(t)}
                >
                  <Expand /> Code groß anzeigen
                </Button>
              </div>
            )}

            {t.imageDataUrl && (
              <img src={t.imageDataUrl} alt={t.title} className="mt-3 w-full rounded-xl" />
            )}

            {t.source === "pkpass" && (
              <div id={`renew-${t.id}`} className={`mt-4 rounded-lg border bg-input/20 p-3 ${highlighted === t.id ? "border-warning ring-2 ring-warning/40" : "border-border"}`}>
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <LinkIcon size={14} className="text-primary" /> Automatisch erneuern
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Link zur Wallet-Datei deines Anbieters einfügen. Läuft das Ticket ab, holt die App
                  die neue Datei und prüft, ob sie gültig ist.
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={linkDrafts[t.id] ?? t.renewUrl ?? ""}
                    onChange={(e) => setLinkDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                    placeholder="https://…/ticket.pkpass"
                    inputMode="url"
                    className="min-w-0 flex-1 rounded-xl border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const url = (linkDrafts[t.id] ?? t.renewUrl ?? "").trim();
                      if (!url) return;
                      updateTicket(t.id, { renewUrl: url, autoRenew: true, lastRenewError: undefined });
                      void renewTicket({ ...t, renewUrl: url, autoRenew: true });
                    }}
                    disabled={renewing === t.id}
                  >
                    <RotateCw size={14} className={renewing === t.id ? "animate-spin" : ""} />
                    {renewing === t.id ? "Prüfe…" : t.renewUrl ? "Jetzt erneuern" : "Speichern & prüfen"}
                  </Button>
                </div>
                {t.renewUrl && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={t.autoRenew ?? false}
                      onChange={(e) => updateTicket(t.id, { autoRenew: e.target.checked })}
                      className="size-4 accent-[var(--primary)]"
                    />
                    Automatisch erneuern, sobald das Ticket abläuft
                  </label>
                )}
                {t.lastRenewError ? (
                  <p className="mt-2 text-xs text-destructive">{t.lastRenewError}</p>
                ) : (
                  t.lastRenewAt && (
                    <p className="mt-2 text-xs text-success">
                      Zuletzt geprüft:{" "}
                      {new Date(t.lastRenewAt).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · Ticket gültig
                    </p>
                  )
                )}

                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-xs font-semibold">Braucht der Link ein Login?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                      Login-Seite deines Anbieters hinterlegen, in Flatrate einloggen und dort auf „Zur Wallet
                      hinzufügen“ tippen – die Datei wird automatisch erkannt und direkt übernommen.
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={loginDrafts[t.id] ?? t.loginUrl ?? ""}
                      onChange={(e) => setLoginDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                      placeholder="https://…/login"
                      inputMode="url"
                      className="min-w-0 flex-1 rounded-xl border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-ring"
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        const url = (loginDrafts[t.id] ?? t.loginUrl ?? t.renewUrl ?? "").trim();
                        if (!url) return;
                        if (url !== t.loginUrl) updateTicket(t.id, { loginUrl: url });
                        savePendingProvider({ ...(t.renewUrl ? { downloadUrl: t.renewUrl } : {}), loginUrl: url });
                        void openTicketProvider(url)
                          .then((pass) => {
                            if (pass) acceptIncoming({ bytes: base64ToBytes(pass.base64), name: pass.name });
                          })
                          .catch((err: unknown) => {
                            const message = (err as Error).message;
                            if (!message.toLowerCase().includes("abgebrochen")) setError(message);
                          });
                      }}
                    >
                      <LogIn size={14} /> Einloggen & holen
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </article>
        ))}
      </div>

      {enlargedTicket?.barcodeMessage && (
        <div className="fixed inset-0 z-50 flex flex-col bg-foreground p-4 text-background" role="dialog" aria-modal="true" aria-label="Ticketcode groß anzeigen">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 py-2">
            <div>
              <p className="font-display text-lg font-bold">Ticketkontrolle</p>
              {enlargedTicket.holder && <p className="text-sm opacity-70">{enlargedTicket.holder}</p>}
            </div>
            <Button type="button" variant="secondary" size="icon" onClick={() => setEnlargedTicket(null)} aria-label="Schließen">
              <X />
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-white p-4">
            <TicketBarcode ticket={enlargedTicket} large />
          </div>
        </div>
      )}

      <DataBackup />
    </div>
  );
}
