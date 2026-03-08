import AppIntroOverlay from "../components/AppIntroOverlay";
import StorePreview from "../components/StorePreview";
import { APPS } from "../lib/apps";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <h1 style={{ marginTop: 0 }}>Marvel Fan Universe</h1>
        <p>
          Entdecke eure MFU-Projekte und Creator an einem Ort. Klick auf ein Bild oder auf
          "Mehr Infos", dann bekommst du zuerst den Intro-Fade.
        </p>
      </section>

      <section className="page-grid" aria-label="Projektübersicht">
        {APPS.map((app) => (
          <StorePreview key={app.id} app={app} />
        ))}
      </section>

      <AppIntroOverlay />
    </>
  );
}
