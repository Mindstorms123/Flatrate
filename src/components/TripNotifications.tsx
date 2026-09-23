import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  buildTripAlerts,
  loadNotifySettings,
  notifyStatus,
  requestNotifyPermission,
  saveNotifySettings,
  showAlert,
  NOTIFY_CHANGED_EVENT,
  type NotifySettings,
  type NotifyStatus,
  type TripAlert,
} from "@/lib/notifications";
import { formatTime, type Journey, type TransferRisk, type TripProgress } from "@/lib/transit";

const DELAY_CHOICES = [3, 5, 10, 15];

export function TripNotifications({
  tripId,
  journey,
  progress,
  risks,
  now,
}: {
  tripId: string;
  journey: Journey;
  progress: TripProgress;
  risks: TransferRisk[];
  now: Date;
}) {
  const [settings, setSettings] = useState<NotifySettings>(() => loadNotifySettings());
  const [status, setStatus] = useState<NotifyStatus>("default");
  const [log, setLog] = useState<TripAlert[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    setStatus(notifyStatus());
    const sync = () => setSettings(loadNotifySettings());
    window.addEventListener(NOTIFY_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(NOTIFY_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // A rebased or replaced trip starts a fresh alert history.
  useEffect(() => {
    seen.current = new Set();
    setLog([]);
  }, [tripId]);

  useEffect(() => {
    if (!settings.enabled) return;
    const alerts = buildTripAlerts({ journey, progress, risks, settings, now });
    const fresh = alerts.filter((alert) => !seen.current.has(alert.key));
    if (fresh.length === 0) return;
    fresh.forEach((alert) => {
      seen.current.add(alert.key);
      showAlert(alert);
    });
    setLog((prev) => [...fresh, ...prev].slice(0, 8));
  }, [journey, progress, risks, settings, now]);

  const update = useCallback((patch: Partial<NotifySettings>) => {
    const next = { ...loadNotifySettings(), ...patch };
    saveNotifySettings(next);
    setSettings(next);
  }, []);

  const toggle = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        update({ enabled: false });
        return;
      }
      const result = await requestNotifyPermission();
      setStatus(result);
      update({ enabled: true });
    },
    [update],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="relative"
          aria-label="Benachrichtigungen für diese Reise"
        >
          {settings.enabled ? <BellRing className="text-primary" /> : <Bell />}
          Hinweise
          {settings.enabled && log.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-display text-[0.6rem] font-bold text-primary-foreground">
              {log.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-display text-sm font-bold">
              {settings.enabled ? <BellRing size={16} className="text-primary" /> : <BellOff size={16} />}
              Benachrichtigungen
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Verspätungen, knappe oder verpasste Umstiege, Steigwechsel, Ausfälle und wann du
              einsteigen musst.
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => void toggle(checked)}
            aria-label="Benachrichtigungen ein- oder ausschalten"
          />
        </div>

        {settings.enabled ? (
          <>
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted-foreground">Ab welcher Verspätung melden?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DELAY_CHOICES.map((minutes) => (
                  <Button
                    key={minutes}
                    type="button"
                    size="sm"
                    variant={settings.minDelay === minutes ? "default" : "outline"}
                    onClick={() => update({ minDelay: minutes })}
                  >
                    +{minutes} min
                  </Button>
                ))}
              </div>
            </div>

            {status === "needs_tab" && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-warning">
                <ExternalLink size={13} /> Für Hinweise außerhalb der App öffne sie in einem eigenen
                Tab. In der App siehst du die Hinweise trotzdem.
              </p>
            )}
            {status === "denied" && (
              <p className="mt-3 text-xs text-warning">
                Hinweise außerhalb der App sind im Browser blockiert – du kannst sie in den
                Website-Einstellungen wieder erlauben. In der App zeigen wir sie weiterhin an.
              </p>
            )}
            {status === "unsupported" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Dieser Browser kennt keine Systemhinweise – du bekommst die Hinweise in der App.
              </p>
            )}

            {log.length > 0 && (
              <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto border-t border-border pt-3">
                {log.map((alert) => (
                  <li key={`${alert.key}-${alert.at}`} className="text-xs">
                    <span className="font-display font-semibold tabular-nums text-muted-foreground">
                      {formatTime(alert.at)}
                    </span>{" "}
                    <span
                      className={
                        alert.level === "critical"
                          ? "font-semibold text-destructive"
                          : alert.level === "warn"
                            ? "font-semibold text-warning"
                            : "font-semibold"
                      }
                    >
                      {alert.title}
                    </span>
                    <span className="text-muted-foreground"> · {alert.body}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <Button type="button" size="sm" className="mt-3" onClick={() => void toggle(true)}>
            <Bell /> Hinweise einschalten
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
