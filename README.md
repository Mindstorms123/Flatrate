<div align="center">

# Flatrate

**Fahren, was das Ticket hergibt.**

Open-Source-App für Deutschlandticket-, Jobticket- und Semesterticket-Nutzer:
Verbindungen in Echtzeit, Anschluss-Rettung bei Verspätung, Fußweg-Navigation auf
OpenStreetMap-Basis und das eigene Wallet-Ticket offline dabei.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20Web%20(PWA)-informational)
![Made with](https://img.shields.io/badge/Made%20with-React%20%2B%20TanStack%20Start%20%2B%20Capacitor-blue)

[Android-APK herunterladen](../../releases/latest) · [Funktionen](#funktionen) · [Screenshots](#screenshots) · [Selbst bauen](#selbst-bauen)

</div>

---

## Was Flatrate macht

Flatrate ist für Menschen gedacht, die mit einer Flatrate im Nahverkehr unterwegs sind.
Die App zeigt nur Fahrten, die das Deutschlandticket abdeckt (Bus, Tram, U-/S-Bahn,
Fähre, Regionalzug) – Fernverkehr lässt sich optional einblenden und wird deutlich als
„Zusatzticket nötig" markiert.

Der Kern ist die **Anschluss-Rettung**: Wenn ein Umstieg durch Verspätung knapp wird,
schlägt die App direkt unter der betroffenen Fahrt die nächsten realen Abfahrten vor –
mit echten Zeiten, Steigen und neuer Ankunftszeit. Ein Tipp darauf baut die Reise um.

## Funktionen

### Verbindungen
- Suche über ganz Deutschland, Haltestellenvorschläge nach Entfernung zum eigenen Standort
- Echtzeitdaten inklusive Verspätungen, Steig-/Gleisänderungen und Ausfällen
- Zusätzliche Abfrage jeder einzelnen Fahrt an der Einstiegshaltestelle (alle 30 s), weil
  manche Verkehrsunternehmen ihre Echtzeit nur dort melden
- „Frühere/Spätere Verbindungen", moderne Datums- und Uhrzeitauswahl
- Detailansicht mit vollständiger Timeline: jede Fahrt, jeder Fußweg, Steige,
  Zwischenhalte und Verkehrsunternehmen

### Anschluss-Rettung
- Erkennung knapper und verpasster Umstiege
- Alternativen erscheinen direkt unter der betroffenen Fahrt, mit der tatsächlichen
  Abfahrtszeit des Ersatzbusses bzw. -zugs
- Antippen übernimmt die Alternative in die angezeigte Reise; „Ursprüngliche Verbindung"
  setzt zurück
- Bei Pendelstrecken werden alle hinterlegten Zielhaltestellen mitgesucht und nach
  schnellster Ankunft zusammengeführt

### Favoriten und Pendelstrecken
- Strecken als Favorit oder Pendelstrecke speichern (erscheinen nur als Hin- und Rückweg)
- Beliebig viele Alternativhaltestellen für Start und Ziel; alle Kombinationen werden
  geprüft, dominierte und doppelte Ergebnisse gefiltert

### Meine Reise (Live-Begleitung)
- Reise hinterlegen und live verfolgen: aktuelles Verkehrsmittel, aktuelle Haltestelle,
  verbleibende Halte, nächster Umstieg mit Steig
- „Ich bin hier" zum Neuplanen unterwegs
- Benachrichtigungen: 10 Minuten vor Reisebeginn, bei Verspätung ab einstellbarer
  Schwelle, bei knappen/verpassten Umstiegen, Steigwechsel und Ausfall

### Navigation
- OpenStreetMap-Karte **direkt in der App** (Leaflet) mit eingezeichnetem Fußweg,
  Entfernung und Gehzeit – Routing über den FOSSGIS-OSRM-Fußgängerdienst
- Kennt Wege *durch* Bahnhöfe und einzelne Steige großer Umsteigeplätze
- Route wird vom geplanten Fußweg-Anfang gezeichnet, nicht vom Sofa aus
- Optional weiter zu OpenStreetMap, Google Maps oder einer installierten Karten-App

### Tickets
- Import von Wallet-Dateien (`.pkpass`) aus Apple/Google Wallet oder als Foto
- Kontrollcode wird Byte für Byte exakt wie in der Wallet-Datei erzeugt; drei
  Code-Varianten für hakelige Prüfgeräte („Code lässt sich nicht scannen?")
- Anbieter-Login öffnet sich in der App; erkannte `.pkpass`-Downloads werden automatisch
  übernommen
- Automatische Erneuerung über einen hinterlegten Download-Link, mit Ablauf-Hinweis
- Ticket und Code funktionieren vollständig **offline**

## Screenshots

| Suche | Verbindungen | Details |
| --- | --- | --- |
| <img src="docs/screenshots/01-suche.png" width="250" alt="Verbindungssuche" /> | <img src="docs/screenshots/02-verbindungen.png" width="250" alt="Verbindungsliste mit Echtzeit" /> | <img src="docs/screenshots/03-details.png" width="250" alt="Detailansicht einer Verbindung" /> |

| Navigation (OpenStreetMap) | Meine Reise | Tickets |
| --- | --- | --- |
| <img src="docs/screenshots/04-navigation.png" width="250" alt="Fußweg-Karte in der App" /> | <img src="docs/screenshots/05-reise.png" width="250" alt="Live-Begleitung der Reise" /> | <img src="docs/screenshots/06-tickets.png" width="250" alt="Ticketverwaltung" /> |

## Installation (Android)

1. Die aktuelle `.apk` unter [Releases](../../releases/latest) herunterladen.
2. Auf dem Handy öffnen und die Installation aus unbekannten Quellen erlauben.
3. Beim ersten Start Benachrichtigungen und Standort erlauben (beides optional, aber
   Echtzeit-Hinweise und standortnahe Haltestellen brauchen es).

Die Debug-APK ist zum Testen und zur eigenen Nutzung gedacht. Für Google Play wären eine
dauerhafte Signatur und ein `.aab`-Paket nötig.

Die Web-Version ist eine PWA: „Zum Startbildschirm hinzufügen" genügt, Tickets bleiben
offline verfügbar.

## Datenquellen

| Zweck | Quelle |
| --- | --- |
| Fahrpläne, Echtzeit, Haltestellensuche | [Transitous](https://transitous.org) (`api.transitous.org`, offenes Community-Projekt auf GTFS/MOTIS-Basis) |
| Karten-Kacheln | [OpenStreetMap](https://www.openstreetmap.org/copyright) |
| Fußgänger-Routing | FOSSGIS-OSRM (`routing.openstreetmap.de`) |

Flatrate nutzt **keine** Schnittstellen der Deutschen Bahn und ist keine offizielle App
eines Verkehrsunternehmens oder Verbunds.

## Datenschutz

- Es gibt **keinen Server und kein Benutzerkonto**. Tickets, Favoriten, Pendelstrecken und
  die aktive Reise liegen ausschließlich lokal auf dem Gerät (`localStorage`).
- Der Standort verlässt das Gerät nur als Koordinate in Fahrplan- und Routing-Anfragen und
  wird nirgends gespeichert oder weitergegeben.
- Wallet-Tickets werden lokal entpackt und gelesen; der Kontrollcode wird auf dem Gerät
  erzeugt.

## Technik

- **React 19** + **TanStack Start / Router** (dateibasiertes Routing in `src/routes`)
- **Vite 8**, **Tailwind CSS v4**, shadcn-Komponenten, **TanStack Query**
- **Capacitor 8** für die Android-App (Local Notifications, Geolocation, Browser, eigenes
  `TicketBrowserPlugin` für den Anbieter-Login samt `.pkpass`-Download)
- **Leaflet** für die In-App-Karte, **fflate** + **bwip-js**/**qrcode** für `.pkpass` und
  Barcodes
- Für den Mobile-Build läuft TanStack Start im SPA-Modus; alle Assets liegen in der APK

Interessante Dateien:

```
src/lib/transit.ts            Fahrplan-Modell, Echtzeit-Updates, Umstiegsrisiken
src/lib/journey-merge.ts      Zusammenführen und Filtern von Verbindungsvarianten
src/lib/active-trip.ts        Live-Fortschritt der hinterlegten Reise
src/lib/notifications.ts      Regeln für alle Benachrichtigungen
src/lib/tickets.ts            .pkpass lesen, Barcode-Bytes, Auto-Erneuerung
src/components/NavMap.tsx     OpenStreetMap-Karte mit Fußweg-Routing
src/routes/journey.tsx        Detailansicht inkl. Anschluss-Rettung
```

## Selbst bauen

Voraussetzungen: [Bun](https://bun.sh) (oder npm), für Android zusätzlich JDK 21 und das
Android SDK (Platform 36, Build-Tools 35).

```sh
git clone https://github.com/Mindstorms123/Flatrate.git
cd Flatrate
bun install
bun run dev            # Web-Version auf http://localhost:8080
```

Android-APK:

```sh
echo "sdk.dir=/pfad/zum/android-sdk" > android/local.properties
bun run android:apk    # Web-Build + cap sync + gradlew assembleDebug
# Ergebnis: android/app/build/outputs/apk/debug/app-debug.apk
```

## Mitmachen

Issues und Pull Requests sind willkommen – besonders zu Verbundgebieten, in denen
Echtzeitdaten fehlen oder abweichen. Bitte beschreibe dabei Haltestelle, Linie und
Uhrzeit, damit die Fahrt nachvollziehbar ist.

## Lizenz

[MIT](LICENSE) – nutze, ändere und veröffentliche den Code frei.

Kartendaten © OpenStreetMap-Mitwirkende (ODbL). Fahrplandaten über Transitous stammen von
den jeweiligen Verkehrsverbünden. „Deutschlandticket" ist nur als beschreibender Begriff
verwendet; es besteht keine Verbindung zu Verkehrsunternehmen oder Verbünden.
