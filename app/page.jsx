import AppIntroOverlay from "../components/AppIntroOverlay";
import ProjectGrid from "../components/ProjectGrid";
import { APPS } from "../lib/apps";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <h1 style={{ marginTop: 0 }}>Marvel Fan Universe</h1>
        <p>
          Entdecke eure MFU-Projekte und Creator an einem Ort. Klick auf ein Bild oder auf
          &nbsp;&quot;Mehr Infos&quot;, dann bekommst du zuerst den Intro-Fade.
        </p>
      </section>

      <ProjectGrid initialApps={APPS} />
      <AppIntroOverlay />
    </>
  );
}
