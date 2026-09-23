# Mitmachen bei Flatrate

Danke für dein Interesse! Jede Hilfe ist willkommen – vom Tippfehler bis zum neuen Feature.

## Fehler melden

Bitte gib bei Fahrplan- oder Echtzeitproblemen immer an:

- Haltestelle(n) und Linie
- Datum und Uhrzeit der Fahrt
- Was du erwartet hast und was die App gezeigt hat

Viele Abweichungen kommen aus den Daten der Verkehrsverbünde (über
[Transitous](https://transitous.org)) und nicht aus der App selbst – mit diesen Angaben
lässt sich das auseinanderhalten.

## Entwicklung

```sh
bun install
bun run dev        # http://localhost:8080
bun run lint
bunx tsc --noEmit
```

Android:

```sh
echo "sdk.dir=/pfad/zum/android-sdk" > android/local.properties
bun run android:apk
```

## Konventionen

- TypeScript, React 19, dateibasiertes Routing in `src/routes` (TanStack Router)
- Farben, Abstände und Schatten nur über die Design-Tokens in `src/styles.css`,
  keine festen Farbwerte in Komponenten
- Texte in der Benutzeroberfläche auf Deutsch
- Keine Server- oder Kontopflicht: Daten bleiben lokal auf dem Gerät
- `src/routeTree.gen.ts` wird generiert und nicht von Hand bearbeitet

## Pull Requests

Kleine, fokussierte PRs sind am einfachsten zu prüfen. Beschreibe kurz, was sich für
Nutzerinnen und Nutzer ändert, und füge bei UI-Änderungen einen Screenshot bei.
