"use client";

import Link from "next/link";
import { withBasePath } from "../lib/basePath";
import { buildCardImageStyle, DEFAULT_EXTERNAL_BUTTON_LABEL } from "../lib/project-content";

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

export default function CreatorProfileView({ creator, projects = [] }) {
  if (!creator) {
    return null;
  }

  const isBastianProfile = isKnownBastianProfile(creator);
  const profileName = isBastianProfile ? "Bastian Klaus" : creator.display_name;
  const profileBio = isBastianProfile
    ? "Creator von CuratedHub."
    : creator.bio || "Hier findest du alle freigegebenen Projekte dieses Creators.";

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
                  <a href={project.store_url} target="_blank" rel="noreferrer" className="button">
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
