"use client";

import styles from "./StorePreview.module.css";
import { openIntroFor } from "./AppIntroOverlay";
import { withBasePath } from "../lib/basePath";

export default function StorePreview({ app }) {
  if (!app) return null;

  const {
    id,
    title,
    shortDesc,
    screenshots = [],
    platform,
    store_url: storeUrl,
    type
  } = app;

  const mainShot = screenshots[0] || "/images/Logo_Nexus_Battle.png";
  const resolvedMainShot = withBasePath(mainShot);
  const isDiscordBot = type === "discord_bot";
  const isPrivate = app.isPrivate || app.private || app.visibility === "private";

  const contactLabel = app.creatorHandle || "@creator";
  const contactHref =
    app.contact_url ||
    (app.creator_email ? `mailto:${app.creator_email}` : "https://discord.com");

  const previewCommands =
    app.commands?.slice(0, 4).map((cmd) => cmd.signature || cmd.name) ||
    ["/kampf", "/mission", "/geschichte", "/sammlung"];

  async function trackClick(eventName) {
    if (typeof window !== "undefined" && window.location.hostname.endsWith("github.io")) {
      return;
    }

    try {
      await fetch("/api/track-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: id,
          referrer: typeof window !== "undefined" ? window.location.href : null,
          event: eventName
        })
      });
    } catch {
      // Ignore tracking errors in UI flow
    }
  }

  async function onOpenDetails() {
    if (!id) return;

    await trackClick("open_intro");

    const opened = openIntroFor(id, {
      imagePublicPath: withBasePath(app.introImage || mainShot),
      introText: app.introText || shortDesc
    });

    if (!opened) {
      window.location.href = withBasePath(`/app/${id}`);
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
    targetUrl.searchParams.set("utm_campaign", id || "app_card");

    window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");
  }

  return (
    <article className={styles.card} aria-label={`${title} Vorschaukarte`}>
      <div className={styles.mediaWrap}>
        <button
          type="button"
          className={styles.mediaButton}
          onClick={onOpenDetails}
          aria-label={`${title} Intro oeffnen`}
        >
          <img
            src={resolvedMainShot}
            alt={`${title} Screenshot`}
            className={styles.screenshot}
            loading="lazy"
          />
        </button>
      </div>

      <div className={styles.meta}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.shortDesc}>{shortDesc}</p>

        <div className={styles.tags}>
          <span className={styles.tag}>{platform || "web"}</span>
          <span className={styles.tag}>{type || "tool"}</span>
        </div>

        {isDiscordBot ? (
          <section className={styles.commandsPanel} aria-label="Discord Bot Commands">
            <h4 className={styles.commandsTitle}>Beispiel-Commands</h4>
            <ul className={styles.commandsList}>
              {previewCommands.map((command) => (
                <li key={command}>{command}</li>
              ))}
            </ul>
            {isPrivate ? (
              <a
                href={contactHref}
                className={`${styles.button} ${styles.secondaryButton} ${styles.contactButton}`}
                aria-label={`Kontakt aufnehmen mit ${contactLabel}`}
                target="_blank"
                rel="noreferrer"
              >
                Kontakt: {contactLabel}
              </a>
            ) : null}
          </section>
        ) : null}

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
            aria-label={`${title} auf Originalseite oeffnen`}
            disabled={!storeUrl}
          >
            Zur Originalseite
          </button>
        </div>
      </div>
    </article>
  );
}