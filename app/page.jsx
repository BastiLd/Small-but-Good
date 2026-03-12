import AppIntroOverlay from "../components/AppIntroOverlay";
import ProjectGrid from "../components/ProjectGrid";
import { fetchServerPublicApps } from "../lib/public-apps-server";
import { fetchServerPublicProjects } from "../lib/public-projects-server";
import { mergeFeedProjects } from "../lib/project-utils";

export default async function HomePage() {
  const [localApps, communityApps] = await Promise.all([
    fetchServerPublicApps(),
    fetchServerPublicProjects()
  ]);
  const initialApps = mergeFeedProjects(localApps, communityApps);

  return (
    <>
      <section className="hero">
        <h1 style={{ marginTop: 0, textAlign: "center" }}>CuratedHub</h1>
        <p style={{ textAlign: "center" }}>
          Entdecke Projekte von kleinen Creators und kleine Creator an einem Ort. Klick auf ein
          Bild oder auf &quot;Mehr Infos&quot;, dann bekommst du eine Erklärung.
        </p>
      </section>

      <ProjectGrid initialApps={initialApps} />
      <AppIntroOverlay />
    </>
  );
}
