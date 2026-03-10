import Link from "next/link";
import { useEffect, useState } from "react";
import InteractionTracker from "../../components/InteractionTracker";
import ProjectContentSections from "../../components/ProjectContentSections";
import TrackedExternalLink from "../../components/TrackedExternalLink";
import { withBasePath } from "../../lib/basePath";
import { DEFAULT_EXTERNAL_BUTTON_LABEL } from "../../lib/project-content";
import { fetchPublicProjectBySlug } from "../../lib/public-projects";
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

export default function PublicProjectDetailPage({ project: initialProject }) {
  const [project, setProject] = useState(initialProject);
  const externalButtonLabel = project.externalButtonLabel || DEFAULT_EXTERNAL_BUTTON_LABEL;

  useEffect(() => {
    let active = true;

    async function loadLatestProject() {
      const nextProject = await fetchPublicProjectBySlug(initialProject?.runtimeId);

      if (active && nextProject) {
        setProject(nextProject);
      }
    }

    loadLatestProject();

    return () => {
      active = false;
    };
  }, [initialProject?.runtimeId]);

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
            {externalButtonLabel}
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

        <ProjectContentSections title={project.title} sections={project.contentSections} />

        <p className="detail-text">
          Dieses Community-Projekt wurde Ã¼ber CuratedHub eingereicht und freigegeben.
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
          ZurÃ¼ck zur Ãœbersicht
        </Link>
      </div>
    </article>
  );
}
