"use client";

import styles from "./StorePreview.module.css";
import { openIntroFor } from "./AppIntroOverlay";
import { withBasePath } from "../lib/basePath";
import { trackInteraction } from "../lib/interaction-tracking";
import {
  buildCardImageStyle,
  DEFAULT_EXTERNAL_BUTTON_LABEL,
  normalizeCardImageScale
} from "../lib/project-content";

export default function StorePreview({ app }) {
  if (!app) return null;

  const {
    id,
    runtimeId,
    itemSource = "local",
    detailPath,
    title,
    shortDesc,
    screenshots = [],
    platform,
    platformLabel,
    store_url: storeUrl,
    type,
    typeLabel,
    mediaFit = "contain",
    mediaBleed = false
  } = app;

  const mainShot = screenshots[0] || "/images/project-placeholder.svg";
  const resolvedMainShot = withBasePath(mainShot);
  const imageScale = normalizeCardImageScale(app.cardImageScale);
  const detailRoute =
    typeof detailPath !== "undefined" ? detailPath : itemSource === "local" ? `/app/${id}` : null;
  const externalButtonLabel = app.externalButtonLabel || DEFAULT_EXTERNAL_BUTTON_LABEL;

  const screenshotClassName = [
    styles.screenshot,
    mediaFit === "cover" ? styles.screenshotCover : "",
    mediaBleed ? styles.screenshotBleed : ""
  ]
    .filter(Boolean)
    .join(" ");

  const mediaButtonClassName = [styles.mediaButton, mediaBleed ? styles.mediaButtonBleed : ""]
    .filter(Boolean)
    .join(" ");

  async function trackClick(eventType) {
    await trackInteraction({
      itemId: runtimeId || id,
      itemTitle: title,
      itemSource,
      eventType,
      routePath: typeof window !== "undefined" ? window.location.pathname : null
    });
  }

  async function onOpenDetails() {
    if (!id && !runtimeId) return;

    await trackClick("intro_open");

    const opened = openIntroFor(runtimeId || id, {
      imagePublicPath: withBasePath(app.introImage || mainShot),
      imageScale,
      introText: app.introText || shortDesc,
      detailPath: detailRoute
    });

    if (!opened && detailRoute) {
      window.location.href = withBasePath(detailRoute);
    }
  }

  async function onExternalClick() {
    if (!storeUrl) return;

    await trackClick("external_click");

    let targetUrl;
    try {
      targetUrl = new URL(storeUrl);
    } catch {
      targetUrl = new URL(storeUrl, window.location.origin);
    }

    targetUrl.searchParams.set("utm_source", "curatedhub");
    targetUrl.searchParams.set("utm_medium", "store_preview");
    targetUrl.searchParams.set("utm_campaign", runtimeId || id || "app_card");

    window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");
  }

  return (
    <article className={styles.card} aria-label={`${title} Vorschaukarte`}>
      <div className={styles.mediaWrap}>
        <button
          type="button"
          className={mediaButtonClassName}
          onClick={onOpenDetails}
          aria-label={`${title} Intro öffnen`}
        >
          <img
            src={resolvedMainShot}
            alt={`${title} Screenshot`}
            className={screenshotClassName}
            loading="lazy"
            style={buildCardImageStyle(imageScale)}
          />
        </button>
      </div>

      <div className={styles.meta}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.shortDesc}>{shortDesc}</p>

        <div className={styles.tags}>
          <span className={styles.tag}>{platformLabel || platform || "Web"}</span>
          <span className={styles.tag}>{typeLabel || type || "Projekt"}</span>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.secondaryButton}`}
            aria-label={`Mehr Infos zu ${title}`}
            onClick={onOpenDetails}
          >
            Mehr Infos
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={onExternalClick}
            aria-label={`${title} auf Originalseite öffnen`}
            disabled={!storeUrl}
          >
            {externalButtonLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
