"use client";

import Link from "next/link";
import InteractionTracker from "./InteractionTracker";
import ProjectContentSections from "./ProjectContentSections";
import TrackedExternalLink from "./TrackedExternalLink";
import { withBasePath } from "../lib/basePath";
import { buildCardImageStyle, DEFAULT_EXTERNAL_BUTTON_LABEL } from "../lib/project-content";

// Shared detail markup for both community projects (/projekte/[slug]) and
// local apps (/app/[id]). The two only differ in a few cosmetic details,
// expressed via props.
export default function DetailView({
  item,
  altSuffix = "Vorschau",
  defaultItemSource = "submission",
  footerNote = null
}) {
  if (!item) {
    return null;
  }

  const externalButtonLabel = item.externalButtonLabel || DEFAULT_EXTERNAL_BUTTON_LABEL;
  const itemId = item.runtimeId || item.id;
  const itemSource = item.itemSource || defaultItemSource;

  return (
    <article className="card detail-wrap" aria-label={`${item.title} Details`}>
      <InteractionTracker
        itemId={itemId}
        itemTitle={item.title}
        itemSource={itemSource}
        eventType="detail_view"
        routePath={item.detailPath}
      />

      <div>
        <div className="detail-image-frame">
          <img
            src={withBasePath(item.screenshots?.[0] || "/images/project-placeholder.svg")}
            alt={`${item.title} ${altSuffix}`}
            className="detail-image"
            style={buildCardImageStyle(item.cardImageScale)}
          />
        </div>

        <div className="detail-chip-row">
          <span className="detail-chip">{item.platformLabel || item.platform}</span>
          <span className="detail-chip">{item.typeLabel || item.type}</span>
        </div>

        {item.store_url ? (
          <TrackedExternalLink
            href={item.store_url}
            itemId={itemId}
            itemTitle={item.title}
            itemSource={itemSource}
            className="button detail-inline-btn"
          >
            {externalButtonLabel}
          </TrackedExternalLink>
        ) : null}

        {item.creatorSlug ? (
          <Link
            href={`/creator/${item.creatorSlug}`}
            className="button button-secondary detail-inline-btn"
          >
            Creator-Profil ansehen
          </Link>
        ) : null}
      </div>

      <div>
        <h1 style={{ marginTop: 0 }}>{item.title}</h1>
        {item.longDescription ? <p className="detail-text">{item.longDescription}</p> : null}

        <ProjectContentSections title={item.title} sections={item.contentSections} />

        {footerNote ? <p className="detail-text">{footerNote}</p> : null}

        {item.creatorDisplayName ? (
          <p className="detail-text">
            Creator:{" "}
            {item.creatorSlug ? (
              <Link href={`/creator/${item.creatorSlug}`}>{item.creatorDisplayName}</Link>
            ) : (
              item.creatorDisplayName
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
