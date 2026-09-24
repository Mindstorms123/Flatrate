import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({
    meta: [
      { title: "Datenschutzerklärung – Flatrate" },
      { name: "description", content: "Datenschutzerklärung der Flatrate-App." },
      { property: "og:title", content: "Datenschutzerklärung – Flatrate" },
      { property: "og:description", content: "Datenschutzerklärung der Flatrate-App." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DatenschutzPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function DatenschutzPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-5">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} /> Zurück
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Datenschutzerklärung</h1>
        <p className="mt-1 text-sm text-muted-foreground">Stand: September 2026</p>
      </div>

      <Section title="1. Verantwortlicher">
        <p>
          Kai Krafft
          <br />
          Bierstraße 20
          <br />
          49074 Osnabrück
          <br />
          E-Mail:{" "}
          <a href="mailto:wuesteleon@t-online.de" className="text-primary underline underline-offset-2">
            wuesteleon@t-online.de
          </a>
        </p>
      </Section>

      <Section title="2. Grundsatz: Lokale Speicherung">
        <p>
          Flatrate ist bewusst so gebaut, dass deine persönlichen Daten auf deinem Gerät bleiben. Tickets,
          Favoriten, Pendelstrecken, hinterlegte Reisen, Orte (z. B. Zuhause, Arbeit/Schule) und Einstellungen
          werden ausschließlich lokal im Speicher deines Geräts abgelegt (localStorage bzw. App-Speicher). Es
          gibt kein Nutzerkonto, keinen eigenen Server und kein Tracking durch uns. Wir erheben, speichern und
          verarbeiten selbst keine personenbezogenen Daten.
        </p>
      </Section>

      <Section title="3. Verbindungs- und Haltestellensuche (Transitous)">
        <p>
          Für Fahrplandaten, Echtzeitinformationen und Haltestellensuche werden Anfragen an den Dienst{" "}
          <strong>Transitous</strong> (api.transitous.org, ein offenes, nicht-kommerzielles Routing-Netzwerk auf
          Basis von MOTIS) gesendet. Übertragen werden dabei die von dir eingegebenen Haltestellen bzw.
          Koordinaten und der gewünschte Zeitpunkt. Die Daten basieren auf offiziellen Open-Data-Feeds (GTFS /
          GTFS-RT) der Verkehrsunternehmen, u. a. über DELFI e.V. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO
          (Bereitstellung der angefragten Funktion).
        </p>
      </Section>

      <Section title="4. Standortdaten">
        <p>
          Wenn du der Standortfreigabe zustimmst, wird deine Position lokal auf deinem Gerät genutzt, um
          Haltestellen in deiner Nähe zu sortieren, Fußwege zu berechnen und zu erkennen, ob du deiner Reise
          voraus bist. Für die Suche nach nahen Haltestellen werden Koordinaten an Transitous übertragen (siehe
          Abschnitt 3). Eine Speicherung deines Standorts auf externen Servern durch uns findet nicht statt.
          Die Freigabe kannst du jederzeit in den Systemeinstellungen deines Geräts widerrufen.
        </p>
      </Section>

      <Section title="5. Karten und Fußweg-Routing (OpenStreetMap)">
        <p>
          Die Fußweg-Karten in der App stammen von <strong>OpenStreetMap</strong> (Kartenkacheln:
          tile.openstreetmap.org, Betreiber: OpenStreetMap Foundation). Beim Laden der Karte werden deine
          IP-Adresse und die abgerufenen Kartenausschnitte an die Server der OpenStreetMap Foundation
          übertragen. Für die Berechnung von Fußwegen wird der öffentliche OSRM-Routingdienst
          (routing.openstreetmap.de, FOSSGIS e.V.) mit den jeweiligen Start- und Zielkoordinaten aufgerufen.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Es gelten die Datenschutzrichtlinien der OpenStreetMap
          Foundation (wiki.osmfoundation.org/wiki/Privacy_Policy).
        </p>
      </Section>

      <Section title="6. Ticket-Import und -Erneuerung">
        <p>
          Wallet-Dateien (.pkpass) werden ausschließlich lokal auf deinem Gerät ausgewertet und gespeichert.
          Wenn du einen Download-Link für die automatische Ticket-Erneuerung hinterlegst, ruft die App diesen
          Link direkt beim jeweiligen Anbieter (z. B. dein Verkehrsverbund oder deine Hochschule) ab. Dabei
          gelten die Datenschutzbestimmungen des jeweiligen Anbieters. Login-Daten werden von uns nicht
          gespeichert oder übertragen; das Einloggen erfolgt direkt auf der Seite des Anbieters.
        </p>
      </Section>

      <Section title="7. Benachrichtigungen">
        <p>
          Benachrichtigungen (Verspätungen, Umstiege, Reisefortschritt) werden lokal auf deinem Gerät erzeugt.
          Es werden keine Push-Dienste von Drittanbietern verwendet und keine Geräte-Token an Server übertragen.
        </p>
      </Section>

      <Section title="8. Hosting der Web-Version (GitHub Pages)">
        <p>
          Die Web-Version wird über <strong>GitHub Pages</strong> (GitHub, Inc., 88 Colin P Kelly Jr St,
          San Francisco, CA 94107, USA) ausgeliefert. Beim Aufruf der Seite verarbeitet GitHub technisch
          bedingt deine IP-Adresse in Server-Logdateien. Es gelten die GitHub Privacy Statement
          (docs.github.com/site-policy/privacy-policies). Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
          (berechtigtes Interesse an der Bereitstellung des Angebots).
        </p>
      </Section>

      <Section title="9. Schriftarten (Google Fonts)">
        <p>
          Zur Darstellung werden Schriftarten von Google Fonts (fonts.googleapis.com / fonts.gstatic.com,
          Anbieter: Google Ireland Ltd., Gordon House, Barrow Street, Dublin 4, Irland) geladen. Dabei wird
          deine IP-Adresse an Google übertragen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (einheitliche
          Darstellung). Es gilt die Datenschutzerklärung von Google (policies.google.com/privacy).
        </p>
      </Section>

      <Section title="10. Deine Rechte">
        <p>
          Du hast nach der DSGVO das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der
          Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). Da wir keine personenbezogenen
          Daten speichern, kannst du alle lokal gespeicherten Daten jederzeit selbst entfernen, indem du die
          App-Daten löschst oder die App deinstallierst. Zusätzlich besteht ein Beschwerderecht bei der
          zuständigen Aufsichtsbehörde (für Niedersachsen: Die Landesbeauftragte für den Datenschutz
          Niedersachsen, Prinzenstraße 5, 30159 Hannover).
        </p>
      </Section>

      <Section title="11. Änderungen">
        <p>
          Diese Datenschutzerklärung kann bei Weiterentwicklung der App angepasst werden. Die aktuelle Fassung
          ist jederzeit in der App und auf der Web-Version unter /datenschutz abrufbar.
        </p>
      </Section>
    </div>
  );
}
