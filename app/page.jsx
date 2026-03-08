import AppIntroOverlay from "../components/AppIntroOverlay";
import ProjectGrid from "../components/ProjectGrid";
import { APPS } from "../lib/apps";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <h1 style={{ marginTop: 0 }}>Marvel Fan Universe</h1>
        <p>
          Entdecke Projekte von kleinen Creators und kleine Creator an einem Ort. Klick auf ein
          Bild oder auf &quot;Mehr Infos&quot;, dann bekommst du eine Erklärung.
        </p>
      </section>

      <ProjectGrid initialApps={APPS} />
      <AppIntroOverlay />
    </>
  );
}
