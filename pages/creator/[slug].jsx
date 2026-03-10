import Link from "next/link";
import { useEffect, useState } from "react";
import { withBasePath } from "../../lib/basePath";
import { fetchPublicAppsByCreatorSlug } from "../../lib/public-apps";
import { buildCardImageStyle, DEFAULT_EXTERNAL_BUTTON_LABEL } from "../../lib/project-content";
import { fetchPublicProjectsByCreatorSlug } from "../../lib/public-projects";
import { mergeFeedProjects } from "../../lib/project-utils";
import {
  fetchServerPublicCreatorBySlug,
  fetchServerPublicCreators
} from "../../lib/public-creators";
import { fetchServerPublicAppsByCreatorSlug } from "../../lib/public-apps-server";
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

  const [appProjects, communityProjects] = await Promise.all([
    fetchServerPublicAppsByCreatorSlug(creator.slug),
    fetchServerProjectsByCreatorSlug(creator.slug)
  ]);

  return {
    props: {
      creator,
      projects: mergeFeedProjects(appProjects, communityProjects)
    }
  };
}

function isKnownBastianProfile(creator) {
  const normalizedDisplayName = (creator?.display_name || "").trim().toLowerCase();
  const normalizedSlug = (creator?.slug || "").trim().toLowerCase();

  return (
    normalizedSlug === "bastian-klaus" ||
    normalizedDisplayName === "bastian klaus" ||
    normalizedDisplayName === "sf" ||
    normalizedSlug.startsWith("sf-")
  );
}

export default function PublicCreatorProfilePage({ creator, projects: initialProjects }) {
  const [projects, setProjects] = useState(initialProjects);
  const isBastianProfile = isKnownBastianProfile(creator);
  const profileName = isBastianProfile ? "Bastian Klaus" : creator.display_name;
  const profileBio = isBastianProfile
    ? "Creator von CuratedHub."
    : creator.bio || "Hier findest du alle freigegebenen Projekte dieses Creators.";

  useEffect(() => {
    let active = true;

    async function loadLatestProjects() {
      const [nextAppProjects, nextCommunityProjects] = await Promise.all([
        fetchPublicAppsByCreatorSlug(creator.slug),
        fetchPublicProjectsByCreatorSlug(creator.slug)
      ]);
      const nextProjects = mergeFeedProjects(nextAppProjects, nextCommunityProjects);

      if (active && (nextProjects.length || !projects.length)) {
        setProjects(nextProjects);
      }
    }

    loadLatestProjects();

    return () => {
      active = false;
    };
  }, [creator.slug, projects.length]);

  return (
    <section className="dashboard-stack">
      <article className="card">
        <h1 style={{ marginTop: 0 }}>{profileName}</h1>
        <p className="detail-text">{profileBio}</p>
        {isBastianProfile ? (
          <p className="detail-text">
            <a
              href="https://bastianklaus.online"
              target="_blank"
              rel="noreferrer"
              className="creator-profile-link"
            >
              bastianklaus.online
            </a>
          </p>
        ) : null}
        <p className="detail-text">Freigegebene Projekte: {projects.length}</p>
        <Link href="/" className="button detail-inline-btn">
          Zurück zur Übersicht
        </Link>
      </article>

      {projects.length ? (
        <section className="metric-detail-list" aria-label={`Projekte von ${profileName}`}>
          {projects.map((project) => (
            <article key={project.id} className="metric-detail-item">
              <div className="detail-image-frame" style={{ marginBottom: "0.8rem" }}>
                <img
                  src={withBasePath(project.screenshots?.[0] || "/images/project-placeholder.svg")}
                  alt={`${project.title} Vorschau`}
                  className="detail-image"
                  style={{
                    ...buildCardImageStyle(project.cardImageScale),
                    maxHeight: "220px"
                  }}
                />
              </div>
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
                    {project.externalButtonLabel || DEFAULT_EXTERNAL_BUTTON_LABEL}
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
