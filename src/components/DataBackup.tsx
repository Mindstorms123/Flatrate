import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

// Everything the app remembers locally: tickets, saved routes, active trip,
// notification settings and the last known position.
const PREFIXES = ["flatrate.", "dticket."];

function collect() {
  const data: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    const value = window.localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return data;
}

export function DataBackup() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");

  const save = () => {
    const payload = JSON.stringify({ app: "flatrate", savedAt: new Date().toISOString(), data: collect() }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `flatrate-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNote("Sicherung gespeichert. Bewahre die Datei auf – daraus lässt sich alles zurückholen.");
  };

  const restore = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as { data?: Record<string, string> };
      const entries = Object.entries(parsed.data ?? {}).filter(([key]) =>
        PREFIXES.some((prefix) => key.startsWith(prefix)),
      );
      if (entries.length === 0) {
        setNote("In dieser Datei war keine Flatrate-Sicherung enthalten.");
        return;
      }
      entries.forEach(([key, value]) => window.localStorage.setItem(key, value));
      setNote(`${entries.length} Einträge zurückgeholt – die App wird neu geladen …`);
      window.setTimeout(() => window.location.reload(), 900);
    } catch {
      setNote("Diese Datei konnte nicht gelesen werden.");
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-border p-4">
      <h2 className="font-display text-base font-bold">Tickets und Einstellungen sichern</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Beim Aktualisieren der App bleibt alles erhalten. Für ein neues Handy oder zur Sicherheit
        kannst du Ticket, Strecken und Einstellungen in eine Datei speichern und später zurückholen.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={save}>
          <Download /> Sicherung speichern
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={() => fileInput.current?.click()}>
          <Upload /> Sicherung zurückholen
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void restore(file);
          }}
        />
      </div>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </section>
  );
}
