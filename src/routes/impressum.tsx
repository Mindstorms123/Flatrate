import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/impressum")({
  head: () => ({
    meta: [
      { title: "Impressum – Flatrate" },
      { name: "description", content: "Impressum der Flatrate-App." },
      { property: "og:title", content: "Impressum – Flatrate" },
      { property: "og:description", content: "Impressum der Flatrate-App." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ImpressumPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function ImpressumPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-5">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={16} /> Zurück
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Impressum</h1>
        <p className="mt-1 text-sm text-muted-foreground">Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)</p>
      </div>

      <Section title="Diensteanbieter">
        <p>
          Kai Krafft
          <br />
          Bierstraße 20
          <br />
          49074 Osnabrück
          <br />
          Deutschland
        </p>
      </Section>

      <Section title="Kontakt">
        <p>
          E-Mail:{" "}
          <a href="mailto:wuesteleon@t-online.de" className="text-primary underline underline-offset-2">
            wuesteleon@t-online.de
          </a>
        </p>
      </Section>

      <Section title="Verantwortlich für den Inhalt">
        <p>
          Leon Wüste (Entwicklung)
          <br />
          E-Mail:{" "}
          <a href="mailto:wuesteleon@t-online.de" className="text-primary underline underline-offset-2">
            wuesteleon@t-online.de
          </a>
        </p>
      </Section>

      <Section title="Projekt">
        <p>
          Flatrate ist ein nicht-kommerzielles Open-Source-Projekt. Der Quelltext ist öffentlich auf GitHub
          einsehbar:{" "}
          <a
            href="https://github.com/Mindstorms123/Flatrate"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2"
          >
            github.com/Mindstorms123/Flatrate
          </a>
        </p>
      </Section>

      <Section title="Haftung für Inhalte">
        <p>
          Die Inhalte dieser App wurden mit Sorgfalt erstellt. Für Richtigkeit, Vollständigkeit und Aktualität
          der angezeigten Fahrplan- und Echtzeitdaten wird keine Gewähr übernommen. Die Daten stammen von
          Drittanbietern (siehe <Link to="/datenschutz" className="text-primary underline underline-offset-2">Datenschutzerklärung</Link>).
          Verbindungsauskünfte sind unverbindlich; maßgeblich sind die Angaben der jeweiligen Verkehrsunternehmen.
        </p>
      </Section>

      <Section title="Haftung für Links">
        <p>
          Diese App enthält Links zu externen Websites und Diensten Dritter, auf deren Inhalte wir keinen
          Einfluss haben. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter verantwortlich.
        </p>
      </Section>

      <Section title="Urheberrecht">
        <p>
          Der Quelltext der App ist unter der MIT-Lizenz veröffentlicht. Fahrplandaten unterliegen den
          Nutzungsbedingungen der jeweiligen Datenquellen (Transitous, DELFI e.V., Verkehrsverbünde).
        </p>
      </Section>
    </div>
  );
}
