import Link from "next/link";
import { withBasePath } from "../../lib/basePath";
import {
  fetchServerPublicCreatorBySlug,
  fetchServerPublicCreators
} from "../../lib/public-creators";
import { fetchServerProjectsByCreatorSlug } from "../../lib/public-projects-server";

export async function getStaticPaths() {
  const creators = await fetchServerPublicCreators();

  return {
    paths: creators.map((creator) => ({ params: { slug: creator.slug } })),
    fallback: false
  };
}

export async function getStaticProps({ params }) {
  const creator = await fetchServerPublicCreatorBySlug(params?.slug);

  if (!creator) {
    return {
      notFound: true
    };
  }

  const projects = await fetchServerProjectsByCreatorSlug(creator.slug);

  return {
    props: {
      creator,
      projects
    }
  };
}

export default function PublicCreatorProfilePage({ creator, projects }) {
  return (
    <section className="dashboard-stack">
      <article className="card">
        <h1 style={{ marginTop: 0 }}>{creator.display_name}</h1>
        <p className="detail-text">
          {creator.bio || "Hier findest du alle freigegebenen Projekte dieses Creators."}
        </p>
        <p className="detail-text">Freigegebene Projekte: {projects.length}</p>
        <Link href="/" className="button detail-inline-btn">
          Zurück zur Übersicht
        </Link>
      </article>

      {projects.length ? (
        <section className="metric-detail-list" aria-label={`Projekte von ${creator.display_name}`}>
          {projects.map((project) => (
            <article key={project.id} className="metric-detail-item">
              <img
                src={withBasePath(project.screenshots?.[0] || "/images/project-placeholder.svg")}
                alt={`${project.title} Vorschau`}
                className="detail-image"
                style={{ maxHeight: "220px", marginBottom: "0.8rem" }}
              />
              <strong>{project.title}</strong>
              <p>{project.shortDesc}</p>
              <div className="button-row">
                <Link href={project.detailPath} className="button button-secondary">
                  Details ansehen
                </Link>
                {project.store_url ? (
                  <a
                    href={project.store_url}
                    target="_blank"
                    rel="noreferrer"
                    className="button"
                  >
                    Zur Originalseite
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <article className="card">
          <p>Noch keine freigegebenen Projekte auf diesem Profil.</p>
        </article>
      )}
    </section>
  );
}
