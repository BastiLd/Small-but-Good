import Link from "next/link";
import { notFound } from "next/navigation";
import InteractionTracker from "../../../components/InteractionTracker";
import ProjectContentSections from "../../../components/ProjectContentSections";
import TrackedExternalLink from "../../../components/TrackedExternalLink";
import { withBasePath } from "../../../lib/basePath";
import { buildCardImageStyle, DEFAULT_EXTERNAL_BUTTON_LABEL } from "../../../lib/project-content";
import { fetchServerPublicAppBySlug, fetchServerPublicApps } from "../../../lib/public-apps-server";

export async function generateStaticParams() {
  const apps = await fetchServerPublicApps();
  return apps.map((app) => ({ id: app.runtimeId || app.id }));
}

export default async function AppDetailPage({ params }) {
  const app = await fetchServerPublicAppBySlug(params?.id);

  if (!app) {
    notFound();
  }

  const externalButtonLabel = app.externalButtonLabel || DEFAULT_EXTERNAL_BUTTON_LABEL;

  return (
    <article className="card detail-wrap" aria-label={`${app.title} Details`}>
      <InteractionTracker
        itemId={app.runtimeId || app.id}
        itemTitle={app.title}
        itemSource={app.itemSource || "local"}
        eventType="detail_view"
        routePath={`/app/${app.runtimeId || app.id}`}
      />

      <div>
        <div className="detail-image-frame">
          <img
            src={withBasePath(app.screenshots?.[0] || "/images/project-placeholder.svg")}
            alt={`${app.title} Logo`}
            className="detail-image"
            style={buildCardImageStyle(app.cardImageScale)}
          />
        </div>

        <div className="detail-chip-row">
          <span className="detail-chip">{app.platformLabel || app.platform}</span>
          <span className="detail-chip">{app.typeLabel || app.type}</span>
        </div>

        {app.store_url ? (
          <TrackedExternalLink
            href={app.store_url}
            itemId={app.runtimeId || app.id}
            itemTitle={app.title}
            itemSource={app.itemSource || "local"}
            className="button detail-inline-btn"
          >
            {externalButtonLabel}
          </TrackedExternalLink>
        ) : null}

        {app.creatorSlug ? (
          <Link href={`/creator/${app.creatorSlug}`} className="button button-secondary detail-inline-btn">
            Creator-Profil ansehen
          </Link>
        ) : null}
      </div>

      <div>
        <h1 style={{ marginTop: 0 }}>{app.title}</h1>
        {app.longDescription ? <p className="detail-text">{app.longDescription}</p> : null}

        <ProjectContentSections title={app.title} sections={app.contentSections} />

        {app.creatorDisplayName ? (
          <p className="detail-text">
            Creator:{" "}
            {app.creatorSlug ? (
              <Link href={`/creator/${app.creatorSlug}`}>{app.creatorDisplayName}</Link>
            ) : (
              app.creatorDisplayName
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
