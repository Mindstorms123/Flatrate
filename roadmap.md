# Roadmap

- [x] Android-Live-Update mit animiertem Reisefortschritt und nativer Fortschrittsleiste

- [x] Favoriten und Pendelstrecken lokal speichern, laden und löschen
- [x] Verbindungen automatisch mit Live-Daten aktualisieren
- [x] Knappe Umstiege erkennen und Alternativen direkt vorschlagen
- [x] Mobil und Desktop prüfen
- [x] Reise hinterlegen (/trip): Live-Fortschritt, aktueller Zug/Bus, naechster Umstieg mit Steig, "Ich bin hier" zum Neuplanen unterwegs
- [x] Benachrichtigungen bei Verspätungen, knappen/verpassten Umstiegen, Steigwechsel, Ausfall und Einstieg
- [x] Live-Ansicht: aktuelle Haltestelle und Anzahl verbleibender Halte anzeigen
- [x] Pendelstrecken: Gegenstrecke direkt anzeigen (Startseite + Reise-Planer)
- [x] Benachrichtigungen kompakt als Glocken-Menü statt eigener Sektion

- [x] Beliebig viele Alternativ-Haltestellen für Start und Ziel; alle Kombinationen werden geprüft, doppelte/schlechtere Verbindungen gefiltert, nach Ankunft sortiert
- [x] Pendelstrecken erscheinen nur als Hin- und Rückweg (Alternativhaltestellen laufen im Hintergrund mit)

- [x] Login beim Anbieter oeffnen, heruntergeladene Wallet-Datei per Teilen/Oeffnen-mit direkt uebernehmen
- [x] Offline-Betrieb: Service Worker, Manifest, Ticketansicht ohne Internet
- [x] Eigenständige Android-App und APK ohne Abhängigkeit von einer eigenen Website erstellen

- [x] Alternativ-Haltestellen-Menü für Pendelstrecken mobil optimieren und mit „Übernehmen“ bestätigen

- [x] Verbindungsdetails vor dem Hinterlegen anzeigen und Suchzustand beim Zurückgehen erhalten

- [x] Haltestellen-Vorschlag beim Antippen sofort zur Start- oder Zielliste hinzufügen
- [x] Nächste Anschlüsse in den Verbindungsdetails anzeigen und ausgewählte Ersatzfahrt sofort als Reise übernehmen

- [x] Anbieter-Login innerhalb der Android-App öffnen und PKPASS-Downloads automatisch übernehmen
- [x] Ticket-Hinweis auf Startseite ausblenden, wenn Ticket hinterlegt
- [x] Benachrichtigung 10 Minuten vor Reisebeginn
- [x] Geplanten Umstiegs-Fußweg unabhängig vom aktuellen Standort anzeigen und Ersatzanschlüsse am betroffenen Verkehrsmittel mit tatsächlicher Abfahrtszeit einordnen
- [x] Anschlussalternativen einer Pendelstrecke über alle hinterlegten Zielhaltestellen suchen und nach schnellster Ankunft zusammenführen
- [x] Android-Erststart: Benachrichtigungs- und Standortberechtigung zuverlässig nacheinander abfragen
- [x] Ausgewählte Anschlussalternative beim Hinterlegen erhalten und Haltestellensuche direkt nach Standortfreigabe aktualisieren

- [x] iPhone-Nutzung über „Zum Home-Bildschirm hinzufügen": Web-Variante kostenlos über GitHub Pages veröffentlicht (https://mindstorms123.github.io/Flatrate/), Unterpfad-fähig, offline, iOS-Meta, Anleitung in der README, Auto-Deploy-Workflow

- [x] Android: dauerhafte Live-Benachrichtigung (Foreground-Service) mit Reiseverlauf, Umstiegen und Steigen; läuft im Hintergrund, bei geschlossener App und Display aus, spiegelt auf Smartwatch; Routine-Erinnerungen (Losgehen/Einsteigen) dort abgeschaltet

- [x] Feste App-Signatur (android/flatrate-signing.keystore): neue Versionen installieren als Update, Tickets/Strecken/Einstellungen bleiben erhalten; zusätzlich Sicherung/Wiederherstellung als JSON auf der Ticketseite
