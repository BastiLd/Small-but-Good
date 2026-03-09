import Link from "next/link";
import InteractionTracker from "../../components/InteractionTracker";
import TrackedExternalLink from "../../components/TrackedExternalLink";
import { withBasePath } from "../../lib/basePath";
import {
  fetchServerPublicProjectBySlug,
  fetchServerPublicProjects
} from "../../lib/public-projects-server";

export async function getStaticPaths() {
  const projects = await fetchServerPublicProjects();

  return {
    paths: projects.map((project) => ({ params: { slug: project.runtimeId } })),
    fallback: false
  };
}

export async function getStaticProps({ params }) {
  const project = await fetchServerPublicProjectBySlug(params?.slug);

  if (!project) {
    return {
      notFound: true
    };
  }

  return {
    props: {
      project
    }
  };
}

export default function PublicProjectDetailPage({ project }) {
  return (
    <article className="card detail-wrap" aria-label={`${project.title} Details`}>
      <InteractionTracker
        itemId={project.runtimeId || project.id}
        itemTitle={project.title}
        itemSource={project.itemSource || "submission"}
        eventType="detail_view"
        routePath={project.detailPath}
      />

      <div>
        <img
          src={withBasePath(project.screenshots?.[0] || "/images/project-placeholder.svg")}
          alt={`${project.title} Vorschau`}
          className="detail-image"
        />

        <div className="detail-chip-row">
          <span className="detail-chip">{project.platformLabel || project.platform}</span>
          <span className="detail-chip">{project.typeLabel || project.type}</span>
        </div>

        {project.store_url ? (
          <TrackedExternalLink
            href={project.store_url}
            itemId={project.runtimeId || project.id}
            itemTitle={project.title}
            itemSource={project.itemSource || "submission"}
            className="button detail-inline-btn"
          >
            Zur Originalseite
          </TrackedExternalLink>
        ) : null}

        {project.creatorSlug ? (
          <Link href={`/creator/${project.creatorSlug}`} className="button button-secondary detail-inline-btn">
            Creator-Profil ansehen
          </Link>
        ) : null}
      </div>

      <div>
        <h1 style={{ marginTop: 0 }}>{project.title}</h1>
        {project.longDescription ? <p className="detail-text">{project.longDescription}</p> : null}

        <p className="detail-text">
          Dieses Community-Projekt wurde über CuratedHub eingereicht und freigegeben.
        </p>

        {project.creatorDisplayName ? (
          <p className="detail-text">
            Creator:{" "}
            {project.creatorSlug ? (
              <Link href={`/creator/${project.creatorSlug}`}>{project.creatorDisplayName}</Link>
            ) : (
              project.creatorDisplayName
            )}
          </p>
        ) : null}

        <Link href="/" className="button detail-inline-btn">
          Zurück zur Übersicht
        </Link>
      </div>
    </article>
  );
}
