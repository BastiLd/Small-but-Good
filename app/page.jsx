import AppIntroOverlay from "../components/AppIntroOverlay";
import StorePreview from "../components/StorePreview";
import { APPS } from "../lib/apps";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <h1 style={{ marginTop: 0 }}>MFU Nexus Battle</h1>
        <p>
          Dein Marvel Card-Game Bot mit Fights, Missionen und kommendem Story-Mode.
          Klick auf Bild oder "Mehr Infos" und du bekommst zuerst den Intro-Fade.
        </p>
      </section>

      <section className="page-grid" aria-label="Bot preview grid">
        {APPS.map((app) => (
          <StorePreview key={app.id} app={app} />
        ))}
      </section>

      <AppIntroOverlay />
    </>
  );
}